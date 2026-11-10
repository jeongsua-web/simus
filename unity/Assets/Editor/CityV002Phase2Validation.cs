using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using UnityEditor.SceneManagement;
using UnityEngine;

// Read-only saved-scene audit. Samples server polylines against real imported
// colliders; does not claim Play Mode or browser verification and never saves.
public static class CityV002Phase2Validation
{
    static string PathOf(Transform t) => t.parent == null ? t.name : PathOf(t.parent) + "/" + t.name;
    static Vector3 V(JToken p) => new Vector3((float)p[0], (float)p[1], (float)p[2]);
    static JArray A(Vector3 p) => new JArray(p.x, p.y, p.z);
    public static void Verify()
    {
        var scene = EditorSceneManager.OpenScene(CityRebuildV002Setup.ScenePath);
        var transforms = scene.GetRootGameObjects().SelectMany(g => g.GetComponentsInChildren<Transform>(true)).ToArray();
        Physics.SyncTransforms();
        var rows = JArray.Parse(File.ReadAllText(Environment.GetEnvironmentVariable("SIMUS_PHASE2_ROUTES") ?? "/tmp/simus-phase2-routes.json"));
        var results = new JArray();
        foreach (JObject row in rows)
        {
            var target = transforms.FirstOrDefault(t => PathOf(t) == (string)row["scene_path"]);
            var result = new JObject { ["code"] = row["code"], ["place_id"] = row["place_id"], ["object_found"] = target != null,
                ["scene_path"] = row["scene_path"], ["object_position"] = target == null ? null : A(target.position),
                ["object_colliders"] = target == null ? 0 : target.GetComponentsInChildren<Collider>(true).Length };
            var targetRenderers = target == null ? Array.Empty<Renderer>() : target.GetComponentsInChildren<Renderer>(false);
            foreach (var kind in new[] { "from_plaza", "approach" })
            {
                var points = row[kind].Select(V).ToArray();
                int samples = 0, missing = 0, blocked = 0;
                float targetClearance = float.PositiveInfinity;
                var obstacles = new HashSet<string>(); var failures = new JArray();
                for (int i = 1; i < points.Length; i++)
                {
                    int steps = Mathf.Max(1, Mathf.CeilToInt(Vector3.Distance(points[i-1], points[i]) / .25f));
                    for (int j = 0; j <= steps; j++)
                    {
                        var p = Vector3.Lerp(points[i-1], points[i], j / (float)steps); samples++;
                        // Render-only obstacles (notably the parked car/flowers/bin)
                        // cannot be certified by Physics alone. AABB clearance is
                        // conservative evidence, not a triangle collision test.
                        foreach (var renderer in targetRenderers)
                        {
                            var bounds = renderer.bounds;
                            if (bounds.max.y < p.y + .2f || bounds.min.y > p.y + 1.7f) continue;
                            float dx = Mathf.Max(bounds.min.x - p.x, 0, p.x - bounds.max.x);
                            float dz = Mathf.Max(bounds.min.z - p.z, 0, p.z - bounds.max.z);
                            targetClearance = Mathf.Min(targetClearance, Mathf.Sqrt(dx*dx + dz*dz));
                        }
                        var support = Physics.RaycastAll(p + Vector3.up * .45f, Vector3.down, .9f, Physics.DefaultRaycastLayers, QueryTriggerInteraction.Ignore)
                            .Where(h => h.normal.y > .7f && Mathf.Abs(h.point.y + .02f - p.y) < .2f).ToArray();
                        if (support.Length == 0) { missing++; if (failures.Count < 8) failures.Add(new JObject { ["point"] = A(p), ["kind"] = "missing_support" }); }
                        var hits = Physics.OverlapCapsule(p + Vector3.up * .25f, p + Vector3.up * 1.55f, .2f, Physics.DefaultRaycastLayers, QueryTriggerInteraction.Ignore)
                            .Where(c => c.enabled && c.gameObject.activeInHierarchy && c.bounds.max.y > p.y + .2f &&
                                !PathOf(c.transform).Contains("NPC_") && !PathOf(c.transform).Contains("TestNPC") && !PathOf(c.transform).Contains("TestNpc") &&
                                !PathOf(c.transform).Contains("CAT_Tuxedo") && !PathOf(c.transform).Contains("GraphWaypoint")).ToArray();
                        if (hits.Length > 0)
                        {
                            blocked++; foreach (var hit in hits) obstacles.Add(PathOf(hit.transform));
                            if (failures.Count < 8) failures.Add(new JObject { ["point"] = A(p), ["kind"] = "capsule_overlap", ["objects"] = new JArray(hits.Select(c => PathOf(c.transform))) });
                        }
                    }
                }
                result[kind] = new JObject { ["samples"] = samples, ["missing_support"] = missing, ["blocked_samples"] = blocked,
                    ["target_renderer_aabb_clearance_xz_m"] = float.IsInfinity(targetClearance) ? (JToken)JValue.CreateNull() : new JValue(targetClearance),
                    ["obstacles"] = new JArray(obstacles), ["first_failures"] = failures, ["status"] = missing == 0 && blocked == 0 ? "PASS" : "FAIL" };
            }
            results.Add(result);
        }
        var output = Environment.GetEnvironmentVariable("SIMUS_PHASE2_SPATIAL_OUTPUT") ?? "/tmp/simus-phase2-spatial.json";
        File.WriteAllText(output, new JObject { ["scope"] = "Edit Mode imported scene, 0.25m polyline samples, 0.2m pedestrian capsule; no Play Mode claim",
            ["unity"] = Application.unityVersion, ["scene"] = scene.path, ["events"] = results }.ToString());
        Debug.Log("PHASE2_SPATIAL_AUDIT " + output);
    }
}
