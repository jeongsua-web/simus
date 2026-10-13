# 맵 리빌드 Blender 에셋 조사 — 2026-10-13

도시 조립·도로·구역 배치의 기준은 Unity다. 이번 Blender 작업은 기존 자산을 읽어 개별 재사용 가능성과 크기를 확인한 조사이며 원본·교환본·Unity 메타를 수정하지 않았다. Neighborhood는 조사 대상 및 새 배치 근거에서 제외했다. 전시 map_version, 상황 좌표, 최종 NPC 경로와 구역 경계는 확정하지 않았다.

## 확인 방법과 범위

루트 AGENTS.md, CLAUDE.md, `.codex/agents/blender.toml`, `assets/ASSET_RULES.md`, catalog README 및 manifest를 읽었다. Blender 5.2.2 LTS의 background 모드로 건물·도로·대학 맵·캐릭터 원본 23개를 열고 mesh object의 world bounding box, parent, origin, 단위 설정을 측정했다. 모든 대상의 원본 단위는 METRIC / scale_length 1.0이다. 별도로 FBX 5개를 실제 가져와 확인했다. 파일 저장이나 재내보내기는 수행하지 않았다.

첫 sandbox 실행은 시작 시 exit 139로 종료되었다. 승인된 sandbox 밖 실행은 원본 검사와 FBX 검사 모두 exit 0으로 완료했다. 임시 검사 스크립트/세부 결과는 `/tmp/simus_asset_audit.py`, `/tmp/simus_asset_audit.json`, `/tmp/simus_fbx_audit.py`, `/tmp/simus_fbx_audit.json`에 있다. 아래 표는 세부 결과의 핵심 측정치를 보존한다.

Blender 수치는 X×Y 평면·Z 높이 기준이다. Unity에서는 FBX 축 변환 후 X×Z 평면·Y 높이로 확인해야 한다. 원본 bound는 비활성 데이터·프리뷰를 포함할 수 있으므로 FBX 검사와 구분한다.

## 개별 자산의 분리 및 크기

아래 경로의 기준 폴더는 `unity/Assets/SIMUS/Art/`다. 치수는 m, 반올림 값이다.

| 원본 상대 경로 | 원본 mesh 수 | 가로×깊이×높이 | 판단 |
|---|---:|---|---|
| buildings/commercial/COMMERCIAL_01_OLD_MULTI_TENANT.blend | 583 | 12.60×17.10×16.49 | 개별 건물, FBX는 한 root mesh; 같은 치수 확인 |
| buildings/commercial/COMMERCIAL_02_NEIGHBORHOOD_CENTER.blend | 526 | 20.25×19.80×13.38 | 개별 건물 후보 |
| buildings/commercial/COMMERCIAL_03_MODERN_CORNER.blend | 569 | 14.40×18.00×13.88 | 개별 건물 후보 |
| buildings/houses/HOUSE_01_URBAN_MODERN.blend | 90 | 11.45×15.40×9.76 | 개별 건물, FBX 한 root mesh; 같은 치수 확인 |
| buildings/houses/HOUSE_02_OLD_BRICK.blend | 91 | 13.75×15.59×7.57 | 개별 건물 후보 |
| buildings/houses/HOUSE_03_NARROW_HOUSE.blend | 93 | 11.45×13.08×9.61 | 개별 건물 후보 |
| buildings/apartments/APARTMENT_A_MIDRISE.blend | 837 | 14.94×34.18×43.48 | 개별 건물 후보 |
| buildings/apartments/APARTMENT_B_MIDRISE.blend | 855 | 22.18×22.89×49.60 | 개별 건물 후보 |
| buildings/apartments/APARTMENT_C_MIDRISE.blend | 485 | 20.18×30.09×37.60 | 개별 건물 후보 |
| buildings/department_store/DEPARTMENT.blend | 313 | 24.41×18.80×13.74 | 개별 건물 후보 |
| buildings/campus/Campus.blend | 487 | 156.24×212.19×22.02 | 학교 전체 묶음, 개별 학교 건물 아님 |
| roads/city_infrastructure/City_Infrastructure.blend | 450 | 386.25×317.25×0.50 | 기존 도시 도로망 묶음, 개별 반복 타일 아님 |

상가·주택·아파트 개별 원본은 footprint가 원점 중심이고 최저 Z가 0이다. 확인한 상가01·주택01 FBX도 같은 ground-centered 범위로 가져와져 초안 크기 기준으로 바로 사용할 수 있다. 모든 개별 FBX를 검사한 것은 아니다.

Campus는 바닥·보행면·건물 몸체·지붕·창문 등이 별도 mesh이나 487개 모두 직접 parent가 없다. `Campus plinth`와 `Campus surface`는 약 156.24×212.16m이고, 건물 기단도 14개가 섞여 있다. 개별 학교 건물로 재배치하려면 해당 몸체·지붕·창문·기단을 묶고 지면 중심 원점을 지정한 별도 자산을 만드는 후속 작업이 필요하다. 현 단계의 학교 부지는 Unity 보행로 초안으로 구성하고 Campus 전체를 억지로 축소하지 않는 편이 적절하다.

두 `apartment_complex*` 원본에는 2,000×2,000m 크기의 장면 요소가 포함되어 전체 bounds가 건물 크기를 나타내지 않는다. 현재 단계는 `apartments/APARTMENT_*` 개별 파일을 우선한다.

## 도로·지형과 기존 맵

`maps/university_v003/SIMUS_Dense_Realistic_University_Map_03.blend`에는 24,141개 mesh가 있으며 과거 root/LOD/미리보기 등 여러 데이터가 함께 있다. 전체 원본 bounds를 새 맵 크기로 사용하면 안 된다. 실제 같은 이름의 FBX는 1,385개 mesh, root `D03_EXPORT_ROOT`, 약 392×330m footprint이다. 단일 결합 메시가 아니며 다음 group이 분리되어 있다.

| FBX parent group | mesh 수 |
|---|---:|
| D03_UNITY_GROUP_CAMPUS | 487 |
| D03_UNITY_GROUP_SIDEWALKS | 310 |
| D03_UNITY_GROUP_COLLIDERS | 177 |
| D03_UNITY_GROUP_PARKING | 113 |
| D03_UNITY_GROUP_MAIN_ROADS | 2 |
| D03_UNITY_GROUP_SECONDARY_ROADS | 11 |
| D03_UNITY_GROUP_LOCAL_STREETS | 5 |
| D03_UNITY_GROUP_SERVICE_ALLEYS | 5 |
| D03_UNITY_GROUP_PEDESTRIAN_ALLEYS | 4 |

지면은 Campus의 plinth/surface 및 여러 기반 mesh 형태로 분리되어 있다. 이 조사는 Blender/FBX mesh 구조를 확인한 것으로 Unity Terrain 컴포넌트 여부는 Unity 조사에 따른다. 기존 맵은 비활성 참조로 보존하고 Unity에서 새 도로 초안을 생성하면 과거 group 좌표를 계승하지 않을 수 있다.

`assets/library/roads/road_straight/` 원본에는 `SIMUS_Road_Straight_10m_ROOT` 아래 12개 mesh와 별도 `Studio floor`가 있다. 실제 FBX 가져오기는 ROOT 아래 12개만 포함하여 스튜디오 바닥이 제외됨을 확인했다. 타일은 전체 7.5×10m, 차도 5.5m, 양쪽 보도 기초 각각 0.82m, 표면 고도 0~0.17m다. 교차로 원본은 15×15m 요소 7개와 별도 스튜디오 바닥, 모퉁이/주차장 원본에도 스튜디오 바닥이 있다. 재내보내기 시 ROOT 선택 내보내기를 지켜야 한다.

NPC 비교를 위해 `characters/modular_hairfix_v001/models/SIMUS_Modular_Character_Happiness_Animations.fbx`를 직접 가져왔다. `SIMUS_CHARACTER_ROOT`, ARMATURE 아래 21개 mesh, 전체 높이 1.6926m, 발바닥 Z=0이다. 원본 전체 bounds는 여러 프리뷰 캐릭터를 포함하므로 NPC 키로 쓰면 안 된다.

## Unity 초안에 전달한 기준 및 후속 수정

- 상가01·주택01은 현재 FBX를 unit scale 기준으로 재사용할 수 있다. 이번 초안은 전체 건물 재배치를 하지 않고 일부만 크기 비교용으로 사용한다.
- 1.69m NPC에 비해 기존 0.82m 보도는 협소하다. 초안 제안은 차도 약 7m, 양쪽 보도 각 2.5~3m이며 최종 규격이나 승인 수치가 아니다. Unity 실측과 카메라 검증으로 조정한다.
- 학교 내부는 보행로 중심으로 작성하고 각 건물 배치 예정지와 보도 사이 출입 연결 여유를 남긴다. 개별 학교 건물 분리·원점 정리는 해당 건물을 실제 배치하는 다음 단계에 진행한다.
- City_Infrastructure 전체를 새 도로망으로 가져오거나 맵 원본을 통째로 수정할 필요가 없다. Unity 생성 원본이 도시 배치의 기준이어야 한다.
- 장식·LOD 통합·모든 건물 출입구 수정은 이번 단계 범위 밖이다. 현재 재사용에 필요한 확정적 오류가 없어 Blender 자산은 변경하지 않았다.

## 미확인 및 기존 검증 문제

개별 FBX 전체의 재질·충돌체·LOD 성능, 모든 건물의 실제 출입문 방향/보행 접근성, 최종 기기 성능, 라이선스 및 전시 채택은 확인하지 않았다. 파일 존재·공급자 보고서를 승인으로 취급하지 않았다.

루트 담당자의 작업 전 catalog 검사에서 역할 NPC 3개의 source 경로 누락, Happiness_Animations.blend manifest 해시 불일치, inventory 오래됨이 보고됐다. 조사 중 해당 원본이나 manifest를 변경하지 않았다. 동시 편집 충돌 방지를 위해 catalog 재생성·최종 검사는 루트 담당자가 모아 실행한다.
