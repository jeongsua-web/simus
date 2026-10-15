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
    text = path.read_text()
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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--design-only', action='store_true')
    parser.add_argument('--output', type=Path, default=VERIFY / 'city-rebuild-v002-river-static-results.json')
    args = parser.parse_args()
    checks = []

    def record(name, passed, evidence):
        checks.append({'check': name, 'status': 'PASS' if passed else 'FAIL', 'evidence': evidence})

    qa = module('v002_geometry', PLAN / 'qa-check.py')
    layout = json.loads((PLAN / 'layout.json').read_text())
    design = json.loads((PLAN / 'river-design.json').read_text())
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
        baseline = json.loads((VERIFY / 'city-rebuild-v002-river-baseline.json').read_text())
        changes = [p for p, digest in baseline['files'].items() if not (ROOT/p).is_file() or sha(ROOT/p) != digest]
        working_scene = str(SCENE.relative_to(ROOT))
        unexpected = [p for p in changes if p != working_scene]
        record('protected_baseline_files', not unexpected, {'checked': len(baseline['files']), 'unexpected': unexpected, 'authorized_scene_change': working_scene in changes})
        text, blocks, names, transforms = scene_blocks(SCENE)
        _, oldblocks, oldnames, oldtransforms = scene_blocks(Path(baseline['scene_backup']))
        wanted = {b['id'] + '_' + (b['name'] if b['id'].startswith('C') else b['type']) for b in layout['buildings'] + layout['campus']['components']}
        current_by_name = {name: go for go, name in names.items()}
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
        ids = set(blocks)
        dangling = sorted({int(m.group(1)) for m in re.finditer(r'\{fileID: (-?\d+)\}', text) if int(m.group(1)) and int(m.group(1)) not in ids})
        record('scene_local_references', not dangling, dangling)
        guid_paths = collections.defaultdict(list)
        for path in (ROOT / 'unity/Assets').rglob('*.meta'):
            match = re.search(r'^guid: ([0-9a-f]{32})$', path.read_text(errors='replace'), re.M)
            if match:
                guid_paths[match.group(1)].append(path.with_suffix(''))
        refs = set(re.findall(r'guid: ([0-9a-f]{32})', text))
        missing = sorted(g for g in refs if g not in guid_paths and not g.startswith('0000000000000000'))
        duplicate = {g: [str(p.relative_to(ROOT)) for p in guid_paths[g]] for g in refs if len(guid_paths[g]) > 1}
        record('scene_asset_guids_resolve_uniquely', not missing and not duplicate, {'missing': missing, 'duplicates': duplicate})
        river_names = [name for name in names.values() if 'River' in name or 'RIVER_' in name]
        record('river_scene_objects_present', len(river_names) > 3, river_names)

    result = {'scope': 'Independent sampled plan geometry and serialized artifact review only; no Unity physics/runtime or exhibition approval.', 'scene_sha256': sha(SCENE), 'design_sha256': sha(PLAN/'river-design.json'), 'checks': checks, 'status': 'FAIL' if any(c['status'] == 'FAIL' for c in checks) else 'PASS_STATIC_ONLY'}
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'status': result['status'], 'checks': [{k: c[k] for k in ['check', 'status']} for c in checks]}, indent=2))
    return int(result['status'] == 'FAIL')


if __name__ == '__main__':
    raise SystemExit(main())
