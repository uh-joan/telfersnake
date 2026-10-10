using System;
using System.Collections.Generic;

namespace Telfer.Sim
{
    // ------------------------------------------------------------------ London's traffic (port of vehicles.ts)

    public enum VehicleKind { Bus, Cab }

    public struct VehicleSpec
    {
        /// <summary>Bumper to bumper, and side to side (metres).</summary>
        public float length, width;
        /// <summary>Top speed, gentle acceleration, and the braking it plans with (m/s, m/s²).</summary>
        public float cruise, accel, brake;
        /// <summary>Seconds it waits at each of its route's stops (cabs have none), and how far ahead it looks.</summary>
        public float dwell, look;
        /// <summary>A hard hit: this share of the victim's mass, capped, like a rock.</summary>
        public float bonkShare, bonkCap;
    }

    /// <summary>A road vehicles drive: a closed lane loop (x, z pairs) with stops at vertex indices.</summary>
    public sealed class Route
    {
        public string id;
        public float[] path;
        public int[] stops;
        public int Count => path.Length / 2;
    }

    /// <summary>So many vehicles of a kind on a route (by id).</summary>
    public struct Traffic
    {
        public VehicleKind kind;
        public string route;
        public int count;
        public Traffic(VehicleKind kind, string route, int count) { this.kind = kind; this.route = route; this.count = count; }
    }

    /// <summary>A route made ready for driving: its lane's cumulative lengths, stops and zebras as distances.</summary>
    public sealed class Lane
    {
        public Route route;
        public float[] cum;
        public float length;
        public float[] stops;
        /// <summary>Zebra crossings on this lane, as distances along it (sorted), and their centres (x, z pairs).</summary>
        public float[] zebras;
        public float[] zebraAt;
    }

    public sealed class Vehicle
    {
        public VehicleKind kind;
        /// <summary>Index into the stage's routes.</summary>
        public int route;
        /// <summary>Distance along the route's lane loop.</summary>
        public float s;
        public float x, z, heading, speed;
        /// <summary>Seconds left waiting at a stop, and the next stop (an index into the lane's stops).</summary>
        public float dwellFor;
        public int nextStop;
        /// <summary>Cooldown on its DING DING, and how long a snake has kept it waiting.</summary>
        public float dingIn, waitedFor;
        public VehicleSpec Spec => Vehicles.SPECS[(int)kind];
    }

    /// <summary>A body to steer round: a snake's head or one of its segments.</summary>
    public struct Walker
    {
        public float x, z, r;
    }

    /// <summary>
    /// Red double-decker buses and black cabs on fixed routes. A vehicle is a moving wall that follows its
    /// lane round and round, dwells at its stops, and brakes for any snake ahead of it (and always for one on
    /// a zebra crossing), with a DING DING! or a honk as a warning. No RNG at all: where every vehicle starts
    /// is a pure function of its route, so a stage without routes never meets any of this.
    /// </summary>
    public static class Vehicles
    {
        public static readonly VehicleSpec[] SPECS =
        {
            new VehicleSpec { length = 6, width = 2.2f, cruise = 4, accel = 1.5f, brake = 3, dwell = 3, look = 8, bonkShare = 0.12f, bonkCap = 15 },
            new VehicleSpec { length = 3.8f, width = 1.8f, cruise = 6, accel = 2.5f, brake = 4.5f, dwell = 0, look = 9, bonkShare = 0.08f, bonkCap = 10 },
        };

        /// <summary>Keep left: the lane's centre sits this far left of the road's centre line.</summary>
        public const float LANE = 1.25f;
        const int ARC_STEPS = 6;
        /// <summary>How far along a lane a zebra crossing is watched, and how far short of it a vehicle waits.</summary>
        public const float ZEBRA_WATCH = 14, ZEBRA_HALF = 1.2f;
        const float ZEBRA_STOP = 0.5f;
        const float DING_EVERY = 4, HONK_AFTER = 2.5f, CREEP_AFTER = 2, SPAN_WATCH = 30;
        public const float CREEP = 0.25f;

        /// <summary>
        /// Turn a road's centre line (x, z pairs) into a closed lane loop: out along the left-hand side, round
        /// the far end on a half-circle, back along the other side, round the start. A stop at centre-line
        /// vertex k becomes two stops (one each way).
        /// </summary>
        public static Route LaneLoop(string id, float[] center, int[] stopsAt, float lane = LANE)
        {
            int n = center.Length / 2;
            float CX(float[] p, int i) => p[i * 2];
            float CZ(float[] p, int i) => p[i * 2 + 1];
            void Left(float ax, float az, float bx, float bz, out float lx, out float lz)
            {
                float len = Collide.Hypot(bx - ax, bz - az);
                if (len == 0) len = 1;
                lx = (bz - az) / len; lz = -(bx - ax) / len;
            }
            var path = new List<float>();
            void Offset(float[] pts)
            {
                int m = pts.Length / 2;
                for (int i = 0; i < m; i++)
                {
                    float px = CX(pts, i), pz = CZ(pts, i);
                    bool hasA = i > 0, hasB = i + 1 < m;
                    float ax = 0, az = 0, bx = 0, bz = 0;
                    if (hasA) Left(CX(pts, i - 1), CZ(pts, i - 1), px, pz, out ax, out az);
                    if (hasB) Left(px, pz, CX(pts, i + 1), CZ(pts, i + 1), out bx, out bz);
                    if (!hasA || !hasB)
                    {
                        float mx = hasA ? ax : bx, mz = hasA ? az : bz;
                        path.Add(px + mx * lane); path.Add(pz + mz * lane);
                        continue;
                    }
                    float sx = ax + bx, sz = az + bz;
                    float ml = Collide.Hypot(sx, sz);
                    if (ml == 0) ml = 1;
                    sx /= ml; sz /= ml;
                    float k = lane / Math.Max(0.5f, sx * bx + sz * bz);
                    path.Add(px + sx * k); path.Add(pz + sz * k);
                }
            }
            void Turn(float cx, float cz, float from)
            {
                for (int i = 1; i < ARC_STEPS; i++)
                {
                    float t = from + (float)(Math.PI * i / ARC_STEPS);
                    path.Add(cx + (float)Math.Cos(t) * lane); path.Add(cz + (float)Math.Sin(t) * lane);
                }
            }
            var back = new float[center.Length];
            for (int i = 0; i < n; i++) { back[i * 2] = CX(center, n - 1 - i); back[i * 2 + 1] = CZ(center, n - 1 - i); }
            float endDir = (float)Math.Atan2(CZ(center, n - 1) - CZ(center, n - 2), CX(center, n - 1) - CX(center, n - 2));
            float startDir = (float)Math.Atan2(CZ(back, n - 1) - CZ(back, n - 2), CX(back, n - 1) - CX(back, n - 2));
            Offset(center);
            Turn(CX(center, n - 1), CZ(center, n - 1), endDir - (float)Math.PI / 2);
            Offset(back);
            Turn(CX(center, 0), CZ(center, 0), startDir - (float)Math.PI / 2);
            int returnFrom = n + ARC_STEPS - 1;
            var stops = new List<int>();
            foreach (int k in stopsAt) { stops.Add(k); stops.Add(returnFrom + (n - 1 - k)); }
            stops.Sort();
            return new Route { id = id, path = path.ToArray(), stops = stops.ToArray() };
        }

        /// <summary>Distance from (x, z) to the nearest point of a closed loop.</summary>
        public static float DistanceToLoop(float[] path, float x, float z)
        {
            float best = float.PositiveInfinity;
            int n = path.Length / 2;
            for (int i = 0; i < n; i++)
            {
                float ax = path[i * 2], az = path[i * 2 + 1];
                int j = (i + 1) % n;
                float dx = path[j * 2] - ax, dz = path[j * 2 + 1] - az;
                float len2 = dx * dx + dz * dz;
                float t = len2 > 0 ? Math.Min(1, Math.Max(0, ((x - ax) * dx + (z - az) * dz) / len2)) : 0;
                best = Math.Min(best, Collide.Hypot(x - ax - dx * t, z - az - dz * t));
            }
            return best;
        }

        /// <summary>Ready a route for driving: lengths, stops, and which zebra crossings it runs over.</summary>
        public static Lane MakeLane(Route route, Zebra[] zebras)
        {
            var p = route.path;
            int n = route.Count;
            var cum = new float[n + 1];
            for (int i = 0; i < n; i++)
            {
                int j = (i + 1) % n;
                cum[i + 1] = cum[i] + Collide.Hypot(p[j * 2] - p[i * 2], p[j * 2 + 1] - p[i * 2 + 1]);
            }
            var stops = new float[route.stops.Length];
            for (int i = 0; i < stops.Length; i++) stops[i] = cum[route.stops[i]];
            var found = new List<(float s, float x, float z)>();
            foreach (var zb in zebras ?? new Zebra[0])
            {
                for (int i = 0; i < n; i++)
                {
                    float ax = p[i * 2], az = p[i * 2 + 1];
                    int j = (i + 1) % n;
                    float dx = p[j * 2] - ax, dz = p[j * 2 + 1] - az;
                    float len = Collide.Hypot(dx, dz);
                    if (len < 1e-6f || Math.Abs((dx * (float)Math.Cos(zb.angle) + dz * (float)Math.Sin(zb.angle)) / len) < 0.9f) continue;
                    float t = ((zb.x - ax) * dx + (zb.z - az) * dz) / (len * len);
                    if (t < 0 || t > 1) continue;
                    if (Collide.Hypot(zb.x - ax - dx * t, zb.z - az - dz * t) > LANE + 0.3f) continue;
                    found.Add((cum[i] + t * len, zb.x, zb.z));
                }
            }
            found.Sort((a, b) => a.s.CompareTo(b.s));
            var lane = new Lane { route = route, cum = cum, length = cum[n], stops = stops, zebras = new float[found.Count], zebraAt = new float[found.Count * 2] };
            for (int i = 0; i < found.Count; i++) { lane.zebras[i] = found[i].s; lane.zebraAt[i * 2] = found[i].x; lane.zebraAt[i * 2 + 1] = found[i].z; }
            return lane;
        }

        static float WrapS(float s, float length) => ((s % length) + length) % length;

        /// <summary>Where distance `s` along a lane is.</summary>
        public static void PointAt(Lane lane, float s, out float x, out float z)
        {
            var p = lane.route.path;
            int n = lane.route.Count;
            s = WrapS(s, lane.length);
            int lo = 0, hi = n - 1;
            while (lo < hi)
            {
                int mid = (lo + hi + 1) >> 1;
                if (lane.cum[mid] <= s) lo = mid; else hi = mid - 1;
            }
            int j = (lo + 1) % n;
            float seg = lane.cum[lo + 1] - lane.cum[lo];
            float t = seg > 0 ? (s - lane.cum[lo]) / seg : 0;
            x = p[lo * 2] + (p[j * 2] - p[lo * 2]) * t;
            z = p[lo * 2 + 1] + (p[j * 2 + 1] - p[lo * 2 + 1]) * t;
        }

        /// <summary>Put a vehicle at distance `s` along its lane, facing along it (the chord across ±1.2 m).</summary>
        public static void Place(Vehicle v, Lane lane, float s)
        {
            v.s = WrapS(s, lane.length);
            PointAt(lane, v.s, out v.x, out v.z);
            PointAt(lane, v.s + 1.2f, out float fx, out float fz);
            PointAt(lane, v.s - 1.2f, out float ax, out float az);
            v.heading = (float)Math.Atan2(fz - az, fx - ax);
        }

        /// <summary>The vehicles a stage's traffic list asks for, spread evenly round each route. No RNG.</summary>
        public static List<Vehicle> Make(Traffic[] traffic, Route[] routes, List<Lane> lanes)
        {
            var out_ = new List<Vehicle>();
            foreach (var t in traffic)
            {
                int r = Array.FindIndex(routes, o => o.id == t.route);
                if (r < 0) continue;
                var lane = lanes[r];
                for (int i = 0; i < t.count; i++)
                {
                    var v = new Vehicle { kind = t.kind, route = r, dingIn = i * 1.3f };
                    Place(v, lane, lane.length * (i + 0.25f) / t.count); // a quarter in: never two side by side on an out-and-back line
                    v.nextStop = NextStopIndex(lane, v.s);
                    out_.Add(v);
                }
            }
            return out_;
        }

        static int NextStopIndex(Lane lane, float s)
        {
            int i = Array.FindIndex(lane.stops, d => d >= s);
            return i < 0 ? 0 : i;
        }

        /// <summary>Distance along the lane from `from` forward to `to` (0..length).</summary>
        public static float Ahead(Lane lane, float from, float to) => WrapS(to - from, lane.length);

        /// <summary>Where a point is in a vehicle's own frame: `f` forward of its centre, `l` to its left.</summary>
        public static void Local(float vx, float vz, float heading, float x, float z, out float f, out float l)
        {
            float c = (float)Math.Cos(heading), s = (float)Math.Sin(heading);
            float dx = x - vx, dz = z - vz;
            f = dx * c + dz * s;
            l = dx * s - dz * c;
        }

        /// <summary>Is any of the walkers on the zebra crossing at (ax, az)?</summary>
        public static bool ZebraBusy(float ax, float az, List<Walker> walkers, float halfWidth)
        {
            foreach (var w in walkers)
            {
                float reach = Math.Max(ZEBRA_HALF, halfWidth) + w.r;
                if (Math.Abs(w.x - ax) < reach && Math.Abs(w.z - az) < reach && Collide.Hypot(w.x - ax, w.z - az) < reach) return true;
            }
            return false;
        }

        /// <summary>The gap a vehicle has before the nearest occupied zebra crossing ahead of its front bumper, or +∞.</summary>
        public static float ZebraGap(Vehicle v, Lane lane, List<Walker> walkers, float roadHalf)
        {
            var spec = v.Spec;
            float front = v.s + spec.length / 2;
            float best = float.PositiveInfinity;
            for (int i = 0; i < lane.zebras.Length; i++)
            {
                float d = Ahead(lane, front, lane.zebras[i] - ZEBRA_HALF - ZEBRA_STOP);
                if (d > ZEBRA_WATCH || d >= best) continue;
                if (ZebraBusy(lane.zebraAt[i * 2], lane.zebraAt[i * 2 + 1], walkers, roadHalf)) best = d;
            }
            return best;
        }

        /// <summary>
        /// One tick for one vehicle: pick a target speed from what is ahead (a stop, the vehicle in front, a
        /// snake in the lane, a busy zebra), then roll forward, never further than the nearest obstacle.
        /// `ding(v, honk)` is its warning. `stopLines`: Tower Bridge shut (set pieces, later).
        /// </summary>
        public static void Drive(Vehicle v, Lane lane, List<Vehicle> others, List<Walker> walkers, float dt, Action<Vehicle, bool> ding, float[] stopLines = null)
        {
            var spec = v.Spec;
            v.dingIn -= dt;
            float gap = float.PositiveInfinity;

            if (stopLines != null)
            {
                float front = v.s + spec.length / 2;
                foreach (var line in stopLines)
                {
                    float d = Ahead(lane, front, line);
                    if (d < SPAN_WATCH) gap = Math.Min(gap, d);
                }
            }

            // A stop: pull up exactly at it, wait, then set off for the next one.
            if (spec.dwell > 0 && lane.stops.Length > 0)
            {
                if (v.dwellFor > 0)
                {
                    v.dwellFor -= dt;
                    gap = 0;
                    if (v.dwellFor <= 0) v.nextStop = (v.nextStop + 1) % lane.stops.Length;
                }
                else
                {
                    float d = Ahead(lane, v.s, lane.stops[v.nextStop]);
                    if (d < 0.05f || d > lane.length - 0.05f) { v.dwellFor = spec.dwell; gap = 0; }
                    else gap = d;
                }
            }

            // The vehicle in front, on the same lane: keep a car's length.
            foreach (var o in others)
            {
                if (o == v || o.route != v.route) continue;
                float d = Ahead(lane, v.s, o.s) - (spec.length + o.Spec.length) / 2 - 1.5f;
                if (d < gap) gap = Math.Max(0, d);
            }

            // A snake ahead in the lane (head or any body segment).
            float snakeGap = float.PositiveInfinity;
            float half = spec.width / 2;
            foreach (var w in walkers)
            {
                Local(v.x, v.z, v.heading, w.x, w.z, out float lf, out float ll);
                float f = lf - spec.length / 2;
                if (f < -0.3f || f > spec.look || Math.Abs(ll) > half + w.r + 0.3f) continue;
                snakeGap = Math.Min(snakeGap, Math.Max(0, f - w.r - 0.5f));
            }
            // And a zebra crossing with anyone on it: always stop short of it.
            float zg = ZebraGap(v, lane, walkers, 2);
            float blocked = Math.Min(snakeGap, zg);
            // Kept waiting by a snake in the lane (not on a zebra, not by a stop or the vehicle in front): inch on and nudge it.
            bool creep = float.IsPositiveInfinity(zg) && snakeGap < gap && v.waitedFor > CREEP_AFTER;
            if (blocked < gap && !creep) gap = blocked;

            if (blocked < float.PositiveInfinity)
            {
                if (v.speed <= CREEP) v.waitedFor += dt;
                if (v.dingIn <= 0)
                {
                    v.dingIn = DING_EVERY;
                    ding(v, v.kind == VehicleKind.Cab || v.waitedFor > HONK_AFTER);
                }
            }
            else v.waitedFor = 0;

            // Plan to stop at the gap; brake at once if that is closer than planned, never roll past it.
            float plan = (float)Math.Sqrt(2 * spec.brake * Math.Max(0, gap));
            float want = creep ? Math.Min(CREEP, plan) : Math.Min(spec.cruise, plan);
            v.speed = Math.Min(want, v.speed + spec.accel * dt);
            if (gap < 0.05f && v.speed < 0.1f) v.speed = 0; // pulled up: stop dead rather than creep the last millimetres
            float step = Math.Min(v.speed * dt, Math.Max(0, gap));
            if (step <= 0) v.speed = 0;
            Place(v, lane, v.s + step);
        }
    }
}
