using System;
using System.Collections.Generic;

namespace Telfer.Sim
{
    public enum EventType { Eat, Gulp, Boop, Ouch, Rock, Pellet, Tier, Cards, Bonk, Helmet, Respawn, Breath, Sneeze, Say, BumpWall, BumpCooper }

    public sealed class GameEvent
    {
        public EventType type;
        public int who = -1, by = -1;
        public float x, z, points, lost, heading, range;
        public bool golden, toasted, broke;
        public FoodKind food;
        public AnimalKind animal;
        public HazardKind hazard;
        public int tier;
        public string text;
    }

    /// <summary>
    /// The whole game state, advanced in fixed 1/60 s steps from inputs alone (port of world.ts, school
    /// stage, solo play). No rendering, no Unity: the views read it and drain its events.
    /// </summary>
    public sealed class World
    {
        public const float STEP = 1f / 60f;
        const float SLOW_FACTOR = 0.6f, BUMP_QUIET = 0.4f, GULP_REACH = 0.75f, RESPAWN_CLEARANCE = 15;
        const float BOOP_SLOWDOWN = 0.35f, BOOP_COOLDOWN = 1.2f, GOAT_COOLDOWN = 3;
        const float OUCH_SHARE = 0.12f, OUCH_MAX = 15, OUCH_GRACE = 1.5f, PELLET_RETURN = 0.7f;
        const int PELLET_MAX = 5, PELLET_CAP = 150;
        const float BODY_HIT = 0.85f; const int BONK_PELLETS = 14; const float BONK_RETURN = 0.6f, BONK_REWARD = 8;
        const float RESPAWN_AFTER = 3, RESPAWN_GRACE = 3, HELMET_GRACE = 1.5f, SNAKE_CLEARANCE = 12;
        const int DROP_HEADINGS = 8;
        const float MAGNET_PULL = 7, BEE_ORBIT = 2.4f, BEE_REACH = 0.9f, BEE_SPIN = 2.2f;
        const float BREATH_HALF_ANGLE = 0.5f, BREATH_RECHECK = 0.25f, DAZE = 1.8f, BREATH_SHARE = 0.14f;

        public static readonly SnakeLook PLAYER_LOOK = new SnakeLook("You", 0x4cbb4a, 0xf2d94a, 0x57c955);

        public int Tick;
        public readonly Rng Rng;
        public readonly School Stage = School.Stage;
        public readonly List<Snake> Snakes = new List<Snake>();
        public readonly List<Food> Foods = new List<Food>();
        public readonly List<Animal> Animals = new List<Animal>();
        public readonly List<Hazard> Hazards;
        public readonly List<Pellet> Pellets = new List<Pellet>();
        public readonly List<GameEvent> Events = new List<GameEvent>();
        public readonly Cooper Cooper = new Cooper();
        public readonly Hit ScratchHit = new Hit();
        public readonly Mode Mode;

        /// <summary>Rocks as circles, refreshed when one breaks and moves: what snakes and animals bounce off.</summary>
        public readonly List<Circle> HazardCircles = new List<Circle>();
        readonly Dictionary<Snake, Bot> bots = new Dictionary<Snake, Bot>();
        SnakeInput playerInput;

        public Snake Me => Snakes[0];

        public World(uint seed, Mode mode, SnakeLook look = null)
        {
            Rng = new Rng(seed);
            Mode = mode;
            Hazards = Sim.Hazards.Make(Rng, Stage);
            RefreshHazardCircles();

            var player = new Snake(0, look ?? PLAYER_LOOK, false);
            player.PlaceAt(School.SPAWN_X, School.SPAWN_Z, School.SPAWN_HEADING);
            Snakes.Add(player);

            foreach (var p0 in Rivals.SOLO)
            {
                var who = mode == Mode.Easy ? p0.Easy() : p0;
                var s = new Snake(Snakes.Count, who.look, true);
                Snakes.Add(s);
                SeatBot(s, who);
                DropIn(s);
            }
            foreach (var s in Snakes) s.immune = RESPAWN_GRACE;

            int foodCount = mode == Mode.Easy ? 55 : 42;
            for (int i = 0; i < foodCount; i++)
            {
                var f = new Food { born = -999 };
                Sim.Foods.Place(f, Rng, Stage, -999, player.x, player.z, 2, HazardCircles);
                Foods.Add(f);
            }
            for (int k = 0; k < Sim.Animals.SPECS.Length; k++)
            {
                for (int i = 0; i < Sim.Animals.SPECS[k].count; i++)
                {
                    var a = new Animal { kind = (AnimalKind)k };
                    Sim.Animals.Place(a, this, 6);
                    a.born = -999;
                    Animals.Add(a);
                }
            }
        }

        void RefreshHazardCircles()
        {
            HazardCircles.Clear();
            foreach (var h in Hazards) HazardCircles.Add(h.AsCircle);
        }

        void SeatBot(Snake s, Personality who)
        {
            s.Reset();
            s.look = who.look;
            s.isBot = true;
            s.mass = who.startMass;
            s.baseSpeedMul = s.speedMul = who.speedMul;
            s.baseGrowthMul = s.growthMul = who.growthMul;
            s.massCap = who.massCap;
            bots[s] = new Bot(who);
        }

        public bool ClearOfSnakes(float x, float z, float clear)
        {
            foreach (var s in Snakes)
                if (s.alive && (s.x - x) * (s.x - x) + (s.z - z) * (s.z - z) < clear * clear) return false;
            return true;
        }

        public void Choose(int index)
        {
            var s = Me;
            if (s.cards == null) return;
            int i = Math.Min(Math.Max(index, 0), s.cards.Length - 1);
            s.TakeCard(s.cards[i]);
            s.cards = null;
        }

        public static void BeePosition(int tick, Snake s, int i, out float x, out float z)
        {
            float a = tick * STEP * BEE_SPIN + i * Collide.PI * 2 / Math.Max(1, s.bees);
            float r = BEE_ORBIT + s.Radius;
            x = s.x + (float)Math.Cos(a) * r;
            z = s.z + (float)Math.Sin(a) * r;
        }

        /// <summary>Advance one tick. The caller stops stepping while Me.cards is set (solo pauses for a level-up).</summary>
        public void Step(SnakeInput input)
        {
            playerInput = input;
            const float dt = STEP;
            Cooper.Update(this, dt);
            foreach (var a in Animals) Sim.Animals.Update(a, this, dt);

            foreach (var s in Snakes)
            {
                if (!s.alive)
                {
                    s.respawnIn -= dt;
                    if (s.respawnIn <= 0) Respawn(s);
                    continue;
                }
                bots.TryGetValue(s, out var bot);
                var inp = bot != null ? bot.Think(s, this, dt) : playerInput;

                s.slowed = Collide.Hypot(s.x - Cooper.x, s.z - Cooper.z) < Cooper.AURA;
                s.speedFactor += ((s.slowed ? SLOW_FACTOR : 1) - s.speedFactor) * Math.Min(1, dt * 4);
                s.Update(inp, dt, !s.slowed, Stage, HazardCircles);

                bool ouch = BonkRock(s);
                if (s.touchingWall && !s.wasTouchingWall && !ouch && s.bumpQuiet <= 0 && s.immune <= 0)
                {
                    s.bumpQuiet = BUMP_QUIET;
                    Events.Add(new GameEvent { type = EventType.BumpWall, who = s.id, x = s.x, z = s.z });
                }

                BumpCooper(s, dt);
                MeetAnimals(s, dt);
                PullFood(s, dt);
                Eat(s);
                Bees(s);
                Breathe(s, dt);

                if (s.Tier > s.highestTier)
                {
                    s.highestTier = s.Tier;
                    Events.Add(new GameEvent { type = EventType.Tier, who = s.id, tier = s.Tier, x = s.x, z = s.z });
                }
                if (bot != null) s.pendingCards = 0;
                else if (s.pendingCards > 0 && s.cards == null)
                {
                    s.cards = Upgrades.Roll(Rng, s);
                    Events.Add(new GameEvent { type = EventType.Cards, who = s.id });
                }
            }

            foreach (var s in Snakes) if (s.alive) s.SampleBody();
            BonkSnakes();
            for (int i = Pellets.Count - 1; i >= 0; i--)
                if (Tick - Pellets[i].born > Sim.Hazards.PELLET_LIFE_TICKS) Pellets.RemoveAt(i);
            Tick++;
        }

        // ---------------------------------------------------------------- meeting things

        void Shove(Snake s, float cx, float cz, float reach, float dt)
        {
            float dx = s.x - cx, dz = s.z - cz, d = Collide.Hypot(dx, dz);
            float nx = d > 1e-5f ? dx / d : 1, nz = d > 1e-5f ? dz / d : 0;
            Collide.ResolveCircle(Stage, cx + nx * reach, cz + nz * reach, s.Radius, ScratchHit, HazardCircles);
            s.x = ScratchHit.x; s.z = ScratchHit.z;
            s.Deflect(nx, nz, dt);
        }

        bool BonkRock(Snake s)
        {
            if (!s.touchingWall || s.immune > 0) return false;
            foreach (var h in Hazards)
            {
                float reach = s.Radius + h.r + 0.02f;
                if ((s.x - h.x) * (s.x - h.x) + (s.z - h.z) * (s.z - h.z) > reach * reach) continue;
                s.immune = OUCH_GRACE;
                float full = s.mass < 1 ? 0 : Math.Min(OUCH_MAX, Math.Max(1, s.mass * OUCH_SHARE));
                float lost = full * (1 - s.rockGuard);
                if (lost > 0) Shed(s, lost, PELLET_RETURN, Math.Min(PELLET_MAX, Math.Max(1, (int)Math.Round(lost))));
                bool broke = ++h.hits >= h.limit;
                h.lastHitTick = Tick;
                Events.Add(new GameEvent { type = EventType.Ouch, who = s.id, hazard = h.kind, x = h.x, z = h.z, lost = lost, broke = broke });
                if (broke)
                {
                    float ox = h.x, oz = h.z;
                    var others = new List<Circle>();
                    foreach (var o in Hazards) if (o != h) others.Add(o.AsCircle);
                    Sim.Hazards.Place(h, Rng, Stage, others, (x, z) => !ClearOfSnakes(x, z, 9));
                    RefreshHazardCircles();
                    Events.Add(new GameEvent { type = EventType.Rock, x = ox, z = oz, hazard = h.kind });
                }
                return true;
            }
            return false;
        }

        void Shed(Snake s, float lost, float share, int n)
        {
            float tail = s.Length, spread = Math.Min(0.7f, tail / n);
            for (int i = 0; i < n; i++)
            {
                s.SampleAt(Math.Max(0, tail - 0.3f - i * spread), out float px, out float pz);
                Pellets.Add(new Pellet { x = px, z = pz, value = lost * share / n, born = Tick, color = s.look.body });
            }
            if (Pellets.Count > PELLET_CAP) Pellets.RemoveRange(0, Pellets.Count - PELLET_CAP);
            s.mass = Math.Max(0, s.mass - lost);
        }

        void BumpCooper(Snake s, float dt)
        {
            float reach = s.Radius + Cooper.RADIUS;
            if ((s.x - Cooper.x) * (s.x - Cooper.x) + (s.z - Cooper.z) * (s.z - Cooper.z) >= reach * reach) return;
            Shove(s, Cooper.x, Cooper.z, reach, dt);
            if (Cooper.Bumped(this)) Events.Add(new GameEvent { type = EventType.BumpCooper, who = s.id, x = s.x, z = s.z });
        }

        void MeetAnimals(Snake s, float dt)
        {
            foreach (var a in Animals)
            {
                var spec = a.Spec;
                float d2 = (a.x - s.x) * (a.x - s.x) + (a.z - s.z) * (a.z - s.z);
                if (s.Tier >= spec.tier)
                {
                    float reach = s.BiteReach * GULP_REACH + spec.radius;
                    if (d2 > reach * reach) continue;
                    float points = s.Gain(spec.value);
                    Events.Add(new GameEvent { type = EventType.Gulp, who = s.id, animal = a.kind, x = a.x, z = a.z, points = points });
                    Sim.Animals.Place(a, this, RESPAWN_CLEARANCE);
                    continue;
                }
                float r2 = s.Radius + spec.radius;
                if (d2 >= r2 * r2) continue;
                Shove(s, a.x, a.z, r2, dt);
                if (a.boopCooldown > 0) continue;
                a.boopCooldown = a.kind == AnimalKind.Goat ? GOAT_COOLDOWN : BOOP_COOLDOWN;
                s.speedFactor = Math.Min(s.speedFactor, BOOP_SLOWDOWN);
                Events.Add(new GameEvent { type = EventType.Boop, who = s.id, animal = a.kind, x = a.x, z = a.z });
            }
        }

        void SwallowFood(Snake s, Food f, bool toasted)
        {
            float value = Sim.Foods.VALUE[(int)f.kind] * (f.golden ? Sim.Foods.GOLDEN_MULTIPLIER : 1) * (toasted ? 2 : 1);
            float points = s.Gain(value);
            Events.Add(new GameEvent { type = EventType.Eat, who = s.id, food = f.kind, x = f.x, z = f.z, points = points, golden = f.golden, toasted = toasted });
            Sim.Foods.Place(f, Rng, Stage, Tick, s.x, s.z, 8, HazardCircles, s.luck);
        }

        void SwallowPellet(Snake s, int index)
        {
            var p = Pellets[index];
            float points = s.Gain(p.value, 5);
            Events.Add(new GameEvent { type = EventType.Pellet, who = s.id, x = p.x, z = p.z, points = points });
            Pellets.RemoveAt(index);
        }

        void Eat(Snake s)
        {
            float reach2 = s.BiteReach * s.BiteReach;
            foreach (var f in Foods)
                if ((f.x - s.x) * (f.x - s.x) + (f.z - s.z) * (f.z - s.z) <= reach2) SwallowFood(s, f, false);
            for (int i = Pellets.Count - 1; i >= 0; i--)
            {
                var p = Pellets[i];
                if ((p.x - s.x) * (p.x - s.x) + (p.z - s.z) * (p.z - s.z) <= reach2) SwallowPellet(s, i);
            }
        }

        void PullFood(Snake s, float dt)
        {
            float reach = s.magnet;
            if (reach <= 0) return;
            float r2 = reach * reach;
            void Pull(ref float ox, ref float oz)
            {
                float dx = s.x - ox, dz = s.z - oz, d2 = dx * dx + dz * dz;
                if (d2 > r2 || d2 < 1e-6f) return;
                float d = (float)Math.Sqrt(d2), move = Math.Min(d, MAGNET_PULL * dt);
                float nx = ox + dx / d * move, nz = oz + dz / d * move;
                if (!Collide.IsFree(Stage, nx, nz, 0.25f, HazardCircles)) return;
                ox = nx; oz = nz;
            }
            foreach (var f in Foods) Pull(ref f.x, ref f.z);
            foreach (var p in Pellets) Pull(ref p.x, ref p.z);
        }

        void Bees(Snake s)
        {
            for (int i = 0; i < s.bees; i++)
            {
                BeePosition(Tick, s, i, out float bx, out float bz);
                foreach (var f in Foods)
                    if ((f.x - bx) * (f.x - bx) + (f.z - bz) * (f.z - bz) <= BEE_REACH * BEE_REACH) SwallowFood(s, f, false);
                for (int k = Pellets.Count - 1; k >= 0; k--)
                {
                    var p = Pellets[k];
                    if ((p.x - bx) * (p.x - bx) + (p.z - bz) * (p.z - bz) <= BEE_REACH * BEE_REACH) SwallowPellet(s, k);
                }
            }
        }

        bool InBreath(Snake s, float x, float z, float range)
        {
            float dx = x - s.x, dz = z - s.z;
            if (dx * dx + dz * dz > range * range) return false;
            return Math.Abs(Collide.WrapAngle((float)Math.Atan2(dz, dx) - s.heading)) < BREATH_HALF_ANGLE;
        }

        void Breathe(Snake s, float dt)
        {
            if (s.breathLevel <= 0) return;
            s.breathIn -= dt;
            if (s.breathIn > 0) return;
            float range = 4 + s.breathLevel;
            bool worth = false;
            foreach (var f in Foods) if (InBreath(s, f.x, f.z, range)) { worth = true; break; }
            if (!worth) foreach (var o in Snakes) if (o != s && o.alive && o.immune <= 0 && InBreath(s, o.x, o.z, range)) { worth = true; break; }
            if (!worth) foreach (var a in Animals) if (s.Tier >= a.Spec.tier && InBreath(s, a.x, a.z, range)) { worth = true; break; }
            if (!worth) { s.breathIn = BREATH_RECHECK; return; }

            s.breathIn = 4.2f - 0.4f * s.breathLevel;
            Events.Add(new GameEvent { type = EventType.Breath, who = s.id, x = s.x, z = s.z, heading = s.heading, range = range });
            foreach (var f in Foods) if (InBreath(s, f.x, f.z, range)) SwallowFood(s, f, true);
            foreach (var a in Animals) if (s.Tier >= a.Spec.tier && InBreath(s, a.x, a.z, range)) a.dazed = DAZE;
            foreach (var o in Snakes)
            {
                if (o == s || !o.alive || o.immune > 0 || !InBreath(s, o.x, o.z, range)) continue;
                o.immune = OUCH_GRACE;
                float lost = o.mass < 1 ? 0 : Math.Min(OUCH_MAX, Math.Max(2, o.mass * BREATH_SHARE));
                if (lost > 0) Shed(o, lost, PELLET_RETURN, 4);
                Events.Add(new GameEvent { type = EventType.Sneeze, who = o.id, by = s.id, x = o.x, z = o.z });
            }
        }

        // ---------------------------------------------------------------- snake on snake

        void BonkSnakes()
        {
            foreach (var a in Snakes)
            {
                if (!a.alive || a.immune > 0 || School.SAIL.Contains(a.x, a.z)) continue;
                foreach (var b in Snakes)
                {
                    if (b == a || !b.alive || b.immune > 0) continue;
                    float gap = Collide.Hypot(a.x - b.x, a.z - b.z);
                    if (gap > b.Length + 3) continue;
                    float hitX = 0, hitZ = 0;
                    bool struck = false;
                    if (gap < a.Radius + b.Radius && (a.mass < b.mass || (a.mass == b.mass && a.id > b.id)))
                    {
                        struck = true; hitX = b.x; hitZ = b.z;
                    }
                    bool noseToNose = gap < a.Radius + b.Radius;
                    float reach = a.Radius + b.Radius * BODY_HIT + b.spikes;
                    for (int i = 0; i < b.bodyCount && !struck && !noseToNose; i++)
                    {
                        float dx = a.x - b.body[i * 2], dz = a.z - b.body[i * 2 + 1];
                        if (dx * dx + dz * dz >= reach * reach) continue;
                        struck = true; hitX = b.body[i * 2]; hitZ = b.body[i * 2 + 1];
                    }
                    if (!struck) continue;

                    if (a.helmetReady)
                    {
                        a.helmetReady = false;
                        a.helmetIn = a.helmetRecharge;
                        a.immune = HELMET_GRACE;
                        a.heading = (float)Math.Atan2(a.z - hitZ, a.x - hitX);
                        Collide.ResolveCircle(Stage, a.x + (float)Math.Cos(a.heading) * 0.6f, a.z + (float)Math.Sin(a.heading) * 0.6f, a.Radius, ScratchHit, HazardCircles);
                        a.x = ScratchHit.x; a.z = ScratchHit.z;
                        Events.Add(new GameEvent { type = EventType.Helmet, who = a.id, x = a.x, z = a.z });
                    }
                    else Bonk(a, b);
                    break;
                }
            }
        }

        void Bonk(Snake victim, Snake by)
        {
            victim.DropAllUpgrades();
            Events.Add(new GameEvent { type = EventType.Bonk, who = victim.id, by = by.id, x = victim.x, z = victim.z, lost = victim.mass });
            victim.cards = null;
            int n = Math.Min(BONK_PELLETS, Math.Max(3, (int)Math.Ceiling(victim.Length / 1.5f)));
            Shed(victim, victim.mass, BONK_RETURN, n);
            victim.mass = 0;
            victim.alive = false;
            victim.bodyCount = 0;
            victim.respawnIn = RESPAWN_AFTER;
            by.Gain(BONK_REWARD);
        }

        void Respawn(Snake s)
        {
            DropIn(s);
            s.alive = true;
            s.immune = RESPAWN_GRACE;
            s.speedFactor = 1;
            s.touchingWall = s.wasTouchingWall = false;
            Events.Add(new GameEvent { type = EventType.Respawn, who = s.id, x = s.x, z = s.z });
        }

        void DropIn(Snake s)
        {
            float bestX = School.SPAWN_X, bestZ = School.SPAWN_Z, bestHeading = 0;
            int fewest = int.MaxValue;
            float length = s.Length;
            var B = Stage.Bounds;
            for (int tries = 0; tries < 60 && fewest > 0; tries++)
            {
                float x = Rng.Range(B.minX, B.maxX), z = Rng.Range(B.minZ, B.maxZ);
                if (!Collide.IsFree(Stage, x, z, 2.5f, HazardCircles) || !ClearOfSnakes(x, z, tries < 40 ? SNAKE_CLEARANCE : 5)) continue;
                float turn = Rng.Range(0, Collide.PI * 2);
                for (int k = 0; k < DROP_HEADINGS && fewest > 0; k++)
                {
                    float heading = Collide.WrapAngle(turn + k * Collide.PI * 2 / DROP_HEADINGS);
                    int blocked = 0;
                    for (float d = 1; d <= length; d += 1)
                        if (!Collide.IsFree(Stage, x - (float)Math.Cos(heading) * d, z - (float)Math.Sin(heading) * d, 0.4f, HazardCircles)) blocked++;
                    if (blocked >= fewest) continue;
                    fewest = blocked; bestX = x; bestZ = z; bestHeading = heading;
                }
            }
            s.PlaceAt(bestX, bestZ, bestHeading);
        }
    }
}
