import type { Npc } from "@/app/participate/lib/npc-motion";
import { npcPosition } from "@/app/participate/lib/npc-motion";
import { ApiError } from "../api";
import audited from "./data/v003-event-routes.json";
import { localRoute } from "./v003-route";

type Point = number[];
type Route = { kind: "place" | "entrance" | "road" | "encounter"; points: Point[] };
type Motion = Npc["motion"];
export type EventWalk = Motion & {
  situation_id: string;
  event_kind: Route["kind"];
  event_code: string;
  hub_index: number;
  encounter?: Motion;
  encounter_epoch?: string;
};
const routes = audited.routes as Record<string, Route>;
const length = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function eventTestsEnabled() {
  return process.env.NODE_ENV === "development" || process.env.SIMUS_EVENT_TEST_PICKER === "1";
}

export function auditedEventRoute(code: string): Route | undefined {
  return audited.source_scene_sha256 === localRoute().source_scene_sha256 ? routes[code] : undefined;
}

export function walkingDistance(points: Point[]) {
  return points.slice(1).reduce((distance, point, i) => distance + length(points[i], point), 0);
}

// Preserve the current pose and the already verified route segments when chaining walks.
function splitRoute(npc: Npc, now: number) {
  const points = npc.motion.points;
  const full = npc.motion.loop ? [...points, points[0]] : points;
  const total = walkingDistance(full);
  const traveled = Math.max(0, now - Date.parse(npc.epoch)) * npc.motion.speed_mps / 1000;
  let remaining = npc.motion.loop && total > 0 ? traveled % total : Math.min(traveled, total);
  for (let i = 1; i < full.length; i++) {
    const leg = length(full[i - 1], full[i]);
    if (remaining <= leg && leg > 0) {
      const point = npcPosition(npc, now)!;
      return { before: [...full.slice(0, i), point], after: [point, ...full.slice(i)] };
    }
    remaining -= leg;
  }
  const point = full[full.length - 1];
  return { before: [...full], after: [point] };
}

function backToSpawn(npc: Npc, now: number) {
  const spawn = localRoute().points[0];
  const remainder = splitRoute(npc, now).after;
  const after = npc.motion.loop ? [...remainder, ...npc.motion.points.slice(1)] : remainder;
  const spawnIndex = after.findIndex(point => length(point, spawn) < .0001);
  if (spawnIndex < 0) throw new ApiError(409, "EVENT_ROUTE_UNAVAILABLE", "현재 위치에서 확인된 상황 이동 경로를 찾을 수 없습니다.");
  return after.slice(0, spawnIndex + 1);
}

export function planEventWalk(npc: Npc, now: number, situation: { id: string; code: string }, route: Route): EventWalk {
  const connector = backToSpawn(npc, now);
  let points = route.points;
  if (route.kind === "road") {
    // Respond from the accessible approach before entering flood water or the barrier.
    const end = points[points.length - 1];
    const stop = points.findLastIndex(point => length(point, end) >= 3);
    if (stop > 0) points = points.slice(0, stop + 1);
  }
  const motion = { ...npc.motion, loop: false, speed_mps: localRoute().speed_mps * 4 };
  const walk: EventWalk = {
    ...motion, situation_id: situation.id, event_code: situation.code, event_kind: route.kind, hub_index: connector.length - 1,
    points: [...connector, ...points.slice(1)],
  };
  if (route.kind === "encounter") {
    // Target patrols the same verified footpath and can cross the approach anywhere in this segment.
    const patrol = points.slice(-8);
    walk.encounter = { ...motion, points: [...patrol, ...patrol.slice(1, -1).reverse()], speed_mps: .65, loop: true };
    walk.encounter_epoch = new Date(now).toISOString();
  }
  return walk;
}

export function eventArrival(walk: EventWalk, epoch: number, from: number, now: number) {
  const started = new Date(epoch).toISOString();
  const end = Math.ceil(epoch + walkingDistance(walk.points) / walk.speed_mps * 1000);
  if (!walk.encounter) return now >= end ? end : null;
  const player: Npc = { npc_id: "", epoch: started, motion: walk };
  const target: Npc = { npc_id: "", epoch: walk.encounter_epoch ?? started, motion: walk.encounter };
  const approach = Math.max(epoch, end - 7000 / walk.speed_mps);
  for (let at = Math.max(approach, from); at <= now; at = Math.min(now, at + 50)) {
    if (length(npcPosition(player, at)!, npcPosition(target, at)!) <= 1.35) return Math.ceil(at);
    if (at === now) break;
  }
  return null;
}

export function eventReturn(walk: EventWalk, epoch: Date, at: number): Motion & { test_return: true } {
  const before = splitRoute({ npc_id: "", epoch: epoch.toISOString(), motion: walk }, at).before;
  const points = before.slice(walk.hub_index).reverse();
  const { map_version, path_version } = walk;
  return { map_version, path_version, points, speed_mps: localRoute().speed_mps, loop: false, test_return: true };
}
