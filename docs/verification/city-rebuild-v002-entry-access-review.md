# v002 실제 출입문 접근 독립 검토

기준일: 2026-10-16. 기존 문서·CSV·Unity importer 결과와 현재 생성 코드만 읽었다. 이 검토에서는 Unity/Blender를 실행하지 않았고 씬, 원본, FBX, C#를 변경하지 않았다.

현재 증거로 **외부 55동과 캠퍼스 14동의 실제 통행 가능한 portal 확정은 0/69동**이다. 외부 55동은 geometry candidate의 설계 투영 좌표가 있으며, 캠퍼스 14동은 실제 명명된 ENTRY_GLASS 중심을 importer bounds로 재구성할 수 있다. 이 좌표는 NPC 발 위치 또는 통행 가능한 문턱 좌표가 아니다. 실제 문앞 접근성과 NavMesh 접합은 NOT TESTED다.

## 근거와 의미

- [외부 출입구 증거 CSV](city-rebuild-v002-external-entry-evidence.csv): 55행. 원본 문손잡이·유리·램프/접근성 패드 AABB 기반 후보. 원문 status 자체가 actual doorway/outward normal/walkability NOT TESTED임을 명시한다.
- [캠퍼스 매핑](city-rebuild-v002-campus-fbx-map.json), [Unity importer](city-rebuild-v002-campus-unity-import.json): 487개 renderer의 실제 이름과 bounds가 대응한다. ENTRY_GLASS 및 ENTRY_STEP도 실제 FBX 구성품이다.
- [기존 측정](../planning/city_rebuild_v002/asset_measurements.json), [승인 layout](../planning/city_rebuild_v002/layout.json): 캠퍼스 glass 중심과 step AABB, 건물별 이동 delta와 외부 approach anchor를 구별한다.
- [Blender 검토](city-rebuild-v002-blender.md): 외부 39동의 provisional local −Z 가정과 기존 원본 출입 증거의 방향 불일치 후보를 명시한다.
- `unity/Assets/Editor/CityRebuildV002Setup.cs`의 `PlaceCampus`는 모델 축 보정 후 구성 부품에 건물 delta를 적용한다. `PlaceExternal`은 importer bounds 중심/최저 높이를 보정하고 승인 yaw를 적용한다. 외부 원본 world coordinate를 그대로 Unity world coordinate로 취급하면 안 된다.
- `unity/Assets/Editor/CityRebuildV002NavigationSetup.cs`는 승인 그래프를 복사하며 B04_ACCESS/B16_ACCESS를 테스트 목적지로 쓴다. 실제 문까지 연결하는 추가 connector는 생성하지 않는다. 캠퍼스 Cxx_ACCESS도 문 유리 중심이 아니라 바깥 approach anchor다.

## 외부 55동

방향 불일치 후보 39동 = ramp/accessibility pad 37동 + APARTMENT_A glass 2동이다. 나머지 16동의 방향이 기존 가정과 일치한다고 해서 문 위치·문턱이 검증된 것은 아니다. 손잡이 중심은 문의 좌우 중심과 다르고 램프 중심은 문 위치를 확정하지 못한다.

아래 차이는 CSV의 planned_entrance와 projected geometry candidate 사이의 XZ 직선 거리다. 검증된 connector 길이나 NPC 이동 거리가 아니다.

| 모델 | 동 수 | 증거 종류 | 방향 불일치 후보 | 후보점 차이 m |
|---|---:|---|---|---:|
| APARTMENT_A_MIDRISE | 2 | glass | 예 | 17.783 |
| APARTMENT_B_MIDRISE | 1 | glass | 아니오 | 6.160 |
| APARTMENT_C_MIDRISE | 1 | glass | 아니오 | 6.834 |
| COMMERCIAL_01_OLD_MULTI_TENANT | 5 | door-pull | 아니오 | 3.202 |
| COMMERCIAL_02_NEIGHBORHOOD_CENTER | 3 | door-pull | 아니오 | 8.324 |
| COMMERCIAL_03_MODERN_CORNER | 5 | door-pull | 아니오 | 5.368 |
| DEPARTMENT | 1 | handle | 아니오 | 2.868 |
| HOUSE_01_URBAN_MODERN | 7 | ramp/accessibility pad | 예 | 11.842 |
| HOUSE_02_OLD_BRICK | 7 | ramp/accessibility pad | 예 | 11.246 |
| HOUSE_03_NARROW_HOUSE | 5 | ramp/accessibility pad | 예 | 10.894 |
| VILLA_01_PILOTI_BRICK | 7 | ramp/accessibility pad | 예 | 13.662 |
| VILLA_02_STONE_MODERN | 5 | ramp/accessibility pad | 예 | 12.123 |
| VILLA_03_CORNER_MIXED | 6 | ramp/accessibility pad | 예 | 9.080 |

39동에 대해 CSV 좌표로 곧바로 기존 anchor에서 직선 connector를 만들면 건물 몸체 또는 계단을 통과할 수 있다. 공통 normal을 임의로 적용하거나 건물 회전/새 문을 만들어 충돌을 숨겨서는 안 된다. 특히 외부 FBX는 모델당 단일 mesh로 합쳐져 있어 캠퍼스와 달리 Unity renderer 이름으로 개별 유리/문틀을 선택할 수 없다. 기존 원본의 문 유리·문틀·계단·램프 정점과 실제 triangle 경계/normal을 추가로 조사하거나 실제 Unity geometry를 읽어야 한다.

## 캠퍼스 14동

모든 건물에서 실제 유리 중심을 재구성할 수 있다. 아래 좌표는 importer bounds의 centre를 `(-X,Y−0.18,−Z+65)`로 변환하고 각 건물 `delta_from_original` XZ를 더한 값이다. 이는 원본 측정 유리 중심 + 승인 delta와 반올림 오차 범위에서 일치한다. 유리 중심 Y≈1.414m는 NPC 발 높이로 사용하면 안 된다.

| 건물 | 실제 유리 중심 X,Y,Z m | 그래프 approach X,Z m | XZ 간격 m |
|---|---|---|---:|
| C00 서관 | -21.068, 1.414, 156.808 | -21.069, 153.435 | 3.373 |
| C01 서측동 | -70.027, 1.414, 137.548 | -70.027, 134.208 | 3.340 |
| C02 실습관 | -63.239, 1.414, 114.828 | -63.239, 111.635 | 3.193 |
| C03 동관 | 11.633, 1.414, 136.048 | 11.633, 132.618 | 3.430 |
| C04 중앙동 A | -41.169, 1.414, 70.528 | -41.169, 67.139 | 3.389 |
| C05 중앙동 B | -26.588, 1.414, 66.148 | -26.588, 62.776 | 3.372 |
| C06 중앙동 C | -11.828, 1.414, 67.468 | -11.828, 64.109 | 3.359 |
| C07 국제관 | 35.521, 1.414, 57.448 | 35.522, 54.239 | 3.209 |
| C08 산학협력관 | 47.919, 1.414, 17.571 | 47.919, 13.934 | 3.637 |
| C09 창업관 | 81.000, 1.414, -2.612 | 81.000, -5.782 | 3.170 |
| C10 남관 | 43.682, 1.414, -1.532 | 43.682, -4.754 | 3.222 |
| C11 체육관 | -42.420, 1.414, -36.752 | -42.419, -39.935 | 3.183 |
| C12 학생시설 | -21.960, 1.414, -30.332 | -21.960, -33.502 | 3.170 |
| C13 지원시설 | 46.560, 1.414, -17.732 | 46.560, -20.902 | 3.170 |

기존 step bounds는 14동 모두 south/−Z 후보 방향을 지지한다. 원본 step 높이 범위 0.18–0.444m는 adapter 후 0–0.264m다. 현재 그래프 높이 0.16m를 그대로 유리까지 연장하면 이 계단의 최종 지지 높이와 일치하지 않을 수 있다. 공통 AABB와 유리 centre만으로 step별 보행면, 문 하단, 외부 normal, capsule clearance를 확정할 수 없다.

## 추가 Unity connector 구현 가능성

캠퍼스는 14동 모두 실제 이름으로 유리/문틀/계단 renderer 및 MeshCollider를 찾을 수 있어 단계적 구현의 가장 좋은 대상이다. 현재 evidence로 다음 검증을 준비할 수 있으나 실행 PASS는 부여하지 않았다.

1. 씬의 Cxx wrapper 아래 ENTRY_GLASS_i, DOOR_FRAME_i_j, ENTRY_STEP_i_j를 찾아 실제 변환된 정점·삼각형과 bounds를 읽는다. importer 가정만 재사용하지 말고 씬 transform을 확인한다.
2. 계단의 바깥 경계에서 문 앞 착지면까지 높이가 연속되는 exterior approach를 찾는다. 유리 centre를 발 위치로 쓰지 않고 계단 top raycast로 실제 support height를 구한다.
3. 기존 Cxx_ACCESS에서 연결할 경로의 전 구간을 기존 runtime capsule radius와 grounding 허용 오차로 검사한다. 건물/장식 관통, support 누락, 급단차가 있으면 FAIL을 남긴다. glass 자체를 관통해 실내로 들어가게 만들지 않는다.
4. 외부 55동은 먼저 모델별 portal geometry와 outward normal을 별도 확정한다. 13종 모델의 원본 geometry 확보 후 배치 wrapper transform으로 55동에 적용할 수 있다. 37개 ramp centre를 문 centre로 채택하지 않는다.
5. 승인 layout의 388/409 원본 그래프는 보존하고, 확인된 connector는 씬의 별도 extension 및 검증 데이터로 관리한다. door 진입·충돌 PASS와 NavMesh bake/connectivity PASS는 별개로 기록한다.

기존 MoveTowards adapter를 유지한 외부 문앞 이동 검증은 가능하다. NavMesh 검증은 현재 모듈/패키지·bake가 없어 별도 필요하다. 새 connector를 구현하지 않은 현재 상태를 door access PASS로 표시할 근거는 없다.

## 상태

| 항목 | 상태 |
|---|---|
| 기존 외부 candidate 55행 및 39개 방향 충돌 분류 | PASS (정적 증거 대조) |
| 캠퍼스 14개 실제 ENTRY_GLASS 중심 재구성 | PASS (기존 Unity importer bounds 재계산) |
| 기존 graph anchor와 실제 portal 구별 | PASS |
| 실제 portal/문턱/normal/clearance 확정 | NOT TESTED (0/69동 확정) |
| 실제 출입문까지 NPC 이동 | NOT TESTED |
| 실내 진입 및 문 개폐 | NOT TESTED |
| NavMesh 문 연결 | NOT TESTED |

이 문서만 추가했다. 원본 에셋, 카탈로그, 씬, 빌드 설정 및 코드 변경은 없다. 따라서 에셋 카탈로그 재생성은 이 검토의 변경 범위에 해당하지 않으며 메인 통합 검증에서 실행한다.
