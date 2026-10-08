import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readUnityEvent, matchesOwnSnapshot } from '../src/app/participate/unity-bridge.ts';

const ready = { channel: 'simus-city', version: 1, bridge_id: 'attempt-1', type: 'READY', map_version: 'test-map' };
test('rejects messages from old attempts, incompatible protocols, and malformed events', () => {
  assert.equal(readUnityEvent(ready, 'attempt-1')?.type, 'READY');
  for (const input of [null, {}, { ...ready, version: 2 }, { ...ready, channel: 'other' }, { ...ready, map_version: null }, { ...ready, type: 'BOUND' }]) {
    assert.equal(readUnityEvent(input, 'attempt-1'), null);
  }
  assert.equal(readUnityEvent(ready, 'attempt-2'), null);
});
const snapshot = { session_id: 'session-1', status: 'RUNNING', server_time: '2026-10-09T00:00:00Z', freeze_at: '2026-10-09T01:00:00Z', motion_time: '2026-10-09T00:00:00Z', frozen: false,
  npcs: [{ npc_id: 'npc-1', epoch: '2026-10-09T00:00:00Z', motion: { map_version: 'test-map', path_version: 'test-path', points: [[0,0,0],[1,0,1]], speed_mps: 1, loop: true } }] };
test('refuses wrong session/map and invalid or ambiguous own-NPC data', () => {
  assert.ok(matchesOwnSnapshot(snapshot, 'session-1', 'test-map'));
  assert.equal(matchesOwnSnapshot(snapshot, 'session-2', 'test-map'), false);
  assert.equal(matchesOwnSnapshot(snapshot, 'session-1', 'other-map'), false);
  for (const input of [null, {}, { ...snapshot, npcs: [] }, { ...snapshot, npcs: [...snapshot.npcs, ...snapshot.npcs] }, { ...snapshot, freeze_at: 'invalid' }, { ...snapshot, npcs: [{ ...snapshot.npcs[0], motion: { ...snapshot.npcs[0].motion, points: [[0,0,0],[NaN,0,0]] } }] }]) {
    assert.equal(matchesOwnSnapshot(input, 'session-1', 'test-map'), false);
  }
});
