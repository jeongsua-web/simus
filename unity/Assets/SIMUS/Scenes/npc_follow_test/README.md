# 새 맵 NPC 카메라 추적 테스트

`CompletedMapNpcFollow.unity`를 열고 Play를 누릅니다.

- 맵: `Assets/SIMUS/Art/maps/university_v003/SIMUS_Dense_Realistic_University_Map_03.fbx`
- 캐릭터: `Assets/SIMUS/Art/characters/modular_hairfix_v001/models/SIMUS_Modular_Character_Unity_HairFix.fbx`
- 대상: `Test NPC - HairFix 01` (01번 헤어, 안경 없음, 높이 1.7m)
- Main Camera → City Preview Camera → Follow Target에 위 NPC가 저장되어 있습니다.
- 게임 시작 시 NPC에 맞춘 뒤 LateUpdate의 SmoothDamp로 이동을 추적합니다.
- Follow Smooth Time: 0.25초 / Follow Size: 7 / Follow Offset: (0, 1, 0)
- 이동: Test Npc Patrol의 Speed 1.4m/s, Start–End 왕복. Walk 애니메이션 반복, 루트 모션 꺼짐.
- F: 추적 복귀 / 1 또는 R: 전체 보기 / 2: 상단 보기 / 우클릭 드래그: 추적 해제 후 이동.

테스트 구간은 새 FBX의 `D03_UNITY_D03_WALK_EAST_OUTER__1_P0` 보도에서 추출했습니다.
Start (-197.75, 0.20, -5), End (-197.75, 0.20, 15); 보도 표면 41점 레이캐스트 검사 통과.
이는 카메라 확인용 로컬 구간이며 전시 map_version, 상황 배치, 서버 NPC 경로 확정값이 아닙니다.
서버 폴러/시제품 도시는 이 장면에서 자동 생성하지 않습니다.

재생성: `SIMUS > Build Completed Map NPC Follow Test` (테스트 장면 수동 수정은 재생성됩니다).
새 맵 FBX와 캐릭터 FBX가 임포트되어 있어야 합니다. 원본 .blend는 변경하지 않습니다.

검증 (Unity 6000.3.24f1):
- 동일 FBX·GUID·런타임 코드의 별도 검증 프로젝트에서 컴파일/장면 생성 및 Play Mode 통과.
- NPC와 카메라 이동, Follow Target 연결, 평활 추적(측정 지연 약 0.35m), 줌 유지,
  캐릭터 메시, Walk 반복, 서버 bootstrap 미생성 확인.
- 렌더링 PNG에서 캐릭터가 보도 위에 표시되는 것 확인.
- 반환한 장면/Animator Controller의 외부 GUID 7개가 원래 프로젝트 자산으로 해석되는 것 확인.
- 원래 프로젝트 전체 실행은 대형 .blend 자동 변환 지연 때문에 완료하지 못했습니다.
- Unity Search 초기화의 내부 예외가 검증 로그에 있으나 Play Mode 검증은 종료 코드 0으로 통과했습니다.
- FBX에 기존 자기 교차 폴리곤 임포트 경고가 있습니다. NavMesh/장애물 회피 및 빌드 검증은 포함하지 않습니다.

검증 로그와 렌더 이미지: 프로젝트 `Logs/CompletedMapFollow-PlayMode.log`, `Logs/CompletedMapFollow.png`.
