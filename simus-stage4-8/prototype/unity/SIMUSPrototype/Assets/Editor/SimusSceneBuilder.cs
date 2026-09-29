using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.SceneManagement;

namespace Simus.Editor
{
    public static class SimusSceneBuilder
    {
        private const string ModelPath = "Assets/Art/Neighborhood.fbx";
        private const string ScenePath = "Assets/Scenes/Neighborhood.unity";

        [Serializable] private sealed class Palette { public Entry[] materials; }
        [Serializable] private sealed class Entry
        {
            public string name;
            public float[] color;
            public float metallic;
            public float roughness;
        }

        [MenuItem("SIMUS/Create preview scene")]
        public static void Create()
        {
            if (!Application.isBatchMode && !EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;
            if (!Application.isBatchMode && File.Exists(ScenePath) && !EditorUtility.DisplayDialog(
                "SIM:US", "Recreate the preview scene? Changes to Neighborhood.unity will be replaced.", "Recreate", "Cancel")) return;
            Directory.CreateDirectory("Assets/Scenes");
            Directory.CreateDirectory("Assets/Materials");
            AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
            var importer = AssetImporter.GetAtPath(ModelPath) as ModelImporter;
            if (importer == null) throw new InvalidOperationException("Export Neighborhood.fbx before creating the scene.");
            importer.globalScale = 1;
            importer.useFileScale = true;
            importer.bakeAxisConversion = true;
            importer.importCameras = false;
            importer.importLights = false;
            importer.importAnimation = false;
            importer.isReadable = false;
            importer.meshCompression = ModelImporterMeshCompression.Off;
            importer.importNormals = ModelImporterNormals.Import;
            importer.materialImportMode = ModelImporterMaterialImportMode.ImportStandard;
            importer.SaveAndReimport();

            Shader shader = Shader.Find("SIMUS/City Surface");
            if (shader == null) throw new InvalidOperationException("City Surface shader did not compile.");
            var palette = JsonUtility.FromJson<Palette>(File.ReadAllText("Assets/Art/BlenderMaterials.json"));
            var assignedPaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var entry in palette.materials)
            {
                string fileName = string.Concat(entry.name.Select(c => char.IsLetterOrDigit(c) || c == '_' || c == '-' ? c : '_'));
                string digest;
                using (var hash = SHA256.Create())
                    digest = BitConverter.ToString(hash.ComputeHash(Encoding.UTF8.GetBytes(entry.name))).Replace("-", "").Substring(0, 10);
                string path = "Assets/Materials/" + fileName + "_" + digest + ".mat";
                if (!assignedPaths.Add(path)) throw new InvalidOperationException("Material path collision: " + entry.name);
                Material mat = AssetDatabase.LoadAssetAtPath<Material>(path);
                if (mat == null) { mat = new Material(shader); AssetDatabase.CreateAsset(mat, path); }
                mat.shader = shader;
                mat.name = entry.name;
                // Blender stores Principled base colors in linear space; Unity's Color property uses sRGB.
                mat.color = new Color(entry.color[0], entry.color[1], entry.color[2], 1).gamma;
                mat.SetFloat("_Metallic", entry.metallic);
                mat.SetFloat("_Glossiness", 1 - entry.roughness);
                EditorUtility.SetDirty(mat);
                importer.AddRemap(new AssetImporter.SourceAssetIdentifier(typeof(Material), entry.name), mat);
            }
            importer.SaveAndReimport();
            if (importer.GetExternalObjectMap().Values.OfType<Material>().Distinct().Count() != palette.materials.Length)
                throw new InvalidOperationException("Not all source materials have independent Unity assets.");
            PlayerSettings.companyName = "SIMUS";
            PlayerSettings.productName = "SIMUS City Prototype";
            PlayerSettings.colorSpace = ColorSpace.Linear;
            PlayerSettings.defaultScreenWidth = 1600;
            PlayerSettings.defaultScreenHeight = 1000;
            PlayerSettings.runInBackground = true;
            QualitySettings.antiAliasing = 4;
            QualitySettings.shadowDistance = 450;
            QualitySettings.shadows = ShadowQuality.All;
            QualitySettings.shadowResolution = ShadowResolution.VeryHigh;

            Scene scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            GameObject model = PrefabUtility.InstantiatePrefab(AssetDatabase.LoadAssetAtPath<GameObject>(ModelPath)) as GameObject;
            model.name = "SIMUS Neighborhood";
            Renderer[] renderers = model.GetComponentsInChildren<Renderer>();
            if (renderers.Length == 0) throw new InvalidOperationException("No mesh renderers were imported.");
            Bounds bounds = renderers[0].bounds;
            foreach (Renderer r in renderers)
            {
                bounds.Encapsulate(r.bounds);
                r.shadowCastingMode = r.bounds.size.y < 0.3f ? ShadowCastingMode.Off : ShadowCastingMode.TwoSided;
                r.receiveShadows = true;
                foreach (Material m in r.sharedMaterials)
                    if (m == null || m.shader == null || m.shader.name == "Hidden/InternalErrorShader")
                        throw new InvalidOperationException("A model material is missing or invalid: " + r.name);
            }
            if (bounds.size.x < 190 || bounds.size.x > 210 || bounds.size.z < 190 || bounds.size.z > 210 || bounds.size.y > 60)
                throw new InvalidOperationException("Unexpected imported scale or orientation: " + bounds);

            var cameraObject = new GameObject("Main Camera", typeof(Camera), typeof(AudioListener), typeof(CityPreviewCamera));
            cameraObject.tag = "MainCamera";
            Camera camera = cameraObject.GetComponent<Camera>();
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = new Color(0.065f, 0.12f, 0.16f);
            camera.nearClipPlane = 0.5f;
            camera.farClipPlane = 1000;
            camera.allowHDR = false;
            camera.orthographic = true;
            camera.orthographicSize = 132;
            cameraObject.transform.rotation = Quaternion.Euler(55, -36, 0);
            cameraObject.transform.position = -cameraObject.transform.forward * 360;

            var sunObject = new GameObject("Sunlight", typeof(Light));
            Light sun = sunObject.GetComponent<Light>();
            sun.type = LightType.Directional;
            sun.color = new Color(1f, 0.96f, 0.89f);
            sun.intensity = 0.85f;
            sun.shadows = LightShadows.Soft;
            sun.shadowBias = 0.12f;
            sun.shadowNormalBias = 0.6f;
            sunObject.transform.rotation = Quaternion.Euler(52, -35, 0);
            RenderSettings.sun = sun;
            RenderSettings.skybox = null;
            RenderSettings.ambientMode = AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.43f, 0.49f, 0.55f);
            RenderSettings.ambientEquatorColor = new Color(0.30f, 0.35f, 0.38f);
            RenderSettings.ambientGroundColor = new Color(0.18f, 0.20f, 0.22f);
            RenderSettings.ambientIntensity = 1;
            RenderSettings.fog = false;

            EditorSceneManager.SaveScene(scene, ScenePath);
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
            AssetDatabase.SaveAssets();
            Selection.activeGameObject = model;
            if (SceneView.lastActiveSceneView != null)
                SceneView.lastActiveSceneView.LookAt(Vector3.zero, camera.transform.rotation, 165);
            WriteReport(bounds, renderers, palette.materials.Length);
            Debug.Log("SIMUS_SCENE_CREATED " + ScenePath + " renderers=" + renderers.Length + " bounds=" + bounds.size);
        }

        private static void WriteReport(Bounds bounds, Renderer[] renderers, int materials)
        {
            string folder = Path.GetFullPath(Path.Combine(Application.dataPath, "../../Verification"));
            Directory.CreateDirectory(folder);
            File.WriteAllText(Path.Combine(folder, "scene-check.txt"),
                "Unity " + Application.unityVersion + "\nScene: " + ScenePath + "\n" +
                "Bounds: " + bounds.size.ToString("F3") + "\nRenderers: " + renderers.Length + "\nMaterials: " + materials +
                "\nMap scale, orientation, mesh presence and material references: PASS\n");
        }

        [MenuItem("SIMUS/Capture preview images")]
        public static void Capture()
        {
            if (SceneManager.GetActiveScene().path != ScenePath)
            {
                if (!Application.isBatchMode && !EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;
                EditorSceneManager.OpenScene(ScenePath);
            }
            Camera camera = Camera.main;
            string folder = Path.GetFullPath(Path.Combine(Application.dataPath, "../../Verification"));
            Directory.CreateDirectory(folder);
            var texture = new RenderTexture(1600, 1200, 24, RenderTextureFormat.ARGB32) { antiAliasing = 4 };
            Vector3 oldPosition = camera.transform.position;
            Quaternion oldRotation = camera.transform.rotation;
            float oldSize = camera.orthographicSize;
            RenderTexture oldTexture = camera.targetTexture;
            try
            {
                camera.targetTexture = texture;
                camera.aspect = 1600f / 1200f;
                CaptureOne(camera, texture, Path.Combine(folder, "Unity_Overview.png"));
                camera.transform.position = new Vector3(0, 360, 0);
                camera.transform.rotation = Quaternion.Euler(90, 0, 0);
                camera.orthographicSize = 110;
                CaptureOne(camera, texture, Path.Combine(folder, "Unity_Plan.png"));
            }
            finally
            {
                camera.transform.SetPositionAndRotation(oldPosition, oldRotation);
                camera.orthographicSize = oldSize;
                camera.targetTexture = oldTexture;
                camera.ResetAspect();
                UnityEngine.Object.DestroyImmediate(texture);
            }
            Debug.Log("SIMUS_PREVIEWS_CAPTURED " + folder);
        }

        public static void CreateAndCapture()
        {
            Create();
            Capture();
        }

        private static void CaptureOne(Camera camera, RenderTexture target, string path)
        {
            camera.Render();
            RenderTexture previous = RenderTexture.active;
            RenderTexture.active = target;
            var image = new Texture2D(target.width, target.height, TextureFormat.RGB24, false);
            image.ReadPixels(new Rect(0, 0, target.width, target.height), 0, 0);
            image.Apply();
            File.WriteAllBytes(path, image.EncodeToPNG());
            RenderTexture.active = previous;
            UnityEngine.Object.DestroyImmediate(image);
        }

        public static void VerifyPlay()
        {
            EditorSceneManager.OpenScene(ScenePath);
            SessionState.SetInt("SIMUS_PLAY_FRAMES", 0);
            EditorApplication.playModeStateChanged += state =>
            {
                if (state == PlayModeStateChange.EnteredPlayMode)
                    Debug.Log("SIMUS_PLAY_MODE_ENTERED");
            };
            EditorApplication.EnterPlaymode();
        }
    }

    [InitializeOnLoad]
    internal static class PreviewPlayVerification
    {
        static PreviewPlayVerification()
        {
            if (!Application.isBatchMode || !Environment.GetCommandLineArgs().Contains("-simusVerifyPlay")) return;
            EditorApplication.update += Tick;
        }

        private static void Tick()
        {
            if (!EditorApplication.isPlaying) return;
            int frames = SessionState.GetInt("SIMUS_PLAY_FRAMES", 0) + 1;
            SessionState.SetInt("SIMUS_PLAY_FRAMES", frames);
            if (frames < 100) return;
            Camera camera = Camera.main;
            var controller = camera == null ? null : camera.GetComponent<CityPreviewCamera>();
            if (controller == null || !camera.orthographic) throw new InvalidOperationException("Preview camera failed to start.");
            controller.TopView();
            if (Vector3.Dot(camera.transform.forward, Vector3.down) < 0.999f) throw new InvalidOperationException("Top view failed.");
            controller.Overview();
            Debug.Log("SIMUS_PLAY_MODE_VERIFIED: 100 editor frames, overview/top-view/reset passed.");
            EditorApplication.Exit(0);
        }
    }
}
