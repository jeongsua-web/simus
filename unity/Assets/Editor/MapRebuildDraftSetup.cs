using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Simus;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

/// <summary>Unity owns assembly. layout.json is a provisional editing source, never server map data.</summary>
public static class MapRebuildDraftSetup
{
    public const string Folder = "Assets/SIMUS/Scenes/map_rebuild_draft";
    public const string ScenePath = Folder + "/map_rebuild_draft.unity";
    [Serializable] public class MaterialSpec { public string key, path, guid; }
    [Serializable] public class Item { public string name, material, modelPath; public Vector3 position, size; }
    [Serializable] public class Layout { public string status; public float roadWidth, sidewalkWidth, npcHeightReference; public MaterialSpec[] materials; public Item[] items; }

    [MenuItem("SIMUS/Map Rebuild/Regenerate Draft From Layout")]
    public static void Build()
    {
        if (!Application.isBatchMode && !EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;
        if (!File.Exists(ScenePath))
        {
            // Original is copied once; no original scene, controller or build selection is written.
            if (!AssetDatabase.CopyAsset(CompletedMapFollowSetup.ScenePath, ScenePath))
                throw new InvalidOperationException("Cannot duplicate original follow scene");
        }
        var scene = EditorSceneManager.OpenScene(ScenePath);
        var layout = JsonUtility.FromJson<Layout>(File.ReadAllText(Folder + "/layout.json"));
        if (layout == null || layout.items == null || layout.status != "provisional_road_and_zone_draft_not_exhibition")
            throw new InvalidOperationException("Invalid provisional draft layout");
        var materials = layout.materials.ToDictionary(m => m.key, m => AssetDatabase.LoadAssetAtPath<Material>(m.path));
        if (materials.Values.Any(m => m == null)) throw new InvalidOperationException("Draft material missing");
        // Only this generated root is replaced; other user-authored roots in the duplicate survive.
        foreach (var root in scene.GetRootGameObjects())
        {
            if (root.name == "GeneratedDraft") UnityEngine.Object.DestroyImmediate(root);
            else if (root.name == "SIMUS Completed Map 03") root.SetActive(false);
        }
        var generated = new GameObject("GeneratedDraft");
        foreach (var item in layout.items)
        {
            GameObject obj;
            if (!string.IsNullOrEmpty(item.modelPath))
            {
                var asset = AssetDatabase.LoadAssetAtPath<GameObject>(item.modelPath);
                if (asset == null) throw new InvalidOperationException("Scale reference FBX missing: " + item.modelPath);
                obj = (GameObject)PrefabUtility.InstantiatePrefab(asset);
                obj.transform.SetParent(generated.transform, false);
                // Keep native imported scale and orientation. Place by actual world renderer bounds.
                var renderers = obj.GetComponentsInChildren<Renderer>();
                if (renderers.Length == 0) throw new InvalidOperationException("No renderers: " + item.modelPath);
                var bounds = renderers[0].bounds;
                foreach (var r in renderers) bounds.Encapsulate(r.bounds);
                obj.transform.position += new Vector3(item.position.x - bounds.center.x, .24f - bounds.min.y, item.position.z - bounds.center.z);
                Debug.Log("DRAFT_REUSED_MODEL " + item.modelPath + " bounds=" + bounds.size);
            }
            else
            {
                obj = GameObject.CreatePrimitive(PrimitiveType.Cube);
                obj.transform.SetParent(generated.transform, false);
                obj.transform.position = item.position;
                obj.transform.localScale = item.size;
                obj.GetComponent<Renderer>().sharedMaterial = materials[item.material];
            }
            obj.name = item.name;
        }
        var patrol = UnityEngine.Object.FindFirstObjectByType<TestNpcPatrol>();
        if (patrol == null) throw new InvalidOperationException("Copied NPC is missing");
        patrol.startPoint.position = new Vector3(-65, .26f, 5.5f);
        patrol.endPoint.position = new Vector3(-29, .26f, 5.5f);
        patrol.transform.position = patrol.startPoint.position;
        var camera = UnityEngine.Object.FindFirstObjectByType<CityPreviewCamera>();
        camera.overviewTarget = Vector3.zero;
        camera.overviewSize = 132; camera.topViewSize = 108;
        camera.previewSubtitle = "ROAD AND ZONE DRAFT | NOT EXHIBITION";
        camera.followTarget = patrol.transform;
        camera.TopView();
        EditorSceneManager.SaveScene(scene, ScenePath);
        Debug.Log("MAP_REBUILD_DRAFT_READY items=" + generated.transform.childCount + "; no exhibition identifiers or build settings changed");
    }

    [MenuItem("SIMUS/Map Rebuild/Validate And Capture Draft")]
    public static void ValidateAndCapture()
    {
        var original = File.ReadAllBytes(CompletedMapFollowSetup.ScenePath);
        var buildSettings = File.ReadAllBytes("ProjectSettings/EditorBuildSettings.asset");
        Build(); var first = Signature(); Build(); var second = Signature();
        if (first != second) throw new InvalidOperationException("Draft is not repeatable");
        if (!original.SequenceEqual(File.ReadAllBytes(CompletedMapFollowSetup.ScenePath)) ||
            !buildSettings.SequenceEqual(File.ReadAllBytes("ProjectSettings/EditorBuildSettings.asset")))
            throw new InvalidOperationException("Protected source changed during draft generation");
        Physics.SyncTransforms();
        for (int i = 0; i <= 36; i++)
            if (!Physics.Raycast(new Vector3(-65 + i, 5, 5.5f), Vector3.down, out var hit, 10) || Mathf.Abs(hit.point.y - .24f) > .02f)
                throw new InvalidOperationException("NPC scale-test sidewalk support missing");
        Directory.CreateDirectory("../docs/verification/map-rebuild-captures");
        var preview = UnityEngine.Object.FindFirstObjectByType<CityPreviewCamera>();
        var camera = preview.GetComponent<Camera>();
        preview.TopView(); Capture(camera, "top-view.png");
        var target = preview.followTarget.position + preview.followOffset;
        camera.transform.rotation = Quaternion.Euler(preview.followPitch, preview.followYaw, 0);
        camera.transform.position = target - camera.transform.forward * 360;
        camera.orthographicSize = preview.followSize;
        Capture(camera, "game-camera.png");
        preview.TopView();
        Debug.Log("MAP_REBUILD_DRAFT_VALIDATED: repeatable, original scene/build selection preserved, 37 sidewalk rays supported. Editor camera renders only; Play Mode remains separate.");
    }
    private static string Signature()
    {
        var roots = UnityEngine.SceneManagement.SceneManager.GetActiveScene().GetRootGameObjects().Where(g => g.name == "GeneratedDraft").ToArray();
        if (roots.Length != 1) throw new InvalidOperationException("Duplicate draft root");
        return string.Join("\n", roots[0].GetComponentsInChildren<Transform>().Select(t => t.name + t.localPosition.ToString("F4") + t.localRotation.ToString("F4") + t.localScale.ToString("F4")));
    }
    private static void Capture(Camera camera, string filename)
    {
        var old = camera.targetTexture; var active = RenderTexture.active;
        var rt = new RenderTexture(1600, 1200, 24); var image = new Texture2D(1600, 1200, TextureFormat.RGB24, false);
        try
        {
            camera.targetTexture = rt; camera.Render(); RenderTexture.active = rt;
            image.ReadPixels(new Rect(0, 0, 1600, 1200), 0, 0); image.Apply();
            File.WriteAllBytes("../docs/verification/map-rebuild-captures/" + filename, image.EncodeToPNG());
        }
        finally { camera.targetTexture = old; RenderTexture.active = active; rt.Release(); UnityEngine.Object.DestroyImmediate(rt); UnityEngine.Object.DestroyImmediate(image); }
    }
}
