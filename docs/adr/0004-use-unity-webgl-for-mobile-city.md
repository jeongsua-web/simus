# ADR 0004 — 모바일 참여 화면의 3D 도시에 Unity WebGL을 사용한다

| 항목 | 내용 |
| --- | --- |
| 상태 | 채택 |
| 기록일 | 2026-11-18 |
| 모바일 채택일 | 2026-10-08 |

## 배경

SIM:US는 전시장에 회차의 도시를 보여주고, QR로 입장한 관람객은 자신의 휴대폰에서 같은 회차의 도시와 본인 NPC를 본다. 관람객은 앱 설치 없이 브라우저에서 상황을 읽고 선택한다. 도시와 캐릭터를 보여주는 3D 표현, 첫 진입 속도, 휴대폰에서의 안정성이 모두 중요했다. [모바일 경험과 구현 계획](../planning/mobile-experience.md)

9월 16일 연동 규격은 Unity에 도시 시각화를 맡기고, Next.js와 PostgreSQL에 참여 화면·선택 처리·데이터 저장을 맡겼다. 9월 24일에는 Unity 동네 시제품에서 맵·재질·조명·카메라를 검증했다. 9월 29일 기획에서는 모바일에 Three.js 경량 3D를 우선 검증 후보로 올렸다. [Unity 연동 규격](../contracts/unity-integration.md) · [Unity 동네 시제품](../unity-neighborhood/README.md) · [9월 29일 기술 검토](../planning/project-decisions-2026-09-29.md)

## 결정

10월 8일, 모바일 참여 화면에서 Unity WebGL로 3D 도시를 표시하고 본인 NPC를 카메라로 따라가기로 확정했다. 프로필 입력, 상황·선택지 UI, 제출과 결과 조회는 기존 Next.js 웹에서 처리한다. 웹과 Unity는 서버의 회차·NPC 데이터를 공유한다. [10월 8일 확정 기록](../planning/mobile-experience.md#2026-10-08-사용자-확정--첫-접속과-도시-화면) · [웹–Unity 메시지 계약](../contracts/web-unity-bridge.md)

당시 기록을 종합하면, Unity를 모바일까지 쓰는 실용적인 이유는 이미 Unity에서 작업하던 도시 씬, 재질, 카메라를 웹 빌드에도 활용할 수 있다는 점이었다. 모바일용 렌더러를 별도로 만들면 NPC 추적, 애니메이션, 씬 표현도 웹에서 다시 구현해야 했다. [시제품 검증 범위](../unity-neighborhood/verification.md) · [당시 렌더러 검토](../planning/project-decisions-2026-09-29.md)

### Unity · Godot · Three.js 비교

아래 비교는 당시 기획·구현 기록과 각 기술의 공식 문서를 바탕으로 재구성했다.

| 선택지 | SIM:US에서의 이점 | SIM:US에서 드는 비용 |
| --- | --- | --- |
| Unity WebGL | 기존 Unity 씬과 카메라, NPC 표현을 브라우저에서도 활용할 수 있다. | 모바일에서 WebAssembly 런타임과 씬 데이터를 초기화해야 한다. 실제 v003 빌드에서는 크기와 초기 메모리가 부담이 됐다. [Unity Web 문서](https://docs.unity.com/en-us/engine/6000.3/manual/platform-specific/webgl/intro) · [v003 빌드 기록](../verification/v003-unity-build.md) |
| Godot 4 | 씬 편집기를 갖춘 게임 엔진으로, 브라우저용 빌드를 내보낼 수 있다. | 9월 연동 기록상 `godot/`은 빈 폴더였다. 도입하려면 씬과 NPC 연동을 새로 작업하고, WebAssembly·WebGL 2.0의 Compatibility 렌더러에서 모바일 동작을 검증해야 했다. [당시 저장소 조사](../contracts/unity-integration.md) · [Godot Web 내보내기 문서](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html) |
| Three.js | Next.js 참여 화면에서 캔버스와 HTML 선택 패널을 함께 구성하고, Blender GLB를 구역별로 나눠 첫 화면에 필요한 부분부터 불러올 수 있다. | 카메라 추적, 서버 위치 보간, Unity에서 쓰던 도시 연출을 웹에서 구현해야 한다. 자산 크기와 화면에 그릴 오브젝트 수도 따로 관리해야 한다. [9월 29일 경량 3D 제안](../planning/project-decisions-2026-09-29.md) · [Three.js 모델 로딩 문서](https://threejs.org/manual/pages/loading-3d-models.html) |

## 영향과 회고

- v002 개발 회차에서 실제 브라우저로 본인 NPC 이동·정지, 웹 선택 제출, 이동 재개와 종료까지 연결했다. Unity 씬과 웹 참여 흐름을 함께 쓸 수 있다는 점을 확인했다. [v002 통합 검증](../verification/city-rebuild-v002-session-integration.md)
- v003 로컬 테스트의 첫 Chrome 실행은 초기 WebAssembly 힙 32 MiB 설정에서 메모리 부족으로 실패했다. 512 MiB로 재빌드한 뒤 도시와 NPC는 로드됐다. 재빌드의 산출물 7개는 합계 약 210 MB였다. 512 MiB는 초기 힙 설정값이며, 210 MB는 파일 합계다. [v003 빌드·메모리 기록](../verification/v003-unity-build.md) · [v003 독립 QA](../verification/v003-local-qa.md)

지금 돌아보면 **QR로 들어오는 모바일 도시 화면은 처음부터 Three.js로 만들 걸 그랬다.** 전시장 화면에는 Unity의 씬 제작 도구가 유용했다. 휴대폰에서는 QR을 찍고 내 캐릭터를 바로 보는 경험이 더 중요했다. 전시장 쪽은 Unity로 제작하고, 모바일은 가벼운 GLB와 캐릭터 추적, HTML 선택 패널로 시작했으면 첫 화면에 필요한 자산과 초기 로딩을 더 직접 조절할 수 있었을 것이다.

Three.js의 실제 개선 폭은 동일한 도시 구역과 NPC를 같은 Android·iPhone에서 재현해 첫 캐릭터 표시까지의 시간, 전송량, 메모리, 지속 프레임을 비교해야 알 수 있다. 현재 채택 기록은 Unity WebGL이며 Three.js는 모바일 렌더러 재검토 후보로 남긴다.
