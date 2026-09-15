"use client";

import SituationCard from "./SituationCard";
import { useParticipation } from "./useParticipation";
import styles from "./participate.module.css";

export default function ParticipatePage() {
  const {
    session, loading, loadError, selected, answered, messages,
    submitting, pending, selectChoice, submit,
  } = useParticipation();

  if (loading) {
    return <main className={styles.page}>참여 정보를 불러오는 중이에요…</main>;
  }

  if (loadError) {
    return (
      <main className={styles.page}>
        <p role="alert">{loadError}</p>
        <button className={styles.button} onClick={() => window.location.reload()}>
          다시 불러오기
        </button>
      </main>
    );
  }

  if (!session) {
    return (
      <main className={styles.page}>
        <h1>SIM:US</h1>
        <p>현재 참여 가능한 회차가 없어요.</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.tagline}>우리의 선택이 만드는 도시</p>
        <h1 className={styles.title}>SIM:US</h1>
        <p>{session.name}</p>
      </header>

      {!session.accepting_choices && (
        <p role="status" className={styles.closedNotice}>
          선택 입력이 마감됐어요. 결과를 준비하고 있어요.
        </p>
      )}

      {session.situations.map((situation) => (
        <SituationCard
          key={situation.id}
          situation={situation}
          selectedChoiceId={selected[situation.id]}
          done={Boolean(answered[situation.id])}
          acceptingChoices={session.accepting_choices}
          submitting={submitting === situation.id}
          submissionInProgress={submitting !== null}
          retrying={pending?.situation_id === situation.id}
          hasPendingSubmission={pending !== null}
          message={messages[situation.id] ?? ""}
          onSelect={(choiceId) => selectChoice(situation.id, choiceId)}
          onSubmit={() => void submit(situation)}
        />
      ))}
    </main>
  );
}
