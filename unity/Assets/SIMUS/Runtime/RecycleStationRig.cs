using UnityEngine;
namespace Simus.City
{
 public sealed class RecycleStationRig:MonoBehaviour
 {
  public enum BinState { Normal, Half, Overflow }
  public Transform[] slots;
  public GameObject[] originalBins;
  public GameObject[] stateModels;
  public Renderer[] lightPanels;
  public Light[] lights;
  public float binScale=1.45f;
  public float stateYawDegrees;
  GameObject[] replacements;
  public void SetLights(bool on)
  {
   foreach(var r in lightPanels){var b=new MaterialPropertyBlock();r.GetPropertyBlock(b);b.SetColor("_EmissionColor",on?new Color(.96f,.88f,.68f)*2:Color.black);r.SetPropertyBlock(b);}
   foreach(var l in lights)l.enabled=on;
  }
  public void SetBinEnabled(int index,bool enabled)
  {
   if(index<0||index>=slots.Length)return;
   slots[index].gameObject.SetActive(enabled);
  }
  public void SetBinState(int index,BinState state){ReplaceBin(index,stateModels[(int)state]);}
  public void ReplaceBin(int index,GameObject model)
  {
   if(index<0||index>=slots.Length||model==null)return;
   if(replacements==null)replacements=new GameObject[slots.Length];
   if(replacements[index]!=null){replacements[index].SetActive(false);if(Application.isPlaying)Destroy(replacements[index]);else DestroyImmediate(replacements[index]);}
   if(originalBins[index]!=null)originalBins[index].SetActive(false);
   var next=Instantiate(model,transform,false);next.name="Reused_Bin_State_"+index;next.transform.localScale*=binScale;next.transform.localRotation=Quaternion.AngleAxis(stateYawDegrees,Vector3.up)*next.transform.localRotation;next.transform.position=slots[index].position;next.transform.SetParent(slots[index],true);replacements[index]=next;
  }
 }
}
