"use client";

import { useEffect, useRef, useState } from "react";
import { BRIDGE_CHANNEL, BRIDGE_VERSION, readUnityEvent } from "../participate/unity/unity-bridge";
import { cityBuildBase, V003_MAP_VERSION } from "@/lib/city/city-builds";
import styles from "./admin.module.css";

type Stats = { happiness: number; safety: number; cleanliness: number; pollution: number; economy: number };
type Session = { id: string; name: string; map_version: string | null; preview_stats: Omit<Stats, "economy" | "pollution"> & { pollution: number | null } | null };
const labels = { happiness: "행복도", safety: "치안", cleanliness: "청결도", pollution: "오염도", economy: "경제" };

export default function DeveloperMode({ sessions }: { sessions: Session[] }) {
  const [selected, setSelected] = useState("");
  const available = sessions.filter(s => s.map_version === V003_MAP_VERSION && s.preview_stats);
  const session = available.find(s => s.id === selected);
  return <section className={`${styles.card} ${styles.creation}`} aria-label="개발자 모드">
    <h2>개발자 모드</h2>
    <p>관리자 화면의 도시만 바꾸는 임시 테스트입니다. 회차 데이터와 통계에는 저장하지 않습니다.</p>
    <label>테스트 회차 <select value={selected} onChange={e => setSelected(e.target.value)}>
      <option value="">회차 선택</option>{available.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select></label>
    {!available.length && <p>스탯 시각화가 연결된 v003 회차가 없습니다.</p>}
    {session && <Preview key={session.id} session={session} onClose={() => setSelected("")} />}
  </section>;
}

function Preview({ session, onClose }: { session: Session; onClose: () => void }) {
  const [initial] = useState<Stats>(() => ({ ...session.preview_stats!, pollution: session.preview_stats!.pollution ?? 50, economy: 50 }));
  const [stats, setStats] = useState(initial);
  const [src, setSrc] = useState("");
  const [message, setMessage] = useState("도시를 불러오고 있습니다…");
  const [ready, setReady] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const command = useRef<((stats: Stats | null) => void) | null>(null);

  useEffect(() => {
    const bridgeId = crypto.randomUUID();
    const send = (type: string, payload: object = {}) => frame.current?.contentWindow?.postMessage({
      channel: BRIDGE_CHANNEL, version: BRIDGE_VERSION, bridge_id: bridgeId, type, ...payload,
    }, location.origin);
    const deadline = window.setTimeout(() => setMessage("도시 연결 시간이 초과되었습니다. 테스트를 닫고 다시 선택해 주세요."), 180_000);
    function receive(event: MessageEvent) {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow) return;
      const eventData = readUnityEvent(event.data, bridgeId);
      if (!eventData) return;
      if (eventData.type === "ERROR") { setReady(false); setMessage("도시 연결에 실패했습니다. 테스트를 닫고 다시 선택해 주세요."); return; }
      if (eventData.type !== "READY") return;
      window.clearTimeout(deadline);
      if (eventData.map_version !== session.map_version) { setMessage("회차와 도시 빌드의 버전이 다릅니다."); return; }
      if ((event.data as { stat_preview?: boolean }).stat_preview !== true) {
        setMessage("현재 WebGL 빌드는 스탯 조절을 지원하지 않습니다. 변경된 Unity 코드로 재빌드·배포가 필요합니다."); return;
      }
      command.current = value => send(value ? "SET_STAT_PREVIEW" : "CLEAR_STAT_PREVIEW", value ? { stats: value } : {});
      setReady(true);
      setMessage("테스트 준비 완료 · 슬라이더를 움직이면 이 도시 화면에만 반영됩니다.");
    }
    const visibility = () => send("VISIBILITY", { visible: !document.hidden });
    window.addEventListener("message", receive);
    document.addEventListener("visibilitychange", visibility);
    setSrc(`${cityBuildBase(session.map_version!)}/index.html?bridge_id=${bridgeId}`);
    return () => {
      send("CLEAR_STAT_PREVIEW"); send("DISPOSE"); command.current = null;
      clearTimeout(deadline); window.removeEventListener("message", receive);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [session.id, session.map_version]);

  function change(next: Stats) { setStats(next); command.current?.(next); }
  return <div>
    <p role="status">{message}</p>
    <p>경제 시각화는 Unity에 미구현되어 수치만 조절됩니다. 오염도 값이 없는 회차는 테스트 시작값 50을 사용합니다.</p>
    {src && <iframe ref={frame} src={src} title="관리자 전용 도시 스탯 미리보기" className={styles.developerCity} onError={() => { setReady(false); setMessage("도시를 불러오지 못했습니다."); }} />}
    <fieldset className={styles.developerStats} disabled={!ready}>
      {(Object.keys(labels) as (keyof Stats)[]).map(key => <label key={key}>
        <span>{labels[key]} <output>{stats[key]}</output>{key === "economy" && " (시각 효과 없음)"}</span>
        <input type="range" min={0} max={100} step={1} value={stats[key]} onChange={e => change({ ...stats, [key]: Number(e.target.value) })} />
      </label>)}
    </fieldset>
    <div className={styles.actions}>
      <button disabled={!ready} onClick={() => change({ happiness: 80, safety: 80, cleanliness: 80, pollution: 10, economy: 80 })}>정상 도시</button>
      <button disabled={!ready} onClick={() => change({ happiness: 0, safety: 0, cleanliness: 0, pollution: 100, economy: 0 })}>최악의 도시</button>
      <button disabled={!ready} onClick={() => change({ ...stats, pollution: 100 })}>오염 극대화</button>
      <button disabled={!ready} onClick={() => { setStats(initial); command.current?.(null); }}>초기화</button>
      <button className={styles.quiet} onClick={onClose}>테스트 닫기</button>
    </div>
  </div>;
}
