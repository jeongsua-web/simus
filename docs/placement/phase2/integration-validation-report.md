# SIMUS Phase 2 — 12개 장소 상황 통합 검증 및 수정

검증일: 2026-11-03. 전시 승인 및 운영 배포 보고가 아닌 로컬 시험 결과다.

**장소 기반 체인: 실제 수정본 WebGL PASS 12/12, FAIL 0/12, 미완료 0/12. 최대 90초 상한: FAIL.** 90초가 되면 어디서든 발생시키는 정책은 적용하지 않았다. 최종 수용 조건 전체를 PASS로 처리하지 않는다.

## 범위와 보호한 데이터

- 시작 시 `git status --short`는 깨끗했다. 관련 런타임·검증 코드·매핑 경로 메타데이터·보고서·에셋 목록만 변경했다.
- map_version=`test-only-city-rebuild-v002-phase1-v1`, path_version=`city-rebuild-v002-walk-phase1-v1`, `exhibition_ready=false` 유지. Neighborhood 좌표를 사용하지 않았다.
- 30개 문항·91개 선택지·원본 UUID·개인 성향/도시/지역 기본 수치·12개 좌표·반경은 변경하지 않았다. 18개 미완료 위치는 NULL을 유지했다.
- 새 임시 PostgreSQL 클러스터만 생성해 사용했다. 운영 DB 연결·마이그레이션·초기화·EC2 배포·커밋·Push는 하지 않았다.

## 문서와 코드의 불일치 및 수정

| 문제 | 근거 | 수정/상태 |
|---|---|---|
| “준비 12개”는 실행 완료가 아님 | 기존 implementation-report는 QA·SQL 적용·브라우저 검사를 미실행으로 명시 | 이번 실행 결과는 이 보고서와 증거 JSON으로 별도 기록 |
| 장소 API가 TypeScript 빌드를 차단 | `unknown`인 map_version을 그래프 조회에 전달 | version() 검증 뒤 string으로 조회. 웹 빌드 통과 |
| 28번 진입 이벤트 누락 | 110.882 → 86 보행 구간, 1.2m/s에서 entry=1인데 firstEntry=null | 반올림 경계의 다음 1ms가 실제 반경 안일 때만 사용. 접선/반경 밖 강제 발생 없음 |
| 서버는 도착했지만 Unity NPC는 원점에 고착 | 수정 전 5번 실제 WebGL에서 Unity [0,0,0], 서버 약 [145.6854,0.16,26.09335] | 서버 NPC clone의 CityV002RiverGuard만 비활성화. 서버 그래프 경로와 서로 다른 로컬 chord 검사의 충돌 제거. 환경 순찰/원본 템플릿 guard 유지 |
| 폴링 중 제출 클릭이 무시됨 | submit()이 loadingState일 때 조용히 return; 실제 클릭 후 POST 미발생 재현 | 진행 중 폴링 완료 Promise를 기다린 뒤 같은 제출 계속. busy/원장 멱등성 유지. 실제 응답 지연 중 단일 클릭 검사 |
| 10/22의 scene_path가 실제 오브젝트 경로 아님 | `C04_ACCESS`는 그래프 노드 ID | `CityRebuild_v002/06_CampusBuildings_14/C04_중앙동 A`로 메타데이터만 수정 |
| 기존 회귀 fixture가 현재 계약을 반영하지 못함 | NPC revision 추가, DRAFT 외부 맵 차단, 가입 경로 스냅샷 제약, 오래된 iframe 경로 | revision 별도 검사, 과거 RUNNING 외부 맵 fixture 분리, runtime resume_motion 사용, 실제 iframe에서 프레임 조회 |
| 최대 90초 대기 요구와 현재 계약 충돌 | 코드/계약은 60초 유도, 90초 overdue 진단, deadline_at=null | 91초 경과 후 GUIDING/event=null을 실측. **FAIL 유지**. 원거리 강제 이벤트·텔레포트·임의 속도 변경으로 감추지 않음 |

## 시험 방법과 한계

1. 정적 검증: Phase 1의 8개 위치 보존, 12 READY/18 blocked, 579노드·604간선, 모든 노드 연결성, 69개 건물 footprint 밖 35,520 표본과 교량 우회 검사.
2. 실제 Unity 저장 씬: 광장→12곳과 접근 구간의 **11,662개** 0.25m 표본에 지면 지지 및 반경 0.2m 보행 캡슐 검사. 12개 실제 scene_path 확인. 누락 지면·고정 Collider 충돌 0. Collider가 없는 대상은 Renderer AABB 여유도 기록. 이는 NavMesh 전체 bake나 모든 임의 경로의 안전 인증이 아니다.
3. 임시 DB: 관리형 init 001–018 적용, Phase 2 DRAFT SQL 두 번 적용, 콘텐츠/위치 불변성 확인. 새 DRAFT 30/91을 원문 JSON과 대조. 각 준비 상황의 모든 선택지 **37개**를 실제 API로 제출하고 개인 성향·도시 3종·지역 오염·요청/적용 delta 원장·도시 version을 검사.
4. 동시성/복구: 이벤트 6개 동시 조회, 같은 키 선택 4회 동시 제출에서 201 한 번/200 세 번 및 원장 1개, 서버 재시작, 응답 후 이동 재개, 10/22의 이탈/재진입을 확인. 전체 격리 회귀는 1,000명 실제 장소 도착까지 통과.
5. Unity: 기존 원본 프로젝트 47개 EditMode 통과. 수정 후 독립 복제 프로젝트에서 새 하천 guard 회귀를 포함한 **48개 통과**. 복제 시 serialized 씬/프리팹/재질/컨트롤러/asset에서 참조가 0개인 .blend 원본 32개만 제외했고 FBX·GUID·저장 씬은 유지했다.
6. 새 로컬 WebGL 빌드 성공. 처음에는 디스크/임시 파일 생성 오류로 실패했으나 자체 생성 캐시 정리와 APFS 복제본 공간 확보 후 재시도 성공. 원본 모델·씬을 바꾸지 않았다. WebGL 지원 모듈은 에디터 루트 PlaybackEngines/WebGLSupport에 설치돼 있다.
7. 실제 Chromium 390×844 참가 화면: 준비된 장소 하나만 활성화한 독립 시험 회차를 사용한다. WASM 로딩 중 도착이 끝나는 일을 막기 위해 READY까지 시험 NPC를 정지하고, 이후 runtime motion을 실제 시각/1.2m/s로 시작한다. 가입 스냅샷은 보존한다. 브라우저 시간 빨리 감기·API 응답 대체·좌표 반경 확대는 사용하지 않았다.
8. 실제 Unity 인스턴스의 이동 → 반경 도착/서버 좌표 일치 → 원문·전체 선택지 표시 → 정지 → 첫 선택지를 화면에서 1회 제출 → DB/성향/도시/지역 원장 반영 → 실제 이동 재개를 검사한다. 나머지 선택지의 브라우저 클릭은 미검증이며 API에서는 전부 검사했다.

## 상황별 결과

좌표는 Unity world [X,Y,Z] m. 아래 최종 상태는 **실측한 장소 기반 체인**에 대한 판정이다. 요구사항 전체의 90초 상한 FAIL은 공통으로 별도 적용되며, 이 표의 PASS를 전시/모든 요구사항 승인으로 해석하지 않는다. E=실제 Unity 씬 물리 검사, A=실제 API+임시 DB 모든 선택지, B=실제 수정본 WebGL 참가 화면.

| ID / 이름 | 장소 ID | Unity 좌표 | 반경 | NPC 접근 | 이벤트 | 선택·스탯 | 방식 | 최종 상태 | 문제·수정·한계 |
|---|---|---|---:|---|---|---|---|---|---|
| EXHIBITION_02 / 빨간불인데 차가 한 대도 없다 | `city_v002_gate_crossing` | [0, 0.16, -56.25] | 1.5m | E PASS / B PASS | PASS | PASS (3개 A) | E+A+B | **PASS** | 진입 시각 반올림 누락 수정의 회귀 범위. 폴링 지연 중 단일 클릭 저장 검사 포함. |
| EXHIBITION_05 / 길을 잃은 아이가 울고 있다 | `city_v002_crying_child` | [147.158345, 0.16, 26.376605] | 1.5m | E PASS / B PASS | PASS | PASS (3개 A) | E+A+B | **PASS** | 기존 WebGL은 원점에 남아 서버와 약 148m 불일치. 서버 인스턴스의 로컬 하천 chord guard 해제 후 재검증. |
| EXHIBITION_07 / 불법 주차된 차 때문에 통행이 어렵다 | `city_v002_illegal_parking` | [-143, 0.16, -8.3] | 1.5m | E PASS / B PASS | PASS | PASS (3개 A) | E+A+B | **PASS** | 차량 Collider 없음. 실제 Renderer AABB 경로 여유 약 0.505m를 추가 검사. |
| EXHIBITION_10 / 친구가 시험에서 부정행위를 하자고 한다 | `C04_ACCESS` | [-41.1685, 0.16, 67.139] | 2m | E PASS / B PASS | PASS | PASS (4개 A) | E+A+B | **PASS** | scene_path를 그래프 ID에서 실제 C04 건물 경로로 수정. 22번과 공유 장소. |
| EXHIBITION_12 / 가까운 거리에 이동해야 한다 | `ENV_Bin_BusStop` | [60, 0.16, -56.65] | 2m | E PASS / B PASS | PASS | PASS (3개 A) | E+A+B | **PASS** | 쓰레기통/정류장 외부 보도 접근점. 교통수단 승하차 연출은 범위 밖. |
| EXHIBITION_13 / 꽃밭에 들어가면 사진이 잘 나올 것 같다 | `city_v002_park_flowerbed` | [155.90806, 0.16, 126.702969] | 1.5m | E PASS / B PASS | PASS | PASS (3개 A) | E+A+B | **PASS** | 기존 WebGL에서 원점 고착 재현. 하천 guard 수정의 재검증 대상. 꽃밭 AABB 여유 약 0.527m. |
| EXHIBITION_16 / 이웃이 무거운 짐을 들고 있다 | `NPC_HeavyCarrier_ApartmentWalk` | [-186.85, 0.16, 112.7144] | 2m | E PASS / B PASS | PASS | PASS (3개 A) | E+A+B | **PASS** | 고정 접근점과 운반자 이동 구간 확인. 운반자와의 동적 충돌·조우 시각 동기화는 미검증. |
| EXHIBITION_17 / 동네 축제 자원봉사자를 모집한다 | `city_v002_festival_info` | [11.538184, 0.16, 103.113135] | 1.5m | E PASS / B PASS | PASS | PASS (3개 A) | E+A+B | **PASS** | 안내 부스 기존 외부 보행선. 추가 연출·모집 원문 변경 없음. |
| EXHIBITION_18 / 길고양이에게 먹이를 주고 싶다 | `city_v002_park_cat` | [158.259684, 0.16, 50.839311] | 1.5m | E PASS / B PASS | PASS | PASS (3개 A) | E+A+B | **PASS** | 기존 고양이와 보행 접근점. 하천 guard 수정의 재검증 대상. |
| EXHIBITION_22 / 친구가 다른 사람의 비밀을 알려줬다 | `C04_ACCESS` | [-41.1685, 0.16, 67.139] | 2m | E PASS / B PASS | PASS | PASS (3개 A) | E+A+B | **PASS** | 실제 C04 경로로 메타데이터 수정. 같은 방문 중 10/22 연속 발생 방지 검사 통과. |
| EXHIBITION_28 / 행사 때문에 도로가 통제됐다 | `city_v002_road_control` | [86, 0.16, -65.75] | 1.5m | E PASS / B PASS | PASS | PASS (3개 A) | E+A+B | **PASS** | 1.2m/s에서 반경 진입을 놓치던 부동소수점 경계 오류를 재현·수정. |
| EXHIBITION_30 / 도시 광장에서 정체불명의 상자를 발견했다 | `city_v002_mystery_crate` | [15, 0.16, 115] | 1.5m | E PASS / B PASS | PASS | PASS (3개 A) | E+A+B | **PASS** | 상자 중심 대신 기존 3m 이격 보행 접근점 유지. |

검증된 새 WebGL은 `web/public/city-rebuild-v002-phase1/`에 로컬 반영했다. 이전 7개 파일은 `web/.unity-deploy-backups/phase2-20261103-before-fix/city-rebuild-v002-phase1/`에 보존했고, 이동·해시 기록은 [자산 이동 기록](../../../assets/catalog/moves-2026-11-03-phase2-webgl.json), 새 파일 7개의 SHA256과 빌드 정보는 [build-provenance.json](integration-evidence/build-provenance.json)에 있다. `qa_executed=true`와 준비된 12개의 `physical_access_verified=true`를 검사 범위에 맞게 기록했으며, `exhibition_ready=false`와 나머지 18개 상태는 유지했다.

각 상황의 참가자/회차/선택 원장 식별자, 실제 Unity·서버 좌표, 이동 전후 관측값, 오차, 지연 중 클릭 결과는 [results.json](integration-evidence/results.json)에 있다. 정밀 좌표는 [매핑 JSON](../../../web/src/lib/data/city-v002-event-mapping.json), 물리 표본은 [unity-spatial.json](integration-evidence/unity-spatial.json), 48개 테스트는 [unity-editmode.xml](integration-evidence/unity-editmode.xml)을 참조한다.

[12개 실제 참가 화면 모음](integration-evidence/contact-sheet.png). 이번 독립 시험의 가입→이벤트 발생 최대 시간은 47.212초, 도착한 서버·Unity의 수평 위치 최대 오차는 0.000008m 미만이었다. 이 짧은 접근 시험의 관측 시간이 일반 회차의 90초 상한 보장을 뜻하지는 않는다.

## 아직 PASS로 처리하지 않은 항목

- **FAIL — 90초 상한:** 현재는 실제 장소 진입만 발생 조건이다. 60초 뒤 유도하더라도 남은 실제 보행 거리가 30초 이동 가능 거리보다 길 수 있다. 임시 DB의 waiting_since를 91초 전으로 설정한 검사에서 event=null인 실제 서버 상태를 저장했다. 브라우저의 시계를 빨리 감은 검사가 아니다. 시간만으로 미완료/먼 장소 이벤트를 발생시키지 않았다. 도착 규칙을 유지하면서 보장하려면 사전 경로/목적지 선택과 유도 시작 시점의 별도 설계가 필요하다.
- **NOT TESTED — 이동 운반자와의 동적 충돌·정확한 조우 시각**, 모든 시간대/모든 NPC 속도/모든 폴링 주기의 전 맵 경로, 차량·보행 신호의 교통 제어, 모바일 실제 기기 성능/전시 인원 GPU 부하. 고정 장애물과 그래프 접근 검사로 이를 대체하지 않았다.
- **NOT TESTED — 별도 Unity PlayMode 전체 회차 자동 시험.** EditMode/실제 WebGL 실행을 구분한다. 전체 회귀에서 생략된 일반 브라우저·Unity Play 시험은 별도로 PASS에 합산하지 않았다.
- 18개 미완료 상황은 신규 활성화하지 않았으며 전체 30개를 완료로 표시하지 않는다.

## 나머지 18개 상황과 다음 우선순위

| ID / 이름 | 현재 미완료 사유 | 다음 작업 | 우선순위 |
|---|---|---|---|
| EXHIBITION_01 / 길에 쓰레기가 떨어져 있다 | 도로/쓰레기통 접근점은 있으나 떨어진 쓰레기 표현 근거 없음. 장소 후보만 기록. | 떨어진 쓰레기 상태/시야 배치와 반경 진입을 검증 | P1 |
| EXHIBITION_03 / 누군가 지갑을 떨어뜨렸다 | 광장 접근 가능. 떨어진 지갑 미배치. | 분실 지갑과 소유자/접근 시야 배치 | P1 |
| EXHIBITION_04 / 버스 정류장에서 누군가 새치기한다 | 정류장 bounds 앞 보도 접근 가능. 대기 줄/새치기 상황 미표현. | 정류장 대기 줄·새치기 인물과 통과 여유 설계 | P1 |
| EXHIBITION_06 / 공원에서 누군가 큰 소리로 음악을 틀고 있다 | 공원 접근 가능. 음악 재생자/음원 상황 미표현. | 음악 재생자·오디오/상태 연출을 연결 | P1 |
| EXHIBITION_08 / 카페 직원이 거스름돈을 더 줬다 | 카페 북쪽 전면/door_x 근거의 외부 접근 후보. 연결된 포장/실제 출입구까지의 경로 근거가 없어 그래프를 연장하지 않음. | 실제 문 위치·연속 포장·문턱/내부 접근을 실측해 카페 경로 설계 | P0 |
| EXHIBITION_09 / 지하철에서 자리가 하나 났다 | 지상 출입구만 존재. 객실/좌석/내부 보행 경로 없음. 지상 좌표로 대체하지 않음. | 지하철 객실·좌석·실내 동선 제작 또는 승인된 별도 연출 설계 | P0 |
| EXHIBITION_11 / 분리수거장이 엉망이다 | 분리수거 시설 접근점 있음. 엉망인 쓰레기 상태의 배치 근거 없음. | 어지러운 분리수거 상태와 접근점 표현 | P1 |
| EXHIBITION_14 / 동네 하천에 쓰레기가 쌓여 있다 | 실제 하천 산책로 접근점 있음. 하천 쓰레기 누적 상황 표현 근거 없음. | 하천 쓰레기 상태를 실제 안전 산책로에서 보이게 배치 | P1 |
| EXHIBITION_15 / 일회용품과 다회용품 중 선택할 수 있다 | 카페 #08과 동일한 접근성 문제. 임의의 먼 지점을 카페 도착으로 처리하지 않음. | 08과 공동으로 카페 접근성과 직원/행동 문맥 검증 | P0 |
| EXHIBITION_19 / 공용 화장실 바닥에 휴지가 떨어져 있다 | 화장실 외관만 존재. 실내 바닥/떨어진 휴지/실내 접근 경로 근거 없음. | 화장실 실내 바닥·출입 경로·휴지 배치 | P0 |
| EXHIBITION_20 / 주민들이 공원에 나무를 심고 있다 | 공원 녹지는 있으나 주민들의 나무 심기 상황 미표현. | 나무 심는 주민/소품과 실제 작업 구역 표현 | P1 |
| EXHIBITION_21 / 길거리에서 두 사람이 싸우고 있다 | 광장 접근 가능. 싸우는 두 사람 상황 미표현. | 다투는 두 인물과 충돌 없는 접근 동선 표현 | P1 |
| EXHIBITION_23 / 식당에서 주문하지 않은 비싼 음식이 나왔다 | 식당 북쪽 전면/door_x 근거의 외부 접근 후보. 연속 포장/실제 출입구 경로 근거 없음. 그래프 연장 보류. | 식당 실제 출입구·연속 포장·내부/직원 문맥 경로 실측 | P0 |
| EXHIBITION_24 / 공원 금지구역을 지나가면 지름길이다 | 공원 접근 가능하나 금지구역/울타리/제한 표식이 실제 해당 구역에 있다는 근거 없음. | 금지구역 경계·울타리/표식을 실제 장소와 연결 | P1 |
| EXHIBITION_25 / 가게에서 누군가 물건을 훔치는 걸 봤다 | 상가 B04 외부 접근점은 있음. 광장 범죄자 NPC는 상점 절도 행위의 근거가 아님. | 상점 절도 행위·인물과 관찰 가능한 접근점 표현 | P1 |
| EXHIBITION_26 / 갑자기 정전이 발생했다 | 건물 외부 접근점은 있음. 정전/CCTV 중단 상황 미표현. | 정전·CCTV 중단 상태 연출 및 상태 복귀 | P2 |
| EXHIBITION_27 / 폭우로 도로 일부가 침수됐다 | 도로 옆 접근점은 있음. 도로 침수 상황 없음. 기존 하천/범람원 이름은 도로 침수 증거가 아님. | 도로 침수 구간·차단·안전 우회로 설계 | P2 |
| EXHIBITION_29 / 화재경보가 울렸는데 불은 보이지 않는다 | 건물 외부 접근점은 있음. 실제 화재경보 상황 미표현. | 화재경보 음원/상태·대피 동선·상태 복귀 | P2 |

카페 08/15의 문 전면 후보와 기존 그래프 간격은 약 13.52m, 식당 23은 약 29.33m다. 기존 보고서의 외부 접근 후보가 실제 출입문/연속 지면을 증명하지 않아 이번에 경로를 임의 연장하거나 이벤트 반경을 늘리지 않았다. 지하철 지상 출입구를 객실 상황으로 대체하지 않았다.

다음 Phase 순서: ① 90초 요구의 수용 조건/도착 정책 확정 ② 카페·식당·화장실·객실의 실측 동선과 표현 승인 ③ P1의 정적/인물 상황을 소규모 묶음으로 연결 ④ P2 동적 환경 상태/복귀 구현 ⑤ 매 묶음마다 원문 불변·DB·Unity 물리·실제 참가 WebGL을 재검증한 후 검증된 행만 활성화.

## 재현

```sh
node web/tests/city-v002-graph.mjs
node --test web/tests/npc-place-trajectory.test.mjs web/tests/unity-bridge.test.mjs
node web/tests/phase2-spatial-input.mjs
# Unity: CityV002Phase2Validation.Verify (읽기 전용 물리 검사)
# Unity: EditMode tests / CityRebuildV002WebGLBuild.BuildSession
cd web
npm run build
TMPDIR=/tmp npm run test:integration
TEST_PHASE2_ONLY=1 TEST_PHASE2_WEBGL_BUILD=<완성된_로컬_WebGL_폴더> \
  TEST_PHASE2_PLAYWRIGHT_MODULE=<playwright/index.mjs> \
  TEST_CHROMIUM_EXECUTABLE=<chromium> TMPDIR=/tmp npm run test:integration
```

TEST_PHASE2_WEBGL_BUILD는 임시 서버의 public 경로에만 연결된다. 기존 저장소 public 빌드를 바꾸지 않고 실제로 선택한 index.html의 SHA256이 HTTP 응답과 같은지도 검사한다. 브라우저 모듈을 생략하면 명시적으로 SKIP되며 브라우저 PASS로 기록하지 않는다.
