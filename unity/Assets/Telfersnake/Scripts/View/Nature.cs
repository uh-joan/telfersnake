using System.Collections.Generic;
using Telfer.Sim;
using UnityEngine;
using UnityEngine.Rendering;

namespace Telfer.View
{
    /// <summary>
    /// The Green's lawn: thousands of instanced grass tufts and wildflowers that sway in the wind and
    /// part around anything moving through them (the pushers are set by the game each frame).
    /// </summary>
    public sealed class GrassField : MonoBehaviour
    {
        Mesh tuft;
        Mesh[] flowers;
        Material grassMat;
        /// <summary>Tufts and flowers in 10 m chunks, each drawn with its own bounds so off-screen chunks are culled.</summary>
        readonly List<(Mesh mesh, Matrix4x4[] m, RenderParams rp)> batches = new List<(Mesh, Matrix4x4[], RenderParams)>();
        const float CHUNK = 10;

        /// <summary>The school's Green: a dense lawn in its rounded box, with a worn path across it.</summary>
        public void BuildSchool()
        {
            var g = School.GREEN;
            float x0 = g.x - g.w / 2, z0 = g.z - g.d / 2;
            Build(x0, z0, x0 + g.w, z0 + g.d, 0.26f, 0.035f, 5, (px, pz) =>
            {
                if (!InsideRounded(px, pz, g, 2.4f)) return 0;
                foreach (var t in School.TREES) if ((px - t.x) * (px - t.x) + (pz - t.z) * (pz - t.z) < (t.r + 0.15f) * (t.r + 0.15f)) return 0;
                float pathX = Mathf.Lerp(x0 + 8, x0 + 10, (pz - z0) / g.d);
                float onPath = Mathf.Clamp01(1 - Mathf.Abs(px - pathX) / 0.6f);
                float edge = Mathf.Clamp01(Mathf.Min(Mathf.Min(px - x0, x0 + g.w - px), Mathf.Min(pz - z0, z0 + g.d - pz)) / 1.2f);
                return Mathf.Lerp(0.55f, 1, edge) * (1 - onPath * 0.6f);
            });
        }

        /// <summary>
        /// A lawn over a rectangle (sim metres). `amount(x, z)` is 0 for bare ground up to 1 for a full,
        /// tall tuft; in between the grass thins and shortens.
        /// </summary>
        public void Build(float x0, float z0, float x1, float z1, float step, float flowerChance, int seed, System.Func<float, float, float> amount)
        {
            if (tuft == null)
            {
                tuft = TuftMesh();
                grassMat = new Material(Mats.GrassShader) { enableInstancing = true };
                grassMat.SetFloat("_Sway", 0.035f);
                flowers = new[] { FlowerMesh(0xffffff, 0xffd43b), FlowerMesh(0xffd43b, 0xf08c00), FlowerMesh(0xf783ac, 0xfff3bf), FlowerMesh(0x9775fa, 0xfff3bf), FlowerMesh(0xff6b6b, 0x2b2d42) };
            }
            var rng = new System.Random(seed);
            var chunks = new Dictionary<long, List<Matrix4x4>>();
            var flowerChunks = new Dictionary<long, List<Matrix4x4>>[flowers.Length];
            for (int i = 0; i < flowers.Length; i++) flowerChunks[i] = new Dictionary<long, List<Matrix4x4>>();
            long Key(float x, float z) => ((long)Mathf.FloorToInt(x / CHUNK) << 32) ^ (uint)Mathf.FloorToInt(z / CHUNK);
            void Put(Dictionary<long, List<Matrix4x4>> d, long k, Matrix4x4 m) { if (!d.TryGetValue(k, out var l)) d[k] = l = new List<Matrix4x4>(); l.Add(m); }
            float scaleUp = step / 0.26f;
            for (float x = x0 + 0.1f; x < x1 - 0.1f; x += step)
                for (float z = z0 + 0.1f; z < z1 - 0.1f; z += step)
                {
                    float px = x + (float)(rng.NextDouble() - 0.5) * step, pz = z + (float)(rng.NextDouble() - 0.5) * step;
                    float a = amount(px, pz);
                    if (a <= 0 || rng.NextDouble() > 0.3 + a) continue;
                    float s = a * (0.75f + (float)rng.NextDouble() * 0.5f) * Mathf.Lerp(1, scaleUp, 0.6f);
                    long k = Key(px, pz);
                    Put(chunks, k, Matrix4x4.TRS(W.P(px, pz), Quaternion.Euler(0, (float)rng.NextDouble() * 360, 0), new Vector3(s * scaleUp * 0.8f, s * (0.8f + (float)rng.NextDouble() * 0.5f), s * scaleUp * 0.8f)));
                    Count++;
                    if (rng.NextDouble() < flowerChance * a)
                    {
                        int f = rng.Next(flowers.Length);
                        Put(flowerChunks[f], k, Matrix4x4.TRS(W.P(px + 0.05f, pz), Quaternion.Euler(0, (float)rng.NextDouble() * 360, 0), Vector3.one * (0.8f + (float)rng.NextDouble() * 0.5f)));
                    }
                }
            void Emit(Mesh mesh, Material mat, Dictionary<long, List<Matrix4x4>> d)
            {
                foreach (var kv in d)
                {
                    var list = kv.Value;
                    var b = new Bounds(list[0].GetPosition(), Vector3.one);
                    foreach (var m in list) b.Encapsulate(m.GetPosition());
                    b.Expand(new Vector3(1.5f, 2, 1.5f));
                    var rp = new RenderParams(mat) { shadowCastingMode = ShadowCastingMode.Off, receiveShadows = true, worldBounds = b };
                    for (int i = 0; i < list.Count; i += 1000) batches.Add((mesh, list.GetRange(i, Mathf.Min(1000, list.Count - i)).ToArray(), rp));
                }
            }
            Emit(tuft, grassMat, chunks);
            for (int i = 0; i < flowers.Length; i++) Emit(flowers[i], Mats.VertexWind, flowerChunks[i]);
        }

        public int Count { get; private set; }

        static bool InsideRounded(float x, float z, Box b, float r)
        {
            float qx = Mathf.Abs(x - b.x) - b.w / 2 + r, qz = Mathf.Abs(z - b.z) - b.d / 2 + r;
            return Mathf.Sqrt(Mathf.Max(qx, 0) * Mathf.Max(qx, 0) + Mathf.Max(qz, 0) * Mathf.Max(qz, 0)) + Mathf.Min(Mathf.Max(qx, qz), 0) - r < 0;
        }

        void Update()
        {
            foreach (var (mesh, m, rp) in batches) Graphics.RenderMeshInstanced(rp, mesh, 0, m);
        }

        /// <summary>Seven curved blades from one root; uv.y runs root (0) to tip (1).</summary>
        static Mesh TuftMesh()
        {
            var k = new MeshKit();
            var rng = new System.Random(9);
            for (int b = 0; b < 7; b++)
            {
                float a = b / 7f * Mathf.PI * 2 + (float)rng.NextDouble();
                float lean = 0.15f + (float)rng.NextDouble() * 0.25f;
                float h = 0.22f + (float)rng.NextDouble() * 0.2f;
                float w = 0.035f + (float)rng.NextDouble() * 0.02f;
                var dir = new Vector3(Mathf.Cos(a), 0, Mathf.Sin(a));
                var side = Vector3.Cross(Vector3.up, dir);
                var root = dir * 0.04f;
                const int segs = 3;
                int start = k.V.Count;
                for (int s = 0; s <= segs; s++)
                {
                    float t = s / (float)segs;
                    var p = root + dir * lean * h * t * t * 1.6f + Vector3.up * h * t;
                    float ww = w * (1 - t * 0.92f);
                    var n = (Vector3.Cross(side, (dir * lean * 2 * t + Vector3.up)).normalized);
                    foreach (int sgn in new[] { -1, 1 })
                    {
                        k.V.Add(p + side * ww * sgn);
                        k.N.Add(n);
                        k.Col.Add(Color.white);
                        k.UV.Add(new Vector2(sgn * 0.5f + 0.5f, t));
                    }
                }
                for (int s = 0; s < segs; s++)
                {
                    int i0 = start + s * 2;
                    k.Tri(i0, i0 + 2, i0 + 1);
                    k.Tri(i0 + 1, i0 + 2, i0 + 3);
                }
            }
            return k.ToMesh("tuft");
        }

        static Mesh FlowerMesh(uint petal, uint centre)
        {
            var k = new MeshKit();
            k.Tint(0x3d8b2f, 0.8f).Cylinder(Vector3.zero, new Vector3(0.02f, 0.32f, 0), 0.012f, 0.01f, 4, false, false);
            var head = new Vector3(0.02f, 0.33f, 0);
            for (int i = 0; i < 5; i++)
            {
                float a = i / 5f * Mathf.PI * 2;
                k.Tint(petal).Sphere(head + new Vector3(Mathf.Cos(a) * 0.045f, 0, Mathf.Sin(a) * 0.045f), new Vector3(0.04f, 0.012f, 0.04f), 8, 4);
            }
            k.Tint(centre).Sphere(head + Vector3.up * 0.01f, 0.025f, 8, 5);
            return k.ToMesh("flower");
        }
    }

    /// <summary>Butterflies over the Green, pigeons circling the roofs, pollen drifting in the sun.</summary>
    public sealed class Wildlife : MonoBehaviour
    {
        sealed class Flyer { public Transform t, wingL, wingR; public Vector3 home; public float phase, speed, radius, height, flap; public bool bird; }
        readonly List<Flyer> flyers = new List<Flyer>();
        ParticleSystem pollen;

        public void Build(Stage stage)
        {
            var rng = new System.Random(77);
            bool common = stage.Id == StageId.Common;
            uint[] wings = { 0xffd43b, 0xff922b, 0x74c0fc, 0xf783ac, 0xffffff, 0xb197fc };
            for (int i = 0; i < 9; i++)
            {
                var home = common ? W.P(-30 + (float)rng.NextDouble() * 70, -20 + (float)rng.NextDouble() * 60)
                         : i < 6 ? W.P(School.GREEN.x + (float)(rng.NextDouble() - 0.5) * 16, School.GREEN.z + (float)(rng.NextDouble() - 0.5) * 9)
                                 : W.P(-28 + (float)rng.NextDouble() * 10, -30 + (float)rng.NextDouble() * 6);
                flyers.Add(MakeButterfly(home, wings[i % wings.Length], (float)rng.NextDouble() * 10));
            }
            for (int i = 0; i < 5; i++)
                flyers.Add(MakeBird(W.P(10 + (float)rng.NextDouble() * 20, -10 + (float)rng.NextDouble() * 20), (float)rng.NextDouble() * 10));

            // Pollen and dust motes in the sunbeams.
            var go = new GameObject("Pollen");
            go.transform.SetParent(transform, false);
            pollen = go.AddComponent<ParticleSystem>();
            pollen.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            var main = pollen.main;
            main.loop = true;
            main.duration = 10;
            main.startLifetime = new ParticleSystem.MinMaxCurve(6, 12);
            main.startSpeed = 0.15f;
            main.startSize = new ParticleSystem.MinMaxCurve(0.05f, 0.12f);
            main.startColor = new Color(1f, 0.96f, 0.8f, 0.5f);
            main.maxParticles = 400;
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            var em = pollen.emission; em.rateOverTime = 30;
            var sh = pollen.shape; sh.shapeType = ParticleSystemShapeType.Box; sh.scale = common ? new Vector3(110, 5, 100) : new Vector3(70, 5, 70); sh.position = common ? W.P(0, 10, 3) : new Vector3(0, 3, 0);
            var noise = pollen.noise; noise.enabled = true; noise.strength = 0.3f; noise.frequency = 0.2f;
            var col = pollen.colorOverLifetime; col.enabled = true;
            var grad = new Gradient();
            grad.SetKeys(new[] { new GradientColorKey(Color.white, 0), new GradientColorKey(Color.white, 1) }, new[] { new GradientAlphaKey(0, 0), new GradientAlphaKey(0.6f, 0.3f), new GradientAlphaKey(0, 1) });
            col.color = grad;
            go.GetComponent<ParticleSystemRenderer>().sharedMaterial = Mats.Glow(new Color(1, 0.95f, 0.75f, 1), 0, true, 1.6f);
            pollen.Play();
        }

        Flyer MakeButterfly(Vector3 home, uint color, float phase)
        {
            var body = new GameObject("butterfly").transform;
            body.SetParent(transform, false);
            var k = new MeshKit();
            k.Tint(0x2b2d42).Capsule(new Vector3(0, 0, -0.05f), new Vector3(0, 0, 0.05f), 0.012f, 6);
            Attach(body, k, Mats.VertexLit);
            Transform Wing(int side)
            {
                var w = new GameObject("wing").transform;
                w.SetParent(body, false);
                var wk = new MeshKit();
                wk.Tint(color);
                wk.Triangle(Vector3.zero, new Vector3(side * 0.11f, 0, 0.07f), new Vector3(side * 0.09f, 0, -0.02f));
                wk.Triangle(Vector3.zero, new Vector3(side * 0.08f, 0, -0.02f), new Vector3(side * 0.06f, 0, -0.08f));
                Attach(w, wk, Mats.VertexTwoSided, false);
                return w;
            }
            return new Flyer { t = body, wingL = Wing(-1), wingR = Wing(1), home = home, phase = phase, speed = 0.5f + phase % 0.4f, radius = 1.5f + phase % 2, height = 0.8f, flap = 18 };
        }

        Flyer MakeBird(Vector3 home, float phase)
        {
            var body = new GameObject("bird").transform;
            body.SetParent(transform, false);
            var k = new MeshKit();
            k.Tint(0x8d95a3).Sphere(Vector3.zero, new Vector3(0.12f, 0.1f, 0.22f), 10, 7);
            k.Tint(0x6c7380).Sphere(new Vector3(0, 0.05f, 0.2f), 0.08f, 8, 6);
            k.Tint(0xf2c230).Cylinder(new Vector3(0, 0.05f, 0.27f), new Vector3(0, 0.04f, 0.34f), 0.025f, 0, 5);
            Attach(body, k, Mats.VertexLit);
            Transform Wing(int side)
            {
                var w = new GameObject("wing").transform;
                w.SetParent(body, false);
                var wk = new MeshKit();
                wk.Tint(0x7b8392);
                wk.Triangle(Vector3.zero + new Vector3(0, 0, 0.08f), new Vector3(side * 0.45f, 0, -0.02f), new Vector3(0, 0, -0.12f));
                Attach(w, wk, Mats.VertexTwoSided);
                return w;
            }
            return new Flyer { t = body, wingL = Wing(-1), wingR = Wing(1), home = home, phase = phase, speed = 0.35f, radius = 14 + phase, height = 9 + phase * 0.4f, flap = 7, bird = true };
        }

        static void Attach(Transform t, MeshKit k, Material m, bool shadows = true)
        {
            t.gameObject.AddComponent<MeshFilter>().sharedMesh = k.ToMesh();
            var r = t.gameObject.AddComponent<MeshRenderer>();
            r.sharedMaterial = m;
            r.shadowCastingMode = shadows ? ShadowCastingMode.On : ShadowCastingMode.Off;
        }

        void Update()
        {
            float time = Time.time;
            foreach (var f in flyers)
            {
                float a = time * f.speed + f.phase;
                Vector3 p;
                if (f.bird)
                    p = f.home + new Vector3(Mathf.Cos(a) * f.radius, f.height + Mathf.Sin(a * 2.3f) * 0.8f, Mathf.Sin(a) * f.radius * 0.7f);
                else
                    p = f.home + new Vector3(Mathf.Sin(a * 1.3f) * f.radius + Mathf.Sin(a * 3.1f) * 0.4f, f.height + Mathf.Sin(a * 2.7f) * 0.35f + Mathf.Sin(a * 9) * 0.06f, Mathf.Cos(a * 0.9f) * f.radius);
                var vel = p - f.t.position;
                f.t.position = p;
                if (vel.sqrMagnitude > 1e-6f) f.t.rotation = Quaternion.Slerp(f.t.rotation, Quaternion.LookRotation(vel.normalized), 0.2f);
                float flap = f.bird ? (Mathf.Sin(a * 9) > 0.3f ? Mathf.Sin(time * f.flap * 2) * 35 : 5) : Mathf.Sin(time * f.flap + f.phase) * 70;
                f.wingL.localRotation = Quaternion.Euler(0, 0, -flap);
                f.wingR.localRotation = Quaternion.Euler(0, 0, flap);
            }
        }
    }
}
