# Phase 1 모바일 화면 fixture 검증

2026-10-20. 결과: **PASS — 브라우저 fixture 범위 한정**.

실제 Next.js `/participate` React 화면을 Chromium headless에서 실행했다. API와 Unity iframe은 Playwright fixture이며 실제 Unity 런타임이나 서버 이벤트 발생기의 결과가 아니다. 구현 소스는 수정하지 않았다.

## 격리와 실행

- Next.js 16.3.8 개발 서버: `http://127.0.0.1:3137`.
- 모든 브라우저 `/api/**` 요청을 fixture로 응답했다. 미지정 API는 서버로 전달하지 않고 차단한다. 이번 실행의 미지정 요청은 0건이다.
- QA 서버의 `DATABASE_URL`은 `postgresql://fixture_blocked:fixture_blocked@127.0.0.1:1/fixture_blocked`로 덮었다. 서버 자체 ticker의 DB 시도는 `ECONNREFUSED 127.0.0.1:1`로 차단됐다. 실제 DB 쓰기·마이그레이션·배포는 수행하지 않았다.
- 최초 서버 기동 직후 페이지 탐색 전에 위 차단 환경으로 재시작했다. 모든 브라우저 검증은 차단 환경에서 진행했다. 검증 완료 후 해당 서버를 종료했다.
- 기존 설치 Playwright와 Chromium 1223을 사용했다. 실행 종료 코드 0, 브라우저 `pageerror` 0건.

재현 스크립트: [phase1-mobile-fixture.mjs](../../../web/tests/phase1-mobile-fixture.mjs). `TEST_PLAYWRIGHT_MODULE`, `TEST_CHROMIUM_EXECUTABLE`에 기존 설치 경로를 전달하고 차단 환경의 Next 서버를 먼저 실행한다. 이 스크립트는 실제 API/DB 통합 테스트의 대체물이 아니다.

## 확인 결과

| 항목 | 결과와 범위 |
|---|---|
| WAITING | 선택지 없이 도시 관찰 안내 표시, bridge fixture BOUND 후 iframe 표시 |
| 60초 유도 상태 | 서버가 `GUIDING`을 응답한다고 가정했을 때 이동 안내 표시, 선택지 없음. 실제 60초 경과나 서버 유도 경로는 검사하지 않음 |
| 90초 초과 상태 | `GUIDING` + `overdue:true`에서 도착 지연 안내 표시, 강제 선택지 없음. 실제 90초 기록 로직은 검사하지 않음 |
| ACTIVE | LOCATION 응답에 기존 상황·선택지 표시. 반복 polling에도 같은 이벤트 카드 1개 유지. DB 중복 생성 방지의 검증은 아님 |
| 선택 오류와 재시도 | fixture 503 응답 후 선택 잠금·재확인 버튼·localStorage pending 유지. 재시도에서 event_id, choice_id, request_key 등 전체 payload 동일 |
| 선택 성공 이후 | fixture 성공 응답과 응답 기록 조회로 1회 응답 표시, pending 삭제, WAITING으로 전환 |
| 카메라 연결 UI | 대기→활성→재시도→완료 동안 iframe src/bridge_id 유지. SET_ZOOM→ZOOM_CHANGED fixture 왕복으로 125% 표시. 실제 Unity 카메라 추적·정지·재개는 검사하지 않음 |
| 360/390/430px | 긴 제목·본문·선택지에서 가로 overflow 없음, 도시와 패널 겹침 없음, Enter로 패널 접기/펼치기, 제출 버튼 스크롤 접근 가능 |
| CLOSED | 접수 마감 안내, 선택지 없음 |

결과 원본: [mobile-fixture-result.json](mobile-fixture-result.json). 동일 request_key의 재시도 payload 2개와 검사 목록을 포함한다.

화면 증거:

- [390px 도착 지연](mobile-overdue-390.png)
- [390px 선택 재확인](mobile-retry-390.png)
- [360px 긴 내용](mobile-active-long-360.png)
- [390px 긴 내용](mobile-active-long-390.png)
- [430px 긴 내용](mobile-active-long-430.png)

390px 도착 지연·선택 재확인·긴 내용 PNG를 직접 열어 확인했다. 화면 상단의 Unity 영역은 명시적인 HTML bridge fixture이며 도시 렌더링을 증명하지 않는다. 하단 Next 개발 표시도 제품 UI 변경이 아니다.

## 남은 검증과 기존 테스트 주의

- **BLOCKED / 실제 서버 통합 미검증:** 실제 DB의 8개 장소 매핑, 위치 판정·최초 진입 100% 발생, 이탈·재진입·재접속 중복 방지, 선택·도시/개인 스탯 원장, 실제 60/90초 서버 처리. 이번 역할에는 실제 DB 쓰기가 허용되지 않았다.
- **NOT TESTED:** 실제 Unity WebGL 렌더링·충돌·카메라 추적, 휴대폰 실기기, 200% 글자 확대, 관리자 위치 편집 화면. 별도 Unity/서버 QA 결과와 합치지 않는다.
- `web/tests/mobile-panel.mjs`의 GUIDING 제목은 이전 문구를 기대한다. `web/tests/isolated-browser.mjs` 등은 91초 뒤 DEADLINE 강제 발생을 기대하는 기존 통합 fixture라 현재 Phase 1 정책과 맞지 않는다. 실행하지 않았고 구현 소스 수정 금지 범위에 따라 기존 파일도 변경하지 않았다.
- lint/TypeScript 검사는 root 에이전트 담당이며 이 결과에는 포함하지 않는다.
