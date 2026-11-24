# SIM:US

**당신의 선택이 우리의 도시를 바꿉니다.**

SIM:US는 여러 참여자의 선택을 하나의 가상 도시에 반영하는 참여형 도시 시뮬레이션 전시 프로젝트입니다. 참여자는 웹에서 시민으로 등록하고 도시 속 상황에 응답합니다. 각 선택은 도시의 행복·안전·청결과 지역 오염에 영향을 주며, Unity로 구현한 3D 도시와 NPC를 통해 공동체의 변화를 경험합니다.

회차가 끝나면 자신의 선택 성향과 함께 만들어진 도시의 최종 결과를 확인할 수 있습니다.

## 목차

- [주요 기능](#주요-기능)
- [참여 흐름과 화면](#참여-흐름과-화면)
- [시스템 구성](#시스템-구성)
- [저장소 구조](#저장소-구조)
- [설치 및 실행](#설치-및-실행)
- [기술 스택과 의존성 버전](#기술-스택과-의존성-버전)
- [API 안내](#api-안내)
- [도시 맵과 에셋 관리](#도시-맵과-에셋-관리)
- [회차 운영과 데이터 관리](#회차-운영과-데이터-관리)
- [현재 한계와 향후 계획](#현재-한계와-향후-계획)
- [생성형 AI 활용](#생성형-ai-활용)
- [관련 문서](#관련-문서)

## 주요 기능

| 기능 | 설명 |
| --- | --- |
| 시민증 등록 | 닉네임·학과·MBTI를 입력해 회차에 참여 |
| 상황과 선택 | 도시에서 발생하는 상황을 읽고 선택지에 응답 |
| 공동 도시 변화 | 참여자의 선택을 행복·안전·청결 및 지역 오염 수치에 반영 |
| 3D 도시와 NPC | Unity 기반 도시 표현, NPC 이동과 추적 카메라 |
| 개인·도시 결과 | 본인의 선택 성향과 회차의 최종 도시 상태 확인 |
| 결과 공유 | 만료·재발급 가능한 링크로 다른 기기에서 결과 확인 |
| 회차 운영 | 관리자 화면에서 회차 준비·시작·종료 및 진행 상태 확인 |

웹 푸시 알림은 구현 코드가 있으며 실제 기기 수신과 운영 설정 검증은 남아 있습니다.

## 참여 흐름과 화면

1. **참여 화면 접속:** 전시 안내의 QR 또는 참여 주소로 웹에 접속합니다.
2. **시민 등록:** 닉네임·학과·MBTI를 입력해 시민증을 등록합니다.
3. **도시 참여:** 본인 NPC와 도시를 확인하고 발생한 상황에 응답합니다.
4. **변화 확인:** 선택이 반영된 도시 수치와 도시의 변화를 확인합니다.
5. **회차 결과 확인:** 종료 후 개인 성향과 공동 도시의 최종 결과를 확인합니다.

| 화면 | 경로 | 용도 |
| --- | --- | --- |
| 참여 | `/participate` | 시민 등록과 회차 참여 |
| 개인 결과 | `/result/{session_id}` | 참여한 회차의 본인 결과 |
| 관리자 | `/admin` | 회차 준비와 운영 |
| v003 로컬 시험 | `/v003-test` | 격리 로컬 시연 도구에서 사용하는 시험 화면 |

## 시스템 구성

```text
참여자 브라우저 ── 시민 등록·선택·결과 조회 ──┐
관리자 브라우저 ── JWT 인증·회차 운영 ────────┤
                                            ▼
                                Next.js App Router / API
                                            │
                                트랜잭션·서버 점수 계산
                                            ▼
                                       PostgreSQL

Unity / WebGL ── 공개 도시·NPC API 조회 ── Next.js API
운영 스케줄러 ── 작업 토큰 인증 ── reconcile API
```

| 구성 | 역할 | 위치 |
| --- | --- | --- |
| Next.js / React / TypeScript | 참여·결과·관리자 화면, API, Unity 웹 호스트 | `web/` |
| PostgreSQL | 회차·참여자·선택 원장·도시 상태·결과 저장 | `db/` |
| Unity / C# | 3D 도시, NPC 이동, 카메라와 도시 상태 시각화 | `unity/` |
| Blender 및 교환 자산 | 도시·건물·캐릭터 원본과 전달 자산 | `assets/` |
| Docker / GitHub Actions | standalone 이미지 빌드와 GHCR 게시 구성 | `Dockerfile`, `.github/workflows/` |

회차는 `DRAFT → RUNNING → CLOSING → FINALIZED`로 진행합니다. 선택 반영과 결과 확정은 DB 트랜잭션으로 처리하고, 종료 시 기존 **DRAIN** 정책을 유지합니다. 서버가 점수와 접수 가능 여부를 판단합니다.

운영 Compose는 웹과 DB를 분리하고 DB 포트를 호스트에 공개하지 않습니다. HTTPS 역방향 프록시와 자동 종료 스케줄러는 별도 운영 구성이 필요합니다. 자세한 계약은 [회차 생명주기](docs/contracts/session-lifecycle.md)와 [웹–Unity 브리지](docs/contracts/web-unity-bridge.md)를 참고하세요.

## 저장소 구조

```text
.
├── web/          # Next.js 화면·API·WebGL 호스트
├── db/           # PostgreSQL 스키마·마이그레이션·개발 콘텐츠
├── unity/        # Unity 장면·C# 스크립트·프로젝트 설정
├── assets/       # 3D 원본·교환 자산·에셋 카탈로그
├── scripts/      # DB·인증·개발·에셋 관리 도구
├── docs/         # 기획·기능 계약·운영·검증 기록
└── .github/      # 이미지 빌드·게시 워크플로
```

## 설치 및 실행

Node.js 24, npm, PostgreSQL, Python 3를 준비합니다. Unity 편집·재빌드에는 Unity **6000.3.24f1**과 해당 빌드 타깃 지원 모듈이 필요합니다. 대용량 자산을 받을 때는 Git LFS도 필요합니다.

### 1. 의존성과 WebGL 준비

저장소 루트에서 실행합니다.

```sh
cd web
npm ci
npm run unity:fetch
npm run unity:verify
```

`unity:fetch`는 현재 v003 WebGL의 LFS data 파일을 받습니다. 검증이 실패하면 [WebGL 산출물 관리](docs/operations/unity-webgl-artifacts.md)를 확인합니다.

### 2. DB와 환경변수 설정

- 신규 DB는 관리형 `init`, 기존 DB는 적용 증빙을 검토한 `baseline` 후 `upgrade`를 사용합니다. 이미 관리 이력이 있으면 `upgrade`를 사용합니다. 명령과 전제 조건은 [DB 마이그레이션 안내](docs/operations/db-migrations.md)를 따릅니다.
- `compose.yaml`은 개발용입니다. 빈 볼륨에 001~010만 자동 적용하므로 최신 스키마 준비를 대신하지 않으며, 기존 볼륨에 새 SQL을 자동 적용하지 않습니다.
- SQL 파일을 glob이나 번호순으로 직접 실행하지 않습니다. 014는 016으로 대체하며, 012의 RUNNING 콘텐츠 변경은 별도 검토·승인 경로를 따릅니다. 기존 볼륨은 보존합니다.
- `web/env.example`을 참고해 `web/.env.local`을 만듭니다. 기존 파일이 있으면 필요한 항목을 병합합니다.

| 환경변수 | 용도 |
| --- | --- |
| `DATABASE_URL` | 해당 환경의 PostgreSQL 연결 |
| `ADMIN_TOKEN_ISSUER`, `ADMIN_TOKEN_AUDIENCE` | 관리자 JWT 발급자·대상 검증 |
| `ADMIN_JWKS_URL` 또는 `ADMIN_JWKS_JSON` | 관리자 공개키 설정, 정확히 하나만 사용 |
| `SESSION_JOB_TOKEN` | 자동 종료·복구 작업용 무작위 토큰, 32자 이상 |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | 선택 사항인 웹 푸시 설정 |

로컬 토큰 준비는 [개발 인증 안내](docs/operations/demo-deployment.md), 실제 서버의 키 생성·발급은 [SSH 운영자용 관리자 인증](docs/operations/self-managed-admin-auth.md)을 따릅니다. 운영 환경 예시는 루트 [`.env.example`](.env.example)에 있습니다.

### 3. 웹 실행과 회차 준비

`web/`에서 실행합니다.

```sh
npm run dev -- --hostname 127.0.0.1
```

기본 주소는 `http://localhost:3000`입니다. `/admin`에서 DRAFT 회차를 준비하고, v003 콘텐츠·위치·NPC 경로와 빌드 준비 상태를 확인한 뒤 시작합니다. `/participate`에서 시민 등록 후 참여하고 `/result/{session_id}`에서 결과를 확인합니다. 스키마 초기화만으로 운영 회차나 맵 설정이 생성되지는 않습니다. 테스트 seed를 운영 DB에 적용하지 않습니다.

v003 전용 격리 로컬 시연은 저장소 루트에서 다음 도구를 사용할 수 있습니다.

```sh
node scripts/dev/v003-local.mjs
```

이 도구는 별도 임시 PostgreSQL 클러스터와 테스트 회차를 생성하고 `http://127.0.0.1:3210/v003-test`를 제공합니다. 기존 `DATABASE_URL`을 읽지 않습니다. PostgreSQL 바이너리 경로가 기본값과 다르면 `V003_PG_BIN`을 설정합니다. 로컬 테스트 모드를 사용하므로 운영 배포 절차로 사용하지 않습니다. `Ctrl+C`로 도구가 시작한 웹·DB를 종료합니다.

### 4. 빌드·검증·배포

`web/`에서 실행합니다.

```sh
npm run lint -- src next.config.ts
npx tsc --noEmit
npm run build
npm run start -- --hostname 127.0.0.1 --port 3000
```

운영 모드 참여 쿠키는 `Secure`이므로 실제 다중 기기 환경은 HTTPS로 제공합니다. `npm run test:integration`은 PostgreSQL 바이너리와 프로덕션 빌드를 필요로 하며 폐기 가능한 격리 DB에서만 실행합니다.

Docker 운영 배포는 [Docker·GHCR·EC2 안내](docs/operations/docker-ghcr-ec2.md)와 [최초 PostgreSQL 배포](docs/operations/ec2-postgres-first-deploy.md)를 따릅니다. 적용된 이미지·스키마·HTTPS·스케줄러 상태는 실제 서버에서 별도 확인합니다.

## 기술 스택과 의존성 버전

아래 npm 버전은 현재 [`web/package-lock.json`](web/package-lock.json)에 기록된 해석 결과입니다. `package.json`의 일부 범위 지정과 구분하며, 재현 가능한 설치에는 `npm ci`를 사용합니다.

| 의존성 | 버전 | 기준 |
| --- | --- | --- |
| Next.js | 16.3.8 | npm lockfile |
| React / React DOM | 19.2.8 | npm lockfile |
| TypeScript | 5.9.3 | npm lockfile |
| node-postgres (`pg`) | 8.23.0 | npm lockfile |
| `jose` | 6.2.12 | npm lockfile |
| `web-push` | 3.6.7 | npm lockfile |
| ESLint / eslint-config-next | 9.39.5 / 16.3.8 | npm lockfile |
| Unity Editor | 6000.3.24f1 | `unity/ProjectSettings/ProjectVersion.txt` |
| Unity Newtonsoft JSON | 3.0.2 | `unity/Packages/manifest.json` |
| Unity Test Framework | 1.1.33 | `unity/Packages/manifest.json` |
| Node.js 이미지 | `24-bookworm-slim` | Docker 태그, digest 고정 아님 |
| PostgreSQL 이미지 | `16` | Compose 태그, 패치·digest 고정 아님 |

Node.js·PostgreSQL 이미지 태그는 완전한 버전 고정이 아닙니다. 운영 웹 이미지는 검토된 커밋 SHA 태그 또는 digest를 사용합니다. WebGL 파일은 [`v003-webgl.lock.json`](web/v003-webgl.lock.json)의 크기·SHA-256과 대조합니다.

## API 안내

API는 Next.js 서버의 `/api`에서 제공합니다. 공통 JSON 응답은 `Cache-Control: no-store`를 사용하며 오류 형식은 `{ "error": { "code": "...", "message": "..." } }`입니다.

| 메서드·경로 | 역할 | 인증 |
| --- | --- | --- |
| `GET /api/health` | 서버·DB 상태 확인 | 공개 |
| `GET /api/sessions/current` | 현재 회차 조회 | 공개 |
| `GET /api/city-state` | 도시·지역 수치 조회 | 공개 |
| `POST /api/participants` | 익명 참여 자격 발급·재사용 | 참여 쿠키 발급 |
| `GET /api/participants` | 본인 참여 이력 조회 | 참여 쿠키 |
| `GET, POST /api/sessions/{id}/profile` | 시민증 프로필 조회·등록 | 참여 쿠키 |
| `POST /api/sessions/{id}/join` | 회차 입장 | 참여 쿠키 |
| `GET, PATCH /api/sessions/{id}/event` | 본인 이벤트 조회·진행 | 참여 쿠키 |
| `POST /api/choices` | 현재 활성 이벤트에 선택 제출 | 참여 쿠키 |
| `GET /api/sessions/{id}/npc-positions` | 지도 버전에 맞는 NPC 위치 조회 | 공개 |
| `GET /api/sessions/{id}/result` | 본인 결과 조회 | 참여 쿠키 |
| `POST /api/sessions/{id}/result-link` | 본인 결과 공유 토큰 발급·재발급 | 참여 쿠키 |
| `POST /api/shared-result` | 공유 결과 조회 | 본문의 공유 토큰 |
| `GET, POST /api/admin/sessions` | 회차 목록·준비 | 관리자 JWT·활성 DB 관리자 |
| `POST /api/admin/sessions/{id}/start`, `/end` | 회차 시작·종료 | 관리자 JWT·활성 DB 관리자 |
| `POST /api/internal/sessions/reconcile` | 자동 종료·종료 복구 | 작업 Bearer 토큰 |

선택 제출의 JSON 필드는 `session_id`, `situation_id`, **`event_id`**, `choice_id`, `request_key`입니다. 실제 API에서 받은 식별자를 사용합니다. 새 제출에는 새 UUID 요청 키를 만들고, 네트워크 재시도에는 같은 키와 본문을 사용합니다. 신규 성공은 201, 성공한 동일 요청 재조회는 200, 같은 키의 다른 본문은 409입니다.

상세 자료: [기본 API](web/API.md) · [NPC API](docs/contracts/participant-npc-api.md) · [NPC 이벤트](docs/contracts/npc-events.md) · [참여 프로필](docs/contracts/participant-profiles.md) · [결과 링크·푸시](docs/contracts/result-notification-4b.md). 과거 문서의 실행·맵 예시는 현재 v003 기준과 해당 라우트 구현을 함께 확인합니다.

## 도시 맵과 에셋 관리

신규 웹 회차와 Unity 기본 빌드는 **`CityMasterplan_v003`**을 기준으로 합니다. v003 위치 이벤트는 검증된 **`EXHIBITION_30`**만 사용합니다. 회차의 지도 버전·NPC 경로·이벤트 위치와 실제 WebGL 빌드가 일치해야 합니다.

v001·v002는 배포에서 폐기했으며 기존 회차 결과와 개발 자료는 보존합니다. `Neighborhood.fbx`·`neighborhood.glb`는 이전 시제품 자료로, 신규 전시의 좌표·동선·상황 배치·최종 자산으로 사용하지 않습니다. 최종 전시 좌표와 자산의 승인 범위는 [새 맵 인계 기록](docs/content/new-map-handoff-5a.md) 및 해당 버전의 검증 기록을 함께 확인합니다.

에셋을 추가·변경·이동하기 전 [에셋 관리 규칙](assets/ASSET_RULES.md)을 읽습니다. 탐색은 [카탈로그](assets/catalog/README.md), 승인 상태는 [manifest](assets/manifest.csv), 실제 파일 목록은 [inventory](assets/catalog/inventory.json)를 기준으로 합니다. 에셋 작업 후 저장소 루트에서 실행합니다.

```sh
python3 scripts/assets/catalog.py
python3 scripts/assets/catalog.py --check
```

## 회차 운영과 데이터 관리

회차는 `DRAFT → RUNNING → CLOSING → FINALIZED`로 진행합니다. 관리자는 DRAFT에서 콘텐츠·지도·경로·진행 시간을 준비하고 검증을 통과한 회차를 시작합니다. 종료 시에는 기존 DRAIN 정책에 따라 처리 중인 선택을 정리한 뒤 결과를 확정합니다. 자동 종료와 중단된 종료 복구는 인증된 reconcile API를 호출하는 운영 스케줄러로 처리합니다.

- **선택의 일관성:** 서버에 저장된 선택지와 회차 배율로 점수를 계산합니다. 선택 원장·개인 성향·도시·지역 상태는 하나의 DB 트랜잭션으로 갱신합니다.
- **중복 반영 방지:** 요청 키와 DB 제약을 사용해 네트워크 재시도와 동시 제출을 처리합니다.
- **참여자 보호:** 참여 토큰은 HttpOnly·SameSite 쿠키로 관리하고 DB에는 해시를 저장합니다. 운영 쿠키는 HTTPS가 필요합니다.
- **관리자 권한:** RS256 JWT의 서명·발급자·대상·유효기간과 DB의 활성 관리자 여부를 확인합니다. 자동 종료 작업은 별도 작업 토큰을 사용합니다.
- **비밀 관리:** DB 비밀번호·개인키·JWT·작업 토큰을 Git, 공개 웹 파일, `NEXT_PUBLIC_*`, Unity 자산에 넣지 않습니다.
- **데이터 보존:** 운영에서는 앱·DB 관리자 계정을 분리하고 DB 포트를 공개하지 않습니다. 기존 회차와 결과를 보존하며 테스트·seed는 개발/격리 DB에서만 실행합니다.

상세 운영 절차는 [회차 생명주기](docs/contracts/session-lifecycle.md), [관리자 인증](docs/operations/self-managed-admin-auth.md), [DB 마이그레이션](docs/operations/db-migrations.md)을 참고하세요.

## 현재 한계와 향후 계획

- **현장 환경 검증:** 모바일 실기기와 전시 LAN에서 WebGL 로딩·메모리·프레임 속도, 다중 참여자의 NPC·이벤트 동기화를 확인합니다.
- **전시 맵 인수:** v003의 최종 지역 경계·이벤트 위치·NPC 동선과 원본/교환 자산의 승인 범위를 확정합니다.
- **운영 안정성:** 실제 서버의 HTTPS·이미지·DB 스키마·자동 종료 스케줄러와 백업·복원·장애 복구를 점검합니다. 동시 접속과 폴링 부하도 검증합니다.
- **결과 알림:** 웹 푸시의 운영 VAPID 설정과 실제 기기 수신을 확인합니다.
- **콘텐츠와 연출:** 최종 도시 연출·오염 확산을 보완합니다. 관리자 화면은 현재 콘텐츠 복사를 지원하며 개별 상황·선택지 편집은 지원하지 않습니다.
- **참여 데이터 관리:** 익명 쿠키는 1인 1참여를 보장하지 않습니다. 프로필·선택·공유 결과의 공개 범위와 보관·삭제 정책을 전시 운영 기준으로 정합니다.

구현과 검증의 범위는 [문서 목차](docs/README.md) 및 `docs/verification/`의 대상 버전·실행 환경별 기록을 확인합니다.

## 생성형 AI 활용

이 README의 구성과 문장 작성에는 OpenAI Codex를 사용했으며 저장소의 코드·설정·계약 문서를 근거로 정리했습니다. 이번 문서 수정에서는 DB 접속·빌드·배포·통합 테스트를 수행하지 않았습니다.

코드와 3D 자산 전체의 AI 사용 범위를 이 문서로 일괄 단정하지 않습니다. 개별 자산의 출처·라이선스·승인 상태는 [에셋 관리 규칙](assets/ASSET_RULES.md)과 [manifest](assets/manifest.csv)에서 확인합니다.

## 관련 문서

- [프로젝트 문서 목차](docs/README.md) · [웹 실행 안내](web/README.md) · [운영 화면](web/OPERATIONS.md)
- [DB 스키마·운영](db/README.md) · [관리형 마이그레이션](docs/operations/db-migrations.md)
- [기본 API](web/API.md) · [회차 생명주기](docs/contracts/session-lifecycle.md) · [NPC API](docs/contracts/participant-npc-api.md)
- [Unity 안내](unity/README.md) · [웹–Unity 브리지](docs/contracts/web-unity-bridge.md) · [WebGL 산출물](docs/operations/unity-webgl-artifacts.md)
- [Docker·GHCR·EC2](docs/operations/docker-ghcr-ec2.md) · [최초 DB 배포](docs/operations/ec2-postgres-first-deploy.md) · [관리자 인증](docs/operations/self-managed-admin-auth.md)
- [새 맵 인계](docs/content/new-map-handoff-5a.md) · [에셋 규칙](assets/ASSET_RULES.md) · [에셋 카탈로그](assets/catalog/README.md)

과거 문서에 있는 Neighborhood 재사용·v001/v002 배포 전제는 현재 프로젝트 결정과 v003 기준으로 대체합니다.
