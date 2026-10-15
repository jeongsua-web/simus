using UnityEngine;

namespace Simus
{
    /// <summary>Scene-local river footprint. The pedestrian graph remains the route authority.</summary>
    public sealed class CityV002RiverArea : MonoBehaviour
    {
        public Vector3[] centreline;
        public Vector3[] bridgeStarts, bridgeEnds;
        public float waterHalfWidth = 5, bridgeWidth = 3;
        public Mesh originalGround, originalLawn;
        public float DistanceToWaterAxis(Vector3 p)
        {
            float result = float.PositiveInfinity;
            for (int i = 1; i < centreline.Length; i++)
            {
                var a = centreline[i - 1]; var d = centreline[i] - a; d.y = 0; var q = p - a; q.y = 0;
                result = Mathf.Min(result, (q - d * Mathf.Clamp01(Vector3.Dot(q, d) / Mathf.Max(.000001f, d.sqrMagnitude))).magnitude);
            }
            return result;
        }
        public bool OnBridge(Vector3 p, float radius = .35f)
        {
            for (int i = 0; i < bridgeStarts.Length; i++)
            {
                var a = bridgeStarts[i]; var d = bridgeEnds[i] - a; d.y = 0; float length = d.magnitude; d /= length;
                var q = p - a; q.y = 0; float along = Vector3.Dot(q, d);
                if (along >= -radius && along <= length + radius && Mathf.Abs(Vector3.Dot(q, new Vector3(-d.z, 0, d.x))) <= bridgeWidth * .5f - radius) return true;
            }
            return false;
        }
        public bool IsForbidden(Vector3 p, float radius = .35f) => DistanceToWaterAxis(p) < waterHalfWidth + radius && !OnBridge(p, radius);
        public bool SegmentSafe(Vector3 a, Vector3 b, float radius = .35f)
        {
            int count = Mathf.Max(1, Mathf.CeilToInt(Vector3.Distance(a, b) / .2f));
            for (int i = 0; i <= count; i++) if (IsForbidden(Vector3.Lerp(a, b, (float)i / count), radius)) return false;
            return true;
        }
    }
}
