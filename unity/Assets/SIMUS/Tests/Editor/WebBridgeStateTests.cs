using System;
using Newtonsoft.Json.Linq;
using NUnit.Framework;

namespace Simus.City.Tests
{
    public sealed class WebBridgeStateTests
    {
        private const string Session = "10000000-0000-0000-0000-000000000001";
        private const string Npc = "20000000-0000-0000-0000-000000000001";
        private static JObject Message()
        {
            return JObject.Parse(@"{ 'channel':'simus-city','version':1,'bridge_id':'30000000-0000-0000-0000-000000000001','type':'INIT',
                'session_id':'" + Session + @"','own_npc_id':'" + Npc + @"','snapshot': {
                'session_id':'" + Session + @"','status':'RUNNING','server_time':'2026-10-09T00:00:10Z','freeze_at':'2026-10-09T00:00:20Z',
                'motion_time':'2026-10-09T00:00:10Z','frozen':false,'npcs':[{'npc_id':'" + Npc + @"','epoch':'2026-10-09T00:00:00Z',
                'motion':{'map_version':'test-only-bridge-v1','path_version':'test-only-line-v1','points':[[0,1,0],[100,1,0]],'speed_mps':1,'loop':false}}]}}");
        }
        [Test] public void DuplicateInitDoesNotResetClockAndFreezeUsesMonotonicTime()
        {
            var state = new WebBridgeState("test-only-bridge-v1"); var m = Message().ToString();
            Assert.IsTrue(state.Apply(m, 100)); var original = state.Own;
            Assert.IsTrue(state.Apply(m, 105)); Assert.AreSame(original, state.Own);
            Assert.AreEqual(15, state.Own.Npcs[0].PositionAt(state.Own.MotionTime(105)).x, .001);
            Assert.AreEqual(20, state.Own.Npcs[0].PositionAt(state.Own.MotionTime(1000)).x, .001);
            Assert.AreEqual(0, state.Own.Npcs[0].LaneOffset);
        }
        [Test] public void RejectsUnboundSnapshotAndBindingChanges()
        {
            var state = new WebBridgeState("test-only-bridge-v1"); var m = Message(); m["type"] = "SNAPSHOT";
            Assert.Throws<FormatException>(() => state.Apply(m.ToString(), 0));
            state.Apply(Message().ToString(), 0);
            foreach (var field in new[] { "session_id", "own_npc_id", "bridge_id" }) {
                m = Message(); m[field] = "90000000-0000-0000-0000-000000000001";
                Assert.Throws<FormatException>(() => state.Apply(m.ToString(), 1));
            }
        }
        [Test] public void RejectsMapAndMotionChangesAndMalformedPoints()
        {
            foreach (var bad in new[] { "map", "motion", "point" }) {
                var state = new WebBridgeState("test-only-bridge-v1"); state.Apply(Message().ToString(), 0);
                var m = Message(); var motion = m["snapshot"]["npcs"][0]["motion"];
                if (bad == "map") motion["map_version"] = "exhibition-unknown";
                if (bad == "motion") motion["speed_mps"] = 2;
                if (bad == "point") motion["points"][0] = new JArray(1,2);
                Assert.Throws<FormatException>(() => state.Apply(m.ToString(), 1));
            }
        }
        [Test] public void EarlierFreezeAndOutOfOrderSnapshots()
        {
            var state = new WebBridgeState("test-only-bridge-v1"); state.Apply(Message().ToString(), 0);
            var m = Message(); m["type"] = "SNAPSHOT";
            m["snapshot"]["server_time"] = "2026-10-09T00:00:15Z";
            m["snapshot"]["motion_time"] = "2026-10-09T00:00:12Z";
            m["snapshot"]["freeze_at"] = "2026-10-09T00:00:12Z"; m["snapshot"]["frozen"] = true;
            Assert.IsFalse(state.Apply(m.ToString(), 5));
            state.Apply(Message().ToString(), 6);
            Assert.AreEqual(12, state.Own.Npcs[0].PositionAt(state.Own.MotionTime(1000)).x, .001);
        }
    }
}
