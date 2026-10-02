// Instanced grass tufts. uv.y is 0 at the root and 1 at the tip: the tip sways in the wind
// and is pushed aside (and flattened) by anything in _TelferPushers — snakes, animals, Mr Cooper.
Shader "Telfer/Grass"
{
    Properties
    {
        _RootColor ("Root", Color) = (0.16,0.42,0.12,1)
        _TipColor ("Tip", Color) = (0.62,0.86,0.33,1)
        _DryColor ("Dry Tip", Color) = (0.86,0.82,0.42,1)
        _Sway ("Sway", Float) = 0.25
    }

    SubShader
    {
        Tags { "RenderType"="Opaque" "RenderPipeline"="UniversalPipeline" "Queue"="Geometry" }
        Cull Off

        HLSLINCLUDE
        #include "TelferCommon.hlsl"
        CBUFFER_START(UnityPerMaterial)
            float4 _RootColor;
            float4 _TipColor;
            float4 _DryColor;
            float _Sway;
        CBUFFER_END

        float3 GrassDeform(float3 ws, float h, float3 rootWS)
        {
            float w = h * h;
            ws += TelferWindOffset(rootWS, w * _Sway * 4.0);
            int count = (int)_TelferPusherCount;
            for (int k = 0; k < 16; k++)
            {
                if (k >= count) break;
                float4 p = _TelferPushers[k];
                float2 d = rootWS.xz - p.xz;
                float dist = length(d);
                float r = p.w + 0.35;
                float push = saturate(1.0 - dist / r);
                if (push > 0)
                {
                    float2 dir = d / max(dist, 1e-3);
                    ws.xz += dir * push * w * 0.55;
                    ws.y -= push * w * 0.45;
                }
            }
            return ws;
        }
        ENDHLSL

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode"="UniversalForward" }

            HLSLPROGRAM
            #pragma target 3.0
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile_fragment _ _SHADOWS_SOFT _SHADOWS_SOFT_LOW _SHADOWS_SOFT_MEDIUM _SHADOWS_SOFT_HIGH
            #pragma multi_compile_fog
            #pragma multi_compile_instancing

            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; float2 uv : TEXCOORD0; UNITY_VERTEX_INPUT_INSTANCE_ID };
            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float3 positionWS : TEXCOORD0;
                float3 normalWS : TEXCOORD1;
                float h : TEXCOORD2;
                float vary : TEXCOORD3;
                float fog : TEXCOORD4;
            };

            Varyings vert(Attributes v)
            {
                Varyings o;
                UNITY_SETUP_INSTANCE_ID(v);
                float3 root = TransformObjectToWorld(float3(0, 0, 0));
                float3 ws = TransformObjectToWorld(v.positionOS.xyz);
                ws = GrassDeform(ws, v.uv.y, root);
                o.positionWS = ws;
                o.positionCS = TransformWorldToHClip(ws);
                // Blades lean toward the sky for lighting: reads as a soft lawn rather than cards.
                o.normalWS = normalize(lerp(TransformObjectToWorldNormal(v.normalOS), float3(0, 1, 0), 0.65));
                o.h = v.uv.y;
                o.vary = TelferHash(root.xz * 0.731);
                o.fog = ComputeFogFactor(o.positionCS.z);
                return o;
            }

            half4 frag(Varyings i) : SV_Target
            {
                half3 tip = lerp(_TipColor.rgb, _DryColor.rgb, saturate(i.vary * 1.6 - 0.9));
                half patch = TelferNoise(i.positionWS.xz * 0.25);
                tip *= 0.85 + patch * 0.3;
                half3 albedo = lerp(_RootColor.rgb, tip, smoothstep(0.0, 1.0, i.h));

                TelferSurface s;
                s.albedo = albedo;
                s.normalWS = normalize(i.normalWS);
                s.viewWS = normalize(GetWorldSpaceViewDir(i.positionWS));
                s.positionWS = i.positionWS;
                s.gloss = 0.05;
                s.smoothness = 0.2;
                s.rim = half3(0.0, 0.0, 0.0);
                s.rimPower = 3;
                s.emission = 0;
                s.occlusion = lerp(0.55, 1.0, i.h);
                s.translucency = 0.5 * i.h;
                half3 c = TelferShade(s, i.positionCS);
                return half4(MixFog(c, i.fog), 1);
            }
            ENDHLSL
        }

        Pass
        {
            Name "DepthOnly"
            Tags { "LightMode"="DepthOnly" }
            ZWrite On ColorMask R
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_instancing
            struct Attributes { float4 positionOS : POSITION; float2 uv : TEXCOORD0; UNITY_VERTEX_INPUT_INSTANCE_ID };
            struct Varyings { float4 positionCS : SV_POSITION; };
            Varyings vert(Attributes v)
            {
                Varyings o;
                UNITY_SETUP_INSTANCE_ID(v);
                float3 root = TransformObjectToWorld(float3(0, 0, 0));
                float3 ws = GrassDeform(TransformObjectToWorld(v.positionOS.xyz), v.uv.y, root);
                o.positionCS = TransformWorldToHClip(ws);
                return o;
            }
            half4 frag(Varyings i) : SV_Target { return 0; }
            ENDHLSL
        }

        Pass
        {
            Name "DepthNormals"
            Tags { "LightMode"="DepthNormals" }
            ZWrite On
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_instancing
            struct Attributes { float4 positionOS : POSITION; float2 uv : TEXCOORD0; UNITY_VERTEX_INPUT_INSTANCE_ID };
            struct Varyings { float4 positionCS : SV_POSITION; };
            Varyings vert(Attributes v)
            {
                Varyings o;
                UNITY_SETUP_INSTANCE_ID(v);
                float3 root = TransformObjectToWorld(float3(0, 0, 0));
                float3 ws = GrassDeform(TransformObjectToWorld(v.positionOS.xyz), v.uv.y, root);
                o.positionCS = TransformWorldToHClip(ws);
                return o;
            }
            half4 frag(Varyings i) : SV_Target { return half4(0, 1, 0, 0); }
            ENDHLSL
        }
    }
}
