using System.Collections.Generic;
using UnityEngine;

namespace Telfer.View
{
    /// <summary>
    /// Tuck Shop hats, modelled in the snake head's unit space (radius 1, facing +Z, skull top near
    /// y = 0.95, big eyes up front around z = 0.42). Hats sit on top, a little back, so the eyes stay
    /// in view. Spinning hats (<see cref="Spins"/>) are centred on the head's Y axis so they turn in place.
    /// </summary>
    public static class Hats
    {
        static readonly Dictionary<string, UnityEngine.Mesh> cache = new Dictionary<string, UnityEngine.Mesh>();
        static MeshKit k;
        static Matrix4x4 root = Matrix4x4.identity;

        /// <summary>True for hats the view should keep turning around Y.</summary>
        public static bool Spins(string id) => id == "propeller" || id == "halo";

        /// <summary>A shared vertex-coloured mesh for the hat, or null for "no-hat" and unknown ids.</summary>
        public static UnityEngine.Mesh Mesh(string id)
        {
            if (string.IsNullOrEmpty(id) || id == "no-hat") return null;
            if (cache.TryGetValue(id, out var hit) && hit != null) return hit;
            k = new MeshKit();
            root = Matrix4x4.identity;
            bool ok = true;
            switch (id)
            {
                case "party": Party(); break;
                case "bobble": Bobble(); break;
                case "propeller": Propeller(); break;
                case "wizard": Wizard(); break;
                case "flower": Flower(); break;
                case "cat-ears": CatEars(); break;
                case "bunny-ears": BunnyEars(); break;
                case "chef": Chef(); break;
                case "cone": Cone(); break;
                case "cowboy": Cowboy(); break;
                case "top-hat": TopHat(); break;
                case "pirate": Pirate(); break;
                case "viking": Viking(); break;
                case "halo": Halo(); break;
                case "crown": Crown(); break;
                case "acorn": Acorn(); break;
                case "flower-crown": FlowerCrown(); break;
                case "antlers": Antlers(); break;
                // London (A7)
                case "bearskin": Bearskin(); break;
                case "bobby": Bobby(); break;
                case "union-top-hat": UnionTopHat(); break;
                case "beefeater": Beefeater(); break;
                case "bowler": Bowler(); break;
                case "tiara": Tiara(); break;
                case "deerstalker": Deerstalker(); break;
                case "pearly-cap": PearlyCap(); break;
                case "tiny-bigben": TinyBigBen(); break;
                default: ok = false; break;
            }
            UnityEngine.Mesh mesh = ok ? k.ToMesh("hat-" + id) : null;
            k = null;
            if (ok) cache[id] = mesh;
            return mesh;
        }

        // ------------------------------------------------------------------ helpers

        static Vector3 V3(float x, float y, float z) => new Vector3(x, y, z);

        /// <summary>Where the hat sits on the head; tilt &lt; 0 leans it back a touch.</summary>
        static void Root(Vector3 pos, float tilt)
        {
            root = Matrix4x4.TRS(pos, Quaternion.Euler(tilt, 0, 0), Vector3.one);
            k.M = root;
        }

        static void Here() => k.M = root;
        static void Put(Vector3 pos, Quaternion rot, Vector3 scale) => k.M = root * Matrix4x4.TRS(pos, rot, scale);
        static void Put(Vector3 pos, Vector3 euler) => Put(pos, Quaternion.Euler(euler), Vector3.one);

        /// <summary>A puffy five-pointed star lying on a surface whose outward normal is given.</summary>
        static void Star(Vector3 pos, Vector3 normal, float size)
        {
            k.M = root * Matrix4x4.TRS(pos, Quaternion.LookRotation(normal, Vector3.up), Vector3.one);
            var tip = V3(0, 0, size * 0.35f);
            for (int i = 0; i < 5; i++)
            {
                float a = (90 + 72 * i) * Mathf.Deg2Rad, step = 36 * Mathf.Deg2Rad;
                var outer = V3(Mathf.Cos(a), Mathf.Sin(a), 0) * size;
                var prev = V3(Mathf.Cos(a - step), Mathf.Sin(a - step), 0) * size * 0.45f;
                var next = V3(Mathf.Cos(a + step), Mathf.Sin(a + step), 0) * size * 0.45f;
                k.Triangle(tip, prev, outer);
                k.Triangle(tip, outer, next);
            }
        }

        /// <summary>An upper-hemisphere slice between two angles (radians): wedges of a quartered cap.</summary>
        static void Wedge(Vector3 c, Vector3 r, float a0, float a1, int seg, int rings)
        {
            var nm = k.M.inverse.transpose;
            int start = k.V.Count;
            for (int y = 0; y <= rings; y++)
            {
                float phi = y / (float)rings * Mathf.PI * 0.5f;
                for (int x = 0; x <= seg; x++)
                {
                    float th = Mathf.Lerp(a0, a1, x / (float)seg);
                    var dir = V3(Mathf.Sin(phi) * Mathf.Cos(th), Mathf.Cos(phi), Mathf.Sin(phi) * Mathf.Sin(th));
                    k.V.Add(k.M.MultiplyPoint3x4(c + Vector3.Scale(dir, r)));
                    k.N.Add(nm.MultiplyVector(V3(dir.x / r.x, dir.y / r.y, dir.z / r.z)).normalized);
                    k.Col.Add(k.C);
                    k.UV.Add(new Vector2(x / (float)seg, 1 - y / (float)rings));
                }
            }
            for (int y = 0; y < rings; y++)
                for (int x = 0; x < seg; x++)
                {
                    int a = start + y * (seg + 1) + x, b = a + seg + 1;
                    k.Tri(a, a + 1, b);
                    k.Tri(a + 1, b + 1, b);
                }
        }

        /// <summary>Turns everything added since the given counts inside out (an inner wall).</summary>
        static void FlipSince(int v0, int t0)
        {
            for (int i = v0; i < k.N.Count; i++) k.N[i] = -k.N[i];
            for (int i = t0; i + 2 < k.T.Count; i += 3)
            {
                int tmp = k.T[i + 1];
                k.T[i + 1] = k.T[i + 2];
                k.T[i + 2] = tmp;
            }
        }

        // ------------------------------------------------------------------ hats

        static void Party()
        {
            Root(V3(0, 0.86f, -0.3f), -12);
            const float h = 1.5f, r = 0.6f;
            uint[] cols = { 0xff6b6b, 0x4dabf7 };
            for (int i = 0; i < 5; i++)
            {
                float y0 = i * 0.3f, y1 = (i + 1) * 0.3f;
                float r0 = r * (1 - y0 / h), r1 = i == 4 ? 0 : r * (1 - y1 / h);
                k.Tint(cols[i % 2]).Cylinder(V3(0, y0, 0), V3(0, y1, 0), r0, r1, 16, i == 0, false);
            }
            k.Tint(0xffd84a).Torus(V3(0, 0.04f, 0), 0.6f, 0.08f, 22, 6);
            k.Tint(0xffd84a).Blob(V3(0, 1.55f, 0), Vector3.one * 0.24f, 0.22f, 7, 1);
        }

        static void Bobble()
        {
            var c = V3(0, 0.5f, -0.42f);
            var r = V3(1.02f, 0.72f, 0.92f);
            k.Tint(0x4dabf7).Sphere(c, r, 18, 10, 0, 0.5f);
            k.Tint(0xffffff).Sphere(c, r * 1.012f, 18, 2, 0.3f, 0.36f);
            k.Tint(0xffd43b).Sphere(c, r * 1.012f, 18, 2, 0.39f, 0.45f);
            k.M = Matrix4x4.TRS(c, Quaternion.identity, V3(1.02f, 1.2f, 0.93f));
            k.Tint(0xffffff, 0.9f).Torus(Vector3.zero, 1.0f, 0.15f, 28, 8);
            k.M = Matrix4x4.identity;
            k.Tint(0xffffff).Blob(c + V3(0, 0.92f, 0), Vector3.one * 0.34f, 0.3f, 3, 2);
        }

        static void Propeller()
        {
            // Centred on the head's Y axis: the whole cap turns.
            var c = V3(0, 0.84f, 0);
            var r = V3(0.8f, 0.5f, 0.82f);
            uint[] cols = { 0xe03131, 0xffd43b, 0x4dabf7, 0x69db7c };
            for (int i = 0; i < 4; i++)
            {
                k.Tint(cols[i]);
                Wedge(c, r, i * Mathf.PI * 0.5f, (i + 1) * Mathf.PI * 0.5f, 6, 6);
            }
            k.M = Matrix4x4.TRS(c, Quaternion.identity, V3(1, 1, 1.025f));
            k.Tint(0xffffff, 0.9f).Torus(Vector3.zero, 0.8f, 0.06f, 24, 6);
            k.M = Matrix4x4.identity;
            k.Tint(0xffffff).Sphere(c + V3(0, 0.5f, 0), 0.1f, 10, 6);
            k.Tint(0x495057).Cylinder(V3(0, 1.3f, 0), V3(0, 1.62f, 0), 0.05f, 0.05f, 8);
            k.Tint(0xe03131).Sphere(V3(0, 1.64f, 0), 0.11f, 10, 7);
            for (int b = 0; b < 2; b++)
            {
                k.M = Matrix4x4.TRS(V3(0, 1.64f, 0), Quaternion.Euler(14, b * 90, 0), Vector3.one);
                k.Tint(0xffd43b).Box(Vector3.zero, V3(1.7f, 0.05f, 0.26f), 0, true);
                k.Tint(0xe03131).Sphere(V3(0.85f, 0, 0), V3(0.14f, 0.045f, 0.14f), 10, 5);
                k.Tint(0xe03131).Sphere(V3(-0.85f, 0, 0), V3(0.14f, 0.045f, 0.14f), 10, 5);
            }
            k.M = Matrix4x4.identity;
        }

        static void Wizard()
        {
            Root(V3(0, 0.88f, -0.36f), -8);
            k.Tint(0x5f3dc4, 0.9f).Cylinder(Vector3.zero, V3(0, 0.07f, 0), 1.12f, 1.08f, 24);
            k.Tint(0x5f3dc4);
            k.Cylinder(V3(0, 0.06f, 0), V3(0, 1.25f, -0.06f), 0.72f, 0.36f, 18, false, false);
            k.Sphere(V3(0, 1.25f, -0.06f), 0.36f, 14, 9);
            k.Cylinder(V3(0, 1.25f, -0.06f), V3(0.08f, 2.0f, -0.5f), 0.36f, 0, 14, false, false);
            k.Tint(0xffd43b).Sphere(V3(0.08f, 2.0f, -0.5f), 0.1f, 8, 6);
            k.Tint(0xffd43b).Cylinder(V3(0, 0.06f, 0), V3(0, 0.28f, 0), 0.735f, 0.68f, 18, false, false);

            // Stars and a moon on the lower cone.
            float[,] stars = { { 40, 0.62f, 0.15f }, { 140, 0.85f, 0.13f }, { 230, 0.55f, 0.15f }, { 300, 0.95f, 0.12f }, { 95, 1.05f, 0.11f }, { 190, 1.1f, 0.1f } };
            for (int i = 0; i < stars.GetLength(0); i++)
            {
                float a = stars[i, 0] * Mathf.Deg2Rad, h = stars[i, 1];
                float t = (h - 0.06f) / 1.19f, rr = 0.72f - t * 0.36f + 0.02f;
                var pos = V3(Mathf.Sin(a) * rr, h, Mathf.Cos(a) * rr - 0.06f * t);
                k.Tint(0xffd43b);
                Star(pos, V3(Mathf.Sin(a), 0.3f, Mathf.Cos(a)), stars[i, 2]);
            }
            {
                float h = 0.75f, t = (h - 0.06f) / 1.19f, rr = 0.72f - t * 0.36f + 0.03f;
                var pos = V3(0, h, rr - 0.06f * t);
                k.M = root * Matrix4x4.TRS(pos, Quaternion.LookRotation(V3(0, 0.3f, 1), Vector3.up), Vector3.one)
                      * Matrix4x4.Rotate(Quaternion.Euler(90, 0, 0));
                k.Tint(0xffe066).Torus(Vector3.zero, 0.14f, 0.05f, 12, 6, 220);
            }
            k.M = Matrix4x4.identity;
        }

        static void Flower()
        {
            Root(V3(0, 0.86f, -0.25f), -6);
            k.Tint(0x2f9e44).Cylinder(Vector3.zero, V3(0, 0.42f, 0), 0.08f, 0.07f, 8);
            Put(V3(0.2f, 0.22f, 0), V3(0, 0, 30));
            k.Tint(0x40c057).Sphere(Vector3.zero, V3(0.22f, 0.05f, 0.11f), 10, 6);
            for (int i = 0; i < 10; i++)
            {
                float a = i * 36f;
                float ar = a * Mathf.Deg2Rad;
                Put(V3(Mathf.Cos(ar) * 0.5f, 0.5f, Mathf.Sin(ar) * 0.5f), V3(0, -a, 14));
                k.Tint(0xffffff).Sphere(Vector3.zero, V3(0.3f, 0.07f, 0.15f), 10, 6);
            }
            Here();
            k.Tint(0xffd43b).Sphere(V3(0, 0.52f, 0), V3(0.28f, 0.16f, 0.28f), 14, 8);
            k.Tint(0xf59f00).Sphere(V3(0, 0.6f, 0), V3(0.16f, 0.1f, 0.16f), 10, 6);
            k.M = Matrix4x4.identity;
        }

        static void CatEars()
        {
            for (int s = -1; s <= 1; s += 2)
            {
                k.M = Matrix4x4.TRS(V3(s * 0.6f, 0.68f, -0.28f), Quaternion.Euler(-10, 0, -s * 22), V3(1, 1, 0.55f));
                k.Tint(0x495057).Cylinder(Vector3.zero, V3(0, 0.75f, 0), 0.36f, 0, 12);
                k.Tint(0xffb3c6).Cylinder(V3(0, 0.05f, 0.2f), V3(0, 0.6f, 0.06f), 0.2f, 0, 10);
            }
            k.M = Matrix4x4.identity;
        }

        static void BunnyEars()
        {
            for (int s = -1; s <= 1; s += 2)
            {
                k.M = Matrix4x4.TRS(V3(s * 0.38f, 0.78f, -0.38f), Quaternion.Euler(-14, s * 10, -s * 12), V3(1, 1, 0.6f));
                var p0 = Vector3.zero;
                var p1 = V3(0, 0.62f, 0);
                // The right ear flops over.
                var p2 = s > 0 ? V3(0.42f, 0.88f, 0) : V3(0, 1.15f, 0);
                var f = V3(0, 0, 0.17f);
                k.Tint(0xffffff, 0.95f).Capsule(p0, p1, 0.22f, 12);
                k.Tint(0xffffff, 0.95f).Capsule(p1, p2, 0.22f, 12);
                k.Tint(0xffb3c6).Capsule(V3(0, 0.15f, 0) + f, p1 + f, 0.12f, 10);
                k.Tint(0xffb3c6).Capsule(p1 + f, p2 + f, 0.12f, 10);
            }
            k.M = Matrix4x4.identity;
        }

        static void Chef()
        {
            Root(V3(0, 0.86f, -0.3f), -8);
            k.Tint(0xffffff, 0.92f).Cylinder(Vector3.zero, V3(0, 0.5f, 0), 0.66f, 0.7f, 18, false, false);
            k.Tint(0xf1f3f5).Torus(V3(0, 0.5f, 0), 0.7f, 0.04f, 24, 5);
            k.Tint(0xffffff);
            k.Sphere(V3(0, 0.98f, 0), 0.58f, 14, 9);
            k.Sphere(V3(0.42f, 0.82f, 0.06f), 0.45f, 14, 9);
            k.Sphere(V3(-0.42f, 0.82f, 0.06f), 0.45f, 14, 9);
            k.Sphere(V3(0, 0.82f, -0.42f), 0.45f, 14, 9);
            k.Sphere(V3(0, 0.8f, 0.38f), 0.42f, 14, 9);
            k.M = Matrix4x4.identity;
        }

        static float ConeR(float y) => 0.58f - (y - 0.1f) / 1.65f * 0.49f;

        static void Cone()
        {
            Root(V3(0, 0.84f, -0.3f), -6);
            k.Tint(0xff6b00).RoundBox(V3(0, 0.06f, 0), V3(1.35f, 0.12f, 1.35f), 0.2f, 3);
            k.Tint(0xff6b00).Cylinder(V3(0, 0.1f, 0), V3(0, 1.75f, 0), 0.58f, 0.09f, 16, false, true);
            float[] bands = { 0.55f, 0.82f, 1.12f, 1.34f };
            for (int i = 0; i < bands.Length; i += 2)
            {
                float y0 = bands[i], y1 = bands[i + 1];
                k.Tint(0xffffff).Cylinder(V3(0, y0, 0), V3(0, y1, 0), ConeR(y0) + 0.015f, ConeR(y1) + 0.015f, 16, false, false);
            }
            k.M = Matrix4x4.identity;
        }

        static void Cowboy()
        {
            Root(V3(0, 0.92f, -0.34f), -14);
            const uint felt = 0x9c6644;
            k.M = root * Matrix4x4.Scale(V3(1, 1, 0.84f));
            k.Tint(felt, 0.9f).Cylinder(Vector3.zero, V3(0, 0.06f, 0), 1.25f, 1.25f, 24);
            k.Tint(felt).Torus(V3(0, 0.07f, 0), 1.25f, 0.07f, 28, 6);
            Here();
            k.Tint(felt).Cylinder(V3(0, 0.04f, 0), V3(0, 0.72f, 0), 0.7f, 0.6f, 18, false, false);
            k.Tint(felt).Sphere(V3(0, 0.72f, 0), V3(0.6f, 0.16f, 0.6f), 16, 6, 0, 0.5f);
            k.Tint(felt).Sphere(V3(0.2f, 0.76f, 0), V3(0.36f, 0.14f, 0.55f), 12, 6, 0, 0.5f);
            k.Tint(felt).Sphere(V3(-0.2f, 0.76f, 0), V3(0.36f, 0.14f, 0.55f), 12, 6, 0, 0.5f);
            k.Tint(0x3d2914).Cylinder(V3(0, 0.06f, 0), V3(0, 0.24f, 0), 0.715f, 0.69f, 18, false, false);
            k.Tint(0xffd43b);
            Star(V3(0, 0.16f, 0.72f), Vector3.forward, 0.12f);
            k.M = Matrix4x4.identity;
        }

        static void TopHat()
        {
            Root(V3(0, 0.9f, -0.32f), -10);
            k.M = root * Matrix4x4.Scale(V3(1, 1, 0.9f));
            k.Tint(0x1c1c1f).Cylinder(Vector3.zero, V3(0, 0.06f, 0), 1.0f, 1.0f, 24);
            k.Tint(0x343a40).Torus(V3(0, 0.06f, 0), 1.0f, 0.06f, 28, 6);
            Here();
            k.Tint(0x1c1c1f).Cylinder(V3(0, 0.04f, 0), V3(0, 1.25f, 0), 0.64f, 0.7f, 20, false, true);
            k.Tint(0xe03131).Cylinder(V3(0, 0.06f, 0), V3(0, 0.32f, 0), 0.66f, 0.67f, 20, false, false);
            k.Tint(0x343a40).Torus(V3(0, 1.25f, 0), 0.7f, 0.035f, 24, 5);
            k.M = Matrix4x4.identity;
        }

        static void Pirate()
        {
            Root(V3(0, 0.88f, -0.32f), -10);
            k.Tint(0x1c1c1f).Sphere(V3(0, 0.02f, 0), V3(0.78f, 0.6f, 0.72f), 16, 8, 0, 0.5f);
            // Tricorn: three turned-up flaps, one flat to the front for the emblem.
            const float inR = 0.58f, w = 1.95f;
            for (int i = 0; i < 3; i++)
            {
                float a = i * 120f, ar = a * Mathf.Deg2Rad;
                Put(V3(Mathf.Sin(ar) * inR, 0.3f, Mathf.Cos(ar) * inR), V3(18, a, 0));
                k.Tint(0x25262b).RoundBox(Vector3.zero, V3(w, 0.56f, 0.1f), 0.05f, 2);
                k.Tint(0xffd43b).Box(V3(0, 0.27f, 0), V3(w * 0.98f, 0.06f, 0.13f));
            }
            // Skull and crossbones on the front flap.
            Put(V3(0, 0.3f, inR), V3(18, 0, 0));
            k.Tint(0xffffff).Capsule(V3(-0.16f, -0.15f, 0.07f), V3(0.16f, 0.12f, 0.07f), 0.03f, 6);
            k.Tint(0xffffff).Capsule(V3(0.16f, -0.15f, 0.07f), V3(-0.16f, 0.12f, 0.07f), 0.03f, 6);
            k.Tint(0xffffff).Sphere(V3(0, 0.05f, 0.09f), V3(0.14f, 0.12f, 0.06f), 10, 7);
            k.Tint(0xffffff).Box(V3(0, -0.05f, 0.08f), V3(0.12f, 0.07f, 0.05f));
            k.Tint(0x1c1c1f).Sphere(V3(0.05f, 0.06f, 0.14f), 0.03f, 6, 4);
            k.Tint(0x1c1c1f).Sphere(V3(-0.05f, 0.06f, 0.14f), 0.03f, 6, 4);
            k.M = Matrix4x4.identity;
        }

        static void Viking()
        {
            var c = V3(0, 0.5f, -0.4f);
            var r = V3(1.04f, 0.72f, 0.95f);
            k.Tint(0xadb5bd).Sphere(c, r, 18, 10, 0, 0.5f);
            // Front-to-back ridge over the top.
            k.M = Matrix4x4.Translate(c) * Matrix4x4.Scale(r) * Matrix4x4.Rotate(Quaternion.Euler(-90, 90, 0));
            k.Tint(0xc9a227).Torus(Vector3.zero, 1.0f, 0.08f, 18, 6, 180);
            k.M = Matrix4x4.TRS(c, Quaternion.identity, V3(1.04f, 1.2f, 0.95f));
            k.Tint(0x8a5a3a).Torus(Vector3.zero, 1.0f, 0.11f, 28, 7);
            k.M = Matrix4x4.identity;
            for (int i = 0; i < 10; i++)
            {
                float t = i / 10f * Mathf.PI * 2;
                k.Tint(0xdee2e6).Sphere(c + V3(Mathf.Cos(t) * 1.04f * 1.1f, 0, Mathf.Sin(t) * 0.95f * 1.12f), 0.05f, 6, 4);
            }
            for (int s = -1; s <= 1; s += 2)
            {
                Vector3[] p = { V3(s * 0.92f, 0.8f, -0.42f), V3(s * 1.3f, 1.0f, -0.42f), V3(s * 1.5f, 1.38f, -0.46f), V3(s * 1.44f, 1.78f, -0.5f) };
                float[] rad = { 0.22f, 0.17f, 0.11f, 0 };
                k.Tint(0xfff1c9);
                for (int j = 0; j < 3; j++) k.Cylinder(p[j], p[j + 1], rad[j], rad[j + 1], 12, false, false);
                k.Sphere(p[1], rad[1], 10, 6);
                k.Sphere(p[2], rad[2], 10, 6);
                k.Tint(0x8a5a3a).Cylinder(p[0], Vector3.Lerp(p[0], p[1], 0.25f), 0.24f, 0.23f, 12);
            }
        }

        static void Halo()
        {
            // Centred on the head's Y axis, floating clear of the head: it spins.
            k.Tint(0xffe066).Torus(V3(0, 1.5f, 0), 0.7f, 0.1f, 32, 10);
            k.Tint(0xfff9db).Torus(V3(0, 1.57f, 0), 0.7f, 0.045f, 32, 5);
            for (int i = 0; i < 4; i++)
            {
                float t = (45 + i * 90) * Mathf.Deg2Rad;
                k.Tint(0xffffff).Sphere(V3(Mathf.Cos(t) * 0.7f, 1.62f, Mathf.Sin(t) * 0.7f), 0.05f, 6, 4);
            }
        }

        static void Crown()
        {
            Root(V3(0, 0.88f, -0.3f), -8);
            k.Tint(0xc92a2a).Sphere(V3(0, 0.05f, 0), V3(0.66f, 0.5f, 0.66f), 14, 8, 0, 0.5f);
            k.Tint(0xffd43b).Sphere(V3(0, 0.57f, 0), 0.08f, 8, 6);
            k.Tint(0xffd43b).Cylinder(Vector3.zero, V3(0, 0.42f, 0), 0.72f, 0.76f, 20, false, false);
            int v0 = k.V.Count, t0 = k.T.Count;
            k.Tint(0xe8b923, 0.8f).Cylinder(Vector3.zero, V3(0, 0.42f, 0), 0.7f, 0.74f, 20, false, false);
            FlipSince(v0, t0);
            k.Tint(0xfab005).Torus(V3(0, 0.02f, 0), 0.72f, 0.06f, 24, 6);
            k.Tint(0xfab005).Torus(V3(0, 0.42f, 0), 0.75f, 0.045f, 24, 5);
            for (int i = 0; i < 6; i++)
            {
                float a = i * 60 * Mathf.Deg2Rad;
                var d = V3(Mathf.Cos(a), 0, Mathf.Sin(a));
                var p = d * 0.75f + V3(0, 0.42f, 0);
                var tip = p + d * 0.03f + V3(0, 0.42f, 0);
                k.Tint(0xffd43b).Cylinder(p, tip, 0.16f, 0, 6, false, false);
                k.Tint(0xfff3bf).Sphere(tip + V3(0, 0.04f, 0), 0.07f, 8, 6);
                float ja = (i * 60 + 30) * Mathf.Deg2Rad;
                k.Tint(i % 2 == 0 ? 0xe03131u : 0x4dabf7u).Sphere(V3(Mathf.Cos(ja) * 0.77f, 0.21f, Mathf.Sin(ja) * 0.77f), 0.1f, 10, 7);
            }
            k.M = Matrix4x4.identity;
        }

        static void Acorn()
        {
            var c = V3(0, 0.52f, -0.4f);
            var r = V3(1.0f, 0.68f, 0.92f);
            k.Tint(0x7a5230).Sphere(c, r, 18, 10, 0, 0.5f);
            // Knobbly cup scales.
            float[] phis = { 28, 46, 64, 80 };
            int[] counts = { 7, 11, 14, 16 };
            for (int j = 0; j < phis.Length; j++)
            {
                float phi = phis[j] * Mathf.Deg2Rad;
                for (int i = 0; i < counts[j]; i++)
                {
                    float th = i / (float)counts[j] * Mathf.PI * 2 + j * 0.3f;
                    var dir = V3(Mathf.Sin(phi) * Mathf.Cos(th), Mathf.Cos(phi), Mathf.Sin(phi) * Mathf.Sin(th));
                    k.Tint((i + j) % 2 == 0 ? 0x8b5e34u : 0x6b4423u).Sphere(c + Vector3.Scale(dir, r), 0.11f, 8, 5);
                }
            }
            k.M = Matrix4x4.TRS(c, Quaternion.identity, V3(1.0f, 1.1f, 0.92f));
            k.Tint(0x5b3a1e).Torus(Vector3.zero, 1.02f, 0.13f, 28, 7);
            k.M = Matrix4x4.identity;
            var top = c + V3(0, r.y, 0);
            var mid = top + V3(0.05f, 0.28f, -0.04f);
            k.Tint(0x5b3a1e).Cylinder(top - V3(0, 0.05f, 0), mid, 0.09f, 0.07f, 8, false, false);
            k.Tint(0x5b3a1e).Sphere(mid, 0.07f, 8, 5);
            k.Tint(0x5b3a1e).Cylinder(mid, top + V3(0.2f, 0.4f, -0.08f), 0.07f, 0.05f, 8, false, true);
            k.M = Matrix4x4.TRS(top + V3(-0.18f, 0.08f, 0.05f), Quaternion.Euler(0, 30, -20), Vector3.one);
            k.Tint(0x5c940d).Sphere(Vector3.zero, V3(0.26f, 0.04f, 0.13f), 10, 6);
            k.M = Matrix4x4.identity;
        }

        static void FlowerCrown()
        {
            Root(V3(0, 0.8f, -0.22f), -16);
            k.M = root * Matrix4x4.Scale(V3(0.8f, 1, 0.72f));
            k.Tint(0x3f8f3a).Torus(Vector3.zero, 1.0f, 0.06f, 32, 6);
            uint[] cols = { 0xff8fab, 0xffd43b, 0xffffff, 0xa5d8ff, 0xffc9de };
            for (int i = 0; i < 8; i++)
            {
                float a = i / 8f * Mathf.PI * 2 + Mathf.PI * 0.5f;
                var bc = V3(Mathf.Cos(a) * 0.8f, 0.06f, Mathf.Sin(a) * 0.72f);
                Here();
                for (int p = 0; p < 5; p++)
                {
                    float pa = p / 5f * Mathf.PI * 2 + i;
                    k.Tint(cols[i % cols.Length]).Sphere(bc + V3(Mathf.Cos(pa) * 0.13f, 0.04f, Mathf.Sin(pa) * 0.13f), V3(0.1f, 0.05f, 0.1f), 7, 4);
                }
                k.Tint(0xffe066).Sphere(bc + V3(0, 0.07f, 0), 0.08f, 8, 5);
                float la = a + Mathf.PI / 8;
                Put(V3(Mathf.Cos(la) * 0.8f, 0.04f, Mathf.Sin(la) * 0.72f), V3(0, -(la * Mathf.Rad2Deg + 90), 0));
                k.Tint(0x51cf66).Sphere(Vector3.zero, V3(0.16f, 0.04f, 0.07f), 8, 5);
            }
            k.M = Matrix4x4.identity;
        }

        static void Antlers()
        {
            const uint bone = 0xe8d9b5;
            for (int s = -1; s <= 1; s += 2)
            {
                var p0 = V3(s * 0.38f, 0.78f, -0.38f);
                var p1 = V3(s * 0.68f, 1.3f, -0.52f);
                var p2 = V3(s * 0.98f, 1.8f, -0.48f);
                k.Tint(0xc9b48a).Sphere(p0 + V3(0, 0.05f, 0), 0.16f, 10, 7);
                k.Tint(bone).Cylinder(p0, p1, 0.12f, 0.095f, 10, false, false);
                k.Tint(bone).Sphere(p1, 0.095f, 8, 6);
                k.Tint(bone).Cylinder(p1, p2, 0.095f, 0.04f, 10, false, false);
                k.Tint(0xf8f0dc).Sphere(p2, 0.04f, 6, 4);
                Vector3[] bases = { Vector3.Lerp(p0, p1, 0.55f), p1, Vector3.Lerp(p1, p2, 0.55f) };
                Vector3[] offs = { V3(s * 0.02f, 0.42f, 0.32f), V3(s * 0.4f, 0.3f, 0.1f), V3(-s * 0.15f, 0.35f, 0.22f) };
                for (int t = 0; t < 3; t++)
                {
                    var tip = bases[t] + offs[t];
                    k.Tint(bone).Cylinder(bases[t], tip, 0.07f, 0.03f, 8, false, false);
                    k.Tint(0xf8f0dc).Sphere(tip, 0.03f, 6, 4);
                }
            }
        }
    
        // ------------------------------------------------------------------ London (A7, hats.ts)

        /// <summary>The Guards' tall black fur hat: a lumpy column, a red plume, a gold chin strap.</summary>
        static void Bearskin()
        {
            Root(V3(0, 0.78f, -0.3f), -6);
            const uint fur = 0x16161a;
            k.Tint(fur).Capsule(V3(0, 0.55f, 0), V3(0, 1.75f, 0), 0.72f, 16);
            foreach (var (x, y, z) in new[] { (0.4f, 1.7f, 0.35f), (-0.45f, 1.3f, 0.3f), (0.1f, 2.0f, -0.3f), (-0.3f, 0.75f, -0.45f), (0.5f, 1.0f, -0.2f) })
                k.Tint(0x202026).Blob(V3(x, y, z), V3(0.34f, 0.34f, 0.34f), 0.2f, (int)(x * 100 + y * 10), 1, true);
            k.Tint(0xd8342c).Capsule(V3(-0.74f, 1.0f, 0), V3(-0.66f, 1.75f, 0), 0.12f, 8);
            Put(V3(0, 0.05f, 0), V3(0, 0, 90));
            k.Tint(0xf2c230).Torus(Vector3.zero, 0.98f, 0.05f, 20, 6, 180);
            k.M = Matrix4x4.identity;
        }

        /// <summary>The custodian helmet: a tall navy dome, a silver star badge, a little rose on top.</summary>
        static void Bobby()
        {
            Root(V3(0, 0.66f, -0.28f), -8);
            const uint navy = 0x1f2a52;
            k.Tint(navy).Sphere(V3(0, 0.55f, 0), V3(0.85f, 1.23f, 0.9f), 18, 12, 0, 0.62f);
            k.Tint(navy).Torus(V3(0, 0.05f, 0), 0.88f, 0.1f, 22, 6);
            k.Tint(0x2a3666).Cylinder(V3(0, 0.12f, 0), V3(0, 0.3f, 0), 0.86f, 0.84f, 20, false, false);
            k.Tint(0xd3dae2);
            Star(V3(0, 0.78f, 0.86f), V3(0, 0.25f, 1), 0.3f);
            k.M = root;
            k.Tint(0xd3dae2).Sphere(V3(0, 1.78f, 0), 0.16f, 8, 6);
            k.M = Matrix4x4.identity;
        }

        /// <summary>A top hat in the flag: a blue crown with a red-and-white cross on each side, a red brim.</summary>
        static void UnionTopHat()
        {
            Root(V3(0, 0.9f, -0.32f), -10);
            k.Tint(0xc8102e).Cylinder(Vector3.zero, V3(0, 0.1f, 0), 1.1f, 1.1f, 24);
            k.Tint(0x1f3fa8).Cylinder(V3(0, 0.05f, 0), V3(0, 1.3f, 0), 0.7f, 0.68f, 20, false, true);
            for (int i = 0; i < 4; i++)
            {
                float a = i * 90;
                var face = Quaternion.Euler(0, a, 0);
                foreach (var (w, h, c, d) in new[] { (0.42f, 1.2f, 0xffffffu, 0.705f), (0.22f, 1.2f, 0xc8102eu, 0.715f), (0.95f, 0.3f, 0xffffffu, 0.705f), (0.95f, 0.15f, 0xc8102eu, 0.715f) })
                {
                    k.M = root * Matrix4x4.TRS(face * V3(0, 0.67f, d), face, Vector3.one);
                    k.Tint(c).Box(Vector3.zero, V3(w * 0.72f, h * (h > 1 ? 0.95f : 1), 0.02f));
                }
            }
            k.M = root;
            k.Tint(0xffffff).Cylinder(V3(0, 1.29f, 0), V3(0, 1.33f, 0), 0.68f, 0.68f, 20);
            k.M = Matrix4x4.identity;
        }

        /// <summary>The Yeoman Warder's Tudor bonnet: a flat navy crown, a red band, red-white-blue rosettes.</summary>
        static void Beefeater()
        {
            Root(V3(0, 0.88f, -0.3f), -8);
            const uint navy = 0x1d2557;
            k.Tint(navy).Cylinder(V3(0, -0.04f, 0), V3(0, 0.14f, 0), 1.2f, 1.15f, 22);
            k.Tint(navy).Cylinder(V3(0, 0.17f, 0), V3(0, 0.59f, 0), 0.82f, 1.0f, 22);
            k.Tint(0xc8102e).Cylinder(V3(0, 0.15f, 0), V3(0, 0.29f, 0), 0.87f, 0.87f, 22, false, false);
            for (int i = 0; i < 5; i++)
            {
                float a = i / 5f * Mathf.PI * 2 + Mathf.PI / 2;
                var d = V3(Mathf.Cos(a), 0, Mathf.Sin(a));
                foreach (var (r, c, o) in new[] { (0.17f, 0xc8102eu, 0.88f), (0.11f, 0xffffffu, 0.91f), (0.06f, 0x1f3fa8u, 0.94f) })
                    k.Tint(c).Cylinder(d * o + V3(0, 0.24f, 0), d * (o + 0.05f) + V3(0, 0.24f, 0), r, r, 10);
            }
            k.M = Matrix4x4.identity;
        }

        /// <summary>A City gent's bowler: a round black dome, a curled brim, a grey band.</summary>
        static void Bowler()
        {
            Root(V3(0, 0.86f, -0.3f), -10);
            const uint felt = 0x1c1c1f;
            k.Tint(felt).Sphere(V3(0, 0.12f, 0), V3(0.78f, 0.82f, 0.82f), 18, 10, 0, 0.5f);
            k.M = root * Matrix4x4.TRS(V3(0, 0.12f, 0), Quaternion.identity, V3(1, 1, 1.12f));
            k.Tint(felt).Torus(Vector3.zero, 0.9f, 0.1f, 24, 6);
            k.M = root;
            k.Tint(0x3a3a40).Cylinder(V3(0, 0.13f, 0), V3(0, 0.27f, 0), 0.8f, 0.79f, 20, false, false);
            k.M = Matrix4x4.identity;
        }

        /// <summary>A sparkly tiara: a silver arc across the front with a fan of points and jewels.</summary>
        static void Tiara()
        {
            Root(V3(0, 0.86f, -0.18f), -6);
            k.Tint(0xe8ecf2).Torus(V3(0, 0.15f, 0), 0.85f, 0.08f, 22, 6, 180);
            for (int i = 0; i < 7; i++)
            {
                float a = i / 6f * Mathf.PI;
                float tall = 0.45f + 0.6f * Mathf.Sin(a);
                var b = V3(Mathf.Cos(a) * 0.85f, 0.15f, Mathf.Sin(a) * 0.85f);
                k.Tint(0xe8ecf2).Cylinder(b, b + V3(0, tall, 0), 0.1f, 0, 4);
                k.Tint(i == 3 ? 0x4dabf7u : i % 2 == 1 ? 0xff8fabu : 0xffffffu).Sphere(V3(Mathf.Cos(a) * 0.9f, 0.3f, Mathf.Sin(a) * 0.9f), i == 3 ? 0.2f : 0.11f, 4, 2);
            }
            k.M = Matrix4x4.identity;
        }

        /// <summary>The detective's cap: a tweed dome, a peak front and back, ear flaps tied up with a bow.</summary>
        static void Deerstalker()
        {
            Root(V3(0, 0.74f, -0.3f), -8);
            const uint tweed = 0x9a7b52;
            k.Tint(tweed).Sphere(Vector3.zero, V3(1.05f, 0.76f, 1.1f), 18, 10, 0, 0.5f);
            for (int i = 0; i < 3; i++) k.Tint(0x6b5236).Torus(V3(0, 0.2f + i * 0.2f, 0), Mathf.Sqrt(Mathf.Max(0.01f, 1 - Mathf.Pow((0.2f + i * 0.2f) / 0.76f, 2))) * 1.06f, 0.022f, 22, 4);
            for (int s = -1; s <= 1; s += 2)
            {
                k.Tint(0x8a6b45).Sphere(V3(0, 0.06f, s * 1.0f), V3(0.66f, 0.07f, 0.48f), 12, 4, 0, 0.5f);
                Put(V3(s * 0.88f, 0.55f, 0), V3(0, 0, -s * 28));
                k.Tint(tweed).Box(Vector3.zero, V3(0.08f, 0.5f, 0.6f));
                k.M = root;
            }
            k.Tint(0x5a3a24).Torus(V3(0, 0.78f, 0), 0.12f, 0.05f, 10, 5);
            k.M = Matrix4x4.identity;
        }

        /// <summary>The Pearly King's flat cap, sewn all over with pearl buttons.</summary>
        static void PearlyCap()
        {
            Root(V3(0, 0.84f, -0.25f), -8);
            const uint cloth = 0x1c1c1f;
            k.Tint(cloth).Sphere(Vector3.zero, V3(1.06f, 0.48f, 1.14f), 18, 10, 0, 0.5f);
            k.Tint(cloth).Sphere(V3(0, 0.04f, 0.9f), V3(0.68f, 0.06f, 0.45f), 14, 4, 0, 0.5f);
            for (int ring = 0; ring < 3; ring++)
            {
                int n = 10 - ring * 3;
                for (int i = 0; i < n; i++)
                {
                    float a = i / (float)n * Mathf.PI * 2 + ring * 0.3f, r = 0.9f - ring * 0.32f;
                    float y = Mathf.Sqrt(Mathf.Max(0, 1 - (r / 1.05f) * (r / 1.05f))) * 0.48f + 0.04f;
                    k.Tint(0xfffaf0).Sphere(V3(Mathf.Cos(a) * r * 1.0f, y, Mathf.Sin(a) * r * 1.08f), 0.075f, 6, 4);
                }
            }
            for (int i = 0; i < 4; i++) k.Tint(0xfffaf0).Sphere(V3(-0.45f + i * 0.3f, 0.1f, 1.18f), 0.065f, 6, 4);
            k.M = Matrix4x4.identity;
        }

        /// <summary>A clock tower for a hat: honey stone, a clock face on every side, a slate spire, gold on top.</summary>
        static void TinyBigBen()
        {
            Root(V3(0, 0.88f, -0.3f), -6);
            const uint stone = 0xe2b85c;
            k.Tint(stone).Box(V3(0, 0.75f, 0), V3(0.7f, 1.5f, 0.7f));
            for (int i = 0; i < 4; i++) k.Tint(0xc99a40).Box(V3(0, 0.3f + i * 0.33f, 0), V3(0.74f, 0.05f, 0.74f));
            k.Tint(stone).Box(V3(0, 1.85f, 0), V3(0.86f, 0.75f, 0.86f));
            for (int i = 0; i < 4; i++)
            {
                var face = Quaternion.Euler(0, i * 90, 0);
                k.M = root * Matrix4x4.TRS(face * V3(0, 1.85f, 0.43f), face * Quaternion.Euler(90, 0, 0), Vector3.one);
                k.Tint(0xfffbea).Cylinder(Vector3.zero, V3(0, 0.03f, 0), 0.3f, 0.3f, 18);
                k.Tint(0x1c1c1f).Box(V3(0, 0.04f, -0.1f), V3(0.04f, 0.02f, 0.24f));
                k.Tint(0x1c1c1f).Box(V3(0.07f, 0.04f, 0), V3(0.16f, 0.02f, 0.04f));
            }
            k.M = root * Matrix4x4.TRS(V3(0, 2.22f, 0), Quaternion.Euler(0, 45, 0), Vector3.one);
            k.Tint(0x434a57).Cylinder(Vector3.zero, V3(0, 0.9f, 0), 0.62f, 0, 4);
            k.M = root;
            k.Tint(0xf2c230).Cylinder(V3(0, 3.0f, 0), V3(0, 3.55f, 0), 0.07f, 0, 6);
            k.M = Matrix4x4.identity;
        }
    }
}
