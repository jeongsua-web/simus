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
        public bool contextFadeEnabled;
        public float contextRadius = 14f;
        public float contextVisibility = .12f;
        public float contextFadeSeconds = .3f;
        private readonly Dictionary<Transform, List<Renderer>> contextGroups = new Dictionary<Transform, List<Renderer>>();
        private readonly Dictionary<Transform, float> contextValues = new Dictionary<Transform, float>();
        private MaterialPropertyBlock contextProperties;
        private static readonly int ContextVisibility = Shader.PropertyToID("_SimusContextVisibility");
        private bool contextNeedsRestore;
        private Transform tracked;
        private float radius;
        private static readonly int Center = Shader.PropertyToID("_SimusRevealCenter");
        private static readonly int Direction = Shader.PropertyToID("_SimusRevealDirection");
        private static readonly int Radius = Shader.PropertyToID("_SimusRevealRadius");

        public void Initialize(Shader shader, Transform root = null)
        {
            if(contextProperties==null)contextProperties=new MaterialPropertyBlock();
            var map = root != null ? root.gameObject : GameObject.Find("SIMUS Completed Map 03");
            if (map == null || shader == null) return;
            var cache = new Dictionary<Material, Material>();
            var campus = root != null ? root.Find("06_CampusBuildings_14") : null;
            var external = root != null ? root.Find("08_ExternalBuildings_55") : null;
            foreach (var renderer in map.GetComponentsInChildren<Renderer>(true))
            {
                // A supplied city root can also contain runtime route actors. Their
                // skinned meshes retain their original animation materials.
                if (root != null)
                {
                    // Imported static buildings may carry an FBX Animator. Only actual
                    // NPCs are excluded; terrain/trails retain their original depth shader.
                    if (renderer is SkinnedMeshRenderer || renderer.GetComponentInParent<TestNpcPatrol>() != null) continue;
                    if ((campus != null || external != null) &&
                        !(campus != null && renderer.transform.IsChildOf(campus)) &&
                        !(external != null && renderer.transform.IsChildOf(external))) continue;
                }
                var source = renderer.sharedMaterials;
                // State props, transparent decals and animated pond materials must keep their shaders.
                bool preserveStateMaterial = renderer.name.StartsWith("PLACED_", System.StringComparison.Ordinal);
                foreach (var material in source)
                    if (material != null && (material.renderQueue >= 3000 || material.name.ToLowerInvariant().Contains("water")))
                        preserveStateMaterial = true;
                if (preserveStateMaterial && root == null) continue;
                originals.Add(renderer, source);
                if (root != null)
                {
                    var group=renderer.transform;
                    while(group.parent!=null && group.parent!=campus && group.parent!=external)group=group.parent;
                    if(!contextGroups.ContainsKey(group)){contextGroups[group]=new List<Renderer>();contextValues[group]=1;}
                    contextGroups[group].Add(renderer);
                }
                var replacement = (Material[])source.Clone();
                for (int i = 0; i < source.Length; i++)
                {
                    if (source[i] == null) continue;
                    if (root != null && (source[i].renderQueue >= 3000 || source[i].name.ToLowerInvariant().Contains("water"))) continue;
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

        private void LateUpdate()
        {
            if(!contextFadeEnabled && !contextNeedsRestore)return;
            if(contextProperties==null)contextProperties=new MaterialPropertyBlock();
            bool unfinished=false;
            foreach(var pair in contextGroups)
            {
                bool blocking=false;
                if(contextFadeEnabled && tracked!=null && tracked.gameObject.activeInHierarchy)
                {
                    var target=tracked.position+Vector3.up;
                    foreach(var renderer in pair.Value)
                    {
                        var b=renderer.bounds;var delta=b.center-target;float depth=Vector3.Dot(delta,transform.forward);
                        var lateral=delta-depth*transform.forward;float projectedRadius=b.extents.magnitude;
                        if(depth<projectedRadius && depth>-120 && lateral.magnitude<contextRadius+projectedRadius && b.max.y>target.y+2) {blocking=true;break;}
                    }
                }
                float desired=blocking?contextVisibility:1;
                float current=Mathf.MoveTowards(contextValues[pair.Key],desired,Time.unscaledDeltaTime/Mathf.Max(.05f,contextFadeSeconds));
                contextValues[pair.Key]=current;
                if(current<.999f)unfinished=true;
                foreach(var renderer in pair.Value)
                {if(renderer==null)continue;renderer.GetPropertyBlock(contextProperties);contextProperties.SetFloat(ContextVisibility,current);renderer.SetPropertyBlock(contextProperties);}
            }
            contextNeedsRestore=unfinished;
        }

        private void OnPreRender()
        {
            Shader.SetGlobalFloat(Radius, tracked != null && tracked.gameObject.activeInHierarchy ? radius : 0f);
            if (tracked == null) return;
            // Centre at torso; leave the walking surface intact.
            Shader.SetGlobalVector(Center, tracked.position + Vector3.up);
            Shader.SetGlobalVector(Direction, transform.forward);
        }

        private void OnPostRender() { Shader.SetGlobalFloat(Radius, 0f); }
        private void OnDisable()
        {
            Shader.SetGlobalFloat(Radius,0);
            if(contextProperties==null)contextProperties=new MaterialPropertyBlock();
            foreach(var pair in contextGroups)
            {contextValues[pair.Key]=1;foreach(var renderer in pair.Value){if(renderer==null)continue;renderer.GetPropertyBlock(contextProperties);contextProperties.SetFloat(ContextVisibility,1);renderer.SetPropertyBlock(contextProperties);}}
            contextNeedsRestore=false;
        }

        private void OnDestroy()
        {
            if(contextProperties==null)contextProperties=new MaterialPropertyBlock();
            foreach (var pair in originals)
                if (pair.Key != null) {pair.Key.sharedMaterials = pair.Value;pair.Key.GetPropertyBlock(contextProperties);contextProperties.SetFloat(ContextVisibility,1);pair.Key.SetPropertyBlock(contextProperties);}
            foreach (var material in copies) Destroy(material);
            Shader.SetGlobalFloat(Radius, 0f);
        }
    }
}

