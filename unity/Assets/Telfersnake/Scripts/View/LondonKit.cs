using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace Telfer.View
{
    /// <summary>
    /// A piece of London geometry, built in the classic game's own frame (three.js: +x east, +y up,
    /// +z SOUTH) so the landmark builders port from src/render/london/landmarks/*.ts number for number.
    /// The transforms follow three's BufferGeometry methods (rotateX/Y/Z, translate, scale, all applied
    /// to the vertices, in call order). <see cref="LK.Emit"/> turns parts into a Unity mesh, flipping z.
    /// </summary>
    public sealed class G
    {
        public readonly List<Vector3> P = new List<Vector3>(), N = new List<Vector3>();
        public readonly List<Color> C = new List<Color>();
        public readonly List<int> T = new List<int>();

        public int Add(Vector3 p, Vector3 n, Color c) { P.Add(p); N.Add(n); C.Add(c); return P.Count - 1; }
        public void Tri(int a, int b, int c) { T.Add(a); T.Add(b); T.Add(c); }

        public G Translate(float x, float y, float z)
        {
            var d = new Vector3(x, y, z);
            for (int i = 0; i < P.Count; i++) P[i] += d;
            return this;
        }

        public G Translate(Vector3 d) => Translate(d.x, d.y, d.z);

        static Vector3 RX(Vector3 v, float c, float s) => new Vector3(v.x, v.y * c - v.z * s, v.y * s + v.z * c);
        static Vector3 RY(Vector3 v, float c, float s) => new Vector3(v.x * c + v.z * s, v.y, -v.x * s + v.z * c);
        static Vector3 RZ(Vector3 v, float c, float s) => new Vector3(v.x * c - v.y * s, v.x * s + v.y * c, v.z);

        public G RotateX(float a) { float c = Mathf.Cos(a), s = Mathf.Sin(a); for (int i = 0; i < P.Count; i++) { P[i] = RX(P[i], c, s); N[i] = RX(N[i], c, s); } return this; }
        public G RotateY(float a) { float c = Mathf.Cos(a), s = Mathf.Sin(a); for (int i = 0; i < P.Count; i++) { P[i] = RY(P[i], c, s); N[i] = RY(N[i], c, s); } return this; }
        public G RotateZ(float a) { float c = Mathf.Cos(a), s = Mathf.Sin(a); for (int i = 0; i < P.Count; i++) { P[i] = RZ(P[i], c, s); N[i] = RZ(N[i], c, s); } return this; }

        public G Scale(float x, float y, float z)
        {
            for (int i = 0; i < P.Count; i++)
            {
                P[i] = new Vector3(P[i].x * x, P[i].y * y, P[i].z * z);
                N[i] = new Vector3(N[i].x / x, N[i].y / y, N[i].z / z).normalized;
            }
            return this;
        }

        public G Scale(float k) => Scale(k, k, k);

        /// <summary>Rotate by a rotation expressed in the classic (right-handed) frame.</summary>
        public G Rotate(Matrix4x4 m)
        {
            for (int i = 0; i < P.Count; i++) { P[i] = m.MultiplyPoint3x4(P[i]); N[i] = m.MultiplyVector(N[i]).normalized; }
            return this;
        }

        public G Paint(uint hex)
        {
            var c = MeshKit.Hex(hex);
            for (int i = 0; i < C.Count; i++) C[i] = c;
            return this;
        }

        public G Clone()
        {
            var g = new G();
            g.P.AddRange(P); g.N.AddRange(N); g.C.AddRange(C); g.T.AddRange(T);
            return g;
        }

        public void Append(G o)
        {
            int b = P.Count;
            P.AddRange(o.P); N.AddRange(o.N); C.AddRange(o.C);
            foreach (var t in o.T) T.Add(b + t);
        }

        /// <summary>One normal per face (three's computeVertexNormals on a non-indexed mesh): the faceted look.</summary>
        public G Flat()
        {
            var g = new G();
            for (int t = 0; t < T.Count; t += 3)
            {
                Vector3 a = P[T[t]], b = P[T[t + 1]], c = P[T[t + 2]];
                var n = Vector3.Cross(b - a, c - a).normalized;
                g.Tri(g.Add(a, n, C[T[t]]), g.Add(b, n, C[T[t + 1]]), g.Add(c, n, C[T[t + 2]]));
            }
            return g;
        }

        public Bounds Bounds()
        {
            if (P.Count == 0) return new Bounds();
            var b = new Bounds(P[0], Vector3.zero);
            foreach (var p in P) b.Encapsulate(p);
            return b;
        }
    }

    /// <summary>A flat 2D outline (x across, y up) for extruding: gables, arches, wings (three's Shape, no holes).</summary>
    public sealed class Shape2
    {
        public readonly List<Vector2> Pts = new List<Vector2>();
        Vector2 cur;
        const int CURVE = 12;

        public Shape2 MoveTo(float x, float y) { cur = new Vector2(x, y); Pts.Add(cur); return this; }
        public Shape2 LineTo(float x, float y) { cur = new Vector2(x, y); Pts.Add(cur); return this; }

        public Shape2 QuadTo(float cx, float cy, float x, float y)
        {
            var a = cur; var c = new Vector2(cx, cy); var b = new Vector2(x, y);
            for (int i = 1; i <= CURVE; i++)
            {
                float t = i / (float)CURVE;
                Pts.Add((1 - t) * (1 - t) * a + 2 * (1 - t) * t * c + t * t * b);
            }
            cur = b;
            return this;
        }

        /// <summary>An arc round (cx, cy) from a0 to a1 (radians, anticlockwise unless `clockwise`), joined to the pen.</summary>
        public Shape2 AbsArc(float cx, float cy, float r, float a0, float a1, bool clockwise = false) => AbsEllipse(cx, cy, r, r, a0, a1, clockwise);

        public Shape2 AbsEllipse(float cx, float cy, float rx, float ry, float a0, float a1, bool clockwise = false)
        {
            float span = a1 - a0;
            if (!clockwise && span < 0) span += Mathf.PI * 2;
            if (clockwise && span > 0) span -= Mathf.PI * 2;
            for (int i = 0; i <= CURVE; i++)
            {
                float a = a0 + span * i / CURVE;
                cur = new Vector2(cx + Mathf.Cos(a) * rx, cy + Mathf.Sin(a) * ry);
                Pts.Add(cur);
            }
            return this;
        }

        /// <summary>The outline, de-duplicated and anticlockwise.</summary>
        public List<Vector2> Clean()
        {
            var o = new List<Vector2>();
            foreach (var p in Pts) if (o.Count == 0 || (o[o.Count - 1] - p).sqrMagnitude > 1e-8f) o.Add(p);
            if (o.Count > 1 && (o[0] - o[o.Count - 1]).sqrMagnitude < 1e-8f) o.RemoveAt(o.Count - 1);
            float area = 0;
            for (int i = 0; i < o.Count; i++) { var a = o[i]; var b = o[(i + 1) % o.Count]; area += a.x * b.y - b.x * a.y; }
            if (area < 0) o.Reverse();
            return o;
        }
    }

    /// <summary>
    /// The London kit (port of landmarks/kit.ts): small vertex-coloured geometry helpers in the classic
    /// frame, the palette, and Emit, which makes a toon mesh with its ink outline. Helpers stand on `y`
    /// (box, cyl, cone, lathe, windows, crenellations); sphere is centred on y.
    /// </summary>
    public static class LK
    {
        // ------------------------------------------------------------------ the map's colours
        public const uint INK = 0x2b2118, PAPER = 0xf8f1df, STREET = 0xffffff, PARK = 0x8fd16a, PARK_EDGE = 0x4f9a3e, SAND = 0xefcf86;
        public const uint THAMES = 0x1f8a96, THAMES_LIGHT = 0x6fd0cf, STONE = 0xd9cdb3, STONE_DARK = 0xa89c86, HONEY = 0xe2b85c, CLOCK_WHITE = 0xfffbea;
        public const uint GOLD = 0xf2c230, PALACE_CREAM = 0xf1e6cc, GUARD_RED = 0xd8342c, BUS_RED = 0xd62d20, NAVY = 0x1f3264, SKY_BLUE = 0x8cc8ec;
        public const uint BRIDGE_GREY = 0xb8b4ab, WESTMINSTER_GREEN = 0x3f8a5a, SILVER = 0xd3dae2, GLASS_BLUE = 0x8ec9ea, PICKLE_GREEN = 0x5c9e3c;
        public const uint DOME_GREY = 0xc9ccd0, EYE_WHITE = 0xf7f7f2, TERRACOTTA = 0xc9714b, THATCH = 0xc9a25a, TIMBER = 0x5a3a24, SLATE = 0x5d6470, WHITE = 0xffffff;

        static Color Col(uint hex) => MeshKit.Hex(hex);

        // ------------------------------------------------------------------ primitives (three's geometry, vertex for vertex)

        /// <summary>A box w × h × d, standing on y.</summary>
        public static G Box(float w, float h, float d, uint color, float x = 0, float y = 0, float z = 0, float rotY = 0)
        {
            var g = new G();
            var c = Col(color);
            void Face(Vector3 n, Vector3 u, Vector3 v)
            {
                var o = n * 0.5f;
                int a = g.Add(Vector3.Scale(o - u * 0.5f - v * 0.5f, new Vector3(w, h, d)), n, c);
                int b = g.Add(Vector3.Scale(o + u * 0.5f - v * 0.5f, new Vector3(w, h, d)), n, c);
                int e = g.Add(Vector3.Scale(o + u * 0.5f + v * 0.5f, new Vector3(w, h, d)), n, c);
                int f = g.Add(Vector3.Scale(o - u * 0.5f + v * 0.5f, new Vector3(w, h, d)), n, c);
                g.Tri(a, b, e); g.Tri(a, e, f);
            }
            // u × v = n, so each face winds anticlockwise seen from outside (three's front face).
            Face(Vector3.right, Vector3.up, Vector3.forward);
            Face(Vector3.left, Vector3.forward, Vector3.up);
            Face(Vector3.up, Vector3.forward, Vector3.right);
            Face(Vector3.down, Vector3.right, Vector3.forward);
            Face(Vector3.forward, Vector3.right, Vector3.up);
            Face(Vector3.back, Vector3.up, Vector3.right);
            g.Translate(0, h / 2, 0);
            if (rotY != 0) g.RotateY(rotY);
            return g.Translate(x, y, z);
        }

        /// <summary>A cylinder (or a tapered drum) of three's CylinderGeometry, centred on the origin.</summary>
        static G Cylinder(float rTop, float rBot, float h, int seg, uint color, bool capTop = true, bool capBot = true)
        {
            var g = new G();
            var c = Col(color);
            float slope = (rBot - rTop) / h;
            var top = new int[seg + 1];
            var bot = new int[seg + 1];
            for (int i = 0; i <= seg; i++)
            {
                float th = i / (float)seg * Mathf.PI * 2, s = Mathf.Sin(th), co = Mathf.Cos(th);
                var n = new Vector3(s, slope, co).normalized;
                top[i] = g.Add(new Vector3(rTop * s, h / 2, rTop * co), n, c);
                bot[i] = g.Add(new Vector3(rBot * s, -h / 2, rBot * co), n, c);
            }
            for (int i = 0; i < seg; i++) { g.Tri(top[i], bot[i], top[i + 1]); g.Tri(bot[i], bot[i + 1], top[i + 1]); }
            void Cap(float r, float y, bool up)
            {
                if (r <= 0) return;
                var n = up ? Vector3.up : Vector3.down;
                int mid = g.Add(new Vector3(0, y, 0), n, c);
                var ring = new int[seg + 1];
                for (int i = 0; i <= seg; i++)
                {
                    float th = i / (float)seg * Mathf.PI * 2;
                    ring[i] = g.Add(new Vector3(r * Mathf.Sin(th), y, r * Mathf.Cos(th)), n, c);
                }
                for (int i = 0; i < seg; i++) { if (up) g.Tri(mid, ring[i], ring[i + 1]); else g.Tri(mid, ring[i + 1], ring[i]); }
            }
            if (capTop) Cap(rTop, h / 2, true);
            if (capBot) Cap(rBot, -h / 2, false);
            return g;
        }

        /// <summary>A cylinder (or a tapered drum), standing on y.</summary>
        public static G Cyl(float rTop, float rBot, float h, uint color, float x = 0, float y = 0, float z = 0, int seg = 16) =>
            Cylinder(rTop, rBot, h, seg, color).Translate(0, h / 2, 0).Translate(x, y, z);

        /// <summary>A cone (a spire, a turret cap), standing on y. Four segments make a pyramid roof.</summary>
        public static G Cone(float r, float h, uint color, float x = 0, float y = 0, float z = 0, int seg = 16) =>
            Cylinder(0, r, h, seg, color).Translate(0, h / 2, 0).Translate(x, y, z);

        /// <summary>A sphere centred on y; thetaLen π/2 is a dome (its base then at y), phiLen cuts a wedge.</summary>
        public static G Sphere(float r, uint color, float x = 0, float y = 0, float z = 0, int wSeg = 16, int hSeg = 12, float phiLen = Mathf.PI * 2, float thetaLen = Mathf.PI, float phiStart = 0)
        {
            var g = new G();
            var c = Col(color);
            var grid = new int[hSeg + 1, wSeg + 1];
            for (int iy = 0; iy <= hSeg; iy++)
            {
                float th = iy / (float)hSeg * thetaLen;
                for (int ix = 0; ix <= wSeg; ix++)
                {
                    float ph = phiStart + ix / (float)wSeg * phiLen;
                    var p = new Vector3(-r * Mathf.Cos(ph) * Mathf.Sin(th), r * Mathf.Cos(th), r * Mathf.Sin(ph) * Mathf.Sin(th));
                    grid[iy, ix] = g.Add(p, p.sqrMagnitude > 0 ? p.normalized : Vector3.up, c);
                }
            }
            for (int iy = 0; iy < hSeg; iy++)
                for (int ix = 0; ix < wSeg; ix++)
                {
                    int a = grid[iy, ix + 1], b = grid[iy, ix], cc = grid[iy + 1, ix], d = grid[iy + 1, ix + 1];
                    if (iy != 0) g.Tri(a, b, d);
                    if (iy != hSeg - 1 || thetaLen < Mathf.PI - 1e-4f) g.Tri(b, cc, d);
                }
            return g.Translate(x, y, z);
        }

        /// <summary>A turned profile ((radius, height) pairs, bottom to top) spun round the vertical, standing on y.</summary>
        public static G Lathe(float[] pts, uint color, float x = 0, float y = 0, float z = 0, int seg = 24)
        {
            var g = new G();
            var c = Col(color);
            int n = pts.Length / 2;
            var idx = new int[seg + 1, n];
            for (int i = 0; i <= seg; i++)
            {
                float ph = i / (float)seg * Mathf.PI * 2, s = Mathf.Sin(ph), co = Mathf.Cos(ph);
                for (int j = 0; j < n; j++) idx[i, j] = g.Add(new Vector3(pts[j * 2] * s, pts[j * 2 + 1], pts[j * 2] * co), Vector3.zero, c);
            }
            for (int i = 0; i < seg; i++)
                for (int j = 0; j < n - 1; j++)
                {
                    int a = idx[i, j], b = idx[i + 1, j], cc = idx[i + 1, j + 1], d = idx[i, j + 1];
                    g.Tri(a, b, d); g.Tri(cc, d, b);
                }
            SmoothNormals(g);
            return g.Translate(x, y, z);
        }

        /// <summary>three's TorusGeometry: a ring in the XY plane round the origin; `arc` &lt; 2π makes a bent tube.</summary>
        public static G Torus(float R, float tube, int radial, int tubular, uint color, float arc = Mathf.PI * 2)
        {
            var g = new G();
            var c = Col(color);
            for (int j = 0; j <= radial; j++)
                for (int i = 0; i <= tubular; i++)
                {
                    float u = i / (float)tubular * arc, v = j / (float)radial * Mathf.PI * 2;
                    var p = new Vector3((R + tube * Mathf.Cos(v)) * Mathf.Cos(u), (R + tube * Mathf.Cos(v)) * Mathf.Sin(u), tube * Mathf.Sin(v));
                    var centre = new Vector3(R * Mathf.Cos(u), R * Mathf.Sin(u), 0);
                    g.Add(p, (p - centre).normalized, c);
                }
            for (int j = 1; j <= radial; j++)
                for (int i = 1; i <= tubular; i++)
                {
                    int a = (tubular + 1) * j + i - 1, b = (tubular + 1) * (j - 1) + i - 1, cc = (tubular + 1) * (j - 1) + i, d = (tubular + 1) * j + i;
                    g.Tri(a, b, d); g.Tri(b, cc, d);
                }
            return g;
        }

        /// <summary>A tube of radius r along points (a chain, a tail), `seg` steps along and `radial` round.</summary>
        public static G Tube(List<Vector3> path, float r, int radial, uint color)
        {
            var g = new G();
            var c = Col(color);
            int n = path.Count;
            var up = Vector3.up;
            for (int i = 0; i < n; i++)
            {
                var t = (path[Mathf.Min(n - 1, i + 1)] - path[Mathf.Max(0, i - 1)]).normalized;
                var side = Vector3.Cross(t, up);
                if (side.sqrMagnitude < 1e-6f) side = Vector3.Cross(t, Vector3.right);
                side.Normalize();
                var other = Vector3.Cross(side, t).normalized;
                for (int k = 0; k <= radial; k++)
                {
                    float a = k / (float)radial * Mathf.PI * 2;
                    var nrm = side * Mathf.Cos(a) + other * Mathf.Sin(a);
                    g.Add(path[i] + nrm * r, nrm, c);
                }
            }
            for (int i = 0; i < n - 1; i++)
                for (int k = 0; k < radial; k++)
                {
                    int a = i * (radial + 1) + k, b = a + radial + 1;
                    Tri(g, a, b, a + 1, g.N[a]);
                    Tri(g, a + 1, b, b + 1, g.N[a + 1]);
                }
            return g;
        }

        /// <summary>Add a triangle, wound so it faces `want` (three's anticlockwise front).</summary>
        static void Tri(G g, int a, int b, int c, Vector3 want)
        {
            var n = Vector3.Cross(g.P[b] - g.P[a], g.P[c] - g.P[a]);
            if (Vector3.Dot(n, want) < 0) g.Tri(a, c, b); else g.Tri(a, b, c);
        }

        static void SmoothNormals(G g)
        {
            var acc = new Vector3[g.P.Count];
            for (int t = 0; t < g.T.Count; t += 3)
            {
                int a = g.T[t], b = g.T[t + 1], c = g.T[t + 2];
                var n = Vector3.Cross(g.P[b] - g.P[a], g.P[c] - g.P[a]);
                acc[a] += n; acc[b] += n; acc[c] += n;
            }
            // Weld the seam (and the poles) by position so a turned profile shades round.
            var byPos = new Dictionary<Vector3Int, Vector3>();
            for (int i = 0; i < acc.Length; i++)
            {
                var k = Key(g.P[i]);
                byPos.TryGetValue(k, out var s);
                byPos[k] = s + acc[i];
            }
            for (int i = 0; i < acc.Length; i++)
            {
                var n = byPos[Key(g.P[i])];
                g.N[i] = n.sqrMagnitude > 1e-12f ? n.normalized : Vector3.up;
            }
        }

        static Vector3Int Key(Vector3 p) => new Vector3Int(Mathf.RoundToInt(p.x * 1000), Mathf.RoundToInt(p.y * 1000), Mathf.RoundToInt(p.z * 1000));

        /// <summary>A flat shape (x across, y up) extruded `depth` along z and centred on it; rotY turns it about its origin.</summary>
        public static G Extrude(Shape2 shape, float depth, uint color, float x = 0, float y = 0, float z = 0, float rotY = 0)
        {
            var pts = shape.Clean();
            var g = new G();
            var c = Col(color);
            float z0 = -depth / 2, z1 = depth / 2;
            var tris = Triangulate(pts);
            int bf = g.P.Count;
            foreach (var p in pts) g.Add(new Vector3(p.x, p.y, z1), Vector3.forward, c);
            int bb = g.P.Count;
            foreach (var p in pts) g.Add(new Vector3(p.x, p.y, z0), Vector3.back, c);
            for (int t = 0; t < tris.Count; t += 3)
            {
                g.Tri(bf + tris[t], bf + tris[t + 1], bf + tris[t + 2]);
                g.Tri(bb + tris[t], bb + tris[t + 2], bb + tris[t + 1]);
            }
            for (int i = 0; i < pts.Count; i++)
            {
                var a = pts[i]; var b = pts[(i + 1) % pts.Count];
                var e = b - a;
                var n = new Vector3(e.y, -e.x, 0).normalized;
                int i0 = g.Add(new Vector3(a.x, a.y, z0), n, c), i1 = g.Add(new Vector3(b.x, b.y, z0), n, c);
                int i2 = g.Add(new Vector3(b.x, b.y, z1), n, c), i3 = g.Add(new Vector3(a.x, a.y, z1), n, c);
                Tri(g, i0, i1, i2, n); Tri(g, i0, i2, i3, n);
            }
            if (rotY != 0) g.RotateY(rotY);
            return g.Translate(x, y, z);
        }

        /// <summary>Ear-clipping for a simple anticlockwise polygon.</summary>
        static List<int> Triangulate(List<Vector2> p)
        {
            var res = new List<int>();
            var idx = new List<int>();
            for (int i = 0; i < p.Count; i++) idx.Add(i);
            int guard = 0;
            while (idx.Count > 3 && guard++ < 10000)
            {
                bool clipped = false;
                for (int i = 0; i < idx.Count; i++)
                {
                    int ia = idx[(i + idx.Count - 1) % idx.Count], ib = idx[i], ic = idx[(i + 1) % idx.Count];
                    Vector2 a = p[ia], b = p[ib], c = p[ic];
                    float cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
                    if (cross <= 1e-9f) continue;
                    bool inside = false;
                    foreach (int j in idx)
                    {
                        if (j == ia || j == ib || j == ic) continue;
                        if (InTri(p[j], a, b, c)) { inside = true; break; }
                    }
                    if (inside) continue;
                    res.Add(ia); res.Add(ib); res.Add(ic);
                    idx.RemoveAt(i);
                    clipped = true;
                    break;
                }
                if (!clipped) break;
            }
            if (idx.Count == 3) { res.Add(idx[0]); res.Add(idx[1]); res.Add(idx[2]); }
            return res;
        }

        static bool InTri(Vector2 p, Vector2 a, Vector2 b, Vector2 c)
        {
            float d1 = (p.x - b.x) * (a.y - b.y) - (a.x - b.x) * (p.y - b.y);
            float d2 = (p.x - c.x) * (b.y - c.y) - (b.x - c.x) * (p.y - c.y);
            float d3 = (p.x - a.x) * (c.y - a.y) - (c.x - a.x) * (p.y - a.y);
            bool neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
            return !(neg && pos);
        }

        /// <summary>A grid of window panes on a wall face, as thin slabs just proud of it (kit.ts windows).</summary>
        public static G Windows(int cols, int rows, float cellW, float cellH, uint color, float winW = -1, float winH = -1, float x = 0, float y = 0, float z = 0, float rotY = 0, bool arched = false)
        {
            if (winW < 0) winW = cellW * 0.55f;
            if (winH < 0) winH = cellH * 0.55f;
            var g = new G();
            const float depth = 0.08f;
            for (int r = 0; r < rows; r++)
                for (int k = 0; k < cols; k++)
                {
                    float cx = (k - (cols - 1) / 2f) * cellW;
                    float cy = r * cellH + (cellH - winH) / 2;
                    if (arched)
                    {
                        float hw = winW / 2, straight = Mathf.Max(0, winH - hw);
                        var s = new Shape2().MoveTo(-hw, 0).LineTo(hw, 0).LineTo(hw, straight).AbsArc(0, straight, hw, 0, Mathf.PI).LineTo(-hw, 0);
                        g.Append(Extrude(s, depth, color).Translate(cx, cy, depth / 2));
                    }
                    else g.Append(Box(winW, winH, depth, color).Translate(cx, cy, depth / 2));
                }
            if (rotY != 0) g.RotateY(rotY);
            return g.Translate(x, y, z);
        }

        /// <summary>Castle battlements round the top of a w × d block centred on (x, z), standing on y.</summary>
        public static G Crenellations(float w, float d, uint color, float x = 0, float y = 0, float z = 0, float size = 0.5f)
        {
            var g = new G();
            float t = size * 0.8f;
            void Along(float len, System.Func<float, G> fn)
            {
                int n = Mathf.Max(1, Mathf.FloorToInt(len / (size * 2)));
                float step = len / n;
                for (int i = 0; i < n; i++) g.Append(fn(-len / 2 + step * (i + 0.5f)));
            }
            Along(w, p => Box(size, size, t, color, x + p, y, z - d / 2 + t / 2));
            Along(w, p => Box(size, size, t, color, x + p, y, z + d / 2 - t / 2));
            Along(d, p => Box(t, size, size, color, x - w / 2 + t / 2, y, z + p));
            Along(d, p => Box(t, size, size, color, x + w / 2 - t / 2, y, z + p));
            return g;
        }

        /// <summary>A thin box from a to b (a strut, a spoke, a leg).</summary>
        public static G Beam(Vector3 a, Vector3 b, float t, uint color, float tz = -1)
        {
            if (tz < 0) tz = t;
            var dir = b - a;
            var g = Box(t, dir.magnitude, tz, color);
            g.Rotate(Matrix4x4.Rotate(Quaternion.FromToRotation(Vector3.up, dir.normalized)));
            return g.Translate(a);
        }

        /// <summary>A square pyramid of half-width hw (a 4-sided cone with its corners turned to the box's).</summary>
        public static G Pyramid(float hw, float hd, float h, uint color, float x, float y, float z)
        {
            const float S = 0.70710678f;
            return Cone(1, h, color, 0, 0, 0, 4).RotateY(Mathf.PI / 4).Scale(hw / S, 1, hd / S).Translate(x, y, z);
        }

        public static G Merge(IEnumerable<G> parts)
        {
            var g = new G();
            foreach (var p in parts) g.Append(p);
            return g;
        }

        // ------------------------------------------------------------------ curves

        public static Vector3 Bezier(Vector3 a, Vector3 b, Vector3 c, Vector3 d, float t)
        {
            float u = 1 - t;
            return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
        }

        /// <summary>A Catmull-Rom curve through `pts` (three's CatmullRomCurve3, centripetal), at t in [0, 1].</summary>
        public static Vector3 CatmullRom(IList<Vector3> pts, float t)
        {
            int n = pts.Count;
            float p = (n - 1) * t;
            int i = Mathf.Min(n - 2, Mathf.FloorToInt(p));
            float w = p - i;
            Vector3 p0 = i > 0 ? pts[i - 1] : 2 * pts[0] - pts[1];
            Vector3 p1 = pts[i], p2 = pts[i + 1];
            Vector3 p3 = i + 2 < n ? pts[i + 2] : 2 * pts[n - 1] - pts[n - 2];
            float d0 = Mathf.Pow((p1 - p0).sqrMagnitude, 0.25f), d1 = Mathf.Pow((p2 - p1).sqrMagnitude, 0.25f), d2 = Mathf.Pow((p3 - p2).sqrMagnitude, 0.25f);
            if (d1 < 1e-4f) d1 = 1;
            if (d0 < 1e-4f) d0 = d1;
            if (d2 < 1e-4f) d2 = d1;
            var t1 = ((p1 - p0) / d0 - (p2 - p0) / (d0 + d1) + (p2 - p1) / d1) * d1;
            var t2 = ((p2 - p1) / d1 - (p3 - p1) / (d1 + d2) + (p3 - p2) / d2) * d1;
            float w2 = w * w, w3 = w2 * w;
            return (2 * w3 - 3 * w2 + 1) * p1 + (w3 - 2 * w2 + w) * t1 + (-2 * w3 + 3 * w2) * p2 + (w3 - w2) * t2;
        }

        // ------------------------------------------------------------------ into Unity

        /// <summary>
        /// Turn classic-frame parts into a Unity mesh: z flipped, and every triangle turned over (a mirror
        /// flips the winding, and both engines face a triangle along the right-handed cross product of its
        /// edges). The smooth (welded) normals ride in uv3 for the ink outline, which pushes the hull out along them.
        /// </summary>
        public static Mesh ToMesh(G g, string name)
        {
            var v = new Vector3[g.P.Count];
            var n = new Vector3[g.P.Count];
            for (int i = 0; i < v.Length; i++) { v[i] = new Vector3(g.P[i].x, g.P[i].y, -g.P[i].z); n[i] = new Vector3(g.N[i].x, g.N[i].y, -g.N[i].z); }
            var smooth = new Vector3[v.Length];
            var acc = new Dictionary<Vector3Int, Vector3>();
            for (int i = 0; i < v.Length; i++) { var k = Key(v[i]); acc.TryGetValue(k, out var s); acc[k] = s + n[i]; }
            for (int i = 0; i < v.Length; i++) { var s = acc[Key(v[i])]; smooth[i] = s.sqrMagnitude > 1e-10f ? s.normalized : n[i]; }
            var m = new Mesh { name = name, indexFormat = v.Length > 65000 ? IndexFormat.UInt32 : IndexFormat.UInt16 };
            m.SetVertices(v);
            m.SetNormals(n);
            m.SetColors(g.C);
            m.SetUVs(3, smooth);
            var tris = new int[g.T.Count];
            for (int t = 0; t < tris.Length; t += 3) { tris[t] = g.T[t]; tris[t + 1] = g.T[t + 2]; tris[t + 2] = g.T[t + 1]; }
            m.SetTriangles(tris, 0);
            m.RecalculateBounds();
            return m;
        }

        static Shader outlineShader;
        static readonly Dictionary<int, Material> outlines = new Dictionary<int, Material>();

        /// <summary>The ink hull: pushed out `thickness` metres along the smooth normals, back faces only.</summary>
        public static Material Outline(float thickness)
        {
            int key = Mathf.RoundToInt(thickness * 1000);
            if (outlines.TryGetValue(key, out var m) && m) return m;
            if (!outlineShader) outlineShader = Shader.Find("Telfer/Outline");
            m = new Material(outlineShader) { name = "Ink", enableInstancing = true };
            m.SetColor("_Color", MeshKit.Hex(INK));
            m.SetFloat("_Thickness", thickness);
            return outlines[key] = m;
        }

        /// <summary>The landmarks' toon material (and a self-lit one for clock faces and screens).</summary>
        public static Material Toon(float glow = 0)
        {
            if (glow <= 0) return Mats.Cached("londonToon", () => Mats.Toon(Color.white, gloss: 0.15f, smooth: 0.35f, rim: 0.22f));
            return Mats.Cached("londonGlow" + glow, () =>
            {
                var m = Mats.Toon(Color.white, gloss: 0.3f, smooth: 0.6f, rim: 0.1f);
                m.SetColor("_EmissionColor", new Color(glow, glow, glow * 0.9f));
                return m;
            });
        }

        /// <summary>
        /// Merge parts → a toon mesh with its ink outline (inked() in kit.ts), as a child of `parent` at
        /// `local` (classic frame). thickness 0 draws no outline.
        /// </summary>
        public static MeshRenderer Emit(Transform parent, string name, IEnumerable<G> parts, float thickness, Material mat = null, bool flat = false, bool shadows = true)
        {
            var g = Merge(parts);
            if (flat) g = g.Flat();
            var go = new GameObject(name, typeof(MeshFilter), typeof(MeshRenderer));
            go.transform.SetParent(parent, false);
            go.GetComponent<MeshFilter>().sharedMesh = ToMesh(g, name);
            var r = go.GetComponent<MeshRenderer>();
            mat = mat ? mat : Toon();
            r.sharedMaterials = thickness > 0 ? new[] { mat, Outline(thickness) } : new[] { mat };
            r.shadowCastingMode = shadows ? ShadowCastingMode.On : ShadowCastingMode.Off;
            return r;
        }

        static Texture2D unionTex;

        /// <summary>The Union flag, painted once (120 × 60, as palace.ts draws it).</summary>
        public static Texture2D UnionJack()
        {
            if (unionTex) return unionTex;
            const int Wt = 120, Ht = 60;
            var px = new Color32[Wt * Ht];
            Color32 blue = MeshKit.Hex(0x012169), red = MeshKit.Hex(0xc8102e), white = Color.white;
            for (int y = 0; y < Ht; y++)
                for (int x = 0; x < Wt; x++)
                {
                    float fx = x + 0.5f, fy = y + 0.5f;
                    // Distance to each diagonal (in pixels).
                    float d1 = Mathf.Abs(fy - fx * 0.5f) / Mathf.Sqrt(1.25f), d2 = Mathf.Abs(fy - (60 - fx * 0.5f)) / Mathf.Sqrt(1.25f);
                    float dd = Mathf.Min(d1, d2);
                    Color32 c = blue;
                    if (dd < 6) c = white;
                    if (dd < 2) c = red;
                    if (fx >= 50 && fx < 70 || fy >= 20 && fy < 40) c = white;
                    if (fx >= 54 && fx < 66 || fy >= 24 && fy < 36) c = red;
                    px[(Ht - 1 - y) * Wt + x] = c;
                }
            unionTex = new Texture2D(Wt, Ht, TextureFormat.RGBA32, true) { name = "union-jack", wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear, anisoLevel = 4 };
            unionTex.SetPixels32(px);
            unionTex.Apply(true, true);
            return unionTex;
        }

        /// <summary>A classic-frame position as a Unity one.</summary>
        public static Vector3 U(float x, float y, float z) => new Vector3(x, y, -z);
    }
}
