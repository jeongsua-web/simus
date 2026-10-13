#if UNITY_EDITOR
using System;using System.IO;using System.Linq;
using UnityEngine;using UnityEditor;
// Scope is restricted to the standalone public toilet. Never edits maps or scenes.
public sealed class PublicToiletAssetSetup:AssetPostprocessor
{
 public const string Folder="Assets/SIMUS/Art/props/public_toilet_v001";
 public const string Model=Folder+"/models/SIMUS_Public_Toilet.fbx";
 public const string Prefab="Assets/SIMUS/Prefabs/props/public_toilet_v001/SIMUS_Public_Toilet.prefab";
 void OnPreprocessModel(){if(assetPath!=Model)return;var m=(ModelImporter)assetImporter;m.importAnimation=false;m.importLights=false;m.importCameras=false;m.globalScale=1;m.materialImportMode=ModelImporterMaterialImportMode.ImportStandard;}
 Material OnAssignMaterialModel(Material m,Renderer r){return assetPath==Model?AssetDatabase.LoadAssetAtPath<Material>(Folder+"/materials/"+m.name+".mat"):null;}
 void OnPostprocessModel(GameObject root)
 {
  if(assetPath!=Model)return;
  foreach(var f in root.GetComponentsInChildren<MeshFilter>(true))
  {
   if(f.name.StartsWith("COL_")||new[]{"PRT_DOOR_MALE","PRT_DOOR_FEMALE","PRT_DOOR_ACCESSIBLE"}.Contains(f.name))
   {var b=f.gameObject.AddComponent<BoxCollider>();b.center=f.sharedMesh.bounds.center;b.size=f.sharedMesh.bounds.size;}
   if(f.name.StartsWith("COL_")) {var r=f.GetComponent<Renderer>();if(r!=null)UnityEngine.Object.DestroyImmediate(r);UnityEngine.Object.DestroyImmediate(f);}
  }
 }
 [MenuItem("SIMUS/Assets/Verify Public Toilet")]
 public static void Verify()
 {
  var model=AssetDatabase.LoadAssetAtPath<GameObject>(Model);if(model==null)throw new Exception("Public toilet FBX missing");
  if(model.GetComponentsInChildren<BoxCollider>(true).Length!=19)throw new Exception("Expected 16 structure boxes and 3 door boxes");
  if(model.GetComponentsInChildren<MeshCollider>(true).Length!=0)throw new Exception("Complex mesh collision found");
  foreach(var r in model.GetComponentsInChildren<Renderer>(true))if(r.sharedMaterials.Any(m=>m==null))throw new Exception("Missing material "+r.name);
  Debug.Log("PUBLIC_TOILET_VERIFIED: 19 BoxColliders; no MeshColliders; all material slots assigned; standalone only.");
 }
 public static void Build()
 {
  Directory.CreateDirectory(Folder+"/materials");AssetDatabase.Refresh();
  var names=new[]{"Wall","Stone","Roof","Door","Glass","Metal","Sign","Interior","Emission"};
  var colors=new[]{new Color(.69f,.67f,.59f),new Color(.25f,.28f,.27f),new Color(.19f,.24f,.24f),new Color(.17f,.19f,.19f),new Color(.18f,.32f,.35f),new Color(.33f,.37f,.36f),Color.white,new Color(.12f,.14f,.14f),new Color(.95f,.83f,.59f)};
  for(int i=0;i<names.Length;i++)
  {
   string path=Folder+"/materials/PRT_"+names[i]+".mat";var m=AssetDatabase.LoadAssetAtPath<Material>(path);
   if(m==null){m=new Material(Shader.Find("Standard"));AssetDatabase.CreateAsset(m,path);}
   m.color=colors[i];m.SetFloat("_Glossiness",i==4?.76f:i==5?.64f:.35f);m.SetFloat("_Metallic",i==4?.2f:i==5?.6f:0);
   if(i==6)m.mainTexture=AssetDatabase.LoadAssetAtPath<Texture2D>(Folder+"/textures/PRT_Sign_Atlas.png");
   if(i==8){m.EnableKeyword("_EMISSION");m.SetColor("_EmissionColor",colors[i]*2);m.globalIlluminationFlags=MaterialGlobalIlluminationFlags.RealtimeEmissive;}
   EditorUtility.SetDirty(m);
  }
  AssetDatabase.SaveAssets();AssetDatabase.ImportAsset(Model,ImportAssetOptions.ForceUpdate);
  Verify();Directory.CreateDirectory(Path.GetDirectoryName(Prefab));AssetDatabase.Refresh();
  var instance=(GameObject)PrefabUtility.InstantiatePrefab(AssetDatabase.LoadAssetAtPath<GameObject>(Model));
  PrefabUtility.SaveAsPrefabAsset(instance,Prefab);UnityEngine.Object.DestroyImmediate(instance);AssetDatabase.SaveAssets();
 }
}
#endif
