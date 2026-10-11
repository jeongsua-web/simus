import { NextRequest } from "next/server";
import { ApiError, handle, json, transaction, uuid } from "@/lib/api";
import { readNpcs } from "@/lib/participant-npcs";
import { positionSnapshot, version } from "@/lib/npc-position-sync";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const id = uuid((await context.params).id, "session_id");
    const map = version(request.nextUrl.searchParams.get("map_version"), "map_version");
    const requestedPath = request.nextUrl.searchParams.get("path_version");
    const path = requestedPath === null ? undefined : version(requestedPath, "path_version");
    return json(await transaction(async db => {
      const snapshot = await readNpcs(db, id);
      if (!snapshot.map_version) throw new ApiError(409, "NPC_MOTION_NOT_CONFIGURED", "회차의 NPC 경로가 아직 설정되지 않았습니다.");
      if (snapshot.map_version !== map || (path && snapshot.path_version !== path)) throw new ApiError(409, "NPC_MAP_MISMATCH", "NPC 지도 버전이 다릅니다.");
      return positionSnapshot(snapshot, map, path);
    }));
  });
}
