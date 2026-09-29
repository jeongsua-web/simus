# 4~8단계 공통 API 계약

2026-09-24. 기준 구현: 3단계 `server.py`, `store.py`, `SERVER_README.md`.
**기존 PostgreSQL API를 재사용한다.** SQLite legacy와 작업 공간의 별도 Next.js API는 사용하지 않는다.
서버 파일·스키마는 이번 작업에서 수정하지 않는다. 아래 '제안'은 서버 반영 완료를 뜻하지 않는다.

## 연결 및 데이터 출처

브라우저는 같은 출처 `/api/`를 호출하고 HttpOnly 쿠키로 인증한다. Unity는 공개 state만 읽는다.
`client_gateway.py --upstream http://127.0.0.1:8765`는 화면 정적 파일과 API 역방향 프록시만 제공한다.
실패 시 502를 반환하고 모의 성공으로 대체하지 않는다. `client-config.json`의 `mode=live`는
실제 서버 코드 연결 방식이며 운영 데이터라는 뜻은 아니다. `label`로 테스트 DB 여부를 명시한다.
DB 비밀번호·관리자 키는 번들/Unity에 넣지 않는다. 관리자 키는 로그인 폼 입력으로만 전달한다.

## 현재 구현 계약

| 메서드/경로 | 요청 | 응답/권한 |
|---|---|---|
| POST /api/join | `{round: UUID}` | `{ok:true}`, 익명 HttpOnly `simus_visitor`; 기존 유효 쿠키 재사용 |
| GET /api/state | 없음 | 최신 시작 회차의 `{round,server_time}`; 공개 |
| GET /api/state?round=UUID | 회차 ID | 해당 회차 최종 도시 포함; 공개 |
| GET /api/me?round=UUID | 관람객 쿠키 | 본인 참여/상황/선택/과거 결과; 미인증 401 |
| POST /api/choice | `{round,situation,choice,request}` 모두 UUID | `{ok,version,replayed}`; 본인 참여 필요 |
| POST /api/admin/login | `{key:string}` | `{ok:true}`, HttpOnly `simus_admin` |
| GET /api/config | 없음 | `{join_url,admin}`; admin은 현재 쿠키 유효성 |
| POST /api/admin/start | `{duration:10..86400 정수,scale:0..1}` | 새 `round` 객체 직접 반환; 관리자 |
| POST /api/admin/finish | `{round:UUID,confirmed:true}` | 종료한 `round` 객체 직접 반환; 관리자 |

`round`: `id,name,status,started,ends,cutoff,ended,mode,version,responses,accepting,
happiness,safety,cleanliness,pollution,regions:[{id,name,pollution}]`.
시각은 서버 DB ISO 8601, cutoff=ends−5초. version은 회차별 선택 반영 버전이며
종료 전이만으로 증가하지 않을 수 있다. 같은 version의 FINALIZED도 반드시 수신한다.
`GET /api/me`: `{joined,count,answers:[{situation_id,choice_id}],situations:[{id,code,title,body,choices:[{id,label}]}],history:[{id,name}],result}`.
미참여는 `{joined:false,history}`. result는 종료 전 null, 종료 후 본인만
`{x,y,count,alignment_code,alignment,interpretation}`. 과거 결과는 history의 id로 state/me 재조회.
현재 회차 없음은 404이며 새 회차를 클라이언트가 만들거나 가정하지 않는다.

## 마감·복원·재시도

- 자동 마감 정각(`received >= cutoff`) 신규 선택 거부. RUNNING이어도 accepting=false면 입력 마감.
- CLOSING은 종료 준비, FINALIZED만 결과 공개. 로컬 타이머는 참고 안내이며 서버 권한을 대신하지 않는다.
- 같은 참여자·회차·상황은 한 번 반영. 같은 request UUID+본문 재전송은 종료 뒤에도 기존 성공 반환.
- 네트워크/5xx 실패 시 성공 여부 불명: 원래 round/situation/choice/request 전체를 보존하고 me를 조회한 뒤 같은 요청만 재전송한다.
- 새 회차로 원래 제출을 옮기지 않는다. 409는 무조건 성공 취급하지 않고 본인 기록/마감 상태를 조회한다.
- 400/415는 입력 수정, 401은 인증 복원/로그인, 403은 권한·참여 확인, 404는 회차 확인,
  409는 충돌/중복/마감 확인, 500/502/503은 상태 재조회 후 제한적 재시도(1,2,4초 수준).
- 현재 오류는 `{error: 한국어 메시지}`이며 안정된 기계용 code/retry_after는 없다. 메시지 문자열 파싱 금지.
- 시작 요청은 멱등 키가 없다. 응답 손실 때 자동 재전송하지 않고 state를 먼저 확인한다.
- 조회는 최대 한 개 진행 또는 세대 번호로 응답 순서 제어. 회차 started가 이전이거나 동일 회차 version이 작으면 무시한다.
- FINALIZED에서 RUNNING으로 되돌아가지 않는다. 재접속·전면 복귀 시 서버 상태로 복원한다.

## 공개 범위

공개: 회차 상태·시각·도시/지역 수치·도시 최종 수치. 본인 전용: 선택 기록·참여 회차 목록·종료 후 개인 결과.
관리자 전용: 시작·수동 종료. 선택지 점수·영향값·개인 성향·학과 성향 통계는 종료 전 공개하지 않는다.
개인 초기값 (0,0), 성향 경계 −3/−2/+2/+3, 도시 50/50/50/0은 기존 서버 책임이다.
관리자도 현재 API로 다른 사람의 개인 결과를 조회하지 않는다.

## 서버 담당자에게 전달할 제안 — 현재 미구현

1. 오류 `code`, `retryable`, `server_time` 및 요청 추적 ID. 기존 필드와 호환되게 추가.
2. 시작 멱등 키, 관리자 로그아웃/세션 만료/운영 인증. 현 config는 세션 존재만 확인하며 활성 관리자 최종 확인은 mutation에서 수행.
3. 본인 NPC: 인증된 `GET /api/me/npc?round=UUID` → 회차/NPC opaque ID, map_version,
   좌표계(Unity XZ meters, Y up), path_id/version, epoch, speed, phase, server_time, stopped_at, state_version.
   공개 전시장 API는 익명 NPC ID만 제공하고 개인 인증 식별자와 학과/성향을 포함하지 않는다.
   종료 시 최종 위치/캐릭터 스냅샷 저장. 모바일과 Unity가 같은 ID·경로·서버시간으로 재현해야 한다.
4. 학과 목록 `GET /api/departments`; 본인 회차 소속 PATCH (첫 성공 선택과 같은 잠금 기준으로 고정).
   기타/외부/선택안함 지원. 학과 변경은 과거 회차에 영향 없음.
5. 종료 후 학과 집계: 유효 응답 기반, 응답자 분모 함께 반환, 응답 없으면 비율 null.
   성향 분포는 1회 이상 응답자 기준, 미응답 별도. **해당 상세 집계 5명 미만 suppressed=true, 수치 미반환**.
   클라이언트 숨김만으로 보호하지 말 것. 학과 전체 인격 평가라는 해석 금지.
6. 결과 알림: round+participant+channel 고유 발송 키, 동의·해지·재시도·중복 방지 outbox.
   채널은 미정. 현재는 열린 화면 내 결과 공개 안내만 가능. 닫힌 브라우저 알림 제공 아님.
7. 최종 도시 이미지/캐릭터: 서버가 확정된 round/version/map_version에 묶은 결과 자산 URL 제공.
   현재 최종 도시 수치 및 개인 성향은 조회 가능하나 최종 3D 이미지·개인 캐릭터 자산 API는 없다.

## 담당 파일 경계

A `client/mobile/`, B `unity/`, C `client/admin/`, 주 담당 `contracts/`, `client_gateway.py`,
`integration/`, `client/lab/`, 진행상태·통합 실행 안내. 공통 계약 변경은 주 담당 조정.
