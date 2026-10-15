using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using Newtonsoft.Json.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;

/// <summary>Incremental phase 4 edits of the approved, existing v002 scene only.</summary>
public static class CityRebuildV002Phase4Setup
{
    const string Folder = CityRebuildV002Setup.Folder;
    const string Source = "../docs/planning/city_rebuild_v002/layout.json";
    const string Output = "../docs/verification/city-rebuild-v002-phase4-results.json";
    const string TreePath = "Assets/SIMUS/Art/props/props/STREET_TREE.fbx";
    const string BenchPath = "Assets/SIMUS/Art/props/props/REUSED_BENCH.fbx";
    static JObject layout;
    static readonly List<Bounds> occupied = new List<Bounds>();
    static readonly List<Bounds> sportBounds = new List<Bounds>();
    static int treeCount, benchCount;

    [MenuItem("SIMUS/City Rebuild v002/Apply Phase 4 Park and Greenery")]
    public static void Apply()
    {
        if (EditorApplication.isPlaying) throw new InvalidOperationException("Stop Play Mode before editing phase 4.");
        if (!Application.isBatchMode && !EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;
        var protectedFiles = new[] { Source, "../docs/planning/city_rebuild_v002/buildings.csv", "../docs/planning/city_rebuild_v002/campus-placements.csv", CompletedMapFollowSetup.ScenePath, "ProjectSettings/EditorBuildSettings.asset" };
        var hashes = protectedFiles.ToDictionary(p => p, Hash);
        layout = JObject.Parse(File.ReadAllText(Source));
        if ((string)layout["metadata"]["design_id"] != "city_rebuild_v002" || layout["pedestrian_nodes"].Count() != 388 || layout["pedestrian_edges"].Count() != 409)
            throw new InvalidOperationException("Approved v002 graph contract does not match.");
        var scene = EditorSceneManager.OpenScene(CityRebuildV002Setup.ScenePath);
        var city = scene.GetRootGameObjects().Single(g => g.name == "CityRebuild_v002");
        var buildingsBefore = BuildingSnapshot(city.transform);
        sportBounds.Clear();
        foreach (var r in city.transform.Find("07_CampusFacilities").GetComponentsInChildren<MeshRenderer>())
            if (r.name.IndexOf("court", StringComparison.OrdinalIgnoreCase) >= 0 || r.name.IndexOf("Sports_field", StringComparison.OrdinalIgnoreCase) >= 0)
                sportBounds.Add(r.bounds);
        Directory.CreateDirectory(Folder + "/phase4_meshes");
        Directory.CreateDirectory(Folder + "/phase4_materials");
        AssetDatabase.Refresh();
        var existing = city.transform.Find("09_ParkAndGreenery");
        if (existing != null) UnityEngine.Object.DestroyImmediate(existing.gameObject);
        var root = Group("09_ParkAndGreenery", city.transform);
        var parkRoot = Group("EastPark", root);
        var trailMat = Material("park_compacted_gravel", new Color(.46f, .36f, .23f));
        var sidewalkMat = Material("sidewalk_warm_stone", new Color(.53f, .52f, .46f));
        var campusMat = Material("campus_sandstone", new Color(.64f, .59f, .48f));
        var parkMat = Material("park_lawn", new Color(.32f, .43f, .25f));
        var walks = city.transform.Find("04_PedestrianSurfaces");
        int physicalWalks = 0;
        foreach (var renderer in walks.GetComponentsInChildren<MeshRenderer>(true))
        {
            if (renderer.GetComponent<MeshFilter>() == null || renderer.GetComponent<MeshCollider>() == null)
                throw new InvalidOperationException("Unexpected nonphysical pedestrian surface: " + renderer.name);
            string kind = renderer.transform.parent.name;
            renderer.sharedMaterial = kind == "park_trail" ? trailMat : kind == "campus_walk" ? campusMat : sidewalkMat;
            physicalWalks++;
        }
        Surface("EastPark_Lawn", parkRoot, Points(layout["park"]["polygon"]), -.012f, parkMat);
        var rests = Group("RestAreas", parkRoot);
        foreach (var rest in layout["park"]["rest_areas"])
            Surface((string)rest["id"] + "_GravelRestArea", rests, Circle(new Vector2((float)rest["x"], (float)rest["z"]), (float)rest["radius"]), .135f, trailMat);
        // Existing graph-derived strips retain their exact centreline, width and collider.
        // Slightly lower circular gravel joins soften trail bends without changing navigation.
        var joints = Group("TrailRoundedJoins", parkRoot);
        var parkNodes = new Dictionary<string, float>();
        foreach (var edge in layout["pedestrian_edges"].Where(e => (string)e["kind"] == "park_trail"))
        {
            parkNodes[(string)edge["from"]] = (float)edge["width"] * .5f;
            parkNodes[(string)edge["to"]] = (float)edge["width"] * .5f;
        }
        foreach (var n in layout["pedestrian_nodes"].Where(n => parkNodes.ContainsKey((string)n["id"])))
        {
            var p = new Vector2((float)n["x"], (float)n["z"]);
            if (InPolygon(p, Points(layout["park"]["polygon"])) && ClearOfRoadsAndBuildings(p, parkNodes[(string)n["id"]]))
                Surface((string)n["id"] + "_RoundedGravelJoin", joints, Circle(p, parkNodes[(string)n["id"]]), .139f, trailMat);
        }
        var modules = new JArray();
        occupied.Clear(); treeCount = benchCount = 0;
        foreach (var spec in layout["park"]["reuse_modules"])
            modules.Add(PlaceModule(spec, Group((string)spec["id"], parkRoot)));
        // Reserve seats before optional trees. Some module corners already contain
        // original foliage; probe both the gravel area and its adjoining lawn.
        var benches = Group("ParkBenches", parkRoot);
        foreach (var rest in layout["park"]["rest_areas"])
        {
            var p = new Vector2((float)rest["x"], (float)rest["z"]); float radius = (float)rest["radius"];
            int beforeBench = benchCount;
            foreach (float ring in new[] { radius * .72f, radius + 3 })
                for (int i = 0; i < 16 && benchCount - beforeBench < 2; i++)
                {
                    float angle = i * 2 * Mathf.PI / 16;
                    var offset = new Vector2(Mathf.Cos(angle), Mathf.Sin(angle)) * ring;
                    TryProp(BenchPath, "RestBench_" + benchCount, benches, p + offset, 90 - i * 360f / 16, ring < radius ? .135f : -.012f, false);
                }
        }
        if (benchCount < 2) throw new InvalidOperationException("Required actual FBX benches could not be placed with pedestrian clearance.");
        var trees = Group("Trees", parkRoot);
        var parkPolygon = Points(layout["park"]["polygon"]);
        for (float z = -25; z < 167; z += 17)
            for (float x = 98; x < 176; x += 17)
            {
                var p = new Vector2(x + Mathf.Sin(z * .11f) * 2, z + Mathf.Sin(x * .09f) * 2);
                if (treeCount < 32 && InPolygon(p, parkPolygon) && DistanceToBoundary(p, parkPolygon) > 4)
                    TryProp(TreePath, "ParkTree_" + treeCount, trees, p, (treeCount * 137) % 360, -.012f, true);
            }
        int parkTrees = treeCount;
        var urban = Group("CityGreenery", root);
        var schoolPolygon = Points(layout["districts"].First(d => (string)d["id"] == "school")["polygon"]);
        for (float z = -32; z < 163; z += 24)
            for (float x = -66; x < 75; x += 26)
            {
                var p = new Vector2(x, z);
                if (treeCount - parkTrees < 16 && InPolygon(p, schoolPolygon))
                    TryProp(TreePath, "CampusTree_" + (treeCount - parkTrees), urban, p, (treeCount * 137) % 360, -.012f, true);
            }
        int campusTrees = treeCount - parkTrees;
        foreach (var road in layout["roads"])
        {
            var points = Points(road["points"]);
            for (int i = 0; i < points.Count - 1; i++)
            {
                var a = points[i]; var d = points[i + 1] - a; var n = new Vector2(-d.y, d.x).normalized;
                for (float s = 17; s < d.magnitude - 12; s += 38)
                {
                    if (treeCount - parkTrees - campusTrees >= 12) break;
                    var p = a + d.normalized * s + n * ((float)road["carriageway_width"] * .5f + 11);
                    TryProp(TreePath, "RoadsideTree_" + (treeCount - parkTrees - campusTrees), urban, p, (treeCount * 137) % 360, -.02f, true);
                }
            }
        }
        var triangleAudit = FixLargeTriangles(city);
        Physics.SyncTransforms();
        var props = root.GetComponentsInChildren<Collider>(false).Where(c => c.transform.GetComponent<MeshRenderer>() != null || c.name.StartsWith("Collision")).ToArray();
        int obstacleHits = 0;
        foreach (var edge in layout["pedestrian_edges"])
        {
            var pts = Points(edge["points"]);
            for (int i = 0; i < pts.Count - 1; i++)
                for (float s = 0; s <= Vector2.Distance(pts[i], pts[i + 1]); s += .5f)
                {
                    var p = Vector2.MoveTowards(pts[i], pts[i + 1], s);
                    foreach (var prop in props)
                        if (prop.bounds.max.y > .3f && prop.bounds.Contains(new Vector3(p.x, Mathf.Clamp(.8f, prop.bounds.min.y, prop.bounds.max.y), p.y))) obstacleHits++;
                }
        }
        if (obstacleHits > 0) throw new InvalidOperationException("Phase 4 decoration overlaps graph centreline: " + obstacleHits);
        if (!JToken.DeepEquals(buildingsBefore, BuildingSnapshot(city.transform))) throw new InvalidOperationException("Building placement changed during phase 4.");
        foreach (var item in hashes) if (Hash(item.Key) != item.Value) throw new InvalidOperationException("Protected file changed: " + item.Key);
        EditorSceneManager.MarkSceneDirty(scene);
        EditorSceneManager.SaveScene(scene, CityRebuildV002Setup.ScenePath);
        AssetDatabase.SaveAssets();
        var evidence = new JObject { ["unity_version"] = Application.unityVersion, ["scene"] = CityRebuildV002Setup.ScenePath, ["layout_sha256"] = Hash(Source), ["status"] = "PASS: incremental editor assembly completed; Play Mode is tested separately", ["physical_walk_meshes"] = physicalWalks, ["white_paths"] = "Real serialized MeshFilter/MeshRenderer/MeshCollider pedestrian surfaces, not graph visualization", ["graph_nodes"] = 388, ["graph_edges"] = 409, ["park_modules"] = modules, ["park_trees"] = parkTrees, ["campus_trees"] = campusTrees, ["roadside_trees"] = treeCount - parkTrees - campusTrees, ["additional_benches"] = benchCount, ["decoration_graph_centreline_collisions"] = obstacleHits, ["large_triangle_audit"] = triangleAudit, ["protected_files"] = new JObject(hashes.Select(h => new JProperty(h.Key, h.Value))), ["building_placements"] = "PASS: 14 campus and 55 external transform snapshots unchanged", ["play_mode"] = "NOT TESTED by phase 4 assembly; see phase 5–7 runtime evidence" };
        if (File.Exists(Output))
        {
            var previous = JObject.Parse(File.ReadAllText(Output));
            evidence["initial_triangle_audit"] = (previous["initial_triangle_audit"] ?? previous["large_triangle_audit"])?.DeepClone();
        }
        Directory.CreateDirectory(Path.GetDirectoryName(Output)); File.WriteAllText(Output, evidence.ToString());
        Debug.Log("CITY_REBUILD_V002_PHASE4_READY parkModules=" + modules.Count + " trees=" + treeCount + " benches=" + benchCount + " maxColliderEdge=" + triangleAudit["max_world_edge_after"]);
    }

    static JObject PlaceModule(JToken spec, Transform wrapper)
    {
        string path = ((string)spec["asset"]).Substring(6);
        var asset = AssetDatabase.LoadAssetAtPath<GameObject>(path);
        if (asset == null) throw new InvalidOperationException("Missing actual park FBX: " + path);
        var model = (GameObject)PrefabUtility.InstantiatePrefab(asset, wrapper);
        wrapper.position = new Vector3((float)spec["x"], -.012f, (float)spec["z"]);
        wrapper.rotation = Quaternion.Euler(0, (float)spec["yaw"] + 180, 0);
        var b = Bounds(model); model.transform.position += new Vector3(wrapper.position.x - b.center.x, wrapper.position.y - b.min.y, wrapper.position.z - b.center.z);
        b = Bounds(model);
        if (Mathf.Abs(b.size.x - (float)spec["width"]) > .02f || Mathf.Abs(b.size.z - (float)spec["depth"]) > .02f)
            throw new InvalidOperationException("Park FBX import is not approved 12m module: " + path + " bounds=" + b);
        int excluded = 0, retained = 0;
        var omitted = new JArray();
        foreach (var r in model.GetComponentsInChildren<MeshRenderer>(true).ToArray())
        {
            // Supplied park FBXs are single combined meshes; extract connected geometry in
            // Unity while retaining exact FBX vertices/materials and the original prefab reference.
            var parts = ConnectedParts(r, (string)spec["id"]);
            r.enabled = false;
            foreach (var originalCollider in r.GetComponents<Collider>()) UnityEngine.Object.DestroyImmediate(originalCollider);
            foreach (var part in parts)
            {
            // Ground/deck is retained below the walk top; tall meshes must leave the whole walk width clear.
            if (part.bounds.max.y > .135f && OverlapsWalk(part.bounds, .65f))
            {
                part.enabled = false;
                omitted.Add(part.name); excluded++; continue;
            }
            retained++;
            if (part.bounds.max.y > .3f)
            {
                var col = part.gameObject.AddComponent<MeshCollider>();
                col.sharedMesh = part.GetComponent<MeshFilter>().sharedMesh;
                occupied.Add(part.bounds);
            }
            SetStatic(part.gameObject);
            }
        }
        return new JObject { ["id"] = (string)spec["id"], ["asset"] = path, ["asset_guid"] = AssetDatabase.AssetPathToGUID(path), ["asset_sha256"] = Hash(path), ["width"] = b.size.x, ["depth"] = b.size.z, ["height"] = b.size.y, ["root_x"] = (float)spec["x"], ["root_z"] = (float)spec["z"], ["axis_adapter_yaw"] = 180, ["retained_fbx_connected_parts"] = retained, ["path_obstructions_excluded"] = excluded, ["excluded_mesh_names"] = omitted, ["strategy"] = "Exact FBX triangle connected-component extraction in Unity; original combined prefab renderer retained disabled; obstruction components excluded; explicit additional original bench FBXs placed separately" };
    }

    static List<MeshRenderer> ConnectedParts(MeshRenderer source, string moduleId)
    {
        var original = source.GetComponent<MeshFilter>().sharedMesh; var vertices = original.vertices;
        var normals = original.normals; var uv = original.uv;
        var parent = Enumerable.Range(0, vertices.Length).ToArray();
        Func<int, int> find = null;
        find = i => { while (parent[i] != i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
        Action<int, int> union = (a, b) => { int ra = find(a), rb = find(b); if (ra != rb) parent[rb] = ra; };
        // FBX duplicates vertices at material/normal/UV seams. Coincident position welds
        // are for connectivity only; output still uses every original unmodified vertex.
        var positions = new Dictionary<Vector3Int, int>();
        for (int i = 0; i < vertices.Length; i++)
        {
            var p = vertices[i]; var key = new Vector3Int(Mathf.RoundToInt(p.x * 10000), Mathf.RoundToInt(p.y * 10000), Mathf.RoundToInt(p.z * 10000));
            if (positions.TryGetValue(key, out int old)) union(i, old); else positions[key] = i;
        }
        var sourceTriangles = Enumerable.Range(0, original.subMeshCount).Select(s => original.GetTriangles(s)).ToArray();
        foreach (var t in sourceTriangles) for (int i = 0; i < t.Length; i += 3) { union(t[i], t[i + 1]); union(t[i], t[i + 2]); }
        var groups = new Dictionary<int, List<int>[]>();
        for (int s = 0; s < sourceTriangles.Length; s++)
        {
            var t = sourceTriangles[s];
            for (int i = 0; i < t.Length; i += 3)
            {
                int root = find(t[i]);
                if (!groups.ContainsKey(root)) groups[root] = Enumerable.Range(0, sourceTriangles.Length).Select(k => new List<int>()).ToArray();
                groups[root][s].Add(t[i]); groups[root][s].Add(t[i + 1]); groups[root][s].Add(t[i + 2]);
            }
        }
        var output = new List<MeshRenderer>(); int componentIndex = 0;
        foreach (var group in groups.OrderBy(g => g.Key))
        {
            var used = group.Value.SelectMany(t => t).Distinct().ToArray();
            var mapping = used.Select((v, i) => new { v, i }).ToDictionary(x => x.v, x => x.i);
            string key = moduleId + "_FBXPart_" + componentIndex++;
            var mesh = new Mesh { name = key, indexFormat = IndexFormat.UInt32, subMeshCount = original.subMeshCount };
            mesh.SetVertices(used.Select(i => vertices[i]).ToList());
            if (normals.Length == vertices.Length) mesh.SetNormals(used.Select(i => normals[i]).ToList());
            if (uv.Length == vertices.Length) mesh.SetUVs(0, used.Select(i => uv[i]).ToList());
            for (int s = 0; s < group.Value.Length; s++) mesh.SetTriangles(group.Value[s].Select(i => mapping[i]).ToArray(), s);
            mesh.RecalculateBounds();
            string path = Folder + "/phase4_meshes/" + key + ".asset"; var existing = AssetDatabase.LoadAssetAtPath<Mesh>(path);
            if (existing == null) AssetDatabase.CreateAsset(mesh, path); else { EditorUtility.CopySerialized(mesh, existing); UnityEngine.Object.DestroyImmediate(mesh); mesh = existing; }
            var go = Group(key, source.transform).gameObject; go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var renderer = go.AddComponent<MeshRenderer>(); renderer.sharedMaterials = source.sharedMaterials; output.Add(renderer);
        }
        return output;
    }

    static bool TryProp(string path, string name, Transform parent, Vector2 p, float yaw, float groundY, bool tree)
    {
        if (!ClearOfRoadsAndBuildings(p, 2)) return false;
        var asset = AssetDatabase.LoadAssetAtPath<GameObject>(path);
        if (asset == null) throw new InvalidOperationException("Missing actual prop FBX: " + path);
        var go = (GameObject)PrefabUtility.InstantiatePrefab(asset, parent); go.name = name;
        go.transform.rotation = Quaternion.Euler(0, yaw + 180, 0);
        var b = Bounds(go); go.transform.position += new Vector3(p.x - b.center.x, groundY - b.min.y, p.y - b.center.z); b = Bounds(go);
        if (OverlapsWalk(b, .65f) || occupied.Any(o => IntersectsXZ(o, b, .8f)) || !ClearOfRoadsAndBuildings(p, Mathf.Max(b.extents.x, b.extents.z) + .7f))
        { UnityEngine.Object.DestroyImmediate(go); return false; }
        occupied.Add(b);
        foreach (var collider in go.GetComponentsInChildren<Collider>(true)) UnityEngine.Object.DestroyImmediate(collider);
        if (tree)
        {
            var collision = Group("Collision_TreeTrunk", go.transform); collision.position = new Vector3(p.x, groundY + Mathf.Min(2, b.size.y * .5f), p.y);
            CollisionWorldFrame(collision, go.transform);
            var c = collision.gameObject.AddComponent<CapsuleCollider>(); c.radius = .32f; c.height = Mathf.Min(4, b.size.y); treeCount++;
        }
        else
        {
            var collision = Group("Collision_Bench", go.transform); collision.position = b.center;
            CollisionWorldFrame(collision, go.transform);
            var c = collision.gameObject.AddComponent<BoxCollider>(); c.size = b.size; benchCount++;
        }
        foreach (var r in go.GetComponentsInChildren<MeshRenderer>()) SetStatic(r.gameObject);
        return true;
    }

    static void CollisionWorldFrame(Transform collision, Transform model)
    {
        collision.rotation = Quaternion.identity;
        var scale = model.lossyScale;
        collision.localScale = new Vector3(1 / Mathf.Abs(scale.x), 1 / Mathf.Abs(scale.y), 1 / Mathf.Abs(scale.z));
    }

    static JObject FixLargeTriangles(GameObject city)
    {
        var changes = new JArray(); float before = 0, after = 0;
        foreach (var collider in city.GetComponentsInChildren<MeshCollider>(true))
        {
            var mesh = collider.sharedMesh; if (mesh == null) continue;
            float max = MaxEdge(mesh, collider.transform); before = Mathf.Max(before, max);
            var v = mesh.vertices; var t = mesh.triangles;
            var valid = new List<int>(); int degenerate = 0;
            for (int i = 0; i < t.Length; i += 3)
            {
                var a = collider.transform.TransformPoint(v[t[i]]); var b = collider.transform.TransformPoint(v[t[i + 1]]); var c = collider.transform.TransformPoint(v[t[i + 2]]);
                float longest = Mathf.Max(Vector3.Distance(a, b), Mathf.Max(Vector3.Distance(b, c), Vector3.Distance(c, a)));
                // Clipping occasionally emitted duplicate vertices or sub-0.1mm slivers.
                // Such geometry is unstable for PhysX and is below support QA's 1mm tolerance.
                float altitude = Vector3.Cross(b - a, c - a).magnitude / Mathf.Max(longest, .0000001f);
                if (altitude <= .0001f || !float.IsFinite(altitude)) { degenerate++; continue; }
                valid.Add(t[i]); valid.Add(t[i + 1]); valid.Add(t[i + 2]);
            }
            if (valid.Count == 0)
            {
                collider.sharedMesh = null; collider.enabled = false;
                changes.Add(new JObject { ["object"] = collider.name, ["source_mesh"] = mesh.name, ["degenerate_triangles_removed"] = degenerate, ["collider_action"] = "disabled: all clipped geometry was <=0.1mm slivers; visual mesh preserved" });
                continue;
            }
            if (max >= 500 || degenerate > 0)
            {
                var vertices = new List<Vector3>(); var triangles = new List<int>();
                for (int i = 0; i < valid.Count; i += 3) Split(v[valid[i]], v[valid[i + 1]], v[valid[i + 2]], collider.transform, vertices, triangles);
                var replacement = MeshAsset((max >= 500 ? "Tessellated_" : "PhysicsClean_") + collider.name, vertices, triangles);
                collider.sharedMesh = null; collider.sharedMesh = replacement;
                var filter = collider.GetComponent<MeshFilter>(); if (max >= 500 && filter != null && filter.sharedMesh == mesh) filter.sharedMesh = replacement;
                changes.Add(new JObject { ["object"] = collider.name, ["source_mesh"] = mesh.name, ["source_asset"] = AssetDatabase.GetAssetPath(mesh), ["max_world_edge_before"] = max, ["max_world_edge_after"] = MaxEdge(replacement, collider.transform), ["triangles_before"] = t.Length / 3, ["triangles_after"] = triangles.Count / 3, ["degenerate_triangles_removed"] = degenerate, ["visual_mesh_preserved"] = max < 500 });
            }
            after = Mathf.Max(after, MaxEdge(collider.sharedMesh, collider.transform));
        }
        if (after >= 500) throw new InvalidOperationException("Collider still has >=500-unit triangle edge: " + after);
        return new JObject { ["max_world_edge_before"] = before, ["max_world_edge_after"] = after, ["replacements"] = changes, ["cause"] = "CityGround 436x451m quad diagonal 627.30m; new scene-only tessellation to at most 80m edges", ["source_fbx_modified"] = false };
    }

    static void Split(Vector3 a, Vector3 b, Vector3 c, Transform frame, List<Vector3> vertices, List<int> triangles)
    {
        float ab = Vector3.Distance(frame.TransformPoint(a), frame.TransformPoint(b));
        float bc = Vector3.Distance(frame.TransformPoint(b), frame.TransformPoint(c));
        float ca = Vector3.Distance(frame.TransformPoint(c), frame.TransformPoint(a));
        if (Mathf.Max(ab, Mathf.Max(bc, ca)) <= 80)
        { int i = vertices.Count; vertices.Add(a); vertices.Add(b); vertices.Add(c); triangles.Add(i); triangles.Add(i + 1); triangles.Add(i + 2); return; }
        if (ab >= bc && ab >= ca) { var m = (a + b) * .5f; Split(a, m, c, frame, vertices, triangles); Split(m, b, c, frame, vertices, triangles); }
        else if (bc >= ca) { var m = (b + c) * .5f; Split(a, b, m, frame, vertices, triangles); Split(a, m, c, frame, vertices, triangles); }
        else { var m = (c + a) * .5f; Split(a, b, m, frame, vertices, triangles); Split(m, b, c, frame, vertices, triangles); }
    }

    static float MaxEdge(Mesh mesh, Transform t)
    {
        var v = mesh.vertices; var indices = mesh.triangles; float max = 0;
        for (int i = 0; i < indices.Length; i += 3)
            for (int j = 0; j < 3; j++) max = Mathf.Max(max, Vector3.Distance(t.TransformPoint(v[indices[i + j]]), t.TransformPoint(v[indices[i + (j + 1) % 3]])));
        return max;
    }

    static void Surface(string name, Transform parent, List<Vector2> polygon, float y, Material material)
    {
        var vertices = polygon.Select(p => new Vector3(p.x, y, p.y)).ToList(); var triangles = Triangulate(polygon);
        var mesh = MeshAsset(name, vertices, triangles); var go = Group(name, parent).gameObject;
        go.AddComponent<MeshFilter>().sharedMesh = mesh; go.AddComponent<MeshRenderer>().sharedMaterial = material; go.AddComponent<MeshCollider>().sharedMesh = mesh;
        SetStatic(go);
    }

    static List<int> Triangulate(List<Vector2> poly)
    {
        var order = Enumerable.Range(0, poly.Count).ToList(); float area = 0;
        for (int i = 0; i < poly.Count; i++) area += Cross(poly[i], poly[(i + 1) % poly.Count]);
        if (area < 0) order.Reverse();
        var result = new List<int>(); int guard = 0;
        while (order.Count > 2 && guard++ < poly.Count * poly.Count)
        {
            bool found = false;
            for (int i = 0; i < order.Count; i++)
            {
                int a = order[(i + order.Count - 1) % order.Count], b = order[i], c = order[(i + 1) % order.Count];
                if (Cross(poly[b] - poly[a], poly[c] - poly[b]) <= .000001f) continue;
                if (order.Any(j => j != a && j != b && j != c && InTriangle(poly[j], poly[a], poly[b], poly[c]))) continue;
                result.Add(a); result.Add(c); result.Add(b); order.RemoveAt(i); found = true; break;
            }
            if (!found) throw new InvalidOperationException("Cannot triangulate approved park polygon.");
        }
        return result;
    }

    static Mesh MeshAsset(string key, List<Vector3> vertices, List<int> triangles)
    {
        var mesh = new Mesh { name = key, indexFormat = IndexFormat.UInt32 }; mesh.SetVertices(vertices); mesh.SetTriangles(triangles, 0); mesh.RecalculateNormals(); mesh.RecalculateBounds();
        string path = Folder + "/phase4_meshes/" + key + ".asset"; var existing = AssetDatabase.LoadAssetAtPath<Mesh>(path);
        if (existing == null) AssetDatabase.CreateAsset(mesh, path); else { EditorUtility.CopySerialized(mesh, existing); UnityEngine.Object.DestroyImmediate(mesh); mesh = existing; }
        return mesh;
    }

    static bool OverlapsWalk(Bounds b, float clearance)
    {
        // Sampling <=0.3m also covers narrow diagonal intersections with model world AABBs.
        foreach (var edge in layout["pedestrian_edges"])
        {
            var pts = Points(edge["points"]); float half = (float)edge["width"] * .5f + clearance;
            for (int i = 0; i < pts.Count - 1; i++)
            {
                float length = Vector2.Distance(pts[i], pts[i + 1]); int samples = Mathf.CeilToInt(length / .3f);
                for (int s = 0; s <= samples; s++)
                { var p = Vector2.Lerp(pts[i], pts[i + 1], samples == 0 ? 0 : (float)s / samples); if (p.x >= b.min.x - half && p.x <= b.max.x + half && p.y >= b.min.z - half && p.y <= b.max.z + half) return true; }
            }
        }
        return false;
    }

    static bool ClearOfRoadsAndBuildings(Vector2 p, float radius)
    {
        var extent = layout["extent"];
        if (p.x - radius < (float)extent["xmin"] || p.x + radius > (float)extent["xmax"] || p.y - radius < (float)extent["zmin"] || p.y + radius > (float)extent["zmax"]) return false;
        if (sportBounds.Any(b => p.x > b.min.x - radius && p.x < b.max.x + radius && p.y > b.min.z - radius && p.y < b.max.z + radius)) return false;
        foreach (var road in layout["roads"])
        { var pts = Points(road["points"]); for (int i = 0; i < pts.Count - 1; i++) if (Distance(p, pts[i], pts[i + 1]) < radius + (float)road["carriageway_width"] * .5f + .7f) return false; }
        foreach (var b in layout["buildings"].Concat(layout["campus"]["components"]))
        { var polygon = Points(b["footprint_polygon"]); if (InPolygon(p, polygon) || DistanceToBoundary(p, polygon) < radius + .7f) return false; }
        // Preserve all existing sports facilities and their playing areas.
        foreach (var facility in new[] { "field", "field_lawn", "plaza" })
        { var item = layout["campus"][facility]; if (item?["footprint_polygon"] != null) { var poly = Points(item["footprint_polygon"]); if (InPolygon(p, poly) || DistanceToBoundary(p, poly) < radius) return false; } }
        return true;
    }
    static JArray BuildingSnapshot(Transform city) => new JArray(new[] { "06_CampusBuildings_14", "08_ExternalBuildings_55" }.SelectMany(n => city.Find(n).Cast<Transform>()).Select(t => new JObject { ["name"] = t.name, ["position"] = Vec(t.position), ["rotation"] = Vec(t.eulerAngles), ["scale"] = Vec(t.localScale) }));
    static Bounds Bounds(GameObject go) { var rs = go.GetComponentsInChildren<Renderer>(true); if (rs.Length == 0) throw new InvalidOperationException("FBX has no renderers: " + go.name); var b = rs[0].bounds; foreach (var r in rs.Skip(1)) b.Encapsulate(r.bounds); return b; }
    static bool IntersectsXZ(Bounds a, Bounds b, float gap) => a.min.x - gap <= b.max.x && a.max.x + gap >= b.min.x && a.min.z - gap <= b.max.z && a.max.z + gap >= b.min.z;
    static float Cross(Vector2 a, Vector2 b) => a.x * b.y - a.y * b.x;
    static bool InTriangle(Vector2 p, Vector2 a, Vector2 b, Vector2 c) => Cross(b - a, p - a) >= 0 && Cross(c - b, p - b) >= 0 && Cross(a - c, p - c) >= 0;
    static float Distance(Vector2 p, Vector2 a, Vector2 b) { var d = b - a; return Vector2.Distance(p, a + d * Mathf.Clamp01(Vector2.Dot(p - a, d) / Mathf.Max(.000001f, d.sqrMagnitude))); }
    static float DistanceToBoundary(Vector2 p, List<Vector2> polygon) => Enumerable.Range(0, polygon.Count).Min(i => Distance(p, polygon[i], polygon[(i + 1) % polygon.Count]));
    static bool InPolygon(Vector2 p, List<Vector2> polygon) { bool inside = false; for (int i = 0, j = polygon.Count - 1; i < polygon.Count; j = i++) { var a = polygon[i]; var b = polygon[j]; if ((a.y > p.y) != (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside; } return inside; }
    static List<Vector2> Points(JToken token) => token.Select(p => new Vector2((float)p[0], (float)p[1])).ToList();
    static List<Vector2> Circle(Vector2 p, float r) => Enumerable.Range(0, 40).Select(i => p + new Vector2(Mathf.Cos(i * 2 * Mathf.PI / 40), Mathf.Sin(i * 2 * Mathf.PI / 40)) * r).ToList();
    static Transform Group(string name, Transform parent) { var go = new GameObject(name); go.transform.SetParent(parent, false); return go.transform; }
    static JArray Vec(Vector3 v) => new JArray(v.x, v.y, v.z);
    static string Hash(string path) { using (var sha = SHA256.Create()) return BitConverter.ToString(sha.ComputeHash(File.ReadAllBytes(path))).Replace("-", "").ToLowerInvariant(); }
    static void SetStatic(GameObject go) => GameObjectUtility.SetStaticEditorFlags(go, StaticEditorFlags.BatchingStatic | StaticEditorFlags.OccluderStatic | StaticEditorFlags.OccludeeStatic);
    static Material Material(string key, Color color) { string path = Folder + "/phase4_materials/" + key + ".mat"; var material = AssetDatabase.LoadAssetAtPath<Material>(path); if (material == null) { material = new Material(Shader.Find("Standard")); AssetDatabase.CreateAsset(material, path); } material.color = color; material.SetFloat("_Glossiness", .03f); material.enableInstancing = true; EditorUtility.SetDirty(material); return material; }
}
