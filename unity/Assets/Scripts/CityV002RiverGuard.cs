using UnityEngine;

namespace Simus
{
    // Transform-driven patrols do not respond to barrier colliders. Check their swept step too.
    [DefaultExecutionOrder(50), DisallowMultipleComponent]
    public sealed class CityV002RiverGuard : MonoBehaviour
    {
        public CityV002RiverArea river;
        public float radius = .35f;
        public int rejectedSteps;
        public int recoveredSpawns;
        private Vector3 previous;
        private void OnEnable() { previous = transform.position; }
        public bool ResetSafePosition(Vector3 position)
        {
            if (river != null && river.IsForbidden(position, radius)) return false;
            previous = position; return true;
        }
        private void LateUpdate()
        {
            if (river == null) return;
            if (river.IsForbidden(previous, radius)) { previous = river.NearestBank(previous); transform.position = previous; recoveredSpawns++; }
            if (!river.SegmentSafe(previous, transform.position, radius)) { transform.position = previous; rejectedSteps++; }
            else previous = transform.position;
        }
    }
}
