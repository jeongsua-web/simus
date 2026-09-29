import { NextRequest } from "next/server";
import { ApiError, authenticate, handle, json, transaction, uuid } from "@/lib/api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const sessionId = uuid((await context.params).id, "session_id");
    const result = await transaction(async db => {
      const participantId = await authenticate(db, request);
      if (!participantId) throw new ApiError(401, "UNAUTHORIZED", "유효한 참여자 쿠키가 필요합니다.");
      const session = await db.query("SELECT status FROM simus.simulation_sessions WHERE id=$1", [sessionId]);
      if (!session.rowCount) throw new ApiError(404, "SESSION_NOT_FOUND", "회차를 찾을 수 없습니다.");
      if (session.rows[0].status !== "FINALIZED") throw new ApiError(409, "RESULT_NOT_FINALIZED", "회차가 아직 확정되지 않았습니다.");
      const own = await db.query(`SELECT session_id,x_score::text,y_score::text,response_count::text,alignment_code,interpretation,finalized_at
        FROM simus.participant_results WHERE session_id=$1 AND participant_id=$2`, [sessionId, participantId]);
      const city = await db.query(`SELECT final_state_version::text AS version,happiness::float8,safety::float8,
        cleanliness::float8,overall_pollution::float8 FROM simus.session_results WHERE session_id=$1`, [sessionId]);
      return { result: own.rows[0] ?? null, city_state: city.rows[0] ?? null };
    });
    return json(result);
  });
}
