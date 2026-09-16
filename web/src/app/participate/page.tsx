"use client";

import Link from "next/link";
import SituationCard from "./SituationCard";
import { useParticipation } from "./useParticipation";
import styles from "./participate.module.css";

export default function ParticipatePage() {
  const state = useParticipation();
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
      </div></main>
    );
  }
  const answeredCount = Object.values(state.answered).filter(Boolean).length;
  const complete = answeredCount >= state.session.situations.length && state.session.situations.length > 0;
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>우리의 선택이 만드는 도시</p>
        <h1 className={styles.title}>SIM:US</h1>
        <p className={styles.sessionName}>{state.session.name}</p>
        <div className={styles.progress} aria-label={`전체 ${state.session.situations.length}개 중 ${answeredCount}개 응답 완료`}>
          <span>{answeredCount} / {state.session.situations.length} 응답</span>
          <progress value={answeredCount} max={Math.max(1, state.session.situations.length)} />
        </div>
      </header>
      {complete && <section className={styles.notice} role="status"><strong>응답 완료</strong><span>결과는 회차가 끝나고 확정된 뒤 공개됩니다.</span></section>}
      {!state.session.accepting_choices && <section className={styles.closedNotice} role="status">
        <strong>{state.session.status === "FINALIZED" ? "결과 확정" : state.session.status === "CLOSING" ? "결과 준비 중" : "접수 마감"}</strong>
        <span>{state.session.status === "FINALIZED" ? "내 결과를 확인할 수 있습니다." : state.session.status === "CLOSING" ? "서버가 최종 결과를 확정하고 있습니다." : "회차 종료 시각까지 기다려 주세요."}</span>
      </section>}
      {state.session.situations.map(situation => (
        <SituationCard key={situation.id} situation={situation} selectedChoiceId={state.selected[situation.id]}
          done={Boolean(state.answered[situation.id])} acceptingChoices={state.session!.accepting_choices}
          submitting={state.submitting === situation.id} submissionInProgress={state.submitting !== null}
          retrying={state.pending?.situation_id === situation.id} hasPendingSubmission={state.pending !== null}
          message={state.messages[situation.id] ?? ""} onSelect={choiceId => state.selectChoice(situation.id, choiceId)}
          onSubmit={() => void state.submit(situation)} />
      ))}
      {(complete || !state.session.accepting_choices) && <Link className={styles.buttonLink} href={`/result/${state.session.id}`}>결과 상태 확인</Link>}
    </main>
  );
}
