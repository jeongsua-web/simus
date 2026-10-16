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

/// <summary>Phase 4 river addition. Incremental scene edit; never rebuilds the city.</summary>
public static class CityRebuildV002RiverSetup
{
    const string Folder = CityRebuildV002Setup.Folder;
    const string DesignPath = "../docs/planning/city_rebuild_v002/river-design.json";
    const string LayoutPath = "../docs/planning/city_rebuild_v002/layout.json";
    const string RootName = "12_River_Phase4";
    static JObject design, layout;
    static Transform root;
    static CityV002RiverArea area;
    static List<Vector3> line;
    static List<List<Vector2>> cut;
    static readonly List<string> generated = new List<string>();
    static Material soil, grass, gravel, water, timber, rail;
    static float[] offsets = { -12,-11.2f,-8.8f,-8.3f,-6.5f,-5,-3,0,3,5,6.5f,8.3f,8.8f,11.2f,12 };
    static float[] heights = { -.02f,-.43f,-.43f,-.45f,-.45f,-1.2f,-2,-2,-2,-1.2f,-.45f,-.45f,-.43f,-.43f,-.02f };
    static readonly List<CityV002PedestrianGraph.Node> addedNodes = new List<CityV002PedestrianGraph.Node>();
    static readonly List<CityV002PedestrianGraph.Edge> addedEdges = new List<CityV002PedestrianGraph.Edge>();
    static JArray bridgeEvidence;

    [MenuItem("SIMUS/City Rebuild v002/Apply Phase 4 River")]
    public static void Apply()
    {
        if (EditorApplication.isPlayingOrWillChangePlaymode) throw new InvalidOperationException("River edit requires Edit Mode.");
        design = JObject.Parse(File.ReadAllText(DesignPath)); layout = JObject.Parse(File.ReadAllText(LayoutPath));
        var protectedPaths = new[] { LayoutPath, "../docs/planning/city_rebuild_v002/buildings.csv", "../docs/planning/city_rebuild_v002/campus-placements.csv", "ProjectSettings/EditorBuildSettings.asset", CompletedMapFollowSetup.ScenePath };
        var protectedHashes = protectedPaths.ToDictionary(p => p, Hash);
        var scene = EditorSceneManager.OpenScene(CityRebuildV002Setup.ScenePath);
        var city = scene.GetRootGameObjects().Single(g => g.name == "CityRebuild_v002").transform;
        var buildingBefore = Snapshot(city);
        var originalRoot = city.Find(RootName);
        var previousArea = originalRoot != null ? originalRoot.GetComponent<CityV002RiverArea>() : null;
        var ground = city.Find("01_Ground/CityGround").GetComponent<MeshFilter>();
        var lawn = city.Find("09_ParkAndGreenery/EastPark/EastPark_Lawn").GetComponent<MeshFilter>();
        var originalGround = previousArea != null ? previousArea.originalGround : ground.sharedMesh;
        var originalLawn = previousArea != null ? previousArea.originalLawn : lawn.sharedMesh;
        if (originalRoot != null) UnityEngine.Object.DestroyImmediate(originalRoot.gameObject);
        root = new GameObject(RootName).transform; root.SetParent(city, false);
        area = root.gameObject.AddComponent<CityV002RiverArea>();
        area.originalGround = originalGround; area.originalLawn = originalLawn;
        Directory.CreateDirectory(Folder + "/river_meshes"); Directory.CreateDirectory(Folder + "/river_materials");
        AssetDatabase.Refresh(); generated.Clear(); addedNodes.Clear(); addedEdges.Clear();
        soil = Mat("riverbed_ochre", new Color(.32f,.27f,.19f)); grass = Mat("riverbank_lawn", new Color(.36f,.44f,.26f));
        gravel = Mat("river_trail_gravel", new Color(.54f,.47f,.34f)); water = Mat("river_water", new Color(.12f,.40f,.44f));
        var trailShader = Shader.Find("SIMUS/River Trail Surface");
        if (trailShader == null) throw new InvalidOperationException("River trail surface shader missing.");
        gravel.shader = trailShader; EditorUtility.SetDirty(gravel);
        timber = Mat("bridge_timber", new Color(.48f,.33f,.20f)); rail = Mat("bridge_rail", new Color(.28f,.23f,.17f));
        line = Curve(design["control_points"]); area.centreline = line.ToArray();
        area.bridgeStarts = design["bridges"].Select(b => V(b["endpoints"][0], .14f)).ToArray();
        area.bridgeEnds = design["bridges"].Select(b => V(b["endpoints"][1], .14f)).ToArray();
        cut = Shapes(12);
        ReplaceCut(ground, originalGround, "Carved_CityGround"); ReplaceCut(lawn, originalLawn, "Carved_EastPark_Lawn");
        Basin(); BuildWater(); BuildBankTrails();
        var foliageExclusions = new JArray();
        foreach (var groupName in new[]{"Trees","ParkBenches"})
        {
            var group=city.Find("09_ParkAndGreenery/EastPark/"+groupName);if(group==null)continue;
            foreach(Transform prop in group)
                if(!prop.gameObject.activeSelf || prop.GetComponentsInChildren<Collider>(true).Any(c=>area.DistanceToWaterAxis(c.bounds.center)<12.2f+Mathf.Max(c.bounds.extents.x,c.bounds.extents.z)))
                {prop.gameObject.SetActive(false);foliageExclusions.Add(prop.name);}
        }
        // The existing trails stay at the approved height. Dry approach berms support their
        // intersections with the lowered bank; the wet crossing spans are bridge decks.
        BuildExistingTrailBerms(city);
        bridgeEvidence = new JArray();
        for (int i = 0; i < area.bridgeStarts.Length; i++) BuildBridge(i);
        var graph = city.GetComponentInChildren<CityV002PedestrianGraph>();
        if (graph == null) graph = MakeBaseGraph(city);
        ExtendNavigation(graph);
        var actor = UnityEngine.Object.FindObjectsByType<TestNpcPatrol>(FindObjectsSortMode.None).FirstOrDefault();
        if (actor == null) throw new InvalidOperationException("Preserved test NPC missing.");
        CreateProbe(actor, graph, "river_west_roundtrip", "RIVER_W_0", "RIVER_W_" + (line.Count - 1));
        CreateProbe(actor, graph, "river_east_roundtrip", "RIVER_E_0", "RIVER_E_" + (line.Count - 1));
        CreateProbe(actor, graph, "river_bridge_to_park", "RIVER_W_0", "PARK_REST_2");
        foreach (var p in UnityEngine.Object.FindObjectsByType<TestNpcPatrol>(FindObjectsSortMode.None))
        { var guard = p.GetComponent<CityV002RiverGuard>(); if (guard == null) guard = p.gameObject.AddComponent<CityV002RiverGuard>(); guard.river = area; }
        Physics.SyncTransforms();
        var graphAudit = AuditGraph(graph);
        var depthAudit = AuditDepth();
        if (!JToken.DeepEquals(buildingBefore, Snapshot(city))) throw new InvalidOperationException("Existing building transform changed.");
        foreach (var p in protectedHashes) if (Hash(p.Key) != p.Value) throw new InvalidOperationException("Protected source changed: " + p.Key);
        EditorSceneManager.MarkSceneDirty(scene); AssetDatabase.SaveAssets(); EditorSceneManager.SaveScene(scene);
        var report = new JObject { ["status"] = "PASS: river assembled and graph/physics editor audit completed; Play Mode pending separately", ["scene_sha256"] = Hash(CityRebuildV002Setup.ScenePath),
            ["design_sha256"] = Hash(DesignPath), ["unity_version"] = Application.unityVersion, ["generated_assets"] = new JArray(generated),
            ["cut_objects"] = new JArray(ground.name,lawn.name), ["water_y"] = -1.2, ["bed_y"] = -2, ["bank_y"] = -.45, ["trail_y"] = -.43,
            ["water_width_m"] = 10, ["corridor_width_m"] = 24, ["centreline"] = new JArray(line.Select(v => new JArray(v.x,v.z))), ["bridges"] = bridgeEvidence,
            ["graph_audit"] = graphAudit, ["depth_audit"] = depthAudit, ["preserved_inactive_trees_in_excavation"] = foliageExclusions, ["building_transforms_unchanged"] = true, ["protected_hashes"] = JObject.FromObject(protectedHashes), ["play_mode"] = "NOT TESTED by Apply" };
        File.WriteAllText("../docs/verification/city-rebuild-v002-river-unity-results.json", report.ToString());
        Debug.Log("CITY_V002_RIVER_READY meshAssets=" + generated.Count + " nodes=" + graph.nodes.Length + " edges=" + graph.edges.Length);
    }

    static Vector3 V(JToken a, float y) => new Vector3((float)a[0],y,(float)a[1]);
    static Vector2 XZ(Vector3 p) => new Vector2(p.x,p.z);
    static Vector3 Normal(int i)
    { var d = line[Mathf.Min(i+1,line.Count-1)] - line[Mathf.Max(0,i-1)]; return new Vector3(-d.z,0,d.x).normalized; }
    static Vector3 At(int i, float offset, float y) { var p = line[i] + Normal(i)*offset; p.y=y; return p; }
    static float BankY(int i,float sign)
    {
        var p=XZ(At(i,sign*10,0));float nearest=float.PositiveInfinity;
        foreach(var e in layout["pedestrian_edges"].Where(e=>(string)e["kind"]=="park_trail"))
        {var q=e["points"].Select(t=>V(t,0)).ToArray();for(int k=1;k<q.Length;k++)nearest=Mathf.Min(nearest,Distance(p,XZ(q[k-1]),XZ(q[k])));}
        // Raise the bank trail at existing trails/decks and taper for a full 12m approach.
        return Mathf.Lerp(.14f,-.428f,Mathf.Clamp01((nearest-2)/12));
    }
    static List<Vector3> Curve(JToken controls)
    {
        var c=controls.Select(p=>V(p,0)).ToArray(); var result=new List<Vector3>();
        for(int i=0;i<c.Length-1;i++)
        {
            var a=c[Mathf.Max(0,i-1)];var b=c[i];var d=c[i+1];var e=c[Mathf.Min(c.Length-1,i+2)];
            int steps=Mathf.CeilToInt(Vector3.Distance(b,d)/2f);
            for(int s=0;s<steps;s++) { float t=(float)s/steps; result.Add(.5f*(2*b+(-a+d)*t+(2*a-5*b+4*d-e)*t*t+(-a+3*b-3*d+e)*t*t*t)); }
        }
        result.Add(c[c.Length-1]);return result;
    }
    static List<List<Vector2>> Shapes(float half)
    {
        var result=new List<List<Vector2>>();
        for(int i=1;i<line.Count;i++) result.Add(CCW(new List<Vector2>{XZ(At(i-1,-half,0)),XZ(At(i,-half,0)),XZ(At(i,half,0)),XZ(At(i-1,half,0))}));
        foreach(var p in new[]{line[0],line[line.Count-1]}) result.Add(CCW(Enumerable.Range(0,32).Select(i=>XZ(p)+new Vector2(Mathf.Cos(i*Mathf.PI/16),Mathf.Sin(i*Mathf.PI/16))*half).ToList()));
        return result;
    }
    static void ReplaceCut(MeshFilter target, Mesh original, string key)
    {
        var v=original.vertices;var t=original.triangles;var pieces=new List<List<Vector2>>();
        for(int i=0;i<t.Length;i+=3) pieces.Add(CCW(new List<Vector2>{XZ(target.transform.TransformPoint(v[t[i]])),XZ(target.transform.TransformPoint(v[t[i+1]])),XZ(target.transform.TransformPoint(v[t[i+2]]))}));
        pieces=Subtract(pieces,cut);float y=target.transform.TransformPoint(v[0]).y;
        var vertices=new List<Vector3>();var indices=new List<int>();
        foreach(var p in pieces) Fan(p.Select(q=>new Vector3(q.x,y,q.y)).ToList(),vertices,indices);
        var mesh=MeshAsset(key,vertices,indices); target.sharedMesh=mesh;var collider=target.transform.GetComponent<MeshCollider>();collider.sharedMesh=null;collider.sharedMesh=mesh;
        if(target.transform.position.sqrMagnitude>.000001f||target.transform.rotation!=Quaternion.identity||target.transform.lossyScale!=Vector3.one) throw new InvalidOperationException("Expected identity frame for ground carve.");
    }
    static void Basin()
    {
        var vertices=new List<Vector3>();var triangles=new List<int>();
        for(int i=1;i<line.Count;i++) for(int j=1;j<offsets.Length;j++)
            Quad(At(i-1,offsets[j-1],heights[j-1]),At(i,offsets[j-1],heights[j-1]),At(i,offsets[j],heights[j]),At(i-1,offsets[j],heights[j]),vertices,triangles);
        Surface("River_Excavated_Bed_Banks",vertices,triangles,soil,true);
        // Separate vegetated upper banks retain faceted low-poly geometry.
        foreach(int sign in new[]{-1,1})
        {
            var vs=new List<Vector3>();var ts=new List<int>();
            for(int i=1;i<line.Count;i++)
                Quad(At(i-1,sign*6.5f,-.446f),At(i,sign*6.5f,-.446f),At(i,sign*8.3f,-.446f),At(i-1,sign*8.3f,-.446f),vs,ts);
            Surface("River_"+(sign<0?"East":"West")+"_FloodBench",vs,ts,grass,true);
        }
        for(int end=0;end<2;end++)
        {
            int index=end==0?0:line.Count-1;var p=line[index];var outward=(end==0?line[0]-line[1]:line[index]-line[index-1]).normalized;var n=Normal(index);
            var vs=new List<Vector3>();var ts=new List<int>();float[] rings={0,3,5,6.5f,8.3f,8.8f,11.2f,12};float[] ys={-2,-2,-1.2f,-.45f,-.45f,-.43f,-.43f,-.02f};
            for(int j=1;j<rings.Length;j++) for(int k=0;k<16;k++)
            {
                float a=k*Mathf.PI/16,b=(k+1)*Mathf.PI/16;
                Func<float,float,float,Vector3> cap=(r,y,t)=>new Vector3(p.x,y,p.z)+(n*Mathf.Cos(t)+outward*Mathf.Sin(t))*r;
                Quad(cap(rings[j-1],ys[j-1],a),cap(rings[j-1],ys[j-1],b),cap(rings[j],ys[j],b),cap(rings[j],ys[j],a),vs,ts);
            }
            Surface("River_Closed_Bowl_"+end,vs,ts,soil,true);
        }
    }
    static void BuildWater()
    {
        var vs=new List<Vector3>();var ts=new List<int>();
        for(int i=1;i<line.Count;i++) Quad(At(i-1,-5,-1.2f),At(i,-5,-1.2f),At(i,5,-1.2f),At(i-1,5,-1.2f),vs,ts);
        for(int end=0;end<2;end++)
        {
            int index=end==0?0:line.Count-1;var p=line[index];p.y=-1.2f;var outward=(end==0?line[0]-line[1]:line[index]-line[index-1]).normalized;var n=Normal(index);
            for(int k=0;k<16;k++) Tri(p,p+(n*Mathf.Cos(k*Mathf.PI/16)+outward*Mathf.Sin(k*Mathf.PI/16))*5,p+(n*Mathf.Cos((k+1)*Mathf.PI/16)+outward*Mathf.Sin((k+1)*Mathf.PI/16))*5,vs,ts);
        }
        var go=Surface("River_Water_Surface",vs,ts,water,false);
        var controller=go.AddComponent<CityV002RiverWater>();controller.waterRenderer=go.GetComponent<Renderer>();controller.Apply();
    }
    static void BuildBankTrails()
    {
        for(int side=0;side<2;side++)
        {
            float sign=side==0?1:-1;string name=side==0?"W":"E";var vs=new List<Vector3>();var ts=new List<int>();
            for(int i=1;i<line.Count;i++)
            {
                float ay=BankY(i-1,sign),by=BankY(i,sign);
                Quad(At(i-1,sign*8.8f,ay),At(i,sign*8.8f,by),At(i,sign*11.2f,by),At(i-1,sign*11.2f,ay),vs,ts);
                foreach(float edge in new[]{8.8f,11.2f})Quad(At(i-1,sign*edge,-.43f),At(i,sign*edge,-.43f),At(i,sign*edge,by),At(i-1,sign*edge,ay),vs,ts);
            }
            Surface("River_"+name+"_BankTrail",vs,ts,gravel,true);
            for(int i=0;i<line.Count;i++)
            {
                AddNode("RIVER_"+name+"_"+i,At(i,sign*10,BankY(i,sign)+.02f));
                if(i>0) AddEdge("RIVER_"+name+"_TRAIL_"+i,"RIVER_"+name+"_"+(i-1),"RIVER_"+name+"_"+i,2.4f,"river_trail",new[]{At(i-1,sign*10,BankY(i-1,sign)+.02f),At(i,sign*10,BankY(i,sign)+.02f)});
            }
        }
        for(int end=0;end<2;end++)
        {
            int index=end==0?0:line.Count-1;var p=line[index];var n=Normal(index);var outward=(end==0?line[0]-line[1]:line[index]-line[index-1]).normalized;
            var vs=new List<Vector3>();var ts=new List<int>();
            for(int k=0;k<16;k++)
            {
                float a=k*Mathf.PI/16,b=(k+1)*Mathf.PI/16;
                Func<float,float,Vector3> cap=(r,t)=>{var q=p+(n*Mathf.Cos(t)+outward*Mathf.Sin(t))*r;q.y=Mathf.Lerp(BankY(index,1),BankY(index,-1),(1-Mathf.Cos(t))*.5f);return q;};
                Quad(cap(8.8f,a),cap(8.8f,b),cap(11.2f,b),cap(11.2f,a),vs,ts);
            }
            Surface("River_Closed_Cap_Trail_"+end,vs,ts,gravel,true);
        }
    }
    static void BuildExistingTrailBerms(Transform city)
    {
        var wet=Shapes(5.5f);var vs=new List<Vector3>();var ts=new List<int>();
        foreach(var e in layout["pedestrian_edges"].Where(e=>(string)e["kind"]=="park_trail" && (string)e["id"]!="PKE02_S0" && (string)e["id"]!="PKE07_S0"))
        {
            var points=e["points"].Select(p=>V(p,0)).ToArray();float half=(float)e["width"]*.5f+.25f;
            for(int i=1;i<points.Length;i++)
            {
                var d=(points[i]-points[i-1]).normalized;var n=new Vector3(-d.z,0,d.x)*half;
                var poly=CCW(new List<Vector2>{XZ(points[i-1]-n),XZ(points[i]-n),XZ(points[i]+n),XZ(points[i-1]+n)});
                // Clipping each strip to individual excavation panels keeps every retaining fill
                // inside the excavation, then removes the wet shoreline with 0.5m clearance.
                foreach(var panel in cut)
                {
                    var inside=poly;
                    for(int k=0;k<panel.Count && inside.Count>2;k++)inside=Clip(inside,panel[k],panel[(k+1)%panel.Count],true);
                    if(inside.Count<3)continue;
                    foreach(var piece in Subtract(new List<List<Vector2>>{inside},wet))
                    {
                        Fan(piece.Select(p=>new Vector3(p.x,-.015f,p.y)).ToList(),vs,ts);
                        for(int k=0;k<piece.Count;k++)
                        {var a=piece[k];var b=piece[(k+1)%piece.Count];Quad(new Vector3(a.x,-.45f,a.y),new Vector3(b.x,-.45f,b.y),new Vector3(b.x,-.015f,b.y),new Vector3(a.x,-.015f,a.y),vs,ts);}
                    }
                }
            }
        }
        Surface("Existing_Trail_Dry_Approach_Berms",vs,ts,grass,true);
    }
    static void BuildBridge(int index)
    {
        var spec=design["bridges"][index];string originalEdge=(string)spec["original_edge"]+"_S0";var a=area.bridgeStarts[index];var b=area.bridgeEnds[index];string key="River_Bridge_"+index;
        var dir=(b-a).normalized;var normal=new Vector3(-dir.z,0,dir.x);var vs=new List<Vector3>();var ts=new List<int>();
        Quad(a-normal*1.7f,b-normal*1.7f,b+normal*1.7f,a+normal*1.7f,vs,ts);
        var deck=Surface(key+"_Deck",vs,ts,timber,true);
        string model=index==0?"RIVER_FOOTBRIDGE_NORTH_28_70":"RIVER_FOOTBRIDGE_SOUTH_32_10";
        string modelPath="Assets/SIMUS/Art/props/river_footbridge_v001/models/"+model+".fbx";
        var asset=AssetDatabase.LoadAssetAtPath<GameObject>(modelPath);
        if(asset==null)throw new InvalidOperationException("Required Blender bridge FBX missing: "+modelPath);
        // Eight millimetres of finish clearance prevents coplanar flicker with retained
        // original park paths. Physics and graph stay on their unchanged 0.14m deck.
        var bridgeModel=Model(asset,key+"_Actual_FBX",(a+b)*.5f+Vector3.up*.008f,Quaternion.LookRotation(dir));deck.GetComponent<Renderer>().enabled=false;
        var bounds=LocalBounds(asset);
        if(Mathf.Abs(bounds.size.x-3.4f)>.02f || Mathf.Abs(bounds.size.z-(float)spec["length_m"])>.03f || Mathf.Abs(bounds.max.y)>.02f)
            throw new InvalidOperationException("Blender bridge native size/axis mismatch "+modelPath+" "+bounds);
        var worldBounds=LocalBounds(bridgeModel);
        if(Mathf.Abs(worldBounds.size.y-.4f)>.02f || Mathf.Abs(worldBounds.max.y-.14f)>.02f)
            throw new InvalidOperationException("Placed bridge visual must remain horizontal at deck height: "+worldBounds);
        var railAsset=AssetDatabase.LoadAssetAtPath<GameObject>("Assets/SIMUS/Art/props/river_footbridge_v001/models/RIVER_RAIL_MODULE_2M.fbx");
        var postAsset=AssetDatabase.LoadAssetAtPath<GameObject>("Assets/SIMUS/Art/props/river_footbridge_v001/models/RIVER_RAIL_END_POST.fbx");
        if(railAsset==null||postAsset==null)throw new InvalidOperationException("Actual Blender railing kit missing.");
        var railBounds=LocalBounds(railAsset);
        if(Mathf.Abs(railBounds.size.z-2)>.03f || Mathf.Abs(railBounds.size.y-1.1f)>.03f)throw new InvalidOperationException("Railing native axes/size mismatch "+railBounds);
        float length=Vector3.Distance(a,b);int railCount=0;
        var placedRails=new List<Tuple<float,float>>();
        for(float s=1;s<length-1;s+=2)
            foreach(float sign in new[]{-1f,1f})
            {
                var p=a+dir*s+normal*(sign*1.6f);bool entry=false;
                foreach(var e in layout["pedestrian_edges"].Where(e=>(string)e["kind"]=="park_trail" && (string)e["id"]!=originalEdge))
                {var q=e["points"].Select(t=>V(t,0)).ToArray();for(int k=1;k<q.Length;k++)if(Distance(XZ(p),XZ(q[k-1]),XZ(q[k]))<(float)e["width"]*.5f+1.6f)entry=true;}
                foreach(float bankSign in new[]{-1f,1f}) for(int k=1;k<line.Count;k++)
                    if(BankY(k,bankSign)>.08f && Distance(XZ(p),XZ(At(k-1,bankSign*10,0)),XZ(At(k,bankSign*10,0)))<2.8f)entry=true;
                if(entry)continue;
                string railName=key+"_Rail_"+railCount++;
                var visual=Model(railAsset,railName+"_Actual_FBX",p+Vector3.up*.008f,Quaternion.LookRotation(dir));
                if(Mathf.Abs(LocalBounds(visual).size.y-1.1f)>.02f)throw new InvalidOperationException("Placed rail visual is not upright.");
                var collision=Box(railName+"_Collision",p+Vector3.up*.55f,new Vector3(.16f,1.1f,1.99f),dir,rail,true);collision.GetComponent<Renderer>().enabled=false;placedRails.Add(Tuple.Create(s,sign));
            }
        foreach(var segment in placedRails)
            if(!placedRails.Any(t=>Mathf.Abs(t.Item2-segment.Item2)<.1f&&Mathf.Abs(t.Item1-segment.Item1-2)<.1f))
            {var p=a+dir*(segment.Item1+1)+normal*(segment.Item2*1.6f);Model(postAsset,key+"_Rail_Terminal",p+Vector3.up*.008f,Quaternion.LookRotation(dir));}
        string na="RIVER_BRIDGE_"+index+"_A",nb="RIVER_BRIDGE_"+index+"_B";
        AddNode(na,a+Vector3.up*.02f);AddNode(nb,b+Vector3.up*.02f);AddEdge("RIVER_BRIDGE_"+index,na,nb,3,"river_bridge",new[]{a+Vector3.up*.02f,b+Vector3.up*.02f});
        for(int end=0;end<2;end++)
        {
            var landing=end==0?a:b;int near=Enumerable.Range(0,line.Count).OrderBy(i=>(line[i]-landing).sqrMagnitude).First();
            float sign=Vector3.Dot(landing-line[near],Normal(near))>0?1:-1;string side=sign>0?"W":"E";
            // BankY already provides the twelve-metre <=5% climb. Connect at its crest,
            // then cross the upper bank at deck height instead of burying a diagonal ramp.
            int rampIndex=Enumerable.Range(0,line.Count).OrderBy(i=>Distance(XZ(At(i,sign*10,0)),XZ(a),XZ(b))).First();
            var start=At(rampIndex,sign*10,BankY(rampIndex,sign));float run=Vector2.Distance(XZ(start),XZ(landing));
            if(Mathf.Abs(start.y-landing.y)/Mathf.Max(.01f,run)>.05f)throw new InvalidOperationException("Bridge connection exceeds 5% grade "+index);
            Strip("River_Ramp_"+index+"_"+end,new[]{start,landing},2.4f,gravel);
            AddEdge("RIVER_RAMP_"+index+"_"+end,"RIVER_"+side+"_"+rampIndex,end==0?na:nb,2.4f,"river_ramp",new[]{start+Vector3.up*.02f,landing+Vector3.up*.02f});
        }
        // Connect each preserved crossing to the new bridge without inventing a shortcut over water.
        string oldFrom=(string)layout["pedestrian_edges"].Single(e=>(string)e["id"]==originalEdge)["from"];
        var oldPoint=layout["pedestrian_nodes"].Single(n=>(string)n["id"]==oldFrom);var pold=new Vector3((float)oldPoint["x"],.16f,(float)oldPoint["z"]);
        var projected=a+dir*Mathf.Clamp(Vector3.Dot(pold-a,dir),0,length);projected.y=.16f;
        string join="RIVER_BRIDGE_"+index+"_JOIN";AddNode(join,projected);
        AddEdge("RIVER_BRIDGE_"+index+"_OLD_JOIN",oldFrom,join,2.5f,"bridge_join",new[]{pold,projected});
        AddEdge("RIVER_BRIDGE_"+index+"_JOIN_A",join,na,3,"river_bridge",new[]{projected,a+Vector3.up*.02f});
        AddEdge("RIVER_BRIDGE_"+index+"_JOIN_B",join,nb,3,"river_bridge",new[]{projected,b+Vector3.up*.02f});
        bridgeEvidence.Add(new JObject{["id"]=(string)spec["id"],["source_edge"]=(string)spec["original_edge"],["length_m"]=length,["deck_y"]=.14,["clear_width_m"]=3,["actual_fbx"]=asset!=null?modelPath:"NOT YET AVAILABLE: procedural deck retained",["rail_segments"]=railCount,
            ["imported_deck_native_size"]=new JArray(bounds.size.x,bounds.size.y,bounds.size.z),["placed_visual_world_y_size"]=worldBounds.size.y,["placed_visual_deck_y"]=worldBounds.max.y,["rail_native_size"]=new JArray(railBounds.size.x,railBounds.size.y,railBounds.size.z),["polygon"]=new JArray(new[]{a-normal*1.7f,b-normal*1.7f,b+normal*1.7f,a+normal*1.7f}.Select(v=>new JArray(v.x,v.z)))});
    }

    static CityV002PedestrianGraph MakeBaseGraph(Transform city)
    {
        var go=new GameObject("11_PedestrianNavigation_v002");go.transform.SetParent(city,false);var g=go.AddComponent<CityV002PedestrianGraph>();g.layoutSha256=Hash(LayoutPath);
        g.nodes=layout["pedestrian_nodes"].Select(n=>new CityV002PedestrianGraph.Node{id=(string)n["id"],position=new Vector3((float)n["x"],.16f,(float)n["z"])}).ToArray();
        var ids=g.nodes.Select((n,i)=>new{n.id,i}).ToDictionary(n=>n.id,n=>n.i);
        g.edges=layout["pedestrian_edges"].Select(e=>new CityV002PedestrianGraph.Edge{id=(string)e["id"],kind=(string)e["kind"],from=ids[(string)e["from"]],to=ids[(string)e["to"]],width=(float)e["width"],points=e["points"].Select(p=>V(p,.16f)).ToArray()}).ToArray();return g;
    }
    static void AddNode(string id,Vector3 p)=>addedNodes.Add(new CityV002PedestrianGraph.Node{id=id,position=p});
    static void AddEdge(string id,string from,string to,float width,string kind,Vector3[] points)
    {addedEdges.Add(new CityV002PedestrianGraph.Edge{id=id,kind=kind,width=width,points=points,from=addedNodes.FindIndex(n=>n.id==from),to=addedNodes.FindIndex(n=>n.id==to)});edgeNodeNames[id]=new[]{from,to};}
    static readonly Dictionary<string,string[]> edgeNodeNames=new Dictionary<string,string[]>();
    public static void ExtendNavigation(CityV002PedestrianGraph graph)
    {
        // Called by the original Phase 5 setup too, so rebuilding its base graph cannot drop the river.
        if(addedNodes.Count==0)
        {
            var existing=UnityEngine.Object.FindFirstObjectByType<CityV002RiverGraphExtension>();
            if(existing!=null)existing.Apply(graph);return;
        }
        var baseNodes=graph.nodes.Where(n=>!n.id.StartsWith("RIVER_")).ToArray();
        var baseEdges=graph.edges.Where(e=>!e.id.StartsWith("RIVER_")).ToArray();
        graph.nodes=baseNodes.Concat(addedNodes).ToArray();var ids=graph.nodes.Select((n,i)=>new{n.id,i}).ToDictionary(n=>n.id,n=>n.i);
        foreach(var e in addedEdges){e.from=ids[edgeNodeNames[e.id][0]];e.to=ids[edgeNodeNames[e.id][1]];}
        graph.edges=baseEdges.Concat(addedEdges).ToArray();
        var ext=root.GetComponent<CityV002RiverGraphExtension>();if(ext==null)ext=root.gameObject.AddComponent<CityV002RiverGraphExtension>();
        ext.nodes=addedNodes.ToArray();ext.edges=addedEdges.ToArray();ext.fromIds=addedEdges.Select(e=>edgeNodeNames[e.id][0]).ToArray();ext.toIds=addedEdges.Select(e=>edgeNodeNames[e.id][1]).ToArray();
    }
    static void CreateProbe(TestNpcPatrol template,CityV002PedestrianGraph graph,string id,string from,string to)
    {
        var go=UnityEngine.Object.Instantiate(template.gameObject,root);go.name=id;
        var adapter=go.GetComponent<CityV002NpcRouteAdapter>();if(adapter==null)adapter=go.AddComponent<CityV002NpcRouteAdapter>();
        adapter.graph=graph;adapter.routeId=id;adapter.startNode=from;adapter.destinationNode=to;adapter.returnToStart=true;adapter.startAutomatically=true;
        if(!graph.TryRoute(from,to,out var p,out var _,out var _))throw new InvalidOperationException("Disconnected river probe "+id);go.transform.position=p[0];
    }
    public static JObject AuditGraph(CityV002PedestrianGraph graph)
    {
        var river=UnityEngine.Object.FindFirstObjectByType<CityV002RiverArea>();int wet=0,missing=0,samples=0,finite=0,blocked=0,bridgeHits=0;float maxError=0;var failures=new JArray();
        foreach(var edge in graph.edges)
            for(int i=1;i<edge.points.Length;i++)
            {
                var a=edge.points[i-1];var b=edge.points[i];int count=Mathf.Max(1,Mathf.CeilToInt(Vector3.Distance(a,b)/.3f));
                for(int k=0;k<=count;k++)
                {
                    var p=Vector3.Lerp(a,b,(float)k/count);samples++;
                    if(river.IsForbidden(p)){wet++;if(failures.Count<10)failures.Add(edge.id+" wet "+p);}
                    var hits=Physics.RaycastAll(p+Vector3.up*2,Vector3.down,5,Physics.DefaultRaycastLayers,QueryTriggerInteraction.Ignore).Where(h=>h.normal.y>.5f).ToArray();
                    float error=hits.Length==0?999:hits.Min(h=>Mathf.Abs(h.point.y-(p.y-.02f)));
                    maxError=Mathf.Max(maxError,error);if(error>.23f){missing++;if(failures.Count<10)failures.Add(edge.id+" support error "+error+" at "+p);}
                    if(river.DistanceToWaterAxis(p)<18 || edge.id.StartsWith("RIVER_"))
                    {
                        var d=b-a;d.y=0;var n=new Vector3(-d.z,0,d.x).normalized;
                        foreach(float offset in new[]{-(edge.width*.5f-.2f),0,edge.width*.5f-.2f})
                        {
                            var q=p+n*offset;finite++;
                            if(river.IsForbidden(q,.2f)){wet++;if(failures.Count<10)failures.Add(edge.id+" finite wet "+q);}
                            var support=Physics.RaycastAll(q+Vector3.up*1.8f,Vector3.down,4,Physics.DefaultRaycastLayers,QueryTriggerInteraction.Ignore).Where(h=>h.normal.y>.5f).ToArray();
                            float ferr=support.Length==0?999:support.Min(h=>Mathf.Abs(h.point.y-(q.y-.02f)));
                            if(ferr>.08f){missing++;if(failures.Count<10)failures.Add(edge.id+" finite support error "+ferr+" at "+q);}
                            if(river.DistanceToWaterAxis(q)<5)
                            {
                                if(!support.Any(h=>h.collider.name.Contains("Bridge_")&&h.collider.name.EndsWith("_Deck")&&Mathf.Abs(h.point.y-.14f)<.02f))
                                {missing++;if(failures.Count<10)failures.Add(edge.id+" lacks actual physical bridge deck "+q);}else bridgeHits++;
                            }
                            var obstacles=Physics.OverlapCapsule(q+Vector3.up*.25f,q+Vector3.up*1.5f,.2f,Physics.DefaultRaycastLayers,QueryTriggerInteraction.Ignore)
                                .Where(c=>c.enabled&&!c.GetComponentInParent<TestNpcPatrol>()&&c.bounds.max.y>q.y+.18f).ToArray();
                            if(obstacles.Length>0){blocked++;if(failures.Count<10)failures.Add(edge.id+" capsule blocked "+q+" by "+string.Join(",",obstacles.Select(c=>c.name)));}
                        }
                    }
                }
            }
        if(wet>0||missing>0||blocked>0)throw new InvalidOperationException("River graph audit wet="+wet+" unsupported="+missing+" blocked="+blocked+" "+failures);
        return new JObject{["nodes"]=graph.nodes.Length,["edges"]=graph.edges.Length,["samples"]=samples,["finite_width_samples"]=finite,["capsule_radius_m"]=.2,["capsule_blocked"]=blocked,["actual_physical_bridge_hits"]=bridgeHits,["wet_violations"]=wet,["unsupported"]=missing,["maximum_support_height_error_m"]=maxError};
    }
    public static JObject AuditDepth()
    {
        var river=UnityEngine.Object.FindFirstObjectByType<CityV002RiverArea>();int samples=0,flatLeaks=0,missingBed=0;
        foreach(var p in river.centreline)
        {
            if(river.OnBridge(new Vector3(p.x,.16f,p.z),0))continue;
            samples++;var hits=Physics.RaycastAll(p+Vector3.up,Vector3.down,5,Physics.DefaultRaycastLayers,QueryTriggerInteraction.Ignore);
            if(hits.Any(h=>(h.collider.name=="CityGround"||h.collider.name=="EastPark_Lawn")&&h.point.y>-1.2f))flatLeaks++;
            if(!hits.Any(h=>h.collider.name=="River_Excavated_Bed_Banks"&&Mathf.Abs(h.point.y+2)<.03f))missingBed++;
        }
        if(flatLeaks>0||missingBed>0)throw new InvalidOperationException("Excavation depth failure flatLeaks="+flatLeaks+" missingBed="+missingBed);
        return new JObject{["axis_samples"]=samples,["old_flat_ground_hits_beneath_water"]=flatLeaks,["missing_bed_hits"]=missingBed,["bed_y"]=-2,["water_y"]=-1.2,["ground_y"]=-.02,["water_has_collider"]=river.transform.Find("River_Water_Surface").GetComponent<Collider>()!=null};
    }

    static void Strip(string name,Vector3[] p,float width,Material mat)
    {var v=new List<Vector3>();var t=new List<int>();for(int i=1;i<p.Length;i++){var d=p[i]-p[i-1];d.y=0;var n=new Vector3(-d.z,0,d.x).normalized*width*.5f;Quad(p[i-1]-n,p[i]-n,p[i]+n,p[i-1]+n,v,t);}Surface(name,v,t,mat,true);}
    static GameObject Box(string name,Vector3 p,Vector3 size,Vector3 dir,Material mat,bool collider)
    {var go=GameObject.CreatePrimitive(PrimitiveType.Cube);go.name=name;go.transform.SetParent(root,false);go.transform.position=p;go.transform.rotation=Quaternion.LookRotation(dir);go.transform.localScale=size;go.GetComponent<Renderer>().sharedMaterial=mat;if(!collider)UnityEngine.Object.DestroyImmediate(go.GetComponent<Collider>());return go;}
    static Bounds LocalBounds(GameObject asset)
    {var renderers=asset.GetComponentsInChildren<Renderer>();var b=renderers[0].bounds;foreach(var r in renderers.Skip(1))b.Encapsulate(r.bounds);return b;}
    static GameObject Model(GameObject asset,string name,Vector3 position,Quaternion rotation)
    {
        var wrapper=new GameObject(name);wrapper.transform.SetParent(root,false);wrapper.transform.SetPositionAndRotation(position,rotation);
        // Imported FBX roots contain the authored axis conversion. Apply the city yaw to
        // a wrapper and preserve every native local transform beneath it.
        PrefabUtility.InstantiatePrefab(asset,wrapper.transform);return wrapper;
    }
    static GameObject Surface(string key,List<Vector3> v,List<int> t,Material mat,bool collider)
    {var go=new GameObject(key);go.transform.SetParent(root,false);var mesh=MeshAsset(key,v,t);go.AddComponent<MeshFilter>().sharedMesh=mesh;go.AddComponent<MeshRenderer>().sharedMaterial=mat;if(collider)go.AddComponent<MeshCollider>().sharedMesh=mesh;GameObjectUtility.SetStaticEditorFlags(go,StaticEditorFlags.BatchingStatic|StaticEditorFlags.OccluderStatic|StaticEditorFlags.OccludeeStatic);return go;}
    static Mesh MeshAsset(string key,List<Vector3> v,List<int> t)
    {var m=new Mesh{name=key,indexFormat=IndexFormat.UInt32};m.SetVertices(v);m.SetTriangles(t,0);m.RecalculateNormals();m.RecalculateBounds();string path=Folder+"/river_meshes/"+key+".asset";var previous=AssetDatabase.LoadAssetAtPath<Mesh>(path);if(previous==null)AssetDatabase.CreateAsset(m,path);else{EditorUtility.CopySerialized(m,previous);UnityEngine.Object.DestroyImmediate(m);m=previous;}generated.Add(path);return m;}
    static Material Mat(string key,Color c)
    {string path=Folder+"/river_materials/"+key+".mat";var m=AssetDatabase.LoadAssetAtPath<Material>(path);if(m==null){m=new Material(Shader.Find("Standard"));AssetDatabase.CreateAsset(m,path);}m.color=c;m.SetFloat("_Glossiness",.08f);m.enableInstancing=true;EditorUtility.SetDirty(m);generated.Add(path);return m;}
    static void Quad(Vector3 a,Vector3 b,Vector3 c,Vector3 d,List<Vector3> v,List<int> t){Tri(a,b,c,v,t);Tri(a,c,d,v,t);}
    static void Tri(Vector3 a,Vector3 b,Vector3 c,List<Vector3> v,List<int> t)
    {var cross=Vector3.Cross(b-a,c-a);float longest=Mathf.Max(Vector3.Distance(a,b),Mathf.Max(Vector3.Distance(b,c),Vector3.Distance(c,a)));if(longest<.0001f||cross.magnitude/longest<.0001f)return;if(cross.y<0){var temp=b;b=c;c=temp;}int k=v.Count;v.Add(a);v.Add(b);v.Add(c);t.Add(k);t.Add(k+1);t.Add(k+2);}
    static void Fan(List<Vector3> p,List<Vector3> v,List<int> t){for(int i=2;i<p.Count;i++)Tri(p[0],p[i-1],p[i],v,t);}
    static float Cross(Vector2 a,Vector2 b)=>a.x*b.y-a.y*b.x;
    static float SignedArea(List<Vector2> p){float a=0;var o=p[0];for(int i=1;i<p.Count-1;i++)a+=Cross(p[i]-o,p[i+1]-o);return a*.5f;}
    static List<Vector2> CCW(List<Vector2> p){if(SignedArea(p)<0)p.Reverse();return p;}
    static List<Vector2> Clip(List<Vector2> p,Vector2 a,Vector2 b,bool inside)
    {
        var r=new List<Vector2>();if(p.Count<3)return r;
        for(int i=0;i<p.Count;i++)
        {
            var s=p[i];var e=p[(i+1)%p.Count];float ds=Cross(b-a,s-a),de=Cross(b-a,e-a);bool si=inside?ds>=0:ds<=0,ei=inside?de>=0:de<=0;
            if(si)r.Add(s);if(si!=ei){float den=ds-de;if(Mathf.Abs(den)>1e-12f)r.Add(Vector2.LerpUnclamped(s,e,ds/den));}
        }
        for(int i=r.Count-1;i>=0&&r.Count>1;i--)if((r[i]-r[(i+1)%r.Count]).sqrMagnitude<1e-10f)r.RemoveAt(i);
        return r.Count>=3&&Mathf.Abs(SignedArea(r))>1e-7f?r:new List<Vector2>();
    }
    static List<List<Vector2>> Subtract(List<List<Vector2>> pieces,List<List<Vector2>> shapes)
    {
        foreach(var shape in shapes)
        {
            var next=new List<List<Vector2>>();float minx=shape.Min(v=>v.x),maxx=shape.Max(v=>v.x),miny=shape.Min(v=>v.y),maxy=shape.Max(v=>v.y);
            foreach(var p in pieces)
            {
                if(p.Max(v=>v.x)<minx||p.Min(v=>v.x)>maxx||p.Max(v=>v.y)<miny||p.Min(v=>v.y)>maxy){next.Add(p);continue;}
                var remainder=p;
                for(int i=0;i<shape.Count&&remainder.Count>=3;i++)
                {var outside=Clip(remainder,shape[i],shape[(i+1)%shape.Count],false);if(outside.Count>=3)next.Add(outside);remainder=Clip(remainder,shape[i],shape[(i+1)%shape.Count],true);}
            }
            pieces=next;
        }
        return pieces;
    }
    static float Distance(Vector2 p,Vector2 a,Vector2 b){var d=b-a;return Vector2.Distance(p,a+d*Mathf.Clamp01(Vector2.Dot(p-a,d)/Mathf.Max(.000001f,d.sqrMagnitude)));}
    static JArray Snapshot(Transform city)=>new JArray(new[]{"06_CampusBuildings_14","08_ExternalBuildings_55"}.SelectMany(n=>city.Find(n).Cast<Transform>()).Select(t=>new JObject{["name"]=t.name,["p"]=new JArray(t.position.x,t.position.y,t.position.z),["r"]=new JArray(t.eulerAngles.x,t.eulerAngles.y,t.eulerAngles.z),["s"]=new JArray(t.localScale.x,t.localScale.y,t.localScale.z)}));
    static string Hash(string path){using(var h=SHA256.Create())return BitConverter.ToString(h.ComputeHash(File.ReadAllBytes(path))).Replace("-","").ToLowerInvariant();}
}
