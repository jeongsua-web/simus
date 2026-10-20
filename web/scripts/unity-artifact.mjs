// Node standard library only: usable before npm ci and inside the final image.
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const contracts = {
  'city-rebuild-v002': { protocol_version: 1, kind: 'city-rebuild-v002-session', map_version: 'test-only-city-rebuild-v002-webgl-v1', path_versions: ['city-rebuild-v002-walk-v1'], npc_motion_enabled: true, exhibition_ready: false },
  city: { protocol_version: 1, map_version: 'dev-synthetic-v1', exhibition_ready: false },
  'unity-preview': { protocol_version: 1, kind: 'npc-follow-preview', map_version: null, exhibition_ready: false },
};
const safePath = value => typeof value === 'string' && /^[A-Za-z0-9_./-]+$/.test(value) && value.split('/').every(part => part && part !== '.' && part !== '..' && !part.startsWith('.'));
const fail = message => { throw new Error(message); };
export async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
async function filesAt(root, prefix = '') {
  const result = [];
  if (!(await lstat(root)).isDirectory()) fail(`Not a regular directory: ${root}`);
  for (const name of (await readdir(root)).sort()) {
    const relative = prefix ? `${prefix}/${name}` : name;
    if (!safePath(relative)) fail(`Unsafe or hidden path: ${relative}`);
    const full = path.join(root, name), info = await lstat(full);
    if (info.isDirectory()) result.push(...await filesAt(full, relative));
    else if (info.isFile()) result.push(relative);
    else fail(`Symlink or special file: ${relative}`);
  }
  return result;
}
function validateLock(lock) {
  if (lock.schema_version !== 1 || lock.repository !== 'jeongsua-web/simus' ||
      !/^unity-webgl-[a-f0-9]{16}$/.test(lock.release_tag) ||
      lock.asset !== `${lock.release_tag}.tar.gz` || !/^[a-f0-9]{64}$/.test(lock.archive_sha256) ||
      !Number.isSafeInteger(lock.archive_bytes) || lock.archive_bytes <= 0) fail('Invalid Unity release lock');
  if (JSON.stringify(lock.builds) !== JSON.stringify(contracts)) fail('Unsupported Unity map/path contract');
  if (!Array.isArray(lock.files) || !lock.files.length) fail('Empty Unity file lock');
  const names = new Set();
  for (const file of lock.files) {
    if (!safePath(file.path) || !Object.hasOwn(contracts, file.path.split('/')[0]) || names.has(file.path) ||
        !/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.bytes) || file.bytes <= 0) fail(`Invalid locked file: ${file.path}`);
    names.add(file.path);
  }
  return lock;
}
export async function readLock(file = path.join(web, 'unity-build.lock.json')) {
  return validateLock(JSON.parse(await readFile(file, 'utf8')));
}
async function verifyContracts(root, builds = contracts) {
  for (const [base, expected] of Object.entries(builds)) {
    const dir = path.join(root, base);
    const build = JSON.parse(await readFile(path.join(dir, 'build.json'), 'utf8'));
    for (const [key, value] of Object.entries(expected)) {
      if (JSON.stringify(build[key]) !== JSON.stringify(value)) fail(`${base}: ${key} mismatch`);
    }
    const names = await filesAt(dir);
    if (names.some(name => /\.(gz|br|unityweb)$/.test(name))) fail(`${base}: uncompressed WebGL required`);
    const html = await readFile(path.join(dir, 'index.html'), 'utf8');
    if (!html.includes('createUnityInstance')) fail(`${base}: missing Unity loader`);
    for (const suffix of ['.loader.js', '.framework.js', '.data', '.wasm']) {
      const matches = names.filter(name => name.startsWith('Build/') && name.endsWith(suffix));
      if (matches.length !== 1 || !html.includes(matches[0])) fail(`${base}: missing/ambiguous HTML reference ${suffix}`);
    }
    if (base !== 'unity-preview' && (!names.includes('bridge.js') || !html.includes('bridge.js'))) fail(`${base}: missing bridge`);
  }
}
export async function verify(root, lock) {
  validateLock(lock);
  const actual = [];
  for (const base of Object.keys(lock.builds)) actual.push(...(await filesAt(path.join(root, base))).map(file => `${base}/${file}`));
  if (JSON.stringify(actual.sort()) !== JSON.stringify(lock.files.map(f => f.path).sort())) fail('Unity file set mismatch (missing or unexpected files)');
  for (const file of lock.files) {
    const full = path.join(root, file.path);
    if ((await lstat(full)).size !== file.bytes || await sha256(full) !== file.sha256) fail(`Unity SHA-256/size mismatch: ${file.path}`);
  }
  await verifyContracts(root, lock.builds);
}
export async function pack(root, output) {
  await verifyContracts(root);
  await mkdir(output, { recursive: true });
  const files = [];
  for (const base of Object.keys(contracts)) {
    for (const file of await filesAt(path.join(root, base))) {
      const relative = `${base}/${file}`, full = path.join(root, relative);
      files.push({ path: relative, bytes: (await lstat(full)).size, sha256: await sha256(full) });
    }
  }
  files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  const temporary = await mkdtemp(path.join(output, '.pack-'));
  try {
    const archive = path.join(temporary, 'bundle.tar.gz');
    // Only regular files, explicitly enumerated. No folders, links or macOS metadata.
    await exec('tar', ['--format=ustar', '-czf', archive, '-C', root, ...files.map(f => f.path)], { env: { ...process.env, COPYFILE_DISABLE: '1' } });
    const hash = await sha256(archive), tag = `unity-webgl-${hash.slice(0, 16)}`;
    const lock = { schema_version: 1, repository: 'jeongsua-web/simus', release_tag: tag, asset: `${tag}.tar.gz`, archive_sha256: hash, archive_bytes: (await lstat(archive)).size, builds: contracts, files };
    await verify(root, lock);
    await cp(archive, path.join(output, lock.asset), { force: false, errorOnExist: true });
    await writeFile(path.join(output, 'unity-build.lock.json'), JSON.stringify(lock, null, 2) + '\n', { flag: 'wx' });
    return lock;
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
export async function install(archive, target, lock) {
  validateLock(lock);
  if ((await lstat(archive)).size !== lock.archive_bytes || await sha256(archive) !== lock.archive_sha256) fail('Unity archive SHA-256/size mismatch');
  // Check ALL members before tar can write anything. Refuse links, traversal,
  // directories, duplicates and any file outside the exact reviewed file set.
  const listed = (await exec('tar', ['-tzf', archive])).stdout.trimEnd().split('\n');
  if (listed.some(name => !safePath(name)) || new Set(listed).size !== listed.length ||
      JSON.stringify([...listed].sort()) !== JSON.stringify(lock.files.map(f => f.path).sort())) fail('Unsafe or unexpected archive members');
  const verbose = (await exec('tar', ['-tvzf', archive])).stdout.trimEnd().split('\n');
  if (verbose.length !== listed.length || verbose.some(line => !line.startsWith('-'))) fail('Archive contains links or special members');
  await mkdir(target, { recursive: true });
  for (const base of Object.keys(lock.builds)) {
    try { await lstat(path.join(target, base)); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    fail(`Refusing to replace existing Unity build: ${base}`);
  }
  const staging = await mkdtemp(path.join(target, '.unity-artifact-'));
  try {
    await exec('tar', ['-xzf', archive, '-C', staging]);
    await verify(staging, lock);
    for (const base of Object.keys(lock.builds)) await rename(path.join(staging, base), path.join(target, base));
  } finally { await rm(staging, { recursive: true, force: true }); }
}
export async function fetchArtifact(target, lock) {
  const temporary = await mkdtemp(path.join(tmpdir(), 'simus-unity-download-'));
  try {
    await exec('gh', ['release', 'download', lock.release_tag, '--repo', lock.repository, '--pattern', lock.asset, '--dir', temporary]);
    await install(path.join(temporary, lock.asset), target, lock);
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
export async function checkHttp(origin, lock) {
  validateLock(lock);
  const base = new URL(origin);
  if (!['http:', 'https:'].includes(base.protocol) || base.pathname !== '/' || base.search || base.hash) fail('Expected HTTP(S) origin');
  for (const file of lock.files) {
    const response = await fetch(new URL(`/${file.path}`, base), { headers: { 'accept-encoding': 'identity' }, redirect: 'error', signal: AbortSignal.timeout(120_000) });
    if (response.status !== 200 || !response.body) fail(`HTTP ${response.status}: ${file.path}`);
    const type = response.headers.get('content-type') || '';
    if (file.path.endsWith('.wasm') && !type.startsWith('application/wasm')) fail(`Wrong WASM MIME: ${file.path}`);
    if (file.path.endsWith('.js') && !/(?:java|ecma)script/.test(type)) fail(`Wrong JavaScript MIME: ${file.path}`);
    if (file.path.endsWith('.html') && !type.startsWith('text/html')) fail(`Wrong HTML MIME: ${file.path}`);
    if (!response.headers.get('cache-control')?.includes('must-revalidate')) fail(`Missing revalidation: ${file.path}`);
    if (response.headers.get('content-encoding')) fail(`Unexpected HTTP compression: ${file.path}`);
    const hash = createHash('sha256'); let size = 0;
    for await (const chunk of response.body) { hash.update(chunk); size += chunk.length; }
    if (size !== file.bytes || hash.digest('hex') !== file.sha256) fail(`HTTP SHA-256/size mismatch: ${file.path}`);
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [command, arg, other] = process.argv.slice(2);
    if (command === 'pack' && arg && other) {
      const lock = await pack(path.resolve(arg), path.resolve(other));
      console.log(`Prepared ${lock.asset}; ${lock.files.length} files. Release upload is a separate step.`);
    } else {
      const lock = await readLock();
      if (command === 'fetch') await fetchArtifact(path.resolve(arg || path.join(web, 'public')), lock);
      else if (command === 'install' && arg && other) await install(path.resolve(arg), path.resolve(other), lock);
      else if (command === 'verify') await verify(path.resolve(arg || path.join(web, 'public')), lock);
      else if (command === 'check-http' && arg) await checkHttp(arg, lock);
      else fail('Usage: unity-artifact.mjs pack <public> <output> | fetch [public] | install <archive> <public> | verify [public] | check-http <origin>');
      console.log(`Unity ${command} OK: ${lock.release_tag} (${lock.files.length} files)`);
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
