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
            Assert.AreEqual(0, state.Own.Npcs[0].PositionAt(state.Own.MotionTime(105)).z, .001);
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
                var m = Message(); m["snapshot"]["server_time"] = "2026-10-09T00:00:11Z";
                m["snapshot"]["motion_time"] = "2026-10-09T00:00:11Z";
                var motion = m["snapshot"]["npcs"][0]["motion"];
                if (bad == "map") motion["map_version"] = "exhibition-unknown";
                if (bad == "motion") motion["speed_mps"] = 2;
                if (bad == "point") motion["points"][0] = new JArray(1,2);
                Assert.Throws<FormatException>(() => state.Apply(m.ToString(), 1));
            }
        }
        [Test] public void VersionedEventMotionGuidesPausesAndResumesWithoutChangingBinding()
        {
            var state = new WebBridgeState("test-only-bridge-v1"); state.Apply(Message().ToString(), 100);
            var guide = Message(); guide["type"] = "SNAPSHOT";
            guide["snapshot"]["server_time"] = guide["snapshot"]["motion_time"] = "2026-10-09T00:00:11Z";
            guide["snapshot"]["npcs"][0]["epoch"] = "2026-10-09T00:00:11Z";
            var motion = guide["snapshot"]["npcs"][0]["motion"];
            motion["revision"] = 1760000000000L;
            motion["points"] = new JArray(new JArray(11,1,0), new JArray(11,1,10));
            motion["freeze_at"] = "2026-10-09T00:00:13Z";
            state.Apply(guide.ToString(), 101);
            Assert.AreEqual(11, state.Own.Npcs[0].PositionAt(state.Own.MotionTime(101)).x, .001);
            Assert.AreEqual(2, state.Own.Npcs[0].PositionAt(state.Own.MotionTime(110)).z, .001);
            var paused = (JObject)guide.DeepClone();
            paused["snapshot"]["server_time"] = paused["snapshot"]["motion_time"] = "2026-10-09T00:00:13Z";
            paused["snapshot"]["npcs"][0]["motion"]["revision"] = 1760000000001L;
            state.Apply(paused.ToString(), 103);
            Assert.AreEqual(2, state.Own.Npcs[0].PositionAt(state.Own.MotionTime(1000)).z, .001);
            var resumed = (JObject)paused.DeepClone();
            resumed["snapshot"]["server_time"] = resumed["snapshot"]["motion_time"] = "2026-10-09T00:00:15Z";
            resumed["snapshot"]["npcs"][0]["epoch"] = "2026-10-09T00:00:15Z";
            motion = resumed["snapshot"]["npcs"][0]["motion"];
            motion["revision"] = 1760000000002L; motion["freeze_at"] = null;
            motion["points"] = new JArray(new JArray(11,1,2), new JArray(11,1,10));
            state.Apply(resumed.ToString(), 105);
            Assert.AreEqual(2, state.Own.Npcs[0].PositionAt(state.Own.MotionTime(105)).z, .001);
            Assert.AreEqual(3, state.Own.Npcs[0].PositionAt(state.Own.MotionTime(106)).z, .001);
            state.Apply(paused.ToString(), 107); // Late choice poll cannot reset motion.
            Assert.AreEqual(1760000000002L, state.Own.Npcs[0].Revision);
            Assert.AreEqual(Npc, state.OwnNpcId);
        }
        [Test] public void RejectsRevisionRollbackAndMalformedEventClock()
        {
            foreach (var invalid in new[] { "rollback", "revision", "freeze" }) {
                var initial = Message(); initial["snapshot"]["npcs"][0]["motion"]["revision"] = 2;
                var state = new WebBridgeState("test-only-bridge-v1"); state.Apply(initial.ToString(), 0);
                var next = (JObject)initial.DeepClone();
                next["snapshot"]["server_time"] = next["snapshot"]["motion_time"] = "2026-10-09T00:00:11Z";
                var motion = next["snapshot"]["npcs"][0]["motion"];
                if (invalid == "rollback") motion["revision"] = 1;
                if (invalid == "revision") motion["revision"] = 2.5;
                if (invalid == "freeze") motion["freeze_at"] = "not-a-time";
                Assert.Throws<FormatException>(() => state.Apply(next.ToString(), 1));
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
