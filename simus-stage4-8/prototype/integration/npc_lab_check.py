from http.cookiejar import CookieJar
from urllib.request import build_opener, HTTPCookieProcessor
from time import perf_counter
import json, statistics
BASE='http://127.0.0.1:8790/api/lab/npc'
clients=[build_opener(HTTPCookieProcessor(CookieJar())) for _ in range(2)]

def get(c):
 t=perf_counter()
 with c.open(BASE,timeout=3) as resp: data=json.load(resp)
 return data,(perf_counter()-t)*1000
first,_=get(clients[0]); second,_=get(clients[1]); restored,_=get(clients[0])
assert first['mock'] and first['npc_id']==restored['npc_id'] and first['npc_id']!=second['npc_id']
assert first['round']==second['round'] and first['path']==second['path']
assert first['path']==[{'x':-64,'y':1.4,'z':12},{'x':-64,'y':1.4,'z':45}]
assert abs(first['position']['x']+64)<1e-6 and 12<=first['position']['z']<=45
latencies=[get(clients[0])[1] for _ in range(100)]
print(f'PASS mock NPC: 2 separate IDs, same round/path, cookie restoration; 100 local HTTP polls median {statistics.median(latencies):.1f}ms, p95 {sorted(latencies)[94]:.1f}ms, max {max(latencies):.1f}ms')
