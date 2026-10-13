using System;
using UnityEngine;

namespace Simus.City
{
    /// <summary>Stable npc_01..16 IDs select the authored Happiness model variants.</summary>
    public static class CitizenCharacterAppearance
    {
        public static string Normalize(string id)
        {
            if (id == null) return "npc_01"; // Older participant records retain default appearance.
            if (id.Length != 6 || !id.StartsWith("npc_", StringComparison.Ordinal) ||
                !int.TryParse(id.Substring(4), out var index) || index < 1 || index > 16 ||
                id != "npc_" + index.ToString("D2"))
                throw new FormatException("Invalid citizen character ID.");
            return id;
        }

        public static string NormalizeGlasses(string id, string characterId)
        {
            if (id == null) return characterId == "npc_01" ? "square" : characterId == "npc_04" ? "round" : "none";
            if (id != "none" && id != "square" && id != "round") throw new FormatException("Invalid citizen glasses ID.");
            return id;
        }

        public static void Apply(GameObject actor, string characterId, string glassesId = null)
        {
            var id = Normalize(characterId);
            var glasses = NormalizeGlasses(glassesId, id);
            var prefix = "HAIR_" + id.Substring(4) + "_";
            foreach (var node in actor.GetComponentsInChildren<Transform>(true))
            {
                if (node.name.StartsWith("PREVIEW_", StringComparison.Ordinal))
                    node.gameObject.SetActive(false);
                else if (node.name.StartsWith("HAIR_", StringComparison.Ordinal) && node.name != "HAIR_ROOT")
                    node.gameObject.SetActive(node.name.StartsWith(prefix, StringComparison.Ordinal));
                else if (node.name.StartsWith("GLASSES_", StringComparison.Ordinal))
                    node.gameObject.SetActive((glasses == "square" && node.name == "GLASSES_SQUARE") ||
                        (glasses == "round" && node.name == "GLASSES_ROUND"));
            }
        }
    }
}
