using System.Collections.Generic;
using Telfer.Sim;
using UnityEngine;
using static Telfer.View.LK;

namespace Telfer.View
{
    /// <summary>
    /// London's menu, zoo, beasts, traffic and street hazards, built in the classic frame from the web
    /// game's own recipes (foodView.ts, animalView.ts, predatorView.ts, vehicleView.ts, hazardView.ts),
    /// number for number, then turned to face +z the way the HD models do.
    /// </summary>
    public static class ModelsLondonZoo
    {
        const uint BLACK = 0x1c1c1f, CORGI = 0xe08a3c, BONE = 0xf1ead6, WHITE_ = 0xffffff;
        const uint BUN_PASTRY = 0xe6ac5c, CREAM = 0xfffaf0, JAM = 0xd8283a;
        /// <summary>The classic foods are drawn a size up from the HD ones: this brings them into line.</summary>
        const float FOOD_SCALE = 0.72f, ANIMAL_SCALE = 0.85f;

        static readonly Dictionary<string, Mesh> cache = new Dictionary<string, Mesh>();

        // ------------------------------------------------------------------ three's centred primitives

        static G CBox(float w, float h, float d, uint c) => Box(w, h, d, c).Translate(0, -h / 2, 0);
        static G CCyl(float rt, float rb, float h, uint c, int seg = 16) => Cyl(rt, rb, h, c, 0, 0, 0, seg).Translate(0, -h / 2, 0);
        static G CCone(float r, float h, uint c, int seg = 16) => Cone(r, h, c, 0, 0, 0, seg).Translate(0, -h / 2, 0);
        /// <summary>three's CapsuleGeometry(radius, length): a cylinder `len` long with a round cap each end, along y.</summary>
        static G Capsule(float r, float len, uint c, int seg = 10)
        {
            var g = CCyl(r, r, len, c, seg);
            g.Append(Sphere(r, c, 0, 0, 0, seg, 5, Mathf.PI * 2, Mathf.PI / 2).Translate(0, len / 2, 0));
            g.Append(Sphere(r, c, 0, 0, 0, seg, 5, Mathf.PI * 2, Mathf.PI / 2).RotateX(Mathf.PI).Translate(0, -len / 2, 0));
            return g;
        }
        /// <summary>foodView/animalView's sphere: (r, 10 × 8), scaled then moved.</summary>
        static G Ball(float r, uint c, float x, float y, float z, float sx = 1, float sy = 1, float sz = 1, int w = 10, int h = 8) =>
            Sphere(r, c, 0, 0, 0, w, h).Scale(sx, sy, sz).Translate(x, y, z);
        static G Leg(float r, float h, uint c, float x, float z) => CCyl(r, r, h, c, 6).Translate(x, h / 2, z);
        static IEnumerable<G> Eyes(float r, float x, float y, float z, uint c = BLACK) { yield return Ball(r, c, -x, y, z); yield return Ball(r, c, x, y, z); }
        static IEnumerable<G> FourLegs(float r, float h, uint c, float x, float z)
        {
            yield return Leg(r, h, c, -x, -z); yield return Leg(r, h, c, x, -z); yield return Leg(r, h, c, -x, z); yield return Leg(r, h, c, x, z);
        }

        /// <summary>A slice of a round cake, `angle` wide, its point at the middle (foodView wedge).</summary>
        static G Wedge(float r, float h, float y, uint color, float angle = 1)
        {
            var g = new G();
            var col = MeshKit.Hex(color);
            const int seg = 10;
            float a0 = -angle / 2;
            Vector3 P(float a, float yy) => new Vector3(r * Mathf.Sin(a), yy, r * Mathf.Cos(a));
            for (int i = 0; i < seg; i++)
            {
                float u = a0 + angle * i / seg, v = a0 + angle * (i + 1) / seg;
                var n0 = new Vector3(Mathf.Sin(u), 0, Mathf.Cos(u));
                var n1 = new Vector3(Mathf.Sin(v), 0, Mathf.Cos(v));
                int a = g.Add(P(u, h / 2), n0, col), b = g.Add(P(u, -h / 2), n0, col), c = g.Add(P(v, -h / 2), n1, col), d = g.Add(P(v, h / 2), n1, col);
                g.Tri(a, b, d); g.Tri(b, c, d);
                int m0 = g.Add(new Vector3(0, h / 2, 0), Vector3.up, col), t0 = g.Add(P(u, h / 2), Vector3.up, col), t1 = g.Add(P(v, h / 2), Vector3.up, col);
                g.Tri(m0, t0, t1);
                int m1 = g.Add(new Vector3(0, -h / 2, 0), Vector3.down, col), b0 = g.Add(P(u, -h / 2), Vector3.down, col), b1 = g.Add(P(v, -h / 2), Vector3.down, col);
                g.Tri(m1, b1, b0);
            }
            foreach (var (ang, side) in new[] { (a0, -1f), (a0 + angle, 1f) })
            {
                var n = new Vector3(Mathf.Cos(ang), 0, -Mathf.Sin(ang)) * -side;
                int a = g.Add(new Vector3(0, h / 2, 0), n, col), b = g.Add(new Vector3(0, -h / 2, 0), n, col), c = g.Add(P(ang, -h / 2), n, col), d = g.Add(P(ang, h / 2), n, col);
                if (side < 0) { g.Tri(a, d, c); g.Tri(a, c, b); } else { g.Tri(a, b, c); g.Tri(a, c, d); }
            }
            return g.Translate(0, y, -r * 0.45f);
        }

        /// <summary>Merge, scale, and turn round so the classic +z (forward) ends up as the HD models' +z.</summary>
        static Mesh Make(string name, IEnumerable<G> parts, float scale = 1)
        {
            if (cache.TryGetValue(name, out var m) && m) return m;
            var g = Merge(parts).Scale(scale).RotateY(Mathf.PI);
            return cache[name] = ToMesh(g, name);
        }

        // ------------------------------------------------------------------ the menu

        public static Mesh Food(FoodKind k) => Make("food-" + k, FoodParts(k), FOOD_SCALE);

        static IEnumerable<G> FoodParts(FoodKind k)
        {
            var p = new List<G>();
            switch (k)
            {
                case FoodKind.FishChips:
                    p.Add(CBox(0.72f, 0.14f, 0.5f, 0xf3f0e6).Translate(0, 0.07f, 0));
                    foreach (var z in new[] { -0.16f, 0, 0.16f }) p.Add(CBox(0.74f, 0.02f, 0.05f, 0x9a958a).Translate(0, 0.13f, z));
                    foreach (var (x, z, a) in new[] { (-0.2f, 0.06f, 0.4f), (-0.08f, -0.1f, -0.3f), (0.05f, 0.1f, 0.2f), (0.18f, -0.04f, -0.5f), (-0.25f, -0.16f, 0.9f), (0.24f, 0.14f, 0.1f) })
                        p.Add(CBox(0.07f, 0.07f, 0.34f, 0xffd25a).RotateY(a).RotateX(0.25f).Translate(x, 0.22f, z));
                    p.Add(Capsule(0.12f, 0.38f, 0xd98a2b).RotateZ(Mathf.PI / 2).Scale(1, 0.8f, 1.15f).Translate(-0.04f, 0.32f, 0.02f));
                    p.Add(CCone(0.12f, 0.18f, 0xd98a2b, 4).RotateZ(-Mathf.PI / 2).Scale(1, 1, 0.35f).Translate(0.33f, 0.32f, 0.02f));
                    p.Add(Ball(0.06f, 0xf6e05a, -0.27f, 0.36f, 0.12f));
                    break;
                case FoodKind.Scone:
                    p.Add(CCyl(0.28f, 0.3f, 0.24f, 0xe0b06a, 14).Translate(0, 0.12f, 0));
                    p.Add(Sphere(0.28f, 0xc98f45, 0, 0, 0, 14, 6, Mathf.PI * 2, Mathf.PI / 2).Scale(1, 0.25f, 1).Translate(0, 0.24f, 0));
                    p.Add(CCyl(0.2f, 0.22f, 0.06f, JAM, 12).Translate(0, 0.32f, 0));
                    p.Add(Ball(0.15f, CREAM, 0, 0.4f, 0, 1, 0.6f, 1));
                    p.Add(CCone(0.08f, 0.12f, CREAM, 8).Translate(0, 0.52f, 0));
                    break;
                case FoodKind.Sponge:
                    p.Add(Wedge(0.5f, 0.16f, 0.08f, 0xf2cf6b));
                    p.Add(Wedge(0.5f, 0.06f, 0.19f, JAM));
                    p.Add(Wedge(0.5f, 0.05f, 0.245f, CREAM));
                    p.Add(Wedge(0.5f, 0.16f, 0.35f, 0xf2cf6b));
                    p.Add(Wedge(0.49f, 0.02f, 0.44f, 0xffffff));
                    p.Add(Ball(0.07f, 0xe0283a, 0, 0.5f, -0.32f));
                    break;
                case FoodKind.Sandwich:
                    p.Add(CCyl(0.42f, 0.42f, 0.11f, 0xfbf3dc, 3).Translate(0, 0.06f, 0));
                    p.Add(CCyl(0.44f, 0.44f, 0.05f, 0x7cc24a, 3).Translate(0, 0.14f, 0));
                    p.Add(CCyl(0.43f, 0.43f, 0.03f, 0xf5f0e0, 3).Translate(0, 0.18f, 0));
                    p.Add(CCyl(0.42f, 0.42f, 0.11f, 0xfbf3dc, 3).Translate(0, 0.25f, 0));
                    break;
                case FoodKind.Pie:
                    p.Add(CCyl(0.34f, 0.3f, 0.22f, BUN_PASTRY, 16).Translate(0, 0.11f, 0));
                    p.Add(Sphere(0.33f, 0xd99a45, 0, 0, 0, 16, 6, Mathf.PI * 2, Mathf.PI / 2).Scale(1, 0.35f, 1).Translate(0, 0.22f, 0));
                    p.Add(Torus(0.33f, 0.045f, 6, 18, 0xf0bf6e).RotateX(Mathf.PI / 2).Translate(0, 0.22f, 0));
                    p.Add(CCyl(0.04f, 0.04f, 0.04f, 0x6b3a1e, 8).Translate(0, 0.34f, 0));
                    foreach (var a in new[] { 0.5f, 2.6f, 4.7f }) p.Add(CBox(0.14f, 0.02f, 0.04f, 0xf0bf6e).RotateY(a).Translate(Mathf.Cos(a) * 0.16f, 0.32f, Mathf.Sin(a) * 0.16f));
                    break;
                case FoodKind.SausageRoll:
                    p.Add(CCyl(0.17f, 0.17f, 0.62f, BUN_PASTRY, 12).RotateZ(Mathf.PI / 2).Scale(1, 0.85f, 1).Translate(0, 0.17f, 0));
                    foreach (var s in new[] { -1f, 1f }) p.Add(CCyl(0.1f, 0.1f, 0.03f, 0xc76a58, 10).RotateZ(Mathf.PI / 2).Translate(s * 0.31f, 0.17f, 0));
                    foreach (var x in new[] { -0.16f, 0, 0.16f }) p.Add(CBox(0.03f, 0.02f, 0.2f, 0xb87a32).RotateY(0.5f).Translate(x, 0.32f, 0));
                    break;
                case FoodKind.Crumpet:
                    p.Add(CCyl(0.32f, 0.32f, 0.22f, 0xc98a42, 16).Translate(0, 0.11f, 0));
                    p.Add(CCyl(0.31f, 0.31f, 0.02f, 0xf3d27e, 16).Translate(0, 0.23f, 0));
                    foreach (var (x, z) in new[] { (0.12f, 0.05f), (-0.1f, 0.13f), (0.02f, -0.15f), (-0.18f, -0.06f), (0.2f, -0.1f), (0.06f, 0.2f), (-0.05f, 0.02f), (0.18f, 0.12f), (-0.2f, 0.1f), (-0.08f, -0.2f), (0.1f, -0.2f), (0.24f, 0.02f) })
                        p.Add(CCyl(0.032f, 0.032f, 0.02f, 0x7a4a1e, 6).Translate(x, 0.245f, z));
                    p.Add(CBox(0.16f, 0.06f, 0.12f, 0xfff08a).RotateY(0.4f).Translate(-0.02f, 0.27f, 0.02f));
                    break;
                case FoodKind.Strawberry:
                {
                    var s = new List<G>
                    {
                        CCone(0.25f, 0.46f, 0xe8243c, 14).RotateX(Mathf.PI).Translate(0, 0.28f, 0),
                        Ball(0.25f, 0xe8243c, 0, 0.5f, 0, 1, 0.45f, 1),
                    };
                    foreach (var (x, y, z) in new[] { (0.13f, 0.4f, 0.13f), (-0.14f, 0.38f, 0.11f), (0.12f, 0.3f, -0.13f), (-0.1f, 0.32f, -0.15f), (0, 0.22f, 0.12f), (0.17f, 0.44f, -0.04f), (-0.05f, 0.2f, -0.1f), (0.07f, 0.16f, 0.06f), (-0.18f, 0.44f, 0), (0, 0.42f, 0.19f) })
                        s.Add(Ball(0.024f, 0xffe066, x, y, z));
                    for (int i = 0; i < 6; i++) s.Add(CCone(0.07f, 0.24f, 0x2f9b3a, 4).Scale(1, 1, 0.35f).RotateZ(-1.35f).Translate(0.1f, 0, 0).RotateY(i * Mathf.PI * 2 / 6).Translate(0, 0.6f, 0));
                    s.Add(CCyl(0.025f, 0.03f, 0.14f, 0x2f9b3a, 5).Translate(0, 0.68f, 0));
                    foreach (var g in s) p.Add(g.RotateX(1.2f).Translate(0, 0.32f, -0.15f)); // lying on its side
                    break;
                }
                case FoodKind.JellyBaby:
                    // White, tinted per piece by the view (red, orange, yellow, green, purple, pink).
                    p.Add(Capsule(0.11f, 0.14f, WHITE_).Scale(1, 1, 0.8f).Translate(0, 0.2f, 0));
                    p.Add(Ball(0.1f, WHITE_, 0, 0.44f, 0));
                    foreach (var s in new[] { -1f, 1f }) p.Add(Ball(0.05f, WHITE_, s * 0.12f, 0.27f, 0, 0.8f, 1.3f, 0.8f));
                    foreach (var s in new[] { -1f, 1f }) p.Add(Ball(0.055f, WHITE_, s * 0.06f, 0.06f, 0, 1, 1.2f, 1));
                    foreach (var s in new[] { -1f, 1f }) p.Add(Ball(0.018f, 0x2a1a1a, s * 0.035f, 0.46f, 0.09f));
                    break;
                case FoodKind.Bagel:
                    p.Add(Torus(0.22f, 0.12f, 10, 18, 0xc98a45).RotateX(Mathf.PI / 2).Scale(1, 0.75f, 1).Translate(0, 0.12f, 0));
                    for (int i = 0; i < 8; i++)
                    {
                        float a = i * Mathf.PI * 2 / 8 + 0.3f;
                        p.Add(Ball(0.02f, 0xfff3d6, Mathf.Cos(a) * 0.22f, 0.21f, Mathf.Sin(a) * 0.22f, 1.5f, 0.6f, 1));
                    }
                    break;
                case FoodKind.Biscuit:
                    p.Add(CCyl(0.34f, 0.34f, 0.08f, 0xe3b268, 18).RotateX(Mathf.PI / 2).Translate(0, 0.38f, 0));
                    p.Add(CCyl(0.12f, 0.12f, 0.1f, JAM, 12).RotateX(Mathf.PI / 2).Translate(0, 0.38f, 0));
                    for (int i = 0; i < 6; i++)
                    {
                        float a = i * Mathf.PI * 2 / 6;
                        p.Add(Ball(0.022f, 0xb07a38, Mathf.Cos(a) * 0.24f, 0.38f + Mathf.Sin(a) * 0.24f, 0.045f));
                    }
                    break;
                case FoodKind.Tea:
                    p.Add(CCyl(0.34f, 0.26f, 0.04f, WHITE_, 16).Translate(0, 0.02f, 0));
                    p.Add(CCyl(0.22f, 0.15f, 0.28f, WHITE_, 14).Translate(0, 0.18f, 0));
                    p.Add(CCyl(0.225f, 0.21f, 0.05f, 0x3a7bd5, 14).Translate(0, 0.27f, 0));
                    p.Add(CCyl(0.2f, 0.2f, 0.02f, 0x9a5a2a, 14).Translate(0, 0.31f, 0));
                    p.Add(Torus(0.08f, 0.025f, 6, 12, WHITE_).Translate(0.24f, 0.2f, 0));
                    break;
            }
            return p;
        }

        /// <summary>The jewel on golden food in London: a little gold crown with a ruby, sapphires and an emerald.</summary>
        public static Mesh Crown()
        {
            var p = new List<G> { CCyl(0.17f, 0.15f, 0.1f, 0xffd23f, 10).Translate(0, 0.05f, 0) };
            for (int i = 0; i < 5; i++)
            {
                float a = i * Mathf.PI * 2 / 5;
                p.Add(CCone(0.045f, 0.12f, 0xffd23f, 4).Translate(Mathf.Cos(a) * 0.15f, 0.15f, Mathf.Sin(a) * 0.15f));
                p.Add(Ball(0.026f, 0xffffff, Mathf.Cos(a) * 0.15f, 0.22f, Mathf.Sin(a) * 0.15f));
            }
            p.Add(Ball(0.045f, 0xe0115f, 0, 0.06f, 0.16f, 1, 1, 0.6f));
            p.Add(Ball(0.04f, 0x1f6feb, 0.16f, 0.06f, 0, 0.6f, 1, 1));
            p.Add(Ball(0.04f, 0x1f6feb, -0.16f, 0.06f, 0, 0.6f, 1, 1));
            p.Add(Ball(0.04f, 0x2fbf71, 0, 0.06f, -0.16f, 1, 1, 0.6f));
            return Make("crown", p, FOOD_SCALE);
        }

        /// <summary>Jelly babies come in every colour.</summary>
        public static readonly uint[] JELLY = { 0xff3b4e, 0xff9f1c, 0xffe14d, 0x4cd964, 0xb06cff, 0xff6fb5 };

        public static Color FoodColor(FoodKind k)
        {
            switch (k)
            {
                case FoodKind.FishChips: return MeshKit.Hex(0xffd25a);
                case FoodKind.Scone: return MeshKit.Hex(0xe0b06a);
                case FoodKind.Sponge: return MeshKit.Hex(0xf2cf6b);
                case FoodKind.Sandwich: return MeshKit.Hex(0x7cc24a);
                case FoodKind.Pie: return MeshKit.Hex(0xd99a45);
                case FoodKind.SausageRoll: return MeshKit.Hex(0xe6ac5c);
                case FoodKind.Crumpet: return MeshKit.Hex(0xc98a42);
                case FoodKind.Strawberry: return MeshKit.Hex(0xe8243c);
                case FoodKind.JellyBaby: return MeshKit.Hex(0xff6fb5);
                case FoodKind.Bagel: return MeshKit.Hex(0xc98a45);
                case FoodKind.Biscuit: return MeshKit.Hex(0xe3b268);
                default: return MeshKit.Hex(0x9a5a2a); // tea
            }
        }

        // ------------------------------------------------------------------ the zoo

        public static Mesh Animal(AnimalKind k) => Make("animal-" + k, AnimalParts(k), ANIMAL_SCALE);

        public static Color AnimalColor(AnimalKind k)
        {
            switch (k)
            {
                case AnimalKind.Corgi: return MeshKit.Hex(CORGI);
                case AnimalKind.Horse: return MeshKit.Hex(0x1d1d22);
                case AnimalKind.Dino: return MeshKit.Hex(BONE);
                case AnimalKind.Pelican: return MeshKit.Hex(0xff8c3a);
                default: return Color.white;
            }
        }

        static IEnumerable<G> AnimalParts(AnimalKind k)
        {
            var p = new List<G>();
            switch (k)
            {
                case AnimalKind.Corgi: // a royal corgi: ginger and white, long and low, huge ears
                    p.Add(Capsule(0.17f, 0.38f, CORGI).RotateX(Mathf.PI / 2).Translate(0, 0.26f, 0));
                    p.Add(Ball(0.15f, WHITE_, 0, 0.21f, 0.12f, 0.9f, 0.8f, 1.4f));
                    p.Add(Ball(0.16f, CORGI, 0, 0.42f, 0.32f));
                    p.Add(Ball(0.1f, WHITE_, 0, 0.37f, 0.42f, 1, 0.8f, 1.1f));
                    p.Add(Ball(0.035f, BLACK, 0, 0.4f, 0.52f));
                    foreach (var s in new[] { -1f, 1f })
                    {
                        p.Add(CCone(0.075f, 0.2f, CORGI, 4).RotateZ(s * -0.25f).Translate(s * 0.1f, 0.6f, 0.28f));
                        p.Add(CCone(0.045f, 0.12f, 0xffc9a8, 4).RotateZ(s * -0.25f).Translate(s * 0.1f, 0.58f, 0.3f));
                    }
                    p.AddRange(Eyes(0.026f, 0.07f, 0.47f, 0.44f));
                    p.Add(Ball(0.06f, WHITE_, 0, 0.3f, -0.33f));
                    p.Add(Leg(0.045f, 0.12f, CORGI, -0.1f, -0.17f)); p.Add(Leg(0.045f, 0.12f, CORGI, 0.1f, -0.17f));
                    p.Add(Leg(0.045f, 0.12f, WHITE_, -0.1f, 0.17f)); p.Add(Leg(0.045f, 0.12f, WHITE_, 0.1f, 0.17f));
                    break;
                case AnimalKind.Swan: // the King's swan: an S-curved neck, an orange beak with its black knob
                    p.Add(Ball(0.3f, WHITE_, 0, 0.32f, -0.05f, 1, 0.75f, 1.45f));
                    foreach (var s in new[] { -1f, 1f }) p.Add(Ball(0.2f, 0xf1f1ef, s * 0.2f, 0.42f, -0.12f, 0.45f, 0.6f, 1.3f));
                    p.Add(CCone(0.14f, 0.26f, WHITE_, 6).RotateX(-1.1f).Translate(0, 0.46f, -0.5f));
                    foreach (var (y, z, r) in new[] { (0.48f, 0.3f, 0.1f), (0.62f, 0.36f, 0.09f), (0.76f, 0.36f, 0.08f), (0.88f, 0.32f, 0.075f) }) p.Add(Ball(r, WHITE_, 0, y, z));
                    p.Add(Ball(0.11f, WHITE_, 0, 0.95f, 0.36f, 1, 0.9f, 1.2f));
                    p.Add(CCone(0.05f, 0.2f, 0xff7a1a, 6).RotateX(Mathf.PI / 2 + 0.35f).Translate(0, 0.9f, 0.52f));
                    p.Add(Ball(0.04f, BLACK, 0, 0.96f, 0.45f));
                    p.AddRange(Eyes(0.024f, 0.07f, 0.98f, 0.42f));
                    foreach (var s in new[] { -1f, 1f }) p.Add(CBox(0.1f, 0.02f, 0.14f, 0x2b2b2e).Translate(s * 0.1f, 0.01f, 0.02f));
                    break;
                case AnimalKind.Gull: // a herring gull, always on the wing
                    p.Add(Ball(0.17f, WHITE_, 0, 0.95f, -0.02f, 1, 0.95f, 1.6f));
                    p.Add(Ball(0.12f, WHITE_, 0, 1.04f, 0.26f));
                    p.Add(CCone(0.04f, 0.18f, 0xffcf33, 5).RotateX(Mathf.PI / 2).Translate(0, 1.02f, 0.42f));
                    p.Add(Ball(0.022f, 0xe0393e, 0, 0.995f, 0.4f));
                    foreach (var s in new[] { -1f, 1f })
                    {
                        p.Add(CBox(0.46f, 0.035f, 0.24f, 0xaeb6c2).RotateZ(s * 0.18f).Translate(s * 0.34f, 1.0f, -0.02f));
                        p.Add(CBox(0.16f, 0.035f, 0.18f, 0x1c1c1f).RotateZ(s * 0.3f).Translate(s * 0.64f, 1.07f, -0.04f));
                    }
                    p.Add(CCone(0.1f, 0.22f, WHITE_, 4).RotateX(-Mathf.PI / 2).Scale(1, 0.35f, 1).Translate(0, 0.95f, -0.36f));
                    p.AddRange(Eyes(0.022f, 0.06f, 1.08f, 0.33f));
                    break;
                case AnimalKind.Pelican: // a big white body, short legs, and that enormous beak with its pouch
                    p.Add(Ball(0.3f, 0xf4f1ea, 0, 0.5f, -0.05f, 1, 0.9f, 1.35f));
                    foreach (var s in new[] { -1f, 1f }) p.Add(Ball(0.2f, 0xd9d4c8, s * 0.22f, 0.55f, -0.12f, 0.4f, 0.7f, 1.3f));
                    p.Add(CCyl(0.08f, 0.11f, 0.36f, 0xf4f1ea, 8).RotateX(0.35f).Translate(0, 0.82f, 0.24f));
                    p.Add(Ball(0.13f, 0xf4f1ea, 0, 1.02f, 0.32f));
                    p.Add(CBox(0.1f, 0.06f, 0.52f, 0xf2a33a).RotateX(0.35f).Translate(0, 0.96f, 0.62f));
                    p.Add(Ball(0.12f, 0xff8c3a, 0, 0.86f, 0.6f, 0.7f, 0.75f, 2.0f));
                    p.AddRange(Eyes(0.025f, 0.08f, 1.06f, 0.4f));
                    p.Add(Leg(0.03f, 0.22f, 0xf2a33a, -0.1f, 0)); p.Add(Leg(0.03f, 0.22f, 0xf2a33a, 0.1f, 0));
                    foreach (var s in new[] { -1f, 1f }) p.Add(CBox(0.12f, 0.02f, 0.14f, 0xf2a33a).Translate(s * 0.1f, 0.01f, 0.06f));
                    break;
                case AnimalKind.Horse: // a guard horse: glossy black, red saddle cloth with gold trim, a white blaze
                    p.Add(Capsule(0.32f, 0.72f, 0x1d1d22, 12).RotateX(Mathf.PI / 2).Translate(0, 1.05f, 0));
                    p.Add(CBox(0.68f, 0.36f, 0.62f, 0xc8102e).Translate(0, 1.12f, -0.04f));
                    p.Add(CBox(0.7f, 0.05f, 0.64f, 0xf2c230).Translate(0, 0.94f, -0.04f));
                    p.Add(CBox(0.34f, 0.08f, 0.42f, 0x3a2a1c).Translate(0, 1.38f, -0.02f));
                    p.Add(CCyl(0.13f, 0.18f, 0.62f, 0x1d1d22, 8).RotateX(0.55f).Translate(0, 1.45f, 0.5f));
                    p.Add(Capsule(0.13f, 0.32f, 0x1d1d22, 8).RotateX(1.25f).Translate(0, 1.7f, 0.78f));
                    p.Add(CBox(0.06f, 0.03f, 0.3f, WHITE_).RotateX(1.25f - Mathf.PI / 2).Translate(0, 1.72f, 0.88f));
                    foreach (var s in new[] { -1f, 1f }) p.Add(CCone(0.05f, 0.14f, 0x1d1d22, 4).Translate(s * 0.08f, 1.9f, 0.68f));
                    p.Add(CBox(0.05f, 0.42f, 0.12f, 0x111114).RotateX(0.5f).Translate(0, 1.6f, 0.4f));
                    p.AddRange(Eyes(0.03f, 0.12f, 1.78f, 0.82f));
                    p.Add(CCone(0.1f, 0.62f, 0x111114, 6).RotateX(-0.35f).Translate(0, 0.86f, -0.66f));
                    p.AddRange(FourLegs(0.065f, 0.78f, 0x1d1d22, 0.2f, 0.42f));
                    foreach (var (x, z) in new[] { (-0.2f, -0.42f), (0.2f, -0.42f), (-0.2f, 0.42f), (0.2f, 0.42f) }) p.Add(Leg(0.075f, 0.1f, WHITE_, x, z));
                    break;
                case AnimalKind.Dino: // the museum's skeleton out for a walk: chunky cartoon bones, a big grinning skull
                    foreach (var (y, z, r) in new[] { (1.35f, 0.55f, 0.13f), (1.4f, 0.3f, 0.15f), (1.42f, 0.05f, 0.16f), (1.4f, -0.2f, 0.15f), (1.35f, -0.45f, 0.14f), (1.25f, -0.7f, 0.12f), (1.1f, -0.95f, 0.1f), (0.95f, -1.18f, 0.085f), (0.8f, -1.38f, 0.07f) })
                        p.Add(Ball(r, BONE, 0, y, z));
                    foreach (var z in new[] { 0.35f, 0.12f, -0.11f, -0.34f }) p.Add(Torus(0.3f, 0.045f, 5, 12, BONE, Mathf.PI * 1.15f).RotateZ(-0.075f * Mathf.PI).Translate(0, 1.1f, z));
                    p.Add(Torus(0.22f, 0.06f, 5, 10, BONE).RotateX(Mathf.PI / 2).Scale(1, 1, 1.3f).Translate(0, 0.95f, -0.25f));
                    p.Add(CCyl(0.08f, 0.1f, 0.42f, BONE, 6).RotateX(0.7f).Translate(0, 1.55f, 0.72f));
                    p.Add(CBox(0.42f, 0.36f, 0.62f, BONE).Translate(0, 1.82f, 1.0f));
                    p.Add(CBox(0.36f, 0.1f, 0.5f, BONE).RotateX(0.25f).Translate(0, 1.55f, 1.04f));
                    foreach (var s in new[] { -1f, 1f }) p.Add(Ball(0.08f, 0x3a3226, s * 0.17f, 1.9f, 0.96f, 0.4f, 1, 1));
                    foreach (var z in new[] { 0.86f, 0.98f, 1.1f, 1.22f })
                        foreach (var s in new[] { -1f, 1f }) p.Add(CCone(0.03f, 0.08f, WHITE_, 4).RotateX(Mathf.PI).Translate(s * 0.15f, 1.6f, z));
                    foreach (var s in new[] { -1f, 1f })
                    {
                        p.Add(CCyl(0.035f, 0.035f, 0.3f, BONE, 5).RotateX(1.1f).Translate(s * 0.2f, 1.15f, 0.6f));
                        p.Add(CCyl(0.09f, 0.07f, 0.6f, BONE, 6).RotateX(0.3f).Translate(s * 0.26f, 0.72f, -0.2f));
                        p.Add(Ball(0.1f, BONE, s * 0.26f, 0.45f, -0.12f));
                        p.Add(CCyl(0.06f, 0.06f, 0.42f, BONE, 6).RotateX(-0.3f).Translate(s * 0.26f, 0.24f, -0.18f));
                        p.Add(CBox(0.16f, 0.06f, 0.3f, BONE).Translate(s * 0.26f, 0.03f, -0.06f));
                    }
                    break;
            }
            return p;
        }

        // ------------------------------------------------------------------ the beasts (inked, like the landmarks)

        const uint BRONZE = 0x9a7444, BRONZE_DARK = 0x553820, FACE = 0xb88f58, MUZZLE = 0xd1aa70, EYE = 0x343844, RAVEN_BLACK = 0x22232c, BEAK = 0x4c4d58;

        /// <summary>A bronze lion up on all fours (predatorView.ts lion): the statue's mane, face and colours, walking.</summary>
        public static Mesh Lion()
        {
            G Blob(float r, float sx, float sy, float sz, uint c, float x, float y, float z) => Sphere(r, c, 0, 0, 0, 10, 8).Scale(sx, sy, sz).Translate(x, y, z);
            var p = new List<G>
            {
                Blob(0.55f, 0.8f, 0.7f, 1.45f, BRONZE, 0, 0.95f, -0.15f),
                Blob(0.45f, 1, 1, 1.05f, BRONZE, 0, 0.98f, -0.75f),
            };
            foreach (var (x, z) in new[] { (0.28f, 0.45f), (-0.28f, 0.45f), (0.28f, -0.8f), (-0.28f, -0.8f) })
            {
                p.Add(Cyl(0.13f, 0.16f, 0.85f, BRONZE, x, 0.05f, z, 8));
                p.Add(Blob(0.17f, 1.1f, 0.6f, 1.3f, FACE, x, 0.07f, z + 0.08f));
            }
            p.Add(Blob(0.58f, 1.15f, 1.1f, 0.8f, BRONZE_DARK, 0, 1.38f, 0.5f));
            p.Add(Blob(0.34f, 1, 1, 0.95f, FACE, 0, 1.36f, 0.82f));
            p.Add(Blob(0.2f, 1.2f, 0.8f, 1, MUZZLE, 0, 1.2f, 1.1f));
            p.Add(Sphere(0.075f, BRONZE_DARK, 0, 1.29f, 1.28f, 6, 4));
            p.Add(Sphere(0.06f, EYE, 0.13f, 1.46f, 1.06f, 6, 4));
            p.Add(Sphere(0.06f, EYE, -0.13f, 1.46f, 1.06f, 6, 4));
            p.Add(Sphere(0.1f, FACE, 0.24f, 1.66f, 0.82f, 6, 4));
            p.Add(Sphere(0.1f, FACE, -0.24f, 1.66f, 0.82f, 6, 4));
            p.Add(Box(0.09f, 0.09f, 0.9f, BRONZE).RotateX(-0.7f).Translate(0, 1.0f, -1.25f));
            p.Add(Sphere(0.14f, BRONZE_DARK, 0, 1.58f, -1.82f, 6, 4));
            for (int i = 0; i < 10; i++)
            {
                float a = i / 10f * Mathf.PI * 2;
                p.Add(Sphere(0.19f, BRONZE_DARK, Mathf.Cos(a) * 0.6f, 1.38f + Mathf.Sin(a) * 0.56f, 0.6f, 6, 4));
            }
            return Make("live-lion", p, 1.25f);
        }

        /// <summary>A Tower raven's body (the wings flap on their own).</summary>
        public static Mesh RavenBody() => Make("raven-body", new[]
        {
            Sphere(0.28f, RAVEN_BLACK, 0, 0, 0, 10, 8).Scale(0.8f, 0.85f, 1.4f).Translate(0, 0.38f, 0),
            Sphere(0.18f, RAVEN_BLACK, 0, 0.66f, 0.32f, 8, 6),
            Cone(0.07f, 0.3f, BEAK, 0, 0, 0, 6).RotateX(Mathf.PI / 2).Translate(0, 0.62f, 0.45f),
            Sphere(0.045f, WHITE_, 0.12f, 0.7f, 0.4f, 6, 4),
            Sphere(0.045f, WHITE_, -0.12f, 0.7f, 0.4f, 6, 4),
            Box(0.22f, 0.05f, 0.4f, RAVEN_BLACK, 0, 0.32f, -0.5f).RotateX(-0.3f),
        }, 1.6f);

        /// <summary>One raven wing reaching out from the shoulder to +x (side 1) or −x (side −1), in HD space.</summary>
        public static Mesh RavenWing(int side) => Make("raven-wing" + side, new[]
        {
            // Built for the HD frame directly: Make turns x round, so the classic side is mirrored here.
            Box(0.75f, 0.05f, 0.42f, RAVEN_BLACK, -side * 0.37f, -0.025f, 0),
            Box(0.3f, 0.04f, 0.3f, 0x30313b, -side * 0.82f, -0.02f, -0.06f),
        });

        // ------------------------------------------------------------------ the traffic

        const uint RED_DARK = 0xa8231a, BUS_CREAM = 0xf3e7c4, GLASS = 0x3c5a78, TYRE = 0x26262b, HUB = 0xc9ccd0, CAB_BLACK = 0x1d1f24, YELLOW = 0xffd23f, LAMP = 0xfff6c8;

        static IEnumerable<G> Wheel(float r, float x, float z)
        {
            float side = Mathf.Sign(x);
            yield return Cyl(r, r, 0.3f, TYRE, 0, -0.15f, 0, 12).RotateZ(Mathf.PI / 2).Translate(x, r, z);
            yield return Cyl(r * 0.45f, r * 0.45f, 0.05f, HUB, 0, -0.025f, 0, 10).RotateZ(Mathf.PI / 2).Translate(x + side * 0.16f, r, z);
        }

        /// <summary>A red London double-decker, facing +z: two decks of windows, a cream band, a destination board.</summary>
        public static Mesh Bus()
        {
            var p = new List<G>
            {
                Box(2.2f, 1.55f, 6, BUS_RED, 0, 0.35f, 0),
                Box(2.26f, 0.14f, 6.06f, BUS_CREAM, 0, 1.9f, 0),
                Box(2.2f, 1.45f, 5.9f, BUS_RED, 0, 2.04f, -0.05f),
                Box(2.06f, 0.16f, 5.7f, RED_DARK, 0, 3.49f, -0.05f),
                Box(1.9f, 0.8f, 0.05f, GLASS, 0, 0.95f, 3.0f),
                Box(1.9f, 0.75f, 0.05f, GLASS, 0, 2.38f, 2.92f),
                Box(1.5f, 0.32f, 0.06f, 0x111114, 0, 1.92f, 3.02f),
                Box(1.2f, 0.16f, 0.07f, YELLOW, 0, 2.0f, 3.03f),
                Sphere(0.14f, LAMP, 0.78f, 0.62f, 3.0f, 8, 6),
                Sphere(0.14f, LAMP, -0.78f, 0.62f, 3.0f, 8, 6),
                Box(1.6f, 0.2f, 0.1f, 0x2a2a2e, 0, 0.32f, 3.0f),
            };
            foreach (var sx in new[] { 1f, -1f })
            {
                foreach (var z in new[] { -2.0f, -0.8f, 0.4f, 1.6f }) p.Add(Box(0.06f, 0.72f, 0.95f, GLASS, sx * 1.1f, 0.98f, z));
                foreach (var z in new[] { -2.3f, -1.2f, -0.1f, 1.0f, 2.1f }) p.Add(Box(0.06f, 0.72f, 0.9f, GLASS, sx * 1.1f, 2.38f, z));
                p.AddRange(Wheel(0.48f, sx * 1.0f, 1.9f));
                p.AddRange(Wheel(0.48f, sx * 1.0f, -1.9f));
            }
            return Make("bus", p);
        }

        /// <summary>A black cab, facing +z: the tall cabin, chrome grille, round lamps and the yellow TAXI light.</summary>
        public static Mesh Cab()
        {
            var p = new List<G>
            {
                Box(1.8f, 0.78f, 3.8f, CAB_BLACK, 0, 0.3f, 0),
                Box(1.6f, 0.7f, 2.1f, CAB_BLACK, 0, 1.05f, -0.3f),
                Box(1.45f, 0.45f, 0.05f, GLASS, 0, 1.15f, 0.76f),
                Box(1.3f, 0.4f, 0.05f, GLASS, 0, 1.15f, -1.36f),
                Box(0.55f, 0.2f, 0.28f, YELLOW, 0, 1.75f, 0.35f),
                Box(0.9f, 0.3f, 0.05f, HUB, 0, 0.45f, 1.91f),
                Sphere(0.13f, LAMP, 0.62f, 0.72f, 1.85f, 8, 6),
                Sphere(0.13f, LAMP, -0.62f, 0.72f, 1.85f, 8, 6),
                Box(1.84f, 0.12f, 0.12f, HUB, 0, 0.26f, 1.88f),
            };
            foreach (var sx in new[] { 1f, -1f })
            {
                foreach (var z in new[] { 0.2f, -0.8f }) p.Add(Box(0.05f, 0.42f, 0.8f, GLASS, sx * 0.81f, 1.15f, z));
                p.AddRange(Wheel(0.36f, sx * 0.82f, 1.2f));
                p.AddRange(Wheel(0.36f, sx * 0.82f, -1.25f));
            }
            return Make("cab", p);
        }

        // ------------------------------------------------------------------ the street hazards

        static IEnumerable<G> TrafficCone(float x, float z)
        {
            yield return CBox(0.42f, 0.06f, 0.42f, 0xe8590c).Translate(x, 0.03f, z);
            yield return CCone(0.17f, 0.62f, 0xff7a1a, 10).Translate(x, 0.37f, z);
            yield return CCyl(0.085f, 0.115f, 0.12f, WHITE_, 10).Translate(x, 0.42f, z);
        }

        /// <summary>A puddle (flat, to slide across), a dropped umbrella, or roadworks: two cones and a striped barrier.</summary>
        public static Mesh Hazard(HazardKind k)
        {
            var p = new List<G>();
            switch (k)
            {
                case HazardKind.Puddle:
                    p.Add(CCyl(1.2f, 1.2f, 0.01f, 0x6fb8e6, 24).Scale(1, 1, 0.75f).Translate(0, 0.025f, 0));
                    p.Add(CCyl(0.75f, 0.75f, 0.01f, 0x9fd3f2, 18).Scale(1, 1, 0.6f).Translate(0.25f, 0.035f, -0.12f));
                    p.Add(CCyl(0.22f, 0.22f, 0.01f, 0xe6f6ff, 10).Scale(1.4f, 1, 0.5f).Translate(-0.4f, 0.045f, 0.2f));
                    return Make("hz-puddle", p);
                case HazardKind.Umbrella:
                    p.Add(CCone(0.62f, 0.42f, 0x1f3264, 8).RotateZ(Mathf.PI / 2 + 0.25f).Translate(0.05f, 0.42f, 0));
                    p.Add(CCone(0.63f, 0.43f, 0xd8342c, 8).RotateY(Mathf.PI / 8).RotateZ(Mathf.PI / 2 + 0.25f).Translate(0.05f, 0.41f, 0));
                    p.Add(CCyl(0.03f, 0.03f, 1.0f, 0x3a2a1e, 5).RotateZ(Mathf.PI / 2 + 0.25f).Translate(-0.45f, 0.32f, 0));
                    p.Add(Torus(0.1f, 0.03f, 5, 10, 0x3a2a1e, Mathf.PI).RotateX(Mathf.PI / 2).Translate(-0.95f, 0.12f, 0.1f));
                    return Make("hz-umbrella", p, 1.3f);
                default:
                    p.AddRange(TrafficCone(-0.62f, 0.15f));
                    p.AddRange(TrafficCone(0.62f, -0.1f));
                    p.Add(CBox(0.06f, 0.6f, 0.06f, 0x4a4a4f).Translate(-0.3f, 0.3f, 0.05f));
                    p.Add(CBox(0.06f, 0.6f, 0.06f, 0x4a4a4f).Translate(0.3f, 0.3f, 0.05f));
                    float[] xs = { -0.36f, -0.12f, 0.12f, 0.36f };
                    for (int i = 0; i < 4; i++) p.Add(CBox(0.24f, 0.16f, 0.05f, i % 2 == 1 ? WHITE_ : 0xd8342cu).Translate(xs[i], 0.55f, 0.05f));
                    return Make("hz-roadworks", p, 1.45f);
            }
        }
    }
}
