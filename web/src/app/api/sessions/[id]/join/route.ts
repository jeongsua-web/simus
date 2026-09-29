import { NextRequest } from "next/server";
import { ApiError, authenticate, checkOrigin, handle, json, transaction, uuid } from "@/lib/api";
import { joinSession, readNpcs } from "@/lib/participant-npcs";
export const runtime = "nodejs";
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    checkOrigin(request);
    const sid = uuid((await context.params).id, "session_id");
    const result = await transaction(async db => {
      const pid = await authenticate(db, request);
      if (!pid) throw new ApiError(401, "UNAUTHORIZED", "먼저 참여 인증을 준비해주세요.");
      const session = await db.query("SELECT id FROM simus.simulation_sessions WHERE id=$1 FOR UPDATE", [sid]);
      if (!session.rowCount) throw new ApiError(404, "SESSION_NOT_FOUND", "회차를 찾을 수 없습니다.");
      const created = await joinSession(db, sid, pid);
      return { ...await readNpcs(db, sid, pid), replayed: !created };
    });
    return json(result, result.replayed ? 200 : 201);
  });
}
