"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./unity.module.css";

export default function UnityPreview() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<"checking" | "available" | "error">("checking");
  const frame = useRef<HTMLIFrameElement>(null);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (state !== "available" || ready) return;
    const deadline = window.setTimeout(() => setState("error"), 180_000);
    return () => window.clearTimeout(deadline);
  }, [state, ready, attempt]);
  useEffect(() => {
    const controller = new AbortController();
    async function prepare() {
      setState("checking");
      setReady(false);
      setProgress(0);
      try {
        const response = await fetch("/unity-preview/build.json", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Preview unavailable");
        const build = await response.json();
        if (build.kind !== "npc-follow-preview" || build.exhibition_ready !== false || build.map_version !== null) throw new Error("Invalid preview");
        if (!controller.signal.aborted) setState("available");
      } catch { if (!controller.signal.aborted) setState("error"); }
    }
    function receive(event: MessageEvent) {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow || event.data?.channel !== "simus-unity-preview") return;
      if (event.data.type === "READY") setReady(true);
      if (event.data.type === "ERROR") setState("error");
      if (event.data.type === "PROGRESS" && typeof event.data.progress === "number" && Number.isFinite(event.data.progress)) setProgress(Math.max(0, Math.min(1, event.data.progress)));
    }
    window.addEventListener("message", receive);
    void prepare();
    return () => { controller.abort(); window.removeEventListener("message", receive); };
  }, [attempt]);

  return <section className={styles.viewer} aria-label="Unity 도시 미리보기" aria-busy={state === "checking" || (state === "available" && !ready)}>
    {state === "available" ? <iframe ref={frame} key={attempt} className={styles.frame} src={`/unity-preview/index.html?attempt=${attempt}`}
      title="대학 맵 캐릭터 추적 테스트" allow="fullscreen" allowFullScreen
      onError={() => setState("error")} /> : <div className={styles.status} role={state === "error" ? "alert" : "status"}>
      <p>{state === "checking" ? "도시 실행 파일을 확인하고 있습니다…" : "도시 미리보기를 불러오지 못했습니다."}</p>
      {state === "error" && <button onClick={() => setAttempt(value => value + 1)}>다시 연결</button>}
    </div>}
    {state === "available" && <>
      <p className={styles.runtimeStatus} role="status">{ready ? "캐릭터를 따라가는 중" : `도시를 불러오고 있습니다… ${Math.round(progress * 100)}%`}</p>
      <button className={styles.reload} onClick={() => setAttempt(value => value + 1)}>도시 다시 불러오기</button>
    </>}
  </section>;
}
