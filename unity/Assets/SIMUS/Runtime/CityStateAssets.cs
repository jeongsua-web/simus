using System;
using System.Collections.Generic;
using UnityEngine;

namespace Simus.City
{
    [ExecuteAlways, DisallowMultipleComponent]
    public sealed class CityStateAssets : MonoBehaviour
    {
        [Serializable] public class Binding { public GameObject target; public string stat, region, group, asset; public int minimum, maximum; }
        [Serializable] public class WaterBinding { public Renderer target; public int slot; public string region; }
        [Serializable] public class RegionOverride { public string region; public bool enabled; [Range(0,100)] public float pollution = 50; public string serverCode; }
        [Range(0,100)] public float happiness=50, safety=50, cleanliness=50, pollution=50;
        [Tooltip("Uses an available CityStatePoller. Unknown server region codes are never guessed.")]
        public bool followServer = true;
        public CityStatePoller client;
        public Binding[] bindings = Array.Empty<Binding>();
        public WaterBinding[] water = Array.Empty<WaterBinding>();
        public RegionOverride[] regions = Array.Empty<RegionOverride>();
        readonly Dictionary<WaterBinding, Material> waterCopies = new Dictionary<WaterBinding, Material>();
        readonly Dictionary<WaterBinding, Material> waterOriginals = new Dictionary<WaterBinding, Material>();
        int appliedHash = int.MinValue;
        public static int Level(float value) => Mathf.Clamp(Mathf.CeilToInt(Mathf.Clamp(value,0,100)/20f),1,5);
        public float RegionPollution(string region)
        {
            foreach(var entry in regions) if(entry.enabled && string.Equals(entry.region,region,StringComparison.OrdinalIgnoreCase)) return entry.pollution;
            return pollution;
        }
        public void SetStats(float happy,float safe,float clean,float polluted)
        { happiness=Mathf.Clamp(happy,0,100);safety=Mathf.Clamp(safe,0,100);cleanliness=Mathf.Clamp(clean,0,100);pollution=Mathf.Clamp(polluted,0,100);Apply(); }
        public void SetRegionalPollution(string region,float value)
        {
            foreach(var entry in regions) if(string.Equals(entry.region,region,StringComparison.OrdinalIgnoreCase)) {entry.enabled=true;entry.pollution=Mathf.Clamp(value,0,100);Apply();return;}
            throw new ArgumentException("Unknown visual region: "+region);
        }
        void OnEnable() { appliedHash=int.MinValue;Apply(); }
        void Update()
        {
            if(Application.isPlaying && followServer)
            {
                if(client==null)client=FindFirstObjectByType<CityStatePoller>();
                var state=client!=null?client.Store.Current:null;
                if(state!=null)
                {
                    happiness=(float)state.Happiness;safety=(float)state.Safety;cleanliness=(float)state.Cleanliness;
                    if(state.OverallPollution.HasValue)pollution=(float)state.OverallPollution.Value;
                    foreach(var entry in regions) if(!string.IsNullOrEmpty(entry.serverCode))
                        foreach(var server in state.Regions)if(server.Code==entry.serverCode){entry.enabled=true;entry.pollution=(float)server.Pollution;break;}
                }
            }
            int hash=Level(happiness)+Level(safety)*10+Level(cleanliness)*100+Level(pollution)*1000;
            foreach(var entry in regions)hash=unchecked(hash*31+(entry.enabled?Level(entry.pollution):0));
            if(hash!=appliedHash){Apply();appliedHash=hash;}
        }
        [ContextMenu("Apply city stats")]
        public void Apply()
        {
            foreach(var b in bindings)
            {
                if(b.target==null)continue;
                float value=b.stat=="HAPPINESS"?happiness:b.stat=="SAFETY"?safety:b.stat=="CLEANLINESS"?cleanliness:RegionPollution(b.region);
                int level=Level(value);bool active=level>=b.minimum&&level<=b.maximum;
                if(b.target.activeSelf!=active)b.target.SetActive(active);
            }
            // Edit-mode material instances are avoided. Runtime copies never alter imported shared materials.
            if(!Application.isPlaying)return;
            foreach(var w in water)
            {
                if(w.target==null)continue;
                if(!waterCopies.TryGetValue(w,out var material))
                {
                    var mats=w.target.sharedMaterials;if(w.slot<0||w.slot>=mats.Length)continue;
                    waterOriginals[w]=mats[w.slot];material=new Material(mats[w.slot]);material.name="CityState_Water_Runtime";mats[w.slot]=material;w.target.sharedMaterials=mats;waterCopies[w]=material;
                }
                var c=RegionPollution(w.region)>60?new Color(.23f,.27f,.15f,1):new Color(.12f,.30f,.34f,1);
                if(material.HasProperty("_BaseColor"))material.SetColor("_BaseColor",c);
                if(material.HasProperty("_Color"))material.color=c;
            }
        }
        void OnDisable()
        {
            foreach(var pair in waterCopies)
            {
                var w=pair.Key;if(w.target!=null){var mats=w.target.sharedMaterials;if(w.slot<mats.Length){mats[w.slot]=waterOriginals[w];w.target.sharedMaterials=mats;}}
                if(Application.isPlaying)Destroy(pair.Value);else DestroyImmediate(pair.Value);
            }
            waterCopies.Clear();waterOriginals.Clear();
        }
    }
}
