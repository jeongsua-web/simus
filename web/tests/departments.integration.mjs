import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { enterCity } from './participant-entry.mjs';

export async function runDepartmentIntegration({ pool, env, token, templateId }) {
  async function call(path, { method = 'GET', data, cookie, admin = false, origin } = {}) {
    const response = await fetch(env.TEST_API_URL + path, {
      method, headers: { ...(cookie ? { cookie } : {}), ...(admin ? { authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'content-type': 'application/json' } : {}), ...(origin ? { origin } : {}) },
      body: data ? JSON.stringify(data) : undefined,
    });
    return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  async function create() {
    const created = await call('/api/admin/sessions', { method: 'POST', admin: true, data: {
      template_session_id: templateId, name: '3C 학과 검증', duration_seconds: 300, impact_scale: 0.1, request_key: randomUUID(),
    } });
    assert.equal(created.status, 201);
    const sid = created.body.session_id;
    assert.equal((await call(`/api/admin/sessions/${sid}/start`, { method: 'POST', admin: true, data: { request_key: randomUUID() } })).status, 200);
    return sid;
  }
  async function end(sid) {
    assert.equal((await call(`/api/admin/sessions/${sid}/end`, { method: 'POST', admin: true, data: { request_key: randomUUID() } })).status, 200);
  }
  const sid = await create();
  const path = `/api/sessions/${sid}/department`;
  const a = await call('/api/participants', { method: 'POST' });
  const b = await call('/api/participants', { method: 'POST' });
  assert.equal((await call(path)).status, 401);
  assert.equal((await call(path, { cookie: a.cookie })).status, 404);
  for (const person of [a,b]) assert.equal((await call(`/api/sessions/${sid}/join`, { method: 'POST', cookie: person.cookie })).status, 201);
  const read = () => call(path, { cookie: a.cookie });
  const save = (id, options = {}) => call(path, { method: 'PUT', cookie: a.cookie, data: { department_id: id }, ...options });
  const initial = (await read()).body;
  assert.equal(initial.department_id, 'none');
  assert.equal(initial.locked, false);
  assert.equal(initial.departments.length, 45);
  assert.equal(initial.departments.filter(d => d.faculty === '학부 지정 없음')[0].name, '자율전공학과');
  assert.equal((await save('invalid')).status, 400);
  assert.equal((await save('dept-01', { origin: 'https://other.invalid' })).status, 403);
  for (const id of ['other', 'external', 'none', 'dept-42', 'dept-01']) assert.equal((await save(id)).status, 200);
  assert.equal((await read()).body.department_id, 'dept-01');
  assert.equal((await call(path, { cookie: b.cookie })).body.department_id, 'none');
  const session = (await call('/api/sessions/current')).body.session;
  const situation = session.situations[0];
  const choice = { session_id: sid, situation_id: situation.id, choice_id: situation.choices[0].id, request_key: randomUUID() };
  assert.equal((await call('/api/choices', { method: 'POST', cookie: a.cookie, data: { ...choice, choice_id: randomUUID() } })).status, 400);
  assert.equal((await read()).body.locked, false);
  // Competing first choice and department edit must have a serial outcome.
  const [picked, edited] = await Promise.all([
    call('/api/choices', { method: 'POST', cookie: a.cookie, data: choice }), save('dept-02'),
  ]);
  assert.equal(picked.status, 201);
  assert.ok([200,409].includes(edited.status));
  const frozen = (await read()).body;
  assert.equal(frozen.locked, true);
  assert.equal(frozen.department_id, edited.status === 200 ? 'dept-02' : 'dept-01');
  assert.equal((await save('dept-03')).body.error.code, 'DEPARTMENT_LOCKED');
  assert.equal((await call('/api/choices', { method: 'POST', cookie: a.cookie, data: choice })).status, 200);
  await assert.rejects(pool.query('UPDATE simus.participant_sessions SET department_id=$3 WHERE session_id=$1 AND participant_id=$2',
    [sid, a.body.participant_id, 'dept-03']), error => error.code === '23514');
  assert.equal((await pool.query('SELECT version::text FROM simus.city_states WHERE session_id=$1', [sid])).rows[0].version, '1');
  if (env.TEST_PLAYWRIGHT_MODULE) {
    const { chromium } = await import(pathToFileURL(env.TEST_PLAYWRIGHT_MODULE).href);
    const browser = await chromium.launch({ headless: true, executablePath: env.TEST_CHROMIUM_EXECUTABLE || undefined });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(env.TEST_API_URL + '/participate');
      await enterCity(page, { faculty: '기타', department: '자율전공학과' });
      const cookie = (await page.context().cookies()).find(c => c.name === 'simus_participant');
      const stored = await call(path, { cookie: `${cookie.name}=${cookie.value}` });
      assert.deepEqual([stored.body.department_id, stored.body.locked], ['dept-42', true]);
      await page.getByRole('radio').first().check();
      await page.getByRole('button', { name: '선택 제출', exact: true }).first().click();
      await page.getByRole('button', { name: '응답 완료', exact: true }).first().waitFor();
      await page.reload();
      assert.match(await page.getByLabel('내 시민증').innerText(), /자율전공학과/);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(errors, []);
      console.log('PASS: 3C mobile browser department chosen at entry, stored/locked, kept after first choice and reload, no overflow');
    } finally { await browser.close(); }
  } else console.log('SKIP: 3C browser (set TEST_PLAYWRIGHT_MODULE)');
  await end(sid);
  assert.equal((await save('dept-03')).body.error.code, 'SESSION_CLOSED');
  assert.equal((await call(path, { method: 'PUT', cookie: b.cookie, data: { department_id: 'external' } })).status, 409);
  const next = await create();
  assert.equal((await call(`/api/sessions/${next}/join`, { method: 'POST', cookie: a.cookie })).status, 201);
  const nextPath = `/api/sessions/${next}/department`;
  assert.equal((await call(nextPath, { cookie: a.cookie })).body.department_id, 'none');
  assert.equal((await call(nextPath, { method: 'PUT', cookie: a.cookie, data: { department_id: 'external' } })).status, 200);
  assert.equal((await read()).body.department_id, frozen.department_id);
  await end(next);
  console.log('PASS: 3C 45 departments, own membership/auth/origin, pre-choice edits, rejected choice, concurrent first choice/edit, DB lock, replay, closure and next-round isolation');
}
