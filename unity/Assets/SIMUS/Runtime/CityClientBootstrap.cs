using UnityEngine;

namespace Simus.City
{
    public static class CityClientBootstrap
    {
        // Makes the minimum client runnable in an empty scene; no scene asset tied to an unknown Editor version.
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Start()
        {
            // The imported Neighborhood scene has its own map and preview camera.
            var sceneName = UnityEngine.SceneManagement.SceneManager.GetActiveScene().name;
            if (sceneName == "simus_bridge_test") return;
            if (sceneName == "Neighborhood" || sceneName == "CompletedMapNpcFollow") return;
            if (Object.FindObjectOfType<CityStatePoller>() != null ||
                Object.FindObjectOfType<CityVisualization>() != null) return;
            var root = new GameObject("SIMUS City Client");
            Object.DontDestroyOnLoad(root);
            var poller = root.AddComponent<CityStatePoller>();
            root.AddComponent<CityVisualization>().SetPoller(poller);
        }
    }
}
