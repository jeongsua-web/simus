# 모바일 웹–Unity WebGL 메시지 계약 v1

2026-10-09. 웹 호스트 구현 완료, Unity 수신기·WebGL 빌드·실기기 연결은 미완료.
새 맵 버전·좌표·경로를 확정하는 문서가 아니다.

## 역할과 배포

- 웹: 참여 인증, 프로필, 상황 탐색·선택 제출, 결과 이동을 담당한다. 선택 패널은 현재 웹 구현을 유지한다.
- Unity: 도시 렌더링, 본인 NPC 강조·카메라 추적, 서버 시각 기준 이동과 동결을 담당한다.
- 웹은 `/api/sessions/{id}/npc`를 본인 HttpOnly 쿠키로 조회한다. 닉네임으로 캐릭터를 찾지 않는다.
- 동일 출처 `/city/index.html`을 iframe으로 연다. 이 경로에는 Unity 빌드의 HTML 템플릿과 JS 어댑터가 있어야 한다. 일반 Unity 기본 빌드만 복사하면 연결되지 않는다.
- 배포 시 `/city/build.json`을 빌드와 함께 제공한다: `{"protocol_version":1,"map_version":"<실제 빌드 지도 버전>"}`. 확정 전 가짜 전시 버전을 채우지 않는다.
- HTML·manifest는 새 빌드 배포 시 캐시가 섞이지 않게 재검증하고, wasm/data/loader는 같은 빌드 단위로 원자적으로 배포한다. MIME·압축 헤더는 실제 빌드 설정에 맞춘다.
- 현재 빌드가 없으면 준비 중 안내와 재시도 버튼을 표시한다. 기존 Canvas/Neighborhood 좌표를 대신 렌더링하지 않는다. 상황 선택은 계속 사용할 수 있다.

## 전송 규칙

`window.postMessage`의 구조화 복제 객체를 사용한다. 모든 메시지는 아래 공통 필드를 가진다.

```json
{"channel":"simus-city","version":1,"bridge_id":"이번 iframe 연결의 UUID","type":"READY"}
```

웹이 iframe URL의 `bridge_id` 쿼리로 임의 UUID를 전달한다. 이는 자격 증명이 아닌 연결 식별자다. 매 재시도·회차 전환마다 바뀐다.
양쪽 모두 `event.origin === location.origin`, `event.source`가 상대 window인지, channel/version/bridge_id가 맞는지 검사한다. `targetOrigin`은 정확한 `location.origin`을 사용한다. `*`를 사용하지 않는다.
쿠키·관리자 토큰·결과 링크·개인 성향·프로필을 메시지에 넣지 않는다. 같은 출처의 신뢰된 빌드만 배포한다. iframe은 보안 격리 수단이 아니다.

## 메시지

| 방향 | type | 추가 필드 / 의미 |
|---|---|---|
| Unity → 웹 | READY | `map_version`: Unity 장면의 실제 지도 버전. 런타임과 메시지 수신기가 준비된 뒤 발송 |
| 웹 → Unity | INIT | `session_id`, `own_npc_id`, `snapshot`: 인증된 본인 NPC API 응답. 바인딩 확인 전에는 재전송 가능 |
| Unity → 웹 | BOUND | `session_id`, `npc_id`: INIT의 본인 캐릭터 생성·강조·카메라 추적 연결 성공 후 발송 |
| 웹 → Unity | SNAPSHOT | INIT와 같은 필드. 본인 NPC 시간·동결 상태 갱신 |
| 웹 → Unity | VISIBILITY | `visible`: false이면 렌더링/폴링을 줄이고 true이면 상태 재동기화 |
| 웹 → Unity | DISPOSE | 페이지 이탈·회차 변경·재시도 시 최선 노력 종료 신호. Unity Quit와 이벤트·타이머 정리 |
| Unity → 웹 | ERROR | 표시 불가 오류. 선택적으로 개발 진단용 `code`. 웹은 임의 메시지를 노출하지 않고 고정 오류 안내 |

`INIT.snapshot`과 `SNAPSHOT.snapshot`은 [NPC API](participant-npc-api.md)의 응답이다. 웹은 2.5초 간격과 온라인/화면 복귀 때 갱신하며 백그라운드에서는 요청하지 않는다. 같은 회차의 본인 NPC는 한 개여야 하고 지도 버전이 빌드와 같아야 한다. 인증 만료, 잘못된 응답, NPC 변경, 지도 불일치 시 iframe을 제거하고 재시도를 안내한다.

Unity는 INIT를 멱등 처리한다. 중복 INIT로 캐릭터를 추가 생성하지 않고 BOUND를 다시 보낸다. 다른 회차/bridge_id의 메시지를 기존 장면에 섞지 않는다. SNAPSHOT은 초기 바인딩 후에만 적용한다. 웹은 올바른 BOUND를 받은 뒤 iframe을 표시한다. 준비부터 바인딩까지 60초를 넘으면 iframe을 제거한다. 일시적 NPC 조회 오류는 연결 확인 안내와 주기 재시도로 처리하며, Unity는 마지막 상태와 freeze_at을 유지한다.

## Unity 구현자가 할 일

1. WebGL HTML 템플릿 어댑터에서 쿼리의 bridge_id를 읽고 parent 메시지 listener를 설치한다.
2. Unity 수신 GameObject/메서드를 준비한 후 READY를 보낸다. `createUnityInstance` 성공만으로 NPC 바인딩 완료라고 판단하지 않는다.
3. 검증한 INIT/SNAPSHOT을 JSON 문자열로 변환하여 Unity `SendMessage` 수신기에 전달한다. 구체적인 GameObject/메서드 이름은 Unity 구현에서 정하고 어댑터와 함께 배포한다.
4. Unity에서 회차·map_version·own_npc_id를 검사하고 본인 추적을 연결한 뒤 JS로 BOUND를 전달한다.
5. 군중 `/api/sessions/{id}/npcs`와 도시 `/api/city-state`는 공개 API로 조회한다. 응답 session_id가 INIT와 같을 때만 적용하고, NPC의 map_version도 확인한다. city-state는 최신 회차 API이므로 다음 회차가 시작되면 이전 회차에 적용하지 않는다. 과거 결과 도시 렌더링은 별도 후속 작업이다.
6. 서버 시각과 단조 시계로 이동을 보간하고 freeze_at에서 멈춘다. 기존 ±2m 차선 보정은 시제품 규칙이며 새 맵에 무조건 적용하지 않는다.
7. VISIBILITY 복귀 시 공개 상태를 재조회하고 DISPOSE/pagehide 시 런타임을 해제한다. 예기치 않은 런타임 종료·컨텍스트 손실은 ERROR로 알린다.

## 검증과 병행 작업

웹 프로토콜 검사: `cd web && node --test tests/unity-bridge.test.mjs`.
실제 빌드 인수: READY → INIT → BOUND, 다른 지도/회차 거절, 재시도 후 이전 메시지 무시, 화면 잠금 복귀, 종료 동결, 모바일 로딩·발열·메모리 검증이 필요하다.

독립적으로 진행 가능한 작업:

- Unity 담당: 위 어댑터·수신기·카메라 바인딩 및 시험용 빌드 제작. 새 맵 확정 전 시험 데이터는 분리한다.
- 맵 담당: 새 map_version, 상황 30개 위치, 지역 경계, path_version 인계표 완성.
- 웹 UI: 360/390/430px 선택 패널, 긴 문장, 글자 확대, 키보드 및 상태 안내 검증.
- 결과: 결과 화면 구성, 링크 발급 중 연타·네트워크 오류 처리, 미응답자 동선 개선.
- 운영: HTTPS 시험 환경, DB 001~009 적용, 자동 종료/푸시 스케줄러·VAPID 구성, 로그와 부하 측정 준비.

상황 위치에 따른 자동 노출, 새 맵 좌표 주입, 최종 도시 연출은 각각 노출 정책·맵 인계·표현 자산 확정 후 연결한다.

2026-10-09 검증: lint·production build·프로토콜 단위 검사 2건·격리 PostgreSQL/Chromium 통합 검사 통과. 390px 시험 iframe에서 서로 다른 참여자의 NPC 바인딩, 지도 버전 불일치 차단, 재시도 후 같은 본인 NPC 복구 확인. 실제 Unity Play/WebGL·휴대폰 검증은 미실행. 에셋 카탈로그 갱신/검사 0 errors.
