import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

if (!process.env.TEST_PLAYWRIGHT_MODULE) throw new Error('Set TEST_PLAYWRIGHT_MODULE to playwright/index.mjs');
const { chromium } = await import(pathToFileURL(process.env.TEST_PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ headless: true, executablePath: process.env.TEST_CHROMIUM_EXECUTABLE || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const base = process.env.TEST_API_URL || 'http://127.0.0.1:3124';
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  if (process.env.TEST_PREVIEW_MISSING === '1') {
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`${base}/unity`);
      await page.getByRole('region', { name: 'Unity 도시 미리보기' }).getByRole('alert').waitFor();
      assert.equal(await page.locator('iframe').count(), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.getByRole('button', { name: '다시 연결', exact: true }).click();
      await page.getByRole('region', { name: 'Unity 도시 미리보기' }).getByRole('alert').waitFor();
    }
    assert.deepEqual(errors, []);
    console.log('PASS missing Unity build: mobile/desktop error, retry, no iframe/overflow/page errors. Actual runtime not tested.');
    process.exitCode = 0;
  } else {
  const manifest = await page.request.get(`${base}/unity-preview/build.json`);
  assert.equal(manifest.status(), 200);
  assert.equal((await manifest.json()).kind, 'npc-follow-preview');
  assert.match(manifest.headers()['cache-control'], /no-cache/);
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${base}/unity`);
    await page.getByText('캐릭터를 따라가는 중', { exact: true }).waitFor({ timeout: 180000 });
    const frame = page.frameLocator('iframe');
    assert.equal(await frame.locator('canvas').count(), 1);
    // createUnityInstance resolves before the startup splash has faded.
    await page.waitForTimeout(6000);
    assert.equal(await page.getByRole('region', { name: 'Unity 도시 미리보기' }).getAttribute('aria-busy'), 'false');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `/tmp/simus-unity-preview-${width}.png` });
  }
  await page.getByRole('button', { name: '도시 다시 불러오기' }).click();
  await page.getByText('캐릭터를 따라가는 중', { exact: true }).waitFor({ timeout: 180000 });
  await page.route('**/unity-preview/build.json', route => route.fulfill({ status: 404, body: '' }));
  await page.reload();
  await page.getByRole('region', { name: 'Unity 도시 미리보기' }).getByRole('alert').waitFor();
  assert.equal(await page.locator('iframe').count(), 0);
  await page.unroute('**/unity-preview/build.json');
  await page.getByRole('button', { name: '다시 연결', exact: true }).click();
  await page.getByText('캐릭터를 따라가는 중', { exact: true }).waitFor({ timeout: 180000 });
  assert.deepEqual(errors, []);
  console.log('PASS actual Unity WebGL /unity: mobile/desktop canvas, READY, no overflow, reload, missing build/retry, cache headers, no page errors.');
  }
} finally { await browser.close(); }
