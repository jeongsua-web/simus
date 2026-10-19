#!/usr/bin/env python3
"""Independent Phase8 A/B protection audit. Does not launch Unity or infer visual PASS."""
import argparse
import collections
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
VERIFY = ROOT / 'docs/verification'
SCENE = 'unity/Assets/SIMUS/Scenes/city_rebuild_v002/CityRebuild_v002.unity'
CAMERA_GUID = 'c23ae79a8389140a89904cfbd55a0288'
WATER_GUID = '813fea007767b420b963f164ec7e9606'


def sha(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def blocks(text):
    return {int(fid): (int(kind), body) for kind, fid, body in
            re.findall(r'^--- !u!(\d+) &(-?\d+)(?: stripped)?\n(.*?)(?=^--- !u!|\Z)', text, re.M | re.S)}


def field(body, name):
    match = re.search(r'^  ' + re.escape(name) + r':(.*?)(?=^  [A-Za-z_]|\Z)', body, re.M | re.S)
    return match.group(0) if match else ''


def without(body, name):
    return body.replace(field(body, name), '')


def without_prefab_material_overrides(body):
    """Ignore only material-slot object references, never prefab transforms/meshes/size overrides."""
    def keep(entry):
        text = entry.group(0)
        return '' if re.search(r"^      propertyPath: '?m_Materials\.Array\.data\[\d+\]'?$", text, re.M) else text
    return re.sub(r'^    - target:.*?(?=^    - target:|^    m_|\Z)', keep, body, flags=re.M | re.S)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=VERIFY/'city-rebuild-v002-phase8-protection-results.json')
    parser.add_argument('--runtime', action='store_true', help='Review fresh Phase8 evidence and retain all original 21 regression categories; never launches Unity.')
    args = parser.parse_args()
    baseline = json.loads((VERIFY/'city-rebuild-v002-phase8-baseline.json').read_text())
    checks = []

    def record(name, passed, evidence):
        checks.append({'check': name, 'status': 'PASS' if passed else 'FAIL', 'evidence': evidence})

    allowed = {SCENE: 'Working scene visual additions and camera settings; object audit below',
               'unity/Assets/Scripts/CityPreviewCamera.cs': 'Authorized camera changes; independent source review required',
               'unity/Assets/Scripts/NpcOcclusionReveal.cs': 'Authorized occlusion changes; independent source review required',
               'unity/Assets/Shaders/NpcReveal.shader': 'Authorized opt-in occluder context fade; default visibility 1; independently reviewed',
               'assets/catalog/README.md': 'Catalog documentation',
               'assets/manifest.csv': 'New assets only; approval/source entries reviewed separately'}
    changed = [x['path'] for x in baseline['files'] if not (ROOT/x['path']).is_file() or sha(ROOT/x['path']) != x['sha256']]
    unexpected = [p for p in changed if p not in allowed]
    record('protected_file_hashes', not unexpected, {'files': len(baseline['files']), 'unexpected_changes': unexpected,
           'authorized_changes_requiring_review': {p: allowed[p] for p in changed if p in allowed}})
    before = blocks((VERIFY/'city-rebuild-v002-phase8-baseline/CityRebuild_v002.unity').read_text())
    after = blocks((ROOT/SCENE).read_text())
    camera_components = {fid for fid, (_, body) in before.items() if CAMERA_GUID in body}
    camera_gos = {int(re.search(r'm_GameObject: \{fileID: (-?\d+)\}', before[fid][1]).group(1)) for fid in camera_components}
    camera_ids = set(camera_gos) | camera_components
    for fid, (kind, body) in before.items():
        go = re.search(r'm_GameObject: \{fileID: (-?\d+)\}', body)
        if kind in (4, 20) and go and int(go.group(1)) in camera_gos:
            camera_ids.add(fid)
    removed = sorted(set(before) - set(after))
    record('existing_scene_objects_not_deleted', not removed, {'before_objects': len(before), 'removed': removed})
    violations, material_changes, appended_children, camera_changes, water_palette_changes = [], [], [], [], []
    for fid, (kind, old) in before.items():
        if fid not in after or after[fid] == before[fid]:
            continue
        current_kind, new = after[fid]
        if current_kind != kind:
            violations.append({'id': fid, 'kind': kind, 'reason': 'class changed'})
        elif fid in camera_ids:
            camera_changes.append({'id': fid, 'kind': kind})
        elif kind == 23 and without(old, 'm_Materials') == without(new, 'm_Materials'):
            material_changes.append(fid)
        elif kind == 1001 and without_prefab_material_overrides(old) == without_prefab_material_overrides(new):
            material_changes.append(fid)
        elif kind == 114 and WATER_GUID in old and without(without(old, 'cleanColor'), 'pollutedColor') == without(without(new, 'cleanColor'), 'pollutedColor'):
            expected = {'cleanColor': (0x55/255, 0xA9/255, 0xB4/255, 1),
                        'pollutedColor': (0x77/255, 0x7B/255, 0x43/255, 1)}
            valid = True
            for key, target in expected.items():
                values = re.findall(r'[rgba]: ([\d.eE+-]+)', field(new, key))
                valid = valid and len(values) == 4 and all(abs(float(a)-b) < .000001 for a, b in zip(values, target))
            if valid:
                water_palette_changes.append(fid)
            else:
                violations.append({'id': fid, 'kind': kind, 'reason': 'water palette differs from reviewed #55A9B4/#777B43 endpoints'})
        elif kind == 4 and without(old, 'm_Children') == without(new, 'm_Children'):
            old_children = re.findall(r'fileID: (-?\d+)', field(old, 'm_Children'))
            new_children = re.findall(r'fileID: (-?\d+)', field(new, 'm_Children'))
            if [x for x in new_children if x in old_children] == old_children and all(int(x) not in before for x in new_children if x not in old_children):
                appended_children.append(fid)
            else:
                violations.append({'id': fid, 'kind': kind, 'reason': 'existing child removed, moved or reordered'})
        elif kind == 1660057539:
            old_roots = re.findall(r'fileID: (-?\d+)', old)
            new_roots = re.findall(r'fileID: (-?\d+)', new)
            if [x for x in new_roots if x in old_roots] != old_roots:
                violations.append({'id': fid, 'kind': kind, 'reason': 'existing scene roots changed'})
        else:
            violations.append({'id': fid, 'kind': kind, 'reason': 'existing serialized component changed'})
    record('existing_geometry_colliders_npc_graph_and_events_preserved', not violations,
           {'violations': violations, 'material_swaps': material_changes, 'added_child_containers': appended_children,
            'camera_changes_require_review': camera_changes, 'water_endpoint_palette_only': water_palette_changes,
            'scope': 'Exact existing component bytes except renderer material list, camera, and appending new child/root objects. Includes building transforms, mesh references, existing colliders, graph, NPC/river/event serialized state.'})
    new_blocks = {fid: value for fid, value in after.items() if fid not in before}
    new_colliders = [{'id': fid, 'kind': kind} for fid, (kind, _) in new_blocks.items() if kind in {56, 64, 65, 135, 136, 143, 154}]
    record('new_visual_objects_add_no_colliders', not new_colliders, {'new_objects': len(new_blocks), 'new_colliders': new_colliders})
    environment_kinds = {29, 104, 108, 157, 196}
    environment_changes = [fid for fid, (kind, _) in before.items() if kind in environment_kinds and before[fid] != after.get(fid)]
    new_environment = [fid for fid, (kind, _) in new_blocks.items() if kind in environment_kinds]
    record('phase8c_lighting_environment_untouched', not environment_changes and not new_environment,
           {'changed_existing': environment_changes, 'added': new_environment})
    record('approved_layout_hash_immutable', sha(ROOT/'docs/planning/city_rebuild_v002/layout.json') ==
           '3e98ea485bd92dc9c2528d0420b5999a0336f700270c0f73f7630aa214fbd105', 'Approved v002 design; no prototype coordinate substitution')
    result = {'scope': __doc__, 'scene_sha256': sha(ROOT/SCENE), 'checks': checks,
              'status': 'FAIL' if any(x['status'] == 'FAIL' for x in checks) else 'PASS_STATIC_PROTECTION_ONLY'}
    if args.runtime:
        review_runtime(result)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({'status': result['status'], 'checks': [{'check': c['check'], 'status': c['status']} for c in checks]}, indent=2))
    return int(result['status'] == 'FAIL')


def review_runtime(result):
    # Leave the legacy checker unchanged and preserve its honest stale-evidence FAILs.
    legacy_output = VERIFY/'city-rebuild-v002-phase8-legacy-regression.json'
    run = subprocess.run([sys.executable, str(ROOT/'scripts/unity/check-city-rebuild-v002-phase47.py'),
                          '--runtime', '--output', str(legacy_output)], cwd=ROOT, capture_output=True, text=True)
    legacy = json.loads(legacy_output.read_text())
    regression = [dict(row) for row in legacy['checks']]
    by_name = {row['check']: row for row in regression}
    protection = {row['check']: row['status'] == 'PASS' for row in result['checks']}

    def replace(name, passed, evidence, status=None):
        by_name[name].update(status=status or ('PASS' if passed else 'FAIL'), evidence=evidence)

    def read(name):
        path = VERIFY/('city-rebuild-v002-phase8-'+name+'.json')
        return json.loads(path.read_text()) if path.is_file() else {}

    audit, physics = read('building-audit'), read('physics')
    runtime, navigation, inputs = read('after-runtime'), read('navigation-runtime'), read('after-inputs-after')
    scene_sha = result['scene_sha256']
    audit_rows = audit.get('buildings', [])
    layout = json.loads((ROOT/'docs/planning/city_rebuild_v002/layout.json').read_text())
    expected_assets = {b['id']: b.get('asset', layout['campus']['asset']).removeprefix('unity/')
                       for b in layout['buildings'] + layout['campus']['components']}
    audit_pass = audit.get('status') == 'PASS' and audit.get('scene_sha256') == scene_sha and len(audit_rows) == 69 and {b.get('id') for b in audit_rows} == set(expected_assets) and all(
        b.get('status') == 'PASS' and b.get('maximum_envelope_error_m', float('inf')) <= .025 and b.get('mesh_count', 0) > 0 and expected_assets.get(b.get('id')) in b.get('actual_fbx_mesh_paths', []) for b in audit_rows)
    protected = protection['protected_file_hashes'] and protection['existing_scene_objects_not_deleted'] and protection['existing_geometry_colliders_npc_graph_and_events_preserved']
    replace('phase47_protected_baseline', protected, {'replacement': 'Strict Phase8 pre-edit 5886-file baseline and serialized object audit; only reviewed A/B material/camera fields excepted', 'protection': result['checks']})
    replace('building_hierarchies_preserved_except_four_verified_layout_repairs', protected and audit_pass,
            {'replacement': 'Phase8 exact existing serialized components except material refs + current actual FBX envelopes. No Phase8 transform repair exception.', 'audit_scene_sha256': audit.get('scene_sha256')})
    replace('current_unity_69_fbx_envelopes_match_approved_layout', audit_pass, audit)
    replace('runtime_evidence_files_present', bool(runtime and navigation and inputs and physics),
            {'scope': 'Fresh Phase8 runtime/navigation/input/physics evidence, not preserved Phase7 files'})
    graph, depth = physics.get('graph', {}), physics.get('river_depth', {})
    physical_pass = physics.get('scene_sha256') == scene_sha and graph.get('nodes') == 572 and graph.get('edges') == 597 and graph.get('samples', 0) > 0 and graph.get('unsupported') == 0 and graph.get('finite_width_samples', 0) > 0 and graph.get('capsule_blocked') == 0 and graph.get('actual_physical_bridge_hits', 0) > 0 and graph.get('wet_violations') == 0 and depth.get('axis_samples', 0) > 0 and depth.get('old_flat_ground_hits_beneath_water') == 0 and depth.get('missing_bed_hits') == 0
    replace('current_scene_complete_graph_physics_support', physical_pass, physics)
    changed_inputs = [p for p, expected in inputs.get('files', {}).items() if not (ROOT/'unity'/p).is_file() or sha(ROOT/'unity'/p) != expected]
    replace('runtime_inputs_match_current_scene_and_sources', bool(inputs.get('files')) and not changed_inputs and inputs.get('status') == 'UNCHANGED_DURING_PLAY' and inputs.get('files', {}).get(SCENE.removeprefix('unity/')) == scene_sha,
            {'snapshot_status': inputs.get('status'), 'file_count': len(inputs.get('files', {})), 'changed': changed_inputs})
    replace('runtime_completed_without_reported_errors', runtime.get('status') == 'PASS' and runtime.get('errors') == [], runtime)
    route_rows = navigation.get('routes', [])
    errors = []
    for row in route_rows:
        if not (row.get('status') == 'PASS' and row.get('roundTrip') and row.get('arrivalCount') == 2 and row.get('frames', 0) > 0 and row.get('supportSamples', 0) > 0 and row.get('reachedWaypoints') == row.get('waypointCount') and all(row.get(k) == 0 for k in ('missingSupportSamples', 'groundMismatchSamples', 'buildingPenetrationSamples')) and abs(row.get('distanceMovedMeters', 0)-row.get('expectedRoundTripMeters', 0)) < 1):
            errors.append(row.get('routeId'))
    replace('four_real_round_trips_with_ground_and_collision_samples', len(route_rows) == 4 and {r.get('routeId') for r in route_rows} == {'school_commerce', 'school_residential', 'school_park', 'residential_commerce'} and not errors and navigation.get('layoutSha256') == sha(ROOT/'docs/planning/city_rebuild_v002/layout.json'),
            {'failed_routes': errors, 'navigation': navigation})
    names = ['01-city', '02-school', '03-commercial', '04-residential', '05-park-river', '06-npc-follow', '07-apartment-follow']
    captures = [VERIFY/'city-rebuild-v002-phase8-captures'/stage/(name+'.png') for stage in ('before', 'after') for name in names]
    missing_captures = [p.relative_to(ROOT).as_posix() for p in captures if not p.is_file() or p.stat().st_size < 1000]
    replace('runtime_camera_numeric_checks_and_captures', not missing_captures and runtime.get('followFrames', 0) > 0 and runtime.get('fullBodyOffscreenFrames') == 0 and runtime.get('groundBelowFrames') == 0 and runtime.get('revealFrames', 0) > 0,
            {'missing': missing_captures, 'runtime': runtime, 'scope': 'Numerical framing and file checks only; human image review separately required'})
    transitions = read('after-transitions')
    transition_rows = transitions.get('samples', [])
    expected_transitions = {'static-view-to-campus', 'campus-to-apartment', 'apartment-to-route-start', 'route-end-to-apartment'}
    transition_pass = (len(transition_rows) == 4 and {r.get('label') for r in transition_rows} == expected_transitions
                       and '  smoothFollowTransitions: 1' in (ROOT/SCENE).read_text()
                       and all(r.get('status') == 'PASS' and r.get('frames', 0) > 1
                               and 0 < r.get('seconds', 0) < 15 and r.get('finalTargetError', 100) < .1
                               and 0 <= r.get('maxPanSpeed', -1) <= 42
                               and 0 <= r.get('maxAngularSpeed', -1) <= 21
                               and 0 <= r.get('maxZoomSpeed', -1) <= 126 for r in transition_rows))
    result['acquisition_transitions'] = {'status': 'PASS' if transition_pass else 'FAIL',
                                         'evidence': transitions,
                                         'scope': 'Four real-time acquisition/target switches with route time frozen; pan, orbit angle and zoom bounded separately. Not a performance benchmark.'}
    replace('measured_1_100_500_1000_moving_npc_workloads', False,
            {'scope': 'Phase8-D deferred by user; prior Phase7 FPS are historical baseline only. No new performance comparison or optimization claim.'}, status='NOT TESTED')
    result['legacy_checker_exit_code'] = run.returncode
    result['legacy_result'] = legacy_output.relative_to(ROOT).as_posix()
    result['regression_21'] = regression
    result['regression_summary'] = dict(collections.Counter(row['status'] for row in regression))
    result['status'] = 'FAIL' if result['status'] == 'FAIL' or not transition_pass or any(row['status'] == 'FAIL' for row in regression) else 'PASS_AB_EVIDENCE_WITH_DEFERRED_PERFORMANCE'


if __name__ == '__main__':
    raise SystemExit(main())
