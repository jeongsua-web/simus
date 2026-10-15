# SIMUS 재활용 분리수거장 — v001
2026-10-14 / received / 맵 미배치

사진의 지붕·가림막 비례를 참고한 독자 디자인입니다. 사진 속 기관명·제품명·로고는 사용하지 않았습니다.
현재 맵에 사용되는 정상 분리수거통을 재사용하고 새 구조물로 조립했습니다.

## 파일 위치
- Blender: `assets/library/props/recycle_station_v001/source/SIMUS_Recycle_Station.blend`
- FBX: `unity/Assets/SIMUS/Art/props/recycle_station_v001/models/SIMUS_Recycle_Station_Complete.fbx`
- 구조물 FBX: 같은 models 폴더의 `SIMUS_Recycle_Station_Structure.fbx`
- 프리팹: `unity/Assets/SIMUS/Prefabs/props/recycle_station_v001/`의 Complete / Structure
- 재질·텍스처: `unity/Assets/SIMUS/Art/props/recycle_station_v001/materials`, `textures`
- [완성형 이미지](previews/02_Front_Oblique.png) · [정면](previews/01_Front.png) · [NPC 크기 비교](previews/08_NPC_Scale_Comparison.png)
- [제작·검수 보고서](reports/Production_Report.md)

프리팹은 프로젝트 ASSET_RULES의 공용 Prefabs 경로에 보관합니다.
기존 파일을 옮기거나 덮어쓰지 않았습니다.

## 사용
Unity에서 Complete 프리팹을 필요한 장면에 끌어놓으면 정상 통 5개가 포함된 시설이 됩니다.
Structure 프리팹에는 같은 5개 빈 슬롯이 있어 원하는 통을 추가할 수 있습니다.
표지판은 교체 가능한 별도 메시이며 분류는 플라스틱·종이·캔/금속·유리·비닐입니다.

루트 RecycleStationRig:
- SetBinEnabled(index, enabled): 0~4번째 통·분류 표지 슬롯 표시/숨김.
- SetBinState(index, Normal/Half/Overflow): 기존 정상·절반·넘침 모델로 교체.
- ReplaceBin(index, model): 같은 축 규칙의 별도 통으로 교체. 원본 크기 기준 균일 배율 1.45 적용.
- SetLights(on): 독립 조명 두 개와 발광 패널 켜기/끄기.
각 조명은 Inspector에서도 별도로 제어할 수 있습니다.
현재 '가득 참' 전용 모델은 기존 목록에 없어 별도로 만들지 않았습니다. 해당 모델이 준비되면 ReplaceBin으로 슬롯에 연결할 수 있습니다. 쏟아짐 모델은 옆 슬롯 침범 가능성이 있어 기본 참조에 넣지 않았습니다.

## 배치 공간
전체 약 4.85 × 2.563 × 2.541m(폭·깊이·높이), 지붕 깊이 2.48m.
통 앞 내부 유효 보행 폭 1.202m, 통 간격 0.15m.
배수구와 외곽 여유를 포함해 최소 5.1 × 2.8m의 평탄한 영역을 확보하고, 앞쪽 기존 보행로와 연결하세요.
Blender 전방 -Y / Unity 프리팹 전방 +Z. 프리팹 루트는 위치·회전 0, 배율 1이고 바닥 중앙이 기준입니다.
FBX 내부의 가져오기 축·단위 변환을 임의로 제거하지 마세요.

기존 맵은 수정하지 않았습니다. 타깃 기기 성능과 실제 맵 동선 검수는 별도이며 상태는 approved가 아닌 received입니다.
