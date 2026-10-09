using System;
using System.Linq;
using Simus;
using UnityEditor;
using UnityEditor.Animations;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

public static class CompletedMapFollowSetup
{
    private const string Root = "Assets/SIMUS/";
    public const string Output = Root + "Scenes/npc_follow_test";
    public const string ScenePath = Output + "/CompletedMapNpcFollow.unity";
    private const string MapPath = Root + "Art/maps/university_v003/SIMUS_Dense_Realistic_University_Map_03.fbx";
    private const string CharacterPath = Root + "Art/characters/modular_hairfix_v001/models/SIMUS_Modular_Character_Happiness_Animations.fbx";

    [MenuItem("SIMUS/Build Completed Map NPC Follow Test")]
    public static void Build()
    {
        if (!Application.isBatchMode && !EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;
        var importer = (ModelImporter)AssetImporter.GetAtPath(CharacterPath);
        if (importer == null || importer.animationType != ModelImporterAnimationType.Human)
            throw new InvalidOperationException("Happiness character must retain its validated Humanoid import settings.");
        var mapAsset = AssetDatabase.LoadAssetAtPath<GameObject>(MapPath);
        var characterAsset = AssetDatabase.LoadAssetAtPath<GameObject>(CharacterPath);
        if (mapAsset == null || characterAsset == null) throw new InvalidOperationException("Completed map/character FBX is not imported.");
        EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        var map = (GameObject)PrefabUtility.InstantiatePrefab(mapAsset);
        map.name = "SIMUS Completed Map 03";
        // Use a real sidewalk surface from this FBX, never the old prototype coordinates.
        var surfaces = map.GetComponentsInChildren<MeshFilter>().Where(f =>
            (f.name.IndexOf("SIDEWALK", StringComparison.OrdinalIgnoreCase) >= 0 ||
             f.name.StartsWith("D03_UNITY_D03_WALK_", StringComparison.Ordinal)) &&
            f.GetComponent<Renderer>() != null).OrderByDescending(f =>
                Mathf.Max(f.GetComponent<Renderer>().bounds.size.x, f.GetComponent<Renderer>().bounds.size.z));
        Vector3 start = default, end = default;
        string surfaceName = null;
        foreach (var surface in surfaces)
        {
            var bounds = surface.GetComponent<Renderer>().bounds;
            float length = Mathf.Max(bounds.size.x, bounds.size.z);
            if (length < 8f || bounds.size.y > 1f) continue;
            var axis = bounds.size.x > bounds.size.z ? Vector3.right : Vector3.forward;
            var collider = surface.GetComponent<MeshCollider>();
            if (collider == null) collider = surface.gameObject.AddComponent<MeshCollider>();
            collider.sharedMesh = surface.sharedMesh;
            Physics.SyncTransforms();
            start = bounds.center - axis * Mathf.Min(10f, length * 0.3f);
            end = bounds.center + axis * Mathf.Min(10f, length * 0.3f);
            bool supported = true;
            for (int i = 0; i <= 40; i++)
            {
                var point = Vector3.Lerp(start, end, i / 40f);
                if (!collider.Raycast(new Ray(point + Vector3.up * 5f, Vector3.down), out var hit, 10f)) { supported = false; break; }
                if (i == 0) start.y = hit.point.y + 0.02f;
                if (i == 40) end.y = hit.point.y + 0.02f;
            }
            if (supported) { surfaceName = surface.name; break; }
        }
        if (surfaceName == null)
        {
            System.IO.Directory.CreateDirectory("Logs");
            System.IO.File.WriteAllLines("Logs/CompletedMapMeshBounds.txt", map.GetComponentsInChildren<Renderer>()
                .Select(r => r.name + " | " + r.bounds));
            throw new InvalidOperationException("No supported sidewalk test segment found; inspect Logs/CompletedMapMeshBounds.txt.");
        }
        var route = new GameObject("Camera test segment (not exhibition NPC route)");
        var a = new GameObject("Start").transform; a.SetParent(route.transform); a.position = start;
        var b = new GameObject("End").transform; b.SetParent(route.transform); b.position = end;
        var npc = new GameObject("Test NPC - Happiness 01");
        npc.transform.position = start;
        var model = (GameObject)PrefabUtility.InstantiatePrefab(characterAsset);
        model.transform.SetParent(npc.transform, false);
        foreach (var t in model.GetComponentsInChildren<Transform>(true))
        {
            if (t.name.StartsWith("HAIR_") && t.name != "HAIR_ROOT")
                t.gameObject.SetActive(t.name == "HAIR_01_PARTED_SHORT");
            if (t.name.StartsWith("GLASSES_")) t.gameObject.SetActive(false);
        }
        var renderers = model.GetComponentsInChildren<Renderer>();
        var bodyBounds = renderers[0].bounds;
        foreach (var renderer in renderers) bodyBounds.Encapsulate(renderer.bounds);
        model.transform.localScale *= 1.7f / bodyBounds.size.y;
        bodyBounds = renderers[0].bounds;
        foreach (var renderer in renderers) bodyBounds.Encapsulate(renderer.bounds);
        model.transform.position += new Vector3(start.x - bodyBounds.center.x, start.y - bodyBounds.min.y, start.z - bodyBounds.center.z);
        // Humanoid clips use Unity Y-up; do not retain the imported FBX root tilt.
        // Keep the rest-pose scale measurement above, then orient the animated model.
        model.transform.localRotation = Quaternion.identity;
        var walk = AssetDatabase.LoadAllAssetsAtPath(CharacterPath).OfType<AnimationClip>()
            .FirstOrDefault(c => c.name == "NEUTRAL_WALK");
        if (walk == null) throw new InvalidOperationException("NEUTRAL_WALK clip is missing.");
        if (walk != null)
        {
            string controllerPath = Output + "/TestNpcWalk.controller";
            var controller = AssetDatabase.LoadAssetAtPath<AnimatorController>(controllerPath);
            if (controller == null) controller = AnimatorController.CreateAnimatorControllerAtPath(controllerPath);
            if (controller.layers.Length == 0) controller.AddLayer("Base Layer");
            var machine = controller.layers[0].stateMachine;
            var state = machine.states.Length == 0 ? machine.AddState("Walk") : machine.states[0].state;
            state.name = "NEUTRAL_WALK"; state.motion = walk; machine.defaultState = state;
            EditorUtility.SetDirty(controller);
            var animator = model.GetComponent<Animator>();
            if (animator == null) animator = model.AddComponent<Animator>();
            animator.avatar = AssetDatabase.LoadAllAssetsAtPath(CharacterPath).OfType<Avatar>().FirstOrDefault();
            animator.runtimeAnimatorController = controller;
            animator.applyRootMotion = false;
        }
        var patrol = npc.AddComponent<TestNpcPatrol>(); patrol.startPoint = a; patrol.endPoint = b;
        var cameraObject = new GameObject("Main Camera"); cameraObject.tag = "MainCamera";
        var camera = cameraObject.AddComponent<Camera>(); camera.farClipPlane = 1000f;
        camera.clearFlags = CameraClearFlags.SolidColor; camera.backgroundColor = new Color(0.56f, 0.70f, 0.78f);
        var follow = cameraObject.AddComponent<CityPreviewCamera>();
        follow.followTarget = npc.transform; follow.followNpcId = "";
        follow.followSize = 12.75089f;
        follow.followPitch = 28.85f; follow.followYaw = -131.64f;
        follow.occlusionShader = Shader.Find("SIMUS/NPC Reveal"); follow.followSmoothTime = 0.25f;
        follow.previewSubtitle = "COMPLETED MAP 03 | TEST NPC 01";
        follow.target = start + follow.followOffset;
        camera.orthographic = true; camera.orthographicSize = follow.followSize;
        cameraObject.transform.rotation = Quaternion.Euler(follow.followPitch, follow.followYaw, 0);
        cameraObject.transform.position = follow.target - cameraObject.transform.forward * 360f;
        var light = new GameObject("Sun").AddComponent<Light>(); light.type = LightType.Directional;
        light.intensity = 1.2f; light.transform.rotation = Quaternion.Euler(50, -30, 0);
        RenderSettings.ambientLight = new Color(0.65f, 0.65f, 0.65f);
        EditorSceneManager.SaveScene(SceneManager.GetActiveScene(), ScenePath);
        EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) }
            .Concat(EditorBuildSettings.scenes.Where(s => s.path != ScenePath).Select(s => new EditorBuildSettingsScene(s.path, false))).ToArray();
        AssetDatabase.SaveAssets();
        Debug.Log($"COMPLETED_MAP_FOLLOW_READY: surface={surfaceName}; start={start}; end={end}; follow={follow.followTarget.name}; walk={walk?.name}");
    }
}
