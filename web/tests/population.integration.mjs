import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export async function runPopulationIntegration({ pool, env, token, templateId }) {
  async function call(path, { method = 'GET', cookie, data, origin, admin = false } = {}) {
    const response = await fetch(env.TEST_API_URL + path, {
      method, headers: { ...(cookie ? { cookie } : {}), ...(origin ? { origin } : {}),
        ...(admin ? { authorization: `Bearer ${token}` } : {}), ...(data ? { 'content-type': 'application/json' } : {}) },
      body: data ? JSON.stringify(data) : undefined,
    });
    return { status: response.status, body: await response.json(), headers: response.headers,
      cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  const created = await call('/api/admin/sessions', { method: 'POST', admin: true, data: {
    template_session_id: templateId, name: '현재 인구 검증', duration_seconds: 300,
    impact_scale: 0.1, request_key: randomUUID(),
  } });
  assert.equal(created.status, 201);
  const sid = created.body.session_id;
  const path = `/api/sessions/${sid}/population`;
  const action = name => call(`/api/admin/sessions/${sid}/${name}`, {
    method: 'POST', admin: true, data: { request_key: randomUUID() },
  });
  assert.equal((await call(path)).body.online_count, 0);
  assert.equal((await action('start')).status, 200);
  const [a, b, unregistered] = await Promise.all(Array.from({ length: 3 }, () => call('/api/participants', { method: 'POST' })));
  const heartbeat = person => call(path, { method: 'POST', cookie: person.cookie });
  assert.equal((await heartbeat({})).status, 401);
  assert.equal((await heartbeat(unregistered)).status, 403);
  assert.equal((await call(`/api/sessions/${sid}/join`, { method: 'POST', cookie: unregistered.cookie })).status, 201);
  assert.equal((await heartbeat(unregistered)).status, 403, 'incomplete profiles do not count');
  for (const [person, nickname] of [[a, '첫시민'], [b, '둘째시민']]) {
    assert.equal((await call(`/api/sessions/${sid}/profile`, { method: 'POST', cookie: person.cookie,
      data: { nickname, department_id: 'dept-23', mbti: 'INFP' } })).status, 201);
  }
  assert.equal((await heartbeat(a)).body.online_count, 2);
  assert.equal((await heartbeat(a)).body.online_count, 2, 'multiple tabs share one participant');
  const count = await call(path);
  assert.deepEqual(count.body, { session_id: sid, online_count: 2 });
  assert.equal(count.headers.get('cache-control'), 'no-store');
  assert.equal((await call(path, { method: 'POST', cookie: a.cookie, origin: 'https://other.invalid' })).status, 403);
  await pool.query("UPDATE simus.participants SET last_seen_at=clock_timestamp()-interval '46 seconds' WHERE id=$1", [b.body.participant_id]);
  assert.equal((await call(path)).body.online_count, 1, 'disconnected participants expire');
  assert.equal((await call(path)).body.online_count, 1, 'read-only counts do not renew presence');
  assert.equal((await heartbeat(b)).body.online_count, 2, 'returning participants count again');
  await pool.query('UPDATE simus.participant_credentials SET revoked_at=clock_timestamp() WHERE participant_id=$1', [b.body.participant_id]);
  assert.equal((await call(path)).body.online_count, 1, 'revoked credentials do not count');
  assert.equal((await heartbeat(b)).status, 401);
  assert.equal((await call('/api/sessions/invalid/population')).status, 400);
  assert.equal((await call(`/api/sessions/${randomUUID()}/population`)).status, 404);

  if (env.TEST_PLAYWRIGHT_MODULE) {
    const { chromium } = await import(pathToFileURL(env.TEST_PLAYWRIGHT_MODULE).href);
    const browser = await chromium.launch({ headless: true, executablePath: env.TEST_CHROMIUM_EXECUTABLE || undefined });
    try {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const [name, value] = a.cookie.split('=');
      await context.addCookies([{ name, value, url: env.TEST_API_URL }]);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(env.TEST_API_URL + '/participate');
      await page.getByRole('status').filter({ hasText: '현재 인구 1명' }).waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.route('**/population', route => route.fulfill({ status: 503, json: {} }));
      await page.evaluate(() => window.dispatchEvent(new Event('online')));
      await page.getByRole('status').filter({ hasText: '현재 인구 확인 중' }).waitFor();
      await page.unroute('**/population');
      await page.evaluate(() => window.dispatchEvent(new Event('online')));
      await page.getByRole('status').filter({ hasText: '현재 인구 1명' }).waitFor();
      assert.deepEqual(errors, []);
      console.log('PASS: mobile population display, network failure/recovery and no horizontal overflow');
    } finally { await browser.close(); }
  }
  assert.equal((await action('end')).status, 200);
  assert.equal((await heartbeat(a)).body.online_count, 0, 'finished sessions have no current population');
  assert.equal((await call(path)).body.online_count, 0);
  console.log('PASS: authenticated presence, unique participant count, expiry/reconnect, profile gating, revocation, origin checks and finalized session');
}
