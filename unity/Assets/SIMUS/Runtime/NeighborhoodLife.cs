using UnityEngine;
namespace Simus.City {
 public class NeighborhoodLife : MonoBehaviour {
  public CityStatePoller client;
  public Vector3[] path;
  public float speed=2f;
  [Tooltip("Prototype temporary visual thresholds")] public float pollutionThreshold=25,lowCleanlinessThreshold=35,lowSafetyThreshold=35,highHappinessThreshold=65;
  public Transform[] previewNpcs;
  public Renderer moodBeacon,cleanlinessBeacon,safetyBeacon;
  float elapsed; string round="";
  public float Elapsed=>elapsed;
  void Update(){if(client==null||client.Store.Current==null)return;var state=client.Store.Current;if(round!=state.SessionId){round=state.SessionId;elapsed=0;}if(client.Store.Connection!=CityConnection.Connected)return;if(state.Status!="FINALIZED"&&state.Status!="CLOSING")elapsed+=Time.deltaTime; for(int i=0;i<previewNpcs.Length;i++)previewNpcs[i].position=PositionAt(elapsed+i*7);RenderSettings.fog=(float)(state.OverallPollution ?? 0)>=pollutionThreshold;RenderSettings.fogMode=FogMode.Exponential;RenderSettings.fogDensity=.001f+(float)(state.OverallPollution ?? 0)*.00004f;RenderSettings.fogColor=new Color(.48f,.47f,.42f); Set(moodBeacon,state.Happiness>=highHappinessThreshold?Color.green:Color.gray);Set(cleanlinessBeacon,state.Cleanliness<lowCleanlinessThreshold?new Color(.6f,.3f,.08f):Color.cyan);Set(safetyBeacon,state.Safety<lowSafetyThreshold?Color.red:Color.blue);}
  void Set(Renderer r,Color c){if(r!=null)r.material.color=c;}
  public Vector3 PositionAt(float seconds){if(path==null||path.Length<2)return Vector3.zero;float length=0;for(int i=0;i<path.Length;i++)length+=Vector3.Distance(path[i],path[(i+1)%path.Length]);if(length<=Mathf.Epsilon)return path[0];float d=Mathf.Repeat(seconds*speed,length);for(int i=0;i<path.Length;i++){var a=path[i];var b=path[(i+1)%path.Length];float segment=Vector3.Distance(a,b);if(segment>Mathf.Epsilon&&d<=segment)return Vector3.Lerp(a,b,d/segment);d-=segment;}return path[0];}
  void OnDrawGizmos(){if(path==null||path.Length<2)return;Gizmos.color=Color.yellow;for(int i=0;i<path.Length;i++)Gizmos.DrawLine(path[i],path[(i+1)%path.Length]);}
 }
}
