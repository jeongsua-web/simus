using System;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using Simus;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;

// Separate map-only and session builds. Neither establishes exhibition approval.
public static class CityRebuildV002WebGLBuild
{
    public const string MapVersion = "test-only-city-rebuild-v002-phase1-v1";
    public const string PathVersion = "city-rebuild-v002-walk-phase1-v1";

    [MenuItem("SIMUS/City Rebuild v002/Build map-only WebGL")]
    public static void Build()
    {
        BuildVersion(false);
    }

    [MenuItem("SIMUS/City Rebuild v002/Build session WebGL")]
    public static void BuildSession()
    {
        BuildVersion(true);
    }

    private static void BuildVersion(bool sessionEnabled)
    {
        var output = Path.GetFullPath(Environment.GetEnvironmentVariable("SIMUS_V002_WEBGL_OUTPUT") ??
            (sessionEnabled ? "Builds/city_rebuild_v002_phase1_session" : "Builds/city_rebuild_v002_phase1_map"));
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
            var graph = scene.GetRootGameObjects().SelectMany(root => root.GetComponentsInChildren<CityV002PedestrianGraph>(true)).Single();
            if (graph.mapVersion != MapVersion || graph.pathVersion != PathVersion)
                throw new InvalidOperationException("The scene graph and Phase 1 build identifiers differ.");
            string sceneHash;
            using (var sha = SHA256.Create())
                sceneHash = BitConverter.ToString(sha.ComputeHash(File.ReadAllBytes(CityRebuildV002Setup.ScenePath))).Replace("-", "").ToLowerInvariant();
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
            var roles = roots.SelectMany(root => root.GetComponentsInChildren<CityV002NpcBuildRole>(true)).ToArray();
            var templateRoles = roles.Where(r => r.role == CityV002NpcBuildRole.Role.ParticipantTemplate).ToArray();
            if (templateRoles.Length != 1) throw new InvalidOperationException("Exactly one explicitly marked participant template is required.");
            foreach (var patrol in patrols)
            {
                var role = patrol.GetComponent<CityV002NpcBuildRole>();
                if (role == null || role.role == CityV002NpcBuildRole.Role.Unassigned)
                    throw new InvalidOperationException("NPC build role missing: " + patrol.name + ". No actor was inferred from traversal order.");
            }
            var verifications = roots.SelectMany(root => root.GetComponentsInChildren<CityV002NavigationVerification>(true)).ToArray();
            foreach (var verification in verifications) UnityEngine.Object.DestroyImmediate(verification);
            foreach (var adapter in adapters)
            {
                var role = adapter.GetComponent<CityV002NpcBuildRole>();
                if (role == null || role.role == CityV002NpcBuildRole.Role.Unassigned)
                    throw new InvalidOperationException("Route-adapter build role missing: " + adapter.name);
                if (role.role != CityV002NpcBuildRole.Role.Environment) UnityEngine.Object.DestroyImmediate(adapter);
            }
            var participant = templateRoles[0].gameObject;
            foreach (var role in roles)
                if (role.role == CityV002NpcBuildRole.Role.TestProbe) UnityEngine.Object.DestroyImmediate(role.gameObject);
            GameObject npcTemplate = null;
            if (sessionEnabled)
            {
                npcTemplate = participant;
                foreach (var patrol in participant.GetComponents<TestNpcPatrol>()) UnityEngine.Object.DestroyImmediate(patrol);
                npcTemplate.name = "SIMUS Animated NPC Template";
                npcTemplate.transform.position = Vector3.zero;
                npcTemplate.transform.rotation = Quaternion.identity;
                npcTemplate.SetActive(false);
            }
            else UnityEngine.Object.DestroyImmediate(participant);
            // Environment citizens, the heavy carrier and static/special NPCs retain their
            // existing components and activation. No participant identity is assigned to them.
            if (sessionEnabled && npcTemplate == null) throw new InvalidOperationException("Animated NPC template missing.");
            var bridge = new GameObject("SIMUS Web Bridge").AddComponent<WebCityBridge>();
            bridge.mapVersion = MapVersion;
            bridge.followCamera = camera;
            bridge.mapDisplayOnly = !sessionEnabled;
            bridge.npcTemplate = npcTemplate;
            EditorSceneManager.SaveScene(scene, temporaryScene);
            PlayerSettings.WebGL.template = "PROJECT:simus_city";
            PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Disabled;
            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions {
                scenes = new[] { temporaryScene }, locationPathName = output,
                target = BuildTarget.WebGL, options = BuildOptions.None
            });
            if (report.summary.result != BuildResult.Succeeded) throw new InvalidOperationException("CityRebuild_v002 WebGL failed: " + report.summary.result);
            File.WriteAllText(Path.Combine(output, "build.json"), sessionEnabled
                ? "{\"protocol_version\":1,\"map_version\":\"" + MapVersion + "\",\"kind\":\"city-rebuild-v002-session\",\"path_versions\":[\"" + PathVersion + "\"],\"source_scene_sha256\":\"" + sceneHash + "\",\"npc_motion_enabled\":true,\"exhibition_ready\":false}\n"
                : "{\"protocol_version\":1,\"map_version\":\"" + MapVersion + "\",\"kind\":\"city-rebuild-v002-map-only\",\"source_scene_sha256\":\"" + sceneHash + "\",\"npc_motion_enabled\":false,\"exhibition_ready\":false}\n");
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
