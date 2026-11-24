using System;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using Newtonsoft.Json.Linq;
using Simus;
using Simus.City;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;

// Local validation build. The reviewed scene and source Build Settings stay on disk.
public static class CityMasterplanV003LocalBuild
{
    public const string ScenePath = "Assets/SIMUS/Scenes/city_masterplan_v003/CityMasterplan_v003_EventPlaces.unity";
    public const string MapVersion = "city-masterplan-v003-local-v1";
    public const string PathVersion = "city-masterplan-v003-plaza30-v1";
    private const string CharacterPath = "Assets/SIMUS/Art/characters/modular_hairfix_v001/models/SIMUS_Modular_Character_Happiness_Animations.fbx";
    private const string ControllerPath = "Assets/SIMUS/Scenes/npc_follow_test/TestNpcWalk.controller";
    private const string TemporaryScene = "Assets/SIMUS/Scenes/city_masterplan_v003/CityMasterplan_v003_LocalRuntime.unity";
    private const float Speed = 1.4f;

    // Unity raycasts measured each waypoint on the stored v003 walking surface.
    private static readonly Vector3[] Points = {
        new Vector3(44.35f, .202832f, 65),
        new Vector3(44.35f, .301893f, 72),
        new Vector3(44.35f, .412014f, 79)
    };

    private static string ReportPath => Environment.GetEnvironmentVariable("SIMUS_V003_AUDIT_OUTPUT") ?? "Logs/v003-local-physics.json";

    private static string Hash(string path)
    {
        using (var sha = SHA256.Create())
            return BitConverter.ToString(sha.ComputeHash(File.ReadAllBytes(path))).Replace("-", "").ToLowerInvariant();
    }

    private static string Hierarchy(Transform transform)
    {
        return transform.parent == null ? transform.name : Hierarchy(transform.parent) + "/" + transform.name;
    }

    public static void Audit()
    {
        var scene = EditorSceneManager.OpenScene(ScenePath);
        Physics.SyncTransforms();
        var samples = new JArray();
        var blocked = new JArray();
        var passed = true;
        for (var leg = 0; leg < Points.Length - 1; leg++)
        {
            for (var index = 0; index <= 28; index++)
            {
                var point = Vector3.Lerp(Points[leg], Points[leg + 1], index / 28f);
                var hits = Physics.RaycastAll(point + Vector3.up * 2, Vector3.down, 4,
                        Physics.DefaultRaycastLayers, QueryTriggerInteraction.Ignore)
                    .Where(hit => hit.normal.y > .5f)
                    .OrderBy(hit => Mathf.Abs(hit.point.y - point.y)).ToArray();
                var supported = hits.Length > 0 && Mathf.Abs(hits[0].point.y - point.y) < .3f;
                samples.Add(new JObject {
                    ["point"] = new JArray(point.x, point.y, point.z),
                    ["supported"] = supported,
                    ["surface"] = hits.Length > 0 ? Hierarchy(hits[0].transform) : null,
                    ["surface_y"] = hits.Length > 0 ? (double?)hits[0].point.y : null
                });
                if (!supported) passed = false;
                if (supported) point.y = hits[0].point.y + .02f;
                // Match NpcGrounding, keeping the capsule above the actual sloped floor.
                var overlaps = Physics.OverlapCapsule(point + Vector3.up * .38f,
                    point + Vector3.up * 1.45f, .28f, Physics.DefaultRaycastLayers, QueryTriggerInteraction.Ignore);
                foreach (var collider in overlaps)
                {
                    blocked.Add(new JObject {
                        ["point"] = new JArray(point.x, point.y, point.z),
                        ["collider"] = Hierarchy(collider.transform)
                    });
                    passed = false;
                }
            }
        }
        var anchors = new JArray(scene.GetRootGameObjects()
            .SelectMany(root => root.GetComponentsInChildren<Transform>(true))
            .Where(transform => transform.name.StartsWith("FULL_EVENT_30_") || transform.name == "EVS_30")
            .Select(transform => new JObject {
                ["path"] = Hierarchy(transform),
                ["position"] = new JArray(transform.position.x, transform.position.y, transform.position.z)
            }));
        var distance = Points.Zip(Points.Skip(1), Vector3.Distance).Sum();
        var report = new JObject {
            ["source_scene"] = ScenePath, ["source_scene_sha256"] = Hash(ScenePath),
            ["map_version"] = MapVersion, ["path_version"] = PathVersion,
            ["passed"] = passed, ["samples"] = samples,
            ["blocking_capsule_overlaps"] = blocked, ["anchors"] = anchors,
            ["route_distance_m"] = distance, ["speed_mps"] = Speed,
            ["nominal_travel_seconds"] = distance / Speed
        };
        Directory.CreateDirectory(Path.GetDirectoryName(ReportPath));
        File.WriteAllText(ReportPath, report.ToString());
        Debug.Log("V003_LOCAL_PHYSICS " + passed + " " + ReportPath);
        if (!passed) throw new InvalidOperationException("Representative route failed physical audit. Inspect the JSON report.");
    }

    private static GameObject CreateParticipantTemplate()
    {
        var character = AssetDatabase.LoadAssetAtPath<GameObject>(CharacterPath);
        if (character == null) throw new InvalidOperationException("Validated Happiness character FBX is missing.");
        var template = new GameObject("SIMUS animated participant template");
        var model = (GameObject)PrefabUtility.InstantiatePrefab(character);
        model.transform.SetParent(template.transform, false);
        CitizenCharacterAppearance.Apply(template, "npc_01");
        var renderers = model.GetComponentsInChildren<Renderer>();
        var bounds = renderers[0].bounds;
        foreach (var renderer in renderers) bounds.Encapsulate(renderer.bounds);
        model.transform.localScale *= 1.7f / bounds.size.y;
        bounds = renderers[0].bounds;
        foreach (var renderer in renderers) bounds.Encapsulate(renderer.bounds);
        model.transform.position -= new Vector3(bounds.center.x, bounds.min.y, bounds.center.z);
        // Use the same Humanoid axis correction as the existing follow setup.
        model.transform.localRotation = Quaternion.identity;
        var animator = model.GetComponent<Animator>();
        if (animator == null) animator = model.AddComponent<Animator>();
        animator.avatar = AssetDatabase.LoadAllAssetsAtPath(CharacterPath).OfType<Avatar>().FirstOrDefault();
        animator.runtimeAnimatorController = AssetDatabase.LoadAssetAtPath<RuntimeAnimatorController>(ControllerPath);
        if (animator.avatar == null || animator.runtimeAnimatorController == null)
            throw new InvalidOperationException("Humanoid avatar/walking controller missing.");
        animator.applyRootMotion = false;
        template.SetActive(false);
        return template;
    }

    public static void Build()
    {
        Audit();
        if (!BuildPipeline.IsBuildTargetSupported(BuildTargetGroup.WebGL, BuildTarget.WebGL))
            throw new InvalidOperationException("Install Unity 6000.3.24f1 Web Build Support.");
        var scene = EditorSceneManager.GetActiveScene();
        // Web deployments must poll their own origin, never a desktop localhost port.
        foreach (var poller in UnityEngine.Object.FindObjectsByType<CityStatePoller>(FindObjectsSortMode.None))
        {
            var settings = new SerializedObject(poller);
            settings.FindProperty("serverBaseUrl").stringValue = "";
            settings.ApplyModifiedPropertiesWithoutUndo();
        }
        foreach (var camera in UnityEngine.Object.FindObjectsByType<Camera>(FindObjectsSortMode.None))
            camera.enabled = false;
        var cameraObject = new GameObject("Local participant camera");
        cameraObject.tag = "MainCamera";
        cameraObject.AddComponent<Camera>().farClipPlane = 1500;
        var follow = cameraObject.AddComponent<CityPreviewCamera>();
        follow.previewControls = false;
        follow.followSize = 9;
        follow.followPitch = 45;
        follow.followYaw = -35;
        follow.target = Points[0];
        follow.overviewTarget = Points[0];
        follow.overviewSize = 9;
        follow.smoothFollowTransitions = true;
        // Keep facades solid, including while following a participant.
        follow.enableBuildingTransparency = false;
        follow.contextBuildingFade = false;
        follow.occlusionShader = null;
        var bridge = new GameObject("SIMUS Web Bridge").AddComponent<WebCityBridge>();
        bridge.mapVersion = MapVersion;
        bridge.followCamera = follow;
        bridge.npcTemplate = CreateParticipantTemplate();
        if (File.Exists(TemporaryScene)) throw new InvalidOperationException("Temporary scene exists. Refusing overwrite.");
        var output = Environment.GetEnvironmentVariable("SIMUS_V003_WEBGL_OUTPUT") ?? "Builds/city_masterplan_v003_local";
        var oldTemplate = PlayerSettings.WebGL.template;
        var oldCompression = PlayerSettings.WebGL.compressionFormat;
        var oldInitialMemory = PlayerSettings.WebGL.initialMemorySize;
        var oldMaximumMemory = PlayerSettings.WebGL.maximumMemorySize;
        var oldGrowthMode = PlayerSettings.WebGL.memoryGrowthMode;
        var oldRunInBackground = PlayerSettings.runInBackground;
        try
        {
            EditorSceneManager.SaveScene(scene, TemporaryScene);
            PlayerSettings.WebGL.template = "PROJECT:simus_city";
            PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Disabled;
            // The city must initialize inside the WASM heap before scene buffers can grow it.
            PlayerSettings.WebGL.initialMemorySize = 512;
            PlayerSettings.WebGL.maximumMemorySize = 2048;
            PlayerSettings.WebGL.memoryGrowthMode = WebGLMemoryGrowthMode.Geometric;
            // DOM event buttons live outside the iframe and can take its input focus.
            // Explicit VISIBILITY messages still suspend hidden-page polling/rendering.
            PlayerSettings.runInBackground = true;
            var result = BuildPipeline.BuildPlayer(new BuildPlayerOptions {
                scenes = new[] { TemporaryScene }, locationPathName = output,
                target = BuildTarget.WebGL, options = BuildOptions.None
            });
            if (result.summary.result != BuildResult.Succeeded)
                throw new InvalidOperationException("v003 WebGL build failed.");
            File.WriteAllText(Path.Combine(output, "build.json"), new JObject {
                ["kind"] = "city-masterplan-v003-local-session", ["protocol_version"] = 1,
                ["map_version"] = MapVersion, ["path_versions"] = new JArray(PathVersion),
                ["source_scene_sha256"] = Hash(ScenePath), ["npc_motion_enabled"] = true,
                ["route_validation_status"] = "unity_physics_passed", ["exhibition_ready"] = false,
                ["initial_memory_mb"] = 512, ["maximum_memory_mb"] = 2048,
                ["memory_growth"] = "geometric", ["run_in_background"] = true,
                ["building_transparency"] = false
            }.ToString());
        }
        finally
        {
            PlayerSettings.WebGL.template = oldTemplate;
            PlayerSettings.WebGL.compressionFormat = oldCompression;
            PlayerSettings.WebGL.initialMemorySize = oldInitialMemory;
            PlayerSettings.WebGL.maximumMemorySize = oldMaximumMemory;
            PlayerSettings.WebGL.memoryGrowthMode = oldGrowthMode;
            PlayerSettings.runInBackground = oldRunInBackground;
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene);
            AssetDatabase.DeleteAsset(TemporaryScene);
        }
    }
}
