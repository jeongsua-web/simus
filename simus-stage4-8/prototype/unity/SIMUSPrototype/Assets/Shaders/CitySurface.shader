Shader "SIMUS/City Surface"
{
    Properties
    {
        _Color ("Color", Color) = (1,1,1,1)
        _Metallic ("Metallic", Range(0,1)) = 0
        _Glossiness ("Smoothness", Range(0,1)) = 0.22
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" }
        LOD 200
        // Source windows and road ribbons include single-sided planes.
        Cull Off
        CGPROGRAM
        #pragma surface surf Standard fullforwardshadows addshadow
        #pragma target 3.0
        struct Input { float3 worldPos; float facing : VFACE; };
        fixed4 _Color;
        half _Metallic;
        half _Glossiness;
        void surf(Input IN, inout SurfaceOutputStandard o)
        {
            o.Albedo = _Color.rgb;
            o.Normal = float3(0, 0, IN.facing > 0 ? 1 : -1);
            o.Metallic = _Metallic;
            o.Smoothness = _Glossiness;
            o.Alpha = 1;
        }
        ENDCG
    }
    FallBack "Diffuse"
}
