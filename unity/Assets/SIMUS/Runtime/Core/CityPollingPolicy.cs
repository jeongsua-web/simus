using System;
using System.Globalization;

namespace Simus.City
{
    public static class CityPollingPolicy
    {
        public static bool IsRetryable(long status)
        { return status == 0 || status == 408 || status == 429 || status >= 500; }

        public static double RetryDelay(int failures, double random01, double retryAfterSeconds = 0)
        {
            var baseDelay = Math.Min(30, 2 * Math.Pow(2, Math.Min(4, Math.Max(0, failures - 1))));
            return Math.Max(baseDelay * (0.8 + 0.4 * Math.Max(0, Math.Min(1, random01))), retryAfterSeconds);
        }
        public static double RetryAfter(string header, DateTimeOffset now)
        {
            long seconds;
            if (long.TryParse(header, NumberStyles.None, CultureInfo.InvariantCulture, out seconds) && seconds >= 0)
                return seconds;
            DateTimeOffset date;
            if (DateTimeOffset.TryParseExact(header, "r", CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out date))
                return Math.Max(0, (date - now).TotalSeconds);
            return 0;
        }
    }
}
