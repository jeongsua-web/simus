using System;
using System.IO;
using System.Security.Cryptography;
using System.Linq;
using Newtonsoft.Json.Linq;
using Simus;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

[InitializeOnLoad]
public static class CityRebuildV002RiverVerification
{
    const string Pending = "SIMUS.RiverVerification.Pending";
    const string ExitPending = "SIMUS.RiverVerification.Exit";
    const string HashKey = "SIMUS.RiverVerification.Hash";
    const string StartedKey = "SIMUS.RiverVerification.StartedTicks";
    const string AssetsKey = "SIMUS.RiverVerification.AssetHashes";
    static CityRebuildV002RiverVerification()
    {
        EditorApplication.playModeStateChanged += OnPlay;
        EditorApplication.update += Watchdog;
    }

    [MenuItem("SIMUS/City Rebuild v002/Verify River in Play Mode")]
    public static void Run()
    {
        if (EditorApplication.isPlayingOrWillChangePlaymode) throw new InvalidOperationException("Start in Edit Mode.");
        EditorSceneManager.OpenScene(CityRebuildV002Setup.ScenePath);
        using (var sha = SHA256.Create()) SessionState.SetString(HashKey, BitConverter.ToString(sha.ComputeHash(File.ReadAllBytes(CityRebuildV002Setup.ScenePath))).Replace("-", "").ToLowerInvariant());
        var files = Directory.GetFiles(CityRebuildV002Setup.Folder + "/river_meshes", "*.asset")
            .Concat(Directory.GetFiles(CityRebuildV002Setup.Folder + "/river_materials", "*.mat"))
            .Concat(Directory.GetFiles("Assets/SIMUS/Art/props/river_footbridge_v001/models", "*.fbx"))
            .Concat(Directory.GetFiles("Assets/Scripts", "CityV002River*.cs"))
            .Concat(Directory.GetFiles("Assets/Editor", "CityRebuildV002River*.cs"))
            .Concat(new[] {CityRebuildV002Setup.ScenePath, "../docs/planning/city_rebuild_v002/river-design.json", "Assets/Scripts/CityV002NpcRouteAdapter.cs", "Assets/Scripts/NpcGrounding.cs", "Assets/Scripts/TestNpcPatrol.cs", "Assets/Scripts/RiverTrailSurface.shader"});
        var hashes = new JObject(); foreach (var path in files) hashes[path] = Hash(path);
        SessionState.SetString(AssetsKey, hashes.ToString());
        SessionState.SetBool(Pending, true); SessionState.SetInt(ExitPending, -1);
        SessionState.SetString(StartedKey, DateTime.UtcNow.Ticks.ToString());
        EditorApplication.isPlaying = true;
    }
    static void OnPlay(PlayModeStateChange state)
    {
        if (state == PlayModeStateChange.EnteredPlayMode && SessionState.GetBool(Pending, false))
        {
            SessionState.SetBool(Pending, false);
            var runner = new GameObject("River_RuntimeOnly_Verifier").AddComponent<CityV002RiverRuntimeVerification>();
            runner.sceneSha256 = SessionState.GetString(HashKey, "");
            runner.Completed += pass => { SessionState.SetInt(ExitPending, pass ? 0 : 1); EditorApplication.delayCall += () => EditorApplication.isPlaying = false; };
        }
        else if (state == PlayModeStateChange.EnteredEditMode && SessionState.GetInt(ExitPending, -1) >= 0)
        {
            int code = SessionState.GetInt(ExitPending, -1); SessionState.SetInt(ExitPending, -1);
            var hashes = JObject.Parse(SessionState.GetString(AssetsKey, "{}")); var changed = new JArray();
            foreach (var entry in hashes.Properties()) if (!File.Exists(entry.Name) || Hash(entry.Name) != (string)entry.Value) changed.Add(entry.Name);
            File.WriteAllText("../docs/verification/city-rebuild-v002-river-runtime-inputs.json", new JObject { ["status"] = changed.Count == 0 ? "UNCHANGED_DURING_PLAY" : "FAIL_CHANGED", ["files"] = hashes, ["changed"] = changed }.ToString());
            if (changed.Count > 0) code = 3;
            SessionState.EraseString(StartedKey);
            if (Application.isBatchMode) EditorApplication.Exit(code);
        }
    }
    static string Hash(string path)
    { using (var sha = SHA256.Create()) return BitConverter.ToString(sha.ComputeHash(File.ReadAllBytes(path))).Replace("-", "").ToLowerInvariant(); }
    static void Watchdog()
    {
        if (!long.TryParse(SessionState.GetString(StartedKey, ""), out long ticks)) return;
        if ((DateTime.UtcNow - new DateTime(ticks, DateTimeKind.Utc)).TotalSeconds < 240) return;
        SessionState.EraseString(StartedKey); SessionState.SetBool(Pending, false);
        Debug.LogError("CITY_V002_RIVER_RUNTIME_TIMEOUT: runner failed to finish within 240 seconds.");
        if (Application.isBatchMode) EditorApplication.Exit(2);
        else EditorApplication.isPlaying = false;
    }
}
