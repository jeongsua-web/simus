using System;
using NUnit.Framework;

namespace Simus.City.Tests
{
    public sealed class CityClientTests
    {
        private const string SessionA = "10000000-0000-0000-0000-000000000001";
        private const string SessionB = "10000000-0000-0000-0000-000000000002";

        [Test]
        public void ParsesNullSeparatelyFromAnError()
        {
            var response = CityStateJson.Parse("{\"city_state\":null}");
            Assert.That(response.CityState, Is.Null);
        }

        [Test]
        public void PreservesAndDistinguishesLargeBigintVersions()
        {
            var first = CityStateJson.Parse(Json(SessionA, "RUNNING", "9007199254740992")).CityState;
            var second = CityStateJson.Parse(Json(SessionA, "RUNNING", "9007199254740993")).CityState;
            Assert.That(first.Version, Is.EqualTo("9007199254740992"));
            Assert.That(second.Version, Is.EqualTo("9007199254740993"));
            Assert.That(CityStateJson.ParseVersion(second.Version), Is.GreaterThan(CityStateJson.ParseVersion(first.Version)));
            Assert.That(CityStateJson.ParseVersion("9223372036854775807"), Is.EqualTo(long.MaxValue));
        }

        [Test]
        public void RejectsNumericVersionAndInvalidRequiredValues()
        {
            Assert.Throws<FormatException>(() => CityStateJson.Parse(Json(SessionA, "RUNNING", "1").Replace("\"version\":\"1\"", "\"version\":1")));
            Assert.Throws<FormatException>(() => CityStateJson.Parse(Json(SessionA, "UNKNOWN", "1")));
        }

        [Test]
        public void DetectsStatusChangeAtSameVersion()
        {
            var store = new CityStateStore();
            string error;
            Assert.That(store.Apply(CityStateJson.Parse(Json(SessionA, "RUNNING", "5")), 1, out error), Is.True);
            Assert.That(store.Apply(CityStateJson.Parse(Json(SessionA, "CLOSING", "5")), 2, out error), Is.True);
            Assert.That(store.LastChange.HasFlag(CityChange.Status), Is.True);
            Assert.That(store.LastChange.HasFlag(CityChange.Version), Is.False);
        }

        [Test]
        public void AcceptsNewSessionWithLowerVersionAndRejectsSameSessionRegression()
        {
            var store = new CityStateStore();
            string error;
            store.Apply(CityStateJson.Parse(Json(SessionA, "RUNNING", "50")), 1, out error);
            Assert.That(store.Apply(CityStateJson.Parse(Json(SessionB, "RUNNING", "0")), 2, out error), Is.True);
            Assert.That(store.LastChange.HasFlag(CityChange.Session), Is.True);
            Assert.That(store.Apply(CityStateJson.Parse(Json(SessionB, "RUNNING", "0")), 3, out error), Is.True);
            Assert.That(store.Apply(CityStateJson.Parse(Json(SessionB, "RUNNING", "0")), 4, out error), Is.True);
            store.Apply(CityStateJson.Parse(Json(SessionB, "RUNNING", "2")), 5, out error);
            Assert.That(store.Apply(CityStateJson.Parse(Json(SessionB, "RUNNING", "1")), 6, out error), Is.False);
            Assert.That(store.Current.Version, Is.EqualTo("2"));
        }

        [Test]
        public void FailureRetainsLastGoodStateAndNullClearsIt()
        {
            var store = new CityStateStore();
            string error;
            store.Apply(CityStateJson.Parse(Json(SessionA, "RUNNING", "1")), 1, out error);
            store.Fail("offline", true);
            Assert.That(store.Current.Version, Is.EqualTo("1"));
            Assert.That(store.Connection, Is.EqualTo(CityConnection.Reconnecting));
            store.Apply(CityStateJson.Parse("{\"city_state\":null}"), 2, out error);
            Assert.That(store.Current, Is.Null);
            Assert.That(store.Connection, Is.EqualTo(CityConnection.Connected));
        }

        [Test]
        public void RetryDelayUsesExponentialCapAndRetryAfter()
        {
            Assert.That(CityPollingPolicy.RetryDelay(1, 0.5), Is.EqualTo(2));
            Assert.That(CityPollingPolicy.RetryDelay(6, 0.5), Is.EqualTo(30));
            Assert.That(CityPollingPolicy.RetryDelay(1, 0.5, 45), Is.EqualTo(45));
            Assert.That(CityPollingPolicy.IsRetryable(503), Is.True);
            Assert.That(CityPollingPolicy.IsRetryable(404), Is.False);
        }

        [Test]
        public void VisualMappingUsesStableRegionCodeAndPollutionBands()
        {
            var region = CityStateJson.Parse("{\"city_state\":{" +
                "\"session_id\":\"" + SessionA + "\",\"status\":\"RUNNING\"," +
                "\"happiness\":50,\"safety\":50,\"cleanliness\":50,\"version\":\"1\"," +
                "\"updated_at\":\"2026-09-16T00:00:00Z\",\"overall_pollution\":50," +
                "\"regions\":[{\"id\":\"20000000-0000-0000-0000-000000000001\",\"code\":\"CENTER\"," +
                "\"name\":\"Center\",\"map_metadata\":{},\"pollution\":50,\"updated_at\":\"2026-09-16T00:00:00Z\"}]}}")
                .CityState.Regions[0];
            Assert.That(CityVisualMapping.RegionKey(region), Is.EqualTo("CENTER"));
            Assert.That(CityVisualMapping.Normalize(-1), Is.EqualTo(0));
            Assert.That(CityVisualMapping.Normalize(101), Is.EqualTo(1));
            var clean = CityVisualMapping.PollutionColor(0);
            var polluted = CityVisualMapping.PollutionColor(100);
            Assert.That(clean.g, Is.GreaterThan(clean.r));
            Assert.That(polluted.r, Is.GreaterThan(polluted.g));
        }

        [Test]
        public void VisualStatusLabelsDistinguishRoundLifecycle()
        {
            Assert.That(CityVisualMapping.StatusLabel("RUNNING"), Is.EqualTo("ROUND IN PROGRESS"));
            Assert.That(CityVisualMapping.StatusLabel("CLOSING"), Is.EqualTo("FINALIZING RESULTS"));
            Assert.That(CityVisualMapping.StatusLabel("FINALIZED"), Is.EqualTo("RESULTS FINALIZED"));
            Assert.That(CityVisualMapping.StatusLabel(null), Is.EqualTo("NO ROUND"));
        }

        private static string Json(string session, string status, string version)
        {
            return "{\"city_state\":{" +
                "\"session_id\":\"" + session + "\"," +
                "\"status\":\"" + status + "\"," +
                "\"happiness\":50.5,\"safety\":50,\"cleanliness\":49.5," +
                "\"version\":\"" + version + "\"," +
                "\"updated_at\":\"2026-09-16T00:00:00Z\"," +
                "\"overall_pollution\":null,\"regions\":[]}}";
        }
    }
}
