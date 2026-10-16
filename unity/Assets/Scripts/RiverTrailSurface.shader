Shader "SIMUS/River Trail Surface"
{
    Properties
    {
        _Color ("Color", Color) = (0.54,0.47,0.34,1)
        _Glossiness ("Smoothness", Range(0,1)) = 0.08
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" }
        LOD 200
        // Grade crossings share the original path height. Give this untextured
        // finish a small depth bias without moving its physical walking surface.
        Offset -2, -2
        CGPROGRAM
        #pragma surface surf Standard fullforwardshadows
        #pragma target 3.0
        struct Input { float3 worldPos; };
        fixed4 _Color;
        half _Glossiness;
        void surf(Input IN, inout SurfaceOutputStandard o)
        {
            o.Albedo = _Color.rgb;
            o.Smoothness = _Glossiness;
            o.Alpha = _Color.a;
        }
        ENDCG
    }
    FallBack "Diffuse"
}
