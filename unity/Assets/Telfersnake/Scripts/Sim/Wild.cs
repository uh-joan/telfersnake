using System;
using System.Collections.Generic;

namespace Telfer.Sim
{
    // ------------------------------------------------------------------ predators (port of predators.ts)

    public enum PredatorKind { Bear, Wolf }

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
        public PredatorSpec Spec => Predators.SPECS[(int)kind];
    }

    public static class Predators
    {
        public static readonly PredatorSpec[] SPECS =
        {
            new PredatorSpec { radius = 0.9f, roamSpeed = 0.9f, chaseSpeed = 2.1f, sight = 16, biteReach = 1.5f, biteShare = 0.18f, biteCap = 22, biteEvery = 2.6f, chaseTime = 0, restTime = 0, howls = false },
            new PredatorSpec { radius = 0.5f, roamSpeed = 1.7f, chaseSpeed = 5.6f, sight = 13, biteReach = 0.9f, biteShare = 0.1f, biteCap = 12, biteEvery = 1.4f, chaseTime = 4, restTime = 5, howls = true },
        };

        public static List<Predator> Make(Stage stage, Rng rng)
        {
            var list = new List<Predator>();
            foreach (var (kind, count) in stage.Predators)
            {
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

    public enum KidKind { Naughty, Nice, Runner }
    public enum ProjectileKind { Pebble, Kiss }

    public sealed class Kid
    {
        public KidKind kind;
        public float x, z, heading, speed, throwIn, pauseFor, tx, tz, wanderIn, travel;
        /// <summary>Which child this is (their look), fixed for the run.</summary>
        public int look;
    }

    public sealed class Projectile
    {
        public ProjectileKind kind;
        public float x, z, dx, dz, speed, left, total;
    }

    public static class Kids
    {
        public const float RADIUS = 0.34f;
        // roam, reach, throwEvery
        public static readonly float[] ROAM = { 2.4f, 2.1f, 3.2f };
        public static readonly float[] REACH = { 13, 12, 0 };
        public static readonly float[] THROW_EVERY = { 5, 7, 0 };

        public static List<Kid> Make(Stage stage, Rng rng)
        {
            var list = new List<Kid>();
            int n = 0;
            foreach (var kind in stage.Kids)
            {
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
                list.Add(new Kid { kind = kind, x = px, z = pz, heading = rng.Range(0, Collide.PI * 2), throwIn = rng.Range(1, every > 0 ? every : 1), tx = px, tz = pz, look = n++ });
            }
            return list;
        }
    }

    // ------------------------------------------------------------------ fantastic creatures (port of creatures.ts)

    public enum CreatureKind { Stag, Unicorn, Owl, Frog, Kitsune, Pixie, Squirrel, Wisp }

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
        };

        public static void Spot(Stage stage, Rng rng, out float px, out float pz)
        {
            for (int tries = 0; tries < 150; tries++)
            {
                stage.HomePoint(rng, rng.Next() < 0.5f ? Home.Glade : Home.Woods, out float x, out float z);
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
            var pool = new List<CreatureKind>((CreatureKind[])Enum.GetValues(typeof(CreatureKind)));
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
                Spot(stage, rng, out float x, out float z);
                list.Add(new Creature { kind = kind, x = x, z = z, heading = rng.Range(0, Collide.PI * 2), wx = x, wz = z });
            }
            return list;
        }
    }
}
