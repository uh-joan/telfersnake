using System;
using System.Collections.Generic;

namespace Telfer.Sim
{
    // ------------------------------------------------------------------ food

    public enum FoodKind { Burger, Sausage, Cookie, Broccoli, Carrot, Apple }

    public sealed class Food
    {
        public FoodKind kind;
        public bool golden;
        public float x, z;
        /// <summary>Tick it appeared on; the view pops it in from this.</summary>
        public int born;
    }

    public static class Foods
    {
        public static readonly float[] VALUE = { 3, 2, 1, 3, 2, 2 };
        public static readonly float[] WEIGHTS_YARD = { 1.5f, 2, 3, 1, 1, 1.5f };
        public static readonly float[] WEIGHTS_GREEN = { 0, 0, 0.5f, 4, 4, 2 };
        public const float GOLDEN_MULTIPLIER = 5;
        const float GOLDEN_CHANCE = 0.03f, GOLDEN_PER_LUCK = 0.03f, OUT_OF_BITE = 5;

        public static FoodKind Pick(Rng rng, float[] weights)
        {
            float total = 0;
            foreach (var w in weights) total += w;
            float roll = rng.Next() * total;
            for (int i = 0; i < weights.Length; i++)
            {
                if (roll < weights[i]) return (FoodKind)i;
                roll -= weights[i];
            }
            return (FoodKind)(weights.Length - 1);
        }

        public static void Place(Food food, Rng rng, School stage, int tick, float avoidX, float avoidZ, float clear, IReadOnlyList<Circle> rocks, int luck = 0)
        {
            food.golden = rng.Next() < GOLDEN_CHANCE + GOLDEN_PER_LUCK * luck;
            food.born = tick;
            var B = stage.Bounds;
            for (int tries = 0; tries < 120; tries++)
            {
                float x = rng.Range(B.minX, B.maxX), z = rng.Range(B.minZ, B.maxZ);
                if (!Collide.IsFree(stage, x, z, 0.8f, rocks)) continue;
                float room = tries < 40 ? clear : Math.Min(clear, OUT_OF_BITE);
                if ((x - avoidX) * (x - avoidX) + (z - avoidZ) * (z - avoidZ) < room * room) continue;
                food.x = x; food.z = z;
                food.kind = stage.FoodKindAt(rng, x, z);
                return;
            }
            float a = Sq(School.SPAWN_X - avoidX) + Sq(School.SPAWN_Z - avoidZ);
            float b = Sq(School.COOPER_X - avoidX) + Sq(School.COOPER_Z - avoidZ);
            if (a > b) { food.x = School.SPAWN_X; food.z = School.SPAWN_Z; }
            else { food.x = School.COOPER_X; food.z = School.COOPER_Z; }
        }

        static float Sq(float v) => v * v;
    }

    // ------------------------------------------------------------------ hazards & pellets

    public enum HazardKind { Rock, Stones, Sticks }

    public sealed class Hazard
    {
        public HazardKind kind;
        public float x, z, r, turn;
        public int hits, limit;
        /// <summary>Bumped this tick (the view wobbles it).</summary>
        public int lastHitTick = -9999;
        public int version;
        public Circle AsCircle => new Circle(x, z, r);
    }

    public sealed class Pellet
    {
        public float x, z, value;
        public int born;
        public uint color;
    }

    public static class Hazards
    {
        static readonly float[] RADIUS = { 0.7f, 0.5f, 0.55f };
        const int COUNT = 14;
        const float SPAWN_CLEARANCE = 7, FENCE_GAP = 2.8f;
        public const int PELLET_LIFE_TICKS = 25 * 60;

        static int HitLimit(Rng rng) => 2 + rng.Int(4);

        public static bool Place(Hazard h, Rng rng, School stage, List<Circle> others, Func<float, float, bool> avoid)
        {
            var B = stage.Bounds;
            for (int tries = 0; tries < 200; tries++)
            {
                var box = rng.Next() < School.HAZARD_SHARE ? School.HAZARD_ROUGH : B;
                float x = rng.Range(box.minX, box.maxX), z = rng.Range(box.minZ, box.maxZ);
                if (!Collide.IsFree(stage, x, z, h.r + 1.6f, others)) continue;
                float edge = h.r + FENCE_GAP;
                if (x < B.minX + edge || x > B.maxX - edge || z < B.minZ + edge || z > B.maxZ - edge) continue;
                if (avoid(x, z)) continue;
                h.x = x; h.z = z;
                h.turn = rng.Range(0, Collide.PI * 2);
                h.hits = 0;
                h.limit = HitLimit(rng);
                h.version++;
                return true;
            }
            return false;
        }

        public static List<Hazard> Make(Rng rng, School stage)
        {
            var list = new List<Hazard>();
            var circles = new List<Circle>();
            for (int i = 0; i < COUNT; i++)
            {
                var kind = (HazardKind)rng.Int(3);
                var h = new Hazard { kind = kind, r = RADIUS[(int)kind], limit = HitLimit(rng) };
                if (Place(h, rng, stage, circles, (x, z) => Collide.Hypot(x - School.SPAWN_X, z - School.SPAWN_Z) < SPAWN_CLEARANCE))
                {
                    list.Add(h);
                    circles.Add(h.AsCircle);
                }
            }
            return list;
        }
    }

    // ------------------------------------------------------------------ animals

    public enum AnimalKind { Snail, Ladybird, Chicken, Duck, Rabbit, Sheep, Pig, Goat }
    public enum Home { Green, Yard, Lagoon, Anywhere }
    public enum AnimalMode { Wander, Rest, Flee, Charge }

    public struct AnimalSpec
    {
        public int tier; public float value, radius, walk, flee, alert, jitter; public int count; public Home home;
        public AnimalSpec(int tier, float value, float radius, float walk, float flee, float alert, float jitter, int count, Home home)
        { this.tier = tier; this.value = value; this.radius = radius; this.walk = walk; this.flee = flee; this.alert = alert; this.jitter = jitter; this.count = count; this.home = home; }
    }

    public sealed class Animal
    {
        public AnimalKind kind;
        public float x, z, heading, speed;
        public AnimalMode mode;
        public float travel;
        public int born;
        public float want, timer, boopCooldown, dazed;
        public bool charged;
        public float chargeFor;
        public AnimalSpec Spec => Animals.SPECS[(int)kind];
    }

    public static class Animals
    {
        public static readonly AnimalSpec[] SPECS =
        {
            new AnimalSpec(0, 2, 0.3f, 0.25f, 0.25f, 0, 0, 3, Home.Anywhere),   // snail
            new AnimalSpec(0, 2, 0.25f, 0.7f, 1.6f, 3, 0.5f, 2, Home.Green),    // ladybird
            new AnimalSpec(1, 5, 0.35f, 1.3f, 3.8f, 5, 1.4f, 3, Home.Yard),     // chicken
            new AnimalSpec(1, 5, 0.35f, 1.0f, 3.2f, 4.5f, 0.4f, 2, Home.Lagoon),// duck
            new AnimalSpec(2, 9, 0.35f, 1.6f, 6.0f, 7, 0.9f, 2, Home.Green),    // rabbit
            new AnimalSpec(3, 18, 0.6f, 0.9f, 3.2f, 6, 0.3f, 3, Home.Green),    // sheep
            new AnimalSpec(3, 18, 0.6f, 1.1f, 3.8f, 5.5f, 0.4f, 1, Home.Yard),  // pig
            new AnimalSpec(4, 30, 0.65f, 1.2f, 4.5f, 6, 0.3f, 1, Home.Yard),    // goat
        };

        const float TURN_RATE = 6, JITTER_EVERY = 0.35f, CALM_DOWN = 1.6f;
        const float GOAT_SIGHT = 8, GOAT_GIVES_UP = 11, GOAT_CHARGE = 4.2f, GOAT_CHARGE_FOR = 3, FLOCK_GAP = 3.5f;

        public static void Place(Animal a, World w, float clear)
        {
            var spec = a.Spec;
            bool placed = false;
            for (int tries = 0; tries < 120 && !placed; tries++)
            {
                w.Stage.HomePoint(w.Rng, tries < 30 ? spec.home : Home.Anywhere, out float x, out float z);
                if (!Collide.IsFree(w.Stage, x, z, spec.radius + 0.3f, w.HazardCircles)) continue;
                if (!w.ClearOfSnakes(x, z, tries < 60 ? clear : Math.Min(clear, 6))) continue;
                a.x = x; a.z = z;
                placed = true;
            }
            if (!placed)
            {
                if (w.ClearOfSnakes(School.SPAWN_X, School.SPAWN_Z, 6)) { a.x = School.SPAWN_X; a.z = School.SPAWN_Z; }
                else { a.x = School.COOPER_X; a.z = School.COOPER_Z; }
            }
            a.heading = a.want = w.Rng.Range(-Collide.PI, Collide.PI);
            a.speed = 0;
            a.mode = AnimalMode.Rest;
            a.timer = w.Rng.Range(0.5f, 2);
            a.boopCooldown = 0;
            a.dazed = 0;
            a.charged = false;
            a.chargeFor = 0;
            a.born = w.Tick;
        }

        static Animal NearestFlockmate(Animal a, World w)
        {
            Animal best = null;
            float bestD = float.MaxValue;
            foreach (var o in w.Animals)
            {
                if (o == a || o.kind != a.kind) continue;
                float d = (o.x - a.x) * (o.x - a.x) + (o.z - a.z) * (o.z - a.z);
                if (d < bestD) { bestD = d; best = o; }
            }
            return best != null && bestD > FLOCK_GAP * FLOCK_GAP ? best : null;
        }

        public static void Update(Animal a, World w, float dt)
        {
            var spec = a.Spec;
            a.boopCooldown = Math.Max(0, a.boopCooldown - dt);
            if (a.dazed > 0) { a.dazed -= dt; a.speed = 0; return; }
            a.timer -= dt;

            Snake s = w.Snakes[0];
            float dist = float.MaxValue;
            foreach (var o in w.Snakes)
            {
                if (!o.alive) continue;
                float d = Collide.Hypot(a.x - o.x, a.z - o.z);
                if (d < dist) { dist = d; s = o; }
            }
            float dx = a.x - s.x, dz = a.z - s.z;
            bool edible = s.Tier >= spec.tier;

            if (edible && spec.alert > 0 && dist < spec.alert + s.Radius)
            {
                if (a.mode != AnimalMode.Flee) a.timer = 0;
                a.mode = AnimalMode.Flee;
            }
            else if (a.mode == AnimalMode.Flee && dist > spec.alert * CALM_DOWN)
            {
                a.mode = AnimalMode.Rest;
                a.timer = w.Rng.Range(0.4f, 1.2f);
            }
            if (a.mode == AnimalMode.Charge)
            {
                a.chargeFor -= dt;
                if (edible || a.boopCooldown > 0 || dist > GOAT_GIVES_UP || a.chargeFor <= 0) { a.mode = AnimalMode.Rest; a.timer = 1.5f; }
            }
            else if (a.kind == AnimalKind.Goat && !edible && !a.charged && dist < GOAT_SIGHT)
            {
                a.mode = AnimalMode.Charge;
                a.charged = true;
                a.chargeFor = GOAT_CHARGE_FOR;
            }

            switch (a.mode)
            {
                case AnimalMode.Flee:
                    if (a.timer <= 0)
                    {
                        a.timer = JITTER_EVERY;
                        a.want = (float)Math.Atan2(dz, dx) + w.Rng.Range(-spec.jitter, spec.jitter);
                    }
                    a.speed = spec.flee;
                    break;
                case AnimalMode.Charge:
                    a.want = (float)Math.Atan2(-dz, -dx);
                    a.speed = GOAT_CHARGE;
                    break;
                case AnimalMode.Rest:
                    a.speed = 0;
                    if (a.timer <= 0)
                    {
                        a.mode = AnimalMode.Wander;
                        a.timer = w.Rng.Range(1.5f, 4);
                        var friend = a.kind == AnimalKind.Sheep ? NearestFlockmate(a, w) : null;
                        a.want = friend != null ? (float)Math.Atan2(friend.z - a.z, friend.x - a.x) : w.Rng.Range(-Collide.PI, Collide.PI);
                    }
                    break;
                case AnimalMode.Wander:
                    a.speed = spec.walk;
                    if (a.timer <= 0) { a.mode = AnimalMode.Rest; a.timer = w.Rng.Range(0.5f, 2.5f); }
                    break;
            }

            if (a.speed == 0) return;
            a.heading = Collide.TurnToward(a.heading, a.want, TURN_RATE * dt);
            float step = a.speed * dt;
            var hit = Collide.ResolveCircle(w.Stage, a.x + (float)Math.Cos(a.heading) * step, a.z + (float)Math.Sin(a.heading) * step, spec.radius, w.ScratchHit, w.HazardCircles);
            a.travel += Collide.Hypot(hit.x - a.x, hit.z - a.z);
            a.x = hit.x; a.z = hit.z;
            if (hit.hit)
                a.want = a.mode == AnimalMode.Wander ? (float)Math.Atan2(hit.nz, hit.nx) : Collide.SlideAlong(a.want, hit.nx, hit.nz);
        }
    }
}
