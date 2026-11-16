import test from 'node:test';
import assert from 'node:assert/strict';
import { participantMotion } from '../src/lib/participant-npc-motion.ts';
import { defaultMotion, LEGACY_MAP_VERSION, MAP_VERSION, isGraphSegment } from '../src/lib/city-v002-graph.mjs';

for (const version of [LEGACY_MAP_VERSION, MAP_VERSION]) test(`${version}: individual routes stay on the pedestrian graph and survive rejoin`, () => {
  const original = defaultMotion(version), saved = structuredClone(original);
  const routes = Array.from({length: 32}, (_, i) => participantMotion(original, `session:participant-${i}`));
  assert.equal(new Set(routes.map(m => JSON.stringify(m.points))).size, routes.length);
  assert.equal(new Set(routes.map(m => JSON.stringify(m.points[0]))).size, routes.length);
  for (const [i, motion] of routes.entries()) {
    assert.deepEqual(motion, participantMotion(original, `session:participant-${i}`));
    assert.equal(motion.map_version, original.map_version);
    assert.equal(motion.path_version, original.path_version);
    assert.equal(motion.speed_mps, original.speed_mps);
    assert.ok(motion.points.length >= 2 && motion.points.length <= 2048);
    const closed = [...motion.points, motion.points[0]];
    for (let j = 1; j < closed.length; j++) assert.ok(isGraphSegment(closed[j-1], closed[j], version));
  }
  assert.deepEqual(original, saved);
  assert.notDeepEqual(participantMotion(original,'other-session:participant-0'), routes[0]);
});

test('explicit non-loop, stationary and unsupported map routes retain their authored behavior', () => {
  const original = defaultMotion();
  for (const motion of [{...original,loop:false},{...original,speed_mps:0},{...original,map_version:'synthetic-only'}])
    assert.deepEqual(participantMotion(motion,'participant'), motion);
});
