using System;
using System.Collections.Generic;

namespace Telfer.Sim
{
    // ------------------------------------------------------------------ predators (port of predators.ts)

    public enum PredatorKind { Bear, Wolf, Lion, Raven }

    public struct PredatorSpec
    {
        public float radius, roamSpeed, chaseSpeed, sight, biteReach, biteShare, biteCap, biteEvery, chaseTime, restTime;
        public bool howls;
    }

    /// <summary>The Common's dangers: they come for you. A bite just shrinks you and puffs pellets, like a rock.</summary>
    public sealed class Predator
    {
        public PredatorKind kind;
        public float x, z, heading, speed, chargeFor, restFor, biteIn, frozenFor, scaredFor, wx, wz, wanderIn, travel;
        /// <summary>London's lions and ravens: which Lion / Raven state it is in, and that state's clock.</summary>
        public int state;
        public float stateFor;
        /// <summary>Its home: a lion's plinth centre (wx, wz is where it hops down to), a raven's perch.</summary>
        public float hx, hz;
        public PredatorSpec Spec => Predators.SPECS[(int)kind];
        /// <summary>Up and about (not bronze on its plinth, nor roosting on the Tower)? Bears and wolves always are.</summary>
        public bool Awake =>
            kind == PredatorKind.Lion ? state == Lion.Prowl || state == Lion.Home || state == Lion.Stone :
            kind == PredatorKind.Raven ? state != Raven.Perched : true;
    }

    /// <summary>
    /// London's lions: asleep in bronze on the plinths (Statue) until a snake comes close; a stretch and a
    /// yawn (Waking) and a hop down; Prowl after the nearest snake; tired, plod Home, Climb back up. A Freeze
    /// Puff turns a prowling lion to Stone where it stands for a while (predators.ts LION).
    /// </summary>
    public static class Lion
    {
        public const int Statue = 0, Waking = 1, Prowl = 2, Home = 3, Stone = 4, Climb = 5;
        public const float FOOT = 2.3f, WAKE_TIME = 1.2f, HOP_TIME = 0.45f, CLIMB_TIME = 0.8f, WAKE = 9, LEASH = 20, STONE_TIME = 6, HOME_GIVE_UP = 15;
    }

    /// <summary>London's ravens: Perched on the Tower, a CAW!, a Swoop after a snake, then flying Back (predators.ts RAVEN).</summary>
    public static class Raven
    {
        public const int Perched = 0, Caw = 1, Swoop = 2, Back = 3;
        public const float CAW_TIME = 0.7f, LEASH = 34;
    }

    public static class Predators
    {
        public static readonly PredatorSpec[] SPECS =
        {
            new PredatorSpec { radius = 0.9f, roamSpeed = 0.9f, chaseSpeed = 2.1f, sight = 16, biteReach = 1.5f, biteShare = 0.18f, biteCap = 22, biteEvery = 2.6f, chaseTime = 0, restTime = 0, howls = false },
            new PredatorSpec { radius = 0.5f, roamSpeed = 1.7f, chaseSpeed = 5.6f, sight = 13, biteReach = 0.9f, biteShare = 0.1f, biteCap = 12, biteEvery = 1.4f, chaseTime = 4, restTime = 5, howls = true },
            // London. A lion is the bear reborn: it prowls for chaseTime, then sleeps restTime on its plinth; roamSpeed is its plod home.
            new PredatorSpec { radius = 0.9f, roamSpeed = 1.7f, chaseSpeed = 2.3f, sight = 14, biteReach = 1.5f, biteShare = 0.16f, biteCap = 18, biteEvery = 2.6f, chaseTime = 9, restTime = 8, howls = false },
            // A raven is the wolf: a swoop of chaseTime, then restTime on the Tower.
            new PredatorSpec { radius = 0.45f, roamSpeed = 4, chaseSpeed = 5.2f, sight = 18, biteReach = 0.9f, biteShare = 0.06f, biteCap = 6, biteEvery = 1.4f, chaseTime = 4, restTime = 6, howls = true },
        };

        /// <summary>A lion asleep on plinth (hx, hz) facing out from `centre`, its hop-down spot FOOT further out; or a raven at its perch. No RNG.</summary>
        static Predator Homed(PredatorKind kind, float hx, float hz, float cx, float cz)
        {
            float out_ = (float)Math.Atan2(hz - cz, hx - cx);
            return new Predator
            {
                kind = kind, x = hx, z = hz, hx = hx, hz = hz, heading = out_,
                wx = hx + (float)Math.Cos(out_) * Lion.FOOT, wz = hz + (float)Math.Sin(out_) * Lion.FOOT,
            };
        }

        public static List<Predator> Make(Stage stage, Rng rng)
        {
            var list = new List<Predator>();
            foreach (var (kind, count) in stage.Predators)
            {
                // London's beasts have homes, not spawn spots: a plinth each, a perch each.
                if (kind == PredatorKind.Lion || kind == PredatorKind.Raven)
                {
                    var homes = (kind == PredatorKind.Lion ? stage.Plinths : stage.Perches) ?? new float[0];
                    int n = Math.Min(count, homes.Length / 2);
                    float cx = 0, cz = 0;
                    for (int i = 0; i < n; i++) { cx += homes[i * 2] / n; cz += homes[i * 2 + 1] / n; }
                    for (int i = 0; i < n; i++)
                    {
                        float hx = homes[i * 2], hz = homes[i * 2 + 1];
                        list.Add(kind == PredatorKind.Lion ? Homed(kind, hx, hz, cx, cz) : Homed(kind, hx, hz, hx, hz - 1));
                    }
                    continue;
                }
                var spec = SPECS[(int)kind];
                for (int i = 0; i < count; i++)
                {
                    float px = stage.FallbackX, pz = stage.FallbackZ;
                    var B = stage.Bounds;
                    for (int tries = 0; tries < 200; tries++)
                    {
                        float x = rng.Range(B.minX, B.maxX), z = rng.Range(B.minZ, B.maxZ);
                        if (!Collide.IsFree(stage, x, z, spec.radius + 1)) continue;
                        if (Collide.Hypot(x - stage.SpawnX, z - stage.SpawnZ) < 22) continue;
                        px = x; pz = z;
                        break;
                    }
                    list.Add(new Predator { kind = kind, x = px, z = pz, heading = rng.Range(0, Collide.PI * 2), restFor = rng.Range(0, 2), wx = px, wz = pz });
                }
            }
            return list;
        }
    }

    // ------------------------------------------------------------------ kids (port of kids.ts)

    public enum KidKind { Naughty, Nice, Runner, Tourist, Trip, Busker }
    public enum ProjectileKind { Pebble, Kiss, Chip }

    public sealed class Kid
    {
        public KidKind kind;
        public float x, z, heading, speed, throwIn, pauseFor, tx, tz, wanderIn, travel;
        /// <summary>Which child this is (their look), fixed for the run.</summary>
        public int look;
        /// <summary>London: a tourist's home sight (it ambles round it); for the trip, the distance walked along its path.</summary>
        public float hx, hz, along;
    }

    public sealed class Projectile
    {
        public ProjectileKind kind;
        public float x, z, dx, dz, speed, left, total;
    }

    public static class Kids
    {
        public const float RADIUS = 0.34f;
        // roam, reach, throwEvery (naughty, nice, runner, tourist, trip, busker)
        public static readonly float[] ROAM = { 2.4f, 2.1f, 3.2f, 1.1f, 1.2f, 0 };
        public static readonly float[] REACH = { 13, 12, 0, 8, 10, 0 };
        public static readonly float[] THROW_EVERY = { 5, 7, 0, 9, 6, 0 };
        /// <summary>London's school trip: how far apart the children walk on the rope.</summary>
        public const float TRIP_GAP = 0.9f;
        /// <summary>Who on the trip throws what, by place in the line (0 is the teacher, who never does). -1: nothing.</summary>
        public static readonly int[] TRIP_THROWS = { -1, -1, (int)ProjectileKind.Chip, -1, (int)ProjectileKind.Kiss, -1, (int)ProjectileKind.Chip, -1, (int)ProjectileKind.Kiss };

        /// <summary>A closed path's total length (x, z pairs).</summary>
        public static float LoopLength(float[] path)
        {
            float len = 0;
            int n = path.Length / 2;
            for (int i = 0; i < n; i++)
            {
                int j = (i + 1) % n;
                len += Collide.Hypot(path[j * 2] - path[i * 2], path[j * 2 + 1] - path[i * 2 + 1]);
            }
            return len;
        }

        /// <summary>The point `d` metres along a closed path (wrapping), and the way it runs there.</summary>
        public static void AlongLoop(float[] path, float total, float d, out float x, out float z, out float heading)
        {
            float left = ((d % total) + total) % total;
            int n = path.Length / 2;
            x = z = heading = 0;
            for (int i = 0; i < n; i++)
            {
                int j = (i + 1) % n;
                float ax = path[i * 2], az = path[i * 2 + 1], bx = path[j * 2], bz = path[j * 2 + 1];
                float len = Collide.Hypot(bx - ax, bz - az);
                if (left <= len || i == n - 1)
                {
                    float t = len > 0 ? Math.Min(1, left / len) : 0;
                    x = ax + (bx - ax) * t; z = az + (bz - az) * t;
                    heading = (float)Math.Atan2(bz - az, bx - ax);
                    return;
                }
                left -= len;
            }
        }

        public static List<Kid> Make(Stage stage, Rng rng)
        {
            var list = new List<Kid>();
            int n = 0, tourist = 0, busker = 0, trip = 0;
            foreach (var kind in stage.Kids)
            {
                if (kind == KidKind.Tourist || kind == KidKind.Busker || kind == KidKind.Trip)
                {
                    // London's people stand at fixed spots (in stage order): no RNG.
                    var k = new Kid { kind = kind, look = n++ };
                    if (kind == KidKind.Trip)
                    {
                        var path = stage.TripPath ?? new float[0];
                        float total = LoopLength(path);
                        k.along = (total - trip * TRIP_GAP + total) % total;
                        AlongLoop(path, total, k.along, out k.x, out k.z, out k.heading);
                        k.throwIn = 2 + trip * 0.7f; // staggered, so the line does not all let fly at once
                        trip++;
                    }
                    else
                    {
                        var spots = kind == KidKind.Tourist ? stage.TouristSpots : stage.BuskerSpots;
                        int idx = kind == KidKind.Tourist ? tourist++ : busker++;
                        float ax = stage.FallbackX, az = stage.FallbackZ;
                        if (spots != null && spots.Length >= 2) { int m = idx % (spots.Length / 2); ax = spots[m * 2]; az = spots[m * 2 + 1]; }
                        k.x = k.tx = k.hx = ax;
                        k.z = k.tz = k.hz = az;
                        k.heading = Collide.PI / 2; // facing the camera
                        k.throwIn = 2 + (tourist + busker) * 1.3f;
                    }
                    list.Add(k);
                    continue;
                }
                float px = stage.FallbackX, pz = stage.FallbackZ;
                for (int tries = 0; tries < 120; tries++)
                {
                    stage.HomePoint(rng, Home.Meadow, out float x, out float z);
                    if (!Collide.IsFree(stage, x, z, RADIUS + 0.6f)) continue;
                    if (Collide.Hypot(x - stage.SpawnX, z - stage.SpawnZ) < 10) continue;
                    px = x; pz = z;
                    break;
                }
                float every = THROW_EVERY[(int)kind];
                list.Add(new Kid { kind = kind, x = px, z = pz, heading = rng.Range(0, Collide.PI * 2), throwIn = rng.Range(1, every > 0 ? every : 1), tx = px, tz = pz, hx = px, hz = pz, look = n++ });
            }
            return list;
        }
    }

    // ------------------------------------------------------------------ fantastic creatures (port of creatures.ts)

    public enum CreatureKind
    {
        Stag, Unicorn, Owl, Frog, Kitsune, Pixie, Squirrel, Wisp,
        // London's legends (A5), appended so the Common's indices stay put. The unicorn is reused.
        Dragon, LionRoyal, Phoenix, Mermaid, Ghost, Gog, Fairy, Pearly,
    }

    public struct CreatureSpec
    {
        public float weight, flee, alert, radius;
        public uint glow;
        public CreatureSpec(float weight, float flee, float alert, float radius, uint glow) { this.weight = weight; this.flee = flee; this.alert = alert; this.radius = radius; this.glow = glow; }
    }

    public sealed class Creature
    {
        public CreatureKind kind;
        public float x, z, heading, speed, respawnIn, wx, wz, wanderIn;
        public CreatureSpec Spec => Creatures.SPECS[(int)kind];
    }

    public static class Creatures
    {
        public static readonly CreatureSpec[] SPECS =
        {
            new CreatureSpec(0.4f, 6.5f, 16, 0.78f, 0xffffff), // stag
            new CreatureSpec(0.8f, 6.0f, 14, 0.72f, 0xff4fd8), // unicorn
            new CreatureSpec(1.2f, 4.5f, 12, 0.52f, 0x3f6bff), // owl
            new CreatureSpec(1.2f, 4.0f, 10, 0.46f, 0xb8ff3a), // frog
            new CreatureSpec(1.2f, 6.2f, 13, 0.58f, 0xff5a1f), // kitsune
            new CreatureSpec(1.8f, 5.0f, 12, 0.4f, 0x3ff0ff),  // pixie
            new CreatureSpec(1.8f, 5.5f, 11, 0.46f, 0xffc21a), // golden squirrel
            new CreatureSpec(1.6f, 3.5f, 9, 0.4f, 0x9b4dff),   // wisp
            // London: the Silver Dragon of the City is the mythic one, the fairy merely uncommon.
            new CreatureSpec(0.4f, 6.5f, 16, 0.8f, 0xc8d4e8),  // dragon
            new CreatureSpec(1.0f, 6.0f, 14, 0.7f, 0xffc21a),  // royal lion
            new CreatureSpec(1.0f, 6.0f, 13, 0.6f, 0xff5a1f),  // phoenix
            new CreatureSpec(1.0f, 5.0f, 12, 0.6f, 0x1fd8c8),  // mermaid
            new CreatureSpec(1.0f, 4.5f, 11, 0.55f, 0xd8e4ff), // ghost
            new CreatureSpec(1.0f, 4.0f, 12, 0.75f, 0x9b6b3a), // Gog & Magog
            new CreatureSpec(1.8f, 5.0f, 12, 0.4f, 0x6bff9b),  // fairy
            new CreatureSpec(1.4f, 3.5f, 9, 0.45f, 0xfff4e0),  // the Pearly Lights
        };

        /// <summary>The Common's roster, in draw order (creatures.ts CREATURE_KINDS before London's were appended).</summary>
        public static readonly CreatureKind[] COMMON =
        { CreatureKind.Stag, CreatureKind.Unicorn, CreatureKind.Owl, CreatureKind.Frog, CreatureKind.Kitsune, CreatureKind.Pixie, CreatureKind.Squirrel, CreatureKind.Wisp };

        /// <summary>A spot for a creature to haunt, clear of the player's start: the stage's own home per kind (London), or the Glade and the woods.</summary>
        public static void Spot(Stage stage, Rng rng, CreatureKind kind, out float px, out float pz)
        {
            for (int tries = 0; tries < 150; tries++)
            {
                float x, z;
                if (stage.HasCreatureHomes) stage.CreatureHome(rng, kind, out x, out z);
                else stage.HomePoint(rng, rng.Next() < 0.5f ? Home.Glade : Home.Woods, out x, out z);
                if (!Collide.IsFree(stage, x, z, 0.9f)) continue;
                if (Collide.Hypot(x - stage.SpawnX, z - stage.SpawnZ) < 14) continue;
                px = x; pz = z;
                return;
            }
            px = stage.FallbackX; pz = stage.FallbackZ;
        }

        public static List<Creature> Make(Stage stage, Rng rng)
        {
            var list = new List<Creature>();
            var pool = new List<CreatureKind>(stage.CreatureKinds ?? COMMON);
            for (int n = 0; n < stage.CreatureCount && pool.Count > 0; n++)
            {
                float total = 0;
                foreach (var k in pool) total += SPECS[(int)k].weight;
                float roll = rng.Next() * total;
                int pick = pool.Count - 1;
                for (int i = 0; i < pool.Count; i++)
                {
                    if (roll < SPECS[(int)pool[i]].weight) { pick = i; break; }
                    roll -= SPECS[(int)pool[i]].weight;
                }
                var kind = pool[pick];
                pool.RemoveAt(pick);
                Spot(stage, rng, kind, out float x, out float z);
                list.Add(new Creature { kind = kind, x = x, z = z, heading = rng.Range(0, Collide.PI * 2), wx = x, wz = z });
            }
            return list;
        }
    }

    // ------------------------------------------------------------------ London's Crown Jewels (port of treasures.ts)

    public sealed class Treasure
    {
        public float x, z;
        /// <summary>Which of the stage's jewel spots it lies on, and seconds until it is back (0 = lying there).</summary>
        public int spot;
        public float respawnIn;
    }

    /// <summary>A pearly button of the Pearly Lights' trail.</summary>
    public sealed class Button
    {
        public float x, z;
        public int born, owner;
    }

    public static class Treasures
    {
        /// <summary>Ruby, sapphire, emerald, diamond, amethyst: one per jewel index.</summary>
        public const int KINDS = 5, FOR_CROWN = 5;
        public const float RESPAWN = 20, REACH = 0.6f;
        public const float BUTTON_LIFE = 30, BUTTON_MASS = 0.6f, BUTTON_STEP = 2.2f;
        public const int BUTTON_MAX = 30;
        public static readonly uint[] COLOURS = { 0xe0115f, 0x1f6feb, 0x2fbf71, 0xf4f8ff, 0x9b4dff };

        /// <summary>One at the Tower (spot 0), the rest drawn from the other spots without repeats.</summary>
        public static List<Treasure> Make(Stage stage, Rng rng)
        {
            var list = new List<Treasure>();
            var spots = stage.JewelSpots;
            if (spots == null || spots.Length == 0) return list;
            var pool = new List<int>();
            for (int i = 1; i < spots.Length / 2; i++) pool.Add(i);
            list.Add(new Treasure { x = spots[0], z = spots[1], spot = 0 });
            while (list.Count < KINDS && pool.Count > 0)
            {
                int k = rng.Int(pool.Count);
                int i = pool[k];
                pool.RemoveAt(k);
                list.Add(new Treasure { x = spots[i * 2], z = spots[i * 2 + 1], spot = i });
            }
            return list;
        }

        /// <summary>Move a taken jewel to another spot nobody else is using (and not where it just was).</summary>
        public static void Move(Treasure t, List<Treasure> all, float[] spots, Rng rng)
        {
            var free = new List<int>();
            for (int i = 0; i < spots.Length / 2; i++)
            {
                if (i == t.spot) continue;
                bool used = false;
                foreach (var o in all) if (o != t && o.spot == i) { used = true; break; }
                if (!used) free.Add(i);
            }
            if (free.Count == 0) return;
            t.spot = free[rng.Int(free.Count)];
            t.x = spots[t.spot * 2]; t.z = spots[t.spot * 2 + 1];
        }
    }
}
