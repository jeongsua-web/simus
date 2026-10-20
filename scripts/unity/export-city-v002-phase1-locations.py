#!/usr/bin/env python3
"""Prepare the eight DRAFT mappings from saved scene evidence; not physical/runtime QA."""
from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[2]
SCENE = 'unity/Assets/SIMUS/Scenes/city_rebuild_v002/CityRebuild_v002.unity'
GRAPH = 'web/src/lib/data/city-rebuild-v002-phase1-graph.json'
EVIDENCE = 'docs/placement/phase1/unity-spatial-preparation.json'
OUTPUT = 'web/src/lib/data/city-v002-phase1-event-locations.json'


def sha(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


def main():
    evidence = json.loads((ROOT / EVIDENCE).read_text(encoding='utf-8'))
    graph = json.loads((ROOT / GRAPH).read_text(encoding='utf-8'))
    if evidence['source_scene_sha256'] != sha(SCENE) or graph['source_sha256'] != sha(SCENE):
        raise ValueError('Saved spatial evidence and graph must match the current scene')
    if {p['situation_code'] for p in evidence['places']} != {
        f'EXHIBITION_{n:02}' for n in (2, 5, 7, 13, 17, 18, 28, 30)
    } or len(evidence['places']) != 8:
        raise ValueError('Only the eight Phase 1 situations are supported')
    locations = []
    for place in evidence['places']:
        anchor = place['anchor_node_id']
        index = next(i for i, node in enumerate(graph['nodes']) if node['id'] == anchor)
        point = graph['nodes'][index]['position']
        if point != place['position']:
            raise ValueError(f'Spatial record and graph node differ: {anchor}')
        edge = place['source_edge_id']
        if edge is None:
            edge = next(e['id'] for e in graph['edges']
                        if e['id'].startswith('X_GATE_') and index in (e['from'], e['to']))
        locations.append(dict(
            situation_code=place['situation_code'], place_id=place['place_id'],
            point=point, radius_m=place['radius_m'], approach_node_id=anchor,
            approach_path_id=edge, scene_object_path=place['asset_scene_path'],
            source_evidence=dict(path=EVIDENCE, coordinate_basis=place['coordinate_basis'],
                                 radius_basis=place['radius_basis'], object_position=place['object_position'],
                                 object_distance_xz_m=place['object_distance_xz_m'],
                                 physical_access_verified=False)))
    result = dict(schema_version=1, map_version=graph['map_version'], path_version=graph['path_version'],
                  exhibition_ready=False, status='IMPLEMENTED_AWAITING_QA',
                  source_scene=dict(path=SCENE, sha256=sha(SCENE)),
                  source_graph=dict(path=GRAPH, sha256=sha(GRAPH)), locations=locations)
    (ROOT / OUTPUT).write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n',
                               encoding='utf-8', newline='\n')
    print('Prepared eight DRAFT mappings. Physical access, QA and runtime operation remain unverified.')


if __name__ == '__main__':
    main()
