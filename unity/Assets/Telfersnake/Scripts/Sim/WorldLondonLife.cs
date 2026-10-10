using System;
using System.Collections.Generic;

namespace Telfer.Sim
{
    /// <summary>
    /// The rest of London from world.ts: its people (A4: the guard, the tour guide, the Beefeater, the living
    /// statue, tourists, the school trip, buskers), its legends (A5: the magics, flight, the Crown Jewels, the
    /// pearly trail) and its set pieces (A6: Big Ben, Tower Bridge, the Eye, the Tube, the parade, the river
    /// bus, the wobbly bridge, fireworks, the Red Arrows). Every branch sits behind a stage field only London
    /// sets, so the school and the Common never run any of it and draw no randomness for it.
    /// </summary>
    public sealed partial class World
    {
        // ---- A4
        const float TRIP_LET_THROUGH = 1.2f, TOURIST_ROAM = 5, TOURIST_KERB = 3.5f, STATUE_REACH = 3, STATUE_REST = 6;
        public const float BUSK_REACH = 5, BUSK_ZOOM = 1.2f, GUARD_REACH = 8, GUARD_COOL = 60;
        const int GUARD_LAPS = 3;
        const float GUARD_REVERSE = Collide.PI / 2;
        // ---- A5
        const float WINGS_FOR = 12, RIVER_FOR = 20, GIANT_FOR = 15, PHOENIX_FOR = 30, RIVER_ZOOM = 1.6f;
        public const float ROAR_REACH = 10;
        const float ROAR_PUSH = 2.5f, ROAR_STUN = 0.5f, RISE_GROWTH = 6, JEWEL_SCORE = 200, ROYAL_SCORE = 1000;
        public const int ROYAL_GEMS = 5;
        // ---- A6
        const int BONG_RING = 5, BONG_MINUTE = 15;
        const float LAUNCH_ZOOM = 1.8f, LAUNCH_FOR = 1.6f;
        public const int EYE_RIDE = 12 * 60;
        const float EYE_COOL = 40, EYE_GROWTH = 6, EYE_SCORE = 100, BOAT_COOL = 15, BOAT_GROWTH = 3, BOAT_SCORE = 60;
        public const float TUBE_REACH = 1.3f;
        const float TUBE_COOL = 8, TUBE_GRACE = 2, BORROW_CLEAR = 15, FINALE_REACH = 16;
        static readonly FoodKind[] CONFETTI = { FoodKind.JellyBaby, FoodKind.Biscuit, FoodKind.Strawberry, FoodKind.Scone };

        /// <summary>London's Crown Jewels and the pearly buttons leading to one (empty elsewhere).</summary>
        public readonly List<Treasure> Treasures;
        public readonly List<Button> Buttons = new List<Button>();
        /// <summary>The Changing of the Guard this tick (a pure function of the tick), and how many are out.</summary>
        public readonly List<Marcher> Marchers = new List<Marcher>();
        int marcherCount;
        public int MarcherCount => marcherCount;
        /// <summary>The set pieces' spots (null off London), the room's flavour, the stage's own bridges.</summary>
        readonly SetPieceSpots sp;
        public readonly int setPieceSeed;
        readonly Box[] bridgesDown;
        readonly List<float[]> spanStops = new List<float[]>();
        readonly List<Kid> buskers = new List<Kid>();
        readonly float tripTotal;
        readonly List<float> chatterIn = new List<float>();
        float statueRest;
        /// <summary>Per snake (by id): round the Royal Guard (angle swept, its peak, the last angle, the rest), held against the trip.</summary>
        readonly Dictionary<int, float> guardSwept = new Dictionary<int, float>(), guardPeak = new Dictionary<int, float>(), guardLast = new Dictionary<int, float>();
        public readonly Dictionary<int, float> guardCool = new Dictionary<int, float>();
        readonly Dictionary<int, float> tripHeld = new Dictionary<int, float>();
        readonly List<Circle> withParade = new List<Circle>();
        /// <summary>Per snake: held against the parade (s), Tube/Eye/boat cooldowns, the station its head was in, on the wobbly deck, the last show that paid it.</summary>
        readonly Dictionary<int, float> held = new Dictionary<int, float>(), tubeCool = new Dictionary<int, float>(), eyeCool = new Dictionary<int, float>(), boatCool = new Dictionary<int, float>();
        readonly Dictionary<int, int> tubeAt = new Dictionary<int, int>(), treatShow = new Dictionary<int, int>();
        readonly Dictionary<int, bool> wobbling = new Dictionary<int, bool>();
        int borrowAt;

        static float Get(Dictionary<int, float> d, int id) => d.TryGetValue(id, out float v) ? v : 0;

        // ================================================================ A4: London's people

        /// <summary>A tourist ambles round its sight and now and then stops and photographs a snake. CLICK!</summary>
        void UpdateTourist(Kid k, float dt)
        {
            float roam = Sim.Kids.ROAM[(int)KidKind.Tourist];
            if (k.pauseFor > 0) { k.pauseFor -= dt; k.speed = 0; }
            else
            {
                k.wanderIn -= dt;
                if (k.wanderIn <= 0 || Collide.Hypot(k.x - k.tx, k.z - k.tz) < 0.6f) WanderTourist(k);
                k.heading = Collide.TurnToward(k.heading, (float)Math.Atan2(k.tz - k.z, k.tx - k.x), 4 * dt);
                var hit = Collide.ResolveAshore(Stage, k.x, k.z, k.x + (float)Math.Cos(k.heading) * roam * dt, k.z + (float)Math.Sin(k.heading) * roam * dt, Sim.Kids.RADIUS, ScratchHit);
                k.travel += Collide.Hypot(hit.x - k.x, hit.z - k.z);
                k.x = hit.x; k.z = hit.z;
                k.speed = roam;
                if (hit.hit) WanderTourist(k);
            }
            if (k.throwIn > 0) return;
            var target = NearestSnake(k.x, k.z);
            if (target != null && !target.HasMagic(MagicId.Hidden) && Collide.Hypot(target.x - k.x, target.z - k.z) <= Sim.Kids.REACH[(int)KidKind.Tourist])
            {
                k.throwIn = Sim.Kids.THROW_EVERY[(int)KidKind.Tourist];
                k.heading = (float)Math.Atan2(target.z - k.z, target.x - k.x);
                k.pauseFor = 1.2f; // hold still for the shot
                k.speed = 0;
                Events.Add(new GameEvent { type = EventType.Photo, who = target.id, x = k.x, z = k.z });
            }
            else k.throwIn = 0.6f;
        }

        /// <summary>A fresh spot near the tourist's sight: dry, clear, and off the bus routes.</summary>
        void WanderTourist(Kid k)
        {
            k.wanderIn = Rng.Range(3, 7);
            if (Rng.Next() < 0.35f) k.pauseFor = Rng.Range(1, 3); // stop and gawp
            for (int tries = 0; tries < 20; tries++)
            {
                float x = k.hx + Rng.Range(-TOURIST_ROAM, TOURIST_ROAM), z = k.hz + Rng.Range(-TOURIST_ROAM, TOURIST_ROAM);
                if (!Collide.IsFree(Stage, x, z, Sim.Kids.RADIUS + 0.5f) || Water.In(Stage, x, z, 0.5f)) continue;
                if (Stage.Routes != null && OnARoute(x, z, TOURIST_KERB)) continue;
                k.tx = x; k.tz = z;
                return;
            }
            k.tx = k.hx; k.tz = k.hz;
        }

        /// <summary>The school-trip crocodile: the teacher walks the path; every child keeps exactly TRIP_GAP further back along it.</summary>
        void WalkTrip(Kid k, Kid leader, int place, float dt)
        {
            var path = Stage.TripPath;
            if (path == null || tripTotal <= 0) return;
            float roam = Sim.Kids.ROAM[(int)KidKind.Trip];
            float ox = k.x, oz = k.z;
            if (place == 0) k.along = (k.along + roam * dt) % tripTotal;
            else k.along = (leader.along - place * Sim.Kids.TRIP_GAP + tripTotal) % tripTotal;
            Sim.Kids.AlongLoop(path, tripTotal, k.along, out k.x, out k.z, out k.heading);
            k.travel += Collide.Hypot(k.x - ox, k.z - oz);
            k.speed = roam;
            int throws = place < Sim.Kids.TRIP_THROWS.Length ? Sim.Kids.TRIP_THROWS[place] : -1;
            if (throws < 0 || k.throwIn > 0) return;
            var target = NearestSnake(k.x, k.z);
            if (target != null && Collide.Hypot(target.x - k.x, target.z - k.z) <= Sim.Kids.REACH[(int)KidKind.Trip] && Projectiles.Count < 24)
            {
                k.throwIn = Sim.Kids.THROW_EVERY[(int)KidKind.Trip];
                Lob(k, target, (ProjectileKind)throws);
            }
            else k.throwIn = 0.6f;
        }

        /// <summary>Is this snake close enough to a busker to dance?</summary>
        bool Dancing(Snake s)
        {
            foreach (var b in buskers) if ((s.x - b.x) * (s.x - b.x) + (s.z - b.z) * (s.z - b.z) < BUSK_REACH * BUSK_REACH) return true;
            return false;
        }

        /// <summary>
        /// Round and round the Royal Guard: the angle a snake's head sweeps round him inside GUARD_REACH. Leaving
        /// the ring, a jump or doubling back starts again. Three full laps: his smile, a gem, then a rest.
        /// </summary>
        void LapGuard(Snake s, float dt)
        {
            var g = Stage.Guard;
            int id = s.id;
            if (!guardCool.ContainsKey(id)) { guardCool[id] = 0; guardSwept[id] = guardPeak[id] = 0; guardLast[id] = float.NaN; }
            if (guardCool[id] > 0) guardCool[id] -= dt;
            void Reset() { guardSwept[id] = guardPeak[id] = 0; guardLast[id] = float.NaN; }
            if (guardCool[id] > 0 || Collide.Hypot(s.x - g[0], s.z - g[1]) > GUARD_REACH) { Reset(); return; }
            float a = (float)Math.Atan2(s.z - g[1], s.x - g[0]);
            float last = guardLast[id];
            guardLast[id] = a;
            if (float.IsNaN(last)) return;
            float da = Collide.WrapAngle(a - last);
            if (Math.Abs(da) > Collide.PI / 2) { Reset(); return; } // a jump, not a slither
            float swept = guardSwept[id] += da;
            guardPeak[id] = Math.Max(guardPeak[id], Math.Abs(swept));
            if (guardPeak[id] - Math.Abs(swept) > GUARD_REVERSE) { Reset(); return; } // doubled back
            if (Math.Abs(swept) < GUARD_LAPS * Collide.PI * 2) return;
            Reset();
            guardCool[id] = GUARD_COOL;
            s.score += 100;
            Events.Add(new GameEvent { type = EventType.GuardSmile, who = id, x = g[0], z = g[1] }); // the whole room sees him smile
            Events.Add(new GameEvent { type = EventType.Guard, who = id, x = g[0], z = g[1] }); // only `who` gets the gem
        }

        /// <summary>The tour guide and the Beefeater: a line now and then, when someone is near to hear it.</summary>
        void ChatterLondon(float dt)
        {
            var chatters = Stage.Chatters;
            for (int i = 0; i < chatters.Length; i++)
            {
                chatterIn[i] -= dt;
                if (chatterIn[i] > 0) continue;
                var c = chatters[i];
                var near = NearestSnake(c.x, c.z);
                if (near == null || Collide.Hypot(near.x - c.x, near.z - c.z) > 16) { chatterIn[i] = 1; continue; } // nobody about
                chatterIn[i] = Rng.Range(7, 12);
                Events.Add(new GameEvent { type = EventType.Say, text = Rng.Pick(c.lines), x = c.x, z = c.z, speaker = c.id });
            }
        }

        /// <summary>The living statue: frozen, until a snake comes close. Then BOO! (and a rest before the next).</summary>
        void StatueTick(float dt)
        {
            var at = Stage.Statue;
            if (statueRest > 0) { statueRest -= dt; return; }
            var s = NearestSnake(at[0], at[1]);
            if (s == null || Collide.Hypot(s.x - at[0], s.z - at[1]) > STATUE_REACH + s.Radius) return;
            statueRest = STATUE_REST;
            Events.Add(new GameEvent { type = EventType.Boo, x = at[0], z = at[1] });
        }

        /// <summary>Seconds before this snake's guard laps count again (0: ready).</summary>
        public float GuardRest(int id) => Get(guardCool, id);

        // ================================================================ A5: London's legends

        /// <summary>Rise Again: if the phoenix is with this snake, it undoes the hit about to land. True if it did.</summary>
        bool Rise(Snake s)
        {
            if (!s.HasMagic(MagicId.Phoenix)) return false;
            s.ClearMagic(MagicId.Phoenix);
            s.immune = Math.Max(s.immune, OUCH_GRACE * 1.5f);
            s.Gain(RISE_GROWTH);
            Events.Add(new GameEvent { type = EventType.Rise, who = s.id, x = s.x, z = s.z });
            return true;
        }

        /// <summary>Could a landing snake of radius `r` come down at (x, z)? Free, dry, and clear of the traffic.</summary>
        bool Landable(float x, float z, float r)
        {
            if (!Collide.IsFree(Stage, x, z, r, snakeSolids)) return false;
            foreach (var v in Vehicles) if (Collide.Hypot(v.x - x, v.z - z) < v.Spec.length / 2 + r + 0.5f) return false;
            return true;
        }

        /// <summary>The nearest landable spot to (x0, z0), ring by ring outward, the way it faces first; the fallback otherwise.</summary>
        void Landing(float x0, float z0, float heading, float r, out float x, out float z)
        {
            x = x0; z = z0;
            if (Landable(x0, z0, r)) return;
            for (int ring = 1; ring <= 120; ring++)
            {
                float d = ring * 0.6f;
                int n = Math.Max(8, (int)Math.Ceiling(d * 5));
                for (int k = 0; k < n; k++)
                {
                    float a = heading + (k % 2 == 0 ? 1 : -1) * (float)Math.Ceiling(k / 2.0) * (Collide.PI * 2 / n);
                    float cx = x0 + (float)Math.Cos(a) * d, cz = z0 + (float)Math.Sin(a) * d;
                    if (!Landable(cx, cz, r)) continue;
                    x = cx; z = cz;
                    return;
                }
            }
            x = Stage.FallbackX; z = Stage.FallbackZ;
        }

        /// <summary>Dragon Wings wore off: down where it is if that is free, dry ground, else the nearest spot that is.</summary>
        void Land(Snake s)
        {
            Landing(s.x, s.z, s.heading, s.Radius + 0.3f, out float x, out float z);
            if (x != s.x || z != s.z) s.PlaceAt(x, z, s.heading);
            s.touchingWall = s.wasTouchingWall = false;
            s.immune = Math.Max(s.immune, 1);
            Events.Add(new GameEvent { type = EventType.Land, who = s.id, x = x, z = z });
        }

        /// <summary>Mighty Roar: beasts nearby run (lions home, ravens to the Tower); rivals are gently blown back.</summary>
        void Roar(Snake s)
        {
            s.GiveMagic(MagicId.Roar, 1.5f);
            Events.Add(new GameEvent { type = EventType.Ring, who = s.id, x = s.x, z = s.z, range = ROAR_REACH });
            ScarePredators(s.x, s.z, ROAR_REACH, false);
            foreach (var o in Snakes)
            {
                // Not the unseen (hidden, flying, riding), nor anyone choosing a card.
                if (o == s || !o.alive || Unseen(o) || o.cards != null) continue;
                float dx = o.x - s.x, dz = o.z - s.z, d = Collide.Hypot(dx, dz);
                if (d > ROAR_REACH) continue;
                float nx = d > 1e-5f ? dx / d : (float)Math.Cos(s.heading), nz = d > 1e-5f ? dz / d : (float)Math.Sin(s.heading);
                Collide.ResolveCircle(Stage, o.x + nx * ROAR_PUSH, o.z + nz * ROAR_PUSH, o.Radius, ScratchHit, snakeSolids);
                o.x = ScratchHit.x; o.z = ScratchHit.z;
                o.heading = (float)Math.Atan2(nz, nx);
                // A brief daze (frozen and untouchable, like a Freeze Puff): never a free bonk.
                o.frozenFor = Math.Max(o.frozenFor, ROAR_STUN);
                o.immune = Math.Max(o.immune, ROAR_STUN);
                Events.Add(new GameEvent { type = EventType.Roared, who = o.id, by = s.id, x = o.x, z = o.z });
            }
        }

        /// <summary>The Pearly Lights: a line of glowing buttons from the snake to the nearest jewel (or a golden cache).</summary>
        void PearlyTrail(Snake s)
        {
            float tx = float.NaN, tz = float.NaN, best = float.PositiveInfinity;
            foreach (var t in Treasures)
            {
                if (t.respawnIn > 0) continue;
                float d = Collide.Hypot(t.x - s.x, t.z - s.z);
                if (d < best) { best = d; tx = t.x; tz = t.z; }
            }
            if (float.IsNaN(tx))
            {
                // No jewel lying about: a cache of golden food a little way off, and the buttons lead there.
                for (int tries = 0; tries < 30; tries++)
                {
                    float a = Rng.Range(0, Collide.PI * 2), d = Rng.Range(14, 24);
                    float x = s.x + (float)Math.Cos(a) * d, z = s.z + (float)Math.Sin(a) * d;
                    if (!Collide.IsFree(Stage, x, z, 2)) continue;
                    tx = x; tz = z;
                    break;
                }
                if (float.IsNaN(tx)) return;
                CacheAt(tx, tz);
            }
            // One trail per snake: a fresh one replaces only this snake's own.
            for (int i = Buttons.Count - 1; i >= 0; i--) if (Buttons[i].owner == s.id) Buttons.RemoveAt(i);
            float dd = Collide.Hypot(tx - s.x, tz - s.z);
            int n = 0;
            for (float k = 2; k < dd - 1 && n < Sim.Treasures.BUTTON_MAX; k += Sim.Treasures.BUTTON_STEP, n++)
            {
                float x = s.x + (tx - s.x) * k / dd, z = s.z + (tz - s.z) * k / dd;
                if (Collide.IsFree(Stage, x, z, 0.3f, HazardCircles)) Buttons.Add(new Button { x = x, z = z, born = Tick, owner = s.id });
            }
            Events.Add(new GameEvent { type = EventType.Pearly, who = s.id, x = s.x, z = s.z, tx = tx, tz = tz });
        }

        void CacheAt(float x0, float z0)
        {
            int n = 0;
            foreach (var f in Foods)
            {
                if (n >= 6) break;
                float a = Rng.Range(0, Collide.PI * 2), r = Rng.Range(0.5f, 2.5f);
                float x = x0 + (float)Math.Cos(a) * r, z = z0 + (float)Math.Sin(a) * r;
                if (!Collide.IsFree(Stage, x, z, 0.5f, HazardCircles)) continue;
                f.x = x; f.z = z; f.golden = true; f.born = Tick;
                n++;
            }
        }

        void EatButtons(Snake s)
        {
            float reach2 = s.BiteReach * s.BiteReach;
            for (int i = Buttons.Count - 1; i >= 0; i--)
            {
                var b = Buttons[i];
                if ((b.x - s.x) * (b.x - s.x) + (b.z - s.z) * (b.z - s.z) > reach2) continue;
                float points = s.Gain(Sim.Treasures.BUTTON_MASS);
                Events.Add(new GameEvent { type = EventType.ButtonEat, who = s.id, x = b.x, z = b.z, points = points });
                Buttons.RemoveAt(i);
            }
        }

        void ExpireButtons()
        {
            for (int i = Buttons.Count - 1; i >= 0; i--)
                if ((Tick - Buttons[i].born) * STEP > Sim.Treasures.BUTTON_LIFE) Buttons.RemoveAt(i);
        }

        /// <summary>The Crown Jewels: a touch picks one up (any size); all five is ROYAL. A crowned snake leaves them for others.</summary>
        void MeetJewels(Snake s)
        {
            if (s.crowned) return;
            for (int i = 0; i < Treasures.Count; i++)
            {
                var t = Treasures[i];
                if (t.respawnIn > 0) continue;
                float reach = s.BiteReach + Sim.Treasures.REACH;
                if ((t.x - s.x) * (t.x - s.x) + (t.z - s.z) * (t.z - s.z) > reach * reach) continue;
                t.respawnIn = Sim.Treasures.RESPAWN;
                s.jewels++;
                s.score += JEWEL_SCORE;
                Events.Add(new GameEvent { type = EventType.Jewel, who = s.id, k = i, n = s.jewels, x = t.x, z = t.z });
                if (s.jewels >= Sim.Treasures.FOR_CROWN)
                {
                    s.crowned = true;
                    s.score += ROYAL_SCORE;
                    Events.Add(new GameEvent { type = EventType.Royal, who = s.id, x = s.x, z = s.z });
                }
                return; // one a tick
            }
        }

        void UpdateTreasures(float dt)
        {
            foreach (var t in Treasures)
            {
                if (t.respawnIn <= 0) continue;
                t.respawnIn -= dt;
                if (t.respawnIn <= 0) { t.respawnIn = 0; Sim.Treasures.Move(t, Treasures, Stage.JewelSpots, Rng); }
            }
        }

        // ================================================================ A6: London's set pieces

        /// <summary>Where a lane's vehicles must pull up while Tower Bridge is shut: just short of where it runs onto the span.</summary>
        static float[] SpanStopLines(Lane lane, Box span)
        {
            var out_ = new List<float>();
            bool On(float s)
            {
                Sim.Vehicles.PointAt(lane, s, out float x, out float z);
                return Math.Abs(x - span.x) < span.w / 2 + 1 && Math.Abs(z - span.z) < span.d / 2 + 1;
            }
            bool was = On(0);
            for (float s = 0.25f; s <= lane.length; s += 0.25f)
            {
                bool now = On(s);
                if (now && !was) out_.Add(s - 1);
                was = now;
            }
            return out_.ToArray();
        }

        /// <summary>The set pieces' tick: Tower Bridge's road, the parade's marchers, and whatever happens on this exact tick.</summary>
        void SetPiecesTick(SetPieceSpots p)
        {
            int t = Tick;
            Stage.Bridges = Sim.SetPieces.BridgesAt(p, bridgesDown, t);
            marcherCount = Sim.SetPieces.ParadeAt(t, p.parade, Marchers);
            withParade.Clear();
            if (marcherCount > 0)
            {
                withParade.AddRange(snakeSolids);
                for (int i = 0; i < marcherCount; i++) withParade.Add(new Circle(Marchers[i].x, Marchers[i].z, Sim.SetPieces.MARCHER_R));
            }
            if (Sim.SetPieces.LiftRises(t)) LiftSpan(p);
            if (Sim.SetPieces.BongAt(t, out int k, out int n)) Bong(p, k, n);
            if (Sim.SetPieces.ConfettiAt(t, p.parade, out float cx, out float cz)) ConfettiDrop(cx, cz, t);
            if (Sim.SetPieces.BurstAt(t, p, setPieceSeed, out var b)) Firework(p, b);
            if (Sim.SetPieces.ArrowsAt(t, p, setPieceSeed, out var a)) FlyPast(a);
        }

        /// <summary>Is the snake's head against (within `slack` of touching) one of the parade's marchers?</summary>
        bool ByMarcher(Snake s, float slack)
        {
            for (int i = 0; i < marcherCount; i++)
            {
                var m = Marchers[i];
                float reach = s.Radius + Sim.SetPieces.MARCHER_R + slack;
                if ((s.x - m.x) * (s.x - m.x) + (s.z - m.z) * (s.z - m.z) < reach * reach) return true;
            }
            return false;
        }

        /// <summary>Move some food, from well away from everyone, to (x, z): how the set pieces scatter treats. False if none was free.</summary>
        bool BorrowFood(float x, float z, bool golden, FoodKind? kind = null)
        {
            foreach (var o in Foods) if ((o.x - x) * (o.x - x) + (o.z - z) * (o.z - z) < 1) return false; // a treat already lies there
            int n = Foods.Count;
            for (int tries = 0; tries < n; tries++)
            {
                var f = Foods[borrowAt];
                borrowAt = (borrowAt + 1) % n;
                if (f.born >= Tick - 60 || !ClearOfSnakes(f.x, f.z, BORROW_CLEAR)) continue;
                f.x = x; f.z = z; f.golden = golden;
                if (kind.HasValue) f.kind = kind.Value;
                f.born = Tick;
                return true;
            }
            return false;
        }

        /// <summary>BONG! A ring of golden treats bursts out round Big Ben (wider each bong, turning a little each time).</summary>
        void Bong(SetPieceSpots p, int k, int n)
        {
            float r = 7 + k % 3 * 2;
            int ring = Math.Max(2, Math.Min(BONG_RING, (int)Math.Round(BONG_MINUTE / (double)n, MidpointRounding.AwayFromZero)));
            for (int i = 0; i < ring; i++)
            {
                float a = (float)i / ring * Collide.PI * 2 + k * 0.7f;
                float x = p.bigBenX + (float)Math.Cos(a) * r, z = p.bigBenZ + (float)Math.Sin(a) * r;
                if (Collide.IsFree(Stage, x, z, 0.6f, HazardCircles)) BorrowFood(x, z, true);
            }
            Events.Add(new GameEvent { type = EventType.Bong, k = k, n = n, x = p.bigBenX, z = p.bigBenZ });
        }

        /// <summary>The bascules start to rise: anyone on them slides down the ramp to the nearer end, WHEE!</summary>
        void LiftSpan(SetPieceSpots p)
        {
            var span = p.span;
            float End(float x, float out_) => x < span.x ? span.x - span.w / 2 - out_ : span.x + span.w / 2 + out_;
            // A cab still on it (held up crossing during the bells) is waved on across, first.
            foreach (var v in Vehicles)
            {
                float reach = v.Spec.length / 2 + 0.5f;
                for (int k = 0; k < 160 && Math.Abs(v.x - span.x) < span.w / 2 + reach && Math.Abs(v.z - span.z) < span.d / 2 + 0.5f; k++)
                    Sim.Vehicles.Place(v, Lanes[v.route], v.s + 0.25f);
            }
            // Never into the back of the one in front: anything now too close ahead is nudged on too.
            for (int pass = 0; pass < Vehicles.Count; pass++)
            {
                bool moved = false;
                foreach (var v in Vehicles)
                {
                    var lane = Lanes[v.route];
                    foreach (var o in Vehicles)
                    {
                        if (o == v || o.route != v.route) continue;
                        float gap = Sim.Vehicles.Ahead(lane, v.s, o.s) - (v.Spec.length + o.Spec.length) / 2 - 1;
                        if (gap >= 0 || Sim.Vehicles.Ahead(lane, v.s, o.s) > lane.length / 2) continue;
                        Sim.Vehicles.Place(o, lane, o.s - gap);
                        moved = true;
                    }
                }
                if (!moved) break;
            }
            foreach (var s in Snakes)
            {
                if (!s.alive || s.Carried || s.HasMagic(MagicId.Wings) || !span.Contains(s.x, s.z)) continue;
                float heading = s.x < span.x ? Collide.PI : 0;
                float z = Math.Min(span.z + span.d / 2 - 1.2f, Math.Max(span.z - span.d / 2 + 1.2f, s.z));
                Landing(End(s.x, 3.5f), z, heading, s.Radius + 0.3f, out float ax, out float az);
                s.PlaceAt(ax, az, heading);
                s.launchFor = LAUNCH_FOR;
                s.immune = Math.Max(s.immune, 1.5f);
                s.touchingWall = s.wasTouchingWall = false;
                Events.Add(new GameEvent { type = EventType.Launch, who = s.id, x = ax, z = az });
            }
            foreach (var a in Animals) if (span.Contains(a.x, a.z)) a.x = End(a.x, 1.5f);
            foreach (var c in Creatures) if (span.Contains(c.x, c.z)) c.x = End(c.x, 1.5f);
            foreach (var q in Predators) if (q.kind != PredatorKind.Raven && span.Contains(q.x, q.z)) q.x = End(q.x, 1.5f);
        }

        /// <summary>Sweets drop behind the parade, for whoever is following the band (only if someone is).</summary>
        void ConfettiDrop(float x, float z, int t)
        {
            if (ClearOfSnakes(x, z, 10) || !Collide.IsFree(Stage, x, z, 0.5f, HazardCircles)) return;
            BorrowFood(x, z, false, CONFETTI[t / 120 % CONFETTI.Length]);
        }

        /// <summary>A firework bursts over the river: a golden treat lands on the bank below; the finale's sparkles are gems.</summary>
        void Firework(SetPieceSpots p, Burst b)
        {
            Sim.SetPieces.AlongPath(p.river, Sim.SetPieces.ProjectOnPath(p.river, b.x, b.z), out _, out _, out float h);
            foreach (var side in b.k % 2 == 0 ? new[] { 1, -1 } : new[] { -1, 1 })
            {
                float x = b.x - (float)Math.Sin(h) * 9.5f * side, z = b.z + (float)Math.Cos(h) * 9.5f * side;
                if (Collide.IsFree(Stage, x, z, 0.6f, HazardCircles) && BorrowFood(x, z, true)) break;
            }
            if (!b.finale) return;
            // One finale gem per snake per show, and only for someone actually watching (not riding).
            int show = Tick / Sim.SetPieces.FIREWORKS_EVERY;
            foreach (var s in Snakes)
            {
                if (!s.alive || s.Carried || (treatShow.TryGetValue(s.id, out int was) && was == show)) continue;
                if (Collide.Hypot(s.x - b.x, s.z - b.z) >= FINALE_REACH) continue;
                treatShow[s.id] = show;
                Events.Add(new GameEvent { type = EventType.Treat, who = s.id, x = s.x, z = s.z });
            }
        }

        /// <summary>The Red Arrows overhead: whoever is under the lead jet's track gets the red, white and blue trail.</summary>
        void FlyPast(Arrows a)
        {
            foreach (var s in Snakes)
            {
                if (!s.alive || s.rwb || Collide.Hypot(s.x - a.x, s.z - a.z) > Sim.SetPieces.ARROWS_REACH) continue;
                s.rwb = true;
                Events.Add(new GameEvent { type = EventType.Arrows, who = s.id, x = s.x, z = s.z });
            }
        }

        /// <summary>A snake slithering about London's set pieces: the wobbly bridge, the Tube, the Eye, the river bus, the parade.</summary>
        void MeetSetPieces(Snake s, SetPieceSpots p, float dt)
        {
            int id = s.id;
            tubeCool[id] = Math.Max(0, Get(tubeCool, id) - dt);
            eyeCool[id] = Math.Max(0, Get(eyeCool, id) - dt);
            boatCool[id] = Math.Max(0, Get(boatCool, id) - dt);
            // Pressed against the parade: the clock toward being let through.
            held[id] = marcherCount > 0 && ByMarcher(s, 0.05f) ? Get(held, id) + dt : 0;

            // The Millennium Bridge sways: a lazy sideways push, a bit more for a bigger snake (never off the deck).
            var deck = p.millennium;
            bool on = !s.swimming && deck.Contains(s.x, s.z);
            if (on)
            {
                if (!(wobbling.TryGetValue(id, out bool w) && w)) Events.Add(new GameEvent { type = EventType.Wobble, who = id, x = s.x, z = s.z });
                s.x = Sim.SetPieces.Wobbled(deck, s.x, s.Radius, Tick, dt);
            }
            wobbling[id] = on;

            // The Tube: step into one station, out at the next. Arriving (or starting) in one, you must step out first.
            var ports = Stage.Portals;
            if (ports != null)
            {
                int inside = -1;
                for (int i = 0; i < ports.Length / 2 && inside < 0; i++) if (Collide.Hypot(s.x - ports[i * 2], s.z - ports[i * 2 + 1]) <= TUBE_REACH) inside = i;
                int was = tubeAt.TryGetValue(id, out int at) ? at : inside;
                tubeAt[id] = inside;
                if (inside >= 0 && inside != was && tubeCool[id] <= 0) { Warp(s, inside); return; }
            }

            // The London Eye: into the capsule at the bottom, any size (one capsule, one ride).
            if (eyeCool[id] <= 0 && Collide.Hypot(s.x - p.eyeBoardX, s.z - p.eyeBoardZ) < s.Radius + 0.9f)
            {
                s.carried = Carrier.Eye; s.carriedUntil = Tick + EYE_RIDE; s.carriedPier = -1;
                s.x = p.eyeBoardX; s.z = p.eyeBoardZ;
                s.immune = Math.Max(s.immune, 0.5f);
                Events.Add(new GameEvent { type = EventType.Ride, who = id, carrier = Carrier.Eye, on = true, x = p.eyeBoardX, z = p.eyeBoardZ });
                return;
            }

            // The river bus: on at a pier while it is tied up there (and not about to cast off).
            if (boatCool[id] <= 0)
            {
                var boat = Sim.SetPieces.BoatAt(Tick, p);
                if (boat.dock >= 0)
                {
                    var pier = p.piers[boat.dock];
                    if (boat.leaveIn >= 60 && Collide.Hypot(s.x - pier.boardX, s.z - pier.boardZ) < s.Radius + 1)
                    {
                        s.carried = Carrier.Boat; s.carriedUntil = -1; s.carriedPier = boat.next;
                        s.immune = Math.Max(s.immune, 0.5f);
                        Events.Add(new GameEvent { type = EventType.Ride, who = id, carrier = Carrier.Boat, on = true, x = pier.boardX, z = pier.boardZ });
                    }
                }
            }
        }

        /// <summary>Down the Tube at station `i`, up at the next one, facing the way its body lies free. "Mind the gap!"</summary>
        void Warp(Snake s, int i)
        {
            var ports = Stage.Portals;
            int j = (i + 1) % (ports.Length / 2);
            float tx = ports[j * 2], tz = ports[j * 2 + 1];
            s.PlaceAt(tx, tz, ExitHeading(tx, tz, s.Length));
            s.immune = Math.Max(s.immune, TUBE_GRACE);
            s.touchingWall = s.wasTouchingWall = false;
            tubeCool[s.id] = TUBE_COOL;
            tubeAt[s.id] = j;
            Events.Add(new GameEvent { type = EventType.Warp, who = s.id, from = i, to = j, x = tx, z = tz });
        }

        float ExitHeading(float x, float z, float length)
        {
            float best = 0;
            int fewest = int.MaxValue;
            for (int k = 0; k < 16 && fewest > 0; k++)
            {
                float heading = Collide.WrapAngle(k * Collide.PI / 8);
                int blocked = 0;
                for (float d = 1; d <= Math.Min(length, 20); d += 1)
                    if (!Collide.IsFree(Stage, x - (float)Math.Cos(heading) * d, z - (float)Math.Sin(heading) * d, 0.4f, HazardCircles)) blocked++;
                if (blocked < fewest) { fewest = blocked; best = heading; }
            }
            return best;
        }

        /// <summary>On a ride: the Eye holds you up in its capsule till the turn is done; the boat carries you to its next pier.</summary>
        void Carry(Snake s, SetPieceSpots p)
        {
            s.immune = Math.Max(s.immune, 0.5f);
            s.dashing = false;
            if (s.carried == Carrier.Eye)
            {
                if (Tick >= s.carriedUntil) Alight(s, p.eyeExitX, p.eyeExitZ, p.eyeHeading);
                return;
            }
            var boat = Sim.SetPieces.BoatAt(Tick, p);
            if (boat.dock == s.carriedPier)
            {
                var pier = p.piers[s.carriedPier];
                Alight(s, pier.boardX, pier.boardZ, pier.@out);
                return;
            }
            s.Follow(boat.x, boat.z, boat.heading);
        }

        /// <summary>Off the ride, onto free ground near (x, z), with a little bonus for the trip.</summary>
        void Alight(Snake s, float x, float z, float heading)
        {
            var by = s.carried;
            Landing(x, z, heading, s.Radius + 0.3f, out float ax, out float az);
            s.PlaceAt(ax, az, heading);
            s.carried = Carrier.None;
            s.immune = Math.Max(s.immune, 1.5f);
            s.touchingWall = s.wasTouchingWall = false;
            if (by == Carrier.Eye) { eyeCool[s.id] = EYE_COOL; s.Gain(EYE_GROWTH); s.score += EYE_SCORE; }
            else { boatCool[s.id] = BOAT_COOL; s.Gain(BOAT_GROWTH); s.score += BOAT_SCORE; }
            Events.Add(new GameEvent { type = EventType.Ride, who = s.id, carrier = by, on = false, x = ax, z = az });
        }

        /// <summary>The Eye's ride: how far round (0..1) a carried snake is, for the view's crane shot (-1 when not on it).</summary>
        public float EyeRide(Snake s) => s.carried == Carrier.Eye ? 1 - (s.carriedUntil - Tick) / (float)EYE_RIDE : -1;
    }
}
