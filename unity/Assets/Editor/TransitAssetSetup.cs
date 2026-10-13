#if UNITY_EDITOR
using System;using System.IO;using System.Linq;using UnityEngine;using UnityEditor;using Simus.City;
public sealed class TransitAssetSetup:AssetPostprocessor
{
 public const string Base="Assets/SIMUS/Art/props/";
 static bool Target(string path){return path==Base+"city_bus_v001/models/SIMUS_City_Bus.fbx"||path==Base+"taxi_v001/models/SIMUS_Taxi.fbx";}
 void OnPreprocessModel(){if(!Target(assetPath))return;var m=(ModelImporter)assetImporter;m.globalScale=1;m.importAnimation=false;m.importLights=false;m.importCameras=false;m.materialImportMode=ModelImporterMaterialImportMode.ImportStandard;}
 Material OnAssignMaterialModel(Material material,Renderer renderer){if(!Target(assetPath))return null;string dir=assetPath.Contains("city_bus_v001")?"city_bus_v001":"taxi_v001";return AssetDatabase.LoadAssetAtPath<Material>(Base+dir+"/materials/"+material.name+".mat");}
 void OnPostprocessModel(GameObject root)
 {
  if(!Target(assetPath))return;
  foreach(var f in root.GetComponentsInChildren<MeshFilter>(true).Where(f=>f.name.Contains("_COL_")).ToArray())
  {var b=f.gameObject.AddComponent<BoxCollider>();b.center=f.sharedMesh.bounds.center;b.size=f.sharedMesh.bounds.size;UnityEngine.Object.DestroyImmediate(f.GetComponent<MeshRenderer>());UnityEngine.Object.DestroyImmediate(f);}
  var rs=root.GetComponentsInChildren<Renderer>(true);foreach(var r in rs)r.gameObject.SetActive(true);
  var lod=root.AddComponent<LODGroup>();lod.SetLODs(new[]{new LOD(.22f,rs.Where(r=>r.name.Contains("_LOD0")).ToArray()),new LOD(.02f,rs.Where(r=>r.name.Contains("_LOD1")).ToArray())});lod.RecalculateBounds();
 }
 static Renderer[] Renderers(Transform[] all,string name){var t=all.FirstOrDefault(t=>t.name==name);return t==null?new Renderer[0]:t.GetComponentsInChildren<Renderer>(true);}
 public static void Build()
 {
  foreach(string key in new[]{"city_bus_v001","taxi_v001"})
  {
   bool bus=key=="city_bus_v001";string prefix=bus?"BUS":"TAXI",filename=bus?"SIMUS_City_Bus":"SIMUS_Taxi";string folder=Base+key;
   Directory.CreateDirectory(folder+"/materials");AssetDatabase.Refresh();
   string[] names=bus?new[]{"Paint","Accent","Trim","Rubber","Metal","Glass","Interior","Headlight","Taillight","Indicator","Display"}:new[]{"Paint","Accent","Trim","Rubber","Metal","Glass","Interior","Headlight","Taillight","Indicator","Display","RoofSign","StatusSign"};
   Color[] colors={bus?new Color(.77f,.79f,.75f):new Color(.77f,.75f,.67f),new Color(.035f,.30f,.32f),new Color(.035f,.052f,.058f),new Color(.018f,.024f,.028f),new Color(.39f,.44f,.46f),new Color(.065f,.15f,.19f,.43f),new Color(.08f,.11f,.13f),new Color(.92f,.9f,.69f),new Color(.57f,.045f,.026f),new Color(.88f,.36f,.04f),Color.white,Color.white,Color.white};
   for(int i=0;i<names.Length;i++)
   {
    string path=folder+"/materials/"+prefix+"_"+names[i]+".mat";var m=AssetDatabase.LoadAssetAtPath<Material>(path);if(m==null){m=new Material(Shader.Find("Standard"));AssetDatabase.CreateAsset(m,path);}m.color=colors[i];m.SetFloat("_Glossiness",i==3?.12f:i==5?.81f:i==0?.68f:.45f);m.SetFloat("_Metallic",i==4?.7f:i==0?.25f:.05f);
    if(i==5){m.SetFloat("_Mode",3);m.SetInt("_SrcBlend",(int)UnityEngine.Rendering.BlendMode.SrcAlpha);m.SetInt("_DstBlend",(int)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);m.SetInt("_ZWrite",0);m.EnableKeyword("_ALPHABLEND_ON");m.renderQueue=3000;}
    if(i>=7){m.EnableKeyword("_EMISSION");m.SetColor("_EmissionColor",colors[i]*.4f);}
    if(i>=10){m.mainTexture=AssetDatabase.LoadAssetAtPath<Texture2D>(folder+"/textures/"+(bus?"BUS_Route_Atlas.png":"TAXI_Service_Atlas.png"));m.SetTexture("_EmissionMap",m.mainTexture);}EditorUtility.SetDirty(m);
   }
   AssetDatabase.SaveAssets();string pathModel=folder+"/models/"+filename+".fbx";AssetDatabase.ImportAsset(pathModel,ImportAssetOptions.ForceUpdate);
   var obj=(GameObject)PrefabUtility.InstantiatePrefab(AssetDatabase.LoadAssetAtPath<GameObject>(pathModel));obj.name=filename;obj.tag="Untagged";obj.layer=0;
   var rig=obj.AddComponent<TransitVehicleRig>();var all=obj.GetComponentsInChildren<Transform>(true);
   rig.wheels=new[]{"FL","FR","RL","RR"}.Select(s=>all.First(t=>t.name==prefix+"_WHEEL_"+s)).ToArray();
   rig.doors=bus?new[]{"FRONT","MIDDLE"}.Select(s=>all.First(t=>t.name=="BUS_DOOR_"+s)).ToArray():new Transform[0];
   rig.doorOpenOffsets=rig.doors.Select((t,i)=>t.parent.InverseTransformVector(obj.transform.TransformVector(new Vector3(Mathf.Sign(obj.transform.InverseTransformPoint(t.position).x)*.17f,0,i==0?-1.05f:-1.48f)))).ToArray();
   rig.headlights=Renderers(all,prefix+"_LIGHTS_FRONT");rig.taillights=Renderers(all,prefix+"_LIGHTS_REAR");rig.indicators=Renderers(all,prefix+"_INDICATORS");rig.routeDisplays=Renderers(all,prefix+"_ROUTE_DISPLAY");rig.roofSigns=Renderers(all,prefix+"_ROOF_SIGN").Where(r=>r.sharedMaterials.Any(m=>m.name=="TAXI_RoofSign")).ToArray();rig.statusSigns=Renderers(all,prefix+"_STATUS_SIGN").Where(r=>r.sharedMaterials.Any(m=>m.name=="TAXI_StatusSign")).ToArray();
   if(!bus){rig.vacantStatusAtlas=AssetDatabase.LoadAssetAtPath<Texture2D>(folder+"/textures/TAXI_Service_Atlas.png");rig.occupiedStatusAtlas=AssetDatabase.LoadAssetAtPath<Texture2D>(folder+"/textures/TAXI_Service_Atlas_Occupied.png");}
   string prefabFolder="Assets/SIMUS/Prefabs/props/"+key;Directory.CreateDirectory(prefabFolder);AssetDatabase.Refresh();PrefabUtility.SaveAsPrefabAsset(obj,prefabFolder+"/"+filename+".prefab");UnityEngine.Object.DestroyImmediate(obj);
  }
  AssetDatabase.SaveAssets();Verify();
 }
 [MenuItem("SIMUS/Assets/Verify Bus and Taxi")]
 public static void Verify()
 {
  foreach(string key in new[]{"city_bus_v001","taxi_v001"})
  {
   bool bus=key=="city_bus_v001";string name=bus?"SIMUS_City_Bus":"SIMUS_Taxi";
   var obj=AssetDatabase.LoadAssetAtPath<GameObject>("Assets/SIMUS/Prefabs/props/"+key+"/"+name+".prefab");if(obj==null)throw new Exception("Missing prefab "+key);
   var rig=obj.GetComponent<TransitVehicleRig>();if(rig==null||rig.wheels.Length!=4||rig.doors.Length!=(bus?2:0))throw new Exception("Control targets incomplete");
   var lod=obj.GetComponent<LODGroup>();if(lod==null||lod.lodCount!=2||lod.GetLODs().Any(l=>l.renderers.Length==0))throw new Exception("LOD targets incomplete");
   if(obj.GetComponentsInChildren<BoxCollider>(true).Length!=(bus?3:2)||obj.GetComponentsInChildren<MeshCollider>(true).Length!=0)throw new Exception("Collision invalid");
   if(obj.GetComponentsInChildren<Renderer>(true).Any(r=>r.sharedMaterials.Any(m=>m==null)))throw new Exception("Missing materials");
   Debug.Log("TRANSIT_ASSET_VERIFIED: "+key+"; LOD0/1, 4 wheels, controls, box collision, materials.");
  }
 }
}
#endif
