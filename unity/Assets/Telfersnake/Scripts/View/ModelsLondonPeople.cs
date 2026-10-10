using System.Collections.Generic;
using Telfer.Sim;
using UnityEngine;
using static Telfer.View.LK;

namespace Telfer.View
{
    /// <summary>
    /// London's people, legends and set-piece props, from the classic recipes number for number: the
    /// tourists, the school trip and the buskers (kidView.ts), the guard, the tour guide, the Beefeater, the
    /// living statue and the royal wave (people.ts), the nine legends (creatureView.ts), the Crown Jewels and
    /// pearl buttons (legends.ts), and the marchers, the tall ship, the river bus, the Red Arrows and the
    /// Tube's roundels (setPieceView.ts).
    /// </summary>
    public static partial class ModelsLondonZoo
    {
        /// <summary>Like Make, but keeps the classic frame's +x forward (the set pieces face +x).</summary>
        static Mesh MakeX(string name, IEnumerable<G> parts, float scale = 1)
        {
            if (cache.TryGetValue(name, out var m) && m) return m;
            return cache[name] = ToMesh(Merge(parts).Scale(scale), name);
        }

        // ================================================================== the people who walk about (kidView.ts)

        const uint K_SKIN = 0xf0c8a0, K_HAIR = 0x5a3d25, JUMPER = 0x25305e, K_GREY = 0x565b68, HIVIS = 0xd7f22c, STRIPE = 0xe6e9ee, ADULT_SKIN = 0xe9bf98;

        static G Limb(float r, float h, uint c, float x, float y, float z, float tilt = 0) => Capsule(r, h, c, 6).RotateX(tilt).Translate(x, y, z);
        static IEnumerable<G> KEyes(float x, float y, float z) { yield return Ball(0.028f, 0x2a2a2a, -x, y, z, 1, 1, 1, 9, 7); yield return Ball(0.028f, 0x2a2a2a, x, y, z, 1, 1, 1, 9, 7); }

        /// <summary>A little child, ~0.9 m tall, facing +z.</summary>
        static IEnumerable<G> Child(uint top, uint hair, uint legs)
        {
            yield return Limb(0.15f, 0.28f, top, 0, 0.42f, 0, Mathf.PI / 2);
            yield return Ball(0.17f, K_SKIN, 0, 0.74f, 0.02f, 1, 1, 1, 9, 7);
            yield return Ball(0.19f, hair, 0, 0.82f, -0.02f, 1, 0.7f, 1, 9, 7);
            foreach (var e in KEyes(0.06f, 0.74f, 0.15f)) yield return e;
            yield return Limb(0.05f, 0.18f, top, -0.2f, 0.42f, 0.02f, 0.3f);
            yield return Limb(0.05f, 0.18f, top, 0.2f, 0.42f, 0.02f, -0.3f);
            yield return Limb(0.06f, 0.2f, legs, -0.09f, 0.12f, 0);
            yield return Limb(0.06f, 0.2f, legs, 0.09f, 0.12f, 0);
        }

        /// <summary>A grown-up on the same little-person kit.</summary>
        static IEnumerable<G> GrownUp(uint top, uint hair, uint legs)
        {
            yield return Limb(0.15f, 0.36f, top, 0, 0.62f, 0);
            yield return Ball(0.15f, ADULT_SKIN, 0, 1.0f, 0.02f, 1, 1, 1, 9, 7);
            yield return Ball(0.165f, hair, 0, 1.07f, -0.02f, 1, 0.65f, 1, 9, 7);
            foreach (var e in KEyes(0.055f, 1.0f, 0.14f)) yield return e;
            yield return Limb(0.05f, 0.3f, top, -0.21f, 0.66f, 0.02f, 0.15f);
            yield return Limb(0.05f, 0.3f, top, 0.21f, 0.66f, 0.02f, -0.15f);
            yield return Limb(0.06f, 0.3f, legs, -0.08f, 0.2f, 0);
            yield return Limb(0.06f, 0.3f, legs, 0.08f, 0.2f, 0);
        }

        static G KBox(float w, float h, float d, uint c, float x, float y, float z) => CBox(w, h, d, c).Translate(x, y, z);
        static G KCyl(float rt, float rb, float h, uint c, float x, float y, float z, int seg = 10) => CCyl(rt, rb, h, c, seg).Translate(x, y, z);

        /// <summary>London's walkers, drawn a little bigger than life: "tourist", "trip", "teacher" (the trip's leader) or "busker".</summary>
        public static Mesh Walker(string look)
        {
            var p = new List<G>();
            float size = 1.6f;
            switch (look)
            {
                case "tourist": // a loud orange shirt, a straw sun hat, a camera round the neck and a backpack
                    p.AddRange(GrownUp(0xf08c2e, 0x6b4a2b, 0xc8b48a));
                    p.Add(KCyl(0.13f, 0.15f, 0.1f, 0xf1dc9a, 0, 1.17f, -0.01f));
                    p.Add(KCyl(0.27f, 0.27f, 0.025f, 0xf1dc9a, 0, 1.12f, -0.01f, 14));
                    p.Add(KBox(0.15f, 0.1f, 0.07f, 0x26262b, 0, 0.66f, 0.17f));
                    p.Add(CCyl(0.035f, 0.035f, 0.06f, 0x101014, 8).RotateX(Mathf.PI / 2).Translate(0, 0.66f, 0.22f));
                    p.Add(KBox(0.24f, 0.3f, 0.12f, 0x3f7fc4, 0, 0.66f, -0.2f));
                    break;
                case "trip": // a child in a hi-vis vest over the school jumper
                    size = 1.35f;
                    p.AddRange(Child(JUMPER, K_HAIR, K_GREY));
                    p.Add(KCyl(0.165f, 0.165f, 0.3f, HIVIS, 0, 0.45f, 0, 8));
                    foreach (var y in new[] { 0.38f, 0.5f }) p.Add(KCyl(0.168f, 0.168f, 0.03f, STRIPE, 0, y, 0, 8));
                    break;
                case "teacher": // hi-vis vest, clipboard
                    p.AddRange(GrownUp(0x2f6f9a, 0x8a5a2b, 0x2b2b33));
                    p.Add(KCyl(0.17f, 0.17f, 0.36f, HIVIS, 0, 0.62f, 0, 8));
                    foreach (var y in new[] { 0.55f, 0.7f }) p.Add(KCyl(0.173f, 0.173f, 0.035f, STRIPE, 0, y, 0, 8));
                    p.Add(KBox(0.16f, 0.22f, 0.02f, 0x8a5a2b, 0.2f, 0.55f, 0.12f));
                    break;
                default: // a busker: flat cap, guitar, and the open case for coins
                    p.AddRange(GrownUp(0x5a3a78, 0x2a2a2a, 0x2b3550));
                    p.Add(KCyl(0.16f, 0.17f, 0.07f, 0x3b3b40, 0, 1.15f, 0));
                    p.Add(KBox(0.2f, 0.025f, 0.12f, 0x3b3b40, 0, 1.13f, 0.15f));
                    p.Add(CCyl(0.17f, 0.17f, 0.07f, 0xb5702f, 14).RotateX(Mathf.PI / 2).Translate(-0.04f, 0.55f, 0.2f));
                    p.Add(CCyl(0.035f, 0.035f, 0.072f, 0x2a1a10, 10).RotateX(Mathf.PI / 2).Translate(-0.04f, 0.55f, 0.21f));
                    p.Add(CBox(0.05f, 0.42f, 0.03f, 0x5c3a1c).RotateZ(-0.9f).Translate(0.17f, 0.66f, 0.2f));
                    p.Add(KBox(0.6f, 0.06f, 0.32f, 0x1d1d22, 0, 0.03f, 0.6f));
                    p.Add(KBox(0.54f, 0.02f, 0.26f, 0xa3242f, 0, 0.065f, 0.6f));
                    foreach (var x in new[] { -0.12f, 0.05f, 0.16f }) p.Add(KCyl(0.03f, 0.03f, 0.01f, 0xf2c94c, x, 0.08f, 0.6f + x * 0.3f));
                    break;
            }
            return Make("walker-" + look, p, size * 0.85f);
        }

        /// <summary>A soggy chip (the school trip's): a fat, pale-gold stick, a little bent.</summary>
        public static Mesh Chip() => Make("chip", new[]
        {
            CBox(0.07f, 0.07f, 0.15f, 0xf2cf6b).RotateX(0.25f).Translate(0, 0.01f, -0.06f),
            CBox(0.07f, 0.07f, 0.14f, 0xeac05a).RotateX(-0.25f).Translate(0, 0.01f, 0.07f),
        }, 1.6f);

        /// <summary>The school trip's rope: a red length 1 m long along +z (scaled to each gap).</summary>
        public static Mesh Rope() => Make("rope", new[] { CCyl(0.05f, 0.05f, 1, 0xff3b30, 6).RotateX(Mathf.PI / 2) });

        // ================================================================== the people who stand still (people.ts)

        const uint P_SKIN = 0xf0c8a8, SHOE = 0x15151a, P_GOLD = 0xf2c230, P_RED = 0xd8342c, P_BLACK = 0x15151a, P_WHITE = 0xf6f6f6, SILVER_P = 0xc9ced6;
        /// <summary>The standing grown-ups are 1.5× the figure kit's 1.9 m.</summary>
        public const float FIGURE_SCALE = 1.5f;

        /// <summary>A standing figure's parts: its body, its two arms (pivots at the shoulders), and for the guard a mouth and a smile.</summary>
        public sealed class Figure { public List<G> body = new List<G>(), armL = new List<G>(), armR = new List<G>(), mouth = new List<G>(), smile = new List<G>(); public Vector3 shoulderL, shoulderR; }

        static Figure FigureOf(uint coat, uint legs, uint? hair, uint skin = P_SKIN, uint? hands = null, float robe = 0)
        {
            var f = new Figure();
            foreach (var side in new[] { -1f, 1f })
            {
                f.body.Add(KBox(0.14f, 0.85f, 0.16f, legs, side * 0.1f, 0.43f, 0));
                f.body.Add(KBox(0.15f, 0.09f, 0.3f, skin == SILVER_P ? SILVER_P : SHOE, side * 0.1f, 0.05f, 0.06f));
            }
            f.body.Add(KBox(0.42f, 0.64f, 0.24f, coat, 0, 1.17f, 0));
            if (robe > 0) f.body.Add(KCyl(0.22f, robe, 0.75f, coat, 0, 0.82f, 0, 16));
            foreach (var arm in new[] { f.armL, f.armR })
            {
                arm.Add(KBox(0.1f, 0.58f, 0.12f, coat, 0, -0.29f, 0));
                arm.Add(KBox(0.1f, 0.11f, 0.11f, hands ?? skin, 0, -0.63f, 0));
            }
            f.shoulderL = new Vector3(-0.27f, 1.45f, 0);
            f.shoulderR = new Vector3(0.27f, 1.45f, 0);
            f.body.Add(KBox(0.09f, 0.08f, 0.09f, skin, 0, 1.53f, 0));
            f.body.Add(Ball(0.135f, skin, 0, 1.68f, 0, 0.95f, 1.2f, 1, 12, 10));
            if (hair.HasValue) f.body.Add(Sphere(0.142f, hair.Value, 0, 0, 0, 12, 8, Mathf.PI * 2, Mathf.PI * 0.52f).RotateX(-0.25f).Translate(0, 1.73f, -0.015f));
            uint eye = skin == SILVER_P ? 0x8a9099u : 0x222222u;
            f.body.Add(Ball(0.018f, eye, -0.05f, 1.7f, 0.125f, 1, 1, 1, 12, 10));
            f.body.Add(Ball(0.018f, eye, 0.05f, 1.7f, 0.125f, 1, 1, 1, 12, 10));
            f.mouth.Add(KBox(0.06f, 0.012f, 0.01f, 0x7a3a2a, 0, 1.6f, 0.13f));
            f.smile.Add(Torus(0.035f, 0.008f, 4, 10, 0x7a3a2a, Mathf.PI).RotateZ(Mathf.PI).Translate(0, 1.615f, 0.13f));
            return f;
        }

        /// <summary>The Royal Guard in his sentry box: bearskin, red tunic, gold buttons, white belt. Unarmed: hands at his sides.</summary>
        public static Figure Guard()
        {
            var f = FigureOf(P_RED, P_BLACK, null, P_SKIN, P_WHITE);
            var b = f.body;
            b.Add(KBox(0.44f, 0.16f, 0.26f, P_RED, 0, 0.82f, 0));
            b.Add(KBox(0.44f, 0.06f, 0.26f, P_WHITE, 0, 0.95f, 0));
            b.Add(KBox(0.2f, 0.06f, 0.2f, P_GOLD, 0, 1.5f, 0));
            for (int i = 0; i < 5; i++) b.Add(Ball(0.022f, P_GOLD, 0, 1.4f - i * 0.11f, 0.125f, 1, 1, 1, 12, 10));
            b.Add(KCyl(0.17f, 0.16f, 0.42f, 0x0c0c10, 0, 1.98f, -0.01f, 16));
            b.Add(Ball(0.17f, 0x0c0c10, 0, 2.2f, -0.01f, 1, 1, 1, 12, 10));
            b.Add(Torus(0.13f, 0.01f, 4, 12, P_GOLD, Mathf.PI).RotateZ(Mathf.PI).Translate(0, 1.66f, 0.02f));
            // The sentry box behind him: red walls, open to the south, a little pyramid roof.
            b.Add(KBox(1.0f, 2.5f, 0.08f, P_RED, 0, 1.25f, -0.42f));
            b.Add(KBox(0.08f, 2.5f, 0.7f, P_RED, -0.48f, 1.25f, -0.1f));
            b.Add(KBox(0.08f, 2.5f, 0.7f, P_RED, 0.48f, 1.25f, -0.1f));
            b.Add(KBox(1.08f, 0.08f, 0.8f, P_WHITE, 0, 2.5f, -0.1f));
            b.Add(CCone(0.78f, 0.45f, P_RED, 4).RotateY(Mathf.PI / 4).Translate(0, 2.76f, -0.1f));
            return f;
        }

        /// <summary>Miss Sami, tour guide: her teal coat, and a bright umbrella held high (on her right arm, raised).</summary>
        public static Figure Sami()
        {
            var f = FigureOf(0x2f8f8a, 0x2b2b33, 0x4a2f1c, P_SKIN, null, 0.3f);
            f.body.Add(Ball(0.08f, 0x4a2f1c, 0, 1.8f, -0.12f, 1, 1, 1, 12, 10));
            // The brolly rides the arm (which the view raises): its stick, the yellow canopy and a pink panel.
            f.armR.Add(KCyl(0.02f, 0.02f, 1.6f, 0x3a2a24, 0, -0.66f - 0.7f, 0, 6));
            f.armR.Add(CCone(0.42f, 0.28f, 0xffd23f, 8).RotateX(Mathf.PI).Translate(0, -0.66f - 1.62f, 0));
            // One pink panel of the eight (a slice of a slightly bigger cone).
            f.armR.Add(Sphere(0.43f, 0xff5fa2, 0, 0, 0, 2, 4, Mathf.PI / 4, Mathf.PI / 2).Scale(1, 0.62f, 1).RotateX(Mathf.PI).Translate(0, -0.66f - 1.62f + 0.12f, 0));
            f.armR.Add(Ball(0.03f, 0xffd23f, 0, -0.66f - 1.78f, 0, 1, 1, 1, 12, 10));
            return f;
        }

        /// <summary>The Beefeater: red-and-gold Tudor robe, white ruff, flat black hat with ribbons.</summary>
        public static Figure Beefeater()
        {
            var f = FigureOf(0xb3122a, 0xb3122a, 0x5a4326, P_SKIN, null, 0.36f);
            var b = f.body;
            foreach (var (y, r) in new[] { (0.5f, 0.33f), (0.62f, 0.31f) }) b.Add(KCyl(r + 0.01f, r + 0.02f, 0.04f, P_GOLD, 0, y, 0, 16));
            b.Add(KBox(0.2f, 0.16f, 0.02f, P_GOLD, 0, 1.25f, 0.125f));
            b.Add(KBox(0.08f, 0.06f, 0.02f, P_GOLD, 0, 1.37f, 0.125f));
            b.Add(Torus(0.13f, 0.05f, 6, 14, P_WHITE).RotateX(Mathf.PI / 2).Translate(0, 1.53f, 0));
            b.Add(Ball(0.1f, 0x8a8a8a, 0, 1.58f, 0.07f, 1, 1, 1, 12, 10));
            b.Add(KCyl(0.21f, 0.19f, 0.07f, 0x101014, 0, 1.86f, 0, 16));
            b.Add(KCyl(0.15f, 0.16f, 0.08f, 0x101014, 0, 1.92f, 0, 14));
            foreach (var (x, c) in new[] { (-0.08f, P_RED), (0f, P_WHITE), (0.08f, 0x1f4aa8u) }) b.Add(KBox(0.035f, 0.12f, 0.01f, c, x, 1.84f, 0.2f));
            return f;
        }

        /// <summary>The living statue: a silver person in a silver top hat (the view stands it on its box).</summary>
        public static Figure Statue()
        {
            var f = FigureOf(SILVER_P, SILVER_P, null, SILVER_P);
            f.body.Add(KCyl(0.12f, 0.13f, 0.3f, SILVER_P, 0, 1.92f, 0, 14));
            f.body.Add(KCyl(0.2f, 0.2f, 0.02f, SILVER_P, 0, 1.78f, 0, 14));
            return f;
        }

        /// <summary>The royal wave: a dark, generic crowned silhouette (no likeness of anyone) and a corgi with its paw up.</summary>
        public static (List<G> body, List<G> arm, List<G> paw) Royal()
        {
            const uint ink = 0x2a2440, fur = 0xd98a3a;
            var body = new List<G>
            {
                CCone(0.34f, 0.95f, ink, 12).Translate(0, 0.47f, 0),
                Ball(0.15f, ink, 0, 1.05f, 0, 1, 1, 1, 12, 10),
                KCyl(0.13f, 0.13f, 0.08f, P_GOLD, 0, 1.22f, 0, 12),
                Ball(0.03f, P_RED, 0, 1.23f, 0.13f, 1, 1, 1, 12, 10),
                // The corgi beside, sitting up at the railing.
                KBox(0.2f, 0.28f, 0.18f, fur, -0.55f, 0.14f, 0.05f),
                Ball(0.11f, fur, -0.55f, 0.36f, 0.09f, 1, 1, 1, 12, 10),
                Ball(0.06f, P_WHITE, -0.55f, 0.33f, 0.17f, 1, 1, 1, 12, 10),
            };
            for (int i = 0; i < 5; i++)
            {
                float a = i / 5f * Mathf.PI * 2;
                body.Add(CCone(0.035f, 0.1f, P_GOLD, 4).Translate(Mathf.Cos(a) * 0.11f, 1.3f, Mathf.Sin(a) * 0.11f));
            }
            foreach (var side in new[] { -1f, 1f }) body.Add(CCone(0.04f, 0.1f, fur, 4).Translate(-0.55f + side * 0.06f, 0.48f, 0.07f));
            var arm = new List<G> { KBox(0.08f, 0.42f, 0.08f, ink, 0, 0.21f, 0), Ball(0.06f, P_WHITE, 0, 0.44f, 0, 1, 1, 1, 12, 10) };
            var paw = new List<G> { KBox(0.05f, 0.14f, 0.05f, P_WHITE, 0, 0.07f, 0) };
            return (body, arm, paw);
        }

        /// <summary>Turn a part list into a mesh (classic frame, turned to face +z like everything else), cached by name.</summary>
        public static Mesh Parts(string name, IEnumerable<G> parts, float scale = 1) => Make(name, CloneAll(parts), scale);

        static IEnumerable<G> CloneAll(IEnumerable<G> parts) { foreach (var p in parts) yield return p.Clone(); }

        /// <summary>A classic-frame point (a shoulder) where it lands in an HD mesh built by Make.</summary>
        public static Vector3 Turned(Vector3 classic, float scale = 1) => new Vector3(-classic.x, classic.y, classic.z) * scale;

        // ================================================================== the Crown Jewels and the pearl buttons (legends.ts)

        public static readonly uint[] JEWEL_COLOURS = { 0xe0115f, 0x1f5fe0, 0x14b86a, 0xe8f6ff, 0x9b4de0 };

        /// <summary>A gem of cut `i` (each a different shape) in a little crown, its centre about 1.1 m up.</summary>
        public static Mesh Jewel(int i)
        {
            uint c = JEWEL_COLOURS[i];
            const uint GOLD = 0xffc93c;
            G gem;
            switch (i)
            {
                case 0: gem = Sphere(0.36f, c, 0, 0, 0, 4, 2); break; // ruby: a diamond-shape
                case 1: gem = CCyl(0.3f, 0.3f, 0.3f, c, 6).RotateX(Mathf.PI / 2); break; // sapphire: a hexagon slab
                case 2: gem = CBox(0.4f, 0.5f, 0.26f, c); break; // emerald: the emerald cut
                case 3: gem = CCone(0.36f, 0.5f, c, 8).RotateX(Mathf.PI); break; // diamond: a brilliant, point down
                default: gem = Sphere(0.3f, c, 0, 0, 0, 6, 4); break; // amethyst: a round faceted stone
            }
            var p = new List<G>
            {
                gem.Translate(0, 1.15f, 0),
                CCyl(0.34f, 0.3f, 0.16f, GOLD, 12).Translate(0, 0.62f, 0),
                CCyl(0.3f, 0.3f, 0.1f, 0xb0122a, 12).Translate(0, 0.74f, 0),
            };
            for (int k = 0; k < 5; k++) { float a = k / 5f * Mathf.PI * 2; p.Add(CCone(0.06f, 0.2f, GOLD, 4).Translate(Mathf.Cos(a) * 0.3f, 0.8f, Mathf.Sin(a) * 0.3f)); }
            return Make("jewel" + i, p, 1.1f);
        }

        /// <summary>A pearl button: a white disc with four little holes, tipped to face the camera.</summary>
        public static Mesh PearlButton()
        {
            var p = new List<G> { CCyl(0.22f, 0.22f, 0.06f, 0xfffaf0, 14).RotateX(1.1f) };
            foreach (var (x, y) in new[] { (-1f, -1f), (1f, -1f), (-1f, 1f), (1f, 1f) })
                p.Add(CCyl(0.03f, 0.03f, 0.07f, 0xb8b0a0, 6).RotateX(1.1f).Translate(x * 0.06f, y * 0.06f * 0.45f, y * 0.06f * 0.9f + 0.01f));
            return Make("pearl-button", p, 1.3f);
        }

        // ================================================================== the set pieces (setPieceView.ts): these face +x

        /// <summary>A marcher on the Mall: navy trousers, red tunic, white belt, a face, a tall bearskin (or a drum and a cap).</summary>
        public static Mesh Marcher(bool band)
        {
            var p = new List<G>
            {
                Box(0.22f, 0.55f, 0.14f, NAVY, 0, 0, -0.1f), Box(0.22f, 0.55f, 0.14f, NAVY, 0, 0, 0.1f),
                Box(0.36f, 0.6f, 0.48f, GUARD_RED, 0, 0.55f, 0), Box(0.38f, 0.07f, 0.5f, 0xffffff, 0, 0.75f, 0),
                Sphere(0.16f, 0xf2c9a0, 0.02f, 1.32f, 0, 10, 8),
            };
            if (band)
            {
                p.Add(Cyl(0.2f, 0.2f, 0.3f, 0xffffff, 0.34f, 0.62f, 0, 12)); p.Add(Cyl(0.21f, 0.21f, 0.05f, GUARD_RED, 0.34f, 0.62f, 0, 12));
                p.Add(Cyl(0.18f, 0.2f, 0.32f, 0x1d1f24, 0, 1.4f, 0, 10));
            }
            else
            {
                p.Add(Cyl(0.2f, 0.2f, 0.62f, 0x1d1f24, 0, 1.4f, 0, 10));
                p.Add(Sphere(0.2f, 0x1d1f24, 0, 2.02f, 0, 10, 6, Mathf.PI * 2, Mathf.PI / 2));
            }
            return MakeX(band ? "marcher-band" : "marcher-guard", p);
        }

        /// <summary>A tall ship: dark hull, gold stripe, three masts, square sails, a red flag at the top.</summary>
        public static Mesh TallShip(uint sail)
        {
            const float MAST_H = 8;
            var p = new List<G>
            {
                Box(5.4f, 1.1f, 1.7f, 0x5a3a24, -0.2f, -0.3f, 0), Box(5.5f, 0.18f, 1.74f, 0xf2c230, -0.2f, 0.5f, 0),
                Cone(0.85f, 1.4f, 0x5a3a24, 0, 0, 0, 4).RotateZ(-Mathf.PI / 2).Translate(2.5f, 0.25f, 0),
                Box(5.2f, 0.1f, 1.5f, 0xc79a62, -0.2f, 0.78f, 0),
            };
            foreach (var (x, h) in new[] { (-1.8f, MAST_H - 1.5f), (0f, MAST_H), (1.8f, MAST_H - 1) })
            {
                p.Add(Cyl(0.07f, 0.09f, h, 0x3d2a1c, x, 0.8f, 0, 6));
                foreach (var y in new[] { 0.35f, 0.65f }) p.Add(Box(0.06f, h * 0.25f, 1.9f - y, sail, x + 0.08f, 0.8f + h * y, 0));
            }
            p.Add(Box(0.04f, 0.4f, 0.7f, 0xd8342c, 0, 0.8f + MAST_H, 0.35f));
            return MakeX("tall-ship-" + sail.ToString("x6"), p);
        }

        /// <summary>The river bus: white hull, blue band, glassy cabin, a little flag.</summary>
        public static Mesh RiverBus() => MakeX("river-bus", new[]
        {
            Box(3.2f, 0.5f, 1.3f, 0xffffff, 0, -0.2f, 0), Box(3.24f, 0.14f, 1.34f, 0x1f6fd1, 0, 0.12f, 0),
            Cone(0.65f, 0.7f, 0xffffff, 0, 0, 0, 4).RotateZ(-Mathf.PI / 2).Translate(1.6f, 0.05f, 0),
            Box(1.8f, 0.5f, 1.1f, 0xf4f8fb, -0.3f, 0.3f, 0), Box(1.82f, 0.2f, 1.12f, 0x8ec9ea, -0.3f, 0.5f, 0),
            Box(1.9f, 0.06f, 1.16f, 0x1f6fd1, -0.3f, 0.8f, 0),
            Cyl(0.025f, 0.025f, 0.5f, 0x333333, -1.35f, 0.3f, 0, 5), Box(0.02f, 0.18f, 0.3f, 0xd8342c, -1.35f, 0.62f, 0.15f),
        });

        /// <summary>A Red Arrow: a little red delta jet with a white stripe, nose +x.</summary>
        public static Mesh Jet()
        {
            var wing = new G();
            var col = MeshKit.Hex(0xd52b1e);
            foreach (var y in new[] { 0f, -0.04f })
            {
                var n = y == 0 ? Vector3.up : Vector3.down;
                int a = wing.Add(new Vector3(0.8f, y, 0), n, col), b = wing.Add(new Vector3(-0.9f, y, 1.1f), n, col), c = wing.Add(new Vector3(-0.7f, y, 0), n, col), d = wing.Add(new Vector3(-0.9f, y, -1.1f), n, col);
                if (y == 0) { wing.Tri(a, c, b); wing.Tri(a, d, c); } else { wing.Tri(a, b, c); wing.Tri(a, c, d); }
            }
            return MakeX("red-arrow", new[]
            {
                Cyl(0.16f, 0.22f, 2.4f, 0xd52b1e, 0, 0, 0, 8).RotateZ(-Mathf.PI / 2).Translate(-1.2f, 0, 0),
                Cone(0.16f, 0.6f, 0xd52b1e, 0, 0, 0, 8).RotateZ(-Mathf.PI / 2).Translate(1.2f, 0, 0),
                wing, Box(0.9f, 0.05f, 0.2f, 0xffffff, -0.4f, 0, 0), Box(0.4f, 0.5f, 0.05f, 0xd52b1e, -1.0f, 0.1f, 0),
                Sphere(0.14f, 0x8ec9ea, 0.4f, 0.14f, 0, 8, 6),
            });
        }

        /// <summary>A Tube roundel on its post (the bar's name is a label the view adds), facing south.</summary>
        public static Mesh Roundel() => MakeX("roundel", new[]
        {
            Cyl(0.07f, 0.07f, 2.2f, 0x2b2e3a, 0, 0, 0, 8),
            Torus(0.62f, 0.16f, 8, 32, 0xdc241f).Translate(0, 2.55f, 0.05f),
            CCyl(0.47f, 0.47f, 0.02f, 0xffffff, 32).RotateX(Mathf.PI / 2).Translate(0, 2.55f, 0.02f),
            CBox(2.2f, 0.4f, 0.08f, 0x1d2a8c).Translate(0, 2.55f, 0.14f),
        });

        /// <summary>The stairs down: a dark hole with white step lines and a railing round three sides.</summary>
        public static Mesh Stairs()
        {
            var p = new List<G> { Box(2.2f, 0.03f, 2.2f, 0x23252e, 0, 0.005f, 0) };
            for (int i = 0; i < 4; i++) p.Add(Box(1.8f, 0.035f, 0.08f, 0xc9ccd6, 0, 0.006f, -0.7f + i * 0.4f));
            foreach (var s in new[] { -1f, 1f }) p.Add(Box(0.08f, 0.5f, 2.2f, 0x2b2e3a, s * 1.12f, 0, 0));
            p.Add(Box(2.3f, 0.5f, 0.08f, 0x2b2e3a, 0, 0, -1.12f));
            return MakeX("tube-stairs", p);
        }

        /// <summary>A rider's capsule on the London Eye: the same glass egg as the wheel's, a little bigger, its collar gold.</summary>
        public static Mesh RideCapsule()
        {
            var g = Sphere(1, GLASS_BLUE, 0, 0, 0, 16, 9).Scale(0.68f, 0.68f, 1.15f);
            g.Append(Cyl(0.74f, 0.74f, 0.2f, 0xffd23f, 0, -0.1f, 0, 16).RotateX(Mathf.PI / 2));
            return MakeX("ride-capsule", new[] { g });
        }
    }
}
