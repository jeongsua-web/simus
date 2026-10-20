# CityRebuild_v002 Phase 8-A/B — Blender 및 시각 설계 지원

2026-10-17. 담당 범위는 에셋/시각 설계와 별도 신규 소품 키트다. 기존 승인된 69동 배치, 도로·보행망, 하천·교량, Blender/FBX 원본과 `.meta`를 수정하지 않았다. Unity 씬과 C#은 Unity 담당이 소유하며 이 보고서의 Blender 성공을 실제 Unity 검증으로 대체하지 않는다.

## 검토한 기준

루트 `AGENTS.md`, `assets/ASSET_RULES.md`, catalog README, manifest, 실제 inventory와 [Phase 7 QA](city-rebuild-v002-phase7-qa.md)를 검토했다. Phase 7의 [도시 전체](city-rebuild-v002-captures/overview-game-playmode.png)와 [공원](city-rebuild-v002-captures/park-game-playmode.png) 실제 PNG를 열었다. 도로 차선 부재, 넓은 동일색 부지, 작은 가로수·휴식 소품, 학교·주거·상업의 구역 경계 가독성을 우선 개선 대상으로 전달했다. 아파트 카메라 문제는 QA의 기존 FAIL을 유지하고 Unity 담당이 비교한다.

기존 STREET_TREE와 REUSED_BENCH 및 공원 FBX 2개는 Phase 4–7에서 실제 사용한 자산이다. 재사용 시 수입 root의 native 축을 유지해야 하며 과거 `rotation = yaw` 치환으로 나무가 눕던 원인을 재발시키지 않는다. catalog의 존재와 `received` 상태를 전시 승인으로 해석하지 않았다.

## 전달한 시각 설계

기존 도시 구조를 유지하면서 저채도 색상, 무텍스처의 단순한 면, 구역별 얕은 지면 포장을 사용한다. 실제 게임 스타일을 설명하기 위한 방향이며 타 게임의 이미지나 자산을 복제하지 않는다.

| 요소 | 제안 색상 | 적용 목적 |
|---|---|---|
| 차도 | `#596774` | 건물보다 어둡게 유지해 차선 대비 확보 |
| 보도·연석 | `#D6CDB9` | 차도/잔디와 부드럽게 구별 |
| 크림 외벽·광장 | `#F1E6CB` | 과도한 순백색 줄이기 |
| 슬레이트 지붕 | `#6C96A8` | 학교와 도시 색상 통일 |
| 잔디 | `#8EAF7C`, `#B4C88F` | 마당/학교/공원의 계층 구별 |
| 관목 | `#598B69` | 식생의 입체적인 색 대비 |
| 목재 | `#A67C55` | 벤치·교량의 재료 통일 |
| 깨끗한 수면 후보 | `#55A9B4` | 기존 오염도 변화 머티리얼 계약 안에서만 검토 |

도로에는 lane·교차로 접근부·횡단보도·회차부를 구별하고, 학교에는 중앙광장·운동장 주변 포장·소규모 녹지를 제안했다. 주거는 마당/주차 바닥/화단, 상업은 전면 보행 포장/간판/가로등, 공원은 기존 산책로 바깥 벤치/나무/휴식 포켓으로 구별한다. 새 장식은 보행 그래프와 몸체 폭을 피하고, 기존 하천/교량 충돌·수질 표현은 Unity에서 회귀 확인한다. 조명·Color Grading·AO·LOD·Profiler 최적화는 Phase 8-C/D이므로 이 작업에서 실시하지 않는다.

## 신규 독립 소품

Unity 담당 요청에 따라 [street kit v001](../../assets/library/props/city_v002_phase8_street_kit_v001/README.md)을 별도 제작했다. 원본 1개, FBX 1개, Blender preview 1개, 검증 JSON 1개이며 Unity에는 동일 FBX의 교환 사본만 전달한다. 재질 9종, texture/animation/Light/Collider 없음. 단위는 m, 각 mesh의 바닥 중앙이 원점이다. 원본은 편집 배열, export는 같은 원점에 겹친 3개의 이름 있는 mesh이므로 Unity에서 개별 mesh를 추출해야 한다.

| Mesh | 실제 Blender reimport 크기 X×Y×Z m | 삼각형 |
|---|---:|---:|
| Phase8_Planter | 1.800×0.700×0.810 | 392 |
| Phase8_Bench | 2.000×0.700×0.850 | 748 |
| Phase8_Streetlamp | 0.400×0.400×4.500 | 376 |

[Blender preview](../../assets/library/props/city_v002_phase8_street_kit_v001/previews/phase8_street_kit.png)는 실제 Blender 렌더이며 Unity Game View가 아니다. source reopen과 FBX import를 실제 Blender 5.2.2 LTS에서 실행했다. 결과는 [검증 JSON](../../assets/library/props/city_v002_phase8_street_kit_v001/reports/blender-validation.json)에 저장했다. FBX 재가져오기 최소 Z 오차는 0.00000006m 미만, 모든 좌표 유한, export와 Unity 사본 SHA-256 동일이다. 초회 preview engine enum이 Blender 5.2와 달라 중단되어 호환 이름 `BLENDER_EEVEE`로 수정 후 재실행했고 성공 결과만 납품 근거로 사용했다.

## 검증 범위

| 검사 | 상태 | 근거 |
|---|---|---|
| Phase 7 실제 도시/공원 PNG 및 에셋 규칙 검토 | PASS | 직접 이미지 열기와 문서/manifest 검토 |
| 새 kit source reopen / FBX actual import | PASS | Blender 5.2.2, 3 mesh, validation JSON |
| 새 kit 크기/바닥 원점/공유 재질/삼각형 | PASS | 실제 reimport bounds/material slots/loop triangles |
| 새 kit preview 시각 검토 | PASS | 실제 렌더에서 3종 식별, 면/슬랫/꽃/등기구 확인 |
| FBX export와 Unity 작업 사본 동일 | PASS | SHA-256 `0186bbf0402804322ed1ac80c6c10e97af0b679fd084529a740f052e32417cf3` |
| 새 kit Unity import·실제 배치·보행 clearance | NOT TESTED by Blender audit | Unity/QA 담당의 실제 실행 증거 필요 |
| 카메라 7개 Game View 및 전후 비교 | NOT TESTED by Blender audit | 메인/Unity 담당 산출물 |
| 21개 QA/19개 EditMode 회귀 | NOT TESTED by Blender audit | QA 담당 범위 |
| NPC 동일조건 성능 전후·Profiler | NOT TESTED | Phase 8-D 보류 |

manifest는 `prop_city_v002_phase8_street_kit_v001` 한 행만 `received`로 신규 등록했다. 기존 행의 승인 상태나 원본 해시는 바꾸지 않는다. 최종 catalog 생성과 `--check`는 Unity 산출물이 정리된 뒤 메인 에이전트가 통합 실행한다.
