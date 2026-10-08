using UnityEngine;

namespace Simus
{
    [RequireComponent(typeof(Camera))]
    public sealed class CityPreviewCamera : MonoBehaviour
    {
        public Vector3 target = Vector3.zero;
        public float overviewSize = 132f;
        public string previewSubtitle = "STAGE 02    |    200 x 200 m";
        [Header("NPC follow")]
        public Transform followTarget;
        [Tooltip("Optional full participant NPC ID. Takes precedence over Follow Target.")]
        public string followNpcId;
        public Simus.City.NeighborhoodLife npcSource;
        [Min(0.01f)] public float followSmoothTime = 0.25f;
        [Min(1f)] public float followSize = 18f;
        public Vector3 followOffset = new Vector3(0f, 1f, 0f);
        private Vector3 followVelocity;
        private Transform activeTarget;
        private bool followEnabled = true;
        private Camera view;
        private float yaw = -36f;
        private float pitch = 55f;
        private float size;
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
            activeTarget = null;
            followVelocity = Vector3.zero;
        }

        public void Overview()
        {
            followEnabled = false;
            target = Vector3.zero;
            yaw = -36f;
            pitch = 55f;
            size = overviewSize;
            ApplyPose();
        }

        public void TopView()
        {
            followEnabled = false;
            target = Vector3.zero;
            yaw = 0f;
            pitch = 90f;
            size = 112f;
            ApplyPose();
        }

        private void Update()
        {
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
                    target.x = Mathf.Clamp(target.x, -130f, 130f);
                    target.z = Mathf.Clamp(target.z, -130f, 130f);
                }
                size = Mathf.Clamp(size * (1f - Input.mouseScrollDelta.y * 0.07f), 1f, 170f);
            }
        }

        private void LateUpdate()
        {
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
                        // Snap once on acquisition, then smooth after the NPC's Update.
                        target = destination;
                        followVelocity = Vector3.zero;
                        size = Mathf.Max(1f, followSize);
                    }
                    else
                        target = Vector3.SmoothDamp(target, destination, ref followVelocity,
                            Mathf.Max(0.01f, followSmoothTime), Mathf.Infinity, Time.deltaTime);
                    activeTarget = next;
                }
                else
                {
                    activeTarget = null;
                    followVelocity = Vector3.zero;
                }
            }
            ApplyPose();
        }

        private void ApplyPose()
        {
            if (view == null) view = GetComponent<Camera>();
            transform.rotation = Quaternion.Euler(pitch, yaw, 0f);
            transform.position = target - transform.forward * 360f;
            // Preserve a useful overview when the Game window becomes narrow.
            view.orthographicSize = size * Mathf.Max(1f, 1.25f / view.aspect);
        }

        private void OnGUI()
        {
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
