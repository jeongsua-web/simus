import { NextRequest } from "next/server";
import { ApiError, body, checkOrigin, handle, hashToken, json, transaction } from "@/lib/api";
import { readParticipantResult } from "@/lib/participant-results";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return handle(async () => {
    checkOrigin(request);
    const input = await body(request);
    if (typeof input.token !== "string" || !/^[0-9a-f]{64}$/.test(input.token))
      throw new ApiError(400, "INVALID_TOKEN", "결과 링크 형식이 올바르지 않습니다.");
    const payload = await transaction(async db => {
      const link = await db.query(`SELECT session_id,participant_id FROM simus.result_links
        WHERE token_hash=$1 AND expires_at>clock_timestamp()`, [hashToken(input.token as string)]);
      if (!link.rowCount) throw new ApiError(404, "LINK_NOT_FOUND", "결과 링크가 만료되었거나 갱신되었습니다.");
      return readParticipantResult(db, link.rows[0].session_id, link.rows[0].participant_id);
    });
    const response = json(payload);
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  });
}
