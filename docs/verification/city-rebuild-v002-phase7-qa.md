# City Rebuild v002 — Phase 4–7 최종 독립 QA

검토일: 2026-10-17 KST. 실제 Unity Editor 실행은 Unity 담당이 수행했고, QA는 저장된 씬·입력 해시·실행 결과와 Game 카메라 PNG를 독립 대조했다. **최종 실행 증거 검사 21/21 PASS**다. 다만 실제 출입문 접근·NavMesh는 미검증이며, 아파트 추적 화면의 과도한 건물 점유는 남아 있다. 전체 요구사항이 모두 완료되었다는 판정은 아니다.

## 실행 대상과 증거

- [작업 씬](../../unity/Assets/SIMUS/Scenes/city_rebuild_v002/CityRebuild_v002.unity): SHA-256 `763654d0c15377cc79ba9b0919e180e47dd20ef3be0d0202a82d714635575555`.
- 승인 [layout.json](../planning/city_rebuild_v002/layout.json): SHA-256 `3e98ea485bd92dc9c2528d0420b5999a0336f700270c0f73f7630aa214fbd105`. buildings/campus CSV와 일치하며 v001 좌표를 사용하지 않는다.
- Unity **6000.3.24f1**, 실제 Play Mode 약 **67.39초**. 최종 [런타임 결과](city-rebuild-v002-phase6-runtime.json)는 `COMPLETE`, 컴파일 오류 0, 런타임 오류 0, 실행 중 경고 0, 500 units 경고 0이다.
- [실행 입력](city-rebuild-v002-phase47-runtime-inputs.json) 1,011개 파일이 현재 파일과 일치하고 `UNCHANGED_DURING_PLAY`다. 과거 실패 결과와 현재 입력이 다른 결과는 최종 PASS 근거로 재사용하지 않았다.
- QA 실행: `python3 scripts/unity/check-city-rebuild-v002-phase47.py --runtime` → exit 0, [21개 검사 결과](city-rebuild-v002-phase47-static-results.json) `PASS_EVIDENCE_REVIEW`. 검사기 자체는 Unity를 실행하지 않는다.
- Unity 담당의 별도 EditMode 회귀도 [실제 NUnit XML](city-rebuild-v002-final-tests.xml)로 검토했다. `NpcMovementTests` 11개 + `CityV002River*` 8개 = **19/19 PASS**, 실패·건너뜀 0. 경로 속도·서버 deadline 정지·NPC별 event pause·grounding·카메라 target·하천 횡단/높이/오염도 회귀를 포함한다.
- `python3 scripts/unity/check-city-rebuild-v002-surfaces.py` → exit 0, [표면 정적 검사](city-rebuild-v002-surface-results.json). 도로 4,938 / 보행 31,512 샘플 미지원 0; 생성면의 605개 Transform 및 상위 계층 identity 확인. Unity Physics 결과와는 별도 증거다.

## Phase별 구현·검증

| 단계 | 상태 | 최종 근거 |
|---|---|---|
| Phase 1–3 유지·복구 | PASS | 실제 Unity FBX provenance와 승인 배치 envelope 69/69 통과. 캠퍼스 14동, 외부 55동. 모델 원본·GUID 보존 |
| Phase 4 공원·녹지 | PASS | 공원 FBX 2개와 파생 메시, 잔디·산책로·휴식공간, 기존 FBX 나무 46개·추가 벤치 2개. 축 보정 후 실제 캡처 확인 |
| Phase 5 구역 간 보행 | PASS | 승인 388 nodes / 409 edges / 횡단 시설 17개 보존. 기존 하천 확장을 포함한 실제 graph 572 nodes / 597 edges; 요구 4개 경로 실제 왕복 통과 |
| Phase 6 카메라·성능 측정 | PASS | overview/top/follow/apartment 수치 검사 통과, 실제 PNG 생성. 1/100/500/1,000명 각각 측정 완료. 시각적 잔여 문제와 성능 한계는 아래 별도 표기 |
| Phase 7 독립 검사 | PASS | 현재 씬 입력과 실행 증거 일치, 21개 자동 검토 통과. 미검증 요구사항을 PASS로 바꾸지 않음 |

### 재개 중 발견·복구한 실제 실패

기존 baseline에도 C11 일부 canopy/parapet 및 B01/B31/B42 모델이 잘못 이동한 상태가 포함되어 있었다. 원본보존 PASS는 배치정확성 PASS와 다르다. [건물 복구 기록](city-rebuild-v002-building-recovery.json)의 7개 하위 Transform만 승인 배치/원본 축에 맞게 복구했고, [현재 Unity 건물 검사](city-rebuild-v002-phase47-building-audit.json)는 모든 실제 FBX envelope가 승인 좌표·크기와 0.025m 이내로 일치함을 확인했다. 나머지 65동 hierarchy는 baseline과 정확히 같다.

전체 캡처에서 지면 밖 회차 조각을 발견해 추가 조사했다. 교차·회차 3개, 보행면 13개, 횡단 stripe 50개가 `(-94,-186,0)`으로 이동해 있었다. [수정 전 독립 FAIL](city-rebuild-v002-surface-before-recovery.json)과 [66개 복구 기록](city-rebuild-v002-surface-recovery.json)을 보존한다. 기존 표면 검사기가 mesh local 좌표만 검사하는 허점을 수정해 모든 생성 지면 계층의 identity를 검사한다. 상위 Transform 이동·회전·축척 및 누락 그룹을 메모리에서 주입한 음성 대조도 각각 FAIL로 검출했다. 최종 캡처에서 지면 밖 조각은 사라졌다.

초기 CityGround의 627.293m 삼각형은 분할되었다. 최종 직렬화 검사와 실제 실행에서 500 units 초과 경고는 0이다.

## 필수 QA 판정

| 항목 | 상태 | 근거·범위 |
|---|---|---|
| Unity 컴파일 성공 / 씬 정상 로드 | PASS | 최종 Unity 실행이 실제 Play Mode까지 완료, compile/runtime 오류 0 |
| 실제 FBX 모델 / 캠퍼스 14동 / 외부 55개 | PASS | 하위 MeshFilter/Prefab GUID 추적 및 최신 Unity 69동 envelope audit |
| 도로 연결 정상 | PASS | 복구 후 생성면 Transform 검사와 실제 저장 삼각형 폭 샘플 지지; overview/top view 대조 |
| 보행로 연결 정상 | PASS | [최종 Unity Physics](city-rebuild-v002-final-physics.json) 전체 597 edges, 35,489 지지 샘플 미지원 0. 하천 영역 유한폭 capsule 7,461 샘플 관통 0, 실제 교량 지지 665 |
| 건물 간 충돌 없음 | PASS | 승인 건물 envelope 비중첩 + 실제 FBX envelope 일치. 건물 내 문턱/실내 clearance는 제외 |
| NPC 지면 위치 / 이동 | PASS | 4개 실제 왕복에서 지지 누락·높이 불일치·건물 관통 모두 0 |
| 카메라 추적 | PASS | 일반 추적 14,660프레임, 아파트 추적 320프레임에서 화면 이탈 0·지면 아래 0 |
| 아이소메트릭 전체 화면 가독성 | PASS | 최종 overview에서 도시 전체·구역·도로 식별, NPC 자세는 추적 뷰에서 확인 |
| 높은 아파트 뒤 NPC 식별 | PASS | reveal aperture에서 전신을 실제 이미지로 확인. shader 활성 수치만으로 판정하지 않음 |
| 아파트의 과도한 화면 점유 해소 | FAIL | NPC는 보이지만 아파트가 화면 대부분을 차지해 주변 도로/도시 맥락이 가려짐. 해당 시점의 구도 개선은 남음 |
| 기존 원본 씬 / Blender·FBX·메타 / 빌드 설정 보존 | PASS | 2,180파일 continuation baseline 보호 검사, 허용 범위 외 변경 0 |
| 기존 NPC 이동·grounding·Animator 호환 | PASS | 기존 TestNpcPatrol MoveTowards와 NpcGrounding을 graph adapter로 연결. 실제 활성 Animator/이동/grounding 수 측정 |
| 이벤트 90초·발생 로직 보존 | PASS | 이벤트/웹 코드 보호 해시 일치. 이벤트 실제 통합 회귀는 아래 미실행 |
| 실제 통행 가능한 문턱 및 문앞 접근 | NOT TESTED | [출입구 독립 검토](city-rebuild-v002-entry-access-review.md): portal 확정 **0/69동**. 구역 테스트는 B04/B16 exterior approach anchor에 도착함 |
| NavMesh bake / 문 연결 | NOT TESTED | 기존 MoveTowards 유지, NavMesh 패키지/bake 근거 없음 |
| 카탈로그 생성·검사 | PASS | [실행 기록](city-rebuild-v002-phase47-catalog-results.json): 4,711파일, 24동일내용 그룹, 오류 0. 전시 승인과는 별개 |

## 실제 NPC 왕복

경로 검증만 `Time.timeScale=20`으로 가속했다. 기존 프레임 기반 이동을 사용하며 모든 waypoint를 통과하고 목적지 및 출발지 도착 횟수는 각각 총 2회다. 실제 거리와 예상 거리 차이는 1m 미만이다. [세부 결과](city-rebuild-v002-navigation-runtime.json).

| 경로 | 실제 / 예상 왕복 거리 m | 프레임 | 지지 샘플 | 상태 |
|---|---:|---:|---:|---|
| 학교 ↔ 상업 | 390.33 / 390.54 | 5,782 | 5,835 | PASS |
| 학교 ↔ 주거 | 968.32 / 968.78 | 14,698 | 14,757 | PASS |
| 학교 ↔ 공원 | 456.05 / 456.28 | 6,896 | 6,949 | PASS |
| 주거 ↔ 상업 | 811.05 / 811.40 | 12,580 | 12,635 | PASS |

## 카메라 캡처와 설정

직접 열어 본 최종 PNG의 해시와 시각 판정은 [시각 검토 기록](city-rebuild-v002-phase7-visual-review.json)에 있다.

- [도시 전체](city-rebuild-v002-captures/overview-game-playmode.png), [탑뷰](city-rebuild-v002-captures/top-view-game-playmode.png), [공원](city-rebuild-v002-captures/park-game-playmode.png).
- [이동 NPC 추적](city-rebuild-v002-captures/npc-follow-game-playmode.png), [아파트 뒤 NPC 추적](city-rebuild-v002-captures/npc-follow-apartment-game-playmode.png).

[카메라 설정 기록](city-rebuild-v002-camera-settings.json)의 최종 증분 실행 전후 값은 동일하다: overview 260m, top 235m, 최대 zoom 350m, follow 12.75089m, pitch 28.85°, yaw −131.64°. 과거 수정은 기존 170m zoom clamp로 overview가 축소되던 문제와 v002 occlusion root 연결이다. 이번 실행은 실제 1920×1080 capture aspect로 검증했고 아파트 actor 초기화 후 추적을 시작했다. 설정 JSON의 `NOT TESTED until ... exists`는 실행 전 문자열이며, 최종 실행 판정은 최신 runtime JSON과 이 보고서가 대체한다.

## 단계별 성능

실제 FBX skinned NPC + Animator + TestNpcPatrol + NpcGrounding + graph adapter를 각각 정확히 1/100/500/1,000개 활성화해 모두 이동함을 확인했다. timeScale=1, VSync 해제, 목표 FPS 제한 해제, 2초 예열 후 약 5초 측정, **매 측정 프레임 1920×1080 Camera.Render**를 호출했다. CPU는 Editor 프로세스 전체 CPU ms/frame이며 메모리도 Editor 오버헤드를 포함한다.

| NPC | FPS | 프로세스 CPU ms/frame | Unity allocated MiB | 프로세스 working set MiB | 측정 상태 |
|---:|---:|---:|---:|---:|---|
| 1 | 62.40 | 18.31 | 410.9 | 183.5 | PASS |
| 100 | 41.71 | 35.95 | 425.1 | 196.9 | PASS |
| 500 | 15.09 | 112.04 | 482.7 | 346.3 | PASS |
| 1,000 | 8.25 | 213.35 | 550.7 | 559.3 | PASS |

이 PASS는 측정 수행을 뜻한다. **500명 15.09FPS, 1,000명 8.25FPS로 전시 성능 목표 달성을 주장할 수 없다.** Player/WebGL, 타깃 하드웨어, 이벤트/백엔드 부하, 군중 회피는 포함하지 않았다. LOD·업데이트 가시범위·GPU instancing/Static Batching의 효과 비교 벤치마크는 NOT TESTED다.

## 보호 범위와 남은 검증

[continuation baseline](city-rebuild-v002-phase47-continue-baseline.json)과 승인 설계 원문·기존 원본·메타·NPC/이벤트·웹·빌드 설정을 대조했다. 기존 작업을 되돌리지 않았고 v002 작업 씬과 사용자 허용 카메라/검증 코드만 변경 대상으로 인정했다. 4개 건물 복구 예외는 최신 Unity scene SHA와 69/69 실제 envelope PASS가 있을 때만 허용한다.

이번 QA 담당은 Unity를 별도로 실행하지 않고 Unity 담당의 최신 Play Mode 및 EditMode 19개 실제 실행 증거를 검토했다. 웹·백엔드 변경이 없어 웹 lint/typecheck, DB 통합·Web–Unity bridge 및 서버 이벤트 발생 통합 회귀는 실행하지 않았다. 실제 문턱 69동, NavMesh, 실사용 군중 회피, 장시간 안정성, 전체 도시 모든 지점의 연속 시야 및 타깃 디스플레이 가독성은 미검증이다. 승인된 도시 배치의 Unity 구현·4개 구역 이동과 최종 화면 확보가 이루어졌으며, 위 FAIL/NOT TESTED를 전시 완성 승인으로 대체하지 않는다.
