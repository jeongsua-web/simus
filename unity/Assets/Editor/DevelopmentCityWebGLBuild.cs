using System;
using System.IO;
using Simus;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;

// Dedicated development build: never establishes exhibition coordinates or assets.
public static class DevelopmentCityWebGLBuild
{
    public static void Build()
    {
        EditorSceneManager.OpenScene(CompletedMapFollowSetup.ScenePath);
        GameObject npcTemplate = null;
        foreach (var patrol in UnityEngine.Object.FindObjectsByType<TestNpcPatrol>(FindObjectsSortMode.None))
        {
            if (npcTemplate == null)
            {
                npcTemplate = patrol.gameObject;
                UnityEngine.Object.DestroyImmediate(patrol);
                npcTemplate.name = "SIMUS Animated NPC Template";
                npcTemplate.transform.position = Vector3.zero;
                npcTemplate.transform.rotation = Quaternion.identity;
                npcTemplate.SetActive(false);
            }
            else UnityEngine.Object.DestroyImmediate(patrol.gameObject);
        }
        if (npcTemplate == null) throw new InvalidOperationException("Animated character template missing");
        var camera = UnityEngine.Object.FindFirstObjectByType<CityPreviewCamera>();
        if (camera == null) throw new InvalidOperationException("Follow camera missing");
        camera.followTarget = null;
        camera.previewControls = false;
        camera.followSize = 5;
        var bridge = new GameObject("SIMUS Web Bridge").AddComponent<WebCityBridge>();
        bridge.mapVersion = "dev-synthetic-v1";
        bridge.followCamera = camera;
        bridge.npcTemplate = npcTemplate;
        // Existing development round snapshots use this synthetic square; do not edit them.
        var floor = GameObject.CreatePrimitive(PrimitiveType.Plane);
        floor.name = "Development route floor - not exhibition placement";
        floor.transform.position = new Vector3(10, -0.05f, 10);
        floor.transform.localScale = new Vector3(4, 1, 4);
        const string scene = "Assets/SIMUS/Scenes/npc_follow_test/DevelopmentCity.unity";
        EditorSceneManager.SaveScene(UnityEngine.SceneManagement.SceneManager.GetActiveScene(), scene);
        var output = Environment.GetEnvironmentVariable("SIMUS_DEV_CITY_OUTPUT") ?? "Builds/development_city";
        var template = PlayerSettings.WebGL.template;
        var compression = PlayerSettings.WebGL.compressionFormat;
        try
        {
            PlayerSettings.WebGL.template = "PROJECT:simus_city";
            PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Disabled;
            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions {
                scenes = new[] { scene }, locationPathName = output,
                target = BuildTarget.WebGL, options = BuildOptions.None
            });
            if (report.summary.result != BuildResult.Succeeded) throw new InvalidOperationException("Development city build failed");
            File.WriteAllText(Path.Combine(output, "build.json"), "{\"protocol_version\":1,\"map_version\":\"dev-synthetic-v1\",\"exhibition_ready\":false}\n");
        }
        finally { PlayerSettings.WebGL.template = template; PlayerSettings.WebGL.compressionFormat = compression; }
    }
}
