SIM:US 모듈형 캐릭터 — Unity 전달 안내

파일
- SIMUS_Modular_Character_Unity.blend: 편집 가능한 원본
- SIMUS_Modular_Character_Unity.fbx: Unity용 모델과 기존 애니메이션
- Hair_Catalog_Final.png / Hair_Catalog_ThreeQuarter.png: 16종 비교
- Structural_Motion_Audit.json / FBX_Roundtrip_Audit.json: 검사 기록

기본 구조
SIMUS_CHARACTER_ROOT
  ARMATURE (기존 22개 본)
  BODY
  OUTFIT_TOP
  OUTFIT_BOTTOM
  SHOES
  HAIR_ROOT
    HAIR_01_PARTED_SHORT
    HAIR_02_BEANIE_SHORT
    HAIR_03_BOB_BANGS
    HAIR_04_BOB_NO_BANGS
    HAIR_05_PONYTAIL_BANGS
    HAIR_06_CAP_PONYTAIL
    HAIR_07_TWIN_TAIL_BANGS
    HAIR_08_SIDE_TAIL_BANGS
    HAIR_09_LONG_STRAIGHT_BANGS
    HAIR_10_LONG_STRAIGHT_NO_BANGS
    HAIR_11_CAP_CURLY_BOB
    HAIR_12_BUN_NO_BANGS
    HAIR_13_BALD (빈 선택 슬롯)
    HAIR_14_LONG_CURLY
    HAIR_15_SHORT_BANGS
    HAIR_16_LOW_SHORT_PONYTAIL
  ACCESSORY_ROOT
    GLASSES_SQUARE
    GLASSES_ROUND

헤어 목록
01 가르마 숏컷 / 02 니트모자 숏컷 / 03 앞머리 단발 / 04 앞머리 없는 단발
05 앞머리 포니테일 / 06 캡 포니테일 / 07 양갈래 / 08 사이드 테일
09 앞머리 장발 / 10 앞머리 없는 장발 / 11 캡 곱슬 단발 / 12 번 헤어
13 대머리 / 14 곱슬 장발 / 15 앞머리 숏컷 / 16 짧은 로우 포니테일

머티리얼
MAT_SKIN, MAT_HAIR, MAT_OUTFIT_TOP, MAT_OUTFIT_BOTTOM, MAT_SHOES, MAT_HAT, MAT_GLASSES
추가 MAT_EYES는 기존 눈 색을 보존합니다.
MAT_PREVIEW_TOP_*은 색상 예시용이며 FBX에는 포함되지 않습니다.
모두 단순한 Principled Base Color입니다. 상의에는 MAT_OUTFIT_TOP 하나만 사용합니다.

Unity 선택 방법
- SIMUS_CHARACTER_ROOT와 ARMATURE, BODY, OUTFIT_TOP, OUTFIT_BOTTOM, SHOES는 유지합니다.
- HAIR_ROOT 아래 01~16 중 하나만 활성화합니다. 13번은 머리카락 없는 상태입니다.
- 모자가 포함된 02/06/11번은 해당 메시의 MAT_HAT 슬롯으로 모자 색을 바꿀 수 있습니다.
- ACCESSORY_ROOT에서는 두 안경을 모두 끄면 안경 없음, 하나만 켜면 해당 안경입니다.
- MAT_OUTFIT_TOP의 색상으로 상의 전체 색상을 바꿉니다. 피부/바지/신발/머리색은 독립적입니다.
- FBX에는 교체용 옵션이 모두 들어 있습니다. Blender의 숨김 상태가 Unity GameObject 활성 상태로 그대로 전달된다고 가정하지 말고, Unity에서 01만 켜고 나머지 헤어와 안경을 끄는 기본 프리팹 상태를 설정하세요.
- 이번 요청 범위에 따라 선택 스크립트와 UI는 만들지 않았습니다.
- 기존 Humanoid용 본 이름과 구조를 유지했습니다. Unity의 Avatar 매핑 및 런타임 동작은 이 작업에서 실행 검사하지 않았습니다.

Blender
- 기본 표시: 01번 헤어만 표시, 안경 없음, 원래 리그의 기본 자세.
- PREVIEW_ONLY는 별도의 16종 비교용이며 내보내기에서 제외했습니다.
- 원본 몸체/의상의 정점 위치와 Weight Paint를 유지했습니다. 기존 헤어를 제거하고 비어 있던 정수리에 정점 19개를 추가해 닫았습니다.
- 기존 Idle, Walk, Interact, Wave를 ARMATURE의 NLA 트랙에 보존했습니다. 저장 시 기본 자세 유지를 위해 트랙은 음소거 상태입니다.
- 신체의 목 끝과 의상의 손목/발목 등 원래 의도된 안쪽 경계는 유지했습니다. 새 헤어와 안경은 닫힌 메시입니다.

검사
- 원본 NPC 파일 해시 동일.
- 몸체 425개, 상의 572개, 바지 456개, 신발 120개 정점의 위치/가중치 원본과 일치.
- 22개 본의 기본 행렬 원본과 일치.
- 네 애니메이션 각각 6개 표본 프레임, 액세서리 메시 17개의 Head 추종 검사.
- 정면/측면/후면 렌더, 동작 렌더와 최종 Blender 화면 확인.
- FBX 재가져오기: 오브젝트 26개, 스킨 메시 21개, 본 22개, 네 애니메이션, 재질 및 정점 수 확인.
- Unity 실제 실행 검사는 미실시.
