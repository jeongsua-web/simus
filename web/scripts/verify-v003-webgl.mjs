import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const web = fileURLToPath(new URL('../', import.meta.url));
const base = 'unity/city-masterplan-v003-local-v1';
const lock = JSON.parse(await readFile(path.join(web, 'v003-webgl.lock.json'), 'utf8'));
const origin = process.argv[2] ? new URL(process.argv[2]) : null;
if (origin) assert.ok(['http:', 'https:'].includes(origin.protocol) && origin.href === `${origin.origin}/`, 'Expected an HTTP(S) origin');

for (const [name, file] of Object.entries(lock)) {
  const relative = `${base}/${name}`;
  let stream;
  if (origin) {
    const response = await fetch(new URL(`/${relative}`, origin), {
      headers: { 'accept-encoding': 'identity' }, redirect: 'error', signal: AbortSignal.timeout(120_000),
    });
    assert.equal(response.status, 200, relative);
    assert.match(response.headers.get('cache-control') ?? '', /must-revalidate/, relative);
    assert.equal(response.headers.get('content-encoding'), null, relative);
    if (name.endsWith('.wasm')) assert.match(response.headers.get('content-type') ?? '', /^application\/wasm\b/, relative);
    stream = response.body;
  } else {
    stream = createReadStream(path.join(web, 'public', relative));
  }
  const hash = createHash('sha256');
  let bytes = 0;
  for await (const chunk of stream) {
    bytes += chunk.length;
    hash.update(chunk);
  }
  assert.equal(bytes, file.bytes, `${relative} size (hydrate Git LFS if this is a pointer)`);
  assert.equal(hash.digest('hex'), file.sha256, `${relative} SHA-256`);
}
console.log(`v003 WebGL verified ${origin ? 'over HTTP' : 'on disk'} (${Object.keys(lock).length} files)`);
