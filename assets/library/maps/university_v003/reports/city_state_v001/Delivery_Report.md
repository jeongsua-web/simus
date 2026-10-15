# SIM:US 도시 스탯 에셋 및 실제 맵 배치 보고서

작성일: 2026-10-13 · 납품 상태: **received / 검토 대기**. 전시 채택·승인을 대신하지 않습니다.

## 1. 작업 대상 맵

`unity/Assets/SIMUS/Art/maps/university_v003/SIMUS_Dense_Realistic_University_Map_03.blend` 및 동일 이름 FBX.
`CompletedMapFollowSetup.cs`의 MapPath, 실제 빌드 대상 `CompletedMapNpcFollow.unity`의 FBX GUID `51203a64d6c944cf38a4623cf3b35e34`와 manifest를 확인했습니다. 인계 문서에는 최종 전시 승인 미확정으로 기록되어 있어 승인 상태는 바꾸지 않았습니다. Neighborhood의 좌표나 배치는 사용하지 않았습니다.
실제로 참조되는 FBX의 원래 메시 1,385개를 기준으로 편집 가능한 맵을 구성했습니다. 건물·학교·도로·공원 배치를 변경하지 않았습니다. 기존 Blender의 원형 라이브러리와 숨겨진 중복 출력 장면은 외부 원본 백업으로 보존되며 최종 FBX에는 포함하지 않습니다.

## 2. 프로젝트 외부 백업

`C:/Project/simus_backups/city_state_20261013_145427/`

## 3. 백업 파일 목록

외부 `Backup_Manifest.json`에 원본 상대경로와 SHA-256을 기록했습니다. 최초 맵·FBX·메타·manifest·catalog·인계 보고서·캐릭터 역할 원본 등 57개 파일을 복사하고 해시를 대조했습니다. 카메라 재질 충돌 수정에 필요한 `NpcOcclusionReveal.cs`와 메타도 추가 백업합니다. 원본 캐릭터·리그·애니메이션 파일은 이번 작업에서 변경하지 않습니다.

## 4. 새로 제작한 항목 (20종)

- `HAP_BANNER_ACTIVE_01` — NEW
- `HAP_BANNER_FADED_01` — NEW
- `HAP_SIGN_CLOSED_01` — NEW
- `HAP_SIGN_TEMPORARY_CLOSED_01` — NEW
- `SAF_BROKEN_GLASS_DECAL_01` — NEW
- `SAF_BROKEN_GLASS_DECAL_02` — NEW
- `SAF_BROKEN_GLASS_DECAL_03` — NEW
- `CLN_GROUND_STAIN_DUST_01` — NEW
- `CLN_GROUND_STAIN_DARK_01` — NEW
- `CLN_GROUND_STAIN_SPILL_01` — NEW
- `CLN_DRAIN_STAIN_01` — NEW
- `SAF_POLICE_LIGHTBAR_01` — NEW
- `CLN_TRASH_PAPER_01` — NEW
- `CLN_TRASH_CUP_01` — NEW
- `CLN_TRASH_BOTTLE_01` — NEW
- `CLN_TRASH_CAN_01` — NEW
- `CLN_TRASH_PLASTIC_BAG_01` — NEW
- `CLN_TRASH_WRAPPER_01` — NEW
- `CLN_GARBAGE_BAG_02` — NEW
- `CLN_GARBAGE_BAG_GROUP_01` — NEW

## 5. 기존 에셋 재사용 (25종)

- `HAP_PLANTER_HEALTHY_01` — REUSED:FLOWERBED_HEALTHY
- `HAP_PLANTER_WITHERED_01` — REUSED:FLOWERBED_WITHERED
- `POL_TREE_HEALTHY_01` — REUSED:TREE_HEALTHY
- `POL_TREE_WITHERED_01` — REUSED:TREE_WITHERED
- `SAF_POLICE_CAR_01` — REUSED:ILLEGALLY_PARKED_CAR
- `SAF_CAR_NORMAL_01` — REUSED:ILLEGALLY_PARKED_CAR
- `CLN_GARBAGE_BAG_01` — REUSED:TRASH_BAG_BLACK
- `CLN_CARDBOARD_01` — REUSED:CARDBOARD_STACK
- `CLN_TRASH_PILE_SMALL_01` — REUSED:TRASH_PILE_SMALL
- `CLN_TRASH_PILE_MEDIUM_01` — REUSED:TRASH_PILE_MEDIUM
- `CLN_TRASH_PILE_LARGE_01` — REUSED:TRASH_PILE_LARGE
- `POL_ROOFTOP_VENT_01` — REUSED:VENT_OUTLET
- `SAF_CCTV_01` — REUSED:CCTV_KOREAN_POLE
- `SAF_EMERGENCY_BELL_01` — REUSED:EMERGENCY_BELL
- `HAP_DECOR_LIGHTS_01` — REUSED:DECOR_LIGHTS_ON
- `HAP_FLAGS_01` — REUSED:FESTIVAL_FLAGS
- `SAF_BENCH_NORMAL_01` — REUSED:BENCH_CLEAN
- `SAF_BENCH_BROKEN_01` — REUSED:BENCH_BROKEN
- `SAF_FENCE_NORMAL_01` — REUSED:FENCE_NORMAL
- `SAF_FENCE_BROKEN_01` — REUSED:FENCE_BENT
- `SAF_LAMP_NORMAL_01` — REUSED:LAMP_NORMAL
- `SAF_LAMP_BROKEN_01` — REUSED:LAMP_BROKEN_OFF
- `SAF_FALLEN_BICYCLE_01` — REUSED:FALLEN_BICYCLE
- `POL_GRASS_HEALTHY_01` — REUSED:HEALTHY_GRASS
- `POL_GRASS_BROWN_01` — REUSED:BROWN_GRASS

## 6. 수정·개선한 항목 (12종)

- `CLN_BIN_NORMAL_01` — IMPROVED: existing .45 x .52 x .65 bin shell opened; visible fill levels
- `HAP_PLANTER_EMPTY_01` — MODIFIED:FLOWERBED_HEALTHY
- `SAF_DAMAGED_CAR_01` — MODIFIED:ILLEGALLY_PARKED_CAR
- `SAF_DAMAGED_CAR_02` — MODIFIED:ILLEGALLY_PARKED_CAR
- `CLN_BIN_HALF_01` — IMPROVED: existing .45 x .52 x .65 bin shell opened; visible fill levels
- `CLN_BIN_OVERFLOW_01` — IMPROVED: existing .45 x .52 x .65 bin shell opened; visible fill levels
- `CLN_BIN_SPILL_01` — IMPROVED: existing .45 x .52 x .65 bin shell opened; visible fill levels
- `POL_TREE_DEAD_01` — MODIFIED:TREE_HEALTHY proportions
- `SAF_GRAFFITI_DECAL_01` — IMPROVED: existing abstract graffiti converted to alpha PNG
- `SAF_GRAFFITI_DECAL_02` — IMPROVED: existing abstract graffiti converted to alpha PNG
- `SAF_GRAFFITI_DECAL_03` — IMPROVED: existing abstract graffiti converted to alpha PNG
- `SAF_GRAFFITI_DECAL_04` — IMPROVED: existing abstract graffiti converted to alpha PNG

경찰차는 기존 차체·바퀴를 활용하고 유리색을 보존한 청색 측면 패널, 별도 경광등으로 구분했습니다. 파손 차량은 전면 변형, 들린 보닛, 기울어진 범퍼, 유리 균열을 갖습니다. 쓰레기통은 0.45 × 0.52 × 0.65m 기준 외곽을 유지하면서 열린 입구와 내부 쓰레기 높이로 정상/절반/넘침/흘러나옴을 구분했습니다. 기존 낙서 4종은 추상적인 선 형태를 유지한 투명 PNG로 변환했습니다.

## 7. 제작하지 않은 항목과 이유

- 공장·하천: 실제 대상 맵에 해당 시설이 확인되지 않아 새로 만들지 않았습니다. 공장 굴뚝 및 하천 쓰레기 슬롯도 추가하지 않았습니다.
- 경찰·미화원·범죄자 NPC: 기존 `role_variants_v001`의 3종을 재사용 가능한 상태로 유지했습니다. 새 NPC·리그·애니메이션은 만들지 않았습니다.
- 추가 낙서 05/06: 기존 4종으로 충분해 제작하지 않았습니다.
- 불투명 연기 덩어리: 제작·배치하지 않았습니다. 입자·안개·조명 효과는 요청대로 Unity 연결 지점과 메타데이터로 인계합니다.
- 정상 벤치·가로등·나무 등 기존 형태를 유지할 수 있는 곳은 원래 맵 오브젝트를 정상 상태로 사용했습니다. 개별 쓰레기와 잔디·울타리 등 일부 추가 조합용 에셋은 과밀 배치를 피하기 위한 재사용용 출력물로 제공합니다.

## 8. 실제 맵 배치 수량

독립 상태 전환 항목 **318개**: 행복도 42, 치안 43, 청결도 134, 오염도 99. 이 수에는 기존 맵의 정상 나무·쓰레기통·벤치·가로등 상태 42개가 포함됩니다. 새 상태 메시 **276개**, 상시 소품 8개(현수막 지지대 3, 환풍구 4, 배기 차량 1), FX Anchor 18개, 쓰레기 후보 Empty 80개입니다. 모든 상태가 동시에 표시되는 수량은 아닙니다.

에셋별 상세 수량:

| 에셋 | 전환 항목 수 |
|---|---:|
| `CLN_BIN_HALF_01` | 6 |
| `CLN_BIN_OVERFLOW_01` | 6 |
| `CLN_BIN_SPILL_01` | 6 |
| `CLN_CARDBOARD_01` | 10 |
| `CLN_DRAIN_STAIN_01` | 10 |
| `CLN_GARBAGE_BAG_01` | 10 |
| `CLN_GARBAGE_BAG_02` | 10 |
| `CLN_GROUND_STAIN_DARK_01` | 10 |
| `CLN_GROUND_STAIN_DUST_01` | 10 |
| `CLN_TRASH_CUP_01` | 10 |
| `CLN_TRASH_PAPER_01` | 10 |
| `CLN_TRASH_PILE_LARGE_01` | 10 |
| `CLN_TRASH_PILE_MEDIUM_01` | 10 |
| `CLN_TRASH_PILE_SMALL_01` | 10 |
| `HAP_BANNER_ACTIVE_01` | 3 |
| `HAP_BANNER_FADED_01` | 3 |
| `HAP_DECOR_LIGHTS_01` | 3 |
| `HAP_FLAGS_01` | 3 |
| `HAP_PLANTER_EMPTY_01` | 8 |
| `HAP_PLANTER_HEALTHY_01` | 8 |
| `HAP_PLANTER_WITHERED_01` | 8 |
| `HAP_SIGN_CLOSED_01` | 3 |
| `HAP_SIGN_TEMPORARY_CLOSED_01` | 3 |
| `ORIGINAL_BIN` | 6 |
| `ORIGINAL_FURNITURE` | 3 |
| `ORIGINAL_HEALTHY_TREE` | 33 |
| `POL_TREE_DEAD_01` | 33 |
| `POL_TREE_WITHERED_01` | 33 |
| `SAF_BENCH_BROKEN_01` | 1 |
| `SAF_BROKEN_GLASS_DECAL_01` | 6 |
| `SAF_BROKEN_GLASS_DECAL_02` | 6 |
| `SAF_BROKEN_GLASS_DECAL_03` | 6 |
| `SAF_CCTV_01` | 4 |
| `SAF_DAMAGED_CAR_01` | 1 |
| `SAF_DAMAGED_CAR_02` | 1 |
| `SAF_EMERGENCY_BELL_01` | 4 |
| `SAF_FALLEN_BICYCLE_01` | 1 |
| `SAF_GRAFFITI_DECAL_01` | 1 |
| `SAF_GRAFFITI_DECAL_02` | 1 |
| `SAF_GRAFFITI_DECAL_03` | 1 |
| `SAF_GRAFFITI_DECAL_04` | 1 |
| `SAF_LAMP_BROKEN_01` | 2 |
| `SAF_POLICE_CAR_01` | 2 |
| `SAF_POLICE_LIGHTBAR_01` | 2 |

## 9. 구역별 배치

| 시각적 배치 그룹 | 전환 항목 수 |
|---|---:|
| CAMPUS | 67 |
| COMMERCIAL | 96 |
| PARK | 39 |
| RESIDENTIAL | 79 |
| ROAD | 37 |

APARTMENT에는 스모그 Anchor만 추가했습니다. 구역명은 에셋 선택을 위한 시각적 그룹입니다. 서버의 실제 지역 경계·코드나 30개 상황 위치를 임의로 확정한 것이 아닙니다. 정확한 오브젝트 이름과 슬롯 위치는 `PlacementInventory.csv`, `CityStateBindings.json`을 참조합니다.

## 10. 스탯 단계와 활성화

행복도·치안·청결도: 0–20 CRITICAL / 21–40 BAD / 41–60 NORMAL / 61–80 GOOD / 81–100 EXCELLENT.
오염도: 0–20 EXCELLENT / 21–40 GOOD / 41–60 NORMAL / 61–80 BAD / 81–100 CRITICAL.

80개 쓰레기 슬롯은 고정 위치입니다. 청결도 81–100에는 0개, 61–80에는 20개, 41–60에는 40개, 21–40에는 60개, 0–20에는 80개가 누적 활성화됩니다. 같은 오브젝트를 단계마다 복사하지 않고 minimum/maximum 범위로 공유합니다. `StageActivation.csv`에 20개 단계의 전체 활성화 목록을 기록했습니다.

Blender 루트는 MAP_CITY_STATE, 하위는 HAPPINESS/SAFETY/CLEANLINESS/POLLUTION/FX_ANCHORS/BASE_MAP입니다. Blender 이름 전역 유일성 때문에 단계 컬렉션은 `HAPPINESS__LEVEL_1_CRITICAL`처럼 이름을 붙였고 `display_name` 속성에 요청한 단계명을 보존했습니다.

Unity FBX 루트의 `CityStateAssets`에서 각 스탯을 개별 조절합니다. `SetStats(happiness, safety, cleanliness, pollution)` 및 `SetRegionalPollution("CAMPUS", value)`를 제공합니다. 서버의 CityStatePoller가 있으면 실제 수치를 따릅니다. 서버 지역 코드가 확정되기 전에는 region의 serverCode를 비워 두며 임의 매핑하지 않습니다.

## 11. Unity 효과 인계

18개 Anchor에 stat/region/activation_level/effect_type/recommended_intensity/notes를 기록하고 Unity `CityStateAnchor` 컴포넌트로 가져옵니다.

- 경찰차 경광등: red/blue 각각의 위치. 출동·순찰 상태는 차량의 치안 단계 범위로 구분.
- 옥상 환풍구 4곳: Unity Particle System 연결. 오염도 4단계 이상 권장.
- 배기 차량 1곳: 실제 배기구에 연결. 치안과 독립된 상시 차량을 사용.
- 글로벌/지역 스모그: Unity Fog 또는 환경 볼륨용 기준점. 불투명 메시 없음.
- 사건 통제선: 차량 주변 후보 2곳. 보행 동선을 막지 않도록 실제 연출 범위를 선택.
- 연못: 기존 공원 2개 수면의 머티리얼 슬롯만 변경. 런타임 재질 복사본으로 원래 공유 재질을 손상시키지 않음.

Particle/Fog/경광등 깜빡임과 조명 강도는 자동 생성하지 않았습니다. 담당자가 이 Anchor에 최종 효과를 연결해야 합니다. Blender 오염도 비교는 나무와 연못의 상태 변화이며 실제 Unity 안개가 적용된 화면이라고 표시하지 않습니다.

NPC 추적 카메라의 기존 재질 치환 코드가 상태 소품·투명 데칼·물을 덮어쓰는 충돌을 수정했습니다. 기존 건물 가림 처리와 NPC 추적 기능은 유지합니다.

## 12. Blender 맵 저장 위치

`unity/Assets/SIMUS/Art/maps/university_v003/SIMUS_Dense_Realistic_University_Map_03.blend`
에셋 편집 원본: `assets/library/props/city_state_v001/source/SIMUS_City_State_Assets.blend`.

## 13. 최종 맵 FBX

`unity/Assets/SIMUS/Art/maps/university_v003/SIMUS_Dense_Realistic_University_Map_03.fbx`
기존 FBX GUID와 활성 장면 참조를 유지합니다. 카메라와 미리보기 조명은 제외하고 개별 상태 메시·Empty·Anchor만 추가했습니다.

## 14. 개별 에셋 FBX

`unity/Assets/SIMUS/Art/props/city_state_v001/models/` — 57개.

## 15. 텍스처와 공용 재질

`unity/Assets/SIMUS/Art/props/city_state_v001/textures/` — 15 PNG.
`unity/Assets/SIMUS/Art/props/city_state_v001/materials/` — 15 공용 Unity 재질.
현수막·안내 문구는 교체 가능한 텍스처이며 실제 브랜드·연락처·기관 로고를 사용하지 않습니다. 낙서·균열·바닥 얼룩은 알파 PNG입니다. Blender에는 이미지를 패킹했습니다.

## 16. 재가져오기 및 크기 검증

`FBXRoundtrip.json`: 기존 맵 메시 1,385개 모두 재가져온 좌표·경계 상자 오차 0.002m 이하, 누락 0, 카메라·조명 출력 0.
`IndividualFBXAudit.json`: 개별 FBX 57개 재가져오기, 치수와 재질 슬롯 검사 통과.
Blender의 실험적 FBX bake-space 변환은 중첩 계층 축/단위 오류를 발생시켜 사용하지 않았습니다. 메시의 로컬 스케일을 먼저 적용하고, 기존 맵과 같은 Z-forward/Y-up 출력 설정을 사용한 뒤 실제 재가져오기로 1유닛=1m를 확인했습니다.
창문·벽 부착은 실제 폴리곤을 선택해 0.016m 띄웠습니다. 신규 지상 소품은 기존 맵 표면 레이 검사를 통해 높이를 맞췄습니다. 공원·보도·건물 크기를 변경하지 않았습니다.

## 17. 스탯 조합 및 이미지 검사

`Unity_Passed.json`: 625가지 독립 조합, 교체 그룹 중복 0, 누적 쓰레기 개수 검증. 실제 CompletedMapNpcFollow 장면의 검증용 사본에서 6개 요구 조합을 Play Mode로 검사했습니다. 캠퍼스만 오염시켜도 주거지 나무가 바뀌지 않는 것을 확인했습니다. PNG 연결·투명 큐·기존 연못의 독립 런타임 재질도 검사했습니다.
전체 지도와 동일 위치의 근접 카메라로 기본/각 스탯 고저/혼합/6개 요구 조합, 총 16상태 × 2시점 이미지를 제공합니다. 개별 비교 이미지 6종도 제공합니다.

## 18. 남아 있는 문제 및 범위

- 이번 도시 상태 에셋·상태 전환 검사에서 확인된 누락과 재질 충돌은 수정했습니다.
- 기존 catalog 검사에는 이번 작업 전부터 누락된 기존 source/export 경로 62건과 캐릭터 Blender 해시 불일치 1건이 있었습니다. 해당 파일을 이번 작업에서 복원하거나 승인하지 않았습니다. 본 작업 이후 검사 결과는 CatalogAudit.md에 별도 기록합니다.
- 전시 타깃 기기 성능과 실제 서버 지역 코드 연결은 팀 검토가 필요합니다. map_version과 실제 사건/NPC 경로를 임의로 채우지 않았습니다.
- Blender 비교 렌더와 Unity Play Mode 검증은 다른 검증입니다. 실제 Unity 그래픽 화면의 최종 조명·Particle·Fog 튜닝 완료를 의미하지 않습니다.

## 19. 전시 전 담당자 확인

1. CompletedMapNpcFollow를 열고 맵 루트 CityStateAssets의 4개 스탯을 각각 바꿔 확인합니다.
2. 실제 서버 지역 코드가 정해지면 Regions.serverCode에 대응시킵니다. 시각적 그룹 이름을 임의의 서버 경계로 사용하지 않습니다.
3. 연기·배기·스모그·경광등의 최종 Unity 효과를 제공된 Anchor에 연결하고 타깃 PC에서 강도를 조절합니다.
4. NPC 추적 화면에서 데칼이 불투명 사각형으로 바뀌지 않는지 확인합니다.
5. 전시 승인 담당자가 확인한 뒤에만 manifest를 approved로 바꿉니다.

최종 프로젝트 반영 확인: 2026-10-14. 실제 Unity 프로젝트 검사 통과, 재질 가져오기 경고 해소. 상세 기록: ActualProjectValidation.txt 및 CatalogAudit.md.
