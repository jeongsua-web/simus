# 입장 프로필(닉네임·학과·MBTI)

2026-10-08 구현. QR 접속 후 첫 화면에서 세 항목을 모두 입력해야 회차 도시 화면에 들어간다.
입력을 마치면 회차에 입장하며, 그 회차에서는 세 항목을 바꿀 수 없다. 화면 시안은 `docs/planning/mockups/mobile-profile-entry.html`이다.

## 데이터

- 마이그레이션: 005 이후 **009_participant_profiles.sql**. 회차/참여자 행(`simus.participant_sessions`)에 `nickname`, `mbti`, `profile_completed_at`을 추가한다.
- 세 값과 완료 시각은 모두 비어 있거나 모두 채워져 있어야 하며, 완료된 행의 학과는 `none`일 수 없다.
- 닉네임은 앞뒤 공백 없이 2~10자(코드 포인트), MBTI는 `[EI][SN][TF][JP]`.
- 완료 후 닉네임·MBTI·학과·완료 시각 변경은 DB 트리거가 거부한다. 학과의 첫 선택 후 잠금(005)도 그대로 적용된다.
- 기존 입장 기록은 프로필이 비어 있는 상태로 남고, 다음 입장 화면에서 프로필을 완료한다. 회차 진행 중 배포 시 이미 선택을 제출한 기존 참여자는 다른 학과로 완료할 수 없으므로 009는 회차 사이에 적용한다.
- 학과·MBTI·닉네임은 개인 점수·도시 수치·NPC 경로에 영향을 주지 않는다. 공개 NPC API에는 추가하지 않는다.

## 시민증 번호

`회차 순번 2자리-입장 순번 4자리`(예: `03-0127`). 저장 칼럼 없이 조회 시 계산한다.

- 회차 순번: 시작된 회차를 `starts_at` 순으로 센 값이다. 같은 DB의 시험·리허설 회차도 포함된다.
- 입장 순번: 같은 회차에서 `profile_completed_at` 순서다. 회차 행 잠금 안에서 `clock_timestamp()`로 기록하고 변경을 막으므로 한 번 발급된 번호는 바뀌지 않는다.
- 화면 표시용이며 식별·인증에 사용하지 않는다.

## API

본인 참여 쿠키 필요. 모든 응답은 `Cache-Control: no-store`.

`GET /api/sessions/{id}/profile`

```json
{
  "session_id": "회차 UUID",
  "joined": true,
  "profile": { "nickname": "새벽산책러", "department_id": "dept-23", "department_name": "게임콘텐츠과", "mbti": "INFP", "citizen_no": "03-0127" },
  "departments": [{ "id": "dept-01", "faculty": "산업디자인학부", "name": "영상디자인과" }]
}
```

입장 전에는 `joined: false, profile: null`. 기존 입장 기록만 있으면 `joined: true, profile: null`. 학과 목록은 `none`을 제외한 44개다.

`POST /api/sessions/{id}/profile`, JSON `{ "nickname": "새벽산책러", "department_id": "dept-23", "mbti": "INFP" }`

- 입장 기록이 없으면 같은 트랜잭션에서 3A 입장(NPC 생성)을 함께 수행한다. 검증 실패 시 입장도 롤백된다.
- 닉네임은 NFC 정규화, 앞뒤 공백 제거, 연속 공백 하나로 저장한다. 허용 문자: 글자·숫자·공백·`_ . -`.
- 성공 201 `{ "session_id", "profile", "replayed": false }`. 같은 값 재요청은 200 `replayed: true`(회차 종료 후 포함).
- 400 `INVALID_NICKNAME` / `INVALID_DEPARTMENT` / `INVALID_MBTI`, 401 `UNAUTHORIZED`, 403 `INVALID_ORIGIN`, 404 `SESSION_NOT_FOUND`.
- 409 `PROFILE_LOCKED`: 완료 후 다른 값. 409 `SESSION_CLOSED`: 시작 전·접수 마감·종료 후 신규 입력.

`PUT /api/sessions/{id}/department`는 프로필 완료 후 409 `DEPARTMENT_LOCKED`를 반환하고, `GET`의 `locked`도 `true`가 된다.

## 화면

- `/participate`는 더 이상 자동으로 회차에 입장하지 않는다. 현재 회차의 프로필이 없으면 입장 화면을, 있으면 도시 화면을 표시한다. 기존 학과 선택 상자는 제거했다.
- 입장 버튼은 세 항목이 모두 유효할 때만 활성화되고, 빠진 항목을 버튼 아래에 안내한다. 학과·MBTI의 건너뛰기 선택지는 두지 않는다.
- 저장 성공 후 도장·전환 화면을 거쳐 도시 화면으로 이동한다. 도시 화면 상단에 시민증 요약을 표시한다.
- 입장하지 않은 상태에서 접수가 마감되면 마감 안내를 표시한다.
- 선택 제출 API(`POST /api/choices`)는 아직 프로필 완료를 서버에서 요구하지 않는다. 화면에서는 프로필 없이 선택 화면에 접근할 수 없다.

## 검증

- `npm run lint`, `npm run build` 통과.
- `npm run test:integration`(임시 PostgreSQL·실제 서버): 입력 검증·정규화, 거부 시 입장 롤백, 재요청·잠금, 동시 입장 번호 직렬화, 학과 API·DB 직접 변경 차단, 기존 입장자 완료, 종료 후 차단, 다음 회차 분리 통과.
- Playwright Chromium 390×844: 입장 버튼 비활성·빠진 항목 안내·전환·도시 화면 시민증·새로고침 유지·가로 넘침 없음·JS 오류 없음. 기존 참여·학과·회차 전환 브라우저 검사도 입장 화면을 거치도록 갱신 후 통과.
- 개발/운영 DB에는 009를 적용하지 않았다. 실제 휴대폰 확인은 별도다.
