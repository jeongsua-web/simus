# SIM:US API

Next.js 서버 기준 URL: `http://localhost:3000`. 응답은 JSON이며 캐시하지 않습니다.

## 로컬 실행

저장소 루트에서 `docker compose up -d`로 DB를 시작합니다. 새 DB에는 초기 스키마가 자동 적용됩니다.
개발 회차가 없다면 루트에서 다음을 실행합니다.

```sh
docker compose exec -T db psql -U simus -d simus -v ON_ERROR_STOP=1 < db/seed_development.sql
```

`web`에서 `cp env.example .env.local`로 환경변수를 준비하고 `npm run dev`로 서버를 실행합니다.
기존 `.env.local`이 있으면 복사 대신 `DATABASE_URL` 설정을 확인하세요.
개발 seed는 최초 실행 시 7일간 진행하는 회차를 생성하며 재실행으로 만료 시간을 연장하지 않습니다.

## GET /api/sessions/current

`{ "session": { "id", "name", "status", "starts_at", "scheduled_end_at", "auto_cutoff_at", "accepting_choices", "situations": [...] } }`

RUNNING 또는 CLOSING 회차를 반환합니다. 없으면 `session: null`입니다.
각 상황에는 `id`, `code`, `title`, `body`, `display_order`, `choices`가 포함됩니다.
선택지는 `id`, `label`, `display_order`만 반환하며 개인 성향과 숨겨진 영향값은 공개하지 않습니다.

## POST /api/participants

본문 없이 호출합니다. 새 익명 참여자는 201, 유효한 기존 쿠키가 있으면 같은 참여자를 200으로 반환합니다.

```json
{ "participant_id": "uuid" }
```

토큰은 30일짜리 `simus_participant` HttpOnly / SameSite=Lax 쿠키로 발급되며 DB에는 SHA-256 해시만 저장합니다.
운영 환경 쿠키는 HTTPS가 필요합니다. 참여 회차 등록은 첫 선택 제출 시 자동으로 수행합니다.
브라우저는 같은 출처에서 호출하고 쿠키를 유지해야 합니다.

## POST /api/choices

참여자 쿠키와 `Content-Type: application/json`이 필요합니다.

```json
{
  "session_id": "10000000-0000-0000-0000-000000000001",
  "situation_id": "30000000-0000-0000-0000-000000000001",
  "choice_id": "40000000-0000-0000-0000-000000000001",
  "request_key": "50000000-0000-0000-0000-000000000001"
}
```

새 제출마다 `crypto.randomUUID()`로 요청 키를 만들고 네트워크 재시도에는 같은 키와 본문을 사용합니다.
성공은 201, 동일 요청 재시도는 200입니다.

```json
{ "record_id": "uuid", "state_version": "1", "replayed": false }
```

- 참여자당 상황별 한 번만 응답할 수 있습니다. 다른 키로 중복 제출하면 409입니다.
- 같은 키로 다른 선택을 제출하면 409입니다.
- 점수는 서버의 선택지 값으로 계산합니다. 성향은 dx/dy를 더하고 도시·지역 영향은 기본값 × 회차 impact_scale입니다.
- 도시·지역 수치는 0~100으로 제한하며 요청 변화량과 실제 반영량을 원장에 각각 기록합니다.
- 회차 행 잠금과 단일 트랜잭션으로 중복 방지, 개인 점수, 도시·지역 상태, 원장을 함께 반영합니다.
- 접수 마감은 예정 종료 5초 전(회차 admission_buffer 설정)이며 처리 전후에 DB 시각으로 확인합니다.
- 종료 후에도 이미 성공한 동일 요청은 재조회할 수 있습니다.

오류 형식: `{ "error": { "code": "...", "message": "..." } }`.
400은 잘못된 입력, 401은 인증 누락/만료, 403은 다른 출처 요청, 404는 없는 회차,
409는 중복·마감·상태 미준비, 415는 JSON 콘텐츠 타입 누락, 500은 서버 처리 오류입니다.

## GET /api/city-state

Unity의 `UnityWebRequest`에서 인증·참여자 쿠키 없이 조회할 수 있습니다.
후속 클라이언트 구현은 [Unity 연동 규격](../docs/unity-integration.md)의 필드 타입,
null 처리, 버전 비교, 폴링 및 회차 전환 기준을 따릅니다.

```json
{
  "city_state": {
    "session_id": "uuid",
    "status": "RUNNING",
    "happiness": 51,
    "safety": 50,
    "cleanliness": 54,
    "version": "1",
    "updated_at": "ISO 8601 timestamp",
    "overall_pollution": 0,
    "regions": [{ "id": "uuid", "code": "CENTER", "name": "중앙 구역", "map_metadata": {}, "pollution": 0, "updated_at": "ISO 8601 timestamp" }]
  }
}
```

도시 상태 행이 있는 진행/종료 처리 중 회차를 우선 반환하고 없으면 가장 최근 확정 회차를 반환합니다.
대상이 없으면 `city_state: null`입니다. 지역 상태가 없으면 `regions: []`, `overall_pollution: null`일 수 있습니다.
도시와 지역은 한 SQL 스냅샷으로 조회합니다. bigint 버전은 정밀도 손실을 막기 위해 문자열로 반환합니다.
`version`은 회차별 선택 반영 순번이며 상태 전이까지 나타내는 전체 응답 버전은 아닙니다.
Unity Editor·데스크톱은 접근 가능한 서버 주소를 사용하고, WebGL은 API와 같은 출처로 배포합니다.
현재 API에는 CORS 허용 설정이 없으며 이번 문서 작업에서 응답 구조나 서버 동작은 변경하지 않습니다.

## 검증 및 범위

`web`에서 `npm run lint`, `npx tsc --noEmit`으로 정적 검사를 실행합니다.
통합 테스트는 **별도의 폐기 가능한 DB**에 스키마와 seed를 적용하고 그 DB에 연결한 서버를 띄운 뒤 실행합니다.
테스트는 도시 수치와 접수 상태를 변경하므로 개발/운영 DB에서 실행하지 마세요.

```sh
TEST_API_URL=http://localhost:3101 TEST_DATABASE_URL=postgresql://.../disposable_test_db node tests/api.integration.mjs
```

## 관리자 회차 운영

`POST /api/admin/sessions/{session_id}/start`와 `POST /api/admin/sessions/{session_id}/end`는
`Authorization: Bearer <JWT>`와 JSON 본문 `{ "request_key": "uuid" }`를 받습니다.
JWT는 `ADMIN_TOKEN_ISSUER`, `ADMIN_TOKEN_AUDIENCE` 및 `ADMIN_JWKS_URL` 또는
`ADMIN_JWKS_JSON`으로 RS256 서명·발급자·대상·만료를 검증합니다. JWT `sub`와 일치하는
활성 `admin_users`만 실행할 수 있습니다. 같은 관리자의 요청 키는 같은 회차·작업에만 재사용할 수 있습니다.

시작 API는 DRAFT 회차를 잠근 뒤 상황, 선택지 수, 지역, 유한한 영향값, 기존 상태·원장 부재와
규칙 스냅샷을 검사합니다. 규칙 v1에는 -3/3 경계, 두 축의 방향, 9개 해석 문구, 도시·지역 초기값,
`zero_response_policy`, `completion_policy: "DRAIN"`이 필요합니다. 초기 상태와 RUNNING 전환은 같은
트랜잭션에 저장됩니다.

종료 API는 RUNNING을 CLOSING으로 먼저 커밋해 새 선택을 차단합니다. 이미 회차 잠금을 가진 선택은
완료 또는 롤백된 뒤 종료가 진행됩니다. 도시·지역·개인 원장 정합성을 확인하고 모든 결과와 FINALIZED를
한 트랜잭션으로 저장합니다. 동시 호출과 응답 유실 뒤 재호출은 저장된 결과를 반환합니다.

## 자동 종료와 복구

스케줄러가 최소 1분 간격으로 다음 요청을 보내도록 구성합니다. `SESSION_JOB_TOKEN`은 32자 이상의
무작위 비밀값이며 관리자 JWT와 별개입니다.

```sh
curl -X POST -H "Authorization: Bearer $SESSION_JOB_TOKEN" \
  https://simus.example/api/internal/sessions/reconcile
```

작업은 종료 시각이 지난 RUNNING을 AUTO/CLOSING으로 전환하고, 모든 CLOSING을 같은 확정 함수로
재개합니다. 서버가 종료 도중 재시작되어도 다음 호출이 DB 상태에서 복구합니다. 여러 스케줄러 호출은
회차 행 잠금으로 직렬화됩니다. 스케줄러 실행이 늦으면 접수 자체는 기존 DB 시각 조건으로 cutoff부터
거부되며, 확정 시각은 실제 복구 시각이 됩니다.

## GET /api/sessions/{session_id}/result

유효한 `simus_participant` 쿠키의 본인 확정 결과만 반환합니다. 회차가 FINALIZED 전이면 409,
본인이 결과 대상이 아니면 `{ "result": null }`입니다. 점수 bigint는 문자열이며 응답은
`session_id`, `x_score`, `y_score`, `response_count`, `alignment_code`, `interpretation`,
`finalized_at`을 포함합니다. 참여자 ID를 요청에서 받지 않으므로 타인의 결과를 지정해 조회할 수 없습니다.

접수 중 공개 API는 개인 점수와 선택지의 성향·도시·지역 영향값을 반환하지 않습니다.

## GET /api/sessions/{session_id}/responses

익명 참여자 쿠키가 필요합니다. 요청한 회차의 공개 수명 주기 필드와 호출자 본인이 제출한
`situation_id`, `choice_id`, `received_at`만 반환합니다. 성향 점수, 선택지 영향값, 적용 변화량과
도시 수치는 제외합니다. 새로고침 후 완료 상태를 복원하는 용도이며 확정 전에도 호출할 수 있습니다.

## GET /api/participants

유효한 참여자 쿠키가 필요하며 본인이 가장 최근 참여한 회차의 상태와 응답 수를 반환합니다. 만료되거나
유효하지 않은 인증에는 401을 반환합니다. `POST /api/participants`는 참여자 쿠키가 전혀 없을 때만
새 익명 참여자를 생성합니다.

## GET /api/admin/sessions

시작·종료 API와 같은 관리자 Bearer JWT 및 활성 관리자 DB 검증이 필요합니다. 전체 회차, 참여자·응답 수,
수명 주기 시각, 서버에서 판단한 시작 전 검증 실패 원인을 반환합니다. `can_start`는 화면 표시용이며 실제
시작 요청에서도 회차를 잠근 뒤 독립적으로 다시 검증합니다.

## 2026-09-29 통합 추가

- `POST /api/admin/sessions`: JWT 관리자만 DRAFT/FINALIZED 회차 콘텐츠를 복제해 다음 DRAFT 생성. 이름·진행 시간·영향 배율·request_key 지정. 동일 요청 재전송은 같은 회차 반환.
- `GET /api/admin/sessions`: 복제 회차의 `duration_seconds` 추가. 시작 시점부터 적용.
- `GET /api/participants`: 본인의 종료된 회차 `history` 추가.
- `GET /api/sessions/{id}/result`: 확정된 해당 회차 `city_state` 추가. 본인 result 계약 유지.

요청/응답 상세와 마이그레이션: [통합 안내](../docs/stage4-8-integration.md).

## 3A 회차 입장·NPC API

`POST /api/sessions/{id}/join`, `GET /api/sessions/{id}/npc`(본인 인증), `GET /api/sessions/{id}/npcs`(공개 익명 NPC). 필드·좌표·보간·종료 동결·오류는 [공유 계약](../docs/participant-npc-api.md)을 따른다. DB 004 적용이 필요하다.

## 3C 회차별 학과 API

`GET /api/sessions/{id}/department`(본인 소속·목록·잠금), `PUT /api/sessions/{id}/department`(첫 선택 전 수정).
본인 쿠키 인증과 DB 005가 필요하다. [필드·오류·동시성·4A 연결 계약](../docs/participant-departments.md).
