using System.Text;
using UnityEngine;

namespace Simus.City
{
    public sealed class CityStateDebugView : MonoBehaviour
    {
        [SerializeField] private CityStatePoller poller;
        [SerializeField] private Rect panel = new Rect(16, 16, 560, 520);
        private GUIStyle style;

        public void SetPoller(CityStatePoller value) { poller = value; }

        private void OnGUI()
        {
            if (poller == null) return;
            if (style == null) style = new GUIStyle(GUI.skin.box)
            { alignment = TextAnchor.UpperLeft, fontSize = 16, padding = new RectOffset(14, 14, 12, 12), wordWrap = true };
            GUI.Box(panel, BuildText(), style);
        }

        private string BuildText()
        {
            var store = poller.Store;
            var text = new StringBuilder("SIM:US city state\n")
                .Append("connection: ").Append(store.Connection).Append('\n')
                .Append("endpoint: ").Append(poller.Endpoint).Append('\n');
            if (!string.IsNullOrEmpty(store.LastError)) text.Append("error: ").Append(store.LastError).Append('\n');
            if (!store.HasReceivedResponse) return text.Append("state: waiting for first response").ToString();
            var city = store.Current;
            if (city == null) return text.Append("state: no available session (city_state is null)").ToString();
            text.Append("session: ").Append(city.SessionId).Append('\n')
                .Append("status: ").Append(city.Status).Append("   version: ").Append(city.Version).Append('\n')
                .AppendFormat("happiness: {0:0.##}   safety: {1:0.##}   cleanliness: {2:0.##}\n",
                    city.Happiness, city.Safety, city.Cleanliness)
                .Append("overall pollution: ").Append(city.OverallPollution.HasValue ? city.OverallPollution.Value.ToString("0.##") : "no aggregate").Append('\n')
                .Append("regions: ").Append(city.Regions.Count).Append("   change: ").Append(store.LastChange).Append('\n');
            foreach (var region in city.Regions)
                text.Append("- ").Append(region.Code).Append(" / ").Append(region.Name)
                    .Append(": ").Append(region.Pollution.ToString("0.##")).Append('\n');
            return text.ToString();
        }
    }
}
