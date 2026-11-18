using System;using UnityEngine;using Simus.City;
namespace Simus.QualityPass {
 [DisallowMultipleComponent] public sealed class QualityCityStateVisuals:MonoBehaviour {
 [Serializable] public class Slot {public string slot_id,stat_type,zone,activation_level,host,notes;public GameObject[] target_objects;public bool default_active,invert_value,high;public int order;}
 public Slot[] slots=Array.Empty<Slot>();public CityStatePoller source;public bool followLive=true;public bool previewEnabled;
 [Range(0,100)]public float happiness=50,safety=50,cleanliness=50,pollution=50;
 public bool hasLiveData; public string bindingStatus="No live data; default hidden";
 bool developerOverride, savedPreview;
 float savedHappiness,savedSafety,savedCleanliness,savedPollution;
 System.Collections.Generic.Dictionary<GameObject,bool> savedActive;
 public void BeginDeveloperPreview(float h,float s,float c,float p){
  if(!developerOverride){
   savedPreview=previewEnabled;savedHappiness=happiness;savedSafety=safety;savedCleanliness=cleanliness;savedPollution=pollution;
   savedActive=new System.Collections.Generic.Dictionary<GameObject,bool>();
   foreach(var slot in slots)foreach(var go in slot.target_objects)if(go)savedActive[go]=go.activeSelf;
   developerOverride=true;
  }
  SetPreview(h,s,c,p);
 }
 public void EndDeveloperPreview(){
  if(!developerOverride)return;
  developerOverride=false;previewEnabled=savedPreview;happiness=savedHappiness;safety=savedSafety;cleanliness=savedCleanliness;pollution=savedPollution;
  foreach(var pair in savedActive)if(pair.Key)pair.Key.SetActive(pair.Value);
  savedActive=null;lastHash=int.MinValue;
 }
 int lastHash=int.MinValue;
 public static int Stage(float v)=>Mathf.Clamp(Mathf.CeilToInt(Mathf.Clamp(v,0,100)/20f),1,5);
 void OnEnable(){ResetHidden();}
 void Update(){
  hasLiveData=false;
  if(followLive&&!previewEnabled){if(!source)source=FindFirstObjectByType<CityStatePoller>();var s=source?source.Store.Current:null;
   if(s!=null){happiness=(float)s.Happiness;safety=(float)s.Safety;cleanliness=(float)s.Cleanliness;if(s.OverallPollution.HasValue)pollution=(float)s.OverallPollution.Value;hasLiveData=true;bindingStatus=s.OverallPollution.HasValue?"Existing CityStatePoller aggregate adapter":"Live stats; aggregate pollution unavailable";}}
  int hash=(previewEnabled||hasLiveData)?Mathf.RoundToInt(happiness)*1000000+Mathf.RoundToInt(safety)*10000+Mathf.RoundToInt(cleanliness)*100+Mathf.RoundToInt(pollution):-1;
  if(hash!=lastHash){Apply();lastHash=hash;}
 }
 [ContextMenu("Apply preview values")]public void ApplyPreview(){previewEnabled=true;Apply();}
 public void SetPreview(float h,float s,float c,float p){happiness=Mathf.Clamp(h,0,100);safety=Mathf.Clamp(s,0,100);cleanliness=Mathf.Clamp(c,0,100);pollution=Mathf.Clamp(p,0,100);ApplyPreview();}
 public void Apply(){foreach(var b in slots){float v=b.stat_type=="HAP"?happiness:b.stat_type=="SAF"?safety:b.stat_type=="CLN"?cleanliness:pollution;
  bool enabled=previewEnabled||hasLiveData; if(!previewEnabled&&b.stat_type=="POL"&&source&&source.Store.Current!=null&&!source.Store.Current.OverallPollution.HasValue)enabled=false;
  // Preserve v003 planned >65/<35 thresholds. Five stages control gradual count.
  bool threshold=b.high?v>65:v<35;int stage=Stage(v);bool quantity=b.order==0||(b.high?stage==5:stage==1);bool active=enabled&&threshold&&quantity;
  foreach(var go in b.target_objects)if(go)go.SetActive(active);
 }}
 [ContextMenu("Restore default hidden state")]public void ResetHidden(){previewEnabled=false;hasLiveData=false;lastHash=int.MinValue;foreach(var b in slots)foreach(var go in b.target_objects)if(go)go.SetActive(b.default_active);}
 #if UNITY_EDITOR || DEVELOPMENT_BUILD
 bool showPreview;
 void OnGUI(){if(GUI.Button(new Rect(12,12,180,28),"City stat visual preview"))showPreview=!showPreview;if(!showPreview)return;
 GUILayout.BeginArea(new Rect(12,48,300,300),GUI.skin.box);GUILayout.Label(bindingStatus);previewEnabled=GUILayout.Toggle(previewEnabled,"Independent preview (no server changes)");
 happiness=Slider("Happiness",happiness);safety=Slider("Safety",safety);cleanliness=Slider("Cleanliness",cleanliness);pollution=Slider("Pollution (higher is worse)",pollution);
 if(GUILayout.Button("Mixed: 90 / 30 / 80 / 70"))SetPreview(90,30,80,70);if(GUILayout.Button("Default hidden"))ResetHidden();GUILayout.EndArea();}
 float Slider(string n,float v){GUILayout.Label(n+" "+Mathf.RoundToInt(v));return GUILayout.HorizontalSlider(v,0,100);}
 #endif
 }
}
