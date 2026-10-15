using System.Collections.Generic;
using UnityEngine;

namespace Simus
{
    // Runtime-only material copies; imported FBX materials remain unchanged.
    [RequireComponent(typeof(Camera))]
    public sealed class NpcOcclusionReveal : MonoBehaviour
    {
        private readonly Dictionary<Renderer, Material[]> originals = new Dictionary<Renderer, Material[]>();
        private readonly List<Material> copies = new List<Material>();
        private Transform tracked;
        private float radius;
        private static readonly int Center = Shader.PropertyToID("_SimusRevealCenter");
        private static readonly int Direction = Shader.PropertyToID("_SimusRevealDirection");
        private static readonly int Radius = Shader.PropertyToID("_SimusRevealRadius");

        public void Initialize(Shader shader, Transform root = null)
        {
            var map = root != null ? root.gameObject : GameObject.Find("SIMUS Completed Map 03");
            if (map == null || shader == null) return;
            var cache = new Dictionary<Material, Material>();
            foreach (var renderer in map.GetComponentsInChildren<Renderer>(true))
            {
                // A supplied city root can also contain runtime route actors. Their
                // skinned meshes retain their original animation materials.
                if (root != null && (renderer is SkinnedMeshRenderer || renderer.GetComponentInParent<Animator>() != null)) continue;
                var source = renderer.sharedMaterials;
                // State props, transparent decals and animated pond materials must keep their shaders.
                bool preserveStateMaterial = renderer.name.StartsWith("PLACED_", System.StringComparison.Ordinal);
                foreach (var material in source)
                    if (material != null && (material.renderQueue >= 3000 || material.name.ToLowerInvariant().Contains("water")))
                        preserveStateMaterial = true;
                if (preserveStateMaterial) continue;
                originals.Add(renderer, source);
                var replacement = (Material[])source.Clone();
                for (int i = 0; i < source.Length; i++)
                {
                    if (source[i] == null) continue;
                    if (!cache.TryGetValue(source[i], out var material))
                    {
                        material = new Material(source[i]) { shader = shader, name = source[i].name + " (NPC reveal)" };
                        material.renderQueue = -1;
                        cache.Add(source[i], material);
                        copies.Add(material);
                    }
                    replacement[i] = material;
                }
                renderer.sharedMaterials = replacement;
            }
        }

        public void SetTarget(Transform npc, float worldRadius) { tracked = npc; radius = worldRadius; }

        private void OnPreRender()
        {
            Shader.SetGlobalFloat(Radius, tracked != null && tracked.gameObject.activeInHierarchy ? radius : 0f);
            if (tracked == null) return;
            // Centre at torso; leave the walking surface intact.
            Shader.SetGlobalVector(Center, tracked.position + Vector3.up);
            Shader.SetGlobalVector(Direction, transform.forward);
        }

        private void OnPostRender() { Shader.SetGlobalFloat(Radius, 0f); }
        private void OnDisable() { Shader.SetGlobalFloat(Radius, 0f); }

        private void OnDestroy()
        {
            foreach (var pair in originals)
                if (pair.Key != null) pair.Key.sharedMaterials = pair.Value;
            foreach (var material in copies) Destroy(material);
            Shader.SetGlobalFloat(Radius, 0f);
        }
    }
}

