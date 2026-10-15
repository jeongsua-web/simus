# 도시 상태 확인 방법

1. Unity에서 `Assets/SIMUS/Scenes/npc_follow_test/CompletedMapNpcFollow.unity`를 엽니다.
2. Hierarchy의 `SIMUS Completed Map 03`을 선택합니다. Inspector의 **City State Assets**에서 Happiness, Safety, Cleanliness, Pollution을 조절합니다.
3. 직접 비교할 때는 Follow Server를 끕니다. 실시간 서버 수치로 돌릴 때는 켭니다. 90/90/90/10은 최상, 10/10/10/90은 최악입니다.

Regions에서 구역의 Enabled를 켜면 해당 구역의 오염도만 따로 바꿀 수 있습니다. 실제 서버 지역 코드가 정해지기 전에는 Server Code를 비워 둡니다.

청결도 90/70/50/30/10 순서로 쓰레기 슬롯이 0/20/40/60/80개 표시됩니다.

[전체 보고서](reports/city_state_v001/Delivery_Report.md) · [지도 비교 이미지](previews/city_state_v001/) · [개별 에셋 비교](../../props/city_state_v001/previews/)

연기·매연·안개·경광등 점멸은 제공된 Anchor에 Unity 효과를 연결해야 합니다. 검증 메뉴: SIMUS → City State → Verify Imported Map.
이전 환경 전용 FBX는 이번 실제 맵 통합 출력으로 대체했고 프로젝트 외부 원본 백업에 보관했습니다.
