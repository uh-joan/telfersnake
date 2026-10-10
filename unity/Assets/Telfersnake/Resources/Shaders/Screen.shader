// A self-lit picture: Piccadilly Circus's light screens. Unshaded, the texture times an HDR
// intensity so the bright panels feed the bloom; screen-door fades like the Toon shader.
Shader "Telfer/Screen"
{
    Properties
    {
        _BaseMap ("Picture", 2D) = "white" {}
        _Intensity ("Intensity", Float) = 1.6
        _Fade ("Fade (dither)", Range(0,1)) = 1
    }

    SubShader
    {
        Tags { "RenderType"="Opaque" "RenderPipeline"="UniversalPipeline" "Queue"="Geometry" }

        Pass
        {
            Name "Screen"
            Tags { "LightMode"="UniversalForward" }

            HLSLPROGRAM
            #pragma target 3.0
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_fog
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            CBUFFER_START(UnityPerMaterial)
                float4 _BaseMap_ST;
                float _Intensity;
                float _Fade;
            CBUFFER_END
            TEXTURE2D(_BaseMap); SAMPLER(sampler_BaseMap);

            struct Attributes { float4 positionOS : POSITION; float2 uv : TEXCOORD0; };
            struct Varyings { float4 positionCS : SV_POSITION; float2 uv : TEXCOORD0; float fog : TEXCOORD1; };

            Varyings vert(Attributes v)
            {
                Varyings o;
                o.positionCS = TransformObjectToHClip(v.positionOS.xyz);
                o.uv = TRANSFORM_TEX(v.uv, _BaseMap);
                o.fog = ComputeFogFactor(o.positionCS.z);
                return o;
            }

            half4 frag(Varyings i) : SV_Target
            {
                if (_Fade < 0.999)
                {
                    float2 p = floor(fmod(i.positionCS.xy, 4.0));
                    float4x4 bayer = float4x4(0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
                    clip(_Fade - (bayer[(int)p.x][(int)p.y] + 0.5) / 16.0);
                }
                half3 c = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, i.uv).rgb * _Intensity;
                return half4(MixFog(c, i.fog), 1);
            }
            ENDHLSL
        }
    }
}
