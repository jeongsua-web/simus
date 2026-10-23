import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MAP_VERSION, PATH_VERSION, nodePoint, locate, pathLength, isGraphSegment } from '../src/lib/city-v002-graph.mjs';
import { npcPosition } from '../src/app/participate/npc-motion.ts';

export async function runCityV002Events({ pool, env, token, templateId, stopServer, startServer }) {
  async function call(path, { method='GET', data, cookie, admin=false }={}) {
    const response = await fetch(env.TEST_API_URL+path,{method,headers:{...(admin?{authorization:`Bearer ${token}`} :{}),...(cookie?{cookie}:{}),...(data?{'content-type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
    return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
  }
  function graphRoute(points,loop=false) {
    const route=loop?[...points,points[0]]:points;
    for(let i=1;i<route.length;i++) assert.ok(isGraphSegment(route[i-1],route[i]),'Every emitted leg must stay on graph');
  }
  const baseline=(await pool.query(`SELECT
    (SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM simus.simulation_sessions s) AS sessions,
    (SELECT jsonb_agg(to_jsonb(p) ORDER BY session_id,participant_id) FROM simus.participant_sessions p) AS members`)).rows[0];
  const payload={template_session_id:templateId,name:'Disposable CityRebuild_v002 Phase 2',duration_seconds:600,impact_scale:.1,request_key:randomUUID(),npc_profile:'city-rebuild-v002'};
  const created=await call('/api/admin/sessions',{method:'POST',admin:true,data:payload});
  assert.equal(created.status,201,JSON.stringify(created.body)); const sid=created.body.session_id;
  const original=(await pool.query('SELECT status,npc_motion FROM simus.simulation_sessions WHERE id=$1',[sid])).rows[0];
  assert.equal(original.status,'DRAFT'); assert.equal(original.npc_motion.map_version,MAP_VERSION); assert.equal(original.npc_motion.path_version,PATH_VERSION);
  assert.equal((await call('/api/admin/sessions',{method:'POST',admin:true,data:payload})).body.session_id,sid);
  assert.equal((await call('/api/admin/sessions',{method:'POST',admin:true,data:{...payload,npc_profile:undefined}})).body.error.code,'REQUEST_KEY_CONFLICT');
  const after=(await pool.query(`SELECT
    (SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM simus.simulation_sessions s WHERE id<>$1) AS sessions,
    (SELECT jsonb_agg(to_jsonb(p) ORDER BY session_id,participant_id) FROM simus.participant_sessions p) AS members`,[sid])).rows[0];
  assert.deepEqual(after,baseline,'Creation must preserve every existing session and membership snapshot');
  assert.equal((await pool.query('SELECT count(*) FROM simus.session_situations WHERE session_id=$1 AND event_location IS NOT NULL',[sid])).rows[0].count,'0','Never copy old-map placement');
  assert.ok((await pool.query('SELECT map_metadata FROM simus.session_regions WHERE session_id=$1',[sid])).rows.every(r=>JSON.stringify(r.map_metadata)==='{}'));
  const situation=(await pool.query('SELECT id FROM simus.session_situations WHERE session_id=$1 ORDER BY display_order LIMIT 1',[sid])).rows[0].id;
  const location={situation_id:situation,is_generic:false,event_location:{place_id:'fixture_river',map_version:MAP_VERSION,point:nodePoint('RIVER_E_30'),radius_m:.1}};
  const locations=`/api/admin/sessions/${sid}/event-locations`;
  assert.equal((await call(locations,{method:'PUT',admin:true,data:{...location,event_location:{...location.event_location,point:[120,-1.2,75]}}})).body.error.code,'INVALID_GRAPH_LOCATION');
  assert.equal((await call(locations,{method:'PUT',admin:true,data:location})).status,200);
  const timed = (await pool.query(`INSERT INTO simus.session_situations(session_id,code,title,body,display_order)
    VALUES($1,'V002_TIMED_FIXTURE','Timed fixture','Choose',9999) RETURNING id`,[sid])).rows[0].id;
  await pool.query(`INSERT INTO simus.session_choices(session_id,situation_id,label,display_order,importance)
    VALUES($1,$2,'First',1,'NORMAL'),($1,$2,'Second',2,'NORMAL')`,[sid,timed]);
  const motionPath=`/api/admin/sessions/${sid}/npc-motion`;
  assert.equal((await call(motionPath,{method:'PUT',admin:true,data:{...original.npc_motion,path_version:'wrong'}})).body.error.code,'INVALID_GRAPH_ROUTE');
  assert.equal((await call(`/api/admin/sessions/${sid}/start`,{method:'POST',admin:true,data:{request_key:randomUUID()}})).status,200);
  assert.equal((await call(motionPath,{method:'PUT',admin:true,data:original.npc_motion})).body.error.code,'NPC_MOTION_LOCKED');
  const person=await call('/api/participants',{method:'POST'});
  assert.equal((await call(`/api/sessions/${sid}/join`,{method:'POST',cookie:person.cookie})).status,201);
  const member=(await pool.query('SELECT * FROM simus.participant_sessions WHERE session_id=$1',[sid])).rows[0];
  assert.deepEqual(member.npc_motion,original.npc_motion);
  const positions=`/api/sessions/${sid}/npc-positions?map_version=${MAP_VERSION}&path_version=${PATH_VERSION}`;
  const event=()=>call(`/api/sessions/${sid}/event`,{cookie:person.cookie});
  const snapshot=async()=>{const r=await call(positions);assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
  assert.equal((await call(`/api/sessions/${sid}/npc-positions?map_version=dev-synthetic-v1`)).body.error.code,'NPC_MAP_MISMATCH');
  const waiting=await event();assert.equal(waiting.body.phase,'WAITING');
  const initial=await snapshot(),npc=initial.npcs[0];graphRoute(npc.motion.points,true);
  assert.equal(npc.epoch,new Date(member.joined_at).toISOString());locate([npc.position.x,npc.position.y,npc.position.z]);
  await pool.query("UPDATE simus.npc_event_states SET waiting_since=clock_timestamp()-interval '61 seconds' WHERE session_id=$1",[sid]);
  assert.equal((await event()).body.phase,'GUIDING');
  let state=(await pool.query('SELECT * FROM simus.npc_event_states WHERE session_id=$1',[sid])).rows[0];
  assert.ok(state.guidance_motion.points.length>2);graphRoute(state.guidance_motion.points);
  const guidance=await snapshot();graphRoute(guidance.npcs[0].motion.points);assert.ok(guidance.npcs[0].motion.revision>npc.motion.revision);
  const seconds=pathLength(state.guidance_motion.points)/state.guidance_motion.speed_mps;
  // Advance only owned runtime clock; do not rewrite RUNNING session/content or snapshot.
  await pool.query("UPDATE simus.npc_event_states SET guidance_started_at=clock_timestamp()-$2*interval '1 second' WHERE session_id=$1",[sid,seconds+1]);
  const arrived=await event(); assert.equal(arrived.body.phase,'ACTIVE');assert.equal(arrived.body.event.situation_id,situation);assert.equal(arrived.body.event.trigger_kind,'LOCATION');
  const activeId=arrived.body.event.id;
  await stopServer();await startServer();
  const concurrent=await Promise.all(Array.from({length:8},event));for(const r of concurrent) assert.equal(r.body.event.id,activeId);
  assert.equal((await pool.query("SELECT count(*) FROM simus.npc_events WHERE session_id=$1 AND status='ACTIVE'",[sid])).rows[0].count,'1');
  const frozen=await snapshot(),frozenNpc=frozen.npcs[0];
  assert.equal(frozenNpc.motion.speed_mps,0);assert.deepEqual(npcPosition(frozenNpc,Date.parse(frozen.motion_time)+90000),frozenNpc.motion.points[0]);
  const point=frozenNpc.motion.points[0];assert.ok(Math.hypot(...point.map((v,i)=>v-location.event_location.point[i]))<=location.event_location.radius_m+.005);
  const choicePayload={session_id:sid,event_id:activeId,situation_id:situation,choice_id:arrived.body.event.situation.choices[0].id,request_key:randomUUID()};
  const answered=await Promise.all(Array.from({length:4},()=>call('/api/choices',{method:'POST',cookie:person.cookie,data:choicePayload})));
  assert.deepEqual(answered.map(r=>r.status).sort(),[200,200,200,201]);
  const resumed=await snapshot();graphRoute(resumed.npcs[0].motion.points);
  assert.ok(Math.hypot(...resumed.npcs[0].motion.points[0].map((v,i)=>v-point[i]))<.01,'No teleport on resume');
  state=(await pool.query('SELECT * FROM simus.npc_event_states WHERE session_id=$1',[sid])).rows[0];
  assert.equal(state.guidance_motion,null);assert.equal(state.guidance_point,null);assert.ok(state.resume_motion.rejoin_after_ms>0);
  const rejoin=state.resume_motion.rejoin_motion;graphRoute(rejoin.points,true);
  // Exercise handoff before the next 60-second guidance threshold.
  await pool.query("UPDATE simus.npc_event_states SET motion_epoch=clock_timestamp()-$2*interval '1 millisecond' WHERE session_id=$1",[sid,state.resume_motion.rejoin_after_ms+1000]);
  const rejoined=await snapshot();assert.deepEqual(rejoined.npcs[0].motion.points,rejoin.points);assert.equal(rejoined.npcs[0].motion.loop,true);
  assert.ok(rejoined.npcs[0].motion.revision>resumed.npcs[0].motion.revision);
  assert.deepEqual((await pool.query('SELECT npc_motion FROM simus.participant_sessions WHERE session_id=$1',[sid])).rows[0].npc_motion,member.npc_motion);
  await pool.query("UPDATE simus.npc_event_states SET waiting_since=clock_timestamp()-interval '91 seconds' WHERE session_id=$1",[sid]);
  const overdue=await event();assert.equal(overdue.body.event,null);assert.equal(overdue.body.deadline_at,null);
  assert.equal((await pool.query('SELECT count(*) FROM simus.npc_events WHERE session_id=$1 AND situation_id=$2',[sid,timed])).rows[0].count,'0','Unlocated events never fire after 90 seconds');
  // A second NPC remains on its graph guidance route past 90 seconds. It can
  // freeze for an event only after reaching the destination, at runtime speed.
  const second = await call('/api/participants',{method:'POST'});
  assert.equal((await call(`/api/sessions/${sid}/join`,{method:'POST',cookie:second.cookie})).status,201);
  const secondId=(await pool.query('SELECT participant_id FROM simus.participant_sessions WHERE session_id=$1 AND participant_id<>$2',[sid,member.participant_id])).rows[0].participant_id;
  const secondEvent=()=>call(`/api/sessions/${sid}/event`,{cookie:second.cookie});
  await secondEvent();
  const fasterMotion={...member.npc_motion,speed_mps:member.npc_motion.speed_mps*1.7};
  await pool.query('UPDATE simus.npc_event_states SET resume_motion=$3 WHERE session_id=$1 AND participant_id=$2',[sid,secondId,fasterMotion]);
  await pool.query("UPDATE simus.npc_event_states SET waiting_since=clock_timestamp()-interval '61 seconds' WHERE session_id=$1 AND participant_id=$2",[sid,secondId]);
  assert.equal((await secondEvent()).body.phase,'GUIDING');
  await pool.query("UPDATE simus.npc_event_states SET waiting_since=clock_timestamp()-interval '91 seconds',guidance_started_at=clock_timestamp()-interval '7 seconds' WHERE session_id=$1 AND participant_id=$2",[sid,secondId]);
  const midRoute=await secondEvent();assert.equal(midRoute.body.event,null);
  const travelling=(await pool.query('SELECT * FROM simus.npc_event_states WHERE session_id=$1 AND participant_id=$2',[sid,secondId])).rows[0];
  const travelSeconds=pathLength(travelling.guidance_motion.points)/fasterMotion.speed_mps;
  await pool.query("UPDATE simus.npc_event_states SET guidance_started_at=clock_timestamp()-$3*interval '1 second' WHERE session_id=$1 AND participant_id=$2",[sid,secondId,travelSeconds+1]);
  const interrupted=await secondEvent();assert.equal(interrupted.body.event.trigger_kind,'LOCATION');
  const during=(await call(`/api/sessions/${sid}/npc`,{cookie:second.cookie})).body.npcs[0];
  const frozenMid=during.motion.points[0];locate(frozenMid);
  const secondState=(await pool.query('SELECT * FROM simus.npc_event_states WHERE session_id=$1 AND participant_id=$2',[sid,secondId])).rows[0];
  assert.equal(secondState.guidance_motion.speed_mps,fasterMotion.speed_mps,'Guidance retains runtime speed');
  const expectedFrozen=npcPosition({npc_id:'test',epoch:new Date(secondState.guidance_started_at).toISOString(),motion:secondState.guidance_motion},Date.parse(interrupted.body.event.started_at));
  assert.ok(Math.hypot(...frozenMid.map((v,i)=>v-expectedFrozen[i]))<.01,'Event and rendering agree at runtime speed');
  assert.ok(Math.hypot(...frozenMid.map((v,i)=>v-secondState.guidance_origin[i]))>1);
  assert.ok(Math.hypot(...frozenMid.map((v,i)=>v-secondState.guidance_point[i]))<=location.event_location.radius_m+.005);
  assert.equal((await call('/api/choices',{method:'POST',cookie:second.cookie,data:{session_id:sid,event_id:interrupted.body.event.id,
    situation_id:interrupted.body.event.situation_id,choice_id:interrupted.body.event.situation.choices[0].id,request_key:randomUUID()}})).status,201);
  const midReturn=(await call(`/api/sessions/${sid}/npc`,{cookie:second.cookie})).body.npcs[0];
  assert.equal(midReturn.motion.speed_mps,fasterMotion.speed_mps,'Return retains runtime speed');
  assert.deepEqual((await pool.query('SELECT npc_motion FROM simus.participant_sessions WHERE session_id=$1 AND participant_id=$2',[sid,secondId])).rows[0].npc_motion,member.npc_motion);
  graphRoute(midReturn.motion.points);assert.deepEqual(midReturn.motion.points[0],frozenMid);
  assert.equal((await call(`/api/admin/sessions/${sid}/end`,{method:'POST',admin:true,data:{request_key:randomUUID()}})).status,200);
  const ended=await snapshot();assert.equal(ended.frozen,true);assert.equal((await event()).body.phase,'CLOSED');
  console.log('PASS: v002 DRAFT isolation, graph guidance/arrival, freeze/restart/concurrency/idempotence, graph return and loop handoff/revision, immutable snapshots, no 90-second fallback, session end');
}
