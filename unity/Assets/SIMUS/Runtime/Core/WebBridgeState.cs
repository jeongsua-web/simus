using System;
using System.Globalization;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Simus.City
{
    // No scene coordinates or exhibition map defaults belong in this state machine.
    public sealed class WebBridgeState
    {
        public string SessionId { get; private set; }
        public string OwnNpcId { get; private set; }
        public NpcCrowdSnapshot Own { get; private set; }
        public string BridgeId { get; private set; }
        public readonly string MapVersion;
        private JToken ownMotion;
        public WebBridgeState(string mapVersion) { MapVersion = mapVersion; }

        public bool Apply(string json, double now)
        {
            var m = JsonConvert.DeserializeObject<JObject>(json, new JsonSerializerSettings { DateParseHandling = DateParseHandling.None });
            if (Text(m, "channel") != "simus-city" || m["version"]?.Type != JTokenType.Integer || (int)m["version"] != 1) throw new FormatException("ENVELOPE");
            var bridge = Uuid(m, "bridge_id");
            var type = Text(m, "type");
            if (type != "INIT" && type != "SNAPSHOT") throw new FormatException("TYPE");
            if (type == "SNAPSHOT" && Own == null) throw new FormatException("NOT_BOUND");
            var session = Uuid(m, "session_id");
            var own = Uuid(m, "own_npc_id");
            if (SessionId != null && (session != SessionId || own != OwnNpcId || bridge != BridgeId)) throw new FormatException("BINDING_MISMATCH");
            var root = m["snapshot"] as JObject ?? throw new FormatException("SNAPSHOT");
            var next = ParseSnapshot(root, session, now);
            if (next.Npcs.Count != 1 || next.Npcs[0].Id != own) throw new FormatException("OWN_NPC");
            var signature = new JObject { ["epoch"] = root["npcs"][0]["epoch"], ["motion"] = root["npcs"][0]["motion"] };
            if (ownMotion != null && !JToken.DeepEquals(ownMotion, signature)) throw new FormatException("MOTION_CHANGED");
            if (Own != null) Own.FreezeAtMs = Math.Min(Own.FreezeAtMs, next.FreezeAtMs);
            if (Own == null || next.ServerTimeMs > Own.ServerTimeMs)
            {
                if (Own != null) next.FreezeAtMs = Math.Min(next.FreezeAtMs, Own.FreezeAtMs);
                Own = next;
            }
            SessionId = session; OwnNpcId = own; BridgeId = bridge; ownMotion = signature;
            return type == "INIT";
        }

        public NpcCrowdSnapshot ParseSnapshot(JObject root, string session, double receivedAt)
        {
            if (Uuid(root, "session_id") != session) throw new FormatException("SESSION_MISMATCH");
            var status = Text(root, "status");
            if (status != "RUNNING" && status != "CLOSING" && status != "FINALIZED") throw new FormatException("STATUS");
            var server = Timestamp(root, "server_time");
            var freeze = Timestamp(root, "freeze_at");
            var motionTime = Timestamp(root, "motion_time");
            if (motionTime != Math.Min(server, freeze) || root["frozen"]?.Type != JTokenType.Boolean || (bool)root["frozen"] != (server >= freeze)) throw new FormatException("CLOCK");
            var npcs = root["npcs"] as JArray ?? throw new FormatException("NPCS");
            var ids = new System.Collections.Generic.HashSet<string>();
            foreach (var npc in npcs)
            {
                if (!ids.Add(Uuid(npc, "npc_id"))) throw new FormatException("DUPLICATE_NPC");
                Timestamp(npc, "epoch");
                var motion = npc["motion"];
                if (Text(motion, "map_version") != MapVersion) throw new FormatException("MAP_MISMATCH");
                Text(motion, "path_version");
                if (motion["loop"]?.Type != JTokenType.Boolean || Number(motion["speed_mps"]) < 0) throw new FormatException("MOTION");
                var points = motion["points"] as JArray;
                if (points == null || points.Count < 2 || points.Count > 10000) throw new FormatException("POINTS");
                foreach (var p in points)
                {
                    if (!(p is JArray xyz) || xyz.Count != 3) throw new FormatException("POINT");
                    foreach (var v in xyz) Number(v);
                }
            }
            var parsed = NpcCrowdSnapshot.Parse(root.ToString(Formatting.None), receivedAt);
            foreach (var npc in parsed.Npcs)
            {
                if (float.IsNaN(npc.TotalLength) || float.IsInfinity(npc.TotalLength)) throw new FormatException("PATH_LENGTH");
                npc.LaneOffset = 0;
            } // Old Neighborhood ±2m rule is not a new-map rule.
            return parsed;
        }
        private static string Text(JToken obj, string key)
        {
            var t = obj?[key];
            if (t?.Type != JTokenType.String || string.IsNullOrWhiteSpace((string)t)) throw new FormatException(key);
            return (string)t;
        }
        private static string Uuid(JToken obj, string key)
        {
            var value = Text(obj, key);
            if (!Guid.TryParseExact(value, "D", out _)) throw new FormatException(key);
            return value;
        }
        private static double Timestamp(JToken obj, string key)
        {
            var value = Text(obj, key);
            if (!System.Text.RegularExpressions.Regex.IsMatch(value, @"(Z|[+-]\d\d:\d\d)$") || !DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date)) throw new FormatException(key);
            return date.ToUnixTimeMilliseconds();
        }
        private static double Number(JToken t)
        {
            if (t == null || (t.Type != JTokenType.Float && t.Type != JTokenType.Integer)) throw new FormatException("NUMBER");
            var n = (double)t;
            if (double.IsNaN(n) || double.IsInfinity(n) || Math.Abs(n) > float.MaxValue) throw new FormatException("NUMBER");
            return n;
        }
    }
}
