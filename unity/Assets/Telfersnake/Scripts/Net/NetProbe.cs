using System.Collections.Generic;
using System.Diagnostics;
using System.Text;
using Telfer.Sim;
using UnityEngine;

namespace Telfer.Net
{
    /// <summary>
    /// Dev check of the network layer, from Tools/ev.sh in play mode: <c>Telfer.Net.NetProbe.Run()</c>
    /// joins the school, steers in a circle for a while, then leaves; poll <see cref="Status"/>.
    /// </summary>
    public sealed class NetProbe : MonoBehaviour
    {
        public static string Status = "idle";

        Connection net;
        readonly Stopwatch clock = new Stopwatch();
        float seconds;
        int q, snaps, bytes, lastK = -1, gaps, maxAckLag;
        double stepsDone;
        readonly Dictionary<string, int> events = new Dictionary<string, int>();
        Snapshot last;

        public static string Run(float seconds = 2.5f, string url = null)
        {
            var probe = new GameObject("NetProbe") { hideFlags = HideFlags.HideAndDontSave }.AddComponent<NetProbe>();
            probe.seconds = seconds;
            probe.net = Connection.Join(url ?? ServerUrl.Resolve(),
                ClientMessage.Hello(Mode.Normal, StageId.School, false, "telfer", "no-hat", "no-trail", "Unity Probe"));
            probe.clock.Start();
            Status = "connecting to " + probe.net.Url + " (check: " + (Protocol.Check() == "" ? "kinds ok" : Protocol.Check()) + ")";
            return Status;
        }

        void Update()
        {
            foreach (var m in net.Poll())
            {
                if (m is Snapshot s)
                {
                    snaps++; bytes += s.bytes;
                    if (lastK >= 0 && s.k != lastK + Protocol.SNAPSHOT_EVERY) gaps++;
                    lastK = s.k; last = s;
                    maxAckLag = Mathf.Max(maxAckLag, q - s.you.ack);
                    foreach (var e in s.e) events[e.type] = events.TryGetValue(e.type, out var n) ? n + 1 : 1;
                }
            }
            if (net.State == NetState.Connecting) return;
            if (net.State == NetState.Joined)
            {
                // One input per elapsed 1/60 s step, like the sim loop; the connection sends the even ones.
                double due = clock.Elapsed.TotalSeconds * 60;
                if (due - stepsDone > 8) stepsDone = due - 8; // a long editor hitch is not worth replaying
                for (; stepsDone < due; stepsDone++)
                {
                    q++;
                    float a = q * 0.02f;
                    net.Input(q, Mathf.Cos(a), Mathf.Sin(a), true, false);
                }
                Status = "joined " + net.Welcome.room + ", " + snaps + " snapshots so far";
                if (clock.Elapsed.TotalSeconds < seconds) return;
                net.Leave();
            }
            Status = Summary();
            Destroy(gameObject);
        }

        string Summary()
        {
            var sb = new StringBuilder();
            sb.Append("state=").Append(net.State).Append(" why=").Append(net.Why).Append(" socket=").Append(net.SocketWhy);
            var w = net.Welcome;
            if (w == null) return sb.ToString();
            sb.Append("\nroom=").Append(w.room).Append(" me=").Append(w.me).Append(" stage=").Append(w.stage).Append(" tick=").Append(w.tick)
              .Append(" seats=").Append(w.seats.Length).Append(" hazards=").Append(w.hazards.Length).Append(" animals=").Append(w.animalKinds.Length)
              .Append(" foods=").Append(w.foods.Length).Append(" pellets=").Append(w.pellets.Length);
            sb.Append("\nseats:");
            foreach (var seat in w.seats)
                sb.Append(' ').Append(seat.id).Append(':').Append(seat.look.name).Append(seat.bot ? "(bot)" : "")
                  .Append(seat.look.pattern != null ? "[pattern " + seat.look.pattern.Length + "]" : "");
            sb.Append("\nsnapshots=").Append(snaps).Append(" avgBytes=").Append(snaps > 0 ? bytes / snaps : 0).Append(" gaps=").Append(gaps)
              .Append(" q=").Append(q).Append(" maxAckLag=").Append(maxAckLag);
            if (last != null)
            {
                var me = w.me < last.s.Length ? last.s[w.me] : default;
                var levels = new int[16];
                Protocol.UnpackUpgrades(me.upgrades, levels);
                sb.Append("\nme: x=").Append(me.x).Append(" z=").Append(me.z).Append(" h=").Append(me.heading).Append(" mass=").Append(me.mass)
                  .Append(" score=").Append(me.score).Append(" alive=").Append(me.Alive).Append(" flags=").Append(me.flags)
                  .Append(" immune=").Append(me.immune).Append(" upgrades=").Append(me.upgrades).Append(" magic=").Append(me.magic);
                sb.Append("\nyou: ack=").Append(last.you.ack).Append(" xp=").Append(last.you.xp).Append(" level=").Append(last.you.level)
                  .Append(" speed=").Append(last.you.speedFactor).Append(" cards=").Append(last.you.cards == null ? "none" : string.Join(",", last.you.cards));
                sb.Append("\nrows: s=").Append(last.s.Length).Append(" a=").Append(last.a.Length).Append(" pd=").Append(last.pd.Length)
                  .Append(" kd=").Append(last.kd.Length).Append(" cr=").Append(last.cr.Length).Append(" pj=").Append(last.pj.Length)
                  .Append(" cooper=").Append(last.c.x).Append(',').Append(last.c.z);
                int best = 0;
                for (int i = 1; i < last.s.Length; i++) if (last.s[i].upgrades > last.s[best].upgrades) best = i;
                Protocol.UnpackUpgrades(last.s[best].upgrades, levels);
                sb.Append("\nsnake ").Append(best).Append(" levels:");
                for (int i = 0; i < levels.Length; i++) if (levels[i] > 0) sb.Append(' ').Append((UpgradeId)i).Append('=').Append(levels[i]);
            }
            sb.Append("\nevents:");
            foreach (var kv in events) sb.Append(' ').Append(kv.Key).Append('=').Append(kv.Value);
            return sb.ToString();
        }
    }
}
