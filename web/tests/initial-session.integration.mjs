import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SignJWT } from 'jose';
import { defaultMotion, MAP_VERSION, nodePoint } from '../src/lib/city/city-v002-graph.mjs';
import { npcPosition } from '../src/app/participate/lib/npc-motion.ts';
import content from '../src/lib/data/initial-session-content.json' with { type: 'json' };
import v003Route from '../src/lib/routes/data/v003-local-route.json' with { type: 'json' };

async function verifyEventBrowser({ env, sessionPath }) {
  const { chromium } = await import(pathToFileURL(env.TEST_EVENT_PLAYWRIGHT_MODULE).href);
  const browser = await chromium.launch({
    executablePath: env.TEST_CHROMIUM_EXECUTABLE,
    headless: true,
    args: ['--enable-unsafe-swiftshader'],
  });
  try {
    const context = await browser.newContext({ baseURL: env.TEST_API_URL, viewport: { width: 390, height: 820 } });
    const { request } = context;
    const participant = await request.post('/api/participants', { data: {} });
    assert.equal(participant.status(),201);
    const [name, value] = participant.headers()['set-cookie'].split(';')[0].split('=');
    await context.clearCookies();
    await context.addCookies([{ name, value, url: env.TEST_API_URL, httpOnly: true }]);
    const profile = await request.get(`${sessionPath}/profile`);
    assert.equal(profile.status(),200,await profile.text());
    const { departments } = await profile.json();
    assert.equal((await request.post(`${sessionPath}/profile`, {
      data: { nickname: '화면검증시민', department_id: departments[0].id, mbti: 'ISTJ' },
    })).status(),201);
    const page = await context.newPage();
    await page.goto('/participate');
    await page.getByLabel('테스트할 상황').selectOption({ label: '26 · 갑자기 정전이 발생했다' });
    const city = page.getByRole('region', { name: '내 캐릭터를 따라가는 도시' });
    await city.getByText('내 캐릭터를 따라가는 중', { exact: true }).waitFor({ timeout: 90_000 });
    assert.match(await page.getByTitle('SIM:US 도시').getAttribute('src'),/\/event-tests\//);
    await page.getByRole('button', { name: '선택한 상황 시작' }).click();
    await page.getByRole('heading', { name: '갑자기 정전이 발생했다' }).waitFor();
    await city.locator('[data-active="true"][class*="blackout"]').waitFor();
    await page.getByText('안내에 따라 기다린다.', { exact: true }).click();
    await page.getByRole('button', { name: '선택 제출' }).click();
    await city.locator('[data-active="false"][class*="blackout"]').waitFor();

    await page.getByLabel('테스트할 상황').selectOption({ label: '08 · 카페 직원이 거스름돈을 더 줬다' });
    await page.getByRole('button', { name: '선택한 상황 시작' }).click();
    await page.getByText('새로운 상황을 만나러 이동 중이에요', { exact: true }).waitFor();
    await page.getByRole('heading', { name: '카페 직원이 거스름돈을 더 줬다' }).waitFor({ timeout: 30_000 });
    let npc = (await (await request.get(`${sessionPath}/npc`)).json()).npcs[0];
    assert.equal(npc.hidden,true);
    await city.getByText('내 캐릭터를 따라가는 중', { exact: true }).waitFor();
    await page.getByText('더 받은 돈을 돌려준다.', { exact: true }).click();
    await page.getByRole('button', { name: '선택 제출' }).click();
    await page.getByLabel('테스트할 상황').waitFor();
    npc = (await (await request.get(`${sessionPath}/npc`)).json()).npcs[0];
    assert.ok(!npc.hidden && npc.motion.speed_mps > 0);
    console.log('PASS browser: actual v003 event WebGL, blackout, walking to the cafe, hiding and recovery');
  } finally {
    await browser.close();
  }
}

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
  const call = async (url, data, bearer = token, extra = {}, method = data ? 'POST' : 'GET') => {
    const r = await fetch(env.TEST_API_URL + url, { method,
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
      await new Promise(resolve=>setTimeout(resolve,3200));
      const waiting=await call(`${sessionPath}/event`,undefined,token,{cookie});
      assert.equal(waiting.status,200);
      assert.equal(waiting.body.phase,'WAITING');
      assert.equal(waiting.body.can_start,true);
      assert.equal(waiting.body.plaza_completed,false);
      assert.equal(waiting.body.situations_remaining,30);
      const pickerEnabled = env.SIMUS_EVENT_TEST_PICKER === '1';
      if (pickerEnabled) {
        assert.deepEqual(waiting.body.test_situations.map(s => s.id),situations.map(s => s.id));
      } else {
        assert.equal(waiting.body.test_situations,undefined);
        const forbidden = await call(`${sessionPath}/event/start`,{request_key:randomUUID(),situation_id:situations[0].id},token,{cookie});
        assert.equal(forbidden.status,403);
        assert.equal(forbidden.body.error.code,'EVENT_PICKER_DISABLED');
      }
      const startRequest={request_key:randomUUID(),...(pickerEnabled ? {situation_id:situations[29].id} : {})};
      for (let i=0;i<2;i++) {
        const started=await call(`${sessionPath}/event/start`,startRequest,token,{cookie});
        assert.equal(started.status,200,JSON.stringify(started.body));
        assert.equal(started.body.phase,'GUIDING');
        assert.equal(started.body.can_start,false);
        assert.equal(started.body.speed_multiplier,1);
      }
      const changeSpeed = value => call(`${sessionPath}/event`,{speed_multiplier:value},token,{cookie},'PATCH');
      assert.equal((await changeSpeed(3)).status,400);
      let previous = (await call(`${sessionPath}/npc`,undefined,token,{cookie})).body.npcs[0];
      for (const multiplier of [2, 1, 4]) {
        await new Promise(resolve=>setTimeout(resolve,150));
        const changed = await changeSpeed(multiplier);
        assert.equal(changed.status,200);
        assert.equal(changed.body.phase,'GUIDING');
        assert.equal(changed.body.speed_multiplier,multiplier);
        const npc = (await call(`${sessionPath}/npc`,undefined,token,{cookie})).body.npcs[0];
        assert.equal(npc.motion.speed_mps,v003Route.speed_mps * multiplier);
        const now = Date.parse(changed.body.server_time);
        const before = npcPosition(previous,now);
        const after = npcPosition(npc,now);
        assert.ok(Math.hypot(...before.map((value,index)=>value-after[index])) < 0.01);
        previous = npc;
      }
      let active;
      for (let i=0;i<25;i++) {
        const state=await call(`${sessionPath}/event`,undefined,token,{cookie});
        assert.equal(state.status,200);
        if (state.body.phase==='ACTIVE') { active=state.body.event; break; }
        await new Promise(resolve=>setTimeout(resolve,1000));
      }
      assert.equal(active?.situation.code,'EXHIBITION_30');
      assert.equal((await changeSpeed(2)).body.phase,'ACTIVE');
      const readNpc = async () => (await call(`${sessionPath}/npc`,undefined,token,{cookie})).body.npcs[0];
      const stopped = await readNpc();
      assert.equal(stopped.motion.speed_mps,0);
      const choice={session_id:sid,event_id:active.id,situation_id:active.situation_id,choice_id:active.situation.choices[0].id,request_key:randomUUID()};
      assert.equal((await call('/api/choices',choice,token,{cookie})).status,201);
      assert.equal((await call('/api/choices',choice,token,{cookie})).status,200);
      const finished=await call(`${sessionPath}/event`,undefined,token,{cookie});
      assert.equal(finished.body.phase,'WAITING');
      assert.equal(finished.body.can_start,true);
      assert.equal(finished.body.plaza_completed,true);
      assert.equal(finished.body.situations_remaining,29);
      const patrol = await readNpc();
      assert.deepEqual(patrol.motion.points, [stopped.motion.points[0], ...v003Route.resume_points.slice(1), v003Route.points[1]]);
      assert.equal(patrol.motion.loop,true);
      assert.ok(patrol.motion.revision > stopped.motion.revision);
      const epoch = Date.parse(patrol.epoch);
      assert.ok(npcPosition(patrol,epoch+12_000)[2] > npcPosition(patrol,epoch+10_000)[2],
        'NPC keeps walking after reaching the end of the original return route');
      // Reproduce a participant who already parked on an older return route.
      await pool.query(`UPDATE simus.npc_event_states SET resume_motion=$2,paused_ms=0,
        motion_epoch=clock_timestamp()-interval '1 minute' WHERE session_id=$1`, [sid, {
        ...patrol.motion, points:patrol.motion.points.slice(0,v003Route.resume_points.length), loop:false
      }]);
      const upgraded = await readNpc();
      assert.equal(upgraded.motion.loop,true);
      assert.ok(upgraded.motion.revision > patrol.motion.revision);
      const pose = npcPosition(upgraded,Date.now());
      assert.ok(Math.hypot(...pose.map((value,i) => value-v003Route.points[0][i])) < 1,
        'Existing NPC restarts from the previous endpoint');
      const replayedPlaza = await call(`${sessionPath}/event/start`,startRequest,token,{cookie});
      assert.equal(replayedPlaza.body.phase,'WAITING');
      const seen = new Set([active.situation_id]);
      for (let step = 1; step <= 29; step++) {
        const number = pickerEnabled ? (step === 1 ? 29 : step - 1) : step;
        const walks = pickerEnabled && number !== 12 && number !== 26;
        const indoors = walks && [8,9,10,15,19,23,29].includes(number);
        const encounter = walks && [5,6,16,18,21,22].includes(number);
        const request = {request_key:randomUUID(),...(pickerEnabled ? {situation_id:situations[number-1].id} : {})};
        const results = await Promise.all(Array.from({length: number === 1 ? 2 : 1}, () =>
          call(`${sessionPath}/event/start`,request,token,{cookie})));
        for (const result of results) {
          assert.equal(result.status,200,`Situation ${number}: ${JSON.stringify(result.body)}`);
          assert.equal(result.body.phase,walks ? 'GUIDING' : 'ACTIVE');
          assert.equal(result.body.situations_remaining,30-step);
        }
        let next = results[0].body.event;
        if (walks) {
          let enRoute = (await call(`${sessionPath}/npc`,undefined,token,{cookie})).body;
          assert.ok(enRoute.npcs[0].motion.points.length > 2);
          assert.ok(enRoute.npcs[0].motion.speed_mps > 0);
          assert.equal(enRoute.event_npcs?.length ?? 0, encounter ? (number === 21 ? 2 : 1) : 0);
          if (encounter) assert.ok(enRoute.event_npcs[0].motion.loop);
          if ([2, 5].includes(number)) {
            const original = enRoute;
            const slower = await changeSpeed(2);
            assert.equal(slower.body.phase,'GUIDING');
            assert.equal(slower.body.speed_multiplier,2);
            enRoute = (await call(`${sessionPath}/npc`,undefined,token,{cookie})).body;
            assert.equal(enRoute.npcs[0].motion.speed_mps,2*v003Route.speed_mps);
            assert.deepEqual(enRoute.npcs[0].motion.points,original.npcs[0].motion.points);
            assert.deepEqual(enRoute.event_npcs,original.event_npcs);
          }
          const path = enRoute.npcs[0].motion;
          const seconds = path.points.slice(1).reduce((total, point, index) =>
            total + Math.hypot(...point.map((value, axis) => value-path.points[index][axis])),0) / path.speed_mps;
          // Advance the isolated motion clock, using the unchanged authoritative route and arrival scan.
          await pool.query(`UPDATE simus.npc_event_states
            SET guidance_started_at=clock_timestamp()-$2*interval '1 second',
              location_evaluated_at=clock_timestamp()-$2*interval '1 second',
              guidance_motion=CASE WHEN guidance_motion ? 'encounter'
                THEN jsonb_set(guidance_motion,'{encounter_epoch}',to_jsonb(clock_timestamp()-$2*interval '1 second'))
                ELSE guidance_motion END
            WHERE session_id=$1`,[sid,seconds + (encounter ? 10 : 0.5)]);
          const arrived = await call(`${sessionPath}/event`,undefined,token,{cookie});
          assert.equal(arrived.body.phase,'ACTIVE',`Situation ${number}: ${JSON.stringify(arrived.body)}`);
          next = arrived.body.event;
          const arrivedNpc = await readNpc();
          assert.equal(arrivedNpc.hidden,indoors);
          assert.equal(arrivedNpc.motion.speed_mps,0);
        }
        assert.equal(next.situation.code,`EXHIBITION_${String(number).padStart(2,'0')}`);
        assert.equal(next.trigger_kind,walks ? 'LOCATION' : 'MANUAL');
        assert.equal(next.place_id,null);
        assert.equal(seen.has(next.situation_id),false);
        seen.add(next.situation_id);
        const frozen = number === 1 ? await readNpc() : null;
        if (frozen) {
          assert.equal(frozen.motion.speed_mps,0);
          await new Promise(resolve=>setTimeout(resolve,1_000));
          assert.deepEqual((await readNpc()).motion.points,frozen.motion.points);
        }
        const answer = await call('/api/choices',{
          session_id:sid,event_id:next.id,situation_id:next.situation_id,choice_id:next.situation.choices[0].id,request_key:randomUUID(),
        },token,{cookie});
        assert.equal(answer.status,201,JSON.stringify(answer.body));
        if (frozen) {
          const resumed = await readNpc();
          const position = npcPosition(resumed,Date.now());
          assert.equal(resumed.motion.loop,!walks);
          assert.ok(Math.hypot(...position.map((value,i) => value-frozen.motion.points[0][i])) < 1,
            'Completing another situation resumes the patrol from the frozen pose');
        }
        if (step === 1 || step === 29) {
          const replay = await call(`${sessionPath}/event/start`,request,token,{cookie});
          assert.equal(replay.body.phase,'WAITING');
          assert.equal(replay.body.can_start,step < 29);
        }
        if (pickerEnabled && step === 1) {
          const duplicate = await call(`${sessionPath}/event/start`,{...request,request_key:randomUUID()},token,{cookie});
          assert.equal(duplicate.status,409);
          assert.equal(duplicate.body.error.code,'TEST_SITUATION_UNAVAILABLE');
        }
      }
      assert.equal(seen.size,30);
      const completed=await call(`${sessionPath}/event`,undefined,token,{cookie});
      assert.equal(completed.body.phase,'WAITING');
      assert.equal(completed.body.can_start,false);
      assert.equal(completed.body.situations_remaining,0);
      assert.equal((await call(`${sessionPath}/event/start`,{request_key:randomUUID()},token,{cookie})).body.error.code,'EVENTS_EXHAUSTED');
      if (pickerEnabled) console.log('PASS picker API: all 30 situations, walking routes, moving targets, indoor visibility, resumption and replay');
      if (pickerEnabled && env.TEST_EVENT_PLAYWRIGHT_MODULE) await verifyEventBrowser({ env, sessionPath });
    }
  }
  assert.equal((await call(endpoint,payload)).body.status,'FINALIZED','replay works after lifecycle transition');
  assert.equal((await call(endpoint,{...clonePayload,request_key:randomUUID(),name:'From finalized'})).status,201);
  console.log('PASS initial API: session creation and lifecycle, 30 unique playable situations, start and choice retries, exhaustion, and DRAFT/FINALIZED clones');
}
