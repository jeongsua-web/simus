using System;
using UnityEngine;

namespace Simus.HomeBackground
{
    // Decoration only. No simulation, navigation, network or event dependencies.
    public sealed class HomeBackgroundMotion : MonoBehaviour
    {
        public const float Duration = 12f;
        public float loopDuration = Duration;
        public int walkerPeriods = 1;
        public int animationCycles = 12;
        public int trafficStride = 1;
        [Serializable] public sealed class Walker
        {
            public Transform actor;
            public Vector3 from, to;
            public float phase;
            public Animator animator;
        }
        public Walker[] walkers = Array.Empty<Walker>();
        public Transform[] cars = Array.Empty<Transform>();
        public Vector3[] road = Array.Empty<Vector3>();

        void Update() => Evaluate(Time.timeSinceLevelLoad);

        public void Evaluate(float seconds)
        {
            float cycle = Mathf.Repeat(seconds / loopDuration, 1);
            foreach (var walker in walkers)
            {
                float phase = Mathf.Repeat(cycle * walkerPeriods + walker.phase, 1);
                float angle = phase * Mathf.PI * 2;
                walker.actor.position = Vector3.Lerp(walker.from, walker.to, .5f - .5f * Mathf.Cos(angle));
                float turn = Mathf.SmoothStep(0, 1, Mathf.InverseLerp(.15f, -.15f, Mathf.Sin(angle)));
                walker.actor.rotation = Quaternion.LookRotation(walker.to - walker.from) * Quaternion.Euler(0, 180 * turn, 0);
                if (walker.animator != null)
                {
                    // An integer number of walk cycles also closes the skeletal loop.
                    walker.animator.Play("NEUTRAL_WALK", 0, Mathf.Repeat(cycle * animationCycles + walker.phase, 1));
                    walker.animator.Update(0);
                }
            }
            for (int i = 0; i < cars.Length; i++)
            {
                float fraction = Mathf.Repeat((cycle * trafficStride + i) / cars.Length, 1);
                var point = RoadPoint(fraction);
                cars[i].position = point;
                var direction = RoadPoint(Mathf.Repeat(fraction + .006f, 1)) - point;
                direction.y = 0;
                cars[i].rotation = Quaternion.LookRotation(direction);
            }
        }

        Vector3 RoadPoint(float fraction)
        {
            float length = 0;
            for (int i = 0; i < road.Length; i++) length += Vector3.Distance(road[i], road[(i + 1) % road.Length]);
            float distance = fraction * length;
            for (int i = 0; i < road.Length; i++)
            {
                var a = road[i]; var b = road[(i + 1) % road.Length];
                float leg = Vector3.Distance(a, b);
                if (distance <= leg) return Vector3.Lerp(a, b, distance / leg);
                distance -= leg;
            }
            return road[0];
        }
    }
}
