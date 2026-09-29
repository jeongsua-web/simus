# 4~8단계 통합 검증 결과

검증일: 2026-09-29, macOS ARM64, Node 25.8.1, Next.js 16.3.5, PostgreSQL 18, Unity 6000.3.24f1.

## 통과한 항목

- `npm run lint`, `npm run build`: 통과. TypeScript 및 프로덕션 빌드 완료.
- 기존 격리 API 검증: 관리자 권한, 8명 동시 선택·중복 반영 방지, 도시·개인·지역 계산, 마감 경계, 자동/수동 종료 경쟁, 결과 불변, 다음 회차 격리, 서버 재시작·CLOSING 복구 통과.
- 기존 Chromium 검증: 관리자 시작/종료, 독립 참여자 3개 컨텍스트, 응답 유실, 새로고침, offline/online 복구, 결과 분리, 다음 회차 초기화 통과.
- 새 회차 생성 API: 무인증 거부, 입력 범위, 동일 키 동시 생성 201/200, 다른 내용 409, 런타임 데이터 제외 복사, 만료된 DRAFT의 실제 시작 기준 300초 재계산 통과.
- 추가 모바일/관리자 Chromium 검증: 390px 가로 넘침 없음, 관리자 회차 생성·길이·시작·종료, 서버에 전달되지 않은 선택의 localStorage 보존·새로고침 후 동일 키 재시도, 회차가 바뀐 뒤 원래 요청 재시도, 본인 과거 결과·최종 도시 표시 통과. 페이지 JS 오류 없음.
- 실제 PostgreSQL stop/start: Next.js가 DB 장애 중 503, 복구 후 200과 동일 도시 상태를 반환함.
- Unity 컴파일·통합 장면 생성: `NeighborhoodIntegration.Build` 성공. 원본 맵 위 NPC 경로 34개 지점 raycast 통과.
- Unity 실제 Play/HTTP: 동일한 격리 PostgreSQL을 사용하는 Next.js API에서 회차·버전·행복도·청결도를 받아 예상 응답과 일치함. RUNNING에서 미리보기 NPC 이동 확인. 이후 **테스트에서 FINALIZED 스냅샷을 주입**해 이동 정지와 RUNNING 역행 거부 확인. 이 종료 검사는 실제 관리자 종료의 Unity 화면 반영을 대체하지 않음.
- 이식한 WASTE 시연 SQL: 별도 격리 재실행에서 실제 적용·can_start=true·원본 선택 점수(1,1,3,5)/(0,0,0,0)·배율 0.1 확인 통과. 이 재실행은 브라우저/Unity를 SKIP했으며 앞선 전체 실행의 해당 검증 결과와 구분한다.
- Unity EditMode: **10/10 통과**, 실패·skip 0. [원본 XML](verification/unity-editmode-2026-09-29.xml).

전체 격리 실행은 exit 0, `PASS isolated suite. No development connection or data mutation.`으로 종료했다.
주요 실행 DB: 임시 `simus-integration-qGfdNp`. 시연 SQL 추가 확인 DB: `simus-integration-tcIUJ8`. 테스트가 만든 DB·웹 프로세스는 종료했다.
Unity HTTP 로그: 임시 `simus-unity-http-zwd7hc/unity.log`의 `SIMUS_INTEGRATED_PLAY_PASS`.

## 발견 후 수정한 문제

- 첫 Unity 샌드박스 실행은 패키지 매니저 로컬 소켓 EPERM으로 실패했다. 그때 시작된 라이선스 클라이언트가 mutex를 점유한 채 남아 후속 실행의 라이선스·패키지 초기화를 막았다. 해당 테스트 소유 프로세스만 확인·종료한 뒤 재실행해 컴파일·장면 생성·Play·EditMode가 통과했다.
- 온라인 복귀 자동 복원이 추가되면서 기존 테스트의 수동 재시도 클릭 시점에 버튼이 사라졌다. 테스트를 자동 복원 완료를 확인하도록 갱신했고 재실행 통과했다.
- 새로고침 뒤 미확인 선택이 남아도 선택 라디오가 복원되지 않으면 재시도 버튼이 비활성화될 수 있었다. 원래 선택 ID까지 복원하고 실제 응답 유실 브라우저 테스트로 확인했다.

## 범위와 제한

이번 검증은 새 임시 DB만 사용했다. 기존 개발/운영 DB, Python 사본의 DB, 외부 배포는 변경하지 않았다.
실제 휴대폰·전시 LAN·QR, 운영 스케줄러·HTTPS 배포, Windows/WebGL 빌드·성능 측정은 수행하지 않았다.
NPC는 참여자 연동 기능이 아닌 미리보기다. 최종 이미지·학과·외부 알림 등 미구현 범위는 [통합 안내](stage4-8-integration.md)에 기록했다.

## 재현

`web/`에서 `npm ci`, `npm run build`, `npm run test:integration` 순서다.
`TEST_PG_BIN`으로 PostgreSQL bin 폴더를 지정한다. Windows 기본 경로와 macOS Homebrew 경로를 지원한다.
브라우저 검증은 `TEST_PLAYWRIGHT_MODULE`(playwright/index.mjs), `TEST_CHROMIUM_EXECUTABLE`을 지정한다.
Unity 실연결 검증은 `TEST_UNITY_EDITOR`를 Editor 실행 파일로 지정한다. 미지정 시 해당 범위는 SKIP으로 표시된다.

Unity EditMode는 Test Runner 또는 `-runTests -testPlatform EditMode -testResults <파일>`로 재현한다.
