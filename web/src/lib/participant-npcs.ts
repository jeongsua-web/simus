import type { PoolClient } from "pg";
import { npcPosition, type Npc } from "@/app/participate/npc-motion";
import { guidanceMotion, guidancePosition, resumedNpc, projectedRevision } from "./npc-graph-motion";
import { ApiError } from "./api";
import { syncNpcEvents } from "./npc-events";

// Caller holds the session row lock, shared with choices and lifecycle transitions.
export async function joinSession(db: PoolClient, sessionId: string, participantId: string) {
  const prior = await db.query(`SELECT npc_id FROM simus.participant_sessions
    WHERE session_id=$1 AND participant_id=$2`, [sessionId, participantId]);
  if (prior.rowCount) return false;
  const open = await db.query(`SELECT npc_motion FROM simus.simulation_sessions WHERE id=$1
    AND status='RUNNING' AND starts_at<=clock_timestamp() AND clock_timestamp()<scheduled_end_at`, [sessionId]);
  if (!open.rowCount) throw new ApiError(409, "SESSION_CLOSED", "회차 입장이 종료되었거나 아직 시작되지 않았습니다.");
  if (!open.rows[0].npc_motion) throw new ApiError(409, "NPC_MOTION_NOT_CONFIGURED", "회차의 NPC 경로가 아직 설정되지 않았습니다.");
  await db.query(`INSERT INTO simus.participant_sessions(session_id,participant_id,joined_at,npc_motion)
    VALUES($1,$2,clock_timestamp(),$3)`, [sessionId, participantId, open.rows[0].npc_motion]);
  await db.query(`INSERT INTO simus.participant_alignments(session_id,participant_id)
    VALUES($1,$2) ON CONFLICT DO NOTHING`, [sessionId, participantId]);
  // A request that crosses the scheduled deadline must roll back its membership.
  const stillOpen = await db.query(`SELECT 1 FROM simus.simulation_sessions
    WHERE id=$1 AND clock_timestamp()<scheduled_end_at`, [sessionId]);
  if (!stillOpen.rowCount) throw new ApiError(409, "SESSION_CLOSED", "회차 입장이 종료되었습니다.");
  return true;
}

export async function readNpcs(db: PoolClient, sessionId: string, participantId?: string) {
  await syncNpcEvents(db, sessionId, participantId);
  // One statement gives lifecycle, clock and membership the same snapshot.
  const result = await db.query(`WITH snapshot AS (
    SELECT s.*,statement_timestamp() AS server_time,
      LEAST(s.scheduled_end_at,s.end_requested_at) AS freeze_at
    FROM simus.simulation_sessions s WHERE id=$1 AND status<>'DRAFT'
  ) SELECT s.id AS session_id,s.status,s.server_time,s.freeze_at,
    COALESCE(s.npc_motion->>'map_version',(SELECT p.npc_motion->>'map_version' FROM simus.participant_sessions p WHERE p.session_id=s.id ORDER BY p.npc_id LIMIT 1)) AS map_version,
    COALESCE(s.npc_motion->>'path_version',(SELECT p.npc_motion->>'path_version' FROM simus.participant_sessions p WHERE p.session_id=s.id ORDER BY p.npc_id LIMIT 1)) AS path_version,
    LEAST(s.server_time,s.freeze_at) AS motion_time,
    s.server_time>=s.freeze_at AS frozen,
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'npc_id',p.npc_id,'character_id',p.character_id,'glasses_id',p.glasses_id,'epoch',p.joined_at,'motion',p.npc_motion) ORDER BY p.npc_id)
      FROM simus.participant_sessions p WHERE p.session_id=s.id
      AND ($2::uuid IS NULL OR p.participant_id=$2)), '[]'::jsonb) AS npcs
    FROM snapshot s`, [sessionId, participantId ?? null]);
  if (!result.rowCount) throw new ApiError(404, "SESSION_NOT_FOUND", "공개된 회차를 찾을 수 없습니다.");
  if (participantId && result.rows[0].npcs.length === 0)
    throw new ApiError(404, "NOT_JOINED", "이 회차에 입장한 기록이 없습니다.");
  const snapshot=result.rows[0];
  const states=await db.query(`SELECT p.npc_id,st.*,e.started_at FROM simus.participant_sessions p JOIN simus.npc_event_states st ON st.session_id=p.session_id AND st.participant_id=p.participant_id LEFT JOIN simus.npc_events e ON e.session_id=p.session_id AND e.participant_id=p.participant_id AND e.status='ACTIVE' WHERE p.session_id=$1`,[sessionId]);
  snapshot.npcs=snapshot.npcs.map((npc: Npc)=>{
    const st=states.rows.find(r=>r.npc_id===npc.npc_id);
    if(!st) return npc;
    npc={...npc,motion:st.resume_motion??npc.motion};
    const at=new Date(st.started_at??snapshot.motion_time).getTime();
    const resumed = resumedNpc(st, npc.motion, at);
    const revision=projectedRevision(st, npc.motion, at);
    let projected={...npc,epoch:resumed.epoch,motion:{...resumed.motion,revision}};
    if(st.guidance_point) projected={...projected,epoch:new Date(st.guidance_started_at).toISOString(),motion:{...guidanceMotion(st, npc.motion),revision}};
    if(st.started_at) {
      const point=st.guidance_point?guidancePosition(st,npc.motion,at):npcPosition(projected as Parameters<typeof npcPosition>[0],at);
      if(point) return {...projected,epoch:new Date(st.started_at).toISOString(),motion:{...projected.motion,points:[point,point],speed_mps:0,freeze_at:new Date(st.started_at).toISOString()}};
    }
    return projected;
  });
  return snapshot;
}
