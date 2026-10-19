using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEngine;

namespace Simus
{
    // Created only by the Phase 8 editor bridge. All output uses new evidence paths.
    [DefaultExecutionOrder(250)]
    public sealed class CityV002Phase8Verification : MonoBehaviour
    {
        public string stage;
        public event Action<bool> Completed;
        CityPreviewCamera preview; Camera view; CityV002NavigationVerification navigation;
        readonly List<string> errors = new List<string>();
        readonly List<string> captures = new List<string>();
        readonly List<string> logs = new List<string>();
        [Serializable] public sealed class TransitionSample
        {
            public string label,status;public int frames;public float seconds,maxCameraStep,maxPanSpeed,maxAngularSpeed,maxZoomSpeed,finalTargetError,firstCameraStep,firstPanSpeed,firstAngleDelta,firstZoomDelta;
        }
        [Serializable] public sealed class TransitionResults {public string scope="Actual real-time Unity Play Mode; samples in execution-order250 LateUpdate after camera, first visible pose included; production elapsed clock reset on acquisition and capped1/30s, timeScale0 for stationary acquisition; default legacy behavior unchanged";public TransitionSample[] samples;}
        readonly List<TransitionSample> transitions=new List<TransitionSample>();
        TransitionSample activeTransition;
        double transitionPreviousTime;
        Vector3 transitionPreviousTarget,transitionPreviousPosition;
        Quaternion transitionPreviousRotation;
        float transitionPreviousSize;
        void LateUpdate()
        {
            if(activeTransition==null)return;
            double now=Time.realtimeSinceStartupAsDouble;float dt=(float)Math.Max(.000001,now-transitionPreviousTime);
            var sample=activeTransition;sample.frames++;
            if(sample.frames==1){sample.firstCameraStep=Vector3.Distance(view.transform.position,transitionPreviousPosition);sample.firstPanSpeed=Vector3.Distance(preview.target,transitionPreviousTarget)/dt;sample.firstAngleDelta=Quaternion.Angle(view.transform.rotation,transitionPreviousRotation);sample.firstZoomDelta=Mathf.Abs(view.orthographicSize-transitionPreviousSize);}
            sample.maxCameraStep=Mathf.Max(sample.maxCameraStep,Vector3.Distance(view.transform.position,transitionPreviousPosition));
            sample.maxPanSpeed=Mathf.Max(sample.maxPanSpeed,Vector3.Distance(preview.target,transitionPreviousTarget)/dt);
            sample.maxAngularSpeed=Mathf.Max(sample.maxAngularSpeed,Quaternion.Angle(view.transform.rotation,transitionPreviousRotation)/dt);
            sample.maxZoomSpeed=Mathf.Max(sample.maxZoomSpeed,Mathf.Abs(view.orthographicSize-transitionPreviousSize)/dt);
            transitionPreviousTime=now;transitionPreviousTarget=preview.target;transitionPreviousPosition=view.transform.position;transitionPreviousRotation=view.transform.rotation;transitionPreviousSize=view.orthographicSize;
        }
        int followFrames, offscreen, below, revealFrames;
        float maximumStep, maximumError; Vector3 previousCamera;
        string Folder => "../docs/verification/city-rebuild-v002-phase8-captures/" + stage;
        void OnLog(string message, string stack, LogType type)
        {
            logs.Add(type + " " + message);
            if (type == LogType.Error || type == LogType.Exception || type == LogType.Assert) errors.Add(message);
        }
        IEnumerator Start()
        {
            Application.logMessageReceived += OnLog;
            Application.runInBackground = true;
            Directory.CreateDirectory(Folder);
            preview = FindFirstObjectByType<CityPreviewCamera>(); view = preview.GetComponent<Camera>();
            navigation = FindFirstObjectByType<CityV002NavigationVerification>();
            view.aspect = 1920f / 1080;
            if(stage=="after"){QualitySettings.vSyncCount=0;Application.targetFrameRate=60;}
            yield return null;
            // Freeze the same route actor at the same route anchors for paired captures.
            var actor = navigation.actors[0];
            foreach (var p in FindObjectsByType<TestNpcPatrol>(FindObjectsSortMode.None)) p.enabled = false;
            foreach (var a in FindObjectsByType<CityV002NpcRouteAdapter>(FindObjectsSortMode.None)) a.enabled = false;
            navigation.enabled = false;
            foreach(var p in FindObjectsByType<TestNpcPatrol>(FindObjectsSortMode.None))if(p.gameObject!=actor.gameObject)p.gameObject.SetActive(false);
            preview.previewControls = false;
            StaticPose("01-city", new Vector3(-15,0,-27.5f),260,55,-36); yield return null; Capture("01-city");
            StaticPose("02-school",new Vector3(0,0,65),106,55,-36); yield return null; Capture("02-school");
            StaticPose("03-commercial",new Vector3(3,0,-103),72,55,-36); yield return null; Capture("03-commercial");
            StaticPose("04-residential",new Vector3(-163,0,60),84,55,-36); yield return null; Capture("04-residential");
            StaticPose("05-park-river",new Vector3(137,0,65),104,55,-36); yield return null; Capture("05-park-river");
            if(stage=="after")
            {
                var water=FindFirstObjectByType<CityV002RiverWater>();float pollution=water.pollution;bool follow=water.followCityState;water.followCityState=false;
                water.SetPollution(0);yield return null;Capture("08-river-clean-0");
                water.SetPollution(100);yield return null;Capture("09-river-polluted-100");
                water.SetPollution(pollution);water.followCityState=follow;
            }
            preview.enabled = true; var activeReveal=FindFirstObjectByType<NpcOcclusionReveal>(FindObjectsInactive.Include);if(activeReveal!=null)activeReveal.enabled=true;
            yield return Acquire(actor,"CAMPUS_PLAZA","static-view-to-campus"); Capture("06-npc-follow");
            yield return Acquire(actor,"B16_ACCESS","campus-to-apartment"); Capture("07-apartment-follow");
            if (stage == "before")
            {
                float size=preview.followSize,pitch=preview.followPitch,yaw=preview.followYaw,radius=preview.revealRadius;
                preview.followSize=17; preview.followPitch=42; preview.Follow(); yield return new WaitForSecondsRealtime(.3f); Capture("alternative-02-pitch42-size17");
                preview.followSize=18; preview.followPitch=50; preview.revealRadius=4.2f; preview.Follow(); yield return new WaitForSecondsRealtime(.3f); Capture("alternative-03-pitch50-size18");
                preview.followSize=26; preview.followPitch=55; preview.followYaw=-36; preview.revealRadius=6; preview.Follow(); yield return new WaitForSecondsRealtime(.3f); Capture("alternative-04-pitch55-size26-yaw36");
                preview.followSize=26; preview.followPitch=60; preview.followYaw=-131.64f; preview.revealRadius=6; preview.Follow(); yield return new WaitForSecondsRealtime(.3f); Capture("alternative-05-pitch60-size26");
                var reveal=FindFirstObjectByType<NpcOcclusionReveal>(); reveal.contextFadeEnabled=true; reveal.contextRadius=14; reveal.contextVisibility=.12f;
                preview.followSize=17; preview.followPitch=42;preview.followYaw=-131.64f;preview.revealRadius=4.2f;preview.Follow();yield return new WaitForSecondsRealtime(.6f);Capture("alternative-06-context-fade-pitch42-size17");
                reveal.contextFadeEnabled=false; preview.followSize=size; preview.followPitch=pitch; preview.followYaw=yaw; preview.revealRadius=radius;
            }
            else
            {
                // Paired capture actors are reset by entering Play Mode; now run preserved four round trips.
                foreach (var p in FindObjectsByType<TestNpcPatrol>(FindObjectsSortMode.None)) p.gameObject.SetActive(false);
                var freshActors = navigation.actors.Select(a => { var clone=Instantiate(a.gameObject); clone.name=a.name+"_Phase8Regression"; var route=clone.GetComponent<CityV002NpcRouteAdapter>(); route.startAutomatically=false; route.enabled=true; clone.GetComponent<TestNpcPatrol>().enabled=true; clone.SetActive(true); route.BeginRoute(); return route; }).ToArray();
                foreach(var a in freshActors)a.GetComponent<TestNpcPatrol>().enabled=false;
                Time.timeScale=0;yield return Acquire(freshActors[0],null,"apartment-to-route-start");
                foreach(var a in freshActors)a.GetComponent<TestNpcPatrol>().enabled=true;
                // Recreate monitor and actors from fresh serialized objects for exact route evidence.
                // The old monitor already sampled the initial startup frame; reset by using a new component.
                var fresh = new GameObject("Phase8_FreshNavigationMonitor").AddComponent<CityV002NavigationVerification>();
                fresh.actors = freshActors;
                navigation = fresh;
                Time.timeScale=20;
                float begun=Time.realtimeSinceStartup;
                previousCamera=view.transform.position;
                while (!navigation.AllArrived && Time.realtimeSinceStartup-begun<240)
                {
                    yield return null;
                    var target=navigation.actors[0].transform;
                    view.Render(); var renderers=target.GetComponentsInChildren<SkinnedMeshRenderer>(); var bounds=renderers[0].bounds; foreach(var r in renderers.Skip(1))bounds.Encapsulate(r.bounds); var foot=view.WorldToViewportPoint(new Vector3(bounds.center.x,bounds.min.y,bounds.center.z)); var head=view.WorldToViewportPoint(new Vector3(bounds.center.x,bounds.max.y,bounds.center.z));
                    followFrames++;
                    if(foot.z<=0||head.z<=0||foot.x<0||foot.x>1||foot.y<0||foot.y>1||head.y<0||head.y>1) offscreen++;
                    if(target.position.y<-.04f)below++;
                    maximumStep=Mathf.Max(maximumStep,Vector3.Distance(view.transform.position,previousCamera));previousCamera=view.transform.position;
                    maximumError=Mathf.Max(maximumError,Vector2.Distance(new Vector2(foot.x,foot.y),new Vector2(.5f,.5f)));
                    if(FindFirstObjectByType<NpcOcclusionReveal>()!=null)revealFrames++;
                }
                yield return null;
                File.WriteAllText("../docs/verification/city-rebuild-v002-phase8-navigation-runtime.json",navigation.EvidenceJson());
                if(!navigation.AllArrived || navigation.Evidence.routes.Any(r=>r.status!="PASS")) errors.Add("Four route round-trip regression failed");
                Time.timeScale=1;
                // Real-time camera movement sample, independent of accelerated route maximumStep.
                var apt=navigation.actors[0]; apt.GetComponent<CityV002NpcRouteAdapter>().enabled=false; apt.GetComponent<TestNpcPatrol>().enabled=false;
                yield return Acquire(apt,"B16_ACCESS","route-end-to-apartment");
                QualitySettings.vSyncCount=0;Application.targetFrameRate=60;
                float realtimeStep=0,realtimeSpeed=0,maxAngle=0,maxSizeDelta=0; previousCamera=view.transform.position; float previousSampleTime=Time.realtimeSinceStartup; var previousRotation=view.transform.rotation; float previousSize=view.orthographicSize; int realtimeFrames=0; float start=Time.realtimeSinceStartup;
                while(Time.realtimeSinceStartup-start<2)
                {
                    apt.transform.position+=Vector3.right*(1.4f*Time.unscaledDeltaTime);
                    yield return null; realtimeFrames++; float step=Vector3.Distance(view.transform.position,previousCamera); realtimeStep=Mathf.Max(realtimeStep,step);realtimeSpeed=Mathf.Max(realtimeSpeed,step/Mathf.Max(Time.realtimeSinceStartup-previousSampleTime,.00001f));maxAngle=Mathf.Max(maxAngle,Quaternion.Angle(previousRotation,view.transform.rotation));maxSizeDelta=Mathf.Max(maxSizeDelta,Mathf.Abs(previousSize-view.orthographicSize));previousCamera=view.transform.position;previousRotation=view.transform.rotation;previousSize=view.orthographicSize;previousSampleTime=Time.realtimeSinceStartup;
                }
                logs.Add("Realtime follow frames="+realtimeFrames+" max camera step metres="+realtimeStep+" max speed metres/sec="+realtimeSpeed+" max angle delta="+maxAngle+" max ortho delta="+maxSizeDelta+" threshold speed<=1.5 m/s; opt-in acquisition measured separately"); if(realtimeSpeed>1.5f || maxAngle>.01f || maxSizeDelta>.01f)errors.Add("Real-time camera smoothness threshold failed");
            }
            File.WriteAllText("../docs/verification/city-rebuild-v002-phase8-"+stage+"-transitions.json",JsonUtility.ToJson(new TransitionResults{samples=transitions.ToArray()},true));
            bool passed=errors.Count==0 && offscreen==0 && below==0;
            string json="{\"stage\":\""+stage+"\",\"status\":\""+(passed?"PASS":"FAIL")+"\",\"unityVersion\":\""+Application.unityVersion+"\",\"scope\":\"Actual Unity Play Mode Game camera 1920x1080 Camera.Render; Phase8 A/B only; no performance measurements\",\"followFrames\":"+followFrames+",\"fullBodyOffscreenFrames\":"+offscreen+",\"groundBelowFrames\":"+below+",\"revealFrames\":"+revealFrames+",\"maximumAcceleratedCameraStep\":"+maximumStep.ToString(System.Globalization.CultureInfo.InvariantCulture)+",\"maximumFollowCenterError\":"+maximumError.ToString(System.Globalization.CultureInfo.InvariantCulture)+",\"errors\":["+string.Join(",",errors.Select(e=>"\""+e.Replace("\"","'").Replace("\n"," ")+"\"")) +"],\"captures\":["+string.Join(",",captures.Select(c=>"\""+c+"\""))+"]}";
            File.WriteAllText("../docs/verification/city-rebuild-v002-phase8-"+stage+"-runtime.json",json);
            File.WriteAllText("../docs/verification/city-rebuild-v002-phase8-"+stage+"-playmode.log",string.Join("\n",logs));
            Application.logMessageReceived-=OnLog;
            Debug.Log("CITY_V002_PHASE8_"+stage+"_"+(passed?"PASS":"FAIL")); Completed?.Invoke(passed);
        }
        IEnumerator Acquire(CityV002NpcRouteAdapter actor,string id,string label)
        {
            if(id!=null)SetActor(actor,id);
            var oldTimeScale=Time.timeScale;Time.timeScale=0;
            var sample=new TransitionSample{label=label};float start=Time.realtimeSinceStartup;
            transitionPreviousTime=Time.realtimeSinceStartupAsDouble;
            transitionPreviousTarget=view.transform.position+view.transform.forward*360f;
            transitionPreviousPosition=view.transform.position;transitionPreviousRotation=view.transform.rotation;transitionPreviousSize=view.orthographicSize;
            activeTransition=sample;
            preview.SetFollowTarget(actor.transform);
            do {yield return null;}while(preview.IsTransitioning && Time.realtimeSinceStartup-start<15);
            activeTransition=null;
            sample.seconds=Time.realtimeSinceStartup-start;sample.finalTargetError=Vector3.Distance(preview.target,actor.transform.position+preview.followOffset);
            bool pass=!preview.IsTransitioning && sample.finalTargetError<.1f && (!preview.smoothFollowTransitions || (sample.maxPanSpeed<=42 && sample.maxAngularSpeed<=21 && sample.maxZoomSpeed<=126));
            sample.status=pass?"PASS":"FAIL";transitions.Add(sample);if(stage=="after"&&!pass)errors.Add("Acquisition transition failed: "+label);
            Time.timeScale=oldTimeScale;
        }
        void SetActor(CityV002NpcRouteAdapter actor,string id)
        {
            var node=actor.graph.nodes.First(n=>n.id==id); actor.transform.position=node.position+Vector3.up*.02f;
        }
        void StaticPose(string name,Vector3 target,float size,float pitch,float yaw)
        {preview.enabled=false;var reveal=FindFirstObjectByType<NpcOcclusionReveal>();if(reveal!=null){reveal.SetTarget(null,0);reveal.enabled=false;}view.transform.rotation=Quaternion.Euler(pitch,yaw,0);view.transform.position=target-view.transform.forward*360;view.orthographicSize=size;}
        void Capture(string name)
        {
            var previous=view.targetTexture;var active=RenderTexture.active;
            var rt=new RenderTexture(1920,1080,24);var pixels=new Texture2D(1920,1080,TextureFormat.RGB24,false);
            try {view.targetTexture=rt;view.Render();RenderTexture.active=rt;pixels.ReadPixels(new Rect(0,0,1920,1080),0,0);pixels.Apply();File.WriteAllBytes(Folder+"/"+name+".png",pixels.EncodeToPNG());captures.Add(name+".png");}
            finally {view.targetTexture=previous;RenderTexture.active=active;rt.Release();Destroy(rt);Destroy(pixels);}
        }
    }
}
