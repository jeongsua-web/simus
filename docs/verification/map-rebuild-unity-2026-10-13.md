# 맵 리빌드 Unity 조사와 도로·구역 초안 — 2026-10-13

## 결과와 한계

원본 `unity/Assets/SIMUS/Scenes/npc_follow_test/CompletedMapNpcFollow.unity`를 복제해 `unity/Assets/SIMUS/Scenes/map_rebuild_draft/map_rebuild_draft.unity`를 만들었다. 초안에는 297개 직육면체로 도로·보도·교차로·4개 구역과 크기 참고물이 **이미 직렬화되어 있다**. 빈 복사본이나 실행해야만 나타나는 계획 파일이 아니다. 다만 Unity 라이선스 초기화 실패로 Unity에서 이 직렬화 씬을 열어 재가져오기/컴파일/렌더/Play Mode 검증을 완료하지 못했다.

[탑뷰 개념도](map-rebuild-captures/top-view-schematic.svg)는 동일 JSON 배치 원본으로 만든 도식이며 **Unity 캡처가 아니다**. 게임 카메라 캡처는 제공하지 못했다.

## 조사 근거

- `.codex/agents/unity.toml`, 루트 `AGENTS.md`, `CLAUDE.md`, `assets/ASSET_RULES.md`, catalog와 manifest를 읽었다. 하위 Unity AGENTS/CLAUDE 파일은 없었다.
- 활성 빌드 장면은 `CompletedMapNpcFollow.unity`. `CompletedMapFollowSetup.cs`가 university_v003 FBX와 Happiness_Animations FBX를 배치하고 `NEUTRAL_WALK` 컨트롤러, NPC, 카메라를 만든다. 기존 빌더는 장면과 빌드 목록까지 다시 쓰므로 이번 작업에서 호출하거나 수정하지 않았다.
- 건물은 FBX 모델 프리팹 형태로 `SIMUS/Art/buildings/{commercial,houses,apartments,villas}`에 분리되어 있다. 종합 맵은 FBX 인스턴스이며 건물별 씬 프리팹으로 구성된 신규 도시가 아니다. Campus 전체는 156×212m 묶음이므로 단일 학교 건물처럼 새 구역 안에 넣지 않았다.
- 로컬 NPC는 `TestNpcPatrol`의 `MoveTowards`, 1.4m/s 이동, 회전 및 `NpcGrounding`으로 움직인다. NavMesh 기반 경로 탐색이 아니다. 기존 복제 NPC의 36m 왕복 구간을 새 보도에 두었으며 **로컬 크기/카메라 시험 구간**이다.
- `CityPreviewCamera`가 NPC 추적·전체 보기·탑뷰와 가림 표시를 제공한다. 복제 씬에서도 유지했다. Play에서 `1`/`2`/`F`로 전체/탑뷰/NPC 추적을 전환한다.
- `DevelopmentCityWebGLBuild`는 별도 생성 장면에 `WebCityBridge`와 `dev-synthetic-v1`을 넣는다. 웹 이벤트·스냅샷 연결은 이 개발 빌드 경로이며, 본 초안에는 브리지·전시 map_version·30개 이벤트 좌표·전시 NPC 경로를 넣지 않았다. 기존 런타임/웹/백엔드 코드는 수정하지 않았다.

## 배치와 치수

Unity XZ 평면, 중심 (0,0), 임시 외곽 202×202m다. 학교 북서, 상가 북동, 주거 남서, 공원 남동의 각 80×80m 구역은 설계 검토용이며 최종 지역 경계가 아니다.

- 중심선 X/Z = -94, 0, 94의 격자 도로: 차도 8m, 양쪽 보도 각각 3m. 모서리 보도 연결과 9개 교차로 접근부 횡단 표시를 포함한다.
- NPC 목표 키 1.7m(Blender 측정 Happiness FBX 약1.6926m), 상가 약12.6×17.1m, 주택 약11.45×15.4m, 아파트 약14.94×34.18m를 기준으로 폭·구역을 잡았다. 학교의 28×26m 낮은 표시는 미래 건물 공간만 나타내며 실제 Campus 단일 건물 치수로 주장하지 않는다.
- 학교 내부는 4m 보행축 두 개만 배치했다. 차량 진입로는 없다.
- 학교·상가·주거 출입 연결 여유 공간은 폭6m로 확보했다. 실제 문 위치·방향은 확인되지 않았으므로 연결 공간의 방향은 잠정안이다.
- 학교와 공원 보행축은 구역 가장자리 보도까지 연결된다. 단차/경사로/보행 충돌/NavMesh/접근성 검증은 다음 단계다.
- 복제한 대학 맵 인스턴스는 비활성 상태로 보존한다. 기존 실제 NPC 모델·애니메이션·카메라 참조를 재사용한다.
- **납품된 정적 씬의 상가·주택은 측정 치수의 박스 프록시**다. FBX `.meta`의 `internalIDToNameTable`이 비어 있어 Unity의 가져온 모델 ID를 추측해 직렬화하지 않았다. 아래 Unity 생성기를 실행하면 두 프록시만 기존 개별 FBX 인스턴스로 교체하며, 전체 건물을 재배치하지 않는다.

## 재생성 및 검증 방법

배치 원본은 `unity/Assets/SIMUS/Scenes/map_rebuild_draft/layout.json`, 도시 조립 코드는 `unity/Assets/Editor/MapRebuildDraftSetup.cs`다. Blender에서는 도시 조립을 하지 않았다. 원본 생성기와 빌드 목록은 이 코드가 변경하지 않는다.

Unity 메뉴:

1. `SIMUS > Map Rebuild > Regenerate Draft From Layout`: `GeneratedDraft` 루트만 교체하고 JSON을 재조립한다. 다른 사용자 루트는 유지한다. `GeneratedDraft` 안의 변경은 JSON에 반영해야 다음 실행에 유지된다.
2. `SIMUS > Map Rebuild > Validate And Capture Draft`: 두 번 재생성 후 계층/변환 동일성, 루트 중복, 원본 씬·빌드 설정 바이트 보존, 37개 보도 지지 레이를 검사하고 탑뷰/게임 카메라 PNG를 렌더한다. 이 함수는 구현했지만 **이번 실행에서는 미실행**이다. 카메라 렌더는 Play Mode 시험과 별개다.

CLI에서는 Unity에 `-projectPath <repo>/unity -executeMethod MapRebuildDraftSetup.ValidateAndCapture -batchmode -quit -logFile <path>`를 전달한다. 이미지 생성 시 `-nographics`를 사용하지 않는다. 실제 모델 로드와 렌더에 성공한 후 해당 출력물을 검토해야 한다.

현재 씬은 라이선스 차단 상태에서도 검토할 산출물이 있도록 원본 YAML 복사에 같은 JSON의 프리미티브를 직렬화한 초기본이다. 일회성 직렬화 스크립트는 `/tmp/create_simus_draft.py`에서 사용했으며, 이후 공식 편집·재생성 경로는 위 Unity 코드다.

## 실행한 검사

- `python3 scripts/unity/check-map-rebuild-draft.py`: **통과**. 297개 항목 이름·계층, 프리미티브 좌표·크기, 중복/끊어진 로컬 fileID(1,511개), 216개 횡단 표시의 차도 지지, 37점 로컬 보행 구간, 원본 NPC 참조, 복제 맵 비활성 확인. JSON SHA-256 `ba051e0addd56c8d75565d73de5978de10a232c87c249d813f3bea22b1e6d9f9`.
- 원본 `CompletedMapNpcFollow.unity` SHA-256는 시작/완료 모두 `0c0bb8b3c4b689a89f96c0be35327ee84940eec6a40ef030b0ba5cc01b13a966`로 동일하다.
- 조정 담당 재검사: 구조 검사 통과, 원본 씬이 Git HEAD와 바이트 단위 동일, 탑뷰 SVG XML 파싱 통과, `git diff --check` 통과.
- 필수 `python3 scripts/assets/catalog.py`와 `--check` 모두 실행했다. 기존 역할 NPC 원본 경로 누락 3건 및 Happiness 원본 해시 불일치로 생성 명령은 exit 1이며 inventory 쓰기를 거부했다. 따라서 inventory 갱신 완료가 아니다. 최종 검사 대상 852개 파일, `--check`는 기존 오류 4건과 오래된 inventory 1건으로 실패했다. 관련 manifest·원본을 임의 수정하지 않았다.
- Unity6000.3.24f1 실행 시도: 샌드박스에서 `listen EPERM ... /tmp/Unity-Upm-74298.sock`. 승인된 외부 실행 재시도는 소켓 연결 후 `Licensing initialization failed after 74.83s`, `com.unity.editor.headless was not found`, 라이선스 채널 재연결 실패를 반복했다. 본 작업이 시작한 PID74545만 종료했다. 로그는 `/tmp/simus-rebuild-probe.log`, `/tmp/simus-rebuild-probe-escalated.log`에 있다. **Unity 생성 함수 실행, C# 컴파일 성공, 재가져오기, 실제 렌더, Play Mode 성공을 주장하지 않는다.**
- 작업 중 다른 세션으로 보이는 Neighborhood 정리와 빌드 설정 변경이 나타났다. 이를 되돌리지 않았다. 본 코드/작업은 원본 씬과 빌드 설정을 쓰지 않았지만, 작업 전체 시각 전후 빌드 설정 해시는 외부 변경 때문에 동일하다고 주장하지 않는다.

## 변경 파일과 미확인 항목

이 담당 작업의 변경은 신규 `MapRebuildDraftSetup.cs`/`.meta`, `map_rebuild_draft` 폴더 및 `.meta`(씬, JSON, 10개 재질과 각각 `.meta`), `scripts/unity/check-map-rebuild-draft.py`, 본 보고서다. catalog 갱신과 개념도는 조정 담당이 수행한다.

미확인: Unity 실제 로드·컴파일·Play Mode·재생성 동일성 실행, 재사용 FBX 두 개의 Unity bounds/재질, 실제 문 방향, 학교 개별 건물 선정, 카메라 가림/원근 가독성, 경사로와 보행 안전성, 성능·타깃 기기. 장식 추가와 전체 건물 배치, 전시 맵 확정·이벤트 좌표·NPC 경로는 이번 단계에서 수행하지 않았다.
