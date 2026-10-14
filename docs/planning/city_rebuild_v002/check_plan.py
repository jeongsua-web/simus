"""Static metric geometry checks only. No Unity, NavMesh or camera claims."""
import json,math
from pathlib import Path
OUT=Path(__file__).parent
D=json.load(open(OUT/'layout.json'))
def dot(a,b):return a[0]*b[0]+a[1]*b[1]
def sat(a,b):
    for p in [a,b]:
        for x,y in zip(p,p[1:]+p[:1]):
            n=[y[1]-x[1],x[0]-y[0]];u=[dot(q,n) for q in a];v=[dot(q,n) for q in b]
            if max(u)<=min(v)+1e-6 or max(v)<=min(u)+1e-6:return False
    return True
def pdist(p,a,b):
    d=[b[i]-a[i] for i in range(2)];dd=dot(d,d);t=max(0,min(1,dot([p[i]-a[i] for i in range(2)],d)/dd)) if dd else 0
    return math.dist(p,[a[i]+t*d[i] for i in range(2)])
def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
def hit(a,b,c,d):return cross(a,b,c)*cross(a,b,d)<-1e-8 and cross(c,d,a)*cross(c,d,b)<-1e-8
def inside(p,vs):
    v=[cross(vs[i],vs[(i+1)%len(vs)],p) for i in range(len(vs))]
    return all(x>1e-6 for x in v) or all(x< -1e-6 for x in v)
def segdist(a,b,c,d):
    if hit(a,b,c,d):return 0
    return min(pdist(a,c,d),pdist(b,c,d),pdist(c,a,b),pdist(d,a,b))
def linepoly(a,b,p):
    if inside(a,p) or inside(b,p):return 0
    return min(segdist(a,b,c,d) for c,d in zip(p,p[1:]+p[:1]))
allb=D['buildings']+D['campus']['components'];issues=[]
for i,a in enumerate(allb):
    for b in allb[i+1:]:
        if sat(a['footprint_polygon'],b['footprint_polygon']):issues.append(['building_overlap',a['id'],b['id']])
    for r in D['roads']:
        reserve=r['carriageway_width']/2+max(r['sidewalk_left'],r['sidewalk_right'])
        dis=min(linepoly(x,y,a['footprint_polygon']) for x,y in zip(r['points'],r['points'][1:]))
        if dis<reserve-.01:issues.append(['road_building',a['id'],r['id'],round(dis,3),reserve])
for e in D['pedestrian_edges']:
    for b in allb:
        dis=min(linepoly(x,y,b['footprint_polygon']) for x,y in zip(e['points'],e['points'][1:]))
        if dis<e['width']/2-.015:issues.append(['walk_building',e['id'],b['id'],round(dis,3),e['width']/2])
    for r in D['roads']:
        dis=min(segdist(a,b,c,d) for a,b in zip(e['points'],e['points'][1:]) for c,d in zip(r['points'],r['points'][1:]))
        if dis<r['carriageway_width']/2+e['width']/2-.015 and not (e['kind']=='crossing' and (e.get('crossing_road')==r['id'] or r['id'] in e.get('crossing_roads',[]))) and not (r['role']=='service_shared' and e['kind']=='shared_lane_edge'):
            issues.append(['walk_road',e['id'],r['id'],round(dis,3)])
ids={n['id'] for n in D['pedestrian_nodes']};adj={id:set() for id in ids};seen=set();todo=[next(iter(ids))]
for e in D['pedestrian_edges']:adj[e['from']].add(e['to']);adj[e['to']].add(e['from'])
while todo:
    q=todo.pop()
    if q in seen:continue
    seen.add(q);todo.extend(adj[q]-seen)
if seen!=ids:issues.append(['disconnected_graph',sorted(ids-seen)])
report={'scope':'static conservative full-envelope metric checks; no runtime execution','buildings':len(allb),'nodes':len(ids),'edges':len(D['pedestrian_edges']),'issues':issues,'pass':not issues}
OUT.joinpath('static-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
raise SystemExit(1 if issues else 0)
