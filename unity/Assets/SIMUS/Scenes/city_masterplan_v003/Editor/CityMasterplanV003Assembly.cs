using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
public static class CityMasterplanV003Assembly {
 const string Folder="Assets/SIMUS/Scenes/city_masterplan_v003";
 [MenuItem("SIMUS/City Masterplan v003/Assemble new map scene")]
 public static void Assemble(){
  if(EditorApplication.isPlaying)throw new System.Exception("Stop Play Mode before assembling a scene.");
  if(!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())return;
  string path=Folder+"/models/SIMUS_City_Masterplan_v003.fbx";
  var asset=AssetDatabase.LoadAssetAtPath<GameObject>(path);
  if(!asset)throw new System.Exception("New map FBX is not imported: "+path);
  string output=Folder+"/CityMasterplan_v003.unity";
  if(File.Exists(output))throw new System.Exception("Scene already exists. Review it before replacing.");
  var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
  var map=(GameObject)PrefabUtility.InstantiatePrefab(asset);map.name="CITY_MASTERPLAN_V003";
  PrefabUtility.UnpackPrefabInstance(map,PrefabUnpackMode.Completely,InteractionMode.AutomatedAction);
  // Correct Blender-to-Unity handedness to match approved plan coordinates.
  var mapScale=map.transform.localScale;mapScale.x=-mapScale.x;map.transform.localScale=mapScale;
  foreach(var t in map.GetComponentsInChildren<Transform>(true)){
   if(t.name.StartsWith("V003_GROUP_"))t.name=t.name.Substring(11);
   if(t.name.StartsWith("FULL_HAP_")||t.name.StartsWith("FULL_SAF_")||t.name.StartsWith("FULL_CLN_")||t.name.StartsWith("FULL_POL_"))t.gameObject.SetActive(false);
  }
  foreach(var r in map.GetComponentsInChildren<MeshRenderer>(true).ToArray()){
   if(r.name.EndsWith("_LOD1")||r.name.EndsWith("_LOD2"))continue;
   var parent=r.transform.parent;if(!parent)continue;
   var l1=parent.Find(r.name+"_LOD1");var l2=parent.Find(r.name+"_LOD2");if(!l1||!l2)continue;
   l1.gameObject.SetActive(true);l2.gameObject.SetActive(true);l1.GetComponent<Renderer>().enabled=true;l2.GetComponent<Renderer>().enabled=true;
   var holder=new GameObject("LOD_"+r.name);holder.transform.SetParent(parent,false);r.transform.SetParent(holder.transform,true);l1.SetParent(holder.transform,true);l2.SetParent(holder.transform,true);
   var group=holder.AddComponent<LODGroup>();group.SetLODs(new[]{new LOD(.35f,new Renderer[]{r}),new LOD(.12f,new Renderer[]{l1.GetComponent<Renderer>()}),new LOD(.02f,new Renderer[]{l2.GetComponent<Renderer>()})});group.RecalculateBounds();
  }
  var sunObject=new GameObject("LGT_WarmDay");var sun=sunObject.AddComponent<Light>();sun.type=LightType.Directional;sun.color=new Color(1,.92f,.80f);sun.intensity=1.1f;sun.shadows=LightShadows.Soft;sunObject.transform.eulerAngles=new Vector3(48,-35,0);
  RenderSettings.ambientMode=UnityEngine.Rendering.AmbientMode.Trilight;RenderSettings.ambientSkyColor=new Color(.58f,.69f,.75f);RenderSettings.ambientEquatorColor=new Color(.53f,.57f,.57f);RenderSettings.ambientGroundColor=new Color(.28f,.30f,.28f);
  Vector3[] roomLights={new Vector3(-10.7f,2.6f,31),new Vector3(53.95f,2.6f,-9.25f),new Vector3(195.35f,3.824f,133),new Vector3(168,-.332f,98.75f)};
  foreach(var pos in roomLights){var go=new GameObject("InteriorWarmFill");go.transform.position=pos;var lamp=go.AddComponent<Light>();lamp.type=LightType.Point;lamp.range=6;lamp.intensity=1.2f;lamp.color=new Color(1,.84f,.62f);lamp.shadows=LightShadows.None;}
  string[] names={"Map_Overview","Campus","Commercial","Residential","Apartment","ParkRiver","Event_Test","Player_Test"};
  Vector3[] targets={new Vector3(10,0,45),new Vector3(45,0,165),new Vector3(50,0,15),new Vector3(35,0,-95),new Vector3(-160,0,-90),new Vector3(212,0,100),new Vector3(196,0,133),new Vector3(45,0,61)};float[] widths={640,240,150,180,160,110,50,18};
  for(int i=0;i<names.Length;i++){var obj=new GameObject("CAM_"+names[i]);var cam=obj.AddComponent<Camera>();obj.transform.position=targets[i]+new Vector3(widths[i]*.7f,widths[i]*.7f,-widths[i]*.9f);obj.transform.LookAt(targets[i]);cam.orthographic=true;cam.orthographicSize=widths[i]/2;cam.farClipPlane=2000;cam.enabled=i==0;if(i==0)obj.tag="MainCamera";}
  EditorSceneManager.SaveScene(scene,output);Debug.Log("V003 assembled; runtime, collision and performance checks explicitly deferred. This does not certify a playable final map.");
 }
}
