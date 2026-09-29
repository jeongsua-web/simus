using System;
using System.Collections;
using UnityEngine;

namespace Simus.City
{
    public sealed class CityStatePoller : MonoBehaviour
    {
        [Header("API")]
        [SerializeField] private string serverBaseUrl = "http://localhost:3000";
        [SerializeField, Min(0.1f)] private float pollingSeconds = 0.5f;
        [SerializeField, Min(1)] private int timeoutSeconds = 10;
        [SerializeField, Min(1f)] private float disconnectedAfterSeconds = 15f;

        public CityStateStore Store { get; } = new CityStateStore();
        public string Endpoint => BuildEndpoint(serverBaseUrl);

        private CityStateApiClient api;
        private Coroutine loop;
        private int generation;
        private bool permanentlyStopped;

        private void OnEnable()
        {
            api = api ?? new CityStateApiClient();
            permanentlyStopped = false;
            generation++;
            Store.Begin(Now);
            loop = StartCoroutine(PollLoop(generation));
        }

        private void Update() { Store.Tick(Now, disconnectedAfterSeconds); }

        private void OnDisable()
        {
            generation++;
            if (loop != null) StopCoroutine(loop);
            loop = null;
            api?.Cancel();
            Store.Pause();
        }

        private void OnDestroy() { api?.Dispose(); }

        public void Reconnect()
        {
            if (!isActiveAndEnabled) return;
            generation++;
            if (loop != null) StopCoroutine(loop);
            api.Cancel();
            permanentlyStopped = false;
            Store.Begin(Now);
            loop = StartCoroutine(PollLoop(generation));
        }

        public void ResetAfterConfirmedDatabaseRestore()
        {
            Store.Reset(Now);
            Reconnect();
        }

        private IEnumerator PollLoop(int myGeneration)
        {
            var failures = 0;
            while (myGeneration == generation && !permanentlyStopped)
            {
                CityApiResult result = null;
                yield return api.Get(Endpoint, timeoutSeconds, value => result = value);
                if (myGeneration != generation) yield break;

                if (result != null && result.IsSuccess)
                {
                    string error;
                    if (Store.Apply(result.Response, Now, out error))
                    {
                        failures = 0;
                        yield return WaitRealtime(pollingSeconds, myGeneration);
                        continue;
                    }
                    result = CityApiResult.Failure(200, error, true);
                }

                failures++;
                var retryable = result == null || result.Retryable;
                Store.Fail(result?.Error ?? "Request ended without a result.", retryable);
                if (!retryable)
                {
                    permanentlyStopped = true;
                    yield break;
                }
                var retryAfter = result?.RetryAfterSeconds ?? 0;
                var delay = CityPollingPolicy.RetryDelay(failures, UnityEngine.Random.value, retryAfter);
                yield return WaitRealtime((float)delay, myGeneration);
            }
        }

        private IEnumerator WaitRealtime(float seconds, int myGeneration)
        {
            var until = Now + Math.Max(0.1f, seconds);
            while (myGeneration == generation && Now < until) yield return null;
        }

        private static string BuildEndpoint(string baseUrl)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            if (string.IsNullOrWhiteSpace(baseUrl)) return "/api/city-state";
#endif
            if (string.IsNullOrWhiteSpace(baseUrl)) return "/api/city-state";
            return baseUrl.TrimEnd('/') + "/api/city-state";
        }

        private static double Now => Time.realtimeSinceStartupAsDouble;
    }
}
