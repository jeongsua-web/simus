# City Rebuild v002 — Phase 5 NPC 보행 연결

2026-10-17 최종 상태: Unity 6000.3.24f1 실제 Play Mode에서 아래 4개 구역 간 경로의 왕복 이동이 모두 **PASS**다. 하천 확장까지 포함한 현재 씬은 572 nodes / 597 edges다. [실행 결과](city-rebuild-v002-navigation-runtime.json), [동일 실행 입력 해시](city-rebuild-v002-phase47-runtime-inputs.json), [Phase 7 QA](city-rebuild-v002-phase7-qa.md)를 함께 확인한다.

## 적용 범위

승인된 `docs/planning/city_rebuild_v002/layout.json`의 388개 노드, 409개 엣지와 엣지별 실제 polyline을 새 `CityV002PedestrianGraph` 컴포넌트로 복사한다. 원본 설계 JSON은 수정하지 않는다. `CityRebuildV002NavigationSetup.Apply()`는 기존 `CityRebuild_v002.unity`에 네비게이션 컴포넌트와 검증 NPC를 증분 추가한다. 도시 건물·도로를 재생성하지 않는다.

기존 `TestNpcPatrol`의 MoveTowards, 회전 속도, `NpcGrounding`, Humanoid Animator와 원본 모델을 유지한다. 새 `CityV002NpcRouteAdapter`는 경로를 Dijkstra로 선택하고 동일한 다음 waypoint를 기존 patrol의 양쪽 목적지에 제공한다. 기존 테스트의 두 지점 사이 왕복 운동을 연속 graph waypoint 이동으로 확장하며 기존 이동 스크립트 자체는 변경하지 않는다. 목적지는 NPC의 자식으로 두지 않아 이동 중 목표점이 움직이는 문제를 방지한다. 보도 아래의 도시 지면 collider 때문에 기존 grounding의 nearest-height 규칙이 연석을 오를 때 하부 지면을 선택할 수 있어, v002 adapter가 이동 전 그래프의 보행면 기준 높이 0.16m를 제공한다. 최종 실제 지면 높이는 기존 NpcGrounding의 LateUpdate 투영으로 결정한다. 원본 NpcGrounding 코드는 변경하지 않는다.

이 코드는 전시 서버의 최종 경로나 상황 30개 배치를 확정하지 않는다. NPC 이벤트 로직과 90초 최대 대기 시간, 백엔드, 빌드 설정, 원본 씬은 수정하지 않는다.

## 실제 실행 검증 대상

| 검사 경로 | 출발 | 도착 | 실제 실행 상태 |
|---|---|---|---|
| 학교 ↔ 상업 | CAMPUS_PLAZA | B04_ACCESS | PASS: 실제 왕복, 도착 2회 |
| 학교 ↔ 주거 | CAMPUS_PLAZA | B16_ACCESS | PASS: 실제 왕복, 도착 2회 |
| 학교 ↔ 공원 | CAMPUS_PLAZA | PARK_REST_2 | PASS: 실제 왕복, 도착 2회 |
| 주거 ↔ 상업 | B16_ACCESS | B04_ACCESS | PASS: 실제 왕복, 도착 2회 |

학교 ↔ 상업은 원본 추적 NPC가 이동한다. 각 NPC는 목적지에 실제 도착한 뒤 동일한 waypoint를 역순으로 따라 출발지로 돌아온다. 왕복 완료 시 도착 수는 2이며 원래 길이의 두 배를 검증한다. 나머지 세 경로는 동일 FBX/Humanoid 모델 복제본이 병렬 이동한다. 기본 속도는 원본 patrol 설정 그대로다. Play Mode 검증을 가속할 경우 `Time.timeScale` 변경은 테스트 harness가 담당하며 보고서의 `maximumTimeScale`에 기록한다. 가속해도 엣지 waypoint를 건너뛰거나 도착 위치로 teleport하지 않는다. 이동은 원본 MoveTowards의 프레임 업데이트를 통해 수행한다.

검증 컴포넌트는 실제 프레임의 이동 구간을 최대 0.35m 간격으로 분할한다. 지지 지면은 downward raycast로 찾고 NPC 자체와 건물 지붕/건물 collider를 제외한다. 최종 프레임에서 root와 지지면+2cm 사이 오차가 6cm를 넘으면 FAIL이다. 건물 실제 MeshCollider와 0.2m 반경의 보행자 capsule이 겹치면 FAIL이다. 누락 지면·높이 오류·건물 관통이 한 번이라도 관찰되면 해당 경로는 FAIL로 남으며, 모든 waypoint에 실제 도착한 경로만 PASS가 가능하다.

`CityV002NavigationVerification.EvidenceJson()`의 route별 프레임 수, 지지 샘플 수, 도착 수, 실제 이동 거리, 예상 길이, simulated time, 속도, 최대 높이 오차와 최초 오류를 실제 실행 근거로 사용한다. scene SHA-256/Play Mode 실행 로그는 통합 harness 증거와 대조한다.

## 별도 미검증 항목

- NavMesh: NOT TESTED. 현재 manifest에 Unity AI Navigation/AI 모듈이 없고 bake도 없다. 검증 없는 시스템 교체를 피하고 승인된 graph를 기존 로컬 이동 방식에 연결했다. NavMesh가 정상 연결되었다고 주장하지 않는다.
- 실제 FBX 출입문·문턱 진입: NOT TESTED. B04/B16 목적지는 설계의 외부 approach anchor이다. 메쉬 출입문 좌표의 불일치 여부와 실내 진입은 별도 검증 대상이다.
- NPC 상호 회피·군중 교통 제어: NOT TESTED. 기존 MoveTowards 로컬 테스트가 제공하지 않는 기능이며 이번 adapter에서 새 이벤트/교통 로직을 도입하지 않는다.

최종 실행에서 각 경로의 누락 지면·높이 오류·실제 건물 Collider 관통 샘플은 모두 0이고 전체 waypoint와 왕복 도착을 확인했다. 테스트 시계만 20배속이며 실제 원본 이동 속도는 1.4m/s다. 가장 긴 왕복 약 968.8m를 포함한 경로 구간은 실제 벽시계 약 33.8초 동안 진행했다. 이벤트 로직 및 90초 최대 대기 시간은 변경하지 않았다. 이벤트 서버 통합 시나리오는 실행하지 않았다.

[최종 물리 검사](city-rebuild-v002-final-physics.json)는 활성 597개 edge를 35,489개 중심선 샘플로 검사해 unsupported/wet violation 0을 확인했다. 하천 근처 유효 보행 폭은 추가 7,461개 샘플과 반경 0.2m capsule로 검사해 막힘 0, 실제 교량 deck 지지 665회를 확인했다. 기존 검사 높이 허용치는 중심선 최대 0.23m, 하천 유효 폭 0.08m이며, 실제 관찰된 최대 중심선 오차는 횡단부 0.12m다. 이 검사는 실제 출입문·문턱 또는 NavMesh bake의 증거가 아니다.

기존 NPC 이동 11개와 하천 8개 EditMode 회귀 테스트도 [최종 테스트 결과](city-rebuild-v002-final-tests.xml)에서 **19/19 PASS**다. 실제 장면의 왕복 이동은 별도 Play Mode 결과를 근거로 판정했다.
