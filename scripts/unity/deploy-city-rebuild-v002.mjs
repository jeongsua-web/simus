// Deliberately has no target override and refuses to replace an existing build.
import { cp, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = path.resolve(process.argv[2] || path.join(root, 'unity/Builds/city_rebuild_v002_test'));
const manifest = JSON.parse(await readFile(path.join(source, 'build.json'), 'utf8'));
const session = manifest.kind === 'city-rebuild-v002-session';
const base = session ? 'city-rebuild-v002' : 'city-rebuild-v002-test';
const target = path.join(root, 'web/public', base);
if ((!session && manifest.kind !== 'city-rebuild-v002-map-only') || manifest.protocol_version !== 1 ||
    manifest.map_version !== 'test-only-city-rebuild-v002-webgl-v1' ||
    manifest.npc_motion_enabled !== session || manifest.exhibition_ready !== false ||
    (session && !manifest.path_versions?.includes('city-rebuild-v002-walk-v1'))) throw Error('Not a supported v002 build.');
await stat(path.join(source, 'index.html'));
await stat(path.join(source, 'bridge.js'));
const files = await readdir(path.join(source, 'Build'));
for (const suffix of ['.loader.js', '.framework.js', '.wasm', '.data']) {
  if (!files.some(name => name.endsWith(suffix))) throw Error(`Missing ${suffix}`);
}
if (files.some(name => /\.(gz|br|unityweb)$/.test(name))) throw Error('Uncompressed build required.');
try { await stat(target); throw Error('Test deployment exists; use a reviewed cleanup before redeploying.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await cp(source, target, { recursive: true, force: false, errorOnExist: true });
console.log(`Deployed /${base}/ (${target}); /city untouched.`);
