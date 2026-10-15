using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using Newtonsoft.Json.Linq;
using Simus;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;

/// <summary>Approved v002 assembly, phases 1–3 only. Never writes source scenes or build settings.</summary>
public static class CityRebuildV002Setup
{
    public const string Folder = "Assets/SIMUS/Scenes/city_rebuild_v002";
    public const string ScenePath = Folder + "/CityRebuild_v002.unity";
    const string Source = "../docs/planning/city_rebuild_v002/layout.json";
    const string Evidence = "../docs/verification/city-rebuild-v002-unity-results.json";
    const float RoadY = 0.02f, WalkY = 0.14f;
    static readonly List<List<Vector2>> roadPolygons = new List<List<Vector2>>();
    static readonly List<List<Vector2>> walkPolygons = new List<List<Vector2>>();
    static JObject report;
    static int meshCount;
    static JObject campusNameMap;
    static Quaternion axisRotation = Quaternion.identity;
    static Vector3 axisScale = Vector3.one;

    public static void ProbeCampus()
    {
        var asset=AssetDatabase.LoadAssetAtPath<GameObject>("Assets/SIMUS/Art/buildings/campus/Campus.fbx");
        var source=(GameObject)PrefabUtility.InstantiatePrefab(asset);
        var entries=new JArray(source.GetComponentsInChildren<MeshRenderer>(true).Select(r=>(JToken)new JObject{["name"]=r.name,["bounds"]=BoundJson(r.bounds),["mesh_name"]=r.GetComponent<MeshFilter>().sharedMesh.name}));
        File.WriteAllText("../docs/verification/city-rebuild-v002-campus-unity-import.json",entries.ToString());
        UnityEngine.Object.DestroyImmediate(source);
        Debug.Log("CITY_REBUILD_V002_CAMPUS_PROBE_READY meshes="+entries.Count);
    }

    [MenuItem("SIMUS/City Rebuild v002/Build Phases 1 to 3")]
    public static void Build()
    {
        if (!Application.isBatchMode && !EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;
        var original = File.ReadAllBytes(CompletedMapFollowSetup.ScenePath);
        var builds = File.ReadAllBytes("ProjectSettings/EditorBuildSettings.asset");
        var layout = JObject.Parse(File.ReadAllText(Source));
        campusNameMap = JObject.Parse(File.ReadAllText("../docs/verification/city-rebuild-v002-campus-fbx-map.json"));
        if ((string)layout["metadata"]["design_id"] != "city_rebuild_v002" || layout["buildings"].Count() != 55 || layout["campus"]["components"].Count() != 14)
            throw new InvalidOperationException("Expected approved v002 layout with 55 external and 14 campus buildings.");
        Directory.CreateDirectory(Folder + "/meshes"); Directory.CreateDirectory(Folder + "/materials");
        AssetDatabase.Refresh();
        if (!File.Exists(ScenePath) && !AssetDatabase.CopyAsset(CompletedMapFollowSetup.ScenePath, ScenePath))
            throw new InvalidOperationException("Cannot copy protected source scene.");
        var scene = EditorSceneManager.OpenScene(ScenePath);
        foreach (var root in scene.GetRootGameObjects())
            if (root.name == "CityRebuild_v002" || root.name == "SIMUS Completed Map 03") UnityEngine.Object.DestroyImmediate(root);
        var generated = new GameObject("CityRebuild_v002");
        roadPolygons.Clear(); walkPolygons.Clear(); meshCount = 0;
        report = new JObject { ["design_id"] = "city_rebuild_v002", ["scope"] = "Phases 1–3", ["layout_sha256"] = Hash(File.ReadAllBytes(Source)), ["scene"] = ScenePath,
            ["unity_version"] = Application.unityVersion, ["phase1"] = "RUNNING", ["phase2"] = "RUNNING", ["phase3"] = "RUNNING", ["phase4_to_7"] = "NOT TESTED / outside this delivery", ["instances"] = new JArray() };
        var roadMat = Material("asphalt", new Color(.18f,.20f,.21f));
        var walkMat = Material("sidewalk", new Color(.72f,.71f,.66f));
        var campusMat = Material("campus_walk", new Color(.79f,.76f,.68f));
        var trailMat = Material("park_trail", new Color(.58f,.48f,.34f));
        var markings = Material("crossing_marking", new Color(.93f,.92f,.82f));
        var groundMat = Material("city_ground", new Color(.48f,.53f,.43f));
        var ground = Group("01_Ground", generated.transform);
        var ex = layout["extent"];
        Surface("CityGround", ground, new[]{Rect(new Vector2(F(ex,"xmin")-8,F(ex,"zmin")-8),new Vector2(F(ex,"xmax")+8,F(ex,"zmax")+8))}, -.02f, groundMat);
        var roads = Group("02_Roads", generated.transform);
        var roadPieces = new Dictionary<string,List<List<Vector2>>>();
        var roadGroups = new Dictionary<string,Transform>();
        // All asphalt strips use mitered shared endpoints. Subtraction removes coplanar double coverage at bends/intersections.
        foreach (var r in layout["roads"])
        {
            var group = Group((string)r["id"] + "_" + (string)r["role"], roads);
            var points = Points(r["points"]);
            var strips = Ribbon(points, F(r,"carriageway_width"));
            var pieces = new List<List<Vector2>>();
            foreach(var strip in strips) { pieces.AddRange(SubtractAll(new[]{strip},roadPolygons)); roadPolygons.Add(strip); }
            roadPieces[(string)r["id"]] = pieces; roadGroups[(string)r["id"]] = group;
        }
        var turns = Group("03_TurningAndIntersections", generated.transform);
        foreach (var t in layout["turning_spaces"])
        {
            var center = new Vector2(F(t,"x"),F(t,"z"));
            var poly = t["radius"] != null ? Circle(center,F(t,"radius"),32) : Rect(center-new Vector2(F(t,"width"),F(t,"depth"))*.5f,center+new Vector2(F(t,"width"),F(t,"depth"))*.5f);
            Surface((string)t["road"] + "_"+(string)t["type"], turns, SubtractAll(new[]{poly},roadPolygons), RoadY, roadMat);
            roadPolygons.Add(poly);
        }
        foreach(var j in layout["intersections"])
        {
            var patch=Circle(new Vector2(F(j,"x"),F(j,"z")),F(j,"corner_radius"),32);
            var owned=new List<List<Vector2>>();
            foreach(var id in roadPieces.Keys.ToArray())
            {
                foreach(var piece in roadPieces[id]) {var intersection=Intersect(piece,patch);if(Area(intersection)>.000001f)owned.Add(intersection);}
                roadPieces[id]=SubtractAll(roadPieces[id],new[]{patch});
            }
            var junction=Group((string)j["id"]+"_"+(string)j["type"],turns);
            Surface((string)j["id"]+"_IntersectionAsphalt",junction,owned,RoadY,roadMat);
        }
        foreach(var entry in roadPieces)Surface(entry.Key+"_Carriageway",roadGroups[entry.Key],entry.Value,RoadY,roadMat);
        var walks = Group("04_PedestrianSurfaces", generated.transform);
        var walkGroups = new Dictionary<string,Transform>();
        foreach(var e in layout["pedestrian_edges"])
        {
            string kind = (string)e["kind"];
            // A classified crossing can include short pieces outside asphalt; keep its approach surfaces, clip only the road footprint.
            if(!walkGroups.ContainsKey(kind)) walkGroups[kind]=Group(kind,walks);
            var points=Points(e["points"]); if(points.Count<2 || Vector2.Distance(points[0],points[points.Count-1])<.0001f) continue;
            var polygons=Ribbon(points,F(e,"width"));
            var clips = roadPolygons.Concat(walkPolygons).ToList();
            var pieces=SubtractAll(polygons,clips);
            Surface((string)e["id"],walkGroups[kind],pieces,WalkY,kind=="park_trail"?trailMat:kind=="campus_walk"?campusMat:walkMat);
            walkPolygons.AddRange(polygons);
        }
        var crossings=Group("05_CrossingFacilities_17",generated.transform);
        var markingPolygons=new List<List<Vector2>>();
        foreach(var c in layout["crossing_facilities"])
        {
            var group=Group((string)c["id"]+"_"+(string)c["type"],crossings);
            int index=0;
            foreach(var corridor in c["corridors"])
            {
                var pts=Points(corridor["points"]);
                for(int i=0;i<pts.Count-1;i++)
                {
                    var delta=pts[i+1]-pts[i]; float length=delta.magnitude;
                    for(float s=.15f;s<length;s+=.9f)
                    {
                        var end=Mathf.Min(s+.38f,length);var stripe=Ribbon(new List<Vector2>{pts[i]+delta.normalized*s,pts[i]+delta.normalized*end},F(corridor,"width")*.86f);
                        var clipped=new List<List<Vector2>>();
                        foreach(var strip in stripe) foreach(var road in roadPolygons) {var intersection=Intersect(strip,road);if(Area(intersection)>.00001f)clipped.Add(intersection);}
                        var distinct=SubtractAll(clipped,markingPolygons);
                        Surface("Stripe_"+index++,group,distinct,RoadY+.003f,markings,false);
                        markingPolygons.AddRange(clipped);
                    }
                }
            }
        }
        report["phase2"]="PASS: serialized ground, 7 roads, turning spaces, pedestrian surfaces and 17 facility roots; runtime navigation not tested";
        var campus=Group("06_CampusBuildings_14",generated.transform);
        PlaceCampus(layout,campus,Group("07_CampusFacilities",generated.transform));
        var buildings=Group("08_ExternalBuildings_55",generated.transform);
        foreach(var b in layout["buildings"]) PlaceExternal(b,buildings);
        report["phase1"]="PASS: all required FBX assets loaded by Unity AssetDatabase, real mesh bounds verified";
        report["phase3"]="PASS: 14 campus wrappers, 55 external FBX instances and original sports facilities serialized";
        var patrol=UnityEngine.Object.FindFirstObjectByType<TestNpcPatrol>();
        var preview=UnityEngine.Object.FindFirstObjectByType<CityPreviewCamera>();
        if(patrol==null || preview==null) throw new InvalidOperationException("Original local NPC or CityPreviewCamera was not preserved.");
        // Existing local MoveTowards smoke segment only. Graph routes, NavMesh and event logic belong to phase 5.
        var sample=layout["pedestrian_edges"].First(e=>(string)e["kind"]=="campus_walk" && Points(e["points"]).Count==2 && Vector2.Distance(Points(e["points"])[0],Points(e["points"])[1])>20);
        var samplePoints=Points(sample["points"]);
        patrol.startPoint.position=V(Vector2.Lerp(samplePoints[0],samplePoints[1],.25f),WalkY+.02f);
        patrol.endPoint.position=V(Vector2.Lerp(samplePoints[0],samplePoints[1],.75f),WalkY+.02f);
        patrol.transform.position=patrol.startPoint.position;
        report["local_npc_segment"]=new JObject { ["edge"]=(string)sample["id"], ["start"]=Vec(patrol.startPoint.position), ["end"]=Vec(patrol.endPoint.position),["status"]="support rays checked; Play Mode movement NOT TESTED" };
        var before=new JObject { ["overview_size"]=preview.overviewSize,["top_view_size"]=preview.topViewSize,["follow_size"]=preview.followSize,["follow_pitch"]=preview.followPitch,["follow_yaw"]=preview.followYaw };
        preview.overviewTarget=new Vector3(-15,0,-27.5f); preview.overviewSize=260;preview.topViewSize=235;
        preview.previewSubtitle="CITY REBUILD v002 | PHASES 1–3"; preview.followTarget=patrol.transform; preview.TopView();
        report["camera_settings"]=new JObject{["before"]=before,["after"]=new JObject{["overview_size"]=preview.overviewSize,["top_view_size"]=preview.topViewSize,["follow_size"]=preview.followSize,["follow_pitch"]=preview.followPitch,["follow_yaw"]=preview.followYaw},["runtime_validation"]="NOT TESTED; original script zoom clamp 170 remains, full overview tuning deferred to phase 6"};
        Physics.SyncTransforms();
        for(int i=0;i<=20;i++)
        {
            var pos=Vector3.Lerp(patrol.startPoint.position,patrol.endPoint.position,i/20f);
            if(!Physics.Raycast(pos+Vector3.up,Vector3.down,out var hit,2)||Mathf.Abs(hit.point.y-WalkY)>.01f)
                throw new InvalidOperationException("Local NPC support failed at "+pos);
        }
        report["local_npc_support_rays"]=21; report["generated_mesh_count"]=meshCount;
        report["graph_nodes"]=layout["pedestrian_nodes"].Count();report["graph_edges"]=layout["pedestrian_edges"].Count();
        report["ground_surface_y"]=-.02f; report["road_surface_y"]=RoadY;report["walk_surface_y"]=WalkY; report["play_mode"]="NOT TESTED";report["navmesh"]="NOT TESTED / Phase 5";
        EditorSceneManager.SaveScene(scene,ScenePath); AssetDatabase.SaveAssets();
        EditorSceneManager.OpenScene(ScenePath);
        report["scene_reload"]="PASS: saved scene reopened by Unity Editor";
        report["scene_sha256"]=Hash(File.ReadAllBytes(ScenePath));
        report["script_sha256"]=Hash(File.ReadAllBytes("Assets/Editor/CityRebuildV002Setup.cs"));
        if(!original.SequenceEqual(File.ReadAllBytes(CompletedMapFollowSetup.ScenePath))||!builds.SequenceEqual(File.ReadAllBytes("ProjectSettings/EditorBuildSettings.asset")))
            throw new InvalidOperationException("Protected scene/build selection changed.");
        report["protected_original_and_build_settings"]="PASS: byte-identical";
        Directory.CreateDirectory(Path.GetDirectoryName(Evidence));File.WriteAllText(Evidence,report.ToString());
        Debug.Log("CITY_REBUILD_V002_PHASE3_READY "+ScenePath+" external=55 campus=14 phases4to7=NOT_TESTED");
    }

    [MenuItem("SIMUS/City Rebuild v002/Capture Editor Inspection Views")]
    public static void CaptureInspectionViews()
    {
        if (!Application.isBatchMode && !EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;
        EditorSceneManager.OpenScene(ScenePath);
        var preview=UnityEngine.Object.FindFirstObjectByType<CityPreviewCamera>();
        if(preview==null)throw new InvalidOperationException("CityPreviewCamera missing.");
        var camera=preview.GetComponent<Camera>();
        string folder="../docs/verification/city-rebuild-v002-captures";Directory.CreateDirectory(folder);
        preview.Overview(); Capture(camera,folder+"/overview-editor.png");
        preview.TopView(); Capture(camera,folder+"/top-view-editor.png");
        // A static inspection render only; dynamic NPC tracking remains NOT TESTED.
        var target=preview.followTarget.position+preview.followOffset;
        camera.transform.rotation=Quaternion.Euler(preview.followPitch,preview.followYaw,0);
        camera.transform.position=target-camera.transform.forward*360;
        camera.orthographicSize=preview.followSize;
        var animator=preview.followTarget.GetComponentInChildren<Animator>();
        var clip=animator!=null && animator.runtimeAnimatorController!=null ? animator.runtimeAnimatorController.animationClips.FirstOrDefault(c=>c.name=="NEUTRAL_WALK") : null;
        if(clip!=null)
        {
            AnimationMode.StartAnimationMode();
            try { AnimationMode.BeginSampling(); AnimationMode.SampleAnimationClip(animator.gameObject,clip,.5f); AnimationMode.EndSampling(); Capture(camera,folder+"/npc-inspection-editor.png"); }
            finally { AnimationMode.StopAnimationMode(); }
        }
        else Capture(camera,folder+"/npc-inspection-editor.png");
        preview.TopView();
        var result=JObject.Parse(File.ReadAllText(Evidence));
        result["editor_inspection_captures"]=new JArray("overview-editor.png","top-view-editor.png","npc-inspection-editor.png");
        result["capture_scope"]="Unity Editor Camera.Render, not Play Mode or Phase 6 dynamic validation";
        result["npc_capture_pose"]=clip!=null ? "NEUTRAL_WALK manually sampled at 0.5 seconds; not Play Mode" : "bind pose; no animation sample";
        File.WriteAllText(Evidence,result.ToString());
        Debug.Log("CITY_REBUILD_V002_EDITOR_CAPTURES_READY "+folder);
    }
    static void Capture(Camera camera,string path)
    {
        var target=camera.targetTexture;var active=RenderTexture.active;
        var rt=new RenderTexture(2000,1600,24);var texture=new Texture2D(2000,1600,TextureFormat.RGB24,false);
        try{camera.targetTexture=rt;camera.Render();RenderTexture.active=rt;texture.ReadPixels(new Rect(0,0,2000,1600),0,0);texture.Apply();File.WriteAllBytes(path,texture.EncodeToPNG());}
        finally{camera.targetTexture=target;RenderTexture.active=active;rt.Release();UnityEngine.Object.DestroyImmediate(rt);UnityEngine.Object.DestroyImmediate(texture);}
    }

    static void PlaceCampus(JObject layout,Transform buildings,Transform facilities)
    {
        string path=UnityPath((string)layout["campus"]["asset"]);
        var asset=AssetDatabase.LoadAssetAtPath<GameObject>(path); if(asset==null)throw new InvalidOperationException("Campus FBX not imported: "+path);
        var source=(GameObject)PrefabUtility.InstantiatePrefab(asset);source.name="CampusSourceTemporary";
        var renderers=source.GetComponentsInChildren<MeshRenderer>(true);
        var all=new Dictionary<string,MeshRenderer>(); foreach(var r in renderers)if(!all.ContainsKey(r.name))all.Add(r.name,r);
        // Determine handedness from asymmetric measured building centres, preserving native FBX world transforms.
        float best=float.PositiveInfinity;Quaternion rotation=Quaternion.identity;Vector3 scale=Vector3.one;
        foreach(int quarter in Enumerable.Range(0,4))foreach(int mirror in new[]{1,-1})
        {
            source.transform.rotation=Quaternion.Euler(0,quarter*90,0)*asset.transform.rotation;
            source.transform.localScale=Vector3.Scale(asset.transform.localScale,new Vector3(mirror,1,1));
            float score=0;
            foreach(var c in layout["campus"]["components"])
            {
                var selected=SelectCampus(c,all); var bounds=Bounds(selected);
                var delta=c["delta_from_original"];
                score+=Vector2.Distance(new Vector2(bounds.center.x,bounds.center.z),new Vector2(F(c,"x")-(float)delta[0],F(c,"z")-65-(float)delta[1]));
                score+=Mathf.Abs(bounds.size.x-F(c,"width"))+Mathf.Abs(bounds.size.z-F(c,"depth"));
            }
            if(score<best){best=score;rotation=source.transform.rotation;scale=source.transform.localScale;}
        }
        source.transform.rotation=rotation;source.transform.localScale=scale;
        axisRotation=rotation*Quaternion.Inverse(asset.transform.rotation);
        axisScale=new Vector3(scale.x/asset.transform.localScale.x,scale.y/asset.transform.localScale.y,scale.z/asset.transform.localScale.z);
        if(best>.8f) throw new InvalidOperationException("Campus axis/bounds calibration failed, summed error="+best);
        report["campus_axis_calibration"]=new JObject{["sum_error_m"]=best,["rotation_euler"]=Vec(rotation.eulerAngles),["native_adjusted_scale"]=Vec(scale)};
        var claimed=new HashSet<MeshRenderer>();
        foreach(var c in layout["campus"]["components"])
        {
            var group=Group((string)c["id"]+"_"+(string)c["name"],buildings);
            var selected=SelectCampus(c,all);var imported=Bounds(selected);
            foreach(var r in selected){CopyMesh(r,group);claimed.Add(r);}
            group.position=new Vector3((float)c["delta_from_original"][0],-.18f,65+(float)c["delta_from_original"][1]);
            var actual=Bounds(group.GetComponentsInChildren<Renderer>());
            CheckBounds(c,actual);AddInstance(c,path,imported,actual,group,selected.Select(r=>r.name));
        }
        // Reuse only measured sports/lawn/garden pieces. Legacy roads, walks, site plinth and decorative trees stay out of this phase.
        var retainedNames=new HashSet<string>(campusNameMap["shared_retention_candidates"].Where(p=>!((string)p["source"]).Contains("Edge line")).Select(p=>(string)p["fbx"]));
        var sports=renderers.Where(r=>!claimed.Contains(r)&&retainedNames.Contains(r.name)).ToArray();
        if(sports.Length<5)throw new InvalidOperationException("Sports meshes not identified in Campus FBX.");
        foreach(var r in sports)CopyMesh(r,facilities);
        facilities.position=new Vector3(0,-.18f,65);report["retained_campus_facility_meshes"]=new JArray(sports.Select(r=>r.name));
        UnityEngine.Object.DestroyImmediate(source);
    }
    static MeshRenderer[] SelectCampus(JToken c,Dictionary<string,MeshRenderer> all)
    {
        var selected=new List<MeshRenderer>();
        foreach(var n in c["split_objects"])
        {
            string name=(string)n;
            string mapped=(string)campusNameMap["name_map"][name];
            var found=all.Values.FirstOrDefault(r=>r.name==mapped||r.name==name||r.name==name.Replace("ASSET_Campus__","")||r.name==name.Replace("ASSET_Campus__","D03_UNITY_")||r.name.Replace("/","_")==name.Replace("/","_"));
            if(found==null)throw new InvalidOperationException("Campus component mesh missing "+name);
            selected.Add(found);
        }
        return selected.ToArray();
    }
    static void CopyMesh(MeshRenderer r,Transform parent)
    {
        var f=r.GetComponent<MeshFilter>();if(f==null||f.sharedMesh==null)throw new InvalidOperationException("Missing FBX mesh "+r.name);
        var go=new GameObject(r.name);go.transform.SetPositionAndRotation(r.transform.position,r.transform.rotation);go.transform.localScale=r.transform.lossyScale;go.transform.SetParent(parent,true);
        go.AddComponent<MeshFilter>().sharedMesh=f.sharedMesh;go.AddComponent<MeshRenderer>().sharedMaterials=r.sharedMaterials;
        go.AddComponent<MeshCollider>().sharedMesh=f.sharedMesh;
    }
    static void PlaceExternal(JToken b,Transform parent)
    {
        string path=UnityPath((string)b["asset"]);var asset=AssetDatabase.LoadAssetAtPath<GameObject>(path);
        if(asset==null)throw new InvalidOperationException("FBX not imported: "+path);
        var group=Group((string)b["id"]+"_"+(string)b["type"],parent);
        var model=(GameObject)PrefabUtility.InstantiatePrefab(asset);model.transform.SetParent(group,false);
        model.transform.localRotation=axisRotation*asset.transform.localRotation;
        model.transform.localScale=Vector3.Scale(asset.transform.localScale,axisScale);
        var imported=Bounds(model.GetComponentsInChildren<Renderer>());
        if(Mathf.Abs(imported.size.x-F(b,"width"))>.025f || Mathf.Abs(imported.size.z-F(b,"depth"))>.025f || Mathf.Abs(imported.size.y-F(b,"height"))>.025f)
            throw new InvalidOperationException("Native FBX bounds differ from measured design for "+(string)b["id"]+": "+imported.size);
        // Imported model pivot is independent of measured footprint centre. The wrapper remains the CSV placement anchor.
        model.transform.position+=new Vector3(-imported.center.x,-imported.min.y,-imported.center.z);
        group.position=new Vector3(F(b,"x"),0,F(b,"z"));group.rotation=Quaternion.Euler(0,F(b,"yaw"),0);
        foreach(var f in model.GetComponentsInChildren<MeshFilter>())if(f.sharedMesh!=null&&f.GetComponent<Collider>()==null)f.gameObject.AddComponent<MeshCollider>().sharedMesh=f.sharedMesh;
        var actual=Bounds(model.GetComponentsInChildren<Renderer>());CheckBounds(b,actual);AddInstance(b,path,imported,actual,group,null);
    }
    static void CheckBounds(JToken item,Bounds actual)
    {
        var polygon=Points(item["footprint_polygon"]);
        float minX=polygon.Min(p=>p.x),maxX=polygon.Max(p=>p.x),minZ=polygon.Min(p=>p.y),maxZ=polygon.Max(p=>p.y);
        if(Mathf.Abs(actual.min.x-minX)>.025f||Mathf.Abs(actual.max.x-maxX)>.025f||Mathf.Abs(actual.min.z-minZ)>.025f||Mathf.Abs(actual.max.z-maxZ)>.025f)
            throw new InvalidOperationException("Final FBX envelope mismatch "+(string)item["id"]+" actual="+actual);
        if(Mathf.Abs(actual.size.y-F(item,"height"))>.025f)throw new InvalidOperationException("FBX height mismatch "+(string)item["id"]);
        if(((string)item["id"]).StartsWith("B")&&Mathf.Abs(actual.min.y)>.01f)throw new InvalidOperationException("FBX ground height mismatch "+(string)item["id"]);
    }
    static void AddInstance(JToken item,string path,Bounds imported,Bounds actual,Transform root,IEnumerable<string> names)
    {
        ((JArray)report["instances"]).Add(new JObject{["id"]=(string)item["id"],["asset"]=path,["asset_guid"]=AssetDatabase.AssetPathToGUID(path),["native_bounds"]=BoundJson(imported),["world_bounds"]=BoundJson(actual),["root_position"]=Vec(root.position),["root_yaw"]=root.eulerAngles.y,["root_scale"]=Vec(root.lossyScale),["source_axis_rotation_euler"]=Vec(axisRotation.eulerAngles),["source_axis_scale"]=Vec(axisScale),["selected_fbx_meshes"]=names==null?new JArray():new JArray(names),["entrance_verification"]="NOT TESTED: actual doorway, threshold and NavMesh access deferred"});
    }
    static Bounds Bounds(IEnumerable<Renderer> input){var a=input.ToArray();if(a.Length==0)throw new InvalidOperationException("No FBX renderers");var b=a[0].bounds;foreach(var r in a.Skip(1))b.Encapsulate(r.bounds);return b;}
    static JObject BoundJson(Bounds b)=>new JObject{["min"]=Vec(b.min),["max"]=Vec(b.max),["size"]=Vec(b.size)};
    static JArray Vec(Vector3 v)=>new JArray(v.x,v.y,v.z);
    static string UnityPath(string path)=>path.StartsWith("unity/")?path.Substring(6):path;
    static string Hash(byte[] data){using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(data)).Replace("-","").ToLowerInvariant();}
    static float F(JToken t,string key)=>(float)t[key];
    static Vector3 V(Vector2 p,float y)=>new Vector3(p.x,y,p.y);
    static Transform Group(string name,Transform parent){var go=new GameObject(name);go.transform.SetParent(parent,false);return go.transform;}
    static Material Material(string key,Color color)
    {
        string path=Folder+"/materials/"+key+".mat";var material=AssetDatabase.LoadAssetAtPath<Material>(path);
        if(material==null){material=new Material(Shader.Find("Standard"));AssetDatabase.CreateAsset(material,path);}
        material.color=color;material.SetFloat("_Glossiness",.05f);material.enableInstancing=true;return material;
    }
    static List<Vector2> Points(JToken points)=>points.Select(p=>new Vector2((float)p[0],(float)p[1])).ToList();
    static List<Vector2> Rect(Vector2 a,Vector2 b)=>new List<Vector2>{a,new Vector2(b.x,a.y),b,new Vector2(a.x,b.y)};
    static List<Vector2> Circle(Vector2 center,float radius,int sides)=>Enumerable.Range(0,sides).Select(i=>center+new Vector2(Mathf.Cos(i*2*Mathf.PI/sides),Mathf.Sin(i*2*Mathf.PI/sides))*radius).ToList();
    static List<List<Vector2>> Ribbon(List<Vector2> points,float width)
    {
        var offsets=new Vector2[points.Count];
        for(int i=0;i<points.Count;i++)
        {
            var before=(points[i]-points[Mathf.Max(0,i-1)]).normalized;var after=(points[Mathf.Min(points.Count-1,i+1)]-points[i]).normalized;
            if(i==0)before=after;if(i==points.Count-1)after=before;
            var n1=new Vector2(-before.y,before.x);var n2=new Vector2(-after.y,after.x);var m=(n1+n2).normalized;
            offsets[i]=m*(width*.5f/Mathf.Max(.15f,Vector2.Dot(m,n2)));
        }
        var result=new List<List<Vector2>>();for(int i=0;i<points.Count-1;i++)
        {
            var p=new List<Vector2>{points[i]+offsets[i],points[i]-offsets[i],points[i+1]-offsets[i+1],points[i+1]+offsets[i+1]};
            if(SignedArea(p)<0)p.Reverse();result.Add(p);
        }
        return result;
    }
    static float Cross(Vector2 a,Vector2 b)=>a.x*b.y-a.y*b.x;
    static float SignedArea(List<Vector2> p){if(p.Count<3)return 0;double a=0;var origin=p[0];for(int i=1;i<p.Count-1;i++){var u=p[i]-origin;var v=p[i+1]-origin;a+=(double)u.x*v.y-(double)u.y*v.x;}return (float)(a*.5);}
    static float Area(List<Vector2> p)=>p.Count<3?0:Mathf.Abs(SignedArea(p));
    static List<Vector2> Clip(List<Vector2> poly,Vector2 a,Vector2 b,bool inside)
    {
        var result=new List<Vector2>();if(poly.Count==0)return result;
        for(int i=0;i<poly.Count;i++)
        {
            var p=poly[i];var q=poly[(i+1)%poly.Count];float dp=Cross(b-a,p-a),dq=Cross(b-a,q-a);
            bool pin=inside?dp>=0:dp<=0;bool qin=inside?dq>=0:dq<=0;
            if(pin)result.Add(p);if(pin!=qin && Mathf.Abs(dp-dq)>1e-8f)result.Add(Vector2.LerpUnclamped(p,q,dp/(dp-dq)));
        }
        return result;
    }
    static List<Vector2> Intersect(List<Vector2> a,List<Vector2> b){var p=a;for(int i=0;i<b.Count&&p.Count>0;i++)p=Clip(p,b[i],b[(i+1)%b.Count],true);return p;}
    static List<List<Vector2>> Subtract(List<Vector2> source,List<Vector2> cutter)
    {
        if(Area(Intersect(source,cutter))<.000001f)return new List<List<Vector2>>{source};
        var result=new List<List<Vector2>>();var remaining=source;
        for(int i=0;i<cutter.Count&&remaining.Count>0;i++)
        {
            var outside=Clip(remaining,cutter[i],cutter[(i+1)%cutter.Count],false);if(Area(outside)>.000001f)result.Add(outside);
            remaining=Clip(remaining,cutter[i],cutter[(i+1)%cutter.Count],true);
        }
        return result;
    }
    static List<List<Vector2>> SubtractAll(IEnumerable<List<Vector2>> source,IEnumerable<List<Vector2>> cutters)
    {
        var result=source.ToList();foreach(var cutter in cutters){var next=new List<List<Vector2>>();foreach(var p in result)next.AddRange(Subtract(p,cutter));result=next;if(result.Count==0)break;}return result;
    }
    static void Surface(string name,Transform parent,IEnumerable<List<Vector2>> polygons,float y,Material material,bool collider=true)
    {
        var pieces=polygons.Where(p=>Area(p)>.000001f).ToArray();if(pieces.Length==0)return;
        var vertices=new List<Vector3>();var indices=new List<int>();
        foreach(var polygon in pieces)
        {
            int start=vertices.Count;vertices.AddRange(polygon.Select(p=>V(p,y)));
            for(int i=1;i<polygon.Count-1;i++){indices.Add(start);indices.Add(start+i+1);indices.Add(start+i);}
        }
        var mesh=new Mesh{name=name,indexFormat=IndexFormat.UInt32};mesh.SetVertices(vertices);mesh.SetTriangles(indices,0);mesh.RecalculateNormals();mesh.RecalculateBounds();
        string filename="surface_"+(meshCount++).ToString("D4",CultureInfo.InvariantCulture)+".asset";string path=Folder+"/meshes/"+filename;
        var existing=AssetDatabase.LoadAssetAtPath<Mesh>(path);if(existing==null)AssetDatabase.CreateAsset(mesh,path);else{EditorUtility.CopySerialized(mesh,existing);UnityEngine.Object.DestroyImmediate(mesh);mesh=existing;}
        var go=new GameObject(name);go.transform.SetParent(parent,false);go.AddComponent<MeshFilter>().sharedMesh=mesh;go.AddComponent<MeshRenderer>().sharedMaterial=material;
        if(collider)go.AddComponent<MeshCollider>().sharedMesh=mesh;
    }
}
