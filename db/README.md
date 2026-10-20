# SIM:US PostgreSQL 스키마

시연용 새 DB에는 `001_initial_schema.sql` → `002_session_lifecycle.sql` → `003_session_creation.sql` → `004_participant_npcs.sql` → `005_participant_departments.sql` → `006_content_score_range.sql` → `007_result_links.sql` → `008_web_push.sql` → `009_participant_profiles.sql` → `010_session_npc_motion.sql` → `seed_demo.sql` 또는 `seed_neighborhood.sql`을 적용한다.
`seed_demo.sql`은 관리자 화면에서 시작할 DRAFT를 준비한다. 기존 `seed_development.sql`은 즉시 RUNNING으로
전환하는 개발용이므로 같은 DB에 혼용하지 않는다. 운영 DB에는 어느 seed도 적용하지 않는다.
구체적인 명령과 데이터 분리는 [시연·배포 가이드](../docs/operations/demo-deployment.md)에 있다.

`001_initial_schema.sql`은 DB 초안 v0.1의 **이번 연결 시제품** 범위를 구현한다.
기존 PostgreSQL 데이터베이스 안에 `simus` 스키마와 테이블 18개를 생성한다.
학과, 캐릭터/NPC, 확산, 알림, 선택적 요청 로그는 후속 범위로 제외했다.

기존 DB에는 데이터 삭제 없이 후속 마이그레이션을 번호 순서대로 한 번씩 적용한다.

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/002_session_lifecycle.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/003_session_creation.sql
```

`002_session_lifecycle.sql`은 허용 상태 전이, 시작 후 설정 고정, 회차 상태·원장·결과 쓰기 범위,
완전한 결과와 `FINALIZED`의 동일 커밋을 DB 트리거로 보강한다. 이미 존재하는 행은 변경하지 않는다.

## 실행

PostgreSQL 14 이상에서 새 데이터베이스를 준비하고 실행한다.

```sh
createdb simus
psql -d simus -v ON_ERROR_STOP=1 -f db/001_initial_schema.sql
```

원격 DB라면 `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/001_initial_schema.sql`을 사용한다.
기존 스키마를 지우지 않으며 두 번 실행하면 오류로 전체 롤백한다. 수정은 후속 마이그레이션으로 적용한다.
Next.js 서버 쿼리에서는 `simus.city_states`처럼 스키마를 명시한다.

Unity 도시 시각화 클라이언트와 브라우저에는 DB 접속 정보나 자격 증명을 제공하지 않는다.
PostgreSQL 접근은 Next.js 서버가 담당하며 Unity는 공개 `GET /api/city-state`와 회차별 NPC API를 조회한다. 본인 NPC 인증은 웹 호스트가 담당한다.
필드 타입과 null 처리, bigint 버전 비교는 [Unity 연동 규격](../docs/contracts/unity-integration.md)을 따른다.

생성 후 핵심 제약조건을 검증할 수 있다. 검증 데이터는 롤백되어 남지 않는다.

```sh
psql -d simus -v ON_ERROR_STOP=1 -f db/verify_schema.sql
```

## 설계 반영 사항

- UUID, 회차를 포함한 복합 FK, 동일 상황 및 요청 키 중복 방지.
- 실행/종료 중인 회차는 전체에서 최대 하나.
- 회차별 입력 차단 구간은 `admission_buffer`로 관리하며 기본값은 요구사항의 5초.
- 도시·지역 0~100 범위, 개인 점수 bigint, 소수 영향 numeric.
- 전체 오염도는 `simus.overall_pollution` 뷰의 지역 가중 평균.
- 입력 마감은 `simus.session_timing.auto_cutoff_at`으로 조회.
- 선택 원장과 최종 결과의 UPDATE/DELETE/TRUNCATE 거부 트리거.
- 상황·선택지·지역·기본 영향은 DRAFT에서만 편집 가능.
- 모든 FK의 삭제 정책은 과거 회차 보존을 위해 `ON DELETE RESTRICT`.
- 회차의 `updated_at`은 트리거로 자동 갱신.
- 도시 변화량은 초안에서 허용한 독립 numeric 컬럼 방식으로 저장.
- 개인·도시·지역 상태의 `updated_at`은 갱신하는 서버 쿼리에서 직접 설정한다.

## 서버와 운영 계층의 책임

아래 목록은 스키마만으로 완성되지 않는 책임의 목록이다. 현재 Next.js에는 인증·시작 검증·선택 트랜잭션·
종료/결과 확정이 구현돼 있다. 현재 구현/검증 상태는 [README](../README.md)와
[통합 검증 보고서](../docs/verification/integration-report.md)를 기준으로 본다. 운영 계정 분리·스케줄러 배포는 남아 있다.

이 SQL은 스키마 생성이며 다음 동작을 구현한 완성 서버가 아니다.

1. 익명 쿠키 토큰 발급·해시 저장·본인 인증, 관리자 인증 및 권한 검증.
2. 시작 전 상황당 선택지 2개 이상, 지역 및 모든 상태 행 존재, 유효한 규칙 스냅샷 검증.
3. 회차 상태 전이와 시작 후 회차 설정 고정. 초기 도시·지역·개인 상태 생성.
4. 선택 원장·개인·도시·지역 갱신을 하나의 트랜잭션으로 처리. 같은 요청 키의 본문 일치 검증.
5. 숫자 입력의 유한성, 기본 영향 범위 및 보정 계수 검증. 클라이언트 점수·시각을 신뢰하지 않기.
6. 마감·자동/수동 종료·미완료 트랜잭션 취소를 조정하는 서버 로직.
   **행 잠금이나 시간 검사만으로 엄격한 종료 시점의 커밋 차단을 보장하지 않는다.**
7. 최종 점수로 9종 성향 판정, 전체 결과를 함께 저장하고 FINALIZED로 전환.
   경계는 X/Y 각각 -3 이하, -2~2, 3 이상. 해석은 해당 회차 규칙에서 복사한다.
8. 종료 중 재시작 복구, 종료 후 상태 갱신 및 추가 결과 삽입 차단.
9. 종료 전 개인 점수와 선택지의 숨겨진 영향값을 공개 API에서 제외. 본인 결과만 공개.
10. 실제 배포 역할은 소유자와 분리하고 최소 권한 부여. DB 소유자는 트리거를 해제할 수 있다.

전체 오염 뷰는 존재하는 지역 상태를 집계하므로 시작 시 지역마다 상태 행을 반드시 생성한다.
도시와 지역을 API로 반환할 때는 단일 쿼리 또는 일관된 읽기 트랜잭션을 사용한다.

## 4~8단계 통합 추가

003은 콘텐츠 복제 요청의 멱등 키·원본 회차·시작 기준 진행 시간을 보존한다. 기존 데이터는 수정하지 않는다.
관리자 UI에서 복사한 DRAFT를 시작할 때 예정 종료 시각이 실제 시작 기준으로 계산된다.
`seed_neighborhood.sql`은 원본 PostgreSQL 시제품의 WASTE 1개 상황을 이식한 선택 가능한 시연 seed다.
Python 사본의 SQL은 본 스키마에 적용하지 않는다. [통합 안내](../docs/operations/stage4-8-integration.md).

## 3A NPC 마이그레이션

기존 DB에는 003 다음에 `004_participant_npcs.sql`을 한 번 적용한다. 회차 가입 행에 고정 NPC ID와 경로 스냅샷을 추가한다. 기존 선택·결과는 보존한다. [API·좌표·시간 계약](../docs/contracts/participant-npc-api.md).

## 3C 학과 저장 추가

004 적용 후 `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/005_participant_departments.sql`을 한 번 실행한다.
005는 45개 학과 항목과 회차별 `department_id`를 추가한다. 기존 가입자의 소속은 `none`으로 보존한다.
첫 유효 선택 후 변경을 DB에서도 차단한다. [API 및 검증](../docs/contracts/participant-departments.md).

## 5A 전시 콘텐츠 초안

005 뒤에 `006_content_score_range.sql`을 적용하면 신규 선택의 개인 점수 -4~+3을 원문 그대로 저장할 수 있다. 기존 회차의 규칙과 결과는 변경하지 않는다. 개발·검증 DB에서 `seed_demo.sql`을 적용한 뒤 `seed_exhibition.sql`을 적용하면 전시 30상황·91선택지 DRAFT가 추가된다. 운영 DB에 시드를 적용하지 않는다. 원문 동기화와 지역/자산의 미확정 범위는 [콘텐츠 인계 문서](../docs/content/exhibition-data.md)를 참고한다.

## NPC 이동 경로 설정 (010)

`009_participant_profiles.sql` 다음에 `010_session_npc_motion.sql`을 한 번 적용한다.
`simus.simulation_sessions.npc_motion`은 nullable JSONB이며 초기값은 NULL이다.
승인된 새 맵 경로가 정해지면 DRAFT 회차에만 설정한다. 기존 Neighborhood 경로를 복사하거나 자동 채우지 않는다.
필드는 `map_version`, `path_version`(영문·숫자로 시작하는 1~128자의 영문·숫자·점·밑줄·하이픈), `points`(2~2048개의 `[x,y,z]`),
`speed_mps`(0 이상 100 이하), `loop`(boolean)이다. 좌표 절댓값은 1,000,000 이하이고 경로 길이는 0보다 커야 한다.
좌표는 Unity 월드 미터 단위이며 값은 승인된 맵 자산에서 가져온다.

새 가입은 회차 행을 잠근 뒤 설정된 `npc_motion`을 `simus.participant_sessions.npc_motion`에 명시적으로 복사한다.
미설정 회차의 새 가입은 API에서 HTTP 409 `NPC_MOTION_NOT_CONFIGURED`로 거절한다.
DB도 미설정 경로 및 회차 설정과 다른 스냅샷을 거절하며 기존 가입의 NPC ID·경로는 계속 불변이다.
이미 적용된 004의 과거 스냅샷은 보존하지만 신규 가입에 사용되던 기본 경로는 제거한다.
현재 서버의 회차 복제(`web/src/lib/session-creation.ts`)는 `npc_motion`을 복사하지 않는다. 새 DRAFT에 승인된 경로를 별도로 설정해야 하며, seed도 새 전시 맵 경로를 자동으로 채우지 않는다.

이미 실행 중인 미설정 회차에서도 기존 가입은 조회할 수 있지만 신규 가입은 409로 거절한다. 경로 설정은 DRAFT에서만 가능하므로 승인된 경로를 설정한 새 초안 회차를 사용한다.

## NPC 위치 이벤트 (011)

010 다음에 `011_npc_events.sql`을 한 번 적용하고 `012_running_common_events.sql`을 적용한다. 기존 선택·스탯·가입 스냅샷은 보존한다. 012는 이벤트 기능 배포 전에 시작하여 공통 이벤트가 없는 RUNNING 회차에 중립적 공통 이벤트와 선택지 두 개를 추가한다. 이미 공통 이벤트가 있으면 변경하지 않으며 재실행할 수 있다.
`session_situations.event_location`에는 승인된 맵의 `{ "map_version": "...", "point": [x,y,z], "radius_m": ... }`를 DRAFT에서만 설정한다.
기존 상황은 좌표를 자동 생성하지 않고 `event_location=NULL`, `is_generic=false`로 보존한다.
어디서든 자연스럽게 발생할 수 있도록 명시적으로 작성한 공통 상황만 DRAFT에서 `is_generic=true`로 지정해 90초 대체 후보로 사용한다.
맵 전용 상황은 `is_generic=false`로 구분하며 이벤트 위치의 맵 버전은 가입 경로와 일치해야 한다.

`npc_event_states`는 참여자별 대기 시작, 이동 시간 기준과 누적 정지 시간(`paused_ms`), 60초 유도의 시작·출발·목표를 저장한다.
유도 필드 세 개는 함께 설정하거나 모두 NULL이어야 한다. 가입의 `npc_motion`은 계속 불변이며 서버가 별도 런타임 상태를 갱신한다.
`npc_events`는 참여자·회차·상황에 연결되고 `LOCATION` 또는 `DEADLINE` 발생 원인, `ACTIVE`/`COMPLETED` 상태와 시간을 저장한다.
부분 유일 인덱스가 참여자별 진행 중 이벤트를 하나로 제한한다. 완료 후 서버가 대기 시간을 재시작한다.

`choice_records.event_id`는 이벤트의 회차·참여자·상황과 일치하는 복합 FK이며 이벤트당 한 선택만 허용한다.
기존 이벤트 ID 없는 기록은 참여자·상황별 한 선택 제약을 유지한다. 새 이벤트는 각 발생 ID로 중복을 막아 콘텐츠 소진 후 공통 상황을 재사용할 수 있다.
서버는 인증된 참여자의 현재 ACTIVE 이벤트만 수락하고 기존 점수·도시 영향 계산과 같은 트랜잭션에서 완료 처리한다.
`db/verify_schema.sql`은 001~011 이후 실행하며 이벤트 위치, 진행 중 중복 방지와 불완전한 유도 상태 거부도 검증한다.

## 시민 캐릭터 선택 (013)

012 다음에 `013_participant_characters.sql`을 한 번 적용한다. 가입별 `character_id`는 `npc_01`~`npc_16`이며 기존 시민은 `npc_01`로 보존한다. 시민증 발급 시 저장하고 발급 후 DB와 API에서 변경을 막는다. 프로필·NPC 응답에 같은 ID를 제공한다. 이전 클라이언트의 ID 없는 발급 요청은 `npc_01`을 사용한다.

## 모듈 안경 조합 (014)

013 다음에 `014_participant_glasses.sql`을 한 번 적용한다. `character_id`는 16종 머리 모듈을 선택하고 `glasses_id`는 `none`, `square`, `round` 중 하나를 독립 저장한다. 기존 시민은 01 사각/04 원형/나머지 없음으로 보존한다. 발급 후 안경도 변경할 수 없다. 이전 클라이언트가 안경 필드를 생략하면 해당 머리의 기존 안경 기본값을 사용한다. 시민증·NPC 응답에 머리와 안경을 함께 전달한다.

## v002 그래프 유도 (015)

014 다음에 `015_npc_graph_guidance.sql`을 한 번 적용한 뒤 새 서버 코드를 배포한다. `npc_event_states.guidance_motion`과 생성 요청의 `npc_profile` nullable 열을 추가하며 기존 회차·가입 스냅샷은 갱신하지 않는다.
관리자 회차 생성 본문에 `"npc_profile":"city-rebuild-v002"`를 지정한 새 DRAFT만 테스트용 v002 보행 경로를 갖는다. 이전 맵 이벤트 위치·지역 geometry는 복사하지 않는다. 프로필 생략 시 기존 동작을 유지한다.
좌표·버전·유도·복귀·90초 정책과 검증 절차는 [Phase 2 기록](../docs/verification/city-rebuild-v002-webgl-phase2.md)을 참고한다. 전시 맵 승인이나 운영 `/city` 교체를 의미하지 않는다.
