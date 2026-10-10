using System;
using System.Collections.Generic;

namespace Telfer.Sim
{
    // ------------------------------------------------------------------ food

    public enum FoodKind
    {
        Burger, Sausage, Cookie, Broccoli, Carrot, Apple, Mushroom, Tomato, Berry, Acorn,
        // London's menu (Level 3), appended so the protocol's indices stay put.
        FishChips, Scone, Sponge, Sandwich, Pie, SausageRoll, Crumpet, Strawberry, JellyBaby, Bagel, Biscuit, Tea,
    }

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
        public static readonly float[] VALUE = { 3, 2, 1, 3, 2, 2, 3, 2, 1, 2, 4, 2, 3, 2, 3, 2, 2, 2, 1, 2, 1, 1 };
        /// <summary>The afternoon-tea bites, in the order that makes a Tea Time (London).</summary>
        public static readonly FoodKind[] TEA_TIME = { FoodKind.Sandwich, FoodKind.Scone, FoodKind.Sponge };
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

        public static void Place(Food food, Rng rng, Stage stage, int tick, float avoidX, float avoidZ, float clear, IReadOnlyList<Circle> rocks, int luck = 0)
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
            float a = Sq(stage.SpawnX - avoidX) + Sq(stage.SpawnZ - avoidZ);
            float b = Sq(stage.FallbackX - avoidX) + Sq(stage.FallbackZ - avoidZ);
            if (a > b) { food.x = stage.SpawnX; food.z = stage.SpawnZ; }
            else { food.x = stage.FallbackX; food.z = stage.FallbackZ; }
        }

        static float Sq(float v) => v * v;
    }

    // ------------------------------------------------------------------ hazards & pellets

    public enum HazardKind { Rock, Stones, Sticks, Puddle, Umbrella, Roadworks }

    public sealed class Hazard
    {
        public HazardKind kind;
        public float x, z, r, turn;
        public int hits, limit;
        /// <summary>Bumped this tick (the view wobbles it).</summary>
        public int lastHitTick = -9999;
        public int version;
        public Circle AsCircle => new Circle(x, z, r);
        /// <summary>London's puddle lies flat and is slid across; everything else is bumped (hazards.ts isSolidHazard).</summary>
        public bool Solid => kind != HazardKind.Puddle;
    }

    public sealed class Pellet
    {
        public float x, z, value;
        public int born;
        public uint color;
    }

    public static class Hazards
    {
        static readonly float[] RADIUS = { 0.7f, 0.5f, 0.55f, 1.2f, 0.6f, 0.9f };
        /// <summary>How far a hazard keeps from a bus or cab lane (half a bus, and room to slither past).</summary>
        const float ROUTE_CLEARANCE = 2.6f;
        const int COUNT = 14;
        const float SPAWN_CLEARANCE = 7, FENCE_GAP = 2.8f;
        public const int PELLET_LIFE_TICKS = 25 * 60;

        static int HitLimit(Rng rng) => 2 + rng.Int(4);

        public static bool Place(Hazard h, Rng rng, Stage stage, List<Circle> others, Func<float, float, bool> avoid)
        {
            if (!stage.HasHazards) return false;
            var B = stage.Bounds;
            for (int tries = 0; tries < 200; tries++)
            {
                var box = rng.Next() < stage.HazardShare ? stage.HazardRough : B;
                float x = rng.Range(box.minX, box.maxX), z = rng.Range(box.minZ, box.maxZ);
                if (!Collide.IsFree(stage, x, z, h.r + 1.6f, others)) continue;
                float edge = h.r + FENCE_GAP;
                if (x < B.minX + edge || x > B.maxX - edge || z < B.minZ + edge || z > B.maxZ - edge) continue;
                if (avoid(x, z)) continue;
                // London: nothing dropped in the road, where a bus would plough straight through it.
                if (stage.Routes != null && InRoad(stage, x, z, h.r + ROUTE_CLEARANCE)) continue;
                h.x = x; h.z = z;
                h.turn = rng.Range(0, Collide.PI * 2);
                h.hits = 0;
                h.limit = HitLimit(rng);
                h.version++;
                return true;
            }
            return false;
        }

        static bool InRoad(Stage stage, float x, float z, float clear)
        {
            foreach (var r in stage.Routes) if (Vehicles.DistanceToLoop(r.path, x, z) < clear) return true;
            return false;
        }

        public static List<Hazard> Make(Rng rng, Stage stage)
        {
            var list = new List<Hazard>();
            if (!stage.HasHazards) return list;
            var circles = new List<Circle>();
            for (int i = 0; i < COUNT; i++)
            {
                var kind = rng.Pick(stage.HazardKinds);
                var h = new Hazard { kind = kind, r = RADIUS[(int)kind], limit = HitLimit(rng) };
                if (Place(h, rng, stage, circles, (x, z) => Collide.Hypot(x - stage.SpawnX, z - stage.SpawnZ) < SPAWN_CLEARANCE))
                {
                    list.Add(h);
                    circles.Add(h.AsCircle);
                }
            }
            return list;
        }
    }

    // ------------------------------------------------------------------ animals

    public enum AnimalKind
    {
        Snail, Ladybird, Chicken, Duck, Rabbit, Sheep, Pig, Goat, Squirrel, Crow, Deer, Hedgehog, Fox, Pigeon,
        // London's zoo (Level 3), appended so the protocol's indices stay put.
        Corgi, Swan, Gull, Pelican, Horse, Dino,
    }
    public enum Home { Green, Yard, Lagoon, Anywhere, Woods, Meadow, Glade, Palace, Lake, Trafalgar, River, Museum }
    public enum AnimalMode { Wander, Rest, Flee, Charge, Swoop }

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
        /// <summary>London: seconds before it may do its trick again (raid, chase, yip), or a pigeon stays aloft.</summary>
        public float busy;
        /// <summary>London: the food a gull or pelican is going for (-1 when a gull flies off with it), and that food's born tick when picked.</summary>
        public int target = -1, targetBorn;
        /// <summary>Where it was put down: London's lake birds wander back toward it.</summary>
        public float homeX, homeZ;
        public AnimalSpec Spec => Animals.SPECS[(int)kind];
    }

    public static class Animals
    {
        /// <summary>Never gulped, at any size: the King's swans.</summary>
        public const int NEVER_GULPED = 99;

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
            // Forest animals of the Common.
            new AnimalSpec(0, 4, 0.28f, 1.4f, 5.5f, 6, 1.6f, 4, Home.Woods),     // squirrel
            new AnimalSpec(2, 7, 0.35f, 1.2f, 4.5f, 6, 1.0f, 3, Home.Anywhere),  // crow
            new AnimalSpec(3, 22, 0.6f, 1.0f, 7.0f, 9, 0.4f, 2, Home.Anywhere),  // deer
            new AnimalSpec(1, 6, 0.3f, 0.6f, 1.4f, 3, 0.3f, 3, Home.Woods),      // hedgehog
            new AnimalSpec(2, 12, 0.4f, 1.5f, 4.0f, 6, 0.7f, 2, Home.Woods),     // fox
            new AnimalSpec(0, 3, 0.25f, 0.9f, 3.5f, 4, 1.2f, 5, Home.Anywhere),  // pigeon
            // London's zoo.
            new AnimalSpec(1, 5, 0.3f, 1.7f, 4.2f, 5, 1.1f, 4, Home.Palace),             // corgi
            new AnimalSpec(NEVER_GULPED, 0, 0.45f, 0.7f, 0, 0, 0, 3, Home.Lake),         // swan
            new AnimalSpec(2, 8, 0.3f, 1.2f, 5.5f, 6, 1.0f, 4, Home.River),              // gull
            new AnimalSpec(3, 18, 0.55f, 0.9f, 3.2f, 5.5f, 0.3f, 2, Home.Lake),          // pelican
            new AnimalSpec(4, 32, 0.7f, 1.4f, 5.0f, 7, 0.3f, 1, Home.Palace),            // horse
            new AnimalSpec(5, 80, 0.9f, 0.6f, 1.9f, 8, 0.2f, 1, Home.Museum),            // dino
        };

        const float TURN_RATE = 6, JITTER_EVERY = 0.35f, CALM_DOWN = 1.6f;
        const float GOAT_SIGHT = 8, GOAT_GIVES_UP = 11, GOAT_CHARGE = 4.2f, GOAT_CHARGE_FOR = 3, FLOCK_GAP = 3.5f;
        // London's characters (animals.ts).
        const float SWAN_SIGHT = 5, SWAN_CHASE = 3.2f, SWAN_CHASE_FOR = 2, SWAN_SULK = 8;
        const float PIGEON_SCARE = 7, PIGEON_FLOCK = 9, PIGEON_LIFT = 2.5f, PIGEON_BURST = 1.8f;
        const float GULL_EYE = 14, GULL_NEAR_SNAKE = 6, GULL_SWOOP = 6, GULL_EVERY = 9;
        const float PELICAN_EYE = 7, PELICAN_EVERY = 6, GIVE_UP = 5, YIP_EVERY = 2.5f, LAKE_LEASH = 6;

        static bool LakeBird(AnimalKind k) => k == AnimalKind.Swan || k == AnimalKind.Duck || k == AnimalKind.Pelican;

        public static void Place(Animal a, World w, float clear)
        {
            var spec = a.Spec;
            var home = spec.home;
            if (w.Stage.AnimalHomes != null && w.Stage.AnimalHomes.TryGetValue(a.kind, out var own)) home = own;
            bool placed = false;
            for (int tries = 0; tries < 120 && !placed; tries++)
            {
                w.Stage.HomePoint(w.Rng, tries < 30 ? home : Home.Anywhere, out float x, out float z);
                if (!Collide.IsFree(w.Stage, x, z, spec.radius + 0.3f, w.HazardCircles)) continue;
                if (!w.ClearOfSnakes(x, z, tries < 60 ? clear : Math.Min(clear, 6))) continue;
                a.x = x; a.z = z;
                placed = true;
            }
            if (!placed)
            {
                if (w.ClearOfSnakes(w.Stage.SpawnX, w.Stage.SpawnZ, 6)) { a.x = w.Stage.SpawnX; a.z = w.Stage.SpawnZ; }
                else { a.x = w.Stage.FallbackX; a.z = w.Stage.FallbackZ; }
            }
            a.homeX = a.x; a.homeZ = a.z;
            a.heading = a.want = w.Rng.Range(-Collide.PI, Collide.PI);
            a.speed = 0;
            a.mode = AnimalMode.Rest;
            a.timer = w.Rng.Range(0.5f, 2);
            a.boopCooldown = 0;
            a.dazed = 0;
            a.charged = false;
            a.chargeFor = 0;
            a.busy = 0;
            a.target = -1;
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
            bool london = w.Stage.Id == StageId.London;
            a.boopCooldown = Math.Max(0, a.boopCooldown - dt);
            if (a.busy > 0) a.busy -= dt; // only London's characters ever set it
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

            // London's pigeons: a snake dashing in lifts the whole flock at once.
            if (a.kind == AnimalKind.Pigeon && london && a.busy <= 0 && s.dashing && dist < PIGEON_SCARE) LiftFlock(a, w);

            if (edible && spec.alert > 0 && dist < spec.alert + s.Radius)
            {
                if (a.mode != AnimalMode.Flee)
                {
                    a.timer = 0;
                    if (a.kind == AnimalKind.Corgi && a.busy <= 0)
                    {
                        a.busy = YIP_EVERY; // chased: a yip, and off it zooms
                        w.Events.Add(new GameEvent { type = EventType.Cry, animal = a.kind, x = a.x, z = a.z });
                    }
                }
                a.mode = AnimalMode.Flee;
            }
            else if (a.mode == AnimalMode.Flee && dist > spec.alert * CALM_DOWN && !(a.kind == AnimalKind.Pigeon && a.busy > 0))
            {
                a.mode = AnimalMode.Rest;
                a.timer = w.Rng.Range(0.4f, 1.2f);
            }
            if (a.mode == AnimalMode.Charge)
            {
                a.chargeFor -= dt;
                if (edible || a.boopCooldown > 0 || dist > GOAT_GIVES_UP || a.chargeFor <= 0)
                {
                    a.mode = AnimalMode.Rest;
                    a.timer = 1.5f;
                    if (a.kind == AnimalKind.Swan) a.busy = SWAN_SULK;
                }
            }
            else if (a.kind == AnimalKind.Goat && !edible && !a.charged && dist < GOAT_SIGHT)
            {
                a.mode = AnimalMode.Charge;
                a.charged = true;
                a.chargeFor = GOAT_CHARGE_FOR;
            }
            else if (a.kind == AnimalKind.Swan && a.busy <= 0 && dist < SWAN_SIGHT)
            {
                // The King's swan: HONK, and a little rush at whoever came too close.
                a.mode = AnimalMode.Charge;
                a.chargeFor = SWAN_CHASE_FOR;
                w.Events.Add(new GameEvent { type = EventType.Cry, animal = a.kind, x = a.x, z = a.z });
            }
            else if ((a.kind == AnimalKind.Gull || a.kind == AnimalKind.Pelican) && a.mode != AnimalMode.Flee && a.mode != AnimalMode.Swoop && a.busy <= 0)
                EyeFood(a, w);

            // London's big ones mind where they put their feet: a wanderer never shoulders a little snake into a wall.
            if (london && !edible && a.mode == AnimalMode.Wander && dist < spec.radius + s.Radius + 0.6f) a.want = (float)Math.Atan2(dz, dx);

            switch (a.mode)
            {
                case AnimalMode.Flee:
                    if (a.timer <= 0)
                    {
                        a.timer = JITTER_EVERY;
                        a.want = (float)Math.Atan2(dz, dx) + w.Rng.Range(-spec.jitter, spec.jitter);
                    }
                    a.speed = a.kind == AnimalKind.Pigeon && a.busy > 0 ? spec.flee * PIGEON_BURST : spec.flee;
                    break;
                case AnimalMode.Charge:
                    a.want = (float)Math.Atan2(-dz, -dx);
                    a.speed = a.kind == AnimalKind.Swan ? SWAN_CHASE : GOAT_CHARGE;
                    break;
                case AnimalMode.Swoop:
                    Swoop(a, w, dt, dx, dz);
                    break;
                case AnimalMode.Rest:
                    a.speed = 0;
                    if (a.timer <= 0)
                    {
                        a.mode = AnimalMode.Wander;
                        a.timer = w.Rng.Range(1.5f, 4);
                        var friend = a.kind == AnimalKind.Sheep || a.kind == AnimalKind.Corgi ? NearestFlockmate(a, w) : null; // flocks and packs
                        a.want = friend != null ? (float)Math.Atan2(friend.z - a.z, friend.x - a.x) : w.Rng.Range(-Collide.PI, Collide.PI);
                        // London's swans, ducks and pelicans keep to their lake's bank.
                        if (london && LakeBird(a.kind) && (a.x - a.homeX) * (a.x - a.homeX) + (a.z - a.homeZ) * (a.z - a.homeZ) > LAKE_LEASH * LAKE_LEASH)
                            a.want = (float)Math.Atan2(a.homeZ - a.z, a.homeX - a.x);
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
            var hit = Collide.ResolveAshore(w.Stage, a.x, a.z, a.x + (float)Math.Cos(a.heading) * step, a.z + (float)Math.Sin(a.heading) * step, spec.radius, w.ScratchHit, w.HazardCircles);
            a.travel += Collide.Hypot(hit.x - a.x, hit.z - a.z);
            a.x = hit.x; a.z = hit.z;
            if (hit.hit)
                a.want = a.mode == AnimalMode.Wander ? (float)Math.Atan2(hit.nz, hit.nx) : Collide.SlideAlong(a.want, hit.nx, hit.nz);
        }

        /// <summary>Every pigeon near `a` takes off together, away from whoever dashed in.</summary>
        static void LiftFlock(Animal a, World w)
        {
            foreach (var o in w.Animals)
            {
                if (o.kind != AnimalKind.Pigeon || (o.x - a.x) * (o.x - a.x) + (o.z - a.z) * (o.z - a.z) > PIGEON_FLOCK * PIGEON_FLOCK) continue;
                o.mode = AnimalMode.Flee;
                o.timer = 0;
                o.busy = PIGEON_LIFT;
            }
            w.Events.Add(new GameEvent { type = EventType.Cry, animal = AnimalKind.Pigeon, x = a.x, z = a.z });
        }

        /// <summary>A gull looks for a snack someone is about to eat; a pelican for any snack close by.</summary>
        static void EyeFood(Animal a, World w)
        {
            bool gull = a.kind == AnimalKind.Gull;
            float eye = gull ? GULL_EYE : PELICAN_EYE;
            int best = -1;
            float bestD = eye * eye;
            for (int i = 0; i < w.Foods.Count; i++)
            {
                var f = w.Foods[i];
                float d = (f.x - a.x) * (f.x - a.x) + (f.z - a.z) * (f.z - a.z);
                if (d >= bestD) continue;
                if (gull && w.ClearOfSnakes(f.x, f.z, GULL_NEAR_SNAKE)) continue;
                bestD = d; best = i;
            }
            if (best < 0) { a.busy = 1; return; }
            a.mode = AnimalMode.Swoop;
            a.target = best;
            a.targetBorn = w.Foods[best].born;
            a.chargeFor = GIVE_UP;
        }

        /// <summary>Going for the food (and, for a gull, flying off with it afterwards).</summary>
        static void Swoop(Animal a, World w, float dt, float dx, float dz)
        {
            bool gull = a.kind == AnimalKind.Gull;
            a.chargeFor -= dt;
            if (a.target < 0)
            {
                // Away with the loot, out from the snake it robbed.
                a.want = (float)Math.Atan2(dz, dx);
                a.speed = GULL_SWOOP;
                if (a.chargeFor <= 0) { a.mode = AnimalMode.Rest; a.timer = 1; }
                return;
            }
            var f = w.Foods[a.target];
            float d = Collide.Hypot(f.x - a.x, f.z - a.z);
            if (a.chargeFor <= 0 || f.born != a.targetBorn || d > GULL_EYE + 2)
            {
                // Someone else got there first, or it is out of reach: never mind.
                a.mode = AnimalMode.Rest;
                a.timer = 1;
                a.target = -1;
                a.busy = (gull ? GULL_EVERY : PELICAN_EVERY) / 2;
                a.speed = 0;
                return;
            }
            if (d < a.Spec.radius + 0.5f)
            {
                w.Events.Add(new GameEvent { type = EventType.Steal, animal = a.kind, food = f.kind, x = f.x, z = f.z });
                Foods.Place(f, w.Rng, w.Stage, w.Tick, a.x, a.z, 8, w.HazardCircles);
                a.busy = gull ? GULL_EVERY : PELICAN_EVERY;
                a.target = -1;
                if (gull) a.chargeFor = 1.5f;
                else { a.mode = AnimalMode.Rest; a.timer = 1.5f; a.speed = 0; }
                return;
            }
            a.want = (float)Math.Atan2(f.z - a.z, f.x - a.x);
            a.speed = gull ? GULL_SWOOP : a.Spec.walk * 1.4f;
        }
    }
}
