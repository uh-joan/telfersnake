// A painted summer sky: zenith-to-horizon gradient, a warm glow and disc around the sun,
// and soft drifting cumulus. Used as the skybox.
Shader "Telfer/Sky"
{
    Properties
    {
        _Zenith ("Zenith", Color) = (0.24,0.52,0.92,1)
        _Horizon ("Horizon", Color) = (0.78,0.9,1,1)
        _Ground ("Below Horizon", Color) = (0.62,0.7,0.62,1)
        _SunColor ("Sun", Color) = (1,0.92,0.75,1)
        _CloudColor ("Cloud", Color) = (1,1,1,1)
        _CloudShade ("Cloud Shade", Color) = (0.72,0.78,0.9,1)
        _CloudCover ("Cloud Cover", Range(0,1)) = 0.5
    }

    SubShader
    {
        Tags { "Queue"="Background" "RenderType"="Background" "PreviewType"="Skybox" "RenderPipeline"="UniversalPipeline" }
        Cull Off ZWrite Off

        Pass
        {
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "TelferCommon.hlsl"

            CBUFFER_START(UnityPerMaterial)
                float4 _Zenith, _Horizon, _Ground, _SunColor, _CloudColor, _CloudShade;
                float _CloudCover;
            CBUFFER_END

            struct Attributes { float4 positionOS : POSITION; };
            struct Varyings { float4 positionCS : SV_POSITION; float3 dir : TEXCOORD0; };

            Varyings vert(Attributes v)
            {
                Varyings o;
                o.positionCS = TransformObjectToHClip(v.positionOS.xyz);
                o.dir = v.positionOS.xyz;
                return o;
            }

            half4 frag(Varyings i) : SV_Target
            {
                float3 d = normalize(i.dir);
                float3 sun = _MainLightPosition.xyz;
                float y = d.y;

                half3 sky = lerp(_Horizon.rgb, _Zenith.rgb, pow(saturate(y), 0.55));
                sky = lerp(sky, _Ground.rgb, smoothstep(0.0, -0.08, y));

                float sd = saturate(dot(d, sun));
                sky += _SunColor.rgb * (pow(sd, 6.0) * 0.35 + pow(sd, 48.0) * 0.6);
                sky += _SunColor.rgb * smoothstep(0.9993, 0.9997, sd) * 6.0;

                // Clouds on a flat layer above.
                if (y > 0.0)
                {
                    float2 uv = d.xz / (y + 0.12) * 1.1 + _Time.y * float2(0.006, 0.002);
                    float n = TelferFbm(uv * 1.7);
                    float n2 = TelferFbm(uv * 4.1 + 3.3);
                    float c = smoothstep(1.0 - _CloudCover, 1.0 - _CloudCover + 0.28, n * 0.8 + n2 * 0.25);
                    c *= smoothstep(0.0, 0.18, y);
                    float lit = saturate(n2 * 1.4 - 0.2);
                    half3 cloud = lerp(_CloudShade.rgb, _CloudColor.rgb, lit);
                    cloud += _SunColor.rgb * pow(sd, 8.0) * 0.4;
                    sky = lerp(sky, cloud, c * 0.92);
                }
                return half4(sky, 1);
            }
            ENDHLSL
        }
    }
}
