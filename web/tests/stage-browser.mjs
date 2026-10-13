import { runEventBrowser } from './event-browser.mjs';

// Stage browser checks now exercise server-issued events rather than the removed
// survey navigator and the retired Canvas NPC fixture. Admin lifecycle and
// finalized participant results remain covered by isolated-browser.mjs.
export async function runStageBrowser({ env, pool, token, templateId }) {
  if (!env.TEST_PLAYWRIGHT_MODULE) { console.log('SKIP: integrated event browser additions'); return; }
  return runEventBrowser({ pool, token, templateId,
    env: { ...env, TEST_EVENT_PLAYWRIGHT_MODULE: env.TEST_PLAYWRIGHT_MODULE } });
}
