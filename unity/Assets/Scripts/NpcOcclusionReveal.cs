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

        public void Initialize(Shader shader)
        {
            var map = GameObject.Find("SIMUS Completed Map 03");
            if (map == null || shader == null) return;
            var cache = new Dictionary<Material, Material>();
            foreach (var renderer in map.GetComponentsInChildren<Renderer>(true))
            {
                var source = renderer.sharedMaterials;
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
