import Link from "next/link";
import UnityPreview from "./UnityPreview";
import styles from "./unity.module.css";

export default function UnityPage() {
  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/">← SIM:US 홈</Link>
      <p className={styles.eyebrow}>UNITY WEBGL</p>
      <h1>도시 미리보기</h1>
      <p>제작 중인 대학 맵에서 캐릭터가 이동하는 모습을 확인하세요.</p>
    </header>
    <UnityPreview />
    <p className={styles.note}>추적 테스트 장면입니다. 참여 회차와 선택 결과는 연결되지 않습니다.</p>
    <Link className={styles.link} href="/participate">참여 화면으로 이동 →</Link>
  </main>;
}
