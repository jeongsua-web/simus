# v003 로컬 연결 독립 QA

검증일: 2026-11-16~17. 대상은 로컬 개발 연결이며 전시 승인과 별개다.

- map_version: `city-masterplan-v003-local-v1`
- path_version: `city-masterplan-v003-plaza30-v1`
- 대표 상황: `EXHIBITION_30`
- 회차: `16000000-0000-0000-0000-000000000001` (격리 개발 DB의 원본 콘텐츠 복제)
- 테스트 진입점: `/v003-test`

## 수행한 검사

| 검사 | 명령/근거 | 결과 |
|---|---|---|
| 브리지·기존 NPC/장소 경로 회귀 | `cd web && node --test tests/unity-bridge.test.mjs tests/participant-npc-motion.test.mjs tests/npc-place-trajectory.test.mjs` | 19 passed, 0 failed. 기존 v002 테스트이며 v003 물리 검증을 대신하지 않음 |
| TypeScript | `cd web && npx tsc --noEmit` | passed |
| v003 시작 전 빌드 검사 | `cd web && node --test tests/v003-build-readiness.test.mjs` | 1 passed. 임시 파일 fixture에서 map/path/지원필드/씬 SHA/경유점 불일치와 wasm 누락 거절. 실제 start API 트랜잭션이나 WebGL 실행 증거와 구분 |
| 변경 코드 lint | 최초 구현의 backend/UnityCity/v003-test 파일을 명시한 scoped eslint | passed. 이후 lib 하위 폴더 이동된 현재 경로로 추가 점검 예정 |
| 30행 배치표 | `docs/content/v003-event-placement.csv` 구조/행 수/대표행 검토 | 30행. 저장 위치·후보 경로·플레이 검증 상태 분리. UTF-8 BOM이 있으므로 프로그램에서는 utf-8-sig로 읽기 |
| 실제 로컬 API | `cd web && node tests/v003-local-api.mjs /var/folders/1k/_rg_csns6wv0s0t2hqpkvbdm0000gn/T/simus-v003-local-1kuCzd/local-state.json` | **PASS**. 실제 v003 WebGL 산출물로 정상 start한 격리 서버, 별도 API 시민 사용. [전체 증거](v003-local-api-evidence.json) |
| 실제 start API 버전 거절 | `cd web && node tests/v003-start-negative.mjs /var/folders/1k/_rg_csns6wv0s0t2hqpkvbdm0000gn/T/simus-v003-local-1kuCzd/local-state.json` | **PASS**. 별도 QA DRAFT의 잘못된 path/좌표는 409 `NPC_PATH_INCOMPATIBLE`; status DRAFT, starts_at null, city/admin_actions 0 유지. [증거](v003-start-negative-evidence.json) |
| 실제 브라우저/WebGL | 팀장 Chrome CUA 실제 입장 | **재검증 진행 중**. 최초 32MiB OOM, 이후 512MiB는 로딩 성공했으나 DOM 버튼에 포커스가 있을 때 Unity 프레임 정지 발견. `runInBackground=true` 수정 빌드 후 검증 필요 |

## 검토 중 발견한 사항

1. v003 빌드에 `path_versions` 또는 NPC 지원 필드가 빠져도 공용 검사만으로 통과할 수 있었다. 담당자에게 전달하여 v003 전용 kind/NPC/path/기준 씬 SHA/정확한 경유점·속도·loop 검사를 추가했다.
2. 빌드 URL 제안과 서버 등록값이 달랐다. `/unity/city-masterplan-v003-local-v1`로 통합했다.
3. 마감 후 이미 접수한 결과가 사라질 수 있었다. 결과 조회를 open 여부와 독립 처리하도록 담당자가 수정했다. 마감 시각을 넘긴 실제 확인 테스트는 별도다.
4. 저장된 `FULL_EVENT_30_INTERACT` 위치와 로컬 NPC 정지 위치가 다르다. 저장 앵커와 런타임 선택점을 혼동하지 않도록 배치표에 분리 기재 요청했다.

## 11월 17일 재개 검증

- 교정된 바닥 높이 `[0.202832, 0.301893, 0.412014]`의 canonical route와 서버 사본을 확인했다. Unity 물리 결과의 `passed=true`는 [물리 증거](v003-local-physics.json)를 따른다. 이 증거는 정적 물리 검사이며 WebGL 플레이와 별개다.
- 최신 코드에서 `node --test tests/v003-build-readiness.test.mjs tests/unity-bridge.test.mjs tests/participant-npc-motion.test.mjs tests/npc-place-trajectory.test.mjs`를 다시 실행해 **20 passed / 0 failed**를 확인했다.
- lib 하위 폴더 이동 이후 `npx tsc --noEmit` 및 실제 변경된 `lib/{routes,npc,city}`·이벤트 API·UnityCity·v003-test scoped eslint가 통과했다.
- API 검증 스크립트는 실제 경과 도착 시간, 서버 권위 도착 시간, 정지 반경, RESULT 대기, 재개 스냅샷 이동 거리, 같은 선택 재전송 및 DB 원장 한 건/실제 적용 도시 변화량을 검사한다. 서버 스냅샷에서 계산한 이동 거리는 Unity 렌더러를 관측한 거리와 구분한다.
- [백엔드 전체 회귀 기록](v003-backend-validation.md)의 production build/격리 통합검사도 참고한다. 브라우저 선택 검사는 환경변수 미설정으로 SKIP이었다.

## 첫 서버·DB 관측 (11월 17일)

서버 `http://127.0.0.1:3210`, PostgreSQL `127.0.0.1:55443/simus_v003_local`을 사용했다. `scripts/dev/v003-local.mjs`가 만든 새 클러스터이며 일반 개발 DB 환경변수는 사용하지 않았다. 테스트용 참가자와 QA DRAFT를 추가했으며 사용자 브라우저의 쿠키·플레이 상태는 건드리지 않았다.

- 버튼 전 두 차례 조회는 WAITING, NPC speed 0이었다. 자동 상황 발생 없음.
- 같은 시작 요청을 재전송해도 GUIDING 상태를 유지했다.
- 시작 HTTP 요청부터 ACTIVE를 관측하기까지 **10.500초**. 서버의 guidance epoch→실제 occurrence started_at은 **9.573초**였다. 반경 0.6m에 진입하며 멈추므로 경로 끝까지 명목 10.001초와 다르다. HTTP 관측값에는 서버 요청과 500ms 검사 간격이 포함된다.
- EXHIBITION_30 ACTIVE 중 2.1초 간격 NPC 경유점이 같고 speed 0. 실제 정지점은 상호작용 중심에서 **0.599367m**였다.
- 원본 첫 선택 `경찰에 신고한다.`가 201로 저장됐다. 같은 request_key 재전송은 200이며 record_id/state_version이 동일했다. DB 원장은 해당 event **1건**, 실제 적용값은 행복 **0**, 치안 **+3**, 청결 **0**, state_version `1`이었다.
- RESULT에서 **2.117초** 추가 대기 후에도 speed 0. 즉시 결과 payload에 개인 성향 필드는 없었다.
- 확인 후 WAITING으로 돌아가고 motion revision이 증가했다. 2.1초 뒤 서버 스냅샷에서 계산한 이동 거리는 **2.9596m**. 확인 재전송은 200, 새 시작 요청은 `EVENTS_EXHAUSTED`였다.
- 최초 negative fixture는 필수 `created_by_admin_id` 누락으로 INSERT가 거절됐고, fixture 보완 후 두 종류의 실제 start 거절·rollback 검사를 통과했다. 제품 코드 오류로 기록하지 않는다.

이 시간·거리는 API/DB 관측이다. 실제 Unity 화면을 본 결과는 아래 브라우저 검증이 별도로 충족해야 한다. 90초를 제품 요구로 채택하지 않았다.

## 첫 브라우저 실패와 재검증 상태

팀장이 실제 Chrome CUA 첫 입장 중 WebGL 초기화 OOM과 `memory access out of bounds`를 관측했다. 따라서 위 API PASS만으로 대표 상황의 실제 브라우저 플레이 완료를 선언하지 않는다. Unity 담당이 WebGL 메모리·정적 배칭을 조사하여 새 빌드를 준비하고 있다.

같은 시점 서버 귀환 경로를 `[actualStop, ...resume_points.slice(1)]`로 보완했다. 이전 경로는 정지점에서 중심까지 약 0.6m 더 진행한 뒤 귀환했다. 최종 API 재검증에는 첫 귀환 경유점 일치와 z 감소 검사를 추가했다.

이후 실행 환경 초기화로 임시 디렉터리와 기존 3210 서버가 사라졌다. 저장소에 복사한 첫 API/negative 증거는 보존했다. 새 격리 DB·수정된 실제 WebGL로 재검증해야 하며, 이전 `local-state.json` 경로는 더 이상 유효하지 않다.

## 새 격리 DB·수정된 귀환 경로 API 재검증

새 클러스터 `simus-v003-local-1kuCzd`에서 위 두 실제 API 검사를 재실행해 모두 통과했다. 이 실행 시점 WebGL 메모리 수정 빌드는 진행 중이므로 렌더링 문제 해결 증거와는 별개다. 첫 실행 JSON은 `v003-local-api-initial-evidence.json` / `v003-start-negative-initial-evidence.json`으로 보존했다.

- HTTP 도착 관측 **10.320초**, 서버 권위 이동 **9.573초**, 중심까지 거리 **0.599367m**.
- RESULT 추가 대기 **2.110초** 동안 정지 유지. 원장 1건, 실제 도시 변화 0/+3/0, 같은 키 재전송 멱등성 통과.
- 귀환 경로 `[[44.35,0.40258618123107276,78.40070711869225],[44.35,0.301893,72],[44.35,0.202832,65]]` 확인. 첫 귀환 경유점이 canonical `resume_points[1]`이고, 다음 서버 샘플 z가 감소한다. 재개 이동 거리 **2.9694m**.
- 새 QA DRAFT의 잘못된 path/points start 409와 DRAFT·action·city rollback도 다시 통과했다.

## 최종 512MiB WebGL 배포 후 API 검증

[최종 실제 빌드](v003-webgl-build.json)가 공개 경로에 배포된 뒤 같은 격리 서버에서 별도 시민으로 API/negative 검사를 다시 실행해 모두 통과했다. WASM SHA-256은 `76333a171a1604b6d7b57367faa80a0ca364c586f1d530572130016ad9aa5ffa`, 초기 heap 536,870,912 bytes이며 실제 WASM memory section에서 확인한 빌드다. `.data` 182,890,705 bytes를 포함해 전체 파일 해시는 빌드 증거를 따른다.

최종값은 **HTTP 도착 9.986초 / 권위 이동 9.573초 / RESULT 추가 대기 2.119초 / 재개 거리 2.9638m**이다. 반경 내 정지·중복 선택 한 건·귀환 첫 경유점과 z 감소·확인 멱등성·소진 검사를 통과했다. 최종 검증 시민의 원장 state_version은 `2`, 실제 도시 변화는 행복 0/치안 +3/청결 0이다. 최신 [API 증거](v003-local-api-evidence.json)는 이 실행이며, 귀환 수정 직후의 이전 증거는 `v003-local-api-returnfix-evidence.json`으로 보존했다.

### 512MiB 첫 브라우저의 포커스 문제

512MiB 수정 빌드는 도시·NPC 로딩과 웹의 GUIDING→ACTIVE 진행에 성공했다. 그러나 시작 DOM 버튼에 포커스가 있을 때 canvas가 출발점에서 정지했고 canvas를 클릭하자 즉시 상자 위치로 갱신됐다. 팀장의 실제 CUA 관측이며 **브라우저 플레이 FAIL**로 유지한다. Unity 담당이 `runInBackground=true`를 추가하여 재빌드하고 있다. 최종 브라우저 통과에는 시작/결과 DOM 버튼에 포커스를 둔 채 실제 NPC 이동·정지·재개가 보여야 한다. 서버 API PASS는 이 렌더링 문제를 대신하지 않는다.

## 검증 경계

서버 API 통과는 화면에서 실제 NPC 메시·카메라·이동을 본 증거가 아니다. Unity 물리 검증, 새 v003 WebGL 생성, 브라우저 READY/BOUND와 실제 캔버스 이동/정지/재개 결과를 각각 기록해야 한다. 기존 v002 바이너리·manifest 수정·mock iframe을 v003 실행 증거로 인정하지 않는다. 휴대폰 성능·30개 상황 플레이·전시 최종 승인도 별도다.
