// Screenshot a comparison page. Source Unity captures remain untouched.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const modulePath = process.env.TEST_PLAYWRIGHT_MODULE;
if (!modulePath) throw new Error('Set TEST_PLAYWRIGHT_MODULE to playwright/index.mjs');
const { chromium } = await import(pathToFileURL(resolve(modulePath)).href);
const root = resolve('docs/verification/city-rebuild-v002-phase8-captures');
const output = resolve(root, 'comparison');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true,
  ...(process.env.TEST_CHROMIUM_EXECUTABLE ? { executablePath: process.env.TEST_CHROMIUM_EXECUTABLE } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 3840, height: 1140 }, deviceScaleFactor: 1 });
  const names = ['01-city','02-school','03-commercial','04-residential','05-park-river','06-npc-follow','07-apartment-follow'];
  for (const name of names) {
    const images = await Promise.all(['before','after'].map(async folder => 'data:image/png;base64,' + (await readFile(resolve(root, folder, name + '.png'))).toString('base64')));
    await page.setContent(`<style>html,body{margin:0;background:#17232a;color:white;font:24px system-ui}main{display:grid;grid-template-columns:1920px 1920px}header{height:60px;box-sizing:border-box;padding:14px 24px}img{display:block;width:1920px;height:1080px}</style><main><section><header>BEFORE · ${name} · Unity Game camera</header><img src="${images[0]}"></section><section><header>AFTER · ${name} · Unity Game camera</header><img src="${images[1]}"></section></main>`);
    await page.locator('img').evaluateAll(imgs => Promise.all(imgs.map(img => img.decode())));
    await page.screenshot({ path: resolve(output, name + '-comparison.png') });
  }
  await writeFile(resolve(output, 'README.md'), '# Phase 8 comparison images\n\nBrowser screenshots of the original Unity Game camera captures, displayed side by side at their native 1920×1080 resolution. Only the page labels and layout are added. Sources are the sibling before/ and after/ directories; no retouching or synthetic imagery.\n');
  console.log(`Rendered ${names.length} comparison pages at 3840×1140.`);
} finally { await browser.close(); }
