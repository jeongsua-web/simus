using System;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using Newtonsoft.Json.Linq;
using Simus;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

[InitializeOnLoad]
public static class CityRebuildV002Phase8Bridge
{
    const string Pending="Simus.Phase8.Pending", Stage="Simus.Phase8.Stage";
    static CityRebuildV002Phase8Bridge() { EditorApplication.playModeStateChanged+=Changed; EditorApplication.update+=Poll; }
    static void Poll() { string p="/tmp/simus-v002-phase8-request.txt"; if(EditorApplication.isCompiling || EditorApplication.isUpdating || EditorApplication.isPlayingOrWillChangePlaymode || !File.Exists(p))return; string command=File.ReadAllText(p).Trim(); if(command.Length==0)return; File.WriteAllText(p,""); if(command=="before"||command=="after")Run(command); else if(command=="apply")CityRebuildV002Phase8Setup.Apply(); }
    public static void Before() { Run("before"); }
    public static void After() { Run("after"); }
    static void Run(string stage)
    {
        EditorSceneManager.OpenScene(CityRebuildV002Setup.ScenePath);
        File.WriteAllText("../docs/verification/city-rebuild-v002-phase8-"+stage+"-inputs-before.json",Inputs().ToString());
        SessionState.SetString(Stage,stage);SessionState.SetBool(Pending,true);
        EditorApplication.isPlaying=true;
    }
    static JObject Inputs()
    {
        var files=Directory.GetFiles("Assets/Scripts","*",SearchOption.AllDirectories).Concat(Directory.GetFiles("Assets/Shaders","*",SearchOption.AllDirectories)).Concat(Directory.GetFiles("Assets/Editor","CityRebuildV002*.cs")).Concat(Directory.GetFiles(CityRebuildV002Setup.Folder,"*",SearchOption.AllDirectories)).Concat(Directory.GetFiles("Assets/SIMUS/Art/props/city_v002_phase8","*",SearchOption.AllDirectories));
        var result=new JObject();foreach(var p in files.OrderBy(p=>p)) {using(var sha=SHA256.Create())result[p]=BitConverter.ToString(sha.ComputeHash(File.ReadAllBytes(p))).Replace("-","").ToLowerInvariant();}return result;
    }
    static void Changed(PlayModeStateChange state)
    {
        if(state==PlayModeStateChange.EnteredPlayMode && SessionState.GetBool(Pending,false))
        {
            var runner=new GameObject("Phase8_RuntimeOnly_Verification").AddComponent<CityV002Phase8Verification>();
            runner.stage=SessionState.GetString(Stage,"before");
            runner.Completed+=pass=>{var now=Inputs();var path="../docs/verification/city-rebuild-v002-phase8-"+runner.stage+"-inputs-before.json";var previous=JObject.Parse(File.ReadAllText(path));bool unchanged=JToken.DeepEquals(previous,now);File.WriteAllText("../docs/verification/city-rebuild-v002-phase8-"+runner.stage+"-inputs-after.json",new JObject{["status"]=unchanged?"UNCHANGED_DURING_PLAY":"FAIL",["files"]=now}.ToString());pass=pass&&unchanged;SessionState.SetInt("Simus.Phase8.Exit",pass?0:1);EditorApplication.delayCall+=()=>EditorApplication.isPlaying=false;};
        }
        if(state==PlayModeStateChange.EnteredEditMode && SessionState.GetBool(Pending,false))
        {SessionState.SetBool(Pending,false);if(Application.isBatchMode)EditorApplication.Exit(SessionState.GetInt("Simus.Phase8.Exit",2));}
    }
}
