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

Godot HTTPRequest에서 쿠키 없이 조회할 수 있습니다.

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

진행/종료 처리 중 회차를 우선 반환하고 없으면 가장 최근 확정 회차를 반환합니다. 대상이 없으면 `city_state: null`입니다.
도시와 지역은 한 SQL 스냅샷으로 조회합니다. bigint 버전은 정밀도 손실을 막기 위해 문자열로 반환합니다.
Godot 네이티브 HTTP 클라이언트에서 사용하며 웹 내보내기는 같은 출처로 배포해야 합니다.

## 검증 및 범위

`web`에서 `npm run lint`, `npx tsc --noEmit`으로 정적 검사를 실행합니다.
통합 테스트는 **별도의 폐기 가능한 DB**에 스키마와 seed를 적용하고 그 DB에 연결한 서버를 띄운 뒤 실행합니다.
테스트는 도시 수치와 접수 상태를 변경하므로 개발/운영 DB에서 실행하지 마세요.

```sh
TEST_API_URL=http://localhost:3101 TEST_DATABASE_URL=postgresql://.../disposable_test_db node tests/api.integration.mjs
```

관리자 회차 시작/종료 API, 자동 종료 작업, 최종 결과 계산은 이 네 API 범위에 포함되지 않습니다.
접수 마감 재검사는 커밋 순간까지의 엄격한 종료 시각 보장을 대신하지 않으며, 최종 종료 처리에는 별도 조정 로직이 필요합니다.
