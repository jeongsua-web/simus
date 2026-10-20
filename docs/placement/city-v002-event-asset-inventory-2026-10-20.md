# CityRebuild_v002 이벤트 배치용 기존 에셋 조사

조사일: 2026-10-20. 담당: Blender 에이전트. **이 문서는 배치 전 읽기 조사이며 실제 배치 완료·QA·전시 승인을 뜻하지 않는다.** 실제 배치 위치와 수량은 Unity 배치 보고서를 따른다.

## 조사 범위와 근거

- `AGENTS.md`, `assets/ASSET_RULES.md`, `assets/catalog/README.md`, `assets/manifest.csv`, `assets/catalog/inventory.json`, `.codex/config.toml`, `.codex/agents/blender.toml`을 읽었다.
- 등록 파일 5,212개 목록과 실제 Unity FBX·프리팹·메타·Blender 원본 경로, 해당 묶음 README와 기존 제작 자료를 참조했다. `assets/archive/packages/`의 ZIP 11개 내부 파일명도 읽었으며 `assets/incoming/`은 없다.
- 현재 통합 맵 FBX 바이너리에서 정류장·화단 명칭을 직접 읽어 기존 부품의 포함 사실을 확인했다. 경찰·범죄자 FBX에서도 Idle/Walk/Interact/Wave AnimationStack 4개가 각각 포함된 것을 읽었다. 기존 범죄자 정면 미리보기 이미지를 직접 보았다.
- Blender 재열기·재내보내기, 모델 수정·제작·다운로드, Unity Play Mode, QA, 성능 검사, 빌드를 실행하지 않았다. 아래 치수와 동작 설명은 기존 묶음 문서·메타에서 가져온 설치 참고 정보이며 이번 작업에서 다시 실행 검증한 값이 아니다.
- 발견한 모델의 manifest 상태는 `received`이며 전시용 `map_version`은 미확정이다. Neighborhood 시제품 좌표는 사용하지 않는다.

아래 표의 최소수량은 요청한 역할을 표현하기 위한 조사 기준이다. 사용자가 수량을 지정하지 않은 항목의 최종 배치 수량을 확정하는 값은 아니다. 표 안의 `Art/`와 `Prefabs/`는 각각 `unity/Assets/SIMUS/Art/`, `unity/Assets/SIMUS/Prefabs/`를 뜻한다.

## 환경 14종

| 요청 | 발견 에셋과 실제 사용 후보 | Blender 원본 | 최소수량 / 재사용 제약 |
|---|---|---|---|
| 신호등·횡단보도 | `Prefabs/props/traffic_signal_vehicle_v001/SIMUS_TrafficSignal_Vehicle.prefab`, `Prefabs/props/traffic_signal_pedestrian_v001/SIMUS_TrafficSignal_Pedestrian.prefab`; 기존 도시 도로의 횡단보도 우선 | `assets/library/props/traffic_signal_vehicle_v001/source/SIMUS_TrafficSignal_Vehicle.blend`, `traffic_signal_pedestrian_v001/source/SIMUS_TrafficSignal_Pedestrian.blend` | 차량 신호 2개·보행 신호 2개 이상, 횡단 지점 1곳 이상. 신호등 +Z는 **신호를 보는 사람 쪽**. 신호 주기·교통 AI 없음 |
| 버스정류장 | `Art/maps/university_v003/SIMUS_Dense_Realistic_University_Map_03.fbx` 안 `D03_UNITY_D03_REUSED_R02_BUS_BACK`, `...BUS_ROOF`, `...BUS_POST__34`, `...BUS_POST__28`, `D03_UNITY_D03_BUS_PLATFORM` | 같은 폴더의 `SIMUS_Dense_Realistic_University_Map_03.blend` | 완성된 정류장 1세트. 통합맵의 **부품만** 기존 도로변으로 재배치하며 원래 맵 좌표는 복사하지 않음. 실제 FBX 문자열에서 BACK·PLATFORM 포함 확인 |
| 쓰레기통 | `assets/library/vegetation/street_landscape/exports/SIMUS_TrashBin.fbx` 및 `.glb`; 기존 통합맵의 분리수거통도 후보 | `assets/library/vegetation/street_landscape/source/SIMUS_Street_Landscape_Collection.blend` | 여러 곳을 표현할 3개 이상. 이미 있는 교환본만 사용하며 새 모델·대체 도형 불필요 |
| 주차장 | `Prefabs/roads/outdoor_parking_v001/SIMUS_Outdoor_ParkingLot_Complete.prefab`; 같은 폴더의 `SIMUS_ParkingSpace_Standard.prefab` 등 기존 모듈 | `assets/library/roads/outdoor_parking_v001/source/SIMUS_Outdoor_Parking_Lot.blend` | 1곳. 완성형은 30×24m / 14면(일반12·장애인1·EV1). 부지 부족 시 기존 구획 모듈 사용 가능, 도시 구조 변경 금지 |
| 카페 | `Prefabs/buildings/commercial_cafe_v001/SIMUS_Commercial_Cafe.prefab` | `assets/library/buildings/commercial_cafe_v001/source/SIMUS_Commercial_Cafe.blend` | 1동. 기존 COMMERCIAL_03_MODERN_CORNER의 외관 파생본. 보행 유효폭1.5m·후면0.8m 참고. 문열기·실내 없음 |
| 지하철 출입구 | `Prefabs/buildings/subway_entrance_v001/SIMUS_Subway_Entrance.prefab` | `assets/library/buildings/subway_entrance_v001/source/SIMUS_Subway_Entrance.blend` | 1곳. 폭6m·바닥길이14.5m·지하깊이3.4m. 지면 절단 자동 처리 없음. 기존 구조를 보존한 가시성 확보가 어려우면 배치 제한으로 보고. 에스컬레이터 애니메이션 없음 |
| 분리수거장 | `Prefabs/props/recycle_station_v001/SIMUS_Recycle_Station_Complete.prefab` | `assets/library/props/recycle_station_v001/source/SIMUS_Recycle_Station.blend` | 1곳 이상. 5종 통 포함. 평탄부 최소5.1×2.8m 참고. 별도 제작 불필요 |
| 하천 | 기존 `CityRebuild_v002.unity`의 하천·양안 산책로·보행교 유지 | 하천은 씬 전용 메시. 보행교는 `assets/library/props/river_footbridge_v001/` 기존 원본 | 기존 하천1구간 재사용. 새 물길·좌표·지역 경계 생성 없음 |
| 꽃밭 | `assets/library/vegetation/street_landscape/exports/SIMUS_Flowerbed.fbx` 및 `.glb`; 통합맵 `FLOWERBED_HEALTHY_Mesh.001`; 기존 공원 꽃밭 | `assets/library/vegetation/street_landscape/source/SIMUS_Street_Landscape_Collection.blend` | 공원1곳 이상. 통합맵 FBX에서 화단 Geometry명 확인. 기존 Phase8 화단과 중복 여부는 배치 담당이 판단 |
| 축제부스 | `Prefabs/props/festival_booth_v001/SIMUS_Festival_Booth_{Base,Food,Game,Info}.prefab` | `assets/library/props/festival_booth_v001/source/SIMUS_Festival_Booth_Set.blend` | 1개 이상. 전면 대기1.5m·후면1m 참고. 기존 장식·현수막 포함 |
| 공용화장실 | `Prefabs/props/public_toilet_v001/SIMUS_Public_Toilet.prefab` | `assets/library/props/public_toilet_v001/source/SIMUS_Public_Toilet.blend` | 1개. 공용시설 외관 준비, 내부 게임플레이 없음 |
| 식당 | `Prefabs/buildings/commercial_restaurant_v001/SIMUS_Commercial_Restaurant.prefab` | `assets/library/buildings/commercial_restaurant_v001/source/SIMUS_Commercial_Restaurant.blend` | 1동. 기존 COMMERCIAL_01_OLD_MULTI_TENANT 파생 외관. 카페와 동일한 보행 공간·실내 제한 |
| 바리케이드·고깔콘 | `Prefabs/props/road_control_v001/SIMUS_Barricade_01.prefab`, `SIMUS_Barricade_02.prefab`, `SIMUS_TrafficCone_01.prefab`, `SIMUS_TrafficCone_02.prefab` 등 8종 | `assets/library/props/road_control_v001/source/SIMUS_Road_Control_Set.blend` | 바리케이드1개·콘2개 이상. 기존 보행망을 완전히 막지 않는 통제 구역 |
| 정체불명 상자 | `Prefabs/props/mystery_crate_v001/SIMUS_MysteryCrate.prefab`, 열린 버전 `SIMUS_MysteryCrate_Open.prefab` | `assets/library/props/mystery_crate_v001/source/SIMUS_Mystery_Crate.blend` | 광장1개. 닫힌 전용 프리팹 사용 가능. 기존 선택적 내부 발광은 기본 OFF, 이벤트 구현 불필요 |

신호등 두 원본 경로는 모두 `assets/library/props/` 아래다. 기존 횡단보도는 통합맵 원본에도 있으나 현재 v002 도로 구조의 기존 표시를 먼저 사용한다. 별도의 표지판 `SIMUS_Sign_Crosswalk`는 횡단보도 바닥 표시의 대체품으로 취급하지 않는다.

## NPC 6종

| 요청 | 발견 모델·프리팹 | 원본 / 기존 기능 | 최소수량과 제한 |
|---|---|---|---|
| 우는 아이 | `Prefabs/characters/crying_child_v001/SIMUS_NPC_CryingChild.prefab` | `assets/library/characters/crying_child_v001/source/SIMUS_NPC_CryingChild.blend`; SadIdle/CryLoop/StrongSob/WipeTears 4클립, Animator·Humanoid·눈물 준비 | 1명. 아이 체형·가방·눈물로 일반 참가자 성인과 구분. 이동 클립/자체 이동 없음. 내부(0,180,0) 축보정 보존, 외부루트 +Z전방·발바닥 원점. Collider높이1.25m |
| 경찰 | `Art/characters/role_variants_v001/models/SIMUS_NPC_Police.fbx` | `assets/library/characters/role_variants_v001/source/SIMUS_NPC_Role_Variants.blend`; 기존 Idle/Walk/Interact/Wave 기록, 현재 메타는 **Generic(animationType2)** | 1명. 제복·모자·배지·장비로 외관 구분. Humanoid Happiness 컨트롤러를 그대로 재지정하지 않음. 자체 순찰 코드/전용 배치 프리팹 미발견 |
| 사악해 보이는 NPC | `Art/characters/role_variants_v001/models/SIMUS_NPC_Criminal.fbx` | 경찰과 같은 원본; Idle/Walk/Interact/Wave 기록, 현재 메타는 **Generic(animationType2)** | 1명. 직접 본 기존 미리보기는 검은 후드·마스크·검은 옷·사선 가방. 일반 시민과 외관이 다르나 '누가 봐도 사악함' 충족 여부는 사용자 시각 확인 대상. 새 외형 제작 없음 |
| SIM:US 기본 시민 | `Art/characters/modular_hairfix_v001/models/SIMUS_Modular_Character_Happiness_Animations.fbx`; 기존 v002 배경 시민 표현 우선 | 원본 `.blend`도 같은 models 폴더. Humanoid(animationType3); 기존 NEUTRAL_WALK와 기존 보행 시스템 재사용 후보 | 1명 이상. 참가자와 같은 기본 모델만 추가하면 외관 구분 요건이 자동 충족되지 않음. 기존 시민의 외형·색/헤어 선택과 참가자 외형 범위를 배치 담당이 확인. 계정·선택지 연결 금지 |
| 무거운 짐 운반 | `Prefabs/characters/heavy_carrier_v001/SIMUS_NPC_HeavyCarrier.prefab`; 별도 상자 `Prefabs/props/heavy_box_v001/SIMUS_Prop_HeavyBox.prefab` | `assets/library/characters/heavy_carrier_v001/source/SIMUS_NPC_HeavyCarrier.blend`; CarryIdle/CarryWalk/Struggle/LookAround 4클립·Humanoid·손 연결 상자 준비 | 1명. 의상·장갑·상자로 구분. CarryWalk는 제자리 동작, 권장속도0.24m/s. 기존 보행시스템 연결 가능 여부는 Unity 담당. PUT_DOWN클립 없음. 내부(0,180,0) 보정 보존 |
| 고양이 | **미발견** | manifest에 고양이 캐릭터 없음. inventory 파일명·현재 캐릭터 묶음·ZIP11개 내부 파일명에서 cat/kitten/feline/고양이 모델·프리팹·원본 미발견 | 모델/프리팹1마리 필요. 이동·대기 애니메이션도 발견 못함. 새 제작·대체 도형·다운로드 없이 미배치 보고 |

경찰·범죄자 FBX에서 읽은 역할 NPC 4개 AnimationStack의 포함 사실은 Unity 재생 확인을 대신하지 않는다. 이번 읽기 조사는 클립을 재생하거나 리그를 수정하지 않았다. 경찰·범죄자·청소부의 메타는 Generic, 아이·운반·Happiness 모델은 Humanoid이므로 리타기팅 호환성을 무조건 가정하지 않는다.

## 교통수단 4종

| 요청 | 발견 에셋 | 원본·설치 참고 | 최소수량 / 이동 |
|---|---|---|---|
| 자동차 | `Art/props/city_state_v001/models/SAF_CAR_NORMAL_01.fbx` 및 통합맵 기존 일반차 | `assets/library/props/city_state_v001/source/SIMUS_City_State_Assets.blend`; 기존 제작 문서상 일반차 길이약3.70m | 도로/주차장 합계2대 이상 권장. 이번 조사에서 재사용 가능한 자율주행 시스템 미확인, 정적 배치 가능 |
| 버스 | `Prefabs/props/city_bus_v001/SIMUS_City_Bus.prefab` | `assets/library/props/city_bus_v001/source/SIMUS_City_Bus.blend`; 길이11.10m·차체폭2.50m(거울3.25m)·높이3.359m, Unity +Z전방·지면 중심 | 1대. LOD0/1 있음. `TransitVehicleRig`는 문·바퀴·등화 **시각 제어**이며 차량 주행 시스템이 아님. 정적 배치 |
| 택시 | `Prefabs/props/taxi_v001/SIMUS_Taxi.prefab` | `assets/library/props/taxi_v001/source/SIMUS_Taxi.blend`; 길이4.894m·차체폭1.84m(거울2.218m)·표시등포함높이1.63m, Unity +Z전방·지면 중심 | 1대. LOD0/1 있음. 이동AI·물리·경로 없음. 정적 배치 |
| 불법주차차량 | 같은 `SAF_CAR_NORMAL_01.fbx`의 별도 인스턴스 | 자동차 원본 재사용. 손상차 모델을 정상 불법주차차 대신 임의 적용할 필요 없음 | 1대. 도로변 간섭을 표현하되 보행망 전체 차단 금지. 전용 새 모델 불필요, 정적 배치 |

차량을 시민 크기에 맞추려고 실제 미터 규격의 버스·택시를 일반차와 같은 길이로 축소하지 않는다. 기존 차량 주행 기능의 발견/재사용 최종 판단은 Unity 코드 조사 결과를 따른다.

## 누락·부분 충족 및 사용자에게 보고할 내용

| 에셋·기능 이름 | 용도 | 최소 부족 수량 | 미발견 또는 제한 이유 |
|---|---|---|---|
| 고양이 모델/프리팹 | 공원·주택가의 동물 NPC | 1마리 | 현재 등록·펼쳐진 에셋 경로와 받은 ZIP 내부 파일목록에서 식별 가능한 모델/원본/프리팹이 없음. 전체 .blend 내부의 모든 숨김 오브젝트를 새로 열어 조사한 것은 아님 |
| 고양이 대기·이동 클립 | 고양이 NPC의 애니메이션 | 대기1·이동1종(움직임이 필요한 경우) | 대응 고양이 리그·클립 미발견. 정적 모델도 없어 대체하지 않음 |
| 우는 아이 이동 클립 | 아이의 실제 이동이 필요한 경우 | 1종(이동 요청 시) | 기존 4개는 슬픔·울음·눈물 닦기, 걷기 없음. 이번 요청은 공원 정적 배치로 표현 가능 |
| 운반NPC PUT_DOWN | 짐 내려놓기 이벤트가 필요한 경우 | 1종(현재 범위 밖) | 기존 원본 안내에 미포함 명시. 운반·제자리 걷기는 준비됨 |
| 지하철 지면 개구부 | 지하 계단 내부까지 보이는 설치 | 설치 지점1곳의 조건 | 출입구 에셋은 존재하지만 자동 지면 절단 기능 없음. 기존 지형·도로를 임의 재구성해 채우지 않음 |
| 차량 자율주행 | 자동차·버스·택시 실제 주행 | 현재 필수 부족 수량0 | 이번 범위는 정적 배치 허용이며 신규 주행 시스템 제외. 버스·택시 에셋 자체에는 이동 시스템 없음 |

카페/식당 내부와 문열기, 에스컬레이터 애니메이션, 신호 주기는 준비되지 않았거나 에셋에서 제공하지 않지만 이번 환경 외관 배치의 필수 누락 모델로 계산하지 않는다. 축제부스·주차장·공용화장실·분리수거장·신호등·상자·도로통제소품은 이미 준비된 자산이 있으므로 새로 만들 이유가 없다.

## 변경과 승인 경계

- 이 조사 담당의 변경은 본 문서 하나다. 기존 Blender·FBX·재질·텍스처·프리팹·manifest·GUID를 수정하지 않았다.
- 실제 배치는 Unity 담당이 기록한다. 이 문서의 발견 사실만으로 배치 완료를 보고하지 않는다.
- 배치 완료 보고 후 사용자 명시 승인 전 QA·추가 배치 수정·신규 제작·빌드·배포를 진행하지 않는다.
