# 모바일 수동 이벤트 UI — 기존 코드 분석

조사일: 2026-11-10. 저장소 작업 트리의 실제 코드를 정적으로 조사했다. 실행 중인 서비스·DB·배포된 WebGL의 동작 검증 결과가 아니다. 이번 납품은 문서뿐이다.

함께 읽기: [컴포넌트 명세](mobile-event-ui-spec.md), [팀원 작업 가이드](mobile-event-ui-guide.md).

## 1. 조사 기준과 주의사항

- 루트 `AGENTS.md` 및 `docs/content/new-map-handoff-5a.md`가 우선한다. Neighborhood 자료는 이전 시제품이다. 새 전시 맵 버전·30개 상황 좌표·경로·지역 경계를 확정한 것으로 취급하지 않는다.
- `web/src/lib/data/city-v002-phase1-event-locations.json`에는 테스트 배치가 있으나 `exhibition_ready: false`다. 코드에 매핑이 존재한다는 사실과 전시 승인 여부를 구분한다.
- 조사 시작부터 `web/src/lib/participant-npcs.ts`, `web/src/lib/session-build-readiness.ts`, 관리자 화면·DB 관련 파일 등에 기존 미커밋 변경이 있었다. `web/src/lib/participant-npc-motion.ts`도 미추적 상태였다. 아래 내용은 이를 포함한 현재 작업 트리 기준이며 commit된 기준선과 다를 수 있다. 기존 변경은 수정하지 않았다.
- 다음 문서의 **제안 경로·타입·인터페이스는 미구현**이다. 현재 API와 섞어 해석하지 않는다.

## 2. App Router와 참여 UI

모든 경로는 저장소 루트 기준이다.

| 실제 경로 | 구현 상태와 책임 | 재사용/변경 판단 |
|---|---|---|
| `web/package.json` | Next `^16.3.8`, React `19.2.8`, TypeScript, CSS Modules. dev/build/start/lint, integration 스크립트 존재 | 버전은 lockfile과 함께 인계. Tailwind·공용 UI 프레임워크 의존성 없음 |
| `web/src/app/layout.tsx`, `globals.css` | 한국어 루트, 메타데이터, 기본 reset·전역 색상·다크 모드 | 유지. 참여 CSS는 별도 light scheme |
| `web/src/app/page.tsx` | 루트 화면 | 이벤트 HUD의 구현 위치 아님 |
| `web/src/app/participate/page.tsx` | Client Component. 로딩/인증 오류/회차 없음/프로필 입장/도시 화면 분기. 헤더·시민증 메뉴·도시·하단 선택 패널을 직접 조립 | 게임 부분을 `CityGameHUD`로 추출 가능. 입장·지난 회차·마감 분기 보존 |
| `web/src/app/participate/useParticipation.ts` | 참가자 인증 준비, 회차·프로필·응답·이벤트 조회, 선택·제출·미확인 요청 저장/복구. 표시 중 2.5초 폴링, online/visibility 복귀 조회 | 인증·제출 복구 원리 재사용. 수동 시작/결과 확인 액션은 없음 |
| `web/src/app/participate/types.ts` | `Session`, `Situation`, `Choice`, `Submission`, `EventState` 등 | 실제 DTO의 출발점. 이벤트 결과 타입은 없음 |
| `web/src/app/participate/SituationCard.tsx` | 라디오 선택, 별도 제출 버튼, 제출 중/마감/완료/재시도 메시지. 단일·전체 제출 잠금과 pending 잠금 | **선택지 본체 그대로 재사용 우선** |
| `web/src/app/participate/pending.ts` | 브라우저의 미확인 선택 제출 읽기 | 요청 키 보존·복구 방식 유지. 새 액션은 별도 종류로 구별 필요 |
| `web/src/app/participate/ProfileEntry.tsx`, `CitizenCard.tsx`, `PushOptIn.tsx`, `Population.tsx` | 입장 프로필·시민증·푸시 허용·인구 표시 | 통합 시 유지. 팀원의 재개발 대상 아님 |
| `web/src/app/participate/CityTrack.tsx` | 별도 웹 도시 렌더러 코드 존재 | 현재 `page.tsx`는 `UnityCity`를 import. 이 파일을 현행 WebGL 화면으로 오인하지 않음 |
| `web/src/app/result/[id]/page.tsx`, `ResultClient.tsx` | 회차 최종 개인 성향·도시·공유 링크 화면 | 이벤트 직후 결과 모달이 아님. 통째로 재사용하지 않음 |
| `web/src/app/components/CityStats.tsx`, `CityStats.module.css` | 순수 `CityStats`와 API를 폴링하는 `LiveCityStats`가 함께 존재 | 도시 **절대값** 표시만 순수 컴포넌트 재사용 가능. 이벤트 증감 표시 추가 필요 |

현재 헤더는 별도 `CityGameHUD` 컴포넌트가 아니다. 시작 버튼, 독립 `NpcMovementStatus`, `EventDialog`, `EventResultModal`, `EventConfirmModal` 이름의 구현도 현재 참여 코드에 없다. 이동 안내 문구는 `page.tsx`의 빈 상황 패널에 이미 있다.

## 3. 현재의 실제 이벤트 흐름

1. `useParticipation`이 입장한 사용자의 `GET /api/sessions/{id}/event`를 조회한다.
2. `web/src/app/api/sessions/[id]/event/route.ts`는 인증·회차 잠금 후 `advanceEvent`를 실행한다. **GET이지만 서버 이벤트 상태를 전진시킨다.**
3. `web/src/lib/npc-events.ts`의 `transitionFor`는 응답 이력으로 미응답 상황을 고르고, `scanPlace`로 경로상의 장소 진입을 검사한다. 같은 장소의 occupancy·entry_seq를 추적한다. 후보 중 최초 진입 시점에 해당하는 상황을 선정한다.
4. 대기 60초 이후 적격 장소를 향한 안내 이동을 설정한다. 90초 초과는 `overdue` 추적이며, 현재 함수에는 이 시점에 무조건 이벤트를 생성하는 분기가 없다. `trigger_kind` 타입에 `DEADLINE`이 남아 있어도 이 함수의 실제 생성은 `LOCATION`이다. `deadline_at`은 현재 null이다.
5. 응답 phase는 `WAITING / GUIDING / ACTIVE / CLOSED`. 클라이언트는 `ACTIVE`일 때만 선택지를 표시한다. `EventState` 클라이언트 타입에는 서버가 더 내려주는 `guidance_at`, `overdue_since`, `overdue`가 선언되지 않았다.
6. `POST /api/choices`는 서버 트랜잭션에서 선택 검증·스탯 계산·기록·`completeEvent`를 처리한다. **제출 성공 시 이미 이벤트 완료와 이동 재개가 처리된다.** 결과 확인을 기다리는 상태는 없다.
7. 훅은 성공 뒤 `eventState`를 비우고 다시 조회한다. 결과 모달 대신 응답 완료 처리 후 다음 대기로 넘어간다.

추가 진입점: `web/src/lib/participant-npcs.ts`의 `readNpcs`도 `syncNpcEvents`를 호출한다. `npc-events.ts`의 `reconcileNpcEvents`도 같은 자동 전이를 수행한다. 따라서 시작 버튼만 추가하거나 이벤트 GET 폴링만 중지해도 자동 발생이 제거되지 않는다. 수동 모드 적용 시 이 경로들을 서버 담당자가 일관되게 변경해야 한다.

## 4. Unity WebGL과 NPC 상태 소유

| 실제 경로 | 확인한 역할 |
|---|---|
| `web/src/app/participate/UnityCity.tsx` | 본인 NPC 조회 → build.json 검증 → 같은 origin iframe 생성. 2.5초 NPC 동기화, 180초 초기 연결 제한, 지도·경로 버전 검사, 재연결·줌 UI |
| `web/src/app/participate/unity-bridge.ts` | channel `simus-city`, version 1, bridge_id 검사. 수신은 `READY / BOUND / ERROR / ZOOM_CHANGED`만 허용 |
| `web/public/city-rebuild-v002-phase1/bridge.js` | iframe wrapper. INIT/SNAPSHOT 등을 Unity `SendMessage`로 전달 |
| `unity/Assets/SIMUS/Runtime/Core/WebBridgeState.cs` | Unity 측 브리지 상태 코드 |
| `unity/Assets/SIMUS/Runtime/NpcCrowdPoller.cs` | NPC 스냅샷의 epoch·motion·revision·freeze 값 해석 및 렌더링 갱신 |
| `web/src/app/participate/npc-motion.ts` | `Npc`, `NpcSnapshot`, 시간 기반 polyline 위치 계산. 경유점·속도·loop 기반 |
| `web/src/lib/participant-npcs.ts` | 서버에서 안내·재개·정지 상태를 NPC 스냅샷으로 투영. 활성 이벤트에서는 동일 점 2개와 speed 0으로 정지 표현 |
| `web/src/lib/npc-graph-motion.ts`, `npc-place-trajectory.ts` | 안내/복귀 경로와 경로상의 장소 진입 계산 |
| `web/src/lib/participant-npc-motion.ts` | 현재 작업 트리에 있는 참가자별 경로 생성 코드. 별도 진행 변경이므로 통합 기준 재확인 필요 |
| `web/src/lib/city-builds.ts` | 테스트 map_version별 `/city-rebuild-v002-phase1`, `/city-rebuild-v002`, 기본 `/city` 경로 선택 |

부모 웹 송신은 `INIT / SNAPSHOT / VISIBILITY / DISPOSE / SET_ZOOM`. 수신 origin·iframe source·bridge_id를 확인한다. 현재 `ARRIVED`나 `START_EVENT` 메시지는 없다. 이동은 Unity의 독립적인 게임 판정이 아니라 서버의 시간·경로 스냅샷을 시각화하는 구조다. 새 UI는 위치 계산이나 가짜 Unity 도착 메시지로 `event`를 열지 않는다. 연결 제한 180초는 **WebGL 준비 제한**이며 NPC 이동 타임아웃으로 재사용하지 않는다.

## 5. 현재 API 및 타입 경계

| 기존 API | 실제 구현 파일 | 현재 계약과 한계 |
|---|---|---|
| `POST/GET /api/participants` | `web/src/app/api/participants/route.ts` | 익명 참가자 준비/본인 참여 기록. 실제 인증은 쿠키 기반 |
| `GET /api/sessions/current` | `web/src/app/api/sessions/current/route.ts` | 현재 회차·상황. `accepting_choices`를 존중 |
| `GET/POST /api/sessions/{id}/profile` | `web/src/app/api/sessions/[id]/profile/route.ts` | 프로필 확인/입장. 기존 화면 흐름 유지 |
| `GET /api/sessions/{id}/event` | `web/src/app/api/sessions/[id]/event/route.ts` | 위 4개 phase. 수동 시작 POST 없음 |
| `GET /api/sessions/{id}/npc` | `web/src/app/api/sessions/[id]/npc/route.ts` | 본인 NPC 1개 스냅샷. `npcs` 군중 API와 구분 |
| `POST /api/choices` | `web/src/app/api/choices/route.ts` | `session_id, situation_id, event_id, choice_id, request_key`. UUID 검증. 최초 201/재전송 200, `{record_id,state_version,replayed}`. 스탯 상세 결과는 없음 |
| `GET /api/sessions/{id}/responses` | `web/src/app/api/sessions/[id]/responses/route.ts` | `{session,responses}`. 응답은 situation_id/choice_id/event_id/request_key/received_at. 결과 스탯 없음 |
| `GET /api/city-state` | `web/src/app/api/city-state/route.ts` | 현재 도시값. 특정 이벤트에 귀속된 변화량이 아님 |
| `GET /api/sessions/{id}/result` | `web/src/app/api/sessions/[id]/result/route.ts`, `web/src/lib/participant-results.ts` | FINALIZED 전에는 `RESULT_NOT_FINALIZED`. 회차 최종 결과만 제공 |
| `GET/PUT /api/admin/sessions/{id}/event-locations` | `web/src/app/api/admin/sessions/[id]/event-locations/route.ts` | 관리자 배치 조회·편집. 참여자 UI에서 호출하면 안 됨 |

제출은 request_key로 재전송 시 같은 기록을 반환하며 다른 payload로 키를 재사용하면 `REQUEST_KEY_CONFLICT`. 그 외 `EVENT_REQUIRED`, `EVENT_NOT_ACTIVE`, `INVALID_CHOICE`, `STATE_NOT_READY`, `SESSION_CLOSED`, `UNAUTHORIZED` 등이 있다. 훅에는 `ALREADY_ANSWERED` 호환 분기가 있지만 현재 choices route의 명시적 분기는 위 코드들이다. 새 오류 코드를 기존 구현인 것처럼 문서화하지 않는다.

현재 개인 지표는 `participant_alignments`의 x_score/y_score/response_count이고 회차 종료 후 성향을 공개한다. 도시 지표는 happiness/safety/cleanliness 및 지역 pollution이다. choices route는 도시 요청 delta와 실제 clamp 적용 delta를 기록한다. UI에서 선택 base값을 곱하거나 도시 조회 전후 차이를 빼면 동시 참여자의 영향까지 섞인다. 이벤트 결과는 서버가 해당 record의 실제 적용값을 제공해야 한다. 2026-11-16 사용자 결정에 따라 선택 직후에는 도시 스탯 변화만 표시하며 개인 성향은 회차 최종 결과에서 공개한다.

## 6. 장소 ID·좌표·반경

실제 타입은 `web/src/lib/event-locations.ts`의 `EventLocation = {place_id:string; map_version:string; point:number[]; radius_m:number}`다. point는 검사상 유한한 `[x,y,z]` 3개이고 반경은 양수다. 같은 place_id는 같은 지도·점·반경이어야 한다. 구형 location의 ID 보완 코드는 있으나 신규 UI가 legacy ID를 생성하면 안 된다.

매핑·그래프 코드는 `web/src/lib/city-v002-event-mapping.mjs`, `city-v002-graph.mjs`, `web/src/lib/data/city-v002-event-mapping.json`, `city-v002-phase1-event-locations.json`, `city-rebuild-v002-phase1-graph.json` 등에 존재한다. 런타임은 회차 상황의 event_location과 NPC map_version 일치 및 playable 여부를 검사한다. v002 진입은 그래프 거리 기반이며 일반 지도는 공간 거리 기반이다. 프론트엔드가 반경 판정을 복제하면 안 된다.

`situation.id`는 콘텐츠 ID, `situation.code`는 콘텐츠 코드, `event.id`는 발생 건 ID, `place_id`는 공유 가능한 장소 ID, `npc_id`는 참가자 NPC ID다. 동일한 상황이 다시 제시될 수 있는 확장까지 고려해 선택·결과 UI key는 `event.id`를 사용한다. 테스트 자료에서 전시 좌표를 가져오지 않는다. UI Mock은 위치 이름만으로 충분하다.

## 7. 스타일과 재사용 기준

`participate.module.css`는 배경 #f5f1e6, 전경/테두리 #203831, 카드 #fffdf5, 강조 #368371을 사용한다. 100svh 도시 화면, safe-area actionDock, 최소 46px 버튼, 라디오 선택 52px, 800px 이상 우측 패널, 420px 이하 작은 헤더, focus-visible, reduced-motion 규칙이 있다. 중앙 토큰 라이브러리는 확인되지 않았다. 이 색상과 구조를 CSS Modules로 재사용하되 새로운 전역 reset·다크모드·UI 라이브러리를 도입할 필요는 없다.

## 8. 변경 및 미구현 목록

| 구분 | 필요한 일 | 담당 |
|---|---|---|
| 기존 웹 수정 | `page.tsx` 게임 영역 추출·상태별 조립, `useParticipation.ts` 시작/결과/복구 연결, `types.ts` 계약 확장, CSS 조정 | 메인 통합 담당 |
| 신규 웹 | 시작 버튼, 이동 상태, 결과 모달, 선택 카드 래퍼, Mock 어댑터·시나리오 화면 | UI 팀원 |
| 기존 서버 수정 필요 | 모든 자동 이벤트 진입점을 수동 정책으로 전환, 시작 멱등성, 선정 장소 고정, 결과 상태 지속, 확인 후 이동 재개 | 서버 담당, 이번 작업 제외 |
| 신규 계약 필요 | 시작 명령·실행 상태 조회·이벤트별 결과 복구·결과 확인, 이동 실패/만료 응답 | 서버/통합 담당 합의, 아직 미구현 |
| Unity 검증 필요 | 새 서버 이동/정지/재개 스냅샷을 현재 브리지로 표현 가능한지 실제 빌드 확인 | Unity/통합 담당 |
| 남은 제품 결정 | 결과 문구, 소진/반복 정책, 이동 제한시간, 마감 중 결과 확인 | 세부 정책 합의 필요 |

UI 독립 개발은 Mock으로 진행 가능하다. 실제 서버 연결 완료·이동 성공·배포 완료는 이 조사로 확인되지 않았다.

## 9. 이번 문서 작업의 검증 기록

- 문서 간 상대 링크, Markdown 코드 블록 짝, 주요 참조 파일 존재를 확인했다.
- `python3 scripts/assets/catalog.py`와 이어서 `--check`를 실행했으며 생성된 목록 기준 5,342개 파일·오류 0개였다. 다만 catalog 생성이 기존 에셋 목록에 대규모 변경을 만들었다. 문서 전용 작업 범위를 유지하기 위해 이번 실행이 만든 inventory 변경만 원래 내용으로 복원했다. 복원 후 `--check`는 `inventory is stale` 오류 1개로 실패한다. 에셋 목록 정합성은 별도 정리 사항이며 이 문서 작업에서 해결하지 않았다.
- UI·서버·Unity·DB 소스는 수정하지 않았고, 실행 테스트·배포 검증·commit/push는 하지 않았다. 기존 작업 트리 변경을 보존했다.
