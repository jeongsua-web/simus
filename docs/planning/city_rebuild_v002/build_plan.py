"""Generate design documents only. Does not import, write, or execute Unity/Blender."""
import csv, json, math, heapq
from pathlib import Path

OUT=Path(__file__).parent
MEASURED=json.load(open(OUT/'asset_measurements.json'))
assets={Path(a['source']).stem:{'path':a['source'],'bounds':a['bounds_blender_xyz']} for a in MEASURED['assets'] if '/buildings/' in a['source']}
assets['Campus']={'path':MEASURED['campus']['source'],'bounds':MEASURED['campus']['bounds_blender_xyz'],'objects':[{'name':f['name'],'min':f['bounds_blender_xyz']['min'],'max':f['bounds_blender_xyz']['max']} for f in MEASURED['campus']['features']]}
def poly(x,z,w,d,yaw=0,margin=0):
    a=math.radians(yaw); c,s=math.cos(a),math.sin(a)
    return [[round(x+c*u+s*v,4),round(z-s*u+c*v,4)] for u,v in [(-w/2-margin,-d/2-margin),(w/2+margin,-d/2-margin),(w/2+margin,d/2+margin),(-w/2-margin,d/2+margin)]]
def cross(a,b,c): return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
def inside(p,vs):
    v=[cross(vs[i],vs[(i+1)%len(vs)],p) for i in range(len(vs))]
    return all(x>1e-6 for x in v) or all(x< -1e-6 for x in v)
def intersects(a,b,c,d): return cross(a,b,c)*cross(a,b,d)<-1e-7 and cross(c,d,a)*cross(c,d,b)<-1e-7
def blocked(a,b,polys):
    return any(inside(a,p) or inside(b,p) or any(inside([a[k]+t*(b[k]-a[k]) for k in range(2)],p) for t in [.01,.25,.5,.75,.99]) or any(intersects(a,b,p[i],p[(i+1)%len(p)]) for i in range(len(p))) for p in polys)
def shortest(a,b,obstacles):
    if not blocked(a,b,obstacles): return [a,b]
    pts=[a,b]+[v for p in obstacles for v in p]
    dist={0:0}; prev={}; todo=[(0,0)]
    while todo:
        cost,i=heapq.heappop(todo)
        if i==1: break
        if cost>dist[i]: continue
        for j,q in enumerate(pts):
            if j==i or blocked(pts[i],q,obstacles): continue
            nc=cost+math.dist(pts[i],q)
            if nc<dist.get(j,float('inf')): dist[j]=nc;prev[j]=i;heapq.heappush(todo,(nc,j))
    if 1 not in dist: raise ValueError(('No route',a,b))
    route=[b]; i=1
    while i: i=prev[i];route.append(pts[i])
    return route[::-1]

plan={'metadata':{'status':'approval_pending_design_only','design_id':'city_rebuild_v002','map_version':None,'units':'metres','axes':'Unity X east / Z north / Y up','source_axis_contract':'Design only: street (UX,UY,UZ)=(BX,BZ,BY); campus UY=BZ-0.18, UX=BX+instance delta, UZ=BY+65+instance delta; verify FBX handedness before implementation','runtime_verified':False,'npc_max_event_wait_seconds':90,'event_logic_changed':False},'extent':{'xmin':-225,'xmax':195,'zmin':-245,'zmax':190},'campus':{'center':{'x':0,'z':65},'yaw':0,'width':156.24,'depth':212.186,'asset':'unity/Assets/SIMUS/Art/buildings/campus/Campus.fbx','surface_y':0,'components':[],'retention':'Rigid transform at unit scale; preserve all existing buildings and sports field, selective instance child exclusion for duplicate external infrastructure only'},'buildings':[],'roads':[],'intersections':[],'districts':[],'pedestrian_nodes':[],'pedestrian_edges':[],'event_candidates':[],'routes':[]}
def road(id,role,points,w,sl,sr):
    plan['roads'].append({'id':id,'role':role,'points':points,'carriageway_width':w,'sidewalk_left':sl,'sidewalk_right':sr,'speed_design_kmh':30 if role=='main' else 20 if role=='collector' else 10,'construction':'new alignment; no whole legacy road network reuse'})
road('R01','main',[[-225,-85.75],[-135,-61],[-95,-61],[0,-61],[110,-61],[195,-28.3077]],6.5,3,3)
road('R02','collector',[[-95,190],[-95,65],[-95,-5],[-95,-61],[-106,-147],[-153,-205]],6,2.5,2.5)
road('R03','residential_lane',[[-106,-147],[-45,-157],[30,-177],[108,-174],[158,-200]],4.5,1.8,1.8)
road('R04','residential_lane',[[-95,65],[-163,65],[-190,100],[-190,152]],4.5,1.8,1.8)
road('R05','residential_lane',[[-95,-5],[-155,-5],[-191,-33]],4,1.8,1.8)
road('R06','service_shared',[[-75,-111],[-10,-111],[-10,-61]],3.5,0,0)
road('R07','service_shared',[[32,-113],[66,-113],[95,-126],[108,-174]],3.5,0,0)
for id,x,z,rs,typ,r in [('J01',-95,-61,['R01','R02'],'four_way',8),('J02',-95,65,['R02','R04'],'T',6),('J03',-95,-5,['R02','R05'],'T',5),('J04',-106,-147,['R02','R03'],'T',6),('J05',-10,-61,['R01','R06'],'restricted_service_T',4),('J06',108,-174,['R03','R07'],'T',5)]:
    plan['intersections'].append({'id':id,'x':x,'z':z,'roads':rs,'type':typ,'corner_radius':r,'notes':'corner radius in metres is a design reserve; verify vehicle swept path and kerb construction in Unity'})
plan['turning_spaces']=[{'road':'R04','x':-190,'z':152,'radius':7,'type':'turning_head'},{'road':'R02','x':-153,'z':-205,'radius':7,'type':'turning_head'},{'road':'R03','x':158,'z':-200,'radius':7,'type':'turning_head'},{'road':'R07','x':32,'z':-113,'width':10,'depth':10,'type':'small_delivery_turn_pad'},{'road':'R05','x':-191,'z':-33,'radius':7,'type':'turning_head'},{'road':'R06','x':-75,'z':-111,'width':10,'depth':10,'type':'small_delivery_turn_pad'}]
plan['external_connections']=[{'road':'R01','x':-225,'z':-85.75,'type':'west boundary portal; assumed continuation outside design extent'},{'road':'R01','x':195,'z':-28.3077,'type':'east boundary portal; assumed continuation outside design extent'},{'road':'R02','x':-95,'z':190,'type':'north boundary portal; assumed continuation outside design extent'}]
plan['districts']=[{'id':'school','type':'school','polygon':[[-78.12,-41.093],[78.12,-41.093],[78.12,171.093],[-78.12,171.093]]},{'id':'front_commerce','type':'commercial','polygon':[[-87,-72],[115,-72],[145,-101],[115,-140],[-82,-140]]},{'id':'west_residential','type':'residential','polygon':[[-223,-65],[-109,-65],[-109,179],[-223,179]]},{'id':'south_residential','type':'residential','polygon':[[-210,-140],[-112,-133],[165,-145],[184,-244],[-194,-244]]},{'id':'park','type':'park','polygon':[[88,-39],[123,-39],[159,-12],[176,33],[180,94],[169,142],[133,174],[90,169],[84,128],[91,75],[85,26]]}]
plan['park']={'polygon':plan['districts'][-1]['polygon'],'rest_areas':[{'id':'PZ01','x':140,'z':25,'radius':6},{'id':'PZ02','x':142,'z':118,'radius':7}],'shape':'irregular linked green belt, not rectangular district'}
specs=[]
def place(key,x,z,yaw=0,type=None): specs.append((key,x,z,yaw,type))
# Gate-front fine grain; back lanes, uneven setbacks, and intentionally varying footprints.
for k,x,z in [('01',-72,-84),('03',-49,-83),('02',-25,-86),('01',6,-82),('03',31,-84),('01',54,-82),('02',81,-86),('03',112,-89)]:
    place({'01':'COMMERCIAL_01_OLD_MULTI_TENANT','02':'COMMERCIAL_02_NEIGHBORHOOD_CENTER','03':'COMMERCIAL_03_MODERN_CORNER'}[k],x,z,180,'commercial')
for key,x,z in [('COMMERCIAL_03_MODERN_CORNER',-65,-129),('COMMERCIAL_01_OLD_MULTI_TENANT',-39,-128),('COMMERCIAL_02_NEIGHBORHOOD_CENTER',9,-128),('COMMERCIAL_01_OLD_MULTI_TENANT',43,-132),('COMMERCIAL_03_MODERN_CORNER',68,-135),('DEPARTMENT',127,-118)]: place(key,x,z,180,'commercial')
# Taller buildings remain northwest/backdrop; no tall frontage beside central gate/event plaza.
for key,x,z,yaw in [('APARTMENT_A_MIDRISE',-132,137,0),('APARTMENT_B_MIDRISE',-164,137,0),('APARTMENT_C_MIDRISE',-212,121,0),('APARTMENT_A_MIDRISE',-213,69,0)]: place(key,x,z,yaw,'apartment')
for key,x,z,yaw in [('VILLA_01_PILOTI_BRICK',-129,93,0),('VILLA_02_STONE_MODERN',-160,93,0),('VILLA_03_CORNER_MIXED',-126,35,180),('VILLA_01_PILOTI_BRICK',-155,32,180),('HOUSE_01_URBAN_MODERN',-185,30,180),('HOUSE_02_OLD_BRICK',-212,22,270),('HOUSE_03_NARROW_HOUSE',-126,-25,180),('VILLA_03_CORNER_MIXED',-156,-31,180),('HOUSE_01_URBAN_MODERN',-211,-32,270),('HOUSE_02_OLD_BRICK',-182,-49,180)]: place(key,x,z,yaw,'residential')
for i,(x,z,yaw) in enumerate([(-185,-161,180),(-160,-151,180),(-158,-176,270),(-106,-192,180),(-75,-187,180),(-46,-185,180),(-19,-201,180),(8,-207,180),(36,-204,180),(63,-201,180),(88,-200,180),(123,-211,180),(153,-226,180),(-178,-209,180),(-151,-226,180),(-119,-224,180),(-87,-222,180),(-54,-224,180),(-21,-228,180),(9,-231,180),(38,-227,180),(73,-226,180),(108,-232,180),(4,-151,0),(38,-150,0),(74,-157,0),(140,-155,0)]):
    key=['HOUSE_01_URBAN_MODERN','VILLA_01_PILOTI_BRICK','HOUSE_02_OLD_BRICK','VILLA_03_CORNER_MIXED','HOUSE_03_NARROW_HOUSE','VILLA_02_STONE_MODERN'][i%6]
    place(key,x,z,yaw,'residential')
for i,(key,x,z,yaw,typ) in enumerate(specs,1):
    a=assets[key]; lo,hi=a['bounds']['min'],a['bounds']['max'];w,d,h=[hi[j]-lo[j] for j in range(3)]
    b={'id':f'B{i:02}','type':typ,'asset':a['path'].replace('.blend','.fbx'),'source_blend':a['path'],'x':x,'z':z,'yaw':yaw,'width':round(w,3),'depth':round(d,3),'height':round(h,3),'scale':[1,1,1],'origin_correction':[0,0,0],'measurement_source':'2026-10-13 Blender background world bounds; see asset_measurements.json','fbx_bounds_status':'Blender import confirmed only commercial01/house01; others require Unity import verification','footprint_polygon':poly(x,z,w,d,yaw)}
    # South-facing source doorway proxy; actual doorway anchors supplied in asset audit separately.
    a0=math.radians(yaw); b['entrance']={'x':round(x-math.sin(a0)*(d/2+.2),4),'z':round(z-math.cos(a0)*(d/2+.2),4),'status':'planned exterior approach proxy; actual FBX doorway offset and orientation must be checked','source_direction':'local -Z provisional'}
    plan['buildings'].append(b)
# Full canopy/step/roof envelopes from reused source measurement. Resolve legacy overlaps by three instance-only deltas.
measurement=json.load(open(OUT/'asset_measurements.json'))
camp=assets['Campus']; objects=camp['objects']
deltas={'C00':[3,0],'C02':[0,-4],'C08':[0,-4],'C09':[9,0]}
for src in measurement['campus']['components']:
    dx,dz=deltas.get(src['id'],[0,0]);lo=src['bounds_blender_xyz']['min'];hi=src['bounds_blender_xyz']['max']
    x=(lo[0]+hi[0])/2+dx;z=(lo[1]+hi[1])/2+65+dz;w=hi[0]-lo[0];d=hi[1]-lo[1]
    door=src['entry_glass_center_design_unity_xyz'];ap=[door[0]+dx,lo[1]+65+dz-1.8]
    plan['campus']['components'].append({'id':src['id'],'name':src['name'],'type':'campus_building','x':round(x,4),'z':round(z,4),'yaw':0,'width':round(w,4),'depth':round(d,4),'height':round(hi[2]-lo[2],4),'footprint_polygon':poly(x,z,w,d),'original_footprint_polygon':poly(x-dx,z-dz,w,d),'delta_from_original':[dx,dz],'placement_origin':[src['placement_design_unity_xyz'][0]+dx,0,src['placement_design_unity_xyz'][2]+dz],'measurement_source':'asset_measurements.json campus component full envelope incl canopy/steps/parapet','split_objects':src['split_objects'],'fbx_names':src['fbx_names'],'entrance':{'x':door[0]+dx,'z':door[2]+dz,'status':'measured glass centre; normal/threshold/import unverified'},'approach_anchor':{'x':ap[0],'z':ap[1],'status':'planned south-side full-envelope approach; actual threshold unverified'}})
plan['campus']['retention']='All 14 buildings, sports field, plinth and site scale retained. 10 buildings preserve original offsets; C00 (+3,0), C02 (0,-4), C08 (0,-4), C09 (+9,0) resolve four legacy envelope overlaps via future per-instance wrappers; original FBX/Blend untouched.'
plan['districts'][0]['polygon']=[[-78.12,-41.093],[90,-41.093],[90,110],[78.12,110],[78.12,171.093],[-78.12,171.093]]
for key,name in [('field','Sports field'),('field_lawn','Field lawn')]:
    o=next(o for o in objects if o['name'].endswith('__'+name));lo,hi=o['min'],o['max']
    plan['campus'][key]={'x':(lo[0]+hi[0])/2,'z':65+(lo[1]+hi[1])/2,'width':hi[0]-lo[0],'depth':hi[1]-lo[1],'footprint_polygon':poly((lo[0]+hi[0])/2,65+(lo[1]+hi[1])/2,hi[0]-lo[0],hi[1]-lo[1])}
nodes=plan['pedestrian_nodes'];edges=plan['pedestrian_edges'];N={}
def node(id,x,z,kind='junction'):
    if id not in N: N[id]={'id':id,'x':round(x,4),'z':round(z,4),'kind':kind};nodes.append(N[id])
    return id
def edge(id,a,b,points=None,width=2.5,kind='walkway',road=None):
    p=points or [[N[a]['x'],N[a]['z']],[N[b]['x'],N[b]['z']]]
    edges.append({'id':id,'from':a,'to':b,'points':p,'width':width,'kind':kind,'crossing_road':road,'length':round(sum(math.dist(x,y) for x,y in zip(p,p[1:])),3)})
def chain(prefix,pts,width=2.5,kind='sidewalk'):
    ids=[node(f'{prefix}{i:02}',*p,kind) for i,p in enumerate(pts)]
    for i in range(len(ids)-1):edge(f'{prefix}E{i:02}',ids[i],ids[i+1],width=width,kind=kind)
    return ids
# Metric miter offsets put every sidewalk centre half sidewalk width beyond the carriageway edge.
def offset(points,amount):
    normals=[]
    for a,b in zip(points,points[1:]):
        dx,dz=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dz);normals.append([-dz/length,dx/length])
    result=[]
    for i,p in enumerate(points):
        if i==0:n=normals[0];factor=amount
        elif i==len(points)-1:n=normals[-1];factor=amount
        else:
            n=[normals[i-1][j]+normals[i][j] for j in range(2)];ln=math.hypot(*n);n=[v/ln for v in n];factor=amount/(n[0]*normals[i][0]+n[1]*normals[i][1])
        result.append([p[0]+factor*n[0],p[1]+factor*n[1]])
    return result
roadchains={}
for r in plan['roads']:
    sidewidth=max(r['sidewalk_left'],r['sidewalk_right']) or 2
    for side,sign in [('L',1),('R',-1)]:
        sidepoints=offset(r['points'],sign*(r['carriageway_width']/2+sidewidth/2))
        if r['id']=='R06':sidepoints[-1][1]=-65.75
        ids=chain(r['id']+side,sidepoints,sidewidth,'sidewalk' if r['role']!='service_shared' else 'shared_lane_edge');roadchains[(r['id'],side)]=ids
    # Terminal turn-head/end crossing connects both road sides; limited low-speed crossing, never along carriageway.
    li,ri=roadchains[(r['id'],'L')],roadchains[(r['id'],'R')]
    for end in [0,-1]:edge(r['id']+'_END_'+str(end),li[end],ri[end],width=sidewidth,kind='crossing',road=r['id'])
# At actual junctions join adjacent sidewalk corners; crossing segmentation applied below.
for j in plan['intersections']:
    candidates=[]
    for r in plan['roads']:
        if r['id'] not in j['roads']:continue
        for side in ['L','R']:
            candidates.extend(roadchains[(r['id'],side)])
    near=sorted(set(candidates),key=lambda id:math.dist([N[id]['x'],N[id]['z']],[j['x'],j['z']]))[:len(j['roads'])*2]
    if j['id']=='J05':
        bridge=node('J05_SOUTH',-10,-65.75,'sidewalk')
        for side in ['L','R']:
            source=roadchains[('R06',side)][-1];edge('J05_JOIN_'+side,source,bridge,width=2)
        edge('J05_MAIN_JOIN',bridge,roadchains[('R01','R')][3],width=2)
    else:
        for k in range(1,len(near)):edge(j['id']+'_CORNER_'+str(k),near[0],near[k],width=2,kind='junction_walk')
# Rear pedestrian alley uses clearance routing between all residential footprints, not straight links through row corners.
street_obstacles=[poly(b['x'],b['z'],b['width'],b['depth'],b['yaw'],1.1) for b in plan['buildings']]
lo_pts=[[N[roadchains[('R02','L')][-1]]['x'],N[roadchains[('R02','L')][-1]]['z']],[-106,-211],[-60,-211],[-21,-214],[9,-217],[38,-214],[73,-215],[110,-221.5],[145,-215]]
lower=chain('LW',lo_pts,1.8,'residential_pedestrian_alley')
for e in edges:
    if e['id'].startswith('LWE'): e['points']=shortest(e['points'][0],e['points'][-1],street_obstacles);e['length']=round(sum(math.dist(a,b) for a,b in zip(e['points'],e['points'][1:])),3)
edge('LOWER_CONNECT',roadchains[('R02','L')][-1],lower[0],width=1.8)
# Main-gate north and south sidewalks: explicit node at centreline X=0, reconnect on real measured offset segment.
mn=roadchains[('R01','L')];ms=roadchains[('R01','R')];we=roadchains[('R02','R')];ww=roadchains[('R02','L')]
node('MN_GATE',0,-56.25,'sidewalk');node('MS_GATE',0,-65.75,'sidewalk')
edge('MAIN_NORTH_JOIN','MN_GATE',mn[3],width=3);edge('MAIN_SOUTH_JOIN','MS_GATE',ms[3],width=3)
edge('X_GATE','MN_GATE','MS_GATE',width=3,kind='crossing',road='R01')
node('MN_PARK',110,-55.83,'sidewalk');edge('MAIN_PARK_JOIN','MN_PARK',mn[4],width=2.5)
gate=node('GATE_MAIN',0,-41.093,'gate'); back=node('GATE_BACK',10,171.093,'gate');hub=node('CAMPUS_PLAZA',8,115,'plaza')
eastgate=node('GATE_PARK',78.12,115,'pedestrian_gate')
obstacles=[poly(b['x'],b['z'],b['width'],b['depth'],b['yaw'],1.65) for b in plan['campus']['components']]+[poly(plan['campus']['field']['x'],plan['campus']['field']['z'],plan['campus']['field']['width'],plan['campus']['field']['depth'],0,1.65)]
edge('C_GATE_LINK','MN_GATE',gate,width=3)
for ft in MEASURED['campus']['features']:
    if any(key in ft['name'] for key in ['Basketball court','Tennis court','Central garden','Upper garden','South garden']):
        lo,hi=ft['bounds_design_unity_xz']['min'],ft['bounds_design_unity_xz']['max'];obstacles.append(poly((lo[0]+hi[0])/2,(lo[1]+hi[1])/2,hi[0]-lo[0],hi[1]-lo[1],0,1.65))
plan['campus']['plaza']={'x':8,'z':115,'width':16,'depth':14,'footprint_polygon':poly(8,115,16,14),'status':'planned open plaza preserving central garden; not measured asset'}
for id,a,b in [('C_SPINE',gate,hub),('C_BACK',hub,back),('C_PARK',hub,eastgate)]:
    edge(id,a,b,shortest([N[a]['x'],N[a]['z']],[N[b]['x'],N[b]['z']],obstacles),3,'campus_walk')
edge('BACK_NEIGHBORHOOD',back,we[0],[[10,171.093],[10,185],[N[we[0]]['x'],185],[N[we[0]]['x'],N[we[0]]['z']]],2.5,'campus_walk')
park=chain('PK',[[78.12,115],[101,116],[120,144],[151,138],[165,100],[153,65],[166,30],[140,25],[114,2],[100,-28],[110,-55.83]],2.5,'park_trail')
edge('PK_ENTRY',eastgate,park[0]);edge('PK_COMMERCE',park[-1],'MN_PARK');edge('PK_LOOP',park[1],park[8],[[101,116],[99,72],[114,2]],2.5,'park_trail')
node('PARK_REST_2',142,118,'rest_area');edge('REST_2_LINK','PARK_REST_2',park[4],width=2.5,kind='park_trail')
# Connect every existing campus building by an obstacle-aware design access path.
for b in plan['campus']['components']:
    ap=[b['approach_anchor']['x'],b['approach_anchor']['z']];b['approach_anchor']={'x':ap[0],'z':ap[1],'status':'planned outside reserved roof envelope'}
    dn=node(b['id']+'_ACCESS',*ap,'building_approach')
    path=shortest(ap,[N[hub]['x'],N[hub]['z']],obstacles)
    edge(b['id']+'_LINK',dn,hub,path,2.5,'campus_walk')
# Street building approach chooses nearest safe path projection; reserve corridor stays outside all buildings.
all_ob=[poly(b['x'],b['z'],b['width'],b['depth'],b['yaw'],1.05) for b in plan['buildings']]
def project(p,a,b):
    v=[b[i]-a[i] for i in range(2)];dd=sum(q*q for q in v);t=max(0,min(1,sum((p[i]-a[i])*v[i] for i in range(2))/dd)) if dd else 0
    return [a[i]+t*v[i] for i in range(2)]
road_ob=[]
for r in plan['roads']:
    radius=r['carriageway_width']/2+.9
    for a,b in zip(r['points'],r['points'][1:]):
        dx,dz=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dz);nx,nz=-dz/length,dx/length
        road_ob.append([[a[0]+radius*nx,a[1]+radius*nz],[b[0]+radius*nx,b[1]+radius*nz],[b[0]-radius*nx,b[1]-radius*nz],[a[0]-radius*nx,a[1]-radius*nz]])
base_edges=list(edges)
for b in plan['buildings']:
    yaw=math.radians(b['yaw']);ap=[b['x']-math.sin(yaw)*(b['depth']/2+1.2),b['z']-math.cos(yaw)*(b['depth']/2+1.2)]
    b['approach_anchor']={'x':round(ap[0],4),'z':round(ap[1],4),'status':'planned 1.2m outside footprint; door-to-anchor gap awaits mesh verification'}
    dn=node(b['id']+'_ACCESS',*ap,'building_approach');cands=[]
    for e in base_edges:
        if e['kind'] in ['campus_walk','park_trail','crossing'] or e['id'].startswith('C_'):continue
        for segment_index,(a,c) in enumerate(zip(e['points'],e['points'][1:])):
            q=project(ap,a,c)
            if not blocked(ap,q,all_ob+road_ob):cands.append((math.dist(ap,q),q,e,segment_index))
    if not cands:
        nearby=[p for p in all_ob+road_ob if min(math.dist(ap,v) for v in p)<65]
        options=[]
        for e in base_edges:
            if e['kind'] not in ['sidewalk','shared_lane_edge','residential_pedestrian_alley']:continue
            for segment_index,(a,c) in enumerate(zip(e['points'],e['points'][1:])):
                q=project(ap,a,c)
                if not any(inside(q,p) for p in nearby): options.append((math.dist(ap,q),q,e,segment_index))
        for _,q,e,segment_index in sorted(options,key=lambda v:v[0])[:8]:
            try:
                routed=shortest(ap,q,nearby);cands.append((sum(math.dist(a,b) for a,b in zip(routed,routed[1:])),q,e,segment_index,routed));break
            except ValueError:pass
        if not cands:raise ValueError(('No building access',b['id'],ap))
    selected=min(cands,key=lambda x:x[0]);_,q,e,segment_index=selected[:4];access_points=selected[4] if len(selected)>4 else [ap,q];jn=node(b['id']+'_JUNCTION',*q,'path_branch')
    edge(b['id']+'_ACCESS_EDGE',dn,jn,access_points,width=1.8,kind='building_access')
    # Explicit graph branch reconnects along existing polyline; no phantom endpoint connectivity.
    a=[N[e['from']]['x'],N[e['from']]['z']];c=[N[e['to']]['x'],N[e['to']]['z']]
    edge(b['id']+'_BRANCH',jn,e['from'],[q]+e['points'][:segment_index+1][::-1],min(2,e['width']),e['kind'])
    b['access_edge']=b['id']+'_ACCESS_EDGE';b['network_junction']=jn
# Split actual crossing sections from sidewalk pieces; never legalise a long along-road edge by changing its label.
def pdist(p,a,b):return math.dist(p,project(p,a,b))
def road_distance(p,r):return min(pdist(p,a,b) for a,b in zip(r['points'],r['points'][1:]))
old_edges=list(edges);edges.clear()
for original in old_edges:
    part=0;last_node=original['from']
    for segi,(a,b) in enumerate(zip(original['points'],original['points'][1:])):
        length=math.dist(a,b)
        if length<1e-5:
            if all(math.dist(x,y)<1e-5 for x,y in zip(original['points'],original['points'][1:])):
                edge(original['id']+'_ZERO',last_node,original['to'],[a,b],original['width'],original['kind'],original.get('crossing_road'));last_node=original['to']
            continue
        steps=max(2,math.ceil(length/.4));ts={0.,1.}
        for r in plan['roads']:
            radius=r['carriageway_width']/2+original['width']/2
            def on(t):return road_distance([a[k]+t*(b[k]-a[k]) for k in range(2)],r)<radius-.0005
            for i in range(steps):
                tl,tr=i/steps,(i+1)/steps
                if on(tl)==on(tr):continue
                state=on(tl)
                for _ in range(25):
                    tm=(tl+tr)/2
                    if on(tm)==state:tl=tm
                    else:tr=tm
                ts.add((tl+tr)/2)
        ts=sorted(ts)
        for ta,tb in zip(ts,ts[1:]):
            p=[[a[k]+t*(b[k]-a[k]) for k in range(2)] for t in [ta,tb]]
            if math.dist(*p)<1e-5:continue
            midpoint=[(p[0][k]+p[1][k])/2 for k in range(2)]
            crossing=[r['id'] for r in plan['roads'] if road_distance(midpoint,r)<r['carriageway_width']/2+original['width']/2-.0005]
            end_id=original['to'] if segi==len(original['points'])-2 and tb==1 else node(original['id']+'_CUT_'+str(part),*p[-1],'crossing_limit' if crossing else 'path_bend')
            kind='crossing' if crossing else ('sidewalk' if original['kind']=='crossing' else original['kind'])
            edge(original['id']+'_S'+str(part),last_node,end_id,p,original['width'],kind,crossing[0] if len(crossing)==1 else None)
            edges[-1]['crossing_roads']=crossing;edges[-1]['source_edge']=original['id'];edges[-1]['notes']='short finite-width road approach/crossing section' if crossing else ''
            last_node=end_id;part+=1
# Routes are exact adjacent graph node sequences, not waypoints with imaginary direct connections.
adj={id:[] for id in N}
for e in edges:adj[e['from']].append((e['to'],e['length'],e['id']));adj[e['to']].append((e['from'],e['length'],e['id']))
def graphroute(a,b):
    dist={a:0};prev={};todo=[(0,a)]
    while todo:
        cost,q=heapq.heappop(todo)
        if q==b:break
        if cost>dist[q]:continue
        for n,w,eid in adj[q]:
            nc=cost+w
            if nc<dist.get(n,float('inf')):dist[n]=nc;prev[n]=(q,eid);heapq.heappush(todo,(nc,n))
    if b not in dist:raise ValueError(('Disconnected route',a,b))
    ns=[b];es=[];q=b
    while q!=a:q,eid=prev[q];ns.append(q);es.append(eid)
    return ns[::-1],es[::-1],dist[b]
for id,waypoints,purpose in [('NPC_A',['CAMPUS_PLAZA','GATE_MAIN','B04_ACCESS'],'campus to gate-front shop'),('NPC_B',['CAMPUS_PLAZA','GATE_PARK','PARK_REST_2','PK07','MN_PARK'],'park loop and commerce return'),('NPC_C',['GATE_BACK','B16_ACCESS','B34_ACCESS'],'back gate to west/south mixed residential')]:
    route_nodes=[];route_edges=[];length=0
    for a,b in zip(waypoints,waypoints[1:]):
        ns,es,ln=graphroute(a,b);route_nodes+=ns if not route_nodes else ns[1:];route_edges+=es;length+=ln
    plan['routes'].append({'id':id,'nodes':route_nodes,'edges':route_edges,'purpose':purpose,'length_m':round(length,2),'walk_time_at_existing_1_4m_s':round(length/1.4,1),'status':'design route only; not runtime patrol or event route; 90s is event wait, not whole route completion'})
plan['event_candidates']=[{'id':'EC01','x':0,'z':-41,'label':'gate meeting','status':'candidate_only'},{'id':'EC02','x':8,'z':115,'label':'campus plaza','status':'candidate_only'},{'id':'EC03','x':140,'z':25,'label':'park rest','status':'candidate_only'},{'id':'EC04','x':N['R04R01']['x'],'z':N['R04R01']['z'],'label':'neighborhood corner','status':'candidate_only'},{'id':'EC05','x':N['R03L02']['x'],'z':N['R03L02']['z'],'label':'residential walking junction','status':'candidate_only'}]
# One physical facility can contain several junction arms and many duplicated graph approach fragments.
facilities={}
for e in edges:
    if e['kind']!='crossing' or not e.get('crossing_roads'):continue
    mid=[sum(p[k] for p in e['points'])/len(e['points']) for k in range(2)]
    zones=[]
    for j in plan['intersections']:
        if set(j['roads'])&set(e['crossing_roads']):zones.append((math.dist(mid,[j['x'],j['z']]),'XC_'+j['id'],j['x'],j['z'],'junction_controlled_pedestrian_area'))
    for i,t in enumerate(plan['turning_spaces']):
        if t['road'] in e['crossing_roads']:zones.append((math.dist(mid,[t['x'],t['z']]),'XC_T'+str(i+1),t['x'],t['z'],'low_speed_turning_area_pedestrian_priority'))
    for i,t in enumerate(plan['external_connections']):
        if t['road'] in e['crossing_roads']:zones.append((math.dist(mid,[t['x'],t['z']]),'XC_BOUND'+str(i+1),t['x'],t['z'],'boundary_crossing_reserve'))
    zones.append((math.dist(mid,[0,-61]),'XC_GATE',0,-61,'gate_crosswalk'))
    distance,key,x,z,typ=min(zones)
    if distance>17:
        # Isolated access crossings: cluster coincident fragments within 5m, distinct from junction facilities.
        matches=[(math.dist(mid,[f['x'],f['z']]),fid) for fid,f in facilities.items() if f['type']=='local_access_crossing' and set(e['crossing_roads'])==set(f['roads'])]
        if matches and min(matches)[0]<5:key=min(matches)[1];x,z=facilities[key]['x'],facilities[key]['z']
        else:key='XC_LOCAL_'+str(len(facilities)+1);x,z=mid
        typ='local_access_crossing'
    f=facilities.setdefault(key,{'id':key,'x':round(x,4),'z':round(z,4),'type':typ,'roads':[],'width':e['width'],'covered_edge_ids':[],'corridors':[],'status':'planned controlled pedestrian crossing facility; kerbs, signals/priority and physical stripes require Unity verification'})
    f['roads']=sorted(set(f['roads']+e['crossing_roads']));f['width']=max(f['width'],e['width']);f['covered_edge_ids'].append(e['id']);e['crossing_facility']=key
    points=[[round(v,3) for v in p] for p in e['points']]
    if len(points)==2 and points[0]!=points[1]:
        geom=sorted(points)
        same=next((c for c in f['corridors'] if c['points']==geom and c['roads']==e['crossing_roads']),None)
        if same:same['width']=max(same['width'],e['width'])
        else:f['corridors'].append({'points':geom,'width':e['width'],'roads':e['crossing_roads']})
plan['crossing_facilities']=list(facilities.values())
# Planned selective park reuse: existing 12m module envelopes, no claim of walkability through imported props.
park_assets=[a for a in MEASURED['assets'] if 'park' in a['source'].lower() and a['dimensions_blender_xyz'][0]<=12.01 and a['dimensions_blender_xyz'][1]<=12.01]
plan['park']['reuse_modules']=[]
for i,(x,z) in enumerate([(140,25),(142,118)]):
    if not park_assets:break
    src=park_assets[i%len(park_assets)]
    plan['park']['reuse_modules'].append({'id':'PM'+str(i+1),'asset':src['existing_fbx'],'source':src['source'],'x':x,'z':z,'yaw':0,'width':12,'depth':12,'footprint_polygon':poly(x,z,12,12),'strategy':'reuse ground/deck/benches via new wrapper; select foliage outside reserved paths; full-module prop collision unverified','scale':[1,1,1]})
def area(p):return abs(sum(p[i][0]*p[(i+1)%len(p)][1]-p[(i+1)%len(p)][0]*p[i][1] for i in range(len(p))))/2
plan['density_metrics']=[]
for dist in plan['districts']:
    selected=plan['campus']['components'] if dist['type']=='school' else [b for b in plan['buildings'] if inside([b['x'],b['z']],dist['polygon'])]
    floor=sum(b['width']*b['depth'] for b in selected);parcel=area(dist['polygon'])
    plan['density_metrics'].append({'district':dist['id'],'area_m2':round(parcel,2),'building_count':len(selected),'conservative_full_envelope_area_m2':round(floor,2),'envelope_coverage_percent':round(floor/parcel*100,2),'notes':'full canopy/roof/property envelope, not gross floor area or statutory building coverage; unassigned outer buffer is not a residential parcel'})
OUT.joinpath('layout.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2)+'\n')
def table(name,rows,keys):
    with OUT.joinpath(name).open('w',newline='') as f:
        wr=csv.DictWriter(f,fieldnames=keys);wr.writeheader()
        for r in rows:wr.writerow({k:json.dumps(r.get(k),ensure_ascii=False) if isinstance(r.get(k),(list,dict)) else r.get(k) for k in keys})
table('buildings.csv',plan['buildings'],['id','type','asset','x','z','yaw','width','depth','height','scale','origin_correction','entrance','approach_anchor','measurement_source'])
table('campus-placements.csv',plan['campus']['components'],['id','name','x','z','yaw','width','depth','height','placement_origin','delta_from_original','entrance','approach_anchor','measurement_source'])
table('crossings.csv',plan['crossing_facilities'],['id','x','z','type','roads','width','corridors','covered_edge_ids','status'])
table('density.csv',plan['density_metrics'],['district','area_m2','building_count','conservative_full_envelope_area_m2','envelope_coverage_percent','notes'])
table('roads.csv',plan['roads'],['id','role','points','carriageway_width','sidewalk_left','sidewalk_right','speed_design_kmh'])
table('pedestrian_nodes.csv',nodes,['id','x','z','kind'])
table('pedestrian_edges.csv',edges,['id','from','to','points','width','kind','crossing_road','crossing_roads','crossing_facility','source_edge','length'])
print(f'Wrote design: {len(plan["buildings"])} reused street buildings, 14 retained campus buildings, {len(nodes)} nodes/{len(edges)} edges')
