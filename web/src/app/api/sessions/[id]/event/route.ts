import { NextRequest } from "next/server";
import { ApiError, authenticate, body, checkOrigin, handle, json, transaction, uuid } from "@/lib/api";
import { advanceEvent } from "@/lib/npc/npc-events";
import { NPC_SPEED_MULTIPLIERS, type NpcSpeedMultiplier } from "@/app/participate/lib/npc-motion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

async function eventState(request: NextRequest, context: Context, changeSpeed = false) {
  return handle(async () => {
    const sid = uuid((await context.params).id, "session_id");
    let multiplier: NpcSpeedMultiplier | undefined;
    if (changeSpeed) {
      checkOrigin(request);
      const input = await body(request);
      multiplier = NPC_SPEED_MULTIPLIERS.find(value => value === input.speed_multiplier);
      if (!multiplier) throw new ApiError(400, "INVALID_NPC_SPEED", "NPC 속도는 1배속, 2배속, 4배속 중에서 선택해 주세요.");
    }
    return json(await transaction(async db => {
      const pid = await authenticate(db, request);
      if (!pid) throw new ApiError(401, "UNAUTHORIZED", "먼저 익명 참여자를 생성해주세요.");
      const session = await db.query("SELECT id FROM simus.simulation_sessions WHERE id=$1 FOR UPDATE", [sid]);
      if (!session.rowCount) throw new ApiError(404, "SESSION_NOT_FOUND", "회차를 찾을 수 없습니다.");
      return advanceEvent(db, sid, pid, { requestedSpeed: multiplier });
    }));
  });
}

export async function GET(request: NextRequest, context: Context) {
  return eventState(request, context);
}

export async function PATCH(request: NextRequest, context: Context) {
  return eventState(request, context, true);
}
