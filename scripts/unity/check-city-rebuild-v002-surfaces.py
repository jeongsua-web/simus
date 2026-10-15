#!/usr/bin/env python3
"""Sample actual serialized Unity mesh triangles, independent of ribbon generator."""
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
    text = path.read_text()
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


def main():
    layout = json.loads((ROOT / 'docs/planning/city_rebuild_v002/layout.json').read_text())
    scene_text = (FOLDER / 'CityRebuild_v002.unity').read_text()
    referenced_guids = set(re.findall(r'guid: ([0-9a-f]{32})', scene_text))
    bins = collections.defaultdict(list)
    mesh_count = triangle_count = 0
    hashes = {}
    for path in sorted((FOLDER / 'meshes').glob('*.asset')):
        guid = re.search(r'^guid: ([0-9a-f]{32})$', Path(str(path)+'.meta').read_text(), re.M).group(1)
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

    result = {'scope': 'Actual serialized generated triangle support sampled at <=1m longitudinal spacing and center/±45% width, with 1mm edge distance tolerance; not Unity physics, NavMesh, thresholds, campus imported ground, or an exhaustive mesh union proof.',
              'edge_tolerance_metres': .001,
              'scene_sha256': hashlib.sha256((FOLDER/'CityRebuild_v002.unity').read_bytes()).hexdigest(),
              'mesh_sha256': hashes, 'surface_meshes': mesh_count, 'surface_triangles': triangle_count,
              'roads': sample(layout['roads'],'carriageway_width'), 'walks': sample(layout['pedestrian_edges'],'width')}
    result['status'] = 'PASS' if result['roads']['unsupported'] == 0 and result['walks']['unsupported'] == 0 else 'FAIL'
    output = ROOT / 'docs/verification/city-rebuild-v002-surface-results.json'
    output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({key:value for key,value in result.items() if key not in ['mesh_sha256','roads','walks']},ensure_ascii=False,indent=2))
    for key in ['roads','walks']:
        print(key, result[key]['samples'], 'samples;', result[key]['unsupported'], 'unsupported')
    return int(result['status'] != 'PASS')


if __name__ == '__main__':
    raise SystemExit(main())
