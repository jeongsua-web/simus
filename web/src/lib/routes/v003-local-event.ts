import type { PoolClient } from 'pg';
import { ApiError, requireOpen } from '../api';
import { V003_MAP_VERSION, V003_PATH_VERSION } from "../city/city-builds";
import { advanceEvent, completeEvent } from "../npc/npc-events";

export function requireV003Local() {
  if (process.env.SIMUS_V003_LOCAL_TEST !== '1') throw new ApiError(404, 'NOT_FOUND', '로컬 테스트가 비활성화되어 있습니다.');
}
export async function choiceOutcome(db: PoolClient, sid: string, pid: string, eid: string) {
  const result = await db.query(`SELECT id AS record_id,state_version::text,
    happiness_delta_applied::float8 AS happiness,safety_delta_applied::float8 AS safety,
    cleanliness_delta_applied::float8 AS cleanliness FROM simus.choice_records
    WHERE session_id=$1 AND participant_id=$2 AND event_id=$3`, [sid, pid, eid]);
  const row = result.rows[0];
  return row ? {
    record_id: row.record_id, state_version: row.state_version,
    city: { happiness: row.happiness, safety: row.safety, cleanliness: row.cleanliness }
  } : null;
}
export async function startV003Event(db: PoolClient, sid: string, pid: string, startRequestKey: string, situationId?: string) {
  await requireOpen(db, sid);
  const session = (await db.query('SELECT npc_motion FROM simus.simulation_sessions WHERE id=$1', [sid])).rows[0];
  if (session.npc_motion?.map_version !== V003_MAP_VERSION || session.npc_motion?.path_version !== V003_PATH_VERSION)
    throw new ApiError(409, 'NPC_MAP_MISMATCH', 'v003 상황을 시작할 수 없는 회차입니다.');
  return advanceEvent(db, sid, pid, { startRequestKey, situationId });
}
export async function confirmLocalEvent(db: PoolClient, sid: string, pid: string, eid: string) {
  requireV003Local();
  const session = (await db.query('SELECT npc_motion FROM simus.simulation_sessions WHERE id=$1', [sid])).rows[0];
  if (session.npc_motion?.map_version !== V003_MAP_VERSION) throw new ApiError(409, 'NPC_MAP_MISMATCH', 'v003 로컬 테스트 회차가 아닙니다.');
  const result = await choiceOutcome(db, sid, pid, eid);
  if (!result) throw new ApiError(409, 'RESULT_NOT_READY', '선택 결과가 없습니다.');
  const event = (await db.query('SELECT status FROM simus.npc_events WHERE id=$1 AND session_id=$2 AND participant_id=$3', [eid, sid, pid])).rows[0];
  if (event?.status === 'ACTIVE') await completeEvent(db, sid, pid, eid);
  return advanceEvent(db, sid, pid);
}
