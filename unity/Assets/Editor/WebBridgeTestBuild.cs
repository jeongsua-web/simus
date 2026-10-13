using System;
using System.IO;
using Simus;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;

public static class WebBridgeTestBuild
{
    [MenuItem("SIMUS/Bridge/Create test scene")]
    public static void CreateScene()
    {
        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        var cameraObject = new GameObject("Main Camera");
        cameraObject.tag = "MainCamera";
        cameraObject.AddComponent<Camera>().farClipPlane = 1000;
        var camera = cameraObject.AddComponent<CityPreviewCamera>();
        camera.followSize = 10;
        camera.previewControls = false;
        camera.previewSubtitle = "TEST ONLY - NOT EXHIBITION DATA";
        var light = new GameObject("Test Light").AddComponent<Light>();
        light.type = LightType.Directional;
        light.transform.rotation = Quaternion.Euler(50, -30, 0);
        var floor = GameObject.CreatePrimitive(PrimitiveType.Plane);
        floor.name = "Synthetic test floor - no exhibition coordinates";
        floor.transform.localScale = new Vector3(4, 1, 4);
        var bridge = new GameObject("SIMUS Web Bridge").AddComponent<WebCityBridge>();
        bridge.followCamera = camera;
        var model = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/SIMUS/Art/characters/modular_hairfix_v001/models/SIMUS_Modular_Character_Happiness_Animations.fbx");
        if (model == null) throw new InvalidOperationException("SIMUS character missing");
        var template = new GameObject("SIMUS Animated NPC Template");
        var character = UnityEngine.Object.Instantiate(model, template.transform);
        foreach (var t in character.GetComponentsInChildren<Transform>(true))
        {
            if (t.name.StartsWith("HAIR_") && t.name != "HAIR_ROOT") t.gameObject.SetActive(t.name == "HAIR_01_PARTED_SHORT");
            if (t.name.StartsWith("GLASSES_")) t.gameObject.SetActive(false);
        }
        var renderers = character.GetComponentsInChildren<Renderer>();
        var bounds = renderers[0].bounds;
        foreach (var r in renderers) bounds.Encapsulate(r.bounds);
        character.transform.localScale *= 1.7f / bounds.size.y;
        bounds = renderers[0].bounds;
        foreach (var r in renderers) bounds.Encapsulate(r.bounds);
        character.transform.position -= new Vector3(bounds.center.x, bounds.min.y, bounds.center.z);
        character.transform.localRotation = Quaternion.identity;
        var animator = character.GetComponent<Animator>();
        animator.runtimeAnimatorController = AssetDatabase.LoadAssetAtPath<RuntimeAnimatorController>(CompletedMapFollowSetup.Output + "/TestNpcWalk.controller");
        animator.applyRootMotion = false;
        template.SetActive(false);
        bridge.npcTemplate = template;
        Directory.CreateDirectory("Assets/SIMUS/Scenes/bridge_test");
        EditorSceneManager.SaveScene(scene, "Assets/SIMUS/Scenes/bridge_test/simus_bridge_test.unity");
    }

    [MenuItem("SIMUS/Bridge/Build test WebGL")]
    public static void Build()
    {
        if (!BuildPipeline.IsBuildTargetSupported(BuildTargetGroup.WebGL, BuildTarget.WebGL))
            throw new InvalidOperationException("Install Unity 6000.3.24f1 WebGL Build Support before building.");
        CreateScene();
        var output = Environment.GetEnvironmentVariable("SIMUS_BRIDGE_OUTPUT") ?? "Builds/bridge_test/city";
        var oldTemplate = PlayerSettings.WebGL.template;
        var oldCompression = PlayerSettings.WebGL.compressionFormat;
        try
        {
            PlayerSettings.WebGL.template = "PROJECT:simus_city";
            PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Disabled;
            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions {
                scenes = new[] { "Assets/SIMUS/Scenes/bridge_test/simus_bridge_test.unity" },
                locationPathName = output, target = BuildTarget.WebGL, options = BuildOptions.Development
            });
            if (report.summary.result != BuildResult.Succeeded) throw new InvalidOperationException("WebGL build failed: " + report.summary.result);
            File.WriteAllText(Path.Combine(output, "build.json"), "{\"protocol_version\":1,\"map_version\":\"" + WebCityBridge.TestMapVersion + "\"}\n");
        }
        finally { PlayerSettings.WebGL.template = oldTemplate; PlayerSettings.WebGL.compressionFormat = oldCompression; }
    }
}
