# SIM:US 카페 상가 v001

제작일: 2026-10-14 · 상태: received · 기존 맵에 미배치

- [Blender 원본](source/SIMUS_Commercial_Cafe.blend)
- [최종 모습](previews/12_Bridge_Final.png) · [1층 확대](previews/02_Storefront.png) · [원본 비교](previews/16_Before_After.png)
- [검수 보고서](reports/Delivery_Report.md)
- Unity 프리팹: `unity/Assets/SIMUS/Prefabs/buildings/commercial_cafe_v001/SIMUS_Commercial_Cafe.prefab`
- FBX: `unity/Assets/SIMUS/Art/buildings/commercial_cafe_v001/models/SIMUS_Commercial_Cafe.fbx`
- 재질/텍스처: `unity/Assets/SIMUS/Art/buildings/commercial_cafe_v001/materials`, `textures`

기존 COMMERCIAL_03_MODERN_CORNER를 복제해 1층만 파생 제작했습니다. 건물 원점 (0,0,0), 층수와 상층부를 유지했습니다. 원본 파일과 기존 맵은 변경하지 않았습니다.

Unity에서는 FBX 대신 위 프리팹을 사용하세요. 간판·문·차양·메뉴판·설비·외부 가구·조명은 이름별 하위 그룹에서 켜고 끌 수 있습니다. 조명 그룹에는 실제 Point Light 2개가 포함됩니다. 간판과 메뉴는 별도 PNG/재질로 교체할 수 있습니다.

내부는 출입 가능한 공간이 아닌 창문 뒤 이미지 면입니다. 창문 뒤에 전체 방이나 주방을 만들지 않았습니다. 문 열기 애니메이션은 포함하지 않습니다. 출입구 앞 충돌체는 비워 두고 건물 내부만 단순 BoxCollider 3개로 막았습니다.

소품은 기존 전면 포장 범위에 배치했습니다. 실제 맵에서는 전면 소품 끝 바깥으로 연속된 보행 공간 최소 1.5m, 후면 설비 점검 공간 0.8m 이상을 추가 확보하세요. 카페의 외부 가구 그룹은 공간이 좁으면 끌 수 있습니다.

Blender의 PREVIEW_ONLY는 촬영용 바닥·카메라·태양입니다. FBX/프리팹에는 포함되지 않습니다. 텍스처는 Blender에 패킹되어 있습니다. Unity 재질은 Built-in Standard 기반이며 URP/HDRP 프로젝트로 이동 시 재질 변환이 필요합니다.
