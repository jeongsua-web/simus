using System;
using System.IO;
using System.Linq;
using Newtonsoft.Json.Linq;
using Simus;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

/// <summary>File request bridge for the already open editor; never edits build settings or source scenes.</summary>
[InitializeOnLoad]
public static class CityRebuildV002Phase47Bridge
{
    const string Request = "/tmp/simus-v002-phase47-request.txt";
    const string Status = "/tmp/simus-v002-phase47-status.json";
    const string Pending = "Simus.V002.Phase47.Pending";
    static double nextPoll;
    static CityRebuildV002Phase47Bridge()
    {
        EditorApplication.update += Poll;
        EditorApplication.playModeStateChanged += OnPlayState;
    }
    static void Write(string state, string detail) => File.WriteAllText(Status, new JObject { ["state"] = state, ["detail"] = detail, ["utc"] = DateTime.UtcNow.ToString("o") }.ToString());
    static void Poll()
    {
        if (EditorApplication.timeSinceStartup < nextPoll || EditorApplication.isCompiling || EditorApplication.isUpdating) return;
        nextPoll = EditorApplication.timeSinceStartup + .5;
        if (!File.Exists(Request)) return;
        string command = File.ReadAllText(Request).Trim(); if (command.Length == 0) return;
        File.WriteAllText(Request, "");
        try
        {
            if (EditorApplication.isPlayingOrWillChangePlaymode) throw new InvalidOperationException("Request requires stopped Edit Mode.");
            if (command == "apply")
            {
                Write("APPLYING", "Phase 4 / Phase 5 / Phase 6 scene camera settings");
                CityRebuildV002Phase4Setup.Apply();
                CityRebuildV002NavigationSetup.Apply();
                ApplyCamera();
                CityRebuildV002SurfaceAudit.Run();
                Write("APPLIED", CityRebuildV002Setup.ScenePath);
            }
            else if (command == "run")
            {
                EditorSceneManager.OpenScene(CityRebuildV002Setup.ScenePath);
                FocusGameView();
                SessionState.SetBool(Pending, true);
                Write("ENTERING_PLAY_MODE", "Actual editor runtime verification; accelerated routes, real-time performance samples");
                EditorApplication.isPlaying = true;
            }
            else throw new InvalidOperationException("Unknown phase47 command " + command);
        }
        catch (Exception ex) { SessionState.SetBool(Pending, false); Debug.LogException(ex); Write("FAIL", ex.ToString()); }
    }

    [MenuItem("SIMUS/City Rebuild v002/Apply Phase 6 Camera Settings")]
    public static void ApplyCamera()
    {
        if (EditorApplication.isPlayingOrWillChangePlaymode) throw new InvalidOperationException("Configure camera in Edit Mode.");
        var scene = EditorSceneManager.OpenScene(CityRebuildV002Setup.ScenePath);
        var preview = UnityEngine.Object.FindFirstObjectByType<CityPreviewCamera>();
        if (preview == null) throw new InvalidOperationException("Preserved CityPreviewCamera missing.");
        var before = Settings(preview);
        preview.maximumZoom = 350f;
        preview.overviewSize = 260f; preview.topViewSize = 235f;
        preview.occlusionRoot = GameObject.Find("CityRebuild_v002").transform;
        preview.previewSubtitle = "CITY REBUILD v002 | RUNTIME PREVIEW";
        preview.Overview();
        EditorSceneManager.SaveScene(scene, CityRebuildV002Setup.ScenePath); AssetDatabase.SaveAssets();
        Directory.CreateDirectory("../docs/verification");
        File.WriteAllText("../docs/verification/city-rebuild-v002-camera-settings.json", new JObject {
            ["before"] = before, ["after"] = Settings(preview),
            ["cause"] = "Existing Update zoom clamp of 170m shrank the approved 260m overview; configurable maximum defaults to the original 170m in other scenes.",
            ["occlusion_fix"] = "Optional occlusionRoot points to CityRebuild_v002; default legacy map lookup remains unchanged.",
            ["runtime_validation"] = "NOT TESTED until phase6-runtime.json exists" }.ToString());
    }
    static JObject Settings(CityPreviewCamera p) => new JObject { ["overviewSize"] = p.overviewSize, ["topViewSize"] = p.topViewSize, ["maximumZoom"] = p.maximumZoom,
        ["followSize"] = p.followSize, ["followPitch"] = p.followPitch, ["followYaw"] = p.followYaw, ["overviewTarget"] = new JArray(p.overviewTarget.x,p.overviewTarget.y,p.overviewTarget.z), ["occlusionRoot"] = p.occlusionRoot != null ? p.occlusionRoot.name : null };
    static void OnPlayState(PlayModeStateChange state)
    {
        if (state == PlayModeStateChange.EnteredPlayMode && SessionState.GetBool(Pending, false))
        {
            FocusGameView();
            SessionState.SetBool(Pending, false);
            var runner = new GameObject("Phase47_RuntimeOnly_Verification").AddComponent<CityV002Phase6Verification>();
            runner.Completed += detail => { Write("COMPLETE", detail); EditorApplication.delayCall += () => EditorApplication.isPlaying = false; };
            Write("RUNNING", "Route round trips then camera captures and 1/100/500/1000 NPC samples");
        }
    }
    static void FocusGameView()
    {
        var type = typeof(Editor).Assembly.GetType("UnityEditor.GameView");
        if (type != null) EditorWindow.GetWindow(type).Focus();
    }
}
