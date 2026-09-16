import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { importJWK, SignJWT } from 'jose';
import { runBrowserFlow } from './isolated-browser.mjs';

export async function runFlow({ pool, env, stopServer, startServer }) {
  const key = await importJWK(JSON.parse(env.TEST_ADMIN_PRIVATE_JWK), 'RS256');
  const token = await new SignJWT({}).setProtectedHeader({ alg:'RS256', kid:'isolated-test' })
    .setIssuer(env.ADMIN_TOKEN_ISSUER).setAudience(env.ADMIN_TOKEN_AUDIENCE).setSubject('flow-admin').setIssuedAt().setExpirationTime('10m').sign(key);
  async function call(url, { data, cookie, auth, method, headers = {} } = {}) {
    const response = await fetch(env.TEST_API_URL + url, { method: method ?? (data ? 'POST' : 'GET'),
      headers: { ...(data ? { 'Content-Type':'application/json' } : {}), ...(cookie ? {cookie} : {}), ...(auth ? {authorization:`Bearer ${auth}`} : {}), ...headers }, body: data ? JSON.stringify(data) : undefined });
    return { status:response.status, body:await response.json(), cookie:response.headers.get('set-cookie')?.split(';')[0] };
  }
  const admin = randomUUID();
  assert.equal((await call('/api/participants', { method: 'POST', headers: { origin: env.TEST_API_URL } })).status, 201);
  assert.equal((await call('/api/participants', { method: 'POST', headers: { origin: 'https://untrusted.invalid' } })).status, 403);
  assert.equal((await call('/api/participants', { method: 'POST', headers: { origin: env.TEST_API_URL, 'sec-fetch-site': 'cross-site' } })).status, 403);
  console.log('PASS: matching browser Origin accepted; foreign Origin and cross-site requests rejected');
  await pool.query("INSERT INTO simus.admin_users(id,auth_subject,display_name) VALUES($1,'flow-admin','Isolated Test')", [admin]);
  const rules = { version:1,alignment_thresholds:{negative:-3,positive:3},alignment_axes:{x:{negative:'CHAOTIC',positive:'LAWFUL'},y:{negative:'EVIL',positive:'GOOD'}},
    interpretations:Object.fromEntries(['LAWFUL_GOOD','LAWFUL_NEUTRAL','LAWFUL_EVIL','NEUTRAL_GOOD','TRUE_NEUTRAL','NEUTRAL_EVIL','CHAOTIC_GOOD','CHAOTIC_NEUTRAL','CHAOTIC_EVIL'].map(x=>[x,x])),
    initial_city_state:{happiness:50,safety:50,cleanliness:50},initial_region_pollution:{CENTER:20,RIVER:40},zero_response_policy:'EXCLUDE',completion_policy:'DRAIN' };
  async function round(seconds = 3600, buffer = 2) {
    const sid=randomUUID(), tid=randomUUID(), a=randomUUID(), b=randomUUID();
    await pool.query(`INSERT INTO simus.simulation_sessions(id,name,scheduled_end_at,admission_buffer,expected_participants,expected_answers_per_person,impact_scale,rules_snapshot,created_by_admin_id)
      VALUES($1,'Isolated flow',clock_timestamp()+$2*interval '1 second',$3*interval '1 second',10,1,1,$4,$5)`,[sid,seconds,buffer,rules,admin]);
    const regionIds=[randomUUID(),randomUUID()];
    for(const [i,code] of ['CENTER','RIVER'].entries()) await pool.query('INSERT INTO simus.session_regions(session_id,id,code,name,aggregation_weight) VALUES($1,$2,$3,$3,$4)',[sid,regionIds[i],code,i+1]);
    await pool.query("INSERT INTO simus.session_situations(session_id,id,code,title,body) VALUES($1,$2,'S','Test','Test')",[sid,tid]);
    await pool.query(`INSERT INTO simus.session_choices(session_id,situation_id,id,label,alignment_dx,alignment_dy,happiness_base,safety_base,cleanliness_base)
      VALUES($1,$2,$3,'A',1,1,1,2,3),($1,$2,$4,'B',-1,-1,-1,-2,-3)`,[sid,tid,a,b]);
    for(const [i,rid] of regionIds.entries()) await pool.query('INSERT INTO simus.choice_region_effects(session_id,situation_id,choice_id,region_id,pollution_base) VALUES($1,$2,$3,$4,$5)',[sid,tid,a,rid,i===0?-3:6]);
    return {sid,tid,a,b};
  }
  const r=await round();
  const startKey=randomUUID();
  assert.equal((await call(`/api/admin/sessions/${r.sid}/start`,{auth:token,data:{request_key:startKey}})).status,200);
  assert.equal((await call(`/api/admin/sessions/${r.sid}/start`,{auth:token,data:{request_key:startKey}})).body.replayed,true);
  const people=await Promise.all(Array.from({length:8},()=>call('/api/participants',{method:'POST'})));
  assert.equal(new Set(people.map(p=>p.body.participant_id)).size,8);
  const payloads=people.map(()=>({session_id:r.sid,situation_id:r.tid,choice_id:r.a,request_key:randomUUID()}));
  const results=await Promise.all(people.flatMap((p,i)=>[call('/api/choices',{cookie:p.cookie,data:payloads[i]}),call('/api/choices',{cookie:p.cookie,data:payloads[i]})]));
  assert.equal(results.filter(x=>x.status===201).length,8); assert.equal(results.filter(x=>x.status===200).length,8);
  const city=(await call('/api/city-state')).body.city_state;
  assert.deepEqual([city.version,city.happiness,city.safety,city.cleanliness],['8',58,66,74]);
  assert.deepEqual(Object.fromEntries(city.regions.map(x=>[x.code,x.pollution])),{CENTER:0,RIVER:88});
  assert.equal(city.overall_pollution,176/3);
  const scores=await pool.query('SELECT x_score,y_score,response_count FROM simus.participant_alignments WHERE session_id=$1',[r.sid]);
  assert.ok(scores.rows.every(x=>x.x_score==='1'&&x.y_score==='1'&&x.response_count==='1'));
  const ledger=await pool.query('SELECT sum(delta_applied)::float8 AS applied FROM simus.choice_record_region_effects WHERE session_id=$1',[r.sid]);
  assert.equal(ledger.rows[0].applied,28);
  assert.equal((await call('/api/choices',{cookie:people[0].cookie,data:{...payloads[0],request_key:randomUUID()}})).body.error.code,'ALREADY_ANSWERED');
  assert.equal((await call('/api/choices',{cookie:people[0].cookie,data:{...payloads[0],choice_id:r.b}})).body.error.code,'REQUEST_KEY_CONFLICT');
  const restored=await call(`/api/sessions/${r.sid}/responses`,{cookie:people[0].cookie});
  assert.deepEqual(Object.keys(restored.body.responses[0]).sort(),['choice_id','received_at','situation_id']);
  assert.equal(restored.body.responses[0].choice_id,r.a);
  assert.equal((await call(`/api/sessions/${r.sid}/result`,{cookie:people[0].cookie})).status,409);
  console.log('PASS: 8 independent HTTP cookie identities, 16 concurrent submissions, exactly 8 ledger entries; city/people/weighted regions/clamping, own-response restoration, hidden pre-result');
  await stopServer();
  await assert.rejects(fetch(env.TEST_API_URL+'/api/city-state',{signal:AbortSignal.timeout(1000)}));
  await startServer();
  assert.equal((await call('/api/city-state')).body.city_state.version,'8');
  assert.equal((await call('/api/choices',{cookie:people[0].cookie,data:payloads[0]})).status,200);
  const endKey=randomUUID();
  const ends=await Promise.all(Array.from({length:4},()=>call(`/api/admin/sessions/${r.sid}/end`,{auth:token,data:{request_key:endKey}})));
  assert.ok(ends.every(x=>x.status===200));
  const stranger=await call('/api/participants',{method:'POST'});
  assert.equal((await call(`/api/sessions/${r.sid}/result`,{cookie:stranger.cookie})).body.result,null);
  for(const p of people) assert.equal((await call(`/api/sessions/${r.sid}/result?participant_id=${stranger.body.participant_id}`,{cookie:p.cookie})).body.result.response_count,'1');
  assert.equal((await call('/api/choices',{cookie:stranger.cookie,data:{...payloads[0],request_key:randomUUID()}})).status,409);
  assert.equal((await call('/api/choices',{cookie:people[0].cookie,data:payloads[0]})).status,200);
  assert.equal((await pool.query('SELECT count(*) FROM simus.session_results WHERE session_id=$1',[r.sid])).rows[0].count,'1');
  console.log('PASS: server process stop/restart, persisted replay, concurrent manual end, immutable single final result, own-result isolation');
  const r2=await round(9,3);
  assert.equal((await call(`/api/admin/sessions/${r2.sid}/start`,{auth:token,data:{request_key:randomUUID()}})).status,200);
  const fresh=(await call('/api/city-state')).body.city_state;
  assert.equal(fresh.session_id,r2.sid); assert.equal(fresh.version,'0'); assert.equal(fresh.happiness,50);
  assert.equal((await call(`/api/sessions/${r2.sid}/responses`,{cookie:people[0].cookie})).body.responses.length,0);
  // Hold the parent lock: request admitted by HTTP before cutoff must still be rejected by DB time after lock release.
  const lock=await pool.connect();
  await lock.query('BEGIN'); await lock.query('SELECT id FROM simus.simulation_sessions WHERE id=$1 FOR UPDATE',[r2.sid]);
  const cutoff=(await pool.query('SELECT extract(epoch from (scheduled_end_at-admission_buffer-clock_timestamp()))*1000 AS ms FROM simus.simulation_sessions WHERE id=$1',[r2.sid])).rows[0].ms;
  await new Promise(resolve=>setTimeout(resolve,Math.max(0,Number(cutoff)-600)));
  const boundary=call('/api/choices',{cookie:people[0].cookie,data:{session_id:r2.sid,situation_id:r2.tid,choice_id:r2.a,request_key:randomUUID()}});
  await new Promise(resolve=>setTimeout(resolve,900)); await lock.query('COMMIT'); lock.release();
  assert.equal((await boundary).body.error.code,'SESSION_CLOSED');
  assert.equal((await call('/api/sessions/current')).body.session.accepting_choices,false);
  await new Promise(resolve=>setTimeout(resolve,3100));
  const jobs=await Promise.all(Array.from({length:3},()=>call('/api/internal/sessions/reconcile',{method:'POST',auth:env.SESSION_JOB_TOKEN})));
  assert.ok(jobs.every(x=>x.status===200));
  assert.equal((await pool.query('SELECT status,end_mode FROM simus.simulation_sessions WHERE id=$1',[r2.sid])).rows[0].status,'FINALIZED');
  assert.equal((await pool.query('SELECT count(*) FROM simus.session_results WHERE session_id=$1',[r2.sid])).rows[0].count,'1');
  assert.equal((await pool.query('SELECT count(*) FROM simus.choice_records WHERE session_id=$1',[r2.sid])).rows[0].count,'0');
  console.log('PASS: fresh round isolation, lock-delayed cutoff rejection/rollback, concurrent automatic reconcile exactly once');
  const r3=await round();
  await call(`/api/admin/sessions/${r3.sid}/start`,{auth:token,data:{request_key:randomUUID()}});
  await pool.query("UPDATE simus.simulation_sessions SET status='CLOSING',admission_closed_at=clock_timestamp(),end_requested_at=clock_timestamp(),end_mode='AUTO' WHERE id=$1",[r3.sid]);
  await stopServer(); await startServer();
  assert.equal((await call('/api/city-state')).body.city_state.status,'CLOSING');
  assert.equal((await call('/api/internal/sessions/reconcile',{method:'POST',auth:env.SESSION_JOB_TOKEN})).status,200);
  assert.equal((await call('/api/city-state')).body.city_state.status,'FINALIZED');
  console.log('PASS: persisted CLOSING recovered after actual server restart');
  const race = await round(3, 1);
  assert.equal((await call(`/api/admin/sessions/${race.sid}/start`, { auth: token, data: { request_key: randomUUID() } })).status, 200);
  const closedAt = (await pool.query('UPDATE simus.simulation_sessions SET admission_closed_at=clock_timestamp() WHERE id=$1 RETURNING admission_closed_at', [race.sid])).rows[0].admission_closed_at;
  await new Promise(resolve => setTimeout(resolve, 3100));
  const raceKey = randomUUID();
  const raced = await Promise.all([
    call(`/api/admin/sessions/${race.sid}/end`, { auth: token, data: { request_key: raceKey } }),
    call('/api/internal/sessions/reconcile', { method: 'POST', auth: env.SESSION_JOB_TOKEN }),
    call('/api/choices', { cookie: people[0].cookie, data: { session_id: race.sid, situation_id: race.tid, choice_id: race.a, request_key: randomUUID() } }),
  ]);
  assert.deepEqual(raced.map(x => x.status), [200, 200, 409]);
  assert.deepEqual((await pool.query('SELECT admission_closed_at FROM simus.simulation_sessions WHERE id=$1', [race.sid])).rows[0].admission_closed_at, closedAt);
  const finalBefore = (await pool.query('SELECT * FROM simus.session_results WHERE session_id=$1', [race.sid])).rows;
  assert.equal(finalBefore.length, 1);
  await call(`/api/admin/sessions/${race.sid}/end`, { auth: token, data: { request_key: raceKey } });
  await call('/api/internal/sessions/reconcile', { method: 'POST', auth: env.SESSION_JOB_TOKEN });
  assert.deepEqual((await pool.query('SELECT * FROM simus.session_results WHERE session_id=$1', [race.sid])).rows, finalBefore);
  console.log('PASS: competing manual/automatic end and post-deadline submission; final snapshot unchanged by retries');
  await runBrowserFlow({ env, pool, round, token, call });
}
