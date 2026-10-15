using System;
using NUnit.Framework;
using UnityEngine;

namespace Simus.City.Tests
{
    public class CityV002RiverWaterTests
    {
        [Test]
        public void PollutionChangesOnlyTheTargetRendererAndCanReturnToClean()
        {
            var type = Type.GetType("Simus.CityV002RiverWater, Assembly-CSharp", true);
            var water = new GameObject("river-water-test", typeof(MeshRenderer));
            var other = new GameObject("unrelated-water-test", typeof(MeshRenderer));
            var shader = Shader.Find("Standard");
            Assert.That(shader, Is.Not.Null);
            var material = new Material(shader) { color = Color.magenta };
            try
            {
                var target = water.GetComponent<Renderer>();
                var neighbor = other.GetComponent<Renderer>();
                target.sharedMaterial = neighbor.sharedMaterial = material;
                var controller = water.AddComponent(type);
                type.GetField("waterRenderer").SetValue(controller, target);
                type.GetField("followCityState").SetValue(controller, false);
                var set = type.GetMethod("SetPollution");
                var block = new MaterialPropertyBlock();

                set.Invoke(controller, new object[] { 0f });
                target.GetPropertyBlock(block);
                var clean = block.GetColor("_Color");
                var cleanGloss = block.GetFloat("_Glossiness");
                set.Invoke(controller, new object[] { 100f });
                target.GetPropertyBlock(block);
                var dirty = block.GetColor("_Color");
                Assert.That(dirty, Is.Not.EqualTo(clean));
                Assert.That(block.GetFloat("_Glossiness"), Is.LessThan(cleanGloss));
                set.Invoke(controller, new object[] { 50f });
                target.GetPropertyBlock(block);
                Assert.That(Vector4.Distance(block.GetColor("_Color"), Color.Lerp(clean, dirty, .5f)), Is.LessThan(.0001f));
                set.Invoke(controller, new object[] { 0f });
                target.GetPropertyBlock(block);
                Assert.That(block.GetColor("_Color"), Is.EqualTo(clean));
                Assert.That(material.color, Is.EqualTo(Color.magenta));
                Assert.That(target.sharedMaterial, Is.SameAs(material));
                Assert.That(neighbor.sharedMaterial, Is.SameAs(material));
                neighbor.GetPropertyBlock(block);
                Assert.That(block.isEmpty, Is.True);

                ((Behaviour)controller).enabled = false;
                target.GetPropertyBlock(block);
                Assert.That(block.isEmpty, Is.True);
            }
            finally
            {
                UnityEngine.Object.DestroyImmediate(water);
                UnityEngine.Object.DestroyImmediate(other);
                UnityEngine.Object.DestroyImmediate(material);
            }
        }

        [TestCase(-1f, 0f)]
        [TestCase(101f, 100f)]
        [TestCase(float.NaN, 0f)]
        [TestCase(float.PositiveInfinity, 0f)]
        public void InvalidPollutionDoesNotPropagateToRenderer(float value, float expected)
        {
            var type = Type.GetType("Simus.CityV002RiverWater, Assembly-CSharp", true);
            var water = new GameObject("river-pollution-range-test", typeof(MeshRenderer));
            try
            {
                var controller = water.AddComponent(type);
                var target = water.GetComponent<Renderer>();
                type.GetField("waterRenderer").SetValue(controller, target);
                type.GetMethod("SetPollution").Invoke(controller, new object[] { value });
                Assert.That((float)type.GetProperty("AppliedPollution").GetValue(controller), Is.EqualTo(expected));
                var block = new MaterialPropertyBlock();
                target.GetPropertyBlock(block);
                var color = block.GetColor("_Color");
                Assert.That(float.IsNaN(color.r) || float.IsInfinity(color.r), Is.False);
            }
            finally { UnityEngine.Object.DestroyImmediate(water); }
        }
    }
}
