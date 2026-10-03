using System;
using System.Collections.Generic;

namespace Telfer.Sim
{
    public struct SnakeInput
    {
        /// <summary>Desired travel direction in world space (x east, z south). Ignored when not active.</summary>
        public float x, z;
        public bool active, dash;
    }

    public sealed class SnakeLook
    {
        public string name;
        public uint body, stripe, head;
        public SnakeLook(string name, uint body, uint stripe, uint head) { this.name = name; this.body = body; this.stripe = stripe; this.head = head; }
    }

    public struct TierInfo
    {
        public string name; public float mass;
        public TierInfo(string n, float m) { name = n; mass = m; }
    }

    public enum Rarity { Common, Rare, Epic, Legendary }

    public enum UpgradeId { Skates, Belly, Homework, Wrap, Magnet, Tongue, Helmet, Clover, Spikes, Dragon, Bees, Laser, Stink, Zap, Freeze, Snack }

    public struct UpgradeDef
    {
        public string name, label; public Rarity rarity; public int max;
        public UpgradeDef(string name, string label, Rarity rarity, int max) { this.name = name; this.label = label; this.rarity = rarity; this.max = max; }
    }

    /// <summary>The timed magic buffs a fantastic creature grants (rainbow, hidden, magnet, owl, halo).</summary>
    public enum MagicId { Rainbow, Hidden, Magnet, Owl, Halo }

    /// <summary>Level-up cards, Megabonk style. The four offensive powers cost a blue gem each (port of upgrades.ts).</summary>
    public static class Upgrades
    {
        public static readonly UpgradeDef[] DEFS =
        {
            new UpgradeDef("Roller Skates", "Faster", Rarity.Common, 5),
            new UpgradeDef("Stretchy Belly", "Grow more", Rarity.Common, 5),
            new UpgradeDef("Homework Book", "Level up", Rarity.Common, 5),
            new UpgradeDef("Bubble Wrap", "Rock proof", Rarity.Common, 5),
            new UpgradeDef("Magnet Tail", "Magnet", Rarity.Rare, 5),
            new UpgradeDef("Long Tongue", "Long reach", Rarity.Rare, 5),
            new UpgradeDef("Bike Helmet", "Bonk shield", Rarity.Rare, 3),
            new UpgradeDef("Four-leaf Clover", "Lucky", Rarity.Rare, 3),
            new UpgradeDef("Hedgehog Spikes", "Spiky", Rarity.Legendary, 3),
            new UpgradeDef("Dragon Breath", "Fire!", Rarity.Legendary, 5),
            new UpgradeDef("Bee Buddies", "Bees", Rarity.Legendary, 3),
            new UpgradeDef("Laser Eyes", "Laser", Rarity.Epic, 5),
            new UpgradeDef("Stink Cloud", "Stink", Rarity.Epic, 3),
            new UpgradeDef("Zap Ring", "Zap", Rarity.Epic, 3),
            new UpgradeDef("Freeze Puff", "Freeze", Rarity.Epic, 3),
            new UpgradeDef("Snack Pack", "Big snack", Rarity.Common, 999),
        };

        public const float SNACK_MASS = 15;
        public const int POWER_GEM_COST = 1;
        /// <summary>UPGRADE_IDS order in upgrades.ts: draws walk the pool in this order.</summary>
        static readonly UpgradeId[] TS_ORDER =
        {
            UpgradeId.Skates, UpgradeId.Belly, UpgradeId.Homework, UpgradeId.Magnet, UpgradeId.Tongue, UpgradeId.Helmet,
            UpgradeId.Wrap, UpgradeId.Spikes, UpgradeId.Dragon, UpgradeId.Bees, UpgradeId.Clover,
            UpgradeId.Laser, UpgradeId.Stink, UpgradeId.Zap, UpgradeId.Freeze,
        };

        public static bool IsPower(UpgradeId id) => id == UpgradeId.Laser || id == UpgradeId.Stink || id == UpgradeId.Zap || id == UpgradeId.Freeze;
        static readonly float[] HELMET_RECHARGE = { 0, 40, 30, 20 };
        static readonly float[] RARITY_WEIGHT = { 6, 3, 1.5f, 0.75f };
        static readonly float[] LUCK_BONUS = { 0, 1, 0.7f, 0.5f };

        public static int XpForLevel(int level) => (int)Math.Round(20 + 14 * level + 2f * level * level);

        /// <summary>Up to `n` different cards from `from`, weighted by rarity (and the clover's luck).</summary>
        static List<UpgradeId> Draw(Rng rng, Snake s, List<UpgradeId> from, int n)
        {
            var pool = new List<UpgradeId>(from);
            var cards = new List<UpgradeId>();
            while (cards.Count < n && pool.Count > 0)
            {
                float total = 0;
                var weights = new float[pool.Count];
                for (int i = 0; i < pool.Count; i++)
                {
                    int r = (int)DEFS[(int)pool[i]].rarity;
                    weights[i] = RARITY_WEIGHT[r] + s.luck * LUCK_BONUS[r];
                    total += weights[i];
                }
                float roll = rng.Next() * total;
                int pick = pool.Count - 1;
                for (int i = 0; i < pool.Count; i++)
                {
                    if (roll < weights[i]) { pick = i; break; }
                    roll -= weights[i];
                }
                cards.Add(pool[pick]);
                pool.RemoveAt(pick);
            }
            return cards;
        }

        /// <summary>Three different cards the snake can still use; Snack Packs fill any gaps.</summary>
        public static UpgradeId[] Roll(Rng rng, Snake s)
        {
            var pool = new List<UpgradeId>();
            foreach (var id in TS_ORDER)
                if ((s.canBuyPowers || !IsPower(id)) && s.LevelOf(id) < DEFS[(int)id].max) pool.Add(id);
            List<UpgradeId> cards;
            if (s.luckyCards > 0)
            {
                // Owl Eyes: a lucky draw of the best free cards, legendaries topped up with rares. Never a gem card.
                s.luckyCards--;
                cards = Draw(rng, s, pool.FindAll(id => DEFS[(int)id].rarity == Rarity.Legendary), 3);
                cards.AddRange(Draw(rng, s, pool.FindAll(id => DEFS[(int)id].rarity == Rarity.Rare), 3 - cards.Count));
            }
            else
            {
                cards = Draw(rng, s, pool, 3);
                // Never force a spend: a player always gets at least one free card to pick.
                if (!s.isBot && cards.Count == 3 && cards.TrueForAll(IsPower))
                {
                    var free = Draw(rng, s, pool.FindAll(id => !IsPower(id)), 1);
                    cards[2] = free.Count > 0 ? free[0] : UpgradeId.Snack;
                }
            }
            while (cards.Count < 3) cards.Add(UpgradeId.Snack);
            return cards.ToArray();
        }

        /// <summary>A bot grabs the scariest card on offer (modes.ts botCardChoice).</summary>
        static readonly UpgradeId[] BOT_PREF =
        {
            UpgradeId.Dragon, UpgradeId.Laser, UpgradeId.Zap, UpgradeId.Freeze, UpgradeId.Spikes, UpgradeId.Stink, UpgradeId.Skates, UpgradeId.Magnet,
            UpgradeId.Bees, UpgradeId.Belly, UpgradeId.Tongue, UpgradeId.Clover, UpgradeId.Homework, UpgradeId.Helmet, UpgradeId.Wrap, UpgradeId.Snack,
        };

        public static int BotChoice(UpgradeId[] cards)
        {
            int best = 0, bestRank = int.MaxValue;
            for (int i = 0; i < cards.Length; i++)
            {
                int r = Array.IndexOf(BOT_PREF, cards[i]);
                if (r < 0) r = 99;
                if (r < bestRank) { bestRank = r; best = i; }
            }
            return best;
        }

        public static void Refresh(Snake s)
        {
            int Lv(UpgradeId id) => s.LevelOf(id);
            s.speedMul = s.baseSpeedMul * (1 + 0.08f * Lv(UpgradeId.Skates));
            s.growthMul = s.baseGrowthMul * (1 + 0.12f * Lv(UpgradeId.Belly));
            s.xpMul = 1 + 0.15f * Lv(UpgradeId.Homework);
            s.rockGuard = Math.Min(1, 0.2f * Lv(UpgradeId.Wrap));
            s.magnet = Lv(UpgradeId.Magnet) > 0 ? 1.8f + 0.8f * Lv(UpgradeId.Magnet) : 0;
            s.reachBonus = 0.35f * Lv(UpgradeId.Tongue);
            s.luck = Lv(UpgradeId.Clover);
            s.spikes = 0.25f * Lv(UpgradeId.Spikes);
            s.bees = Lv(UpgradeId.Bees);
            s.breathLevel = Lv(UpgradeId.Dragon);
            bool hadHelmet = s.helmetRecharge > 0;
            s.helmetRecharge = HELMET_RECHARGE[Lv(UpgradeId.Helmet)];
            if (s.helmetRecharge > 0 && !hadHelmet) s.helmetReady = true;
            if (!s.helmetReady) s.helmetIn = Math.Min(s.helmetIn, s.helmetRecharge);
        }
    }

    /// <summary>One snake: a head steered by input, and a trail of past positions the body follows. Port of snake.ts.</summary>
    public sealed class Snake
    {
        public static readonly TierInfo[] TIERS =
        {
            new TierInfo("Wiggly Worm", 0), new TierInfo("Grass Snake", 20), new TierInfo("Python", 70),
            new TierInfo("Anaconda", 170), new TierInfo("MEGA Telfersnake", 350), new TierInfo("The Dragon", 700),
        };

        const float TRAIL_STEP = 0.1f;
        const int TRAIL_CAP = 4096;
        const float DASH_BOOST = 1.6f, DASH_COST = 0.8f, DASH_MIN_MASS = 2;
        const float MAX_RADIUS = 1.1f, MAX_LENGTH = 60, MAX_SPEED = 10, WALL_DEFLECT = 6;
        const int BODY_POINTS = 128;

        public readonly int id;
        public SnakeLook look;
        public bool isBot;

        public float x, z, heading, mass, score;
        public float speedFactor = 1;
        public bool dashing, touchingWall, wasTouchingWall, slowed;
        public float steerX, steerZ;
        float wallNx, wallNz;
        public float bumpQuiet, immune;
        public bool alive = true;
        public float respawnIn;
        public int highestTier;

        public float xp;
        public int level = 1, pendingCards;
        public UpgradeId[] cards;

        public float baseSpeedMul = 1, baseGrowthMul = 1, massCap = float.MaxValue;
        public float speedMul = 1, growthMul = 1, xpMul = 1, rockGuard, magnet, reachBonus, spikes;
        public int luck, bees, breathLevel;
        public float breathIn;
        public float helmetRecharge, helmetIn;
        public bool helmetReady;

        /// <summary>Seconds left of each magic buff, indexed by MagicId. All 0 on the school.</summary>
        public readonly float[] magic = new float[5];
        /// <summary>Lucky card draws owed (the Wise Owl): the next rolls are epic-or-better.</summary>
        public int luckyCards;
        /// <summary>Whether power cards may be offered (the player has a gem, or it is a God bot).</summary>
        public bool canBuyPowers;
        public float laserIn, stinkIn, zapIn, freezeIn;
        /// <summary>Seconds frozen solid by a rival's Freeze Puff: it cannot steer or move.</summary>
        public float frozenFor;

        public bool HasMagic(MagicId id) => magic[(int)id] > 0;
        public void GiveMagic(MagicId id, float secs) => magic[(int)id] = Math.Max(magic[(int)id], secs);
        public void TickMagic(float dt) { for (int i = 0; i < magic.Length; i++) if (magic[i] > 0) magic[i] = Math.Max(0, magic[i] - dt); }

        public readonly float[] body = new float[BODY_POINTS * 2];
        public int bodyCount;

        readonly int[] upgrades = new int[(int)UpgradeId.Snack + 1];
        readonly Hit hit = new Hit();

        readonly float[] tx = new float[TRAIL_CAP], tz = new float[TRAIL_CAP];
        int start, count;

        public Snake(int id, SnakeLook look, bool isBot) { this.id = id; this.look = look; this.isBot = isBot; }

        public void Reset()
        {
            mass = score = xp = 0;
            level = 1; pendingCards = 0; cards = null; highestTier = 0; speedFactor = 1;
            baseSpeedMul = baseGrowthMul = 1; massCap = float.MaxValue;
            Array.Clear(upgrades, 0, upgrades.Length);
            helmetReady = false; helmetRecharge = 0;
            laserIn = stinkIn = zapIn = freezeIn = frozenFor = 0;
            Array.Clear(magic, 0, magic.Length);
            luckyCards = 0;
            Upgrades.Refresh(this);
        }

        public void PlaceAt(float px, float pz, float h)
        {
            x = px; z = pz; heading = h; start = 0; count = 0;
            int n = (int)Math.Ceiling(Length / TRAIL_STEP) + 2;
            for (int i = n; i >= 0; i--) PushTrail(px - (float)Math.Cos(h) * i * TRAIL_STEP, pz - (float)Math.Sin(h) * i * TRAIL_STEP);
            SampleBody();
        }

        public float Length => Math.Min(MAX_LENGTH, 3 + 0.9f * (float)Math.Pow(mass, 0.6));
        public float Radius => Math.Min(MAX_RADIUS, 0.3f + 0.045f * (float)Math.Pow(mass, 0.4));
        public float BaseSpeed => Math.Min(MAX_SPEED, 4.5f + 0.35f * (float)Math.Pow(mass, 0.4)) * speedMul;
        public float TurnRate => 5 / (1 + 2 * (Radius - 0.3f));
        public float BiteReach => Radius * 1.5f + 0.8f + reachBonus;
        public bool CanDash => alive && !slowed && mass > DASH_MIN_MASS;

        public int Tier
        {
            get
            {
                int t = 0;
                for (int i = 0; i < TIERS.Length; i++) if (mass >= TIERS[i].mass) t = i;
                return t;
            }
        }

        /// <summary>0..1 progress from this tier to the next (1 at the top tier).</summary>
        public float TierProgress
        {
            get
            {
                int t = Tier;
                if (t >= TIERS.Length - 1) return 1;
                return Math.Max(0, Math.Min(1, (mass - TIERS[t].mass) / (TIERS[t + 1].mass - TIERS[t].mass)));
            }
        }

        public int LevelOf(UpgradeId id) => upgrades[(int)id];

        public IEnumerable<KeyValuePair<UpgradeId, int>> Owned()
        {
            for (int i = 0; i < (int)UpgradeId.Snack; i++) if (upgrades[i] > 0) yield return new KeyValuePair<UpgradeId, int>((UpgradeId)i, upgrades[i]);
        }

        public float Gain(float value, float pointsPerMass = 10)
        {
            float points = Math.Max(1, (float)Math.Floor(value * pointsPerMass + 0.5f));
            mass = Math.Min(mass + value * growthMul, Math.Max(mass, massCap));
            score += points;
            xp += value * xpMul;
            while (xp >= Upgrades.XpForLevel(level))
            {
                xp -= Upgrades.XpForLevel(level);
                level++;
                pendingCards++;
            }
            return points;
        }

        public void DropAllUpgrades()
        {
            bool any = false;
            for (int i = 0; i < upgrades.Length; i++) any |= upgrades[i] > 0;
            if (!any) return;
            int levelsLost = 0;
            for (int i = 0; i < upgrades.Length; i++) { levelsLost += upgrades[i]; upgrades[i] = 0; }
            level = Math.Max(1, level - levelsLost);
            xp = 0; pendingCards = 0; helmetReady = false; helmetRecharge = 0;
            Upgrades.Refresh(this);
        }

        public void TakeCard(UpgradeId card)
        {
            pendingCards = Math.Max(0, pendingCards - 1);
            if (card == UpgradeId.Snack) { mass += Upgrades.SNACK_MASS * growthMul; return; }
            upgrades[(int)card]++;
            Upgrades.Refresh(this);
        }

        public void Update(SnakeInput input, float dt, bool canDash, ITerrain terrain, IReadOnlyList<Circle> rocks)
        {
            Move(input, dt, canDash, terrain, rocks);
            ExtendTrail();
        }

        void Move(SnakeInput input, float dt, bool canDash, ITerrain terrain, IReadOnlyList<Circle> rocks)
        {
            immune = Math.Max(0, immune - dt);
            bumpQuiet = Math.Max(0, bumpQuiet - dt);
            steerX = input.active ? input.x : 0;
            steerZ = input.active ? input.z : 0;
            if (helmetRecharge > 0 && !helmetReady)
            {
                helmetIn -= dt;
                if (helmetIn <= 0) helmetReady = true;
            }
            if (input.active) Steer((float)Math.Atan2(input.z, input.x), TurnRate * dt);

            dashing = input.dash && canDash && mass > DASH_MIN_MASS;
            if (dashing) mass = Math.Max(DASH_MIN_MASS, mass - DASH_COST * dt);

            float speed = BaseSpeed * speedFactor * (dashing ? DASH_BOOST : 1);
            float nx = x + (float)Math.Cos(heading) * speed * dt;
            float nz = z + (float)Math.Sin(heading) * speed * dt;

            Collide.ResolveCircle(terrain, nx, nz, Radius, hit, rocks);
            x = hit.x; z = hit.z;
            wasTouchingWall = touchingWall;
            touchingWall = hit.hit;
            if (hit.hit)
            {
                wallNx = hit.nx; wallNz = hit.nz;
                Deflect(hit.nx, hit.nz, dt);
            }
        }

        void Steer(float want, float step)
        {
            float diff = Collide.WrapAngle(want - heading);
            if (touchingWall && Math.Abs(diff) > Collide.PI / 2)
            {
                float side = Math.Sign(diff); if (side == 0) side = 1;
                float probe = heading + side * 0.3f;
                bool turnsIntoWall = (float)Math.Cos(probe) * wallNx + (float)Math.Sin(probe) * wallNz < -0.05f;
                bool wantsTheWall = (float)Math.Cos(want) * wallNx + (float)Math.Sin(want) * wallNz < -0.3f;
                if (turnsIntoWall && !wantsTheWall)
                {
                    heading = Collide.WrapAngle(heading - side * step);
                    return;
                }
            }
            heading = Collide.TurnToward(heading, want, step);
        }

        public void Deflect(float nx, float nz, float dt)
        {
            float dx = (float)Math.Cos(heading), dz = (float)Math.Sin(heading);
            float into = dx * nx + dz * nz;
            if (into >= 0) return;
            float tx_ = dx - into * nx, tz_ = dz - into * nz;
            if (tx_ * tx_ + tz_ * tz_ < 1e-8f)
            {
                tx_ = -nz; tz_ = nx;
                if (tx_ * steerX + tz_ * steerZ < 0) { tx_ = -tx_; tz_ = -tz_; }
            }
            heading = Collide.TurnToward(heading, (float)Math.Atan2(tz_, tx_), WALL_DEFLECT * dt);
        }

        /// <summary>Position d metres behind the head, measured along the body.</summary>
        public void SampleAt(float d, out float ox, out float oz)
        {
            float lx = tx[start], lz = tz[start];
            float lead = Collide.Hypot(x - lx, z - lz);
            if (d <= lead || count < 2)
            {
                float t0 = lead > 1e-6f ? Math.Min(1, d / lead) : 0;
                ox = x + (lx - x) * t0; oz = z + (lz - z) * t0;
                return;
            }
            float f = (d - lead) / TRAIL_STEP;
            int i = (int)Math.Floor(f);
            float t = f - i;
            if (i >= count - 1) { i = count - 2; t = 1; }
            int a = (start + i) % TRAIL_CAP, b = (start + i + 1) % TRAIL_CAP;
            ox = tx[a] + (tx[b] - tx[a]) * t;
            oz = tz[a] + (tz[b] - tz[a]) * t;
        }

        public void SampleBody()
        {
            float step = Math.Max(0.5f, Radius), length = Length;
            int n = 0;
            for (float d = Radius * 2; d <= length && n < BODY_POINTS; d += step)
            {
                SampleAt(d, out body[n * 2], out body[n * 2 + 1]);
                n++;
            }
            bodyCount = n;
        }

        void ExtendTrail()
        {
            for (;;)
            {
                float lx = tx[start], lz = tz[start];
                float dx = x - lx, dz = z - lz;
                float dist = Collide.Hypot(dx, dz);
                if (dist < TRAIL_STEP) return;
                PushTrail(lx + dx / dist * TRAIL_STEP, lz + dz / dist * TRAIL_STEP);
            }
        }

        void PushTrail(float px, float pz)
        {
            start = (start - 1 + TRAIL_CAP) % TRAIL_CAP;
            tx[start] = px; tz[start] = pz;
            if (count < TRAIL_CAP) count++;
        }
    }
}
