# SIM:US Unity client

City visualization behavior, value mapping, preview data, and scene instructions are documented in [VISUALIZATION.md](VISUALIZATION.md).

`docs/unity-integration.md` 계약에 맞춘 최소 도시 상태 클라이언트다. Next.js와 PostgreSQL에는
변경을 요구하지 않으며 Unity는 `GET /api/city-state`만 호출한다.

## 현재 프로젝트 상태

2026-09-16 확인 결과 이 컴퓨터에는 Unity CLI 1.0.0-beta.9만 있고, CLI가 보고한 설치된
Unity Editor와 등록된 Unity 프로젝트는 각각 0개였다. 따라서 특정 Editor 버전을 추측한
`ProjectSettings/ProjectVersion.txt`, 장면 파일, 직렬화된 Unity asset은 만들지 않았다.
`Assets/`의 구현과 `Packages/manifest.json`만 준비했으며, manifest는 JSON의 엄격한 null·타입
검사를 위한 Unity 공식 Newtonsoft Json 3.0.2와 EditMode 테스트 프레임워크를 선언한다.

## 책임 분리

- `Core/CityStateDto.cs`: 외부에 노출하는 불변 응답 스냅샷
- `Core/CityStateJson.cs`: 필수 필드·타입·범위·UUID·시각·bigint 문자열 검증
- `CityStateApiClient.cs`: 한 번에 하나의 `UnityWebRequest`, 10초 기본 타임아웃과 취소
- `CityStatePoller.cs`: 2초 폴링, 2/4/8/16/30초 재시도와 지터, 생명주기 및 늦은 응답 차단
- `Core/CityStateStore.cs`: 마지막 정상 상태, null 상태, 연결 상태, 회차·version·status 변화
- `CityStateDebugView.cs`: 연결 상태와 도시·지역 수치를 표시하는 최소 IMGUI 화면

네트워크 오류 때 `Current`를 유지하고 연결 상태만 바꾼다. 성공 응답의 `city_state: null`은
정상 연결 상태에서 현재 도시를 비운다. 같은 회차의 version 감소는 거부한다. 회차가 바뀌면
낮은 version도 받아들이며, 같은 version에서도 status와 전체 스냅샷 변화를 감지한다.

## Editor에서 여는 절차

1. Unity Hub에서 팀이 사용할 Editor를 설치한다. 현재 저장소에는 버전 결정 근거가 없으므로 먼저 팀 버전을 선택한다.
2. 그 Editor로 임시 빈 Core 프로젝트를 만든다.
3. Editor를 닫고 임시 프로젝트의 `ProjectSettings/` 전체를 이 `unity/` 아래에 복사한다.
   생성된 `ProjectSettings/ProjectVersion.txt`가 실제 설치 버전을 기록하게 한다. `Library/`, `Temp/`, `Logs/`는 복사하지 않는다.
4. Unity Hub에서 이 `unity/` 폴더를 프로젝트로 추가해 연다. Package Manager가 manifest의 Newtonsoft 패키지를 복원할 때까지 기다린다.
5. 빈 장면을 만들고 Play를 누르면 runtime bootstrap이 폴러와 디버그 화면을 자동 생성한다.
6. 서버 주소나 폴링 주기를 바꾸려면 Play 전에 `SIMUS > Create City Client`를 실행하고,
   생성된 오브젝트의 `City State Poller`에서 `Server Base Url`, `Polling Seconds`, `Timeout Seconds`를 설정한다.
   장면에 폴러가 있으면 bootstrap은 중복 인스턴스를 만들지 않는다.
7. `Window > General > Test Runner > EditMode > Run All`로 계약 테스트를 실행한다.

로컬 Editor·데스크톱 기본 주소는 `http://localhost:3000`이다. 다른 PC의 서버라면 접근 가능한
LAN/HTTPS 주소로 바꾼다. WebGL 동일 출처 배포에서는 Server Base Url을 빈 문자열로 설정해
`/api/city-state`를 사용한다. WebGL 페이지와 API의 스킴·호스트·포트가 달라지면 현재 서버에는
CORS 허용 설정이 없으므로 브라우저가 응답을 차단한다.

## 실행 및 확인

저장소 루트에서 서버를 띄운다.

```sh
docker compose up -d
curl -i http://localhost:3000/api/city-state
```

2026-09-16 실제 로컬 서버에서 HTTP 200, `Cache-Control: no-store`, RUNNING 회차,
문자열 version, 도시 수치와 지역 배열을 확인했다. Unity Editor가 설치되어 있지 않아 이번
환경에서는 C# 컴파일, EditMode 테스트, Play Mode의 `UnityWebRequest`, 요청 취소 및 WebGL
동일 출처 동작은 실행 검증하지 못했다. 위 절차로 Editor를 준비한 후 Console 컴파일 오류가
없는지 확인하고 Test Runner를 실행한 다음, Play 화면에서 다음을 확인한다.

- 서버 정상: `Connected`, 회차 ID·status·version·도시 및 지역 수치 표시
- 조회 가능한 회차 없음: `Connected`와 `no available session` 표시
- 서버 중단: 마지막 수치는 유지되고 `Reconnecting`, 15초 뒤 `Disconnected` 표시
- 서버 복구: 즉시 또는 다음 재시도에서 `Connected`로 복귀
- Play 종료·오브젝트 비활성화: 진행 중 요청 취소, 재활성화 시 즉시 한 번 조회

Unity 공식 문서: [UnityWebRequest](https://docs.unity3d.com/ScriptReference/Networking.UnityWebRequest.html),
[WebGL networking](https://docs.unity3d.com/Manual/webgl-networking.html),
[Newtonsoft Json package](https://docs.unity3d.com/Packages/com.unity.nuget.newtonsoft-json@3.0/manual/index.html).
