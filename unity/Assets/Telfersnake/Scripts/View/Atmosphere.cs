using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Telfer.View
{
    /// <summary>
    /// The mood of the day: a warm sun drifting across the sky, a painted sky, haze, drifting
    /// cloud shadows, wind, and the post stack (bloom, filmic grade, vignette, a miniature
    /// tilt-shift focus on the snake, and the punchy bits for hits and tier-ups).
    /// </summary>
    public sealed class Atmosphere : MonoBehaviour
    {
        public Light Sun { get; private set; }
        Volume volume;
        Bloom bloom;
        DepthOfField dof;
        ChromaticAberration chroma;
        LensDistortion lens;
        Vignette vignette;
        ColorAdjustments grade;
        Material sky;
        float hitPulse, tierPulse, dayTime;
        public bool Mobile;

        static readonly int AmbientSky = Shader.PropertyToID("_TelferAmbientSky");
        static readonly int AmbientGround = Shader.PropertyToID("_TelferAmbientGround");
        static readonly int ShadowTint = Shader.PropertyToID("_TelferShadowTint");
        static readonly int Cloud = Shader.PropertyToID("_TelferCloud");
        static readonly int Wind = Shader.PropertyToID("_TelferWind");

        public void Build(bool mobile)
        {
            Mobile = mobile;
            var sunGo = new GameObject("Sun");
            sunGo.transform.SetParent(transform, false);
            Sun = sunGo.AddComponent<Light>();
            Sun.type = LightType.Directional;
            Sun.color = new Color(1f, 0.93f, 0.8f);
            Sun.intensity = 1.25f;
            Sun.shadows = LightShadows.Soft;
            Sun.shadowStrength = 1f;
            Sun.shadowBias = 0.04f;
            Sun.shadowNormalBias = 0.3f;
            var ld = sunGo.AddComponent<UniversalAdditionalLightData>();
            ld.usePipelineSettings = true;
            RenderSettings.sun = Sun;

            sky = new Material(Mats.SkyShader);
            RenderSettings.skybox = sky;
            RenderSettings.ambientMode = AmbientMode.Flat;
            RenderSettings.ambientLight = new Color(0.5f, 0.55f, 0.62f);
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.fogStartDistance = 70;
            RenderSettings.fogEndDistance = 260;
            RenderSettings.fogColor = new Color(0.78f, 0.86f, 0.94f);

            Shader.SetGlobalColor(AmbientSky, new Color(0.56f, 0.64f, 0.8f));
            Shader.SetGlobalColor(AmbientGround, new Color(0.42f, 0.38f, 0.34f));
            Shader.SetGlobalColor(ShadowTint, new Color(0.62f, 0.66f, 0.95f));
            Shader.SetGlobalVector(Cloud, new Vector4(0.22f, 0.028f, 0.55f, 0.22f));
            Shader.SetGlobalVector(Wind, new Vector4(0.7f, 1.6f, 1f, 0.35f));
            Shader.SetGlobalFloat("_TelferPusherCount", 0);
            Shader.SetGlobalVectorArray("_TelferPushers", new Vector4[16]);

            var vgo = new GameObject("Post");
            vgo.transform.SetParent(transform, false);
            volume = vgo.AddComponent<Volume>();
            volume.isGlobal = true;
            volume.priority = 10;
            var p = ScriptableObject.CreateInstance<VolumeProfile>();
            volume.sharedProfile = p;

            var tm = p.Add<Tonemapping>(true);
            tm.mode.Override(TonemappingMode.Neutral);
            grade = p.Add<ColorAdjustments>(true);
            grade.postExposure.Override(0.18f);
            grade.contrast.Override(14f);
            grade.saturation.Override(16f);
            var wb = p.Add<WhiteBalance>(true);
            wb.temperature.Override(7f);
            wb.tint.Override(2f);
            var smh = p.Add<ShadowsMidtonesHighlights>(true);
            smh.shadows.Override(new Vector4(0.92f, 0.95f, 1.12f, 0f));
            smh.highlights.Override(new Vector4(1.06f, 1.02f, 0.94f, 0f));
            bloom = p.Add<Bloom>(true);
            bloom.threshold.Override(0.95f);
            bloom.intensity.Override(0.55f);
            bloom.scatter.Override(0.72f);
            bloom.tint.Override(new Color(1f, 0.93f, 0.82f));
            bloom.highQualityFiltering.Override(!mobile);
            vignette = p.Add<Vignette>(true);
            vignette.intensity.Override(0.24f);
            vignette.smoothness.Override(0.45f);
            vignette.color.Override(new Color(0.12f, 0.1f, 0.22f));
            dof = p.Add<DepthOfField>(true);
            if (mobile)
            {
                dof.mode.Override(DepthOfFieldMode.Gaussian);
                dof.gaussianMaxRadius.Override(1.2f);
                dof.highQualitySampling.Override(false);
            }
            else
            {
                dof.mode.Override(DepthOfFieldMode.Bokeh);
                dof.focalLength.Override(70);
                dof.aperture.Override(5.6f);
                dof.bladeCount.Override(6);
                dof.bladeCurvature.Override(1);
            }
            chroma = p.Add<ChromaticAberration>(true);
            chroma.intensity.Override(0);
            lens = p.Add<LensDistortion>(true);
            lens.intensity.Override(0);
            var fg = p.Add<FilmGrain>(true);
            fg.type.Override(FilmGrainLookup.Thin1);
            fg.intensity.Override(mobile ? 0 : 0.12f);
        }

        /// <summary>Keep the miniature focus on whatever the camera is looking at.</summary>
        public void Focus(float distance)
        {
            if (Mobile)
            {
                dof.gaussianStart.Override(distance + 6);
                dof.gaussianEnd.Override(distance + 38);
            }
            else dof.focusDistance.Override(distance);
        }

        public void SetDepthOfField(bool on) => dof.active = on;

        public void Hit(float amount = 1) => hitPulse = Mathf.Max(hitPulse, amount);
        public void TierUp() => tierPulse = 1;

        void Update()
        {
            float dt = Time.unscaledDeltaTime;
            hitPulse = Mathf.Max(0, hitPulse - dt * 2.5f);
            tierPulse = Mathf.Max(0, tierPulse - dt * 1.4f);
            chroma.intensity.Override(hitPulse * 0.8f + tierPulse * 0.5f);
            lens.intensity.Override(-Mathf.Sin(tierPulse * Mathf.PI) * 0.28f - hitPulse * 0.12f);
            vignette.intensity.Override(0.24f + hitPulse * 0.18f);
            bloom.intensity.Override(0.55f + tierPulse * 1.2f);

            // The sun drifts slowly across the afternoon, and back.
            dayTime += dt / 360f;
            float swing = Mathf.Sin(dayTime * Mathf.PI * 2) * 0.5f + 0.5f;
            float yaw = Mathf.Lerp(40, 85, swing);
            float pitch = Mathf.Lerp(50, 38, swing);
            Sun.transform.rotation = Quaternion.Euler(pitch, yaw, 0);
            Sun.color = Color.Lerp(new Color(1f, 0.95f, 0.85f), new Color(1f, 0.86f, 0.68f), swing);
        }

        /// <summary>Feed the grass the positions of everything that should part it.</summary>
        public static void SetPushers(Vector4[] pushers, int count)
        {
            Shader.SetGlobalVectorArray("_TelferPushers", pushers);
            Shader.SetGlobalFloat("_TelferPusherCount", count);
        }
    }

    /// <summary>
    /// Chase camera: looks north and down at a fixed angle (controls stay screen-relative), pulls back
    /// as the snake grows, leads a little where it is going, kicks on a dash, shakes on a bonk, and
    /// does a slow cinematic orbit on the title screen.
    /// </summary>
    public sealed class CameraRig : MonoBehaviour
    {
        public Camera Cam { get; private set; }
        Vector3 focus, focusVel;
        float dist = 20, distVel, trauma, fovKick, punch;
        public bool Orbit;
        float orbitAngle;

        public void Build()
        {
            Cam = gameObject.AddComponent<Camera>();
            Cam.fieldOfView = 36;
            Cam.nearClipPlane = 0.3f;
            Cam.farClipPlane = 600;
            Cam.clearFlags = CameraClearFlags.Skybox;
            Cam.allowMSAA = true;
            Cam.allowHDR = true;
            var data = gameObject.AddComponent<UniversalAdditionalCameraData>();
            data.renderPostProcessing = true;
            data.renderShadows = true;
            data.antialiasing = AntialiasingMode.None;
            gameObject.AddComponent<AudioListener>();
            gameObject.tag = "MainCamera";
        }

        public void Shake(float amount) => trauma = Mathf.Min(1, trauma + amount);
        public void Punch(float amount) => punch = Mathf.Max(punch, amount);

        public float FocusDistance => Vector3.Distance(transform.position, focus);

        public void Snap(Vector3 target, float length)
        {
            focus = target;
            dist = DistanceFor(length);
            Apply(0, 0);
        }

        float DistanceFor(float length)
        {
            float aspect = Cam.aspect;
            float portrait = Mathf.Lerp(1, 1.55f, Mathf.Clamp01((1.35f - aspect) / 0.8f));
            return Mathf.Min(52, 21 + length * 0.45f) * portrait;
        }

        public void Follow(Vector3 head, Vector3 velocity, float length, bool dashing, float dt)
        {
            var target = head + velocity * 0.35f;
            focus = Vector3.SmoothDamp(focus, target, ref focusVel, 0.22f, Mathf.Infinity, dt);
            dist = Mathf.SmoothDamp(dist, DistanceFor(length), ref distVel, 0.8f, Mathf.Infinity, dt);
            fovKick = Mathf.Lerp(fovKick, dashing ? 6 : 0, 1 - Mathf.Exp(-dt * 6));
            Apply(dt, Time.time);
        }

        public void TitleOrbit(float dt) => TitleOrbit(dt, new Vector3(-6, 0, 4), 62);

        public void TitleOrbit(float dt, Vector3 centre, float distance)
        {
            orbitAngle += dt * 4;
            focus = Vector3.Lerp(focus, centre, 1 - Mathf.Exp(-dt * 0.8f));
            dist = Mathf.Lerp(dist, distance, 1 - Mathf.Exp(-dt * 0.8f));
            var rot = Quaternion.Euler(38, orbitAngle, 0);
            transform.position = focus + rot * new Vector3(0, 0, -dist);
            transform.rotation = rot;
            Cam.fieldOfView = 34;
        }

        void Apply(float dt, float time)
        {
            trauma = Mathf.Max(0, trauma - dt * 1.6f);
            punch = Mathf.Max(0, punch - dt * 2.2f);
            float shake = trauma * trauma;
            var rot = Quaternion.Euler(56 + shake * (Mathf.PerlinNoise(time * 22, 1) - 0.5f) * 6, shake * (Mathf.PerlinNoise(time * 22, 7) - 0.5f) * 6, shake * (Mathf.PerlinNoise(time * 22, 13) - 0.5f) * 8);
            float d = dist * (1 - Mathf.Sin(punch * Mathf.PI) * 0.12f);
            transform.position = focus + rot * new Vector3(0, 0, -d);
            transform.rotation = rot;
            Cam.fieldOfView = 38 + fovKick;
        }
    }
}
