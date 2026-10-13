using UnityEngine;
namespace Simus.City
{
    public sealed class CityStateAnchor : MonoBehaviour
    {
        public string stat,region,effect_type,notes;
        public int activation_level;
        [Range(0,1)] public float recommended_intensity;
    }
}
