# 모바일 선택 패널·복구 검증 — 2026-10-09

## 변경

- 대상: `web/src/app/participate/{page.tsx,participate.module.css,SituationCard.tsx,useParticipation.ts,pending.ts}`.
- 도시 안내와 선택 패널을 같은 도시 카드 안의 독립된 흐름 영역으로 배치했다. 절대 위치·높이 제한·중첩 스크롤을 없애 긴 안내와 선택지가 서로 가리지 않게 했다. 패널 접기와 이전/다음 탐색은 유지한다.
- 긴 연속 문자열 줄바꿈, 라디오 크기 유지, 44px 이상 탐색 버튼, 확대된 버튼 문구의 세로 여유를 적용했다.
- 상황이 없는 회차는 잘못된 `1 / 0` 탐색 대신 준비 안내와 상태 새로고침을 표시한다. 마감 버튼과 미확인 제출의 재확인 안내를 명시한다. 전체 응답 완료에는 기존 결과 상태 확인 동선을 유지한다.
- 이전 회차 재확인의 메시지를 별도 상태로 보관하고, 성공 시 현재 회차와 일치할 때만 현재 응답에 반영한다. 상황 ID가 같아도 이전 회차 요청을 현재 선택 제출 경로에서 재사용하지 않는다.
- 조회·제출에 15초 제한을 추가했다. 제출 확인 시간 초과는 실패 확정으로 처리하지 않고 보관된 동일 요청으로 재확인한다. 손상된 저장 데이터는 삭제하지 않고 운영자 문의를 안내한다.

UnityCity.tsx, unity-bridge.ts, Unity 코드, 결과 화면은 이 작업에서 수정하지 않았다. 작업 시작 전/진행 중 다른 담당의 변경이 공유 작업 트리에 있으므로 전체 git diff를 이 작업의 변경으로 해석하지 않는다. 위치 자동 노출·지도 좌표·전시 에셋 변경은 없다.

## 브라우저와 실행 환경

- macOS, Playwright, 설치된 Chromium headless shell revision 1223.
- 뷰포트: 360×740, 390×740, 430×740 CSS px. 기본 글자와 루트 글자 크기 200% 각각 검사. 브라우저 페이지 줌이나 iOS 시스템 글자 확대를 대체하는 실기기 검사는 아니다.
- `web/tests/mobile-panel.mjs`: 실제 참여 페이지에 API 응답의 제목·본문·선택지만 긴 시험 문자열로 바꿔 검사. 새 전시 지도 데이터와 무관하다.
- 로컬 포트 실행은 샌드박스에서 EPERM으로 차단되어 승인된 격리 실행을 사용했다. Playwright 기본 브라우저 revision 1234가 없어 기존 설치된 1223 경로를 명시했다.

실행 명령(저장소의 `web`에서):

```sh
npm run lint
npm run build
TEST_PLAYWRIGHT_MODULE=/Users/jeongsua/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs TEST_CHROMIUM_EXECUTABLE=/Users/jeongsua/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell npm run test:integration
```

## 검증 결과

| 항목 | 결과/근거 |
|---|---|
| 3개 폭 × 기본/200% 글자, 긴 상황·선택지 | 통과. 문서 가로 넘침 없음, 도시와 패널 경계 비중첩, 제출 버튼까지 스크롤 가능 |
| 포커스·패널 | 통과. summary에 키보드 Enter로 접기/펼치기, 제출 버튼 실제 포커스 및 뷰포트 접근 검사 |
| 제출 중 연타 | 통과. 같은 이벤트에서 8회 클릭해도 요청 1회; DB 응답 수 검증 |
| 응답 유실·재시도·새로고침 | 통과. 서버 저장 후 응답 유실과 서버 미도달 요청 모두 복구; 동일 request_key·선택 유지 |
| 오프라인·온라인 | 통과. 연결 오류의 재시도 UI, 온라인 이벤트로 응답 상태 복구 |
| 마감·전체 응답 완료 | 통과. 마감 안내, 완료 버튼 및 응답 복원. 서버 마감 경계·동시 처리·중복 반영 방지 통합 검사 통과 |
| 회차 전환 | 기존 통합 검사에서 원래 회차/요청 번호 재전송 및 새 회차 도시 version=0 확인 |
| 빈 회차·이전 회차 재확인 직후 상태 | 통과. 추가 회귀 검사: 상황 없음 안내/새로고침, 다음 조회를 지연시킨 동안 현재 응답 수·완료 버튼 오염 방지 |
| lint/build | build 통과. lint 오류 없음; 검사 시 다른 담당 범위 shared-result/page.tsx의 react-hooks/exhaustive-deps 경고 1건 관찰 |

최종 전체 통합 실행은 exit 0, `PASS isolated suite`로 종료했다. 보관된 격리 로그/DB 경로는 `/var/folders/1k/_rg_csns6wv0s0t2hqpkvbdm0000gn/T/simus-integration-AagpaM`이다.

격리 PostgreSQL 클러스터를 생성해 실행하며 개발 DB에는 연결하지 않는다. 실행 종료 시 소유한 서버·DB를 정리한다.

## 검증 경계

이번 3개 폭 패널 검사는 WebGL 빌드가 없는 안내 상태에서 수행했다. 기존 stage-browser의 Unity 연결 검사는 HTML 메시지 fixture이며 실제 Unity 렌더링 검증이 아니다. 실행 로그의 `SKIP: Unity Play (set TEST_UNITY_EDITOR)`는 미검증으로 남긴다.

실제 Unity 빌드의 본인 NPC 추적·도시 렌더링·새 맵 연결, Android/iPhone Safari의 터치/시스템 글자 확대/화면 잠금 복귀, 스크린리더 음성 출력, 발열·프레임은 후속 실기기 인수가 필요하다. 15초 제한은 코드에 적용했으나 실제 장시간 네트워크 정지 테스트는 이번 실행에 포함하지 않았다. 전시 인수 체크리스트를 이 결과만으로 완료 처리하지 않는다.
