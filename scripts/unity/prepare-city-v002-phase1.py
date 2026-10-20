#!/usr/bin/env python3
"""Apply the approved, narrowly scoped Phase 1 serialized scene preparation.

This writes scene data and design evidence. It does not launch Unity, run QA,
simulate physics, run tests, build players, or claim physical accessibility.
The separate graph exporter then reads the saved scene as its source of truth.
"""
import copy
import hashlib
import json
import math
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
SCENE = ROOT / 'unity/Assets/SIMUS/Scenes/city_rebuild_v002/CityRebuild_v002.unity'
LEGACY = ROOT / 'web/src/lib/data/city-rebuild-v002-graph.json'
OUT = ROOT / 'docs/placement/phase1'
ROLE_GUID = 'e1c6c9061af94b80b836cd7793216109'
PLACE_GUID = '6cb72964b68c4de89e468fb081ab6fd2'
MAP = 'test-only-city-rebuild-v002-phase1-v1'
PATH = 'city-rebuild-v002-walk-phase1-v1'


def rounded(p):
    return [round(v, 6) for v in p]


def vec(p):
    return '{x: %s, y: %s, z: %s}' % tuple(format(v, '.9g') for v in p)


def main():
    original = SCENE.read_bytes()
    text = original.decode('utf-8').replace('\r\n', '\n')
    if 'SIMUS_Phase1_Places' in text:
        raise RuntimeError('Phase 1 is already serialized. Refusing to overwrite subsequent edits.')
    graph = copy.deepcopy(json.loads(LEGACY.read_text(encoding='utf-8')))
    blocks = {fid: (kind, body) for kind, fid, body in re.findall(r'^--- !u!(\d+) &(-?\d+).*?\n(.*?)(?=^--- !u!|\Z)', text, re.M | re.S)}
    graph_id, = [fid for fid, (_, body) in blocks.items() if 'guid: 5f84dae63db8441aaa9c70292df1bf56,' in body]
    graph_body = blocks[graph_id][1]
    # Derive the working graph from the saved scene rather than trusting a stale
    # report or inventing an exhibition coordinate transform.
    node_text, edge_text = graph_body.split('  nodes:\n')[1].split('  edges:\n')
    def parse_vec(s):
        return [float(re.search(rf'{a}: ([^,}}]+)', s)[1]) for a in 'xyz']
    graph['nodes'] = [{'id': name, 'position': parse_vec(raw)} for name, raw in re.findall(r'  - id: (\S+)\n    position: (.*)', node_text)]
    graph['edges'] = []
    for raw in re.split(r'(?=^  - id: )', edge_text, flags=re.M):
        if not raw.strip():
            continue
        def field(name):
            return re.search(rf'^    {name}: (.*)$', raw, re.M)[1]
        graph['edges'].append({'id': re.search(r'  - id: (\S+)', raw)[1], 'kind': field('kind'),
            'from': int(field('from')), 'to': int(field('to')), 'width': float(field('width')),
            'points': [parse_vec(v) for v in re.findall(r'^    - (\{.*\})$', raw, re.M)]})
    base_graph = copy.deepcopy(graph)
    edges = {e['id']: e for e in graph['edges']}
    changes = []

    def offset_detour(edge_id, centre, offset, plateau, transition, width, mesh):
        edge = edges[edge_id]
        a, b = edge['points']
        length = math.dist(a, b)
        tangent = [(b[j] - a[j]) / length for j in range(3)]
        normal = [-tangent[2], 0, tangent[0]]
        s = sum((centre[j] - a[j]) * tangent[j] for j in range(3))
        def at(along, amount):
            return rounded([a[j] + along * tangent[j] + normal[j] * amount for j in range(3)])
        anchor = at(s, offset)
        edge['points'] = [a, at(s - plateau - transition, 0), at(s - plateau, offset),
                          anchor, at(s + plateau, offset), at(s + plateau + transition, 0), b]
        edge['width'] = width
        changes.append({'edge_id': edge_id, 'old_points': [a, b], 'new_points': copy.deepcopy(edge['points']),
            'offset_m': offset, 'usable_width_m': width, 'existing_floor_mesh': mesh,
            'basis': 'Existing serialized MeshCollider mesh vertices; offset stays within that original paved strip. Physics not executed.'})
        return anchor

    illegal = offset_detour('R05LE00_S1', [-143, .16, -7.9], .4, 4, 2, 1.0, 'meshes/surface_0078.asset')
    flowers = offset_detour('PKE03_S0', [155.25121951219512, .16, 126.4609756097561], .7, 3, 2, 1.0, 'meshes/surface_0119.asset')
    festival = offset_detour('C07_LINK_S1', [12.196752671649179, .16, 103.35038350440448], .7, 3, 2, 1.0, 'meshes/surface_0146.asset')
    bus = edges['R01LE03_S0']
    a, b = bus['points']
    bus['points'] = [a, [43, .16, -56.25], [45, .16, -56.65], [63, .16, -56.65], [65, .16, -56.25], b]
    bus['width'] = 2.0
    changes.append({'edge_id': bus['id'], 'old_points': [a, b], 'new_points': copy.deepcopy(bus['points']),
        'offset_m': .4, 'usable_width_m': 2, 'existing_floor_mesh': 'meshes/surface_0025.asset',
        'basis': 'Existing MeshCollider rectangle y=.14, z=-57.75..-54.75. New route stays on it, south of recorded stop bounds. Physics not executed.'})

    placements = json.loads((ROOT / 'docs/placement/city-v002-event-placement-results.json').read_text(encoding='utf-8'))
    placement_by_id = {p['id']: p for p in placements['instances']}
    specs = [
        ('02', 'city_v002_gate_crossing', 'MN_GATE', [0, .16, -56.25], None, 'ENV_PedSignal_Gate_N'),
        ('05', 'city_v002_crying_child', None, rounded([147.1583452211127, .16, 26.37660485021398]), 'PKE06_S0', 'NPC_CryingChild_ParkSouth'),
        ('07', 'city_v002_illegal_parking', None, illegal, 'R05LE00_S1', 'VEH_IllegalParked_R05'),
        ('13', 'city_v002_park_flowerbed', None, flowers, 'PKE03_S0', 'ENV_Flowerbed_ParkNorth'),
        ('17', 'city_v002_festival_info', None, festival, 'C07_LINK_S1', 'ENV_Festival_Info_Plaza'),
        ('18', 'city_v002_park_cat', None, rounded([158.2596843615495, .16, 50.83931133428982]), 'PKE05_S0', 'CAT_Tuxedo_EastPark'),
        ('28', 'city_v002_road_control', None, [86, .16, -65.75], 'R01RE03_S0', 'ENV_Barricade_R01_Control'),
        ('30', 'city_v002_mystery_crate', None, [15, .16, 115], 'C_PARK_S0', 'ENV_MysteryCrate_Plaza'),
    ]
    places = []
    for code, place_id, existing_node, point, edge_id, asset in specs:
        node_id = existing_node or 'PHASE1_EXHIBITION_' + code
        if edge_id:
            edge = edges[edge_id]
            best = None
            for index, (a, b) in enumerate(zip(edge['points'], edge['points'][1:])):
                delta = [b[j] - a[j] for j in range(3)]
                length2 = sum(v*v for v in delta)
                t = max(0, min(1, sum((point[j] - a[j])*delta[j] for j in range(3)) / length2)) if length2 else 0
                q = [a[j] + t*delta[j] for j in range(3)]
                candidate = (math.dist(q, point), index)
                if best is None or candidate < best:
                    best = candidate
            if best[0] > .00001:
                raise RuntimeError('Authored anchor is not on its exact source polyline: ' + place_id)
            split = best[1]
            index = len(graph['nodes'])
            graph['nodes'].append({'id': node_id, 'position': point})
            continuation = dict(edge, id=edge_id + '_PHASE1_CONTINUATION', **{'from': index}, points=[point] + edge['points'][split+1:])
            # Avoid adjacent duplicate endpoints when the point was already a
            # detour control point. No zero-distance teleport edges are added.
            def dedupe(points):
                return [p for i, p in enumerate(points) if i == 0 or math.dist(p, points[i-1]) > .000001]
            continuation['points'] = dedupe(continuation['points'])
            edge['points'] = dedupe(edge['points'][:split+1] + [point])
            edge['to'] = index
            graph['edges'].append(continuation)
        asset_position = [156, -.012, 50] if asset == 'CAT_Tuxedo_EastPark' else placement_by_id[asset]['position']
        places.append({'situation_code': 'EXHIBITION_' + code, 'place_id': place_id, 'anchor_node_id': node_id,
            'position': point, 'radius_m': 1.5, 'source_edge_id': edge_id,
            'asset_scene_path': asset if asset == 'CAT_Tuxedo_EastPark' else 'SIMUS_EventPlacement_20261020/' + asset,
            'object_position': asset_position, 'object_distance_xz_m': math.hypot(point[0]-asset_position[0], point[2]-asset_position[2]),
            'status': 'draft_only', 'physical_access_verified': False,
            'coordinate_basis': 'Saved scene world transform and existing graph projection; selected route points use existing serialized floor mesh geometry.',
            'radius_basis': 'A 1.5m along-route approach window around the anchor, not certification of object interaction or a physical trigger.'})

    new_graph_body = graph_body.split('  nodes:\n')[0]
    new_graph_body += f'  mapVersion: {MAP}\n  pathVersion: {PATH}\n  nodes:\n'
    for n in graph['nodes']:
        new_graph_body += f"  - id: {n['id']}\n    position: {vec(n['position'])}\n"
    new_graph_body += '  edges:\n'
    for e in graph['edges']:
        new_graph_body += f"  - id: {e['id']}\n    kind: {e['kind']}\n    from: {e['from']}\n    to: {e['to']}\n    width: {e['width']}\n    points:\n"
        new_graph_body += ''.join('    - ' + vec(p) + '\n' for p in e['points'])
    text = text.replace(graph_body, new_graph_body, 1)

    # Explicit NPC ownership is attached to existing actor roots. This is data
    # only: no character model, motion, animator or participant identity changes.
    role_names = {'Test NPC - Happiness 01': 1,
        'NPC_SIMUS_CityCitizen_1': 2, 'NPC_SIMUS_CityCitizen_2': 2, 'NPC_HeavyCarrier_ApartmentWalk': 2,
        'NPC_CryingChild_ParkSouth': 2, 'NPC_Police_Gate': 2, 'NPC_Criminal_PlazaEdge': 2,
        'GraphProbe_school_residential': 3, 'GraphProbe_school_park': 3, 'GraphProbe_residential_commerce': 3,
        'river_east_roundtrip': 3, 'river_west_roundtrip': 3, 'river_bridge_to_park': 3}
    appended = ''
    for index, (name, role) in enumerate(role_names.items()):
        go, = [fid for fid, (kind, body) in blocks.items() if kind == '1' and re.search(r'^  m_Name: (.*)$', body, re.M) and re.search(r'^  m_Name: (.*)$', body, re.M)[1] == name]
        body = blocks[go][1]
        component = 8200000000000000000 + index
        replaced = body.replace('  m_Layer:', f'  - component: {{fileID: {component}}}\n  m_Layer:', 1)
        text = text.replace(body, replaced, 1)
        appended += mono(component, int(go), ROLE_GUID, f'  role: {role}\n')

    # Surface-only subway presentation: preserve canopy, signage, tactile paving,
    # dark portal and the terrain. Hide subterranean content instead of cutting
    # an unmeasured terrain hole or presenting blocked stairs as walkable.
    subway_guid = '70af21a147d37a64ca8bf1a69f10e968'
    prefab_id, = [fid for fid, (kind, body) in blocks.items() if kind == '1001' and f'm_SourcePrefab: {{fileID: 100100000, guid: {subway_guid}, type: 3}}' in body]
    prefab_body = blocks[prefab_id][1]
    hidden = {'SUBWAY_STAIRS': 7808161511616217883, 'SUBWAY_STAIR_EDGES': 2854895308004308066,
        'SUBWAY_ESCALATOR_UP': 4960850180069999220, 'SUBWAY_ESCALATOR_DOWN': 9053357116122138407,
        'SUBWAY_UNDERGROUND_CORRIDOR': 4691692011497219216, 'COL_BOX_LOWER_LANDING': 320602226801216613,
        'COL_RAMP_STAIRS': 5119197997963640041, 'COL_RAMP_ESC_DOWN': 8696003154483811292,
        'COL_RAMP_ESC_UP': 8760979773466947042}
    mods = ''.join(f'    - target: {{fileID: {fid}, guid: {subway_guid}, type: 3}}\n      propertyPath: m_IsActive\n      value: 0\n      objectReference: {{fileID: 0}}\n' for fid in hidden.values())
    text = text.replace(prefab_body, prefab_body.replace('    m_RemovedComponents:', mods + '    m_RemovedComponents:', 1), 1)

    root_go, root_transform = 8100000000000000000, 8100000000000000001
    child_ids = [8100000000000000011 + 10*i for i in range(len(places))]
    appended += game_object(root_go, root_transform, 'SIMUS_Phase1_Places')
    appended += transform(root_transform, root_go, [0, 0, 0], 0, child_ids)
    for i, place in enumerate(places):
        go, tf, comp = 8100000000000000010 + i*10, child_ids[i], 8100000000000000012 + i*10
        appended += game_object(go, tf, place['place_id'], comp)
        appended += transform(tf, go, place['position'], root_transform, [])
        appended += mono(comp, go, PLACE_GUID, f"  placeId: {place['place_id']}\n  situationCode: {place['situation_code']}\n  graphNodeId: {place['anchor_node_id']}\n  radius: 1.5\n  physicalAccessVerified: 0\n")
    roots_marker = '--- !u!1660057539 &9223372036854775807\n'
    text = text.replace(roots_marker, appended + roots_marker, 1)
    text += f'  - {{fileID: {root_transform}}}\n'
    updated = text.encode('utf-8')
    SCENE.write_bytes(updated)
    OUT.mkdir(parents=True, exist_ok=True)
    evidence = {'scope': 'Serialized scene preparation; not Unity load/physics/QA/runtime verification',
        'map_version': MAP, 'path_version': PATH, 'source_scene': str(SCENE.relative_to(ROOT)),
        'source_scene_before_sha256': hashlib.sha256(original).hexdigest(), 'source_scene_sha256': hashlib.sha256(updated).hexdigest(),
        'legacy_graph_sha256': hashlib.sha256(LEGACY.read_bytes()).hexdigest(),
        'node_count': len(graph['nodes']), 'edge_count': len(graph['edges']), 'places': places,
        'route_adjustments': changes, 'npc_roles': role_names, 'subway_hidden_scene_overrides': hidden,
        'not_implemented': ['Cafe/restaurant connectors: no current Unity collider/support measurements available.',
            'Signal pole/overhead-arm collision disambiguation requires Unity inspection.',
            'No underground entry, terrain cuts, runtime place triggers or new NPC AI.'],
        'unity_load': 'NOT VERIFIED: Editor license unavailable (exit 198)', 'physics': 'NOT RUN', 'qa': 'NOT RUN',
        'play_mode': 'NOT RUN', 'webgl_build': 'NOT RUN', 'deployment': 'NOT RUN'}
    (OUT / 'unity-spatial-preparation.json').write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    print('Serialized Phase 1 scene and design evidence; Unity load/physics/runtime remain unverified.')


def mono(fid, go, guid, fields):
    return f'''--- !u!114 &{fid}
MonoBehaviour:
  m_ObjectHideFlags: 0
  m_CorrespondingSourceObject: {{fileID: 0}}
  m_PrefabInstance: {{fileID: 0}}
  m_PrefabAsset: {{fileID: 0}}
  m_GameObject: {{fileID: {go}}}
  m_Enabled: 1
  m_EditorHideFlags: 0
  m_Script: {{fileID: 11500000, guid: {guid}, type: 3}}
  m_Name: 
  m_EditorClassIdentifier: 
{fields}'''


def game_object(go, tf, name, comp=None):
    components = f'  - component: {{fileID: {tf}}}\n' + (f'  - component: {{fileID: {comp}}}\n' if comp else '')
    return f'''--- !u!1 &{go}
GameObject:
  m_ObjectHideFlags: 0
  m_CorrespondingSourceObject: {{fileID: 0}}
  m_PrefabInstance: {{fileID: 0}}
  m_PrefabAsset: {{fileID: 0}}
  serializedVersion: 6
  m_Component:
{components}  m_Layer: 0
  m_Name: {name}
  m_TagString: Untagged
  m_Icon: {{fileID: 0}}
  m_NavMeshLayer: 0
  m_StaticEditorFlags: 0
  m_IsActive: 1
'''


def transform(tf, go, point, parent, children):
    child_text = ('  m_Children:\n' + ''.join(f'  - {{fileID: {i}}}\n' for i in children)) if children else '  m_Children: []\n'
    return f'''--- !u!4 &{tf}
Transform:
  m_ObjectHideFlags: 0
  m_CorrespondingSourceObject: {{fileID: 0}}
  m_PrefabInstance: {{fileID: 0}}
  m_PrefabAsset: {{fileID: 0}}
  m_GameObject: {{fileID: {go}}}
  serializedVersion: 2
  m_LocalRotation: {{x: 0, y: 0, z: 0, w: 1}}
  m_LocalPosition: {vec(point)}
  m_LocalScale: {{x: 1, y: 1, z: 1}}
  m_ConstrainProportionsScale: 0
{child_text}  m_Father: {{fileID: {parent}}}
  m_LocalEulerAnglesHint: {{x: 0, y: 0, z: 0}}
'''


if __name__ == '__main__':
    main()
