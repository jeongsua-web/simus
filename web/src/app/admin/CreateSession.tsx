"use client";

import { FormEvent, useRef, useState } from "react";
import styles from "./admin.module.css";
import { durationHours, formatDurationHours } from "./duration";

type Template = { id: string; name: string; status: string; map_version: string | null; duration_seconds: number | null; impact_scale: number };
type Creation = { template_session_id?: string; creation_mode?: "initial"; name: string; duration_seconds?: number; impact_scale?: number; request_key: string; npc_profile?: string };

export default function CreateSession({ token, sessions, onCreated }: { token: string; sessions: Template[]; onCreated: () => Promise<void> }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [map, setMap] = useState("city-masterplan-v003");
  const [templateId, setTemplateId] = useState("");
  const [customize, setCustomize] = useState(false);
  const [pending, setPending] = useState<Creation | null>(null);
  const inFlight = useRef(false);
  const initial = sessions.length === 0;
  const templates = sessions.filter(session => ["DRAFT", "FINALIZED"].includes(session.status));
  const template = templates.find(session => session.id === templateId) ?? templates[0];
  const showSettings = initial || customize;
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const form = new FormData(event.currentTarget);
    const payload = pending ?? {
      ...(initial ? { creation_mode: "initial" as const } : { template_session_id: template?.id }), name: String(form.get("name")),
      request_key: crypto.randomUUID(),
      ...(showSettings ? { duration_seconds: Math.round(Number(form.get("duration")) * 3600), impact_scale: Number(form.get("scale")) } : {}),
      ...(showSettings && form.get("map") !== "inherit" ? { npc_profile: String(form.get("map")) } : {}),
    };
    inFlight.current = true;
    setBusy(true); setError(""); setPending(payload);
    try {
      const response = await fetch("/api/admin/sessions", {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) {
        if (response.status < 500 && ![408, 429].includes(response.status)) setPending(null);
        throw new Error(body.error?.message ?? "회차를 만들지 못했습니다.");
      }
      setPending(null);
      await onCreated();
    } catch (e) { setError(e instanceof Error ? e.message : "회차 생성 결과를 확인하지 못했습니다. 같은 요청으로 다시 확인하세요."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <section className={`${styles.card} ${styles.creation}`}>
    <h2>{initial ? "최초 회차 생성" : "다음 회차 준비"}</h2>
    <p>{initial ? "승인된 30개 상황·91개 선택지와 도시 전체 지역, 선택한 맵의 NPC 경로를 등록합니다." : "선택한 회차의 도시 맵·진행 시간·도시 영향 배율과 상황·선택지·지역·초기 규칙을 복사합니다. 참여자·응답·결과는 새로 시작합니다."} DRAFT로 저장되며, 진행 시간은 관리자가 시작 버튼을 누른 시점부터 계산됩니다.</p>
    {!initial && !templates.length ? <p>복사 가능한 DRAFT 또는 FINALIZED 회차가 없습니다.</p> : <form onSubmit={create}>
      <fieldset disabled={busy || pending !== null}>
        {!initial && <label>복사할 회차<select name="template" required value={template?.id ?? ""} onChange={event => { setTemplateId(event.target.value); setCustomize(false); setMap("inherit"); }}>{templates.map(session => <option key={session.id} value={session.id}>{session.name} ({session.id.slice(0, 8)})</option>)}</select></label>}
        <label>새 회차 이름<input name="name" required maxLength={120} defaultValue="새로운 도시의 하루" /></label>
        {!initial && template && <div className={styles.copiedSettings}>
          <strong>가져올 설정</strong>
          <dl><div><dt>도시 맵</dt><dd>{template.map_version ?? "미설정"}</dd></div><div><dt>진행 시간</dt><dd>{template.duration_seconds == null ? "확인 필요" : formatDurationHours(template.duration_seconds)}</dd></div><div><dt>도시 영향 배율</dt><dd>{template.impact_scale}</dd></div></dl>
          <button type="button" className={styles.quiet} aria-expanded={customize} onClick={() => { setCustomize(!customize); setMap("inherit"); }}>{customize ? "원본 설정으로 복원" : "설정 변경"}</button>
        </div>}
        {showSettings && <div className={styles.creationSettings} key={initial ? "initial" : template?.id}>
        <label>도시 맵<select name="map" value={map} onChange={event => setMap(event.target.value)}>{!initial && <option value="inherit">원본 맵 유지 ({template?.map_version ?? "미설정"})</option>}<option value="city-masterplan-v003">CityMasterplan_v003 (로컬 검증용)</option><option value="city-rebuild-v002">CityRebuild_v002</option></select></label>
        <p>{map === "inherit" ? "원본 회차의 도시 맵, NPC 경로, 상황 위치와 지역 경계를 그대로 가져옵니다." : map === "city-masterplan-v003" ? "v003은 광장 대표 상황 EXHIBITION_30과 검증된 경로만 배치합니다. 나머지 29개 상황은 미배치이며 전시 승인 전 로컬 검증용입니다." : <>v002는 개발 검증용 맵입니다. {initial ? "상황 위치와 지역 경계는 미확정으로 등록합니다. 생성 후 상황 위치 설정에서 보행 지점을 지정하세요. 미배치 상황은 기존 대기 정책을 따릅니다." : "다른 맵의 상황 위치는 복사하지 않으며, 시작 전 상황 위치를 설정할 수 있습니다."}</>}</p>
        <div><label>진행 시간(시간)<input name="duration" type="number" min={10 / 3600} max={168} step="any" required defaultValue={initial ? durationHours(300) : template?.duration_seconds == null ? undefined : durationHours(template.duration_seconds)} /></label><small>예: 1.5 = 1시간 30분 · 최대 7일(168시간)</small></div>
        <label>도시 영향 배율<input name="scale" type="number" min={0} max={1} step="0.0000000001" required defaultValue={initial ? 0.1 : template?.impact_scale} /></label>
        </div>}
      </fieldset>
      {error && <p role="alert">{error}</p>}
      {pending && !busy && <p>생성 결과 확인이 필요합니다. 같은 설정과 요청 번호로 다시 확인합니다.</p>}
      <button disabled={busy}>{busy ? "준비 중…" : pending ? "동일 회차 생성 요청 다시 확인" : initial ? "최초 DRAFT 회차 생성" : "새 회차 준비"}</button>
    </form>}
  </section>;
}
