using UnityEngine;

namespace Simus
{
    [DisallowMultipleComponent]
    public sealed class SimusNPCAppearance : MonoBehaviour
    {
        public Color primaryColor = new Color(.73f, .25f, .21f);
        public Color secondaryColor = new Color(.74f, .36f, .34f);
        public Color neutralColor = new Color(.075f, .09f, .105f);
        public Color skinColor = new Color(.76f, .52f, .36f);
        public Color hairColor = new Color(.065f, .036f, .021f);
        Renderer[] renderers;
        MaterialPropertyBlock block;
        static readonly int Primary = Shader.PropertyToID("_PrimaryColor");
        static readonly int Secondary = Shader.PropertyToID("_SecondaryColor");
        static readonly int Neutral = Shader.PropertyToID("_NeutralColor");
        static readonly int Skin = Shader.PropertyToID("_SkinColor");
        static readonly int Hair = Shader.PropertyToID("_HairColor");

        void OnEnable() => Apply();
        void OnValidate() => Apply();

        public void SetPrimary(Color value, bool deriveSecondary = false)
        {
            primaryColor = value;
            if (deriveSecondary) secondaryColor = Color.Lerp(value, new Color(.75f,.79f,.8f), .22f);
            Apply();
        }

        public void Apply()
        {
            if (renderers == null) renderers = GetComponentsInChildren<Renderer>(true);
            if (block == null) block = new MaterialPropertyBlock();
            foreach (var renderer in renderers)
            {
                if (!renderer) continue;
                renderer.GetPropertyBlock(block);
                block.SetColor(Primary, primaryColor);
                block.SetColor(Secondary, secondaryColor);
                block.SetColor(Neutral, neutralColor);
                block.SetColor(Skin, skinColor);
                block.SetColor(Hair, hairColor);
                renderer.SetPropertyBlock(block);
            }
        }
    }
}
