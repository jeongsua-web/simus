# 시연·배포 준비 가이드

기준일: 2026-09-18. 외부 공개 배포는 수행하지 않았다.

## 1. 먼저 확인한 실행 대상과 기존 설정

- `unity/`에는 Assets와 Packages만 있고 ProjectVersion, EditorBuildSettings, `.unity` 장면이 없다.
  설치된 Unity Editor도 확인되지 않았다. 기존 실제 대상이 WebGL이었다고 판단할 근거는 없다.
- 이 가이드의 최초 시연 준비 기준은 **Windows 데스크톱**이다. 실제 Editor 버전과 빌드 타깃은
  Editor를 설치하고 아래 절차를 완료한 뒤 기록한다. 현재 배포 가능한 Unity 바이너리는 없다.
- `compose.yaml`: Node 24, PostgreSQL 16, 소스 바인드 마운트, `next dev`, 로컬 개발 자격 정보.
  DB 5432와 web 3000을 호스트에 노출한다. 운영용으로 그대로 사용하지 않는다.
- `web/next.config.ts`에는 배포 도메인, CORS, 프록시 설정이 없다. 배포 워크플로·실제 서버 주소도 없다.
- 현재 컴퓨터는 Node 24.18.0 / PostgreSQL 18.4를 사용해 검증했다. Docker 실행 파일은 확인되지 않았다.

## 2. 데이터 분리와 DB 준비

다음 명령은 저장소 루트의 PowerShell 기준이다. PostgreSQL 14+와 Node 24/npm을 준비한다.
시연은 새 DB `simus_demo`, 자동 검증은 실행기가 생성하는 `simus_integration`, 운영은 별도 DB·계정·서버를 사용한다.
개발 DB `simus`나 운영 DB의 데이터를 삭제하거나 재설정하지 않는다.

### PostgreSQL을 직접 사용하는 경우

설치 환경에 맞춰 바이너리 경로·사용자를 바꾼다. 비밀번호는 프롬프트/로컬 인증 설정을 사용한다.

```powershell
$pgBin = 'C:/Program Files/PostgreSQL/18/bin'
& "$pgBin/createdb.exe" -h localhost -U postgres simus_demo
& "$pgBin/psql.exe" -h localhost -U postgres -d simus_demo -v ON_ERROR_STOP=1 -f db/001_initial_schema.sql
& "$pgBin/psql.exe" -h localhost -U postgres -d simus_demo -v ON_ERROR_STOP=1 -f db/002_session_lifecycle.sql
& "$pgBin/psql.exe" -h localhost -U postgres -d simus_demo -v ON_ERROR_STOP=1 -f db/seed_demo.sql
```

각 명령이 성공한 경우에만 다음 명령으로 진행한다. 직접 설치 DB를 사용하면 다음 절의 DATABASE_URL도
해당 DB 계정과 인증 방식으로 바꿔야 한다. 운영에서는 스키마 소유자와 앱 계정을 분리한다.

### Docker Desktop을 사용하는 경우 (대안)

기존 Compose의 web 대신 DB만 올리고, 새 시연 DB를 명시적으로 만든다.

```powershell
docker compose up -d db
docker compose exec db createdb -U simus simus_demo
docker compose exec db psql -U simus -d simus_demo -v ON_ERROR_STOP=1 -f /schema/001_initial_schema.sql
docker compose exec db psql -U simus -d simus_demo -v ON_ERROR_STOP=1 -f /schema/002_session_lifecycle.sql
docker compose exec db psql -U simus -d simus_demo -v ON_ERROR_STOP=1 -f /schema/seed_demo.sql
```

기존 Compose 기본 DB `simus`는 빈 볼륨의 첫 기동에 001만 자동 적용한다. 기존 DB에는 001을 다시 실행하지 않는다.
002는 배포 이력과 DB 적용 여부를 확인하고 한 번 적용한다. 자동 마이그레이션/이력 관리 도구는 없다.
운영 마이그레이션 전에는 백업과 복원 시험을 수행하고 버전·적용일을 별도 기록한다.
`docker compose stop`은 데이터를 보존한다. `down -v`는 데이터 삭제이므로 시연 종료 명령으로 쓰지 않는다.

### 시연 seed의 범위

`seed_demo.sql`은 dev-admin, DRAFT 1개, 중앙 지역 1개, 쓰레기 상황 1개와 선택지 2개를 만든다.
도시/지역 런타임 상태와 시작은 관리자 API가 생성한다. `seed_development.sql`과 같은 DB에 적용하지 않는다.
고정 회차 ID는 `10000000-0000-0000-0000-000000000001`이다. 종료한 회차는 재사용하지 않는다.
다음 시연은 새 이름의 빈 DB를 만들고 001 → 002 → demo seed를 적용한 뒤 DATABASE_URL을 변경한다.
기존 DB는 보존한다. seed를 재실행해도 종료 상태나 종료 시각이 초기화되지 않는다.

## 3. 관리자 설정과 Next.js 실행

### 로컬 시연용 인증 (외부 인증 제공자 없이)

```powershell
Set-Location web
npm ci
node scripts/demo-auth.mjs
```

이 도구는 `.demo/env.local`과 `.demo/admin-token.txt`를 생성한다. `.demo/`는 Git 제외 대상이다.
개인 서명키는 메모리에만 존재하며 저장하지 않는다. JWT는 RS256, subject `dev-admin`, 만료 8시간이다.
재실행하면 새 키/토큰으로 바뀌므로 설정 반영 후 서버도 재시작한다. 운영용 인증으로 사용하지 않는다.

`.demo/env.local`의 DATABASE_URL을 위에서 만든 **시연 DB**에 맞게 편집한다.
기존 `.env.local`이 없다면 복사한다. 있으면 기존 파일을 덮어쓰지 말고 필요한 값을 직접 병합한다.

```powershell
if (!(Test-Path .env.local)) { Copy-Item .demo/env.local .env.local }
```

반드시 `ADMIN_TOKEN_ISSUER`, `ADMIN_TOKEN_AUDIENCE`, `ADMIN_JWKS_JSON`, `SESSION_JOB_TOKEN`,
`DATABASE_URL`을 모두 반영한다. `ADMIN_JWKS_URL`은 제거한다. JWKS 설정은 JSON/URL 중 정확히 하나만 가능하다.
셸에 같은 이름의 환경변수가 있으면 파일보다 우선하므로 다른 DB/인증 설정이 주입되지 않았는지 확인한다.

```powershell
npm run dev -- --hostname 127.0.0.1
```

별도 터미널에서 `Invoke-RestMethod http://localhost:3000/api/health`의 `database`가 `simus_demo`인지 확인한다.
`/admin`의 토큰 입력란에 `.demo/admin-token.txt`의 내용을 붙여넣고 **운영 화면 열기**를 누른다.
도구와 seed는 동일한 `dev-admin` subject를 사용한다. 토큰·설정 파일은 화면 공유나 로그에 노출하지 않는다.

### 실제 서버 관리자 설정

서버 환경에 DATABASE_URL, ADMIN_TOKEN_ISSUER, ADMIN_TOKEN_AUDIENCE,
ADMIN_JWKS_URL(HTTPS 공개키 URL) 또는 ADMIN_JWKS_JSON(공개키만)을 주입한다.
외부 발급자의 RS256 JWT에는 일치하는 iss/aud, 유효한 sub/iat/exp가 필요하다.
DB 운영자가 확인한 실제 subject를 다음 형태로 등록한다. 예시 문자열을 그대로 사용하지 않는다.

```sql
INSERT INTO simus.admin_users (auth_subject, display_name)
VALUES ('REPLACE_WITH_VERIFIED_OIDC_SUB', '운영 관리자');
```

`is_active=true`인 DB 관리자와 JWT subject가 일치해야 한다. 관리자 UI는 토큰을 sessionStorage에 보관한다.
로그아웃 버튼 또는 탭 종료로 시연 인증 세션을 정리한다. 비활성 관리자는 403, 잘못된 JWT는 401이다.

### 프로덕션 빌드·실행 검증

개발 서버를 종료한 뒤 `web/`에서 실행한다. 빌드와 실행은 같은 디렉터리에서 수행한다.

```powershell
npm run lint
npm run build
npm run start -- --hostname 127.0.0.1 --port 3000
```

localhost는 로컬 확인용이다. 프로덕션 모드는 참여 쿠키에 Secure를 설정하므로 다른 PC의 HTTP LAN 주소에서
참여가 유지된다고 가정하지 않는다. 실제 서버/다중 장비 시연은 HTTPS로 구성해 쿠키와 POST 동작을 확인한다.

## 4. 주소와 배포 경계

| 용도 | 주소 / 설정 |
| --- | --- |
| 같은 PC 웹·참여·관리자 | `http://localhost:3000`, `/participate`, `/admin` |
| 같은 PC Unity 데스크톱 | Server Base Url = `http://localhost:3000` |
| LAN 개발 시연 | Next dev를 `--hostname 0.0.0.0`으로 실행, `http://<호스트 LAN IP>:3000`; 방화벽 확인 |
| 실제 배포 서버 | 미지정. `https://simus.example.com`은 **예시**이며 실제 서비스 아님 |
| 다른 PC Unity | localhost가 아니라 접근 가능한 서버의 HTTPS 기본 주소 |
| WebGL 같은 출처 | `https://<실제 호스트>/city/index.html`, API는 같은 출처 `/api/city-state` |

실제 배포 시 Node 런타임에서 `npm ci`, `npm run build`, `npm run start`를 사용한다.
DB/API가 필요하므로 정적 export만으로 배포할 수 없다. 프로세스 재기동 관리자, HTTPS 역방향 프록시,
서버 비밀 주입, DB 비공개 네트워크/백업과 최소 권한을 별도로 구성한다.
프록시 뒤에서는 브라우저 Origin과 서버가 인식하는 프로토콜/Host가 일치해야 한다.
`/api/participants`와 관리자 시작 POST가 INVALID_ORIGIN 없이 동작하는지 실제 HTTPS에서 점검한다.
현재 프록시 설정은 없고 이 검증은 미완료다. API를 CDN 캐시하지 않는다.

자동 종료는 서버가 스스로 예약하지 않는다. 운영 스케줄러가 충분히 짧은 간격(예: 1초)으로
`POST /api/internal/sessions/reconcile`을 호출하게 구성하고 실패를 재시도한다.
Bearer에는 서버 전용 `SESSION_JOB_TOKEN`(무작위 32자 이상)을 사용한다. URL·Unity·브라우저에 넣지 않는다.
스케줄러 지연이 결과 확정 시각에 영향을 준다. 시연은 관리자 수동 종료로 진행할 수 있다.

## 5. Unity 준비·빌드·실행

1. Unity Hub에서 사용할 Editor 버전을 선택·설치한다. 해당 버전의 Windows 빌드 지원도 준비한다.
2. 같은 Editor로 빈 3D Core 프로젝트를 만들고 Editor를 닫은 뒤 ProjectSettings를 `unity/`로 복사한다.
   실제 ProjectVersion을 기록하고 `unity/`를 연다. Library/Temp/Logs는 복사하지 않는다.
3. Packages 복원을 기다리고 Console 컴파일 오류를 해결한다. Editor 버전·패키지 잠금·생성된 `.meta`를 기록한다.
4. 빈 장면에서 `SIMUS > Create City Client`를 실행한다. Preview 오브젝트는 제거한다.
   Poller의 Server Base Url을 설정하고 `Assets/Scenes/City.unity`로 저장한다.
5. EditMode Test Runner에서 Run All, Play Mode에서 실제 API 수신과 도시 변화를 확인한다.
6. Build Profiles/Build Settings에서 Windows 데스크톱을 선택하고 City 장면을 빌드 목록에 포함한다.
   출력은 Git 제외 폴더 `unity/Builds/Windows/`로 지정한다. Build And Run 후 생성된 exe와 함께
   생성된 Data 폴더·DLL 등 전체 산출물을 배포 단위로 보관한다.
7. 새 컴퓨터에서 전체 산출물을 복사해 exe를 실행한다. Server Base Url이 빌드에 저장되므로
   대상 서버 주소를 바꾸려면 현재 구현에서는 장면 설정 후 다시 빌드한다.
8. HUD Connected, 회차 ID/version, 도시·지역 수치, 서버 중단 시 마지막 상태 유지와 재연결을 확인한다.

빈 장면의 bootstrap은 localhost 기본값을 사용한다. 실제 서버/WebGL에서는 반드시 명시적 클라이언트 오브젝트를
저장해 설정값을 포함한다. Preview는 고정 가짜 수치이며 API 연동 증거로 쓰지 않는다.
기록할 항목: Editor 버전, 타깃/아키텍처, 장면, Server Base Url, 빌드 일시, 커밋, EditMode/실행 결과.
현재 환경에서는 이 단계의 실제 실행을 완료하지 못했다.

### WebGL을 선택할 때의 필수 검증

현재 API는 CORS 허용 헤더를 반환하지 않는다. 별도 포트/도메인의 WebGL은 브라우저 읽기가 차단된다.
동일 출처는 스킴·호스트·포트 모두 같아야 하며 localhost와 127.0.0.1도 다르다.

- Editor의 WebGL 지원을 설치하고 타깃을 전환한다. Poller의 Server Base Url을 **빈 문자열**로 저장한다.
- City 장면을 포함해 `unity/Builds/WebGL/`로 빌드한다. 최초 검증은 압축 Disabled로 구성해 압축 헤더 의존성을 줄인다.
- 전체 산출물을 `web/public/city/`로 복사한 뒤 Next.js를 다시 빌드·실행한다. 배포 서버에서는 같은 호스트의
  정적 경로로 제공해도 된다. 생성한 산출물은 Git에 넣지 않는다. `file://`로 index.html을 열지 않는다.
- `/city/index.html`에서 로더/wasm/data가 200인지, wasm MIME이 올바른지, `/api/city-state`가 같은 출처인지
  Network 패널로 확인한다. 압축을 사용하면 실제 파일과 일치하는 Content-Encoding도 검증한다.
- HTTPS 페이지에서 HTTP API를 부르지 않는다. Console에 CORS/mixed-content 오류가 없고 실제 회차/수치가
  반영돼야 통과다. 별도 출처가 꼭 필요하면 공개 GET에 한정된 출처 허용 정책을 먼저 구현·검증한다.
  관리자/참여 API의 출처 검증을 해제하는 것으로 해결하지 않는다.

이번 검증은 API의 CORS 헤더 부재 확인까지다. WebGL 산출물·브라우저 실제 로딩은 미검증이다.

## 6. 시연 체크리스트

- [ ] **회차 준비:** health DB가 시연 DB인지 확인. 새 DRAFT, 종료 예정 시각이 미래, 관리자 목록 can_start=true.
  Unity Live 클라이언트와 참여 브라우저를 준비하고 Preview를 제거한다.
- [ ] **시작:** 관리자 **회차 시작**. RUNNING, 도시 초기값 50/50/50, 중앙 오염 0, version 0 확인.
- [ ] **참여:** 서로 다른 브라우저 프로필로 `/participate` 접속. 첫 참여자는 분리배출, 두 번째는 그대로 두기 선택.
  제출 성공과 새로고침 후 완료 상태 유지 확인. 단순 새 탭은 쿠키를 공유하므로 다른 참여자가 아니다.
- [ ] **도시 변화:** `/api/city-state`의 version 증가와 Unity HUD/색·건물 변화 확인.
  두 선택은 행복/청결과 지역 오염에 서로 다른 영향을 주며 안전 값은 그대로일 수 있다.
  폴링 약 2초와 표현 보간 약 1.2초를 고려한다. 중복 요청이 추가 변화로 이어지지 않는지 확인한다.
- [ ] **종료:** 관리자 **수동 종료 → 대상 회차 종료**. 새 선택 거부, 최종 FINALIZED 확인.
  CLOSING은 짧아 화면에서 보이지 않을 수 있다. Unity의 결과 확정 상태도 확인한다.
- [ ] **결과 확인:** 참여했던 각 프로필에서 `/result/10000000-0000-0000-0000-000000000001` 확인.
  본인 결과만 보이고 미참여 프로필은 결과 없음. 시연 seed의 ±1 점수는 둘 다 중립 분류일 수 있다.
- [ ] **복구 점검:** 서버 중단 시 Unity가 마지막 상태를 유지하는지, 재시작 후 Connected로 돌아오는지 확인.
- [ ] **마무리:** 서버 종료, 토큰 탭 종료, 테스트 데이터로 표시한 결과만 공유. 운영 DB/설정으로 이관하지 않는다.

## 7. 비밀 정보와 산출물

`.env*`, `.demo/`, Unity Builds는 Git 제외 대상이다. DB 비밀번호, 개인키, 관리자 JWT, 작업 토큰은
`NEXT_PUBLIC_*`, next.config의 env, public, Unity Assets/Resources/StreamingAssets/장면에 넣지 않는다.
Unity에는 공개 API 기본 주소만 저장한다. JWKS에는 공개키만 넣으며 개인 서명키는 인증 제공자가 관리한다.
배포 전 추적 파일과 브라우저/Unity 산출물을 별도 검사한다. Git ignore는 이미 추적된 파일을 제거하지 않는다.
실제 비밀이 유출됐다면 삭제만으로 끝내지 말고 폐기·재발급한다.
