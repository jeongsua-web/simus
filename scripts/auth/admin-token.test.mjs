import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { createLocalJWKSet, jwtVerify } from '../../web/node_modules/jose/dist/webapi/index.js';

const script = resolve('scripts/auth/admin-token.mjs');
const fixture = `SIMUS_DB_PASSWORD=existing-database-secret\nADMIN_TOKEN_ISSUER=https://REPLACE_WITH_AUTH_ISSUER\nADMIN_TOKEN_AUDIENCE=simus-admin\nADMIN_JWKS_URL=https://REPLACE_WITH_AUTH_ISSUER/jwks\nADMIN_JWKS_JSON=\n`;
const run = (cwd, command) => spawnSync(process.execPath, [script, command], { cwd, encoding: 'utf8' });

test('stable keys, restricted token, jose verification and rejection paths', async () => {
  const cwd = mkdtempSync(resolve(tmpdir(), 'simus-admin-auth-'));
  writeFileSync(resolve(cwd, '.env.production'), fixture);
  const initialized = run(cwd, 'init');
  assert.equal(initialized.status, 0, initialized.stderr);
  const settings = readFileSync(resolve(cwd, '.env.production'), 'utf8');
  assert.match(settings, /^SIMUS_DB_PASSWORD=existing-database-secret$/m);
  assert.match(settings, /^ADMIN_JWKS_URL=$/m);
  const identity = JSON.parse(readFileSync(resolve(cwd, '.secrets/admin-auth/identity.json')));
  const jwks = JSON.parse(settings.match(/^ADMIN_JWKS_JSON='(.*)'$/m)[1]);
  assert.equal(jwks.keys[0].d, undefined);
  assert.equal(jwks.keys[0].alg, 'RS256');
  assert.equal(run(cwd, 'init').status, 0);
  assert.equal(readFileSync(resolve(cwd, '.env.production'), 'utf8'), settings);
  const issued = run(cwd, 'issue');
  assert.equal(issued.status, 0, issued.stderr);
  const tokenPath = resolve(cwd, '.secrets/admin-auth/admin-token.txt');
  const token = readFileSync(tokenPath, 'utf8').trim();
  assert.ok(!issued.stdout.includes(token));
  const keys = createLocalJWKSet(jwks);
  const options = { issuer: identity.issuer, audience: identity.audience, algorithms: ['RS256'], requiredClaims: ['sub', 'iat', 'exp'] };
  const { payload } = await jwtVerify(token, keys, options);
  assert.equal(payload.sub, identity.subject);
  assert.equal(payload.exp - payload.iat, 24 * 60 * 60);
  await assert.rejects(jwtVerify(token, keys, { ...options, issuer: 'wrong-issuer' }));
  await assert.rejects(jwtVerify(token, keys, { ...options, audience: 'wrong-audience' }));
  await assert.rejects(jwtVerify(token, keys, { ...options, currentDate: new Date((payload.exp + 1) * 1000) }));
  const parts = token.split('.');
  parts[1] = Buffer.from(JSON.stringify({ ...payload, sub: 'attacker' })).toString('base64url');
  await assert.rejects(jwtVerify(parts.join('.'), keys, options));
  const sql = readFileSync(resolve(cwd, '.secrets/admin-auth/register-admin.sql'), 'utf8');
  assert.ok(sql.includes(identity.subject));
  assert.match(sql, /DO NOTHING/);
  if (process.platform !== 'win32') {
    assert.equal(statSync(tokenPath).mode & 0o777, 0o600);
    assert.equal(statSync(resolve(cwd, '.secrets/admin-auth/private.pem')).mode & 0o777, 0o600);
  }
});

test('refuses existing authentication settings before generating a key', () => {
  const cwd = mkdtempSync(resolve(tmpdir(), 'simus-admin-refuse-'));
  const configured = fixture.replace('https://REPLACE_WITH_AUTH_ISSUER\n', 'https://existing.example\n');
  writeFileSync(resolve(cwd, '.env.production'), configured);
  assert.notEqual(run(cwd, 'init').status, 0);
  assert.equal(readFileSync(resolve(cwd, '.env.production'), 'utf8'), configured);
});
