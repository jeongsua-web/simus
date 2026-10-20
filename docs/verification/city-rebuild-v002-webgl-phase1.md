# CityRebuild_v002 — WebGL 연결 1단계

## 범위와 기존 빌더 분석

`DevelopmentCityWebGLBuild.Build`는 `CompletedMapNpcFollow`를 열어 테스트 NPC 하나를 비활성 템플릿으로 바꾸고 나머지를 제거한다. 카메라를 웹 추적용으로 변경(`followSize=5`)하고 합성 좌표 바닥을 추가한 `DevelopmentCity.unity`를 저장한다. `simus_city` 템플릿의 iframe 메시지를 `WebCityBridge`에 연결하며 `dev-synthetic-v1`을 사용한다. 이 좌표·바닥·카메라 변경은 v002 빌더에서 재사용하지 않는다.

`CityRebuildV002WebGLBuild.Build`는 v002 원본을 열고 빌드용 임시 씬만 생성한다. 기존 Phase 8 대상 위치에 고정 초점을 두며 렌즈·각도·전환·가림 설정을 유지한다. 테스트 NPC 오브젝트, `TestNpcPatrol`, `CityV002NpcRouteAdapter`, 경로 검증 컴포넌트를 제외한다. 빌드 후 임시 씬을 삭제하고 이전 씬 구성을 복원한다.

`WebCityBridge.mapDisplayOnly`는 기본값 false다. 이 빌드에서만 true로 설정하며 기존 메시지와 버전·세션 검증은 유지한다. NPC 생성·좌표 적용·군중 및 도시 API 조회는 실행하지 않는다. `CityClientBootstrap`도 새 테스트 씬에서 자동 도시 클라이언트를 생성하지 않는다.

## 빌드와 테스트 배포

Unity 6000.3.24f1 / WebGL. 실행 메서드: `CityRebuildV002WebGLBuild.Build`.

- 기본 출력: `unity/Builds/city_rebuild_v002_test`.
- `SIMUS_V002_WEBGL_OUTPUT`으로 비어 있는 테스트 출력 폴더를 지정할 수 있다. 기존 출력이 있으면 중단한다.
- 이번 검증 출력: `unity/Builds/city_rebuild_v002_test_verified`.
- 배포: `node scripts/unity/deploy-city-rebuild-v002.mjs unity/Builds/city_rebuild_v002_test_verified`.
- 배포 경로: `web/public/city-rebuild-v002-test/`. 배포 스크립트의 목적지는 고정이며 기존 테스트 배포도 덮어쓰지 않는다.
- 테스트 빌드 식별자: `test-only-city-rebuild-v002-webgl-v1`. 전시 `map_version` 확정이나 서버 데이터 변경을 의미하지 않는다.

`/participate` 소스는 `/city` 경로와 서버 NPC의 `map_version`을 검사하며 BOUND 이전에는 iframe을 숨긴다. 따라서 웹 UI·서버 API·운영 `/city`를 모두 보존한 상태에서 일반 `/participate` 접속을 새 빌드로 전환하지 않는다. 이번 연결 검증은 `scripts/unity/test-city-rebuild-v002.mjs`의 브라우저 안에서만 `/city/*`를 실제 테스트 배포 경로로 전달하고, 가짜 참여 회차와 미사용 좌표를 제공한다. 인증·DB·회차·API 구현은 변경하지 않는다. 기존 UI의 추적 상태 문구는 이 테스트에서 NPC 이동의 증거가 아니다.

## 검증 기록

- Unity WebGL 빌드 성공. 최초 데이터 조립 쓰기 오류 이후 별도 경로에서 재시도했다.
- 임시 씬의 Phase 8 카메라 설정 비교 통과: followSize 21, pitch 48, yaw -36, easing·가림 및 개요 설정 보존.
- 임시 씬에서 테스트 NPC·경로 어댑터·하천 NPC 가드·경로 검증 컴포넌트가 없음을 확인했다.
- 원본 `CityRebuild_v002.unity`와 `CompletedMapNpcFollow.unity`는 HEAD와 바이트가 같다.
- 실제 Chromium WebGL + 기존 `/participate`: READY/BOUND, 데스크톱 1280×900·모바일 390×844의 canvas 표시 확인. 페이지·콘솔 오류 0개.
- 새 iframe의 군중·도시 API 조회 0개. 실제 `dev-synthetic-v1` 바인딩 전송 시 ERROR로 거부됨을 확인했다.
- 기존 테스트 배포 덮어쓰기 거부와 `/city`·테스트 파일 해시 보존 검사 통과. 수정 전 테스트 빌드는 `/tmp/simus-v002-pre-bootstrap-fix-build`에 보존했다.
- `python3 scripts/assets/catalog.py`, `python3 scripts/assets/catalog.py --check`: 5,205개 파일, 오류 0개. `git diff --check` 통과.

브라우저 실행에는 `TEST_PLAYWRIGHT_MODULE` 및 필요 시 `TEST_CHROMIUM_EXECUTABLE`을 지정한다. 기본 Next.js 테스트 주소는 `http://127.0.0.1:3012`, 변경 시 `TEST_V002_URL`을 사용한다. 화면 증거는 `/tmp/simus-v002-participate-desktop.png`, `/tmp/simus-v002-participate-mobile.png`다.

NPC 이동, 서버 좌표 호환성, 30개 상황 배치, 실기기 성능, 전시 승인은 이번 단계의 검증 대상이 아니다.
