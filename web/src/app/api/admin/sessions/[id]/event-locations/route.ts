import { NextRequest } from "next/server";
import { adminSubject, requireAdmin } from "@/lib/admin-auth";
import { ApiError, body, checkOrigin, handle, json, transaction, uuid } from "@/lib/api";
import { isV002MapVersion, locate, graphForMap } from "@/lib/city-v002-graph.mjs";
import { assertLocationGroups, parseEventLocation } from "@/lib/event-locations";
export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const subject = await adminSubject(request);
    const sid = uuid((await context.params).id, "session_id");
    return json(await transaction(async db => {
      await requireAdmin(db, subject);
      const session = await db.query("SELECT npc_motion FROM simus.simulation_sessions WHERE id=$1", [sid]);
      if (!session.rowCount) throw new ApiError(404, "SESSION_NOT_FOUND", "회차를 찾을 수 없습니다.");
      const situations = await db.query("SELECT id,code,title,is_generic,event_location FROM simus.session_situations WHERE session_id=$1 ORDER BY display_order,id", [sid]);
      const map = session.rows[0].npc_motion?.map_version;
      return { situations: situations.rows, anchors: isV002MapVersion(map) ? graphForMap(map).nodes : [] };
    }));
  });
}

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
      const v = parseEventLocation(input.event_location);
      if (isV002MapVersion(v.map_version)) {
        try { locate(v.point, v.map_version); }
        catch { throw new ApiError(400, "INVALID_GRAPH_LOCATION", "v002 이벤트 위치는 보행 그래프 위에 있어야 합니다."); }
      }
      location = v;
    } else if (input.event_location != null) throw new ApiError(400, "INVALID_EVENT_LOCATION", "공통 이벤트에는 특정 위치를 지정할 수 없습니다.");
    return json(await transaction(async db => {
      await requireAdmin(db, subject);
      const session = await db.query("SELECT status,npc_motion FROM simus.simulation_sessions WHERE id=$1 FOR UPDATE", [sid]);
      if (!session.rowCount) throw new ApiError(404, "SESSION_NOT_FOUND", "회차를 찾을 수 없습니다.");
      if (session.rows[0].status !== "DRAFT") throw new ApiError(409, "EVENT_LOCATION_LOCKED", "시작 전 회차만 이벤트 위치를 설정할 수 있습니다.");
      if (location && (!session.rows[0].npc_motion || (location as { map_version: string }).map_version !== session.rows[0].npc_motion.map_version))
        throw new ApiError(409, "NPC_MAP_MISMATCH", "설정된 NPC 경로의 지도와 이벤트 지도가 일치해야 합니다.");
      if (location) {
        const peers = await db.query(`SELECT event_location FROM simus.session_situations
          WHERE session_id=$1 AND id<>$2 AND event_location->>'place_id'=$3`,
        [sid, tid, (location as { place_id: string }).place_id]);
        assertLocationGroups([...peers.rows.map(row => row.event_location), location], session.rows[0].npc_motion.map_version);
      }
      const updated = await db.query(`UPDATE simus.session_situations SET event_location=$3,is_generic=$4
        WHERE session_id=$1 AND id=$2 RETURNING id,event_location,is_generic`, [sid, tid, location, input.is_generic]);
      if (!updated.rowCount) throw new ApiError(404, "SITUATION_NOT_FOUND", "상황을 찾을 수 없습니다.");
      return { session_id: sid, situation: updated.rows[0] };
    }));
  });
}
