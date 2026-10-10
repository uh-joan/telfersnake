using System;
using System.Collections.Generic;

namespace Telfer.Sim
{
    /// <summary>A river: a ribbon of `width` metres along a polyline (x, z pairs), drifting downstream (water.ts).</summary>
    public sealed class WaterZone
    {
        public float[] path;
        public float width, driftX, driftZ;
        public int Count => path.Length / 2;
        public float X(int i) => path[i * 2];
        public float Z(int i) => path[i * 2 + 1];
    }

    /// <summary>
    /// Rivers (port of water.ts). A point is in the water when it lies within half a ribbon's width of its
    /// polyline and not on a bridge deck. Pure geometry with no RNG: a stage without water never takes
    /// any of these branches, so the school and the Common play exactly as before.
    /// </summary>
    public static class Water
    {
        /// <summary>The nearest point on a ribbon's centre line to (x, z), and the unit direction of that stretch; returns the squared distance.</summary>
        static float Nearest(WaterZone w, float x, float z, out float qx, out float qz, out float tx, out float tz)
        {
            float best = float.PositiveInfinity;
            qx = qz = 0; tx = 1; tz = 0;
            for (int i = 0; i + 1 < w.Count; i++)
            {
                float ax = w.X(i), az = w.Z(i), dx = w.X(i + 1) - ax, dz = w.Z(i + 1) - az;
                float len2 = dx * dx + dz * dz;
                float t = len2 > 0 ? Math.Min(1, Math.Max(0, ((x - ax) * dx + (z - az) * dz) / len2)) : 0;
                float px = ax + dx * t, pz = az + dz * t;
                float d2 = (x - px) * (x - px) + (z - pz) * (z - pz);
                if (d2 < best)
                {
                    best = d2; qx = px; qz = pz;
                    float len = (float)Math.Sqrt(len2);
                    if (len > 0) { tx = dx / len; tz = dz / len; }
                }
            }
            return best;
        }

        /// <summary>True when (x, z) stands on one of the stage's bridge decks.</summary>
        public static bool OnBridge(Stage s, float x, float z)
        {
            if (s.Bridges == null) return false;
            foreach (var b in s.Bridges) if (Math.Abs(x - b.x) <= b.w / 2 && Math.Abs(z - b.z) <= b.d / 2) return true;
            return false;
        }

        /// <summary>The river (x, z) is swimming in, or null on dry land or a bridge. `margin` widens the ribbon.</summary>
        public static WaterZone At(Stage s, float x, float z, float margin = 0)
        {
            if (s.Water == null) return null;
            foreach (var w in s.Water)
            {
                float r = w.width / 2 + margin;
                if (Nearest(w, x, z, out _, out _, out _, out _) < r * r && !OnBridge(s, x, z)) return w;
            }
            return null;
        }

        /// <summary>Is (x, z) in the water (and not on a bridge)? Always false on a stage without rivers.</summary>
        public static bool In(ITerrain t, float x, float z, float margin = 0) => t is Stage s && s.Water != null && At(s, x, z, margin) != null;

        /// <summary>The unit direction from a river's centre line out toward its nearest bank, at (x, z).</summary>
        public static void ShoreNormal(WaterZone w, float x, float z, out float nx, out float nz)
        {
            Nearest(w, x, z, out float qx, out float qz, out _, out _);
            float dx = x - qx, dz = z - qz, d = (float)Math.Sqrt(dx * dx + dz * dz);
            nx = d > 1e-6f ? dx / d : 0;
            nz = d > 1e-6f ? dz / d : 1;
        }

        /// <summary>The current at (x, z): the drift speed, pointing downstream along the nearest stretch.</summary>
        public static void Flow(WaterZone w, float x, float z, out float fx, out float fz)
        {
            Nearest(w, x, z, out _, out _, out float tx, out float tz);
            float speed = (float)Math.Sqrt(w.driftX * w.driftX + w.driftZ * w.driftZ);
            fx = tx * speed; fz = tz * speed;
        }

        /// <summary>Does the straight line from (ax, az) to (bx, bz) get wet anywhere? Sampled every 1.5 m.</summary>
        public static bool Crosses(Stage s, float ax, float az, float bx, float bz)
        {
            if (s.Water == null) return false;
            int n = Math.Max(1, (int)Math.Ceiling(Collide.Hypot(bx - ax, bz - az) / 1.5f));
            for (int i = 0; i <= n; i++)
                if (At(s, ax + (bx - ax) * i / n, az + (bz - az) * i / n) != null) return true;
            return false;
        }
    }

    /// <summary>A painted street (londonLayout.ts Road): cream with ink edges; the bus roads are wider.</summary>
    public sealed class Road
    {
        public string id;
        public float[] path;
        public float width;
        public Road(string id, float width, params float[] path) { this.id = id; this.width = width; this.path = path; }
        public int Count => path.Length / 2;
        public float X(int i) => path[i * 2];
        public float Z(int i) => path[i * 2 + 1];
    }

    public struct Landmark
    {
        public string id;
        public float x, z, radius;
        public Landmark(string id, float x, float z, float r) { this.id = id; this.x = x; this.z = z; radius = r; }
    }

    public struct Zebra { public float x, z, angle, width; }

    public struct Ellipse { public float x, z, rx, rz, rot; public Ellipse(float x, float z, float rx, float rz, float rot) { this.x = x; this.z = z; this.rx = rx; this.rz = rz; this.rot = rot; } }

    /// <summary>
    /// Level 3: London, a paper map come to life (port of londonLayout.ts, constant for constant).
    /// The Thames winds west → east and splits the map into a north and a south bank; you cross on
    /// Westminster Bridge, the Millennium Bridge or Tower Bridge, or swim (slowly: ×0.5 and the current
    /// carries you downstream). The twelve landmarks stand on the map as solids (their footprints; the
    /// views build them tall). Metres, +x east, +z south.
    ///
    /// Its people, legends, Crown Jewels and set pieces are here too (B3), as in classic A2–A6.
    /// </summary>
    public sealed class London : Stage
    {
        static London stage;
        public static London Stage => stage ?? (stage = new London());

        public static readonly Bounds2 BOUNDS = new Bounds2(-85, 85, -65, 65);

        // ------------------------------------------------------------ the river and its bridges

        public static readonly WaterZone THAMES = new WaterZone
        {
            path = new float[] { -85, 20, -55, 24, -36, 16, -24, 2, -18, -10, 0, -14, 20, -8, 42, 4, 56, 9, 63, 18, 65, 30, 66, 44, 66, 65 },
            width = 14, driftX = 0.4f, driftZ = 0,
        };
        public static readonly Box WESTMINSTER_BRIDGE = new Box(-24, 2, 28, 6);
        public static readonly Box MILLENNIUM_BRIDGE = new Box(24, -6, 4, 22);
        public static readonly Box TOWER_BRIDGE = new Box(65, 30, 24, 6);
        public static readonly Box[] BRIDGES = { WESTMINSTER_BRIDGE, MILLENNIUM_BRIDGE, TOWER_BRIDGE };
        /// <summary>Tower Bridge's two bascules: the road between the towers' inner faces, which lifts (A6).</summary>
        public static readonly Box TOWER_BRIDGE_SPAN = new Box(65, 30, 7.4f, 6);
        const float SPAN_W = 65 - 3.7f, SPAN_E = 65 + 3.7f, DECK_W = 65 - 12, DECK_E = 65 + 12;
        /// <summary>The bridges while Tower Bridge is up: its span lifted out, its two ends still there.</summary>
        public static readonly Box[] BRIDGES_LIFTED =
        {
            WESTMINSTER_BRIDGE, MILLENNIUM_BRIDGE,
            new Box((DECK_W + SPAN_W) / 2, 30, SPAN_W - DECK_W, 6), new Box((SPAN_E + DECK_E) / 2, 30, DECK_E - SPAN_E, 6),
        };

        // ------------------------------------------------------------ the twelve landmarks (footprints)

        public static readonly Box BIG_BEN = new Box(-40, -8, 4, 4);
        public static readonly Box PARLIAMENT = new Box(-48, -4, 12, 8);
        public static readonly Circle LONDON_EYE = new Circle(-6, -1, 1.6f);
        public static readonly Box PALACE = new Box(-52, -22, 16, 6);
        public static readonly Circle VICTORIA_MEMORIAL = new Circle(-40, -22, 2);
        public static readonly Circle NELSON = new Circle(-12, -42, 1.2f);
        public static readonly float[] LION_PLINTHS = { -16, -45, -8, -45, -16, -39, -8, -39 };
        const float PLINTH_R = 1;
        public static readonly Circle ST_PAULS_DOME = new Circle(30, -42, 4.5f);
        public static readonly Box ST_PAULS_NAVE = new Box(21, -42, 10, 5);
        public static readonly Box TOWER = new Box(62, -16, 14, 12);
        public static readonly float[] TOWER_BRIDGE_TOWERS = { 59.8f, 30, 70.2f, 30 };
        public static readonly Box SHARD = new Box(52, 42, 9, 9);
        public static readonly Circle GHERKIN = new Circle(50, -52, 3.5f);
        public static readonly Circle GLOBE = new Circle(18, 12, 4);
        public static readonly Circle PICCADILLY_FOUNTAIN = new Circle(-30, -50, 1.6f);
        public static readonly Box PICCADILLY_SCREENS = new Box(-30, -62.5f, 16, 5);
        public static readonly Box MUSEUM = new Box(-66, 0, 16, 7);

        // ------------------------------------------------------------ the people and the legends (A4/A5: solids only, for now)

        public const float GUARD_X = -40, GUARD_Z = -28.5f, GUARD_R = 0.75f;
        public const float SAMI_X = -49.5f, SAMI_Z = 5.5f;
        public const float BEEFEATER_X = 62, BEEFEATER_Z = -9.5f;
        public const float STATUE_X = 15, STATUE_Z = -47;
        public static readonly Circle ELFIN_OAK = new Circle(-76, -52, 1);
        const float PERSON_R = 0.45f;
        /// <summary>The two buskers in Covent Garden, and each tourist's sight (Westminster twice: Miss Sami's group).</summary>
        public static readonly float[] BUSKERS = { 3, -51, 10, -53 };
        public static readonly float[] TOURIST_SPOTS = { -44, 4, -42, 7, -12, -35, -45, -31, 28, -50, -36, -54 };
        /// <summary>The school trip's walk: a circle round St James's lake, anticlockwise on the map (24 points).</summary>
        public static readonly float[] TRIP_PATH = MakeTrip();
        static float[] MakeTrip()
        {
            var p = new float[48];
            for (int i = 0; i < 24; i++)
            {
                double a = -i / 24.0 * Math.PI * 2;
                p[i * 2] = (float)(-26 + Math.Cos(a) * 4.6); p[i * 2 + 1] = (float)(-28.6 + Math.Sin(a) * 4.6);
            }
            return p;
        }
        /// <summary>Where the Crown Jewels may lie: the first (by the Tower) always, four more drawn per run.</summary>
        public static readonly float[] JEWEL_SPOTS = { 52, -18, -12, -35, 44, 46, 42, -57, 25, 20, -37, -53, -66, 8, 8, -46, -30, 40, -62, -34, 33, -32 };

        static readonly string[] SAMI_TOUR =
        {
            "Keep together, everyone!", "Big Ben's this way!", "Mind the gap!", "Look — the London Eye!", "Who wants a scone?",
            "Follow the umbrella, please!", "Wave to the guard. He won't wave back!", "Lovely! Tea at four o’clock.",
            "Ooh, a red bus! Wave, everyone!", "Mind the river, poppets.",
        };
        static readonly string[] BEEFEATER_LINES =
        {
            "Mind the ravens. They bite. Politely.", "Six ravens, always six!", "The jewels are not for snacking.", "Welcome to the Tower!",
            "Nine hundred years old. Still no lift.", "No slithering on the battlements, please.", "Ravens first, then snakes. Queue nicely.",
        };

        public static readonly Landmark[] LANDMARKS =
        {
            new Landmark("bigben", -42, -6, 12),
            new Landmark("eye", LONDON_EYE.x, LONDON_EYE.z, 9),
            new Landmark("palace", PALACE.x, PALACE.z, 13),
            new Landmark("trafalgar", NELSON.x, NELSON.z, 9),
            new Landmark("stpauls", 27, -42, 11),
            new Landmark("tower", TOWER.x, TOWER.z, 12),
            new Landmark("towerbridge", TOWER_BRIDGE.x, TOWER_BRIDGE.z, 10),
            new Landmark("shard", SHARD.x, SHARD.z, 9),
            new Landmark("gherkin", GHERKIN.x, GHERKIN.z, 9),
            new Landmark("globe", GLOBE.x, GLOBE.z, 9),
            new Landmark("piccadilly", PICCADILLY_FOUNTAIN.x, PICCADILLY_FOUNTAIN.z, 9),
            new Landmark("museum", MUSEUM.x, MUSEUM.z, 13),
        };

        public static Landmark Find(string id) { foreach (var l in LANDMARKS) if (l.id == id) return l; return default; }

        // ------------------------------------------------------------ zones, roads and stations

        public static readonly Box HYDE_PARK = new Box(-68, -42, 32, 30);
        public static readonly Ellipse SERPENTINE = new Ellipse(-68, -42, 9, 2.5f, -0.25f);
        public static readonly Box ST_JAMES = new Box(-26, -26, 16, 10);
        public static readonly Box COVENT_GARDEN = new Box(8, -50, 16, 10);
        public static readonly Box BOROUGH = new Box(40, 24, 14, 10);
        public static readonly Box SOUTH_BANK = new Box(-30, 38, 22, 12);
        public static readonly Ellipse ST_JAMES_LAKE = new Ellipse(-25, -25.5f, 5.5f, 1.8f, 0.1f);
        static readonly Box THE_CITY = new Box(38, -46, 36, 26);
        static readonly Box PALACE_GARDEN = new Box(-46, -27, 22, 10);

        public static readonly Road[] ROADS =
        {
            new Road("mall", 5, -38, -24, -24, -33, -14, -40),
            new Road("piccadilly", 4, -56, -30, -40, -42, -30, -50, -18, -44),
            new Road("strand", 5.2f, -12, -42, 4, -39, 16, -35, 34, -33, 48, -28, 62, -26),
            new Road("whitehall", 4, -12, -42, -24, -26, -34, -14),
            new Road("embankment", 5.2f, -36, -14, -18, -22, 0, -24, 22, -20, 44, -9, 74, -6),
            new Road("southbank", 4, -8, 4, -18, 14, -30, 26, -50, 34),
            new Road("borough", 5.2f, -7, 6, 4, 7.5f, 10, 18, 24, 24, 40, 28, 53, 30),
            new Road("towerbridge", 5.2f, 77, 30, 80, 16, 78, 2, 74, -6),
            new Road("kensington", 5.2f, -84, -8, -58, -11, -48, -13.2f, -36, -15),
            new Road("westminster", 5.2f, -36, -14, -36, 0, -30, 2),
            new Road("minories", 5.2f, 62, -26, 73, -25, 78, -14, 78, 2),
        };

        /// <summary>The Tube stations (portals in A6). Westminster is where you arrive.</summary>
        public static readonly float[] TUBE = { -46, 8, -24, -56, -62, 8, 38, -46, 54, -34, 36, 32 };
        public static readonly string[] TUBE_NAMES = { "WESTMINSTER", "PICCADILLY", "SOUTH KEN", "BANK", "TOWER HILL", "LONDON BRIDGE" };

        public static float DistanceToPath(float[] path, float x, float z)
        {
            float best = float.PositiveInfinity;
            for (int i = 0; i + 3 < path.Length; i += 2)
            {
                float ax = path[i], az = path[i + 1], dx = path[i + 2] - ax, dz = path[i + 3] - az;
                float t = Math.Min(1, Math.Max(0, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
                best = Math.Min(best, Collide.Hypot(x - ax - dx * t, z - az - dz * t));
            }
            return best;
        }

        public static float RiverDistance(float x, float z) => DistanceToPath(THAMES.path, x, z);

        /// <summary>Is (x, z) clear of the river and of every landmark (for paint and street furniture alike)?</summary>
        public static bool ClearOfSights(float x, float z, float margin)
        {
            if (RiverDistance(x, z) < THAMES.width / 2 + margin) return false;
            foreach (var l in LANDMARKS) if (Collide.Hypot(x - l.x, z - l.z) < Math.Min(l.radius, 9) + margin) return false;
            return true;
        }

        /// <summary>The zebra crossings: one at the middle of each longer street segment, where it is dry and open.</summary>
        public static readonly Zebra[] ZEBRAS = MakeZebras();

        static Zebra[] MakeZebras()
        {
            var out_ = new List<Zebra>();
            foreach (var r in ROADS)
                for (int i = 0; i + 1 < r.Count; i++)
                {
                    float ax = r.X(i), az = r.Z(i), bx = r.X(i + 1), bz = r.Z(i + 1);
                    if (Collide.Hypot(bx - ax, bz - az) < 14) continue;
                    float x = (ax + bx) / 2, z = (az + bz) / 2;
                    if (!ClearOfSights(x, z, 3)) continue;
                    out_.Add(new Zebra { x = x, z = z, angle = (float)Math.Atan2(bz - az, bx - ax), width = r.width });
                }
            return out_.ToArray();
        }

        readonly Box[] solidBoxes;
        readonly Circle[] solidCircles;

        public override StageId Id => StageId.London;
        public override string Name => "London";
        public override Bounds2 Bounds => BOUNDS;
        public override Box[] SolidBoxes => solidBoxes;
        public override Circle[] SolidCircles => solidCircles;

        /// <summary>The landmark footprints that are boxes and circles (for the minimap's faint marks).</summary>
        public Box[] LandmarkBoxes => solidBoxes;

        London()
        {
            var boxes = new List<Box> { BIG_BEN, PARLIAMENT, PALACE, ST_PAULS_NAVE, TOWER };
            for (int i = 0; i < TOWER_BRIDGE_TOWERS.Length; i += 2)
            {
                float tx = TOWER_BRIDGE_TOWERS[i], tz = TOWER_BRIDGE_TOWERS[i + 1];
                boxes.Add(new Box(tx, tz - 4.2f, 3, 2.4f));
                boxes.Add(new Box(tx, tz + 4.2f, 3, 2.4f));
            }
            boxes.AddRange(new[] { SHARD, PICCADILLY_SCREENS, MUSEUM });
            solidBoxes = boxes.ToArray();
            var circles = new List<Circle> { LONDON_EYE, VICTORIA_MEMORIAL, NELSON };
            for (int i = 0; i < LION_PLINTHS.Length; i += 2) circles.Add(new Circle(LION_PLINTHS[i], LION_PLINTHS[i + 1], PLINTH_R));
            circles.AddRange(new[]
            {
                ST_PAULS_DOME, GHERKIN, GLOBE, PICCADILLY_FOUNTAIN,
                new Circle(GUARD_X, GUARD_Z, GUARD_R), new Circle(SAMI_X, SAMI_Z, PERSON_R), new Circle(BEEFEATER_X, BEEFEATER_Z, 0.5f), new Circle(STATUE_X, STATUE_Z, PERSON_R),
                ELFIN_OAK,
            });
            solidCircles = circles.ToArray();

            Water = new[] { THAMES };
            Bridges = BRIDGES;
            CameraZoom = 0.9f;
            // You pop out of the Underground at Westminster, under Big Ben, facing the bridge.
            SpawnX = -46; SpawnZ = 8; SpawnHeading = -0.45f;
            FallbackX = 0; FallbackZ = -32; // open paper north of the river, between Trafalgar and St Paul's
            // London's zoo: a big flock in Trafalgar Square, ducks on both lakes.
            AnimalKinds = new[] { AnimalKind.Pigeon, AnimalKind.Squirrel, AnimalKind.Duck, AnimalKind.Corgi, AnimalKind.Swan, AnimalKind.Gull, AnimalKind.Pelican, AnimalKind.Horse, AnimalKind.Dino };
            AnimalCounts = new Dictionary<AnimalKind, int> { { AnimalKind.Pigeon, 10 }, { AnimalKind.Duck, 4 } };
            AnimalHomes = new Dictionary<AnimalKind, Home> { { AnimalKind.Pigeon, Home.Trafalgar } };
            // Dropped umbrellas, roadworks and the odd puddle, anywhere open (and never on a bus route).
            HasHazards = true;
            HazardRough = BOUNDS;
            HazardShare = 0;
            HazardKinds = new[] { HazardKind.Puddle, HazardKind.Umbrella, HazardKind.Roadworks };
            // The four Trafalgar lions (one per plinth) and the Tower's raven pair.
            Plinths = LION_PLINTHS;
            Perches = RAVEN_PERCHES;
            Predators = new[] { (PredatorKind.Lion, LION_PLINTHS.Length / 2), (PredatorKind.Raven, RAVEN_PERCHES.Length / 2) };
            Routes = ROUTES;
            Traffic = TRAFFIC;
            Zebras = ZEBRAS;
            // London's people (A4): six tourists, the school trip (the teacher and eight children on the rope), two buskers.
            var kids = new List<KidKind>();
            for (int i = 0; i < TOURIST_SPOTS.Length / 2; i++) kids.Add(KidKind.Tourist);
            for (int i = 0; i < Sim.Kids.TRIP_THROWS.Length; i++) kids.Add(KidKind.Trip);
            for (int i = 0; i < BUSKERS.Length / 2; i++) kids.Add(KidKind.Busker);
            Kids = kids.ToArray();
            TouristSpots = TOURIST_SPOTS;
            BuskerSpots = BUSKERS;
            TripPath = TRIP_PATH;
            Statue = new[] { STATUE_X, STATUE_Z };
            Guard = new[] { GUARD_X, GUARD_Z };
            Chatters = new[]
            {
                new Chatter { id = "sami", x = SAMI_X, z = SAMI_Z, lines = SAMI_TOUR },
                new Chatter { id = "beefeater", x = BEEFEATER_X, z = BEEFEATER_Z, lines = BEEFEATER_LINES },
            };
            // The legends (A5): five of the nine each run, picked by rarity; the Crown Jewels.
            CreatureCount = 5;
            CreatureKinds = new[] { CreatureKind.Dragon, CreatureKind.Unicorn, CreatureKind.LionRoyal, CreatureKind.Phoenix, CreatureKind.Mermaid, CreatureKind.Ghost, CreatureKind.Gog, CreatureKind.Fairy, CreatureKind.Pearly };
            JewelSpots = JEWEL_SPOTS;
            // The set pieces (A6) and the Tube.
            Portals = TUBE;
            SetPieces = SET_PIECES;
            FoodScale = 2;
            ExtraRivals = 4;
            Warden = new WardenConfig
            {
                spawnX = -4, spawnZ = -38, beat = new Bounds2(-60, 48, -58, -26), persona = "bobby",
                general = new[]
                {
                    "No slithering on the Mall, please.", "Mind the gap. And the buses. And the pigeons.",
                    "Has anyone seen a snake? Last seen on the Northern line.", "The King's swans are not for eating, thank you.",
                    "Single file across the bridge, if you'd be so kind.", "Lovely manners, everyone. Carry on sightseeing.",
                    "Who let the corgis out?", "Keep to the left, please. This is London.", "Queue nicely, everyone. Thank you.",
                },
                near = new[]
                {
                    "Walking feet. Even in London.", "Steady on! This is a city, not a racetrack.",
                    "Slow down, please. Mind the tourists.", "Move along now. Nothing to eat here.",
                },
                big = new[] { "I say. You've grown since Tooting.", "Goodness. Do mind the landmarks, please." },
                bump = new[] { "'Ello 'ello 'ello! What's all this, then?", "I beg your pardon!", "Mind how you go, sir. Or madam. Or snake." },
            };
        }

        // ------------------------------------------------------------ the menu (food.ts / londonLayout.ts MENU)

        static float[] W(params (FoodKind k, float w)[] e)
        {
            var a = new float[Enum.GetValues(typeof(FoodKind)).Length];
            foreach (var (k, w) in e) a[(int)k] = w;
            return a;
        }

        /// <summary>Trafalgar Square and Piccadilly Circus: jelly babies.</summary>
        static readonly float[] SWEETS = W((FoodKind.JellyBaby, 5), (FoodKind.Biscuit, 1));
        /// <summary>Covent Garden market: fruit (and a scone).</summary>
        static readonly float[] MARKET = W((FoodKind.Apple, 3), (FoodKind.Strawberry, 3), (FoodKind.Scone, 1));
        /// <summary>Borough Market: veg and a pie.</summary>
        static readonly float[] BOROUGH_MENU = W((FoodKind.Broccoli, 3), (FoodKind.Carrot, 3), (FoodKind.Pie, 2));
        /// <summary>The South Bank: crumpets, sausage rolls, chips.</summary>
        static readonly float[] SOUTH_BANK_MENU = W((FoodKind.Crumpet, 3), (FoodKind.SausageRoll, 2), (FoodKind.FishChips, 2));
        /// <summary>The City: bagels and pies.</summary>
        static readonly float[] CITY = W((FoodKind.Bagel, 3), (FoodKind.Pie, 2), (FoodKind.Tea, 1));
        /// <summary>The Palace and St James's Park: afternoon tea.</summary>
        static readonly float[] PALACE_MENU = W((FoodKind.Sandwich, 3), (FoodKind.Scone, 3), (FoodKind.Sponge, 2), (FoodKind.Tea, 2));
        /// <summary>Hyde Park: strawberries and a picnic.</summary>
        static readonly float[] PARK = W((FoodKind.Strawberry, 3), (FoodKind.Sandwich, 1), (FoodKind.Biscuit, 1), (FoodKind.Apple, 1));
        /// <summary>Along the Thames: fish and chips.</summary>
        static readonly float[] RIVER = W((FoodKind.FishChips, 4), (FoodKind.SausageRoll, 1), (FoodKind.Tea, 1));
        /// <summary>Everywhere else: a London street mix.</summary>
        static readonly float[] STREET = W((FoodKind.SausageRoll, 3), (FoodKind.Biscuit, 2.5f), (FoodKind.Tea, 2), (FoodKind.Sandwich, 0.7f), (FoodKind.Scone, 0.5f),
            (FoodKind.Pie, 0.5f), (FoodKind.FishChips, 0.4f), (FoodKind.JellyBaby, 0.4f));

        static bool Near(float x, float z, Circle p, float r) => (x - p.x) * (x - p.x) + (z - p.z) * (z - p.z) < r * r;

        public override FoodKind FoodKindAt(Rng rng, float x, float z)
        {
            float[] menu;
            if (Near(x, z, NELSON, 9) || Near(x, z, PICCADILLY_FOUNTAIN, 9)) menu = SWEETS;
            else if (COVENT_GARDEN.Contains(x, z)) menu = MARKET;
            else if (BOROUGH.Contains(x, z)) menu = BOROUGH_MENU;
            else if (SOUTH_BANK.Contains(x, z)) menu = SOUTH_BANK_MENU;
            else if (THE_CITY.Contains(x, z)) menu = CITY;
            else if (PALACE_GARDEN.Contains(x, z) || ST_JAMES.Contains(x, z)) menu = PALACE_MENU;
            else if (HYDE_PARK.Contains(x, z)) menu = PARK;
            else if (RiverDistance(x, z) < THAMES.width / 2 + 5) menu = RIVER;
            else menu = STREET;
            return Foods.Pick(rng, menu);
        }

        // ------------------------------------------------------------ traffic (A3)

        /// <summary>
        /// The bus and cab routes, as road centre lines with their stops as vertex indices; each becomes a lane
        /// loop (Vehicles.LaneLoop). The 11 along the Embankment, the 12 over Westminster Bridge to Borough, and
        /// the cabs from the Strand to the Tower and over Tower Bridge (narrower lanes).
        /// </summary>
        public static readonly Route[] ROUTES =
        {
            Vehicles.LaneLoop("bus-north", new float[] { -78, -8.5f, -72, -9.25f, -58, -11, -48, -13.2f, -36, -15, -18, -22, -12.6f, -22.6f, 0, -24, 22, -20, 28.6f, -16.7f, 44, -9 }, new[] { 1, 6, 9 }),
            Vehicles.LaneLoop("bus-south", new float[] { -36, 0, -30, 2, -12, 2, -7, 6, 4, 7.5f, 5.8f, 10.65f, 10, 18, 24, 24, 28.8f, 25.2f, 40, 28 }, new[] { 1, 5, 8 }),
            Vehicles.LaneLoop("cab", new float[] { 8, -37.67f, 16, -35, 34, -33, 48, -28, 62, -26, 73, -25, 78, -14, 78, 2, 80, 16, 77, 30, 52, 30 }, new int[0], 0.95f),
        };

        /// <summary>Five buses and three cabs.</summary>
        static readonly Traffic[] TRAFFIC =
        {
            new Traffic(VehicleKind.Bus, "bus-north", 3), new Traffic(VehicleKind.Bus, "bus-south", 2), new Traffic(VehicleKind.Cab, "cab", 3),
        };

        /// <summary>The raven pair's homes: two of the six ravens on the Tower's south wall walk, at RAVEN_PERCH_Y metres up.</summary>
        public static readonly float[] RAVEN_PERCHES = { TOWER.x - 1.2f, TOWER.z + TOWER.d / 2 - 0.27f, TOWER.x + 4.6f, TOWER.z + TOWER.d / 2 - 0.27f };
        public const float RAVEN_PERCH_Y = 3.2f;

        // ------------------------------------------------------------ the set pieces (A6)

        /// <summary>The river bus's piers: Westminster, Bankside (by the Globe) and Tower.</summary>
        public static readonly Pier[] PIERS =
        {
            new Pier { id = "westminster", atX = -20.5f, atZ = -5, boardX = -27.7f, boardZ = -8.6f, @out = (float)Math.Atan2(-3.6, -7.2) },
            new Pier { id = "bankside", atX = 16, atZ = -9.2f, boardX = 13.7f, boardZ = -1.5f, @out = (float)Math.Atan2(7.7, -2.3) },
            new Pier { id = "tower", atX = 51.4f, atZ = 7.4f, boardX = 54.1f, boardZ = -0.1f, @out = (float)Math.Atan2(-7.5, 2.7) },
        };

        public static readonly SetPieceSpots SET_PIECES = MakeSetPieces();
        static SetPieceSpots MakeSetPieces()
        {
            var fw = new float[18];
            for (int i = 0; i < 9; i++) { Sim.SetPieces.AlongPath(THAMES.path, 50 + i * 14, out float x, out float z, out _); fw[i * 2] = x; fw[i * 2 + 1] = z; }
            return new SetPieceSpots
            {
                bigBenX = BIG_BEN.x, bigBenZ = BIG_BEN.z,
                // The bottom capsule hangs over the strip of bank between the Eye's legs and the water.
                eyeBoardX = -6, eyeBoardZ = -4.4f, eyeExitX = -1.5f, eyeExitZ = -1.5f, eyeHeading = 0,
                span = TOWER_BRIDGE_SPAN, bridgesUp = BRIDGES_LIFTED, millennium = MILLENNIUM_BRIDGE,
                // From the Palace gates down the Mall, stopping short of Trafalgar's lions.
                parade = new float[] { -35.5f, -25.6f, -24, -33, -20.5f, -35.5f },
                piers = PIERS, river = THAMES.path,
                arrows = new[] { new float[] { -100, 22, 100, 4 }, new float[] { -100, -62, 100, 56 }, new float[] { -22, -82, 12, 82 } },
                fireworks = fw,
            };
        }

        public override bool HasCreatureHomes => true;

        static void Around(Rng rng, float cx, float cz, float r0, float r1, out float x, out float z)
        {
            float a = rng.Range(0, Collide.PI * 2), d = rng.Range(r0, r1);
            x = cx + (float)Math.Cos(a) * d; z = cz + (float)Math.Sin(a) * d;
        }

        /// <summary>Each legend's haunt (londonLayout.ts legendHome).</summary>
        public override void CreatureHome(Rng rng, CreatureKind kind, out float x, out float z)
        {
            switch (kind)
            {
                case CreatureKind.Fairy:
                case CreatureKind.Unicorn: Around(rng, ELFIN_OAK.x, ELFIN_OAK.z, 2.5f, 8, out x, out z); return;
                case CreatureKind.Mermaid:
                {
                    // Just off the water's edge, either bank, somewhere along the river.
                    var p = THAMES.path;
                    int i = rng.Int(p.Length / 2 - 1);
                    float t = rng.Next();
                    float ax = p[i * 2], az = p[i * 2 + 1], dx = p[i * 2 + 2] - ax, dz = p[i * 2 + 3] - az;
                    float px = ax + dx * t, pz = az + dz * t;
                    float len = Collide.Hypot(dx, dz);
                    if (len == 0) len = 1;
                    float side = rng.Next() < 0.5f ? -1 : 1;
                    float off = THAMES.width / 2 + rng.Range(1.8f, 3.5f);
                    x = px - dz / len * off * side; z = pz + dx / len * off * side;
                    return;
                }
                case CreatureKind.Ghost: Around(rng, TOWER.x, TOWER.z, 9, 14, out x, out z); return;
                case CreatureKind.Phoenix: Around(rng, ST_PAULS_DOME.x - 3, ST_PAULS_DOME.z, 7, 12, out x, out z); return;
                case CreatureKind.Dragon:
                case CreatureKind.Gog: Inside(rng, THE_CITY, out x, out z); return;
                case CreatureKind.LionRoyal: Inside(rng, PALACE_GARDEN, out x, out z); return;
                case CreatureKind.Pearly: Inside(rng, COVENT_GARDEN, out x, out z); return;
                default: x = rng.Range(BOUNDS.minX, BOUNDS.maxX); z = rng.Range(BOUNDS.minZ, BOUNDS.maxZ); return;
            }
        }

        static void Inside(Rng rng, Box b, out float x, out float z) { x = rng.Range(b.x - b.w / 2, b.x + b.w / 2); z = rng.Range(b.z - b.d / 2, b.z + b.d / 2); }

        static void AlongRoad(Rng rng, float[] path, float spread, out float x, out float z)
        {
            int i = rng.Int(path.Length / 2 - 1);
            float t = rng.Next();
            x = path[i * 2] + (path[i * 2 + 2] - path[i * 2]) * t + rng.Range(-spread, spread);
            z = path[i * 2 + 1] + (path[i * 2 + 3] - path[i * 2 + 1]) * t + rng.Range(-spread, spread);
        }

        static float[] RoadPath(string id) { foreach (var r in ROADS) if (r.id == id) return r.path; return null; }

        public override void HomePoint(Rng rng, Home home, out float x, out float z)
        {
            switch (home)
            {
                case Home.Woods:
                case Home.Green:
                    // Squirrels in the parks.
                    Inside(rng, rng.Next() < 0.75f ? HYDE_PARK : ST_JAMES, out x, out z); return;
                case Home.Lagoon:
                case Home.Lake:
                {
                    // On the bank of a painted lake, just off the water: the swans', ducks' and pelicans' banks.
                    var e = rng.Next() < 0.5f ? SERPENTINE : ST_JAMES_LAKE;
                    float t = rng.Range(0, Collide.PI * 2);
                    float u = (e.rx + 1) * (float)Math.Cos(t), v = (e.rz + 1) * (float)Math.Sin(t);
                    x = e.x + u * (float)Math.Cos(e.rot) - v * (float)Math.Sin(e.rot);
                    z = e.z + u * (float)Math.Sin(e.rot) + v * (float)Math.Cos(e.rot);
                    return;
                }
                case Home.Palace: AlongRoad(rng, RoadPath("mall"), 3, out x, out z); return; // the corgis and the guard horse, on the Mall
                case Home.Trafalgar: x = NELSON.x + rng.Range(-7, 7); z = NELSON.z + rng.Range(-6, 6); return;
                case Home.River: AlongRoad(rng, rng.Next() < 0.6f ? RoadPath("embankment") : RoadPath("southbank"), 2, out x, out z); return; // gulls on the Embankment
                case Home.Museum: x = MUSEUM.x + rng.Range(-8, 8); z = MUSEUM.z + MUSEUM.d / 2 + rng.Range(1.5f, 5); return;
                default:
                    x = rng.Range(BOUNDS.minX, BOUNDS.maxX); z = rng.Range(BOUNDS.minZ, BOUNDS.maxZ); return;
            }
        }
    }
}
