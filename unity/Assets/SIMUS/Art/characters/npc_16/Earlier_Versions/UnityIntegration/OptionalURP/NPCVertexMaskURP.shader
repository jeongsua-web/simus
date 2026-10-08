Shader "SIMUS/NPCVertexMaskURP"
{
    Properties
    {
        _PrimaryColor ("Primary", Color) = (.73,.25,.21,1)
        _SecondaryColor ("Secondary", Color) = (.74,.36,.34,1)
        _NeutralColor ("Neutral", Color) = (.075,.09,.105,1)
        _SkinColor ("Skin", Color) = (.76,.52,.36,1)
        _HairColor ("Hair", Color) = (.065,.036,.021,1)
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" "RenderPipeline"="UniversalPipeline" "Queue"="Geometry" }
        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode"="UniversalForward" }
            HLSLPROGRAM
            #pragma vertex Vert
            #pragma fragment Frag
            #pragma multi_compile_instancing
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile_fragment _ _SHADOWS_SOFT
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
            UNITY_INSTANCING_BUFFER_START(NPCProperties)
                UNITY_DEFINE_INSTANCED_PROP(float4, _PrimaryColor)
                UNITY_DEFINE_INSTANCED_PROP(float4, _SecondaryColor)
                UNITY_DEFINE_INSTANCED_PROP(float4, _NeutralColor)
                UNITY_DEFINE_INSTANCED_PROP(float4, _SkinColor)
                UNITY_DEFINE_INSTANCED_PROP(float4, _HairColor)
            UNITY_INSTANCING_BUFFER_END(NPCProperties)
            struct Attributes
            {
                float4 positionOS : POSITION;
                float3 normalOS : NORMAL;
                float4 mask : COLOR;
                UNITY_VERTEX_INPUT_INSTANCE_ID
            };
            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float3 normalWS : TEXCOORD0;
                float3 positionWS : TEXCOORD1;
                float4 mask : COLOR;
                UNITY_VERTEX_INPUT_INSTANCE_ID
                UNITY_VERTEX_OUTPUT_STEREO
            };
            Varyings Vert(Attributes input)
            {
                Varyings output = (Varyings)0;
                UNITY_SETUP_INSTANCE_ID(input);
                UNITY_TRANSFER_INSTANCE_ID(input, output);
                UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(output);
                VertexPositionInputs p = GetVertexPositionInputs(input.positionOS.xyz);
                output.positionCS = p.positionCS;
                output.positionWS = p.positionWS;
                output.normalWS = TransformObjectToWorldNormal(input.normalOS);
                output.mask = input.mask;
                return output;
            }
            half4 Frag(Varyings input) : SV_Target
            {
                UNITY_SETUP_INSTANCE_ID(input);
                float4 m = saturate(input.mask);
                half3 color = UNITY_ACCESS_INSTANCED_PROP(NPCProperties, _NeutralColor).rgb;
                color = lerp(color, UNITY_ACCESS_INSTANCED_PROP(NPCProperties, _PrimaryColor).rgb, m.r);
                color = lerp(color, UNITY_ACCESS_INSTANCED_PROP(NPCProperties, _SecondaryColor).rgb, m.g);
                color = lerp(color, UNITY_ACCESS_INSTANCED_PROP(NPCProperties, _SkinColor).rgb, m.b);
                color = lerp(color, UNITY_ACCESS_INSTANCED_PROP(NPCProperties, _HairColor).rgb, m.a);
                half3 normal = normalize(input.normalWS);
                Light main = GetMainLight(TransformWorldToShadowCoord(input.positionWS));
                half3 light = SampleSH(normal) + main.color * saturate(dot(normal, main.direction)) * main.distanceAttenuation * main.shadowAttenuation;
                return half4(color * max(light, .12), 1);
            }
            ENDHLSL
        }
        UsePass "Universal Render Pipeline/Lit/ShadowCaster"
        UsePass "Universal Render Pipeline/Lit/DepthOnly"
        UsePass "Universal Render Pipeline/Lit/DepthNormals"
    }
    FallBack "Hidden/Universal Render Pipeline/FallbackError"
}
