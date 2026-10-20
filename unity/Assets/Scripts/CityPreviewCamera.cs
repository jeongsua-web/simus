using UnityEngine;

namespace Simus
{
    [RequireComponent(typeof(Camera))]
    public sealed class CityPreviewCamera : MonoBehaviour
    {
        public bool previewControls = true;
        public Vector3 target = Vector3.zero;
        public float overviewSize = 132f;
        public Vector3 overviewTarget = Vector3.zero;
        public float topViewSize = 112f;
        [Min(1f)] public float maximumZoom = 170f;
        public bool clampPanToBounds;
        public Vector2 panMinimum;
        public Vector2 panMaximum;
        public bool IsFollowing => followEnabled && activeTarget != null;
        public string previewSubtitle = "STAGE 02    |    200 x 200 m";
        [Header("NPC follow")]
        public Transform followTarget;
        [Tooltip("Optional full participant NPC ID. Takes precedence over Follow Target.")]
        public string followNpcId;
        public Simus.City.NeighborhoodLife npcSource;
        [Min(0.01f)] public float followSmoothTime = 0.25f;
        [Tooltip("Opt-in easing for target acquisition, view rotation and zoom; existing scenes retain instant acquisition.")]
        public bool smoothFollowTransitions;
        [Min(.05f)] public float acquisitionSmoothTime = .6f;
        [Min(1f)] public float acquisitionPanSpeed = 40f;
        [Min(1f)] public float acquisitionAngularSpeed = 20f;
        [Min(1f)] public float acquisitionZoomSpeed = 120f;
        public bool IsTransitioning => smoothFollowTransitions && followEnabled && (acquiring || (view != null && (Quaternion.Angle(transform.rotation,Quaternion.Euler(pitch,yaw,0))>.001f || Mathf.Abs(view.orthographicSize-size)>.001f)));
        private bool acquiring;
        private float zoomVelocity;
        private double lastFollowPoseTime;
        private float followPoseDelta;
        [Min(1f)] public float followSize = 18f;
        public float followPitch = 28.85f;
        public float followYaw = -131.64f;
        public Shader occlusionShader;
        public Transform occlusionRoot;
        [Tooltip("Scene opt-in: smoothly reveal road context through tall nearby buildings.")]
        public bool contextBuildingFade;
        public float contextFadeRadius = 14f;
        [Range(0,1)] public float contextBuildingVisibility = .12f;
        [Min(0.1f)] public float revealRadius = 3.5f;
        private NpcOcclusionReveal reveal;
        public Vector3 followOffset = new Vector3(0f, 1f, 0f);
        private Vector3 followVelocity;
        private Transform activeTarget;
        private bool followEnabled = true;
        private Camera view;
        private float yaw = -36f;
        private float pitch = 55f;
        private float size;
        public float FollowZoom { get; private set; } = 1f;

        public void SetFollowZoom(float zoom)
        {
            if (float.IsNaN(zoom) || float.IsInfinity(zoom)) return;
            FollowZoom = Mathf.Clamp(zoom, .5f, 4f);
            if (followEnabled) size = Mathf.Max(1f, followSize / FollowZoom);
        }
        private GUIStyle titleStyle;
        private GUIStyle noteStyle;

        private void Awake()
        {
            view = GetComponent<Camera>();
            view.orthographic = true;
            Overview();
        }

        private void Start()
        {
            if (occlusionShader != null)
            {
                reveal = gameObject.AddComponent<NpcOcclusionReveal>();
                reveal.Initialize(occlusionShader, occlusionRoot);
                reveal.contextFadeEnabled=contextBuildingFade; reveal.contextRadius=contextFadeRadius; reveal.contextVisibility=contextBuildingVisibility;
            }
            Follow();
        }

        public void SetFollowTarget(Transform npc)
        {
            followNpcId = "";
            followTarget = npc;
            Follow();
        }

        public void SetFollowNpcId(string npcId)
        {
            followNpcId = npcId;
            followTarget = null;
            Follow();
        }

        public void Follow()
        {
            followEnabled = true;
            pitch = followPitch;
            yaw = followYaw;
            size = Mathf.Max(1f, followSize / FollowZoom);
            if(smoothFollowTransitions){target=transform.position+transform.forward*360f;zoomVelocity=0;lastFollowPoseTime=Time.realtimeSinceStartupAsDouble;followPoseDelta=0;}
            activeTarget = null;
            acquiring = smoothFollowTransitions;
            followVelocity = Vector3.zero;
        }

        public void Overview()
        {
            followEnabled = false;
            target = overviewTarget;
            yaw = -36f;
            pitch = 55f;
            size = overviewSize;
            ApplyPose();
        }

        public void TopView()
        {
            followEnabled = false;
            target = overviewTarget;
            yaw = 0f;
            pitch = 90f;
            size = topViewSize;
            ApplyPose();
        }

        private void Update()
        {
            if (!previewControls) return;
            if (Input.GetKeyDown(KeyCode.Alpha1) || Input.GetKeyDown(KeyCode.R)) Overview();
            if (Input.GetKeyDown(KeyCode.Alpha2)) TopView();
            if (Input.GetKeyDown(KeyCode.F)) Follow();
            // Keep the header buttons from also dragging the camera.
            if (Input.mousePosition.y < Screen.height - (Screen.width < 620 ? 172 : 95))
            {
                if (Input.GetMouseButton(0))
                {
                    yaw += Input.GetAxis("Mouse X") * 3f;
                    pitch = Mathf.Clamp(pitch - Input.GetAxis("Mouse Y") * 3f, 20f, 90f);
                }
                if (Input.GetMouseButton(1) || Input.GetMouseButton(2))
                {
                    followEnabled = false;
                    Vector3 right = transform.right;
                    Vector3 forward = Vector3.Cross(right, Vector3.up).normalized;
                    target -= (right * Input.GetAxis("Mouse X") + forward * Input.GetAxis("Mouse Y")) * size * 0.02f;
                    if (clampPanToBounds)
                    {
                        target.x = Mathf.Clamp(target.x, panMinimum.x, panMaximum.x);
                        target.z = Mathf.Clamp(target.z, panMinimum.y, panMaximum.y);
                    }
                }
                size = Mathf.Clamp(size * (1f - Input.mouseScrollDelta.y * 0.07f), 1f, Mathf.Max(1f, maximumZoom));
            }
        }

        private void LateUpdate()
        {
            if(smoothFollowTransitions && followEnabled)
            {
                double now=Time.realtimeSinceStartupAsDouble;
                followPoseDelta=(float)System.Math.Min(1.0/30.0,System.Math.Max(0,now-lastFollowPoseTime));
                lastFollowPoseTime=now;
            }
            if (followEnabled)
            {
                Transform next = followTarget;
                if (!string.IsNullOrWhiteSpace(followNpcId))
                {
                    if (npcSource == null)
                        npcSource = FindFirstObjectByType<Simus.City.NeighborhoodLife>();
                    next = npcSource != null ? npcSource.FindNpc(followNpcId) : null;
                }
                if (next != null && next.gameObject.activeInHierarchy)
                {
                    var destination = next.position + followOffset;
                    if (activeTarget != next)
                    {
                        followVelocity = Vector3.zero;
                        size = Mathf.Max(1f, followSize / FollowZoom);
                        acquiring = smoothFollowTransitions;
                        if (!smoothFollowTransitions) target = destination;
                    }
                    if (smoothFollowTransitions || activeTarget == next)
                    {
                        target = Vector3.SmoothDamp(target, destination, ref followVelocity,
                            Mathf.Max(.01f, acquiring ? acquisitionSmoothTime : followSmoothTime),
                            acquiring ? acquisitionPanSpeed : Mathf.Infinity, smoothFollowTransitions?followPoseDelta:Time.unscaledDeltaTime);
                        if(acquiring && Vector3.Distance(target,destination)<.05f)acquiring=false;
                    }
                    activeTarget = next;
                }
                else
                {
                    activeTarget = null;
                    followVelocity = Vector3.zero;
                }
            }
            ApplyPose();
            if (reveal != null) reveal.SetTarget(followEnabled ? activeTarget : null, revealRadius);
        }

        private void ApplyPose()
        {
            if (view == null) view = GetComponent<Camera>();
            var desiredRotation=Quaternion.Euler(pitch,yaw,0);
            bool ease=smoothFollowTransitions && followEnabled;
            transform.rotation=ease?Quaternion.RotateTowards(transform.rotation,desiredRotation,acquisitionAngularSpeed*followPoseDelta):desiredRotation;
            transform.position=target-transform.forward*360f;
            float desiredSize=size*(followEnabled?1f:Mathf.Max(1f,1.25f/view.aspect));
            view.orthographicSize=ease?Mathf.SmoothDamp(view.orthographicSize,desiredSize,ref zoomVelocity,Mathf.Max(.05f,acquisitionSmoothTime),acquisitionZoomSpeed,followPoseDelta):desiredSize;
            if(!ease)zoomVelocity=0;
        }

        private void OnGUI()
        {
            if (!previewControls) return;
            if (titleStyle == null)
            {
                titleStyle = new GUIStyle(GUI.skin.label) { fontSize = 22, fontStyle = FontStyle.Bold };
                titleStyle.normal.textColor = new Color(0.92f, 0.97f, 0.95f);
                noteStyle = new GUIStyle(GUI.skin.label) { fontSize = 13 };
                noteStyle.normal.textColor = new Color(0.70f, 0.82f, 0.82f);
            }
            GUI.Box(new Rect(16, 16, 304, 73), GUIContent.none);
            GUI.Label(new Rect(30, 24, 280, 30), "SIM:US  /  CITY PREVIEW", titleStyle);
            GUI.Label(new Rect(30, 56, 280, 23), previewSubtitle, noteStyle);
            float left = Screen.width < 620 ? 16 : Screen.width - 282;
            float top = Screen.width < 620 ? 98 : 22;
            if (GUI.Button(new Rect(left, top, 120, 32), "1  Overview")) Overview();
            if (GUI.Button(new Rect(left + 130, top, 120, 32), "2  Top view")) TopView();
            if (GUI.Button(new Rect(left, top + 38, 250, 32), "F  Follow NPC")) Follow();
            GUI.Box(new Rect(16, Screen.height - 45, Mathf.Min(570, Screen.width - 32), 29), GUIContent.none);
            GUI.Label(new Rect(28, Screen.height - 41, 555, 23), "Drag: orbit  |  Right drag: pan  |  Scroll: zoom  |  R: reset", noteStyle);
        }
    }
}
