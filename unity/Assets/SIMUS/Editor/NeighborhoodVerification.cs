#if UNITY_EDITOR
using System;
using System.IO;
using System.Linq;
using Simus.City;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

[InitializeOnLoad]
public static class NeighborhoodVerification
{
    private static double began;
    private static double observed;
    private static float elapsed;
    private static int stage;
    private static string expectedJson;
    private static CityStatePoller poller;
    private static NeighborhoodLife life;

    static NeighborhoodVerification()
    {
        if (Application.isBatchMode && Environment.GetCommandLineArgs().Contains("-simusVerifyHttp"))
            EditorApplication.update += Tick;
    }

    public static void Run()
    {
        EditorSceneManager.OpenScene(NeighborhoodIntegration.ScenePath);
        var target = UnityEngine.Object.FindFirstObjectByType<CityStatePoller>();
        var settings = new SerializedObject(target);
        settings.FindProperty("serverBaseUrl").stringValue = Environment.GetEnvironmentVariable("SIMUS_TEST_URL");
        settings.ApplyModifiedPropertiesWithoutUndo();
        EditorApplication.EnterPlaymode();
    }

    private static void Tick()
    {
        if (!EditorApplication.isPlaying) return;
        try
        {
            var now = EditorApplication.timeSinceStartup;
            if (began == 0) began = now;
            if (now - began > 40) throw new Exception("Timed out waiting for integrated live API/Play mode");
            if (poller == null)
            {
                poller = UnityEngine.Object.FindFirstObjectByType<CityStatePoller>();
                life = poller.GetComponent<NeighborhoodLife>();
                expectedJson = File.ReadAllText(Environment.GetEnvironmentVariable("SIMUS_TEST_SNAPSHOT"));
            }
            var city = poller.Store.Current;
            if (stage == 0 && city != null && poller.Store.Connection == CityConnection.Connected)
            {
                var expected = CityStateJson.Parse(expectedJson).CityState;
                if (city.SessionId != expected.SessionId || city.Version != expected.Version ||
                    city.Happiness != expected.Happiness || city.Cleanliness != expected.Cleanliness)
                    throw new Exception("Live Unity snapshot differs from PostgreSQL API");
                observed = now; elapsed = life.Elapsed; stage = 1;
            }
            if (stage == 1 && now - observed > 1)
            {
                if (life.Elapsed <= elapsed) throw new Exception("Preview NPC did not move in RUNNING");
                poller.StopAllCoroutines();
                var finalized = CityStateJson.Parse(expectedJson.Replace("\"status\":\"RUNNING\"", "\"status\":\"FINALIZED\""));
                if (!poller.Store.Apply(finalized, Time.realtimeSinceStartupAsDouble, out var error)) throw new Exception(error);
                observed = now; elapsed = life.Elapsed; stage = 2;
            }
            if (stage == 2 && now - observed > 1)
            {
                if (life.Elapsed != elapsed) throw new Exception("Preview NPC moved after FINALIZED");
                if (poller.Store.Apply(CityStateJson.Parse(expectedJson), Time.realtimeSinceStartupAsDouble, out _))
                    throw new Exception("Finalized snapshot regressed to RUNNING");
                Debug.Log("SIMUS_INTEGRATED_PLAY_PASS: actual PostgreSQL HTTP snapshot; preview movement; injected FINALIZED freeze/regression rejection");
                EditorApplication.Exit(0);
            }
        }
        catch (Exception error) { Debug.LogException(error); EditorApplication.Exit(1); }
    }
}
#endif
