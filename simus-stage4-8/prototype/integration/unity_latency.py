import json
import subprocess
import time
from pathlib import Path
from uuid import uuid4
from smoke import call,client
BASE=Path(__file__).resolve().parents[1]
project=BASE/'unity/SIMUSPrototype'
verification=BASE/'unity/Verification'
ready=verification/'live-ready.txt'
result=verification/'live-http.txt'
for f in (ready,result):
    if f.exists(): f.unlink()
cmd=['/Applications/Unity/Hub/Editor/6000.3.24f1/Unity.app/Contents/MacOS/Unity','-batchmode','-nographics','-projectPath',str(project),'-simusLiveTest','-executeMethod','Simus.Editor.StageLiveVerification.Begin','-logFile',str(verification/'live-http.log')]
process=subprocess.Popen(cmd)
try:
    deadline=time.monotonic()+90
    while not ready.exists() and process.poll() is None and time.monotonic()<deadline: time.sleep(.05)
    assert ready.exists(), 'Unity was not ready in Play mode'
    round_id=ready.read_text().split()[0]
    visitor=client()
    assert call(visitor,'/api/join',{'round':round_id})[0]==200
    s=call(visitor,'/api/me?round='+round_id)[1]['situations'][0]
    start=time.monotonic()
    code,_=call(visitor,'/api/choice',{'round':round_id,'situation':s['id'],'choice':s['choices'][0]['id'],'request':str(uuid4())})
    assert code==200
    while not result.exists() and process.poll() is None and time.monotonic()<deadline: time.sleep(.01)
    assert result.exists(), 'Unity did not observe version 2'
    latency=time.monotonic()-start
    assert latency<2, f'Unity update {latency:.3f}s exceeded 2s'
    print(f'PASS choice request to Unity Play mode observed new version: {latency:.3f}s (loopback test DB)')
    (verification/'latency.txt').write_text(f'Choice HTTP request start to Unity Play mode file observation: {latency:.3f}s; target <2s. Local loopback, disposable PostgreSQL, not exhibition LAN.\n')
finally:
    try: process.wait(timeout=10)
    except subprocess.TimeoutExpired: process.terminate()
