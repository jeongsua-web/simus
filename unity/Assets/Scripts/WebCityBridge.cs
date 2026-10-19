using System;
using System.Collections;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using Newtonsoft.Json.Linq;
using Simus.City;
using UnityEngine;
using UnityEngine.Networking;

namespace Simus
{
    public sealed class WebCityBridge : MonoBehaviour
    {
        public const string TestMapVersion = "test-only-bridge-v1";
        public string mapVersion = TestMapVersion;
        public CityPreviewCamera followCamera;
        [Tooltip("Test-only map display: validate bindings but never spawn, move or poll NPCs.")]
        public bool mapDisplayOnly;
        public CityStateStore City { get; } = new CityStateStore();
        private WebBridgeState state;
        private readonly Dictionary<string, GameObject> actors = new Dictionary<string, GameObject>();
        private readonly Dictionary<string, string> actorCharacters = new Dictionary<string, string>();
        private NpcCrowdSnapshot crowd;
        private Coroutine polling;
        private UnityWebRequest request;
        private bool disposed, visible = true;
        [Tooltip("Configured animated SIMUS character template; kept inactive in the scene.")]
        public GameObject npcTemplate;
#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")] private static extern void SimusBridgeEmit(string json);
#endif
        private void Start()
        {
            gameObject.name = "SIMUS Web Bridge";
            state = new WebBridgeState(mapVersion);
            Application.targetFrameRate = 30;
            Emit(new JObject { ["type"] = "READY", ["map_version"] = mapVersion });
        }
        public void Receive(string json)
        {
            if (disposed) return;
            try
            {
                var bound = state.Apply(json, Time.realtimeSinceStartupAsDouble);
                if (mapDisplayOnly)
                {
                    if (bound) Emit(new JObject { ["type"] = "BOUND", ["session_id"] = state.SessionId, ["npc_id"] = state.OwnNpcId });
                    return;
                }
                var own = GetActor(state.OwnNpcId, true, state.Own.Npcs[0].CharacterId, state.Own.Npcs[0].GlassesId);
                MoveActor(own, state.Own.Npcs[0].PositionAt(state.Own.MotionTime(Time.realtimeSinceStartupAsDouble)));
                if (followCamera == null) throw new InvalidOperationException("CAMERA_MISSING");
                if (followCamera.followTarget != own.transform) followCamera.SetFollowTarget(own.transform);
                if (visible && polling == null) polling = StartCoroutine(Poll());
                if (bound) Emit(new JObject { ["type"] = "BOUND", ["session_id"] = state.SessionId, ["npc_id"] = state.OwnNpcId });
            }
            catch (Exception) { Fail("INVALID_BINDING_OR_SNAPSHOT"); }
        }
        private GameObject GetActor(string id, bool own, string characterId, string glassesId)
        {
            if (actors.TryGetValue(id, out var actor))
            {
                if (actorCharacters[id] != characterId + ":" + glassesId)
                {
                    CitizenCharacterAppearance.Apply(actor, characterId, glassesId);
                    actorCharacters[id] = characterId + ":" + glassesId;
                }
                return actor;
            }
            if (npcTemplate == null) throw new InvalidOperationException("NPC_CHARACTER_MISSING");
            actor = Instantiate(npcTemplate, transform);
            actor.name = own ? "Own NPC - SIMUS Character" : "Public NPC - SIMUS Character";
            CitizenCharacterAppearance.Apply(actor, characterId, glassesId);
            actor.SetActive(true);
            if (actor.GetComponent<NpcGrounding>() == null) actor.AddComponent<NpcGrounding>();
            foreach (var collider in actor.GetComponentsInChildren<Collider>()) Destroy(collider);
            actors.Add(id, actor);
            actorCharacters.Add(id, characterId + ":" + glassesId);
            return actor;
        }
        private void Update()
        {
            if (mapDisplayOnly || disposed || !visible || state?.Own == null) return;
            var now = Time.realtimeSinceStartupAsDouble;
            MoveActor(actors[state.OwnNpcId], state.Own.Npcs[0].PositionAt(state.Own.MotionTime(now)));
            if (crowd == null) return;
            foreach (var npc in crowd.Npcs)
                if (npc.Id != state.OwnNpcId) MoveActor(GetActor(npc.Id, false, npc.CharacterId, npc.GlassesId), npc.PositionAt(Math.Min(state.Own.FreezeAtMs, crowd.MotionTime(now))));
        }
        private static void MoveActor(GameObject actor, Vector3 position)
        {
            var direction = position - actor.transform.position;
            direction.y = 0;
            var moving = direction.sqrMagnitude > 0.000001f;
            if (moving) actor.transform.rotation = Quaternion.LookRotation(direction);
            actor.transform.position = actor.GetComponent<NpcGrounding>().Project(position);
            foreach (var animator in actor.GetComponentsInChildren<Animator>()) animator.speed = moving ? 1f : 0f;
        }
        private IEnumerator Poll()
        {
            while (!disposed && visible)
            {
                yield return Fetch("/api/sessions/" + state.SessionId + "/npcs", false);
                yield return Fetch("/api/city-state", true);
                yield return new WaitForSecondsRealtime(2.5f);
            }
        }
        private IEnumerator Fetch(string path, bool city)
        {
            if (disposed || !visible) yield break;
            var origin = new Uri(Application.absoluteURL).GetLeftPart(UriPartial.Authority);
            request = UnityWebRequest.Get(origin + path);
            var active = request;
            var started = Time.realtimeSinceStartupAsDouble;
            active.timeout = 8;
            yield return active.SendWebRequest();
            if (!disposed && visible && active.result == UnityWebRequest.Result.Success)
            {
                try
                {
                    if (city)
                    {
                        var next = CityStateJson.Parse(active.downloadHandler.text);
                        // Latest-session city API must never replace the bound session.
                        if (next.CityState?.SessionId == state.SessionId)
                        {
                            City.Apply(next, Time.realtimeSinceStartupAsDouble, out _);
                            if (Camera.main != null) Camera.main.backgroundColor = Color.Lerp(new Color(.2f,.25f,.3f), new Color(.45f,.7f,.8f), (float)City.Current.Cleanliness / 100f);
                        }
                    }
                    else
                    {
                        var root = Newtonsoft.Json.JsonConvert.DeserializeObject<JObject>(active.downloadHandler.text, new Newtonsoft.Json.JsonSerializerSettings { DateParseHandling = Newtonsoft.Json.DateParseHandling.None });
                        var next = state.ParseSnapshot(root, state.SessionId, (started + Time.realtimeSinceStartupAsDouble) / 2);
                        if (crowd == null || next.ServerTimeMs > crowd.ServerTimeMs)
                        {
                            crowd = next;
                            var keep = new HashSet<string> { state.OwnNpcId };
                            foreach (var npc in crowd.Npcs) keep.Add(npc.Id);
                            foreach (var id in new List<string>(actors.Keys))
                                if (!keep.Contains(id)) { Destroy(actors[id]); actors.Remove(id); actorCharacters.Remove(id); }
                        }
                    }
                }
                catch (Exception) { Debug.LogWarning("SIMUS public snapshot rejected; retaining last state."); }
            }
            active.Dispose();
            if (ReferenceEquals(request, active)) request = null;
        }
        public void SetVisibility(string value)
        {
            if (disposed) return;
            visible = value == "true";
            Application.targetFrameRate = visible ? 30 : 1;
            if (followCamera != null) followCamera.GetComponent<Camera>().enabled = visible;
            StopPolling();
            if (!mapDisplayOnly && visible && state?.Own != null) polling = StartCoroutine(Poll());
        }
        private void StopPolling()
        {
            if (request != null) { request.Abort(); request.Dispose(); request = null; }
            if (polling != null) StopCoroutine(polling);
            polling = null;
        }
        public void DisposeBridge()
        {
            if (disposed) return;
            disposed = true; StopPolling(); City.Pause();
            if (followCamera != null) followCamera.SetFollowTarget(null);
            foreach (var actor in actors.Values) Destroy(actor);
            actors.Clear(); actorCharacters.Clear();

        }
        private void OnDestroy() { DisposeBridge(); }
        private void Fail(string code) { Emit(new JObject { ["type"] = "ERROR", ["code"] = code }); DisposeBridge(); }
        private void Emit(JObject message)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            SimusBridgeEmit(message.ToString(Newtonsoft.Json.Formatting.None));
#else
            Debug.Log(message.ToString(Newtonsoft.Json.Formatting.None));
#endif
        }
    }
}
