# SIM:US 통합 검증 보고서

검증일: 2026-09-17 (KST). 중단된 작업의 미커밋 변경과 문서부터 확인하고 이어서 수행했다. 기존 UI·API·Unity 변경은 보존했다.

**판정: Next.js·PostgreSQL 및 실제 Chromium 흐름은 수정 후 통과. Unity 런타임·화면 검증은 환경 부재로 미완료이므로 3개 구성요소 전체의 실행 검증 완료로 판정하지 않는다.**

## 범위와 환경

- 확인 문서: `README.md`, `web/API.md`, `web/OPERATIONS.md`, `docs/contracts/session-lifecycle.md`, `docs/contracts/unity-integration.md`, `unity/README.md`. 과거 문서의 설계 제안·미구현 표기는 현재 코드와 구분했다.
- Windows, Node.js 24.18.0, Next.js 16.3.5 프로덕션 빌드, PostgreSQL 18.4.
- `tests/isolated-runner.mjs`가 매 실행마다 `%TEMP%/simus-integration-*`에 **새 PostgreSQL 클러스터**를 생성한다. 개발용 Compose, `.env.local`의 DB 주소, 기존 DB 볼륨을 사용하지 않는다.
- 전용 DB `simus_integration`, PostgreSQL `127.0.0.1:55439`, Next.js `127.0.0.1:3117`. 시작 전 포트 점유 검사를 한다. `DATABASE_URL`은 실행기가 전용 주소로 덮어쓴다.
- 새 DB에 `001_initial_schema.sql`, `002_session_lifecycle.sql`을 적용하고 테스트 전용 관리자·회차·선택지를 생성한다. RS256 관리자 키는 실행 시 생성한다. 실서비스 토큰은 사용하지 않는다.
- 테스트 종료 시 자신이 생성한 서버·DB만 중지하고 임시 파일은 남긴다. 개발 데이터를 변경하거나 삭제하는 명령은 실행하지 않았다.

## 실행 결과

| 요청 흐름 | 실제 검증과 판정 |
| --- | --- |
| 1. 관리자 회차 시작 | JWT 관리자 API 시작, 같은 키 재시도, 미인증·비활성 관리자 거부 통과. 실제 Chromium 관리자 화면의 토큰 입력·회차 시작도 통과. |
| 2. 여러 익명 참여자 | 서로 다른 쿠키의 HTTP 참여자 8명 생성·동시 요청 통과. 실제 headless Chromium에서 관리자 1개와 익명 참여자 3개의 독립 BrowserContext를 사용했고 익명 쿠키가 모두 다름을 확인. 서로 다른 브라우저 엔진 검증은 아님. |
| 3. 개인·도시·지역 일관성 | 8명 × 중복 2요청 중 201 8개, 재응답 200 8개. 개인 점수 각 `(1,1)`, 응답 수 1, 도시 version `8`, 행복/안전/청결 `58/66/74`, 지역 오염 `CENTER=0`, `RIVER=88`, 가중 전체 오염 `176/3`, 지역 실제 적용량 합 28 검증 통과. |
| 4. Unity 화면 반영 | 도시 API의 실제 응답까지 검증. Unity 실행·화면 렌더링은 미실행. |
| 5. 재시도·중복 반영 방지 | 동일 키 동시 요청, 다른 키로 같은 상황 재제출, 같은 키의 다른 선택, 서버 재시작·마감 후 기존 성공 요청 재시도 통과. |
| 6. 새로고침 복원 | 본인 응답 API의 선택 복원 및 공개 필드가 `situation_id`, `choice_id`, `received_at`뿐임을 검증. 실제 Chromium reload 후 제출 완료 버튼·선택된 라디오·변경 불가 상태 복원 통과. |
| 7. 마감·종료 경계 | HTTP 요청 후 DB 잠금 대기로 cutoff를 넘긴 새 선택 거부, 응답 원장 0건, `accepting_choices=false`, 종료 후 새 선택 거부 통과. |
| 8. 결과 한 번 확정 | 동시 수동 종료 4건, 동시 자동 reconcile 3건, 수동/자동 종료 경쟁 및 종료 후 선택 요청 경쟁 통과. 최종 결과 1행이며 재시도 후 전체 결과 행 불변 확인. |
| 9. 본인 결과만 조회 | 확정 전 409, 미참여자 결과 null, query의 임의 participant_id로 소유자 변경 불가 검증. Chromium의 서로 다른 참여자 화면에 질서 축 `1`과 `-1`이 각각 표시되고 미참여자는 결과 없음 표시. |
| 10. 재시작·통신 장애 | Next.js 프로세스를 실제 종료하고 연결 실패 확인 후 재시작. 저장된 도시·재시도 결과 유지, DB에 남은 CLOSING을 재시작 후 reconcile로 확정하는 검증 통과. Chromium offline/online 전환과 서버 커밋 후 응답만 유실되는 장애에서 복구 통과. PostgreSQL 실제 stop/start 중 health 503, 복구 후 200 및 동일 도시 응답 확인. Unity 복구는 미실행. |
| 11. 다음 회차 격리 | 같은 참여자 쿠키로 새 회차 응답 목록이 비어 있음, 새 회차 ID·version `0`·초기 행복 50 확인 통과. 같은 Chromium 참여자 컨텍스트로 새 회차 참여 화면을 열면 선택이 초기화되고 제출 가능 상태임을 확인. |

## 발견한 문제와 수정

1. **브라우저의 정상 요청이 INVALID_ORIGIN으로 거부됨.** 실제 Chromium에서 관리자 시작 POST가 403으로 실패했다. `checkOrigin`이 Next.js가 정규화한 내부 URL과 브라우저 Origin을 비교한 것이 원인이었다. `web/src/lib/api.ts`에서 요청 Host를 반영해 목적지 origin을 계산한다. 외부 Origin과 `Sec-Fetch-Site: cross-site` 차단은 유지하며 회귀 검증을 추가했다.
2. **접수 마감과 결과 확정을 같은 상태로 안내함.** 참여 화면이 `accepting_choices=false`만으로 “최종 결과를 확정하고 있습니다”를 표시했다. RUNNING의 접수 마감, CLOSING의 결과 준비, FINALIZED의 결과 확정을 구분하도록 수정했다.
3. **Windows 격리 실행기가 DB 시작 후 정지함.** PostgreSQL 자식 프로세스에 상속된 출력 파이프 종료를 기다렸다. `pg_ctl` 프로세스 종료를 기다리고 파이프를 정리하도록 수정했다. 중단된 임시 클러스터만 명시적으로 중지한 뒤 새 클러스터에서 재실행했다.
4. **명시적으로 접수 마감된 회차를 종료하지 못함.** 격리 DB에서 접수 마감 시각을 저장한 후 실제 관리자 화면으로 종료했을 때 DB의 `Admission cannot reopen` 제약으로 실패했다. 수동 종료가 기존 시각을 현재 시각으로 덮어썼고, 자동 종료에도 같은 위험이 있었다. 두 경로에서 `LEAST`로 기존 마감·자동 cutoff·수동 종료 시각 중 유효한 가장 이른 값을 보존하도록 수정했다. 브라우저 종료 및 수동/자동 경쟁 테스트에서 기존 마감 시각 불변을 검사한다.

## 최종 실행 기록

- `npm run build`: 최종 수정 후 통과. 최초 샌드박스 실행은 TypeScript 자식 프로세스 생성 `EPERM`으로 실패했고, 승인된 실행에서 빌드 완료. 이후 한 차례 `.next/static` 파일 잠금 `EPERM`은 동일 빌드 재시도로 해소됐다. 저장소 외부 `C:/Users/sonmi/package-lock.json` 무시 경고는 남았으나 빌드는 성공했다.
- `npm run lint`, `npx tsc --noEmit`: 통과.
- `tests/session-lifecycle.integration.mjs`: 격리 실행기 안에서 통과.
- `tests/isolated-flow.mjs`: 계산·중복·마감·종료 경쟁·Next.js 재시작·회차 격리 검증 통과.
- `tests/isolated-browser.mjs`: 기존 Playwright 1.60.0과 설치된 Chromium 사용. 관리자 시작·종료, 익명 컨텍스트 3개, 커밋 후 응답 유실·복구, reload, offline/online 복구, 마감 안내, 서로 다른 개인 결과, 새 회차 초기화 통과. 페이지 JavaScript 오류 0건.
- PostgreSQL 중단/복구: Next.js를 재시작하지 않은 상태에서 health 503 → 200, 장애 전후 도시 응답 전체 동일 확인.
- 최종 실행 `node tests/isolated-runner.mjs`: **exit code 0**, `PASS isolated suite. No development connection or data mutation.` 출력 및 소유 서비스 종료 확인.
- 최종 클러스터 보관 경로: `C:/Users/sonmi/AppData/Local/Temp/simus-integration-Ssbm44`. PostgreSQL 로그는 그 아래 `postgres.log`. 이 폴더는 개발 DB가 아니며 테스트 후 중지돼 있다.
- 실패 이력도 통과와 구분한다: 초기 실행기 정지, 브라우저 시작 403, 접수 마감 후 종료 거부를 실제 발견했고 수정했다. 최종 전체 재실행에서는 모두 통과했다.

## 미실행 및 남은 검증

- 이 환경에서 Unity Editor 실행 파일을 찾지 못했고 저장소에도 `ProjectSettings/ProjectVersion.txt`와 실행 장면이 없다. **Unity C# 컴파일, EditMode 테스트, Play Mode 실제 API 수신·도시 화면 변화, Unity 프로세스 재시작·네트워크 복구는 실행하지 않았다.** API 응답과 C# 코드 검토를 Unity 실행 성공으로 간주하지 않는다.
- Unity Editor/데스크톱과 WebGL의 동일 출처 배포, CORS·TLS·LAN 단절, 실제 전시 장비 복구는 미실행이다.
- Firefox·WebKit·모바일 실기기, 서로 다른 PC 및 실제 네트워크 장비 단절은 미실행이다. 브라우저 단절은 Chromium 네트워크 에뮬레이션, DB 단절은 격리 PostgreSQL 프로세스 중지로 검증했다.
- 자동 종료는 인증된 reconcile API를 실제 호출했다. 운영 스케줄러의 설치·주기·프로세스 재기동은 검증하지 않았다.
- `db/verify_schema.sql`과 개발 seed를 전제로 하는 `tests/api.integration.mjs`는 이번 재개 실행에서 별도 실행하지 않았다. 실제 실행한 통합 검증은 위 파일들이다.
- DRAIN 정책의 행 잠금·DB 시각 기준을 검증했다. 모든 부하 조건에서 지정 시각 이후 커밋이 절대 발생하지 않는다는 보장은 이 결과에 포함되지 않는다.

## 재실행

`web/`에서 `npm run build` 후 `npm run test:integration`을 실행한다. Windows PostgreSQL 바이너리 기본 위치는 `C:/Program Files/PostgreSQL/18/bin`이며 다르면 `TEST_PG_BIN`으로 지정한다. PostgreSQL 서비스를 설치하거나 개발 DB를 시작할 필요는 없다.

브라우저 검증은 기존 Playwright 모듈과 Chromium 실행 파일을 다음처럼 명시한다. 이 경로는 이번 환경에서 사용한 경로이며 다른 PC에서는 실제 설치 경로로 바꾼다.

```powershell
$env:TEST_PLAYWRIGHT_MODULE='C:/Users/sonmi/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs'
$env:TEST_CHROMIUM_EXECUTABLE='C:/Users/sonmi/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe'
npm run test:integration
```

`TEST_PLAYWRIGHT_MODULE`이 없으면 브라우저 검증은 명시적으로 SKIP된다. HTTP 테스트 통과만으로 브라우저까지 통과했다고 해석하지 않는다. 실제 브라우저 테스트 코드는 `web/tests/isolated-browser.mjs`에 있다.
