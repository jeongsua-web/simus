# SIM:US

Next.js 참여·관리자 화면, PostgreSQL 회차/선택/결과 저장, Unity 도시 시각화 클라이언트로 구성됩니다.
Unity는 공개 `GET /api/city-state`만 읽으며 DB 접속 정보나 관리자 토큰을 사용하지 않습니다.

**시연 시작:** [시연·배포 준비 가이드](docs/demo-deployment.md). DB 생성 → 마이그레이션 → 시연 DRAFT/관리자 설정 → 서버 실행 → Unity 준비 → 시연 체크리스트 순서입니다.

## 현재 가능한 기능

- 익명 참여, 상황 선택, 중복 제출 방지, 새로고침 후 응답 복원.
- JWT와 활성 관리자 검증, 회차 준비 상태 조회, 시작·수동 종료.
- 도시·지역 상태의 트랜잭션 갱신, 종료 후 본인 결과 조회, 결과 중복 확정 방지.
- 인증된 reconcile API를 통한 자동 종료·중단된 종료 복구.
- Unity 소스: 도시/지역 표현, 상태 HUD, API 폴링·재연결·마지막 정상 상태 유지, 미리보기.

## 실행 대상과 주소

| 구분 | 현재 상태 / 주소 |
| --- | --- |
| 로컬 Next.js | `http://localhost:3000` |
| 참여 / 관리자 | `/participate` / `/admin` |
| 본인 결과 | `/result/{session_id}` (참여했던 브라우저 사용) |
| 상태 / Unity API | `/api/health` / `/api/city-state` |
| Unity 실제 빌드 대상 | **미확정**. Editor 버전·ProjectSettings·저장된 장면·빌드 산출물 없음 |
| 시연 준비 기준 | Windows 데스크톱. Editor 설치 후 버전·장면·Windows 빌드 대상을 확정해야 함 |
| 배포 서버 | **미설정·미배포**. 가이드의 `https://simus.example.com`은 설명용 예시 |

기존 `compose.yaml`은 Node 24 / PostgreSQL 16의 **개발용** 구성입니다. `npm ci` 후 `next dev`를 실행하며,
초기 DB에 001만 적용합니다. 002 마이그레이션과 관리자 설정은 별도입니다. 운영 배포 설정이나 공개 서버 주소는 없습니다.

## 검증과 제한

2026-09-18 검증 결과는 [시연 준비 검증 기록](docs/demo-validation.md), 이전 상세 검증은
[통합 검증 보고서](docs/integration-report.md)에 있습니다.

- 관리자 화면은 콘텐츠 생성·수정을 지원하지 않습니다. 시연에는 `db/seed_demo.sql`을 사용합니다.
- 기존 `db/seed_development.sql`은 회차를 즉시 RUNNING으로 만드는 개발용입니다. 시연 DRAFT와 혼용하지 않습니다.
- 자동 종료 스케줄러는 설치돼 있지 않습니다. API 호출 작업을 별도로 구성해야 합니다.
- Unity C# 컴파일·EditMode·실제 도시 화면·데스크톱/WebGL 빌드는 Editor 부재로 미검증입니다.
- WebGL은 선택 가능한 후속 대상입니다. 현재 CORS 허용 설정은 없으므로 동일 출처 구성이 필요합니다.
- 실제 HTTPS 프록시, LAN/모바일 실기기, 운영 부하·백업 복구·권한 분리는 아직 검증하지 않았습니다.
- DB의 종료 정책은 DRAIN입니다. 모든 부하에서 마감 이후 커밋이 절대 없다는 보장을 의미하지 않습니다.

운영 DB에는 seed와 테스트를 실행하지 않습니다. 비밀값은 서버 환경/비밀 저장소로 주입하고 Git,
`NEXT_PUBLIC_*`, Unity Assets/Resources/StreamingAssets 및 빌드에 넣지 않습니다.

추가 문서: [API](web/API.md) · [운영 화면](web/OPERATIONS.md) · [DB](db/README.md) ·
[Unity 준비](unity/README.md) · [도시 표현](unity/VISUALIZATION.md) · [연동 계약](docs/unity-integration.md)
