using UnityEngine;
namespace Simus.City
{
 // Visual controls only: traffic AI, route following and drivetrain physics belong to the host game.
 public sealed class TransitVehicleRig:MonoBehaviour
 {
  public Transform[] wheels; public Transform[] doors; public Vector3[] doorOpenOffsets;
  public Renderer[] headlights,taillights,indicators,routeDisplays,roofSigns,statusSigns;
  public Texture vacantStatusAtlas,occupiedStatusAtlas;
  Quaternion[] wheelRest;Vector3[] doorRest;
  void Awake(){CacheRest();}
  void CacheRest(){if(wheelRest==null){wheelRest=new Quaternion[wheels.Length];for(int i=0;i<wheels.Length;i++)wheelRest[i]=wheels[i].localRotation;}if(doorRest==null){doorRest=new Vector3[doors.Length];for(int i=0;i<doors.Length;i++)doorRest[i]=doors[i].localPosition;}}
  public void SetWheelAngle(float degrees)
  {
   CacheRest();for(int i=0;i<wheels.Length;i++){var axis=wheels[i].parent.InverseTransformDirection(transform.right);wheels[i].localRotation=Quaternion.AngleAxis(degrees,axis)*wheelRest[i];}
  }
  public void SetDoorsOpen(float fraction)
  {
   CacheRest();for(int i=0;i<doors.Length;i++)doors[i].localPosition=doorRest[i]+doorOpenOffsets[i]*Mathf.Clamp01(fraction);
  }
  static void Emission(Renderer[] targets,Color color)
  {
   if(targets==null)return;foreach(var r in targets){if(r==null)continue;var b=new MaterialPropertyBlock();r.GetPropertyBlock(b);b.SetColor("_EmissionColor",color);r.SetPropertyBlock(b);}
  }
  public void SetHeadlights(bool on){Emission(headlights,on?new Color(.92f,.9f,.69f)*2:Color.black);}
  public void SetBrakeLights(bool on){Emission(taillights,on?new Color(.57f,.045f,.026f)*2:Color.black);}
  public void SetIndicators(bool on){Emission(indicators,on?new Color(.88f,.36f,.04f)*2:Color.black);}
  public void SetRouteDisplay(bool on){Emission(routeDisplays,on?Color.white*.7f:Color.black);}
  public void SetRoofSign(bool on){Emission(roofSigns,on?Color.white*.7f:Color.black);}
  public void SetOccupied(bool occupied)
  {
   if(statusSigns==null)return;foreach(var r in statusSigns){var b=new MaterialPropertyBlock();r.GetPropertyBlock(b);var atlas=occupied?occupiedStatusAtlas:vacantStatusAtlas;b.SetTexture("_MainTex",atlas);b.SetTexture("_EmissionMap",atlas);r.SetPropertyBlock(b);}
  }
 }
}
