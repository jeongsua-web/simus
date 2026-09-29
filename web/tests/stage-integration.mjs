import { runStageBrowser } from './stage-browser.mjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function runStageIntegration({ pool, env, token, demoId }) {
  async function call(path, { data, cookie, auth = true } = {}) {
    const response = await fetch(env.TEST_API_URL + path, {
      method: data ? 'POST' : 'GET', headers: {
        ...(auth ? { authorization: `Bearer ${token}` } : {}), ...(cookie ? { cookie } : {}),
        ...(data ? { 'content-type': 'application/json' } : {}),
      }, body: data ? JSON.stringify(data) : undefined,
    });
    return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  const original = (await pool.query('SELECT * FROM simus.session_results WHERE session_id=$1', [demoId])).rows;
  const input = { template_session_id: demoId, name: 'Integrated neighborhood', duration_seconds: 300, impact_scale: 0.1, request_key: randomUUID() };
  assert.equal((await call('/api/admin/sessions', { data: input, auth: false })).status, 401);
  assert.equal((await call('/api/admin/sessions', { data: { ...input, duration_seconds: 5 } })).status, 400);
  assert.equal((await call('/api/admin/sessions', { data: { ...input, impact_scale: 0.12345678901 } })).status, 400);
  const copies = await Promise.all([call('/api/admin/sessions', { data: input }), call('/api/admin/sessions', { data: input })]);
  assert.deepEqual(copies.map(x => x.status).sort(), [200, 201]);
  const sid = copies[0].body.session_id;
  assert.equal(copies[1].body.session_id, sid);
  assert.equal((await call('/api/admin/sessions', { data: { ...input, name: 'different' } })).status, 409);
  assert.equal((await pool.query('SELECT count(*) FROM simus.city_states WHERE session_id=$1', [sid])).rows[0].count, '0');
  // Expired draft remains startable: duration is anchored to actual start.
  await pool.query("UPDATE simus.simulation_sessions SET scheduled_end_at=clock_timestamp()-interval '1 day' WHERE id=$1", [sid]);
  const list = await call('/api/admin/sessions');
  assert.equal(list.body.sessions.find(s => s.id === sid).can_start, true);
  assert.equal((await call(`/api/admin/sessions/${sid}/start`, { data: { request_key: randomUUID() } })).status, 200);
  const duration = (await pool.query('SELECT extract(epoch FROM scheduled_end_at-starts_at)::float8 AS seconds FROM simus.simulation_sessions WHERE id=$1', [sid])).rows[0].seconds;
  assert.ok(duration > 299 && duration <= 300);
  const session = (await call('/api/sessions/current')).body.session;
  assert.equal(session.id, sid);
  const response = await fetch(env.TEST_API_URL + '/api/participants', { method: 'POST' });
  const cookie = response.headers.get('set-cookie').split(';')[0];
  const situation = session.situations[0];
  const choice = { session_id: sid, situation_id: situation.id, choice_id: situation.choices[0].id, request_key: randomUUID() };
  assert.equal((await call('/api/choices', { data: choice, cookie })).status, 201);
  const city = (await call('/api/city-state')).body.city_state;
  assert.equal(city.session_id, sid);
  assert.deepEqual([city.version, city.happiness, city.cleanliness], ['1', 50.1, 50.4]);
  if (process.env.TEST_UNITY_EDITOR) {
    const folder = await mkdtemp(path.join(tmpdir(), 'simus-unity-http-'));
    const snapshot = path.join(folder, 'expected.json');
    await writeFile(snapshot, JSON.stringify({ city_state: city }));
    await promisify(execFile)(process.env.TEST_UNITY_EDITOR, ['-batchmode', '-nographics',
      '-projectPath', path.resolve('../unity'), '-executeMethod', 'NeighborhoodVerification.Run',
      '-simusVerifyHttp', '-logFile', path.join(folder, 'unity.log')], {
      env: { ...process.env, SIMUS_TEST_URL: env.TEST_API_URL, SIMUS_TEST_SNAPSHOT: snapshot }, timeout: 180000,
    });
    console.log('PASS: integrated Unity live HTTP/Play verification; log:', path.join(folder, 'unity.log'));
  } else console.log('SKIP: Unity Play (set TEST_UNITY_EDITOR)');
  assert.equal((await call(`/api/admin/sessions/${sid}/end`, { data: { request_key: randomUUID() } })).status, 200);
  const history = (await call('/api/participants', { cookie })).body.history;
  assert.ok(history.some(s => s.id === sid));
  const result = (await call(`/api/sessions/${sid}/result`, { cookie })).body;
  assert.equal(result.result.response_count, '1');
  assert.deepEqual([result.city_state.version, result.city_state.happiness], ['1', 50.1]);
  assert.deepEqual((await pool.query('SELECT * FROM simus.session_results WHERE session_id=$1', [demoId])).rows, original);
  const second = await call('/api/admin/sessions', { data: { ...input, template_session_id: sid, request_key: randomUUID() } });
  assert.equal(second.status, 201);
  assert.equal((await call(`/api/admin/sessions/${second.body.session_id}/start`, { data: { request_key: randomUUID() } })).status, 200);
  assert.equal((await call('/api/city-state')).body.city_state.version, '0');
  assert.equal((await call('/api/choices', { data: choice, cookie })).status, 200);
  assert.equal((await call('/api/city-state')).body.city_state.version, '0');
  assert.equal((await call(`/api/sessions/${sid}/result`, { cookie })).body.city_state.version, '1');
  assert.equal((await call(`/api/admin/sessions/${second.body.session_id}/end`, { data: { request_key: randomUUID() } })).status, 200);
  await runStageBrowser({ env, pool, token, templateId: demoId });
  console.log('PASS: integrated create/replay/conflict/auth, expired draft duration, content-only clone, scaled choices, own history/final city, next round isolation');
}
