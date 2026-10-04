using Telfer.Sim;
using UnityEngine;

namespace Telfer.View
{
    /// <summary>Every edible, every animal, every rock: modelled in code, vertex-coloured, built once and shared.</summary>
    public static class Models
    {
        static Mesh[] food, animals, hazards;
        static Mesh pellet;

        public static Mesh Food(FoodKind k) { if (food == null) BuildFood(); return food[(int)k]; }
        public static Mesh Animal(AnimalKind k) { if (animals == null) BuildAnimals(); return animals[(int)k]; }
        public static Mesh Hazard(HazardKind k, int variant) { if (hazards == null) BuildHazards(); return hazards[(int)k * 3 + variant % 3]; }
        public static Mesh Pellet => pellet ? pellet : (pellet = PelletMesh());

        /// <summary>The colour a food bursts into when eaten.</summary>
        public static Color FoodColor(FoodKind k)
        {
            switch (k)
            {
                case FoodKind.Burger: return MeshKit.Hex(0xe8a05c);
                case FoodKind.Sausage: return MeshKit.Hex(0xc0623b);
                case FoodKind.Cookie: return MeshKit.Hex(0xd9a066);
                case FoodKind.Broccoli: return MeshKit.Hex(0x3fa34d);
                case FoodKind.Carrot: return MeshKit.Hex(0xf08c00);
                case FoodKind.Mushroom: return MeshKit.Hex(0xd23b32);
                case FoodKind.Tomato: return MeshKit.Hex(0xe5383b);
                case FoodKind.Berry: return MeshKit.Hex(0x5f3dc4);
                case FoodKind.Acorn: return MeshKit.Hex(0x9c6b3c);
                default: return MeshKit.Hex(0xe03131);
            }
        }

        public static Color AnimalColor(AnimalKind k)
        {
            switch (k)
            {
                case AnimalKind.Snail: return MeshKit.Hex(0xc77d3a);
                case AnimalKind.Ladybird: return MeshKit.Hex(0xe03131);
                case AnimalKind.Pig: return MeshKit.Hex(0xf7a8b8);
                case AnimalKind.Rabbit: return MeshKit.Hex(0xb08968);
                case AnimalKind.Squirrel: return MeshKit.Hex(0xc8692c);
                case AnimalKind.Crow: return MeshKit.Hex(0x2b2d42);
                case AnimalKind.Deer: return MeshKit.Hex(0xb98552);
                case AnimalKind.Hedgehog: return MeshKit.Hex(0x7a5a3a);
                case AnimalKind.Fox: return MeshKit.Hex(0xe8590c);
                case AnimalKind.Pigeon: return MeshKit.Hex(0x9aa3b0);
                default: return MeshKit.Hex(0xf5f1e6);
            }
        }

        // ------------------------------------------------------------------ food

        static void BuildFood()
        {
            food = new Mesh[6];
            var k = new MeshKit();

            // Burger.
            k.Tint(0xd98c4a).Sphere(new Vector3(0, 0.07f, 0), new Vector3(0.27f, 0.08f, 0.27f), 18, 8);
            k.Tint(0x6b3e26).Cylinder(new Vector3(0, 0.12f, 0), new Vector3(0, 0.2f, 0), 0.28f, 0.28f, 18);
            k.M = Matrix4x4.TRS(new Vector3(0, 0.21f, 0), Quaternion.Euler(0, 45, 0), Vector3.one);
            k.Tint(0xffc93c).Box(Vector3.zero, new Vector3(0.42f, 0.025f, 0.42f));
            k.M = Matrix4x4.identity;
            k.Tint(0x6abf4b).Cylinder(new Vector3(0, 0.22f, 0), new Vector3(0, 0.24f, 0), 0.3f, 0.3f, 14);
            k.Tint(0xe5383b).Cylinder(new Vector3(0, 0.24f, 0), new Vector3(0, 0.265f, 0), 0.24f, 0.24f, 14);
            k.Tint(0xe8a05c).Sphere(new Vector3(0, 0.26f, 0), new Vector3(0.29f, 0.2f, 0.29f), 18, 10, 0, 0.5f);
            var rng = new System.Random(1);
            for (int i = 0; i < 9; i++)
            {
                float a = (float)rng.NextDouble() * Mathf.PI * 2, r = (float)rng.NextDouble() * 0.2f;
                float y = 0.26f + 0.2f * Mathf.Sqrt(Mathf.Max(0, 1 - (r * r) / (0.29f * 0.29f))) - 0.005f;
                k.M = Matrix4x4.TRS(new Vector3(Mathf.Cos(a) * r, y, Mathf.Sin(a) * r), Quaternion.Euler(0, a * 57, 0), Vector3.one);
                k.Tint(0xfff8e1).Sphere(Vector3.zero, new Vector3(0.025f, 0.012f, 0.012f), 6, 4);
            }
            k.M = Matrix4x4.identity;
            food[0] = k.ToMesh("burger"); k.Clear();

            // Sausage: a plump banger with grill stripes.
            k.Tint(0xc0623b).Capsule(new Vector3(-0.22f, 0.1f, -0.04f), new Vector3(0.02f, 0.1f, 0.03f), 0.1f, 14);
            k.Tint(0xc0623b).Capsule(new Vector3(0.02f, 0.1f, 0.03f), new Vector3(0.24f, 0.1f, -0.05f), 0.1f, 14);
            k.Tint(0x7a3519);
            for (int i = 0; i < 4; i++) k.Box(new Vector3(-0.18f + i * 0.12f, 0.195f, 0), new Vector3(0.025f, 0.012f, 0.16f));
            food[1] = k.ToMesh("sausage"); k.Clear();

            // Cookie with chocolate chips.
            k.Tint(0xd9a066).Cylinder(new Vector3(0, 0, 0), new Vector3(0, 0.07f, 0), 0.24f, 0.23f, 20);
            k.Tint(0xe2ae76).Sphere(new Vector3(0, 0.07f, 0), new Vector3(0.23f, 0.02f, 0.23f), 18, 6);
            for (int i = 0; i < 8; i++)
            {
                float a = i * 2.4f, r = 0.05f + (i % 3) * 0.06f;
                k.Tint(0x4a2c1a).Sphere(new Vector3(Mathf.Cos(a) * r, 0.085f, Mathf.Sin(a) * r), 0.032f, 8, 6);
            }
            food[2] = k.ToMesh("cookie"); k.Clear();

            // Broccoli: a stalk and a crown of florets.
            k.Tint(0x9bd36b).Cylinder(Vector3.zero, new Vector3(0, 0.2f, 0), 0.08f, 0.06f, 10);
            Vector3[] fl = { new Vector3(0, 0.33f, 0), new Vector3(0.12f, 0.27f, 0.05f), new Vector3(-0.11f, 0.28f, 0.06f), new Vector3(0.03f, 0.28f, -0.12f), new Vector3(-0.06f, 0.26f, -0.08f), new Vector3(0.08f, 0.27f, -0.08f), new Vector3(0.0f, 0.27f, 0.13f) };
            for (int i = 0; i < fl.Length; i++)
            {
                var c = Color.Lerp(MeshKit.Hex(0x2b7a35), MeshKit.Hex(0x4fb04a), i == 0 ? 1 : 0.3f + i * 0.08f);
                k.C = c;
                k.Blob(fl[i], Vector3.one * (i == 0 ? 0.14f : 0.11f), 0.15f, i * 7, 1, false);
            }
            food[3] = k.ToMesh("broccoli"); k.Clear();

            // Carrot lying on its side, with a leafy top.
            k.Tint(0xf08c00).Cylinder(new Vector3(-0.2f, 0.09f, 0), new Vector3(0.28f, 0.06f, 0), 0.1f, 0.012f, 14);
            for (int i = 0; i < 4; i++)
            {
                float t = 0.15f + i * 0.17f;
                var p = Vector3.Lerp(new Vector3(-0.2f, 0.09f, 0), new Vector3(0.28f, 0.06f, 0), t);
                float r = Mathf.Lerp(0.1f, 0.012f, t) + 0.004f;
                k.M = Matrix4x4.TRS(p, Quaternion.Euler(0, 0, 90), Vector3.one);
                k.Tint(0xd97706).Torus(Vector3.zero, r, 0.008f, 12, 4, 200);
            }
            k.M = Matrix4x4.identity;
            for (int i = 0; i < 3; i++)
            {
                var start = new Vector3(-0.2f, 0.09f, 0);
                var end = start + new Vector3(-0.18f, 0.12f + i * 0.04f, (i - 1) * 0.08f);
                k.Tint(0x37b24d).Cylinder(start, end, 0.035f, 0.005f, 6);
            }
            food[4] = k.ToMesh("carrot"); k.Clear();

            // Apple: shiny, with a stalk and a leaf.
            k.Tint(0xe03131).Sphere(new Vector3(0, 0.2f, 0), new Vector3(0.21f, 0.19f, 0.21f), 18, 12);
            k.Tint(0xff6b6b).Sphere(new Vector3(-0.08f, 0.3f, 0.08f), new Vector3(0.06f, 0.04f, 0.06f), 8, 6);
            k.Tint(0x6b4a2f).Cylinder(new Vector3(0, 0.36f, 0), new Vector3(0.02f, 0.45f, 0), 0.015f, 0.012f, 6);
            k.M = Matrix4x4.TRS(new Vector3(0.06f, 0.42f, 0), Quaternion.Euler(0, 0, -35), Vector3.one);
            k.Tint(0x37b24d).Sphere(Vector3.zero, new Vector3(0.07f, 0.012f, 0.035f), 8, 4);
            k.M = Matrix4x4.identity;
            food[5] = k.ToMesh("apple"); k.Clear();
        }

        // ------------------------------------------------------------------ animals

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

        static void Legs(MeshKit k, uint color, float y, float spreadX, float spreadZ, float r)
        {
            k.Tint(color);
            foreach (var (x, z) in new[] { (spreadX, spreadZ), (-spreadX, spreadZ), (spreadX, -spreadZ), (-spreadX, -spreadZ) })
                k.Cylinder(new Vector3(x, 0, z), new Vector3(x, y, z), r, r, 6);
        }

        static void BuildAnimals()
        {
            animals = new Mesh[8];
            var k = new MeshKit();

            // Snail: a spiral shell on a soft body, eyes on stalks.
            k.Tint(0xe9d3a3).Capsule(new Vector3(0, 0.07f, -0.22f), new Vector3(0, 0.08f, 0.22f), 0.075f, 10);
            k.Tint(0xe9d3a3).Sphere(new Vector3(0, 0.12f, 0.25f), 0.09f, 10, 8);
            k.Tint(0xc77d3a).Sphere(new Vector3(0, 0.24f, -0.06f), new Vector3(0.17f, 0.19f, 0.19f), 16, 12);
            k.M = Matrix4x4.TRS(new Vector3(0, 0.24f, -0.06f), Quaternion.Euler(0, 0, 90), Vector3.one);
            k.Tint(0x9a5527).Torus(Vector3.zero, 0.12f, 0.035f, 18, 6);
            k.Tint(0xe6a15c).Torus(Vector3.zero, 0.055f, 0.03f, 14, 6);
            k.M = Matrix4x4.identity;
            for (int s = -1; s <= 1; s += 2)
            {
                k.Tint(0xe9d3a3).Cylinder(new Vector3(s * 0.04f, 0.15f, 0.28f), new Vector3(s * 0.07f, 0.3f, 0.33f), 0.015f, 0.012f, 5);
                k.Tint(0xffffff).Sphere(new Vector3(s * 0.07f, 0.31f, 0.33f), 0.035f, 8, 6);
                k.Tint(0x111111).Sphere(new Vector3(s * 0.07f, 0.315f, 0.36f), 0.018f, 6, 4);
            }
            animals[0] = k.ToMesh("snail"); k.Clear();

            // Ladybird.
            k.Tint(0xe03131).Sphere(new Vector3(0, 0.03f, -0.02f), new Vector3(0.2f, 0.17f, 0.24f), 16, 10, 0, 0.5f);
            k.Tint(0x15181d).Sphere(new Vector3(0, 0.06f, 0.19f), new Vector3(0.11f, 0.08f, 0.09f), 10, 8);
            k.Tint(0x15181d).Box(new Vector3(0, 0.19f, -0.02f), new Vector3(0.012f, 0.02f, 0.44f));
            foreach (var (x, z) in new[] { (0.09f, 0.06f), (-0.09f, 0.06f), (0.12f, -0.08f), (-0.12f, -0.08f), (0.05f, -0.16f), (-0.05f, -0.16f) })
            {
                float y = 0.03f + 0.17f * Mathf.Sqrt(Mathf.Max(0, 1 - x * x / 0.04f - (z + 0.02f) * (z + 0.02f) / 0.0576f));
                k.Tint(0x15181d).Sphere(new Vector3(x, y, z), new Vector3(0.035f, 0.02f, 0.035f), 8, 4);
            }
            Eyes(k, new Vector3(0, 0.1f, 0.25f), 0.045f, 0.03f);
            Legs(k, 0x15181d, 0.04f, 0.13f, 0.07f, 0.01f);
            animals[1] = k.ToMesh("ladybird"); k.Clear();

            // Chicken.
            k.Tint(0xfafafa).Sphere(new Vector3(0, 0.32f, -0.02f), new Vector3(0.22f, 0.21f, 0.27f), 16, 12);
            k.Tint(0xfafafa).Sphere(new Vector3(0, 0.55f, 0.16f), 0.13f, 14, 10);
            k.Tint(0xe9ecef).Sphere(new Vector3(0.2f, 0.33f, -0.03f), new Vector3(0.05f, 0.12f, 0.18f), 10, 8);
            k.Tint(0xe9ecef).Sphere(new Vector3(-0.2f, 0.33f, -0.03f), new Vector3(0.05f, 0.12f, 0.18f), 10, 8);
            for (int i = 0; i < 3; i++) k.Tint(0xe03131).Sphere(new Vector3(0, 0.68f + (i == 1 ? 0.02f : 0), 0.1f + i * 0.06f), 0.045f, 8, 6);
            k.Tint(0xf59f00).Cylinder(new Vector3(0, 0.54f, 0.27f), new Vector3(0, 0.52f, 0.37f), 0.04f, 0.0f, 6);
            k.Tint(0xe03131).Sphere(new Vector3(0, 0.46f, 0.26f), new Vector3(0.03f, 0.05f, 0.03f), 6, 6);
            for (int i = -1; i <= 1; i++) k.Tint(0xf1f3f5).Cylinder(new Vector3(0, 0.35f, -0.22f), new Vector3(i * 0.06f, 0.55f, -0.36f), 0.06f, 0.0f, 6);
            Eyes(k, new Vector3(0, 0.58f, 0.24f), 0.07f, 0.035f);
            k.Tint(0xf59f00);
            for (int s = -1; s <= 1; s += 2)
            {
                k.Cylinder(new Vector3(s * 0.07f, 0.0f, 0.0f), new Vector3(s * 0.07f, 0.15f, -0.01f), 0.018f, 0.018f, 5);
                k.Cylinder(new Vector3(s * 0.07f, 0.01f, 0.0f), new Vector3(s * 0.07f, 0.01f, 0.08f), 0.015f, 0.01f, 5);
            }
            animals[2] = k.ToMesh("chicken"); k.Clear();

            // Duck.
            k.Tint(0xf8f4e8).Sphere(new Vector3(0, 0.22f, -0.02f), new Vector3(0.21f, 0.18f, 0.3f), 16, 12);
            k.Tint(0xf8f4e8).Cylinder(new Vector3(0, 0.28f, 0.16f), new Vector3(0, 0.42f, 0.2f), 0.08f, 0.07f, 10);
            k.Tint(0xf8f4e8).Sphere(new Vector3(0, 0.46f, 0.21f), 0.11f, 14, 10);
            k.Tint(0xf59f00).Sphere(new Vector3(0, 0.44f, 0.34f), new Vector3(0.065f, 0.025f, 0.08f), 10, 6);
            k.Tint(0xf8f4e8).Cylinder(new Vector3(0, 0.26f, -0.25f), new Vector3(0, 0.36f, -0.36f), 0.07f, 0, 6);
            k.Tint(0xe9e2cf).Sphere(new Vector3(0.18f, 0.25f, -0.03f), new Vector3(0.05f, 0.1f, 0.2f), 10, 8);
            k.Tint(0xe9e2cf).Sphere(new Vector3(-0.18f, 0.25f, -0.03f), new Vector3(0.05f, 0.1f, 0.2f), 10, 8);
            Eyes(k, new Vector3(0, 0.49f, 0.27f), 0.065f, 0.03f);
            k.Tint(0xf59f00);
            for (int s = -1; s <= 1; s += 2) k.Sphere(new Vector3(s * 0.08f, 0.02f, 0.03f), new Vector3(0.05f, 0.015f, 0.07f), 8, 4);
            animals[3] = k.ToMesh("duck"); k.Clear();

            // Rabbit.
            k.Tint(0xb08968).Sphere(new Vector3(0, 0.22f, -0.04f), new Vector3(0.19f, 0.2f, 0.25f), 16, 12);
            k.Tint(0xb08968).Sphere(new Vector3(0, 0.38f, 0.17f), new Vector3(0.13f, 0.12f, 0.14f), 14, 10);
            for (int s = -1; s <= 1; s += 2)
            {
                k.Tint(0xb08968).Capsule(new Vector3(s * 0.05f, 0.47f, 0.13f), new Vector3(s * 0.09f, 0.72f, 0.06f), 0.04f, 8);
                k.Tint(0xffc9d6).Capsule(new Vector3(s * 0.05f, 0.5f, 0.15f), new Vector3(s * 0.088f, 0.7f, 0.09f), 0.022f, 6);
                k.Tint(0x9c7356).Sphere(new Vector3(s * 0.1f, 0.05f, 0.12f), new Vector3(0.05f, 0.04f, 0.08f), 8, 6);
                k.Tint(0x9c7356).Sphere(new Vector3(s * 0.12f, 0.08f, -0.12f), new Vector3(0.06f, 0.07f, 0.12f), 8, 6);
            }
            k.Tint(0xffffff).Sphere(new Vector3(0, 0.25f, -0.3f), 0.08f, 10, 8);
            k.Tint(0xffc9d6).Sphere(new Vector3(0, 0.38f, 0.31f), 0.025f, 6, 4);
            Eyes(k, new Vector3(0, 0.42f, 0.25f), 0.065f, 0.03f);
            animals[4] = k.ToMesh("rabbit"); k.Clear();

            // Sheep: a cloud of wool on black legs.
            var wool = new System.Random(4);
            for (int i = 0; i < 16; i++)
            {
                var p = new Vector3((float)(wool.NextDouble() - 0.5) * 0.5f, 0.52f + (float)(wool.NextDouble() - 0.4) * 0.28f, (float)(wool.NextDouble() - 0.5) * 0.75f);
                k.C = Color.Lerp(MeshKit.Hex(0xe9e4d8), MeshKit.Hex(0xfffdf6), (float)wool.NextDouble());
                k.Sphere(p, 0.18f + (float)wool.NextDouble() * 0.08f, 12, 8);
            }
            k.Tint(0x2b2b2b).Sphere(new Vector3(0, 0.6f, 0.47f), new Vector3(0.14f, 0.16f, 0.19f), 12, 10);
            for (int s = -1; s <= 1; s += 2) k.Tint(0x2b2b2b).Sphere(new Vector3(s * 0.16f, 0.66f, 0.42f), new Vector3(0.09f, 0.04f, 0.05f), 8, 6);
            k.Tint(0xfffdf6).Sphere(new Vector3(0, 0.76f, 0.43f), 0.09f, 10, 8);
            Eyes(k, new Vector3(0, 0.66f, 0.58f), 0.065f, 0.038f, 0.5f);
            Legs(k, 0x2b2b2b, 0.36f, 0.16f, 0.22f, 0.045f);
            animals[5] = k.ToMesh("sheep"); k.Clear();

            // Pig.
            k.Tint(0xf7a8b8).Sphere(new Vector3(0, 0.42f, -0.03f), new Vector3(0.35f, 0.32f, 0.5f), 18, 12);
            k.Tint(0xf7a8b8).Sphere(new Vector3(0, 0.5f, 0.43f), 0.24f, 16, 12);
            k.Tint(0xf28aa0).Cylinder(new Vector3(0, 0.46f, 0.6f), new Vector3(0, 0.46f, 0.7f), 0.11f, 0.11f, 14);
            for (int s = -1; s <= 1; s += 2)
            {
                k.Tint(0x7a2e3d).Sphere(new Vector3(s * 0.04f, 0.47f, 0.705f), new Vector3(0.022f, 0.035f, 0.01f), 6, 4);
                k.Tint(0xf28aa0).Cylinder(new Vector3(s * 0.13f, 0.66f, 0.42f), new Vector3(s * 0.2f, 0.82f, 0.48f), 0.08f, 0, 4);
            }
            k.M = Matrix4x4.TRS(new Vector3(0, 0.5f, -0.54f), Quaternion.Euler(90, 0, 0), Vector3.one);
            k.Tint(0xf28aa0).Torus(Vector3.zero, 0.06f, 0.018f, 12, 5, 300);
            k.M = Matrix4x4.identity;
            Eyes(k, new Vector3(0, 0.6f, 0.58f), 0.1f, 0.04f);
            Legs(k, 0xf28aa0, 0.2f, 0.2f, 0.28f, 0.07f);
            animals[6] = k.ToMesh("pig"); k.Clear();

            // Goat: horns, a beard and a cheeky tail.
            k.Tint(0xe9e4da).Sphere(new Vector3(0, 0.6f, -0.05f), new Vector3(0.28f, 0.28f, 0.5f), 16, 12);
            k.Tint(0xe9e4da).Cylinder(new Vector3(0, 0.72f, 0.32f), new Vector3(0, 0.92f, 0.45f), 0.13f, 0.11f, 10);
            k.Tint(0xe9e4da).Sphere(new Vector3(0, 0.97f, 0.53f), new Vector3(0.14f, 0.15f, 0.22f), 14, 10);
            k.Tint(0xd4ccbd).Sphere(new Vector3(0, 0.93f, 0.7f), new Vector3(0.09f, 0.08f, 0.08f), 10, 8);
            for (int s = -1; s <= 1; s += 2)
            {
                k.Tint(0x8d7a62).Cylinder(new Vector3(s * 0.07f, 1.08f, 0.48f), new Vector3(s * 0.14f, 1.25f, 0.3f), 0.04f, 0.01f, 6);
                k.Tint(0xd4ccbd).Sphere(new Vector3(s * 0.17f, 1.0f, 0.45f), new Vector3(0.1f, 0.03f, 0.05f), 8, 4);
            }
            k.Tint(0xbfb5a3).Cylinder(new Vector3(0, 0.86f, 0.66f), new Vector3(0, 0.72f, 0.64f), 0.04f, 0.0f, 6);
            k.Tint(0xe9e4da).Cylinder(new Vector3(0, 0.75f, -0.5f), new Vector3(0, 0.88f, -0.58f), 0.04f, 0.0f, 6);
            Eyes(k, new Vector3(0, 1.03f, 0.62f), 0.075f, 0.035f);
            Legs(k, 0xd4ccbd, 0.42f, 0.15f, 0.3f, 0.045f);
            Legs(k, 0x5c4a3a, 0.06f, 0.15f, 0.3f, 0.05f);
            animals[7] = k.ToMesh("goat"); k.Clear();
        }

        // ------------------------------------------------------------------ hazards

        static void BuildHazards()
        {
            hazards = new Mesh[9];
            var k = new MeshKit();
            for (int v = 0; v < 3; v++)
            {
                // Rock: a faceted boulder with a mossy top.
                k.C = Color.Lerp(MeshKit.Hex(0x7d8086), MeshKit.Hex(0x9a9ca1), v * 0.4f);
                k.Blob(new Vector3(0, 0.3f, 0), new Vector3(0.78f, 0.5f, 0.7f), 0.28f, 10 + v, 1, true);
                k.C = MeshKit.Hex(0x6f9a46);
                k.Blob(new Vector3(0.1f, 0.62f, -0.05f), new Vector3(0.32f, 0.08f, 0.28f), 0.2f, 20 + v, 1, true);
                hazards[v] = k.ToMesh("rock"); k.Clear();

                // Stones: a little cairn of pebbles.
                for (int i = 0; i < 4; i++)
                {
                    float a = i * 1.7f + v, r = i == 0 ? 0 : 0.28f;
                    k.C = Color.Lerp(MeshKit.Hex(0x8b8f96), MeshKit.Hex(0xb2a99a), (i + v) % 3 * 0.4f);
                    k.Blob(new Vector3(Mathf.Cos(a) * r, 0.14f + (i == 0 ? 0.08f : 0), Mathf.Sin(a) * r), new Vector3(0.24f, 0.16f, 0.22f), 0.25f, 30 + i + v * 5, 1, true);
                }
                hazards[3 + v] = k.ToMesh("stones"); k.Clear();

                // Sticks: a crossed pile of twigs.
                for (int i = 0; i < 4; i++)
                {
                    float a = i * 0.9f + v;
                    var d = new Vector3(Mathf.Cos(a), 0, Mathf.Sin(a)) * 0.6f;
                    k.Tint(i % 2 == 0 ? 0x7a5230u : 0x8c6239u).Cylinder(-d + Vector3.up * (0.06f + i * 0.05f), d + Vector3.up * (0.1f + i * 0.03f), 0.06f, 0.04f, 7);
                    k.Tint(0x7a5230).Cylinder(d * 0.3f + Vector3.up * 0.1f, d * 0.3f + new Vector3(0.15f, 0.25f, 0.1f), 0.025f, 0.01f, 5);
                }
                k.Tint(0x6f9a46).Sphere(new Vector3(0.2f, 0.25f, 0.1f), new Vector3(0.08f, 0.02f, 0.05f), 6, 4);
                hazards[6 + v] = k.ToMesh("sticks"); k.Clear();
            }
        }

        static Mesh PelletMesh()
        {
            var k = new MeshKit();
            k.Sphere(new Vector3(0, 0.16f, 0), 0.16f, 12, 8);
            return k.ToMesh("pellet");
        }

        // ------------------------------------------------------------------ Mr Cooper

        public sealed class Rig { public Transform root, body, legL, legR, armL, armR, head; }

        /// <summary>Mr Cooper: tall, thin, immaculate in a navy suit, short white hair. Jointed for running.</summary>
        public static Rig Cooper(Transform parent)
        {
            var rig = new Rig { root = new GameObject("Mr Cooper").transform };
            rig.root.SetParent(parent, false);
            rig.body = Part(rig.root, "body", new Vector3(0, 0, 0), k =>
            {
                k.Tint(0x1f2a44).RoundBox(new Vector3(0, 1.25f, 0), new Vector3(0.56f, 0.75f, 0.3f), 0.12f);
                k.Tint(0x1f2a44).Sphere(new Vector3(-0.27f, 1.56f, 0), 0.09f, 10, 8);
                k.Tint(0x1f2a44).Sphere(new Vector3(0.27f, 1.56f, 0), 0.09f, 10, 8);
                k.Tint(0xffffff).Box(new Vector3(0, 1.45f, 0.13f), new Vector3(0.16f, 0.3f, 0.04f));
                k.Tint(0xc92a2a).Box(new Vector3(0, 1.38f, 0.155f), new Vector3(0.07f, 0.34f, 0.02f));
                k.Tint(0x1f2a44).Box(new Vector3(-0.1f, 1.48f, 0.145f), new Vector3(0.08f, 0.22f, 0.02f));
                k.Tint(0x1f2a44).Box(new Vector3(0.1f, 1.48f, 0.145f), new Vector3(0.08f, 0.22f, 0.02f));
                k.Tint(0xf1c9a5).Cylinder(new Vector3(0, 1.6f, 0), new Vector3(0, 1.72f, 0), 0.07f, 0.07f, 8);
            });
            rig.head = Part(rig.body, "head", new Vector3(0, 1.86f, 0), k =>
            {
                k.Tint(0xf1c9a5).Sphere(Vector3.zero, new Vector3(0.19f, 0.22f, 0.2f), 16, 12);
                // A neat short crop: a thin white cap at the back and top, the face left clear.
                k.M = Matrix4x4.TRS(new Vector3(0, 0.05f, -0.03f), Quaternion.Euler(-28, 0, 0), Vector3.one);
                k.Tint(0xf4f4f4).Sphere(Vector3.zero, new Vector3(0.2f, 0.19f, 0.2f), 16, 10, 0, 0.42f);
                k.M = Matrix4x4.identity;
                foreach (int s in new[] { -1, 1 })
                {
                    k.Tint(0xf1c9a5).Sphere(new Vector3(s * 0.19f, 0, 0), new Vector3(0.04f, 0.06f, 0.04f), 8, 6);
                    k.Tint(0x111111).Sphere(new Vector3(s * 0.07f, 0.03f, 0.18f), 0.026f, 8, 6);
                    k.M = Matrix4x4.TRS(new Vector3(s * 0.07f, 0.03f, 0.19f), Quaternion.Euler(90, 0, 0), Vector3.one);
                    k.Tint(0x2b2d42).Torus(Vector3.zero, 0.05f, 0.008f, 16, 4);
                    k.M = Matrix4x4.identity;
                    k.Tint(0xdedede).Box(new Vector3(s * 0.07f, 0.1f, 0.18f), new Vector3(0.07f, 0.015f, 0.02f));
                }
                k.Tint(0x2b2d42).Box(new Vector3(0, 0.035f, 0.2f), new Vector3(0.05f, 0.008f, 0.01f));
                k.Tint(0xe2a985).Sphere(new Vector3(0, -0.02f, 0.2f), new Vector3(0.03f, 0.045f, 0.035f), 8, 6);
                // A polite smile.
                for (int i = 0; i < 5; i++)
                {
                    float a0 = Mathf.Lerp(-0.7f, 0.7f, i / 5f), a1 = Mathf.Lerp(-0.7f, 0.7f, (i + 1) / 5f);
                    Vector3 P(float a) => new Vector3(Mathf.Sin(a) * 0.06f, -0.09f + (1 - Mathf.Cos(a)) * 0.04f, 0.185f);
                    k.Tint(0x7a3b2e).Cylinder(P(a0), P(a1), 0.009f, 0.009f, 4, false, false);
                }
            });
            Transform Limb(Vector3 at, System.Action<MeshKit> build) => Part(rig.body, "limb", at, build);
            rig.legL = Limb(new Vector3(-0.12f, 0.9f, 0), k => { k.Tint(0x1f2a44).Capsule(new Vector3(0, -0.05f, 0), new Vector3(0, -0.78f, 0), 0.08f, 8); k.Tint(0x111111).RoundBox(new Vector3(0, -0.86f, 0.07f), new Vector3(0.12f, 0.08f, 0.28f), 0.04f); });
            rig.legR = Limb(new Vector3(0.12f, 0.9f, 0), k => { k.Tint(0x1f2a44).Capsule(new Vector3(0, -0.05f, 0), new Vector3(0, -0.78f, 0), 0.08f, 8); k.Tint(0x111111).RoundBox(new Vector3(0, -0.86f, 0.07f), new Vector3(0.12f, 0.08f, 0.28f), 0.04f); });
            rig.armL = Limb(new Vector3(-0.31f, 1.55f, 0), k => { k.Tint(0x1f2a44).Capsule(Vector3.zero, new Vector3(0, -0.6f, 0), 0.065f, 8); k.Tint(0xf1c9a5).Sphere(new Vector3(0, -0.68f, 0), 0.065f, 8, 6); });
            rig.armR = Limb(new Vector3(0.31f, 1.55f, 0), k => { k.Tint(0x1f2a44).Capsule(Vector3.zero, new Vector3(0, -0.6f, 0), 0.065f, 8); k.Tint(0xf1c9a5).Sphere(new Vector3(0, -0.68f, 0), 0.065f, 8, 6); });
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
    }
}
