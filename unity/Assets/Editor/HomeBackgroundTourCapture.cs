using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using Simus.HomeBackground;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using Object = UnityEngine.Object;

public static class HomeBackgroundTourCapture
{
    public const string Scene = "Assets/SIMUS/Scenes/home_background/HomeBackgroundCinematic.unity";
    const int Frames = 900;
    static string Output => Environment.GetEnvironmentVariable("SIMUS_HOME_TOUR_OUTPUT") ?? Path.GetFullPath("Logs/HomeBackgroundTour");
    static readonly Vector2[] Boundary = {
        new Vector2(-230,-180),new Vector2(195,-180),new Vector2(265,-95),new Vector2(265,205),
        new Vector2(185,280),new Vector2(-185,280),new Vector2(-230,220)
    };
    static readonly Vector3[] ViewCorners = { new Vector3(0,0),new Vector3(1,0),new Vector3(1,1),new Vector3(0,1) };
    static readonly Vector4[] Keys = {
        new Vector4(44,3,32,94),new Vector4(40,5,143,100),new Vector4(-120,7,145,100),
        new Vector4(-110,5,-65,105),new Vector4(55,3,-65,94),new Vector4(168,3,110,90)
    };
    static readonly float[] Yaws = { -24,-25,-25,-24,-24,78 };

    [MenuItem("SIMUS/Home Background/4 Create cinematic tour")]
    public static void Create()
    {
        if (!Application.isBatchMode && !EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;
        if (File.Exists(Scene)) throw new InvalidOperationException("Cinematic scene exists; capture it or move it aside before recreating.");
        var scene = EditorSceneManager.OpenScene(HomeBackgroundCapture.Scene);
        var view = GameObject.Find("Home Background Camera").GetComponent<Camera>();
        HomeBackgroundCinematicPreview.ConfigureView(view);
        var motion = Object.FindFirstObjectByType<HomeBackgroundMotion>();
        motion.loopDuration=30; motion.walkerPeriods=2; motion.animationCycles=30; motion.trafficStride=3;
        HomeBackgroundCinematicPreview.PlaceCitizens(motion,Keys.Select(p=>new Vector3(p.x,p.y,p.z)).ToArray());
        foreach(var car in motion.cars) Object.DestroyImmediate(car.gameObject);
        var names=new[]{"EVS_12_taxi_v001","EVS_07_city_state_saf_car_normal_01","EVS_04_city_bus_v001"};
        motion.cars=Enumerable.Range(0,12).Select(i=>{
            var template=GameObject.Find(names[i%3]);
            if(template==null)throw new InvalidOperationException("Missing existing vehicle: "+names[i%3]);
            var actor=new GameObject("Filming traffic "+i+" "+names[i%3]);
            actor.transform.SetParent(motion.transform,false);
            var car=Object.Instantiate(template);car.transform.SetParent(actor.transform,true);
            car.transform.localScale=template.transform.lossyScale;
            car.transform.rotation=template.transform.rotation;
            foreach(var script in car.GetComponentsInChildren<MonoBehaviour>(true))Object.DestroyImmediate(script);
            foreach(var collider in car.GetComponentsInChildren<Collider>(true))Object.DestroyImmediate(collider);
            // Event FBX groups contain world-offset geometry: centre the visual under a new pivot.
            var renderers=car.GetComponentsInChildren<Renderer>();var bounds=VehicleBounds(renderers);
            if(bounds.size.y>Mathf.Max(bounds.size.x,bounds.size.z))car.transform.RotateAround(Vector3.zero,Vector3.right,90);
            bounds=VehicleBounds(renderers);
            if(bounds.size.x>bounds.size.z)car.transform.RotateAround(Vector3.zero,Vector3.up,-90);
            bounds=VehicleBounds(renderers);
            car.transform.position-=new Vector3(bounds.center.x,bounds.min.y,bounds.center.z);
            if(i<3)Debug.Log("HOME_TOUR_VEHICLE "+names[i]+" corrected_size="+bounds.size);
            return actor.transform;
        }).ToArray();
        // Two lanes of existing 14m R01, with rounded turns inside its ends.
        var road=new List<Vector3>();
        for(int i=0;i<=33;i++)road.Add(new Vector3(Mathf.Lerp(-190,140,i/33f),0,45));
        for(int i=1;i<=24;i++){float a=-Mathf.PI/2+i*Mathf.PI/24;road.Add(new Vector3(140+5*Mathf.Cos(a),0,50+5*Mathf.Sin(a)));}
        for(int i=1;i<=33;i++)road.Add(new Vector3(Mathf.Lerp(140,-190,i/33f),0,55));
        for(int i=1;i<24;i++){float a=Mathf.PI/2+i*Mathf.PI/24;road.Add(new Vector3(-190+5*Mathf.Cos(a),0,50+5*Mathf.Sin(a)));}
        Physics.SyncTransforms();
        for(int i=0;i<road.Count;i++)
        {
            var point=road[i];
            var hits=Physics.RaycastAll(point+Vector3.up*5,Vector3.down,10)
                .Where(h=>h.normal.y>.8f && h.point.y<2 && h.point.y>-.5f).OrderByDescending(h=>h.point.y).ToArray();
            if(hits.Length==0)throw new InvalidOperationException("Road support missing: "+point);
            point.y=hits[0].point.y+.08f;road[i]=point;
        }
        motion.road=road.ToArray();
        var tour=view.gameObject.AddComponent<HomeBackgroundTour>();
        tour.edgeShader=Shader.Find("Hidden/SIMUS/HomeBackgroundEdgeSoftness");
        // Sample the smooth closed curve densely, then resample by travelled distance.
        var rawPositions=new Vector3[2401];var rawRotations=new Quaternion[2401];var lengths=new float[2401];
        float maxCorrection=0;
        for(int i=0;i<rawPositions.Length;i++)
        {
            float phase=i/2400f*Keys.Length;int k=Mathf.FloorToInt(phase)%Keys.Length;float t=phase-Mathf.Floor(phase);
            var pose=Spline(Keys[(k+Keys.Length-1)%Keys.Length],Keys[k],Keys[(k+1)%Keys.Length],Keys[(k+2)%Keys.Length],t);
            float yaw=Spline(new Vector4(Yaws[(k+Keys.Length-1)%Keys.Length],0,0,0),new Vector4(Yaws[k],0,0,0),new Vector4(Yaws[(k+1)%Keys.Length],0,0,0),new Vector4(Yaws[(k+2)%Keys.Length],0,0,0),t).x;
            view.transform.rotation=Quaternion.Euler(34,yaw,0);
            view.transform.position=new Vector3(pose.x,pose.y,pose.z)-view.transform.forward*pose.w;
            var original=view.transform.position;
            KeepInside(view,10);
            maxCorrection=Mathf.Max(maxCorrection,Vector3.Distance(original,view.transform.position));
            rawPositions[i]=view.transform.position;rawRotations[i]=view.transform.rotation;
            if(i>0)lengths[i]=lengths[i-1]+Vector3.Distance(rawPositions[i-1],rawPositions[i]);
        }
        tour.positions=new Vector3[Frames];tour.rotations=new Quaternion[Frames];
        int segment=1;
        for(int i=0;i<Frames;i++)
        {
            float distance=lengths[2400]*i/Frames;
            while(segment<2400 && lengths[segment]<distance)segment++;
            float t=Mathf.InverseLerp(lengths[segment-1],lengths[segment],distance);
            tour.positions[i]=Vector3.Lerp(rawPositions[segment-1],rawPositions[segment],t);
            tour.rotations[i]=Quaternion.Slerp(rawRotations[segment-1],rawRotations[segment],t);
        }
        float minimumMargin=float.MaxValue;
        for(int i=0;i<=1800;i++)
        {
            tour.Evaluate(i*tour.duration/1800f);
            minimumMargin=Mathf.Min(minimumMargin,Margin(view));
            if(Physics.CheckSphere(view.transform.position,1.2f,Physics.DefaultRaycastLayers,QueryTriggerInteraction.Ignore))
                throw new InvalidOperationException("Camera clips geometry at "+i/60f);
        }
        if(minimumMargin<8)throw new InvalidOperationException("Boundary margin insufficient: "+minimumMargin);
        motion.Evaluate(0);tour.Evaluate(0);
        EditorSceneManager.SaveScene(scene,Scene);
        Directory.CreateDirectory(Output);
        File.WriteAllText(Path.Combine(Output,"tour-validation.json"),new JObject{
            ["scene"]=Scene,["duration_seconds"]=tour.duration,["width"]=1920,["height"]=1080,["fps"]=30,["frames"]=Mathf.RoundToInt(tour.duration*30),
            ["camera_poses"]=Frames,["boundary_samples"]=1801,["minimum_boundary_margin_m"]=minimumMargin,
            ["max_camera_boundary_correction_m"]=maxCorrection,["camera_path_length_m"]=lengths[2400],
            ["camera_collisions"]=0,["walkers"]=motion.walkers.Length,["cars"]=motion.cars.Length,
            ["vehicle_types"]=new JArray("taxi","normal_car","city_bus"),["road_supported_points"]=road.Count,
            ["layout_changed"]=false,["server_logic_enabled"]=false
        }.ToString());
        Debug.Log("HOME_TOUR_CREATED margin="+minimumMargin+" path="+lengths[2400]);
    }

    [MenuItem("SIMUS/Home Background/5 Capture cinematic tour")]
    public static void Capture()
    {
        if(!Application.isBatchMode && !EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())return;
        EditorSceneManager.OpenScene(Scene);
        var motion=Object.FindFirstObjectByType<HomeBackgroundMotion>();
        var tour=Object.FindFirstObjectByType<HomeBackgroundTour>();var view=tour.GetComponent<Camera>();
        HomeBackgroundCinematicPreview.ConfigureView(view);
        tour.edgeEnabled=false; // Apply once explicitly for deterministic offline renders.
        foreach(var walker in motion.walkers){walker.animator.Rebind();walker.animator.Update(0);}
        var rt=new RenderTexture(1920,1080,24){antiAliasing=4};var softened=new RenderTexture(1920,1080,0);
        var pixels=new Texture2D(1920,1080,TextureFormat.RGB24,false);var effect=new Material(tour.edgeShader);
        var previous=RenderTexture.active;Directory.CreateDirectory(Output);
        bool sample=Environment.GetEnvironmentVariable("SIMUS_HOME_TOUR_SAMPLE")=="1";
        int totalFrames=Mathf.RoundToInt(tour.duration*30);
        System.Diagnostics.Process encoder=null;
        System.Threading.Tasks.Task<string> encoderErrors=null;
        string ffmpeg=Environment.GetEnvironmentVariable("SIMUS_HOME_FFMPEG");
        if(!sample && !string.IsNullOrEmpty(ffmpeg))
        {
            string output=Path.Combine(Output,"city-background.mp4");
            string args="-hide_banner -y -f image2pipe -vcodec mjpeg -framerate 30 -i pipe:0 -frames:v "+totalFrames+
                " -vf scale=in_range=pc:out_range=tv:out_color_matrix=bt709 -c:v libx264 -preset slow -threads 2 -crf 24 -maxrate 4M -bufsize 8M -profile:v high -level:v 4.1 -g 60 -pix_fmt yuv420p -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 -an -movflags +faststart \""+output+"\"";
            encoder=System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(ffmpeg,args){UseShellExecute=false,RedirectStandardInput=true,RedirectStandardError=true,CreateNoWindow=true});
            encoderErrors=encoder.StandardError.ReadToEndAsync();
        }
        try
        {
            view.targetTexture=rt;
            int count=sample?12:totalFrames+1;
            int start=0;
            if(!sample && encoder==null && int.TryParse(Environment.GetEnvironmentVariable("SIMUS_HOME_TOUR_START"),out var requestedStart))start=Mathf.Clamp(requestedStart,0,totalFrames);
            for(int frame=start;frame<count;frame++)
            {
                float seconds=sample?frame*tour.duration/12:frame/30f;
                motion.Evaluate(seconds);tour.Evaluate(seconds);
                if(Margin(view)<8)throw new InvalidOperationException("Frame outside map: "+frame);
                view.Render();Graphics.Blit(rt,softened,effect);RenderTexture.active=softened;
                pixels.ReadPixels(new Rect(0,0,1920,1080),0,0);pixels.Apply();
                byte[] bytes=pixels.EncodeToJPG(95);
                string name=sample?$"sample-{frame:D2}.jpg":frame==totalFrames?"seam.jpg":$"frame-{frame:D4}.jpg";
                if(encoder!=null && frame<totalFrames)encoder.StandardInput.BaseStream.Write(bytes,0,bytes.Length);
                if(encoder==null || frame==0 || frame==totalFrames || frame%750==0)File.WriteAllBytes(Path.Combine(Output,name),bytes);
                if(frame%150==0)Debug.Log("HOME_TOUR_FRAME "+frame+" / "+totalFrames);
            }
        }
        finally
        {
            view.targetTexture=null;RenderTexture.active=previous;rt.Release();softened.Release();
            Object.DestroyImmediate(rt);Object.DestroyImmediate(softened);Object.DestroyImmediate(pixels);Object.DestroyImmediate(effect);
            if(encoder!=null)
            {
                encoder.StandardInput.Close();encoder.WaitForExit();
                File.WriteAllText(Path.Combine(Output,"encode.log"),encoderErrors.GetAwaiter().GetResult());
                int code=encoder.ExitCode;encoder.Dispose();
                if(code!=0)throw new InvalidOperationException("Streaming encoder failed: "+code);
            }
        }
        EditorSceneManager.NewScene(NewSceneSetup.EmptyScene);
        Debug.Log("HOME_TOUR_CAPTURE_COMPLETE sample="+sample);
    }

    public static void CreateAndCapture(){Create();Capture();}
    public static void SlowAndCapture()
    {
        EditorSceneManager.OpenScene(Scene);
        var tour=Object.FindFirstObjectByType<HomeBackgroundTour>();tour.duration=150;
        var view=tour.GetComponent<Camera>();float margin=float.MaxValue;
        for(int i=0;i<=1800;i++){tour.Evaluate(i*150f/1800);margin=Mathf.Min(margin,Margin(view));}
        if(margin<8)throw new InvalidOperationException("Slower tour boundary check failed.");
        tour.Evaluate(0);EditorSceneManager.SaveScene(EditorSceneManager.GetActiveScene(),Scene);
        Directory.CreateDirectory(Output);
        File.WriteAllText(Path.Combine(Output,"speed-validation.json"),new JObject{
            ["previous_camera_duration_seconds"]=30,["camera_duration_seconds"]=150,["camera_speed_multiplier"]=.2,
            ["fps"]=30,["frames"]=4500,["boundary_samples"]=1801,["minimum_boundary_margin_m"]=margin,
            ["citizen_traffic_loop_seconds"]=30,["citizen_traffic_speed_changed"]=false
        }.ToString());
        Capture();
    }
    static Bounds VehicleBounds(Renderer[] renderers)
    {
        var bounds=renderers[0].bounds;
        foreach(var renderer in renderers)bounds.Encapsulate(renderer.bounds);
        return bounds;
    }
    static Vector4 Spline(Vector4 a,Vector4 b,Vector4 c,Vector4 d,float t)=>.5f*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);

    static Vector2 GroundCorner(Camera view,Vector3 viewport)
    {
        var ray=view.ViewportPointToRay(viewport);
        if(!new Plane(Vector3.up,Vector3.zero).Raycast(ray,out var distance))throw new InvalidOperationException("Horizon visible.");
        var point=ray.GetPoint(distance);return new Vector2(point.x,point.z);
    }
    static float Margin(Camera view)
    {
        float margin=float.MaxValue;
        foreach(var corner in ViewCorners)
        {
            var point=GroundCorner(view,corner);
            for(int i=0;i<Boundary.Length;i++)
            {
                var a=Boundary[i];var edge=Boundary[(i+1)%Boundary.Length]-a;
                margin=Mathf.Min(margin,Vector2.Dot(point-a,new Vector2(-edge.y,edge.x).normalized));
            }
        }
        return margin;
    }
    static void KeepInside(Camera view,float clearance)
    {
        for(int pass=0;pass<12;pass++)
            foreach(var corner in ViewCorners)
                for(int i=0;i<Boundary.Length;i++)
                {
                    var point=GroundCorner(view,corner);var a=Boundary[i];var edge=Boundary[(i+1)%Boundary.Length]-a;
                    var inward=new Vector2(-edge.y,edge.x).normalized;float margin=Vector2.Dot(point-a,inward);
                    if(margin<clearance){var shift=inward*(clearance-margin+.001f);view.transform.position+=new Vector3(shift.x,0,shift.y);}
                }
    }
}
