import assert from 'node:assert/strict';

// Real browser geometry with synthetic long content; no Unity build fixture.
export async function checkMobilePanel(page) {
  await page.route('**/api/sessions/current', async route => {
    const response = await route.fetch();
    const json = await response.json();
    if (json.session) for (const situation of json.session.situations) {
      situation.title = '긴 상황 제목 '.repeat(12);
      situation.body = '도시에서 마주친 상황을 읽고 행동을 선택해 주세요. '.repeat(35);
      for (const choice of situation.choices) choice.label = '긴 선택지와 줄바꿈없는문자열'.repeat(18);
    }
    await route.fulfill({ response, json });
  });
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 740 });
    await page.reload();
    await page.getByRole('radio').first().waitFor();
    for (const scale of [100, 200]) {
      await page.evaluate(value => { document.documentElement.style.fontSize = `${value}%`; }, scale);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px ${scale}% overflow`);
      const summary = page.locator('summary').filter({ hasText: '도시에서 선택하기' });
      const city = page.getByRole('region', { name: '내 캐릭터를 따라가는 도시' });
      const c = await city.boundingBox(), p = await summary.boundingBox();
      assert.ok(c.y + c.height <= p.y + 1, 'city and panel must not overlap');
      await summary.focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.getByRole('radio').first().isVisible(), false);
      await page.keyboard.press('Enter');
      await page.getByRole('radio').first().check();
      const submit = page.getByRole('button', { name: '선택 제출', exact: true });
      await submit.focus();
      assert.ok(await submit.evaluate(el => el === document.activeElement));
      await submit.scrollIntoViewIfNeeded();
      const rect = await submit.boundingBox();
      assert.ok(rect.y >= 0 && rect.y + rect.height <= 741, 'submit reachable');
    }
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  await page.unroute('**/api/sessions/current');
  await page.route('**/api/sessions/current', async route => {
    const response = await route.fetch();
    const json = await response.json();
    json.session.situations = [];
    await route.fulfill({ response, json });
  });
  await page.reload();
  await page.getByText('등록된 상황이 없습니다', { exact: true }).waitFor();
  assert.equal(await page.getByRole('navigation', { name: '상황 이동' }).count(), 0);
  assert.ok(await page.getByRole('button', { name: '상태 새로고침', exact: true }).isEnabled());
  await page.unroute('**/api/sessions/current');
  await page.reload();
  await page.getByRole('radio', { name: 'A', exact: true }).waitFor();

  // Hold the refresh after an old-round replay to expose transient state pollution.
  const { session } = await page.evaluate(async () => (await fetch('/api/sessions/current')).json());
  const oldPending = {
    session_id: crypto.randomUUID(), situation_id: session.situations[0].id,
    choice_id: session.situations[0].choices[0].id, request_key: crypto.randomUUID(),
  };
  await page.evaluate(value => localStorage.setItem('simus_pending_choice_v1', JSON.stringify(value)), oldPending);
  await page.reload();
  await page.getByRole('button', { name: '이전 제출 다시 확인' }).waitFor();
  let release, replayPayload;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/responses', async route => { await gate; await route.continue(); });
  await page.route('**/api/choices', async route => {
    replayPayload = route.request().postDataJSON();
    await route.fulfill({ status: 200, json: {} });
  });
  try {
    await page.getByRole('button', { name: '이전 제출 다시 확인' }).click();
    await page.getByRole('heading', { name: '이전 회차 제출 확인' }).waitFor({ state: 'detached' });
    assert.deepEqual(replayPayload, oldPending);
    assert.equal(await page.getByRole('button', { name: '응답 완료', exact: true }).count(), 0);
    assert.ok(await page.getByText(`0 / ${session.situations.length} 응답`, { exact: true }).isVisible());
  } finally { release(); }
  await page.unroute('**/responses');
  await page.unroute('**/api/choices');
  await page.reload();
  await page.getByRole('radio', { name: 'A', exact: true }).waitFor();
  console.log('PASS: empty-round action and old-round replay cannot mark current answer complete before refresh');
  console.log('PASS: 360/390/430px, 100/200% text, long content, no overlap/overflow, collapse keyboard focus, submit scroll reachability (no WebGL build)');
}
