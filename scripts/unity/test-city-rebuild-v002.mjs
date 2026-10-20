// Browser-only fixtures exercise the unchanged /participate UI. No real API/session writes.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
if (!process.env.TEST_PLAYWRIGHT_MODULE) throw Error('Set TEST_PLAYWRIGHT_MODULE');
const { chromium } = await import(pathToFileURL(process.env.TEST_PLAYWRIGHT_MODULE).href);
const base = process.env.TEST_V002_URL || 'http://127.0.0.1:3012';
const map = 'test-only-city-rebuild-v002-webgl-v1';
const session = { id: '10000000-0000-0000-0000-000000000001', name: 'TEST ONLY v002 map display', status: 'RUNNING', accepting_choices: true, situations: [] };
const npc = '20000000-0000-0000-0000-000000000001';
const epoch = new Date().toISOString();
const snapshot = () => {
  const now = new Date().toISOString();
  return { session_id: session.id, status: 'RUNNING', frozen: false, server_time: now, motion_time: now,
    freeze_at: new Date(Date.now() + 600000).toISOString(), npcs: [{ npc_id: npc, epoch, character_id: 'npc_01', glasses_id: 'none',
      motion: { map_version: map, path_version: 'test-only-unused-coordinates', points: [[0,0,0],[1,0,0]], speed_mps: 0, loop: false } }] };
};
const browser = await chromium.launch({ headless: true, executablePath: process.env.TEST_CHROMIUM_EXECUTABLE || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [], forbidden = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => { window.v002Messages = []; window.addEventListener('message', e => {
    if (e.data?.channel === 'simus-city') window.v002Messages.push(e.data);
  }); });
  await page.route('**/city/**', async route => {
    const name = new URL(route.request().url()).pathname.slice('/city/'.length);
    assert(!name.includes('..'));
    const response = await route.fetch({ url: `${base}/city-rebuild-v002-test/${name}` });
    assert.equal(response.status(), 200, name);
    await route.fulfill({ response });
  });
  await page.route('**/api/**', async route => {
    const p = new URL(route.request().url()).pathname;
    let json;
    if (p === '/api/participants') json = { latest_session: null, history: [] };
    else if (p === '/api/sessions/current') json = { session };
    else if (p.endsWith('/profile')) json = { joined: true, departments: [], profile: { nickname: 'WebGL TEST ONLY', character_id: 'npc_01', glasses_id: 'none', department_id: 'test', department_name: 'TEST', mbti: 'INTJ', citizen_no: 'TEST' } };
    else if (p.endsWith('/responses')) json = { session, responses: [] };
    else if (p.endsWith('/event')) json = { phase: 'WAITING', event: null };
    else if (p.endsWith('/npc')) json = snapshot();
    else if (p === '/api/push/config') json = { enabled: false };
    else if (p.endsWith('/push-subscription')) json = { subscribed: false };
    else if (p.endsWith('/npcs') || p === '/api/city-state') {
      if (route.request().frame().parentFrame()) forbidden.push(p);
      json = { city_state: null };
    }
    else json = {};
    await route.fulfill({ json });
  });
  await page.goto(`${base}/participate`);
  await page.waitForFunction(() => window.v002Messages.some(m => m.type === 'BOUND'), null, { timeout: 180000 });
  const frame = page.frameLocator('iframe[title="SIM:US 도시"]');
  await frame.locator('canvas').waitFor({ state: 'visible' });
  await page.waitForTimeout(8000); // Splash fade and Phase 8 acquisition.
  assert.equal(await page.locator('iframe[title="SIM:US 도시"]').evaluate(e => getComputedStyle(e).visibility), 'visible');
  const messages = await page.evaluate(() => window.v002Messages);
  assert.equal(messages.find(m => m.type === 'READY').map_version, map);
  assert.equal(messages.find(m => m.type === 'BOUND').npc_id, npc);
  assert(!messages.some(m => m.type === 'ERROR'));
  await page.screenshot({ path: '/tmp/simus-v002-participate-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/simus-v002-participate-mobile.png' });
  assert.deepEqual(forbidden, [], 'Map-only bridge must not poll city or crowd');
  assert.deepEqual(errors, []);
  // An actual legacy map binding must still be rejected by the Unity state machine.
  await page.evaluate(s => {
    s.npcs[0].motion.map_version = 'dev-synthetic-v1';
    const ready = window.v002Messages.find(m => m.type === 'READY');
    document.querySelector('iframe').contentWindow.postMessage({ channel: 'simus-city', version: 1,
      bridge_id: ready.bridge_id, type: 'SNAPSHOT', session_id: s.session_id, own_npc_id: s.npcs[0].npc_id, snapshot: s }, location.origin);
  }, snapshot());
  await page.waitForFunction(() => window.v002Messages.some(m => m.type === 'ERROR'));
  console.log('PASS unchanged /participate + actual v002 WebGL: READY/BOUND, desktop/mobile visible canvas, no page errors, no crowd/city polling, legacy map rejected. Browser fixtures only; NPC movement NOT tested.');
} finally { await browser.close(); }
