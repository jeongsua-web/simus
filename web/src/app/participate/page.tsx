"use client";

import Link from "next/link";
import { useState } from "react";
import { LiveCityStats } from "../components/CityStats";
import ProfileEntry from "./ProfileEntry";
import SituationCard from "./SituationCard";
import UnityCity from "./UnityCity";
import PushOptIn from "./PushOptIn";
import { useParticipation } from "./useParticipation";
import styles from "./participate.module.css";

export default function ParticipatePage() {
  const state = useParticipation();
  const [enteringSession, setEnteringSession] = useState<string | null>(null);
  const [selection, setSelection] = useState({ sessionId: "", index: 0 });
  const history = state.history.length > 0 && <section className={styles.stateCard}><h2>지난 회차 결과</h2>{state.history.map(item => <p key={item.id}><Link href={`/result/${item.id}`}>{item.name} 결과 보기</Link></p>)}</section>;
  const pendingNotice = state.pending && state.pending.session_id !== state.session?.id && <section className={styles.stateCard}>
    <h2>이전 회차 제출 확인</h2><p>이전 선택의 접수 여부를 확인해 주세요.</p>
    <p role="status">{state.messages[state.pending.situation_id]}</p><button className={styles.button} disabled={state.submitting !== null} onClick={()=>void state.retryPending()}>이전 제출 다시 확인</button>
  </section>;
  if (state.loading) return <main className={styles.page}><div className={styles.stateCard} role="status">참여 정보를 불러오는 중이에요…</div></main>;
  if (state.loadError) return (
    <main className={styles.page}><div className={styles.stateCard}>
      <h1>{state.authExpired ? "참여 인증이 만료되었습니다" : "정보를 불러오지 못했습니다"}</h1>
      <p role="alert">{state.loadError}</p>
      {!state.authExpired && <button className={styles.button} onClick={state.retryLoad}>다시 불러오기</button>}
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
  const answeredCount = Object.values(state.answered).filter(Boolean).length;
  const complete = answeredCount >= state.session.situations.length && state.session.situations.length > 0;
  const activeIndex = selection.sessionId === state.session.id ? Math.min(selection.index, state.session.situations.length - 1) : 0;
  const activeSituation = state.session.situations[activeIndex];
  return (
    <main className={styles.gamePage}>
      <header className={styles.hud}>
        <div className={styles.identity}><h1>SIM<span>:</span>US</h1><strong>{profile.nickname}</strong></div>
        <div className={styles.progress} aria-label={`전체 ${state.session.situations.length}개 중 ${answeredCount}개 응답 완료`}>
          <span>{answeredCount} / {state.session.situations.length} 응답</span>
          <progress value={answeredCount} max={Math.max(1, state.session.situations.length)} />
        </div>
        <details className={styles.menu}>
          <summary aria-label="시민증과 회차 메뉴">시민증 <span aria-hidden="true">☰</span></summary>
          <div className={styles.menuBody}>
            <p className={styles.eyebrow}>SIM:US 시민증</p>
            <p className={styles.citizen}><span>No. {profile.citizen_no}</span><strong>{profile.nickname}</strong><span>{profile.department_name}</span><span>{profile.mbti}</span></p>
            <h2>{state.session.name}</h2>
            <p className={styles.schedule}>입력 마감 {state.session.auto_cutoff_at ? new Date(state.session.auto_cutoff_at).toLocaleString("ko-KR") : "확인 중"}<br />종료 예정 {state.session.scheduled_end_at ? new Date(state.session.scheduled_end_at).toLocaleString("ko-KR") : "확인 중"}</p>
            <LiveCityStats sessionId={state.session.id}/>
            <PushOptIn key={state.session.id} sessionId={state.session.id}/>
            {history}
          </div>
        </details>
      </header>
      {pendingNotice && <div className={styles.urgent}>{pendingNotice}</div>}
      {(complete || !state.session.accepting_choices) && <section className={styles.roundNotice} role="status">
        <strong>{state.session.status === "FINALIZED" ? "결과 확정" : state.session.status === "CLOSING" ? "결과 준비 중" : !state.session.accepting_choices ? "접수 마감" : "모든 선택 완료"}</strong>
        <span>{state.session.status === "FINALIZED" ? "내 결과가 도착했어요." : "도시를 둘러보며 결과를 기다려 주세요."}</span>
        <Link href={`/result/${state.session.id}`}>{state.session.status === "FINALIZED" ? "내 결과 보기 →" : "결과 상태 확인 →"}</Link>
      </section>}
      <section className={styles.cityExperience} aria-label="도시와 선택">
        <UnityCity key={state.session.id} sessionId={state.session.id} />
        <details className={styles.choicePanel} open>
          <summary><span>도시에서 선택하기</span><small>{Math.max(0, state.session.situations.length - answeredCount)}개 남음</small></summary>
          <div className={styles.choicePanelBody}>
            {activeSituation && <nav className={styles.situationNav} aria-label="상황 이동">
              <button type="button" className={styles.secondaryButton} disabled={activeIndex <= 0}
                onClick={() => setSelection({ sessionId: state.session!.id, index: activeIndex - 1 })}>이전</button>
              <span>{activeIndex + 1} / {state.session.situations.length}</span>
              <button type="button" className={styles.secondaryButton} disabled={activeIndex >= state.session.situations.length - 1}
                onClick={() => setSelection({ sessionId: state.session!.id, index: activeIndex + 1 })}>다음</button>
            </nav>}
            {!activeSituation && <div className={styles.emptySituation}><h2>등록된 상황이 없습니다</h2><button className={styles.secondaryButton} onClick={state.retryLoad}>상태 새로고침</button></div>}
            {activeSituation && <SituationCard key={activeSituation.id} situation={activeSituation} selectedChoiceId={state.selected[activeSituation.id]}
              done={Boolean(state.answered[activeSituation.id])} acceptingChoices={state.session.accepting_choices}
              submitting={state.submitting === activeSituation.id} submissionInProgress={state.submitting !== null}
              retrying={state.pending?.session_id === state.session.id && state.pending?.situation_id === activeSituation.id} hasPendingSubmission={state.pending !== null}
              message={state.messages[activeSituation.id] ?? ""} onSelect={choiceId => state.selectChoice(activeSituation.id, choiceId)}
              onSubmit={() => void state.submit(activeSituation)} />}
          </div>
        </details>
      </section>
    </main>
  );
}
