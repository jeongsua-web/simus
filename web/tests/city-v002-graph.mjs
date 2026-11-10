import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pedestrianGraph as graph, LEGACY_MAP_VERSION, graphForMap, defaultMotion, nodePoint, routeBetween, isGraphSegment, pathLength, locate, graphMotion } from '../src/lib/city-v002-graph.mjs';
import phase1 from '../src/lib/data/city-v002-phase1-event-locations.json' with { type: 'json' };
import { eventManifest, preparedLocation } from '../src/lib/city-v002-event-mapping.mjs';
import { npcPosition } from '../src/app/participate/npc-motion.ts';

export function assertGraphRoute(points, loop = false) {
  const legs = loop ? [...points, points[0]] : points;
  for (let i = 1; i < legs.length; i++) assert.ok(isGraphSegment(legs[i - 1], legs[i]), `Non-graph leg: ${JSON.stringify(legs.slice(i-1,i+1))}`);
}
assert.equal(graph.nodes.length, 579); assert.equal(graph.edges.length, 604);
assert.equal(graphForMap(LEGACY_MAP_VERSION).nodes.length,572);
assert.equal(graphForMap(LEGACY_MAP_VERSION).edges.length,597);
for (const previous of phase1.locations) assert.deepEqual(preparedLocation(previous.situation_code),
  {place_id:previous.place_id,map_version:phase1.map_version,point:previous.point,radius_m:previous.radius_m},'Preserve the exact eight Phase 1 mappings');
assert.equal(eventManifest.events.length,30);
assert.equal(eventManifest.events.filter(e=>e.event_location).length,12);
for(const event of eventManifest.events.filter(e=>e.status!=='READY')) assert.equal(preparedLocation(event.code),null,'A reachable candidate must not silently enable an unfinished scene');
const motion = defaultMotion(); assertGraphRoute(motion.points, true);
const epoch = '2026-01-01T00:00:00Z', start = Date.parse(epoch);
for (let t = 0; t < pathLength(motion.points) / motion.speed_mps * 1000; t += 1357)
  locate(npcPosition({ npc_id: 'test', epoch, motion }, start + t));
for (const node of graph.nodes) assertGraphRoute(routeBetween(motion.points[0], node.position));
const river = routeBetween(nodePoint('RIVER_W_30'), nodePoint('RIVER_E_30'));
assertGraphRoute(river);
assert.ok(pathLength(river) > Math.hypot(...nodePoint('RIVER_W_30').map((v,i)=>v-nodePoint('RIVER_E_30')[i])) * 1.2);
assert.throws(() => routeBetween(motion.points[0], [120, -1.2, 75]));
assert.throws(() => graphMotion({ ...motion, path_version: 'wrong-version' }));
const loop = graphMotion({ ...motion, points: [nodePoint('CAMPUS_PLAZA'), nodePoint('B16_ACCESS')] });
assertGraphRoute(loop.points, true);
console.log('PASS: Phase 1 579/604 and preserved legacy graph, exact eight mappings, 12 ready/18 blocked, all nodes reachable, default/closing legs, interpolation, bridge detour and off-graph/version rejection');

const layout = JSON.parse(await readFile(new URL('../../docs/planning/city_rebuild_v002/layout.json', import.meta.url)));
const design = JSON.parse(await readFile(new URL('../../docs/planning/city_rebuild_v002/river-design.json', import.meta.url)));
const buildings = [...layout.buildings, ...layout.campus.components].filter(b => b.type === 'campus_building' || layout.buildings.includes(b));
function inside([x,z], polygon) {
  let result = false;
  for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i],b=polygon[j];
    if ((a[1]>z)!==(b[1]>z) && x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]) result=!result;
  }
  return result;
}
const line=[]; const control=design.control_points;
for(let i=0;i<control.length-1;i++) for(let n=0;n<=100;n++) {
  const [a,b,c,d]=[control[Math.max(0,i-1)],control[i],control[i+1],control[Math.min(control.length-1,i+2)]];
  const t=n/100;
  line.push([0,1].map(j=>.5*(2*b[j]+(-a[j]+c[j])*t+(2*a[j]-5*b[j]+4*c[j]-d[j])*t*t+(-a[j]+3*b[j]-3*c[j]+d[j])*t*t*t)));
}
function waterDistance(p) { return Math.min(...line.map(q=>Math.hypot(p[0]-q[0],p[2]-q[1]))); }
function onBridge(p) { return design.bridges.some(bridge=>{
  const [a,b]=bridge.endpoints,l=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/l,dz=(b[1]-a[1])/l;
  const x=p[0]-a[0],z=p[2]-a[1],along=x*dx+z*dz,across=Math.abs(-x*dz+z*dx);
  return along>=-.35 && along<=l+.35 && across<=1.15 && Math.abs(p[1]-.16)<.1;
}); }
let samples=0, wet=0;
for(const edge of graph.edges) for(let i=1;i<edge.points.length;i++) {
  const a=edge.points[i-1],b=edge.points[i],count=Math.ceil(pathLength([a,b])/.3);
  for(let k=0;k<=count;k++) {
    const p=a.map((v,j)=>v+(b[j]-v)*k/count);samples++;
    for(const building of buildings) assert.ok(!inside([p[0],p[2]],building.footprint_polygon),`${edge.id} crosses ${building.id}`);
    if(p[0]>100 && p[0]<151 && p[2]>-30 && p[2]<173 && waterDistance(p)<5.35) {
      wet++; assert.ok(onBridge(p),`Unbridged river crossing: ${edge.id}`);
    }
  }
}
assert.ok(wet>0);
console.log(`PASS: ${samples} exported-edge samples outside ${buildings.length} building footprints; ${wet} water-corridor samples confined to bridges`);
