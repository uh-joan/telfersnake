using System;
using System.Collections.Generic;
using Telfer.Sim;

namespace Telfer.Net
{
    /// <summary>
    /// The wire format of the game server (port of src/net/protocol.ts). JSON text frames, one message
    /// each; rows are positional number arrays. Kind indices match the C# enum order (checked by
    /// <see cref="Check"/>); upgrade digits do NOT, so they are mapped by name.
    /// </summary>
    public static class Protocol
    {
        public const int PROTOCOL = 1;
        /// <summary>The server sims at 60 Hz and snapshots every 4th tick (15 Hz).</summary>
        public const int SNAPSHOT_EVERY = 4;
        public const int MAX_MESSAGE = 512, MAX_MESSAGES_PER_SECOND = 90;

        public const int ALIVE = 1, SLOWED = 2, DASHING = 4, HELMET_READY = 8, CHOOSING = 16, AWAY = 32, FROZEN = 64;

        /// <summary>TS UPGRADE_IDS: digit i of the packed base-6 number is the level of WIRE_UPGRADES[i].</summary>
        public static readonly UpgradeId[] WIRE_UPGRADES =
        {
            UpgradeId.Skates, UpgradeId.Belly, UpgradeId.Homework, UpgradeId.Magnet, UpgradeId.Tongue, UpgradeId.Helmet,
            UpgradeId.Wrap, UpgradeId.Spikes, UpgradeId.Dragon, UpgradeId.Bees, UpgradeId.Clover,
            UpgradeId.Laser, UpgradeId.Stink, UpgradeId.Zap, UpgradeId.Freeze,
        };

        public static readonly string[] FOOD_KINDS = { "burger", "sausage", "cookie", "broccoli", "carrot", "apple", "mushroom", "tomato", "berry", "acorn",
            "fishchips", "scone", "sponge", "sandwich", "pie", "sausageroll", "crumpet", "strawberry", "jellybaby", "bagel", "biscuit", "tea" };
        public static readonly string[] ANIMAL_KINDS = { "snail", "ladybird", "chicken", "duck", "rabbit", "sheep", "pig", "goat", "squirrel", "crow", "deer", "hedgehog", "fox", "pigeon",
            "corgi", "swan", "gull", "pelican", "horse", "dino" };
        public static readonly string[] HAZARD_KINDS = { "rock", "stones", "sticks", "puddle", "umbrella", "roadworks" };
        public static readonly string[] PREDATOR_KINDS = { "bear", "wolf", "lion", "raven" };
        public static readonly string[] KID_KINDS = { "naughty", "nice", "runner", "tourist", "trip", "busker" };
        public static readonly string[] PROJECTILE_KINDS = { "pebble", "kiss", "chip" };
        public static readonly string[] CREATURE_KINDS = { "stag", "unicorn", "owl", "frog", "kitsune", "pixie", "squirrel", "wisp",
            "dragon", "lionroyal", "phoenix", "mermaid", "ghost", "gog", "fairy", "pearly" };
        public static readonly string[] VEHICLE_KINDS = { "bus", "cab" };
        /// <summary>What carries a snake (snake.ts CARRIERS); on the wire a SnakeExtra's third column is index + 1.</summary>
        public static readonly string[] CARRIERS = { "eye", "boat" };
        public static readonly string[] MAGIC_IDS = { "rainbow", "hidden", "magnet", "owl", "halo", "wings", "river", "giant", "phoenix", "roar" };

        public static string Wire(Mode m) => m == Mode.Easy ? "easy" : m == Mode.God ? "god" : "normal";
        public static string Wire(StageId s) => s == StageId.Common ? "common" : s == StageId.London ? "london" : "school";
        public static StageId StageOf(string s) => s == "common" ? StageId.Common : s == "london" ? StageId.London : StageId.School;
        public static string Wire(UpgradeId u) => u.ToString().ToLowerInvariant();

        /// <summary>An upgrade, power or card id ('snack' included) by its TS name; false if unknown.</summary>
        public static bool TryUpgrade(string name, out UpgradeId id)
        {
            switch (name)
            {
                case "skates": id = UpgradeId.Skates; return true;
                case "belly": id = UpgradeId.Belly; return true;
                case "homework": id = UpgradeId.Homework; return true;
                case "wrap": id = UpgradeId.Wrap; return true;
                case "magnet": id = UpgradeId.Magnet; return true;
                case "tongue": id = UpgradeId.Tongue; return true;
                case "helmet": id = UpgradeId.Helmet; return true;
                case "clover": id = UpgradeId.Clover; return true;
                case "spikes": id = UpgradeId.Spikes; return true;
                case "dragon": id = UpgradeId.Dragon; return true;
                case "bees": id = UpgradeId.Bees; return true;
                case "laser": id = UpgradeId.Laser; return true;
                case "stink": id = UpgradeId.Stink; return true;
                case "zap": id = UpgradeId.Zap; return true;
                case "freeze": id = UpgradeId.Freeze; return true;
                case "snack": id = UpgradeId.Snack; return true;
                default: id = UpgradeId.Snack; return false;
            }
        }

        /// <summary>Kind name to index in one of the tables above (-1 if unknown): for string kinds in events.</summary>
        public static int IndexOf(string[] table, string name) => name == null ? -1 : Array.IndexOf(table, name);

        /// <summary>Unpacks base-6 levels into <paramref name="levels"/>, indexed by (int)UpgradeId.</summary>
        public static void UnpackUpgrades(double packed, int[] levels)
        {
            Array.Clear(levels, 0, levels.Length);
            double n = Math.Max(0, Math.Floor(packed));
            foreach (var id in WIRE_UPGRADES)
            {
                double digit = n % 6;
                if ((int)id < levels.Length) levels[(int)id] = (int)digit;
                n = Math.Floor(n / 6);
            }
        }

        /// <summary>Empty when every wire kind table lines up with its C# enum; otherwise what does not.</summary>
        public static string Check()
        {
            string bad = "";
            void Same<T>(string[] wire) where T : Enum
            {
                var names = Enum.GetNames(typeof(T));
                for (int i = 0; i < wire.Length; i++)
                    if (i >= names.Length || !string.Equals(names[i], wire[i], StringComparison.OrdinalIgnoreCase))
                        bad += typeof(T).Name + "[" + i + "]=" + wire[i] + " ";
            }
            Same<FoodKind>(FOOD_KINDS); Same<AnimalKind>(ANIMAL_KINDS); Same<HazardKind>(HAZARD_KINDS);
            Same<PredatorKind>(PREDATOR_KINDS); Same<KidKind>(KID_KINDS); Same<ProjectileKind>(PROJECTILE_KINDS);
            Same<CreatureKind>(CREATURE_KINDS); Same<MagicId>(MAGIC_IDS); Same<VehicleKind>(VEHICLE_KINDS);
            if (CARRIERS.Length != 2 || (int)Carrier.Eye != 1 || (int)Carrier.Boat != 2) bad += "carriers ";
            foreach (var id in WIRE_UPGRADES)
                if (!TryUpgrade(Wire(id), out var back) || back != id) bad += "upgrade " + id + " ";
            return bad;
        }

        // ------------------------------------------------------------ parsing

        /// <summary>One frame from the server, or null if it is malformed or of a type we do not know.</summary>
        public static ServerMessage Parse(string text)
        {
            var d = Json.TryParseObject(text);
            if (d == null) return null;
            switch (Json.Str(d, "t"))
            {
                case "snap": return Snapshot.From(d, text.Length);
                case "seats": return new Seats { seats = Seat.ListFrom(Json.List(d, "seats")) };
                case "welcome": return Welcome.From(d);
                case "sorry": return new Sorry { why = Json.Str(d, "why", "busy") };
                default: return null;
            }
        }

        internal static T[] Rows<T>(List<object> list, Func<List<object>, T> make)
        {
            if (list == null) return Array.Empty<T>();
            var rows = new T[list.Count];
            for (int i = 0; i < rows.Length; i++) rows[i] = make(list[i] as List<object>);
            return rows;
        }

        internal static int[] Ints(List<object> list)
        {
            if (list == null) return Array.Empty<int>();
            var a = new int[list.Count];
            for (int i = 0; i < a.Length; i++) a[i] = list[i] is double n ? (int)n : 0;
            return a;
        }

        static float F(List<object> r, int i) => (float)Json.At(r, i);
        static int I(List<object> r, int i) => (int)Json.At(r, i);

        internal static SnakeRow SnakeRowOf(List<object> r) => new SnakeRow
        {
            x = F(r, 0), z = F(r, 1), heading = F(r, 2), mass = F(r, 3), score = F(r, 4), flags = I(r, 5),
            respawnIn = F(r, 6), immune = F(r, 7), upgrades = Json.At(r, 8), magic = I(r, 9),
        };
        internal static AnimalRow AnimalRowOf(List<object> r) => new AnimalRow
            { x = F(r, 0), z = F(r, 1), heading = F(r, 2), speed = F(r, 3), travel = F(r, 4), dazed = F(r, 5), born = I(r, 6) };
        internal static MoverRow MoverRowOf(List<object> r) => new MoverRow { x = F(r, 0), z = F(r, 1), heading = F(r, 2), speed = F(r, 3), state = r != null && r.Count > 4 ? I(r, 4) : 0 };
        internal static TreasureRow TreasureRowOf(List<object> r) => new TreasureRow { x = F(r, 0), z = F(r, 1), present = I(r, 2) != 0 };
        internal static SnakeExtra SnakeExtraOf(List<object> r) => new SnakeExtra
            { jewels = I(r, 0), crowned = I(r, 1) != 0, carrier = r != null && r.Count > 2 ? I(r, 2) : 0, rwb = r != null && r.Count > 3 && I(r, 3) != 0 };
        internal static ButtonRow ButtonRowOf(List<object> r) => new ButtonRow { x = F(r, 0), z = F(r, 1), born = I(r, 2) };
        internal static CreatureRow CreatureRowOf(List<object> r) => new CreatureRow
            { x = F(r, 0), z = F(r, 1), heading = F(r, 2), speed = F(r, 3), present = I(r, 4) != 0 };
        internal static ProjectileRow ProjectileRowOf(List<object> r) => new ProjectileRow { x = F(r, 0), z = F(r, 1), kind = I(r, 2), t = F(r, 3) };
        internal static FoodRow FoodRowOf(List<object> r) => new FoodRow
            { index = I(r, 0), kind = I(r, 1), golden = I(r, 2) != 0, x = F(r, 3), z = F(r, 4), born = I(r, 5) };
        internal static PelletRow PelletRowOf(List<object> r) => new PelletRow { x = F(r, 0), z = F(r, 1), value = F(r, 2), born = I(r, 3) };
        internal static HazardRow HazardRowOf(List<object> r) => new HazardRow { kind = I(r, 0), x = F(r, 1), z = F(r, 2), r = F(r, 3), turn = F(r, 4) };
        internal static CooperRow CooperRowOf(List<object> r) => new CooperRow
            { x = F(r, 0), z = F(r, 1), heading = F(r, 2), speed = F(r, 3), talking = F(r, 4) };
    }

    // ---------------------------------------------------------------- client -> server

    /// <summary>Builders for every client message, already serialised (each well under 512 bytes).</summary>
    public static class ClientMessage
    {
        public static string Hello(Mode mode, StageId stage, bool canBuy, string skin, string hat, string trail, string name)
            => new JsonWriter().Str("t", "hello").Num("v", Protocol.PROTOCOL).Str("mode", Protocol.Wire(mode)).Str("stage", Protocol.Wire(stage))
                .Bit("buy", canBuy).Str("skin", skin).Str("hat", hat).Str("trail", trail).Str("name", Clip(name)).End();

        public static string Look(string skin, string hat, string trail, string name)
            => new JsonWriter().Str("t", "look").Str("skin", skin).Str("hat", hat).Str("trail", trail).Str("name", Clip(name)).End();

        public static string Gems(bool on) => new JsonWriter().Str("t", "gems").Bit("on", on).End();
        public static string Away(bool on) => new JsonWriter().Str("t", "away").Bit("on", on).End();
        public static string Pick(int index) => new JsonWriter().Str("t", "pick").Num("i", index).End();

        /// <summary>Thumb state: (x, z) the wanted direction in sim space (+x east, +z south), q the client tick.</summary>
        public static string Input(int q, float x, float z, bool active, bool dash)
            => new JsonWriter().Str("t", "in").Num("q", q).Num("x", x).Num("z", z).Bit("a", active).Bit("d", dash).End();

        /// <summary>The server cleans names to 16 characters anyway; clipping here keeps hello small.</summary>
        static string Clip(string name) => name == null ? "" : name.Length > 16 ? name.Substring(0, 16) : name;
    }

    // ---------------------------------------------------------------- server -> client

    public abstract class ServerMessage { }

    public sealed class Sorry : ServerMessage
    {
        /// <summary>'full', 'old' (protocol mismatch) or 'busy'.</summary>
        public string why;
    }

    public sealed class Seats : ServerMessage
    {
        public Seat[] seats;
    }

    /// <summary>A snake's colours as sent (0xRRGGBB), plus the optional skin pattern the C# SnakeLook lacks.</summary>
    public sealed class NetLook
    {
        public string name;
        public uint body, stripe, head;
        /// <summary>Null when the skin has no pattern.</summary>
        public uint[] pattern;
        /// <summary>Piccadilly Lights: the pattern chases along the body (drawn only).</summary>
        public bool shimmer;

        public SnakeLook ToSim() => new SnakeLook(name, body, stripe, head);
    }

    public sealed class Seat
    {
        public int id;
        public bool bot;
        public NetLook look;
        public string hat, trail;

        internal static Seat[] ListFrom(List<object> list)
        {
            if (list == null) return Array.Empty<Seat>();
            var seats = new Seat[list.Count];
            for (int i = 0; i < seats.Length; i++)
            {
                var d = list[i] as Dictionary<string, object>;
                var l = Json.Obj(d, "look");
                uint[] pattern = null;
                var p = Json.List(l, "pattern");
                if (p != null)
                {
                    pattern = new uint[p.Count];
                    for (int j = 0; j < pattern.Length; j++) pattern[j] = p[j] is double n ? (uint)n : 0;
                }
                seats[i] = new Seat
                {
                    id = (int)Json.Num(d, "id"), bot = Json.Bool(d, "bot"),
                    hat = Json.Str(d, "hat", "no-hat"), trail = Json.Str(d, "trail", "no-trail"),
                    look = new NetLook
                    {
                        name = Json.Str(l, "name", ""), body = (uint)Json.Num(l, "body"), stripe = (uint)Json.Num(l, "stripe"),
                        head = (uint)Json.Num(l, "head"), pattern = pattern, shimmer = Json.Bool(l, "shimmer"),
                    },
                };
            }
            return seats;
        }
    }

    public sealed class Welcome : ServerMessage
    {
        /// <summary>My seat: an index into the snake rows of every snapshot.</summary>
        public int me;
        public string room;
        public StageId stage;
        public int tick;
        public Seat[] seats;
        public HazardRow[] hazards;
        /// <summary>Kind indices, one per entity, in the order snapshot rows come in.</summary>
        public int[] animalKinds, predatorKinds, kidKinds, creatureKinds;
        public FoodRow[] foods;
        public PelletRow[] pellets;
        /// <summary>London: the buses and cabs (VEHICLE_KINDS indices), how many Crown Jewels lie about, the set pieces' flavour.</summary>
        public int[] vehicleKinds;
        public int treasureCount, setPieceSeed;

        internal static Welcome From(Dictionary<string, object> d) => new Welcome
        {
            me = (int)Json.Num(d, "me"), room = Json.Str(d, "room", ""), stage = Protocol.StageOf(Json.Str(d, "stage")),
            tick = (int)Json.Num(d, "tick"), seats = Seat.ListFrom(Json.List(d, "seats")),
            hazards = Protocol.Rows(Json.List(d, "hazards"), Protocol.HazardRowOf),
            animalKinds = Protocol.Ints(Json.List(d, "animalKinds")), predatorKinds = Protocol.Ints(Json.List(d, "predatorKinds")),
            kidKinds = Protocol.Ints(Json.List(d, "kidKinds")), creatureKinds = Protocol.Ints(Json.List(d, "creatureKinds")),
            foods = Protocol.Rows(Json.List(d, "foods"), Protocol.FoodRowOf),
            pellets = Protocol.Rows(Json.List(d, "pellets"), Protocol.PelletRowOf),
            vehicleKinds = Protocol.Ints(Json.List(d, "vehicleKinds")),
            treasureCount = (int)Json.Num(d, "treasureCount"), setPieceSeed = (int)Json.Num(d, "setPieceSeed"),
        };
    }

    /// <summary>Only for me: the ack of my inputs, xp and the cards I am being offered.</summary>
    public struct You
    {
        public int ack, level;
        /// <summary>Seconds left to pick before the server takes the first card.</summary>
        public float xp, speedFactor, cardsFor;
        /// <summary>Null when no cards are offered.</summary>
        public UpgradeId[] cards;
    }

    public sealed class Snapshot : ServerMessage
    {
        public int k;
        public SnakeRow[] s;
        public AnimalRow[] a;
        public MoverRow[] pd, kd;
        /// <summary>London: buses and cabs, the Crown Jewels, each snake's extras (in `s` order); null where absent.</summary>
        public MoverRow[] vh;
        public TreasureRow[] tr;
        public SnakeExtra[] sx;
        /// <summary>London's pearl buttons: the whole list, only when it changed (else null).</summary>
        public ButtonRow[] pb;
        public CreatureRow[] cr;
        public ProjectileRow[] pj;
        /// <summary>Only the food rows that changed (all of them after a skipped snapshot).</summary>
        public FoodRow[] f;
        /// <summary>The whole pellet list, or null when it has not changed.</summary>
        public PelletRow[] p;
        public CooperRow c;
        public NetEvent[] e;
        public You you;
        /// <summary>Size of the frame, for diagnostics.</summary>
        public int bytes;

        internal static Snapshot From(Dictionary<string, object> d, int bytes)
        {
            var snap = new Snapshot
            {
                k = (int)Json.Num(d, "k"), bytes = bytes,
                s = Protocol.Rows(Json.List(d, "s"), Protocol.SnakeRowOf),
                a = Protocol.Rows(Json.List(d, "a"), Protocol.AnimalRowOf),
                pd = Protocol.Rows(Json.List(d, "pd"), Protocol.MoverRowOf),
                kd = Protocol.Rows(Json.List(d, "kd"), Protocol.MoverRowOf),
                cr = Protocol.Rows(Json.List(d, "cr"), Protocol.CreatureRowOf),
                pj = Protocol.Rows(Json.List(d, "pj"), Protocol.ProjectileRowOf),
                f = Protocol.Rows(Json.List(d, "f"), Protocol.FoodRowOf),
                p = Json.List(d, "p") != null ? Protocol.Rows(Json.List(d, "p"), Protocol.PelletRowOf) : null,
                c = Protocol.CooperRowOf(Json.List(d, "c")),
                vh = Json.List(d, "vh") != null ? Protocol.Rows(Json.List(d, "vh"), Protocol.MoverRowOf) : null,
                tr = Json.List(d, "tr") != null ? Protocol.Rows(Json.List(d, "tr"), Protocol.TreasureRowOf) : null,
                sx = Json.List(d, "sx") != null ? Protocol.Rows(Json.List(d, "sx"), Protocol.SnakeExtraOf) : null,
                pb = Json.List(d, "pb") != null ? Protocol.Rows(Json.List(d, "pb"), Protocol.ButtonRowOf) : null,
            };
            var events = Json.List(d, "e");
            snap.e = new NetEvent[events?.Count ?? 0];
            for (int i = 0; i < snap.e.Length; i++) snap.e[i] = new NetEvent(events[i] as Dictionary<string, object>);

            var y = Json.Obj(d, "you");
            snap.you = new You
            {
                ack = (int)Json.Num(y, "ack"), xp = (float)Json.Num(y, "xp"), level = (int)Json.Num(y, "level"),
                speedFactor = (float)Json.Num(y, "speedFactor", 1), cardsFor = (float)Json.Num(y, "cardsFor"),
            };
            var cards = Json.List(y, "cards");
            if (cards != null)
            {
                var ids = new List<UpgradeId>(cards.Count);
                foreach (var c in cards) if (Protocol.TryUpgrade(c as string, out var id)) ids.Add(id);
                snap.you.cards = ids.ToArray();
            }
            return snap;
        }
    }

    /// <summary>A sim event as the server sent it: the TS GameEvent object, keyed by `type`, string kinds.</summary>
    public sealed class NetEvent
    {
        public readonly string type;
        public readonly Dictionary<string, object> raw;

        public NetEvent(Dictionary<string, object> raw) { this.raw = raw ?? new Dictionary<string, object>(); type = Json.Str(this.raw, "type", ""); }

        public bool Has(string key) => raw.ContainsKey(key);
        public float Float(string key, float fallback = 0) => (float)Json.Num(raw, key, fallback);
        public int Int(string key, int fallback = -1) => (int)Json.Num(raw, key, fallback);
        public bool Bool(string key) => Json.Bool(raw, key);
        public string Str(string key) => Json.Str(raw, key);
        public List<object> List(string key) => Json.List(raw, key);
        /// <summary>A string kind as an index into a wire table (e.g. Protocol.FOOD_KINDS), -1 if absent.</summary>
        public int Kind(string key, string[] table) => Protocol.IndexOf(table, Str(key));
        public override string ToString() => type;
    }

    public struct SnakeRow
    {
        public float x, z, heading, mass, score;
        public int flags;
        public float respawnIn, immune;
        /// <summary>Packed base-6 levels in wire order: use <see cref="Protocol.UnpackUpgrades"/>.</summary>
        public double upgrades;
        /// <summary>Bit i set when MagicId i is active.</summary>
        public int magic;

        public bool Has(int flag) => (flags & flag) != 0;
        public bool Alive => Has(Protocol.ALIVE);
        public bool MagicOn(MagicId m) => (magic & (1 << (int)m)) != 0;
    }

    public struct AnimalRow { public float x, z, heading, speed, travel, dazed; public int born; }
    /// <summary>Predators, kids and vehicles: position, heading and speed; London's lions and ravens add their state.</summary>
    public struct MoverRow { public float x, z, heading, speed; public int state; }
    public struct TreasureRow { public float x, z; public bool present; }
    /// <summary>A snake's London extras: jewels, the crown, what carries it (0 none, else CARRIERS index + 1), the Red Arrows' trail.</summary>
    public struct SnakeExtra { public int jewels, carrier; public bool crowned, rwb; }
    public struct ButtonRow { public float x, z; public int born; }
    public struct CreatureRow { public float x, z, heading, speed; public bool present; }
    /// <summary>t is flight progress 0..1 (so left = 1 - t of a total of 1).</summary>
    public struct ProjectileRow { public float x, z, t; public int kind; }
    public struct FoodRow { public int index, kind, born; public bool golden; public float x, z; }
    public struct PelletRow { public float x, z, value; public int born; }
    public struct HazardRow { public int kind; public float x, z, r, turn; }
    public struct CooperRow { public float x, z, heading, speed, talking; }
}
