using System;

namespace Telfer.Sim
{
    public sealed class Personality
    {
        public SnakeLook look;
        public float startMass, speedMul, growthMul, caution, aggression, dashy, massCap;
        public bool timid;

        public Personality(string name, uint body, uint stripe, uint head, float startMass, float speedMul, float growthMul, float caution, float aggression, float dashy, bool timid, float massCap)
        {
            look = new SnakeLook(name, body, stripe, head);
            this.startMass = startMass; this.speedMul = speedMul; this.growthMul = growthMul; this.caution = caution;
            this.aggression = aggression; this.dashy = dashy; this.timid = timid; this.massCap = massCap;
        }

        /// <summary>God mode: faster than a fresh player, greedier, cannier (modes.ts deify).</summary>
        public Personality God() => new Personality(look.name, look.body, look.stripe, look.head, startMass + 6, Math.Min(1.15f, speedMul + 0.2f), growthMul * 1.15f,
            Math.Min(1, caution + 0.15f), Math.Min(1, aggression + 0.35f), Math.Min(1, dashy + 0.4f), timid, (float)Math.Round(massCap * 1.3f));

        public Personality For(Mode m) => m == Mode.Easy ? Easy() : m == Mode.God ? God() : this;

        public Personality Easy() => new Personality(look.name, look.body, look.stripe, look.head, 0, Math.Min(speedMul, 0.8f), growthMul * 0.7f, caution * 0.5f, 0, 0, true, Math.Max(40, (float)Math.Round(massCap * 0.5f)));
    }

    public enum Mode { Easy, Normal, God }

    public static class Rivals
    {
        public static readonly Personality[] SOLO =
        {
            new Personality("Noodle", 0xf6d365, 0xfff3b0, 0xf9dc7c, 0, 0.92f, 0.7f, 0.95f, 0, 0.1f, true, 120),
            new Personality("Sir Hiss-a-lot", 0x9b5de5, 0xf15bb5, 0xa873ea, 8, 0.9f, 0.75f, 0.8f, 0.15f, 0.3f, false, 260),
            new Personality("Danger Noodle", 0xe63946, 0x2b2d42, 0xea5560, 5, 0.95f, 0.65f, 0.55f, 0.5f, 0.8f, false, 180),
            new Personality("Spaghetti", 0xf4a261, 0xe76f51, 0xf6b07a, 110, 0.62f, 0.4f, 0.5f, 0, 0, false, 220),
        };

        /// <summary>Forest-flavoured rivals a bigger stage seats on top (the Common's four).</summary>
        public static readonly Personality[] MORE =
        {
            new Personality("Twiggy", 0x8a9a5b, 0xc7d59f, 0x9aab6a, 2, 0.9f, 0.7f, 0.7f, 0.25f, 0.35f, false, 190),
            new Personality("Mossy", 0x4b7f52, 0x9fd8a0, 0x5c9063, 0, 0.88f, 0.72f, 0.9f, 0.05f, 0.2f, true, 150),
            new Personality("Copper", 0xc06a3a, 0xf0b48a, 0xcf7a4a, 6, 0.95f, 0.66f, 0.5f, 0.55f, 0.75f, false, 200),
            new Personality("Willow", 0x6a8fbf, 0xbcd3ef, 0x7a9ccf, 4, 0.9f, 0.7f, 0.75f, 0.3f, 0.4f, false, 210),
        };

        public static int FoodCount(Mode m) => m == Mode.Easy ? 55 : 42;
        public static float Ferocity(Mode m) => m == Mode.Easy ? 0.7f : m == Mode.God ? 1.3f : 1;
    }

    /// <summary>Rival snakes: same Snake, same input as the player. Beatable by a seven-year-old. Port of bot.ts.</summary>
    public sealed class Bot
    {
        const float ACROSS_WATER = 0.3f;
        const float RETHINK = 0.4f, SWERVE = 0.5f, SIGHT = 18, THREAT_RANGE = 9, HUNT_RANGE = 12, PROBE_ANGLE = 0.9f;

        public readonly Personality who;
        SnakeInput input = new SnakeInput { x = 1, active = true };
        float tx, tz;
        bool chasing;
        float rethinkIn, swerveIn, swerveX, swerveZ, swerveSide = 1, wanderIn, checkIn = 1, checkX, checkZ, dashFor;

        public Bot(Personality who) { this.who = who; }

        public SnakeInput Think(Snake me, World w, float dt)
        {
            rethinkIn -= dt; wanderIn -= dt; swerveIn -= dt; dashFor -= dt; checkIn -= dt;
            if (checkIn <= 0)
            {
                if (Collide.Hypot(me.x - checkX, me.z - checkZ) < 0.6f) Wander(w, 3);
                checkIn = 1; checkX = me.x; checkZ = me.z;
            }
            if (rethinkIn <= 0 && wanderIn <= 0) { rethinkIn = RETHINK; ChooseTarget(me, w); }

            float dx = tx - me.x, dz = tz - me.z;
            if (dx * dx + dz * dz < 1) rethinkIn = 0;

            if (swerveIn > 0) { dx = swerveX; dz = swerveZ; }
            else if (Blocked(me, w, me.heading) && w.Rng.Next() < who.caution)
            {
                if (!Blocked(me, w, me.heading - PROBE_ANGLE)) swerveSide = -1;
                else if (!Blocked(me, w, me.heading + PROBE_ANGLE)) swerveSide = 1;
                float away = me.heading + swerveSide * 1.5f;
                swerveX = dx = (float)Math.Cos(away);
                swerveZ = dz = (float)Math.Sin(away);
                swerveIn = SWERVE;
            }
            float len = Collide.Hypot(dx, dz); if (len == 0) len = 1;
            input.x = dx / len; input.z = dz / len;
            if (chasing && dashFor <= -2 && me.mass > 12 && w.Rng.Next() < who.dashy * 0.05f) dashFor = 0.8f;
            input.dash = dashFor > 0;
            return input;
        }

        void Wander(World w, float seconds)
        {
            var B = w.Stage.Bounds;
            for (int tries = 0; tries < 20; tries++)
            {
                float x = w.Rng.Range(B.minX, B.maxX), z = w.Rng.Range(B.minZ, B.maxZ);
                if (!Collide.IsFree(w.Stage, x, z, 1.5f, w.HazardCircles)) continue;
                tx = x; tz = z;
                break;
            }
            chasing = false;
            wanderIn = seconds;
        }

        void ChooseTarget(Snake me, World w)
        {
            chasing = false;
            if (who.timid)
            {
                foreach (var o in w.Snakes)
                {
                    if (o == me || !o.alive || o.mass <= me.mass) continue;
                    float d = Collide.Hypot(o.x - me.x, o.z - me.z);
                    if (d > THREAT_RANGE) continue;
                    if (d == 0) d = 1;
                    tx = me.x + (me.x - o.x) / d * 8;
                    tz = me.z + (me.z - o.z) / d * 8;
                    return;
                }
            }
            if (w.Rng.Next() < who.aggression * 0.3f)
            {
                foreach (var o in w.Snakes)
                {
                    if (o == me || !o.alive || o.immune > 0) continue;
                    if (Collide.Hypot(o.x - me.x, o.z - me.z) > HUNT_RANGE) continue;
                    float lead = 4 + o.BaseSpeed * 0.5f;
                    tx = o.x + (float)Math.Cos(o.heading) * lead;
                    tz = o.z + (float)Math.Sin(o.heading) * lead;
                    chasing = true;
                    return;
                }
            }
            float best = 0;
            void Consider(float x, float z, float value, bool chase)
            {
                float d = Collide.Hypot(x - me.x, z - me.z);
                if (d > SIGHT) return;
                float appeal = value / (d + 2);
                if (appeal <= best) return;
                // London: swimming is slow, so a bot keeps to its own bank unless the prize is worth a dash.
                if (w.Stage.Water != null && !chase && Water.Crosses(w.Stage, me.x, me.z, x, z))
                {
                    appeal *= ACROSS_WATER;
                    if (appeal <= best) return;
                }
                best = appeal; tx = x; tz = z; chasing = chase;
            }
            foreach (var f in w.Foods) Consider(f.x, f.z, Foods.VALUE[(int)f.kind] * (f.golden ? Foods.GOLDEN_MULTIPLIER : 1), f.golden);
            foreach (var p in w.Pellets) Consider(p.x, p.z, p.value, false);
            foreach (var a in w.Animals) if (me.Tier >= a.Spec.tier) Consider(a.x, a.z, a.Spec.value * 0.7f, true);
            if (best == 0) Wander(w, 2);
        }

        bool Blocked(Snake me, World w, float angle)
        {
            float look = 2 + me.BaseSpeed * 0.5f;
            for (int k = 1; k <= 3; k++)
            {
                float reach = look * k / 3;
                float px = me.x + (float)Math.Cos(angle) * reach, pz = me.z + (float)Math.Sin(angle) * reach;
                foreach (var h in w.Hazards)
                {
                    if (!h.Solid) continue; // London's puddles are for sliding through
                    float r = h.r + me.Radius + 0.4f;
                    if ((h.x - px) * (h.x - px) + (h.z - pz) * (h.z - pz) < r * r) return true;
                }
                // London's buses and cabs: a moving wall, with a margin for where it will have got to.
                foreach (var v in w.Vehicles)
                {
                    var spec = v.Spec;
                    Vehicles.Local(v.x, v.z, v.heading, px, pz, out float f, out float l);
                    float lead = v.speed * 0.8f; // it is coming this way
                    if (f > -spec.length / 2 - me.Radius - 0.8f && f < spec.length / 2 + me.Radius + 0.8f + lead && Math.Abs(l) < spec.width / 2 + me.Radius + 0.8f) return true;
                }
                foreach (var o in w.Snakes)
                {
                    if (o == me || !o.alive || o.immune > 0) continue;
                    if (Collide.Hypot(o.x - me.x, o.z - me.z) > o.Length + look + 2) continue;
                    float r = o.Radius + o.spikes + me.Radius + 0.7f;
                    for (int i = 0; i < o.bodyCount; i++)
                    {
                        float bx = o.body[i * 2] - px, bz = o.body[i * 2 + 1] - pz;
                        if (bx * bx + bz * bz < r * r) return true;
                    }
                }
            }
            return false;
        }
    }

    /// <summary>Mr Cooper, head teacher: sprints about politely asking everyone not to run. Port of cooper.ts.</summary>
    public sealed class Cooper
    {
        public const float RADIUS = 0.55f, AURA = 6;
        const float RUN_SPEED = 3.4f, TURN_RATE = 5, NEAR = 10, SEEK_SNAKE_CHANCE = 0.35f;

        public readonly WardenConfig config;
        public float x, z, heading = Collide.PI / 2, speed, talking, travel;
        float tx, tz, pause = 1, sayIn = 2, bumpCooldown, checkIn = 1, checkX, checkZ;

        public Cooper(WardenConfig c)
        {
            config = c;
            x = tx = checkX = c.spawnX;
            z = tz = checkZ = c.spawnZ;
        }

        public void Update(World w, float dt)
        {
            talking = Math.Max(0, talking - dt);
            bumpCooldown = Math.Max(0, bumpCooldown - dt);
            if (pause > 0)
            {
                pause -= dt;
                speed = 0;
                if (pause <= 0) PickTarget(w);
            }
            else Run(w, dt);

            sayIn -= dt;
            if (sayIn <= 0)
            {
                sayIn = w.Rng.Range(3.5f, 6.5f);
                bool near = Collide.Hypot(w.Me.x - x, w.Me.z - z) < NEAR;
                var lines = config.general;
                if (near) lines = w.Me.Tier >= 3 && w.Rng.Next() < 0.5f ? config.big : config.near;
                Say(w, w.Rng.Pick(lines));
            }
        }

        public bool Bumped(World w)
        {
            if (bumpCooldown > 0) return false;
            bumpCooldown = 2.5f;
            sayIn = w.Rng.Range(3.5f, 6.5f);
            Say(w, w.Rng.Pick(config.bump));
            return true;
        }

        void Say(World w, string text)
        {
            talking = 2.6f;
            w.Events.Add(new GameEvent { type = EventType.Say, text = text, x = x, z = z });
        }

        void Run(World w, float dt)
        {
            float dx = tx - x, dz = tz - z;
            if (dx * dx + dz * dz < 0.64f) { pause = w.Rng.Range(0.6f, 1.8f); return; }
            heading = Collide.TurnToward(heading, (float)Math.Atan2(dz, dx), TURN_RATE * dt);
            speed = RUN_SPEED;
            var hit = Collide.ResolveAshore(w.Stage, x, z, x + (float)Math.Cos(heading) * speed * dt, z + (float)Math.Sin(heading) * speed * dt, RADIUS, w.ScratchHit, w.HazardCircles);
            travel += Collide.Hypot(hit.x - x, hit.z - z);
            x = hit.x; z = hit.z;
            if (hit.hit) heading = Collide.SlideAlong(heading, hit.nx, hit.nz);
            checkIn -= dt;
            if (checkIn <= 0)
            {
                if (Collide.Hypot(x - checkX, z - checkZ) < 1) PickTarget(w);
                checkIn = 1; checkX = x; checkZ = z;
            }
        }

        void PickTarget(World w)
        {
            var beat = config.beat;
            if (w.Rng.Next() < SEEK_SNAKE_CHANCE)
            {
                float px = Math.Min(Math.Max(w.Me.x + w.Rng.Range(-3, 3), beat.minX), beat.maxX);
                float pz = Math.Min(Math.Max(w.Me.z + w.Rng.Range(-3, 3), beat.minZ), beat.maxZ);
                if (Collide.IsFree(w.Stage, px, pz, 1, w.HazardCircles)) { tx = px; tz = pz; return; }
            }
            for (int tries = 0; tries < 30; tries++)
            {
                float px = w.Rng.Range(beat.minX, beat.maxX), pz = w.Rng.Range(beat.minZ, beat.maxZ);
                if (!Collide.IsFree(w.Stage, px, pz, 1, w.HazardCircles)) continue;
                tx = px; tz = pz;
                return;
            }
            tx = config.spawnX; tz = config.spawnZ;
        }
    }
}
