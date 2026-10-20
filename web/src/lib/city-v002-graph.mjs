import graph from './data/city-rebuild-v002-graph.json' with { type: 'json' };

export const MAP_VERSION = graph.map_version;
export const PATH_VERSION = graph.path_version;
export const pedestrianGraph = graph;
const EPS = 0.005;
export const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
export const pathLength = points => points.slice(1).reduce((sum, p, i) => sum + distance(points[i], p), 0);
const vertices = graph.nodes.map(n => n.position);
const adjacency = vertices.map(() => []);
const segments = [];
function link(a, b) {
  const length = distance(vertices[a], vertices[b]);
  adjacency[a].push([b, length]); adjacency[b].push([a, length]);
  segments.push({ a, b });
}
for (const edge of graph.edges) {
  let previous = edge.from;
  for (const point of edge.points.slice(1, -1)) {
    const next = vertices.length; vertices.push(point); adjacency.push([]); link(previous, next); previous = next;
  }
  link(previous, edge.to);
}
function project(point, segment) {
  const a = vertices[segment.a], b = vertices[segment.b];
  const delta = b.map((v, i) => v - a[i]);
  const length2 = delta.reduce((s, v) => s + v * v, 0);
  const t = length2 ? Math.max(0, Math.min(1, delta.reduce((s, v, i) => s + v * (point[i] - a[i]), 0) / length2)) : 0;
  const position = a.map((v, i) => v + t * delta[i]);
  return { ...segment, position, error: distance(point, position) };
}
export function locate(point) {
  if (!Array.isArray(point) || point.length !== 3 || point.some(v => !Number.isFinite(v))) throw new Error('Invalid graph point');
  let best;
  for (const segment of segments) {
    const candidate = project(point, segment);
    if (!best || candidate.error < best.error) best = candidate;
  }
  if (!best || best.error > EPS) throw new Error('Point is outside the v002 pedestrian graph');
  return best;
}
export function isGraphSegment(a, b) {
  return segments.some(s => project(a, s).error <= EPS && project(b, s).error <= EPS);
}
export function routeBetween(origin, destination) {
  const source = locate(origin), target = locate(destination);
  const start = vertices.length, end = start + 1;
  const positions = [...vertices, origin, destination];
  const extras = new Map();
  function add(a, b) {
    const cost = distance(positions[a], positions[b]);
    for (const [u, v] of [[a, b], [b, a]]) {
      if (!extras.has(u)) extras.set(u, []);
      extras.get(u).push([v, cost]);
    }
  }
  for (const at of [source.a, source.b]) add(start, at);
  for (const at of [target.a, target.b]) add(end, at);
  if (isGraphSegment(origin, destination)) add(start, end);
  const costs = positions.map(() => Infinity), previous = positions.map(() => -1), visited = new Set();
  costs[start] = 0;
  for (;;) {
    let current = -1;
    for (let i = 0; i < costs.length; i++) if (!visited.has(i) && (current < 0 || costs[i] < costs[current])) current = i;
    if (current < 0 || !Number.isFinite(costs[current])) throw new Error('Disconnected v002 pedestrian destination');
    if (current === end) break;
    visited.add(current);
    for (const [next, length] of [...(adjacency[current] ?? []), ...(extras.get(current) ?? [])]) {
      if (costs[current] + length < costs[next]) { costs[next] = costs[current] + length; previous[next] = current; }
    }
  }
  const route = [];
  for (let at = end; at !== -1; at = previous[at]) route.push(positions[at]);
  route.reverse();
  return route.filter((p, i) => i === 0 || distance(p, route[i - 1]) > 1e-8);
}
export function nodePoint(id) {
  const node = graph.nodes.find(n => n.id === id);
  if (!node) throw new Error('Unknown v002 node: ' + id);
  return node.position;
}
export function defaultMotion() {
  const checkpoints = ['CAMPUS_PLAZA', 'B04_ACCESS', 'B16_ACCESS', 'PARK_REST_2', 'CAMPUS_PLAZA'].map(nodePoint);
  const points = checkpoints.slice(1).flatMap((p, i) => routeBetween(checkpoints[i], p).slice(i ? 1 : 0));
  return { map_version: MAP_VERSION, path_version: PATH_VERSION, points, speed_mps: 2.38, loop: true };
}
// Expand every authored leg, including the loop closure. Never create a shortcut.
export function graphMotion(motion) {
  if (motion.map_version !== MAP_VERSION) return motion;
  if (motion.path_version !== PATH_VERSION) throw new Error('Unsupported v002 path_version');
  const stops = motion.loop ? [...motion.points, motion.points[0]] : motion.points;
  const points = stops.slice(1).flatMap((p, i) => routeBetween(stops[i], p).slice(i ? 1 : 0));
  if (points.length < 2 || points.length > 2048) throw new Error('Graph route exceeds the motion point limit');
  return { ...motion, points };
}
