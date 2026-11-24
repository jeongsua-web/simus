"""Build the v003 pedestrian design overlay from the masterplan and saved scene."""
import argparse
from collections import Counter, defaultdict
from hashlib import sha256
from heapq import heappop, heappush
import json
from math import dist
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
PLAN = ROOT / "docs/planning/city_masterplan_v003"
SCENE = ROOT / "unity/Assets/SIMUS/Scenes/city_masterplan_v003/CityMasterplan_v003_EventPlaces.unity"
OUTPUT = PLAN / "npc_pedestrian_network.json"
RADIUS = 0.28  # Body clearance used by the Unity event-route audit.
EPSILON = 1e-8
WALK_SPEED_MPS = 1.4
CONTROLLED_CROSSING_DELAY_S = 12
# The draft tagged this as a generic walk. Its existing centerline fits CW18.
CROSSING_EDGE_CORRECTIONS = {"W0318": "CW18"}


def xz(point):
    return point[0], point[2]


class Corridor:
    """A finite strip oriented along its two endpoints, in Unity X/Z metres."""

    def __init__(self, start, end, width, end_margin=0):
        self.start = start
        self.length = dist(start, end)
        self.direction = tuple((b - a) / self.length for a, b in zip(start, end))
        self.bounds = ((-end_margin, self.length + end_margin), (-width / 2, width / 2))

    def local(self, point):
        dx, dz = (p - origin for p, origin in zip(point, self.start))
        ux, uz = self.direction
        return dx * ux + dz * uz, dz * ux - dx * uz

    def contains(self, point):
        return all(low - EPSILON <= value <= high + EPSILON
                   for value, (low, high) in zip(self.local(point), self.bounds))

    def clip(self, start, end):
        """Return the interval inside the strip using continuous segment clipping."""
        enter, exit = 0.0, 1.0
        for a, b, (low, high) in zip(self.local(start), self.local(end), self.bounds):
            if abs(b - a) < EPSILON:
                if a < low - EPSILON or a > high + EPSILON:
                    return None
                continue
            first, last = sorted(((low - a) / (b - a), (high - a) / (b - a)))
            enter, exit = max(enter, first), min(exit, last)
            if enter > exit + EPSILON:
                return None
        return tuple(tuple(a + (b - a) * t for a, b in zip(start, end))
                     for t in (enter, exit))


def road_intersections(points, roads):
    for start, end in zip(points, points[1:]):
        for road_id, corridor in roads:
            span = corridor.clip(start, end)
            if span is not None:
                yield road_id, span


def crossing_coverage(points, roads, crossings):
    """Every road overlap must fit the same authorized strip for that road."""
    matches = None
    touched = set()
    for road_id, span in road_intersections(points, roads):
        touched.add(road_id)
        allowed = {crossing_id for crossing_id, corridor in crossings.get(road_id, ())
                   if all(corridor.contains(p) for p in span)}
        matches = allowed if matches is None else matches & allowed
    return sorted(touched), sorted(matches or ())


def components(nodes, edges):
    neighbors = defaultdict(set)
    for edge in edges:
        a, b = edge["from_node"], edge["to_node"]
        neighbors[a].add(b)
        neighbors[b].add(a)
    remaining = set(nodes)
    groups = []
    while remaining:
        seed = min(remaining)
        remaining.remove(seed)
        queue = [seed]
        for node in queue:
            adjacent = sorted(neighbors[node] & remaining)
            remaining.difference_update(adjacent)
            queue.extend(adjacent)
        groups.append(sorted(queue))
    return sorted(groups, key=lambda group: (-len(group), group[0]))


def shortest_path(neighbors, start, end):
    queue = [(0, start)]
    costs = {start: 0}
    previous = {}
    while queue:
        cost, node = heappop(queue)
        if cost > costs[node]:
            continue
        if node == end:
            path = []
            while node != start:
                node, edge_id = previous[node]
                path.append(edge_id)
            return path[::-1]
        for next_node, edge_id, seconds in neighbors[node]:
            candidate = cost + seconds
            if candidate < costs.get(next_node, float("inf")):
                costs[next_node] = candidate
                previous[next_node] = (node, edge_id)
                heappush(queue, (candidate, next_node))
    return None


def follow_edges(edges, start, edge_ids):
    node = start
    for edge_id in edge_ids:
        edge = edges[edge_id]
        a, b = edge["from_node"], edge["to_node"]
        if node not in (a, b):
            raise ValueError(f"Disconnected draft route at {node} → {edge_id}")
        node = b if node == a else a
    return node


def event_detours(draft, accepted, crossing_edges, crossing_records, blocked, non_stop_nodes):
    edges = {edge["id"]: edge for edge in draft["edges"]}
    control = {crossing["id"]: crossing["control"] for crossing in crossing_records}
    neighbors = defaultdict(list)
    for edge in accepted:
        a, b = edge["from_node"], edge["to_node"]
        edge_id = edge["id"]
        seconds = edge["length_m"] / WALK_SPEED_MPS
        if control.get(crossing_edges.get(edge_id)) == "controlled":
            seconds += CONTROLLED_CROSSING_DELAY_S
        neighbors[a].append((b, edge_id, seconds))
        neighbors[b].append((a, edge_id, seconds))

    detours = []
    for event in draft["event_routes"]:
        origin = draft["spawn_node"]
        for leg in ("approach", "exit"):
            original = event[leg]
            if not original:
                continue
            goal = follow_edges(edges, origin, original)
            removed = [edge_id for edge_id in original if edge_id in blocked]
            if removed or origin in non_stop_nodes or goal in non_stop_nodes:
                path = None
                if origin not in non_stop_nodes and goal not in non_stop_nodes:
                    path = shortest_path(neighbors, origin, goal)
                detours.append({
                    "event": event["event"], "leg": leg, "from_node": origin, "to_node": goal,
                    "blocked_edges": removed, "replacement_edges": path,
                    "status": "detour" if path is not None else "needs_pedestrian_anchor",
                })
            origin = goal
    return detours


def audit_saved_event_paths(scene_hash, roads, crossings):
    fixed_path = ROOT / "web/src/lib/routes/data/v003-local-route.json"
    test_paths = ROOT / "web/src/lib/routes/data/v003-event-routes.json"
    fixed, tests = (json.loads(path.read_bytes()) for path in (fixed_path, test_paths))
    if any(source["source_scene_sha256"] != scene_hash for source in (fixed, tests)):
        return {"status": "scene_hash_mismatch"}

    def overlaps(points):
        uncovered = set()
        for road_id, span in road_intersections(list(map(xz, points)), roads):
            if not any(all(strip.contains(point) for point in span)
                       for _, strip in crossings.get(road_id, ())):
                uncovered.add(road_id)
        return sorted(uncovered)

    test_overlaps = {}
    for code, route in tests["routes"].items():
        uncovered = overlaps(route["points"])
        if uncovered:
            test_overlaps[code] = uncovered
    return {
        "status": "design_xz_geometry_checked",
        "fixed_path_uncovered_roads": overlaps(fixed["points"]),
        "fixed_return_uncovered_roads": overlaps(fixed["resume_points"]),
        "test_path_count": len(tests["routes"]),
        "test_paths_with_uncovered_roads": test_overlaps,
    }


def build_network():
    source = (PLAN / "routes.json").read_bytes()
    draft = json.loads(source)
    scene = SCENE.read_bytes()
    marker_counts = Counter(re.findall(rb"^  m_Name: Crosswalk_(\S+)[ \t]*\r?$", scene, re.M))

    roads = [
        (road["id"], Corridor(a, b, road["width_m"] + 2 * RADIUS, RADIUS))
        for road in draft["vehicle_roads"] for a, b in zip(road["points"], road["points"][1:])
    ]
    crossings = defaultdict(list)
    crossing_strips = {}
    crossing_records = []
    for crossing in draft["crossings"]:
        route_id = crossing["route_id"]
        markers = marker_counts[route_id.encode()]
        road_id = "R01" if route_id == "GATE_CROSSING_0" else (
            route_id.split("_")[1] if route_id.startswith("X_R") else None)
        start, end = crossing["points"]
        # Longitudinal limits are the waiting points. Reduce the lateral width
        # for the body radius. The road strips already include that radius.
        corridor = Corridor(start, end, crossing["width_m"] - 2 * RADIUS)
        if markers == 1 and road_id:
            crossings[road_id].append((crossing["id"], corridor))
            crossing_strips[crossing["id"]] = corridor
        crossing_records.append({
            "id": crossing["id"], "scene_object": f"Crosswalk_{route_id}",
            "scene_matches": markers, "road_id": road_id,
            "wait_points_xz": [start, end], "width_m": crossing["width_m"],
            "control": crossing["signal_control"],
        })

    nodes = {node["id"]: xz(node["position"]) for node in draft["nodes"]}
    non_stop_nodes = {node for node, point in nodes.items()
                      if any(corridor.contains(point) for _, corridor in roads)}
    accepted = []
    walk_edges = []
    crossing_edges = {}
    blocked = {}
    for edge in draft["edges"]:
        edge_id = edge["id"]
        points = [xz(p) for p in edge["points"]]
        touched, matches = crossing_coverage(points, roads, crossings)
        if not touched:
            walk_edges.append(edge_id)
        else:
            reason = "unmarked_road_overlap"
            if matches:
                crossing_id = matches[0]
                strip = crossing_strips[crossing_id]
                start, end = (strip.local(p)[0] - strip.length / 2 for p in (points[0], points[-1]))
                if len(matches) != 1 or (edge["type"] != "crossing" and
                                        CROSSING_EDGE_CORRECTIONS.get(edge_id) != crossing_id):
                    reason = "ambiguous_or_untyped_crossing"
                elif start * end >= 0 or {edge["from_node"], edge["to_node"]} & non_stop_nodes:
                    reason = "incomplete_crossing"
                else:
                    crossing_edges[edge_id] = crossing_id
                    reason = None
            if reason:
                blocked[edge_id] = {"roads": touched, "reason": reason}
                continue
        accepted.append(edge)

    groups = components(nodes, accepted)
    spawn_group = next(group for group in groups if draft["spawn_node"] in group)
    detours = event_detours(draft, accepted, crossing_edges, crossing_records, blocked, non_stop_nodes)
    used_crossings = Counter(crossing_edges.values())
    for crossing in crossing_records:
        crossing["road_edge_count"] = used_crossings[crossing["id"]]
    usable_crossings = {
        road: [(crossing_id, strip) for crossing_id, strip in corridors if used_crossings[crossing_id]]
        for road, corridors in crossings.items()
    }
    scene_hash = sha256(scene).hexdigest()

    return {
        "schema": "simus.npc_pedestrian_network.v003.1",
        "status": "design_geometry_checked_pending_unity",
        "source_routes": "routes.json",
        "source_routes_sha256": sha256(source).hexdigest(),
        "source_scene": str(SCENE.relative_to(ROOT)),
        "source_scene_sha256": scene_hash,
        "body_radius_m": RADIUS,
        "routing_assumptions": {
            "walk_speed_mps": WALK_SPEED_MPS,
            "controlled_crossing_delay_s": CONTROLLED_CROSSING_DELAY_S,
        },
        "spawn_node": draft["spawn_node"],
        "summary": {
            "walk_edges": len(walk_edges),
            "crossing_edges": len(crossing_edges),
            "blocked_edges": len(blocked),
            "crossing_ids_used": len(used_crossings),
            "nodes_in_spawn_component": len(spawn_group),
            "component_sizes": [len(group) for group in groups if len(group) > 1],
            "isolated_nodes": sum(len(group) == 1 for group in groups),
        },
        "walk_edges": walk_edges,
        "crossing_edges": crossing_edges,
        "blocked_edges": blocked,
        "crossings": crossing_records,
        "no_stop_nodes": sorted(non_stop_nodes),
        "spawn_component_nodes": spawn_group,
        "event_route_changes": detours,
        "saved_event_path_audit": audit_saved_event_paths(scene_hash, roads, usable_crossings),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Check the committed design overlay is current.")
    args = parser.parse_args()
    network = build_network()
    result = json.dumps(network, ensure_ascii=False, indent=2) + "\n"
    if args.check:
        if not OUTPUT.is_file() or OUTPUT.read_text() != result:
            parser.exit(1, f"{OUTPUT.relative_to(ROOT)} is stale. Run {Path(__file__).name} to refresh it.\n")
    else:
        OUTPUT.write_text(result)
    print(json.dumps(network["summary"], ensure_ascii=False))


if __name__ == "__main__":
    main()
