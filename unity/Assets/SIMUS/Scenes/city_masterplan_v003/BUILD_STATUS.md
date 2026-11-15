# SIM:US 도시 마스터플랜 v003 작업본

- Blender 원본: `source/SIMUS_City_Masterplan_v003.blend`
- 교환본: `exchange/SIMUS_City_Masterplan_v003.fbx`
- Unity 작업 씬: `unity/Assets/SIMUS/Scenes/city_masterplan_v003/CityMasterplan_v003.unity` (프로젝트 루트 기준)
- 전체 이미지: `previews/Full_Environment_03.png`
- 근접 이미지: `previews/Campus_Review_01.png`, `previews/Cafe_Entry_Review_02.png`, `previews/Subway_Entry_Review_02.png`

## 현재 반영 내용
90개 건물, 기존 시설 10개, 나무 296그루, 차선 386개, 운동장·광장·버스 쉼터, 카페·식당·화장실·지하철 내부 공간, 기본 비활성 도시 스탯 슬롯 56개를 구성했습니다.
2026-11-14 Unity에서 새 씬을 생성하고 62개 LOD 그룹의 계층을 수정했습니다. FBX의 동서 반전은 맵 루트의 X축 반사로 보정했으며 90개 건물 좌표가 계획과 일치합니다(최대 오차 0.00004m). 카메라 8개와 조명을 포함합니다. 기존 실행 씬과 빌드 설정은 변경하지 않았습니다.
FBX 내보내기 재질 경고는 0건입니다. Blender 공유 메시 구조는 유지하고 FBX 내보내기 중에만 메시를 분리했습니다.

## 확인 방법
Unity Project에서 `CityMasterplan_v003.unity`를 열고 Scene 뷰로 확인하세요. 전체 카메라는 `CAM_Map_Overview`입니다. 도시 스탯 시각물은 기본 비활성입니다. 이 씬은 시각 작업본이며 기존 게임 실행 씬을 대체하지 않습니다.

## 남은 작업
이벤트·스탯 런타임 연결, 게임플레이 Collider/NavMesh, 실제 이동용 NPC 연결은 미완료입니다. Unity 재질의 화면 확인, 일부 시설 출입구/차량 동선 근접 검수, 최적화도 남아 있습니다. Play Mode·성능·WebGL 검증은 사용자 요청으로 보류했습니다. 기존 블록아웃 경로 검사는 최신 맵의 이동 검증이 아닙니다. 전시 승인본으로 표시하지 않으며 map_version은 미확정입니다.
원본 에셋·기존 맵은 그대로 두고 새 작업 폴더만 반영했습니다. 외부 체크포인트 폴더에는 Unity 작업용 사본도 있으므로 폴더 전체를 불변 백업으로 간주하지 않습니다.
