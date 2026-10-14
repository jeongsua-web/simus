# 울고 있는 아이 NPC — 제작 및 검수

제작일 2026-10-14~15 / v001 / received / 기존 맵 미배치.

## 참고·재사용·보존
- 기준 원본: unity/Assets/SIMUS/Art/characters/modular_hairfix_v001/models/SIMUS_Modular_Character_Unity_CapFix.blend
- BODY, OUTFIT_TOP, OUTFIT_BOTTOM, SHOES, ARMATURE의 독립 복사본을 사용했습니다. 피부·눈·머리카락 재질도 복사했습니다.
- Happiness_Animations의 13 Action 구조와 역할 NPC 원본의 경찰/미화원/범죄자 컬렉션 및 공통 Skeleton/4 Action 명명 구조를 읽었습니다. 이 파일들은 변경하지 않았습니다.
- 단순 균일 축소가 아닙니다. 골반 높이 .82→.56m, 어깨 높이1.28→약.90m, 머리 폭 약1.08배, 머리 수직 길이 약1.17배로 재구성했습니다. 성인1.645m와 비교 이미지 제공.
- 짧은 앞머리, 슬픈 눈썹/입/코, 눈물, 백팩/끈/손잡이/봉제선, 손목 연결부 및 모든 CHILD Action은 새로 제작했습니다.
- 기존 에셋 1944개를 SHA-256로 비교했으며 변경·삭제가 없습니다. 기존 맵/캐릭터/게임 코드·장면 변경 없음.

## 구성
- Blender 머리카락 포함 휴식 체형 키: 약1.255m. Unity 기본 슬픈 자세 경계 높이: 1.2510m.
- 메시 16개, 삼각형 6,580개, 뼈 22개, 캐릭터 재질 8개.
- 원점 양발 사이 지면. Blender -Y 전방; Unity 프리팹 +Z 전방.
- 외부 이미지 텍스처 없음. 피부/머리/눈/상의/하의/신발/가방/눈물 8개 재질.
- 몸체/머리/눈/눈썹/입/눈물/머리카락/의상/신발/백팩 분리, Armature Modifier와 정점 웨이트 유지.
- 22개 뼈의 기존 Humanoid 명명 유지. 손은 단순화된 미튼 형태이며 개별 손가락 뼈는 없습니다. 손을 눈가로 가져오는 동작으로 감정을 표현합니다.

## 애니메이션
| 클립 | 길이 | FPS | 재생 |
|---|---|---|---|
| CHILD_WIPE_TEARS | 2.50초 | 30 | 일회성 |
| CHILD_SOB_STRONG | 3.00초 | 30 | 반복 |
| CHILD_IDLE_SAD | 4.00초 | 30 | 반복 |
| CHILD_CRY_LOOP | 5.00초 | 30 | 반복 |

- 루트 이동 없는 in-place. 강한 흐느낌에는 작은 골반 하강/무릎 굽힘과 양손 동작을 포함합니다.
- Blender 전체439프레임 검사: Root 이동0, 발 본 이동은 부동소수점 오차 범위, 반복 경계 행렬 오차 약0. 손 정점과 머리 표면의 1mm 초과 내부 침투 표본0.
- 모든 메시 열린 경계0, 웨이트 없는 정점0. 원본 의상·목·손목 연결을 유지하고, 가슴/무릎/발의 블록 장식은 추가하지 않았습니다.
- 기본 A-Pose는 리그 Rest Position에서 확인 가능합니다. 저장 화면은 SadIdle, 애니메이션은 Action에서 변경합니다.

## Unity 검증
- Unity 6000.3.24f1의 별도 검증 프로젝트에서 실제 FBX 재가져오기/샘플링/렌더.
- Avatar valid=true, human=true. 4개 Human Motion 클립의 이름·길이·반복 여부 확인.
- 클립당13시점에서 직립/루트 고정 검사. 실제 손 위치로 Idle/Wipe/Cry/StrongSob의 서로 다른 자세 확인.
- 최종 렌더는 각 시점의 SkinnedMesh를 BakeMesh로 읽어 촬영하여 편집기 렌더 캐시가 다른 클립으로 남는 문제를 피했습니다.
- 실제 Controller의 CryLoop 진입, WipeTears 지속 및 SadIdle 복귀 검사.
- 초기 NLA 중첩 내보내기와 남은 Avatar 설정 문제를 수정했습니다. 최종 FBX는 각 Action을 독립 Take로 내보내며 새 Avatar 설정에서 다리 꼬임/누운 자세가 사라졌습니다.
- 기존 실게임 장면 Play Mode/맵 배치/성능 벤치마크는 이번 작업 범위가 아니며 실행하지 않았습니다. 실제 맵 조명/거리에서 최종 담당자 검토 필요. 승인 상태는 received입니다.

## 파일
- 원본: `assets/library/characters/crying_child_v001/source/SIMUS_NPC_CryingChild.blend`
- FBX: `unity/Assets/SIMUS/Art/characters/crying_child_v001/models/SIMUS_NPC_CryingChild.fbx`
- 프리팹: `unity/Assets/SIMUS/Prefabs/characters/crying_child_v001/SIMUS_NPC_CryingChild.prefab`
- Controller: unity/Assets/SIMUS/Art/characters/crying_child_v001/animations/CryingChild.controller
- 재질: unity/Assets/SIMUS/Art/characters/crying_child_v001/materials/
- previews/: 요청된 각도·얼굴·눈물·성인비교·가방·동작 시작/중간/끝 이미지 및 4개 GIF. GIF는 가벼운 Workbench 미리보기, PNG는 EEVEE/Unity 검수 렌더입니다.
- JSON: blender_audit / collision_audit / unity_audit / reference / additional_references.

## 기존 목록 오류
새 에셋과 무관한 기존 Happiness_Animations 원본 해시 불일치1건이 작업 전부터 존재합니다. 기존 manifest 행이나 파일을 임의로 바꾸지 않았습니다. 신규 항목은 실파일 해시로 등록했습니다.
