# 모바일 수동 이벤트 UI — 컴포넌트 명세

상태는 **전시 참여 경험 확정, 서버 계약과 구현은 미완료**입니다. 2026-11-16.

[기존 코드 분석](mobile-event-ui-analysis.md) / [팀원 작업 가이드](mobile-event-ui-guide.md)

## 2026-11-16 사용자 확정

- 관람객이 **새로운 상황 만나기** 버튼을 눌러 상황을 시작한다. 이동과 기다림도 흥미를 유지하는 체험으로 설계한다. 구체적인 연출과 첫 상황까지의 시간 기준은 상황 테스트를 거쳐 정한다.
- 선택 직후에는 해당 선택으로 실제 반영된 **도시 스탯 변화만** 표시한다. 개인 성향 점수·변화량·유형은 회차 종료 후 최종 결과에서 공개한다.
- 개막 시 필요한 상황 수와 도시 외형 변화·오염 확산·웹 푸시의 필수 여부는 보류한다.
- v003 맵과 NPC 경로 연결은 보류한다. 재개 시 Codex가 연결 작업을 맡고 사용자는 이후 상황 플레이를 테스트한다.

## 1. 화면 구성과 소유권

목표 순서는 자유 이동 → 웹의 **새로운 상황 만나기** → 서버 선정 → 이동 → 서버 도착 확정 → 설명/선택 → 서버 계산 → 결과 → 확인 → 서버 이동 재개 → 자유 이동이다. 시작 버튼은 Next.js DOM으로 만들며 Unity Canvas에 만들지 않는다.

```text
ParticipatePage                       기존: 입장·인증·회차 처리 유지
└─ CityGameHUD                        신규 추출: 표시용 조립
   ├─ 기존 헤더/시민증 메뉴           통합 담당이 연결
   ├─ citySlot                       실제 UnityCity / MockCityViewport
   ├─ EventStartButton               idle 및 잠금 사유
   ├─ NpcMovementStatus              moving
   ├─ EventDialog                    event: 기존 SituationCard 포함
   ├─ EventResultModal               result
   └─ 오류/회차 마감 안내             상태 재조회, 결과 링크
```

`useParticipation`은 현재의 인증·입장·미확인 선택 처리 책임을 유지한다. 향후 이벤트 컨트롤러가 EventUiPort를 주입받아 조회/명령/정합성을 관리한다. HUD·버튼·모달은 fetch, localStorage, postMessage를 직접 호출하지 않는다. 기존 훅과 새 컨트롤러가 동시에 이벤트를 폴링하거나 선택을 제출하지 않도록 메인 통합에서 소유자를 하나로 정한다.

서버가 소유할 것: 실행 ID, 선정 상황/장소, 이동 경로·시각·도착 여부, 실행 phase, 스탯/선택 기록, 결과 확인 여부. 클라이언트가 소유할 것: 라디오 임시 선택, 포커스, 명령 처리 중 표시, 연결 오류, 미확인 요청 복구용 키. 오류 화면이 서버 실행을 취소하는 것은 아니다.

## 2. 파일과 컴포넌트별 계약

기존 경로는 실제 파일이다. 아래 신규 경로는 **제안**이며 이번 작업에서 파일을 생성하지 않는다. UI 전용 저장소도 `src/app/participate/`와 `src/features/mobile-events/`를 사용하면 메인 `web/src/`로 옮기기 쉽다.

| 이름 | 메인 기준 경로 | 재사용 및 책임 | Props | 상호작용·API/Unity 의존성 |
|---|---|---|---|---|
| CityGameHUD | 제안 `web/src/features/mobile-events/CityGameHUD.tsx` | `participate/page.tsx`의 게임 레이아웃 추출. 상태별 구성·안내 | `CityGameHUDProps` | 콜백만 전달. API 간접, citySlot만 Unity 표시 |
| EventStartButton | 제안 `web/src/features/mobile-events/EventStartButton.tsx` | 기존 버튼 CSS 재사용. 시작·잠금 사유·접수 중 | `EventStartButtonProps` | onStart 한 번. port.start 간접 의존. Unity 직접 연동 없음 |
| NpcMovementStatus | 제안 `web/src/features/mobile-events/NpcMovementStatus.tsx` | 기존 이동 중 문구를 독립화. 장소명·확인 지연 안내 | `NpcMovementStatusProps` | onRefresh로 상태 재조회. port.read 간접. 이동/도착 판정 없음 |
| EventDialog | 제안 `web/src/features/mobile-events/EventDialog.tsx` | 하단 패널 래퍼. 아래 실제 SituationCard 포함 | `EventDialogProps` | 선택→별도 제출. port.submit 간접. Unity 없음 |
| SituationCard | **기존** `web/src/app/participate/SituationCard.tsx` | 설명·라디오·제출·재시도 UI 최대 재사용 | `ExistingSituationCardProps` | onSelect/onSubmit. 자체 fetch 없음. 기존 locked 규칙 보존 |
| EventResultModal | 제안 `web/src/features/mobile-events/EventResultModal.tsx` | 해당 선택의 실제 도시 스탯 변화와 확인 버튼 | `EventResultModalProps` | onConfirm→port.confirm 간접. 결과 확인 전 서버 정지 필요. Unity 직접 명령 없음 |
| EventConfirmModal | 생성하지 않음 | 기존 카드에 선택 후 변경 불가 안내와 별도 제출 버튼이 있음 | 없음 | 추가 확인 단계가 제품상 승인될 때만 별도 설계 |
| MockCityViewport | 제안 `web/src/features/mobile-events/MockCityViewport.tsx` | UI 저장소 전용. 도시 자리·움직임/정지 텍스트만 | `{label:string}` | 네트워크·Unity 의존성 없음 |

`EventDialog`는 이름상 dialog지만 기본 표현은 기존과 같은 **비모달 하단 패널**이다. `role=dialog`를 무조건 붙이지 않는다. 결과 모달만 진짜 모달로 만들고 포커스·배경 비활성화를 처리한다.

## 3. TypeScript 계약 초안

다음은 문서 내 설계 코드다. `Choice/Situation/Submission` 등 기존 필드명을 유지한다. `eventId`는 발생 건이며 `situation.id`와 다르다. 어댑터가 실제 DTO를 변환한다. 실 API URL을 임의로 정하지 않는다.

```ts
import type { ReactNode } from 'react';
import type { Situation } from '@/app/participate/types';

type ServerPhase = 'idle' | 'moving' | 'event' | 'result';
type UiPhase = ServerPhase | 'error';
type Gate = 'open' | 'closed' | 'exhausted';
type PendingAction = 'start' | 'submit' | 'confirm' | null;
type Destination = { placeId: string; label: string | null; mapVersion: string };
// 좌표와 반경은 UI에 불필요. 어댑터/Unity 스냅샷 경계를 넘어 복제하지 않는다.
type RunBase = { eventId: string; destination: Destination };
type AppliedChange = {
  before: number;
  after: number;
  appliedDelta: number; // 실제 clamp 적용값. 서버가 제공
};
type EventOutcome = {
  recordId: string;
  eventId: string;
  choiceId: string;
  summary: string | null; // 서버 문구 미제공이면 UI 중립 문구
  cityStateVersion: string;
  city: {
    happiness: AppliedChange;
    safety: AppliedChange;
    cleanliness: AppliedChange;
  };
  // null은 미제공. []는 영향 지역 없음. 오염도를 UI에서 평균내지 않는다.
  regions: { regionId: string; label: string; pollution: AppliedChange }[] | null;
};
type ServerSnapshot = {
  sessionId: string;
  revision: number; // 제안: 세션 내 본인 이벤트 상태의 단조 증가 안전 정수
  serverTime: string; // ISO 8601
  gate: Gate;
} & (
  | { phase: 'idle'; run: null }
  | { phase: 'moving'; run: RunBase & {
      movementStartedAt: string;
      movementDeadlineAt: string | null;
      estimatedArrivalAt: string | null;
    } }
  | { phase: 'event'; run: RunBase & { situation: Situation } }
  | { phase: 'result'; run: RunBase & { outcome: EventOutcome } }
);
type UiProblem = {
  code: string;
  message: string;
  recovery: 'refresh' | 'replay' | 'reenter';
};
type UiModel = {
  phase: UiPhase;
  snapshot: ServerSnapshot | null; // errorでも直前の正しい状態を保持
  loading: boolean;
  action: PendingAction;
  selectedChoiceId?: string;
  hasUnresolvedRequest: boolean;
  scene: 'loading' | 'ready' | 'error';
  problem: UiProblem | null;
};

type ExistingSituationCardProps = {
  situation: Situation; selectedChoiceId?: string;
  done: boolean; acceptingChoices: boolean;
  submitting: boolean; submissionInProgress: boolean;
  retrying: boolean; hasPendingSubmission: boolean;
  message: string;
  onSelect: (choiceId: string) => void;
  onSubmit: () => void;
}; // 현재 파일 내부 Props와 같은 형태. 공유 export 추가는 통합 담당이 수행.
type EventDialogProps = ExistingSituationCardProps & { eventId: string };
type EventStartButtonProps = {
  disabled: boolean; pending: boolean; disabledReason?: string;
  onStart: () => void;
};
type NpcMovementStatusProps = {
  destinationLabel: string | null;
  delayed: boolean; refreshing: boolean;
  onRefresh: () => void;
};
type EventResultModalProps = {
  open: boolean; outcome: EventOutcome;
  confirming: boolean; errorMessage?: string;
  onConfirm: () => void;
};
type CityGameHUDProps = {
  model: UiModel;
  citySlot: ReactNode;
  identitySlot: ReactNode; // 통합 담당이 기존 헤더·메뉴를 전달
  onStart: () => void;
  onSelect: (choiceId: string) => void;
  onSubmit: () => void;
  onConfirm: () => void;
  onRefresh: () => void;
  onRetryUnresolved: () => void;
};
```

기존 `SituationCard`의 done은 이미 접수된 같은 이벤트 응답을 복구했을 때 사용한다. `submissionInProgress`에는 모든 변경 명령의 실행 여부를, `hasPendingSubmission`에는 다른 미확인 명령도 포함한 잠금을 전달한다. `retrying`은 **그 이벤트의 같은 선택 제출**을 복구하는 경우에만 true다. 시작/확인 요청의 재전송은 카드의 제출 버튼이 아닌 공통 복구 액션으로 처리한다. `message`는 해당 이벤트의 오류/전송 상태이며 새 이벤트에 이전 메시지를 넘기지 않는다.

HUD는 snapshot의 union을 좁힌 후 해당 Props를 구성한다. 시작 버튼의 disabled는 idle이 아님, gate가 open이 아님, loading, action 있음, 미확인 요청 있음, scene 준비 전/오류, 인증·연결 오류 중 어느 하나라도 해당하면 true다. 이유를 화면 텍스트로 제공한다. scene 준비 여부는 추후 `UnityCity` 콜백/래퍼로 통합 담당이 제공해야 하며 현재 해당 prop은 없다.

## 4. UI 상태와 전이

```text
초기 조회 → 서버 phase 복구
idle ─시작 요청 확정→ moving ─서버 도착 확정→ event
event ─선택 제출 확정→ result ─결과 확인 확정→ idle
각 단계 ─연결/명령 오류→ error ─재조회/동일 요청 복구→ 서버 phase
```

| 상태 | 표시 | 버튼/로딩 | 전환 조건 및 서버 관계 | 중복·실패 처리 |
|---|---|---|---|---|
| idle | 도시, 시작 버튼, 자유 이동 문구 | 허용 조건 충족 시 시작 가능. 시작 요청 동안 같은 상태에서 접수 중 spinner | start가 반환한 권위 snapshot으로 이동. 바로 도착한 경우 event도 허용 | 클릭 직후 동기 ref 잠금. 응답 유실 시 idle로 가정해 새 키로 시작 금지 |
| moving | 도시, 이동 상태, 비활성 시작 | 불확정 spinner. ETA 없으면 %/남은 초를 만들지 않음 | read가 같은 실행을 event로 반환할 때만 설명 표시 | UI 타이머로 event 전환 금지. 지연/실패 정책 아래 참조 |
| event | EventDialog/SituationCard, 시작 비활성 | 라디오 선택 전 제출 비활성. submit 중 선택/제출/시작 잠금 | submit 확정 및 결과 확보 후 result | 미확인 제출은 기존 pending 원리로 동일 key/payload 재전송. local 선택만으로 스탯 표시 금지 |
| result | EventResultModal, 배경 도시 정지 | 확인 가능, confirm 중 비활성/spinner. 시작은 비활성 | confirm 후 서버가 idle을 반환해야 이동 재개 | 모달 닫기만으로 자유 이동 처리 금지. 확인 실패는 결과를 유지하고 오류/재확인 |
| error | 마지막 유효 배경, 오류·복구 액션 | 시작·새 선택 잠금. 복구 요청 중 spinner | read/replay 결과 phase로 복귀. 인증 오류는 기존 입장 흐름 | 서버 실행은 유지될 수 있음. 클라이언트가 취소/이벤트 생성하지 않음 |

초기 조회 로딩은 별도 `loading` 플래그로 표현한다. 서버에는 `error` UI phase가 없으며 이동 자체 실패는 별도 도메인 오류 계약이 필요하다. gate는 phase와 독립이다. closed/exhausted인 idle은 시작을 막고 각각 마감/만날 상황 없음 안내를 표시한다. result에서 closed가 되더라도 이미 접수한 결과를 보여주며 확인 가능 여부는 아래 계약 요구에 따른다.

### 지연·오류·복구의 UI 기본값

- UI Mock 기준 명령 응답 15초 미확인 시 오류를 표시하되 서버 실행 취소로 해석하지 않는다. 실제 HTTP 제한시간은 API 담당과 확정한다.
- 이동 표시 시작 후 30초가 지나거나 서버 movementDeadlineAt을 넘으면 `delayed=true`, “이동 상태를 확인하고 있어요”와 새로고침을 표시한다. 이는 UI 안내 기준이며 강제 실패 제한시간이 아니다. 서버가 ETA를 주지 않으면 ETA를 표시하지 않는다.
- 경로 없음·속도 0·지도 불일치·서버 이동 제한 초과는 서버의 실패 응답을 기다린다. timeout으로 순간이동하거나 다음 상황을 시작하지 않는다. 자동 취소/재경로는 서버 담당 책임이다.
- read 폴링은 기존 2.5초를 출발점으로 한 번에 하나만 실행한다. 화면 숨김 시 중지, 복귀/online에 즉시 read. 네트워크 실패는 2.5/5/10초 간격으로 늘리며 수동 확인도 single-flight로 합친다.
- 새로고침·다중 탭에서 클라이언트 phase를 신뢰하지 않는다. 서버 최신 snapshot을 복구한다. 결과 확인 전 result가 지속되어야 한다. 미확인 요청은 read만으로 확정하지 못하면 같은 요청을 replay한다.
- sessionId + revision을 확인해 이전 응답이 최신 명령 결과를 덮지 않게 한다. 동일 revision은 동일 상태여야 하며 낮은 revision은 버린다. 세션 교체 시 요청 abort·타이머 정리·임시 선택 초기화. 화면 unmount의 abort는 서버 rollback 보장이 아니다.
- 오류 시 서버 phase가 event라면 선택 내용은 유지할 수 있지만 재조회로 실행 ID가 바뀌면 제거한다. 응답 유실 뒤 다른 선택으로 payload를 바꾸지 않는다.

## 5. Mock/실제 API 분리 인터페이스

제안 파일: `web/src/features/mobile-events/contracts.ts`, `mock/createMockEventPort.ts`, `adapters/createHttpEventPort.ts`. 마지막 파일은 **메인 통합 담당**이 구현한다. UI 저장소에는 미구현 실제 연결을 성공하는 것처럼 보이는 어댑터를 넣지 않는다.

```ts
type RequestContext = { sessionId: string; signal?: AbortSignal };
type Command = RequestContext & { requestKey: string };
interface EventUiPort {
  read(context: RequestContext): Promise<ServerSnapshot>;
  start(input: Command): Promise<ServerSnapshot>;
  submit(input: Command & {
    eventId: string; situationId: string; choiceId: string;
  }): Promise<ServerSnapshot>;
  confirm(input: Command & { eventId: string }): Promise<ServerSnapshot>;
}
// 실패 시 UiProblem으로 식별 가능한 타입이 있는 오류로 변환한다.
```

`start/read/submit/confirm`은 프론트엔드 포트 메서드이며 HTTP endpoint가 아니다. 실제 URL·method·인증·DTO는 서버 담당자가 확정한다. 기존 GET event를 그대로 read에 연결하면 자동 발생이 지속되므로 수동 흐름 연결 완료로 인정하지 않는다.

| 포트 | 기존 구현으로 가능한 부분 | 실제 연결 전 필요한 서버 계약 |
|---|---|---|
| read | 기존 event phase 참고 | 수동 실행의 destination/이동 기한/result/단조 revision/gate 복구. 조회 중 자동 신규 생성 제거 |
| start | 없음 | 참가자당 진행 1건. request_key 멱등성. 발생 가능한 상황·도달 가능한 장소 확정 후 같은 실행으로 보관. 클라이언트는 목적지 선택 안 함 |
| submit | 기존 `/api/choices` 멱등 제출·스탯 계산 재사용 | 결과 snapshot 또는 이벤트별 복구 조회. `completeEvent` 즉시 재개를 result 보류로 변경. 반복 재전송도 같은 record 결과 |
| confirm | 없음 | 확인 멱등성. 스탯 재적용 없이 확인 기록·자유 이동 재개. 마감 뒤에도 접수된 결과 확인은 허용하는 방향으로 합의 필요 |

추가 합의 요구: 기존 실행 충돌 시 새 실행을 만들지 않고 권위 상태 반환/재조회 유도, 후보 소진 시 exhausted, 선택 불가능 상태 시 재조회, 인증 만료 시 reenter. HTTP 오류 이름과 status는 아직 미확정이다. 기존 `UNAUTHORIZED / SESSION_CLOSED / EVENT_NOT_ACTIVE / REQUEST_KEY_CONFLICT`는 어댑터에서 정규화한다. 신규 코드 문자열은 서버 확정 후 매핑한다.

각 변경 액션은 UUID requestKey를 최초 시도 전에 보관하고 payload를 고정한다. 시작/선택/확인은 서로 다른 키와 종류를 쓴다. 명령 미확인 저장 형식은 `{kind,sessionId,requestKey,payload}`를 기본으로 하고 기존 선택 제출 localStorage와의 마이그레이션은 통합 담당이 설계한다. 서버는 다중 탭을 포함해 진행 1건·스탯 1회 적용을 보장해야 한다. 브라우저 잠금만으로 이를 보장하지 않는다.

스탯 before/after/delta는 해당 선택 트랜잭션의 스냅샷이다. 모달에 “이 선택이 반영된 시점”을 표기하고 LiveCityStats의 최신 도시값과 구분한다. 서버가 before/after를 제공하지 못하면 타입을 합의해 축소해야 하며 UI에서 역산하지 않는다. 개인 성향 데이터는 회차 최종 결과 계약에서만 제공한다.

## 6. Mock 데이터와 시나리오

Mock은 포트 안에서만 상태를 바꾼다. 실제 fetch·쿠키·참가자 API·Unity 빌드·DB·API 키가 없어야 한다. UI는 포트 교체 외에는 동일하다. 기존 SituationCard를 복사해 최소 수정하여 사용하고, 기존 useParticipation/UnityCity/LiveCityStats를 Mock 페이지에서 import하지 않는다.

```ts
const mockSituation: Situation = {
  id: 'mock-situation-01', code: 'MOCK_01',
  title: '길에 놓인 물건을 발견했어요',
  body: '지나가는 사람이 물건을 떨어뜨렸어요. 어떻게 행동할까요?',
  choices: [
    { id: 'mock-choice-help', label: '주인을 찾아 돌려준다' },
    { id: 'mock-choice-pass', label: '그대로 지나간다' },
  ],
};
const mockDestination: Destination = {
  placeId: 'mock-place-01', label: '테스트 광장', mapVersion: 'mock-only',
};
const mockOutcome: EventOutcome = {
  recordId: 'mock-record-01', eventId: 'mock-event-01',
  choiceId: 'mock-choice-help', summary: '선택이 도시에 반영되었어요.',
  cityStateVersion: '12',
  city: {
    happiness: { before: 99, after: 100, appliedDelta: 1 },
    safety: { before: 50, after: 50, appliedDelta: 0 },
    cleanliness: { before: 50, after: 49, appliedDelta: -1 },
  },
  regions: null,
};
```

이 ID/장소/수치는 **표시 테스트용**이며 실제 API로 전송하거나 전시 데이터로 사용하지 않는다. 실제 API는 UUID 검증을 한다. Mock은 선택별로 사전 작성된 outcome을 반환하며 실제 스탯 산식을 구현하지 않는다.

기본 흐름은 idle revision 1 → start 시 moving 2 → Mock 포트 타이머 2초 뒤 event 3 → submit 시 result 4 → confirm 시 idle 5. 각 snapshot은 sessionId `mock-session`, ISO serverTime, gate `open`을 포함한다. moving에는 시작 시각·추정 도착 시각을 주되 deadline은 null 가능하다. result에는 mockOutcome과 같은 eventId를 사용한다. 다음 start는 새 eventId를 발급하고 UI 임시 선택을 비운다. Fake timer를 써도 **컴포넌트가 아니라 Mock 포트**가 전이를 소유한다.

시나리오 선택기는 개발 화면에서만 제공한다: 정상 반복, 매우 빠른 도착, 긴 이동, 이동 실패, 응답 지연/유실 후 동일 요청 복구, 중복 클릭, 제출 오류, 확인 오류, 인증 만료, 마감, 후보 소진, result 재접속, 오래된 read 도착, 지도 오류, 긴 한글/선택지 다수. Mock은 requestKey별 응답을 기억하고 재전송 시 새 결과를 만들지 않는다. 새로고침 복구 시나리오는 Mock 저장소 또는 초기 result fixture로 재현하며 실제 서버 보장의 증거로 간주하지 않는다.

## 7. 모바일·접근성

- 기존 베이지/진녹색 CSS Modules를 유지. 최소 44px 터치 영역, 기존 제출 버튼 46px 이상. safe-area 하단 여백 포함.
- 320/375/390/430px 폭, 가로모드·낮은 높이, 800px 이상 우측 패널을 확인한다. 긴 설명/선택지는 본문만 스크롤하고 제출/확인 영역은 접근 가능해야 한다. 200% 확대에서 텍스트 잘림·가로 스크롤이 없어야 한다.
- event 도착 시 제목으로 포커스를 이동하되 폴링 때마다 재이동하지 않는다. 선택은 fieldset/legend/radio와 키보드 동작을 유지한다. 이동 상태는 role=status/aria-live=polite, 오류는 role=alert. 매 폴링 안내 재낭독을 피한다.
- 결과 모달은 이름 있는 dialog, aria-modal, 초기 확인 버튼 포커스, focus trap, 배경 inert, 스크롤 잠금을 제공한다. backdrop/Escape가 서버 확인 없이 닫거나 재개시키지 않게 한다. 확인 성공 후 시작 버튼으로 포커스 복귀. 마감이면 마감 안내로 복귀한다.
- 증감은 부호와 텍스트로 표현하며 색만 쓰지 않는다. 미제공 값은 0으로 만들지 않는다. reduced-motion에서 spinner 외 장식 이동·확대 애니메이션을 줄인다.
