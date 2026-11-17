// Real local API check; use only the disposable v003-local runner.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import pg from 'pg';
import {npcPosition} from '../src/app/participate/npc-motion.ts';
const base=process.env.V003_TEST_URL||'http://127.0.0.1:3210';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const sid='16000000-0000-0000-0000-000000000001';
let cookie;
const evidence={base,sid,started_at:new Date().toISOString(),samples:[]};
async function call(path,data){const r=await fetch(base+path,{method:data?'POST':'GET',headers:{'content-type':'application/json',origin:base,...(cookie?{cookie}:{})},body:data?JSON.stringify(data):undefined});const body=await r.json();if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,body};}
const event=()=>call(`/api/sessions/${sid}/event`);
const npc=()=>call(`/api/sessions/${sid}/npc`);
const pause=ms=>new Promise(r=>setTimeout(r,ms));
assert.equal((await call('/api/participants',{})).status,201);
assert.equal((await call(`/api/sessions/${sid}/profile`,{nickname:'검증시민',department_id:'dept-23',mbti:'INFP',character_id:'npc_01',glasses_id:'none'})).status,201);
assert.equal((await event()).body.phase,'WAITING');
const idle=(await npc()).body;assert.equal(idle.npcs[0].motion.speed_mps,0);
await pause(2100);assert.equal((await event()).body.phase,'WAITING');
const started=Date.now(),key=randomUUID();
const start=await call(`/api/sessions/${sid}/event/start`,{request_key:key});assert.equal(start.status,200,JSON.stringify(start));assert.equal(start.body.phase,'GUIDING');
const replay=await call(`/api/sessions/${sid}/event/start`,{request_key:key});assert.equal(replay.status,200);assert.equal(replay.body.phase,'GUIDING');
const moving=(await npc()).body;assert.ok(moving.npcs[0].motion.speed_mps>0);
assert.equal(moving.npcs[0].motion.map_version,'city-masterplan-v003-local-v1');assert.equal(moving.npcs[0].motion.path_version,'city-masterplan-v003-plaza30-v1');
let active;
for(let n=0;n<240;n++){const state=(await event()).body;evidence.samples.push({elapsed_ms:Date.now()-started,phase:state.phase});if(state.phase==='ACTIVE'){active=state;break;}await pause(500);}
assert.ok(active,'Actual arrival within 120s test timeout (not exhibition requirement)');
evidence.arrival_observed_ms=Date.now()-started;
evidence.authoritative_travel_ms=Date.parse(active.event.started_at)-Date.parse(moving.npcs[0].epoch);
assert.equal(active.event.situation.code,'EXHIBITION_30');
const stopped=(await npc()).body;await pause(2100);const still=(await npc()).body;
assert.equal(stopped.npcs[0].motion.speed_mps,0);assert.deepEqual(stopped.npcs[0].motion.points,still.npcs[0].motion.points);
const route=JSON.parse(await readFile(new URL('../../docs/content/v003-local-route.json',import.meta.url),'utf8'));
evidence.stop_distance_to_interaction_m=Math.hypot(...stopped.npcs[0].motion.points[0].map((v,i)=>v-route.interaction.point[i]));
assert.ok(evidence.stop_distance_to_interaction_m<=route.interaction.radius_m+.002);
const body={session_id:sid,event_id:active.event.id,situation_id:active.event.situation.id,choice_id:active.event.situation.choices[0].id,request_key:randomUUID()};
const choice=await call('/api/choices',body);assert.equal(choice.status,201,JSON.stringify(choice));
const duplicate=await call('/api/choices',body);assert.equal(duplicate.status,200);assert.equal(duplicate.body.record_id,choice.body.record_id);assert.equal(duplicate.body.state_version,choice.body.state_version);
const result=(await event()).body;assert.equal(result.phase,'RESULT');assert.deepEqual(result.outcome.city,choice.body.city);
assert.ok(!/alignment|x_score|y_score/.test(JSON.stringify(result)),'Immediate result does not disclose alignment');
const resultWaitStarted=Date.now();await pause(2100);assert.equal((await npc()).body.npcs[0].motion.speed_mps,0);evidence.result_wait_observed_ms=Date.now()-resultWaitStarted;
assert.equal((await call(`/api/sessions/${sid}/event/confirm`,{event_id:active.event.id})).status,200);
assert.equal((await event()).body.phase,'WAITING');const resumed=(await npc()).body;assert.ok(resumed.npcs[0].motion.speed_mps>0);assert.ok(resumed.npcs[0].motion.revision>still.npcs[0].motion.revision);
assert.deepEqual(resumed.npcs[0].motion.points[1],route.resume_points[1],'Resume immediately toward the return waypoint, without advancing to the interaction center');
await pause(2100);const resumedLater=(await npc()).body;
const posA=npcPosition(resumed.npcs[0],Date.parse(resumed.motion_time)),posB=npcPosition(resumedLater.npcs[0],Date.parse(resumedLater.motion_time));
evidence.resumed_server_motion_distance_m=Math.hypot(...posA.map((v,i)=>v-posB[i]));assert.ok(evidence.resumed_server_motion_distance_m>1);
assert.ok(posB[2]<posA[2],'Return moves toward the starting plaza side');
assert.equal((await call(`/api/sessions/${sid}/event/confirm`,{event_id:active.event.id})).status,200);
assert.equal((await call(`/api/sessions/${sid}/event/start`,{request_key:randomUUID()})).body.error.code,'EVENTS_EXHAUSTED');
Object.assign(evidence,{idle,moving,active,stopped,still,choice:choice.body,result,resumed,completed_at:new Date().toISOString()});
if(process.argv[2]){
 const local=JSON.parse(await readFile(process.argv[2],'utf8'));assert.equal(local.session_id,sid);
 const pool=new pg.Pool({connectionString:`postgresql://postgres@127.0.0.1:${local.pgPort}/simus_v003_local`});
 try{
  assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name,'simus_v003_local');
  const ledger=(await pool.query(`SELECT state_version::text,happiness_delta_applied::float8 AS happiness,safety_delta_applied::float8 AS safety,cleanliness_delta_applied::float8 AS cleanliness,(SELECT count(*)::int FROM simus.choice_records WHERE event_id=$2) AS event_records FROM simus.choice_records WHERE id=$1 AND session_id=$3`,[choice.body.record_id,active.event.id,sid])).rows[0];
  assert.equal(ledger.event_records,1);assert.equal(ledger.state_version,choice.body.state_version);
  assert.deepEqual({happiness:ledger.happiness,safety:ledger.safety,cleanliness:ledger.cleanliness},choice.body.city);evidence.ledger=ledger;
 }finally{await pool.end();}
}
const out=process.env.V003_QA_EVIDENCE||'/tmp/simus-v003-api-evidence.json';await writeFile(out,JSON.stringify(evidence,null,2));
console.log('PASS v003 actual API: manual start, real timed arrival, stationary ACTIVE/RESULT, choice replay, applied city values, confirm/resume, exhausted. Evidence:',out,'Arrival ms:',evidence.arrival_observed_ms);
