#if UNITY_EDITOR
using System;
using System.Linq;
using Simus.City;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

public static class NeighborhoodIntegration
{
    public const string ScenePath = "Assets/Scenes/NeighborhoodLive.unity";

    [MenuItem("SIMUS/Build Connected Neighborhood")]
    public static void Build()
    {
        if (!Application.isBatchMode && !EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;
        EditorSceneManager.OpenScene("Assets/Scenes/Neighborhood.unity");
        var root = new GameObject("SIMUS Connected Neighborhood");
        var poller = root.AddComponent<CityStatePoller>();
        root.AddComponent<CityStateDebugView>().SetPoller(poller);
        var life = root.AddComponent<NeighborhoodLife>();
        life.client = poller;
        life.path = new[] { new Vector3(-64, 1.4f, 12), new Vector3(-64, 1.4f, 45) };
        life.previewNpcs = new Transform[3];
        for (var i = 0; i < life.previewNpcs.Length; i++)
        {
            var npc = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            npc.name = "Preview NPC " + i + " (not a participant)";
            npc.transform.SetParent(root.transform);
            npc.transform.position = life.PositionAt(i * 7);
            life.previewNpcs[i] = npc.transform;
        }
        life.moodBeacon = Beacon(root, "Happiness preview", -66);
        life.cleanlinessBeacon = Beacon(root, "Cleanliness preview", -62);
        life.safetyBeacon = Beacon(root, "Safety preview", -58);
        var walk = UnityEngine.Object.FindObjectsByType<MeshRenderer>(FindObjectsSortMode.None)
            .Single(r => r.name == "Restaurant pedestrian lane");
        var collider = walk.gameObject.AddComponent<MeshCollider>();
        Physics.SyncTransforms();
        try
        {
            for (var i = 0; i <= 33; i++)
                if (!collider.Raycast(new Ray(new Vector3(-64, 10, 12 + i), Vector3.down), out _, 20))
                    throw new Exception("NPC preview path is outside the walkway at " + i);
        }
        finally { UnityEngine.Object.DestroyImmediate(collider); }
        EditorSceneManager.SaveScene(UnityEngine.SceneManagement.SceneManager.GetActiveScene(), ScenePath);
        EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
        AssetDatabase.SaveAssets();
        Debug.Log("SIMUS_CONNECTED_NEIGHBORHOOD_BUILT: /api/city-state; 34 walkway samples passed");
    }

    private static Renderer Beacon(GameObject root, string name, float x)
    {
        var beacon = GameObject.CreatePrimitive(PrimitiveType.Cube);
        beacon.name = name;
        beacon.transform.SetParent(root.transform);
        beacon.transform.position = new Vector3(x, 2, 48);
        beacon.transform.localScale = new Vector3(2, 4, 2);
        return beacon.GetComponent<Renderer>();
    }
}
#endif
