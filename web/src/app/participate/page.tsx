"use client";

import Link from "next/link";
import { useState } from "react";
import CitizenCard from "./components/CitizenCard";
import ProfileEntry from "./components/ProfileEntry";
import SituationCard from "./components/SituationCard";
import UnityCity from "./unity/UnityCity";
import { useParticipation } from "./hooks/useParticipation";
import { NPC_SPEED_MULTIPLIERS } from "./lib/npc-motion";
import styles from "./participate.module.css";

export default function ParticipatePage() {
  const state = useParticipation();
  const [enteringSession, setEnteringSession] = useState<string | null>(null);
  const [testSituationId, setTestSituationId] = useState("");
  const [cityReady, setCityReady] = useState(false);
  const history = state.history.length > 0 && <section className={styles.stateCard}><h2>지난 회차 결과</h2>{state.history.map(item => <p key={item.id}><Link href={`/result/${item.id}`}>{item.name} 결과 보기</Link></p>)}</section>;
  const pendingNotice = state.pending && (!state.pending.event_id || state.pending.session_id !== state.session?.id || state.pending.event_id !== state.eventState?.event?.id) && <section className={styles.stateCard}>
    <h2>이전 회차 제출 확인</h2><p>이전 선택의 접수 여부를 확인해 주세요.</p>
    <p role="status">{state.messages[state.pending.event_id ?? state.pending.request_key]}</p><button className={styles.button} disabled={state.submitting !== null} onClick={() => void state.retryPending()}>이전 제출 다시 확인</button>
  </section>;
  if (state.loading) return <main className={styles.page}><div className={styles.stateCard} role="status">참여 정보를 불러오는 중이에요…</div></main>;
  if (state.loadError && (!state.session || !state.profile || state.authExpired)) return (
    <main className={styles.page}><div className={styles.stateCard}>
      <h1>{state.authExpired ? "참여 인증이 만료되었습니다" : "정보를 불러오지 못했습니다"}</h1>
      <p role="alert">{state.authExpired ? "새 시민으로 시작하면 시민증과 응답 기록이 새로 시작돼요." : state.loadError}</p>
      {state.authExpired
        ? <button className={styles.button} onClick={state.restart}>새 참여 시작</button>
        : <button className={styles.button} onClick={state.retryLoad}>다시 불러오기</button>}
      <Link className={styles.textLink} href="/">처음으로</Link>
    </div></main>
  );
  if (!state.session) {
    const previous = state.latestSession;
    return (
      <main className={styles.page}><div className={styles.stateCard}>
        <p className={styles.eyebrow}>SIM:US 시민 선택</p>
        <h1>{previous?.status === "FINALIZED" ? "결과가 확정되었습니다" : previous?.status === "CLOSING" ? "결과를 준비하고 있습니다" : "참여 가능한 회차가 없습니다"}</h1>
        <p>{previous ? previous.name : "새 회차가 열리면 이 화면에서 바로 참여할 수 있습니다."}</p>
        {previous && <Link className={styles.buttonLink} href={`/result/${previous.id}`}>내 결과 확인</Link>}
        <button className={styles.secondaryButton} onClick={state.retryLoad}>상태 새로고침</button>
      </div>{pendingNotice}{history}</main>
    );
  }
  const sessionId = state.session.id;
  if (!state.profile || enteringSession === sessionId) {
    if (!state.session.accepting_choices && enteringSession !== sessionId) return (
      <main className={styles.page}><div className={styles.stateCard}>
        <p className={styles.eyebrow}>SIM:US 시민 등록</p>
        <h1>{state.session.status === "RUNNING" ? "이번 회차 입장이 마감되었습니다" : "이번 회차가 끝났습니다"}</h1>
        <p>{state.session.name}</p>
        {state.joined && <Link className={styles.buttonLink} href={`/result/${sessionId}`}>내 결과 확인</Link>}
        <button className={styles.secondaryButton} onClick={state.retryLoad}>상태 새로고침</button>
      </div>{pendingNotice}{history}</main>
    );
    return <ProfileEntry key={sessionId} session={state.session} departments={state.departments}
      onSaved={() => setEnteringSession(sessionId)}
      onEntered={profile => { state.completeProfile(profile); setEnteringSession(null); }}
      onStale={state.refresh}>{pendingNotice}</ProfileEntry>;
  }
  const profile = state.profile;
  const answeredCount = state.responseCount;
  const activeEvent = state.session.accepting_choices && state.eventState?.phase === "ACTIVE" ? state.eventState.event : null;
  const activeSituation = activeEvent?.situation;
  const plazaCompleted = state.eventState?.plaza_completed === true;
  const allCompleted = state.eventState?.situations_remaining === 0;
  const guiding = state.eventState?.phase === "GUIDING";
  const speedMultiplier = state.eventState?.speed_multiplier;
  const closed = !state.session.accepting_choices || state.eventState?.phase === "CLOSED";
  const testSituations = state.eventState?.test_situations ?? [];
  const testSituation = testSituations.find(situation => situation.id === testSituationId);
  const waitingMessage = closed ? "이벤트 접수가 마감되었습니다"
    : allCompleted ? "이번 회차의 모든 상황에 응답했어요"
    : guiding ? "새로운 상황을 만나러 이동 중이에요"
    : plazaCompleted ? "시민이 광장을 둘러보고 있어요"
    : state.eventState?.plaza_completed === false && !state.eventState.can_start ? "지금은 광장 상황을 시작할 수 없어요"
    : "도시를 둘러보고 있어요";
  return (
    <main className={styles.gamePage}>
      <header className={styles.hud}>
        <div className={styles.identity}><h1>SIM<span>:</span>US</h1><strong>{profile.nickname}</strong></div>
        <div className={styles.progress} aria-label={`${answeredCount}회 응답 완료`}>
          <span>{answeredCount}회 응답</span>
        </div>
        <details className={styles.menu}>
          <summary>시민증</summary>
          <div className={styles.citizenCardPopup}>
            <CitizenCard characterId={profile.character_id} glassesId={profile.glasses_id} nickname={profile.nickname} department={profile.department_name} mbti={profile.mbti} citizenNo={profile.citizen_no} status="issued" />
          </div>
        </details>
      </header>
      {pendingNotice && <div className={styles.urgent}>{pendingNotice}</div>}
      {state.loadError && <section className={styles.roundNotice} role="alert">
        <strong>참여 정보를 다시 확인하고 있어요</strong>
        <span>{state.loadError}</span>
        <button className={styles.secondaryButton} onClick={state.refresh}>다시 확인</button>
      </section>}
      {(!state.session.accepting_choices) && <section className={styles.roundNotice} role="status">
        <strong>{state.session.status === "FINALIZED" ? "결과 확정" : state.session.status === "CLOSING" ? "결과 준비 중" : "접수 마감"}</strong>
        <span>{state.session.status === "FINALIZED" ? "내 결과가 도착했어요." : "도시를 둘러보며 결과를 기다려 주세요."}</span>
        <Link href={`/result/${state.session.id}`}>{state.session.status === "FINALIZED" ? "내 결과 보기 →" : "결과 상태 확인 →"}</Link>
      </section>}
      <section className={styles.cityExperience} aria-label="도시와 선택">
        <UnityCity key={state.session.id} sessionId={state.session.id} motionRefresh={state.motionRefresh}
          onReady={setCityReady} eventCode={activeSituation?.code} />
        <details className={styles.choicePanel} open>
          <summary><span>도시에서 선택하기</span><small>{activeEvent ? "상황 발생" : allCompleted ? "응답 완료" : guiding ? "이동 중" : "이벤트 대기"}</small></summary>
          <div className={styles.choicePanelBody}>
            {!activeSituation && <div className={styles.emptySituation}>
              <h2 id="situation-status" role="status">{waitingMessage}</h2>
              {!guiding && !allCompleted && (state.eventState?.plaza_completed !== undefined || state.eventState?.can_start) &&
                <button type="button" className={styles.button} aria-describedby="situation-status"
                  disabled={closed || !state.eventState?.can_start || state.eventAction !== null || Boolean(state.pending)}
                  onClick={() => void state.changeEventMotion()}>{state.eventAction === "start" ? "상황을 시작하는 중…" : plazaCompleted ? "다음 상황" : "상황 발생"}</button>}
              {!closed && testSituations.length > 0 && <form className={styles.testSituationPicker} onSubmit={event => {
                event.preventDefault();
                if (testSituation && cityReady) void state.changeEventMotion({ situationId: testSituation.id });
              }}>
                <label htmlFor="test-situation">테스트할 상황</label>
                <select id="test-situation" value={testSituation?.id ?? ""} onChange={event => setTestSituationId(event.target.value)}
                  disabled={state.eventAction !== null || Boolean(state.pending)}>
                  <option value="">미응답 상황 선택</option>
                  {testSituations.map(situation => <option key={situation.id} value={situation.id}>
                    {situation.code.slice(-2)} · {situation.title}
                  </option>)}
                </select>
                <button type="submit" className={styles.secondaryButton}
                  disabled={!testSituation || !cityReady || state.eventAction !== null || Boolean(state.pending)}>선택한 상황 시작</button>
              </form>}
              {!closed && guiding && speedMultiplier !== undefined &&
                <div className={styles.npcSpeed} role="group" aria-label="NPC 이동 속도">
                  {NPC_SPEED_MULTIPLIERS.map(multiplier => (
                    <button key={multiplier} type="button" className={styles.secondaryButton}
                      aria-pressed={speedMultiplier === multiplier} disabled={state.eventAction !== null}
                      onClick={() => void state.changeEventMotion({ multiplier })}>{multiplier}배속</button>
                  ))}
                </div>}
              {state.eventActionError && <p role="alert">{state.eventActionError}</p>}
            </div>}
            {activeEvent && activeSituation && <SituationCard key={activeEvent.id} situation={activeSituation} selectedChoiceId={state.selected[activeEvent.id]}
              done={Boolean(state.answered[activeEvent.id])} acceptingChoices={state.session.accepting_choices}
              submitting={state.submitting === activeEvent.id} submissionInProgress={state.submitting !== null}
              retrying={state.pending?.session_id === state.session.id && state.pending?.event_id === activeEvent.id} hasPendingSubmission={state.pending !== null}
              message={state.messages[activeEvent.id] ?? ""} onSelect={choiceId => state.selectChoice(activeEvent.id, choiceId)}
              onSubmit={() => void state.submit(activeSituation)} />}
          </div>
        </details>
      </section>
    </main>
  );
}
