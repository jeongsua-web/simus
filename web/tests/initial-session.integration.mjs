import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { SignJWT } from 'jose';
import { MAP_VERSION, defaultMotion, nodePoint } from '../src/lib/city-v002-graph.mjs';
import content from '../src/lib/data/initial-session-content.json' with { type: 'json' };

// Called only by the disposable-cluster runner; never connects to a configured DB.
export async function runInitialSessionIntegration({ pool, env, privateKey, publicJwk }) {
  const endpoint = '/api/admin/sessions';
  const sign = (sub) => new SignJWT({}).setProtectedHeader({ alg: 'RS256', kid: publicJwk.kid })
    .setIssuer(env.ADMIN_TOKEN_ISSUER).setAudience(env.ADMIN_TOKEN_AUDIENCE).setSubject(sub)
    .setIssuedAt().setExpirationTime('10m').sign(privateKey);
  const token = await sign('initial-admin');
  const secondToken = await sign('second-admin');
  await pool.query(`INSERT INTO simus.admin_users(auth_subject,display_name,is_active)
    VALUES('initial-admin','Initial test',true),('second-admin','Second test',true),('disabled-admin','Disabled',false)`);
  const call = async (url, data, bearer = token, extra = {}) => {
    const r = await fetch(env.TEST_API_URL + url, { method: data ? 'POST' : 'GET',
      headers: { 'content-type': 'application/json', ...(bearer ? {authorization: `Bearer ${bearer}`} : {}), ...extra },
      body: data ? JSON.stringify(data) : undefined });
    return { status: r.status, body: await r.json() };
  };
  const payload = {creation_mode:'initial',npc_profile:'city-rebuild-v002',name:'Initial city',duration_seconds:600,impact_scale:.1,request_key:randomUUID()};
  const empty = async () => {
    for (const table of ['simulation_sessions','session_creation_requests','session_regions','session_situations','session_choices','choice_region_effects'])
      assert.equal((await pool.query(`SELECT count(*) FROM simus.${table}`)).rows[0].count,'0',table);
  };
  assert.deepEqual((await call(endpoint)).body.sessions, []);
  assert.equal((await call(endpoint,payload,null)).status,401);
  assert.equal((await call(endpoint,payload,await sign('unregistered'))).status,403);
  assert.equal((await call(endpoint,payload,await sign('disabled-admin'))).status,403);
  assert.equal((await call(endpoint,payload,token,{origin:'https://foreign.invalid'})).status,403);
  for (const patch of [{name:''},{name:'x'.repeat(121)},{duration_seconds:9},{duration_seconds:86401},{duration_seconds:10.5},
    {impact_scale:-1},{impact_scale:1.1},{impact_scale:.12345678901},{npc_profile:'legacy'},{template_session_id:randomUUID()},
    {creation_mode:'unknown'},{request_key:'bad'}])
    assert.equal((await call(endpoint,{...payload,...patch})).status,400,JSON.stringify(patch));
  const file=path.join(env.SIMUS_WEBGL_PUBLIC_ROOT,'city-rebuild-v002/build.json');
  const raw=await readFile(file,'utf8');
  try {
    await writeFile(file,JSON.stringify({...JSON.parse(raw),map_version:'foreign'}));
    const r=await call(endpoint,payload);assert.equal(r.status,409);assert.equal(r.body.error.code,'CITY_MAP_MISMATCH');
    await empty();
  } finally {await writeFile(file,raw);}
  // Force failure midway through authored content insertion and prove atomic rollback.
  await pool.query(`CREATE FUNCTION simus.fail_initial_choice() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    RAISE EXCEPTION 'isolated injected content error' USING ERRCODE='23514'; END $$;
    CREATE TRIGGER fail_initial_choice BEFORE INSERT ON simus.session_choices FOR EACH ROW EXECUTE FUNCTION simus.fail_initial_choice()`);
  try {assert.equal((await call(endpoint,payload)).status,409);await empty();}
  finally {await pool.query('DROP TRIGGER fail_initial_choice ON simus.session_choices; DROP FUNCTION simus.fail_initial_choice()');}
  const responses=await Promise.all([call(endpoint,payload),call(endpoint,payload),call(endpoint,{...payload,request_key:randomUUID()},secondToken)]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,201,409]);
  const sid=responses.find(r=>r.status===201).body.session_id;
  assert.equal(responses.find(r=>r.status===200).body.session_id,sid);
  assert.equal((await call(endpoint,{...payload,name:'Changed'})).body.error.code,'REQUEST_KEY_CONFLICT');
  assert.equal((await call(endpoint,{...payload,request_key:randomUUID()})).body.error.code,'INITIAL_SESSION_EXISTS');
  const session=(await pool.query('SELECT * FROM simus.simulation_sessions WHERE id=$1',[sid])).rows[0];
  assert.equal(session.status,'DRAFT');assert.equal(session.starts_at,null);assert.deepEqual(session.npc_motion,defaultMotion());
  assert.equal(session.rules_snapshot.initial_region_pollution.EXHIBITION_CITY,0);
  assert.equal((await pool.query('SELECT count(*) FROM simus.admin_users')).rows[0].count,'3');
  for (const table of ['participant_sessions','city_states','region_states','admin_actions'])
    assert.equal((await pool.query(`SELECT count(*) FROM simus.${table}`)).rows[0].count,'0');
  const situations=(await pool.query('SELECT * FROM simus.session_situations WHERE session_id=$1 ORDER BY display_order',[sid])).rows;
  assert.equal(situations.length,30);assert.ok(situations.every(s=>s.event_location===null&&!s.is_generic));
  assert.deepEqual(situations.map(s=>s.title),content.situations.map(s=>s.title));
  const choices=(await pool.query(`SELECT c.*,e.pollution_base FROM simus.session_choices c JOIN simus.choice_region_effects e
    ON (e.session_id,e.situation_id,e.choice_id)=(c.session_id,c.situation_id,c.id) WHERE c.session_id=$1 ORDER BY c.situation_id,c.display_order`,[sid])).rows;
  assert.equal(choices.length,91);
  assert.deepEqual(choices.map(c=>[c.label,c.alignment_dx,c.alignment_dy,Number(c.happiness_base),Number(c.safety_base),Number(c.cleanliness_base),Number(c.pollution_base)]),
    content.situations.flatMap(s=>s.choices.map(c=>[c.label,c.scores.order,c.scores.morality,c.scores.happiness,c.scores.safety,c.scores.cleanliness,c.scores.pollution])));
  assert.equal((await call(endpoint)).body.sessions[0].can_start,true);
  // The existing map editor accepts an authored v002 point on the initial round.
  const location=await fetch(`${env.TEST_API_URL}${endpoint}/${sid}/event-locations`,{method:'PUT',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},
    body:JSON.stringify({situation_id:situations[0].id,is_generic:false,event_location:{map_version:MAP_VERSION,point:nodePoint('CAMPUS_PLAZA'),radius_m:2}})});
  assert.equal(location.status,200,await location.text());
  const clonePayload={template_session_id:sid,npc_profile:'city-rebuild-v002',name:'Second city',duration_seconds:300,impact_scale:.2,request_key:randomUUID()};
  const clone=await call(endpoint,clonePayload);assert.equal(clone.status,201);assert.equal(clone.body.status,'DRAFT');
  assert.equal((await call(endpoint,clonePayload)).status,200);
  assert.equal((await pool.query('SELECT count(*) FROM simus.session_situations WHERE session_id=$1',[clone.body.session_id])).rows[0].count,'30');
  assert.equal((await pool.query('SELECT event_location FROM simus.session_situations WHERE session_id=$1 AND id=$2',[clone.body.session_id,situations[0].id])).rows[0].event_location.map_version,MAP_VERSION);
  for (const action of ['start','end']) {
    const result=await call(`${endpoint}/${sid}/${action}`,{request_key:randomUUID()});assert.equal(result.status,200,JSON.stringify(result.body));
    if(action==='start') {
      assert.equal(result.body.status,'RUNNING');
      const timing=(await pool.query('SELECT extract(epoch FROM scheduled_end_at-starts_at)::float8 AS seconds FROM simus.simulation_sessions WHERE id=$1',[sid])).rows[0];
      assert.ok(Math.abs(timing.seconds-600)<1);
    }
  }
  assert.equal((await call(endpoint,payload)).body.status,'FINALIZED','replay works after lifecycle transition');
  assert.equal((await call(endpoint,{...clonePayload,request_key:randomUUID(),name:'From finalized'})).status,201);
  console.log('PASS initial API: empty DB, RS256/admin/origin checks, input validation, build mismatch, atomic rollback, concurrent admins/replays, 30 situations/91 exact choices/effects, no runtime rows, location editor, DRAFT clone, explicit start/end and FINALIZED clone');
}
