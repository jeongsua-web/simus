# Phase 2-A DB 마이그레이션 독립 정적 검토

검토일: 2026-10-20. 구현 담당: database 에이전트. 독립 검토 담당: qa 에이전트.

판정: **정적 검토 통과 — 런타임 검증 미실시**. 검토한 최종 코드에서 기존 데이터 삭제·초기화, 기존 안경 값 덮어쓰기, 실행 묶음과 이력을 분리 커밋하는 경로는 발견하지 않았다. 이 판정은 DB 접속·테스트·운영 적용·배포 승인이 아니다.

## 범위와 확인 방법

루트 `AGENTS.md`, `web/AGENTS.md`, 원본 `db/001~015`, `compose.yaml`, 기존 실행 안내와 관련 NPC·프로필·회차 계약을 읽었다. 저장소에서 별도 Phase 2-A DB 분석 보고서를 찾지 못했으므로 사용자 요구사항과 실제 SQL을 기준으로 검토했다.

검토 대상은 `scripts/db/migrate.py`, `db/016_safe_participant_glasses.sql`, `db/migration-checksums.json`, `README.md`, `db/README.md`, `docs/operations/db-migrations.md`, `docs/operations/demo-deployment.md`, `docs/operations/stage4-8-integration.md`다. 이 보고서 외 구현 파일은 QA가 수정하지 않았고 발견 사항은 database 담당자에게 전달한 후 수정본을 다시 읽었다.

파일 읽기·검색, `git status`/`git diff`, 읽기 전용 `shasum -a 256 db/0*.sql`만 사용했다. 001~015와 Compose의 Git diff는 비어 있다. 001~016의 파일 해시를 manifest 값과 대조해 모두 일치함을 확인했다. 016의 검토 해시는 `6a39edba20e3c3b547c0ef6771cbe884837f4d6ee9fa1278eb67a9c7f47d6522`다. Python/SQL/runner/구문 검사/테스트 실행, DB 접속, 컨테이너 생성, commit/push 및 배포는 하지 않았다.

## 요구사항별 판정

| 요구사항 | 정적 판정과 근거 |
| --- | --- |
| 기존 001~015 불변 | 통과. 원본 diff 없음. 별도 SHA-256 manifest를 추가했고 runner가 연결 전에 파일 바이트와 목록을 대조한다. |
| 신규 초기화와 기존 업그레이드 분리 | 통과. `init`은 `simus` 및 관리 이력이 없는 DB에서만 진행한다. 기존 DB는 명시적 `baseline` 후 `upgrade`, 이미 관리된 DB는 `upgrade`를 사용한다. |
| 014 미적용 기존 DB의 안전 대체 | 통과. 원본 014는 실행 목록에 없다. 016은 013 이후·015 이전에 실행한다. 기존 015가 있고 014가 없는 경우도 baseline으로 표현할 수 있다. |
| 이미 적용된 안경 값 보존 | 통과. glasses 열 존재 분기에는 UPDATE/default 변경이 없고 타입·NOT NULL·허용값 검사 및 제약 추가만 있다. 기존 사용자 선택을 머리 기본값으로 재계산하지 않는다. |
| 012 별도 명시 승인 | 통과. 일반 init/upgrade에서 제외되며 `approve-running-content`와 비어 있지 않은 승인 기록이 필요하다. 실제 승인 여부는 사전 사용자 승인 절차가 담당한다. |
| 적용 이력·체크섬 | 통과. 실행/과거 증빙 채택을 구분하고 파일명·해시·증빙·시각·실행자를 저장한다. 기록과 소스가 다르면 중단하며 이력 수정/삭제/TRUNCATE를 거절한다. |
| 동시 실행·원자성 | 통과. 하나의 psql 연결에서 외부 BEGIN/COMMIT, ON_ERROR_STOP, transaction advisory lock을 사용한다. SQL 변경과 이력 INSERT는 같은 트랜잭션에 있다. |
| 회차·참가자·NPC·결과 보존 | 통과. 삭제·TRUNCATE·reset·seed 실행 경로가 없다. 016의 유일한 기존 행 UPDATE는 새 안경 열이 없었던 경우 npc_01/04의 새 열 backfill이다. 나머지 기존 열과 NPC 경로는 SET 대상이 아니다. |
| 기존 개발 Compose 보존 | 통과. diff 없음. 기존 001~010 초기화 동작 및 볼륨을 유지한다. |
| 실행 문서 | 통과. 초기화/증빙 baseline/업그레이드/012 승인 명령, 제약·실패 처리·미실시 테스트 계획이 문서화되어 있다. |

## 보존 및 트랜잭션 검토

원본 014의 전체 participant_sessions UPDATE는 CLOSING/FINALIZED에서 기존 `lifecycle_write`에 거부될 수 있다. 016은 부모 `simulation_sessions` → `participant_sessions` 순서로 ACCESS EXCLUSIVE 잠금을 얻고 lifecycle/profile/NPC/학과/신규 경로 트리거의 활성 상태와 연결 함수를 확인한다. 새 안경 열이 없을 때만 `lifecycle_write`를 잠시 해제하고 backfill 후 복구한다. 프로필·NPC 불변 트리거는 유지된다. 이후 안경까지 포함하는 프로필 보호 함수를 설치한다.

runner는 원본의 단독 외부 BEGIN/COMMIT 한 쌍만 메모리에서 제거한다. 현재 원본 함수의 `BEGIN`은 제거 대상인 `BEGIN;`과 다르다. 실행 SQL의 psql 메타 명령 및 별도 트랜잭션 제어를 거절하며 검토된 파일 해시도 고정한다. PostgreSQL 오류가 COMMIT 전에 발생하면 스키마·backfill·트리거 상태·이력이 모두 같은 트랜잭션에서 롤백되는 구조다. 016은 runner 전용이며 단독 psql 파일 실행을 지원하지 않는다.

012도 별도 명령에서 부모→콘텐츠 테이블 잠금과 기존 보호 트리거 검사를 거친다. 원본의 한시적 콘텐츠 트리거 해제 및 이력 기록은 외부 트랜잭션 안에 유지된다. 012 미실행을 실행 완료로 기록하지 않으며 나중에 승인된 명령으로 적용할 수 있다.

baseline은 기존 업무 데이터를 변경하지 않고 이력만 기록한다. 최소 010까지의 연속된 스키마 적용 증빙, 각 SHA, 핵심 테이블·열·제약·활성 트리거, NPC 기본 경로 제거 및 후속 버전 표식을 대조한다. 010 이전 DB는 거절하므로 기존 참가자에게 원본 004의 Neighborhood 좌표를 자동 backfill하지 않는다.

## 검토 중 수정된 사항

- 016 양쪽 분기에서 핵심 보호 트리거의 활성 상태와 연결 함수 확인을 추가했다.
- 현재 소스와 이력만 비교하던 구조에 검토된 원본을 고정하는 checksum manifest를 추가했다.
- wrapper와 실행 SQL의 별도 transaction control 검사를 강화했다.
- baseline 최소 버전·필수 이력·주요 구조 표식 검증을 보강했다.
- 모든 실패를 롤백 확정으로 표현하던 문구를 고쳐 COMMIT 응답 소실 시 결과가 불명일 수 있음을 명시했다.
- 문서의 존재하지 않는 ENDING 상태를 제거하고 RUNNING/CLOSING fixture는 별도 DB에 분리하도록 정정했다.
- 루트 README의 종전 SQL 번호순 직접 적용 안내를 관리형 경로로 교체하고 제거된 DB 문서 anchor를 실제 NPC 계약 링크로 바꿨다.

## 잔여 위험과 미실시 검증

정적 검토는 Python/SQL 구문 실행, 실제 PostgreSQL 권한·잠금 대기·트리거 동작·롤백 결과를 입증하지 않는다. 보존과 원자성에 관한 실행 판정은 별도 승인 후 격리 DB에서 해야 한다.

baseline의 구조 표식은 전체 스키마 동등성 증명이 아니다. 실제 과거 적용 여부와 원본 해시는 독립 배포 기록/백업 및 검토자 진술에 의존한다. 증빙이나 알려진 구조가 일치하지 않는 DB는 별도 검토가 필요하다. 승인 reference도 승인 시스템 자체가 아니다.

advisory lock은 이 runner끼리의 동시 실행을 방지한다. 직접 psql이나 기존 Compose 초기화는 같은 잠금을 사용하지 않으므로 함께 실행하면 안 된다. ACCESS EXCLUSIVE 잠금은 서비스 요청을 지연시킬 수 있고 실제 데이터 규모에서 제한 시간 내 완료하는지는 미검증이다. COMMIT 직후 연결이 끊기면 성공 여부 확인이 필요하며 오류만으로 롤백을 단정할 수 없다.

기존 `web/tests/isolated-runner.mjs`는 원본 014 경로를 사용하므로 이 구현을 검증하지 않는다. 신규 runner 테스트 fixture 및 오류 주입 코드는 아직 작성·실행되지 않았다. 운영 안내의 테스트 계획은 실행 승인 요청을 완성하기 위한 초안이며, 다음 단계에서 DB와 격리 방식·전체 명령·생성 데이터·보존 비교·성공/실패 기준을 최종 보고하고 사용자 승인을 기다려야 한다. 자산 변경이 없어 asset catalog 실행 대상도 없다.

실행 검증에서는 최소한 014 미적용 종료 회차, 기존 014 사용자 선택 안경, init/upgrade 재실행, 012 기본 제외 및 별도 승인, 소스/이력 checksum 불일치, 동시 실행 거부, 중간 실패 시 DDL·이력·행·트리거 원복을 확인해야 한다. 기존 데이터 변동이나 비원자적 결과가 나오면 통과시키지 않는다.
