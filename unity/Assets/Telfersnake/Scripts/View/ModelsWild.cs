using Telfer.Sim;
using UnityEngine;

namespace Telfer.View
{
    /// <summary>
    /// The wild side of the remaster: forest animals and food, the bear and the wolf, the park's
    /// kids and grown-ups, the magic creatures of the Common, projectiles and the fallen log.
    /// Same cartoon style as <see cref="Models"/>: chunky, rounded, bright, googly-eyed.
    /// </summary>
    public static class ModelsWild
    {
        static readonly Mesh[] forest = new Mesh[14];
        static readonly Mesh[] food = new Mesh[10];
        static readonly Mesh[] predators = new Mesh[2];
        static readonly Mesh[] creatures = new Mesh[8];
        static readonly Mesh[] projectiles = new Mesh[2];
        static Mesh log;

        // ================================================================== public API

        public static Mesh ForestAnimal(AnimalKind k)
        {
            if (k < AnimalKind.Squirrel) return Models.Animal(k);
            if (k >= AnimalKind.Corgi) return ModelsLondonZoo.Animal(k);
            int i = (int)k;
            if (forest[i] == null) forest[i] = BuildForestAnimal(k);
            return forest[i];
        }

        public static Mesh ForestFood(FoodKind k)
        {
            if (k < FoodKind.Mushroom) return Models.Food(k);
            if (k >= FoodKind.FishChips) return ModelsLondonZoo.Food(k);
            int i = (int)k;
            if (food[i] == null) food[i] = BuildForestFood(k);
            return food[i];
        }

        public static Mesh Predator(PredatorKind k)
        {
            int i = (int)k;
            if (predators[i] == null) predators[i] = k == PredatorKind.Bear ? BuildBear() : BuildWolf();
            return predators[i];
        }

        public static Mesh Creature(CreatureKind k)
        {
            if (k >= CreatureKind.Dragon) return ModelsLondonZoo.Legend(k);
            int i = (int)k;
            if (creatures[i] == null) creatures[i] = BuildCreature(k);
            return creatures[i];
        }

        public static Mesh Projectile(ProjectileKind k)
        {
            int i = (int)k;
            if (k == ProjectileKind.Chip) return ModelsLondonZoo.Chip();
            if (projectiles[i] == null) projectiles[i] = k == ProjectileKind.Pebble ? BuildPebble() : BuildKiss();
            return projectiles[i];
        }

        public static Mesh Log()
        {
            if (log == null) log = BuildLog();
            return log;
        }

        // ================================================================== shared bits

        /// <summary>Googly eyes: white ball, black pupil, white highlight dot.</summary>
        static void Eyes(MeshKit k, Vector3 centre, float spacing, float size, float forward = 0.6f)
        {
            for (int s = -1; s <= 1; s += 2)
            {
                var p = centre + new Vector3(s * spacing, 0, 0);
                k.Tint(0xffffff).Sphere(p, size, 10, 8);
                k.Tint(0x111111).Sphere(p + new Vector3(s * size * 0.15f, size * 0.1f, size * forward), size * 0.55f, 8, 6);
                k.Tint(0xffffff).Sphere(p + new Vector3(s * size * 0.05f, size * 0.4f, size * (forward + 0.3f)), size * 0.18f, 6, 4);
            }
        }

        /// <summary>An upturned arc in the XY plane at depth c.z.</summary>
        static void Smile(MeshKit k, Vector3 c, float w, float h, float r, uint col)
        {
            k.Tint(col);
            for (int i = 0; i < 5; i++)
            {
                float a0 = Mathf.Lerp(-0.8f, 0.8f, i / 5f), a1 = Mathf.Lerp(-0.8f, 0.8f, (i + 1) / 5f);
                Vector3 P(float a) => c + new Vector3(Mathf.Sin(a) * w, (1 - Mathf.Cos(a)) * h, 0);
                k.Cylinder(P(a0), P(a1), r, r, 4, false, false);
            }
        }

        /// <summary>Two little brows; a positive angle lowers the inner ends (cross but cute).</summary>
        static void Brows(MeshKit k, Vector3 centre, float spacing, float len, float angle, uint col)
        {
            k.Tint(col);
            for (int s = -1; s <= 1; s += 2)
            {
                k.M = Matrix4x4.TRS(centre + new Vector3(s * spacing, 0, 0), Quaternion.Euler(0, 0, s * angle), Vector3.one);
                k.Box(Vector3.zero, new Vector3(len, len * 0.24f, len * 0.3f));
            }
            k.M = Matrix4x4.identity;
        }

        /// <summary>A few bright floating motes in a creature's glow colour.</summary>
        static void Sparkles(MeshKit k, Vector3 c, float rad, int n, uint glow, int seed)
        {
            var rng = new System.Random(seed);
            k.C = Color.Lerp(MeshKit.Hex(glow), Color.white, 0.45f);
            for (int i = 0; i < n; i++)
            {
                float th = (float)rng.NextDouble() * Mathf.PI * 2, y = (float)rng.NextDouble() * 0.9f - 0.2f;
                var dir = new Vector3(Mathf.Cos(th), y, Mathf.Sin(th)).normalized;
                k.Sphere(c + dir * rad, 0.022f + (float)rng.NextDouble() * 0.02f, 6, 4);
            }
        }

        static Color Light(uint hex, float t) => Color.Lerp(MeshKit.Hex(hex), Color.white, t);

        // ================================================================== forest animals

        static Mesh BuildForestAnimal(AnimalKind kind)
        {
            var k = new MeshKit();
            switch (kind)
            {
                case AnimalKind.Squirrel:
                    Squirrel(k, 1, 0xc8642a, 0xf5e1c0, 0xd9773a);
                    return k.ToMesh("squirrel");
                case AnimalKind.Crow: BuildCrow(k); return k.ToMesh("crow");
                case AnimalKind.Deer:
                    Deer(k, 1, 0xb5773f, 0xf0dcc0, 0x9a6232, 0x3a2a20, 0xe8d8b0, true);
                    return k.ToMesh("deer");
                case AnimalKind.Hedgehog: BuildHedgehog(k); return k.ToMesh("hedgehog");
                case AnimalKind.Fox:
                    Fox(k, 1, 0xe8732a, 0xfaf3e6, 0x2a2220, 0x2a2220, 1, 0xfaf3e6);
                    return k.ToMesh("fox");
                default: BuildPigeon(k); return k.ToMesh("pigeon");
            }
        }

        /// <summary>A squirrel sitting up, with a big S-curled bushy tail. ~0.58 m long at sc = 1.</summary>
        static void Squirrel(MeshKit k, float sc, uint coat, uint belly, uint tail)
        {
            Vector3 P(float x, float y, float z) => new Vector3(x, y, z) * sc;
            // Tail first, so it reads as one plush S behind the body.
            for (int i = 0; i <= 7; i++)
            {
                float t = i / 7f;
                var p = P(0, 0.1f + 0.45f * t, -0.17f - 0.12f * Mathf.Sin(t * Mathf.PI) + 0.1f * t * t);
                float r = (0.055f + 0.05f * Mathf.Sin(t * Mathf.PI * 0.9f)) * sc;
                k.C = Color.Lerp(MeshKit.Hex(tail), Color.white, i >= 6 ? 0.25f : 0.05f * (i % 2));
                k.Sphere(p, r, 10, 8);
            }
            k.Tint(coat).Sphere(P(0, 0.16f, -0.03f), P(0.1f, 0.12f, 0.14f), 14, 10);
            k.Tint(belly).Sphere(P(0, 0.15f, 0.04f), P(0.075f, 0.09f, 0.08f), 10, 8);
            for (int s = -1; s <= 1; s += 2)
            {
                k.Tint(coat).Sphere(P(s * 0.08f, 0.09f, -0.06f), P(0.045f, 0.065f, 0.08f), 10, 8);
                k.Tint(coat).Sphere(P(s * 0.06f, 0.012f, 0.0f), P(0.03f, 0.014f, 0.055f), 8, 4);
                k.Tint(belly).Sphere(P(s * 0.035f, 0.19f, 0.13f), 0.026f * sc, 8, 6);
                k.Tint(coat).Cylinder(P(s * 0.05f, 0.36f, 0.08f), P(s * 0.065f, 0.44f, 0.07f), 0.03f * sc, 0, 6);
                k.Tint(tail).Sphere(P(s * 0.066f, 0.445f, 0.068f), 0.012f * sc, 6, 4);
            }
            k.Tint(coat).Sphere(P(0, 0.3f, 0.1f), P(0.09f, 0.085f, 0.09f), 14, 10);
            k.Tint(belly).Sphere(P(0, 0.275f, 0.17f), P(0.05f, 0.04f, 0.04f), 10, 8);
            k.Tint(0x3a2418).Sphere(P(0, 0.29f, 0.207f), 0.016f * sc, 6, 4);
            // A little acorn held in the paws.
            k.Tint(0xc9883e).Sphere(P(0, 0.19f, 0.155f), P(0.022f, 0.028f, 0.022f), 8, 6);
            k.Tint(0x7a5230).Sphere(P(0, 0.215f, 0.155f), P(0.025f, 0.012f, 0.025f), 8, 4);
            Eyes(k, P(0, 0.32f, 0.16f), 0.042f * sc, 0.026f * sc);
        }

        static void BuildCrow(MeshKit k)
        {
            k.M = Matrix4x4.TRS(new Vector3(0, 0.28f, -0.02f), Quaternion.Euler(-12, 0, 0), Vector3.one);
            k.Tint(0x1b1d24).Sphere(Vector3.zero, new Vector3(0.15f, 0.15f, 0.25f), 14, 10);
            k.Tint(0x3a4668).Sphere(new Vector3(0, 0.11f, -0.02f), new Vector3(0.07f, 0.03f, 0.12f), 10, 6); // glossy sheen
            for (int s = -1; s <= 1; s += 2)
            {
                k.Tint(0x262b3a).Sphere(new Vector3(s * 0.135f, 0.01f, -0.05f), new Vector3(0.04f, 0.1f, 0.22f), 10, 8);
                k.Tint(0x4a5880).Sphere(new Vector3(s * 0.16f, 0.05f, -0.02f), new Vector3(0.012f, 0.03f, 0.1f), 8, 4);
            }
            k.M = Matrix4x4.TRS(new Vector3(0, 0.24f, -0.3f), Quaternion.Euler(-8, 0, 0), Vector3.one);
            k.Tint(0x15171d).Sphere(Vector3.zero, new Vector3(0.09f, 0.022f, 0.15f), 10, 6);
            k.M = Matrix4x4.identity;
            k.Tint(0x1b1d24).Sphere(new Vector3(0, 0.44f, 0.19f), 0.11f, 14, 10);
            k.Tint(0x3a4668).Sphere(new Vector3(0, 0.53f, 0.17f), new Vector3(0.05f, 0.02f, 0.06f), 8, 4);
            k.Tint(0x3d3f45).Cylinder(new Vector3(0, 0.43f, 0.27f), new Vector3(0, 0.405f, 0.43f), 0.045f, 0, 8);
            k.Tint(0x55585f).Sphere(new Vector3(0, 0.44f, 0.29f), new Vector3(0.035f, 0.02f, 0.03f), 6, 4);
            Eyes(k, new Vector3(0, 0.47f, 0.26f), 0.05f, 0.03f);
            k.Tint(0x3d3f45);
            for (int s = -1; s <= 1; s += 2)
            {
                k.Cylinder(new Vector3(s * 0.05f, 0, 0.01f), new Vector3(s * 0.05f, 0.16f, 0), 0.014f, 0.016f, 5);
                for (int t = -1; t <= 1; t++)
                    k.Cylinder(new Vector3(s * 0.05f, 0.008f, 0.01f), new Vector3(s * 0.05f + t * 0.025f, 0.008f, 0.08f), 0.01f, 0.006f, 4);
            }
        }

        /// <summary>A slender deer (or the magic stag). ~1.22 m nose to tail at sc = 1.</summary>
        static void Deer(MeshKit k, float sc, uint coat, uint belly, uint leg, uint hoof, uint antler, bool spots)
        {
            Vector3 P(float x, float y, float z) => new Vector3(x, y, z) * sc;
            k.Tint(coat).Sphere(P(0, 0.72f, 0), P(0.2f, 0.22f, 0.45f), 16, 12);
            k.Tint(belly).Sphere(P(0, 0.64f, 0.02f), P(0.165f, 0.15f, 0.37f), 12, 8);
            k.Tint(belly).Sphere(P(0, 0.8f, 0.36f), P(0.11f, 0.12f, 0.1f), 10, 8);
            if (spots)
                foreach (var (x, z) in new[] { (0.08f, 0.15f), (-0.08f, 0.05f), (0.09f, -0.1f), (-0.07f, -0.2f), (0.05f, -0.28f), (-0.1f, 0.2f) })
                {
                    float y = 0.72f + 0.22f * Mathf.Sqrt(Mathf.Max(0, 1 - x * x / 0.04f - z * z / 0.2025f)) - 0.008f;
                    k.Tint(0xf6e7cf).Sphere(P(x, y, z), P(0.03f, 0.012f, 0.03f), 6, 4);
                }
            foreach (var (x, z) in new[] { (0.11f, 0.3f), (-0.11f, 0.3f), (0.11f, -0.3f), (-0.11f, -0.3f) })
            {
                k.Tint(coat).Sphere(P(x, 0.66f, z), P(0.075f, 0.15f, 0.1f), 10, 8);
                k.Tint(leg).Cylinder(P(x, 0.06f, z), P(x, 0.62f, z), 0.035f * sc, 0.048f * sc, 7);
                k.Tint(hoof).Cylinder(P(x, 0, z + 0.005f), P(x, 0.07f, z), 0.045f * sc, 0.038f * sc, 7);
            }
            k.Tint(coat).Cylinder(P(0, 0.8f, 0.3f), P(0, 1.13f, 0.46f), 0.1f * sc, 0.075f * sc, 10);
            k.Tint(coat).Sphere(P(0, 1.18f, 0.5f), P(0.11f, 0.11f, 0.13f), 14, 10);
            k.Tint(belly).Sphere(P(0, 1.12f, 0.63f), P(0.07f, 0.06f, 0.08f), 10, 8);
            k.Tint(0x1e1a18).Sphere(P(0, 1.135f, 0.705f), 0.026f * sc, 8, 6);
            k.Tint(0xffffff).Sphere(P(0, 0.84f, -0.45f), P(0.06f, 0.08f, 0.05f), 10, 8);
            for (int s = -1; s <= 1; s += 2)
            {
                k.M = Matrix4x4.TRS(P(s * 0.13f, 1.26f, 0.45f), Quaternion.Euler(0, 0, s * 25), Vector3.one);
                k.Tint(coat).Sphere(Vector3.zero, P(0.085f, 0.03f, 0.045f), 10, 6);
                k.Tint(0xf3c7b5).Sphere(new Vector3(0, 0.012f, 0.012f) * sc, P(0.06f, 0.02f, 0.03f), 8, 4);
                k.M = Matrix4x4.identity;
                // Antlers: a main beam with three tines.
                var b0 = P(s * 0.05f, 1.27f, 0.46f);
                var a1 = P(s * 0.13f, 1.45f, 0.42f);
                var a2 = P(s * 0.22f, 1.6f, 0.36f);
                float rm = 0.022f * sc, rt = 0.016f * sc;
                k.Tint(antler);
                k.Cylinder(b0, a1, rm * 1.2f, rm, 6, true, false);
                k.Sphere(a1, rm, 6, 4);
                k.Cylinder(a1, a2, rm, rm * 0.8f, 6, false, false);
                k.Sphere(a2, rm * 0.8f, 6, 4);
                k.Cylinder(a1, P(s * 0.11f, 1.58f, 0.52f), rt, rt * 0.4f, 5, false);
                k.Cylinder(a2, P(s * 0.2f, 1.74f, 0.42f), rt, rt * 0.4f, 5, false);
                k.Cylinder(a2, P(s * 0.32f, 1.68f, 0.33f), rt, rt * 0.4f, 5, false);
            }
            Eyes(k, P(0, 1.22f, 0.585f), 0.068f * sc, 0.035f * sc);
        }

        static void BuildHedgehog(MeshKit k)
        {
            var c = new Vector3(0, 0.12f, -0.03f);
            var r = new Vector3(0.2f, 0.17f, 0.25f);
            k.Tint(0x7a5638).Sphere(c, r, 16, 10);
            int n = 0;
            for (int ring = 0; ring < 5; ring++)
            {
                float phi = 0.15f + ring * 0.27f;
                int count = ring == 0 ? 5 : 8 + ring * 3;
                for (int i = 0; i < count; i++)
                {
                    float th = (i + ring * 0.5f) / count * Mathf.PI * 2;
                    var dir = new Vector3(Mathf.Sin(phi) * Mathf.Cos(th), Mathf.Cos(phi), Mathf.Sin(phi) * Mathf.Sin(th));
                    if (dir.z > 0.45f) continue; // keep the face clear
                    var p = c + Vector3.Scale(dir, r) * 0.95f;
                    var nrm = new Vector3(dir.x / r.x, dir.y / r.y, dir.z / r.z).normalized;
                    nrm = (nrm + new Vector3(0, 0, -0.35f)).normalized; // swept back
                    k.Tint(n % 3 == 0 ? 0xe8d6b0u : 0x4a3222u).Cylinder(p, p + nrm * 0.1f, 0.028f, 0, 5);
                    n++;
                }
            }
            k.Tint(0xe6c9a0).Sphere(new Vector3(0, 0.08f, 0.0f), new Vector3(0.15f, 0.07f, 0.2f), 12, 8);
            k.Tint(0xe6c9a0).Sphere(new Vector3(0, 0.11f, 0.17f), new Vector3(0.1f, 0.09f, 0.1f), 12, 10);
            k.Tint(0xe6c9a0).Cylinder(new Vector3(0, 0.1f, 0.24f), new Vector3(0, 0.085f, 0.34f), 0.055f, 0.022f, 10);
            k.Tint(0x1e1a18).Sphere(new Vector3(0, 0.086f, 0.345f), 0.024f, 8, 6);
            k.Tint(0xf4a3a3).Sphere(new Vector3(0.06f, 0.09f, 0.24f), new Vector3(0.022f, 0.015f, 0.01f), 6, 4);
            k.Tint(0xf4a3a3).Sphere(new Vector3(-0.06f, 0.09f, 0.24f), new Vector3(0.022f, 0.015f, 0.01f), 6, 4);
            for (int s = -1; s <= 1; s += 2)
            {
                k.Tint(0xd1b088).Sphere(new Vector3(s * 0.08f, 0.2f, 0.15f), new Vector3(0.03f, 0.03f, 0.018f), 8, 6);
                k.Tint(0x5a3d28).Sphere(new Vector3(s * 0.1f, 0.02f, 0.12f), new Vector3(0.035f, 0.02f, 0.045f), 8, 4);
                k.Tint(0x5a3d28).Sphere(new Vector3(s * 0.11f, 0.02f, -0.15f), new Vector3(0.035f, 0.02f, 0.045f), 8, 4);
            }
            Eyes(k, new Vector3(0, 0.15f, 0.245f), 0.05f, 0.024f);
        }

        /// <summary>A fox (or the kitsune, with several tails). ~0.85 m nose to tail at sc = 1.</summary>
        static void Fox(MeshKit k, float sc, uint coat, uint white, uint sock, uint earTip, int tails, uint tailTip)
        {
            Vector3 P(float x, float y, float z) => new Vector3(x, y, z) * sc;
            // Tails fan out from the rump; more than one tail lifts them up like a plume.
            var b0 = new Vector3(0, 0.4f, -0.3f);
            float rise = tails > 1 ? 0.16f : 0;
            for (int j = 0; j < tails; j++)
            {
                float yaw = tails == 1 ? 0 : Mathf.Lerp(-55, 55, j / (float)(tails - 1));
                var rot = Quaternion.Euler(0, yaw, 0);
                for (int i = 0; i <= 6; i++)
                {
                    float t = i / 6f;
                    var lp = new Vector3(0, 0.4f + (0.08f + rise) * Mathf.Sin(t * Mathf.PI * 0.8f) - 0.06f * t + rise * t * 0.6f, -0.3f - 0.42f * t);
                    var p = (b0 + rot * (lp - b0)) * sc;
                    float r = (0.055f + 0.055f * Mathf.Sin(t * Mathf.PI) + 0.01f) * sc;
                    k.Tint(i >= 5 ? tailTip : coat).Sphere(p, r, 9, 7);
                }
            }
            k.Tint(coat).Sphere(P(0, 0.36f, -0.03f), P(0.14f, 0.15f, 0.3f), 16, 10);
            k.Tint(white).Sphere(P(0, 0.38f, 0.17f), P(0.1f, 0.12f, 0.1f), 12, 8);
            k.Tint(white).Sphere(P(0, 0.29f, 0), P(0.1f, 0.08f, 0.22f), 10, 8);
            foreach (var (x, z) in new[] { (0.08f, 0.17f), (-0.08f, 0.17f), (0.08f, -0.2f), (-0.08f, -0.2f) })
            {
                k.Tint(coat).Cylinder(P(x, 0.13f, z), P(x, 0.32f, z), 0.042f * sc, 0.05f * sc, 7);
                k.Tint(sock).Cylinder(P(x, 0.01f, z), P(x, 0.14f, z), 0.038f * sc, 0.042f * sc, 7);
                k.Tint(sock).Sphere(P(x, 0.02f, z + 0.02f), P(0.04f, 0.025f, 0.05f), 8, 4);
            }
            k.Tint(coat).Sphere(P(0, 0.52f, 0.28f), P(0.12f, 0.11f, 0.12f), 14, 10);
            for (int s = -1; s <= 1; s += 2)
            {
                k.Tint(white).Sphere(P(s * 0.065f, 0.47f, 0.33f), 0.065f * sc, 10, 8);
                k.Tint(coat).Cylinder(P(s * 0.07f, 0.6f, 0.26f), P(s * 0.11f, 0.75f, 0.24f), 0.05f * sc, 0, 6);
                k.Tint(white).Cylinder(P(s * 0.07f, 0.61f, 0.278f), P(s * 0.1f, 0.71f, 0.262f), 0.03f * sc, 0, 5);
                k.Tint(earTip).Cylinder(P(s * 0.102f, 0.708f, 0.243f), P(s * 0.11f, 0.752f, 0.24f), 0.017f * sc, 0, 5);
            }
            k.Tint(coat).Cylinder(P(0, 0.49f, 0.34f), P(0, 0.46f, 0.53f), 0.065f * sc, 0.018f * sc, 10);
            k.Tint(white).Sphere(P(0, 0.455f, 0.42f), P(0.045f, 0.03f, 0.08f), 8, 6);
            k.Tint(0x1e1a18).Sphere(P(0, 0.465f, 0.53f), 0.022f * sc, 8, 6);
            Eyes(k, P(0, 0.55f, 0.37f), 0.055f * sc, 0.03f * sc);
        }

        static void BuildPigeon(MeshKit k)
        {
            k.Tint(0x8d93a0).Sphere(new Vector3(0, 0.18f, -0.02f), new Vector3(0.12f, 0.12f, 0.18f), 14, 10);
            k.Tint(0xb4b9c4).Sphere(new Vector3(0, 0.15f, 0.06f), new Vector3(0.09f, 0.08f, 0.1f), 10, 8);
            // Iridescent neck: green at the front, purple round the sides.
            k.Tint(0x3fa37a).Sphere(new Vector3(0, 0.27f, 0.08f), new Vector3(0.08f, 0.09f, 0.08f), 12, 8);
            k.Tint(0x8a4fa8).Sphere(new Vector3(0.035f, 0.28f, 0.065f), new Vector3(0.055f, 0.06f, 0.055f), 8, 6);
            k.Tint(0x8a4fa8).Sphere(new Vector3(-0.035f, 0.28f, 0.065f), new Vector3(0.055f, 0.06f, 0.055f), 8, 6);
            k.Tint(0xa0a6b2).Sphere(new Vector3(0, 0.36f, 0.11f), 0.07f, 12, 10);
            k.Tint(0x444448).Cylinder(new Vector3(0, 0.35f, 0.17f), new Vector3(0, 0.335f, 0.235f), 0.018f, 0, 6);
            k.Tint(0xf1f1f1).Sphere(new Vector3(0, 0.356f, 0.172f), 0.015f, 6, 4);
            for (int s = -1; s <= 1; s += 2)
            {
                k.Tint(0x7a808c).Sphere(new Vector3(s * 0.105f, 0.2f, -0.04f), new Vector3(0.035f, 0.08f, 0.15f), 10, 8);
                k.Tint(0x3a3d45).Sphere(new Vector3(s * 0.13f, 0.2f, -0.02f), new Vector3(0.012f, 0.05f, 0.012f), 6, 4);
                k.Tint(0x3a3d45).Sphere(new Vector3(s * 0.13f, 0.2f, -0.08f), new Vector3(0.012f, 0.05f, 0.012f), 6, 4);
                k.Tint(0xe07a8a).Cylinder(new Vector3(s * 0.04f, 0, 0.02f), new Vector3(s * 0.04f, 0.09f, 0.0f), 0.011f, 0.013f, 5);
                for (int t = -1; t <= 1; t++)
                    k.Cylinder(new Vector3(s * 0.04f, 0.006f, 0.02f), new Vector3(s * 0.04f + t * 0.018f, 0.006f, 0.06f), 0.008f, 0.005f, 4);
            }
            k.M = Matrix4x4.TRS(new Vector3(0, 0.17f, -0.2f), Quaternion.Euler(-10, 0, 0), Vector3.one);
            k.Tint(0x7a808c).Sphere(Vector3.zero, new Vector3(0.065f, 0.02f, 0.1f), 10, 6);
            k.Tint(0x2f3138).Sphere(new Vector3(0, 0, -0.07f), new Vector3(0.06f, 0.022f, 0.035f), 8, 4);
            k.M = Matrix4x4.identity;
            Eyes(k, new Vector3(0, 0.38f, 0.15f), 0.04f, 0.022f);
        }

        // ================================================================== forest food

        static Mesh BuildForestFood(FoodKind kind)
        {
            var k = new MeshKit();
            switch (kind)
            {
                case FoodKind.Mushroom:
                {
                    k.Tint(0xf3e7cc).Cylinder(Vector3.zero, new Vector3(0, 0.26f, 0), 0.085f, 0.065f, 12);
                    k.Tint(0xe9dab8).Torus(new Vector3(0, 0.19f, 0), 0.072f, 0.016f, 14, 5);
                    k.Tint(0xefe1c4).Cylinder(new Vector3(0, 0.232f, 0), new Vector3(0, 0.244f, 0), 0.22f, 0.22f, 18);
                    var cc = new Vector3(0, 0.24f, 0);
                    var cr = new Vector3(0.24f, 0.2f, 0.24f);
                    k.Tint(0xe03131).Sphere(cc, cr, 18, 10, 0, 0.5f);
                    k.Tint(0xff6b6b).Sphere(cc + new Vector3(-0.08f, 0.15f, 0.06f), new Vector3(0.05f, 0.025f, 0.05f), 8, 4);
                    foreach (var (phi, th) in new[] { (0.0f, 0f), (0.75f, 0.3f), (0.8f, 1.6f), (0.7f, 2.8f), (0.8f, 4.0f), (0.75f, 5.2f), (1.25f, 1.0f), (1.25f, 3.4f), (1.3f, 5.8f) })
                    {
                        var dir = new Vector3(Mathf.Sin(phi) * Mathf.Cos(th), Mathf.Cos(phi), Mathf.Sin(phi) * Mathf.Sin(th));
                        k.Tint(0xffffff).Sphere(cc + Vector3.Scale(dir, cr), phi == 0 ? 0.045f : 0.034f, 8, 6);
                    }
                    return k.ToMesh("mushroom");
                }
                case FoodKind.Tomato:
                {
                    k.Tint(0xe8382f).Sphere(new Vector3(0, 0.19f, 0), new Vector3(0.22f, 0.18f, 0.22f), 18, 12);
                    k.Tint(0xff7a6b).Sphere(new Vector3(-0.09f, 0.27f, 0.1f), new Vector3(0.06f, 0.04f, 0.05f), 8, 6);
                    for (int i = 0; i < 5; i++)
                    {
                        float a = i * 72;
                        k.M = Matrix4x4.TRS(new Vector3(0, 0.365f, 0), Quaternion.Euler(0, a, 0), Vector3.one);
                        k.M *= Matrix4x4.TRS(new Vector3(0.06f, 0, 0), Quaternion.Euler(0, 0, -12), Vector3.one);
                        k.Tint(0x37b24d).Sphere(Vector3.zero, new Vector3(0.07f, 0.012f, 0.025f), 8, 4);
                    }
                    k.M = Matrix4x4.identity;
                    k.Tint(0x2b8a3e).Cylinder(new Vector3(0, 0.35f, 0), new Vector3(0.015f, 0.43f, 0), 0.018f, 0.012f, 6);
                    return k.ToMesh("tomato");
                }
                case FoodKind.Berry:
                {
                    uint[] cols = { 0x4b3fa8, 0x6a3fb0, 0x3a4fb8, 0x5b3aa0, 0x4848c0, 0x7040a8, 0x3f52b0 };
                    Vector3[] at = { new Vector3(0, 0.1f, 0), new Vector3(0.14f, 0.09f, 0.04f), new Vector3(-0.12f, 0.09f, 0.08f), new Vector3(0.03f, 0.09f, -0.14f), new Vector3(-0.1f, 0.09f, -0.1f), new Vector3(0.05f, 0.24f, 0.0f), new Vector3(-0.06f, 0.22f, -0.03f) };
                    for (int i = 0; i < at.Length; i++)
                    {
                        float r = i >= 5 ? 0.085f : 0.095f;
                        k.Tint(cols[i]).Sphere(at[i], r, 12, 8);
                        k.C = Light(cols[i], 0.55f);
                        k.Sphere(at[i] + new Vector3(-0.03f, 0.04f, 0.05f), r * 0.22f, 6, 4);
                        k.Tint(0x2c2060).Sphere(at[i] + new Vector3(0, r * 0.97f, 0), r * 0.18f, 6, 4);
                    }
                    k.Tint(0x2b8a3e).Cylinder(new Vector3(0, 0.3f, 0), new Vector3(0.03f, 0.42f, 0), 0.012f, 0.008f, 5);
                    k.M = Matrix4x4.TRS(new Vector3(0.1f, 0.38f, 0.02f), Quaternion.Euler(0, 20, -25), Vector3.one);
                    k.Tint(0x37b24d).Sphere(Vector3.zero, new Vector3(0.1f, 0.012f, 0.05f), 10, 4);
                    k.Tint(0x2f9e44).Box(new Vector3(0, 0.008f, 0), new Vector3(0.17f, 0.006f, 0.006f));
                    k.M = Matrix4x4.identity;
                    return k.ToMesh("berry");
                }
                default:
                {
                    // Acorn: a glossy nut under a bumpy, crosshatched cap.
                    k.Tint(0xc9883e).Sphere(new Vector3(0, 0.2f, 0), new Vector3(0.15f, 0.17f, 0.15f), 16, 12);
                    k.Tint(0xb0702e).Cylinder(new Vector3(0, 0.07f, 0), new Vector3(0, 0.0f, 0), 0.05f, 0, 8, true, false);
                    k.Tint(0xe6a85c).Sphere(new Vector3(-0.06f, 0.2f, 0.09f), new Vector3(0.03f, 0.06f, 0.03f), 8, 6);
                    var cc = new Vector3(0, 0.29f, 0);
                    var cr = new Vector3(0.17f, 0.11f, 0.17f);
                    k.Tint(0x7a5230).Sphere(cc, cr, 16, 8, 0, 0.5f);
                    k.Tint(0x6b4526).Torus(cc, 0.16f, 0.028f, 18, 6);
                    k.Tint(0x5e3e22);
                    for (int j = 1; j <= 3; j++)
                    {
                        float phi = j * 0.36f;
                        int count = 4 + j * 4;
                        for (int i = 0; i < count; i++)
                        {
                            float th = (i + j * 0.5f) / count * Mathf.PI * 2;
                            var dir = new Vector3(Mathf.Sin(phi) * Mathf.Cos(th), Mathf.Cos(phi), Mathf.Sin(phi) * Mathf.Sin(th));
                            k.Sphere(cc + Vector3.Scale(dir, cr), 0.02f, 6, 4);
                        }
                    }
                    k.Tint(0x5e3e22).Cylinder(new Vector3(0, 0.39f, 0), new Vector3(0.02f, 0.46f, 0), 0.02f, 0.014f, 6);
                    return k.ToMesh("acorn");
                }
            }
        }

        // ================================================================== predators

        static Mesh BuildBear()
        {
            var k = new MeshKit();
            const uint fur = 0x7a4a2a, dark = 0x5e371e, light = 0xd8b48a;
            k.Tint(fur).Sphere(new Vector3(0, 0.85f, -0.12f), new Vector3(0.55f, 0.52f, 0.8f), 18, 12);
            k.Tint(fur).Sphere(new Vector3(0, 1.08f, 0.32f), new Vector3(0.48f, 0.42f, 0.4f), 16, 10);
            k.Tint(0x9a6a44).Sphere(new Vector3(0, 0.72f, 0.15f), new Vector3(0.38f, 0.36f, 0.55f), 14, 10);
            foreach (var (x, z) in new[] { (0.32f, 0.42f), (-0.32f, 0.42f), (0.32f, -0.55f), (-0.32f, -0.55f) })
            {
                k.Tint(fur).Capsule(new Vector3(x, 0.15f, z), new Vector3(x, 0.62f, z), 0.17f, 10);
                k.Tint(dark).Sphere(new Vector3(x, 0.08f, z + 0.06f), new Vector3(0.18f, 0.09f, 0.22f), 10, 6);
                k.Tint(light).Sphere(new Vector3(x, 0.06f, z + 0.24f), new Vector3(0.1f, 0.04f, 0.05f), 8, 4);
            }
            k.Tint(fur).Sphere(new Vector3(0, 0.98f, -0.92f), 0.12f, 10, 8);
            // Head.
            var h = new Vector3(0, 1.28f, 0.8f);
            k.Tint(fur).Sphere(h, new Vector3(0.38f, 0.35f, 0.34f), 16, 12);
            k.Tint(light).Sphere(h + new Vector3(0, -0.12f, 0.27f), new Vector3(0.18f, 0.13f, 0.15f), 12, 10);
            k.Tint(0x1e1a18).Sphere(h + new Vector3(0, -0.06f, 0.41f), new Vector3(0.075f, 0.05f, 0.045f), 10, 6);
            k.Tint(0x5a5a5a).Sphere(h + new Vector3(-0.025f, -0.04f, 0.45f), 0.014f, 6, 4);
            for (int s = -1; s <= 1; s += 2)
            {
                k.Tint(fur).Sphere(h + new Vector3(s * 0.27f, 0.27f, -0.06f), new Vector3(0.11f, 0.11f, 0.08f), 10, 8);
                k.Tint(light).Sphere(h + new Vector3(s * 0.27f, 0.27f, 0.01f), new Vector3(0.065f, 0.065f, 0.03f), 8, 6);
            }
            Eyes(k, h + new Vector3(0, 0.07f, 0.3f), 0.13f, 0.045f);
            Brows(k, h + new Vector3(0, 0.15f, 0.31f), 0.13f, 0.1f, 18, 0x3a2414);
            Smile(k, h + new Vector3(0, -0.21f, 0.39f), 0.06f, 0.02f, 0.012f, 0x3a2414);
            return k.ToMesh("bear");
        }

        static Mesh BuildWolf()
        {
            var k = new MeshKit();
            const uint fur = 0x7d8590, back = 0x5c636e, light = 0xdde1e6;
            // Bushy tail, drooping behind.
            for (int i = 0; i <= 6; i++)
            {
                float t = i / 6f;
                var p = new Vector3(0, 0.6f - 0.22f * t + 0.05f * Mathf.Sin(t * Mathf.PI), -0.38f - 0.34f * t);
                float r = 0.06f + 0.045f * Mathf.Sin(t * Mathf.PI) + 0.01f;
                k.Tint(i >= 5 ? light : (i % 2 == 0 ? fur : back)).Sphere(p, r, 9, 7);
            }
            k.Tint(fur).Sphere(new Vector3(0, 0.55f, -0.04f), new Vector3(0.18f, 0.19f, 0.38f), 16, 10);
            k.Tint(back).Sphere(new Vector3(0, 0.66f, -0.06f), new Vector3(0.12f, 0.09f, 0.32f), 12, 8);
            k.Tint(light).Sphere(new Vector3(0, 0.47f, 0.02f), new Vector3(0.14f, 0.11f, 0.3f), 12, 8);
            k.Tint(light).Sphere(new Vector3(0, 0.56f, 0.25f), new Vector3(0.15f, 0.17f, 0.13f), 12, 10);
            foreach (var (x, z) in new[] { (0.1f, 0.22f), (-0.1f, 0.22f), (0.1f, -0.26f), (-0.1f, -0.26f) })
            {
                k.Tint(fur).Cylinder(new Vector3(x, 0.03f, z), new Vector3(x, 0.48f, z), 0.042f, 0.06f, 7);
                k.Tint(light).Sphere(new Vector3(x, 0.025f, z + 0.03f), new Vector3(0.05f, 0.03f, 0.065f), 8, 4);
            }
            var h = new Vector3(0, 0.76f, 0.4f);
            k.Tint(fur).Sphere(h, new Vector3(0.14f, 0.13f, 0.14f), 14, 10);
            k.Tint(fur).Cylinder(h + new Vector3(0, -0.04f, 0.07f), h + new Vector3(0, -0.07f, 0.26f), 0.075f, 0.035f, 10);
            k.Tint(light).Sphere(h + new Vector3(0, -0.09f, 0.13f), new Vector3(0.06f, 0.035f, 0.1f), 8, 6);
            k.Tint(0x1e1a18).Sphere(h + new Vector3(0, -0.065f, 0.27f), 0.03f, 8, 6);
            for (int s = -1; s <= 1; s += 2)
            {
                k.Tint(light).Sphere(h + new Vector3(s * 0.1f, -0.05f, 0.04f), new Vector3(0.06f, 0.06f, 0.06f), 8, 6);
                k.Tint(fur).Cylinder(h + new Vector3(s * 0.08f, 0.08f, -0.03f), h + new Vector3(s * 0.11f, 0.25f, -0.05f), 0.055f, 0, 6);
                k.Tint(light).Cylinder(h + new Vector3(s * 0.08f, 0.09f, -0.008f), h + new Vector3(s * 0.105f, 0.21f, -0.03f), 0.032f, 0, 5);
            }
            Eyes(k, h + new Vector3(0, 0.035f, 0.11f), 0.06f, 0.03f);
            Brows(k, h + new Vector3(0, 0.085f, 0.1f), 0.06f, 0.06f, 20, 0x3a3f48);
            return k.ToMesh("wolf");
        }

        // ================================================================== people

        static readonly uint[] skins = { 0xf6d2b4, 0xc68a5e, 0xe8b48f, 0x8d5a3b, 0xf1c9a5, 0xa86f48, 0xf9dcc4, 0x6b432b };
        static readonly uint[] hairs = { 0x3b2618, 0x111111, 0xf2c14e, 0xb5502a, 0x6b4423, 0x2a1a10, 0xe6b35a, 0x1a1210 };
        static readonly uint[] tops = { 0xe03131, 0x1c7ed6, 0xf2c94c, 0x37b24d, 0x7048e8, 0xf76707, 0x12b886, 0xe64980 };
        static readonly uint[] bottoms = { 0x25305e, 0x495057, 0x1971c2, 0x5c3d2e, 0x2b3a67, 0x343a40, 0x7048e8, 0x1a234a };

        /// <summary>A child, ~1.15 m: big head, chunky shoes. Looks 0..7 vary skin, hair, clothes.</summary>
        public static Models.Rig Kid(Transform parent, int look)
        {
            int i = ((look % 8) + 8) % 8;
            int style = i % 4; // 0 bunches, 1 short, 2 curly, 3 cap
            uint skin = skins[i], hair = hairs[i], top = tops[i], bottom = bottoms[i], cap = tops[(i + 3) % 8];
            bool skirt = style == 0 || i == 6;
            uint shoe = i % 2 == 0 ? 0x2b2d42u : 0x5c3d2eu;

            var rig = new Models.Rig { root = new GameObject("Kid").transform };
            rig.root.SetParent(parent, false);
            rig.body = Part(rig.root, "body", Vector3.zero, k =>
            {
                k.Tint(top).RoundBox(new Vector3(0, 0.68f, 0), new Vector3(0.38f, 0.38f, 0.24f), 0.1f);
                k.Tint(top).Sphere(new Vector3(-0.19f, 0.81f, 0), 0.07f, 10, 8);
                k.Tint(top).Sphere(new Vector3(0.19f, 0.81f, 0), 0.07f, 10, 8);
                k.Tint(0xffffff).Torus(new Vector3(0, 0.865f, 0), 0.075f, 0.022f, 14, 5);
                k.Tint(0xffd43b).Cylinder(new Vector3(0.08f, 0.76f, 0.115f), new Vector3(0.08f, 0.76f, 0.13f), 0.035f, 0.035f, 10);
                k.Tint(skin).Cylinder(new Vector3(0, 0.84f, 0), new Vector3(0, 0.93f, 0), 0.055f, 0.055f, 8);
                if (skirt) k.Tint(bottom).Cylinder(new Vector3(0, 0.6f, 0), new Vector3(0, 0.36f, 0), 0.2f, 0.27f, 14);
                else k.Tint(bottom).RoundBox(new Vector3(0, 0.5f, 0), new Vector3(0.36f, 0.14f, 0.22f), 0.06f);
            });
            rig.head = Part(rig.body, "head", new Vector3(0, 1.0f, 0), k =>
            {
                k.Tint(skin).Sphere(Vector3.zero, new Vector3(0.17f, 0.17f, 0.16f), 16, 12);
                for (int s = -1; s <= 1; s += 2)
                {
                    k.Tint(skin).Sphere(new Vector3(s * 0.165f, 0, 0), new Vector3(0.035f, 0.05f, 0.035f), 8, 6);
                    k.Tint(0xf4a3a3).Sphere(new Vector3(s * 0.1f, -0.04f, 0.125f), new Vector3(0.035f, 0.025f, 0.02f), 8, 4);
                }
                k.C = Color.Lerp(MeshKit.Hex(skin), MeshKit.Hex(0x8a4a30), 0.15f);
                k.Sphere(new Vector3(0, -0.02f, 0.16f), 0.025f, 8, 6);
                Eyes(k, new Vector3(0, 0.02f, 0.135f), 0.065f, 0.036f);
                Smile(k, new Vector3(0, -0.09f, 0.142f), 0.045f, 0.018f, 0.008f, 0x7a3b2e);
                // Hair.
                if (style == 3)
                {
                    k.Tint(hair).Sphere(new Vector3(0, -0.01f, -0.05f), new Vector3(0.17f, 0.15f, 0.13f), 12, 8);
                    k.M = Matrix4x4.TRS(new Vector3(0, 0.04f, -0.01f), Quaternion.Euler(-12, 0, 0), Vector3.one);
                    k.Tint(cap).Sphere(Vector3.zero, new Vector3(0.18f, 0.17f, 0.18f), 14, 8, 0, 0.5f);
                    k.Tint(0xffffff).Sphere(new Vector3(0, 0.17f, 0), 0.022f, 6, 4);
                    k.Tint(cap).Sphere(new Vector3(0, 0.0f, 0.2f), new Vector3(0.12f, 0.015f, 0.1f), 12, 4);
                    k.M = Matrix4x4.identity;
                }
                else
                {
                    k.M = Matrix4x4.TRS(new Vector3(0, 0.03f, -0.02f), Quaternion.Euler(-25, 0, 0), Vector3.one);
                    k.Tint(hair).Sphere(Vector3.zero, new Vector3(0.18f, 0.18f, 0.18f), 14, 8, 0, 0.45f);
                    k.M = Matrix4x4.identity;
                    k.Tint(hair).Sphere(new Vector3(0, 0.0f, -0.05f), new Vector3(0.17f, 0.16f, 0.13f), 12, 8);
                    if (style == 0)
                    {
                        for (int s = -1; s <= 1; s += 2)
                        {
                            k.Tint(hair).Sphere(new Vector3(s * 0.2f, 0.0f, -0.05f), new Vector3(0.06f, 0.08f, 0.06f), 10, 8);
                            k.Tint(top).Sphere(new Vector3(s * 0.165f, 0.04f, -0.05f), 0.025f, 8, 6);
                        }
                        k.Tint(hair).Sphere(new Vector3(0, 0.12f, 0.09f), new Vector3(0.12f, 0.04f, 0.06f), 10, 6);
                    }
                    else if (style == 1)
                    {
                        k.Tint(hair).Sphere(new Vector3(0.02f, 0.125f, 0.09f), new Vector3(0.12f, 0.04f, 0.06f), 10, 6);
                        k.Tint(hair).Cylinder(new Vector3(0, 0.17f, 0), new Vector3(0.02f, 0.23f, -0.02f), 0.02f, 0, 5);
                    }
                    else
                    {
                        float[] phis = { 0.15f, 0.7f, 1.15f, 1.6f };
                        for (int j = 0; j < phis.Length; j++)
                        {
                            int count = j == 0 ? 3 : 7 + j;
                            for (int n = 0; n < count; n++)
                            {
                                float th = (n + j * 0.5f) / count * Mathf.PI * 2;
                                var dir = new Vector3(Mathf.Sin(phis[j]) * Mathf.Cos(th), Mathf.Cos(phis[j]), Mathf.Sin(phis[j]) * Mathf.Sin(th));
                                if (dir.z > 0.45f && phis[j] > 0.6f) continue; // keep the face clear
                                k.C = Color.Lerp(MeshKit.Hex(hair), Color.white, (n + j) % 3 == 0 ? 0.08f : 0);
                                k.Sphere(new Vector3(0, 0.02f, -0.02f) + dir * 0.165f, 0.06f, 8, 6);
                            }
                        }
                    }
                }
            });
            Transform Limb(Vector3 at, System.Action<MeshKit> build) => Part(rig.body, "limb", at, build);
            void Leg(MeshKit k)
            {
                k.Tint(skirt ? skin : bottom).Capsule(new Vector3(0, -0.02f, 0), new Vector3(0, -0.14f, 0), skirt ? 0.06f : 0.085f, 8);
                k.Tint(skin).Capsule(new Vector3(0, -0.14f, 0), new Vector3(0, -0.36f, 0), 0.06f, 8);
                k.Tint(0xffffff).Cylinder(new Vector3(0, -0.44f, 0), new Vector3(0, -0.36f, 0), 0.064f, 0.064f, 8);
                k.Tint(shoe).RoundBox(new Vector3(0, -0.46f, 0.04f), new Vector3(0.13f, 0.08f, 0.21f), 0.035f);
            }
            void Arm(MeshKit k)
            {
                k.Tint(top).Capsule(Vector3.zero, new Vector3(0, -0.14f, 0), 0.065f, 8);
                k.Tint(skin).Capsule(new Vector3(0, -0.14f, 0), new Vector3(0, -0.3f, 0), 0.05f, 8);
                k.Tint(skin).Sphere(new Vector3(0, -0.36f, 0), 0.055f, 8, 6);
            }
            rig.legL = Limb(new Vector3(-0.09f, 0.5f, 0), Leg);
            rig.legR = Limb(new Vector3(0.09f, 0.5f, 0), Leg);
            rig.armL = Limb(new Vector3(-0.23f, 0.82f, 0), Arm);
            rig.armR = Limb(new Vector3(0.23f, 0.82f, 0), Arm);
            return rig;
        }

        /// <summary>The grown-ups: "sami" (Miss Sami), "mum", "keeper" (Mr Bramble). ~1.75 m.</summary>
        public static Models.Rig Person(Transform parent, string who)
        {
            bool sami = who == "sami", mum = who == "mum", keeper = !sami && !mum;
            uint skin = keeper ? 0xe8b48fu : mum ? 0xf6d2b4u : 0xc68a5eu;
            uint top = sami ? 0xd6336cu : mum ? 0x2f9e8fu : 0x3f5a34u;
            uint legs = sami ? 0x2b3a67u : mum ? 0x3b5b92u : 0x6b5a45u;
            uint shoe = keeper ? 0x2f5d2au : sami ? 0x3b2618u : 0x5c3d2eu;
            uint hair = sami ? 0x2b1d14u : mum ? 0xb5502au : 0xb8bcc2u;
            string name = sami ? "Miss Sami" : mum ? "Mum" : "Mr Bramble";

            var rig = new Models.Rig { root = new GameObject(name).transform };
            rig.root.SetParent(parent, false);
            rig.body = Part(rig.root, "body", Vector3.zero, k =>
            {
                k.Tint(top).RoundBox(new Vector3(0, 1.1f, 0), new Vector3(0.48f, 0.62f, 0.28f), 0.12f);
                k.Tint(top).Sphere(new Vector3(-0.23f, 1.36f, 0), 0.08f, 10, 8);
                k.Tint(top).Sphere(new Vector3(0.23f, 1.36f, 0), 0.08f, 10, 8);
                k.Tint(legs).RoundBox(new Vector3(0, 0.84f, 0), new Vector3(0.42f, 0.14f, 0.26f), 0.06f);
                k.Tint(skin).Cylinder(new Vector3(0, 1.38f, 0), new Vector3(0, 1.5f, 0), 0.06f, 0.06f, 8);
                if (sami)
                {
                    // Cardigan open over a pale blouse, with a school lanyard.
                    k.Tint(0xfff3bf).Box(new Vector3(0, 1.17f, 0.135f), new Vector3(0.14f, 0.42f, 0.03f));
                    k.Tint(0xffd43b);
                    for (int b = 0; b < 3; b++) k.Sphere(new Vector3(0.09f, 1.02f + b * 0.11f, 0.145f), 0.014f, 6, 4);
                    k.Tint(0x1c7ed6).Cylinder(new Vector3(-0.07f, 1.4f, 0.09f), new Vector3(0, 1.18f, 0.155f), 0.008f, 0.008f, 4, false, false);
                    k.Tint(0x1c7ed6).Cylinder(new Vector3(0.07f, 1.4f, 0.09f), new Vector3(0, 1.18f, 0.155f), 0.008f, 0.008f, 4, false, false);
                    k.Tint(0xffffff).Box(new Vector3(0, 1.12f, 0.16f), new Vector3(0.08f, 0.1f, 0.012f));
                    k.Tint(0x1c7ed6).Box(new Vector3(0, 1.145f, 0.167f), new Vector3(0.06f, 0.02f, 0.004f));
                    k.Tint(0x495057).Box(new Vector3(0, 1.105f, 0.167f), new Vector3(0.05f, 0.008f, 0.004f));
                }
                else if (mum)
                {
                    // A long coat flaring below the hips, a sunny scarf and big buttons.
                    k.Tint(top).Cylinder(new Vector3(0, 0.84f, 0), new Vector3(0, 0.48f, 0), 0.25f, 0.3f, 16);
                    k.Tint(0xf2c94c).Torus(new Vector3(0, 1.42f, 0), 0.09f, 0.04f, 16, 6);
                    k.Tint(0xf2c94c).Capsule(new Vector3(0.05f, 1.38f, 0.12f), new Vector3(0.07f, 1.15f, 0.15f), 0.035f, 6);
                    k.Tint(0x1f6f66);
                    for (int b = 0; b < 3; b++) k.Sphere(new Vector3(-0.06f, 0.98f + b * 0.12f, 0.145f), 0.02f, 6, 4);
                }
                else
                {
                    // A hi-vis vest over the green jacket, like the web game's keeper.
                    k.Tint(0xf2c94c).RoundBox(new Vector3(0, 1.12f, 0), new Vector3(0.5f, 0.5f, 0.3f), 0.12f);
                    k.Tint(0xdee2e6).Box(new Vector3(0, 1.0f, 0.0f), new Vector3(0.505f, 0.04f, 0.305f));
                    k.Tint(top).Box(new Vector3(0, 1.15f, 0.15f), new Vector3(0.12f, 0.46f, 0.02f));
                    k.Tint(0xdfe6d8).Box(new Vector3(0, 1.33f, 0.135f), new Vector3(0.1f, 0.1f, 0.02f));
                }
            });
            rig.head = Part(rig.body, "head", new Vector3(0, 1.6f, 0), k =>
            {
                k.Tint(skin).Sphere(Vector3.zero, new Vector3(0.16f, 0.18f, 0.17f), 16, 12);
                for (int s = -1; s <= 1; s += 2)
                {
                    k.Tint(skin).Sphere(new Vector3(s * 0.155f, 0, 0), new Vector3(0.035f, 0.05f, 0.035f), 8, 6);
                    if (!keeper) k.Tint(0xf4a3a3).Sphere(new Vector3(s * 0.095f, -0.05f, 0.135f), new Vector3(0.03f, 0.02f, 0.02f), 8, 4);
                }
                k.C = Color.Lerp(MeshKit.Hex(skin), MeshKit.Hex(0x8a4a30), 0.15f);
                k.Sphere(new Vector3(0, -0.02f, 0.17f), new Vector3(0.028f, 0.035f, 0.03f), 8, 6);
                Eyes(k, new Vector3(0, 0.03f, 0.14f), 0.065f, 0.03f);
                uint browCol = keeper ? 0x9ea3aau : hair;
                k.Tint(browCol);
                for (int s = -1; s <= 1; s += 2) k.Box(new Vector3(s * 0.065f, 0.085f, 0.14f), new Vector3(0.055f, 0.012f, 0.015f));
                if (keeper)
                {
                    // Grey beard and moustache, grey hair under a tweedy flat cap.
                    k.Tint(hair).Sphere(new Vector3(0, -0.02f, -0.06f), new Vector3(0.165f, 0.13f, 0.13f), 12, 8);
                    k.Tint(0xc9ccd1).Sphere(new Vector3(0, -0.12f, 0.07f), new Vector3(0.14f, 0.12f, 0.11f), 12, 10);
                    k.Tint(0xd6d9dd).Capsule(new Vector3(-0.05f, -0.055f, 0.16f), new Vector3(0.05f, -0.055f, 0.16f), 0.024f, 6);
                    Smile(k, new Vector3(0, -0.1f, 0.18f), 0.035f, 0.012f, 0.008f, 0x7a3b2e);
                    k.M = Matrix4x4.TRS(new Vector3(0, 0.08f, -0.01f), Quaternion.Euler(-10, 0, 0), Vector3.one);
                    k.Tint(0x7a6a4f).Sphere(Vector3.zero, new Vector3(0.18f, 0.13f, 0.2f), 14, 8, 0, 0.5f);
                    k.Tint(0x6a5a40).Sphere(new Vector3(0, 0.0f, 0.16f), new Vector3(0.14f, 0.02f, 0.09f), 12, 4);
                    k.Tint(0x5e4f37).Torus(Vector3.zero, 0.178f, 0.008f, 18, 4);
                    k.M = Matrix4x4.identity;
                }
                else
                {
                    Smile(k, new Vector3(0, -0.1f, 0.148f), 0.045f, 0.016f, 0.008f, 0x9c3b3b);
                    k.M = Matrix4x4.TRS(new Vector3(0, 0.04f, -0.02f), Quaternion.Euler(-25, 0, 0), Vector3.one);
                    k.Tint(hair).Sphere(Vector3.zero, new Vector3(0.17f, 0.19f, 0.18f), 14, 8, 0, 0.45f);
                    k.M = Matrix4x4.identity;
                    if (sami)
                    {
                        // Long dark hair down the back with a strand either side of the face.
                        k.Tint(hair).Sphere(new Vector3(0, -0.1f, -0.07f), new Vector3(0.18f, 0.3f, 0.13f), 12, 10);
                        for (int s = -1; s <= 1; s += 2)
                            k.Tint(hair).Capsule(new Vector3(s * 0.15f, 0.04f, 0.03f), new Vector3(s * 0.16f, -0.24f, -0.01f), 0.05f, 8);
                    }
                    else
                    {
                        // A neat bob.
                        k.Tint(hair).Sphere(new Vector3(0, -0.02f, -0.04f), new Vector3(0.19f, 0.19f, 0.16f), 12, 10);
                        k.Tint(hair).Sphere(new Vector3(0.03f, 0.13f, 0.09f), new Vector3(0.12f, 0.045f, 0.07f), 10, 6);
                    }
                }
            });
            Transform Limb(Vector3 at, System.Action<MeshKit> build) => Part(rig.body, "limb", at, build);
            void Leg(MeshKit k)
            {
                k.Tint(legs).Capsule(new Vector3(0, -0.04f, 0), new Vector3(0, -0.68f, 0), 0.075f, 8);
                if (keeper) k.Tint(shoe).Cylinder(new Vector3(0, -0.76f, 0), new Vector3(0, -0.38f, 0), 0.088f, 0.092f, 10);
                k.Tint(shoe).RoundBox(new Vector3(0, -0.78f, 0.05f), new Vector3(0.13f, 0.08f, 0.27f), 0.035f);
            }
            void Arm(MeshKit k, bool cup)
            {
                k.Tint(top).Capsule(Vector3.zero, new Vector3(0, -0.5f, 0), 0.06f, 8);
                k.Tint(skin).Sphere(new Vector3(0, -0.58f, 0), 0.06f, 8, 6);
                if (cup)
                {
                    k.Tint(0xf8f9fa).Cylinder(new Vector3(0, -0.66f, 0.07f), new Vector3(0, -0.52f, 0.07f), 0.04f, 0.05f, 10);
                    k.Tint(0xa0703c).Cylinder(new Vector3(0, -0.62f, 0.07f), new Vector3(0, -0.56f, 0.07f), 0.046f, 0.05f, 10, false, false);
                    k.Tint(0x343a40).Cylinder(new Vector3(0, -0.52f, 0.07f), new Vector3(0, -0.5f, 0.07f), 0.053f, 0.045f, 10);
                }
            }
            rig.legL = Limb(new Vector3(-0.11f, 0.82f, 0), Leg);
            rig.legR = Limb(new Vector3(0.11f, 0.82f, 0), Leg);
            rig.armL = Limb(new Vector3(-0.28f, 1.36f, 0), k => Arm(k, false));
            rig.armR = Limb(new Vector3(0.28f, 1.36f, 0), k => Arm(k, mum));
            return rig;
        }

        static Transform Part(Transform parent, string name, Vector3 at, System.Action<MeshKit> build)
        {
            var t = new GameObject(name, typeof(MeshFilter), typeof(MeshRenderer)).transform;
            t.SetParent(parent, false);
            t.localPosition = at;
            var k = new MeshKit();
            build(k);
            t.GetComponent<MeshFilter>().sharedMesh = RunAssets.Track(k.ToMesh(name));
            t.GetComponent<MeshRenderer>().sharedMaterial = Mats.VertexLit;
            return t;
        }

        // ================================================================== magic creatures

        static readonly uint[] rainbow = { 0xff5a5a, 0xffa53a, 0xffe03a, 0x5ad16a, 0x4ab4ff, 0x8a6bff, 0xff6bd6 };

        static Mesh BuildCreature(CreatureKind kind)
        {
            var k = new MeshKit();
            uint glow = Creatures.SPECS[(int)kind].glow;
            switch (kind)
            {
                case CreatureKind.Stag:
                    Deer(k, 1.3f, 0xf8f6f0, 0xece6da, 0xf1ede4, 0xffc93c, 0xffd23f, false);
                    Sparkles(k, new Vector3(0, 1.6f, 0.2f), 0.55f, 5, 0xffd23f, 11);
                    return k.ToMesh("stag");
                case CreatureKind.Unicorn: BuildUnicorn(k, glow); return k.ToMesh("unicorn");
                case CreatureKind.Owl: BuildOwl(k, glow); return k.ToMesh("owl");
                case CreatureKind.Frog: BuildFrog(k, glow); return k.ToMesh("frog");
                case CreatureKind.Kitsune:
                    Fox(k, 1.45f, 0xfaf6ee, 0xfff4e0, 0xff8a3a, 0xff7a2a, 5, 0xff7a2a);
                    // Red festival markings above the eyes.
                    for (int s = -1; s <= 1; s += 2)
                    {
                        k.M = Matrix4x4.TRS(new Vector3(s * 0.065f, 0.865f, 0.52f), Quaternion.Euler(-30, 0, s * -20), Vector3.one);
                        k.Tint(0xe03131).Sphere(Vector3.zero, new Vector3(0.035f, 0.01f, 0.018f), 8, 4);
                    }
                    k.M = Matrix4x4.identity;
                    Sparkles(k, new Vector3(0, 0.8f, -0.5f), 0.5f, 5, glow, 13);
                    return k.ToMesh("kitsune");
                case CreatureKind.Pixie: BuildPixie(k, glow); return k.ToMesh("pixie");
                case CreatureKind.Squirrel:
                    Squirrel(k, 1.64f, 0xffc21a, 0xfff0b0, 0xffd84a);
                    Sparkles(k, new Vector3(0, 0.5f, -0.2f), 0.45f, 4, glow, 17);
                    return k.ToMesh("golden-squirrel");
                default: BuildWisp(k, glow); return k.ToMesh("wisp");
            }
        }

        static void BuildUnicorn(MeshKit k, uint glow)
        {
            const uint coat = 0xfbf9f6, soft = 0xf6e3ea, hoof = 0xffc93c;
            // Rainbow tail.
            for (int i = 0; i <= 6; i++)
            {
                float t = i / 6f;
                var p = new Vector3(0.02f * Mathf.Sin(i), 0.88f - 0.42f * t, -0.46f - 0.2f * Mathf.Sin(t * Mathf.PI * 0.7f));
                k.Tint(rainbow[i]).Sphere(p, 0.075f - 0.02f * t + 0.015f * Mathf.Sin(t * Mathf.PI), 9, 7);
            }
            k.Tint(coat).Sphere(new Vector3(0, 0.74f, 0), new Vector3(0.22f, 0.24f, 0.45f), 16, 12);
            foreach (var (x, z) in new[] { (0.12f, 0.3f), (-0.12f, 0.3f), (0.12f, -0.3f), (-0.12f, -0.3f) })
            {
                k.Tint(coat).Sphere(new Vector3(x, 0.66f, z), new Vector3(0.085f, 0.15f, 0.11f), 10, 8);
                k.Tint(coat).Cylinder(new Vector3(x, 0.08f, z), new Vector3(x, 0.62f, z), 0.045f, 0.058f, 8);
                k.Tint(hoof).Cylinder(new Vector3(x, 0, z + 0.005f), new Vector3(x, 0.09f, z), 0.055f, 0.048f, 8);
            }
            k.Tint(coat).Cylinder(new Vector3(0, 0.84f, 0.3f), new Vector3(0, 1.15f, 0.48f), 0.13f, 0.1f, 12);
            k.Tint(coat).Sphere(new Vector3(0, 1.2f, 0.55f), new Vector3(0.11f, 0.12f, 0.15f), 14, 10);
            k.Tint(soft).Sphere(new Vector3(0, 1.12f, 0.69f), new Vector3(0.09f, 0.08f, 0.1f), 12, 8);
            for (int s = -1; s <= 1; s += 2)
            {
                k.Tint(0xd9a3b5).Sphere(new Vector3(s * 0.035f, 1.13f, 0.785f), new Vector3(0.014f, 0.01f, 0.006f), 6, 4);
                k.Tint(0xffb3cf).Sphere(new Vector3(s * 0.08f, 1.16f, 0.64f), new Vector3(0.03f, 0.02f, 0.015f), 6, 4);
                k.Tint(coat).Cylinder(new Vector3(s * 0.06f, 1.3f, 0.5f), new Vector3(s * 0.08f, 1.42f, 0.48f), 0.035f, 0, 6);
                k.Tint(0xffb3cf).Cylinder(new Vector3(s * 0.06f, 1.305f, 0.512f), new Vector3(s * 0.078f, 1.39f, 0.495f), 0.018f, 0, 5);
            }
            // Rainbow mane down the neck.
            for (int i = 0; i <= 6; i++)
            {
                float t = i / 6f;
                var p = Vector3.Lerp(new Vector3(0, 1.33f, 0.5f), new Vector3(0, 0.98f, 0.2f), t) + new Vector3(0, 0, -0.04f);
                k.Tint(rainbow[i]).Sphere(p, 0.07f, 9, 7);
            }
            // Golden spiral horn.
            var hb = new Vector3(0, 1.3f, 0.6f);
            var ht = new Vector3(0, 1.56f, 0.73f);
            k.Tint(0xffd23f).Cylinder(hb, ht, 0.038f, 0, 10);
            var rot = Quaternion.FromToRotation(Vector3.up, (ht - hb).normalized);
            for (int i = 0; i < 3; i++)
            {
                float t = 0.2f + i * 0.22f;
                k.M = Matrix4x4.TRS(Vector3.Lerp(hb, ht, t), rot, Vector3.one);
                k.Tint(0xffe98a).Torus(Vector3.zero, 0.038f * (1 - t), 0.007f, 12, 4);
            }
            k.M = Matrix4x4.identity;
            Eyes(k, new Vector3(0, 1.24f, 0.65f), 0.072f, 0.036f);
            Sparkles(k, new Vector3(0, 1.1f, 0.1f), 0.6f, 5, glow, 7);
        }

        static void BuildOwl(MeshKit k, uint glow)
        {
            const uint brown = 0x8a5a3a, dark = 0x6e4528, cream = 0xf3e2c0;
            k.Tint(brown).Sphere(new Vector3(0, 0.48f, 0), new Vector3(0.36f, 0.42f, 0.34f), 16, 12);
            k.Tint(cream).Sphere(new Vector3(0, 0.4f, 0.11f), new Vector3(0.27f, 0.3f, 0.25f), 14, 10);
            foreach (var (x, y) in new[] { (0f, 0.42f), (-0.1f, 0.36f), (0.1f, 0.36f), (0f, 0.28f), (-0.1f, 0.22f), (0.1f, 0.22f), (-0.17f, 0.42f), (0.17f, 0.42f) })
            {
                float z = 0.11f + 0.25f * Mathf.Sqrt(Mathf.Max(0, 1 - x * x / 0.0729f - (y - 0.4f) * (y - 0.4f) / 0.09f));
                k.Tint(0x9a7a5a).Sphere(new Vector3(x, y, z - 0.004f), new Vector3(0.03f, 0.012f, 0.012f), 6, 4);
            }
            for (int s = -1; s <= 1; s += 2)
            {
                k.Tint(dark).Sphere(new Vector3(s * 0.33f, 0.45f, -0.03f), new Vector3(0.08f, 0.28f, 0.22f), 12, 8);
                k.C = Light(glow, 0.35f);
                k.Sphere(new Vector3(s * 0.36f, 0.3f, -0.05f), new Vector3(0.05f, 0.08f, 0.12f), 8, 6);
                k.Tint(brown).Cylinder(new Vector3(s * 0.18f, 0.78f, 0.02f), new Vector3(s * 0.27f, 0.98f, -0.02f), 0.075f, 0, 6);
                k.Tint(0xfff4dc).Sphere(new Vector3(s * 0.13f, 0.64f, 0.24f), new Vector3(0.15f, 0.15f, 0.08f), 12, 8);
                var e = new Vector3(s * 0.13f, 0.65f, 0.28f);
                k.Tint(0xffb100).Sphere(e, 0.095f, 12, 8);
                k.Tint(0x111111).Sphere(e + new Vector3(s * 0.01f, 0.01f, 0.06f), 0.055f, 10, 6);
                k.Tint(0xffffff).Sphere(e + new Vector3(s * 0.005f, 0.04f, 0.1f), 0.018f, 6, 4);
                for (int t = -1; t <= 1; t++)
                    k.Tint(0xf59f00).Sphere(new Vector3(s * 0.1f + t * 0.035f, 0.03f, 0.25f), new Vector3(0.022f, 0.02f, 0.04f), 6, 4);
            }
            k.Tint(0xf59f00).Cylinder(new Vector3(0, 0.6f, 0.32f), new Vector3(0, 0.5f, 0.37f), 0.04f, 0, 8);
            Sparkles(k, new Vector3(0, 0.6f, 0), 0.5f, 4, glow, 3);
        }

        static void BuildFrog(MeshKit k, uint glow)
        {
            const uint green = 0x5fbf3a, belly = 0xd8f0a0;
            k.Tint(green).Sphere(new Vector3(0, 0.2f, 0), new Vector3(0.3f, 0.2f, 0.34f), 16, 12);
            k.Tint(belly).Sphere(new Vector3(0, 0.15f, 0.1f), new Vector3(0.22f, 0.13f, 0.24f), 12, 8);
            k.Tint(0x3f9a2a).Sphere(new Vector3(0.12f, 0.36f, -0.05f), new Vector3(0.05f, 0.02f, 0.05f), 8, 4);
            k.Tint(0x3f9a2a).Sphere(new Vector3(-0.1f, 0.34f, -0.15f), new Vector3(0.04f, 0.02f, 0.04f), 8, 4);
            for (int s = -1; s <= 1; s += 2)
            {
                k.Tint(green).Sphere(new Vector3(s * 0.28f, 0.12f, -0.12f), new Vector3(0.1f, 0.11f, 0.19f), 10, 8);
                k.Tint(green).Sphere(new Vector3(s * 0.32f, 0.02f, 0.02f), new Vector3(0.09f, 0.02f, 0.12f), 10, 4);
                k.Tint(green).Cylinder(new Vector3(s * 0.15f, 0.12f, 0.2f), new Vector3(s * 0.19f, 0.02f, 0.27f), 0.04f, 0.035f, 6);
                k.Tint(green).Sphere(new Vector3(s * 0.2f, 0.015f, 0.29f), new Vector3(0.06f, 0.015f, 0.05f), 8, 4);
                k.Tint(green).Sphere(new Vector3(s * 0.15f, 0.36f, 0.14f), 0.1f, 12, 8);
                k.Tint(0xffa8b8).Sphere(new Vector3(s * 0.2f, 0.2f, 0.24f), new Vector3(0.045f, 0.03f, 0.02f), 8, 4);
            }
            Eyes(k, new Vector3(0, 0.41f, 0.18f), 0.15f, 0.075f);
            Smile(k, new Vector3(0, 0.15f, 0.345f), 0.15f, 0.04f, 0.012f, 0x2b6a1e);
            // The Frog Prince's crown.
            const uint gold = 0xffd23f;
            var cb = new Vector3(0, 0.39f, 0.02f);
            k.Tint(gold).Cylinder(cb, cb + new Vector3(0, 0.07f, 0), 0.085f, 0.09f, 14, false, false);
            k.Tint(0xe8b220).Torus(cb, 0.087f, 0.014f, 16, 4);
            uint[] jewels = { 0xe03131, 0x1c7ed6, 0x37b24d, 0xe03131, 0x7048e8 };
            for (int i = 0; i < 5; i++)
            {
                float a = i * Mathf.PI * 2 / 5 + Mathf.PI / 2;
                var d = new Vector3(Mathf.Cos(a), 0, Mathf.Sin(a)) * 0.085f;
                var b = cb + d + new Vector3(0, 0.06f, 0);
                k.Tint(gold).Cylinder(b, b + new Vector3(0, 0.08f, 0) + d * 0.15f, 0.028f, 0, 5);
                k.Tint(gold).Sphere(b + new Vector3(0, 0.085f, 0) + d * 0.15f, 0.014f, 6, 4);
                k.Tint(jewels[i]).Sphere(cb + d * 1.08f + new Vector3(0, 0.035f, 0), 0.016f, 6, 4);
            }
            Sparkles(k, new Vector3(0, 0.45f, 0), 0.42f, 4, glow, 5);
        }

        static void BuildPixie(MeshKit k, uint glow)
        {
            const uint skin = 0xfde0c8, dress = 0x3fd8e8, hair = 0xff7ac8;
            // Wings first: flat, pale and double-sided.
            var wb = new Vector3(0, 0.72f, -0.07f);
            for (int s = -1; s <= 1; s += 2)
            {
                k.Tint(0xd8fbff).Triangle(wb, new Vector3(s * 0.36f, 1.04f, -0.2f), new Vector3(s * 0.3f, 0.74f, -0.18f));
                k.Tint(0xbff0ff).Triangle(wb + new Vector3(0, -0.02f, 0), new Vector3(s * 0.25f, 0.68f, -0.17f), new Vector3(s * 0.18f, 0.5f, -0.14f));
                k.Tint(skin).Capsule(new Vector3(s * 0.04f, 0.46f, 0), new Vector3(s * 0.05f, 0.3f, 0.02f), 0.022f, 6);
                k.Tint(hair).Sphere(new Vector3(s * 0.05f, 0.29f, 0.03f), new Vector3(0.025f, 0.02f, 0.035f), 6, 4);
                k.Tint(skin).Capsule(new Vector3(s * 0.07f, 0.74f, 0), new Vector3(s * 0.15f, 0.6f, 0.04f), 0.02f, 6);
                k.Tint(skin).Cylinder(new Vector3(s * 0.09f, 0.9f, -0.01f), new Vector3(s * 0.16f, 0.94f, -0.02f), 0.025f, 0, 5);
            }
            k.Tint(dress).Cylinder(new Vector3(0, 0.45f, 0), new Vector3(0, 0.74f, 0), 0.13f, 0.05f, 12);
            k.Tint(dress).Sphere(new Vector3(0, 0.74f, 0), new Vector3(0.065f, 0.06f, 0.055f), 10, 8);
            k.C = Light(dress, 0.5f);
            k.Torus(new Vector3(0, 0.46f, 0), 0.125f, 0.012f, 16, 4);
            k.Tint(skin).Sphere(new Vector3(0, 0.88f, 0), 0.1f, 14, 10);
            k.M = Matrix4x4.TRS(new Vector3(0, 0.9f, -0.01f), Quaternion.Euler(-25, 0, 0), Vector3.one);
            k.Tint(hair).Sphere(Vector3.zero, new Vector3(0.105f, 0.105f, 0.105f), 12, 8, 0, 0.45f);
            k.M = Matrix4x4.identity;
            k.Tint(hair).Sphere(new Vector3(0, 0.88f, -0.04f), new Vector3(0.1f, 0.09f, 0.08f), 10, 8);
            k.Tint(hair).Sphere(new Vector3(0, 1.0f, -0.03f), 0.045f, 8, 6);
            k.Tint(0xffa8c8).Sphere(new Vector3(0.05f, 0.85f, 0.08f), new Vector3(0.02f, 0.014f, 0.01f), 6, 4);
            k.Tint(0xffa8c8).Sphere(new Vector3(-0.05f, 0.85f, 0.08f), new Vector3(0.02f, 0.014f, 0.01f), 6, 4);
            Eyes(k, new Vector3(0, 0.895f, 0.075f), 0.038f, 0.024f);
            Smile(k, new Vector3(0, 0.84f, 0.095f), 0.022f, 0.008f, 0.005f, 0x9c3b3b);
            // A wand with a golden star bead.
            k.Tint(0xfff3bf).Cylinder(new Vector3(0.15f, 0.6f, 0.04f), new Vector3(0.2f, 0.78f, 0.1f), 0.008f, 0.008f, 4);
            k.Tint(0xffd23f).Sphere(new Vector3(0.2f, 0.8f, 0.1f), 0.03f, 8, 6);
            Sparkles(k, new Vector3(0, 0.75f, 0), 0.33f, 6, glow, 9);
        }

        static void BuildWisp(MeshKit k, uint glow)
        {
            var c = new Vector3(0, 0.6f, 0);
            // A trailing, curling tail fading to pale.
            for (int i = 6; i >= 1; i--)
            {
                float t = i / 7f;
                var p = c + new Vector3(Mathf.Sin(i * 0.9f) * 0.06f, -i * 0.05f, -0.12f - i * 0.08f);
                k.C = Color.Lerp(MeshKit.Hex(glow), Color.white, 0.25f + t * 0.5f);
                k.Sphere(p, 0.15f * (1 - t * 0.85f), 10, 8);
            }
            // Soft puffs round the sides and back of the core.
            for (int i = 0; i < 7; i++)
            {
                float a = Mathf.PI * 0.15f + i * Mathf.PI * 1.7f / 6f + Mathf.PI * 0.5f; // around the back
                var d = new Vector3(Mathf.Cos(a), (i % 3 - 1) * 0.5f, Mathf.Sin(a)).normalized;
                if (d.z > 0.2f) continue;
                k.C = Color.Lerp(MeshKit.Hex(glow), Color.white, 0.2f + (i % 2) * 0.15f);
                k.Sphere(c + d * 0.13f, 0.13f, 10, 8);
            }
            k.C = Light(glow, 0.12f);
            k.Sphere(c + new Vector3(0, 0.15f, -0.04f), 0.11f, 10, 8);
            k.C = Light(glow, 0.7f);
            k.Sphere(c, 0.2f, 14, 10);
            Eyes(k, c + new Vector3(0, 0.03f, 0.16f), 0.06f, 0.035f);
            Smile(k, c + new Vector3(0, -0.06f, 0.192f), 0.03f, 0.01f, 0.007f, 0x5a2a9a);
            Sparkles(k, c, 0.38f, 5, glow, 21);
        }

        // ================================================================== projectiles

        /// <summary>Centred on the origin (it flies), ~0.18 m across.</summary>
        static Mesh BuildPebble()
        {
            var k = new MeshKit();
            k.Tint(0x8b8f96).Blob(Vector3.zero, new Vector3(0.095f, 0.075f, 0.085f), 0.22f, 42, 1, true);
            k.Tint(0xb2b5ba).Blob(new Vector3(-0.02f, 0.045f, 0.02f), new Vector3(0.04f, 0.02f, 0.035f), 0.2f, 43, 0, true);
            return k.ToMesh("pebble");
        }

        /// <summary>A pink heart in the XY plane, seen from +Z, centred on the origin. ~0.35 m wide.</summary>
        static Mesh BuildKiss()
        {
            var k = new MeshKit();
            k.M = Matrix4x4.Scale(new Vector3(1, 1, 0.55f));
            k.Tint(0xff5c9d).Sphere(new Vector3(-0.075f, 0.05f, 0), 0.095f, 14, 10);
            k.Tint(0xff5c9d).Sphere(new Vector3(0.075f, 0.05f, 0), 0.095f, 14, 10);
            k.Tint(0xff5c9d).Cylinder(new Vector3(0, 0.035f, 0), new Vector3(0, -0.16f, 0), 0.155f, 0, 16);
            k.Tint(0xffc2da).Sphere(new Vector3(-0.09f, 0.09f, 0.07f), 0.03f, 8, 6);
            k.M = Matrix4x4.identity;
            return k.ToMesh("kiss");
        }

        // ================================================================== the fallen log

        static Mesh BuildLog()
        {
            var k = new MeshKit();
            const float L = 5.2f, ra = 0.85f, rb = 0.74f;
            var a = new Vector3(-L, ra, 0);
            var b = new Vector3(L, rb, 0);
            k.Tint(0x7a5232).Cylinder(a, b, ra, rb, 16, false, false);
            // Bark ridges running along the trunk, in broken lengths.
            var rng = new System.Random(77);
            for (int i = 0; i < 11; i++)
            {
                float th = i * Mathf.PI * 2 / 11 + 0.2f;
                var dir = new Vector3(0, Mathf.Cos(th), Mathf.Sin(th));
                if (dir.y < -0.55f) continue;
                float t = 0.02f;
                while (t < 0.96f)
                {
                    float t1 = Mathf.Min(0.98f, t + 0.15f + (float)rng.NextDouble() * 0.3f);
                    var p0 = Vector3.Lerp(a, b, t) + dir * Mathf.Lerp(ra, rb, t) * 0.99f;
                    var p1 = Vector3.Lerp(a, b, t1) + dir * Mathf.Lerp(ra, rb, t1) * 0.99f;
                    k.Tint((i + (int)(t * 10)) % 2 == 0 ? 0x5e3d24u : 0x6a4529u).Cylinder(p0, p1, 0.055f, 0.055f, 5);
                    t = t1 + 0.03f + (float)rng.NextDouble() * 0.08f;
                }
            }
            // Cut ends with growth rings.
            for (int e = -1; e <= 1; e += 2)
            {
                float r = e < 0 ? ra : rb;
                var c = e < 0 ? a : b;
                var o = c + new Vector3(e * 0.04f, 0, 0);
                k.Tint(0xe0b981).Cylinder(c, o, r * 0.97f, r * 0.97f, 16, false, true);
                k.M = Matrix4x4.TRS(o, Quaternion.Euler(0, 0, 90), Vector3.one);
                for (int j = 1; j <= 3; j++) k.Tint(0xb88a55).Torus(Vector3.zero, r * 0.24f * j, 0.016f, 20, 4);
                k.M = Matrix4x4.identity;
                k.Tint(0x9a6a3a).Sphere(o, 0.04f, 6, 4);
            }
            // Stubby broken branches with pale cut tips.
            foreach (var (p0, p1, r0) in new[]
            {
                (new Vector3(-2.0f, 1.4f, 0.3f), new Vector3(-2.35f, 1.9f, 0.6f), 0.2f),
                (new Vector3(1.8f, 0.85f, 0.55f), new Vector3(2.15f, 1.05f, 1.15f), 0.17f),
                (new Vector3(3.9f, 1.25f, -0.3f), new Vector3(4.2f, 1.55f, -0.55f), 0.12f),
            })
            {
                var d = (p1 - p0).normalized;
                k.Tint(0x6e4a2c).Cylinder(p0, p1, r0, r0 * 0.75f, 10, false, false);
                k.Tint(0xe0b981).Cylinder(p1, p1 + d * 0.02f, r0 * 0.72f, r0 * 0.72f, 10, false, true);
            }
            // Moss along the top.
            k.Tint(0x6f9a46).Blob(new Vector3(-3.4f, 1.62f, 0.0f), new Vector3(0.75f, 0.12f, 0.45f), 0.2f, 61, 1, true);
            k.Tint(0x5f8c3a).Blob(new Vector3(0.6f, 1.54f, -0.1f), new Vector3(0.95f, 0.12f, 0.42f), 0.2f, 62, 1, true);
            k.Tint(0x7aa64e).Blob(new Vector3(3.6f, 1.48f, 0.1f), new Vector3(0.5f, 0.1f, 0.35f), 0.2f, 63, 1, true);
            k.Tint(0x6f9a46).Blob(new Vector3(-0.8f, 0.55f, 0.72f), new Vector3(0.45f, 0.25f, 0.18f), 0.25f, 64, 1, true);
            // A few tiny toadstools at its foot.
            foreach (var (x, z, s) in new[] { (2.6f, 0.95f, 1f), (2.85f, 0.85f, 0.7f), (-4.3f, -0.95f, 0.85f) })
            {
                var p = new Vector3(x, 0, z);
                k.Tint(0xf3e7cc).Cylinder(p, p + new Vector3(0, 0.14f * s, 0), 0.03f * s, 0.025f * s, 6);
                k.Tint(0xe03131).Sphere(p + new Vector3(0, 0.13f * s, 0), new Vector3(0.09f, 0.07f, 0.09f) * s, 10, 6, 0, 0.5f);
                k.Tint(0xffffff).Sphere(p + new Vector3(0, 0.2f * s, 0), 0.018f * s, 6, 4);
            }
            return k.ToMesh("log");
        }
    }
}
