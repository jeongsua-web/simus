import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { enterCity } from './participant-entry.mjs';
import { checkMobilePanel } from './mobile-panel.mjs';

export async function runEventBrowser({ pool, env, token, templateId }) {
  if (!env.TEST_EVENT_PLAYWRIGHT_MODULE) return console.log('SKIP: event browser (set TEST_EVENT_PLAYWRIGHT_MODULE)');
  const { chromium } = await import(pathToFileURL(env.TEST_EVENT_PLAYWRIGHT_MODULE).href);
  const browser = await chromium.launch({ headless: true, executablePath: env.TEST_CHROMIUM_EXECUTABLE || undefined });
  const failures = [];
  let sid, started = false;
  async function admin(path, data) {
    const response = await fetch(env.TEST_API_URL + path, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(data) });
    const json = await response.json();
    assert.ok(response.ok, JSON.stringify(json));
    return json;
  }
  try {
    sid = (await admin('/api/admin/sessions', { template_session_id: templateId, name: 'Disposable event browser', duration_seconds: 600, impact_scale: 0.1, request_key: randomUUID() })).session_id;
    // Approved exhibition geometry is deliberately not fabricated by this fixture.
    await pool.query('UPDATE simus.session_situations SET event_location=NULL,is_generic=false WHERE session_id=$1', [sid]);
    const generic = (await pool.query('SELECT id FROM simus.session_situations WHERE session_id=$1 ORDER BY display_order,id LIMIT 1', [sid])).rows[0].id;
    await pool.query('UPDATE simus.session_situations SET is_generic=true WHERE session_id=$1 AND id=$2', [sid,generic]);
    await pool.query(`WITH added AS (
      INSERT INTO simus.session_situations(session_id,code,title,body,display_order)
      SELECT $1,'BROWSER_VARIETY_'||n,'다른 상황 '||n,'다음 행동을 선택해주세요.',100+n
      FROM generate_series(1,2) n RETURNING id
    ) INSERT INTO simus.session_choices(session_id,situation_id,label,display_order,importance)
      SELECT $1,a.id,c.label,c.n,'NORMAL' FROM added a
      CROSS JOIN (VALUES ('도와준다.',1),('지나간다.',2)) c(label,n)`,[sid]);
    await admin(`/api/admin/sessions/${sid}/start`, { request_key: randomUUID() });
    started = true;
    const context = await browser.newContext({ viewport: { width: 390, height: 740 } });
    const page = await context.newPage();
    page.on('pageerror', error => failures.push(error.message));
    await page.goto(env.TEST_API_URL + '/participate');
    await enterCity(page, { nickname: '이벤트시민' });
    await page.getByText('도시를 둘러보고 있어요', { exact: true }).waitFor();
    if (env.TEST_EVENT_SCREENSHOT_DIR) await page.screenshot({path: env.TEST_EVENT_SCREENSHOT_DIR + '/waiting.png', fullPage: true});
    assert.equal(await page.getByRole('radio').count(), 0);
    assert.equal(await page.getByRole('navigation', { name: '상황 이동' }).count(), 0);
    const pid = (await pool.query('SELECT participant_id FROM simus.participant_sessions WHERE session_id=$1', [sid])).rows[0].participant_id;
    const advance = () => pool.query("UPDATE simus.npc_event_states SET waiting_since=clock_timestamp()-interval '91 seconds' WHERE session_id=$1 AND participant_id=$2", [sid, pid]);
    await advance();
    await page.getByRole('radio').first().waitFor();
    const fixture = await page.evaluate(async id => (await fetch(`/api/sessions/${id}/event`)).json(), sid);
    assert.equal(fixture.phase, 'ACTIVE');
    if (env.TEST_EVENT_SCREENSHOT_DIR) await page.screenshot({path: env.TEST_EVENT_SCREENSHOT_DIR + '/active.png', fullPage: true});
    await page.getByRole('radio').first().check();
    let firstPayload;
    let attempts = 0;
    await page.route('**/api/choices', async route => {
      const payload = route.request().postDataJSON();
      if (attempts++ === 0) {
        firstPayload = payload;
        return route.fulfill({ status: 503, json: { error: { code: 'TEST_OUTAGE', message: '시험 연결 실패' } } });
      }
      assert.deepEqual(payload, firstPayload, 'retry preserves event and request UUID');
      await route.continue();
    });
    // The UI ignores clicks while its background refresh is in flight.
    // Wait for a real request instead of assuming one click submitted it.
    for (let n=0;n<20 && !firstPayload;n++) {
      await page.getByRole('button', { name: '선택 제출', exact: true }).click();
      await page.waitForTimeout(100);
    }
    assert.ok(firstPayload,'The selected choice must be submitted');
    const retry = page.getByRole('button', { name: '같은 선택으로 다시 확인', exact: true });
    await retry.waitFor();
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('simus_pending_choice_v1')).event_id), fixture.event.id);
    await retry.click();
    await page.getByText('1회 응답', { exact: true }).waitFor();
    await page.getByText('도시를 둘러보고 있어요', { exact: true }).waitFor();
    assert.equal(await page.getByRole('radio').count(), 0);
    assert.equal(await page.evaluate(() => localStorage.getItem('simus_pending_choice_v1')), null);
    await page.unroute('**/api/choices');
    await page.reload();
    await page.getByText('1회 응답', { exact: true }).waitFor();
    assert.equal(await page.getByRole('radio').count(), 0);
    await advance();
    await page.getByRole('radio').first().waitFor();
    assert.equal(await page.getByRole('radio').first().isChecked(), false, 'a different situation starts with no choice selected');
    const second = await page.evaluate(async id => (await fetch(`/api/sessions/${id}/event`)).json(), sid);
    assert.notEqual(second.event.id, fixture.event.id);
    assert.notEqual(second.event.situation_id, fixture.event.situation_id);
    await checkMobilePanel(page, second);
    await page.reload();
    await page.getByRole('radio').first().waitFor();
    await page.getByRole('radio').first().check();
    let lost = false;
    await page.route('**/api/choices', async route => {
      if (lost) return route.continue();
      lost = true;
      const response = await route.fetch();
      assert.equal(response.status(), 201);
      await route.abort('connectionfailed');
    });
    await page.getByRole('button', { name: '선택 제출', exact: true }).click();
    await page.getByText('2회 응답', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('simus_pending_choice_v1')), null);
    assert.equal((await pool.query('SELECT count(*) FROM simus.choice_records WHERE session_id=$1 AND participant_id=$2', [sid, pid])).rows[0].count, '2');
    await page.unroute('**/api/choices');
    // An event refresh failure must remove any previously displayed choice panel.
    await advance();
    await page.getByRole('radio').first().waitFor();
    await page.route('**/api/sessions/*/event', route => route.fulfill({ status: 503, json: { error: { message: '시험 이벤트 조회 실패' } } }));
    await page.getByRole('heading', { name: '정보를 불러오지 못했습니다' }).waitFor();
    assert.equal(await page.getByRole('radio').count(), 0);
    assert.deepEqual(failures, []);
    console.log('PASS: event Chromium mobile join/wait/active/submit/reset/reload; different situations without repeats; request-preserving retry and committed response-loss recovery; fail-closed refresh; mobile long-content geometry');
  } finally {
    await browser.close();
    if (sid && started) await admin(`/api/admin/sessions/${sid}/end`, { request_key: randomUUID() });
  }
}
