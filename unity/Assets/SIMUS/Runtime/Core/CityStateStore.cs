using System;

namespace Simus.City
{
    public enum CityConnection { Waiting, Connected, Reconnecting, Disconnected, ConfigurationError, Paused }
    [Flags]
    public enum CityChange { None = 0, Session = 1, Version = 2, Status = 4, Snapshot = 8, Cleared = 16 }

    // Main-thread store. All successful snapshots (including null) are authoritative.
    public sealed class CityStateStore
    {
        public CityStateDto Current { get; private set; }
        public CityConnection Connection { get; private set; } = CityConnection.Waiting;
        public string LastError { get; private set; } = "";
        public double? LastSuccessAt { get; private set; }
        public bool HasReceivedResponse { get; private set; }
        public CityChange LastChange { get; private set; }
        public event Action<CityChange> Changed;
        public event Action ConnectionChanged;
        private double startedAt;

        public void Begin(double now)
        {
            if (!HasReceivedResponse) startedAt = now;
            SetConnection(HasReceivedResponse ? CityConnection.Reconnecting : CityConnection.Waiting);
        }
        public bool Apply(CityStateResponseDto response, double now, out string error)
        {
            error = null;
            var next = response.CityState;
            var previous = Current;
            if (previous != null && next != null && previous.SessionId == next.SessionId &&
                CityStateJson.ParseVersion(next.Version) < CityStateJson.ParseVersion(previous.Version))
            {
                error = "Version decreased within the same session; snapshot rejected.";
                return false;
            }
            var change = CityChange.None;
            if (next == null)
            {
                if (previous != null || !HasReceivedResponse) change = CityChange.Cleared;
            }
            else
            {
                if (previous == null || next.SessionId != previous.SessionId) change |= CityChange.Session;
                if (previous == null || next.Version != previous.Version) change |= CityChange.Version;
                if (previous == null || next.Status != previous.Status) change |= CityChange.Status;
                if (previous == null || next.SnapshotJson != previous.SnapshotJson) change |= CityChange.Snapshot;
            }
            Current = next; LastChange = change; LastSuccessAt = now; HasReceivedResponse = true; LastError = "";
            SetConnection(CityConnection.Connected);
            if (change != CityChange.None) Changed?.Invoke(change);
            return true;
        }
        public void Fail(string error, bool retryable)
        {
            LastError = error;
            SetConnection(retryable ? CityConnection.Reconnecting : CityConnection.ConfigurationError);
        }
        public void Tick(double now, double staleSeconds)
        {
            if (Connection == CityConnection.Paused || Connection == CityConnection.ConfigurationError) return;
            if (now - (LastSuccessAt ?? startedAt) >= staleSeconds) SetConnection(CityConnection.Disconnected);
        }
        public void Pause() { SetConnection(CityConnection.Paused); }
        // Explicit operator action after a confirmed DB restore. Ordinary reconnect never clears data.
        public void Reset(double now)
        {
            Current = null; LastSuccessAt = null; HasReceivedResponse = false; LastError = "";
            startedAt = now; LastChange = CityChange.Cleared;
            SetConnection(CityConnection.Waiting); Changed?.Invoke(CityChange.Cleared);
        }
        private void SetConnection(CityConnection value)
        {
            if (Connection == value) return;
            Connection = value; ConnectionChanged?.Invoke();
        }
    }
}
