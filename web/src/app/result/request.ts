export class ResultRequestError extends Error {
  constructor(message: string, public code?: string) { super(message); }
}

// Bound stalled requests so both read and issuance controls become retryable.
export async function resultRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...options, cache: "no-store", signal: AbortSignal.timeout(15000) });
  } catch {
    throw new ResultRequestError("네트워크 연결을 확인하고 다시 시도해 주세요.");
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ResultRequestError(response.status >= 500
      ? "서버에서 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요."
      : payload?.error?.message ?? "요청을 처리하지 못했습니다. 다시 시도해 주세요.", payload?.error?.code);
  }
  if (!payload) throw new ResultRequestError("서버 응답을 확인하지 못했습니다. 다시 시도해 주세요.");
  return payload as T;
}
