// Creates a NEW cluster. Never reads DATABASE_URL or connects to a development DB.
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import pg from 'pg';
import { runFlow } from './isolated-flow.mjs';
import assert from 'node:assert/strict';
import net from 'node:net';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = process.env.TEST_PG_BIN ?? 'C:/Program Files/PostgreSQL/18/bin';
const pgPort = 55439, port = 3117;
// Refuse occupied ports before creating a cluster or sending any HTTP request.
for (const testPort of [pgPort, port]) {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(testPort, '127.0.0.1', () => probe.close(resolve));
  });
}
const root = await mkdtemp(path.join(tmpdir(), 'simus-integration-'));
const data = path.join(root, 'data');
function command(executable, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd: web, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', x => output += x); child.stderr.on('data', x => output += x);
    child.on('error', reject);
    // pg_ctl's background postgres can inherit pipe handles on Windows.
    // Wait for the command itself, not for every inherited pipe to close.
    child.on('exit', code => {
      child.stdout.destroy(); child.stderr.destroy();
      if (code === 0) resolve(output);
      else reject(new Error(`${path.basename(executable)} exited ${code}: ${output}`));
    });
  });
}
const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true });
const privateJwk = { ...await exportJWK(privateKey), kid: 'isolated-test' };
const publicJwk = { ...await exportJWK(publicKey), kid: 'isolated-test' };
const env = { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1',
  DATABASE_URL: `postgresql://postgres@127.0.0.1:${pgPort}/simus_integration`,
  TEST_API_URL: `http://127.0.0.1:${port}`, ADMIN_TOKEN_ISSUER: 'simus-isolated-test',
  ADMIN_TOKEN_AUDIENCE: 'simus-isolated-test', ADMIN_JWKS_JSON: JSON.stringify({ keys: [publicJwk] }),
  TEST_ADMIN_PRIVATE_JWK: JSON.stringify(privateJwk), SESSION_JOB_TOKEN: 'isolated-test-job-token-never-production-2026' };
delete env.ADMIN_JWKS_URL;
env.TEST_DATABASE_URL = env.DATABASE_URL;
let server, running = false, pool;
async function stopServer() {
  if (server && server.exitCode === null) { const ended = once(server, 'exit'); server.kill(); await ended; }
}
async function startServer() {
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], { cwd: web, env, windowsHide: true });
  let log = ''; server.stdout.on('data', x => log += x); server.stderr.on('data', x => log += x);
  server.on('error', e => { log += e.message; });
  for (let n = 0; n < 80; n++) {
    if (server.exitCode !== null) throw new Error(log);
    try { const r = await fetch(env.TEST_API_URL + '/api/health'); const body = await r.json();
      if (r.ok) { if (body.database !== 'simus_integration') throw new Error('Wrong database'); return; }
    } catch { /* wait for owned process */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Test server unavailable: ' + log);
}
try {
  console.log('Isolated cluster directory:', root);
  await command(path.join(bin, 'initdb.exe'), ['-D', data, '-U', 'postgres', '-A', 'trust', '--encoding=UTF8', '--locale=C']);
  await command(path.join(bin, 'pg_ctl.exe'), ['-D', data, '-l', path.join(root, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${pgPort}`, '-w', 'start']);
  running = true;
  const admin = new pg.Client({ connectionString: `postgresql://postgres@127.0.0.1:${pgPort}/postgres` });
  await admin.connect(); await admin.query('CREATE DATABASE simus_integration'); await admin.end();
  pool = new pg.Pool({ connectionString: env.DATABASE_URL });
  for (const name of ['001_initial_schema.sql','002_session_lifecycle.sql']) await pool.query(await readFile(path.join(web, '../db', name), 'utf8'));
  await startServer();
  console.log(await command(process.execPath, ['tests/session-lifecycle.integration.mjs'], env));
  await runFlow({ pool, env, stopServer, startServer });
  // Exercise the documented DRAFT demo seed through the real lifecycle API.
  await pool.query(await readFile(path.join(web, '../db/seed_demo.sql'), 'utf8'));
  const demoToken = await new SignJWT({}).setProtectedHeader({ alg: 'RS256', kid: publicJwk.kid })
    .setIssuer(env.ADMIN_TOKEN_ISSUER).setAudience(env.ADMIN_TOKEN_AUDIENCE)
    .setSubject('dev-admin').setIssuedAt().setExpirationTime('5m').sign(privateKey);
  const demoHeaders = { authorization: `Bearer ${demoToken}`, 'content-type': 'application/json' };
  const demoId = '10000000-0000-0000-0000-000000000001';
  const demoList = await (await fetch(env.TEST_API_URL + '/api/admin/sessions', { headers: demoHeaders })).json();
  assert.equal(demoList.sessions.find(s => s.id === demoId).can_start, true);
  for (const action of ['start', 'end']) {
    const result = await fetch(`${env.TEST_API_URL}/api/admin/sessions/${demoId}/${action}`, {
      method: 'POST', headers: demoHeaders,
      body: JSON.stringify({ request_key: crypto.randomUUID() }),
    });
    assert.equal(result.status, 200, await result.text());
  }
  const originProbe = await fetch(env.TEST_API_URL + '/api/city-state', { headers: { Origin: 'https://different-origin.invalid' } });
  assert.equal(originProbe.status, 200);
  assert.equal(originProbe.headers.get('access-control-allow-origin'), null);
  assert.equal(originProbe.headers.get('cache-control'), 'no-store');
  console.log('PASS: demo DRAFT seed readiness/start/end; city API has no cross-origin CORS grant');
  await pool.end(); pool = null;
  const beforeOutage = await (await fetch(env.TEST_API_URL + '/api/city-state')).json();
  await command(path.join(bin, 'pg_ctl.exe'), ['-D', data, '-m', 'fast', '-w', 'stop']);
  running = false;
  const unavailable = await fetch(env.TEST_API_URL + '/api/health');
  assert.equal(unavailable.status, 503);
  await command(path.join(bin, 'pg_ctl.exe'), ['-D', data, '-l', path.join(root, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${pgPort}`, '-w', 'start']);
  running = true;
  assert.equal((await fetch(env.TEST_API_URL + '/api/health')).status, 200);
  const afterOutage = await (await fetch(env.TEST_API_URL + '/api/city-state')).json();
  assert.deepEqual(afterOutage, beforeOutage);
  console.log('PASS: real PostgreSQL stop/start; existing Next.js process serves 503 during outage and recovers with the same persisted city');
  console.log('PASS isolated suite. No development connection or data mutation.');
} finally {
  await stopServer(); if (pool) await pool.end();
  if (running) await command(path.join(bin, 'pg_ctl.exe'), ['-D', data, '-m', 'fast', '-w', 'stop']);
  console.log('Owned services stopped; isolated test files retained at:', root);
}
