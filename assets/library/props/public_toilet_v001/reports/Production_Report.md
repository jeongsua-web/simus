# SIMUS Public Toilet v001

제작: 2026-10-14. 상태: received. 독립형 외관 에셋이며 기존 맵에는 배치하지 않았습니다.

## 구성
단층 건물, 얇은 평지붕과 처마, 남/녀/장애인 독립 출입문, 개별 힌지와 손잡이, 4개 교체형 픽토그램 면, 출입구별 차양, 3개 개별 발광등, 후면 고정창 3개, 양측 루버 환기구, 후면 홈통과 배수관 2개, 석재 하단부, 접근 기단, 경사로 및 짧은 난간을 제작했습니다. 내부는 바닥·가림벽 3개·세면대 실루엣만 포함합니다. 실제 브랜드·기관 로고는 없습니다.

## 규격과 성능
- 본체 평면: 10 × 4m. 지붕 포함 높이 3.52m.
- 기단/난간/경사로/배수관을 포함한 전체: 10.5 × 7.292 × 3.52m. 깊이 약 7m 기준보다 부속 접근부가 0.292m 더 나옵니다.
- 원점: 건물 본체 바닥 중앙, Blender Z=0 / Unity Y=0. Blender 정면 -Y → Unity 정면 +Z.
- 접근 기단 0.10m, 경사로 길이 1.5m, 폭 1.7m, 기울기 1:15. 내부 바닥 높이 0.101m.
- 에셋 오브젝트 165개: 보이는 메시 138개, 충돌 프록시 16개, 그룹 Empty 11개. 미리보기 카메라/조명/바닥은 FBX 제외.
- 보이는 삼각형 16,812개. 충돌 프록시 삼각형은 Unity에서 렌더 제거.
- 공용 재질 9개: Wall / Stone / Roof / Door / Glass / Metal / Sign / Interior / Emission.
- 텍스처: PRT_Sign_Atlas.png, 1024×256 RGB. 직접 그린 남/녀/휠체어/WC 4분할. Blender에 패킹 및 프로젝트 내 상대경로 지정.

## 최종 파일
- 원본: `assets/library/props/public_toilet_v001/source/SIMUS_Public_Toilet.blend`
- FBX: `unity/Assets/SIMUS/Art/props/public_toilet_v001/models/SIMUS_Public_Toilet.fbx`
- 텍스처/재질: `unity/Assets/SIMUS/Art/props/public_toilet_v001/textures` 및 `/materials`
- 배치용 프리팹: `unity/Assets/SIMUS/Prefabs/props/public_toilet_v001/SIMUS_Public_Toilet.prefab`
- 검수 이미지: 본 에셋의 `previews/` 폴더. 정면/정면 사선/후면 사선/측면/상면/표지판 확대/전체/실제 Unity 출력/문 개방 내부 검사 총 9장.

## 검사
Blender: 음수 스케일 없음, 재질 미할당 없음, 표지판 데칼을 제외한 구조 메시 열린 경계 없음. 360도 외관과 문 개방 컷을 확인했습니다. FBX 재가져오기 치수 오차 0.000001m 미만. Unity 검증 프로젝트에서 1m 단위, +Z 정면, 문 3개 힌지 회전, 공용 재질 9개, 표지판 PNG 연결, BoxCollider 19개, MeshCollider 0개를 확인하고 실제 Unity 카메라 이미지를 생성했습니다.

## Unity 사용 시
프리팹을 사용할 때 문 3개와 조명 3개를 각각 제어할 수 있습니다. PublicToiletAssetSetup.cs는 이 에셋 경로에만 적용되어 프록시 16개를 BoxCollider로 바꾸고 프록시 렌더를 제거하며, 문 3개에도 BoxCollider를 추가합니다. 복잡한 MeshCollider는 사용하지 않습니다. 문 열기 동작/이벤트는 미포함이며 힌지 원점이 준비되어 있습니다. Blender에서는 문 local Z +90도, Unity에서는 월드 수직축 기준으로 회전시킵니다.

경사로 충돌은 4개 박스로 단순화해 단차가 2.5cm입니다. 실제 NPC/CharacterController의 stepOffset과 NavMesh 연결은 추후 배치 시 확인해야 합니다. 발광 재질은 포함하지만 실시간 Point Light 및 야간 GI 베이크는 씬 조명 담당 작업입니다. 창문은 성능 우선의 불투명 청회색 재질입니다.

## 배치 권장과 남은 검수
공원 입구, 학교 외곽 보행로 또는 주택가 공공공지의 평탄한 곳을 권장합니다. 경사로 앞 보행 접근 공간을 추가 확보하고 도로·보도·건물 출입구를 막지 않도록 확인하십시오. 맵 좌표, map_version, NPC 경로는 미지정입니다. 실제 플레이어 통과, 야간 조명, 타깃 기기 성능과 전시 승인은 아직 검수 전입니다. 실내 전체 화장실 설비나 건축 법규 인증 모델이 아닙니다.

기존 맵과 기존 자산은 수정하지 않습니다. 관리 목록만 신규 행과 링크를 추가합니다. 관리 파일의 작업 전 백업: `C:/Project/simus_backups/public_toilet_20261014_031124`.

## 실제 프로젝트 최종 확인
C:/Project/simus/unity에서 최종 가져오기 검사가 성공했습니다. 기존 자산 1188개 파일의 해시를 비교했고 변경·삭제된 기존 자산은 0개입니다. 기존 맵 및 씬은 저장하거나 배치하지 않았습니다. catalog 기존 오류 63건은 동일하며 이번 신규 항목 오류는 없습니다. 자세한 결과는 Final_Audit.json 및 Catalog_Audit.md에 있습니다.
