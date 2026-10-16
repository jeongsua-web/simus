# 차량용 4구 신호등 제작 및 검수

제작일2026-10-16 / v001 / received / map_version 빈 값 / 기존 맵 미배치

## 구성과 재사용
기존 3구 에셋 `assets/library/props/traffic_light/source/SIMUS_Traffic_Light.blend`의 Brushed metal 및 Blue charcoal powder coat 재질을 독립 복사해 색상·거칠기를 조정했습니다. 기존 메시와 원본은 변경하지 않았습니다. 이번 지주·헤드·렌즈·후드·브래킷·베이스·볼트·덮개·발광 표시·충돌체는 새 제작입니다.
차량용은 정면 기준 빨강/노랑/초록 좌회전/초록 직진 순서이며 화살표는 정면 왼쪽입니다. 보행자용은 위 빨간 서 있는 사람, 아래 초록 걷는 사람입니다. 로고/역명/기관명/외부 사진을 사용하지 않았습니다. 픽토그램은 자체 제작 닫힌 메시로 알파 사각 배경이나 누락 텍스처가 없습니다.

## 크기·원점
전체 폭4.01m / 높이5.93m / 깊이.50m. 지주 지름.22m, 수평 암3.8m. 헤드1.64×.22×.44m, 하단5.06m, 렌즈지름.30m.
기존 성인1.645m, 택시 길이4.894m/거울포함폭2.218m/높이1.630m와 실제 Blender 복사본을 통해 비교했습니다. 비교용 캐릭터와 자동차는 FBX/프리팹에 포함하지 않았습니다.
전체 프리팹 원점은 지주 하단 지상. 렌즈 정면은 Blender -Y, Unity +Z입니다. 차량 암은 Blender +X, Unity -X로 뻗습니다. Unity 모델 내부의 보정 회전을 초기화하지 말고 최상위 프리팹으로 회전하세요. 헤드 전용 프리팹은 하우징 뒤쪽 중앙이 원점입니다. 치수는 게임 모델링 기준이며 법적 설치 규격 인증이 아닙니다.

## 구조·성능
에셋 오브젝트 30개, 렌더 메시 23개, 평가 삼각형 2,856개(충돌체/스튜디오 제외). 두 에셋은 런타임에서 금속/하우징/고무/OFF/빨강/노랑/초록의 7개 공유 재질을 사용합니다. 텍스처0, Light0, LOD0만 제공합니다. LOD1은 생략해 상태 표시의 불일치를 방지했습니다.
Blender PREVIEW 컬렉션은 스튜디오 바닥·카메라·조명으로 FBX 제외입니다. 볼트/후드는 의미 단위로 묶었으며 렌즈와 발광 표시, 헤드, 지주는 분리되어 있습니다. OFF에서 렌즈는 남아 있고 발광 메시만 숨깁니다. 발광 면과 렌즈 사이 수 mm 간격으로 Z-fighting을 피했습니다.
정적 충돌체 4개: 지주 CapsuleCollider, 베이스/헤드 및 차량 암 BoxCollider. 헤드 전용은 헤드 BoxCollider1개. Rigidbody와 세부 렌즈/볼트 충돌체는 없습니다.

## 상태 제어
지원 상태: ALL_OFF, RED, YELLOW, GREEN_STRAIGHT, GREEN_LEFT, GREEN_STRAIGHT_LEFT.
`Simus.City.SignalDisplay` 컴포넌트는 개별 인스턴스의 발광 GameObject만 활성화합니다. 공유 재질 변경과 재질 복제를 하지 않습니다. SetState 메서드는 신호 종류에 맞지 않는 값을 거절합니다. Inspector의 State 변경도 반영됩니다. 기본 전체/헤드 프리팹은 RED입니다.
보행자 GREEN_BLINK는 기본주기1초, .5초ON/.5초OFF이며 `blinkPeriod`로 조정합니다. 상태 전환 시 ON부터 시작하며 빨간색은 계속OFF입니다. 실제 시간 기준으로 동작해 게임 Time Scale과 독립적입니다. ApplyStateAt은 검수용 결정론적 샘플링도 제공합니다.
실제 교차로의 신호 순서·차량/보행자 정책·교통 시스템 자동 연결은 구현하지 않았습니다. 기존 코드 수정 및 외부 패키지 추가가 없습니다.

## Unity 검수
Unity6000.3.24f1 별도 검수 프로젝트에서 실제 FBX import, 컴파일, 크기/축 확인, 상태별 Camera.Render를 수행했습니다. 현재 프로젝트와 같은 Built-in Standard 사용. _EMISSION과 RealtimeEmissive 플래그 명시, Bloom 없이 구분 가능. URP/HDRP 전환은 별도 재질 변환이 필요합니다.
차량6개/보행자4개 상태를 검사했으며, OFF에서도 렌즈 유지·각 신호 개별 활성·다른 상태의 두 인스턴스 독립성을 확인했습니다. 보행자 깜빡임은0/.49/.51/.99/1.01초의5샘플로 확인했습니다.
별도 Unity Play Mode에서 실제 Update를 실행해 약.15/.65/1.15초의 ON/OFF/ON과 독립 인스턴스의 빨간불 유지, 차량 좌회전/빨간불 독립 표시를 확인했습니다. playmode.json 참조. 깜빡임 GIF는 동일 제어 함수로 렌더한 ON/OFF 프레임을 각각500ms로 구성한 미리보기입니다.
모든 렌더 메시의 평가된 열린 경계0, 외향 노멀 재계산, 양수 스케일을 확인했습니다. 주요 접합/후드/아이콘은 정면·측면·후면·확대 렌더로 확인했으며 모든 삼각형 쌍의 전수 교차 검사나 타깃 기기 성능 검사는 하지 않았습니다.

## 경로와 납품
Blender: `assets/library/props/traffic_signal_vehicle_v001/source/SIMUS_TrafficSignal_Vehicle.blend`
FBX: `unity/Assets/SIMUS/Art/props/traffic_signal_vehicle_v001/models/SIMUS_TrafficSignal_Vehicle.fbx`
전체 프리팹: `unity/Assets/SIMUS/Prefabs/props/traffic_signal_vehicle_v001/SIMUS_TrafficSignal_Vehicle.prefab`
헤드 프리팹: `unity/Assets/SIMUS/Prefabs/props/traffic_signal_vehicle_v001/SIMUS_TrafficSignal_Vehicle_Head.prefab`
공유재질: `unity/Assets/SIMUS/Art/props/traffic_signal_shared_v001/materials`
신규제어코드: `unity/Assets/SIMUS/Runtime/SignalDisplay.cs`

기존 파일 2174개의 해시를 작업 전과 비교하여 보존을 확인했습니다. 기존 맵·원본·교통 코드 미수정. 승인 여부는 received이며 타깃 기기 성능·전시 배치 검수는 별도입니다. 작업 전 존재하던 다른 캐릭터 관련 manifest 해시 불일치4행은 그대로 보존했습니다. baseline_errors.json에 기록했습니다.

검수 환경 참고: Play Mode 종료 후 Unity Editor SearchDatabase 시작 인덱싱에서 내부 예외가 1회 기록되었습니다. 신호등 제어 코드 스택은 아니며 신호등 Play Mode 검사는 통과했습니다. 새 코드의 C# 컴파일 오류는 없었습니다.
