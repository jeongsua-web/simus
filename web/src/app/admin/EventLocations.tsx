"use client";

import { useState } from "react";

type Situation = { id: string; code: string; title: string; is_generic: boolean; event_location: { point: number[] } | null; mapping_status?: string | null; mapping_reason?: string | null };
type Anchor = { id: string; position: number[] };

export default function EventLocations({ sessionId, mapVersion, token, onSaved }: {
  sessionId: string; mapVersion: string; token: string; onSaved: () => Promise<void>;
}) {
  const [situations, setSituations] = useState<Situation[]>([]);
  const [anchors, setAnchors] = useState<Anchor[]>([]);
  const [situationId, setSituationId] = useState("");
  const [anchorId, setAnchorId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/sessions/${sessionId}/event-locations`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw Error(data.error?.message ?? "상황 위치를 불러오지 못했습니다.");
      setSituations(data.situations); setAnchors(data.anchors);
      setSituationId(data.situations[0]?.id ?? ""); setAnchorId(data.anchors[0]?.id ?? "");
    } catch (e) { setError(e instanceof Error ? e.message : "상황 위치 조회 실패"); }
    finally { setBusy(false); }
  }
  async function save(generic: boolean) {
    const anchor = anchors.find(a => a.id === anchorId);
    if (!situationId || (!generic && !anchor)) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/sessions/${sessionId}/event-locations`, {
        method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ situation_id: situationId, is_generic: generic,
          event_location: generic ? null : { place_id: `graph_${anchor!.id}`, map_version: mapVersion, point: anchor!.position, radius_m: 2 } }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error?.message ?? "상황 위치를 저장하지 못했습니다.");
      setSituations(rows => rows.map(row => row.id === situationId ? { ...row, ...data.situation } : row));
      await onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "상황 위치 저장 실패"); }
    finally { setBusy(false); }
  }
  return <details><summary>v002 상황 위치 설정</summary>
    <p>확인한 보행 지점을 선택하세요. 저장한 상황은 반경 2m에 도착하면 발생하고, 60초 동안 만나지 못하면 가까운 장소로 이동합니다. 미배치·상황 미구현 이벤트는 발생하지 않습니다.</p>
    <button type="button" disabled={busy} onClick={() => void load()}>상황 위치 불러오기</button>
    {situations.length > 0 && <fieldset disabled={busy}>
      <label>상황<select value={situationId} onChange={e => setSituationId(e.target.value)}>{situations.map(s => <option key={s.id} value={s.id}>{s.code} · {s.title} ({s.mapping_status?.startsWith("BLOCKED") ? "미구현" : s.event_location ? "위치 설정됨" : s.is_generic ? "공통" : "미배치"})</option>)}</select></label>
      {situations.find(s => s.id === situationId)?.mapping_reason && <p>{situations.find(s => s.id === situationId)!.mapping_reason}</p>}
      <label>보행 지점<select value={anchorId} onChange={e => setAnchorId(e.target.value)}>{anchors.map(a => <option key={a.id} value={a.id}>{a.id} [{a.position.join(", ")}]</option>)}</select></label>
      <button type="button" onClick={() => void save(false)}>이 위치에 저장</button>
      <button type="button" onClick={() => void save(true)}>공통 상황으로 저장</button>
    </fieldset>}
    {error && <p role="alert">{error}</p>}
  </details>;
}
