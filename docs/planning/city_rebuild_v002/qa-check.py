#!/usr/bin/env python3
"""Independent design review: no Unity writes/imports, no project dependencies."""
from pathlib import Path
import hashlib,json,math,itertools,sys
ROOT=Path(__file__).resolve().parents[3]
HERE=Path(__file__).resolve().parent
EPS=1e-6

def sha(path):
    with path.open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()

def rect(center,width,depth,yaw=0):
    # Unity positive Y rotation: local +Z points toward world +X.
    c,s=math.cos(math.radians(yaw)),math.sin(math.radians(yaw))
    return [(center[0]+x*c+z*s,center[1]-x*s+z*c) for x,z in [(-width/2,-depth/2),(width/2,-depth/2),(width/2,depth/2),(-width/2,depth/2)]]

def overlap(a,b):
    # Strict convex SAT; touching boundaries are not overlapping area.
    for poly in (a,b):
        for p,q in zip(poly,poly[1:]+poly[:1]):
            axis=(-(q[1]-p[1]),q[0]-p[0])
            aa=[x*axis[0]+z*axis[1] for x,z in a];bb=[x*axis[0]+z*axis[1] for x,z in b]
            if min(max(aa),max(bb))-max(min(aa),min(bb))<=EPS:return False
    return True

def pt_seg(p,a,b):
    dx,dz=b[0]-a[0],b[1]-a[1];ll=dx*dx+dz*dz
    t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/ll)) if ll else 0
    return math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz)

def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])

def seg_distance(a,b,c,d):
    if cross(a,b,c)*cross(a,b,d)<-EPS and cross(c,d,a)*cross(c,d,b)<-EPS:return 0
    return min(pt_seg(a,c,d),pt_seg(b,c,d),pt_seg(c,a,b),pt_seg(d,a,b))

def inside(p,poly):
    signs=[cross(a,b,p) for a,b in zip(poly,poly[1:]+poly[:1])]
    return min(signs)>=-EPS or max(signs)<=EPS

def seg_poly_distance(a,b,poly):
    if inside(a,poly) or inside(b,poly):return 0
    return min(seg_distance(a,b,c,d) for c,d in zip(poly,poly[1:]+poly[:1]))

def main():
    baseline=json.loads((HERE/'qa-protected-baseline.json').read_text())
    changed=[f['path'] for f in baseline['files'] if not (ROOT/f['path']).is_file() or sha(ROOT/f['path'])!=f['sha256']]
    result={'scope':'Independent static design QA only; not Unity import/physics/NavMesh/render validation','protected_file_count':len(baseline['files']),'protected_files_changed':changed,'errors':[],'warnings':[]}
    if changed:result['errors'].append({'check':'protected_files','paths':changed})
    path=HERE/'layout.json'
    if path.exists():
        p=json.loads(path.read_text());m=json.loads((HERE/'asset_measurements.json').read_text())
        result['layout_sha256']=sha(path)
        buildings=p['buildings']+p['campus']['components']; roads=p['roads'];nodes={n['id']:n for n in p['pedestrian_nodes']};edges=p['pedestrian_edges']
        result['counts']={'buildings':len(buildings),'street_buildings':len(p['buildings']),'campus_buildings':len(p['campus']['components']),'roads':len(roads),'nodes':len(nodes),'edges':len(edges)}
        def fail(check,items):
            if items:result['errors'].append({'check':check,'count':len(items),'items':items})
        polys={b['id']:rect((b['x'],b['z']),b['width'],b['depth'],b['yaw']) for b in buildings}
        fail('building_envelope_overlap',[[a['id'],b['id']] for a,b in itertools.combinations(buildings,2) if overlap(polys[a['id']],polys[b['id']])])
        fail('serialized_footprint_vs_transform',[b['id'] for b in buildings if max(math.dist(x,y) for x,y in zip(polys[b['id']],b['footprint_polygon']))>.002])
        asset={a['source']:a for a in m['assets']};dimension_errors=[]
        for b in p['buildings']:
            a=asset.get(b['source_blend'])
            if not a or max(abs(x-y) for x,y in zip([b['width'],b['depth'],b['height']],a['dimensions_blender_xyz']))>.01:dimension_errors.append(b['id'])
            if b['scale']!=[1,1,1]:dimension_errors.append(b['id']+' nonunit scale')
        source_components={b['id']:b for b in m['campus']['components']}
        for b in p['campus']['components']:
            a=source_components[b['id']];lo,hi=a['bounds_blender_xyz']['min'],a['bounds_blender_xyz']['max']
            if max(abs(v-w) for v,w in zip([b['width'],b['depth'],b['height']],[hi[i]-lo[i] for i in range(3)]))>.01:dimension_errors.append(b['id'])
            delta=b['delta_from_original'];expected=[(lo[0]+hi[0])/2+delta[0],(lo[1]+hi[1])/2+65+delta[1]]
            if math.dist(expected,[b['x'],b['z']])>.01:dimension_errors.append(b['id']+' source transform')
        fail('asset_dimensions_and_campus_transform',dimension_errors)
        ex=p['extent']
        fail('buildings_outside_extent',[bid for bid,poly in polys.items() if any(not(ex['xmin']-EPS<=x<=ex['xmax']+EPS and ex['zmin']-EPS<=z<=ex['zmax']+EPS) for x,z in poly)])
        road_hits=[];walk_hits=[];unmarked=[];walk_road_clearance=[];turn_hits=[];road_reserve_hits=[];crossing_profiles=[];crossing_issues=[]
        for r in roads:
            for bid,poly in polys.items():
                dist=min(seg_poly_distance(a,b,poly) for a,b in zip(r['points'],r['points'][1:]))
                if dist<r['carriageway_width']/2-.002:road_hits.append([bid,r['id'],round(dist,3)])
                elif dist<r['carriageway_width']/2+max(r['sidewalk_left'],r['sidewalk_right'])-.002:road_reserve_hits.append([bid,r['id'],round(dist,3)])
        for t in p.get('turning_spaces',[]):
            for bid,poly in polys.items():
                if 'radius' in t:
                    dist=seg_poly_distance((t['x'],t['z']),(t['x'],t['z']),poly)
                    hit=dist<t['radius']-.002
                else:hit=overlap(rect((t['x'],t['z']),t['width'],t['depth']),poly)
                if hit:turn_hits.append([t['road'],bid])
        fail('turning_space_vs_building',turn_hits);fail('building_vs_road_sidewalk_reserve',road_reserve_hits)
        for e in edges:
            if all(math.dist(a,b)<EPS for a,b in zip(e['points'],e['points'][1:])):continue
            for bid,poly in polys.items():
                dist=min(seg_poly_distance(a,b,poly) for a,b in zip(e['points'],e['points'][1:]))
                if dist<e['width']/2-.002:walk_hits.append([e['id'],bid,round(dist,3),e['width']/2])
            for r in roads:
                dist=min(seg_distance(a,b,c,d) for a,b in zip(e['points'],e['points'][1:]) for c,d in zip(r['points'],r['points'][1:]))
                # Shared streets are intentionally mixed traffic; other roads need explicit crossings.
                if r['role']=='service_shared':continue
                authorized_crossings=[e.get('crossing_road')]+e.get('crossing_roads',[])
                authorized=e['kind']=='crossing' and r['id'] in authorized_crossings
                if dist<r['carriageway_width']/2-.002 and not authorized:unmarked.append([e['id'],r['id'],round(dist,3)])
                elif dist<(r['carriageway_width']+e['width'])/2-.002 and not authorized:walk_road_clearance.append([e['id'],r['id'],round(dist,3),round((r['carriageway_width']+e['width'])/2,3)])
        for e in edges:
            if e['kind']!='crossing':continue
            declared={r for r in [e.get('crossing_road')]+e.get('crossing_roads',[]) if r}
            for rid in declared:
                r=next((r for r in roads if r['id']==rid),None)
                if not r:crossing_issues.append([e['id'],rid,'missing road']);continue
                length=sum(math.dist(a,b) for a,b in zip(e['points'],e['points'][1:]));angle_sines=[]
                for a,b in zip(e['points'],e['points'][1:]):
                    if math.dist(a,b)<EPS:continue
                    midpoint=[(a[i]+b[i])/2 for i in range(2)]
                    c,d=min(zip(r['points'],r['points'][1:]),key=lambda cd:pt_seg(midpoint,*cd))
                    sine=abs((b[0]-a[0])*(d[1]-c[1])-(b[1]-a[1])*(d[0]-c[0]))/(math.dist(a,b)*math.dist(c,d))
                    angle_sines.append(sine)
                profile={'edge':e['id'],'road':rid,'length':round(length,3),'minimum_angle_degrees':round(math.degrees(math.asin(max(0,min(1,min(angle_sines))))),1) if angle_sines else 0}
                crossing_profiles.append(profile)
                limit=1.5*(r['carriageway_width']+e['width'])
                if len(declared)==1 and length>limit+.01:crossing_issues.append([e['id'],rid,'excess crossing length',round(length,3),limit])
                if len(declared)==1 and length>=2 and angle_sines and min(angle_sines)<math.sin(math.radians(45))-.01:crossing_issues.append([e['id'],rid,'oblique or parallel crossing',profile['minimum_angle_degrees']])
        result['crossing_profiles']=crossing_profiles
        fail('crossing_geometry',crossing_issues)
        fail('building_vs_carriageway',road_hits);fail('finite_width_walk_vs_building',walk_hits);fail('walk_centerline_unmarked_carriageway_entry',unmarked);fail('finite_width_walk_vs_carriageway',walk_road_clearance)
        adjacency={n:set() for n in nodes};endpoint_errors=[]
        for e in edges:
            if e['from'] not in nodes or e['to'] not in nodes:endpoint_errors.append(e['id']+' missing node');continue
            for key,pt in [('from',e['points'][0]),('to',e['points'][-1])]:
                n=nodes[e[key]]
                if math.dist(pt,[n['x'],n['z']])>.002:endpoint_errors.append(e['id']+' '+key)
            adjacency[e['from']].add(e['to']);adjacency[e['to']].add(e['from'])
        fail('edge_geometry_endpoints',endpoint_errors)
        visited=set();todo=[next(iter(nodes))]
        while todo:
            n=todo.pop()
            if n in visited:continue
            visited.add(n);todo.extend(adjacency[n]-visited)
        fail('disconnected_nodes',sorted(set(nodes)-visited))
        fail('missing_building_access',[b['id'] for b in buildings if b['id']+'_ACCESS' not in nodes])
        route_errors=[]
        for route in p['routes']:
            sequence=route.get('expanded_nodes',route['nodes'])
            for a,b in zip(sequence,sequence[1:]):
                if b not in adjacency.get(a,set()):route_errors.append([route['id'],a,b])
        fail('npc_route_nonadjacent_nodes',route_errors)
        sport_hits=[]
        for feature in m['campus']['features']:
            if not any(feature['name'].endswith(t) for t in ['Basketball court','Tennis court','Sports field']):continue
            lo,hi=feature['bounds_design_unity_xz']['min'],feature['bounds_design_unity_xz']['max']
            shape=rect([(lo[i]+hi[i])/2 for i in range(2)],hi[0]-lo[0],hi[1]-lo[1])
            for e in edges:
                dist=min(seg_poly_distance(a,b,shape) for a,b in zip(e['points'],e['points'][1:]))
                if dist<e['width']/2-.002:sport_hits.append([feature['name'],e['id'],round(dist,3)])
        fail('walk_vs_preserved_sports_footprint',sport_hits)
        amenity_errors=[]
        for t in p.get('event_candidates',[])+p['park'].get('rest_areas',[]):
            distance=min(pt_seg((t['x'],t['z']),a,b)-e['width']/2 for e in edges for a,b in zip(e['points'],e['points'][1:]))
            if distance>.01:amenity_errors.append([t['id'],round(distance,3)])
        fail('event_or_rest_anchor_outside_walk_network',amenity_errors)
        facility_errors=[];covered={};facilities=p.get('crossing_facilities',[])
        edge_by_id={e['id']:e for e in edges}
        for f in facilities:
            for eid in f['covered_edge_ids']:
                covered[eid]=covered.get(eid,0)+1;e=edge_by_id.get(eid)
                if not e or e['kind']!='crossing':facility_errors.append([f['id'],eid,'not crossing']);continue
                if e.get('crossing_facility')!=f['id']:facility_errors.append([f['id'],eid,'edge facility mismatch'])
                candidates=[c for c in f['corridors'] if c['width']+0.002>=e['width'] and set(e.get('crossing_roads',[]))<=set(c['roads'])]
                if not any(all(min(pt_seg(pt,a,b) for a,b in zip(c['points'],c['points'][1:]))<=.002 for pt in e['points']) for c in candidates):facility_errors.append([f['id'],eid,'no matching reserved corridor'])
        for e in edges:
            if e['kind']=='crossing' and covered.get(e['id'])!=1:facility_errors.append([e['id'],'facility coverage !=1'])
        fail('crossing_facility_geometry_and_coverage',facility_errors)
        result['counts']['crossing_facilities']=len(facilities);result['counts']['crossing_edges']=sum(e['kind']=='crossing' for e in edges)
        park_errors=[]
        def in_polygon(pt,vertices):
            x,z=pt;odd=False
            for a,b in zip(vertices,vertices[1:]+vertices[:1]):
                if pt_seg(pt,a,b)<.002:return True
                if (a[1]>z)!=(b[1]>z) and x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]:odd=not odd
            return odd
        for mod in p['park'].get('reuse_modules',[]):
            a=asset.get(mod['source'])
            if not a or max(abs(x-y) for x,y in zip([mod['width'],mod['depth']],a['dimensions_blender_xyz'][:2]))>.002:park_errors.append([mod['id'],'measured dimensions'])
            if not all(in_polygon(pt,p['park']['polygon']) for pt in mod['footprint_polygon']):park_errors.append([mod['id'],'outside park'])
            for bid,bp in polys.items():
                if overlap(bp,mod['footprint_polygon']):park_errors.append([mod['id'],bid,'building overlap'])
        fail('park_module_envelopes',park_errors)
        vehicle_ends=[]
        for r in roads:
            for pt in [r['points'][0],r['points'][-1]]:
                joined=any(pt_seg(pt,a,b)<.01 for other in roads if other['id']!=r['id'] for a,b in zip(other['points'],other['points'][1:]))
                reserved=any(t['road']==r['id'] and math.dist(pt,[t['x'],t['z']])<.01 for t in p.get('turning_spaces',[])+p.get('external_connections',[]))
                if not(joined or reserved):vehicle_ends.append([r['id'],pt])
        fail('vehicle_road_end_without_connection_or_turn',vehicle_ends)
        if p['metadata']['map_version'] is not None or p['metadata']['npc_max_event_wait_seconds']!=90 or p['metadata']['event_logic_changed']!=False:fail('event_contract',['metadata'])
        result['status']='static_design_checks_passed' if not result['errors'] else 'revision_required'
        result['warnings']=['Conservative full asset envelope and round corridor ends are used; mesh-level collision and NavMesh require future Unity verification.','Road width, speed and junction radii are design proposals, not real-world statutory compliance certification.','Graph connectivity is not evidence of walkable height/slope/threshold geometry.']
    else:result['status']='baseline-only; layout pending' 
    (HERE/'qa-results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(result,ensure_ascii=False,indent=2))
    return bool(result['errors'])
if __name__=='__main__':sys.exit(main())
