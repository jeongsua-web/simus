# SIM:US 가상 지하철 출입구

2026-10-15 · v001 · received · 기존 맵 미배치

- [Blender 원본](source/SIMUS_Subway_Entrance.blend)
- [전체 검수 이미지](previews/Overview.jpg)
- [제작·설치 보고서](reports/Delivery_Report.md)
- Unity 프리팹: `unity/Assets/SIMUS/Prefabs/buildings/subway_entrance_v001/SIMUS_Subway_Entrance.prefab`
- FBX: `unity/Assets/SIMUS/Art/buildings/subway_entrance_v001/models/SIMUS_Subway_Entrance.fbx`
- 재질·텍스처: `unity/Assets/SIMUS/Art/buildings/subway_entrance_v001/materials`, `textures`

Unity에서는 프리팹을 사용하세요. 바깥 루트의 원점은 입구 중앙 지상 높이이며 진입 방향은 +Z입니다. 내부 모델의 축 보정 회전을 초기화하지 마세요. 지면 절단은 자동으로 수행되지 않습니다.

폭6m, 바닥 길이14.5m, 캐노피 길이10.8m, 지상 높이3.07m(안내 기둥3.65m), 통로 바닥 깊이3.4m입니다. LOD0만 포함하며 에스컬레이터 애니메이션은 포함하지 않습니다.

5개 LIGHT_ANCHOR에 선택적 Point Light가 있으며 기본 비활성입니다. 필요한 것만 활성화하세요. 발광 메시·유리·안내판·포털은 별도 제어 가능합니다. 컷아웃/외곽/보행 가이드는 비활성이며 충돌체가 없습니다. Blender의 SUBWAY_PREVIEW_ONLY는 검수용 바닥·카메라·조명으로 FBX에서 제외되었습니다.
