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
        WhiteBalance wb;
        ShadowsMidtonesHighlights smh;
        Material sky;
        public static Atmosphere I { get; private set; }
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
            I = this;
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
            wb = p.Add<WhiteBalance>(true);
            wb.temperature.Override(7f);
            wb.tint.Override(2f);
            smh = p.Add<ShadowsMidtonesHighlights>(true);
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
            BuildWeather();
        }

        /// <summary>
        /// Each place's light (stage.ts atmospheres): London is bright and a little cool with a light
        /// haze that lets the far landmarks fade back; the school and the Common keep the warm afternoon.
        /// </summary>
        public void SetPlace(Telfer.Sim.StageId id)
        {
            bool london = id == Telfer.Sim.StageId.London;
            RenderSettings.fogStartDistance = london ? 85 : 70;
            RenderSettings.fogEndDistance = london ? 240 : 260;
            RenderSettings.fogColor = london ? new Color(0.8f, 0.88f, 0.95f) : new Color(0.78f, 0.86f, 0.94f);
            Shader.SetGlobalColor(AmbientSky, london ? new Color(0.62f, 0.69f, 0.84f) : new Color(0.56f, 0.64f, 0.8f));
            Shader.SetGlobalColor(AmbientGround, london ? new Color(0.5f, 0.47f, 0.42f) : new Color(0.42f, 0.38f, 0.34f));
            Shader.SetGlobalColor(ShadowTint, london ? new Color(0.66f, 0.7f, 0.96f) : new Color(0.62f, 0.66f, 0.95f));
            sunWarm = london ? new Color(1f, 0.97f, 0.9f) : new Color(1f, 0.95f, 0.85f);
            sunLow = london ? new Color(1f, 0.9f, 0.76f) : new Color(1f, 0.86f, 0.68f);
            Sun.intensity = london ? 1.3f : 1.25f;
            // London's paper is the classic's cool cream (#f8f1df), not the school's warm afternoon: a neutral
            // white balance and untinted highlights there; the school and the Common keep their grade.
            wb.temperature.Override(london ? -6f : 7f);
            wb.tint.Override(london ? 0f : 2f);
            smh.highlights.Override(london ? new Vector4(1f, 1f, 1.03f, -0.06f) : new Vector4(1.06f, 1.02f, 0.94f, 0f));
            this.london = london;
            baseFog = RenderSettings.fogColor;
            baseFogStart = RenderSettings.fogStartDistance;
            baseFogEnd = RenderSettings.fogEndDistance;
            weather = Sky.Clear;
            forced = false;
            skyHold = Random.Range(40f, 70f);
            fogAmt = rainAmt = goldAmt = fireworksAmt = fireworksWant = 0;
            sunBase = Sun.intensity;
            ApplyWeather(0);
        }

        Color sunWarm = new Color(1f, 0.95f, 0.85f), sunLow = new Color(1f, 0.86f, 0.68f);

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
            vignette.intensity.Override(0.24f + hitPulse * 0.18f + fireworksAmt * 0.14f);
            bloom.intensity.Override(0.55f + tierPulse * 1.2f + fireworksAmt * 0.9f + goldAmt * 0.25f);

            // The sun drifts slowly across the afternoon, and back.
            dayTime += dt / 360f;
            float swing = Mathf.Sin(dayTime * Mathf.PI * 2) * 0.5f + 0.5f;
            float yaw = Mathf.Lerp(40, 85, swing);
            float pitch = Mathf.Lerp(50, 38, swing);
            Sun.transform.rotation = Quaternion.Euler(pitch, yaw, 0);
            Sun.color = Color.Lerp(sunWarm, sunLow, swing);
            if (london) Weather(dt, pitch, yaw);
        }

        // ================================================================== London's skies (view only, as classic weather.ts)

        /// <summary>London's moods: bright, golden hour over the river, a pea-souper, and drizzle on the paper.</summary>
        public enum Sky { Clear, Golden, Fog, Rain }
        static readonly Sky[] POOL = { Sky.Clear, Sky.Clear, Sky.Clear, Sky.Golden, Sky.Golden, Sky.Fog, Sky.Rain };
        Sky weather;
        bool london, forced;
        float sunBase = 1.25f, skyHold, fogAmt, rainAmt, goldAmt, fireworksAmt, fireworksWant;
        Color baseFog;
        float baseFogStart, baseFogEnd;
        /// <summary>Where the weather happens: the camera's focus (set every frame by the game).</summary>
        public Vector3 Around;
        /// <summary>How wet the paper is (0..1): LondonEnv gives it a puddle sheen.</summary>
        public static System.Action<float> Wet;
        ParticleSystem rain;
        readonly System.Collections.Generic.List<Transform> mist = new System.Collections.Generic.List<Transform>();
        Material mistMat;
        static readonly Color PEA_SOUP = new Color(0.79f, 0.77f, 0.64f), DRIZZLE = new Color(0.7f, 0.74f, 0.8f);

        public Sky Now => weather;
        /// <summary>Dev (and the fireworks): pick London's sky now.</summary>
        public void SetSky(Sky s, bool hold = true) { weather = s; forced = hold; skyHold = Random.Range(40f, 70f); }
        /// <summary>The fireworks are on: the evening dims a little and the bloom opens up so the bursts pop.</summary>
        public void FireworksOn(bool on) => fireworksWant = on ? 1 : 0;

        void BuildWeather()
        {
            // Rain: stretched streaks falling round the camera's focus.
            var go = new GameObject("rain");
            go.transform.SetParent(transform, false);
            rain = go.AddComponent<ParticleSystem>();
            rain.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            var main = rain.main;
            main.loop = true;
            main.playOnAwake = false;
            main.maxParticles = Mobile ? 500 : 1400;
            main.startLifetime = 1.1f;
            main.startSpeed = 0;
            main.startSize = 0.08f;
            main.startColor = new Color(0.75f, 0.85f, 1f, 0.8f);
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            var vel = rain.velocityOverLifetime;
            vel.enabled = true;
            vel.space = ParticleSystemSimulationSpace.World;
            vel.x = new ParticleSystem.MinMaxCurve(-2f, -1.4f);
            vel.y = new ParticleSystem.MinMaxCurve(-19f, -16f);
            vel.z = new ParticleSystem.MinMaxCurve(0f, 0f);
            var shape = rain.shape;
            shape.enabled = true;
            shape.shapeType = ParticleSystemShapeType.Box;
            shape.scale = new Vector3(56, 1, 44);
            var em = rain.emission;
            em.rateOverTime = 0;
            var r = go.GetComponent<ParticleSystemRenderer>();
            r.renderMode = ParticleSystemRenderMode.Stretch;
            r.velocityScale = 0.045f;
            r.lengthScale = 1;
            r.sharedMaterial = Mats.Glow(Color.white, 0, false, 1.1f);
            r.shadowCastingMode = ShadowCastingMode.Off;
            rain.Play();

            // The pea-souper: soft sheets of yellow-grey mist stacked low over the map, drifting (volumetric-ish, and cheap).
            mistMat = Mats.Glow(new Color(PEA_SOUP.r * 1.08f, PEA_SOUP.g * 1.08f, PEA_SOUP.b * 1.08f, 0), 0, false, 1);
            var quad = new Mesh { name = "mist" };
            quad.vertices = new[] { new Vector3(-0.5f, 0, -0.5f), new Vector3(0.5f, 0, -0.5f), new Vector3(-0.5f, 0, 0.5f), new Vector3(0.5f, 0, 0.5f) };
            quad.uv = new[] { new Vector2(0, 0), new Vector2(1, 0), new Vector2(0, 1), new Vector2(1, 1) };
            quad.colors = new[] { Color.white, Color.white, Color.white, Color.white };
            quad.triangles = new[] { 0, 2, 1, 1, 2, 3 };
            quad.bounds = new Bounds(Vector3.zero, new Vector3(1, 1, 1));
            for (int i = 0; i < 7; i++)
            {
                var m = new GameObject("mist", typeof(MeshFilter), typeof(MeshRenderer));
                m.transform.SetParent(transform, false);
                m.GetComponent<MeshFilter>().sharedMesh = quad;
                var mr = m.GetComponent<MeshRenderer>();
                mr.sharedMaterial = mistMat;
                mr.shadowCastingMode = ShadowCastingMode.Off;
                mr.receiveShadows = false;
                m.SetActive(false);
                mist.Add(m.transform);
            }
        }

        void Weather(float dt, float pitch, float yaw)
        {
            if (!forced && (skyHold -= dt) <= 0)
            {
                weather = POOL[Random.Range(0, POOL.Length)];
                skyHold = Random.Range(weather == Sky.Clear ? 50f : 35f, weather == Sky.Clear ? 90f : 60f);
            }
            float k = 1 - Mathf.Exp(-dt / 5f);
            fogAmt = Mathf.Lerp(fogAmt, weather == Sky.Fog ? 1 : 0, k);
            rainAmt = Mathf.Lerp(rainAmt, weather == Sky.Rain ? 1 : 0, k);
            goldAmt = Mathf.Lerp(goldAmt, weather == Sky.Golden ? 1 : 0, k);
            fireworksAmt = Mathf.MoveTowards(fireworksAmt, fireworksWant, dt * 0.6f);

            // Golden hour: the sun sinks low over the river and turns honey-orange.
            if (goldAmt > 0.001f)
            {
                Sun.transform.rotation = Quaternion.Euler(Mathf.Lerp(pitch, 21, goldAmt), Mathf.Lerp(yaw, 112, goldAmt), 0);
                Sun.color = Color.Lerp(Sun.color, new Color(1f, 0.74f, 0.48f), goldAmt * 0.6f);
            }
            ApplyWeather(dt);
        }

        void ApplyWeather(float dt)
        {
            float murk = Mathf.Max(fogAmt, rainAmt * 0.6f);
            Sun.intensity = sunBase * (1 - 0.3f * murk) * (1 - 0.3f * fireworksAmt) * (1 + 0.08f * goldAmt);
            RenderSettings.fogStartDistance = Mathf.Lerp(Mathf.Lerp(baseFogStart, 50, rainAmt), 24, fogAmt);
            RenderSettings.fogEndDistance = Mathf.Lerp(Mathf.Lerp(baseFogEnd, 190, rainAmt), 125, fogAmt);
            var fc = Color.Lerp(Color.Lerp(baseFog, DRIZZLE, rainAmt), PEA_SOUP, fogAmt);
            fc = Color.Lerp(fc, new Color(1f, 0.83f, 0.66f), goldAmt * 0.5f);
            RenderSettings.fogColor = Color.Lerp(fc, new Color(0.25f, 0.24f, 0.36f), fireworksAmt * 0.5f);
            grade.colorFilter.Override(Color.Lerp(Color.white, new Color(1f, 0.92f, 0.8f), goldAmt * 0.45f));
            grade.postExposure.Override(0.18f - 0.32f * fireworksAmt - 0.05f * murk);
            grade.saturation.Override(16f - 14f * fogAmt);
            bloom.threshold.Override(0.95f - 0.15f * fireworksAmt - 0.1f * goldAmt);
            bloom.tint.Override(Color.Lerp(new Color(1f, 0.93f, 0.82f), new Color(1f, 0.78f, 0.55f), goldAmt));

            var em = rain.emission;
            em.rateOverTime = rainAmt * (Mobile ? 420 : 1200);
            rain.transform.position = Around + new Vector3(4, 15, -2);
            Wet?.Invoke(rainAmt);

            float t = Time.time;
            for (int i = 0; i < mist.Count; i++)
            {
                var m = mist[i];
                bool on = fogAmt > 0.02f;
                if (m.gameObject.activeSelf != on) m.gameObject.SetActive(on);
                if (!on) continue;
                float a = i * 2.4f + t * 0.03f;
                m.position = Around + new Vector3(Mathf.Cos(a) * 14 + Mathf.Sin(t * 0.05f + i) * 6, 0.6f + i * 0.7f, Mathf.Sin(a) * 10);
                m.localScale = new Vector3(60 + i * 6, 1, 46 + i * 5);
            }
            var mc = mistMat.GetColor("_Color");
            mc.a = fogAmt * 0.14f;
            mistMat.SetColor("_Color", mc);
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
        float orbitAngle, orbitDist = 62, length;
        bool orbiting;

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
            orbiting = false;
            pitchAdd = yawAdd = pitchVel = yawVel = 0;
            this.length = length;
            dist = DistanceFor(length);
            Apply(0, 0);
        }

        float DistanceFor(float length) => Mathf.Min(52, 21 + length * 0.45f) * Pull * Zoom * (1 + 0.55f * Altitude);

        /// <summary>
        /// Dragon Wings (London): 0 on the ground, 1 up in the air. The camera rises with the snake: further
        /// back and a touch flatter, so the whole sky and the map below are in the frame.
        /// </summary>
        public float Altitude;
        /// <summary>Extra pitch and yaw (degrees) on top of the chase angle: the flight's lift and the Eye's crane shot, eased.</summary>
        float pitchAdd, yawAdd, pitchVel, yawVel;
        bool craning;

        /// <summary>
        /// The London Eye's crane shot: as your capsule climbs (`t` 0..1 of the ride) the camera lifts off the
        /// snake, cranes up and back to a bird's-eye view of the whole map, sweeps slowly across it, and comes
        /// back down to the capsule as the wheel brings you round. Everything eases, in and out.
        /// </summary>
        public void Crane(Vector3 capsule, Vector3 overview, float t, float dt)
        {
            orbiting = false;
            craning = true;
            float b = Mathf.SmoothStep(0, 1, Mathf.Clamp01(Mathf.Min(t / 0.18f, (1 - t) / 0.16f)));
            var target = Vector3.Lerp(capsule, overview, b * 0.9f);
            focus = Vector3.SmoothDamp(focus, target, ref focusVel, 0.45f, Mathf.Infinity, dt);
            dist = Mathf.SmoothDamp(dist, Mathf.Lerp(DistanceFor(length) * 0.85f, 118 * Pull, b), ref distVel, 0.9f, Mathf.Infinity, dt);
            pitchAdd = Mathf.SmoothDamp(pitchAdd, Mathf.Lerp(-14, 20, b), ref pitchVel, 0.7f, Mathf.Infinity, dt);
            yawAdd = Mathf.SmoothDamp(yawAdd, b * (-22 + 44 * t), ref yawVel, 0.9f, Mathf.Infinity, dt);
            fovKick = Mathf.Lerp(fovKick, -2 * b, 1 - Mathf.Exp(-dt * 3));
            Apply(dt, Time.time);
        }

        /// <summary>
        /// How far the place sits the camera, as a share of the usual. The Common is a wide open meadow
        /// where, at the school's distance, a bear or a wolf (which notice a snake 16 and 13 m away) is
        /// in view long before it matters. 0.82 shows a third less ground: a new snake sees about 10 m
        /// ahead on a wide screen instead of 12, so the wild can come from just off screen (the minimap
        /// still shows it), while the snake and what it eats stay a friendly size.
        /// </summary>
        public float Zoom = 1;
        public const float COMMON_ZOOM = 0.82f;
        /// <summary>
        /// London sits a touch closer than the school (classic's cameraZoom 0.9): the map is big, but the
        /// pop-up landmarks are tall, and a closer camera keeps more of them standing up in the frame.
        /// </summary>
        public const float LONDON_ZOOM = 0.88f;

        /// <summary>
        /// How much further back to sit on a narrow screen. The view's width shrinks with the aspect, so
        /// a phone held upright pulls back by the square root of how much narrower than 4:3 it is: about
        /// 1.7x on a phone, where it sees nearly half as wide as a TV and twice as far ahead.
        /// </summary>
        float Pull => Mathf.Sqrt(Mathf.Max(1, 1.35f / Cam.aspect));

        /// <summary>The screen changed shape (or a capture is about to be taken): jump to the distance for it.</summary>
        public void Refit()
        {
            // Mid crane shot (the Eye) the shot keeps its own distance: only the chase distance depends on the screen.
            if (!craning) dist = orbiting ? orbitDist * Pull : DistanceFor(length);
            if (orbiting) TitleOrbit(0, focus, orbitDist);
            else Apply(0, Time.time);
        }

        public void Follow(Vector3 head, Vector3 velocity, float length, bool dashing, float dt)
        {
            orbiting = false;
            craning = false;
            this.length = length;
            var target = head + velocity * 0.35f;
            focus = Vector3.SmoothDamp(focus, target, ref focusVel, 0.22f, Mathf.Infinity, dt);
            dist = Mathf.SmoothDamp(dist, DistanceFor(length), ref distVel, 0.8f, Mathf.Infinity, dt);
            fovKick = Mathf.Lerp(fovKick, dashing ? 6 : 0, 1 - Mathf.Exp(-dt * 6));
            pitchAdd = Mathf.SmoothDamp(pitchAdd, -7 * Altitude, ref pitchVel, 0.6f, Mathf.Infinity, dt);
            yawAdd = Mathf.SmoothDamp(yawAdd, 0, ref yawVel, 0.6f, Mathf.Infinity, dt);
            Apply(dt, Time.time);
        }

        public void TitleOrbit(float dt) => TitleOrbit(dt, new Vector3(-6, 0, 4), 62);

        public void TitleOrbit(float dt, Vector3 centre, float distance)
        {
            orbiting = true;
            orbitDist = distance;
            orbitAngle += dt * 4;
            focus = Vector3.Lerp(focus, centre, 1 - Mathf.Exp(-dt * 0.8f));
            dist = Mathf.Lerp(dist, distance * Pull, 1 - Mathf.Exp(-dt * 0.8f));
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
            var rot = Quaternion.Euler(56 + pitchAdd + shake * (Mathf.PerlinNoise(time * 22, 1) - 0.5f) * 6, yawAdd + shake * (Mathf.PerlinNoise(time * 22, 7) - 0.5f) * 6, shake * (Mathf.PerlinNoise(time * 22, 13) - 0.5f) * 8);
            float d = dist * (1 - Mathf.Sin(punch * Mathf.PI) * 0.12f);
            transform.position = focus + rot * new Vector3(0, 0, -d);
            transform.rotation = rot;
            Cam.fieldOfView = 38 + fovKick;
        }
    }
}
