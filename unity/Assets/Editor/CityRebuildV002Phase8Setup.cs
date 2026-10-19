using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using Newtonsoft.Json.Linq;
using Simus;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;

// Additive scene-only visual dressing. Original transforms, meshes, colliders and materials remain intact.
public static class CityRebuildV002Phase8Setup
{
    const string Folder=CityRebuildV002Setup.Folder+"/phase8";
    static JObject layout; static Transform root; static CityV002PedestrianGraph graph;
    static readonly Dictionary<string,Material> palette=new Dictionary<string,Material>();
    static readonly Dictionary<string,List<Vector3>> verts=new Dictionary<string,List<Vector3>>();
    static readonly Dictionary<string,List<int>> tris=new Dictionary<string,List<int>>();
    static readonly List<Bounds> decorationBounds=new List<Bounds>();
    static JArray placements;
    public static void ApplyBatch() { Apply(); }
    [MenuItem("SIMUS/City Rebuild v002/Phase 8 A-B Polish")]
    public static void Apply()
    {
        if(EditorApplication.isPlayingOrWillChangePlaymode)throw new InvalidOperationException("Edit Mode required");
        var scene=EditorSceneManager.OpenScene(CityRebuildV002Setup.ScenePath);
        var city=GameObject.Find("CityRebuild_v002").transform;
        graph=UnityEngine.Object.FindFirstObjectByType<CityV002PedestrianGraph>();
        if(graph.nodes.Length!=572||graph.edges.Length!=597)throw new InvalidOperationException("Approved graph missing");
        layout=JObject.Parse(File.ReadAllText("../docs/planning/city_rebuild_v002/layout.json"));
        if(city.Find("13_Phase8_VisualPolish")!=null)throw new InvalidOperationException("Phase8 already applied; no automatic overwrite");
        Directory.CreateDirectory(Folder+"/materials");Directory.CreateDirectory(Folder+"/meshes");AssetDatabase.Refresh();
        var before=Snapshot(city);var lighting=LightingSnapshot();
        var oldCamera=UnityEngine.Object.FindFirstObjectByType<CityPreviewCamera>();
        File.WriteAllText("../docs/verification/city-rebuild-v002-phase8-camera-before.json",EditorJsonUtility.ToJson(oldCamera,true));
        root=new GameObject("13_Phase8_VisualPolish").transform;root.SetParent(city,false);
        palette.Clear();verts.Clear();tris.Clear();decorationBounds.Clear();placements=new JArray();
        Mat("Asphalt", "596774");Mat("Paving","D6CDB9");Mat("Cream","F1E6CB");Mat("BlueSlate","6C96A8");Mat("Grass","8EAF7C");Mat("Lawn","B4C88F");Mat("Shrub","598B69");Mat("Wood","A67C55");Mat("Line","F5EBD1");Mat("Yellow","E4BE65");Mat("Terracotta","C18E73");Mat("Commerce","C9B6A0");Mat("Residential","A7B88E");
        // Scene-local material variants are assigned per source; imported materials are never edited.
        var variants=new Dictionary<Material,Material>();var materialRows=new JArray();
        foreach(var renderer in city.GetComponentsInChildren<MeshRenderer>(true).Where(r=>!r.transform.IsChildOf(root)))
        {
            if(renderer.GetComponentInParent<TestNpcPatrol>()!=null)continue;
            var sources=renderer.sharedMaterials;var replacements=(Material[])sources.Clone();
            for(int i=0;i<sources.Length;i++)
            {
                var source=sources[i];if(source==null)continue;
                string key=source.name.ToLowerInvariant();
                // Water keeps the exact pollution-controlled shader/material and property block contract.
                if(key.Contains("water")||source.renderQueue>=3000)continue;
                if(!variants.TryGetValue(source,out var copy))
                {
                    copy=new Material(source){name="Phase8_"+source.name};Color color=source.HasProperty("_Color")?source.color:Color.white;
                    if(key.Contains("asphalt"))color=palette["Asphalt"].color;
                    else if(key.Contains("sidewalk")||key.Contains("campus_walk")||key.Contains("trail"))color=palette[key.Contains("trail")?"Wood":"Paving"].color;
                    else if(key.Contains("ground"))color=palette["Grass"].color;
                    else if(key.Contains("crossing")||key.Contains("line"))color=palette["Line"].color;
                    else if(key.Contains("grass")||key.Contains("lawn"))color=palette["Lawn"].color;
                    else if(key.Contains("leaf")||key.Contains("foliage"))color=palette["Shrub"].color;
                    else if(key.Contains("bank")||key.Contains("bench")||key.Contains("wood"))color=Color.Lerp(color,palette["Wood"].color,.3f);
                    else {Color.RGBToHSV(color,out float h,out float s,out float v);color=Color.HSVToRGB(h,s*.68f,Mathf.Lerp(v,.78f,.2f));}
                    if(copy.HasProperty("_Color"))copy.color=color;
                    if(copy.HasProperty("_Glossiness"))copy.SetFloat("_Glossiness",.03f);
                    string path=Folder+"/materials/Variant_"+variants.Count.ToString("D3")+".mat";
                    AssetDatabase.CreateAsset(copy,path);variants[source]=copy;
                    materialRows.Add(new JObject{["source"]=AssetDatabase.GetAssetPath(source),["source_name"]=source.name,["variant"]=path,["color"]="#"+ColorUtility.ToHtmlStringRGB(color)});
                }
                replacements[i]=copy;
            }
            renderer.sharedMaterials=replacements;
        }
        foreach(var d in layout["districts"])
        {
            string type=(string)d["type"];if(type=="park")continue;
            Polygon(Points(d["polygon"]),-.012f,type=="commercial"?"Commerce":type=="residential"?"Residential":"Lawn");
        }
        // Parallel markings follow exact approved carriageway centerlines; intersections/crossings remain clear.
        foreach(var road in layout["roads"])
        {
            var pts=Points(road["points"]);float width=(float)road["carriageway_width"];
            for(int i=0;i<pts.Count-1;i++)
            {
                var a=pts[i];var b=pts[i+1];var dir=(b-a).normalized;var n=new Vector2(-dir.y,dir.x);float length=Vector2.Distance(a,b);
                for(float d=2;d<length-2;d+=6)
                {
                    var p=a+dir*d;float span=Mathf.Min(2.5f,length-d-1);
                    if(!CrossingNear(p,4)&&!JunctionNear(p,9))Ribbon(p,p+dir*span,.15f,.026f,"Yellow");
                }
                foreach(float side in new[]{-1f,1f})
                    for(float d=1;d<length-1;d+=3)
                    {var p=a+dir*d+n*(width*.5f-.22f)*side;if(!CrossingNear(p,2)&&!JunctionNear(p,8))Ribbon(p,p+dir*Mathf.Min(2.9f,length-d),.1f,.025f,"Line");}
            }
        }
        foreach(var cap in layout["turning_spaces"])
        {
            var c=new Vector2((float)cap["x"],(float)cap["z"]);float r=cap["radius"]==null?3.5f:(float)cap["radius"]-1;
            for(int i=0;i<16;i++){float a=i*Mathf.PI/8,b=(i+.72f)*Mathf.PI/8;Ribbon(c+new Vector2(Mathf.Cos(a),Mathf.Sin(a))*r,c+new Vector2(Mathf.Cos(b),Mathf.Sin(b))*r,.16f,.027f,"Line");}
        }
        // Individual soft-edged lot lawns and paved aprons distinguish building use.
        foreach(var b in layout["buildings"])
        {
            var center=new Vector2((float)b["x"],(float)b["z"]);float w=(float)b["width"],d=(float)b["depth"];
            string type=(string)b["type"],id=(string)b["id"];
            Polygon(RoundedRect(center,w+7,d+7,2),-.006f,type=="commercial"?"Paving":"Lawn");
            // Paved three-bay parking courts, wholly outside building and route envelopes.
            foreach(var side in new[]{-1f,1f})
            {
                var court=center+new Vector2(0,side*(d*.5f+5.5f));
                if(!Clear(court,4.4f,false))continue;
                Polygon(RoundedRect(court,8.2f,4.6f,.4f),-.003f,"Asphalt");
                for(int k=0;k<3;k++)
                {
                    var q=court+new Vector2((k-1)*2.5f,0);
                    Ribbon(q+new Vector2(-1.1f,-2),q+new Vector2(-1.1f,2),.10f,.002f,"Line");
                    Ribbon(q+new Vector2(1.1f,-2),q+new Vector2(1.1f,2),.10f,.002f,"Line");
                    Ribbon(q+new Vector2(-1.1f,side*2),q+new Vector2(1.1f,side*2),.10f,.002f,"Line");
                }
                break;
            }
            if(type=="commercial")
            {
                // Additive sign panels above the frontage, source facade/mesh untouched.
                float signWidth=Mathf.Min(5,w*.5f),z=center.y-d*.5f-.035f;
                Quad(new Vector3(center.x-signWidth*.5f,3,z),new Vector3(center.x+signWidth*.5f,3,z),new Vector3(center.x+signWidth*.5f,3.9f,z),new Vector3(center.x-signWidth*.5f,3.9f,z),"BlueSlate");
                for(int k=-2;k<=2;k++)Quad(new Vector3(center.x+k*.6f-.15f,3.3f,z-.005f),new Vector3(center.x+k*.6f+.15f,3.3f,z-.005f),new Vector3(center.x+k*.6f+.15f,3.6f,z-.005f),new Vector3(center.x+k*.6f-.15f,3.6f,z-.005f),"Cream");
            }
            var candidates=new[]{center+new Vector2(w*.5f+3,0),center+new Vector2(-w*.5f-3,0),center+new Vector2(0,d*.5f+3)};
            foreach(var p in candidates)
                if(Clear(p,1.4f,true)){PlaceProp("Phase8_Planter",id+"_Garden",p,(float)b["yaw"]);break;}
        }
        // Additional safe public-space furniture: no colliders and outside full pedestrian edge widths.
        foreach(var rest in layout["park"]["rest_areas"])
        {
            var p=new Vector2((float)rest["x"],(float)rest["z"]);
            for(int i=0;i<12;i++) {float angle=i*Mathf.PI/6;var q=p+new Vector2(Mathf.Cos(angle),Mathf.Sin(angle))*((float)rest["radius"]+2);if(Clear(q,1.4f,true))PlaceProp(i%3==0?"Phase8_Bench":"Phase8_Planter",(string)rest["id"]+"_Rest_"+i,q,-angle*Mathf.Rad2Deg);}
        }
        foreach(var road in layout["roads"])
        {
            var pts=Points(road["points"]);float width=(float)road["carriageway_width"];
            for(int i=0;i<pts.Count-1;i++)
            {var delta=pts[i+1]-pts[i];var dir=delta.normalized;var n=new Vector2(-dir.y,dir.x);for(float d=12;d<delta.magnitude-8;d+=30){var p=pts[i]+dir*d+n*(width*.5f+4.8f);if(Clear(p,.65f,true))PlaceProp("Phase8_Streetlamp",(string)road["id"]+"_Lamp_"+i+"_"+d,p,0);}}
        }
        // Campus plaza paving pattern and two green rest strips, below existing raised walk surfaces.
        var plaza=layout["campus"]["plaza"];
        if(plaza?["footprint_polygon"]!=null)
        {
            var pp=Points(plaza["footprint_polygon"]);Polygon(pp,.004f,"Paving");
            var min=new Vector2(pp.Min(p=>p.x),pp.Min(p=>p.y));var max=new Vector2(pp.Max(p=>p.x),pp.Max(p=>p.y));
            for(float x=min.x+2;x<max.x;x+=5)Ribbon(new Vector2(x,min.y),new Vector2(x,max.y),.10f,.007f,"Cream");
            for(float z=min.y+2;z<max.y;z+=5)Ribbon(new Vector2(min.x,z),new Vector2(max.x,z),.10f,.007f,"Cream");
        }
        foreach(var p in new[]{new Vector2(-65,93),new Vector2(65,94),new Vector2(-64,26),new Vector2(61,20),new Vector2(-32,117),new Vector2(35,117)})
        {if(Clear(p,1.5f,true))PlaceProp("Phase8_Bench","Campus_Rest_"+placements.Count,p,90);}
        // River water remains driven by the preserved scene component. Palette only, endpoints remain different.
        var water=UnityEngine.Object.FindFirstObjectByType<CityV002RiverWater>();
        if(water!=null){water.cleanColor=Hex("55A9B4");water.pollutedColor=Hex("777B43");water.Apply();}
        // Larger context and higher angle; preserve original reveal, full-body centering and smoothing.
        oldCamera.smoothFollowTransitions=true;oldCamera.followSize=21;oldCamera.followPitch=48;oldCamera.contextBuildingFade=true;oldCamera.contextFadeRadius=9;oldCamera.contextBuildingVisibility=.05f;oldCamera.followYaw=-36;oldCamera.followSmoothTime=.35f;oldCamera.revealRadius=4.2f;
        FlushMeshes();Physics.SyncTransforms();
        var after=Snapshot(city);
        if(before.ToString()!=after.ToString())throw new InvalidOperationException("Protected transforms/colliders/meshes changed");
        if(lighting.ToString()!=LightingSnapshot().ToString())throw new InvalidOperationException("Phase C settings changed");
        EditorSceneManager.SaveScene(scene,CityRebuildV002Setup.ScenePath);AssetDatabase.SaveAssets();
        File.WriteAllText("../docs/verification/city-rebuild-v002-phase8-assembly.json",new JObject{["status"]="PASS_EDITOR_ASSEMBLY",["scene_sha256"]=Hash(CityRebuildV002Setup.ScenePath),["protected_before"]=before,["protected_after"]=after,["material_variants"]=materialRows,["placements"]=placements,["visual_mesh_groups"]=verts.Count,["new_colliders"]=root.GetComponentsInChildren<Collider>().Length,["render_pipeline"]="Built-in: GraphicsSettings custom pipeline null; no pipeline/package/light changes",["lighting_before_after"]=lighting,["camera_after"]=JObject.Parse(EditorJsonUtility.ToJson(oldCamera)),["performance"]="NOT TESTED: Phase D deferred"}.ToString());
        // Existing public audit methods perform the exact 69 envelope and 597-edge river physics regressions.
        var method=typeof(CityRebuildV002Completion).GetMethod("AuditBuildings",System.Reflection.BindingFlags.NonPublic|System.Reflection.BindingFlags.Static);
        var oldAudit="../docs/verification/city-rebuild-v002-phase47-building-audit.json";var saved=File.ReadAllBytes(oldAudit);
        try {method.Invoke(null,new object[]{layout});File.Copy(oldAudit,"../docs/verification/city-rebuild-v002-phase8-building-audit.json",true);}finally{File.WriteAllBytes(oldAudit,saved);}
        File.WriteAllText("../docs/verification/city-rebuild-v002-phase8-physics.json",new JObject{["graph"]=CityRebuildV002RiverSetup.AuditGraph(graph),["river_depth"]=CityRebuildV002RiverSetup.AuditDepth(),["scene_sha256"]=Hash(CityRebuildV002Setup.ScenePath)}.ToString());
    }
    public static void ReviseBatch()
    {
        var scene=EditorSceneManager.OpenScene(CityRebuildV002Setup.ScenePath);
        var city=GameObject.Find("CityRebuild_v002").transform;root=city.Find("13_Phase8_VisualPolish");
        if(root==null)throw new InvalidOperationException("Apply first");
        var protectedBefore=Snapshot(city);var lighting=LightingSnapshot();
        layout=JObject.Parse(File.ReadAllText("../docs/planning/city_rebuild_v002/layout.json"));
        verts.Clear();tris.Clear();
        foreach(var d in layout["districts"].Where(d=>(string)d["type"]=="school"))Polygon(Points(d["polygon"]),-.012f,"Lawn");
        foreach(var b in layout["buildings"].Where(b=>(string)b["type"]!="commercial"))Polygon(RoundedRect(new Vector2((float)b["x"],(float)b["z"]),(float)b["width"]+7,(float)b["depth"]+7,2),-.006f,"Lawn");
        var lawn=AssetDatabase.LoadAssetAtPath<Mesh>(Folder+"/meshes/Lawn.asset");lawn.Clear();lawn.SetVertices(verts["Lawn"]);lawn.SetTriangles(tris["Lawn"],0);lawn.RecalculateNormals();lawn.RecalculateBounds();EditorUtility.SetDirty(lawn);
        var colors=new Dictionary<string,string>{{"Asphalt","596774"},{"Paving","D6CDB9"},{"Cream","F1E6CB"},{"BlueSlate","6C96A8"},{"Grass","8EAF7C"},{"Lawn","B4C88F"},{"Shrub","598B69"},{"Wood","A67C55"},{"Line","F5EBD1"},{"Yellow","E4BE65"},{"Terracotta","C18E73"},{"Commerce","C9B6A0"},{"Residential","A7B88E"}};
        foreach(var p in colors){var m=AssetDatabase.LoadAssetAtPath<Material>(Folder+"/materials/"+p.Key+".mat");var c=Hex(p.Value);c.r*=.6f;c.g*=.6f;c.b*=.6f;m.color=c;EditorUtility.SetDirty(m);}
        var assembly=JObject.Parse(File.ReadAllText("../docs/verification/city-rebuild-v002-phase8-assembly.json"));
        foreach(var row in assembly["material_variants"]){var m=AssetDatabase.LoadAssetAtPath<Material>((string)row["variant"]);ColorUtility.TryParseHtmlString((string)row["color"],out var c);c.r*=.65f;c.g*=.65f;c.b*=.65f;if(m.HasProperty("_Color"))m.color=c;EditorUtility.SetDirty(m);}
        var camera=UnityEngine.Object.FindFirstObjectByType<CityPreviewCamera>();camera.smoothFollowTransitions=true;camera.acquisitionSmoothTime=.6f;camera.acquisitionPanSpeed=40;camera.acquisitionAngularSpeed=20;camera.acquisitionZoomSpeed=120;camera.followSize=21;camera.followPitch=48;camera.followYaw=-36;camera.contextFadeRadius=9;camera.contextBuildingVisibility=.05f;
        if(!JToken.DeepEquals(protectedBefore,Snapshot(city))||!JToken.DeepEquals(lighting,LightingSnapshot()))throw new InvalidOperationException("Protected scene changed");
        EditorSceneManager.SaveScene(scene,CityRebuildV002Setup.ScenePath);AssetDatabase.SaveAssets();
        assembly["revised_scene_sha256"]=Hash(CityRebuildV002Setup.ScenePath);assembly["revision"]="Exclude park district from all above-river decoration; lower scene-only palette albedo from actual Game camera review; yaw-36 pitch48 size21 with .05 contextual visibility";assembly["camera_after"]=JObject.Parse(EditorJsonUtility.ToJson(camera));File.WriteAllText("../docs/verification/city-rebuild-v002-phase8-assembly.json",assembly.ToString());
        graph=UnityEngine.Object.FindFirstObjectByType<CityV002PedestrianGraph>();
        File.WriteAllText("../docs/verification/city-rebuild-v002-phase8-physics.json",new JObject{["graph"]=CityRebuildV002RiverSetup.AuditGraph(graph),["river_depth"]=CityRebuildV002RiverSetup.AuditDepth(),["scene_sha256"]=Hash(CityRebuildV002Setup.ScenePath)}.ToString());
        Debug.Log("CITY_V002_PHASE8_REVISE_PASS");
    }
    public static void AuditBatch()
    {
        EditorSceneManager.OpenScene(CityRebuildV002Setup.ScenePath);
        var spec=JObject.Parse(File.ReadAllText("../docs/planning/city_rebuild_v002/layout.json"));
        var old="../docs/verification/city-rebuild-v002-phase47-building-audit.json";var saved=File.ReadAllBytes(old);
        try{typeof(CityRebuildV002Completion).GetMethod("AuditBuildings",System.Reflection.BindingFlags.NonPublic|System.Reflection.BindingFlags.Static).Invoke(null,new object[]{spec});File.Copy(old,"../docs/verification/city-rebuild-v002-phase8-building-audit.json",true);}finally{File.WriteAllBytes(old,saved);}
        Debug.Log("CITY_V002_PHASE8_FRESH_69_BUILDING_AUDIT_PASS");
    }
    public static void ReviseAndAuditBatch(){ReviseBatch();AuditBatch();}
    static JObject LightingSnapshot()=>new JObject{["ambientMode"]=RenderSettings.ambientMode.ToString(),["ambientIntensity"]=RenderSettings.ambientIntensity,["ambientLight"]=ColorUtility.ToHtmlStringRGBA(RenderSettings.ambientLight),["sun"]=RenderSettings.sun==null?null:EditorJsonUtility.ToJson(RenderSettings.sun),["shadows"]=QualitySettings.shadows.ToString(),["shadowDistance"]=QualitySettings.shadowDistance,["pipeline"]=GraphicsSettings.defaultRenderPipeline==null?null:GraphicsSettings.defaultRenderPipeline.name};
    static JObject Snapshot(Transform city)
    {
        var rows=new JObject();
        foreach(var t in city.GetComponentsInChildren<Transform>(true).Where(t=>root==null||!t.IsChildOf(root)))
        {string path=AnimationUtility.CalculateTransformPath(t,city);rows[path]=new JObject{["position"]=V(t.localPosition),["rotation"]=new JArray(t.localRotation.x,t.localRotation.y,t.localRotation.z,t.localRotation.w),["scale"]=V(t.localScale),["colliders"]=new JArray(t.GetComponents<Collider>().Select(c=>EditorJsonUtility.ToJson(c))),["meshes"]=new JArray(t.GetComponents<MeshFilter>().Select(m=>AssetDatabase.GetAssetPath(m.sharedMesh)))};}
        return rows;
    }
    static void Mat(string key,string hex){var m=new Material(Shader.Find("Standard")){name="Phase8_"+key,color=Hex(hex)};m.SetFloat("_Glossiness",.03f);AssetDatabase.CreateAsset(m,Folder+"/materials/"+key+".mat");palette[key]=m;}
    static Color Hex(string s){ColorUtility.TryParseHtmlString("#"+s,out var c);return c;}
    static void Polygon(List<Vector2> p,float y,string material)
    {
        if(!verts.ContainsKey(material)){verts[material]=new List<Vector3>();tris[material]=new List<int>();}
        float area=0;for(int i=0;i<p.Count;i++)area+=p[i].x*p[(i+1)%p.Count].y-p[(i+1)%p.Count].x*p[i].y;if(area<0)p.Reverse();
        var remaining=Enumerable.Range(0,p.Count).ToList();var output=new List<int>();int guard=0;
        while(remaining.Count>2&&guard++<p.Count*p.Count)
        {bool found=false;for(int i=0;i<remaining.Count;i++){int a=remaining[(i+remaining.Count-1)%remaining.Count],b=remaining[i],c=remaining[(i+1)%remaining.Count];if(Cross(p[b]-p[a],p[c]-p[b])<=.000001f)continue;if(remaining.Any(j=>j!=a&&j!=b&&j!=c&&Cross(p[b]-p[a],p[j]-p[a])>=0&&Cross(p[c]-p[b],p[j]-p[b])>=0&&Cross(p[a]-p[c],p[j]-p[c])>=0))continue;output.Add(a);output.Add(c);output.Add(b);remaining.RemoveAt(i);found=true;break;}if(!found)throw new InvalidOperationException("Polygon triangulation failed");}
        int start=verts[material].Count;verts[material].AddRange(p.Select(q=>new Vector3(q.x,y,q.y)));tris[material].AddRange(output.Select(i=>start+i));
    }
    static void Quad(Vector3 a,Vector3 b,Vector3 c,Vector3 d,string key)
    {
        if(!verts.ContainsKey(key)){verts[key]=new List<Vector3>();tris[key]=new List<int>();}
        int i=verts[key].Count;verts[key].AddRange(new[]{a,b,c,d});tris[key].AddRange(new[]{i,i+2,i+1,i,i+3,i+2,i,i+1,i+2,i,i+2,i+3});
    }
    static void Ribbon(Vector2 a,Vector2 b,float width,float y,string material){var d=(b-a).normalized;var n=new Vector2(-d.y,d.x)*width*.5f;Polygon(new List<Vector2>{a-n,b-n,b+n,a+n},y,material);}
    static List<Vector2> RoundedRect(Vector2 c,float w,float d,float r)=>new List<Vector2>{c+new Vector2(-w*.5f+r,-d*.5f),c+new Vector2(w*.5f-r,-d*.5f),c+new Vector2(w*.5f,-d*.5f+r),c+new Vector2(w*.5f,d*.5f-r),c+new Vector2(w*.5f-r,d*.5f),c+new Vector2(-w*.5f+r,d*.5f),c+new Vector2(-w*.5f,d*.5f-r),c+new Vector2(-w*.5f,-d*.5f+r)};
    static void FlushMeshes(){foreach(var key in verts.Keys){var mesh=new Mesh{name="Phase8_"+key,indexFormat=IndexFormat.UInt32};mesh.SetVertices(verts[key]);mesh.SetTriangles(tris[key],0);mesh.RecalculateNormals();mesh.RecalculateBounds();AssetDatabase.CreateAsset(mesh,Folder+"/meshes/"+key+".asset");var go=new GameObject("Phase8_"+key+"_DecorativeSurface");go.transform.SetParent(root,false);go.AddComponent<MeshFilter>().sharedMesh=mesh;go.AddComponent<MeshRenderer>().sharedMaterial=palette[key];}}
    static bool JunctionNear(Vector2 p,float r)=>layout["intersections"].Any(j=>Vector2.Distance(p,new Vector2((float)j["x"],(float)j["z"]))<r);
    static bool CrossingNear(Vector2 p,float r)=>layout["pedestrian_edges"].Where(e=>((string)e["kind"]).Contains("crossing")).Any(e=>Segments(Points(e["points"])).Any(s=>Distance(p,s.Item1,s.Item2)<r));
    static bool Clear(Vector2 p,float radius,bool reserve)
    {
        if(p.x-radius<-225||p.x+radius>195||p.y-radius<-245||p.y+radius>190)return false;
        if(graph.edges.Any(e=>Enumerable.Range(0,e.points.Length-1).Any(i=>Distance(p,new Vector2(e.points[i].x,e.points[i].z),new Vector2(e.points[i+1].x,e.points[i+1].z))<radius+e.width*.5f+.65f)))return false;
        foreach(var road in layout["roads"])if(Segments(Points(road["points"])).Any(s=>Distance(p,s.Item1,s.Item2)<radius+(float)road["carriageway_width"]*.5f+.3f))return false;
        foreach(var b in layout["buildings"].Concat(layout["campus"]["components"]))if(Mathf.Abs(p.x-(float)b["x"])<radius+(float)b["width"]*.5f+.5f&&Mathf.Abs(p.y-(float)b["z"])<radius+(float)b["depth"]*.5f+.5f)return false;
        foreach(var b in decorationBounds)if(Mathf.Abs(p.x-b.center.x)<radius+b.extents.x+.4f&&Mathf.Abs(p.y-b.center.z)<radius+b.extents.z+.4f)return false;
        var area=UnityEngine.Object.FindFirstObjectByType<CityV002RiverArea>();
        Physics.SyncTransforms();
        if(Physics.OverlapSphere(new Vector3(p.x,.9f,p.y),radius).Any(c=>c.bounds.max.y>.3f))return false;
        return true;
    }
    static void PlaceProp(string meshName,string name,Vector2 p,float yaw)
    {
        var asset=AssetDatabase.LoadAssetAtPath<GameObject>("Assets/SIMUS/Art/props/city_v002_phase8/phase8_street_kit.fbx");
        if(asset==null)throw new InvalidOperationException("Phase8 street kit missing");
        var instance=(GameObject)PrefabUtility.InstantiatePrefab(asset,root);instance.name=name;
        foreach(var r in instance.GetComponentsInChildren<MeshRenderer>(true))if(!r.name.StartsWith(meshName))r.gameObject.SetActive(false);
        instance.transform.rotation=Quaternion.Euler(0,yaw,0)*asset.transform.localRotation;
        var rs=instance.GetComponentsInChildren<MeshRenderer>();var b=rs[0].bounds;foreach(var r in rs.Skip(1))b.Encapsulate(r.bounds);
        // Match actual imported model AABB, keeping origin and source orientation intact.
        if(b.size.y<.2f||b.size.y>6)throw new InvalidOperationException("Unexpected imported prop orientation "+meshName+" "+b.size);
        instance.transform.position+=new Vector3(p.x-b.center.x,-.002f-b.min.y,p.y-b.center.z);
        b=rs[0].bounds;foreach(var r in rs.Skip(1))b.Encapsulate(r.bounds);decorationBounds.Add(b);
        foreach(var c in instance.GetComponentsInChildren<Collider>(true))UnityEngine.Object.DestroyImmediate(c);
        placements.Add(new JObject{["name"]=name,["mesh"]=meshName,["position"]=V(instance.transform.position),["bounds_size"]=V(b.size),["path_clearance_radius"]=meshName.Contains("Streetlamp")?.65:1.4});
    }
    static float Distance(Vector2 p,Vector2 a,Vector2 b){var d=b-a;return Vector2.Distance(p,a+d*Mathf.Clamp01(Vector2.Dot(p-a,d)/Mathf.Max(d.sqrMagnitude,.000001f)));}
    static IEnumerable<Tuple<Vector2,Vector2>> Segments(List<Vector2> p){for(int i=0;i<p.Count-1;i++)yield return Tuple.Create(p[i],p[i+1]);}
    static List<Vector2> Points(JToken t)=>t.Select(p=>new Vector2((float)p[0],(float)p[1])).ToList();
    static float Cross(Vector2 a,Vector2 b)=>a.x*b.y-a.y*b.x;
    static JArray V(Vector3 v)=>new JArray(v.x,v.y,v.z);
    static string Hash(string p){using(var h=SHA256.Create())return BitConverter.ToString(h.ComputeHash(File.ReadAllBytes(p))).Replace("-","").ToLowerInvariant();}
}
