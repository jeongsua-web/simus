// Run against a disposable database initialized with db/001 and db/002.
import assert from 'node:assert/strict';
import { SignJWT } from 'jose';
import pg from 'pg';

const base = process.env.TEST_API_URL ?? 'http://localhost:3101';
if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL must point to a disposable database');
const db = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
const sid = '11000000-0000-0000-0000-000000000001';
const admin = '00000000-0000-0000-0000-000000000001';
const issuer = process.env.ADMIN_TOKEN_ISSUER;
const audience = process.env.ADMIN_TOKEN_AUDIENCE;
const privateJwk = process.env.TEST_ADMIN_PRIVATE_JWK && JSON.parse(process.env.TEST_ADMIN_PRIVATE_JWK);
if (!issuer || !audience || !privateJwk) throw new Error('test signing configuration is required');
const { importJWK } = await import('jose');
const key = await importJWK(privateJwk, 'RS256');
const token = await new SignJWT({}).setProtectedHeader({ alg:'RS256', kid:privateJwk.kid })
  .setIssuer(issuer).setAudience(audience).setSubject('lifecycle-admin').setIssuedAt().setExpirationTime('5m').sign(key);

async function call(path, { data, cookie, auth, method } = {}) {
  const response = await fetch(base + path, { method: method ?? (data ? 'POST' : 'GET'), headers: {
    ...(data ? {'Content-Type':'application/json'} : {}), ...(cookie ? {cookie} : {}), ...(auth ? {authorization:`Bearer ${auth}`} : {})
  }, body:data ? JSON.stringify(data) : undefined });
  return { status:response.status, body:await response.json(), cookie:response.headers.get('set-cookie')?.split(';')[0] };
}
const rules = {version:1,alignment_thresholds:{negative:-3,positive:3},
  alignment_axes:{x:{negative:'CHAOTIC',positive:'LAWFUL'},y:{negative:'EVIL',positive:'GOOD'}},
  interpretations:Object.fromEntries(['LAWFUL_GOOD','LAWFUL_NEUTRAL','LAWFUL_EVIL','NEUTRAL_GOOD','TRUE_NEUTRAL','NEUTRAL_EVIL','CHAOTIC_GOOD','CHAOTIC_NEUTRAL','CHAOTIC_EVIL'].map(x=>[x,`result:${x}`])),
  initial_city_state:{happiness:50,safety:50,cleanliness:50},initial_region_pollution:{CENTER:7},zero_response_policy:'EXCLUDE',completion_policy:'DRAIN'};
try {
  await db.query(`INSERT INTO simus.admin_users(id,auth_subject,display_name) VALUES($1,'lifecycle-admin','Lifecycle Admin')`,[admin]);
  await db.query(`INSERT INTO simus.simulation_sessions(id,name,scheduled_end_at,expected_participants,expected_answers_per_person,impact_scale,rules_snapshot,created_by_admin_id)
    VALUES($1,'Lifecycle',clock_timestamp()+interval '1 hour',10,1,1,$2,$3)`,[sid,rules,admin]);
  await db.query(`INSERT INTO simus.session_regions(session_id,id,code,name) VALUES($1,'22000000-0000-0000-0000-000000000001','CENTER','Center')`,[sid]);
  await db.query(`INSERT INTO simus.session_situations(session_id,id,code,title,body) VALUES($1,'33000000-0000-0000-0000-000000000001','S','Situation','Body')`,[sid]);
  await db.query(`INSERT INTO simus.session_choices(session_id,situation_id,id,label,importance,alignment_dx,alignment_dy,happiness_base)
    VALUES($1,'33000000-0000-0000-0000-000000000001','44000000-0000-0000-0000-000000000001','A','MAJOR',2,2,1),
          ($1,'33000000-0000-0000-0000-000000000001','44000000-0000-0000-0000-000000000002','B','NORMAL',-1,-1,-1)`,[sid]);
  assert.equal((await call(`/api/admin/sessions/${sid}/start`,{data:{request_key:'55000000-0000-0000-0000-000000000001'}})).status,401);
  assert.equal((await call(`/api/admin/sessions/${sid}/start`,{auth:token,data:{request_key:'55000000-0000-0000-0000-000000000001'}})).status,200);
  const participant = await call('/api/participants',{method:'POST'});
  const choice = {session_id:sid,situation_id:'33000000-0000-0000-0000-000000000001',choice_id:'44000000-0000-0000-0000-000000000001',request_key:'66000000-0000-0000-0000-000000000001'};
  assert.equal((await call('/api/choices',{cookie:participant.cookie,data:choice})).status,201);
  assert.equal((await call(`/api/sessions/${sid}/result`,{cookie:participant.cookie})).status,409);
  const endKey='77000000-0000-0000-0000-000000000001';
  const concurrent = await Promise.all([
    call(`/api/admin/sessions/${sid}/end`,{auth:token,data:{request_key:endKey}}),
    call(`/api/admin/sessions/${sid}/end`,{auth:token,data:{request_key:endKey}})
  ]);
  assert.deepEqual(concurrent.map(x=>x.status),[200,200]);
  const own = await call(`/api/sessions/${sid}/result`,{cookie:participant.cookie});
  assert.equal(own.status,200); assert.equal(own.body.result.alignment_code,'TRUE_NEUTRAL');
  assert.equal(own.body.result.interpretation,'result:TRUE_NEUTRAL');
  const stranger = await call('/api/participants',{method:'POST'});
  assert.equal((await call(`/api/sessions/${sid}/result`,{cookie:stranger.cookie})).body.result,null);
  assert.equal((await db.query('SELECT count(*) FROM simus.session_results WHERE session_id=$1',[sid])).rows[0].count,'1');

  // Recovery: emulate a committed CLOSING state left by a stopped server.
  const sid2='11000000-0000-0000-0000-000000000002';
  await db.query(`INSERT INTO simus.simulation_sessions(id,name,scheduled_end_at,expected_participants,expected_answers_per_person,impact_scale,rules_snapshot,created_by_admin_id)
    SELECT $1,'Recovery',clock_timestamp()+interval '1 hour',10,1,1,$2,$3`,[sid2,rules,admin]);
  await db.query(`INSERT INTO simus.session_regions(session_id,id,code,name) VALUES($1,'22000000-0000-0000-0000-000000000002','CENTER','Center')`,[sid2]);
  await db.query(`INSERT INTO simus.session_situations(session_id,id,code,title,body) VALUES($1,'33000000-0000-0000-0000-000000000002','S','Situation','Body')`,[sid2]);
  await db.query(`INSERT INTO simus.session_choices(session_id,situation_id,label) VALUES($1,'33000000-0000-0000-0000-000000000002','A'),($1,'33000000-0000-0000-0000-000000000002','B')`,[sid2]);
  await call(`/api/admin/sessions/${sid2}/start`,{auth:token,data:{request_key:'55000000-0000-0000-0000-000000000002'}});
  await db.query(`UPDATE simus.simulation_sessions SET status='CLOSING',admission_closed_at=clock_timestamp(),end_requested_at=clock_timestamp(),end_mode='AUTO' WHERE id=$1`,[sid2]);
  assert.equal((await call('/api/internal/sessions/reconcile',{auth:process.env.SESSION_JOB_TOKEN,method:'POST'})).status,200);
  assert.equal((await call('/api/internal/sessions/reconcile',{auth:process.env.SESSION_JOB_TOKEN,method:'POST'})).body.sessions.length,0);
  assert.equal((await db.query('SELECT status FROM simus.simulation_sessions WHERE id=$1',[sid2])).rows[0].status,'FINALIZED');

  // Automatic ending uses the same reconcile/finalize path from RUNNING.
  const sid3='11000000-0000-0000-0000-000000000003';
  await db.query(`INSERT INTO simus.simulation_sessions(id,name,scheduled_end_at,admission_buffer,expected_participants,expected_answers_per_person,impact_scale,rules_snapshot,created_by_admin_id)
    VALUES($1,'Automatic',clock_timestamp()+interval '1 second',interval '100 milliseconds',10,1,1,$2,$3)`,[sid3,rules,admin]);
  await db.query(`INSERT INTO simus.session_regions(session_id,id,code,name) VALUES($1,'22000000-0000-0000-0000-000000000003','CENTER','Center')`,[sid3]);
  await db.query(`INSERT INTO simus.session_situations(session_id,id,code,title,body) VALUES($1,'33000000-0000-0000-0000-000000000003','S','Situation','Body')`,[sid3]);
  await db.query(`INSERT INTO simus.session_choices(session_id,situation_id,label) VALUES($1,'33000000-0000-0000-0000-000000000003','A'),($1,'33000000-0000-0000-0000-000000000003','B')`,[sid3]);
  assert.equal((await call(`/api/admin/sessions/${sid3}/start`,{auth:token,data:{request_key:'55000000-0000-0000-0000-000000000003'}})).status,200);
  await new Promise(resolve=>setTimeout(resolve,1100));
  assert.equal((await call('/api/internal/sessions/reconcile',{auth:process.env.SESSION_JOB_TOKEN,method:'POST'})).status,200);
  const automatic = (await db.query('SELECT status,end_mode,ended_by_admin_id FROM simus.simulation_sessions WHERE id=$1',[sid3])).rows[0];
  assert.deepEqual(automatic,{status:'FINALIZED',end_mode:'AUTO',ended_by_admin_id:null});
  await db.query('UPDATE simus.admin_users SET is_active=false WHERE id=$1',[admin]);
  assert.equal((await call(`/api/admin/sessions/${sid3}/end`,{auth:token,data:{request_key:'77000000-0000-0000-0000-000000000003'}})).status,403);
  console.log('PASS: admin authorization, inactive-admin denial, validation/start, hidden pre-result, concurrent idempotent end, own-result authorization, recovery, automatic end');
} finally { await db.end(); }
