import { createHash } from "node:crypto";
import type { Npc } from "@/app/participate/npc-motion";
import { isV002MapVersion, routeBetween, pathLength, distance } from "../city/city-v002-graph.mjs";

type Motion = Npc["motion"];

// Use only the configured map's connected pedestrian graph. The persisted join
// snapshot is authoritative for all clients, event scans and return journeys.
export function participantMotion(original: Motion, seed: string): Motion {
  if (!original.loop || !isV002MapVersion(original.map_version) || original.speed_mps === 0) return original;
  const bytes = createHash("sha256").update(seed).digest();
  let cursor = 0;
  const random = () => bytes[cursor++ % bytes.length] / 256;
  // Sample by distance, not vertex count: dense corners must not cluster spawns.
  const closed = [...original.points, original.points[0]];
  const length = pathLength(closed);
  if (length <= 0) return original;
  function pointAt(fraction: number): number[] {
    let remaining = fraction * length;
    for (let i = 1; i < closed.length; i++) {
      const leg = distance(closed[i - 1], closed[i]);
      if (leg > 0 && remaining < leg)
        return closed[i - 1].map((v, axis) => v + (closed[i][axis] - v) * remaining / leg);
      remaining -= leg;
    }
    return closed[0];
  }
  const phase = bytes.readUInt32BE(0) / 0x100000000;
  cursor = 4;
  const stops = Array.from({ length: 6 }, (_, i) => pointAt((phase + i / 6) % 1));
  // Keep the spawn; vary subsequent destinations and direction per participant.
  for (let i = stops.length - 1; i > 1; i--) {
    const j = 1 + Math.floor(random() * i);
    [stops[i], stops[j]] = [stops[j], stops[i]];
  }
  stops.push(stops[0]);
  const points = stops.slice(1).flatMap((p, i) => routeBetween(stops[i], p, original.map_version).slice(i ? 1 : 0));
  if (points.length < 2 || points.length > 2048) throw new Error("Participant graph route exceeds the motion point limit");
  return { ...original, points };
}
