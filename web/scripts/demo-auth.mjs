// Local demonstration only. Private signing key stays in memory.
import { mkdir, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';

const directory = new URL('../.demo/', import.meta.url);
await mkdir(directory, { recursive: true });
const { privateKey, publicKey } = await generateKeyPair('RS256');
const jwk = { ...await exportJWK(publicKey), kid: 'local-demo' };
const token = await new SignJWT({}).setProtectedHeader({ alg: 'RS256', kid: jwk.kid })
  .setIssuer('simus-local-demo').setAudience('simus-local-demo')
  .setSubject('dev-admin').setIssuedAt().setExpirationTime('8h').sign(privateKey);
const env = [
  'DATABASE_URL=postgresql://simus:simus_dev_password@localhost:5432/simus_demo',
  'ADMIN_TOKEN_ISSUER=simus-local-demo',
  'ADMIN_TOKEN_AUDIENCE=simus-local-demo',
  `ADMIN_JWKS_JSON=${JSON.stringify({ keys: [jwk] })}`,
  `SESSION_JOB_TOKEN=${randomBytes(32).toString('hex')}`,
  '',
].join('\n');
await writeFile(new URL('env.local', directory), env, { mode: 0o600 });
await writeFile(new URL('admin-token.txt', directory), token, { mode: 0o600 });
console.log('Local-only settings: .demo/env.local; 8-hour token: .demo/admin-token.txt. No private key saved.');
