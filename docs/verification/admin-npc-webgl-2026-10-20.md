# 관리자 회차 ↔ 서버 NPC ↔ Unity WebGL 검증 · 2026-10-20

판정: 현재 로컬 CityRebuild_v002 시험 빌드에서 통과. 백엔드·Unity 담당 에이전트가 계약을 감사했고, QA 에이전트가 보강한 브라우저 검사를 검토했다. 주 에이전트가 최신 웹 빌드와 새 임시 PostgreSQL에서 실제 HTTP·Chromium·Unity WebGL 통합 검사를 실행했다. 운영 DB와 기존 회차는 변경하지 않았다.

- 기준 커밋: `82a4b200272175126b6a262f6da11c8257e609b8` + 이번 브라우저 검사 보강.
- 임시 회차: `8f1b6798-ac1e-47f1-8c91-1c191c4baf52`.
- 맵: `test-only-city-rebuild-v002-webgl-v1`. 경로: `city-rebuild-v002-walk-v1`.
- 현재 public WebGL은 `unity/Builds/city_rebuild_v002_character_zoom` 7파일과 일치한다. 이전 session-integration 문서의 session_verified 산출물 이후 줌 기능이 배포된 상태다.
- 기존 Neighborhood 좌표를 새 맵 근거로 사용하지 않았다. 시험 빌드 manifest의 `exhibition_ready=false`를 유지했다.

실제 성공 경로:

1. 관리자 UI에서 v002 새 DRAFT 생성 → 상황의 보행 지점 `C_SPINE_CUT_0` 저장 → 회차 시작. DB에 저장된 좌표 `[5.926, 0.16, -33.352]`, 반경 2m와 UI 선택을 대조했다. UI 저장 후 API 재배치는 하지 않았다.
2. 참여 UI에서 프로필·가입 → 실제 Unity READY/BOUND·렌더러 5개 NPC 확인. 초기 관측 구간에서 5.315m 이동했다.
3. 실제 시계로 61.648초 후 같은 상황의 `LOCATION` 이벤트가 표시됐다. 서버 정지 위치는 설정 지점에서 1.644257m로 반경 안이다. 이벤트 중 Unity NPC는 3초간 정지했다.
4. 같은 NPC의 서버 `speed_mps=0` 경로와 실제 Unity actor의 XZ 오차는 0.000000940670m로 5cm 허용 기준을 통과했다. Unity Y축은 지면 시각 보정 대상이므로 XZ를 비교했다.
5. 실제 라디오 선택·제출 → `/api/choices` 201 → DB 선택 원장 정확히 1건·도시 version 1 → Unity 재이동 8.270m 확인.
6. 관리자 UI에서 종료 → FINALIZED·서버 위치 고정·참여 화면 WebGL 해제 확인. 페이지 오류·브리지 ERROR 0건이다.

추가 검사 통과:

- `npm run build`와 TypeScript 검사.
- 실제 API: manifest 누락/손상, 맵·경로 버전 불일치, NPC 미지원, 그래프 밖 경로, 다른 맵 상황 위치는 시작 409 및 전체 롤백. 유효 v002는 시작·종료 성공.
- 실제 API: 경로 스냅샷 불변, 60초 유도·90초 DEADLINE, 서버 재시작·동시 이벤트 조회·중복 선택 멱등성·경로 복귀·회차 종료.
- 격리 전체 suite: 인증·회차 생명주기·점수/도시·결과·학과/프로필·NPC·DB 중단/복구 통과. 새 임시 DB 외 연결을 사용하지 않았다.
- 그래프: 572개 노드/597개 간선, 모든 노드 연결, 35,481개 경로 표본의 건물 회피와 237개 하천 표본의 교량 통과. 씬 원본 해시/그래프 export 검사 통과.
- 웹 브리지 단위 검사 3건과 Unity 템플릿 bridge-adapter 검사 5건 통과. 줌 버튼·휠·합성 터치도 실제 Unity 카메라에 반영됐다.
- QA 검토에서 이번 보강의 차단할 오류는 발견되지 않았다. 느린 장치에서 초기 WebGL 로드가 약 60초를 넘으면 초기 이동 단언은 환경 영향으로 실패할 수 있다.

검증 범위: 실제 WebGL 검사는 headless Chromium + SwiftShader에서 실행했다. 390×844 화면 및 합성 핀치 검사는 실기기 모바일 성능 검증이 아니다. 별도 레거시/프로필/학과/event fixture 브라우저와 Unity Editor Play 검사는 환경변수를 주지 않아 SKIP이며 위 실제 v002 브라우저 PASS와 구분한다. 운영 배포·운영 DB 마이그레이션·최종 30개 전시 위치/지역·전시 map_version 승인은 이번 범위 밖이다.

변경 파일: `web/tests/v002-session-browser.mjs`에서 UI 저장 위치를 유지하고 서버↔Unity 좌표/반경 단언과 증거를 추가했다. 제품 코드·씬·배포 자산은 변경하지 않았다.

재현:

```sh
cd web
npm run build
TEST_V002_PLAYWRIGHT_MODULE=/Users/jeongsua/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs TEST_CHROMIUM_EXECUTABLE=/Users/jeongsua/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell npm run test:integration
node --test tests/unity-bridge.test.mjs
node tests/city-v002-graph.mjs
```

최종 실행 임시 폴더: `/var/folders/1k/_rg_csns6wv0s0t2hqpkvbdm0000gn/T/simus-integration-seDG2r`. 검사 소유 서버·DB는 정상 종료했다. 변경 전 기존 검사 실행도 별도 `simus-integration-U8e7Js`에서 통과했으며 위 수치는 보강 후 실행의 값이다.

증거: [런타임 JSON](admin-npc-webgl-2026-10-20-evidence/evidence.json), [데스크톱 이동 화면](admin-npc-webgl-2026-10-20-evidence/moving-desktop.png), [모바일 크기 이벤트 선택 화면](admin-npc-webgl-2026-10-20-evidence/event-mobile.png).
