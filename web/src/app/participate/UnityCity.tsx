"use client";

import { useEffect, useRef, useState } from "react";
import { BRIDGE_CHANNEL, BRIDGE_VERSION, matchesOwnSnapshot, readUnityEvent } from "./unity-bridge";
import type { NpcSnapshot } from "./npc-motion";
import styles from "./participate.module.css";

type View = { phase: "loading" | "ready" | "error"; message: string; src?: string };

export default function UnityCity({ sessionId }: { sessionId: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<View>({ phase: "loading", message: "도시를 준비하고 있습니다…" });

  useEffect(() => {
    const controller = new AbortController();
    const bridgeId = crypto.randomUUID();
    let disposed = false, failed = false, ready = false, bound = false, busy = false;
    let mapVersion = "", own: NpcSnapshot | null = null;
    const send = (type: string, payload: object = {}) => frame.current?.contentWindow?.postMessage({
      channel: BRIDGE_CHANNEL, version: BRIDGE_VERSION, bridge_id: bridgeId, type, ...payload,
    }, location.origin);
    const fail = (message: string) => {
      if (disposed || failed) return;
      failed = true;
      controller.abort();
      // Removing the iframe also disposes a failed WebGL runtime.
      setView({ phase: "error", message });
    };
    const deadline = window.setTimeout(() => fail("도시 연결에 시간이 오래 걸리고 있습니다. 다시 시도해 주세요."), 60_000);
    async function sync() {
      if (disposed || failed || busy || !ready || document.hidden) return;
      busy = true;
      try {
        const response = await fetch(`/api/sessions/${sessionId}/npc`, { cache: "no-store", signal: controller.signal });
        if (response.status === 401) { fail("참여 인증을 확인할 수 없습니다. 참여 화면을 새로고침해 주세요."); return; }
        if (!response.ok) throw new Error("NPC request failed");
        const data: unknown = await response.json();
        if (!matchesOwnSnapshot(data, sessionId, mapVersion)) {
          fail("이 회차의 도시와 캐릭터 정보를 연결할 수 없습니다. 잠시 후 다시 시도해 주세요."); return;
        }
        if (disposed || failed) return;
        if (own && own.npcs[0].npc_id !== data.npcs[0].npc_id) { fail("캐릭터 정보가 변경되었습니다. 다시 연결해 주세요."); return; }
        own = data;
        send(bound ? "SNAPSHOT" : "INIT", { session_id: sessionId, own_npc_id: data.npcs[0].npc_id, snapshot: data });
        if (bound) setView(v => ({ ...v, phase: "ready", message: data.frozen ? "회차가 끝나 캐릭터가 멈췄습니다." : "내 캐릭터를 따라가는 중" }));
      } catch {
        if (!disposed && !failed) setView(v => ({ ...v, message: "도시 연결을 확인하고 있습니다…" }));
      } finally { busy = false; }
    }
    function receive(event: MessageEvent) {
      if (disposed || failed || event.origin !== location.origin || event.source !== frame.current?.contentWindow) return;
      const message = readUnityEvent(event.data, bridgeId);
      if (!message) return;
      if (message.type === "ERROR") { fail("도시를 표시하지 못했습니다. 다시 시도해 주세요."); return; }
      if (message.type === "READY") {
        if (message.map_version !== mapVersion) { fail("도시 버전이 맞지 않습니다. 잠시 후 다시 시도해 주세요."); return; }
        ready = true;
        send("VISIBILITY", { visible: !document.hidden });
        void sync();
      }
      if (message.type === "BOUND" && own && message.session_id === sessionId && message.npc_id === own.npcs[0].npc_id) {
        bound = true;
        window.clearTimeout(deadline);
        setView(v => ({ ...v, phase: "ready", message: own!.frozen ? "회차가 끝나 캐릭터가 멈췄습니다." : "내 캐릭터를 따라가는 중" }));
      }
    }
    const resume = () => { if (ready) send("VISIBILITY", { visible: !document.hidden }); void sync(); };
    window.addEventListener("message", receive);
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    const timer = window.setInterval(() => void sync(), 2500);
    async function prepare() {
      setView({ phase: "loading", message: "도시를 준비하고 있습니다…" });
      try {
        const response = await fetch("/city/build.json", { cache: "no-store", signal: controller.signal });
        if (response.status === 404) { fail("도시 화면을 준비 중입니다. 잠시 후 다시 시도해 주세요."); return; }
        if (!response.ok) throw new Error("Build unavailable");
        const build = await response.json();
        if (build.protocol_version !== BRIDGE_VERSION || typeof build.map_version !== "string" || !build.map_version.trim()) throw new Error("Invalid build");
        if (disposed || failed) return;
        mapVersion = build.map_version;
        setView({ phase: "loading", message: "도시를 불러오고 있습니다…", src: `/city/index.html?bridge_id=${encodeURIComponent(bridgeId)}` });
      } catch { fail("도시를 불러오지 못했습니다. 연결을 확인하고 다시 시도해 주세요."); }
    }
    void prepare();
    return () => {
      send("DISPOSE");
      disposed = true;
      controller.abort();
      window.clearTimeout(deadline);
      window.clearInterval(timer);
      window.removeEventListener("message", receive);
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [sessionId, attempt]);

  return <section className={styles.cityTrack} aria-label="내 캐릭터를 따라가는 도시" aria-busy={view.phase === "loading"}>
    {view.src && <iframe key={view.src} ref={frame} src={view.src} title="SIM:US 도시" className={styles.cityFrame}
      style={{ visibility: view.phase === "ready" ? "visible" : "hidden" }} onError={() => setView({ phase: "error", message: "도시를 불러오지 못했습니다. 다시 시도해 주세요." })} />}
    <div className={styles.cityStatus} role={view.phase === "error" ? "alert" : "status"}>
      <p>{view.message}</p>
      {view.phase === "loading" && <span>처음 접속할 때는 시간이 걸릴 수 있어요.</span>}
      {view.phase === "error" && <button className={styles.secondaryButton} onClick={() => setAttempt(n => n + 1)}>도시 다시 연결</button>}
    </div>
  </section>;
}
