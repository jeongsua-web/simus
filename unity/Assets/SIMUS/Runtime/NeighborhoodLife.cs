using System.Collections.Generic;
using UnityEngine;

namespace Simus.City
{
    // Renders configured server routes. The optional local path is a prototype preview only.
    public class NeighborhoodLife : MonoBehaviour
    {
        public CityStatePoller client;
        public NpcCrowdPoller npcClient;
        public Vector3[] path;
        public float speed = 2f;
        public bool enablePrototypePreview;
        [Tooltip("Optional visual prefab; motion is controlled by the server route.")]
        public GameObject npcPrefab;
        [Min(0.01f)] public float correctionSmoothTime = 0.15f;
        [Min(0.1f)] public float teleportDistance = 8f;
        [Min(0f)] public float turnSpeed = 360f;
        [Tooltip("Prototype temporary visual thresholds")]
        public float pollutionThreshold = 25, lowCleanlinessThreshold = 35, lowSafetyThreshold = 35, highHappinessThreshold = 65;
        public Transform[] previewNpcs;
        public Renderer moodBeacon, cleanlinessBeacon, safetyBeacon;
        readonly Dictionary<string, Transform> liveNpcs = new Dictionary<string, Transform>();
        readonly Dictionary<string, Vector3> velocities = new Dictionary<string, Vector3>();
        float elapsed;
        string round = "";
        public float Elapsed => elapsed;

        void Awake()
        {
            if (npcClient == null) npcClient = GetComponent<NpcCrowdPoller>();
            if (npcClient == null) npcClient = gameObject.AddComponent<NpcCrowdPoller>();
            npcClient.city = client;
        }

        public Transform FindNpc(string npcId) => !string.IsNullOrEmpty(npcId) &&
            liveNpcs.TryGetValue(npcId, out var npc) ? npc : null;

        void Update()
        {
            var state = client != null ? client.Store.Current : null;
            if (state == null) { ClearNpcs(); SetPreviews(false); return; }
            if (round != state.SessionId) { ClearNpcs(); round = state.SessionId; elapsed = 0; }
            var connected = client.Store.Connection == CityConnection.Connected;
            if (connected && state.Status != "FINALIZED" && state.Status != "CLOSING") elapsed += Time.deltaTime;
            RenderNpcs(state.SessionId, connected);
            RenderSettings.fog = (float)(state.OverallPollution ?? 0) >= pollutionThreshold;
            RenderSettings.fogMode = FogMode.Exponential;
            RenderSettings.fogDensity = .001f + (float)(state.OverallPollution ?? 0) * .00004f;
            RenderSettings.fogColor = new Color(.48f, .47f, .42f);
            Set(moodBeacon, state.Happiness >= highHappinessThreshold ? Color.green : Color.gray);
            Set(cleanlinessBeacon, state.Cleanliness < lowCleanlinessThreshold ? new Color(.6f, .3f, .08f) : Color.cyan);
            Set(safetyBeacon, state.Safety < lowSafetyThreshold ? Color.red : Color.blue);
        }

        void SetPreviews(bool visible)
        {
            if (previewNpcs == null) return;
            for (var i = 0; i < previewNpcs.Length; i++)
                if (previewNpcs[i] != null)
                {
                    previewNpcs[i].gameObject.SetActive(visible);
                    if (visible) previewNpcs[i].position = PositionAt(elapsed + i * 7);
                }
        }

        void RenderNpcs(string sessionId, bool connected)
        {
            var crowd = npcClient != null ? npcClient.Current : null;
            var hasLive = crowd != null && crowd.SessionId == sessionId && crowd.MapVersion == npcClient.mapVersion;
            SetPreviews(!hasLive && enablePrototypePreview && connected);
            if (!hasLive) { ClearNpcs(); return; }
            // Retain the last rendered pose during network interruption rather than extrapolating forever.
            if (!connected || !npcClient.HasFreshSnapshot) return;
            var seen = new HashSet<string>();
            var at = crowd.MotionTime(Time.realtimeSinceStartupAsDouble);
            foreach (var npc in crowd.Npcs)
            {
                seen.Add(npc.Id);
                var destination = npc.PositionAt(at);
                var created = !liveNpcs.TryGetValue(npc.Id, out var avatar) || avatar == null;
                if (created)
                {
                    var instance = npcPrefab != null ? Instantiate(npcPrefab, transform) : GameObject.CreatePrimitive(PrimitiveType.Capsule);
                    instance.name = "Participant NPC " + npc.Id;
                    instance.transform.SetParent(transform);
                    if (npcPrefab == null)
                    {
                        instance.transform.localScale = new Vector3(.55f, .8f, .55f);
                        var collider = instance.GetComponent<Collider>();
                        if (collider != null) Destroy(collider);
                    }
                    avatar = instance.transform;
                    liveNpcs[npc.Id] = avatar;
                    velocities[npc.Id] = Vector3.zero;
                }
                var velocity = velocities[npc.Id];
                if (created || Vector3.Distance(avatar.position, destination) > teleportDistance || at >= crowd.FreezeAtMs)
                { avatar.position = destination; velocity = Vector3.zero; }
                else avatar.position = Vector3.SmoothDamp(avatar.position, destination, ref velocity,
                    Mathf.Max(.01f, correctionSmoothTime), Mathf.Infinity, Time.unscaledDeltaTime);
                velocities[npc.Id] = velocity;
                var direction = npc.PositionAt(System.Math.Min(at + 20, crowd.FreezeAtMs)) - destination;
                direction.y = 0;
                if (direction.sqrMagnitude > .000001f)
                    avatar.rotation = Quaternion.RotateTowards(avatar.rotation, Quaternion.LookRotation(direction),
                        Mathf.Max(0, turnSpeed) * Time.unscaledDeltaTime);
            }
            var removed = new List<string>();
            foreach (var pair in liveNpcs)
                if (!seen.Contains(pair.Key)) { if (pair.Value != null) Destroy(pair.Value.gameObject); removed.Add(pair.Key); }
            foreach (var id in removed) { liveNpcs.Remove(id); velocities.Remove(id); }
        }

        void ClearNpcs()
        {
            foreach (var avatar in liveNpcs.Values) if (avatar != null) Destroy(avatar.gameObject);
            liveNpcs.Clear(); velocities.Clear();
        }
        void OnDisable() { ClearNpcs(); SetPreviews(false); }
        void Set(Renderer renderer, Color color) { if (renderer != null) renderer.material.color = color; }

        public Vector3 PositionAt(float seconds)
        {
            if (path == null || path.Length < 2) return Vector3.zero;
            var route = new NpcMotion { Points = path, Speed = Mathf.Max(0, speed), Loop = true };
            route.Prepare();
            return route.PositionAt(seconds * 1000d);
        }
        void OnDrawGizmos()
        {
            if (!enablePrototypePreview || path == null || path.Length < 2) return;
            Gizmos.color = Color.yellow;
            for (var i = 0; i < path.Length; i++) Gizmos.DrawLine(path[i], path[(i + 1) % path.Length]);
        }
    }
}
