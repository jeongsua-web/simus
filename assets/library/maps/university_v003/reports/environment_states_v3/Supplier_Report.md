# SIM:US 환경 상태 및 역할 NPC — 결과 보고

중단 전 저장본을 확인하여 이어서 작업했습니다. 원본 파일은 덮어쓰지 않았습니다. 아래 6개 결과 파일과 검토 이미지를 저장했습니다.

1. 사용한 기존 맵

`C:/Users/sonmi/OneDrive/Desktop/ingProject/simus/unity/Assets/SIMUS/Art/maps/university_v003/SIMUS_Dense_Realistic_University_Map_03.blend`

2. 사용한 기본 캐릭터

`C:/Users/sonmi/Documents/Codex/2026-09-22/higgsfield-plugin-app-6a3293e129088191abf0875820e839da-openai-curated-6/SIMUS_Modular_Character/CapFix/SIMUS_Modular_Character_Unity_CapFix.blend`

3. 그대로 재사용한 환경 에셋

BENCH_CLEAN, LAMP_NORMAL, TREE_HEALTHY, RECYCLE_NORMAL, PLANTER_HEALTHY

4. 복제 후 변형한 환경 에셋

BENCH_BROKEN, LAMP_BROKEN_OFF, TREE_WITHERED, TRASH_BIN_OVERFLOW

5. 새로 제작한 환경 에셋

TRASH_BAG_BLACK, CCTV_KOREAN_POLE, FLOWERBED_HEALTHY, FLOWERBED_WITHERED, CARDBOARD_STACK, TRASH_PILE_SMALL, TRASH_PILE_MEDIUM, TRASH_PILE_LARGE, FENCE_NORMAL, FENCE_BENT, EMERGENCY_BELL, FESTIVAL_FLAGS, FESTIVAL_FLAGS_FADED, BALLOON_CLUSTER, BROAD_GROUND_STAIN, WATER_CLEAR, WATER_POLLUTED, BROWN_GRASS, HEALTHY_GRASS, DIRTY_DRAIN, EXHAUST_PUFFS, VENT_SMOKE, CONSTRUCTION_DUST, VENT_OUTLET, FALLEN_BICYCLE, ILLEGALLY_PARKED_CAR, GRAFFITI_DECAL_01, GRAFFITI_DECAL_02, GRAFFITI_DECAL_03, GRAFFITI_DECAL_04, MAINTENANCE_DUST_BASE, DECOR_LIGHTS_ON, DECOR_LIGHTS_OFF

총 42종의 원본 에셋을 정리했습니다. 기존 학교·건물·도로 등을 포함한 19,572개 오브젝트의 메시와 변환을 비교했으며 변경은 없었습니다. 폐허나 닫힌 상점 셔터는 추가하지 않았습니다.

6. 배치 위치

- 학교 남쪽 버스정류장 주변: 꽃·깃발·풍선·장식등, 대략 x35–53 / y-109–-105m.
- 동·서쪽 보도 가장자리: CCTV·비상벨, x96.3 및 -90.8m. 남쪽 시설은 y-125m 부근.
- 남·북쪽 수거 구역: 정상/불량 수거함, 봉투·상자·쓰레기 더미, y-151 및148–149m 부근.
- 기존 HOUSE01/03/05/07의 빈 외벽: 서로 다른 낙서 4종, 벽에서 약1cm 이격. 창문과 문 위에는 배치하지 않았습니다.
- 남쪽 주차·정비 구역: 불법주차 차량, 별도 배기가스 차량, 환기구와 먼지·정비 콘.
- 캠퍼스 경계: 정상/시든 식생과 잔디, 물·배수구 상태 표현.

정확한 각 오브젝트 좌표는 `Reports/Environment_Placement_Audit.json`, 교체 대상 원본은 `Reports/Replacement_Mapping.json`에 있습니다. 차량 도로와 소품 전체 경계의 겹침 후보는 없었으며, 보도 가장자리 배치 후 통행 폭을 확보했습니다.

7. 상태 구조와 사용

```
BASE_ENVIRONMENT
STATE_OBJECTS
  HAPPINESS / HAPPINESS_GOOD, HAPPINESS_BAD
  SAFETY / SAFETY_GOOD, SAFETY_BAD
  CLEANLINESS / CLEANLINESS_GOOD, CLEANLINESS_BAD
  POLLUTION / POLLUTION_LOW, POLLUTION_HIGH
  STATE_REPLACEMENTS
STATE_ASSET_SOURCES
```

Blender 컬렉션과 FBX Empty 계층을 함께 구성했습니다. 맵 저장 기본값은 NORMAL이며 기존 환경을 보여줍니다. 상태 추가 소품은 원하는 그룹을 켜서 확인합니다. GOOD/BAD 또는 LOW/HIGH를 동시에 켜지 마세요. 교체 소품 6쌍은 Unity 기존 맵에 추가할 때 매핑된 기존 원본을 끄고 NORMAL/BAD 중 하나만 활성화해야 겹치지 않습니다. 상태 수치 연동 스크립트·AI·NavMesh는 이번 산출물에 포함하지 않습니다. 원본 라이브러리 컬렉션은 숨김 상태입니다.

8. 경찰

남색 상의·바지, 얇은 칼라/앞여밈, 견장·배지·명찰·팔 패치, 연결된 벨트·무전기·파우치, 캡 포니테일과 부츠. 무기는 없습니다.

9. 미화원

긴 소매, 앞뒤와 어깨가 연결된 주황 안전조끼, 반사띠·얇은 주머니, 장갑·캡 곱슬머리·부츠, LeftHand를 따르는 빗자루, 독립 이동용 수거 카트. 카트는 인체 스키닝 대상이 아닌 별도 소품입니다.

10. 범죄자

닫힌 후드, 평평한 천 주머니, 어깨·옆구리까지 이어지는 몸에 맞춘 가방끈과 가방, 곡면 하안면 마스크, 장갑·어두운 바지·신발. 기존 얼굴과 신체 비율을 유지했고 무기는 없습니다.

11. 웨이트·관통 검사

3종 모두 원본 BODY 좌표와22개 뼈의 이름·기준 위치를 유지했습니다. 스킨 웨이트 합계 정상, Armature 연결과 재질 할당을 확인했습니다. Rest, ArmsDown, ArmsForward, ArmsSide, KneesBent, TorsoLean 및 Idle/Walk/Interact/Wave의 대표 자세를 검사하고 이미지를 검토했습니다. 후드와 머리/몸의 검사 교차는0이며, 조끼와 후드는 열린 경계 및 비정상 연결이0입니다. 빗자루의 팔 내림 시 다리 겹침을 발견해 손잡이를 중심으로 각도를 수정했고, 최종10개 대표 자세에서 바지·신발 교차가0입니다. 임의의 모든 애니메이션 조합에 대한 무관통 보장은 아니며, 실제 게임 추가 동작은 별도 확인이 필요합니다.

12. 내보내기

환경 FBX: 93개 메시 및20개 Empty, 총113개 오브젝트. 기존 맵·학교·건물·도로·리그·카메라·조명을 중복 포함하지 않습니다. 재불러오기 후 이름·재질·위치 비교를 통과했습니다.

NPC FBX: 경찰22메시, 미화원18메시, 범죄자12메시. 각22본 및 Idle/Walk/Interact/Wave를 포함하고 다른 NPC·카메라·조명은 제외했습니다. FBX 재불러오기 후 스키닝과 Walk/Wave의 실제 뼈 회전 변화를 확인했습니다. Unity Editor에서의 Humanoid 설정 및 실제 게임 재생은 수행하지 않았습니다.

13. 결과 파일 전체 경로

- `C:/Users/sonmi/Documents/Codex/2026-09-22/higgsfield-plugin-app-6a3293e129088191abf0875820e839da-openai-curated-6/SIMUS_Environmental_States_v3/SIMUS_Map_Environmental_States_v3.blend`
- `C:/Users/sonmi/Documents/Codex/2026-09-22/higgsfield-plugin-app-6a3293e129088191abf0875820e839da-openai-curated-6/SIMUS_Environmental_States_v3/SIMUS_Environmental_State_Assets_v3.fbx`
- `C:/Users/sonmi/Documents/Codex/2026-09-22/higgsfield-plugin-app-6a3293e129088191abf0875820e839da-openai-curated-6/SIMUS_Environmental_States_v3/SIMUS_NPC_Role_Variants.blend`
- `C:/Users/sonmi/Documents/Codex/2026-09-22/higgsfield-plugin-app-6a3293e129088191abf0875820e839da-openai-curated-6/SIMUS_Environmental_States_v3/SIMUS_NPC_Police.fbx`
- `C:/Users/sonmi/Documents/Codex/2026-09-22/higgsfield-plugin-app-6a3293e129088191abf0875820e839da-openai-curated-6/SIMUS_Environmental_States_v3/SIMUS_NPC_Cleaner.fbx`
- `C:/Users/sonmi/Documents/Codex/2026-09-22/higgsfield-plugin-app-6a3293e129088191abf0875820e839da-openai-curated-6/SIMUS_Environmental_States_v3/SIMUS_NPC_Criminal.fbx`

파일 크기 및 SHA-256은 `Reports/Delivery_File_Manifest.json`에 기록했습니다. `Previews`에 맵 상태·에셋·NPC 정면/후면/자세 검토 이미지가 있습니다. `Reports/NPC_Resume_Checkpoint.blend`는 작업 재개 전 중간 백업으로 최종 결과가 아닙니다. `.blend1`은 Blender 자동 이전 저장본입니다.

14. 맵과 NPC 분리 확인

맵에 NPC를 배치하지 않았습니다. NPC는 별도 Blender 파일의 SIMUS_NPC_ROLES 장면과 개별 FBX에만 있습니다. 스폰 포인트와 AI도 추가하지 않았습니다.
