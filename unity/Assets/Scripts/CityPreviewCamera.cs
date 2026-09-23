using UnityEngine;

namespace Simus
{
    [RequireComponent(typeof(Camera))]
    public sealed class CityPreviewCamera : MonoBehaviour
    {
        public Vector3 target = Vector3.zero;
        public float overviewSize = 132f;
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

        public void Overview()
        {
            target = Vector3.zero;
            yaw = -36f;
            pitch = 55f;
            size = overviewSize;
            ApplyPose();
        }

        public void TopView()
        {
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
            // Keep the header buttons from also dragging the camera.
            if (Input.mousePosition.y < Screen.height - (Screen.width < 620 ? 135 : 95))
            {
                if (Input.GetMouseButton(0))
                {
                    yaw += Input.GetAxis("Mouse X") * 3f;
                    pitch = Mathf.Clamp(pitch - Input.GetAxis("Mouse Y") * 3f, 20f, 90f);
                }
                if (Input.GetMouseButton(1) || Input.GetMouseButton(2))
                {
                    Vector3 right = transform.right;
                    Vector3 forward = Vector3.Cross(right, Vector3.up).normalized;
                    target -= (right * Input.GetAxis("Mouse X") + forward * Input.GetAxis("Mouse Y")) * size * 0.02f;
                    target.x = Mathf.Clamp(target.x, -130f, 130f);
                    target.z = Mathf.Clamp(target.z, -130f, 130f);
                }
                size = Mathf.Clamp(size * (1f - Input.mouseScrollDelta.y * 0.07f), 18f, 170f);
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
            GUI.Label(new Rect(30, 56, 280, 23), "STAGE 02    |    200 x 200 m", noteStyle);
            float left = Screen.width < 620 ? 16 : Screen.width - 282;
            float top = Screen.width < 620 ? 98 : 22;
            if (GUI.Button(new Rect(left, top, 120, 32), "1  Overview")) Overview();
            if (GUI.Button(new Rect(left + 130, top, 120, 32), "2  Top view")) TopView();
            GUI.Box(new Rect(16, Screen.height - 45, Mathf.Min(570, Screen.width - 32), 29), GUIContent.none);
            GUI.Label(new Rect(28, Screen.height - 41, 555, 23), "Drag: orbit  |  Right drag: pan  |  Scroll: zoom  |  R: reset", noteStyle);
        }
    }
}
