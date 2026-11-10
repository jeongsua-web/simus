"use client";

import { useEffect, useState } from "react";
import styles from "./participate.module.css";

export default function Population({ sessionId }: { sessionId: string }) {
  const [count, setCount] = useState<number | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true, busy = false;
    const controller = new AbortController();
    async function poll() {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const response = await fetch(`/api/sessions/${sessionId}/population`, {
          method: "POST", cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) throw new Error("Population unavailable");
        const data = await response.json();
        if (data.session_id !== sessionId || !Number.isSafeInteger(data.online_count) || data.online_count < 0)
          throw new Error("Invalid population");
        if (active) { setCount(data.online_count); setUnavailable(false); }
      } catch { if (active) setUnavailable(true); }
      finally { busy = false; }
    }
    void poll();
    const timer = window.setInterval(poll, 15_000);
    document.addEventListener("visibilitychange", poll);
    window.addEventListener("online", poll);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
      window.removeEventListener("online", poll);
    };
  }, [sessionId]);

  return <div className={styles.population} role="status" aria-live="polite"
    title="최근 45초 이내 접속이 확인된 이번 회차의 시민 수입니다. 15초마다 갱신됩니다.">
    <span className={styles.populationDot} aria-hidden="true" data-offline={unavailable}/>
    <span>현재 인구 <strong>{unavailable ? "확인 중" : count === null ? "…" : `${count.toLocaleString("ko-KR")}명`}</strong></span>
  </div>;
}
