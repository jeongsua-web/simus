# 도시 리빌드 v002 — Phase 1~3 Blender/FBX 재사용 검증

도시 배치는 승인된 `docs/planning/city_rebuild_v002/layout.json`을 기준으로 Unity에서 조립한다. 이번 Blender 담당 작업은 필요한 교환본을 판별하고 실제 FBX를 읽어 치수·메시 구성·축·원점을 확인했다. 기존 `.blend`, `.fbx`, `.meta`를 수정하거나 재내보내지 않았다. 신규 Blender 원본·FBX는 필요하지 않았다. v001 격자나 기존 시제품 좌표를 사용하지 않았다.

## 실행 및 증거

- Blender 5.2.2 LTS background로 **14개 FBX**(캠퍼스 1종, 외부 건물 13종)를 실제 읽었다. `read_factory_settings` / `import_scene.fbx` / world AABB 측정만 수행했고 save/export 연산은 없다.
- sandbox 첫 실행은 Blender 시작 시 **exit 139**. 승인된 sandbox 밖 재실행은 **exit 0**으로 완료했다. 로그는 `/tmp/simus_v002_fbx_audit.log`, 실행 스크립트는 `/tmp/simus_v002_fbx_audit.py`다.
- 지속 증거: [FBX 감사 JSON](city-rebuild-v002-blender-fbx-audit.json), [캠퍼스 원본→FBX→Unity 이름 및 축 증거](city-rebuild-v002-campus-fbx-map.json), [55동 문앞 실측 비교 CSV](city-rebuild-v002-external-entry-evidence.csv).
- 14개 FBX 모두 읽기 전후 SHA-256 동일. 대응 `.blend` 14개 및 FBX 14개 모두 v002 QA protected baseline과 일치한다. 외부 모델 13종은 승인 측정 입력의 source/FBX SHA-256와도 동일하다.
- 원본 재측정은 불필요하게 반복하지 않고 기존 Blender 조사와 `/tmp/simus_asset_audit.json`의 object world AABB를 재사용했다. 현재 FBX 직접 가져오기와 별도로 구분한다.

## 외부 건물 55개용 FBX

| 실제 교환본 | FBX mesh 수 | 가로×깊이×높이 m (Blender X×Y×Z) |
|---|---:|---|
| APARTMENT_A_MIDRISE.fbx | 1 | 14.940×34.180×43.480 |
| APARTMENT_B_MIDRISE.fbx | 1 | 22.180×22.890×49.600 |
| APARTMENT_C_MIDRISE.fbx | 1 | 20.180×30.090×37.600 |
| COMMERCIAL_01_OLD_MULTI_TENANT.fbx | 1 | 12.600×17.100×16.488 |
| COMMERCIAL_02_NEIGHBORHOOD_CENTER.fbx | 1 | 20.250×19.800×13.383 |
| COMMERCIAL_03_MODERN_CORNER.fbx | 1 | 14.400×18.000×13.878 |
| DEPARTMENT.fbx | 1 | 24.410×18.800×13.740 |
| HOUSE_01_URBAN_MODERN.fbx | 1 | 11.450×15.400×9.755 |
| HOUSE_02_OLD_BRICK.fbx | 1 | 13.750×15.590×7.571 |
| HOUSE_03_NARROW_HOUSE.fbx | 1 | 11.450×13.084×9.605 |
| VILLA_01_PILOTI_BRICK.fbx | 1 | 20.473×16.788×17.291 |
| VILLA_02_STONE_MODERN.fbx | 1 | 21.413×18.668×14.528 |
| VILLA_03_CORNER_MIXED.fbx | 1 | 18.546×19.420×11.896 |

全 13종 FBX는 원점 중심 footprint, 최저 Z≈0으로 읽혔다. 승인 원본 실측 치수와 FBX 가져오기 치수의 최대 차이는 **0.000796m**다. 소수점 반올림 수준이며 별도 원점/축 수정 export가 필요하지 않다. 실제 Unity 좌표 축은 Unity import 검사와 연결해 사용해야 한다. 이 검사는 Unity 재질 표시, 플레이, 문턱 통행 또는 GPU 성능을 인증하지 않는다.

## 캠퍼스 14동 — 기존 487개 메시에서 Unity 재조립

`unity/Assets/SIMUS/Art/buildings/campus/Campus.fbx`는 실제 독립 메시 **487개**다. 원본 전체 범위는 약 **156.24×212.19m**, Z=-2.796~19.224m다. `layout.campus.components[].split_objects`의 14동 구성 **308개**와 공유 **179개**로 구분할 수 있어 새 건물별 FBX를 만들 필요가 없다.

캠퍼스는 오브젝트별 원점·scale이 혼재한다. 모든 부품의 **기존 world geometry를 유지**한 채 부모 wrapper로 묶는다. envelope 중심 `x,z`를 root anchor라고 가정하지 않는다. `placement_origin`과 `delta_from_original`은 승인 JSON의 값을 따른다.

원본 메시와 FBX 가져온 메시를 world AABB 여섯 좌표로 1:1 대조했다. **487개 전부 대응, 중복 대응 0, 최대 좌표 차이 0.000499m**다. 독립 FBX 이름은 `PACKAGE_D03_UNITY_`로 시작하고 한글/기호가 이미 sanitize/hash된 이름이다. Blender 가져오기는 긴 `WINDOW_FRAMES` 이름 **14개**를 길이 제한에 따라 추가 hash 이름으로 바꾼다. 이 때문에 Blender 표시 이름을 그대로 Unity에서 찾으면 실패한다.

FBX binary 7400의 Model 문자열을 직접 읽어 **실제 FBX 이름 487개**를 확보했다. map의 `name_map`은 raw FBX/Unity 이름, `blender_import_name_map`은 Blender 표시 이름이다. Unity 담당의 [실제 importer probe](city-rebuild-v002-campus-unity-import.json)와 비교한 결과 **487개 renderer 이름 전부 일치, 누락 0**이다.

Unity importer 실측의 좌표는 다음과 같다.

```text
Unity (X,Y,Z) = (-Blender.X, Blender.Z, -Blender.Y)
검증 대상: 487개 renderer bounds
최대 좌표 차이: 0.000019m

캠퍼스 adapter: Unity Y yaw 180°, 위치 (0,-0.18,65)
건물 delta: 위 adapter로 복원한 city world frame에서 승인 delta X,Z 적용
```

adapter 결과는 승인 설계 계약 `(B.X, B.Z-0.18, B.Y+65)`에 맞는다. 공유 기단/Campus surface와 운동장·농구장·테니스장·경계선·골대·녹지는 `shared_retention_candidates` 29개에 기록했다. 기존 Walk/Road/Crosswalk/Parking과 tree 104개는 별도 목록으로 구분했다. 기존 학내 도로/보도를 새 v002 도로 위에 다시 얹지 않는다. 식생 후속 구현은 Phase 4에서 진행한다.

## 출입구 방향·접근성 한계

`buildings.csv`의 외부 문앞점은 **local −Z provisional proxy**였으며 실제 FBX 출입구가 검증됐다는 뜻이 아니다. 기존 원본 entry glass, handle, ramp 또는 accessible-entry 메시 AABB를 조사하면 다음 **39동**은 이 방향 가정과 충돌 가능성이 있다.

| 건물 ID | 모델 | 원본 실측에서 추론한 local 방향 |
|---|---|---|
| B23,B27,B29,B35,B41,B47,B53 | HOUSE_01 | +Z: ramp가 +Blender.Y에 위치 |
| B24,B28,B31,B37,B43,B49,B55 | HOUSE_02 | +Z: ramp가 +Blender.Y에 위치 |
| B25,B33,B39,B45,B51 | HOUSE_03 | +Z: ramp가 +Blender.Y에 위치 |
| B19,B22,B30,B36,B42,B48,B54 | VILLA_01 | +X: accessible-entry 위치 |
| B20,B34,B40,B46,B52 | VILLA_02 | +X: accessible-entry 위치 |
| B21,B26,B32,B38,B44,B50 | VILLA_03 | +X/−Z 모서리: accessible-entry 위치 |
| B15,B18 | APARTMENT_A | +X: X 방향 두께가 얇은 entry-glass plane |

상가 3종, 백화점, APARTMENT_B/C는 −Blender.Y 쪽 entry evidence를 확인했다. 그러나 같은 방향이어도 계획된 footprint 중앙 접근점과 실제 recessed glass/handle/ramp 위치는 다르다. 55개 전부의 설계 임시점과 geometry candidate projection을 CSV에 남겼다. CSV의 projected 좌표는 **승인 설계 축 변환과 yaw를 적용한 계산**이며 실제 Unity 문 위치 검증이나 NPC 경로 확정이 아니다. ramp 위치는 문 중심이나 outward normal을 확정하지 못한다.

이번 Phase 3에서는 **승인 배치/회전과 원본을 유지**하고 방향 증거만 기록했다. 출입문까지 실제 NPC 이동, 문턱/계단 통행, NavMesh 접합은 NOT TESTED이며 Phase 5에서 graph 접근점을 실제 모델에 연결할 때 확인해야 한다. 원본이 통과할 수 있는 실내 건물이라고 주장하지 않는다.

## 담당 검증 상태

| 항목 | 상태 | 근거 |
|---|---|---|
| Blender에서 실제 FBX 14개 읽기 | PASS | exit 0, 감사 JSON |
| 캠퍼스 14동의 308개 부품 분리 가능 | PASS | 487개 원본/FBX 1:1 매핑 |
| 외부 13종 실제 크기/ground bounds | PASS | 원본 실측 대비 ≤0.000796m |
| 원본 blend/FBX 보호 | PASS | 14쌍 QA baseline SHA-256 일치 |
| 실제 Unity 캠퍼스 importer 이름·bounds | PASS | Unity probe 487개 비교 |
| 출입구 위치/방향 증거 수집 | PASS | 55동 CSV, 39동 proxy 방향 충돌 후보 명시 |
| 출입문까지 NPC 통행/계단/램프/NavMesh | NOT TESTED | 사용자 범위는 Phase 3까지 |
| Unity 씬 배치·충돌·재질/Play | 별도 Unity/QA 보고 | Blender import를 Unity 씬 실행 PASS로 대체하지 않음 |
| 전시 승인/LOD/GPU/NPC 성능 | NOT TESTED | 이번 FBX 재사용 검사의 범위 밖 |

에셋 파일 추가·변경이 없으므로 manifest 키/납품 상태를 바꾸지 않았다. 목록 재생성·검사는 메인 에이전트가 최종 Unity 산출물까지 포함해서 실행한다.
