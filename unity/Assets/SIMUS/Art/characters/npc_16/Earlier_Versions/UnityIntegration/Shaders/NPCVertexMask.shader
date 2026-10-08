Shader "SIMUS/NPCVertexMask"
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
  Tags { "RenderType"="Opaque" }
  LOD 150
  CGPROGRAM
  #pragma surface surf Lambert vertex:vert addshadow
  #pragma target 3.0
  #pragma multi_compile_instancing
  UNITY_INSTANCING_BUFFER_START(NPCProperties)
   UNITY_DEFINE_INSTANCED_PROP(float4, _PrimaryColor)
   UNITY_DEFINE_INSTANCED_PROP(float4, _SecondaryColor)
   UNITY_DEFINE_INSTANCED_PROP(float4, _NeutralColor)
   UNITY_DEFINE_INSTANCED_PROP(float4, _SkinColor)
   UNITY_DEFINE_INSTANCED_PROP(float4, _HairColor)
  UNITY_INSTANCING_BUFFER_END(NPCProperties)
  struct Input { float4 mask; };
  void vert(inout appdata_full v, out Input o) { UNITY_INITIALIZE_OUTPUT(Input,o); o.mask=v.color; }
  void surf(Input i,inout SurfaceOutput o)
  {
   float4 m=saturate(i.mask);
   half3 c=UNITY_ACCESS_INSTANCED_PROP(NPCProperties,_NeutralColor).rgb;
   c=lerp(c,UNITY_ACCESS_INSTANCED_PROP(NPCProperties,_PrimaryColor).rgb,m.r);
   c=lerp(c,UNITY_ACCESS_INSTANCED_PROP(NPCProperties,_SecondaryColor).rgb,m.g);
   c=lerp(c,UNITY_ACCESS_INSTANCED_PROP(NPCProperties,_SkinColor).rgb,m.b);
   c=lerp(c,UNITY_ACCESS_INSTANCED_PROP(NPCProperties,_HairColor).rgb,m.a);
   o.Albedo=c;o.Alpha=1;
  }
  ENDCG
 }
 FallBack "Diffuse"
}
