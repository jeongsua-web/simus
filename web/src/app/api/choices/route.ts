import { NextRequest } from "next/server";
import { ApiError, authenticate, body, checkOrigin, handle, json, requireOpen, transaction, uuid } from "@/lib/api";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  return handle(async () => {
    checkOrigin(request);
    const input = await body(request);
    const sid = uuid(input.session_id, "session_id");
    const tid = uuid(input.situation_id, "situation_id");
    const cid = uuid(input.choice_id, "choice_id");
    const key = uuid(input.request_key, "request_key");
    const result = await transaction(async db => {
      const pid = await authenticate(db, request);
      if (!pid) throw new ApiError(401, "UNAUTHORIZED", "먼저 익명 참여자를 생성해주세요.");
      // Serialize submissions and session transitions using the parent session row.
      const session = await db.query("SELECT id FROM simus.simulation_sessions WHERE id=$1 FOR UPDATE", [sid]);
      if (!session.rowCount) throw new ApiError(404, "SESSION_NOT_FOUND", "회차를 찾을 수 없습니다.");
      const prior = await db.query(`SELECT id,situation_id,choice_id,state_version::text FROM simus.choice_records
        WHERE session_id=$1 AND participant_id=$2 AND request_key=$3`, [sid,pid,key]);
      if (prior.rowCount) {
        const r = prior.rows[0];
        if (r.situation_id !== tid || r.choice_id !== cid) throw new ApiError(409, "REQUEST_KEY_CONFLICT", "같은 요청 키에 다른 선택을 사용할 수 없습니다.");
        return { record_id: r.id, state_version: r.state_version, replayed: true };
      }
      await requireOpen(db, sid);
      const duplicate = await db.query("SELECT id FROM simus.choice_records WHERE session_id=$1 AND participant_id=$2 AND situation_id=$3", [sid,pid,tid]);
      if (duplicate.rowCount) throw new ApiError(409, "ALREADY_ANSWERED", "이미 응답한 상황입니다.");
      const choice = await db.query(`SELECT c.id FROM simus.session_choices c JOIN simus.simulation_sessions s ON s.id=c.session_id
        WHERE c.session_id=$1 AND c.situation_id=$2 AND c.id=$3 AND s.impact_scale <> 'NaN'::numeric
        AND c.happiness_base <> 'NaN'::numeric AND c.safety_base <> 'NaN'::numeric AND c.cleanliness_base <> 'NaN'::numeric
        AND NOT EXISTS (SELECT 1 FROM simus.choice_region_effects e WHERE e.session_id=c.session_id
        AND e.situation_id=c.situation_id AND e.choice_id=c.id AND e.pollution_base='NaN'::numeric)`, [sid,tid,cid]);
      if (!choice.rowCount) throw new ApiError(400, "INVALID_CHOICE", "유효한 선택지가 아닙니다.");
      const ready = await db.query(`SELECT 1 FROM simus.city_states WHERE session_id=$1
        AND EXISTS (SELECT 1 FROM simus.session_regions WHERE session_id=$1)
        AND NOT EXISTS (SELECT 1 FROM simus.session_regions r LEFT JOIN simus.region_states rs
        ON rs.session_id=r.session_id AND rs.region_id=r.id WHERE r.session_id=$1 AND rs.region_id IS NULL)`, [sid]);
      if (!ready.rowCount) throw new ApiError(409, "STATE_NOT_READY", "도시 또는 지역 초기 상태가 준비되지 않았습니다.");
      await db.query("INSERT INTO simus.participant_sessions(session_id,participant_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [sid,pid]);
      await db.query("INSERT INTO simus.participant_alignments(session_id,participant_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [sid,pid]);
      const record = await db.query(`WITH effects AS (
        SELECT c.*,s.impact_scale,clock_timestamp() AS received_at,
          (c.happiness_base*s.impact_scale)::numeric(20,10) AS dh,
          (c.safety_base*s.impact_scale)::numeric(20,10) AS ds,
          (c.cleanliness_base*s.impact_scale)::numeric(20,10) AS dc
        FROM simus.session_choices c JOIN simus.simulation_sessions s ON s.id=c.session_id
        WHERE c.session_id=$1 AND c.situation_id=$3 AND c.id=$4
      ), old AS (SELECT * FROM simus.city_states WHERE session_id=$1 FOR UPDATE), updated AS (
        UPDATE simus.city_states c SET happiness=greatest(0,least(100,o.happiness+e.dh)),
          safety=greatest(0,least(100,o.safety+e.ds)),cleanliness=greatest(0,least(100,o.cleanliness+e.dc)),
          version=o.version+1,updated_at=clock_timestamp() FROM old o,effects e
        WHERE c.session_id=o.session_id RETURNING c.*
      ) INSERT INTO simus.choice_records(session_id,participant_id,situation_id,choice_id,request_key,
        received_at,alignment_dx,alignment_dy,scale_snapshot,happiness_delta_requested,happiness_delta_applied,
        safety_delta_requested,safety_delta_applied,cleanliness_delta_requested,cleanliness_delta_applied,state_version)
        SELECT $1,$2,$3,$4,$5,e.received_at,e.alignment_dx,e.alignment_dy,e.impact_scale,
        e.dh,u.happiness-o.happiness,e.ds,u.safety-o.safety,e.dc,u.cleanliness-o.cleanliness,u.version
        FROM effects e,old o,updated u RETURNING id,state_version::text`, [sid,pid,tid,cid,key]);
      await db.query(`UPDATE simus.participant_alignments a SET x_score=a.x_score+c.alignment_dx,
        y_score=a.y_score+c.alignment_dy,response_count=a.response_count+1,updated_at=clock_timestamp()
        FROM simus.session_choices c WHERE a.session_id=$1 AND a.participant_id=$2
        AND c.session_id=a.session_id AND c.situation_id=$3 AND c.id=$4`, [sid,pid,tid,cid]);
      await db.query(`WITH old AS (
        SELECT rs.*,(e.pollution_base*s.impact_scale)::numeric(20,10) AS delta FROM simus.region_states rs
        JOIN simus.choice_region_effects e ON e.session_id=rs.session_id AND e.region_id=rs.region_id
        JOIN simus.simulation_sessions s ON s.id=rs.session_id
        WHERE e.session_id=$1 AND e.situation_id=$2 AND e.choice_id=$3 FOR UPDATE OF rs
      ), updated AS (
        UPDATE simus.region_states rs SET pollution=greatest(0,least(100,o.pollution+o.delta)),updated_at=clock_timestamp()
        FROM old o WHERE rs.session_id=o.session_id AND rs.region_id=o.region_id RETURNING rs.*
      ) INSERT INTO simus.choice_record_region_effects(choice_record_id,session_id,region_id,delta_requested,delta_applied)
        SELECT $4,$1,o.region_id,o.delta,u.pollution-o.pollution FROM old o JOIN updated u ON u.region_id=o.region_id`, [sid,tid,cid,record.rows[0].id]);
      await db.query("UPDATE simus.participants SET last_seen_at=clock_timestamp() WHERE id=$1", [pid]);
      // Roll back if admission closed while the transaction was processing.
      await requireOpen(db, sid);
      return { record_id: record.rows[0].id, state_version: record.rows[0].state_version, replayed: false };
    });
    return json(result, result.replayed ? 200 : 201);
  });
}
