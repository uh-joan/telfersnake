// Snake skin. The body mesh is a tube whose uv.x is metres back from the head and uv.y
// goes once around (0 = the spine on top). From that alone it draws chevron bands that
// point at the head, a cream belly, overlapping scales with a fake bump, a wet gloss,
// and a pulse of light that races down the body while dashing.
Shader "Telfer/Snake"
{
    Properties
    {
        _BodyColor ("Body", Color) = (0.3,0.73,0.29,1)
        _StripeColor ("Stripe", Color) = (0.95,0.85,0.29,1)
        _BellyColor ("Belly", Color) = (1,0.95,0.78,1)
        _Radius ("Radius", Float) = 0.4
        _ScaleBump ("Scale Bump", Range(0,1.5)) = 0.6
        _Gloss ("Gloss", Range(0,2)) = 0.9
        _Smoothness ("Smoothness", Range(0,1)) = 0.72
        _RimStrength ("Rim", Range(0,2)) = 0.55
        _Glow ("Dash Glow", Range(0,2)) = 0
        _Flash ("Flash", Range(0,1)) = 0
        _Gold ("Gold", Range(0,1)) = 0
        _XRay ("X-Ray Silhouette", Range(0,1)) = 0
        _PCount ("Pattern Colours (0 = chevrons)", Float) = 0
        _P0 ("P0", Color) = (1,1,1,1)
        _P1 ("P1", Color) = (1,1,1,1)
        _P2 ("P2", Color) = (1,1,1,1)
        _P3 ("P3", Color) = (1,1,1,1)
        _P4 ("P4", Color) = (1,1,1,1)
        _P5 ("P5", Color) = (1,1,1,1)
        _P6 ("P6", Color) = (1,1,1,1)
        _P7 ("P7", Color) = (1,1,1,1)
        _Ghost ("Ghost (dither)", Range(0,1)) = 0
        _Ice ("Frozen", Range(0,1)) = 0
        _Rainbow ("Rainbow", Range(0,1)) = 0
        _XRayColor ("X-Ray Colour", Color) = (1,1,1,1)
    }

    SubShader
    {
        Tags { "RenderType"="Opaque" "RenderPipeline"="UniversalPipeline" "Queue"="Geometry+20" }

        HLSLINCLUDE
        #include "TelferCommon.hlsl"
        CBUFFER_START(UnityPerMaterial)
            float4 _BodyColor;
            float4 _StripeColor;
            float4 _BellyColor;
            float _Radius;
            float _ScaleBump;
            float _Gloss;
            float _Smoothness;
            float _RimStrength;
            float _Glow;
            float _Flash;
            float _Gold;
            float _XRay;
            float4 _XRayColor;
            float _PCount;
            float4 _P0, _P1, _P2, _P3, _P4, _P5, _P6, _P7;
            float _Ghost, _Ice, _Rainbow;
        CBUFFER_END

        half3 PatternColour(float seg)
        {
            int n = max(1, (int)_PCount);
            int i = (int)fmod(max(seg, 0.0), (float)n);
            half3 c = _P0.rgb;
            c = i == 1 ? _P1.rgb : c; c = i == 2 ? _P2.rgb : c; c = i == 3 ? _P3.rgb : c;
            c = i == 4 ? _P4.rgb : c; c = i == 5 ? _P5.rgb : c; c = i == 6 ? _P6.rgb : c; c = i == 7 ? _P7.rgb : c;
            return c;
        }

        void GhostClip(float4 positionCS)
        {
            if (_Ghost > 0.001)
            {
                float2 p = floor(fmod(positionCS.xy, 4.0));
                float4x4 bayer = float4x4(0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
                clip((1.0 - _Ghost) - (bayer[(int)p.x][(int)p.y] + 0.5) / 16.0);
            }
        }
        ENDHLSL

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode"="UniversalForward" }
            Cull Back

            HLSLPROGRAM
            #pragma target 3.0
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile_fragment _ _SHADOWS_SOFT _SHADOWS_SOFT_LOW _SHADOWS_SOFT_MEDIUM _SHADOWS_SOFT_HIGH
            #pragma multi_compile_fragment _ _SCREEN_SPACE_OCCLUSION
            #pragma multi_compile_fog

            struct Attributes
            {
                float4 positionOS : POSITION;
                float3 normalOS : NORMAL;
                float4 tangentOS : TANGENT;
                float4 color : COLOR;
                float2 uv : TEXCOORD0;
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float3 positionWS : TEXCOORD0;
                float3 normalWS : TEXCOORD1;
                float3 tangentWS : TEXCOORD2;
                float4 color : TEXCOORD3;
                float2 uv : TEXCOORD4;
                float fog : TEXCOORD5;
            };

            Varyings vert(Attributes v)
            {
                Varyings o;
                float3 ws = TransformObjectToWorld(v.positionOS.xyz);
                o.positionWS = ws;
                o.positionCS = TransformWorldToHClip(ws);
                o.normalWS = TransformObjectToWorldNormal(v.normalOS);
                o.tangentWS = TransformObjectToWorldDir(v.tangentOS.xyz);
                o.color = v.color;
                o.uv = v.uv;
                o.fog = ComputeFogFactor(o.positionCS.z);
                return o;
            }

            half4 frag(Varyings i) : SV_Target
            {
                GhostClip(i.positionCS);
                float along = i.uv.x;
                float around = i.uv.y;
                float r = max(_Radius, 0.15);
                float spine = abs(frac(around + 0.5) - 0.5) * 2.0;   // 0 on top, 1 underneath
                half pattern = i.color.a;                               // 0 on the plain parts of the head

                // Chevron bands pointing at the head.
                float period = max(0.45, r * 3.6);
                float chev = frac((along + spine * r * 1.4) / period);
                half band = smoothstep(0.0, 0.06, chev) * (1.0 - smoothstep(0.24, 0.30, chev));
                // A thin dark edge either side of each band.
                half edge = (smoothstep(0.30, 0.31, chev) * (1.0 - smoothstep(0.31, 0.36, chev)) +
                             (1.0 - smoothstep(0.0, 0.05, chev)) * smoothstep(-0.01, 0.0, chev));
                // Dots down the spine between the bands.
                float dotsZ = frac(along / period + 0.62) - 0.5;
                half dots = 1.0 - smoothstep(0.08, 0.13, length(float2(dotsZ * period / r, spine * 3.2)));

                half belly = smoothstep(0.62, 0.8, spine);
                half3 col = _BodyColor.rgb;
                if (_PCount > 0.5)
                {
                    // A Tuck Shop skin: repeating colour bands, each a body-segment long, gently chevroned.
                    float seg = floor((along + spine * r * 0.7) / max(0.3, r * 1.7));
                    col = lerp(col, PatternColour(seg), pattern);
                }
                else
                {
                    col = lerp(col, _StripeColor.rgb, band * pattern);
                    col = lerp(col, _StripeColor.rgb * 1.05, dots * pattern * 0.85);
                    col *= 1.0 - edge * 0.25 * pattern;
                }
                if (_Rainbow > 0.001)
                {
                    float h = frac(along * 0.12 - _Time.y * 0.6);
                    half3 rb = saturate(abs(frac(h + float3(0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0) - 1.0);
                    col = lerp(col, rb * 0.9 + 0.1, _Rainbow * 0.75 * pattern);
                }
                col = lerp(col, _BellyColor.rgb, belly * pattern);
                col *= i.color.rgb;

                // Scales: offset rows of rounded cells, darkened at the seams, bumped in the middle.
                float circ = 6.2831853 * r;
                float s = max(0.08, r * 0.42);
                float2 p = float2(along / s, around * circ / s);
                float row = floor(p.y);
                p.x += fmod(row, 2.0) * 0.5;
                float2 cell = frac(p) - 0.5;
                cell.x *= 1.25;
                float d = length(cell);
                half seam = smoothstep(0.38, 0.52, d);
                col *= 1.0 - seam * 0.22 * pattern;
                float2 grad = cell * (1.0 - smoothstep(0.2, 0.55, d));

                float3 n = normalize(i.normalWS);
                float3 t = normalize(i.tangentWS - n * dot(i.tangentWS, n));
                float3 b = cross(n, t);
                n = normalize(n + (t * grad.x + b * grad.y) * _ScaleBump * pattern);

                // Golden shimmer (the Dragon, or a golden skin).
                half3 gold = half3(1.0, 0.78, 0.25);
                col = lerp(col, gold * (0.8 + 0.4 * (1.0 - seam)), _Gold);
                col = lerp(col, half3(0.7, 0.9, 1.0), _Ice * 0.75);

                TelferSurface sf;
                sf.albedo = col;
                sf.normalWS = n;
                sf.viewWS = normalize(GetWorldSpaceViewDir(i.positionWS));
                sf.positionWS = i.positionWS;
                sf.gloss = _Gloss * (1.0 - seam * 0.6);
                sf.smoothness = _Smoothness;
                sf.rim = lerp(_BodyColor.rgb, half3(1, 1, 1), 0.5) * _RimStrength;
                sf.rimPower = 2.6;
                float pulse = 0.5 + 0.5 * sin(along * 2.2 - _Time.y * 22.0);
                sf.emission = (_StripeColor.rgb * 0.6 + _BodyColor.rgb * 0.4) * _Glow * (0.35 + 0.9 * pulse * pulse)
                            + _Flash * half3(1.2, 1.2, 1.1) + _Ice * half3(0.2, 0.35, 0.5) + _Rainbow * col * 0.35;
                sf.occlusion = 1.0;
                sf.translucency = 0.08;

                half3 c = TelferShade(sf, i.positionCS);
                c = MixFog(c, i.fog);
                return half4(c, 1);
            }
            ENDHLSL
        }


        // Seen through a wall: a soft glowing silhouette, so a child never loses their snake.
        Pass
        {
            Name "XRay"
            Tags { "LightMode"="SRPDefaultUnlit" }
            ZTest Greater ZWrite Off
            Blend SrcAlpha OneMinusSrcAlpha
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; };
            struct Varyings { float4 positionCS : SV_POSITION; float3 normalWS : TEXCOORD0; float3 positionWS : TEXCOORD1; };
            Varyings vert(Attributes v)
            {
                Varyings o;
                o.positionWS = TransformObjectToWorld(v.positionOS.xyz);
                o.positionCS = TransformWorldToHClip(o.positionWS);
                o.normalWS = TransformObjectToWorldNormal(v.normalOS);
                return o;
            }
            half4 frag(Varyings i) : SV_Target
            {
                float3 v = normalize(GetWorldSpaceViewDir(i.positionWS));
                half f = 1.0 - saturate(dot(normalize(i.normalWS), v));
                half a = (0.35 + f * 0.65) * _XRay;
                return half4(_XRayColor.rgb * (0.8 + f), a);
            }
            ENDHLSL
        }

        Pass
        {
            Name "ShadowCaster"
            Tags { "LightMode"="ShadowCaster" }
            ZWrite On ZTest LEqual ColorMask 0

            HLSLPROGRAM
            #pragma target 3.0
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_vertex _ _CASTING_PUNCTUAL_LIGHT_SHADOW
            float3 _LightDirection;
            float3 _LightPosition;
            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; };
            struct Varyings { float4 positionCS : SV_POSITION; };
            Varyings vert(Attributes v)
            {
                Varyings o;
                float3 ws = TransformObjectToWorld(v.positionOS.xyz);
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
            half4 frag(Varyings i) : SV_Target { return 0; }
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
            struct Attributes { float4 positionOS : POSITION; };
            struct Varyings { float4 positionCS : SV_POSITION; };
            Varyings vert(Attributes v) { Varyings o; o.positionCS = TransformObjectToHClip(v.positionOS.xyz); return o; }
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
            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; };
            struct Varyings { float4 positionCS : SV_POSITION; float3 normalWS : TEXCOORD0; };
            Varyings vert(Attributes v) { Varyings o; o.positionCS = TransformObjectToHClip(v.positionOS.xyz); o.normalWS = TransformObjectToWorldNormal(v.normalOS); return o; }
            half4 frag(Varyings i) : SV_Target { return half4(NormalizeNormalPerPixel(i.normalWS), 0.0); }
            ENDHLSL
        }
    }
}
