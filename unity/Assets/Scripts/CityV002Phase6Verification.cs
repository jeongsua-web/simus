using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEngine;
using UnityEngine.Profiling;
using Unity.Profiling;

namespace Simus
{
    /// <summary>Explicitly instantiated in Play Mode by the editor bridge. No serialized stress actors.</summary>
    [DefaultExecutionOrder(200)]
    public sealed class CityV002Phase6Verification : MonoBehaviour
    {
        [Serializable] public sealed class CameraSample
        {
            public string mode, status, capture, notes;
            public int frames, targetOffscreenFrames, groundBelowFrames, occludedFrames, revealFrames;
            public float maximumFollowCenterError, minimumNpcY;
        }
        [Serializable] public sealed class PerformanceSample
        {
            public int npcCount, frames, activeAnimators, activeGrounding, activePatrols, activeGraphAdapters;
            public int sceneActivePatrols, movingActors;
            public float minimumActorMovement, totalActorMovement;
            public string status, measurementScope;
            public float wallSeconds, framesPerSecond, averageFrameMs, p95FrameMs, editorProcessCpuMsPerFrame, mainThreadProfilerMeanMs;
            public long unityAllocatedBytes, unityReservedBytes, processWorkingSetBytes;
        }
        [Serializable] public sealed class Results
        {
            public string scope = "Unity Editor actual Play Mode, Camera.Render from the active Game camera; no editor inspection or animation sampling";
            public string unityVersion, runtimeStatus, navigationFile, logFile;
            public string performanceScope = "Editor on this machine, actual FBX skinned NPC + Animator + TestNpcPatrol + NpcGrounding + graph waypoint adapter. Not a player/WebGL/production crowd benchmark; no crowd avoidance or event/backend workload.";
            public float routeTimeScale, routeWallSeconds, elapsedWallSeconds;
            public int compileErrors, runtimeErrors, warnings, largeTriangleWarnings;
            public int performanceVSyncCount, performanceTargetFrameRate;
            public CameraSample[] cameras;
            public PerformanceSample[] performance;
        }
        public event Action<string> Completed;
        const string Folder = "../docs/verification/city-rebuild-v002-captures";
        const string ResultPath = "../docs/verification/city-rebuild-v002-phase6-runtime.json";
        const string LogPath = "../docs/verification/city-rebuild-v002-logs/phase47-playmode.log";
        Results evidence;
        CityPreviewCamera preview;
        Camera view;
        CityV002NavigationVerification navigation;
        float started;
        bool previousRunInBackground;
        int previousVSync, previousTargetFrameRate;
        bool navigationPassed;
        readonly List<string> logs = new List<string>();
        readonly List<CameraSample> cameraSamples = new List<CameraSample>();
        readonly List<PerformanceSample> performanceSamples = new List<PerformanceSample>();
        CameraSample activeFollow;
        Transform activeFollowTarget;
        void LateUpdate() { if (activeFollow != null && activeFollowTarget != null) SampleFollow(activeFollow, activeFollowTarget); }

        void Awake()
        {
            started = Time.realtimeSinceStartup;
            previousRunInBackground = Application.runInBackground; Application.runInBackground = true;
            previousVSync = QualitySettings.vSyncCount; previousTargetFrameRate = Application.targetFrameRate;
            evidence = new Results { unityVersion = Application.unityVersion, runtimeStatus = "RUNNING", logFile = LogPath };
            Application.logMessageReceived += OnLog;
        }
        void OnLog(string message, string stack, LogType type)
        {
            if (type == LogType.Error || type == LogType.Exception || type == LogType.Assert) evidence.runtimeErrors++;
            if (type == LogType.Warning) evidence.warnings++;
            if (message.IndexOf("500", StringComparison.OrdinalIgnoreCase) >= 0 && message.IndexOf("triangle", StringComparison.OrdinalIgnoreCase) >= 0) evidence.largeTriangleWarnings++;
            logs.Add(DateTime.UtcNow.ToString("o") + " " + type + " " + message + (type == LogType.Exception ? "\n" + stack : ""));
        }
        IEnumerator Start()
        {
            Directory.CreateDirectory(Folder); Directory.CreateDirectory(Path.GetDirectoryName(LogPath));
            preview = FindFirstObjectByType<CityPreviewCamera>(); navigation = FindFirstObjectByType<CityV002NavigationVerification>();
            if (preview == null || navigation == null) { Finish("FAIL: required camera/navigation monitor missing"); yield break; }
            view = preview.GetComponent<Camera>();
            // Event/production simulation code remains unchanged. Only local test route clocks are accelerated.
            Time.timeScale = 20f; evidence.routeTimeScale = Time.timeScale;
            preview.Overview(); yield return new WaitForSecondsRealtime(1);
            Capture("overview-game-playmode.png");
            cameraSamples.Add(new CameraSample { mode = "isometric overview", status = Mathf.Abs(view.orthographicSize - 260f) < 1f ? "PASS" : "FAIL", capture = "overview-game-playmode.png", notes = "Actual Play Mode Game camera, overviewSize260 with maximumZoom350; visual readability reviewed separately.", frames = 1 });
            preview.TopView(); yield return new WaitForSecondsRealtime(.3f); Capture("top-view-game-playmode.png");
            cameraSamples.Add(new CameraSample { mode = "top view", status = Mathf.Abs(view.orthographicSize - 235f) < 1f ? "PASS" : "FAIL", capture = "top-view-game-playmode.png", frames = 1 });
            preview.Overview(); preview.target = new Vector3(143, 0, 65); view.orthographicSize = 68;
            preview.previewControls = false;
            // Explicit close inspection uses the same camera, without changing serialized preview settings.
            view.transform.position = new Vector3(143,0,65) - view.transform.forward * 360; Capture("park-game-playmode.png"); preview.previewControls = true;
            var actor = navigation.actors[0]; preview.SetFollowTarget(actor.transform);
            var follow = new CameraSample { mode = "moving NPC follow", status = "RUNNING", minimumNpcY = float.PositiveInfinity, notes = "Viewport center + ground position checked while the preserved route actor moves; occlusion rays recorded alongside active reveal materials." };
            float routeStarted = Time.realtimeSinceStartup, captureAt = routeStarted + 3;
            bool captured = false;
            activeFollow = follow; activeFollowTarget = actor.transform;
            while (!navigation.AllArrived && Time.realtimeSinceStartup - routeStarted < 240)
            {
                yield return null;
                if (!captured && Time.realtimeSinceStartup >= captureAt) { Capture("npc-follow-game-playmode.png"); follow.capture = "npc-follow-game-playmode.png"; captured = true; }
                if (Time.frameCount % 180 == 0) Save("RUNNING");
            }
            activeFollow = null;
            if (!captured) { Capture("npc-follow-game-playmode.png"); follow.capture = "npc-follow-game-playmode.png"; }
            evidence.routeWallSeconds = Time.realtimeSinceStartup - routeStarted;
            follow.status = follow.targetOffscreenFrames == 0 && follow.groundBelowFrames == 0 && follow.frames > 0 ? "PASS" : "FAIL"; cameraSamples.Add(follow);
            evidence.navigationFile = "../docs/verification/city-rebuild-v002-navigation-runtime.json";
            File.WriteAllText(evidence.navigationFile, navigation.EvidenceJson());
            navigationPassed = navigation.AllArrived && navigation.Evidence.routes.All(r => r.status == "PASS");
            Debug.Log("CITY_V002_ROUTE_RUNTIME_COMPLETE arrived=" + navigation.AllArrived + " elapsed_wall=" + evidence.routeWallSeconds);
            Time.timeScale = 1f; navigation.enabled = false;
            foreach (var a in navigation.actors) a.gameObject.SetActive(false);
            var apartmentActor = Instantiate(actor.gameObject); apartmentActor.name = "ApartmentFollow_RuntimeOnly";
            var apartmentRoute = apartmentActor.GetComponent<CityV002NpcRouteAdapter>(); apartmentRoute.startNode = "B16_ACCESS"; apartmentRoute.destinationNode = "B04_ACCESS";
            apartmentActor.SetActive(true); preview.SetFollowTarget(apartmentActor.transform);
            yield return new WaitForSecondsRealtime(.5f);
            var apartment = new CameraSample { mode = "residential apartment NPC follow", status = "RUNNING", minimumNpcY = float.PositiveInfinity, notes = "B16 exterior approach; world-space building occlusion ray plus retained NPC reveal shader. Human visual review required for final readability." };
            float followStarted = Time.realtimeSinceStartup;
            activeFollow = apartment; activeFollowTarget = apartmentActor.transform;
            while (Time.realtimeSinceStartup - followStarted < 2) yield return null;
            activeFollow = null;
            Capture("npc-follow-apartment-game-playmode.png"); apartment.capture = "npc-follow-apartment-game-playmode.png";
            apartment.status = apartment.targetOffscreenFrames == 0 && apartment.groundBelowFrames == 0 ? "PASS" : "FAIL"; cameraSamples.Add(apartment);
            Destroy(apartmentActor); yield return null;
            preview.Overview();
            QualitySettings.vSyncCount = 0; Application.targetFrameRate = -1;
            evidence.performanceVSyncCount = QualitySettings.vSyncCount; evidence.performanceTargetFrameRate = Application.targetFrameRate;
            foreach (int count in new[] { 1, 100, 500, 1000 }) yield return Performance(actor.gameObject, count);
            foreach (var a in navigation.actors) a.gameObject.SetActive(true);
            preview.SetFollowTarget(actor.transform); Time.timeScale = 1;
            Finish(evidence.runtimeErrors == 0 && evidence.largeTriangleWarnings == 0 && navigationPassed && cameraSamples.All(c => c.status == "PASS") && performanceSamples.All(p => p.status.StartsWith("PASS")) ? "COMPLETE" : "FAIL: route/camera/performance check or runtime log errors; inspect evidence");
        }
        void SampleFollow(CameraSample sample, Transform target)
        {
            sample.frames++; sample.minimumNpcY = Mathf.Min(sample.minimumNpcY, target.position.y);
            var viewport = view.WorldToViewportPoint(target.position + preview.followOffset);
            if (viewport.z <= 0 || viewport.x < 0 || viewport.x > 1 || viewport.y < 0 || viewport.y > 1) sample.targetOffscreenFrames++;
            sample.maximumFollowCenterError = Mathf.Max(sample.maximumFollowCenterError, Vector2.Distance(new Vector2(viewport.x, viewport.y), new Vector2(.5f, .5f)));
            if (target.position.y < -.04f) sample.groundBelowFrames++;
            var delta = target.position + Vector3.up - view.transform.position;
            bool occluded = Physics.RaycastAll(view.transform.position, delta.normalized, delta.magnitude, Physics.DefaultRaycastLayers, QueryTriggerInteraction.Ignore).Any(h => h.transform.IsChildOf(preview.occlusionRoot) && (h.transform.IsChildOf(preview.occlusionRoot.Find("06_CampusBuildings_14")) || h.transform.IsChildOf(preview.occlusionRoot.Find("08_ExternalBuildings_55"))));
            if (occluded) sample.occludedFrames++;
            if (FindFirstObjectByType<NpcOcclusionReveal>() != null) sample.revealFrames++;
        }
        IEnumerator Performance(GameObject source, int count)
        {
            var group = new GameObject("Performance_" + count + "_RuntimeOnly");
            var graph = source.GetComponent<CityV002NpcRouteAdapter>().graph;
            var starts = new[] { "CAMPUS_PLAZA", "B04_ACCESS", "B16_ACCESS", "PARK_REST_2" };
            var ends = new[] { "B04_ACCESS", "B16_ACCESS", "PARK_REST_2", "CAMPUS_PLAZA" };
            for (int i = 0; i < count; i++)
            {
                var npc = Instantiate(source, group.transform); npc.name = "PerfNPC_" + i;
                var route = npc.GetComponent<CityV002NpcRouteAdapter>(); route.graph = graph; route.startNode = starts[i % 4]; route.destinationNode = ends[i % 4]; route.routeId = "perf_" + i;
                npc.SetActive(true);
            }
            yield return new WaitForSecondsRealtime(2);
            var sample = new PerformanceSample { npcCount = count, status = "RUNNING", measurementScope = "Uncapped Editor Game loop, timeScale1; 2 seconds warmup + 5 seconds sampled; editor process CPU and memory include editor overhead; active NPCs include animation and grounding" };
            sample.activeAnimators = group.GetComponentsInChildren<Animator>().Count(a => a.isActiveAndEnabled);
            sample.activeGrounding = group.GetComponentsInChildren<NpcGrounding>().Count(a => a.isActiveAndEnabled);
            sample.activePatrols = group.GetComponentsInChildren<TestNpcPatrol>().Count(a => a.isActiveAndEnabled);
            sample.activeGraphAdapters = group.GetComponentsInChildren<CityV002NpcRouteAdapter>().Count(a => a.isActiveAndEnabled);
            sample.sceneActivePatrols = FindObjectsByType<TestNpcPatrol>(FindObjectsSortMode.None).Count(a => a.isActiveAndEnabled);
            var actors = group.GetComponentsInChildren<CityV002NpcRouteAdapter>();
            var positions = actors.Select(a => a.transform.position).ToArray(); var movements = new float[actors.Length];
            var process = System.Diagnostics.Process.GetCurrentProcess(); double cpuStart = process.TotalProcessorTime.TotalMilliseconds;
            var times = new List<float>(); float begun = Time.realtimeSinceStartup, previous = begun;
            using (var mainThread = ProfilerRecorder.StartNew(ProfilerCategory.Internal, "Main Thread", 1))
            {
                double mainTotal = 0; int mainSamples = 0;
                while (Time.realtimeSinceStartup - begun < 5)
                {
                    yield return null; float now = Time.realtimeSinceStartup; times.Add((now - previous) * 1000); previous = now;
                    for (int i = 0; i < actors.Length; i++) { movements[i] += Vector3.Distance(positions[i], actors[i].transform.position); positions[i] = actors[i].transform.position; }
                    if (mainThread.Valid && mainThread.LastValue > 0) { mainTotal += mainThread.LastValue / 1000000.0; mainSamples++; }
                }
                sample.mainThreadProfilerMeanMs = mainSamples > 0 ? (float)(mainTotal / mainSamples) : -1;
            }
            sample.frames = times.Count; sample.wallSeconds = Time.realtimeSinceStartup - begun;
            sample.framesPerSecond = sample.frames / sample.wallSeconds; sample.averageFrameMs = sample.wallSeconds * 1000 / Mathf.Max(1, sample.frames);
            times.Sort(); sample.p95FrameMs = times.Count > 0 ? times[Mathf.Min(times.Count - 1, Mathf.FloorToInt(times.Count * .95f))] : -1;
            sample.editorProcessCpuMsPerFrame = (float)((process.TotalProcessorTime.TotalMilliseconds - cpuStart) / Mathf.Max(1,sample.frames));
            sample.unityAllocatedBytes = Profiler.GetTotalAllocatedMemoryLong(); sample.unityReservedBytes = Profiler.GetTotalReservedMemoryLong(); process.Refresh(); sample.processWorkingSetBytes = process.WorkingSet64;
            sample.movingActors = movements.Count(m => m > .01f); sample.minimumActorMovement = movements.Min(); sample.totalActorMovement = movements.Sum();
            sample.status = sample.frames > 0 && sample.activePatrols == count && sample.activeAnimators == count && sample.activeGrounding == count && sample.activeGraphAdapters == count && sample.sceneActivePatrols == count && sample.movingActors == count ? "PASS: measured; no performance target asserted" : "FAIL: requested actor workload not active";
            performanceSamples.Add(sample); Debug.Log("CITY_V002_PERF count=" + count + " fps=" + sample.framesPerSecond + " cpu_ms_per_frame=" + sample.editorProcessCpuMsPerFrame); Save("RUNNING");
            Destroy(group); yield return null; yield return null;
        }
        void Capture(string name)
        {
            var oldTarget = view.targetTexture; var oldActive = RenderTexture.active; float oldAspect = view.aspect;
            var rt = new RenderTexture(1920,1080,24); var pixels = new Texture2D(1920,1080,TextureFormat.RGB24,false);
            try { view.targetTexture = rt; view.aspect = 1920f / 1080; view.Render(); RenderTexture.active = rt; pixels.ReadPixels(new Rect(0,0,1920,1080),0,0); pixels.Apply(); File.WriteAllBytes(Folder + "/" + name, pixels.EncodeToPNG()); }
            finally { view.targetTexture = oldTarget; view.aspect = oldAspect; RenderTexture.active = oldActive; rt.Release(); Destroy(rt); Destroy(pixels); }
        }
        void Save(string status)
        {
            evidence.runtimeStatus = status; evidence.elapsedWallSeconds = Time.realtimeSinceStartup - started;
            evidence.cameras = cameraSamples.ToArray(); evidence.performance = performanceSamples.ToArray();
            File.WriteAllText(ResultPath, JsonUtility.ToJson(evidence,true)); File.WriteAllText(LogPath, string.Join("\n", logs));
        }
        void Finish(string status) { Time.timeScale = 1; Save(status); Debug.Log("CITY_V002_PHASE47_RUNTIME_" + status); Completed?.Invoke(status + "; " + ResultPath); }
        void OnDestroy() { Application.logMessageReceived -= OnLog; Time.timeScale = 1; Application.runInBackground = previousRunInBackground; QualitySettings.vSyncCount = previousVSync; Application.targetFrameRate = previousTargetFrameRate; }
    }
}
