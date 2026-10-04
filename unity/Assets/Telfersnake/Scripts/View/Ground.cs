using Telfer.Sim;
using UnityEngine;

namespace Telfer.View
{
    /// <summary>
    /// The playground plan, painted (a port of ground.ts) onto two textures: a sharp one for the school
    /// and its pavements, and a broad soft one for the streets and gardens around it.
    /// </summary>
    public static class Ground
    {
        public const float INNER = 100f;
        public const float OUTER = 320f;
        public static Texture2D Minimap;
        static readonly System.Collections.Generic.Dictionary<StageId, (Texture2D tex, Rect uv)> maps = new System.Collections.Generic.Dictionary<StageId, (Texture2D, Rect)>();

        /// <summary>Each stage's painted plan, shrunk for the minimap, and the uv rect its fence covers.</summary>
        public static void SetMap(StageId id, Texture2D tex, Rect uv) => maps[id] = (tex, uv);
        public static (Texture2D tex, Rect uv) Map(StageId id) => maps.TryGetValue(id, out var m) ? m : (Minimap, new Rect(0.11f, 0.09f, 0.78f, 0.82f));

        static readonly string[] HOP = { "#ff6b6b", "#ffd166", "#06d6a0", "#4dabf7", "#f78fb3", "#ffa94d", "#b197fc", "#63e6be" };

        public static GameObject Build(Transform parent, bool hiRes)
        {
            var root = new GameObject("Ground");
            root.transform.SetParent(parent, false);
            var grit = Tex.Grit();

            var inner = PaintInner(hiRes ? 3072 : 2048);
            Minimap = inner.Downsample(256);
            var B = School.BOUNDS;
            SetMap(StageId.School, Minimap, new Rect((B.minX + INNER / 2) / INNER, (INNER / 2 - B.maxZ) / INNER, (B.maxX - B.minX) / INNER, (B.maxZ - B.minZ) / INNER));
            var innerTex = inner.ToTexture("ground-inner");
            var innerMat = Mats.Toon(Color.white, gloss: 0.06f, smooth: 0.25f, rim: 0.0f, tex: innerTex, vertexColor: false);
            innerMat.SetTexture("_DetailMap", grit);
            innerMat.SetFloat("_DetailScale", 0.42f);
            innerMat.SetFloat("_DetailStrength", 0.85f);
            innerMat.SetFloat("_HueJitter", 0.12f);
            Plane(root.transform, "Inner", INNER, 0, innerMat, 40);

            var outer = PaintOuter(1024);
            var outerMat = Mats.Toon(Color.white, gloss: 0.04f, smooth: 0.2f, rim: 0, tex: outer.ToTexture("ground-outer"), vertexColor: false);
            outerMat.SetTexture("_DetailMap", grit);
            outerMat.SetFloat("_DetailScale", 0.4f);
            outerMat.SetFloat("_DetailStrength", 0.5f);
            outerMat.SetFloat("_HueJitter", 0.25f);
            Plane(root.transform, "Outer", OUTER, -0.03f, outerMat, 32);
            return root;
        }

        public static void Plane(Transform parent, string name, float size, float y, Material mat, int div, float cx = 0, float cz = 0)
        {
            var k = new MeshKit();
            float h = size / 2;
            // Subdivided so the shadow cascades and fog get plenty of vertices to interpolate across.
            for (int i = 0; i < div; i++)
                for (int j = 0; j < div; j++)
                {
                    float x0 = -h + size * i / div, x1 = -h + size * (i + 1) / div;
                    float z0 = -h + size * j / div, z1 = -h + size * (j + 1) / div;
                    int a = k.V.Count;
                    foreach (var (x, z) in new[] { (x0, z0), (x1, z0), (x1, z1), (x0, z1) })
                    {
                        k.V.Add(W.P(x + cx, z + cz, y));
                        k.N.Add(Vector3.up);
                        k.Col.Add(Color.white);
                        k.UV.Add(new Vector2((x + h) / size, (z + h) / size));
                    }
                    // Sim z runs south (Unity -z): this order's cross product points up.
                    k.Tri(a, a + 1, a + 2); k.Tri(a, a + 2, a + 3);
                }
            var go = new GameObject(name, typeof(MeshFilter), typeof(MeshRenderer));
            go.transform.SetParent(parent, false);
            go.GetComponent<MeshFilter>().sharedMesh = k.ToMesh(name);
            var r = go.GetComponent<MeshRenderer>();
            r.sharedMaterial = mat;
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        }

        static Painter PaintInner(int size)
        {
            var p = new Painter(size, INNER);
            var rng = new System.Random(7);
            float R(float a, float b) => a + (float)rng.NextDouble() * (b - a);

            // Pavement slabs everywhere, then the roads that frame the school.
            p.Fill(Painter.C("#b4b7bb"));
            var slab = Painter.C("#9ea2a7", 0.55f);
            for (float x = -50; x <= 50; x += 0.9f) p.Line(x, -50, x, 50, 0.035f, slab);
            for (float z = -50; z <= 50; z += 0.9f) p.Line(-50, z, 50, z, 0.035f, slab);
            Roads(p);
            // Kerbs.
            var kerb = Painter.C("#d8d9db");
            p.Rect(-42.3f, -50, -41.9f, 50, kerb);
            p.Rect(41.9f, -50, 42.3f, 50, kerb);
            p.Rect(-42, 43.7f, 42, 44.1f, kerb);

            // School tarmac with patches, stains and cracks.
            var B = School.BOUNDS;
            p.Rect(B.minX, B.minZ, B.maxX, B.maxZ, Painter.C("#7c818b"));
            Box(p, School.TOP_PLAYGROUND, Painter.C("#858a94"));
            Box(p, School.CAR_PARK, Painter.C("#8d9199"));
            for (int i = 0; i < 70; i++)
            {
                float x = R(B.minX, B.maxX), z = R(B.minZ, B.maxZ);
                p.FillEllipse(x, z, R(0.6f, 3.2f), R(0.5f, 2.2f), R(0, 3), rng.NextDouble() < 0.6 ? Painter.C("#5a5f68", 0.12f) : Painter.C("#a0a5ad", 0.10f));
            }
            for (int i = 0; i < 30; i++)
            {
                float x = R(B.minX, B.maxX), z = R(B.minZ, B.maxZ), a = R(0, 6.28f);
                for (int s = 0; s < 4; s++)
                {
                    float nx = x + Mathf.Cos(a) * R(0.6f, 1.6f), nz = z + Mathf.Sin(a) * R(0.6f, 1.6f);
                    p.Line(x, z, nx, nz, 0.045f, Painter.C("#4c5058", 0.45f));
                    x = nx; z = nz; a += R(-0.9f, 0.9f);
                }
            }
            // Drain covers.
            foreach (var (x, z) in new[] { (-30f, 12f), (2f, -14f), (-10f, 25f), (35f, 30f), (-24f, -30f), (10f, 2f) })
            {
                p.RoundRect(x - 0.4f, z - 0.4f, x + 0.4f, z + 0.4f, 0.06f, Painter.C("#4a4e55"));
                for (int k = 0; k < 5; k++) p.Line(x - 0.3f, z - 0.3f + k * 0.15f, x + 0.3f, z - 0.3f + k * 0.15f, 0.05f, Painter.C("#2c2f34"));
            }

            // Car park bays.
            for (float x = 14; x <= 37; x += 2.6f) p.Line(x, 33.5f, x, 39.5f, 0.1f, Painter.C("#e8e8e8"));

            // Amphitheatre steps curling round the south of the loop track.
            string[] steps = { "#9b9083", "#a79c8e", "#b3a899" };
            for (int k = 0; k < 3; k++)
                p.StrokeEllipse(School.LOOP_X, School.LOOP_Z, School.LOOP_RX + 3.5f + k, School.LOOP_RZ + 3.5f + k, 0.9f, Painter.C(steps[k]), Mathf.PI * 0.12f, Mathf.PI * 0.88f);

            // Painted loop "road" track.
            p.StrokeEllipse(School.LOOP_X, School.LOOP_Z, School.LOOP_RX, School.LOOP_RZ, 2.2f, Painter.C("#4f545c"));
            p.StrokeEllipse(School.LOOP_X, School.LOOP_Z, School.LOOP_RX + 1.1f, School.LOOP_RZ + 1.1f, 0.12f, Painter.C("#f1f1f1"));
            p.StrokeEllipse(School.LOOP_X, School.LOOP_Z, School.LOOP_RX - 1.1f, School.LOOP_RZ - 1.1f, 0.12f, Painter.C("#f1f1f1"));
            p.StrokeEllipse(School.LOOP_X, School.LOOP_Z, School.LOOP_RX, School.LOOP_RZ, 0.12f, Painter.C("#ffd84a"), 0, Mathf.PI * 2, 0.8f);

            // The Cage: turquoise court with white markings.
            var C = School.COURT;
            float cx0 = C.x - C.w / 2, cz0 = C.z - C.d / 2, cx1 = C.x + C.w / 2, cz1 = C.z + C.d / 2;
            p.Rect(cx0, cz0, cx1, cz1, Painter.C("#4fbfcf"));
            p.Rect(cx0 + 1, cz0 + 1, cx1 - 1, cz1 - 1, Painter.C("#55c8d6"));
            var white = Painter.C("#f4fbfc");
            p.StrokeRect(cx0 + 1, cz0 + 1, cx1 - 1, cz1 - 1, 0.14f, white);
            p.Line(cx0 + 1, C.z, cx1 - 1, C.z, 0.14f, white);
            p.StrokeEllipse(C.x, C.z, 2.4f, 2.4f, 0.14f, white);
            p.StrokeEllipse(C.x, cz0 + 1, 4, 4, 0.14f, white, 0, Mathf.PI);
            p.StrokeEllipse(C.x, cz1 - 1, 4, 4, 0.14f, white, Mathf.PI, Mathf.PI * 2);
            p.Circle(C.x, C.z, 0.18f, white);

            // Blue Lagoon soft-play blob, with a lighter rim and confetti speckle.
            p.FillEllipse(School.LAGOON_X, School.LAGOON_Z, School.LAGOON_RX + 0.25f, School.LAGOON_RZ + 0.25f, School.LAGOON_ROT, Painter.C("#2f7bd0"));
            p.FillEllipse(School.LAGOON_X, School.LAGOON_Z, School.LAGOON_RX, School.LAGOON_RZ, School.LAGOON_ROT, Painter.C("#3d8fe6"));
            string[] speck = { "#6fb2f5", "#9fd0ff", "#2c74c4", "#ffd166" };
            for (int i = 0; i < 260; i++)
            {
                float a = R(0, Mathf.PI * 2), r = Mathf.Sqrt((float)rng.NextDouble()) * 0.92f;
                float lx = Mathf.Cos(a) * School.LAGOON_RX * r, lz = Mathf.Sin(a) * School.LAGOON_RZ * r;
                float x = School.LAGOON_X + lx * Mathf.Cos(School.LAGOON_ROT) - lz * Mathf.Sin(School.LAGOON_ROT);
                float z = School.LAGOON_Z + lx * Mathf.Sin(School.LAGOON_ROT) + lz * Mathf.Cos(School.LAGOON_ROT);
                p.Circle(x, z, R(0.08f, i < 26 ? 0.3f : 0.12f), Painter.C(speck[i % speck.Length], i < 26 ? 1 : 0.7f));
            }

            // The Green (the 3D lawn grows on top of this).
            var G = School.GREEN;
            p.RoundRect(G.x - G.w / 2 - 0.2f, G.z - G.d / 2 - 0.2f, G.x + G.w / 2 + 0.2f, G.z + G.d / 2 + 0.2f, 2.6f, Painter.C("#5a8f3a"));
            p.RoundRect(G.x - G.w / 2, G.z - G.d / 2, G.x + G.w / 2, G.z + G.d / 2, 2.5f, Painter.C("#3f8a34"));
            p.Line(G.x - G.w / 2 + 8, G.z - G.d / 2, G.x - G.w / 2 + 10, G.z + G.d / 2, 0.55f, Painter.C("#b9a77a", 0.9f));

            // Sprint lanes.
            float laneD = (School.LANES_Z1 - School.LANES_Z0) / School.LANES_COUNT;
            for (int i = 0; i <= School.LANES_COUNT; i++)
                p.Line(School.LANES_X0, School.LANES_Z0 + i * laneD, School.LANES_X1, School.LANES_Z0 + i * laneD, 0.12f, Painter.C("#f1f1f1"));
            p.Line(School.LANES_X0, School.LANES_Z0, School.LANES_X0, School.LANES_Z1, 0.25f, Painter.C("#f1f1f1"));
            p.Line(School.LANES_X1, School.LANES_Z0, School.LANES_X1, School.LANES_Z1, 0.25f, Painter.C("#ffd84a"));
            for (int i = 0; i < School.LANES_COUNT; i++)
                p.Text((i + 1).ToString(), School.LANES_X0 + 1, School.LANES_Z0 + (i + 0.5f) * laneD, 0.65f, Painter.C("#f1f1f1"));

            // Hopscotch, numbered away from the player's start.
            for (int i = 0; i < School.HOP_CELLS; i++)
            {
                float z = School.HOP_Z0 - i;
                p.Rect(School.HOP_X - 0.5f, z - 1, School.HOP_X + 0.5f, z, Painter.C(HOP[i % HOP.Length]));
                p.StrokeRect(School.HOP_X - 0.5f, z - 1, School.HOP_X + 0.5f, z, 0.08f, Color.white);
                p.Text((i + 1).ToString(), School.HOP_X, z - 0.5f, 0.55f, Color.white);
            }

            // Red target grid.
            var red = Painter.C("#e0524d");
            float ts = School.TARGET_SIZE / 2;
            p.StrokeRect(School.TARGET_X - ts, School.TARGET_Z - ts, School.TARGET_X + ts, School.TARGET_Z + ts, 0.1f, red);
            p.Line(School.TARGET_X - ts, School.TARGET_Z, School.TARGET_X + ts, School.TARGET_Z, 0.1f, red);
            p.Line(School.TARGET_X, School.TARGET_Z - ts, School.TARGET_X, School.TARGET_Z + ts, 0.1f, red);
            p.StrokeEllipse(School.TARGET_X, School.TARGET_Z, 0.7f, 0.7f, 0.1f, red);

            // The Sail's shade: a faint blue wash marks the sanctuary.
            var S = School.SAIL;
            p.RoundRect(S.x - S.w / 2, S.z - S.d / 2, S.x + S.w / 2, S.z + S.d / 2, 0.6f, Painter.C("#5f8fd6", 0.18f));

            Crest(p, 0, -4);
            return p;
        }

        static void Crest(Painter p, float cx, float cz)
        {
            const float side = 5;
            var yellow = Painter.C("#ffd21f");
            var blue = Painter.C("#2f5fc0");
            p.RoundRect(cx - side / 2 - 0.4f, cz - side / 2 - 0.4f, cx + side / 2 + 0.4f, cz + side / 2 + 0.4f, 0.7f, Painter.C("#ffcb1f"));
            p.RoundRect(cx - side / 2, cz - side / 2, cx + side / 2, cz + side / 2, 0.4f, blue);
            p.Rect(cx - 1.7f, cz - 1.6f, cx + 1.7f, cz - 0.65f, yellow);
            p.Rect(cx - 0.5f, cz - 1.6f, cx + 0.5f, cz + 1.7f, yellow);
            var grid = Painter.C("#0f1e46", 0.28f);
            for (float g = -side / 2; g <= side / 2 + 0.01f; g += side / 6)
            {
                p.Line(cx + g, cz - side / 2, cx + g, cz + side / 2, 0.06f, grid);
                p.Line(cx - side / 2, cz + g, cx + side / 2, cz + g, 0.06f, grid);
            }
            void Ribbon(float z, float w, string text, float size)
            {
                p.RoundRect(cx - w / 2, cz + z, cx + w / 2, cz + z + 1.7f, 0.85f, blue);
                p.Text(text, cx, cz + z + 0.85f, size, yellow);
            }
            Ribbon(-side / 2 - 2.6f, 8, "TELFERSCOT", 0.9f);
            Ribbon(side / 2 + 0.9f, 8.6f, "100 YEARS OF LEARNING", 0.55f);
        }

        static void Box(Painter p, Box b, Color c) => p.Rect(b.x - b.w / 2, b.z - b.d / 2, b.x + b.w / 2, b.z + b.d / 2, c);

        static void Roads(Painter p)
        {
            var road = Painter.C("#555a62");
            var dash = Painter.C("#e8e8e8");
            p.Rect(-52, -160, -42, 160, road);
            p.Rect(42, -160, 52, 160, road);
            p.Rect(-42, 44, 42, 52, road);
            p.Line(-47, -160, -47, 160, 0.15f, dash, 2, 3);
            p.Line(47, -160, 47, 160, 0.15f, dash, 2, 3);
            p.Line(-42, 48, 42, 48, 0.15f, dash, 2, 3);
            // Zig-zag "SCHOOL KEEP CLEAR" markings by the gates.
            var yellow = Painter.C("#f2c230");
            for (int k = 0; k < 2; k++)
            {
                float x = k == 0 ? -42.6f : 42.6f;
                for (float z = -20; z < 20; z += 1.2f)
                {
                    p.Line(x, z, x + (k == 0 ? -0.5f : 0.5f), z + 0.6f, 0.1f, yellow);
                    p.Line(x + (k == 0 ? -0.5f : 0.5f), z + 0.6f, x, z + 1.2f, 0.1f, yellow);
                }
            }
            for (float x = -30; x < 30; x += 1.2f)
            {
                p.Line(x, 44.6f, x + 0.6f, 45.1f, 0.1f, yellow);
                p.Line(x + 0.6f, 45.1f, x + 1.2f, 44.6f, 0.1f, yellow);
            }
        }

        static Painter PaintOuter(int size)
        {
            var p = new Painter(size, OUTER);
            p.Fill(Painter.C("#7fa35a"));
            var rng = new System.Random(3);
            for (int i = 0; i < 400; i++)
            {
                float x = (float)rng.NextDouble() * OUTER - OUTER / 2, z = (float)rng.NextDouble() * OUTER - OUTER / 2;
                p.FillEllipse(x, z, 2 + (float)rng.NextDouble() * 8, 2 + (float)rng.NextDouble() * 8, 0, rng.NextDouble() < 0.5 ? Painter.C("#6c9449", 0.5f) : Painter.C("#9cbf6c", 0.4f));
            }
            // Pavements around the block, then the roads (matching the sharp inner texture).
            p.Rect(-56, -160, 56, 160, Painter.C("#b4b7bb"));
            Roads(p);
            // Back alleys between the rows of houses.
            p.Rect(-75, -160, -70, 160, Painter.C("#9a9ea4"));
            p.Rect(70, -160, 75, 160, Painter.C("#9a9ea4"));
            return p;
        }
    }
}
