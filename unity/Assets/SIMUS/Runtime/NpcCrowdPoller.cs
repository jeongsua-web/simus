using System;
using System.Collections;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityEngine.Networking;

namespace Simus.City
{
    public sealed class NpcMotion
    {
        public string Id;
        public double EpochMs;
        public Vector3[] Points;
        public double Speed;
        public bool Loop;
        public double[] SegmentLengths;
        public double TotalLength;
        internal double[][] PrecisePoints;

        public void Prepare()
        {
            if (Points == null || Points.Length < 2 || (double.IsNaN(Speed) || double.IsInfinity(Speed)) || Speed < 0)
                throw new FormatException("NPC route requires finite points and nonnegative speed.");
            foreach (var point in Points)
                if (!Finite(point.x) || !Finite(point.y) || !Finite(point.z))
                    throw new FormatException("NPC route contains a nonfinite coordinate.");
            // The server's canonical route is authoritative; never invent lane offsets.
            SegmentLengths = new double[Points.Length];
            TotalLength = 0;
            for (var i = 0; i < Points.Length; i++)
            {
                SegmentLengths[i] = !Loop && i == Points.Length - 1 ? 0 :
                    Distance(i, (i + 1) % Points.Length);
                TotalLength += SegmentLengths[i];
                if ((double.IsNaN(TotalLength) || double.IsInfinity(TotalLength))) throw new FormatException("NPC route length is nonfinite.");
            }
        }

        double Coordinate(int point, int axis) => PrecisePoints != null ? PrecisePoints[point][axis] : Points[point][axis];
        double Distance(int a, int b)
        {
            double x = Coordinate(a, 0) - Coordinate(b, 0), y = Coordinate(a, 1) - Coordinate(b, 1), z = Coordinate(a, 2) - Coordinate(b, 2);
            return Math.Sqrt(x * x + y * y + z * z);
        }
        Vector3 Interpolate(int a, int b, double t) => new Vector3(
            (float)(Coordinate(a, 0) + (Coordinate(b, 0) - Coordinate(a, 0)) * t),
            (float)(Coordinate(a, 1) + (Coordinate(b, 1) - Coordinate(a, 1)) * t),
            (float)(Coordinate(a, 2) + (Coordinate(b, 2) - Coordinate(a, 2)) * t));

        private static bool Finite(float value) => !float.IsNaN(value) && !float.IsInfinity(value);

        public Vector3 PositionAt(double atMs)
        {
            if (Points == null || Points.Length < 2) return Vector3.zero;
            if (TotalLength <= Mathf.Epsilon) return Points[0];
            var traveled = Math.Max(0, (atMs - EpochMs) / 1000) * Speed;
            var distance = Loop ? (traveled % TotalLength) : Math.Min(TotalLength, traveled);
            for (var i = 0; i < SegmentLengths.Length; i++)
            {
                if (SegmentLengths[i] > Mathf.Epsilon && distance <= SegmentLengths[i])
                    return Interpolate(i, (i + 1) % Points.Length, distance / SegmentLengths[i]);
                distance -= SegmentLengths[i];
            }
            return Points[Points.Length - 1];
        }
    }

    public sealed class NpcCrowdSnapshot
    {
        public string SessionId;
        public string MapVersion;
        public double ServerTimeMs;
        public double FreezeAtMs;
        public double ReceivedRealtime;
        public double MotionTimeMs;
        public readonly List<NpcMotion> Npcs = new List<NpcMotion>();
        public double MotionTime(double realtime) => Math.Min(FreezeAtMs, ServerTimeMs + Math.Max(0, realtime - ReceivedRealtime) * 1000);

        public static NpcCrowdSnapshot Parse(string json, double receivedRealtime)
        {
            var root = JObject.Parse(json);
            var result = new NpcCrowdSnapshot {
                SessionId = root.Value<string>("session_id"),
                MapVersion = root.Value<string>("map_version"),
                ServerTimeMs = DateTimeOffset.Parse(root.Value<string>("server_time")).ToUnixTimeMilliseconds(),
                FreezeAtMs = DateTimeOffset.Parse(root.Value<string>("freeze_at")).ToUnixTimeMilliseconds(),
                MotionTimeMs = DateTimeOffset.Parse(root.Value<string>("motion_time")).ToUnixTimeMilliseconds(),
                ReceivedRealtime = receivedRealtime
            };
            if (string.IsNullOrWhiteSpace(result.SessionId) || string.IsNullOrWhiteSpace(result.MapVersion))
                throw new FormatException("NPC session_id and map_version are required.");
            if (root["npcs"] is not JArray items) throw new FormatException("NPC list is missing.");
            var ids = new HashSet<string>();
            foreach (var item in items)
            {
                if (item["motion"] is not JObject motion || motion["points"] is not JArray ||
                    motion["loop"]?.Type != JTokenType.Boolean ||
                    (motion["speed_mps"]?.Type != JTokenType.Float && motion["speed_mps"]?.Type != JTokenType.Integer) ||
                    motion.Value<string>("map_version") != result.MapVersion)
                    throw new FormatException("NPC motion is missing or belongs to another map.");
                var npc = new NpcMotion {
                    Id = item.Value<string>("npc_id"),
                    EpochMs = DateTimeOffset.Parse(item.Value<string>("epoch")).ToUnixTimeMilliseconds(),
                    Speed = motion.Value<double>("speed_mps"),
                    Loop = motion.Value<bool>("loop")
                };
                var points = (JArray)motion["points"];
                npc.Points = new Vector3[points.Count];
                npc.PrecisePoints = new double[points.Count][];
                for (var i = 0; i < points.Count; i++)
                {
                    var p = (JArray)points[i];
                    if (p.Count != 3 || !Numeric(p[0]) || !Numeric(p[1]) || !Numeric(p[2])) throw new FormatException("NPC point requires x,y,z.");
                    npc.PrecisePoints[i] = new[] { p[0].Value<double>(), p[1].Value<double>(), p[2].Value<double>() };
                    npc.Points[i] = new Vector3(p[0].Value<float>(), p[1].Value<float>(), p[2].Value<float>());
                }
                if (string.IsNullOrEmpty(npc.Id) || npc.Points.Length < 2 || npc.Speed < 0)
                    throw new FormatException("Invalid NPC motion.");
                if (!ids.Add(npc.Id)) throw new FormatException("Duplicate NPC ID.");
                npc.Prepare();
                if (item["position"] is not JObject position || !Numeric(position["x"]) ||
                    !Numeric(position["y"]) || !Numeric(position["z"]))
                    throw new FormatException("Canonical NPC position is missing.");
                var canonical = new Vector3(position.Value<float>("x"), position.Value<float>("y"), position.Value<float>("z"));
                var error = Vector3.Distance(npc.PositionAt(result.MotionTimeMs), canonical);
                if (float.IsNaN(error) || float.IsInfinity(error) || error > .05f)
                    throw new FormatException("NPC route and canonical position disagree.");
                result.Npcs.Add(npc);
            }
            return result;
        }
        private static bool Numeric(JToken value) => value != null && (value.Type == JTokenType.Integer || value.Type == JTokenType.Float);
    }

    // Polls the same origin as CityStatePoller; never exposes participant credentials.
    public sealed class NpcCrowdPoller : MonoBehaviour
    {
        public CityStatePoller city;
        [Min(0.5f)] public float pollingSeconds = 2f;
        [Tooltip("Required map version for this scene. Empty disables live NPC rendering until configured.")]
        public string mapVersion = "";
        [Min(0.5f)] public float staleAfterSeconds = 10f;
        public string LastError { get; private set; }
        public NpcCrowdSnapshot Current { get; private set; }
        private Coroutine loop;
        private UnityWebRequest pending;
        private int generation;
        private double lastSuccess;
        public bool HasFreshSnapshot => Current != null && Current.MapVersion == mapVersion &&
            !string.IsNullOrWhiteSpace(mapVersion) && Time.realtimeSinceStartupAsDouble - lastSuccess <= staleAfterSeconds;


        private void OnEnable() { generation++; loop = StartCoroutine(Poll(generation)); }
        private void OnDisable()
        {
            generation++;
            pending?.Abort();
            if (loop != null) StopCoroutine(loop);
            pending?.Dispose(); pending = null; loop = null; Current = null;
        }
        private void Update()
        {
            if (Current != null && (city == null || city.Store.Current?.SessionId != Current.SessionId ||
                Current.MapVersion != mapVersion)) Current = null;
        }

        private IEnumerator Poll(int myGeneration)
        {
            while (myGeneration == generation)
            {
                var state = city != null ? city.Store.Current : null;
                if (!string.IsNullOrWhiteSpace(mapVersion) && state != null && city.Store.Connection == CityConnection.Connected)
                {
                    var endpoint = city.Endpoint.Replace("/api/city-state", "/api/sessions/" + state.SessionId + "/npc-positions?map_version=" + UnityWebRequest.EscapeURL(mapVersion));
                    var requestedMap = mapVersion;
                    using (var request = UnityWebRequest.Get(endpoint))
                    {
                        pending = request;
                        var requestStart = Time.realtimeSinceStartupAsDouble;
                        request.timeout = 8;
                        yield return request.SendWebRequest();
                        pending = null;
                        if (myGeneration != generation) yield break;
                        if (request.result == UnityWebRequest.Result.Success && request.responseCode == 200)
                        {
                            try
                            {
                                var next = NpcCrowdSnapshot.Parse(request.downloadHandler.text, (requestStart + Time.realtimeSinceStartupAsDouble) / 2);
                                if (next.MapVersion != requestedMap) throw new FormatException("NPC map_version does not match the scene.");
                                if (next.SessionId == city.Store.Current?.SessionId && mapVersion == requestedMap &&
                                    (Current == null || next.ServerTimeMs >= Current.ServerTimeMs))
                                {
                                    Current = next; lastSuccess = Time.realtimeSinceStartupAsDouble; LastError = null;
                                }
                            }
                            catch (Exception error) { LastError = error.Message; Debug.LogWarning("SIMUS NPC response rejected: " + error.Message); }
                        }
                        else
                        {
                            LastError = "NPC synchronization failed (" + request.responseCode + "): " + request.error;
                            // A map/session/configuration rejection must not keep moving old avatars.
                            if (request.responseCode >= 400 && request.responseCode < 500) Current = null;
                        }
                    }
                }
                yield return new WaitForSecondsRealtime(Mathf.Max(0.5f, pollingSeconds));
            }
        }
    }
}
