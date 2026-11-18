# Home city background v001

- 용도: `/` 홈 화면의 장식용 배경. Unity·전시 맵·좌표·NPC 경로와 무관하다.
- 상태: `received`. AI 생성 정적 이미지이며 전시 승인·라이선스 별도 검토는 미실행.
- 원본: [city-poster.png](source/city-poster.png), built-in ImageGen, 2026-11-17.
- 이전 웹 배포본 백업: [city-background-poster-ai.webp](previews/city-background-poster-ai.webp), Sharp quality 80 / effort 6, 1672×941, 173286 bytes.
- 생성 프롬프트: [poster-prompt.txt](poster-prompt.txt).
- 영상 프롬프트: [video-prompt.txt](video-prompt.txt).

## 최초 AI 영상 시도 기록 (현재 배포본은 Unity 촬영)

후속 사용자 요청에 따라 유료 AI 영상을 사용하지 않고 [Unity 촬영본](../home_city_background_unity_v001/README.md)을 제작·적용했다. 이 문서의 이미지·프롬프트와 아래 실패 기록은 이전 제작 이력이며 현재 배포본은 아니다.

Higgsfield Seedance 2.5에 8초·1080p·16:9·무음 생성을 요청했으나 `Requires plus plan or higher.`로 거절되어 작업이 제출되지 않았다. 사전 견적은 128 credits, 조회 당시 잔액 7.73 credits / free plan이었다. 사용 가능한 무료 Genjutsu 1회는 동작 전이/대상 교체 모델용이며 본 text-to-video 요청과 다르다. 생성 결과나 MP4는 없다.

## 후속 영상 연결

사용자가 이용 가능한 영상 생성 도구에서 video-prompt.txt와 정적 원본을 참고해 제작한 영상을 전달하면, H.264 MP4·16:9·1920×1080 권장·5~10초·30fps·오디오 트랙 없음·faststart로 최적화하고 `web/public/videos/city-background.mp4`에 저장한다. 반복 경계에서 시민·차량·나무·카메라가 튀지 않는지 직접 확인한다. 정지 이미지를 MP4로 포장한 파일은 생성하지 않는다.

영상 등록 시 manifest의 planned 행에 실제 원본/배포본 경로와 SHA-256을 입력하고, 실기기 autoplay/반복 재생/멈춤/동작 줄이기/재생 실패 검증 후 catalog 생성·검사를 다시 실행한다. 현재 홈은 영상이 없으면 WebP, WebP도 실패하면 그라데이션을 표시한다. 서버 렌더와 JavaScript 비활성 상태에도 카드와 링크, 정적 배경을 표시한다.
