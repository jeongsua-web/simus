# 시연 준비 검증 기록

검증일: 2026-09-18. 외부 서비스 배포 없음. 기존 개발·운영 DB 변경 없음.

## 판정

**Next.js 프로덕션 빌드와 PostgreSQL/Chromium 통합 흐름 통과. Unity 포함 전체 시연 완료 판정은 보류.**
실제 Unity 타깃은 미확정이며, Windows 데스크톱을 준비 기준으로 문서화했다.

| 항목 | 결과와 근거 |
| --- | --- |
| 배포 설정 조사 | Compose는 Node 24 / PostgreSQL 16 개발 서버. 실제 배포 도메인·운영 프록시·CI 배포 설정 없음 |
| Unity 실행 대상 조사 | Assets/Packages만 존재. ProjectSettings/ProjectVersion/실행 장면/빌드 없음. Unity Editor 실행 파일 확인되지 않음 |
| Next.js 빌드 | `npm run build` 통과. Next 16.3.5, Node 24.18.0. TypeScript 및 정적 페이지 생성 완료 |
| 정적 검사 | 변경 후 `npm run lint` 통과, `git diff --check` 통과 |
| 격리 API 통합 | `npm run test:integration` exit 0. 관리자 권한, 8명 동시 참여·중복 요청, 점수/도시/지역 일관성, 종료 경쟁·본인 결과·다음 회차 격리 통과 |
| Chromium | 관리자 시작/종료, 독립 참여 컨텍스트 3개, 새로고침 복원, 응답 유실 후 재시도, offline/online, 마감 안내, 본인 결과, 다음 회차 초기화 통과. 페이지 오류 없음 |
| 새 시연 seed | 실제 새 격리 DB에 `seed_demo.sql` 적용, can_start=true, 관리자 start/end HTTP 200 확인 |
| 서버/DB 복구 | Next.js 실제 중단/재시작, CLOSING 복구, PostgreSQL stop/start 중 health 503 → 200와 저장된 도시 동일성 통과 |
| 출처 설정 | 다른 Origin을 붙인 공개 도시 GET은 200/no-store이며 Access-Control-Allow-Origin 없음. 별도 출처 WebGL 허용 구성 아님 |
| 로컬 관리자 도구 | `node scripts/demo-auth.mjs` 실행 성공. 생성 JWT 서명/iss/aud/sub 검증, 공개키에 개인키 없음, 작업 토큰 길이 확인 |
| 비밀/산출물 제외 | `.env.local`, `.demo` 설정/토큰, Unity Builds, WebGL public/city의 Git 제외 확인. 추적된 env 파일은 예제와 타입 선언 |
| 클라이언트 검사 | `.next/static`, `web/public`, `unity/Assets` 총 40파일에서 생성된 시연 토큰/작업 토큰과 PEM 개인키 표식 미검출. 일반적인 모든 비밀의 부재를 보증하는 검사는 아님 |
| Docker | 바이너리 확인되지 않아 Compose 실제 실행 미검증 |
| Unity | C# 컴파일/EditMode/Play Mode/도시 화면/데스크톱 빌드/WebGL 빌드·동일 출처 로딩 미실행 |

## 실행 환경과 이력

- Windows, PostgreSQL 18.4. Docker Compose의 PostgreSQL 16 실행 결과와 혼동하지 않는다.
- 빌드 최초 시도는 TypeScript 자식 프로세스 생성 `EPERM`으로 실패했다. 승인된 권한 재실행에서 성공했다.
- 저장소 밖 `C:/Users/sonmi/package-lock.json`을 무시한다는 Next.js 경고는 남아 있다. 빌드 실패 원인은 아니다.
- 격리 실행기도 최초 샌드박스 자식 프로세스 실행이 `EPERM`으로 차단됐다. 승인된 재실행에서 전체 통과했다.
- 성공한 테스트 폴더: `C:/Users/sonmi/AppData/Local/Temp/simus-integration-qgVCr6`.
  실행기 소유의 서버/DB 종료를 확인했다. 임시 테스트 파일은 보존하며 배포 산출물이 아니다.
- `.demo/`에는 로컬 시연용 설정과 8시간 토큰이 생성돼 있다. 기존 `.env.local`은 덮어쓰지 않았다.
- 테스트는 매번 새 DB를 만들고 001/002를 적용한다. 개발 seed 기반의 `tests/api.integration.mjs`와
  `db/verify_schema.sql`은 이번 검증에서 별도로 실행하지 않았다.

## 재현

`web/`에서 `npm ci`, `npm run build` 후 `npm run test:integration`을 실행한다.
Windows PostgreSQL 경로가 다르면 `TEST_PG_BIN`을 지정한다. 55439/3117 포트는 비어 있어야 한다.
Chromium 검증에는 아래 두 환경변수를 자신의 설치 위치로 설정한다.

```powershell
$env:TEST_PLAYWRIGHT_MODULE='C:/Users/sonmi/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs'
$env:TEST_CHROMIUM_EXECUTABLE='C:/Users/sonmi/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe'
npm run test:integration
```

이는 이 컴퓨터에서 확인한 경로다. 다른 컴퓨터에서는 별도로 Playwright/Chromium을 설치하고 실제 경로를 지정한다.
TEST_PLAYWRIGHT_MODULE이 없으면 브라우저 검증은 SKIP되므로 HTTP 통과와 구분한다.

## 남은 완료 조건

1. Unity Editor 버전·Windows 타깃·장면을 확정하고 EditMode/Play Mode/실제 빌드를 실행한다.
2. 실제 도시 변화와 장애 복구를 Unity 화면에서 확인하고 시연 체크리스트에 기록한다.
3. WebGL을 선택한다면 동일 출처 산출물 로딩·MIME/압축/TLS를 실제 브라우저에서 검증한다.
4. 실제 서버가 정해지면 HTTPS 프록시의 Origin/Host, Secure 쿠키, 스케줄러, DB 최소 권한·백업 복구를 검증한다.

실행·운영 절차와 체크리스트: [시연·배포 가이드](../operations/demo-deployment.md).
