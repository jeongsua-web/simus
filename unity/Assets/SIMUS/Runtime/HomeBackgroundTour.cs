using UnityEngine;

namespace Simus.HomeBackground
{
    // Baked, reviewed camera poses only; no game or server dependencies.
    [RequireComponent(typeof(Camera))]
    public sealed class HomeBackgroundTour : MonoBehaviour
    {
        public float duration = 150;
        public Vector3[] positions;
        public Quaternion[] rotations;
        public Shader edgeShader;
        public bool edgeEnabled = true;
        Material edgeMaterial;

        void LateUpdate() => Evaluate(Time.timeSinceLevelLoad);

        public void Evaluate(float seconds)
        {
            if (positions == null || positions.Length == 0) return;
            float frame = Mathf.Repeat(seconds / duration, 1) * positions.Length;
            int a = Mathf.FloorToInt(frame), b = (a + 1) % positions.Length;
            transform.SetPositionAndRotation(Vector3.Lerp(positions[a], positions[b], frame-a),
                Quaternion.Slerp(rotations[a], rotations[b], frame-a));
        }

        void OnRenderImage(RenderTexture source, RenderTexture destination)
        {
            if (!edgeEnabled || edgeShader == null) { Graphics.Blit(source,destination); return; }
            if (edgeMaterial == null) edgeMaterial = new Material(edgeShader) { hideFlags = HideFlags.HideAndDontSave };
            Graphics.Blit(source,destination,edgeMaterial);
        }

        void OnDestroy()
        {
            if (edgeMaterial != null) DestroyImmediate(edgeMaterial);
        }
    }
}
