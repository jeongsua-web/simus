/* Same-origin iframe transport. Runtime owns session/NPC/map validation. */
(function (root) {
  'use strict';
  function createBridge(win, canvas) {
    const id = new URL(win.location.href).searchParams.get('bridge_id');
    const valid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '') && win.parent !== win;
    let instance, readyMap, desiredVisibility, stopped = false, readySent = false;
    const send = (type, fields = {}) => {
      if (valid && !stopped) win.parent.postMessage({ ...fields, channel: 'simus-city', version: 1, bridge_id: id, type }, win.location.origin);
    };
    const error = code => send('ERROR', { code });
    function dispose() {
      if (stopped) return;
      stopped = true;
      win.removeEventListener('message', receive);
      win.removeEventListener('pagehide', dispose);
      win.removeEventListener('error', fatal);
      win.removeEventListener('unhandledrejection', fatal);
      canvas.removeEventListener('webglcontextlost', lost);
      if (instance) {
        try { instance.SendMessage('SIMUS Web Bridge', 'DisposeBridge'); } catch (_) {}
        Promise.resolve(instance.Quit()).catch(() => {});
        instance = null;
      }
    }
    function fatal() { error('RUNTIME_FAILURE'); dispose(); }
    function lost(event) { event.preventDefault(); error('CONTEXT_LOST'); dispose(); }
    function receive(event) {
      const m = event.data;
      if (stopped || !valid || event.origin !== win.location.origin || event.source !== win.parent || !m || typeof m !== 'object' || Array.isArray(m) || m.channel !== 'simus-city' || m.version !== 1 || m.bridge_id !== id) return;
      if (m.type === 'DISPOSE') { dispose(); return; }
      if (m.type === 'VISIBILITY') {
        if (typeof m.visible !== 'boolean') { error('INVALID_VISIBILITY'); return; }
        desiredVisibility = m.visible;
        if (readySent) instance.SendMessage('SIMUS Web Bridge', 'SetVisibility', m.visible ? 'true' : 'false');
      } else if (readySent && (m.type === 'INIT' || m.type === 'SNAPSHOT')) {
        try { instance.SendMessage('SIMUS Web Bridge', 'Receive', JSON.stringify(m)); }
        catch (_) { fatal(); }
      }
    }
    function maybeReady() {
      if (instance && readyMap && !readySent && !stopped) {
        readySent = true;
        if (desiredVisibility !== undefined) instance.SendMessage('SIMUS Web Bridge', 'SetVisibility', desiredVisibility ? 'true' : 'false');
        send('READY', { map_version: readyMap });
      }
    }
    win.addEventListener('message', receive);
    win.addEventListener('pagehide', dispose);
    win.addEventListener('error', fatal);
    win.addEventListener('unhandledrejection', fatal);
    canvas.addEventListener('webglcontextlost', lost);
    return {
      attach(value) { if (stopped || !valid) { value.Quit(); return; } instance = value; maybeReady(); },
      runtime(json) {
        if (stopped) return;
        try {
          const m = JSON.parse(json);
          if (m.type === 'READY') { readyMap = m.map_version; maybeReady(); }
          else if (m.type === 'BOUND' && readySent) send('BOUND', { session_id: m.session_id, npc_id: m.npc_id });
          else if (m.type === 'ERROR') error(m.code || 'RUNTIME_FAILURE');
        } catch (_) { fatal(); }
      },
      error, dispose, valid
    };
  }
  if (typeof module !== 'undefined') module.exports = { createBridge };
  else root.createSimusBridge = createBridge;
})(typeof window === 'undefined' ? globalThis : window);
