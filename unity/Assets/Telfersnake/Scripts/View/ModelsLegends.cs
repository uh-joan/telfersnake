using System.Collections.Generic;
using Telfer.Sim;
using UnityEngine;

namespace Telfer.View
{
    /// <summary>
    /// London's eight legends (creatureView.ts), modelled the HD way like the Common's creatures: the classic's
    /// designs and colours, with more shape to them (scales, feathers, a mane, a ruff), and their magic bits in a
    /// second mesh drawn as light (the dragon's eyes, the phoenix's flames, the fairy's wings, the pearly lights…)
    /// so the bloom catches them. Built facing +z on y = 0 at the classic's size, scaled to HD's share of it.
    /// </summary>
    public static class ModelsLegends
    {
        const uint DARK = 0x2a2a2e, SILVER = 0xb8c0cc, SILVER_LIGHT = 0xdfe4ec, SILVER_DARK = 0x8e97a6, CITY_RED = 0xc8102e;
        const uint LION_GOLD = 0xe8b830, LION_LIGHT = 0xf6d878, MANE = 0xc98a1a, MANE_DARK = 0xa86a12, CROWN_GOLD = 0xffd23c;
        const uint SKIN = 0xf2c7a5, TEAL = 0x1fb8a8, TEAL_DARK = 0x16a0a0, PEARL = 0xfff8ee;

        /// <summary>How big each legend is drawn (creatureView.ts SIZE), and HD's share of that.</summary>
        static readonly Dictionary<CreatureKind, float> SIZE = new Dictionary<CreatureKind, float>
        {
            [CreatureKind.Dragon] = 1.9f, [CreatureKind.LionRoyal] = 2.1f, [CreatureKind.Phoenix] = 2.2f, [CreatureKind.Mermaid] = 2.3f,
            [CreatureKind.Ghost] = 2.2f, [CreatureKind.Gog] = 2.3f, [CreatureKind.Fairy] = 2.6f, [CreatureKind.Pearly] = 2.5f,
        };
        const float HD_SHARE = 0.62f;

        static readonly Dictionary<CreatureKind, (Mesh body, Mesh glow)> cache = new Dictionary<CreatureKind, (Mesh, Mesh)>();

        /// <summary>The solid creature.</summary>
        public static Mesh Body(CreatureKind k) => Get(k).Item1;

        /// <summary>Its magic, drawn as light (additive, HDR) over the body; null when it has none.</summary>
        public static Mesh Glow(CreatureKind k) => Get(k).Item2;

        /// <summary>The ones that float rather than stand.</summary>
        public static bool Hovers(CreatureKind k) => k == CreatureKind.Phoenix || k == CreatureKind.Ghost || k == CreatureKind.Fairy || k == CreatureKind.Pearly;

        static (Mesh, Mesh) Get(CreatureKind k)
        {
            if (cache.TryGetValue(k, out var m) && m.Item1) return m;
            var b = new MeshKit();
            var g = new MeshKit();
            switch (k)
            {
                case CreatureKind.Dragon: Dragon(b, g); break;
                case CreatureKind.LionRoyal: Lion(b, g); break;
                case CreatureKind.Phoenix: Phoenix(b, g); break;
                case CreatureKind.Mermaid: Mermaid(b, g); break;
                case CreatureKind.Ghost: Ghost(b, g); break;
                case CreatureKind.Gog: Giants(b, g); break;
                case CreatureKind.Fairy: Fairy(b, g); break;
                default: Pearly(b, g); break;
            }
            float s = SIZE[k] * HD_SHARE;
            m = (Finish(b, s, "legend-" + k), g.V.Count > 0 ? Finish(g, s, "legend-glow-" + k) : null);
            cache[k] = m;
            return m;
        }

        static Mesh Finish(MeshKit k, float s, string name)
        {
            for (int i = 0; i < k.V.Count; i++) k.V[i] *= s;
            return k.ToMesh(name);
        }

        // ------------------------------------------------------------------ bits

        static void Eyes(MeshKit k, Vector3 c, float spacing, float size, uint iris = 0x111111)
        {
            for (int s = -1; s <= 1; s += 2)
            {
                var p = c + new Vector3(s * spacing, 0, 0);
                k.Tint(0xffffff).Sphere(p, size, 10, 8);
                k.Tint(iris).Sphere(p + new Vector3(s * size * 0.12f, size * 0.08f, size * 0.62f), size * 0.56f, 8, 6);
                k.Tint(0xffffff).Sphere(p + new Vector3(s * size * 0.05f, size * 0.38f, size * 0.95f), size * 0.18f, 6, 4);
            }
        }

        static void Sparkles(MeshKit k, Vector3 c, float rad, int n, uint col, int seed, float size = 0.03f)
        {
            var rng = new System.Random(seed);
            k.Tint(col);
            for (int i = 0; i < n; i++)
            {
                float th = (float)rng.NextDouble() * Mathf.PI * 2, y = (float)rng.NextDouble() * 1.2f - 0.4f;
                var dir = new Vector3(Mathf.Cos(th), y, Mathf.Sin(th)).normalized;
                k.Sphere(c + dir * rad * (0.8f + 0.4f * (float)rng.NextDouble()), size * (0.7f + 0.6f * (float)rng.NextDouble()), 6, 4);
            }
        }

        /// <summary>A five-pointed star lying in the XY plane (facing +z), as two triangle fans.</summary>
        static void Star(MeshKit k, Vector3 c, float r, uint col)
        {
            k.Tint(col);
            for (int i = 0; i < 5; i++)
            {
                float a0 = Mathf.PI / 2 + i * Mathf.PI * 2 / 5, a1 = a0 + Mathf.PI / 5, am = a0 - Mathf.PI / 5;
                var tip = c + new Vector3(Mathf.Cos(a0), Mathf.Sin(a0), 0) * r;
                var l = c + new Vector3(Mathf.Cos(am), Mathf.Sin(am), 0) * r * 0.42f;
                var rr = c + new Vector3(Mathf.Cos(a1), Mathf.Sin(a1), 0) * r * 0.42f;
                k.Triangle(c, rr, tip);
                k.Triangle(c, tip, l);
            }
        }

        /// <summary>A curved tube through points, tapering from r0 to r1 (tails, flames, hair).</summary>
        static void Tube(MeshKit k, Vector3[] pts, float r0, float r1, int seg = 8)
        {
            for (int i = 0; i < pts.Length - 1; i++)
            {
                float t0 = i / (float)(pts.Length - 1), t1 = (i + 1) / (float)(pts.Length - 1);
                k.Cylinder(pts[i], pts[i + 1], Mathf.Lerp(r0, r1, t0), Mathf.Lerp(r0, r1, t1), seg, i == 0, false);
                if (i < pts.Length - 2) k.Sphere(pts[i + 1], Mathf.Lerp(r0, r1, t1), seg, Mathf.Max(4, seg / 2));
            }
        }

        static Vector3[] Arc(Vector3 a, Vector3 ctrl, Vector3 b, int n)
        {
            var p = new Vector3[n + 1];
            for (int i = 0; i <= n; i++)
            {
                float t = i / (float)n;
                p[i] = (1 - t) * (1 - t) * a + 2 * (1 - t) * t * ctrl + t * t * b;
            }
            return p;
        }

        // ------------------------------------------------------------------ the Silver Dragon of the City

        static void Dragon(MeshKit k, MeshKit g)
        {
            // Wings first (behind): silver arms, red membranes between the fingers, swept up and back.
            for (int s = -1; s <= 1; s += 2)
            {
                var shoulder = new Vector3(s * 0.16f, 1.02f, -0.08f);
                var elbow = new Vector3(s * 0.52f, 1.42f, -0.2f);
                var tip = new Vector3(s * 0.92f, 1.2f, -0.28f);
                var f1 = new Vector3(s * 0.78f, 0.82f, -0.26f);
                var f2 = new Vector3(s * 0.48f, 0.7f, -0.2f);
                k.Tint(CITY_RED).Triangle(shoulder, elbow, f2);
                k.Tint(0xd8283e).Triangle(elbow, f1, f2);
                k.Tint(CITY_RED).Triangle(elbow, tip, f1);
                k.Tint(SILVER).Cylinder(shoulder, elbow, 0.045f, 0.035f, 7);
                k.Tint(SILVER).Cylinder(elbow, tip, 0.035f, 0.012f, 6);
                k.Tint(SILVER_LIGHT).Cylinder(elbow, f1, 0.022f, 0.008f, 5);
                k.Tint(SILVER_LIGHT).Cylinder(elbow, f2, 0.022f, 0.008f, 5);
                k.Tint(SILVER_LIGHT).Sphere(elbow, 0.05f, 8, 6);
                k.Tint(SILVER_LIGHT).Cylinder(elbow, elbow + new Vector3(s * 0.02f, 0.1f, 0.02f), 0.025f, 0, 5);
            }
            // The body, rearing up; a pale scaled belly.
            k.Tint(SILVER).Capsule(new Vector3(0, 0.46f, -0.14f), new Vector3(0, 0.98f, 0.1f), 0.23f, 14);
            k.Tint(SILVER_LIGHT).Sphere(new Vector3(0, 0.74f, 0.1f), new Vector3(0.17f, 0.3f, 0.14f), 12, 10);
            for (int i = 0; i < 5; i++)
                k.Tint(0xeef1f5).Sphere(new Vector3(0, 0.56f + i * 0.09f, 0.2f + i * 0.012f), new Vector3(0.12f - i * 0.008f, 0.03f, 0.03f), 8, 4);
            // Neck and head: a long snout, horns, a frill.
            k.Tint(SILVER).Cylinder(new Vector3(0, 0.98f, 0.1f), new Vector3(0, 1.24f, 0.26f), 0.13f, 0.09f, 10);
            k.Tint(SILVER).Sphere(new Vector3(0, 1.31f, 0.31f), new Vector3(0.13f, 0.12f, 0.16f), 12, 10);
            k.Tint(SILVER_LIGHT).Sphere(new Vector3(0, 1.27f, 0.47f), new Vector3(0.09f, 0.07f, 0.11f), 10, 8);
            for (int s = -1; s <= 1; s += 2)
            {
                k.Tint(DARK).Sphere(new Vector3(s * 0.035f, 1.3f, 0.57f), 0.012f, 5, 4);
                k.Tint(SILVER_LIGHT).Cylinder(new Vector3(s * 0.06f, 1.4f, 0.26f), new Vector3(s * 0.12f, 1.6f, 0.13f), 0.032f, 0, 7);
                k.Tint(SILVER_DARK).Triangle(new Vector3(s * 0.1f, 1.33f, 0.24f), new Vector3(s * 0.22f, 1.42f, 0.16f), new Vector3(s * 0.12f, 1.22f, 0.2f));
            }
            Eyes(k, new Vector3(0, 1.36f, 0.4f), 0.07f, 0.035f, 0xb01020);
            // Spines down its back and tail.
            for (int i = 0; i < 6; i++)
            {
                var p = new Vector3(0, 1.18f - i * 0.13f, 0.12f - i * 0.07f - 0.13f);
                k.Tint(CITY_RED).Cylinder(p, p + new Vector3(0, 0.05f, -0.08f), 0.03f, 0, 5);
            }
            // The tail curls round behind, ending in a red spade.
            var tail = Arc(new Vector3(0, 0.42f, -0.3f), new Vector3(0.1f, 0.06f, -0.7f), new Vector3(0.42f, 0.08f, -0.86f), 6);
            k.Tint(SILVER);
            Tube(k, tail, 0.12f, 0.035f, 8);
            k.Tint(CITY_RED).Cylinder(tail[6], tail[6] + new Vector3(0.18f, 0.02f, 0.03f), 0.07f, 0, 4);
            // Legs: stout thighs and clawed feet.
            for (int s = -1; s <= 1; s += 2)
            {
                k.Tint(SILVER).Sphere(new Vector3(s * 0.16f, 0.42f, -0.02f), new Vector3(0.1f, 0.16f, 0.13f), 10, 8);
                k.Tint(SILVER).Cylinder(new Vector3(s * 0.16f, 0.32f, 0.02f), new Vector3(s * 0.16f, 0.04f, 0.06f), 0.06f, 0.05f, 8);
                for (int c = -1; c <= 1; c++)
                    k.Tint(SILVER_LIGHT).Cylinder(new Vector3(s * 0.16f + c * 0.03f, 0.03f, 0.08f), new Vector3(s * 0.16f + c * 0.04f, 0.01f, 0.16f), 0.018f, 0, 4);
                // Little arms holding the shield.
                k.Tint(SILVER).Cylinder(new Vector3(s * 0.17f, 0.92f, 0.14f), new Vector3(s * 0.12f, 0.8f, 0.28f), 0.04f, 0.035f, 6);
            }
            // The City's shield: white with a red cross, a gold rim, a red sword in the corner.
            k.Tint(CROWN_GOLD).RoundBox(new Vector3(0, 0.78f, 0.31f), new Vector3(0.34f, 0.4f, 0.04f), 0.03f, 3);
            k.Tint(0xffffff).RoundBox(new Vector3(0, 0.78f, 0.33f), new Vector3(0.3f, 0.36f, 0.03f), 0.025f, 3);
            k.Tint(CITY_RED).Box(new Vector3(0, 0.78f, 0.35f), new Vector3(0.07f, 0.34f, 0.02f));
            k.Tint(CITY_RED).Box(new Vector3(0, 0.82f, 0.35f), new Vector3(0.28f, 0.07f, 0.02f));
            k.Tint(CITY_RED).Box(new Vector3(-0.08f, 0.9f, 0.355f), new Vector3(0.03f, 0.06f, 0.02f));
            // Its magic: glowing red eyes and a silver shimmer along the wings' edges.
            for (int s = -1; s <= 1; s += 2)
            {
                g.Tint(0xff3040, 0.9f).Sphere(new Vector3(s * 0.075f, 1.365f, 0.43f), 0.03f, 8, 6);
                g.Tint(0xff6070, 0.35f).Cylinder(new Vector3(s * 0.52f, 1.42f, -0.2f), new Vector3(s * 0.92f, 1.2f, -0.28f), 0.05f, 0.02f, 6);
            }
            Sparkles(g, new Vector3(0, 1.0f, -0.1f), 0.75f, 7, 0xdfe8ff, 3, 0.03f);
        }

        // ------------------------------------------------------------------ the Royal Lion

        static void Lion(MeshKit k, MeshKit g)
        {
            // Body and legs.
            k.Tint(LION_GOLD).Sphere(new Vector3(0, 0.62f, -0.04f), new Vector3(0.24f, 0.24f, 0.42f), 14, 10);
            k.Tint(LION_LIGHT).Sphere(new Vector3(0, 0.55f, 0.02f), new Vector3(0.18f, 0.16f, 0.34f), 12, 8);
            foreach (var (x, z) in new[] { (0.14f, 0.26f), (-0.14f, 0.26f), (0.14f, -0.3f), (-0.14f, -0.3f) })
            {
                k.Tint(LION_GOLD).Sphere(new Vector3(x, 0.52f, z), new Vector3(0.09f, 0.15f, 0.11f), 10, 8);
                k.Tint(LION_GOLD).Cylinder(new Vector3(x, 0.44f, z), new Vector3(x, 0.06f, z + 0.01f), 0.06f, 0.055f, 8);
                k.Tint(LION_LIGHT).Sphere(new Vector3(x, 0.05f, z + 0.04f), new Vector3(0.07f, 0.05f, 0.09f), 8, 6);
            }
            // The tail, with its tuft.
            var tail = Arc(new Vector3(0, 0.7f, -0.42f), new Vector3(0, 0.95f, -0.7f), new Vector3(0, 0.72f, -0.88f), 5);
            k.Tint(LION_GOLD);
            Tube(k, tail, 0.03f, 0.022f, 6);
            k.Tint(MANE).Sphere(tail[5], 0.065f, 8, 6);
            // The big mane: two rings of tufts round the face, darker behind.
            var face = new Vector3(0, 0.88f, 0.36f);
            for (int i = 0; i < 14; i++)
            {
                float a = i / 14f * Mathf.PI * 2;
                var o = new Vector3(Mathf.Cos(a) * 0.24f, Mathf.Sin(a) * 0.24f, -0.06f);
                k.Tint(i % 2 == 0 ? MANE : MANE_DARK).Sphere(face + o, new Vector3(0.11f, 0.11f, 0.1f), 9, 7);
            }
            k.Tint(MANE_DARK).Sphere(face + new Vector3(0, 0, -0.12f), new Vector3(0.28f, 0.28f, 0.16f), 12, 10);
            for (int i = 0; i < 10; i++)
            {
                float a = i / 10f * Mathf.PI * 2 + 0.3f;
                k.Tint(MANE).Sphere(face + new Vector3(Mathf.Cos(a) * 0.16f, Mathf.Sin(a) * 0.16f, 0.0f), 0.075f, 8, 6);
            }
            // The face: a golden head, a pale muzzle, a dark nose, ears in the mane.
            k.Tint(LION_GOLD).Sphere(face + new Vector3(0, 0, 0.06f), new Vector3(0.17f, 0.16f, 0.15f), 12, 10);
            k.Tint(0xfff0c8).Sphere(face + new Vector3(0, -0.06f, 0.17f), new Vector3(0.09f, 0.065f, 0.07f), 10, 8);
            k.Tint(0x6a3a1a).Sphere(face + new Vector3(0, -0.02f, 0.235f), new Vector3(0.035f, 0.025f, 0.02f), 8, 6);
            for (int s = -1; s <= 1; s += 2) k.Tint(LION_GOLD).Sphere(face + new Vector3(s * 0.13f, 0.13f, 0.03f), new Vector3(0.05f, 0.05f, 0.03f), 8, 6);
            Eyes(k, face + new Vector3(0, 0.05f, 0.15f), 0.065f, 0.032f, 0x3a2410);
            // The crown: a gold band, five points with pearls, red velvet inside, a red jewel at the front.
            var crown = face + new Vector3(0, 0.22f, 0.04f);
            k.Tint(0xb0122a).Sphere(crown + new Vector3(0, 0.04f, 0), new Vector3(0.12f, 0.08f, 0.12f), 10, 8);
            k.Tint(CROWN_GOLD).Cylinder(crown, crown + new Vector3(0, 0.08f, 0), 0.15f, 0.14f, 14);
            k.Tint(0xffe27a).Torus(crown, 0.15f, 0.015f, 16, 5);
            for (int i = 0; i < 5; i++)
            {
                float a = Mathf.PI / 2 + i / 5f * Mathf.PI * 2;
                var b = crown + new Vector3(Mathf.Cos(a) * 0.135f, 0.07f, Mathf.Sin(a) * 0.135f);
                k.Tint(CROWN_GOLD).Cylinder(b, b + new Vector3(0, 0.1f, 0), 0.035f, 0, 5);
                k.Tint(PEARL).Sphere(b + new Vector3(0, 0.11f, 0), 0.018f, 6, 4);
            }
            k.Tint(CROWN_GOLD).Sphere(crown + new Vector3(0, 0.14f, 0), 0.03f, 6, 4);
            // Its magic: the crown's jewel and gold catch the light.
            g.Tint(0xff2a3a, 0.95f).Sphere(crown + new Vector3(0, 0.04f, 0.15f), 0.032f, 8, 6);
            g.Tint(0xffd040, 0.35f).Torus(crown + new Vector3(0, 0.04f, 0), 0.155f, 0.03f, 16, 5);
            Sparkles(g, crown + new Vector3(0, 0.12f, 0), 0.28f, 6, 0xffe080, 5, 0.025f);
        }

        // ------------------------------------------------------------------ the Phoenix of St Paul's

        static void Phoenix(MeshKit k, MeshKit g)
        {
            const uint RED = 0xe8301a, ORANGE = 0xff7a1a, AMBER = 0xffa01a, YELLOW = 0xffd21a;
            // Wings spread wide: three layers of feathers, red outside to yellow inside.
            for (int s = -1; s <= 1; s += 2)
            {
                var root = new Vector3(s * 0.12f, 1.02f, -0.02f);
                for (int i = 0; i < 6; i++)
                {
                    float a = 0.35f + i * 0.17f; // fan from up-and-out to out-and-down
                    var dir = new Vector3(s * Mathf.Sin(a + 0.5f), Mathf.Cos(a + 0.5f) * 0.9f, -0.08f);
                    float len = 0.62f - i * 0.05f;
                    var tip = root + dir * len;
                    var side = new Vector3(0, 0, 1) * 0.0f + Vector3.Cross(dir, Vector3.forward).normalized * 0.07f;
                    k.Tint(i < 2 ? RED : i < 4 ? ORANGE : AMBER).Triangle(root, tip + side, tip - side);
                    k.Tint(YELLOW).Triangle(root + new Vector3(0, 0, 0.01f), root + dir * len * 0.55f + side * 0.6f, root + dir * len * 0.55f - side * 0.6f);
                    g.Tint(i < 3 ? 0xff5a20u : 0xffb030u, 0.4f).Sphere(tip, 0.05f, 6, 4);
                }
            }
            // Body and head.
            k.Tint(ORANGE).Sphere(new Vector3(0, 0.95f, 0), new Vector3(0.19f, 0.21f, 0.26f), 14, 10);
            k.Tint(YELLOW).Sphere(new Vector3(0, 0.9f, 0.1f), new Vector3(0.13f, 0.15f, 0.15f), 12, 8);
            k.Tint(AMBER).Sphere(new Vector3(0, 1.19f, 0.19f), new Vector3(0.12f, 0.12f, 0.13f), 12, 10);
            k.Tint(0xffe066).Cylinder(new Vector3(0, 1.17f, 0.3f), new Vector3(0, 1.13f, 0.42f), 0.04f, 0, 6);
            Eyes(k, new Vector3(0, 1.23f, 0.27f), 0.06f, 0.028f);
            // A flame crest.
            for (int i = 0; i < 4; i++)
            {
                var b = new Vector3(0, 1.28f, 0.2f - i * 0.06f);
                k.Tint(i % 2 == 0 ? YELLOW : ORANGE).Cylinder(b, b + new Vector3(0, 0.15f - i * 0.02f, -0.06f - i * 0.02f), 0.03f, 0, 5);
                g.Tint(0xffc020, 0.6f).Cylinder(b, b + new Vector3(0, 0.17f - i * 0.02f, -0.07f - i * 0.02f), 0.04f, 0, 5);
            }
            // The long flame tail: five plumes sweeping down and back, each burning brighter at its root.
            for (int i = 0; i < 5; i++)
            {
                float x = (i - 2) * 0.07f;
                var pts = Arc(new Vector3(x * 0.5f, 0.86f, -0.2f), new Vector3(x, 0.6f, -0.5f), new Vector3(x * 1.8f, 0.42f - Mathf.Abs(i - 2) * 0.05f, -0.86f + Mathf.Abs(i - 2) * 0.08f), 5);
                k.Tint(i % 2 == 0 ? RED : i == 2 ? YELLOW : ORANGE);
                Tube(k, pts, 0.05f, 0.012f, 6);
                g.Tint(i == 2 ? 0xffd040u : 0xff6020u, 0.55f);
                Tube(g, pts, 0.075f, 0.02f, 6);
            }
            // Its magic: a burning heart and drifting sparks.
            g.Tint(0xffb030, 0.35f).Sphere(new Vector3(0, 0.95f, 0), new Vector3(0.24f, 0.26f, 0.31f), 12, 8);
            Sparkles(g, new Vector3(0, 0.95f, -0.2f), 0.6f, 9, 0xffd060, 9, 0.035f);
        }

        // ------------------------------------------------------------------ the Thames Mermaid

        static void Mermaid(MeshKit k, MeshKit g)
        {
            // Her rock on the bank.
            k.Tint(0x8a8f96).Blob(new Vector3(0, 0.14f, -0.05f), new Vector3(0.32f, 0.18f, 0.3f), 0.18f, 21, 1, true);
            // The tail: curled round the rock, teal scales, the fin up.
            var tail = Arc(new Vector3(0, 0.4f, 0.0f), new Vector3(0.05f, 0.22f, -0.36f), new Vector3(0.24f, 0.36f, -0.56f), 6);
            k.Tint(TEAL);
            Tube(k, tail, 0.15f, 0.06f, 10);
            for (int i = 1; i < 6; i++)
                k.Tint(0x3fd8c8).Sphere(Vector3.Lerp(tail[i], tail[i + 1], 0.5f) + new Vector3(0, 0.06f, 0.02f), new Vector3(0.07f - i * 0.008f, 0.02f, 0.05f), 6, 4);
            var fb = tail[6];
            for (int s = -1; s <= 1; s += 2)
                k.Tint(TEAL_DARK).Triangle(fb, fb + new Vector3(s * 0.2f, 0.24f, -0.02f), fb + new Vector3(s * 0.04f, 0.2f, -0.12f));
            // Her body: shoulders, arms, a lilac shell top.
            k.Tint(SKIN).Capsule(new Vector3(0, 0.5f, 0.04f), new Vector3(0, 0.76f, 0.05f), 0.13f, 12);
            for (int s = -1; s <= 1; s += 2)
            {
                k.Tint(0xa070e0).Sphere(new Vector3(s * 0.065f, 0.68f, 0.15f), new Vector3(0.06f, 0.055f, 0.04f), 8, 6);
                k.Tint(SKIN).Cylinder(new Vector3(s * 0.13f, 0.74f, 0.04f), new Vector3(s * 0.2f, 0.5f, 0.12f), 0.035f, 0.03f, 6);
                k.Tint(SKIN).Sphere(new Vector3(s * 0.2f, 0.48f, 0.13f), 0.035f, 6, 4);
            }
            // Her head and her long red hair falling down her back.
            k.Tint(SKIN).Sphere(new Vector3(0, 0.98f, 0.07f), 0.14f, 14, 10);
            k.Tint(0xd8452a).Sphere(new Vector3(0, 1.03f, 0.02f), new Vector3(0.155f, 0.15f, 0.15f), 12, 10);
            for (int i = 0; i < 5; i++)
            {
                float x = (i - 2) * 0.055f;
                var hair = Arc(new Vector3(x, 1.0f, -0.06f), new Vector3(x * 1.4f, 0.82f, -0.16f), new Vector3(x * 1.2f + Mathf.Sin(i) * 0.03f, 0.56f, -0.1f), 4);
                k.Tint(i % 2 == 0 ? 0xd8452au : 0xe8603a);
                Tube(k, hair, 0.05f, 0.025f, 6);
            }
            k.Tint(0xff8aa0).Sphere(new Vector3(0.1f, 1.1f, 0.06f), 0.035f, 6, 4); // a flower in her hair
            Eyes(k, new Vector3(0, 0.99f, 0.18f), 0.05f, 0.03f, 0x1a6a6a);
            k.Tint(0xe88a80).Sphere(new Vector3(0, 0.93f, 0.2f), new Vector3(0.025f, 0.01f, 0.01f), 6, 4);
            // Its magic: a pearl necklace that glows, and river sparkles.
            for (int i = 0; i < 7; i++)
            {
                float a = Mathf.PI * (0.15f + 0.7f * i / 6f);
                g.Tint(0xe8fff8, 0.8f).Sphere(new Vector3(Mathf.Cos(a) * 0.1f, 0.84f - Mathf.Sin(a) * 0.03f, 0.08f + Mathf.Sin(a) * 0.08f), 0.018f, 6, 4);
            }
            g.Tint(0x50e8d8, 0.3f);
            Tube(g, tail, 0.18f, 0.08f, 8);
            Sparkles(g, new Vector3(0, 0.6f, -0.1f), 0.55f, 7, 0x9ff8ff, 13, 0.03f);
        }

        // ------------------------------------------------------------------ the Friendly Tower Ghost

        static void Ghost(MeshKit k, MeshKit g)
        {
            const uint SHEET = 0xf6f8ff;
            // The sheet: a round head flaring into a skirt with a scalloped hem.
            k.Tint(SHEET).Sphere(new Vector3(0, 1.0f, 0), new Vector3(0.26f, 0.27f, 0.25f), 16, 12);
            k.Tint(SHEET).Cylinder(new Vector3(0, 0.98f, 0), new Vector3(0, 0.5f, 0), 0.26f, 0.36f, 18, false, false);
            for (int i = 0; i < 9; i++)
            {
                float a = i / 9f * Mathf.PI * 2;
                k.Tint(SHEET).Sphere(new Vector3(Mathf.Cos(a) * 0.32f, 0.48f, Mathf.Sin(a) * 0.32f), new Vector3(0.09f, 0.11f, 0.09f), 8, 6);
            }
            // Little arms held out, spooky.
            for (int s = -1; s <= 1; s += 2)
                k.Tint(SHEET).Capsule(new Vector3(s * 0.27f, 0.78f, 0.04f), new Vector3(s * 0.4f, 0.86f, 0.14f), 0.06f, 8);
            // The Tudor ruff: a frilly double collar of puffs round its neck.
            for (int i = 0; i < 14; i++)
            {
                float a = i / 14f * Mathf.PI * 2;
                k.Tint(0xffffff).Sphere(new Vector3(Mathf.Cos(a) * 0.28f, 0.82f, Mathf.Sin(a) * 0.28f), new Vector3(0.075f, 0.05f, 0.075f), 8, 5);
                k.Tint(0xe8ecf8).Sphere(new Vector3(Mathf.Cos(a + 0.22f) * 0.24f, 0.86f, Mathf.Sin(a + 0.22f) * 0.24f), new Vector3(0.06f, 0.04f, 0.06f), 7, 5);
            }
            // A face: big dark eyes with highlights, a little "oo" mouth, rosy cheeks.
            for (int s = -1; s <= 1; s += 2)
            {
                k.Tint(0x22222a).Sphere(new Vector3(s * 0.09f, 1.04f, 0.21f), new Vector3(0.05f, 0.065f, 0.03f), 10, 8);
                k.Tint(0xffffff).Sphere(new Vector3(s * 0.08f, 1.07f, 0.235f), 0.015f, 6, 4);
                k.Tint(0xffc0d0).Sphere(new Vector3(s * 0.15f, 0.96f, 0.19f), new Vector3(0.035f, 0.02f, 0.01f), 6, 4);
            }
            k.Tint(0x2a2a2e).Sphere(new Vector3(0, 0.93f, 0.24f), new Vector3(0.035f, 0.045f, 0.02f), 8, 6);
            // Its magic: an ethereal blue-white glow round the whole sheet, and wisps.
            g.Tint(0xb8d4ff, 0.32f).Sphere(new Vector3(0, 1.0f, 0), new Vector3(0.3f, 0.31f, 0.29f), 14, 10);
            g.Tint(0xb8d4ff, 0.24f).Cylinder(new Vector3(0, 0.98f, 0), new Vector3(0, 0.44f, 0), 0.3f, 0.42f, 16, false, false);
            Sparkles(g, new Vector3(0, 0.8f, 0), 0.55f, 8, 0xd8e8ff, 17, 0.03f);
        }

        // ------------------------------------------------------------------ Gog & Magog

        static void Giants(MeshKit k, MeshKit g)
        {
            for (int s = -1; s <= 1; s += 2)
            {
                bool gog = s < 0;
                float x = s * 0.28f;
                uint tunic = gog ? 0x6b8a3au : 0x8a3a3au, beard = gog ? 0x6b4a2au : 0xa0a0a0u, helm = gog ? 0xd8b030u : 0x9a9aa8u;
                // Legs and boots.
                for (int kk = -1; kk <= 1; kk += 2)
                {
                    k.Tint(0x5a3a24).Cylinder(new Vector3(x + kk * 0.06f, 0.3f, 0), new Vector3(x + kk * 0.06f, 0.05f, 0), 0.045f, 0.045f, 7);
                    k.Tint(0x3a2618).Sphere(new Vector3(x + kk * 0.06f, 0.04f, 0.03f), new Vector3(0.055f, 0.04f, 0.075f), 8, 6);
                }
                // A belted tunic with a scalloped hem, and arms.
                k.Tint(tunic).Cylinder(new Vector3(x, 0.66f, 0), new Vector3(x, 0.28f, 0), 0.13f, 0.17f, 12);
                k.Tint(tunic).Sphere(new Vector3(x, 0.64f, 0), new Vector3(0.14f, 0.08f, 0.13f), 10, 6);
                k.Tint(0x4a2e1a).Torus(new Vector3(x, 0.46f, 0), 0.15f, 0.022f, 14, 4);
                k.Tint(CROWN_GOLD).Box(new Vector3(x, 0.46f, 0.15f), new Vector3(0.05f, 0.045f, 0.02f));
                for (int kk = -1; kk <= 1; kk += 2)
                {
                    k.Tint(tunic).Cylinder(new Vector3(x + kk * 0.13f, 0.62f, 0), new Vector3(x + kk * 0.17f, 0.44f, 0.05f), 0.04f, 0.035f, 6);
                    k.Tint(SKIN).Sphere(new Vector3(x + kk * 0.17f, 0.42f, 0.06f), 0.035f, 6, 4);
                }
                // Head, a big beard, a helmet with a little crest.
                k.Tint(SKIN).Sphere(new Vector3(x, 0.78f, 0.02f), 0.12f, 12, 10);
                k.Tint(beard).Sphere(new Vector3(x, 0.7f, 0.08f), new Vector3(0.1f, 0.11f, 0.08f), 10, 8);
                k.Tint(beard).Sphere(new Vector3(x, 0.76f, 0.11f), new Vector3(0.07f, 0.025f, 0.03f), 8, 4);
                k.Tint(SKIN).Sphere(new Vector3(x, 0.78f, 0.13f), 0.025f, 6, 4);
                Eyes(k, new Vector3(x, 0.82f, 0.1f), 0.04f, 0.022f);
                k.Tint(helm).Sphere(new Vector3(x, 0.86f, 0.01f), new Vector3(0.13f, 0.08f, 0.13f), 12, 6, 0, 0.5f);
                k.Tint(helm).Cylinder(new Vector3(x, 0.86f, 0.01f), new Vector3(x, 0.84f, 0.01f), 0.14f, 0.14f, 12);
                k.Tint(gog ? 0xc8102eu : 0x2f5fd0u).Box(new Vector3(x, 0.96f, 0.0f), new Vector3(0.025f, 0.08f, 0.16f));
            }
            // Gog's spear and round gold shield; Magog's knobbly club.
            k.Tint(0x8a6a40).Cylinder(new Vector3(-0.47f, 0.05f, 0.08f), new Vector3(-0.47f, 1.0f, 0.08f), 0.018f, 0.018f, 6);
            k.Tint(0xc8ccd6).Cylinder(new Vector3(-0.47f, 1.0f, 0.08f), new Vector3(-0.47f, 1.14f, 0.08f), 0.04f, 0, 4);
            k.M = Matrix4x4.TRS(new Vector3(-0.3f, 0.44f, 0.17f), Quaternion.Euler(90, 0, 0), Vector3.one);
            k.Tint(0xd8b030).Cylinder(new Vector3(0, -0.015f, 0), new Vector3(0, 0.015f, 0), 0.14f, 0.14f, 16);
            k.Tint(0xb08a20).Torus(new Vector3(0, 0.018f, 0), 0.12f, 0.012f, 16, 4);
            k.Tint(0xffe27a).Sphere(new Vector3(0, 0.025f, 0), 0.035f, 8, 6);
            k.M = Matrix4x4.identity;
            k.Tint(0x6b4a2a).Cylinder(new Vector3(0.46f, 0.4f, 0.08f), new Vector3(0.58f, 0.78f, 0.04f), 0.025f, 0.065f, 8);
            for (int i = 0; i < 4; i++) k.Tint(0x5a3a1a).Sphere(new Vector3(0.52f + i * 0.02f, 0.58f + i * 0.06f, 0.08f - i * 0.01f), 0.03f, 6, 4);
            // Its magic: a giant's golden glow round the shield's boss and the spear tip.
            g.Tint(0xffd860, 0.7f).Sphere(new Vector3(-0.3f, 0.44f, 0.2f), 0.05f, 8, 6);
            g.Tint(0xe0eaff, 0.6f).Cylinder(new Vector3(-0.47f, 0.99f, 0.08f), new Vector3(-0.47f, 1.17f, 0.08f), 0.06f, 0, 5);
            Sparkles(g, new Vector3(0, 0.7f, 0), 0.62f, 8, 0xffe080, 23, 0.03f);
        }

        // ------------------------------------------------------------------ an Elfin Oak fairy

        static void Fairy(MeshKit k, MeshKit g)
        {
            // Gauzy wings: four, pale mint, drawn again as light.
            foreach (var (up, len, wide) in new[] { (0.55f, 0.24f, 0.09f), (1.2f, 0.17f, 0.07f) })
                for (int s = -1; s <= 1; s += 2)
                {
                    var root = new Vector3(s * 0.03f, 0.98f, -0.06f);
                    var dir = new Vector3(s * Mathf.Sin(up), Mathf.Cos(up), -0.3f).normalized;
                    var side = Vector3.Cross(dir, Vector3.forward).normalized * wide;
                    var tip = root + dir * len;
                    var mid = root + dir * len * 0.55f;
                    k.Tint(0xd8fff0).Triangle(root, mid + side, tip);
                    k.Tint(0xc8f4ff).Triangle(root, tip, mid - side);
                    g.Tint(0xa8ffe0, 0.3f).Triangle(root, mid + side * 1.15f, tip + dir * 0.02f);
                    g.Tint(0xa8f0ff, 0.3f).Triangle(root, tip + dir * 0.02f, mid - side * 1.15f);
                }
            // A leaf dress: a green cone skirted with leaf points.
            k.Tint(0x4cbf5c).Cylinder(new Vector3(0, 1.0f, 0), new Vector3(0, 0.72f, 0), 0.05f, 0.14f, 10);
            for (int i = 0; i < 7; i++)
            {
                float a = i / 7f * Mathf.PI * 2;
                var b = new Vector3(Mathf.Cos(a) * 0.12f, 0.75f, Mathf.Sin(a) * 0.12f);
                k.Tint(i % 2 == 0 ? 0x3aa84au : 0x5ccf6a).Triangle(b + new Vector3(-Mathf.Sin(a) * 0.05f, 0.04f, Mathf.Cos(a) * 0.05f), b + new Vector3(Mathf.Sin(a) * 0.05f, 0.04f, -Mathf.Cos(a) * 0.05f), b + new Vector3(Mathf.Cos(a) * 0.05f, -0.1f, Mathf.Sin(a) * 0.05f));
            }
            // Little legs and arms.
            for (int s = -1; s <= 1; s += 2)
            {
                k.Tint(SKIN).Cylinder(new Vector3(s * 0.035f, 0.74f, 0), new Vector3(s * 0.04f, 0.58f, 0.02f), 0.018f, 0.015f, 5);
                k.Tint(0x3aa84a).Sphere(new Vector3(s * 0.04f, 0.57f, 0.035f), new Vector3(0.022f, 0.016f, 0.03f), 6, 4);
                k.Tint(SKIN).Cylinder(new Vector3(s * 0.045f, 0.97f, 0), new Vector3(s * 0.1f, 0.9f, 0.04f), 0.015f, 0.013f, 5);
            }
            // Head, golden hair in a bun, big eyes.
            k.Tint(SKIN).Sphere(new Vector3(0, 1.07f, 0.01f), 0.08f, 12, 10);
            k.Tint(0xffd23c).Sphere(new Vector3(0, 1.1f, -0.015f), new Vector3(0.086f, 0.075f, 0.085f), 10, 8);
            k.Tint(0xffc21a).Sphere(new Vector3(0, 1.17f, -0.04f), 0.04f, 8, 6);
            Eyes(k, new Vector3(0, 1.075f, 0.065f), 0.03f, 0.018f, 0x2a6a3a);
            // The wand, with its star.
            k.Tint(0xffffff).Cylinder(new Vector3(0.1f, 0.9f, 0.04f), new Vector3(0.2f, 1.08f, 0.08f), 0.008f, 0.008f, 4);
            Star(k, new Vector3(0.21f, 1.11f, 0.09f), 0.05f, 0xfff6a0);
            // Its magic: the star blazes and fairy dust trails off the wand.
            Star(g, new Vector3(0.21f, 1.11f, 0.095f), 0.08f, 0xfff080);
            g.Tint(0xfff6c0, 0.6f).Sphere(new Vector3(0.21f, 1.11f, 0.09f), 0.04f, 8, 6);
            Sparkles(g, new Vector3(0.12f, 1.0f, 0.0f), 0.24f, 10, 0xfff0a0, 29, 0.018f);
        }

        // ------------------------------------------------------------------ the Pearly Lights

        static void Pearly(MeshKit k, MeshKit g)
        {
            // A ring of pearl buttons floating round, each with its four holes.
            for (int i = 0; i < 7; i++)
            {
                float a = i / 7f * Mathf.PI * 2;
                var c = new Vector3(Mathf.Cos(a) * 0.34f, 0.95f + Mathf.Sin(a * 2) * 0.07f, Mathf.Sin(a) * 0.34f);
                var face = Quaternion.LookRotation(new Vector3(Mathf.Cos(a), 0, Mathf.Sin(a)), Vector3.up) * Quaternion.Euler(90, 0, 0);
                k.M = Matrix4x4.TRS(c, face, Vector3.one);
                k.Tint(PEARL).Cylinder(new Vector3(0, -0.018f, 0), new Vector3(0, 0.018f, 0), 0.09f, 0.09f, 14);
                k.Tint(0xf0e6d8).Torus(new Vector3(0, 0.02f, 0), 0.07f, 0.008f, 14, 4);
                foreach (var (hx, hz) in new[] { (-1f, -1f), (1f, -1f), (-1f, 1f), (1f, 1f) })
                    k.Tint(0xb8b0a0).Cylinder(new Vector3(hx * 0.022f, 0.01f, hz * 0.022f), new Vector3(hx * 0.022f, 0.021f, hz * 0.022f), 0.01f, 0.01f, 5);
                k.M = Matrix4x4.identity;
                g.Tint(0xfff4e0, 0.5f).Sphere(c, 0.12f, 8, 6);
            }
            // The pearly king's flat cap, covered in pearls.
            k.Tint(0x2a2a3a).Sphere(new Vector3(0, 0.96f, -0.01f), new Vector3(0.17f, 0.08f, 0.18f), 14, 8, 0, 0.5f);
            k.Tint(0x2a2a3a).Cylinder(new Vector3(0, 0.96f, 0), new Vector3(0, 0.92f, 0), 0.165f, 0.165f, 14);
            k.Tint(0x2a2a3a).Sphere(new Vector3(0, 0.925f, 0.15f), new Vector3(0.14f, 0.015f, 0.09f), 12, 4);
            for (int ring = 0; ring < 2; ring++)
                for (int i = 0; i < 10 - ring * 4; i++)
                {
                    float a = i / (10f - ring * 4) * Mathf.PI * 2, r = 0.15f - ring * 0.07f;
                    k.Tint(PEARL).Sphere(new Vector3(Mathf.Cos(a) * r, 0.975f + ring * 0.035f, Mathf.Sin(a) * r - 0.01f), 0.017f, 6, 4);
                }
            // Its magic: a glowing pearl of light above, and the shine of every button.
            k.Tint(0xffffff).Sphere(new Vector3(0, 1.16f, 0), 0.1f, 12, 10);
            g.Tint(0xfff8e8, 0.9f).Sphere(new Vector3(0, 1.16f, 0), 0.13f, 12, 10);
            g.Tint(0xffeed0, 0.35f).Sphere(new Vector3(0, 1.16f, 0), 0.22f, 12, 8);
            Sparkles(g, new Vector3(0, 1.0f, 0), 0.5f, 8, 0xfff8e0, 31, 0.025f);
        }
    }
}
