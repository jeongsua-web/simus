using System;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using Newtonsoft.Json.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

/// <summary>Independent saved-scene physical surface sampling, never NPC navigation or Play Mode.</summary>
public static class CityRebuildV002SurfaceAudit
{
    [MenuItem("SIMUS/City Rebuild v002/Audit Saved Pedestrian Surfaces")]
    public static void Run()
    {
        EditorSceneManager.OpenScene(CityRebuildV002Setup.ScenePath);
        var layout=JObject.Parse(File.ReadAllText("../docs/planning/city_rebuild_v002/layout.json"));
        Physics.SyncTransforms();
        int samples=0,support=0,blocking=0;var missing=new JArray();var buildings=new JArray();var edgeResults=new JArray();
        foreach(var edge in layout["pedestrian_edges"])
        {
            string id=(string)edge["id"];int count=0,failed=0;var points=edge["points"].Select(p=>new Vector2((float)p[0],(float)p[1])).ToArray();
            for(int part=0;part<Mathf.Max(1,points.Length-1);part++)
            {
                var a=points[Mathf.Min(part,points.Length-1)];var b=points[Mathf.Min(part+1,points.Length-1)];
                int steps=Mathf.Max(1,Mathf.CeilToInt(Vector2.Distance(a,b)/1f));
                for(int step=0;step<=steps;step++)
                {
                    count++;samples++;var p=Vector2.Lerp(a,b,step/(float)steps);var origin=new Vector3(p.x,2,p.y);
                    var hits=Physics.RaycastAll(origin,Vector3.down,2.5f,Physics.DefaultRaycastLayers,QueryTriggerInteraction.Ignore);
                    var physical=hits.Where(h=>h.normal.y>.5f&&IsGeneratedSurface(h.transform)&&h.point.y>=.015f&&h.point.y<=.16f).ToArray();
                    if(physical.Length>0)support++;else {failed++;missing.Add(new JObject{["edge"]=id,["point"]=new JArray(p.x,p.y),["hits"]=new JArray(hits.Select(h=>(JToken)new JObject{["object"]=h.transform.name,["y"]=h.point.y}))});}
                    var blocked=hits.Where(h=>IsBuilding(h.transform)).ToArray();
                    if(blocked.Length>0){blocking++;buildings.Add(new JObject{["edge"]=id,["point"]=new JArray(p.x,p.y),["objects"]=new JArray(blocked.Select(h=>h.transform.name))});}
                }
            }
            edgeResults.Add(new JObject{["id"]=id,["samples"]=count,["missing_surface"]=failed});
        }
        var result=new JObject{["scene"]=CityRebuildV002Setup.ScenePath,["scene_sha256"]=Hash(File.ReadAllBytes(CityRebuildV002Setup.ScenePath)),["layout_sha256"]=Hash(File.ReadAllBytes("../docs/planning/city_rebuild_v002/layout.json")),["method"]="409 saved graph edge centre-lines, <=1m sample spacing; real Unity Physics.RaycastAll on saved collider geometry, existing MoveTowards/NavMesh not invoked",["samples"]=samples,["supported_samples"]=support,["missing_surface_samples"]=missing.Count,["building_hit_samples"]=blocking,["result"]=(missing.Count==0&&blocking==0)?"PASS":"FAIL",["missing_surface"]=missing,["building_hits"]=buildings,["edges"]=edgeResults,["limits"]="No finite NPC radius, step/kerb accessibility, actual door-to-anchor gaps, graph controller traversal, NavMesh, animation, Play Mode or dynamic camera test"};
        File.WriteAllText("../docs/verification/city-rebuild-v002-surface-audit.json",result.ToString());
        Debug.Log("CITY_REBUILD_V002_SURFACE_AUDIT "+(string)result["result"]+" samples="+samples+" missing="+missing.Count+" buildingHits="+blocking);
        if((string)result["result"]!="PASS")throw new InvalidOperationException("Pedestrian collider support audit failed; inspect detailed JSON.");
    }
    static bool IsGeneratedSurface(Transform transform)
    {
        for(var t=transform;t!=null;t=t.parent)if(t.name=="02_Roads"||t.name=="03_TurningAndIntersections"||t.name=="04_PedestrianSurfaces")return true;
        return false;
    }
    static bool IsBuilding(Transform transform)
    {
        for(var t=transform;t!=null;t=t.parent)if(t.name=="06_CampusBuildings_14"||t.name=="08_ExternalBuildings_55")return true;
        return false;
    }
    static string Hash(byte[] bytes){using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-","").ToLowerInvariant();}
}
