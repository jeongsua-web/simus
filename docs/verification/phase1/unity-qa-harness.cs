using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using Newtonsoft.Json.Linq;
using Simus;
using UnityEditor;
using UnityEditor.Callbacks;
using UnityEditor.SceneManagement;
using UnityEngine;

// Temporary QA harness. Never saves the production scene or changes application logic.
[InitializeOnLoad]
public static class Phase1QaHarness
{
    const string Out = "../docs/verification/phase1";
    const string Pending = "SIMUS.Phase1QA.Pending";
    const string Finishing = "SIMUS.Phase1QA.Finishing";
    static readonly string[] Four = { "school_commerce", "school_residential", "school_park", "residential_commerce" };
    static readonly List<CityV002NpcRouteAdapter> actors = new List<CityV002NpcRouteAdapter>();
    static readonly List<JObject> actorResults = new List<JObject>();
    static readonly List<Vector3> previous = new List<Vector3>();
    static readonly List<int> frames = new List<int>();
    static double began;
    static int lastFrame = -1;
    static JArray runtimeErrors;
    static Phase1QaHarness()
    {
        EditorApplication.playModeStateChanged += OnPlay;
        EditorApplication.update += Tick;
    }
    static JArray V(Vector3 p) => new JArray(p.x, p.y, p.z);
    static Vector3 P(JToken p) => new Vector3((float)p[0], (float)p[1], (float)p[2]);
    static string Sha(string path) { using (var sha = SHA256.Create()) return BitConverter.ToString(sha.ComputeHash(File.ReadAllBytes(path))).Replace("-", "").ToLowerInvariant(); }
    static string PathOf(Transform t) => t.parent == null ? t.name : PathOf(t.parent) + "/" + t.name;
    static IEnumerable<T> All<T>() where T : Component => UnityEngine.SceneManagement.SceneManager.GetActiveScene().GetRootGameObjects().SelectMany(g => g.GetComponentsInChildren<T>(true));
    static void Write(string name, JToken data) { Directory.CreateDirectory(Out); File.WriteAllText(Out + "/unity-" + name + ".json", data.ToString()); }
    static JObject Input => JObject.Parse(File.ReadAllText("../web/src/lib/data/city-v002-phase1-event-locations.json"));
    static Transform FindPath(string path)
    {
        var parts = path.Split('/');
        var root = UnityEngine.SceneManagement.SceneManager.GetActiveScene().GetRootGameObjects().FirstOrDefault(g => g.name == parts[0]);
        return root == null ? null : (parts.Length == 1 ? root.transform : root.transform.Find(string.Join("/", parts.Skip(1))));
    }
    public static void Run()
    {
        Directory.CreateDirectory(Out);
        SessionState.SetString("SIMUS.Phase1QA.SceneHash", Sha(CityRebuildV002Setup.ScenePath));
        EditorSceneManager.OpenScene(CityRebuildV002Setup.ScenePath);
        Physics.SyncTransforms();
        var graph = All<CityV002PedestrianGraph>().Single();
        var entries = new JArray();
        foreach (var place in Input["locations"])
        {
            var id = (string)place["place_id"];
            var anchor = All<CityV002PlaceAnchor>().SingleOrDefault(a => a.placeId == id);
            var node = graph.nodes.SingleOrDefault(n => n.id == (string)place["approach_node_id"]);
            var point = P(place["point"]);
            var physics = Sample(point);
            var asset = FindPath((string)place["scene_object_path"]);
            var connected = node != null && graph.TryRoute("CAMPUS_PLAZA", node.id, out _, out _, out _);
            entries.Add(new JObject { ["situation_code"] = place["situation_code"], ["place_id"] = id,
                ["anchor_node_id"] = node?.id, ["point"] = V(point), ["marker_position"] = anchor == null ? null : V(anchor.transform.position),
                ["marker_matches"] = anchor != null && Vector3.Distance(point, anchor.transform.position) < .002f,
                ["node_matches"] = node != null && Vector3.Distance(point, node.position) < .002f,
                ["graph_connected"] = connected, ["scene_object_found"] = asset != null,
                ["scene_object_active"] = asset != null && asset.gameObject.activeInHierarchy,
                ["physics"] = physics });
        }
        var routes = new JArray();
        foreach (var id in new[] { "R05LE00_S1", "PKE03_S0", "C07_LINK_S1", "R01LE03_S0" })
        {
            var failures = new JArray(); int count = 0; float maxError = 0;
            foreach (var edge in graph.edges.Where(e => e.id == id || e.id == id + "_PHASE1_CONTINUATION"))
                for (int s = 1; s < edge.points.Length; s++)
                {
                    int steps = Mathf.Max(1, Mathf.CeilToInt(Vector3.Distance(edge.points[s - 1], edge.points[s]) / .2f));
                    for (int i = 0; i <= steps; i++)
                    {
                        var p = Vector3.Lerp(edge.points[s - 1], edge.points[s], i / (float)steps); var result = Sample(p); count++;
                        if (result["ground_error"] != null) maxError = Mathf.Max(maxError, (float)result["ground_error"]);
                        if (!(bool)result["supported"] || ((JArray)result["static_obstacles"]).Count > 0)
                            if (failures.Count < 20) failures.Add(new JObject { ["point"] = V(p), ["sample"] = result });
                    }
                }
            routes.Add(new JObject { ["edge_id"] = id, ["status"] = failures.Count == 0 ? "PASS" : "FAIL", ["samples"] = count,
                ["maximum_route_height_vs_support_error"] = maxError, ["first_failures"] = failures });
        }
        var roles = new JArray(All<CityV002NpcBuildRole>().Select(r => new JObject { ["path"] = PathOf(r.transform), ["role"] = r.role.ToString(), ["active"] = r.gameObject.activeInHierarchy }));
        Write("editor-physics", new JObject { ["scope"] = "Actual Unity Editor scene load and Physics queries; no movement yet", ["unity"] = Application.unityVersion,
            ["scene_sha256"] = Sha(CityRebuildV002Setup.ScenePath), ["compile_and_load"] = "PASS", ["node_count"] = graph.nodes.Length,
            ["edge_count"] = graph.edges.Length, ["places"] = entries, ["adjusted_routes"] = routes, ["roles"] = roles });
        SessionState.SetBool(Pending, true);
        SessionState.SetBool(Finishing, false);
        EditorApplication.isPlaying = true;
    }
    static JObject Sample(Vector3 p)
    {
        var hits = Physics.RaycastAll(p + Vector3.up * .5f, Vector3.down, 2f, Physics.DefaultRaycastLayers, QueryTriggerInteraction.Ignore)
            .Where(h => h.normal.y >= .5f && h.collider.GetComponentInParent<CityV002NpcBuildRole>() == null)
            .OrderBy(h => Mathf.Abs(h.point.y + .02f - p.y)).ToArray();
        bool support = hits.Length > 0 && Mathf.Abs(hits[0].point.y + .02f - p.y) <= .25f;
        var obstacles = new JArray(); var actorsHit = new JArray();
        var projected = p;
        if (support) projected.y = hits[0].point.y + .02f;
        foreach (var c in Physics.OverlapCapsule(projected + Vector3.up * .25f, projected + Vector3.up * 1.55f, .2f, Physics.DefaultRaycastLayers, QueryTriggerInteraction.Ignore))
        {
            if (c.GetComponentInParent<CityV002NpcBuildRole>() != null) actorsHit.Add(PathOf(c.transform));
            else obstacles.Add(PathOf(c.transform));
        }
        return new JObject { ["supported"] = support, ["support"] = hits.Length == 0 ? null : PathOf(hits[0].transform),
            ["support_y"] = hits.Length == 0 ? null : new JValue(hits[0].point.y), ["ground_error"] = hits.Length == 0 ? null : new JValue(Mathf.Abs(hits[0].point.y + .02f - p.y)),
            ["projected_point"] = V(projected), ["static_obstacles"] = obstacles, ["npc_overlaps_diagnostic"] = actorsHit };
    }
    static void OnPlay(PlayModeStateChange change)
    {
        if (change == PlayModeStateChange.EnteredPlayMode && SessionState.GetBool(Pending, false))
        {
            actors.Clear(); actorResults.Clear(); previous.Clear(); frames.Clear(); runtimeErrors = new JArray();
            Application.logMessageReceived += OnLog;
            var graph = All<CityV002PedestrianGraph>().Single();
            var source = All<CityV002NpcBuildRole>().Single(r => r.role == CityV002NpcBuildRole.Role.ParticipantTemplate).gameObject;
            foreach (var adapter in All<CityV002NpcRouteAdapter>().Where(a => Four.Contains(a.routeId))) AddActor(adapter, "existing_four_route", null);
            foreach (var place in Input["locations"])
            {
                var clone = UnityEngine.Object.Instantiate(source); clone.name = "QA_ONLY_" + (string)place["place_id"];
                clone.GetComponent<CityV002NpcBuildRole>().role = CityV002NpcBuildRole.Role.TestProbe;
                var adapter = clone.GetComponent<CityV002NpcRouteAdapter>();
                adapter.startAutomatically = false; adapter.returnToStart = false; adapter.graph = graph;
                adapter.routeId = (string)place["place_id"]; adapter.startNode = "CAMPUS_PLAZA"; adapter.destinationNode = (string)place["approach_node_id"];
                adapter.BeginRoute(); AddActor(adapter, "place_approach", (string)place["situation_code"]);
            }
            Time.timeScale = 20; began = EditorApplication.timeSinceStartup; lastFrame = -1;
        }
        else if (change == PlayModeStateChange.EnteredEditMode && SessionState.GetBool(Finishing, false))
        {
            SessionState.SetBool(Finishing, false); SessionState.SetBool(Pending, false);
            var after = Sha(CityRebuildV002Setup.ScenePath);
            Write("preservation", new JObject { ["before"] = SessionState.GetString("SIMUS.Phase1QA.SceneHash", ""), ["after"] = after,
                ["unchanged"] = after == SessionState.GetString("SIMUS.Phase1QA.SceneHash", "") });
            EditorApplication.delayCall += () => EditorApplication.Exit(0);
        }
    }
    static void AddActor(CityV002NpcRouteAdapter actor, string kind, string code)
    {
        actors.Add(actor); previous.Add(actor.transform.position); frames.Add(0);
        actorResults.Add(new JObject { ["route_id"] = actor.routeId, ["kind"] = kind, ["situation_code"] = code, ["status"] = "RUNNING",
            ["sample_count"] = 0, ["support_failures"] = 0, ["obstacle_samples"] = 0, ["first_failures"] = new JArray(), ["distance_m"] = 0 });
    }
    static void OnLog(string message, string stack, LogType type)
    { if (type == LogType.Error || type == LogType.Exception || type == LogType.Assert) runtimeErrors?.Add(new JObject { ["type"] = type.ToString(), ["message"] = message }); }
    static void Tick()
    {
        if (!EditorApplication.isPlaying || actors.Count == 0 || SessionState.GetBool(Finishing, false) || lastFrame == Time.frameCount) return;
        lastFrame = Time.frameCount;
        for (int a = 0; a < actors.Count; a++)
        {
            var actor = actors[a]; var row = actorResults[a];
            if (actor == null || (string)row["status"] != "RUNNING") continue;
            if (!actor.Started) continue;
            var p = actor.transform.position; int steps = Mathf.Max(1, Mathf.CeilToInt(Vector3.Distance(previous[a], p) / .25f)); frames[a]++;
            row["distance_m"] = (float)row["distance_m"] + Vector3.Distance(previous[a], p);
            for (int i = 1; i <= steps; i++)
            {
                var q = Vector3.Lerp(previous[a], p, i / (float)steps); var result = Sample(q);
                row["sample_count"] = (int)row["sample_count"] + 1;
                bool fail = !(bool)result["supported"] || ((JArray)result["static_obstacles"]).Count > 0;
                if (!(bool)result["supported"]) row["support_failures"] = (int)row["support_failures"] + 1;
                if (((JArray)result["static_obstacles"]).Count > 0) row["obstacle_samples"] = (int)row["obstacle_samples"] + 1;
                if (fail && ((JArray)row["first_failures"]).Count < 12) ((JArray)row["first_failures"]).Add(new JObject { ["point"] = V(q), ["physics"] = result });
            }
            previous[a] = p;
            if (actor.Completed || actor.Error != null)
            {
                row["status"] = actor.Error == null && (int)row["support_failures"] == 0 && (int)row["obstacle_samples"] == 0 ? "PASS" : "FAIL";
                row["arrival_count"] = actor.ArrivalCount; row["frames"] = frames[a]; row["error"] = actor.Error;
                row["final_position"] = V(p); row["length_m"] = actor.Length; row["reached_waypoints"] = actor.ReachedWaypoints;
            }
        }
        bool timeout = EditorApplication.timeSinceStartup - began > 180;
        if (timeout || actorResults.All(r => (string)r["status"] != "RUNNING"))
        {
            foreach (var r in actorResults.Where(r => (string)r["status"] == "RUNNING")) r["status"] = "TIMEOUT";
            Write("runtime", new JObject { ["scope"] = "Actual Unity Editor Play Mode, retained TestNpcPatrol/graph adapter/grounding; timeScale20, no teleport between waypoints",
                ["time_scale"] = Time.timeScale, ["wall_seconds"] = EditorApplication.timeSinceStartup - began, ["routes"] = new JArray(actorResults), ["runtime_errors"] = runtimeErrors,
                ["camera_visuals"] = "NOT TESTED: nographics batch; no claim of visibility or target-device performance" });
            Application.logMessageReceived -= OnLog; Time.timeScale = 1;
            SessionState.SetBool(Finishing, true); EditorApplication.isPlaying = false;
        }
    }
    public static void Build()
    {
        Directory.CreateDirectory(Out);
        string path = Path.GetFullPath("Builds/phase1_qa_local_" + DateTime.UtcNow.ToString("yyyyMMdd_HHmmss"));
        Environment.SetEnvironmentVariable("SIMUS_V002_WEBGL_OUTPUT", path);
        Write("build-request", new JObject { ["output"] = path, ["source_scene_sha256"] = Sha(CityRebuildV002Setup.ScenePath), ["deployment"] = "NOT REQUESTED" });
        CityRebuildV002WebGLBuild.BuildSession();
        Write("build-result", new JObject { ["status"] = "PASS", ["output"] = path, ["manifest"] = JObject.Parse(File.ReadAllText(Path.Combine(path, "build.json"))), ["source_scene_sha256_after"] = Sha(CityRebuildV002Setup.ScenePath), ["deployment"] = "NOT RUN" });
    }
    [PostProcessScene(1000)]
    public static void InspectBuildScene()
    {
        if (!BuildPipeline.isBuildingPlayer || Environment.GetEnvironmentVariable("SIMUS_V002_WEBGL_OUTPUT") == null) return;
        var roles = All<CityV002NpcBuildRole>().ToArray();
        var names = new[] { "NPC_SIMUS_CityCitizen_1", "NPC_SIMUS_CityCitizen_2", "NPC_HeavyCarrier_ApartmentWalk", "NPC_CryingChild_ParkSouth", "NPC_Police_Gate", "NPC_Criminal_PlazaEdge", "CAT_Tuxedo_EastPark" };
        var objects = All<Transform>().ToArray();
        Write("build-scene", new JObject { ["scope"] = "Actual BuildPipeline postprocess scene inspection", ["scene"] = UnityEngine.SceneManagement.SceneManager.GetActiveScene().path,
            ["test_probe_count"] = roles.Count(r => r.role == CityV002NpcBuildRole.Role.TestProbe),
            ["participant_template_count"] = roles.Count(r => r.role == CityV002NpcBuildRole.Role.ParticipantTemplate),
            ["objects"] = new JArray(names.Select(name => { var t = objects.SingleOrDefault(x => x.name == name); return new JObject { ["name"] = name, ["found"] = t != null,
                ["active"] = t != null && t.gameObject.activeInHierarchy, ["patrol"] = t != null && t.GetComponent<TestNpcPatrol>() != null,
                ["animators"] = t == null ? 0 : t.GetComponentsInChildren<Animator>(true).Length }; })) });
    }
}
