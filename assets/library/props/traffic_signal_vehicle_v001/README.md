# SIM:US 차량용 4구 신호등

2026-10-16 · v001 · received · 기존 맵 미배치

- [Blender 원본](source/SIMUS_TrafficSignal_Vehicle.blend)
- [검수 이미지](previews/Overview.jpg)
- [제작·사용 보고서](reports/Delivery_Report.md)
- FBX: `unity/Assets/SIMUS/Art/props/traffic_signal_vehicle_v001/models/SIMUS_TrafficSignal_Vehicle.fbx`
- 전체 프리팹: `unity/Assets/SIMUS/Prefabs/props/traffic_signal_vehicle_v001/SIMUS_TrafficSignal_Vehicle.prefab`
- 헤드 전용: `unity/Assets/SIMUS/Prefabs/props/traffic_signal_vehicle_v001/SIMUS_TrafficSignal_Vehicle_Head.prefab`

Unity에 프리팹을 추가하고 Signal Display의 State를 선택하세요. 기본은 RED입니다. Play 모드에서는 상태와 깜빡임이 즉시 반영됩니다. 코드에서 `SignalDisplay.SetState(...)`로 변경할 수 있습니다. 지원 상태: ALL_OFF, RED, YELLOW, GREEN_STRAIGHT, GREEN_LEFT, GREEN_STRAIGHT_LEFT.

공유 재질은 `unity/Assets/SIMUS/Art/props/traffic_signal_shared_v001/materials`, 제어 코드는 `unity/Assets/SIMUS/Runtime/SignalDisplay.cs`입니다. 이 의존 파일들을 함께 유지하세요. 공유 재질의 색을 상태마다 수정하지 않고 개별 발광 오브젝트를 전환합니다.

전체 프리팹 원점은 지주 하단 지상, Unity +Z가 신호를 보는 사람 쪽입니다. 내부 모델 축 보정을 초기화하지 마세요. 헤드 전용 프리팹 원점은 하우징 뒤쪽 중앙 장착점입니다.

전체 폭4.01m / 높이5.93m / 깊이.50m. 지주 지름.22m, 수평 암3.8m. 헤드1.64×.22×.44m, 하단5.06m, 렌즈지름.30m.

LOD0, 외부 텍스처0, 런타임 Light0. 실제 교차로 신호 주기·통행 정책·교통 시스템 연결은 포함하지 않습니다.
