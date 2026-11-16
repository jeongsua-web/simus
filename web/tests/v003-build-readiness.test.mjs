import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
const route=JSON.parse(await readFile(new URL('../src/lib/routes/data/v003-local-route.json',import.meta.url)));
const originalStatus=route.validation_status;
const canonical=JSON.parse(await readFile(new URL('../../docs/content/v003-local-route.json',import.meta.url)));
const source=await readFile(new URL('../src/lib/city/session-build-readiness.ts',import.meta.url),'utf8');
const builds=await readFile(new URL('../src/lib/city/city-builds.ts',import.meta.url),'utf8');
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const routing={};vm.runInNewContext(compile(builds),{exports:routing});
class ApiError extends Error {constructor(status,code,message){super(message);this.status=status;this.code=code;}}
const exports={};
const requireModule=name=>({'node:fs/promises':{readFile,mkdir,readdir:async p=>(await import('node:fs/promises')).readdir(p),access:async p=>(await import('node:fs/promises')).access(p)},'node:path':{default:path},'../api':{ApiError},'./city-builds':routing,'../routes/v003-route':{localRoute:()=>route},'../npc/npc-position-sync':{validateMotion:()=>{}},'../events/event-locations':{assertLocationGroups:()=>{}},'./city-v002-graph.mjs':{}}[name]);
vm.runInNewContext(compile(source),{exports,require:requireModule,process,JSON});
test('v003 canonical snapshot and actual artifact guards',async()=>{
 assert.deepEqual(route,canonical);
 route.validation_status="unity_physics_passed";
 const root=await mkdtemp(path.join(tmpdir(),'simus-v003-guards-'));
 const old=process.env.SIMUS_WEBGL_PUBLIC_ROOT;process.env.SIMUS_WEBGL_PUBLIC_ROOT=root;
 const target=path.join(root,routing.cityBuildBase(route.map_version));await mkdir(path.join(target,'Build'),{recursive:true});
 for(const file of ['index.html','bridge.js','Build/a.loader.js','Build/a.framework.js','Build/a.wasm','Build/a.data'])await writeFile(path.join(target,file),'guard fixture, never a playable build');
 const good={protocol_version:1,map_version:route.map_version,path_versions:[route.path_version],kind:'city-masterplan-v003-local-session',source_scene_sha256:route.source_scene_sha256,npc_motion_enabled:true,route_validation_status:"unity_physics_passed"};
 const motion={...route,loop:false};const save=build=>writeFile(path.join(target,'build.json'),JSON.stringify(build));
 async function blocked(build,m=motion,code='NPC_PATH_INCOMPATIBLE'){await save(build);await assert.rejects(exports.assertSessionBuild(m),e=>e.code===code);}
 try{
  await save(good);await exports.assertSessionBuild(motion);
  route.validation_status="candidate_pending_unity_physics";await blocked(good);route.validation_status="unity_physics_passed";
  await blocked({...good,route_validation_status:undefined});
  await blocked({...good,map_version:'wrong'},motion,'CITY_MAP_MISMATCH');
  await blocked({...good,path_versions:undefined});await blocked({...good,npc_motion_enabled:undefined});
  await blocked({...good,source_scene_sha256:'wrong'});await blocked({...good,path_versions:['wrong']});
  await blocked(good,{...motion,path_version:'wrong'});await blocked(good,{...motion,points:[[0,0,0],[1,0,0]]});
  await blocked({...good,npc_motion_enabled:false},motion,'CITY_NPC_DISABLED');
  await save(good);await rm(path.join(target,'Build/a.wasm'));await assert.rejects(exports.assertSessionBuild(motion),e=>e.code==='CITY_BUILD_UNAVAILABLE');
 }finally{route.validation_status=originalStatus;if(old===undefined)delete process.env.SIMUS_WEBGL_PUBLIC_ROOT;else process.env.SIMUS_WEBGL_PUBLIC_ROOT=old;await rm(root,{recursive:true,force:true});}
});
