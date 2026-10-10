using System.Collections.Generic;
using Telfer.Sim;
using UnityEngine;
using UnityEngine.Rendering;

namespace Telfer.View
{
    /// <summary>
    /// One snake on screen. The body is a smooth tube rebuilt every frame along the sim's trail
    /// (tapering to a tail, swelling where a gulp travels down it); the head is a modelled cartoon
    /// head with googly eyes that look where it is steering, a flicking forked tongue and blinks.
    /// </summary>
    public sealed class SnakeView
    {
        const int SIDES = 16;
        const int MAX_RINGS = 240;
        const int RING_VERTS = SIDES + 1;
        const float BUMP_SPEED = 9;

        public readonly Snake snake;
        public readonly Transform root;
        readonly Mesh bodyMesh;
        readonly Material bodyMat, headMat;
        readonly Transform head, tongue, helmet, dragon;
        readonly Transform[] eyes = new Transform[2], pupils = new Transform[2];
        readonly List<Transform> bees = new List<Transform>();
        readonly Renderer bodyRenderer;

        readonly Vector3[] verts = new Vector3[MAX_RINGS * RING_VERTS + 2];
        readonly Vector3[] norms = new Vector3[MAX_RINGS * RING_VERTS + 2];
        readonly Vector4[] tans = new Vector4[MAX_RINGS * RING_VERTS + 2];
        readonly Vector2[] uvs = new Vector2[MAX_RINGS * RING_VERTS + 2];
        readonly Color[] cols = new Color[MAX_RINGS * RING_VERTS + 2];
        readonly Vector3[] ringPos = new Vector3[MAX_RINGS];
        readonly float[] ringSink = new float[MAX_RINGS];
        float rippleIn;

        /// <summary>The place being played when it has rivers (London), so swimmers sink to the water; else null.</summary>
        public static Stage WaterStage;

        /// <summary>How far into the river (x, z) is, 0 on dry land or a bridge, easing to 1 a metre past the bank.</summary>
        static float Wet(float x, float z)
        {
            var st = WaterStage;
            if (st == null || st.Water == null || Water.OnBridge(st, x, z)) return 0;
            float wet = 0;
            foreach (var w in st.Water)
            {
                float d = London.DistanceToPath(w.path, x, z), half = w.width / 2;
                wet = Mathf.Max(wet, Mathf.SmoothStep(0, 1, Mathf.InverseLerp(half + 0.3f, half - 0.9f, d)));
            }
            return wet;
        }

        readonly List<Vector2> bumps = new List<Vector2>(); // x: metres behind head, y: amplitude
        float tongueT, tongueNext = 1, blinkT, blinkNext = 2, punch, lastHeading, roll, spawnPop = 1, deadFor;
        Vector3 prevHead, curHead;
        float glow;
        bool wasAlive = true;
        public bool isPlayer;
        public Vector3 HeadPos { get; private set; }

        uint[] trail;
        Transform hat, halo;
        bool hatSpins;
        float trailIn;

        public SnakeView(Snake s, Transform parent, bool player, uint[] pattern = null, string hatId = null, uint[] trailPalette = null)
        {
            snake = s;
            isPlayer = player;
            root = new GameObject("Snake " + s.look.name).transform;
            root.SetParent(parent, false);

            bodyMesh = RunAssets.Track(new Mesh { name = "snake-body" });
            bodyMesh.MarkDynamic();
            bodyMesh.vertices = verts;
            indices = BuildIndices();
            bodyMesh.SetIndices(indices, MeshTopology.Triangles, 0);
            bodyMesh.bounds = new Bounds(Vector3.zero, Vector3.one * 400);

            bodyMat = RunAssets.Track(new Material(Mats.SnakeShader));
            ApplyLook(bodyMat, s.look);
            if (player)
            {
                bodyMat.SetFloat("_XRay", 0.85f);
                bodyMat.SetColor("_XRayColor", Color.Lerp(MeshKit.Hex(s.look.body), Color.white, 0.45f));
            }
            var bodyGo = new GameObject("body", typeof(MeshFilter), typeof(MeshRenderer));
            bodyGo.transform.SetParent(root, false);
            bodyGo.GetComponent<MeshFilter>().sharedMesh = bodyMesh;
            bodyRenderer = bodyGo.GetComponent<MeshRenderer>();
            bodyRenderer.sharedMaterial = bodyMat;

            headMat = RunAssets.Track(new Material(bodyMat));
            headMat.SetFloat("_Radius", 0.85f);
            headMat.SetColor("_BodyColor", MeshKit.Hex(s.look.head));

            head = new GameObject("head").transform;
            head.SetParent(root, false);
            BuildHead();
            tongue = BuildTongue();
            helmet = BuildHelmet();
            dragon = BuildDragon();
            Dress(pattern, hatId, trailPalette);
        }

        /// <summary>A Tuck Shop look: skin pattern colours, a hat on the head, a trail behind.</summary>
        public void Dress(uint[] pattern, string hatId, uint[] trailPalette)
        {
            if (pattern != null && pattern.Length > 0)
            {
                bodyMat.SetFloat("_PCount", Mathf.Min(8, pattern.Length));
                for (int i = 0; i < 8; i++) bodyMat.SetColor("_P" + i, MeshKit.Hex(pattern[i % pattern.Length]));
                headMat.SetFloat("_PCount", 0);
            }
            if (hat) Object.Destroy(hat.gameObject);
            hat = null;
            var mesh = string.IsNullOrEmpty(hatId) ? null : Hats.Mesh(hatId);
            if (mesh != null)
            {
                var go = new GameObject("hat", typeof(MeshFilter), typeof(MeshRenderer));
                go.transform.SetParent(head, false);
                go.GetComponent<MeshFilter>().sharedMesh = mesh;
                go.GetComponent<MeshRenderer>().sharedMaterial = Mats.VertexGlossy;
                hat = go.transform;
                hatSpins = Hats.Spins(hatId);
            }
            trail = trailPalette != null && trailPalette.Length > 0 ? trailPalette : null;
        }

        static void ApplyLook(Material m, SnakeLook look)
        {
            m.SetColor("_BodyColor", MeshKit.Hex(look.body));
            m.SetColor("_StripeColor", MeshKit.Hex(look.stripe));
            var belly = Color.Lerp(MeshKit.Hex(look.body), new Color(1, 0.96f, 0.82f), 0.7f);
            m.SetColor("_BellyColor", belly);
        }

        int[] BuildIndices()
        {
            var t = new List<int>((MAX_RINGS - 1) * SIDES * 6 + SIDES * 6);
            for (int r = 0; r < MAX_RINGS - 1; r++)
                for (int j = 0; j < SIDES; j++)
                {
                    int a = r * RING_VERTS + j, b = a + RING_VERTS;
                    // Ring r is nearer the head; the tube's outside faces out.
                    t.Add(a); t.Add(b); t.Add(a + 1);
                    t.Add(a + 1); t.Add(b); t.Add(b + 1);
                }
            int tip = MAX_RINGS * RING_VERTS, nose = tip + 1;
            for (int j = 0; j < SIDES; j++)
            {
                // The tail cap is stitched at runtime to whichever ring is last: indices patched in Sync.
                t.Add(nose); t.Add(j + 1); t.Add(j);
            }
            return t.ToArray();
        }

        // ------------------------------------------------------------------ the head

        void BuildHead()
        {
            var skull = new MeshKit();
            skull.Sphere(new Vector3(0, 0.08f, 0.15f), new Vector3(1.1f, 0.86f, 1.32f), 22, 14);
            skull.Sphere(new Vector3(0, -0.08f, 0.78f), new Vector3(0.86f, 0.6f, 0.85f), 20, 12);
            // Map uv like the body (x = metres back, y = around from the spine) so the skin carries on.
            for (int i = 0; i < skull.V.Count; i++)
            {
                var v = skull.V[i];
                float around = Mathf.Atan2(v.x, v.y) / (Mathf.PI * 2);
                if (around < 0) around += 1;
                skull.UV[i] = new Vector2(-v.z, around);
                float nose = Mathf.InverseLerp(1.2f, 0.4f, v.z);
                skull.Col[i] = new Color(1, 1, 1, Mathf.Lerp(0.15f, 0.9f, nose));
            }
            var m = RunAssets.Track(skull.ToMesh("head", true));
            var go = new GameObject("skull", typeof(MeshFilter), typeof(MeshRenderer));
            go.transform.SetParent(head, false);
            go.GetComponent<MeshFilter>().sharedMesh = m;
            go.GetComponent<MeshRenderer>().sharedMaterial = headMat;

            // Face details on the shared glossy vertex material.
            var face = new MeshKit();
            for (int s = -1; s <= 1; s += 2)
            {
                face.Tint(0x1b1d22, 1).Sphere(new Vector3(s * 0.2f, 0.12f, 1.52f), new Vector3(0.07f, 0.05f, 0.05f), 8, 6); // nostrils
                face.Tint(0xff8fab, 1).Sphere(new Vector3(s * 0.72f, -0.12f, 0.95f), new Vector3(0.2f, 0.1f, 0.14f), 10, 6); // blush
            }
            // A little smile.
            face.Tint(0x3a1f1f, 1);
            for (int i = 0; i < 8; i++)
            {
                float a0 = Mathf.Lerp(-0.9f, 0.9f, i / 8f), a1 = Mathf.Lerp(-0.9f, 0.9f, (i + 1) / 8f);
                Vector3 P(float a) => new Vector3(Mathf.Sin(a) * 0.62f, -0.3f + (1 - Mathf.Cos(a)) * 0.18f, 0.78f + Mathf.Cos(a) * 0.82f);
                face.Cylinder(P(a0), P(a1), 0.035f, 0.035f, 5, false, false);
            }
            Attach(head, "face", face, Mats.VertexGlossy);

            for (int s = 0; s < 2; s++)
            {
                float side = s == 0 ? -1 : 1;
                var eye = new GameObject("eye").transform;
                eye.SetParent(head, false);
                eye.localPosition = new Vector3(side * 0.5f, 0.72f, 0.42f);
                var ek = new MeshKit();
                ek.Tint(0xffffff).Sphere(Vector3.zero, 0.5f, 18, 14);
                Attach(eye, "ball", ek, Mats.VertexGlossy);
                var pupil = new GameObject("pupil").transform;
                pupil.SetParent(eye, false);
                pupil.localPosition = new Vector3(0, 0.1f, 0.3f);
                var pk = new MeshKit();
                pk.Tint(0x15181d).Sphere(Vector3.zero, new Vector3(0.28f, 0.3f, 0.24f), 14, 10);
                pk.Tint(0xffffff).Sphere(new Vector3(-0.08f, 0.13f, 0.2f), 0.085f, 8, 6);
                Attach(pupil, "pupil", pk, Mats.VertexGlossy);
                eyes[s] = eye;
                pupils[s] = pupil;
            }
        }

        Transform BuildTongue()
        {
            var t = new GameObject("tongue").transform;
            t.SetParent(head, false);
            t.localPosition = new Vector3(0, -0.22f, 1.45f);
            var k = new MeshKit();
            k.Tint(0xe0524d).Capsule(Vector3.zero, new Vector3(0, 0, 0.9f), 0.06f, 6);
            k.Capsule(new Vector3(0, 0, 0.9f), new Vector3(-0.16f, 0, 1.2f), 0.045f, 6);
            k.Capsule(new Vector3(0, 0, 0.9f), new Vector3(0.16f, 0, 1.2f), 0.045f, 6);
            Attach(t, "tongue", k, Mats.VertexGlossy);
            t.localScale = new Vector3(1, 1, 0.001f);
            return t;
        }

        Transform BuildHelmet()
        {
            var t = new GameObject("helmet").transform;
            t.SetParent(head, false);
            t.localPosition = new Vector3(0, 0.25f, -0.05f);
            var k = new MeshKit();
            k.Tint(0xe03131).Sphere(Vector3.zero, new Vector3(1.25f, 1.05f, 1.3f), 18, 12, 0, 0.5f);
            k.Tint(0xffffff).Box(new Vector3(0, 1.03f, 0), new Vector3(0.3f, 0.1f, 2.1f));
            k.Tint(0xb02525).Box(new Vector3(0, 0.05f, 1.25f), new Vector3(1.4f, 0.08f, 0.5f));
            Attach(t, "helmet", k, Mats.VertexGlossy);
            t.gameObject.SetActive(false);
            return t;
        }

        Transform BuildDragon()
        {
            var t = new GameObject("dragon").transform;
            t.SetParent(head, false);
            var k = new MeshKit();
            for (int s = -1; s <= 1; s += 2)
            {
                k.Tint(0xf3e6c8).Cylinder(new Vector3(s * 0.55f, 0.75f, -0.2f), new Vector3(s * 0.95f, 1.6f, -1.25f), 0.24f, 0.0f, 10);
                k.Tint(0xd8c49a).Cylinder(new Vector3(s * 0.62f, 0.9f, -0.4f), new Vector3(s * 0.66f, 0.97f, -0.5f), 0.22f, 0.21f, 10);
                k.Tint(0xf3e6c8).Cylinder(new Vector3(s * 0.9f, 0.4f, 0.0f), new Vector3(s * 1.35f, 0.6f, -0.6f), 0.13f, 0.0f, 8);
                k.Tint(0x7c1009).Box(new Vector3(s * 0.5f, 0.92f, 0.5f), new Vector3(0.75f, 0.16f, 0.5f));
                k.Tint(0xffffff).Cylinder(new Vector3(s * 0.35f, -0.35f, 1.35f), new Vector3(s * 0.33f, -0.62f, 1.38f), 0.07f, 0, 6);
            }
            for (int i = 0; i < 4; i++) k.Tint(0xd8331f).Cylinder(new Vector3(0, 0.82f, -0.1f - i * 0.4f), new Vector3(0, 1.3f - i * 0.08f, -0.35f - i * 0.4f), 0.16f, 0, 4);
            Attach(t, "crown", k, Mats.VertexGlossy);
            t.gameObject.SetActive(false);
            return t;
        }

        static void Attach(Transform parent, string name, MeshKit k, Material mat)
        {
            var go = new GameObject(name, typeof(MeshFilter), typeof(MeshRenderer));
            go.transform.SetParent(parent, false);
            go.GetComponent<MeshFilter>().sharedMesh = RunAssets.Track(k.ToMesh(name));
            go.GetComponent<MeshRenderer>().sharedMaterial = mat;
        }

        // ------------------------------------------------------------------ events from the game

        /// <summary>Something went down the hatch: a bulge travels to the tail, the head chomps.</summary>
        public void Gulp(float size)
        {
            if (bumps.Count < 12) bumps.Add(new Vector2(snake.Radius * 0.5f, Mathf.Clamp(size, 0.12f, 0.55f)));
            punch = 1;
        }

        public void Lick() { tongueT = 0.35f; tongueNext = Random.Range(1.2f, 3f); }

        // ------------------------------------------------------------------ per frame

        /// <summary>Called right after each sim step, so the view can interpolate between steps.</summary>
        public void OnStep()
        {
            prevHead = curHead;
            curHead = W.P(snake.x, snake.z);
            if ((prevHead - curHead).sqrMagnitude > 25) prevHead = curHead;
        }

        public void Sync(float alpha, float dt, float time, int tick, Vector2 steer)
        {
            var s = snake;
            if (!s.alive)
            {
                if (wasAlive) deadFor = 0;
                wasAlive = false;
                deadFor += dt;
                root.gameObject.SetActive(false);
                return;
            }
            if (!wasAlive) { spawnPop = 0; bumps.Clear(); prevHead = curHead = W.P(s.x, s.z); }
            wasAlive = true;
            root.gameObject.SetActive(true);
            spawnPop = Mathf.Min(1, spawnPop + dt * 2.2f);
            float pop = spawnPop >= 1 ? 1 : Ease.OutBack(spawnPop);

            // Head interpolation between sim steps; the whole body rides the same offset.
            var shown = Vector3.Lerp(prevHead, curHead, alpha);
            var offset = shown - curHead;

            float R = s.Radius * pop;
            float len = s.Length;
            int rings = Mathf.Clamp(Mathf.CeilToInt(len / Mathf.Clamp(R * 0.42f, 0.06f, 0.38f)) + 1, 8, MAX_RINGS);
            float ds = len / (rings - 1);
            float tailStart = len * 0.55f;

            for (int i = bumps.Count - 1; i >= 0; i--)
            {
                var b = bumps[i];
                b.x += BUMP_SPEED * dt * Mathf.Lerp(1, 0.5f, b.x / Mathf.Max(1, len));
                if (b.x > len * 0.9f) bumps.RemoveAt(i); else bumps[i] = b;
            }

            for (int i = 0; i < rings; i++)
            {
                s.SampleAt(i * ds, out float x, out float z);
                ringPos[i] = W.P(x, z) + offset;
                ringSink[i] = WaterStage != null ? Wet(x, z) : 0;
            }

            for (int i = 0; i < MAX_RINGS; i++)
            {
                int ri = Mathf.Min(i, rings - 1);
                float d = ri * ds;
                var c = ringPos[ri];
                Vector3 fwd = ri < rings - 1 ? ringPos[ri + 1] - ringPos[Mathf.Max(0, ri - 1)] : ringPos[ri] - ringPos[ri - 1];
                fwd.y = 0;
                if (fwd.sqrMagnitude < 1e-8f) fwd = -W.Dir(s.heading);
                fwd.Normalize();
                var side = Vector3.Cross(Vector3.up, fwd);

                float r = R;
                float neck = Mathf.SmoothStep(0, 1, Mathf.Clamp01(d / (R * 1.6f)));
                r *= 0.84f + 0.16f * neck;
                if (d > tailStart)
                {
                    float t = (d - tailStart) / Mathf.Max(0.01f, len - tailStart);
                    r *= Mathf.Lerp(1, 0.08f, Mathf.Pow(t, 1.5f));
                }
                foreach (var b in bumps)
                {
                    float u = (d - b.x) / (0.5f + R * 0.8f);
                    r *= 1 + b.y * Mathf.Exp(-u * u);
                }
                r *= 1 + 0.025f * Mathf.Sin(time * 3.2f - d * 1.7f);
                if (i >= rings) r = 0.0001f;
                float rv = r * 0.86f;
                var centre = c + Vector3.up * (rv + 0.012f);
                // A swimmer floats: its back just out of the Thames, which sits 0.3 m below the paper.
                if (ringSink[ri] > 0) centre.y -= ringSink[ri] * (0.312f + rv * 0.9f);

                int baseV = i * RING_VERTS;
                for (int j = 0; j <= SIDES; j++)
                {
                    float th = j / (float)SIDES * Mathf.PI * 2;
                    float cs = Mathf.Cos(th), sn = Mathf.Sin(th);
                    verts[baseV + j] = centre + Vector3.up * (cs * rv) + side * (sn * r);
                    norms[baseV + j] = (Vector3.up * (cs / rv) + side * (sn / r)).normalized;
                    tans[baseV + j] = new Vector4(fwd.x, fwd.y, fwd.z, 1);
                    uvs[baseV + j] = new Vector2(d, j / (float)SIDES);
                    cols[baseV + j] = Color.white;
                }
            }
            // Tail tip and the hidden nose cap.
            int last = rings - 1;
            var tailDir = (ringPos[last] - ringPos[Mathf.Max(0, last - 1)]).normalized;
            int tip = MAX_RINGS * RING_VERTS;
            verts[tip] = ringPos[last] + tailDir * R * 0.25f + Vector3.up * 0.05f;
            norms[tip] = tailDir; uvs[tip] = new Vector2(len, 0); cols[tip] = Color.white; tans[tip] = new Vector4(tailDir.x, 0, tailDir.z, 1);
            verts[tip + 1] = ringPos[0] + Vector3.up * R * 0.8f;
            norms[tip + 1] = Vector3.up; cols[tip + 1] = Color.white;

            bodyMesh.vertices = verts;
            bodyMesh.normals = norms;
            bodyMesh.tangents = tans;
            bodyMesh.uv = uvs;
            bodyMesh.colors = cols;
            if (rings != lastRings)
            {
                var idx = indices;
                int capStart = (MAX_RINGS - 1) * SIDES * 6;
                for (int j = 0; j < SIDES; j++)
                {
                    idx[capStart + j * 3] = tip;
                    idx[capStart + j * 3 + 1] = last * RING_VERTS + j + 1;
                    idx[capStart + j * 3 + 2] = last * RING_VERTS + j;
                }
                bodyMesh.SetIndices(idx, MeshTopology.Triangles, 0, false);
                lastRings = rings;
            }

            // ---- head
            float turn = Mathf.DeltaAngle(lastHeading * Mathf.Rad2Deg, s.heading * Mathf.Rad2Deg) / Mathf.Max(dt, 1e-3f);
            lastHeading = s.heading;
            roll = Mathf.Lerp(roll, Mathf.Clamp(turn * 0.05f, -16, 16), 1 - Mathf.Exp(-dt * 8));
            punch = Mathf.Max(0, punch - dt * 5);
            float chomp = 1 + Mathf.Sin(punch * Mathf.PI) * 0.18f;
            float headR = Mathf.Max(R, 0.14f) * 1.28f;
            float bob = Mathf.Sin(time * 9) * 0.03f * headR;
            HeadPos = shown + Vector3.up * (headR * 0.86f + bob);
            if (WaterStage != null)
            {
                float wet = Wet(s.x, s.z);
                HeadPos -= Vector3.up * (wet * (0.3f + headR * 0.3f));
                // Ripples spread from a swimming head.
                rippleIn -= dt;
                if (wet > 0.5f && rippleIn <= 0)
                {
                    rippleIn = 0.32f;
                    Fx.I?.Ring(new Vector3(HeadPos.x, -0.27f, HeadPos.z), new Color(0.88f, 0.97f, 1f, 0.85f), headR * 2.6f, 0.9f);
                }
            }
            head.position = HeadPos;
            head.rotation = W.Face(s.heading) * Quaternion.Euler(0, 0, -roll);
            head.localScale = new Vector3(headR * chomp, headR / chomp, headR * chomp);

            // Eyes: look toward the steering direction; blink now and then.
            blinkNext -= dt;
            if (blinkNext <= 0) { blinkT = 0.14f; blinkNext = Random.Range(1.8f, 4.5f); }
            blinkT = Mathf.Max(0, blinkT - dt);
            float lid = blinkT > 0 ? 0.12f : 1;
            var look = Vector3.zero;
            if (steer.sqrMagnitude > 0.01f)
            {
                var want = head.InverseTransformDirection(new Vector3(steer.x, 0, steer.y)).normalized;
                look = new Vector3(Mathf.Clamp(want.x * 0.12f, -0.12f, 0.12f), 0, 0);
            }
            for (int e = 0; e < 2; e++)
            {
                eyes[e].localScale = new Vector3(1, lid, 1);
                pupils[e].localPosition = Vector3.Lerp(pupils[e].localPosition, new Vector3(look.x, 0.1f, 0.3f), 1 - Mathf.Exp(-dt * 10));
            }

            // Tongue flicks.
            tongueNext -= dt;
            if (tongueNext <= 0) Lick();
            tongueT = Mathf.Max(0, tongueT - dt);
            float flick = tongueT > 0 ? Mathf.Sin((1 - tongueT / 0.35f) * Mathf.PI) * (1 + s.reachBonus) : 0;
            tongue.localScale = new Vector3(1, 1, Mathf.Max(0.001f, flick));
            tongue.localRotation = Quaternion.Euler(0, Mathf.Sin(time * 40) * 6 * flick, 0);

            helmet.gameObject.SetActive(s.helmetReady);
            if (hat) { hat.gameObject.SetActive(!s.helmetReady); if (hatSpins) hat.localRotation = Quaternion.Euler(0, time * 240, 0); }

            // Magic: a halo after the Stag's Blessing, sparkles pulled in by Pixie Dust.
            bool haloOn = s.HasMagic(MagicId.Halo);
            if (haloOn && halo == null)
            {
                var hk = new MeshKit();
                hk.Tint(0xffe066).Torus(Vector3.zero, 0.75f, 0.09f, 28, 8);
                var hg = new GameObject("halo", typeof(MeshFilter), typeof(MeshRenderer));
                hg.transform.SetParent(head, false);
                hg.transform.localPosition = new Vector3(0, 1.6f, -0.05f);
                hg.GetComponent<MeshFilter>().sharedMesh = RunAssets.Track(hk.ToMesh("halo"));
                hg.GetComponent<MeshRenderer>().sharedMaterial = Mats.Cached("haloMat", () => { var m = Mats.Toon(Color.white, 1.5f, 0.9f, 1); m.SetColor("_EmissionColor", new Color(1.2f, 0.9f, 0.3f)); return m; });
                halo = hg.transform;
            }
            if (halo) { halo.gameObject.SetActive(haloOn); halo.localRotation = Quaternion.Euler(10, time * 60, 0); }
            if (s.HasMagic(MagicId.Magnet) && Random.value < dt * 30)
                Fx.I.Trail(HeadPos + Random.onUnitSphere * 3 + Vector3.up, new Color(0.3f, 0.95f, 1f));
            if (trail != null && s.speedFactor > 0.2f)
            {
                trailIn -= dt;
                if (trailIn <= 0)
                {
                    trailIn = 0.04f;
                    Fx.I.Trail(BodyPoint(s.Length * 0.92f) + Random.insideUnitSphere * s.Radius * 0.6f, MeshKit.Hex(trail[Random.Range(0, trail.Length)]));
                }
            }
            bool isDragon = s.Tier >= 5;
            dragon.gameObject.SetActive(isDragon);

            // Bee Buddies orbit on the sim clock.
            while (bees.Count < s.bees) bees.Add(MakeBee());
            for (int i = 0; i < bees.Count; i++)
            {
                bool on = i < s.bees;
                bees[i].gameObject.SetActive(on);
                if (!on) continue;
                World.BeePosition(tick, s, i, out float bx, out float bz);
                var bp = W.P(bx, bz, 0.9f + Mathf.Sin(time * 6 + i) * 0.15f) + offset;
                var dir = bp - bees[i].position;
                bees[i].position = bp;
                if (dir.sqrMagnitude > 1e-6f) bees[i].rotation = Quaternion.LookRotation(dir.normalized);
                var wing = bees[i].GetChild(1);
                wing.localRotation = Quaternion.Euler(0, 0, Mathf.Sin(time * 60) * 40);
            }

            // Skin effects: dash glow, the grace-period blink, gold for the Dragon.
            glow = Mathf.Lerp(glow, s.dashing ? 1.3f : 0, 1 - Mathf.Exp(-dt * 10));
            float flash = s.immune > 0 ? (Mathf.Sin(time * 18) > 0 ? 0.16f : 0) : 0;
            bodyMat.SetFloat("_Radius", R);
            bodyMat.SetFloat("_Glow", glow);
            bodyMat.SetFloat("_Flash", flash);
            bodyMat.SetFloat("_Gold", isDragon ? 0.0f : 0);
            float ghost = s.HasMagic(MagicId.Hidden) ? 0.55f : 0;
            float ice = s.frozenFor > 0 ? 1 : 0;
            float rainbow = s.HasMagic(MagicId.Rainbow) ? 1 : 0;
            foreach (var m in new[] { bodyMat, headMat })
            {
                m.SetFloat("_Ghost", ghost);
                m.SetFloat("_Ice", Mathf.Lerp(m.GetFloat("_Ice"), ice, 1 - Mathf.Exp(-dt * 12)));
                m.SetFloat("_Rainbow", rainbow);
            }
            headMat.SetFloat("_Glow", glow * 0.5f);
            headMat.SetFloat("_Flash", flash);
        }

        int lastRings = -1;
        int[] indices;

        Transform MakeBee()
        {
            var t = new GameObject("bee").transform;
            t.SetParent(root, false);
            var k = new MeshKit();
            k.Tint(0xffd43b).Sphere(Vector3.zero, new Vector3(0.14f, 0.13f, 0.2f), 10, 8);
            k.Tint(0x222222).Sphere(new Vector3(0, 0, -0.02f), new Vector3(0.145f, 0.135f, 0.05f), 10, 6);
            k.Tint(0x222222).Sphere(new Vector3(0, 0, 0.09f), new Vector3(0.13f, 0.12f, 0.04f), 10, 6);
            k.Tint(0x222222).Sphere(new Vector3(0, 0.03f, 0.2f), 0.08f, 8, 6);
            Attach(t, "body", k, Mats.VertexGlossy);
            var w = new MeshKit();
            w.Tint(0xe7f5ff).Sphere(new Vector3(0.12f, 0.12f, 0), new Vector3(0.12f, 0.02f, 0.07f), 8, 4);
            w.Tint(0xe7f5ff).Sphere(new Vector3(-0.12f, 0.12f, 0), new Vector3(0.12f, 0.02f, 0.07f), 8, 4);
            Attach(t, "wings", w, Mats.VertexGlossy);
            return t;
        }

        /// <summary>A point a distance d behind the head (Unity space), for effects.</summary>
        public Vector3 BodyPoint(float d)
        {
            snake.SampleAt(d, out float x, out float z);
            return W.P(x, z, snake.Radius);
        }

        public void Destroy() => Object.Destroy(root.gameObject);
    }

    public static class Ease
    {
        public static float OutBack(float t) { const float c1 = 1.70158f, c3 = c1 + 1; return 1 + c3 * Mathf.Pow(t - 1, 3) + c1 * Mathf.Pow(t - 1, 2); }
        public static float OutElastic(float t) => t <= 0 ? 0 : t >= 1 ? 1 : Mathf.Pow(2, -10 * t) * Mathf.Sin((t * 10 - 0.75f) * (2 * Mathf.PI / 3)) + 1;
        public static float OutCubic(float t) => 1 - Mathf.Pow(1 - t, 3);
        public static float InOutSine(float t) => -(Mathf.Cos(Mathf.PI * t) - 1) / 2;
    }
}
