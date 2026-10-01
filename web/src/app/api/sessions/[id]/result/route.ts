import { NextRequest } from "next/server";
import { ApiError, authenticate, handle, json, transaction, uuid } from "@/lib/api";
import { readParticipantResult } from "@/lib/participant-results";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const sessionId = uuid((await context.params).id, "session_id");
    const result = await transaction(async db => {
      const participantId = await authenticate(db, request);
      if (!participantId) throw new ApiError(401, "UNAUTHORIZED", "유효한 참여자 쿠키가 필요합니다.");
      return readParticipantResult(db, sessionId, participantId);
    });
    return json(result);
  });
}
