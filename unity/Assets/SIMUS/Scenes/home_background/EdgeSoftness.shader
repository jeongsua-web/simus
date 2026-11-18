Shader "Hidden/SIMUS/HomeBackgroundEdgeSoftness"
{
    Properties { _MainTex ("Frame", 2D) = "white" {} }
    SubShader
    {
        Cull Off ZWrite Off ZTest Always
        Pass
        {
            CGPROGRAM
            #pragma vertex vert_img
            #pragma fragment frag
            #include "UnityCG.cginc"
            sampler2D _MainTex;
            float4 _MainTex_TexelSize;
            fixed4 frag(v2f_img i) : SV_Target
            {
                float2 uv = i.uv;
                float2 step = _MainTex_TexelSize.xy * 2.5;
                fixed4 sharp = tex2D(_MainTex, uv);
                fixed4 soft = sharp * .28;
                soft += tex2D(_MainTex, uv + float2(step.x, 0)) * .18;
                soft += tex2D(_MainTex, uv - float2(step.x, 0)) * .18;
                soft += tex2D(_MainTex, uv + float2(0, step.y)) * .18;
                soft += tex2D(_MainTex, uv - float2(0, step.y)) * .18;
                float edge = smoothstep(.58, .98, max(abs(uv.x * 2 - 1), abs(uv.y * 2 - 1)));
                return lerp(sharp, soft, edge * .85);
            }
            ENDCG
        }
    }
}
