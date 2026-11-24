using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Simus.QualityPass;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.AI;

public static class CityMasterplanV003EventRouteAudit
{
    private static readonly Vector3 Spawn = new Vector3(44.35f, .202832f, 65);
    private static readonly HashSet<int> Entrances = new HashSet<int> { 8, 9, 10, 15, 19, 23, 29 };
    private static readonly HashSet<int> Encounters = new HashSet<int> { 5, 6, 16, 18, 21, 22 };

    public static void Export()
    {
        var scenePath = CityMasterplanV003LocalBuild.ScenePath;
        var scene = EditorSceneManager.OpenScene(scenePath);
        var markers = scene.GetRootGameObjects().SelectMany(root => root.GetComponentsInChildren<Transform>(true))
            .Where(t => t.name.StartsWith("FULL_EVENT_", StringComparison.Ordinal))
            .ToDictionary(t => t.name);
        var navMesh = UnityEngine.Object.FindFirstObjectByType<QualityNavMesh>();
        if (navMesh == null || navMesh.data == null) throw new InvalidOperationException("The v003 walking mesh is missing.");
        var instance = NavMesh.AddNavMeshData(navMesh.data);
        Physics.SyncTransforms();
        try
        {
            var results = new JObject();
            for (var number = 1; number < 30; number++)
            {
                if (number == 12 || number == 26) continue;
                var marker = "FULL_EVENT_" + number.ToString("00");
                var target = number switch {
                    10 => new Vector3(17f, 2.214f, 178.015f), // 1 m outside the U02 south entrance
                    29 => new Vector3(-177f, .582f, 28.04f), // 1 m outside the D01 north entrance
                    _ => markers[marker + (Entrances.Contains(number) ? "_START" : "_INTERACT")].position
                };
                results["EXHIBITION_" + number.ToString("00")] = Audit(target,
                    Entrances.Contains(number) ? "entrance" : Encounters.Contains(number) ? "encounter" :
                    (number == 27 || number == 28) ? "road" : "place");
            }
            using var sha = SHA256.Create();
            var report = new JObject {
                ["source_scene_sha256"] = BitConverter.ToString(sha.ComputeHash(File.ReadAllBytes(scenePath))).Replace("-", "").ToLowerInvariant(),
                ["routes"] = results
            };
            var output = Environment.GetEnvironmentVariable("SIMUS_V003_EVENT_ROUTE_OUTPUT") ?? "Logs/v003-event-routes.json";
            Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(output)));
            File.WriteAllText(output, report.ToString());
            Debug.Log("V003 event routes: " + results.Properties().Count(p => (bool)p.Value["passed"]) +
                "/" + results.Properties().Count() + " passed. " + output);
            var runtimePath = Environment.GetEnvironmentVariable("SIMUS_V003_EVENT_ROUTE_RUNTIME_OUTPUT");
            if (!string.IsNullOrEmpty(runtimePath))
            {
                if (results.Properties().Any(p => !(bool)p.Value["passed"]))
                    throw new InvalidOperationException("Some event paths failed. See the audit before updating the server data.");
                var routeLines = results.Properties().Select(p => "    " + JsonConvert.ToString(p.Name) + ": " +
                    new JObject { ["kind"] = p.Value["kind"], ["points"] = p.Value["points"] }.ToString(Formatting.None));
                File.WriteAllText(runtimePath, "{\"source_scene_sha256\":" + JsonConvert.ToString((string)report["source_scene_sha256"]) +
                    ",\n  \"routes\": {\n" + string.Join(",\n", routeLines) + "\n  }\n}\n");
            }
        }
        finally { instance.Remove(); }
    }

    private static JObject Audit(Vector3 target, string kind)
    {
        var report = new JObject { ["kind"] = kind, ["marker"] = Point(target), ["passed"] = false };
        if (!NavMesh.SamplePosition(Spawn, out var start, 2f, NavMesh.AllAreas))
        {
            report["reason"] = "spawn_off_navmesh";
            return report;
        }
        if (!NavMesh.SamplePosition(target, out var destination, 2f, NavMesh.AllAreas))
        {
            report["reason"] = "marker_off_navmesh";
            return report;
        }
        report["nav_destination"] = Point(destination.position);
        var route = new NavMeshPath();
        if (!NavMesh.CalculatePath(start.position, destination.position, NavMesh.AllAreas, route) ||
            route.status != NavMeshPathStatus.PathComplete)
        {
            report["reason"] = "no_complete_navmesh_path";
            return report;
        }
        var samples = new List<Vector3> { Spawn };
        var corners = new[] { Spawn }.Concat(route.corners).ToArray();
        for (var index = 1; index < corners.Length; index++)
        {
            var from = corners[index - 1];
            var to = corners[index];
            var steps = Mathf.CeilToInt(Vector3.Distance(from, to) / .45f);
            for (var step = 1; step <= steps; step++)
            {
                var point = Vector3.Lerp(from, to, (float)step / steps);
                if (!TryWalkingPoint(point, out var ground, out var reason) ||
                    Mathf.Abs(ground.y - samples[samples.Count - 1].y) > .32f)
                {
                    report["reason"] = reason ?? "step_too_high";
                    report["first_invalid_point"] = Point(point);
                    return report;
                }
                samples.Add(ground);
            }
        }
        if (samples.Count < 2 || samples.Count > 2030)
        {
            report["reason"] = "invalid_waypoint_count";
            return report;
        }
        report["passed"] = true;
        report["points"] = new JArray(samples.Select(Point));
        return report;
    }

    private static bool TryWalkingPoint(Vector3 point, out Vector3 ground, out string reason)
    {
        var surface = Physics.RaycastAll(point + Vector3.up * 1.5f, Vector3.down, 3f,
                Physics.DefaultRaycastLayers, QueryTriggerInteraction.Ignore)
            .Where(hit => hit.normal.y > .5f && Mathf.Abs(hit.point.y - point.y) < .55f)
            .OrderByDescending(hit => hit.point.y).FirstOrDefault();
        ground = surface.point;
        if (surface.collider == null)
        {
            reason = "floor_missing";
            return false;
        }
        // Leave 0.22 m below the body capsule for the existing pedestrian curb step.
        var overlaps = Physics.OverlapCapsule(ground + Vector3.up * .50f, ground + Vector3.up * 1.45f, .28f,
            Physics.DefaultRaycastLayers, QueryTriggerInteraction.Ignore);
        reason = overlaps.Length == 0 ? null : "blocked_by:" + overlaps[0].name;
        return overlaps.Length == 0;
    }

    private static JArray Point(Vector3 point) => new JArray(
        Math.Round(point.x, 6), Math.Round(point.y, 6), Math.Round(point.z, 6));
}
