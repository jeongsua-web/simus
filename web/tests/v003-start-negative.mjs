// Real start transaction checks in the runner's disposable database only.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import pg from 'pg';
const stateFile=process.argv[2];assert.ok(stateFile,'Pass the v003 runner local-state.json');
const state=JSON.parse(await readFile(stateFile,'utf8'));
const base=new URL(state.url).origin;assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const pool=new pg.Pool({connectionString:`postgresql://postgres@127.0.0.1:${state.pgPort}/simus_v003_local`});
const sid=randomUUID(),results=[];
try{
 assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name,'simus_v003_local');
 const canonical=(await pool.query('SELECT npc_motion FROM simus.simulation_sessions WHERE id=$1',[state.session_id])).rows[0].npc_motion;
 await pool.query(`INSERT INTO simus.simulation_sessions(id,name,status,scheduled_end_at,admission_buffer,expected_participants,expected_answers_per_person,impact_scale,rules_snapshot,npc_motion,created_by_admin_id)
 SELECT $1,'QA v003 rejected starts','DRAFT',clock_timestamp()+interval '1 hour',admission_buffer,expected_participants,expected_answers_per_person,impact_scale,rules_snapshot,npc_motion,created_by_admin_id FROM simus.simulation_sessions WHERE id=$2`,[sid,state.session_id]);
 for(const [name,motion] of [['wrong path',{...canonical,path_version:'qa-wrong-path'}],['wrong points',{...canonical,points:[[0,0,0],[1,0,0]]}]]){
  await pool.query('UPDATE simus.simulation_sessions SET npc_motion=$2 WHERE id=$1',[sid,motion]);
  const response=await fetch(`${base}/api/admin/sessions/${sid}/start`,{method:'POST',headers:{authorization:`Bearer ${state.admin_token}`,'content-type':'application/json'},body:JSON.stringify({request_key:randomUUID()})});
  const body=await response.json();assert.equal(response.status,409,JSON.stringify(body));assert.equal(body.error.code,'NPC_PATH_INCOMPATIBLE');
  const after=(await pool.query(`SELECT status,starts_at,(SELECT count(*)::int FROM simus.city_states WHERE session_id=$1) AS city,(SELECT count(*)::int FROM simus.admin_actions WHERE session_id=$1) AS actions FROM simus.simulation_sessions WHERE id=$1`,[sid])).rows[0];
  assert.deepEqual(after,{status:'DRAFT',starts_at:null,city:0,actions:0});results.push({name,status:response.status,code:body.error.code,after});
 }
 const out=process.env.V003_NEGATIVE_EVIDENCE||'/tmp/simus-v003-start-negative.json';await writeFile(out,JSON.stringify({base,sid,source_session:state.session_id,results},null,2));console.log('PASS real v003 start rejects wrong path/points with DRAFT/action/city rollback:',out);
}finally{await pool.end();}
