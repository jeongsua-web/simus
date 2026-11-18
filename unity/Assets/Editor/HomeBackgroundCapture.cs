using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using Simus.City;
using Simus.HomeBackground;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using Object = UnityEngine.Object;

// Run in an isolated project or use the menu. Never saves the source city scene.
public static class HomeBackgroundCapture
{
    public const string Source = "Assets/SIMUS/Scenes/city_masterplan_v003/CityMasterplan_v003_EventPlaces.unity";
    public const string Scene = "Assets/SIMUS/Scenes/home_background/HomeBackground.unity";
    const string Character = "Assets/SIMUS/Art/characters/modular_hairfix_v001/models/SIMUS_Modular_Character_Happiness_Animations.fbx";
    const string Controller = "Assets/SIMUS/Scenes/npc_follow_test/TestNpcWalk.controller";
    static string Output => Environment.GetEnvironmentVariable("SIMUS_HOME_CAPTURE_OUTPUT") ?? Path.GetFullPath("Logs/HomeBackgroundCapture");

    [MenuItem("SIMUS/Home Background/1 Create filming scene")]
    public static void Create()
    {
        if (!Application.isBatchMode && !EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;
        if (File.Exists(Scene)) throw new InvalidOperationException("Filming scene exists. Open it to capture, or move it aside before recreating.");
        var scene = EditorSceneManager.OpenScene(Source);
        // Strip runtime behaviours from this in-memory copy before Play Mode.
        foreach (var root in scene.GetRootGameObjects())
        {
            foreach (var behaviour in root.GetComponentsInChildren<MonoBehaviour>(true))
                if (behaviour != null && behaviour.GetType().Name != "QualityViewProfile") Object.DestroyImmediate(behaviour);
            foreach (var canvas in root.GetComponentsInChildren<Canvas>(true)) canvas.gameObject.SetActive(false);
            foreach (var label in root.GetComponentsInChildren<TextMesh>(true)) label.gameObject.SetActive(false);
            foreach (var audio in root.GetComponentsInChildren<AudioSource>(true)) Object.DestroyImmediate(audio);
            foreach (var listener in root.GetComponentsInChildren<AudioListener>(true)) Object.DestroyImmediate(listener);
        }
        foreach (var camera in Object.FindObjectsByType<Camera>(FindObjectsSortMode.None)) camera.enabled = false;
        var view = new GameObject("Home Background Camera").AddComponent<Camera>();
        view.tag = "MainCamera"; view.orthographic = true; view.orthographicSize = 255;
        view.aspect = 16f / 9; view.farClipPlane = 2000;
        view.clearFlags = CameraClearFlags.SolidColor; view.backgroundColor = new Color(.82f, .84f, .81f);
        view.transform.rotation = Quaternion.Euler(48, -35, 0);
        view.transform.position = new Vector3(12, 0, 42) - view.transform.forward * 800;
        var motion = new GameObject("Filming only - local 12 second loop").AddComponent<HomeBackgroundMotion>();
        // CityClientBootstrap otherwise creates a network client in every unknown scene.
        // Its existing presence check sees this disabled component; it never polls.
        new GameObject("Disabled bootstrap guard - no network").AddComponent<CityStatePoller>().enabled = false;
        Physics.SyncTransforms();
        string routes = Environment.GetEnvironmentVariable("SIMUS_HOME_ROUTES") ?? Path.GetFullPath("../docs/planning/city_masterplan_v003/routes.json");
        var nodes = (JArray)JObject.Parse(File.ReadAllText(routes))["nodes"];
        var walkers = new List<HomeBackgroundMotion.Walker>();
        foreach (var node in nodes)
        {
            if (walkers.Count >= 48) break;
            var p = node["position"].ToObject<float[]>();
            var from = new Vector3(p[0], p[1], p[2]);
            // Short segments on the existing saved walking surfaces only.
            var axis = walkers.Count % 2 == 0 ? Vector3.right : Vector3.forward;
            var to = from + axis * 6;
            bool supported = true;
            for (int i = 0; i <= 12; i++)
            {
                var point = Vector3.Lerp(from, to, i / 12f);
                var hit = Physics.RaycastAll(point + Vector3.up * 2, Vector3.down, 4)
                    .Where(h => h.normal.y > .8f && (h.transform.name.ToUpperInvariant().Contains("WALK") || h.transform.name.ToUpperInvariant().Contains("PATH")))
                    .OrderBy(h => Mathf.Abs(h.point.y - point.y)).FirstOrDefault();
                if (hit.collider == null) { supported = false; break; }
                point.y = hit.point.y + .03f;
                if (Physics.OverlapCapsule(point + Vector3.up * .4f, point + Vector3.up * 1.4f, .25f)
                    .Any(c => c != hit.collider && !c.isTrigger)) { supported = false; break; }
                if (i == 0) from.y = point.y;
                if (i == 12) to.y = point.y;
            }
            if (!supported) continue;
            var actor = new GameObject("Filming citizen " + walkers.Count);
            actor.transform.SetParent(motion.transform);
            var model = (GameObject)PrefabUtility.InstantiatePrefab(AssetDatabase.LoadAssetAtPath<GameObject>(Character));
            model.transform.SetParent(actor.transform, false);
            CitizenCharacterAppearance.Apply(model, "npc_" + (walkers.Count % 16 + 1).ToString("D2"));
            var renderers = model.GetComponentsInChildren<Renderer>();
            var bounds = renderers[0].bounds;
            foreach (var renderer in renderers) bounds.Encapsulate(renderer.bounds);
            model.transform.localScale *= 1.7f / bounds.size.y;
            bounds = renderers[0].bounds;
            foreach (var renderer in renderers) bounds.Encapsulate(renderer.bounds);
            model.transform.position -= new Vector3(bounds.center.x, bounds.min.y, bounds.center.z);
            model.transform.localRotation = Quaternion.identity;
            var animator = model.GetComponent<Animator>();
            animator.avatar = AssetDatabase.LoadAllAssetsAtPath(Character).OfType<Avatar>().First();
            animator.runtimeAnimatorController = AssetDatabase.LoadAssetAtPath<RuntimeAnimatorController>(Controller);
            animator.applyRootMotion = false; animator.cullingMode = AnimatorCullingMode.AlwaysAnimate;
            walkers.Add(new HomeBackgroundMotion.Walker { actor = actor.transform, from = from, to = to, phase = walkers.Count * .137f, animator = animator });
        }
        if (walkers.Count == 0) throw new InvalidOperationException("No safe existing sidewalk segments found.");
        motion.walkers = walkers.ToArray();
        // Existing R06/R07/R02 road block; identical taxis exchange places at the loop boundary.
        motion.road = new[] { new Vector3(-65, .08f, -60), new Vector3(135, .08f, -60), new Vector3(145, .08f, -49), new Vector3(145, .08f, -94), new Vector3(-65, .08f, -94) };
        var taxi = GameObject.Find("EVS_12_taxi_v001");
        if (taxi != null)
        {
            motion.cars = Enumerable.Range(0, 6).Select(i => {
                var car = Object.Instantiate(taxi, motion.transform); car.name = "Filming taxi " + i;
                foreach (var collider in car.GetComponentsInChildren<Collider>()) Object.DestroyImmediate(collider);
                return car.transform;
            }).ToArray();
        }
        motion.Evaluate(0);
        Directory.CreateDirectory(Path.GetDirectoryName(Scene));
        EditorSceneManager.SaveScene(scene, Scene);
        Debug.Log($"HOME_BACKGROUND_SCENE walkers={walkers.Count} cars={motion.cars.Length}");
    }

    [MenuItem("SIMUS/Home Background/2 Capture 1080p frames")]
    public static void Capture()
    {
        if (!Application.isBatchMode && !EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;
        EditorSceneManager.OpenScene(Scene);
        var motion = Object.FindFirstObjectByType<HomeBackgroundMotion>();
        var view = GameObject.Find("Home Background Camera").GetComponent<Camera>();
        Directory.CreateDirectory(Output);
        var rt = new RenderTexture(1920, 1080, 24) { antiAliasing = 2 };
        var pixels = new Texture2D(1920, 1080, TextureFormat.RGB24, false);
        var previous = RenderTexture.active;
        try
        {
            view.aspect = 16f / 9; view.targetTexture = rt;
            foreach (var walker in motion.walkers) { walker.animator.Rebind(); walker.animator.Update(0); }
            int count = Environment.GetEnvironmentVariable("SIMUS_HOME_PREVIEW") == "1" ? 1 : 360;
            for (int frame = 0; frame < count; frame++)
            {
                motion.Evaluate(frame / 30f);
                view.Render(); RenderTexture.active = rt;
                pixels.ReadPixels(new Rect(0, 0, 1920, 1080), 0, 0); pixels.Apply();
                File.WriteAllBytes(Path.Combine(Output, $"frame-{frame:D4}.jpg"), pixels.EncodeToJPG(95));
                if (frame % 30 == 0) Debug.Log("HOME_BACKGROUND_FRAME " + frame);
            }
            motion.Evaluate(0);
            var start = motion.walkers.Select(w => w.actor.position).ToArray();
            motion.Evaluate(12);
            float error = motion.walkers.Select((w, i) => Vector3.Distance(start[i], w.actor.position)).Max();
            File.WriteAllText(Path.Combine(Output, "capture.json"), new JObject {
                ["source_scene"] = Source, ["filming_scene"] = Scene, ["width"] = 1920, ["height"] = 1080,
                ["fps"] = 30, ["frames"] = count, ["walkers"] = motion.walkers.Length, ["cars"] = motion.cars.Length,
                ["walker_loop_position_error_m"] = error, ["audio"] = false, ["server_dependencies"] = false
            }.ToString());
        }
        finally { view.targetTexture = null; RenderTexture.active = previous; rt.Release(); Object.DestroyImmediate(rt); Object.DestroyImmediate(pixels); }
        Debug.Log("HOME_BACKGROUND_CAPTURE_COMPLETE " + Output);
    }

    public static void CreateAndCapture() { Create(); Capture(); }

    // Batch entry point: omit -quit; exit only after actual Play Mode movement.
    public static void VerifyPlay()
    {
        if (!Application.isBatchMode) throw new InvalidOperationException("Use this verification entry point in an isolated batch project.");
        EditorSceneManager.OpenScene(Environment.GetEnvironmentVariable("SIMUS_HOME_VERIFY_SCENE") ?? Scene);
        var previousOptions = EditorSettings.enterPlayModeOptions;
        var previousEnabled = EditorSettings.enterPlayModeOptionsEnabled;
        EditorSettings.enterPlayModeOptionsEnabled = true;
        EditorSettings.enterPlayModeOptions = EnterPlayModeOptions.DisableDomainReload;
        EditorApplication.playModeStateChanged += state => {
            if (state != PlayModeStateChange.EnteredPlayMode) return;
            var motion = Object.FindFirstObjectByType<HomeBackgroundMotion>();
            var start = motion.walkers[0].actor.position;
            var carStart = motion.cars[0].position;
            var tour = Object.FindFirstObjectByType<HomeBackgroundTour>();
            var cameraStart = tour != null ? tour.transform.position : Vector3.zero;
            double began = EditorApplication.timeSinceStartup;
            EditorApplication.CallbackFunction check = null;
            check = () => {
                if (EditorApplication.timeSinceStartup - began < 3) return;
                EditorApplication.update -= check;
                bool moved = Vector3.Distance(start, motion.walkers[0].actor.position) > .1f;
                bool carsMoved = Vector3.Distance(carStart,motion.cars[0].position) > .1f;
                bool cameraMoved = tour == null || Vector3.Distance(cameraStart,tour.transform.position) > .1f;
                var unexpected = Object.FindObjectsByType<MonoBehaviour>(FindObjectsSortMode.None)
                    .Where(b => b != null && b.isActiveAndEnabled && b.GetType().Assembly.GetName().Name != "UnityEngine.TestRunner" && b.GetType().Name != "HomeBackgroundMotion" && b.GetType().Name != "HomeBackgroundTour" && b.GetType().Name != "QualityViewProfile")
                    .Select(b => b.GetType().FullName + " on " + b.name).ToArray();
                bool isolated = unexpected.Length == 0;
                Directory.CreateDirectory(Output);
                File.WriteAllText(Path.Combine(Output, "playmode.json"), new JObject {
                    ["entered_play_mode"] = true, ["walker_moved"] = moved,
                    ["cars_moved"] = carsMoved, ["camera_moved"] = cameraMoved,
                    ["only_filming_behaviours"] = isolated, ["walkers"] = motion.walkers.Length,
                    ["cars"] = motion.cars.Length, ["unexpected_scene_behaviours"] = new JArray(unexpected)
                }.ToString());
                Debug.Log($"HOME_BACKGROUND_PLAYMODE moved={moved} isolated={isolated}");
                EditorSettings.enterPlayModeOptions = previousOptions;
                EditorSettings.enterPlayModeOptionsEnabled = previousEnabled;
                EditorApplication.Exit(moved && carsMoved && cameraMoved && isolated ? 0 : 1);
            };
            EditorApplication.update += check;
        };
        EditorApplication.isPlaying = true;
    }
}
