using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
namespace Simus.Editor {
 public static class StageLiveVerification {
  static int ticks; static bool ready; static long targetVersion; static double began;
  [InitializeOnLoadMethod] static void Setup(){if(Application.isBatchMode&&Environment.GetCommandLineArgs().Contains("-simusLiveTest"))EditorApplication.update+=Tick;}
  public static void Begin(){EditorSceneManager.OpenScene("Assets/Scenes/NeighborhoodLive.unity");ticks=0;ready=false;began=EditorApplication.timeSinceStartup;EditorApplication.EnterPlaymode();}
  static void Tick(){if(!EditorApplication.isPlaying)return;ticks++;if(ticks<40)return;
   var client=UnityEngine.Object.FindFirstObjectByType<CityLiveClient>();
   if(client!=null&&client.Current!=null&&client.Fresh&&client.Current.version>=1&&!ready){ready=true;targetVersion=client.Current.version+1;File.WriteAllText("../Verification/live-ready.txt",client.Current.id+" "+client.Current.version);}
   if(client!=null&&client.Current!=null&&client.Fresh&&ready&&client.Current.version>=targetVersion){
    File.WriteAllText("../Verification/live-http.txt","PASS Unity "+Application.unityVersion+" Play mode HTTP /api/state via localhost:8780; round="+client.Current.id+" version="+client.Current.version+" happiness="+client.Current.happiness+" cleanliness="+client.Current.cleanliness+" status="+client.Current.status+"; connection="+client.Connection+". Test PostgreSQL data.\n");
    Debug.Log("SIMUS_LIVE_HTTP_PASS");EditorApplication.Exit(0);
   }
   if(EditorApplication.timeSinceStartup-began>20){Debug.LogError("SIMUS_LIVE_HTTP_FAIL: "+(client==null?"client absent":client.Connection));EditorApplication.Exit(1);}
  }
 }
}
