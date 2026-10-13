using System;
using NUnit.Framework;
using UnityEngine;

namespace Simus.City.Tests
{
    public class NpcMovementTests
    {
        [Test] public void GroundingUsesActualSurfaceAndIgnoresTriggersAndActorColliders() {
            var type = Type.GetType("Simus.NpcGrounding, Assembly-CSharp", true);
            var actor = new GameObject("grounding-test");
            var floor = GameObject.CreatePrimitive(PrimitiveType.Cube);
            var trigger = GameObject.CreatePrimitive(PrimitiveType.Cube);
            try {
                floor.transform.position = new Vector3(0, .25f, 0);
                floor.transform.localScale = new Vector3(10, .5f, 10);
                trigger.transform.position = new Vector3(0, 1, 0);
                trigger.GetComponent<Collider>().isTrigger = true;
                actor.AddComponent<BoxCollider>();
                var grounding = actor.AddComponent(type);
                Physics.SyncTransforms();
                var projected = (Vector3)type.GetMethod("Project").Invoke(grounding, new object[] { Vector3.zero });
                Assert.That(projected.y, Is.EqualTo(.52f).Within(.001f));
                Assert.That(projected.x, Is.Zero);
                Assert.That(projected.z, Is.Zero);
                var unsupported = new Vector3(30, 7, 30);
                Assert.That(type.GetMethod("Project").Invoke(grounding, new object[] { unsupported }), Is.EqualTo(unsupported));
            } finally {
                UnityEngine.Object.DestroyImmediate(actor);
                UnityEngine.Object.DestroyImmediate(floor);
                UnityEngine.Object.DestroyImmediate(trigger);
            }
        }
        static NpcMotion Route(bool loop) {
            var route = new NpcMotion { Id = "ffff-test", Points = new[] { Vector3.zero, new Vector3(10, 0, 0), new Vector3(10, 0, 10) }, Speed = 2, Loop = loop, EpochMs = 1000 };
            route.Prepare(); return route;
        }
        [Test] public void RouteUsesMetersPerSecondAndNeverInventsLaneOffset() {
            Assert.That(Route(false).PositionAt(3500), Is.EqualTo(new Vector3(5, 0, 0)));
            Assert.That(Route(false).PositionAt(0), Is.EqualTo(Vector3.zero));
        }
        [Test] public void OpenRouteStopsAndClosedRouteTraversesClosingSegment() {
            Assert.That(Route(false).PositionAt(100000), Is.EqualTo(new Vector3(10, 0, 10)));
            Assert.That(Vector3.Distance(Route(true).PositionAt(13500), new Vector3(6.464466f, 0, 6.464466f)), Is.LessThan(.0001f));
        }
        [Test] public void DuplicateAndStationaryPointsDoNotDivideByZero() {
            var route = new NpcMotion { Points = new[] { Vector3.one, Vector3.one }, Speed = 2, Loop = true };
            route.Prepare(); Assert.That(route.PositionAt(10000), Is.EqualTo(Vector3.one));
        }
        [Test] public void NonfiniteRoutesAreRejected() {
            var route = Route(false); route.Speed = float.NaN;
            Assert.Throws<FormatException>(() => route.Prepare());
            route.Speed = 1; route.Points[0] = new Vector3(float.PositiveInfinity, 0, 0);
            Assert.Throws<FormatException>(() => route.Prepare());
        }
        [Test] public void SnapshotFreezesAtServerDeadline() {
            var snapshot = new NpcCrowdSnapshot { ServerTimeMs = 1000, FreezeAtMs = 5000, ReceivedRealtime = 10 };
            Assert.That(snapshot.MotionTime(11), Is.EqualTo(2000));
            Assert.That(snapshot.MotionTime(100), Is.EqualTo(5000));
            Assert.That(snapshot.MotionTime(9), Is.EqualTo(1000));
        }
        [Test] public void EventPauseClampsOnlyItsNpcAndPreservesCanonicalPosition() {
            var snapshot = NpcCrowdSnapshot.Parse(Snapshot.Replace("\"speed_mps\":1", "\"revision\":1760000000000,\"freeze_at\":\"2026-01-01T00:00:02Z\",\"speed_mps\":1"), 10);
            Assert.That(snapshot.Npcs[0].Revision, Is.EqualTo(1760000000000L));
            Assert.That(snapshot.Npcs[0].PositionAt(snapshot.MotionTime(100)), Is.EqualTo(new Vector3(2, 0, 0)));
            Assert.That(NpcCrowdSnapshot.Parse(Snapshot, 10).Npcs[0].PositionAt(1767225603000), Is.EqualTo(new Vector3(3, 0, 0)));
        }
        [Test] public void CameraAcquiresTargetAndUsesConfiguredOverviewCenter() {
            // Camera lives in Assembly-CSharp; reflection keeps the runtime test asmdef independent.
            var type = Type.GetType("Simus.CityPreviewCamera, Assembly-CSharp", true);
            var host = new GameObject("camera-test", typeof(Camera));
            var npc = new GameObject("npc-test");
            try {
                var camera = host.AddComponent(type);
                npc.transform.position = new Vector3(20, 0, 30);
                type.GetMethod("SetFollowTarget").Invoke(camera, new object[] { npc.transform });
                type.GetMethod("LateUpdate", System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic).Invoke(camera, null);
                Assert.That((Vector3)type.GetField("target").GetValue(camera), Is.EqualTo(new Vector3(20, 1, 30)));
                Assert.That((bool)type.GetProperty("IsFollowing").GetValue(camera), Is.True);
                npc.SetActive(false);
                type.GetMethod("LateUpdate", System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic).Invoke(camera, null);
                Assert.That((bool)type.GetProperty("IsFollowing").GetValue(camera), Is.False);
                npc.transform.position = new Vector3(40, 0, 60); npc.SetActive(true);
                type.GetMethod("LateUpdate", System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic).Invoke(camera, null);
                Assert.That((Vector3)type.GetField("target").GetValue(camera), Is.EqualTo(new Vector3(40, 1, 60)));
                type.GetField("overviewTarget").SetValue(camera, new Vector3(100, 0, 200));
                type.GetMethod("Overview").Invoke(camera, null);
                Assert.That((Vector3)type.GetField("target").GetValue(camera), Is.EqualTo(new Vector3(100, 0, 200)));
                Assert.That((bool)type.GetProperty("IsFollowing").GetValue(camera), Is.False);
            } finally { UnityEngine.Object.DestroyImmediate(host); UnityEngine.Object.DestroyImmediate(npc); }
        }
        const string Snapshot = "{\"session_id\":\"test-session\",\"map_version\":\"test-map\",\"server_time\":\"2026-01-01T00:00:02Z\",\"motion_time\":\"2026-01-01T00:00:02Z\",\"freeze_at\":\"2026-01-01T00:00:10Z\",\"npcs\":[{\"npc_id\":\"test-npc\",\"epoch\":\"2026-01-01T00:00:00Z\",\"position\":{\"x\":2,\"y\":0,\"z\":0},\"motion\":{\"map_version\":\"test-map\",\"points\":[[0,0,0],[10,0,0]],\"speed_mps\":1,\"loop\":false}}]}";
        [Test] public void CanonicalPositionAndRouteSnapshotAgree() {
            var snapshot = NpcCrowdSnapshot.Parse(Snapshot, 10);
            Assert.That(snapshot.MapVersion, Is.EqualTo("test-map"));
            Assert.That(snapshot.Npcs[0].PositionAt(snapshot.MotionTime(11)), Is.EqualTo(new Vector3(3, 0, 0)));
        }
        [Test] public void RejectsIncorrectCanonicalPositionOrMixedMap() {
            Assert.Throws<FormatException>(() => NpcCrowdSnapshot.Parse(Snapshot.Replace("\"x\":2", "\"x\":7"), 10));
            Assert.Throws<FormatException>(() => NpcCrowdSnapshot.Parse(Snapshot.Replace("\"points\"", "\"map_version\":\"other-map\",\"points\""), 10));
        }
        [Test] public void RejectsMissingLoopOrNonNumericPoint() {
            Assert.Throws<FormatException>(() => NpcCrowdSnapshot.Parse(Snapshot.Replace(",\"loop\":false", ""), 10));
            Assert.Throws<FormatException>(() => NpcCrowdSnapshot.Parse(Snapshot.Replace("[10,0,0]", "[\"10\",0,0]"), 10));
        }
    }
}
