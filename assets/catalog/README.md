# 에셋 찾기

[정리 규칙](../ASSET_RULES.md) · [납품·승인 목록](../manifest.csv) · [전체 파일 목록](inventory.json) · [2026-10-08 이동 이력](moves-2026-10-08.json)

## 제작 라이브러리

| 분류 | 제작 묶음 |
|---|---|
| 건물 | [부지](../library/buildings/building_plot/README.md), [편의점](../library/buildings/convenience_store/README.md), [백화점](../library/buildings/department_store/README.md) |
| 도로 | [직선](../library/roads/road_straight/README.md), [모퉁이](../library/roads/road_corner/README.md), [교차로](../library/roads/road_crossroad/README.md), [주차장](../library/roads/parking_lot/README.md) |
| 소품 | [한글 안내판](../library/props/korean_guide_signs/README.md), [도로 표지판](../library/props/road_signs/README.md), [가로등](../library/props/streetlight/README.md), [신호등](../library/props/traffic_light/README.md) |
| 식생·가로 시설 | [나무·화단·벤치·쓰레기통 묶음](../library/vegetation/street_landscape/README.md) |

위 자료는 접수 후보다. 서로 다른 백화점·아파트·캐릭터 버전을 이름만 보고 대체 관계로 확정하지 않는다. ZIP 11개는 `assets/archive/packages/`, Blender 자동 백업 3개는 `assets/archive/backups/`에 있다.

## Unity 에셋 목록

기존 납품 묶음을 해체해 용도별로 이동했다. 일부 Blender 원본은 외부 참조 보존을 위해 FBX 옆에 유지한다.

| 자료 | 현재 위치 | 의미 |
|---|---|---|
| 새 맵 제작 후보 | [대학 맵 v003](../../unity/Assets/SIMUS/Art/maps/university_v003) | 추적 테스트에 FBX 사용. 전시 map_version 미확정 |
| 개별 건물·소품·공원 | [건물](../../unity/Assets/SIMUS/Art/buildings), [소품](../../unity/Assets/SIMUS/Art/props), [식생](../../unity/Assets/SIMUS/Art/vegetation), [도로](../../unity/Assets/SIMUS/Art/roads) | 제작 묶음, 개별 채택 미확인 |
| 제작 미리보기·검증 | [맵 제작 보고서](../../assets/library/maps/university_v003/reports) | 제작 당시 자료 |
| 아파트 묶음 | [아파트 v001](../../unity/Assets/SIMUS/Art/buildings/apartment_complex_v001), [통합 아파트 v001](../../unity/Assets/SIMUS/Art/buildings/apartment_complex_unified_v001) | 두 버전 유지, 대체 여부 미확인 |
| 캐릭터 | [HairFix v001](../../unity/Assets/SIMUS/Art/characters/modular_hairfix_v001) | Happiness_Animations 사용, CapFix 원본 및 역할 NPC 유지. HairFix 구버전·옛 백업은 2026-10-09 정리 |
| 추적 테스트 장면 | [NPC 추적 테스트](../../unity/Assets/SIMUS/Scenes/npc_follow_test) | 현재 활성 빌드 장면. Happiness_Animations FBX / NEUTRAL_WALK 사용 |
| 백화점 v2 | [department_store_v2](../../unity/Assets/department_store_v2) | manifest에 received로 등록, 전시 채택 미정 |
| 이전 시제품 | [Neighborhood.fbx](../../unity/Assets/Art/Neighborhood.fbx), [Scenes](../../unity/Assets/Scenes), [Materials](../../unity/Assets/Materials) | 새 맵 배치 근거로 사용하지 않음 |

현재 사용 근거는 `unity/Assets/Editor/CompletedMapFollowSetup.cs`의 MapPath/CharacterPath 및 `unity/ProjectSettings/EditorBuildSettings.asset`다. Unity 실행 검증 결과는 아래 후속 기록에서 확인한다. 범용 캐릭터 파일이 있다고 API 9성향의 최종 캐릭터가 납품된 것으로 처리하지 않는다.

## 2026-10-08 정리 기록

- `assets/assets`의 143개 파일을 이동하고 이동 직후 SHA-256 일치를 확인했다. 숨김 Finder 메타데이터 1개도 보관했으며 일반 inventory에서는 제외한다.
- 12개 제작 묶음을 유형별로 나누고 원본·교환본·미리보기·보고서를 분리했다. 공급자 `사용안내.md` 원문은 보존하고 실제 새 경로를 담은 README를 추가했다.
- GLB 31개를 manifest에 received 후보로 등록했다. 승인 상태와 새 맵 좌표는 추정하지 않았다.
- 첫 정리에서는 Unity를 유지했으나, 아래 후속 정리에서 실제 이동했다.
- 기존 작업 중이던 문서 변경과 `simus-stage4-8` 삭제는 유지했다.
- 이동 이력의 해시는 이동 당시 증거다. 이후 정상적인 모델 수정에 대한 현재 해시는 inventory와 manifest를 사용한다.

## Unity 후속 정리

- [이동 기록](moves-2026-10-08-unity.json): 1,442개 파일을 이동 직후 해시 비교했다. 중첩 프로젝트 캐시와 메타데이터도 삭제하지 않고 보관했다.
- [경로 대응표](unity-path-mapping.json): 기존 묶음 → 새 분류 경로. 파일별 예외는 이동 기록이 정확한 기준이다.
- 이동 시 기존 `.meta` 내용을 보존했고 Unity 밖으로 옮기는 GUID에 대한 활성 직렬화 에셋의 참조가 없음을 검사했다.
- 테스트 장면/컨트롤러 GUID를 유지하고 편집기 코드, 빌드 설정, 운영 문서의 경로를 갱신했다.
- Unity 실행 검증: Unity 6000.3.24f1이 새 경로의 테스트 장면·맵 FBX·HairFix FBX를 인식하고 재가져왔다. 이후 대형 .blend 변환이 5분 이상 지연되어 이번 배치 프로세스를 종료했다. Play Mode 완료는 미확인이다. 모델의 재질 슬롯/자기 교차 폴리곤 경고가 출력됐다. 새 맵 전시 승인이나 상황 좌표 확정과는 별개다.

- [정적 검증 결과](unity-reorganization-verification.json): 장면·컨트롤러 외부 GUID 5개 모두 해석, 누락 0개.

## 2026-10-09 환경 상태 및 역할 NPC

[맵 업데이트](../library/maps/university_v003/Environment_States_v3.md) · [역할 NPC](../library/characters/role_variants_v001/README.md). 환경 상태 원본 교체 및 FBX 추가, 경찰·미화원·범죄자 추가. 기존 HairFix 및 기본 맵 FBX 연결 유지. Unity 재가져오기/Play Mode 미실행.

## CapFix 행복도 애니메이션

[결과 및 경로](../library/characters/modular_hairfix_v001/reports/happiness_animations/결과보고.md). 기존 캐릭터 models 폴더에 CapFix 원본과 행복도 수정본/FBX/검증된 Humanoid 메타 추가. 기존 HairFix 유지.

## 2026-10-09 캐릭터 구버전 삭제 및 실행 연결 교체

사용자 요청으로 이전 백업 모델 6개, HairFix 모델 2개 및 대응 메타, 옛 중첩 npc_follow_test 설정 폴더를 정리했습니다. [삭제 목록 및 해시](character-cleanup-2026-10-09.json), [재생 검사](character-follow-validation-2026-10-09.json). 현재 장면과 걷기 컨트롤러는 Happiness_Animations를 사용하며 CapFix 원본과 역할 NPC는 보존합니다. 기존 제작 보고서의 HairFix 경로는 제작 당시 기록입니다.
