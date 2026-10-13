import { defaultCitizenGlasses } from "./citizen-characters";
import { ApiError } from "./api";
import { npcPosition, type Npc, type NpcSnapshot } from "@/app/participate/npc-motion";

export function version(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value))
    throw new ApiError(400, "INVALID_NPC_MOTION", `${field} 형식이 올바르지 않습니다.`);
  return value;
}
export function validateMotion(value: unknown, projection = false): Npc["motion"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError(400, "INVALID_NPC_MOTION", "경로 객체가 필요합니다.");
  const m = value as Record<string, unknown>;
  const map_version = version(m.map_version, "map_version"), path_version = version(m.path_version, "path_version");
  if (!Array.isArray(m.points) || m.points.length < 2 || m.points.length > (projection ? 2049 : 2048) ||
      m.points.some(p => !Array.isArray(p) || p.length !== 3 || p.some(n => typeof n !== "number" || !Number.isFinite(n) || Math.abs(n) > 1e6)) ||
      typeof m.speed_mps !== "number" || !Number.isFinite(m.speed_mps) || m.speed_mps < 0 || m.speed_mps > 100 || typeof m.loop !== "boolean")
    throw new ApiError(400, "INVALID_NPC_MOTION", "유효한 3D 경로, 속도(0~100m/s), loop 값이 필요합니다.");
  const points = m.points as number[][];
  if (!(projection && m.speed_mps === 0) && !points.some(p => p.some((n, i) => n !== points[0][i]))) throw new ApiError(400, "INVALID_NPC_MOTION", "경로 길이는 0보다 커야 합니다.");
  // Admin-authored routes cannot supply runtime freeze or revision metadata.
  return { ...(projection ? m : {}), map_version, path_version, points, speed_mps: m.speed_mps, loop: m.loop } as Npc["motion"];
}
export function positionSnapshot(snapshot: NpcSnapshot, map: string, path?: string) {
  const at = new Date(snapshot.motion_time).getTime();
  const npcs = snapshot.npcs.map(npc => {
    const motion = validateMotion(npc.motion, true);
    if (motion.map_version !== map || (path && motion.path_version !== path))
      throw new ApiError(409, "NPC_MAP_MISMATCH", "NPC 지도 또는 경로 버전이 다릅니다.");
    const point = npcPosition(npc, at)!;
    // Direction of travel, including at the end of a non-looping route.
    const before = npcPosition(npc, Math.max(Date.parse(npc.epoch), at - 1))!;
    const after = npcPosition(npc, at + 1)!;
    let delta = after.map((n, i) => n - point[i]);
    if (!Math.hypot(...delta)) delta = point.map((n, i) => n - before[i]);
    const length = Math.hypot(...delta);
    return { npc_id: npc.npc_id, character_id: npc.character_id ?? "npc_01", glasses_id: npc.glasses_id ?? defaultCitizenGlasses(npc.character_id ?? "npc_01"), epoch: npc.epoch, motion, path_version: motion.path_version,
      position: { x: point[0], y: point[1], z: point[2] },
      forward: { x: length ? delta[0] / length : 0, y: length ? delta[1] / length : 0, z: length ? delta[2] / length : 0 } };
  });
  return { ...snapshot, map_version: map, npcs };
}
