using UnityEngine;

namespace Simus
{
    /// <summary>Local camera test only; these points are not exhibition/server paths.</summary>
    public sealed class TestNpcPatrol : MonoBehaviour
    {
        public Transform startPoint;
        public Transform endPoint;
        [Min(0f)] public float speed = 1.4f;
        [Min(0f)] public float turnSpeed = 360f;
        private bool headingToEnd = true;

        private void Update()
        {
            if (startPoint == null || endPoint == null) return;
            Vector3 destination = headingToEnd ? endPoint.position : startPoint.position;
            Vector3 direction = destination - transform.position;
            if (direction.sqrMagnitude < 0.0025f)
            {
                headingToEnd = !headingToEnd;
                return;
            }
            transform.position = Vector3.MoveTowards(transform.position, destination, speed * Time.deltaTime);
            direction.y = 0f;
            if (direction.sqrMagnitude > 0.0001f)
                transform.rotation = Quaternion.RotateTowards(transform.rotation,
                    Quaternion.LookRotation(direction), turnSpeed * Time.deltaTime);
        }
    }
}
