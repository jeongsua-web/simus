#!/usr/bin/env python3
"""Read the saved v002 graph without loading or changing Unity. --check is read-only."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
SCENE = ROOT / 'unity/Assets/SIMUS/Scenes/city_rebuild_v002/CityRebuild_v002.unity'
OUTPUT = ROOT / 'web/src/lib/data/city-rebuild-v002-phase1-graph.json'

def vector(raw):
    return [float(re.search(rf'{axis}: ([^,}}]+)', raw)[1]) for axis in 'xyz']

def read_graph():
    source = SCENE.read_bytes()
    blocks = re.findall(r'^--- !u!(\d+) &(-?\d+).*?\n(.*?)(?=^--- !u!|\Z)', source.decode(), re.M | re.S)
    graph, = [body for kind, fid, body in blocks if 'guid: 5f84dae63db8441aaa9c70292df1bf56,' in body]
    # The runtime adapter consumes graph coordinates directly as Unity world metres.
    transforms = {}
    for kind, fid, body in blocks:
        if kind == '4' and 'm_LocalPosition:' in body:
            transforms[int(fid)] = body
    go = re.search(r'm_GameObject: \{fileID: (\d+)\}', graph)[1]
    fid, = [fid for fid, body in transforms.items() if f'm_GameObject: {{fileID: {go}}}' in body]
    while fid:
        body = transforms[fid]
        assert vector(re.search(r'm_LocalPosition: (.*)', body)[1]) == [0, 0, 0]
        assert vector(re.search(r'm_LocalScale: (.*)', body)[1]) == [1, 1, 1]
        rotation = re.search(r'm_LocalRotation: (.*)', body)[1]
        assert vector(rotation) == [0, 0, 0] and float(re.search(r'w: ([^}]+)', rotation)[1]) == 1
        fid = int(re.search(r'm_Father: \{fileID: (\d+)\}', body)[1])
    nodes_text, edges_text = graph.split('  nodes:\n')[1].split('  edges:\n')
    nodes = [{'id': name, 'position': vector(raw)} for name, raw in re.findall(r'  - id: (\S+)\n    position: (.*)', nodes_text)]
    edges = []
    for raw in re.split(r'(?=^  - id: )', edges_text, flags=re.M):
        if not raw.strip(): continue
        def field(key): return re.search(rf'^    {key}: (.*)$', raw, re.M)[1]
        edge = dict(id=re.search(r'  - id: (\S+)', raw)[1], kind=field('kind'),
                    **{'from': int(field('from')), 'to': int(field('to'))}, width=float(field('width')),
                    points=[vector(v) for v in re.findall(r'^    - (\{.*\})$', raw, re.M)])
        assert len(edge['points']) >= 2
        assert math.dist(edge['points'][0], nodes[edge['from']]['position']) < .002
        assert math.dist(edge['points'][-1], nodes[edge['to']]['position']) < .002
        edges.append(edge)
    assert len(nodes) >= 572 and len(edges) >= 597
    assert len({n['id'] for n in nodes}) == len(nodes) and len({e['id'] for e in edges}) == len(edges)
    layout = ROOT / 'docs/planning/city_rebuild_v002/layout.json'
    # The approved JSON was hashed with LF. A Windows checkout may materialize
    # CRLF without changing that plan; record both the canonical and file hash.
    layout_bytes = layout.read_bytes()
    layout_hash = hashlib.sha256(layout_bytes.replace(b'\r\n', b'\n')).hexdigest()
    assert re.search(r'layoutSha256: (\w+)', graph)[1] == layout_hash
    return dict(map_version=re.search(r'^  mapVersion: (.+)$', graph, re.M)[1], path_version=re.search(r'^  pathVersion: (.+)$', graph, re.M)[1],
        exhibition_ready=False, coordinate_system='Unity world metres [x,y,z]; server identity transform; Y up',
        source=SCENE.relative_to(ROOT).as_posix(), source_sha256=hashlib.sha256(source).hexdigest(), layout_sha256=layout_hash,
        layout_file_sha256=hashlib.sha256(layout_bytes).hexdigest(),
        nodes=nodes, edges=edges)

def export():
    graph = read_graph()
    assert graph['map_version'] == 'test-only-city-rebuild-v002-phase1-v1'
    assert graph['path_version'] == 'city-rebuild-v002-walk-phase1-v1'
    return json.dumps(graph, ensure_ascii=False, indent=2) + '\n'

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    result = export()
    if args.check: assert OUTPUT.read_text() == result, 'Graph export is stale'
    else: OUTPUT.write_text(result, encoding='utf-8', newline='\n')
    print(('Checked' if args.check else 'Exported') + ' Phase 1 graph; legacy graph file preserved; runtime and physical access unverified')
