"use client";

import { FormEvent, useRef, useState } from "react";
import styles from "./admin.module.css";

type Template = { id: string; name: string; status: string };
type Creation = { template_session_id: string; name: string; duration_seconds: number; impact_scale: number; request_key: string };

export default function CreateSession({ token, sessions, onCreated }: { token: string; sessions: Template[]; onCreated: () => Promise<void> }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Creation | null>(null);
  const inFlight = useRef(false);
  const templates = sessions.filter(session => ["DRAFT", "FINALIZED"].includes(session.status));
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const form = new FormData(event.currentTarget);
    const payload = pending ?? {
      template_session_id: String(form.get("template")), name: String(form.get("name")),
      duration_seconds: Number(form.get("duration")), impact_scale: Number(form.get("scale")), request_key: crypto.randomUUID(),
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
    <h2>다음 회차 준비</h2>
    <p>선택한 회차의 상황·선택지·지역·초기 규칙을 복사합니다. 참여 기록은 새로 시작하며, 진행 시간은 회차 시작 버튼을 누른 시점부터 계산됩니다.</p>
    {!templates.length ? <p>복사할 회차가 없습니다. 최초 콘텐츠 회차를 먼저 등록하세요.</p> : <form onSubmit={create}>
      <fieldset disabled={busy || pending !== null}>
        <label>복사할 회차<select name="template" required>{templates.map(session => <option key={session.id} value={session.id}>{session.name} ({session.id.slice(0, 8)})</option>)}</select></label>
        <label>새 회차 이름<input name="name" required maxLength={120} defaultValue="새로운 도시의 하루" /></label>
        <label>진행 시간(초)<input name="duration" type="number" min={10} max={86400} step={1} required defaultValue={300} /></label>
        <label>도시 영향 배율<input name="scale" type="number" min={0} max={1} step="0.01" required defaultValue={0.1} /></label>
      </fieldset>
      {error && <p role="alert">{error}</p>}
      {pending && !busy && <p>생성 결과 확인이 필요합니다. 같은 설정과 요청 번호로 다시 확인합니다.</p>}
      <button disabled={busy}>{busy ? "준비 중…" : pending ? "동일 회차 생성 요청 다시 확인" : "새 회차 준비"}</button>
    </form>}
  </section>;
}
