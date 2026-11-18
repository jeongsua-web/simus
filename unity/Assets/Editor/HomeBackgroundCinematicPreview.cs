using System;
using System.IO;
using System.Linq;
using Newtonsoft.Json.Linq;
using Simus.HomeBackground;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using Object = UnityEngine.Object;

// Look-development only. Never saves a scene or replaces the published video.
public static class HomeBackgroundCinematicPreview
{
    static string Output => Environment.GetEnvironmentVariable("SIMUS_HOME_CINEMATIC_OUTPUT") ?? Path.GetFullPath("Logs/HomeBackgroundCinematicPreview");
    static readonly Vector2[] Boundary = {
        new Vector2(-230,-180), new Vector2(195,-180), new Vector2(265,-95), new Vector2(265,205),
        new Vector2(185,280), new Vector2(-185,280), new Vector2(-230,220)
    };

    [MenuItem("SIMUS/Home Background/3 Preview cinematic framing")]
    public static void Capture()
    {
        if (!Application.isBatchMode && !EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;
        EditorSceneManager.OpenScene(HomeBackgroundCapture.Scene);
        var view = GameObject.Find("Home Background Camera").GetComponent<Camera>();
        var motion = Object.FindFirstObjectByType<HomeBackgroundMotion>();
        ConfigureView(view);
        foreach (var walker in motion.walkers) { walker.animator.Rebind(); walker.animator.Update(0); }
        // Three locations on the intended neighbourhood tour, not the city overview.
        var targets = new[] { new Vector3(44, 3, 32), new Vector3(40, 5, 143), new Vector3(168, 3, 110) };
        var yaws = new[] { -24f, -25f, 78f };
        var distances = new[] { 94f, 100f, 90f };
        var names = new[] { "01-shopping-street", "02-campus", "03-park-neighbourhood" };
        PlaceCitizens(motion, targets);
        PlaceTraffic();
        var result = new JArray();
        Directory.CreateDirectory(Output);
        var target = new RenderTexture(1920, 1080, 24) { antiAliasing = 4 };
        var softened = new RenderTexture(1920, 1080, 0);
        var pixels = new Texture2D(1920, 1080, TextureFormat.RGB24, false);
        var effect = new Material(Shader.Find("Hidden/SIMUS/HomeBackgroundEdgeSoftness"));
        var active = RenderTexture.active;
        try
        {
            view.targetTexture = target;
            for (int i = 0; i < targets.Length; i++)
            {
                motion.Evaluate(i * 3);
                view.transform.rotation = Quaternion.Euler(34, yaws[i], 0);
                view.transform.position = targets[i] - view.transform.forward * distances[i];
                var corners = new JArray();
                foreach (var viewport in new[] { new Vector3(0,0), new Vector3(1,0), new Vector3(1,1), new Vector3(0,1) })
                {
                    var ray = view.ViewportPointToRay(viewport);
                    if (!new Plane(Vector3.up, Vector3.zero).Raycast(ray, out var distance)) throw new InvalidOperationException("Horizon visible.");
                    var point = ray.GetPoint(distance);
                    if (!Inside(new Vector2(point.x, point.z))) throw new InvalidOperationException($"Map edge in {names[i]}: {point}");
                    corners.Add(new JArray(point.x, point.y, point.z));
                }
                view.Render(); Graphics.Blit(target, softened, effect); RenderTexture.active = softened;
                pixels.ReadPixels(new Rect(0,0,1920,1080),0,0); pixels.Apply();
                File.WriteAllBytes(Path.Combine(Output, names[i] + ".jpg"), pixels.EncodeToJPG(96));
                result.Add(new JObject { ["frame"] = names[i], ["target"] = new JArray(targets[i].x,targets[i].y,targets[i].z),
                    ["yaw"] = yaws[i], ["pitch"] = 34, ["distance"] = distances[i], ["fov"] = view.fieldOfView,
                    ["ground_frustum_corners_inside_map"] = true, ["ground_corners"] = corners });
            }
            File.WriteAllText(Path.Combine(Output, "framing.json"), result.ToString());
        }
        finally
        {
            view.targetTexture = null; RenderTexture.active = active;
            target.Release(); softened.Release(); Object.DestroyImmediate(target); Object.DestroyImmediate(softened);
            Object.DestroyImmediate(pixels); Object.DestroyImmediate(effect);
        }
        // Discard lighting/camera changes; preserve the previous filming scene on disk.
        EditorSceneManager.NewScene(NewSceneSetup.EmptyScene);
        Debug.Log("HOME_CINEMATIC_PREVIEW_COMPLETE " + Output);
    }

    public static void ConfigureView(Camera view)
    {
        view.orthographic = false; view.fieldOfView = 27; view.aspect = 16f / 9;
        view.nearClipPlane = .3f; view.farClipPlane = 700;
        view.allowHDR = false; view.allowMSAA = true;
        RenderSettings.ambientMode = AmbientMode.Trilight;
        RenderSettings.ambientSkyColor = new Color(.60f, .66f, .72f);
        RenderSettings.ambientEquatorColor = new Color(.50f, .55f, .52f);
        RenderSettings.ambientGroundColor = new Color(.32f, .36f, .30f);
        RenderSettings.ambientIntensity = 1.15f;
        RenderSettings.fog = false;
        var sun = Object.FindObjectsByType<Light>(FindObjectsSortMode.None).First(l => l.type == LightType.Directional);
        sun.transform.rotation = Quaternion.Euler(40, -45, 0);
        sun.color = new Color(1, .96f, .87f); sun.intensity = 1.05f;
        sun.shadows = LightShadows.Soft; sun.shadowStrength = .42f;
        sun.shadowBias = .04f; sun.shadowNormalBias = .25f;
        QualitySettings.shadowDistance = 250; QualitySettings.shadowResolution = ShadowResolution.High;
        QualitySettings.shadowCascades = 4; QualitySettings.antiAliasing = 4;
    }

    static void PlaceTraffic()
    {
        var names = new[] { "EVS_12_taxi_v001", "EVS_07_city_state_saf_car_normal_01", "EVS_04_city_bus_v001" };
        var points = new[] { new Vector3(12,.1f,47), new Vector3(65,.1f,53), new Vector3(98,.1f,47) };
        for (int i = 0; i < names.Length; i++)
        {
            var template = GameObject.Find(names[i]);
            if (template == null) throw new InvalidOperationException("Existing vehicle missing: " + names[i]);
            var vehicle = Object.Instantiate(template); vehicle.name = "Cinematic preview vehicle " + i;
            vehicle.transform.position = points[i]; vehicle.transform.rotation = Quaternion.Euler(0,i == 1 ? 270 : 90,0);
        }
    }

    public static void PlaceCitizens(HomeBackgroundMotion motion, Vector3[] targets)
    {
        string routes = Environment.GetEnvironmentVariable("SIMUS_HOME_ROUTES") ?? Path.GetFullPath("../docs/planning/city_masterplan_v003/routes.json");
        var candidates = new System.Collections.Generic.List<Vector3[]>();
        Physics.SyncTransforms();
        foreach (var edge in (JArray)JObject.Parse(File.ReadAllText(routes))["edges"])
        {
            var points = edge["points"].Select(p => new Vector3((float)p[0],(float)p[1],(float)p[2])).ToArray();
            for (int leg = 0; leg < points.Length-1; leg++)
            {
                var a = points[leg]; var b = points[leg+1];
                int samples = Mathf.FloorToInt(Vector3.Distance(a,b) / 14);
                for (int sample = 0; sample < samples; sample++)
                {
                    var centre = Vector3.Lerp(a,b,(sample+.5f)/samples);
                    var direction = (b-a).normalized;
                    var from = centre-direction*3; var to = centre+direction*3;
                    bool safe = true;
                    for (int step = 0; step <= 12; step++)
                    {
                        var p = Vector3.Lerp(from,to,step/12f);
                        var hit = Physics.RaycastAll(p+Vector3.up*2,Vector3.down,4)
                            .Where(h => h.normal.y > .8f && (h.transform.name.ToUpperInvariant().Contains("WALK") || h.transform.name.ToUpperInvariant().Contains("PATH")))
                            .OrderBy(h => Mathf.Abs(h.point.y-p.y)).FirstOrDefault();
                        if (hit.collider == null) { safe=false;break; }
                        p.y=hit.point.y+.03f;
                        if (Physics.OverlapCapsule(p+Vector3.up*.4f,p+Vector3.up*1.4f,.25f).Any(c=>c!=hit.collider && !c.isTrigger)) { safe=false;break; }
                        if (step==0) from=p;
                        if (step==12) to=p;
                    }
                    if(safe)candidates.Add(new[]{from,to});
                }
            }
        }
        int perGroup = Mathf.CeilToInt(motion.walkers.Length / (float)targets.Length);
        var groups = targets.Select(t=>candidates.OrderBy(p=>Vector3.SqrMagnitude((p[0]+p[1])*.5f-t)).Take(perGroup).ToArray()).ToArray();
        if(groups.Any(g=>g.Length<perGroup)) throw new InvalidOperationException("Not enough supported pedestrian segments.");
        for(int i=0;i<motion.walkers.Length;i++)
        {
            var points=groups[i%groups.Length][i/groups.Length];
            motion.walkers[i].from=points[0];motion.walkers[i].to=points[1];
        }
        Debug.Log("HOME_CINEMATIC_SUPPORTED_SEGMENTS " + candidates.Count);
    }

    static bool Inside(Vector2 point)
    {
        bool inside = false;
        for (int i = 0, j = Boundary.Length - 1; i < Boundary.Length; j = i++)
        {
            var a = Boundary[i]; var b = Boundary[j];
            if ((a.y > point.y) != (b.y > point.y) && point.x < (b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x) inside = !inside;
            // Keep at least eight metres from the outer boundary at all corners.
            var direction = b-a;
            var nearest = a + direction * Mathf.Clamp01(Vector2.Dot(point-a,direction)/direction.sqrMagnitude);
            if (Vector2.Distance(point, nearest) < 8) return false;
        }
        return inside;
    }
}
