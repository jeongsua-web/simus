import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { enterCity } from './participant-entry.mjs';

// Optional: use an explicitly supplied Playwright installation, without installing browsers.
export async function runBrowserFlow({ env, pool, round, token, call }) {
  if (!env.TEST_PLAYWRIGHT_MODULE) {
    console.log('SKIP: browser UI (set TEST_PLAYWRIGHT_MODULE to playwright/index.mjs)');
    return;
  }
  const { chromium } = await import(pathToFileURL(env.TEST_PLAYWRIGHT_MODULE).href);
  const browser = await chromium.launch({ headless: true, executablePath: env.TEST_CHROMIUM_EXECUTABLE || undefined });
  const errors = [];
  try {
    const r = await round();
    const contexts = await Promise.all(Array.from({ length: 4 }, () => browser.newContext()));
    const pages = await Promise.all(contexts.map(c => c.newPage()));
    for (const page of pages) page.on('pageerror', error => errors.push(error.message));
    const [admin, a, b, stranger] = pages;
    await admin.goto(env.TEST_API_URL + '/admin');
    await admin.getByLabel('관리자 토큰').fill(token);
    await admin.getByRole('button', { name: '운영 화면 열기' }).click();
    const card = admin.locator('article').filter({ hasText: r.sid });
    const startResponse = admin.waitForResponse(response => response.url().endsWith(`/api/admin/sessions/${r.sid}/start`));
    await card.getByRole('button', { name: '회차 시작', exact: true }).click();
    const started = await startResponse;
    assert.equal(started.status(), 200, await started.text());
    await card.getByRole('button', { name: '수동 종료', exact: true }).waitFor();
    await Promise.all([a, b, stranger].map(p => p.goto(env.TEST_API_URL + '/participate')));
    await Promise.all([a, b, stranger].map((p, i) => enterCity(p, { nickname: `참여자${i + 1}` })));
    await Promise.all([a, b, stranger].map(p => p.getByRole('radio', { name: 'A', exact: true }).waitFor()));
    const identities = await Promise.all(contexts.slice(1).map(c => c.cookies()));
    assert.equal(new Set(identities.map(c => c.find(x => x.name === 'simus_participant')?.value)).size, 3);
    await a.getByRole('radio', { name: 'A', exact: true }).check();
    await b.getByRole('radio', { name: 'B', exact: true }).check();
    // Commit the first submission, then lose its response at the browser boundary.
    let lost = false;
    await a.route('**/api/choices', async route => {
      if (lost) return route.continue();
      lost = true;
      const response = await route.fetch();
      assert.equal(response.status(), 201);
      await route.abort('connectionfailed');
    });
    await Promise.all([a, b].map(p => p.getByRole('button', { name: '선택 제출', exact: true }).click()));
    await b.getByRole('button', { name: '응답 완료', exact: true }).waitFor();
    // Polling may restore the committed answer before the explicit retry; both are valid recovery.
    const retry = a.getByRole('button', { name: '같은 선택으로 다시 확인', exact: true });
    await a.getByRole('button', { name: /같은 선택으로 다시 확인|응답 완료/ }).waitFor();
    if (await retry.isVisible()) await retry.click();
    await a.getByRole('button', { name: '응답 완료', exact: true }).waitFor();
    await a.reload();
    await a.getByRole('button', { name: '응답 완료', exact: true }).waitFor();
    assert.ok(await a.getByRole('radio', { name: 'A', exact: true }).isChecked());
    assert.ok(await a.getByRole('radio', { name: 'A', exact: true }).isDisabled());
    assert.equal((await pool.query('SELECT count(*) FROM simus.choice_records WHERE session_id=$1', [r.sid])).rows[0].count, '2');
    await contexts[1].setOffline(true);
    await a.getByRole('heading', { name: '정보를 불러오지 못했습니다' }).waitFor({ timeout: 15000 });
    await contexts[1].setOffline(false);
    // The online event now restores state automatically; a retry button may disappear before click.
    await a.getByRole('button', { name: '응답 완료', exact: true }).waitFor();
    await pool.query('UPDATE simus.simulation_sessions SET admission_closed_at=clock_timestamp() WHERE id=$1', [r.sid]);
    await a.reload();
    await a.getByText('회차 종료 시각까지 기다려 주세요.', { exact: true }).waitFor();
    await card.getByRole('button', { name: '수동 종료', exact: true }).click();
    const endResponse = admin.waitForResponse(response => response.url().endsWith(`/api/admin/sessions/${r.sid}/end`));
    await card.getByRole('button', { name: '대상 회차 종료', exact: true }).click();
    const ended = await endResponse;
    assert.equal(ended.status(), 200, await ended.text());
    await card.getByText('최종 확정', { exact: true }).first().waitFor();
    await Promise.all([a, b, stranger].map(p => p.goto(`${env.TEST_API_URL}/result/${r.sid}`)));
    await Promise.all([a, b].map(p => p.getByRole('heading', { name: '완전 중립' }).waitFor()));
    assert.equal(await a.locator('dl > div').filter({ hasText: '질서 축' }).locator('dd').textContent(), '1');
    assert.equal(await b.locator('dl > div').filter({ hasText: '질서 축' }).locator('dd').textContent(), '-1');
    await stranger.getByText('참여한 선택 없음', { exact: true }).waitFor();
    const next = await round();
    assert.equal((await call(`/api/admin/sessions/${next.sid}/start`, { auth: token, data: { request_key: crypto.randomUUID() } })).status, 200);
    await a.goto(env.TEST_API_URL + '/participate');
    await enterCity(a, { nickname: '다음회차' });
    await a.getByRole('button', { name: '선택 제출', exact: true }).waitFor();
    assert.equal(await a.getByRole('radio', { name: 'A', exact: true }).isChecked(), false);
    assert.equal(await a.getByRole('radio', { name: 'A', exact: true }).isDisabled(), false);
    await call(`/api/admin/sessions/${next.sid}/end`, { auth: token, data: { request_key: crypto.randomUUID() } });
    assert.deepEqual(errors, []);
    console.log('PASS: Chromium admin start/end; 3 isolated participant contexts; response loss/retry, refresh restoration, offline/online recovery, cutoff UI, different own results, next-round reset; no page errors');
  } finally { await browser.close(); }
}
