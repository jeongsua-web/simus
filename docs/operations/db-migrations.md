# DB 초기화와 기존 DB 업그레이드

이번 변경은 구현 및 정적 검토 단계다. DB 접속, 테스트, seed 적용, 배포는 실행하지 않았다. 아래 명령은 실행 허가가 아니다. 테스트와 운영 실행은 각각 별도 승인을 받아야 한다. Phase 2-A 분석 보고서는 저장소에서 찾지 못해 사용자 요구와 SQL 원본을 근거로 구현했다.

## 경로와 실행 순서

| 대상 | 명령 | 동작 |
| --- | --- | --- |
| `simus` 및 관리 이력이 없는 신규 DB | `init` | 001~011 → 013 → **016** → 015, seed 없음 |
| 이력이 없는 기존 DB(최소 010 적용) | `baseline` | 적용 증빙과 구조 표식을 대조해 **이력만** 채택 |
| 관리 이력이 있는 기존 DB | `upgrade` | 위 순서에서 미적용 SQL만 실행 |
| RUNNING 회차 공통 콘텐츠 추가 | `approve-running-content` | 별도 승인 기록을 받아 **012만** 실행 |

`init`은 DB 자체를 생성하지 않는다. 대상 DB에 다른 앱 스키마가 존재할 수 있지만 `simus` 또는 관리 이력이 있으면 거절한다. 실무에서는 전용 신규 DB를 별도로 준비한다. 개발용 `compose.yaml`은 변경하지 않았고 새 볼륨에 기존 001~010만 자동 적용한다. 기존 볼륨은 유지하며 baseline 후 upgrade를 사용한다. 볼륨 삭제로 업그레이드하지 않는다.

원본 001~015는 수정하지 않는다. **014는 어떤 신규 실행 경로에서도 실행하지 않는다.** 016은 014를 대체하고 015보다 먼저 실행한다. 번호는 파일의 불변 식별자이며 이 실행 순서는 명시적이다. 015가 이미 적용되고 014는 실패한 기존 DB도 baseline에서 014를 제외하고 015를 기록한 뒤 016으로 보완할 수 있다. 대체한 014를 실행 완료로 허위 기록하지 않고 016만 기록한다. 기존에 실제 적용한 014는 baseline으로 별도 보존한다.

016은 runner가 제공하는 트랜잭션 안에서만 실행한다. `psql -f db/016_safe_participant_glasses.sql`처럼 단독 실행하지 않는다. 독립 트랜잭션 wrapper가 없으므로 직접 실행은 지원하지 않는다.

012는 스키마 필수 조건이 아닌 RUNNING 콘텐츠 변경이다. init/upgrade에서 누락 상태 그대로 두며 013을 적용할 수 있다. 기존에 012를 적용했다면 그 사실을 baseline에 기록하고 다시 실행하지 않는다. 012를 제외하면 기존 RUNNING 회차에 공통 이벤트가 자동 추가되지 않는다. 콘텐츠 보완이 필요하면 승인 절차를 별도로 진행한다.

최소 010 이전 기존 DB는 자동 업그레이드하지 않는다. 특히 004의 과거 Neighborhood 경로를 기존 참가자에게 채우는 동작은 새 맵 결정과 충돌하므로 별도 보존형 계획이 필요하다. 신규 init의 004 시점에는 참가자가 없고 010이 해당 default를 제거한다. 어떤 seed나 새 맵 좌표도 runner에 포함하지 않는다.

## 실행 방법 (별도 승인 후)

Python 3 표준 라이브러리와 PostgreSQL 14+ `psql`이 필요하다. DB 생성과 접속 역할 준비는 별도 작업이다. 스키마 소유자로 DDL 가능한 역할을 사용한다. URL 및 `.env`를 읽지 않으며 host/port/database/user를 모두 명시해야 한다. 비밀번호는 권한 제한된 `PGPASSFILE`을 권장한다. `PGPASSWORD`도 전달할 수 있으나 명령행이나 로그에 비밀번호를 쓰지 않는다. TLS 설정 `PGSSLMODE`, `PGSSLROOTCERT`, `PGSSLCERT`, `PGSSLKEY`는 전달한다. 나머지 `PG*` 환경변수와 psql 사용자 초기화 파일은 사용하지 않는다.

예시는 **승인된 격리 로컬 DB** 이름이다. 운영 접속 예시가 아니다.

```sh
python3 scripts/db/migrate.py init --host 127.0.0.1 --port 55432 --database simus_migration_qa --user simus_qa
python3 scripts/db/migrate.py baseline --host 127.0.0.1 --port 55432 --database simus_migration_qa --user simus_qa --baseline-file /tmp/simus-baseline-reviewed.json --attest-baseline
python3 scripts/db/migrate.py upgrade --host 127.0.0.1 --port 55432 --database simus_migration_qa --user simus_qa
```

init과 baseline은 같은 DB에 순서대로 실행하는 명령이 아니다. 신규 DB는 init, 기존 DB는 baseline 다음 upgrade를 선택한다. 이미 관리 이력이 있으면 baseline을 다시 하지 않는다.

baseline 파일은 사람이 독립 배포 기록과 백업의 스키마를 검토한 후 작성한다. `applied`는 실제 적용된 버전과 원본 바이트의 SHA-256을 담는 객체다. 예시의 생략 표시는 JSON에 넣지 않으며 실제 파일에 001~010을 빠짐없이 기재한다. 011/013/015는 적용했다면 연속된 스키마 순서로 추가하고 012/014는 실제 적용 증빙이 있을 때만 추가한다. 016은 baseline할 수 없다.

```json
{
  "database": "simus_migration_qa",
  "evidence": "독립 배포 기록/백업 검토 문서 식별자",
  "applied": {
    "001": "d226995cd801d37973ebd49d1cf41b3b47c92e59ec426bff180558199a61b38a"
  }
}
```

위 축약 예시는 010까지 없으므로 실행 시 거절된다. 검토한 각 버전의 값을 `db/migration-checksums.json`과 대조한다. **현재 파일의 checksum을 복사하는 것만으로 과거에 해당 SQL을 실행했다는 증명이 되지 않는다.** baseline은 증빙 검토자의 명시적 진술이며 `origin=baseline`으로 구분한다. 테이블/열/핵심 제약/활성 트리거/010 default 제거 및 011/013/014/015 적용·미적용 표식을 검사하지만 전체 스키마 동등성 검사는 아니다. 알 수 없는 변경/부분 실패/증빙 부재는 자동 추정하지 말고 중단하여 별도 검토한다. 012의 콘텐츠 유무로 과거 실행 여부를 추정하지 않는다.

012 승인 시에는 별도 승인 문서 식별자를 인자로 남긴다. 인자 값 자체는 승인 시스템이 아니며 사용자의 사전 승인을 대신하지 않는다.

```sh
python3 scripts/db/migrate.py approve-running-content --host 127.0.0.1 --port 55432 --database simus_migration_qa --user simus_qa --approval-reference APPROVED-012-CHANGE-ID
```

## 데이터 보존과 실패 처리

runner는 소스 바이트를 고정 manifest SHA-256과 대조하고 이미 기록한 파일명·checksum도 대조한다. 알 수 없는 버전이나 불일치는 중단한다. SQL wrapper는 메모리에서만 엄격히 제거하고 `psql -X`, `ON_ERROR_STOP`, 단일 연결·단일 트랜잭션으로 전체 미적용 묶음과 이력을 함께 커밋한다. 016에는 독립 BEGIN/COMMIT이 없다. 실패한 묶음은 스키마/데이터/이력이 함께 롤백된다. 이미 과거에 성공한 migration은 유지한다. 완료 이력은 `simus_migrations.history`에서 version, filename, sha256, origin, evidence, applied_at, applied_by로 확인한다. 이력 UPDATE/DELETE/TRUNCATE는 거절한다. 원본이나 manifest를 수정해서 검증을 우회하지 않는다.

트랜잭션 advisory lock으로 **이 runner끼리의** 동시 실행을 즉시 거절한다. 수동 psql/기존 Compose init은 같은 advisory lock을 사용하지 않으므로 동시에 실행하지 않는다. 5초 lock_timeout/120초 statement_timeout이 기본이며 원본 012 내부의 10초 제한은 그대로 유지된다. 운영 일정과 테이블 규모를 검토한 유지보수 구간에서 실행한다. 자동 재시도하지 않는다.

016은 회차 → 가입 순서로 ACCESS EXCLUSIVE 잠금을 잡는다. profile/NPC/학과/신규 경로/lifecycle 트리거의 활성 상태와 연결 함수를 확인한다. glasses 열이 없을 때만 열을 추가하고, 종료 회차도 안전하게 backfill하기 위해 lifecycle_write만 잠금 안에서 일시 해제한다. npc_01은 square, npc_04는 round, 나머지는 none으로 채우고 즉시 복원한다. 기존 프로필/NPC 불변 트리거는 계속 작동한다. 기존 안경 열이 있으면 어떤 값도 UPDATE하지 않고 타입/NOT NULL/값의 허용 범위를 검사한다. 이후 양쪽 경로에 프로필 안경 고정 guard를 설치한다. 회차·참가자·NPC·결과 삭제/초기화와 기존 경로 변경은 없다. 예외나 연결 종료가 COMMIT 전에 발생하면 guard 복원까지 롤백된다.

COMMIT 전달 직후 연결이 끊기면 서버가 커밋했는지 클라이언트는 모를 수 있다. 오류 문구를 롤백 확정으로 해석하지 않는다. 승인된 접속으로 이력을 확인하고 재시도 여부를 결정한다. 이력과 트랜잭션은 같은 커밋이므로 성공 이력이 있으면 재실행 시 건너뛴다. DB 백업·복원 검증과 실행 권한 관리는 별도 운영 절차다.

## 아직 실행하지 않은 테스트 계획

아래 내용은 실행 전 보고·승인을 위한 계획이다. 이번 작업에서는 컨테이너 생성, psql 접속, runner/검증 스크립트/구문 검사 실행을 모두 하지 않는다.

- DB/격리: 승인 후 `postgres:16` 전용 컨테이너 `simus-migration-qa`, host 127.0.0.1:55432, 독립 Docker named volume `simus_migration_qa_data`, DB `simus_migration_qa`, 역할 `simus_qa`. 기존 Compose/공유 개발/운영 DB·볼륨·네트워크·자격증명은 사용하지 않는다. Docker 실행 및 이미지 확보도 승인 대상이다.
- 실행 명령: 승인 후 아래 컨테이너 생성, 위 init/baseline/upgrade/012 명령을 시나리오별 독립 DB에 실행한다. 초기화 재실행/upgrade 재실행, manifest 및 기록 checksum 불일치, 이력 없는 upgrade, 두 동시 upgrade, lock timeout, COMMIT 전 강제 오류도 실행한다. 구체적인 fixture SQL과 오류 주입 파일은 다음 승인 요청 전에 작성하여 보고한다. 현재는 fixture 실행 코드나 컨테이너를 만들지 않았다.
- 데이터 범위: seed 대신 전용 합성 fixture로 DRAFT/RUNNING/CLOSING/FINALIZED 회차 각 1개를 만든다. RUNNING/CLOSING은 전체 최대 1개이므로 별도 fixture DB에 분리한다. npc_01/04/기타 머리 및 안경 조합, 완료/미완료 프로필, 선택 원장·결과·NPC 스냅샷·이벤트 행의 최소 유효 조합을 만든다. 010/011/013/014/015 기존 DB 변형을 별도 DB로 구성하며 014 적용 fixture는 가능한 DRAFT/RUNNING에서 적용 후 lifecycle을 종료 상태까지 진행한다. 014 미적용 FINALIZED DB도 포함한다. 실제 개인정보/좌표/운영 백업은 사용하지 않는다.
- 데이터 보호: 전후 기존 열과 전체 보존 대상 행의 정렬된 덤프를 비교한다. 안경 신규 열의 승인된 backfill/신규 이력 외 변경은 실패다. 이미 014가 있으면 안경까지 byte-equivalent 비교한다. legacy snapshot은 합성 버전을 사용하며 과거 Neighborhood 자산을 새 전시 자료로 채택하지 않는다. 원본 004가 추가하는 기본값은 fixture 생성 시 빈 테이블에만 생긴다.
- 성공: 신규 init 전체 성공, 012 자동 제외, 원본 014 이력 허위 기록 없음, 016의 안경 보존/backfill, 정상 재실행 무변경, checksum/동시 실행 거부, 실패 시 이력·DDL·데이터·트리거 전부 원상 복구, 012 승인 시에만 중립 콘텐츠 추가, `verify_schema.sql` 성공.
- 실패: 보존 대상 변동, 잠금 없는 guard 해제, 비원자적 변경/부분 이력, 예상하지 않은 seed/012 실행, checksum 불일치 수용, 동시 적용 성공, 기존 안경 변경 또는 기본값 재설정, 프로필·NPC 불변성 우회, 테스트의 공유/운영 대상 접속 중 하나라도 관찰되면 통과하지 않는다.

```sh
docker run --name simus-migration-qa --publish 127.0.0.1:55432:5432 --mount type=volume,source=simus_migration_qa_data,target=/var/lib/postgresql/data --env POSTGRES_DB=simus_migration_qa --env POSTGRES_USER=simus_qa --env-file /tmp/simus-migration-qa-container.env --detach postgres:16
psql -X --host 127.0.0.1 --port 55432 --dbname simus_migration_qa --username simus_qa --set ON_ERROR_STOP=1 --file db/verify_schema.sql
```

컨테이너 전용 env 파일은 승인 후 합성 비밀번호만 담아 별도로 생성한다. 기존 web/tests/isolated-runner.mjs는 여전히 원본 SQL 기반이며 이번 검증을 대신하지 않는다. 이 테스트 경로 변경과 fixture 상세·실행은 후속 승인 범위다. 실행 전에 최종 명령/fixture 범위/격리/판정 기준을 다시 제시하고 승인을 기다린다.
