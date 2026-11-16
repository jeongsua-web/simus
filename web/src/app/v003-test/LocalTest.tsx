"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ProfileEntry from "../participate/ProfileEntry";
import SituationCard from "../participate/SituationCard";
import UnityCity from "../participate/UnityCity";
import type { Department, Profile, Session, Situation } from "../participate/types";
import styles from "./local.module.css";

type State = { phase: "WAITING" | "GUIDING" | "ACTIVE" | "RESULT" | "CLOSED";
  event: { id: string; situation: Situation } | null;
  outcome?: { city: { happiness: number; safety: number; cleanliness: number } } | null };
type Pending = { url: string; body: Record<string, string> };
const storageKey = "simus-v003-local-command";
async function request(url: string, body?: object) {
  const response = await fetch(url, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message ?? "연결을 확인하고 다시 시도해 주세요.");
  return data;
}
export default function LocalTest() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [choice, setChoice] = useState("");
  const [completed, setCompleted] = useState(false);
  const lock = useRef(false);
  const polling = useRef(false);
  const generation = useRef(0);
  const refresh = useCallback(async (sid: string) => {
    if (polling.current || lock.current) return;
    polling.current = true;
    const started = generation.current;
    try { const data = await request(`/api/sessions/${sid}/event`); if (!lock.current && started === generation.current) { setState(data); setError(""); } }
    catch (e) { if (!lock.current && started === generation.current) setError((e as Error).message); }
    finally { polling.current = false; }
  }, []);
  useEffect(() => {
    let alive = true;
    async function initialize() {
      try {
        await request("/api/participants", {});
        const current = await request("/api/sessions/current");
        if (!current.session) throw new Error("로컬 테스트 회차가 없습니다. 테스트 실행기를 먼저 시작해 주세요.");
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const value = JSON.parse(saved) as Pending;
          if (value.url?.startsWith(`/api/sessions/${current.session.id}/event/`) || (value.url === "/api/choices" && value.body?.session_id === current.session.id)) setPending(value);
          else localStorage.removeItem(storageKey);
        }
        const entry = await request(`/api/sessions/${current.session.id}/profile`);
        if (entry.joined) {
          const own = await request(`/api/sessions/${current.session.id}/responses`);
          if (alive) setCompleted(own.responses.length > 0);
        }
        if (!alive) return;
        setSession(current.session); setProfile(entry.profile); setDepartments(entry.departments);
      } catch (e) { if (alive) setError((e as Error).message); }
      finally { if (alive) setLoading(false); }
    }
    void initialize();
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!session || !profile) return;
    const read = () => { if (!document.hidden) void refresh(session.id); };
    read(); const timer = window.setInterval(read, 2500);
    window.addEventListener("online", read); document.addEventListener("visibilitychange", read);
    return () => { clearInterval(timer); window.removeEventListener("online", read); document.removeEventListener("visibilitychange", read); };
  }, [session, profile, refresh]);
  async function command(value: Pending) {
    if (lock.current || !session) return;
    lock.current = true; setBusy(true);
    generation.current++;
    try {
      localStorage.setItem(storageKey, JSON.stringify(value)); setPending(value);
      await request(value.url, value.body);
      if (value.url.endsWith("/event/confirm")) setCompleted(true);
      localStorage.removeItem(storageKey); setPending(null); setChoice(""); setError("");
      setState(await request(`/api/sessions/${session.id}/event`));
    } catch (e) { setError((e as Error).message); }
    finally { lock.current = false; setBusy(false); }
  }
  if (loading) return <main className={styles.page}><p role="status">로컬 테스트 준비 중…</p></main>;
  if (!session) return <main className={styles.page}><h1>v003 로컬 테스트</h1><p role="alert">{error}</p><button onClick={() => location.reload()}>다시 연결</button></main>;
  if (!profile) return <ProfileEntry session={session} departments={departments} onSaved={() => {}} onEntered={setProfile} onStale={() => location.reload()} />;
  const active = state?.phase === "ACTIVE" ? state.event : null;
  const result = state?.phase === "RESULT";
  return <main className={styles.page}>
    <header><h1>SIM:US · 광장 로컬 테스트</h1><p>{profile.nickname} · EXHIBITION_30 · 전시 승인 전</p></header>
    <div className={styles.city}><UnityCity sessionId={session.id} onReady={setReady} /></div>
    <section className={styles.panel} aria-label="광장 상황 플레이">
      <p role="status">{state?.phase === "GUIDING" ? "광장의 상자를 향해 이동 중이에요. 내 캐릭터를 따라가 보세요." : state?.phase === "ACTIVE" ? "광장에 도착했어요. 캐릭터가 멈춰서 선택을 기다려요." : result ? "선택이 도시에 반영되었어요. 확인하면 다시 걸어요." : "내 캐릭터를 따라 도시를 둘러보세요."}</p>
      {error && <p role="alert">{error}</p>}
      {pending && <button disabled={busy} onClick={() => void command(pending)}>같은 요청으로 다시 확인</button>}
      <button disabled={!ready || busy || !!pending || completed || state?.phase !== "WAITING" || !!error} onClick={() => void command({ url: `/api/sessions/${session.id}/event/start`, body: { request_key: crypto.randomUUID() } })}>새로운 상황 만나기</button>
      {completed && state?.phase === "WAITING" && <p>대표 상황 플레이를 마쳤어요. 캐릭터가 자유 이동을 재개합니다.</p>}
      {!ready && <p>도시 연결을 마치면 시작할 수 있어요.</p>}
      {active && <SituationCard situation={active.situation} selectedChoiceId={choice} done={false} acceptingChoices={session.accepting_choices} submitting={busy} submissionInProgress={busy} retrying={false} hasPendingSubmission={!!pending} message="" onSelect={setChoice} onSubmit={() => void command({ url: "/api/choices", body: { session_id: session.id, event_id: active.id, situation_id: active.situation.id, choice_id: choice, request_key: crypto.randomUUID() } })} />}
      {result && <section aria-label="이 선택의 도시 변화"><h2>이 선택이 반영된 시점의 변화</h2>{state.outcome ? <ul>{([['happiness','행복'],['safety','치안'],['cleanliness','청결']] as const).map(([key,label]) => <li key={key}>{label}: {state.outcome!.city[key] > 0 ? "+" : ""}{state.outcome!.city[key]}</li>)}</ul> : <p>도시 변화 정보를 확인하고 있어요.</p>}<button disabled={busy || !!pending} onClick={() => void command({ url: `/api/sessions/${session.id}/event/confirm`, body: { event_id: state.event!.id } })}>확인하고 이동 재개</button></section>}
      <button disabled={busy} onClick={() => void refresh(session.id)}>상태 새로고침</button>
      <p>대표 상황은 시민당 한 번 플레이합니다. 재시험은 새 브라우저 프로필 또는 새 격리 회차를 사용하세요.</p>
    </section>
  </main>;
}
