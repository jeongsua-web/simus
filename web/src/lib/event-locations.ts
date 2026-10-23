import { ApiError } from "./api";
import { createHash } from "node:crypto";
import { MAP_VERSION } from "./city-v002-graph.mjs";

export type EventLocation = { place_id: string; map_version: string; point: number[]; radius_m: number };
const identifier = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export function parseEventLocation(value: unknown): EventLocation {
  const v = value as Partial<EventLocation> | null;
  if (!v || typeof v !== "object" || Array.isArray(v) ||
      typeof v.place_id !== "string" || !identifier.test(v.place_id) ||
      typeof v.map_version !== "string" || !identifier.test(v.map_version) ||
      !Array.isArray(v.point) || v.point.length !== 3 ||
      v.point.some(n => typeof n !== "number" || !Number.isFinite(n) || Math.abs(n) > 1e6) ||
      typeof v.radius_m !== "number" || !Number.isFinite(v.radius_m) || v.radius_m <= 0 || v.radius_m > 1e6)
    throw new ApiError(400, "INVALID_EVENT_LOCATION", "장소 ID, 지도, 3차원 위치와 양수 반경을 지정해주세요.");
  return { place_id: v.place_id, map_version: v.map_version, point: v.point, radius_m: v.radius_m };
}

// Preserve old saved locations without rewriting DB content. Coordinate-based
// identity groups co-located legacy events into the same durable visit. New
// Phase 1/2 locations must always carry the authored place_id.
export function normalizeEventLocation(value: unknown): EventLocation {
  const v = value as Partial<EventLocation> | null;
  if (v && typeof v === "object" && !v.place_id && v.map_version !== MAP_VERSION) {
    const id = createHash("sha256").update(JSON.stringify([v.map_version, v.point, v.radius_m])).digest("hex").slice(0, 32);
    return parseEventLocation({ ...v, place_id: `legacy_${id}` });
  }
  return parseEventLocation(value);
}

export function assertLocationGroups(values: unknown[], mapVersion?: string) {
  const places = new Map<string, EventLocation>();
  for (const value of values) {
    const location = normalizeEventLocation(value);
    if (mapVersion && location.map_version !== mapVersion)
      throw new ApiError(409, "NPC_MAP_MISMATCH", "NPC 경로와 이벤트의 지도가 일치해야 합니다.");
    const previous = places.get(location.place_id);
    if (previous && (previous.map_version !== location.map_version || previous.radius_m !== location.radius_m ||
        previous.point.some((n, i) => n !== location.point[i])))
      throw new ApiError(409, "EVENT_PLACE_CONFLICT", "같은 장소 ID의 지도, 위치와 반경은 같아야 합니다.");
    places.set(location.place_id, location);
  }
  return places;
}
