using System.Collections.Generic;
using Telfer.Sim;
using Telfer.UI;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.UI;
using static Telfer.View.LK;

namespace Telfer.View
{
    /// <summary>
    /// Level 3, London, built in code (after src/render/london/*.ts): the paper tourist map you slither on
    /// (cream paper and fibres, white streets with ink edges, parks with tree dots, sandy squares, zebras,
    /// the compass rose, the dotted tour route, the "here be snakes" serpent and the folded border with its
    /// bunting), the Thames as real cartoon water in a channel cut out of the paper, the three bridges
    /// (Tower Bridge's bascules are their own objects), instanced street furniture, the twelve landmarks
    /// with their ribbons, and the see-through fade for whatever stands between the camera and the snake.
    /// </summary>
    public sealed class LondonEnv
    {
        public readonly Transform root;
        /// <summary>London fades its own landmarks (see <see cref="Sync"/>): none for the generic occlusion pass.</summary>
        public readonly List<Occluder> Occluders = new List<Occluder>();
        readonly List<LandmarkView> landmarks = new List<LandmarkView>();
        readonly List<Fader> faders = new List<Fader>();
        readonly MaterialPropertyBlock block = new MaterialPropertyBlock();
        /// <summary>Tower Bridge's two bascules (west, east), hinged at their towers, for the lifts to come.</summary>
        public Transform BasculeWest, BasculeEast;

        sealed class Fader { public List<Renderer> renderers; public Bounds bounds; public float fade = 1; public bool[] casts; }

        static readonly Bounds2 B = London.BOUNDS;
        /// <summary>The printed border round the playable map (outside the fence, never walked on).</summary>
        const float MARGIN = 5;
        const float SX0 = -85 - MARGIN, SX1 = 85 + MARGIN, SZ0 = -65 - MARGIN, SZ1 = 65 + MARGIN;
        /// <summary>The water's surface, sunk below the paper so the bridges have arches over it.</summary>
        public const float WATER_Y = -0.3f;
        const float HALF = 7, TUCK = 0.6f;
        /// <summary>The bridges' deck height (just proud of the paper) and the foot of their piers.</summary>
        const float TOP = 0.05f, BASE = WATER_Y - 0.4f;
        const float PAINT_WORLD = 180;

        /// <summary>The London built for this session (there is only ever one): the run's views hide its statues and perched ravens.</summary>
        public static LondonEnv Active;

        public LondonEnv(Transform parent, bool hiRes)
        {
            Active = this;
            root = new GameObject("London").transform;
            root.SetParent(parent, false);
            Paper(hiRes);
            Minimap();
            Thames();
            Bridges();
            Furniture();
            ElfinOak();
            foreach (var l in London.LANDMARKS)
            {
                var v = ModelsLondon.Build(l.id, root);
                landmarks.Add(v);
                foreach (var g in v.Groups)
                {
                    if (g.Count == 0) continue;
                    var b = g[0].bounds;
                    foreach (var r in g) b.Encapsulate(r.bounds);
                    var f = new Fader { renderers = g, bounds = b, casts = new bool[g.Count] };
                    for (int i = 0; i < g.Count; i++) f.casts[i] = g[i].shadowCastingMode != ShadowCastingMode.Off;
                    faders.Add(f);
                }
            }
            Labels();
            var life = new GameObject("Wildlife").AddComponent<Wildlife>();
            life.transform.SetParent(root, false);
            life.Build(London.Stage);
        }

        // ================================================================== the paper map

        static readonly Color INK_C = Painter.C("#2b2118");
        const string PAPER = "#f3e6c6", STREET = "#ffffff", MALL_RED = "#d98a74", PARK_C = "#8fd16a", PARK_EDGE_C = "#4f9a3e", SAND_C = "#efcf86", LAKE = "#4fb6c2", ROUTE_RED = "#d8342c";
        static readonly Box TRAFALGAR_SQ = new Box(London.NELSON.x, London.NELSON.z, 16, 11);
        /// <summary>The compass rose's square (kept clear of street furniture).</summary>
        public const float COMPASS_X = 3, COMPASS_Z = -32, COMPASS_R = 4.2f;
        static readonly string[] TOUR = { "museum", "palace", "piccadilly", "trafalgar", "stpauls", "gherkin", "tower", "towerbridge", "shard", "globe", "eye", "bigben" };

        /// <summary>The Thames' centre line, run on past the map's ends to the sheet's edge.</summary>
        static List<Vector2> ExtendedRiver()
        {
            var p = London.THAMES;
            var pts = new List<Vector2>();
            for (int i = 0; i < p.Count; i++) pts.Add(new Vector2(p.X(i), p.Z(i)));
            Vector2 Ext(Vector2 a, Vector2 b) => a + (a - b).normalized * (MARGIN + 1);
            pts.Insert(0, Ext(pts[0], pts[1]));
            pts.Add(Ext(pts[pts.Count - 1], pts[pts.Count - 2]));
            return pts;
        }

        static List<Vector2> Quad(Vector2 a, Vector2 c, Vector2 b, int n = 14)
        {
            var o = new List<Vector2>();
            for (int i = 0; i <= n; i++) { float t = i / (float)n; o.Add((1 - t) * (1 - t) * a + 2 * (1 - t) * t * c + t * t * b); }
            return o;
        }

        static bool InEllipse(float x, float z, Ellipse e, float pad)
        {
            float dx = x - e.x, dz = z - e.z;
            float u = dx * Mathf.Cos(e.rot) + dz * Mathf.Sin(e.rot), v = -dx * Mathf.Sin(e.rot) + dz * Mathf.Cos(e.rot);
            return (u / (e.rx + pad)) * (u / (e.rx + pad)) + (v / (e.rz + pad)) * (v / (e.rz + pad)) < 1;
        }

        void Paper(bool hiRes)
        {
            var p = new Painter(hiRes ? 3072 : 2048, PAINT_WORLD);
            var rng = new Rng(1666); // the Great Fire, for luck
            float S = p.PxPerM;
            p.Fill(Painter.C(PAPER));
            // Fibres: tiny light and dark flecks, crisper than any canvas could hold.
            int fibres = (int)(26000 * (S / 14f) * (S / 14f) * 0.6f);
            for (int i = 0; i < fibres; i++)
            {
                float v = rng.Next();
                var c = v < 0.45f ? new Color(120 / 255f, 90 / 255f, 50 / 255f, 0.12f) : v < 0.9f ? new Color(1, 1, 1, 0.22f) : new Color(90 / 255f, 70 / 255f, 40 / 255f, 0.18f);
                p.Dab(rng.Range(SX0, SX1), rng.Range(SZ0, SZ1), 1 + rng.Int(5), 1 + rng.Int(2), c);
            }
            // The folded panels (4 × 3), each catching the light a little differently, and the creases.
            float SW = SX1 - SX0, SH = SZ1 - SZ0;
            for (int i = 0; i < 4; i++)
                for (int j = 0; j < 3; j++)
                {
                    float x0 = SX0 + i * SW / 4, x1 = x0 + SW / 4, z0 = SZ0 + j * SH / 3, z1 = z0 + SH / 3;
                    bool dark = (i + j) % 2 == 0;
                    Color a = dark ? new Color(110 / 255f, 80 / 255f, 40 / 255f, 0.05f) : new Color(1, 1, 1, 0.06f);
                    Color b = dark ? new Color(1, 1, 1, 0.04f) : new Color(110 / 255f, 80 / 255f, 40 / 255f, 0.06f);
                    p.Tint(x0, z0, x1, z1, (x, z) => Color.Lerp(a, b, (x - x0) / (x1 - x0)));
                }
            var crease = new Color(120 / 255f, 95 / 255f, 60 / 255f, 0.22f);
            for (int i = 1; i < 4; i++) p.Line(SX0 + i * SW / 4, SZ0, SX0 + i * SW / 4, SZ1, 0.12f, crease);
            for (int j = 1; j < 3; j++) p.Line(SX0, SZ0 + j * SH / 3, SX1, SZ0 + j * SH / 3, 0.12f, crease);

            // ---- parks: flat bright green, an inked edge, footpaths, lakes, and drawn tree dots
            var parks = new[] { London.HYDE_PARK, London.ST_JAMES, London.SOUTH_BANK };
            foreach (var b in parks)
            {
                p.RoundRect(b.x - b.w / 2 - 0.25f, b.z - b.d / 2 - 0.25f, b.x + b.w / 2 + 0.25f, b.z + b.d / 2 + 0.25f, 2.25f, Painter.C(PARK_EDGE_C));
                p.RoundRect(b.x - b.w / 2 + 0.25f, b.z - b.d / 2 + 0.25f, b.x + b.w / 2 - 0.25f, b.z + b.d / 2 - 0.25f, 1.75f, Painter.C(PARK_C));
            }
            var hp = London.HYDE_PARK;
            var sb = London.SOUTH_BANK;
            p.Polyline(Quad(new Vector2(hp.x - 14, hp.z + 13), new Vector2(hp.x - 4, hp.z - 10), new Vector2(hp.x + 14, hp.z - 13)), 1.2f, Painter.C(SAND_C));
            p.Polyline(Quad(new Vector2(hp.x - 15, hp.z - 6), new Vector2(hp.x, hp.z + 4), new Vector2(hp.x + 15, hp.z + 8)), 1.2f, Painter.C(SAND_C));
            p.Polyline(Quad(new Vector2(sb.x - 10, sb.z), new Vector2(sb.x, sb.z - 5), new Vector2(sb.x + 10, sb.z + 2)), 1.2f, Painter.C(SAND_C));
            foreach (var lake in new[] { London.SERPENTINE, London.ST_JAMES_LAKE })
            {
                p.FillEllipse(lake.x, lake.z, lake.rx + 0.15f, lake.rz + 0.15f, lake.rot, INK_C);
                p.FillEllipse(lake.x, lake.z, lake.rx - 0.15f, lake.rz - 0.15f, lake.rot, Painter.C(LAKE));
                for (int k = -1; k <= 1; k += 2)
                {
                    float cx = lake.x + k * lake.rx * 0.35f, cz = lake.z + k * 0.3f;
                    var pts = Quad(new Vector2(cx - 0.8f, cz), new Vector2(cx - 0.4f, cz - 0.35f), new Vector2(cx, cz), 6);
                    pts.AddRange(Quad(new Vector2(cx, cz), new Vector2(cx + 0.4f, cz + 0.35f), new Vector2(cx + 0.8f, cz), 6));
                    p.Polyline(pts, 0.15f, new Color(1, 1, 1, 0.85f));
                }
            }
            foreach (var b in parks)
            {
                int n = Mathf.RoundToInt(b.w * b.d / 14);
                for (int i = 0; i < n; i++)
                {
                    float x = rng.Range(b.x - b.w / 2 + 1, b.x + b.w / 2 - 1), z = rng.Range(b.z - b.d / 2 + 1, b.z + b.d / 2 - 1);
                    if (InEllipse(x, z, London.SERPENTINE, 1.5f) || InEllipse(x, z, London.ST_JAMES_LAKE, 1.5f)) continue;
                    float r = rng.Range(0.45f, 0.8f);
                    p.Circle(x, z, r + 0.06f, Painter.C("#2f6b2a"));
                    p.Circle(x, z, r - 0.06f, Painter.C("#5daa45"));
                    p.Circle(x - r * 0.3f, z - r * 0.3f, r * 0.35f, new Color(1, 1, 1, 0.35f));
                }
            }

            // ---- sandy squares
            var sqEdge = new Color(43 / 255f, 33 / 255f, 24 / 255f, 0.55f);
            foreach (var b in new[] { TRAFALGAR_SQ, London.COVENT_GARDEN, London.BOROUGH, new Box(COMPASS_X, COMPASS_Z, 11, 10) })
            {
                p.RoundRect(b.x - b.w / 2 - 0.09f, b.z - b.d / 2 - 0.09f, b.x + b.w / 2 + 0.09f, b.z + b.d / 2 + 0.09f, 1.09f, sqEdge);
                p.RoundRect(b.x - b.w / 2 + 0.09f, b.z - b.d / 2 + 0.09f, b.x + b.w / 2 - 0.09f, b.z + b.d / 2 - 0.09f, 0.91f, Painter.C(SAND_C));
            }
            foreach (var (x, z, r) in new[] { (London.PICCADILLY_FOUNTAIN.x, London.PICCADILLY_FOUNTAIN.z, 6f), (London.VICTORIA_MEMORIAL.x, London.VICTORIA_MEMORIAL.z, 5f) })
            {
                p.Circle(x, z, r + 0.09f, sqEdge);
                p.Circle(x, z, r - 0.09f, Painter.C(SAND_C));
            }

            // ---- streets: an ink band, then the white road over it (the Mall is the famous red road)
            List<Vector2> Path(Road r) { var o = new List<Vector2>(); for (int i = 0; i < r.Count; i++) o.Add(new Vector2(r.X(i), r.Z(i))); return o; }
            foreach (var r in London.ROADS) p.Polyline(Path(r), r.width + 0.5f, INK_C);
            foreach (var r in London.ROADS) p.Polyline(Path(r), r.width, Painter.C(r.id == "mall" ? MALL_RED : STREET));
            foreach (var r in London.ROADS) p.Polyline(Path(r), 0.12f, new Color(43 / 255f, 33 / 255f, 24 / 255f, 0.18f), 1.2f, 1.4f);

            // ---- zebra crossings: white bars along the road, edged with ink so they show on white
            foreach (var zb in London.ZEBRAS)
            {
                int bars = Mathf.FloorToInt(zb.width / 0.8f);
                float cs = Mathf.Cos(zb.angle), sn = Mathf.Sin(zb.angle);
                for (int i = 0; i < bars; i++)
                {
                    float y = -zb.width / 2 + 0.4f + i * 0.8f + 0.1f + 0.2f;
                    float cx = zb.x - sn * y, cz = zb.z + cs * y;
                    p.RotRect(cx, cz, 2.2f, 0.5f, zb.angle, INK_C);
                    p.RotRect(cx, cz, 2.0f, 0.4f, zb.angle, Color.white);
                }
            }

            Compass(p, COMPASS_X, COMPASS_Z, COMPASS_R);

            // ---- the dotted red tour route, bowing gently from sight to sight
            var stops = new List<Vector2>();
            foreach (var id in TOUR) { var l = London.Find(id); stops.Add(new Vector2(l.x, l.z)); }
            var route = new List<Vector2> { stops[0] };
            for (int i = 1; i < stops.Count; i++)
            {
                var a = stops[i - 1]; var b = stops[i];
                var mid = new Vector2((a.x + b.x) / 2 - (b.y - a.y) * 0.12f, (a.y + b.y) / 2 + (b.x - a.x) * 0.12f);
                var q = Quad(a, mid, b, 20);
                q.RemoveAt(0);
                route.AddRange(q);
            }
            p.Polyline(route, 0.45f, Painter.C(ROUTE_RED), 0.5f, 0.9f);
            foreach (var s in stops) p.Circle(s.x, s.y, 0.7f, Painter.C(ROUTE_RED));

            Serpent(p, -66, 49);

            // ---- the river: an ink bank line, then cut the water out of the paper (the Thames mesh fills it)
            var river = ExtendedRiver();
            for (int i = 0; i + 1 < river.Count; i++)
            {
                var a = river[i]; var b = river[i + 1];
                p.Line(a.x, a.y, b.x, b.y, London.THAMES.width + 0.7f, INK_C);
            }
            for (int i = 0; i + 1 < river.Count; i++)
            {
                var a = river[i]; var b = river[i + 1];
                float w = London.THAMES.width;
                p.Erase(Mathf.Min(a.x, b.x) - w, Mathf.Min(a.y, b.y) - w, Mathf.Max(a.x, b.x) + w, Mathf.Max(a.y, b.y) + w, (x, z) =>
                {
                    var d = b - a;
                    float t = Mathf.Clamp01(Vector2.Dot(new Vector2(x, z) - a, d) / d.sqrMagnitude);
                    return Vector2.Distance(new Vector2(x, z), a + d * t) - w / 2;
                });
            }

            // ---- the border: a darker margin, a double ink frame, the cartouche and a scale bar
            var margin = new Color(160 / 255f, 120 / 255f, 60 / 255f, 0.16f);
            p.Tint(SX0, SZ0, SX1, B.minZ, (x, z) => margin);
            p.Tint(SX0, B.maxZ, SX1, SZ1, (x, z) => margin);
            p.Tint(SX0, B.minZ, B.minX, B.maxZ, (x, z) => margin);
            p.Tint(B.maxX, B.minZ, SX1, B.maxZ, (x, z) => margin);
            p.StrokeRect(B.minX, B.minZ, B.maxX, B.maxZ, 0.45f, INK_C);
            p.StrokeRect(B.minX - 1, B.minZ - 1, B.maxX + 1, B.maxZ + 1, 0.15f, INK_C);
            Color[] tick = { Painter.C("#c8102e"), Color.white, Painter.C("#012169") };
            int kk = 0;
            for (float x = B.minX; x < B.maxX; x += 3, kk++)
            {
                p.Rect(x, B.minZ - 2.2f, x + 3, B.minZ - 1.6f, tick[kk % 3]);
                p.Rect(x, B.maxZ + 1.6f, x + 3, B.maxZ + 2.2f, tick[kk % 3]);
            }
            Cartouche(p, 0, B.maxZ + MARGIN / 2 + 0.2f);
            for (int i = 0; i < 4; i++) p.Rect(B.maxX - 24 + i * 5, B.maxZ + 2.6f, B.maxX - 19 + i * 5, B.maxZ + 3.4f, i % 2 == 0 ? INK_C : Painter.C("#fffaf0"));
            p.StrokeRect(B.maxX - 24, B.maxZ + 2.6f, B.maxX - 4, B.maxZ + 3.4f, 0.12f, INK_C);

            // Printed colours under a bright sun: the sheet is toned down so the cream, its fibres and the white streets survive the grade.
            // Cooled as well (the sheet is #f3e6c6 and the sun is warm), so it lands on the classic's cream, about #f8f1df.
            var paperTint = new Color(0.8f, 0.83f, 0.92f);
            var mat = Mats.Toon(paperTint, gloss: 0.04f, smooth: 0.2f, rim: 0, tex: p.ToTexture("london-paper"), vertexColor: false);
            // Rain on the paper: it darkens a touch and takes a wet, puddly sheen (just the gloss: cheap everywhere).
            float wetNow = -1;
            Atmosphere.Wet = w =>
            {
                if (Mathf.Abs(w - wetNow) < 0.01f) return;
                wetNow = w;
                mat.SetFloat("_Gloss", Mathf.Lerp(0.04f, 0.75f, w));
                mat.SetFloat("_Smoothness", Mathf.Lerp(0.2f, 0.82f, w));
                mat.SetColor("_BaseColor", Color.Lerp(paperTint, paperTint * 0.95f, w));
            };
            mat.SetFloat("_Cutoff", 0.5f);
            // The paper's own tooth, very faint, so it reads as paper up close.
            mat.SetTexture("_DetailMap", Tex.Grit());
            mat.SetFloat("_DetailScale", 0.9f);
            mat.SetFloat("_DetailStrength", 0.12f);
            Sheet("paper", SX0, SZ0, SX1, SZ1, 0, mat, 36, 28);

            // The table the map lies on: a frame of warm wood round the sheet (no table under it, so the river channel shows).
            var wood = Mats.Toon(MeshKit.Hex(0xb9a888), gloss: 0.25f, smooth: 0.45f, rim: 0, vertexColor: false);
            wood.SetTexture("_DetailMap", Tex.Grit());
            wood.SetFloat("_DetailScale", 0.08f);
            wood.SetFloat("_DetailStrength", 0.45f);
            const float T = 450;
            Sheet("table-n", -T, -T, T, SZ0, -0.05f, wood, 8, 4);
            Sheet("table-s", -T, SZ1, T, T, -0.05f, wood, 8, 4);
            Sheet("table-w", -T, SZ0, SX0, SZ1, -0.05f, wood, 4, 2);
            Sheet("table-e", SX1, SZ0, T, SZ1, -0.05f, wood, 4, 2);
        }

        /// <summary>A flat rectangle of ground (sim x0..x1, z0..z1) at height y, uv mapped to the paint's square.</summary>
        void Sheet(string name, float x0, float z0, float x1, float z1, float y, Material mat, int nx, int nz)
        {
            var k = new MeshKit();
            for (int i = 0; i < nx; i++)
                for (int j = 0; j < nz; j++)
                {
                    float ax = Mathf.Lerp(x0, x1, i / (float)nx), bx = Mathf.Lerp(x0, x1, (i + 1) / (float)nx);
                    float az = Mathf.Lerp(z0, z1, j / (float)nz), bz = Mathf.Lerp(z0, z1, (j + 1) / (float)nz);
                    int a = k.V.Count;
                    foreach (var (x, z) in new[] { (ax, az), (bx, az), (bx, bz), (ax, bz) })
                    {
                        k.V.Add(W.P(x, z, y));
                        k.N.Add(Vector3.up);
                        k.Col.Add(Color.white);
                        k.UV.Add(new Vector2((x + PAINT_WORLD / 2) / PAINT_WORLD, (z + PAINT_WORLD / 2) / PAINT_WORLD));
                    }
                    k.Tri(a, a + 1, a + 2); k.Tri(a, a + 2, a + 3);
                }
            var go = new GameObject(name, typeof(MeshFilter), typeof(MeshRenderer));
            go.transform.SetParent(root, false);
            go.GetComponent<MeshFilter>().sharedMesh = k.ToMesh(name);
            var r = go.GetComponent<MeshRenderer>();
            r.sharedMaterial = mat;
            r.shadowCastingMode = ShadowCastingMode.Off;
        }

        static void Compass(Painter p, float cx, float cz, float r)
        {
            p.Circle(cx, cz, r + r * 0.02f, INK_C);
            p.Circle(cx, cz, r - r * 0.02f, Painter.C("#fffaf0"));
            p.StrokeEllipse(cx, cz, r * 0.82f, r * 0.82f, r * 0.015f, INK_C);
            void Point(float angle, float len, float w, Color a, Color b)
            {
                // The point's tip is "up" (north, -z) before turning by `angle` (clockwise on the map).
                Vector2 R(float u, float v) { float cs = Mathf.Cos(angle), sn = Mathf.Sin(angle); return new Vector2(cx + u * cs - v * sn, cz + u * sn + v * cs); }
                p.Polygon(new[] { R(0, -len), R(w, 0), R(0, 0) }, a);
                p.Polygon(new[] { R(0, -len), R(-w, 0), R(0, 0) }, b);
                var tip = R(0, -len); var l = R(-w, 0); var rr = R(w, 0);
                p.Polyline(new[] { tip, rr, l, tip }, r * 0.02f, INK_C);
            }
            for (int i = 0; i < 4; i++) Point(Mathf.PI / 4 + i * Mathf.PI / 2, r * 0.55f, r * 0.12f, Painter.C("#f2c230"), Painter.C("#c99a1a"));
            for (int i = 0; i < 4; i++) Point(i * Mathf.PI / 2, r * 0.8f, r * 0.16f, Painter.C(i == 0 ? "#d8342c" : "#1f3264"), Painter.C(i == 0 ? "#9e1f1a" : "#121e40"));
            p.Circle(cx, cz, r * 0.07f, INK_C);
            p.Text("N", cx, cz - r * 1.05f, r * 0.3f, INK_C);
            p.Text("S", cx, cz + r * 0.91f, r * 0.15f, INK_C);
            p.Text("E", cx + r * 0.91f, cz, r * 0.15f, INK_C);
            p.Text("W", cx - r * 0.91f, cz, r * 0.15f, INK_C);
        }

        static void Serpent(Painter p, float cx, float cz)
        {
            var sea = new Color(31 / 255f, 100 / 255f, 130 / 255f, 0.55f);
            for (int row = -2; row <= 2; row++)
                for (int k = -4; k <= 4; k++)
                {
                    float x = cx + k * 2.4f + (row % 2) * 1.2f, y = cz + row * 1.6f + 0.6f;
                    var w = Quad(new Vector2(x - 0.7f, y), new Vector2(x - 0.35f, y - 0.4f), new Vector2(x, y), 6);
                    w.AddRange(Quad(new Vector2(x, y), new Vector2(x + 0.35f, y + 0.4f), new Vector2(x + 0.7f, y), 6));
                    p.Polyline(w, 0.14f, sea);
                }
            var body = Painter.C("#5fae4a");
            foreach (var (hx, hr) in new[] { (-3.2f, 1.3f), (-0.4f, 1.5f), (2.4f, 1.2f) })
            {
                // A hump: the half ring between radius hr and 0.45 hr, rising out of the sea.
                var pts = new List<Vector2>();
                for (int i = 0; i <= 16; i++) { float a = Mathf.PI + i / 16f * Mathf.PI; pts.Add(new Vector2(cx + hx + Mathf.Cos(a) * hr, cz + 0.3f + Mathf.Sin(a) * hr)); }
                for (int i = 0; i <= 16; i++) { float a = 2 * Mathf.PI - i / 16f * Mathf.PI; pts.Add(new Vector2(cx + hx + Mathf.Cos(a) * hr * 0.45f, cz + 0.3f + Mathf.Sin(a) * hr * 0.45f)); }
                p.Polygon(pts, body);
                pts.Add(pts[0]);
                p.Polyline(pts, 0.18f, INK_C);
            }
            var tail = Quad(new Vector2(cx - 5.4f, cz + 0.3f), new Vector2(cx - 6.6f, cz - 1.6f), new Vector2(cx - 5.4f, cz - 1.9f), 10);
            tail.AddRange(Quad(new Vector2(cx - 5.4f, cz - 1.9f), new Vector2(cx - 4.9f, cz - 1.6f), new Vector2(cx - 5.3f, cz - 1.2f), 6));
            p.Polyline(tail, 0.4f, body);
            var head = Quad(new Vector2(cx + 4.1f, cz + 0.3f), new Vector2(cx + 4.2f, cz - 2.2f), new Vector2(cx + 5.6f, cz - 2.3f), 10);
            head.AddRange(Quad(new Vector2(cx + 5.6f, cz - 2.3f), new Vector2(cx + 6.9f, cz - 2.2f), new Vector2(cx + 6.8f, cz - 1.5f), 8));
            head.AddRange(Quad(new Vector2(cx + 6.8f, cz - 1.5f), new Vector2(cx + 5.8f, cz - 1.2f), new Vector2(cx + 5.2f, cz + 0.3f), 10));
            p.Polygon(head, body);
            head.Add(head[0]);
            p.Polyline(head, 0.18f, INK_C);
            p.Circle(cx + 5.5f, cz - 1.95f, 0.31f, INK_C);
            p.Circle(cx + 5.5f, cz - 1.95f, 0.22f, Color.white);
            p.Circle(cx + 5.55f, cz - 1.95f, 0.09f, INK_C);
            var red = Painter.C("#d8342c");
            p.Line(cx + 6.8f, cz - 1.6f, cx + 7.6f, cz - 1.7f, 0.12f, red);
            p.Line(cx + 7.6f, cz - 1.7f, cx + 7.95f, cz - 1.95f, 0.12f, red);
            p.Line(cx + 7.6f, cz - 1.7f, cx + 7.95f, cz - 1.45f, 0.12f, red);
            p.Text("HERE BE SNAKES", cx + 0.5f, cz + 5.4f, 1.3f, INK_C);
        }

        static void Cartouche(Painter p, float cx, float cz)
        {
            const float w = 26, h = 3.6f;
            foreach (int s in new[] { -1, 1 })
            {
                var pts = new[]
                {
                    new Vector2(cx + s * w / 2 - s * 2, cz - h / 2 + 0.6f), new Vector2(cx + s * w / 2 + s * 3, cz - h / 2 + 0.6f), new Vector2(cx + s * w / 2 + s * 1.8f, cz + 0.6f),
                    new Vector2(cx + s * w / 2 + s * 3, cz + h / 2 + 0.6f), new Vector2(cx + s * w / 2 - s * 2, cz + h / 2 + 0.6f),
                };
                p.Polygon(pts, Painter.C("#b8282a"));
                p.Polyline(new[] { pts[0], pts[1], pts[2], pts[3], pts[4], pts[0] }, 0.15f, INK_C);
            }
            p.RoundRect(cx - w / 2 - 0.09f, cz - h / 2 - 0.09f, cx + w / 2 + 0.09f, cz + h / 2 + 0.09f, 0.49f, INK_C);
            p.RoundRect(cx - w / 2 + 0.09f, cz - h / 2 + 0.09f, cx + w / 2 - 0.09f, cz + h / 2 - 0.09f, 0.31f, Painter.C("#d8342c"));
            p.Text("LONDON", cx, cz + 0.05f, 2.4f, Painter.C("#fffaf0"));
        }

        // ================================================================== the minimap: a tiny tourist map with the sights' pictures

        void Minimap()
        {
            var p = new Painter(1024, PAINT_WORLD);
            p.Fill(Painter.C("#c9b48f"));
            p.Rect(B.minX, B.minZ, B.maxX, B.maxZ, Painter.C("#f3ead2"));
            foreach (var b in new[] { London.HYDE_PARK, London.ST_JAMES }) p.Rect(b.x - b.w / 2, b.z - b.d / 2, b.x + b.w / 2, b.z + b.d / 2, Painter.C("#9ccc7a"));
            foreach (var r in London.ROADS)
            {
                var pts = new List<Vector2>();
                for (int i = 0; i < r.Count; i++) pts.Add(new Vector2(r.X(i), r.Z(i)));
                p.Polyline(pts, Mathf.Max(1.2f, r.width * 0.7f), Painter.C("#c9c3b4"));
            }
            var river = ExtendedRiver();
            for (int i = 0; i + 1 < river.Count; i++) p.Line(river[i].x, river[i].y, river[i + 1].x, river[i + 1].y, London.THAMES.width, Painter.C("#5aa9e6"));
            foreach (var b in London.BRIDGES) p.Rect(b.x - b.w / 2, b.z - b.d / 2, b.x + b.w / 2, b.z + b.d / 2, Painter.C("#b9a98a"));
            var foot = new Color(74 / 255f, 64 / 255f, 56 / 255f, 0.35f);
            foreach (var b in London.Stage.SolidBoxes) p.Rect(b.x - b.w / 2, b.z - b.d / 2, b.x + b.w / 2, b.z + b.d / 2, foot);
            foreach (var c in London.Stage.SolidCircles) p.Circle(c.x, c.z, Mathf.Max(0.7f, c.r), foot);
            foreach (var l in London.LANDMARKS) Icon(p, l.id, l.x, l.z);
            float u0 = (B.minX + PAINT_WORLD / 2) / PAINT_WORLD, v0 = (PAINT_WORLD / 2 - B.maxZ) / PAINT_WORLD;
            Ground.SetMap(StageId.London, p.Downsample(512), new Rect(u0, v0, (B.maxX - B.minX) / PAINT_WORLD, (B.maxZ - B.minZ) / PAINT_WORLD));
        }

        /// <summary>A tiny picture of each sight (londonLayout.ts paintIcon), in icon units × 1.5 m round (cx, cz).</summary>
        static void Icon(Painter p, string id, float cx, float cz)
        {
            const float u = 1.5f, lw = 0.9f * u;
            Vector2 P(float x, float y) => new Vector2(cx + x * u, cz + y * u);
            void Rect(float x, float y, float w, float h, string fill)
            {
                p.Rect(cx + x * u - lw / 2, cz + y * u - lw / 2, cx + (x + w) * u + lw / 2, cz + (y + h) * u + lw / 2, INK_C);
                p.Rect(cx + x * u + lw / 2, cz + y * u + lw / 2, cx + (x + w) * u - lw / 2, cz + (y + h) * u - lw / 2, Painter.C(fill));
            }
            void Poly(string fill, params float[] pts)
            {
                var v = new List<Vector2>();
                for (int i = 0; i < pts.Length; i += 2) v.Add(P(pts[i], pts[i + 1]));
                p.Polygon(v, Painter.C(fill));
                v.Add(v[0]);
                p.Polyline(v, lw, INK_C);
            }
            void Dot(float x, float y, float r, string fill)
            {
                p.Circle(cx + x * u, cz + y * u, r * u + lw / 2, INK_C);
                p.Circle(cx + x * u, cz + y * u, Mathf.Max(0.2f, r * u - lw / 2), Painter.C(fill));
            }
            switch (id)
            {
                case "bigben": Rect(-2, -4, 4, 9, "#e2b85c"); Poly("#434a57", -2.4f, -4, 2.4f, -4, 0, -9); Dot(0, -1.5f, 1.3f, "#fffbea"); break;
                case "eye":
                    p.StrokeEllipse(cx, cz - 1 * u, 5 * u, 5 * u, 2.6f * u, INK_C);
                    p.StrokeEllipse(cx, cz - 1 * u, 5 * u, 5 * u, 1.4f * u, Color.white);
                    p.Polyline(new[] { P(-2.5f, 5), P(0, -1), P(2.5f, 5) }, lw, INK_C);
                    Dot(0, -1, 0.9f, "#8cc8ec");
                    break;
                case "palace": Rect(-7, -2.5f, 14, 5, "#f1e6cc"); p.Line(cx, cz - 2.5f * u, cx, cz - 7 * u, lw, INK_C); Rect(0, -7, 3, 2, "#d8342c"); break;
                case "trafalgar": Rect(-0.8f, -8, 1.6f, 10, "#d9cdb3"); Dot(0, -8.5f, 1.2f, "#a89c86"); Rect(-3, 2, 6, 2, "#d9cdb3"); break;
                case "stpauls":
                {
                    Rect(-5, 0, 10, 4, "#f1ebdc");
                    var dome = new List<float> { -4, 0 };
                    for (int i = 0; i <= 12; i++) { float a = Mathf.PI + i / 12f * Mathf.PI; dome.Add(Mathf.Cos(a) * 4); dome.Add(Mathf.Sin(a) * 4); }
                    Poly("#c9ccd0", dome.ToArray());
                    Rect(-0.5f, -6.5f, 1, 2.5f, "#f2c230");
                    break;
                }
                case "tower": Rect(-4.5f, -4.5f, 9, 9, "#efe6d0"); foreach (var (x, y) in new[] { (-4.5f, -4.5f), (4.5f, -4.5f), (-4.5f, 4.5f), (4.5f, 4.5f) }) Dot(x, y, 1.6f, "#e5dac0"); break;
                case "towerbridge": Rect(-6, -1.2f, 12, 2.4f, "#8cc8ec"); Rect(-7.5f, -3, 3.4f, 6, "#d9cdb3"); Rect(4.1f, -3, 3.4f, 6, "#d9cdb3"); break;
                case "shard": Poly("#8ec9ea", -4, 4.5f, 4, 4.5f, 0.4f, -9, -0.4f, -9); break;
                case "gherkin":
                    p.FillEllipse(cx, cz - 1.5f * u, 3 * u + lw / 2, 5.5f * u + lw / 2, 0, INK_C);
                    p.FillEllipse(cx, cz - 1.5f * u, 3 * u - lw / 2, 5.5f * u - lw / 2, 0, Painter.C("#5c9e3c"));
                    break;
                case "globe": Dot(0, 0, 4.5f, "#c9a25a"); Dot(0, 0, 2.5f, "#f8f1df"); break;
                case "piccadilly": Rect(-6, -3, 4, 4, "#ff5fa2"); Rect(-2, -3, 4, 4, "#ffd23f"); Rect(2, -3, 4, 4, "#3fb6ff"); Dot(0, 4, 1.4f, "#d9cdb3"); break;
                case "museum": Rect(-7, -1.5f, 14, 5, "#c9714b"); Rect(-2.6f, -6, 2, 5, "#c9714b"); Rect(0.6f, -6, 2, 5, "#c9714b"); break;
            }
        }

        // ================================================================== the Thames

        /// <summary>Left-of-travel offset directions along a polyline, stretched so a ribbon keeps its width round a bend.</summary>
        static Vector3[] Miters(List<Vector2> path)
        {
            var o = new Vector3[path.Count];
            for (int i = 0; i < path.Count; i++)
            {
                Vector2 Seg(Vector2 a, Vector2 b) => (b - a).normalized;
                var t0 = i > 0 ? Seg(path[i - 1], path[i]) : Seg(path[i], path[i + 1]);
                var t1 = i < path.Count - 1 ? Seg(path[i], path[i + 1]) : Seg(path[i - 1], path[i]);
                var t = (t0 + t1).normalized;
                float nx = -t.y, nz = t.x;
                float k = 1 / Mathf.Max(0.5f, nx * -t1.y + nz * t1.x);
                o[i] = new Vector3(nx, nz, k);
            }
            return o;
        }

        void Thames()
        {
            var path = ExtendedRiver();
            var m = Miters(path);
            var v = new List<Vector3>();
            var uv = new List<Vector2>();
            var tri = new List<int>();
            float along = 0;
            const int ACROSS = 6;
            for (int i = 0; i < path.Count; i++)
            {
                if (i > 0) along += Vector2.Distance(path[i - 1], path[i]);
                for (int j = 0; j <= ACROSS; j++)
                {
                    float off = Mathf.Lerp(HALF + TUCK, -(HALF + TUCK), j / (float)ACROSS);
                    v.Add(W.P(path[i].x + m[i].x * off * m[i].z, path[i].y + m[i].y * off * m[i].z, WATER_Y));
                    uv.Add(new Vector2(along, off));
                }
            }
            for (int i = 0; i + 1 < path.Count; i++)
                for (int j = 0; j < ACROSS; j++)
                {
                    int a = i * (ACROSS + 1) + j, b = a + ACROSS + 1;
                    tri.AddRange(new[] { a, b, a + 1, a + 1, b, b + 1 });
                }
            var mesh = new Mesh { name = "thames" };
            mesh.SetVertices(v); mesh.SetUVs(0, uv);
            // Up must be up: wind each triangle so its normal points +y.
            for (int t = 0; t < tri.Count; t += 3)
                if (Vector3.Cross(v[tri[t + 1]] - v[tri[t]], v[tri[t + 2]] - v[tri[t]]).y < 0) { int s = tri[t + 1]; tri[t + 1] = tri[t + 2]; tri[t + 2] = s; }
            mesh.SetTriangles(tri, 0);
            var nn = new Vector3[v.Count];
            for (int i = 0; i < nn.Length; i++) nn[i] = Vector3.up;
            mesh.normals = nn;
            mesh.RecalculateBounds();
            var go = new GameObject("Thames", typeof(MeshFilter), typeof(MeshRenderer));
            go.transform.SetParent(root, false);
            go.GetComponent<MeshFilter>().sharedMesh = mesh;
            var mat = new Material(Shader.Find("Telfer/Thames")) { name = "Thames" };
            mat.SetColor("_Deep", MeshKit.Hex(THAMES));
            mat.SetColor("_Light", MeshKit.Hex(THAMES_LIGHT));
            mat.SetFloat("_Half", HALF);
            var r = go.GetComponent<MeshRenderer>();
            r.sharedMaterial = mat;
            r.shadowCastingMode = ShadowCastingMode.Off;

            // The embankment walls: stone, from the paper's edge down into the water, and end caps at the sheet edge.
            var walls = new MeshKit();
            walls.C = MeshKit.Hex(0xbfae8c);
            float bottom = WATER_Y - 0.4f;
            foreach (int side in new[] { 1, -1 })
            {
                float run = 0;
                for (int i = 0; i + 1 < path.Count; i++)
                {
                    Vector3 P(int k, float y) => W.P(path[k].x + m[k].x * side * HALF * m[k].z, path[k].y + m[k].y * side * HALF * m[k].z, y);
                    float seg = Vector2.Distance(path[i], path[i + 1]);
                    walls.Quad(P(i, 0), P(i + 1, 0), P(i + 1, bottom), P(i, bottom), new Vector2(seg / 2, 0.35f), true);
                    run += seg;
                }
            }
            foreach (var (a, b) in new[] { (path[0], path[1]), (path[path.Count - 1], path[path.Count - 2]) })
            {
                var d = (b - a).normalized;
                var nrm = new Vector2(-d.y, d.x) * (HALF + TUCK);
                walls.Quad(W.P(a.x + nrm.x, a.y + nrm.y, 0), W.P(a.x - nrm.x, a.y - nrm.y, 0), W.P(a.x - nrm.x, a.y - nrm.y, bottom), W.P(a.x + nrm.x, a.y + nrm.y, bottom), Vector2.one, true);
            }
            var wgo = new GameObject("embankment", typeof(MeshFilter), typeof(MeshRenderer));
            wgo.transform.SetParent(root, false);
            wgo.GetComponent<MeshFilter>().sharedMesh = walls.ToMesh("embankment");
            var wr = wgo.GetComponent<MeshRenderer>();
            wr.sharedMaterial = Mats.Cached("embankment", () => Mats.Toon(Color.white, 0.05f, 0.2f, 0.05f, Tex.Brick(MeshKit.Hex(0xc9b48c))));
            wr.shadowCastingMode = ShadowCastingMode.Off;
        }

        // ================================================================== the bridges

        static List<G> RoadOn(float len, float wide, bool dashes = true, float x0 = 0)
        {
            var parts = new List<G> { Box(len, 0.02f, wide, WHITE, x0, TOP - 0.01f, 0) };
            foreach (int s in new[] { -1, 1 }) parts.Add(Box(len, 0.025f, 0.1f, INK, x0, TOP - 0.005f, s * (wide / 2 + 0.05f)));
            if (dashes) for (float x = -len / 2 + 0.8f; x < len / 2 - 0.6f; x += 1.6f) parts.Add(Box(0.8f, 0.025f, 0.1f, 0xc9c2b4, x0 + x + 0.4f, TOP - 0.005f, 0));
            return parts;
        }

        /// <summary>A side face of arches: a band from under the water up to the deck, with flat round-topped openings.</summary>
        static List<G> Arcade(float len, uint color, float span, float rise, float z)
        {
            var parts = new List<G>();
            float pitch = span * 1.3f;
            int n = Mathf.FloorToInt((len - 0.6f) / pitch);
            float spring = TOP - 0.16f - rise, crown = spring + rise;
            const float t = 0.22f;
            parts.Add(Box(len, TOP - crown, t, color, 0, crown, z));
            float hs = span / 2;
            // Piers between (and beyond) the openings.
            var edges = new List<float> { -len / 2 };
            for (int i = 0; i < n; i++) { float cx = (i - (n - 1) / 2f) * pitch; edges.Add(cx - hs); edges.Add(cx + hs); }
            edges.Add(len / 2);
            for (int i = 0; i + 1 < edges.Count; i += 2)
                if (edges[i + 1] - edges[i] > 0.01f) parts.Add(Box(edges[i + 1] - edges[i], crown - BASE, t, color, (edges[i] + edges[i + 1]) / 2, BASE, z));
            // The haunches: the corners above each arch's curve.
            for (int i = 0; i < n; i++)
            {
                float cx = (i - (n - 1) / 2f) * pitch;
                foreach (int s in new[] { -1, 1 })
                {
                    var sh = new Shape2().MoveTo(cx + s * hs, crown).LineTo(cx, crown);
                    for (int k = 0; k <= 8; k++) { float a = Mathf.PI / 2 - s * k / 8f * Mathf.PI / 2; sh.LineTo(cx + Mathf.Cos(a) * hs, spring + Mathf.Sin(a) * rise); }
                    parts.Add(Extrude(sh, t, color, 0, 0, z));
                }
            }
            return parts;
        }

        void Bridges()
        {
            Westminster();
            Millennium();
            TowerDeck();
        }

        Transform Place(string name, Box b)
        {
            var t = new GameObject(name).transform;
            t.SetParent(root, false);
            t.localPosition = W.P(b.x, b.z);
            return t;
        }

        void Westminster()
        {
            var bb = London.WESTMINSTER_BRIDGE;
            float w = bb.w, d = bb.d;
            var g = Place("westminster-bridge", bb);
            var parts = new List<G>
            {
                Box(w, 0.16f, d - 0.4f, WESTMINSTER_GREEN, 0, TOP - 0.16f, 0),
                Box(w, 0.015f, d - 0.6f, STONE, 0, TOP - 0.012f, 0),
            };
            parts.AddRange(RoadOn(w, d - 2.2f));
            parts.AddRange(Arcade(w, WESTMINSTER_GREEN, 2.6f, 0.12f, d / 2 - 0.11f));
            parts.AddRange(Arcade(w, WESTMINSTER_GREEN, 2.6f, 0.12f, -d / 2 + 0.11f));
            float pitch = 2.6f * 1.3f;
            int n = Mathf.FloorToInt((w - 0.6f) / pitch);
            for (int i = 0; i <= n; i++)
            {
                float x = (i - n / 2f) * pitch;
                foreach (int s in new[] { -1, 1 }) parts.Add(Box(0.55f, TOP - 0.1f - BASE, 0.3f, STONE, x, BASE, s * (d / 2 + 0.05f)));
            }
            foreach (int s in new[] { -1, 1 })
            {
                parts.Add(Box(w, 0.24f, 0.3f, WESTMINSTER_GREEN, 0, TOP, s * (d / 2 - 0.15f)));
                parts.Add(Box(w, 0.05f, 0.36f, 0x2f6b45, 0, TOP + 0.24f, s * (d / 2 - 0.15f)));
                for (int i = 0; i <= n; i++) parts.Add(Box(0.4f, 0.36f, 0.4f, STONE, (i - n / 2f) * pitch, TOP, s * (d / 2 - 0.15f)));
            }
            Emit(g, "deck", parts, 0.05f);
            // Lamp posts along both kerbs: dark green posts, three cream globes each (lit, for the bloom).
            var posts = new List<G>();
            var globes = new List<G>();
            for (float x = -w / 2 + 2; x <= w / 2 - 2; x += 4.5f)
                foreach (int s in new[] { -1, 1 })
                {
                    float z = s * (d / 2 - 0.15f);
                    posts.Add(Cyl(0.06f, 0.09f, 1.7f, 0x23402e, x, TOP + 0.1f, z, 6));
                    posts.Add(Box(0.7f, 0.06f, 0.06f, 0x23402e, x, TOP + 1.7f, z));
                    globes.Add(Sphere(0.13f, CLOCK_WHITE, x - 0.3f, TOP + 1.9f, z, 8, 6));
                    globes.Add(Sphere(0.13f, CLOCK_WHITE, x + 0.3f, TOP + 1.9f, z, 8, 6));
                    globes.Add(Sphere(0.15f, CLOCK_WHITE, x, TOP + 2.05f, z, 8, 6));
                }
            Emit(g, "lamps", posts, 0.03f);
            Emit(g, "globes", globes, 0.03f, Toon(0.7f), false, false);
        }

        void Millennium()
        {
            var bb = London.MILLENNIUM_BRIDGE;
            float w = bb.w, d = bb.d;
            var g = Place("millennium-bridge", bb);
            var parts = new List<G>
            {
                Box(w - 0.3f, 0.08f, d, SLATE, 0, TOP - 0.2f, 0),
                Box(w, 0.14f, d, SILVER, 0, TOP - 0.14f, 0),
                Box(w - 0.7f, 0.02f, d, 0xeef2f6, 0, TOP - 0.01f, 0),
            };
            for (float z = -d / 2 + 0.4f; z < d / 2; z += 0.8f) parts.Add(Box(w - 0.7f, 0.025f, 0.08f, 0xb7c0ca, 0, TOP - 0.005f, z));
            foreach (int s in new[] { -1, 1 })
            {
                parts.Add(Box(0.1f, 0.06f, d, 0x8d96a1, s * (w / 2 - 0.2f), TOP, 0));
                parts.Add(Box(0.08f, 0.06f, d, SILVER, s * (w / 2 - 0.1f), TOP + 0.45f, 0));
                for (int k = 0; k < 2; k++) parts.Add(Cyl(0.05f, 0.05f, d, 0x9aa3ad, s * (w / 2 + 0.06f), -d / 2, 0, 6).RotateX(Mathf.PI / 2).Translate(0, TOP - 0.06f - k * 0.12f, 0));
                for (float z = -d / 2 + 0.5f; z <= d / 2 - 0.5f; z += 1.5f) parts.Add(Box(0.05f, 0.45f, 0.05f, 0x9aa3ad, s * (w / 2 - 0.1f), TOP, z));
            }
            foreach (var z in new[] { -3f, 3f })
            {
                parts.Add(Cyl(0.35f, 0.45f, WATER_Y + 0.02f - BASE, STONE_DARK, 0, BASE, z, 10));
                foreach (int s in new[] { -1, 1 }) parts.Add(Box(0.14f, 1.92f, 0.14f, SILVER).RotateZ(-s * 1.46f).Translate(0, WATER_Y + 0.02f, z));
            }
            Emit(g, "deck", parts, 0.04f, Mats.Cached("londonSteel", () => Mats.Toon(Color.white, gloss: 0.9f, smooth: 0.75f, rim: 0.3f)));
        }

        /// <summary>
        /// Tower Bridge's deck: sky-blue girders, a white road, and the seam where the bascules meet. The
        /// fixed approaches and the two bascules are separate objects, each bascule hinged at its tower's
        /// leg (local x ±5.2), so the lifts can raise them without touching anything else.
        /// </summary>
        void TowerDeck()
        {
            var bb = London.TOWER_BRIDGE;
            float w = bb.w, d = bb.d;
            var g = Place("tower-bridge-deck", bb);
            float hinge = London.TOWER_BRIDGE_TOWERS[2] - bb.x; // 5.2
            List<G> Section(float x0, float x1, int seam)
            {
                float len = x1 - x0, xm = (x0 + x1) / 2;
                var parts = new List<G>
                {
                    Box(len, TOP - BASE - 0.2f, d, SKY_BLUE, xm, BASE + 0.2f, 0),
                    Box(len, 0.015f, d - 0.6f, STONE, xm, TOP - 0.012f, 0),
                };
                parts.AddRange(RoadOn(len, d - 2.2f, true, xm));
                if (seam != 0)
                {
                    // Each bascule carries its half of the joint and its steel plate.
                    parts.Add(Box(0.08f, 0.03f, d - 0.6f, INK, seam * 0.04f, TOP - 0.005f, 0));
                    parts.Add(Box(0.5f, 0.022f, d - 0.6f, 0x8d96a1, seam * 0.33f, TOP - 0.008f, 0));
                }
                foreach (int s in new[] { -1, 1 })
                {
                    parts.Add(Box(len, 0.16f, 0.3f, SKY_BLUE, xm, TOP, s * (d / 2 - 0.15f)));
                    for (float x = -w / 2 + 1; x < w / 2; x += 2)
                        if (x > x0 + 0.05f && x < x1 - 0.05f) parts.Add(Box(0.12f, TOP - BASE - 0.3f, 0.05f, NAVY, x, BASE + 0.25f, s * (d / 2 + 0.01f)));
                }
                return parts;
            }
            Emit(g, "approach-west", Section(-w / 2, -hinge, 0), 0.05f);
            Emit(g, "approach-east", Section(hinge, w / 2, 0), 0.05f);
            foreach (int side in new[] { -1, 1 })
            {
                var pivot = new GameObject(side < 0 ? "bascule-west" : "bascule-east").transform;
                pivot.SetParent(g, false);
                pivot.localPosition = U(side * hinge, 0, 0);
                // Built about the hinge: the leaf runs from the tower (x = 0) to the seam (x = ∓hinge).
                var parts = Section(side < 0 ? 0 : -hinge, side < 0 ? hinge : 0, 0);
                parts.Add(Box(0.08f, 0.03f, d - 0.6f, INK, -side * (hinge - 0.04f), TOP - 0.005f, 0));
                parts.Add(Box(0.5f, 0.022f, d - 0.6f, 0x8d96a1, -side * (hinge - 0.33f), TOP - 0.008f, 0));
                Emit(pivot, "leaf", parts, 0.05f);
                if (side < 0) BasculeWest = pivot; else BasculeEast = pivot;
            }
        }

        // ================================================================== street furniture

        sealed class Kind
        {
            public Mesh mesh;
            public float outline;
            public bool shadows;
            public Material mat;
            public readonly Dictionary<long, List<Matrix4x4>> chunks = new Dictionary<long, List<Matrix4x4>>();
        }

        readonly List<(Mesh mesh, Material mat, Matrix4x4[] m, RenderParams rp)> batches = new List<(Mesh, Material, Matrix4x4[], RenderParams)>();

        static bool Free(float x, float z, float margin = 0.8f)
        {
            if (x < B.minX + 1 || x > B.maxX - 1 || z < B.minZ + 1 || z > B.maxZ - 1) return false;
            if (!London.ClearOfSights(x, z, margin)) return false;
            if (Mathf.Abs(x - COMPASS_X) < 6.5f && Mathf.Abs(z - COMPASS_Z) < 6) return false;
            foreach (var b in London.Stage.SolidBoxes) if (Mathf.Abs(x - b.x) < b.w / 2 + margin && Mathf.Abs(z - b.z) < b.d / 2 + margin) return false;
            foreach (var b in London.BRIDGES) if (Mathf.Abs(x - b.x) < b.w / 2 + margin && Mathf.Abs(z - b.z) < b.d / 2 + margin) return false;
            foreach (var c in London.Stage.SolidCircles) if (Collide.Hypot(x - c.x, z - c.z) < c.r + margin) return false;
            return true;
        }

        static bool OffStreet(float x, float z)
        {
            foreach (var r in London.ROADS) if (London.DistanceToPath(r.path, x, z) <= r.width / 2 + 0.3f) return false;
            return true;
        }

        /// <summary>A point at fraction t along a road segment, pushed `side` metres to its left (+) or right (−); rot faces the road.</summary>
        static (float x, float z, float rot) Roadside(Road r, int seg, float t, float side)
        {
            float ax = r.X(seg), az = r.Z(seg), bx = r.X(seg + 1), bz = r.Z(seg + 1);
            float angle = Mathf.Atan2(bz - az, bx - ax), off = Mathf.Sign(side) * (r.width / 2 + Mathf.Abs(side));
            return (ax + (bx - ax) * t - Mathf.Sin(angle) * off, az + (bz - az) * t + Mathf.Cos(angle) * off, -angle + (side > 0 ? Mathf.PI : 0));
        }

        Kind MakeKind(List<G> parts, float outline, bool shadows = true, Material mat = null) =>
            new Kind { mesh = ToMesh(Merge(parts), "prop"), outline = outline, shadows = shadows, mat = mat ? mat : Toon() };

        static void Put(Kind k, float x, float z, float rot = 0, float s = 1, float y = 0)
        {
            long key = ((long)Mathf.FloorToInt(x / 64) << 32) ^ (uint)Mathf.FloorToInt(z / 64);
            if (!k.chunks.TryGetValue(key, out var list)) k.chunks[key] = list = new List<Matrix4x4>();
            // A classic-frame yaw (three's rotation.y) is the opposite turn in Unity's mirrored frame.
            list.Add(Matrix4x4.TRS(W.P(x, z, y), Quaternion.Euler(0, -rot * Mathf.Rad2Deg, 0), Vector3.one * s));
        }

        void Commit(Kind k)
        {
            foreach (var kv in k.chunks)
            {
                var list = kv.Value;
                var b = new Bounds(list[0].GetPosition(), Vector3.one);
                foreach (var m in list) b.Encapsulate(m.GetPosition());
                b.Expand(new Vector3(6, 8, 6));
                b.center += Vector3.up * 2;
                var arr = list.ToArray();
                batches.Add((k.mesh, k.mat, arr, new RenderParams(k.mat) { shadowCastingMode = k.shadows ? ShadowCastingMode.On : ShadowCastingMode.Off, receiveShadows = true, worldBounds = b }));
                if (k.outline > 0)
                {
                    var ink = LK.Outline(k.outline);
                    batches.Add((k.mesh, ink, arr, new RenderParams(ink) { shadowCastingMode = ShadowCastingMode.Off, worldBounds = b }));
                }
            }
        }

        /// <summary>Draw the instanced props (call every frame while London is shown).</summary>
        public void DrawProps()
        {
            foreach (var (mesh, _, m, rp) in batches) Graphics.RenderMeshInstanced(rp, mesh, 0, m);
        }

        void Furniture()
        {
            var rng = new Rng(1851);
            var lamp = MakeKind(new List<G> { Cyl(0.07f, 0.1f, 2.6f, 0x1d2a24, 0, 0, 0, 6), Box(0.34f, 0.42f, 0.34f, 0xfff2b8, 0, 2.6f, 0), Cone(0.3f, 0.3f, 0x1d2a24, 0, 3.02f, 0, 4) }, 0.04f);
            var rail = new List<G> { Box(2, 0.06f, 0.06f, 0x1b1b1f, 0, 0.18f, 0), Box(2, 0.06f, 0.06f, 0x1b1b1f, 0, 0.72f, 0) };
            for (float x = -0.9f; x <= 0.9f + 1e-4f; x += 0.3f) { rail.Add(Box(0.05f, 0.8f, 0.05f, 0x1b1b1f, x, 0, 0)); rail.Add(Cone(0.05f, 0.14f, GOLD, x, 0.8f, 0, 4)); }
            var railing = MakeKind(rail, 0.025f, false);
            var phone = MakeKind(new List<G>
            {
                Box(1, 2.3f, 1, BUS_RED), Box(1.1f, 0.2f, 1.1f, BUS_RED, 0, 2.3f, 0), Sphere(0.55f, BUS_RED, 0, 2.5f, 0, 8, 4, Mathf.PI * 2, Mathf.PI / 2),
                Box(0.8f, 0.18f, 0.04f, WHITE, 0, 2.05f, 0.5f), Box(0.7f, 1.3f, 0.04f, 0xbfe3f5, 0, 0.6f, 0.5f),
            }, 0.04f);
            var postbox = MakeKind(new List<G>
            {
                Cyl(0.32f, 0.32f, 1.2f, BUS_RED, 0, 0, 0, 12), Sphere(0.32f, BUS_RED, 0, 1.2f, 0, 12, 4, Mathf.PI * 2, Mathf.PI / 2),
                Box(0.36f, 0.06f, 0.06f, INK, 0, 0.95f, 0.3f), Box(0.72f, 0.1f, 0.72f, 0x1d1d1d),
            }, 0.04f);
            var shelter = MakeKind(new List<G>
            {
                Box(3, 0.1f, 1.3f, SLATE, 0, 2.3f, 0), Box(0.08f, 2.3f, 0.08f, SLATE, -1.45f, 0, -0.55f), Box(0.08f, 2.3f, 0.08f, SLATE, 1.45f, 0, -0.55f),
                Box(2.9f, 1.8f, 0.05f, 0xcfe9ee, 0, 0.4f, -0.6f), Box(1.6f, 0.3f, 0.4f, 0x8a5a3a, 0, 0.45f, -0.35f), Cyl(0.05f, 0.05f, 2.6f, SLATE, 1.9f, 0, 0.4f, 6),
                Cyl(0.32f, 0.32f, 0.08f, BUS_RED, 0, -0.04f, 0, 16).RotateX(Mathf.PI / 2).Translate(1.9f, 2.6f, 0.4f),
            }, 0.04f);
            var bel = new List<G>();
            for (int i = 0; i < 6; i++) bel.Add(Cyl(0.06f, 0.06f, 0.3f, i % 2 == 1 ? WHITE : INK, 0, i * 0.3f, 0, 6));
            bel.Add(Sphere(0.22f, 0xffa51f, 0, 2.0f, 0, 10, 8));
            var beacon = MakeKind(bel, 0.03f, true, Toon(0.35f));
            var bench = MakeKind(new List<G> { Box(1.8f, 0.08f, 0.5f, 0x9a6a3a, 0, 0.42f, 0), Box(1.8f, 0.4f, 0.08f, 0x9a6a3a, 0, 0.55f, -0.25f), Box(0.08f, 0.42f, 0.5f, 0x1d1d1d, -0.8f, 0, 0), Box(0.08f, 0.42f, 0.5f, 0x1d1d1d, 0.8f, 0, 0) }, 0.03f);
            var tree = MakeKind(new List<G> { Cyl(0.16f, 0.24f, 1.6f, 0x7a5a3a, 0, 0, 0, 6), Sphere(1.25f, 0x4f9a3e, 0, 2.5f, 0, 10, 7), Sphere(0.8f, 0x6dbb4f, 0.35f, 2.9f, 0.35f, 8, 6) }, 0.06f);
            var post = MakeKind(new List<G> { Cyl(0.06f, 0.08f, 2.4f, 0xf5f0e0, 0, 0, 0, 6), Sphere(0.1f, GOLD, 0, 2.45f, 0, 6, 4) }, 0.03f);

            foreach (var r in London.ROADS)
                for (int seg = 0; seg + 1 < r.Count; seg++)
                {
                    int n = Mathf.FloorToInt(Collide.Hypot(r.X(seg + 1) - r.X(seg), r.Z(seg + 1) - r.Z(seg)) / 9);
                    for (int i = 0; i < n; i++)
                    {
                        var p = Roadside(r, seg, (i + 0.5f) / n, (i + seg) % 2 == 1 ? 0.5f : -0.5f);
                        if (Free(p.x, p.z, 0.6f)) Put(lamp, p.x, p.z, p.rot);
                    }
                }
            foreach (var r in London.ROADS)
            {
                int last = r.Count - 2;
                var ph = Roadside(r, 0, 0.3f, 1.1f);
                if (Free(ph.x, ph.z, 1) && OffStreet(ph.x, ph.z)) Put(phone, ph.x, ph.z, ph.rot);
                var pb = Roadside(r, last, 0.7f, -0.8f);
                if (Free(pb.x, pb.z, 1) && OffStreet(pb.x, pb.z)) Put(postbox, pb.x, pb.z, pb.rot);
                if (r.id == "strand" || r.id == "embankment" || r.id == "borough" || r.id == "southbank" || r.id == "kensington")
                {
                    var bs = Roadside(r, Mathf.Min(1, last), 0.25f, 1.3f);
                    if (Free(bs.x, bs.z, 1.5f) && OffStreet(bs.x, bs.z)) Put(shelter, bs.x, bs.z, bs.rot);
                }
            }
            foreach (var zb in London.ZEBRAS)
                foreach (int s in new[] { -1, 1 })
                    foreach (var along in new[] { -1.4f, 1.4f })
                    {
                        float off = s * (zb.width / 2 + 0.4f);
                        Put(beacon, zb.x + Mathf.Cos(zb.angle) * along - Mathf.Sin(zb.angle) * off, zb.z + Mathf.Sin(zb.angle) * along + Mathf.Cos(zb.angle) * off);
                    }
            var trees = new List<(float x, float z, float rot, float s)>();
            trees.AddRange(InPark(rng, London.HYDE_PARK, 34, 2));
            trees.AddRange(InPark(rng, London.ST_JAMES, 7, 1.5f));
            trees.AddRange(InPark(rng, London.SOUTH_BANK, 8, 1.5f));
            Road emb = null;
            foreach (var r in London.ROADS) if (r.id == "embankment") emb = r;
            for (int seg = 0; seg + 1 < emb.Count; seg++)
                for (float t = 0.15f; t < 1; t += 0.35f)
                {
                    var p = Roadside(emb, seg, t, -1.6f);
                    if (Free(p.x, p.z, 0.5f) && OffStreet(p.x, p.z)) trees.Add((p.x, p.z, p.rot, 0.9f));
                }
            foreach (var t in trees) Put(tree, t.x, t.z, t.rot, t.s);
            var benches = new List<(float x, float z, float rot, float s)>();
            benches.AddRange(InPark(rng, London.HYDE_PARK, 6, 3));
            benches.AddRange(InPark(rng, London.ST_JAMES, 2, 2));
            benches.AddRange(InPark(rng, London.SOUTH_BANK, 4, 2));
            for (int seg = 0; seg + 1 < emb.Count; seg++)
            {
                var p = Roadside(emb, seg, 0.5f, -0.7f);
                if (Free(p.x, p.z, 0.5f)) benches.Add((p.x, p.z, p.rot, 1));
            }
            foreach (var b in benches) Put(bench, b.x, b.z, b.rot, b.s);
            foreach (var pk in new[] { London.HYDE_PARK, London.ST_JAMES })
                foreach (var p in Railings(pk)) Put(railing, p.x, p.z, p.rot);

            // Bunting strung between posts all round the map's printed border.
            const float o = MARGIN / 2;
            var corners = new[] { new Vector2(B.minX - o, B.minZ - o), new Vector2(B.maxX + o, B.minZ - o), new Vector2(B.maxX + o, B.maxZ + o), new Vector2(B.minX - o, B.maxZ + o) };
            var flagMesh = BuntingFlag();
            var flags = new Kind { mesh = flagMesh, mat = Mats.Cached("buntingFlag", () => { var m = Mats.Toon(Color.white, 0.1f, 0.3f, 0.1f, UnionJack(), null, false); m.SetFloat("_Cull", 0); return m; }), shadows = false };
            var strings = new MeshKit();
            strings.C = MeshKit.Hex(INK);
            for (int k = 0; k < 4; k++)
            {
                var a = corners[k]; var b = corners[(k + 1) % 4];
                int spans = Mathf.RoundToInt(Vector2.Distance(a, b) / 10);
                float rot = -Mathf.Atan2(b.y - a.y, b.x - a.x);
                for (int s = 0; s < spans; s++)
                {
                    float t0 = s / (float)spans, t1 = (s + 1) / (float)spans;
                    var pp = Vector2.Lerp(a, b, t0);
                    Put(post, pp.x, pp.y);
                    const int n = 10;
                    Vector3 prev = default;
                    for (int i = 0; i <= n; i++)
                    {
                        float t = t0 + (t1 - t0) * i / n, y = 2.25f - 0.55f * Mathf.Sin(Mathf.PI * i / n);
                        var q = Vector2.Lerp(a, b, t);
                        var cur = W.P(q.x, q.y, y);
                        if (i > 0) strings.Cylinder(prev, cur, 0.02f, 0.02f, 4, false, false);
                        prev = cur;
                        if (i > 0 && i < n)
                        {
                            long key = ((long)Mathf.FloorToInt(q.x / 64) << 32) ^ (uint)Mathf.FloorToInt(q.y / 64);
                            if (!flags.chunks.TryGetValue(key, out var list)) flags.chunks[key] = list = new List<Matrix4x4>();
                            list.Add(Matrix4x4.TRS(W.P(q.x, q.y, y), Quaternion.Euler(0, -rot * Mathf.Rad2Deg, ((i % 3) - 1) * 0.08f * Mathf.Rad2Deg), Vector3.one));
                        }
                    }
                }
            }
            var sgo = new GameObject("bunting-strings", typeof(MeshFilter), typeof(MeshRenderer));
            sgo.transform.SetParent(root, false);
            sgo.GetComponent<MeshFilter>().sharedMesh = strings.ToMesh("bunting-strings");
            sgo.GetComponent<MeshRenderer>().sharedMaterial = Mats.VertexLit;
            sgo.GetComponent<MeshRenderer>().shadowCastingMode = ShadowCastingMode.Off;

            foreach (var k in new[] { lamp, railing, phone, postbox, shelter, beacon, bench, tree, post, flags }) Commit(k);
        }

        static Mesh BuntingFlag()
        {
            // A little pennant-sized Union flag, hanging from its string (0.62 × 0.42).
            var m = new Mesh { name = "bunting-flag" };
            m.vertices = new[] { new Vector3(-0.31f, 0, 0), new Vector3(0.31f, 0, 0), new Vector3(0.31f, -0.42f, 0), new Vector3(-0.31f, -0.42f, 0) };
            m.uv = new[] { new Vector2(0, 1), new Vector2(1, 1), new Vector2(1, 0), new Vector2(0, 0) };
            m.normals = new[] { Vector3.back, Vector3.back, Vector3.back, Vector3.back };
            m.colors = new[] { Color.white, Color.white, Color.white, Color.white };
            m.triangles = new[] { 0, 1, 2, 0, 2, 3 };
            m.RecalculateBounds();
            return m;
        }

        static List<(float x, float z, float rot, float s)> InPark(Rng rng, Box p, int n, float pad)
        {
            var o = new List<(float, float, float, float)>();
            for (int tries = 0; o.Count < n && tries < n * 20; tries++)
            {
                float x = rng.Range(p.x - p.w / 2 + pad, p.x + p.w / 2 - pad), z = rng.Range(p.z - p.d / 2 + pad, p.z + p.d / 2 - pad);
                if (InEllipse(x, z, London.SERPENTINE, 2) || InEllipse(x, z, London.ST_JAMES_LAKE, 2)) continue;
                if (!Free(x, z, 1.5f) || !OffStreet(x, z)) continue;
                bool near = false;
                foreach (var q in o) if (Collide.Hypot(q.Item1 - x, q.Item2 - z) < 3.2f) { near = true; break; }
                if (near) continue;
                o.Add((x, z, rng.Range(0, Mathf.PI * 2), rng.Range(0.85f, 1.2f)));
            }
            return o;
        }

        static List<(float x, float z, float rot)> Railings(Box p)
        {
            var o = new List<(float, float, float)>();
            var sides = new[]
            {
                (p.x - p.w / 2, p.z - p.d / 2, 1f, 0f, p.w), (p.x + p.w / 2, p.z - p.d / 2, 0f, 1f, p.d),
                (p.x + p.w / 2, p.z + p.d / 2, -1f, 0f, p.w), (p.x - p.w / 2, p.z + p.d / 2, 0f, -1f, p.d),
            };
            foreach (var (x0, z0, dx, dz, len) in sides)
            {
                int n = Mathf.FloorToInt(len / 2);
                for (int i = 0; i < n; i++)
                {
                    if (i % 6 == 3) continue; // a gate
                    float t = (i + 0.5f) * (len / n);
                    float x = x0 + dx * t - dz * 0.4f, z = z0 + dz * t + dx * 0.4f;
                    if (!OffStreet(x, z) || !Free(x, z, 0.3f)) continue;
                    o.Add((x, z, -Mathf.Atan2(dz, dx)));
                }
            }
            return o;
        }

        /// <summary>The Elfin Oak: a carved tree stump full of fairies, in Kensington Gardens (the legends' glade).</summary>
        void ElfinOak()
        {
            var e = London.ELFIN_OAK;
            var t = new GameObject("elfin-oak").transform;
            t.SetParent(root, false);
            t.localPosition = W.P(e.x, e.z);
            var parts = new List<G>
            {
                Cyl(0.8f, 1.05f, 1.6f, 0x6b4a2f, 0, 0, 0, 10),
                Cyl(0.85f, 0.85f, 0.12f, 0x8a6a48, 0, 1.6f, 0, 10),
                Box(0.25f, 0.4f, 0.1f, 0xd8342c, 0.3f, 0.5f, 0.95f),
                Sphere(0.12f, 0xf2c230, -0.35f, 1.0f, 0.85f, 8, 6),
                Sphere(0.1f, 0x8cc8ec, 0.1f, 1.25f, 0.82f, 8, 6),
                Cone(0.14f, 0.3f, 0x5c9e3c, -0.2f, 0.45f, 0.95f, 6),
            };
            Emit(t, "stump", parts, 0.05f);
        }

        // ================================================================== ribbon labels

        sealed class Label { public LandmarkView v; public RectTransform rt; public CanvasGroup g; public Vector3 at; public float alpha; }
        readonly List<Label> labels = new List<Label>();
        Canvas labelCanvas;

        static readonly Dictionary<string, string> LABEL_TEXT = new Dictionary<string, string>
        {
            ["bigben"] = "BIG BEN", ["eye"] = "LONDON EYE", ["palace"] = "PALACE", ["trafalgar"] = "TRAFALGAR", ["stpauls"] = "ST PAUL'S", ["tower"] = "TOWER",
            ["towerbridge"] = "TOWER BRIDGE", ["shard"] = "SHARD", ["gherkin"] = "GHERKIN", ["globe"] = "GLOBE", ["piccadilly"] = "PICCADILLY", ["museum"] = "MUSEUM",
        };

        static Sprite ribbon, tail;

        /// <summary>The ribbon's red band (a soft-edged rounded strip) and a notched folded end.</summary>
        static void RibbonSprites()
        {
            if (ribbon) return;
            ribbon = UiKit.Rounded(14);
            const int Wt = 64, Ht = 64;
            var t = new Texture2D(Wt, Ht, TextureFormat.RGBA32, false) { filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp };
            var px = new Color32[Wt * Ht];
            for (int y = 0; y < Ht; y++)
                for (int x = 0; x < Wt; x++)
                {
                    // A notch cut into the outer (left) end: a "<" shape.
                    float u = x / (float)(Wt - 1), v = Mathf.Abs(y / (float)(Ht - 1) - 0.5f) * 2;
                    float edge = 0.38f * (1 - v);
                    float a = Mathf.Clamp01((u - edge) * Wt * 0.5f);
                    px[y * Wt + x] = new Color32(255, 255, 255, (byte)(a * 255));
                }
            t.SetPixels32(px);
            t.Apply();
            tail = Sprite.Create(t, new Rect(0, 0, Wt, Ht), new Vector2(0.5f, 0.5f));
        }

        void Labels()
        {
            RibbonSprites();
            labelCanvas = UiKit.Canvas("LondonLabels", 5);
            labelCanvas.GetComponent<GraphicRaycaster>().enabled = false;
            labelCanvas.transform.SetParent(root, false);
            var ink = MeshKit.Hex(INK);
            foreach (var v in landmarks)
            {
                string text = LABEL_TEXT[v.id];
                float w = 34 + text.Length * 19;
                var rt = UiKit.Rect(labelCanvas.transform, v.id, Vector2.zero, Vector2.zero, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(w, 46));
                var g = rt.gameObject.AddComponent<CanvasGroup>();
                g.blocksRaycasts = false;
                foreach (int s in new[] { -1, 1 })
                {
                    // The folded ends: a darker red tail, notched, peeking out behind and a little below each end.
                    var te = UiKit.Image(rt, "tail", tail, MeshKit.Hex(0xa3221d));
                    var tr = (RectTransform)te.transform;
                    tr.anchorMin = tr.anchorMax = new Vector2(s < 0 ? 0 : 1, 0.5f);
                    tr.sizeDelta = new Vector2(30, 40);
                    tr.anchoredPosition = new Vector2(s * 10, -8);
                    tr.localScale = new Vector3(s < 0 ? 1 : -1, 1, 1);
                    var ol = te.gameObject.AddComponent<Outline>();
                    ol.effectColor = ink; ol.effectDistance = new Vector2(2, -2);
                }
                var band = UiKit.Image(rt, "band", ribbon, MeshKit.Hex(0xd8342c));
                band.type = Image.Type.Sliced;
                var bo = band.gameObject.AddComponent<Outline>();
                bo.effectColor = ink; bo.effectDistance = new Vector2(2.5f, -2.5f);
                UiKit.Label(rt, "t", text, 28, MeshKit.Hex(0xfffaf0), TextAnchor.MiddleCenter, 2, ink);
                labels.Add(new Label { v = v, rt = rt, g = g, at = v.root.position + Vector3.up * v.labelY });
            }
        }

        /// <summary>Labels start to fade this far from the snake, and are gone by FAR; never above TOP_NDC (the HUD lives up there).</summary>
        const float NEAR = 42, FAR = 58, TOP_NDC = 0.66f, TOP_NDC_PORTRAIT = 0.32f, MIN_Y = 2;

        void SyncLabels(Camera cam, Vector3 focus, float dt, bool show, bool craned)
        {
            var cv = (RectTransform)labelCanvas.transform;
            var size = cv.rect.size;
            bool portrait = size.y > size.x;
            float topNdc = portrait ? TOP_NDC_PORTRAIT : TOP_NDC;
            foreach (var l in labels)
            {
                var at = l.at;
                float d = Vector2.Distance(new Vector2(at.x, at.z), new Vector2(focus.x, focus.z));
                float want = show ? Mathf.Clamp01((FAR - d) / (FAR - NEAR)) : 0;
                // Riding the Eye, the camera cranes out past the wheel: its ribbon would sit right over it.
                if (craned && l.v.id == "eye") want = 0;
                var sp = cam.WorldToViewportPoint(at);
                // Pull a ribbon down its building so it never rides into the HUD, but keep it over the roof.
                if (sp.z > 0 && sp.y * 2 - 1 > topNdc)
                {
                    var baseVp = cam.WorldToViewportPoint(l.v.root.position + Vector3.up * MIN_Y);
                    float targetY = (topNdc + 1) / 2;
                    if (baseVp.y < targetY) sp.y = targetY;
                    else sp.y = baseVp.y;
                }
                if (sp.z <= 0 || sp.x < -0.2f || sp.x > 1.2f || sp.y < -0.1f) want = 0;
                l.alpha = Mathf.MoveTowards(l.alpha, want, dt * 3);
                l.g.alpha = l.alpha;
                l.rt.gameObject.SetActive(l.alpha > 0.01f);
                l.rt.anchoredPosition = new Vector2(sp.x * size.x, sp.y * size.y);
            }
        }

        // ================================================================== every frame

        /// <summary>
        /// Run London's life: the landmarks' animations, the props, the ribbons, and the see-through fade
        /// of any landmark between the camera and the snake's head (or that the camera is inside).
        /// </summary>
        public void Sync(Camera cam, Vector3 head, bool watching, bool labelsOn, float time, float dt, bool craned = false)
        {
            foreach (var v in landmarks) v.Animate?.Invoke(time);
            DrawProps();
            var camPos = cam.transform.position;
            var ray = new Ray(head + Vector3.up * 0.6f, (camPos - head - Vector3.up * 0.6f).normalized);
            float span = Vector3.Distance(camPos, ray.origin);
            foreach (var f in faders)
            {
                float want = 1;
                if (watching)
                {
                    if (f.bounds.Contains(camPos)) want = 0;
                    else if (f.bounds.IntersectRay(ray, out float hit) && hit < span && !f.bounds.Contains(ray.origin)) want = 0.3f;
                }
                float nf = Mathf.MoveTowards(f.fade, want, dt * 3.5f);
                if (Mathf.Approximately(nf, f.fade) && nf >= 1) continue;
                bool was = f.fade < 0.999f;
                f.fade = nf;
                bool faded = nf < 0.999f;
                for (int i = 0; i < f.renderers.Count; i++)
                {
                    var r = f.renderers[i];
                    if (!r) continue;
                    r.GetPropertyBlock(block);
                    block.SetFloat("_Fade", nf);
                    r.SetPropertyBlock(block);
                    // See-through: no solid shadow on the street either.
                    if (faded != was) r.shadowCastingMode = faded || !f.casts[i] ? ShadowCastingMode.Off : ShadowCastingMode.On;
                }
            }
            SyncLabels(cam, head, dt, labelsOn, craned);
        }

        /// <summary>One of the twelve sights by id (null if unknown): the postcards photograph them.</summary>
        public LandmarkView Landmark(string id) => landmarks.Find(l => l.id == id);

        public void SetLabelsActive(bool on) { if (labelCanvas) labelCanvas.gameObject.SetActive(on); }
    }
}
