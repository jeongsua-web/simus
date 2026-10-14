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

    baseline = json.loads((VERIFY / 'city-rebuild-v002-protected-baseline.json').read_text())
    changed = [f['path'] for f in baseline['files']
               if not (ROOT / f['path']).is_file() or sha(ROOT / f['path']) != f['sha256']]
    record('protected_existing_files', not changed, {'count': len(baseline['files']), 'changed': changed})
    layout_path = PLAN / 'layout.json'
    layout = json.loads(layout_path.read_text())
    record('approved_layout_hash', sha(layout_path) == '3e98ea485bd92dc9c2528d0420b5999a0336f700270c0f73f7630aa214fbd105', sha(layout_path))
    spec = importlib.util.spec_from_file_location('v002_design_qa', PLAN / 'qa-check.py')
    design = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(design)
    buildings = layout['buildings'] + layout['campus']['components']
    record('approved_building_counts', len(layout['buildings']) == 55 and len(layout['campus']['components']) == 14,
           {'external': len(layout['buildings']), 'campus': len(layout['campus']['components'])})
    errors = []
    for filename, group in [('buildings.csv', layout['buildings']), ('campus-placements.csv', layout['campus']['components'])]:
        rows = list(csv.DictReader((PLAN / filename).open(newline='')))
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
    scene = args.scene or (scenes[0] if len(scenes) == 1 else None)
    if not scene or not scene.is_file():
        checks.append({'check': 'serialized_unity_scene', 'status': 'NOT TESTED', 'evidence': 'No generated CityRebuild_v002.unity found'})
    else:
        text = scene.read_text()
        blocks = re.findall(r'^--- !u!(\d+) &(-?\d+)(?: stripped)?\n(.*?)(?=^--- !u!|\Z)', text, re.M | re.S)
        ids = [int(block[1]) for block in blocks]
        record('unique_local_file_ids', bool(ids) and len(ids) == len(set(ids)), {'count': len(ids)})
        dangling = sorted({int(m.group(1)) for m in re.finditer(r'\{fileID: (-?\d+)\}', text)
                           if int(m.group(1)) != 0 and int(m.group(1)) not in ids})
        record('local_file_ids_resolve', not dangling, dangling)
        guid_paths = {}
        for meta in (ROOT / 'unity/Assets').rglob('*.meta'):
            match = re.search(r'^guid: ([0-9a-f]{32})$', meta.read_text(errors='replace'), re.M)
            if match:
                guid_paths.setdefault(match.group(1), []).append(str(meta.relative_to(ROOT))[:-5])
        references = set(re.findall(r'guid: ([0-9a-f]{32})', text))
        unresolved = sorted(guid for guid in references if guid not in guid_paths and not guid.startswith('0000000000000000'))
        duplicates = {guid: guid_paths[guid] for guid in references if len(guid_paths.get(guid, [])) > 1}
        record('external_scene_guids_resolve', not unresolved and not duplicates, {'missing': unresolved, 'duplicate_guid_paths': duplicates})
        fbx_refs = sorted({path for guid in references for path in guid_paths.get(guid, []) if path.lower().endswith('.fbx')})
        record('scene_references_actual_fbx', bool(fbx_refs), fbx_refs)
        record('new_scene_has_meta', Path(str(scene) + '.meta').is_file(), str(scene.relative_to(ROOT)))

    result = {'scope': 'Phase1-3 independent static QA. Does not establish Unity compile/load/Play Mode, actual imported bounds, mesh collision, NPC, camera or performance success.',
              'layout_sha256': sha(layout_path), 'checks': checks,
              'status': 'FAIL' if any(c['status'] == 'FAIL' for c in checks) else 'PASS_STATIC_ONLY'}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'status': result['status'], 'checks': [{k: c[k] for k in ('check', 'status')} for c in checks]}, ensure_ascii=False, indent=2))
    return int(result['status'] == 'FAIL')


if __name__ == '__main__':
    sys.exit(main())
