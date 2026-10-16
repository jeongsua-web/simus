using System;
using System.Reflection;
using NUnit.Framework;
using UnityEngine;

namespace Simus.City.Tests
{
    public class CityV002RiverGradingTests
    {
        [Test]
        public void DownhillRouteReferenceKeepsTheActorOnTheRaisedTrail()
        {
            var actor = new GameObject("river-grade-actor");
            var waypoint = new GameObject("river-grade-target");
            var ramp = new GameObject("river-grade-surface", typeof(MeshCollider));
            var lower = GameObject.CreatePrimitive(PrimitiveType.Cube);
            var mesh = new Mesh();
            try
            {
                // The river basin remains below the raised trail. A next-waypoint-only
                // height reference incorrectly selects this lower surface on descent.
                lower.transform.position = new Vector3(0, -.93f, 5);
                lower.transform.localScale = new Vector3(8, 1, 14);
                mesh.vertices = new[] { new Vector3(-2,.14f,0), new Vector3(2,.14f,0), new Vector3(-2,-.428f,10), new Vector3(2,-.428f,10) };
                mesh.triangles = new[] { 0,2,1, 1,2,3 };
                mesh.RecalculateNormals();
                ramp.GetComponent<MeshCollider>().sharedMesh = mesh;
                var type = Type.GetType("Simus.CityV002NpcRouteAdapter, Assembly-CSharp", true);
                var adapter = actor.AddComponent(type);
                var path = new[] { new Vector3(0,.16f,0), new Vector3(0,-.408f,10) };
                type.GetProperty("Waypoints").GetSetMethod(true).Invoke(adapter, new object[] { path });
                type.GetProperty("WaypointIndex").GetSetMethod(true).Invoke(adapter, new object[] { 1 });
                type.GetProperty("Started").GetSetMethod(true).Invoke(adapter, new object[] { true });
                type.GetField("waypoint", BindingFlags.Instance | BindingFlags.NonPublic).SetValue(adapter, waypoint.transform);
                waypoint.transform.position = path[1];
                actor.transform.position = new Vector3(0,-.408f,5);
                type.GetMethod("Update", BindingFlags.Instance | BindingFlags.NonPublic).Invoke(adapter, null);
                var groundingType = Type.GetType("Simus.NpcGrounding, Assembly-CSharp", true);
                var grounding = actor.GetComponent(groundingType);
                if (grounding == null) grounding = actor.AddComponent(groundingType);
                Physics.SyncTransforms();
                var projected = (Vector3)groundingType.GetMethod("Project").Invoke(grounding, new object[] { actor.transform.position });
                Assert.That(projected.y, Is.EqualTo(-.124f).Within(.001f), "The raised trail is the route surface; the lower basin must not capture grounding.");
            }
            finally
            {
                UnityEngine.Object.DestroyImmediate(actor);
                UnityEngine.Object.DestroyImmediate(waypoint);
                UnityEngine.Object.DestroyImmediate(ramp);
                UnityEngine.Object.DestroyImmediate(lower);
                UnityEngine.Object.DestroyImmediate(mesh);
            }
        }
    }
}
