import type { PoolClient } from 'pg';
import { ApiError, requireOpen } from '../api';
import { V003_MAP_VERSION, V003_PATH_VERSION } from "../city/city-builds";
import { advanceEvent, completeEvent } from "../npc/npc-events";
import { localRoute } from "./v003-route";

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
export async function startLocalEvent(db: PoolClient, sid: string, pid: string) {
  requireV003Local(); await requireOpen(db, sid);
  const session = (await db.query('SELECT npc_motion FROM simus.simulation_sessions WHERE id=$1', [sid])).rows[0];
  if (session.npc_motion?.map_version !== V003_MAP_VERSION || session.npc_motion?.path_version !== V003_PATH_VERSION)
    throw new ApiError(409, 'NPC_MAP_MISMATCH', 'v003 로컬 테스트 회차가 아닙니다.');
  const current = await advanceEvent(db, sid, pid);
  if (current.phase !== 'WAITING') return current;
  const answered = await db.query('SELECT 1 FROM simus.choice_records WHERE session_id=$1 AND participant_id=$2 LIMIT 1', [sid, pid]);
  if (answered.rowCount) throw new ApiError(409, 'EVENTS_EXHAUSTED', '대표 상황 테스트를 완료했습니다. 새 시민으로 다시 입장해주세요.');
  const route = localRoute();
  await db.query(`UPDATE simus.npc_event_states SET guidance_origin=$3,guidance_point=$4,
    guidance_motion=$5,guidance_started_at=clock_timestamp(),location_evaluated_at=clock_timestamp(),
    motion_revision=motion_revision+1 WHERE session_id=$1 AND participant_id=$2`,
    [sid, pid, JSON.stringify(route.points[0]), JSON.stringify(route.interaction.point), JSON.stringify({
      map_version: V003_MAP_VERSION, path_version: V003_PATH_VERSION, points: route.points, speed_mps: route.speed_mps, loop: false
    })]);
  return advanceEvent(db, sid, pid);
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
