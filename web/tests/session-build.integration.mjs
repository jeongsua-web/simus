import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { defaultMotion, MAP_VERSION, nodePoint } from '../src/lib/city-v002-graph.mjs';

export async function runSessionBuildIntegration({pool,env,token,templateId}) {
  const headers={authorization:`Bearer ${token}`,'content-type':'application/json'};
  async function call(url,data) {
    const response=await fetch(env.TEST_API_URL+url,{method:data?'POST':'GET',headers,body:data?JSON.stringify(data):undefined});
    return {status:response.status,body:await response.json()};
  }
  const created=await call('/api/admin/sessions',{template_session_id:templateId,name:'Disposable build validation',duration_seconds:600,impact_scale:.1,request_key:randomUUID(),npc_profile:'city-rebuild-v002'});
  assert.equal(created.status,201);const sid=created.body.session_id;
  const file=path.join(env.SIMUS_WEBGL_PUBLIC_ROOT,'city-rebuild-v002-phase1/build.json');
  const raw=await readFile(file,'utf8'),good=JSON.parse(raw);
  const ready=async()=> (await call('/api/admin/sessions')).body.sessions.find(s=>s.id===sid);
  async function blocked(code) {
    assert.equal((await ready()).can_start,false);
    assert.ok((await ready()).readiness.some(r=>r.code===code));
    const r=await call(`/api/admin/sessions/${sid}/start`,{request_key:randomUUID()});
    assert.equal(r.status,409,JSON.stringify(r.body));assert.equal(r.body.error.code,code);
    const check=(await pool.query(`SELECT status,starts_at,(SELECT count(*) FROM simus.city_states WHERE session_id=$1) AS city,
      (SELECT count(*) FROM simus.admin_actions WHERE session_id=$1) AS actions FROM simus.simulation_sessions WHERE id=$1`,[sid])).rows[0];
    assert.deepEqual(check,{status:'DRAFT',starts_at:null,city:'0',actions:'0'});
  }
  try {
    assert.equal((await ready()).can_start,true);
    // Simulate a deployment changing after the admin readiness request.
    await writeFile(file,JSON.stringify({...good,map_version:'dev-synthetic-v1'}));await blocked('CITY_MAP_MISMATCH');
    await writeFile(file,JSON.stringify({...good,npc_motion_enabled:false}));await blocked('CITY_NPC_DISABLED');
    await writeFile(file,JSON.stringify({...good,path_versions:['wrong']}));await blocked('NPC_PATH_INCOMPATIBLE');
    await writeFile(file,'null');await blocked('CITY_BUILD_UNAVAILABLE');
    await writeFile(file,raw);
    await rename(file,file+'.held');
    try { await blocked('CITY_BUILD_UNAVAILABLE'); } finally {await rename(file+'.held',file);}
    await writeFile(file,raw);
    const motion=defaultMotion();
    await pool.query('UPDATE simus.simulation_sessions SET npc_motion=$2 WHERE id=$1',[sid,{...motion,path_version:'wrong'}]);await blocked('NPC_PATH_INCOMPATIBLE');
    await pool.query('UPDATE simus.simulation_sessions SET npc_motion=$2 WHERE id=$1',[sid,{...motion,points:[nodePoint('CAMPUS_PLAZA'),nodePoint('RIVER_E_30')]}]);await blocked('NPC_PATH_INCOMPATIBLE');
    await pool.query('UPDATE simus.simulation_sessions SET npc_motion=$2 WHERE id=$1',[sid,motion]);
    const situation=(await pool.query('SELECT id FROM simus.session_situations WHERE session_id=$1 LIMIT 1',[sid])).rows[0].id;
    await pool.query('UPDATE simus.session_situations SET is_generic=false,event_location=$3 WHERE session_id=$1 AND id=$2',[sid,situation,{map_version:'foreign',point:nodePoint('CAMPUS_PLAZA'),radius_m:2}]);
    await blocked('EVENT_MAP_INCOMPATIBLE');
    await pool.query('UPDATE simus.session_situations SET event_location=$3 WHERE session_id=$1 AND id=$2',[sid,situation,{place_id:'fixture_build_plaza',map_version:MAP_VERSION,point:nodePoint('CAMPUS_PLAZA'),radius_m:2}]);
    assert.equal((await ready()).can_start,true);
    assert.equal((await call(`/api/admin/sessions/${sid}/start`,{request_key:randomUUID()})).status,200);
    assert.equal((await call(`/api/admin/sessions/${sid}/end`,{request_key:randomUUID()})).status,200);
    console.log('PASS actual API: deployment map/path/NPC capability/missing files, off-graph route and foreign event placement block start with full rollback; valid v002 starts/ends');
  } finally {await writeFile(file,raw);}
}
