using System;
using System.IO;
using System.Linq;
using Simus;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;

// Phase 1 only. The version below identifies a test build, not exhibition coordinates.
public static class CityRebuildV002WebGLBuild
{
    public const string MapVersion = "test-only-city-rebuild-v002-webgl-v1";

    [MenuItem("SIMUS/City Rebuild v002/Build map-only WebGL")]
    public static void Build()
    {
        var output = Path.GetFullPath(Environment.GetEnvironmentVariable("SIMUS_V002_WEBGL_OUTPUT") ?? "Builds/city_rebuild_v002_test");
        if (Directory.Exists(output) && Directory.EnumerateFileSystemEntries(output).Any())
            throw new InvalidOperationException("Use an empty test output directory; existing builds are protected.");
        if (!BuildPipeline.IsBuildTargetSupported(BuildTargetGroup.WebGL, BuildTarget.WebGL))
            throw new InvalidOperationException("WebGL Build Support is required.");
        var setup = EditorSceneManager.GetSceneManagerSetup();
        var template = PlayerSettings.WebGL.template;
        var compression = PlayerSettings.WebGL.compressionFormat;
        const string temporaryScene = "Assets/SIMUS/Scenes/city_rebuild_v002/CityRebuild_v002_WebGL_Test.unity";
        if (File.Exists(temporaryScene)) throw new InvalidOperationException("Temporary scene already exists.");
        try
        {
            var scene = EditorSceneManager.OpenScene(CityRebuildV002Setup.ScenePath);
            var camera = UnityEngine.Object.FindFirstObjectByType<CityPreviewCamera>();
            if (camera == null || camera.followTarget == null) throw new InvalidOperationException("Phase 8 camera/target missing.");
            // Keep the Phase 8 lens, easing, occlusion and initial focus, without a test actor.
            var focus = new GameObject("Phase 8 stationary map focus").transform;
            focus.position = camera.followTarget.position;
            camera.followTarget = focus;
            camera.followNpcId = "";
            camera.previewControls = false;
            var roots = scene.GetRootGameObjects();
            var adapters = roots.SelectMany(root => root.GetComponentsInChildren<CityV002NpcRouteAdapter>(true)).ToArray();
            var patrols = roots.SelectMany(root => root.GetComponentsInChildren<TestNpcPatrol>(true)).ToArray();
            var verifications = roots.SelectMany(root => root.GetComponentsInChildren<CityV002NavigationVerification>(true)).ToArray();
            foreach (var verification in verifications) UnityEngine.Object.DestroyImmediate(verification);
            foreach (var adapter in adapters) UnityEngine.Object.DestroyImmediate(adapter);
            foreach (var patrol in patrols) if (patrol != null) UnityEngine.Object.DestroyImmediate(patrol.gameObject);
            var bridge = new GameObject("SIMUS Web Bridge").AddComponent<WebCityBridge>();
            bridge.mapVersion = MapVersion;
            bridge.followCamera = camera;
            bridge.mapDisplayOnly = true;
            EditorSceneManager.SaveScene(scene, temporaryScene);
            PlayerSettings.WebGL.template = "PROJECT:simus_city";
            PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Disabled;
            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions {
                scenes = new[] { temporaryScene }, locationPathName = output,
                target = BuildTarget.WebGL, options = BuildOptions.None
            });
            if (report.summary.result != BuildResult.Succeeded) throw new InvalidOperationException("CityRebuild_v002 WebGL failed: " + report.summary.result);
            File.WriteAllText(Path.Combine(output, "build.json"), "{\"protocol_version\":1,\"map_version\":\"" + MapVersion + "\",\"kind\":\"city-rebuild-v002-map-only\",\"npc_motion_enabled\":false,\"exhibition_ready\":false}\n");
        }
        finally
        {
            PlayerSettings.WebGL.template = template;
            PlayerSettings.WebGL.compressionFormat = compression;
            AssetDatabase.SaveAssets();
            if (setup.Any(item => item.isActive)) EditorSceneManager.RestoreSceneManagerSetup(setup);
            else EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            AssetDatabase.DeleteAsset(temporaryScene);
        }
    }
}
