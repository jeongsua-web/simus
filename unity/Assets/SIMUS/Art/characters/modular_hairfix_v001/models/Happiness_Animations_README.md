# SIM:US 행복도 애니메이션 결과

1. 사용한 원본: `C:/Project/simus/unity/Assets/SIMUS/Art/characters/modular_hairfix_v001/models/SIMUS_Modular_Character_Unity_CapFix.blend`
2. 외부 백업: `C:/Users/sonmi/Documents/SIMUS_Backups/CharacterAnimations/SIMUS_Modular_Character_Unity_CapFix_BACKUP_2026-10-09_145054.blend`
3. 수정본 Blender: `C:/Project/simus/unity/Assets/SIMUS/Art/characters/modular_hairfix_v001/models/SIMUS_Modular_Character_Happiness_Animations.blend`
4. Unity FBX: `C:/Project/simus/unity/Assets/SIMUS/Art/characters/modular_hairfix_v001/models/SIMUS_Modular_Character_Happiness_Animations.fbx`
5. 백업은 C:/Project/simus 외부이며 원본과 SHA-256이 일치합니다. 작업 중 자동 생성된 .blend1도 외부 백업 폴더로 옮겼습니다.
6. 수정본 Blender와 FBX는 원본 CapFix와 정확히 같은 폴더에 있습니다.
7. 기존 HairFix와 추가한 CapFix 원본은 덮어쓰지 않았습니다. CapFix 원본·백업 해시: `014afec72a951de25d5069d7b75e484450e8e8826a0063c7c433223b416411e7`.
8. 기존 Action: Idle, Walk, Interact, Wave. 기존 키·보간·핸들은 변경하지 않았습니다.
9. 추가 Action: HAPPY_IDLE, HAPPY_WALK, HAPPY_CHEER, HAPPY_WAVE, NEUTRAL_IDLE, NEUTRAL_WALK, SAD_IDLE, SAD_WALK, SAD_SIGH. NEUTRAL_IDLE은 기존 Idle을3초로 늘린 사본, NEUTRAL_WALK는 기존 Walk의 동작을 보존한 사본입니다. 기존 Action 이름도 유지합니다. 행복/슬픔 걷기는 기존 Walk를 복제하고 보폭·접지·상체·팔 동작을 조정했습니다.
10. 반복: HAPPY_IDLE, HAPPY_WALK, NEUTRAL_IDLE, NEUTRAL_WALK, SAD_IDLE, SAD_WALK. 기존 Idle/Walk도 반복 설정입니다.
11. 한 번 재생: HAPPY_CHEER, HAPPY_WAVE, SAD_SIGH. 준비→주동작→복귀를 포함합니다.
12. In-Place: HAPPY_WALK, NEUTRAL_WALK, SAD_WALK. 루트 변환 고정. 권장 Unity 이동속도는 각각0.66 / 0.56 / 약0.286m/s입니다. 속도를 다르게 적용하면 발 미끄러짐이 생길 수 있으므로 이동 속도와 재생속도를 함께 맞추세요.
13. 발 검사: 9개 Action 전체621프레임을 평가했습니다. 대기 동작의 발 위치 오차 및 걷기 지지구간의 가상 전진 보정 오차는1마이크로미터 미만입니다. 바닥 높이 수치 오차도1마이크로미터 미만이며 눈에 띄는 침하가 없습니다. 이는 Blender 원본 동작 검사로, 게임의 다른 Avatar/지형/이동속도에서의 접지를 보장하는 결과는 아닙니다.
14. 몸·의상: 원본 메시 좌표·면·웨이트·재질·계층·22본 기준행렬은 검사 해시가 일치합니다. 새 메시·리그·웨이트 변경은 없습니다. 9개 동작의 시작/중간/절정/종료 이미지를 확인했으며 과도한 손·얼굴 겹침이나 의상 이탈은 보이지 않았습니다.
15. 긴 머리·양갈래·사이드 테일: 16개 선택 상태를 번갈아 렌더 확인했습니다. 9개 Action의8개 시점에서 모든 실제 헤어 메시와 손/아래팔 표면 교차 후보는0입니다. 기본 머리 형태와 Head 스키닝을 유지했고 새 헤어 물리는 만들지 않았습니다.
16. 모자·안경: 06/11 CapFix와02 니트, 네모/원형 안경 유지. Head 변환 추종 오차는 약0.00000013m 이내입니다. 안경/모자 분리나 새로운 네모 장식은 없습니다.
17. Unity Humanoid: 프로젝트와 같은 Unity6000.3.24f1의 독립 검증 프로젝트에서 Avatar.isValid=true, Avatar.isHuman=true, 검사 본 누락0. 자동 매핑에서 빠진 Chest를 포함한21개 Humanoid 대응 본을 명시했습니다. 원본 뼈는22개(Root 포함) 그대로입니다. 검증된 가져오기 설정을 새 FBX.meta에만 함께 제공합니다. 기존 HairFix의 설정은 변경하지 않았습니다.
18. Animation Clip: 기존4개+추가9개=13개 모두 Unity에서 개별 이름과 Human Motion으로 인식됐습니다. FBX 재불러오기 시26개 오브젝트/21개 메시/22본/16개 헤어 선택(13번은 대머리 Empty)/안경2종을 확인했습니다. 프리뷰·카메라·조명은 FBX에 없습니다. Animator Controller, 행복도 코드, AI, NavMesh, 맵 배치, 스폰 설정은 추가하지 않았습니다. 실제 프로젝트의 Play Mode 통합 검사는 수행하지 않았습니다.

## 길이와 반복

| Action | 길이 | Loop |
|---|---:|---|
| HAPPY_IDLE | 3초 | 켜짐 |
| HAPPY_WALK | 1초 | 켜짐 |
| HAPPY_CHEER | 2초 | 꺼짐 |
| HAPPY_WAVE | 2초 | 꺼짐 |
| NEUTRAL_IDLE | 3초 | 켜짐 |
| NEUTRAL_WALK | 1초 | 켜짐 |
| SAD_IDLE | 4초 | 켜짐 |
| SAD_WALK | 1.4초 | 켜짐 |
| SAD_SIGH | 3초 | 꺼짐 |

프레임은30fps,1부터 시작하고 반복용 끝 키를 포함합니다. 예: HAPPY_WALK는1–31, 실제 주기1초.

## 확인 이미지

- `C:/Project/simus/assets/library/characters/modular_hairfix_v001/previews/happiness_animations/Happiness_Pose_Comparison.jpg`
- `C:/Project/simus/assets/library/characters/modular_hairfix_v001/previews/happiness_animations/HAPPY_Motion_Sheet.jpg`
- `C:/Project/simus/assets/library/characters/modular_hairfix_v001/previews/happiness_animations/NEUTRAL_SAD_Motion_Sheet.jpg`
- `C:/Project/simus/assets/library/characters/modular_hairfix_v001/previews/happiness_animations/Hair_Accessory_Animation_Check.jpg`

Blender는 기본 헤어01/안경 없음, 중립적인 원본 기준 자세로 저장했습니다. Action Editor에서 원하는 이름을 선택해 재생하세요. 다른 헤어는 동시에 켜지 말고 한 종류만 선택합니다. FBX 안에는 모든 선택지가 포함되며 Unity에서 선택한 헤어만 활성화해야 합니다.
