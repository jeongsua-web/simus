using UnityEngine;
namespace Simus {
 public class CityLife : MonoBehaviour {
  public CityLiveClient client;
  public Vector3[] path;
  public float speed=2f;
  [Tooltip("Prototype temporary visual thresholds")] public float pollutionThreshold=25,lowCleanlinessThreshold=35,lowSafetyThreshold=35,highHappinessThreshold=65;
  public Transform[] previewNpcs;
  public Renderer moodBeacon,cleanlinessBeacon,safetyBeacon;
  float elapsed; string round="";
  public float Elapsed=>elapsed;
  void Update(){if(client==null||client.Current==null)return;var state=client.Current;if(round!=state.id){round=state.id;elapsed=0;}if(!client.Fresh)return;if(state.status!="FINALIZED"&&state.status!="CLOSING")elapsed+=Time.deltaTime; for(int i=0;i<previewNpcs.Length;i++)previewNpcs[i].position=PositionAt(elapsed+i*7);RenderSettings.fog=state.pollution>=pollutionThreshold;RenderSettings.fogMode=FogMode.Exponential;RenderSettings.fogDensity=.001f+state.pollution*.00004f;RenderSettings.fogColor=new Color(.48f,.47f,.42f); Set(moodBeacon,state.happiness>=highHappinessThreshold?Color.green:Color.gray);Set(cleanlinessBeacon,state.cleanliness<lowCleanlinessThreshold?new Color(.6f,.3f,.08f):Color.cyan);Set(safetyBeacon,state.safety<lowSafetyThreshold?Color.red:Color.blue);}
  void Set(Renderer r,Color c){if(r!=null)r.material.color=c;}
  public Vector3 PositionAt(float seconds){if(path==null||path.Length<2)return Vector3.zero;float length=0;for(int i=0;i<path.Length;i++)length+=Vector3.Distance(path[i],path[(i+1)%path.Length]);float d=Mathf.Repeat(seconds*speed,length);for(int i=0;i<path.Length;i++){var a=path[i];var b=path[(i+1)%path.Length];float segment=Vector3.Distance(a,b);if(d<=segment)return Vector3.Lerp(a,b,d/segment);d-=segment;}return path[0];}
  void OnDrawGizmos(){if(path==null||path.Length<2)return;Gizmos.color=Color.yellow;for(int i=0;i<path.Length;i++)Gizmos.DrawLine(path[i],path[(i+1)%path.Length]);}
 }
}
