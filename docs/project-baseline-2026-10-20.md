# 10월 20일 완료 기준 — 통합 현황과 결정 대장

조사일: 2026-09-29(KST). 조사 대상 HEAD: `9552aca`, 통합 커밋: `6df8684`.
이번 작업은 소스·SQL·자산·Git 이력·기존 검증 기록의 대조다. 런타임 테스트를 새로 실행하거나 실제 DB의 마이그레이션 적용 상태를 확인하지 않았다.

> 사용자 답변 반영: [확정 사항·학과 42개·남은 결정](project-decisions-2026-09-29.md). 아래 구현 조사는 유지하며 제품 결정은 이 후속 기록을 함께 따른다. 추가 답변으로 웹 푸시·타기기 결과 조회, 30상황/91선택지, 3일/3회차가 확정됐다. 이메일·사용자 결과 다운로드는 선택 범위이며 종료 후 선택 불가와 iPhone 푸시 신청자의 홈 화면 추가 안내도 승인됐다.

## 1. 확인된 기준과 확정 절차

**실행·개발 기준은 본 저장소의 `web/` + `db/` + `unity/` 하나다.** 이미 수행한 통합을 다시 계획할 필요가 없다. 루트 및 사본 README와 통합 커밋이 이 기준을 뒷받침한다.

- `web/`: Next.js 화면 및 서버 API. 별도 루트 `server/`는 없으며 서버 구현은 `web/src/app/api/`, `web/src/lib/`에 있다.
- `db/`: 본 서버용 001→002→003 마이그레이션. 기존 001/002 DB에는 003을 추가 적용하는 절차다. 실제 개발·운영 DB 적용 여부는 별도 확인한다.
- `unity/`: Unity 6000.3.24f1, 실행 장면 `Assets/Scenes/NeighborhoodLive.unity`, 공개 `/api/city-state` 연결.
- `simus-stage4-8/`: 원본 코드·맵·검증 자료·모의 실험 보관. 현재 231개 파일이 Git 추적 대상이며 미추적 사본이 아니다. 후속 제품 변경은 본 경로에서만 진행하고 사본은 비교·회귀 근거로 사용한다.
- 사본 Python API·프록시를 본 서비스와 함께 실행하거나 사본 SQL을 본 DB에 적용하지 않는다. Python DB의 참여 기록 이관은 수행되지 않았다.

**사용자 확인:** 2026-10-20 시연·운영 배포, F01~F27 모두 필수, Android/iOS 웹, PostgreSQL, 정수아 총괄(주 5시간), 손민경 Blender 제작, 회차당 약 500명, 학과 목록 42개. **미결정:** 상세 담당·손민경 가용 시간, 최소 지원 버전·현장 장비, 호스팅·백업, 동시 접속, 종료·콘텐츠·학과 수집·알림·NPC 계약. 코드에 기본값이 있다는 이유로 제품 결정으로 간주하지 않는다.

확정 순서:

1. 이 문서의 현황표와 정책 차이를 검토한다. 기준 프로젝트는 기존 통합 결정을 유지한다.
2. 9/30까지 아래 D01~D10에 결정자·선택값·결정일을 기입하고 W01~W10에 실명 담당을 배정한다.
3. 변경된 제품 규칙은 `requirements.md`, API/DB/Unity 문서에 함께 반영한다. 결정 전에는 기존 동작을 변경하지 않는다.
4. 각 작업은 구현뿐 아니라 표의 인수 증거를 남긴다. 10/16 기능 동결, 10/17~19 현장 검증, 10/20 최종 인수로 진행한다.

## 2. 판정 기준

| 표기 | 의미 |
|---|---|
| 구현 완료 | 명시한 기능에 코드와 해당 범위의 기존 통과 기록이 있음. 운영 인수 완료와는 구분 |
| 부분 구현 | 일부 흐름만 존재하거나 요구사항 전체를 충족하지 못함 |
| 미구현 | 본 제품 실행 경로에 기능이 없음. 제안·모의 실험은 제품 구현으로 계산하지 않음 |
| 검증 필요 | 구현/설정은 있으나 요구하는 환경 또는 종단 흐름의 증거가 부족함 |

한 항목에 여러 판정이 있으면 구현과 운영 검증 범위를 각각 표시한 것이다. 기존 검증은 [9/29 통합 기록](stage4-8-validation.md), [9/17 통합 기록](integration-report.md), [9/18 시연 기록](demo-validation.md)을 구분해 사용한다.

## 3. 두 구현 비교

이 표의 경로는 저장소 루트 기준이다. `사본/`은 `simus-stage4-8/`를 뜻한다.

| 항목 | 본 저장소 통합 후 | 개발 사본 | 판정·근거 |
|---|---|---|---|
| 서버·웹 | Next.js/React 참여·관리자·결과 화면, Node API | Python/psycopg API + 정적 JS + gateway | **구현 완료**. `web/package.json`, `web/src/app/`, `사본/prototype/server.py`, `client_gateway.py`, `client/` |
| 참여자 인증 | `simus_participant`, HttpOnly/Lax, 운영 Secure, 30일, DB 해시·만료·폐기 검사 | `simus_visitor`, HttpOnly/Strict, DB 해시; 별도 join | **구현 완료**, 자격 호환/이관 없음. `web/src/lib/api.ts`, `web/src/app/api/participants/route.ts`, `사본/prototype/server.py`, `store.py` |
| 관리자 인증 | RS256 JWT 서명·issuer·audience·sub·exp·iat와 활성 DB 관리자 확인 | 공용 키 로그인 후 프로세스 관리자 세션 쿠키 | 본 인증 **구현 완료**, 실제 발급자/운영 로그인 **검증 필요**. `web/src/lib/admin-auth.ts`, `사본/prototype/server.py` |
| 참여·선택·복원 | 원래 회차·상황·선택·request_key 저장/복구, 중복 방지, 본인 응답 조회 | 대응 UI·멱등 선택 구현 | **구현 완료**. `web/src/app/participate/{useParticipation.ts,pending.ts}`, `web/src/app/api/choices/route.ts`, `사본/prototype/client/mobile/`, `store.py` |
| 가입 시점·미응답자 | 전역 익명 자격 생성 후 첫 성공 선택에서 회차 가입 | `/api/join`에서 회차 가입 및 alignment 생성 | 차이 확인. 본 코드에서 단순 접속자는 회차 결과 대상이 아님. NPC/학과 도입 시 가입 계약 **결정 필요**. 위 참여/선택 코드, `사본/prototype/store.py` |
| 개인·도시 결과 | 본인 history, 해당 회차 확정 도시 수치·성향 | state/me에 과거 회차 및 본인 결과 | 수치/성향 **구현 완료**, 도시 이미지·캐릭터 **부분 구현**. `web/src/app/result/[id]/ResultClient.tsx`, `web/src/app/api/sessions/[id]/result/route.ts`, `사본/prototype/client/mobile/app.js` |
| 다음 회차 | DRAFT/FINALIZED 콘텐츠 복사→DRAFT→시작. 생성 키 멱등, 실제 시작 기준 진행 시간 | start가 WASTE 콘텐츠와 새 회차를 생성·시작. 시작 멱등 키 없음 | **구현 완료**. `web/src/lib/session-creation.ts`, `session-lifecycle.ts`, `web/src/app/admin/CreateSession.tsx`, `사본/prototype/store.py` |
| 콘텐츠 편집 | 준비 회차 복사 가능, 개별 상황·선택지 편집 UI 없음 | start에서 WASTE 1상황·2선택 생성; content.py 5상황은 legacy 자료 | 복사 **구현 완료**, 편집 UI **미구현**, 최종 콘텐츠 **부분 구현**. `db/seed_neighborhood.sql`, 위 생성 코드. 편집 UI의 필수 여부는 D01 |
| DB | 001의 18테이블 + 003의 생성 요청 1테이블. 002의 상태 전이·쓰기·결과 완전성 보호, 관리자 작업 원장 | 초기 17테이블 + runtime의 session_closures. 별도 컬럼/판정 함수/커밋 게이트 | 각 구현 존재, 직접 SQL 혼용 불가. `db/001_initial_schema.sql`, `002_session_lifecycle.sql`, `003_session_creation.sql`, `사본/outputs/sql/01_schema.sql`, `사본/prototype/sql/04_runtime.sql` |
| 종료·복구 | DRAIN, 회차 행 잠금, CLOSING 저장 후 원자적 FINALIZED; 인증 reconcile 호출 필요 | 별도 종료 승인 행·advisory 커밋 게이트·지연 트리거, 서버 tick 및 조회에서 정리 | **부분 구현**(원문 취소 요구와 차이). `web/src/lib/session-lifecycle.ts`, `api.ts`, `사본/prototype/store.py`, `sql/04_runtime.sql` |
| Unity 맵 자산 | Neighborhood.fbx, 원본 장면, 32재질·셰이더 보존; 연결 장면 새 폴러 사용 | 원본·연결 장면, export 도구·GLB·렌더 기록 | 맵 **구현 완료**. 이번 바이트 비교: FBX·원본 장면·동일 경로 32재질·셰이더 동일, Live 장면 다름. `unity/Assets/{Art,Scenes,Materials,Shaders}`, 사본 `prototype/unity/SIMUSPrototype/Assets` |
| Unity API/HUD | `/api/city-state`, version 문자열 검증, 역행/이전 회차 차단, 0.5초 폴링 | `/api/state`, round 구조의 CityLiveClient | **구현 완료**, 실제 종료→Unity 종단 **검증 필요**. `unity/Assets/SIMUS/Runtime/{CityStatePoller.cs,Core/CityStateStore.cs}`, 사본 `Assets/Scripts/CityLiveClient.cs` |
| NPC·도시 연출 | 캡슐 3개·로컬 elapsed 이동, CLOSING/FINALIZED 정지, 임시 임계값 | 미리보기 이동, 모의 서버+Canvas 본인 추적 실험 | 연출 **부분 구현**, 실제 참여자 NPC **미구현**. `NeighborhoodLife.cs`, `NeighborhoodIntegration.cs`, `사본/prototype/integration/npc_lab.py`, `client/lab/index.html` |
| 학과·외부 알림·오염 확산 | 제품 API/테이블/처리 없음 | contracts/API.md 제안, 확산 없음 | **미구현**. 본 API/스키마 목록, `사본/prototype/contracts/API.md`, `진행상태.md` |
| 배포 | 개발 Compose·환경 예제·운영 안내 | 로컬 실행 스크립트·프록시 | **검증 필요**. `compose.yaml`, `docs/demo-deployment.md`, `사본/시제품_테스트.command`. 실제 공개 서비스 배포 증거 없음 |

## 4. 요구사항별 완료 상태

인수 범위는 우선 F01~F27 전체를 유지한다. 범위 축소는 사용자 결정 전까지 반영하지 않는다. 아래의 ‘완료’도 실기기 인수까지 완료했다는 뜻은 아니다.

| ID | 현재 판정 | 근거와 남은 인수 조건 |
|---|---|---|
| F01 QR 참여 | 검증 필요 | 참여 URL 있음. 실제 HTTPS QR·휴대폰은 미검증 (`docs/stage4-8-validation.md`) |
| F02 개인 구분·유지 | 구현 완료 | 쿠키 인증·분리·복원 기록 (`web/src/app/api/participants/route.ts`, `web/tests/isolated-browser.mjs`). 쿠키 분실 복구는 미지원 |
| F03 상황·선택지 | 구현 완료 | WASTE 1개/2선택 기준 (`db/seed_neighborhood.sql`, `web/src/app/participate/SituationCard.tsx`). 전시 콘텐츠 수량 별도 |
| F04 선택 제출 | 구현 완료 | 안내·제출 UI/API (`SituationCard.tsx`, `web/src/app/api/choices/route.ts`) |
| F05 제출 상태 | 구현 완료 | pending 보존·성공/실패/재시도 (`web/src/app/participate/useParticipation.ts`, `web/tests/stage-browser.mjs`) |
| F06 재선택 차단 | 구현 완료 | 상황별 유일성·동일 키 재전송 (`db/001_initial_schema.sql`, `choices/route.ts`, `web/tests/isolated-flow.mjs`) |
| F07 개인 점수·비공개 | 구현 완료 | 서버 계산, 공개 응답에서 점수 제외 (`choices/route.ts`, `web/src/app/api/sessions/current/route.ts`) |
| F08 최종 성향·해석 | 구현 완료 | 규칙 스냅샷·본인 결과 (`web/src/lib/session-rules.ts`, `session-lifecycle.ts`, `web/src/app/result/[id]/ResultClient.tsx`) |
| F09 도시·지역 계산 | 구현 완료 | 배율·0~100 clamp·원장 (`choices/route.ts`, `web/tests/isolated-flow.mjs`) |
| F10 동시 누적 | 구현 완료 | 격리 8명 동시 검증. 운영 규모는 검증 필요 (`docs/stage4-8-validation.md`) |
| F11 Unity 수신 | 구현 완료 | 실제 Next/PostgreSQL HTTP Play 기록 (`docs/stage4-8-validation.md`, `CityStatePoller.cs`) |
| F12 Unity 수치 표시 | 구현 완료 | HUD·도시/지역 표시 (`unity/Assets/SIMUS/Runtime/CityStateDebugView.cs`, 같은 검증 기록) |
| F13 자동·수동 종료 | 부분 구현 | DRAIN API 통과, 원문 미완료 취소와 차이·운영 스케줄러 미설치 (`session-lifecycle.ts`, D03) |
| F14 연결 복구 | 부분 구현 | 브라우저/DB 복구 기록·Unity 재시도 코드. 전시 LAN 단절/복귀 실증 필요 (`web/tests/isolated-browser.mjs`, `CityStatePoller.cs`) |
| F15 오염 확산 | 미구현 | 현재는 선택이 해당 지역 수치만 갱신. 인접 그래프·주기/비율·확산 원장 필요 (`choices/route.ts`, `db/001_initial_schema.sql`) |
| F16 도시 외형 | 부분 구현 | 임시 안개·색·건물 표현. 최종 조건/자산 미확정 (`NeighborhoodLife.cs`, `unity/Assets/SIMUS/Runtime/CityVisualization.cs`) |
| F17 결과 알림 | 부분 구현 | 열린 화면 결과 확인만 가능. 외부 채널·동의·발송 없음 (`useParticipation.ts`, 사본 `contracts/API.md`) |
| F18 최종 도시·캐릭터 | 부분 구현 | 확정 수치/성향만 표시, 결과 이미지·캐릭터 없음 (`ResultClient.tsx`) |
| F19 개인 선택 시각 반응 | 부분 구현 | 제출 상태 피드백은 존재, 행동별 개별 연출 없음 (`SituationCard.tsx`, `NeighborhoodLife.cs`) |
| F20 관리자 종료 | 구현 완료 | JWT/활성 관리자·UI 확인·무권한 거부 (`web/src/lib/admin-auth.ts`, `web/src/app/admin/page.tsx`) |
| F21 새 회차 | 구현 완료 | 콘텐츠 복사·초기화·기록 격리 (`session-creation.ts`, `web/tests/stage-integration.mjs`) |
| F22 현재·과거 구분 | 구현 완료 | 본인 history·확정 스냅샷·Unity 회차 보호 (`participants/route.ts`, `result/route.ts`, `Core/CityStateStore.cs`) |
| F23 학과 선택 | 미구현 | 목록/회차별 소속/첫 선택 후 고정 없음 (본 DB/API, 사본 `contracts/API.md` 제안) |
| F24 학과 통계 | 미구현 | 분모·종료 후 공개·5명 제한 제안만 있음 (`docs/requirements.md` §4.1) |
| F25 본인 NPC 추적 | 미구현 | 모의 Canvas 실험만 있음. 본 서버 바인딩·공유 경로 없음 (사본 `contracts/NPC_제공방식_검토.md`) |
| F26 도시 위 선택 패널 | 미구현 | 현재 참여 화면은 수치·선택 카드. 실제 추적 도시 위 패널 없음 (`web/src/app/participate/page.tsx`) |
| F27 같은 도시·NPC | 부분 구현 | 도시 회차/수치는 공유, 참여자 NPC 식별·시간/위치 공유 없음 (`CityStatePoller.cs`, `NeighborhoodLife.cs`) |

## 5. API와 종료 정책의 기준

### 유지할 API 계약

| 용도 | 기준 API | 사본 대응 경로 |
|---|---|---|
| 익명 자격 | POST `/api/participants` | POST `/api/join` (회차 가입도 수행하므로 동등하지 않음) |
| 현재 상황 | GET `/api/sessions/current` | GET `/api/me?round=…`의 일부 |
| 도시 수치 | GET `/api/city-state` | GET `/api/state` |
| 선택 | POST `/api/choices` | POST `/api/choice` |
| 본인 응답·결과·이력 | GET `/api/sessions/{id}/responses`, `/result`, GET `/api/participants` | GET `/api/me?round=…` |
| 관리자 회차 | GET/POST `/api/admin/sessions`, POST `/{id}/start`, `/{id}/end` | `/api/admin/start`, `/api/admin/finish` |
| 자동 종료·복구 | POST `/api/internal/sessions/reconcile` | 프로세스 tick |

본 서버의 UUID `session_id`와 request_key, `{error:{code,message}}`, bigint 문자열 version, no-store, 본인 쿠키/JWT 권한 경계를 유지한다. 기존 클라이언트에 사본 round 응답을 그대로 연결하지 않는다. 신규 NPC·학과·알림 API는 미구현 계약으로 별도 설계한다. 상세는 [web/API.md](../web/API.md) 및 [통합 안내](stage4-8-integration.md).

### DRAIN의 실제 의미와 요구사항 차이

- 본 코드는 회차 행 잠금 후 신규 선택 처리 전·후에 `DB 현재 시각 < scheduled_end_at - admission_buffer`를 검사한다. 기본 버퍼는 5초다. 마감 정각부터 거부하며 이미 성공한 동일 요청은 종료 후에도 재조회한다.
- 종료는 같은 잠금을 기다린다. 앞선 선택이 완료 또는 롤백된 뒤 CLOSING을 저장하고 모든 최종 결과를 한 번에 확정한다. 수동 종료 HTTP 도착 순간의 미완료 선택을 강제 취소하지 않는다.
- 사본은 잠금 대기 전 접수 시각과 예정 종료 시각을 구분하고, session_closures·advisory 게이트·지연 트리거로 커밋 직전 취소 조건을 검사한다. 따라서 두 서버의 마감 동작은 완전히 같지 않다. 사본도 모든 물리 커밋 지연에서 엄격한 벽시계 보장을 증명한 것은 아니다.
- 본 서버 수동 종료가 RUNNING을 먼저 잠그면 MANUAL로 기록하고, reconcile이 먼저 CLOSING으로 만들면 AUTO를 유지한다. 사본은 예정 종료 이후 승인 요청을 AUTO로 분류한다. 종료 사유 분류도 차이가 있다.
- 초기 조사 당시 원문의 미완료 취소와 DRAIN은 달랐다. 후속 위임에 따라 DRAIN을 채택하고 `requirements.md` §2.1을 정합화했다. 사용자 확인에 따라 5초 선마감은 제거하고 종료 후 추가 선택은 금지한다. 현재 코드의 양수 버퍼 제약과 5초 기본값 변경은 후속 구현이다.
- 스케줄러가 없어도 시간 조건으로 접수는 마감되지만 자동 FINALIZED는 보장되지 않는다. 호출 주기·재시도·허용 확정 지연을 D03/D05에서 정한다.

## 6. 지원 환경·배포: 사실과 결정 항목

| 항목 | 확인된 사실 | 확정/검증할 값 |
|---|---|---|
| 웹 의존성 | Next 16.3.5, React 19.2.8 (`web/package.json`) | lockfile 기준 배포, 최종 런타임 고정 |
| Node/DB | 9/29 검증 Node 25.8.1·PostgreSQL 18. Compose는 Node 24·PostgreSQL 16 | 운영 버전 하나 선택 후 해당 조합 회귀. Compose 설정만으로 통과 판정 금지 |
| Unity | 6000.3.24f1, macOS ARM64 Editor 기록 | 전시 OS·CPU/GPU·해상도·빌드 타깃, 프레임률 목표 |
| 모바일 | Chromium 390px·독립 컨텍스트 검증 | 실제 Android/iOS 버전·브라우저·저사양 기준. 390px 검증은 실기기 지원 보증 아님 |
| 웹 배포 | Node 서버+PostgreSQL 필요, 개발 Compose 존재 | 호스팅·실제 도메인·HTTPS·프로세스 재기동·Origin/Host·Secure 쿠키 |
| Unity 배포 | 데스크톱 공개 GET, WebGL은 동일 출처 전제 | 데스크톱/WebGL 채택 여부. 모바일 WebGL은 지원 확정 아님 |
| 운영 | reconcile API·복구 로직 있음 | 스케줄러 설치/감시, 백업 주기·보관/복원 목표, DB 권한, 운영자·예비 장비 |
| 성능 | 사본 로컬 0.207초 1회, 본 통합 소수 참여 검증 | 동시 인원·회차 길이·응답 수, 선택→Unity 2초 목표의 측정 조건·통과 비율 |

현장 구성 후보는 HTTPS 웹/API+비공개 PostgreSQL, 전시 PC의 Unity 데스크톱, 휴대폰 동일 웹 출처다. 채택·구매·배포는 아직 확정되지 않았다.

## 7. 결정 대장

**부분 확정**, 목표 9/30. D01의 전 기능 필수, D02의 정수아 총괄/손민경 Blender 역할, D04의 Android/iOS 웹, D05의 PostgreSQL·비용 최소화·정수아 운영, D06의 회차당 500명 계획치, D08의 학과 목록은 확인됐다. 아래 표의 나머지 기본안은 승인되지 않은 추천안이다. 계정·장비·인력·제품 의도는 저장소에서 추론해 확정할 수 없다.

| ID | 결정할 내용 | 현재 기본안/선택지 | 결정 책임 역할 |
|---|---|---|---|
| D01 | 10/20 인수 범위·범위 변경 권한 | F01~F27 전체 유지. 콘텐츠 편집 UI 추가 필요 여부도 명시 | 프로젝트 책임자 |
| D02 | 팀원·주당/날짜별 시간·검토자 | 서버/웹, Unity, 콘텐츠, 운영/QA에 실명 배정. 1인일 경우 일정 재산정 | 책임자·전체 |
| D03 | DRAIN/엄격 취소, 종료 사유, 확정 지연 | 현 DRAIN 유지 제안. 승인 후 원문 수정; 엄격 취소면 별도 개발 | 책임자·서버 |
| D04 | 지원 OS/브라우저·전시 PC·NPC 렌더 | 재미·최적화 우선. Three.js 경량 3D와 Unity Web 실기기 비교 추천, 최종 방식 미정. Unity 타깃 검토 위임 | Unity·웹·운영 |
| D05 | 서버/도메인·Node/DB 버전·인증 발급자·운영 | 단일 배포 구성, reconcile 주기/실패 재시도·감시, 백업/복원 목표 | 서버·운영 |
| D06 | 동시 인원·회차 시간·콘텐츠 수·배율·수치 | 2명/300초/0.1은 사본 시험값. 초기값·9종 문구·도시 임계값·확산 그래프/주기/비율 확정 | 콘텐츠·서버·Unity |
| D07 | 회차 입장·NPC ID/시간/경로·무응답자 | 선택 이전 입장 필요 여부, map/path version·서버시각·종료 좌표 동결·본인/공개 분리 | 서버·웹·Unity |
| D08 | 학과 목록·집계 공개 | 기타/외부/선택안함, 첫 선택 후 고정, 응답자 분모, 종료 후 성향, 5명 미만 제한 기본안 | 콘텐츠·서버 |
| D09 | 알림 채널·동의·자격 분실·보관 기간 | 외부 알림의 채널/예산/계정, 회차별 중복 방지, 만료·쿠키 분실 시 결과 접근 방식 | 책임자·서버·운영 |
| D10 | 최종 도시·캐릭터 산출물과 인수 승인자 | 회차/version별 고정 자산 방식·담당·납품일, 개인 피드백 연출, 최종 승인자 | 콘텐츠·Unity·책임자 |

## 8. 작업 목록과 담당 배정안

완료 기한은 기존 달력 일정의 목표이며, D02 가용 인력 확인 전 확약하지 않는다. 정수아가 최종 책임·배포 운영을 맡고 손민경은 Blender 제작 역할이다. 나머지 실행 담당·검토자는 역할 기준 임시 배정이며 정수아의 주당 5시간에 전체 구현을 자동 배정하지 않는다.

| 작업 | 목표 기한 | 주담당 역할 / 협업 | 선행 조건·완료 증거 |
|---|---|---|---|
| W01 결정 대장·문서 정합화 | 9/30 | 책임자 / 전체 | D01~D10 선택값·실명·기한 기록, 종료/API 규칙 통일 |
| W02 시험 배포·HTTPS·QR·스케줄러 | 10/3 | 서버·운영 / 웹·Unity | D04~D05. 휴대폰→선택→Unity→실제 자동/수동 종료→결과→다음 회차 연결 |
| W03 가입/NPC DB·API·공유 시간/경로 | 10/7 | 서버 / Unity·웹 | D07. 서로 다른 2명의 ID, 재접속·회차 변경·종료 위치 불변 |
| W04 모바일 추적 도시·오버레이·Unity NPC | 10/7 | 웹·Unity / 서버 | W03·D04. 본인 식별·자동 카메라·패널·전면 복귀, 양 화면 위치 일치 |
| W05 학과 저장·고정·통계 | 저장 10/7, 집계 10/10 | 서버·웹 / 콘텐츠 | D08·가입. 동시 첫 선택/학과 변경 경쟁, 분모·비공개·소수 제한 API 검사 |
| W06 오염 확산·도시/선택 연출 | 10/10 | 서버·Unity / 콘텐츠 | D06. 선택 외 확산의 원장/version/결과 정합성 설계, 종료 뒤 갱신 0건 |
| W07 최종 도시·캐릭터·결과·외부 알림 | 10/10 | 웹·서버·콘텐츠 / Unity | D09~D10. 실제 동의/수신/결과 링크, 중복 발송 차단, 확정 자산 |
| W08 콘텐츠 확정·수치 조정·빌드/기기 | 10/13 | 콘텐츠·Unity / 웹·QA | D04·D06. 승인 콘텐츠, 전시 빌드와 지원 단말 측정 결과 |
| W09 회귀·부하·마감 경쟁·복구 | 10/16 | QA·서버 / 전체 | W02~W08. 확정 규모 부하, 응답 유실/재시작/DB 백업 복원, 중대 결함 0 |
| W10 현장 리허설·수정·인수 | 10/17~20 | 운영·책임자 / 전체 | 실제 휴대폰 2대 이상·LAN·2회차 연속·운영자 단독 실행. 10/19 코드/빌드/설정 고정, 10/20 승인 |

오염 확산은 현재 ‘선택 원장 수와 도시 version’ 정합성 검사에도 영향을 준다. 시각 효과만 추가해 F15를 완료 처리하면 안 된다. NPC는 선택 전 존재할 수 있어 현재 첫 선택 가입 구조 변경이 선행한다.

## 9. 검증 증거와 문서 충돌

- 9/29 기록: lint/build, 격리 API·Chromium·생성 API·복원·DB stop/start 통과. Unity 실제 API 수신과 EditMode 10/10. [XML](verification/unity-editmode-2026-09-29.xml)에서 passed=10, failed/skipped=0을 이번에 직접 확인했다.
- Unity 종료 정지는 FINALIZED 스냅샷 주입 검사다. 실제 관리자/자동 종료가 Unity 화면에 반영되는 전체 검사와 구분한다. `/tmp` 로그 경로는 당시 기록이며 현재 영구 보관된 원본으로 간주하지 않는다.
- 사본 9/24 기록: 서버 12/12, 2인 HTTP·모바일 390px·Unity Play·로컬 지연. 본 API 계약의 통과 증거를 대신하지 않는다.
- 실제 휴대폰·현장 QR/LAN·전시 빌드·운영 스케줄러·HTTPS·운영 규모 부하는 미검증이다. 전체 전시 완료율을 산출하지 않는다.
- `project-schedule-2026-10-20.md` 초기 현황의 ‘미통합·미추적·최신 b7ac890’은 과거 기록이다. 현재 통합 커밋과 Git 상태를 우선한다.
- `session-lifecycle.md` 본문 일부의 ‘관리자/결과 미구현·DB 전이 보호 없음’은 상단 갱신 이전 설계 설명이다. 002 SQL과 현재 서버가 이미 구현한다. 재개발 작업으로 잡지 않는다.
- `web/API.md`의 reconcile ‘최소 1분’과 `demo-deployment.md`의 ‘예: 1초’, 후자의 폴링 ‘약 2초’는 정합화 필요. 현재 Unity 기본/장면 폴링은 0.5초다. 운영 스케줄러 주기는 아직 없다.
- `unity/README.md`, 과거 검증 문서의 Editor/장면 부재는 당시 기록이다. 현재 존재 및 9/29 검증과 구분한다.

이번 조사 완료 조건은 비교·근거·결정 대장 작성이다. 최종 제품 범위·인력·지원 환경의 확정 완료 조건은 D01~D10 기록과 실명 배정이며, 아직 충족되지 않았다.
