import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { npcPosition } from '../src/app/participate/npc-motion.ts';

export async function runNpcPositionIntegration({ pool, env, token, templateId }) {
  // Exact centerline parity fixtures: corners, closing segment, clamp, zero speed,
  // repeated points, negative elapsed time and deterministic ID-independent position.
  const epoch = '2026-01-01T00:00:00.000Z', start = Date.parse(epoch);
  const shape = { npc_id: 'ffffffff-0000-0000-0000-000000000000', epoch,
    motion: { map_version: 'unit-only', path_version: 'unit-only', points: [[0,0,0],[0,0,0],[10,0,0],[10,0,10]], speed_mps: 1, loop: true } };
  assert.deepEqual(npcPosition(shape, start - 1000), [0,0,0]);
  assert.deepEqual(npcPosition(shape, start + 15000), [10,0,5]);
  assert.deepEqual(npcPosition(shape, start + (20 + Math.sqrt(50)) * 1000).map(x => Math.round(x)), [5,0,5]);
  assert.deepEqual(npcPosition({ ...shape, motion: { ...shape.motion, loop: false } }, start + 50000), [10,0,10]);
  assert.deepEqual(npcPosition({ ...shape, motion: { ...shape.motion, speed_mps: 0 } }, start + 50000), [0,0,0]);
  const route = { map_version: 'sync-test-only', path_version: 'polyline-v1', points: [[0,0,0],[10,0,0],[10,0,10]], speed_mps: 2, loop: true };
  async function call(path, { method = 'GET', data, cookie, admin = false, origin } = {}) {
    const r = await fetch(env.TEST_API_URL + path, { method, headers: {
      ...(cookie ? { cookie } : {}), ...(admin ? { authorization: `Bearer ${token}` } : {}),
      ...(data ? { 'content-type': 'application/json' } : {}), ...(origin ? { origin } : {}) },
      body: data ? JSON.stringify(data) : undefined });
    return { status: r.status, body: await r.json(), cookie: r.headers.get('set-cookie')?.split(';')[0], cache: r.headers.get('cache-control') };
  }
  async function create() {
    const r = await call('/api/admin/sessions', { method: 'POST', admin: true, data: { template_session_id: templateId, name: 'NPC position test', duration_seconds: 300, impact_scale: 0.1, request_key: randomUUID() } });
    assert.equal(r.status, 201);
    // Remove the isolated runner's fixture only; production sessions start with NULL.
    await pool.query('UPDATE simus.simulation_sessions SET npc_motion=NULL WHERE id=$1', [r.body.session_id]);
    return r.body.session_id;
  }
  const sid = await create(), adminPath = `/api/admin/sessions/${sid}/npc-motion`, positions = `/api/sessions/${sid}/npc-positions`;
  assert.equal((await call(adminPath, { method: 'PUT', data: route })).status, 401);
  assert.equal((await call(adminPath, { method: 'PUT', admin: true, data: route, origin: 'https://foreign.invalid' })).status, 403);
  for (const invalid of [{ ...route, points: [[0,0,0],[0,0,0]] }, { ...route, speed_mps: -1 }, { ...route, map_version: 'bad version' }, { ...route, points: [[1,2],[3,4]] }])
    assert.equal((await call(adminPath, { method: 'PUT', admin: true, data: invalid })).status, 400);
  assert.equal((await call(adminPath, { method: 'PUT', admin: true, data: route })).status, 200);
  assert.equal((await call(`${positions}?map_version=${route.map_version}`)).status, 404); // DRAFT privacy
  assert.equal((await call(`/api/admin/sessions/${sid}/start`, { method: 'POST', admin: true, data: { request_key: randomUUID() } })).status, 200);
  assert.equal((await call(adminPath, { method: 'PUT', admin: true, data: route })).body.error.code, 'NPC_MOTION_LOCKED');
  assert.equal((await call(positions)).status, 400);
  assert.equal((await call(`${positions}?map_version=wrong`)).body.error.code, 'NPC_MAP_MISMATCH');
  assert.deepEqual((await call(`${positions}?map_version=${route.map_version}`)).body.npcs, []);
  const participant = await call('/api/participants', { method: 'POST' });
  assert.equal((await call(`/api/sessions/${sid}/join`, { method: 'POST', cookie: participant.cookie })).status, 201);
  const snapshot = await call(`${positions}?map_version=${route.map_version}&path_version=${route.path_version}`);
  assert.equal(snapshot.status, 200); assert.equal(snapshot.cache, 'no-store');
  const npc = snapshot.body.npcs[0];
  assert.deepEqual(npc.motion, route);
  const elapsed = Math.max(0, (Date.parse(snapshot.body.motion_time) - Date.parse(npc.epoch)) / 1000);
  assert.ok(Math.abs(npc.position.x - elapsed * 2) < 0.003);
  assert.equal(npc.position.y, 0); assert.equal(npc.position.z, 0);
  assert.deepEqual(npc.forward, { x: 1, y: 0, z: 0 });
  assert.equal('participant_id' in npc, false);
  assert.equal((await call(`${positions}?map_version=${route.map_version}&path_version=wrong`)).status, 409);
  assert.equal((await call(`/api/admin/sessions/${sid}/end`, { method: 'POST', admin: true, data: { request_key: randomUUID() } })).status, 200);
  const frozen = (await call(`${positions}?map_version=${route.map_version}`)).body;
  const again = (await call(`${positions}?map_version=${route.map_version}`)).body;
  assert.equal(frozen.frozen, true); assert.deepEqual(frozen.npcs, again.npcs); assert.equal(frozen.motion_time, again.motion_time);
  const missing = await create();
  await call(`/api/admin/sessions/${missing}/start`, { method: 'POST', admin: true, data: { request_key: randomUUID() } });
  assert.equal((await call(`/api/sessions/${missing}/join`, { method: 'POST', cookie: participant.cookie })).body.error.code, 'NPC_MOTION_NOT_CONFIGURED');
  assert.equal((await call(`/api/sessions/${missing}/npc-positions?map_version=anything`)).body.error.code, 'NPC_MOTION_NOT_CONFIGURED');
  assert.equal((await pool.query('SELECT count(*) FROM simus.participant_sessions WHERE session_id=$1', [missing])).rows[0].count, '0');
  await call(`/api/admin/sessions/${missing}/end`, { method: 'POST', admin: true, data: { request_key: randomUUID() } });
  console.log('PASS: map-scoped canonical NPC positions, auth/validation, route immutability, freeze, pending-map join rejection');
}
