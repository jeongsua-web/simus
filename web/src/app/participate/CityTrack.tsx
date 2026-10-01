"use client";

import { useEffect, useRef, useState } from "react";
import { motionTime, npcPosition, type Npc, type NpcSnapshot } from "./npc-motion";
import styles from "./participate.module.css";

type TimedSnapshot = { value: NpcSnapshot; receivedAt: number };

export default function CityTrack({ sessionId }: { sessionId: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const snapshots = useRef<{ own?: TimedSnapshot; crowd?: TimedSnapshot }>({});
  const [status, setStatus] = useState("도시에 입장하는 중…");
  const [ownId, setOwnId] = useState("");

  useEffect(() => {
    snapshots.current = {};
    let active = true, busy = false;
    const controller = new AbortController();
    async function poll() {
      if (!active || busy || document.hidden) return;
      busy = true;
      try {
        const requestStart = performance.now();
        const [self, crowd] = await Promise.all([
          fetch(`/api/sessions/${sessionId}/npc`, { cache: "no-store", signal: controller.signal }),
          fetch(`/api/sessions/${sessionId}/npcs`, { cache: "no-store", signal: controller.signal }),
        ]);
        if (!self.ok || !crowd.ok) throw new Error("NPC 정보를 불러오지 못했습니다.");
        const [mine, all] = await Promise.all([self.json(), crowd.json()]) as [NpcSnapshot, NpcSnapshot];
        if (mine.session_id !== sessionId || all.session_id !== sessionId || mine.npcs.length !== 1)
          throw new Error("회차 정보가 바뀌었습니다. 잠시 후 다시 확인합니다.");
        if (!active) return;
        const receivedAt = (requestStart + performance.now()) / 2;
        snapshots.current = { own: { value: mine, receivedAt }, crowd: { value: all, receivedAt } };
        setOwnId(mine.npcs[0].npc_id);
        setStatus(mine.frozen ? "회차가 끝나 캐릭터가 멈췄습니다." : "내 캐릭터를 따라가는 중");
      } catch {
        if (active && !controller.signal.aborted) setStatus("도시 연결을 확인하고 있습니다. 마지막 위치를 표시합니다.");
      } finally { busy = false; }
    }
    void poll();
    const timer = window.setInterval(poll, 2500);
    document.addEventListener("visibilitychange", poll);
    window.addEventListener("online", poll);
    return () => { active = false; controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", poll); window.removeEventListener("online", poll); };
  }, [sessionId]);

  useEffect(() => {
    let frame = 0;
    const element = canvas.current;
    if (!element) return;
    const context = element.getContext("2d");
    if (!context) return;
    function draw() {
      if (!element || !context) return;
      const width = element.clientWidth, height = element.clientHeight;
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      if (element.width !== Math.round(width * ratio) || element.height !== Math.round(height * ratio)) {
        element.width = Math.round(width * ratio); element.height = Math.round(height * ratio);
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      const own = snapshots.current.own, crowd = snapshots.current.crowd;
      const me = own?.value.npcs[0];
      const now = performance.now();
      const meAt = own ? motionTime(own.value, own.receivedAt, now) : 0;
      const position = me ? npcPosition(me, meAt) : null;
      const cameraX = position?.[0] ?? -64, cameraZ = position?.[2] ?? 28;
      const scale = Math.min(width / 36, height / 46);
      const project = (x: number, z: number): [number, number] => [width / 2 + (x - cameraX) * scale, height / 2 + (z - cameraZ) * scale];
      context.fillStyle = "#d6ead8"; context.fillRect(0, 0, width, height);
      // The existing Unity walkway is x=-64, z=12..45; the camera tracks the local player.
      const roadLeft = project(-67, 0)[0], roadRight = project(-61, 0)[0];
      context.fillStyle = "#aab6ad"; context.fillRect(roadLeft, 0, roadRight - roadLeft, height);
      context.strokeStyle = "#f6fbf0"; context.lineWidth = 2; context.setLineDash([10, 12]);
      context.beginPath(); context.moveTo(project(-64, 0)[0], 0); context.lineTo(project(-64, 0)[0], height); context.stroke(); context.setLineDash([]);
      for (let z = 4; z <= 56; z += 12) for (const side of [-1, 1]) {
        const [x, y] = project(-64 + side * 11, z);
        context.fillStyle = side < 0 ? "#6e997e" : "#87aa89";
        context.fillRect(x - 18, y - 16, 36, 32);
        context.fillStyle = "#e7f0d4"; context.fillRect(x - 10, y - 9, 20, 11);
      }
      if (crowd) {
        const at = motionTime(crowd.value, crowd.receivedAt, now);
        for (const npc of crowd.value.npcs) {
          if (npc.npc_id === me?.npc_id) continue;
          marker(npc, at, false);
        }
      }
      if (me) marker(me, meAt, true);
      function marker(npc: Npc, at: number, self: boolean) {
        const p = npcPosition(npc, at); if (!p) return;
        const [x, y] = project(p[0], p[2]);
        if (x < -20 || x > width + 20 || y < -20 || y > height + 20) return;
        context!.beginPath(); context!.arc(x, y, self ? 12 : 7, 0, Math.PI * 2);
        context!.fillStyle = self ? "#176a43" : "#f4b347"; context!.fill();
        context!.lineWidth = self ? 3 : 2; context!.strokeStyle = "#fff"; context!.stroke();
        if (self) { context!.fillStyle = "#173f2b"; context!.font = "bold 13px Arial"; context!.textAlign = "center"; context!.fillText("나", x, y - 19); }
      }
      frame = window.requestAnimationFrame(draw);
    }
    frame = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frame);
  }, [sessionId]);

  return <section className={styles.cityTrack} aria-label="내 캐릭터를 따라가는 도시">
    <canvas ref={canvas} className={styles.cityCanvas} aria-hidden="true" />
    <p className={styles.cityStatus} role="status">{status}{ownId && <span className={styles.npcTag}>NPC {ownId.slice(0, 8)}</span>}</p>
  </section>;
}
