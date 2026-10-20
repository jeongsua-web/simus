using System;
using System.Reflection;
using NUnit.Framework;
using UnityEngine;

namespace Simus.City.Tests
{
    // Regression for the scene-opt-in context reveal lifecycle; no city asset mutation.
    public class Phase8CameraTests
    {
        static Type RuntimeType(string name) => Type.GetType("Simus." + name + ", Assembly-CSharp", true);

        [Test]
        public void ContextFadeIsOptInForExistingCameraScenes()
        {
            var host = new GameObject("phase8-camera-default", typeof(Camera));
            try
            {
                var type = RuntimeType("CityPreviewCamera");
                var camera = host.AddComponent(type);
                Assert.That(type.GetField("contextBuildingFade").GetValue(camera), Is.EqualTo(false));
            }
            finally { UnityEngine.Object.DestroyImmediate(host); }
        }

        [Test]
        public void DisablingRevealRestoresVisibilityAndPreservesOtherPropertyBlockValues()
        {
            WithReveal((type, component, renderer, original) =>
            {
                var block = new MaterialPropertyBlock();
                block.SetFloat("_SimusContextVisibility", .12f);
                block.SetFloat("_Phase8TestUnrelatedProperty", .37f);
                renderer.SetPropertyBlock(block);
                type.GetMethod("OnDisable", BindingFlags.Instance | BindingFlags.NonPublic).Invoke(component, null);
                renderer.GetPropertyBlock(block);
                Assert.That(block.GetFloat("_SimusContextVisibility"), Is.EqualTo(1));
                Assert.That(block.GetFloat("_Phase8TestUnrelatedProperty"), Is.EqualTo(.37f));
            });
        }

        [Test]
        public void RevealShaderDefaultsToOpaqueContextForExistingScenes()
        {
            var shader = Shader.Find("SIMUS/NPC Reveal");
            Assert.That(shader, Is.Not.Null);
            var material = new Material(shader);
            try { Assert.That(material.GetFloat("_SimusContextVisibility"), Is.EqualTo(1)); }
            finally { UnityEngine.Object.DestroyImmediate(material); }
        }

        static void WithReveal(Action<Type, Component, Renderer, Material> test)
        {
            var host = new GameObject("phase8-reveal-camera", typeof(Camera));
            var city = new GameObject("phase8-test-city");
            var campus = new GameObject("06_CampusBuildings_14");
            campus.transform.SetParent(city.transform);
            var building = new GameObject("phase8-test-building");
            building.transform.SetParent(campus.transform);
            var cube = GameObject.CreatePrimitive(PrimitiveType.Cube);
            cube.transform.SetParent(building.transform);
            var original = new Material(Shader.Find("Standard"));
            Component component = null;
            try
            {
                var renderer = cube.GetComponent<Renderer>();
                renderer.sharedMaterial = original;
                var type = RuntimeType("NpcOcclusionReveal");
                component = host.AddComponent(type);
                var shader = Shader.Find("SIMUS/NPC Reveal");
                Assert.That(shader, Is.Not.Null);
                type.GetMethod("Initialize").Invoke(component, new object[] { shader, city.transform });
                test(type, component, renderer, original);
            }
            finally
            {
                // Runtime component uses deferred Destroy for runtime-only material copies.
                // Dispose those temporary copies explicitly when running the fixture in EditMode.
                if (component != null)
                {
                    var copies = (System.Collections.IList)component.GetType().GetField("copies", BindingFlags.Instance | BindingFlags.NonPublic).GetValue(component);
                    foreach (Material copy in copies) UnityEngine.Object.DestroyImmediate(copy);
                    copies.Clear();
                }
                UnityEngine.Object.DestroyImmediate(host);
                UnityEngine.Object.DestroyImmediate(city);
                UnityEngine.Object.DestroyImmediate(original);
            }
        }
    }
}
