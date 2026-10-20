# 배치 작업 전 실행 환경 조사

조사일: 2026-10-20. 이 문서는 기존 코드·설정의 읽기 결과이며, 이번 배치의 QA·성능·WebGL 실행 결과가 아니다.

## 씬 선택 근거

- 이번 배치 대상: `unity/Assets/SIMUS/Scenes/city_rebuild_v002/CityRebuild_v002.unity`.
- 해당 씬 README와 `assets/catalog/README.md`가 최근 v002 도시·공원·하천·Phase 8 작업을 가리킨다.
- `web/src/lib/city-builds.ts`는 v002 회차를 `/city-rebuild-v002`로 연결한다. `unity/Assets/Editor/CityRebuildV002WebGLBuild.cs`가 위 작업 씬에서 별도 WebGL 산출물을 만든다.
- 기본 `EditorBuildSettings.asset`는 여전히 `CompletedMapNpcFollow.unity`를 선택한다. 이 기본 선택만으로 현재 도시 작업 대상을 판단하지 않았고, 이번 작업에서 빌드 설정을 바꾸지 않는다.
- 기존 `unity/Builds/city_rebuild_v002_session_verified/build.json`은 v002 session 산출물을 기록한다. 이는 이전 산출물이며 이번 배치를 포함한다는 뜻이 아니다.
- 이전 Neighborhood 시제품의 좌표·자산을 새 배치 근거로 사용하지 않는다. 전시 map_version, 상황 30개 좌표, 서버 회차 데이터는 이번 작업에서 확정하지 않는다.

## 렌더링·WebGL

- `ProjectVersion.txt`: Unity 6000.3.24f1.
- `GraphicsSettings.asset`: 별도 Render Pipeline 에셋 없음(Built-in).
- `ProjectSettings.asset`: Gamma 색 공간, WebGL 스레드 비활성, 초기 메모리 32MB / 최대 2048MB / 점진 증가 설정.
- v002 빌더는 `PROJECT:simus_city` 템플릿과 무압축 WebGL을 빌드 실행 중에 선택하고 원래 설정을 복원하도록 되어 있다. 기본 ProjectSettings 값과 별도 빌더의 실제 설정을 구분한다.
- 이번 작업에서는 WebGL 빌드·배포·브라우저 실행·성능 측정을 하지 않는다. 현재 웹 산출물은 갱신하지 않는다.

## NPC·교통수단 재사용 제약

- 기존 `TestNpcPatrol`은 로컬 보행 동작, `CityV002NpcRouteAdapter`는 기존 보행 그래프 경로 연결에 쓰인다. 참가자 생성은 별도의 웹 브리지·회차 연동을 사용한다.
- 기존 v002 빌더는 씬 내 `TestNpcPatrol`을 재귀 탐색하여 첫 대상을 참가자 템플릿으로 사용하거나 나머지 대상을 제거한다. 또한 기존 `CityV002NpcRouteAdapter`를 제거한다. 환경 시민에 이 컴포넌트를 붙이면 현재 빌더의 처리 대상에 들어갈 수 있다. 부모 오브젝트만 분리해도 재귀 탐색에서 제외되지 않는다.
- 이 빌더의 동작은 배치 담당자에게 전달했다. 이번 작업에서 빌더 수정·실행은 하지 않는다. 최종 배치 보고서의 이동 여부와 후속 빌드 제약을 함께 확인해야 한다.
- `TransitVehicleRig`는 바퀴·문·등화·표시 제어 기능이다. 이 파일의 존재만으로 경로 주행 기능이 있다고 판단하지 않는다. 새 차량 주행 시스템은 구현하지 않는다.

## 승인 전 작업 경계

배치에 필요한 에셋 탐색·좌표/지면 확인·편집기 렌더·씬 저장 확인까지 수행한다. 배치 후 QA, Play Mode 이동·애니메이션 검사, 성능 측정, 빌드·배포는 사용자 승인 후 별도 단계다. 사용자 요청에 따라 QA 에이전트는 승인 전 호출하지 않는다.

루트 지침의 에셋 목록 재생성은 관리 작업으로 수행하되, `catalog.py --check`는 검증 명령이므로 이번 요청의 승인 순서에 따라 승인 이후로 보류한다. 에셋의 접수·승인 상태는 변경하지 않는다.
