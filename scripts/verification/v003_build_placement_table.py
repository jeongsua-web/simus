#!/usr/bin/env python3
"""Rebuild documented placement facts from saved scene, retaining planned route status."""
import csv,json,pathlib,hashlib
from v003_scene_placement import read_scene,ROOT,SCENE
map_version='city-masterplan-v003-local-v1';path_version='city-masterplan-v003-plaza30-v1'
ts=read_scene(); byname={t['name']:t for t in ts}
plan=list(csv.DictReader((ROOT/'docs/planning/city_masterplan_v003/events.csv').open(encoding='utf-8-sig')))
inv={x['id']:x for x in json.loads((ROOT/'assets/library/maps/city_masterplan_v003/reports/event_places/event_inventory.json').read_text())}
routes=json.loads((ROOT/'docs/planning/city_masterplan_v003/routes.json').read_text());edges={e['id']:e for e in routes['edges']}
followups={1:'종이 제거 토글·줍기 클립',2:'보행 신호 주기·적색 대기·횡단 차단/해제',3:'지갑 줍기/반환·주인 NPC',4:'대기열 NPC·새치기/복귀 이동·버스 정차',5:'울음/진정 아이 NPC·보호자 합류',6:'음악 NPC·음원 볼륨 전환·대화',7:'불법 주차 차량 collider·합법 주차 위치 이동',8:'카페 문/실내 경로·계산원 NPC·잔돈 전달',9:'지하철 계단 경사·고령자 NPC·앉기/양보; 운행 열차 구현 아님',10:'친구 NPC·부정행위 선택 연출; 현재 야외 학습자리',11:'미화원 NPC·혼합 쓰레기/정리 상태 전환·분류 애니메이션',12:'도보/택시 선택 후 이동 분기·택시 승차',13:'꽃밭 진입 금지 collider·바깥 사진 촬영 포즈',14:'물 접근 안전 경계·폐병 수거 상태·수거 동작',15:'카페 실내 경로·컵 선택/교체·계산원 NPC',16:'짐 운반자/도우미 NPC·상자 내려놓기/공동 운반',17:'자원봉사 NPC·신청서 등록·축제 대기행동',18:'고양이 NPC·급식/Eat 호환·먹이 상태 전환',19:'화장실 문/실내 경로·휴지 줍기/제거',20:'주민 NPC·삽질/식재·묘목 상태',21:'시민 2명·경찰 NPC·언쟁/중재/진정',22:'친구 NPC·대화 상태 제어',23:'식당 문/실내 경로·직원/손님 NPC·음식 교체/서빙',24:'금지 경계 collider·허용 우회 경로 분기',25:'범죄자/점주 NPC·목격/신고/반환 행동',26:'정전 스위치·가로등/전기함/노출 조명 상태 전환',27:'침수 토글·수면/통행 차단·배수 후 경로 재개',28:'통제 collider·바리케이드 우회 경로/안내',29:'경보 오디오/경광등 토글·대피 NPC 경로',30:'대표 로컬 서버 이동/정지/선택/재개 검증; 상자 열림/신고 전용 애니메이션은 별도'}
def j(x):return json.dumps(x,ensure_ascii=False,separators=(',',':'))
local_route=json.loads((ROOT/'docs/content/v003-local-route.json').read_text()) if (ROOT/'docs/content/v003-local-route.json').exists() else None
validation_path = ROOT / 'docs/verification/v003-local-play-validation.json'
play_validation = json.loads(validation_path.read_text()) if validation_path.exists() else {}
rows=[]
for p in plan:
 n=int(p['event_number']);pre='FULL_EVENT_%02d_'%n;env=byname['EVS_%02d'%n]
 children=[t for t in ts if t['path'].startswith(env['path']+'/')]
 r={'situation_code':p['event_code'],'title':p['event_name'],'map_version':map_version,'path_version':path_version if n==30 else '', 'unity_object_path':env['path'],'world_xyz_m':j(env['world_xyz']),'position_status':'SAVED_SCENE_TRANSFORM','start_object_path':byname[pre+'START']['path'],'start_world_xyz_m':j(byname[pre+'START']['world_xyz']),'interaction_object_path':byname[pre+'INTERACT']['path'],'interaction_world_xyz_m':j(byname[pre+'INTERACT']['world_xyz']),'interaction_point_status':'SAVED_SCENE_MARKER_NOT_GAMEPLAY_VALIDATED','interaction_radius_m':'','candidate_interaction_radius_m':p['radius_m'],'radius_evidence':'events.csv candidate; runtime radius not confirmed','npc_wait_world_xyz_m':j(byname[pre+'NPC_WAIT']['world_xyz']),'exit_world_xyz_m':j(byname[pre+'EXIT']['world_xyz']),'candidate_approach_edge_ids':p['approach_route'],'candidate_exit_edge_ids':p['exit_route'],'approach_status':'PLANNING_GRAPH_CANDIDATE_NOT_PLAY_VALIDATED','verified_approach_waypoints':'','verified_resume_waypoints':'','region_code':'','candidate_region_code':p['zone'],'region_status':'PLANNING_ZONE_ONLY_NO_APPROVED_BOUNDARY','required_npc':p['required_npc'],'existing_environment':inv[n]['environment'],'scene_descendant_object_count':len(children),'required_asset_keys':p['required_assets'],'required_animations':p['animations'],'additional_runtime_work':followups[n]+'; 서버 시작/도착/선택/결과 확인 계약과 각 경로 바닥/충돌/재개 검증','placement_table_status':'COMPLETE_DOCUMENTED','play_validation_status':'NOT_TESTED','evidence':'saved Unity scene transform hierarchy + events.csv candidate; historical supplier reports not current runtime proof'}
 r.update({'runtime_interaction_world_xyz_m':j(local_route['interaction']['point']) if n==30 and local_route else '', 'runtime_interaction_radius_m':local_route['interaction']['radius_m'] if n==30 and local_route else '', 'runtime_start_world_xyz_m':j(local_route['points'][0]) if n==30 and local_route else '', 'runtime_approach_waypoints':j(local_route['points']) if n==30 and local_route else '', 'runtime_resume_waypoints':j(local_route['resume_points']) if n==30 and local_route else '', 'runtime_route_status':local_route.get('validation_status','') if n==30 and local_route else '', 'runtime_route_evidence':'docs/content/v003-local-route.json; Unity physics/browser proof tracked separately' if n==30 else ''})
 r.update({
  'facing_degrees': '',
  'approach_path_id': local_route['path_version'] if n == 30 and local_route else '',
  'asset_key': 'city_masterplan_v003_event_places',
  'physics_validation_status': 'NOT_TESTED',
  'physics_validation_evidence': '',
  'api_validation_status': 'NOT_TESTED',
  'api_validation_evidence': '',
  'browser_validation_status': 'NOT_TESTED',
  'browser_validation_evidence': '',
 })
 if n == 30 and local_route:
  physics_path = ROOT / 'docs/verification/v003-local-physics.json'
  if physics_path.exists():
   physics = json.loads(physics_path.read_text())
   if physics.get('passed') and physics.get('source_scene_sha256') == local_route['source_scene_sha256']:
    audited_points = [sample['point'] for sample in physics['samples']]
    matched_points = all(any(max(abs(a-b) for a,b in zip(point, sample)) < 0.0001 for sample in audited_points) for point in local_route['points'])
    if matched_points:
     r['physics_validation_status'] = 'PASS'
     r['physics_validation_evidence'] = str(physics_path.relative_to(ROOT))
     r['verified_approach_waypoints'] = j(local_route['points'])
     r['verified_resume_waypoints'] = j(local_route['resume_points'])
  matches_route = (
   play_validation.get('map_version') == local_route['map_version']
   and play_validation.get('path_version') == local_route['path_version']
   and play_validation.get('source_scene_sha256') == local_route['source_scene_sha256']
   and play_validation.get('route_points') == local_route['points']
  )
  if matches_route:
   for check in ('api', 'browser'):
    result = play_validation.get(check, {})
    r[check + '_validation_status'] = result.get('status', 'NOT_TESTED')
    r[check + '_validation_evidence'] = result.get('evidence', '')
  verified = all(r[check + '_validation_status'] == 'PASS' for check in ('physics', 'api', 'browser'))
  r['play_validation_status'] = 'PASS_REPRESENTATIVE_LOCAL' if verified else 'PARTIAL_SEE_SEPARATE_VALIDATION_COLUMNS'
 rows.append(r)
out=ROOT/'docs/content/v003-event-placement.csv'
with out.open('w',encoding='utf-8-sig',newline='') as f:
 w=csv.DictWriter(f,fieldnames=list(rows[0]),lineterminator='\n');w.writeheader();w.writerows(rows)
chosen=[t for t in ts if t['name'].startswith('FULL_EVENT_') or t['name'] in ['EVS_%02d'%i for i in range(1,31)] or t['name'] in ['CITY_MASTERPLAN_V003','SIMUS_EVENT_PLACES']]
(ROOT/'docs/verification/v003-scene-transforms.json').write_text(json.dumps({'scene':SCENE,'scene_sha256':hashlib.sha256((ROOT/SCENE).read_bytes()).hexdigest(),'transforms':chosen},ensure_ascii=False,indent=2)+'\n')
print('Documented', len(rows), 'placements with independent physics/API/browser statuses')
