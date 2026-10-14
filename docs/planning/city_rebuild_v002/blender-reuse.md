# Blender 기존 에셋 재사용 검토 — 도시 리빌드 v002

상태: 사용자 승인 전 설계 입력. 새 `map_version`, 30개 상황 좌표, 확정 NPC 경로를 만들지 않았다. 기존 Blender 원본·FBX·Unity 씬·메타·NPC·카메라·웹·백엔드는 수정하지 않았다. 기존 에셋을 최대한 유지하면서 도로와 주변 건물 배치를 개선한다는 이번 사용자 지침을 적용했다. 2×2 동일 면적 구역은 재사용하지 않는다.

## 재사용한 조사와 추가 조사

- [이전 Blender 조사](../../verification/map-rebuild-blender-2026-10-13.md)의 23개 원본·5개 FBX 읽기 결과(`/tmp/simus_asset_audit.json`, `/tmp/simus_fbx_audit.json`)를 다시 측정하지 않고 사용했다. 단위는 METRIC, scale_length 1.0이다.
- 부족했던 공원 5개와 식생 원본 1개만 Blender 5.2.2 LTS background에서 저장 없이 추가 측정했다. 공원 원본은 library-file/empty-scene 경고를 냈으나 bpy.data.objects에 메시가 존재했다. 측정은 world matrix를 적용한 데이터 메시 AABB이며, 현재 linked-scene 가시성/Unity FBX import 검증을 대신하지 않는다.
- 학교 몸체의 비직사각 형태를 확인하기 위해 Campus.blend의 14개 몸체만 읽고 수평 상부 면을 XY 삼각형으로 추출했다. [실형상 증거](campus-footprint-evidence.json)는 실제 탑뷰 실루엣 렌더와 충돌 정밀 검사 입력이다.
- sandbox Blender는 시작 시 exit 139로 실패했고, 승인된 외부 sandbox 읽기 실행은 exit 0이었다. 모두 open_mainfile와 측정만 수행했으며 save/export 연산은 없다.

## 좌표와 원점 계약

`asset_measurements.json`은 원본 Blender world X,Y,Z와 모델별 SHA-256을 보존한다. Blender 평면 X,Y / 높이 Z를 설계용 Unity 평면 X,Z / 높이 Y로 표현한다. 학교 최초 보존 배치의 중심은 (X=0,Z=65), yaw=0, 축척=1이다.

학교 설계 변환은 `(U.X,U.Y,U.Z)=(B.X, B.Z-0.18, B.Y+65)`다. Campus surface 상면 0.18m를 외부 설계 지면 Y=0에 맞추는 제안이다. 기존 Walk 상면은 0.300~0.307m여서 설계 지면보다 0.120~0.127m 높다. 본체 기단/문턱도 높이 차가 있어 접근 램프·충돌체·NavMesh 접합을 구현 때 검증해야 한다. 이 계산은 Unity 실제 FBX 축 변환/handedness/root offset 검증을 대신하지 않는다.

`campus-components.csv`의 x,z는 기단 중심 기준의 초기 원형 보존 좌표이고, width/depth는 roof AABB, min/max는 canopy/계단/parapet까지 포함한 보수적 envelope다. body L형 실루엣과 footprint 사각 envelope는 다르다. 최종 QA 수정 위치/회전은 Unity 담당 `layout.json` 및 `campus-placements.csv`가 우선한다. CSV door는 실측 유리문 메시 중심이며, approach는 기단 남쪽 1.8m 여유를 둔 후보이다. 이것을 Unity에서 실제 통행 검증된 문 앞 좌표라고 해석하지 않는다.

Campus mesh 487개는 직접 parent가 없다. Campus surface/plinth 등 mesh 원점은 (0.72,-1.067,-0.036)에 있고 scale 1.2이며, D03 추가 기단/문/계단은 원점 0과 scale 1이 혼재한다. 원점만 맞춰 건물을 재배치하면 구성품이 어긋난다. 반드시 측정한 world geometry를 유지한 adapter를 쓴다. 다른 건물도 mesh별 origin과 parent가 서로 달라 전체 bounds의 중심=편집 root origin이라고 가정하지 않는다.

## 학교 구성 보존과 조건부 분리

전체 학교 범위는 X ±78.120, B.Y ±106.093, 약 **156.24×212.186m**다. 원형을 단순 축소하거나 80×80m 부지 안에 넣지 않는다. 14개 건물, 운동장, 농구장, 테니스장, 중앙정원, 기존 수목을 우선 재사용한다. 원형 위치를 최대한 보존하고 도로/내부 보행 연결을 새 설계에 맞춰 개선한다.

| ID | 기존 건물 | 지붕 평면 m | 기단 중심 설계 X,Z | 전체 높이 envelope m |
|---|---|---|---|---|
| C00 | 서관 | 43.80×12.12 | -41.100, 162.393 | 11.844 |
| C01 | 서측동 | 12.36×30.24 | -69.060, 152.373 | 13.044 |
| C02 | 실습관 | 19.08×16.56 | -63.900, 127.053 | 9.444 |
| C03 | 동관 | 31.56×12.84 | 12.060, 140.913 | 14.244 |
| C04 | 중앙동 A | 10.56×13.56 | -40.680, 76.713 | 11.844 |
| C05 | 중앙동 B | 15.48×21.96 | -25.500, 76.353 | 16.644 |
| C06 | 중앙동 C | 11.64×13.20 | -11.100, 73.533 | 10.644 |
| C07 | 국제관 | 29.52×38.04 | 46.320, 76.473 | 19.044 |
| C08 | 산학협력관 | 21.84×36.24 | 52.920, 39.093 | 15.444 |
| C09 | 창업관 | 14.52×24.96 | 69.300, 9.933 | 13.044 |
| C10 | 남관 | 48.24×11.28 | 43.080, 3.453 | 13.044 |
| C11 | 체육관 | 25.20×32.28 | -42.480, -20.607 | 11.844 |
| C12 | 학생시설 | 30.60×22.08 | -11.100, -19.227 | 10.644 |
| C13 | 지원시설 | 10.80×10.92 | 46.560, -12.207 | 8.244 |

**정문/후문은 기존 gate 메시 재사용이라고 주장할 수 없다.** gate 이름 메시가 발견되지 않았다. 남측 학교 경계(Z≈-41.093)의 정문과 북측(Z≈171.093)의 후문은 새 보행 개구부/게이트 제작 후보이며 정확 위치는 최종 설계를 따른다. Central garden은 실제 26.16×8.64m 녹지이며, 주변 중앙광장 면적은 보행 설계상 새로 정하는 제안이다.

| 보존 시설 | 실측 평면 m | 원형 보존 설계 bounds X,Z |
|---|---|---|
| Basketball court | 11.16×17.52 | [-7.32, 37.413] → [3.84, 54.933] |
| Central garden | 26.16×8.64 | [-37.32, 92.853] → [-11.16, 101.493] |
| Field lawn | 67.32×52.56 | [-63.96, 9.453] → [3.36, 62.013] |
| Sports field | 54.12×48.48 | [-61.32, 11.733] → [-7.2, 60.213] |
| Tennis court | 7.80×14.04 | [63.0, 27.333] → [70.8, 41.373] |

14개 학교 건물별 정확한 분리 대상은 JSON `campus.components[].split_objects`에 기록했다. 총 308개 구성 메시이고 나머지 179개는 공유 바닥/도로/보행로/운동장/수목 등이다. 각 목록은 건물 몸체, roof, windows, 가장 가까운 해당 window-frame, 같은 index의 BUILDING_PLINTH/PARAPET/CANOPY/ENTRY_GLASS/DOOR_FRAME/ENTRY_STEP을 포함한다. 창문 프레임은 원래 hash형 이름 때문에 window AABB와 대조해 식별했으며 가장 가까운 목록의 bounds 차이 합계는 모두 0.132m다. 부분 분리를 시행하면 사전 시각 확인을 다시 한다.

재사용 1차 경로는 기존 대학 FBX의 `D03_UNITY_GROUP_CAMPUS` 487개이다. 이를 읽기만 한 Blender FBX audit에서 원본과 같은 학교 bounds를 확인했다. 개별 건물 FBX가 필요하면 사용자 승인 후 새 파생 `.blend`/FBX를 만들고, 본체와 구성품을 함께 group한 뒤 기단 중심 ground anchor로 rebase한다. 현재 `Campus.fbx` 독립 파일 자체는 가져오기 검사하지 않았다. 대학 FBX group 확인을 독립 Campus.fbx 검증으로 표기하지 않는다.

## 건물·공원·도로 재사용 목록

아래 경로 기준은 `unity/Assets/SIMUS/Art/`다. 치수는 원본 mesh world AABB의 X×B.Y×높이이다. 개별 상가01·주택01 FBX만 이전 읽기 검사에서 같은 치수/ground-centered 범위를 확인했다. 나머지 FBX는 존재와 해시만 기록했으며 import/재질/LOD/성능/전시 승인은 미확인이다.

| 파일 stem / 분류 | 가로×깊이×높이 m | 재사용 판단 |
|---|---|---|
| `VILLA_03_CORNER_MIXED` | 18.546×19.420×11.896 | 개별 건물; FBX import 미확인 |
| `VILLA_02_STONE_MODERN` | 21.414×18.668×14.528 | 개별 건물; FBX import 미확인 |
| `VILLA_01_PILOTI_BRICK` | 20.474×16.788×17.291 | 개별 건물; FBX import 미확인 |
| `HOUSE_03_NARROW_HOUSE` | 11.450×13.084×9.605 | 개별 건물; FBX import 미확인 |
| `HOUSE_01_URBAN_MODERN` | 11.450×15.400×9.755 | 개별 건물; FBX 읽기 확인 |
| `HOUSE_02_OLD_BRICK` | 13.750×15.590×7.571 | 개별 건물; FBX import 미확인 |
| `COMMERCIAL_01_OLD_MULTI_TENANT` | 12.600×17.100×16.488 | 개별 건물; FBX 읽기 확인 |
| `COMMERCIAL_03_MODERN_CORNER` | 14.400×18.000×13.878 | 개별 건물; FBX import 미확인 |
| `COMMERCIAL_02_NEIGHBORHOOD_CENTER` | 20.250×19.800×13.383 | 개별 건물; FBX import 미확인 |
| `DEPARTMENT` | 24.410×18.800×13.740 | 개별 건물; FBX import 미확인 |
| `APARTMENT_C_MIDRISE` | 20.180×30.090×37.600 | 개별 건물; FBX import 미확인 |
| `APARTMENT_A_MIDRISE` | 14.940×34.180×43.480 | 개별 건물; FBX import 미확인 |
| `APARTMENT_B_MIDRISE` | 22.180×22.890×49.600 | 개별 건물; FBX import 미확인 |
| `COZY_NEIGHBORHOOD_PARK` | 12.000×12.000×4.654 | 12×12m 공원 구성 모듈; 도시 전체 공원으로 확대 금지 |
| `MODERN_MINIMAL_PARK` | 12.000×12.000×3.831 | 12×12m 공원 구성 모듈; 도시 전체 공원으로 확대 금지 |
| `ECO_RAIN_GARDEN` | 12.000×12.000×3.731 | 12×12m 공원 구성 모듈; 도시 전체 공원으로 확대 금지 |
| `POCKET_PLAY_PARK` | 12.000×12.000×4.231 | 12×12m 공원 구성 모듈; 도시 전체 공원으로 확대 금지 |
| `ZEN_GARDEN_PARK` | 12.000×12.000×3.964 | 12×12m 공원 구성 모듈; 도시 전체 공원으로 확대 금지 |

빌라는 3종 모두 기존 조사에서 이미 측정되어 다시 Blender를 실행하지 않았다. 실측 폭/깊이는 20.474×16.788, 21.414×18.668, 18.546×19.420m로 단독주택보다 크므로 혼합 주거 밀도 계산에 그대로 반영한다. 아파트는 37.6~49.6m 높이이므로 낮은 건물 뒤에 배치하는 카메라 가독성 검토 대상이다. apartment_complex 두 묶음의 전체 bounds 2000×2000m에는 studio floor가 들어 있어 실치수로 쓰지 않는다.

공원은 비정형 큰 녹지 부지에 기존 12m 모듈을 휴식/놀이/빗물정원 노드로 사용하고 모듈 주변 잔디·곡선 산책로를 새로 계획한다. 모듈을 한꺼번에 통째로 늘리거나 12×12m 타일 격자로 전역을 채우지 않는다. 기존 식생 `SIMUS_Street_Landscape_Collection.blend`에서 ROOT 별 tree/bench/flowerbed/trashbin을 분리해 측정했고 `vegetation_root_groups`에 저장했다. 원본 studio floor를 배제하고 현재 exports/SIMUS_*.fbx/.glb를 우선 고려하되 root-local offset/재질을 구현 전에 확인한다.

기존 `road_straight` FBX는 전체 7.5×10m, 차도 5.5m, 양 보도 기초 각각 0.82m다. 1.69m NPC의 양방향 통행 및 이번 차도/보도 폭 체계에 부족해, 이를 모든 도로에 uniform scale로 확대하지 않는다. 차도·보도 단면 또는 소품만 재사용하고, 주간선/일반도로/골목/학내보행/산책로는 최종 좌표 폭으로 새 면을 조립할 계획을 작성한다. `City_Infrastructure` 386.25×317.25m는 기존 전체 도로망으로, 채택하지 않는다. road_corner/crossroad/parking 원본의 studio floor도 도로 실측으로 쓰지 않는다.

## 출입구·충돌 조사에서 확인한 것

- 학교 14개 모두 ENTRY_GLASS/DOOR_FRAME/ENTRY_STEP/CANOPY 메시가 존재한다. 문 앞 후보의 -Z 방향은 측정된 기단 남쪽과 계단 bounds를 근거로 한 추론이며 메시 normal을 확인한 출입 방향이나 실제 내외부 통행 인증은 아니다.
- 원형의 전체 보수적 envelope AABB에서는 C00/C01, C07/C08, C08/C09, C09/C10 네 쌍이 겹친다. 몸체 14개의 실제 상부 footprint 삼각형을 모든 91쌍에 대해 교차 검사한 결과 positive area body overlap은 0쌍이다. L형/비직사각 건물의 AABB 겹침을 실제 본체 충돌로 오판하지 않는다.
- canopy/계단/parapet의 실제 삼각형 교차와 물리 collider는 검사하지 않았다. 네 쌍의 보수적 envelope는 최종 설계에서 최소 이동을 적용하거나 상세 면 검증을 별도로 해야 한다. 학교 내부 보행로를 두 envelope 사이의 매우 좁은 틈으로 통과시키지 않는다.
- 상가/빌라/주택/아파트의 실제 문 방향은 이번 재사용 자료만으로 확정하지 않았다. 최종 건물 배치의 entrance anchor와 facing은 설계 요구사항이며, 실제 FBX 문을 확인해 root yaw/anchor를 보정할 구현 작업이다.

## 승인 후 구현으로 넘길 항목

1. 최종 설계 배치표를 adapter root에 적용하며 Unity 축 변환/scale=1/지면 높이 및 문 방향을 실측한다.
2. 학교 component 분리가 필요한 변경분만 파생 원본으로 만든다. 현재 원본을 저장/덮어쓰지 않는다. Unity GUID와 .meta를 유지한다.
3. 문턱/계단/학내 Walk 높이 차에 램프와 지면 접합을 적용하고, 유효 보행 폭 및 접근 collider를 확인한다.
4. 승인된 새 씬에서만 도로·보도·모듈을 구현하고 NavMesh 연결/카메라 가독성/재질/LOD/기기 성능을 확인한다. 기존 이벤트 로직과 90초 대기 요구사항은 유지한다.
5. 파생 자산 추가 후 manifest를 독립 candidate 키와 source/export hash로 등록한다. 현재 assets[].asset_key는 file stem 기반 측정 ID로 registry 키가 아니며 `manifest_asset_keys`가 실제 등록 키이다. 등록/received가 전시 approved를 뜻하지 않는다.

## 원본 보존 증거

29개 읽은 원본의 현재 SHA-256와 존재하는 대응 FBX SHA-256은 `asset_measurements.json`에 있다. 측정 파일을 만든 뒤 추가 캠퍼스 읽기를 완료하고 재계산하여 모두 같음을 확인했다. Blender save/export, Unity scene/C# 변경, asset 이동/manifest 수정은 수행하지 않았다. 전체 보호 파일의 세션 전후 해시 검토는 독립 QA 결과도 함께 따른다. Catalog 재생성/검사는 루트 에이전트가 최종 문서들을 합친 뒤 한 번에 실행한다. 기존 NPC manifest source 누락/해시 불일치는 별도 기존 문제이며 이번 설계에서 원본을 바꿔 해결하지 않았다.
