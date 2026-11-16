# v003 로컬 연결의 맵·자산 기준

2026-11-16. 테스트 사용이며 전시 최종 승인은 **미승인**이다. 90초 목표·개막 필수 상황 수·외형 변화·오염 확산·웹 푸시 요구는 여기서 확정하지 않는다.

## 사용본과 실제 대조

기준 씬은 `unity/Assets/SIMUS/Scenes/city_masterplan_v003/CityMasterplan_v003_EventPlaces.unity`이다. 테스트 `map_version=city-masterplan-v003-local-v1`, `path_version=city-masterplan-v003-plaza30-v1`. 씬은 QualityPass 도시 메시와 EventPlaces 추가 메시를 결합한 저장본이다. 이벤트 소품 FBX 단독을 전체 도시로 사용하지 않는다.

| 역할 | 저장소 상대 경로 | SHA-256 (실제 파일 바이트) |
|---|---|---|
| 전체 편집 원본 | `assets/library/maps/city_masterplan_v003/source/SIMUS_City_Masterplan_v003_EventPlaces.blend` | `a0d0f125207077d0f388687ceee0482f61eac91c254fdf6435b9bc3b8acb09d5` |
| 기본 도시 교환본 | `assets/library/maps/city_masterplan_v003/exchange/SIMUS_City_Masterplan_v003_QualityPass.fbx` | `a6c48c4794b994f076b2ceb61d83dbb7840f816ceeeb3b53fbc465a8ba52d50c` |
| 추가 공간/소품 교환본 | `assets/library/maps/city_masterplan_v003/exchange/SIMUS_Event_Places_v001.fbx` | `317149cff95b97e094942c8d69ea62e22dba8f770874438bb7d9f9f57cd5bdde` |
| 연결 기준 저장 씬 | `unity/Assets/SIMUS/Scenes/city_masterplan_v003/CityMasterplan_v003_EventPlaces.unity` | `4b4e5dfbbf51b0754dd3de7435af67ef4670582994e7cf9cc10b7091123f6c27` |

Unity 교환본은 각각 `Scenes/city_masterplan_v003/models/SIMUS_City_Masterplan_v003_QualityPass.fbx`, `Scenes/city_masterplan_v003/event_places/SIMUS_Event_Places_v001.fbx`이며 canonical 교환본과 바이트 해시가 같다. 씬에서 해당 GUID 참조는 각각 5,522개와 881개다. 기존 `models/SIMUS_City_Masterplan_v003.fbx`는 이 씬의 참조가 0개다. Neighborhood 좌표·자산을 근거로 사용하지 않았다.

Blender 5.2.2 LTS에서 전체 원본을 실제 열고 교환본 두 개를 각각 새 빈 파일로 재임포트했다. 원본은 오브젝트 10,157개/메시 오브젝트 8,993개, 추가 FBX는 519개/475개, QualityPass FBX는 5,225개/4,772개다. 이 수는 Blender 데이터 블록의 오브젝트 수이며 Unity 렌더러 수나 렌더링 성능을 뜻하지 않는다. 원본·교환본·씬은 서로 다른 역할/수량이므로 총 메시 수가 같아야 한다는 가정은 하지 않는다.

초기 체크아웃에서 원본과 도시 교환본은 Git LFS 포인터뿐이었다. `git-lfs` 미설치 상태를 확인했고 공개 origin의 `develop` LFS 미디어에서 실물을 받아 **원래 포인터의 OID와 바이트 SHA-256이 일치할 때만** 복원했다. 추가 FBX canonical도 기존 Unity 실물의 OID 일치를 확인해 복원했다. 새로운 모델 제작이나 재내보내기는 하지 않았다. EventPlaces 원본의 manifest 해시는 오래된 `fbfc…` 대신 현재 추적 포인터 OID `a0d0…`로 갱신했다. 납품 상태는 `received`를 유지한다.

## 좌표계와 축 변환

서버 계약은 Unity 월드 `[x,y,z]` **미터, Y 위쪽**이다. Blender 원본은 METRIC/scale_length=1.0이며 Z 위쪽이다. 이 묶음에서 실측한 변환은 다음과 같다.

```text
Unity world = [Blender world X, Blender world Z, -Blender world Y]
```

| 표본 | 실제 Blender 원본 `[X,Y,Z]` | 실제 저장 Unity 월드 `[x,y,z]` |
|---|---|---|
| EVS_01 | `[76.800003,-40,0]` | `[76.800003,0,40]` |
| EVS_09 (지하) | `[167.399994,-98.75,-2.932000]` | `[167.399994,-2.932000,98.75]` |
| EVS_30 | `[45,-79,0.252000]` | `[45,0.252,79]` |

30개 EVS 루트 전체에서 원본→Unity 위치 최대 오차는 **0.0000178m**, 추가 FBX 재임포트→Unity는 **0.00000612m**였다. QualityPass FBX의 FULL_EVENT_30_INTERACT `[45.650002,-79,0.252013]`도 저장 씬 `[45.65,0.252004,78.999989]`와 0.00002m 이내다.

직렬화 scale은 도시 루트 `CITY_MASTERPLAN_V003=[-100,100,100]`, 추가부 루트 `SIMUS_EVENT_PLACES=[-1,1,1]`, EVS_30 로컬 `[100,100,100]`이다. FBX 단위 처리와 동서 반사 보정이 **이미 씬 계층에 반영**되어 있다. 서버 좌표에 다시 100배 또는 X 반전을 적용하면 안 된다. 로컬 Transform 값을 API에 복사하지 말고 부모 scale/rotation을 누적한 월드 Transform을 사용한다.

## 30개 배치표와 대표 선택

[30행 CSV](../content/v003-event-placement.csv)는 저장 씬의 `SIMUS_EVENT_PLACES/EVS_01`~`EVS_30` 및 `CITY_MASTERPLAN_V003/EVENT_LOCATIONS/FULL_EVENT_nn_ROOT/FULL_EVENT_nn_*`를 읽어 작성했다. 배치표 작성 완료와 상황 플레이 검증은 별도 열이다.

- `world_xyz_m`, `interaction_world_xyz_m`, START/NPC_WAIT/EXIT는 **저장 Transform 사실**이다. 마커 존재는 바닥·충돌·실제 도착 검증을 뜻하지 않는다.
- `candidate_*` 경로·반경 1.2m·Z01~Z08 지역은 기존 `docs/planning/city_masterplan_v003/events.csv`, `routes.json`의 **후보**다. 승인된 지역 경계가 없으므로 `region_code`를 비웠다. 모든 후보 경로를 서버가 즉시 실행할 수 있다는 주장은 하지 않는다.
- `runtime_*` 열은 대표30의 실제 로컬 연결 계약을 별도 표시한다. `runtime_route_status`와 팀의 Unity/브라우저 검증 기록을 함께 본다. 나머지29개는 미플레이 상태를 유지한다.
- 각 행의 `additional_runtime_work`에 실내 문/경로, 신호, 정전, 침수, 배역 NPC, 소품 상태, 애니메이션 후속을 적었다. 과거 제작자의 `path_complete=true`를 이번 작업의 실제 플레이 통과로 승격하지 않았다.

대표30을 유지한다. 광장 외부 접근이라 카페·지하철·화장실 실내 진입 로직에 의존하지 않는다. 저장 INTERACT는 `[45.65,0.252004,78.999989]`이고 상자 루트는 `[46,0.402,79]`라 몸체와 간섭할 수 있다. 로컬 경로 계약은 저장 NPC_WAIT와 같은 `[44.35,0.252,79]`, 반경0.6m를 정지·상호작용점으로 사용한다. 출발 `[44.35,0.252,65]` → 경유 `[44.35,0.252,72]` → 정지 `[44.35,0.252,79]`; 재개는 이 순서를 역으로 따른다. 이 경로의 실제 바닥/충돌/도착 판정은 Unity 담당의 검사 결과로 확정한다. 본 문서의 정적 자산 대조만으로 통과로 표시하지 않는다.

## 재현과 증거

```sh
python3 scripts/verification/v003_build_placement_table.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/verification/v003_blender_audit.py
python3 scripts/assets/catalog.py
python3 scripts/assets/catalog.py --check
```

기계 판독 근거는 [Blender 실제 로딩 결과](v003-blender-source-audit.json), [저장 씬 Transform 누적 결과](v003-scene-transforms.json)다. 표 재생성 스크립트는 저장 씬을 수정하지 않는다. 첫 catalog 실행은 관련 없는 기존 LFS 포인터 3건의 실물 부재로 해시 검사가 실패했고, 이를 원래 OID대로 복구한 후 최종 catalog 생성/check는 통합 담당이 실행한다. 모바일 목표 기기 성능·30개 개별 플레이·전시 승인·지역 오염 경계는 이 자산 대조 범위의 완료 항목이 아니다.
