using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEngine;

namespace Simus
{
    /// <summary>Explicit Play Mode verification only; never serialized into the working scene.</summary>
    [DefaultExecutionOrder(200)]
    public sealed class CityV002RiverRuntimeVerification : MonoBehaviour
    {
        [Serializable] public sealed class RouteResult
        {
            public string id, status, error;
            public int frames, samples, waterViolations, unsupported, blocked, rejectedSteps, arrivals;
            public float length, moved, maximumGroundError;
            public string[] edges;
            public List<string> firstFailures = new List<string>();
        }
        [Serializable] public sealed class Results
        {
            public string status = "RUNNING", sceneSha256, unityVersion;
            public string scope = "Actual Unity Editor Play Mode; retained FBX actors, TestNpcPatrol and NpcGrounding; timeScale 8 for route verification only. No NavMesh or crowd-performance claim.";
            public float elapsedWallSeconds, routeTimeScale = 8;
            public int runtimeErrors;
            public bool directWaterCrossingRejected, underwaterBridgeRejected, bridgeDeckAllowed, waterAppearancePassed, sharedMaterialUnchanged;
            public List<RouteResult> routes = new List<RouteResult>();
            public List<string> captures = new List<string>();
        }
        public string sceneSha256;
        public event Action<bool> Completed;
        public Results evidence = new Results();
        const string Folder = "../docs/verification/city-rebuild-v002-river-captures";
        const string Output = "../docs/verification/city-rebuild-v002-river-runtime-results.json";
        readonly List<CityV002NpcRouteAdapter> actors = new List<CityV002NpcRouteAdapter>();
        readonly List<Vector3> previous = new List<Vector3>();
        readonly HashSet<int> completedSampled = new HashSet<int>();
        CityV002RiverArea river;
        float started, originalScale;
        bool sampling;

        void Awake()
        {
            started = Time.realtimeSinceStartup; originalScale = Time.timeScale;
            evidence.sceneSha256 = sceneSha256; evidence.unityVersion = Application.unityVersion;
            Application.logMessageReceived += OnLog;
        }
        void OnLog(string message, string stack, LogType type)
        { if (type == LogType.Error || type == LogType.Exception || type == LogType.Assert) evidence.runtimeErrors++; }
        void OnDestroy() { Application.logMessageReceived -= OnLog; Time.timeScale = originalScale; }

        IEnumerator Start()
        {
            Directory.CreateDirectory(Folder);
            yield return null;
            evidence.sceneSha256 = sceneSha256;
            river = FindFirstObjectByType<CityV002RiverArea>();
            var graph = FindFirstObjectByType<CityV002PedestrianGraph>();
            var existing = FindObjectsByType<CityV002NpcRouteAdapter>(FindObjectsSortMode.None).Where(a => a.routeId != null && a.routeId.StartsWith("river_")).ToArray();
            if (river == null || graph == null || existing.Length < 3) { Finish(false, "Required river/graph/three probes missing"); yield break; }
            var oldMonitor = FindFirstObjectByType<CityV002NavigationVerification>(); if (oldMonitor != null) oldMonitor.enabled = false;
            foreach (var a in existing) AddActor(a);
            for (int i = 0; i < river.bridgeStarts.Length; i++)
            {
                var clone = Instantiate(existing[0].gameObject); clone.name = "Runtime_Bridge_Probe_" + i;
                var a = clone.GetComponent<CityV002NpcRouteAdapter>(); a.startAutomatically = false;
                a.routeId = "bridge_" + i + "_roundtrip"; a.startNode = "RIVER_BRIDGE_" + i + "_A"; a.destinationNode = "RIVER_BRIDGE_" + i + "_B";
                AddActor(a);
            }
            // Negative checks across the midstream and underneath an otherwise valid bridge.
            int mid = river.centreline.Length / 2;
            var c = river.centreline[mid]; var tangent = (river.centreline[mid+1] - river.centreline[mid-1]).normalized;
            var n = new Vector3(-tangent.z, 0, tangent.x);
            evidence.directWaterCrossingRejected = !river.SegmentSafe(c - n*10 + Vector3.up*.16f, c + n*10 + Vector3.up*.16f);
            var ba = river.bridgeStarts[0]; var bb = river.bridgeEnds[0]; ba.y = bb.y = -1.2f;
            evidence.underwaterBridgeRejected = !river.SegmentSafe(ba, bb);
            ba.y = bb.y = .16f; evidence.bridgeDeckAllowed = river.SegmentSafe(ba, bb);

            var water = river.GetComponentInChildren<CityV002RiverWater>();
            var material = water.waterRenderer.sharedMaterial; var originalColor = material.color;
            bool follow = water.followCityState; float initialPollution = water.pollution; water.followCityState = false;
            var block = new MaterialPropertyBlock();
            water.SetPollution(0); water.waterRenderer.GetPropertyBlock(block); var clean = block.GetColor("_Color"); float gloss = block.GetFloat("_Glossiness");
            Capture("river-overview-clean.png", new Vector3(230, 160, -100), new Vector3(127, 0, 76), 111);
            Capture("river-bank-clean-close.png", new Vector3(150, 15, 37), new Vector3(120, -.7f, 62), 28);
            Capture("river-bridge-detail.png", new Vector3(146, 12, -13), new Vector3(123, -.4f, 10), 23);
            water.SetPollution(100); water.waterRenderer.GetPropertyBlock(block); var dirty = block.GetColor("_Color"); float dirtyGloss = block.GetFloat("_Glossiness");
            Capture("river-bank-polluted-close.png", new Vector3(150, 15, 37), new Vector3(120, -.7f, 62), 28);
            water.SetPollution(50); water.waterRenderer.GetPropertyBlock(block);
            evidence.waterAppearancePassed = clean != dirty && gloss > dirtyGloss && Vector4.Distance(block.GetColor("_Color"), Color.Lerp(clean, dirty, .5f)) < .001f;
            evidence.sharedMaterialUnchanged = water.waterRenderer.sharedMaterial == material && material.color == originalColor;
            water.SetPollution(initialPollution); water.followCityState = follow;
            Capture("river-top.png", new Vector3(127, 180, 76), new Vector3(127, 0, 76), 105);
            Time.timeScale = 8; sampling = true;
            float limit = Time.realtimeSinceStartup + 180;
            while (actors.Any(a => !a.Completed) && Time.realtimeSinceStartup < limit)
            { yield return null; if (Time.frameCount % 300 == 0) Save(); }
            yield return null;
            sampling = false; Time.timeScale = originalScale;
            for (int i = 0; i < actors.Count; i++)
            {
                var a = actors[i]; var r = evidence.routes[i]; var guard = a.GetComponent<CityV002RiverGuard>();
                r.arrivals = a.ArrivalCount; r.rejectedSteps = guard != null ? guard.rejectedSteps : -1; r.length = a.Length; r.edges = a.RouteEdges; r.error = a.Error;
                r.status = a.Completed && a.ArrivalCount == 2 && r.waterViolations == 0 && r.unsupported == 0 && r.blocked == 0 && r.rejectedSteps == 0 && r.frames > 0 ? "PASS" : "FAIL";
            }
            bool pass = evidence.routes.All(r => r.status == "PASS") && evidence.directWaterCrossingRejected && evidence.underwaterBridgeRejected && evidence.bridgeDeckAllowed && evidence.waterAppearancePassed && evidence.sharedMaterialUnchanged && evidence.runtimeErrors == 0;
            Finish(pass, pass ? "PASS" : "Runtime route or water verification failed");
        }

        void AddActor(CityV002NpcRouteAdapter actor)
        {
            actor.returnToStart = true; actor.GetComponent<TestNpcPatrol>().speed = 1.4f;
            actor.BeginRoute(); var guard = actor.GetComponent<CityV002RiverGuard>();
            if (guard != null) { guard.ResetSafePosition(actor.transform.position); guard.rejectedSteps = 0; }
            actors.Add(actor); previous.Add(actor.transform.position); evidence.routes.Add(new RouteResult { id = actor.routeId, status = "RUNNING" });
        }
        void Failure(RouteResult r, string value) { if (r.firstFailures.Count < 8 && !r.firstFailures.Contains(value)) r.firstFailures.Add(value); }
        void LateUpdate()
        {
            if (!sampling) return;
            for (int i = 0; i < actors.Count; i++)
            {
                var a = actors[i]; var r = evidence.routes[i]; if (completedSampled.Contains(i)) continue;
                var p = a.transform.position; r.frames++; r.moved += Vector3.Distance(previous[i], p);
                int count = Mathf.Max(1, Mathf.CeilToInt(Vector3.Distance(previous[i], p) / .2f));
                for (int k = 1; k <= count; k++)
                {
                    var q = Vector3.Lerp(previous[i], p, k/(float)count); r.samples++;
                    if (river.IsForbidden(q)) { r.waterViolations++; Failure(r, "Water entry " + q); }
                    var hits = Physics.RaycastAll(q + Vector3.up*.5f, Vector3.down, 2f, Physics.DefaultRaycastLayers, QueryTriggerInteraction.Ignore)
                    .Where(h => h.normal.y > .5f && h.collider.GetComponentInParent<TestNpcPatrol>() == null).ToArray();
                float error = hits.Length == 0 ? 999 : hits.Min(h => Mathf.Abs(h.point.y + .02f - q.y));
                r.maximumGroundError = Mathf.Max(r.maximumGroundError, error);
                if (error > .06f) { r.unsupported++; Failure(r, "Ground mismatch " + error + " at " + q); }
                var obstacles = Physics.OverlapCapsule(q + Vector3.up*.25f, q + Vector3.up*1.5f, .2f, Physics.DefaultRaycastLayers, QueryTriggerInteraction.Ignore)
                    .Where(c => c.GetComponentInParent<TestNpcPatrol>() == null && c.bounds.max.y > q.y + .18f).ToArray();
                if (obstacles.Length > 0) { r.blocked++; Failure(r, "Capsule " + string.Join(",", obstacles.Select(c => c.name)) + " at " + q); }
                }
                previous[i] = p;
                if (a.Completed) completedSampled.Add(i);
            }
        }
        void Capture(string name, Vector3 position, Vector3 target, float size)
        {
            var go = new GameObject("River_Runtime_Capture"); var camera = go.AddComponent<Camera>();
            camera.orthographic = true; camera.orthographicSize = size; camera.nearClipPlane = .1f; camera.farClipPlane = 800;
            camera.backgroundColor = new Color(.78f, .83f, .82f); camera.clearFlags = CameraClearFlags.SolidColor;
            go.transform.position = position; go.transform.LookAt(target, (position-target).normalized == Vector3.up ? Vector3.forward : Vector3.up);
            var rt = new RenderTexture(1800, 1400, 24); var old = RenderTexture.active; camera.targetTexture = rt;
            camera.Render(); RenderTexture.active = rt; var image = new Texture2D(1800, 1400, TextureFormat.RGB24, false);
            image.ReadPixels(new Rect(0, 0, 1800, 1400), 0, 0); image.Apply(); File.WriteAllBytes(Path.Combine(Folder, name), image.EncodeToPNG());
            camera.targetTexture = null; RenderTexture.active = old; rt.Release(); Destroy(image); Destroy(rt); Destroy(go);
            evidence.captures.Add(Path.Combine(Folder, name));
        }
        void Save() { evidence.elapsedWallSeconds = Time.realtimeSinceStartup - started; File.WriteAllText(Output, JsonUtility.ToJson(evidence, true)); }
        void Finish(bool pass, string detail) { sampling = false; evidence.status = pass ? "PASS" : "FAIL: " + detail; Save(); Debug.Log("CITY_V002_RIVER_RUNTIME " + evidence.status); Completed?.Invoke(pass); }
    }
}
