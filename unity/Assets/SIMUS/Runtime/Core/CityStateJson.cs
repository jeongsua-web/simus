using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text.RegularExpressions;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Simus.City
{
    public static class CityStateJson
    {
        public static CityStateResponseDto Parse(string json)
        {
            // Manual token validation prevents coercion of numeric version / missing numbers / null to defaults.
            using (var reader = new JsonTextReader(new StringReader(json)))
            {
                reader.DateParseHandling = DateParseHandling.None;
                reader.MaxDepth = 64;
                var root = JObject.Load(reader, new JsonLoadSettings
                { DuplicatePropertyNameHandling = DuplicatePropertyNameHandling.Error });
                if (reader.Read()) throw new FormatException("Trailing JSON content.");
                var token = Required(root, "city_state");
                if (token.Type == JTokenType.Null) return new CityStateResponseDto(null);
                var city = Object(token, "city_state");
                var sessionId = Uuid(city, "session_id");
                var status = Text(city, "status");
                if (status != "RUNNING" && status != "CLOSING" && status != "FINALIZED")
                    throw new FormatException("Unknown session status.");
                var version = Text(city, "version");
                ParseVersion(version);
                var regionsToken = Required(city, "regions");
                if (regionsToken.Type != JTokenType.Array) throw new FormatException("regions must be an array.");
                var regions = new List<RegionStateDto>();
                var ids = new HashSet<string>();
                var codes = new HashSet<string>();
                foreach (var item in (JArray)regionsToken)
                {
                    var region = Object(item, "region");
                    var id = Uuid(region, "id");
                    var code = Text(region, "code");
                    if (!ids.Add(id) || !codes.Add(code)) throw new FormatException("Duplicate region id/code.");
                    regions.Add(new RegionStateDto(id, code, Text(region, "name"),
                        Object(Required(region, "map_metadata"), "map_metadata").ToString(Formatting.None),
                        Metric(Required(region, "pollution"), "pollution"), Timestamp(region, "updated_at")));
                }
                var overall = Required(city, "overall_pollution");
                return new CityStateResponseDto(new CityStateDto(sessionId, status,
                    Metric(Required(city, "happiness"), "happiness"), Metric(Required(city, "safety"), "safety"),
                    Metric(Required(city, "cleanliness"), "cleanliness"), version, Timestamp(city, "updated_at"),
                    overall.Type == JTokenType.Null ? (double?)null : Metric(overall, "overall_pollution"),
                    regions, KnownSnapshot(city)));
            }
        }

        public static long ParseVersion(string value)
        {
            long parsed;
            if (value == null || !Regex.IsMatch(value, @"\A(0|[1-9][0-9]*)\z") ||
                !long.TryParse(value, NumberStyles.None, CultureInfo.InvariantCulture, out parsed))
                throw new FormatException("version must be a non-negative bigint decimal string.");
            return parsed;
        }

        private static JToken Required(JObject obj, string key)
        {
            JToken token;
            if (!obj.TryGetValue(key, out token)) throw new FormatException("Missing field: " + key);
            return token;
        }
        private static JObject Object(JToken token, string key)
        {
            if (token.Type != JTokenType.Object) throw new FormatException(key + " must be an object.");
            return (JObject)token;
        }
        private static string Text(JObject obj, string key)
        {
            var token = Required(obj, key);
            if (token.Type != JTokenType.String) throw new FormatException(key + " must be a string.");
            return token.Value<string>();
        }
        private static string Uuid(JObject obj, string key)
        {
            var text = Text(obj, key);
            Guid id;
            if (!Guid.TryParseExact(text, "D", out id)) throw new FormatException(key + " must be a UUID.");
            return id.ToString("D");
        }
        private static string Timestamp(JObject obj, string key)
        {
            var text = Text(obj, key);
            DateTimeOffset parsed;
            if (!Regex.IsMatch(text, @"\A[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})\z") ||
                !DateTimeOffset.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.None, out parsed))
                throw new FormatException(key + " must be an ISO 8601 timestamp with timezone.");
            return text;
        }
        private static double Metric(JToken token, string key)
        {
            if (token.Type != JTokenType.Integer && token.Type != JTokenType.Float)
                throw new FormatException(key + " must be a number.");
            var value = token.Value<double>();
            if (double.IsNaN(value) || double.IsInfinity(value) || value < 0 || value > 100)
                throw new FormatException(key + " must be between 0 and 100.");
            return value;
        }

        private static string KnownSnapshot(JObject city)
        {
            var knownRegions = new JArray();
            foreach (var item in (JArray)city["regions"])
            {
                var region = (JObject)item;
                knownRegions.Add(new JObject
                {
                    ["id"] = region["id"].DeepClone(),
                    ["code"] = region["code"].DeepClone(),
                    ["name"] = region["name"].DeepClone(),
                    ["map_metadata"] = region["map_metadata"].DeepClone(),
                    ["pollution"] = region["pollution"].DeepClone(),
                    ["updated_at"] = region["updated_at"].DeepClone()
                });
            }
            return new JObject
            {
                ["session_id"] = city["session_id"].DeepClone(),
                ["status"] = city["status"].DeepClone(),
                ["happiness"] = city["happiness"].DeepClone(),
                ["safety"] = city["safety"].DeepClone(),
                ["cleanliness"] = city["cleanliness"].DeepClone(),
                ["version"] = city["version"].DeepClone(),
                ["updated_at"] = city["updated_at"].DeepClone(),
                ["overall_pollution"] = city["overall_pollution"].DeepClone(),
                ["regions"] = knownRegions
            }.ToString(Formatting.None);
        }
    }
}
