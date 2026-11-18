# Unity 홈 배경 v001

Unity 6000.3.24f1에서 기존 `CityMasterplan_v003_EventPlaces` 도시를 복제한 장식용 영상. 유료 서비스·AI 영상 생성·Recorder 패키지를 사용하지 않았다. 상태는 `received`이며 전시 맵 승인이나 map_version 확정을 의미하지 않는다.

- 촬영 Scene: [HomeBackground.unity](../../../../unity/Assets/SIMUS/Scenes/home_background/HomeBackground.unity)
- 제작 도구: [HomeBackgroundCapture.cs](../../../../unity/Assets/Editor/HomeBackgroundCapture.cs)
- 촬영용 이동: [HomeBackgroundMotion.cs](../../../../unity/Assets/SIMUS/Runtime/HomeBackgroundMotion.cs)
- 영상: [city-background.mp4](../../../../web/public/videos/city-background.mp4), **576377 bytes**, 1920×1080 / 30fps / 12초 / 360프레임 / H.264 / 무음 / faststart.
- 첫 프레임: [city-unity-frame.jpg](previews/city-unity-frame.jpg)
- 웹 대체 배경: [city-background-poster.webp](../../../../web/public/videos/city-background-poster.webp), 149394 bytes.
- 검증: [작업 기록](../../../../docs/verification/home-unity-background-2026-11-17.md)

기존 건물·도로·나무·공원·하천의 배치를 유지한다. 고정 직교 카메라(48° / -35°, size 255)로 전체 도시를 담는다. 48명의 시민은 기존 Happiness FBX와 NEUTRAL_WALK를 사용하고, 6대의 동일한 기존 택시는 도로 블록을 순환한다. 보행 구간은 기존 v003 경로 후보 주변의 실제 보행 표면과 장애물 검사를 통과한 6m 구간이다. 회차 데이터나 실제 게임 NPC 경로로 사용하지 않는다. 동일 차량은 12초 뒤 다음 차량 자리를 채우며 시민의 위치·걷기 주기도 12초로 맞춘다. 추가 환경 애니메이션은 만들지 않았다.

촬영 Scene의 기존 동작·UI·TextMesh·오디오를 제거한다. 기존 CityClientBootstrap의 자동 서버 클라이언트 생성을 막기 위해 비활성 CityStatePoller를 가드로 저장한다. 이 컴포넌트는 실행·통신하지 않는다. 실제 게임 초기화 코드와 빌드 설정은 수정하지 않는다.

## 다시 촬영할 때

현재 MP4를 사용하는 데 추가 촬영은 필요 없다. 이번 촬영은 기존 `/tmp/simus_v003_validation`의 실제 모델 3개의 SHA-256이 저장소 LFS OID와 일치함을 확인한 뒤 격리된 프로젝트에서 수행했다. 후속 LFS 복구로 원본 프로젝트의 촬영용 모델도 로컬 캐시에서 복원했다. 임시 폴더는 영구 보관본이 아니다. 새 체크아웃에서 모델이 포인터로 보이면 `git lfs checkout`을 사용하고, 캐시가 없으면 `git lfs pull`로 내려받는다.

1. Unity에서 `Assets/SIMUS/Scenes/home_background/HomeBackground.unity`를 열고 Play로 확인한다.
2. 메뉴 `SIMUS > Home Background > 2 Capture 1080p frames`를 실행한다. `unity/Logs/HomeBackgroundCapture/frame-0000.jpg`부터 360장을 저장한다. 메뉴 1은 Scene이 없을 때만 생성하며 기존 촬영 Scene을 덮어쓰지 않는다.
3. 저장소 루트에서 무료 FFmpeg로 변환한다. 기존 영상을 보존하려면 출력 파일을 먼저 다른 위치에 생성한 뒤 확인하고 교체한다.

```sh
ffmpeg -framerate 30 -i unity/Logs/HomeBackgroundCapture/frame-%04d.jpg -frames:v 360 -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p -an -movflags +faststart /tmp/city-background.mp4
```

촬영 Scene 재생성에는 `docs/planning/city_masterplan_v003/routes.json`이 필요하며 캡처 자체는 저장된 Scene만 사용한다. `SIMUS_HOME_ROUTES`와 `SIMUS_HOME_CAPTURE_OUTPUT`으로 경로를 지정할 수 있다. 사용 중인 게임 Scene이나 WebGL 배포 빌드에는 적용하지 않는다.
