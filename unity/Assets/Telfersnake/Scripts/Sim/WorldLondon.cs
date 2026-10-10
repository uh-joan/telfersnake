using System;

namespace Telfer.Sim
{
    /// <summary>
    /// London's dangers from world.ts (A3): the Trafalgar lions and the Tower's ravens, the buses and cabs,
    /// the puddles. None of it runs on a stage without lions, ravens, routes or puddles, so the school and
    /// the Common play exactly as before.
    /// </summary>
    public sealed partial class World
    {
        // ---------------------------------------------------------------- lions and ravens

        /// <summary>Out of sight of the beasts: hidden (Fox Trick). Flight and rides come with London's legends.</summary>
        bool Unseen(Snake s) => s.HasMagic(MagicId.Hidden);

        /// <summary>The nearest living snake head within `range` of (x, z) that a beast can see.</summary>
        Snake NearestVisible(float x, float z, float range)
        {
            Snake best = null;
            float bestD = range;
            foreach (var s in Snakes)
            {
                if (!s.alive || Unseen(s)) continue;
                float d = Collide.Hypot(s.x - x, s.z - z);
                if (d < bestD) { bestD = d; best = s; }
            }
            return best;
        }

        /// <summary>A London beast's capped, grace-protected bite: shrink like a rock, puff pellets. True if it landed.</summary>
        bool LondonBite(Predator p)
        {
            var spec = p.Spec;
            if (p.biteIn > 0) return false;
            bool raven = p.kind == PredatorKind.Raven;
            foreach (var s in Snakes)
            {
                if (!s.alive || s.immune > 0 || Unseen(s) || Collide.Hypot(s.x - p.x, s.z - p.z) > spec.biteReach + s.Radius) continue;
                s.immune = OUCH_GRACE;
                float lost = s.mass < 1 ? 0 : Math.Min(spec.biteCap, Math.Max(raven ? 1 : 2, s.mass * spec.biteShare * ferocity));
                if (lost > 0) Shed(s, lost, PELLET_RETURN, raven ? 2 : 4);
                Events.Add(new GameEvent { type = EventType.Chomp, predator = p.kind, who = s.id, x = s.x, z = s.z, lost = lost });
                p.biteIn = spec.biteEvery;
                return true;
            }
            return false;
        }

        /// <summary>Walk a beast `speed` m/s along its heading, on land, sliding along whatever it meets.</summary>
        void Walk(Predator p, float speed, float dt)
        {
            var hit = Collide.ResolveAshore(Stage, p.x, p.z, p.x + (float)Math.Cos(p.heading) * speed * dt, p.z + (float)Math.Sin(p.heading) * speed * dt, p.Spec.radius, ScratchHit, Stage.Logs);
            p.travel += Collide.Hypot(hit.x - p.x, hit.z - p.z);
            p.x = hit.x; p.z = hit.z;
            p.speed = speed;
            if (hit.hit) p.heading = Collide.SlideAlong(p.heading, hit.nx, hit.nz);
        }

        /// <summary>A Trafalgar lion: statue → yawn → prowl → home → climb → statue.</summary>
        void UpdateLion(Predator p, float dt)
        {
            var spec = p.Spec;
            float fer = ferocity;
            p.biteIn -= dt;
            if (p.stateFor > 0) p.stateFor -= dt;
            switch (p.state)
            {
                case Lion.Statue:
                {
                    p.speed = 0;
                    if (p.stateFor > 0) return; // still sleeping off the last prowl
                    var t = NearestVisible(p.hx, p.hz, Lion.WAKE);
                    if (t == null) return;
                    // One lion up at a time (two in God mode), and it is the sleeper nearest the snake that wakes.
                    int up = 0;
                    foreach (var o in Predators)
                    {
                        if (o.kind != PredatorKind.Lion || o == p) continue;
                        if (o.state != Lion.Statue) up++;
                        else if (o.stateFor <= 0 && Collide.Hypot(t.x - o.hx, t.z - o.hz) < Collide.Hypot(t.x - p.hx, t.z - p.hz)) return;
                    }
                    if (up >= (fer > 1 ? 2 : 1)) return;
                    p.state = Lion.Waking;
                    p.stateFor = Lion.WAKE_TIME;
                    p.heading = (float)Math.Atan2(p.wz - p.hz, p.wx - p.hx);
                    Events.Add(new GameEvent { type = EventType.Roar, predator = p.kind, x = p.x, z = p.z });
                    return;
                }
                case Lion.Waking:
                {
                    // A long stretch and a yawn on the plinth, then a hop down to the ground in front of it.
                    float k = 1 - Math.Min(1, Math.Max(0, p.stateFor / Lion.HOP_TIME));
                    p.x = p.hx + (p.wx - p.hx) * k;
                    p.z = p.hz + (p.wz - p.hz) * k;
                    p.speed = k > 0 && k < 1 ? 1 : 0;
                    if (p.stateFor <= 0)
                    {
                        p.state = Lion.Prowl;
                        p.stateFor = spec.chaseTime * fer;
                        p.x = p.wx; p.z = p.wz;
                    }
                    return;
                }
                case Lion.Climb:
                {
                    float k = 1 - Math.Min(1, Math.Max(0, p.stateFor / Lion.CLIMB_TIME));
                    p.x = p.wx + (p.hx - p.wx) * k;
                    p.z = p.wz + (p.hz - p.wz) * k;
                    p.speed = 0;
                    if (p.stateFor <= 0)
                    {
                        p.state = Lion.Statue;
                        p.stateFor = spec.restTime / fer;
                        p.x = p.hx; p.z = p.hz;
                        p.heading = (float)Math.Atan2(p.wz - p.hz, p.wx - p.hx);
                    }
                    return;
                }
                case Lion.Stone:
                    p.speed = 0;
                    if (p.stateFor <= 0) { p.state = Lion.Home; p.stateFor = Lion.HOME_GIVE_UP; }
                    return;
            }

            // Up and about (prowling, or plodding home). A frog's spell holds it; a scare sends it hurrying home.
            if (p.frozenFor > 0) { p.frozenFor -= dt; p.speed = 0; return; }
            if (p.scaredFor > 0) p.scaredFor -= dt;
            float fromHome = Collide.Hypot(p.x - p.wx, p.z - p.wz);
            if (p.state == Lion.Prowl)
            {
                var t = NearestVisible(p.x, p.z, spec.sight);
                if (t == null || p.stateFor <= 0 || fromHome > Lion.LEASH)
                {
                    p.state = Lion.Home; // tired, bored, or too far from the square
                    p.stateFor = Lion.HOME_GIVE_UP;
                }
                else
                {
                    p.heading = Collide.TurnToward(p.heading, (float)Math.Atan2(t.z - p.z, t.x - p.x), 4 * dt);
                    Walk(p, spec.chaseSpeed, dt);
                    if (LondonBite(p)) { p.state = Lion.Home; p.stateFor = Lion.HOME_GIVE_UP; } // one big lick, then it is ready for a nap
                    return;
                }
            }
            // Home: plod back to the foot of the plinth, then climb up.
            if (fromHome < 0.35f)
            {
                p.x = p.wx; p.z = p.wz;
                p.state = Lion.Climb;
                p.stateFor = Lion.CLIMB_TIME;
                p.speed = 0;
                return;
            }
            float pace = Math.Min(p.scaredFor > 0 ? spec.chaseSpeed * 1.2f : spec.roamSpeed, fromHome / dt);
            if (p.stateFor <= 0)
            {
                // Lost its way (never seen in checks): it pads straight home, ghosting past whatever is in the way.
                p.heading = (float)Math.Atan2(p.wz - p.z, p.wx - p.x);
                p.x += (float)Math.Cos(p.heading) * pace * dt;
                p.z += (float)Math.Sin(p.heading) * pace * dt;
                p.travel += pace * dt;
                p.speed = pace;
                return;
            }
            p.heading = Collide.TurnToward(p.heading, (float)Math.Atan2(p.wz - p.z, p.wx - p.x), (fromHome < 2 ? 10 : 4) * dt);
            Walk(p, pace, dt);
        }

        /// <summary>A Tower raven: perched → CAW! → swoop → back (the wolf, with wings: it flies over water and walls).</summary>
        void UpdateRaven(Predator p, float dt)
        {
            var spec = p.Spec;
            float fer = ferocity;
            p.biteIn -= dt;
            if (p.stateFor > 0) p.stateFor -= dt;
            if (p.frozenFor > 0) { p.frozenFor -= dt; p.speed = 0; return; } // rooted in mid-air by a Freeze Puff
            switch (p.state)
            {
                case Raven.Perched:
                {
                    p.speed = 0;
                    if (p.stateFor > 0) return;
                    var t = NearestVisible(p.hx, p.hz, spec.sight);
                    if (t == null) return;
                    p.state = Raven.Caw;
                    p.stateFor = Raven.CAW_TIME;
                    p.heading = (float)Math.Atan2(t.z - p.z, t.x - p.x);
                    Events.Add(new GameEvent { type = EventType.Caw, predator = p.kind, x = p.x, z = p.z });
                    return;
                }
                case Raven.Caw:
                    p.speed = 0;
                    if (p.stateFor <= 0) { p.state = Raven.Swoop; p.stateFor = spec.chaseTime; }
                    return;
                case Raven.Swoop:
                {
                    var t = NearestVisible(p.x, p.z, spec.sight * 1.5f);
                    if (t == null || p.stateFor <= 0 || Collide.Hypot(p.x - p.hx, p.z - p.hz) > Raven.LEASH) { p.state = Raven.Back; return; }
                    p.heading = Collide.TurnToward(p.heading, (float)Math.Atan2(t.z - p.z, t.x - p.x), 5 * dt);
                    Fly(p, spec.chaseSpeed * fer, dt);
                    if (LondonBite(p)) p.state = Raven.Back; // a peck, and off home
                    return;
                }
                case Raven.Back:
                {
                    float d = Collide.Hypot(p.hx - p.x, p.hz - p.z);
                    if (d <= spec.roamSpeed * dt + 0.05f)
                    {
                        p.x = p.hx; p.z = p.hz;
                        p.speed = 0;
                        p.state = Raven.Perched;
                        p.stateFor = spec.restTime / fer;
                        return;
                    }
                    float want = (float)Math.Atan2(p.hz - p.z, p.hx - p.x);
                    p.heading = d < 3 ? want : Collide.TurnToward(p.heading, want, 6 * dt);
                    Fly(p, spec.roamSpeed, dt);
                    return;
                }
            }
        }

        /// <summary>Fly a raven along its heading: over water, walls and all, but never off the map.</summary>
        void Fly(Predator p, float speed, float dt)
        {
            var B = Stage.Bounds;
            float r = p.Spec.radius;
            float ox = p.x, oz = p.z;
            p.x = Math.Min(B.maxX - r, Math.Max(B.minX + r, p.x + (float)Math.Cos(p.heading) * speed * dt));
            p.z = Math.Min(B.maxZ - r, Math.Max(B.minZ + r, p.z + (float)Math.Sin(p.heading) * speed * dt));
            p.travel += Collide.Hypot(p.x - ox, p.z - oz);
            p.speed = speed;
        }

        // ---------------------------------------------------------------- traffic

        bool OnARoute(float x, float z, float clear)
        {
            foreach (var r in Stage.Routes) if (Sim.Vehicles.DistanceToLoop(r.path, x, z) < clear) return true;
            return false;
        }

        void Ding(Vehicle v, bool honk) => Events.Add(new GameEvent { type = EventType.Ding, vehicle = v.kind, honk = honk, x = v.x, z = v.z });

        /// <summary>Every snake as circles (head and body) for the traffic to see, then drive each vehicle a tick.</summary>
        void UpdateVehicles(float dt)
        {
            walkers.Clear();
            foreach (var s in Snakes)
            {
                if (!s.alive) continue;
                float r = s.Radius;
                walkers.Add(new Walker { x = s.x, z = s.z, r = r });
                for (int i = 0; i < s.bodyCount; i++) walkers.Add(new Walker { x = s.body[i * 2], z = s.body[i * 2 + 1], r = r });
            }
            foreach (var v in Vehicles) Sim.Vehicles.Drive(v, Lanes[v.route], Vehicles, walkers, dt, Ding);
        }

        /// <summary>
        /// A snake against a bus or cab: it slides off the side like a wall, and if the vehicle was rolling
        /// toward it, it is bonked like a rock (a capped shrink and some pellets, then OUCH_GRACE).
        /// </summary>
        void MeetVehicles(Snake s, float dt)
        {
            float r = s.Radius;
            foreach (var v in Vehicles)
            {
                var spec = v.Spec;
                float hl = spec.length / 2 + r, hw = spec.width / 2 + r;
                if (Math.Abs(v.x - s.x) > hl + hw || Math.Abs(v.z - s.z) > hl + hw) continue;
                Sim.Vehicles.Local(v.x, v.z, v.heading, s.x, s.z, out float af, out float al);
                if (Math.Abs(af) >= hl || Math.Abs(al) >= hw) continue;
                // Out through the nearest face (front, back, left, right) that leaves it clear: a snake pinned
                // against a wall is squeezed out past the end instead of back into the bus.
                float c = (float)Math.Cos(v.heading), sn = (float)Math.Sin(v.heading);
                var ways = new[] { (hl - af, c, sn), (hl + af, -c, -sn), (hw - al, sn, -c), (hw + al, -sn, c) };
                Array.Sort(ways, (a, b) => a.Item1.CompareTo(b.Item1));
                float nx = ways[0].Item2, nz = ways[0].Item3, bx = 0, bz = 0;
                for (int k = 0; k < ways.Length; k++)
                {
                    var (push, wx, wz) = ways[k];
                    Collide.ResolveCircle(Stage, s.x + wx * (push + 0.02f), s.z + wz * (push + 0.02f), r, ScratchHit, snakeSolids);
                    if (k == 0) { bx = ScratchHit.x; bz = ScratchHit.z; }
                    Sim.Vehicles.Local(v.x, v.z, v.heading, ScratchHit.x, ScratchHit.z, out float of, out float ol);
                    if (Math.Abs(of) >= hl - 0.05f || Math.Abs(ol) >= hw - 0.05f)
                    {
                        bx = ScratchHit.x; bz = ScratchHit.z;
                        nx = wx; nz = wz;
                        break;
                    }
                }
                s.x = bx; s.z = bz;
                s.Deflect(nx, nz, dt);
                // Steer next tick as if against a wall, so asking to go the other way turns away from the bus.
                s.LeanOn(nx, nz);
                if (v.speed < VEHICLE_BONK_SPEED || s.immune > 0) continue;
                // Only a real collision bonks: the two closing on each other (not a corner brushing past).
                float sp = s.BaseSpeed * s.speedFactor;
                float closing = ((float)Math.Cos(s.heading) * sp - (float)Math.Cos(v.heading) * v.speed) * nx + ((float)Math.Sin(s.heading) * sp - (float)Math.Sin(v.heading) * v.speed) * nz;
                if (closing >= 0) continue;
                s.immune = OUCH_GRACE;
                float full = s.mass < 1 ? 0 : Math.Min(spec.bonkCap, Math.Max(1, s.mass * spec.bonkShare));
                float lost = full * (1 - s.rockGuard);
                if (lost > 0) Shed(s, lost, PELLET_RETURN, Math.Min(PELLET_MAX, Math.Max(1, (int)Math.Round(lost))));
                Events.Add(new GameEvent { type = EventType.VBonk, vehicle = v.kind, who = s.id, x = s.x, z = s.z, lost = lost });
            }
        }

        /// <summary>Is the snake sliding through a puddle? Says SPLASH as it goes in.</summary>
        bool Puddle(Snake s)
        {
            bool wet = false;
            foreach (var h in puddles)
                if ((s.x - h.x) * (s.x - h.x) + (s.z - h.z) * (s.z - h.z) < h.r * h.r) { wet = true; break; }
            inPuddle.TryGetValue(s.id, out bool was);
            if (wet && !was) Events.Add(new GameEvent { type = EventType.Splash, who = s.id, x = s.x, z = s.z });
            inPuddle[s.id] = wet;
            return wet;
        }
    }
}
