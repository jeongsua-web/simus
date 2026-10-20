"use client";

import { FormEvent, useRef, useState } from "react";
import styles from "./admin.module.css";

type Template = { id: string; name: string; status: string };
type Creation = { template_session_id?: string; creation_mode?: "initial"; name: string; duration_seconds: number; impact_scale: number; request_key: string; npc_profile?: string };

export default function CreateSession({ token, sessions, onCreated }: { token: string; sessions: Template[]; onCreated: () => Promise<void> }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Creation | null>(null);
  const inFlight = useRef(false);
  const initial = sessions.length === 0;
  const templates = sessions.filter(session => ["DRAFT", "FINALIZED"].includes(session.status));
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const form = new FormData(event.currentTarget);
    const payload = pending ?? {
      ...(initial ? { creation_mode: "initial" as const } : { template_session_id: String(form.get("template")) }), name: String(form.get("name")),
      duration_seconds: Number(form.get("duration")), impact_scale: Number(form.get("scale")), request_key: crypto.randomUUID(),
      ...(form.get("map") === "city-rebuild-v002" ? { npc_profile: "city-rebuild-v002" } : {}),
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
    <p>{initial ? "승인된 30개 상황·91개 선택지와 도시 전체 지역, v002 NPC 경로를 등록합니다." : "선택한 회차의 상황·선택지·지역·초기 규칙을 복사합니다. 참여 기록은 새로 시작합니다."} DRAFT로 저장되며, 진행 시간은 관리자가 시작 버튼을 누른 시점부터 계산됩니다.</p>
    {!initial && !templates.length ? <p>복사 가능한 DRAFT 또는 FINALIZED 회차가 없습니다.</p> : <form onSubmit={create}>
      <fieldset disabled={busy || pending !== null}>
        {!initial && <label>복사할 회차<select name="template" required>{templates.map(session => <option key={session.id} value={session.id}>{session.name} ({session.id.slice(0, 8)})</option>)}</select></label>}
        <label>새 회차 이름<input name="name" required maxLength={120} defaultValue="새로운 도시의 하루" /></label>
        <label>도시 맵<select name="map" defaultValue="city-rebuild-v002"><option value="city-rebuild-v002">CityRebuild_v002</option>{!initial && <option value="legacy">기존 회차 생성 방식</option>}</select></label>
        <p>v002는 개발 검증용 맵입니다. {initial ? "상황 위치와 지역 경계는 미확정으로 등록합니다. 생성 후 상황 위치 설정에서 보행 지점을 지정하세요. 미배치 상황은 기존 대기 정책을 따릅니다." : "다른 맵의 상황 위치는 복사하지 않으며, 시작 전 상황 위치를 설정할 수 있습니다."}</p>
        <label>진행 시간(초)<input name="duration" type="number" min={10} max={86400} step={1} required defaultValue={300} /></label>
        <label>도시 영향 배율<input name="scale" type="number" min={0} max={1} step="0.01" required defaultValue={0.1} /></label>
      </fieldset>
      {error && <p role="alert">{error}</p>}
      {pending && !busy && <p>생성 결과 확인이 필요합니다. 같은 설정과 요청 번호로 다시 확인합니다.</p>}
      <button disabled={busy}>{busy ? "준비 중…" : pending ? "동일 회차 생성 요청 다시 확인" : initial ? "최초 DRAFT 회차 생성" : "새 회차 준비"}</button>
    </form>}
  </section>;
}
