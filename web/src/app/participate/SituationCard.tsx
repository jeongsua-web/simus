import type { Situation } from "./types";
import styles from "./participate.module.css";

type Props = {
  situation: Situation; selectedChoiceId?: string; done: boolean; acceptingChoices: boolean;
  submitting: boolean; submissionInProgress: boolean; retrying: boolean; hasPendingSubmission: boolean;
  message: string; onSelect: (choiceId: string) => void; onSubmit: () => void;
};

export default function SituationCard(props: Props) {
  const { situation, selectedChoiceId, done, acceptingChoices, submitting, submissionInProgress,
    retrying, hasPendingSubmission, message, onSelect, onSubmit } = props;
  const locked = done || !acceptingChoices || submissionInProgress || hasPendingSubmission;
  const submitDisabled = done || (!acceptingChoices && !retrying) || submissionInProgress ||
    (!retrying && hasPendingSubmission) || !selectedChoiceId;
  return (
    <section className={styles.card} aria-labelledby={`title-${situation.id}`}>
      <h2 id={`title-${situation.id}`} className={styles.situationTitle}>{situation.title}</h2>
      <p className={styles.body}>{situation.body}</p>
      <fieldset disabled={locked} className={styles.choices}>
        <legend className={styles.legend}>행동 하나를 선택해 주세요.</legend>
        {situation.choices.map(choice => (
          <label key={choice.id} className={styles.choice} data-selected={selectedChoiceId === choice.id} data-locked={locked}>
            <input type="radio" name={situation.id} value={choice.id} checked={selectedChoiceId === choice.id}
              onChange={() => onSelect(choice.id)} />
            <span>{choice.label}</span>
          </label>
        ))}
      </fieldset>
      <p className={styles.hint}>제출한 선택은 변경할 수 없습니다.</p>
      <button type="button" className={`${styles.button} ${styles.submitButton}`} data-closed={done || !acceptingChoices}
        disabled={submitDisabled} onClick={onSubmit}>
        {done ? "응답 완료" : submitting ? "제출 중…" : retrying ? "같은 선택으로 다시 확인" : !acceptingChoices ? "접수 마감" : "선택 제출"}
      </button>
      <p role="status" aria-live="polite" className={styles.message}>{message || (retrying ? "접수 여부가 확인되지 않았습니다. 같은 선택으로 다시 확인해 주세요." : hasPendingSubmission && !done ? "미확인 제출을 먼저 확인해 주세요. 해당 상황 또는 이전 회차 제출 확인에서 재시도할 수 있습니다." : !acceptingChoices && !done ? "접수가 마감되었습니다. 아래 결과 상태 확인으로 이동해 주세요." : "")}</p>
    </section>
  );
}
