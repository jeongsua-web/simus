import { NextRequest } from "next/server";
import { adminSubject, requireAdmin } from "@/lib/admin-auth";
import { ApiError, body, checkOrigin, handle, json, transaction, uuid } from "@/lib/api";
import { validateMotion } from "@/lib/npc-position-sync";
export const runtime = "nodejs";
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    checkOrigin(request);
    const subject = await adminSubject(request);
    const id = uuid((await context.params).id, "session_id");
    const motion = validateMotion(await body(request));
    return json(await transaction(async db => {
      await requireAdmin(db, subject);
      const session = await db.query("SELECT status FROM simus.simulation_sessions WHERE id=$1 FOR UPDATE", [id]);
      if (!session.rowCount) throw new ApiError(404, "SESSION_NOT_FOUND", "회차를 찾을 수 없습니다.");
      if (session.rows[0].status !== "DRAFT") throw new ApiError(409, "NPC_MOTION_LOCKED", "시작 전 회차만 경로를 설정할 수 있습니다.");
      await db.query("UPDATE simus.simulation_sessions SET npc_motion=$2 WHERE id=$1", [id, motion]);
      return { session_id: id, motion };
    }));
  });
}
