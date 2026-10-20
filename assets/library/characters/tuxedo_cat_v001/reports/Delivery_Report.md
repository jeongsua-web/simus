# SIM:US 턱시도 고양이 v001

2026-10-19 · received · 기존 맵 미배치

## 파일
- Blender 원본: `assets/library/characters/tuxedo_cat_v001/source/SIMUS_Cat_Tuxedo.blend`
- Unity FBX: `unity/Assets/SIMUS/Art/characters/tuxedo_cat_v001/models/SIMUS_Cat_Tuxedo.fbx`
- 프리팹: `unity/Assets/SIMUS/Prefabs/characters/tuxedo_cat_v001/SIMUS_Cat_Tuxedo.prefab`
- 독립 클립·컨트롤러: `unity/Assets/SIMUS/Art/characters/tuxedo_cat_v001/animations/`
- 재질·텍스처: 같은 Art 묶음의 `materials/`, `textures/`.
- 프로젝트 규칙을 우선하여 animals 대신 characters, 프리팹은 별도 Prefabs 경로에 저장했다.

## 외형과 규격
사진에서 검정 등·양옆·귀, 흰 주둥이·가슴·발끝, 녹색 눈, 분홍 코와 앉은 자세를 참고했다. 사진 픽셀·워터마크·배경은 사용하지 않았다. 독립적으로 모델링한 실시간용 단순화 모델이며 사진 수준의 털을 재현한 스캔 모델은 아니다.

- 전체 외곽: 폭 약 0.219m, 귀 끝 높이 약 0.402m, 꼬리 포함 길이 약 0.863m.
- 몸통 약 0.46m, 머리~엉덩이 약 0.62m, 어깨 높이 약 0.30m. 꼬리는 약 0.35m.
- 기존 성인 NPC 1.645m와 실측 비교 렌더. 벤치 길이 1.8m, 일반 자동차 길이 3.7m도 원본에서 확인.
- 에셋 오브젝트 17개, 스킨 메시 11개, 삼각형 18,464개, 리그 뼈 35개. 꼬리 8개 구간 + 끝 보조 뼈 1개.
- 재질 6개. 털 BaseColor/Normal/Roughness/MetallicSmoothness 1024², 홍채 BaseColor 256².
- LOD0만 제공. 대량 배치 및 목표 기기 성능 검증은 미실행.

## 애니메이션 — 30fps
| 클립 | 길이 | 루프 |
|---|---:|---|
| CAT_IDLE_STAND | 5초 | 예 |
| CAT_WALK | 1.2초 | 예 |
| CAT_SIT_DOWN | 2초 | 아니오 |
| CAT_SIT_IDLE | 5초 | 예 |
| CAT_STAND_UP | 2초 | 아니오 |

걷기는 in-place이며 권장 이동 속도는 약 0.128m/s다. 보행의 지지 구간에서 발의 후방 속도에 맞춰 고양이를 앞으로 이동시켜야 지면 미끄러짐이 줄어든다. 실제 맵의 경사면·NavMesh·다른 이동 속도에 대한 발 IK는 포함하지 않는다.

`Speed`가 0.05보다 크면 Walk, 작으면 StandIdle. `Sitting=true`로 SitDown→SitIdle, false로 StandUp→StandIdle. 기존 게임 코드나 컨트롤러를 수정하지 않았다. 프리팹 루트는 기준 좌표이고 CAT_MODEL 하위의 FBX 축 보정은 유지해야 한다. 임의로 이 자식의 회전을 0으로 초기화하지 않는다.

## 실제 검수 범위
- Blender 파일 재열기: 리그, 5개 Action, 포함된 이미지 유지; 누락 텍스처 0.
- 최적화 메시에서 모든 애니메이션 프레임의 몸체·꼬리 최저 높이 검사. 반복 클립의 첫/마지막 뼈 행렬 차이 0.
- Unity 6000.3.24f1 별도 임시 프로젝트에서 Generic Avatar와 5개 클립 실제 가져오기, 11개 SkinnedMeshRenderer 확인.
- Unity에서 각 클립 31시점 BakeMesh로 크기와 지면 확인. 걷기의 프레임 사이 보간에서 최대 약 0.4mm의 지면 오차가 남아 있다. 이는 보고서에 기록한 허용오차 1mm 이내이며 수학적인 완전 무관통을 의미하지 않는다.
- Animator.Update로 Walk→SitDown→SitIdle→StandUp→StandIdle 전환 검증. Unity +Z 전방 확인, Root Motion 0.
- 머리 UI 앵커는 Head 본을 따라가며, 상호작용·지면 앵커와 몸통 Capsule Collider를 제공한다.
- 정면/양측/후면/위쪽/얼굴/꼬리/발/성인 비교/앉은 자세를 시각 확인했다. 앉은 배·허벅지는 제한된 토폴로지로 인한 접힘이 있어 근접 촬영 시 추가 미세 조정 여지가 있다. 삼각형 단위 전체 자기 교차 증명은 수행하지 않았다.
- 걷기·앉기 GIF와 5개 동작 모두의 시작/중간/끝 이미지를 제공한다. 일부 Blender 상세 렌더는 폴리곤 경량화 직전 외관이며, 최종 Unity 렌더와 FinalLighting 이미지는 최종 메시다.
- 기존 맵 통합, 실제 이동 코드와 연동, 게임 Play Mode·목표 기기 성능·NavMesh/경사면 시험은 미실행.

## 보존 및 승인
새 에셋 묶음과 목록 등록만 추가한다. 기존 모델·맵·NPC·게임 코드는 수정하지 않는다. 백업과 제작 중간 파일은 프로젝트 외부 작업 폴더에 보관했다. status는 received이며 타깃 기기 승인이나 전시 채택을 뜻하지 않는다.
