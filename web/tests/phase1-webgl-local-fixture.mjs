import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { defaultMotion } from '../src/lib/city-v002-graph.mjs';

// Serves the original Unity build directory directly. No Next/API/DB/deploy process.
const artifact = path.resolve(process.env.TEST_UNITY_ARTIFACT || '');
if (!process.env.TEST_UNITY_ARTIFACT) throw new Error('TEST_UNITY_ARTIFACT must name the completed local Unity build');
const manifest = JSON.parse(await readFile(path.join(artifact, 'build.json'), 'utf8'));
const evidence = new URL('../../docs/verification/phase1/', import.meta.url);
await mkdir(evidence, { recursive: true });
const sid = '11111111-1111-4111-8111-111111111111', npcId = '44444444-4444-4444-8444-444444444444';
const bridgeId = '55555555-5555-4555-8555-555555555555';
const motion = { ...defaultMotion(manifest.map_version), revision: '1', freeze_at: null };
assert.equal(motion.path_version, manifest.path_versions[0]);
let epoch;
function snapshot() {
  epoch ??= Date.now();
  const now = new Date().toISOString();
  return { session_id: sid, status: 'RUNNING', server_time: now, motion_time: now, freeze_at: new Date(epoch + 3600000).toISOString(), frozen: false,
    npcs: [{ npc_id: npcId, character_id: 'npc_01', glasses_id: 'square', epoch: new Date(epoch).toISOString(), motion }] };
}
const requested = [], unexpected = [];
const host = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>html,body,iframe{width:100%;height:100%;margin:0;border:0}#status{position:fixed;z-index:5;bottom:0;background:white;font:12px sans-serif}</style></head><body><iframe id="unity" src="/index.html?bridge_id=${bridgeId}"></iframe><p id="status">LOCAL ACTUAL UNITY + MOCK SNAPSHOT / NO DB</p><script>
window.bridgeEvents=[];window.lastSnapshot=null;const target=document.querySelector('iframe');
window.send=(type,fields={})=>target.contentWindow.postMessage({channel:'simus-city',version:1,bridge_id:${JSON.stringify(bridgeId)},type,...fields},location.origin);
async function update(type){const s=await(await fetch('/__fixture_snapshot')).json();window.lastSnapshot=s;send(type,{session_id:s.session_id,own_npc_id:s.npcs[0].npc_id,snapshot:s});}
addEventListener('message',async e=>{if(e.origin!==location.origin||e.source!==target.contentWindow)return;bridgeEvents.push(e.data);if(e.data.type==='READY'){await update('INIT');setInterval(()=>update('SNAPSHOT'),2500);}});
</script></body></html>`;
const mime = { '.js': 'application/javascript', '.wasm': 'application/wasm', '.json': 'application/json', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.data': 'application/octet-stream' };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1'); requested.push(url.pathname);
  res.setHeader('Cache-Control', 'no-store');
  const json = value => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); };
  if (url.pathname === '/__fixture_host') { res.setHeader('Content-Type', 'text/html'); res.end(host); return; }
  if (url.pathname === '/__fixture_snapshot' || url.pathname === `/api/sessions/${sid}/npcs`) { json(snapshot()); return; }
  if (url.pathname === '/api/city-state') { json({ city_state: { session_id: sid, version: '0', happiness: 50, safety: 50, cleanliness: 50, overall_pollution: null, regions: [] }, server_time: new Date().toISOString(), frozen: false }); return; }
  if (url.pathname.startsWith('/api/')) { unexpected.push(url.pathname); res.statusCode = 503; json({ error: 'Unexpected fixture API' }); return; }
  try {
    const file = path.resolve(artifact, '.' + decodeURIComponent(url.pathname));
    const relative = path.relative(artifact, file);
    if (relative.startsWith('..') || path.isAbsolute(relative) || !(await stat(file)).isFile()) throw new Error('Not a file');
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.statusCode = 404; res.end('Fixture file unavailable'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const { chromium } = await import(pathToFileURL(process.env.TEST_PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ headless: true, executablePath: process.env.TEST_CHROMIUM_EXECUTABLE, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pageErrors = [], consoleErrors = [], checks = [];
let details = {};
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 740 } });
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await page.goto(`${base}/__fixture_host`);
  await page.waitForFunction(() => window.bridgeEvents.some(e => e.type === 'BOUND'), null, { timeout: 240000 });
  const events = await page.evaluate(() => bridgeEvents);
  assert.ok(events.some(e => e.type === 'READY' && e.map_version === 'test-only-city-rebuild-v002-phase1-v1'));
  assert.ok(events.some(e => e.type === 'BOUND' && e.npc_id === '44444444-4444-4444-8444-444444444444'));
  checks.push('Actual artifact READY then BOUND with default CAMPUS_PLAZA graph motion');
  const unity = page.frames().find(f => f.url().includes('/index.html?'));
  await unity.waitForFunction(() => window.simusBridge?.inspect()?.following === true, null, { timeout: 20000 });
  const inspect = async () => { await unity.evaluate(() => simusBridge.inspect()); await page.waitForTimeout(300); return unity.evaluate(() => simusBridge.inspect()); };
  const start = await inspect(); await page.waitForTimeout(3500); const moved = await inspect();
  assert.ok(Math.hypot(...moved.position.map((n, i) => n - start.position[i])) > 1);
  assert.equal(moved.following, true); assert.equal(moved.active, true); assert.ok(moved.renderer_count > 0);
  checks.push('Actual Unity actor active/rendered, moving >1m, camera following');
  await page.evaluate(() => send('SET_ZOOM', { zoom: 1.25 }));
  await unity.waitForFunction(() => { const s = simusBridge.inspect(); return s?.zoom === 1.25 && Math.abs(s.camera_size - s.follow_size / 1.25) < .1; }, null, { timeout: 20000 });
  const zoomed = await inspect();
  checks.push('Actual camera zoom 1.25 applied and orthographic lens changed');
  await page.screenshot({ path: new URL('mobile-actual-webgl-390.png', evidence).pathname.replace(/^\/(.:)/, '$1') });
  await page.setViewportSize({ width: 1280, height: 800 }); await page.waitForTimeout(2000);
  await page.screenshot({ path: new URL('mobile-actual-webgl-1280.png', evidence).pathname.replace(/^\/(.:)/, '$1') });
  const finalEvents = await page.evaluate(() => bridgeEvents);
  assert.equal(finalEvents.filter(e => e.type === 'ERROR').length, 0);
  assert.deepEqual(pageErrors, []); assert.deepEqual(unexpected, []);
  details = { status: 'PASS_ACTUAL_UNITY_MOCK_SNAPSHOT_ONLY', artifact, manifest, checks, start, moved, zoomed, bridgeEvents: finalEvents, pageErrors, consoleErrors, unexpectedApiRequests: unexpected,
    limitations: ['No real Next.js/server/DB integration or stats proof', 'Environment NPC identity/count not exposed by bridge inspection; Editor QA required', 'Screenshots require separate visual review'] };
  console.log(JSON.stringify({ status: details.status, checks, pageErrors, consoleErrors }, null, 2));
} catch (error) {
  details = { status: 'FAIL_ACTUAL_UNITY_MOCK_SNAPSHOT', artifact, checks, error: String(error), stack: error.stack, pageErrors, consoleErrors, unexpectedApiRequests: unexpected };
  throw error;
} finally {
  await writeFile(new URL('mobile-actual-webgl-result.json', evidence), JSON.stringify(details, null, 2));
  await browser.close(); await new Promise(resolve => server.close(resolve));
}
