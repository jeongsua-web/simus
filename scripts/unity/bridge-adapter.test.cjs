const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createBridge } = require('../../unity/Assets/WebGLTemplates/simus_city/bridge.js');
const id = '10000000-0000-0000-0000-000000000001';
function setup() {
  const listeners = new Map(), events = [], calls = [];
  const win = { location: { href: `https://simus.test/city/?bridge_id=${id}`, origin: 'https://simus.test' }, parent: { postMessage: (...v) => events.push(v) }, addEventListener: (k,v) => listeners.set(k,v), removeEventListener: k => listeners.delete(k) };
  const canvas = { addEventListener: (k,v) => listeners.set(k,v), removeEventListener: k => listeners.delete(k) };
  const instance = { SendMessage: (...v) => calls.push(v), Quit: () => calls.push(['Quit']) };
  const bridge = createBridge(win, canvas);
  const receive = (data, overrides = {}) => listeners.get('message')?.({ origin: win.location.origin, source: win.parent, data: { channel: 'simus-city', version: 1, bridge_id: id, ...data }, ...overrides });
  return { bridge, win, instance, events, calls, listeners, receive };
}
test('READY requires both runtime receiver and resolved instance in either order', () => {
  for (const first of ['runtime','instance']) {
    const t = setup();
    const ready = () => t.bridge.runtime(JSON.stringify({ type: 'READY', map_version: 'test-only-bridge-v1' }));
    if (first === 'runtime') ready(); else t.bridge.attach(t.instance);
    assert.equal(t.events.length, 0);
    if (first === 'runtime') t.bridge.attach(t.instance); else ready();
    ready();
    assert.equal(t.events.length, 1);
    assert.equal(t.events[0][0].type, 'READY');
    assert.equal(t.events[0][1], 'https://simus.test');
  }
});
test('origin/source/channel/version/bridge filtering and lifecycle', () => {
  const t = setup(); t.bridge.attach(t.instance);
  t.bridge.runtime('{"type":"READY","map_version":"test-only-bridge-v1"}');
  t.receive({type:'INIT'}, {origin:'https://evil.test'});
  t.receive({type:'INIT'}, {source:{}});
  for (const bad of [{channel:'wrong'}, {version:2}, {bridge_id:'old'}]) t.receive({type:'INIT', ...bad});
  assert.equal(t.calls.length,0);
  t.receive({type:'INIT', session_id:'session'}); t.receive({type:'SNAPSHOT'});
  t.receive({type:'VISIBILITY',visible:false}); t.receive({type:'VISIBILITY',visible:true});
  assert.equal(t.calls.length,4);
  t.bridge.runtime('{"type":"BOUND","session_id":"session","npc_id":"own"}');
  assert.equal(t.events.at(-1)[0].type,'BOUND');
  t.receive({type:'DISPOSE'});
  assert.equal(t.listeners.size,0);
  assert.equal(t.calls.at(-1)[0],'Quit');
  const count=t.events.length; t.bridge.runtime('{"type":"ERROR"}'); assert.equal(t.events.length,count);
});
test('dispose while loading quits late instance; context loss reports error and cleans up', () => {
  const t=setup(); t.receive({type:'DISPOSE'}); t.bridge.attach(t.instance);
  assert.deepEqual(t.calls,[['Quit']]);
  const u=setup(); u.bridge.attach(u.instance);
  u.listeners.get('webglcontextlost')({preventDefault(){}});
  assert.equal(u.events[0][0].code,'CONTEXT_LOST'); assert.equal(u.listeners.size,0);
});
test('visibility received while loading is applied before READY', () => {
  const t=setup(); t.receive({type:'VISIBILITY',visible:false});
  t.bridge.attach(t.instance); t.bridge.runtime('{"type":"READY","map_version":"test-only-bridge-v1"}');
  assert.deepEqual(t.calls,[['SIMUS Web Bridge','SetVisibility','false']]);
});
test('zoom requires capability and binding, filters messages, clamps gestures and cleans up', () => {
  const t = setup(); t.bridge.attach(t.instance);
  t.bridge.runtime('{"type":"READY","map_version":"test-map","camera_zoom":true}');
  t.receive({type:'SET_ZOOM',zoom:2});
  assert.equal(t.calls.length,0);
  t.bridge.runtime('{"type":"BOUND","session_id":"s","npc_id":"n"}');
  for (const zoom of [NaN, Infinity, '2', null]) t.receive({type:'SET_ZOOM',zoom});
  t.receive({type:'SET_ZOOM',zoom:2}, {origin:'https://evil.test'});
  assert.equal(t.calls.length,0);
  t.receive({type:'SET_ZOOM',zoom:100});
  assert.deepEqual(t.calls.at(-1),['SIMUS Web Bridge','SetZoom','4']);
  t.receive({type:'SET_ZOOM',zoom:-5});
  assert.equal(t.events.at(-1)[0].zoom,.5);
  t.receive({type:'SET_ZOOM',zoom:1});
  let prevented = false;
  t.listeners.get('wheel')({deltaY:-100,deltaMode:0,preventDefault(){prevented=true;}});
  assert.ok(prevented); assert.ok(t.events.at(-1)[0].zoom>1);
  t.receive({type:'SET_ZOOM',zoom:1});
  const touch = gap => ({touches:[{clientX:0,clientY:0},{clientX:gap,clientY:0}],preventDefault(){}});
  t.listeners.get('touchstart')(touch(100)); t.listeners.get('touchmove')(touch(200));
  assert.equal(t.events.at(-1)[0].zoom,2);
  t.listeners.get('touchcancel')(); t.listeners.get('touchmove')(touch(50));
  assert.equal(t.events.at(-1)[0].zoom,2);
  t.receive({type:'DISPOSE'}); assert.equal(t.listeners.size,0);
  const old = setup(); old.bridge.attach(old.instance);
  old.bridge.runtime('{"type":"READY","map_version":"old-map"}');
  old.bridge.runtime('{"type":"BOUND","session_id":"s","npc_id":"n"}');
  old.receive({type:'SET_ZOOM',zoom:2});
  assert.equal(old.calls.length,0);
});
