"use client";

import { useState } from "react";

type EventLocation = { map_version: string; place_id?: string; point: number[]; radius_m: number };
type Situation = { id: string; code: string; title: string; is_generic: boolean; event_location: EventLocation | null };
type Anchor = { id: string; position: number[] };
const SAVED_LOCATION = "__saved_location__";
const PLACE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export default function EventLocations({ sessionId, mapVersion, token, onSaved }: {
  sessionId: string; mapVersion: string; token: string; onSaved: () => Promise<void>;
}) {
  const [situations, setSituations] = useState<Situation[]>([]);
  const [anchors, setAnchors] = useState<Anchor[]>([]);
  const [situationId, setSituationId] = useState("");
  const [anchorId, setAnchorId] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [radius, setRadius] = useState("2");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function selectSituation(situation: Situation | undefined, availableAnchors = anchors) {
    setSituationId(situation?.id ?? "");
    setAnchorId(situation?.event_location ? SAVED_LOCATION : availableAnchors[0]?.id ?? "");
    setPlaceId(situation?.event_location?.place_id ?? "");
    setRadius(String(situation?.event_location?.radius_m ?? 2));
  }
  async function load() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/sessions/${sessionId}/event-locations`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw Error(data.error?.message ?? "상황 위치를 불러오지 못했습니다.");
      setSituations(data.situations); setAnchors(data.anchors);
      selectSituation(data.situations[0], data.anchors);
    } catch (e) { setError(e instanceof Error ? e.message : "상황 위치 조회 실패"); }
    finally { setBusy(false); }
  }
  async function save(generic: boolean) {
    const anchor = anchors.find(a => a.id === anchorId);
    const situation = situations.find(s => s.id === situationId);
    const point = anchorId === SAVED_LOCATION ? situation?.event_location?.point : anchor?.position;
    const radiusM = Number(radius);
    if (!situation) return;
    if (!generic && !PLACE_ID.test(placeId.trim())) {
      setError("장소 ID는 영문·숫자로 시작하는 1~128자의 영문·숫자·점·밑줄·하이픈으로 입력해주세요.");
      return;
    }
    if (!generic && (!point || !Number.isFinite(radiusM) || radiusM <= 0 || radiusM > 1e6)) {
      setError("확인한 보행 지점과 양수 반경을 지정해주세요.");
      return;
    }
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/sessions/${sessionId}/event-locations`, {
        method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ situation_id: situationId, is_generic: generic,
          event_location: generic ? null : { map_version: mapVersion, place_id: placeId.trim(), point, radius_m: radiusM } }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error?.message ?? "상황 위치를 저장하지 못했습니다.");
      setSituations(rows => rows.map(row => row.id === situationId ? { ...row, ...data.situation } : row));
      selectSituation({ ...situation, ...data.situation });
      await onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "상황 위치 저장 실패"); }
    finally { setBusy(false); }
  }
  const selectedLocation = situations.find(s => s.id === situationId)?.event_location;
  return <details><summary>v002 상황 위치 설정</summary>
    <p>실제 씬에서 확인한 보행 지점과 장소 ID를 설정하세요. 저장한 반경에 도착하면 이벤트가 발생합니다. 위치가 없는 상황은 자동 발생하지 않으며, 90초가 지나도 도착 전에는 강제로 발생하지 않습니다.</p>
    <button type="button" disabled={busy} onClick={() => void load()}>상황 위치 불러오기</button>
    {situations.length > 0 && <fieldset disabled={busy}>
      <label>상황<select value={situationId} onChange={e => selectSituation(situations.find(s => s.id === e.target.value))}>{situations.map(s => <option key={s.id} value={s.id}>{s.code} · {s.title} ({s.event_location ? "위치 설정됨" : s.is_generic ? "공통·미배치" : "미배치"})</option>)}</select></label>
      <label>보행 지점<select value={anchorId} onChange={e => setAnchorId(e.target.value)}>
        {selectedLocation && <option value={SAVED_LOCATION}>현재 저장 위치 [{selectedLocation.point.join(", ")}]</option>}
        {anchors.map(a => <option key={a.id} value={a.id}>{a.id} [{a.position.join(", ")}]</option>)}
      </select></label>
      <label>장소 ID<input value={placeId} onChange={e => setPlaceId(e.target.value)} maxLength={128} pattern="[A-Za-z0-9][A-Za-z0-9._-]{0,127}" placeholder="확인된 장소 ID" /></label>
      <p>같은 장소 ID의 이벤트는 위치와 반경도 같아야 합니다. 기존 위치에 장소 ID가 없으면 확인된 ID를 입력한 뒤 저장하세요.</p>
      <label>발생 반경(m)<input type="number" min={0.001} max={1e6} step="any" value={radius} onChange={e => setRadius(e.target.value)} /></label>
      <button type="button" onClick={() => void save(false)}>이 위치에 저장</button>
      <button type="button" onClick={() => void save(true)}>위치 연결 해제</button>
    </fieldset>}
    {error && <p role="alert">{error}</p>}
  </details>;
}
