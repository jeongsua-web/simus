import type { Submission } from "./types";

export const pendingKey = "simus_pending_choice_v1";
export function readPending(): Submission | null {
  const raw = localStorage.getItem(pendingKey);
  if (!raw) return null;
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { throw new Error("저장된 제출 정보가 손상되었습니다. 임의로 다시 제출하지 말고 현장 운영자에게 문의해 주세요."); }
  const fields = ["session_id", "situation_id", "choice_id", "request_key"] as const;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!value || typeof value !== "object" || fields.some(field => !(field in value) || (typeof (value as Record<string, unknown>)[field] !== "string" || !uuid.test((value as Record<string, string>)[field]))))
    throw new Error("저장된 제출 정보를 읽지 못했습니다. 브라우저 저장소를 확인해주세요.");
  return value as Submission;
}
