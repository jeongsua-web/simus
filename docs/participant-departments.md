# 3C 회차별 학과 선택

2026-09-29 구현. [확정 정책](project-decisions-2026-09-29.md)의 42개 학과와 학부 구분을 그대로 사용한다.
자율전공학과는 `학부 지정 없음`에 두고, 기타·외부 관람객·선택 안 함을 추가한다.

## 데이터와 가입 계약

- 마이그레이션 순서: 001 → 002 → 003 → 004(NPC/입장) → **005_participant_departments.sql**.
- `simus.departments`: 고정 ID `dept-01`~`dept-42`, `other`, `external`, `none`. 이름·학부·표시 순서 포함.
- `simus.participant_sessions.department_id`: 회차/참여자별 FK. 기본 `none`이며 기존 가입자도 `none`으로 보존한다. 과거 소속을 추측해 채우지 않는다.
- 3A의 `POST /api/sessions/{id}/join`으로 입장한 같은 행에 저장한다. 재입장으로 학과를 초기화하지 않는다. 다음 회차는 기본 `none`에서 다시 선택한다.
- 학과는 개인 점수·도시 수치·NPC 경로에 영향을 주지 않는다. 학과를 선택하지 않아도 참여할 수 있다.

## API

본인 참여 쿠키 필요. 모든 응답은 `Cache-Control: no-store`.
다른 참여자 ID를 받지 않으며 공개 NPC API에 학과를 추가하지 않는다.

`GET /api/sessions/{id}/department`

```json
{
  "session_id": "회차 UUID",
  "department_id": "none",
  "locked": false,
  "departments": [
    { "id": "dept-01", "faculty": "산업디자인학부", "name": "영상디자인과" },
    { "id": "none", "faculty": "기타", "name": "선택 안 함" }
  ]
}
```

예시는 목록을 줄여 표시했다. 실제 목록은 45개다. 첫 유효 선택이 있거나 접수가 마감되면 `locked: true`.
가입 기록 없으면 404 `NOT_JOINED`, 인증 없으면 401 `UNAUTHORIZED`.

`PUT /api/sessions/{id}/department`, JSON `{ "department_id": "dept-01" }`

성공 200: `{ "session_id": "회차 UUID", "department_id": "dept-01", "locked": false }`.
같은 값 재저장은 첫 선택 전에는 허용한다. 저장 실패 시 재조회로 서버 값을 확인할 수 있다.

- 400 `INVALID_DEPARTMENT`: 목록에 없는 ID 또는 잘못된 타입.
- 403 `INVALID_ORIGIN`: 타 출처 쓰기.
- 404 `NOT_JOINED` / `SESSION_NOT_FOUND`: 가입 또는 회차 없음.
- 409 `DEPARTMENT_LOCKED`: 첫 유효 선택 이후의 저장 요청(같은 값 포함).
- 409 `SESSION_CLOSED`: 시작 전·마감·종료 이후의 저장 요청.

학과 변경은 선택/종료와 같은 회차 부모 행 잠금을 사용한다. 동시 첫 선택이 먼저 처리되면 수정은 거절되고,
학과 수정이 먼저 처리되면 수정된 학과가 첫 선택 시 고정된다. 잘못된 선택·롤백된 요청은 잠금 조건이 되지 않는다.
DB 트리거도 첫 선택 후 변경을 차단한다. 잠금 여부는 유효 원장 존재로 계산하므로 재전송이 잠금을 해제하지 않는다.

## 화면과 후속 작업

`/participate`의 학과 선택 상자에서 변경 즉시 저장한다. 저장 중에는 선택 제출을 막고,
첫 선택·미확인 제출·접수 마감 시 학과 입력을 막는다. 새로고침/주기적 조회에서 서버 값을 복원한다.

4A는 회차와 참여자 키로 이 소속을 원장/결과에 연결하면 된다. 집계 API, 종료 후 성향 공개,
5명 미만 상세 제한은 4A 범위이며 이 구현에는 포함하지 않는다. 미응답 결과 정책은 4B에서 별도 처리한다.

## 검증

- `npm run lint`, `npm run build` 통과.
- `npm run test:integration`: 별도 임시 PostgreSQL의 실제 API로 45개 목록, 인증/출처 차단,
  본인 분리, 첫 선택 전 변경, 잘못된 선택 후 수정 가능, 동시 첫 선택/학과 수정,
  직접 SQL 변경 차단, 재전송, 종료 후 차단, 다음 회차/과거 소속 보존 통과.
- 모바일 브라우저 검사는 `TEST_PLAYWRIGHT_MODULE`과 `TEST_CHROMIUM_EXECUTABLE`을 설정하면 실행한다.
- 개발/운영 DB에는 마이그레이션을 실행하지 않았다. 실제 휴대폰 현장 확인은 별도다.
