# SIM:US

Next.js 참여·관리자 화면, PostgreSQL 회차·선택·결과 저장, Unity 동네 시각화로 구성됩니다.
**2026-09-29: 4~8단계 개발 사본 기능을 본 저장소에 통합했습니다.**

**전시용 맵은 새로 제작합니다.** 현재 `unity/`의 Neighborhood 장면과 기존 GLB/FBX는 시제품 검증용이며, 새 맵의 좌표·동선·최종 자산으로 확정하지 않았습니다. [새 맵 인계](docs/content/new-map-handoff-5a.md)를 참조하세요.

실행 기준은 `web/` + `db/` + `unity/`입니다. 옛 시제품 `simus-stage4-8/`는 2026-10-08 삭제했으며, 원본은 Git 이력에서 확인할 수 있습니다. Python 서버·프록시를 함께 실행하지 않습니다.

## 시작하기

1. 새 DB에 `db/001_initial_schema.sql`부터 `009_participant_profiles.sql`까지 번호 순서대로 적용합니다. 기존 DB에는 적용 이력을 확인한 뒤 누락된 후속 마이그레이션만 순서대로 적용합니다.
2. 새 개발·시연 DB에 `db/seed_demo.sql` 또는 `db/seed_neighborhood.sql`로 최초 콘텐츠를 준비합니다. 전시 30상황 초안을 시험할 때는 `seed_demo.sql` 다음에 `seed_exhibition.sql`을 적용합니다. 운영 DB에는 seed를 실행하지 않습니다.
3. `web/`에서 환경 설정 후 `npm ci`, `npm run build`, `npm start`를 실행합니다.
4. `/admin`에서 관리자 JWT로 접속해 회차를 준비·시작하고 `/participate`에서 참여합니다.
5. Unity 6000.3.24f1로 `unity/`를 열고 `Assets/Scenes/NeighborhoodLive.unity`를 실행합니다. 폴러 주소는 기본 `http://localhost:3000`입니다.

상세: [DB 적용 순서](db/README.md) · [통합 실행 안내](docs/operations/stage4-8-integration.md) · [인증·배포 안내](docs/operations/demo-deployment.md)

## 구현 상태

- QR 첫 화면의 닉네임·학과·MBTI 필수 입력(시민증), 입력 완료 시 회차 입장과 이후 변경 차단.
- 익명 참여, 선택 저장·중복 제출 방지, 새로고침 후 응답·미확인 제출 복원.
- 현재 도시 수치, 본인 과거 회차 결과와 확정된 최종 도시 수치 조회.
- JWT 관리자 인증, 콘텐츠를 복사한 다음 회차 준비, 진행 시간·배율 지정, 시작·수동 종료.
- 트랜잭션으로 도시·지역 갱신, 종료 결과 단일 확정, 다음 회차 격리.
- 인증된 reconcile API를 통한 자동 종료 및 중단된 종료 복구.
- Unity 동네 맵, 공개 도시 API 폴링·HUD, 참여자 NPC 목록을 이용한 이동과 임시 도시 연출.
- 회차별 학과 선택과 공개 학과 통계 API·화면, 모바일 2D 도시에서 본인 NPC 추적 후보.
- 다른 기기에서 확인할 수 있는 만료·재발급 결과 링크와 선택 동의 방식의 웹 푸시 등록·발송 작업.

## 검증 및 남은 범위

[9/29 통합 검증](docs/verification/stage4-8-validation.md) · [10/20 완료 일정](docs/planning/project-schedule-2026-10-20.md)

[9/29 구현 비교·10/20 완료 기준과 결정 대장](docs/planning/project-baseline-2026-10-20.md)은 당시 조사 기록입니다. 현재 구현 요약은 이 README와 각 기능 기록을 기준으로 확인합니다.

참여자 NPC·학과 기능은 코드와 자동 검증 기록이 있으나, 모바일·Unity 동기화와 실기기 화면·성능 인수는 남아 있습니다. Unity는 실제 NPC 목록을 받기 전에는 기존 미리보기를 표시합니다. 도시 연출 임계값도 임시값입니다.
웹 푸시의 실제 기기 수신과 운영용 VAPID 설정은 아직 검증이 필요합니다. 최종 캐릭터/도시 이미지, 오염 확산은 후속 구현입니다.

공개 배포와 운영 스케줄러 설치, 실기기·전시 LAN, Windows/WebGL 빌드 검증은 별도입니다.
Compose는 개발용이고 새 볼륨에 001~009를 초기화합니다. 기존 볼륨에는 새 SQL이 자동 적용되지 않으므로 적용 이력을 확인하고 누락된 마이그레이션을 별도 적용해야 합니다.
관리자 화면은 기존 콘텐츠 복사를 지원하며 개별 상황·선택지 편집은 지원하지 않습니다.

운영 DB에는 테스트를 실행하지 않습니다. 비밀값은 서버 설정으로 주입하고 Git·브라우저 번들·Unity 자산에 넣지 않습니다.
Unity는 공개 `GET /api/city-state`와 회차별 공개 NPC 목록을 읽습니다. 종료 정책은 기존 DRAIN을 유지합니다.

추가 문서: [문서 목차](docs/README.md) · [API](web/API.md) · [운영 화면](web/OPERATIONS.md) · [DB](db/README.md) · [Unity](unity/README.md)
