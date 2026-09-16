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
        root.AddComponent<CityStateDebugView>().SetPoller(poller);
        Undo.RegisterCreatedObjectUndo(root, "Create SIMUS City Client");
        Selection.activeGameObject = root;
    }
}
#endif
