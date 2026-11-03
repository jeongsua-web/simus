import test from 'node:test';
import assert from 'node:assert/strict';
import { scanPlace } from '../src/lib/npc-place-trajectory.ts';
import { MAP_VERSION, routeBetween, nodePoint, pathLength } from '../src/lib/city-v002-graph.mjs';
import { eventManifest } from '../src/lib/city-v002-event-mapping.mjs';
const epoch='2026-01-01T00:00:00Z',start=Date.parse(epoch);
test('road control: exact millisecond entry survives epoch rounding and polling gaps',()=>{
  const npc={npc_id:'test',epoch,motion:{map_version:MAP_VERSION,points:[[110.882,.16,-65.75],[86,.16,-65.75],[110.882,.16,-65.75]],speed_mps:1.2,loop:true}};
  const location=eventManifest.events.find(e=>e.number===28).event_location;
  const result=scanPlace(npc,start,start+22000,location,false);
  assert.equal(result.entries,1);assert.equal(result.inside,false);
  assert.equal(result.firstEntry,start+19486);
  assert.equal(scanPlace(npc,start,result.firstEntry,location,false).inside,true,'Freeze timestamp must actually be inside');
});
for(const row of eventManifest.events.filter(e=>e.status==='READY')) test(`${row.code}: arrival and pass-through remain detectable at runtime speeds`,()=>{
  const points=routeBetween(nodePoint('CAMPUS_PLAZA'),row.event_location.point);
  for(const speed of [1.2,2.38,4.046]) {
    const npc={npc_id:'test',epoch,motion:{map_version:MAP_VERSION,points,speed_mps:speed,loop:false}};
    const until=start+Math.ceil(pathLength(points)/speed*1000)+1000;
    const result=scanPlace(npc,start,until,row.event_location,false);
    assert.ok(result.firstEntry!==null,`Missing entry at ${speed}m/s`);assert.equal(result.inside,true);
    assert.equal(scanPlace(npc,start,result.firstEntry,row.event_location,false).inside,true);
    assert.equal(scanPlace(npc,until,until+1000,row.event_location,true).entries,0,'Remaining inside is not a visit');
  }
});
