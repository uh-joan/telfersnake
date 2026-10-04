// The house shader for nearly everything: vertex-coloured, optionally textured, with
// soft stylised light, cool shadows, cloud shadows, gloss, rim and a little wind.
Shader "Telfer/Toon"
{
    Properties
    {
        _BaseColor ("Base Colour", Color) = (1,1,1,1)
        _BaseMap ("Base Map", 2D) = "white" {}
        _DetailMap ("Detail (world XZ)", 2D) = "gray" {}
        _DetailScale ("Detail Scale", Float) = 0.5
        _DetailStrength ("Detail Strength", Range(0,1)) = 0
        _UseVertexColor ("Use Vertex Colour", Range(0,1)) = 1
        _Gloss ("Gloss", Range(0,2)) = 0.15
        _Smoothness ("Smoothness", Range(0,1)) = 0.3
        _RimColor ("Rim Colour", Color) = (1,1,1,1)
        _RimStrength ("Rim Strength", Range(0,2)) = 0.25
        _RimPower ("Rim Power", Range(0.5,8)) = 3
        _EmissionColor ("Emission", Color) = (0,0,0,0)
        _Translucency ("Translucency", Range(0,1)) = 0
        _WindAmount ("Wind Amount", Range(0,2)) = 0
        _WindHeight ("Wind Height Scale", Float) = 0.3
        _HueJitter ("World Hue Jitter", Range(0,1)) = 0
        _Flash ("Flash", Range(0,1)) = 0
        _Fade ("Fade (dither)", Range(0,1)) = 1
        _ChainLink ("Chain Link Cells (0 off)", Float) = 0
        _Cull ("Cull", Float) = 2
    }

    SubShader
    {
        Tags { "RenderType"="Opaque" "RenderPipeline"="UniversalPipeline" "Queue"="Geometry" }

        HLSLINCLUDE
        #include "TelferCommon.hlsl"

        CBUFFER_START(UnityPerMaterial)
            float4 _BaseColor;
            float4 _BaseMap_ST;
            float _DetailScale;
            float _DetailStrength;
            float _UseVertexColor;
            float _Gloss;
            float _Smoothness;
            float4 _RimColor;
            float _RimStrength;
            float _RimPower;
            float4 _EmissionColor;
            float _Translucency;
            float _WindAmount;
            float _WindHeight;
            float _HueJitter;
            float _Flash;
            float _Fade;
            float _ChainLink;
            float _Cull;
        CBUFFER_END

        TEXTURE2D(_BaseMap); SAMPLER(sampler_BaseMap);
        TEXTURE2D(_DetailMap); SAMPLER(sampler_DetailMap);

        // Screen-door fade, so a wall can let the snake be seen without going transparent.
        void FadeClip(float4 positionCS)
        {
            if (_Fade < 0.999)
            {
                float2 p = floor(fmod(positionCS.xy, 4.0));
                float4x4 bayer = float4x4(0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
                float t = (bayer[(int)p.x][(int)p.y] + 0.5) / 16.0;
                clip(_Fade - t);
            }
        }

        // Diamond chain-link mesh cut from the uv: wires stay, holes go (shadows too).
        void ChainClip(float2 uv)
        {
            if (_ChainLink > 0)
            {
                float2 g = uv * _ChainLink;
                float a = abs(frac(g.x + g.y) - 0.5);
                float b = abs(frac(g.x - g.y) - 0.5);
                clip(0.09 - min(a, b));
            }
        }

        float3 DeformWS(float3 positionOS, float3 positionWS)
        {
            if (_WindAmount > 0.0)
            {
                float w = saturate(positionOS.y * _WindHeight) * _WindAmount;
                positionWS += TelferWindOffset(positionWS, w * w);
            }
            return positionWS;
        }
        ENDHLSL

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode"="UniversalForward" }
            Cull [_Cull]

            HLSLPROGRAM
            #pragma target 3.0
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile_fragment _ _SHADOWS_SOFT _SHADOWS_SOFT_LOW _SHADOWS_SOFT_MEDIUM _SHADOWS_SOFT_HIGH
            #pragma multi_compile_fragment _ _SCREEN_SPACE_OCCLUSION
            #pragma multi_compile_fog
            #pragma multi_compile_instancing

            struct Attributes
            {
                float4 positionOS : POSITION;
                float3 normalOS : NORMAL;
                float4 color : COLOR;
                float2 uv : TEXCOORD0;
                UNITY_VERTEX_INPUT_INSTANCE_ID
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float3 positionWS : TEXCOORD0;
                float3 normalWS : TEXCOORD1;
                float4 color : TEXCOORD2;
                float2 uv : TEXCOORD3;
                float fog : TEXCOORD4;
                float heightOS : TEXCOORD5;
                UNITY_VERTEX_INPUT_INSTANCE_ID
            };

            Varyings vert(Attributes v)
            {
                Varyings o;
                UNITY_SETUP_INSTANCE_ID(v);
                UNITY_TRANSFER_INSTANCE_ID(v, o);
                float3 ws = TransformObjectToWorld(v.positionOS.xyz);
                ws = DeformWS(v.positionOS.xyz, ws);
                o.positionWS = ws;
                o.positionCS = TransformWorldToHClip(ws);
                o.normalWS = TransformObjectToWorldNormal(v.normalOS);
                o.color = v.color;
                o.uv = TRANSFORM_TEX(v.uv, _BaseMap);
                o.fog = ComputeFogFactor(o.positionCS.z);
                o.heightOS = v.positionOS.y;
                return o;
            }

            half4 frag(Varyings i, bool front : SV_IsFrontFace) : SV_Target
            {
                UNITY_SETUP_INSTANCE_ID(i);
                FadeClip(i.positionCS);
                ChainClip(i.uv);
                half4 tex = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, i.uv);
                half3 vcol = lerp(half3(1,1,1), i.color.rgb, _UseVertexColor);
                half3 albedo = tex.rgb * _BaseColor.rgb * vcol;

                if (_DetailStrength > 0)
                {
                    half d = SAMPLE_TEXTURE2D(_DetailMap, sampler_DetailMap, i.positionWS.xz * _DetailScale).r;
                    half d2 = SAMPLE_TEXTURE2D(_DetailMap, sampler_DetailMap, i.positionWS.xz * _DetailScale * 0.137 + 0.31).r;
                    albedo *= lerp(1.0, (d * 0.6 + d2 * 0.4) * 2.0, _DetailStrength);
                }
                if (_HueJitter > 0)
                {
                    half n = TelferNoise(i.positionWS.xz * 0.35) - 0.5;
                    albedo *= 1.0 + n * _HueJitter * half3(0.7, 1.0, 0.5);
                }

                TelferSurface s;
                s.albedo = albedo;
                float3 n = normalize(i.normalWS);
                s.normalWS = front ? n : -n;
                s.viewWS = normalize(GetWorldSpaceViewDir(i.positionWS));
                s.positionWS = i.positionWS;
                s.gloss = _Gloss;
                s.smoothness = _Smoothness;
                s.rim = _RimColor.rgb * _RimStrength;
                s.rimPower = _RimPower;
                s.emission = _EmissionColor.rgb + _Flash * half3(1.4, 1.4, 1.4);
                s.occlusion = lerp(1.0, i.color.a, _UseVertexColor);
                s.translucency = _Translucency;

                half3 c = TelferShade(s, i.positionCS);
                c = MixFog(c, i.fog);
                return half4(c, 1);
            }
            ENDHLSL
        }

        Pass
        {
            Name "ShadowCaster"
            Tags { "LightMode"="ShadowCaster" }
            ZWrite On ZTest LEqual ColorMask 0
            Cull [_Cull]

            HLSLPROGRAM
            #pragma target 3.0
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_instancing
            #pragma multi_compile_vertex _ _CASTING_PUNCTUAL_LIGHT_SHADOW

            float3 _LightDirection;
            float3 _LightPosition;

            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; float2 uv : TEXCOORD0; UNITY_VERTEX_INPUT_INSTANCE_ID };
            struct Varyings { float4 positionCS : SV_POSITION; float2 uv : TEXCOORD0; };

            Varyings vert(Attributes v)
            {
                Varyings o;
                UNITY_SETUP_INSTANCE_ID(v);
                o.uv = TRANSFORM_TEX(v.uv, _BaseMap);
                float3 ws = DeformWS(v.positionOS.xyz, TransformObjectToWorld(v.positionOS.xyz));
                float3 nws = TransformObjectToWorldNormal(v.normalOS);
                #if _CASTING_PUNCTUAL_LIGHT_SHADOW
                    float3 ld = normalize(_LightPosition - ws);
                #else
                    float3 ld = _LightDirection;
                #endif
                float4 cs = TransformWorldToHClip(ApplyShadowBias(ws, nws, ld));
                #if UNITY_REVERSED_Z
                    cs.z = min(cs.z, UNITY_NEAR_CLIP_VALUE);
                #else
                    cs.z = max(cs.z, UNITY_NEAR_CLIP_VALUE);
                #endif
                o.positionCS = cs;
                return o;
            }

            half4 frag(Varyings i) : SV_Target { ChainClip(i.uv); return 0; }
            ENDHLSL
        }

        Pass
        {
            Name "DepthOnly"
            Tags { "LightMode"="DepthOnly" }
            ZWrite On ColorMask R
            Cull [_Cull]

            HLSLPROGRAM
            #pragma target 3.0
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_instancing

            struct Attributes { float4 positionOS : POSITION; float2 uv : TEXCOORD0; UNITY_VERTEX_INPUT_INSTANCE_ID };
            struct Varyings { float4 positionCS : SV_POSITION; float2 uv : TEXCOORD0; };

            Varyings vert(Attributes v)
            {
                Varyings o;
                UNITY_SETUP_INSTANCE_ID(v);
                float3 ws = DeformWS(v.positionOS.xyz, TransformObjectToWorld(v.positionOS.xyz));
                o.positionCS = TransformWorldToHClip(ws);
                o.uv = TRANSFORM_TEX(v.uv, _BaseMap);
                return o;
            }

            half4 frag(Varyings i) : SV_Target { FadeClip(i.positionCS); ChainClip(i.uv); return 0; }
            ENDHLSL
        }

        Pass
        {
            Name "DepthNormals"
            Tags { "LightMode"="DepthNormals" }
            ZWrite On
            Cull [_Cull]

            HLSLPROGRAM
            #pragma target 3.0
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_instancing

            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; float2 uv : TEXCOORD0; UNITY_VERTEX_INPUT_INSTANCE_ID };
            struct Varyings { float4 positionCS : SV_POSITION; float3 normalWS : TEXCOORD0; float2 uv : TEXCOORD1; };

            Varyings vert(Attributes v)
            {
                Varyings o;
                UNITY_SETUP_INSTANCE_ID(v);
                float3 ws = DeformWS(v.positionOS.xyz, TransformObjectToWorld(v.positionOS.xyz));
                o.positionCS = TransformWorldToHClip(ws);
                o.normalWS = TransformObjectToWorldNormal(v.normalOS);
                o.uv = TRANSFORM_TEX(v.uv, _BaseMap);
                return o;
            }

            half4 frag(Varyings i) : SV_Target { FadeClip(i.positionCS); ChainClip(i.uv); return half4(NormalizeNormalPerPixel(i.normalWS), 0.0); }
            ENDHLSL
        }
    }
}
