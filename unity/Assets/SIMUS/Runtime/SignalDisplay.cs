using System;
using UnityEngine;

namespace Simus.City
{
    /// <summary>Display-only signal states. Does not schedule intersection traffic.</summary>
    [ExecuteAlways, DisallowMultipleComponent]
    public sealed class SignalDisplay : MonoBehaviour
    {
        public enum Kind { Vehicle, Pedestrian }
        public enum State { ALL_OFF, RED, YELLOW, GREEN_STRAIGHT, GREEN_LEFT, GREEN_STRAIGHT_LEFT, RED_STAND, GREEN_WALK, GREEN_BLINK }
        public Kind kind;
        public State state = State.RED;
        [Min(0.1f)] public float blinkPeriod = 1f;
        public GameObject redEmitter, yellowEmitter, leftEmitter, greenEmitter;
        double startedAt;
        State previous;
        bool refresh;

        public bool Accepts(State value)
        {
            return value == State.ALL_OFF || (kind == Kind.Vehicle
                ? value >= State.RED && value <= State.GREEN_STRAIGHT_LEFT
                : value >= State.RED_STAND && value <= State.GREEN_BLINK);
        }
        public void SetState(State value)
        {
            if (!Accepts(value)) throw new ArgumentException("State does not apply to this signal kind.", nameof(value));
            state = value;
            previous = value;
            startedAt = Time.realtimeSinceStartupAsDouble;
            ApplyStateAt(0);
        }
        void OnEnable() { previous = state; startedAt = Time.realtimeSinceStartupAsDouble; ApplyStateAt(0); }
        void OnValidate() { blinkPeriod = Mathf.Max(.1f, blinkPeriod); refresh = true; }
        void Update()
        {
            if (refresh || previous != state) { refresh = false; previous = state; startedAt = Time.realtimeSinceStartupAsDouble; }
            ApplyStateAt(Time.realtimeSinceStartupAsDouble - startedAt);
        }
        /// <summary>Deterministic display sampling for preview/testing. Uses no shared-material mutation.</summary>
        public void ApplyStateAt(double elapsedSeconds)
        {
            bool valid = Accepts(state);
            bool red = valid && (state == State.RED || state == State.RED_STAND);
            bool yellow = valid && state == State.YELLOW;
            bool left = valid && (state == State.GREEN_LEFT || state == State.GREEN_STRAIGHT_LEFT);
            bool green = valid && (state == State.GREEN_STRAIGHT || state == State.GREEN_STRAIGHT_LEFT || state == State.GREEN_WALK);
            if (valid && state == State.GREEN_BLINK)
                green = Math.Max(0, elapsedSeconds) % Math.Max(.1, blinkPeriod) < Math.Max(.1, blinkPeriod) * .5;
            Toggle(redEmitter, red); Toggle(yellowEmitter, yellow); Toggle(leftEmitter, left); Toggle(greenEmitter, green);
        }
        static void Toggle(GameObject target, bool on) { if (target != null && target.activeSelf != on) target.SetActive(on); }
    }
}
