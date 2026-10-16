#!/usr/bin/env python3
"""Independent Phase 1–3 checks. Static evidence never proves Unity execution."""
import argparse
import csv
import hashlib
import importlib.util
import itertools
import json
from pathlib import Path
import re
import sys

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[2]
PLAN = ROOT / 'docs/planning/city_rebuild_v002'
VERIFY = ROOT / 'docs/verification'


def sha(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--scene', type=Path)
    parser.add_argument('--output', type=Path, default=VERIFY / 'city-rebuild-v002-static-results.json')
    args = parser.parse_args()
    checks = []

    def record(name, passed, evidence):
        checks.append({'check': name, 'status': 'PASS' if passed else 'FAIL', 'evidence': evidence})

    baseline = json.loads((VERIFY / 'city-rebuild-v002-protected-baseline.json').read_text(encoding='utf-8'))
    documented_exceptions = {
        'docs/planning/city_rebuild_v002/README.md': 'Coordinator recorded user approval and implementation start; design JSON/CSV remain protected.',
        'assets/catalog/README.md': 'Coordinator documented the new v002 scene usage; asset sources and approval states remain protected.'
    }
    protected = [f for f in baseline['files'] if '__pycache__' not in Path(f['path']).parts]
    changed = [f['path'] for f in protected
               if not (ROOT / f['path']).is_file() or sha(ROOT / f['path']) != f['sha256']]
    unexpected = [path for path in changed if path not in documented_exceptions]
    record('protected_existing_files', not unexpected, {'count': len(protected), 'excluded_generated_cache_files': len(baseline['files']) - len(protected), 'unexpected_changes': unexpected,
           'documented_changes': {path: documented_exceptions[path] for path in changed if path in documented_exceptions}})
    layout_path = PLAN / 'layout.json'
    layout = json.loads(layout_path.read_text(encoding='utf-8'))
    record('approved_layout_hash', sha(layout_path) == '3e98ea485bd92dc9c2528d0420b5999a0336f700270c0f73f7630aa214fbd105', sha(layout_path))
    spec = importlib.util.spec_from_file_location('v002_design_qa', PLAN / 'qa-check.py')
    design = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(design)
    buildings = layout['buildings'] + layout['campus']['components']
    record('approved_building_counts', len(layout['buildings']) == 55 and len(layout['campus']['components']) == 14,
           {'external': len(layout['buildings']), 'campus': len(layout['campus']['components'])})
    errors = []
    for filename, group in [('buildings.csv', layout['buildings']), ('campus-placements.csv', layout['campus']['components'])]:
        rows = list(csv.DictReader((PLAN / filename).open(encoding='utf-8', newline='')))
        indexed = {row['id']: row for row in rows}
        if len(rows) != len(group) or set(indexed) != {b['id'] for b in group}:
            errors.append(filename + ': IDs/count')
        for building in group:
            row = indexed.get(building['id'], {})
            for key in ['x', 'z', 'yaw', 'width', 'depth', 'height']:
                if key not in row or abs(float(row[key]) - building[key]) > 0.00001:
                    errors.append(f'{filename}:{building["id"]}:{key}')
    record('csv_matches_layout', not errors, errors)
    polygons = {b['id']: design.rect((b['x'], b['z']), b['width'], b['depth'], b['yaw']) for b in buildings}
    collisions = [[a['id'], b['id']] for a, b in itertools.combinations(buildings, 2)
                  if design.overlap(polygons[a['id']], polygons[b['id']])]
    record('design_envelope_collision', not collisions, collisions)
    assets = sorted({b['asset'] for b in layout['buildings']} | {layout['campus']['asset']})
    missing = [path for path in assets if not (ROOT / path).is_file() or not (ROOT / (path + '.meta')).is_file()]
    record('source_fbx_and_meta_present', not missing, {'unique_fbx': len(assets), 'missing': missing})
    record('event_contract_unchanged_in_layout', layout['metadata']['map_version'] is None and
           layout['metadata']['npc_max_event_wait_seconds'] == 90 and not layout['metadata']['event_logic_changed'],
           {'map_version': layout['metadata']['map_version'], 'max_wait_seconds': layout['metadata']['npc_max_event_wait_seconds']})

    scenes = list((ROOT / 'unity/Assets/SIMUS/Scenes').rglob('CityRebuild_v002.unity'))
    scene = args.scene.resolve() if args.scene else (scenes[0] if len(scenes) == 1 else None)
    if not scene or not scene.is_file():
        checks.append({'check': 'serialized_unity_scene', 'status': 'NOT TESTED', 'evidence': 'No generated CityRebuild_v002.unity found'})
    else:
        text = scene.read_text(encoding='utf-8')
        blocks = re.findall(r'^--- !u!(\d+) &(-?\d+)(?: stripped)?\n(.*?)(?=^--- !u!|\Z)', text, re.M | re.S)
        ids = [int(block[1]) for block in blocks]
        record('unique_local_file_ids', bool(ids) and len(ids) == len(set(ids)), {'count': len(ids)})
        names = re.findall(r'^  m_Name: (.*)$', text, re.M)
        decoded_names = [json.loads(name) if name.startswith('"') else name for name in names]
        expected_names = {b['id'] + '_' + (b['name'] if b['id'].startswith('C') else b['type']): b['id'] for b in buildings}
        placed_ids = [expected_names[name] for name in decoded_names if name in expected_names]
        record('serialized_building_wrapper_ids', len(placed_ids) == 69 and set(placed_ids) == set(polygons),
               {'count': len(placed_ids), 'missing': sorted(set(polygons) - set(placed_ids))})
        facilities = [name for name in names if name.startswith('XC_')]
        record('serialized_crossing_facility_roots', len(facilities) == 17, {'count': len(facilities)})
        dangling = sorted({int(m.group(1)) for m in re.finditer(r'\{fileID: (-?\d+)\}', text)
                           if int(m.group(1)) != 0 and int(m.group(1)) not in ids})
        record('local_file_ids_resolve', not dangling, dangling)
        guid_paths = {}
        for meta in (ROOT / 'unity/Assets').rglob('*.meta'):
            match = re.search(r'^guid: ([0-9a-f]{32})$', meta.read_text(encoding='utf-8', errors='replace'), re.M)
            if match:
                guid_paths.setdefault(match.group(1), []).append(meta.relative_to(ROOT).as_posix()[:-5])
        references = set(re.findall(r'guid: ([0-9a-f]{32})', text))
        unresolved = sorted(guid for guid in references if guid not in guid_paths and not guid.startswith('0000000000000000'))
        duplicates = {guid: guid_paths[guid] for guid in references if len(guid_paths.get(guid, [])) > 1}
        record('external_scene_guids_resolve', not unresolved and not duplicates, {'missing': unresolved, 'duplicate_guid_paths': duplicates})
        fbx_refs = sorted({path for guid in references for path in guid_paths.get(guid, []) if path.lower().endswith('.fbx')})
        record('scene_references_actual_fbx', bool(fbx_refs), fbx_refs)
        record('new_scene_has_meta', Path(str(scene) + '.meta').is_file(), scene.relative_to(ROOT).as_posix())

        evidence_path = VERIFY / 'city-rebuild-v002-unity-results.json'
        if evidence_path.is_file():
            evidence = json.loads(evidence_path.read_text(encoding='utf-8'))
            record('unity_evidence_matches_layout', evidence.get('layout_sha256') == sha(layout_path), evidence.get('layout_sha256'))
            record('unity_evidence_matches_saved_scene', evidence.get('scene_sha256') == sha(scene),
                   {'reported': evidence.get('scene_sha256'), 'actual': sha(scene)})
            script_hash = sha(ROOT / 'unity/Assets/Editor/CityRebuildV002Setup.cs')
            record('unity_evidence_matches_generator', evidence.get('script_sha256') == script_hash,
                   {'reported': evidence.get('script_sha256'), 'actual': script_hash})
            instances = evidence.get('instances', [])
            by_id = {i['id']: i for i in instances}
            record('unity_report_instance_ids', len(instances) == 69 and set(by_id) == set(polygons),
                   {'count': len(instances), 'missing': sorted(set(polygons) - set(by_id)), 'unexpected': sorted(set(by_id) - set(polygons))})
            errors = []
            actual_polys = {}
            measurements = json.loads((PLAN / 'asset_measurements.json').read_text(encoding='utf-8'))
            campus_measurements = {b['id']: b for b in measurements['campus']['components']}
            for b in buildings:
                inst = by_id.get(b['id'])
                if not inst:
                    continue
                expected_asset = b.get('asset', layout['campus']['asset'])
                if 'unity/' + inst['asset'] != expected_asset:
                    errors.append([b['id'], 'wrong source FBX'])
                source_guid = re.search(r'^guid: (\w+)$', (ROOT / (expected_asset + '.meta')).read_text(encoding='utf-8'), re.M).group(1)
                if inst['asset_guid'] != source_guid:
                    errors.append([b['id'], 'wrong source GUID'])
                bounds = inst['world_bounds']
                lo, hi = bounds['min'], bounds['max']
                poly = polygons[b['id']]
                target = [min(v[0] for v in poly), max(v[0] for v in poly), min(v[1] for v in poly), max(v[1] for v in poly)]
                if max(abs(a-c) for a, c in zip([lo[0], hi[0], lo[2], hi[2]], target)) > .025:
                    errors.append([b['id'], 'world XZ differs from approved envelope'])
                expected_y = campus_measurements[b['id']]['bounds_blender_xyz']['min'][2] - .18 if b['id'].startswith('C') else 0
                if abs(lo[1] - expected_y) > .025 or abs(hi[1] - lo[1] - b['height']) > .025:
                    errors.append([b['id'], 'world Y or height differs', lo[1], expected_y])
                if b['id'].startswith('B') and (max(abs(a-c) for a,c in zip(inst['root_position'], [b['x'], 0, b['z']])) > .025 or
                                               abs((inst['root_yaw'] - b['yaw'] + 180) % 360 - 180) > .001):
                    errors.append([b['id'], 'placement root differs from CSV'])
                actual_polys[b['id']] = [(lo[0], lo[2]), (hi[0], lo[2]), (hi[0], hi[2]), (lo[0], hi[2])]
            record('unity_report_fbx_provenance_and_bounds', not errors, errors)
            hits = [[a,b] for a,b in itertools.combinations(actual_polys, 2) if design.overlap(actual_polys[a], actual_polys[b])]
            record('unity_report_world_envelope_collision', not hits, hits)
        else:
            checks.append({'check': 'unity_execution_evidence', 'status': 'NOT TESTED', 'evidence': 'No Unity execution results JSON'})

    result = {'scope': 'Phase1-3 independent static QA. Does not establish Unity compile/load/Play Mode, actual imported bounds, mesh collision, NPC, camera or performance success.',
              'layout_sha256': sha(layout_path), 'checks': checks,
              'status': 'FAIL' if any(c['status'] == 'FAIL' for c in checks) else 'PASS_STATIC_ONLY'}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'status': result['status'], 'checks': [{k: c[k] for k in ('check', 'status')} for c in checks]}, ensure_ascii=False, indent=2))
    return int(result['status'] == 'FAIL')


if __name__ == '__main__':
    sys.exit(main())
