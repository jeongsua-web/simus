using UnityEngine;

namespace Simus.City
{
    public static class CityVisualMapping
    {
        public static float Normalize(double value) { return Mathf.Clamp01((float)value / 100f); }
        public static Color PollutionColor(double value)
        {
            var amount = Normalize(value);
            if (amount <= .5f) return Color.Lerp(new Color(.18f, .72f, .42f), new Color(.95f, .72f, .18f), amount * 2f);
            return Color.Lerp(new Color(.95f, .72f, .18f), new Color(.78f, .16f, .12f), (amount - .5f) * 2f);
        }
        public static string RegionKey(RegionStateDto region)
        {
            return !string.IsNullOrWhiteSpace(region.Code) ? region.Code : region.Id;
        }
        public static string StatusLabel(string status)
        {
            switch (status)
            {
                case "RUNNING": return "ROUND IN PROGRESS";
                case "CLOSING": return "FINALIZING RESULTS";
                case "FINALIZED": return "RESULTS FINALIZED";
                default: return "NO ROUND";
            }
        }
    }
}
