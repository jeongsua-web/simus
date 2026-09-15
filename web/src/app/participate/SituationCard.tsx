import type { Situation } from "./types";
import styles from "./participate.module.css";

type SituationCardProps = {
  situation: Situation;
  selectedChoiceId?: string;
  done: boolean;
  acceptingChoices: boolean;
  submitting: boolean;
  submissionInProgress: boolean;
  retrying: boolean;
  hasPendingSubmission: boolean;
  message: string;
  onSelect: (choiceId: string) => void;
  onSubmit: () => void;
};

export default function SituationCard({
  situation, selectedChoiceId, done, acceptingChoices, submitting,
  submissionInProgress, retrying, hasPendingSubmission, message,
  onSelect, onSubmit,
}: SituationCardProps) {
  const locked = done || !acceptingChoices || submissionInProgress || hasPendingSubmission;
  const submitDisabled = done || !acceptingChoices || submissionInProgress ||
    (!retrying && hasPendingSubmission) || !selectedChoiceId;

  return (
    <section className={styles.card}>
      <h2 className={styles.situationTitle}>{situation.title}</h2>
      <p className={styles.body}>{situation.body}</p>

      <fieldset disabled={locked} className={styles.choices}>
        <legend className={styles.legend}>행동 하나를 선택해주세요.</legend>
        {situation.choices.map((choice) => (
          <label
            key={choice.id}
            className={styles.choice}
            data-selected={selectedChoiceId === choice.id}
            data-locked={locked}
          >
            <input
              type="radio"
              name={situation.id}
              value={choice.id}
              checked={selectedChoiceId === choice.id}
              onChange={() => onSelect(choice.id)}
            />
            {choice.label}
          </label>
        ))}
      </fieldset>

      <p className={styles.hint}>제출한 선택은 취소하거나 변경할 수 없어요.</p>
      <button
        className={`${styles.button} ${styles.submitButton}`}
        data-closed={done || !acceptingChoices}
        disabled={submitDisabled}
        onClick={onSubmit}
      >
        {done
          ? "제출 완료"
          : submitting
            ? "제출 중…"
            : retrying
              ? "같은 선택으로 다시 확인"
              : "선택 제출"}
      </button>
      <p role="status" aria-live="polite" className={styles.message}>{message}</p>
    </section>
  );
}
