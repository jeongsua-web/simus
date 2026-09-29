# SIM:US 3단계 — PostgreSQL DB·서버

2026-09-24. Python 3.13 / psycopg 3.3.3 / PostgreSQL 18 환경에서 검증.
모바일 UI와 Unity 통신 컴포넌트는 다음 단계다. 현재 제공물은 JSON API와 DB 처리 경로다.

## 기존 초안과의 차이

| 항목 | 기존 SQLite 초안 | 현재 PostgreSQL 서버 |
|---|---|---|
| 기준 스키마 | 자체 4개 테이블 | 기존 SQL 17개 테이블 + 종료 승인 테이블 1개 |
| 콘텐츠 | 5개 예시 상황 | 테스트 초안 WASTE 1개·선택지 2개 |
| 기본 회차 | 시작 시 자동 30분 | 관리자 요청으로 5분, 자동 시작 없음 |
| 도시 계산 | 정수 1000배, 3자리 반올림 | Decimal 계산, 기존 numeric 소수점 10자리 저장 |
| 지역 | 상황별 오염도와 단순 평균 | 지역별 영향 원장, 지역 가중 평균 |
| 선택 기록 | 선택·버전 중심 | 점수·계수·요청 영향·실제 영향까지 보존 |
| 종료 | 프로세스 메모리 잠금 | PostgreSQL 회차 잠금 + 종료 승인/커밋 게이트 |
| 결과 | JSON 문자열 | 도시·지역·개인 결과 테이블의 불변 스냅샷 |
| 관리자 이력 | 없음 | 실행 관리자 ID·종료 방식·실제 종료 시각 |
| 재접속 | 해시 토큰 | 해시 토큰 + DB 만료·폐기 확인 |

기존 SQLite는 `legacy/`에 복사해 보관했다. 실제 SQLite 데이터 이관은 하지 않았다.
`content.py`의 5개 상황은 기존 자료로 유지하고 성향 이름 판정 함수만 재사용한다.
기존 `outputs/sql/01_schema.sql`~`03_verify.sql`과 테스트 조건 초안은 변경하지 않았다.

## 임시 기본값

상황 1개, 예상 2명, 1인당 1회, 300초, 보정 계수 0.1, 지역 ‘학교 서쪽 · 분리배출함’.
시작 API에서 회차 길이(10~86400초 정수)와 계수(0~1, 소수점 10자리 이내)를 지정할 수 있다.
이는 구현 확인용 기본값이며 테스트 조건이나 실제 전시 운영값을 확정한 것이 아니다.
상황 구성·지역·계수는 시작 후 변경하지 않는다. 각 회차의 도시와 개인 상태는 초기화한다.

## 설치와 DB 준비

저장소 루트에서 실행한다. 기존 DB를 삭제하거나 초기화하는 명령은 없다.
새 전용 DB를 만들고 소유자 접속 주소를 `OWNER_DATABASE_URL`에 설정한다.
`DATABASE_URL`은 서버 전용 역할의 접속 주소다. 비밀번호를 소스나 Unity에 넣지 않는다.

```sh
python3 -m venv prototype/.venv
prototype/.venv/bin/pip install -r prototype/requirements.txt
psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 -f outputs/sql/01_schema.sql
psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 -f prototype/sql/04_runtime.sql
psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 -f prototype/sql/06_local_admin.sql
```

DB 관리자로 `simus_runtime` LOGIN 역할을 생성하고 비밀번호를 별도 설정한 뒤 권한을 부여한다.
예: psql에서 `CREATE ROLE simus_runtime LOGIN;` 후 `\password simus_runtime`으로 입력한다.
소유자·슈퍼유저·CREATEDB·CREATEROLE 권한을 서버 역할에 부여하지 않는다.

```sh
psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 -v runtime_role=simus_runtime -f prototype/sql/05_runtime_role.sql
export SIMUS_ADMIN_ID=00000000-0000-0000-0000-000000000001
prototype/.venv/bin/python prototype/server.py
```

`DATABASE_URL`은 실행 전에 환경변수로 설정해야 한다. 기본 수신 주소는 `127.0.0.1:8765`다.
서버가 생성하는 `prototype/data/admin-key.txt`를 관리자 로그인에 사용한다(파일 권한 600).
관리자 세션은 서버 재시작 시 만료된다. 관람객 토큰과 선택·결과는 DB에 남는다.
활성 관리자 행이 없으면 서버 시작과 관리자 동작을 거부한다.

기존 01·02가 적용된 **별도 개발 DB**에는 04·05만 추가할 수 있다. 02의 DRAFT 샘플을 자동 시작하지 않으며, 새 회차는 시작 API가 만든다. 01·04는 재실행용이 아니다.
`03_verify.sql`은 원래의 01·02 조합용이다. 04 적용 이후에는 아래 서버 통합 테스트를 사용한다.

같은 Wi-Fi 시험은 `--host 0.0.0.0 --public-url http://컴퓨터IP:8765/`로 별도 실행한다.
HTTP와 키 파일 인증은 로컬 연결 시제품 범위다. 공개 배포에는 HTTPS·운영 인증·요청 제한 등 별도 구성이 필요하다.
현재 루트 경로는 화면이 아니라 404 안내를 반환한다. QR이나 관리자 화면은 아직 없다.

## API 계약

요청은 `Content-Type: application/json`, 최대 8192바이트다. 시간은 DB 시각 기준이며 ISO 8601로 반환한다.
회차·상황·선택·요청 번호는 UUID다. 이전 SQLite의 `waste`, `sort` 같은 문자열 ID와 호환되지 않는다.
공개 숫자는 JSON number, DB 저장값은 numeric이다. Unity는 표시할 때만 소수점 한 자리로 반올림한다.

| 메서드·주소 | 입력 | 응답·권한 |
|---|---|---|
| POST `/api/admin/login` | `{"key":"관리자 키"}` | 관리자 HttpOnly 세션 쿠키 |
| POST `/api/admin/start` | `{"duration":300,"scale":0.1}` | 관리자 전용, 새 회차 상태 |
| POST `/api/admin/finish` | `{"round":"UUID","confirmed":true}` | 관리자 전용, 최종 상태 |
| GET `/api/state` | 없음 | 최신 시작 회차, 서버 시간 |
| GET `/api/state?round=UUID` | 명시한 회차 | 과거 회차 포함 도시 상태 |
| POST `/api/join` | `{"round":"UUID"}` | 익명 관람객 HttpOnly 쿠키, `ok` |
| GET `/api/me?round=UUID` | 관람객 쿠키 | 본인의 응답·상황·선택지·과거 회차 목록·결과 |
| POST `/api/choice` | `{"round":"UUID","situation":"UUID","choice":"UUID","request":"UUID"}` | `ok`, `version`, `replayed` |
| GET `/api/config` | 없음 | 접속 주소 설정·관리자 세션 여부 |

상황과 선택지 UUID는 참여 후 `/api/me`의 `situations[].id`, `choices[].id`에서 얻는다.
새 회차마다 ID가 바뀐다. 클라이언트가 임의로 현재 회차로 바꾸어 재전송하면 안 된다.
`/api/state`는 `{round:{id,name,status,started,ends,cutoff,ended,mode,version,responses,accepting,happiness,safety,cleanliness,pollution,regions:[{id,name,pollution}]},server_time}` 형태다.
`/api/me`의 `result`는 종료 전 null, 종료 후 본인의 `{x,y,count,alignment_code,alignment,interpretation}`이다.
공개 콘텐츠에는 개인 점수·도시 영향값·계수를 넣지 않는다. 선택 기록도 본인 것만 반환한다.

같은 요청 UUID·같은 본문은 종료 뒤에도 기존 성공 버전을 반환한다. 다른 본문은 409다.
같은 상황에 새 요청 UUID를 보내도 재선택은 409다. 실패 응답은 성공 원장에 저장하지 않는다.
통신 실패 시 **같은 요청 UUID와 본문**으로 재전송한다. `replayed`만 달라지고 반영 버전은 동일하다.
400은 잘못된 입력, 401은 인증 필요, 403은 권한 부족, 404는 회차 없음, 409는 중복·마감·충돌, 503은 일시적 지연이다.

## 종료와 동시성

- 접수 시각은 JSON 검증 후 DB 처리 경로에 진입했을 때 기록하며 회차 잠금을 기다리기 전이다. 클라이언트 시각은 받지 않는다.
- 자동 마감은 `received_at < scheduled_end_at - 5초`인 경우만 허용한다. 마감 뒤에도 결과 공개 전에는 RUNNING일 수 있어 `accepting`도 확인해야 한다.
- 같은 회차의 선택은 DB 행 잠금으로 직렬화한다. 선택·개인·도시·지역·원장을 한 트랜잭션으로 저장한다.
- 선택 COMMIT 직전 지연 트리거가 회차별 advisory lock을 얻어 종료 시각과 종료 승인 기록을 재검사한다. 실패하면 전부 롤백한다.
- 수동 종료는 같은 게이트에서 `session_closures`를 먼저 커밋한다. 이미 저장을 마친 선택은 보존하고, 아직 최종 검사에 도달하지 않은 선택은 취소한다. HTTP 요청 도착 자체가 승인 시점은 아니다.
- 종료 승인 다음 트랜잭션이 미완료 선택의 롤백을 기다리고 CLOSING → FINALIZED와 모든 결과를 원자적으로 저장한다. 반복 승인·확정은 중복 효과가 없다.
- 승인 뒤 프로세스가 중단되어도 0.2초 주기 작업 또는 상태 조회가 승인 기록을 찾아 확정을 재개한다. 서버가 중단된 동안 자동 결과 공개는 지연되며 재시작 후 복구한다.
- 실제 종료 시각은 승인 기록의 DB 시각이다. 예정 종료 시각과 결과 확정 시각도 별도로 보존한다.

종료 경계 검증은 DB의 최종 커밋 검사 시점을 기준으로 한다. 검사 뒤 WAL 기록·디스크 동기화가 지연되어 물리적 커밋 완료가 종료 시각을 넘는 장애까지 차단한다고 보장하지 않는다. 이 극단적 장애 조건의 처리 기준은 전시 운영 전 추가 검증·합의가 필요하다.
서버 DB 자격증명은 신뢰 경계다. 역할은 DDL·DELETE·원장/결과 수정 권한이 없지만 서비스 수행에 필요한 INSERT/일부 UPDATE 권한은 가진다. DB 자격증명을 가진 임의 프로그램의 모든 우회를 막는 저장 프로시저 전용 구조는 아니다.

## 통합 테스트

`SIMUS_TEST_ADMIN_DSN`에는 **전용 테스트 PostgreSQL 클러스터**의 관리자 연결을 지정한다.
테스트가 고유 이름 DB와 역할을 생성하고, 만든 것만 끝에 삭제한다. 기존 스키마 검증 후 04를 적용하고 서버용 제한 역할로 테스트한다.

```sh
SIMUS_TEST_ADMIN_DSN='host=/tmp/simus-stage3-socket port=55439 dbname=postgres' \
  prototype/.venv/bin/python -W error::ResourceWarning prototype/tests/test_postgres.py
```

위 예시 소켓은 이번 검증에 사용한 임시 클러스터 경로다. 실행 시 해당 클러스터를 시작하거나 본인의 테스트 클러스터 주소로 바꾼다.
결과 기록은 `tests/last-run.txt`, 검증 범위는 `../outputs/시제품_3단계_검증결과.md`를 참고한다.

구현 참고: [Psycopg 트랜잭션](https://www.psycopg.org/psycopg3/docs/basic/transactions.html), [PostgreSQL 잠금](https://www.postgresql.org/docs/18/explicit-locking.html).
