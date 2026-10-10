using System.Collections.Generic;
using Telfer.Sim;
using UnityEngine;
using UnityEngine.Rendering;

namespace Telfer.View
{
    /// <summary>
    /// The Common's cast on screen: bears and wolves, the children (with their pebbles and kisses), the
    /// shy glowing creatures, and Miss Sami nattering with a mum. Interpolated between sim steps.
    /// </summary>
    public sealed class WildViews
    {
        readonly World world;
        readonly Transform root;
        readonly MaterialPropertyBlock mpb = new MaterialPropertyBlock();

        sealed class Beast { public Transform t, body; public MeshRenderer r; public Vector3 prev, cur; public float yaw, punch; public Transform ice; }
        sealed class Child { public Models.Rig rig; public Vector3 prev, cur; public float yaw, throwT; }
        sealed class Magic { public Transform t, body, ring; public Material ringMat; public Vector3 prev, cur; public float yaw, show; }

        readonly List<Beast> beasts = new List<Beast>();
        readonly List<Child> kids = new List<Child>();
        readonly List<Magic> creatures = new List<Magic>();
        readonly List<(Transform t, ProjectileKind kind)> shots = new List<(Transform, ProjectileKind)>();
        Models.Rig sami, mum;
        float samiTalk;
        /// <summary>London's lions, ravens and traffic (null elsewhere); its beasts leave a null in `beasts`.</summary>
        readonly LondonViews london;

        public WildViews(World w, Transform parent)
        {
            world = w;
            root = new GameObject("Wild").transform;
            root.SetParent(parent, false);
            foreach (var p in w.Predators)
            {
                if (p.kind == PredatorKind.Lion || p.kind == PredatorKind.Raven) { beasts.Add(null); continue; } // LondonViews draws them
                var t = new GameObject(p.kind.ToString()).transform;
                t.SetParent(root, false);
                var body = new GameObject("body", typeof(MeshFilter), typeof(MeshRenderer));
                body.transform.SetParent(t, false);
                body.GetComponent<MeshFilter>().sharedMesh = ModelsWild.Predator(p.kind);
                var r = body.GetComponent<MeshRenderer>();
                r.sharedMaterial = Mats.VertexGlossy;
                var ice = new GameObject("ice", typeof(MeshFilter), typeof(MeshRenderer));
                ice.transform.SetParent(t, false);
                var ik = new MeshKit();
                ik.C = new Color(0.75f, 0.92f, 1f);
                ik.Blob(new Vector3(0, p.Spec.radius * 1.1f, 0), Vector3.one * p.Spec.radius * 1.9f, 0.15f, 3, 1, true);
                ice.GetComponent<MeshFilter>().sharedMesh = RunAssets.Track(ik.ToMesh("ice"));
                ice.GetComponent<MeshRenderer>().sharedMaterial = Mats.Cached("ice", () => { var m = Mats.Glow(new Color(0.7f, 0.9f, 1f, 0.45f), 3, false, 1.4f); return m; });
                ice.SetActive(false);
                var pos = W.P(p.x, p.z);
                beasts.Add(new Beast { t = t, body = body.transform, r = r, prev = pos, cur = pos, yaw = W.Yaw(p.heading), ice = ice.transform });
            }
            foreach (var k in w.Kids)
            {
                var rig = ModelsWild.Kid(root, k.look);
                var pos = W.P(k.x, k.z);
                kids.Add(new Child { rig = rig, prev = pos, cur = pos, yaw = W.Yaw(k.heading) });
            }
            foreach (var c in w.Creatures)
            {
                var t = new GameObject(c.kind.ToString()).transform;
                t.SetParent(root, false);
                var body = new GameObject("body", typeof(MeshFilter), typeof(MeshRenderer));
                body.transform.SetParent(t, false);
                body.GetComponent<MeshFilter>().sharedMesh = ModelsWild.Creature(c.kind);
                var br = body.GetComponent<MeshRenderer>();
                br.sharedMaterial = Mats.Cached("creature", () => { var m = Mats.Toon(Color.white, 1.2f, 0.85f, 1.0f); m.SetColor("_RimColor", new Color(1f, 0.95f, 1f)); m.SetColor("_EmissionColor", new Color(0.18f, 0.18f, 0.22f)); return m; });
                var glow = MeshKit.Hex(c.Spec.glow);
                var rm = RunAssets.Track(Mats.Glow(new Color(glow.r, glow.g, glow.b, 0.85f), 2, true, 2.4f));
                var ring = Flat(t, rm, c.Spec.radius * 4.5f);
                var halo = Flat(t, RunAssets.Track(Mats.Glow(new Color(glow.r, glow.g, glow.b, 0.35f), 0, true, 1.6f)), c.Spec.radius * 6f);
                halo.localPosition = Vector3.up * 0.04f;
                var pos = W.P(c.x, c.z);
                creatures.Add(new Magic { t = t, body = body.transform, ring = ring, ringMat = rm, prev = pos, cur = pos, yaw = W.Yaw(c.heading) });
            }
            if (w.Stage.Id == StageId.London) london = new LondonViews(w, parent);
            if (w.Stage.Greeters != null)
            {
                var g = w.Stage.Greeters;
                sami = ModelsWild.Person(root, "sami");
                mum = ModelsWild.Person(root, "mum");
                sami.root.position = W.P(g[0], g[1]);
                mum.root.position = W.P(g[2], g[3]);
                sami.root.rotation = Quaternion.LookRotation(mum.root.position - sami.root.position);
                mum.root.rotation = Quaternion.LookRotation(sami.root.position - mum.root.position);
            }
        }

        static Mesh quad;
        static Transform Flat(Transform parent, Material m, float size)
        {
            if (!quad)
            {
                quad = new Mesh { name = "wild-quad" };
                quad.vertices = new[] { new Vector3(-0.5f, 0, -0.5f), new Vector3(-0.5f, 0, 0.5f), new Vector3(0.5f, 0, 0.5f), new Vector3(0.5f, 0, -0.5f) };
                quad.uv = new[] { new Vector2(0, 0), new Vector2(0, 1), new Vector2(1, 1), new Vector2(1, 0) };
                quad.colors = new[] { Color.white, Color.white, Color.white, Color.white };
                quad.triangles = new[] { 0, 1, 2, 0, 2, 3 };
            }
            var go = new GameObject("flat", typeof(MeshFilter), typeof(MeshRenderer));
            go.transform.SetParent(parent, false);
            go.GetComponent<MeshFilter>().sharedMesh = quad;
            var r = go.GetComponent<MeshRenderer>();
            r.sharedMaterial = m;
            r.shadowCastingMode = ShadowCastingMode.Off;
            go.transform.localScale = new Vector3(size, 1, size);
            go.transform.localPosition = Vector3.up * 0.05f;
            return go.transform;
        }

        public void OnStep()
        {
            for (int i = 0; i < beasts.Count; i++) if (beasts[i] != null) Step(ref beasts[i].prev, ref beasts[i].cur, world.Predators[i].x, world.Predators[i].z);
            london?.OnStep();
            for (int i = 0; i < kids.Count; i++) Step(ref kids[i].prev, ref kids[i].cur, world.Kids[i].x, world.Kids[i].z);
            for (int i = 0; i < creatures.Count; i++) Step(ref creatures[i].prev, ref creatures[i].cur, world.Creatures[i].x, world.Creatures[i].z);
        }

        static void Step(ref Vector3 prev, ref Vector3 cur, float x, float z)
        {
            prev = cur;
            cur = W.P(x, z);
            if ((prev - cur).sqrMagnitude > 9) prev = cur;
        }

        /// <summary>A predator bit someone: the nearest one snaps.</summary>
        public void Chomp(Vector3 at)
        {
            Beast best = null;
            float bd = float.MaxValue;
            foreach (var b in beasts) { if (b == null) continue; float d = (b.t.position - at).sqrMagnitude; if (d < bd) { bd = d; best = b; } }
            if (best != null) best.punch = 1;
        }

        /// <summary>A child threw something: the nearest one swings an arm.</summary>
        public void Throw(Vector3 at)
        {
            Child best = null;
            float bd = float.MaxValue;
            foreach (var k in kids) { float d = (k.rig.root.position - at).sqrMagnitude; if (d < bd) { bd = d; best = k; } }
            if (best != null) best.throwT = 0.45f;
        }

        public void SamiTalks() => samiTalk = 2.6f;
        public Vector3 SamiHead => sami != null ? sami.root.position + Vector3.up * 2.1f : Vector3.zero;

        public void Sync(float alpha, float dt, float time)
        {
            london?.Sync(alpha, dt, time);
            // ---- bears and wolves
            for (int i = 0; i < beasts.Count; i++)
            {
                var p = world.Predators[i];
                var b = beasts[i];
                if (b == null) continue;
                var pos = Vector3.Lerp(b.prev, b.cur, alpha);
                b.yaw = Mathf.LerpAngle(b.yaw, W.Yaw(p.heading), 1 - Mathf.Exp(-dt * 8));
                bool frozen = p.frozenFor > 0, scared = p.scaredFor > 0;
                float gait = p.travel * (p.kind == PredatorKind.Bear ? 2.2f : 3.6f);
                float moving = Mathf.Clamp01(p.speed / 1.5f);
                float lift = frozen ? 0 : Mathf.Abs(Mathf.Sin(gait)) * (p.kind == PredatorKind.Bear ? 0.08f : 0.14f) * moving;
                float roll = frozen ? 0 : Mathf.Sin(gait) * (p.kind == PredatorKind.Bear ? 5 : 3) * moving;
                float pitch = p.chargeFor > 0 ? 10 : 0;
                if (scared) { roll += Mathf.Sin(time * 40) * 4; }
                b.punch = Mathf.Max(0, b.punch - dt * 3);
                float chomp = 1 + Mathf.Sin(b.punch * Mathf.PI) * 0.22f;
                b.t.position = pos;
                b.t.rotation = Quaternion.Euler(0, b.yaw, 0);
                b.body.localPosition = Vector3.up * lift;
                b.body.localRotation = Quaternion.Euler(pitch - Mathf.Sin(b.punch * Mathf.PI) * 15, 0, roll);
                b.body.localScale = new Vector3(chomp, 1 / chomp, chomp);
                b.ice.gameObject.SetActive(frozen);
                mpb.SetColor("_EmissionColor", frozen ? new Color(0.25f, 0.45f, 0.7f) : scared ? new Color(0.3f, 0.15f, 0.05f) * (0.5f + 0.5f * Mathf.Sin(time * 20)) : Color.black);
                b.r.SetPropertyBlock(mpb);
                if (p.chargeFor > 0 && Random.value < dt * 14) Fx.I.Dust(pos, 0.5f);
            }

            // ---- children
            for (int i = 0; i < kids.Count; i++)
            {
                var k = world.Kids[i];
                var c = kids[i];
                var pos = Vector3.Lerp(c.prev, c.cur, alpha);
                float clamber = world.Stage.Id == StageId.Common ? Common.LogClamberHeight(k.x, k.z) : 0;
                c.yaw = Mathf.LerpAngle(c.yaw, W.Yaw(k.heading), 1 - Mathf.Exp(-dt * 10));
                var rig = c.rig;
                rig.root.position = pos + Vector3.up * clamber;
                rig.root.rotation = Quaternion.Euler(0, c.yaw, 0);
                float run = k.speed > 0 ? 1 : 0;
                float ph = k.travel * 4.2f;
                float swing = Mathf.Sin(ph) * 45 * run;
                rig.legL.localRotation = Quaternion.Euler(swing, 0, 0);
                rig.legR.localRotation = Quaternion.Euler(-swing, 0, 0);
                rig.armL.localRotation = Quaternion.Euler(-swing * 0.9f, 0, 0);
                c.throwT = Mathf.Max(0, c.throwT - dt);
                rig.armR.localRotation = c.throwT > 0 ? Quaternion.Euler(-160 + (0.45f - c.throwT) * 300, 0, 0) : Quaternion.Euler(swing * 0.9f, 0, 0);
                rig.body.localPosition = Vector3.up * Mathf.Abs(Mathf.Sin(ph)) * 0.1f * run;
                // A runner stopping to stare spins on the spot now and then.
                if (k.kind == KidKind.Runner && k.speed == 0) rig.root.rotation = Quaternion.Euler(0, c.yaw + Mathf.Sin(time * 3 + i) * 40, 0);
            }

            // ---- pebbles and kisses
            while (shots.Count < world.Projectiles.Count)
            {
                var go = new GameObject("shot", typeof(MeshFilter), typeof(MeshRenderer));
                go.transform.SetParent(root, false);
                shots.Add((go.transform, ProjectileKind.Pebble));
                shots[shots.Count - 1] = (go.transform, (ProjectileKind)(-1));
            }
            for (int i = 0; i < shots.Count; i++)
            {
                bool on = i < world.Projectiles.Count;
                var (t, kind) = shots[i];
                t.gameObject.SetActive(on);
                if (!on) continue;
                var pj = world.Projectiles[i];
                if (kind != pj.kind)
                {
                    t.GetComponent<MeshFilter>().sharedMesh = ModelsWild.Projectile(pj.kind);
                    t.GetComponent<MeshRenderer>().sharedMaterial = pj.kind == ProjectileKind.Kiss
                        ? Mats.Cached("kiss", () => { var m = Mats.Toon(Color.white, 1, 0.8f, 0.8f); m.SetColor("_EmissionColor", new Color(0.6f, 0.15f, 0.3f)); return m; })
                        : Mats.VertexLit;
                    shots[i] = (t, pj.kind);
                }
                float u = pj.total > 0 ? 1 - pj.left / pj.total : 0;
                float arc = pj.kind == ProjectileKind.Pebble ? Mathf.Sin(u * Mathf.PI) * Mathf.Min(3, pj.total * 0.25f) + 0.6f : 1.2f + Mathf.Sin(time * 6 + i) * 0.15f;
                t.position = W.P(pj.x, pj.z, arc);
                t.rotation = pj.kind == ProjectileKind.Kiss ? Quaternion.LookRotation(-Camera.main.transform.forward) * Quaternion.Euler(0, 0, Mathf.Sin(time * 5) * 12) : Quaternion.Euler(time * 400, time * 230, 0);
                t.localScale = Vector3.one * (pj.kind == ProjectileKind.Kiss ? 1 + Mathf.Sin(time * 10) * 0.12f : 1);
                if (pj.kind == ProjectileKind.Kiss && Random.value < dt * 20) Fx.I.Trail(t.position, new Color(1f, 0.5f, 0.75f));
            }

            // ---- fantastic creatures
            for (int i = 0; i < creatures.Count; i++)
            {
                var c = world.Creatures[i];
                var v = creatures[i];
                bool present = c.respawnIn <= 0;
                v.show = Mathf.MoveTowards(v.show, present ? 1 : 0, dt * (present ? 0.8f : 4));
                v.t.gameObject.SetActive(v.show > 0.01f);
                if (v.show <= 0.01f) continue;
                var pos = Vector3.Lerp(v.prev, v.cur, alpha);
                v.yaw = Mathf.LerpAngle(v.yaw, W.Yaw(c.heading), 1 - Mathf.Exp(-dt * 6));
                bool flies = c.kind == CreatureKind.Owl || c.kind == CreatureKind.Pixie || c.kind == CreatureKind.Wisp;
                float hover = flies ? 0.6f + Mathf.Sin(time * 2.2f + i) * 0.25f : Mathf.Abs(Mathf.Sin(time * 5 + i)) * 0.06f * Mathf.Clamp01(c.speed);
                v.t.position = pos;
                v.t.rotation = Quaternion.Euler(0, v.yaw, 0);
                v.body.localPosition = Vector3.up * hover;
                v.body.localScale = Vector3.one * Ease.OutBack(Mathf.Clamp01(v.show));
                float pulse = 0.85f + Mathf.Sin(time * 3 + i) * 0.15f;
                v.ring.localScale = new Vector3(c.Spec.radius * 4.5f * pulse, 1, c.Spec.radius * 4.5f * pulse);
                v.ring.localRotation = Quaternion.Euler(0, time * 40, 0);
                if (Random.value < dt * 8) Fx.I.Trail(pos + Vector3.up * (hover + c.Spec.radius) + Random.insideUnitSphere * c.Spec.radius, MeshKit.Hex(c.Spec.glow));
            }

            // ---- Miss Sami and the mum
            if (sami != null)
            {
                samiTalk = Mathf.Max(0, samiTalk - dt);
                sami.armR.localRotation = samiTalk > 0 ? Quaternion.Euler(-70 + Mathf.Sin(time * 8) * 25, 0, -20) : Quaternion.identity;
                sami.head.localRotation = Quaternion.Euler(Mathf.Sin(time * 1.3f) * 4, Mathf.Sin(time * 0.7f) * 12, 0);
                mum.head.localRotation = Quaternion.Euler(Mathf.Sin(time * 4) * (samiTalk > 0 ? 6 : 1), 0, 0);
                mum.armL.localRotation = Quaternion.Euler(-60, 0, 10);
            }
        }

        /// <summary>Positions of the shy creatures, for the Owl Eyes minimap.</summary>
        public IEnumerable<Creature> Visible { get { foreach (var c in world.Creatures) if (c.respawnIn <= 0) yield return c; } }
    }
}
