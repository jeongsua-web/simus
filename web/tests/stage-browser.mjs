import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { enterCity } from './participant-entry.mjs';

export async function runStageBrowser({ env, pool, token, templateId }) {
  if (!env.TEST_PLAYWRIGHT_MODULE) { console.log('SKIP: integrated browser additions'); return; }
  const { chromium } = await import(pathToFileURL(env.TEST_PLAYWRIGHT_MODULE).href);
  const browser = await chromium.launch({ headless: true, executablePath: env.TEST_CHROMIUM_EXECUTABLE || undefined });
  const errors = [];
  try {
    const admin = await browser.newPage();
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    for (const page of [admin, mobile]) page.on('pageerror', error => errors.push(error.message));
    await admin.goto(env.TEST_API_URL + '/admin');
    await admin.getByLabel('관리자 토큰').fill(token);
    await admin.getByRole('button', { name: '운영 화면 열기' }).click();
    async function create(name) {
      await admin.getByLabel('복사할 회차').selectOption(templateId);
      await admin.getByLabel('새 회차 이름').fill(name);
      await admin.getByLabel('진행 시간(초)').fill('300');
      const created = admin.waitForResponse(r => r.url().endsWith('/api/admin/sessions') && r.request().method() === 'POST');
      await admin.getByRole('button', { name: '새 회차 준비', exact: true }).click();
      const response = await created;
      assert.equal(response.status(), 201);
      const { session_id: id } = await response.json();
      const card = admin.locator('article').filter({ hasText: id });
      const started = admin.waitForResponse(r => r.url().endsWith(`/api/admin/sessions/${id}/start`));
      await card.getByRole('button', { name: '회차 시작', exact: true }).click();
      assert.equal((await started).status(), 200);
      return { id, card };
    }
    async function end({ id, card }) {
      await card.getByRole('button', { name: '수동 종료', exact: true }).click();
      const ended = admin.waitForResponse(r => r.url().endsWith(`/api/admin/sessions/${id}/end`));
      await card.getByRole('button', { name: '대상 회차 종료', exact: true }).click();
      assert.equal((await ended).status(), 200);
    }
    const first = await create('브라우저 통합 첫 회차');
    await mobile.goto(env.TEST_API_URL + '/participate');
    await enterCity(mobile);
    await mobile.getByRole('region', { name: '함께 만든 도시' }).waitFor();
    await mobile.getByRole('region', { name: '도시와 선택' }).waitFor();
    await mobile.locator('canvas[aria-hidden="true"]').waitFor();
    await mobile.getByRole('status').filter({ hasText: 'NPC ' }).waitFor();
    const firstNpc = await mobile.getByRole('status').filter({ hasText: 'NPC ' }).innerText();
    const peer = await browser.newPage({ viewport: { width: 390, height: 844 } });
    peer.on('pageerror', error => errors.push(error.message));
    await peer.goto(env.TEST_API_URL + '/participate');
    await enterCity(peer, { nickname: '옆자리시민' });
    await peer.getByRole('status').filter({ hasText: 'NPC ' }).waitFor();
    const secondNpc = await peer.getByRole('status').filter({ hasText: 'NPC ' }).innerText();
    assert.notEqual(firstNpc.match(/NPC ([0-9a-f]{8})/)?.[1], secondNpc.match(/NPC ([0-9a-f]{8})/)?.[1]);
    assert.ok(await mobile.getByText('도시에서 선택하기', { exact: false }).isVisible());
    await mobile.getByRole('radio').first().check();
    let payload;
    await mobile.route('**/api/choices', async route => { payload = route.request().postDataJSON(); await route.abort('connectionfailed'); });
    await mobile.getByRole('button', { name: '선택 제출', exact: true }).click();
    await mobile.getByRole('button', { name: '같은 선택으로 다시 확인', exact: true }).waitFor();
    await mobile.reload();
    const retry = mobile.getByRole('button', { name: '같은 선택으로 다시 확인', exact: true });
    await retry.waitFor();
    assert.ok(await retry.isEnabled());
    assert.ok(await mobile.getByRole('radio').first().isChecked());
    assert.deepEqual(await mobile.evaluate(() => JSON.parse(localStorage.getItem('simus_pending_choice_v1'))), payload);
    await mobile.unroute('**/api/choices');
    await retry.click();
    await mobile.getByRole('button', { name: '응답 완료', exact: true }).waitFor();
    assert.equal(await mobile.evaluate(() => localStorage.getItem('simus_pending_choice_v1')), null);
    assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await end(first);
    await mobile.goto(`${env.TEST_API_URL}/result/${first.id}`);
    await mobile.getByRole('region', { name: '이 회차의 최종 도시' }).waitFor();
    const second = await create('브라우저 통합 다음 회차');
    await mobile.evaluate(value => localStorage.setItem('simus_pending_choice_v1', JSON.stringify(value)), payload);
    await mobile.goto(env.TEST_API_URL + '/participate');
    // The previous-round retry stays reachable before and after the entry form.
    await mobile.getByRole('heading', { name: '이전 회차 제출 확인' }).waitFor();
    await enterCity(mobile);
    await mobile.getByRole('heading', { name: '이전 회차 제출 확인' }).waitFor();
    await mobile.getByRole('link', { name: '브라우저 통합 첫 회차 결과 보기' }).waitFor();
    assert.ok(await mobile.getByRole('button', { name: '선택 제출', exact: true }).isDisabled());
    const oldReplay = mobile.waitForResponse(r => r.url().endsWith('/api/choices'));
    await mobile.getByRole('button', { name: '이전 제출 다시 확인' }).click();
    const replay = await oldReplay;
    assert.equal(replay.status(), 200);
    assert.deepEqual(replay.request().postDataJSON(), payload);
    assert.equal((await pool.query('SELECT version FROM simus.city_states WHERE session_id=$1', [second.id])).rows[0].version, '0');
    await end(second);
    assert.deepEqual(errors, []);
    console.log('PASS: 390px mobile, admin create/duration/start/end, uncommitted pending survives reload, original-key retry across rounds, final city/history, no JS errors');
  } finally { await browser.close(); }
}
