#!/usr/bin/env python3
"""Phase4-7 independent artifact checks. No claim of Play Mode from static data."""
import argparse
import collections
import csv
import hashlib
import importlib.util
import itertools
import json
import math
from pathlib import Path
import re
import subprocess
import sys
sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
VERIFY = ROOT / 'docs/verification'
SCENE = ROOT / 'unity/Assets/SIMUS/Scenes/city_rebuild_v002/CityRebuild_v002.unity'

def sha(p):
    with p.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=VERIFY/'city-rebuild-v002-phase47-static-results.json')
    parser.add_argument('--baseline', type=Path, default=VERIFY/'city-rebuild-v002-phase47-continue-baseline.json',
                        help='Current resumption baseline; original phase47 baseline remains available for historical comparison.')
    parser.add_argument('--runtime', action='store_true', help='Also independently review completed runtime evidence and its input hashes; does not launch Unity.')
    args = parser.parse_args()
    checks = []
    def record(name, passed, evidence):
        checks.append({'check':name, 'status':'PASS' if passed else 'FAIL', 'evidence':evidence})
    baseline = json.loads(args.baseline.read_text(encoding='utf-8'))
    allowed = {
        'unity/Assets/Editor/CityRebuildV002Setup.cs':'Phase4-7 scene generation',
        'unity/Assets/Editor/CityRebuildV002SurfaceAudit.cs':'Extended surface QA',
        'unity/Assets/Editor/CityRebuildV002Completion.cs':'Resume park FBX rotation/benches and restore missing scene navigation/camera components; separately reviewed',
        'unity/Assets/Editor/CityRebuildV002Phase47Bridge.cs':'Runtime verification orchestration; separately reviewed',
        'unity/Assets/Editor/CityRebuildV002Phase4Setup.cs':'Park FBX rotation and placement; separately reviewed',
        'unity/Assets/Scripts/CityPreviewCamera.cs':'User-authorized camera settings/compatibility; separate diff review required',
        'assets/catalog/README.md':'Usage documentation',
        'unity/Assets/Scripts/NpcOcclusionReveal.cs':'User-authorized v002 occlusion root extension; null default retains original behavior; separate review required',
        'unity/Assets/Scripts/CityV002Phase6Verification.cs':'Actual runtime camera/performance evidence harness; separately reviewed',
        'unity/Assets/Scripts/CityV002NavigationVerification.cs':'Runtime route evidence harness; separately reviewed',
    }
    changed, unexpected = [], []
    for item in baseline['files']:
        p = ROOT/item['path']
        if p.is_file() and sha(p) == item['sha256']:
            continue
        changed.append(item['path'])
        if item['path'] not in allowed and not item['path'].startswith('unity/Assets/SIMUS/Scenes/city_rebuild_v002/'):
            unexpected.append(item['path'])
    record('phase47_protected_baseline',not unexpected, {'baseline':str(args.baseline.relative_to(ROOT)) if args.baseline.is_relative_to(ROOT) else str(args.baseline),'files':len(baseline['files']),'unexpected_changes':unexpected,'authorized_working_changes':sorted(set(changed)-set(unexpected)),'preexisting_dirty_state':baseline['git_status']})
    lp=ROOT/'docs/planning/city_rebuild_v002/layout.json'; layout=json.loads(lp.read_text(encoding='utf-8'))
    record('approved_layout_immutable',sha(lp)=='3e98ea485bd92dc9c2528d0420b5999a0336f700270c0f73f7630aa214fbd105',sha(lp))
    csv_errors = []
    for filename, buildings in [('buildings.csv', layout['buildings']), ('campus-placements.csv', layout['campus']['components'])]:
        with (lp.parent/filename).open(encoding='utf-8', newline='') as stream:
            rows = list(csv.DictReader(stream))
        indexed = {row['id']: row for row in rows}
        if len(rows) != len(buildings) or set(indexed) != {b['id'] for b in buildings}: csv_errors.append(filename + ': IDs/count')
        for building in buildings:
            for key in ('x', 'z', 'yaw', 'width', 'depth', 'height'):
                value = indexed.get(building['id'], {}).get(key)
                if value is None or abs(float(value) - building[key]) > .00001: csv_errors.append(filename + ':' + building['id'] + ':' + key)
    record('approved_csv_placements_match_layout', not csv_errors, csv_errors)
    design_spec = importlib.util.spec_from_file_location('design_qa', lp.parent/'qa-check.py')
    design = importlib.util.module_from_spec(design_spec); design_spec.loader.exec_module(design)
    building_envelopes = {b['id']: design.rect((b['x'], b['z']), b['width'], b['depth'], b['yaw']) for b in layout['buildings'] + layout['campus']['components']}
    overlaps = [[a,b] for a,b in itertools.combinations(building_envelopes,2) if design.overlap(building_envelopes[a],building_envelopes[b])]
    record('approved_building_envelopes_nonoverlapping', not overlaps, {'overlaps': overlaps, 'scope': 'Approved envelopes only; preserved hierarchy and prior imported bounds are checked separately.'})
    nodes={n['id'] for n in layout['pedestrian_nodes']}; edges=layout['pedestrian_edges']; adj=collections.defaultdict(set)
    for edge in edges:
        adj[edge['from']].add(edge['to']);adj[edge['to']].add(edge['from'])
    seen=set(); pending=[next(iter(nodes))]
    while pending:
        n=pending.pop()
        if n in seen:continue
        seen.add(n);pending.extend(adj[n]-seen)
    record('approved_graph_connected_388_409_17',len(nodes)==388 and len(edges)==409 and seen==nodes and len(layout['crossing_facilities'])==17,{'nodes':len(nodes),'edges':len(edges),'reachable':len(seen),'crossings':len(layout['crossing_facilities']),'scope':'Design topology only, not NPC runtime'})
    text=SCENE.read_text(encoding='utf-8'); blocks=re.findall(r'^--- !u!(\d+) &(-?\d+)(?: stripped)?\n(.*?)(?=^--- !u!|\Z)',text,re.M|re.S)
    ids={int(b[1]) for b in blocks}; dangling=sorted({int(m.group(1)) for m in re.finditer(r'\{fileID: (-?\d+)\}',text) if int(m.group(1)) and int(m.group(1)) not in ids})
    record('scene_local_references',not dangling and len(ids)==len(blocks),{'objects':len(ids),'dangling':dangling})
    guid_paths=collections.defaultdict(list)
    for p in (ROOT/'unity/Assets').rglob('*.meta'):
        match=re.search(r'^guid: ([0-9a-f]{32})$',p.read_text(encoding='utf-8', errors='replace'),re.M)
        if match:guid_paths[match.group(1)].append(p.with_suffix(''))
    refs=set(re.findall(r'guid: ([0-9a-f]{32})',text)); unresolved=sorted(g for g in refs if g not in guid_paths and not g.startswith('0000000000000000'))
    duplicates={g:[p.relative_to(ROOT).as_posix() for p in guid_paths[g]] for g in refs if len(guid_paths[g])>1}
    record('scene_external_guids',not unresolved and not duplicates,{'missing':unresolved,'duplicates':duplicates})
    names=[json.loads(n) if n.startswith('"') else n for n in re.findall(r'^  m_Name: (.*)$',text,re.M)]
    expected={b['id']+'_'+(b['name'] if b['id'].startswith('C') else b['type']) for b in layout['buildings']+layout['campus']['components']}
    record('building_wrappers_14_plus_55',set(names)&expected==expected and sum(n in expected for n in names)==69,{'missing':sorted(expected-set(names)),'total':sum(n in expected for n in names)})
    # An empty correctly named wrapper cannot pass FBX provenance. Follow saved
    # transform ancestry, mesh references and imported prefab parent references.
    go_names = {}
    parents = {}
    go_transforms = {}
    sources = collections.defaultdict(set)
    for kind, fid, body in blocks:
        fid = int(fid)
        if kind == '1':
            match = re.search(r'^  m_Name: (.*)$', body, re.M)
            if match:
                name = match.group(1)
                go_names[fid] = json.loads(name) if name.startswith('"') else name
        elif kind == '4':
            go = re.search(r'^  m_GameObject: \{fileID: (-?\d+)\}', body, re.M)
            parent = re.search(r'^  m_Father: \{fileID: (-?\d+)\}', body, re.M)
            if go: go_transforms[int(go.group(1))] = fid
            if parent: parents[fid] = int(parent.group(1))
    for kind, fid, body in blocks:
        if kind == '33':
            go = re.search(r'^  m_GameObject: \{fileID: (-?\d+)\}', body, re.M)
            mesh = re.search(r'^  m_Mesh: \{fileID: -?\d+, guid: ([0-9a-f]{32})', body, re.M)
            if go and mesh and int(go.group(1)) in go_transforms:
                sources[go_transforms[int(go.group(1))]].add(mesh.group(1))
        elif kind == '1001':
            parent = re.search(r'm_TransformParent: \{fileID: (-?\d+)\}', body)
            prefab = re.search(r'^  m_SourcePrefab: \{fileID: -?\d+, guid: ([0-9a-f]{32})', body, re.M)
            if parent and prefab: sources[int(parent.group(1))].add(prefab.group(1))
    descendants = collections.defaultdict(set)
    for transform, guids in sources.items():
        visited = set()
        while transform and transform not in visited:
            visited.add(transform)
            descendants[transform].update(guids)
            transform = parents.get(transform, 0)
    proof = []
    for building in layout['buildings'] + layout['campus']['components']:
        name = building['id'] + '_' + (building['name'] if building['id'].startswith('C') else building['type'])
        gos = [go for go, saved_name in go_names.items() if saved_name == name]
        refs_for_building = set().union(*(descendants.get(go_transforms.get(go), set()) for go in gos))
        expected_asset = building.get('asset', layout['campus']['asset'])
        paths = {p.relative_to(ROOT).as_posix() for guid in refs_for_building for p in guid_paths[guid] if p.suffix.lower() == '.fbx'}
        proof.append({'id': building['id'], 'expected_fbx': expected_asset, 'actual_fbx': sorted(paths), 'matched': expected_asset in paths})
    record('all_69_buildings_reference_expected_fbx_in_hierarchy',all(p['matched'] for p in proof),proof)
    if baseline.get('git_head'):
        original_scene = subprocess.check_output(['git', 'show', baseline['git_head'] + ':' + SCENE.relative_to(ROOT).as_posix()], cwd=ROOT, text=True, encoding='utf-8')
        def building_subtrees(serialized):
            parsed = re.findall(r'^--- !u!(\d+) &(-?\d+)(?: stripped)?\n(.*?)(?=^--- !u!|\Z)', serialized, re.M | re.S)
            by_id = {int(fid): (kind, body) for kind, fid, body in parsed}
            components = collections.defaultdict(set)
            transform_for_go = {}
            children = collections.defaultdict(set)
            prefab_for_parent = collections.defaultdict(set)
            named = {}
            for kind, fid, body in parsed:
                fid = int(fid)
                go = re.search(r'^  m_GameObject: \{fileID: (-?\d+)\}', body, re.M)
                if go: components[int(go.group(1))].add(fid)
                if kind == '1':
                    match = re.search(r'^  m_Name: (.*)$', body, re.M)
                    if match:
                        name = match.group(1); name = json.loads(name) if name.startswith('"') else name
                        if name in expected: named[name] = fid
                elif kind == '4':
                    if go: transform_for_go[int(go.group(1))] = fid
                    child_text = re.search(r'^  m_Children:\n(.*?)(?=^  \w|\Z)', body, re.M | re.S)
                    if child_text: children[fid].update(int(n) for n in re.findall(r'fileID: (-?\d+)', child_text.group(1)))
                elif kind == '1001':
                    parent = re.search(r'm_TransformParent: \{fileID: (-?\d+)\}', body)
                    if parent: prefab_for_parent[int(parent.group(1))].add(fid)
            snapshots = {}
            for name, go_id in named.items():
                selected = {go_id}; pending = [transform_for_go[go_id]]
                while pending:
                    transform = pending.pop()
                    if transform in selected: continue
                    selected.add(transform)
                    pending.extend(children[transform])
                    selected.update(prefab_for_parent[transform])
                    go = re.search(r'^  m_GameObject: \{fileID: (-?\d+)\}', by_id[transform][1], re.M)
                    if go:
                        local_go = int(go.group(1)); selected.add(local_go); selected.update(components[local_go])
                snapshots[name] = {fid: by_id[fid] for fid in selected}
            return snapshots
        original_buildings = building_subtrees(original_scene)
        current_buildings = building_subtrees(text)
        modified_buildings = sorted(name for name in expected if original_buildings.get(name) != current_buildings.get(name))
        record('existing_69_fbx_building_hierarchies_preserved', not modified_buildings,
               {'baseline_git_head': baseline['git_head'], 'compared': len(expected), 'modified': modified_buildings,
                'scope': 'Exact serialized hierarchy, Transform, components and prefab overrides; original FBX/meta hashes protected separately. Does not replace a Unity import or physics test.'})
    parkrefs={p.relative_to(ROOT).as_posix() for g in refs for p in guid_paths[g] if p.suffix.lower()=='.fbx' and 'parks' in p.parts}
    expectedparks={x['asset'] for x in layout['park']['reuse_modules']}
    record('two_existing_park_fbx_referenced',expectedparks<=parkrefs,sorted(parkrefs))
    spec=importlib.util.spec_from_file_location('surface_qa',ROOT/'scripts/unity/check-city-rebuild-v002-surfaces.py'); surfaces=importlib.util.module_from_spec(spec);spec.loader.exec_module(surfaces)
    longest=0;oversized=[];count=0
    for p in sorted([* (SCENE.parent/'meshes').glob('*.asset'), * (SCENE.parent/'phase4_meshes').glob('*.asset')]):
        if '_FBXPart_' in p.name:continue  # Imported UV-bearing park extraction uses a different vertex layout; Unity audits its world collider edges.
        meta=Path(str(p)+'.meta');match=re.search(r'^guid: ([0-9a-f]{32})$',meta.read_text(encoding='utf-8'),re.M)
        if match.group(1) not in refs:continue
        name,tris=surfaces.triangles(p)
        for tri in tris:
            count+=1;length=max(math.dist(a,b) for a,b in zip(tri,tri[1:]+tri[:1]));longest=max(longest,length)
            if length>500:oversized.append({'mesh':p.name,'max_edge':length})
    record('generated_mesh_triangle_edges_below_500',not oversized,{'triangles':count,'max_edge_metres':longest,'oversized':oversized[:30],'scope':'Serialized generated geometry excluding UV-bearing FBX-derived park parts; imported/scaled world collider triangles require Unity audit'})
    if args.runtime:
        runtime_path = VERIFY/'city-rebuild-v002-phase6-runtime.json'
        navigation_path = VERIFY/'city-rebuild-v002-navigation-runtime.json'
        inputs_path = VERIFY/'city-rebuild-v002-phase47-runtime-inputs.json'
        missing = [p.relative_to(ROOT).as_posix() for p in (runtime_path, navigation_path, inputs_path) if not p.is_file()]
        record('runtime_evidence_files_present', not missing, missing)
        if not missing:
            runtime = json.loads(runtime_path.read_text(encoding='utf-8'))
            navigation = json.loads(navigation_path.read_text(encoding='utf-8'))
            inputs = json.loads(inputs_path.read_text(encoding='utf-8'))
            changed = [name for name, expected_hash in inputs['files'].items()
                       if not (ROOT/'unity'/name).is_file() or sha(ROOT/'unity'/name) != expected_hash]
            scene_key = SCENE.relative_to(ROOT/'unity').as_posix()
            record('runtime_inputs_match_current_scene_and_sources', not changed and inputs.get('status') == 'UNCHANGED_DURING_PLAY' and inputs['files'].get(scene_key) == sha(SCENE),
                   {'snapshot_status': inputs.get('status'), 'file_count': len(inputs['files']), 'changed': changed})
            record('runtime_completed_without_reported_errors', runtime.get('runtimeStatus') == 'COMPLETE' and
                   runtime.get('runtimeErrors') == 0 and runtime.get('largeTriangleWarnings') == 0,
                   {key: runtime.get(key) for key in ('runtimeStatus', 'runtimeErrors', 'warnings', 'largeTriangleWarnings', 'elapsedWallSeconds')})
            expected_routes = {'school_commerce', 'school_residential', 'school_park', 'residential_commerce'}
            routes = navigation.get('routes', [])
            route_errors = []
            for route in routes:
                if not (route.get('status') == 'PASS' and route.get('roundTrip') and route.get('arrivalCount') == 2 and
                        route.get('frames', 0) > 0 and route.get('supportSamples', 0) > 0 and
                        route.get('reachedWaypoints') == route.get('waypointCount') and
                        all(route.get(k) == 0 for k in ('missingSupportSamples', 'groundMismatchSamples', 'buildingPenetrationSamples')) and
                        abs(route.get('distanceMovedMeters', 0) - route.get('expectedRoundTripMeters', 0)) < 1):
                    route_errors.append(route.get('routeId'))
            record('four_real_round_trips_with_ground_and_collision_samples', len(routes) == 4 and {r.get('routeId') for r in routes} == expected_routes and not route_errors and navigation.get('layoutSha256') == sha(lp),
                   {'failed_routes': route_errors, 'scope': navigation.get('scope'), 'maximum_time_scale': navigation.get('maximumTimeScale'), 'routes': routes})
            cameras = runtime.get('cameras', [])
            capture_paths = [VERIFY/'city-rebuild-v002-captures'/c['capture'] for c in cameras if c.get('capture')]
            record('runtime_camera_numeric_checks_and_captures', len(cameras) >= 4 and all(c.get('status') == 'PASS' for c in cameras) and len(capture_paths) == len(cameras) and all(p.is_file() and p.stat().st_size > 1000 for p in capture_paths),
                   {'samples': cameras, 'scope': 'Numeric checks and capture presence only; image readability/occlusion requires separate visual review.'})
            performance = runtime.get('performance', [])
            workload_errors = []
            for sample in performance:
                count = sample.get('npcCount')
                if not (sample.get('status', '').startswith('PASS') and sample.get('wallSeconds', 0) >= 5 and sample.get('frames', 0) > 0 and
                        all(sample.get(k) == count for k in ('activeAnimators', 'activeGrounding', 'activePatrols', 'activeGraphAdapters', 'sceneActivePatrols', 'movingActors')) and
                        sample.get('minimumActorMovement', 0) > .01 and
                        all(sample.get(k, 0) > 0 for k in ('framesPerSecond', 'editorProcessCpuMsPerFrame', 'unityAllocatedBytes', 'processWorkingSetBytes'))):
                    workload_errors.append(count)
            record('measured_1_100_500_1000_moving_npc_workloads', len(performance) == 4 and {p.get('npcCount') for p in performance} == {1,100,500,1000} and not workload_errors,
                   {'failed_workloads': workload_errors, 'performance_scope': runtime.get('performanceScope'), 'samples': performance})
    scope = ('Independent review of saved artifacts and reported runtime measurements bound to input hashes; this checker does not execute Unity. Visual readability and production performance acceptance require separate review.' if args.runtime else 'Independent static artifact checks only; PASS here does not prove Unity compile/load/Play Mode, animation, collision-free movement, camera or performance.')
    result={'scope':scope,'scene_sha256':sha(SCENE),'layout_sha256':sha(lp),'checks':checks,'status':'FAIL' if any(x['status']=='FAIL' for x in checks) else ('PASS_EVIDENCE_REVIEW' if args.runtime else 'PASS_STATIC_ONLY')}
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n', encoding='utf-8');print(json.dumps({'status':result['status'],'checks':[{k:c[k] for k in ['check','status']} for c in checks]},indent=2));return int(result['status']=='FAIL')
if __name__=='__main__':raise SystemExit(main())
