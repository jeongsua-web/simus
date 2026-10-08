// Isolated synthetic fixture; never use this as an authentication or production API server.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const directory = path.resolve(process.argv[2] || 'unity/Builds/bridge_test/city');
const port = Number(process.env.PORT || 4175);
const session = '10000000-0000-0000-0000-000000000001';
const npc = '20000000-0000-0000-0000-000000000001';
const epoch = Date.now();
let freeze = epoch + 600000;
function snapshot(crowd = false) {
  const now = Date.now();
  const actor = id => ({ npc_id: id, epoch: new Date(epoch).toISOString(), motion: { map_version: 'test-only-bridge-v1', path_version: 'test-only-square-v1', points: [[-8,1,-8],[8,1,-8],[8,1,8],[-8,1,8]], speed_mps: 1.4, loop: true } });
  return { session_id: session, status: now >= freeze ? 'CLOSING' : 'RUNNING', server_time: new Date(now).toISOString(), freeze_at: new Date(freeze).toISOString(), motion_time: new Date(Math.min(now,freeze)).toISOString(), frozen: now >= freeze, npcs: crowd ? [actor(npc),actor('40000000-0000-0000-0000-000000000001')] : [actor(npc)] };
}
const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unity bridge synthetic test</title>
<style>body{background:#eee;font:14px sans-serif;margin:8px}iframe{width:min(100%,430px);height:640px;border:0}pre{white-space:pre-wrap}button{padding:8px;margin:4px}</style>
<h1>TEST ONLY · 인증·전시 데이터 아님</h1><button onclick="retry()">재연결</button><button onclick="send('INIT')">중복 INIT</button><button onclick="freezeNow()">동결</button><button onclick="visibility(false)">숨김</button><button onclick="visibility(true)">복귀</button><button onclick="badMap()">지도 불일치</button><button onclick="dispose()">종료</button><br><iframe title="Unity test"></iframe><pre id="log"></pre>
<script>
let id, timer; window.messages=[];
const frame=document.querySelector('iframe');
const post=(type,fields={})=>frame.contentWindow.postMessage({channel:'simus-city',version:1,bridge_id:id,type,...fields},location.origin);
async function send(type='SNAPSHOT') { const s=await fetch('/fixture/own').then(r=>r.json());post(type,{session_id:s.session_id,own_npc_id:s.npcs[0].npc_id,snapshot:s}); }
function dispose(){clearInterval(timer);post('DISPOSE');}
function retry(){dispose();id=crypto.randomUUID();frame.src='/city/index.html?bridge_id='+id;}
function visibility(visible){post('VISIBILITY',{visible});clearInterval(timer);if(visible){send();timer=setInterval(send,2500);}}
async function freezeNow(){await fetch('/fixture/freeze',{method:'POST'});await send();}
async function badMap(){const s=await fetch('/fixture/own').then(r=>r.json());s.npcs[0].motion.map_version='wrong-map';post('SNAPSHOT',{session_id:s.session_id,own_npc_id:s.npcs[0].npc_id,snapshot:s});}
window.addEventListener('message',e=>{const m=e.data;if(e.origin!==location.origin||e.source!==frame.contentWindow||m.bridge_id!==id||m.channel!=='simus-city'||m.version!==1)return;messages.push(m);document.querySelector('#log').textContent=messages.map(x=>JSON.stringify(x)).join('\\n');if(m.type==='READY')send('INIT');if(m.type==='BOUND'){clearInterval(timer);timer=setInterval(send,2500);}});
window.addEventListener('pagehide',dispose);retry();
</script></html>`;
http.createServer(async (req,res) => {
  res.setHeader('Cache-Control','no-store');
  const url = new URL(req.url,'http://localhost');
  const json = data => { res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data)); };
  if(url.pathname==='/') {res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html);return;}
  if(url.pathname==='/fixture/freeze' && req.method==='POST'){freeze=Math.min(freeze,Date.now());json({ok:true});return;}
  if(url.pathname==='/fixture/own'){json(snapshot());return;}
  if(url.pathname===`/api/sessions/${session}/npcs`){json(snapshot(true));return;}
  if(url.pathname==='/api/city-state') {json({city_state:{session_id:session,status:Date.now()>=freeze?'CLOSING':'RUNNING',happiness:60,safety:60,cleanliness:70,version:'1',updated_at:new Date(epoch).toISOString(),overall_pollution:null,regions:[]}});return;}
  if(!url.pathname.startsWith('/city/')){res.writeHead(404).end();return;}
  const file=path.resolve(directory,decodeURIComponent(url.pathname.slice(6)));
  if(!file.startsWith(directory+path.sep)){res.writeHead(403).end();return;}
  try{
    if(!(await stat(file)).isFile())throw Error();
    res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.wasm':'application/wasm','.json':'application/json','.data':'application/octet-stream'})[path.extname(file)]||'application/octet-stream');
    res.end(await readFile(file));
  }catch{res.writeHead(404).end('Build missing. Run WebBridgeTestBuild.Build first.');}
}).listen(port,'127.0.0.1',()=>console.log(`Synthetic Unity fixture: http://127.0.0.1:${port} (build: ${directory})`));
