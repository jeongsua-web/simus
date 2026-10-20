# SIM:US Phase 1 QA 결과

2026-10-20. 제품 코드 수정 없이 검증했다. 최종 판정은 **FAIL — 수정 및 DB 준비 후 재검증 필요**다. 실제 DB 쓰기·마이그레이션 적용·운영 배포는 하지 않았다.

## 판정 기준과 실행 범위

- PASS: 표에 명시한 범위에서 실제 명령·함수·브라우저·Unity 검사를 성공했다.
- FAIL: 실행 검사에서 요구 조건을 만족하지 못했다.
- BLOCKED: 필요한 환경·데이터·승인이 없어 실행할 수 없다.
- NOT TESTED: 실행하지 않았다.

메모리 서버 테스트, 모의 API 브라우저 테스트, Unity 에디터 이동을 실제 PostgreSQL·참가자 WebGL·스탯 원장의 통합 성공으로 합치지 않았다. 정적 코드 검토는 관찰 사항으로만 사용했다.

| 검증 항목 | 결과 | 실제 근거와 범위 |
|---|---|---|
| TypeScript 검사 | PASS | `npx tsc --noEmit --incremental false`, exit 0 |
| ESLint | PASS | `npm run lint`, 오류 0·기존 shared-result 경고 1 |
| 브리지 입력 검증 | PASS | Node 테스트 3건. 최초 sandbox EPERM 후 승인된 재실행 성공 |
| Unity 현재 라이선스·C# 컴파일·씬 로드 | PASS | Unity 6000.3.24f1 실제 실행. 과거 exit 198과 달리 이번 실행 정상 |
| 수정 경로 4곳 | PASS | Unity Physics 1,384개 샘플, 지지면·캡슐 여유 검사 |
| 이벤트 접근점 8개 좌표·지지면 | PASS | 실제 씬의 marker/node/오브젝트/그래프 연결·지지면·해당 지점 캡슐 확인 |
| Play Mode 도착 | PASS | 에디터 테스트 NPC가 기존 4개 왕복과 8개 접근을 완주. 지지면 누락 0 |
| 전체 접근 경로 캡슐 여유 | FAIL | 07·28번 접근 및 기존 왕복 3개에서 연석/횡단보도 MeshCollider 겹침 검출 |
| LOCATION·통과·60초 유도·90초 미강제 | PASS | 실제 서버 함수+실제 그래프를 실행한 메모리 테스트 범위 |
| 잔류·재접속·중복 방지 전체 요구 | FAIL | 일반 사례는 통과하나 완료 시각 1ms 차이의 상태에서 같은 장소 두 번째 이벤트 재현 |
| 서버 메모리 테스트 전체 | FAIL | 33건 중 32 PASS / 1 FAIL. PostgreSQL 실행 아님 |
| 모바일 선택지·재시도·배치 | PASS | 실제 Chromium, 모의 API/브리지. 360/390/430px 검사 |
| 실제 임시 빌드 씬 환경 NPC 보존 | PASS | 실제 BuildPipeline 씬 검사: 템플릿 1, probe 0, 환경 NPC 7개 유지 |
| 서버 위치 적용 후 Unity 표시 위치 유지 | FAIL | 실제 bridge 이동 직후 RiverGuard.LateUpdate가 유효한 서버 위치를 이전 위치로 되돌림 |
| 로컬 WebGL 빌드 | PASS | 실제 BuildPipeline 완료, 새 map/path·씬 해시 일치. 운영 배포 없음 |
| 실제 DB 코드·UUID 일치 | BLOCKED | 연결 DB에 대상 8개 코드가 0행 |
| DB 스키마 준비 | FAIL | 015·016 필수 칼럼·제약·함수가 없음 |
| DRAFT 매핑 적용 준비 검사 | BLOCKED | 기존 demo DRAFT의 map/path가 NULL. 읽기 전용 도구가 안전하게 중단 |
| 실제 선택 API·스탯 원장·동시 잠금 | BLOCKED | 필요한 스키마/콘텐츠 부재, DB 쓰기·마이그레이션 승인 없음 |
| 기존 그래프 회귀 테스트 | FAIL | 테스트가 구 기본 그래프 572노드를 기대하며 새 579노드에서 중단 |
| 기준 구현 보고서 본문 | FAIL | UTF-8 해독은 되지만 한글 0자·물음표 2,499개로 저장돼 본문 손상 |
| 운영 배포 | NOT TESTED | 금지된 작업으로 실행하지 않음 |

## 발견 오류와 필수 수정 사항

### F5. 참가자의 하천 보호 컴포넌트가 서버 위치 갱신을 되돌림

우선순위가 높은 실제 Unity 동기화 결함이다. 참가자 템플릿에는 `CityV002RiverGuard`가 남아 있다. `WebCityBridge.MoveActor`는 서버 위치를 적용하지만, RiverGuard는 이전 표시 위치와 새 위치 사이의 **직선**이 하천을 가로지르면 다음 LateUpdate에서 되돌린다. 서버의 실제 이동 경로가 교량을 돌아가는 유효한 그래프 경로여도 큰 갱신 간격에서는 충돌한다.

변경하지 않은 bridge의 실제 이동 메서드와 후속 실제 LateUpdate를 Editor Play Mode에서 실행했다.

- 새 생성/재연결 상황: 템플릿의 이전 위치 `[0,0,0]`에서 유효한 `PARK_REST_2 [142,0.16,118]`를 적용했다. bridge 직후에는 정확했지만 LateUpdate 후 `[0,0,0]`으로 되돌아갔다. 서버 위치 오차 184.629m, rejectedSteps 0→1: **FAIL**.
- 탭 복귀를 모사한 갱신: 유효한 `RIVER_W_0`에서 `RIVER_E_0`로 적용한 위치가 이전 하안으로 되돌아갔다. 오차 20.001m: **FAIL**.
- 같은 하안의 유효한 갱신 대조군: 오차 0m, rejectedSteps 0: **PASS**.

이는 실제 브라우저 탭 숨김 절차의 E2E 재현은 아니며, 그때 일어나는 큰 권위 위치 갱신을 실제 Unity 컴포넌트에 적용한 재현이다. 목적지는 금지 구역이 아니었고 그래프 경로도 존재했다. [원본 결과](unity-river-warp.json), [로그](unity-river-warp.log), [씬 보존](unity-river-warp-preservation.json).

**필수 수정:** 서버 동기화 참가자와 로컬 Patrol의 보호 정책을 구분하거나, 검증된 서버 위치 갱신 시 보호 컴포넌트의 이전 위치 기준을 함께 동기화해야 한다. 하천을 실제로 가로지르는 로컬 이동 보호를 무조건 없애는 방식은 피한다. 이번 QA에서는 제품 코드를 수정하지 않았다.

### F1. 완료 시각 불일치로 가짜 재진입 발생

`web/src/lib/npc-events.ts`의 `completeEvent`는 이동 epoch, 대기 시각, 마지막 평가 시각, 정지 시간 계산에 서로 다른 `clock_timestamp()`를 사용한다. 경계에서 정지한 NPC에 대해 이 값들이 1ms 어긋나는 상태를 만들면, 실제로 장소를 떠나지 않았는데 다음 평가에서 경계를 다시 통과한 것으로 판단한다.

실행한 재현은 실제 서버 함수의 메모리 SQL 포트다. 첫 진입 4,000ms → 완료 cursor 10,000ms → 정지 시간 6,001ms를 모델링 → 다음 평가 10,001ms에서 같은 장소 발생 건이 1건에서 2건으로 늘었다. 실제 PostgreSQL의 표현식 실행 간격과 발생 빈도는 측정하지 않았다. 이 차이를 모델링한 상태에서 서버 상태기계가 실패한 것은 실행으로 확인했다.

추가로 실제 PostgreSQL의 읽기 전용 SELECT에서 독립 `clock_timestamp()` 두 개를 100,000행 관찰했다. 2행에서 밀리초가 달랐다. READ ONLY/ROLLBACK이며 sleep과 쓰기는 없었다. 독립 시각이 밀리초 경계를 넘을 수 있다는 관찰이고, 실제 UPDATE나 선택 트랜잭션 재현은 아니다. [SELECT 증거](database-clock-select-observation.json).

**필수 수정:** 하나의 완료 시각과 일관된 밀리초 표현으로 epoch·cursor·대기 시작·정지 시간을 계산하고, 정지 위치의 점유 연속성을 보존한다. 실제 이탈 후 재진입을 무시하는 방식으로 덮으면 안 된다. 이번 QA에서는 수정하지 않았다.

근거: [서버 실행 보고](server-memory-review.md), [실행 결과](server-memory-results.json), [리뷰](backend-review.md).

### F2. 전체 경로의 높이 전환부 캡슐 겹침

수정한 4개 부분 경로 자체는 통과했다. 그러나 광장에서 07·28번 장소로 이동하는 전체 경로에서는 도로 높이 약 0.02m와 보도 높이 약 0.14m의 전환부에서 캡슐과 보도/횡단보도 MeshCollider가 겹쳤다. 실제 테스트 NPC는 Transform 이동으로 목적지까지 갔으므로, 이를 “도착 불가능”이나 “Collider가 NPC 이동을 물리적으로 막았다”로 해석하지 않는다. 반대로 완주만으로 무관통 PASS도 부여하지 않는다.

07번 접근 7샘플, 28번 접근 4샘플에서 검출됐다. 기존 학교↔상업·학교↔주거·주거↔상업 왕복에서도 각각 6·14·20샘플이 검출됐고 학교↔공원은 0이었다. 지지면 누락과 실행 오류는 없었다.

**필수 조치:** 높이 전환 구간을 실제 참가자 모델과 카메라로 확인하고, 정상 연석 접촉과 시각적 관통을 구분한 뒤 필요한 경로/높이 보정을 승인한다. 검사 기준을 임의로 완화하거나 소품 통과 문제로 단정하지 않았다.

근거: [Unity Physics](unity-editor-physics.json), [실제 Play Mode](unity-runtime.json).

### F3. DB 환경이 구현 계약을 갖추지 못함

연결 DB에는 demo DRAFT `10000000-0000-0000-0000-000000000001`과 `TRASH_001`만 있다. 전시 seed와 우선 8개 코드가 없고, NPC map/path도 NULL이다. 015·016의 필수 객체도 없다. 현재 연결에 전시 seed가 남아 있지 않다는 사실은 확인했으나, 미적용·과거 롤백/삭제·다른 DB 사용 중 어떤 원인인지는 읽기 전용 현재 상태만으로 확정하지 않는다.

**필수 조치:** 별도 승인 후 사용할 격리 DB를 확정하고, 누락 스키마와 원본 콘텐츠를 가진 새 DRAFT를 준비한다. 현재 DB의 운영 회차를 변경하거나 이번 QA에서 마이그레이션을 실행하지 않았다.

### F4. 회귀 테스트와 보고서 정비

기존 `web/tests/city-v002-graph.mjs`는 구 그래프 노드 수를 하드코딩하여 실패했다. legacy/Phase 1을 구분해 검증하도록 정비해야 한다. 기존 전체 통합 runner도 구 WebGL 파일과 구 DEADLINE 정책, 015까지만 적용하는 구조라 이번 DB 변경 금지 조건에서 실행하지 않았다.

기준 `implementation-report.md`의 한글 본문이 물음표로 손상됐다. 이번 보고서는 UTF-8로 작성했으며 원본 구현 보고서는 고치지 않았다. 전달 문서 본문을 복구할 필요가 있다.

## 8개 이벤트별 실제 접근 결과

모든 canonical 반경은 1.5m이고 좌표는 이번 QA에서 변경하지 않았다. 각 앵커의 실제 위치·지지면·정적 캡슐 검사는 모두 PASS다. 아래 “도착”은 에디터 Play Mode의 기존 테스트 NPC 이동이며, 서버 LOCATION은 별도 메모리 실행으로 확인했다.

따라서 이 표는 서버 동기화 참가자의 재접속·탭 복귀까지 통합 PASS라는 뜻이 아니다. 위 F5는 별도로 재현된 표시 위치 불일치이며, 수정 전에는 최종 참가자 접근성을 확정할 수 없다.

| ID | 장소 | 앵커/반경·서버 경로 계산 | Play Mode 도착 | 전체 접근 경로 여유 |
|---|---|---|---|---|
| 02 | 횡단보도·신호등 | PASS | PASS | PASS |
| 05 | 울고 있는 아이 | PASS | PASS | PASS |
| 07 | 불법 주차 차량 | PASS | PASS | FAIL — 전환부 7샘플 |
| 13 | 북쪽 꽃밭 | PASS | PASS | PASS |
| 17 | 축제 안내 부스 | PASS | PASS | PASS |
| 18 | 고양이 | PASS | PASS | PASS |
| 28 | 바리케이드·고깔콘 | PASS | PASS | FAIL — 전환부 4샘플 |
| 30 | 광장 상자 | PASS | PASS | PASS |

카페·식당 연결로 및 지하철 지하 진입은 기존 미해결 사항이며 우선 8개에 포함되지 않는다. 이번 QA에서 신규 연결로/지하 구조를 만들지 않았다.

## Unity 및 WebGL

현재 라이선스는 정상이다. C# 컴파일, 씬 로드, Editor Physics, Play Mode를 실제 수행했다. 원본 씬 SHA256은 실행 전후 `3ca26d6ee0c512812c8d1778c4fb8e8296b7df2357a46aa231daf9f6fe8969d2`로 동일하다.

임시 빌드 씬 검사에서 시민 2명·짐 운반자 1명·아이·경찰·수상한 NPC·고양이가 활성 상태이고 Animator를 유지했다. 시민/운반자의 Patrol도 유지했다. 참가자 템플릿 1개, 테스트 probe 0개였다. 환경 NPC 보존은 단순 코드 분석에 더해 실제 빌드 씬에서 확인했다.

로컬 WebGL 빌드는 **PASS**다. 산출물은 `unity/Builds/phase1_qa_local_20261020_051159`에 있다. 실제 빌드가 exit 0으로 끝났으며 manifest의 Phase 1 map/path와 원본 씬 해시가 일치했다. data 74,443,057바이트, wasm 26,706,085바이트의 무압축 빌드다. 운영 public 경로 복사와 배포는 하지 않았다. [빌드 결과](unity-build-result.json), [빌드 로그](unity-build.log).

## DB 적용 가능 여부

canonical 8개 코드와 원본 seed UUID의 파일 비교는 PASS다. 실제 DB에는 대상 코드가 없어 실제 UUID 일치는 BLOCKED다. 읽기 전용 준비 도구는 source 해시·명명된 노드·정확 좌표·그래프 연결 검사를 통과한 뒤 `DRAFT map/path mismatch`로 exit 1/ROLLBACK했다. 안전한 중단이며 적용 성공이 아니다.

마이그레이션 적용, seed 적용, 위치 UPDATE, 실제 스탯 쓰기, SQL 제약/동시 잠금 동작은 실행하지 않았다. [DB 상세 결과](database-report.md)에 현재 스키마와 원인을 구분해 기록했다.

## 모바일 범위와 통합 한계

실제 Chromium에서 360/390/430px 긴 콘텐츠, 상태 전환, 반복 ACTIVE 조회의 카드 1개, 503 후 동일 event/choice/request_key 재시도, 완료 후 pending 정리, iframe 유지 및 확대 메시지를 확인했다. 서버는 모든 API 응답을 fixture로 제공했고, DB 연결도 차단된 주소로 덮었다. 실제 서버의 시간 경과나 DB 스탯 반영 성공을 뜻하지 않는다. [모바일 증거](mobile-fixture-review.md).

## 증거와 변경 범위

- [루트 검사 명령·exit code](root-checks.json)
- [서버 33건 실행 결과·원본 해시](server-memory-results.json)
- [DB 읽기 전용 결과](database-report.md)
- [모바일 브라우저 결과](mobile-fixture-result.json)
- [Unity 라이선스 로그](unity-license-current.log)
- [Unity 원본 씬 보존](unity-preservation.json)
- [임시 빌드 씬 구성](unity-build-scene.json)

이번 작업에서 추가한 것은 QA 하네스와 증거/보고서다. 제품 코드·씬의 수정, DB 쓰기, 마이그레이션, 운영 배포는 하지 않았다. 필수 수정과 DB 쓰기는 이 결과 보고 후 별도 승인을 기다린다.
