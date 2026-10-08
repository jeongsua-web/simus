# SIM:US 시민 NPC 라이브러리

16개 외형, 외형마다 3단계 LOD, 공통 22개 뼈대, Idle / Walk / Interact / Wave 동작을 포함합니다. 외형·의상색·피부색·머리색은 학과 및 MBTI와 독립적입니다.

## 파일

- `SIMUS_NPC_Base_16_Unity.blend`: 원본 편집 파일. `SIMUS_NPC_PREVIEW` 장면에서 4×4 미리보기를 볼 수 있습니다. 원래 `Scene`의 Cube, Camera, Light는 그대로 보존했습니다.
- `SIMUS_NPC_Characters.fbx`: 16종 전체와 LOD 48개를 담은 모델 파일.
- `SIMUS_NPC_Animations.fbx`: 네 가지 공통 애니메이션.
- `Models/NPC_STYLE_01.fbx`부터 `NPC_STYLE_16.fbx`: 외형별 Humanoid 임포트에 적합한 개별 FBX. 전체 모델 FBX는 여러 리그를 포함하므로 실제 프리팹에는 이 개별 파일을 사용합니다.
- `SIMUS_NPC_Unity.unitypackage`: Unity 6.3에서 검사한 프리팹 16개, 공유 재질, 셰이더, Animator Controller, 데이터·색상 컴포넌트, 모델·애니메이션을 포함합니다.
- `SIMUS_NPC_Manifest.json`: 팔레트, 외형 ID, 뼈 이름, 마스크, 클립·LOD 기준.
- `SIMUS_NPC_16_Preview.png`, `SIMUS_NPC_16_Isometric.png`: Blender 미리보기.
- `Validation`: Blender·Unity 검사 결과.

## Unity 사용

1. `SIMUS_NPC_Unity.unitypackage`를 임포트합니다. 검증 버전은 Unity **6000.3.24f1**, Built-in Render Pipeline입니다.
2. `Assets/SIMUS_NPC/Prefabs`의 프리팹을 배치합니다. Animator, LODGroup, CapsuleCollider, NPC 데이터 및 외형 컴포넌트, NavMeshAgent, DepartmentBadgeSocket이 포함되어 있습니다.
3. 이동용 NavMesh를 준비한 뒤 NavMeshAgent를 활성화합니다. 프리팹에서는 미완성 NavMesh 위의 자동 이동 오류를 피하도록 비활성 상태입니다.
4. `SimusNPCAppearance.SetPrimary(color)`는 대표 의상색만 바꿉니다. 두 번째 인자를 `true`로 지정하면 보조색도 파생합니다. 피부·머리색은 독립 필드입니다. 재질을 복제하지 않고 MaterialPropertyBlock을 사용합니다.
5. Animator의 `Idle`, `Walk`, `Interact`, `Wave` 상태를 선택해 사용합니다. Wave는 재생 후 Idle로 돌아옵니다. 실제 이동은 NavMeshAgent 또는 이동 코드에서 처리합니다.

모델 FBX를 직접 임포트할 때는 `Assets/SIMUS_NPC/Models` 아래에 배치하고 제공된 Editor 스크립트를 함께 사용하면 가슴 뼈를 포함한 Humanoid 매핑이 명시적으로 지정됩니다. **애니메이션도 동일한 매핑을 사용해야 합니다.** `SIMUS/Build and validate NPC library` 메뉴로 프리팹을 다시 생성할 수 있습니다.

## 렌더 파이프라인

검증된 기본 셰이더는 `SIMUS/NPCVertexMask`이며 Built-in용입니다. URP 프로젝트용 대안은 `UnityIntegration/OptionalURP/NPCVertexMaskURP.shader`입니다. URP 패키지가 설치된 프로젝트에서 이 파일을 가져오고 공유 재질의 셰이더를 `SIMUS/NPCVertexMaskURP`로 바꾸세요. **URP 대안의 실제 컴파일·렌더는 이번 검증 범위에 포함되지 않습니다.**

마스크는 Vertex Color의 R=대표색, G=보조색, B=피부, A=머리, 전부 0=바지·신발 등 중립색입니다. Alpha 채널은 투명도가 아닙니다. 모든 캐릭터는 불투명 재질 슬롯 1개만 사용합니다.

## 성능 및 편집

- LOD0: 3,204–3,388 삼각형. LOD1: 1,264–1,388. LOD2: 518–590.
- LOD 전환: 화면 높이 .60 / .25 / .05, 그 아래 컬링.
- 키: 약 1.65–1.675m. Collider 높이 1.65m, 반경 .27m, 중심 Y .825m.
- 각 LOD는 드로콜을 줄이기 위해 한 메시로 묶여 있습니다. Blender의 `SIMUS_PART_ID` 정점 속성과 메시의 `part_names`로 머리·몸·옷·액세서리 영역을 확인할 수 있습니다.
- 공통 부품은 같은 생성 규칙을 재사용하며, 미리보기는 실제 모델 메시 데이터를 공유합니다. 각 리그 오브젝트는 같은 Armature 데이터를 공유하고, 네 Action을 재사용합니다.
- 일반적인 Unity SkinnedMeshRenderer는 재질의 GPU Instancing 체크만으로 자동 GPU 인스턴싱되지 않습니다. 공유 재질·PropertyBlock·LOD는 준비됐지만, 화면에 보이는 NPC 수·애니메이션 갱신 빈도·풀링은 게임에서 조절해야 합니다. 6,000명 동시 렌더링 성능을 보장하는 부하 시험은 하지 않았습니다.
- 데이터 6,000개는 `NPCRecord` 목록 등으로 관리하고, 보이는 일부에만 프리팹을 할당하는 구조를 권장합니다.

Unity 공식 참고: [GPU instancing 지원 범위](https://docs.unity3d.com/ja/6000.0/Manual/gpu-instancing-enable.html), [ModelImporter](https://docs.unity3d.com/cn/current/ScriptReference/ModelImporter.html).
