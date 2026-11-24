using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Simus.City
{
    public sealed class V003Traffic : MonoBehaviour
    {
        private const string SourceScenePath = "Assets/SIMUS/Scenes/city_masterplan_v003/CityMasterplan_v003_EventPlaces.unity";
        private const string RuntimeScenePath = "Assets/SIMUS/Scenes/city_masterplan_v003/CityMasterplan_v003_LocalRuntime.unity";
        private const float Brake = 3f;
        private const float StopSeconds = 5f;
        private const float DepotSeconds = 3f;
        private const float BusCurbX = 92f;

        private Vehicle[] vehicles;
        private MeshCollider asphalt;
        private WebCityBridge bridge;

        internal readonly struct Crossing
        {
            public readonly string Id;
            public readonly Vector3 Center, Axis;
            public readonly float HalfLength, HalfWidth;

            public Crossing(string id, float x, float z, bool spansZ, float length, float width = 3f)
            {
                Id = id;
                Center = new Vector3(x, 0, z);
                Axis = spansZ ? Vector3.forward : Vector3.right;
                HalfLength = length * .5f;
                HalfWidth = width * .5f;
            }

            public bool Contains(Vector3 position)
            {
                var offset = position - Center;
                return Mathf.Abs(Vector3.Dot(offset, Axis)) <= HalfLength + .45f
                    && Mathf.Abs(Vector3.Dot(offset, Vector3.Cross(Vector3.up, Axis))) <= HalfWidth + .35f;
            }
        }

        // Crossings intersecting the two routes, from the v003 pedestrian network.
        private static readonly Crossing[] Crossings = {
            new Crossing("CW00", 45, 50, true, 17, 4),
            new Crossing("CW01", -148.307f, 50, true, 17.2f),
            new Crossing("CW02", -45.485f, 50, true, 17.2f),
            new Crossing("CW03", 57.336f, 50, true, 17.2f),
            new Crossing("CW04", 139.594f, 50, true, 17.2f),
            new Crossing("CW05", -65, -83.655f, false, 12.2f),
            new Crossing("CW08", -140.892f, -22, true, 12.2f),
            new Crossing("CW12", -128, -110, true, 11.2f),
            new Crossing("CW13", -86, -110, true, 11.2f),
            new Crossing("CW26", -150, -94.16f, false, 9.2f),
            new Crossing("CW27", -150, -61.6f, false, 9.2f),
            new Crossing("CW28", -150, -35.2f, false, 9.2f)
        };

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        private static void Install()
        {
            SceneManager.sceneLoaded -= SetupScene;
            SceneManager.sceneLoaded += SetupScene;
        }

        private static void SetupScene(Scene scene, LoadSceneMode mode)
        {
            if (scene.path != SourceScenePath && scene.path != RuntimeScenePath) return;
            try
            {
                Create(scene);
            }
            catch (InvalidOperationException ex)
            {
                Debug.LogError("v003 traffic setup failed: " + ex.Message);
            }
        }

        private static T Find<T>(GameObject[] roots, string name = null) where T : Component
        {
            foreach (var root in roots)
                foreach (var component in root.GetComponentsInChildren<T>(true))
                    if (name == null || component.name == name) return component;
            return null;
        }

        public static V003Traffic Create(Scene scene)
        {
            var roots = scene.GetRootGameObjects();
            var road = Find<MeshCollider>(roots, "FULL_V003_Carriageways");
            var bus = Find<Transform>(roots, "EVS_04_city_bus_v001");
            var taxi = Find<Transform>(roots, "EVS_12_taxi_v001");
            var sedan = Find<Transform>(roots, "EVS_07_city_state_saf_car_normal_01");
            if (!road || !bus || !taxi || !sedan)
                throw new InvalidOperationException("Expected carriageways and event vehicles in the v003 scene.");

            var root = new GameObject("SIMUS v003 road traffic");
            SceneManager.MoveGameObjectToScene(root, scene);
            var traffic = root.AddComponent<V003Traffic>();
            traffic.asphalt = road;
            traffic.bridge = Find<WebCityBridge>(roots);
            // Keep the event taxi beside its pickup point and clear the bus lane.
            var taxiPosition = taxi.position;
            taxiPosition.z = 44.35f;
            taxi.position = taxiPosition;

            Physics.SyncTransforms();
            var ambientSedan = Instantiate(sedan, root.transform, true);
            ambientSedan.name = "v003 circulating sedan";
            traffic.vehicles = new[] {
                traffic.CreateVehicle(bus, BusRoute(), "EVS_04_BUS_LIGHTS_FRONT_Headlight_LOD0", 5.6f, 6f, true),
                traffic.CreateVehicle(ambientSedan, SedanRoute(), null, 2f, 4f, false)
            };
            return traffic;
        }

        private static Vector3 Point(float x, float z) => new Vector3(x, 0, z);

        // R01 eastbound. The bus recycles between the outer ends of the road.
        private static Vector3[] BusRoute()
        {
            var points = new List<Vector3> { Point(-203, 47.5f), Point(BusCurbX, 47.5f) };
            AddTurn(points, Point(168.73f, 47.5f), Vector3.right, Point(28, 18).normalized, 5f);
            points.Add(Point(190.15f, 61.25f));
            return points.ToArray();
        }

        // Clockwise right-hand lane loop on R02, R04, R09 and R03.
        private static Vector3[] SedanRoute()
        {
            var points = new List<Vector3> { Point(-67, -45) };
            AddTurn(points, Point(-67, -108.3f), Vector3.back, Vector3.left, 5f);
            AddTurn(points, Point(-149.25f, -108.3f), Vector3.left, Vector3.forward, 5f);
            AddTurn(points, Point(-149.25f, -23.65f), Vector3.forward, Vector3.right, 5f);
            AddTurn(points, Point(-67, -23.65f), Vector3.right, Vector3.back, 5f);
            points.Add(points[0]);
            return points.ToArray();
        }

        private static void AddTurn(List<Vector3> points, Vector3 corner, Vector3 entry, Vector3 exit, float inset)
        {
            var start = corner - entry * inset;
            var end = corner + exit * inset;
            for (var step = 0; step <= 12; step++)
            {
                var t = step / 12f;
                points.Add(Vector3.Lerp(Vector3.Lerp(start, corner, t), Vector3.Lerp(corner, end, t), t));
            }
        }

        private Vehicle CreateVehicle(Transform model, Vector3[] route, string frontName, float halfLength, float speed, bool bus)
        {
            // The saved sedan mesh points down Blender local Y (away from the red tail lights).
            var forward = -model.TransformDirection(Vector3.up);
            if (frontName != null)
            {
                var front = Find<Renderer>(new[] { model.gameObject }, frontName);
                if (!front) throw new InvalidOperationException("Missing front marker for " + model.name);
                forward = front.bounds.center - model.position;
            }
            forward = Vector3.ProjectOnPlane(forward, Vector3.up).normalized;
            var pivot = new GameObject(bus ? "R01 bus" : "R02–R04–R09–R03 sedan").transform;
            pivot.SetParent(transform, false);
            pivot.SetPositionAndRotation(model.position, Quaternion.LookRotation(forward));
            model.SetParent(pivot, true);
            // Baked event geometry has per-mesh collision. Moving vehicles are visual traffic.
            foreach (var collider in model.GetComponentsInChildren<Collider>(true)) collider.enabled = false;
            var vehicle = new Vehicle(pivot, route, halfLength, speed, bus);
            Place(vehicle);
            return vehicle;
        }

        private void LateUpdate()
        {
            if (vehicles == null) return;
            foreach (var vehicle in vehicles)
            {
                vehicle.Advance(Time.deltaTime, IsCrossingOccupied);
                Place(vehicle);
            }
        }

        private bool IsCrossingOccupied(Crossing crossing) => bridge && bridge.HasPedestrianInCrossing(crossing);

        private bool Ground(Vector3 point, out float height)
        {
            var ray = new Ray(point + Vector3.up * 12f, Vector3.down);
            bool found = asphalt.Raycast(ray, out var hit, 22f);
            height = hit.point.y;
            return found;
        }

        private void Place(Vehicle vehicle)
        {
            if (vehicle.Pivot.gameObject.activeSelf != vehicle.Visible)
                vehicle.Pivot.gameObject.SetActive(vehicle.Visible);
            if (!vehicle.Visible) return;

            var point = vehicle.PointAt(vehicle.Distance, out var heading);
            if (!Ground(point, out float roadY)) return;
            float span = vehicle.HalfLength * .65f;
            if (Ground(point + heading * span, out float frontY) && Ground(point - heading * span, out float rearY))
                heading.y = (frontY - rearY) / (2 * span);
            point.y = roadY + .035f;
            vehicle.Pivot.SetPositionAndRotation(point, Quaternion.LookRotation(heading));
        }

#if UNITY_EDITOR
        public void AuditRoutes()
        {
            Physics.SyncTransforms();
            foreach (var vehicle in vehicles)
            {
                float halfWidth = vehicle == vehicles[0] ? 1.45f : 1f;
                int samples = Mathf.CeilToInt(vehicle.Length / .5f);
                for (int i = 0; i <= samples; i++)
                {
                    var point = vehicle.PointAt(i * vehicle.Length / samples, out var heading);
                    if (!Ground(point, out float groundY))
                        throw new InvalidOperationException($"No asphalt at {vehicle.Pivot.name} {point:F2}");
                    var right = Vector3.Cross(Vector3.up, heading);
                    foreach (var lead in new[] { -vehicle.HalfLength, 0, vehicle.HalfLength })
                    foreach (var side in new[] { -halfWidth, halfWidth })
                    {
                        var corner = point + heading * lead + right * side;
                        if (!Ground(corner, out _))
                            throw new InvalidOperationException($"Vehicle footprint leaves the asphalt at {vehicle.Pivot.name} {point:F2} corner {corner:F2}");
                    }
                    var boxCenter = point + Vector3.up * (groundY + (vehicle == vehicles[0] ? 1.75f : .96f));
                    var size = new Vector3(halfWidth, vehicle == vehicles[0] ? 1.33f : .64f, vehicle.HalfLength);
                    foreach (var collider in Physics.OverlapBox(boxCenter, size, Quaternion.LookRotation(heading), Physics.DefaultRaycastLayers, QueryTriggerInteraction.Ignore))
                    {
                        if (collider == asphalt)
                            continue;
                        throw new InvalidOperationException($"Vehicle conflicts with {collider.name} at {vehicle.Pivot.name} {point:F2}");
                    }
                }
                Debug.Log($"V003_TRAFFIC_ROUTE {vehicle.Pivot.name}: {vehicle.Length:F1} m, {samples + 1} poses, {vehicle.CheckpointIds}");
            }
            AuditMotion();
        }

        private void AuditMotion()
        {
            var bus = vehicles[0];
            var sedan = vehicles[1];
            float start = bus.Distance;
            for (int i = 0; i < 100; i++) bus.Advance(.05f, _ => false);
            if (!Mathf.Approximately(bus.Distance, start)) throw new InvalidOperationException("Bus left before its stop wait.");
            AuditYield(bus, "CW04");
            for (int i = 0; bus.Visible && i < 2000; i++) bus.Advance(.05f, _ => false);
            if (bus.Visible) throw new InvalidOperationException("Bus never reached the route boundary.");
            for (int i = 0; i < 40; i++) bus.Advance(.05f, _ => false);
            if (bus.Visible) throw new InvalidOperationException("Bus depot wait was too short.");
            for (int i = 0; i < 30; i++) bus.Advance(.05f, _ => false);
            if (!bus.Visible || bus.Distance is <= 0 or > 5) throw new InvalidOperationException("Bus did not restart at the road entrance.");
            for (int i = 0; bus.Distance < start && i < 2500; i++) bus.Advance(.05f, _ => false);
            if (!Mathf.Approximately(bus.Distance, start)) throw new InvalidOperationException("Bus did not stop at its original berth.");

            AuditYield(sedan, "CW05");
            float previous = sedan.Distance;
            for (int i = 0; i < 2500; i++)
            {
                sedan.Advance(.05f, _ => false);
                if (sedan.Distance < previous)
                {
                    Debug.Log("V003_TRAFFIC_MOTION passed bus dwell, depot and second arrival; sedan loop; both yield and resume.");
                    return;
                }
                previous = sedan.Distance;
            }
            throw new InvalidOperationException("Sedan never completed the loop.");
        }

        private static void AuditYield(Vehicle vehicle, string crossingId)
        {
            float line = vehicle.StopLine(crossingId);
            float step = .05f;
            for (int i = 0; i < 1000; i++) vehicle.Advance(step, crossing => crossing.Id == crossingId);
            if (Mathf.Abs(vehicle.Distance - line) > .1f)
                throw new InvalidOperationException($"Vehicle did not wait at the {crossingId} stop line.");
            for (int i = 0; i < 50; i++) vehicle.Advance(step, _ => false);
            if (vehicle.Distance <= line + 1f) throw new InvalidOperationException($"Vehicle did not resume after {crossingId} cleared.");
        }
#endif

        private sealed class Vehicle
        {
            private readonly Vector3[] path;
            private readonly float[] distances;
            private readonly float maxSpeed;
            private readonly bool bus;
            private readonly float stop;
            private readonly List<(Crossing crossing, float line, float entry)> crossings = new();
            private float speed, wait;
            private bool busStopped, atDepot;

            public readonly Transform Pivot;
            public readonly float HalfLength;
            public float Distance { get; private set; }
            public bool Visible => !atDepot;
            public float Length => distances[distances.Length - 1];
#if UNITY_EDITOR
            public string CheckpointIds => string.Join(", ", crossings.ConvertAll(checkpoint => checkpoint.crossing.Id));
            public float StopLine(string id) => crossings.Find(checkpoint => checkpoint.crossing.Id == id).line;
#endif

            public Vehicle(Transform pivot, Vector3[] path, float halfLength, float maxSpeed, bool bus)
            {
                Pivot = pivot;
                HalfLength = halfLength;
                this.path = path;
                this.maxSpeed = maxSpeed;
                this.bus = bus;
                distances = new float[path.Length];
                for (int i = 1; i < path.Length; i++)
                {
                    var from = path[i - 1];
                    var heading = path[i] - from;
                    distances[i] = distances[i - 1] + heading.magnitude;
                    foreach (var crossing in Crossings)
                    {
                        var across = Vector3.Cross(Vector3.up, crossing.Axis);
                        var delta = Vector3.Dot(heading, across);
                        if (Mathf.Abs(delta) < .001f) continue;
                        float t = Vector3.Dot(crossing.Center - from, across) / delta;
                        if (t < 0 || t >= 1) continue;
                        var intersection = from + t * heading;
                        if (!crossing.Contains(intersection)) continue;
                        float middle = distances[i - 1] + t * heading.magnitude;
                        float entry = middle - crossing.HalfWidth / Mathf.Abs(Vector3.Dot(heading.normalized, across)) - halfLength;
                        crossings.Add((crossing, entry - 1f, entry));
                    }
                }

                if (bus)
                {
                    stop = distances[1];
                    Distance = stop;
                    wait = StopSeconds;
                    busStopped = true;
                }
            }

            public Vector3 PointAt(float distance, out Vector3 heading)
            {
                int index = Array.BinarySearch(distances, distance);
                if (index < 0) index = ~index - 1;
                index = Mathf.Clamp(index, 0, path.Length - 2);
                var segment = path[index + 1] - path[index];
                heading = segment.normalized;
                return path[index] + heading * (distance - distances[index]);
            }

            public void Advance(float elapsed, Func<Crossing, bool> occupied)
            {
                // After a suspended tab, resume motion without jumping across a stop line.
                elapsed = Mathf.Min(elapsed, .1f);
                if (wait > 0)
                {
                    wait -= elapsed;
                    return;
                }
                if (atDepot)
                {
                    atDepot = false;
                    Distance = 0;
                    busStopped = false;
                }

                float limit = bus ? Length : float.PositiveInfinity;
                if (bus && !busStopped) limit = stop;
                foreach (var checkpoint in crossings)
                {
                    if (Distance >= checkpoint.entry || checkpoint.line - Distance > 12f) continue;
                    if (occupied(checkpoint.crossing))
                        limit = Mathf.Min(limit, Mathf.Max(Distance, checkpoint.line));
                }

                float target = Mathf.Min(maxSpeed, Mathf.Sqrt(2 * Brake * Mathf.Max(0, limit - Distance)));
                speed = Mathf.MoveTowards(speed, target, elapsed * (speed > target ? Brake : 1.8f));
                Distance = Mathf.Min(limit, Distance + speed * elapsed);
                if (Distance >= limit) speed = 0;

                if (!bus)
                {
                    if (Distance >= Length) Distance -= Length;
                    return;
                }
                if (!busStopped && Distance >= stop)
                {
                    busStopped = true;
                    speed = 0;
                    wait = StopSeconds;
                }
                else if (Distance >= Length)
                {
                    atDepot = true;
                    speed = 0;
                    wait = DepotSeconds;
                }
            }
        }
    }
}
