// The Thames: cartoon water for London's paper map. uv.x is metres downstream, uv.y metres across
// from the centre line, so from those alone it paints the deep teal with lighter shallows by the
// banks, rows of white "~" wave strokes drifting downstream (as the classic game's water does), a
// frothy fringe along the embankments, sun glints off a procedural ripple, a fresnel sky reflection
// and the cloud and building shadows. The surface bobs gently.
Shader "Telfer/Thames"
{
    Properties
    {
        _Deep ("Deep", Color) = (0.12,0.54,0.59,1)
        _Light ("Shallows", Color) = (0.44,0.82,0.81,1)
        _Sky ("Sky Reflection", Color) = (0.78,0.88,0.96,1)
        _Half ("Half Width (m)", Float) = 7
        _Flow ("Drift (m/s)", Float) = 0.45
    }

    SubShader
    {
        Tags { "RenderType"="Opaque" "RenderPipeline"="UniversalPipeline" "Queue"="Geometry" }

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
            #include "TelferCommon.hlsl"

            CBUFFER_START(UnityPerMaterial)
                float4 _Deep;
                float4 _Light;
                float4 _Sky;
                float _Half;
                float _Flow;
            CBUFFER_END

            struct Attributes { float4 positionOS : POSITION; float2 uv : TEXCOORD0; };
            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float3 positionWS : TEXCOORD0;
                float2 uv : TEXCOORD1;
                float fog : TEXCOORD2;
            };

            Varyings vert(Attributes v)
            {
                Varyings o;
                float3 ws = TransformObjectToWorld(v.positionOS.xyz);
                ws.y += sin(_Time.y * 0.9 + ws.x * 0.05) * 0.02;
                o.positionWS = ws;
                o.positionCS = TransformWorldToHClip(ws);
                o.uv = v.uv;
                o.fog = ComputeFogFactor(o.positionCS.z);
                return o;
            }

            half4 frag(Varyings i) : SV_Target
            {
                float s = i.uv.x - _Time.y * _Flow;      // metres downstream, drifting
                float across = i.uv.y;
                float w = across + _Half;                // metres from the south bank
                float edge = smoothstep(_Half - 1.8, _Half - 0.1, abs(across));
                half3 col = lerp(_Deep.rgb, _Light.rgb, edge * 0.85);

                // Rows of cartoon "~" strokes: a sine line chopped into short dashes, staggered per row.
                float rowH = 2.4;
                float ri = floor(w / rowH);
                float ly = w - (ri + 0.5) * rowH;
                float d = abs(ly - 0.22 * sin(s * 1.5 + ri * 2.1));
                float aa = fwidth(d) + 0.005;
                float line_ = 1.0 - smoothstep(0.07, 0.07 + aa, d);
                float f = frac((s + ri * 1.73) / 4.2);
                float dash = smoothstep(0.0, 0.05, f) * (1.0 - smoothstep(0.38, 0.43, f));
                col = lerp(col, half3(1, 1, 1), line_ * dash * (1.0 - edge) * 0.92);

                // A frothy fringe where the water laps the embankment walls.
                float n = TelferNoise(float2(s * 0.9, across * 2.0 + _Time.y * 0.6));
                float froth = smoothstep(_Half - 0.55 - n * 0.35, _Half - 0.1, abs(across));
                col = lerp(col, half3(0.96, 0.99, 1.0), froth * 0.75);

                // Light: a rippled normal for glints and the sky's reflection; shadows from clouds and buildings.
                float2 p = i.positionWS.xz;
                float t = _Time.y;
                float hx = TelferNoise(p * 0.7 + float2(t * 0.35, 0)) - TelferNoise(p * 0.7 + float2(t * 0.35 + 0.4, 0));
                float hz = TelferNoise(p * 0.7 + float2(0, t * 0.27)) - TelferNoise(p * 0.7 + float2(0.4, t * 0.27));
                float3 nrm = normalize(float3(hx * 0.6, 1, hz * 0.6));
                float3 view = normalize(GetWorldSpaceViewDir(i.positionWS));
                Light sun = GetMainLight(TransformWorldToShadowCoord(i.positionWS));
                half shade = sun.shadowAttenuation * TelferCloudShadow(i.positionWS);
                half fres = pow(1.0 - saturate(dot(nrm, view)), 4.0);
                col = lerp(col, _Sky.rgb, fres * 0.55);
                half3 h = normalize(sun.direction + view);
                half glint = pow(saturate(dot(nrm, h)), 220.0) * 2.2;
                col *= lerp(_TelferShadowTint.rgb * 0.8, half3(1, 1, 1), shade);
                col += sun.color * glint * shade;

                col = MixFog(col, i.fog);
                return half4(col, 1);
            }
            ENDHLSL
        }
    }
}
