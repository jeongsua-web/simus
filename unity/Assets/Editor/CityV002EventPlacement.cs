using System;
using System.IO;
using System.Linq;
using Newtonsoft.Json.Linq;
using UnityEditor;
using UnityEditor.Animations;
using Simus;
using UnityEditor.SceneManagement;
using UnityEngine;

// Edit-mode placement only. Never enters Play Mode, runs QA, or builds players.
public static class CityV002EventPlacement
{
    const string Out = "../docs/placement/";
    static JArray V(Vector3 v) => new JArray(v.x,v.y,v.z);
    static Bounds B(GameObject go) { var rs=go.GetComponentsInChildren<Renderer>(false); if(rs.Length==0)return new Bounds(go.transform.position,Vector3.zero); var b=rs[0].bounds;foreach(var r in rs.Skip(1))b.Encapsulate(r.bounds);return b; }
    static string P(Transform t) => t.parent==null?t.name:P(t.parent)+"/"+t.name;
    public static void Analyze()
    {
        Directory.CreateDirectory(Out);
        var scene=EditorSceneManager.OpenScene(CityRebuildV002Setup.ScenePath);
        var data=new JObject { ["scene"]=scene.path,["unity"]=Application.unityVersion,["active_target"]=EditorUserBuildSettings.activeBuildTarget.ToString(),["roots"]=new JArray(scene.GetRootGameObjects().Select(g=>g.name)),["structure"]=new JArray(scene.GetRootGameObjects().SelectMany(g=>g.GetComponentsInChildren<Transform>(true)).Where(t=>t.childCount>0&&t.name!="Armature").Select(t=>(JToken)new JObject{["path"]=P(t),["position"]=V(t.position),["size"]=V(B(t.gameObject).size)})) };
        var assets=new JArray();
        var paths=AssetDatabase.FindAssets("t:GameObject",new[]{"Assets/SIMUS/Prefabs"}).Select(AssetDatabase.GUIDToAssetPath).Concat(new[]{"Assets/SIMUS/Art/roads/city_infrastructure/City_Infrastructure.fbx","Assets/SIMUS/Art/maps/university_v003/SIMUS_Dense_Realistic_University_Map_03.fbx","Assets/SIMUS/Art/props/props/PLANTER.fbx","Assets/SIMUS/Art/props/city_state_v001/models/CLN_BIN_NORMAL_01.fbx","Assets/SIMUS/Art/props/city_state_v001/models/SAF_CAR_NORMAL_01.fbx","Assets/SIMUS/Art/characters/role_variants_v001/models/SIMUS_NPC_Police.fbx","Assets/SIMUS/Art/characters/role_variants_v001/models/SIMUS_NPC_Criminal.fbx","Assets/SIMUS/Art/characters/role_variants_v001/models/SIMUS_NPC_Cleaner.fbx","Assets/SIMUS/Art/props/city_state_v001/models/HAP_PLANTER_HEALTHY_01.fbx"});
        foreach(var path in paths) {
            var asset=AssetDatabase.LoadAssetAtPath<GameObject>(path);if(asset==null){assets.Add(new JObject{["path"]=path,["missing"]=true});continue;}
            var go=(GameObject)PrefabUtility.InstantiatePrefab(asset);var b=B(go);
            assets.Add(new JObject{["path"]=path,["min"]=V(b.min),["max"]=V(b.max),["size"]=V(b.size),["meshes"]=new JArray(go.GetComponentsInChildren<Renderer>(true).Select(r=>r.name)),["clips"]=new JArray(AssetDatabase.LoadAllAssetsAtPath(path).OfType<AnimationClip>().Where(c=>!c.name.StartsWith("__")).Select(c=>c.name))});
            UnityEngine.Object.DestroyImmediate(go);
        }
        data["assets"]=assets;File.WriteAllText(Out+"city-v002-event-analysis.json",data.ToString());
        Debug.Log("EVENT_PLACEMENT_ANALYSIS_WRITTEN");
    }

    const string Config = "Assets/SIMUS/Scenes/city_rebuild_v002/event_placement";
    const string Pref = "Assets/SIMUS/Prefabs/";
    static Transform additions;
    static JArray placed;
    static Transform Group(string name, Transform parent) {var g=new GameObject(name);g.transform.SetParent(parent,false);return g.transform;}
    static float Floor(float x,float z) {
        Physics.SyncTransforms();
        var hits=Physics.RaycastAll(new Vector3(x,60,z),Vector3.down,100).Where(h=>!h.transform.IsChildOf(additions)&&h.normal.y>.8f&&h.point.y<1).OrderByDescending(h=>h.point.y).ToArray();
        return hits.Length==0?-.02f:hits[0].point.y;
    }
    static GameObject Place(string id,string category,string path,float x,float z,float yaw=0,bool preserveOrigin=false) {
        var asset=AssetDatabase.LoadAssetAtPath<GameObject>(path);if(asset==null)throw new InvalidOperationException("Missing existing asset: "+path);
        var wrapper=Group(id,additions);var go=(GameObject)PrefabUtility.InstantiatePrefab(asset,wrapper);
        wrapper.position=new Vector3(x,Floor(x,z),z);wrapper.rotation=Quaternion.Euler(0,yaw,0);
        if(!preserveOrigin) {var b=B(go);go.transform.position+=new Vector3(x-b.center.x,wrapper.position.y-b.min.y,z-b.center.z);}
        foreach(var l in go.GetComponentsInChildren<Light>(true))l.enabled=false;
        var item=new JObject{["id"]=id,["category"]=category,["source"]=path,["position"]=V(wrapper.position),["yaw"]=yaw,["scale"]=V(wrapper.localScale),["ground_y"]=wrapper.position.y,["bounds_min"]=V(B(go).min),["bounds_max"]=V(B(go).max),["mode"]="static existing asset",["path"]=P(wrapper)};placed.Add(item);
        return go;
    }
    static void Pose(GameObject go,string fbx,string clipName,string controllerName) {
        var clip=AssetDatabase.LoadAllAssetsAtPath(fbx).OfType<AnimationClip>().First(c=>c.name==clipName);
        var animator=go.GetComponentInChildren<Animator>();if(animator==null)animator=go.AddComponent<Animator>();
        var destination=Config+"/"+controllerName+".controller";
        var controller=AssetDatabase.LoadAssetAtPath<AnimatorController>(destination);
        if(controller==null)controller=AnimatorController.CreateAnimatorControllerAtPath(destination);
        var machine=controller.layers[0].stateMachine;
        var state=machine.states.Select(s=>s.state).FirstOrDefault(s=>s.name==clipName);
        if(state==null)state=machine.AddState(clipName);state.motion=clip;machine.defaultState=state;EditorUtility.SetDirty(controller);
        animator.runtimeAnimatorController=controller;animator.applyRootMotion=false;
        clip.SampleAnimation(animator.gameObject,.25f);
        foreach(var t in animator.GetComponentsInChildren<Transform>(true))EditorUtility.SetDirty(t);
        EditorUtility.SetDirty(animator);
    }
    static void Walk(GameObject go,string edgeId,float speed) {
        var layout=JObject.Parse(File.ReadAllText("../docs/planning/city_rebuild_v002/layout.json"));
        var edge=layout["pedestrian_edges"].First(e=>(string)e["id"]==edgeId);var pts=edge["points"];
        var a=pts.First;var b=pts.Last;
        var root=Group(go.transform.parent.name+"_ExistingPatrolEndpoints",additions);
        var start=Group("Start",root);var end=Group("End",root);
        start.position=new Vector3((float)a[0],.16f,(float)a[1]);end.position=new Vector3((float)b[0],.16f,(float)b[1]);
        var actor=go.transform.parent.gameObject;actor.transform.position=start.position;
        var patrol=actor.AddComponent<TestNpcPatrol>();patrol.startPoint=start;patrol.endPoint=end;patrol.speed=speed;
        actor.AddComponent<NpcGrounding>();
        var row=(JObject)placed.Last;row["position"]=V(actor.transform.position);row["mode"]="existing TestNpcPatrol + NpcGrounding; configured, Play Mode not run";row["graph_edge"]=edgeId;row["patrol_start"]=V(start.position);row["patrol_end"]=V(end.position);row["speed_m_s"]=speed;row["bounds_min"]=V(B(go).min);row["bounds_max"]=V(B(go).max);
    }
    static void BusStop() {
        string path="Assets/SIMUS/Art/maps/university_v003/SIMUS_Dense_Realistic_University_Map_03.fbx";
        var asset=AssetDatabase.LoadAssetAtPath<GameObject>(path);var source=(GameObject)PrefabUtility.InstantiatePrefab(asset);
        var wrapper=Group("ENV_BusStop_R01",additions);
        foreach(var r in source.GetComponentsInChildren<MeshRenderer>(true).Where(r=>r.name=="D03_UNITY_D03_BUS_PLATFORM"||r.name.Contains("D03_UNITY_D03_REUSED_R02_BUS_"))) {
            var child=UnityEngine.Object.Instantiate(r.gameObject,wrapper,true);child.name=r.name;
        }
        UnityEngine.Object.DestroyImmediate(source);
        var bounds=B(wrapper.gameObject);wrapper.position+=new Vector3(54-bounds.center.x,Floor(54,-55)-bounds.min.y,-55-bounds.center.z);
        placed.Add(new JObject{["id"]=wrapper.name,["category"]="bus_stop",["source"]=path,["source_parts"]=new JArray(wrapper.GetComponentsInChildren<MeshRenderer>().Select(r=>r.name)),["position"]=V(wrapper.position),["bounds_min"]=V(B(wrapper.gameObject).min),["bounds_max"]=V(B(wrapper.gameObject).max),["mode"]="five existing model parts; original city coordinates discarded",["path"]=P(wrapper)});
    }
    static void CopyController(GameObject go,string name,string parameter,int value,string sampleName) {
        var animator=go.GetComponentInChildren<Animator>();var source=AssetDatabase.GetAssetPath(animator.runtimeAnimatorController);var dst=Config+"/"+name+".controller";
        if(AssetDatabase.LoadAssetAtPath<AnimatorController>(dst)==null&&!AssetDatabase.CopyAsset(source,dst))throw new InvalidOperationException("Cannot copy existing animator config "+source);
        var controller=AssetDatabase.LoadAssetAtPath<AnimatorController>(dst);var parameters=controller.parameters;
        foreach(var p in parameters)if(p.name==parameter){p.defaultInt=value;p.defaultBool=value!=0;}
        controller.parameters=parameters;EditorUtility.SetDirty(controller);animator.runtimeAnimatorController=controller;
        var state=controller.layers[0].stateMachine.states.Select(s=>s.state).FirstOrDefault(s=>s.name==sampleName);
        var clip=state==null?controller.animationClips.FirstOrDefault(c=>c.name==sampleName):state.motion as AnimationClip;if(clip!=null)clip.SampleAnimation(animator.gameObject,.25f);
        foreach(var t in animator.GetComponentsInChildren<Transform>(true))EditorUtility.SetDirty(t);
    }
    public static void Apply() {
        if(EditorApplication.isPlayingOrWillChangePlaymode)throw new InvalidOperationException("Edit Mode only");
        var scene=EditorSceneManager.OpenScene(CityRebuildV002Setup.ScenePath);
        if(GameObject.Find("SIMUS_EventPlacement_20261020")!=null)throw new InvalidOperationException("Already placed; no automatic subsequent edits before user approval");
        Directory.CreateDirectory(Config);AssetDatabase.Refresh();
        additions=new GameObject("SIMUS_EventPlacement_20261020").transform;placed=new JArray();
        // Existing crossing stripes are preserved; signals face approaching users (+Z display normal).
        Place("ENV_VehicleSignal_J01_NE","vehicle_signal",Pref+"props/traffic_signal_vehicle_v001/SIMUS_TrafficSignal_Vehicle.prefab",-88.4f,-53.2f,0,true);
        Place("ENV_VehicleSignal_J01_SW","vehicle_signal",Pref+"props/traffic_signal_vehicle_v001/SIMUS_TrafficSignal_Vehicle.prefab",-102,-68.5f,180,true);
        Place("ENV_PedSignal_Gate_N","pedestrian_signal",Pref+"props/traffic_signal_pedestrian_v001/SIMUS_TrafficSignal_Pedestrian.prefab",2.1f,-55.4f,180,true);
        Place("ENV_PedSignal_Gate_S","pedestrian_signal",Pref+"props/traffic_signal_pedestrian_v001/SIMUS_TrafficSignal_Pedestrian.prefab",-2.1f,-66.7f,0,true);
        BusStop();
        string bin="Assets/SIMUS/Art/props/city_state_v001/models/CLN_BIN_NORMAL_01.fbx";
        Place("ENV_Bin_ParkSouth","trash_bin",bin,142,18);
        Place("ENV_Bin_ParkNorth","trash_bin",bin,151,119);
        Place("ENV_Bin_Plaza","trash_bin",bin,14,109);
        Place("ENV_Bin_BusStop","trash_bin",bin,60,-54);
        Place("ENV_Bin_Residential","trash_bin",bin,-180,83);
        Place("ENV_Parking_EastCommercial_14Spaces","parking_lot",Pref+"roads/outdoor_parking_v001/SIMUS_Outdoor_ParkingLot_Complete.prefab",166,-125);
        Place("ENV_Cafe_EastCommercial","cafe",Pref+"buildings/commercial_cafe_v001/SIMUS_Commercial_Cafe.prefab",140,-78,0);
        Place("ENV_Restaurant_EastCommercial","restaurant",Pref+"buildings/commercial_restaurant_v001/SIMUS_Commercial_Restaurant.prefab",153,-99,0);
        Place("ENV_Subway_Entrance_SurfaceOnly","subway",Pref+"buildings/subway_entrance_v001/SIMUS_Subway_Entrance.prefab",77,-47,90,true);
        Place("ENV_Recycle_ApartmentWest","recycle_station",Pref+"props/recycle_station_v001/SIMUS_Recycle_Station_Complete.prefab",-174,119,180);
        Place("ENV_Recycle_SouthHousing","recycle_station",Pref+"props/recycle_station_v001/SIMUS_Recycle_Station_Complete.prefab",53,-216,0);
        string flowers="Assets/SIMUS/Art/vegetation/street_landscape/SIMUS_Flowerbed.fbx";
        Place("ENV_Flowerbed_ParkSouth","flowerbed",flowers,144,12);
        Place("ENV_Flowerbed_ParkNorth","flowerbed",flowers,154,126);
        Place("ENV_Festival_Info_Plaza","festival_booth",Pref+"props/festival_booth_v001/SIMUS_Festival_Booth_Info.prefab",14,104,0);
        Place("ENV_Festival_Food_Plaza","festival_booth",Pref+"props/festival_booth_v001/SIMUS_Festival_Booth_Food.prefab",19,104,0);
        Place("ENV_Festival_Game_Plaza","festival_booth",Pref+"props/festival_booth_v001/SIMUS_Festival_Booth_Game.prefab",24,104,0);
        Place("ENV_PublicToilet_ParkNorth","public_toilet",Pref+"props/public_toilet_v001/SIMUS_Public_Toilet.prefab",158,139,180);
        Place("ENV_Barricade_R01_Control","barricade",Pref+"props/road_control_v001/SIMUS_Barricade_01.prefab",86,-62.7f,0);
        for(int i=0;i<4;i++)Place("ENV_Cone_R01_Control_"+(i+1),"traffic_cone",Pref+"props/road_control_v001/SIMUS_TrafficCone_01.prefab",82+i*2.5f,-62.7f);
        Place("ENV_MysteryCrate_Plaza","mystery_crate",Pref+"props/mystery_crate_v001/SIMUS_MysteryCrate.prefab",15,118,25);
        var child=Place("NPC_CryingChild_ParkSouth","crying_child",Pref+"characters/crying_child_v001/SIMUS_NPC_CryingChild.prefab",148,22,240,true);CopyController(child,"crying_child_scene","Emotion",1,"CryLoop");
        var police=Place("NPC_Police_Gate","police","Assets/SIMUS/Art/characters/role_variants_v001/models/SIMUS_NPC_Police.fbx",6,-52,180,true);Pose(police,"Assets/SIMUS/Art/characters/role_variants_v001/models/SIMUS_NPC_Police.fbx","Idle","police_idle");
        var criminal=Place("NPC_Criminal_PlazaEdge","criminal","Assets/SIMUS/Art/characters/role_variants_v001/models/SIMUS_NPC_Criminal.fbx",27,117,220,true);Pose(criminal,"Assets/SIMUS/Art/characters/role_variants_v001/models/SIMUS_NPC_Criminal.fbx","Idle","criminal_idle");
        string cleanerPath="Assets/SIMUS/Art/characters/role_variants_v001/models/SIMUS_NPC_Cleaner.fbx";
        for(int i=0;i<2;i++) {
            var citizen=Place("NPC_SIMUS_CityCitizen_"+(i+1),"city_citizen",cleanerPath,-34.965f,62.926f,90,true);
            foreach(var t in citizen.GetComponentsInChildren<Transform>(true))if(t.name=="CLEANER_Broom_Hand_Held"||t.name=="CLEANER_Collection_Cart")t.gameObject.SetActive(false);
            Pose(citizen,cleanerPath,"Walk","city_citizen_"+(i+1)+"_walk");Walk(citizen,i==0?"C04_LINK_S1":"C09_LINK_S1",1.0f);
        }
        var carrier=Place("NPC_HeavyCarrier_ApartmentWalk","heavy_carrier",Pref+"characters/heavy_carrier_v001/SIMUS_NPC_HeavyCarrier.prefab",-186.85f,124.355f,180,true);CopyController(carrier,"heavy_carrier_scene","Walking",1,"CarryWalk");Walk(carrier,"B16_BRANCH_S0",.24f);
        string car="Assets/SIMUS/Art/props/city_state_v001/models/SAF_CAR_NORMAL_01.fbx";
        Place("VEH_Car_R01","car",car,-55,-59.3f,90);
        var parked=Place("VEH_Car_Parking","car",car,156,-123,0);
        Physics.SyncTransforms();var supports=Physics.RaycastAll(new Vector3(156,4,-123),Vector3.down,6).Where(h=>!h.transform.IsChildOf(parked.transform.parent)&&h.normal.y>.8f&&h.point.y<1).OrderByDescending(h=>h.point.y).ToArray();if(supports.Length>0)parked.transform.parent.position+=Vector3.up*(supports[0].point.y-B(parked).min.y);
        Place("VEH_Bus_R01_Stop","bus",Pref+"props/city_bus_v001/SIMUS_City_Bus.prefab",54,-59.4f,90);
        Place("VEH_Taxi_R01_Commercial","taxi",Pref+"props/taxi_v001/SIMUS_Taxi.prefab",19,-63,270);
        Place("VEH_IllegalParked_R05","illegal_car",car,-143,-6.7f,85);
        // One save and reopen: inventory below describes serialized placements, not an unsaved plan.
        Physics.SyncTransforms();EditorSceneManager.MarkSceneDirty(scene);if(!EditorSceneManager.SaveScene(scene))throw new IOException("Unity could not save placement scene; no completed placement reported.");AssetDatabase.SaveAssets();
        scene=EditorSceneManager.OpenScene(CityRebuildV002Setup.ScenePath);additions=GameObject.Find("SIMUS_EventPlacement_20261020").transform;
        foreach(JObject row in placed) {var t=additions.Find((string)row["id"]);row["saved_present"]=t!=null;if(t!=null){row["position"]=V(t.position);row["bounds_min"]=V(B(t.gameObject).min);row["bounds_max"]=V(B(t.gameObject).max);}}
        File.WriteAllText(Out+"city-v002-event-placement-results.json",new JObject{["scene"]=scene.path,["status"]="SAVED_EDIT_MODE_PLACEMENT; QA awaits user approval",["placement_count"]=placed.Count,["existing_crossing_groups"]=GameObject.Find("CityRebuild_v002").transform.Find("05_CrossingFacilities_17").childCount,["river_reused"]=GameObject.Find("CityRebuild_v002").transform.Find("12_River_Phase4")!=null,["instances"]=placed,["play_mode_executed"]=false,["build_executed"]=false,["qa_executed"]=false}.ToString());
        Capture("overview",new Vector3(-15,0,-27),270,new Vector3(65,0,0));
        Capture("plaza",new Vector3(15,0,112),26,new Vector3(58,0,0));
        Capture("commerce",new Vector3(130,0,-85),63,new Vector3(60,0,0));
        Capture("park",new Vector3(146,0,102),70,new Vector3(65,0,0));
        Capture("child_and_flowers",new Vector3(146,0,20),13,new Vector3(48,0,0));
        Capture("road_and_stop",new Vector3(45,0,-57),46,new Vector3(60,0,0));
        Capture("residential_carrier",new Vector3(-182,0,123),18,new Vector3(65,180,0));
        Debug.Log("EVENT_PLACEMENT_SAVED_AWAITING_USER_APPROVAL count="+placed.Count);
    }
    static void Capture(string name,Vector3 target,float size,Vector3 euler) {
        var go=new GameObject("Temporary placement capture camera");var camera=go.AddComponent<Camera>();camera.orthographic=true;camera.orthographicSize=size;camera.farClipPlane=1000;camera.nearClipPlane=.1f;camera.backgroundColor=new Color(.62f,.74f,.81f);camera.clearFlags=CameraClearFlags.SolidColor;
        go.transform.rotation=Quaternion.Euler(euler);go.transform.position=target-go.transform.forward*450;
        var rt=new RenderTexture(1920,1280,24);camera.targetTexture=rt;camera.Render();var prior=RenderTexture.active;RenderTexture.active=rt;var tex=new Texture2D(1920,1280,TextureFormat.RGB24,false);tex.ReadPixels(new Rect(0,0,1920,1280),0,0);tex.Apply();
        File.WriteAllBytes(Out+"city-v002-event-"+name+".png",tex.EncodeToPNG());RenderTexture.active=prior;camera.targetTexture=null;rt.Release();UnityEngine.Object.DestroyImmediate(tex);UnityEngine.Object.DestroyImmediate(rt);UnityEngine.Object.DestroyImmediate(go);
    }
}
