# v003 서버 연결 검증

2026-11-16 저장소 `web/src/lib/` 하위 폴더 정리 이후 실행했다.

- `cd web && node --test tests/v003-build-readiness.test.mjs` 통과. canonical `docs/content/v003-local-route.json`와 서버 snapshot의 동등성, 물리검증 미완료 route 거절, manifest map/path/scene SHA/필수 NPC 기능 누락, 작성 경로 변경, wasm 누락 거절을 검사한다. 파일 존재 검사의 입력은 격리된 임시 fixture이며 실제 WebGL 재생 증거는 별도 QA 문서를 따른다.
- `cd web && npx tsc --noEmit` 통과.
- 서버 변경 파일과 관련 테스트 파일에 대한 `npx eslint ...` 통과. 전체 `npm run lint`의 앞선 실행은 기존 public Unity 생성 JS의 10개 오류로 실패했다.
- `cd web && npm run build` 통과. 첫 sandbox 실행에서 Google Fonts 접속이 막혀 승인된 네트워크 실행으로 다시 빌드했다.
- `cd web && TEST_PG_PORT=55444 TEST_WEB_PORT=3119 npm run test:integration` 전체 통과. 새 PostgreSQL 클러스터 `simus-integration-pC4Txk`만 사용했고 종료 시 자체 서버와 DB를 중지했다. v002 DRAFT/회차 시작 rollback, 그래프 이동과 도착·정지·재개, 서버 재시작과 동시 선택 멱등성, 원본 30문항·91선택지, 1000회 도착 검사, DB 중지 후 복구를 포함한다. 브라우저·Unity 실행 환경변수를 지정하지 않아 해당 선택 검사는 SKIP으로 출력됐다.

v003 actual API 및 실제 WebGL 결과는 `v003-local-qa.md`에 기록한다.
