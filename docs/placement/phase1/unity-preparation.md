# Phase 1 Unity 공간 준비

상태: **씬 직렬화 및 서버용 그래프 생성 완료, Unity 로드·물리 접근성 미검증**. QA·테스트·Play Mode·WebGL 빌드·배포는 실행하지 않았다. Editor 편집 모드 측정은 Package Manager IPC 오류 후 권한을 갖춰 재시도했으나 라이선스 없음(exit 198)으로 실행되지 못했다. 소스 파일이 존재하거나 경로를 저장했다는 사실을 실행 성공으로 간주하지 않는다.

대상은 `unity/Assets/SIMUS/Scenes/city_rebuild_v002/CityRebuild_v002.unity`다. 기존 맵 구조·도로·보도 메시·원본 모델·차량 활성 상태·참가자 이동 및 이벤트 코드는 이 Unity 작업에서 바꾸지 않았다. 전시 승인이 아닌 별도 테스트 계약 `test-only-city-rebuild-v002-phase1-v1` / `city-rebuild-v002-walk-phase1-v1`을 사용한다. 기존 `city-rebuild-v002-graph.json`은 그대로 보존했다.

## 저장한 장소

정확한 위치·씬 경로·원래 그래프 간선·모델과의 XZ 거리·좌표 근거는 [공간 준비 JSON](unity-spatial-preparation.json)의 `places`에 있다. `SIMUS_Phase1_Places` 루트의 8개 Transform과 `CityV002PlaceAnchor`는 장소 식별 데이터다. Collider나 이벤트 발생 코드를 연결하지 않았다.

| 이벤트 | place_id | 그래프 노드 | Unity 좌표 (m) |
|---|---|---|---|
| 02 횡단보도 | city_v002_gate_crossing | MN_GATE | (0, 0.16, -56.25) |
| 05 울고 있는 아이 | city_v002_crying_child | PHASE1_EXHIBITION_05 | (147.158345, 0.16, 26.376605) |
| 07 불법 주차 | city_v002_illegal_parking | PHASE1_EXHIBITION_07 | (-143, 0.16, -8.3) |
| 13 꽃밭 | city_v002_park_flowerbed | PHASE1_EXHIBITION_13 | (155.90806, 0.16, 126.702969) |
| 17 축제 안내 | city_v002_festival_info | PHASE1_EXHIBITION_17 | (11.538184, 0.16, 103.113135) |
| 18 고양이 | city_v002_park_cat | PHASE1_EXHIBITION_18 | (158.259684, 0.16, 50.839311) |
| 28 도로 통제 | city_v002_road_control | PHASE1_EXHIBITION_28 | (86, 0.16, -65.75) |
| 30 상자 | city_v002_mystery_crate | PHASE1_EXHIBITION_30 | (15, 0.16, 115) |

모두 `draft_only`, `physical_access_verified=false`다. 반경 1.5m는 그래프 위 접근점 주변의 좁은 도착 구간으로 정한 초안이다. 모델과 직접 접촉하는 거리나 Physics Trigger의 검증된 크기가 아니다. 특히 아이와 접근점은 약 4.46m, 고양이와 접근점은 약 2.41m 떨어져 있으며 관찰 가능한 실제 화면 구성은 미검증이다. 고양이 모델은 기존 (156, -0.012, 50)에 그대로 있다.

## 기존 보행면 안의 부분 우회

신규 바닥을 만들지 않고 다음 간선의 일부 polyline만 옮겼다. 저장된 MeshCollider가 참조하는 메시의 실제 정점과 기존 배치 보고의 renderer bounds를 근거로 삼았다. 정점 자료는 [바닥 입력](floor-geometry-inputs.json)에 보존한다. 현장 Physics 검사나 다른 모든 소품과의 충돌 검사를 대신하지 않는다.

| 간선 | 부분 우회 | 사용 폭 | 기존 바닥 |
|---|---|---:|---|
| R05LE00_S1 | 불법 주차 차체 바깥으로 남쪽 0.4m | 1.0m | surface_0078.asset: Y=0.14, Z=-8.8..-7.0 |
| PKE03_S0 | 북공원 꽃밭 바깥으로 동쪽 법선 0.7m | 1.0m | surface_0119.asset: 기존 2.5m 공원 길 |
| C07_LINK_S1 | 축제 안내 부스 바깥으로 서쪽 법선 0.7m | 1.0m | surface_0146.asset: 기존 2.5m 캠퍼스 길 |
| R01LE03_S0 | 버스정류장 앞 X=45..63 구간에서 남쪽 0.4m | 2.0m | surface_0025.asset: Y=0.14, Z=-57.75..-54.75 |

진입·복귀 구간을 같은 보행면 안에 두고 끝점은 보존했다. 장소 접근점 7개에서 간선을 분할하여 새 그래프는 579개 노드와 604개 간선이다. 정문은 기존 `MN_GATE`를 재사용한다. 신호등의 렌더러 bounds에는 높은 팔 부분도 포함되므로 지상의 실제 막힘을 구분할 수 없어 신호등 주변 경로는 추가 변경하지 않았다.

## NPC와 빌더

`CityV002NpcBuildRole`로 참가자 템플릿 1개, 환경 NPC 6개, 테스트 NPC 6개를 구별했다. 템플릿은 기존 `Test NPC - Happiness 01`이며, 첫 Patrol을 임의로 고르는 방식을 제거했다. 역할 없는 Patrol/route adapter는 추정 삭제 대신 빌드를 중단한다.

session 빌더는 참가자 템플릿만 비활성 복제용으로 바꾸고 테스트 NPC만 제거한다. 시민 2명·짐 운반자의 Patrol·Grounding·Animator는 보존한다. 경찰·아이·수상한 NPC·고양이도 삭제하지 않는다. 빌드 스크립트의 분기만 수정했으며 실제 빌드 결과는 확인하지 않았다. 일반 Build Settings를 바꾼 것은 아니다.

빌더 기본 출력은 `unity/Builds/city_rebuild_v002_phase1_session` 또는 `city_rebuild_v002_phase1_map`이다. manifest의 `kind`는 기존 계약을 유지하고 새 map/path와 `source_scene_sha256`을 넣는다. 기존 산출물 폴더를 덮어쓰지 않는다. 후속 승인 전에는 빌드를 실행하지 않는다.

## 지하철과 미해결 접근 경로

지하철은 이 씬의 prefab override로 계단·계단 모서리·상/하행 에스컬레이터·지하 통로 및 지하 이동면 Collider 4개의 GameObject를 비활성화했다. 총 9개 override이며 원본 prefab/FBX를 수정하지 않았다. 지상 캐노피·안내판·점자블록·기존 검정 portal과 지면을 유지한다. 지형 구멍을 만들거나 실제 지하 접근을 구현한 결과가 아니다. 계단이 지면에 가린 상태를 실제 지하 이동 경로로 오인하지 않도록 지상 시설로만 남겼다. 변경 후 렌더링은 확인하지 못했다.

카페·식당의 연결 보행로는 **미구현**이다. 기존 그래프에서 배치 bounds 중심까지 각각 약 21.89m·27.32m이지만, 그 사이 실제 현재 Collider와 지지면을 Unity에서 측정하지 못했다. 근거 없는 새 좌표·접근 가능 판정을 등록하지 않았다. 카페/식당 실내는 원본 납품물 자체가 출입 가능한 공간을 제공하지 않으며 이번 범위도 실외 접근이다.

## 생성과 다음 승인 단계

이번 씬 작성은 `python scripts/unity/prepare-city-v002-phase1.py`로 수행했다. 이 도구는 원래 상태에서 한 번 적용하도록 작성되어 있으며 Phase 1 장소 루트가 이미 있으면 중단한다. 현재 씬에 반복 실행하거나 이전 도시/Phase 5 전체 생성기로 되돌리지 않는다.

현재 저장된 씬에서 서버 교환 JSON을 만드는 명령은 `python scripts/unity/export-city-rebuild-v002-graph.py`다. 기본 출력은 `web/src/lib/data/city-rebuild-v002-phase1-graph.json`이며 legacy JSON에는 쓰지 않는다. Windows checkout의 layout CRLF는 LF 정규화 hash와 실제 파일 hash를 구분한다. 씬을 다시 저장하면 graph의 source hash와 서버 canonical 자료도 함께 새로 생성해야 한다.

다음 사용자 승인 후 확인할 사항은 C# 컴파일·씬 재로드·prefab override 적용·수정 경로의 실제 Collider/바닥/여유·카메라 시인성·환경 NPC 보존·실제 WebGL 동작이다. 이번에는 이 확인을 실행하지 않았다.
