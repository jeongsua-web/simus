import { NextRequest } from "next/server";
import { ApiError, authenticate, handle, json, transaction, uuid } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const sessionId = uuid((await context.params).id, "session_id");
    const payload = await transaction(async db => {
      const participantId = await authenticate(db, request);
      if (!participantId) throw new ApiError(401, "UNAUTHORIZED", "참여 인증이 만료되었거나 유효하지 않습니다.");
      const session = await db.query(`SELECT id,name,status,starts_at,scheduled_end_at,finalized_at,
          (status='RUNNING' AND starts_at<=clock_timestamp() AND admission_closed_at IS NULL
           AND clock_timestamp()<scheduled_end_at-admission_buffer) AS accepting_choices,
          (SELECT count(*)::int FROM simus.session_situations WHERE session_id=$1) AS situation_count
        FROM simus.simulation_sessions WHERE id=$1`, [sessionId]);
      if (!session.rowCount) throw new ApiError(404, "SESSION_NOT_FOUND", "회차를 찾을 수 없습니다.");
      const responses = await db.query(`SELECT situation_id,choice_id,received_at
        FROM simus.choice_records WHERE session_id=$1 AND participant_id=$2 ORDER BY received_at,id`,
        [sessionId, participantId]);
      return { session: session.rows[0], responses: responses.rows };
    });
    return json(payload);
  });
}
