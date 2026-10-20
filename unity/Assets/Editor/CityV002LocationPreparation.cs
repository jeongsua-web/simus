using System;
using System.IO;
using System.Linq;
using Newtonsoft.Json.Linq;
using Simus;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

/// <summary>Edit-mode spatial preparation only; never runs movement, events, builds or tests.</summary>
public static class CityV002LocationPreparation
{
    private const string Output = "../docs/placement/phase1";
    private static JArray V(Vector3 p) => new JArray(p.x, p.y, p.z);
    private static string PathOf(Transform t) => t.parent == null ? t.name : PathOf(t.parent) + "/" + t.name;

    public static void Inspect()
    {
        if (EditorApplication.isPlayingOrWillChangePlaymode) throw new InvalidOperationException("Edit Mode only.");
        var scene = EditorSceneManager.OpenScene(CityRebuildV002Setup.ScenePath);
        var root = scene.GetRootGameObjects().Single(g => g.name == "SIMUS_EventPlacement_20261020");
        var rows = new JArray();
        foreach (Transform t in root.transform)
        {
            if (!t.name.StartsWith("ENV_") && !t.name.StartsWith("NPC_") && !t.name.StartsWith("VEH_") && !t.name.ToLowerInvariant().Contains("cat")) continue;
            var renderers = t.GetComponentsInChildren<Renderer>(true);
            var bounds = renderers.Length == 0 ? new Bounds(t.position, Vector3.zero) : renderers[0].bounds;
            foreach (var renderer in renderers.Skip(1)) bounds.Encapsulate(renderer.bounds);
            var details = new JArray();
            foreach (var child in t.GetComponentsInChildren<Transform>(true))
            {
                if (!new[] { "door", "entrance", "ground", "portal", "pavement", "stairs", "collider", "threshold" }.Any(key => child.name.ToLowerInvariant().Contains(key))) continue;
                var renderer = child.GetComponent<Renderer>();
                details.Add(new JObject { ["path"] = PathOf(child), ["active"] = child.gameObject.activeInHierarchy,
                    ["position"] = V(child.position), ["bounds_min"] = renderer == null ? null : V(renderer.bounds.min),
                    ["bounds_max"] = renderer == null ? null : V(renderer.bounds.max) });
            }
            rows.Add(new JObject { ["path"] = PathOf(t), ["active"] = t.gameObject.activeInHierarchy, ["position"] = V(t.position),
                ["bounds_min"] = V(bounds.min), ["bounds_max"] = V(bounds.max), ["details"] = details,
                ["colliders"] = new JArray(t.GetComponentsInChildren<Collider>(true).Select(c => new JObject {
                    ["path"] = PathOf(c.transform), ["type"] = c.GetType().Name, ["enabled"] = c.enabled,
                    ["is_trigger"] = c.isTrigger, ["bounds_min"] = V(c.bounds.min), ["bounds_max"] = V(c.bounds.max) })) });
        }
        Directory.CreateDirectory(Output);
        File.WriteAllText(Output + "/unity-spatial-inputs.json", new JObject { ["scene"] = scene.path,
            ["scope"] = "Edit-mode design measurements, not QA or runtime verification", ["objects"] = rows }.ToString());
        Debug.Log("CITY_V002_LOCATION_EDIT_MODE_INSPECTION_WRITTEN");
    }
}
