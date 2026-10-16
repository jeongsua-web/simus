#!/usr/bin/env python3
"""Phase4-7 independent artifact checks. No claim of Play Mode from static data."""
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
VERIFY = ROOT / 'docs/verification'
SCENE = ROOT / 'unity/Assets/SIMUS/Scenes/city_rebuild_v002/CityRebuild_v002.unity'

def sha(p):
    with p.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=VERIFY/'city-rebuild-v002-phase47-static-results.json')
    parser.add_argument('--baseline', type=Path, default=VERIFY/'city-rebuild-v002-phase47-resume-baseline.json',
                        help='Current resumption baseline; original phase47 baseline remains available for historical comparison.')
    args = parser.parse_args()
    checks = []
    def record(name, passed, evidence):
        checks.append({'check':name, 'status':'PASS' if passed else 'FAIL', 'evidence':evidence})
    baseline = json.loads(args.baseline.read_text())
    allowed = {
        'unity/Assets/Editor/CityRebuildV002Setup.cs':'Phase4-7 scene generation',
        'unity/Assets/Editor/CityRebuildV002SurfaceAudit.cs':'Extended surface QA',
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
    lp=ROOT/'docs/planning/city_rebuild_v002/layout.json'; layout=json.loads(lp.read_text())
    record('approved_layout_immutable',sha(lp)=='3e98ea485bd92dc9c2528d0420b5999a0336f700270c0f73f7630aa214fbd105',sha(lp))
    nodes={n['id'] for n in layout['pedestrian_nodes']}; edges=layout['pedestrian_edges']; adj=collections.defaultdict(set)
    for edge in edges:
        adj[edge['from']].add(edge['to']);adj[edge['to']].add(edge['from'])
    seen=set(); pending=[next(iter(nodes))]
    while pending:
        n=pending.pop()
        if n in seen:continue
        seen.add(n);pending.extend(adj[n]-seen)
    record('approved_graph_connected_388_409_17',len(nodes)==388 and len(edges)==409 and seen==nodes and len(layout['crossing_facilities'])==17,{'nodes':len(nodes),'edges':len(edges),'reachable':len(seen),'crossings':len(layout['crossing_facilities']),'scope':'Design topology only, not NPC runtime'})
    text=SCENE.read_text(); blocks=re.findall(r'^--- !u!(\d+) &(-?\d+)(?: stripped)?\n(.*?)(?=^--- !u!|\Z)',text,re.M|re.S)
    ids={int(b[1]) for b in blocks}; dangling=sorted({int(m.group(1)) for m in re.finditer(r'\{fileID: (-?\d+)\}',text) if int(m.group(1)) and int(m.group(1)) not in ids})
    record('scene_local_references',not dangling and len(ids)==len(blocks),{'objects':len(ids),'dangling':dangling})
    guid_paths=collections.defaultdict(list)
    for p in (ROOT/'unity/Assets').rglob('*.meta'):
        match=re.search(r'^guid: ([0-9a-f]{32})$',p.read_text(errors='replace'),re.M)
        if match:guid_paths[match.group(1)].append(p.with_suffix(''))
    refs=set(re.findall(r'guid: ([0-9a-f]{32})',text)); unresolved=sorted(g for g in refs if g not in guid_paths and not g.startswith('0000000000000000'))
    duplicates={g:[str(p.relative_to(ROOT)) for p in guid_paths[g]] for g in refs if len(guid_paths[g])>1}
    record('scene_external_guids',not unresolved and not duplicates,{'missing':unresolved,'duplicates':duplicates})
    names=[json.loads(n) if n.startswith('"') else n for n in re.findall(r'^  m_Name: (.*)$',text,re.M)]
    expected={b['id']+'_'+(b['name'] if b['id'].startswith('C') else b['type']) for b in layout['buildings']+layout['campus']['components']}
    record('building_wrappers_14_plus_55',set(names)&expected==expected and sum(n in expected for n in names)==69,{'missing':sorted(expected-set(names)),'total':sum(n in expected for n in names)})
    parkrefs={str(p.relative_to(ROOT)) for g in refs for p in guid_paths[g] if p.suffix.lower()=='.fbx' and 'parks' in p.parts}
    expectedparks={x['asset'] for x in layout['park']['reuse_modules']}
    record('two_existing_park_fbx_referenced',expectedparks<=parkrefs,sorted(parkrefs))
    spec=importlib.util.spec_from_file_location('surface_qa',ROOT/'scripts/unity/check-city-rebuild-v002-surfaces.py'); surfaces=importlib.util.module_from_spec(spec);spec.loader.exec_module(surfaces)
    longest=0;oversized=[];count=0
    for p in sorted([* (SCENE.parent/'meshes').glob('*.asset'), * (SCENE.parent/'phase4_meshes').glob('*.asset')]):
        if '_FBXPart_' in p.name:continue  # Imported UV-bearing park extraction uses a different vertex layout; Unity audits its world collider edges.
        meta=Path(str(p)+'.meta');match=re.search(r'^guid: ([0-9a-f]{32})$',meta.read_text(),re.M)
        if match.group(1) not in refs:continue
        name,tris=surfaces.triangles(p)
        for tri in tris:
            count+=1;length=max(math.dist(a,b) for a,b in zip(tri,tri[1:]+tri[:1]));longest=max(longest,length)
            if length>500:oversized.append({'mesh':p.name,'max_edge':length})
    record('generated_mesh_triangle_edges_below_500',not oversized,{'triangles':count,'max_edge_metres':longest,'oversized':oversized[:30],'scope':'Serialized generated geometry excluding UV-bearing FBX-derived park parts; imported/scaled world collider triangles require Unity audit'})
    result={'scope':'Independent static artifact checks only; PASS here does not prove Unity compile/load/Play Mode, animation, collision-free movement, camera or performance.','scene_sha256':sha(SCENE),'layout_sha256':sha(lp),'checks':checks,'status':'FAIL' if any(x['status']=='FAIL' for x in checks) else 'PASS_STATIC_ONLY'}
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'status':result['status'],'checks':[{k:c[k] for k in ['check','status']} for c in checks]},indent=2));return int(result['status']=='FAIL')
if __name__=='__main__':raise SystemExit(main())
