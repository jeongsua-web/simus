import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return <main className={styles.page}>
    <section className={styles.hero}>
      <div className={styles.copy}>
        <p className={styles.eyebrow}>CITY CHOICE SIMULATION</p>
        <h1>당신의 선택이<br/>도시를 바꿉니다.</h1>
        <p className={styles.lead}>도시에서 벌어지는 상황을 읽고 행동을 선택하세요. 모두의 결정이 행복, 안전, 청결과 지역 환경에 함께 반영됩니다.</p>
        <Link className={styles.start} href="/participate">참여 시작하기 <span aria-hidden>→</span></Link>
        <p className={styles.note}>개인 성향 결과는 회차가 최종 확정된 뒤 공개됩니다.</p>
      </div>
      <div className={styles.city} aria-hidden="true">
        <div className={styles.sun}/><div className={styles.tower}/><div className={styles.blockA}/><div className={styles.blockB}/><div className={styles.park}/><div className={styles.road}/>
      </div>
    </section>
  </main>;
}
