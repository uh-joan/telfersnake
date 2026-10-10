using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using Telfer.Sim;

namespace Telfer.EditorTools
{
    /// <summary>
    /// The C# half of the parity trace (scripts/trace.ts): the same scripted London run, or the same traffic
    /// with scripted walkers, dumped in the same JSON shape so `tsx scripts/trace.ts compare` can line them up.
    ///   Tools/ev.sh 'return Telfer.EditorTools.LondonTrace.World(7, 3600, "/tmp/world-cs.json");'
    ///   Tools/ev.sh 'return Telfer.EditorTools.LondonTrace.Traffic(1200, "/tmp/traffic-cs.json");'
    /// </summary>
    public static class LondonTrace
    {
        /// <summary>The player's tour (scripts/trace.ts TOUR).</summary>
        static readonly float[] TOUR =
        {
            -36, -6, -30, -22, -20, -34, -12, -36, -4, -38, 4, -39, 20, -35, 34, -33, 48, -26, 55, -12, 50, -24, 20, -30, -12, -34, -30, -22, -40, 0,
        };

        /// <summary>The classic sim's name for an event (world.ts GameEvent type).</summary>
        static string Name(EventType t)
        {
            switch (t)
            {
                case EventType.BumpWall: case EventType.BumpCooper: case EventType.BumpKid: return "bump";
                case EventType.TeaTime: return "teatime";
                case EventType.VBonk: return "vbonk";
                default: return t.ToString().ToLowerInvariant();
            }
        }

        /// <summary>Seeds `seed`..`lastSeed` (counts summed; the per-tick rows are the first seed's).</summary>
        public static string World(int seed, int lastSeed, int ticks, string path)
        {
            var counts = new SortedDictionary<string, int>();
            var events = new List<List<string>>();
            var pos = new List<List<float>>();
            for (int sd = seed; sd <= lastSeed; sd++) Run(sd, ticks, counts, sd == seed ? events : null, sd == seed ? pos : null);
            File.WriteAllText(path, Json("world", seed, ticks, counts, events, pos));
            return Summary(counts);
        }

        public static string World(int seed, int ticks, string path) => World(seed, seed, ticks, path);

        static void Run(int seed, int ticks, SortedDictionary<string, int> counts, List<List<string>> events, List<List<float>> pos)
        {
            var w = new World((uint)seed, Mode.Normal, London.Stage);
            int leg = 0;
            for (int t = 0; t < ticks; t++)
            {
                if (w.Me.cards != null) w.Choose(0);
                var s = w.Me;
                int k = leg % (TOUR.Length / 2);
                float tx = TOUR[k * 2], tz = TOUR[k * 2 + 1];
                if (Collide.Hypot(tx - s.x, tz - s.z) < 3) leg++;
                float dx = tx - s.x, dz = tz - s.z, d = Collide.Hypot(dx, dz);
                if (d == 0) d = 1;
                w.Step(new SnakeInput { x = dx / d, z = dz / d, active = true, dash = (t / 90) % 6 == 5 });
                var types = new List<string>();
                foreach (var e in w.Events)
                {
                    var n = Name(e.type);
                    counts[n] = (counts.TryGetValue(n, out int c) ? c : 0) + 1;
                    types.Add(n);
                }
                w.Events.Clear();
                if (t < 600 && pos != null)
                {
                    events.Add(types);
                    var row = new List<float> { w.Me.x, w.Me.z };
                    foreach (var v in w.Vehicles) { row.Add(v.x); row.Add(v.z); }
                    foreach (var p in w.Predators) { row.Add(p.x); row.Add(p.z); row.Add(p.state); }
                    for (int i = 0; i < 6 && i < w.Animals.Count; i++) { row.Add(w.Animals[i].x); row.Add(w.Animals[i].z); }
                    pos.Add(row);
                }
            }
        }

        public static string Traffic(int ticks, string path)
        {
            var st = London.Stage;
            var lanes = new List<Lane>();
            foreach (var r in st.Routes) lanes.Add(Vehicles.MakeLane(r, st.Zebras));
            var vehicles = Vehicles.Make(st.Traffic, st.Routes, lanes);
            var counts = new SortedDictionary<string, int>();
            var events = new List<List<string>>();
            var pos = new List<List<float>>();
            var walkers = new List<Walker>();
            for (int t = 0; t < ticks; t++)
            {
                walkers.Clear();
                if (t < 400 && lanes[0].zebras.Length > 0) walkers.Add(new Walker { x = lanes[0].zebraAt[0], z = lanes[0].zebraAt[1], r = 0.4f });
                else if (t < 800) walkers.Add(new Walker { x = lanes[1].route.path[6], z = lanes[1].route.path[7], r = 0.5f });
                var types = new List<string>();
                foreach (var v in vehicles)
                    Vehicles.Drive(v, lanes[v.route], vehicles, walkers, 1f / 60f, (veh, honk) =>
                    {
                        var n = honk ? "honk" : "ding";
                        counts[n] = (counts.TryGetValue(n, out int c) ? c : 0) + 1;
                        types.Add(n);
                    });
                events.Add(types);
                var row = new List<float>();
                foreach (var v in vehicles) { row.Add(v.x); row.Add(v.z); row.Add(v.speed); }
                pos.Add(row);
            }
            File.WriteAllText(path, Json("traffic", 0, ticks, counts, events, pos));
            return Summary(counts);
        }

        static string Summary(SortedDictionary<string, int> counts)
        {
            var sb = new StringBuilder();
            foreach (var kv in counts) sb.Append(kv.Key).Append(':').Append(kv.Value).Append(' ');
            return sb.ToString();
        }

        static string Json(string kind, int seed, int ticks, SortedDictionary<string, int> counts, List<List<string>> events, List<List<float>> pos)
        {
            var ci = CultureInfo.InvariantCulture;
            var sb = new StringBuilder();
            sb.Append("{\"kind\":\"").Append(kind).Append("\",\"seed\":").Append(seed).Append(",\"ticks\":").Append(ticks).Append(",\"counts\":{");
            bool first = true;
            foreach (var kv in counts) { if (!first) sb.Append(','); first = false; sb.Append('"').Append(kv.Key).Append("\":").Append(kv.Value); }
            sb.Append("},\"events\":[");
            for (int i = 0; i < events.Count; i++)
            {
                if (i > 0) sb.Append(',');
                sb.Append('[');
                for (int j = 0; j < events[i].Count; j++) { if (j > 0) sb.Append(','); sb.Append('"').Append(events[i][j]).Append('"'); }
                sb.Append(']');
            }
            sb.Append("],\"pos\":[");
            for (int i = 0; i < pos.Count; i++)
            {
                if (i > 0) sb.Append(',');
                sb.Append('[');
                for (int j = 0; j < pos[i].Count; j++) { if (j > 0) sb.Append(','); sb.Append(pos[i][j].ToString("R", ci)); }
                sb.Append(']');
            }
            sb.Append("]}");
            return sb.ToString();
        }
    }
}
