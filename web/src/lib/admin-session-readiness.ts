import type { PoolClient } from "pg";
import { ApiError } from "./api";
import { validateRules } from "./session-rules";

export type ReadinessReason = { code: string; message: string };

export async function inspectSessionReadiness(db: PoolClient, sessionId: string): Promise<ReadinessReason[]> {
  const result = await db.query(`SELECT s.status,s.scheduled_end_at,s.admission_buffer,s.impact_scale,s.rules_snapshot,
      (SELECT array_agg(code ORDER BY code) FROM simus.session_regions WHERE session_id=s.id) AS region_codes,
      NOT EXISTS(SELECT 1 FROM simus.session_situations WHERE session_id=s.id) AS no_situations,
      EXISTS(SELECT 1 FROM simus.session_situations t WHERE t.session_id=s.id AND
        (SELECT count(*) FROM simus.session_choices c WHERE c.session_id=t.session_id AND c.situation_id=t.id)<2) AS few_choices,
      EXISTS(SELECT 1 FROM simus.session_choices c WHERE c.session_id=s.id AND
        (c.happiness_base='NaN'::numeric OR c.safety_base='NaN'::numeric OR c.cleanliness_base='NaN'::numeric)) AS invalid_choice,
      EXISTS(SELECT 1 FROM simus.choice_region_effects e WHERE e.session_id=s.id AND e.pollution_base='NaN'::numeric) AS invalid_effect,
      EXISTS(SELECT 1 FROM simus.choice_records WHERE session_id=s.id) AS has_records,
      EXISTS(SELECT 1 FROM simus.city_states WHERE session_id=s.id) OR
        EXISTS(SELECT 1 FROM simus.region_states WHERE session_id=s.id) AS has_state,
      s.scheduled_end_at<=clock_timestamp()+s.admission_buffer AS invalid_time,
      EXISTS(SELECT 1 FROM simus.simulation_sessions active
        WHERE active.id<>s.id AND active.status IN ('RUNNING','CLOSING')) AS another_active
    FROM simus.simulation_sessions s WHERE s.id=$1`, [sessionId]);
  if (!result.rowCount) return [{ code: "SESSION_NOT_FOUND", message: "회차를 찾을 수 없습니다." }];
  const row = result.rows[0];
  if (row.status !== "DRAFT") return [];
  const reasons: ReadinessReason[] = [];
  const regions = (row.region_codes ?? []) as string[];
  if (!regions.length) reasons.push({ code: "NO_REGIONS", message: "지역을 한 개 이상 등록해야 합니다." });
  if (row.no_situations) reasons.push({ code: "NO_SITUATIONS", message: "상황을 한 개 이상 등록해야 합니다." });
  if (row.few_choices) reasons.push({ code: "TOO_FEW_CHOICES", message: "모든 상황에는 선택지가 두 개 이상 필요합니다." });
  if (row.invalid_choice) reasons.push({ code: "INVALID_CHOICE_VALUE", message: "선택지의 도시 영향값에 유효하지 않은 숫자가 있습니다." });
  if (row.invalid_effect) reasons.push({ code: "INVALID_REGION_EFFECT", message: "지역 오염 영향값에 유효하지 않은 숫자가 있습니다." });
  if (row.has_records || row.has_state) reasons.push({ code: "EXISTING_RUNTIME_DATA", message: "시작 전 회차에 실행 상태나 응답 기록이 남아 있습니다." });
  if (row.impact_scale === "NaN") reasons.push({ code: "INVALID_IMPACT_SCALE", message: "영향 배율이 유효한 숫자가 아닙니다." });
  if (row.invalid_time) {
    reasons.push({ code: "INVALID_SESSION_TIME", message: "종료 시각이 지났거나 접수 버퍼를 확보할 수 없습니다." });
  }
  if (row.another_active) reasons.push({ code: "ANOTHER_ACTIVE_SESSION", message: "이미 진행 중이거나 종료 처리 중인 회차가 있습니다." });
  if (regions.length) {
    try { validateRules(row.rules_snapshot, regions); }
    catch (error) {
      reasons.push({ code: "INVALID_RULES", message: error instanceof ApiError ? error.message : "회차 규칙을 확인할 수 없습니다." });
    }
  }
  return reasons;
}
