# 무거운 짐 운반 시민 NPC 제작·검수

제작일: 2026-10-15 / v001 / received / 기존 맵 미배치

## 재사용 및 보존
기준 원본: `unity/Assets/SIMUS/Art/characters/modular_hairfix_v001/models/SIMUS_Modular_Character_Unity_CapFix.blend`.
BODY/OUTFIT_TOP/OUTFIT_BOTTOM/SHOES와 Humanoid Armature를 독립 복사하여 성인 크기·몸체·원래 웨이트를 유지했습니다. 재질은 별도 복사/생성했습니다. 헤어·눈썹/입/코·장갑 손가락·소매 연결부·상자·테이프·픽토그램·4개 동작은 새 제작입니다. 기존 캐릭터와 비교 이미지에 원래 성인 모델을 함께 렌더했습니다.
작업 전 실제 파일 2011개를 SHA-256로 비교했으며 기존 원본·맵·에셋 변경 없음. 기존 게임 코드/장면 미수정. 임시 파일·검증 프로젝트·백업은 C:/Project/simus 외부에 있습니다.

## 크기·구조
- 성인 휴식 체형 키 약1.644m. 무릎을 굽힌 Unity 대기 자세 경계 높이 1.6072m.
- 골판지 본체 .70×.48×.52m. 종이/테이프 두께 약.6mm. 닫힌 플랩, 포장 테이프3줄, 취급 방향 화살표, 모서리 베벨과 작은 상면 눌림. 내부 물건/브랜드 없음.
- 에셋 오브젝트 24개, 메시 15개, 최종 평가 삼각형 5,220개, 뼈25개, 재질11개, 외부 텍스처0개.
- 기본 Humanoid21본 매핑, Root와 Carry 보조본 및 좌우 Grip 손가락 굽힘 본. SkinnedMeshRenderer12개.
- 실제 부착은 왼손 본 소켓 방식. 오른손 동작은 상자와 일치하도록 매 프레임 계산 후 키로 저장. Unity에서 비인체 Carry 본의 축 변환이 다르게 적용되던 문제를 손 본 부착으로 해결했습니다.
- CARRY_ANCHOR/CARRY_PROP_ROOT/HAND_TARGET_L/R/UI_ANCHOR_HEAD/INTERACTION_ANCHOR/Collider 기준 포함. Capsule 높이1.65m 반지름.23m.

## 애니메이션
| 이름 | 길이 | FPS | 재생 |
|---|---|---|---|
|HEAVY_CARRY_WALK|1.40초|30|반복|
|HEAVY_CARRY_IDLE|4.00초|30|반복|
|HEAVY_CARRY_STRUGGLE|3.00초|30|일회성|
|HEAVY_CARRY_LOOK_AROUND|2.50초|30|일회성|

루트 이동 없는 in-place. 걷기 보폭 .17m/반주기.7초로 약.24m/s 권장. 발 들기 약2.8cm, 몸통을 조금 젖히고 무릎을 굽힘. Struggle은 약4.2cm 내려갔다 다시 받침. LookAround는 머리의 수직 축으로 좌우 회전. PUT_DOWN은 선택 사항으로 미제작.

## 검사 결과
- Blender 총331프레임에서 Root 이동0, 양손-상자 기준 오차 0.001mm 미만, 루프 시작/끝 행렬 오차 부동소수점 범위.
- 평가된 신체/의상/장갑 정점을 상자 공간에서 검사: 2mm 초과 내부 침투 없음. 양손 접촉 표면 최대 틈 약1.7mm. 이 검사는 정점 기반 검사이며 모든 삼각형 쌍의 연속 충돌 검사는 아닙니다. 측면/접촉 확대 렌더로도 확인했습니다.
- 모든 스킨 정점 웨이트 할당. 실제 몸·의상·머리·신발·상자 본체 열린 경계0. 테이프/픽토그램은 얇은 Solidify를 적용해 Unity의 뒷면 제거에도 표시됩니다.
- 음수 스케일 없음, 원본과 독립 메시/재질, 장식용 가슴/무릎/발 큐브 없음.
- Unity6000.3.24f1의 별도 검증 프로젝트에서 실제 FBX 가져오기: valid Human Avatar, 4개 Human Motion 클립 인식, 각13시점에서 직립/루트 고정/손-상자 위치 확인. 최대 상대 오차 0.00000767m.
- 실제 Animator Controller의 CarryWalk 진입, CarryStruggle 지속과 CarryIdle 복귀 검사. 4개 클립별 시작/중간/끝과 고개 회전 극점 이미지 제공.
- Unity 재생 모습을 BakeMesh로 실제 샘플링하여 렌더. 상자 독립 FBX 높이·원점·재질 및 BoxCollider 확인.
- 상자 픽토그램의 뒤집힌 단면 표시 문제를 얇은 실체 두께로 해결하고 최종 Unity 렌더에서 확인.
- 정면/양측면/후면/사선/얼굴/접촉/의상/성인 키 비교/독립 상자/앵커 이미지 포함. 앵커 이미지의 중앙 청록 구는 Carry, 손 주변 베이지 구는 Hand Target입니다.

## 경로와 적용
원본: `assets/library/characters/heavy_carrier_v001/source/SIMUS_NPC_HeavyCarrier.blend`
NPC FBX: `unity/Assets/SIMUS/Art/characters/heavy_carrier_v001/models/SIMUS_NPC_HeavyCarrier.fbx`
상자 FBX: `unity/Assets/SIMUS/Art/props/heavy_box_v001/models/SIMUS_Prop_HeavyBox.fbx`
NPC 프리팹: `unity/Assets/SIMUS/Prefabs/characters/heavy_carrier_v001/SIMUS_NPC_HeavyCarrier.prefab`
상자 프리팹: `unity/Assets/SIMUS/Prefabs/props/heavy_box_v001/SIMUS_Prop_HeavyBox.prefab`
Controller: `unity/Assets/SIMUS/Art/characters/heavy_carrier_v001/animations/HeavyCarrier.controller`
재질: 위 characters/key/materials 및 props/heavy_box_v001/materials. 텍스처 폴더는 불필요하여 만들지 않았습니다.

## 추가 검수 및 기존 문제
실제 맵 배치/게임 이벤트 연결/여러 Avatar로 리타게팅/타깃 기기 성능은 이번 범위 밖입니다. 전시 담당자의 외형 및 성능 승인은 필요하며 approved로 표시하지 않습니다. 상자 크기 교체 시 손 위치 재조정 필요.
작업 전부터 Happiness_Animations.blend 및 CryingChild.blend 두 원본의 manifest 해시가 실제 파일과 불일치했습니다. 사용자가 변경한 기존 파일과 그 등록 행은 건드리지 않았습니다. 신규 두 항목은 실제 파일 해시로 등록했습니다.
