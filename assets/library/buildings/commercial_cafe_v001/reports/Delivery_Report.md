# 카페 상가 제작·검수 보고서

## 출처와 보존
- 원본: `unity/Assets/SIMUS/Art/buildings/commercial/COMMERCIAL_03_MODERN_CORNER.blend`
- 원본 SHA-256: `8e66eafbd405eac73c60b13f290cd42049e87073d5c419acb9a0dbe044a0b411`
- 원본 FBX 및 프리팹/텍스처/manifest 항목: 수정 없음.
- 건물 층수: 4층 유지.
- 3.72m 위 기존 메시 391개: 월드 정점·면·재질 슬롯 해시 대조 통과.
- 최초 복제 후 변경한 기존 1층 오브젝트 목록: `model.json`의 removed_ground_objects.

## 변경
- 새 1층 창호와 오프셋 출입문, 손잡이, 얕은 경사로, 외벽 마감.
- 독립 메인 간판/보조 간판과 메뉴판, 벽등 2개, 교체형 인쇄 면.
- 곡면 녹색 어닝, 목재 프레임, 화분 3개, 벽측 소형 테이블과 스툴 2개.
- 별도 실외기와 받침대. 후면 기존 설비 및 창문과 충돌하지 않도록 Bridge에서 위치 수정.
- 실제 내부 대신 어두운 뒷면과 따뜻한 가구 실루엣 이미지 면 사용.

## 수치
- 전체 크기 X/Y/Z (Blender, 기존 부지 포장 포함): [14.4, 18.0, 13.878] m.
- 루트 아래 오브젝트: 661 (촬영 장치 제외).
- 메시: 644; 삼각형: 13772; 사용 재질: 23.
- 원점: (0,0,0); Blender 정면 -Y, Unity 정면 +Z; 1유닛=1m.
- 텍스처: Shop_Main_Sign.png, Shop_Menu.png, Shop_Window_Illusion.png, TEX_STONE_GRAY.png.

## 결과 경로
- Blender: `assets/library/buildings/commercial_cafe_v001/source/SIMUS_Commercial_Cafe.blend`
- FBX: `unity/Assets/SIMUS/Art/buildings/commercial_cafe_v001/models/SIMUS_Commercial_Cafe.fbx`
- 프리팹: `unity/Assets/SIMUS/Prefabs/buildings/commercial_cafe_v001/SIMUS_Commercial_Cafe.prefab`
- 재질·텍스처: `unity/Assets/SIMUS/Art/buildings/commercial_cafe_v001/materials`, `/textures`.

## 검수
- Blender Bridge 연결 장면에서 정리·수정·재저장·FBX 재내보내기 완료.
- 새 닫힌 메시 노멀 재계산, 의도한 이미지/유리 면 이외 새 열린 메시 없음.
- 음수 스케일·누락 재질·신규 지면 아래 오브젝트·완전히 중복된 월드 메시 없음.
- 상층부 원본 보존 및 텍스처 패킹 확인: `geometry_final.json`.
- Unity 6000.3.24f1 별도 검수 프로젝트: FBX 크기/전방 일치, 재질 연결, 6개 그룹 숨김·복원, 앞 출입 접근 충돌 없음 확인.
- Unity BoxCollider 3개, 독립 Point Light 2개. 검수: `unity.json`.
- 정면/양측 사선/측후면/입구/야간/원본 비교/기존 택시 크기 비교 이미지 저장. 최종 후면 설비는 `13_Rear_Equipment.png`.
- 환경광/태양 역할과 흑백 명도 검토 완료. `14_World_Only`, `15_Key_Only`는 실내 발광과 벽등을 유지한 환경광·태양 분리 비교입니다.
- 기존 맵 미배치. 원본 프로젝트의 파일 해시 대조 기록은 `preservation.json`.

## 사용 제한과 추가 검사
- 실제 내부 진입 게임플레이용이 아닌 외관 에셋입니다.
- 최종 맵 배치 후 보행 동선·NavMesh·주변 건물과의 여유 공간 검사가 필요합니다.
- 기존 상층부의 원본 타일/창호/간판과 형상 디테일은 그대로 유지했습니다.
- 기존 메시의 열린 경계나 상층부 틈을 새 건물로 재제작하지 않았습니다. 새 추가 메시와 분리해 검수했습니다.
- 재질별 병합이나 LOD 최적화는 원본/개별 제어 유지 범위를 넘어 적용하지 않았으며 타깃 장치 성능 승인은 미완료입니다.
- 실제 운영 장면의 Play Mode는 이 작업에서 실행하지 않았습니다. 별도 Unity 검수 프로젝트에서 프리팹을 렌더하고 검사했습니다.
- 기존 manifest의 무관한 캐릭터 Blender 해시 불일치 1건은 변경하지 않았습니다. 신규 에셋 오류는 없습니다.
