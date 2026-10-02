using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace Telfer.View
{
    /// <summary>
    /// Builds vertex-coloured meshes out of primitives. Everything in the remaster is modelled
    /// here in code: no imported art. Set <see cref="M"/> (a local transform) and <see cref="C"/>
    /// (colour; alpha is baked ambient occlusion) and add shapes; then <see cref="ToMesh"/>.
    /// </summary>
    public sealed class MeshKit
    {
        public readonly List<Vector3> V = new List<Vector3>();
        public readonly List<Vector3> N = new List<Vector3>();
        public readonly List<Color> Col = new List<Color>();
        public readonly List<Vector2> UV = new List<Vector2>();
        public readonly List<int> T = new List<int>();

        public Matrix4x4 M = Matrix4x4.identity;
        public Color C = Color.white;

        public MeshKit At(Vector3 pos, Quaternion rot, Vector3 scale) { M = Matrix4x4.TRS(pos, rot, scale); return this; }
        public MeshKit At(Vector3 pos) { M = Matrix4x4.Translate(pos); return this; }
        public MeshKit At(Vector3 pos, Vector3 euler) { M = Matrix4x4.TRS(pos, Quaternion.Euler(euler), Vector3.one); return this; }
        public MeshKit Reset() { M = Matrix4x4.identity; return this; }
        public MeshKit Tint(Color c) { C = c; return this; }
        public MeshKit Tint(uint hex, float ao = 1) { C = Hex(hex); C.a = ao; return this; }

        public static Color Hex(uint hex) => new Color(((hex >> 16) & 255) / 255f, ((hex >> 8) & 255) / 255f, (hex & 255) / 255f, 1);

        int Add(Vector3 p, Vector3 n, Vector2 uv)
        {
            V.Add(M.MultiplyPoint3x4(p));
            N.Add(M.inverse.transpose.MultiplyVector(n).normalized);
            Col.Add(C);
            UV.Add(uv);
            return V.Count - 1;
        }

        int AddFast(Vector3 p, Vector3 n, Vector2 uv, Matrix4x4 nm)
        {
            V.Add(M.MultiplyPoint3x4(p));
            N.Add(nm.MultiplyVector(n).normalized);
            Col.Add(C);
            UV.Add(uv);
            return V.Count - 1;
        }

        public void Tri(int a, int b, int c) { T.Add(a); T.Add(b); T.Add(c); }

        /// <summary>UV sphere (or ellipsoid via radii), smooth shaded.</summary>
        public void Sphere(Vector3 c, Vector3 r, int seg = 14, int rings = 9, float vMin = 0, float vMax = 1)
        {
            var nm = M.inverse.transpose;
            int start = V.Count;
            for (int y = 0; y <= rings; y++)
            {
                float v = Mathf.Lerp(vMin, vMax, y / (float)rings);
                float phi = v * Mathf.PI;
                for (int x = 0; x <= seg; x++)
                {
                    float u = x / (float)seg;
                    float th = u * Mathf.PI * 2;
                    var dir = new Vector3(Mathf.Sin(phi) * Mathf.Cos(th), Mathf.Cos(phi), Mathf.Sin(phi) * Mathf.Sin(th));
                    var p = c + Vector3.Scale(dir, r);
                    var n = new Vector3(dir.x / r.x, dir.y / r.y, dir.z / r.z);
                    AddFast(p, n, new Vector2(u, 1 - v), nm);
                }
            }
            for (int y = 0; y < rings; y++)
                for (int x = 0; x < seg; x++)
                {
                    int a = start + y * (seg + 1) + x, b = a + seg + 1;
                    Tri(a, a + 1, b);
                    Tri(a + 1, b + 1, b);
                }
        }

        public void Sphere(Vector3 c, float r, int seg = 14, int rings = 9) => Sphere(c, Vector3.one * r, seg, rings);

        /// <summary>Faceted, noise-displaced icosphere: rocks, canopy lumps, crumbs.</summary>
        public void Blob(Vector3 c, Vector3 r, float roughness, int seed, int subdiv = 1, bool flat = true)
        {
            var (verts, tris) = Icosphere(subdiv);
            var rng = new System.Random(seed);
            float ox = (float)rng.NextDouble() * 50, oy = (float)rng.NextDouble() * 50;
            var disp = new Vector3[verts.Count];
            for (int i = 0; i < verts.Count; i++)
            {
                var d = verts[i];
                float n = Mathf.PerlinNoise(d.x * 1.7f + ox, d.z * 1.7f + d.y * 0.9f + oy);
                disp[i] = c + Vector3.Scale(d * (1 + (n - 0.5f) * 2 * roughness), r);
            }
            var nm = M.inverse.transpose;
            if (flat)
            {
                for (int i = 0; i < tris.Count; i += 3)
                {
                    var a = disp[tris[i]]; var b = disp[tris[i + 1]]; var cc = disp[tris[i + 2]];
                    var n = Vector3.Cross(b - a, cc - a).normalized;
                    int ia = AddFast(a, n, Vector2.zero, nm), ib = AddFast(b, n, Vector2.zero, nm), ic = AddFast(cc, n, Vector2.zero, nm);
                    Tri(ia, ib, ic);
                }
            }
            else
            {
                int start = V.Count;
                for (int i = 0; i < verts.Count; i++) AddFast(disp[i], (disp[i] - c).normalized, Vector2.zero, nm);
                for (int i = 0; i < tris.Count; i += 3) Tri(start + tris[i], start + tris[i + 1], start + tris[i + 2]);
            }
        }

        static readonly Dictionary<int, (List<Vector3>, List<int>)> icoCache = new Dictionary<int, (List<Vector3>, List<int>)>();

        static (List<Vector3>, List<int>) Icosphere(int subdiv)
        {
            if (icoCache.TryGetValue(subdiv, out var hit)) return hit;
            float t = (1 + Mathf.Sqrt(5)) / 2;
            var v = new List<Vector3>
            {
                new Vector3(-1, t, 0), new Vector3(1, t, 0), new Vector3(-1, -t, 0), new Vector3(1, -t, 0),
                new Vector3(0, -1, t), new Vector3(0, 1, t), new Vector3(0, -1, -t), new Vector3(0, 1, -t),
                new Vector3(t, 0, -1), new Vector3(t, 0, 1), new Vector3(-t, 0, -1), new Vector3(-t, 0, 1),
            };
            for (int i = 0; i < v.Count; i++) v[i] = v[i].normalized;
            var f = new List<int> { 0,11,5, 0,5,1, 0,1,7, 0,7,10, 0,10,11, 1,5,9, 5,11,4, 11,10,2, 10,7,6, 7,1,8,
                3,9,4, 3,4,2, 3,2,6, 3,6,8, 3,8,9, 4,9,5, 2,4,11, 6,2,10, 8,6,7, 9,8,1 };
            for (int s = 0; s < subdiv; s++)
            {
                var mid = new Dictionary<long, int>();
                int Mid(int a, int b)
                {
                    long key = a < b ? ((long)a << 32) | (uint)b : ((long)b << 32) | (uint)a;
                    if (mid.TryGetValue(key, out int m)) return m;
                    v.Add(((v[a] + v[b]) * 0.5f).normalized);
                    mid[key] = v.Count - 1;
                    return v.Count - 1;
                }
                var nf = new List<int>();
                for (int i = 0; i < f.Count; i += 3)
                {
                    int a = f[i], b = f[i + 1], c = f[i + 2];
                    int ab = Mid(a, b), bc = Mid(b, c), ca = Mid(c, a);
                    nf.AddRange(new[] { a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca });
                }
                f = nf;
            }
            // Front faces in Unity are those whose cross(b - a, c - a) points at the viewer: the
            // classic list already has outward cross products, so it needs no flip.
            icoCache[subdiv] = (v, f);
            return (v, f);
        }

        /// <summary>Box with flat faces. uvScale > 0 maps each face's uv in metres / uvScale (for tiled textures).</summary>
        public void Box(Vector3 c, Vector3 size, float uvScale = 0, bool bottom = false)
        {
            var h = size * 0.5f;
            var nm = M.inverse.transpose;
            void Face(Vector3 n, Vector3 u, Vector3 v, float uw, float vh)
            {
                var o = c + Vector3.Scale(n, h);
                var du = Vector3.Scale(u, h); var dv = Vector3.Scale(v, h);
                float su = uvScale > 0 ? uw / uvScale : 1, sv = uvScale > 0 ? vh / uvScale : 1;
                int a = AddFast(o - du - dv, n, new Vector2(0, 0), nm);
                int b = AddFast(o + du - dv, n, new Vector2(su, 0), nm);
                int cc = AddFast(o + du + dv, n, new Vector2(su, sv), nm);
                int d = AddFast(o - du + dv, n, new Vector2(0, sv), nm);
                Tri(a, cc, b); Tri(a, d, cc);
            }
            Face(Vector3.forward, Vector3.left, Vector3.up, size.x, size.y);
            Face(Vector3.back, Vector3.right, Vector3.up, size.x, size.y);
            Face(Vector3.right, Vector3.forward, Vector3.up, size.z, size.y);
            Face(Vector3.left, Vector3.back, Vector3.up, size.z, size.y);
            Face(Vector3.up, Vector3.right, Vector3.forward, size.x, size.z);
            if (bottom) Face(Vector3.down, Vector3.left, Vector3.forward, size.x, size.z);
        }

        /// <summary>A box with rounded vertical edges and a soft top: toys, bins, cushions, car bodies.</summary>
        public void RoundBox(Vector3 c, Vector3 size, float radius, int cornerSeg = 4)
        {
            radius = Mathf.Min(radius, Mathf.Min(size.x, Mathf.Min(size.y, size.z)) * 0.49f);
            var h = size * 0.5f;
            var nm = M.inverse.transpose;
            // A superellipse-ish ring profile extruded vertically, with a rounded top lip.
            var ring = new List<(Vector2 p, Vector2 n)>();
            Vector2[] centers = { new Vector2(h.x - radius, h.z - radius), new Vector2(-h.x + radius, h.z - radius), new Vector2(-h.x + radius, -h.z + radius), new Vector2(h.x - radius, -h.z + radius) };
            for (int k = 0; k < 4; k++)
                for (int s = 0; s <= cornerSeg; s++)
                {
                    float a = (k * 90 + s * 90f / cornerSeg) * Mathf.Deg2Rad;
                    var n = new Vector2(Mathf.Cos(a), Mathf.Sin(a));
                    ring.Add((centers[k] + n * radius, n));
                }
            int rows = cornerSeg + 2;
            int start = V.Count;
            int rc = ring.Count;
            for (int r = 0; r <= rows; r++)
            {
                float y, inset; Vector3 nUp;
                if (r == 0) { y = -h.y; inset = 0; nUp = Vector3.zero; }
                else
                {
                    float a = (r - 1) / (float)(rows - 1) * Mathf.PI * 0.5f;
                    y = h.y - radius + Mathf.Sin(a) * radius;
                    inset = radius - Mathf.Cos(a) * radius;
                    nUp = Vector3.up * Mathf.Sin(a);
                }
                for (int i = 0; i < rc; i++)
                {
                    var (p, n) = ring[i];
                    var pos = c + new Vector3(p.x - n.x * inset, y, p.y - n.y * inset);
                    float side = r == 0 ? 1 : Mathf.Cos((r - 1) / (float)(rows - 1) * Mathf.PI * 0.5f);
                    var nn = new Vector3(n.x * side, 0, n.y * side) + nUp;
                    AddFast(pos, nn, new Vector2(i / (float)rc, r / (float)rows), nm);
                }
            }
            for (int r = 0; r < rows; r++)
                for (int i = 0; i < rc; i++)
                {
                    int a = start + r * rc + i, b = start + r * rc + (i + 1) % rc;
                    int a2 = a + rc, b2 = b + rc;
                    Tri(a, a2, b); Tri(b, a2, b2);
                }
            // Top cap.
            int top = start + rows * rc;
            int centre = AddFast(c + new Vector3(0, h.y, 0), Vector3.up, new Vector2(0.5f, 0.5f), nm);
            for (int i = 0; i < rc; i++) Tri(centre, top + (i + 1) % rc, top + i);
        }

        /// <summary>Tapered cylinder from a to b (ra at a, rb at b). rb = 0 makes a cone.</summary>
        public void Cylinder(Vector3 a, Vector3 b, float ra, float rb, int seg = 10, bool capA = true, bool capB = true, bool smooth = true)
        {
            var nm = M.inverse.transpose;
            var axis = b - a;
            float len = axis.magnitude;
            if (len < 1e-5f) return;
            var dir = axis / len;
            var side = Vector3.Cross(dir, Mathf.Abs(dir.y) < 0.99f ? Vector3.up : Vector3.right).normalized;
            var up = Vector3.Cross(side, dir);
            float slope = (ra - rb) / len;
            int start = V.Count;
            for (int i = 0; i <= seg; i++)
            {
                float t = i / (float)seg * Mathf.PI * 2;
                var o = side * Mathf.Cos(t) + up * Mathf.Sin(t);
                var n = (o + dir * slope).normalized;
                AddFast(a + o * ra, n, new Vector2(i / (float)seg, 0), nm);
                AddFast(b + o * rb, n, new Vector2(i / (float)seg, 1), nm);
            }
            for (int i = 0; i < seg; i++)
            {
                int i0 = start + i * 2;
                Tri(i0, i0 + 1, i0 + 2);
                Tri(i0 + 1, i0 + 3, i0 + 2);
            }
            if (capA && ra > 0) Disc(a, -dir, side, up, ra, seg, nm);
            if (capB && rb > 0) Disc(b, dir, side, up, rb, seg, nm);
        }

        void Disc(Vector3 c, Vector3 n, Vector3 side, Vector3 up, float r, int seg, Matrix4x4 nm)
        {
            int centre = AddFast(c, n, new Vector2(0.5f, 0.5f), nm);
            int start = V.Count;
            for (int i = 0; i <= seg; i++)
            {
                float t = i / (float)seg * Mathf.PI * 2;
                AddFast(c + (side * Mathf.Cos(t) + up * Mathf.Sin(t)) * r, n, new Vector2(0.5f + Mathf.Cos(t) * 0.5f, 0.5f + Mathf.Sin(t) * 0.5f), nm);
            }
            bool flip = Vector3.Dot(Vector3.Cross(side, up), n) > 0;
            for (int i = 0; i < seg; i++)
            {
                if (flip) Tri(centre, start + i, start + i + 1);
                else Tri(centre, start + i + 1, start + i);
            }
        }

        public void Capsule(Vector3 a, Vector3 b, float r, int seg = 12)
        {
            Cylinder(a, b, r, r, seg, false, false);
            var dir = (b - a).normalized;
            var rot = Quaternion.FromToRotation(Vector3.up, dir);
            HalfSphere(b, r, rot, seg);
            HalfSphere(a, r, rot * Quaternion.Euler(180, 0, 0), seg);
        }

        void HalfSphere(Vector3 c, float r, Quaternion rot, int seg)
        {
            var saved = M;
            M = M * Matrix4x4.TRS(c, rot, Vector3.one);
            Sphere(Vector3.zero, Vector3.one * r, seg, Mathf.Max(3, seg / 2), 0, 0.5f);
            M = saved;
        }

        public void Torus(Vector3 c, float R, float r, int seg = 18, int tube = 8, float arc = 360)
        {
            var nm = M.inverse.transpose;
            int start = V.Count;
            for (int i = 0; i <= seg; i++)
            {
                float u = i / (float)seg * arc * Mathf.Deg2Rad;
                var ring = new Vector3(Mathf.Cos(u), 0, Mathf.Sin(u));
                for (int j = 0; j <= tube; j++)
                {
                    float v = j / (float)tube * Mathf.PI * 2;
                    var n = ring * Mathf.Cos(v) + Vector3.up * Mathf.Sin(v);
                    AddFast(c + ring * R + n * r, n, new Vector2(i / (float)seg, j / (float)tube), nm);
                }
            }
            for (int i = 0; i < seg; i++)
                for (int j = 0; j < tube; j++)
                {
                    int a = start + i * (tube + 1) + j, b = a + tube + 1;
                    Tri(a, a + 1, b); Tri(a + 1, b + 1, b);
                }
        }

        /// <summary>A double-sided flat triangle (flags, leaves, ears).</summary>
        public void Triangle(Vector3 a, Vector3 b, Vector3 c, bool doubleSided = true)
        {
            var n = Vector3.Cross(b - a, c - a).normalized;
            int ia = Add(a, n, new Vector2(0, 0)), ib = Add(b, n, new Vector2(1, 0)), ic = Add(c, n, new Vector2(0.5f, 1));
            Tri(ia, ib, ic);
            if (doubleSided)
            {
                int ja = Add(a, -n, new Vector2(0, 0)), jb = Add(b, -n, new Vector2(1, 0)), jc = Add(c, -n, new Vector2(0.5f, 1));
                Tri(ja, jc, jb);
            }
        }

        /// <summary>One single-sided triangle with explicit uvs; its front is the side cross(b - a, c - a) points to.</summary>
        public void TriUV(Vector3 a, Vector3 b, Vector3 c, Vector2 ua, Vector2 ub, Vector2 uc)
        {
            var n = Vector3.Cross(b - a, c - a).normalized;
            int ia = Add(a, n, ua), ib = Add(b, n, ub), ic = Add(c, n, uc);
            Tri(ia, ib, ic);
        }

        /// <summary>A quad a-b-c-d; its front is the side cross(b - a, d - a) points to. uv 0..uvMax.</summary>
        public void Quad(Vector3 a, Vector3 b, Vector3 c, Vector3 d, Vector2 uvMax, bool doubleSided = false)
        {
            var n = Vector3.Cross(b - a, d - a).normalized;
            int ia = Add(a, n, new Vector2(0, 0)), ib = Add(b, n, new Vector2(uvMax.x, 0)), ic = Add(c, n, uvMax), id = Add(d, n, new Vector2(0, uvMax.y));
            Tri(ia, ib, ic); Tri(ia, ic, id);
            if (doubleSided)
            {
                int ja = Add(a, -n, new Vector2(0, 0)), jb = Add(b, -n, new Vector2(uvMax.x, 0)), jc = Add(c, -n, uvMax), jd = Add(d, -n, new Vector2(0, uvMax.y));
                Tri(ja, jc, jb); Tri(ja, jd, jc);
            }
        }

        public void Append(MeshKit other)
        {
            int o = V.Count;
            for (int i = 0; i < other.V.Count; i++)
            {
                V.Add(M.MultiplyPoint3x4(other.V[i]));
                N.Add(M.inverse.transpose.MultiplyVector(other.N[i]).normalized);
                Col.Add(other.Col[i]);
                UV.Add(other.UV[i]);
            }
            foreach (var t in other.T) T.Add(t + o);
        }

        public Mesh ToMesh(string name = "kit", bool tangents = false)
        {
            var m = new Mesh { name = name };
            if (V.Count > 65000) m.indexFormat = IndexFormat.UInt32;
            m.SetVertices(V);
            m.SetNormals(N);
            m.SetColors(Col);
            m.SetUVs(0, UV);
            m.SetTriangles(T, 0);
            m.RecalculateBounds();
            if (tangents) m.RecalculateTangents();
            m.UploadMeshData(false);
            return m;
        }

        public void Clear() { V.Clear(); N.Clear(); Col.Clear(); UV.Clear(); T.Clear(); M = Matrix4x4.identity; C = Color.white; }
    }
}
