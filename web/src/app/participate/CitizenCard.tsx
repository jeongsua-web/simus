import type { Ref } from "react";
import { CITIZEN_GLASSES, getCitizenCharacter, getDefaultCitizenGlasses } from "@/lib/citizen-characters";
import styles from "./CitizenCard.module.css";

export default function CitizenCard({ nickname, department, mbti, citizenNo, status = "waiting", cardRef, characterId, glassesId }: {
  characterId?: string | null; glassesId?: string | null; nickname?: string; department?: string; mbti: string; citizenNo?: string;
  status?: "waiting" | "ready" | "issued"; cardRef?: Ref<HTMLElement>;
}) {
  const character = getCitizenCharacter(characterId, glassesId);
  const glasses = CITIZEN_GLASSES.find(item => item.id === (glassesId ?? getDefaultCitizenGlasses(characterId)));
  return (
    <article ref={cardRef} className={styles.card} aria-label={status === "issued" ? "내 시민증" : "시민증 미리보기"}>
      <header className={styles.header}>
        <div className={styles.emblem} aria-hidden="true">S</div>
        <div><h2>시민증</h2><p>SIM:US CITIZEN CARD</p></div>
        <span className={styles.brand}>SIM:US</span>
      </header>
      <div className={styles.body}>
        <div className={styles.portrait}>
          {character ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={character.portrait} alt={`${character.label} · ${glasses?.label ?? "안경 없음"} 정면 모습`} width={160} height={200} />
          ) : (
          <svg viewBox="0 0 80 100" fill="none"><circle cx="40" cy="34" r="17" fill="currentColor"/><path d="M9 94V82c0-21 13-31 31-31s31 10 31 31v12" fill="currentColor"/></svg>)}
          <span>{character?.label ?? "캐릭터 미선택"}</span>
        </div>
        <dl className={styles.fields}>
          <div><dt>성명 · NICKNAME</dt><dd className={`${styles.name} ${nickname ? "" : styles.empty}`}>{nickname || "닉네임"}</dd></div>
          <div><dt>소속 · DEPARTMENT</dt><dd className={!department ? styles.empty : undefined}>{department || "학과 미선택"}</dd></div>
          <div className={styles.meta}><div><dt>시민번호</dt><dd className={styles.number}>{citizenNo || "발급 예정"}</dd></div><div><dt>MBTI</dt><dd className={styles.number}>{mbti}</dd></div></div>
        </dl>
      </div>
      <footer className={styles.footer}>
        <div><strong>SIM:US 시민등록국</strong><span>함께 살아가는 도시의 시민</span></div>
        <span className={`${styles.seal} ${status === "issued" ? styles.issued : ""}`}>{status === "issued" ? "발급 완료" : status === "ready" ? "발급 준비" : "등록 대기"}</span>
      </footer>
    </article>
  );
}
