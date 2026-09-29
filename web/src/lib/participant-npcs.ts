import type { PoolClient } from "pg";
import { ApiError } from "./api";

// Caller holds the session row lock, shared with choices and lifecycle transitions.
export async function joinSession(db: PoolClient, sessionId: string, participantId: string) {
  const prior = await db.query(`SELECT npc_id FROM simus.participant_sessions
    WHERE session_id=$1 AND participant_id=$2`, [sessionId, participantId]);
  if (prior.rowCount) return false;
  const open = await db.query(`SELECT 1 FROM simus.simulation_sessions WHERE id=$1
    AND status='RUNNING' AND starts_at<=clock_timestamp() AND clock_timestamp()<scheduled_end_at`, [sessionId]);
  if (!open.rowCount) throw new ApiError(409, "SESSION_CLOSED", "회차 입장이 종료되었거나 아직 시작되지 않았습니다.");
  await db.query(`INSERT INTO simus.participant_sessions(session_id,participant_id,joined_at)
    VALUES($1,$2,clock_timestamp())`, [sessionId, participantId]);
  await db.query(`INSERT INTO simus.participant_alignments(session_id,participant_id)
    VALUES($1,$2) ON CONFLICT DO NOTHING`, [sessionId, participantId]);
  // A request that crosses the scheduled deadline must roll back its membership.
  const stillOpen = await db.query(`SELECT 1 FROM simus.simulation_sessions
    WHERE id=$1 AND clock_timestamp()<scheduled_end_at`, [sessionId]);
  if (!stillOpen.rowCount) throw new ApiError(409, "SESSION_CLOSED", "회차 입장이 종료되었습니다.");
  return true;
}

export async function readNpcs(db: PoolClient, sessionId: string, participantId?: string) {
  // One statement gives lifecycle, clock and membership the same snapshot.
  const result = await db.query(`WITH snapshot AS (
    SELECT s.*,statement_timestamp() AS server_time,
      LEAST(s.scheduled_end_at,s.end_requested_at) AS freeze_at
    FROM simus.simulation_sessions s WHERE id=$1 AND status<>'DRAFT'
  ) SELECT s.id AS session_id,s.status,s.server_time,s.freeze_at,
    LEAST(s.server_time,s.freeze_at) AS motion_time,
    s.server_time>=s.freeze_at AS frozen,
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'npc_id',p.npc_id,'epoch',p.joined_at,'motion',p.npc_motion) ORDER BY p.npc_id)
      FROM simus.participant_sessions p WHERE p.session_id=s.id
      AND ($2::uuid IS NULL OR p.participant_id=$2)), '[]'::jsonb) AS npcs
    FROM snapshot s`, [sessionId, participantId ?? null]);
  if (!result.rowCount) throw new ApiError(404, "SESSION_NOT_FOUND", "공개된 회차를 찾을 수 없습니다.");
  if (participantId && result.rows[0].npcs.length === 0)
    throw new ApiError(404, "NOT_JOINED", "이 회차에 입장한 기록이 없습니다.");
  return result.rows[0];
}
