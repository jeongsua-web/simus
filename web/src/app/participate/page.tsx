"use client";

import { useEffect, useRef, useState } from "react";

type Choice = {
  id: string;
  label: string;
};

type Situation = {
  id: string;
  title: string;
  body: string;
  choices: Choice[];
};

type Session = {
  id: string;
  name: string;
  accepting_choices: boolean;
  situations: Situation[];
};

type Submission = {
  session_id: string;
  situation_id: string;
  choice_id: string;
  request_key: string;
};

type ApiError = {
  error?: {
    code?: string;
    message?: string;
  };
};

export default function ParticipatePage() {
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

  if (loading) {
    return <main style={pageStyle}>참여 정보를 불러오는 중이에요…</main>;
  }

  if (loadError) {
    return (
      <main style={pageStyle}>
        <p role="alert">{loadError}</p>
        <button style={buttonStyle} onClick={() => window.location.reload()}>
          다시 불러오기
        </button>
      </main>
    );
  }

  if (!session) {
    return (
      <main style={pageStyle}>
        <h1>SIM:US</h1>
        <p>현재 참여 가능한 회차가 없어요.</p>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <header style={{ marginBottom: 32 }}>
        <p style={{ color: "#596579", marginBottom: 8 }}>
          우리의 선택이 만드는 도시
        </p>
        <h1 style={{ margin: "0 0 12px", fontSize: 36 }}>SIM:US</h1>
        <p>{session.name}</p>
      </header>

      {!session.accepting_choices && (
        <p role="status" style={{ padding: 16, background: "#fff2d6" }}>
          선택 입력이 마감됐어요. 결과를 준비하고 있어요.
        </p>
      )}

      {session.situations.map((situation) => {
        const done = answered[situation.id];
        const retrying = pending?.situation_id === situation.id;
        const locked =
          done ||
          !session.accepting_choices ||
          submitting !== null ||
          pending !== null;

        return (
          <section
            key={situation.id}
            style={{
              marginTop: 24,
              padding: 24,
              border: "1px solid #dce1e8",
              borderRadius: 20,
              background: "#fff",
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: 22 }}>
              {situation.title}
            </h2>
            <p style={{ lineHeight: 1.7 }}>{situation.body}</p>

            <fieldset
              disabled={locked}
              style={{ border: 0, margin: "24px 0", padding: 0 }}
            >
              <legend style={{ marginBottom: 12 }}>
                행동 하나를 선택해주세요.
              </legend>

              {situation.choices.map((choice) => (
                <label
                  key={choice.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: 16,
                    marginBottom: 10,
                    borderRadius: 12,
                    border:
                      selected[situation.id] === choice.id
                        ? "2px solid #345ce5"
                        : "2px solid #e3e7ed",
                    cursor: locked ? "default" : "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name={situation.id}
                    value={choice.id}
                    checked={selected[situation.id] === choice.id}
                    onChange={() =>
                      setSelected((previous) => ({
                        ...previous,
                        [situation.id]: choice.id,
                      }))
                    }
                  />
                  {choice.label}
                </label>
              ))}
            </fieldset>

            <p style={{ color: "#596579", fontSize: 14 }}>
              제출한 선택은 취소하거나 변경할 수 없어요.
            </p>

            <button
              style={{
                ...buttonStyle,
                width: "100%",
                opacity:
                  done || !session.accepting_choices ? 0.5 : 1,
              }}
              disabled={
                done ||
                !session.accepting_choices ||
                submitting !== null ||
                (!retrying && pending !== null) ||
                !selected[situation.id]
              }
              onClick={() => void submit(situation)}
            >
              {done
                ? "제출 완료"
                : submitting === situation.id
                  ? "제출 중…"
                  : retrying
                    ? "같은 선택으로 다시 확인"
                    : "선택 제출"}
            </button>

            <p role="status" aria-live="polite" style={{ lineHeight: 1.6 }}>
              {messages[situation.id] ?? ""}
            </p>
          </section>
        );
      })}
    </main>
  );
}

const pageStyle = {
  maxWidth: 560,
  margin: "0 auto",
  padding: "40px 20px",
  color: "#182230",
  minHeight: "100vh",
  background: "#f7f9fc",
};

const buttonStyle = {
  padding: "14px 20px",
  border: 0,
  borderRadius: 12,
  background: "#345ce5",
  color: "#fff",
  fontSize: 16,
  fontWeight: 600,
  cursor: "pointer",
};