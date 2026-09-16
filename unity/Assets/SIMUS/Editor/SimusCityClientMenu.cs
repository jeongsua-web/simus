#if UNITY_EDITOR
using Simus.City;
using UnityEditor;
using UnityEngine;

public static class SimusCityClientMenu
{
    [MenuItem("SIMUS/Create City Client")]
    private static void Create()
    {
        var root = new GameObject("SIMUS City Client");
        var poller = root.AddComponent<CityStatePoller>();
        root.AddComponent<CityVisualization>().SetPoller(poller);
        Undo.RegisterCreatedObjectUndo(root, "Create SIMUS City Client");
        Selection.activeGameObject = root;
    }

    [MenuItem("SIMUS/Create Preview City")]
    private static void CreatePreview()
    {
        var root = new GameObject("SIMUS Preview City");
        var visualization = root.AddComponent<CityVisualization>();
        Undo.RecordObject(visualization, "Enable SIMUS Preview");
        visualization.EnablePreview();
        EditorUtility.SetDirty(visualization);
        Undo.RegisterCreatedObjectUndo(root, "Create SIMUS Preview City");
        Selection.activeGameObject = root;
    }
}
#endif
