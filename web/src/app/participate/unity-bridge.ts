import type { NpcSnapshot } from "./npc-motion";

export const BRIDGE_CHANNEL = "simus-city";
export const BRIDGE_VERSION = 1;
export type UnityEvent = {
  channel: typeof BRIDGE_CHANNEL; version: 1; bridge_id: string;
  type: "READY" | "BOUND" | "ERROR";
  map_version?: string; session_id?: string; npc_id?: string;
};

export function readUnityEvent(value: unknown, bridgeId: string): UnityEvent | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (v.channel !== BRIDGE_CHANNEL || v.version !== BRIDGE_VERSION || v.bridge_id !== bridgeId) return null;
  if (v.type === "READY" && typeof v.map_version === "string" && v.map_version.length > 0) return v as UnityEvent;
  if (v.type === "BOUND" && typeof v.session_id === "string" && typeof v.npc_id === "string") return v as UnityEvent;
  if (v.type === "ERROR") return v as UnityEvent;
  return null;
}

export function matchesOwnSnapshot(value: unknown, sessionId: string, mapVersion: string): value is NpcSnapshot {
  if (!value || typeof value !== "object") return false;
  const s = value as NpcSnapshot;
  return s.session_id === sessionId && ["RUNNING", "CLOSING", "FINALIZED"].includes(s.status)
    && typeof s.frozen === "boolean" && [s.server_time, s.freeze_at, s.motion_time].every(t => typeof t === "string" && Number.isFinite(Date.parse(t)))
    && Array.isArray(s.npcs) && s.npcs.length === 1 && s.npcs.every(n =>
      n !== null && typeof n === "object" && typeof n.npc_id === "string" && n.npc_id.length > 0 && Number.isFinite(Date.parse(n.epoch))
      && n.motion?.map_version === mapVersion && typeof n.motion.path_version === "string"
      && Number.isFinite(n.motion.speed_mps) && n.motion.speed_mps >= 0 && typeof n.motion.loop === "boolean"
      && Array.isArray(n.motion.points) && n.motion.points.length >= 2
      && n.motion.points.every(p => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite)));
}
