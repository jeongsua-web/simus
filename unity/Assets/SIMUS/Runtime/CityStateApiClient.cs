using System;
using System.Collections;
using UnityEngine.Networking;

namespace Simus.City
{
    public sealed class CityApiResult
    {
        public CityStateResponseDto Response { get; }
        public long StatusCode { get; }
        public string Error { get; }
        public bool Retryable { get; }
        public double RetryAfterSeconds { get; }
        public bool IsSuccess => Response != null;

        private CityApiResult(CityStateResponseDto response, long status, string error,
            bool retryable, double retryAfter)
        { Response = response; StatusCode = status; Error = error; Retryable = retryable; RetryAfterSeconds = retryAfter; }

        public static CityApiResult Success(CityStateResponseDto response) =>
            new CityApiResult(response, 200, null, false, 0);
        public static CityApiResult Failure(long status, string error, bool retryable, double retryAfter = 0) =>
            new CityApiResult(null, status, error, retryable, retryAfter);
    }

    // Owns one UnityWebRequest. Poll scheduling and state retention live elsewhere.
    public sealed class CityStateApiClient : IDisposable
    {
        private UnityWebRequest activeRequest;
        public bool IsBusy => activeRequest != null;

        public IEnumerator Get(string url, int timeoutSeconds, Action<CityApiResult> completed)
        {
            if (activeRequest != null)
            {
                completed(CityApiResult.Failure(0, "A city-state request is already running.", false));
                yield break;
            }

            UnityWebRequest request;
            try
            {
                request = UnityWebRequest.Get(url);
                request.timeout = Math.Max(1, timeoutSeconds);
                request.SetRequestHeader("Accept", "application/json");
            }
            catch (Exception exception)
            {
                completed(CityApiResult.Failure(0, "Invalid API URL: " + exception.Message, false));
                yield break;
            }

            activeRequest = request;
            try
            {
                yield return request.SendWebRequest();
                var status = request.responseCode;
                if (request.result != UnityWebRequest.Result.Success || status < 200 || status >= 300)
                {
                    var retryAfter = CityPollingPolicy.RetryAfter(request.GetResponseHeader("Retry-After"), DateTimeOffset.UtcNow);
                    completed(CityApiResult.Failure(status,
                        "HTTP " + status + ": " + (request.error ?? "request failed"),
                        CityPollingPolicy.IsRetryable(status), retryAfter));
                    yield break;
                }

                try
                {
                    completed(CityApiResult.Success(CityStateJson.Parse(request.downloadHandler.text)));
                }
                catch (Exception exception)
                {
                    completed(CityApiResult.Failure(status, "Invalid city-state response: " + exception.Message, true));
                }
            }
            finally
            {
                if (ReferenceEquals(activeRequest, request)) activeRequest = null;
                request.Dispose();
            }
        }

        public void Cancel()
        {
            if (activeRequest == null) return;
            activeRequest.Abort();
            activeRequest.Dispose();
            activeRequest = null;
        }

        public void Dispose() { Cancel(); }
    }
}
