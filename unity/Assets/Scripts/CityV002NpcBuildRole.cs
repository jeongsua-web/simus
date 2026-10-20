using UnityEngine;

namespace Simus
{
    /// <summary>Explicit build ownership. This component never controls movement or event state.</summary>
    [DisallowMultipleComponent]
    public sealed class CityV002NpcBuildRole : MonoBehaviour
    {
        public enum Role { Unassigned, ParticipantTemplate, Environment, TestProbe }
        public Role role;
    }
}
