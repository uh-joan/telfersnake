using System.Collections.Generic;
using Telfer.Sim;
using UnityEngine;
using UnityEngine.Rendering;

namespace Telfer.View
{
    /// <summary>
    /// London's dangers on screen (predatorView.ts, vehicleView.ts): the buses and cabs rocking on their
    /// springs, the Trafalgar lions stepping down off their plinths (the bronze statue hides while its lion
    /// is out), and the Tower's raven pair swooping out from their perches (the perched pair hide too).
    /// Interpolated between sim steps like everything else.
    /// </summary>
    public sealed class LondonViews
    {
        /// <summary>The plinth tops (ModelsLondon's Trafalgar): where a lion stretches before it hops down.</summary>
        const float PLINTH_H = 1.4f;

        sealed class Car { public Transform t; public Vector3 prev, cur; public float yaw, lastSpeed, dip; }
        sealed class Beast
        {
            public Predator p; public Transform t, body, wingL, wingR; public MeshRenderer r;
            public Vector3 prev, cur; public float yaw, stretch; public GameObject statue;
        }

        readonly World world;
        readonly Transform root;
        readonly List<Car> cars = new List<Car>();
        readonly List<Beast> beasts = new List<Beast>();
        readonly MaterialPropertyBlock mpb = new MaterialPropertyBlock();
        float clock;

        public LondonViews(World w, Transform parent)
        {
            world = w;
            root = new GameObject("LondonCast").transform;
            root.SetParent(parent, false);
            var env = LondonEnv.Active != null ? LondonEnv.Active.root : null;

            foreach (var v in w.Vehicles)
            {
                var t = Inked(v.kind == VehicleKind.Bus ? ModelsLondonZoo.Bus() : ModelsLondonZoo.Cab(), v.kind.ToString(), 0.05f, out _);
                var pos = W.P(v.x, v.z);
                cars.Add(new Car { t = t, prev = pos, cur = pos, yaw = W.Yaw(v.heading), lastSpeed = v.speed });
            }

            int lions = 0, ravens = 0;
            foreach (var p in w.Predators)
            {
                if (p.kind != PredatorKind.Lion && p.kind != PredatorKind.Raven) continue;
                var b = new Beast { p = p };
                var pos = W.P(p.x, p.z);
                b.prev = b.cur = pos;
                b.yaw = W.Yaw(p.heading);
                if (p.kind == PredatorKind.Lion)
                {
                    b.t = Inked(ModelsLondonZoo.Lion(), "lion", 0.05f, out b.r);
                    b.body = b.t;
                    b.statue = Find(env, "lion" + lions++);
                }
                else
                {
                    b.t = new GameObject("raven").transform;
                    b.t.SetParent(root, false);
                    b.body = Inked(ModelsLondonZoo.RavenBody(), "body", 0.04f, out b.r, b.t);
                    b.wingL = Inked(ModelsLondonZoo.RavenWing(-1), "wingL", 0.03f, out _, b.body);
                    b.wingR = Inked(ModelsLondonZoo.RavenWing(1), "wingR", 0.03f, out _, b.body);
                    b.statue = Find(env, "raven" + ravens++);
                }
                if (b.statue != null) b.statue.SetActive(true); // a previous run may have left it hidden
                b.t.gameObject.SetActive(false);
                beasts.Add(b);
            }
        }

        public bool Empty => cars.Count == 0 && beasts.Count == 0;

        static GameObject Find(Transform t, string name)
        {
            if (t == null) return null;
            if (t.name == name) return t.gameObject;
            for (int i = 0; i < t.childCount; i++)
            {
                var f = Find(t.GetChild(i), name);
                if (f != null) return f;
            }
            return null;
        }

        Transform Inked(Mesh mesh, string name, float ink, out MeshRenderer r, Transform parent = null)
        {
            var go = new GameObject(name, typeof(MeshFilter), typeof(MeshRenderer));
            go.transform.SetParent(parent != null ? parent : root, false);
            go.GetComponent<MeshFilter>().sharedMesh = mesh;
            r = go.GetComponent<MeshRenderer>();
            r.sharedMaterials = new[] { LK.Toon(), LK.Outline(ink) };
            r.shadowCastingMode = ShadowCastingMode.On;
            return go.transform;
        }

        public void OnStep()
        {
            for (int i = 0; i < cars.Count; i++)
            {
                var c = cars[i];
                c.prev = c.cur;
                c.cur = W.P(world.Vehicles[i].x, world.Vehicles[i].z);
                if ((c.prev - c.cur).sqrMagnitude > 9) c.prev = c.cur;
            }
            foreach (var b in beasts)
            {
                b.prev = b.cur;
                b.cur = W.P(b.p.x, b.p.z);
                if ((b.prev - b.cur).sqrMagnitude > 9) b.prev = b.cur;
            }
        }

        public void Sync(float alpha, float dt, float time)
        {
            clock += dt;

            // ---- buses and cabs: braking dips the nose, pulling away lifts it; a shiver while ticking over
            for (int i = 0; i < cars.Count; i++)
            {
                var v = world.Vehicles[i];
                var c = cars[i];
                float decel = dt > 0 ? (c.lastSpeed - v.speed) / dt : 0;
                c.lastSpeed = v.speed;
                float want = Mathf.Clamp(decel * 0.025f, -0.05f, 0.07f);
                c.dip += (want - c.dip) * Mathf.Min(1, dt * 8);
                float idle = v.speed < 0.05f ? Mathf.Sin(time * 34 + i) * 0.012f : Mathf.Sin(time * 9 + i) * 0.01f;
                c.yaw = Mathf.LerpAngle(c.yaw, W.Yaw(v.heading), 1 - Mathf.Exp(-dt * 14));
                c.t.position = Vector3.Lerp(c.prev, c.cur, alpha) + Vector3.up * idle;
                c.t.rotation = Quaternion.Euler(0, c.yaw, 0) * Quaternion.Euler(c.dip * Mathf.Rad2Deg, 0, 0);
            }

            // ---- lions and ravens
            for (int i = 0; i < beasts.Count; i++)
            {
                var b = beasts[i];
                var p = b.p;
                var pos = Vector3.Lerp(b.prev, b.cur, alpha);
                b.yaw = Mathf.LerpAngle(b.yaw, W.Yaw(p.heading), 1 - Mathf.Exp(-dt * 8));
                float y = 0, pitch = 0, roll = 0;
                bool moving = p.speed > 0.05f;
                if (p.kind == PredatorKind.Lion)
                {
                    // Asleep on its plinth: that is Trafalgar's own bronze statue, not this one.
                    bool asleep = p.state == Lion.Statue;
                    if (b.statue != null) b.statue.SetActive(asleep);
                    b.t.gameObject.SetActive(!asleep);
                    b.stretch = p.state == Lion.Waking ? b.stretch + dt : 0;
                    if (asleep) continue;
                    float phase = p.travel * 1.6f * Mathf.PI;
                    y = Mathf.Abs(Mathf.Sin(phase)) * 0.08f * (moving ? 1 : 0);
                    roll = Mathf.Sin(phase) * 0.05f * (moving ? 1 : 0);
                    // On or hopping off its plinth: up on top, in a little arc down to the ground.
                    float off = Mathf.Sqrt((p.x - p.hx) * (p.x - p.hx) + (p.z - p.hz) * (p.z - p.hz));
                    if (off < Lion.FOOT) y += PLINTH_H * (1 - off / Lion.FOOT) + Mathf.Sin(Mathf.PI * off / Lion.FOOT) * 0.5f;
                    // The waking yawn: rear up and stretch, then settle.
                    pitch = -0.32f * Mathf.Sin(Mathf.Min(1, b.stretch / 0.75f) * Mathf.PI);
                    // Freeze Puff: stone grey; otherwise its bronze.
                    mpb.SetColor("_BaseColor", p.state == Lion.Stone ? new Color(0.62f, 0.64f, 0.68f) : p.frozenFor > 0 ? new Color(0.7f, 0.85f, 1f) : Color.white);
                    b.r.SetPropertyBlock(mpb);
                    if (p.state == Lion.Prowl && moving && Random.value < dt * 8) Fx.I.Dust(pos, 0.5f);
                }
                else
                {
                    bool home = p.state == Raven.Perched;
                    if (b.statue != null) b.statue.SetActive(home);
                    b.t.gameObject.SetActive(!home);
                    if (home) continue; // roosting: the Tower draws it
                    // High by the Tower, low over a snake: it dives as it flies out and climbs as it comes home.
                    float off = Mathf.Sqrt((p.x - p.hx) * (p.x - p.hx) + (p.z - p.hz) * (p.z - p.hz));
                    y = p.state == Raven.Caw ? London.RAVEN_PERCH_Y + 0.45f : 0.9f + (London.RAVEN_PERCH_Y - 0.9f) * Mathf.Max(0, 1 - off / 10);
                    y += Mathf.Sin(clock * 9 + i) * 0.08f;
                    pitch = p.state == Raven.Swoop ? 0.25f : 0;
                    // Wings: a quick flap flying out, slower gliding home, a flurry while it caws.
                    float rate = p.state == Raven.Caw ? 24 : p.state == Raven.Swoop ? 16 : 10;
                    float flap = Mathf.Sin(clock * rate + i * 1.7f) * (p.speed > 0 || p.state == Raven.Caw ? 0.7f : 0.15f) * Mathf.Rad2Deg;
                    b.wingR.localPosition = new Vector3(0.2f, 0.75f, 0.05f);
                    b.wingL.localPosition = new Vector3(-0.2f, 0.75f, 0.05f);
                    b.wingR.localRotation = Quaternion.Euler(0, 0, flap);
                    b.wingL.localRotation = Quaternion.Euler(0, 0, -flap);
                    mpb.SetColor("_BaseColor", p.frozenFor > 0 ? new Color(0.7f, 0.85f, 1f) : Color.white);
                    b.r.SetPropertyBlock(mpb);
                }
                b.t.position = pos + Vector3.up * y;
                b.t.rotation = Quaternion.Euler(0, b.yaw, 0) * Quaternion.Euler(pitch * Mathf.Rad2Deg, 0, roll * Mathf.Rad2Deg);
            }
        }
    }
}
