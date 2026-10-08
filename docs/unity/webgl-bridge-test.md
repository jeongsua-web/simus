# Unity WebGL bridge 시험 구현

이 문서는 시험 장면·빌드의 인계 기록이다. 공통 계약과 `web/src`는 변경하지 않는다.

## 소스와 기존 코드 재사용

- `unity/Assets/WebGLTemplates/simus_city/`: 동일 출처 iframe HTML/JS. 부모 window, origin, channel/version/bridge_id 검증. Unity 수신기의 준비 신호와 loader 완료가 모두 있어야 READY 발송. 로딩 중 DISPOSE와 VISIBILITY도 처리.
- `unity/Assets/Plugins/WebGL/simus_bridge.jslib`: Unity → JS 메시지.
- `unity/Assets/SIMUS/Runtime/Core/WebBridgeState.cs`: INIT/SNAPSHOT 검증, 회차·NPC·bridge 고정, 지도 검사, 중복 INIT 및 오래된 snapshot의 시계 리셋 방지, 경로 불변 검사.
- `unity/Assets/Scripts/WebCityBridge.cs`: `SIMUS Web Bridge` GameObject의 `Receive`, `SetVisibility`, `DisposeBridge` 수신기. 인증을 맡은 웹이 보낸 own_npc_id만 본인으로 표시. 닉네임·참여자 프로필을 사용하지 않음.
- 기존 `NpcCrowdSnapshot`·`NpcMotion` 서버/단조 시계 보간과 `CityPreviewCamera.SetFollowTarget` 재사용. 기존 Neighborhood ±2m 차선 보정은 적용하지 않음. 카메라의 시험 컨트롤 UI는 새 장면에서 비활성화.
- 기존 `CityStateJson`·`CityStateStore` 재사용. 최신 도시 API는 INIT 회차가 일치할 때만 적용. 시험 장면은 청결도에 따라 배경색만 표시하며 지역 좌표를 추정하지 않음.
- 군중은 INIT 회차의 공개 API만 조회하며 본인 NPC는 공개 응답으로 덮어쓰지 않음. 공개 조회 실패/잘못된 응답은 마지막 유효 상태·freeze_at 유지. 복귀 시 재조회. 종료 시 요청 취소·코루틴·캐릭터·재질 정리, JS listener 제거 및 Quit.

## 시험 데이터와 빌드

`test-only-bridge-v1` / `test-only-square-v1`는 합성 시험 식별자다. 시험 장면은 바닥과 캡슐이며 Neighborhood/대학 맵·전시 상황·지역 좌표를 포함하지 않는다. 테스트 서버의 사각형 경로는 전시 데이터로 이관하지 않는다. 인증은 모의 처리하므로 실제 HttpOnly 쿠키 인증 인수와 구분한다.

Unity 6000.3.24f1 + WebGL Build Support 필요. Unity 메뉴 `SIMUS/Bridge/Build test WebGL` 또는:

```sh
/Applications/Unity/Hub/Editor/6000.3.24f1/Unity.app/Contents/MacOS/Unity \
  -batchmode -nographics -quit -projectPath "$PWD/unity" \
  -executeMethod WebBridgeTestBuild.Build -logFile /tmp/simus_bridge_build.log
```

기본 출력: `unity/Builds/bridge_test/city/` (Git 제외). `SIMUS_BRIDGE_OUTPUT` 환경변수로 출력 폴더 지정 가능. 빌드 성공 후에만 `build.json`을 생성한다:

```json
{"protocol_version":1,"map_version":"test-only-bridge-v1"}
```

Development 빌드·무압축이다. `index.html`, `build.json`은 `Cache-Control: no-cache` 또는 `no-store`; `.wasm`은 `application/wasm`, JS는 `application/javascript`, data는 `application/octet-stream`, 무압축 파일에 Content-Encoding을 붙이지 않는다. 전체 출력 폴더를 하나의 배포 단위로 교체한다. 실서비스 `/city/`에 시험 빌드를 자동 배포하지 않는다.

로컬 시험 서버:

```sh
node scripts/unity/serve-bridge-test.mjs unity/Builds/bridge_test/city
# http://127.0.0.1:4175 — 합성 API/부모 페이지와 실제 Unity 빌드만 제공
node --test scripts/unity/bridge-adapter.test.cjs web/tests/unity-bridge.test.mjs
TEST_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
  node scripts/unity/bridge-browser-test.mjs
```

## 웹/공통 계약 후속 제안 (미적용)

- 전시 map_version·경로 확정 후 별도 전시 장면 및 실제 build.json으로 교체해야 한다. 기존 서버의 `neighborhood-v1` 응답은 이 시험 빌드에서 의도적으로 거부한다.
- 웹 INIT/SNAPSHOT에 요청 RTT/수신 시각이 없으므로 본인 NPC는 Unity 수신 시각에서 server_time 기준 단조 경과를 시작한다. 공개 군중 조회는 RTT/2를 반영한다. 본인 NPC도 동일 지연 보정이 필요하면 계약에 타이밍 메타데이터를 합의하거나 Unity의 별도 시계 동기화를 설계해야 한다. 현재 계약에 임의 필드는 추가하지 않았다.
- 웹 소스 변경 없이 시험 가능하다. 실제 쿠키 인증 API와의 통합은 전시 데이터 또는 격리 서버의 시험용 경로 스냅샷 준비 후 진행한다.

## 검증 기록

아래 결과는 합성 데이터 시험이며 휴대폰 성능·전시 승인을 뜻하지 않는다.
