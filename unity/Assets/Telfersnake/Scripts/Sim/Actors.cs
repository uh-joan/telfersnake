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

        public Personality Easy() => new Personality(look.name, look.body, look.stripe, look.head, 0, Math.Min(speedMul, 0.8f), growthMul * 0.7f, caution * 0.5f, 0, 0, true, Math.Max(40, (float)Math.Round(massCap * 0.5f)));
    }

    public enum Mode { Easy, Normal }

    public static class Rivals
    {
        public static readonly Personality[] SOLO =
        {
            new Personality("Noodle", 0xf6d365, 0xfff3b0, 0xf9dc7c, 0, 0.92f, 0.7f, 0.95f, 0, 0.1f, true, 120),
            new Personality("Sir Hiss-a-lot", 0x9b5de5, 0xf15bb5, 0xa873ea, 8, 0.9f, 0.75f, 0.8f, 0.15f, 0.3f, false, 260),
            new Personality("Danger Noodle", 0xe63946, 0x2b2d42, 0xea5560, 5, 0.95f, 0.65f, 0.55f, 0.5f, 0.8f, false, 180),
            new Personality("Spaghetti", 0xf4a261, 0xe76f51, 0xf6b07a, 110, 0.62f, 0.4f, 0.5f, 0, 0, false, 220),
            new Personality("Slinky", 0x2ec4b6, 0xcbf3f0, 0x4fd1c5, 3, 0.9f, 0.7f, 0.75f, 0.3f, 0.4f, false, 200),
        };
    }

    /// <summary>Rival snakes: same Snake, same input as the player. Beatable by a seven-year-old. Port of bot.ts.</summary>
    public sealed class Bot
    {
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
                    float r = h.r + me.Radius + 0.4f;
                    if ((h.x - px) * (h.x - px) + (h.z - pz) * (h.z - pz) < r * r) return true;
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

        static readonly string[] GENERAL =
        {
            "No running, please!", "Walking feet, thank you!", "Do move along, please.", "Single file, if you'd be so kind.",
            "Mind the flower beds, please!", "Lovely manners, everyone. Carry on.", "Has anyone seen the class snake?",
            "That is not what the hopscotch is for.", "Splendid. Absolutely splendid. Move along.",
            "Who, may I ask, let the sheep in?", "Chickens are not permitted on the hopscotch.",
            "Would the owner of the goat please come to the office.", "Mind the rocks, everyone. Thank you.",
        };
        static readonly string[] NEAR_LINES =
        {
            "No running, please! That includes slithering.", "Excuse me! Snakes must sign in at the office.",
            "Slow down, please. Thank you so much.", "I say! Walking pace, if you please.", "Move along, please. Nothing to eat here.",
        };
        static readonly string[] BIG = { "Goodness. You have grown. Still no running.", "Remarkable. Do mind the windows, please." };
        static readonly string[] BUMP = { "I beg your pardon!", "Oh! Terribly sorry. No running!", "Good heavens. Mind how you go." };

        public float x = School.COOPER_X, z = School.COOPER_Z, heading = Collide.PI / 2, speed, talking, travel;
        float tx = School.COOPER_X, tz = School.COOPER_Z, pause = 1, sayIn = 2, bumpCooldown, checkIn = 1, checkX = School.COOPER_X, checkZ = School.COOPER_Z;

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
                var lines = GENERAL;
                if (near) lines = w.Me.Tier >= 3 && w.Rng.Next() < 0.5f ? BIG : NEAR_LINES;
                Say(w, w.Rng.Pick(lines));
            }
        }

        public bool Bumped(World w)
        {
            if (bumpCooldown > 0) return false;
            bumpCooldown = 2.5f;
            sayIn = w.Rng.Range(3.5f, 6.5f);
            Say(w, w.Rng.Pick(BUMP));
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
            var hit = Collide.ResolveCircle(w.Stage, x + (float)Math.Cos(heading) * speed * dt, z + (float)Math.Sin(heading) * speed * dt, RADIUS, w.ScratchHit, w.HazardCircles);
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
            var beat = School.COOPER_BEAT;
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
            tx = School.COOPER_X; tz = School.COOPER_Z;
        }
    }
}
