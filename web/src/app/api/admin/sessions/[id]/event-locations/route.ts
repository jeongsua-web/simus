import { NextRequest } from "next/server";
import { adminSubject, requireAdmin } from "@/lib/admin-auth";
import { ApiError, body, checkOrigin, handle, json, transaction, uuid } from "@/lib/api";
import { version } from "@/lib/npc-position-sync";
export const runtime = "nodejs";

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    checkOrigin(request);
    const subject = await adminSubject(request);
    const sid = uuid((await context.params).id, "session_id");
    const input = await body(request);
    const tid = uuid(input.situation_id, "situation_id");
    if (typeof input.is_generic !== "boolean") throw new ApiError(400, "INVALID_EVENT_LOCATION", "공통 이벤트 여부를 지정해주세요.");
    let location: object | null = null;
    if (!input.is_generic) {
      const v = input.event_location as Record<string, unknown> | null;
      if (!v || typeof v !== "object" || !Array.isArray(v.point) || v.point.length !== 3 ||
          v.point.some(n => typeof n !== "number" || !Number.isFinite(n) || Math.abs(n) > 1e6) ||
          typeof v.radius_m !== "number" || !Number.isFinite(v.radius_m) || v.radius_m <= 0 || v.radius_m > 1e6)
        throw new ApiError(400, "INVALID_EVENT_LOCATION", "지도, 3차원 위치와 양수 반경을 지정해주세요.");
      location = { map_version: version(v.map_version, "map_version"), point: v.point, radius_m: v.radius_m };
    } else if (input.event_location != null) throw new ApiError(400, "INVALID_EVENT_LOCATION", "공통 이벤트에는 특정 위치를 지정할 수 없습니다.");
    return json(await transaction(async db => {
      await requireAdmin(db, subject);
      const session = await db.query("SELECT status,npc_motion FROM simus.simulation_sessions WHERE id=$1 FOR UPDATE", [sid]);
      if (!session.rowCount) throw new ApiError(404, "SESSION_NOT_FOUND", "회차를 찾을 수 없습니다.");
      if (session.rows[0].status !== "DRAFT") throw new ApiError(409, "EVENT_LOCATION_LOCKED", "시작 전 회차만 이벤트 위치를 설정할 수 있습니다.");
      if (location && (!session.rows[0].npc_motion || (location as { map_version: string }).map_version !== session.rows[0].npc_motion.map_version))
        throw new ApiError(409, "NPC_MAP_MISMATCH", "설정된 NPC 경로의 지도와 이벤트 지도가 일치해야 합니다.");
      const updated = await db.query(`UPDATE simus.session_situations SET event_location=$3,is_generic=$4
        WHERE session_id=$1 AND id=$2 RETURNING id,event_location,is_generic`, [sid, tid, location, input.is_generic]);
      if (!updated.rowCount) throw new ApiError(404, "SITUATION_NOT_FOUND", "상황을 찾을 수 없습니다.");
      return { session_id: sid, situation: updated.rows[0] };
    }));
  });
}
