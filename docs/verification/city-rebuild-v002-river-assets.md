# CityRebuild_v002 — Phase 4 하천 에셋 조사와 최소 제작안

이 문서는 **설계 검토 단계의 읽기 전용 조사**다. Blender 저장·내보내기, Unity 모델·재질·씬 변경, manifest 승인 상태 변경은 수행하지 않았다. `AGENTS.md`, `assets/ASSET_RULES.md`, catalog README, manifest, inventory와 실제 파일을 대조했다. 다른 작업자의 기존 변경은 유지했다.

## 현재 씬에 반영해야 할 기준

사용자 설명은 Phase 3 완료 기준이지만 현재 저장된 씬에는 `09_ParkAndGreenery`, `EastPark_Lawn`, `Trees`, `ParkBenches`와 Phase 4 파생 메시가 이미 있다. [Phase 4 실행 결과](city-rebuild-v002-phase4-results.json)는 증분 Editor 조립 PASS와 공원 모듈 2개를 기록한다. 따라서 하천 구현은 실제 저장 씬의 공원 지면·장식·Collider까지 조사한 후 증분 적용해야 한다. Phase 4 전체 생성기 재실행으로 수동 변경을 교체하면 안 된다.

배치 기준은 [현재 layout](../planning/city_rebuild_v002/layout.json)이며, 아래 좌표는 모두 그 파일의 Unity X/Z다. 이전 Neighborhood 자산의 좌표를 사용하지 않았다.

- 동쪽 공원 경계: `(88,-39), (123,-39), (159,-12), (176,33), (180,94), (169,142), (133,174), (90,169), (84,128), (91,75), (85,26)`.
- PM1: 중심 `(140,25)`, 12×12m, footprint X=134…146 / Z=19…31.
- PM2: 중심 `(142,118)`, 12×12m, footprint X=136…148 / Z=112…124.
- 공원 기존 보행로와 모듈 간섭 후보: `PKE06_S0` `(166,30)→(140,25)`, `PKE07_S0` `(140,25)→(114,2)`, `REST_2_LINK_S0` `(142,118)→(165,100)`, 모두 폭 2.5m. 하천 횡단이 생기는 곳에는 명시적 교량 또는 경로 수정이 필요하다.

## 기존 자산 조사

inventory와 실제 `assets/`, `unity/Assets/SIMUS/Art/` 파일명, manifest 논리 키에서 독립 river/stream/riverbank/pedestrian bridge 자산을 찾지 못했다. 이름 검색만으로 내부 형상 부재를 단정하지 않기 위해 기존 binary FBX reader로 대학 맵·공원·난간·잔디의 Objects/Geometry도 읽었다. 이 검사는 Blender/Unity 가져오기나 시각 검증을 대신하지 않는다.

| 용도 | 실제 파일 / 관찰 | 판단 |
|---|---|---|
| 하천 바닥·사면·둔치 | 독립 교환 자산 미발견 | 확정 경로에 맞춘 신규 연속 메시 필요. 기존 평지와 공원 잔디를 개구부에 맞게 절개해야 함 |
| 수면 | `unity/Assets/SIMUS/Art/maps/university_v003/Materials/SIMUS_Dense_Realistic_University_Map_03-R02_UNITY_SP_Water.mat` | 실제 존재. 불투명 Standard 계열, `_Color=(0.075,0.21,0.25,1)`, `_Glossiness=0`; 하천 형상이나 수질 제어기는 아님. 새 수면 전용 재질의 색 참고 가능 |
| 추가 물 재질 | `unity/Assets/Materials/water_0F4168490E.mat` | 실제 존재. `_Color`, `_Glossiness`만 저장된 재질이며 현재 하천/오염도 연결 근거 없음. 공유 재질 덮어쓰기 금지 |
| 기존 맵 내부 물 관련 노드 | `SIMUS_Dense_Realistic_University_Map_03.fbx` | binary FBX Model 1,817개 / Mesh Model 1,669개 조사에서 물 관련 이름은 `FX_PARK_WATER_MATERIAL_18` **Null anchor**만 확인. 하천 지형으로 재사용할 메시가 아님. anchor 위치를 새 하천 위치로 사용하지 않음 |
| 공원 모듈 | `COZY_NEIGHBORHOOD_PARK.fbx`, `MODERN_MINIMAL_PARK.fbx` | 기존 배치 유지 후보. 실제 FBX는 각각 단일 통합 메시. 새 하천을 위해 통째로 확대하거나 수로로 전용하지 않음 |
| 다른 공원 후보 | `ECO_RAIN_GARDEN.fbx`, `ZEN_GARDEN_PARK.fbx` | 각각 단일 통합 메시 9,697 / 20,268 vertices, local footprint 12×12m, local 최저 높이 −0.30m. 별도 하천 바닥·교량이 확인된 자산이 아니므로 이름만 보고 재사용하지 않음 |
| 난간 | `unity/Assets/SIMUS/Art/props/city_state_v001/models/SAF_FENCE_NORMAL_01.fbx` | 실제 존재, 224 vertices. geometry local 치수 약 2.29×0.09×1.10m. 보행교/급경사 가장자리 난간 후보. 실제 Unity import world 치수·끝단 이음·스타일 검토 후 사용 |
| 잔디 | 같은 models의 `POL_GRASS_HEALTHY_01.fbx` | 실제 존재, 62 vertices, geometry 치수 약 2.40×1.40×0.036m. 얇은 장식 패치이며 둔치 지형/사면 Collider를 대신할 수 없음 |
| 나무·벤치 | `unity/Assets/SIMUS/Art/props/props/STREET_TREE.fbx`, `REUSED_BENCH.fbx` | 현재 Phase 4에서 재사용한 자산. 기존 인스턴스를 우선 보존하고 새 하천 개구부·보행 통행 폭과 겹치는 장식만 국소 조정 |
| 나무·벤치 대체 후보 | city-state `POL_TREE_HEALTHY_01.fbx`, `SAF_BENCH_NORMAL_01.fbx` | 기존 FBX 존재, 이전 감사 geometry 치수 약 2.683×2.552×4.688m / 1.800×0.568×0.973m. 신규 제작 불필요 |

city-state의 나무·벤치·난간·잔디 manifest 상태는 `received`다. 이들의 manifest `source_file`인 `assets/library/props/city_state_v001/source/SIMUS_City_State_Assets.blend`는 조사 시점 **존재하지 않는다**. FBX 인스턴스 재사용과 원본을 편집할 수 있다는 주장을 구분해야 한다. 기존 FBX의 원본을 임의 복제하거나 manifest를 사실과 다르게 고치지 않았다. 난간을 재제작해야 한다면 독립 신규 원본으로 제작한다.

## 필요한 최소 신규 형상과 재질

1. **하천 지형 1세트**: 확정된 완만한 곡선 중심선에서 동일 단면을 sweep한 바닥·수변 사면·양안 둔치·외측 사면. 기존 `CityGround`와 `EastPark_Lawn`은 이 외측 경계 내부를 삭제/재삼각분할해 실제 개구부를 만든다. 위에 메시를 겹치는 방식으로는 낮은 수로가 드러나지 않는다. 인접 mesh 경계는 동일 좌표를 공유하고, Collider에도 같은 개구부를 적용한다.
2. **독립 수면 1개**: 수로 안쪽에만 위치하는 저밀도 strip mesh. 바닥보다 높고 둔치보다 낮게 분리한다. 양안 경계와 끝단에서 지면 아래로 숨거나 짧은 경계 구조에 연결해 틈을 막는다. 수면을 보행 지지 Collider로 등록하지 않는다.
3. **보행교 최소 1개**: 독립 deck·양쪽 접근부·난간. deck 유효 폭은 기존 산책로 2.5m와 연결 가능한 약 3m를 검토한다. 길이는 확정 단면의 교대 간 거리로 결정하며 8~12m 수면 폭만으로 결정하지 않는다. 기존 난간 재사용이 적합하면 신규 난간 모델은 만들지 않는다. 교량 아래의 물 금지 영역과 bridge 통행 높이를 구분한다.
4. **수질 전용 Unity 재질 1개**: mesh 재제작 없이 오염도에 따라 색·탁도 표현을 변경할 수 있도록 수면 Renderer 전용 material/property 계약을 둔다. 기존 공원/맵 공유 재질을 직접 수정하지 않는다. 깨끗함/중간/오염 상태의 색을 별도 파라미터로 제공하고, Unity 담당자가 현재 도시 오염도 입력 계약과 연결한다. Blender에 수질 상태별 수면 형상을 여러 개 만들 필요는 없다.

설계 검토용 권장 단면은 주변 지면을 `H=0`으로 놓고 하상 약 `H−2.0m`, 수면 약 `H−1.25m`, 둔치 산책로 약 `H−0.35m`다. **확정값이 아니며** 실제 평지/보도 높이를 읽은 뒤 조정한다. 양쪽 산책로 2.5m와 어깨/사면을 포함하면 수면 10m라도 총 개구부는 약 24~28m가 필요하다. 하천 폭 8~12m 검토에서 주변 녹지에 이 전체 폭이 들어가는지 확인해야 한다. 낮은 둔치와 기존 지면은 짧은 급경사 단차 대신 검증 가능한 접근 경사로로 연결한다.

로우폴리 형상은 장거리 곡선에 필요한 분할만 사용하고 둔치·사면의 면별 법선을 살린다. 수로 사면 경계가 각지더라도 물폭·양안 보행 폭과 충돌 여유를 일관되게 유지한다. 바닥·수면·둔치·교량 deck은 별도 오브젝트/재질 슬롯으로 두어 Collider와 수질 제어를 분리한다.

하천 경로는 Unity 생성 메시로 제작하면 지형 절개와 수면 경계의 정확한 일치를 관리하기 쉽다. 이 경우 불필요한 동일 형상의 Blender/FBX 복제는 만들지 않는다. Blender 제작이 필요한 최소 항목은 재사용 후보가 없던 **보행교 deck/교대**이며, 보행교를 Unity 독립 메시로 제작할 수 있다면 Blender 신규 자산도 필수는 아니다. 제작 방식은 경로와 교량 지점 보고 후 정한다.

## 보행교 kit 1개로 제작 범위를 제한하는 제안

통합 설계자가 검토 중인 조건은 전체 하천 단면폭 24m / 실제 수면 10m, 기존 보행 높이 `y=0.14m`를 유지하는 보행교 2개, 각 길이 24~30m / 유효폭 3m / 난간 높이 1.1m다. 하천 절개와 지형은 Unity 생성기가 소유하고 Blender 신규 제작은 **보행교 kit 논리 자산 1개**로 제한하는 것이 적절하다. 이 조건은 검토안이며 현재 제작하지 않았다.

기존 `SAF_FENCE_NORMAL_01.fbx`의 polygon connectivity를 추가로 읽으면 13개 연결 성분이다. 양끝 주기둥 중심은 local X=±1.10m, 기둥 폭 0.09m / 높이 1.10m다. 상하 수평재는 X=−1.10…1.10m, 높이 약 0.217…0.283m / 0.897…0.963m다. 내부 세로살 9개는 중심 간격 0.24m, 폭 0.042m이므로 순틈 약 0.198m다. **기하 관찰이며 안전 기준 충족 판정은 아니다.**

외곽 bounding 폭 2.29m 간격 반복은 끝 기둥 사이에 틈을 만들고, 중심 간 pitch 2.20m로 반복하면 끝 기둥이 겹친다. 길이 24/30m에 맞춘 종단 처리를 고려하면 기존 fence 인스턴스 다수를 그대로 반복하는 이득이 작다. 따라서 kit 안에 동일 lowpoly 분위기의 연속 난간을 포함하고 반복 주기와 끝 기둥을 파라미터로 생성하는 방식을 권장한다. 난간 전체 길이만 Unity에서 비균등 확대하면 기둥 폭/간격도 변하므로 길이가 확정된 뒤 원본에서 해당 길이의 교량을 생성한다.

하나의 `.blend` 원본과 하나의 논리 kit asset에서 두 실제 길이의 FBX를 내보낼 수 있다. 각 export는 `deck`, `abutment_start`, `abutment_end`, `rail_left`, `rail_right`를 분리하고 FBX 내부 object 이름으로 구분한다. 상면을 wrapper local Y=0에 맞춰 Unity wrapper y=0.14m에 설치하고 deck 두께는 아래로 둔다. 수로 중앙 기둥은 수면·유수 단면과 간섭하므로 우선 교대 지지 형식으로 설계한다. 단순 외형은 구조공학 검증을 뜻하지 않는다. Unity는 deck/접근부 통행 Collider와 난간 차단 Collider, 물 진입 금지 영역을 별도로 소유한다.

## 이후 제작 시 저장 계약과 검증

Blender 자산을 만드는 경우 신규 묶음은 예를 들어 `assets/library/props/river_footbridge_v001/{source,exports,previews}`에 두고 README·실제 해시를 갖춘 `received` manifest 행을 추가한다. Unity 작업 사본은 `unity/Assets/SIMUS/Art/props/river_footbridge_v001/`만 사용하며 기존 `.meta`/GUID는 보존한다. 이 경로는 **제안**이며 현재 폴더를 생성하지 않았다.

Unity 구현 전: 경로 전체 외측 절개 폭과 실제 건물 envelope·차도·보행 meshes·기존 나무 Collider의 교차를 조사한다. 교차하는 기존 보행 edge는 제거/수면 위 방치하지 말고 교량에 올리거나 둔치 연결로로 재구성한다. 물 진입 금지 영역만 추가해 기존 edge를 막으면 보행망 단절이 되므로 경로 탐색 연결도 함께 검증한다. NPC 바닥 ray가 전역 지면을 찾을 수 있으므로 개구부 Collider 절개와 실제 route body sweep이 필요하다.

구현 후: 건물·도로 transform 보호 비교, 양안 보행 지지/몸통 여유 검사, 교량 양단 연속성, 수면 내부 route segment 0개(교량 deck 제외), 실제 NPC 물 진입 0건, 세 수질 입력에서 수면 재질 변화와 다른 재질 불변을 확인한다. 정적 경로 검사만으로 NPC Play Mode 성공을 주장하지 않는다.

이번 조사에서 자산 파일 변경은 없으며 catalog 생성/검사는 메인 에이전트가 다른 작업 결과와 함께 한 번 실행한다. 본 조사만으로 전시 승인·최종 map_version·상황 좌표·서버 지역 경계를 확정하지 않는다.
