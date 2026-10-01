import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { ApiError, authenticate, checkOrigin, handle, hashToken, json, transaction, uuid } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    checkOrigin(request);
    const sessionId = uuid((await context.params).id, "session_id");
    const token = randomBytes(32).toString("hex");
    const expiresAt = await transaction(async db => {
      const participantId = await authenticate(db, request);
      if (!participantId) throw new ApiError(401, "UNAUTHORIZED", "참여 인증이 필요합니다.");
      const member = await db.query(`SELECT 1 FROM simus.participant_sessions
        WHERE session_id=$1 AND participant_id=$2`, [sessionId, participantId]);
      if (!member.rowCount) throw new ApiError(404, "MEMBERSHIP_NOT_FOUND", "이 회차의 참여 기록이 없습니다.");
      const link = await db.query(`INSERT INTO simus.result_links(session_id,participant_id,token_hash,expires_at)
        VALUES($1,$2,$3,clock_timestamp()+interval '30 days')
        ON CONFLICT(session_id,participant_id) DO UPDATE SET token_hash=EXCLUDED.token_hash,
          created_at=clock_timestamp(),expires_at=EXCLUDED.expires_at RETURNING expires_at`,
        [sessionId, participantId, hashToken(token)]);
      return link.rows[0].expires_at;
    });
    return json({ token, expires_at: expiresAt }, 201);
  });
}
