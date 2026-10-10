using System;
using System.Collections.Generic;

namespace Telfer.Sim
{
    public enum StageId { School, Common, London }

    /// <summary>What a stage needs to place its warden: Mr Cooper at school, the park keeper on the Common.</summary>
    public sealed class WardenConfig
    {
        public float spawnX, spawnZ;
        public Bounds2 beat;
        public string[] general, near, big, bump;
        /// <summary>Which figure the views draw: "cooper" (the head teacher), "keeper" or "bobby" (London's policeman).</summary>
        public string persona = "cooper";
    }

    /// <summary>
    /// A place to play (port of stage.ts): its fence and fixed solids, where things spawn and live, and
    /// who patrols it. The sim never reads a layout as a global: everything takes the stage it runs on.
    /// </summary>
    /// <summary>Someone standing about with a few things to say (stage.ts Chatter).</summary>
    public sealed class Chatter
    {
        public string id;
        public float x, z;
        public string[] lines;
    }

    public abstract class Stage : ITerrain
    {
        public abstract StageId Id { get; }
        public abstract string Name { get; }
        public abstract Bounds2 Bounds { get; }
        public abstract Box[] SolidBoxes { get; }
        public abstract Circle[] SolidCircles { get; }

        public float SpawnX, SpawnZ, SpawnHeading;
        /// <summary>A known-open spot well away from the snake spawn: the last resort when nothing else fits.</summary>
        public float FallbackX, FallbackZ;
        public AnimalKind[] AnimalKinds = new AnimalKind[0];
        /// <summary>Nobody can be bonked inside this box (the blue sail at school).</summary>
        public Box? Sanctuary;
        public float FoodScale = 1;
        /// <summary>Rocks and sticks spawn here (a rough corner gets `HazardShare` of them). False: none.</summary>
        public bool HasHazards;
        public Bounds2 HazardRough;
        public float HazardShare;
        /// <summary>Solids the snake goes round but the children clamber over (the Common's fallen log).</summary>
        public Circle[] Logs = new Circle[0];
        public (PredatorKind kind, int count)[] Predators = new (PredatorKind, int)[0];
        public KidKind[] Kids = new KidKind[0];
        public int CreatureCount;
        public int ExtraRivals;
        /// <summary>Miss Sami and a mum by the road mouth (the Common), or null.</summary>
        public float[] Greeters;
        public WardenConfig Warden;
        /// <summary>London's Thames (null elsewhere): swum at half speed, the current carrying you downstream.</summary>
        public WaterZone[] Water;
        /// <summary>Decks over the water that count as dry land (null without water).</summary>
        public Box[] Bridges;
        /// <summary>How close the chase camera sits here, as a share of the usual (stage.ts cameraZoom).</summary>
        public float CameraZoom = 1;
        /// <summary>Which hazards this stage scatters, drawn from in this order (stage.ts hazardKinds). The school's three by default.</summary>
        public HazardKind[] HazardKinds = { HazardKind.Rock, HazardKind.Stones, HazardKind.Sticks };
        /// <summary>How many of a kind live here, and where, where it differs from the kind's own spec (London's big pigeon flock). Null: none.</summary>
        public Dictionary<AnimalKind, int> AnimalCounts;
        public Dictionary<AnimalKind, Home> AnimalHomes;
        /// <summary>London's roads the buses and cabs drive (lane loops), who drives them, and the zebras they stop at. Null elsewhere.</summary>
        public Route[] Routes;
        public Traffic[] Traffic;
        public Zebra[] Zebras;
        /// <summary>Where the stone lions sleep, and where the raven pair roost (x, z pairs). Null elsewhere.</summary>
        public float[] Plinths, Perches;

        /// <summary>London's people (A4): each tourist's sight and the buskers' pitches (x, z pairs, in Kids order), the school trip's closed walk, the living statue, the Royal Guard. Null elsewhere.</summary>
        public float[] TouristSpots, BuskerSpots, TripPath, Statue, Guard;
        /// <summary>Grown-ups standing about with things to say (the tour guide, the Beefeater). Null elsewhere.</summary>
        public Chatter[] Chatters;
        /// <summary>Which creatures may be picked, in draw order. Null: the Common's eight.</summary>
        public CreatureKind[] CreatureKinds;
        /// <summary>London's Crown Jewels: where they may lie (x, z pairs; the first is always used). Null: none.</summary>
        public float[] JewelSpots;
        /// <summary>The Tube stations (x, z pairs): step in at one, out at the next. Null elsewhere.</summary>
        public float[] Portals;
        /// <summary>London's set pieces (A6): Big Ben, Tower Bridge, the Eye, the parade, the boat. Null elsewhere.</summary>
        public SetPieceSpots SetPieces;

        /// <summary>Does the stage name a home per creature kind (London's legends)? Then CreatureHome is used.</summary>
        public virtual bool HasCreatureHomes => false;
        public virtual void CreatureHome(Rng rng, CreatureKind kind, out float x, out float z) { HomePoint(rng, Home.Anywhere, out x, out z); }

        /// <summary>A copy for one world: a stage with set pieces changes under the snakes (Tower Bridge lifts).</summary>
        public Stage Copy() => (Stage)MemberwiseClone();

        public int AnimalCount(AnimalKind k) => AnimalCounts != null && AnimalCounts.TryGetValue(k, out int n) ? n : Animals.SPECS[(int)k].count;

        public abstract FoodKind FoodKindAt(Rng rng, float x, float z);
        public abstract void HomePoint(Rng rng, Home home, out float x, out float z);

        public static Stage For(StageId id) => id == StageId.Common ? Common.Stage : id == StageId.London ? London.Stage : (Stage)School.Stage;
    }
}
