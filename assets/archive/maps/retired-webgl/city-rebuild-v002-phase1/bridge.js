/* Same-origin iframe transport. Runtime owns session/NPC/map validation. */
(function (root) {
  'use strict';
  function createBridge(win, canvas) {
    const id = new URL(win.location.href).searchParams.get('bridge_id');
    const valid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '') && win.parent !== win;
    let instance, readyMap, desiredVisibility, inspection, stopped = false, readySent = false;
    let zoom = 1, supportsZoom = false, bound = false, pinchDistance = 0;
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
      canvas.removeEventListener('wheel', wheel);
      canvas.removeEventListener('touchstart', touchStart);
      canvas.removeEventListener('touchmove', touchMove);
      canvas.removeEventListener('touchend', touchEnd);
      canvas.removeEventListener('touchcancel', touchEnd);
      if (instance) {
        try { instance.SendMessage('SIMUS Web Bridge', 'DisposeBridge'); } catch (_) {}
        Promise.resolve(instance.Quit()).catch(() => {});
        instance = null;
      }
    }
    function fatal() { error('RUNTIME_FAILURE'); dispose(); }
    function lost(event) { event.preventDefault(); error('CONTEXT_LOST'); dispose(); }
    function setZoom(value) {
      if (!bound || !supportsZoom || stopped || !Number.isFinite(value)) return;
      zoom = Math.min(4, Math.max(.5, value));
      try {
        instance.SendMessage('SIMUS Web Bridge', 'SetZoom', String(zoom));
        send('ZOOM_CHANGED', { zoom });
      } catch (_) { fatal(); }
    }
    function wheel(event) {
      if (!bound || !supportsZoom || stopped) return;
      event.preventDefault();
      const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1);
      setZoom(zoom * Math.exp(-Math.max(-100, Math.min(100, pixels)) * .002));
    }
    function distance(touches) {
      return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    }
    function touchStart(event) {
      pinchDistance = 0;
      if (event.touches.length !== 2 || !bound || !supportsZoom || stopped) return;
      event.preventDefault();
      pinchDistance = distance(event.touches);
    }
    function touchMove(event) {
      if (event.touches.length !== 2 || !bound || !supportsZoom || stopped) return;
      event.preventDefault();
      const next = distance(event.touches);
      if (pinchDistance > 0) setZoom(zoom * next / pinchDistance);
      pinchDistance = next;
    }
    function touchEnd() { pinchDistance = 0; }
    function receive(event) {
      const m = event.data;
      if (stopped || !valid || event.origin !== win.location.origin || event.source !== win.parent || !m || typeof m !== 'object' || Array.isArray(m) || m.channel !== 'simus-city' || m.version !== 1 || m.bridge_id !== id) return;
      if (m.type === 'DISPOSE') { dispose(); return; }
      if (m.type === 'SET_ZOOM') { setZoom(m.zoom); }
      else if (m.type === 'VISIBILITY') {
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
        send('READY', { map_version: readyMap, camera_zoom: supportsZoom });
      }
    }
    win.addEventListener('message', receive);
    win.addEventListener('pagehide', dispose);
    win.addEventListener('error', fatal);
    win.addEventListener('unhandledrejection', fatal);
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('wheel', wheel, { passive: false });
    canvas.addEventListener('touchstart', touchStart, { passive: false });
    canvas.addEventListener('touchmove', touchMove, { passive: false });
    canvas.addEventListener('touchend', touchEnd);
    canvas.addEventListener('touchcancel', touchEnd);
    return {
      inspect() { if (instance && readySent && !stopped) instance.SendMessage('SIMUS Web Bridge', 'InspectBridge'); return inspection; },
      attach(value) { if (stopped || !valid) { value.Quit(); return; } instance = value; maybeReady(); },
      runtime(json) {
        if (stopped) return;
        try {
          const m = JSON.parse(json);
          if (m.type === 'READY') { readyMap = m.map_version; supportsZoom = m.camera_zoom === true; maybeReady(); }
          else if (m.type === 'BOUND' && readySent) { bound = true; send('BOUND', { session_id: m.session_id, npc_id: m.npc_id }); }
          else if (m.type === 'ERROR') error(m.code || 'RUNTIME_FAILURE');
          else if (m.type === 'INSPECTION') inspection = m;
        } catch (_) { fatal(); }
      },
      error, dispose, valid
    };
  }
  if (typeof module !== 'undefined') module.exports = { createBridge };
  else root.createSimusBridge = createBridge;
})(typeof window === 'undefined' ? globalThis : window);
