# CityRebuild_v002 — Phase 4 하천 구현·QA

최종 확인: 2026-10-16, Unity 6000.3.24f1. 설계 결과를 사용자에게 먼저 보고한 뒤 현재 작업 씬에 증분 적용했다. **하천 구현과 실제 NPC 왕복 검증은 PASS**다. 전체 자산 카탈로그는 하천과 무관한 기존 캐릭터 원본 해시 불일치 때문에 실패한다. 전시 `map_version`, 상황 좌표, 운영 승인과는 별개다.

[작업 씬](../../unity/Assets/SIMUS/Scenes/city_rebuild_v002/CityRebuild_v002.unity) · [설계](../planning/city_rebuild_v002/river-design.md) · [씬 사용법](../../unity/Assets/SIMUS/Scenes/city_rebuild_v002/README.md)

## 구현 결과

동쪽 공원 안에 약 171m 길이의 곡선 하천을 추가했다. 수면 폭 10m, 양쪽 산책로 각 2.4m, 둔치와 사면을 포함한 전체 폭 24m다. 하상 Y=-2.00m, 수면 Y=-1.20m, 둔치 Y=-0.45m로 구분하며 `CityGround`와 `EastPark_Lawn`의 시각 메시·Collider를 실제로 절개했다. 수면에는 보행 Collider가 없다.

기존 길을 유지하는 북측 28.70m·남측 32.10m 보행교 두 개를 배치했다. 양안 산책로는 기본 Y=-0.428m에서 기존 길·교량과 만나는 곳까지 완만히 올라가며 실제 메시의 최대 경사는 **4.686%**다. 유효 통행 폭은 3m이고 기존 길과 연결되는 난간 진입부를 열었다. 절개 영역과 겹치는 추가 공원 나무 12개는 원오브젝트를 보존한 채 비활성화했다.

Blender는 기존 하천·교량 전용 에셋이 없음을 조사한 뒤 [보행교 kit 하나](../../assets/library/props/river_footbridge_v001/README.md)만 신규 제작했다. 원본 재열기와 FBX export/reimport를 검증했으며 Unity에서도 실제 치수, 축 변환, 배치 후 높이를 검사했다. 기존 건물·도로·원본 맵 FBX를 재제작하지 않았다.

수질은 `CityV002RiverWater`가 오염도 0~100을 수면 색·매끄러움에 반영한다. 도시 전체 오염도가 제공되면 기존 `CityStatePoller` 또는 `CityStateAssets`를 사용하고, 미확정 지역 코드는 추정하지 않는다. `MaterialPropertyBlock`으로 공유 원본 머티리얼을 보존한다.

## 실제 Unity 화면

아래 이미지는 설계도나 Blender 예시가 아닌 최종 씬의 **Play Mode Camera.Render** 출력이다.

- [하천 전체 보기](city-rebuild-v002-river-captures/river-overview-clean.png)
- [보행교·둔치 근접](city-rebuild-v002-river-captures/river-bridge-detail.png)
- [탑뷰](city-rebuild-v002-river-captures/river-top.png)
- [청정 수질](city-rebuild-v002-river-captures/river-bank-clean-close.png) / [오염 수질](city-rebuild-v002-river-captures/river-bank-polluted-close.png)

최종 시각 검토에서 교량이 수평으로 놓이고 난간이 세워진 것을 확인했다. 교량과 기존 길의 동일 높이에서 발생하던 깜빡임은 교량 시각 마감 8mm 여유와 산책로 전용 depth bias로 해소했다. Collider와 경로 높이는 유지했다. 주변의 옆으로 누운 일부 기존 Phase 4 나무는 이번 하천 신규 자산이 아니며 이 작업에서 전체 공원 원본 배치를 재작성하지 않았다.

## 검증 증거

| 검사 | 결과 | 근거 |
|---|---|---|
| 건물 69동·도로·교차로·보호 파일 | PASS | 실제 직렬화 transform·도로 subtree와 [작업 전 기준선](city-rebuild-v002-river-baseline.json) 비교 |
| 독립 정적 검사 | 21개 PASS | [정적 결과](city-rebuild-v002-river-static-results.json), 실제 파일·삼각형을 읽는 검사 |
| 하상·수면·둔치 분리 | PASS | 실제 수면 단면 264개와 끝단 28개 샘플; 물 아래 기존 ground/lawn 584회 검사에서 잔존 0 |
| 기존 보행망 유지 | PASS | 원래 409개 간선의 ID와 XZ 경로 유지, 최종 572 nodes / 597 edges |
| Unity 중심선 지지 | PASS | 35,489개 샘플; 물 침범·지지 누락 0 |
| 유한 폭 통행 공간 | PASS | 7,461개 폭 샘플, 반경 0.2m capsule 충돌 0; 실제 교량 Collider hit 665회 |
| 실제 NPC 이동 | 5개 경로 왕복 PASS | 양안·공원 접속·북교량·남교량, 각 도착 2회; 물 침범·지면 이탈·충돌·guard 거부 0 |
| 수면 횡단 금지 | PASS | 직접 물 횡단과 다리 아래 수중 횡단 거부, 교량 상면 통과 허용 |
| 수질 머티리얼 | PASS | 0/50/100 보간·매끄러움 변화·원본 공유 머티리얼 보존 확인 |
| Play Mode 입력 보존 | PASS | 씬·하천 메시·FBX·재질·관련 코드의 실행 전후 해시 동일 |
| EditMode 회귀 테스트 | 8/8 PASS | 수질 5개, 수면·교량·guard 2개, 내리막 지면 선택 1개 |

[Unity 적용·물리 결과](city-rebuild-v002-river-unity-results.json) · [Play Mode 결과](city-rebuild-v002-river-runtime-results.json) · [실행 입력 해시](city-rebuild-v002-river-runtime-inputs.json) · [EditMode 테스트 XML](city-rebuild-v002-river-tests.xml)

실제 FBX NPC와 기존 `TestNpcPatrol`, `NpcGrounding`을 사용했다. 왕복 테스트는 이동 속도 1.4m/s, 테스트 중 timeScale=8로 수행했으며 운영 이벤트·최대 대기 90초 로직은 수정하지 않았다. 최종 실행 5개 경로의 궤적 샘플은 254,495개이고 최대 발 지면 오차는 약 0.000036m다. 이는 Editor 검증이며 NavMesh bake, 군중 회피, WebGL/전시 성능 수치를 의미하지 않는다.

로컬 서버가 실행되지 않아 localhost:3000 연결 실패 로그가 있다. 이번 수질 검증은 실제 렌더러에 0/50/100을 입력해 수행했으며 운영 서버에서 받은 오염도 변경의 종단 간 검증은 하지 않았다. 테스트가 기록한 runtime exception/error는 0건이다.

## 발견하고 수정한 문제

- 절개 경계에 생긴 0.1mm 미만 높이의 긴 삼각형을 제거했다. 점 ray 검사로 보이지 않던 NPC capsule 충돌이 원인이었다.
- 낮은 양안 길과 기존 길·교량의 교차부는 높이를 맞추고 흙 받침을 만들었다. 사면 아래로 파고들던 대각선 연결은 산책로의 경사 전이를 활용한 수평 접속으로 바꿨다.
- FBX importer 축 변환은 자식에 보존하고 도시 yaw는 바깥 wrapper에 적용했다. 실제 배치 후 deck 높이를 검사해 수직으로 서는 오류를 방지했다.
- 내리막에서 다음 waypoint 높이로 바로 이동하던 참조 높이를 현재 구간의 XZ 진행률로 보간했다. 아래 하상 평면이 NPC grounding을 잘못 잡는 문제를 수정했다.
- EditMode guard 테스트는 일반 MonoBehaviour의 `OnEnable`이 자동 호출되지 않는 조건을 반영해 안전한 시작 위치를 명시적으로 초기화했다. 물 횡단 거부 단언은 유지했다.

[첫 실패 실행](city-rebuild-v002-river-logs/runtime-attempt1-failed.json)과 [수정 후 실행](city-rebuild-v002-river-runtime-results.json)을 구분해 보관했다. 정적 PASS를 실행 PASS로 대체하지 않았다.

## 카탈로그와 남은 범위

필수 `python3 scripts/assets/catalog.py`와 `python3 scripts/assets/catalog.py --check`를 실행했다([실행 결과](city-rebuild-v002-river-catalog-results.json)). 현재 4,221개 파일 / 동일 내용 그룹 20개를 조사했으나 다음 기존 manifest 키의 원본 해시가 파일과 다르다.

- `modular_character_happiness_animations_v001`
- `crying_child_v001`
- `heavy_carrier_v001`
- `heavy_box_v001`

생성은 4개 오류로 inventory 쓰기를 중단하고, `--check`는 위 4개와 오래된 inventory까지 총 5개 오류를 반환했다. 기존 캐릭터 원본의 의미·승인 근거를 추정해 해시를 덮어쓰지 않았다. 새 `river_footbridge_v001` 원본·교환본 경로와 해시는 일치하며 상태는 `received`다.

씬은 `SIMUS > City Rebuild v002 > Apply Phase 4 River`로 증분 생성한다. 원래 Phase 4 전체 재생성은 하천이 존재할 때 차단하며, Phase 1~3 전체 재생성은 수동 편집을 교체할 수 있으므로 하천 편집에 사용하지 않는다. Phase 5 재적용 시 하천 그래프를 복원하는 코드가 있으나 그 메뉴의 별도 재실행 검증은 이번 범위에 포함하지 않았다.
