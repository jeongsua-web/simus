# City Rebuild v002 — Phase 8-A/B 독립 QA

검토일: 2026-10-18 KST. **Phase 8-A 카메라와 8-B 도시 시각 개선은 아래 실제 Unity 검증 범위에서 PASS**다. 기존 21개 검사 범주 중 **20 PASS / 0 FAIL / 1 NOT TESTED(성능)**, EditMode **22/22 PASS(기존 19 + 신규 3)**다. Phase 8-C 조명과 8-D 성능은 사용자 검토 이후 작업으로 남겼다. 전시 미술 최종 승인과 타깃 기기 승인을 뜻하지 않는다.

## 현재 실행 증거

- Unity **6000.3.24f1**, 실제 Play Mode Game 카메라 **1920×1080 Camera.Render** PNG. Blender 렌더나 합성 화면을 Unity 증거로 쓰지 않았다. 편집기 UI 프레임이 포함된 스크린샷은 아니다.
- [현재 씬](../../unity/Assets/SIMUS/Scenes/city_rebuild_v002/CityRebuild_v002.unity) SHA-256: `4f41426a9078ff372bd31168977f074cea8128a9093a70da8ab9c0142a2dc219`.
- [실행 입력](city-rebuild-v002-phase8-after-inputs-after.json) **2,489개**, `UNCHANGED_DURING_PLAY`, 현재 파일과 불일치 0. [실제 런타임](city-rebuild-v002-phase8-after-runtime.json) `PASS`, 보고된 런타임 오류 0.
- 독립 실행: `python3 scripts/unity/check-city-rebuild-v002-phase8.py --runtime` → [보호·회귀 결과](city-rebuild-v002-phase8-protection-results.json) `PASS_AB_EVIDENCE_WITH_DEFERRED_PERFORMANCE`. 보호 검사 6개 PASS, 취득/전환 별도 검사 PASS. 이 Python 검사기는 Unity를 실행하지 않고 실제 Unity 출력과 현재 파일을 대조한다.
- 메인 에이전트가 최종 소스로 실행한 [EditMode XML](city-rebuild-v002-phase8-tests.xml): **2026-10-18 14:26:33Z**, 22 passed / 0 failed / 0 skipped. 기존 `NpcMovementTests` 11개와 하천 테스트 8개는 수정 없이 회귀했다. 추가 3개는 context fade 기본 비활성, reveal 비활성 시 가시성 복구 및 다른 property block 값 보존, shader 기본 불투명 동작을 검증한다.
- [카탈로그 실행 기록](city-rebuild-v002-phase8-catalog-results.json): 생성·`--check` 모두 exit 0, **5,196파일 / 25 동일 내용 그룹 / 오류 0**. 신규 소품은 `received` 상태이며 카탈로그 PASS를 `approved`로 바꾸지 않았다.

## 기존 21개 검사 회귀

수정 전 원래 검사기 [21/21 PASS](city-rebuild-v002-phase8-before-regression.json)를 확보했다. 원래 Phase 7 검사기는 변경하지 않았으며 [현재 원본 검사 출력](city-rebuild-v002-phase8-legacy-regression.json)도 보존한다. 이 출력의 과거 씬·실행 해시 불일치를 숨기지 않고, 다음 동일 범주에 최신 Phase 8 증거를 연결했다. 과거 성능 결과를 현재 성능 PASS로 재사용하지 않았다.

| 번호 | 기존 검사 범주 | 상태 | 현재 근거 |
|---:|---|---|---|
| 1 | 보호 baseline | PASS | Phase 8 시작 전 5,886파일 해시, 허용 A/B 필드 외 변경 0 |
| 2 | 승인 layout 불변 | PASS | 승인 SHA `3e98ea485bd92dc9c2528d0420b5999a0336f700270c0f73f7630aa214fbd105` 유지 |
| 3 | CSV와 승인 배치 일치 | PASS | 원래 검사 유지 |
| 4 | 승인 건물 envelope 비중첩 | PASS | 원래 검사 유지 |
| 5 | 승인 388 nodes / 409 edges / 횡단 17개 | PASS | 원래 승인 네트워크 유지 |
| 6 | 씬 local reference | PASS | 현재 씬 참조 검사 |
| 7 | 외부 GUID | PASS | 현재 GUID 검사, 기존 `.meta` 보존 |
| 8 | 캠퍼스 14 + 외부 55동 | PASS | 현재 씬 wrapper 검사 |
| 9 | 69동 예상 FBX provenance | PASS | 현재 hierarchy와 FBX GUID |
| 10 | 건물 hierarchy 보존 | PASS | 기존 Transform·Mesh·Collider 정확 보존, material 참조만 허용 |
| 11 | 실제 Unity 69동 envelope | PASS | 최신 [69동 audit](city-rebuild-v002-phase8-building-audit.json), 현재 씬 SHA 일치, 오차 ≤ 0.025m |
| 12 | 기존 공원 FBX 2개 | PASS | 기존 참조 유지 |
| 13 | 생성 표면 hierarchy identity | PASS | 기존 도로·보행 표면 Transform 유지 |
| 14 | 메시 triangle edge 500m 미만 | PASS | 현재 생성 메시 검사 |
| 15 | 런타임 증거 존재 | PASS | 최신 Phase 8 Play/Physics/입력/왕복 출력 |
| 16 | 전체 graph 실제 물리 지지 | PASS | 572 nodes / 597 edges, 아래 물리 결과 |
| 17 | 런타임 입력이 현재 소스와 일치 | PASS | 2,489파일 현재 해시 일치 |
| 18 | 런타임 오류 없이 완료 | PASS | 최신 Play `PASS`, errors 빈 배열 |
| 19 | 4개 실제 왕복·ground/collision | PASS | 각 2회 도착, 모든 waypoint 통과, 위반 0 |
| 20 | 카메라 수치·실제 캡처 | PASS | 추적 2,065프레임 화면 이탈/지면 아래 0, 7쌍 실제 PNG |
| 21 | 1/100/500/1,000 NPC 성능 | NOT TESTED | Phase 8-D 보류. 현재 성능 비교 없음 |

## 카메라 비교와 최종 판정

원래 카메라/씬/소스와 Phase 7 증거는 [baseline](city-rebuild-v002-phase8-baseline.json) 및 [백업 폴더](city-rebuild-v002-phase8-baseline/)에 보존했다. 같은 B16 exterior anchor에서 거리·각도 후보를 실제 렌더했다. pitch 42°/size 17과 50°/18은 여전히 파사드 점유가 컸다. size 26 후보는 맥락은 넓어지지만 NPC가 너무 작아졌다. [후보와 직접 이미지 검토 기록](city-rebuild-v002-phase8-visual-review.json)을 근거로 **pitch 48°, yaw −36°, orthographic size 21, follow smoothing 0.35초**, reveal radius 4.2m, context radius 9m, 건물 잔여 visibility 0.05를 선택했다. 이 size는 원근 카메라 거리와 다르다.

기존 aperture와 추가 건물 context fade를 함께 적용해 아파트 뒤 NPC 전신과 도로·보도·주차 구획을 동시에 확인했다. 정적 지역 뷰는 reveal을 해제해 건물 가시성을 복구한다. 새 기능은 scene opt-in이며 기존 장면의 기본 추적 취득 동작을 바꾸지 않는다.

초기 취득과 표적 변경도 이 씬에서는 부드럽게 이동한다. 실제 경과 시간을 Follow 시작 시 초기화하고 한 프레임 easing 시간은 최대 1/30초로 제한한다. [4개 실제 전환](city-rebuild-v002-phase8-after-transitions.json)은 NPC 경로 시간을 멈춘 상태에서 첫 표시 프레임부터 카메라 LateUpdate 이후 측정했다. 허용 한계 pan 42m/s, 회전 21°/s, zoom 126units/s는 실패 후 완화하지 않았다.

| 전환 | 시간 | 최대 pan m/s | 최대 회전 °/s | 최대 zoom units/s | 첫 camera step m | 상태 |
|---|---:|---:|---:|---:|---:|---|
| 공원 정적 뷰 → 캠퍼스 NPC | 5.40초 | 39.70 | 20.05 | 99.89 | 0.0140 | PASS |
| 캠퍼스 → 아파트 NPC | 6.27초 | 39.73 | 0 | 0 | 0 | PASS |
| 아파트 → 왕복 시작 NPC | 6.27초 | 39.66 | 0 | 0 | 0.000015 | PASS |
| 왕복 종료 → 아파트 NPC | 6.27초 | 40.02 | 0 | 0 | 0 | PASS |

회전 시 360m 카메라 arm이 움직이므로 camera world step과 target pan 속도를 혼동하지 않았다. 취득 완료 후 target 오차는 모두 0.05m 미만이다. 별도 실제 시간 2초 연속 추적은 **121프레임**, 최대 step **0.02354m**, 최대 속도 **1.42409m/s**, 회전·zoom 변화 0으로 기준 1.5m/s 이내다. 도시를 가로지르는 취득 중 표적이 계속 화면 안에 있다는 보장은 하지 않는다. 전신/화면 이탈 판정은 취득 완료 후 추적 범위다.

## 도시 시각 개선과 실제 화면

기존 건물 원형과 배치를 유지하고 211개 씬 전용 material variant, 차선·교차로/회차부 표시, 보도 대비, 광장/마당/주차면, 간판 패널, 화단·벤치·가로등 121개를 추가했다. 신규 Blender 소품 3종은 별도 원본/FBX이며 [실제 Blender 재가져오기 검증](city-rebuild-v002-phase8-blender.md)이 있다. 소품 배치는 graph 폭과 여유 거리, 도로·건물·기존 collider를 제외하는 조건을 적용했고 신규 collider는 0이다. 기존 나무·운동장·공원 경로를 유지했다. 기존 Blender/FBX/material 파일 자체는 바꾸지 않았다.

[7쌍 전후 비교 페이지](city-rebuild-v002-phase8-captures/index.html)에서 원본 크기로 확인할 수 있다. 정적 5개 뷰는 동일 pose, NPC 뷰는 동일 actor/anchor에서 변경 전후를 비교한다. 비교 PNG는 실제 Unity 원본 두 장을 배치한 제출용 자료다.

| 항목 | 변경 전 | 변경 후 | 판정 |
|---|---|---|---|
| 도시 전체 | [Before](city-rebuild-v002-phase8-captures/before/01-city.png) | [After](city-rebuild-v002-phase8-captures/after/01-city.png) | PASS — 전체 배치/구역/도로·하천 식별 |
| 학교 | [Before](city-rebuild-v002-phase8-captures/before/02-school.png) | [After](city-rebuild-v002-phase8-captures/after/02-school.png) | PASS — 광장, 운동장 주변, 휴식 가구 |
| 상업지역 | [Before](city-rebuild-v002-phase8-captures/before/03-commercial.png) | [After](city-rebuild-v002-phase8-captures/after/03-commercial.png) | PASS — 전면 포장/주차/가로등 |
| 주거지역 | [Before](city-rebuild-v002-phase8-captures/before/04-residential.png) | [After](city-rebuild-v002-phase8-captures/after/04-residential.png) | PASS — 마당/주차/화단 |
| 공원 및 하천 | [Before](city-rebuild-v002-phase8-captures/before/05-park-river.png) | [After](city-rebuild-v002-phase8-captures/after/05-park-river.png) | PASS — 수면·둔치·산책로·2개 교량 유지 |
| NPC 추적 | [Before](city-rebuild-v002-phase8-captures/before/06-npc-follow.png) | [After](city-rebuild-v002-phase8-captures/after/06-npc-follow.png) | PASS — 단일 NPC 전신과 주변 광장 |
| 아파트 NPC 추적 | [Before](city-rebuild-v002-phase8-captures/before/07-apartment-follow.png) | [After](city-rebuild-v002-phase8-captures/after/07-apartment-follow.png) | PASS — 전신과 도로/보도 맥락 확보 |

수질 endpoint 색만 clean `#55A9B4` / polluted `#777B43`로 조정했다. 실제 Play에서 [오염도 0](city-rebuild-v002-phase8-captures/after/08-river-clean-0.png)의 파랑과 [100](city-rebuild-v002-phase8-captures/after/09-river-polluted-100.png)의 올리브 변화를 직접 확인했다. 테스트 후 기존 pollution/followCityState를 복구했다. 하천 컴포넌트 코드·오염도 연결·지형/collider는 그대로다. 라이브 백엔드 상태 전달까지의 통합 검증은 포함하지 않는다.

## 이동·하천·기존 기능 보호

[최신 Unity Physics](city-rebuild-v002-phase8-physics.json)는 현재 씬 SHA와 일치한다. graph **35,489 지지 샘플에서 미지원 0**, 유한폭 capsule **7,461샘플에서 차단 0**, 실제 교량 지지 **665**, 물 영역 위반 0이다. 하천 단면 86샘플에서 이전 평지 잔존/바닥 누락 0, river bed −2m / water −1.2m / ground −0.02m를 유지한다.

[실제 4개 왕복](city-rebuild-v002-phase8-navigation-runtime.json)은 경로 검사만 `Time.timeScale=20`으로 가속했다. 성능 측정이나 실시간 카메라 전환 검증으로 사용하지 않았다.

| 경로 | 실제 / 예상 거리 m | 프레임 | 지지 샘플 | 상태 |
|---|---:|---:|---:|---|
| 학교 ↔ 상업 | 390.543 / 390.545 | 842 | 1,678 | PASS |
| 학교 ↔ 주거 | 968.774 / 968.782 | 2,066 | 4,132 | PASS |
| 학교 ↔ 공원 | 456.262 / 456.276 | 984 | 1,958 | PASS |
| 주거 ↔ 상업 | 811.372 / 811.400 | 1,728 | 3,463 | PASS |

각 경로 모든 waypoint·2회 도착을 확인했고 지지 누락, grounding 불일치, 건물 관통은 모두 0이다. 기존 NPC 이동/Animator/Grounding/이벤트 및 웹 코드는 보호 해시와 일치한다. 이벤트별 pause와 deadline 정지는 기존 EditMode 회귀에서 PASS다. 서버 이벤트 발생부터 Unity까지의 통합 실행 PASS를 주장하지 않는다.

## 발견한 실패와 수정 이력

- [첫 실패](city-rebuild-v002-phase8-attempt1-failed/): 공원 overlay가 낮은 수면을 덮음, 정적 뷰 잔여 투명화, 너무 밝은 palette, 테스트 actor 초기화 순서와 측정 타이밍 오류. 공원 overlay 제외, reveal 복구, palette 조정, 경로 시작 후 monitor 구성으로 재검증했다.
- [두 번째 시도](city-rebuild-v002-phase8-attempt2-acquisition-snap/): 안정 추적은 PASS였지만 최초 취득 약 172m snap이 남아 A 요구사항 완료로 인정하지 않았다. opt-in 취득/회전/zoom easing을 추가했다.
- [세 번째 실패](city-rebuild-v002-phase8-attempt3-acquisition-timing-failed/): 동기 캡처 이전 프레임의 delta가 첫 취득에 적용되어 4개 전환 중 3개 FAIL. 첫 샘플을 제외하거나 한계를 늘리지 않고 실제 경과 clock 초기화·bounded delta와 LateUpdate 관측으로 수정했다. 최종 4/4 PASS와 새 22개 테스트로 대체했다.

## 보류와 남은 위험

| 항목 | 상태 | 이유/범위 |
|---|---|---|
| Phase 8-C 조명·그림자·Color Grading·AO | NOT TESTED | 사용자 요청으로 보류. Built-in pipeline 확인, 기존 light/environment/프로젝트 설정 보존 |
| Phase 8-D Profiler/병목/성능 최적화 | NOT TESTED | 사용자 검토 이후. 새 성능 측정·개선 주장 없음 |
| 69동 실제 출입문/문턱·NavMesh | NOT TESTED | 기존 exterior approach anchor 기반, doorway 확정·bake 없음 |
| 웹 lint/types/DB·Web–Unity bridge 통합 | NOT TESTED | 해당 코드/계약 변경 없음. 공유 DB에 테스트 실행하지 않음 |
| 타깃 하드웨어/Player/WebGL·장시간·모든 위치 | NOT TESTED | 이번 실제 Editor 검증 범위 밖 |
| 전시 디스플레이 최종 미술 승인 | NOT TESTED | 사용자 검토 필요. NPC는 약 25px 높이로 작고 디더 점무늬/일부 발코니 윤곽이 남음 |

성능 기준선은 Phase 7의 **1 NPC 62.40 / 100 NPC 41.71 / 500 NPC 15.09 / 1,000 NPC 8.25 FPS** 그대로다. 이번 60 FPS target 설정은 카메라 관측용 fixture에만 적용했으며 프로젝트 성능 최적화가 아니다. 화면 비교를 위해 actor를 고정/비활성화한 캡처도 동일 NPC 부하 성능 개선으로 계산하지 않았다. 새로운 맵 버전·상황 좌표·전시 채택 상태를 확정하거나 Neighborhood 좌표를 가져오지 않았다.
