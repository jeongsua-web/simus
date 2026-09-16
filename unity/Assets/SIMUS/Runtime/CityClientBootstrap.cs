using UnityEngine;

namespace Simus.City
{
    public static class CityClientBootstrap
    {
        // Makes the minimum client runnable in an empty scene; no scene asset tied to an unknown Editor version.
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Start()
        {
            if (Object.FindObjectOfType<CityStatePoller>() != null) return;
            var root = new GameObject("SIMUS City Client");
            Object.DontDestroyOnLoad(root);
            var poller = root.AddComponent<CityStatePoller>();
            root.AddComponent<CityStateDebugView>().SetPoller(poller);
        }
    }
}
