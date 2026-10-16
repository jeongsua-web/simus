using System;
using System.Reflection;
using NUnit.Framework;
using UnityEngine;

namespace Simus.City.Tests
{
    public class CityV002RiverAreaTests
    {
        static Component Area(GameObject host)
        {
            var type = Type.GetType("Simus.CityV002RiverArea, Assembly-CSharp", true);
            var area = host.AddComponent(type);
            type.GetField("centreline").SetValue(area, new[] { Vector3.zero, new Vector3(0, 0, 40) });
            type.GetField("bridgeStarts").SetValue(area, new[] { new Vector3(-15, .14f, 20) });
            type.GetField("bridgeEnds").SetValue(area, new[] { new Vector3(15, .14f, 20) });
            return area;
        }

        [Test]
        public void DirectWaterCrossingIsRejectedWhileDeckCrossingIsAllowed()
        {
            var host = new GameObject("river-area-fixture");
            try
            {
                var area = Area(host);
                var method = area.GetType().GetMethod("SegmentSafe");
                Assert.That(method.Invoke(area, new object[] { new Vector3(-10, .16f, 10), new Vector3(10, .16f, 10), .35f }), Is.False);
                Assert.That(method.Invoke(area, new object[] { new Vector3(-10, .16f, 20), new Vector3(10, .16f, 20), .35f }), Is.True);
                Assert.That(method.Invoke(area, new object[] { new Vector3(-10, -1.2f, 20), new Vector3(10, -1.2f, 20), .35f }), Is.False,
                    "Bridge XZ footprint alone must not authorize underwater movement.");
            }
            finally { UnityEngine.Object.DestroyImmediate(host); }
        }

        [Test]
        public void GuardRejectsAnEntireStepAcrossTheWater()
        {
            var host = new GameObject("river-area-fixture");
            var actor = new GameObject("river-guard-fixture");
            try
            {
                var area = Area(host);
                actor.transform.position = new Vector3(-10, .16f, 10);
                var previous = actor.transform.position;
                var type = Type.GetType("Simus.CityV002RiverGuard, Assembly-CSharp", true);
                var guard = actor.AddComponent(type);
                type.GetField("river").SetValue(guard, area);
                // EditMode does not invoke this ordinary MonoBehaviour's OnEnable.
                Assert.That(type.GetMethod("ResetSafePosition").Invoke(guard, new object[] { previous }), Is.True);
                actor.transform.position = new Vector3(10, .16f, 10);
                type.GetMethod("LateUpdate", BindingFlags.Instance | BindingFlags.NonPublic).Invoke(guard, null);
                Assert.That(actor.transform.position, Is.EqualTo(previous));
                Assert.That((int)type.GetField("rejectedSteps").GetValue(guard), Is.EqualTo(1));
            }
            finally
            {
                UnityEngine.Object.DestroyImmediate(actor);
                UnityEngine.Object.DestroyImmediate(host);
            }
        }
    }
}
