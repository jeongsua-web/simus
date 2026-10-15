# SIMUS 도시 리빌드 v002 — Phase 3 확인용 인계

사용자가 승인한 v002 설계를 Unity에서 조립했다. 이번 범위는 Phase 1~3이며, 사용자의 Unity 확인 이후 Phase 4~7을 진행한다. 새 전시 `map_version`이나 상황 30개 좌표를 확정하지 않았다.

## Unity에서 열기

Unity **6000.3.24f1**로 프로젝트의 `unity` 폴더를 연 뒤 아래 씬을 연다.

`Assets/SIMUS/Scenes/city_rebuild_v002/CityRebuild_v002.unity`

[씬 파일](../../unity/Assets/SIMUS/Scenes/city_rebuild_v002/CityRebuild_v002.unity) · [씬 사용 안내](../../unity/Assets/SIMUS/Scenes/city_rebuild_v002/README.md) · [전체 보기](city-rebuild-v002-captures/overview-editor.png) · [탑뷰](city-rebuild-v002-captures/top-view-editor.png) · [NPC 근접 정적 렌더](city-rebuild-v002-captures/npc-inspection-editor.png)

기존 빌드 씬은 바꾸지 않았다. 새 씬을 직접 열어 확인한다. `1`은 전체 보기, `2`는 탑뷰, `F`는 기존 NPC 추적 기능이다. 기존 카메라의 런타임 줌 상한 170 때문에 전체 도시의 Play Mode 화면 범위는 후속 조정 대상이다. 검토 이미지는 Unity Editor `Camera.Render` 출력이며 Play Mode 실행/추적 성공을 의미하지 않는다.

## 구현 및 검증

| 단계 | 구현 결과 | 확인 범위 |
|---|---|---|
| Phase 1 | Unity C# 컴파일, 필요한 실제 FBX 14종 로드, 캠퍼스 487개 메시 이름·축 대응 | Unity 실행 로그와 Blender/Unity 실측 비교 |
| Phase 2 | 도시 지면, 도로 7개, 교차로 6개, 회차 공간, 보도·학교 보행로·공원 산책로, 횡단 시설 17개 | 개별 편집 가능한 메시·Collider로 직렬화. 보행망 이동/신호 제어는 후속 범위 |
| Phase 3 | 캠퍼스 14동, 외부 건물 55개, 운동장·농구장·테니스장 | 실제 FBX 참조, 배치·크기·회전·지면 높이·건물 envelope 충돌 검사, 저장 후 씬 재열기 |

캠퍼스는 기존 FBX의 건물 부품 308개를 14개 부모 오브젝트 아래 묶었다. 외부 건물은 기존 FBX 프리팹 인스턴스 55개다. 단순 박스 프록시를 최종 건물로 사용하지 않았다. Unity importer의 X/Z 방향 반전을 Y축 180° 어댑터로 보정했으며, 승인된 건물 좌표와 회전값은 유지했다. 도시 조립을 위해 Blender 원본을 변경하거나 FBX를 재내보내지 않았다.

`SIMUS > City Rebuild v002 > Build Phases 1 to 3` 메뉴로 재생성할 수 있다. 재생성 시 새 씬의 `CityRebuild_v002` 루트 아래 수동 변경은 교체되므로 확인 후 편집할 때 유의한다. 원본 씬과 기존 빌드 설정은 재생성 대상이 아니다.

최종 저장 씬에서 Unity 물리 검사 10,517개 중심선 샘플이 모두 지지되며 건물 hit는 0건이다. 독립 메시 검사도 도로 4,938개·보행 31,512개 샘플에서 통과했다(경계 허용오차 1mm, 7개 끝단 샘플에 사용). 실제 NPC 이동 검증과는 구분한다. [실행 로그 요약 및 카탈로그 로그](city-rebuild-v002-logs/runs.json)도 보존했다.

## 확인이 필요한 부분

- 외부 39동에서 설계의 임시 출입구 방향과 실제 출입문/램프 위치가 다를 가능성을 확인했다. [건물별 근거 CSV](city-rebuild-v002-external-entry-evidence.csv)에 기록했다. 승인 배치와 회전은 유지했으며 실제 문턱까지의 접근성·단차·NavMesh 연결은 **NOT TESTED**다.
- 기존 NPC 모델·걷기 컨트롤러·`TestNpcPatrol`·`NpcGrounding`·`CityPreviewCamera`를 유지했다. 새 씬의 짧은 로컬 시험 구간은 보행 그래프 경로 탐색 구현이 아니다. NPC Play Mode 이동·추적·가림 검증은 **NOT TESTED**다.
- 공원 모듈 2개·나무·벤치 등 Phase 4 장식, Phase 5 보행망 연결, Phase 6 카메라·1/100/500/1,000 NPC 성능 검증은 진행하지 않았다. FPS/CPU/메모리 측정 완료를 주장하지 않는다.
- 최초 전체 프로젝트 임포트에서는 기존 버스·택시 `TransitAssetSetup`의 중복 LODGroup 관련 예외가 기록됐다. v002에서 사용하는 건물 FBX의 로드/조립 검사와 구분한다.
- 에셋 카탈로그에는 기존 원본 경로 누락과 해시 불일치가 있어 목록 생성·검사가 실패한다. 해당 원본과 승인 상태를 임의로 수정하지 않았다. 최종 오류 수와 실행 결과는 [QA 기록](city-rebuild-v002-qa.md)에서 확인한다.

## 상세 증거

- [Unity 구현 기록](city-rebuild-v002-unity.md) · [Unity 실제 실행 결과](city-rebuild-v002-unity-results.json)
- [Blender 검증 기록](city-rebuild-v002-blender.md) · [FBX 감사 결과](city-rebuild-v002-blender-fbx-audit.json)
- [독립 QA](city-rebuild-v002-qa.md) · [정적/실행 증거 대조 결과](city-rebuild-v002-static-results.json)

백엔드·데이터베이스·웹·이벤트 발생 로직은 수정하지 않았다. 최대 이벤트 대기 90초 계약은 유지한다.
