# SIM:US Phase 2 — 30개 위치 이벤트 구현 보고

상태: **코드·매핑·DRAFT SQL 준비 완료, 적용/기능 QA 미실행**. 30개를 모두 매핑 검토했고 **12개 연결 준비(Phase 1 유지 8 + 추가 4), 18개 미완료**로 구분했다. DB에 이번 매핑을 실제 적용한 이벤트는 0개이며, 30개 전체 또는 전시 운영 완료로 처리하지 않는다.

## 기준과 Phase 1 보존

작업 브랜치 release에는 Phase 1 파일이 없었지만 Git 이력 `origin/develop`의 커밋 `7ac43f0`에서 원본을 찾았다. 해당 커밋의 보고서/canonical JSON/579노드·604간선 그래프/준비된 Unity 씬/장소 진입 로직/역할 기반 빌더를 필요한 범위에서 복원했다. 브랜치 전체를 병합하거나 다른 작업을 되돌리지 않았다. 원본 보고서 일부 한글은 물음표로 저장돼 있으며, 좌표의 기준은 정상적으로 보존된 canonical JSON과 저장 씬/그래프다.

- map_version: `test-only-city-rebuild-v002-phase1-v1`
- path_version: `city-rebuild-v002-walk-phase1-v1`
- 전시 승인: `exhibition_ready=false` 유지. Neighborhood 좌표 사용 없음.
- Phase 1의 **02·05·07·13·17·18·28·30**은 장소 ID·좌표·반경 **1.5m**를 그대로 사용한다. 보행로 우회/보완도 기존 Phase 1 파일을 복원한 것이며 이번에 새 좌표로 재설계하지 않았다.
- 추가 4개는 **10·12·16·22**이며 반경 2m. 10/22는 같은 학교 접근점 `C04_ACCESS`를 공유한다.
- 과거 39개 배치 보고서의 고양이 누락 기록 이후, Phase 1에는 `CAT_Tuxedo_EastPark`가 존재한다. 기존 고양이 자산과 Phase 1 배치를 재사용하며 신규 3D 자산/애니메이션 제작은 없다.
- 구버전 v002 그래프/맵도 별도로 보존한다. 기존 회차/가입 스냅샷/DB 좌표는 자동 변환하지 않는다.

## 30개별 상태·장소·좌표·반경

`준비`는 코드와 매핑 산출물 준비를 뜻하며 DB 적용/실행 검증 완료가 아니다. 미완료 행의 좌표는 접근성을 검토한 **후보**일 뿐이며 런타임 `event_location=null`, 활성 반경 미설정이다. 지하철 객실 좌표는 알 수 없어 만들지 않았다. 좌표는 Unity world [X,Y,Z], 미터이며 표시만 소수 6자리로 줄였고 JSON에는 원래 정밀도를 보존했다.

| ID / 실제 코드 | 상태 | 실제 장소 ID | 그래프 위치 [X,Y,Z] | 발생 반경 | 근거/미완료 원인 |
|---|---|---|---|---|---|
| 01 / `EXHIBITION_01` | 미완료·상황 표현 | `ENV_Bin_BusStop` | [60, 0.16, -56.65] (후보) | 미설정 | 도로/쓰레기통 접근점은 있으나 떨어진 쓰레기 표현 근거 없음. 장소 후보만 기록. |
| 02 / `EXHIBITION_02` | 준비·Phase 1 유지 | `city_v002_gate_crossing` | [0, 0.16, -56.25] | 1.5m | 정문 횡단보도 북쪽 신호등 앞 기존 보도. 신호 주기/교통 제어는 구현하지 않음. |
| 03 / `EXHIBITION_03` | 미완료·상황 표현 | `ENV_MysteryCrate_Plaza` | [15, 0.16, 115] (후보) | 미설정 | 광장 접근 가능. 떨어진 지갑 미배치. |
| 04 / `EXHIBITION_04` | 미완료·상황 표현 | `ENV_BusStop_R01` | [54, 0.16, -56.65] (후보) | 미설정 | 정류장 bounds 앞 보도 접근 가능. 대기 줄/새치기 상황 미표현. |
| 05 / `EXHIBITION_05` | 준비·Phase 1 유지 | `city_v002_crying_child` | [147.158345, 0.16, 26.376605] | 1.5m | 기존 공원 길에서 저장된 우는 아이를 만나는 접근점. 울음 실제 재생은 승인 후 확인 필요. |
| 06 / `EXHIBITION_06` | 미완료·상황 표현 | `PARK_REST_2` | [142, 0.16, 118] (후보) | 미설정 | 공원 접근 가능. 음악 재생자/음원 상황 미표현. |
| 07 / `EXHIBITION_07` | 준비·Phase 1 유지 | `city_v002_illegal_parking` | [-143, 0.16, -8.3] | 1.5m | 기존 R05 보도에서 불법 주차 차량 옆 접근. 통과 여유는 승인 후 확인 필요. |
| 08 / `EXHIBITION_08` | 미완료·접근성 | `ENV_Cafe_EastCommercial` | [137.845882, 0.16, -55.379284] (후보) | 미설정 | 카페 북쪽 전면/door_x 근거의 외부 접근 후보. 연결된 포장/실제 출입구까지의 경로 근거가 없어 그래프를 연장하지 않음. |
| 09 / `EXHIBITION_09` | 미완료·상황 표현 | `ENV_Subway_Entrance_SurfaceOnly` | — (객실 없음) | 미설정 | 지상 출입구만 존재. 객실/좌석/내부 보행 경로 없음. 지상 좌표로 대체하지 않음. |
| 10 / `EXHIBITION_10` | 준비·추가 | `C04_ACCESS` | [-41.1685, 0.16, 67.139] | 2m | 캠퍼스 학교 건물 C04의 기존 접근 노드. 대화형 원문은 기존 모바일 UI 사용. |
| 11 / `EXHIBITION_11` | 미완료·상황 표현 | `ENV_Recycle_SouthHousing` | [53.044861, 0.16, -214.429853] (후보) | 미설정 | 분리수거 시설 접근점 있음. 엉망인 쓰레기 상태의 배치 근거 없음. |
| 12 / `EXHIBITION_12` | 준비·추가 | `ENV_Bin_BusStop` | [60, 0.16, -56.65] | 2m | 일반 도로 R01의 기존 보도. 근거리 이동 선택 문맥을 모바일에 표시. |
| 13 / `EXHIBITION_13` | 준비·Phase 1 유지 | `city_v002_park_flowerbed` | [155.90806, 0.16, 126.702969] | 1.5m | 북쪽 공원 꽃밭 옆 기존 산책로. 남쪽 꽃밭의 먼 접근점 대신 가까운 북쪽 시설 사용. |
| 14 / `EXHIBITION_14` | 미완료·상황 표현 | `RIVER_E_30` | [127.97789, -0.408, 45.664577] (후보) | 미설정 | 실제 하천 산책로 접근점 있음. 하천 쓰레기 누적 상황 표현 근거 없음. |
| 15 / `EXHIBITION_15` | 미완료·접근성 | `ENV_Cafe_EastCommercial` | [137.845882, 0.16, -55.379284] (후보) | 미설정 | 카페 #08과 동일한 접근성 문제. 임의의 먼 지점을 카페 도착으로 처리하지 않음. |
| 16 / `EXHIBITION_16` | 준비·추가 | `NPC_HeavyCarrier_ApartmentWalk` | [-186.85, 0.16, 112.7144] | 2m | 기록된 짐 운반자 왕복 구간의 중간 접근점. 빌더에서 환경 NPC를 삭제하던 처리도 보호. |
| 17 / `EXHIBITION_17` | 준비·Phase 1 유지 | `city_v002_festival_info` | [11.538184, 0.16, 103.113135] | 1.5m | 광장 안내 축제 부스의 기존 보행 접근점. 모집 내용은 원문 모바일 선택지 사용. |
| 18 / `EXHIBITION_18` | 준비·Phase 1 유지 | `city_v002_park_cat` | [158.259684, 0.16, 50.839311] | 1.5m | Phase 1의 CAT_Tuxedo_EastPark 배치와 접근점을 그대로 재사용. 이전 39개 배치 보고서 이후 추가된 기존 고양이이며 신규 제작 없음. |
| 19 / `EXHIBITION_19` | 미완료·상황 표현 | `ENV_PublicToilet_ParkNorth` | [153.019257, 0.16, 132.519161] (후보) | 미설정 | 화장실 외관만 존재. 실내 바닥/떨어진 휴지/실내 접근 경로 근거 없음. |
| 20 / `EXHIBITION_20` | 미완료·상황 표현 | `PARK_REST_2` | [142, 0.16, 118] (후보) | 미설정 | 공원 녹지는 있으나 주민들의 나무 심기 상황 미표현. |
| 21 / `EXHIBITION_21` | 미완료·상황 표현 | `ENV_MysteryCrate_Plaza` | [15, 0.16, 115] (후보) | 미설정 | 광장 접근 가능. 싸우는 두 사람 상황 미표현. |
| 22 / `EXHIBITION_22` | 준비·추가 | `C04_ACCESS` | [-41.1685, 0.16, 67.139] | 2m | 학교 C04 접근점 공유. 비밀 대화는 기존 모바일 원문 사용, 잔류 중 연속 발생 금지. |
| 23 / `EXHIBITION_23` | 미완료·접근성 | `ENV_Restaurant_EastCommercial` | [127, 0.16, -107.4] (후보) | 미설정 | 식당 북쪽 전면/door_x 근거의 외부 접근 후보. 연속 포장/실제 출입구 경로 근거 없음. 그래프 연장 보류. |
| 24 / `EXHIBITION_24` | 미완료·상황 표현 | `PARK_REST_2` | [142, 0.16, 118] (후보) | 미설정 | 공원 접근 가능하나 금지구역/울타리/제한 표식이 실제 해당 구역에 있다는 근거 없음. |
| 25 / `EXHIBITION_25` | 미완료·상황 표현 | `B04_ACCESS` | [6, 0.16, -72.25] (후보) | 미설정 | 상가 B04 외부 접근점은 있음. 광장 범죄자 NPC는 상점 절도 행위의 근거가 아님. |
| 26 / `EXHIBITION_26` | 미완료·상황 표현 | `B04_ACCESS` | [6, 0.16, -72.25] (후보) | 미설정 | 건물 외부 접근점은 있음. 정전/CCTV 중단 상황 미표현. |
| 27 / `EXHIBITION_27` | 미완료·상황 표현 | `ENV_Barricade_R01_Control` | [86, 0.16, -65.75] (후보) | 미설정 | 도로 옆 접근점은 있음. 도로 침수 상황 없음. 기존 하천/범람원 이름은 도로 침수 증거가 아님. |
| 28 / `EXHIBITION_28` | 준비·Phase 1 유지 | `city_v002_road_control` | [86, 0.16, -65.75] | 1.5m | R01 바리케이드/콘을 보는 남쪽 기존 보도 접근점. 도로를 통과하는 경로를 새로 만들지 않음. |
| 29 / `EXHIBITION_29` | 미완료·상황 표현 | `B04_ACCESS` | [6, 0.16, -72.25] (후보) | 미설정 | 건물 외부 접근점은 있음. 실제 화재경보 상황 미표현. |
| 30 / `EXHIBITION_30` | 준비·Phase 1 유지 | `city_v002_mystery_crate` | [15, 0.16, 115] | 1.5m | 광장 상자 남쪽 기존 C_PARK 보행선. 모델 중심 대신 3m 떨어진 길 위에서 발생. |

각 행의 전체 seed UUID, 정확한 좌표, 원본 오브젝트 경로, 그래프 노드/간선과 거리 근거는 [30개 JSON](../../../web/src/lib/data/city-v002-event-mapping.json)에 있다. Phase 1 8개 원본은 [canonical JSON](../../../web/src/lib/data/city-v002-phase1-event-locations.json)이다.

## 접근성과 상황 표현

카페 #08/#15의 저장 위치 중심을 이벤트 지점으로 쓰지 않았다. 기존 모델 보고서의 Unity +Z 전면 및 door_x=2.7과 저장 bounds를 근거로 전면 밖 1m의 후보 `[142.7,0.16,-68]`를 잡았다. 가장 가까운 실제 그래프 점까지 **13.522017m** 떨어져 있어 비활성이다. 식당 #23도 door_x=-2.8과 북쪽 bounds를 바탕으로 전면 밖 후보 `[150.2,0.16,-89.45]`를 검토했으나 그래프까지 **29.333300m**다. 이 후보는 정확한 실제 문 위치를 실측했다는 뜻이 아니다. 실제 출입구와 연속 포장/통과 여유 근거가 없어 그래프를 임의로 연장하거나 반경을 확대하지 않았다.

화장실 #19는 외관 앞 후보부터 그래프까지 약 5.31m이며 실내 경로/휴지도 없다. #09는 지상 출입구/계단만으로 객실의 빈 좌석 상황을 충족하지 못한다. #24의 공원 접근점도 금지구역/울타리 증거가 없어 활성화하지 않았다.

상황 표현이 부족한 #03 지갑, #04 새치기/대기 줄, #06 음악, #20 나무 심기, #21 다툼, #25 절도, #26 정전, #27 도로 침수, #29 화재경보는 별도 미완료다. 광장 범죄자/경찰 NPC나 기존 하천만으로 절도·다툼·침수 완료로 간주하지 않았다. 추가로 #01 떨어진 쓰레기, #11 엉망인 분리수거장, #14 하천 쓰레기, #19 화장실 바닥 휴지의 실제 표현도 확인 근거가 없어 보수적으로 비활성화했다. 새 에셋/오디오/애니메이션/연출은 제작하지 않았다.

준비된 위치도 `physical_access_verified=false`다. #05 아이와의 거리 약 4.46m, #16 이동하는 운반자와 실제 만나는 시점/가시성, #07 차량 옆 통과 여유, 부스/꽃밭/상자 주변 지면/장애물은 승인 후 기능 QA 대상이다. 그래프 접근 가능성과 실제 Unity 물리 통과 검증을 동일시하지 않는다.

## 서버·모바일·Unity 흐름

Phase 1의 `npc-place-trajectory.ts`를 재사용한다. 서버 시각과 실제 저장 이동 폴리라인을 진입 커서부터 연속 검사하고, 해당 맵의 그래프 거리로 반경 진입을 판정한다. 폴링 사이에 장소를 통과한 경우도 처리한다. 진입 조건을 만족하면 가능한 원본 이벤트 중 하나를 무조건 선택하며 별도 확률 실패는 없다.

`location_occupancy`의 inside/entry_seq/consumed_entry_seq와 `location_evaluated_at`, 이벤트 place_id/entry_seq 유일 인덱스가 장소 잔류·재접속·서버 재시작·중복 요청의 중복 발생을 막는다. NPC당 ACTIVE 1개, 기존 세션 잠금과 원장 멱등성은 유지한다. 같은 장소의 다른 이벤트는 이탈·재진입한 뒤 선택할 수 있다. 이미 답한 원본 이벤트는 같은 참여자/회차에서 반복하지 않는다.

60초가 지나면 접근 가능한 다른 미응답 장소로 기존 그래프 유도를 사용한다. **90초 강제 이벤트는 없다.** Phase 1의 overdue/overdue_since는 진단용으로만 남기며 `deadline_at=null`, `guidance_at=waiting_since+60초`다. 역사적 DEADLINE DB 값은 읽을 수 있으나 새 발생은 LOCATION뿐이다. 위치 미지정·미완료 이벤트는 시간이 지나도 발생하지 않는다.

장소 진입 → 서버 검증/이벤트 저장 → 기존 모바일 선택지 → 기존 선택 트랜잭션으로 도시/개인/지역 스탯 1회 반영 → 기존 NPC 정지 해제/경로 복귀 흐름을 유지한다. `WebCityBridge.cs`는 기존 서버 스냅샷을 소비하므로 바꾸지 않았다. Collider/OnTriggerEnter를 발생 근거로 사용하지 않는다. Phase 1의 명시적 ParticipantTemplate/Environment/TestProbe 역할 빌더도 복원해 환경 시민/운반자가 삭제되거나 참가자 템플릿으로 바뀌는 문제를 피한다. 빌더는 실행하지 않았다.

## DB 조사와 적용 준비

원본 30개의 실제 코드는 EXHIBITION_01~30이다. 원본 seed의 상황 UUID는 `30000000-0000-0000-0000-0000000000NN`(NN=01~30), 선택지 UUID는 원본 시드의 40000000 계열이며 91개다. 실제 식별자는 [읽기 전용 DB 기록](db-read-only-inventory.json)에 모두 보존했다. 기존 복합 키 (session_id,id) 덕분에 회차 간 같은 원본 UUID를 사용하며, 기존 코드가 있으면 그 행의 실제 UUID로 연결한다. 임의 UUID를 생성하지 않는다.

DB 조회 시각: `2026-10-20T07:15:25.711Z`. 트랜잭션은 `REPEATABLE READ READ ONLY`, 종료는 ROLLBACK이었다. 스키마/코드/UUID/원문/선택지/스탯/지역 효과만 읽었고 운영/진행 회차 데이터를 변경하지 않았다.

| 회차 ID | 상태/맵 | 원본 코드 | 원문·선택지·스탯 대조 | 저장 위치 |
|---|---|---:|---:|---:|
| `10000000-0000-0000-0000-000000000001` | DRAFT / `미설정` | 0/30 | 0/30 | 0 |
| `12cd80d9-8658-48de-992c-d5f211c5f0fc` | FINALIZED / `test-only-city-rebuild-v002-webgl-v1` | 30/30 | 30/30 | 0 |
| `16000000-0000-0000-0000-000000000001` | FINALIZED / `dev-synthetic-v1` | 30/30 | 30/30 | 0 |
| `32a4bb3a-5362-4f3f-90d6-084f8fbbf160` | RUNNING / `test-only-city-rebuild-v002-webgl-v1` | 30/30 | 30/30 | 0 |
| `70a6b8c9-b281-434c-9dc4-8d519ffc3861` | DRAFT / `test-only-city-rebuild-v002-webgl-v1` | 30/30 | 30/30 | 0 |

따라서 이번 연결 DB의 v002 DRAFT에는 원본 코드 30개가 모두 있다. 코드가 없다는 과거 Phase 1 보고는 그때 연결한 다른 환경의 기록이며 현재 DB 전체의 사실로 일반화하지 않았다. 데모 DRAFT에는 TRASH_001만 있고 EXHIBITION 코드가 없다. 이 데모의 기존 UUID를 다른 코드로 재사용/변경하지 않으며 충돌 시 준비 SQL은 중단한다.

현재 DRAFT `70a6b8c9-b281-434c-9dc4-8d519ffc3861`은 **구버전** `test-only-city-rebuild-v002-webgl-v1`이다. 새 Phase 1 map/path의 DRAFT는 조회 시점에 없었다. 준비 SQL은 구버전 DRAFT를 몰래 변환하지 않으며, 승인 후 관리자 복사 생성에서 city-rebuild-v002 프로필로 새 DRAFT를 만든 뒤 검토해야 한다. 기존 DRAFT/진행 회차에는 아직 어떤 매핑도 적용하지 않았다.

`018_npc_event_visit.sql`은 Phase 1 커밋의 `016_location_entry_events.sql`을 이 브랜치에 이식한 schema 준비다. 현재 불변 016 safe-glasses와 번호가 충돌하므로 018을 사용한다. 001~017 원본과 checksum을 바꾸지 않고 관리형 init/upgrade/신규 설치 준비 순서에 018을 추가했다. 현재 DB에는 이 occupancy 스키마가 없으며 **새 서버 배포 전 별도 승인 후 적용이 필요**하다. 다른 환경에서 Phase 1의 016을 이미 적용했다면 중복 실행하지 말고 이력을 별도 검토한다.

`db/content/city-v002-events-phase2-draft.sql`은 개발 DB 이름·지정 DRAFT UUID·맵/경로 버전·미가입 상태·018 스키마를 검사하고 대상 세션 행을 잠근다. 기존 콘텐츠의 원문/선택지/스탯 차이는 수정 대신 중단하며, 누락된 상황만 원본 seed UUID/91개 선택지/원래 EXHIBITION_CITY 효과로 준비한다. 기존 실제 UUID·non-null 위치는 모두 보존한다. 기존 ID 충돌, 부분 선택지, 원래 지역 부재도 중단 조건이다. BLOCKED 후보는 적용 대상이 아니다. 두 번 적용해도 기존 콘텐츠/위치를 덮어쓰지 않도록 작성했다(실행 멱등성 QA는 미실행).

새 최초 회차 생성 경로에는 준비된 12개 위치만 넣도록 구현했다. 기존 회차에는 자동 실행하지 않는다. `web/scripts/prepare-city-v002-events.mjs`는 SQL 파일 준비와 선택적 읽기 전용 조사만 지원하며 **적용 모드는 없다**. 복원한 Phase 1 도구도 이 단계에서 실행하지 않았다. 원본 `db/seed_exhibition.sql`, `db/011_npc_events.sql`, 원본 콘텐츠 JSON/Markdown은 수정하지 않았다.

## 수정·복원·생성 파일

아래는 이번 이벤트 작업 파일이다. 동시에 진행된 인구 표시 UI/API/CSS/테스트 변경은 보존했고 이 목록의 구현 범위에서 제외했다. `web/API.md`의 인구 문서는 유지한 채 이벤트 계약 부분만 수정했다.

- `assets/catalog/inventory.json`
- `db/018_npc_event_visit.sql`
- `db/README.md`
- `db/content/city-v002-events-phase2-draft.sql`
- `db/migration-checksums.json`
- `db/phase1-event-locations.schema.json`
- `db/phase1_event_locations.sql`
- `db/prepare-phase1-locations.mjs`
- `docs/contracts/npc-events.md`
- `docs/operations/db-migrations.md`
- `docs/placement/phase1/floor-geometry-inputs.json`
- `docs/placement/phase1/implementation-report.md`
- `docs/placement/phase1/unity-preparation.md`
- `docs/placement/phase1/unity-spatial-preparation.json`
- `docs/placement/phase2/db-read-only-inventory.json`
- `docs/placement/phase2/implementation-report.md`
- `scripts/db/migrate.py`
- `scripts/db/prepare-production.py`
- `scripts/events/author-city-v002-mapping.py`
- `scripts/unity/deploy-city-rebuild-v002.mjs`
- `scripts/unity/export-city-rebuild-v002-graph.py`
- `scripts/unity/export-city-v002-phase1-locations.py`
- `unity/Assets/Editor/CityRebuildV002WebGLBuild.cs`
- `unity/Assets/Editor/CityV002LocationPreparation.cs`
- `unity/Assets/Editor/CityV002LocationPreparation.cs.meta`
- `unity/Assets/SIMUS/Scenes/city_rebuild_v002/CityRebuild_v002.unity`
- `unity/Assets/Scripts/CityV002NpcBuildRole.cs`
- `unity/Assets/Scripts/CityV002NpcBuildRole.cs.meta`
- `unity/Assets/Scripts/CityV002PedestrianGraph.cs`
- `unity/Assets/Scripts/CityV002PlaceAnchor.cs`
- `unity/Assets/Scripts/CityV002PlaceAnchor.cs.meta`
- `web/API.md`
- `web/scripts/prepare-city-v002-events.mjs`
- `web/src/app/admin/EventLocations.tsx`
- `web/src/app/admin/page.tsx`
- `web/src/app/api/admin/sessions/[id]/event-locations/route.ts`
- `web/src/app/participate/UnityCity.tsx`
- `web/src/lib/city-builds.ts`
- `web/src/lib/city-v002-event-mapping.mjs`
- `web/src/lib/city-v002-graph.mjs`
- `web/src/lib/data/city-rebuild-v002-phase1-graph.json`
- `web/src/lib/data/city-v002-event-mapping.json`
- `web/src/lib/data/city-v002-phase1-event-locations.json`
- `web/src/lib/event-locations.ts`
- `web/src/lib/initial-session-content.ts`
- `web/src/lib/npc-events.ts`
- `web/src/lib/npc-graph-motion.ts`
- `web/src/lib/npc-place-trajectory.ts`
- `web/src/lib/participant-npcs.ts`
- `web/src/lib/session-build-readiness.ts`
- `web/tests/city-v002-events.integration.mjs`
- `web/tests/city-v002-graph.mjs`
- `web/tests/event-browser.mjs`
- `web/tests/initial-session.integration.mjs`
- `web/tests/isolated-runner.mjs`
- `web/tests/npc-events.integration.mjs`
- `web/tests/session-build.integration.mjs`
- `web/tests/v002-session-browser.mjs`

## 실행한 작업과 미검증 사항

실행한 것은 저장소/다른 브랜치 이력/저장 씬/기존 모델 보고서 읽기, 기존 Phase 1 소스 복원, JSON/SQL 산출물 생성, 읽기 전용 DB 콘텐츠 비교다. AGENTS.md의 에셋 관리 지시에 따라 catalog 재생성과 catalog --check만 수행했다: **5,340파일, 오류 0**. 이는 에셋 목록 관리 검사이며 게임 기능/장면 물리/QA 통과를 뜻하지 않는다.

**실행하지 않은 것:** QA 에이전트, 테스트 실행, lint/TypeScript/C# 컴파일, SQL 구문/실행 QA, Play Mode/Unity 재임포트·애니메이션 재생, 모바일/브라우저 실행, 실제 migration/seed/매핑 적용, WebGL 빌드, 배포. 회귀 테스트 코드는 새로운 진입/잔류/재접속/90초 비강제/12개 매핑 계약에 맞게 준비했지만 통과를 주장하지 않는다. 현재 웹 바이너리와 복원 씬의 일치 여부도 승인 후 확인해야 한다.

승인 후 QA에서 볼 항목: 기존 8개 완전 동일성, 추가 4개의 실제 지면/시야/통과, 같은 장소 10/22의 1회 선택과 이탈 재진입, 폴링 공백/서버 재시작/90초 경과에도 실제 진입만 발생하는지, 동시 이벤트/선택 1회 반영과 NPC 재개, 개발 전용 DB의 018 및 누락 코드/UUID 충돌/기존 좌표 보존, WebGL source_scene_sha256 일치와 모바일 동기화다. 이번 보고 후 사용자 승인 전까지 실행하지 않고 멈춘다.
