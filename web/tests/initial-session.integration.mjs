import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { SignJWT } from 'jose';
import { defaultMotion, MAP_VERSION, nodePoint } from '../src/lib/city/city-v002-graph.mjs';
import content from '../src/lib/data/initial-session-content.json' with { type: 'json' };
import v003Route from '../src/lib/routes/data/v003-local-route.json' with { type: 'json' };

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
  const payload = {creation_mode:'initial',name:'Initial city',duration_seconds:600,impact_scale:.1,request_key:randomUUID()};
  const empty = async () => {
    for (const table of ['simulation_sessions','session_creation_requests','session_regions','session_situations','session_choices','choice_region_effects'])
      assert.equal((await pool.query(`SELECT count(*) FROM simus.${table}`)).rows[0].count,'0',table);
  };
  assert.deepEqual((await call(endpoint)).body.sessions, []);
  assert.equal((await call(endpoint,payload,null)).status,401);
  assert.equal((await call(endpoint,payload,await sign('unregistered'))).status,403);
  assert.equal((await call(endpoint,payload,await sign('disabled-admin'))).status,403);
  assert.equal((await call(endpoint,payload,token,{origin:'https://foreign.invalid'})).status,403);
  for (const patch of [{name:''},{name:'x'.repeat(121)},{duration_seconds:9},{duration_seconds:604801},{duration_seconds:10.5},
    {impact_scale:-1},{impact_scale:1.1},{impact_scale:.12345678901},{npc_profile:'legacy'},{template_session_id:randomUUID()},
    {creation_mode:'unknown'},{request_key:'bad'}])
    assert.equal((await call(endpoint,{...payload,...patch})).status,400,JSON.stringify(patch));
  const retired = await call(endpoint, {...payload, npc_profile:'city-rebuild-v002'});
  assert.equal(retired.body.error.code, 'CITY_MAP_RETIRED');
  const unavailable = await call(endpoint, payload);
  assert.equal(unavailable.body.error.code, 'CITY_BUILD_UNAVAILABLE');
  const v003Root=path.join(env.SIMUS_WEBGL_PUBLIC_ROOT,'unity',v003Route.map_version);
  await mkdir(path.join(v003Root,'Build'),{recursive:true});
  for (const name of ['index.html','bridge.js','Build/test.loader.js','Build/test.framework.js','Build/test.wasm','Build/test.data'])
    await writeFile(path.join(v003Root,name),'API-only fixture');
  const file=path.join(v003Root,'build.json');
  await writeFile(file,JSON.stringify({kind:'city-masterplan-v003-local-session',protocol_version:1,
    map_version:v003Route.map_version,path_versions:[v003Route.path_version],npc_motion_enabled:true,
    route_validation_status:v003Route.validation_status,source_scene_sha256:v003Route.source_scene_sha256}));
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
  assert.equal(session.status,'DRAFT');assert.equal(session.starts_at,null);assert.deepEqual(session.npc_motion, { map_version:v003Route.map_version, path_version:v003Route.path_version, points:v003Route.points, speed_mps:v003Route.speed_mps, loop:false });
  assert.equal(session.rules_snapshot.initial_region_pollution.EXHIBITION_CITY,0);
  assert.equal((await pool.query('SELECT count(*) FROM simus.admin_users')).rows[0].count,'3');
  for (const table of ['participant_sessions','city_states','region_states','admin_actions'])
    assert.equal((await pool.query(`SELECT count(*) FROM simus.${table}`)).rows[0].count,'0');
  const situations=(await pool.query('SELECT * FROM simus.session_situations WHERE session_id=$1 ORDER BY display_order',[sid])).rows;
  assert.equal(situations.length,30);assert.ok(situations.every(s=>!s.is_generic));
  for (const situation of situations)
    assert.deepEqual(situation.event_location, situation.code==='EXHIBITION_30' ? v003Route.event_location : null);
  assert.deepEqual(situations.map(s=>s.title),content.situations.map(s=>s.title));
  const choices=(await pool.query(`SELECT c.*,e.pollution_base FROM simus.session_choices c JOIN simus.choice_region_effects e
    ON (e.session_id,e.situation_id,e.choice_id)=(c.session_id,c.situation_id,c.id) WHERE c.session_id=$1 ORDER BY c.situation_id,c.display_order`,[sid])).rows;
  assert.equal(choices.length,91);
  assert.deepEqual(choices.map(c=>[c.label,c.alignment_dx,c.alignment_dy,Number(c.happiness_base),Number(c.safety_base),Number(c.cleanliness_base),Number(c.pollution_base)]),
    content.situations.flatMap(s=>s.choices.map(c=>[c.label,c.scores.order,c.scores.morality,c.scores.happiness,c.scores.safety,c.scores.cleanliness,c.scores.pollution])));
  assert.equal((await call(endpoint)).body.sessions[0].can_start,true);
  const clonePayload={template_session_id:sid,name:'Second city',duration_seconds:300,impact_scale:.2,request_key:randomUUID()};
  const legacy = await call(endpoint,clonePayload);
  assert.equal(legacy.status,201);
  const legacyId=legacy.body.session_id;
  await pool.query('UPDATE simus.simulation_sessions SET npc_motion=$2 WHERE id=$1',[legacyId,defaultMotion()]);
  await pool.query("UPDATE simus.session_regions SET map_metadata=$2 WHERE session_id=$1",[legacyId,{old_boundary:true}]);
  await pool.query('UPDATE simus.session_situations SET event_location=$3 WHERE session_id=$1 AND id=$2',
    [legacyId,situations[1].id,{place_id:'legacy_gate',map_version:MAP_VERSION,point:nodePoint('MN_GATE'),radius_m:1.5}]);
  assert.equal((await call(`${endpoint}/${legacyId}/start`,{request_key:randomUUID()})).body.error.code,'CITY_MAP_RETIRED');
  const v003Payload={...clonePayload,template_session_id:legacyId,request_key:randomUUID()};
  const v003=await call(endpoint,v003Payload);assert.equal(v003.status,201,JSON.stringify(v003.body));
  assert.equal((await call(endpoint,{...v003Payload,npc_profile:'city-masterplan-v003'})).status,200);
  assert.deepEqual((await pool.query('SELECT map_metadata FROM simus.session_regions WHERE session_id=$1',[v003.body.session_id])).rows[0].map_metadata,{});
  assert.equal((await call(endpoint,{...v003Payload,npc_profile:'city-rebuild-v002'})).body.error.code,'REQUEST_KEY_CONFLICT');
  const v003Rows=(await pool.query('SELECT code,event_location FROM simus.session_situations WHERE session_id=$1',[v003.body.session_id])).rows;
  assert.equal(v003Rows.length,30);assert.equal(v003Rows.filter(s=>s.event_location).length,1);
  assert.deepEqual(v003Rows.find(s=>s.code==='EXHIBITION_30').event_location,v003Route.event_location);
  const v003Session=(await pool.query('SELECT npc_motion FROM simus.simulation_sessions WHERE id=$1',[v003.body.session_id])).rows[0];
  assert.equal(v003Session.npc_motion.map_version,v003Route.map_version);
  assert.deepEqual(v003Session.npc_motion.points,v003Route.points);
  assert.equal((await pool.query('SELECT count(*) FROM simus.session_choices WHERE session_id=$1',[v003.body.session_id])).rows[0].count,'91');
  // Omitted duration and impact settings still inherit from the source.
  const inheritedPayload = {template_session_id:v003.body.session_id,name:'Inherited city',request_key:randomUUID()};
  const inherited = await call(endpoint,inheritedPayload);
  assert.equal(inherited.status,201,JSON.stringify(inherited.body));
  assert.equal((await call(endpoint,inheritedPayload)).status,200);
  assert.equal((await call(endpoint,{...inheritedPayload,duration_seconds:601})).body.error.code,'REQUEST_KEY_CONFLICT');
  const inheritedId = inherited.body.session_id;
  const inheritedSession = (await pool.query('SELECT * FROM simus.simulation_sessions WHERE id=$1',[inheritedId])).rows[0];
  assert.deepEqual(inheritedSession.npc_motion,v003Session.npc_motion);
  assert.equal(Number(inheritedSession.impact_scale),.2);
  const listed = (await call(endpoint)).body.sessions.find(s=>s.id===inheritedId);
  assert.equal(listed.duration_seconds,300);assert.equal(listed.impact_scale,.2);
  assert.deepEqual((await pool.query('SELECT code,event_location FROM simus.session_situations WHERE session_id=$1 ORDER BY code',[inheritedId])).rows,
    [...v003Rows].sort((a,b)=>a.code.localeCompare(b.code)));
  for (const table of ['participant_sessions','choice_records','city_states','region_states','session_results'])
    assert.equal((await pool.query(`SELECT count(*) FROM simus.${table} WHERE session_id=$1`,[inheritedId])).rows[0].count,'0');
  const customized = await call(endpoint,{...inheritedPayload,name:'Customized city',duration_seconds:450,impact_scale:.35,request_key:randomUUID()});
  assert.equal(customized.status,201,JSON.stringify(customized.body));
  const customizedSession = (await pool.query('SELECT npc_motion,impact_scale FROM simus.simulation_sessions WHERE id=$1',[customized.body.session_id])).rows[0];
  assert.deepEqual(customizedSession.npc_motion,v003Session.npc_motion);assert.equal(Number(customizedSession.impact_scale),.35);
  assert.equal((await call(endpoint)).body.sessions.find(s=>s.id===customized.body.session_id).duration_seconds,450);
  console.log('PASS v003 default clone: duration and scale inheritance, replay, and optional overrides');
  console.log('PASS v002 template migration: retired start blocked, no legacy spatial data, v003 route and plaza preserved');
  for (const action of ['start','end']) {
    const result=await call(`${endpoint}/${sid}/${action}`,{request_key:randomUUID()});assert.equal(result.status,200,JSON.stringify(result.body));
    if(action==='start') {
      assert.equal(result.body.status,'RUNNING');
      const timing=(await pool.query('SELECT extract(epoch FROM scheduled_end_at-starts_at)::float8 AS seconds FROM simus.simulation_sessions WHERE id=$1',[sid])).rows[0];
      assert.ok(Math.abs(timing.seconds-600)<1);
      const auth = await fetch(`${env.TEST_API_URL}/api/participants`, { method:'POST' });
      assert.equal(auth.status,201);
      const cookie=auth.headers.get('set-cookie').split(';')[0];
      const sessionPath=`/api/sessions/${sid}`;
      const {body:entry}=await call(`${sessionPath}/profile`,undefined,token,{cookie});
      assert.equal((await call(`${sessionPath}/profile`,{nickname:'테스트시민',department_id:entry.departments[0].id,mbti:'ISTJ'},token,{cookie})).status,201);
      let active;
      for (let i=0;i<25;i++) {
        const state=await call(`${sessionPath}/event`,undefined,token,{cookie});
        assert.equal(state.status,200);
        if (state.body.phase==='ACTIVE') { active=state.body.event; break; }
        await new Promise(resolve=>setTimeout(resolve,1000));
      }
      assert.equal(active?.situation.code,'EXHIBITION_30');
      const choice={session_id:sid,event_id:active.id,situation_id:active.situation_id,choice_id:active.situation.choices[0].id,request_key:randomUUID()};
      assert.equal((await call('/api/choices',choice,token,{cookie})).status,201);
      assert.equal((await call('/api/choices',choice,token,{cookie})).status,200);
      assert.equal((await call(`${sessionPath}/event`,undefined,token,{cookie})).body.phase,'WAITING');
    }
  }
  assert.equal((await call(endpoint,payload)).body.status,'FINALIZED','replay works after lifecycle transition');
  assert.equal((await call(endpoint,{...clonePayload,request_key:randomUUID(),name:'From finalized'})).status,201);
  console.log('PASS initial API: empty DB, RS256/admin/origin checks, input validation, build mismatch, atomic rollback, concurrent admins/replays, 30 situations/91 exact choices/effects, no runtime rows, automatic plaza event and choice, DRAFT clone, explicit start/end and FINALIZED clone');
}
