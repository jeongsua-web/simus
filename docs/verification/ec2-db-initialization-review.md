# EC2 신규 운영 DB 초기화 정적 검토

검토일: 2026-10-20. 실행 검증을 보류한 최초 배포 구성 검토다. DB 접속, 초기화, 컨테이너 실행, EC2 배포는 하지 않았다.

## 적용 경로

원본 001~015를 검토했다. 기존 `db/README.md`와 `scripts/db/migrate.py`의 관리형 경로를 유지한다. 단순 번호순 직접 실행이나 `db/*.sql` 전체 실행을 사용하지 않는다.

| 번호 | 역할 | 신규 운영 DB 결정 |
| --- | --- | --- |
| 001 | 회차·참가자·콘텐츠·상태·원장·결과, 불변/DRAFT 보호 | 포함 |
| 002 | 회차 상태 전이와 기록·결과 커밋 보호 | 포함 |
| 003 | 회차 복제 요청 멱등성 | 포함 |
| 004 | NPC ID·경로 스냅샷과 불변 보호 | 포함. 빈 참가자 테이블에만 적용 |
| 005 | 학과 표와 가입 학과 보호 | 포함. 학과/기타 선택지 **45행은 제품 기준 데이터** |
| 006 | 선택지·원장 점수 범위 확장 | 포함 |
| 007 | 읽기 전용 결과 링크 해시 | 포함 |
| 008 | 웹 푸시 구독·작업 | 포함 |
| 009 | 별명·MBTI·프로필 완료 보호 | 포함 |
| 010 | DRAFT 회차 명시 NPC 경로와 가입 시 스냅샷 검사 | 포함. 004의 프로토타입 경로 기본값 제거 |
| 011 | 위치/공통 이벤트·NPC 이벤트 상태·이벤트별 선택 | 포함 |
| 012 | 기존 RUNNING 회차에 공통 상황/선택지 추가 | **제외**. 신규 DB에 필요 없고 기존 결정상 별도 승인 대상 |
| 013 | 시민 캐릭터와 프로필 불변 | 포함. 012에 대한 구조 의존성 없음 |
| 014 | 안경 열과 기존 참가자 전체 backfill | **제외**, 기존 운영 결정대로 016으로 대체 |
| 015 | 그래프 유도 경로와 개발용 NPC 프로필 구분 | 016 뒤 포함. `city-rebuild-v002` 문자열은 제약이며 회차/맵 생성이 아님 |
| 016 | 안전한 안경 열/backfill 및 보호 함수 | 013 뒤 포함 |

확정 순서는 **001~011 → 013 → 016 → 015**다. 이력은 14건이며 012/014를 적용했다고 기록하지 않는다.

014는 참가자 없는 신규 DB만 놓고 보면 전체 UPDATE가 0행이므로 기술적으로 적용 가능하다. 그러나 014와 016 양쪽을 실행할 필요는 없다. 현재 저장소의 운영 계약이 014 직접 실행을 금지하고 016을 대체 경로로 정했으므로 이 경로에서는 **016이 필요**하다. 016까지 생략하면 애플리케이션이 사용하는 `glasses_id`가 없어 불완전하다.

004에 Neighborhood 시제품 좌표 DEFAULT가 남아 있지만 초기화 시 참가자는 0명이며 같은 단일 트랜잭션 안에서 010이 DEFAULT를 제거한다. 중간 스키마가 서비스에 노출되지 않고 새 회차·참가자·좌표 행을 생성하지 않는다. 최종 회차 경로는 NULL이며 확정한 새 맵/경로를 별도로 설정해야 한다.

`seed_demo.sql`, `seed_neighborhood.sql`, `seed_development.sql`, `seed_exhibition.sql`, `verify_schema.sql`은 모두 실행 목록에서 제외한다. 관리자·회차·상황·선택지·지역·참가자·결과는 생성하지 않는다. 따라서 초기화 후 즉시 참가 가능한 회차는 없으며 실제 전시 콘텐츠와 관리자 등록은 별도 승인 범위다.

## 준비 및 초기화 구현

`prepare-production.py`는 기존 runner 모듈의 `sources()`와 `plan()`만 호출한다. runner의 `main()`이나 `psql`, DB 연결, 컨테이너 명령을 호출하지 않는다. 원본 파일명/체크섬과 명시적 순서를 검증하고 `init.sql`, `init.sql.sha256`을 생성하며 기존 산출물 덮어쓰기를 거절한다. 호스트 Python 3 표준 라이브러리만 필요하고 PostgreSQL 컨테이너에 Python을 설치하지 않는다.

생성 SQL은 기존 runner의 advisory transaction lock과 단일 BEGIN/COMMIT, `simus`/관리 이력 부재 검사, 이력/체크섬 기록을 유지한다. SQL 마지막 COMMIT 직전에 `simus_app` 역할 및 권한을 추가하므로 역할 생성 실패도 전체 스키마/이력과 함께 롤백된다. 초기화는 새 DB 전용이며 기존 DB 업그레이드로 재사용하지 않는다.

`postgres`는 초기화 소유자이고 web은 `simus_app`으로만 연결한다. 앱 역할에는 LOGIN과 현 `simus` 스키마 USAGE, 현 테이블 SELECT/INSERT/UPDATE/DELETE, sequence USAGE/SELECT, 함수 EXECUTE만 부여한다. NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLS/NOINHERIT를 명시한다. DB CONNECT를 부여하고 PUBLIC의 DB 권한과 public 스키마 CREATE를 회수한다. 앱은 스키마/테이블/함수/트리거 소유자가 아니며 관리 이력 접근 권한, TRUNCATE, DDL, 새 객체 자동 권한은 없다. 기존 트리거와 SQL 함수의 내부 조회에 필요한 현 함수 실행/테이블 접근은 부여한다. 실제 권한 동작은 미검증이다. 향후 migration은 새 객체 권한을 별도 검토해야 한다.

비밀번호는 생성 SQL에 기록하지 않는다. init 시 psql `\getenv`로 `SIMUS_DB_PASSWORD`를 읽고 `format(... %L ...)`로 비밀값을 SQL 리터럴 처리한다. `SIMUS_DB_PASSWORD`는 URL 인코딩 충돌을 피하는 64자리 16진 문자열을 강제하고 SCRAM 해시로 저장한다. 자격 증명을 브라우저/Unity에 전달하지 않는다.

공식 postgres entrypoint가 신규 PGDATA를 초기화할 때만 `init-production.sh`를 호출한다. 읽기 전용 `/schema-init` 안의 체크섬을 대조한 뒤 Unix socket의 로컬 임시 서버에 `psql -X --no-password --set ON_ERROR_STOP=1`로 적용한다. 생성 SQL이 트랜잭션을 소유하므로 psql `-1`을 중첩하지 않는다. 전부 커밋된 뒤에만 `$PGDATA/.simus-init-complete`를 만든다. Compose는 marker와 TCP 준비를 함께 확인해 초기 임시 socket-only 서버나 실패 후 재시작한 미완성 DB를 ready로 판정하지 않는다.

첫 초기화가 실패하면 PGDATA는 이미 생성되어 재시작 시 entrypoint가 SQL을 자동 재실행하지 않을 수 있다. marker가 없으므로 web 시작을 막되, 볼륨 삭제/자동 재시도/원본 SQL 재실행으로 복구하지 않는다. COMMIT 직후 연결/marker 쓰기 실패도 가능하므로 승인된 관리 연결로 이력·권한·커밋 결과를 확인한 다음 복구 절차를 정해야 한다. artifact 체크섬은 변조 방지를 위한 서명이나 외부 신뢰 증명이 아니므로 SQL과 checksum을 함께 검토·보존한다.

## 승인 후 사용할 명령

EC2 배포 디렉터리에서 아래 오프라인 준비 명령을 실행한다. 실제 초기화/컨테이너 시작 명령과 환경변수는 `docs/operations/ec2-postgres-first-deploy.md`의 승인 절차를 따른다.

```sh
python3 scripts/db/prepare-production.py --output-dir .prod-db
```

`.prod-db` 전체를 `/schema-init:ro`에, shell을 `/docker-entrypoint-initdb.d/010-init-production.sh:ro`에 마운트한다. 원본 db 디렉터리를 initdb.d에 마운트하면 012/014/seed가 잘못 실행될 수 있으므로 그렇게 구성하지 않는다.

## 수행한 검증과 한계

- 원본 SQL과 관리 runner를 읽고 의존성·데이터 변경·trigger·권한을 정적으로 검토했다. 기존 001~015 파일 diff는 비어 있다.
- `/tmp/simus-ec2-init-review-20261020`에 SQL/해시만 오프라인 생성했고 생성 SQL의 트랜잭션·14개 이력 순서·012/014/seed 제외를 확인했다.
- `bash -n scripts/db/init-production.sh`로 shell 구문만 확인했다.
- DB/SQL 실행, DB 접속, `verify_schema.sql`, 격리 마이그레이션 테스트, 컨테이너 실행은 하지 않았다. 실제 PostgreSQL 구문·권한·trigger·초기화 성공을 입증한 결과가 아니다.

이 검토에 자산 변경은 없다.
