import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Browser-only API/bridge fixtures. Never sends an API request to the server or a database.
const { chromium } = await import(pathToFileURL(process.env.TEST_PLAYWRIGHT_MODULE).href);
const base = process.env.TEST_API_URL || 'http://127.0.0.1:3137';
const evidence = new URL('../../docs/verification/phase1/', import.meta.url);
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.TEST_CHROMIUM_EXECUTABLE });
const checks = [], errors = [], unexpected = [], submissions = [];
const sid = '11111111-1111-4111-8111-111111111111', eid = '22222222-2222-4222-8222-222222222222';
const map = 'test-only-city-rebuild-v002-phase1-v1', pathVersion = 'city-rebuild-v002-walk-phase1-v1';
const now = Date.now();
const iso = seconds => new Date(now + seconds * 1000).toISOString();
let phase = 'WAITING', overdue = false, answered = false, longContent = false, failedChoice = false;
const situation = () => ({ id: '33333333-3333-4333-8333-333333333333', code: 'EXH_18',
  title: longContent ? '긴 상황 제목 '.repeat(12) : '길고양이에게 먹이를 주고 싶다',
  body: longContent ? '도시에서 만난 상황을 읽고 행동을 선택해 주세요. '.repeat(35) : '고양이 주변에 도착했습니다.',
  choices: [{ id: 'choice-a', label: longContent ? '긴선택지줄바꿈확인'.repeat(40) : '먹이를 준다' }, { id: 'choice-b', label: '지나간다' }] });
const session = () => ({ id: sid, name: 'Phase 1 브라우저 fixture', status: 'RUNNING', accepting_choices: true,
  auto_cutoff_at: iso(3500), scheduled_end_at: iso(3600), situations: [] });
const snapshot = () => ({ session_id: sid, status: 'RUNNING', server_time: new Date().toISOString(), freeze_at: iso(3600),
  motion_time: new Date().toISOString(), frozen: false, npcs: [{ npc_id: 'fixture-own-npc', epoch: iso(-5),
    motion: { map_version: map, path_version: pathVersion, points: [[0, 0, 0], [10, 0, 0]], speed_mps: 1, loop: false, revision: phase === 'ACTIVE' ? '2' : '3' } }] });
const event = () => ({ phase, server_time: new Date().toISOString(), waiting_since: iso(-95), deadline_at: iso(-5),
  overdue, overdue_since: overdue ? iso(-5) : null,
  event: phase === 'ACTIVE' ? { id: eid, situation_id: situation().id, trigger_kind: 'LOCATION', started_at: iso(-1), situation: situation() } : null });
const iframe = `<!doctype html><html lang="ko"><body style="background:#b1cbbb"><p>Unity bridge fixture (no Unity runtime)</p><script>
const id=new URLSearchParams(location.search).get('bridge_id');window.received=[];
const emit=(type,extra={})=>parent.postMessage({channel:'simus-city',version:1,bridge_id:id,type,...extra},location.origin);
addEventListener('message',e=>{if(e.origin!==location.origin)return;received.push(e.data);if(e.data.type==='INIT')emit('BOUND',{session_id:e.data.session_id,npc_id:e.data.own_npc_id});if(e.data.type==='SET_ZOOM')emit('ZOOM_CHANGED',{zoom:e.data.zoom});});
setTimeout(()=>emit('READY',{map_version:${JSON.stringify(map)},camera_zoom:true}),0);
</script></body></html>`;
let page;
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 740 } });
  page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url()), pathname = url.pathname;
    let json;
    if (pathname === '/api/participants') json = { latest_session: null, history: [] };
    else if (pathname === '/api/sessions/current') json = { session: session() };
    else if (pathname.endsWith('/profile')) json = { joined: true, departments: [], profile: { character_id: 'fixture', glasses_id: 'none', nickname: '검증 시민', department_name: '디자인', department_id: 'fixture', mbti: 'INTJ', citizen_no: '001' } };
    else if (pathname.endsWith('/responses')) json = { session: session(), responses: answered ? [{ event_id: eid, situation_id: situation().id, choice_id: 'choice-a', received_at: iso(0) }] : [] };
    else if (pathname.endsWith('/event')) json = event();
    else if (pathname.endsWith('/npc')) json = snapshot();
    else if (pathname === '/api/city-state') json = { city_state: { session_id: sid, version: '1', happiness: 50, safety: 50, cleanliness: 50, overall_pollution: null } };
    else if (pathname === '/api/push/config') json = { public_key: null };
    else if (pathname.endsWith('/push-subscription')) json = { active_count: 0 };
    else if (pathname === '/api/choices') {
      submissions.push(route.request().postDataJSON());
      if (!failedChoice) { failedChoice = true; await route.fulfill({ status: 503, json: { error: { code: 'FIXTURE_RETRY', message: '일시적인 연결 오류입니다.' } } }); return; }
      answered = true; phase = 'WAITING'; overdue = false; json = { accepted: true };
    } else { unexpected.push(pathname); await route.abort(); return; }
    await route.fulfill({ json });
  });
  await page.route('**/city-rebuild-v002-phase1/build.json', route => route.fulfill({ json: { protocol_version: 1, map_version: map, npc_motion_enabled: true, path_versions: [pathVersion] } }));
  await page.route('**/city-rebuild-v002-phase1/index.html?*', route => route.fulfill({ contentType: 'text/html', body: iframe }));
  await page.goto(`${base}/participate`);
  await page.getByRole('heading', { name: '도시를 둘러보고 있어요', exact: true }).waitFor();
  await page.getByText('내 캐릭터를 따라가는 중', { exact: true }).waitFor();
  assert.equal(await page.getByRole('radio').count(), 0); checks.push('WAITING hides choices; bound bridge visible');
  const frameSrc = await page.locator('iframe').getAttribute('src');
  const refresh = () => page.evaluate(() => window.dispatchEvent(new Event('online')));
  phase = 'GUIDING'; await refresh();
  await page.getByRole('heading', { name: '이벤트 장소로 이동 중이에요', exact: true }).waitFor();
  assert.equal(await page.getByRole('radio').count(), 0); checks.push('GUIDING renders server state without activating choices (60s policy fixture, no wall-clock proof)');
  overdue = true; await refresh();
  await page.getByRole('heading', { name: '다음 장소 도착을 기다리고 있어요', exact: true }).waitFor();
  assert.equal(await page.getByRole('radio').count(), 0);
  await page.screenshot({ path: new URL('mobile-overdue-390.png', evidence).pathname.replace(/^\/(.:)/, '$1') });
  checks.push('90s overdue remains waiting; no forced card in UI');
  phase = 'ACTIVE'; await refresh();
  await page.getByRole('heading', { name: '길고양이에게 먹이를 주고 싶다', exact: true }).waitFor();
  assert.equal(await page.getByRole('radio').count(), 2);
  await refresh(); await page.waitForTimeout(2700);
  assert.equal(await page.getByRole('heading', { name: '길고양이에게 먹이를 주고 싶다', exact: true }).count(), 1);
  assert.equal(await page.locator('iframe').getAttribute('src'), frameSrc);
  const zoom = page.getByRole('button', { name: '캐릭터 화면 확대', exact: true });
  await zoom.click(); await page.getByRole('button', { name: '기본 배율로 되돌리기' }).filter({ hasText: '125%' }).waitFor();
  checks.push('Repeated ACTIVE poll yields one card; same iframe/bridge remains; zoom roundtrip succeeds');
  await page.getByRole('radio', { name: '먹이를 준다', exact: true }).check();
  await page.getByRole('button', { name: '선택 제출', exact: true }).click();
  await page.getByRole('button', { name: '같은 선택으로 다시 확인', exact: true }).waitFor();
  assert.equal(await page.getByRole('radio').first().isDisabled(), true);
  assert.ok(await page.evaluate(() => localStorage.getItem('simus_pending_choice_v1')));
  await page.screenshot({ path: new URL('mobile-retry-390.png', evidence).pathname.replace(/^\/(.:)/, '$1') });
  await page.getByRole('button', { name: '같은 선택으로 다시 확인', exact: true }).click();
  await page.getByText('1회 응답', { exact: true }).waitFor();
  await page.getByRole('heading', { name: '도시를 둘러보고 있어요', exact: true }).waitFor();
  assert.deepEqual(submissions[0], submissions[1]); assert.equal(submissions.length, 2);
  assert.equal(await page.evaluate(() => localStorage.getItem('simus_pending_choice_v1')), null);
  assert.equal(await page.locator('iframe').getAttribute('src'), frameSrc);
  checks.push('503 retry preserves identical event_id/choice_id/request_key; successful fixture response clears pending, resumes waiting with same bridge');
  answered = false; phase = 'ACTIVE'; longContent = true;
  await page.evaluate(() => localStorage.clear());
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 740 }); await page.reload();
    await page.getByRole('radio').first().waitFor(); await page.getByText('내 캐릭터를 따라가는 중', { exact: true }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}: horizontal overflow`);
    const city = await page.getByRole('region', { name: '내 캐릭터를 따라가는 도시' }).boundingBox();
    const summary = page.locator('summary').filter({ hasText: '도시에서 선택하기' });
    const panel = await summary.boundingBox(); assert.ok(city.y + city.height <= panel.y + 1, `${width}: city/panel overlap`);
    await summary.focus(); await page.keyboard.press('Enter'); assert.equal(await page.getByRole('radio').first().isVisible(), false);
    await page.keyboard.press('Enter'); await page.getByRole('radio').first().check();
    const submit = page.getByRole('button', { name: '선택 제출', exact: true }); await submit.scrollIntoViewIfNeeded();
    const rect = await submit.boundingBox(); assert.ok(rect.y >= 0 && rect.y + rect.height <= 741, `${width}: submit unreachable`);
    await page.screenshot({ path: new URL(`mobile-active-long-${width}.png`, evidence).pathname.replace(/^\/(.:)/, '$1') });
    checks.push(`${width}px long content: no horizontal overflow/overlap; keyboard panel toggle and submit reachable`);
  }
  phase = 'CLOSED'; longContent = false; await refresh();
  await page.getByRole('heading', { name: '이벤트 접수가 마감되었습니다', exact: true }).waitFor();
  assert.equal(await page.getByRole('radio').count(), 0); checks.push('CLOSED hides choices');
  assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
  await writeFile(new URL('mobile-fixture-result.json', evidence), JSON.stringify({ status: 'PASS_FIXTURE_ONLY', checks, pageErrors: errors, unexpectedApiRequests: unexpected, submissionRetries: submissions, limitations: ['No Unity runtime, collision or true camera following proof', 'No server position/event generation/stats/database proof', '60/90 server flags are mocked, not real timers'] }, null, 2));
  console.log(JSON.stringify({ status: 'PASS_FIXTURE_ONLY', checks }, null, 2));
} catch (error) {
  await writeFile(new URL('mobile-fixture-result.json', evidence), JSON.stringify({ status: 'FAIL_FIXTURE', checks, error: String(error), stack: error.stack, pageErrors: errors, unexpectedApiRequests: unexpected }, null, 2));
  throw error;
} finally { await browser.close(); }
