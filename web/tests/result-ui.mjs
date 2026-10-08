// Run against a built web server; API fixtures never touch the database.
// TEST_API_URL=http://127.0.0.1:3100 TEST_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/result-ui.mjs
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.TEST_PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({headless:true, executablePath:process.env.TEST_CHROMIUM_EXECUTABLE || undefined});
const base=process.env.TEST_API_URL;
const token='a'.repeat(64);
const payload={session:{id:'test',name:'결과 테스트'},result_kind:'SCORED',response_count:2,result:{alignment_code:'TRUE_NEUTRAL',interpretation:('긴 성향 해석입니다.\n').repeat(100),response_count:'2',x_score:'1',y_score:'-1'},city_state:null};
try {
  const page=await browser.newPage({viewport:{width:320,height:640}});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw new Error('denied');}},configurable:true}));
  let status='RUNNING',kind='SCORED',reads=0,issues=0,mode='ok',sharedMode='pending';
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    const json=(data,status=200)=>route.fulfill({status,json:data});
    if(path.endsWith('/responses')){reads++;return json({session:{...payload.session,status}});}
    if(path.endsWith('/result')) return json({...payload,result_kind:kind,result:kind==='SCORED'?payload.result:null});
    if(path.endsWith('/result-link')){
      issues++;
      if(mode==='offline') return route.abort('connectionfailed');
      if(mode==='server') return route.fulfill({status:503,body:'unavailable'});
      await new Promise(r=>setTimeout(r,250)); return json({token},201);
    }
    if(path==='/api/shared-result'){
      assert.equal(route.request().postDataJSON().token,token);
      if(sharedMode==='offline') return route.abort('connectionfailed');
      if(sharedMode==='server') return route.fulfill({status:502,body:'bad gateway'});
      if(sharedMode==='pending') return json({error:{code:'RESULT_NOT_FINALIZED'}},409);
      if(sharedMode==='expired') return json({error:{code:'LINK_NOT_FOUND'}},404);
      return json(payload);
    }
    return json({});
  });
  await page.goto(base+'/result/test');
  await page.getByText('회차 진행 중',{exact:true}).waitFor();
  assert.equal(await page.getByText('나의 도시 성향',{exact:true}).count(),0);
  status='CLOSING'; await page.getByRole('button',{name:'상태 새로고침'}).click();
  await page.getByText('결과 준비 중',{exact:true}).waitFor();
  status='FINALIZED'; await page.getByRole('button',{name:'상태 새로고침'}).click();
  await page.getByRole('heading',{name:'완전 중립'}).waitFor();
  const settledReads=reads;
  await page.waitForTimeout(5500); assert.equal(reads,settledReads,'finalized polling stops');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'320px page does not overflow');
  await page.getByRole('button',{name:'결과 링크 발급 / 다시 시도'}).evaluate(b=>{b.click();b.click();});
  await page.getByLabel('다른 기기용 결과 링크').waitFor(); assert.equal(issues,1);
  await page.getByRole('button',{name:'링크 복사 / 복사 다시 시도'}).click();
  await page.getByRole('status').filter({hasText:'복사하지 못했습니다'}).waitFor(); assert.equal(issues,1);
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.copied=text;}},configurable:true}));
  await page.getByRole('button',{name:'링크 복사 / 복사 다시 시도'}).click();
  await page.getByRole('status').filter({hasText:'결과 링크를 복사했습니다'}).waitFor();
  assert.equal(await page.evaluate(()=>window.copied),base+'/shared-result#'+token);
  for(const failure of ['offline','server']){
    mode=failure;
    await page.getByRole('button',{name:/새 링크 재발급|결과 링크 발급 \/ 다시 시도/}).click();
    await page.getByRole('status').filter({hasText:'발급 여부를 확인할 수 없어'}).waitFor();
    assert.equal(await page.getByLabel('다른 기기용 결과 링크').count(),0);
  }
  mode='ok'; await page.getByRole('button',{name:'결과 링크 발급 / 다시 시도'}).click(); await page.getByLabel('다른 기기용 결과 링크').waitFor();
  for(const nextKind of ['NO_RESPONSE','NOT_JOINED']){
    kind=nextKind; await page.reload();
    await page.getByText(nextKind==='NO_RESPONSE'?'참여한 선택 없음':'이 회차의 참여 기록이 없습니다',{exact:true}).waitFor();
    assert.equal(await page.getByText('나의 도시 성향',{exact:true}).count(),0);
    assert.equal(await page.getByRole('button',{name:'결과 링크 발급 / 다시 시도'}).count(),nextKind==='NO_RESPONSE'?1:0);
  }
  await page.goto(base+'/shared-result#'+token);
  await page.getByRole('heading',{name:'결과 준비 중'}).waitFor();
  sharedMode='offline'; await page.getByRole('button',{name:'결과 다시 확인'}).click();
  await page.getByRole('alert').filter({hasText:'네트워크'}).waitFor();
  sharedMode='server'; await page.getByRole('button',{name:'다시 시도',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'서버'}).waitFor();
  sharedMode='ok'; await page.getByRole('button',{name:'다시 시도',exact:true}).click();
  await page.getByRole('heading',{name:'TRUE_NEUTRAL'}).waitFor();
  sharedMode='expired'; await page.reload(); await page.getByRole('alert').filter({hasText:'만료'}).waitFor();
  await page.goto(base+'/shared-result'); await page.getByRole('alert').filter({hasText:'형식'}).waitFor();
  assert.deepEqual(errors,[]);
  console.log('PASS: result privacy/states, finalized polling, mobile wrapping, single issuance, failed rotation recovery, copy-only retry, shared pending/network/server/expired/missing link');
} finally {await browser.close();}
