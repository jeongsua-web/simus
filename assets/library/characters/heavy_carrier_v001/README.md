# SIM:US 무거운 짐 운반 시민 NPC

2026-10-15 · v001 · received · 기존 맵 미배치

- [Blender 원본](source/SIMUS_NPC_HeavyCarrier.blend)
- [전체 검수 이미지](previews/Final_Overview.jpg)
- [검수 보고서](reports/Delivery_Report.md)
- NPC 프리팹: `unity/Assets/SIMUS/Prefabs/characters/heavy_carrier_v001/SIMUS_NPC_HeavyCarrier.prefab`
- 상자 프리팹: `unity/Assets/SIMUS/Prefabs/props/heavy_box_v001/SIMUS_Prop_HeavyBox.prefab`
- NPC FBX: `unity/Assets/SIMUS/Art/characters/heavy_carrier_v001/models/SIMUS_NPC_HeavyCarrier.fbx`
- 상자 FBX: `unity/Assets/SIMUS/Art/props/heavy_box_v001/models/SIMUS_Prop_HeavyBox.fbx`

## Unity 사용
NPC 프리팹을 사용하면 Humanoid Avatar, Animator, CapsuleCollider, 4개 클립, 공유 재질, UI/상호작용 앵커와 상자가 연결됩니다. 맵에는 배치하지 않았습니다.

Animator의 `Walking`=true는 CarryWalk, false는 CarryIdle입니다. `Struggle`, `LookAround` 트리거는 각각 상자 다시 받치기와 좌우 살피기를 재생한 뒤 CarryIdle로 복귀합니다. Walking=true가 유지되면 다시 걷습니다. Apply Root Motion은 꺼져 있습니다. 게임 코드는 추가하지 않았습니다.

걷기는 제자리 동작이며 권장 전진 속도 약0.24m/s입니다. 실제 이동은 게임 로직에서 적용합니다. 기본 A-Pose는 Blender의 Armature Rest Position에서 확인합니다. 저장 화면은 CarryIdle입니다.

## 상자 교체
`LeftHand > CARRY_ANCHOR > CARRY_PROP_ROOT`에 별도 상자 메시가 연결됩니다. 양손 자세는 이 상자의 크기에 맞춰 구워져 있습니다. `HAND_TARGET_L/R`는 접촉 위치 참고용입니다. 크기가 다른 소품으로 바꿀 때는 손 위치를 다시 맞춰야 합니다. Animation Rigging 패키지나 실시간 IK 의존성은 없습니다.

상자 독립 프리팹의 원점은 상자 중심입니다. 바닥에 놓으려면 중심을 지면보다 약0.26m 높게 둡니다. 이 프리팹은 NPC 재질 파일과 독립적으로 소품 폴더의 재질을 사용합니다. NPC도 같은 상자 재질을 공유합니다.

Unity 프리팹 바깥 루트는 +Z 전방/Y 상방입니다. 내부 모델의 축 보정 회전(0,180,0)을 초기화하지 말고 바깥 루트로 배치·회전하세요. 캐릭터 원점은 발 사이 지면입니다.

헤어·얼굴·옷·장갑·상자·테이프·표지가 분리되어 있습니다. 기본/힘든 표정 전환은 선택 기능으로 미구현이며 현재 힘주는 표정이 기본입니다. 선택 동작 PUT_DOWN은 포함하지 않았습니다.

외부 텍스처 없이 11개 공유 색상 재질을 사용합니다. 현재 프로젝트와 같은 Built-in Standard 재질이며 URP/HDRP로 옮길 때는 재질 변환이 필요합니다. 전시 승인 및 타깃 기기 성능 검수는 별도입니다.
