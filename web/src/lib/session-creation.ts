import { randomUUID } from "node:crypto";
import { ApiError, transaction, uuid } from "./api";
import { requireAdmin } from "./admin-auth";

export async function createSession(subject: string, input: Record<string, unknown>) {
  const templateId = uuid(input.template_session_id, "template_session_id");
  const requestKey = uuid(input.request_key, "request_key");
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const duration = input.duration_seconds;
  const scale = input.impact_scale;
  if (!name || name.length > 120 || typeof duration !== "number" || !Number.isInteger(duration) || duration < 10 || duration > 86400 ||
      typeof scale !== "number" || !Number.isFinite(scale) || scale < 0 || scale > 1 || Number(scale.toFixed(10)) !== scale) {
    throw new ApiError(400, "INVALID_SESSION_INPUT", "회차 이름(1~120자), 진행 시간(10~86400초), 영향 배율(0~1)을 확인해주세요.");
  }
  return transaction(async db => {
    const adminId = await requireAdmin(db, subject);
    // Serialize this administrator's create requests, including concurrent replays.
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`session-create:${adminId}`]);
    const prior = await db.query(`SELECT r.*,s.status FROM simus.session_creation_requests r
      JOIN simus.simulation_sessions s ON s.id=r.session_id WHERE r.admin_id=$1 AND r.request_key=$2`, [adminId, requestKey]);
    if (prior.rowCount) {
      const row = prior.rows[0];
      if (row.template_session_id !== templateId || row.name !== name || row.duration_seconds !== duration || Number(row.impact_scale) !== scale)
        throw new ApiError(409, "REQUEST_KEY_CONFLICT", "같은 요청 키를 다른 회차 설정에 사용할 수 없습니다.");
      return { session_id: row.session_id, status: row.status, replayed: true };
    }
    const template = await db.query(`SELECT *,extract(epoch FROM admission_buffer)::float8 AS buffer_seconds
      FROM simus.simulation_sessions WHERE id=$1 FOR SHARE`, [templateId]);
    if (!template.rowCount) throw new ApiError(404, "SESSION_NOT_FOUND", "복사할 회차가 없습니다.");
    if (!["DRAFT", "FINALIZED"].includes(template.rows[0].status))
      throw new ApiError(409, "INVALID_TEMPLATE", "시작 전 또는 종료된 회차만 복사할 수 있습니다.");
    if (duration <= template.rows[0].buffer_seconds)
      throw new ApiError(400, "INVALID_SESSION_TIME", "진행 시간이 접수 마감 버퍼보다 길어야 합니다.");
    const id = randomUUID();
    await db.query(`INSERT INTO simus.simulation_sessions(id,name,scheduled_end_at,admission_buffer,
        expected_participants,expected_answers_per_person,impact_scale,rules_snapshot,pollution_aggregation,created_by_admin_id)
      SELECT $1,$2,clock_timestamp()+$3*interval '1 second',admission_buffer,expected_participants,
        expected_answers_per_person,$4,rules_snapshot,pollution_aggregation,$5
      FROM simus.simulation_sessions WHERE id=$6`, [id, name, duration, scale, adminId, templateId]);
    // Composite keys allow stable content IDs across sessions; no runtime rows are copied.
    await db.query(`INSERT INTO simus.session_regions(session_id,id,code,name,aggregation_weight,map_metadata)
      SELECT $1,id,code,name,aggregation_weight,map_metadata FROM simus.session_regions WHERE session_id=$2`, [id, templateId]);
    await db.query(`INSERT INTO simus.session_situations(session_id,id,code,title,body,display_order)
      SELECT $1,id,code,title,body,display_order FROM simus.session_situations WHERE session_id=$2`, [id, templateId]);
    await db.query(`INSERT INTO simus.session_choices(session_id,situation_id,id,label,display_order,importance,
        alignment_dx,alignment_dy,happiness_base,safety_base,cleanliness_base)
      SELECT $1,situation_id,id,label,display_order,importance,alignment_dx,alignment_dy,happiness_base,safety_base,cleanliness_base
      FROM simus.session_choices WHERE session_id=$2`, [id, templateId]);
    await db.query(`INSERT INTO simus.choice_region_effects(session_id,situation_id,choice_id,region_id,pollution_base)
      SELECT $1,situation_id,choice_id,region_id,pollution_base FROM simus.choice_region_effects WHERE session_id=$2`, [id, templateId]);
    await db.query(`INSERT INTO simus.session_creation_requests(admin_id,request_key,session_id,template_session_id,name,duration_seconds,impact_scale)
      VALUES($1,$2,$3,$4,$5,$6,$7)`, [adminId, requestKey, id, templateId, name, duration, scale]);
    return { session_id: id, status: "DRAFT", replayed: false };
  });
}
