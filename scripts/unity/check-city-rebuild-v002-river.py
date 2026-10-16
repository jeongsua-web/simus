#!/usr/bin/env python3
"""Independent river design and serialized scene QA; no Unity writes or runtime claim."""
import argparse
import collections
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import re
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
PLAN = ROOT / 'docs/planning/city_rebuild_v002'
VERIFY = ROOT / 'docs/verification'
SCENE = ROOT / 'unity/Assets/SIMUS/Scenes/city_rebuild_v002/CityRebuild_v002.unity'


def sha(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


def curve(control):
    result = []
    for i in range(len(control) - 1):
        a, b, c, d = control[max(0, i - 1)], control[i], control[i + 1], control[min(len(control) - 1, i + 2)]
        for n in range(101):
            t = n / 100
            point = tuple(.5 * (2*b[j] + (-a[j]+c[j])*t + (2*a[j]-5*b[j]+4*c[j]-d[j])*t*t + (-a[j]+3*b[j]-3*c[j]+d[j])*t*t*t) for j in (0, 1))
            if not result or math.dist(result[-1], point) > 1e-8:
                result.append(point)
    return result


def inside(point, polygon):
    x, z = point
    result = False
    for a, b in zip(polygon, polygon[1:] + polygon[:1]):
        if (a[1] > z) != (b[1] > z) and x < (b[0]-a[0]) * (z-a[1]) / (b[1]-a[1]) + a[0]:
            result = not result
    return result


def scene_blocks(path):
    text = path.read_text(encoding='utf-8')
    blocks = {int(i): (int(kind), body) for kind, i, body in re.findall(r'^--- !u!(\d+) &(-?\d+)(?: stripped)?\n(.*?)(?=^--- !u!|\Z)', text, re.M | re.S)}
    names, transforms = {}, {}
    for fid, (kind, body) in blocks.items():
        if kind == 1:
            match = re.search(r'^  m_Name: (.*)$', body, re.M)
            if match:
                name = match.group(1)
                names[fid] = json.loads(name) if name.startswith('"') else name
        if kind == 4:
            go = re.search(r'm_GameObject: \{fileID: (-?\d+)\}', body)
            if go:
                transforms[int(go.group(1))] = (fid, body)
    return text, blocks, names, transforms


def height_at(point, triangles):
    """Vertical triangle intersection, including boundary tolerance; not physics."""
    x, z = point
    result = []
    for a, b, c in triangles:
        denominator = (b[2]-c[2])*(a[0]-c[0]) + (c[0]-b[0])*(a[2]-c[2])
        if abs(denominator) < 1e-10:
            continue
        u = ((b[2]-c[2])*(x-c[0]) + (c[0]-b[0])*(z-c[2])) / denominator
        v = ((c[2]-a[2])*(x-c[0]) + (a[0]-c[0])*(z-c[2])) / denominator
        if min(u, v, 1-u-v) >= -1e-5:
            result.append(u*a[1] + v*b[1] + (1-u-v)*c[1])
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--design-only', action='store_true')
    parser.add_argument('--output', type=Path, default=VERIFY / 'city-rebuild-v002-river-static-results.json')
    args = parser.parse_args()
    checks = []

    def record(name, passed, evidence):
        checks.append({'check': name, 'status': 'PASS' if passed else 'FAIL', 'evidence': evidence})

    qa = module('v002_geometry', PLAN / 'qa-check.py')
    layout = json.loads((PLAN / 'layout.json').read_text(encoding='utf-8'))
    design = json.loads((PLAN / 'river-design.json').read_text(encoding='utf-8'))
    points = curve(design['control_points'])
    segments = list(zip(points, points[1:]))
    half = design['corridor_width_m'] / 2
    wet = design['water_width_m'] / 2

    def distance_line(line):
        return min(qa.seg_distance(a, b, c, d) for a, b in segments for c, d in zip(line, line[1:]))

    def distance_poly(polygon):
        return min(qa.seg_poly_distance(a, b, polygon) for a, b in segments)

    park = layout['park']['polygon']
    park_gap = distance_line(park + park[:1]) - half
    roads = sorted((distance_line(r['points']) - half - r['carriageway_width']/2 - max(r['sidewalk_left'], r['sidewalk_right']), r['id']) for r in layout['roads'])
    buildings = sorted((distance_poly(b['footprint_polygon']) - half, b['id']) for b in layout['buildings'] + layout['campus']['components'])
    modules = {m['id']: distance_poly(m['footprint_polygon']) - half for m in layout['park']['reuse_modules']}
    rests = {m['id']: min(qa.pt_seg((m['x'], m['z']), a, b) for a, b in segments) - half - m['radius'] for m in layout['park']['rest_areas']}
    record('design_fixed_ten_metre_water', design['water_width_m'] == 10, {'water_width_m': design['water_width_m'], 'reason': 'PKE01 existing pedestrian envelope would intersect a 12m water width.'})
    record('design_preserves_buildings_roads_park_modules', roads[0][0] > 0 and buildings[0][0] > 0 and min(modules.values()) > 0 and min(rests.values()) > 0, {'road_min': roads[0], 'building_min': buildings[0], 'modules': modules, 'rest_areas': rests})
    record('design_corridor_inside_park', park_gap > 0 and all(inside(p, park) for p in points), {'minimum_boundary_clearance_m': park_gap, 'curve_length_m': sum(math.dist(a, b) for a, b in segments), 'method': '100 subdivisions per Catmull-Rom span; centerline inside concave polygon and every segment farther than 12m from boundary'})
    wet_edges, affected = [], []
    for edge in layout['pedestrian_edges']:
        d = distance_line(edge['points']) - edge['width']/2
        if d < wet:
            wet_edges.append(edge['id'])
        if d < half:
            affected.append({'edge': edge['id'], 'wet_clearance_m': d - wet, 'corridor_clearance_m': d - half})
    record('design_only_two_existing_water_crossings', sorted(wet_edges) == ['PKE02_S0', 'PKE07_S0'], {'water_crossing_edges': wet_edges, 'affected_bank_edges': affected, 'qualification': 'Bridge and bank approach construction required; this is not a collision-free NPC runtime result.'})
    record('no_exhibition_or_session_coordinates_assigned', design.get('map_version') is None and layout['metadata'].get('map_version') is None, {'map_version': design.get('map_version')})

    if not args.design_only:
        baseline = json.loads((VERIFY / 'city-rebuild-v002-river-baseline.json').read_text(encoding='utf-8'))
        changes = [p for p, digest in baseline['files'].items() if not (ROOT/p).is_file() or sha(ROOT/p) != digest]
        working_scene = SCENE.relative_to(ROOT).as_posix()
        unexpected = [p for p in changes if p != working_scene]
        record('protected_baseline_files', not unexpected, {'checked': len(baseline['files']), 'unexpected': unexpected, 'authorized_scene_change': working_scene in changes})
        text, blocks, names, transforms = scene_blocks(SCENE)
        current_by_name = {name: go for go, name in names.items()}
        backup = Path(baseline['scene_backup'])
        if backup.is_file():
            _, oldblocks, oldnames, oldtransforms = scene_blocks(Path(baseline['scene_backup']))
            wanted = {b['id'] + '_' + (b['name'] if b['id'].startswith('C') else b['type']) for b in layout['buildings'] + layout['campus']['components']}
            original_by_name = {name: go for go, name in oldnames.items()}
            changed_placements = []
            placement_ancestors = set()
            for name in wanted:
                before = oldtransforms[original_by_name[name]][1]
                ancestor = int(re.search(r'm_Father: \{fileID: (-?\d+)\}', before).group(1))
                while ancestor:
                    placement_ancestors.add(ancestor)
                    ancestor = int(re.search(r'm_Father: \{fileID: (-?\d+)\}', oldblocks[ancestor][1]).group(1))
                if name not in current_by_name:
                    changed_placements.append(name + ': missing')
                    continue
                after = transforms[current_by_name[name]][1]
                for key in ['m_LocalRotation', 'm_LocalPosition', 'm_LocalScale', 'm_Father']:
                    pattern = r'^  ' + key + r': (.*)$'
                    if re.search(pattern, before, re.M).group(1) != re.search(pattern, after, re.M).group(1):
                        changed_placements.append(name + ': ' + key)
            for fid in placement_ancestors:
                if fid not in blocks:
                    changed_placements.append('ancestor missing: ' + str(fid))
                    continue
                for key in ['m_LocalRotation', 'm_LocalPosition', 'm_LocalScale', 'm_Father']:
                    pattern = r'^  ' + key + r': (.*)$'
                    if re.search(pattern, oldblocks[fid][1], re.M).group(1) != re.search(pattern, blocks[fid][1], re.M).group(1):
                        changed_placements.append('ancestor ' + str(fid) + ': ' + key)
            record('building_69_transforms_preserved', not changed_placements and len(wanted) == 69, changed_placements)
            # Compare every serialized object below road/intersection roots, excluding root's
            # parent transform; reparenting or deleting a road component cannot silently pass.
            transform_to_go = {fid: go for go, (fid, _) in oldtransforms.items()}
            parent = {fid: int(re.search(r'm_Father: \{fileID: (-?\d+)\}', body).group(1)) for fid, body in oldtransforms.values()}
            roots = {fid for go, (fid, _) in oldtransforms.items() if oldnames.get(go) in ['02_Roads', '03_TurningAndIntersections']}
            road_gos = set()
            for fid, go in transform_to_go.items():
                cursor = fid
                while cursor:
                    if cursor in roots:
                        road_gos.add(go)
                        break
                    cursor = parent.get(cursor, 0)
            changed_roads = []
            for fid, value in oldblocks.items():
                match = re.search(r'm_GameObject: \{fileID: (-?\d+)\}', value[1])
                if (value[0] == 1 and fid in road_gos) or (match and int(match.group(1)) in road_gos):
                    if blocks.get(fid) != value:
                        changed_roads.append(fid)
            record('road_and_intersection_serialization_preserved', not changed_roads, {'objects': len(road_gos), 'changed_component_ids': changed_roads})
        else:
            for check in ('building_69_transforms_preserved', 'road_and_intersection_serialization_preserved'):
                checks.append({'check': check, 'status': 'NOT TESTED', 'evidence': {'missing_historical_scene_backup': str(backup)}})
        ids = set(blocks)
        dangling = sorted({int(m.group(1)) for m in re.finditer(r'\{fileID: (-?\d+)\}', text) if int(m.group(1)) and int(m.group(1)) not in ids})
        record('scene_local_references', not dangling, dangling)
        guid_paths = collections.defaultdict(list)
        for path in (ROOT / 'unity/Assets').rglob('*.meta'):
            match = re.search(r'^guid: ([0-9a-f]{32})$', path.read_text(encoding='utf-8', errors='replace'), re.M)
            if match:
                guid_paths[match.group(1)].append(path.with_suffix(''))
        refs = set(re.findall(r'guid: ([0-9a-f]{32})', text))
        missing = sorted(g for g in refs if g not in guid_paths and not g.startswith('0000000000000000'))
        duplicate = {g: [p.relative_to(ROOT).as_posix() for p in guid_paths[g]] for g in refs if len(guid_paths[g]) > 1}
        record('scene_asset_guids_resolve_uniquely', not missing and not duplicate, {'missing': missing, 'duplicates': duplicate})
        river_names = [name for name in names.values() if 'River' in name or 'RIVER_' in name]
        record('river_scene_objects_present', len(river_names) > 3, river_names)
        surface_reader = module('v002_mesh_triangles', ROOT / 'scripts/unity/check-city-rebuild-v002-surfaces.py')
        desired = {'CityGround': 'Carved_CityGround', 'EastPark_Lawn': 'Carved_EastPark_Lawn',
                   'River_Water_Surface': 'River_Water_Surface', 'River_Excavated_Bed_Banks': 'River_Excavated_Bed_Banks',
                   'River_W_BankTrail': 'River_W_BankTrail', 'River_E_BankTrail': 'River_E_BankTrail',
                   'River_Closed_Bowl_0': 'River_Closed_Bowl_0', 'River_Closed_Bowl_1': 'River_Closed_Bowl_1',
                   'River_Bridge_0_Deck': 'River_Bridge_0_Deck', 'River_Bridge_1_Deck': 'River_Bridge_1_Deck'}
        geometry, mesh_references, issues = {}, {}, []
        for object_name, asset_name in desired.items():
            go = current_by_name.get(object_name)
            path = SCENE.parent / 'river_meshes' / (asset_name + '.asset')
            if go is None or not path.is_file():
                issues.append(object_name + ': missing object or mesh')
                continue
            guid = re.search(r'^guid: ([0-9a-f]{32})$', Path(str(path)+'.meta').read_text(encoding='utf-8'), re.M).group(1)
            components = [(kind, body) for kind, body in blocks.values() if re.search(r'm_GameObject: \{fileID: ' + str(go) + r'\}', body)]
            filters = [body for kind, body in components if kind == 33]
            colliders = [body for kind, body in components if kind == 64]
            if not re.search(r'^  m_IsActive: 1$', blocks[go][1], re.M) or any(not re.search(r'^  m_Enabled: 1$', body, re.M) for body in colliders):
                issues.append(object_name + ': inactive object or disabled collider')
            for body in filters + colliders:
                match = re.search(r'm_Mesh: \{fileID: \d+, guid: ([0-9a-f]+), type: \d+\}', body)
                if not match or match.group(1) != guid:
                    issues.append(object_name + ': renderer/collider has unexpected mesh')
            if len(filters) != 1 or (object_name != 'River_Water_Surface' and len(colliders) != 1) or (object_name == 'River_Water_Surface' and colliders):
                issues.append(object_name + ': unexpected filter/collider count')
            # All generated river surfaces are world-space meshes on identity transforms.
            cursor = transforms[go][0]
            while cursor:
                body = blocks[cursor][1]
                for key, expected in [('m_LocalPosition', (0,0,0)), ('m_LocalScale', (1,1,1)), ('m_LocalRotation', (0,0,0,1))]:
                    match = re.search(r'^  ' + key + r': \{([^}]+)\}', body, re.M)
                    actual = tuple(float(n) for n in re.findall(r': ([-+0-9.eE]+)', match.group(1)))
                    if any(abs(a-b) > 1e-7 for a, b in zip(actual, expected)):
                        issues.append(object_name + ': nonidentity ancestor ' + str(cursor))
                cursor = int(re.search(r'm_Father: \{fileID: (-?\d+)\}', body).group(1))
            _, triangles = surface_reader.triangles(path)
            geometry[object_name] = triangles
            mesh_references[object_name] = {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path), 'triangles': len(triangles)}
        record('carved_meshes_and_water_collision_assignment', not issues and len(geometry) == len(desired), {'issues': issues, 'meshes': mesh_references, 'scope': 'Serialized generated meshes with identity world transform; water has no MeshCollider.'})
        slivers=[]
        for name in ['CityGround','EastPark_Lawn']:
            for index,(a,b,c) in enumerate(geometry.get(name,[])):
                longest=max(math.dist(a,b),math.dist(b,c),math.dist(c,a))
                area2=abs((b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]))
                altitude=area2/max(longest,1e-15)
                if altitude<.0001:slivers.append({'mesh':name,'triangle':index,'longest_edge':longest,'altitude_m':altitude})
        record('carved_collider_has_no_thin_clipping_slivers',not slivers,{'minimum_triangle_altitude_m':.0001,'slivers':slivers,'reason':'Ray tests miss nearly collinear clipping remnants, but a walking capsule can collide with them.'})
        area_meta = (ROOT / 'unity/Assets/Scripts/CityV002RiverArea.cs.meta').read_text(encoding='utf-8')
        area_guid = re.search(r'^guid: ([0-9a-f]+)$', area_meta, re.M).group(1)
        area_body = next(body for kind, body in blocks.values() if kind == 114 and 'guid: '+area_guid in body)
        serialized_line = re.search(r'^  centreline:\n(.*?)(?=^  \w)', area_body, re.M | re.S).group(1)
        actual_line = [(float(x), float(z)) for x, y, z in re.findall(r'\{x: ([-+0-9.eE]+), y: ([-+0-9.eE]+), z: ([-+0-9.eE]+)\}', serialized_line)]
        # Re-run interference checks using the coarser live serialized centerline.
        segments = list(zip(actual_line, actual_line[1:]))
        actual_clearances = {'park_boundary': distance_line(park+park[:1])-half,
                             'roads': min(distance_line(r['points'])-half-r['carriageway_width']/2-max(r['sidewalk_left'],r['sidewalk_right']) for r in layout['roads']),
                             'buildings': min(distance_poly(b['footprint_polygon'])-half for b in layout['buildings']+layout['campus']['components']),
                             'park_modules': {m['id']: distance_poly(m['footprint_polygon'])-half for m in layout['park']['reuse_modules']}}
        record('actual_serialized_curve_clearances', actual_clearances['park_boundary']>0 and actual_clearances['roads']>0 and actual_clearances['buildings']>0 and min(actual_clearances['park_modules'].values())>0,
               actual_clearances)
        profile_errors, retained_ground, sample_count = [], [], 0
        at_grade_errors=[];at_grade_samples=0
        if len(geometry) == len(desired) and actual_line:
            # Span midpoints avoid touching the triangulation seam. Cross-section samples
            # use the live serialized line rather than trusting planned control points.
            for i, (a, b) in enumerate(zip(actual_line, actual_line[1:])):
                length = math.dist(a, b)
                normal = (-(b[1]-a[1])/length, (b[0]-a[0])/length)
                center = ((a[0]+b[0])/2, (a[1]+b[1])/2)
                for offset in [-4, 0, 4]:
                    point = (center[0]+normal[0]*offset, center[1]+normal[1]*offset)
                    sample_count += 1
                    water_heights = height_at(point, geometry['River_Water_Surface'])
                    bed_heights = height_at(point, geometry['River_Excavated_Bed_Banks'])
                    if not water_heights or not bed_heights or min(bed_heights) >= min(water_heights)-.05:
                        profile_errors.append({'segment': i, 'offset': offset, 'water': water_heights, 'bed': bed_heights})
                    for name in ['CityGround', 'EastPark_Lawn']:
                        if height_at(point, geometry[name]):
                            retained_ground.append({'segment': i, 'offset': offset, 'object': name})
                for offset, name in [(10, 'River_W_BankTrail'), (-10, 'River_E_BankTrail')]:
                    point = (center[0]+normal[0]*offset, center[1]+normal[1]*offset)
                    heights = height_at(point, geometry[name])
                    if not heights or not (-.438 <= heights[0] <= .15):
                        profile_errors.append({'segment': i, 'trail': name, 'heights': heights})
                    nearest=min(qa.pt_seg(point,c,d) for e in layout['pedestrian_edges'] if e['kind']=='park_trail' for c,d in zip(e['points'],e['points'][1:]))
                    if nearest<=1.0:
                        at_grade_samples+=1
                        if not heights or abs(heights[0]-.14)>.03:at_grade_errors.append({'segment':i,'trail':name,'height':heights,'existing_trail_distance':nearest})
            cap_samples = 0
            for end, index, neighbor in [(0,0,1),(1,len(actual_line)-1,len(actual_line)-2)]:
                p, q = actual_line[index], actual_line[neighbor]
                length = math.dist(p,q); outward = ((p[0]-q[0])/length,(p[1]-q[1])/length)
                normal = (-outward[1],outward[0])
                for angle in [math.pi*n/8 for n in range(1,8)]:
                    for radius in [2,4]:
                        point = (p[0]+radius*(normal[0]*math.cos(angle)+outward[0]*math.sin(angle)),p[1]+radius*(normal[1]*math.cos(angle)+outward[1]*math.sin(angle)))
                        cap_samples += 1
                        water_heights=height_at(point,geometry['River_Water_Surface'])
                        bed_heights=height_at(point,geometry['River_Closed_Bowl_'+str(end)])
                        if not water_heights or not bed_heights or min(bed_heights)>=min(water_heights)-.05:
                            profile_errors.append({'cap':end,'point':point,'water':water_heights,'bed':bed_heights})
                        for name in ['CityGround','EastPark_Lawn']:
                            if height_at(point,geometry[name]): retained_ground.append({'cap':end,'point':point,'object':name})
            slopes=[]
            for name in ['River_W_BankTrail','River_E_BankTrail']:
                for a,b,c in geometry[name]:
                    u=[b[j]-a[j] for j in range(3)];v=[c[j]-a[j] for j in range(3)]
                    nx,ny,nz=u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]
                    if abs(ny)<1e-8: continue  # Vertical retaining sides are not walk surfaces.
                    slopes.append(math.hypot(nx,nz)/abs(ny))
            record('actual_bank_walkable_surface_grade', bool(slopes) and max(slopes)<=.06, {'maximum_grade': max(slopes) if slopes else None,'limit':.06,'surface_height_range_m':[-.428,.14],'reason':'Reported grading revision: raised at existing walk/deck crossings with 12m transition. Vertical retaining faces excluded.'})
            record('bank_trails_meet_existing_walks_at_grade',at_grade_samples>0 and not at_grade_errors,{'samples':at_grade_samples,'expected_crossing_y':.14,'tolerance_m':.03,'errors':at_grade_errors})
            record('actual_triangles_distinguish_bed_water_and_trails', not profile_errors, {'cross_section_water_samples': sample_count, 'endcap_water_samples':cap_samples, 'segments': len(actual_line)-1, 'errors': profile_errors[:30], 'water_y': -1.2, 'bed_center_y': -2, 'trail_y_range': [-.428,.14]})
            record('no_old_ground_or_lawn_under_water', not retained_ground, {'samples': (sample_count+cap_samples)*2, 'retained_ground_hits': retained_ground[:30], 'qualification': 'Actual serialized visual and collision meshes agree; sampled interior water strip and both rounded endcaps.'})
            graph_guid=re.search(r'^guid: ([0-9a-f]+)$',(ROOT/'unity/Assets/Scripts/CityV002PedestrianGraph.cs.meta').read_text(encoding='utf-8'),re.M).group(1)
            graph_body=next(body for kind,body in blocks.values() if kind==114 and 'guid: '+graph_guid in body)
            edges_part=graph_body.split('  edges:\n',1)[1]
            edge_blocks=re.split(r'^  - id: ',edges_part,flags=re.M)[1:]
            serialized_edges={body.split('\n')[0]:[tuple(map(float,v)) for v in re.findall(r'\{x: ([-+0-9.eE]+), y: ([-+0-9.eE]+), z: ([-+0-9.eE]+)\}',body)] for body in edge_blocks}
            graph_changes=[]
            for edge in layout['pedestrian_edges']:
                live=serialized_edges.get(edge['id'],[])
                if len(live)!=len(edge['points']) or any(math.dist((v[0],v[2]),p)>.001 for v,p in zip(live,edge['points'])):
                    graph_changes.append(edge['id'])
            record('original_409_graph_paths_preserved',not graph_changes,{'source_edges':len(layout['pedestrian_edges']),'live_edges':len(serialized_edges),'changed_or_missing':graph_changes,'scope':'Existing path IDs and ordered XZ polyline points, including both original bridge-crossing paths.'})
            wet_failures=[];bridge_support_failures=[];graph_samples=wet_samples=0
            buried_ramps=[];ramp_samples=0
            for edge_body in edge_blocks:
                edge_id=edge_body.split('\n')[0]
                edge_points=[tuple(map(float,v)) for v in re.findall(r'\{x: ([-+0-9.eE]+), y: ([-+0-9.eE]+), z: ([-+0-9.eE]+)\}',edge_body)]
                for a,b in zip(edge_points,edge_points[1:]):
                    if max(a[0],b[0])<100 or min(a[0],b[0])>151 or max(a[2],b[2])<-30 or min(a[2],b[2])>173:continue
                    count=max(1,math.ceil(math.dist(a,b)/.3))
                    for k in range(count+1):
                        point=tuple(a[j]+(b[j]-a[j])*k/count for j in range(3));xz=(point[0],point[2]);graph_samples+=1
                        if edge_id.startswith('RIVER_RAMP_'):
                            run=math.hypot(b[0]-a[0],b[2]-a[2]);normal=(-(b[2]-a[2])/run,(b[0]-a[0])/run)
                            for offset in [-1,0,1]:
                                rp=(xz[0]+normal[0]*offset,xz[1]+normal[1]*offset);ramp_samples+=1
                                for name in ['CityGround','EastPark_Lawn','River_Excavated_Bed_Banks']:
                                    heights=height_at(rp,geometry[name])
                                    if heights and max(heights)>point[1]-.02+.06:buried_ramps.append({'edge':edge_id,'point':rp,'expected_surface_y':point[1]-.02,'terrain':name,'terrain_height':max(heights)})
                        distance=min(qa.pt_seg(xz,c,d) for c,d in segments)
                        if distance>=wet+.35:continue
                        wet_samples+=1
                        allowed=[]
                        for index,bridge in enumerate(design['bridges']):
                            c,d=bridge['endpoints'];length=math.dist(c,d);direction=((d[0]-c[0])/length,(d[1]-c[1])/length);q=(xz[0]-c[0],xz[1]-c[1]);along=q[0]*direction[0]+q[1]*direction[1];across=abs(-q[0]*direction[1]+q[1]*direction[0])
                            if -.35<=along<=length+.35 and across<=1.5-.35 and abs(point[1]-.16)<=.1:
                                allowed.append(index)
                        if not allowed:
                            wet_failures.append({'edge':edge_id,'point':point})
                        elif not any(any(abs(h-(point[1]-.02))<.06 for h in height_at(xz,geometry['River_Bridge_'+str(i)+'_Deck'])) for i in allowed):
                            bridge_support_failures.append({'edge':edge_id,'point':point})
            record('actual_graph_wet_crossings_have_supported_bridges',not wet_failures and not bridge_support_failures and wet_samples>0,{'graph_samples_near_river':graph_samples,'wet_crossing_samples':wet_samples,'npc_radius_m':.35,'sample_spacing_m':.3,'wet_failures':wet_failures[:20],'missing_bridge_support':bridge_support_failures[:20],'scope':'Serialized route centerlines expanded by NPC radius; actual deck mesh height required. Not a Play Mode trajectory or full path-width test.'})
            record('bridge_ramp_width_not_buried_in_terrain',ramp_samples>0 and not buried_ramps,{'samples':ramp_samples,'sample_offsets_m':[-1,0,1],'buried_points':buried_ramps[:30],'scope':'Actual graph height versus generated ground/lawn/bed triangles; <=.3m along ramps and 0/+-1m lateral samples.'})

    result = {'scope': 'Independent sampled plan geometry and serialized artifact review only; no Unity physics/runtime or exhibition approval.', 'scene_sha256': sha(SCENE), 'design_sha256': sha(PLAN/'river-design.json'), 'checks': checks, 'status': 'FAIL' if any(c['status'] == 'FAIL' for c in checks) else ('NOT TESTED' if any(c['status'] == 'NOT TESTED' for c in checks) else 'PASS_STATIC_ONLY')}
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'status': result['status'], 'checks': [{k: c[k] for k in ['check', 'status']} for c in checks]}, indent=2))
    return int(result['status'] in ('FAIL', 'NOT TESTED'))


if __name__ == '__main__':
    raise SystemExit(main())
