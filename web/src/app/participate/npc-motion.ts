export type Npc = {
  npc_id: string;
  epoch: string;
  motion: { map_version: string; path_version: string; points: number[][]; speed_mps: number; loop: boolean };
};
export type NpcSnapshot = {
  session_id: string; status: string; server_time: string; freeze_at: string;
  motion_time: string; frozen: boolean; npcs: Npc[];
};

export function motionTime(snapshot: NpcSnapshot, receivedAt: number, now: number): number {
  const server = Date.parse(snapshot.server_time);
  const freeze = Date.parse(snapshot.freeze_at);
  if (!Number.isFinite(server) || !Number.isFinite(freeze)) return 0;
  return Math.min(freeze, server + Math.max(0, now - receivedAt));
}

export function laneOffset(npcId: string): number {
  const lane = Number.parseInt(npcId.slice(0, 4), 16);
  return Number.isFinite(lane) ? (lane / 65535 - 0.5) * 4 : 0;
}

const lengthsByNpc = new WeakMap<Npc, { segments: number[]; total: number; offset: number }>();

export function npcPosition(npc: Npc, at: number): [number, number, number] | null {
  const points = npc.motion.points;
  if (!Array.isArray(points) || points.length < 2 || points.some(p => p.length !== 3 || p.some(n => !Number.isFinite(n)))) return null;
  const speed = npc.motion.speed_mps;
  if (!Number.isFinite(speed) || speed < 0) return null;
  let geometry = lengthsByNpc.get(npc);
  if (!geometry) {
    const segments = points.map((p, i) => {
      if (!npc.motion.loop && i === points.length - 1) return 0;
      const q = points[(i + 1) % points.length];
      return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    });
    geometry = { segments, total: segments.reduce((a, b) => a + b, 0), offset: laneOffset(npc.npc_id) };
    lengthsByNpc.set(npc, geometry);
  }
  const lengths = geometry.segments;
  const total = geometry.total;
  const offset = geometry.offset;
  if (total <= 0) return [points[0][0] + offset, points[0][1], points[0][2]];
  let distance = Math.max(0, (at - Date.parse(npc.epoch)) / 1000) * speed;
  distance = npc.motion.loop ? distance % total : Math.min(total, distance);
  for (let i = 0; i < lengths.length; i++) {
    const len = lengths[i];
    if (distance <= len && len > 0) {
      const p = points[i], q = points[(i + 1) % points.length], mix = distance / len;
      return [p[0] + (q[0] - p[0]) * mix + offset, p[1] + (q[1] - p[1]) * mix, p[2] + (q[2] - p[2]) * mix];
    }
    distance -= len;
  }
  const last = points[points.length - 1];
  return [last[0] + offset, last[1], last[2]];
}
