"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { pendingKey, readPending } from "./pending";
import type { ApiError, LatestSession, Session, Situation, Submission } from "./types";

async function errorMessage(response: Response, fallback: string) {
  try { return ((await response.json()) as ApiError).error?.message ?? fallback; }
  catch { return fallback; }
}

export function useParticipation() {
  const [session, setSession] = useState<Session | null>(null);
  const [latestSession, setLatestSession] = useState<LatestSession | null>(null);
  const [history, setHistory] = useState<LatestSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [authExpired, setAuthExpired] = useState(false);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [answered, setAnswered] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [pending, setPending] = useState<Submission | null>(null);
  const busy = useRef(false);
  const loadingState = useRef(false);
  const activeSession = useRef<string | null>(null);
  const mounted = useRef(false);
  const storageReady = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const pendingRequest = useRef<Submission | null>(null);

  function rememberPending(value: Submission | null) {
    if (value) localStorage.setItem(pendingKey, JSON.stringify(value));
    else localStorage.removeItem(pendingKey);
    pendingRequest.current = value;
    setPending(value);
  }

  const loadState = useCallback(async (initial = false) => {
    if (loadingState.current) return;
    loadingState.current = true;
    const abort = new AbortController();
    controller.current = abort;
    const signal = abort.signal;
    try {
      if (initial) {
        const saved = readPending(); pendingRequest.current = saved; setPending(saved); storageReady.current = true;
        const participantResponse = await fetch("/api/participants", { method: "POST", signal });
        if (!participantResponse.ok) {
          if (participantResponse.status === 401) setAuthExpired(true);
          throw new Error(await errorMessage(participantResponse, "참여 인증을 준비하지 못했습니다."));
        }
      }
      const [currentResponse, meResponse] = await Promise.all([
        fetch("/api/sessions/current", { cache: "no-store", signal }),
        fetch("/api/participants", { cache: "no-store", signal }),
      ]);
      if (!currentResponse.ok) throw new Error("참여 가능한 회차를 확인하지 못했습니다.");
      if (!meResponse.ok) {
        if (meResponse.status === 401) setAuthExpired(true);
        throw new Error(await errorMessage(meResponse, "참여 기록을 확인하지 못했습니다."));
      }
      const current = (await currentResponse.json()) as { session: Session | null };
      const own = (await meResponse.json()) as { latest_session: LatestSession | null; history: LatestSession[] };
      if (current.session?.status === "RUNNING") {
        const joined = await fetch(`/api/sessions/${current.session.id}/join`, { method: "POST", signal });
        // A lifecycle transition between current-state and join is normal; refresh next poll.
        if (!joined.ok && joined.status !== 409)
          throw new Error(await errorMessage(joined, "회차에 입장하지 못했습니다."));
      }
      const targetId = current.session?.id ?? own.latest_session?.id;
      let records: Array<{ situation_id: string; choice_id: string }> = [];
      if (targetId) {
        const responses = await fetch(`/api/sessions/${targetId}/responses`, { cache: "no-store", signal });
        if (responses.status === 401) {
          setAuthExpired(true);
          throw new Error("참여 인증이 만료되었습니다.");
        }
        if (!responses.ok) throw new Error("본인의 응답을 확인하지 못했습니다. 다시 시도해 주세요.");
        const data = await responses.json() as { session: Partial<Session>; responses: typeof records };
        records = data.responses;
        // Use the more recent server lifecycle; never infer CLOSING from admission alone.
        if (current.session) current.session = { ...current.session, ...data.session };
      }
      if (!mounted.current || signal.aborted) return;
      const changed = activeSession.current !== (current.session?.id ?? null);
      activeSession.current = current.session?.id ?? null;
      if (changed) {
        setMessages({});
      }
      const retry = pendingRequest.current;
      if (retry && retry.session_id === targetId && records.some(item => item.situation_id === retry.situation_id)) {
        rememberPending(null);
      }
      setAnswered(Object.fromEntries(records.map(item => [item.situation_id, true])));
      setSelected(previous => ({ ...(changed ? {} : previous),
        ...(retry && retry.session_id === targetId ? { [retry.situation_id]: retry.choice_id } : {}),
        ...Object.fromEntries(records.map(item => [item.situation_id, item.choice_id])) }));
      setSession(current.session);
      setLatestSession(own.latest_session);
      setHistory(own.history ?? []);
      setAuthExpired(false);
      setLoadError("");
    } catch (error) {
      if (!signal.aborted && mounted.current) setLoadError(error instanceof Error ? error.message : "참여 정보를 불러오지 못했습니다.");
    } finally { loadingState.current = false; if (mounted.current) setLoading(false); }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const first = window.setTimeout(() => void loadState(true), 0);
    const refresh = () => { if (storageReady.current && !document.hidden && !busy.current) void loadState(false); };
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(() => { if (storageReady.current && !busy.current) void loadState(false); }, 5_000);
    return () => { mounted.current = false; controller.current?.abort(); window.clearTimeout(first); window.clearInterval(timer); window.removeEventListener("online", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [loadState]);

  async function submit(situation: Situation) {
    if (authExpired || busy.current || loadingState.current) return;
    const retry = pendingRequest.current;
    if (retry && retry.situation_id !== situation.id) return;
    if (!retry && (!session || !session.accepting_choices || answered[situation.id])) return;
    const payload: Submission = retry ?? {
      session_id: session!.id, situation_id: situation.id,
      choice_id: selected[situation.id], request_key: crypto.randomUUID(),
    };
    if (!payload.choice_id) return;
    try { rememberPending(payload); }
    catch { setLoadError("브라우저 저장소에 제출 정보를 보관할 수 없습니다. 저장소 설정을 확인해주세요."); return; }
    busy.current = true;
    setSubmitting(situation.id);
    setMessages(previous => ({ ...previous, [situation.id]: "제출하고 있어요…" }));
    try {
      const response = await fetch("/api/choices", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const result = await response.json() as ApiError;
      if (response.ok || result.error?.code === "ALREADY_ANSWERED") {
        setAnswered(previous => ({ ...previous, [situation.id]: true }));
        rememberPending(null);
        setMessages(previous => ({ ...previous, [situation.id]: "응답이 완료되었습니다." }));
        await loadState(false);
        return;
      }
      if (response.status === 401) {
        setAuthExpired(true);
        setLoadError("참여 인증이 만료되었습니다.");
      }
      if (result.error?.code === "SESSION_CLOSED") {
        setSession(previous => previous?.id === payload.session_id ? { ...previous, accepting_choices: false } : previous);
        rememberPending(null);
      } else if (response.status < 500 && ![408, 429].includes(response.status)) rememberPending(null);
      throw new Error(result.error?.message ?? "선택을 제출하지 못했습니다.");
    } catch (error) {
      setMessages(previous => ({ ...previous, [situation.id]:
        `${error instanceof Error ? error.message : "제출 결과를 확인하지 못했습니다."}${pendingRequest.current ? " 같은 선택으로 다시 시도해 주세요." : ""}` }));
    } finally { busy.current = false; setSubmitting(null); }
  }

  return {
    session, latestSession, history, loading, loadError, authExpired, selected, answered, messages,
    submitting, pending, selectChoice: (situationId: string, choiceId: string) =>
      setSelected(previous => ({ ...previous, [situationId]: choiceId })),
    submit, retryPending: () => {
      const saved = pendingRequest.current;
      if (saved) return submit({ id: saved.situation_id, title: "", body: "", choices: [] });
    }, retryLoad: () => { setLoading(true); void loadState(true); },
  };
}
