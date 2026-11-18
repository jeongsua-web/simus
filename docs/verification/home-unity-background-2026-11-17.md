# Unity 도시 홈 배경 제작 — 2026-11-17

실제 Unity 카메라로 360프레임을 렌더링하고 무료 FFmpeg로 12초 MP4를 제작했다. 유료 AI 서비스·Recorder 설치·WebGL 빌드를 사용하지 않았다.

## 조사와 제작 방식

- 프로젝트: `unity/`, Unity **6000.3.24f1**. Recorder는 `Packages/manifest.json`에 없다.
- 현재 빌드 설정의 장면은 `npc_follow_test/CompletedMapNpcFollow.unity`다. 최근 로컬 v003 빌드는 `CityMasterplanV003LocalBuild.cs`에서 `CityMasterplan_v003_EventPlaces.unity`를 사용한다. 홈 배경에는 이 최근 v003 도시의 배치를 재사용했다.
- 기존 도시에는 여러 직교 카메라와 QualityViewProfile이 있다. 기존 CityPreviewCamera는 추적/조작/UI 동작을 포함하므로 촬영 카메라는 별도로 고정했다.
- 실제 참여 NPC는 WebCityBridge 등 세션 동작과 연결되어 있다. 서버를 사용하지 않는 별도 Transform 이동과 기존 Happiness/NEUTRAL_WALK만 촬영에 사용했다. 기존 차량 에셋은 있으나 홈 촬영에 재사용할 독립 이동 시스템은 확인되지 않아 촬영용 순환 이동을 사용했다.
- 실행 환경에는 Unity가 설치돼 있고 활성 Unity 프로젝트는 없었다. 기존 캐시를 가진 `/tmp/simus_v003_validation`에서 촬영해 원본 프로젝트의 가져오기·설정·실제 Scene을 분리했다. 모델 실파일 3개는 저장소 LFS OID와 SHA-256 일치를 확인했다.
- 촬영: 1920×1080, 30fps, 12초, 360장 JPG quality 95 → libx264 slow/CRF23, 4:2:0, 무음, faststart.
- 48명 시민은 검증된 짧은 보행 표면을 왕복하고 6대 택시는 기존 도로 블록을 순환한다. 시민 위치·걷기 주기와 동일한 택시의 자리 교환이 12초에 맞춰진다. 미세 환경 애니메이션은 추가하지 않았다.
- 기존 CityClientBootstrap은 알 수 없는 장면에서 서버 클라이언트를 자동 생성한다. 촬영 Scene에만 **비활성 CityStatePoller 가드**를 저장해 기존 존재 검사를 통과시키며, 폴러는 실행되지 않는다. 기존 초기화 코드는 수정하지 않았다.

## 생성·수정 파일

신규:

- `unity/Assets/Editor/HomeBackgroundCapture.cs` 및 `.meta`: 별도 Scene 생성, 오프라인 프레임 촬영, Play Mode 검사.
- `unity/Assets/SIMUS/Runtime/HomeBackgroundMotion.cs` 및 `.meta`: 촬영 전용 반복 이동.
- `unity/Assets/SIMUS/Scenes/home_background/HomeBackground.unity` 및 폴더/Scene `.meta`.
- `web/public/videos/city-background.mp4`: **576377 bytes (약 563KiB)**.
- `assets/library/ui/home_city_background_unity_v001/`: 사용 안내와 실제 Unity 첫 프레임.
- 이전 WebP 보존본 `assets/library/ui/home_city_background_v001/previews/city-background-poster-ai.webp`.
- 본 문서와 [기계 판독 검증 자료](home-unity-background-2026-11-17/media.json), [캡처 결과](home-unity-background-2026-11-17/capture.json), [Play Mode 결과](home-unity-background-2026-11-17/playmode.json).

수정:

- `web/public/videos/city-background-poster.webp`: 실제 Unity 첫 프레임으로 교체, **149394 bytes**.
- `assets/manifest.csv`: 이전 포스터의 백업 경로, 영상 received 및 새 Unity 포스터 등록. 기존 원본 기준 해시와 map_version은 변경하지 않았다.
- `assets/library/ui/home_city_background_v001/README.md`: 이전 AI 시도와 현재 촬영본의 관계 기록.
- `assets/catalog/inventory.json`: 카탈로그 생성기로 갱신.

`web/src/app/page.tsx`와 `page.module.css`는 기존 구현이 요구사항을 충족해 이번 작업에서 수정하지 않았다. 요청한 제목·설명·참여 버튼과 중앙 반투명 카드가 유지된다. 자동 재생, muted, loop, playsInline, object-fit:cover, WebP/그라데이션 대체 배경, prefers-reduced-motion 처리가 이미 있다.

작업 시작 전 존재했던 홈/참여/결과/NPC 파일의 수정·이동·삭제는 보존했다. 실제 Unity Scene, 게임 NPC·이벤트 코드, WebGL 배포, API, DB, 관리자·참여 화면은 이번 작업에서 변경하지 않았다.

## 검증 결과

| 검사 | 결과 |
|---|---|
| Unity 촬영 Scene 생성·렌더링 | 성공, 48명/6대, 360프레임 |
| 실제 Unity Play Mode | 진입·보행자 이동 확인, 실행 중인 촬영 외 사용자 동작 없음 |
| 원본 Scene·EditorBuildSettings·Packages manifest SHA-256 | 작업 전후 동일 |
| MP4 전체 디코딩 | 360프레임 정상, 종료 코드 0 |
| 영상 규격 | H.264, 1920×1080, 30fps, 12초, 오디오 트랙 0 |
| faststart | moov가 mdat보다 앞에 위치 |
| 반복 경계 | 시민 t=0/12 위치 오차 0m, 첫/마지막 프레임 PSNR 약 63.79dB |
| Next.js 프로덕션 빌드 | 성공, TypeScript·정적 페이지 생성 통과 |
| 홈 HTML | 요청 문구·링크 존재, 제외할 두 문구 없음 |
| 홈·MP4·WebP HTTP | 200, MP4 video/mp4, WebP image/webp |
| MP4 부분 요청 | 206, Content-Range bytes 0-1023/576377 |
| 브라우저 재생·카드/모바일 시각 검증 | 미실행: Chrome·IAB 모두 browser access host unavailable |
| git diff --check | 통과 |
| 에셋 목록 생성·검사 | LFS 복원 후 둘 다 오류 0건 |

Unity 임시 프로젝트의 SearchDatabase 초기화 예외가 로그에 있었으나, 최종 Play Mode 검증은 이동/분리 검사를 통과하고 정상 종료했다. 브라우저 autoplay·반복·멈춤과 iOS/Android 실기기 재생은 직접 확인하지 못했다. 전체 도시 구도이므로 보행자는 작게 보인다.

## LFS 해시 오류 해결

최초 manifest 오류 310건은 **실제 151개 파일**의 중복 참조였다. 전부 LFS 포인터이며 포인터 OID가 manifest 원본 해시와 일치했다. 필요한 원본 약 638MiB가 모두 `.git/lfs/objects`에 있어, 캐시 실파일 해시를 확인한 뒤 해당 경로만 `git lfs checkout`으로 복원했다. 네트워크 다운로드와 기준 해시 변경은 없었다. 촬영 Scene에 필요한 나머지 모델 2개도 같은 방식으로 복원했다. `python3 scripts/assets/catalog.py`와 `--check`가 모두 통과했다.

## 사용자가 할 일

홈 배경 사용을 위한 추가 촬영·변환은 필요 없다. 브라우저에서 홈을 새로고침해 자동 재생·중앙 카드와 모바일 배치를 확인한다. 재촬영은 [제작 안내](../../assets/library/ui/home_city_background_unity_v001/README.md)의 Unity 메뉴와 FFmpeg 명령을 따른다. 운영 서버 배포는 수행하지 않았다.
