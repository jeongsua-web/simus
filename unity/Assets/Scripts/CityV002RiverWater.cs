using UnityEngine;
using Simus.City;

namespace Simus
{
    /// <summary>Scene-local water appearance. Never modifies an imported/shared material.</summary>
    [ExecuteAlways, DisallowMultipleComponent]
    public sealed class CityV002RiverWater : MonoBehaviour
    {
        public Renderer waterRenderer;
        [Range(0, 100)] public float pollution = 25;
        public bool followCityState = true;
        public CityStateAssets source;
        public CityStatePoller client;
        public Color cleanColor = new Color(.16f, .43f, .46f, 1);
        public Color pollutedColor = new Color(.29f, .30f, .16f, 1);
        [Range(0, 1)] public float cleanSmoothness = .65f;
        [Range(0, 1)] public float pollutedSmoothness = .12f;

        MaterialPropertyBlock properties;
        Renderer appliedRenderer;
        float appliedValue = float.NaN;
        float nextLookup;
        public float AppliedPollution => appliedValue;
        public Color CurrentColor => Color.Lerp(cleanColor, pollutedColor, Mathf.Clamp01(pollution / 100f));

        void OnEnable() { Apply(); }
        void OnValidate() { pollution = Sanitize(pollution); Apply(); }
        void Update()
        {
            if (Application.isPlaying && followCityState)
            {
                if (Time.unscaledTime >= nextLookup)
                {
                    if (client == null) client = FindFirstObjectByType<CityStatePoller>();
                    if (source == null) source = FindFirstObjectByType<CityStateAssets>();
                    nextLookup = Time.unscaledTime + 2;
                }
                // Only the explicit city aggregate is used. No unconfirmed region mapping.
                var state = client != null ? client.Store.Current : null;
                if (state != null && state.OverallPollution.HasValue)
                    pollution = Sanitize((float)state.OverallPollution.Value);
                else if (source != null) pollution = Sanitize(source.pollution);
            }
            if (waterRenderer != appliedRenderer || !Mathf.Approximately(appliedValue, pollution)) Apply();
        }

        public void SetPollution(float value) { pollution = Sanitize(value); Apply(); }

        [ContextMenu("Apply river pollution")]
        public void Apply()
        {
            pollution = Sanitize(pollution);
            if (appliedRenderer != null && appliedRenderer != waterRenderer) appliedRenderer.SetPropertyBlock(null);
            appliedRenderer = waterRenderer;
            if (waterRenderer == null) return;
            if (properties == null) properties = new MaterialPropertyBlock();
            waterRenderer.GetPropertyBlock(properties);
            var color = CurrentColor;
            var smoothness = Mathf.Lerp(cleanSmoothness, pollutedSmoothness, pollution / 100f);
            properties.SetColor("_Color", color);
            properties.SetColor("_BaseColor", color);
            properties.SetFloat("_Glossiness", smoothness);
            properties.SetFloat("_Smoothness", smoothness);
            waterRenderer.SetPropertyBlock(properties);
            appliedValue = pollution;
        }

        void OnDisable()
        {
            if (appliedRenderer != null) appliedRenderer.SetPropertyBlock(null);
            appliedRenderer = null;
            appliedValue = float.NaN;
        }

        static float Sanitize(float value) => float.IsNaN(value) || float.IsInfinity(value) ? 0 : Mathf.Clamp(value, 0, 100);
    }
}
