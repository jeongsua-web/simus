"use client";

import { useEffect, useRef, useState } from "react";
import { BRIDGE_CHANNEL, BRIDGE_VERSION, matchesOwnSnapshot, readUnityEvent } from "./unity-bridge";
import type { NpcSnapshot } from "./npc-motion";
import styles from "./participate.module.css";
import { cityBuildBase, isCityV002Map } from "@/lib/city-builds";

type View = { phase: "loading" | "ready" | "error"; message: string; src?: string; zoomSupported?: boolean };

export default function UnityCity({ sessionId }: { sessionId: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const zoomCommand = useRef<((zoom: number) => void) | null>(null);
  const [zoom, setZoom] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<View>({ phase: "loading", message: "도시를 준비하고 있습니다…" });

  useEffect(() => {
    const controller = new AbortController();
    const bridgeId = crypto.randomUUID();
    let disposed = false, failed = false, ready = false, bound = false, busy = false;
    let mapVersion = "", pathVersion = "", own: NpcSnapshot | null = null;
    const send = (type: string, payload: object = {}) => frame.current?.contentWindow?.postMessage({
      channel: BRIDGE_CHANNEL, version: BRIDGE_VERSION, bridge_id: bridgeId, type, ...payload,
    }, location.origin);
    zoomCommand.current = value => {
      if (bound && !failed && !disposed) send("SET_ZOOM", { zoom: value });
    };
    const fail = (message: string) => {
      if (disposed || failed) return;
      failed = true;
      controller.abort();
      // Removing the iframe also disposes a failed WebGL runtime.
      setView({ phase: "error", message });
    };
    const deadline = window.setTimeout(() => fail("도시 연결에 시간이 오래 걸리고 있습니다. 다시 시도해 주세요."), 180_000);
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
        if (data.npcs[0].motion.path_version !== pathVersion) {
          fail("이 회차의 캐릭터 경로 버전이 변경되었습니다. 관리자에게 문의해 주세요."); return;
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
      if (message.type === "ZOOM_CHANGED" && bound) { setZoom(message.zoom!); return; }
      if (message.type === "ERROR") { fail("도시를 표시하지 못했습니다. 다시 시도해 주세요."); return; }
      if (message.type === "READY") {
        if (message.map_version !== mapVersion) { fail("도시 버전이 맞지 않습니다. 잠시 후 다시 시도해 주세요."); return; }
        ready = true;
        setView(v => ({ ...v, zoomSupported: message.camera_zoom === true }));
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
      setZoom(1);
      setView({ phase: "loading", message: "도시를 준비하고 있습니다…" });
      try {
        const ownResponse = await fetch(`/api/sessions/${sessionId}/npc`, { cache: "no-store", signal: controller.signal });
        if (!ownResponse.ok) throw new Error("NPC unavailable");
        const initial = await ownResponse.json();
        const sessionMap = initial.npcs?.[0]?.motion?.map_version;
        if (typeof sessionMap !== "string" || !matchesOwnSnapshot(initial, sessionId, sessionMap)) throw new Error("Invalid NPC");
        const base = cityBuildBase(sessionMap);
        const response = await fetch(`${base}/build.json`, { cache: "no-store", signal: controller.signal });
        if (response.status === 404) { fail("도시 화면을 준비 중입니다. 잠시 후 다시 시도해 주세요."); return; }
        if (!response.ok) throw new Error("Build unavailable");
        const build = await response.json();
        if (build.protocol_version !== BRIDGE_VERSION || typeof build.map_version !== "string" || !build.map_version.trim()) throw new Error("Invalid build");
        if (build.map_version !== sessionMap || build.npc_motion_enabled === false ||
            (isCityV002Map(sessionMap) && (build.npc_motion_enabled !== true || !Array.isArray(build.path_versions) || !build.path_versions.includes(initial.npcs[0].motion.path_version)))) {
          fail("회차의 도시 또는 경로 버전과 배포 빌드가 맞지 않습니다. 관리자에게 문의해 주세요."); return;
        }
        if (disposed || failed) return;
        mapVersion = build.map_version;
        pathVersion = initial.npcs[0].motion.path_version;
        own = initial;
        setView({ phase: "loading", message: "도시를 불러오고 있습니다…", src: `${base}/index.html?bridge_id=${encodeURIComponent(bridgeId)}` });
      } catch { fail("도시를 불러오지 못했습니다. 연결을 확인하고 다시 시도해 주세요."); }
    }
    void prepare();
    return () => {
      send("DISPOSE");
      disposed = true;
      zoomCommand.current = null;
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
    <div className={styles.cityOverlay}>
      <div className={styles.cityStatus} role={view.phase === "error" ? "alert" : "status"}>
        <p>{view.message}</p>
        {view.phase === "loading" && <span>처음 접속할 때는 시간이 걸릴 수 있어요.</span>}
        {view.phase === "error" && <button className={styles.secondaryButton} onClick={() => setAttempt(n => n + 1)}>도시 다시 연결</button>}
      </div>
      {view.phase === "ready" && view.zoomSupported && <div className={styles.cityZoom} role="group" aria-label="캐릭터 화면 확대·축소">
        <button type="button" aria-label="캐릭터 화면 축소" title="축소" disabled={zoom <= .5} onClick={() => zoomCommand.current?.(Math.max(.5, zoom / 1.25))}>−</button>
        <button type="button" aria-label="기본 배율로 되돌리기" title="기본 배율로 되돌리기" onClick={() => zoomCommand.current?.(1)}>{Math.round(zoom * 100)}%</button>
        <button type="button" aria-label="캐릭터 화면 확대" title="확대" disabled={zoom >= 4} onClick={() => zoomCommand.current?.(Math.min(4, zoom * 1.25))}>+</button>
      </div>}
    </div>
  </section>;
}
