# 개발 회차 Unity 연결 (2026-10-12)

참여 화면에서 시민증 등록과 입장이 끝나면 `UnityCity`가 `/city/index.html`을 연다. HttpOnly 쿠키로 본인 NPC를 조회하고 READY → INIT → BOUND 후 Unity를 표시한다. 상황 선택 패널은 같은 화면에 유지한다. 로딩 제한은 프리뷰와 동일하게 180초다.

`DevelopmentCityWebGLBuild.Build`는 기존 대학 맵 추적 장면을 임시 프로젝트에서 열고 로컬 테스트 NPC를 제거한 뒤 `WebCityBridge`와 서버 NPC 추적 카메라를 연결한다. `map_version=dev-synthetic-v1`은 7일 개발 회차 전용이다. 기존 가입의 불변 경로를 보존하며 개발용 사각 경로 아래에 별도 테스트 바닥을 둔다. 대학 맵은 배경 후보이며 이 빌드는 전시 지도 승인, 상황 배치, 경로 확정을 뜻하지 않는다. NPC는 브리지의 임시 캡슐 표현이다.

빌드: Unity 6000.3.24f1, WebGL, `simus_city` 템플릿, 압축 Disabled. 임시 프로젝트의 `Builds/development_city` 전체를 `web/public/city`에 배치한다. 기존 `/unity-preview`는 독립 프리뷰로 유지한다.

에셋 카탈로그 갱신 및 check는 기존 역할 NPC 원본 경로 누락 3건, 행복 캐릭터 원본 해시 불일치 1건 때문에 실패했다. 원본·승인·manifest 해시는 변경하지 않았다.

검증: Unity WebGL 빌드 성공. 웹 lint 0 errors(기존 shared-result 경고 1건), TypeScript 검사, 브리지 프로토콜 2건 통과. 390px Chromium에서 실제 쿠키 인증·시민증 등록 후 READY/BOUND의 회차 ID 및 NPC ID가 본인 API와 일치하고 iframe이 표시됨을 확인했다. 상황 이동 패널 표시 및 페이지 오류 없음도 확인했다. 휴대폰 실기기 검증은 남아 있다. 최초 두 빌드는 디스크 공간 부족으로 중단됐고 승인된 재생성 가능 캐시 정리 후 성공했다.

최종 빌드는 `DevelopmentCity` 장면에서 기존 자동 시제품 클라이언트/HUD 생성을 제외했다. 공개 HTTPS 터널에서도 새 빌드의 실제 READY/BOUND, 본인 NPC ID 일치, 표시 및 페이지 오류 없음 검사를 통과했다. 개발 서버는 검증 시 3135번에서 실행했다. 임시 공개 주소는 영구 배포 주소가 아니다.
