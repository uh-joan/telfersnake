using System;

namespace Telfer.Sim
{
    public sealed class Building
    {
        public string id;
        public Box box;
        public float h, roofH;
        public uint wall, roof;
        public bool brick;
        public Building(string id, float x, float z, float w, float d, float h, float roofH, uint wall, uint roof, bool brick = false)
        {
            this.id = id; box = new Box(x, z, w, d); this.h = h; this.roofH = roofH; this.wall = wall; this.roof = roof; this.brick = brick;
        }
    }

    public struct Tree { public float x, z, r, canopy; public Tree(float x, float z, float r, float c) { this.x = x; this.z = z; this.r = r; canopy = c; } }
    public struct Car { public Box box; public uint color; public Car(float x, float z, float w, float d, uint c) { box = new Box(x, z, w, d); color = c; } }

    /// <summary>
    /// The Telferscot playground, blocked out from the satellite view. Metres; +x east, +z south.
    /// A straight port of src/sim/layout.ts: the sim reads it for collisions, the views for looks.
    /// </summary>
    public sealed class School : ITerrain
    {
        static School stage;
        /// <summary>Built on first use: the static tables below must be initialised first.</summary>
        public static School Stage => stage ?? (stage = new School());

        public static readonly Bounds2 BOUNDS = new Bounds2(-38, 38, -40, 40);
        const uint BRICK = 0xa3583a, TILE = 0x6e4b3c;

        public static readonly Building[] BUILDINGS =
        {
            new Building("northBlock", -14, -35.5f, 48, 9, 4, 0, 0xdfe3e8, 0x4b5060),
            new Building("oldMain", 26, -8, 24, 32, 5, 2.6f, BRICK, TILE, true),
            new Building("oldNorthEast", 24, -32, 28, 16, 4.5f, 2.2f, BRICK, TILE, true),
            new Building("oldWest", 8, -5, 12, 14, 4.5f, 2.2f, BRICK, TILE, true),
            new Building("oldSouth", 15, 13, 14, 10, 4.5f, 2.2f, BRICK, TILE, true),
            new Building("redHut", 5, 33, 12, 8, 3, 1.8f, 0xeadcc4, 0xe9633b),
            new Building("bikeShed", 26.5f, 24, 17, 6, 2.6f, 0.9f, 0xc9ccd1, 0xb4b8bf),
            new Building("blackShed", -22, 10.5f, 12, 3, 2.4f, 0, 0x2d3038, 0x22242a),
        };

        public static readonly Box COURT = new Box(-27, -8, 16, 28);
        const float FENCE_T = 0.3f;
        public static readonly Box[] COURT_FENCES =
        {
            new Box(-35, -8, FENCE_T, 28),
            new Box(-27, -22, 16, FENCE_T),
            new Box(-19, -16, FENCE_T, 12),
            new Box(-19, 0.5f, FENCE_T, 11),
            new Box(-32.5f, 6, 5, FENCE_T),
            new Box(-22, 6, 6, FENCE_T),
        };

        public static readonly Box GREEN = new Box(-12, 31, 20, 12);
        public static readonly Box TOP_PLAYGROUND = new Box(-5, -21, 30, 18);
        public static readonly Box CAR_PARK = new Box(25, 34, 26, 12);
        public static readonly Box SAIL = new Box(-5, -8, 9, 9);
        public const float LAGOON_X = -1, LAGOON_Z = 10, LAGOON_RX = 7.5f, LAGOON_RZ = 5.2f, LAGOON_ROT = -0.2f;
        public const float LOOP_X = -4, LOOP_Z = -24, LOOP_RX = 8, LOOP_RZ = 4.5f;
        public const float LANES_X0 = -16, LANES_X1 = 4, LANES_Z0 = 18, LANES_Z1 = 22; public const int LANES_COUNT = 4;
        public const float HOP_X = -13, HOP_Z0 = 7; public const int HOP_CELLS = 8;
        public const float TARGET_X = -13, TARGET_Z = 13, TARGET_SIZE = 3;

        public static readonly Box[] BENCHES = { new Box(-7.5f, -24, 1.8f, 0.9f), new Box(-0.5f, -24, 1.8f, 0.9f), new Box(-9, -16, 1.8f, 0.9f) };
        public static readonly Box PLATFORM = new Box(1, 8.5f, 2, 2);

        public static readonly Tree[] TREES =
        {
            new Tree(-4, -24, 0.5f, 1.5f), new Tree(-15, -27, 0.5f, 1.6f), new Tree(6, -28, 0.5f, 1.5f),
            new Tree(-19, 27, 0.9f, 3.4f), new Tree(-13, 34, 0.5f, 1.6f),
        };

        public static readonly Car[] CARS =
        {
            new Car(15.3f, 36.4f, 1.9f, 4.2f, 0x2b2f38), new Car(20.5f, 36.4f, 1.9f, 4.2f, 0xd9dde2), new Car(28.3f, 36.4f, 1.9f, 4.2f, 0x3a5fa8),
        };

        public const float SPAWN_X = -12, SPAWN_Z = 20, SPAWN_HEADING = 0;
        public const float COOPER_X = -4, COOPER_Z = -18;
        public static readonly Bounds2 COOPER_BEAT = new Bounds2(-36, 10, -29, 38);

        /// <summary>Bike Shed Alley and the yard behind the Old School get more than their share of rocks.</summary>
        public static readonly Bounds2 HAZARD_ROUGH = new Bounds2(12, 38, 8, 40);
        public const float HAZARD_SHARE = 0.4f;

        readonly Box[] solidBoxes;
        readonly Circle[] solidCircles;

        School()
        {
            var list = new System.Collections.Generic.List<Box>();
            foreach (var b in BUILDINGS) list.Add(b.box);
            list.AddRange(COURT_FENCES);
            list.AddRange(BENCHES);
            list.Add(PLATFORM);
            foreach (var c in CARS) list.Add(c.box);
            solidBoxes = list.ToArray();
            solidCircles = Array.ConvertAll(TREES, t => new Circle(t.x, t.z, t.r));
        }

        public Bounds2 Bounds => BOUNDS;
        public Box[] SolidBoxes => solidBoxes;
        public Circle[] SolidCircles => solidCircles;

        public FoodKind FoodKindAt(Rng rng, float x, float z) =>
            Foods.Pick(rng, GREEN.Contains(x, z) ? Foods.WEIGHTS_GREEN : Foods.WEIGHTS_YARD);

        public void HomePoint(Rng rng, Home home, out float x, out float z)
        {
            switch (home)
            {
                case Home.Green:
                    x = rng.Range(GREEN.x - GREEN.w / 2, GREEN.x + GREEN.w / 2);
                    z = rng.Range(GREEN.z - GREEN.d / 2, GREEN.z + GREEN.d / 2);
                    return;
                case Home.Lagoon:
                {
                    float a = rng.Range(0, Collide.PI * 2), d = rng.Range(0, LAGOON_RX + 2);
                    x = LAGOON_X + (float)Math.Cos(a) * d;
                    z = LAGOON_Z + (float)Math.Sin(a) * d * 0.8f;
                    return;
                }
                case Home.Yard:
                    x = rng.Range(LANES_X0 - 2, LANES_X1 + 2);
                    z = rng.Range(LANES_Z0 - 6, LANES_Z1 + 3);
                    return;
                default:
                    x = rng.Range(BOUNDS.minX, BOUNDS.maxX);
                    z = rng.Range(BOUNDS.minZ, BOUNDS.maxZ);
                    return;
            }
        }

        public static bool InLagoon(float x, float z)
        {
            float c = (float)Math.Cos(-LAGOON_ROT), s = (float)Math.Sin(-LAGOON_ROT);
            float dx = x - LAGOON_X, dz = z - LAGOON_Z;
            float lx = dx * c - dz * s, lz = dx * s + dz * c;
            return (lx * lx) / (LAGOON_RX * LAGOON_RX) + (lz * lz) / (LAGOON_RZ * LAGOON_RZ) <= 1;
        }
    }
}
