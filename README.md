# SIM:US

Next.js 참여·관리자 화면, PostgreSQL 회차·선택·결과 저장, Unity 동네 시각화로 구성됩니다.
**2026-09-29: 4~8단계 개발 사본 기능을 본 저장소에 통합했습니다.**

실행 기준은 `web/` + `db/` + `unity/`입니다. `simus-stage4-8/`는 원본 보관용이며 Python 서버·프록시를 함께 실행하지 않습니다.

## 시작하기

1. 새 DB에 `db/001_initial_schema.sql` → `002_session_lifecycle.sql` → `003_session_creation.sql`을 적용합니다. 기존 001/002 DB에는 003만 추가합니다.
2. 새 개발·시연 DB에 `db/seed_demo.sql` 또는 `db/seed_neighborhood.sql`로 최초 콘텐츠를 준비합니다. 운영 DB에는 seed를 실행하지 않습니다.
3. `web/`에서 환경 설정 후 `npm ci`, `npm run build`, `npm start`를 실행합니다.
4. `/admin`에서 관리자 JWT로 접속해 회차를 준비·시작하고 `/participate`에서 참여합니다.
5. Unity 6000.3.24f1로 `unity/`를 열고 `Assets/Scenes/NeighborhoodLive.unity`를 실행합니다. 폴러 주소는 기본 `http://localhost:3000`입니다.

상세: [통합 실행 안내](docs/stage4-8-integration.md) · [인증·배포 안내](docs/demo-deployment.md)

## 구현 상태

- 익명 참여, 선택 저장·중복 제출 방지, 새로고침 후 응답·미확인 제출 복원.
- 현재 도시 수치, 본인 과거 회차 결과와 확정된 최종 도시 수치 조회.
- JWT 관리자 인증, 콘텐츠를 복사한 다음 회차 준비, 진행 시간·배율 지정, 시작·수동 종료.
- 트랜잭션으로 도시·지역 갱신, 종료 결과 단일 확정, 다음 회차 격리.
- 인증된 reconcile API를 통한 자동 종료 및 중단된 종료 복구.
- Unity 실제 동네 맵, 공개 API 폴링·HUD, NPC 미리보기 이동·종료 정지, 임시 도시 연출.

## 검증 및 남은 범위

[9/29 통합 검증](docs/stage4-8-validation.md) · [10/20 완료 일정](docs/project-schedule-2026-10-20.md)

실제 참여자 NPC·모바일 추적, 학과 통계, 외부 알림, 최종 캐릭터/도시 이미지, 오염 확산은 후속 구현입니다.
NPC 캡슐은 미리보기이며 실제 참여자가 아닙니다. 도시 연출 임계값도 임시값입니다.

공개 배포와 운영 스케줄러 설치, 실기기·전시 LAN, Windows/WebGL 빌드 검증은 별도입니다.
Compose는 개발용이고 새 볼륨에 001~003을 초기화합니다. 기존 볼륨에는 003을 별도 적용해야 합니다.
관리자 화면은 기존 콘텐츠 복사를 지원하며 개별 상황·선택지 편집은 지원하지 않습니다.

운영 DB에는 테스트를 실행하지 않습니다. 비밀값은 서버 설정으로 주입하고 Git·브라우저 번들·Unity 자산에 넣지 않습니다.
Unity는 공개 `GET /api/city-state`만 읽습니다. 종료 정책은 기존 DRAIN을 유지합니다.

추가 문서: [API](web/API.md) · [운영 화면](web/OPERATIONS.md) · [DB](db/README.md) · [Unity](unity/README.md)
