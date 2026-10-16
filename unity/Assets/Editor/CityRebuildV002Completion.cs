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
        CityRebuildV002Phase47Bridge.ApplyCamera();
        var files = Directory.GetFiles("Assets/Scripts", "*.cs").Concat(Directory.GetFiles("Assets/Editor", "CityRebuildV002*.cs"))
            .Concat(Directory.GetFiles(CityRebuildV002Setup.Folder, "*", SearchOption.AllDirectories).Where(p => !p.EndsWith(".meta")))
            .Concat(new[] { "../docs/planning/city_rebuild_v002/layout.json", "../docs/planning/city_rebuild_v002/buildings.csv", "../docs/planning/city_rebuild_v002/campus-placements.csv", "ProjectSettings/EditorBuildSettings.asset", Tree, Bench });
        var hashes = new JObject(); foreach (var path in files.Distinct()) hashes[path] = Hash(path);
        File.WriteAllText(Inputs, new JObject { ["utc"] = DateTime.UtcNow.ToString("o"), ["status"] = "READY", ["files"] = hashes }.ToString());
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
