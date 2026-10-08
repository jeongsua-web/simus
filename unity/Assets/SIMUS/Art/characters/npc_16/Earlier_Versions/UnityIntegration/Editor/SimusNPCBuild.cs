using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.AI;
using UnityEngine.Animations;
using UnityEngine.Playables;
using UnityEditor;
using UnityEditor.Animations;

namespace Simus.Editor
{
    public sealed class NPCImporter : AssetPostprocessor
    {
        void OnPreprocessModel()
        {
            if (!assetPath.Contains("/SIMUS_NPC/") || !assetPath.EndsWith(".fbx", StringComparison.OrdinalIgnoreCase)) return;
            var m = (ModelImporter)assetImporter;
            m.globalScale = 1f;
            m.useFileScale = true;
            m.isReadable = true;
            m.importCameras = false;
            m.importLights = false;
            m.importBlendShapes = false;
            m.optimizeGameObjects = false;
            m.materialImportMode = ModelImporterMaterialImportMode.None;
            m.meshCompression = ModelImporterMeshCompression.Off;
            m.animationType = assetPath.EndsWith("SIMUS_NPC_Characters.fbx") ? ModelImporterAnimationType.Generic : ModelImporterAnimationType.Human;
            if(m.animationType==ModelImporterAnimationType.Human)
            {
                var bones=new HashSet<string>(new[]{"Hips","Spine","Chest","Neck","Head","LeftShoulder","LeftUpperArm","LeftLowerArm","LeftHand","RightShoulder","RightUpperArm","RightLowerArm","RightHand","LeftUpperLeg","LeftLowerLeg","LeftFoot","LeftToes","RightUpperLeg","RightLowerLeg","RightFoot","RightToes"});
                var h=m.humanDescription;
                h.human=HumanTrait.BoneName.Where(n=>bones.Contains(n.Replace(" ",""))).Select(n=>new HumanBone { humanName=n,boneName=n.Replace(" ",""),limit=new HumanLimit { useDefaultValues=true } }).ToArray();
                h.hasTranslationDoF=true;h.armStretch=.05f;h.legStretch=.05f;h.upperArmTwist=.5f;h.lowerArmTwist=.5f;h.upperLegTwist=.5f;h.lowerLegTwist=.5f;
                m.humanDescription=h;
            }
            m.importAnimation = assetPath.EndsWith("SIMUS_NPC_Animations.fbx");
            m.animationCompression = ModelImporterAnimationCompression.Off;
        }
        void OnPreprocessAnimation()
        {
            if (!assetPath.EndsWith("SIMUS_NPC_Animations.fbx") || !assetPath.Contains("/SIMUS_NPC/")) return;
            var m=(ModelImporter)assetImporter;
            var clips=m.defaultClipAnimations;
            foreach(var c in clips)
            {
                c.name=c.takeName.Split('|').Last();
                c.loopTime=c.name!="Wave";
                c.loopPose=c.loopTime;
                c.lockRootRotation=true;c.lockRootHeightY=true;c.lockRootPositionXZ=true;
                c.keepOriginalOrientation=true;c.keepOriginalPositionY=true;c.keepOriginalPositionXZ=true;
            }
            m.clipAnimations=clips;
        }
    }

    public static class NPCBuild
    {
        const string Root="Assets/SIMUS_NPC";
        [Serializable] public class Item
        {
            public string name;
            public bool avatarValid, humanoid;
            public int[] triangles;
            public float height;
            public int skinnedRenderers;
            public string[] clips;
            public float maxRootDrift;
            public bool colorMasks, propertyBlock, sharedMaterial;
        }
        [Serializable] public class Report
        {
            public string unityVersion;
            public List<Item> items=new List<Item>();
            public string[] animationClips;
            public float[] durations;
            public bool shaderErrors;
            public string error="";
        }
        static void Require(bool test,string message) { if(!test) throw new Exception(message); }

        [MenuItem("SIMUS/Build and validate NPC library")]
        public static void ValidateAndBuild()
        {
            var report=new Report { unityVersion=Application.unityVersion };
            try
            {
                Directory.CreateDirectory(Root+"/Prefabs");Directory.CreateDirectory(Root+"/Materials");Directory.CreateDirectory(Root+"/Animation");
                AssetDatabase.Refresh();
                var shader=Shader.Find("SIMUS/NPCVertexMask");Require(shader!=null,"NPC shader missing");
                report.shaderErrors=ShaderUtil.ShaderHasError(shader);Require(!report.shaderErrors,"NPC shader failed to compile");
                var mat=AssetDatabase.LoadAssetAtPath<Material>(Root+"/Materials/MAT_NPC_SHARED.mat");
                if(!mat){mat=new Material(shader);AssetDatabase.CreateAsset(mat,Root+"/Materials/MAT_NPC_SHARED.mat");}
                mat.enableInstancing=true;
                var clips=AssetDatabase.LoadAllAssetsAtPath(Root+"/SIMUS_NPC_Animations.fbx").OfType<AnimationClip>().Where(c=>!c.name.StartsWith("__preview__")).OrderBy(c=>c.name).ToArray();
                report.animationClips=clips.Select(c=>c.name).ToArray();report.durations=clips.Select(c=>c.length).ToArray();
                Require(clips.Length==4,"Expected four animation clips: "+string.Join(",",report.animationClips));
                foreach(var clip in clips)Require(clip.humanMotion,"Clip is not Humanoid: "+clip.name);
                var controller=AssetDatabase.LoadAssetAtPath<AnimatorController>(Root+"/Animation/SIMUS_NPC.controller");
                if(!controller)
                {
                    controller=AnimatorController.CreateAnimatorControllerAtPath(Root+"/Animation/SIMUS_NPC.controller");
                    var states=new Dictionary<string,AnimatorState>();
                    foreach(var clip in clips){var state=controller.layers[0].stateMachine.AddState(clip.name);state.motion=clip;states[clip.name]=state;}
                    controller.layers[0].stateMachine.defaultState=states["Idle"];
                    var transition=states["Wave"].AddTransition(states["Idle"]);transition.hasExitTime=true;transition.exitTime=1f;transition.duration=.12f;
                }
                for(int i=1;i<=16;i++)
                {
                    string name=$"NPC_STYLE_{i:00}";string path=Root+"/Models/"+name+".fbx";
                    var model=AssetDatabase.LoadAssetAtPath<GameObject>(path);Require(model!=null,"Missing "+path);
                    var go=UnityEngine.Object.Instantiate(model);go.name=name;
                    var animator=go.GetComponent<Animator>()??go.AddComponent<Animator>();
                    var avatar=AssetDatabase.LoadAllAssetsAtPath(path).OfType<Avatar>().FirstOrDefault();
                    Require(avatar && avatar.isValid && avatar.isHuman,"Invalid Humanoid avatar "+name);
                    animator.avatar=avatar;animator.runtimeAnimatorController=controller;animator.applyRootMotion=false;animator.cullingMode=AnimatorCullingMode.CullUpdateTransforms;
                    Require(animator.GetBoneTransform(HumanBodyBones.Chest)!=null,"Chest mapping missing "+name);
                    var renderers=go.GetComponentsInChildren<SkinnedMeshRenderer>(true).OrderBy(r=>r.name).ToArray();
                    Require(renderers.Length==3,"Expected three LOD renderers "+name);
                    var lods=new LOD[3];var tri=new int[3];bool masks=true;
                    for(int l=0;l<3;l++)
                    {
                        var r=renderers.Single(x=>x.name.EndsWith("_LOD"+l));r.sharedMaterial=mat;r.updateWhenOffscreen=false;
                        lods[l]=new LOD(new[]{.6f,.25f,.05f}[l],new Renderer[]{r});tri[l]=r.sharedMesh.triangles.Length/3;
                        var colors=r.sharedMesh.colors32;masks &= colors.Length==r.sharedMesh.vertexCount && colors.Any(c=>c.b==255) && colors.Any(c=>c.a==255) && colors.Any(c=>c.r==255);
                    }
                    var group=go.GetComponent<LODGroup>()??go.AddComponent<LODGroup>();group.SetLODs(lods);group.RecalculateBounds();
                    var cap=go.AddComponent<CapsuleCollider>();cap.height=1.65f;cap.radius=.27f;cap.center=new Vector3(0,.825f,0);
                    var agent=go.AddComponent<NavMeshAgent>();agent.height=1.65f;agent.radius=.27f;agent.baseOffset=0;agent.enabled=false;
                    // Enable the agent after placing the NPC on a baked NavMesh.
                    var data=go.AddComponent<SimusNPCData>();data.data.appearanceId=i;
                    var appearance=go.AddComponent<SimusNPCAppearance>();appearance.Apply();
                    var socket=new GameObject("DepartmentBadgeSocket");socket.transform.SetParent(go.transform,false);socket.transform.localPosition=new Vector3(0,1.82f,0);
                    var block=new MaterialPropertyBlock();renderers[0].GetPropertyBlock(block);
                    bool mpb=block.GetColor("_PrimaryColor")==appearance.primaryColor;
                    Require(masks && mpb,"Mask/property block failure "+name);
                    float drift=0;var original=go.transform.position;
                    foreach(var clip in clips)
                    {
                        var graph=PlayableGraph.Create("NPCValidation");graph.SetTimeUpdateMode(DirectorUpdateMode.Manual);
                        var playable=AnimationClipPlayable.Create(graph,clip);var output=AnimationPlayableOutput.Create(graph,"NPC",animator);output.SetSourcePlayable(playable);graph.Play();
                        foreach(float fraction in new[]{0f,.25f,.5f,.75f,.999f})
                        {
                            playable.SetTime(clip.length*fraction);graph.Evaluate(0);
                            drift=Mathf.Max(drift,Vector3.Distance(original,go.transform.position));
                            var baked=new Mesh();renderers[0].BakeMesh(baked);
                            Require(baked.vertexCount>0 && baked.vertices.All(v=>!float.IsNaN(v.x)&&!float.IsInfinity(v.y)),"Invalid skin deformation "+name);
                            Require(baked.bounds.size.magnitude<5f,"Exploded skin "+name);UnityEngine.Object.DestroyImmediate(baked);
                        }
                        graph.Destroy();
                    }
                    animator.Rebind();animator.Update(0);group.ForceLOD(-1);
                    var bounds=renderers.Single(r=>r.name.EndsWith("_LOD0")).bounds;
                    report.items.Add(new Item{name=name,avatarValid=avatar.isValid,humanoid=avatar.isHuman,triangles=tri,height=bounds.size.y,skinnedRenderers=3,clips=report.animationClips,maxRootDrift=drift,colorMasks=masks,propertyBlock=mpb,sharedMaterial=renderers.All(r=>r.sharedMaterial==mat)});
                    PrefabUtility.SaveAsPrefabAsset(go,Root+"/Prefabs/"+name+".prefab");UnityEngine.Object.DestroyImmediate(go);
                }
                AssetDatabase.SaveAssets();
            }
            catch(Exception e){report.error=e.ToString();Debug.LogException(e);}
            File.WriteAllText("NPC_Unity_Validation.json",JsonUtility.ToJson(report,true));
            if(!string.IsNullOrEmpty(report.error))throw new Exception(report.error);
            Debug.Log("SIMUS_NPC_VALIDATION_PASSED: "+report.items.Count+" appearances");
        }
    }
}
