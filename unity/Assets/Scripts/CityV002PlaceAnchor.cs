using UnityEngine;

namespace Simus
{
    /// <summary>Scene data for a reviewed place. No trigger, event selection or server writes.</summary>
    [DisallowMultipleComponent]
    public sealed class CityV002PlaceAnchor : MonoBehaviour
    {
        public string placeId;
        public string situationCode;
        public string graphNodeId;
        [Min(0)] public float radius = 1.5f;
        public bool physicalAccessVerified;
    }
}
