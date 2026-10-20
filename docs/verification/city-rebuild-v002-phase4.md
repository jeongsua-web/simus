# CityRebuild v002 — Phase 4 공원·녹지 구현

2026-10-17 최종 상태: **Unity 씬 조립과 실제 Play Mode 검증 PASS**. 동쪽 공원 지면·산책로·공원 FBX 모듈 2개, 기존 나무 FBX 46개 인스턴스, 휴식 공간과 추가 벤치 FBX 2개를 유지했다. 하천 작업에서 제외한 식생은 기존 비활성 상태를 유지하므로 나무 46개는 전체 인스턴스 수다. 최종 씬과 실행 입력 해시는 [입력 기록](city-rebuild-v002-phase47-runtime-inputs.json), 실행 결과는 [Phase 6](city-rebuild-v002-phase6.md)을 기준으로 한다.

2026-10-15 확장: 사용자 요청으로 **하천 구현을 Phase 4에 포함**했다. [하천 위치·단면·보행 연결](../planning/city_rebuild_v002/river-design.md)을 기존 구현 위에 증분 적용했다.

2026-10-16 하천 완료: 폭 10m 곡선 하천, 실제 지면 절개, 양안 둔치·산책로, 보행교 2개와 기존 NPC 보행망 연결, 오염도 머티리얼 제어를 구현했다. 5개 실제 NPC 왕복 경로와 8개 회귀 테스트가 통과했다. [최종 QA·화면·제한 사항](city-rebuild-v002-river-qa.md)을 현재 하천 상태의 기준으로 사용한다.

승인된 v002의 작업용 `CityRebuild_v002.unity`에 증분 편집을 적용했다. 전체 generator는 재실행하지 않았다. `layout.json`, 원본 Blender/FBX, 원본 씬, 빌드 설정을 보존했다. 최초 공원 생성 메서드는 `CityRebuildV002Phase4Setup.Apply`, 최종 증분 복구·검증 메서드는 `CityRebuildV002Phase47Bridge.RunBatch`다.

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

최종 Unity 6000.3.24f1 실행은 컴파일·씬 로드·Play Mode를 통과했다. 나무의 FBX root 축 회전을 복구해 수직 배치와 지면 높이를 검사했고, 벤치 2개는 기존 FBX를 휴식 공간에 배치했다. [조립 기록](city-rebuild-v002-phase4-completion.json)의 scene hash는 조립 중간 시점이며, 최종 씬 해시는 위 입력 기록을 사용한다.

실제 FBX envelope 검사에서 작업씬의 C11 처마·난간 4개와 B01/B31/B42 모델 자식 3개의 이동 손상을 발견했다. 원본 FBX 및 기존 축 보정과 승인 footprint에 근거해 자식 위치만 복구했다. [복구 근거](city-rebuild-v002-building-recovery.json)와 [69개 실제 FBX 전체 검사 PASS](city-rebuild-v002-phase47-building-audit.json)를 남겼다. 원래 손상을 발생시킨 편집 동작은 확인하지 못했다.

전체 보기 캡처 검토에서 도로 밖 회차 조각을 발견해, 월드좌표 정점을 사용하는 도로·보도 생성 규칙과 어긋난 transform 66개(횡단 표시 50, 보행면 13, 교차·회차 3)를 identity로 복구했다. 메시·재질·Collider 참조는 유지했다. [복구 목록](city-rebuild-v002-surface-recovery.json), 실제 월드좌표 표면 QA와 [597개 활성 graph edge 물리 검사](city-rebuild-v002-final-physics.json)를 재실행했다. 최종 Play Mode에서는 큰 삼각형 경고 0, 수집된 런타임 오류·경고 0이다.

실제 문턱 접근, NavMesh, 군중 회피와 목표 기기 성능은 **NOT TESTED**이며, 현재 그래프 왕복 이동과 카메라·단계별 성능 실측은 [Phase 5](city-rebuild-v002-phase5.md)·[Phase 6](city-rebuild-v002-phase6.md)에 기록했다.
