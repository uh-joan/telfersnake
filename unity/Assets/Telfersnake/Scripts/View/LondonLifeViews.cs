using System.Collections.Generic;
using Telfer.Audio;
using Telfer.Sim;
using Telfer.UI;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.UI;

namespace Telfer.View
{
    /// <summary>
    /// London's people, legends and set pieces on screen (people.ts, kidView.ts, legends.ts, setPieceView.ts):
    /// the tourists, the school trip on its rope and the buskers; the Royal Guard, Miss Sami, the Beefeater,
    /// the living statue and the royal wave; the Crown Jewels and the pearly trail; Tower Bridge's bascules and
    /// the tall ship, the parade, the river bus, the fireworks with the Eye lit in rainbow, the Red Arrows, the
    /// wobbly bridge, the Tube's roundels, and a capsule of your own on the London Eye. The set pieces run on
    /// the sim's tick (a pure function of it), and the sounds that go with that clock are played from here.
    /// </summary>
    public sealed class LondonLifeViews
    {
        const float BASCULE_UP = 1.3f, JET_Y = 7, BURST_Y = 5, ECHO_BEYOND = 22, EARSHOT = 45;
        const int EYE_LIGHTS = 48, BUTTON_MAX = 96;
        /// <summary>The London Eye's hub and rim (ModelsLondon Eye): the rider's capsule goes round this.</summary>
        const float EYE_HUB_Y = 10.7f, EYE_POD_R = 9.75f, EYE_HUB_DZ = -2.4f;
        /// <summary>The royal wave: once every ROYAL_EVERY seconds of the run, for ROYAL_FOR seconds (people.ts).</summary>
        const float ROYAL_EVERY = 200, ROYAL_FOR = 10, ROYAL_OFFSET = 110;

        sealed class Walker { public Kid k; public Transform t; public Vector3 prev, cur; public float yaw; public float[] gait; }
        sealed class Person { public Transform root, armL, armR; public GameObject mouth, smile; }

        readonly World world;
        readonly Transform root;
        readonly SetPieceSpots sp;
        readonly MaterialPropertyBlock mpb = new MaterialPropertyBlock();
        readonly List<Walker> walkers = new List<Walker>();
        readonly List<Transform> ropes = new List<Transform>();
        Person guard, sami, beefeater, statue;
        Transform statueBody, royal, royalArm, corgiPaw, gem;
        readonly List<(Transform t, Transform glow, Material glowMat)> jewels = new List<(Transform, Transform, Material)>();
        readonly List<Transform> buttons = new List<Transform>();
        Transform basculeW, basculeE, millennium, ship, boat, eyeRide;
        readonly List<Transform> band = new List<Transform>(), guards = new List<Transform>(), eyeLights = new List<Transform>(), jets = new List<Transform>(), smoke = new List<Transform>();
        readonly List<Material> smokeMats = new List<Material>();
        Material eyeLightMat;
        uint shipSail = 0xffffffff;
        float clock, sway, smileFor, gemT = -1, booAge = 99, noteIn;
        Snake lookAt;
        Vector3 gemFrom;
        int lastTick = -1, drumBeat;
        float drumIn;

        public LondonLifeViews(World w, Transform parent)
        {
            world = w;
            sp = w.Stage.SetPieces;
            root = new GameObject("LondonLife").transform;
            root.SetParent(parent, false);
            var env = LondonEnv.Active;

            // ---- the walkers (the trip's first is its teacher)
            bool teacher = true;
            foreach (var k in w.Kids)
            {
                if (k.kind < KidKind.Tourist) continue;
                string look = k.kind == KidKind.Tourist ? "tourist" : k.kind == KidKind.Busker ? "busker" : teacher ? "teacher" : "trip";
                if (k.kind == KidKind.Trip) teacher = false;
                var t = Inked(ModelsLondonZoo.Walker(look), look, 0.03f, root);
                var pos = W.P(k.x, k.z);
                walkers.Add(new Walker
                {
                    k = k, t = t, prev = pos, cur = pos, yaw = W.Yaw(k.heading),
                    gait = look == "tourist" ? new[] { 0.04f, 2.2f, 0.05f } : look == "busker" ? new[] { 0f, 0, 0 } : new[] { 0.07f, 3, 0.05f },
                });
            }

            // ---- the people who stand still
            if (w.Stage.Guard != null) guard = Figure(ModelsLondonZoo.Guard(), "guard", w.Stage.Guard[0], w.Stage.Guard[1]);
            if (w.Stage.Chatters != null)
                foreach (var c in w.Stage.Chatters)
                {
                    if (c.id == "sami") sami = Figure(ModelsLondonZoo.Sami(), "sami", c.x, c.z);
                    else beefeater = Figure(ModelsLondonZoo.Beefeater(), "beefeater", c.x, c.z);
                }
            if (w.Stage.Statue != null)
            {
                // The statue stands on a little silver box.
                var holder = new GameObject("statue").transform;
                holder.SetParent(root, false);
                holder.position = W.P(w.Stage.Statue[0], w.Stage.Statue[1]);
                holder.rotation = Quaternion.Euler(0, 180, 0);
                holder.localScale = Vector3.one * ModelsLondonZoo.FIGURE_SCALE;
                Inked(ModelsLondonZoo.Parts("statue-box", new[] { LK.Box(0.7f, 0.3f, 0.7f, 0x9aa1aa) }), "box", 0.03f, holder);
                statue = Figure(ModelsLondonZoo.Statue(), "statue-figure", 0, 0, holder);
                statueBody = statue.root;
                statueBody.localPosition = Vector3.up * 0.3f;
            }
            if (w.Stage.Id == StageId.London)
            {
                var (body, arm, paw) = ModelsLondonZoo.Royal();
                royal = new GameObject("royal-wave").transform;
                royal.SetParent(root, false);
                royal.position = W.P(London.PALACE.x, London.PALACE.z + 1.3f + 0.5f + 0.35f, 3.82f);
                royal.rotation = Quaternion.Euler(0, 180, 0);
                Inked(ModelsLondonZoo.Parts("royal-body", body), "body", 0.02f, royal);
                royalArm = Pivot(royal, "arm", ModelsLondonZoo.Turned(new Vector3(0.22f, 0.8f, 0)));
                Inked(ModelsLondonZoo.Parts("royal-arm", arm), "arm", 0.02f, royalArm);
                corgiPaw = Pivot(royal, "paw", ModelsLondonZoo.Turned(new Vector3(-0.47f, 0.22f, 0.13f)));
                Inked(ModelsLondonZoo.Parts("royal-paw", paw), "paw", 0.02f, corgiPaw);
                royal.gameObject.SetActive(false);
                // The gem that pops out of the guard's bearskin (only while it flies).
                gem = Inked(ModelsLondonZoo.Parts("guard-gem", new[] { LK.Sphere(0.16f, 0x4dabf7, 0, 0, 0, 4, 2) }), "gem", 0.02f, root);
                gem.gameObject.SetActive(false);
            }

            // ---- the Crown Jewels and the pearl buttons
            for (int i = 0; i < w.Treasures.Count; i++)
            {
                var t = Inked(ModelsLondonZoo.Jewel(i % 5), "jewel" + i, 0.03f, root, Mats.Cached("jewelToon", () => { var m = Mats.Toon(Color.white, 1.4f, 0.9f, 0.8f); m.SetColor("_EmissionColor", new Color(0.12f, 0.12f, 0.12f)); return m; }));
                var col = MeshKit.Hex(ModelsLondonZoo.JEWEL_COLOURS[i % 5]);
                var gm = RunAssets.Track(Mats.Glow(new Color(col.r, col.g, col.b, 0.75f), 0, true, 2.2f));
                jewels.Add((t, Flat(gm, 2.6f), gm));
            }

            if (sp == null) return;
            // ---- Tower Bridge's bascules (LondonEnv's hinged leaves) and the wobbly bridge
            if (env != null)
            {
                basculeW = env.BasculeWest;
                basculeE = env.BasculeEast;
                millennium = env.root.Find("millennium-bridge");
            }
            ship = new GameObject("tall-ship").transform;
            ship.SetParent(root, false);
            boat = Inked(ModelsLondonZoo.RiverBus(), "river-bus", 0.035f, root);
            for (int i = 0; i < Sim.SetPieces.PARADE_SIZE; i++)
            {
                var b = Inked(ModelsLondonZoo.Marcher(true), "band", 0.035f, root); b.gameObject.SetActive(false); band.Add(b);
                var g = Inked(ModelsLondonZoo.Marcher(false), "guard", 0.035f, root); g.gameObject.SetActive(false); guards.Add(g);
            }
            // The Eye in rainbow for the fireworks: lights round its rim, on the face the camera sees.
            eyeLightMat = RunAssets.Track(Mats.Glow(Color.white, 0, true, 3));
            var ball = ModelsLondonZoo.Parts("eye-light", new[] { LK.Sphere(0.4f, 0xffffff, 0, 0, 0, 8, 6) });
            for (int i = 0; i < EYE_LIGHTS; i++)
            {
                var go = new GameObject("eye-light", typeof(MeshFilter), typeof(MeshRenderer));
                go.transform.SetParent(root, false);
                go.GetComponent<MeshFilter>().sharedMesh = ball;
                var r = go.GetComponent<MeshRenderer>();
                r.sharedMaterial = Mats.Cached("eyeLight", () => { var m = Mats.Toon(Color.white, 0, 0, 0, null, null, false); m.SetColor("_EmissionColor", Color.white * 2.5f); return m; });
                r.shadowCastingMode = ShadowCastingMode.Off;
                float a = i / (float)EYE_LIGHTS * Mathf.PI * 2;
                var e = London.LONDON_EYE;
                go.transform.position = W.P(e.x + Mathf.Cos(a) * 9, e.z + EYE_HUB_DZ + 0.75f, EYE_HUB_Y + Mathf.Sin(a) * 9);
                go.SetActive(false);
                eyeLights.Add(go.transform);
            }
            // The Red Arrows and their red, white and blue smoke.
            Color[] smokeColours = { MeshKit.Hex(0xe8303a), Color.white, MeshKit.Hex(0x2f5fd0) };
            for (int i = 0; i < 3; i++)
            {
                var j = Inked(ModelsLondonZoo.Jet(), "red-arrow", 0.03f, root);
                j.gameObject.SetActive(false);
                jets.Add(j);
                var sm = RunAssets.Track(Mats.Glow(new Color(smokeColours[i].r, smokeColours[i].g, smokeColours[i].b, 0.7f), 3, false, 1));
                smokeMats.Add(sm);
                var go = new GameObject("smoke", typeof(MeshFilter), typeof(MeshRenderer));
                go.transform.SetParent(root, false);
                go.GetComponent<MeshFilter>().sharedMesh = ModelsLondonZoo.Parts("smoke-box", new[] { LK.Box(1, 0.5f, 0.9f, 0xffffff).Translate(0, -0.25f, 0) });
                var r = go.GetComponent<MeshRenderer>();
                r.sharedMaterial = sm;
                r.shadowCastingMode = ShadowCastingMode.Off;
                go.SetActive(false);
                smoke.Add(go.transform);
            }
            // The Tube: the stairs down and a roundel with the station's name at every station.
            var ports = w.Stage.Portals;
            if (ports != null)
                for (int i = 0; i < ports.Length / 2; i++)
                {
                    float px = ports[i * 2], pz = ports[i * 2 + 1];
                    Inked(ModelsLondonZoo.Stairs(), "tube-stairs", 0.03f, root).position = W.P(px, pz);
                    var sign = Inked(ModelsLondonZoo.Roundel(), "roundel", 0.03f, root);
                    sign.position = W.P(px + 1.5f, pz - 1.2f);
                    Nameplate(sign, i < London.TUBE_NAMES.Length ? London.TUBE_NAMES[i] : "");
                }
            // Your own capsule on the London Eye, for the ride.
            eyeRide = Inked(ModelsLondonZoo.RideCapsule(), "eye-ride", 0.05f, root, Mats.Cached("rideGlass", () => Mats.Toon(Color.white, 1.4f, 0.92f, 0.9f)));
            eyeRide.gameObject.SetActive(false);
        }

        // ------------------------------------------------------------------ building

        Transform Inked(Mesh mesh, string name, float ink, Transform parent, Material mat = null)
        {
            var go = new GameObject(name, typeof(MeshFilter), typeof(MeshRenderer));
            go.transform.SetParent(parent, false);
            go.GetComponent<MeshFilter>().sharedMesh = mesh;
            var r = go.GetComponent<MeshRenderer>();
            var m = mat != null ? mat : LK.Toon();
            r.sharedMaterials = ink > 0 ? new[] { m, LK.Outline(ink) } : new[] { m };
            return go.transform;
        }

        static Transform Pivot(Transform parent, string name, Vector3 at)
        {
            var t = new GameObject(name).transform;
            t.SetParent(parent, false);
            t.localPosition = at;
            return t;
        }

        Transform Flat(Material m, float size)
        {
            var go = new GameObject("glow", typeof(MeshFilter), typeof(MeshRenderer));
            go.transform.SetParent(root, false);
            go.GetComponent<MeshFilter>().sharedMesh = ModelsLondonZoo.Parts("glow-quad", new[] { LK.Box(1, 0.001f, 1, 0xffffff) });
            var r = go.GetComponent<MeshRenderer>();
            r.sharedMaterial = m;
            r.shadowCastingMode = ShadowCastingMode.Off;
            go.transform.localScale = new Vector3(size, 1, size);
            return go.transform;
        }

        /// <summary>A standing grown-up: body, arms on shoulder pivots, and (the guard) a mouth and a smile to swap.</summary>
        Person Figure(ModelsLondonZoo.Figure f, string name, float x, float z, Transform holder = null)
        {
            var p = new Person { root = new GameObject(name).transform };
            p.root.SetParent(holder != null ? holder : root, false);
            if (holder == null)
            {
                p.root.position = W.P(x, z);
                p.root.rotation = Quaternion.Euler(0, 180, 0); // facing south, toward the camera
                p.root.localScale = Vector3.one * ModelsLondonZoo.FIGURE_SCALE;
            }
            Inked(ModelsLondonZoo.Parts(name + "-body", f.body), "body", 0.025f, p.root);
            p.armL = Pivot(p.root, "armL", ModelsLondonZoo.Turned(f.shoulderL));
            Inked(ModelsLondonZoo.Parts(name + "-armL", f.armL), "arm", 0.025f, p.armL);
            p.armR = Pivot(p.root, "armR", ModelsLondonZoo.Turned(f.shoulderR));
            Inked(ModelsLondonZoo.Parts(name + "-armR", f.armR), "arm", 0.025f, p.armR);
            p.mouth = Inked(ModelsLondonZoo.Parts(name + "-mouth", f.mouth), "mouth", 0, p.root).gameObject;
            p.smile = Inked(ModelsLondonZoo.Parts(name + "-smile", f.smile), "smile", 0, p.root).gameObject;
            p.smile.SetActive(false);
            return p;
        }

        /// <summary>The station's name, white on the roundel's blue bar (a little world-space label).</summary>
        static void Nameplate(Transform sign, string name)
        {
            var go = new GameObject("name", typeof(Canvas));
            go.transform.SetParent(sign, false);
            var cv = go.GetComponent<Canvas>();
            cv.renderMode = RenderMode.WorldSpace;
            var rt = (RectTransform)go.transform;
            rt.sizeDelta = new Vector2(440, 80);
            rt.localScale = Vector3.one * 0.005f;
            rt.localPosition = new Vector3(0, 2.55f, -0.19f);
            UiKit.Label(go.transform, "t", name, 54, Color.white);
        }

        // ------------------------------------------------------------------ events from the game

        /// <summary>Three laps done: the guard smiles, and a gem pops out of his bearskin toward that snake.</summary>
        public void Smile(Snake at)
        {
            if (guard == null) return;
            smileFor = 1.5f;
            lookAt = at;
            gemT = 0;
            gemFrom = W.P(world.Stage.Guard[0], world.Stage.Guard[1], 2.4f * ModelsLondonZoo.FIGURE_SCALE);
        }

        /// <summary>The living statue moves: a little jump, arms up. Then still again.</summary>
        public void Boo() => booAge = 0;

        // ------------------------------------------------------------------ per step and per frame

        public void OnStep()
        {
            foreach (var v in walkers)
            {
                v.prev = v.cur;
                v.cur = W.P(v.k.x, v.k.z);
                if ((v.prev - v.cur).sqrMagnitude > 9) v.prev = v.cur;
            }
            if (sp == null) return;
            int tick = world.Tick - 1; // the tick just stepped
            var me = world.Me;
            // Fireworks: a rocket's trail climbing before each bang, then the burst (echoed near you when it is far off).
            int show = Sim.SetPieces.FireworksClock(tick);
            if (show >= 0)
            {
                int kNow = show / Sim.SetPieces.BURST_EVERY;
                for (int k = kNow; k <= kNow + 1; k++)
                {
                    if (!Sim.SetPieces.BurstOf(tick, k, sp, world.setPieceSeed, out var b)) continue;
                    float y0 = BURST_Y + b.k % 3 * 1.2f;
                    if (tick >= b.tick - 40 && tick < b.tick && tick % 3 == 0)
                    {
                        float u = 1 - (b.tick - tick) / 40f;
                        Fx.I.Trail(W.P(b.x, b.z, 2 + (y0 - 2) * u), new Color(1, 0.95f, 0.7f));
                    }
                    if (tick != b.tick) continue;
                    var c = MeshKit.Hex(b.colour);
                    Fx.I.Firework(W.P(b.x, b.z, y0), c, b.finale ? 7 : 5);
                    if (Collide.Hypot(b.x - me.x, b.z - me.z) > ECHO_BEYOND)
                        Fx.I.Firework(W.P(me.x + (b.k % 2 == 0 ? -1 : 1) * (6 + b.k % 3 * 2), me.z - 5 - b.k % 2 * 2, y0), c, b.finale ? 7 : 5);
                }
            }
            Sounds(tick);
        }

        bool Near(float x, float z, float r = EARSHOT)
        {
            var me = world.Me;
            return (me.x - x) * (me.x - x) + (me.z - z) * (me.z - z) < r * r;
        }

        /// <summary>The sounds that go with the clock: each plays once, as the tick passes its mark.</summary>
        void Sounds(int tick)
        {
            int last = lastTick;
            lastTick = tick;
            var synth = Synth.I;
            if (synth == null || last < 0 || tick <= last || tick - last > 30) return;
            bool Passed(int mark) => mark > last && mark <= tick;
            if (Passed(Sim.SetPieces.ChimeStart(tick))) synth.Play("quarters", 0.8f);
            var lift = Sim.SetPieces.LiftAt(tick);
            if (lift.phase != LiftPhase.Down && Near(sp.span.x, sp.span.z))
            {
                int start = tick - lift.at;
                if (Passed(start)) synth.Play("bridgeBells");
                if (Passed(start + Sim.SetPieces.LIFT_BELLS) || Passed(start + Sim.SetPieces.LIFT_BELLS + Sim.SetPieces.LIFT_RISE + Sim.SetPieces.LIFT_OPEN)) synth.Play("grind");
                if (Passed(start + Sim.SetPieces.LIFT_BELLS + Sim.SetPieces.LIFT_RISE + Sim.SetPieces.LIFT_OPEN / 2 - 2 * Sim.SetPieces.TPS)) synth.Play("shipHorn");
            }
            var boatNow = Sim.SetPieces.BoatAt(tick, sp);
            if (boatNow.dock >= 0 && boatNow.leaveIn == 60 && Near(boatNow.x, boatNow.z, 30)) synth.Play("toot");
            int show = Sim.SetPieces.FireworksClock(tick);
            if (show >= 0)
            {
                int k = show / Sim.SetPieces.BURST_EVERY + 1;
                if (Sim.SetPieces.BurstOf(tick, k, sp, world.setPieceSeed, out var b) && Passed(b.tick - 27)) synth.Play("firework", 0.8f);
            }
            if (Sim.SetPieces.ArrowsAt(tick, sp, world.setPieceSeed, out var a) && a.t * Sim.SetPieces.ARROWS_FOR < tick - last + 1) synth.Play("jets");
            if (Sim.SetPieces.ParadeClock(tick, sp.parade) == 0 && Near(sp.parade[0], sp.parade[1], 60)) synth.Play("drumAccent");
        }

        public void Sync(float alpha, float dt, float time)
        {
            clock += dt;

            // ---- the walkers, and the school trip's rope
            int rope = 0;
            Walker prevTrip = null;
            for (int i = 0; i < walkers.Count; i++)
            {
                var v = walkers[i];
                var k = v.k;
                var pos = Vector3.Lerp(v.prev, v.cur, alpha);
                v.yaw = Mathf.LerpAngle(v.yaw, W.Yaw(k.heading), 1 - Mathf.Exp(-dt * 10));
                float phase = k.travel * v.gait[1] * Mathf.PI, moving = k.speed > 0 ? 1 : 0;
                float sway = k.kind == KidKind.Busker ? Mathf.Sin(clock * 5 + i) * 0.08f : Mathf.Sin(phase) * v.gait[2] * moving;
                v.t.position = pos + Vector3.up * (Mathf.Abs(Mathf.Sin(phase)) * v.gait[0] * moving);
                v.t.rotation = Quaternion.Euler(0, v.yaw, -sway * Mathf.Rad2Deg);
                if (k.kind == KidKind.Trip)
                {
                    if (prevTrip != null) RopeBetween(rope++, prevTrip.t.position, v.t.position);
                    prevTrip = v;
                }
            }
            for (int i = rope; i < ropes.Count; i++) ropes[i].gameObject.SetActive(false);

            // The buskers' tune: notes rising from each busker, and round any snake dancing close by.
            noteIn -= dt;
            if (noteIn <= 0)
            {
                noteIn = 0.28f;
                Color[] notes = { MeshKit.Hex(0xff5fa2), MeshKit.Hex(0xffd23f), MeshKit.Hex(0x3fb6ff), MeshKit.Hex(0x8be36a) };
                foreach (var v in walkers)
                {
                    if (v.k.kind != KidKind.Busker) continue;
                    if (Random.value < 0.6f) Fx.I.Trail(v.t.position + new Vector3(0.3f, 1.8f, 0.3f), notes[Random.Range(0, 4)]);
                    foreach (var s in world.Snakes)
                        if (s.alive && Collide.Hypot(s.x - v.k.x, s.z - v.k.z) < World.BUSK_REACH && Random.value < 0.7f)
                            Fx.I.Trail(W.P(s.x, s.z, 1.2f) + Random.insideUnitSphere * 0.5f, notes[Random.Range(0, 4)]);
                }
            }

            // ---- the guard: perfectly still; only his face changes, and only for a moment
            if (guard != null)
            {
                smileFor = Mathf.Max(0, smileFor - dt);
                guard.smile.SetActive(smileFor > 0);
                guard.mouth.SetActive(smileFor <= 0);
                if (gemT >= 0)
                {
                    gemT += dt / 0.9f;
                    if (gemT >= 1 || lookAt == null) { gemT = -1; gem.gameObject.SetActive(false); }
                    else
                    {
                        var to = W.P(lookAt.x, lookAt.z);
                        gem.gameObject.SetActive(true);
                        gem.position = new Vector3(Mathf.Lerp(gemFrom.x, to.x, gemT), gemFrom.y + Mathf.Sin(gemT * Mathf.PI) * 2 - gemT * (gemFrom.y - 0.6f), Mathf.Lerp(gemFrom.z, to.z, gemT));
                        gem.rotation = Quaternion.Euler(0, time * 460, 0);
                        gem.localScale = Vector3.one * 1.6f;
                    }
                }
            }
            // ---- Miss Sami holds her umbrella up and waves it gently, so the group can find her
            if (sami != null) sami.armR.localRotation = Quaternion.Euler(-2.8f * Mathf.Rad2Deg, 0, -Mathf.Sin(clock * 2.2f) * 0.12f * Mathf.Rad2Deg);
            // ---- the living statue: a hop and arms up on BOO, then frozen again
            if (statue != null)
            {
                booAge += dt;
                float jump = booAge < 0.7f ? Mathf.Sin(booAge / 0.7f * Mathf.PI) : 0;
                statueBody.localPosition = Vector3.up * (0.3f + jump * 0.35f);
                bool up = booAge < 0.9f;
                statue.armL.localRotation = Quaternion.Euler(0, 0, (up ? 2.7f : 1.2f) * Mathf.Rad2Deg);
                statue.armR.localRotation = Quaternion.Euler((up ? 0 : -0.4f) * Mathf.Rad2Deg, 0, (up ? -2.7f : 0) * Mathf.Rad2Deg);
            }
            // ---- the royal wave, on the run's clock
            if (royal != null)
            {
                float phase = (world.Tick * World.STEP + ROYAL_OFFSET) % ROYAL_EVERY;
                bool on = phase < ROYAL_FOR;
                royal.gameObject.SetActive(on);
                if (on)
                {
                    float rise = Mathf.Min(1, phase / 0.6f, (ROYAL_FOR - phase) / 0.6f);
                    royal.localScale = new Vector3(1, Mathf.Max(0.01f, rise), 1);
                    royalArm.localRotation = Quaternion.Euler(0, 0, -(-0.3f + Mathf.Sin(clock * 5) * 0.35f) * Mathf.Rad2Deg);
                    corgiPaw.localRotation = Quaternion.Euler((-1.2f + Mathf.Sin(clock * 9) * 0.4f) * Mathf.Rad2Deg, 0, 0);
                }
            }

            // ---- the Crown Jewels and the pearly trail
            for (int i = 0; i < jewels.Count && i < world.Treasures.Count; i++)
            {
                var tr = world.Treasures[i];
                var (t, glow, gm) = jewels[i];
                bool shown = tr.respawnIn <= 0;
                t.gameObject.SetActive(shown);
                glow.gameObject.SetActive(shown);
                if (!shown) continue;
                t.position = W.P(tr.x, tr.z, 0.15f + Mathf.Sin(time * 2.2f + i) * 0.15f);
                t.rotation = Quaternion.Euler(0, -(time * 1.4f + i) * Mathf.Rad2Deg, 0);
                t.localScale = Vector3.one * 1.4f;
                float pulse = 0.85f + 0.15f * Mathf.Sin(time * 4 + i * 1.3f);
                glow.position = W.P(tr.x, tr.z, 0.06f);
                glow.localScale = new Vector3(2.6f * pulse, 1, 2.6f * pulse);
                if (Random.value < dt * 6) Fx.I.Trail(t.position + Vector3.up * 1.6f + Random.insideUnitSphere * 0.5f, MeshKit.Hex(ModelsLondonZoo.JEWEL_COLOURS[i % 5]));
            }
            int nb = Mathf.Min(BUTTON_MAX, world.Buttons.Count);
            while (buttons.Count < nb)
            {
                var b = Inked(ModelsLondonZoo.PearlButton(), "button", 0.02f, root, Mats.Cached("pearl", () => { var m = Mats.Toon(Color.white, 1.4f, 0.9f, 0.9f); m.SetColor("_EmissionColor", new Color(0.35f, 0.33f, 0.28f)); return m; }));
                buttons.Add(b);
            }
            for (int i = 0; i < buttons.Count; i++)
            {
                bool on = i < nb;
                buttons[i].gameObject.SetActive(on);
                if (!on) continue;
                var b = world.Buttons[i];
                float age = (world.Tick - b.born) * World.STEP;
                float fade = Mathf.Clamp01((Sim.Treasures.BUTTON_LIFE - age) / 5);
                float s = (0.9f + 0.15f * Mathf.Sin(time * 5 - i * 0.6f)) * fade;
                buttons[i].position = W.P(b.x, b.z, 0.45f + Mathf.Sin(time * 3 + i) * 0.08f);
                buttons[i].localScale = Vector3.one * Mathf.Max(0.01f, s);
            }

            if (sp == null) return;
            float ft = world.Tick + alpha;
            int tick = world.Tick;

            // ---- Tower Bridge and the tall ship
            var lift = Sim.SetPieces.LiftAt(tick);
            float raise = lift.raise;
            if (basculeW != null) basculeW.localRotation = Quaternion.Euler(0, 0, raise * BASCULE_UP * Mathf.Rad2Deg);
            if (basculeE != null) basculeE.localRotation = Quaternion.Euler(0, 0, -raise * BASCULE_UP * Mathf.Rad2Deg);
            if (shipSail != (uint)(world.setPieceSeed % 4))
            {
                shipSail = (uint)(world.setPieceSeed % 4);
                uint[] sails = { 0xfffbea, 0xf6e1c6, 0xe8f1ff, 0xffe9ef };
                foreach (Transform c in ship) Object.Destroy(c.gameObject);
                Inked(ModelsLondonZoo.TallShip(sails[shipSail]), "ship", 0.04f, ship);
            }
            bool sailing = Sim.SetPieces.ShipAt(tick, sp, out float sx, out float sz, out float sh);
            ship.gameObject.SetActive(sailing);
            if (sailing)
            {
                float fade = Mathf.Min(1, lift.at / (float)Sim.SetPieces.TPS, (Sim.SetPieces.LIFT_BELLS + Sim.SetPieces.LIFT_RISE + Sim.SetPieces.LIFT_OPEN + 4 * Sim.SetPieces.TPS - lift.at) / (float)Sim.SetPieces.TPS);
                ship.position = W.P(sx, sz, LondonEnv.WATER_Y + 0.2f);
                ship.rotation = Quaternion.Euler(0, sh * Mathf.Rad2Deg, Mathf.Sin(time * 1.3f) * 1.5f);
                ship.localScale = Vector3.one * Mathf.Max(0.01f, fade);
            }

            // ---- the Changing of the Guard
            int nb2 = 0, ng = 0;
            for (int i = 0; i < world.MarcherCount; i++)
            {
                var m = world.Marchers[i];
                var t = m.band ? band[nb2++] : guards[ng++];
                t.gameObject.SetActive(true);
                t.position = W.P(m.x, m.z, Mathf.Abs(Mathf.Sin(time * 6 + i * 0.9f)) * 0.08f);
                t.rotation = Quaternion.Euler(0, m.heading * Mathf.Rad2Deg, 0);
            }
            for (int i = nb2; i < band.Count; i++) band[i].gameObject.SetActive(false);
            for (int i = ng; i < guards.Count; i++) guards[i].gameObject.SetActive(false);
            if (world.MarcherCount > 0 && Near(world.Marchers[0].x, world.Marchers[0].z, 30))
            {
                drumIn -= dt;
                if (drumIn <= 0) { drumIn = 0.43f; Synth.I?.Play(drumBeat++ % 4 == 0 ? "drumAccent" : "drum", 0.8f); }
            }

            // ---- the river bus (it ducks under the Millennium Bridge, squashing comically)
            var bt = Sim.SetPieces.BoatAt(tick, sp);
            var mil = sp.millennium;
            float d = Mathf.Max(Mathf.Abs(bt.x - mil.x) - mil.w / 2, Mathf.Abs(bt.z - mil.z) - mil.d / 2);
            float duck = Mathf.Clamp01(1 - d / 2.5f);
            boat.position = W.P(bt.x, bt.z, LondonEnv.WATER_Y + 0.25f - duck * 0.25f + Mathf.Sin(time * 2) * 0.03f);
            boat.rotation = Quaternion.Euler(0, bt.heading * Mathf.Rad2Deg, 0);
            boat.localScale = new Vector3(1, 1 - duck * 0.65f, 1);

            // ---- the Eye in rainbow while the fireworks are on
            bool show = Sim.SetPieces.FireworksClock(tick) >= 0;
            for (int i = 0; i < eyeLights.Count; i++)
            {
                eyeLights[i].gameObject.SetActive(show);
                if (!show) continue;
                var c = Color.HSVToRGB((i / (float)EYE_LIGHTS + time * 0.25f) % 1, 0.75f, 1);
                mpb.SetColor("_BaseColor", c);
                mpb.SetColor("_EmissionColor", c * 2.5f);
                eyeLights[i].GetComponent<MeshRenderer>().SetPropertyBlock(mpb);
            }

            // ---- the Red Arrows, and their smoke
            bool flying = Sim.SetPieces.ArrowsAt(tick, sp, world.setPieceSeed, out var a);
            for (int i = 0; i < 3; i++)
            {
                jets[i].gameObject.SetActive(flying);
                smoke[i].gameObject.SetActive(flying);
                if (!flying) continue;
                float side = i == 0 ? 0 : i == 1 ? -1 : 1, back = i == 0 ? 0 : 3.5f;
                float cx = Mathf.Cos(a.heading), cz = Mathf.Sin(a.heading);
                float x = a.x - cx * back - cz * side * 3, z = a.z - cz * back + cx * side * 3;
                float y = JET_Y + Mathf.Sin(time * 3 + i) * 0.2f;
                jets[i].position = W.P(x, z, y);
                jets[i].rotation = Quaternion.Euler(0, a.heading * Mathf.Rad2Deg, 0);
                float smx = a.x0 - cz * side * 3, smz = a.z0 + cx * side * 3;
                float len = Mathf.Max(0.1f, Collide.Hypot(x - smx, z - smz) - 1.5f), keep = Mathf.Min(len, 140);
                smoke[i].localScale = new Vector3(keep, 1, 1);
                smoke[i].position = W.P(x - cx * (1.5f + keep / 2), z - cz * (1.5f + keep / 2), y - 0.1f);
                smoke[i].rotation = jets[i].rotation;
                var col = smokeMats[i].GetColor("_Color");
                col.a = 0.7f * Mathf.Min(1, (1 - a.t) * 4);
                smokeMats[i].SetColor("_Color", col);
            }

            // ---- the wobbly bridge sways (more with a snake on it)
            if (millennium != null)
            {
                bool busy = false;
                foreach (var s in world.Snakes) if (s.alive && mil.Contains(s.x, s.z)) { busy = true; break; }
                sway += ((busy ? 1 : 0.15f) - sway) * Mathf.Min(1, dt * 2);
                millennium.localRotation = Quaternion.Euler(0, 0, Sim.SetPieces.WobbleAt(tick) * 0.05f * sway * Mathf.Rad2Deg);
            }

            // ---- up on the London Eye: your own capsule goes round, gold-collared, with you inside
            var rider = world.Me;
            float ride = world.EyeRide(rider);
            eyeRide.gameObject.SetActive(ride >= 0);
            if (ride >= 0)
            {
                EyeRidePoint(ride + alpha / World.EYE_RIDE, out var at);
                eyeRide.position = at;
                eyeRide.rotation = Quaternion.identity;
                eyeRide.localScale = Vector3.one * (1 + 0.04f * Mathf.Sin(time * 3));
                if (Random.value < dt * 10) Fx.I.Trail(at + Random.insideUnitSphere * 1.2f, MeshKit.Hex(rider.look.body));
            }
        }

        /// <summary>Where the rider's capsule is, `t` (0..1) of the way round: from the bottom, up the river side, over the top and down.</summary>
        public static void EyeRidePoint(float t, out Vector3 at)
        {
            var e = London.LONDON_EYE;
            float a = -Mathf.PI / 2 - Mathf.Clamp01(t) * Mathf.PI * 2;
            at = W.P(e.x + Mathf.Cos(a) * EYE_POD_R, e.z + EYE_HUB_DZ, EYE_HUB_Y + Mathf.Sin(a) * EYE_POD_R);
        }

        /// <summary>A length of rope from one child's hands to the next (never across the park after a jump).</summary>
        void RopeBetween(int i, Vector3 a, Vector3 b)
        {
            while (ropes.Count <= i)
            {
                var r = Inked(ModelsLondonZoo.Rope(), "rope", 0, root);
                ropes.Add(r);
            }
            var t = ropes[i];
            float len = Vector3.Distance(a, b);
            bool on = len > 0.05f && len < 2;
            t.gameObject.SetActive(on);
            if (!on) return;
            float y = 0.42f * 1.35f * 0.85f;
            t.position = (a + b) / 2 + Vector3.up * y;
            t.rotation = Quaternion.LookRotation(b - a);
            t.localScale = new Vector3(1, 1, len);
        }
    }
}
