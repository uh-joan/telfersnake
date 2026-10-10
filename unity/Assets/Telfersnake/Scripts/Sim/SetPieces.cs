using System;
using System.Collections.Generic;

namespace Telfer.Sim
{
    /// <summary>A river-bus pier: where the boat ties up on the river, the dry spot you board from, and which way you face stepping off.</summary>
    public struct Pier
    {
        public string id;
        public float atX, atZ, boardX, boardZ, @out;
    }

    /// <summary>Where London's set pieces happen (londonLayout.ts SET_PIECES).</summary>
    public sealed class SetPieceSpots
    {
        public float bigBenX, bigBenZ;
        public float eyeBoardX, eyeBoardZ, eyeExitX, eyeExitZ, eyeHeading;
        /// <summary>Tower Bridge's lifting span, and the stage's bridges with that span taken out.</summary>
        public Box span;
        public Box[] bridgesUp;
        public Box millennium;
        /// <summary>The parade's route, the river's centre line (x, z pairs).</summary>
        public float[] parade, river;
        public Pier[] piers;
        /// <summary>Red Arrows lines: (x0, z0, x1, z1) each.</summary>
        public float[][] arrows;
        /// <summary>Where fireworks burst (x, z pairs).</summary>
        public float[] fireworks;
    }

    public struct Marcher { public float x, z, heading; public bool band; }

    public struct Boat { public float x, z, heading; public int dock, next, leaveIn; }

    public struct Burst { public int tick, k; public float x, z; public bool finale; public uint colour; }

    public struct Arrows { public float x, z, heading, t, x0, z0; public int line; }

    public enum LiftPhase { Down, Bells, Rise, Open, Lower }

    public struct Lift { public LiftPhase phase; public float raise; public int at, cycle; }

    /// <summary>
    /// London's big set pieces (port of setPieces.ts): Big Ben striking the minute, Tower Bridge lifting for
    /// a tall ship, the Changing of the Guard, the river bus, the fireworks, the Red Arrows, the wobbly bridge.
    /// Every one is a pure function of the TICK (and a small per-room seed): no RNG, no state.
    /// </summary>
    public static class SetPieces
    {
        public const int TPS = 60;

        // ------------------------------------------------------------ paths (x, z pairs, open polylines)

        sealed class PathTable { public float[] cum; public float length; }
        static readonly Dictionary<float[], PathTable> tables = new Dictionary<float[], PathTable>();

        static PathTable Table(float[] path)
        {
            if (tables.TryGetValue(path, out var t)) return t;
            int n = path.Length / 2;
            var cum = new float[n];
            for (int i = 1; i < n; i++) cum[i] = cum[i - 1] + Collide.Hypot(path[i * 2] - path[i * 2 - 2], path[i * 2 + 1] - path[i * 2 - 1]);
            return tables[path] = new PathTable { cum = cum, length = cum[n - 1] };
        }

        public static float PathLength(float[] path) => Table(path).length;

        /// <summary>A point `s` metres along an open polyline (clamped), with the direction it runs there.</summary>
        public static void AlongPath(float[] path, float s, out float x, out float z, out float heading)
        {
            var t = Table(path);
            int n = path.Length / 2;
            s = Math.Min(t.length, Math.Max(0, s));
            int i = 0;
            while (i < n - 2 && t.cum[i + 1] < s) i++;
            float ax = path[i * 2], az = path[i * 2 + 1], bx = path[i * 2 + 2], bz = path[i * 2 + 3];
            float seg = t.cum[i + 1] - t.cum[i];
            float u = seg > 0 ? (s - t.cum[i]) / seg : 0;
            x = ax + (bx - ax) * u; z = az + (bz - az) * u;
            heading = (float)Math.Atan2(bz - az, bx - ax);
        }

        /// <summary>How far along a polyline its nearest point to (x, z) lies.</summary>
        public static float ProjectOnPath(float[] path, float x, float z)
        {
            var t = Table(path);
            float best = float.PositiveInfinity, at = 0;
            for (int i = 0; i + 1 < path.Length / 2; i++)
            {
                float ax = path[i * 2], az = path[i * 2 + 1], dx = path[i * 2 + 2] - ax, dz = path[i * 2 + 3] - az;
                float len2 = dx * dx + dz * dz;
                float u = len2 > 0 ? Math.Min(1, Math.Max(0, ((x - ax) * dx + (z - az) * dz) / len2)) : 0;
                float d = (x - ax - dx * u) * (x - ax - dx * u) + (z - az - dz * u) * (z - az - dz * u);
                if (d < best) { best = d; at = t.cum[i] + u * (float)Math.Sqrt(len2); }
            }
            return at;
        }

        static int Mod(int a, int n) => ((a % n) + n) % n;

        // ------------------------------------------------------------ Big Ben

        public const int MINUTE_TICKS = 60 * TPS, QUARTERS_TICKS = 7 * TPS, BONG_TICKS = 150;
        public static int BongsFor(int minute) => (minute - 1) % 12 + 1;

        /// <summary>The tick the quarters for this minute began, or -1 before the first minute.</summary>
        public static int ChimeStart(int tick) { int m = tick / MINUTE_TICKS; return m >= 1 ? m * MINUTE_TICKS : -1; }

        /// <summary>If a BONG rings on exactly this tick: which (k, 0-based) of how many (n).</summary>
        public static bool BongAt(int tick, out int k, out int n)
        {
            k = n = 0;
            int minute = tick / MINUTE_TICKS;
            if (minute < 1) return false;
            int off = tick - minute * MINUTE_TICKS - QUARTERS_TICKS;
            if (off < 0 || off % BONG_TICKS != 0) return false;
            k = off / BONG_TICKS;
            n = BongsFor(minute);
            return k < n;
        }

        // ------------------------------------------------------------ Tower Bridge

        public const int LIFT_FIRST = 40 * TPS, LIFT_EVERY = 90 * TPS, LIFT_BELLS = 4 * TPS, LIFT_RISE = 4 * TPS, LIFT_OPEN = 10 * TPS, LIFT_LOWER = 4 * TPS;
        const int LIFT_LEN = LIFT_BELLS + LIFT_RISE + LIFT_OPEN + LIFT_LOWER;

        static float Ease(float t) => t * t * (3 - 2 * t);

        public static Lift LiftAt(int tick)
        {
            var o = new Lift();
            int c = tick - LIFT_FIRST;
            o.cycle = c < 0 ? -1 : c / LIFT_EVERY;
            int p = c < 0 ? LIFT_LEN : Mod(c, LIFT_EVERY);
            o.at = p;
            if (p >= LIFT_LEN) { o.phase = LiftPhase.Down; o.raise = 0; }
            else if (p < LIFT_BELLS) { o.phase = LiftPhase.Bells; o.raise = 0; }
            else if (p < LIFT_BELLS + LIFT_RISE) { o.phase = LiftPhase.Rise; o.raise = Ease((p - LIFT_BELLS) / (float)LIFT_RISE); }
            else if (p < LIFT_BELLS + LIFT_RISE + LIFT_OPEN) { o.phase = LiftPhase.Open; o.raise = 1; }
            else { o.phase = LiftPhase.Lower; o.raise = Ease(1 - (p - LIFT_BELLS - LIFT_RISE - LIFT_OPEN) / (float)LIFT_LOWER); }
            return o;
        }

        /// <summary>Is the road across Tower Bridge broken (the bascules up at all)? Then the span is river.</summary>
        public static bool SpanOpen(int tick) { var p = LiftAt(tick).phase; return p == LiftPhase.Rise || p == LiftPhase.Open || p == LiftPhase.Lower; }
        /// <summary>Closed to traffic, from the first bell until it is down again.</summary>
        public static bool SpanClosed(int tick) => LiftAt(tick).phase != LiftPhase.Down;
        /// <summary>The very tick the bascules start to rise: whoever is on them is launched down the ramp.</summary>
        public static bool LiftRises(int tick) { var l = LiftAt(tick); return l.cycle >= 0 && l.at == LIFT_BELLS; }

        public static Box[] BridgesAt(SetPieceSpots spots, Box[] down, int tick) => SpanOpen(tick) ? spots.bridgesUp : down;

        const float SHIP_SPEED = 2.2f;
        const int SHIP_CROSS = LIFT_BELLS + LIFT_RISE + LIFT_OPEN / 2;

        /// <summary>The tall ship: sails down the river during a lift, under the bridge mid-way through the open.</summary>
        public static bool ShipAt(int tick, SetPieceSpots spots, out float x, out float z, out float heading)
        {
            x = z = heading = 0;
            var l = LiftAt(tick);
            if (l.phase == LiftPhase.Down) return false;
            float cross = ProjectOnPath(spots.river, spots.span.x, spots.span.z);
            AlongPath(spots.river, cross + (l.at - SHIP_CROSS) / (float)TPS * SHIP_SPEED, out x, out z, out heading);
            return true;
        }

        // ------------------------------------------------------------ the Changing of the Guard

        public const int PARADE_FIRST = 75 * TPS, PARADE_EVERY = 240 * TPS;
        public const float PARADE_SPEED = 1.4f, PARADE_GAP = 1.3f, PARADE_SIDE = 1.2f, MARCHER_R = 0.45f, PARADE_LET_THROUGH = 1.5f;
        public const int PARADE_BAND = 4, PARADE_GUARDS = 10, PARADE_SIZE = PARADE_BAND + PARADE_GUARDS;

        static float ParadeLength(float[] path) => 2 * PathLength(path) + (float)Math.PI * PARADE_SIDE;
        public static int ParadeTicks(float[] path) => (int)Math.Ceiling((ParadeLength(path) + (PARADE_SIZE - 1) * PARADE_GAP) / PARADE_SPEED * TPS);

        /// <summary>Ticks into the current parade, or -1 when none is marching.</summary>
        public static int ParadeClock(int tick, float[] path)
        {
            int c = tick - PARADE_FIRST;
            if (c < 0) return -1;
            int p = Mod(c, PARADE_EVERY);
            return p < ParadeTicks(path) ? p : -1;
        }

        static void ParadePoint(float[] path, float u, out float x, out float z, out float heading)
        {
            float L = PathLength(path), S = PARADE_SIDE;
            if (u <= L)
            {
                AlongPath(path, u, out float px, out float pz, out float h);
                float nx = -(float)Math.Sin(h), nz = (float)Math.Cos(h);
                x = px - nx * S; z = pz - nz * S; heading = h;
                return;
            }
            float turn = (float)Math.PI * S;
            if (u <= L + turn)
            {
                AlongPath(path, L, out float px, out float pz, out float h);
                float tx = (float)Math.Cos(h), tz = (float)Math.Sin(h), nx = -tz, nz = tx;
                float th = (u - L) / S;
                float c = (float)Math.Cos(th), sn = (float)Math.Sin(th);
                x = px + S * (-nx * c + tx * sn);
                z = pz + S * (-nz * c + tz * sn);
                heading = (float)Math.Atan2(nz * sn + tz * c, nx * sn + tx * c);
                return;
            }
            AlongPath(path, L - (u - L - turn), out float qx, out float qz, out float qh);
            x = qx - (float)Math.Sin(qh) * S; z = qz + (float)Math.Cos(qh) * S; heading = qh + (float)Math.PI;
        }

        /// <summary>The marchers out on the Mall at this tick, written into `out` (grown as needed): how many.</summary>
        public static int ParadeAt(int tick, float[] path, List<Marcher> out_)
        {
            int p = ParadeClock(tick, path);
            if (p < 0) return 0;
            float lead = p / (float)TPS * PARADE_SPEED, total = ParadeLength(path);
            int n = 0;
            for (int i = 0; i < PARADE_SIZE; i++)
            {
                float u = lead - i * PARADE_GAP;
                if (u < 0 || u > total) continue;
                ParadePoint(path, u, out float x, out float z, out float h);
                var m = new Marcher { x = x, z = z, heading = h, band = i < PARADE_BAND };
                if (n < out_.Count) out_[n] = m; else out_.Add(m);
                n++;
            }
            return n;
        }

        public const int CONFETTI_EVERY = 2 * TPS;

        /// <summary>Confetti drops behind the column every CONFETTI_EVERY ticks (false while the tail is still inside, or none is due).</summary>
        public static bool ConfettiAt(int tick, float[] path, out float x, out float z)
        {
            x = z = 0;
            int p = ParadeClock(tick, path);
            if (p < 0 || p % CONFETTI_EVERY != CONFETTI_EVERY / 2) return false;
            float tail = p / (float)TPS * PARADE_SPEED - (PARADE_SIZE - 1) * PARADE_GAP - 1.6f;
            if (tail < 0 || tail > ParadeLength(path)) return false;
            ParadePoint(path, tail, out x, out z, out _);
            return true;
        }

        // ------------------------------------------------------------ the river bus

        public const float BOAT_SPEED = 3;
        public const int BOAT_DOCK = 6 * TPS;
        static readonly int[] ROUND = { 0, 1, 2, 1 };

        sealed class Leg { public int from, to, sail; public float s0, s1; }
        sealed class Timetable { public Leg[] legs; public int round; }
        static readonly Dictionary<SetPieceSpots, Timetable> timetables = new Dictionary<SetPieceSpots, Timetable>();

        static Timetable TimetableOf(SetPieceSpots spots)
        {
            if (timetables.TryGetValue(spots, out var t)) return t;
            var legs = new Leg[ROUND.Length];
            int round = 0;
            for (int i = 0; i < ROUND.Length; i++)
            {
                int from = ROUND[i], to = ROUND[(i + 1) % ROUND.Length];
                float s0 = ProjectOnPath(spots.river, spots.piers[from].atX, spots.piers[from].atZ);
                float s1 = ProjectOnPath(spots.river, spots.piers[to].atX, spots.piers[to].atZ);
                legs[i] = new Leg { from = from, to = to, s0 = s0, s1 = s1, sail = (int)Math.Ceiling(Math.Abs(s1 - s0) / BOAT_SPEED * TPS) };
                round += BOAT_DOCK + legs[i].sail;
            }
            return timetables[spots] = new Timetable { legs = legs, round = round };
        }

        public static Boat BoatAt(int tick, SetPieceSpots spots)
        {
            var tt = TimetableOf(spots);
            int p = Mod(tick, tt.round);
            var o = new Boat();
            foreach (var leg in tt.legs)
            {
                if (p < BOAT_DOCK)
                {
                    AlongPath(spots.river, leg.s0, out o.x, out o.z, out float h);
                    o.heading = leg.s1 >= leg.s0 ? h : h + (float)Math.PI;
                    o.dock = leg.from; o.next = leg.to; o.leaveIn = BOAT_DOCK - p;
                    return o;
                }
                p -= BOAT_DOCK;
                if (p < leg.sail)
                {
                    float k = p / (float)leg.sail;
                    AlongPath(spots.river, leg.s0 + (leg.s1 - leg.s0) * k, out o.x, out o.z, out float h);
                    o.heading = leg.s1 >= leg.s0 ? h : h + (float)Math.PI;
                    o.dock = -1; o.next = leg.to; o.leaveIn = 0;
                    return o;
                }
                p -= leg.sail;
            }
            return o;
        }

        // ------------------------------------------------------------ fireworks

        public const int FIREWORKS_EVERY = 300 * TPS, FIREWORKS_FOR = 30 * TPS, BURST_EVERY = 90, FINALE_BURSTS = 3;
        const int BURSTS = FIREWORKS_FOR / BURST_EVERY;
        static readonly uint[] BURST_COLOURS = { 0xff4d6d, 0xffd84a, 0x4dabf7, 0x8be36a, 0xff9f1c, 0xc77dff, 0xffffff };

        /// <summary>Ticks into the current show, or -1 when there is none.</summary>
        public static int FireworksClock(int tick)
        {
            int p = Mod(tick, FIREWORKS_EVERY) - (FIREWORKS_EVERY - FIREWORKS_FOR);
            return tick >= FIREWORKS_EVERY - FIREWORKS_FOR && p >= 0 ? p : -1;
        }

        /// <summary>The k-th burst of the show running at `tick` (false: no show, no such burst).</summary>
        public static bool BurstOf(int tick, int k, SetPieceSpots spots, int seed, out Burst b)
        {
            b = new Burst();
            int p = FireworksClock(tick);
            if (p < 0 || k < 0 || k >= BURSTS) return false;
            int show = tick / FIREWORKS_EVERY;
            int i = Mod(k * 7 + show * 3 + seed, spots.fireworks.Length / 2);
            b.tick = tick - p + k * BURST_EVERY + BURST_EVERY - 1;
            b.k = k;
            b.x = spots.fireworks[i * 2]; b.z = spots.fireworks[i * 2 + 1];
            b.finale = k >= BURSTS - FINALE_BURSTS;
            b.colour = BURST_COLOURS[Mod(k * 5 + show + seed, BURST_COLOURS.Length)];
            return true;
        }

        /// <summary>If a rocket bursts on exactly this tick: which.</summary>
        public static bool BurstAt(int tick, SetPieceSpots spots, int seed, out Burst b)
        {
            b = new Burst();
            int p = FireworksClock(tick);
            if (p < 0 || (p + 1) % BURST_EVERY != 0) return false;
            return BurstOf(tick, (p + 1) / BURST_EVERY - 1, spots, seed, out b);
        }

        // ------------------------------------------------------------ the Red Arrows

        public const int ARROWS_FIRST = 150 * TPS, ARROWS_EVERY = 360 * TPS, ARROWS_FOR = 8 * TPS;
        public const float ARROWS_REACH = 7;

        public static bool ArrowsAt(int tick, SetPieceSpots spots, int seed, out Arrows a)
        {
            a = new Arrows();
            int c = tick - ARROWS_FIRST;
            if (c < 0) return false;
            int p = Mod(c, ARROWS_EVERY);
            if (p >= ARROWS_FOR) return false;
            int pass = c / ARROWS_EVERY;
            a.line = Mod(pass + seed, spots.arrows.Length);
            var l = spots.arrows[a.line];
            a.t = p / (float)ARROWS_FOR;
            a.x0 = l[0]; a.z0 = l[1];
            a.x = l[0] + (l[2] - l[0]) * a.t;
            a.z = l[1] + (l[3] - l[1]) * a.t;
            a.heading = (float)Math.Atan2(l[3] - l[1], l[2] - l[0]);
            return true;
        }

        // ------------------------------------------------------------ the wobbly bridge

        public const float WOBBLE_SPEED = 0.45f;
        const float WOBBLE_PERIOD = 1.7f * TPS;
        public static float WobbleAt(int tick) => (float)Math.Sin(tick / WOBBLE_PERIOD * Math.PI * 2);

        /// <summary>Where a snake of radius `r` at `x` on the wobbly deck is pushed to over `dt` (never off the deck).</summary>
        public static float Wobbled(Box deck, float x, float r, int tick, float dt)
        {
            float nx = x + WOBBLE_SPEED * (0.6f + r) * WobbleAt(tick) * dt;
            return Math.Abs(nx - deck.x) <= deck.w / 2 - 0.4f ? nx : x;
        }

        /// <summary>A per-room flavour number from the room's seed, without drawing from its RNG.</summary>
        public static int SeedFor(uint seed) => (int)((unchecked((uint)((int)seed * unchecked((int)2654435761u))) >> 16) & 0xff);
    }
}
