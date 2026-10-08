// Copy into Assets/Editor before importing the FBX. This helper has not been run in Unity.
#if UNITY_EDITOR
using System;
using UnityEditor;
using UnityEngine;

public sealed class SIMUSDenseMap03Importer : AssetPostprocessor
{
    void OnPostprocessModel(GameObject root)
    {
        if (!assetPath.EndsWith("/SIMUS_Dense_Realistic_University_Map_03.fbx", StringComparison.OrdinalIgnoreCase))
            return;

        foreach (MeshFilter filter in root.GetComponentsInChildren<MeshFilter>(true))
        {
            Mesh mesh = filter.sharedMesh;
            if (mesh == null) continue;
            GameObject go = filter.gameObject;
            go.isStatic = true;
            bool obstacle = go.name.StartsWith("D03_UNITY_D03_COL_", StringComparison.Ordinal);
            bool walking = IsWalkingSurface(go.transform) || go.name.Contains("D03_ROAD_") || go.name.Contains("D03_ENTRY_STEP_") || go.name.Contains("D03_DRIVE_");

            if (obstacle)
            {
                Renderer renderer = go.GetComponent<Renderer>();
                if (renderer != null) renderer.enabled = false;
                if (mesh.vertexCount == 8)
                {
                    BoxCollider box = go.AddComponent<BoxCollider>();
                    box.center = mesh.bounds.center;
                    box.size = mesh.bounds.size;
                }
                else
                {
                    MeshCollider collider = go.AddComponent<MeshCollider>();
                    collider.sharedMesh = mesh;
                    collider.convex = false;
                }
            }
            else if (walking)
            {
                MeshCollider collider = go.AddComponent<MeshCollider>();
                collider.sharedMesh = mesh;
                collider.convex = false;
            }
        }
    }

    static bool IsWalkingSurface(Transform t)
    {
        string n = t.name;
        if (n.Contains("D03_CITY_GROUND") || n.Contains("CAMPUS__Campus_surface") || n.Contains("CAMPUS__Road_") || n.Contains("CAMPUS__Walk_") ||
            n.StartsWith("D03_UNITY_D03_PARK_", StringComparison.Ordinal)) return true;
        for (Transform p = t.parent; p != null; p = p.parent)
        {
            if (p.name == "D03_UNITY_GROUP_MAIN_ROADS" ||
                p.name == "D03_UNITY_GROUP_SECONDARY_ROADS" ||
                p.name == "D03_UNITY_GROUP_LOCAL_STREETS" || p.name == "D03_UNITY_GROUP_SERVICE_ALLEYS" || p.name == "D03_UNITY_GROUP_PEDESTRIAN_ALLEYS" ||
                p.name == "D03_UNITY_GROUP_SIDEWALKS" ||
                p.name == "D03_UNITY_GROUP_PARKING") return true;
        }
        return false;
    }
}
#endif


