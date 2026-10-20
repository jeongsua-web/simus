import { defaultMotion, MAP_VERSION } from "./city-v002-graph.mjs";
import { randomUUID } from "node:crypto";
import { ApiError, transaction, uuid } from "./api";
import { requireAdmin } from "./admin-auth";

import { initialRules, insertInitialContent } from "./initial-session-content";
import { assertSessionBuild } from "./session-build-readiness";

export async function createSession(subject: string, input: Record<string, unknown>) {
  const initial = input.creation_mode === "initial";
  if (input.creation_mode !== undefined && !initial)
    throw new ApiError(400, "INVALID_CREATION_MODE", "지원하지 않는 회차 생성 방식입니다.");
  if (initial && (input.template_session_id !== undefined || input.npc_profile !== "city-rebuild-v002"))
    throw new ApiError(400, "INVALID_INITIAL_SESSION", "최초 회차는 복사 원본 없이 CityRebuild_v002 맵을 선택해야 합니다.");
  const profile = input.npc_profile;
  if (profile !== undefined && profile !== "city-rebuild-v002")
    throw new ApiError(400, "INVALID_NPC_PROFILE", "지원하지 않는 NPC 경로 프로필입니다.");
  const templateId = initial ? null : uuid(input.template_session_id, "template_session_id");
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
    // All creation paths share this lock: two administrators cannot both
    // observe an empty database and create an initial session.
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", ["session-create"]);
    const prior = await db.query(`SELECT r.*,s.status FROM simus.session_creation_requests r
      JOIN simus.simulation_sessions s ON s.id=r.session_id WHERE r.admin_id=$1 AND r.request_key=$2`, [adminId, requestKey]);
    if (prior.rowCount) {
      const row = prior.rows[0];
      if (row.template_session_id !== templateId || row.name !== name || row.duration_seconds !== duration || Number(row.impact_scale) !== scale ||
          (row.npc_profile ?? undefined) !== profile)
        throw new ApiError(409, "REQUEST_KEY_CONFLICT", "같은 요청 키를 다른 회차 설정에 사용할 수 없습니다.");
      return { session_id: row.session_id, status: row.status, replayed: true };
    }
    const id = randomUUID();
    if (initial) {
      const existing = await db.query("SELECT 1 FROM simus.simulation_sessions LIMIT 1");
      if (existing.rowCount)
        throw new ApiError(409, "INITIAL_SESSION_EXISTS", "이미 회차가 있습니다. 목록을 새로고침하고 다음 회차 준비를 사용해주세요.");
      const motion = defaultMotion();
      await assertSessionBuild(motion);
      await db.query(`INSERT INTO simus.simulation_sessions(id,name,status,scheduled_end_at,admission_buffer,
        expected_participants,expected_answers_per_person,impact_scale,rules_snapshot,created_by_admin_id,npc_motion)
        VALUES($1,$2,'DRAFT',clock_timestamp()+$3*interval '1 second',interval '5 seconds',500,30,$4,$5,$6,$7)`,
      [id, name, duration, scale, initialRules, adminId, motion]);
      await insertInitialContent(db, id);
    } else {
      const template = await db.query(`SELECT *,extract(epoch FROM admission_buffer)::float8 AS buffer_seconds
        FROM simus.simulation_sessions WHERE id=$1 FOR SHARE`, [templateId]);
      if (!template.rowCount) throw new ApiError(404, "SESSION_NOT_FOUND", "복사할 회차가 없습니다.");
      if (!["DRAFT", "FINALIZED"].includes(template.rows[0].status))
        throw new ApiError(409, "INVALID_TEMPLATE", "시작 전 또는 종료된 회차만 복사할 수 있습니다.");
      if (duration <= template.rows[0].buffer_seconds)
        throw new ApiError(400, "INVALID_SESSION_TIME", "진행 시간이 접수 마감 버퍼보다 길어야 합니다.");
      await db.query(`INSERT INTO simus.simulation_sessions(id,name,scheduled_end_at,admission_buffer,
          expected_participants,expected_answers_per_person,impact_scale,rules_snapshot,pollution_aggregation,created_by_admin_id)
        SELECT $1,$2,clock_timestamp()+$3*interval '1 second',admission_buffer,expected_participants,
          expected_answers_per_person,$4,rules_snapshot,pollution_aggregation,$5
        FROM simus.simulation_sessions WHERE id=$6`, [id, name, duration, scale, adminId, templateId]);
      if (profile === "city-rebuild-v002") {
        await db.query("UPDATE simus.simulation_sessions SET npc_motion=$2 WHERE id=$1", [id, defaultMotion()]);
      }
      // Composite keys allow stable content IDs across sessions; no runtime rows are copied.
      await db.query(`INSERT INTO simus.session_regions(session_id,id,code,name,aggregation_weight,map_metadata)
        SELECT $1,id,code,name,aggregation_weight,CASE WHEN $3 THEN '{}'::jsonb ELSE map_metadata END
        FROM simus.session_regions WHERE session_id=$2`, [id, templateId, profile === "city-rebuild-v002"]);
      await db.query(`INSERT INTO simus.session_situations(session_id,id,code,title,body,display_order,event_location,is_generic)
        SELECT $1,id,code,title,body,display_order,
          CASE WHEN $3 AND event_location->>'map_version' IS DISTINCT FROM $4 THEN NULL ELSE event_location END,is_generic
        FROM simus.session_situations WHERE session_id=$2`, [id, templateId, profile === "city-rebuild-v002", MAP_VERSION]);
      await db.query(`INSERT INTO simus.session_choices(session_id,situation_id,id,label,display_order,importance,
          alignment_dx,alignment_dy,happiness_base,safety_base,cleanliness_base)
        SELECT $1,situation_id,id,label,display_order,importance,alignment_dx,alignment_dy,happiness_base,safety_base,cleanliness_base
        FROM simus.session_choices WHERE session_id=$2`, [id, templateId]);
      await db.query(`INSERT INTO simus.choice_region_effects(session_id,situation_id,choice_id,region_id,pollution_base)
        SELECT $1,situation_id,choice_id,region_id,pollution_base FROM simus.choice_region_effects WHERE session_id=$2`, [id, templateId]);
    }
    await db.query(`INSERT INTO simus.session_creation_requests(admin_id,request_key,session_id,template_session_id,name,duration_seconds,impact_scale,npc_profile)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [adminId, requestKey, id, templateId, name, duration, scale, profile ?? null]);
    return { session_id: id, status: "DRAFT", replayed: false };
  });
}
