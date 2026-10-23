import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { npcPosition } from '../src/app/participate/npc-motion.ts';

// Coordinates belong only to this disposable integration fixture, never exhibition data.
export async function runNpcEventIntegration({ pool, env, token, templateId, stopServer, startServer }) {
  async function call(path, { method = 'GET', data, cookie, admin = false, origin } = {}) {
    const r = await fetch(env.TEST_API_URL + path, { method, headers: {
      ...(cookie ? { cookie } : {}), ...(admin ? { authorization: `Bearer ${token}` } : {}),
      ...(data ? { 'content-type': 'application/json' } : {}), ...(origin ? { origin } : {}) }, body: data ? JSON.stringify(data) : undefined });
    return { status: r.status, body: await r.json(), cookie: r.headers.get('set-cookie')?.split(';')[0] };
  }
  const created = await call('/api/admin/sessions', { method: 'POST', admin: true, data: {
    template_session_id: templateId, name: 'Disposable NPC events fixture', duration_seconds: 600,
    impact_scale: 0.1, request_key: randomUUID() } });
  assert.equal(created.status, 201);
  const sid = created.body.session_id;
  const motion = { map_version: 'event-test-only', path_version: 'synthetic-v1', points: [[0,0,0],[1000,0,0]], speed_mps: 1, loop: false };
  assert.equal((await call(`/api/admin/sessions/${sid}/npc-motion`, { method: 'PUT', admin: true, data: motion })).status, 200);
  await pool.query('UPDATE simus.session_situations SET event_location=NULL,is_generic=false WHERE session_id=$1', [sid]);
  const situations = (await pool.query('SELECT id FROM simus.session_situations WHERE session_id=$1 ORDER BY display_order,id', [sid])).rows;
  assert.ok(situations.length >= 2);
  const located = situations[0].id, generic = situations[1].id;
  await pool.query("UPDATE simus.session_situations SET code='AUTHORED_GENERIC',title='Authored common situation' WHERE session_id=$1 AND id=$2",[sid,generic]);
  const locationsPath=`/api/admin/sessions/${sid}/event-locations`;
  const locationInput={situation_id:located,is_generic:false,event_location:{map_version:motion.map_version,point:[100,0,100],radius_m:2}};
  assert.equal((await call(locationsPath,{method:'PUT',data:locationInput})).status,401);
  assert.equal((await call(locationsPath,{method:'PUT',admin:true,origin:'https://foreign.invalid',data:locationInput})).status,403);
  for(const bad of [{...locationInput,event_location:{...locationInput.event_location,point:[0,0]}},{...locationInput,event_location:{...locationInput.event_location,radius_m:0}},{...locationInput,is_generic:true}])
    assert.equal((await call(locationsPath,{method:'PUT',admin:true,data:bad})).status,400);
  assert.equal((await call(locationsPath,{method:'PUT',admin:true,data:{...locationInput,event_location:{...locationInput.event_location,map_version:'different-map'}}})).body.error.code,'NPC_MAP_MISMATCH');
  assert.equal((await call(locationsPath,{method:'PUT',admin:true,data:locationInput})).status,200);
  assert.equal((await call(locationsPath,{method:'PUT',admin:true,data:{situation_id:generic,is_generic:true,event_location:null}})).status,200);
  // Reproduce the live round: authored situations have no map placement yet,
  // alongside the old auto-generated greeting. Include a foreign-map event.
  const added = (await pool.query(`INSERT INTO simus.session_situations
    (session_id,code,title,body,display_order,event_location,is_generic)
    SELECT $1,'VARIETY_'||n,'Situation '||n,'Choose an action',100+n,
      CASE WHEN n=31 THEN '{"map_version":"foreign-map","point":[0,0,0],"radius_m":1000}'::jsonb ELSE NULL END,false
    FROM generate_series(1,31) n RETURNING id,event_location`,[sid])).rows;
  const placeholder = (await pool.query(`INSERT INTO simus.session_situations
    (session_id,code,title,body,display_order,is_generic)
    VALUES($1,'SIMUS_COMMON_ENCOUNTER','이웃의 인사','Greeting',2147483647,true) RETURNING id`,[sid])).rows[0].id;
  await pool.query(`INSERT INTO simus.session_choices(session_id,situation_id,label,display_order,importance)
    SELECT $1,t.id,c.label,c.n,'NORMAL' FROM simus.session_situations t
    CROSS JOIN (VALUES ('First',1),('Second',2)) c(label,n)
    WHERE t.session_id=$1 AND t.id=ANY($2::uuid[])`,[sid,[...added.map(t=>t.id),placeholder]]);
  const colocated = (await pool.query(`INSERT INTO simus.session_situations
    (session_id,code,title,body,display_order,event_location) VALUES
    ($1,'SAME_PLACE_FIXTURE','Same place','Choose',500,$2) RETURNING id`,[sid,locationInput.event_location])).rows[0].id;
  await pool.query(`INSERT INTO simus.session_choices(session_id,situation_id,label,display_order)
    VALUES($1,$2,'Help',1),($1,$2,'Pass',2)`,[sid,colocated]);
  const locatedIds = new Set([located,colocated]);
  assert.equal((await call(`/api/admin/sessions/${sid}/start`, { method: 'POST', admin: true, data: { request_key: randomUUID() } })).status, 200);
  assert.equal((await call(locationsPath,{method:'PUT',admin:true,data:locationInput})).body.error.code,'EVENT_LOCATION_LOCKED');
  const owner = await call('/api/participants', { method: 'POST' });
  const stranger = await call('/api/participants', { method: 'POST' });
  assert.equal((await call(`/api/sessions/${sid}/join`, { method: 'POST', cookie: owner.cookie })).status, 201);
  const pid = (await pool.query('SELECT participant_id FROM simus.participant_sessions WHERE session_id=$1',[sid])).rows[0].participant_id;
  const eventPath = `/api/sessions/${sid}/event`;
  const event = () => call(eventPath, { cookie: owner.cookie });
  assert.equal((await call(eventPath)).status,401);
  assert.equal((await call(eventPath,{cookie:stranger.cookie})).body.error.code,'NOT_JOINED');
  const waiting = await event();
  assert.equal(waiting.body.phase,'WAITING'); assert.equal(waiting.body.event,null);
  assert.equal(waiting.body.deadline_at,null);
  assert.equal(Date.parse(waiting.body.guidance_at)-Date.parse(waiting.body.waiting_since),60000);
  const metadata = await call('/api/sessions/current');
  for (const situation of metadata.body.situations ?? metadata.body.session?.situations ?? []) assert.deepEqual(situation.choices,[]);
  await pool.query("UPDATE simus.npc_event_states SET waiting_since=clock_timestamp()-interval '59 seconds' WHERE session_id=$1 AND participant_id=$2",[sid,pid]);
  assert.equal((await event()).body.phase,'WAITING');
  await pool.query("UPDATE simus.npc_event_states SET waiting_since=clock_timestamp()-interval '61 seconds' WHERE session_id=$1 AND participant_id=$2",[sid,pid]);
  const guiding=await event(); assert.equal(guiding.body.phase,'GUIDING'); assert.equal(guiding.body.event,null);
  const state=(await pool.query('SELECT * FROM simus.npc_event_states WHERE session_id=$1 AND participant_id=$2',[sid,pid])).rows[0];
  assert.deepEqual(state.guidance_point,[100,0,100]);
  await pool.query("UPDATE simus.npc_event_states SET guidance_started_at=clock_timestamp()-interval '10 seconds' WHERE session_id=$1 AND participant_id=$2",[sid,pid]);
  await pool.query("UPDATE simus.npc_event_states SET waiting_since=clock_timestamp()-interval '89 seconds' WHERE session_id=$1 AND participant_id=$2",[sid,pid]);
  assert.equal((await event()).body.event,null);
  // Passing 90 seconds mid-route must NOT trigger any mapped or unlocated event.
  await pool.query("UPDATE simus.npc_event_states SET waiting_since=clock_timestamp()-interval '91 seconds' WHERE session_id=$1 AND participant_id=$2",[sid,pid]);
  assert.equal((await event()).body.event,null);
  assert.equal((await pool.query("SELECT count(*) FROM simus.npc_events WHERE session_id=$1 AND participant_id=$2",[sid,pid])).rows[0].count,'0');
  // Advance the fixture's guidance clock until its actual pose reaches the place.
  // The autonomous ticker must trigger arrival without an event GET.
  await pool.query("UPDATE simus.npc_event_states SET guidance_started_at=clock_timestamp()-interval '200 seconds' WHERE session_id=$1 AND participant_id=$2",[sid,pid]);
  const until=Date.now()+1000; let occurrence;
  while(Date.now()<until) {
    occurrence=(await pool.query("SELECT * FROM simus.npc_events WHERE session_id=$1 AND participant_id=$2 AND status='ACTIVE'",[sid,pid])).rows[0];
    if(occurrence) break;
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  assert.ok(occurrence,'Scheduler must trigger actual arrival without client polling');
  assert.ok(locatedIds.has(occurrence.situation_id)); assert.equal(occurrence.trigger_kind,'LOCATION');
  if(stopServer&&startServer) {
    await stopServer(); await startServer();
    assert.equal((await event()).body.event.id,occurrence.id,'Process restart preserves the active event');
  }
  const concurrent=await Promise.all(Array.from({length:8},event));
  for(const r of concurrent) {assert.equal(r.body.phase,'ACTIVE');assert.equal(r.body.event.id,occurrence.id);}
  assert.equal((await pool.query("SELECT count(*) FROM simus.npc_events WHERE session_id=$1 AND participant_id=$2 AND status='ACTIVE'",[sid,pid])).rows[0].count,'1');
  const choice=concurrent[0].body.event.situation.choices[0];
  const payload={session_id:sid,event_id:occurrence.id,situation_id:occurrence.situation_id,choice_id:choice.id,request_key:randomUUID()};
  assert.equal((await call('/api/choices',{method:'POST',cookie:stranger.cookie,data:payload})).body.error.code,'EVENT_NOT_ACTIVE');
  assert.equal((await call('/api/choices',{method:'POST',cookie:owner.cookie,data:{...payload,event_id:randomUUID()}})).body.error.code,'EVENT_NOT_ACTIVE');
  const frozenNpc=(await call(`/api/sessions/${sid}/npc`,{cookie:owner.cookie})).body;
  const frozenPoint=npcPosition(frozenNpc.npcs[0],Date.parse(frozenNpc.motion_time));
  assert.deepEqual(npcPosition(frozenNpc.npcs[0],Date.parse(frozenNpc.motion_time)+30000),frozenPoint);
  const before=(await pool.query('SELECT version FROM simus.city_states WHERE session_id=$1',[sid])).rows[0].version;
  const responses=await Promise.all(Array.from({length:4},()=>call('/api/choices',{method:'POST',cookie:owner.cookie,data:payload})));
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,200,200,201]);
  assert.equal(BigInt((await pool.query('SELECT version FROM simus.city_states WHERE session_id=$1',[sid])).rows[0].version),BigInt(before)+1n);
  assert.equal((await pool.query('SELECT response_count FROM simus.participant_alignments WHERE session_id=$1 AND participant_id=$2',[sid,pid])).rows[0].response_count,'1');
  assert.equal((await call('/api/choices',{method:'POST',cookie:owner.cookie,data:{...payload,request_key:randomUUID()}})).body.error.code,'EVENT_NOT_ACTIVE');
  const resumedNpc=(await call(`/api/sessions/${sid}/npc`,{cookie:owner.cookie})).body;
  const resumedPoint=npcPosition(resumedNpc.npcs[0],Date.parse(resumedNpc.motion_time));
  assert.ok(Math.hypot(...resumedPoint.map((v,i)=>v-frozenPoint[i]))<1,'Completion must resume without teleporting from the guided path');
  const resumed=await event();assert.equal(resumed.body.phase,'WAITING');assert.equal(resumed.body.event,null);
  assert.ok(Date.parse(resumed.body.waiting_since)>Date.parse(waiting.body.waiting_since));
  assert.equal(resumed.body.deadline_at,null);
  assert.ok(Object.values((await pool.query('SELECT location_occupancy FROM simus.npc_event_states WHERE session_id=$1 AND participant_id=$2',[sid,pid])).rows[0].location_occupancy).some(s=>s.inside));
  if(stopServer&&startServer) { await stopServer(); await startServer(); }
  assert.equal((await event()).body.event,null,'A reconnect at the same place must not consume the other event');
  // Leave the place, release its durable latch, then return. Only runtime state
  // changes; RUNNING content and membership snapshots remain immutable.
  await pool.query('UPDATE simus.npc_event_states SET resume_motion=$3,motion_epoch=clock_timestamp(),paused_ms=0 WHERE session_id=$1 AND participant_id=$2',[sid,pid,JSON.stringify({...motion,points:[[110,0,100],[120,0,100]]})]);
  assert.equal((await event()).body.event,null);
  assert.ok(Object.values((await pool.query('SELECT location_occupancy FROM simus.npc_event_states WHERE session_id=$1 AND participant_id=$2',[sid,pid])).rows[0].location_occupancy).every(s=>!s.inside));
  await pool.query('UPDATE simus.npc_event_states SET resume_motion=$3,motion_epoch=clock_timestamp(),paused_ms=0 WHERE session_id=$1 AND participant_id=$2',[sid,pid,JSON.stringify({...motion,points:[[100,0,100],[110,0,100]]})]);
  const nearby=await event();assert.ok(locatedIds.has(nearby.body.event.situation_id));assert.notEqual(nearby.body.event.situation_id,occurrence.situation_id);assert.equal(nearby.body.event.trigger_kind,'LOCATION');
  assert.equal((await event()).body.event.id,nearby.body.event.id); // durable refresh identity
  const locationPayload={...payload,event_id:nearby.body.event.id,situation_id:nearby.body.event.situation_id,choice_id:nearby.body.event.situation.choices[0].id,request_key:randomUUID()};
  assert.equal((await call('/api/choices',{method:'POST',cookie:owner.cookie,data:locationPayload})).status,201);
  await pool.query("UPDATE simus.npc_event_states SET waiting_since=clock_timestamp()-interval '91 seconds' WHERE session_id=$1 AND participant_id=$2",[sid,pid]);
  for (let n=0;n<3;n++) assert.equal((await event()).body.event,null,'Exhaustion must not recycle greetings or use foreign-map locations');
  const counts=(await pool.query('SELECT count(*)::int AS total,count(DISTINCT situation_id)::int AS unique FROM simus.choice_records WHERE session_id=$1 AND participant_id=$2',[sid,pid])).rows[0];
  assert.deepEqual(counts,{total:2,unique:2});
  // Batch fixture writes remain confined to this disposable pool. No HTTP event polls.
  const batch=(await pool.query(`WITH added AS (
    INSERT INTO simus.participants(id) SELECT gen_random_uuid() FROM generate_series(1,1000) RETURNING id
  ), joined AS (
    INSERT INTO simus.participant_sessions(session_id,participant_id,npc_motion)
    SELECT $1,id,$2::jsonb FROM added RETURNING participant_id,joined_at
  ) INSERT INTO simus.npc_event_states(session_id,participant_id,waiting_since,motion_epoch)
    SELECT $1,participant_id,clock_timestamp()-interval '91 seconds',joined_at FROM joined RETURNING participant_id`,[sid,JSON.stringify({...motion,points:[[100,0,100],[1000,0,100]]})])).rows.map(row=>row.participant_id);
  await pool.query('INSERT INTO simus.participant_alignments(session_id,participant_id) SELECT $1,unnest($2::uuid[])',[sid,batch]);
  const batchUntil=Date.now()+8000;let batchCount=0;
  while(Date.now()<batchUntil) {
    batchCount=Number((await pool.query("SELECT count(*) FROM simus.npc_events WHERE session_id=$1 AND participant_id=ANY($2::uuid[]) AND status='ACTIVE'",[sid,batch])).rows[0].count);
    if(batchCount===1000) break;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.equal(batchCount,1000,'Every participant actually at the place must receive an event without a probability gate');
  const variety=(await pool.query('SELECT DISTINCT situation_id FROM simus.npc_events WHERE session_id=$1 AND participant_id=ANY($2::uuid[])',[sid,batch])).rows;
  assert.ok(variety.length>1,'Participants must receive varied first situations');
  assert.ok(variety.every(t=>locatedIds.has(t.situation_id)));
  await pool.query("UPDATE simus.simulation_sessions SET admission_closed_at=clock_timestamp() WHERE id=$1",[sid]);
  await pool.query("UPDATE simus.npc_event_states SET waiting_since=clock_timestamp()-interval '91 seconds' WHERE session_id=$1 AND participant_id=$2",[sid,pid]);
  const closed=await event();assert.equal(closed.body.phase,'CLOSED');assert.equal(closed.body.event,null);
  assert.equal((await pool.query("SELECT count(*) FROM simus.npc_events WHERE session_id=$1 AND participant_id=$2 AND status='ACTIVE'",[sid,pid])).rows[0].count,'0');
  const ended=await call(`/api/admin/sessions/${sid}/end`,{method:'POST',admin:true,data:{request_key:randomUUID()}});
  assert.equal(ended.status,200,JSON.stringify(ended.body));
  console.log('PASS: arrival-only events, no 90s fallback, 60s guidance, durable place exit/reentry, restart, concurrency, score idempotence, unlocated/foreign-map exclusion and 1000 actual arrivals');
}
