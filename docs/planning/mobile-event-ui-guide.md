# 모바일 수동 이벤트 UI — 프론트엔드 팀원 작업 가이드

2026-11-10. 이 가이드는 별도 **UI 전용 GitHub 저장소에서의 향후 개발**을 위한 것이다. 이번 문서 작성 작업에서는 저장소 생성·UI 구현·commit/push·배포를 수행하지 않는다.

읽는 순서: [기존 코드 분석](mobile-event-ui-analysis.md) → [컴포넌트/타입 명세](mobile-event-ui-spec.md) → 이 가이드. 문서의 신규 파일 경로와 포트는 제안이며 실제 서버 API가 아니다.

## 1. 담당 범위

| 담당 | 작업 |
|---|---|
| UI 팀원 | 웹 시작 버튼, 이동 중 상태, 기존 선택 카드 기반 선택 패널, 이벤트별 결과 모달, 오류/마감/소진 UI, 모바일 CSS, Mock 포트·fixture·개발용 시나리오 화면, UI 검증 |
| 메인 웹 통합 담당 | 인증·입장·회차 화면 보존, `useParticipation`과 단일 이벤트 컨트롤러 연결, 실제 HTTP 어댑터, pending 저장 형식 통합, `UnityCity` 준비 상태 전달, 이벤트·NPC 폴링 정합성 |
| 서버 담당 | 수동 시작/선정/도착/실패/결과/확인 권위 상태, 모든 자동 발생 경로 변경, 멱등성·다중 탭·마감 처리, 이벤트별 스탯 결과 제공·복구 |
| Unity 담당 | 기존 스냅샷 이동/정지/재개 표현 검증, 새 맵·경로 검증. 필요 시 브리지 확장 협의 |
| 제품/콘텐츠 담당 | 마감·소진·반복·실패 정책, 결과 문구, 새 맵과 배치 승인 |

팀원은 Unity 맵·이동 알고리즘·PostgreSQL 스키마·서버 이벤트 선정·스탯 계산·실제 서버 배포를 담당하지 않는다. UI 저장소에서 실제 API를 흉내 내는 Next route handler를 만들 필요도 없다. HTTP 없는 주입형 Mock 포트로 개발한다. 결과 수치는 정해진 fixture를 표시한다.

## 2. 구현할 화면

| 화면 | 내용 및 액션 |
|---|---|
| 초기 로딩 | 참여 데이터 자리와 로딩 문구. 시작 비활성 |
| idle | 도시 자리, 자유 이동 안내, **새로운 상황 만나기**. 눌렀을 때 즉시 요청 잠금·접수 중 표시 |
| moving | 도시 자리, “새로운 상황을 만나러 이동 중이에요”, 제공된 장소명. 시작 비활성. 지연 시 상태 확인 |
| event | 제목·설명·라디오·선택 후 변경 불가·선택 제출. 미선택/제출 중/미확인 요청 상태 구별 |
| result | 해당 선택의 서버 적용 시점 결과, 도시 증감, 개인 공개/비공개 문구, 확인 버튼. 확인 응답 전 모달 유지 |
| error | 마지막 정상 상태와 이해 가능한 오류, 상태 확인/동일 요청 재확인/재입장 안내. 새 이벤트 생성 잠금 |
| 마감/소진 | 시작 비활성, 마감 또는 만날 상황 없음. result 중 마감이면 결과를 유지. 기존 회차 결과 링크는 통합 담당 제공 |

도시 자리는 `MockCityViewport`로 대체한다. 시민증·프로필·메뉴 전체를 다시 만들지 않는다. `identitySlot`에 샘플 닉네임과 간단한 메뉴 자리만 전달한다. 실제 Unity·회차 종료 결과 페이지가 없더라도 위 모든 UI를 확인할 수 있어야 한다.

## 3. 작업 시작 자료와 환경

인계할 실제 파일:

- `web/package.json`과 `web/package-lock.json`: 기준 버전/잠금 파일. 존재하는 lockfile을 함께 사용한다.
- `web/src/app/participate/SituationCard.tsx`, `types.ts`, `participate.module.css`: 선택 카드와 스타일의 기준. props 타입 공유를 위한 최소 수정은 허용하되 제출 잠금·접근성 동작을 유지한다.
- `web/src/app/components/CityStats.tsx`, `CityStats.module.css`: 필요 시 순수 `CityStats` 부분만 사용. Mock에서 `LiveCityStats`를 렌더링하지 않는다.
- 이 문서 3개. 기존 `UnityCity.tsx`, `unity-bridge.ts`, `useParticipation.ts`는 책임 경계를 이해할 참고 자료이며 Mock 실행 의존성으로 가져오지 않는다.

새 UI 저장소는 Next App Router + React + TypeScript + CSS Modules로 구성한다. 메인 `web/AGENTS.md`에 따라 향후 코드 작성 전 설치된 Next 버전의 `node_modules/next/dist/docs/` 관련 가이드를 확인한다. 별도 저장소에는 UI 구동에 불필요한 pg/web-push/DB 설정을 요구하지 않는다. 기존 모듈을 통째로 복사해 서버 의존성을 끌어오지 않는다.

제안 구조(전부 향후 생성):

```text
src/app/layout.tsx
src/app/page.tsx                       Mock 진입/시나리오 선택
src/app/participate/SituationCard.tsx   기존 카드 재사용
src/app/participate/types.ts           필요한 순수 타입
src/app/participate/participate.module.css
src/features/mobile-events/
  contracts.ts                        명세의 공유 타입/포트
  CityGameHUD.tsx
  EventStartButton.tsx
  NpcMovementStatus.tsx
  EventDialog.tsx
  EventResultModal.tsx
  MockCityViewport.tsx
  mobile-events.module.css
  useEventUiController.ts             제안: 명령 잠금·상태 조회·복구
  mock/createMockEventPort.ts
  mock/fixtures.ts
README.md
```

`@/*`는 src 기준으로 설정한다. 포트는 페이지/컨트롤러 생성 시 한 번 주입하고 렌더마다 새 Mock 인스턴스를 만들지 않는다. 개발용 시나리오를 바꿀 때 기존 타이머를 dispose하고 상태를 초기화한다. `adapters/createHttpEventPort.ts`는 메인 통합에서 작성할 파일이며 UI 납품 필수 파일이 아니다.

## 4. 권장 구현 순서

1. 기준 코드와 타입을 고정하고 Mock만 실행하는 Next 진입 화면을 만든다. 화면 진입 시 서버 요청이 없는지 먼저 확인한다.
2. contracts/fixtures/Mock 포트를 만든다. idle→moving→event→result→idle과 요청 키 재전송을 UI 없이 확인할 수 있게 한다. 실제 선정·스탯 계산을 만들지 않는다.
3. 기존 SituationCard를 가져와 긴 한글·선택지·제출 잠금·재시도 상태를 렌더링한다. EventDialog는 패널 역할만 추가한다.
4. EventStartButton과 NpcMovementStatus를 만든다. 클릭 직후 잠금, 장기 이동 안내, 상태 확인을 연결한다.
5. EventResultModal을 만든다. delta의 +/−/0, 개인 비공개, 정보 미제공, 확인 요청 오류, 키보드 포커스를 구현한다.
6. CityGameHUD와 컨트롤러를 연결한다. revision/실행 ID/세션 교체·응답 순서·미확인 요청을 처리한다. 개발용 시나리오 선택기를 붙인다.
7. 모바일·접근성 검증 후 README에 실행법·시나리오·변경 파일·남은 서버 의존성을 기록하고 통합 묶음을 납품한다.

## 5. 테스트 방법과 예상 결과

아래는 **향후 UI 저장소에서 실행할 검증**이다. 이번 문서 작업에서 실행하거나 통과한 UI 테스트가 아니다. README에는 패키지 관리자와 확정된 스크립트를 적는다. 메인에는 `test:ui` 스크립트가 없으므로 기존 명령처럼 안내하지 않는다.

설치 후 `npm run dev`로 Mock 페이지에 접속한다. `npm run lint`, `npx tsc --noEmit`, `npm run build`로 정적 오류와 빌드 상태를 확인한다. 네트워크 탭에서 Next 개발 리소스 이외에 `/api/*`, Unity build.json/wasm/data, 외부 서버 호출이 없어야 한다. 인터넷/백엔드 없이도 설치 완료된 프로젝트의 화면과 모든 시나리오가 동작해야 한다.

| 검증 | 절차 | 기대 결과 |
|---|---|---|
| 정상 반복 | 시작→Mock 도착→선택→제출→결과→확인→다시 시작 | 순서 준수. 확인 전 시작 불가. 새 실행에 이전 라디오/메시지 없음 |
| 선택 잠금 | 미선택 제출 시도, 제출 중 선택 변경 | 미선택 제출 불가, 진행 중 변경 불가 |
| 시작 중복 | 빠르게 10회 탭 | start 한 번, 진행 실행 1개 |
| 선택 중복/유실 | submit 처리 뒤 응답 유실→재확인 | 같은 requestKey/payload, 결과 1개·재적용 없음 |
| 시작 유실 | start 처리 뒤 응답 유실→read/replay | 새 실행/새 키 생성 없이 기존 실행 복구 |
| 확인 유실 | confirm 처리 뒤 응답 유실→재확인 | 같은 키로 복구, 결과/스탯 중복 없음 |
| 이동 지연/실패 | delayed fixture 및 이동 실패 주입 | 안내와 상태 확인. 타이머로 선택창 열지 않음 |
| 새로고침 | moving/event/result 초기 fixture로 재접속 | 해당 단계 복구. result를 idle로 버리지 않음 |
| 오래된 응답 | 낮은 revision의 read를 명령 응답 뒤 반환 | 최신 phase/결과 유지 |
| 회차 변경 | 이전 세션 read 진행 중 세션 교체 | 이전 응답 무시, 임시 선택 정리 |
| 마감/소진 | gate closed/exhausted fixture | 시작 잠금과 서로 다른 안내. 기존 결과 유지 |
| 인증/도시 오류 | reenter 문제 또는 scene error | 시작 잠금, 적절한 복구 안내 |
| 스탯 | +1/0/−1, 상한 적용, regions null | 서버 fixture 그대로. 즉시 결과에는 도시 스탯 변화만 표시. null을 0으로 표시하지 않음 |
| 모바일 | 320/375/390/430px, 가로·낮은 높이·200% 확대 | 본문 스크롤, actionDock 접근, 가로 넘침 없음 |
| 키보드/낭독 | Tab/방향키/Enter, 결과 포커스·Escape | 라디오 조작 가능, 모달 포커스 유지, 확인 전 닫힘 없음, 상태 과다 낭독 없음 |

자동화가 가능한 경우 Mock의 지연/시계 제어로 정상 흐름·중복 클릭·응답 유실·낮은 revision 무시·결과 확인 실패 유지·키보드 모달 동작을 검증한다. UI Mock 테스트 통과는 실제 서버 멱등성·Unity 도착·성능 검증을 대신하지 않는다.

## 6. UI 팀원 완료 기준

- 초기 로딩/5개 상태/마감/소진/미확인 요청을 시나리오 화면에서 독립 재현할 수 있다.
- 버튼과 선택/결과가 실제 DOM이고 Unity·서버·DB·인증 키 없이 실행된다.
- SituationCard를 재사용하고 기존 props의 제출·재시도 잠금을 잃지 않는다.
- 모든 외부 효과는 주입된 포트/컨트롤러로 모이며 표시 컴포넌트에 fetch/postMessage가 없다.
- 시작·제출·확인 동시 실행 방지와 동일 요청 복구, 실행별 선택 초기화가 동작한다.
- 모바일/키보드/오류 확인이 끝나고 lint·타입·build 결과와 미확인 항목이 README에 기록된다.
- `.env` 실자격증명, DB migration, Unity 자산, 서버 알고리즘, 배포 변경이 없다.
- 납품에는 소스·lockfile·fixture·실행 README·화면별 캡처 또는 재현 절차·알려진 한계가 있다. node_modules/빌드 산출물/Unity 사본은 포함하지 않는다.

## 7. 메인 프로젝트 통합 절차

1. 통합 담당이 납품 기준선과 메인 작업 트리의 변경을 비교한다. 현재 진행 중인 참가자 NPC 경로 변경을 덮어쓰지 않는다. 폴더 통째 교체 대신 파일별 차이를 반영한다.
2. `src/features/mobile-events`를 `web/src/features/mobile-events`로 옮긴다. SituationCard/types/CSS는 메인 기존 파일과 병합한다. 기존 RootLayout·전역 CSS·프로필·시민증·푸시·인구·최종 결과 화면을 보존한다.
3. `participate/page.tsx`의 입장 후 게임 영역을 HUD로 조립하고 `citySlot`에 실제 UnityCity, `identitySlot`에 기존 헤더·메뉴를 전달한다. `UnityCity`가 현재 외부 준비 상태 콜백을 제공하지 않는 점을 처리한다.
4. 서버 담당과 포트의 실제 DTO/endpoint·멱등성·오류·result 지속 계약을 확정하고 HTTP 어댑터를 만든다. 쿠키 same-origin 인증과 변경 요청의 origin 검사를 기존 방식에 맞춘다. UI 팀원에게 운영 API 키나 관리자 API를 넘기지 않는다.
5. 이벤트 폴링 소유자를 하나로 정하고 기존 `useParticipation`의 인증·입장·응답 복구와 결합한다. 선택 pending의 기존 저장 형식과 신규 start/confirm 저장 형식을 안전하게 병합한다. 기존 pending을 조용히 삭제하지 않는다.
6. 서버 자동 발생 진입점 전체가 수동 정책으로 전환되었는지, 선택 제출 뒤 result에서 정지하는지, 확인 후에만 재개되는지 검증한다. 기존 event GET 또는 npc GET이 자동 시작을 유발하면 통합 완료가 아니다.
7. 웹 정적 검증 후 준비된 테스트 회차에서 실제 API/Unity의 이동·도착·제출·결과·확인·다중 탭·재접속·마감 경합을 검증한다. 실제 지도·경로 버전 일치도 확인한다. DB/Unity 검증은 해당 담당자가 수행한다.
8. UI 개발용 Mock/시나리오 화면이 실제 참여 경로에 노출되지 않게 한다. 운영에서 API 실패 시 Mock으로 자동 전환하지 않는다. 실제 배포는 별도 작업이다.

## 8. 실제 연결 전에 확정할 사항

| 결정 | 제안 기본값 / 미확정 내용 | 결정 주체 |
|---|---|---|
| 적용 범위 | 신규 회차에 수동 모드 적용 우선. 진행 회차 전환·정책 버전 방식 미확정 | 서버/운영 |
| 시작·조회·결과·확인 API | 포트 요구는 명세에 정의. URL·method·DTO·오류는 미확정 | 서버/통합 |
| 결과 지속·이동 재개 | 결과 확인까지 서버 정지, 확인은 멱등·스탯 재계산 없음 | 서버/Unity |
| 이동 실패 | 도달 불가·속도 0·타임아웃의 취소/재경로/재시작 정책 및 서버 제한시간 | 서버/제품 |
| 개인 스탯 | 현행 성향 축은 회차 종료 공개. 기본 withheld. 즉시 공개 또는 새 지표 도입 여부 | 제품/서버 |
| 결과 표현 | 도시 실제 적용 delta 필수. 지역 오염 표시·문구 출처·반올림 자리수 확정 | 제품/서버 |
| 소진/반복 | 현행은 미응답 상황을 우선 선택. 모두 응답한 뒤 exhausted 기본 제안, 반복 여부 | 제품/콘텐츠 |
| 마감 중 처리 | 새 시작 차단. 진행 중 이동/선택 종료·접수된 결과 확인 허용 범위 | 서버/제품 |
| 도착 표시 | 서버 도착 권위 유지. Unity 표시 지연 허용 폭·시각적 동기화 방식 | 웹/Unity |
| 새 전시 지도 | 승인 map_version/place_id/30개 배치/경로/지역 경계. 테스트 좌표 전용 금지 | 맵/콘텐츠 |

위 결정이 끝나기 전에도 팀원은 Mock UI를 완성할 수 있다. 그때의 완료 범위는 UI 납품이며 실제 이벤트 시스템 통합 완료와 구분한다.
