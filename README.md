# SIM:US

**개인의 선택이 모여 도시의 변화를 만드는 참여형 도시 시뮬레이션 전시 프로젝트입니다.**

참여자는 웹에서 시민증을 등록하고 도시에서 만나는 상황에 응답합니다. 서버는 선택에 따른 행복·안전·청결과 지역 오염 변화를 계산하고, Unity는 도시와 NPC를 시각화합니다. 회차가 끝나면 개인 성향과 최종 도시 결과를 확인할 수 있습니다.

신규 웹 회차와 Unity 기본 빌드의 기준은 **`CityMasterplan_v003`**이며, 위치 이벤트는 검증된 **`EXHIBITION_30`**만 사용합니다. v001·v002는 배포에서 폐기했으며 과거 결과와 개발 자료는 보존합니다. 기존 `Neighborhood.fbx`·`neighborhood.glb`는 이전 시제품 자료로, 신규 전시의 좌표·동선·최종 자산으로 사용하지 않습니다.

## Contents

- [Architecture](#architecture)
- [Setup and run](#setup-and-run)
- [Pinned dependency versions](#pinned-dependency-versions)
- [API documentation](#api-documentation)
- [Threat model](#threat-model)
- [Security hygiene](#security-hygiene)
- [Defences chosen](#defences-chosen)
- [Innovation defence 1: Unsafe file upload](#innovation-defence-1-unsafe-file-upload)
- [Innovation defence 2: Denial of service](#innovation-defence-2-denial-of-service)
- [Advanced security: Detection evasion](#advanced-security-detection-evasion)
- [Limitations and next steps](#limitations-and-next-steps)
- [Generative AI statement](#generative-ai-statement)
- [References](#references)

## Architecture

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

## Setup and run

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

## Pinned dependency versions

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

## API documentation

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

## Threat model

보호 대상은 **선택·도시 상태·결과의 무결성**, **참여 자격과 관리자 비밀**, **전시 시간 동안의 가용성**입니다. 닉네임·학과·MBTI 등 프로필과 공유 결과의 노출 범위도 관리 대상입니다. 실명 로그인 없이 참여할 수 있지만 모든 저장 데이터를 비식별 정보로 간주하지는 않습니다.

| 위협 주체·경로 | 예상 위협 | 현재 대응·잔여 위험 |
| --- | --- | --- |
| 변조한 브라우저·직접 API 호출 | 점수 조작, 타인 이벤트 응답, 종료 후 제출 | 서버 계산, 참여자별 활성 이벤트 확인, DB 시각 기반 접수 검사 |
| 요청 재전송·동시 제출 | 중복 점수 반영, 결과 불일치 | 요청 키, DB 제약, 행 잠금·트랜잭션 |
| 외부 사이트 | 쿠키를 이용한 교차 사이트 변경 요청 | Origin·Fetch Metadata 검사, SameSite 쿠키 |
| 관리자 토큰 탈취·위조 | 무단 회차 생성·시작·종료 | RS256 검증과 활성 관리자 확인; 토큰 탈취 대응은 별도 필요 |
| 자동화 클라이언트 | 참여자 대량 생성, 공개 API·DB 고갈 | 자원·DB 시간 제한; 요청 빈도 제한은 미구현 |
| 변조된 배포 자산 | 다른 맵·손상된 WebGL 배포 | 고정 경로, 버전·파일 해시 검사; 저장소·배포 권한 보호는 별도 필요 |

신뢰 경계는 브라우저/Unity와 서버 사이, 서버와 DB 사이, CI·자산 제작 환경과 배포 환경 사이입니다. 공개 NPC·도시 API는 인증 없이 읽을 수 있으므로 비공개 정보 저장소로 사용하지 않습니다.

## Security hygiene

- DB 비밀번호·관리자 JWT·개인키·작업 토큰·VAPID 개인키를 Git, 채팅, `NEXT_PUBLIC_*`, 웹 정적 파일, Unity 자산에 넣지 않습니다. 환경 파일·개인키·`.secrets/` 등은 Git 제외 대상이며 이미 추적된 파일과 배포 산출물은 별도로 확인합니다.
- 운영에서는 앱 역할 `simus_app`과 PostgreSQL 관리자를 분리합니다. 개발 Compose의 공개 포트와 예시 비밀번호를 운영 설정으로 사용하지 않습니다.
- 운영 웹 컨테이너는 `node` 사용자로 실행하며 Compose에서 capability 제거와 `no-new-privileges`를 설정합니다.
- 관리자 개인키는 웹 컨테이너에 전달하지 않고 공개키만 설정합니다. 계정 차단은 DB의 관리자 활성 상태로 제어하며 키 유출 시 키·토큰을 교체합니다.
- seed·테스트는 개발/격리 DB에서만 실행합니다. 기존 데이터는 보존하고 관리형 마이그레이션의 체크섬·적용 이력을 확인합니다.
- 에셋 변경 전 [에셋 규칙](assets/ASSET_RULES.md)을 읽고 [manifest](assets/manifest.csv)와 카탈로그를 확인합니다. 변경 후 카탈로그 생성·검사를 수행합니다.

## Defences chosen

| 방어 | 선택 이유·구현 |
| --- | --- |
| 서버가 결정하는 점수 | 요청으로 점수나 도시 최종값을 받지 않고 저장된 선택지와 회차 배율로 계산 |
| 원자적 선택 반영 | 선택 원장·개인 성향·도시·지역 갱신을 한 트랜잭션에 저장 |
| 멱등 요청과 회차 격리 | 응답 유실 후 재시도에도 중복 반영을 방지하고 다른 회차 데이터와 분리 |
| 참여 자격 보호 | 32바이트 무작위 토큰, DB에는 SHA-256 해시, HttpOnly·SameSite=Lax·운영 Secure 쿠키 |
| 관리자 권한 분리 | RS256·issuer·audience·필수 claim 검증 후 DB의 활성 관리자 확인 |
| 작업 인증 분리 | reconcile은 관리자 JWT와 별개인 32자 이상 토큰을 상수 시간 비교로 검증 |
| 입력·출처 검사 | JSON 객체·UUID·도메인별 값 검증, Origin·교차 사이트 요청 검사, SQL 값 매개변수화 |
| 결과 링크 범위 제한 | 무작위 공유 토큰의 해시·만료 검사, 재발급 시 기존 토큰 교체 |

공통 구현은 [`api.ts`](web/src/lib/api.ts), [`admin-auth.ts`](web/src/lib/auth/admin-auth.ts), [`choices/route.ts`](web/src/app/api/choices/route.ts)에서 확인할 수 있습니다.

## Innovation defence 1: Unsafe file upload

현재 참여자·관리자 기능에는 사용자 파일 업로드 API가 없습니다. 프로필은 정해진 데이터 필드로 받고 도시·캐릭터·WebGL 자산은 제작·검토·빌드 경로로 반입합니다. 현재의 대응은 **사용자 파일 업로드 경로를 제공하지 않아 공격 표면을 줄이는 것**입니다.

v003 WebGL은 서버 코드의 고정 경로에서 제공하고 빌드 과정에서 lockfile의 파일 크기·SHA-256을 검증합니다. 이 검사는 배포 파일의 일치 여부를 확인하며 악성코드 검사나 제작 도구의 안전성을 보장하지는 않습니다.

향후 업로드를 도입하면 허용 형식·실제 파일 내용·최대 크기 검사, 서버 생성 파일명, 실행 불가능한 별도 저장소, 접근 권한과 악성 파일 검사 등을 추가해야 합니다. 현재 이러한 업로드 검사 파이프라인이 구현돼 있다고 주장하지 않습니다.

## Innovation defence 2: Denial of service

공개 API 조회와 참여자 생성, 선택 제출이 전시 서버의 주요 부하 경로입니다. 현재 구현은 요청별 작업과 서비스 자원에 다음 제한을 둡니다.

- 앱 DB 풀 최대 연결 10개, 연결 대기 제한 5초.
- 공통 API 트랜잭션의 잠금 대기 제한 5초, SQL 실행 제한 10초.
- 운영 PostgreSQL 최대 연결 30개.
- 운영 Compose의 웹 메모리 768 MiB·CPU 1개, DB 메모리 512 MiB·CPU 1개 제한.
- 컨테이너 로그 파일당 10 MiB, 최대 3개 순환 보관.

멱등 처리는 재전송으로 인한 중복 상태 변경을 방지하지만 요청 처리 비용을 없애지는 않습니다. 자원 제한도 공격을 차단하는 기능은 아닙니다. **IP·참여자별 rate limit, 애플리케이션 공통 본문 크기 제한, WAF와 DDoS 방어는 현재 구현으로 확인되지 않았습니다.** 대량 접속 전 프록시 제한·폴링 부하·동시 제출·DB 잠금 경합을 검증해야 합니다.

## Advanced security: Detection evasion

SIM:US에서 고려하는 탐지 회피 시나리오는 쿠키 재발급을 통한 다중 참여, 정상 형식의 저속 반복 요청, 탈취한 유효 관리자 토큰 사용, 네트워크 재시도로 위장한 제출 재전송입니다.

현재 시스템은 요청 키와 선택 원장·상태 버전으로 재전송을 처리하고 DB의 활성 관리자 확인으로 계정 비활성화를 반영합니다. 예기치 않은 API 오류는 서버에 기록하며 사용자에게는 일반화된 오류를 반환합니다. 이는 무결성 보호와 일부 조사 근거이며 전용 탐지 체계는 아닙니다.

**중앙 보안 로그, 이상 행동 탐지, 자동 경보, 다중 참여 탐지, 변조 방지 감사 저장소는 미구현입니다.** 향후 인증 실패·참여자 생성 급증·반복 충돌·종료 작업 실패를 구조화해 기록하고 비밀값을 제외한 추적 식별자와 경보 기준을 도입할 필요가 있습니다. 이 항목은 탐지 회피 공격을 실험해 검증했다는 의미가 아닙니다.

## Limitations and next steps

- **전시 맵 인수:** v003 기준을 유지하면서 최종 좌표·지역 경계·NPC 동선·원본/교환 자산의 승인 범위를 확인합니다. 과거 Neighborhood 좌표로 빈 설정을 채우지 않습니다.
- **현장 검증:** 모바일 실기기, 전시 LAN, WebGL 메모리·프레임 속도, 다중 참여자의 위치·이벤트 동기화를 확인합니다. 과거 데스크톱 프리뷰 통과가 현장 인수를 대신하지 않습니다.
- **운영 검증:** 실제 서버의 HTTPS·이미지·DB 스키마·백업/복원·reconcile 스케줄러와 장애 복구 상태를 확인합니다.
- **보안 보완:** 요청 빈도·본문 크기 제한, 프록시 전달 헤더의 신뢰 경계, CSP 등 보안 헤더, 관리자 토큰 보관 방식과 보안 로그·경보를 검토합니다. 현재 출처 검사는 프록시의 올바른 헤더 처리가 전제입니다.
- **참여·개인정보:** 익명 쿠키는 1인 1참여를 보장하지 않습니다. 프로필·선택·공유 결과의 공개 범위와 보관·삭제 정책을 전시 운영 기준으로 확정합니다.
- **후속 기능:** 웹 푸시 실제 수신과 운영 VAPID 설정, 최종 도시 연출·오염 확산, 콘텐츠 편집 기능을 검증·보완합니다. 관리자 화면은 현재 콘텐츠 복사를 지원하며 개별 상황·선택지 편집은 지원하지 않습니다.

개별 검증 기록은 [문서 목차](docs/README.md)와 `docs/verification/`에 있습니다. 기록별 대상 버전·환경·실행 범위를 확인하며 이 README는 전체 기능의 운영·보안 인수 완료 선언이 아닙니다.

## Generative AI statement

이 README의 구성과 문장 작성에는 생성형 AI인 OpenAI Codex를 사용했습니다. 설명은 저장소의 소스 코드·설정·계약 문서를 바탕으로 작성했으며 구현 사실과 미구현·미검증 범위를 구분했습니다. 이번 문서 작성에서 DB 접속·빌드·배포·통합 테스트는 수행하지 않았습니다.

프로젝트 전체 코드·이미지·3D 자산의 AI 사용 범위와 도구별 기여 이력은 이 문서만으로 확정하지 않습니다. 개별 자산의 출처·라이선스·승인 상태는 [에셋 관리 규칙](assets/ASSET_RULES.md)과 [manifest](assets/manifest.csv)를 기준으로 확인하며 외부 제출 시 실제 제작 이력에 맞는 사용 내역을 추가해야 합니다.

## References

- [프로젝트 문서 목차](docs/README.md) · [웹 실행 안내](web/README.md) · [운영 화면](web/OPERATIONS.md)
- [DB 스키마·운영](db/README.md) · [관리형 마이그레이션](docs/operations/db-migrations.md)
- [기본 API](web/API.md) · [회차 생명주기](docs/contracts/session-lifecycle.md) · [NPC API](docs/contracts/participant-npc-api.md)
- [Unity 안내](unity/README.md) · [웹–Unity 브리지](docs/contracts/web-unity-bridge.md) · [WebGL 산출물](docs/operations/unity-webgl-artifacts.md)
- [Docker·GHCR·EC2](docs/operations/docker-ghcr-ec2.md) · [최초 DB 배포](docs/operations/ec2-postgres-first-deploy.md) · [관리자 인증](docs/operations/self-managed-admin-auth.md)
- [새 맵 인계](docs/content/new-map-handoff-5a.md) · [에셋 규칙](assets/ASSET_RULES.md) · [에셋 카탈로그](assets/catalog/README.md)

과거 문서에 있는 Neighborhood 재사용·v001/v002 배포 전제는 현재 프로젝트 결정과 v003 기준으로 대체합니다.
