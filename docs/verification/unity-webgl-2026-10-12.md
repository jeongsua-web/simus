# Unity WebGL 웹 연결 검증 (2026-10-12)

- 실행 페이지: `/unity`. 실제 산출물: `unity/Builds/npc_follow_preview`, 배포 경로: `web/public/unity-preview` (약 69MB).
- Unity 6000.3.24f1에서 기존 `CompletedMapNpcFollow.unity`를 WebGL로 빌드했다. 임시 프로젝트에서 빌드에 불필요한 Blender 원본을 제외했고 저장소 원본·장면·GUID는 보존했다.
- 프리뷰는 테스트 장면이다. `map_version:null`, `exhibition_ready:false`이며 참여 회차·선택 결과와 연결하지 않는다. `/participate`의 본인 NPC·지도 버전 검증은 유지한다.
- 웹 lint/build, 전체 격리 PostgreSQL API 통합 검사, Unity EditMode 23/23, 브리지 JavaScript 4/4 통과.
- Chromium 390px/1280px에서 실제 WebGL 캔버스 초기화, 시작 화면 이후 맵·NPC 표시, 다시 불러오기, 오류·재시도, 응답 헤더, 가로 넘침 및 페이지 오류 검사를 통과했다. 휴대폰 실기기 검증은 수행하지 않았다. 모바일의 기존 Unity 테스트 HUD 일부 문구는 잘린다.
- Unity 브리지의 최근 NPC 이동 타입 및 응답 계약 호환 문제를 수정했다. 최종 브리지 수정은 위 프리뷰 빌드 이후 적용했으며, 프리뷰 장면은 해당 브리지 컴포넌트를 사용하지 않는다. 수정된 소스는 EditMode로 검증했다.
- `python3 scripts/assets/catalog.py`와 `--check`를 실행했다. 기존 manifest에서 역할 NPC 원본 경로 누락 3건과 행복도 캐릭터 Blender 원본 해시 불일치 1건으로 목록 갱신이 차단됐고, check는 inventory 미갱신도 보고했다. 승인 상태·원본 파일·등록 해시는 임의 변경하지 않았다.

빌드·배포 절차는 `unity/README.md`와 `web/OPERATIONS.md`를 따른다. WebGL 산출물은 Git에서 제외되므로 다른 환경에서는 빌드 후 `cd web && npm run unity:deploy`로 배치해야 한다.
