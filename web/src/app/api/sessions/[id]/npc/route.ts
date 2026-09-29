import { NextRequest } from "next/server";
import { ApiError, authenticate, handle, json, transaction, uuid } from "@/lib/api";
import { readNpcs } from "@/lib/participant-npcs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const sid = uuid((await context.params).id, "session_id");
    return json(await transaction(async db => {
      const pid = await authenticate(db, request);
      if (!pid) throw new ApiError(401, "UNAUTHORIZED", "참여 인증이 필요합니다.");
      return readNpcs(db, sid, pid);
    }));
  });
}
