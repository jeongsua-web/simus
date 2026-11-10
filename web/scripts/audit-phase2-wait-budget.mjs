// Read-only feasibility audit. Lower bounds assume immediate shortest-path
// guidance, no polling delay and no stops; they cannot certify a 90s maximum.
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { eventManifest } from '../src/lib/city-v002-event-mapping.mjs';
import { pedestrianGraph, graphDistanceTo, defaultMotion, routeBetween, pathLength } from '../src/lib/city-v002-graph.mjs';

const ready = eventManifest.events.filter(row => row.status === 'READY');
const speed = defaultMotion().speed_mps;
const fields = ready.map(row => ({ row, distance: graphDistanceTo(row.event_location.point) }));
const candidates = point => fields.map(({ row, distance }) => ({
  code: row.code, place_id: row.place_id,
  distance_to_radius_m: Math.max(0, distance(point) - row.event_location.radius_m),
})).sort((a, b) => a.distance_to_radius_m - b.distance_to_radius_m);
const nodes = pedestrianGraph.nodes.map(node => ({ node_id: node.id, point: node.position,
  nearest: candidates(node.position)[0] })).sort((a, b) => b.nearest.distance_to_radius_m - a.nearest.distance_to_radius_m);
const remaining = fields.map(({ row, distance }) => {
  const worst = pedestrianGraph.nodes.map(node => ({ node_id: node.id, point: node.position,
    distance_to_radius_m: Math.max(0, distance(node.position) - row.event_location.radius_m),
  })).sort((a, b) => b.distance_to_radius_m - a.distance_to_radius_m)[0];
  return { code: row.code, place_id: row.place_id, worst,
    immediate_guidance_lower_bound_seconds: worst.distance_to_radius_m / speed };
});
const nearest = ready.find(row => row.code === nodes[0].nearest.code);
const witnessRoute = routeBetween(nodes[0].point, nearest.event_location.point);
assert.ok(Math.abs(pathLength(witnessRoute) - nearest.event_location.radius_m - nodes[0].nearest.distance_to_radius_m) < 1e-6,
  'Distance-field counterexample must agree with the actual route');
const report = {
  created_at: new Date().toISOString(), map_version: eventManifest.map_version,
  scope: 'Authored graph nodes, all READY places or one remaining unanswered place; static lower bounds only',
  default_speed_mps: speed, guidance_delay_seconds: 60, requested_maximum_seconds: 90,
  all_ready: {
    worst: nodes[0],
    witness_route: witnessRoute,
    immediate_guidance_lower_bound_seconds: nodes[0].nearest.distance_to_radius_m / speed,
    nodes_exceeding_90_seconds_even_with_immediate_guidance: nodes.filter(n => n.nearest.distance_to_radius_m / speed > 90).length,
    nodes_needing_more_than_30_seconds_after_guidance: nodes.filter(n => n.nearest.distance_to_radius_m / speed > 30).length,
    at_1_2_mps_nodes_exceeding_90_seconds_even_with_immediate_guidance: nodes.filter(n => n.nearest.distance_to_radius_m / 1.2 > 90).length,
  },
  one_unanswered_place: remaining,
  limitations: [
    'No Unity or browser claim; graph node coverage is not continuous edge coverage.',
    'A stationary NPC or no remaining eligible situations cannot guarantee a new arrival.',
    'Already-inside places require an exit and re-entry; these lower bounds omit that extra travel.',
    '60s guidance starts from the actual pose at that time, not from every audited node at join.',
  ],
};
const output = process.argv[2];
if (output) await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
