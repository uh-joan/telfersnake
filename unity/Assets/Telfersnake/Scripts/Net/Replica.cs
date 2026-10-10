using System;
using System.Collections.Generic;
using Telfer.Sim;

namespace Telfer.Net
{
    /// <summary>
    /// This device's copy of a shared playground (port of src/net/replica.ts), kept in an ordinary
    /// <see cref="Sim.World"/> so the views cannot tell the difference. The server decides everything;
    /// this only makes it look smooth:
    ///  - other snakes, the animals and Mr Cooper are drawn slightly in the past, blended between the
    ///    two snapshots either side of that moment;
    ///  - your own snake is moved at once by your own thumb (the same Move the server runs), then
    ///    quietly corrected whenever the server's version arrives;
    ///  - bodies are not sent at all: each device lays the trail from the head it is showing.
    /// Call <see cref="Update"/> once per frame on the main thread.
    /// </summary>
    public sealed class Replica
    {
        /// <summary>How far behind the newest snapshot others are drawn, so there are always two to blend between.</summary>
        const int DELAY_TICKS = 7;
        const int KEEP_SNAPSHOTS = 12;
        /// <summary>Metres: further than this is a respawn, not an error to smooth away.</summary>
        const float SNAP_IF_OFF_BY = 4;
        const float AWAY_REPEAT = 8, PICK_GRACE = 0.7f;

        struct Pending { public int q; public SnakeInput input; }

        public readonly Connection Net;
        readonly Mode mode;
        /// <summary>Set once the welcome arrives: the replica world, shaped like the server's.</summary>
        public World World { get; private set; }
        /// <summary>A snapshot has arrived, so every snake stands somewhere real: safe to build views.</summary>
        public bool Live { get; private set; }
        public int Me { get; private set; }
        public string Room { get; private set; }
        /// <summary>The server has my snake standing aside (I am in a menu).</summary>
        public bool Away { get; private set; }
        /// <summary>The server has my snake frozen (a rival's Freeze Puff): no predicting, or it rubber-bands.</summary>
        public bool Frozen { get; private set; }
        /// <summary>I have opened a menu: my snake stops here at once, without waiting to hear back.</summary>
        public bool Paused { get; private set; }
        /// <summary>Seconds since the last snapshot.</summary>
        public float SilentFor { get; private set; }
        /// <summary>Goes up whenever a seat really changes (someone joins, leaves or changes clothes).</summary>
        public int SeatsVersion { get; private set; }
        /// <summary>Which seats changed since the caller last cleared it, so only those snakes are rebuilt.</summary>
        public readonly HashSet<int> ChangedSeats = new HashSet<int>();
        /// <summary>Players in the room who are people, me included.</summary>
        public int HumanCount { get; private set; }
        /// <summary>Every seat by id (bots too): looks, hats and trails for dressing the snakes.</summary>
        public Seat[] AllSeats { get; private set; } = new Seat[0];

        // Dev numbers: how good the prediction is.
        public int Snapshots { get; private set; }
        public int HardResets { get; private set; }
        /// <summary>How far each snapshot moved my predicted head (metres): the size of the correction.</summary>
        public float MaxPredictionError { get; private set; }
        public float LastPredictionError { get; private set; }
        public readonly Dictionary<EventType, int> EventCounts = new Dictionary<EventType, int>();

        UpgradeId[] cards;
        float pickedFor, awayIn;
        readonly List<Snapshot> snaps = new List<Snapshot>();
        readonly Dictionary<int, string> seatKeys = new Dictionary<int, string>();
        readonly List<bool> wasAlive = new List<bool>();
        readonly List<double> packedUpgrades = new List<double>();
        readonly int[] levels = new int[(int)UpgradeId.Snack + 1];
        double renderTick;

        // Predicting my own snake: a body-less stand-in the inputs are replayed on.
        Snake ghost;
        readonly List<Pending> pending = new List<Pending>();
        int q;
        float owed, shownX, shownZ, shownHeading;
        /// <summary>
        /// What my predicted snake slides off (replica.ts updateBlockers): the rocks, London's buses and cabs as a
        /// row of circles each, and the parade's marchers (dropped once held against them long enough, as the server does).
        /// </summary>
        readonly List<Circle> blockers = new List<Circle>(), plainBlockers = new List<Circle>();
        float paradeHeld;
        /// <summary>The tick my prediction runs at (about DELAY_TICKS ahead of the picture).</summary>
        int predTick;

        Replica(Connection net, Mode mode) { Net = net; this.mode = mode; }

        /// <summary>Ask the server for a seat. Watch <see cref="State"/>: Joined, then <see cref="Live"/>.</summary>
        public static Replica Join(Mode mode, StageId stage, bool canBuy, string skin, string hat, string trail, string name, string url = null)
        {
            var hello = ClientMessage.Hello(mode, stage, canBuy, skin, hat, trail, name);
            return new Replica(Connection.Join(url ?? ServerUrl.Resolve(), hello), mode);
        }

        public NetState State => Net.State;
        /// <summary>Why it failed or ended: offline, lost, left, full, old, busy.</summary>
        public string Why => Net.Why;
        public Snake Snake => World?.Me;

        /// <summary>The cards on offer, or null (also null for a moment after a pick, while the server agrees).</summary>
        public UpgradeId[] Cards => pickedFor > 0 ? null : cards;
        /// <summary>Seconds left to pick (CARD_TIME = 8 on the server) before the first card is taken for me.</summary>
        public float CardsFor { get; private set; }

        /// <summary>Pick a card by index. The server checks nothing about gems: the caller pays.</summary>
        public void Pick(int i)
        {
            if (cards == null || pickedFor > 0) return;
            Net.Pick(i);
            pickedFor = PICK_GRACE;
        }

        /// <summary>A menu opened (or closed): stand my snake aside on the server and stop predicting it here.</summary>
        public void SetAway(bool on)
        {
            Paused = on;
            awayIn = AWAY_REPEAT;
            Net.Away(on);
        }

        public void SetCanBuy(bool on) => Net.SetCanBuy(on);
        public void Leave() => Net.Leave();

        // ------------------------------------------------------------------ the frame

        /// <summary>Once per frame: hear the server, move my snake by my thumb, blend everyone else.</summary>
        public void Update(float dt, SnakeInput input)
        {
            foreach (var m in Net.Poll())
            {
                if (m is Welcome w) Welcomed(w);
                else if (m is Seats s) { if (World != null) SetSeats(s.seats); }
                else if (m is Snapshot snap) { if (World != null) Receive(snap); }
            }
            if (World == null || !Live || Net.State != NetState.Joined) return;

            pickedFor = Math.Max(0, pickedFor - dt);
            CardsFor = Math.Max(0, CardsFor - dt);
            if (Paused && (awayIn -= dt) <= 0) { awayIn = AWAY_REPEAT; Net.Away(true); }

            var mine = World.Me;
            SilentFor += dt;
            // Not heard from the server for a while: do not let my snake slide on alone through a frozen world.
            bool free = mine.alive && cards == null && !Away && !Paused && !Frozen && SilentFor < 2;

            // Riding the Eye or the river bus, the server moves me: nothing to predict.
            free &= !mine.Carried;
            UpdateBlockers();
            owed = Math.Min(owed + dt, 0.25f);
            while (owed >= World.STEP)
            {
                owed -= World.STEP;
                q++;
                Net.Input(q, input.x, input.z, input.active, input.dash);
                if (!free) continue;
                pending.Add(new Pending { q = q, input = input });
                if (pending.Count > 120) pending.RemoveAt(0);
                Predict(input, true);
            }

            if (free)
            {
                // The shown head chases the predicted one, so a correction is a nudge rather than a jump.
                float k = 1 - (float)Math.Exp(-dt * 18);
                shownX += (ghost.x - shownX) * k;
                shownZ += (ghost.z - shownZ) * k;
                shownHeading += Collide.WrapAngle(ghost.heading - shownHeading) * k;
                mine.Follow(shownX, shownZ, shownHeading);
            }
            Blend(dt, free);
            foreach (var s in World.Snakes) if (s.alive) s.SampleBody();
        }

        // ------------------------------------------------------------------ hearing the server

        void Welcomed(Welcome w)
        {
            Me = w.me;
            Room = w.room;
            var stage = Stage.For(w.stage);
            var world = World.Replica(stage, mode, w.me, w.setPieceSeed);
            world.Tick = w.tick;
            renderTick = w.tick;
            foreach (var h in w.hazards)
                world.Hazards.Add(new Hazard { kind = (HazardKind)h.kind, x = h.x, z = h.z, r = h.r, turn = h.turn });
            world.RefreshHazardCircles();
            foreach (var _ in w.foods) world.Foods.Add(new Food { born = -999 });
            foreach (var row in w.foods) SetFood(world, row);
            foreach (var k in w.animalKinds) world.Animals.Add(new Animal { kind = (AnimalKind)k, born = -999 });
            // London's lions and ravens have fixed homes (a plinth, a perch each, in order): the views lift a lion onto its plinth.
            var homed = Predators.Make(stage, new Rng(1)).FindAll(p => p.kind == PredatorKind.Lion || p.kind == PredatorKind.Raven);
            foreach (var k in w.predatorKinds)
            {
                var kind = (PredatorKind)k;
                int at = homed.FindIndex(p => p.kind == kind);
                if (at >= 0) { world.Predators.Add(homed[at]); homed.RemoveAt(at); }
                else world.Predators.Add(new Predator { kind = kind });
            }
            foreach (var k in w.vehicleKinds) world.Vehicles.Add(new Vehicle { kind = (VehicleKind)k, route = -1 });
            for (int i = 0; i < w.treasureCount; i++) world.Treasures.Add(new Treasure { spot = i, respawnIn = 1 });
            int n = 0;
            foreach (var k in w.kidKinds) world.Kids.Add(new Kid { kind = (KidKind)k, look = n++ });
            foreach (var k in w.creatureKinds) world.Creatures.Add(new Creature { kind = (CreatureKind)k });
            SetPellets(world, w.pellets);
            World = world;
            ghost = new Snake(-1, w.seats.Length > 0 ? w.seats[0].look.ToSim() : World.PLAYER_LOOK, false);
            SetSeats(w.seats);
        }

        void SetSeats(Seat[] seats)
        {
            bool changed = false;
            foreach (var seat in seats)
            {
                string key = seat.bot + "|" + seat.hat + "|" + seat.trail + "|" + seat.look.name + "|" + seat.look.body + "|" + seat.look.stripe + "|" + seat.look.head
                    + "|" + (seat.look.pattern == null ? "" : string.Join(",", seat.look.pattern));
                if (seatKeys.TryGetValue(seat.id, out var old) && old == key) continue;
                seatKeys[seat.id] = key;
                ChangedSeats.Add(seat.id);
                changed = true;
                var look = seat.look.ToSim();
                if (seat.id == Me) look.name = "You";
                while (World.Snakes.Count <= seat.id)
                {
                    var s = new Snake(World.Snakes.Count, look, true) { alive = false };
                    World.Snakes.Add(s);
                    wasAlive.Add(false);
                    packedUpgrades.Add(-1);
                }
                World.Snakes[seat.id].look = look;
                World.Snakes[seat.id].isBot = seat.bot;
            }
            if (!changed) return;
            SeatsVersion++;
            var all = new Seat[World.Snakes.Count];
            foreach (var s in AllSeats) if (s != null && s.id < all.Length) all[s.id] = s;
            foreach (var s in seats) if (s.id < all.Length) all[s.id] = s;
            AllSeats = all;
            int humans = 0;
            foreach (var s in all) if (s != null && !s.bot) humans++;
            HumanCount = humans;
        }

        static void SetFood(World w, FoodRow row)
        {
            if (row.index < 0 || row.index >= w.Foods.Count) return;
            var f = w.Foods[row.index];
            f.kind = (FoodKind)row.kind;
            f.golden = row.golden;
            f.x = row.x;
            f.z = row.z;
            f.born = row.born;
        }

        static void SetPellets(World w, PelletRow[] rows)
        {
            w.Pellets.Clear();
            foreach (var p in rows) w.Pellets.Add(new Pellet { x = p.x, z = p.z, value = p.value, born = p.born, color = 0xf2d94a });
        }

        /// <summary>A snapshot has arrived. Facts are taken at once; positions wait to be blended in Update.</summary>
        void Receive(Snapshot snap)
        {
            var w = World;
            SilentFor = 0;
            Snapshots++;
            snaps.Add(snap);
            if (snaps.Count > KEEP_SNAPSHOTS) snaps.RemoveAt(0);
            foreach (var row in snap.f) SetFood(w, row);
            if (snap.p != null) SetPellets(w, snap.p);
            // London: the Crown Jewels sit still (taken straight), the buttons come whole when they change.
            if (snap.tr != null)
                for (int i = 0; i < snap.tr.Length && i < w.Treasures.Count; i++)
                {
                    var t = w.Treasures[i];
                    t.x = snap.tr[i].x;
                    t.z = snap.tr[i].z;
                    t.respawnIn = snap.tr[i].present ? 0 : 1;
                }
            if (snap.pb != null)
            {
                w.Buttons.Clear();
                foreach (var b in snap.pb) w.Buttons.Add(new Button { x = b.x, z = b.z, born = b.born, owner = -1 });
            }
            // Buses not yet seen anywhere are put straight where they are, so none is drawn at the origin.
            if (snap.vh != null)
                for (int i = 0; i < snap.vh.Length && i < w.Vehicles.Count; i++)
                {
                    var v = w.Vehicles[i];
                    if (v.route >= 0) continue;
                    v.x = snap.vh[i].x; v.z = snap.vh[i].z; v.heading = snap.vh[i].heading; v.speed = snap.vh[i].speed;
                    v.route = 0;
                }
            // Pebbles and kisses are brief: take the newest list straight, arc height from the flight progress.
            w.Projectiles.Clear();
            foreach (var pj in snap.pj)
                w.Projectiles.Add(new Projectile { kind = (ProjectileKind)pj.kind, x = pj.x, z = pj.z, left = 1 - pj.t, total = 1 });
            foreach (var e in snap.e)
            {
                var ge = Translate(e);
                if (ge == null) continue;
                w.Events.Add(ge);
                EventCounts[ge.type] = EventCounts.TryGetValue(ge.type, out var n) ? n + 1 : 1;
            }
            cards = snap.you.cards;
            CardsFor = snap.you.cardsFor;
            if (Me < snap.s.Length)
            {
                Away = snap.s[Me].Has(Protocol.AWAY);
                Frozen = snap.s[Me].Has(Protocol.FROZEN);
            }

            for (int id = 0; id < snap.s.Length && id < w.Snakes.Count; id++)
            {
                var s = w.Snakes[id];
                var row = snap.s[id];
                s.mass = row.mass;
                s.score = row.score;
                bool alive = row.Alive;
                if (!alive && s.alive) s.bodyCount = 0;
                s.alive = alive;
                s.slowed = row.Has(Protocol.SLOWED);
                s.dashing = row.Has(Protocol.DASHING);
                s.frozenFor = row.Has(Protocol.FROZEN) ? 1 : 0;
                s.respawnIn = row.respawnIn;
                s.immune = row.immune;
                s.SetMagic(row.magic);
                if (packedUpgrades[id] != row.upgrades)
                {
                    packedUpgrades[id] = row.upgrades;
                    Protocol.UnpackUpgrades(row.upgrades, levels);
                    s.SetUpgrades(levels);
                }
                s.helmetReady = row.Has(Protocol.HELMET_READY);
                s.highestTier = Math.Max(s.highestTier, s.Tier);
                if (snap.sx != null && id < snap.sx.Length)
                {
                    // London: the Crown Jewels held and the crown; what carries it (the server moves a rider) and the Red Arrows' trail.
                    var x = snap.sx[id];
                    s.jewels = x.jewels;
                    s.crowned = x.crowned;
                    var by = x.carrier == 1 ? Carrier.Eye : x.carrier == 2 ? Carrier.Boat : Carrier.None;
                    // The ride's clock is not sent: it started about now (the camera's crane shot runs from it).
                    if (by == Carrier.Eye && s.carried != Carrier.Eye) s.carriedUntil = snap.k + World.EYE_RIDE;
                    s.carried = by;
                    s.rwb = x.rwb;
                }
                // Popped back out of the tank somewhere new: start a fresh body there.
                if (s.alive && !wasAlive[id])
                {
                    s.PlaceAt(row.x, row.z, row.heading);
                    if (id == Me) ResetPrediction(row.x, row.z, row.heading);
                }
                wasAlive[id] = s.alive;
            }

            var mine = w.Me;
            mine.xp = snap.you.xp;
            mine.level = snap.you.level;
            mine.cards = Cards;
            mine.speedFactor = snap.you.speedFactor;
            if (!Live)
            {
                Live = true;
                renderTick = snap.k - DELAY_TICKS;
            }
            Reconcile(snap);
        }

        void ResetPrediction(float x, float z, float heading)
        {
            pending.Clear();
            shownX = ghost.x = x;
            shownZ = ghost.z = z;
            shownHeading = ghost.heading = heading;
        }

        /// <summary>Start from where the server says I was, then replay every thumb movement it has not seen yet.</summary>
        void Reconcile(Snapshot snap)
        {
            if (Me >= snap.s.Length) return;
            var row = snap.s[Me];
            var g = ghost;
            float wasX = g.x, wasZ = g.z;
            int drop = 0;
            while (drop < pending.Count && pending[drop].q <= snap.you.ack) drop++;
            pending.RemoveRange(0, drop);
            g.x = row.x;
            g.z = row.z;
            g.heading = row.heading;
            g.mass = row.mass;
            g.speedFactor = snap.you.speedFactor;
            g.speedMul = World.Me.speedMul;
            // Its wall memory belongs to the previous replay, not to this starting point; Steer must not act on it.
            g.touchingWall = false;
            // Its spells too: Dragon Wings and River Rider change how Move goes (over walls, down the river).
            g.SetMagic(row.magic);
            UpdateBlockers();
            foreach (var p in pending) Predict(p.input, false);
            if (World.Me.alive && pending.Count > 0)
            {
                LastPredictionError = Collide.Hypot(g.x - wasX, g.z - wasZ);
                MaxPredictionError = Math.Max(MaxPredictionError, LastPredictionError);
            }
            if (Collide.Hypot(g.x - shownX, g.z - shownZ) > SNAP_IF_OFF_BY)
            {
                if (World.Me.alive) HardResets++;
                ResetPrediction(g.x, g.z, g.heading);
            }
        }

        /// <summary>
        /// One tick of my predicted snake, as the server moves it (replica.ts predict): the solids (the parade's
        /// marchers dropped once I have been held against them long enough), then the wobbly bridge's push.
        /// `live` steps (not a replay) advance the parade-held clock.
        /// </summary>
        void Predict(SnakeInput input, bool live)
        {
            var g = ghost;
            g.Move(input, World.STEP, !World.Me.slowed, World.Stage, paradeHeld > SetPieces.PARADE_LET_THROUGH ? plainBlockers : blockers);
            var sp = World.Spots;
            if (sp == null || g.HasMagic(MagicId.Wings)) return;
            if (live)
            {
                float reach = g.Radius + SetPieces.MARCHER_R + 0.05f;
                bool pressed = false;
                for (int i = 0; i < World.MarcherCount; i++)
                {
                    var m = World.Marchers[i];
                    if ((g.x - m.x) * (g.x - m.x) + (g.z - m.z) * (g.z - m.z) < reach * reach) pressed = true;
                }
                paradeHeld = pressed ? paradeHeld + World.STEP : 0;
            }
            if (!g.swimming && sp.millennium.Contains(g.x, g.z)) g.x = SetPieces.Wobbled(sp.millennium, g.x, g.Radius, predTick, World.STEP);
        }

        /// <summary>
        /// The solids my predicted snake slides off: the rocks, each bus or cab as circles along its length (so my
        /// snake stops at a bus here as on the server, not inside it), and the parade; London's set pieces worked
        /// out from the tick (Tower Bridge's span is river while it is up). My snake runs DELAY_TICKS ahead.
        /// </summary>
        void UpdateBlockers()
        {
            var w = World;
            blockers.Clear();
            foreach (var c in w.SnakeSolids) blockers.Add(c);
            if (w.Spots != null)
            {
                predTick = w.Tick + DELAY_TICKS;
                w.ReplicaSetPieces(predTick);
            }
            foreach (var v in w.Vehicles)
            {
                if (v.route < 0) continue; // not placed yet
                var spec = v.Spec;
                float r = spec.width / 2;
                int n = Math.Max(2, (int)Math.Ceiling(spec.length / spec.width));
                float reach = spec.length / 2 - r;
                float cx = (float)Math.Cos(v.heading), cz = (float)Math.Sin(v.heading);
                for (int i = 0; i < n; i++)
                {
                    float f = -reach + 2 * reach * i / (n - 1);
                    blockers.Add(new Circle(v.x + cx * f, v.z + cz * f, r));
                }
            }
            plainBlockers.Clear();
            plainBlockers.AddRange(blockers);
            for (int i = 0; i < w.MarcherCount; i++) blockers.Add(new Circle(w.Marchers[i].x, w.Marchers[i].z, SetPieces.MARCHER_R));
        }

        // ------------------------------------------------------------------ blending

        static float Lerp(float a, float b, float t) => a + (b - a) * t;
        static float LerpAngle(float a, float b, float t) => a + Collide.WrapAngle(b - a) * t;
        static bool Jumped(float ax, float az, float bx, float bz) => Collide.Hypot(bx - ax, bz - az) > SNAP_IF_OFF_BY;

        void Blend(float dt, bool predictingMe)
        {
            if (snaps.Count == 0) return;
            var w = World;
            var newest = snaps[snaps.Count - 1];

            // Run the display clock at real speed, nudging it to stay DELAY_TICKS behind the newest news.
            double want = newest.k - DELAY_TICKS;
            renderTick += dt * 60;
            if (Math.Abs(renderTick - want) > 20) renderTick = want;
            else renderTick += (want - renderTick) * Math.Min(1, dt * 2);
            w.Tick = (int)Math.Floor(renderTick);

            var a = snaps[0];
            var b = snaps[0];
            foreach (var s in snaps)
            {
                if (s.k <= renderTick) a = s;
                b = s;
                if (s.k > renderTick) break;
            }
            float t = b.k > a.k ? (float)Math.Min(1, Math.Max(0, (renderTick - a.k) / (b.k - a.k))) : 1;

            for (int id = 0; id < w.Snakes.Count; id++)
            {
                var s = w.Snakes[id];
                if (!s.alive || (id == Me && predictingMe)) continue;
                if (id >= a.s.Length || id >= b.s.Length) continue;
                var ra = a.s[id];
                var rb = b.s[id];
                // Across a respawn the two rows are far apart: do not slide the snake across the playground.
                if (Jumped(ra.x, ra.z, rb.x, rb.z)) s.PlaceAt(rb.x, rb.z, rb.heading);
                else s.Follow(Lerp(ra.x, rb.x, t), Lerp(ra.z, rb.z, t), LerpAngle(ra.heading, rb.heading, t));
                // While I am not steering, keep the prediction parked on the server's newest word, so
                // there is nothing to catch up on, and no lurch, when control comes back.
                if (id == Me && Me < newest.s.Length) ResetPrediction(newest.s[Me].x, newest.s[Me].z, newest.s[Me].heading);
            }

            for (int i = 0; i < w.Animals.Count && i < a.a.Length && i < b.a.Length; i++)
            {
                var an = w.Animals[i];
                var ra = a.a[i];
                var rb = b.a[i];
                float u = Jumped(ra.x, ra.z, rb.x, rb.z) ? 1 : t;
                an.x = Lerp(ra.x, rb.x, u);
                an.z = Lerp(ra.z, rb.z, u);
                an.heading = LerpAngle(ra.heading, rb.heading, u);
                an.speed = rb.speed;
                an.travel = Lerp(ra.travel, rb.travel, u);
                an.dazed = rb.dazed;
                an.born = rb.born;
            }

            for (int i = 0; i < w.Predators.Count && i < a.pd.Length && i < b.pd.Length; i++)
            {
                var p = w.Predators[i];
                var ra = a.pd[i];
                var rb = b.pd[i];
                float u = Jumped(ra.x, ra.z, rb.x, rb.z) ? 1 : t;
                float px = p.x, pz = p.z;
                p.x = Lerp(ra.x, rb.x, u);
                p.z = Lerp(ra.z, rb.z, u);
                p.heading = LerpAngle(ra.heading, rb.heading, u);
                p.speed = rb.speed;
                p.state = rb.state; // London's lions and ravens: statue or awake, perched or out
                // The gait is not sent: walk it from the distance shown.
                if (u < 1) p.travel += Collide.Hypot(p.x - px, p.z - pz);
            }

            if (a.vh != null && b.vh != null)
                for (int i = 0; i < w.Vehicles.Count && i < a.vh.Length && i < b.vh.Length; i++)
                {
                    var v = w.Vehicles[i];
                    v.x = Lerp(a.vh[i].x, b.vh[i].x, t);
                    v.z = Lerp(a.vh[i].z, b.vh[i].z, t);
                    v.heading = LerpAngle(a.vh[i].heading, b.vh[i].heading, t);
                    v.speed = b.vh[i].speed;
                    v.route = 0; // two rows in: placed, so it may be drawn
                }

            for (int i = 0; i < w.Kids.Count && i < a.kd.Length && i < b.kd.Length; i++)
            {
                var k = w.Kids[i];
                var ra = a.kd[i];
                var rb = b.kd[i];
                float u = Jumped(ra.x, ra.z, rb.x, rb.z) ? 1 : t;
                float px = k.x, pz = k.z;
                k.x = Lerp(ra.x, rb.x, u);
                k.z = Lerp(ra.z, rb.z, u);
                k.heading = LerpAngle(ra.heading, rb.heading, u);
                k.speed = rb.speed;
                if (u < 1) k.travel += Collide.Hypot(k.x - px, k.z - pz);
            }

            for (int i = 0; i < w.Creatures.Count && i < a.cr.Length && i < b.cr.Length; i++)
            {
                var c = w.Creatures[i];
                var ra = a.cr[i];
                var rb = b.cr[i];
                float u = Jumped(ra.x, ra.z, rb.x, rb.z) ? 1 : t;
                c.x = Lerp(ra.x, rb.x, u);
                c.z = Lerp(ra.z, rb.z, u);
                c.heading = LerpAngle(ra.heading, rb.heading, u);
                c.speed = rb.speed;
                c.respawnIn = rb.present ? 0 : 1; // faded (gulped) creatures are not drawn
            }

            var co = w.Cooper;
            co.x = Lerp(a.c.x, b.c.x, t);
            co.z = Lerp(a.c.z, b.c.z, t);
            co.heading = LerpAngle(a.c.heading, b.c.heading, t);
            co.speed = b.c.speed;
            co.talking = b.c.talking;
        }

        // ------------------------------------------------------------------ events

        /// <summary>The server's event as the sim's own, so GameRoot's juice works unchanged. Null to skip.</summary>
        GameEvent Translate(NetEvent e)
        {
            var w = World;
            int who = e.Int("who", -1);
            var ge = new GameEvent { who = who, by = e.Int("by", -1), x = e.Float("x"), z = e.Float("z") };
            void AtSnake() { if (who >= 0 && who < w.Snakes.Count) { ge.x = w.Snakes[who].x; ge.z = w.Snakes[who].z; } }
            int Kind(string[] table) => Math.Max(0, e.Kind("kind", table));
            switch (e.type)
            {
                case "eat":
                    ge.type = EventType.Eat; ge.food = (FoodKind)Kind(Protocol.FOOD_KINDS);
                    ge.points = e.Float("points"); ge.golden = e.Bool("golden"); ge.toasted = e.Bool("toasted");
                    break;
                case "gulp": ge.type = EventType.Gulp; ge.animal = (AnimalKind)Kind(Protocol.ANIMAL_KINDS); ge.points = e.Float("points"); break;
                case "boop": ge.type = EventType.Boop; ge.animal = (AnimalKind)Kind(Protocol.ANIMAL_KINDS); break;
                case "ouch":
                    ge.type = EventType.Ouch; ge.hazard = (HazardKind)Kind(Protocol.HAZARD_KINDS);
                    ge.lost = e.Float("lost"); ge.broke = e.Bool("broke");
                    break;
                case "rock":
                {
                    // A broken rock dropped somewhere new: move it, and puff rubble where it was.
                    int i = e.Int("i", -1);
                    if (i < 0 || i >= w.Hazards.Count) return null;
                    var h = w.Hazards[i];
                    ge.type = EventType.Rock; ge.hazard = h.kind; ge.x = h.x; ge.z = h.z;
                    h.x = e.Float("x"); h.z = e.Float("z"); h.turn = e.Float("turn");
                    h.version++;
                    w.RefreshHazardCircles();
                    break;
                }
                case "pellet": ge.type = EventType.Pellet; ge.points = e.Float("points"); break;
                case "tier": ge.type = EventType.Tier; ge.tier = e.Int("tier", 0); AtSnake(); break;
                case "cards": ge.type = EventType.Cards; break;
                case "bonk":
                {
                    ge.type = EventType.Bonk;
                    var lost = new List<UpgradeId>();
                    var list = e.List("lost");
                    if (list != null) foreach (var o in list) if (o is string id && Protocol.TryUpgrade(id, out var u)) lost.Add(u);
                    ge.lostUpgrades = lost.ToArray();
                    break;
                }
                case "helmet": ge.type = EventType.Helmet; break;
                case "respawn": ge.type = EventType.Respawn; break;
                case "breath": ge.type = EventType.Breath; ge.heading = e.Float("heading"); ge.range = e.Float("range"); break;
                case "sneeze": ge.type = EventType.Sneeze; break;
                case "howl": ge.type = EventType.Howl; break;
                case "chomp": ge.type = EventType.Chomp; ge.predator = (PredatorKind)Kind(Protocol.PREDATOR_KINDS); ge.lost = e.Float("lost"); break;
                // ---- London (A2-A6)
                case "cry": ge.type = EventType.Cry; ge.animal = (AnimalKind)Kind(Protocol.ANIMAL_KINDS); break;
                case "steal":
                    ge.type = EventType.Steal; ge.animal = (AnimalKind)Kind(Protocol.ANIMAL_KINDS);
                    ge.food = (FoodKind)Math.Max(0, e.Kind("food", Protocol.FOOD_KINDS));
                    break;
                case "teatime": ge.type = EventType.TeaTime; break;
                case "roar": ge.type = EventType.Roar; ge.predator = PredatorKind.Lion; break;
                case "caw": ge.type = EventType.Caw; ge.predator = PredatorKind.Raven; break;
                case "ding": ge.type = EventType.Ding; ge.vehicle = (VehicleKind)Kind(Protocol.VEHICLE_KINDS); ge.honk = e.Bool("honk"); break;
                case "vbonk": ge.type = EventType.VBonk; ge.vehicle = (VehicleKind)Kind(Protocol.VEHICLE_KINDS); ge.lost = e.Float("lost"); break;
                case "splash": ge.type = EventType.Splash; break;
                case "whistle": ge.type = EventType.Whistle; break;
                case "guard": ge.type = EventType.Guard; break;
                case "guardSmile": ge.type = EventType.GuardSmile; break;
                case "photo": ge.type = EventType.Photo; break;
                case "boo": ge.type = EventType.Boo; break;
                case "rise": ge.type = EventType.Rise; break;
                case "land": ge.type = EventType.Land; break;
                case "ring": ge.type = EventType.Ring; ge.range = e.Float("r"); break;
                case "roared": ge.type = EventType.Roared; break;
                case "jewel": ge.type = EventType.Jewel; ge.k = e.Int("i", 0); ge.n = e.Int("n", 0); break;
                case "royal": ge.type = EventType.Royal; break;
                case "pearly": ge.type = EventType.Pearly; ge.tx = e.Float("tx"); ge.tz = e.Float("tz"); break;
                case "button": ge.type = EventType.ButtonEat; ge.points = e.Float("points"); break;
                case "bong": ge.type = EventType.Bong; ge.k = e.Int("k", 1); ge.n = e.Int("n", 1); break;
                case "launch": ge.type = EventType.Launch; break;
                case "ride":
                {
                    int c = Protocol.IndexOf(Protocol.CARRIERS, e.Str("by"));
                    ge.type = EventType.Ride; ge.by = -1; ge.carrier = c == 0 ? Carrier.Eye : c == 1 ? Carrier.Boat : Carrier.None; ge.on = e.Bool("on");
                    break;
                }
                case "warp": ge.type = EventType.Warp; ge.from = e.Int("from", 0); ge.to = e.Int("to", 0); break;
                case "wobble": ge.type = EventType.Wobble; break;
                case "arrows": ge.type = EventType.Arrows; break;
                case "treat": ge.type = EventType.Treat; break;
                case "power":
                    if (!Protocol.TryUpgrade(e.Str("kind"), out var power)) return null;
                    ge.type = EventType.Power; ge.power = power; ge.heading = e.Float("heading"); ge.range = e.Float("range");
                    break;
                case "hit": ge.type = EventType.Hit; ge.freeze = e.Str("kind") == "freeze"; break;
                case "say":
                {
                    ge.type = EventType.Say; ge.text = e.Str("text");
                    var g = w.Stage.Greeters;
                    ge.sami = g != null && g.Length >= 2 && Collide.Hypot(ge.x - g[0], ge.z - g[1]) < 1;
                    // London's talkers (the tour guide, the Beefeater) speak where they stand.
                    if (w.Stage.Chatters != null)
                        foreach (var c in w.Stage.Chatters)
                            if (Collide.Hypot(ge.x - c.x, ge.z - c.z) < 1) ge.speaker = c.id;
                    break;
                }
                case "lob": ge.type = EventType.Lob; ge.projectile = (ProjectileKind)Kind(Protocol.PROJECTILE_KINDS); break;
                case "pelt": ge.type = EventType.Pelt; ge.lost = e.Float("lost"); ge.projectile = e.Bool("chip") ? ProjectileKind.Chip : ProjectileKind.Pebble; break;
                case "kiss": ge.type = EventType.Kiss; ge.gem = e.Bool("gem"); break;
                case "magic":
                    ge.type = EventType.Magic; ge.creature = (CreatureKind)Kind(Protocol.CREATURE_KINDS); ge.gems = e.Int("gems", 0);
                    break;
                case "bump":
                {
                    string what = e.Str("what");
                    ge.type = what == "cooper" ? EventType.BumpCooper : what == "kid" ? EventType.BumpKid : what == "guard" ? EventType.BumpGuard : EventType.BumpWall;
                    AtSnake();
                    break;
                }
                default: return null;
            }
            return ge;
        }
    }
}
