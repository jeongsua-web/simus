# SIM:US 프로젝트 결정

- **전시용 맵은 새로 제작한다.** 기존 `Neighborhood.fbx`·`neighborhood.glb`는 이전 시제품 자료이며 새 맵의 좌표·동선·상황 배치·최종 자산으로 간주하지 않는다.
- 새 맵의 `map_version`, 30개 상황의 위치, NPC 경로, 지역 경계, Blender 원본과 교환 자산은 아직 확정되지 않았다. 근거 없이 기존 지도 좌표를 새 회차 데이터에 넣지 않는다.
- 관련 인계 기록: `docs/content/new-map-handoff-5a.md`. 기존 일정·검증 문서에서 Neighborhood 재사용을 전제로 한 내용은 이 결정으로 대체한다.

## 에셋 관리

- 에셋 추가·변경·이동·정리 전 [`assets/ASSET_RULES.md`](assets/ASSET_RULES.md)를 읽고 따른다.
- 탐색 시작점은 `assets/catalog/README.md`, 승인 상태는 `assets/manifest.csv`, 실제 파일 목록은 `assets/catalog/inventory.json`이다.
- 작업 후 `python3 scripts/assets/catalog.py`와 `python3 scripts/assets/catalog.py --check`를 실행한다.
