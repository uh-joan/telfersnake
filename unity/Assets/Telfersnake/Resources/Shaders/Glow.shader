// Unlit, vertex-coloured effects: particles, rings, sparkles, the speech-bubble tails.
// _Shape 0 = soft round blob, 1 = sparkle star, 2 = ring (uv), 3 = solid (use the mesh as-is).
// HDR colours above 1 feed the bloom.
Shader "Telfer/Glow"
{
    Properties
    {
        _Color ("Colour", Color) = (1,1,1,1)
        _Intensity ("Intensity", Float) = 1
        _Shape ("Shape", Float) = 0
        [Enum(UnityEngine.Rendering.BlendMode)] _SrcBlend ("Src", Float) = 5
        [Enum(UnityEngine.Rendering.BlendMode)] _DstBlend ("Dst", Float) = 10
        _ZWrite ("ZWrite", Float) = 0
    }

    SubShader
    {
        Tags { "Queue"="Transparent" "RenderType"="Transparent" "RenderPipeline"="UniversalPipeline" "IgnoreProjector"="True" }
        Blend [_SrcBlend] [_DstBlend]
        ZWrite [_ZWrite]
        Cull Off

        Pass
        {
            Tags { "LightMode"="UniversalForward" }
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_instancing
            #pragma multi_compile_fog
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            CBUFFER_START(UnityPerMaterial)
                float4 _Color;
                float _Intensity;
                float _Shape;
                float _SrcBlend, _DstBlend, _ZWrite;
            CBUFFER_END

            struct Attributes { float4 positionOS : POSITION; float4 color : COLOR; float2 uv : TEXCOORD0; UNITY_VERTEX_INPUT_INSTANCE_ID };
            struct Varyings { float4 positionCS : SV_POSITION; float4 color : TEXCOORD0; float2 uv : TEXCOORD1; float fog : TEXCOORD2; };

            Varyings vert(Attributes v)
            {
                Varyings o;
                UNITY_SETUP_INSTANCE_ID(v);
                o.positionCS = TransformObjectToHClip(v.positionOS.xyz);
                o.color = v.color * _Color;
                o.uv = v.uv;
                o.fog = ComputeFogFactor(o.positionCS.z);
                return o;
            }

            half4 frag(Varyings i) : SV_Target
            {
                float2 p = i.uv * 2.0 - 1.0;
                float r = length(p);
                half a = 1;
                if (_Shape < 0.5)
                {
                    a = saturate(1.0 - r);
                    a = a * a * (3.0 - 2.0 * a);
                }
                else if (_Shape < 1.5)
                {
                    float star = max(saturate(1.0 - abs(p.x) * 7.0) * saturate(1.0 - abs(p.y)), saturate(1.0 - abs(p.y) * 7.0) * saturate(1.0 - abs(p.x)));
                    a = saturate(star + saturate(1.0 - r * 2.2));
                }
                else if (_Shape < 2.5)
                {
                    a = saturate(1.0 - abs(r - 0.82) * 9.0);
                }
                half4 c = i.color;
                c.rgb *= _Intensity;
                c.a *= a;
                return c;
            }
            ENDHLSL
        }
    }
}
