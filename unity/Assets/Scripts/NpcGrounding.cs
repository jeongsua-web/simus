using UnityEngine;

namespace Simus
{
    /// <summary>Visual grounding only; never changes the authoritative route.</summary>
    [DefaultExecutionOrder(100)]
    public sealed class NpcGrounding : MonoBehaviour
    {
        public float probeHeight = 2f;
        public float probeDepth = 4f;
        public float clearance = 0.02f;
        private Animator animator;
        private Transform leftFoot, rightFoot;
        private float visualLift;

        private void Awake()
        {
            animator = GetComponentInChildren<Animator>(true);
            if (animator != null)
            {
                animator.applyRootMotion = false;
                if (animator.isHuman)
                {
                    leftFoot = animator.GetBoneTransform(HumanBodyBones.LeftFoot);
                    rightFoot = animator.GetBoneTransform(HumanBodyBones.RightFoot);
                }
            }
        }

        public Vector3 Project(Vector3 position)
        {
            // Choose the nearest upward-facing surface, excluding this actor and triggers.
            // A roof above the route must not pull a pedestrian onto the building.
            var hits = Physics.RaycastAll(position + Vector3.up * probeHeight, Vector3.down,
                probeHeight + probeDepth, Physics.DefaultRaycastLayers, QueryTriggerInteraction.Ignore);
            var distance = float.PositiveInfinity;
            var routeHeight = position.y;
            foreach (var hit in hits)
            {
                if (hit.normal.y < 0.5f || hit.transform.IsChildOf(transform)) continue;
                var delta = Mathf.Abs(hit.point.y - routeHeight);
                if (delta >= distance) continue;
                distance = delta;
                position.y = hit.point.y + clearance;
            }
            return position;
        }

        private void LateUpdate()
        {
            transform.position = Project(transform.position);
            if (leftFoot == null || rightFoot == null || animator.transform == transform) return;
            // Foot bones sit at the ankle. Unity's humanoid sole offsets preserve each
            // avatar's proportions; use the lowest foot so the swing foot can rise.
            animator.transform.position -= Vector3.up * visualLift;
            var sole = Mathf.Min(leftFoot.position.y - animator.leftFeetBottomHeight,
                rightFoot.position.y - animator.rightFeetBottomHeight);
            visualLift = Mathf.Max(0f, transform.position.y - sole);
            animator.transform.position += Vector3.up * visualLift;
        }
    }
}
