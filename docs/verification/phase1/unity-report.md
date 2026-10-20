# Phase 1 Unity QA

2026-10-20. 이 문서는 실제 Unity 실행 결과와 미검증 범위를 구분한다. 기존 미커밋 구현·이벤트 코드·DB·배포는 변경하지 않는다.

## 실행과 보존

- Unity 6000.3.24f1 라이선스: 현재 확인 **PASS**. [실행 로그](unity-license-current.log)는 entitlement 확인과 batchmode exit 0을 기록한다. 이전 Phase 1 구현 시점의 license exit 198은 현재 상태가 아니다.
- C# 컴파일·변경 씬 로드: **PASS**. 실제 로드한 그래프는 579노드/604간선이다. [편집기 Physics 결과](unity-editor-physics.json)
- Play Mode: 실제 `TestNpcPatrol` / `CityV002NpcRouteAdapter` / `NpcGrounding` 이동을 20배 시계로 34.85초 실행했다. waypoint 사이를 순간이동하지 않았다. [원시 결과](unity-runtime.json), [로그](unity-runtime.log)
- 씬 SHA-256은 실행 전후 `3ca26d6ee0c512812c8d1778c4fb8e8296b7df2357a46aa231daf9f6fe8969d2`로 동일하다. [보존 결과](unity-preservation.json)
- 실제 에디터 검사는 `-nographics`로 실행했다. 카메라 시인성·렌더 이미지·실기기 성능 확인은 포함하지 않는다. 오프라인 Editor 씬의 기존 city poller는 localhost:3000 연결 실패를 로그에 남겼다. 참가자 서버/API 통합 검사가 아니며 QA 이동 중 C# runtime error 수는 0이다.

실행 명령(작업 디렉터리 `C:/Project/simus`):

```powershell
& 'C:/Program Files/Unity/Hub/Editor/6000.3.24f1/Editor/Unity.exe' -batchmode -nographics -quit -projectPath 'C:/Project/simus/unity' -logFile 'C:/Project/simus/docs/verification/phase1/unity-license-current.log'
& 'C:/Program Files/Unity/Hub/Editor/6000.3.24f1/Editor/Unity.exe' -batchmode -nographics -projectPath 'C:/Project/simus/unity' -executeMethod Phase1QaHarness.Run -logFile 'C:/Project/simus/docs/verification/phase1/unity-runtime.log'
& 'C:/Program Files/Unity/Hub/Editor/6000.3.24f1/Editor/Unity.exe' -batchmode -nographics -quit -projectPath 'C:/Project/simus/unity' -executeMethod Phase1QaHarness.Build -logFile 'C:/Project/simus/docs/verification/phase1/unity-build.log'
```

하네스는 검사 중에만 `unity/Assets/Editor`에서 사용한다. 검사 소스는 이 evidence 폴더에 보존하며 원본 씬에는 저장하지 않는다.

실행 종료 후 임시 `Phase1QaHarness.cs` / `Phase1RiverWarpQa.cs`와 각각의 `.meta`를 제거했다. 재현 소스는 [기본 하네스](unity-qa-harness.cs), [위치 점프 하네스](unity-river-warp-harness.cs)다. 재실행 시 각각 같은 이름으로 Editor 폴더에 임시 복사해야 한다. Editor가 자동 직렬화한 ProjectSettings의 기본 픽셀 밀도·플랫폼 기본 OS 버전·buildNumber 항목은 QA 전 내용으로 복원했다. 빌더의 임시 씬도 삭제된 것을 확인했다.

## 위치 8개별 결과

각 anchor의 scene marker·실제 그래프 node·canonical 좌표 일치, 대상 object 존재·활성, 그래프 연결, 지지면, 해당 지점의 capsule 여유는 **8/8 PASS**다. 다음 표는 그 지점까지의 전체 이동과 엄격한 캡슐 여유를 별도로 표시한다.

| 이벤트 | 실제 도착 | 전체 경로 지지면 누락 | 전체 경로 엄격 캡슐 여유 |
|---|---:|---:|---|
| 02 횡단보도 | PASS, 1회 | 0 | PASS |
| 05 울고 있는 아이 | PASS, 1회 | 0 | PASS |
| 07 불법 주차 | PASS, 1회 | 0 | **FAIL**, 기존 보도·횡단부 접촉 7샘플 |
| 13 꽃밭 | PASS, 1회 | 0 | PASS |
| 17 축제 안내 | PASS, 1회 | 0 | PASS |
| 18 고양이 | PASS, 1회 | 0 | PASS |
| 28 도로 통제 | PASS, 1회 | 0 | **FAIL**, 기존 보도 접촉 4샘플 |
| 30 상자 | PASS, 1회 | 0 | PASS |

정확한 node·좌표·대상 경로는 [편집기 결과](unity-editor-physics.json)의 `places`와 기존 canonical 파일에 있다. actual contact 위치와 Collider 경로는 [원시 이동 결과](unity-runtime.json)의 `first_failures`에 있다.

## 변경 경로와 기존 왕복

수정한 4개 간선을 0.2m 이하 간격으로 실제 Unity Physics 검사했다. 분할한 continuation도 포함한다.

| 수정 간선 | 샘플 | 지지면·정적 캡슐 검사 |
|---|---:|---|
| R05LE00_S1 | 285 | PASS |
| PKE03_S0 | 213 | PASS |
| C07_LINK_S1 | 333 | PASS |
| R01LE03_S0 | 553 | PASS |

합계 1,384샘플이다. 이 국소 결과와, 국소 구간에 이르기 전 기존 교차로를 포함하는 전체 이동 경로 결과는 다르다.

| 기존 왕복 | 실제 도착 | 지지면 누락 | 엄격 캡슐 여유 |
|---|---:|---:|---|
| 학교↔상업 | PASS, 2회 | 0 | **FAIL**, 6접촉 샘플 |
| 학교↔주거 | PASS, 2회 | 0 | **FAIL**, 14접촉 샘플 |
| 학교↔공원 | PASS, 2회 | 0 | PASS |
| 주거↔상업 | PASS, 2회 | 0 | **FAIL**, 20접촉 샘플 |

이동 전체는 54,410샘플이며, 원시 결과의 FAIL을 유지했다. 성공 수를 높이기 위해 validator나 제품 코드를 바꾸지 않았다. [분리한 해석 자료](unity-runtime-classification.json)

캡슐 기준은 투영한 발 위치에서 bottom-center +0.25m / top-center +1.55m, 반경 0.2m다. 캡슐 아래쪽은 발보다 0.05m 높으며, 도로면 Y=0.02에서 root Y=0.04로 이동할 때 인접한 보도 Y=0.14에 겹칠 수 있다. 실제 기록 예시는 `(0,0.04,-57.77647)`에서 `R01LE03_S0` / `R01LE02_S1` 보도 mesh 접촉이다.

보존한 최초 위반 목록의 Collider들은 `04_PedestrianSurfaces/sidewalk` 또는 `crossing`이다. 위치를 Transform으로 움직이기 때문에 실제 도착은 가능했고, 이 사실이 물리 여유 FAIL을 해결하지는 않는다. 연석 근처 발·몸 관통 위험을 검토해야 한다. 각 경로는 최초 위반 최대 12개를 저장하므로 이 자료만으로 모든 접촉이 신규 소품과 무관하다고 완전히 단정하지 않는다.

## WebGL과 환경 NPC

실제 BuildPipeline 임시 씬 검사에서 참가자 template 1개·test probe 0개를 확인했다. 시민 2명·운반자 1명은 활성 상태와 Patrol·Animator를 유지했다. 아이·경찰·수상한 NPC·고양이도 모두 존재하고 활성 상태이며 Animator가 남아 있다. [실제 빌드 씬 결과](unity-build-scene.json)

로컬 시험 빌드는 **PASS**다. [빌드 결과](unity-build-result.json)와 [실제 로그](unity-build.log)에 `Build Finished, Result: Success` 및 exit 0이 있다. 산출 폴더는 `unity/Builds/phase1_qa_local_20261020_051159`다. manifest의 map/path는 Phase 1이며 `source_scene_sha256`은 원본 씬과 일치한다. 빌드 후에도 원본 씬 hash가 동일하다. data 74,443,057B / wasm 26,706,085B이며 무압축이다. 배포 명령은 실행하지 않았다.

## 남은 범위

- RiverGuard와 WebCityBridge의 초기 생성·탭 복귀 큰 위치 점프는 아래와 같이 실제 결함을 재현했다. 제품 수정은 하지 않았다.
- 브라우저에서 실제 산출물의 렌더·READY/BOUND·서버 위치 적용은 Editor 결과에 포함하지 않는다.
- 카페·식당 연결로는 Phase 1 미구현 사항으로 남아 있다. 이번 QA가 새 경로를 만들지 않았다.
- 참가자 서버의 선택·스탯·회차 처리와 운영 DB는 이 Unity 하네스에서 실행하거나 변경하지 않았다.

## 서버 위치 적용과 RiverGuard 충돌 — FAIL

[재현 결과](unity-river-warp.json), [실행 로그](unity-river-warp.log), [씬 보존](unity-river-warp-preservation.json). 실제 Editor Play Mode에서 참가자 템플릿 복제본을 비활성화하고 초기 위치를 설정한 뒤 활성화하여 기존 `RiverGuard.OnEnable`을 실행했다. 원본 `WebCityBridge.MoveActor`를 reflection으로 호출하고 실제 후속 `LateUpdate`를 관찰했다. 소스 코드를 바꾸거나 RiverGuard를 모사하지 않았다.

| 사례 | 서버 위치 적용 직후 | 실제 LateUpdate 후 | 결과 |
|---|---|---|---|
| 첫 생성: template 원점→PARK_REST_2 | (142, 0.16, 118) | (0, 0, 0) | **FAIL**, 오차 184.629m, rejectedSteps 0→1 |
| 탭 복귀: RIVER_W_0→RIVER_E_0 | 유효 동쪽 산책로 좌표 | 이전 서쪽 산책로 좌표 | **FAIL**, 오차 20.001m, rejectedSteps 0→1 |
| 같은 하안 대조군: RIVER_W_0→RIVER_W_1 | 유효 다음 좌표 | 동일 좌표 | PASS, 오차 0, rejectedSteps 0 |

실패 사례의 도착점은 그래프에 있고 `river.IsForbidden(destination)=false`다. 두 하안 사이에는 실제 그래프 경로가 존재한다. 서버 경로가 교량을 경유할 수 있어도 이전 렌더 위치→새 스냅샷 위치의 직선은 물을 가르므로 guard가 새 위치를 거부한다. 연속 waypoint 이동 성공과 별개로, 첫 생성과 탭 복귀 시 참가자 렌더 위치가 서버 권위 위치에서 크게 벗어날 수 있는 결함이다.

추가 재현 명령:

```powershell
& 'C:/Program Files/Unity/Hub/Editor/6000.3.24f1/Editor/Unity.exe' -batchmode -nographics -projectPath 'C:/Project/simus/unity' -executeMethod Phase1RiverWarpQa.Run -logFile 'C:/Project/simus/docs/verification/phase1/unity-river-warp.log'
```
