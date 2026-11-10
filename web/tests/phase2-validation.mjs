// Only invoked by isolated-runner, which owns a fresh PostgreSQL cluster.
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { SignJWT } from 'jose';
import { eventManifest } from '../src/lib/city-v002-event-mapping.mjs';
import { MAP_VERSION, PATH_VERSION, pedestrianGraph, routeBetween, pathLength, distance } from '../src/lib/city-v002-graph.mjs';
import content from '../src/lib/data/initial-session-content.json' with { type: 'json' };
import { enterCity } from './participant-entry.mjs';

export async function runPhase2Validation({pool,env,privateKey,publicJwk,root,applyContent,stopServer,startServer}) {
  assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name,'simus_integration');
  const artifacts=path.join(root,'phase2'); await mkdir(artifacts);
  const evidence={created_at:new Date().toISOString(),database:'new disposable cluster',events:[],browser:[],checks:[]};
  const buildRoot=env.TEST_PHASE2_WEBGL_BUILD||path.resolve('public/city-rebuild-v002-phase1');
  evidence.webgl=JSON.parse(await readFile(path.join(buildRoot,'build.json'),'utf8'));
  const index=await readFile(path.join(buildRoot,'index.html'));
  evidence.webgl.index_sha256=createHash('sha256').update(index).digest('hex');
  const served=await fetch(env.TEST_API_URL+'/city-rebuild-v002-phase1/index.html');
  assert.equal(served.status,200);
  assert.equal(createHash('sha256').update(Buffer.from(await served.arrayBuffer())).digest('hex'),evidence.webgl.index_sha256,
    'The browser must receive the selected actual WebGL build, not the previous public binary');
  const save=()=>writeFile(path.join(artifacts,'results.json'),JSON.stringify(evidence,null,2));
  const token=await new SignJWT({}).setProtectedHeader({alg:'RS256',kid:publicJwk.kid})
    .setIssuer(env.ADMIN_TOKEN_ISSUER).setAudience(env.ADMIN_TOKEN_AUDIENCE).setSubject('phase2-admin').setIssuedAt().setExpirationTime('2h').sign(privateKey);
  await pool.query("INSERT INTO simus.admin_users(auth_subject,display_name,is_active) VALUES('phase2-admin','Isolated phase2',true)");
  async function call(url,{data,cookie,admin=false,method=data?'POST':'GET'}={}) {
    const r=await fetch(env.TEST_API_URL+url,{method,headers:{...(admin?{authorization:`Bearer ${token}`} :{}),...(cookie?{cookie}:{}),...(data?{'content-type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
    const body=await r.json();assert.ok(r.ok,`${url}: ${r.status} ${JSON.stringify(body)}`);
    return {status:r.status,body,cookie:r.headers.get('set-cookie')?.split(';')[0]};
  }
  const create=async(template)=> (await call('/api/admin/sessions',{admin:true,data:{...(template?{template_session_id:template}:{creation_mode:'initial'}),npc_profile:'city-rebuild-v002',name:'Disposable Phase2',duration_seconds:3600,impact_scale:.1,request_key:randomUUID()}})).body.session_id;
  const action=(sid,name)=>call(`/api/admin/sessions/${sid}/${name}`,{admin:true,data:{request_key:randomUUID()}});
  // The autonomous ticker also persists the entry cursor. Clock travel in this
  // disposable DB must take its session lock, or a stale ticker snapshot can
  // overwrite the shifted cursor and make a real loop re-entry disappear.
  async function runtimeFixture(sid,sql,parameters=[]) {
    const db=await pool.connect();
    try {
      await db.query('BEGIN');
      await db.query('SELECT id FROM simus.simulation_sessions WHERE id=$1 FOR UPDATE',[sid]);
      await db.query(sql,[sid,...parameters]);
      await db.query('COMMIT');
    } catch(error) {await db.query('ROLLBACK');throw error;}
    finally {db.release();}
  }
  const template=await create();
  const contentSnapshot=async(sid)=>(await pool.query(`SELECT
    (SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM simus.session_situations s WHERE session_id=$1) AS situations,
    (SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM simus.session_choices c WHERE session_id=$1) AS choices,
    (SELECT jsonb_agg(to_jsonb(e) ORDER BY choice_id) FROM simus.choice_region_effects e WHERE session_id=$1) AS effects`,[sid])).rows[0];
  const before=await contentSnapshot(template);
  await applyContent(template);await applyContent(template);
  assert.deepEqual(await contentSnapshot(template),before,'DRAFT SQL twice preserves original content and exact locations');
  evidence.checks.push('managed init 001–018; Phase2 DRAFT SQL applied twice without content changes');
  const rows=(await pool.query('SELECT * FROM simus.session_situations WHERE session_id=$1 ORDER BY display_order',[template])).rows;
  assert.equal(rows.filter(r=>r.event_location).length,12);
  for(const row of eventManifest.events) {
    const actual=rows.find(r=>r.code===row.code); assert.equal(actual.title,row.title);
    if(row.event_location) {
      assert.equal(actual.event_location.place_id,row.place_id);assert.equal(actual.event_location.map_version,MAP_VERSION);
      assert.equal(actual.event_location.radius_m,row.event_location.radius_m);
      assert.ok(distance(actual.event_location.point,row.event_location.point)<1e-10,'JSONB decimal roundtrip within subnanometer tolerance');
    } else assert.equal(actual.event_location,null);
    const choices=(await pool.query('SELECT * FROM simus.session_choices WHERE session_id=$1 AND situation_id=$2 ORDER BY display_order',[template,actual.id])).rows;
    const source=content.situations.find(s=>s.number===row.number);
    assert.deepEqual(choices.map(c=>[c.label,c.alignment_dx,c.alignment_dy,+c.happiness_base,+c.safety_base,+c.cleanliness_base]),source.choices.map(c=>[c.label,c.scores.order,c.scores.morality,c.scores.happiness,c.scores.safety,c.scores.cleanliness]));
  }
  evidence.checks.push('all 30 titles, 91 choice labels/alignment/city values and 12 exact placements preserved; 18 null');
  // A small real graph route allows browser runs at unchanged runtime speed.
  function approach(location) {
    const route=pedestrianGraph.nodes.map(n=>routeBetween(n.position,location.point)).filter(p=>pathLength(p)>14&&pathLength(p)<40)
      .sort((a,b)=>pathLength(a)-pathLength(b))[0];
    if(route) return route;
    const full=routeBetween(pedestrianGraph.nodes[0].position,location.point);let remaining=18;
    for(let i=full.length-1;i>0;i--) {
      const length=distance(full[i-1],full[i]);
      if(length>=remaining) return [full[i].map((v,j)=>v+(full[i-1][j]-v)*remaining/length),...full.slice(i)];
      remaining-=length;
    }
    return full;
  }
  async function scenario(row,shared=false,paused=false) {
    const sid=await create(template),points=approach(row.event_location);
    // Isolation only: retain original content; narrow which READY place is under test.
    await pool.query('UPDATE simus.session_situations SET event_location=NULL WHERE session_id=$1 AND NOT(code=ANY($2::text[]))',[sid,shared?['EXHIBITION_10','EXHIBITION_22']:[row.code]]);
    const motion={map_version:MAP_VERSION,path_version:PATH_VERSION,points,speed_mps:paused?0:1.2,loop:true};
    await call(`/api/admin/sessions/${sid}/npc-motion`,{admin:true,method:'PUT',data:motion});
    return {sid,points};
  }
  async function state(sid,pid) {return (await pool.query('SELECT * FROM simus.npc_event_states WHERE session_id=$1 AND participant_id=$2',[sid,pid])).rows[0];}
  async function verifyChoice(sid,pid,event,choice,submit) {
    const old=(await pool.query('SELECT * FROM simus.city_states WHERE session_id=$1',[sid])).rows[0];
    const alignment=(await pool.query('SELECT * FROM simus.participant_alignments WHERE session_id=$1 AND participant_id=$2',[sid,pid])).rows[0];
    const regions=(await pool.query('SELECT * FROM simus.region_states WHERE session_id=$1 ORDER BY region_id',[sid])).rows;
    const definition=(await pool.query('SELECT * FROM simus.session_choices WHERE session_id=$1 AND id=$2',[sid,choice.id])).rows[0];
    const effects=(await pool.query('SELECT * FROM simus.choice_region_effects WHERE session_id=$1 AND choice_id=$2',[sid,choice.id])).rows;
    await submit();
    const record=(await pool.query('SELECT * FROM simus.choice_records WHERE session_id=$1 AND participant_id=$2 AND event_id=$3',[sid,pid,event.id])).rows;
    assert.equal(record.length,1);assert.equal(record[0].choice_id,choice.id);
    const city=(await pool.query('SELECT * FROM simus.city_states WHERE session_id=$1',[sid])).rows[0];
    const clamp=n=>Math.max(0,Math.min(100,n)); const close=(a,b)=>assert.ok(Math.abs(+a-b)<1e-8,`${a} != ${b}`);
    for(const key of ['happiness','safety','cleanliness']) {
      const delta=+definition[`${key}_base`]*.1;
      close(city[key],clamp(+old[key]+delta));close(record[0][`${key}_delta_requested`],delta);
      close(record[0][`${key}_delta_applied`],+city[key]-+old[key]);
    }
    assert.equal(+city.version,+old.version+1);
    const next=(await pool.query('SELECT * FROM simus.participant_alignments WHERE session_id=$1 AND participant_id=$2',[sid,pid])).rows[0];
    assert.equal(+next.x_score,+alignment.x_score+definition.alignment_dx);assert.equal(+next.y_score,+alignment.y_score+definition.alignment_dy);
    assert.equal(+next.response_count,+alignment.response_count+1);
    const nextRegions=(await pool.query('SELECT * FROM simus.region_states WHERE session_id=$1 ORDER BY region_id',[sid])).rows;
    const regionLedger=(await pool.query('SELECT * FROM simus.choice_record_region_effects WHERE choice_record_id=$1',[record[0].id])).rows;
    assert.equal(regionLedger.length,effects.length);
    for(const region of regions) {
      const effect=effects.find(e=>e.region_id===region.region_id),nextRegion=nextRegions.find(r=>r.region_id===region.region_id);
      close(nextRegion.pollution,clamp(+region.pollution+(effect?+effect.pollution_base*.1:0)));
      if(effect) {
        const ledger=regionLedger.find(r=>r.region_id===region.region_id);
        close(ledger.delta_requested,+effect.pollution_base*.1);close(ledger.delta_applied,+nextRegion.pollution-+region.pollution);
      }
    }
    assert.equal((await pool.query('SELECT status FROM simus.npc_events WHERE id=$1',[event.id])).rows[0].status,'COMPLETED');
    return {choice_id:choice.id,record_id:record[0].id,alignment:[next.x_score,next.y_score],city_version:city.version};
  }
  const ready=eventManifest.events.filter(e=>e.status==='READY');
  try {
    for(const row of ready) {
      const {sid,points}=await scenario(row); await action(sid,'start');
      const choices=(await pool.query('SELECT id,label FROM simus.session_choices WHERE session_id=$1 AND situation_id=$2 ORDER BY display_order',[sid,row.seed_situation_id])).rows;
      const result={code:row.code,sid,place_id:row.place_id,point:row.event_location.point,radius_m:row.event_location.radius_m,approach:points,choices:[],api:'RUNNING',browser:'NOT TESTED'};
      evidence.events.push(result);await save();
      for(const choice of choices) {
        const person=await call('/api/participants',{method:'POST'});await call(`/api/sessions/${sid}/join`,{method:'POST',cookie:person.cookie});
        const pid=(await pool.query('SELECT participant_id FROM simus.participant_sessions WHERE session_id=$1 ORDER BY joined_at DESC LIMIT 1',[sid])).rows[0].participant_id;
        const event=()=>call(`/api/sessions/${sid}/event`,{cookie:person.cookie}); await event();
        // Advance ONLY the owned runtime clock; real browser below never does this.
        await runtimeFixture(sid,"UPDATE simus.npc_event_states SET motion_epoch=clock_timestamp()-$3*interval '1 second',location_evaluated_at=clock_timestamp()-$3*interval '1 second' WHERE session_id=$1 AND participant_id=$2",[pid,pathLength(points)/1.2+1]);
        const active=(await event()).body.event;assert.equal(active.situation_id,row.seed_situation_id);assert.equal(active.trigger_kind,'LOCATION');assert.equal(active.place_id,row.place_id);
        assert.equal(active.situation.title,row.title);assert.deepEqual(active.situation.choices.map(c=>[c.id,c.label]),choices.map(c=>[c.id,c.label]));
        if(row.number===2 && choice===choices[0]) {await stopServer();await startServer();}
        const concurrent=await Promise.all(Array.from({length:6},event));assert.ok(concurrent.every(r=>r.body.event.id===active.id));
        const frozen=(await call(`/api/sessions/${sid}/npc`,{cookie:person.cookie})).body.npcs[0];assert.equal(frozen.motion.speed_mps,0);
        assert.ok(distance(frozen.motion.points[0],row.event_location.point)<=row.event_location.radius_m+.005);
        const data={session_id:sid,event_id:active.id,situation_id:active.situation_id,choice_id:choice.id,request_key:randomUUID()};
        result.choices.push(await verifyChoice(sid,pid,active,choice,async()=>{const replies=await Promise.all(Array.from({length:4},()=>call('/api/choices',{cookie:person.cookie,data})));assert.deepEqual(replies.map(r=>r.status).sort(),[200,200,200,201]);}));
        const resumed=(await call(`/api/sessions/${sid}/npc`,{cookie:person.cookie})).body.npcs[0];assert.ok(resumed.motion.speed_mps>0);assert.ok(distance(resumed.motion.points[0],frozen.motion.points[0])<.5||resumed.motion.loop);
        assert.equal((await event()).body.event,null,'No immediate event while remaining in the same visit');
      }
      result.api='PASS';await action(sid,'end');await save();console.log(`PASS API/DB ${row.code}: ${choices.length} original choices, exact deltas, parallel replay, freeze/resume`);
    }
    // Both school events must require separate visits, including after a restart.
    const school=ready.find(r=>r.number===10),shared=await scenario(school,true);await action(shared.sid,'start');
    const person=await call('/api/participants',{method:'POST'});await call(`/api/sessions/${shared.sid}/join`,{method:'POST',cookie:person.cookie});
    const pid=(await pool.query('SELECT participant_id FROM simus.participant_sessions WHERE session_id=$1',[shared.sid])).rows[0].participant_id;
    const event=()=>call(`/api/sessions/${shared.sid}/event`,{cookie:person.cookie});await event();
    async function advance(seconds) {await runtimeFixture(shared.sid,"UPDATE simus.npc_event_states SET motion_epoch=motion_epoch-$3*interval '1 second',location_evaluated_at=location_evaluated_at-$3*interval '1 second' WHERE session_id=$1 AND participant_id=$2",[pid,seconds]);}
    await advance(pathLength(shared.points)/1.2+1);const first=(await event()).body.event;assert.ok(first);
    await call('/api/choices',{cookie:person.cookie,data:{session_id:shared.sid,event_id:first.id,situation_id:first.situation_id,choice_id:first.situation.choices[0].id,request_key:randomUUID()}});
    assert.equal((await event()).body.event,null);await stopServer();await startServer();assert.equal((await event()).body.event,null);
    await advance(pathLength(shared.points)*2/1.2);const second=(await event()).body.event;assert.ok(second);assert.notEqual(first.situation_id,second.situation_id);
    assert.ok(+second.entry_seq>+first.entry_seq);await action(shared.sid,'end');
    evidence.checks.push('10/22 shared place: one event per visit, restart while inside, second event only after loop re-entry');await save();
    // Long guidance is explicitly diagnosed; no unplaced fallback is permitted.
    const far=await create(template);await action(far,'start');const waitingPerson=await call('/api/participants',{method:'POST'});await call(`/api/sessions/${far}/join`,{method:'POST',cookie:waitingPerson.cookie});
    await call(`/api/sessions/${far}/event`,{cookie:waitingPerson.cookie});
    await runtimeFixture(far,"UPDATE simus.npc_event_states SET waiting_since=clock_timestamp()-interval '91 seconds' WHERE session_id=$1");
    const overdue=(await call(`/api/sessions/${far}/event`,{cookie:waitingPerson.cookie})).body;
    const elapsed=(Date.parse(overdue.server_time)-Date.parse(overdue.waiting_since))/1000;
    const arrival=overdue.event?(Date.parse(overdue.event.started_at)-Date.parse(overdue.waiting_since))/1000:null;
    evidence.wait90={phase:overdue.phase,event:overdue.event,deadline_at:overdue.deadline_at,overdue:overdue.overdue,
      elapsed_seconds:elapsed,event_started_after_seconds:arrival,
      status:arrival!==null&&arrival<=90?'PASS':'FAIL',scope:'single overdue observation, not a universal deadline guarantee',
      meaning:'90-second maximum is not enforced; no remote/unplaced event injected'};
    console.log(`${evidence.wait90.status} 90-second maximum: ${elapsed.toFixed(3)}s elapsed, arrival=${arrival??'none'}`);
    await action(far,'end');await save();
    if(!env.TEST_PHASE2_PLAYWRIGHT_MODULE) {console.log('SKIP Phase2 actual browser: TEST_PHASE2_PLAYWRIGHT_MODULE absent');return;}
    const {chromium}=await import(pathToFileURL(env.TEST_PHASE2_PLAYWRIGHT_MODULE).href);
    const requested=env.TEST_PHASE2_BROWSER_CODES?.split(',').filter(Boolean);
    if(requested) assert.ok(requested.length&&requested.every(code=>ready.some(row=>row.code===code)),'Browser filter must name READY situations');
    const browserRows=requested?ready.filter(row=>requested.includes(row.code)):ready;
    evidence.browser_scope=browserRows.map(row=>row.code);
    // Prefer the native GPU on Windows. Software rendering remains available
    // explicitly; this mobile viewport test does not certify device performance.
    const softwareGpu=process.platform!=='win32'||env.TEST_PHASE2_SOFTWARE_GPU==='1';
    evidence.software_gpu_forced=softwareGpu;
    const browser=await chromium.launch({headless:true,executablePath:env.TEST_CHROMIUM_EXECUTABLE||undefined,
      args:[...(softwareGpu?['--use-angle=swiftshader']:[]),'--enable-unsafe-swiftshader']});
    try {
      for(const row of browserRows) {
        const {sid,points}=await scenario(row,false,true);await action(sid,'start');
        const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();
        const result={code:row.code,sid,status:'RUNNING',errors:[],failures:[],http_errors:[],bridge_errors:[],frame_detachments:[]};evidence.browser.push(result);await save();
        page.on('pageerror',e=>result.errors.push(e.message));
        page.on('framedetached',frame=>result.frame_detachments.push({at:new Date().toISOString(),url:frame.url()}));
        page.on('response',response=>{
          if(response.status()>=400) result.http_errors.push({status:response.status(),url:response.url()});
        });
        await page.addInitScript(()=>window.addEventListener('message',event=>{
          if(event.origin===location.origin&&event.data?.channel==='simus-city'&&event.data.type==='ERROR')
            (window.__phase2BridgeErrors??=[]).push({at:new Date().toISOString(),code:event.data.code});
        }));
        try {
          await page.goto(env.TEST_API_URL+'/participate');await enterCity(page,{nickname:'장소검증'+row.number,characterId:'npc_01'});
          await page.waitForFunction(()=>document.querySelector('iframe[title="SIM:US 도시"]')?.style.visibility==='visible',null,{timeout:180000});
          const frame=await page.locator('iframe[title="SIM:US 도시"]').elementHandle();
          const unity=await frame.contentFrame();assert.ok(unity);
          assert.ok(new URL(unity.url()).pathname.endsWith('/index.html'));
          async function inspect() {await unity.evaluate(()=>window.simusBridge.inspect());await page.waitForTimeout(200);return unity.evaluate(()=>window.simusBridge.inspect());}
          if(row.number===2) {
            // Transport-failure regression only. Actual movement/events/choices
            // below still use the live API and the real WebGL runtime.
            const polling='**/api/sessions/current';
            await page.route(polling,route=>route.abort('failed'));
            try {
              await page.evaluate(()=>window.dispatchEvent(new Event('online')));
              await page.getByRole('alert').filter({hasText:'참여 정보를 다시 확인하고 있어요'}).waitFor();
              assert.equal(unity.isDetached(),false,'A failed background poll must preserve the loaded Unity frame');
              assert.equal(await page.locator('iframe[title="SIM:US 도시"]').evaluate((node,previous)=>node===previous,frame),true);
            } finally {await page.unroute(polling);}
            await page.evaluate(()=>window.dispatchEvent(new Event('online')));
            await page.getByRole('alert').filter({hasText:'참여 정보를 다시 확인하고 있어요'}).waitFor({state:'hidden'});
            assert.equal(unity.isDetached(),false);result.poll_failure_recovery='PASS';
          }
          const a=await inspect();
          // Start this disposable actor only after WebGL is visible, so arrival
          // cannot happen invisibly while WASM loads. No time is fast-forwarded;
          // the joined snapshot is retained and the runtime route uses real time.
          await runtimeFixture(sid,`UPDATE simus.npc_event_states SET resume_motion=$2,motion_epoch=clock_timestamp(),paused_ms=0,
            location_evaluated_at=clock_timestamp(),motion_revision=motion_revision+1 WHERE session_id=$1`,
            [{map_version:MAP_VERSION,path_version:PATH_VERSION,points,speed_mps:1.2,loop:true}]);
          result.movement_started_at=new Date().toISOString();
          await page.waitForTimeout(3800);const b=await inspect();result.moving=[a,b];
          result.movement_observed=!!a?.position&&!!b?.position&&distance(a.position,b.position)>.1;
          if(!result.movement_observed) result.failures.push('No real Unity movement observed before arrival');
          await page.getByRole('radio').first().waitFor({timeout:90000});
          const active=(await page.evaluate(async id=>(await fetch(`/api/sessions/${id}/event`)).json(),sid)).event;
          assert.equal(active.situation_id,row.seed_situation_id);assert.equal(active.trigger_kind,'LOCATION');
          await page.getByRole('heading',{name:row.title,exact:true}).waitFor();
          for(const c of active.situation.choices) assert.ok(await page.getByRole('radio',{name:c.label,exact:true}).count());
          const snapshot=(await page.evaluate(async id=>(await fetch(`/api/sessions/${id}/npc`)).json(),sid)).npcs[0];
          assert.equal(snapshot.motion.speed_mps,0);
          const p=snapshot.motion.points[0],syncStarted=Date.now();
          // The choice panel and Unity poll independently every 2.5s. Observe
          // the actual frozen snapshot before comparing two stationary frames.
          // A 1.2s sleep immediately after the panel appears races the next poll.
          let frozen=await inspect();
          while(Date.now()-syncStarted<7500&&Math.hypot(p[0]-frozen.position[0],p[2]-frozen.position[2])>=.1) {
            await page.waitForTimeout(250);frozen=await inspect();
          }
          result.freeze_sync_ms=Date.now()-syncStarted;
          assert.ok(Math.hypot(p[0]-frozen.position[0],p[2]-frozen.position[2])<.1,'Unity must converge to the server freeze within three poll periods');
          await page.waitForTimeout(1200);const still=await inspect();
          assert.ok(distance(frozen.position,still.position)<.05);assert.ok(still.active&&still.renderer_count>0);
          result.server_point=p;result.unity_point=still.position;
          result.server_unity_error_m=Math.hypot(p[0]-still.position[0],p[2]-still.position[2]);
          if(result.server_unity_error_m>=.1) result.failures.push('Unity actor disagrees with server arrival');
          assert.ok(Math.hypot(p[0]-row.event_location.point[0],p[2]-row.event_location.point[2])<=row.event_location.radius_m+.01);
          result.wait_ms=Date.parse(active.started_at)-Date.parse((await state(sid,(await pool.query('SELECT participant_id FROM simus.participant_sessions WHERE session_id=$1',[sid])).rows[0].participant_id)).waiting_since);
          await page.screenshot({path:path.join(artifacts,`${row.code}-event.png`)});
          const pid=(await pool.query('SELECT participant_id FROM simus.participant_sessions WHERE session_id=$1',[sid])).rows[0].participant_id;
          result.choice=await verifyChoice(sid,pid,active,active.situation.choices[0],async()=>{
            let release;
            const pollPath=`**/api/sessions/${sid}/responses`;
            if(row.number===2) {
              // Delay transport only; the real server response is never replaced.
              const gate=new Promise(resolve=>{release=resolve;});
              await page.route(pollPath,async route=>{await gate;await route.continue();});
              const reading=page.waitForRequest(r=>new URL(r.url()).pathname===`/api/sessions/${sid}/responses`);
              await page.evaluate(()=>window.dispatchEvent(new Event('online')));await reading;
            }
            try {
              await page.getByRole('radio').first().check();
              const sent=page.waitForResponse(r=>r.url().endsWith('/api/choices')&&r.request().method()==='POST');
              await page.getByRole('button',{name:'선택 제출',exact:true}).click();
              if(release) {
                await page.getByRole('button',{name:'제출 중…',exact:true}).waitFor();
                release();result.single_click_during_poll='PASS';
              }
              const response=await sent;
              assert.equal(response.status(),201,await response.text());
            } finally {if(release) {release();await page.unroute(pollPath);}}
          });
          await page.waitForTimeout(1500);const resumed=await inspect();await page.waitForTimeout(1800);const moved=await inspect();
          if(distance(resumed.position,moved.position)<=.5) result.failures.push('Unity actor did not resume after choice');
          result.resumed=[resumed,moved];assert.deepEqual(result.errors,[]);result.status=result.failures.length?'FAIL':'PASS';
          evidence.events.find(e=>e.code===row.code).browser=result.status;console.log(`${result.status} actual WebGL/mobile ${row.code}: ${result.failures.join('; ')||'movement, arrival, text/choices, freeze, persisted stats, resume'}`);
        } catch(error) {result.status='FAIL';result.error=String(error);await page.screenshot({path:path.join(artifacts,`${row.code}-failure.png`)}).catch(()=>{});console.log(`FAIL actual WebGL/mobile ${row.code}: ${error}`);}
        finally {
          result.bridge_errors=await page.evaluate(()=>window.__phase2BridgeErrors??[]).catch(()=>[]);
          await context.close();await action(sid,'end');await save();
        }
      }
      assert.ok(evidence.browser.every(r=>r.status==='PASS'),'Some actual browser scenarios failed; inspect results.json');
    } finally {await browser.close();}
  } finally {await save();console.log('Phase2 evidence:',artifacts);}
}
