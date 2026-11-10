#!/usr/bin/env python3
"""Author the reviewable Phase 2 manifest from SAVED placement/graph evidence.

Only writes JSON. Does not launch Unity, run QA, contact a DB or change geometry.
Projection locates a candidate ON an existing edge; it never extends that edge.
"""
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GRAPH = ROOT / 'web/src/lib/data/city-rebuild-v002-phase1-graph.json'
PLACEMENT = ROOT / 'docs/placement/city-v002-event-placement-results.json'
graph = json.loads(GRAPH.read_text())
instances = {v['id']: v for v in json.loads(PLACEMENT.read_text())['instances']}
content = json.loads((ROOT / 'web/src/lib/data/initial-session-content.json').read_text())
nodes = {v['id']: v['position'] for v in graph['nodes']}
phase1 = json.loads((ROOT / 'web/src/lib/data/city-v002-phase1-event-locations.json').read_text())
baseline = {int(v['situation_code'].rsplit('_', 1)[1]): v for v in phase1['locations']}


def project(point):
    candidates = []
    for edge in graph['edges']:
        for a, b in zip(edge['points'], edge['points'][1:]):
            delta = [y-x for x, y in zip(a, b)]
            length2 = sum(v*v for v in delta)
            t = max(0, min(1, sum((p-v)*d for p, v, d in zip(point, a, delta))/length2)) if length2 else 0
            at = [v+t*d for v, d in zip(a, delta)]
            candidates.append((math.dist(point, at), edge['id'], at))
    gap, edge_id, at = min(candidates)
    return {'point': at, 'edge_id': edge_id, 'reference_point': point, 'gap_m': gap}


def instance(name, reference=None):
    # Object coordinates are evidence, NOT event coordinates. All authored
    # candidates are projections on the actual server graph.
    at = reference or [instances[name]['position'][0], .16, instances[name]['position'][2]]
    return name, project(at), f'SIMUS_EventPlacement_20261020/{name}'


def node(name):
    return name, {'point': nodes[name], 'node_id': name, 'gap_m': 0}, name


ready = {2, 5, 7, 10, 12, 13, 16, 17, 18, 22, 28, 30}
places = {
    1: instance('ENV_Bin_BusStop'),
    2: instance('ENV_PedSignal_Gate_N'),
    3: instance('ENV_MysteryCrate_Plaza'),
    4: instance('ENV_BusStop_R01', [54, .16, -55]),  # wrapper origin is NOT the stop
    5: instance('NPC_CryingChild_ParkSouth'),
    6: node('PARK_REST_2'),
    7: instance('VEH_IllegalParked_R05'),
    # +Z Unity is the documented frontage, door_x comes from model.json.
    # These are exterior approach references 1m beyond SAVED renderer bounds.
    # No exact doorway or continuous pavement is claimed by this projection.
    8: instance('ENV_Cafe_EastCommercial', [142.7, .16, -68]),
    9: ('ENV_Subway_Entrance_SurfaceOnly', None, 'SIMUS_EventPlacement_20261020/ENV_Subway_Entrance_SurfaceOnly'),
    10: node('C04_ACCESS'),
    11: instance('ENV_Recycle_SouthHousing'),
    12: instance('ENV_Bin_BusStop'),
    13: instance('ENV_Flowerbed_ParkNorth'),
    14: node('RIVER_E_30'),
    15: instance('ENV_Cafe_EastCommercial', [142.7, .16, -68]),
    16: instance('NPC_HeavyCarrier_ApartmentWalk', [-186.85, .16, (124.355+101.0738)/2]),
    17: instance('ENV_Festival_Info_Plaza'),
    18: node('PARK_REST_2'),
    19: instance('ENV_PublicToilet_ParkNorth', [158, .16, 134.354172]),
    20: node('PARK_REST_2'),
    21: instance('ENV_MysteryCrate_Plaza'),
    22: node('C04_ACCESS'),
    23: instance('ENV_Restaurant_EastCommercial', [150.2, .16, -89.45]),
    24: node('PARK_REST_2'),
    25: node('B04_ACCESS'),
    26: node('B04_ACCESS'),
    27: instance('ENV_Barricade_R01_Control'),
    28: instance('ENV_Barricade_R01_Control'),
    29: node('B04_ACCESS'),
    30: instance('ENV_MysteryCrate_Plaza'),
}
reasons = {
    1: '도로/쓰레기통 접근점은 있으나 떨어진 쓰레기 표현 근거 없음. 장소 후보만 기록.',
    2: '정문 횡단보도 북쪽 신호등 앞 기존 보도. 신호 주기/교통 제어는 구현하지 않음.',
    3: '광장 접근 가능. 떨어진 지갑 미배치.',
    4: '정류장 bounds 앞 보도 접근 가능. 대기 줄/새치기 상황 미표현.',
    5: '기존 공원 길에서 저장된 우는 아이를 만나는 접근점. 울음 실제 재생은 승인 후 확인 필요.',
    6: '공원 접근 가능. 음악 재생자/음원 상황 미표현.',
    7: '기존 R05 보도에서 불법 주차 차량 옆 접근. 통과 여유는 승인 후 확인 필요.',
    8: '카페 북쪽 전면/door_x 근거의 외부 접근 후보. 연결된 포장/실제 출입구까지의 경로 근거가 없어 그래프를 연장하지 않음.',
    9: '지상 출입구만 존재. 객실/좌석/내부 보행 경로 없음. 지상 좌표로 대체하지 않음.',
    10: '캠퍼스 학교 건물 C04의 기존 접근 노드. 대화형 원문은 기존 모바일 UI 사용.',
    11: '분리수거 시설 접근점 있음. 엉망인 쓰레기 상태의 배치 근거 없음.',
    12: '일반 도로 R01의 기존 보도. 근거리 이동 선택 문맥을 모바일에 표시.',
    13: '북쪽 공원 꽃밭 옆 기존 산책로. 남쪽 꽃밭의 먼 접근점 대신 가까운 북쪽 시설 사용.',
    14: '실제 하천 산책로 접근점 있음. 하천 쓰레기 누적 상황 표현 근거 없음.',
    15: '카페 #08과 동일한 접근성 문제. 임의의 먼 지점을 카페 도착으로 처리하지 않음.',
    16: '기록된 짐 운반자 왕복 구간의 중간 접근점. 빌더에서 환경 NPC를 삭제하던 처리도 보호.',
    17: '광장 안내 축제 부스의 기존 보행 접근점. 모집 내용은 원문 모바일 선택지 사용.',
    18: 'Phase 1의 CAT_Tuxedo_EastPark 배치와 접근점을 그대로 재사용. 이전 39개 배치 보고서 이후 추가된 기존 고양이이며 신규 제작 없음.',
    19: '화장실 외관만 존재. 실내 바닥/떨어진 휴지/실내 접근 경로 근거 없음.',
    20: '공원 녹지는 있으나 주민들의 나무 심기 상황 미표현.',
    21: '광장 접근 가능. 싸우는 두 사람 상황 미표현.',
    22: '학교 C04 접근점 공유. 비밀 대화는 기존 모바일 원문 사용, 잔류 중 연속 발생 금지.',
    23: '식당 북쪽 전면/door_x 근거의 외부 접근 후보. 연속 포장/실제 출입구 경로 근거 없음. 그래프 연장 보류.',
    24: '공원 접근 가능하나 금지구역/울타리/제한 표식이 실제 해당 구역에 있다는 근거 없음.',
    25: '상가 B04 외부 접근점은 있음. 광장 범죄자 NPC는 상점 절도 행위의 근거가 아님.',
    26: '건물 외부 접근점은 있음. 정전/CCTV 중단 상황 미표현.',
    27: '도로 옆 접근점은 있음. 도로 침수 상황 없음. 기존 하천/범람원 이름은 도로 침수 증거가 아님.',
    28: 'R01 바리케이드/콘을 보는 남쪽 기존 보도 접근점. 도로를 통과하는 경로를 새로 만들지 않음.',
    29: '건물 외부 접근점은 있음. 실제 화재경보 상황 미표현.',
    30: '광장 상자 남쪽 기존 C_PARK 보행선. 모델 중심 대신 3m 떨어진 길 위에서 발생.',
}
rows = []
for situation in content['situations']:
    n = situation['number']
    place_id, approach, scene_path = places[n]
    if n in baseline:
        previous = baseline[n]
        place_id, scene_path = previous['place_id'], previous['scene_object_path']
        approach = {'point': previous['point'], 'node_id': previous['approach_node_id'],
                    'edge_id': previous['approach_path_id'], 'gap_m': previous['source_evidence']['object_distance_xz_m'],
                    'source_evidence': previous['source_evidence']}
    location = None if approach is None else {
        'map_version': graph['map_version'], 'place_id': place_id,
        'point': approach['point'], 'radius_m': baseline[n]['radius_m'] if n in baseline else 2,
    }
    rows.append({
        'number': n, 'code': f'EXHIBITION_{n:02}',
        'seed_situation_id': f'30000000-0000-0000-0000-{n:012}',
        'title': situation['title'], 'place_id': place_id, 'scene_path': scene_path,
        'status': 'READY' if n in ready else ('BLOCKED_ACCESS' if n in {8, 15, 23} else 'BLOCKED_SCENE'),
        'reason': reasons[n], 'candidate_location': location,
        'event_location': location if n in ready else None, 'approach_evidence': approach,
        'phase1_baseline': 'PRESERVED_7ac43f0' if n in baseline else 'ADDED_PHASE2',
        'physical_access_verified': False,
    })
result = {
    'schema_version': 1, 'mapping_version': 'city-v002-events-phase2-v1',
    'map_version': graph['map_version'], 'path_version': graph['path_version'],
    'exhibition_ready': False, 'qa_executed': False,
    'phase1_report_available': True, 'phase1_source_commit': '7ac43f0',
    'policy': 'Only READY rows may be enabled; preserve every existing location; candidates are not active mappings.',
    'graph_source': str(GRAPH.relative_to(ROOT)),
    'graph_sha256': hashlib.sha256(GRAPH.read_bytes()).hexdigest(),
    'placement_source': str(PLACEMENT.relative_to(ROOT)),
    'placement_sha256': hashlib.sha256(PLACEMENT.read_bytes()).hexdigest(),
    'events': rows,
}
output = ROOT / 'web/src/lib/data/city-v002-event-mapping.json'
output.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
print(f'Generated {output.relative_to(ROOT)}: 30 attempts, {len(ready)} ready, {30-len(ready)} blocked; no QA/DB changes.')
