using System;

namespace Telfer.Sim
{
    /// <summary>
    /// The rest of world.ts: the gem powers, and the Common's predators, children, fantastic creatures,
    /// magic and Miss Sami. All of it is a no-op on the school (no predators, kids or creatures there).
    /// </summary>
    public sealed partial class World
    {
        // ---------------------------------------------------------------- powers (gem-unlocked)

        void CastPowers(Snake s, float dt)
        {
            if (s.LevelOf(UpgradeId.Laser) > 0) FireLaser(s, dt);
            if (s.LevelOf(UpgradeId.Stink) > 0) FireStink(s, dt);
            if (s.LevelOf(UpgradeId.Zap) > 0) FireZap(s, dt);
            if (s.LevelOf(UpgradeId.Freeze) > 0) FireFreeze(s, dt);
        }

        void Power(Snake s, UpgradeId kind, float x, float z, float range) =>
            Events.Add(new GameEvent { type = EventType.Power, who = s.id, power = kind, x = x, z = z, heading = s.heading, range = range });

        /// <summary>Shrink a rival like a rock bonk and puff pellets; `by` is credited (for gems).</summary>
        void Scorch(Snake target, Snake by, float share, float cap)
        {
            target.immune = OUCH_GRACE;
            float lost = target.mass < 1 ? 0 : Math.Min(cap, Math.Max(2, target.mass * share));
            if (lost > 0) Shed(target, lost, PELLET_RETURN, 3);
            Events.Add(new GameEvent { type = EventType.Hit, who = target.id, by = by.id, x = target.x, z = target.z });
        }

        void FireLaser(Snake s, float dt)
        {
            s.laserIn -= dt;
            if (s.laserIn > 0) return;
            int lv = s.LevelOf(UpgradeId.Laser);
            float range = 8 + 1.5f * lv;
            Snake best = null;
            float bestD = float.MaxValue;
            foreach (var o in Snakes)
            {
                if (o == s || !o.alive || o.immune > 0) continue;
                float d = Collide.Hypot(o.x - s.x, o.z - s.z);
                if (d > range || d >= bestD) continue;
                if (Math.Abs(Collide.WrapAngle((float)Math.Atan2(o.z - s.z, o.x - s.x) - s.heading)) > LASER_HALF_ANGLE) continue;
                bestD = d; best = o;
            }
            float bx = s.x + (float)Math.Cos(s.heading) * range * 0.5f, bz = s.z + (float)Math.Sin(s.heading) * range * 0.5f;
            bool scares = PredatorsNear(bx, bz, range * 0.5f);
            if (best == null && !scares) { s.laserIn = 0.3f; return; }
            s.laserIn = Math.Max(0.8f, 2.4f - 0.25f * lv);
            Power(s, UpgradeId.Laser, s.x, s.z, range);
            if (best != null) Scorch(best, s, 0.09f, 8);
            if (scares) ScarePredators(bx, bz, range * 0.5f, false);
        }

        void FireStink(Snake s, float dt)
        {
            s.stinkIn -= dt;
            if (s.stinkIn > 0) return;
            int lv = s.LevelOf(UpgradeId.Stink);
            float radius = 2.5f + 0.5f * lv;
            float bx = s.x - (float)Math.Cos(s.heading) * radius * 0.6f, bz = s.z - (float)Math.Sin(s.heading) * radius * 0.6f;
            bool scares = PredatorsNear(bx, bz, radius);
            bool fired = scares;
            if (scares) Power(s, UpgradeId.Stink, bx, bz, radius);
            foreach (var o in Snakes)
            {
                if (o == s || !o.alive || o.immune > 0 || Collide.Hypot(o.x - bx, o.z - bz) > radius) continue;
                if (!fired) { fired = true; Power(s, UpgradeId.Stink, bx, bz, radius); }
                Scorch(o, s, 0.08f, 6);
            }
            if (scares) ScarePredators(bx, bz, radius, false);
            s.stinkIn = fired ? Math.Max(1.5f, 3 - 0.4f * lv) : 0.3f;
        }

        void FireZap(Snake s, float dt)
        {
            s.zapIn -= dt;
            if (s.zapIn > 0) return;
            int lv = s.LevelOf(UpgradeId.Zap);
            float radius = 2.5f + 0.4f * lv;
            bool scares = PredatorsNear(s.x, s.z, radius);
            bool fired = scares;
            if (scares) Power(s, UpgradeId.Zap, s.x, s.z, radius);
            foreach (var o in Snakes)
            {
                if (o == s || !o.alive || o.immune > 0 || Collide.Hypot(o.x - s.x, o.z - s.z) > radius) continue;
                if (!fired) { fired = true; Power(s, UpgradeId.Zap, s.x, s.z, radius); }
                Scorch(o, s, 0.08f, 6);
            }
            if (scares) ScarePredators(s.x, s.z, radius, false);
            s.zapIn = fired ? Math.Max(1.2f, 3.5f - 0.4f * lv) : 0.3f;
        }

        void FireFreeze(Snake s, float dt)
        {
            s.freezeIn -= dt;
            if (s.freezeIn > 0) return;
            int lv = s.LevelOf(UpgradeId.Freeze);
            float radius = 3 + 0.5f * lv;
            Snake best = null;
            float bestD = float.MaxValue;
            foreach (var o in Snakes)
            {
                if (o == s || !o.alive || o.immune > 0 || o.frozenFor > 0) continue;
                float d = Collide.Hypot(o.x - s.x, o.z - s.z);
                if (d <= radius && d < bestD) { bestD = d; best = o; }
            }
            bool scares = PredatorsNear(s.x, s.z, radius);
            if (best == null && !scares) { s.freezeIn = 0.3f; return; }
            s.freezeIn = Math.Max(2.5f, 5 - 0.5f * lv);
            if (best != null)
            {
                best.frozenFor = 0.8f + 0.4f * lv;
                best.immune = Math.Max(best.immune, best.frozenFor); // frozen and untouchable: not a free bonk
                Power(s, UpgradeId.Freeze, best.x, best.z, radius);
                Events.Add(new GameEvent { type = EventType.Hit, who = best.id, by = s.id, freeze = true, x = best.x, z = best.z });
            }
            else Power(s, UpgradeId.Freeze, s.x, s.z, radius);
            if (scares) ScarePredators(s.x, s.z, radius, true);
        }

        // ---------------------------------------------------------------- predators

        void UpdatePredators(float dt)
        {
            foreach (var p in Predators)
            {
                var spec = p.Spec;
                if (p.frozenFor > 0) { p.frozenFor -= dt; p.speed = 0; continue; }
                p.biteIn -= dt;
                p.wanderIn -= dt;

                Snake target = null;
                float bestD = spec.sight;
                foreach (var s in Snakes)
                {
                    if (!s.alive || s.HasMagic(MagicId.Hidden)) continue;
                    float d = Collide.Hypot(s.x - p.x, s.z - p.z);
                    if (d < bestD) { bestD = d; target = s; }
                }

                if (p.scaredFor > 0)
                {
                    p.scaredFor -= dt;
                    p.chargeFor = 0;
                    var flee = NearestSnake(p.x, p.z);
                    if (flee != null) p.heading = Collide.TurnToward(p.heading, (float)Math.Atan2(p.z - flee.z, p.x - flee.x), 6 * dt);
                    float dash = spec.chaseSpeed * 0.9f;
                    MovePredator(p, dash, dt, false);
                    continue;
                }

                if (p.kind == PredatorKind.Wolf)
                {
                    if (p.restFor > 0) { p.restFor -= dt; target = null; }
                    else if (p.chargeFor > 0)
                    {
                        p.chargeFor -= dt;
                        if (p.chargeFor <= 0) p.restFor = spec.restTime / ferocity;
                    }
                    else if (target != null)
                    {
                        p.chargeFor = spec.chaseTime;
                        Events.Add(new GameEvent { type = EventType.Howl, x = p.x, z = p.z, predator = p.kind });
                    }
                }

                bool chasing = target != null && (p.kind == PredatorKind.Bear || p.chargeFor > 0);
                float speed;
                if (chasing)
                {
                    p.heading = Collide.TurnToward(p.heading, (float)Math.Atan2(target.z - p.z, target.x - p.x), 4 * dt);
                    speed = spec.chaseSpeed * (p.kind == PredatorKind.Wolf ? ferocity : 1);
                }
                else
                {
                    if (p.wanderIn <= 0 || Collide.Hypot(p.x - p.wx, p.z - p.wz) < 1) WanderPredator(p);
                    p.heading = Collide.TurnToward(p.heading, (float)Math.Atan2(p.wz - p.z, p.wx - p.x), 3 * dt);
                    speed = spec.roamSpeed;
                }
                MovePredator(p, speed, dt, true);

                if (p.biteIn <= 0)
                {
                    foreach (var s in Snakes)
                    {
                        if (!s.alive || s.immune > 0 || s.HasMagic(MagicId.Hidden) || Collide.Hypot(s.x - p.x, s.z - p.z) > spec.biteReach + s.Radius) continue;
                        s.immune = OUCH_GRACE;
                        float lost = s.mass < 1 ? 0 : Math.Min(spec.biteCap, Math.Max(2, s.mass * spec.biteShare * ferocity));
                        if (lost > 0) Shed(s, lost, PELLET_RETURN, 4);
                        Events.Add(new GameEvent { type = EventType.Chomp, predator = p.kind, who = s.id, x = s.x, z = s.z, lost = lost });
                        p.biteIn = spec.biteEvery;
                        if (p.kind == PredatorKind.Wolf)
                        {
                            p.chargeFor = 0;
                            p.restFor = spec.restTime / ferocity; // a wolf snaps once, then slinks off
                        }
                        break;
                    }
                }
            }
        }

        void MovePredator(Predator p, float speed, float dt, bool rewander)
        {
            var hit = Collide.ResolveCircle(Stage, p.x + (float)Math.Cos(p.heading) * speed * dt, p.z + (float)Math.Sin(p.heading) * speed * dt, p.Spec.radius, ScratchHit, Stage.Logs);
            p.travel += Collide.Hypot(hit.x - p.x, hit.z - p.z);
            p.x = hit.x; p.z = hit.z;
            p.speed = speed;
            if (hit.hit)
            {
                p.heading = Collide.SlideAlong(p.heading, hit.nx, hit.nz);
                if (rewander) WanderPredator(p);
            }
        }

        void WanderPredator(Predator p)
        {
            var B = Stage.Bounds;
            for (int tries = 0; tries < 20; tries++)
            {
                float x = Rng.Range(B.minX, B.maxX), z = Rng.Range(B.minZ, B.maxZ);
                if (!Collide.IsFree(Stage, x, z, p.Spec.radius + 0.5f, Stage.Logs)) continue;
                p.wx = x; p.wz = z;
                break;
            }
            p.wanderIn = Rng.Range(3, 7);
        }

        Snake NearestSnake(float x, float z)
        {
            Snake best = null;
            float bestD = float.MaxValue;
            foreach (var s in Snakes)
            {
                if (!s.alive) continue;
                float d = Collide.Hypot(s.x - x, s.z - z);
                if (d < bestD) { bestD = d; best = s; }
            }
            return best;
        }

        bool PredatorsNear(float x, float z, float radius)
        {
            foreach (var p in Predators) if (Collide.Hypot(p.x - x, p.z - z) <= radius + p.Spec.radius) return true;
            return false;
        }

        void ScarePredators(float x, float z, float radius, bool freeze)
        {
            foreach (var p in Predators)
            {
                if (Collide.Hypot(p.x - x, p.z - z) > radius + p.Spec.radius) continue;
                if (freeze) p.frozenFor = Math.Max(p.frozenFor, 1.4f);
                else { p.scaredFor = Math.Max(p.scaredFor, 2.5f); p.chargeFor = 0; p.biteIn = Math.Max(p.biteIn, 1); }
            }
        }

        // ---------------------------------------------------------------- the kids

        void UpdateKids(float dt)
        {
            foreach (var k in Kids)
            {
                k.wanderIn -= dt;
                k.throwIn -= dt;
                if (k.pauseFor > 0) { k.pauseFor -= dt; k.speed = 0; }
                else
                {
                    if (k.wanderIn <= 0 || Collide.Hypot(k.x - k.tx, k.z - k.tz) < 0.8f) WanderKid(k);
                    k.heading = Collide.TurnToward(k.heading, (float)Math.Atan2(k.tz - k.z, k.tx - k.x), 6 * dt);
                    float speed = Sim.Kids.ROAM[(int)k.kind];
                    var hit = Collide.ResolveCircle(Stage, k.x + (float)Math.Cos(k.heading) * speed * dt, k.z + (float)Math.Sin(k.heading) * speed * dt, Sim.Kids.RADIUS, ScratchHit);
                    k.travel += Collide.Hypot(hit.x - k.x, hit.z - k.z);
                    k.x = hit.x; k.z = hit.z;
                    k.speed = speed;
                    if (hit.hit) { k.heading = Collide.SlideAlong(k.heading, hit.nx, hit.nz); WanderKid(k); }
                }
                float every = Sim.Kids.THROW_EVERY[(int)k.kind];
                if (every > 0 && k.throwIn <= 0)
                {
                    var target = NearestSnake(k.x, k.z);
                    if (target != null && Collide.Hypot(target.x - k.x, target.z - k.z) <= Sim.Kids.REACH[(int)k.kind] && Projectiles.Count < 24)
                    {
                        k.throwIn = every;
                        Lob(k, target, k.kind == KidKind.Naughty ? ProjectileKind.Pebble : ProjectileKind.Kiss);
                    }
                    else k.throwIn = 0.6f;
                }
            }
        }

        void WanderKid(Kid k)
        {
            float spread = k.kind == KidKind.Runner ? 30 : 14;
            for (int tries = 0; tries < 20; tries++)
            {
                float x = k.x + Rng.Range(-spread, spread), z = k.z + Rng.Range(-spread, spread);
                if (!Collide.IsFree(Stage, x, z, Sim.Kids.RADIUS + 0.5f)) continue;
                k.tx = x; k.tz = z;
                break;
            }
            k.wanderIn = Rng.Range(1.5f, 4);
            if (k.kind == KidKind.Runner && Rng.Next() < 0.3f) k.pauseFor = Rng.Range(0.4f, 1.2f);
        }

        void Lob(Kid k, Snake target, ProjectileKind kind)
        {
            float speed = kind == ProjectileKind.Pebble ? 11 : 7;
            float flight = Collide.Hypot(target.x - k.x, target.z - k.z) / speed;
            float vel = target.BaseSpeed * target.speedFactor;
            float aimX = target.x + (float)Math.Cos(target.heading) * vel * flight * 0.7f;
            float aimZ = target.z + (float)Math.Sin(target.heading) * vel * flight * 0.7f;
            float dx = aimX - k.x, dz = aimZ - k.z, d = Collide.Hypot(dx, dz);
            if (d == 0) d = 1;
            k.heading = (float)Math.Atan2(dz, dx);
            Projectiles.Add(new Projectile { kind = kind, x = k.x, z = k.z, dx = dx / d, dz = dz / d, speed = speed, left = d, total = d });
            Events.Add(new GameEvent { type = EventType.Lob, projectile = kind, x = k.x, z = k.z });
        }

        void UpdateProjectiles(float dt)
        {
            var B = Stage.Bounds;
            for (int i = Projectiles.Count - 1; i >= 0; i--)
            {
                var pj = Projectiles[i];
                float step = pj.speed * dt;
                pj.x += pj.dx * step; pj.z += pj.dz * step; pj.left -= step;
                float hitR = pj.kind == ProjectileKind.Pebble ? 1.2f : 1.5f;
                var best = NearestSnake(pj.x, pj.z);
                if (best != null && Collide.Hypot(best.x - pj.x, best.z - pj.z) <= hitR)
                {
                    Strike(pj, best);
                    Projectiles.RemoveAt(i);
                    continue;
                }
                bool outside = pj.x < B.minX || pj.x > B.maxX || pj.z < B.minZ || pj.z > B.maxZ;
                if (pj.left <= 0 || outside) Projectiles.RemoveAt(i);
            }
        }

        void Strike(Projectile pj, Snake best)
        {
            if (pj.kind == ProjectileKind.Pebble)
            {
                if (best.immune > 0) return;
                best.immune = OUCH_GRACE * 0.5f;
                float lost = best.mass < 1 ? 0 : Math.Min(6, Math.Max(1, best.mass * 0.05f)) * (1 - best.rockGuard);
                if (lost > 0) Shed(best, lost, PELLET_RETURN, 2);
                Events.Add(new GameEvent { type = EventType.Pelt, who = best.id, x = best.x, z = best.z, lost = lost });
            }
            else
            {
                bool gem = Rng.Next() < 0.25f;
                best.Gain(4);
                Events.Add(new GameEvent { type = EventType.Kiss, who = best.id, x = best.x, z = best.z, gem = gem });
            }
        }

        void MeetKids(Snake s, float dt)
        {
            foreach (var k in Kids)
            {
                float reach = s.Radius + Sim.Kids.RADIUS;
                if ((s.x - k.x) * (s.x - k.x) + (s.z - k.z) * (s.z - k.z) >= reach * reach) continue;
                Shove(s, k.x, k.z, reach, dt);
                k.tx = k.x + (k.x - s.x);
                k.tz = k.z + (k.z - s.z);
                k.pauseFor = 0;
                if (s.bumpQuiet <= 0)
                {
                    s.bumpQuiet = BUMP_QUIET;
                    Events.Add(new GameEvent { type = EventType.BumpKid, who = s.id, x = s.x, z = s.z });
                }
            }
        }

        void ChatterSami(float dt)
        {
            if (Stage.Greeters == null) return;
            samiSayIn -= dt;
            if (samiSayIn > 0) return;
            samiSayIn = Rng.Range(7, 13);
            Events.Add(new GameEvent { type = EventType.Say, text = Rng.Pick(SAMI_LINES), x = Stage.Greeters[0], z = Stage.Greeters[1], sami = true });
        }

        // ---------------------------------------------------------------- fantastic creatures and magic

        void UpdateCreatures(float dt)
        {
            foreach (var c in Creatures)
            {
                var spec = c.Spec;
                if (c.respawnIn > 0)
                {
                    c.respawnIn -= dt;
                    c.speed = 0;
                    if (c.respawnIn <= 0)
                    {
                        Sim.Creatures.Spot(Stage, Rng, out float x, out float z);
                        c.x = c.wx = x; c.z = c.wz = z;
                    }
                    continue;
                }
                c.wanderIn -= dt;
                var near = NearestSnake(c.x, c.z);
                float d = near != null ? Collide.Hypot(near.x - c.x, near.z - c.z) : float.MaxValue;
                float speed;
                if (near != null && d < spec.alert)
                {
                    c.heading = Collide.TurnToward(c.heading, (float)Math.Atan2(c.z - near.z, c.x - near.x), 5 * dt);
                    speed = spec.flee;
                }
                else
                {
                    if (c.wanderIn <= 0 || Collide.Hypot(c.x - c.wx, c.z - c.wz) < 1) WanderCreature(c);
                    c.heading = Collide.TurnToward(c.heading, (float)Math.Atan2(c.wz - c.z, c.wx - c.x), 2 * dt);
                    speed = spec.flee * 0.3f;
                }
                var hit = Collide.ResolveCircle(Stage, c.x + (float)Math.Cos(c.heading) * speed * dt, c.z + (float)Math.Sin(c.heading) * speed * dt, spec.radius, ScratchHit, Stage.Logs);
                c.x = hit.x; c.z = hit.z;
                c.speed = speed;
                if (hit.hit) { c.heading = Collide.SlideAlong(c.heading, hit.nx, hit.nz); WanderCreature(c); }
            }
        }

        void WanderCreature(Creature c)
        {
            for (int tries = 0; tries < 20; tries++)
            {
                float x = c.x + Rng.Range(-14, 14), z = c.z + Rng.Range(-14, 14);
                if (!Collide.IsFree(Stage, x, z, c.Spec.radius + 0.5f, Stage.Logs)) continue;
                c.wx = x; c.wz = z;
                break;
            }
            c.wanderIn = Rng.Range(2, 5);
        }

        void MeetCreatures(Snake s)
        {
            foreach (var c in Creatures)
            {
                if (c.respawnIn > 0) continue;
                float reach = s.BiteReach * GULP_REACH + c.Spec.radius;
                if ((s.x - c.x) * (s.x - c.x) + (s.z - c.z) * (s.z - c.z) > reach * reach) continue;
                CastMagic(s, c.kind, c.x, c.z);
                c.respawnIn = CREATURE_RESPAWN;
                break; // one blessing per tick
            }
        }

        void CastMagic(Snake s, CreatureKind kind, float cx, float cz)
        {
            int gems = 0;
            switch (kind)
            {
                case CreatureKind.Stag:
                {
                    var next = Snake.TIERS[Math.Min(Snake.TIERS.Length - 1, s.Tier + 1)];
                    if (s.mass < next.mass) s.mass = next.mass;
                    s.score += 500;
                    s.GiveMagic(MagicId.Halo, 8);
                    gems = 3;
                    break;
                }
                case CreatureKind.Unicorn: s.GiveMagic(MagicId.Rainbow, 20); s.score += 150; gems = 1; break;
                case CreatureKind.Owl: s.GiveMagic(MagicId.Owl, 30); s.luckyCards += 1; s.score += 120; gems = 1; break;
                case CreatureKind.Kitsune: s.GiveMagic(MagicId.Hidden, 15); s.score += 120; gems = 1; break;
                case CreatureKind.Pixie: s.GiveMagic(MagicId.Magnet, 20); s.score += 100; gems = 1; break;
                case CreatureKind.Squirrel: s.Gain(28); s.score += 80; gems = 2; break;
                case CreatureKind.Frog:
                {
                    Predator best = null;
                    float bestD = float.MaxValue;
                    foreach (var p in Predators)
                    {
                        float d = Collide.Hypot(p.x - s.x, p.z - s.z);
                        if (d < bestD) { bestD = d; best = p; }
                    }
                    if (best != null) { best.frozenFor = Math.Max(best.frozenFor, 10); best.scaredFor = 0; }
                    s.score += 100;
                    gems = 1;
                    break;
                }
                case CreatureKind.Wisp: WispCache(s); gems = 2; break;
            }
            Events.Add(new GameEvent { type = EventType.Magic, creature = kind, who = s.id, x = s.x, z = s.z, gems = gems });
        }

        void WispCache(Snake s)
        {
            int n = 0;
            foreach (var f in Foods)
            {
                if (n >= 6) break;
                float a = Rng.Range(0, Collide.PI * 2), r = Rng.Range(2, 6);
                float x = s.x + (float)Math.Cos(a) * r, z = s.z + (float)Math.Sin(a) * r;
                if (!Collide.IsFree(Stage, x, z, 0.5f)) continue;
                f.x = x; f.z = z; f.golden = true; f.born = Tick;
                n++;
            }
        }
    }
}
