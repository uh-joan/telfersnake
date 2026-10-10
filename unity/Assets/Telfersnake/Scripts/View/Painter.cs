using System;
using System.Collections.Generic;
using UnityEngine;

namespace Telfer.View
{
    /// <summary>Sim (x east, z south) to Unity (x east, y up, z north), and headings to rotations.</summary>
    public static class W
    {
        public static Vector3 P(float x, float z, float y = 0) => new Vector3(x, y, -z);
        public static Vector3 Dir(float heading) => new Vector3(Mathf.Cos(heading), 0, -Mathf.Sin(heading));
        public static Quaternion Face(float heading) => Quaternion.LookRotation(Dir(heading), Vector3.up);
        public static float Yaw(float heading) => Mathf.Atan2(Mathf.Cos(heading), -Mathf.Sin(heading)) * Mathf.Rad2Deg;
    }

    /// <summary>
    /// A little anti-aliased rasteriser that paints in world metres onto a texture, the way the web
    /// game paints its ground onto a canvas: one texture, the whole playground plan.
    /// Pixel rows run north to south (sim +z), so text reads the right way up from the camera.
    /// </summary>
    public sealed class Painter
    {
        public readonly int Size;
        public readonly float World, MinX, MinZ, PxPerM;
        readonly Color32[] px;

        public Painter(int size, float world, float centreX = 0, float centreZ = 0)
        {
            Size = size; World = world;
            MinX = centreX - world / 2; MinZ = centreZ - world / 2;
            PxPerM = size / world;
            px = new Color32[size * size];
        }

        public static Color C(string hex) { ColorUtility.TryParseHtmlString(hex, out var c); return c; }
        public static Color C(string hex, float a) { var c = C(hex); c.a = a; return c; }

        int X(float x) => Mathf.FloorToInt((x - MinX) * PxPerM);
        int Z(float z) => Mathf.FloorToInt((z - MinZ) * PxPerM);

        public void Fill(Color c)
        {
            Color32 c32 = c;
            for (int i = 0; i < px.Length; i++) px[i] = c32;
        }

        void Blend(int i, Color c, float cover)
        {
            float a = c.a * cover;
            if (a <= 0.001f) return;
            var d = px[i];
            px[i] = new Color32(
                (byte)(d.r + (c.r * 255 - d.r) * a),
                (byte)(d.g + (c.g * 255 - d.g) * a),
                (byte)(d.b + (c.b * 255 - d.b) * a), 255);
        }

        /// <summary>Paint every pixel in a world-space box by a signed distance (metres, &lt; 0 inside).</summary>
        public void Shape(float x0, float z0, float x1, float z1, Func<float, float, float> sdf, Color c)
        {
            int ix0 = Mathf.Max(0, X(x0) - 2), ix1 = Mathf.Min(Size - 1, X(x1) + 2);
            int iz0 = Mathf.Max(0, Z(z0) - 2), iz1 = Mathf.Min(Size - 1, Z(z1) + 2);
            float m = 1 / PxPerM;
            for (int iz = iz0; iz <= iz1; iz++)
            {
                float z = MinZ + (iz + 0.5f) * m;
                int row = iz * Size;
                for (int ix = ix0; ix <= ix1; ix++)
                {
                    float x = MinX + (ix + 0.5f) * m;
                    float d = sdf(x, z);
                    float cover = Mathf.Clamp01(0.5f - d * PxPerM);
                    if (cover > 0) Blend(row + ix, c, cover);
                }
            }
        }

        public void Rect(float x0, float z0, float x1, float z1, Color c) => RoundRect(x0, z0, x1, z1, 0, c);

        public void RoundRect(float x0, float z0, float x1, float z1, float r, Color c)
        {
            float cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, hx = (x1 - x0) / 2, hz = (z1 - z0) / 2;
            Shape(x0, z0, x1, z1, (x, z) =>
            {
                float qx = Mathf.Abs(x - cx) - hx + r, qz = Mathf.Abs(z - cz) - hz + r;
                return Mathf.Sqrt(Mathf.Max(qx, 0) * Mathf.Max(qx, 0) + Mathf.Max(qz, 0) * Mathf.Max(qz, 0)) + Mathf.Min(Mathf.Max(qx, qz), 0) - r;
            }, c);
        }

        public void StrokeRect(float x0, float z0, float x1, float z1, float w, Color c)
        {
            Line(x0, z0, x1, z0, w, c); Line(x1, z0, x1, z1, w, c);
            Line(x1, z1, x0, z1, w, c); Line(x0, z1, x0, z0, w, c);
        }

        /// <summary>Approximate ellipse distance: good enough for paint.</summary>
        static float Ellipse(float lx, float lz, float rx, float rz)
        {
            float k = Mathf.Sqrt(lx * lx / (rx * rx) + lz * lz / (rz * rz));
            float g = Mathf.Sqrt(lx * lx / (rx * rx * rx * rx) + lz * lz / (rz * rz * rz * rz));
            return g > 1e-6f ? (k - 1) * k / g : -Mathf.Min(rx, rz);
        }

        public void FillEllipse(float cx, float cz, float rx, float rz, float rot, Color c)
        {
            float cs = Mathf.Cos(-rot), sn = Mathf.Sin(-rot), R = Mathf.Max(rx, rz);
            Shape(cx - R, cz - R, cx + R, cz + R, (x, z) =>
            {
                float dx = x - cx, dz = z - cz;
                return Ellipse(dx * cs - dz * sn, dx * sn + dz * cs, rx, rz);
            }, c);
        }

        /// <summary>Stroke an ellipse outline; a0..a1 in radians (canvas convention: from +x toward +z); dash in metres (0 = solid).</summary>
        public void StrokeEllipse(float cx, float cz, float rx, float rz, float w, Color c, float a0 = 0, float a1 = Mathf.PI * 2, float dash = 0)
        {
            float R = Mathf.Max(rx, rz) + w;
            bool full = a1 - a0 >= Mathf.PI * 2 - 1e-3f;
            float perim = Mathf.PI * (rx + rz);
            Shape(cx - R, cz - R, cx + R, cz + R, (x, z) =>
            {
                float dx = x - cx, dz = z - cz;
                float d = Mathf.Abs(Ellipse(dx, dz, rx, rz)) - w / 2;
                float a = Mathf.Atan2(dz / rz, dx / rx);
                if (a < 0) a += Mathf.PI * 2;
                if (!full)
                {
                    float aa = a;
                    if (aa < a0) aa += Mathf.PI * 2;
                    if (aa > a1) return 1;
                }
                if (dash > 0)
                {
                    float s = a / (Mathf.PI * 2) * perim;
                    if (s % (dash * 2) > dash) return 1;
                }
                return d;
            }, c);
        }

        /// <summary>A round-capped stroke; `phase` (metres) carries a dash pattern on from the previous segment.</summary>
        public void Line(float x0, float z0, float x1, float z1, float w, Color c, float dash = 0, float gap = -1, float phase = 0)
        {
            if (gap < 0) gap = dash;
            float dx = x1 - x0, dz = z1 - z0, len2 = Mathf.Max(1e-8f, dx * dx + dz * dz), len = Mathf.Sqrt(len2);
            Shape(Mathf.Min(x0, x1) - w, Mathf.Min(z0, z1) - w, Mathf.Max(x0, x1) + w, Mathf.Max(z0, z1) + w, (x, z) =>
            {
                float t = Mathf.Clamp01(((x - x0) * dx + (z - z0) * dz) / len2);
                if (dash > 0 && (t * len + phase) % (dash + gap) > dash) return 1;
                float ex = x - (x0 + dx * t), ez = z - (z0 + dz * t);
                return Mathf.Sqrt(ex * ex + ez * ez) - w / 2;
            }, c);
        }

        public void Circle(float cx, float cz, float r, Color c) => FillEllipse(cx, cz, r, r, 0, c);

        /// <summary>A stroke along a polyline (x, z pairs); a dashed one keeps its rhythm round the corners.</summary>
        public void Polyline(IList<Vector2> pts, float w, Color c, float dash = 0, float gap = -1)
        {
            float run = 0;
            for (int i = 0; i + 1 < pts.Count; i++)
            {
                Line(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, w, c, dash, gap, run);
                run += Vector2.Distance(pts[i], pts[i + 1]);
            }
        }

        /// <summary>Fill a polygon (x, z points), anti-aliased on its edges.</summary>
        public void Polygon(IList<Vector2> pts, Color c)
        {
            float x0 = float.MaxValue, z0 = float.MaxValue, x1 = float.MinValue, z1 = float.MinValue;
            foreach (var p in pts) { x0 = Mathf.Min(x0, p.x); x1 = Mathf.Max(x1, p.x); z0 = Mathf.Min(z0, p.y); z1 = Mathf.Max(z1, p.y); }
            int n = pts.Count;
            Shape(x0, z0, x1, z1, (x, z) =>
            {
                float d = float.MaxValue;
                bool inside = false;
                for (int i = 0, j = n - 1; i < n; j = i++)
                {
                    Vector2 a = pts[j], b = pts[i];
                    if ((b.y > z) != (a.y > z) && x < (a.x - b.x) * (z - b.y) / (a.y - b.y) + b.x) inside = !inside;
                    float ex = a.x - b.x, ez = a.y - b.y;
                    float t = Mathf.Clamp01(((x - b.x) * ex + (z - b.y) * ez) / Mathf.Max(1e-8f, ex * ex + ez * ez));
                    float qx = x - b.x - ex * t, qz = z - b.y - ez * t;
                    d = Mathf.Min(d, qx * qx + qz * qz);
                }
                d = Mathf.Sqrt(d);
                return inside ? -d : d;
            }, c);
        }

        /// <summary>A rectangle w × d centred on (cx, cz), turned `angle` radians (from +x toward +z).</summary>
        public void RotRect(float cx, float cz, float w, float d, float angle, Color c)
        {
            float cs = Mathf.Cos(angle), sn = Mathf.Sin(angle);
            Vector2 P(float u, float v) => new Vector2(cx + u * cs - v * sn, cz + u * sn + v * cs);
            Polygon(new[] { P(-w / 2, -d / 2), P(w / 2, -d / 2), P(w / 2, d / 2), P(-w / 2, d / 2) }, c);
        }

        /// <summary>Make a shape see-through: alpha falls to 0 inside it (the Thames is cut out of London's paper).</summary>
        public void Erase(float x0, float z0, float x1, float z1, Func<float, float, float> sdf)
        {
            int ix0 = Mathf.Max(0, X(x0) - 2), ix1 = Mathf.Min(Size - 1, X(x1) + 2);
            int iz0 = Mathf.Max(0, Z(z0) - 2), iz1 = Mathf.Min(Size - 1, Z(z1) + 2);
            float m = 1 / PxPerM;
            for (int iz = iz0; iz <= iz1; iz++)
            {
                float z = MinZ + (iz + 0.5f) * m;
                for (int ix = ix0; ix <= ix1; ix++)
                {
                    float x = MinX + (ix + 0.5f) * m;
                    float cover = Mathf.Clamp01(0.5f - sdf(x, z) * PxPerM);
                    if (cover <= 0) continue;
                    int i = iz * Size + ix;
                    var d = px[i];
                    px[i] = new Color32(d.r, d.g, d.b, (byte)(d.a * (1 - cover)));
                }
            }
        }

        /// <summary>Tint every pixel of a box by a colour that depends on where it is (gradients, fibres of a sheet).</summary>
        public void Tint(float x0, float z0, float x1, float z1, Func<float, float, Color> col)
        {
            int ix0 = Mathf.Max(0, X(x0)), ix1 = Mathf.Min(Size - 1, X(x1));
            int iz0 = Mathf.Max(0, Z(z0)), iz1 = Mathf.Min(Size - 1, Z(z1));
            float m = 1 / PxPerM;
            for (int iz = iz0; iz <= iz1; iz++)
            {
                float z = MinZ + (iz + 0.5f) * m;
                for (int ix = ix0; ix <= ix1; ix++)
                {
                    var c = col(MinX + (ix + 0.5f) * m, z);
                    if (c.a > 0.001f) Blend(iz * Size + ix, c, 1);
                }
            }
        }

        /// <summary>A tiny axis-aligned dab, `wPx` × `hPx` whole pixels at (x, z): paper fibres, specks.</summary>
        public void Dab(float x, float z, int wPx, int hPx, Color c)
        {
            int ix = X(x), iz = Z(z);
            for (int a = 0; a < hPx; a++)
                for (int b = 0; b < wPx; b++)
                {
                    int px_ = ix + b, pz = iz + a;
                    if (px_ < 0 || pz < 0 || px_ >= Size || pz >= Size) continue;
                    Blend(pz * Size + px_, c, 1);
                }
        }

        // ------------------------------------------------------------------ blocky painted lettering

        static readonly Dictionary<char, string[]> Glyphs = new Dictionary<char, string[]>
        {
            ['0'] = new[] { ".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###." },
            ['1'] = new[] { "..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###." },
            ['2'] = new[] { ".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####" },
            ['3'] = new[] { "####.", "....#", "....#", ".###.", "....#", "....#", "####." },
            ['4'] = new[] { "...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#." },
            ['5'] = new[] { "#####", "#....", "####.", "....#", "....#", "#...#", ".###." },
            ['6'] = new[] { ".###.", "#....", "#....", "####.", "#...#", "#...#", ".###." },
            ['7'] = new[] { "#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..." },
            ['8'] = new[] { ".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###." },
            ['9'] = new[] { ".###.", "#...#", "#...#", ".####", "....#", "....#", ".###." },
            ['A'] = new[] { ".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#" },
            ['B'] = new[] { "####.", "#...#", "#...#", "####.", "#...#", "#...#", "####." },
            ['D'] = new[] { "####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####." },
            ['H'] = new[] { "#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#" },
            ['M'] = new[] { "#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#" },
            ['V'] = new[] { "#...#", "#...#", "#...#", "#...#", ".#.#.", ".#.#.", "..#.." },
            ['C'] = new[] { ".###.", "#...#", "#....", "#....", "#....", "#...#", ".###." },
            ['E'] = new[] { "#####", "#....", "#....", "####.", "#....", "#....", "#####" },
            ['F'] = new[] { "#####", "#....", "#....", "####.", "#....", "#....", "#...." },
            ['G'] = new[] { ".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".###." },
            ['I'] = new[] { ".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###." },
            ['K'] = new[] { "#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#" },
            ['L'] = new[] { "#....", "#....", "#....", "#....", "#....", "#....", "#####" },
            ['N'] = new[] { "#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#" },
            ['O'] = new[] { ".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###." },
            ['P'] = new[] { "####.", "#...#", "#...#", "####.", "#....", "#....", "#...." },
            ['R'] = new[] { "####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#" },
            ['S'] = new[] { ".####", "#....", "#....", ".###.", "....#", "....#", "####." },
            ['T'] = new[] { "#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.." },
            ['U'] = new[] { "#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###." },
            ['W'] = new[] { "#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#" },
            ['Y'] = new[] { "#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.." },
        };

        /// <summary>Chunky painted capitals, centred on (cx, cz), `height` metres tall.</summary>
        public void Text(string text, float cx, float cz, float height, Color c)
        {
            float cell = height / 7f;
            float adv = cell * 6;
            float width = text.Length * adv - cell;
            float x0 = cx - width / 2, z0 = cz - height / 2;
            for (int i = 0; i < text.Length; i++)
            {
                if (!Glyphs.TryGetValue(text[i], out var g)) continue;
                for (int r = 0; r < 7; r++)
                    for (int k = 0; k < 5; k++)
                    {
                        if (g[r][k] != '#') continue;
                        float gx = x0 + i * adv + k * cell, gz = z0 + r * cell;
                        RoundRect(gx - cell * 0.04f, gz - cell * 0.04f, gx + cell * 1.04f, gz + cell * 1.04f, cell * 0.3f, c);
                    }
            }
        }

        public Texture2D ToTexture(string name)
        {
            var t = new Texture2D(Size, Size, TextureFormat.RGBA32, true, false)
            {
                name = name, wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Trilinear, anisoLevel = 16,
            };
            t.SetPixels32(px);
            t.Apply(true, true);
            return t;
        }

        /// <summary>A small copy for the minimap (read before ToTexture discards the CPU copy).</summary>
        public Texture2D Downsample(int size)
        {
            var t = new Texture2D(size, size, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear };
            var o = new Color32[size * size];
            int step = Size / size;
            for (int y = 0; y < size; y++)
                for (int x = 0; x < size; x++)
                {
                    int r = 0, g = 0, b = 0;
                    for (int k = 0; k < 4; k++)
                    {
                        var p = px[(y * step + (k / 2) * step / 2) * Size + x * step + (k % 2) * step / 2];
                        r += p.r; g += p.g; b += p.b;
                    }
                    // Flip rows: UI images are bottom-up, our rows run north to south.
                    o[(size - 1 - y) * size + x] = new Color32((byte)(r / 4), (byte)(g / 4), (byte)(b / 4), 255);
                }
            t.SetPixels32(o);
            t.Apply(false, false);
            return t;
        }
    }
}
