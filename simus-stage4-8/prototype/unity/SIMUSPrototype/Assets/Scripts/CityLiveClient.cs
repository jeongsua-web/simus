using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Networking;
namespace Simus {
 [Serializable] public class CityRound { public string id,started,status,ends,cutoff,ended; public long version; public bool accepting; public float happiness,safety,cleanliness,pollution; }
 [Serializable] public class CityEnvelope { public CityRound round; public string server_time; }
 public class CityLiveClient : MonoBehaviour {
  public string apiBase="http://127.0.0.1:8780";
  public bool explicitMockMode=true;
  [Range(.25f,1f)] public float pollSeconds=.5f;
  public CityRound Current {get;private set;}
  public string Connection {get;private set;}="Connecting";
  public string ServerTime {get;private set;}="";
  public bool Fresh => Time.realtimeSinceStartup-lastSuccess<3f;
  float lastSuccess=-999; DateTimeOffset lastStarted=DateTimeOffset.MinValue,lastServer=DateTimeOffset.MinValue;
  readonly HashSet<string> retired=new HashSet<string>();
  IEnumerator Start(){while(true){yield return Poll();yield return new WaitForSecondsRealtime(pollSeconds);}}
  IEnumerator Poll(){using(var req=UnityWebRequest.Get(apiBase.TrimEnd('/')+"/api/state")){req.timeout=2; yield return req.SendWebRequest(); if(req.result!=UnityWebRequest.Result.Success){Connection="OFFLINE: "+req.error+" (last state retained)";yield break;} try {if(AcceptJson(req.downloadHandler.text)){lastSuccess=Time.realtimeSinceStartup;Connection="Connected";}}catch(Exception e){Connection="Invalid server response: "+e.Message;}}}
  public bool AcceptJson(string json){var env=JsonUtility.FromJson<CityEnvelope>(json); if(env==null||env.round==null||String.IsNullOrEmpty(env.round.id)||!DateTimeOffset.TryParse(env.round.started,out var started)||!DateTimeOffset.TryParse(env.server_time,out var server)) throw new FormatException("Missing round/time"); var r=env.round; if(r.version<0||!Valid(r.happiness)||!Valid(r.safety)||!Valid(r.cleanliness)||!Valid(r.pollution))throw new FormatException("Invalid city values"); if(server<lastServer||retired.Contains(r.id)||started<lastStarted)return false; if(Current!=null&&Current.id==r.id){if(r.version<Current.version)return false; if(Current.status=="FINALIZED"){lastSuccess=Time.realtimeSinceStartup;return true;}} if(Current!=null&&Current.id!=r.id)retired.Add(Current.id);Current=r;lastStarted=started;lastServer=server;ServerTime=env.server_time;lastSuccess=Time.realtimeSinceStartup; return true;}
  static bool Valid(float v)=>!float.IsNaN(v)&&!float.IsInfinity(v)&&v>=0&&v<=100;
  void OnGUI(){GUI.Box(new Rect(12,80,480,200),""); GUILayout.BeginArea(new Rect(24,88,452,184));GUILayout.Label(explicitMockMode?"TEST / MOCK DATA — preview NPCs":"LIVE API — preview NPCs (not participants)");GUILayout.Label(Connection+(Fresh?"":" / STALE"));if(Current!=null){GUILayout.Label("Round "+Current.id+" / version "+Current.version);GUILayout.Label("Happiness "+Current.happiness.ToString("F1")+"  Safety "+Current.safety.ToString("F1"));GUILayout.Label("Cleanliness "+Current.cleanliness.ToString("F1")+"  Pollution "+Current.pollution.ToString("F1"));GUILayout.Label(Current.status+" / "+(Current.accepting?"Accepting":"Input closed"));GUILayout.Label("Server "+ServerTime);} GUILayout.EndArea();}
 }
}
