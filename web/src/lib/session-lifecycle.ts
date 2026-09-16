import type { PoolClient } from "pg";
import { ApiError, transaction } from "./api";
import { classifyAlignment, validateRules } from "./session-rules";

type Action = "START" | "END";

async function assertActiveAdmin(db: PoolClient, adminId: string) {
  const result = await db.query("SELECT 1 FROM simus.admin_users WHERE id=$1 AND is_active FOR SHARE", [adminId]);
  if (!result.rowCount) throw new ApiError(403, "ADMIN_REQUIRED", "활성 관리자 권한이 필요합니다.");
}

async function actionRow(db: PoolClient, adminId: string, sessionId: string, action: Action, requestKey: string) {
  const inserted = await db.query(`INSERT INTO simus.admin_actions(admin_id,session_id,action,request_key,outcome)
    VALUES($1,$2,$3,$4,'PENDING') ON CONFLICT(admin_id,request_key) DO NOTHING RETURNING id,outcome`,
    [adminId, sessionId, action, requestKey]);
  if (inserted.rowCount) return inserted.rows[0];
  const prior = await db.query(`SELECT id,outcome,session_id,action FROM simus.admin_actions
    WHERE admin_id=$1 AND request_key=$2 FOR UPDATE`, [adminId, requestKey]);
  if (!prior.rowCount || prior.rows[0].session_id !== sessionId || prior.rows[0].action !== action)
    throw new ApiError(409, "REQUEST_KEY_CONFLICT", "같은 관리자 요청 키를 다른 작업에 사용할 수 없습니다.");
  return prior.rows[0];
}

export async function startSession(adminId: string, sessionId: string, requestKey: string) {
  return transaction(async db => {
    await assertActiveAdmin(db, adminId);
    const session = await db.query(`SELECT id,status,scheduled_end_at,admission_buffer,impact_scale,rules_snapshot
      FROM simus.simulation_sessions WHERE id=$1 FOR UPDATE`, [sessionId]);
    if (!session.rowCount) throw new ApiError(404, "SESSION_NOT_FOUND", "회차를 찾을 수 없습니다.");
    const action = await actionRow(db, adminId, sessionId, "START", requestKey);
    if (action.outcome === "SUCCEEDED") {
      if (session.rows[0].status === "DRAFT") throw new ApiError(409, "ACTION_INCONSISTENT", "완료된 시작 작업과 회차 상태가 일치하지 않습니다.");
      return { session_id: sessionId, status: session.rows[0].status, replayed: true };
    }
    if (action.outcome !== "PENDING") throw new ApiError(409, "ACTION_NOT_RETRYABLE", "완료할 수 없는 관리자 작업입니다.");
    if (session.rows[0].status !== "DRAFT") throw new ApiError(409, "INVALID_SESSION_STATE", "DRAFT 회차만 시작할 수 있습니다.");

    const regions = await db.query(`SELECT code FROM simus.session_regions WHERE session_id=$1 ORDER BY code`, [sessionId]);
    if (!regions.rowCount) throw new ApiError(409, "SESSION_NOT_READY", "지역이 하나 이상 필요합니다.");
    const rules = validateRules(session.rows[0].rules_snapshot, regions.rows.map(r => r.code));
    const invalid = await db.query(`SELECT
      NOT EXISTS(SELECT 1 FROM simus.session_situations WHERE session_id=$1) AS no_situations,
      EXISTS(SELECT 1 FROM simus.session_situations s WHERE s.session_id=$1 AND
        (SELECT count(*) FROM simus.session_choices c WHERE c.session_id=s.session_id AND c.situation_id=s.id)<2) AS few_choices,
      EXISTS(SELECT 1 FROM simus.session_choices c WHERE c.session_id=$1 AND
        (c.happiness_base='NaN'::numeric OR c.safety_base='NaN'::numeric OR c.cleanliness_base='NaN'::numeric)) AS invalid_choice,
      EXISTS(SELECT 1 FROM simus.choice_region_effects e WHERE e.session_id=$1 AND e.pollution_base='NaN'::numeric) AS invalid_effect,
      EXISTS(SELECT 1 FROM simus.choice_records WHERE session_id=$1) AS has_records,
      EXISTS(SELECT 1 FROM simus.city_states WHERE session_id=$1) OR
        EXISTS(SELECT 1 FROM simus.region_states WHERE session_id=$1) AS has_state`, [sessionId]);
    const check = invalid.rows[0];
    if (check.no_situations || check.few_choices || check.invalid_choice || check.invalid_effect || check.has_records || check.has_state || session.rows[0].impact_scale === "NaN")
      throw new ApiError(409, "SESSION_NOT_READY", "상황·선택지·영향값 또는 기존 상태가 시작 조건을 충족하지 않습니다.");

    const city = rules.initial_city_state;
    await db.query(`INSERT INTO simus.city_states(session_id,happiness,safety,cleanliness)
      VALUES($1,$2,$3,$4)`, [sessionId, city.happiness, city.safety, city.cleanliness]);
    await db.query(`INSERT INTO simus.region_states(session_id,region_id,pollution)
      SELECT r.session_id,r.id,(s.rules_snapshot->'initial_region_pollution'->>r.code)::numeric
      FROM simus.session_regions r JOIN simus.simulation_sessions s ON s.id=r.session_id WHERE r.session_id=$1`, [sessionId]);
    const updated = await db.query(`UPDATE simus.simulation_sessions SET status='RUNNING',starts_at=clock_timestamp()
      WHERE id=$1 AND scheduled_end_at>clock_timestamp()+admission_buffer RETURNING status,starts_at`, [sessionId]);
    if (!updated.rowCount) throw new ApiError(409, "INVALID_SESSION_TIME", "종료 시각이 시작 시각과 접수 버퍼보다 뒤여야 합니다.");
    await db.query(`UPDATE simus.admin_actions SET outcome='SUCCEEDED',approved_at=clock_timestamp() WHERE id=$1`, [action.id]);
    return { session_id: sessionId, status: "RUNNING", starts_at: updated.rows[0].starts_at, replayed: false };
  });
}

async function verifyConsistency(db: PoolClient, sessionId: string) {
  const result = await db.query(`SELECT
    c.version=(SELECT count(*) FROM simus.choice_records WHERE session_id=$1) AS city_ok,
    NOT EXISTS(SELECT 1 FROM simus.participant_alignments a WHERE a.session_id=$1 AND
      ROW(a.x_score,a.y_score,a.response_count) IS DISTINCT FROM
      (SELECT ROW(COALESCE(sum(r.alignment_dx),0)::bigint,COALESCE(sum(r.alignment_dy),0)::bigint,count(r.*)::bigint)
       FROM simus.choice_records r WHERE r.session_id=a.session_id AND r.participant_id=a.participant_id)) AS people_ok,
    (SELECT count(*) FROM simus.region_states WHERE session_id=$1)=
      (SELECT count(*) FROM simus.session_regions WHERE session_id=$1) AS regions_ok
    FROM simus.city_states c WHERE c.session_id=$1`, [sessionId]);
  if (!result.rowCount || !result.rows[0].city_ok || !result.rows[0].people_ok || !result.rows[0].regions_ok)
    throw new ApiError(409, "SESSION_INCONSISTENT", "회차 상태와 선택 원장이 일치하지 않아 확정할 수 없습니다.");
}

export async function finalizeClosingSession(sessionId: string) {
  return transaction(async db => {
    const sessionResult = await db.query(`SELECT * FROM simus.simulation_sessions WHERE id=$1 FOR UPDATE`, [sessionId]);
    if (!sessionResult.rowCount) throw new ApiError(404, "SESSION_NOT_FOUND", "회차를 찾을 수 없습니다.");
    const session = sessionResult.rows[0];
    if (session.status === "FINALIZED") return { session_id: sessionId, status: "FINALIZED", finalized_at: session.finalized_at, replayed: true };
    if (session.status !== "CLOSING") throw new ApiError(409, "INVALID_SESSION_STATE", "CLOSING 회차만 확정할 수 있습니다.");
    const regions = await db.query("SELECT code FROM simus.session_regions WHERE session_id=$1 ORDER BY code", [sessionId]);
    const rules = validateRules(session.rules_snapshot, regions.rows.map(r => r.code));
    await verifyConsistency(db, sessionId);
    const finalized = await db.query("SELECT clock_timestamp() AS at");
    const at = finalized.rows[0].at;
    const city = await db.query(`SELECT c.*,p.overall_pollution FROM simus.city_states c
      JOIN simus.overall_pollution p ON p.session_id=c.session_id WHERE c.session_id=$1`, [sessionId]);
    if (!city.rowCount) throw new ApiError(409, "SESSION_INCONSISTENT", "도시 결과를 계산할 수 없습니다.");
    const state = city.rows[0];
    await db.query(`INSERT INTO simus.session_results(session_id,finalized_at,final_state_version,happiness,safety,cleanliness,overall_pollution,rules_snapshot)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [sessionId, at, state.version, state.happiness, state.safety, state.cleanliness, state.overall_pollution, session.rules_snapshot]);
    await db.query(`INSERT INTO simus.region_results(session_id,region_id,pollution)
      SELECT session_id,region_id,pollution FROM simus.region_states WHERE session_id=$1`, [sessionId]);
    const people = await db.query(`SELECT participant_id,x_score::text,y_score::text,response_count::text
      FROM simus.participant_alignments WHERE session_id=$1 AND (response_count>0 OR $2='INCLUDE')`, [sessionId, rules.zero_response_policy]);
    for (const person of people.rows) {
      const code = classifyAlignment(person.x_score, person.y_score, rules);
      await db.query(`INSERT INTO simus.participant_results(session_id,participant_id,x_score,y_score,response_count,alignment_code,interpretation,finalized_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [sessionId, person.participant_id, person.x_score, person.y_score, person.response_count, code, rules.interpretations[code], at]);
    }
    await db.query(`UPDATE simus.simulation_sessions SET status='FINALIZED',actual_ended_at=$2,finalized_at=$2 WHERE id=$1`, [sessionId, at]);
    await db.query(`UPDATE simus.admin_actions SET outcome='SUCCEEDED',approved_at=COALESCE(approved_at,$2)
      WHERE session_id=$1 AND action='END' AND outcome='PENDING'`, [sessionId, at]);
    return { session_id: sessionId, status: "FINALIZED", finalized_at: at, replayed: false };
  });
}

export async function requestManualEnd(adminId: string, sessionId: string, requestKey: string) {
  const closed = await transaction(async db => {
    await assertActiveAdmin(db, adminId);
    const session = await db.query(`SELECT status,finalized_at FROM simus.simulation_sessions WHERE id=$1 FOR UPDATE`, [sessionId]);
    if (!session.rowCount) throw new ApiError(404, "SESSION_NOT_FOUND", "회차를 찾을 수 없습니다.");
    const action = await actionRow(db, adminId, sessionId, "END", requestKey);
    if (action.outcome === "SUCCEEDED" && session.rows[0].status === "FINALIZED")
      return { finalized: true, finalized_at: session.rows[0].finalized_at };
    if (action.outcome !== "PENDING") throw new ApiError(409, "ACTION_NOT_RETRYABLE", "완료할 수 없는 관리자 작업입니다.");
    if (session.rows[0].status === "RUNNING") {
      await db.query(`UPDATE simus.simulation_sessions SET status='CLOSING',admission_closed_at=clock_timestamp(),
        end_requested_at=clock_timestamp(),end_mode='MANUAL',ended_by_admin_id=$2 WHERE id=$1`, [sessionId, adminId]);
    } else if (session.rows[0].status !== "CLOSING" && session.rows[0].status !== "FINALIZED") {
      throw new ApiError(409, "INVALID_SESSION_STATE", "RUNNING 회차만 종료할 수 있습니다.");
    }
    return { finalized: session.rows[0].status === "FINALIZED", finalized_at: session.rows[0].finalized_at };
  });
  if (closed.finalized) return { session_id: sessionId, status: "FINALIZED", finalized_at: closed.finalized_at, replayed: true };
  return finalizeClosingSession(sessionId);
}

export async function reconcileSessions() {
  const ids = await transaction(async db => {
    const result = await db.query(`SELECT id FROM simus.simulation_sessions
      WHERE status='CLOSING' OR (status='RUNNING' AND scheduled_end_at<=clock_timestamp()) ORDER BY created_at`);
    return result.rows.map(row => row.id as string);
  });
  const results = [];
  for (const id of ids) {
    await transaction(async db => {
      const session = await db.query("SELECT status FROM simus.simulation_sessions WHERE id=$1 FOR UPDATE", [id]);
      if (session.rows[0]?.status === "RUNNING") await db.query(`UPDATE simus.simulation_sessions
        SET status='CLOSING',admission_closed_at=scheduled_end_at-admission_buffer,end_requested_at=clock_timestamp(),end_mode='AUTO'
        WHERE id=$1`, [id]);
    });
    results.push(await finalizeClosingSession(id));
  }
  return results;
}
