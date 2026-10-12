import { cp, mkdir, mkdtemp, readFile, readdir, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(process.argv[2] || path.join(web, '../unity/Builds/npc_follow_preview'));
const target = path.join(web, 'public/unity-preview');
const manifest = JSON.parse(await readFile(path.join(source, 'build.json'), 'utf8'));
if (manifest.kind !== 'npc-follow-preview' || manifest.protocol_version !== 1 || manifest.map_version !== null || manifest.exhibition_ready !== false) {
  throw new Error('Only the standalone NPC follow preview may deploy to /unity-preview.');
}
for (const name of ['index.html', 'Build']) await stat(path.join(source, name));
const files = await readdir(path.join(source, 'Build'));
for (const ending of ['.loader.js', '.framework.js', '.wasm', '.data']) {
  if (!files.some(name => name.endsWith(ending))) throw new Error(`Missing uncompressed WebGL asset: ${ending}`);
}
// Keep compressed builds out until their server content-encoding is configured.
if (files.some(name => /\.(gz|br|unityweb)$/.test(name))) throw new Error('Deploy an uncompressed WebGL build.');
const index = await readFile(path.join(source, 'index.html'), 'utf8');
if (!index.includes('createUnityInstance')) throw new Error('Unity HTML loader missing.');
await mkdir(path.dirname(target), { recursive: true });
const stagingRoot = await mkdtemp(path.join(path.dirname(target), '.unity-preview-'));
const staging = path.join(stagingRoot, 'build');
await cp(source, staging, { recursive: true, force: false, errorOnExist: true });
let backup;
try {
  await stat(target);
  backup = path.join(web, '.unity-deploy-backups', `${Date.now()}-${path.basename(staging)}`);
  await mkdir(path.dirname(backup), { recursive: true });
  await rename(target, backup);
} catch (error) { if (error.code !== 'ENOENT') throw error; }
try { await rename(staging, target); }
catch (error) { if (backup) await rename(backup, target); throw error; }
console.log(`Standalone Unity preview deployed: ${target}`);
if (backup) console.log(`Previous build retained: ${backup}`);
