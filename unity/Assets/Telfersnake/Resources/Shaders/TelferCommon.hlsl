#ifndef TELFER_COMMON_INCLUDED
#define TELFER_COMMON_INCLUDED

#include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
#include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

// ---------------------------------------------------------------------------
// Globals driven by Telfer.View.Atmosphere (one place sets the mood of the day).
// ---------------------------------------------------------------------------
float4 _TelferAmbientSky;     // rgb: hemisphere ambient from above
float4 _TelferAmbientGround;  // rgb: hemisphere ambient from below (bounce off tarmac)
float4 _TelferShadowTint;     // rgb: what colour the shade turns (cool blue-violet)
float4 _TelferCloud;          // x: strength, y: scale, z: speed x, w: speed z
float4 _TelferWind;           // x: strength, y: speed, z,w: direction
float4 _TelferPushers[16];    // xyz: world pos of things that part the grass, w: radius
float  _TelferPusherCount;

// --- cheap value noise -------------------------------------------------------
float TelferHash(float2 p)
{
    p = frac(p * float2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return frac(p.x * p.y);
}

float TelferNoise(float2 p)
{
    float2 i = floor(p);
    float2 f = frac(p);
    float a = TelferHash(i);
    float b = TelferHash(i + float2(1, 0));
    float c = TelferHash(i + float2(0, 1));
    float d = TelferHash(i + float2(1, 1));
    float2 u = f * f * (3.0 - 2.0 * f);
    return lerp(lerp(a, b, u.x), lerp(c, d, u.x), u.y);
}

float TelferFbm(float2 p)
{
    float v = 0.0;
    float a = 0.5;
    for (int k = 0; k < 4; k++)
    {
        v += a * TelferNoise(p);
        p = p * 2.03 + 17.1;
        a *= 0.5;
    }
    return v;
}

// Soft drifting cloud shadows over the whole playground: 1 = sunlit, lower = under a cloud.
float TelferCloudShadow(float3 positionWS)
{
    float2 uv = positionWS.xz * _TelferCloud.y + _Time.y * _TelferCloud.zw;
    float n = TelferFbm(uv);
    float shade = smoothstep(0.45, 0.75, n);
    return 1.0 - shade * _TelferCloud.x;
}

// Gentle wind: sways whatever is above the object's base, scaled by `weight` (0 at the root).
float3 TelferWindOffset(float3 positionWS, float weight)
{
    float t = _Time.y * _TelferWind.y;
    float phase = dot(positionWS.xz, float2(0.37, 0.21));
    float gust = 0.6 + 0.4 * sin(t * 0.37 + positionWS.x * 0.05);
    float sway = sin(t + phase) * 0.7 + sin(t * 2.31 + phase * 1.7) * 0.3;
    float2 dir = normalize(_TelferWind.zw + 1e-4);
    float2 off = dir * sway * gust * _TelferWind.x * weight;
    return float3(off.x, -abs(sway) * 0.05 * weight * _TelferWind.x, off.y);
}

// ---------------------------------------------------------------------------
// The house lighting model: a soft wrapped diffuse with a painterly terminator,
// shadows that go cool rather than black, hemisphere ambient, a little gloss and
// a rim that lifts shapes off the ground. Everything in the game goes through it.
// ---------------------------------------------------------------------------
struct TelferSurface
{
    half3 albedo;
    half3 normalWS;
    half3 viewWS;
    float3 positionWS;
    half gloss;        // 0..1 specular strength
    half smoothness;   // 0..1 tightness of the highlight
    half3 rim;         // rim colour * strength
    half rimPower;
    half3 emission;
    half occlusion;    // baked-in AO (vertex colour alpha etc.)
    half translucency; // light leaking through thin things (grass, leaves, ears)
};

half3 TelferShade(TelferSurface s, float4 positionCS)
{
    float4 shadowCoord = TransformWorldToShadowCoord(s.positionWS);
    Light light = GetMainLight(shadowCoord);

    half ndl = dot(s.normalWS, light.direction);
    // Wrapped diffuse with a soft but defined terminator.
    half diff = smoothstep(-0.15, 0.55, ndl);
    half atten = light.shadowAttenuation * TelferCloudShadow(s.positionWS);
    half lit = diff * atten;

    // Hemisphere ambient, tinted toward the shadow colour on the unlit side.
    half up = s.normalWS.y * 0.5 + 0.5;
    half3 ambient = lerp(_TelferAmbientGround.rgb, _TelferAmbientSky.rgb, up);

    half ao = s.occlusion;
    #if defined(_SCREEN_SPACE_OCCLUSION)
        float2 suv = GetNormalizedScreenSpaceUV(positionCS);
        AmbientOcclusionFactor aoF = GetScreenSpaceAmbientOcclusion(suv);
        ao *= aoF.indirectAmbientOcclusion;
        lit *= lerp(1.0, aoF.directAmbientOcclusion, 0.5);
    #endif

    half3 shadeTint = lerp(_TelferShadowTint.rgb, half3(1, 1, 1), lit);
    half3 color = s.albedo * (ambient * ao * shadeTint + light.color * lit);

    // Light through thin things (seen against the sun).
    half back = saturate(dot(-s.viewWS, light.direction));
    color += s.albedo * light.color * s.translucency * pow(back, 3.0) * atten * 0.8;

    // Blinn-Phong gloss.
    half3 h = normalize(light.direction + s.viewWS);
    half spec = pow(saturate(dot(s.normalWS, h)), lerp(8.0, 256.0, s.smoothness));
    color += light.color * spec * s.gloss * atten * (s.smoothness * 2.0 + 0.3);

    // Rim, stronger on the lit side.
    half fres = pow(1.0 - saturate(dot(s.normalWS, s.viewWS)), s.rimPower);
    color += s.rim * fres * (0.35 + 0.65 * diff);

    color += s.emission;
    return color;
}

#endif
