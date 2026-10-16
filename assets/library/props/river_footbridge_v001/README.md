# River footbridge kit v001

CityRebuild_v002 Phase 4 하천용으로 새로 제작한 로우폴리 보행교 kit **1개 논리 에셋**이다. 원목 판재 deck, 측면 목재 마감, 하부 철골 거더·횡보, 분리 난간을 포함한다. 기존 모델을 수정하지 않았다. 외부 모델·이미지·텍스처를 사용하지 않고 Blender 기본 메시와 단색 재질로 제작했다.

납품 상태는 **received**이며 전시·타깃 기기 성능 승인과 별개다. 새 전시 `map_version`, 상황 좌표 또는 지역 경계를 지정하지 않는다.

## 원본과 교환본

- [Blender 원본](source/SIMUS_River_Footbridge_v001.blend): 별도 SOURCE_NORTH, SOURCE_SOUTH, SOURCE_RAIL_MODULE, SOURCE_RAIL_END_POST 씬과 PREVIEW_ONLY 조립 씬.
- [북측 28.70m deck](exports/RIVER_FOOTBRIDGE_NORTH_28_70.fbx)
- [남측 32.10m deck](exports/RIVER_FOOTBRIDGE_SOUTH_32_10.fbx)
- [2m 반복 난간](exports/RIVER_RAIL_MODULE_2M.fbx)
- [난간 끝 기둥](exports/RIVER_RAIL_END_POST.fbx)
- [조립 미리보기](previews/assembled_south_bridge.png), [판재·난간 상세](previews/deck_and_rail_detail.png)
- [실제 Blender FBX export/reimport 검사와 해시](reports/blender_export_validation.json)
- [최종 저장 원본 실제 재열기 검사](reports/blender_source_load_validation.json)
- 재생성 스크립트: [`scripts/assets/build_river_footbridge_v001.py`](../../../../scripts/assets/build_river_footbridge_v001.py)

기준 교환본은 `exports/`다. Unity 작업 사본 4개는 `unity/Assets/SIMUS/Art/props/river_footbridge_v001/models/`에 있으며 각각 기준 FBX와 바이트가 같다. 원본 `.blend`는 Unity에 복제하지 않는다. 텍스처 참조는 없고 색·roughness·metallic은 FBX 재질에 담긴다.

## Unity 배치 계약

| 항목 | 계약 |
|---|---|
| 길이 | NORTH=28.70m, SOUTH=32.10m |
| deck 외곽 폭 | 3.40m |
| deck 상면 | 모델 중심 원점의 높이 0. 상면 기준으로 wrapper를 지면 높이에 둔다 |
| deck 두께 | 상면 0…최저 −0.40m; 하부 거더 포함 |
| 피벗 | deck 양끝 중간 / 폭 중심 / 상면 높이 |
| 방향 | Blender X=폭, Y=길이, Z=높이. FBX −Z forward / Y up, metre / scale=1 |
| Unity 예상 import 축 | X=폭 / Y=높이 / Z=길이. 실제 Unity importer bounds 확인 결과를 후속 증거로 기록한다 |
| 난간 높이 | 1.10m, 하단 원점 높이 0 |
| 난간 module | 중심 피벗, 길이 2.00m / 폭 0.16m. 길이축으로 2m pitch 반복 |
| 난간 배치선 | deck local X=±1.60m. handrail 안쪽 면 X=±1.52m로 중앙 최소 3m 통행 폭 확보 |
| 물리 | FBX에 런타임 Collider/경로망 없음. Unity에서 deck 지지와 난간 차단 Collider 별도 생성 |

기존 보행 네트워크가 deck 측면 중간에 들어오는 지점이 있으므로 **난간을 교량 전장에 자동 연속 배치하지 않는다**. Unity가 진입부 주변 module을 생략하고, 각 끝을 별도 end post로 마감한다. module에는 시작 기둥 1개만 포함해 반복 시 기둥이 이중으로 겹치지 않는다. 끝 기둥은 자유 배치한다. Blender 원본에서 시작 기둥 중심은 local Y=−0.93m이며 FBX importer의 길이축 부호를 확인해 필요 시 module을 180° 회전한다. 이 회전은 deck 형상 배치에 영향을 주지 않는다.

module을 길이 방향으로 확대하면 기둥·세로살 간격도 함께 변한다. 가급적 2m 반복을 사용하고 잔여 길이 처리는 별도 끝 기둥과 Unity 배치로 결정한다. 수로 위 구간의 난간을 보행망 연결 검토 없이 생략하지 않는다. 단순 외형 제작은 실제 교량 구조·안전 규격 검증이 아니다.

## 검증 범위

Blender 5.2.2 LTS에서 실제 FBX 내보내기 후 새 씬으로 재가져와 모든 mesh bounds와 material 이름을 비교했다. 최대 bounds 차이는 0.000006m 미만이다. 북측 deck 4,148 tris, 남측 deck 4,588 tris, 2m 난간 616 tris, 끝 기둥 44 tris. 실제 수치는 위 JSON에 기록했다.

최종 저장 `.blend`도 별도 Blender 프로세스에서 실제로 다시 열어 4개 SOURCE 씬의 오브젝트·치수·피벗·재질을 검사했다. 이 검사는 원본을 다시 저장하지 않으며 원본 해시는 manifest와 동일하다.

미리보기는 실제 Blender mesh 렌더이며, 배경 지면·끝단 받침은 PREVIEW_ONLY 씬의 설명용 오브젝트다. 이들은 FBX에 포함되지 않는다. 중간 난간 간격도 진입부 배치가 가능함을 보여주는 예이며 현재 Unity 연결 지점과 동일하다는 뜻은 아니다.

Unity 6000.3.24f1에서 실제 가져오기 후 북측 3.4×0.400003×28.70m, 남측 3.4×0.400004×32.10m, 난간 0.16×1.10×2.00m를 확인했다. FBX importer가 생성한 축 변환을 자식에 보존하고 바깥 wrapper에 도시 yaw를 적용한다. wrapper가 원래 import 회전을 덮어쓰면 deck가 수직으로 서므로, 배치 후 world 높이도 약 0.40m인지 검사한다. 기존 보행면과의 겹침을 피하기 위해 시각 모델만 8mm 올렸으며 Collider와 경로의 상면은 Y=0.14m다.

[Unity 적용·실측 결과](../../../../docs/verification/city-rebuild-v002-river-unity-results.json)와 [하천 QA](../../../../docs/verification/city-rebuild-v002-river-qa.md)에서 실제 씬·NPC 검증 범위를 확인한다. Blender reimport 성공을 Unity 실행 증거로 대체하지 않는다. catalog 생성/검사는 메인 에이전트가 다른 씬 작업과 함께 실행한다.
