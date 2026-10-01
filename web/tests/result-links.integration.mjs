import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';

export async function runResultLinksIntegration({ pool, env, token: adminToken, templateId }) {
  async function call(path, { method = 'GET', data, cookie, admin = false, origin } = {}) {
    const response = await fetch(env.TEST_API_URL + path, {
      method, headers: { ...(cookie ? { cookie } : {}), ...(admin ? { authorization: `Bearer ${adminToken}` } : {}),
        ...(data ? { 'content-type': 'application/json' } : {}), ...(origin ? { origin } : {}) },
      body: data ? JSON.stringify(data) : undefined,
    });
    return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  const created = await call('/api/admin/sessions', { method: 'POST', admin: true, data: {
    template_session_id: templateId, name: '4B 결과 링크 검증', duration_seconds: 300,
    impact_scale: 0.1, request_key: randomUUID(),
  } });
  assert.equal(created.status, 201);
  const sid = created.body.session_id;
  assert.equal((await call(`/api/admin/sessions/${sid}/start`, { method: 'POST', admin: true,
    data: { request_key: randomUUID() } })).status, 200);
  const [silent, scored, stranger] = await Promise.all(Array.from({ length: 3 }, () => call('/api/participants', { method: 'POST' })));
  for (const person of [silent, scored]) assert.equal((await call(`/api/sessions/${sid}/join`, { method: 'POST', cookie: person.cookie })).status, 201);
  assert.equal((await call(`/api/sessions/${sid}/result-link`, { method: 'POST' })).status, 401);
  assert.equal((await call(`/api/sessions/${sid}/result-link`, { method: 'POST', cookie: stranger.cookie })).status, 404);
  assert.equal((await call(`/api/sessions/${sid}/result-link`, { method: 'POST', cookie: silent.cookie, origin: 'https://other.invalid' })).status, 403);
  const first = await call(`/api/sessions/${sid}/result-link`, { method: 'POST', cookie: silent.cookie });
  assert.equal(first.status, 201);
  assert.match(first.body.token, /^[0-9a-f]{64}$/);
  const stored = await pool.query('SELECT token_hash FROM simus.result_links WHERE session_id=$1 AND participant_id=$2', [sid, silent.body.participant_id]);
  assert.equal(stored.rows[0].token_hash, createHash('sha256').update(first.body.token).digest('hex'));
  assert.equal((await call('/api/shared-result', { method: 'POST', data: { token: first.body.token } })).status, 409);
  const pushPath = `/api/sessions/${sid}/push-subscription`;
  const subscription = suffix => ({ endpoint: `https://fcm.googleapis.com/fcm/send/${suffix}`,
    keys: { p256dh: 'A'.repeat(87), auth: 'B'.repeat(22) } });
  assert.equal((await call(pushPath, { method: 'POST', cookie: stranger.cookie, data: subscription('stranger') })).status, 404);
  assert.equal((await call(pushPath, { method: 'POST', cookie: silent.cookie, data: {
    ...subscription('private'), endpoint: 'https://localhost.invalid/private',
  } })).status, 400);
  assert.equal((await call(pushPath, { method: 'POST', cookie: silent.cookie, data: subscription('silent') })).status, 201);
  assert.equal((await call(pushPath, { method: 'POST', cookie: scored.cookie, data: subscription('scored') })).status, 201);
  assert.equal((await call(pushPath, { cookie: silent.cookie })).body.active_count, 1);
  const current = (await call('/api/sessions/current')).body.session;
  assert.equal((await call('/api/choices', { method: 'POST', cookie: scored.cookie, data: {
    session_id: sid, situation_id: current.situations[0].id,
    choice_id: current.situations[0].choices[0].id, request_key: randomUUID(),
  } })).status, 201);
  assert.equal((await call(`/api/admin/sessions/${sid}/end`, { method: 'POST', admin: true,
    data: { request_key: randomUUID() } })).status, 200);
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM simus.push_jobs WHERE session_id=$1', [sid])).rows[0].count, 2);
  assert.equal((await call(pushPath, { method: 'DELETE', cookie: scored.cookie })).status, 200);
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM simus.push_jobs WHERE session_id=$1 AND status='CANCELLED'", [sid])).rows[0].count, 1);
  assert.equal((await call(pushPath, { method: 'POST', cookie: silent.cookie, data: subscription('late') })).status, 409);
  const noResponse = await call(`/api/sessions/${sid}/result`, { cookie: silent.cookie });
  assert.equal(noResponse.body.result_kind, 'NO_RESPONSE');
  assert.equal(noResponse.body.response_count, 0);
  assert.equal(noResponse.body.result, null);
  assert.ok(noResponse.body.city_state);
  assert.equal((await call(`/api/sessions/${sid}/result`, { cookie: stranger.cookie })).body.result_kind, 'NOT_JOINED');
  const shared = await call('/api/shared-result', { method: 'POST', data: { token: first.body.token } });
  assert.equal(shared.status, 200);
  assert.equal(shared.body.result_kind, 'NO_RESPONSE');
  const scoredLink = await call(`/api/sessions/${sid}/result-link`, { method: 'POST', cookie: scored.cookie });
  assert.equal((await call('/api/shared-result', { method: 'POST', data: { token: scoredLink.body.token } })).body.result_kind, 'SCORED');
  const rotated = await call(`/api/sessions/${sid}/result-link`, { method: 'POST', cookie: silent.cookie });
  assert.equal(rotated.status, 201);
  assert.equal((await call('/api/shared-result', { method: 'POST', data: { token: first.body.token } })).status, 404);
  assert.equal((await call('/api/shared-result', { method: 'POST', data: { token: rotated.body.token } })).status, 200);
  await pool.query('UPDATE simus.result_links SET created_at=clock_timestamp()-interval \'31 days\',expires_at=clock_timestamp()-interval \'1 day\' WHERE session_id=$1 AND participant_id=$2', [sid, silent.body.participant_id]);
  assert.equal((await call('/api/shared-result', { method: 'POST', data: { token: rotated.body.token } })).status, 404);
  assert.equal((await call('/api/shared-result', { method: 'POST', data: { token: '0'.repeat(64) } })).status, 404);
  console.log('PASS: 4B no-response result, secret link auth/rotation/expiry, push consent/jobs/revocation and scored isolation');
}
