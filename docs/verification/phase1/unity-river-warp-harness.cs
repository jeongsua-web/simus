using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Security.Cryptography;
using Newtonsoft.Json.Linq;
using Simus;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

// QA-only: invokes the unchanged bridge motion method on an inactive template clone.
[InitializeOnLoad]
public static class Phase1RiverWarpQa
{
    const string Pending = "SIMUS.Phase1RiverWarpQA.Pending";
    static readonly List<GameObject> actors = new List<GameObject>();
    static readonly List<Vector3> expected = new List<Vector3>();
    static readonly List<JObject> rows = new List<JObject>();
    static int startedFrame;
    static bool finishing;
    static string Sha() { using (var sha = SHA256.Create()) return BitConverter.ToString(sha.ComputeHash(File.ReadAllBytes(CityRebuildV002Setup.ScenePath))).Replace("-", "").ToLowerInvariant(); }
    static JArray V(Vector3 p) => new JArray(p.x, p.y, p.z);
    static Phase1RiverWarpQa()
    {
        EditorApplication.playModeStateChanged += OnPlay;
        EditorApplication.update += Update;
    }
    public static void Run()
    {
        SessionState.SetString("SIMUS.Phase1RiverWarpQA.Hash", Sha());
        EditorSceneManager.OpenScene(CityRebuildV002Setup.ScenePath);
        SessionState.SetBool(Pending, true);
        EditorApplication.isPlaying = true;
    }
    static void OnPlay(PlayModeStateChange state)
    {
        if (!SessionState.GetBool(Pending, false)) return;
        if (state == PlayModeStateChange.EnteredPlayMode)
        {
            actors.Clear(); expected.Clear(); rows.Clear(); finishing = false;
            var roles = UnityEngine.Object.FindObjectsByType<CityV002NpcBuildRole>(FindObjectsInactive.Include, FindObjectsSortMode.None);
            var source = roles.Single(r => r.role == CityV002NpcBuildRole.Role.ParticipantTemplate).gameObject;
            var graph = UnityEngine.Object.FindFirstObjectByType<CityV002PedestrianGraph>();
            var river = source.GetComponent<CityV002RiverGuard>().river;
            var candidates = graph.nodes.OrderBy(n => n.id == "PARK_REST_2" ? 0 : n.id.StartsWith("RIVER_E_") ? 1 : 2);
            var destination = candidates.First(n => !river.IsForbidden(n.position) && !river.SegmentSafe(Vector3.zero, n.position) && graph.TryRoute("CAMPUS_PLAZA", n.id, out _, out _, out _));
            AddCase("fresh_network_spawn", source, graph, river, Vector3.zero, destination.position, "template_zero", destination.id);
            CityV002PedestrianGraph.Node from = null, to = null;
            foreach (var n in graph.nodes.Where(n => n.id.StartsWith("RIVER_W_")))
            {
                var other = graph.nodes.FirstOrDefault(q => q.id == n.id.Replace("RIVER_W_", "RIVER_E_"));
                if (other != null && !river.IsForbidden(n.position) && !river.IsForbidden(other.position) && !river.SegmentSafe(n.position, other.position) && graph.TryRoute(n.id, other.id, out _, out _, out _))
                { from = n; to = other; break; }
            }
            if (from == null) throw new InvalidOperationException("No graph-valid opposite-bank warp pair found.");
            AddCase("hidden_tab_resume_warp", source, graph, river, from.position, to.position, from.id, to.id);
            // Control: one valid short step along the same bank, through the same method.
            var near = graph.nodes.Where(n => n.id.StartsWith("RIVER_W_") && n.id != from.id && !river.IsForbidden(n.position) && river.SegmentSafe(from.position, n.position))
                .OrderBy(n => Vector3.Distance(from.position, n.position)).First();
            AddCase("same_bank_control", source, graph, river, from.position, near.position, from.id, near.id);
            startedFrame = Time.frameCount;
        }
        else if (state == PlayModeStateChange.EnteredEditMode && finishing)
        {
            SessionState.SetBool(Pending, false);
            File.WriteAllText("../docs/verification/phase1/unity-river-warp-preservation.json", new JObject {
                ["before"] = SessionState.GetString("SIMUS.Phase1RiverWarpQA.Hash", ""), ["after"] = Sha(),
                ["unchanged"] = SessionState.GetString("SIMUS.Phase1RiverWarpQA.Hash", "") == Sha() }.ToString());
            EditorApplication.delayCall += () => EditorApplication.Exit(0);
        }
    }
    static void AddCase(string id, GameObject source, CityV002PedestrianGraph graph, CityV002RiverArea river, Vector3 start, Vector3 destination, string fromId, string toId)
    {
        var actor = UnityEngine.Object.Instantiate(source); actor.name = "QA_ONLY_RIVER_WARP_" + id;
        actor.SetActive(false);
        actor.GetComponent<TestNpcPatrol>().enabled = false;
        actor.GetComponent<CityV002NpcRouteAdapter>().enabled = false;
        actor.GetComponent<CityV002NpcBuildRole>().role = CityV002NpcBuildRole.Role.TestProbe;
        actor.transform.position = start;
        actor.SetActive(true); // Actual OnEnable captures the pre-snapshot position.
        var projected = actor.GetComponent<NpcGrounding>().Project(destination);
        var guard = actor.GetComponent<CityV002RiverGuard>();
        var row = new JObject { ["case"] = id, ["from_node"] = fromId, ["to_node"] = toId,
            ["start"] = V(start), ["server_point"] = V(destination), ["expected_grounded_point"] = V(projected),
            ["direct_segment_safe"] = river.SegmentSafe(start, destination),
            ["destination_forbidden"] = river.IsForbidden(destination),
            ["bridge_method"] = "WebCityBridge.MoveActor (unchanged private static method, reflection)",
            ["rejected_before"] = guard.rejectedSteps };
        typeof(WebCityBridge).GetMethod("MoveActor", BindingFlags.NonPublic | BindingFlags.Static).Invoke(null, new object[] { actor, destination });
        row["position_immediately_after_bridge"] = V(actor.transform.position);
        actors.Add(actor); expected.Add(projected); rows.Add(row);
    }
    static void Update()
    {
        if (!EditorApplication.isPlaying || actors.Count == 0 || finishing || Time.frameCount <= startedFrame + 2) return;
        for (int i = 0; i < actors.Count; i++)
        {
            var actor = actors[i]; var guard = actor.GetComponent<CityV002RiverGuard>(); var error = Vector3.Distance(actor.transform.position, expected[i]);
            rows[i]["position_after_late_update"] = V(actor.transform.position);
            rows[i]["rejected_after"] = guard.rejectedSteps;
            rows[i]["position_error_m"] = error;
            rows[i]["status"] = error > .05f ? "FAIL" : "PASS";
        }
        File.WriteAllText("../docs/verification/phase1/unity-river-warp.json", new JObject {
            ["scope"] = "Actual Editor Play Mode: inactive participant template clone, unchanged bridge pose method, subsequent actual RiverGuard.LateUpdate; no API/DB writes",
            ["cases"] = new JArray(rows), ["source_scene_sha256"] = Sha(), ["product_code_modified"] = false }.ToString());
        finishing = true; EditorApplication.isPlaying = false;
    }
}
