"use client";

import { useEffect, useRef, useState } from "react";
import type { ApiError, Session, Situation, Submission } from "./types";

export function useParticipation() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [answered, setAnswered] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [pending, setPending] = useState<Submission | null>(null);

  // Reactの画面更新より前に連続クリックを防ぐ。
  const busy = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const participantResponse = await fetch("/api/participants", {
          method: "POST",
        });

        if (!participantResponse.ok) {
          throw new Error("参加者情報を確認できませんでした。");
        }

        const response = await fetch("/api/sessions/current", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("現在の回次を取得できませんでした。");
        }

        const data: { session: Session | null } = await response.json();

        if (!cancelled) {
          setSession(data.session);
        }
      } catch {
        if (!cancelled) {
          setLoadError(
            "참여 정보를 불러오지 못했어요. 서버 연결을 확인하고 다시 시도해주세요.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(situation: Situation) {
    if (!session || busy.current || answered[situation.id]) return;
    if (!session.accepting_choices) return;

    // 응답 유실 시에는 기존 본문과 요청 키를 그대로 재사용한다.
    const payload: Submission =
      pending ?? {
        session_id: session.id,
        situation_id: situation.id,
        choice_id: selected[situation.id],
        request_key: crypto.randomUUID(),
      };

    if (!payload.choice_id || payload.situation_id !== situation.id) return;

    busy.current = true;
    setSubmitting(situation.id);
    setPending(payload);
    setMessages((previous) => ({
      ...previous,
      [situation.id]: "제출 중이에요…",
    }));

    try {
      const response = await fetch("/api/choices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result: ApiError = await response.json();

      if (response.ok || result.error?.code === "ALREADY_ANSWERED") {
        setAnswered((previous) => ({
          ...previous,
          [situation.id]: true,
        }));
        setPending(null);
        setMessages((previous) => ({
          ...previous,
          [situation.id]: response.ok
            ? "선택이 반영됐어요. 결과는 회차 종료 후 공개돼요."
            : "이미 응답한 상황이에요.",
        }));
        return;
      }

      if (result.error?.code === "SESSION_CLOSED") {
        setSession((previous) =>
          previous ? { ...previous, accepting_choices: false } : previous,
        );
        setPending(null);
        setMessages((previous) => ({
          ...previous,
          [situation.id]: "입력이 마감되어 선택이 반영되지 않았어요.",
        }));
        return;
      }

      // 서버 오류는 성공 여부가 불확실할 수 있으므로 같은 요청을 유지한다.
      if (response.status >= 500) {
        throw new Error("Server error");
      }

      setPending(null);
      setMessages((previous) => ({
        ...previous,
        [situation.id]:
          result.error?.message ?? "선택을 제출하지 못했어요.",
      }));
    } catch {
      setMessages((previous) => ({
        ...previous,
        [situation.id]:
          "제출 결과를 확인하지 못했어요. 아래 버튼으로 같은 선택을 다시 확인해주세요.",
      }));
    } finally {
      busy.current = false;
      setSubmitting(null);
    }
  }

  function selectChoice(situationId: string, choiceId: string) {
    setSelected((previous) => ({ ...previous, [situationId]: choiceId }));
  }

  return { session, loading, loadError, selected, answered, messages, submitting, pending, selectChoice, submit };
}
