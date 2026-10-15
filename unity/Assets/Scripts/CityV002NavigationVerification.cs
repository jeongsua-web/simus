using System;
using System.Collections.Generic;
using UnityEngine;

namespace Simus
{
    /// <summary>Play Mode evidence only. Does not alter NPC speed, event waits, or simulation clocks.</summary>
    [DefaultExecutionOrder(150)]
    public sealed class CityV002NavigationVerification : MonoBehaviour
    {
        [Serializable] public sealed class RouteResult
        {
            public string routeId, startNode, destinationNode, status = "NOT TESTED", error;
            public int frames, waypointCount, reachedWaypoints, supportSamples, missingSupportSamples, groundMismatchSamples, buildingPenetrationSamples, arrivalCount;
            public float lengthMeters, expectedRoundTripMeters, distanceMovedMeters, elapsedSimulationSeconds, outboundSimulationSeconds, speedMetersPerSecond, maximumGroundError;
            public bool roundTrip;
            public Vector3 startPosition, finalPosition;
            public string[] edgeIds, firstViolations;
        }
        [Serializable] public sealed class Results
        {
            public string scope = "Unity Play Mode, retained TestNpcPatrol and NpcGrounding";
            public string navmesh = "NOT TESTED: no NavMesh package/bake; approved graph feeds existing MoveTowards";
            public string actualDoorThresholdAccess = "NOT TESTED: destinations are exterior design approach anchors; FBX doorway positions unverified";
            public string eventLogic = "Unmodified; 90 second event wait preserved";
            public string unityVersion, layoutSha256;
            public float elapsedWallSeconds, timeScale, maximumTimeScale;
            public RouteResult[] routes;
        }
        public CityV002NpcRouteAdapter[] actors;
        public Results Evidence { get; private set; }
        public bool AllArrived
        {
            get { if (actors == null || actors.Length != 4) return false; foreach (var actor in actors) if (actor == null || !actor.Completed) return false; return true; }
        }
        private Vector3[] previous;
        private readonly List<List<string>> violations = new List<List<string>>();
        private float wallStarted;
        private Transform campusBuildings, externalBuildings;
        private readonly Collider[] overlaps = new Collider[128];

        private void Start()
        {
            wallStarted = Time.realtimeSinceStartup;
            Evidence = new Results { unityVersion = Application.unityVersion, layoutSha256 = actors[0].graph.layoutSha256, routes = new RouteResult[actors.Length] };
            previous = new Vector3[actors.Length];
            var city = GameObject.Find("CityRebuild_v002");
            campusBuildings = city.transform.Find("06_CampusBuildings_14"); externalBuildings = city.transform.Find("08_ExternalBuildings_55");
            for (int i = 0; i < actors.Length; i++)
            {
                var a = actors[i]; previous[i] = a.transform.position; violations.Add(new List<string>());
                Evidence.routes[i] = new RouteResult { routeId = a.routeId, startNode = a.startNode, destinationNode = a.destinationNode, startPosition = a.transform.position };
            }
        }

        private bool IsBuilding(Transform t) => (campusBuildings != null && t.IsChildOf(campusBuildings)) || (externalBuildings != null && t.IsChildOf(externalBuildings));
        private void Violation(int index, string text) { if (violations[index].Count < 12 && !violations[index].Contains(text)) violations[index].Add(text); }

        private void LateUpdate()
        {
            if (Evidence == null) return;
            Evidence.elapsedWallSeconds = Time.realtimeSinceStartup - wallStarted; Evidence.timeScale = Time.timeScale;
            Evidence.maximumTimeScale = Mathf.Max(Evidence.maximumTimeScale, Time.timeScale);
            for (int i = 0; i < actors.Length; i++)
            {
                var actor = actors[i]; var result = Evidence.routes[i];
                result.lengthMeters = actor.Length; result.expectedRoundTripMeters = actor.Length * (actor.returnToStart ? 2 : 1); result.roundTrip = actor.returnToStart;
                result.edgeIds = actor.RouteEdges;
                result.waypointCount = actor.TotalWaypoints; result.reachedWaypoints = actor.ReachedWaypoints;
                result.outboundSimulationSeconds = actor.OutboundSimulationSeconds;
                result.elapsedSimulationSeconds = actor.ElapsedSimulationSeconds; result.arrivalCount = actor.ArrivalCount;
                result.speedMetersPerSecond = actor.GetComponent<TestNpcPatrol>().speed; result.error = actor.Error;
                if (!actor.Started) { result.status = actor.Error == null ? "NOT TESTED" : "FAIL"; continue; }
                // Freeze evidence after arrival, preventing a stationary actor from inflating sample counts.
                if (result.status == "PASS" || result.status == "FAIL" && actor.Completed) continue;
                result.frames++;
                var position = actor.transform.position; var movement = position - previous[i]; movement.y = 0;
                result.distanceMovedMeters += movement.magnitude; result.finalPosition = position;
                int samples = Mathf.Max(1, Mathf.CeilToInt(movement.magnitude / .35f));
                for (int s = 1; s <= samples; s++)
                {
                    var sample = Vector3.Lerp(previous[i], position, s / (float)samples); result.supportSamples++;
                    // Upward facing surfaces at pedestrian height only; a roof cannot validate support.
                    bool supported = false; float best = float.PositiveInfinity, supportY = sample.y;
                    foreach (var hit in Physics.RaycastAll(sample + Vector3.up * .5f, Vector3.down, 2f, Physics.DefaultRaycastLayers, QueryTriggerInteraction.Ignore))
                    {
                        if (hit.normal.y < .5f || hit.transform.IsChildOf(actor.transform) || IsBuilding(hit.transform)) continue;
                        float error = Mathf.Abs(hit.point.y + .02f - sample.y);
                        if (error >= best) continue;
                        best = error; supportY = hit.point.y; supported = true;
                    }
                    if (!supported) { result.missingSupportSamples++; Violation(i, "missing ground at " + sample); }
                    // Intermediate samples can straddle a consistent 12 cm curb; inspect actor's actual end-frame grounding.
                    else if (s == samples)
                    {
                        float error = Mathf.Abs(position.y - (supportY + .02f)); result.maximumGroundError = Mathf.Max(result.maximumGroundError, error);
                        if (error > .06f) { result.groundMismatchSamples++; Violation(i, "ground error " + error + " at " + position); }
                    }
                    int count = Physics.OverlapCapsuleNonAlloc(sample + Vector3.up * .25f, sample + Vector3.up * 1.55f,
                        .2f, overlaps, Physics.DefaultRaycastLayers, QueryTriggerInteraction.Ignore);
                    for (int c = 0; c < count; c++)
                    {
                        if (!IsBuilding(overlaps[c].transform)) continue;
                        result.buildingPenetrationSamples++; Violation(i, "building collider " + overlaps[c].name + " at " + sample); break;
                    }
                }
                previous[i] = position;
                bool failed = result.missingSupportSamples > 0 || result.groundMismatchSamples > 0 || result.buildingPenetrationSamples > 0 || actor.Error != null;
                result.status = failed ? "FAIL" : actor.Completed ? "PASS" : "RUNNING";
                result.firstViolations = violations[i].ToArray();
            }
        }

        public string EvidenceJson(bool pretty = true) => JsonUtility.ToJson(Evidence, pretty);
    }
}
