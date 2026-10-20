Shader "SIMUS/NPC Reveal"
{
    Properties
    {
        _Color ("Color", Color) = (1,1,1,1)
        _MainTex ("Albedo", 2D) = "white" {}
        _Metallic ("Metallic", Range(0,1)) = 0
        _Glossiness ("Smoothness", Range(0,1)) = 0.22
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" }
        Cull Off
        CGPROGRAM
        #pragma surface surf Standard fullforwardshadows addshadow
        #pragma target 3.0
        sampler2D _MainTex;
        fixed4 _Color;
        half _Metallic, _Glossiness;
        float3 _SimusRevealCenter, _SimusRevealDirection;
        float _SimusRevealRadius;
        struct Input { float2 uv_MainTex; float3 worldPos; float4 screenPos; float facing : VFACE; };
        void surf(Input IN, inout SurfaceOutputStandard o)
        {
            // Remove only fragments between this camera and the NPC, never ground
            // or objects behind the NPC. Preserve normal shadow casting.
            #ifndef UNITY_PASS_SHADOWCASTER
            float3 delta = IN.worldPos - _SimusRevealCenter;
            float depth = dot(delta, _SimusRevealDirection);
            float radial = length(delta - depth * _SimusRevealDirection);
            if (_SimusRevealRadius > 0 && depth < -0.25 && delta.y > -0.85)
            {
                // Screen-space dithering gives a feathered transparency edge while
                // retaining opaque depth sorting for overlapping building surfaces.
                float feather = max(0.1, _SimusRevealRadius * 0.4);
                float coverage = smoothstep(_SimusRevealRadius - feather,
                                            _SimusRevealRadius + feather, radial);
                float2 pixel = floor(IN.screenPos.xy / IN.screenPos.w * _ScreenParams.xy);
                float threshold = frac(52.9829189 * frac(dot(pixel, float2(0.06711056, 0.00583715))));
                clip(coverage - max(0.001, threshold));
            }
            #endif
            o.Albedo = tex2D(_MainTex, IN.uv_MainTex).rgb * _Color.rgb;
            o.Normal = float3(0, 0, IN.facing > 0 ? 1 : -1);
            o.Metallic = _Metallic;
            o.Smoothness = _Glossiness;
            o.Alpha = 1;
        }
        ENDCG
    }
    FallBack "Diffuse"
}
