# SIMUS 대학가 도시 리빌드 v002

상태: **2026-10-14 사용자 승인, Unity 구현 Phase 1~3 진행**. 기존 대학 맵의 Blender 에셋을 최대한 재사용하고 도로망·건물 배치를 개선한다. 기존 2×2 초안은 채택하지 않는다. 이 폴더의 `layout.json`과 배치 CSV를 새 작업 씬의 구현 기준으로 사용한다. 전시 `map_version`, 회차 데이터, 30개 상황 위치 또는 런타임 NPC 경로를 확정하는 승인은 아니다.

## 검토할 산출물

2026-10-15 Phase 4 확장: [하천 설계](river-design.md) · [하천 평면/단면도](river-design.png) · [구현 입력](river-design.json). 기존 도시 배치를 유지하고 동쪽 공원 내부에 폭 10m 곡선 하천, 양안 산책로, 보행교 2개를 추가한다. 이 확장은 전시 map_version/상황 좌표 확정과 별개다.

| 요청 산출물 | 파일 |
|---|---|
| 실측 기반 도시 탑뷰 | [PNG](top-view.png) · [확대 가능한 SVG](top-view.svg) |
| 학교 건물·운동장·광장 상세 | [PNG](campus-detail.png) · [SVG](campus-detail.svg) |
| 건물별 Unity 좌표·회전·원점 보정 | [주변 건물 CSV](buildings.csv) · [최종 학교 배치 CSV](campus-placements.csv) · [설계 JSON](layout.json) |
| 도로망·교차로·폭·접속 계획 | [도로 CSV](roads.csv) · [횡단 시설 CSV](crossings.csv) · [Unity 설계 및 구현 순서](unity-plan.md) |
| NPC 보행 연결망 | [PNG](pedestrian-network.png) · [SVG](pedestrian-network.svg) · [노드 CSV](pedestrian_nodes.csv) · [간선 CSV](pedestrian_edges.csv) |
| 기존 Blender/FBX 재사용·분리 목록 | [Blender 보고서](blender-reuse.md) · [실측 JSON](asset_measurements.json) · [학교 원래 좌표 CSV](campus-components.csv) |
| 독립 QA·수정 후 재검토 | [QA 보고서](qa-review.md) · [정적 검사 결과](qa-results.json) · [수정 이력](qa-revision-history.json) |
| 설계 참고 자료 | [한국 대학가와 도로 위계 참고](reference-notes.md) |
| 지역별 면적·배치 밀도 | [실측 envelope 점유율 CSV](density.csv) |

탑뷰는 실측 건물 외곽치수(envelope), 캠퍼스 몸체 투영과 도로 폭을 월드 미터로 그린 설계도다. 외부 건물 사각형은 실측 전체 범위이며 실제 외벽 실루엣을 렌더한 것은 아니다. Unity 캡처가 아니다. 도면의 건물 ID는 배치 CSV에서 원본 파일·좌표·회전과 대응한다. 원본 조사 CSV와 최종 배치 CSV는 기존 위치와 설계 위치를 구분하며, 최소 이동이 필요한 동은 Unity 설계에 이유와 이동량을 기록한다.

계획 범위는 420×435m다. 기존 학교 14동과 주변 건물 55개를 배치하며, 학교 10동의 상대 위치와 운동장·코트는 보존한다. 나머지 4동은 캐노피·계단의 여유 범위와 출입 동선을 위해 3~9m만 조정한다. 공원에는 기존 12×12m 모듈 2개를 휴식 노드로 재사용한다. 도로는 차도 6.5m 간선, 6m 일반도로, 4~4.5m 주거 골목, 3.5m 배송 골목으로 구분한다.

## 구현 전 확인 사항

독립 정적 QA에서 치수·배치·유한폭 충돌·보행망 연결·횡단 시설 정합 오류는 0건이고 보호 대상 644개 파일의 해시는 동일하다. [렌더 기록](render-manifest.json)은 최종 JSON과 도면의 해시를 대응한다. 필수 에셋 카탈로그 생성·검사는 기존 원본 경로 누락 3건과 해시 불일치 1건, 오래된 inventory 때문에 실패했다. 카탈로그 갱신이나 자산 승인 완료로 처리하지 않았다.

Unity에서 실제 가져오기, 충돌체, NavMesh, 출입문 문턱·단차, 차량 회전 궤적, 아이소메트릭 카메라 가림, 성능을 아직 검증하지 않았다. 정적 연결 그래프 통과를 실제 NPC 이동 성공으로 해석하지 않는다. 기존 NPC·카메라·웹·백엔드와 이벤트 로직을 변경하지 않으며 최대 이벤트 대기 90초 요구를 유지한다.

사용자가 Unity 구현을 승인했으며 이번 작업 범위는 Phase 1(실행·FBX 임포트), Phase 2(지형·도로·보도), Phase 3(캠퍼스·건물 배치)까지다. 이후 사용자가 Unity에서 확인한다. 기존 Blender 원본·Unity 씬·빌드 설정은 보존하며 새 `CityRebuild_v002.unity`를 사용한다. Phase 4~7의 공원 장식·NPC 보행망 연결·카메라 및 성능 검증은 후속 작업이다.

## 설계도 재생성

저장소 루트에서 `python3 docs/planning/city_rebuild_v002/render_plan.py`를 실행한다. 이 스크립트는 이 폴더의 JSON을 읽어 이 폴더에 SVG·PNG와 렌더 해시 기록을 출력하며 Unity 프로젝트를 조립하지 않는다.
