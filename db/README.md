# SIM:US PostgreSQL 스키마

DB 초기화와 기존 DB 업그레이드는 [관리형 마이그레이션 운영 안내](../docs/operations/db-migrations.md)를 따른다. 이번 변경은 **구현 및 정적 검토만** 수행하며 DB 접속·테스트·배포는 별도 승인 대상이다.

- 신규 전용 DB: `scripts/db/migrate.py init`으로 001~011 → 013 → **016** → 015를 적용한다. DB 자체의 생성은 별도다.
- 기존 DB: 최소 010 적용 증빙과 구조 검토 후 `baseline`으로 이력만 채택하고 `upgrade`한다. 이미 관리 이력이 있다면 `upgrade`만 사용한다. 기존 볼륨을 지우지 않는다.
- 원본 001~015는 불변이다. **014는 직접 실행하지 않고 016으로 대체**한다. 014가 이미 적용된 DB의 안경 값은 UPDATE하지 않는다. 기존 015가 있고 014가 없는 DB도 지원한다.
- **012의 RUNNING 콘텐츠 변경은 기본 제외**한다. 별도 승인 후 `approve-running-content --approval-reference ...`로만 실행한다.
- `simus_migrations.history`에 실행/증빙 baseline을 구분하고 파일명·SHA-256·실행자·시각·증빙을 기록한다. `migration-checksums.json`은 검토한 원본 바이트를 고정한다.
- 단일 트랜잭션·advisory lock으로 적용 묶음과 이력을 함께 처리한다. 016 backfill은 부모→가입 배타 잠금 안에서 lifecycle_write만 일시 해제하며 나머지 프로필/NPC 보호를 유지한다.
- 회차·참가자·NPC·결과의 삭제/초기화, seed 자동 실행, 기존 개발 Compose 변경은 없다.

정확한 명령, baseline JSON 형식과 증빙 한계, 실패·커밋 결과 불명 처리, 별도 승인할 격리 테스트 계획은 운영 안내에 있다. SQL 파일을 번호순으로 직접 실행하거나 `db/*.sql` glob으로 적용하지 않는다. 과거 문서의 직접 적용 예시는 현재 관리형 경로로 대체한다. 기존 `web/tests/isolated-runner.mjs`는 원본 014 경로를 사용하므로 이번 runner 검증을 대신하지 않는다.

## 스키마 계약

PostgreSQL 14 이상을 대상으로 한다(개발 Compose는 16). 모든 서버 쿼리는 `simus.city_states`처럼 스키마를 명시하며 Unity/브라우저에 DB 접속 정보를 제공하지 않는다.

- UUID, 회차를 포함한 복합 FK, 동일 상황 및 요청 키 중복 방지.
- RUNNING/CLOSING 회차는 전체에서 최대 하나. 시작 이후 설정 고정 및 허용된 상태 전이를 강제한다.
- 선택 원장과 최종 결과의 UPDATE/DELETE/TRUNCATE 거부. 결과 전체와 FINALIZED를 같은 커밋에 저장한다.
- 상황·선택지·지역·기본 영향은 DRAFT에서만 편집한다. 012는 이에 대한 별도 승인 예외다.
- 과거 회차 보존을 위한 FK 삭제 제한, 최종 결과 보존 및 프로필 발급 후 머리·안경 불변.
- 010 이후 신규 NPC 경로는 승인된 DRAFT의 `npc_motion`을 명시적으로 복사한다. 미설정 경로는 가입을 거절한다. 과거 스냅샷은 변경하지 않는다.
- 011 위치 이벤트와 공통 상황, 013 시민 머리, 016 독립 안경, 015 그래프 유도 열을 제공한다. 015의 `city-rebuild-v002`는 개발용 프로필이며 새 전시 맵 승인이 아니다.

새 전시 맵의 좌표/경로/지역은 미확정이다. 과거 Neighborhood 좌표를 새 회차의 근거로 사용하지 않는다. seed_demo/seed_development를 혼용하지 않으며 운영 DB에는 어떤 seed도 적용하지 않는다.

## 검증과 관련 문서

`db/verify_schema.sql`은 DB에 접속하여 합성 데이터를 생성하고 롤백하는 **실행 테스트**다. 이번에는 실행하지 않았다. 격리 DB와 fixture·명령·보존·판정 기준을 보고한 뒤 별도 승인을 받아 실행한다. 미승인 상태에서 구문 검사나 runner 실행도 하지 않는다.

- [회차 lifecycle](../docs/contracts/session-lifecycle.md)
- [프로필](../docs/contracts/participant-profiles.md), [학과](../docs/contracts/participant-departments.md)
- [NPC API](../docs/contracts/participant-npc-api.md), [Unity 연동](../docs/contracts/unity-integration.md)
- [새 전시 맵 인계](../docs/content/new-map-handoff-5a.md), [전시 콘텐츠](../docs/content/exhibition-data.md)
