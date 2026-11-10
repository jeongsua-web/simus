#!/usr/bin/env node
// SSH-only operator tool. The web container receives the public JWKS, never this key.
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const directory = resolve(root, '.secrets/admin-auth');
const identityPath = resolve(directory, 'identity.json');
const keyPath = resolve(directory, 'private.pem');
const envPath = resolve(root, '.env.production');
const tokenPath = resolve(directory, 'admin-token.txt');
const tokenLifetimeSeconds = 24 * 60 * 60;

function readIdentity() {
  const identity = JSON.parse(readFileSync(identityPath, 'utf8'));
  if (!/^urn:simus:admin:[0-9a-f-]{36}$/.test(identity.issuer) ||
      identity.audience !== 'simus-admin' ||
      !/^simus-admin:[0-9a-f-]{36}$/.test(identity.subject)) {
    throw new Error('Invalid identity metadata; preserve the files and investigate.');
  }
  return identity;
}

function publicJwk() {
  const key = createPrivateKey(readFileSync(keyPath));
  if (key.asymmetricKeyType !== 'rsa' || key.asymmetricKeyDetails.modulusLength < 3072) {
    throw new Error('An RSA key of at least 3072 bits is required.');
  }
  const pub = createPublicKey(key);
  const kid = createHash('sha256').update(pub.export({ type: 'spki', format: 'der' })).digest('hex');
  return { ...pub.export({ format: 'jwk' }), kid, use: 'sig', alg: 'RS256' };
}

function configure() {
  const env = readFileSync(envPath, 'utf8');
  if (lstatSync(envPath).isSymbolicLink()) throw new Error('The environment file must not be a symlink.');
  const names = ['ADMIN_TOKEN_ISSUER', 'ADMIN_TOKEN_AUDIENCE', 'ADMIN_JWKS_URL', 'ADMIN_JWKS_JSON'];
  const values = {};
  for (const name of names) {
    const matches = env.split(/\r?\n/).filter(line => line.startsWith(`${name}=`));
    if (matches.length !== 1) throw new Error(`Expected exactly one ${name} in .env.production.`);
    values[name] = matches[0].slice(name.length + 1);
  }
  const previous = existsSync(identityPath) ? readIdentity() : undefined;
  if (previous && (!existsSync(keyPath) || lstatSync(keyPath).isSymbolicLink())) {
    throw new Error('Existing identity has no regular private key; preserve the directory.');
  }
  // Do not replace another issuer or an existing operator's configured trust keys.
  const expected = previous ? {
    ADMIN_TOKEN_ISSUER: previous.issuer,
    ADMIN_TOKEN_AUDIENCE: previous.audience,
    ADMIN_JWKS_URL: '',
    ADMIN_JWKS_JSON: `'${JSON.stringify({ keys: [publicJwk()] })}'`,
  } : undefined;
  for (const name of names) {
    const value = values[name];
    if (value && !value.includes('REPLACE_') &&
        !(name === 'ADMIN_TOKEN_AUDIENCE' && value === 'simus-admin') &&
        value !== expected?.[name]) {
      throw new Error(`${name} is already configured; no authentication settings were changed.`);
    }
  }
  if (!previous) {
    if (existsSync(directory)) throw new Error('Secret directory already exists; preserve it and investigate.');
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const pair = generateKeyPairSync('rsa', { modulusLength: 3072 });
    writeFileSync(keyPath, pair.privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600, flag: 'wx' });
    const identity = {
      issuer: `urn:simus:admin:${randomUUID()}`,
      audience: 'simus-admin',
      subject: `simus-admin:${randomUUID()}`,
    };
    writeFileSync(identityPath, JSON.stringify(identity, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  }
  chmodSync(resolve(root, '.secrets'), 0o700);
  chmodSync(directory, 0o700);
  chmodSync(keyPath, 0o600);
  const identity = readIdentity();
  const replacements = {
    ADMIN_TOKEN_ISSUER: identity.issuer,
    ADMIN_TOKEN_AUDIENCE: identity.audience,
    ADMIN_JWKS_URL: '',
    ADMIN_JWKS_JSON: `'${JSON.stringify({ keys: [publicJwk()] })}'`,
  };
  const updated = env.split(/\r?\n/).map(line => {
    const name = line.split('=', 1)[0];
    return Object.hasOwn(replacements, name) ? `${name}=${replacements[name]}` : line;
  }).join('\n');
  chmodSync(envPath, 0o600);
  writeFileSync(envPath, updated, { mode: 0o600 });
  // The random subject is constrained above; ON CONFLICT does not reactivate disabled users.
  writeFileSync(resolve(directory, 'register-admin.sql'),
    `INSERT INTO simus.admin_users (auth_subject, display_name)\nVALUES ('${identity.subject}', 'SIMUS administrator')\nON CONFLICT (auth_subject) DO NOTHING;\n`, { mode: 0o600 });
  console.log('Admin public-key configuration ready. Existing DB credentials were preserved.');
  console.log('Register the administrator with .secrets/admin-auth/register-admin.sql after DB initialization.');
}

function issue() {
  const identity = readIdentity();
  const jwk = publicJwk();
  const now = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT', kid: jwk.kid })}.${encode({
    iss: identity.issuer, aud: identity.audience, sub: identity.subject,
    iat: now, exp: now + tokenLifetimeSeconds, jti: randomUUID(),
  })}`;
  const signature = sign('RSA-SHA256', Buffer.from(unsigned), {
    key: readFileSync(keyPath),
  }).toString('base64url');
  if (existsSync(tokenPath)) {
    if (lstatSync(tokenPath).isSymbolicLink()) throw new Error('Token output must not be a symlink.');
    chmodSync(tokenPath, 0o600);
  }
  writeFileSync(tokenPath, `${unsigned}.${signature}\n`, { mode: 0o600 });
  console.log(`Admin token saved to .secrets/admin-auth/admin-token.txt; expires ${new Date((now + tokenLifetimeSeconds) * 1000).toISOString()}.`);
  console.log('The token grants administrator access. Do not paste it into chat or logs.');
}

try {
  const command = process.argv[2];
  if (command === 'init') configure();
  else if (command === 'issue') issue();
  else throw new Error('Usage: node scripts/auth/admin-token.mjs init|issue (run in the deployment directory)');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
