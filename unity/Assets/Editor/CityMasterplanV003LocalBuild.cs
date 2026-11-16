using System;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using Newtonsoft.Json.Linq;
using Simus;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;

// Local validation only. Does not edit the reviewed source scene or build settings.
public static class CityMasterplanV003LocalBuild
{
    public const string ScenePath = "Assets/SIMUS/Scenes/city_masterplan_v003/CityMasterplan_v003_EventPlaces.unity";
    public const string MapVersion = "city-masterplan-v003-local-v1";
    public const string PathVersion = "city-masterplan-v003-plaza30-v1";
    static readonly Vector3[] Points = { new Vector3(44.35f,.202832f,65), new Vector3(44.35f,.301893f,72), new Vector3(44.35f,.412014f,79) };
    static string ReportPath => Environment.GetEnvironmentVariable("SIMUS_V003_AUDIT_OUTPUT") ?? "Logs/v003-local-physics.json";
    static string Hash(string path) { using(var sha=SHA256.Create()) return BitConverter.ToString(sha.ComputeHash(File.ReadAllBytes(path))).Replace("-", "").ToLowerInvariant(); }
    static string Hierarchy(Transform t) => t.parent == null ? t.name : Hierarchy(t.parent)+"/"+t.name;
    public static void Audit()
    {
        var scene=EditorSceneManager.OpenScene(ScenePath);
        Physics.SyncTransforms();
        var samples=new JArray(); var blocked=new JArray(); bool passed=true;
        for(int leg=0;leg<Points.Length-1;leg++) for(int i=0;i<=28;i++) {
            var point=Vector3.Lerp(Points[leg],Points[leg+1],i/28f);
            var hits=Physics.RaycastAll(point+Vector3.up*2,Vector3.down,4,Physics.DefaultRaycastLayers,QueryTriggerInteraction.Ignore)
                .Where(h=>h.normal.y>.5f).OrderBy(h=>Mathf.Abs(h.point.y-point.y)).ToArray();
            bool supported=hits.Length>0 && Mathf.Abs(hits[0].point.y-point.y)<.3f;
            samples.Add(new JObject { ["point"]=new JArray(point.x,point.y,point.z), ["supported"]=supported,["surface"]=hits.Length>0?Hierarchy(hits[0].transform):null,["surface_y"]=hits.Length>0?(double?)hits[0].point.y:null });
            if(!supported)passed=false;
            if(supported) point.y=hits[0].point.y+.02f;
            // Capsule body starts above the ankle; floor below is excluded geometrically.
            foreach(var col in Physics.OverlapCapsule(point+Vector3.up*.38f,point+Vector3.up*1.45f,.28f,Physics.DefaultRaycastLayers,QueryTriggerInteraction.Ignore)) {
                blocked.Add(new JObject{["point"]=new JArray(point.x,point.y,point.z),["collider"]=Hierarchy(col.transform)}); passed=false;
            }
        }
        var anchors=new JArray(scene.GetRootGameObjects().SelectMany(g=>g.GetComponentsInChildren<Transform>(true)).Where(t=>t.name.StartsWith("FULL_EVENT_30_")||t.name=="EVS_30").Select(t=>new JObject{["path"]=Hierarchy(t),["position"]=new JArray(t.position.x,t.position.y,t.position.z)}));
        var report=new JObject{["source_scene"]=ScenePath,["source_scene_sha256"]=Hash(ScenePath),["map_version"]=MapVersion,["path_version"]=PathVersion,["passed"]=passed,["samples"]=samples,["blocking_capsule_overlaps"]=blocked,["anchors"]=anchors,["route_distance_m"]=14,["speed_mps"]=1.4,["nominal_travel_seconds"]=10};
        Directory.CreateDirectory(Path.GetDirectoryName(ReportPath)); File.WriteAllText(ReportPath,report.ToString()); Debug.Log("V003_LOCAL_PHYSICS "+passed+" "+ReportPath);
        if(!passed)throw new InvalidOperationException("Representative route failed physical audit; see JSON.");
    }
    public static void Build()
    {
        Audit();
        if(!BuildPipeline.IsBuildTargetSupported(BuildTargetGroup.WebGL,BuildTarget.WebGL))throw new InvalidOperationException("Install Unity 6000.3.24f1 Web Build Support (5.05 GB installed). Source scene was preserved.");
        var scene=EditorSceneManager.GetActiveScene();
        foreach(var c in UnityEngine.Object.FindObjectsByType<Camera>(FindObjectsSortMode.None)) c.enabled=false;
        var camObject=new GameObject("Local participant camera"); camObject.tag="MainCamera"; var cam=camObject.AddComponent<Camera>(); cam.farClipPlane=1500;
        var follow=camObject.AddComponent<CityPreviewCamera>(); follow.previewControls=false; follow.followSize=9;follow.followPitch=45;follow.followYaw=-35;follow.target=Points[0];follow.overviewTarget=Points[0];follow.overviewSize=9;follow.smoothFollowTransitions=true;follow.occlusionShader=Shader.Find("SIMUS/NPC Reveal");
        var npcScene=EditorSceneManager.OpenScene("Assets/SIMUS/Scenes/npc_follow_test/CompletedMapNpcFollow.unity",OpenSceneMode.Additive);
        var patrol=npcScene.GetRootGameObjects().SelectMany(g=>g.GetComponentsInChildren<TestNpcPatrol>(true)).First();
        var template=UnityEngine.Object.Instantiate(patrol.gameObject); UnityEngine.SceneManagement.SceneManager.MoveGameObjectToScene(template,scene);
        foreach(var p in template.GetComponents<TestNpcPatrol>())UnityEngine.Object.DestroyImmediate(p);
        template.name="SIMUS animated participant template";template.transform.position=Vector3.zero; template.SetActive(false);
        EditorSceneManager.CloseScene(npcScene,true);
        var bridge=new GameObject("SIMUS Web Bridge").AddComponent<WebCityBridge>();bridge.mapVersion=MapVersion;bridge.followCamera=follow;bridge.npcTemplate=template;
        const string temp="Assets/SIMUS/Scenes/city_masterplan_v003/CityMasterplan_v003_LocalRuntime.unity";
        if(File.Exists(temp))throw new InvalidOperationException("Temporary scene exists; refusing overwrite.");
        var output=Environment.GetEnvironmentVariable("SIMUS_V003_WEBGL_OUTPUT")??"Builds/city_masterplan_v003_local";
        var oldTemplate=PlayerSettings.WebGL.template;var oldCompression=PlayerSettings.WebGL.compressionFormat;
        try {
            EditorSceneManager.SaveScene(scene,temp);PlayerSettings.WebGL.template="PROJECT:simus_city";PlayerSettings.WebGL.compressionFormat=WebGLCompressionFormat.Disabled;
            var result=BuildPipeline.BuildPlayer(new BuildPlayerOptions{scenes=new[]{temp},locationPathName=output,target=BuildTarget.WebGL,options=BuildOptions.None});
            if(result.summary.result!=BuildResult.Succeeded)throw new InvalidOperationException("v003 WebGL build failed");
            File.WriteAllText(Path.Combine(output,"build.json"),new JObject{["kind"]="city-masterplan-v003-local-session",["protocol_version"]=1,["map_version"]=MapVersion,["path_versions"]=new JArray(PathVersion),["source_scene_sha256"]=Hash(ScenePath),["npc_motion_enabled"]=true,["exhibition_ready"]=false}.ToString());
        } finally {PlayerSettings.WebGL.template=oldTemplate;PlayerSettings.WebGL.compressionFormat=oldCompression;EditorSceneManager.NewScene(NewSceneSetup.EmptyScene);AssetDatabase.DeleteAsset(temp);}
    }
}
