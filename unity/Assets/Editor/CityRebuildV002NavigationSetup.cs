using System;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using Newtonsoft.Json.Linq;
using Simus;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

/// <summary>Incremental Phase 5 only. Never rebuilds the approved urban layout or writes source scenes/build settings.</summary>
public static class CityRebuildV002NavigationSetup
{
    [MenuItem("SIMUS/City Rebuild v002/Apply Phase 5 Graph Navigation")]
    public static void Apply()
    {
        if (EditorApplication.isPlayingOrWillChangePlaymode) throw new InvalidOperationException("Apply graph navigation in Edit Mode.");
        if (!Application.isBatchMode && !EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;
        var scene = EditorSceneManager.OpenScene(CityRebuildV002Setup.ScenePath);
        var city = GameObject.Find("CityRebuild_v002"); if (city == null) throw new InvalidOperationException("Phase 3 city missing.");
        var source = File.ReadAllBytes("../docs/planning/city_rebuild_v002/layout.json");
        var layout = JObject.Parse(System.Text.Encoding.UTF8.GetString(source));
        if (layout["pedestrian_nodes"].Count() != 388 || layout["pedestrian_edges"].Count() != 409) throw new InvalidOperationException("Approved graph cardinality changed.");
        var patrol = UnityEngine.Object.FindObjectsByType<TestNpcPatrol>(FindObjectsSortMode.None).FirstOrDefault(p => p.GetComponent<CityV002NpcRouteAdapter>() == null || p.GetComponent<CityV002NpcRouteAdapter>().routeId == "school_commerce");
        if (patrol == null) throw new InvalidOperationException("Preserved test NPC missing.");
        var old = city.transform.Find("11_PedestrianNavigation_v002");
        if (old != null) UnityEngine.Object.DestroyImmediate(old.gameObject);
        // Keep the primary actor outside the replaceable verification hierarchy.
        var graphRoot = new GameObject("11_PedestrianNavigation_v002"); graphRoot.transform.SetParent(city.transform, false);
        var graph = graphRoot.AddComponent<CityV002PedestrianGraph>();
        using (var sha = SHA256.Create()) graph.layoutSha256 = BitConverter.ToString(sha.ComputeHash(source)).Replace("-", "").ToLowerInvariant();
        graph.nodes = layout["pedestrian_nodes"].Select(n => new CityV002PedestrianGraph.Node { id = (string)n["id"], position = new Vector3((float)n["x"], .16f, (float)n["z"]) }).ToArray();
        var indices = graph.nodes.Select((n, i) => new { n.id, i }).ToDictionary(n => n.id, n => n.i);
        graph.edges = layout["pedestrian_edges"].Select(e => new CityV002PedestrianGraph.Edge
        {
            id = (string)e["id"], kind = (string)e["kind"], from = indices[(string)e["from"]], to = indices[(string)e["to"]], width = (float)e["width"],
            points = e["points"].Select(p => new Vector3((float)p[0], .16f, (float)p[1])).ToArray()
        }).ToArray();
        CityRebuildV002RiverSetup.ExtendNavigation(graph);
        var routes = new[] {
            new[] { "school_commerce", "CAMPUS_PLAZA", "B04_ACCESS" },
            new[] { "school_residential", "CAMPUS_PLAZA", "B16_ACCESS" },
            new[] { "school_park", "CAMPUS_PLAZA", "PARK_REST_2" },
            new[] { "residential_commerce", "B16_ACCESS", "B04_ACCESS" }
        };
        var actors = new CityV002NpcRouteAdapter[routes.Length]; var evidence = new JArray();
        for (int i = 0; i < routes.Length; i++)
        {
            var actor = i == 0 ? patrol.gameObject : UnityEngine.Object.Instantiate(patrol.gameObject, graphRoot.transform);
            if (i > 0) actor.name = "GraphProbe_" + routes[i][0];
            var adapter = actor.GetComponent<CityV002NpcRouteAdapter>(); if (adapter == null) adapter = actor.AddComponent<CityV002NpcRouteAdapter>();
            adapter.graph = graph; adapter.routeId = routes[i][0]; adapter.startNode = routes[i][1]; adapter.destinationNode = routes[i][2]; adapter.startAutomatically = true; adapter.returnToStart = true;
            if (!graph.TryRoute(adapter.startNode, adapter.destinationNode, out var points, out var edgeIds, out var length)) throw new InvalidOperationException("Disconnected required route " + adapter.routeId);
            actor.transform.position = points[0]; actors[i] = adapter;
            evidence.Add(new JObject { ["route_id"] = adapter.routeId, ["from"] = adapter.startNode, ["to"] = adapter.destinationNode, ["length_m"] = length,
                ["expected_seconds_at_1_4m_s"] = length / 1.4f, ["expected_roundtrip_seconds_at_1_4m_s"] = length * 2 / 1.4f,
                ["round_trip"] = true, ["edges"] = new JArray(edgeIds), ["status"] = "NOT TESTED: editor path selection only" });
        }
        var monitor = graphRoot.AddComponent<CityV002NavigationVerification>(); monitor.actors = actors;
        Physics.SyncTransforms(); EditorSceneManager.SaveScene(scene, CityRebuildV002Setup.ScenePath); AssetDatabase.SaveAssets();
        File.WriteAllText("../docs/verification/city-rebuild-v002-navigation-setup.json", new JObject {
            ["layout_sha256"] = graph.layoutSha256, ["nodes"] = graph.nodes.Length, ["edges"] = graph.edges.Length,
            ["adapter"] = "Existing TestNpcPatrol MoveTowards, waypoint adapter; NpcGrounding and animation preserved",
            ["navmesh"] = "NOT TESTED: Unity navigation module/package absent; graph routes reuse approved edge geometry",
            ["actual_door_access"] = "NOT TESTED: B04/B16 are exterior design approach anchors; FBX doorway thresholds unverified",
            ["routes"] = evidence, ["play_mode"] = "NOT TESTED" }.ToString());
        Debug.Log("CITY_V002_NAVIGATION_SETUP_READY nodes=" + graph.nodes.Length + " edges=" + graph.edges.Length + " route_probes=4");
    }
}
