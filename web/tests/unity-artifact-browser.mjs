// Real hosted Unity runtimes; no intercepted requests, API fixtures or database.
// Round creation/NPC synchronization is covered separately by v002-session-browser.mjs.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readLock } from '../scripts/unity-artifact.mjs';

if (!process.env.TEST_PLAYWRIGHT_MODULE || !process.env.TEST_API_URL) throw Error('Set TEST_PLAYWRIGHT_MODULE and TEST_API_URL');
const { chromium } = await import(pathToFileURL(process.env.TEST_PLAYWRIGHT_MODULE).href);
const lock = await readLock();
const artifacts = process.env.TEST_ARTIFACT_DIR || '/tmp/simus-phase2b-browser';
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.TEST_CHROMIUM_EXECUTABLE || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const [base, build] of Object.entries(lock.builds)) {
    if (base === 'unity-preview') {
      await page.goto(`${process.env.TEST_API_URL}/unity`);
      await page.getByText('캐릭터를 따라가는 중', { exact: true }).waitFor({ timeout: 180_000 });
    } else {
      await page.goto(`${process.env.TEST_API_URL}/`);
      const ready = await page.evaluate(({ base }) => new Promise((resolve, reject) => {
        const id = crypto.randomUUID(), frame = document.createElement('iframe');
        frame.title = 'Artifact runtime check';
        frame.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;z-index:999';
        const timeout = setTimeout(() => reject(Error('Unity READY timeout')), 180_000);
        window.addEventListener('message', event => {
          const message = event.data;
          if (event.origin !== location.origin || event.source !== frame.contentWindow || message?.bridge_id !== id || message?.channel !== 'simus-city') return;
          if (message.type === 'ERROR') { clearTimeout(timeout); reject(Error(JSON.stringify(message))); }
          if (message.type === 'READY') { clearTimeout(timeout); resolve(message); }
        });
        frame.src = `/${base}/index.html?bridge_id=${id}`;
        document.body.append(frame);
      }), { base });
      assert.equal(ready.map_version, build.map_version);
    }
    const frame = page.frames().find(item => item.url().includes(`/${base}/index.html`));
    assert.ok(frame, `${base}: real iframe loaded`);
    assert.equal(await frame.locator('canvas').count(), 1);
    await page.waitForTimeout(6000); // Wait for Unity startup splash to fade.
    await page.screenshot({ path: path.join(artifacts, `${base}.png`) });
    console.log(`PASS real WebGL READY + canvas: /${base} (${build.map_version})`);
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
