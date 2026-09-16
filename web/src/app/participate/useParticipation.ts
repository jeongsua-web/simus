"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiError, LatestSession, Session, Situation, Submission } from "./types";

async function errorMessage(response: Response, fallback: string) {
  try { return ((await response.json()) as ApiError).error?.message ?? fallback; }
  catch { return fallback; }
}

export function useParticipation() {
  const [session, setSession] = useState<Session | null>(null);
  const [latestSession, setLatestSession] = useState<LatestSession | null>(null);
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
  const controller = useRef<AbortController | null>(null);
  const pendingRequest = useRef<Submission | null>(null);

  function rememberPending(value: Submission | null) {
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
      const own = (await meResponse.json()) as { latest_session: LatestSession | null };
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
        pendingRequest.current = null;
        setPending(null);
      }
      const retry = pendingRequest.current;
      if (retry && records.some(item => item.situation_id === retry.situation_id)) {
        pendingRequest.current = null; setPending(null);
      }
      setAnswered(Object.fromEntries(records.map(item => [item.situation_id, true])));
      setSelected(previous => ({ ...(changed ? {} : previous), ...Object.fromEntries(records.map(item => [item.situation_id, item.choice_id])) }));
      setSession(current.session);
      setLatestSession(own.latest_session);
      setAuthExpired(false);
      setLoadError("");
    } catch (error) {
      if (!signal.aborted && mounted.current) setLoadError(error instanceof Error ? error.message : "참여 정보를 불러오지 못했습니다.");
    } finally { loadingState.current = false; if (mounted.current) setLoading(false); }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const first = window.setTimeout(() => void loadState(true), 0);
    const timer = window.setInterval(() => { if (!busy.current) void loadState(false); }, 5_000);
    return () => { mounted.current = false; controller.current?.abort(); window.clearTimeout(first); window.clearInterval(timer); };
  }, [loadState]);

  async function submit(situation: Situation) {
    if (!session || authExpired || busy.current || loadingState.current || answered[situation.id]) return;
    const retry = pendingRequest.current;
    if (retry && (retry.session_id !== session.id || retry.situation_id !== situation.id)) return;
    if (!session.accepting_choices && !retry) return;
    const payload: Submission = retry ?? {
      session_id: session.id, situation_id: situation.id,
      choice_id: selected[situation.id], request_key: crypto.randomUUID(),
    };
    if (!payload.choice_id) return;
    busy.current = true;
    setSubmitting(situation.id);
    rememberPending(payload);
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
        setSession(previous => previous ? { ...previous, accepting_choices: false } : previous);
        rememberPending(null);
      } else if (response.status < 500) rememberPending(null);
      throw new Error(result.error?.message ?? "선택을 제출하지 못했습니다.");
    } catch (error) {
      setMessages(previous => ({ ...previous, [situation.id]:
        `${error instanceof Error ? error.message : "제출 결과를 확인하지 못했습니다."}${pendingRequest.current ? " 같은 선택으로 다시 시도해 주세요." : ""}` }));
    } finally { busy.current = false; setSubmitting(null); }
  }

  return {
    session, latestSession, loading, loadError, authExpired, selected, answered, messages,
    submitting, pending, selectChoice: (situationId: string, choiceId: string) =>
      setSelected(previous => ({ ...previous, [situationId]: choiceId })),
    submit, retryLoad: () => { setLoading(true); void loadState(true); },
  };
}
