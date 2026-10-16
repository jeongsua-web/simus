#!/usr/bin/env python3
"""Sample actual serialized Unity mesh triangles, independent of ribbon generator."""
import argparse
import collections
import hashlib
import json
import math
from pathlib import Path
import re
import struct

ROOT = Path(__file__).resolve().parents[2]
FOLDER = ROOT / 'unity/Assets/SIMUS/Scenes/city_rebuild_v002'


def field(text, key):
    return re.search(r'^\s+' + re.escape(key) + r': (.*)$', text, re.M).group(1)


def triangles(path):
    text = path.read_text(encoding='utf-8')
    count = int(field(text, 'm_VertexCount'))
    blob = bytes.fromhex(field(text, '_typelessdata'))
    # Generated meshes contain position float3, normal float3 in stream 0.
    assert len(blob) == count * 24, (path, 'unexpected vertex stride')
    vertices = [struct.unpack_from('<3f', blob, i * 24) for i in range(count)]
    index_blob = bytes.fromhex(field(text, 'm_IndexBuffer'))
    code = 'I' if field(text, 'm_IndexFormat') == '1' else 'H'
    indices = [x[0] for x in struct.iter_unpack('<' + code, index_blob)]
    assert len(indices) % 3 == 0
    return field(text, 'm_Name'), [[vertices[i] for i in indices[k:k + 3]] for k in range(0, len(indices), 3)]


def generated_surface_transform_audit(scene_text):
    """Generated surface vertices are world coordinates: identity is required.

    Validate the saved hierarchy before treating mesh-local vertices as world
    support. This deliberately rejects transforms instead of silently ignoring
    them; imported campus/park FBXs use separate calibrated transforms.
    """
    groups = {'01_Ground', '02_Roads', '03_TurningAndIntersections',
              '04_PedestrianSurfaces', '05_CrossingFacilities_17'}
    blocks = re.findall(r'^--- !u!(\d+) &(-?\d+)(?: stripped)?\n(.*?)(?=^--- !u!|\Z)', scene_text, re.M | re.S)
    names, transforms = {}, {}
    for kind, fid, body in blocks:
        if kind == '1':
            match = re.search(r'^  m_Name: (.*)$', body, re.M)
            if match:
                name = match.group(1)
                names[int(fid)] = json.loads(name) if name.startswith('"') else name
        elif kind == '4' and 'm_LocalPosition:' in body:
            go = int(re.search(r'm_GameObject: \{fileID: (-?\d+)\}', body).group(1))
            parent = int(re.search(r'm_Father: \{fileID: (-?\d+)\}', body).group(1))
            values = {}
            for key in ('m_LocalPosition', 'm_LocalRotation', 'm_LocalScale'):
                raw = re.search(key + r': (\{.*\})', body).group(1)
                values[key] = json.loads(re.sub(r'([xyzw]):', r'"\1":', raw))
            transforms[int(fid)] = {'go': go, 'parent': parent, 'values': values}
    inspected, invalid, found_groups = set(), [], set()
    defaults = {'m_LocalPosition': {'x': 0, 'y': 0, 'z': 0},
                'm_LocalRotation': {'x': 0, 'y': 0, 'z': 0, 'w': 1},
                'm_LocalScale': {'x': 1, 'y': 1, 'z': 1}}
    for fid in transforms:
        chain = []; at = fid
        while at in transforms and at not in chain:
            chain.append(at); at = transforms[at]['parent']
        path = [names.get(transforms[n]['go'], '?') for n in reversed(chain)]
        matched = groups.intersection(path)
        if not matched: continue
        found_groups.update(matched)
        for ancestor in chain:
            if ancestor in inspected: continue
            inspected.add(ancestor)
            values = transforms[ancestor]['values']
            if any(abs(values[key][axis] - expected) > .000001
                   for key, axes in defaults.items() for axis, expected in axes.items()):
                invalid.append({'transform': ancestor, 'name': names.get(transforms[ancestor]['go']),
                                'discovered_from': '/'.join(path), **values})
    missing = sorted(groups - found_groups)
    return {'status': 'PASS' if not invalid and not missing else 'FAIL',
            'checked_transforms': len(inspected), 'nonidentity': invalid, 'missing_groups': missing,
            'scope': 'Identity hierarchy prerequisite for world-coordinate generated terrain/roads/walks/crossings; includes ancestors. Imported FBX transforms are excluded.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'docs/verification/city-rebuild-v002-surface-results.json')
    args = parser.parse_args()
    layout = json.loads((ROOT / 'docs/planning/city_rebuild_v002/layout.json').read_text(encoding='utf-8'))
    scene_text = (FOLDER / 'CityRebuild_v002.unity').read_text(encoding='utf-8')
    transform_audit = generated_surface_transform_audit(scene_text)
    referenced_guids = set(re.findall(r'guid: ([0-9a-f]{32})', scene_text))
    bins = collections.defaultdict(list)
    mesh_count = triangle_count = 0
    hashes = {}
    for path in sorted((FOLDER / 'meshes').glob('*.asset')):
        guid = re.search(r'^guid: ([0-9a-f]{32})$', Path(str(path)+'.meta').read_text(encoding='utf-8'), re.M).group(1)
        if guid not in referenced_guids:
            continue
        name, tris = triangles(path)
        hashes[path.name] = hashlib.sha256(path.read_bytes()).hexdigest()
        if name == 'CityGround' or name.startswith('Stripe_'):
            continue
        mesh_count += 1
        for tri in tris:
            if not all(abs(p[1] - .02) < .001 or abs(p[1] - .14) < .001 for p in tri):
                continue
            triangle_count += 1
            xs = [p[0] for p in tri]; zs = [p[2] for p in tri]
            item = [(p[0], p[2]) for p in tri]
            for x in range(math.floor(min(xs) / 10), math.floor(max(xs) / 10) + 1):
                for z in range(math.floor(min(zs) / 10), math.floor(max(zs) / 10) + 1):
                    bins[x,z].append(item)

    def supported(x, z):
        near_boundary = False
        for tri in bins[math.floor(x / 10), math.floor(z / 10)]:
            signs = [((b[0]-a[0])*(z-a[1])-(b[1]-a[1])*(x-a[0])) / max(math.dist(a,b),1e-12)
                     for a,b in zip(tri, tri[1:]+tri[:1])]
            if min(signs) >= -.000001 or max(signs) <= .000001:
                return True, False
            if min(signs) >= -.001 or max(signs) <= .001:
                near_boundary = True
        return near_boundary, near_boundary

    def sample(items, width_key):
        count = 0; misses = []; tolerance_samples = []
        for item in items:
            for a,b in zip(item['points'], item['points'][1:]):
                dx, dz = b[0]-a[0], b[1]-a[1]; length = math.hypot(dx,dz)
                if length < .0001:
                    continue
                steps = max(1, math.ceil(length))
                for i in range(steps+1):
                    # Leave exact polyline end caps to adjacent triangle/collider edge semantics.
                    t = max(.0001, min(.9999, i/steps))
                    for fraction in [0, -.45, .45]:
                        offset = item[width_key]*fraction
                        x = a[0]+dx*t-dz/length*offset
                        z = a[1]+dz*t+dx/length*offset
                        count += 1
                        ok, used_tolerance = supported(x,z)
                        point = {'id': item['id'], 'xz': [round(x,4),round(z,4)], 'width_fraction': fraction}
                        if not ok:
                            misses.append(point)
                        elif used_tolerance:
                            tolerance_samples.append(point)
        return {'samples': count, 'unsupported': len(misses), 'misses': misses,
                'boundary_tolerance_samples': tolerance_samples}

    result = {'scope': 'Serialized generated triangle support sampled at <=1m longitudinal spacing and center/±45% width, with 1mm edge tolerance. PASS requires identity scene transforms so mesh-local coordinates equal world coordinates. Not Unity physics, NavMesh, thresholds, campus imported ground, or an exhaustive mesh union proof.',
              'scene_transform_audit': transform_audit,
              'edge_tolerance_metres': .001,
              'scene_sha256': hashlib.sha256((FOLDER/'CityRebuild_v002.unity').read_bytes()).hexdigest(),
              'mesh_sha256': hashes, 'surface_meshes': mesh_count, 'surface_triangles': triangle_count,
              'roads': sample(layout['roads'],'carriageway_width'), 'walks': sample(layout['pedestrian_edges'],'width')}
    result['status'] = 'PASS' if transform_audit['status'] == 'PASS' and result['roads']['unsupported'] == 0 and result['walks']['unsupported'] == 0 else 'FAIL'
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n', encoding='utf-8')
    summary = {key:value for key,value in result.items() if key not in ['mesh_sha256','roads','walks','scene_transform_audit']}
    summary['scene_transform_audit'] = {key:value for key,value in transform_audit.items() if key != 'nonidentity'}
    summary['scene_transform_audit']['nonidentity_count'] = len(transform_audit['nonidentity'])
    print(json.dumps(summary,ensure_ascii=False,indent=2))
    for key in ['roads','walks']:
        print(key, result[key]['samples'], 'samples;', result[key]['unsupported'], 'unsupported')
    return int(result['status'] != 'PASS')


if __name__ == '__main__':
    raise SystemExit(main())
