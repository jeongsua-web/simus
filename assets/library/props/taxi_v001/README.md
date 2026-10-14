# 한국형 중형 세단 택시 — v001
제작일: 2026-10-14. 상태: received. 기존 맵에 배치하지 않은 독립 에셋입니다.
프로젝트 ASSET_RULES의 허용 분류에 따라 vehicles 대신 props에 저장했습니다.

## 파일
- Blender 원본: `assets/library/props/taxi_v001/source/SIMUS_Taxi.blend`
- Unity FBX: `unity/Assets/SIMUS/Art/props/taxi_v001/models/SIMUS_Taxi.fbx`
- 배치용 프리팹: `unity/Assets/SIMUS/Prefabs/props/taxi_v001/SIMUS_Taxi.prefab`
- 공용 재질·텍스처: `unity/Assets/SIMUS/Art/props/taxi_v001/materials`, `textures`
- [미리보기](previews/05_Front_Oblique.png) · [검수 보고서](reports/Production_Report.md)

## 규격과 사용
- 길이 4.894m, 차체 폭 1.84m, 차체/지붕 높이 1.485m.
- 거울 포함 전체 폭 2.218m, 표시등 포함 전체 높이 1.630m.
- 미터 단위, 지면 중심 원점. Blender 전방 -Y / Unity 전방 +Z. 기존 일반차 전조등 위치로 실제 방향을 대조했습니다.
- LOD0 17,020 triangles / 33 renderers; LOD1 1,544 triangles / 28 renderers.
- 바퀴 4개는 축 중심의 독립 Transform. Unity 기본 Untagged / Layer 0이며 기존 일반차와 같습니다.
- 프리팹을 빈 테스트 장면으로 끌어놓아 사용할 수 있습니다. 원본 Blender에서는 LOD0만 보이고 LOD1·충돌 프록시는 숨겨져 있습니다.
- 이동·교통 AI·운행 경로·차량 물리는 포함하지 않았습니다. 게임의 이동 코드가 루트 Transform을 제어하고 아래 시각 제어를 호출하도록 연결합니다.

## 시각 제어
루트의 TransitVehicleRig 컴포넌트:
- SetWheelAngle(degrees): 네 바퀴 회전.
- SetDoorsOpen(0~1): 버스 앞문·중앙문 슬라이드.
- SetHeadlights, SetBrakeLights, SetIndicators: 차량등 발광 상태.
- SetRouteDisplay: 버스 노선판 발광.
- SetRoofSign / SetOccupied: 택시 지붕등 / FREE·BUSY 표시 전환.
공유 머티리얼을 바꾸지 않고 개별 인스턴스의 MaterialPropertyBlock으로 제어합니다.
텍스처는 직접 제작한 가상 S01 CAMPUS / SIMUS / TAXI 도안이며 실제 업체·차량 로고를 복제하지 않았습니다.
텍스처와 FBX는 상대 폴더 구조를 함께 유지하세요. Blender에는 기본 텍스처를 패킹했습니다.

## 검수 범위
Blender 재열기, 닫힌 메시·재질 확인, FBX 재가져오기, Unity 6000.3.24f1 프리팹 로딩·LOD 렌더·회전축·문·표시 전환을 검사했습니다.
타깃 기기 성능 및 실제 도로 주행 검증은 수행하지 않았으므로 approved로 등록하지 않았습니다.
기존 일반차는 길이 약 3.70m인 단순 모델이므로 신규 차량을 동일 길이로 축소하지 않았으며 실제 미터 치수 비교 이미지를 제공합니다.
