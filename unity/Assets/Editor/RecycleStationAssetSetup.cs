#if UNITY_EDITOR
using System;using System.IO;using System.Linq;using System.Collections.Generic;using UnityEngine;using UnityEditor;using Simus.City;
// One-shot setup restricted to two station FBXs; no global AssetPostprocessor or map edits.
public static class RecycleStationAssetSetup
{
 public const string Folder="Assets/SIMUS/Art/props/recycle_station_v001";
 public const string Prefabs="Assets/SIMUS/Prefabs/props/recycle_station_v001";
 public const string BinFolder="Assets/SIMUS/Art/props/city_state_v001/models/";
 static Material[] ReusedMaterials(){return new[]{"NORMAL","HALF","OVERFLOW"}.SelectMany(n=>AssetDatabase.LoadAssetAtPath<GameObject>(BinFolder+"CLN_BIN_"+n+"_01.fbx").GetComponentsInChildren<Renderer>(true)).SelectMany(r=>r.sharedMaterials).Where(m=>m!=null).GroupBy(m=>m.name).Select(g=>g.First()).ToArray();}
 public static float WhiteMarkerZ(GameObject obj)
 {
  float sum=0;int count=0;foreach(var mf in obj.GetComponentsInChildren<MeshFilter>(true)){var mats=mf.GetComponent<Renderer>().sharedMaterials;for(int si=0;si<mats.Length;si++){if(!mats[si].name.ToLower().Contains("white"))continue;foreach(int vi in mf.sharedMesh.GetTriangles(si)){sum+=mf.transform.TransformPoint(mf.sharedMesh.vertices[vi]).z;count++;}}}if(count==0)throw new Exception("Bin direction marker missing");return sum/count;
 }
 public static void Build()
 {
  Directory.CreateDirectory(Folder+"/materials");Directory.CreateDirectory(Prefabs);AssetDatabase.Refresh();
  var names=new[]{"Frame","Panel","Roof","Sign","Perforated","Hardware","Light"};
  var colors=new[]{new Color(.075f,.108f,.116f),new Color(.24f,.29f,.295f),new Color(.20f,.245f,.25f),Color.white,Color.white,new Color(.28f,.32f,.31f),new Color(.96f,.88f,.68f)};
  for(int i=0;i<names.Length;i++)
  {
   string path=Folder+"/materials/RST_"+names[i]+".mat";var m=AssetDatabase.LoadAssetAtPath<Material>(path);if(m==null){m=new Material(Shader.Find("Standard"));AssetDatabase.CreateAsset(m,path);}
   m.color=colors[i];m.SetFloat("_Glossiness",.30f);m.SetFloat("_Metallic",i==3?0:.3f);
   string texture=i==3?"RST_Sign_Atlas.png":i==4?"RST_Perforation.png":i==6?null:"RST_Metal_Finish.png";
   if(texture!=null)m.mainTexture=AssetDatabase.LoadAssetAtPath<Texture2D>(Folder+"/textures/"+texture);
   if(i==4){m.SetFloat("_Mode",1);m.SetFloat("_Cutoff",.5f);m.SetOverrideTag("RenderType","TransparentCutout");m.EnableKeyword("_ALPHATEST_ON");m.renderQueue=2450;}
   if(i==6){m.EnableKeyword("_EMISSION");m.SetColor("_EmissionColor",colors[i]*2);}
   EditorUtility.SetDirty(m);
  }
  AssetDatabase.SaveAssets();
  foreach(string variant in new[]{"Structure","Complete"})
  {
   string model=Folder+"/models/SIMUS_Recycle_Station_"+variant+".fbx";var importer=(ModelImporter)AssetImporter.GetAtPath(model);
   importer.globalScale=1;importer.importAnimation=false;importer.importCameras=false;importer.importLights=false;importer.materialImportMode=ModelImporterMaterialImportMode.ImportStandard;
   foreach(string name in names)importer.AddRemap(new AssetImporter.SourceAssetIdentifier(typeof(Material),"RST_"+name),AssetDatabase.LoadAssetAtPath<Material>(Folder+"/materials/RST_"+name+".mat"));
   foreach(var mat in ReusedMaterials())importer.AddRemap(new AssetImporter.SourceAssetIdentifier(typeof(Material),mat.name),mat);
   importer.SaveAndReimport();
   var modelInstance=(GameObject)PrefabUtility.InstantiatePrefab(AssetDatabase.LoadAssetAtPath<GameObject>(model));var root=new GameObject("SIMUS_Recycle_Station_"+variant);modelInstance.transform.SetParent(root.transform,true);
   var all=root.GetComponentsInChildren<Transform>(true);var colliderParent=all.First(t=>t.name=="RECYCLE_STATION_COLLIDER");
   Action<string,Vector3,Vector3> box=(n,pos,size)=>{var o=new GameObject(n);o.transform.SetParent(root.transform,false);o.transform.localPosition=pos;var b=o.AddComponent<BoxCollider>();b.size=size;o.transform.SetParent(colliderParent,true);};
   foreach(float x in new[]{-2.18f,2.18f})foreach(float z in new[]{1.12f,-.99f})box("Station_Post_Collider",new Vector3(x,1.2f,z),new Vector3(.12f,2.4f,.12f));
   foreach(float x in new[]{-2.18f,2.18f})box("Station_Side_Collider",new Vector3(x,1.15f,.065f),new Vector3(.06f,2.06f,2.07f));
   box("Station_Back_Collider",new Vector3(0,1.15f,-.99f),new Vector3(4.26f,2.06f,.06f));
   box("Station_Roof_Collider",new Vector3(0,2.465f,.12f),new Vector3(4.85f,.15f,2.48f));
   var rig=root.AddComponent<RecycleStationRig>();rig.slots=Enumerable.Range(1,5).Select(i=>all.First(t=>t.name=="RECYCLE_STATION_BIN_SLOT_"+i.ToString("00"))).ToArray();
   rig.originalBins=rig.slots.Select(t=>t.Cast<Transform>().FirstOrDefault(c=>c.name.StartsWith("RST_Bin_Normal"))?.gameObject).ToArray();
   rig.stateModels=new[]{"NORMAL","HALF","OVERFLOW"}.Select(n=>AssetDatabase.LoadAssetAtPath<GameObject>(BinFolder+"CLN_BIN_"+n+"_01.fbx")).ToArray();
   rig.stateYawDegrees=WhiteMarkerZ(rig.stateModels[0])<0?180f:0f;Debug.Log("BIN_STATE_YAW "+rig.stateYawDegrees);
   rig.lightPanels=root.GetComponentsInChildren<Renderer>().Where(r=>r.sharedMaterials.Any(m=>m.name=="RST_Light")).ToArray();
   var lights=new List<Light>();foreach(var panel in rig.lightPanels){var o=new GameObject("Station_Downlight");o.transform.SetParent(root.transform,false);o.transform.position=panel.bounds.center-Vector3.up*.05f;var l=o.AddComponent<Light>();l.type=LightType.Point;l.color=new Color(1,.88f,.67f);l.intensity=.6f;l.range=2.5f;l.shadows=LightShadows.None;l.enabled=true;o.transform.SetParent(panel.transform,true);lights.Add(l);}rig.lights=lights.ToArray();
   rig.SetLights(true);
   PrefabUtility.SaveAsPrefabAsset(root,Prefabs+"/"+root.name+".prefab");UnityEngine.Object.DestroyImmediate(root);
  }
  AssetDatabase.SaveAssets();Verify();
 }
 [MenuItem("SIMUS/Assets/Verify Recycle Station")]
 public static void Verify()
 {
  foreach(string variant in new[]{"Structure","Complete"})
  {
   var root=AssetDatabase.LoadAssetAtPath<GameObject>(Prefabs+"/SIMUS_Recycle_Station_"+variant+".prefab");if(root==null)throw new Exception("Station prefab missing");
   var rig=root.GetComponent<RecycleStationRig>();if(rig==null||rig.slots.Length!=5||rig.stateModels.Any(m=>m==null)||rig.lightPanels.Length!=2)throw new Exception("Station controls incomplete");
   if(root.GetComponentsInChildren<BoxCollider>(true).Length!=8||root.GetComponentsInChildren<MeshCollider>(true).Length!=0)throw new Exception("Collider count invalid");
   if(root.GetComponentsInChildren<Renderer>(true).Any(r=>r.sharedMaterials.Any(m=>m==null)))throw new Exception("Missing station material");
   if(rig.originalBins.Count(b=>b!=null)!=(variant=="Complete"?5:0))throw new Exception("Wrong bin count");
   Debug.Log("RECYCLE_STATION_VERIFIED "+variant);
  }
 }
}
#endif
