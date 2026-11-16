// Disposable local play environment. Never reads DATABASE_URL or an existing cluster.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const web=path.join(repo,'web');
const require=createRequire(path.join(web,'package.json'));
const pg=require('pg');
const { generateKeyPair, exportJWK, SignJWT }=await import(require.resolve('jose'));
const bin=process.env.V003_PG_BIN||'/opt/homebrew/opt/postgresql@18/bin';
const pgPort=Number(process.env.V003_PG_PORT||55443),port=Number(process.env.V003_WEB_PORT||3210);
for(const p of [pgPort,port]) await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(p,'127.0.0.1',()=>s.close(resolve));});
const route=JSON.parse(await readFile(path.join(repo,'docs/content/v003-local-route.json'),'utf8'));
assert.deepEqual(JSON.parse(await readFile(path.join(web,'src/lib/routes/data/v003-local-route.json'),'utf8')),route,'Server route snapshot must match canonical Unity validation JSON');
const root=await mkdtemp(path.join(tmpdir(),'simus-v003-local-'));
const data=path.join(root,'data');
const run=(exe,args,env=process.env)=>new Promise((resolve,reject)=>{const c=spawn(exe,args,{cwd:repo,env,stdio:['ignore','pipe','pipe']});let out='';c.stdout.on('data',x=>out+=x);c.stderr.on('data',x=>out+=x);c.on('error',reject);c.on('exit',code=>{c.stdout.destroy();c.stderr.destroy();code===0?resolve(out):reject(Error(`${exe}: ${out}`));});});
let server,pool,started=false;
async function cleanup(){if(server&&server.exitCode===null){const done=once(server,'exit');server.kill();await done;}if(pool)await pool.end();if(started){await run(path.join(bin,'pg_ctl'),['-D',data,'-m','fast','-w','stop']);started=false;}}
process.once('SIGINT',()=>cleanup().then(()=>process.exit()));process.once('SIGTERM',()=>cleanup().then(()=>process.exit()));
try {
  console.log('Owned disposable directory:',root);
  await run(path.join(bin,'initdb'),['-D',data,'-U','postgres','-A','trust','--encoding=UTF8','--locale=C']);
  await run(path.join(bin,'pg_ctl'),['-D',data,'-l',path.join(root,'postgres.log'),'-o',`-h 127.0.0.1 -p ${pgPort}`,'-w','start']);started=true;
  const admin=new pg.Client({connectionString:`postgresql://postgres@127.0.0.1:${pgPort}/postgres`});await admin.connect();await admin.query('CREATE DATABASE simus_v003_local');await admin.end();
  const dbUrl=`postgresql://postgres@127.0.0.1:${pgPort}/simus_v003_local`;
  const psql=(file,args=[])=>run(path.join(bin,'psql'),['-X','-h','127.0.0.1','-p',String(pgPort),'-U','postgres','-d','simus_v003_local','-v','ON_ERROR_STOP=1',...args,'-f',file]);
  const migration=await run('python3',['-c',"import runpy; from types import SimpleNamespace; m=runpy.run_path('scripts/db/migrate.py'); print(m['plan'](SimpleNamespace(command='init',approval_reference=None),m['sources']()))"]);
  await writeFile(path.join(root,'managed-init.sql'),migration);await psql(path.join(root,'managed-init.sql'));
  await psql('db/verify_schema.sql');console.log('PASS managed migrations and verify_schema');
  await psql('db/seed_demo.sql');await psql('db/seed_exhibition.sql');
  const motion=route.motion||Object.fromEntries(['map_version','path_version','points','speed_mps','loop'].map(k=>[k,route[k]]));
  pool=new pg.Pool({connectionString:dbUrl});
  const originalContent=async()=> (await pool.query(`SELECT (SELECT jsonb_agg(to_jsonb(s)-'event_location' ORDER BY id) FROM simus.session_situations s WHERE session_id='16000000-0000-0000-0000-000000000001') AS situations,(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM simus.session_choices c WHERE session_id='16000000-0000-0000-0000-000000000001') AS choices,(SELECT jsonb_agg(to_jsonb(e) ORDER BY choice_id,region_id) FROM simus.choice_region_effects e WHERE session_id='16000000-0000-0000-0000-000000000001') AS effects`)).rows[0];
  const before=await originalContent(); assert.equal(before.situations.filter(s=>s.code.startsWith('EXHIBITION_')).length,30); assert.equal(before.choices.length,91);
  // One checked-out connection carries local settings into the guarded DRAFT patch.
  const client=await pool.connect();try{await client.query('SELECT set_config($1,$2,false)',['simus.v003_motion',JSON.stringify(motion)]);await client.query('SELECT set_config($1,$2,false)',['simus.v003_location',JSON.stringify(route.event_location)]);await client.query(await readFile(path.join(repo,'db/content/city-v003-local-draft.sql'),'utf8'));}finally{client.release();}
  assert.deepEqual(await originalContent(),before);console.log('PASS original 30 situations, 91 choices, UUIDs, scores and effects preserved');
  const {privateKey,publicKey}=await generateKeyPair('RS256',{extractable:true});const publicJwk={...await exportJWK(publicKey),kid:'v003-local'};
  const env={...process.env,DATABASE_URL:dbUrl,ADMIN_TOKEN_ISSUER:'simus-v003-local',ADMIN_TOKEN_AUDIENCE:'simus-v003-local',ADMIN_JWKS_URL:'',ADMIN_JWKS_JSON:JSON.stringify({keys:[publicJwk]}),NEXT_TELEMETRY_DISABLED:'1',SIMUS_V003_LOCAL_TEST:'1',SESSION_JOB_TOKEN:'v003-local-only-not-production',SIMUS_WEBGL_PUBLIC_ROOT:path.join(web,'public')};
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port',String(port)],{cwd:web,env,stdio:['ignore','pipe','pipe']});server.stdout.on('data',x=>process.stdout.write(x));server.stderr.on('data',x=>process.stderr.write(x));
  const base=`http://127.0.0.1:${port}`;
  for(let n=0;n<120;n++){if(server.exitCode!==null)throw Error('Next exited');try{const r=await fetch(base+'/api/health');if(r.ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
  const token=await new SignJWT({}).setProtectedHeader({alg:'RS256',kid:publicJwk.kid}).setIssuer(env.ADMIN_TOKEN_ISSUER).setAudience(env.ADMIN_TOKEN_AUDIENCE).setSubject('dev-admin').setIssuedAt().setExpirationTime('12h').sign(privateKey);
  const sid='16000000-0000-0000-0000-000000000001';
  await writeFile(path.join(root,'local-state.json'),JSON.stringify({root,port,pgPort,session_id:sid,url:base+'/v003-test',admin_token:token},null,2),{mode:0o600});
  const response=await fetch(`${base}/api/admin/sessions/${sid}/start`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({request_key:crypto.randomUUID()})});
  const body=await response.json();if(!response.ok)throw Error(`Start rejected ${response.status}: ${JSON.stringify(body)}`);
  console.log(`READY ${base}/v003-test session=${sid} map=${motion.map_version} path=${motion.path_version}`);
  console.log('Ctrl+C stops the owned Next server and PostgreSQL cluster. Runtime state:',path.join(root,'local-state.json'));
  await once(server,'exit');
} finally {await cleanup();}
