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
        public float Speed;
        public bool Loop;
        public float[] SegmentLengths;
        public float TotalLength;
        public float LaneOffset;

        public void Prepare()
        {
            if (!string.IsNullOrEmpty(Id) && Id.Length >= 4 &&
                ushort.TryParse(Id.Substring(0, 4), System.Globalization.NumberStyles.HexNumber,
                    System.Globalization.CultureInfo.InvariantCulture, out var lane))
                LaneOffset = (lane / 65535f - .5f) * 4f;
            SegmentLengths = new float[Points.Length];
            TotalLength = 0;
            for (var i = 0; i < Points.Length; i++)
            {
                SegmentLengths[i] = !Loop && i == Points.Length - 1 ? 0 :
                    Vector3.Distance(Points[i], Points[(i + 1) % Points.Length]);
                TotalLength += SegmentLengths[i];
            }
        }

        public Vector3 PositionAt(double atMs)
        {
            if (Points == null || Points.Length < 2) return Vector3.zero;
            if (TotalLength <= Mathf.Epsilon) return Points[0] + Vector3.right * LaneOffset;
            var traveled = Math.Max(0, (atMs - EpochMs) / 1000) * Speed;
            var distance = Loop ? (float)(traveled % TotalLength) : (float)Math.Min(TotalLength, traveled);
            for (var i = 0; i < SegmentLengths.Length; i++)
            {
                if (SegmentLengths[i] > Mathf.Epsilon && distance <= SegmentLengths[i])
                    return Vector3.Lerp(Points[i], Points[(i + 1) % Points.Length], distance / SegmentLengths[i]) + Vector3.right * LaneOffset;
                distance -= SegmentLengths[i];
            }
            return Points[Points.Length - 1] + Vector3.right * LaneOffset;
        }
    }

    public sealed class NpcCrowdSnapshot
    {
        public string SessionId;
        public double ServerTimeMs;
        public double FreezeAtMs;
        public double ReceivedRealtime;
        public readonly List<NpcMotion> Npcs = new List<NpcMotion>();
        public double MotionTime(double realtime) => Math.Min(FreezeAtMs, ServerTimeMs + Math.Max(0, realtime - ReceivedRealtime) * 1000);

        public static NpcCrowdSnapshot Parse(string json, double receivedRealtime)
        {
            var root = JObject.Parse(json);
            var result = new NpcCrowdSnapshot {
                SessionId = root.Value<string>("session_id"),
                ServerTimeMs = DateTimeOffset.Parse(root.Value<string>("server_time")).ToUnixTimeMilliseconds(),
                FreezeAtMs = DateTimeOffset.Parse(root.Value<string>("freeze_at")).ToUnixTimeMilliseconds(),
                ReceivedRealtime = receivedRealtime
            };
            if (string.IsNullOrEmpty(result.SessionId)) throw new FormatException("NPC session_id is missing.");
            foreach (var item in (JArray)root["npcs"])
            {
                var motion = item["motion"];
                var npc = new NpcMotion {
                    Id = item.Value<string>("npc_id"),
                    EpochMs = DateTimeOffset.Parse(item.Value<string>("epoch")).ToUnixTimeMilliseconds(),
                    Speed = motion.Value<float>("speed_mps"),
                    Loop = motion.Value<bool>("loop")
                };
                var points = (JArray)motion["points"];
                npc.Points = new Vector3[points.Count];
                for (var i = 0; i < points.Count; i++)
                {
                    var p = (JArray)points[i];
                    if (p.Count != 3) throw new FormatException("NPC point requires x,y,z.");
                    npc.Points[i] = new Vector3(p[0].Value<float>(), p[1].Value<float>(), p[2].Value<float>());
                }
                if (string.IsNullOrEmpty(npc.Id) || npc.Points.Length < 2 || npc.Speed < 0)
                    throw new FormatException("Invalid NPC motion.");
                npc.Prepare();
                result.Npcs.Add(npc);
            }
            return result;
        }
    }

    // Polls the same origin as CityStatePoller; never exposes participant credentials.
    public sealed class NpcCrowdPoller : MonoBehaviour
    {
        public CityStatePoller city;
        [Min(0.5f)] public float pollingSeconds = 2f;
        public NpcCrowdSnapshot Current { get; private set; }
        private Coroutine loop;

        private void OnEnable() { loop = StartCoroutine(Poll()); }
        private void OnDisable() { if (loop != null) StopCoroutine(loop); loop = null; Current = null; }

        private IEnumerator Poll()
        {
            while (true)
            {
                var state = city != null ? city.Store.Current : null;
                if (state != null && city.Store.Connection == CityConnection.Connected)
                {
                    var endpoint = city.Endpoint.Replace("/api/city-state", "/api/sessions/" + state.SessionId + "/npcs");
                    using (var request = UnityWebRequest.Get(endpoint))
                    {
                        var requestStart = Time.realtimeSinceStartupAsDouble;
                        request.timeout = 8;
                        yield return request.SendWebRequest();
                        if (request.result == UnityWebRequest.Result.Success && request.responseCode == 200)
                        {
                            try
                            {
                                var next = NpcCrowdSnapshot.Parse(request.downloadHandler.text, (requestStart + Time.realtimeSinceStartupAsDouble) / 2);
                                if (next.SessionId == city.Store.Current?.SessionId) Current = next;
                            }
                            catch (Exception error) { Debug.LogWarning("SIMUS NPC response rejected: " + error.Message); }
                        }
                    }
                }
                yield return new WaitForSecondsRealtime(pollingSeconds);
            }
        }
    }
}
