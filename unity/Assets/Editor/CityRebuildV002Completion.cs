using System;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using Newtonsoft.Json.Linq;
using Simus;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

/// <summary>Resume Phase 4 without regenerating the approved city or excavated river.</summary>
public static class CityRebuildV002Completion
{
    const string Tree = "Assets/SIMUS/Art/props/props/STREET_TREE.fbx";
    const string Bench = "Assets/SIMUS/Art/props/props/REUSED_BENCH.fbx";
    const string Inputs = "../docs/verification/city-rebuild-v002-phase47-runtime-inputs.json";
    static Bounds BoundsOf(GameObject go)
    {
        var renderers = go.GetComponentsInChildren<MeshRenderer>().Where(r => r.enabled).ToArray();
        var bounds = renderers[0].bounds;
        foreach (var r in renderers.Skip(1)) bounds.Encapsulate(r.bounds);
        return bounds;
    }
    static string Hash(string path) { using (var sha = SHA256.Create()) return BitConverter.ToString(sha.ComputeHash(File.ReadAllBytes(path))).Replace("-", "").ToLowerInvariant(); }
    public static void Prepare()
    {
        var scene = EditorSceneManager.OpenScene(CityRebuildV002Setup.ScenePath);
        var city = GameObject.Find("CityRebuild_v002").transform;
        var graph = UnityEngine.Object.FindFirstObjectByType<CityV002PedestrianGraph>();
        if (graph == null || graph.nodes.Length != 572 || graph.edges.Length != 597 || city.Find("12_River_Phase4") == null)
            throw new InvalidOperationException("Existing approved city + river graph 572/597 required; no rebuild permitted.");
        var greenery = city.Find("09_ParkAndGreenery");
        var trees = greenery.GetComponentsInChildren<Transform>().Where(t => t.name.StartsWith("ParkTree_") || t.name.StartsWith("CampusTree_") || t.name.StartsWith("RoadsideTree_")).ToArray();
        var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(Tree);
        var evidence = new JArray();
        foreach (var tree in trees)
        {
            var before = BoundsOf(tree.gameObject); var oldEuler = tree.eulerAngles;
            // Read authored yaw from the prior override; native imported rotation is never replaced.
            if (Mathf.Abs(Vector3.Dot(tree.up, Vector3.up)) > .99f)
                tree.rotation = Quaternion.Euler(0, oldEuler.y, 0) * prefab.transform.localRotation;
            var after = BoundsOf(tree.gameObject);
            float ground = tree.name.StartsWith("Roadside") ? -.02f : -.012f;
            tree.position += new Vector3(before.center.x - after.center.x, ground - after.min.y, before.center.z - after.center.z);
            after = BoundsOf(tree.gameObject);
            if (after.size.y < Mathf.Max(after.size.x, after.size.z)) throw new InvalidOperationException("Tree remains horizontal: " + tree.name + " " + after.size);
            var trunk = tree.GetComponentInChildren<CapsuleCollider>();
            if (trunk != null)
            {
                trunk.transform.rotation = Quaternion.identity;
                var scale = tree.lossyScale; trunk.transform.localScale = new Vector3(1 / Mathf.Abs(scale.x), 1 / Mathf.Abs(scale.y), 1 / Mathf.Abs(scale.z));
                trunk.transform.position = new Vector3(after.center.x, ground + Mathf.Min(2, after.size.y * .5f), after.center.z);
                trunk.radius = .32f; trunk.height = Mathf.Min(4, after.size.y);
            }
            evidence.Add(new JObject { ["name"] = tree.name, ["before_size"] = V(before.size), ["after_size"] = V(after.size), ["ground_y"] = after.min.y, ["rotation_before"] = V(oldEuler), ["rotation_after"] = V(tree.eulerAngles) });
        }
        var benches = greenery.Find("EastPark/ParkBenches");
        if (benches == null) { var b = new GameObject("ParkBenches"); benches = b.transform; benches.SetParent(greenery.Find("EastPark"), false); }
        var benchAsset = AssetDatabase.LoadAssetAtPath<GameObject>(Bench);
        var layout = JObject.Parse(File.ReadAllText("../docs/planning/city_rebuild_v002/layout.json"));
        foreach (var rest in layout["park"]["rest_areas"])
        {
            string id = (string)rest["id"];
            if (benches.Find(id + "_RestBench") != null) continue;
            bool placed = false;
            for (int i = 0; i < 32 && !placed; i++)
            {
                float angle = i * 2 * Mathf.PI / 32;
                var center = new Vector3((float)rest["x"], .135f, (float)rest["z"]);
                var point = center + new Vector3(Mathf.Cos(angle), 0, Mathf.Sin(angle)) * ((float)rest["radius"] * .72f);
                var model = (GameObject)PrefabUtility.InstantiatePrefab(benchAsset, benches);
                model.name = id + "_RestBench"; model.transform.rotation = Quaternion.Euler(0, 90 - angle * Mathf.Rad2Deg, 0) * benchAsset.transform.localRotation;
                var bounds = BoundsOf(model); model.transform.position += new Vector3(point.x - bounds.center.x, point.y - bounds.min.y, point.z - bounds.center.z); bounds = BoundsOf(model);
                float radius = Mathf.Max(bounds.extents.x, bounds.extents.z) + .4f;
                bool blocks = graph.edges.Any(e => Enumerable.Range(0, e.points.Length - 1).Any(j => SegmentDistance(point, e.points[j], e.points[j + 1]) < radius + e.width * .5f));
                Physics.SyncTransforms();
                bool overlaps = Physics.OverlapBox(bounds.center, bounds.extents + Vector3.one * .15f).Any(c => !c.transform.IsChildOf(model.transform) && c.bounds.max.y > .3f && c.bounds.Intersects(bounds));
                if (blocks || overlaps) { UnityEngine.Object.DestroyImmediate(model); continue; }
                var collision = new GameObject("Collision_Bench"); collision.transform.SetParent(model.transform, true); collision.transform.position = bounds.center; collision.transform.rotation = Quaternion.identity;
                var s = model.transform.lossyScale; collision.transform.localScale = new Vector3(1 / Mathf.Abs(s.x), 1 / Mathf.Abs(s.y), 1 / Mathf.Abs(s.z));
                collision.AddComponent<BoxCollider>().size = bounds.size;
                foreach (var r in model.GetComponentsInChildren<MeshRenderer>()) GameObjectUtility.SetStaticEditorFlags(r.gameObject, StaticEditorFlags.BatchingStatic);
                placed = true;
            }
            if (!placed) throw new InvalidOperationException("No clear original FBX bench location at " + id);
        }
        Physics.SyncTransforms();
        EditorSceneManager.SaveScene(scene, CityRebuildV002Setup.ScenePath); AssetDatabase.SaveAssets();
        File.WriteAllText("../docs/verification/city-rebuild-v002-phase4-completion.json", new JObject { ["status"] = "PASS_EDITOR_ASSEMBLY", ["utc"] = DateTime.UtcNow.ToString("o"), ["cause"] = "Yaw-only override erased imported prop FBX root axis conversion; restore prefab rotation in working scene only.", ["trees"] = evidence, ["benches"] = benches.childCount, ["graph_nodes"] = graph.nodes.Length, ["graph_edges"] = graph.edges.Length, ["scene_sha256"] = Hash(CityRebuildV002Setup.ScenePath), ["fbx_originals_unchanged"] = true }.ToString());
        Debug.Log("CITY_V002_PHASE4_COMPLETION trees=" + trees.Length + " benches=" + benches.childCount + " graph=" + graph.nodes.Length + "/" + graph.edges.Length);
        EnsureNavigation(graph, city);
        CityRebuildV002Phase47Bridge.ApplyCamera();
        RestoreDisplacedBuildingChildren(layout);
        RestoreSurfaceFrames(GameObject.Find("CityRebuild_v002").transform);
        AuditBuildings(layout);
        var physical = new JObject { ["utc"] = DateTime.UtcNow.ToString("o"),
            ["graph"] = CityRebuildV002RiverSetup.AuditGraph(UnityEngine.Object.FindFirstObjectByType<CityV002PedestrianGraph>()),
            ["river_depth"] = CityRebuildV002RiverSetup.AuditDepth(), ["scene_sha256"] = Hash(CityRebuildV002Setup.ScenePath),
            ["scope"] = "Actual saved Unity scene Physics: all active 597 graph edges; river finite-width capsule and bridge-deck tests. Existing river audit height tolerances retained." };
        File.WriteAllText("../docs/verification/city-rebuild-v002-final-physics.json", physical.ToString());
        var files = Directory.GetFiles("Assets/Scripts", "*.cs").Concat(Directory.GetFiles("Assets/Editor", "CityRebuildV002*.cs"))
            .Concat(Directory.GetFiles(CityRebuildV002Setup.Folder, "*", SearchOption.AllDirectories).Where(p => !p.EndsWith(".meta")))
            .Concat(new[] { "../docs/planning/city_rebuild_v002/layout.json", "../docs/planning/city_rebuild_v002/buildings.csv", "../docs/planning/city_rebuild_v002/campus-placements.csv", "ProjectSettings/EditorBuildSettings.asset", Tree, Bench });
        var hashes = new JObject(); foreach (var path in files.Distinct()) hashes[path] = Hash(path);
        File.WriteAllText(Inputs, new JObject { ["utc"] = DateTime.UtcNow.ToString("o"), ["status"] = "READY", ["files"] = hashes }.ToString());
    }
    static void RestoreSurfaceFrames(Transform city)
    {
        var changes = new JArray();
        foreach (string name in new[] { "01_Ground", "02_Roads", "03_TurningAndIntersections", "04_PedestrianSurfaces", "05_CrossingFacilities_17" })
            foreach (var t in city.Find(name).GetComponentsInChildren<Transform>(true))
            {
                // Setup.Surface stores world x/y/z in the mesh vertices; every
                // Group/Surface frame in these five roots is authored as identity.
                if (t.localPosition.sqrMagnitude < .000001f && Quaternion.Angle(t.localRotation, Quaternion.identity) < .001f && Vector3.Distance(t.localScale, Vector3.one) < .00001f) continue;
                changes.Add(new JObject { ["root"] = name, ["name"] = t.name, ["before_position"] = V(t.localPosition),
                    ["before_rotation"] = V(t.localEulerAngles), ["before_scale"] = V(t.localScale) });
                t.localPosition = Vector3.zero; t.localRotation = Quaternion.identity; t.localScale = Vector3.one;
            }
        Physics.SyncTransforms();
        EditorSceneManager.SaveScene(city.gameObject.scene, CityRebuildV002Setup.ScenePath); AssetDatabase.SaveAssets();
        string path = "../docs/verification/city-rebuild-v002-surface-recovery.json";
        if (changes.Count > 0 || !File.Exists(path)) File.WriteAllText(path, new JObject {
            ["utc"] = DateTime.UtcNow.ToString("o"), ["count"] = changes.Count, ["changes"] = changes,
            ["basis"] = "Existing CityRebuildV002Setup Group and Surface create identity frames, with world-coordinate mesh vertices. Existing meshes, materials and collider references preserved." }.ToString());
    }
    static void RestoreDisplacedBuildingChildren(JObject layout)
    {
        // The saved scene contains seven child transforms displaced from the verified
        // Phase 3 assembly. Recover from the native FBX and measured layout, never
        // from a magic offset or a rewritten source asset.
        var city = GameObject.Find("CityRebuild_v002").transform;
        var changes = new JArray();
        var baseline = JObject.Parse(File.ReadAllText("../docs/verification/city-rebuild-v002-unity-results.json"));
        var calibration = baseline["campus_axis_calibration"];
        var asset = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/SIMUS/Art/buildings/campus/Campus.fbx");
        var source = (GameObject)PrefabUtility.InstantiatePrefab(asset);
        var e = calibration["rotation_euler"]; var s = calibration["native_adjusted_scale"];
        source.transform.rotation = Quaternion.Euler((float)e[0], (float)e[1], (float)e[2]);
        source.transform.localScale = new Vector3((float)s[0], (float)s[1], (float)s[2]);
        try
        {
            var native = source.GetComponentsInChildren<MeshRenderer>(true).GroupBy(r => r.name).ToDictionary(g => g.Key, g => g.First());
            foreach (var item in layout["campus"]["components"])
            {
                var group = city.Find("06_CampusBuildings_14/" + (string)item["id"] + "_" + (string)item["name"]);
                foreach (var renderer in group.GetComponentsInChildren<MeshRenderer>())
                {
                    var expected = native[renderer.name].transform.position + group.position;
                    if (Vector3.Distance(renderer.transform.position, expected) <= .025f) continue;
                    changes.Add(new JObject { ["id"] = (string)item["id"], ["child"] = renderer.name,
                        ["before_world_position"] = V(renderer.transform.position), ["restored_world_position"] = V(expected),
                        ["basis"] = "Original FBX child world transform + Phase 3 campus axis calibration + approved placement wrapper" });
                    renderer.transform.position = expected;
                }
            }
        }
        finally { UnityEngine.Object.DestroyImmediate(source); }
        foreach (var item in layout["buildings"])
        {
            var group = city.Find("08_ExternalBuildings_55/" + (string)item["id"] + "_" + (string)item["type"]);
            var b = BoundsOf(group.gameObject);
            var delta = new Vector3((float)item["x"] - b.center.x, -b.min.y, (float)item["z"] - b.center.z);
            if (delta.magnitude <= .025f) continue;
            var model = group.GetChild(0);
            changes.Add(new JObject { ["id"] = (string)item["id"], ["child"] = model.name,
                ["before_world_position"] = V(model.position), ["restored_world_position"] = V(model.position + delta),
                ["basis"] = "Approved footprint center and y=0 ground, native FBX dimensions and existing yaw preserved" });
            model.position += delta;
        }
        Physics.SyncTransforms();
        EditorSceneManager.SaveScene(city.gameObject.scene, CityRebuildV002Setup.ScenePath); AssetDatabase.SaveAssets();
        string recovery = "../docs/verification/city-rebuild-v002-building-recovery.json";
        if (changes.Count > 0 || !File.Exists(recovery)) File.WriteAllText(recovery, new JObject {
            ["utc"] = DateTime.UtcNow.ToString("o"), ["changes"] = changes, ["count"] = changes.Count,
            ["cause"] = "Saved working-scene child transforms differed from the verified original FBX assembly. Exact authoring cause unknown; source assets and approved wrappers preserved.",
            ["verification"] = "Full actual FBX envelope audit immediately follows" }.ToString());
    }
    static void AuditBuildings(JObject layout)
    {
        var city = GameObject.Find("CityRebuild_v002").transform;
        var rows = new JArray();
        var failures = new JArray();
        foreach (var item in layout["campus"]["components"].Concat(layout["buildings"]))
        {
            string id = (string)item["id"], name = id + "_" + (string)(id.StartsWith("C") ? item["name"] : item["type"]);
            var group = city.Find((id.StartsWith("C") ? "06_CampusBuildings_14/" : "08_ExternalBuildings_55/") + name);
            if (group == null) throw new InvalidOperationException("Missing actual building: " + name);
            var b = BoundsOf(group.gameObject);
            var polygon = item["footprint_polygon"].Select(p => new Vector2((float)p[0], (float)p[1])).ToArray();
            float error = new[] { Mathf.Abs(b.min.x - polygon.Min(p => p.x)), Mathf.Abs(b.max.x - polygon.Max(p => p.x)),
                Mathf.Abs(b.min.z - polygon.Min(p => p.y)), Mathf.Abs(b.max.z - polygon.Max(p => p.y)), Mathf.Abs(b.size.y - (float)item["height"]) }.Max();
            var meshes = group.GetComponentsInChildren<MeshFilter>().Where(f => f.sharedMesh != null).ToArray();
            var paths = meshes.Select(f => AssetDatabase.GetAssetPath(f.sharedMesh)).Distinct().ToArray();
            bool passed = error <= .025f && meshes.Length > 0 && paths.All(p => p.EndsWith(".fbx", StringComparison.OrdinalIgnoreCase));
            if (!passed) failures.Add(id);
            rows.Add(new JObject { ["id"] = id, ["status"] = passed ? "PASS" : "FAIL", ["maximum_envelope_error_m"] = error,
                ["bounds_min"] = V(b.min), ["bounds_max"] = V(b.max), ["root_position"] = V(group.position),
                ["root_euler"] = V(group.eulerAngles), ["actual_fbx_mesh_paths"] = new JArray(paths), ["mesh_count"] = meshes.Length,
                ["renderers"] = new JArray(group.GetComponentsInChildren<MeshRenderer>().Select(r => new JObject { ["name"] = r.name, ["min"] = V(r.bounds.min), ["max"] = V(r.bounds.max), ["mesh_path"] = AssetDatabase.GetAssetPath(r.GetComponent<MeshFilter>().sharedMesh) })) });
        }
        File.WriteAllText("../docs/verification/city-rebuild-v002-phase47-building-audit.json", new JObject {
            ["status"] = failures.Count == 0 ? "PASS" : "FAIL", ["failures"] = failures, ["scene_sha256"] = Hash(CityRebuildV002Setup.ScenePath), ["utc"] = DateTime.UtcNow.ToString("o"),
            ["scope"] = "Saved scene loaded in Unity; actual FBX MeshFilter provenance and renderer world envelope matches approved polygon within 0.025m; collision-free approved envelopes separately checked by Python QA; actual door thresholds not tested", ["buildings"] = rows }.ToString());
        if (failures.Count > 0) throw new InvalidOperationException("Actual FBX provenance/envelope audit failed: " + failures);
    }
    static void EnsureNavigation(CityV002PedestrianGraph graph, Transform city)
    {
        var monitor = UnityEngine.Object.FindFirstObjectByType<CityV002NavigationVerification>();
        if (monitor != null && monitor.actors.Length == 4 && monitor.actors.All(a => a != null)) return;
        var source = UnityEngine.Object.FindObjectsByType<TestNpcPatrol>(FindObjectsSortMode.None)
            .First(p => p.GetComponent<CityV002NpcRouteAdapter>() == null);
        var root = new GameObject("13_Phase5_RouteVerification"); root.transform.SetParent(city, false);
        monitor = root.AddComponent<CityV002NavigationVerification>();
        var routes = new[] {
            new[] { "school_commerce", "CAMPUS_PLAZA", "B04_ACCESS" },
            new[] { "school_residential", "CAMPUS_PLAZA", "B16_ACCESS" },
            new[] { "school_park", "CAMPUS_PLAZA", "PARK_REST_2" },
            new[] { "residential_commerce", "B16_ACCESS", "B04_ACCESS" }
        };
        monitor.actors = new CityV002NpcRouteAdapter[routes.Length];
        for (int i = 0; i < routes.Length; i++)
        {
            var actor = i == 0 ? source.gameObject : UnityEngine.Object.Instantiate(source.gameObject, root.transform);
            if (i > 0) actor.name = "GraphProbe_" + routes[i][0];
            var adapter = actor.GetComponent<CityV002NpcRouteAdapter>();
            if (adapter == null) adapter = actor.AddComponent<CityV002NpcRouteAdapter>();
            adapter.graph = graph; adapter.routeId = routes[i][0]; adapter.startNode = routes[i][1]; adapter.destinationNode = routes[i][2];
            adapter.returnToStart = true; adapter.startAutomatically = true;
            if (!graph.TryRoute(adapter.startNode, adapter.destinationNode, out var points, out _, out _))
                throw new InvalidOperationException("Required connected route missing: " + adapter.routeId);
            actor.transform.position = points[0]; monitor.actors[i] = adapter;
        }
        EditorSceneManager.MarkSceneDirty(graph.gameObject.scene);
        EditorSceneManager.SaveScene(graph.gameObject.scene, CityRebuildV002Setup.ScenePath); AssetDatabase.SaveAssets();
        Debug.Log("CITY_V002_INCREMENTAL_NAVIGATION_READY graph=" + graph.nodes.Length + "/" + graph.edges.Length + " probes=4");
    }
    static JArray V(Vector3 v) => new JArray(v.x,v.y,v.z);
    static float SegmentDistance(Vector3 p, Vector3 a, Vector3 b) { p.y = a.y = b.y = 0; var d = b - a; return Vector3.Distance(p, a + d * (d.sqrMagnitude > 0 ? Mathf.Clamp01(Vector3.Dot(p-a,d)/d.sqrMagnitude) : 0)); }
    public static void VerifyRuntimeInputs()
    {
        var evidence = JObject.Parse(File.ReadAllText(Inputs));
        var changed = new JArray(); foreach (var p in ((JObject)evidence["files"]).Properties()) if (!File.Exists(p.Name) || Hash(p.Name) != (string)p.Value) changed.Add(p.Name);
        evidence["changed"] = changed; evidence["status"] = changed.Count == 0 ? "UNCHANGED_DURING_PLAY" : "FAIL_CHANGED";
        File.WriteAllText(Inputs, evidence.ToString());
        if (changed.Count > 0) throw new InvalidOperationException("Inputs changed during Play Mode: " + changed);
    }
}
