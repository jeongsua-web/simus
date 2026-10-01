using UnityEngine;
namespace Simus.City {
 public class NeighborhoodLife : MonoBehaviour {
  public CityStatePoller client;
  public NpcCrowdPoller npcClient;
  public Vector3[] path;
  public float speed=2f;
  [Tooltip("Prototype temporary visual thresholds")] public float pollutionThreshold=25,lowCleanlinessThreshold=35,lowSafetyThreshold=35,highHappinessThreshold=65;
  public Transform[] previewNpcs;
  public Renderer moodBeacon,cleanlinessBeacon,safetyBeacon;
  readonly System.Collections.Generic.Dictionary<string, Transform> liveNpcs = new System.Collections.Generic.Dictionary<string, Transform>();
  float elapsed; string round="";
  void Awake(){if(npcClient==null){npcClient=GetComponent<NpcCrowdPoller>();if(npcClient==null)npcClient=gameObject.AddComponent<NpcCrowdPoller>();npcClient.city=client;}}
  public float Elapsed=>elapsed;
  void Update(){if(client==null||client.Store.Current==null)return;var state=client.Store.Current;if(round!=state.SessionId){round=state.SessionId;elapsed=0;}if(client.Store.Connection!=CityConnection.Connected)return;if(state.Status!="FINALIZED"&&state.Status!="CLOSING")elapsed+=Time.deltaTime; RenderNpcs(state.SessionId);RenderSettings.fog=(float)(state.OverallPollution ?? 0)>=pollutionThreshold;RenderSettings.fogMode=FogMode.Exponential;RenderSettings.fogDensity=.001f+(float)(state.OverallPollution ?? 0)*.00004f;RenderSettings.fogColor=new Color(.48f,.47f,.42f); Set(moodBeacon,state.Happiness>=highHappinessThreshold?Color.green:Color.gray);Set(cleanlinessBeacon,state.Cleanliness<lowCleanlinessThreshold?new Color(.6f,.3f,.08f):Color.cyan);Set(safetyBeacon,state.Safety<lowSafetyThreshold?Color.red:Color.blue);}
  void RenderNpcs(string sessionId){
   var crowd=npcClient!=null?npcClient.Current:null;
   var hasLive=crowd!=null&&crowd.SessionId==sessionId;
   if(previewNpcs!=null)for(int i=0;i<previewNpcs.Length;i++)if(previewNpcs[i]!=null){previewNpcs[i].gameObject.SetActive(!hasLive);if(!hasLive)previewNpcs[i].position=PositionAt(elapsed+i*7);}
   if(!hasLive){foreach(var avatar in liveNpcs.Values)if(avatar!=null)Destroy(avatar.gameObject);liveNpcs.Clear();return;}
   var seen=new System.Collections.Generic.HashSet<string>();
   var at=crowd.MotionTime(Time.realtimeSinceStartupAsDouble);
   foreach(var npc in crowd.Npcs){
    seen.Add(npc.Id);
    if(!liveNpcs.TryGetValue(npc.Id,out var avatar)||avatar==null){
     var instance=GameObject.CreatePrimitive(PrimitiveType.Capsule);
     instance.name="Participant NPC "+npc.Id.Substring(0,8);
     instance.transform.SetParent(transform);
     instance.transform.localScale=new Vector3(.55f,.8f,.55f);
     var collider=instance.GetComponent<Collider>();if(collider!=null)Destroy(collider);
     var renderer=instance.GetComponent<Renderer>();renderer.material.color=new Color(.95f,.6f,.18f);
     avatar=instance.transform;liveNpcs[npc.Id]=avatar;
    }
    avatar.position=npc.PositionAt(at);
   }
   var removed=new System.Collections.Generic.List<string>();
   foreach(var pair in liveNpcs)if(!seen.Contains(pair.Key)){if(pair.Value!=null)Destroy(pair.Value.gameObject);removed.Add(pair.Key);}
   foreach(var id in removed)liveNpcs.Remove(id);
  }
  void Set(Renderer r,Color c){if(r!=null)r.material.color=c;}
  public Vector3 PositionAt(float seconds){if(path==null||path.Length<2)return Vector3.zero;float length=0;for(int i=0;i<path.Length;i++)length+=Vector3.Distance(path[i],path[(i+1)%path.Length]);if(length<=Mathf.Epsilon)return path[0];float d=Mathf.Repeat(seconds*speed,length);for(int i=0;i<path.Length;i++){var a=path[i];var b=path[(i+1)%path.Length];float segment=Vector3.Distance(a,b);if(segment>Mathf.Epsilon&&d<=segment)return Vector3.Lerp(a,b,d/segment);d-=segment;}return path[0];}
  void OnDrawGizmos(){if(path==null||path.Length<2)return;Gizmos.color=Color.yellow;for(int i=0;i<path.Length;i++)Gizmos.DrawLine(path[i],path[(i+1)%path.Length]);}
 }
}
