# 홈 배경 — 가까운 도시 순회 구도 미리보기

2026-11-17 사용자 답변을 반영한 **정지 화면 검토본**. 실제 Unity 6000.3.24f1로 렌더링했다. 현재 홈의 MP4·포스터·카드와 실제 게임 Scene은 교체·수정하지 않았다. `received`이며 구도 승인과 최종 영상 제작은 대기 중이다.

- [가로·세로 / 카드 표시 비교](previews/index.html), 로컬 서버 실행 중: `http://127.0.0.1:3148/`
- [세 구도 한눈에 보기](previews/framing-contact-sheet.jpg)
- [상점 거리](previews/01-shopping-street.jpg) · [캠퍼스](previews/02-campus.jpg) · [공원 옆 거리](previews/03-park-neighbourhood.jpg)
- [카메라 시야 검사](previews/framing.json)
- 재현 도구: [HomeBackgroundCinematicPreview.cs](../../../../unity/Assets/Editor/HomeBackgroundCinematicPreview.cs)
- 가장자리 처리: [EdgeSoftness.shader](../../../../unity/Assets/SIMUS/Scenes/home_background/EdgeSoftness.shader)

## 사용자 답변과 반영

- 기존 영상의 먼 거리·지도 같은 시점·작은 건물/사람·어두운 조명·잘 보이지 않는 움직임을 개선한다.
- 영화 같은 분위기, 한 구역을 가까이 담는 시점으로 전체 도시를 순회한다. 맵 외곽은 보이지 않도록 한다.
- 동물의 숲 정도의 낮은 각도, 약한 원근감, 움직이는 카메라. 중앙 카드 주변 구도는 제작 판단에 맡김.
- 부드러운 오전 조명, 기존 에셋의 밝고 선명한 색감, 화면 가장자리만 약하게 부드럽게 처리한다.
- 시민이 걷는 것이 알아보이는 크기. 일반 차량·버스·택시를 섞은 일상적인 교통.
- 건물·도로·나무 등 기존 도시 배치는 유지한다.
- 모바일은 같은 영상의 중앙을 세로 화면에 맞춰 자른다.
- 가까운 시점에서 여러 구역을 순회할 영상 길이는 30초/45초/기존 10~15초 중 질문을 보냈으며 아직 확정하지 않았다.

현재 정지 화면은 세 개의 구도를 보여주는 검토 자료다. 연속 카메라 이동, 이동 중 전체 프레임의 경계 검증, 혼합 차량의 주행, 최종 MP4 제작은 구도 확인 뒤 진행한다.

## 실제 촬영 설정

1920×1080. Perspective FOV 27°, pitch 34°. 거리 90~100m. 카메라 focus target/yaw는 framing.json에 있다. 원본 장면의 조명·카메라·시민 경로를 메모리에서만 바꾸고 저장하지 않는다. 도로·건물·공원·나무 배치를 유지한다.

기존 시민 48명을 436개의 지원 표면/장애물 검사를 통과한 보행 후보 중 세 촬영 구역 주변에 배분했다. 기존 모델에서 일반 차량·택시·버스를 재사용했다. 이 검토본의 차량은 위치/종류 예시이며 주행 검증은 아직 하지 않았다. UI/서버/게임 동작은 실행하지 않았다.

세 구도의 ground-plane 시야 모서리 네 점이 모두 기존 v003 외곽 폴리곤 안에 있고 경계에서 8m 이상 떨어졌음을 검사했다. 이는 현재 정지 구도에 대한 검사이며, 아직 생성하지 않은 순회 경로의 모든 프레임에 대한 검증을 의미하지 않는다.

브라우저 연결 도구의 탭 API는 사용할 수 없었지만, Chrome 네이티브 UI로 비교 페이지를 열어 가로 카드 화면·390×844 세로 크롭·구도 전환을 확인했다. iframe은 현재 홈의 page.module.css와 문구를 복사해 보여주며 실제 홈 페이지를 수정하지 않는다.

## 다시 보기

Unity 메뉴 `SIMUS > Home Background > 3 Preview cinematic framing`. 저장한 촬영 Scene `HomeBackground.unity`와 기존 routes.json이 필요하다. 출력 기본값은 `unity/Logs/HomeBackgroundCinematicPreview/`다. 격리된 프로젝트에서 실행할 때는 `SIMUS_HOME_ROUTES`와 `SIMUS_HOME_CINEMATIC_OUTPUT`으로 경로를 지정한다.

로컬 비교 페이지를 다시 열려면 저장소 루트에서:

```sh
python3 -m http.server 3148 --bind 127.0.0.1 --directory assets/library/ui/home_city_background_cinematic_v001/previews
```
