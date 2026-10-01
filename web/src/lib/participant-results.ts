import type { PoolClient } from "pg";
import { ApiError } from "./api";

export async function readParticipantResult(db: PoolClient, sessionId: string, participantId: string) {
  const session = await db.query("SELECT id,name,status FROM simus.simulation_sessions WHERE id=$1", [sessionId]);
  if (!session.rowCount) throw new ApiError(404, "SESSION_NOT_FOUND", "회차를 찾을 수 없습니다.");
  if (session.rows[0].status !== "FINALIZED") throw new ApiError(409, "RESULT_NOT_FINALIZED", "회차가 아직 확정되지 않았습니다.");
  const member = await db.query(`SELECT a.response_count::text AS response_count
    FROM simus.participant_sessions p LEFT JOIN simus.participant_alignments a
      ON a.session_id=p.session_id AND a.participant_id=p.participant_id
    WHERE p.session_id=$1 AND p.participant_id=$2`, [sessionId, participantId]);
  const own = member.rowCount ? await db.query(`SELECT session_id,x_score::text,y_score::text,response_count::text,alignment_code,interpretation,finalized_at
    FROM simus.participant_results WHERE session_id=$1 AND participant_id=$2`, [sessionId, participantId]) : null;
  const city = await db.query(`SELECT final_state_version::text AS version,happiness::float8,safety::float8,
    cleanliness::float8,overall_pollution::float8 FROM simus.session_results WHERE session_id=$1`, [sessionId]);
  const responseCount = Number(member.rows[0]?.response_count ?? 0);
  return {
    session: { id: sessionId, name: session.rows[0].name },
    result: responseCount > 0 ? own?.rows[0] ?? null : null,
    result_kind: !member.rowCount ? "NOT_JOINED" : responseCount === 0 ? "NO_RESPONSE" : "SCORED",
    response_count: responseCount,
    city_state: city.rows[0] ?? null,
  };
}
