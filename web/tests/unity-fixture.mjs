// Protocol-only test double. This does not verify Unity rendering or a real map.
export async function installUnityFixture(page) {
  let mapVersion;
  await page.route('**/city/build.json', async route => {
    const current = await (await page.request.get(new URL('/api/sessions/current', page.url()).href)).json();
    const own = await (await page.request.get(new URL(`/api/sessions/${current.session.id}/npcs`, page.url()).href)).json();
    mapVersion = own.npcs[0].motion.map_version;
    await route.fulfill({ json: { protocol_version: 1, map_version: mapVersion } });
  });
  await page.route('**/city/index.html?*', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><body><p id="npc"></p><script>
    const base = { channel: 'simus-city', version: 1, bridge_id: new URLSearchParams(location.search).get('bridge_id') };
    addEventListener('message', event => {
      const m = event.data;
      if (event.origin !== location.origin || event.source !== parent || m.bridge_id !== base.bridge_id) return;
      if (m.type === 'INIT') {
        document.getElementById('npc').textContent = m.own_npc_id;
        parent.postMessage({ ...base, type: 'BOUND', session_id: m.session_id, npc_id: m.own_npc_id }, location.origin);
      }
    });
    parent.postMessage({ ...base, type: 'READY', map_version: ${JSON.stringify(mapVersion)} }, location.origin);
  </script></body></html>` }));
}
