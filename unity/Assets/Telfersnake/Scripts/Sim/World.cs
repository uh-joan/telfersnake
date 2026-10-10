using System;
using System.Collections.Generic;

namespace Telfer.Sim
{
    public enum EventType
    {
        Eat, Gulp, Boop, Ouch, Rock, Pellet, Tier, Cards, Bonk, Helmet, Respawn, Breath, Sneeze, Say, BumpWall, BumpCooper, BumpKid, Power, Hit, Howl, Chomp, Lob, Pelt, Kiss, Magic,
        // London (appended): an animal's call, a gull's theft, Tea Time; a lion's yawn ("roar" on the wire), a raven's CAW,
        // a bus's DING DING (or honk), a bonk by a vehicle, a puddle's splash.
        Cry, Steal, TeaTime, Roar, Caw, Ding, VBonk, Splash,
        // London's people (A4): a bump into the Royal Guard (Ahem), the Bobby's whistle, three laps round the guard
        // (his smile for the room, a gem for `who`), a tourist's photo, the living statue's BOO.
        BumpGuard, Whistle, Guard, GuardSmile, Photo, Boo,
        // London's legends (A5): the phoenix undoes a hit, a flight lands, the Mighty Roar's ring (and a rival blown
        // back), a Crown Jewel (i, n) and the ROYAL crown, the pearly trail (to tx, tz) and a button eaten.
        Rise, Land, Ring, Roared, Jewel, Royal, Pearly, ButtonEat,
        // London's set pieces (A6): a BONG (k of n), the ramp launch, on/off a ride, a Tube warp (from, to), the wobbly
        // bridge, the Red Arrows' trail, a finale sparkle (a gem).
        Bong, Launch, Ride, Warp, Wobble, Arrows, Treat,
    }

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
        /// <summary>Power: which one was cast. Hit: freeze (true) or shrink.</summary>
        public UpgradeId power;
        public bool freeze;
        public PredatorKind predator;
        public ProjectileKind projectile;
        public CreatureKind creature;
        /// <summary>Gems earned by `who` (magic), or whether a kiss carried one.</summary>
        public int gems;
        public bool gem;
        /// <summary>Upgrades lost to a bonk, for the HUD.</summary>
        public UpgradeId[] lostUpgrades;
        /// <summary>Say: Miss Sami speaking (not the warden).</summary>
        public bool sami;
        /// <summary>Ding / VBonk: which vehicle, and whether it honked (a cab, or a bus kept waiting).</summary>
        public VehicleKind vehicle;
        public bool honk;
        /// <summary>London: a jewel's index (k) and how many are held (n); a BONG's k of n; a warp's stations; a ride's carrier and on/off; the pearly trail's end.</summary>
        public int k, n, from, to;
        public float tx, tz;
        public Carrier carrier;
        public bool on;
        /// <summary>Say: who in London is speaking ("sami", "beefeater"), null for the warden.</summary>
        public string speaker;
    }

    /// <summary>
    /// The whole game state, advanced in fixed 1/60 s steps from inputs alone (port of world.ts, solo
    /// play, either stage). No rendering, no Unity: the views read it and drain its events.
    /// </summary>
    public sealed partial class World
    {
        public const float STEP = 1f / 60f;
        /// <summary>London: in the river a snake paddles at half speed (world.ts SWIM_FACTOR).</summary>
        const float SWIM_FACTOR = 0.5f;
        const float SLOW_FACTOR = 0.6f, BUMP_QUIET = 0.4f, GULP_REACH = 0.75f, RESPAWN_CLEARANCE = 15;
        const float BOOP_SLOWDOWN = 0.35f, BOOP_COOLDOWN = 1.2f, GOAT_COOLDOWN = 3;
        const float OUCH_SHARE = 0.12f, OUCH_MAX = 15, OUCH_GRACE = 1.5f, PELLET_RETURN = 0.7f;
        const int PELLET_MAX = 5, PELLET_CAP = 150;
        const float BODY_HIT = 0.85f; const int BONK_PELLETS = 14; const float BONK_RETURN = 0.6f, BONK_REWARD = 8;
        const float RESPAWN_AFTER = 3, RESPAWN_GRACE = 3, HELMET_GRACE = 1.5f, SNAKE_CLEARANCE = 12;
        const int DROP_HEADINGS = 8;
        const float MAGNET_PULL = 7, BEE_ORBIT = 2.4f, BEE_REACH = 0.9f, BEE_SPIN = 2.2f;
        const float BREATH_HALF_ANGLE = 0.5f, BREATH_RECHECK = 0.25f, DAZE = 1.8f, BREATH_SHARE = 0.14f;
        const float LASER_HALF_ANGLE = 0.2f, CREATURE_RESPAWN = 25, PIXIE_MAGNET = 22;
        // London (world.ts): a cuppa's zoom; Tea Time (sandwich, scone, sponge inside 20 s) and its cake stand; puddles; traffic.
        const float TEA_ZOOM = 1.25f, TEA_ZOOM_FOR = 2, TEA_TIME_WITHIN = 20, TEA_TIME_BONUS = 150, TEA_TIME_COOL = 3;
        const int TEA_TIME_TREATS = 8;
        static readonly FoodKind[] TEA_STAND = { FoodKind.Scone, FoodKind.Sponge, FoodKind.Sandwich, FoodKind.Strawberry };
        const float PUDDLE_ZOOM = 1.35f, VEHICLE_BONK_SPEED = 0.3f;

        static readonly string[] SAMI_LINES =
        {
            "Morning! Lovely to see you on the Common.", "Mind the bears, poppet — give them a wide berth.",
            "Ooh, someone has grown! Well done, you.", "Have you seen a white stag? They say one lives in the woods.",
            "Stay on the grass, away from the road, there’s a love.", "Kind hands and kind hearts, everyone!",
            "…and I said to her, well, he’s not had his tea yet!", "The mushrooms are out — the spotted ones are the best.",
            "No throwing pebbles! …Oh. It’s only a little one.", "Wave to the kiddies, they do love a friendly snake.",
        };

        public static readonly SnakeLook PLAYER_LOOK = new SnakeLook("You", 0x4cbb4a, 0xf2d94a, 0x57c955);

        public int Tick;
        public readonly Rng Rng;
        public readonly Stage Stage;
        public readonly List<Snake> Snakes = new List<Snake>();
        public readonly List<Food> Foods = new List<Food>();
        public readonly List<Animal> Animals = new List<Animal>();
        public readonly List<Hazard> Hazards;
        public readonly List<Pellet> Pellets = new List<Pellet>();
        public readonly List<GameEvent> Events = new List<GameEvent>();
        public readonly Cooper Cooper;
        public readonly List<Predator> Predators;
        public readonly List<Kid> Kids;
        public readonly List<Projectile> Projectiles = new List<Projectile>();
        public readonly List<Creature> Creatures;
        /// <summary>London's buses and cabs (empty elsewhere), and their routes made ready for driving.</summary>
        public readonly List<Vehicle> Vehicles = new List<Vehicle>();
        public readonly List<Lane> Lanes = new List<Lane>();
        /// <summary>London's puddles (flat: slid across, never bumped), and who was in one last tick.</summary>
        readonly List<Hazard> puddles = new List<Hazard>();
        readonly Dictionary<int, bool> inPuddle = new Dictionary<int, bool>();
        /// <summary>Every snake's head and body, as circles, for the traffic to brake for (rebuilt each tick).</summary>
        readonly List<Walker> walkers = new List<Walker>();
        /// <summary>How keen the predators are (Easy &lt; Normal &lt; God).</summary>
        readonly float ferocity;
        float samiSayIn = 3;
        public readonly Hit ScratchHit = new Hit();
        public readonly Mode Mode;

        /// <summary>Rocks as circles, refreshed when one breaks and moves: what snakes and animals bounce off.</summary>
        public readonly List<Circle> HazardCircles = new List<Circle>();
        /// <summary>What snakes bounce off on top of the stage: the rocks, plus the fallen log.</summary>
        readonly List<Circle> snakeSolids = new List<Circle>();
        readonly Dictionary<Snake, Bot> bots = new Dictionary<Snake, Bot>();
        SnakeInput playerInput;

        /// <summary>Which snake is this player's: 0 in solo, the server's seat in a network replica.</summary>
        public readonly int MeIndex;
        public Snake Me => Snakes[MeIndex];
        /// <summary>A network replica is shown, never stepped: the server runs the real world.</summary>
        public readonly bool IsReplica;
        /// <summary>What snakes bounce off: the rocks plus the stage's logs (for predicting your own snake online).</summary>
        public IReadOnlyList<Circle> SnakeSolids => snakeSolids;

        public World(uint seed, Mode mode, Stage stage = null, SnakeLook look = null, bool canBuyPowers = false)
        {
            Rng = new Rng(seed);
            Mode = mode;
            stage = stage ?? School.Stage;
            // A stage with set pieces changes under the snakes (Tower Bridge lifts): this world gets its own copy.
            Stage = stage.SetPieces != null ? stage.Copy() : stage;
            sp = stage.SetPieces;
            setPieceSeed = sp != null ? Sim.SetPieces.SeedFor(seed) : 0;
            bridgesDown = stage.Bridges;
            ferocity = Rivals.Ferocity(mode);
            Cooper = new Cooper(Stage.Warden);
            Hazards = Sim.Hazards.Make(Rng, Stage);
            RefreshHazardCircles();

            var player = new Snake(0, look ?? PLAYER_LOOK, false) { canBuyPowers = canBuyPowers };
            player.PlaceAt(Stage.SpawnX, Stage.SpawnZ, Stage.SpawnHeading);
            Snakes.Add(player);

            var roster = new List<Personality>(Rivals.SOLO);
            for (int i = 0; i < Stage.ExtraRivals && i < Rivals.MORE.Length; i++) roster.Add(Rivals.MORE[i]);
            foreach (var p0 in roster)
            {
                var who = p0.For(mode);
                var s = new Snake(Snakes.Count, who.look, true);
                Snakes.Add(s);
                SeatBot(s, who);
                DropIn(s);
            }
            foreach (var s in Snakes) s.immune = RESPAWN_GRACE;

            int foodCount = (int)Math.Round(Rivals.FoodCount(mode) * Stage.FoodScale);
            for (int i = 0; i < foodCount; i++)
            {
                var f = new Food { born = -999 };
                Sim.Foods.Place(f, Rng, Stage, -999, player.x, player.z, 2, HazardCircles);
                Foods.Add(f);
            }
            foreach (var kind in Stage.AnimalKinds)
            {
                for (int i = 0; i < Stage.AnimalCount(kind); i++)
                {
                    var a = new Animal { kind = kind };
                    Sim.Animals.Place(a, this, 6);
                    a.born = -999;
                    Animals.Add(a);
                }
            }
            Predators = Sim.Predators.Make(Stage, Rng);
            Kids = Sim.Kids.Make(Stage, Rng);
            foreach (var k in Kids) if (k.kind == KidKind.Busker) buskers.Add(k);
            tripTotal = Stage.TripPath != null ? Sim.Kids.LoopLength(Stage.TripPath) : 0;
            if (Stage.Chatters != null) for (int i = 0; i < Stage.Chatters.Length; i++) chatterIn.Add(3 + i * 2.5f);
            Creatures = Sim.Creatures.Make(Stage, Rng);
            // London's traffic: fixed routes, evenly spread, no RNG.
            if (Stage.Routes != null && Stage.Traffic != null)
            {
                foreach (var r in Stage.Routes) Lanes.Add(Sim.Vehicles.MakeLane(r, Stage.Zebras));
                Vehicles.AddRange(Sim.Vehicles.Make(Stage.Traffic, Stage.Routes, Lanes));
                if (sp != null) foreach (var lane in Lanes) spanStops.Add(SpanStopLines(lane, sp.span));
            }
            // London's Crown Jewels: last, and no RNG at all on a stage without them.
            Treasures = Sim.Treasures.Make(Stage, Rng);
        }

        /// <summary>
        /// An empty world for a networked replica (port of the shape of replica.ts): no bots, no food,
        /// no animals. The replica fills the lists from the server's welcome, writes the snapshots into
        /// them, and never calls Step.
        /// </summary>
        World(Stage stage, Mode mode, int me, int setPieceSeed)
        {
            Rng = new Rng(1);
            Mode = mode;
            stage = stage ?? School.Stage;
            // London's set pieces are worked out from the tick here as on the server: its own copy of the stage, the room's flavour.
            Stage = stage.SetPieces != null ? stage.Copy() : stage;
            sp = stage.SetPieces;
            this.setPieceSeed = sp != null ? setPieceSeed : 0;
            bridgesDown = stage.Bridges;
            ferocity = Rivals.Ferocity(mode);
            Cooper = new Cooper(Stage.Warden);
            Hazards = new List<Hazard>();
            Predators = new List<Predator>();
            Kids = new List<Kid>();
            Creatures = new List<Creature>();
            Treasures = new List<Treasure>();
            MeIndex = me;
            IsReplica = true;
            RefreshHazardCircles();
        }

        public static World Replica(Stage stage, Mode mode, int me, int setPieceSeed = 0) => new World(stage, mode, me, setPieceSeed);

        /// <summary>Call after moving a hazard (a broken rock dropped somewhere new).</summary>
        public void RefreshHazardCircles()
        {
            HazardCircles.Clear();
            foreach (var h in Hazards) HazardCircles.Add(h.AsCircle);
            // What the snake bounces off: the rocks, plus the fallen log. Not London's puddles: those you slide across.
            snakeSolids.Clear();
            puddles.Clear();
            foreach (var h in Hazards) if (h.Solid) snakeSolids.Add(h.AsCircle); else puddles.Add(h);
            snakeSolids.AddRange(Stage.Logs);
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
            // In God mode the bots take upgrades, so let them draw powers too (they pay no gems).
            s.canBuyPowers = Mode == Mode.God;
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
            bool london = Stage.Id == StageId.London;
            if (sp != null) SetPiecesTick(sp);
            Cooper.Update(this, dt);
            foreach (var a in Animals) Sim.Animals.Update(a, this, dt);
            UpdatePredators(dt);
            if (Vehicles.Count > 0) UpdateVehicles(dt);
            UpdateKids(dt);
            UpdateProjectiles(dt);
            UpdateCreatures(dt);
            if (Treasures.Count > 0) UpdateTreasures(dt);
            if (Buttons.Count > 0) ExpireButtons();
            ChatterSami(dt);
            if (Stage.Chatters != null) ChatterLondon(dt);
            if (Stage.Statue != null) StatueTick(dt);

            foreach (var s in Snakes)
            {
                if (!s.alive)
                {
                    s.respawnIn -= dt;
                    if (s.respawnIn <= 0) Respawn(s);
                    continue;
                }
                bool flew = s.HasMagic(MagicId.Wings);
                s.TickMagic(dt);
                if (flew && !s.HasMagic(MagicId.Wings)) Land(s); // Dragon Wings wore off: down to free, dry ground
                // London's timers run down whether or not the snake is moving.
                if (s.teaFor > 0) s.teaFor -= dt;
                if (s.teaCool > 0) s.teaCool -= dt;
                // London: on the Eye or the river bus, the ride moves you (and you cannot be touched).
                if (s.Carried) { Carry(s, sp); continue; }
                if (s.launchFor > 0) s.launchFor -= dt;
                bots.TryGetValue(s, out var bot);
                if (s.frozenFor > 0) { s.frozenFor -= dt; continue; }
                var inp = bot != null ? bot.Think(s, this, dt) : playerInput;

                s.slowed = Collide.Hypot(s.x - Cooper.x, s.z - Cooper.z) < Cooper.AURA;
                float pace = s.slowed ? SLOW_FACTOR : 1;
                // Flying (Dragon Wings): no paddle, no puddles. River Rider: the Thames is a fast lane.
                bool flying = s.HasMagic(MagicId.Wings);
                if (Stage.Water != null && !flying && Water.In(Stage, s.x, s.z)) pace *= s.HasMagic(MagicId.River) ? RIVER_ZOOM : SWIM_FACTOR;
                if (puddles.Count > 0 && !flying && Puddle(s)) pace *= PUDDLE_ZOOM;
                if (s.teaFor > 0) pace *= TEA_ZOOM;
                if (buskers.Count > 0 && Dancing(s)) pace *= BUSK_ZOOM;
                if (s.launchFor > 0) pace *= LAUNCH_ZOOM;
                s.speedFactor += (pace - s.speedFactor) * Math.Min(1, dt * 4);
                // The parade is a moving wall, but never a trap: held against it a while, you are let through.
                held.TryGetValue(s.id, out float paradeHeldFor);
                var solids = marcherCount > 0 && paradeHeldFor <= Sim.SetPieces.PARADE_LET_THROUGH ? withParade : snakeSolids;
                s.Update(inp, dt, !s.slowed, Stage, solids);

                bool ouch = BonkRock(s);
                if (s.touchingWall && !s.wasTouchingWall && !ouch && s.bumpQuiet <= 0 && s.immune <= 0)
                {
                    s.bumpQuiet = BUMP_QUIET;
                    var g = Stage.Guard;
                    bool guard = (g != null && Collide.Hypot(s.x - g[0], s.z - g[1]) < s.Radius + 1.2f) || ByMarcher(s, 0.1f);
                    Events.Add(new GameEvent { type = guard ? EventType.BumpGuard : EventType.BumpWall, who = s.id, x = s.x, z = s.z });
                }
                if (Stage.Guard != null) LapGuard(s, dt);

                if (london)
                {
                    // London keeps world.ts's order: the warden, the people, the set pieces, then the animals.
                    if (!flying)
                    {
                        BumpCooper(s, dt);
                        MeetKids(s, dt);
                        if (sp != null) MeetSetPieces(s, sp, dt);
                    }
                    MeetAnimals(s, dt, flying);
                }
                else
                {
                    BumpCooper(s, dt);
                    MeetAnimals(s, dt);
                    MeetKids(s, dt);
                }
                MeetCreatures(s);
                if (Treasures.Count > 0) MeetJewels(s);
                if (Buttons.Count > 0) EatButtons(s);
                PullFood(s, dt);
                Eat(s);
                Bees(s);
                Breathe(s, dt);
                CastPowers(s, dt);

                if (s.Tier > s.highestTier)
                {
                    s.highestTier = s.Tier;
                    Events.Add(new GameEvent { type = EventType.Tier, who = s.id, tier = s.Tier, x = s.x, z = s.z });
                }
                // Upgrades are normally the player's edge: bots level up but take no cards — except in God
                // mode, where a bot grabs the scariest card at once.
                if (bot != null && Mode != Mode.God) s.pendingCards = 0;
                else if (s.pendingCards > 0 && s.cards == null)
                {
                    s.cards = Upgrades.Roll(Rng, s);
                    if (bot != null) { s.TakeCard(s.cards[Upgrades.BotChoice(s.cards)]); s.cards = null; }
                    else Events.Add(new GameEvent { type = EventType.Cards, who = s.id });
                }
            }

            // London's traffic: everyone out of the buses and cabs (a frozen snake too; it is blinking then, so only nudged).
            if (Vehicles.Count > 0) foreach (var s in Snakes) if (s.alive && !s.HasMagic(MagicId.Wings) && !s.Carried) MeetVehicles(s, dt);
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
            Collide.ResolveCircle(Stage, cx + nx * reach, cz + nz * reach, s.Radius, ScratchHit, snakeSolids);
            s.x = ScratchHit.x; s.z = ScratchHit.z;
            s.Deflect(nx, nz, dt);
        }

        bool BonkRock(Snake s)
        {
            if (!s.touchingWall || s.immune > 0 || s.HasMagic(MagicId.Wings)) return false;
            foreach (var h in Hazards)
            {
                if (!h.Solid) continue;
                float reach = s.Radius + h.r + 0.02f;
                if ((s.x - h.x) * (s.x - h.x) + (s.z - h.z) * (s.z - h.z) > reach * reach) continue;
                if (Rise(s)) return true;
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

        void MeetAnimals(Snake s, float dt, bool flying = false)
        {
            // Gog & Magog: a giant gulps like the next size up. The size is read afresh for every animal: a gulp
            // can grow the snake a size mid-loop, and the next animal must already see it (as on main).
            int boost = s.HasMagic(MagicId.Giant) ? 1 : 0;
            foreach (var a in Animals)
            {
                var spec = a.Spec;
                float d2 = (a.x - s.x) * (a.x - s.x) + (a.z - s.z) * (a.z - s.z);
                if (s.Tier + boost >= spec.tier)
                {
                    float reach = s.BiteReach * GULP_REACH + spec.radius;
                    if (d2 > reach * reach) continue;
                    float points = s.Gain(spec.value);
                    Events.Add(new GameEvent { type = EventType.Gulp, who = s.id, animal = a.kind, x = a.x, z = a.z, points = points });
                    Sim.Animals.Place(a, this, RESPAWN_CLEARANCE);
                    continue;
                }
                // Too big to swallow: it stands its ground and the snake goes boing (a flyer just passes over).
                if (flying) continue;
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
            // Rainbow Rush (the Unicorn): every bite counts golden while it lasts.
            bool golden = f.golden || s.HasMagic(MagicId.Rainbow);
            float value = Sim.Foods.VALUE[(int)f.kind] * (golden ? Sim.Foods.GOLDEN_MULTIPLIER : 1) * (toasted ? 2 : 1);
            float points = s.Gain(value);
            Events.Add(new GameEvent { type = EventType.Eat, who = s.id, food = f.kind, x = f.x, z = f.z, points = points, golden = golden, toasted = toasted });
            var kind = f.kind;
            Sim.Foods.Place(f, Rng, Stage, Tick, s.x, s.z, 8, HazardCircles, s.luck);
            // London's menu only (no other stage grows these): a cuppa's zoom, and the Tea Time combo.
            if (kind == FoodKind.Tea) s.teaFor = TEA_ZOOM_FOR;
            if (Array.IndexOf(Sim.Foods.TEA_TIME, kind) >= 0) TeaTime(s, kind);
        }

        /// <summary>Sandwich, then scone, then sponge, inside TEA_TIME_WITHIN seconds (other food in between is fine).</summary>
        void TeaTime(Snake s, FoodKind kind)
        {
            if (s.teaCool > 0) return;
            int step = Array.IndexOf(Sim.Foods.TEA_TIME, kind);
            if (step == 0) { s.teaStep = 1; s.teaFrom = Tick; return; }
            if (step != s.teaStep || (Tick - s.teaFrom) * STEP > TEA_TIME_WITHIN) { s.teaStep = 0; return; } // out of order: start again with a sandwich
            s.teaStep++;
            if (s.teaStep < Sim.Foods.TEA_TIME.Length) return;
            s.teaStep = 0;
            s.teaCool = TEA_TIME_COOL;
            s.score += TEA_TIME_BONUS;
            CakeStand(s);
            Events.Add(new GameEvent { type = EventType.TeaTime, who = s.id, x = s.x, z = s.z });
        }

        /// <summary>Bring a ring of afternoon-tea treats out around the snake (food borrowed from elsewhere on the map).</summary>
        void CakeStand(Snake s)
        {
            int i = 0;
            float ring = Math.Max(3, s.BiteReach + 1.5f); // out of reach, so the stand is not swallowed in one gulp
            for (int n = 0; n < TEA_TIME_TREATS; n++)
            {
                float a = (float)n / TEA_TIME_TREATS * Collide.PI * 2 + s.heading;
                float x = s.x + (float)Math.Cos(a) * ring, z = s.z + (float)Math.Sin(a) * ring;
                if (!Collide.IsFree(Stage, x, z, 0.5f, HazardCircles)) continue;
                // Borrow the next food that is not already close by.
                while (i < Foods.Count && (Foods[i].x - s.x) * (Foods[i].x - s.x) + (Foods[i].z - s.z) * (Foods[i].z - s.z) < 100) i++;
                if (i >= Foods.Count) return;
                var f = Foods[i++];
                f.x = x; f.z = z;
                f.kind = TEA_STAND[n % TEA_STAND.Length];
                f.golden = false;
                f.born = Tick;
            }
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
            float reach = Math.Max(s.magnet, s.HasMagic(MagicId.Magnet) ? PIXIE_MAGNET : 0);
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
            if (!worth) foreach (var o in Snakes) if (o != s && o.alive && o.immune <= 0 && !o.HasMagic(MagicId.Wings) && InBreath(s, o.x, o.z, range)) { worth = true; break; }
            if (!worth) foreach (var a in Animals) if (s.Tier >= a.Spec.tier && InBreath(s, a.x, a.z, range)) { worth = true; break; }
            if (!worth) foreach (var p in Predators) if (p.Awake && InBreath(s, p.x, p.z, range)) { worth = true; break; }
            if (!worth) { s.breathIn = BREATH_RECHECK; return; }

            s.breathIn = 4.2f - 0.4f * s.breathLevel;
            Events.Add(new GameEvent { type = EventType.Breath, who = s.id, x = s.x, z = s.z, heading = s.heading, range = range });
            foreach (var f in Foods) if (InBreath(s, f.x, f.z, range)) SwallowFood(s, f, true);
            foreach (var a in Animals) if (s.Tier >= a.Spec.tier && InBreath(s, a.x, a.z, range)) a.dazed = DAZE;
            foreach (var p in Predators)
                if (p.Awake && InBreath(s, p.x, p.z, range)) Spook(p, false);
            foreach (var o in Snakes)
            {
                if (o == s || !o.alive || o.immune > 0 || o.HasMagic(MagicId.Wings) || !InBreath(s, o.x, o.z, range)) continue;
                if (Rise(o)) continue; // the phoenix takes the scorch
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
                if (!a.alive || a.immune > 0 || Unseen(a) || (Stage.Sanctuary.HasValue && Stage.Sanctuary.Value.Contains(a.x, a.z))) continue;
                foreach (var b in Snakes)
                {
                    if (b == a || !b.alive || b.immune > 0 || Unseen(b)) continue;
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

                    bool risen = Rise(a); // the phoenix, first: it is the one that wears off
                    if (risen || a.helmetReady)
                    {
                        // The phoenix or the helmet takes it: bounce straight back the way it came.
                        if (!risen)
                        {
                            a.helmetReady = false;
                            a.helmetIn = a.helmetRecharge;
                            a.immune = HELMET_GRACE;
                        }
                        a.heading = (float)Math.Atan2(a.z - hitZ, a.x - hitX);
                        Collide.ResolveCircle(Stage, a.x + (float)Math.Cos(a.heading) * 0.6f, a.z + (float)Math.Sin(a.heading) * 0.6f, a.Radius, ScratchHit, HazardCircles);
                        a.x = ScratchHit.x; a.z = ScratchHit.z;
                        // London: the bounce must not land the head in a parked bus (it is blinking now: a nudge, never a bonk).
                        if (Vehicles.Count > 0) MeetVehicles(a, STEP);
                        if (!risen) Events.Add(new GameEvent { type = EventType.Helmet, who = a.id, x = a.x, z = a.z });
                    }
                    else Bonk(a, b);
                    break;
                }
            }
        }

        void Bonk(Snake victim, Snake by)
        {
            var lostUps = new List<UpgradeId>();
            foreach (var kv in victim.Owned()) lostUps.Add(kv.Key);
            victim.DropAllUpgrades();
            Events.Add(new GameEvent { type = EventType.Bonk, who = victim.id, by = by.id, x = victim.x, z = victim.z, lost = victim.mass, lostUpgrades = lostUps.ToArray() });
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
            s.teaStep = 0; s.teaCool = 0;
            s.speedFactor = 1;
            // London: a fresh start at the Tube, the Eye and the boat (a respawn by a station is not stepping in).
            if (sp != null) { tubeAt.Remove(s.id); tubeCool[s.id] = eyeCool[s.id] = boatCool[s.id] = 0; }
            s.touchingWall = s.wasTouchingWall = false;
            Events.Add(new GameEvent { type = EventType.Respawn, who = s.id, x = s.x, z = s.z });
        }

        void DropIn(Snake s)
        {
            float bestX = Stage.SpawnX, bestZ = Stage.SpawnZ, bestHeading = 0;
            int fewest = int.MaxValue;
            float length = s.Length;
            var B = Stage.Bounds;
            // London: a puddle is no place to pop out either (world.ts checks every hazard). Elsewhere, as before.
            IReadOnlyList<Circle> blockers = puddles.Count > 0 ? (IReadOnlyList<Circle>)HazardCircles : snakeSolids;
            for (int tries = 0; tries < 60 && fewest > 0; tries++)
            {
                float x = Rng.Range(B.minX, B.maxX), z = Rng.Range(B.minZ, B.maxZ);
                if (!Collide.IsFree(Stage, x, z, 2.5f, blockers) || !ClearOfSnakes(x, z, tries < 40 ? SNAKE_CLEARANCE : 5)) continue;
                // London: never pop out in the road (a bus could be parked right there).
                if (Stage.Routes != null && OnARoute(x, z, 3)) continue;
                float turn = Rng.Range(0, Collide.PI * 2);
                for (int k = 0; k < DROP_HEADINGS && fewest > 0; k++)
                {
                    float heading = Collide.WrapAngle(turn + k * Collide.PI * 2 / DROP_HEADINGS);
                    int blocked = 0;
                    for (float d = 1; d <= length; d += 1)
                        if (!Collide.IsFree(Stage, x - (float)Math.Cos(heading) * d, z - (float)Math.Sin(heading) * d, 0.4f, blockers)) blocked++;
                    if (blocked >= fewest) continue;
                    fewest = blocked; bestX = x; bestZ = z; bestHeading = heading;
                }
            }
            s.PlaceAt(bestX, bestZ, bestHeading);
        }
    }
}
