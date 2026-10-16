# CityRebuild v002 — Phase 4 공원·녹지 구현

2026-10-15 확장: 사용자 요청으로 **하천 구현을 Phase 4에 포함**한다. [하천 위치·단면·보행 연결 설계](../planning/city_rebuild_v002/river-design.md)를 먼저 보고하고 기존 구현 위에 증분 적용한다. 아래는 기존 공원 작업 기록이며 하천의 실행 완료를 의미하지 않는다. 현재 `phase4-results.json`에는 기존 공원 증분 Apply PASS가 있으므로 하단의 초기 “통합 실행 대기” 표현은 당시 상태다.

2026-10-16 하천 완료: 폭 10m 곡선 하천, 실제 지면 절개, 양안 둔치·산책로, 보행교 2개와 기존 NPC 보행망 연결, 오염도 머티리얼 제어를 구현했다. 5개 실제 NPC 왕복 경로와 8개 회귀 테스트가 통과했다. [최종 QA·화면·제한 사항](city-rebuild-v002-river-qa.md)을 현재 하천 상태의 기준으로 사용한다.

승인된 v002의 기존 `CityRebuild_v002.unity`에 증분 편집을 적용한다. 전체 generator를 재실행하지 않으며 `layout.json`, 14동/55개 건물 배치, 원본 Blender/FBX, 원본 씬, 빌드 설정을 보호한다. 실행 메서드는 `CityRebuildV002Phase4Setup.Apply`, 메뉴는 `SIMUS > City Rebuild v002 > Apply Phase 4 Park and Greenery`다.

## 보행로와 공원

현재 밝은 보행로는 `04_PedestrianSurfaces` 아래 직렬화된 `MeshFilter`, `MeshRenderer`, `MeshCollider`를 가진 **실제 보행 지면**이다. NPC 그래프의 디버그 선이 아니다. 기존 폭·경로·Collider를 유지하고 신규 전용 재질로 보도는 따뜻한 석재 회색, 캠퍼스는 사암색, 공원은 다져진 자갈색으로 변경한다. 공원 구간에는 기존 보행로보다 1mm 낮은 둥근 자갈 join을 추가해 코너를 부드럽게 보완한다. 388 nodes / 409 edges 원본은 그대로다.

동쪽 공원의 승인된 불규칙 polygon을 삼각분할해 잔디 지면을 추가한다. PZ01(140,25,r6), PZ02(142,118,r7)에 원형 휴식 지면을 추가하며 PM1/PM2는 승인된 좌표·yaw·12×12m 크기를 유지한다.

기존 `COZY_NEIGHBORHOOD_PARK.fbx`와 `MODERN_MINIMAL_PARK.fbx`는 각각 **단일 통합 메시**다. 원본 Blender의 개별 205/93 오브젝트와 다른 구조이므로 통합 renderer 전체를 제외하는 방식은 사용하지 않는다. Unity에서 실제 FBX 삼각형의 연결 성분을 분리해 원본 vertex, normals, UV, submesh/material을 보존한 파생 메시를 생성한다. 원본 FBX prefab renderer 참조는 비활성으로 보존한다. 전체 보행 폭+0.65m 여유 영역에 걸리는 높은 성분만 제외하며 원본 FBX와 `.blend`를 수정하지 않는다.

나무와 추가 벤치는 기존 실제 `STREET_TREE.fbx`, `REUSED_BENCH.fbx` 인스턴스를 재사용한다. 공원/캠퍼스/일부 가로에 낮은 밀도로 배치하며 건물 envelope, 차도, 보행 폭, 기존 스포츠 시설, 공원 모듈을 침범하는 후보는 제외한다. 나무는 줄기 capsule, 벤치는 world bounds box로 Collider를 단순화한다. 실제 생성 수와 제외 성분은 실행 후 `city-rebuild-v002-phase4-results.json`에 기록된다.

## 500 units 초과 삼각형 경고

원인: 기존 `CityGround`는 436×451m quad를 삼각형 2개로 표현했으며 대각선이 **627.293m**다. 이전 Unity Editor 로그의 source mesh도 `CityGround`로 식별됐고 QA의 직렬화 vertex/index 검사와 일치한다.

Phase 4는 현재 신규 씬의 MeshCollider 전체를 world triangle edge로 검사한다. 500m 이상인 메시만 신규 `phase4_meshes`로 최장 edge **80m 이하**가 되도록 분할한 뒤 해당 scene의 renderer/Collider 참조를 교체한다. 기존 `meshes/surface_0000.asset` 및 원본 FBX를 덮어쓰지 않는다. 최초 적용 전후 edge/triangle 수를 실행 JSON에 기록하고 500m 이상 edge가 남으면 실패한다. 런타임에서 실제 경고가 사라졌는지는 Phase 7의 Unity 실행 로그로 별도 판정한다.

별도의 `[Physics.PhysX] cleaning the mesh failed` 기록도 확인했다. 정적 직렬화 mesh 조사에서 기존 generated surface 30개에 중복 vertex/0면적 삼각형 또는 극도로 가느다란 clipping 잔여가 있었다. Unity Apply는 world triangle 최장변에 대한 altitude가 0.1mm 이하인 삼각형을 collider 전용 파생 메시에서 제거한다. 전부 sliver인 collider는 비활성화하고 기존 시각 mesh는 유지한다. 원본 FBX/원본 surface asset은 변경하지 않는다. 실제 경고 원인이 이 잔여 geometry였는지는 후속 씬 재열기/Play 실행 로그로 확인하며, 보행 지지 연결도 Phase 5의 실제 물리 ray 검사에서 재검증한다.

## 검증 상태

코드 작성 시점: Unity 컴파일/Apply/Play Mode는 메인 에이전트의 통합 실행 대기 중이며 **NOT TESTED**다. 이 문서의 구현 설명은 실행 성공을 뜻하지 않는다. Apply는 생성 후 그래프 중심선과 장식 Collider 검사, 69개 건물 transform 비교, protected source/layout/CSV/build settings 해시 검사를 통과해야만 씬을 저장하고 PASS 실행 JSON을 생성한다. NPC 이동, Game 뷰, 성능은 Phase 5~7 결과에서 보고한다.
