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
                if (Mathf.Abs(p.y - (a.y + .02f)) <= .25f && along >= -radius && along <= length + radius && Mathf.Abs(Vector3.Dot(q, new Vector3(-d.z, 0, d.x))) <= bridgeWidth * .5f - radius + .002f) return true;
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
        public Vector3 NearestBank(Vector3 p)
        {
            int nearest = 0;
            for (int i = 1; i < centreline.Length; i++) if ((centreline[i] - p).sqrMagnitude < (centreline[nearest] - p).sqrMagnitude) nearest = i;
            var d = centreline[Mathf.Min(nearest + 1, centreline.Length - 1)] - centreline[Mathf.Max(0, nearest - 1)];
            var n = new Vector3(-d.z, 0, d.x).normalized;
            var q = centreline[nearest] + n * (Vector3.Dot(p - centreline[nearest], n) >= 0 ? 10 : -10); q.y = -.408f;
            foreach (var hit in Physics.RaycastAll(q + Vector3.up * 2, Vector3.down, 4, Physics.DefaultRaycastLayers, QueryTriggerInteraction.Ignore))
                if (hit.normal.y > .5f && hit.collider.name.Contains("BankTrail") && hit.point.y + .02f > q.y) q.y = hit.point.y + .02f;
            return q;
        }
    }
}
