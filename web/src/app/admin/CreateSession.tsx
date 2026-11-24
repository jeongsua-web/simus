"use client";

import { FormEvent, useRef, useState } from "react";
import styles from "./admin.module.css";
import { durationHours, formatDurationHours } from "./duration";

type Template = { id: string; name: string; status: string; duration_seconds: number | null; impact_scale: number };
type Creation = { template_session_id?: string; creation_mode?: "initial"; name: string; duration_seconds?: number; impact_scale?: number; request_key: string };

export default function CreateSession({ token, sessions, onCreated }: { token: string; sessions: Template[]; onCreated: () => Promise<void> }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
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
    <p>{initial ? "30개 상황·91개 선택지와 도시 전체 지역을 등록합니다." : "선택한 회차의 진행 시간·영향 배율과 상황·선택지·지역·초기 규칙을 복사합니다."} CityMasterplan_v003의 검증된 NPC 경로와 광장 대표 상황 위치를 적용합니다.</p>
    {!initial && !templates.length ? <p>복사 가능한 DRAFT 또는 FINALIZED 회차가 없습니다.</p> : <form onSubmit={create}>
      <fieldset disabled={busy || pending !== null}>
        {!initial && <label>복사할 회차<select name="template" required value={template?.id ?? ""} onChange={event => { setTemplateId(event.target.value); setCustomize(false); }}>{templates.map(session => <option key={session.id} value={session.id}>{session.name} ({session.id.slice(0, 8)})</option>)}</select></label>}
        <label>새 회차 이름<input name="name" required maxLength={120} defaultValue="새로운 도시의 하루" /></label>
        {!initial && template && <div className={styles.copiedSettings}>
          <strong>가져올 설정</strong>
          <dl><div><dt>진행 시간</dt><dd>{template.duration_seconds == null ? "확인 필요" : formatDurationHours(template.duration_seconds)}</dd></div><div><dt>도시 영향 배율</dt><dd>{template.impact_scale}</dd></div></dl>
          <button type="button" className={styles.quiet} aria-expanded={customize} onClick={() => setCustomize(!customize)}>{customize ? "원본 설정으로 복원" : "설정 변경"}</button>
        </div>}
        {showSettings && <div className={styles.creationSettings} key={initial ? "initial" : template?.id}>
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
