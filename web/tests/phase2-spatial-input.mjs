// Export authored server routes for the Unity collider/support audit. No asset writes.
import { writeFile } from 'node:fs/promises';
import { eventManifest } from '../src/lib/city-v002-event-mapping.mjs';
import { routeBetween, nodePoint, pedestrianGraph, pathLength } from '../src/lib/city-v002-graph.mjs';
const rows=eventManifest.events.filter(e=>e.status==='READY').map(row=>({
  code:row.code,scene_path:row.scene_path,place_id:row.place_id,location:row.event_location,
  from_plaza:routeBetween(nodePoint('CAMPUS_PLAZA'),row.event_location.point),
  approach:pedestrianGraph.nodes.map(n=>routeBetween(n.position,row.event_location.point))
    .filter(p=>pathLength(p)>14&&pathLength(p)<40).sort((a,b)=>pathLength(a)-pathLength(b))[0]
      ?? routeBetween(nodePoint('CAMPUS_PLAZA'),row.event_location.point),
}));
const output=process.argv[2]||'/tmp/simus-phase2-routes.json';
await writeFile(output,JSON.stringify(rows,null,2));console.log(output);
