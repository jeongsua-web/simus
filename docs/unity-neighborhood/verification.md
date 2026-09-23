# 동네 맵 원본 검증 기록

GPT 작업 폴더의 2026-09-22 검증 결과를 현재 저장소 구조에 맞춰 옮긴 기록입니다.
검증 환경은 macOS ARM64, Unity 6000.3.24f1입니다.

- FBX 가져오기와 스크립트·셰이더 컴파일 성공. 메시 렌더러 725개, 독립 재질 매핑 32개.
- 맵 경계 X 200m / Y 18.25m / Z 200m.
- 실제 Unity 카메라 렌더 결과: [조감도](Unity_Overview.png), [배치도](Unity_Plan.png).
- Play Mode에서 100회 편집기 갱신 후 조감도·배치도 전환과 복귀 확인.
- 원본 검사 중 Unity 검색 인덱스 초기화에서 `UnityEditor.Search.SearchDatabase`의
  `ArgumentOutOfRangeException`이 한 번 기록됐으나, 이후 장면 검사는 정상 완료됨.
- 편집기 GUI는 Unity Software Terms 창에서 대기했으며 사용자가 직접 조작하는 검증은
  당시 수행되지 않음.

위 결과는 원본 시제품의 검증입니다. 현재 저장소에 병합한 장면의 컴파일·렌더·Play 검증은
별도로 수행해야 합니다. 서버 연결, NPC 이동, 전시 기기 성능도 검증 범위에 포함되지 않았습니다.
