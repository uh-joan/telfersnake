// The ink line round London's landmarks (and anything else that wants to look drawn): an inverted
// hull, the mesh pushed out along its smooth normals (welded and stored in uv3 by LondonKit) and
// drawn back faces only in flat ink. Never thinner than about a pixel, so it holds from far away.
// A screen-door faded renderer (_Fade < 1, set by the occlusion fade) drops its ink entirely.
Shader "Telfer/Outline"
{
    Properties
    {
        _Color ("Ink", Color) = (0.17,0.13,0.09,1)
        _Thickness ("Thickness (m)", Float) = 0.08
        _Fade ("Fade (dither)", Range(0,1)) = 1
    }

    SubShader
    {
        Tags { "RenderType"="Opaque" "RenderPipeline"="UniversalPipeline" "Queue"="Geometry" }

        Pass
        {
            Name "Ink"
            Tags { "LightMode"="SRPDefaultUnlit" }
            Cull Front
            ZWrite On

            HLSLPROGRAM
            #pragma target 3.0
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_fog
            #pragma multi_compile_instancing
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            CBUFFER_START(UnityPerMaterial)
                float4 _Color;
                float _Thickness;
                float _Fade;
            CBUFFER_END

            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; float3 smooth : TEXCOORD3; UNITY_VERTEX_INPUT_INSTANCE_ID };
            struct Varyings { float4 positionCS : SV_POSITION; float fog : TEXCOORD0; UNITY_VERTEX_INPUT_INSTANCE_ID };

            Varyings vert(Attributes v)
            {
                Varyings o;
                UNITY_SETUP_INSTANCE_ID(v);
                UNITY_TRANSFER_INSTANCE_ID(v, o);
                float3 n = v.smooth;
                if (dot(n, n) < 0.01) n = v.normalOS;
                float3 ws = TransformObjectToWorld(v.positionOS.xyz);
                float3 nws = normalize(TransformObjectToWorldNormal(n));
                float dist = distance(ws, GetCameraPositionWS());
                ws += nws * max(_Thickness, dist * 0.0011);
                o.positionCS = TransformWorldToHClip(ws);
                o.fog = ComputeFogFactor(o.positionCS.z);
                return o;
            }

            half4 frag(Varyings i) : SV_Target
            {
                UNITY_SETUP_INSTANCE_ID(i);
                clip(_Fade - 0.95);
                return half4(MixFog(_Color.rgb, i.fog), 1);
            }
            ENDHLSL
        }
    }
}
