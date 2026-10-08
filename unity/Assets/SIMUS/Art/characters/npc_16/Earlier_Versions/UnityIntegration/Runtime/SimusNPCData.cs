using System;
using UnityEngine;

namespace Simus
{
    [Serializable]
    public sealed class NPCRecord
    {
        [Range(1, 16)] public int appearanceId = 1;
        public string departmentId = "";
        public string mbti = "";
        public Color primaryColor = new Color(.73f, .25f, .21f);
        public Color secondaryColor = new Color(.74f, .36f, .34f);
        public Color skinColor = new Color(.76f, .52f, .36f);
        public Color hairColor = new Color(.065f, .036f, .021f);
        public string npcId = "";
        public string nickname = "";
    }

    // Store the full population as records; instantiate only the visible subset.
    // Department and MBTI have no relationship to appearance or colour.
    public sealed class SimusNPCData : MonoBehaviour
    {
        public NPCRecord data = new NPCRecord();
    }
}
