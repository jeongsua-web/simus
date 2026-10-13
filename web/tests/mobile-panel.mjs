import assert from 'node:assert/strict';

// Real browser geometry with synthetic long content; no Unity build fixture.
export async function checkMobilePanel(page, eventFixture) {
  // Layout fixture affects only authenticated event payloads, never public catalogue choices.
  assert.ok(eventFixture?.event, 'provide an active event fixture for mobile geometry checks');
  await page.route('**/api/sessions/*/event', async route => {
    const json = structuredClone(eventFixture);
    const situation = json.event.situation;
    situation.title = '긴 상황 제목 '.repeat(12);
    situation.body = '도시에서 마주친 상황을 읽고 행동을 선택해 주세요. '.repeat(35);
    for (const choice of situation.choices) choice.label = '긴 선택지와 줄바꿈없는문자열'.repeat(18);
    await route.fulfill({ json });
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
  await page.unroute('**/api/sessions/*/event');
  for (const phase of ['WAITING', 'GUIDING', 'CLOSED']) {
    await page.route('**/api/sessions/*/event', route => route.fulfill({ json: { ...eventFixture, phase, event: null } }));
    await page.reload();
    await page.getByText(phase === 'GUIDING' ? '새로운 상황을 만나러 이동 중이에요' : phase === 'CLOSED' ? '이벤트 접수가 마감되었습니다' : '도시를 둘러보고 있어요', { exact: true }).waitFor();
    assert.equal(await page.getByRole('radio').count(), 0);
    assert.equal(await page.getByRole('navigation', { name: '상황 이동' }).count(), 0);
    await page.unroute('**/api/sessions/*/event');
  }
  console.log('PASS: 360/390/430px, 100/200% text, long content, no overlap/overflow, collapse keyboard focus, submit scroll reachability; waiting/guiding/closed hide choices (no WebGL build)');
}
