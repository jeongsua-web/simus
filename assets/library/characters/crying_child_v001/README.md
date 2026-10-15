# SIM:US 울고 있는 아이 NPC v001

제작: 2026-10-14~15 · 상태: received · 기존 맵 미배치

- [Blender 원본](source/SIMUS_NPC_CryingChild.blend)
- [전체 검수 이미지](previews/Final_Overview.jpg)
- [울음 GIF](previews/CHILD_CRY_LOOP.gif) · [눈물 닦기 GIF](previews/CHILD_WIPE_TEARS.gif)
- [검수 보고서](reports/Delivery_Report.md)
- Unity 프리팹: `unity/Assets/SIMUS/Prefabs/characters/crying_child_v001/SIMUS_NPC_CryingChild.prefab`
- FBX: `unity/Assets/SIMUS/Art/characters/crying_child_v001/models/SIMUS_NPC_CryingChild.fbx`

Unity에서는 프리팹을 사용하세요. Humanoid Avatar, Animator, CapsuleCollider, 8개 공유 재질, 눈물 토글과 UI/상호작용 앵커가 연결되어 있습니다. FBX 자체에는 4개 클립이 포함됩니다. 별도 애니메이션 FBX나 외부 텍스처는 필요하지 않습니다.

## 재생
Animator의 `Emotion` 정수: 0=SadIdle, 1=CryLoop, 2=StrongSob. `Wipe` 트리거=눈물 닦기 후 대기 복귀. WipeTears는 2.5초 일회성이고 나머지는 반복됩니다. 이동/사건 코드는 추가하지 않았습니다.

`CHILD_TEARS`를 끄면 눈물이 숨겨집니다. 눈썹과 입도 별도 메시입니다. UI_ANCHOR_HEAD, INTERACTION_ANCHOR, CHILD_FX_TEARS_L/R를 사용할 수 있습니다. CapsuleCollider는 높이1.25m/반지름0.18m입니다.

Blender는 -Y 전방/Z 상방이고 Unity 프리팹은 +Z 전방/Y 상방입니다. 프리팹 내부 모델 회전은 Humanoid 축 보정값(0,180,0)이므로 초기화하지 마세요. 배치·회전·이동은 바깥 SIMUS_NPC_CryingChild를 사용합니다. Apply Root Motion은 꺼져 있습니다.

기존 프로젝트와 같은 Built-in Standard 재질입니다. 다른 URP/HDRP 프로젝트로 옮기면 재질 변환이 필요합니다. 맵 배치와 게임 연결, 타깃 기기 성능·전시 승인은 별도입니다.
