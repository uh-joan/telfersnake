using System.Collections.Generic;
using UnityEngine;

namespace Telfer.View
{
    /// <summary>Material factory for the house shaders. Shaders live in Resources so builds always ship them.</summary>
    public static class Mats
    {
        static Shader toon, snake, grass, sky, glow;
        public static Shader ToonShader => toon ? toon : (toon = Shader.Find("Telfer/Toon"));
        public static Shader SnakeShader => snake ? snake : (snake = Shader.Find("Telfer/Snake"));
        public static Shader GrassShader => grass ? grass : (grass = Shader.Find("Telfer/Grass"));
        public static Shader SkyShader => sky ? sky : (sky = Shader.Find("Telfer/Sky"));
        public static Shader GlowShader => glow ? glow : (glow = Shader.Find("Telfer/Glow"));

        static readonly Dictionary<string, Material> cache = new Dictionary<string, Material>();

        /// <summary>The shared vertex-coloured material most props use.</summary>
        public static Material VertexLit => Cached("vertexLit", () => Toon(Color.white, gloss: 0.12f, smooth: 0.3f, rim: 0.18f));
        public static Material VertexGlossy => Cached("vertexGlossy", () => Toon(Color.white, gloss: 0.9f, smooth: 0.8f, rim: 0.35f));
        public static Material VertexWind => Cached("vertexWind", () => { var m = Toon(Color.white, gloss: 0.05f, smooth: 0.2f, rim: 0.2f); m.SetFloat("_WindAmount", 0.6f); m.SetFloat("_WindHeight", 0.12f); m.SetFloat("_Translucency", 0.18f); return m; });
        public static Material VertexFlutter => Cached("vertexFlutter", () => { var m = Toon(Color.white, gloss: 0.05f, smooth: 0.2f, rim: 0.2f); m.SetFloat("_WindAmount", 0.4f); m.SetFloat("_WindHeight", 0.3f); m.SetFloat("_Translucency", 0.5f); m.SetFloat("_Cull", 0); return m; });
        public static Material VertexTwoSided => Cached("vertexTwoSided", () => { var m = Toon(Color.white, gloss: 0.1f, smooth: 0.3f, rim: 0.15f); m.SetFloat("_Cull", 0); m.SetFloat("_Translucency", 0.4f); return m; });

        public static Material Cached(string key, System.Func<Material> make)
        {
            if (!cache.TryGetValue(key, out var m) || m == null) cache[key] = m = make();
            return m;
        }

        public static Material Toon(Color color, float gloss = 0.15f, float smooth = 0.3f, float rim = 0.2f, Texture tex = null, Vector2? tiling = null, bool vertexColor = true)
        {
            var m = new Material(ToonShader) { name = "Toon", enableInstancing = true };
            m.SetColor("_BaseColor", color);
            m.SetFloat("_Gloss", gloss);
            m.SetFloat("_Smoothness", smooth);
            m.SetFloat("_RimStrength", rim);
            m.SetFloat("_UseVertexColor", vertexColor ? 1 : 0);
            if (tex != null)
            {
                m.SetTexture("_BaseMap", tex);
                if (tiling.HasValue) m.SetTextureScale("_BaseMap", tiling.Value);
            }
            return m;
        }

        /// <summary>Unlit glow. shape: 0 soft blob, 1 sparkle, 2 ring, 3 solid. additive for light, else alpha blend.</summary>
        public static Material Glow(Color color, float shape = 0, bool additive = true, float intensity = 1)
        {
            var m = new Material(GlowShader) { name = "Glow", enableInstancing = true };
            m.SetColor("_Color", color);
            m.SetFloat("_Shape", shape);
            m.SetFloat("_Intensity", intensity);
            m.SetFloat("_SrcBlend", additive ? (float)UnityEngine.Rendering.BlendMode.SrcAlpha : (float)UnityEngine.Rendering.BlendMode.SrcAlpha);
            m.SetFloat("_DstBlend", additive ? (float)UnityEngine.Rendering.BlendMode.One : (float)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
            m.renderQueue = 3000;
            return m;
        }
    }

    /// <summary>Procedural textures: bricks, roof tiles, grit. Painted once at start-up.</summary>
    public static class Tex
    {
        static float Hash(int x, int y, int s)
        {
            unchecked
            {
                uint h = (uint)(x * 374761393 + y * 668265263 + s * 2147483647);
                h = (h ^ (h >> 13)) * 1274126177;
                return ((h ^ (h >> 16)) & 0xffffff) / 16777216f;
            }
        }

        static Texture2D New(int w, int h, string name, bool linear = false)
        {
            var t = new Texture2D(w, h, TextureFormat.RGBA32, true, linear) { name = name, wrapMode = TextureWrapMode.Repeat, filterMode = FilterMode.Trilinear, anisoLevel = 8 };
            return t;
        }

        /// <summary>Red-brown brick courses, light mortar. One tile = 2 m wide, 1 m tall of wall (uv in metres / 2).</summary>
        public static Texture2D Brick(Color baseBrick)
        {
            const int W = 256, H = 256;
            var t = New(W, H, "brick");
            var px = new Color32[W * H];
            int rows = 16, cols = 8;
            float bh = H / (float)rows, bw = W / (float)cols;
            Color mortar = new Color(0.82f, 0.78f, 0.72f);
            for (int y = 0; y < H; y++)
            {
                int r = (int)(y / bh);
                float off = (r % 2) * bw * 0.5f;
                for (int x = 0; x < W; x++)
                {
                    float fx = x + off;
                    int c = (int)(fx / bw);
                    float lx = fx - c * bw, ly = y - r * bh;
                    bool isMortar = lx < 2 || ly < 2;
                    Color col;
                    if (isMortar) col = mortar * (0.92f + Hash(x, y, 3) * 0.08f);
                    else
                    {
                        float v = Hash(c % cols, r, 7);
                        col = Color.Lerp(baseBrick * 0.8f, baseBrick * 1.18f, v);
                        col = Color.Lerp(col, new Color(0.45f, 0.3f, 0.25f), Hash(c % cols, r, 11) < 0.12f ? 0.35f : 0);
                        col *= 0.93f + Hash(x, y, 5) * 0.12f;
                        // A soft bevel: darker at the bottom edge of each brick.
                        if (ly > bh - 3) col *= 0.85f;
                    }
                    col.a = 1;
                    px[y * W + x] = col;
                }
            }
            t.SetPixels32(px);
            t.Apply(true);
            return t;
        }

        /// <summary>Overlapping clay roof tiles (rows of rounded tongues), white so materials tint it.</summary>
        public static Texture2D RoofTiles()
        {
            const int W = 128, H = 128;
            var t = New(W, H, "tiles");
            var px = new Color32[W * H];
            int rows = 8, cols = 8;
            float th = H / (float)rows, tw = W / (float)cols;
            for (int y = 0; y < H; y++)
            {
                int r = (int)(y / th);
                float off = (r % 2) * tw * 0.5f;
                for (int x = 0; x < W; x++)
                {
                    float fx = x + off;
                    int c = (int)(fx / tw);
                    float lx = (fx - c * tw) / tw - 0.5f, ly = (y - r * th) / th;
                    float tongue = Mathf.Sqrt(lx * lx * 4 + 0.0001f);
                    float shade = Mathf.Lerp(0.72f, 1.05f, ly) * (1 - Mathf.Pow(tongue, 6) * 0.35f);
                    if (ly < 0.12f) shade *= 0.7f;
                    shade *= 0.9f + Hash(c, r, 9) * 0.18f;
                    var col = new Color(shade, shade, shade, 1);
                    px[y * W + x] = col;
                }
            }
            t.SetPixels32(px);
            t.Apply(true);
            return t;
        }

        /// <summary>Corrugated sheet: soft stripes, white (tinted by the material).</summary>
        public static Texture2D Corrugated()
        {
            const int W = 64, H = 8;
            var t = New(W, H, "corrugated");
            var px = new Color32[W * H];
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++)
                {
                    float s = 0.82f + 0.18f * Mathf.Sin(x / (float)W * Mathf.PI * 2 * 8);
                    px[y * W + x] = new Color(s, s, s, 1);
                }
            t.SetPixels32(px);
            t.Apply(true);
            return t;
        }

        /// <summary>Solar panel cells: deep blue grid with silver lines.</summary>
        public static Texture2D Solar()
        {
            const int W = 64, H = 64;
            var t = New(W, H, "solar");
            var px = new Color32[W * H];
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++)
                {
                    bool line = x % 16 < 1 || y % 16 < 1;
                    Color c = line ? new Color(0.75f, 0.78f, 0.82f) : Color.Lerp(new Color(0.08f, 0.16f, 0.38f), new Color(0.15f, 0.26f, 0.55f), (x % 16 + y % 16) / 32f);
                    px[y * W + x] = c;
                }
            t.SetPixels32(px);
            t.Apply(true);
            return t;
        }

        /// <summary>Tileable grey grit, centred on mid-grey: the ground shader multiplies it in at two scales.</summary>
        public static Texture2D Grit()
        {
            const int S = 256;
            var t = New(S, S, "grit", true);
            var px = new Color32[S * S];
            for (int y = 0; y < S; y++)
                for (int x = 0; x < S; x++)
                {
                    float n = 0;
                    float amp = 0.5f, freq = 4;
                    for (int o = 0; o < 4; o++)
                    {
                        n += amp * Tileable(x / (float)S * freq, y / (float)S * freq, (int)freq, o);
                        amp *= 0.5f; freq *= 2;
                    }
                    float speck = Hash(x, y, 21);
                    float v = 0.5f + (n - 0.47f) * 0.35f + (speck > 0.97f ? 0.1f : speck < 0.03f ? -0.1f : 0);
                    byte b = (byte)(Mathf.Clamp01(v) * 255);
                    px[y * S + x] = new Color32(b, b, b, 255);
                }
            t.SetPixels32(px);
            t.Apply(true);
            return t;
        }

        static float Tileable(float x, float y, int period, int seed)
        {
            int x0 = Mathf.FloorToInt(x), y0 = Mathf.FloorToInt(y);
            float fx = x - x0, fy = y - y0;
            float ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
            float a = Hash(Mod(x0, period), Mod(y0, period), seed), b = Hash(Mod(x0 + 1, period), Mod(y0, period), seed);
            float c = Hash(Mod(x0, period), Mod(y0 + 1, period), seed), d = Hash(Mod(x0 + 1, period), Mod(y0 + 1, period), seed);
            return Mathf.Lerp(Mathf.Lerp(a, b, ux), Mathf.Lerp(c, d, ux), uy);
        }

        static int Mod(int a, int m) => ((a % m) + m) % m;
    }
}
