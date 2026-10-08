import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { enterCity } from './participant-entry.mjs';

export async function runProfileIntegration({ pool, env, token, templateId }) {
  async function call(path, { method = 'GET', data, cookie, admin = false, origin } = {}) {
    const response = await fetch(env.TEST_API_URL + path, {
      method, headers: { ...(cookie ? { cookie } : {}), ...(admin ? { authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'content-type': 'application/json' } : {}), ...(origin ? { origin } : {}) },
      body: data ? JSON.stringify(data) : undefined,
    });
    return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  async function create(name) {
    const created = await call('/api/admin/sessions', { method: 'POST', admin: true, data: {
      template_session_id: templateId, name, duration_seconds: 300, impact_scale: 0.1, request_key: randomUUID(),
    } });
    assert.equal(created.status, 201);
    const sid = created.body.session_id;
    assert.equal((await call(`/api/admin/sessions/${sid}/start`, { method: 'POST', admin: true, data: { request_key: randomUUID() } })).status, 200);
    return sid;
  }
  const end = async sid => assert.equal((await call(`/api/admin/sessions/${sid}/end`, { method: 'POST', admin: true, data: { request_key: randomUUID() } })).status, 200);
  const valid = { nickname: '새벽산책러', department_id: 'dept-23', mbti: 'INFP' };

  const sid = await create('프로필 입장 검증');
  const path = `/api/sessions/${sid}/profile`;
  const [a, b, c, legacy, late] = await Promise.all(Array.from({ length: 5 }, () => call('/api/participants', { method: 'POST' })));
  const enter = (person, data = valid, options = {}) => call(path, { method: 'POST', cookie: person.cookie, data, ...options });
  assert.equal((await call(path)).status, 401);
  const before = (await call(path, { cookie: a.cookie })).body;
  assert.equal(before.joined, false);
  assert.equal(before.profile, null);
  assert.equal(before.departments.length, 44);
  assert.ok(!before.departments.some(d => d.id === 'none'));

  for (const [data, code] of [
    [{ ...valid, nickname: '수' }, 'INVALID_NICKNAME'], [{ ...valid, nickname: '열한글자가넘는닉네임이' }, 'INVALID_NICKNAME'],
    [{ ...valid, nickname: '별⭐️' }, 'INVALID_NICKNAME'], [{ ...valid, nickname: 7 }, 'INVALID_NICKNAME'],
    [{ ...valid, department_id: 'none' }, 'INVALID_DEPARTMENT'], [{ ...valid, department_id: 'dept-99' }, 'INVALID_DEPARTMENT'],
    [{ ...valid, mbti: 'INF' }, 'INVALID_MBTI'], [{ ...valid, mbti: 'XNFP' }, 'INVALID_MBTI'],
  ]) {
    const rejected = await enter(a, data);
    assert.equal(rejected.status, 400);
    assert.equal(rejected.body.error.code, code);
  }
  assert.equal((await enter(a, valid, { origin: 'https://other.invalid' })).status, 403);
  // A rejected profile must not leave a membership or NPC behind.
  assert.equal((await call(path, { cookie: a.cookie })).body.joined, false);
  assert.equal((await call(`/api/sessions/${sid}/npc`, { cookie: a.cookie })).status, 404);

  const first = await enter(a, { ...valid, nickname: '  새벽   산책러 ' });
  assert.equal(first.status, 201, JSON.stringify(first.body));
  assert.equal(first.body.profile.nickname, '새벽 산책러');
  assert.equal(first.body.profile.department_name, '게임콘텐츠과');
  assert.match(first.body.profile.citizen_no, /^\d{2}-0001$/);
  const replay = await enter(a, { ...valid, nickname: '새벽 산책러' });
  assert.equal(replay.status, 200);
  assert.deepEqual(replay.body.profile, first.body.profile);
  const changed = await enter(a, { ...valid, nickname: '새벽 산책러', mbti: 'ENFP' });
  assert.equal(changed.status, 409);
  assert.equal(changed.body.error.code, 'PROFILE_LOCKED');
  assert.equal((await call(`/api/sessions/${sid}/npc`, { cookie: a.cookie })).status, 200);

  const [second, third] = await Promise.all([enter(b, { ...valid, nickname: '둘째' }), enter(c, { ...valid, nickname: '셋째' })]);
  assert.deepEqual([second.status, third.status], [201, 201]);
  const numbers = [first, second, third].map(r => r.body.profile.citizen_no.slice(-4)).sort();
  assert.deepEqual(numbers, ['0001', '0002', '0003']);
  assert.equal((await call(path, { cookie: b.cookie })).body.profile.citizen_no, second.body.profile.citizen_no);

  const departmentPath = `/api/sessions/${sid}/department`;
  assert.equal((await call(departmentPath, { cookie: a.cookie })).body.locked, true);
  const departmentEdit = await call(departmentPath, { method: 'PUT', cookie: a.cookie, data: { department_id: 'dept-01' } });
  assert.equal(departmentEdit.body.error.code, 'DEPARTMENT_LOCKED');
  for (const [column, value] of [['nickname', '바꿈'], ['mbti', 'ESTJ'], ['department_id', 'dept-01']]) {
    await assert.rejects(pool.query(`UPDATE simus.participant_sessions SET ${column}=$3 WHERE session_id=$1 AND participant_id=$2`,
      [sid, a.body.participant_id, value]), error => error.code === '23514');
  }

  // Members who joined before 009 complete the profile on their next entry.
  assert.equal((await call(`/api/sessions/${sid}/join`, { method: 'POST', cookie: legacy.cookie })).status, 201);
  await assert.rejects(pool.query(`UPDATE simus.participant_sessions SET nickname='반쪽' WHERE session_id=$1 AND participant_id=$2`,
    [sid, legacy.body.participant_id]), error => error.code === '23514');
  const legacyBefore = (await call(path, { cookie: legacy.cookie })).body;
  assert.deepEqual([legacyBefore.joined, legacyBefore.profile], [true, null]);
  assert.equal((await enter(legacy, { ...valid, nickname: '기존참여자' })).body.profile.citizen_no.slice(-4), '0004');

  await end(sid);
  assert.equal((await enter(late)).body.error.code, 'SESSION_CLOSED');
  assert.equal((await call(path, { cookie: late.cookie })).body.joined, false);
  assert.equal((await enter(a, { ...valid, nickname: '새벽 산책러' })).status, 200);

  const next = await create('프로필 다음 회차');
  const nextProfile = (await call(`/api/sessions/${next}/profile`, { cookie: a.cookie })).body;
  assert.deepEqual([nextProfile.joined, nextProfile.profile], [false, null]);
  const nextEntry = await call(`/api/sessions/${next}/profile`, { method: 'POST', cookie: a.cookie, data: { ...valid, nickname: '다음회차', mbti: 'ESTJ' } });
  assert.equal(nextEntry.status, 201);
  assert.equal(Number(nextEntry.body.profile.citizen_no.slice(0, 2)), Number(first.body.profile.citizen_no.slice(0, 2)) + 1);
  assert.equal((await call(path, { cookie: a.cookie })).body.profile.nickname, '새벽 산책러');

  if (env.TEST_PLAYWRIGHT_MODULE) {
    const { chromium } = await import(pathToFileURL(env.TEST_PLAYWRIGHT_MODULE).href);
    const browser = await chromium.launch({ headless: true, executablePath: env.TEST_CHROMIUM_EXECUTABLE || undefined });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(env.TEST_API_URL + '/participate');
      const cta = page.getByRole('button', { name: /도시에 입장하기/ });
      await cta.waitFor();
      assert.equal(await cta.isDisabled(), true);
      await page.getByRole('heading', { name: '시민증 만들기' }).waitFor();
      await page.getByText('입장한 뒤에는 닉네임·학과·MBTI를 바꿀 수 없어요.', { exact: true }).waitFor();
      await page.getByLabel('닉네임', { exact: true }).fill('브라우저시민');
      assert.equal(await cta.isDisabled(), true);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await enterCity(page, { nickname: '브라우저시민' });
      const citizen = page.getByLabel('내 시민증');
      assert.match(await citizen.innerText(), /브라우저시민[\s\S]*게임콘텐츠과[\s\S]*INFP/);
      await page.reload();
      await page.getByRole('region', { name: '도시와 선택' }).waitFor();
      assert.equal(await page.getByLabel('닉네임', { exact: true }).count(), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(errors, []);
      console.log('PASS: 390px profile entry gating, live missing-field note, entry transition, citizen header, reload keeps entry, no overflow/JS errors');
    } finally { await browser.close(); }
  } else console.log('SKIP: profile entry browser (set TEST_PLAYWRIGHT_MODULE)');
  await end(next);
  console.log('PASS: profile entry validation/normalization, join rollback on rejection, replay/lock, serialized citizen numbers, department/DB locks, legacy members, closure and next-round isolation');
}
