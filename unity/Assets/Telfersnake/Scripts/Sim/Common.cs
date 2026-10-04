using System;
using System.Collections.Generic;

namespace Telfer.Sim
{
    /// <summary>
    /// Level 2: the Common (port of commonLayout.ts). You come down Telferscot Road between terraced
    /// houses, cross Emmanuel Road, and out into a meadow ringed by woods, with copses to weave around.
    /// Metres, +x east, +z south.
    /// </summary>
    public sealed class Common : Stage
    {
        static Common stage;
        public static Common Stage => stage ?? (stage = new Common());

        public static readonly Bounds2 BOUNDS = new Bounds2(-60, 60, -100, 60);
        public static readonly Box[] HOUSES = { new Box(-33, -71, 54, 58), new Box(33, -71, 54, 58) };
        public static readonly Box EAST_ROAD = new Box(57, 9, 6, 102);
        public static readonly Box[] WOODS = { new Box(-52, 9, 16, 86), new Box(-5, 56, 110, 8), new Box(-34, 44, 20, 20), new Box(40, 42, 16, 24) };
        public static readonly Circle[] COPSES =
        {
            new Circle(30, -12, 5), new Circle(6, -6, 3), new Circle(-18, 22, 1.4f), new Circle(12, 32, 1.4f), new Circle(-8, -22, 1), new Circle(38, 26, 1.6f),
        };
        public const float GLADE_X = 0, GLADE_Z = 46;
        public const float LOG_X = 43, LOG_Z = -25, LOG_ANGLE = 0.5f, LOG_HALF = 5.2f, LOG_R = 0.85f;
        public static readonly float LOG_DX = (float)Math.Cos(LOG_ANGLE), LOG_DZ = -(float)Math.Sin(LOG_ANGLE);
        public const float SAMI_X = -2.5f, SAMI_Z = -91, MUM_X = 1, MUM_Z = -90.5f;
        /// <summary>The playground (a landmark, low on the west of the meadow).</summary>
        public const float PLAY_X = -15, PLAY_Z = 32;

        public static readonly float[] WEIGHTS = { 1, 1, 1.5f, 1, 1, 1.5f, 3, 2.5f, 3, 2 };

        readonly Box[] solidBoxes;

        public override StageId Id => StageId.Common;
        public override string Name => "The Common";
        public override Bounds2 Bounds => BOUNDS;
        public override Box[] SolidBoxes => solidBoxes;
        public override Circle[] SolidCircles => COPSES;

        Common()
        {
            var list = new List<Box>(HOUSES) { EAST_ROAD };
            list.AddRange(WOODS);
            solidBoxes = list.ToArray();
            SpawnX = 0; SpawnZ = 4; SpawnHeading = 0;
            FallbackX = 0; FallbackZ = -80;
            AnimalKinds = new[] { AnimalKind.Squirrel, AnimalKind.Crow, AnimalKind.Deer, AnimalKind.Hedgehog, AnimalKind.Fox, AnimalKind.Pigeon, AnimalKind.Rabbit, AnimalKind.Duck };
            FoodScale = 2;
            var logs = new List<Circle>();
            for (float t = -LOG_HALF; t <= LOG_HALF + 0.01f; t += 1.5f) logs.Add(new Circle(LOG_X + LOG_DX * t, LOG_Z + LOG_DZ * t, LOG_R));
            Logs = logs.ToArray();
            Predators = new[] { (PredatorKind.Bear, 1), (PredatorKind.Wolf, 2) };
            Kids = new[] { KidKind.Runner, KidKind.Naughty, KidKind.Nice, KidKind.Runner, KidKind.Naughty, KidKind.Nice, KidKind.Runner, KidKind.Naughty };
            CreatureCount = 4;
            ExtraRivals = 4;
            Greeters = new[] { SAMI_X, SAMI_Z, MUM_X, MUM_Z };
            Warden = new WardenConfig
            {
                spawnX = 12, spawnZ = 8, beat = new Bounds2(-38, 46, -26, 42), persona = "keeper",
                general = new[]
                {
                    "No running on the grass, please!", "Mind the flowerbeds!", "Litter in the bin, thank you!", "Keep dogs on their leads, please!",
                    "Lovely day for it. Do slow down.", "Who left this gate open?", "Mind the fresh mowing!", "Bikes off the grass, thank you!",
                    "That is not what the benches are for.", "Respect the wildlife, please. And walking feet.", "Be sure to take your litter home!",
                },
                near = new[]
                {
                    "Oi! No slithering at speed!", "Steady on — this is a park, not a racetrack.", "Walking pace on the grass, if you please.",
                    "Slow down — there are little ones about.", "Move along, nothing to forage here.",
                },
                big = new[] { "Crikey. You have grown. Still no running!", "Goodness me. Mind the trees, would you." },
                bump = new[] { "I beg your pardon!", "Watch where you slither!", "Careful! You nearly had me over." },
            };
        }

        public override FoodKind FoodKindAt(Rng rng, float x, float z) => Foods.Pick(rng, WEIGHTS);

        public override void HomePoint(Rng rng, Home home, out float x, out float z)
        {
            switch (home)
            {
                case Home.Anywhere:
                    x = rng.Range(BOUNDS.minX, BOUNDS.maxX); z = rng.Range(BOUNDS.minZ, BOUNDS.maxZ); return;
                case Home.Woods:
                {
                    var t = COPSES[rng.Int(COPSES.Length)];
                    x = t.x + rng.Range(-t.r - 2, t.r + 2); z = t.z + rng.Range(-t.r - 2, t.r + 2); return;
                }
                case Home.Glade:
                    x = GLADE_X + rng.Range(-6, 6); z = GLADE_Z + rng.Range(-5, 5); return;
                default:
                    x = rng.Range(-40, 46); z = rng.Range(-28, 46); return;
            }
        }

        /// <summary>How high a point sits on the fallen log (0 off it): the children ride it as they clamber.</summary>
        public static float LogClamberHeight(float x, float z)
        {
            float dx = x - LOG_X, dz = z - LOG_Z;
            float along = dx * LOG_DX + dz * LOG_DZ;
            float perp = Math.Abs(dx * -LOG_DZ + dz * LOG_DX);
            if (Math.Abs(along) > LOG_HALF + 0.4f || perp > LOG_R + 0.3f) return 0;
            float dome = (float)Math.Sqrt(Math.Max(0, LOG_R * LOG_R - perp * perp));
            float endFade = Math.Min(1, (LOG_HALF + 0.4f - Math.Abs(along)) / 0.9f);
            return (LOG_R * 0.5f + dome) * endFade;
        }
    }
}
