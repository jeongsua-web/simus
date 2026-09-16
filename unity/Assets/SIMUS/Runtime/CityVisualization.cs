using System.Collections.Generic;
using UnityEngine;

namespace Simus.City
{
    public sealed class CityVisualization : MonoBehaviour
    {
        [SerializeField] private CityStatePoller poller;
        [SerializeField, Min(.1f)] private float transitionSeconds = 1.2f;
        [SerializeField] private bool previewMode;
        [SerializeField] private Rect hudRect = new Rect(18, 18, 370, 252);

        private readonly Dictionary<string, RegionView> regions = new Dictionary<string, RegionView>();
        private readonly List<Transform> buildings = new List<Transform>();
        private readonly List<Renderer> lamps = new List<Renderer>();
        private Transform generatedRoot;
        private Renderer cityGround;
        private Renderer haze;
        private Material groundMaterial;
        private Material hazeMaterial;
        private string sessionId;
        private double happiness, safety, cleanliness, overallPollution;
        private double targetHappiness, targetSafety, targetCleanliness, targetOverallPollution;
        private GUIStyle panelStyle, titleStyle, labelStyle;
        private CityStateDto previewState;
        private bool storeSubscribed;
        private readonly Dictionary<string, int> regionSlots = new Dictionary<string, int>();
        private readonly List<Material> ownedMaterials = new List<Material>();

        private sealed class RegionView
        {
            public string Id;
            public string Code;
            public string Name;
            public GameObject Root;
            public Renderer Ground;
            public Renderer Plume;
            public Material GroundMaterial;
            public Material PlumeMaterial;
            public double Value;
            public double Target;
        }

        public void SetPoller(CityStatePoller value)
        {
            Unsubscribe(); poller = value;
            if (isActiveAndEnabled) Subscribe();
            if (!previewMode && poller != null) Apply(poller.Store.Current);
        }
        public void EnablePreview() { previewMode = true; if (generatedRoot != null) ApplyPreview(); }

        private void Awake()
        {
            BuildScene();
            if (previewMode) ApplyPreview();
        }

        private void OnEnable()
        {
            Subscribe();
            if (!previewMode && poller != null) Apply(poller.Store.Current);
        }

        private void OnDisable()
        {
            Unsubscribe();
        }

        private void OnDestroy()
        {
            Unsubscribe();
            ClearRound();
            foreach (var material in ownedMaterials) if (material != null) Destroy(material);
            ownedMaterials.Clear();
        }

        private void Subscribe()
        {
            if (poller == null || storeSubscribed) return;
            poller.Store.Changed += OnStateChanged;
            poller.Store.ConnectionChanged += OnConnectionChanged;
            storeSubscribed = true;
        }

        private void Unsubscribe()
        {
            if (poller == null || !storeSubscribed) return;
            poller.Store.Changed -= OnStateChanged;
            poller.Store.ConnectionChanged -= OnConnectionChanged;
            storeSubscribed = false;
        }

        private void OnStateChanged(CityChange change) { if (!previewMode) Apply(poller.Store.Current); }
        private void OnConnectionChanged() { }

        private void Update()
        {
            var step = transitionSeconds <= 0 ? 1f : Time.unscaledDeltaTime / transitionSeconds;
            happiness = Mathf.Lerp((float)happiness, (float)targetHappiness, step);
            safety = Mathf.Lerp((float)safety, (float)targetSafety, step);
            cleanliness = Mathf.Lerp((float)cleanliness, (float)targetCleanliness, step);
            overallPollution = Mathf.Lerp((float)overallPollution, (float)targetOverallPollution, step);
            foreach (var region in regions.Values) region.Value = Mathf.Lerp((float)region.Value, (float)region.Target, step);
            RenderValues();
        }

        private void Apply(CityStateDto state)
        {
            if (state == null)
            {
                ClearRound();
                return;
            }
            generatedRoot.gameObject.SetActive(true);
            if (sessionId != state.SessionId)
            {
                ClearRound();
                generatedRoot.gameObject.SetActive(true);
                sessionId = state.SessionId;
                happiness = targetHappiness = state.Happiness;
                safety = targetSafety = state.Safety;
                cleanliness = targetCleanliness = state.Cleanliness;
                overallPollution = targetOverallPollution = state.OverallPollution ?? 0;
            }
            targetHappiness = state.Happiness;
            targetSafety = state.Safety;
            targetCleanliness = state.Cleanliness;
            targetOverallPollution = state.OverallPollution ?? 0;
            var present = new HashSet<string>();
            // Allocate unique slots in key order, independent of API array order.
            var keys = new List<string>();
            foreach (var item in state.Regions) keys.Add(CityVisualMapping.RegionKey(item));
            keys.Sort(System.StringComparer.Ordinal);
            foreach (var key in keys)
            {
                if (regionSlots.ContainsKey(key)) continue;
                var slot = 0;
                while (regionSlots.ContainsValue(slot)) slot++;
                regionSlots.Add(key, slot);
            }
            for (var i = 0; i < state.Regions.Count; i++)
            {
                var data = state.Regions[i];
                var key = CityVisualMapping.RegionKey(data);
                present.Add(key);
                RegionView view;
                if (!regions.TryGetValue(key, out view))
                {
                    view = CreateRegion(data, regionSlots[key]);
                    view.Value = data.Pollution;
                    regions.Add(key, view);
                }
                view.Target = data.Pollution;
                view.Id = data.Id; view.Code = data.Code; view.Name = data.Name;
            }
            var removed = new List<string>();
            foreach (var pair in regions) if (!present.Contains(pair.Key)) removed.Add(pair.Key);
            foreach (var key in removed) { DestroyRegion(regions[key]); regions.Remove(key); }
        }

        private void ClearRound()
        {
            foreach (var region in regions.Values) DestroyRegion(region);
            regions.Clear();
            regionSlots.Clear();
            if (generatedRoot != null) generatedRoot.gameObject.SetActive(false);
            sessionId = null;
            happiness = safety = cleanliness = overallPollution = 0;
            targetHappiness = targetSafety = targetCleanliness = targetOverallPollution = 0;
        }

        private static void DestroyRegion(RegionView region)
        {
            if (region.Root != null) Object.Destroy(region.Root);
            if (region.GroundMaterial != null) Object.Destroy(region.GroundMaterial);
            if (region.PlumeMaterial != null) Object.Destroy(region.PlumeMaterial);
        }

        private void BuildScene()
        {
            generatedRoot = new GameObject("Generated City").transform;
            generatedRoot.SetParent(transform, false);
            cityGround = Primitive("City Ground", PrimitiveType.Cylinder, generatedRoot, new Vector3(0, -.35f, 0), new Vector3(4.4f, .25f, 4.4f)).GetComponent<Renderer>();
            groundMaterial = NewMaterial(new Color(.58f, .68f, .6f)); cityGround.sharedMaterial = groundMaterial;
            ownedMaterials.Add(groundMaterial);
            for (var i = 0; i < 7; i++)
            {
                var angle = i * Mathf.PI * 2f / 7f;
                var height = 1.5f + (i % 3) * .55f;
                var building = Primitive("Building " + (i + 1), PrimitiveType.Cube, generatedRoot,
                    new Vector3(Mathf.Cos(angle) * 2.1f, height / 2f, Mathf.Sin(angle) * 2.1f), new Vector3(.75f, height, .75f));
                building.GetComponent<Renderer>().sharedMaterial = NewMaterial(i % 2 == 0 ? new Color(.86f, .9f, .82f) : new Color(.68f, .78f, .72f));
                ownedMaterials.Add(building.GetComponent<Renderer>().sharedMaterial);
                buildings.Add(building.transform);
            }
            for (var i = 0; i < 4; i++)
            {
                var lamp = Primitive("Safety Light " + (i + 1), PrimitiveType.Sphere, generatedRoot,
                    new Vector3(i < 2 ? -1.1f : 1.1f, .28f, i % 2 == 0 ? -1.1f : 1.1f), Vector3.one * .22f);
                lamp.GetComponent<Renderer>().sharedMaterial = NewMaterial(new Color(1f, .82f, .28f));
                ownedMaterials.Add(lamp.GetComponent<Renderer>().sharedMaterial);
                lamps.Add(lamp.GetComponent<Renderer>());
            }
            haze = Primitive("Pollution Haze", PrimitiveType.Cylinder, generatedRoot, new Vector3(0, 1.1f, 0), new Vector3(5f, .06f, 5f)).GetComponent<Renderer>();
            hazeMaterial = NewTransparentMaterial(new Color(.42f, .35f, .26f, 0)); haze.sharedMaterial = hazeMaterial;
            ownedMaterials.Add(hazeMaterial);
            generatedRoot.gameObject.SetActive(false);
            EnsureCameraAndLight();
        }

        private RegionView CreateRegion(RegionStateDto data, int slot)
        {
            var angle = slot * 2.399963f;
            var root = new GameObject("Region " + CityVisualMapping.RegionKey(data));
            root.transform.SetParent(generatedRoot, false);
            root.transform.localPosition = new Vector3(Mathf.Cos(angle) * (6.2f + slot * .2f), 0, Mathf.Sin(angle) * (6.2f + slot * .2f));
            var ground = Primitive("District", PrimitiveType.Cylinder, root.transform, Vector3.zero, new Vector3(2.2f, .24f, 2.2f)).GetComponent<Renderer>();
            var plume = Primitive("Pollution Effect", PrimitiveType.Sphere, root.transform, new Vector3(0, .55f, 0), Vector3.one).GetComponent<Renderer>();
            var groundMat = NewMaterial(CityVisualMapping.PollutionColor(data.Pollution));
            var plumeMat = NewTransparentMaterial(new Color(.42f, .24f, .16f, .1f));
            ground.sharedMaterial = groundMat; plume.sharedMaterial = plumeMat;
            return new RegionView { Id=data.Id, Code=data.Code, Name=data.Name, Root=root, Ground=ground, Plume=plume,
                GroundMaterial=groundMat, PlumeMaterial=plumeMat, Value=data.Pollution, Target=data.Pollution };
        }

        private void RenderValues()
        {
            if (groundMaterial == null) return;
            groundMaterial.color = Color.Lerp(new Color(.48f, .42f, .32f), new Color(.48f, .75f, .57f), CityVisualMapping.Normalize(cleanliness));
            var happy = CityVisualMapping.Normalize(happiness);
            for (var i = 0; i < buildings.Count; i++)
            {
                var scale = buildings[i].localScale; scale.y = (.72f + happy * .5f) * (1.5f + (i % 3) * .55f); buildings[i].localScale = scale;
                var position = buildings[i].localPosition; position.y = scale.y / 2f; buildings[i].localPosition = position;
            }
            var safe = CityVisualMapping.Normalize(safety);
            foreach (var lamp in lamps) lamp.sharedMaterial.color = Color.Lerp(new Color(.3f, .29f, .25f), new Color(1f, .83f, .28f), safe);
            var pollution = CityVisualMapping.Normalize(overallPollution);
            hazeMaterial.color = new Color(.4f, .31f, .22f, pollution * .48f);
            haze.transform.localScale = new Vector3(5f + pollution * 2f, .06f, 5f + pollution * 2f);
            foreach (var region in regions.Values)
            {
                var amount = CityVisualMapping.Normalize(region.Value);
                region.GroundMaterial.color = CityVisualMapping.PollutionColor(region.Value);
                region.PlumeMaterial.color = new Color(.43f, .24f, .16f, .08f + amount * .62f);
                region.Plume.transform.localScale = Vector3.one * (.2f + amount * 1.7f);
                region.Plume.transform.localPosition = new Vector3(0, .45f + amount * 1.3f, 0);
            }
        }

        private static GameObject Primitive(string name, PrimitiveType type, Transform parent, Vector3 position, Vector3 scale)
        {
            var value = GameObject.CreatePrimitive(type); value.name = name; value.transform.SetParent(parent, false);
            value.transform.localPosition = position; value.transform.localScale = scale;
            var collider = value.GetComponent<Collider>(); if (collider != null) Object.Destroy(collider);
            return value;
        }

        private static Material NewMaterial(Color color)
        {
            var shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard") ?? Shader.Find("Unlit/Color");
            var material = new Material(shader); material.color = color; return material;
        }

        private static Material NewTransparentMaterial(Color color)
        {
            var material = NewMaterial(color);
            if (material.HasProperty("_Surface")) { material.SetFloat("_Surface", 1); material.SetFloat("_Blend", 0); }
            if (material.HasProperty("_Mode")) material.SetFloat("_Mode", 3);
            material.SetInt("_SrcBlend", (int)UnityEngine.Rendering.BlendMode.SrcAlpha);
            material.SetInt("_DstBlend", (int)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
            material.SetInt("_ZWrite", 0); material.renderQueue = 3000;
            material.EnableKeyword("_SURFACE_TYPE_TRANSPARENT"); material.EnableKeyword("_ALPHABLEND_ON");
            return material;
        }

        private static void EnsureCameraAndLight()
        {
            if (Camera.main == null)
            {
                var camera = new GameObject("SIMUS Camera").AddComponent<Camera>(); camera.tag = "MainCamera";
                camera.transform.position = new Vector3(0, 11f, -14f); camera.transform.rotation = Quaternion.Euler(33f, 0, 0); camera.clearFlags = CameraClearFlags.SolidColor; camera.backgroundColor = new Color(.77f, .87f, .82f);
            }
            if (Object.FindObjectOfType<Light>() == null)
            {
                var light = new GameObject("SIMUS Sun").AddComponent<Light>(); light.type = LightType.Directional; light.intensity = 1.15f; light.transform.rotation = Quaternion.Euler(48f, -28f, 0);
            }
        }

        private void ApplyPreview()
        {
            var previewRegions = new List<RegionStateDto> {
                new RegionStateDto("preview-center","CENTER","Center","{}",18,"2026-01-01T00:00:00Z"),
                new RegionStateDto("preview-river","RIVER","River","{}",47,"2026-01-01T00:00:00Z"),
                new RegionStateDto("preview-industry","INDUSTRY","Industry","{}",82,"2026-01-01T00:00:00Z") };
            previewState = new CityStateDto("preview-session","RUNNING",72,61,54,"1","2026-01-01T00:00:00Z",49,
                previewRegions,"preview");
            Apply(previewState);
        }

        private void OnGUI()
        {
            if (panelStyle == null)
            {
                panelStyle = new GUIStyle(GUI.skin.box) { padding=new RectOffset(18,18,15,16) };
                titleStyle = new GUIStyle(GUI.skin.label) { fontSize=19, fontStyle=FontStyle.Bold };
                labelStyle = new GUIStyle(GUI.skin.label) { fontSize=14 };
            }
            var state = previewMode ? previewState : poller != null ? poller.Store.Current : null;
            GUILayout.BeginArea(hudRect, panelStyle);
            GUILayout.Label("SIM:US CITY", titleStyle);
            GUILayout.Label(ConnectionText(), labelStyle);
            GUILayout.Space(5);
            if (state == null) GUILayout.Label("NO ROUND", titleStyle);
            else
            {
                GUILayout.Label(CityVisualMapping.StatusLabel(state.Status), titleStyle);
                GUILayout.Label("Happiness  " + happiness.ToString("0.0"), labelStyle);
                GUILayout.Label("Safety       " + safety.ToString("0.0"), labelStyle);
                GUILayout.Label("Cleanliness  " + cleanliness.ToString("0.0"), labelStyle);
                GUILayout.Label("Pollution    " + (state.OverallPollution.HasValue ? overallPollution.ToString("0.0") : "N/A"), labelStyle);
                GUILayout.Label("Version " + state.Version, labelStyle);
            }
            GUILayout.EndArea();
        }

        private string ConnectionText()
        {
            if (previewMode) return "PREVIEW DATA";
            if (poller == null) return "NOT CONFIGURED";
            switch (poller.Store.Connection)
            {
                case CityConnection.Connected: return "CONNECTED";
                case CityConnection.Reconnecting: return "RECONNECTING";
                case CityConnection.Disconnected: return "DISCONNECTED — SHOWING LAST STATE";
                case CityConnection.Waiting: return "CONNECTING";
                case CityConnection.Paused: return "PAUSED";
                default: return "CONFIGURATION ERROR";
            }
        }
    }
}
