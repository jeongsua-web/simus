import { npcPosition, type Npc } from '@/app/participate/npc-motion';
import { MAP_VERSION, routeBetween, pathLength, distance } from './city-v002-graph.mjs';

type Motion = Npc['motion'];
export type ReturnMotion = Motion & { rejoin_after_ms?: number; rejoin_motion?: Motion };
export type GraphState = {
  motion_epoch: Date | string; paused_ms: string | number;
  resume_motion: ReturnMotion | null; guidance_motion?: Motion | null;
  guidance_origin: number[] | null; guidance_point: number[] | null;
  guidance_started_at: Date | string | null;
};
export function resumedNpc(state: GraphState, original: Motion, at: number): Npc {
  let motion: ReturnMotion = state.resume_motion ?? original;
  let epoch = new Date(state.motion_epoch).getTime() + Number(state.paused_ms);
  if (motion.rejoin_motion && motion.rejoin_after_ms !== undefined && at >= epoch + motion.rejoin_after_ms) {
    epoch += motion.rejoin_after_ms;
    motion = motion.rejoin_motion;
  }
  return { npc_id: '', epoch: new Date(epoch).toISOString(), motion };
}
export function guidanceMotion(state: Pick<GraphState, 'guidance_motion' | 'guidance_origin' | 'guidance_point'>, original: Motion): Motion {
  // A v002 state must never fall back to a two-point chord.
  const points = original.map_version === MAP_VERSION
    ? state.guidance_motion?.points ?? routeBetween(state.guidance_origin!, state.guidance_point!)
    : [state.guidance_origin!, state.guidance_point!];
  return { ...original, points: points.length > 1 ? points : [points[0], points[0]], loop: false };
}
export function guidancePosition(state: GraphState, original: Motion, at: number) {
  return npcPosition({ npc_id: '', epoch: new Date(state.guidance_started_at!).toISOString(), motion: guidanceMotion(state, original) }, at)!;
}
export function returnMotion(original: Motion, point: number[]): ReturnMotion {
  const points = original.points;
  let nearest = 0;
  points.forEach((p, i) => { if (distance(p, point) < distance(points[nearest], point)) nearest = i; });
  if (original.map_version !== MAP_VERSION) return { ...original, points: [point, ...points.slice(nearest), ...(original.loop ? points.slice(0, nearest) : [])] };
  const connector = routeBetween(point, points[nearest]);
  const cycle = original.loop ? [...points.slice(nearest), ...points.slice(0, nearest), points[nearest]] : points.slice(nearest);
  // Return exactly once, then restore the original loop, with no repeated event detour.
  const rejoin_motion = { ...original, points: cycle.length > 1 ? cycle : [cycle[0], cycle[0]],
    ...(pathLength(cycle) === 0 ? { speed_mps: 0 } : {}) };
  // Keep the connector separate so a maximum-size authored loop can still return.
  // A zero-length connector hands off immediately; its stored fallback stays valid.
  return { ...original, points: connector.length > 1 ? connector : original.points, loop: false,
    rejoin_after_ms: original.speed_mps > 0 ? pathLength(connector) / original.speed_mps * 1000 : undefined,
    rejoin_motion };
}

export function projectedRevision(state: GraphState & { motion_revision: string | number }, original: Motion, at: number) {
  const revision = Number(state.motion_revision);
  if (original.map_version !== MAP_VERSION) return revision;
  const resume = state.resume_motion;
  const rejoined = resume?.rejoin_after_ms !== undefined &&
    at >= new Date(state.motion_epoch).getTime() + Number(state.paused_ms) + resume.rejoin_after_ms;
  // Reserve a revision for the deterministic connector-to-loop handoff.
  return revision * 2 + Number(rejoined);
}
