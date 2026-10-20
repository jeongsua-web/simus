import type { Npc } from "@/app/participate/npc-motion";
import { isV002MapVersion, graphDistanceTo } from "./city-v002-graph.mjs";
import type { EventLocation } from "./event-locations";

type Interval = [number, number];
export type PlaceScan = { inside: boolean; entries: number; firstEntry: number | null };
const distance = (a: number[], b: number[]) => Math.hypot(...a.map((v, i) => v - b[i]));
const geometryCache = new Map<string, { intervals: Interval[]; total: number }>();

// Intervals are measured along the actual ordered polyline, never a chord between
// polling samples. Periodic boundary arithmetic also covers arbitrarily long gaps.
function insideIntervals(npc: Npc, location: EventLocation): { intervals: Interval[]; total: number } {
  const key = JSON.stringify([npc.motion.map_version, npc.motion.points, npc.motion.loop, location]);
  const cached = geometryCache.get(key);
  if (cached) return cached;
  const points = npc.motion.loop ? [...npc.motion.points, npc.motion.points[0]] : npc.motion.points;
  const intervals: Interval[] = [];
  let graphDistance: ((p: number[]) => number) | null = null;
  if (isV002MapVersion(npc.motion.map_version)) {
    try { graphDistance = graphDistanceTo(location.point, npc.motion.map_version); }
    catch { return { intervals: [], total: 0 }; }
  }
  const geodesic = (p: number[]) => {
    try { return graphDistance ? graphDistance(p) : distance(p, location.point); }
    catch { return Infinity; }
  };
  let offset = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], length = distance(a, b);
    if (!length) continue;
    const radius = location.radius_m, local: Interval[] = [];
    if (isV002MapVersion(npc.motion.map_version)) {
      // On an atomic graph edge, a shortest path leaves through either endpoint,
      // or goes directly to an anchor on this same edge.
      const da = geodesic(a), db = geodesic(b);
      if (da <= radius) local.push([0, Math.min(length, radius - da)]);
      if (db <= radius) local.push([Math.max(0, length + db - radius), length]);
      const unit = b.map((v, axis) => (v - a[axis]) / length);
      const at = location.point.reduce((sum, v, axis) => sum + (v - a[axis]) * unit[axis], 0);
      const projection = a.map((v, axis) => v + at * unit[axis]);
      const perpendicular = distance(projection, location.point);
      if (at >= 0 && at <= length && perpendicular <= .005 &&
          Math.abs(da - distance(a, location.point)) <= 1e-7 && Math.abs(db - distance(b, location.point)) <= 1e-7) {
        const half = Math.sqrt(Math.max(0, radius * radius - perpendicular * perpendicular));
        if (perpendicular <= radius) local.push([Math.max(0, at - half), Math.min(length, at + half)]);
      }
    } else {
      const unit = b.map((v, axis) => (v - a[axis]) / length);
      const at = location.point.reduce((sum, v, axis) => sum + (v - a[axis]) * unit[axis], 0);
      const perpendicular = distance(a.map((v, axis) => v + at * unit[axis]), location.point);
      if (perpendicular <= radius) {
        const half = Math.sqrt(Math.max(0, radius * radius - perpendicular * perpendicular));
        if (at + half >= 0 && at - half <= length) local.push([Math.max(0, at - half), Math.min(length, at + half)]);
      }
    }
    for (const [start, end] of local) if (end >= start) intervals.push([offset + start, offset + end]);
    offset += length;
  }
  intervals.sort((a, b) => a[0] - b[0]);
  const merged: Interval[] = [];
  for (const interval of intervals) {
    const previous = merged[merged.length - 1];
    if (previous && interval[0] <= previous[1] + 1e-8) previous[1] = Math.max(previous[1], interval[1]);
    else merged.push([...interval]);
  }
  const geometry = { intervals: merged, total: offset };
  if (geometryCache.size >= 128) geometryCache.delete(geometryCache.keys().next().value!);
  geometryCache.set(key, geometry);
  return geometry;
}

export function scanPlace(npc: Npc, from: number, to: number, location: EventLocation, wasInside: boolean): PlaceScan {
  const { intervals, total } = insideIntervals(npc, location);
  const epoch = Date.parse(npc.epoch), speed = npc.motion.speed_mps;
  const travelled = (time: number) => Math.max(0, time - epoch) / 1000 * speed;
  const start = npc.motion.loop && total ? travelled(from) : Math.min(total, travelled(from));
  const end = npc.motion.loop && total ? travelled(to) : Math.min(total, travelled(to));
  const contains = (at: number) => {
    const d = npc.motion.loop && total ? at % total : at;
    return intervals.some(([a, b]) => d >= a && d <= b);
  };
  // A zero-length pause projection still has a real point and graph reachability.
  if (!total) {
    const p = npc.motion.points[0];
    let inside = false;
    try { inside = distance(p, location.point) <= location.radius_m &&
      (!isV002MapVersion(npc.motion.map_version) || graphDistanceTo(location.point, npc.motion.map_version)(p) <= location.radius_m); }
    catch { /* disconnected point */ }
    return { inside, entries: inside && !wasInside ? 1 : 0, firstEntry: inside && !wasInside ? from : null };
  }
  const initial = contains(start) && !wasInside;
  let entries = Number(initial), firstEntry: number | null = initial ? from : null;
  const representableEntry = (atDistance: number) => {
    const at = Math.ceil(epoch + atDistance / speed * 1000);
    // Never freeze outside a radius merely to round a submillisecond tangent.
    return at <= to && contains(travelled(at)) ? at : null;
  };
  if (speed > 0 && end > start) {
    const alwaysInside = intervals.length === 1 && intervals[0][0] === 0 && intervals[0][1] === total;
    for (const [boundary] of intervals) {
      // The loop seam joins two inside intervals and is not another entry.
      if (npc.motion.loop && (alwaysInside || (boundary === 0 && intervals[intervals.length - 1][1] === total))) continue;
      if (npc.motion.loop) {
        const firstCycle = Math.max(0, Math.floor((start - boundary) / total) + 1);
        const lastCycle = Math.floor((end - boundary) / total);
        if (lastCycle < firstCycle) continue;
        entries += lastCycle - firstCycle + 1;
        const at = representableEntry(boundary + firstCycle * total);
        if (at !== null) firstEntry = firstEntry === null ? at : Math.min(firstEntry, at);
      } else if (boundary > start && boundary <= end) {
        entries++;
        const at = representableEntry(boundary);
        if (at !== null) firstEntry = firstEntry === null ? at : Math.min(firstEntry, at);
      }
    }
  }
  return { inside: contains(end), entries, firstEntry };
}
