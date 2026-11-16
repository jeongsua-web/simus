# v003 로컬 연결 독립 QA

검증일: 2026-11-16. 대상은 로컬 개발 연결이며 전시 승인과 별개다.

- map_version: `city-masterplan-v003-local-v1`
- path_version: `city-masterplan-v003-plaza30-v1`
- 대표 상황: `EXHIBITION_30`
- 회차: `16000000-0000-0000-0000-000000000001` (격리 개발 DB의 원본 콘텐츠 복제)
- 테스트 진입점: `/v003-test`

## 수행한 검사

| 검사 | 명령/근거 | 결과 |
|---|---|---|
| 브리지·기존 NPC/장소 경로 회귀 | `cd web && node --test tests/unity-bridge.test.mjs tests/participant-npc-motion.test.mjs tests/npc-place-trajectory.test.mjs` | 19 passed, 0 failed. 기존 v002 테스트이며 v003 물리 검증을 대신하지 않음 |
| TypeScript | `cd web && npx tsc --noEmit` | passed |
| v003 시작 전 빌드 검사 | `cd web && node --test tests/v003-build-readiness.test.mjs` | 1 passed. 임시 파일 fixture에서 map/path/지원필드/씬 SHA/경유점 불일치와 wasm 누락 거절. 실제 start API 트랜잭션이나 WebGL 실행 증거와 구분 |
| 변경 코드 lint | `cd web && npx eslint src/lib/v003-local-event.ts src/lib/v003-route.ts src/lib/npc-events.ts src/lib/npc-graph-motion.ts src/lib/participant-npcs.ts src/lib/session-build-readiness.ts src/lib/city-builds.ts src/app/api/choices/route.ts src/app/api/sessions/'[id]'/event/start/route.ts src/app/api/sessions/'[id]'/event/confirm/route.ts src/app/participate/UnityCity.tsx src/app/v003-test` | passed |
| 30행 배치표 | `docs/content/v003-event-placement.csv` 구조/행 수/대표행 검토 | 30행. 저장 위치·후보 경로·플레이 검증 상태 분리. UTF-8 BOM이 있으므로 프로그램에서는 utf-8-sig로 읽기 |
| 실제 로컬 API | `cd web && node tests/v003-local-api.mjs` | 준비됨; 서버/실제 빌드 준비 후 실행 결과 추가 예정 |
| 실제 브라우저/WebGL | 도구 상태 확인 | 미실행. 브라우저 host unavailable, Chrome CUA application session이 사용자에 의해 이 턴 중지됐다는 도구 응답. 추가 UI 제어 중단 |

## 검토 중 발견한 사항

1. v003 빌드에 `path_versions` 또는 NPC 지원 필드가 빠져도 공용 검사만으로 통과할 수 있었다. 담당자에게 전달하여 v003 전용 kind/NPC/path/기준 씬 SHA/정확한 경유점·속도·loop 검사를 추가했다.
2. 빌드 URL 제안과 서버 등록값이 달랐다. `/unity/city-masterplan-v003-local-v1`로 통합했다.
3. 마감 후 이미 접수한 결과가 사라질 수 있었다. 결과 조회를 open 여부와 독립 처리하도록 담당자가 수정했다. 마감 시각을 넘긴 실제 확인 테스트는 별도다.
4. 저장된 `FULL_EVENT_30_INTERACT` 위치와 로컬 NPC 정지 위치가 다르다. 저장 앵커와 런타임 선택점을 혼동하지 않도록 배치표에 분리 기재 요청했다.

## 검증 경계

서버 API 통과는 화면에서 실제 NPC 메시·카메라·이동을 본 증거가 아니다. Unity 물리 검증, 새 v003 WebGL 생성, 브라우저 READY/BOUND와 실제 캔버스 이동/정지/재개 결과를 각각 기록해야 한다. 기존 v002 바이너리·manifest 수정·mock iframe을 v003 실행 증거로 인정하지 않는다. 휴대폰 성능·30개 상황 플레이·전시 최종 승인도 별도다.
