using UnityEngine;

namespace Simus
{
    /// <summary>Feeds successive graph points to the preserved local TestNpcPatrol MoveTowards driver.</summary>
    [DefaultExecutionOrder(-100)]
    [RequireComponent(typeof(TestNpcPatrol))]
    public sealed class CityV002NpcRouteAdapter : MonoBehaviour
    {
        public CityV002PedestrianGraph graph;
        public string routeId, startNode, destinationNode;
        public bool startAutomatically = true;
        public bool returnToStart = true;
        public Vector3[] Waypoints { get; private set; } = System.Array.Empty<Vector3>();
        public string[] RouteEdges { get; private set; } = System.Array.Empty<string>();
        public int WaypointIndex { get; private set; }
        public bool Started { get; private set; }
        public bool Completed { get; private set; }
        public string Error { get; private set; }
        public float Length { get; private set; }
        public float OutboundSimulationSeconds { get; private set; }
        public int ReachedWaypoints { get; private set; }
        public int TotalWaypoints => Waypoints.Length == 0 ? 0 : 1 + (Waypoints.Length - 1) * (returnToStart ? 2 : 1);
        public float ElapsedSimulationSeconds => Started ? (Completed ? finishedAt : Time.time) - startedAt : 0;
        public int ArrivalCount { get; private set; }
        private float startedAt, finishedAt;
        private TestNpcPatrol patrol;
        private Transform waypoint;

        private void Start() { if (startAutomatically) BeginRoute(); }

        private void OnDestroy()
        {
            // The waypoint deliberately lives outside the actor hierarchy. Remove it when a
            // temporary runtime/performance actor is destroyed, avoiding stale destinations.
            if (Application.isPlaying && waypoint != null) Destroy(waypoint.gameObject);
        }

        public bool BeginRoute()
        {
            patrol = GetComponent<TestNpcPatrol>();
            if (graph == null || !graph.TryRoute(startNode, destinationNode, out var points, out var ids, out var length) || points.Length < 2)
            { Error = "No connected graph route: " + startNode + " -> " + destinationNode; Debug.LogError(Error, this); return false; }
            Waypoints = points; RouteEdges = ids; Length = length;
            if (waypoint == null)
            {
                var go = new GameObject("GraphWaypoint_" + routeId); waypoint = go.transform;
                // Keep the destination outside the moving actor hierarchy.
                waypoint.SetParent(graph.transform, false);
            }
            patrol.startPoint = waypoint; patrol.endPoint = waypoint;
            transform.position = points[0];
            var grounding = GetComponent<NpcGrounding>(); if (grounding != null) transform.position = grounding.Project(transform.position);
            WaypointIndex = 1; waypoint.position = points[1];
            patrol.enabled = true; Started = true; Completed = false; Error = null; ArrivalCount = 0;
            ReachedWaypoints = 1; OutboundSimulationSeconds = 0; startedAt = Time.time;
            return true;
        }

        private void Update()
        {
            if (!Started || Completed) return;
            // The ground plane exists beneath the raised sidewalk. Give the unchanged grounding
            // component the graph's pedestrian-height reference, preventing its nearest-height
            // rule from selecting hidden ground when stepping up from the asphalt.
            var reference = transform.position; reference.y = Waypoints[WaypointIndex].y; transform.position = reference;
            var delta = waypoint.position - transform.position; delta.y = 0;
            // TestNpcPatrol's 5 cm arrival threshold remains the authoritative local motion tolerance.
            if (delta.sqrMagnitude >= .0025f) return;
            WaypointIndex++;
            ReachedWaypoints++;
            if (WaypointIndex >= Waypoints.Length)
            {
                ArrivalCount++;
                if (returnToStart && ArrivalCount == 1)
                {
                    OutboundSimulationSeconds = Time.time - startedAt;
                    System.Array.Reverse(Waypoints); System.Array.Reverse(RouteEdges);
                    WaypointIndex = 1; waypoint.position = Waypoints[1];
                    Debug.Log("CITY_V002_ROUTE_OUTBOUND_ARRIVED " + routeId + " length=" + Length + " simulated_seconds=" + OutboundSimulationSeconds, this);
                    return;
                }
                Completed = true; finishedAt = Time.time;
                Debug.Log("CITY_V002_ROUTE_ROUNDTRIP_ARRIVED " + routeId + " length=" + Length + " simulated_seconds=" + ElapsedSimulationSeconds, this);
                return;
            }
            waypoint.position = Waypoints[WaypointIndex];
        }
    }
}
