# CityRebuild v002 — Phase 6 카메라·성능 최종 검증

2026-10-17 정리. Unity 6000.3.24f1 실제 Play Mode 결과 **COMPLETE**, 실행 입력 **UNCHANGED_DURING_PLAY**. 최종 씬 SHA-256은 `763654d0c15377cc79ba9b0919e180e47dd20ef3be0d0202a82d714635575555`다.

[실행 결과](city-rebuild-v002-phase6-runtime.json) · [Unity 실행 로그](city-rebuild-v002-logs/phase47-final-unity.log) · [입력 해시](city-rebuild-v002-phase47-runtime-inputs.json) · [독립 QA](city-rebuild-v002-phase7-qa.md)

## 카메라

기존 CityPreviewCamera의 전체/탑뷰/NPC 추적을 유지했다. 전체 260m, 탑뷰 235m, 최대 줌 350m이며 추적 size 12.75089m, pitch 28.85°, yaw −131.64°다. 이전 최대 줌 170m의 전체 보기 축소 문제를 씬별 설정으로 보완했다. [설정 전후 기록](city-rebuild-v002-camera-settings.json)의 최종 재실행 값은 동일하다.

정적 FBX의 Animator를 NPC로 오인하던 가림 처리 제외 조건을 수정했다. v002 건물에만 투시 재질을 적용해 하천 산책로의 깊이 보정 재질을 보존했다. 테스트는 1920×1080 비율로 통일하고 NPC 경로 초기화 및 LateUpdate 이후 측정한다. 아파트 뒤 NPC는 실제 캡처에서 보이지만 건물이 화면 대부분을 차지하는 구도 문제는 남아 있다.

[도시 전체](city-rebuild-v002-captures/overview-game-playmode.png) · [탑뷰](city-rebuild-v002-captures/top-view-game-playmode.png) · [공원](city-rebuild-v002-captures/park-game-playmode.png) · [NPC 추적](city-rebuild-v002-captures/npc-follow-game-playmode.png) · [아파트 추적](city-rebuild-v002-captures/npc-follow-apartment-game-playmode.png)

## 실제 성능 측정

Editor, timeScale=1, VSync/프레임 제한 해제, 2초 예열 후 약 5초 측정. 매 측정 프레임 1920×1080 Camera.Render를 호출했다. 실제 FBX/Animator/MoveTowards/grounding/graph adapter를 활성화하고 요청 인원 전체가 이동함을 확인했다. CPU와 메모리는 Editor 오버헤드를 포함한다.

| NPC | FPS | CPU ms/frame | Main Thread ms | Unity allocated MiB | Working set MiB |
|---:|---:|---:|---:|---:|---:|
| 1 | 62.40 | 18.31 | 15.94 | 410.9 | 183.5 |
| 100 | 41.71 | 35.95 | 23.97 | 425.1 | 196.9 |
| 500 | 15.09 | 112.04 | 66.26 | 482.7 | 346.3 |
| 1000 | 8.25 | 213.35 | 121.14 | 550.7 | 559.3 |

측정 완료는 성능 목표 달성이 아니다. 1,000명 약 8.25FPS이며 전시 타깃 Player/WebGL 성능, 군중 회피, 서버 이벤트 부하는 미검증이다.

## 최적화 검토

- 반복 정적 소품은 GPU instancing 후보이나 현재 효과 비교는 미실행이다. 투시 재질 및 공유 재질 계약을 유지해야 한다.
- Static Batching은 개별 수정 구조와 메모리 비용을 검토한 뒤 적용한다. 이번에 일괄 적용하지 않았다.
- LOD는 건물·식생·NPC 각각 자산별 시각 검증이 필요하며 신규 LOD 제작/벤치마크는 미실행이다.
- 나무 줄기 capsule과 벤치 box collider를 사용한다. 건물 충돌체를 무조건 단순화하지 않았다.
- 화면 밖 NPC의 Animator/grounding 업데이트 빈도 조절은 우선 검토 대상이나 이동·이벤트 시간 계약을 보존하는 별도 검증이 필요하다. 기존 NPC 로직은 변경하지 않았다.

## 회귀 검사와 제한

[EditMode 결과](city-rebuild-v002-final-tests.xml) **19/19 PASS**, 실패·건너뜀 0. [회귀 실행 로그](city-rebuild-v002-logs/phase47-final-editmode.log). 기존 NPC 및 하천 회귀 범위이며 실제 문턱 접근, NavMesh bake, 전체 위치의 카메라 가독성 검증을 대체하지 않는다.
