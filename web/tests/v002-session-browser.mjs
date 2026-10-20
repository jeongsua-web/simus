// Real HTTP + disposable PostgreSQL + actual Unity WebGL. No browser route fixtures.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { enterCity } from './participant-entry.mjs';
import { MAP_VERSION, PATH_VERSION, nodePoint, distance } from '../src/lib/city-v002-graph.mjs';

export async function runV002SessionBrowser({pool,env,token,templateId,root}) {
  if (!env.TEST_V002_PLAYWRIGHT_MODULE) return console.log('SKIP: actual v002 session WebGL browser (set TEST_V002_PLAYWRIGHT_MODULE)');
  const {chromium}=await import(pathToFileURL(env.TEST_V002_PLAYWRIGHT_MODULE).href);
  const browser=await chromium.launch({headless:true,executablePath:env.TEST_CHROMIUM_EXECUTABLE||undefined,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const artifacts=path.join(root,'v002-browser');await mkdir(artifacts);
  const errors=[],messages=[],requests=[];let sid;
  try {
    const adminContext=await browser.newContext();const admin=await adminContext.newPage();
    await admin.goto(env.TEST_API_URL+'/admin');
    await admin.getByLabel('관리자 토큰',{exact:true}).fill(token);
    await admin.getByRole('button',{name:'운영 화면 열기',exact:true}).click();
    await admin.locator('select[name=template]').selectOption(templateId);
    await admin.locator('select[name=map]').selectOption('city-rebuild-v002');
    const name='Disposable v002 actual WebGL';
    await admin.getByLabel('새 회차 이름',{exact:true}).fill(name);
    await admin.getByLabel('진행 시간(초)',{exact:true}).fill('600');
    const creation=admin.waitForResponse(r=>r.url().endsWith('/api/admin/sessions')&&r.request().method()==='POST');
    await admin.getByRole('button',{name:'새 회차 준비',exact:true}).click();
    const created=await creation;assert.equal(created.status(),201);sid=(await created.json()).session_id;
    console.log('v002 actual browser: administrator DRAFT created',sid);
    const card=admin.locator('article').filter({has:admin.getByRole('heading',{name,exact:true})});
    await card.getByText('v002 상황 위치 설정',{exact:true}).click();
    await card.getByRole('button',{name:'상황 위치 불러오기',exact:true}).click();
    await card.getByLabel('보행 지점').selectOption('C_SPINE_CUT_0');
    const saved=admin.waitForResponse(r=>r.url().endsWith('/event-locations')&&r.request().method()==='PUT');
    await card.getByRole('button',{name:'이 위치에 저장',exact:true}).click();
    assert.equal((await saved).status(),200);
    const location=(await pool.query('SELECT id,event_location FROM simus.session_situations WHERE session_id=$1 AND event_location IS NOT NULL',[sid])).rows[0];
    assert.ok(location);
    // Keep the exact administrator UI placement through arrival and choice.
    // This disposable round does not establish exhibition placement approval.
    assert.deepEqual(location.event_location,{map_version:MAP_VERSION,point:nodePoint('C_SPINE_CUT_0'),radius_m:2});
    const start=admin.waitForResponse(r=>r.url().endsWith(`/${sid}/start`));
    await card.getByRole('button',{name:'회차 시작',exact:true}).click();assert.equal((await start).status(),200);
    console.log('v002 actual browser: placement saved and round started');
    const participant=await browser.newContext({viewport:{width:1280,height:900}});const page=await participant.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>requests.push(new URL(r.url()).pathname));
    await page.exposeFunction('recordBridge',message=>messages.push(message));
    await page.addInitScript(()=>window.addEventListener('message',event=>{if(event.data?.channel==='simus-city')window.recordBridge(event.data);}));
    await page.goto(env.TEST_API_URL+'/participate');await enterCity(page,{nickname:'새도시시민',characterId:'npc_01'});
    await page.waitForFunction(()=>document.querySelector('iframe[title="SIM:US 도시"]')?.style.visibility==='visible',null,{timeout:180000});
    const unity=page.frames().find(f=>f.url().includes('/city-rebuild-v002/index.html'));assert.ok(unity);
    async function inspect() {
      // SendMessage schedules a Unity frame; allow a fresh observation to arrive.
      await unity.evaluate(()=>window.simusBridge.inspect());await page.waitForTimeout(150);
      return unity.evaluate(()=>window.simusBridge.inspect());
    }
    await page.waitForTimeout(2500);
    console.log('v002 actual browser: Unity READY/BOUND and canvas visible');
    const a=await inspect();assert.ok(a?.active&&a.renderer_count>0,'Real instantiated NPC with renderers');
    assert.equal(a.following,true);assert.equal(a.smooth_transitions,true);
    await page.waitForTimeout(3500);const b=await inspect();assert.ok(distance(a.position,b.position)>1,'Real Unity actor moves');
    assert.equal(messages.find(m=>m.type==='READY')?.map_version,MAP_VERSION);
    assert.equal(messages.find(m=>m.type==='BOUND')?.npc_id,a.npc_id);
    await page.getByRole('button',{name:'캐릭터 화면 확대',exact:true}).click();
    await page.waitForTimeout(1200);
    const zoomed=await inspect();
    assert.equal(zoomed.zoom,1.25); assert.equal(zoomed.following,true);
    assert.ok(zoomed.camera_size < b.camera_size,'Zoom changes the real Unity lens');
    await page.getByRole('button',{name:'기본 배율로 되돌리기',exact:true}).click();
    await page.waitForTimeout(150);
    assert.equal((await inspect()).zoom,1);
    const canvas=unity.locator('canvas'); const box=await canvas.boundingBox();assert.ok(box);
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
    await page.mouse.wheel(0,-100);await page.waitForTimeout(200);
    assert.ok((await inspect()).zoom>1,'Real wheel input zooms the Unity camera');
    await page.getByRole('button',{name:'기본 배율로 되돌리기',exact:true}).click();
    await page.screenshot({path:path.join(artifacts,'moving-desktop.png')});
    await page.setViewportSize({width:390,height:844});
    await unity.evaluate(()=>{
      const canvas=document.querySelector('canvas');
      const fire=(type,gap)=>{
        const touches=[new Touch({identifier:1,target:canvas,clientX:100,clientY:160}),new Touch({identifier:2,target:canvas,clientX:100+gap,clientY:160})];
        canvas.dispatchEvent(new TouchEvent(type,{touches,cancelable:true,bubbles:true}));
      };
      fire('touchstart',80);fire('touchmove',160);
      canvas.dispatchEvent(new TouchEvent('touchend',{touches:[],bubbles:true}));
    });
    await page.waitForTimeout(250);
    assert.equal((await inspect()).zoom,2,'Mobile pinch changes actual Unity zoom');
    const controls=page.getByRole('group',{name:'캐릭터 화면 확대·축소'});
    const controlsBox=await controls.boundingBox();assert.ok(controlsBox&&controlsBox.x>=0&&controlsBox.x+controlsBox.width<=390);
    await page.getByRole('button',{name:'기본 배율로 되돌리기',exact:true}).click();
    await page.getByRole('radio').first().waitFor({timeout:90000});
    const event=await page.evaluate(async id=>(await fetch(`/api/sessions/${id}/event`)).json(),sid);
    assert.equal(event.phase,'ACTIVE');assert.equal(event.event.trigger_kind,'LOCATION');assert.equal(event.event.situation_id,location.id);
    console.log('v002 actual browser: LOCATION event displayed');
    const waitMs=Date.parse(event.event.started_at)-Date.parse(event.waiting_since);
    assert.ok(waitMs > 0 && waitMs < 90000, 'LOCATION event arrives within the real 90-second window');
    const frozen=await inspect();await page.waitForTimeout(3000);const still=await inspect();
    assert.ok(distance(frozen.position,still.position)<.05,'Unity actor stops for active event');
    const serverFrozen=await page.evaluate(async id=>(await fetch(`/api/sessions/${id}/npc`)).json(),sid);
    assert.equal(serverFrozen.npcs[0].npc_id,still.npc_id);
    assert.equal(serverFrozen.npcs[0].motion.map_version,MAP_VERSION);
    assert.equal(serverFrozen.npcs[0].motion.path_version,PATH_VERSION);
    assert.equal(serverFrozen.npcs[0].motion.speed_mps,0);
    const serverPoint=serverFrozen.npcs[0].motion.points[0];
    // Unity projects Y onto rendered ground; compare horizontal map coordinates.
    const serverUnityErrorM=Math.hypot(serverPoint[0]-still.position[0],serverPoint[2]-still.position[2]);
    const placementDistanceM=Math.hypot(serverPoint[0]-location.event_location.point[0],serverPoint[2]-location.event_location.point[2]);
    assert.ok(serverUnityErrorM<.05,'Server frozen NPC and actual Unity actor agree within 5cm in XZ');
    assert.ok(placementDistanceM<=location.event_location.radius_m+.05,'Actual LOCATION event uses the administrator UI placement');
    // Verify the rendered lens after initial camera acquisition has settled.
    await page.getByRole('button',{name:'캐릭터 화면 확대',exact:true}).click();
    await unity.waitForFunction(expected=>{
      const state=window.simusBridge.inspect();
      return state?.following && Math.abs(state.camera_size-expected)<.05;
    },still.follow_size/1.25,{timeout:15000,polling:200});
    await page.getByRole('button',{name:'기본 배율로 되돌리기',exact:true}).click();
    await unity.waitForFunction(expected=>{
      const state=window.simusBridge.inspect();
      return state?.zoom===1 && Math.abs(state.camera_size-expected)<.05;
    },still.follow_size,{timeout:15000,polling:200});
    await page.screenshot({path:path.join(artifacts,'event-mobile.png')});
    await page.getByRole('radio').first().check();
    let choiceSent=false;
    page.on('request',r=>{if(new URL(r.url()).pathname==='/api/choices'&&r.method()==='POST')choiceSent=true;});
    const choice=page.waitForResponse(r=>r.url().endsWith('/api/choices')&&r.request().method()==='POST');
    for(let n=0;n<20&&!choiceSent;n++) {
      await page.getByRole('button',{name:'선택 제출',exact:true}).click();
      await page.waitForTimeout(100);
    }
    assert.ok(choiceSent,'UI submits a real choice request');
    assert.equal((await choice).status(),201);await page.getByText('1회 응답',{exact:true}).waitFor();
    const ledger=(await pool.query(`SELECT count(*)::int AS records FROM simus.choice_records WHERE session_id=$1`,[sid])).rows[0];assert.equal(ledger.records,1);
    const city=(await pool.query('SELECT version FROM simus.city_states WHERE session_id=$1',[sid])).rows[0];assert.equal(String(city.version),'1');
    await page.waitForTimeout(3000);const resumed=await inspect();await page.waitForTimeout(3500);const moving=await inspect();
    assert.ok(distance(resumed.position,moving.position)>1,'Real Unity actor resumes after saved choice');
    const npc=await page.evaluate(async id=>(await fetch(`/api/sessions/${id}/npc`)).json(),sid);
    assert.equal(npc.npcs[0].motion.path_version,PATH_VERSION);
    // Actual administrator UI closes the disposable session.
    await admin.bringToFront();
    await admin.getByRole('button',{name:'새로고침',exact:true}).click();
    await card.getByRole('button',{name:'수동 종료',exact:true}).click();
    const end=admin.waitForResponse(r=>r.url().endsWith(`/${sid}/end`));
    await card.getByRole('button',{name:'대상 회차 종료',exact:true}).click();assert.equal((await end).status(),200);
    await page.bringToFront();
    assert.equal((await pool.query('SELECT status FROM simus.simulation_sessions WHERE id=$1',[sid])).rows[0].status,'FINALIZED');
    await page.waitForFunction(()=>!document.querySelector('iframe[title="SIM:US 도시"]'));
    const finalSnapshot=()=>page.evaluate(async id=>(await fetch(`/api/sessions/${id}/npc`)).json(),sid);
    const ended=await finalSnapshot();await page.waitForTimeout(1000);const ended2=await finalSnapshot();
    assert.equal(ended.frozen,true);assert.equal(ended.motion_time,ended2.motion_time);
    assert.deepEqual(ended.npcs,ended2.npcs,'Ended API position is frozen; UI disposes WebGL for results');
    assert.ok(requests.some(p=>p===`/api/sessions/${sid}/npcs`),'Actual Unity crowd polling');
    assert.ok(!requests.some(p=>p.startsWith('/city/')),'v002 never requests legacy build');
    assert.ok(!messages.some(m=>m.type==='ERROR'));assert.deepEqual(errors,[]);
    await writeFile(path.join(artifacts,'evidence.json'),JSON.stringify({sid,map:MAP_VERSION,path:PATH_VERSION,location,serverFrozen,serverUnityErrorM,placementDistanceM,a,b,frozen,still,resumed,moving,ended,ended2,waitMs,messages,errors},null,2));
    console.log(`PASS actual browser/API/WebGL: admin create/place/start → /participate profile/join → visible NPC/movement/Phase8 follow → LOCATION event/freeze → choice ledger+city version → movement resumes → admin end/API freeze/WebGL disposal. Evidence: ${artifacts}`);
  } catch(error) {
    for(const page of browser.contexts().flatMap(c=>c.pages())) await page.screenshot({path:path.join(artifacts,`failure-${browser.contexts().indexOf(page.context())}.png`),fullPage:true}).catch(()=>{});
    await writeFile(path.join(artifacts,'failure.json'),JSON.stringify({sid,errors,messages,requests,error:String(error)},null,2));
    throw error;
  } finally {await browser.close();}
}
