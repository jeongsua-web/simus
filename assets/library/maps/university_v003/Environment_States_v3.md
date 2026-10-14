# 환경 상태 v3 / 역할 NPC 업데이트

2026-10-09 사용자 요청으로 반영. 접수 상태이며 전시 승인이나 map_version 확정을 의미하지 않습니다.

- 맵 원본: unity/Assets/SIMUS/Art/maps/university_v003/SIMUS_Dense_Realistic_University_Map_03.blend — 환경 상태가 포함된 완료본으로 교체. 기존 파일명과 .meta GUID 보존.
- 기본 맵 FBX: 같은 폴더의 SIMUS_Dense_Realistic_University_Map_03.fbx — 기존 학교·도로·건물에 변화가 없어 유지. 기존 추적 테스트 연결 유지.
- 상태 소품 FBX: 같은 폴더의 SIMUS_Environmental_State_Assets_v3.fbx — 93메시, 20Empty. 상태 소품만 포함.
- NPC 편집 원본: assets/library/characters/role_variants_v001/source/SIMUS_NPC_Role_Variants.blend
- NPC FBX 3종: unity/Assets/SIMUS/Art/characters/role_variants_v001/models/

Blender 맵은 NORMAL 상태로 저장되어 추가 상태 그룹이 숨겨져 있습니다. GOOD/BAD 및 LOW/HIGH는 한쪽씩 활성화합니다. 교체 6쌍은 Replacement_Mapping.json의 기존 오브젝트를 끄고 상태형을 활성화해야 중복되지 않습니다.

환경 FBX는 기본 맵 FBX와 동일 원점에서 함께 사용하는 추가 묶음입니다. Unity 장면에 자동 배치하거나 상태 수치에 연결하는 코드는 추가하지 않았습니다. NPC도 맵에 배치하지 않았고 기존 HairFix 캐릭터는 보존했습니다. FBX의 Blender 재불러오기 검사를 통과했지만 Unity Editor 재가져오기/Play Mode 검사는 미실행입니다.

previews/environment_states_v3에 검토 이미지가 있습니다. 공급자 보고서의 외부 절대경로는 제작 당시 기록이며 현재 사용 경로는 이 안내와 프로젝트 manifest를 따릅니다.
