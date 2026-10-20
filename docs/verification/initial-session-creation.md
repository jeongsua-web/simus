# 최초 DRAFT 회차 생성 구현 및 검증

2026-10-20. 운영 DB 접속·초기화·마이그레이션 적용·배포·커밋·push는 수행하지 않았다.

## 동작과 변경 파일

- `web/src/app/admin/page.tsx`: 인증된 회차 목록을 성공적으로 읽은 후 생성 폼을 표시한다. 로딩/조회 실패를 회차 0개로 오인하지 않는다.
- `web/src/app/admin/CreateSession.tsx`: 전체 회차가 0개면 최초 생성 폼, 기존 회차가 있으면 기존 DRAFT/FINALIZED 복사 폼을 표시한다. 이름·시간·도시 맵·영향 배율을 입력한다. 생성 응답 후 목록을 다시 조회한다. 진행 중/종료 처리 중 회차만 있는 경우 최초 생성으로 전환하지 않는다.
- `web/src/lib/session-creation.ts`: 기존 POST `/api/admin/sessions`에 `creation_mode: "initial"` 분기를 추가했다. 기존 RS256 JWT, issuer/audience/expiry, 활성 관리자, Origin 검사 경로를 사용한다. 최초 요청에는 복사 원본을 허용하지 않고 `npc_profile: "city-rebuild-v002"`를 요구한다.
- 최초/복사 모두 이름 1~120자, 시간 정수 10~86400초, 영향 배율 유한 0~1(소수 10자리), UUID 요청 키를 검증한다. 최초 요청은 전체 생성 경로가 공유하는 트랜잭션 advisory lock 안에서 전체 회차 0개를 재확인한다. 같은 관리자/키/설정 재전송은 같은 회차를 반환하고, 설정 충돌 및 다른 키/관리자의 중복 최초 생성은 409로 거부한다.
- `web/src/lib/initial-session-content.ts`, `web/src/lib/data/initial-session-content.json`, `db/generate_exhibition_seed.mjs`: 승인 원문 `docs/content/situations-and-choices.md`의 30상황·91선택지와 동일 ID/문구/순서/영향값을 새 회차에만 INSERT한다. 생성기가 seed와 런타임 JSON을 같은 파싱 결과로 생성하고 `--check`로 두 결과를 검사한다. API는 seed SQL을 실행하지 않는다. 개발 관리자/개발 회차를 등록하지 않는다.
- 지역은 기존 콘텐츠 계약의 임시 `EXHIBITION_CITY` 1개와 선택별 오염 영향 91개다. 실제 지역 경계는 미확정(`placement=pending-map-v1`)이다. 이벤트 위치는 NULL, `is_generic=false`로 두며 기존 v002 위치 편집 API/화면에서 그래프 보행 지점을 지정한다. 미배치 상황은 기존 90초 대기 정책의 대상이다. Neighborhood 좌표를 가져오지 않는다.
- 초기 규칙은 기존 버전 1 계약(성향 경계 -3/+3, 질서/선 축, 도시 지표 50, 지역 오염 0, EXCLUDE/DRAIN), 예상 500명·1인 30응답, 접수 버퍼 5초다. 전시 정책/지역/좌표 최종 승인을 의미하지 않는다.
- NPC는 기존 `defaultMotion()`의 v002 보행 그래프 경로를 사용한다. 참가자·선택 원장·도시 실행 상태는 생성하지 않는다. 최초 회차와 복사 회차 모두 DRAFT이며 기존 관리자 시작 API만 RUNNING으로 전환한다. 시간은 시작 시점 기준으로 재계산한다. 기존 공통 중립 이벤트 보완 로직도 시작 API에서 유지된다.
- `db/017_initial_session_creation.sql`: 요청 기록의 원본 FK를 최초 요청에 한해 NULL로 허용하고 프로필 CHECK/전체 최초 요청 1개 partial unique index를 추가한다. 기존 행을 수정하거나 삭제하지 않는다.
- `db/migration-checksums.json`, `scripts/db/migrate.py`, `scripts/db/prepare-production.py`, `db/README.md`, `docs/operations/db-migrations.md`: 관리형 init/upgrade와 신규 설치 SQL 준비 순서에 017을 추가했다. 기존 migration 바이트/해시는 유지했다. 017은 baseline 대상이 아니다.
- `web/tests/initial-session.integration.mjs`, `web/tests/isolated-runner.mjs`: 아래 격리 테스트를 추가했다. 최초 전용 모드는 운영과 동일한 관리형 init SQL을 **새 임시 PostgreSQL 클러스터**에만 적용하며 seed를 실행하지 않는다.

## 실행 검증

`web/`에서 `npm run build`, `npx tsc --noEmit` 통과. `npm run lint`는 오류 0개, 기존 `shared-result/page.tsx:42`의 effect cleanup ref 경고 1개다.

`web/`에서 `TEST_INITIAL_SESSION_ONLY=1 TMPDIR=/tmp npm run test:integration` 통과. 운영/개발 DATABASE_URL은 사용하지 않고 127.0.0.1의 소유한 임시 PostgreSQL/Next 서버만 사용한다. 테스트 종료 시 두 프로세스를 중지하며 임시 검증 파일은 보존한다.

- 빈 목록, 미인증/미등록/비활성 관리자 거부, 외부 Origin 거부, 잘못된 입력 거부.
- WebGL manifest 맵 불일치 거부 및 회차/콘텐츠 0개 유지.
- 콘텐츠 INSERT 중 강제 실패 시 전체 롤백, 같은 요청 키로 정상 재시도.
- 관리자 2명의 최초 요청 + 동일 키 동시 재시도에서 201/200/409, 실제 회차 1개.
- 30상황·91선택지·91지역영향의 원문 전체 값 비교, NPC 경로 일치, 관리자 3개 보존, 생성 시 runtime 행 0개.
- 최초 DRAFT에 기존 이벤트 위치 API로 v002 지점 지정, DRAFT 복사·동일 요청 재시도·위치 복사.
- 명시적 시작/종료, 시작 기준 600초 보존, 종료 후 최초 요청 replay 및 FINALIZED 복사.

기존 전체 회귀 검사 `TMPDIR=/tmp npm run test:integration`도 통과했다. 회차 생성/복사/재시도/종료/복구, 입력 및 권한 검사, 콘텐츠 점수, 참가자/프로필/학과/결과 분리, WebGL 불일치 시작 차단, v002 경로·이벤트와 1000명 스케줄러 검사, PostgreSQL/서버 재시작 복구를 확인했다. 이 기존 모드의 개발 seed와 합성 좌표는 별도 임시 DB에만 사용했다. 브라우저·Unity Play는 해당 환경변수가 설정되지 않아 SKIP이며 시각 검증을 통과했다고 주장하지 않는다.

저장소 루트에서 `node db/generate_exhibition_seed.mjs --check` 통과. `python3 scripts/db/prepare-production.py --output-dir /tmp/simus-initial-session-sql-review`는 SQL만 생성했으며 DB에 적용하지 않았다.

## 맵 확인 범위와 운영 적용 전 남은 사항

`node web/scripts/unity-artifact.mjs verify` 통과: lock `unity-webgl-1ba4e9a12216d3ee`, 로컬 WebGL 파일 20개 해시 확인. 서버 그래프·URL 라우팅 상수·`public/city-rebuild-v002/build.json`·artifact lock의 맵은 `test-only-city-rebuild-v002-webgl-v1`, 경로는 `city-rebuild-v002-walk-v1`로 일치한다. manifest는 `exhibition_ready=false`인 개발 검증용이다.

최초 생성 시 기존 `assertSessionBuild`로 현재 서버가 제공하는 배포 디렉터리의 manifest, 파일 구성, 맵/경로 버전, NPC 지원과 경로 그래프를 검사한다. 관리자 시작 시에도 기존 검사를 반복하여 생성 이후 파일 변경을 검출한다. 파일 누락/불일치는 409를 반환한다.

EC2 실제 호스트/배포 이미지에 대한 HTTP/컨테이너 검증과 브라우저 시각 검증은 이번 작업에서 수행하지 않았다. EC2의 실제 배포 빌드까지 확인됐다고 해석하면 안 된다. 운영 적용 시 관리형 upgrade로 017을 먼저 적용한 뒤 앱을 배포하고 `node web/scripts/unity-artifact.mjs check-http https://<실제호스트>` 및 관리자 최초 생성/시작 흐름을 확인해야 한다. 이번 작업은 해당 운영 작업을 실행하지 않는다. 최종 전시 맵과 30상황 좌표·지역 경계는 별도 확정 대상이다.
