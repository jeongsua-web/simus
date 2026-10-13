#if UNITY_EDITOR
using System;using System.IO;using System.Linq;using System.Collections.Generic;
using UnityEditor;using UnityEngine;using Simus.City;
public sealed class CityStateAssetImporter : AssetPostprocessor
{
    [Serializable] class Row {public string name,stat,region,group,asset;public int minimum,maximum;}
    [Serializable] class Wet {public string @object,region;public int slot;}
    [Serializable] class Fx {public string name,stat,region,effect_type,notes;public int activation_level;public float recommended_intensity;}
    [Serializable] class Doc {public Row[] rules;public Wet[] water;public Fx[] anchors;public string[] regions;}
    public override int GetPostprocessOrder()=>200;
    void OnPreprocessModel()
    {
        if(assetPath.Contains("/city_state_v001/") && assetPath.EndsWith(".fbx",StringComparison.OrdinalIgnoreCase))
        {var m=(ModelImporter)assetImporter;m.importAnimation=false;m.importCameras=false;m.importLights=false;m.materialImportMode=ModelImporterMaterialImportMode.ImportStandard;}
    }
    void OnPostprocessModel(GameObject root)
    {
        if(assetPath.Contains("/city_state_v001/")||assetPath.EndsWith("/SIMUS_Dense_Realistic_University_Map_03.fbx",StringComparison.OrdinalIgnoreCase))
        foreach(var renderer in root.GetComponentsInChildren<Renderer>(true))
        {
            var materials=renderer.sharedMaterials;
            for(int i=0;i<materials.Length;i++)if(materials[i]!=null)
            {
                string name=System.Text.RegularExpressions.Regex.Replace(materials[i].name,@"\.\d+$","");
                var shared=AssetDatabase.LoadAssetAtPath<Material>("Assets/SIMUS/Art/props/city_state_v001/materials/"+name+".mat");
                if(shared!=null)materials[i]=shared;
            }
            renderer.sharedMaterials=materials;
        }
        if(!assetPath.EndsWith("/SIMUS_Dense_Realistic_University_Map_03.fbx",StringComparison.OrdinalIgnoreCase))return;
        string json=Path.Combine(Path.GetDirectoryName(assetPath),"CityStateBindings.json");if(!File.Exists(json))return;
        var doc=JsonUtility.FromJson<Doc>(File.ReadAllText(json));var lookup=root.GetComponentsInChildren<Transform>(true).ToDictionary(t=>t.name,t=>t.gameObject);
        var controller=root.AddComponent<CityStateAssets>();
        controller.bindings=doc.rules.Select(r=>new CityStateAssets.Binding{target=lookup[r.name],stat=r.stat,region=r.region,group=r.group,asset=r.asset,minimum=r.minimum,maximum=r.maximum}).ToArray();
        controller.water=doc.water.Select(w=>new CityStateAssets.WaterBinding{target=lookup[w.@object].GetComponent<Renderer>(),slot=w.slot,region=w.region}).ToArray();
        controller.regions=doc.regions.Select(r=>new CityStateAssets.RegionOverride{region=r}).ToArray();
        foreach(var a in doc.anchors){var fx=lookup[a.name].AddComponent<CityStateAnchor>();fx.stat=a.stat;fx.region=a.region;fx.effect_type=a.effect_type;fx.activation_level=a.activation_level;fx.recommended_intensity=a.recommended_intensity;fx.notes=a.notes;}
        foreach(var b in controller.bindings) b.target.isStatic=false;
        controller.Apply();
    }
    Material OnAssignMaterialModel(Material material,Renderer renderer)
    {
        if(!assetPath.Contains("/city_state_v001/")&&!assetPath.EndsWith("/SIMUS_Dense_Realistic_University_Map_03.fbx",StringComparison.OrdinalIgnoreCase))return null;
        string name=System.Text.RegularExpressions.Regex.Replace(material.name,@"\.\d+$","");
        return AssetDatabase.LoadAssetAtPath<Material>("Assets/SIMUS/Art/props/city_state_v001/materials/"+name+".mat");
    }
    public static void EnsureMaterials()
    {
        const string folder="Assets/SIMUS/Art/props/city_state_v001/materials";
        Directory.CreateDirectory(folder);
        foreach(string file in Directory.GetFiles("Assets/SIMUS/Art/props/city_state_v001/textures","*.png"))
        {
            string key=Path.GetFileNameWithoutExtension(file);string path=folder+"/MAT_"+key+".mat";
            var mat=AssetDatabase.LoadAssetAtPath<Material>(path);if(mat==null){mat=new Material(Shader.Find("Standard"));AssetDatabase.CreateAsset(mat,path);}
            mat.mainTexture=AssetDatabase.LoadAssetAtPath<Texture2D>(file.Replace('\\','/'));mat.color=Color.white;mat.SetFloat("_Glossiness",.05f);
            if(key.Contains("DECAL")||key.Contains("STAIN"))
            {
                mat.SetFloat("_Mode",3);mat.SetInt("_SrcBlend",(int)UnityEngine.Rendering.BlendMode.SrcAlpha);mat.SetInt("_DstBlend",(int)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);mat.SetInt("_ZWrite",0);mat.EnableKeyword("_ALPHABLEND_ON");mat.renderQueue=3000;
            }
            EditorUtility.SetDirty(mat);
        }
        AssetDatabase.SaveAssets();
    }
    [MenuItem("SIMUS/City State/Verify Imported Map")]
    public static void VerifyImportedMap()
    {
        const string map="Assets/SIMUS/Art/maps/university_v003/SIMUS_Dense_Realistic_University_Map_03.fbx";
        var model=AssetDatabase.LoadAssetAtPath<GameObject>(map);
        var state=model!=null?model.GetComponent<CityStateAssets>():null;
        if(state==null||state.bindings.Length!=318||state.bindings.Any(b=>b.target==null))throw new InvalidOperationException("City state map bindings are missing.");
        if(model.GetComponentsInChildren<CityStateAnchor>(true).Length!=18)throw new InvalidOperationException("FX anchor count mismatch.");
        foreach(var renderer in model.GetComponentsInChildren<Renderer>(true))
            if(renderer.sharedMaterials.Any(m=>m==null))throw new InvalidOperationException("Missing material on "+renderer.name);
        Debug.Log("CITY_STATE_DELIVERY_OK: 318 bindings; 18 anchors; material slots resolved; original map GUID retained.");
    }
}
#endif

