import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { contracts, pack, install, verify, checkHttp, sha256 } from '../scripts/unity-artifact.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'simus-artifact-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'source'), output = path.join(root, 'output');
  for (const [base, metadata] of Object.entries(contracts)) {
    const dir = path.join(source, base);
    await mkdir(path.join(dir, 'Build'), { recursive: true });
    await writeFile(path.join(dir, 'build.json'), JSON.stringify(metadata));
    await writeFile(path.join(dir, 'bridge.js'), '// fixture bridge');
    await writeFile(path.join(dir, 'index.html'), 'createUnityInstance bridge.js Build/city.loader.js Build/city.framework.js Build/city.data Build/city.wasm');
    for (const suffix of ['loader.js', 'framework.js', 'data', 'wasm']) await writeFile(path.join(dir, 'Build', `city.${suffix}`), `fixture ${suffix}`);
  }
  const lock = await pack(source, output);
  return { root, source, output, lock, archive: path.join(output, lock.asset) };
}

test('roundtrip pack/install preserves each route, file hash and map contract', async t => {
  const f = await fixture(t), target = path.join(f.root, 'public');
  await install(f.archive, target, f.lock);
  await verify(target, f.lock);
  assert.equal(await sha256(f.archive), f.lock.archive_sha256);
  await assert.rejects(install(f.archive, target, f.lock), /Refusing to replace/);
  await verify(target, f.lock);
});

test('missing, corrupted and unexpected files and symlinks fail closed', async t => {
  const f = await fixture(t);
  const file = path.join(f.source, 'city', 'Build/city.wasm');
  const original = await readFile(file);
  await writeFile(file, 'corrupt');
  await assert.rejects(verify(f.source, f.lock), /SHA-256/);
  await rm(file);
  await assert.rejects(verify(f.source, f.lock), /file set mismatch/);
  await writeFile(file, original);
  const extra = path.join(f.source, 'city', 'Build/extra.data');
  await writeFile(extra, 'stale');
  await assert.rejects(verify(f.source, f.lock), /file set mismatch/);
  await rm(extra);
  await rm(file);
  await symlink(path.join(f.source, 'city/build.json'), file);
  await assert.rejects(verify(f.source, f.lock), /Symlink/);
});

test('wrong map/path version and map-only builds cannot be packed', async t => {
  const f = await fixture(t), file = path.join(f.source, 'city-rebuild-v002/build.json');
  for (const change of [{ map_version: 'pending-map-v1' }, { path_versions: ['wrong-path'] }, { npc_motion_enabled: false }, { exhibition_ready: true }]) {
    await writeFile(file, JSON.stringify({ ...contracts['city-rebuild-v002'], ...change }));
    await assert.rejects(pack(f.source, path.join(f.root, 'invalid')), /mismatch/);
  }
});

test('compressed assets and broken HTML references cannot be packed', async t => {
  const f = await fixture(t);
  const compressed = path.join(f.source, 'city/Build/city.wasm.br');
  await writeFile(compressed, 'compressed');
  await assert.rejects(pack(f.source, path.join(f.root, 'invalid')), /uncompressed/);
  await rm(compressed);
  await writeFile(path.join(f.source, 'city/index.html'), 'createUnityInstance bridge.js Build/missing.loader.js');
  await assert.rejects(pack(f.source, path.join(f.root, 'invalid')), /HTML reference/);
});

test('archive mismatch is rejected before installation; unsafe lock paths rejected', async t => {
  const f = await fixture(t), target = path.join(f.root, 'target');
  const corrupt = path.join(f.root, 'corrupt.tar.gz');
  await cp(f.archive, corrupt);
  await writeFile(corrupt, 'broken');
  await assert.rejects(install(corrupt, target, f.lock), /archive SHA-256/);
  await assert.rejects(readFile(path.join(target, 'city/build.json')), /ENOENT/);
  const unsafe = structuredClone(f.lock);
  unsafe.files[0].path = '../escape';
  await assert.rejects(install(f.archive, target, unsafe), /Invalid locked file/);
});

test('archive links and extra members are rejected even when archive hash is pinned', async t => {
  const f = await fixture(t);
  const { promisify } = await import('node:util');
  const exec = promisify((await import('node:child_process')).execFile);
  const dir = path.join(f.root, 'malicious');
  await cp(f.source, dir, { recursive: true });
  await rm(path.join(dir, 'city/Build/city.wasm'));
  await symlink('/etc/passwd', path.join(dir, 'city/Build/city.wasm'));
  const archive = path.join(f.root, 'links.tar.gz');
  await exec('tar', ['--format=ustar', '-czf', archive, '-C', dir, ...f.lock.files.map(file => file.path)], { env: { ...process.env, COPYFILE_DISABLE: '1' } });
  const lock = { ...f.lock, archive_sha256: await sha256(archive), archive_bytes: (await readFile(archive)).length };
  await assert.rejects(install(archive, path.join(f.root, 'target'), lock), /links or special/);
});

test('HTTP smoke verifies bytes, MIME, revalidation and missing files', async t => {
  const f = await fixture(t);
  let mode = 'ok';
  const server = createServer(async (request, response) => {
    const relative = request.url.slice(1);
    if (mode === 'missing') { response.writeHead(404).end(); return; }
    const type = relative.endsWith('.wasm') ? 'application/wasm' : relative.endsWith('.js') ? 'application/javascript' : relative.endsWith('.html') ? 'text/html' : 'application/octet-stream';
    response.setHeader('content-type', mode === 'mime' ? 'text/plain' : type);
    response.setHeader('cache-control', 'no-cache, must-revalidate');
    response.end(mode === 'corrupt' ? 'broken' : await readFile(path.join(f.source, relative)));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  await checkHttp(origin, f.lock);
  mode = 'mime'; await assert.rejects(checkHttp(origin, f.lock), /MIME/);
  mode = 'corrupt'; await assert.rejects(checkHttp(origin, f.lock), /SHA-256/);
  mode = 'missing'; await assert.rejects(checkHttp(origin, f.lock), /HTTP 404/);
});
