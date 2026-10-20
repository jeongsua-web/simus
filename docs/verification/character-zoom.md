# 웹 캐릭터 화면 확대·축소

참여 화면의 Unity 도시 위에 축소·현재 배율·확대 버튼을 추가했다. 버튼은 1.25배씩 조절하고 현재 배율을 누르면 100%로 복원한다. 범위는 50~400%이며, PC 휠과 모바일 두 손가락 간격 변경도 같은 배율을 사용한다. 카메라의 추적 대상·경로·회차 데이터는 그대로 유지한다.

Unity 런타임의 `READY.camera_zoom` 지원 표시와 NPC 연결을 확인한 뒤 조작을 활성화한다. 이전 빌드에서는 조작 버튼을 숨긴다. 브리지 메시지는 기존 origin/source/channel/version/bridge_id 검증을 적용하고, 잘못된 배율·연결 전 입력을 무시한다. 종료 시 제스처 이벤트도 해제한다.

- 웹: `web/src/app/participate/UnityCity.tsx`, `participate.module.css`, `unity-bridge.ts`
- Unity: `CityPreviewCamera.SetFollowZoom`, `WebCityBridge.SetZoom`, `simus_city/bridge.js`
- 새 빌드: `unity/Builds/city_rebuild_v002_character_zoom`, 개발 웹 `/city-rebuild-v002`에 반영
- 이전 배포 보존: `unity/Builds/city_rebuild_v002_before_character_zoom`

## 검증

- ESLint, TypeScript, `npm run build` 통과.
- 브리지 단위 검사: 배율 검증·범위 제한·연결/지원 여부·메시지 필터·휠·핀치·이벤트 해제 통과.
- 실제 Unity WebGL과 별도 PostgreSQL을 사용하는 참여 통합 검사 통과. 확대 버튼의 런타임 배율, 실제 휠, 모바일 크기의 핀치 TouchEvent, 기본 배율 복원, 추적 유지 및 화면 안 조작 버튼 배치를 확인했다. 상황 정지·응답 저장·이동 재개·회차 종료도 통과했다.
- `python3 scripts/assets/catalog.py`, `--check`: 오류 0개.

실행 방법:

```sh
node --test scripts/unity/bridge-adapter.test.cjs
node --experimental-strip-types --test web/tests/unity-bridge.test.mjs
# web 디렉터리: TEST_V002_PLAYWRIGHT_MODULE과 TEST_CHROMIUM_EXECUTABLE 지정
npm run test:integration
```
