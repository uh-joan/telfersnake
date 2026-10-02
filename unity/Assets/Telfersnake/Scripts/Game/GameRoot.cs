using System.Collections.Generic;
using Telfer.Audio;
using Telfer.Sim;
using Telfer.UI;
using Telfer.View;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.UI;
using EventType = Telfer.Sim.EventType;

namespace Telfer.Game
{
    /// <summary>
    /// Boots the whole game from nothing: builds the playground, the light, the sound and the HUD,
    /// then runs the sim in fixed 1/60 s steps and turns its events into juice.
    /// The title screen is the real game playing itself, with a slow camera orbit.
    /// </summary>
    public sealed class GameRoot : MonoBehaviour
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Boot()
        {
            if (System.Environment.GetEnvironmentVariable("TELFER_NO_BOOT") == "1") return;
            if (FindAnyObjectByType<GameRoot>() == null) new GameObject("Telfersnake").AddComponent<GameRoot>();
        }

        enum State { Title, Play, Cards, Paused }

        State state = State.Title;
        World world;
        Transform runRoot;
        Views views;
        readonly List<SnakeView> snakeViews = new List<SnakeView>();
        Scenery scenery;
        Atmosphere atmo;
        CameraRig rig;
        Hud hud;
        Synth synth;
        Controls controls;
        Bot attract;
        float acc, slowmo, slowmoFor;
        readonly Vector4[] pushers = new Vector4[16];
        bool wasDashing;
        int bestSaved;
        bool mobile;
        public static GameRoot I;
        /// <summary>Dev: a bot drives the player's snake in a real run (screenshots, soak tests).</summary>
        public static bool Autopilot;
        Bot pilot;
        public World World => world;

        void Start()
        {
            I = this;
            mobile = Application.isMobilePlatform || Application.platform == RuntimePlatform.WebGLPlayer;
            Application.targetFrameRate = mobile ? 60 : 120;
            QualitySettings.vSyncCount = mobile ? 0 : 1;

            var es = new GameObject("EventSystem", typeof(EventSystem), typeof(InputSystemUIInputModule));
            es.transform.SetParent(transform, false);

            var envRoot = new GameObject("Environment").transform;
            envRoot.SetParent(transform, false);
            atmo = new GameObject("Atmosphere").AddComponent<Atmosphere>();
            atmo.transform.SetParent(transform, false);
            atmo.Build(mobile);
            rig = new GameObject("Camera").AddComponent<CameraRig>();
            rig.transform.SetParent(transform, false);
            rig.Build();

            Ground.Build(envRoot, !mobile);
            scenery = new Scenery(envRoot);
            var grass = new GameObject("Grass").AddComponent<GrassField>();
            grass.transform.SetParent(envRoot, false);
            grass.Build();
            var life = new GameObject("Wildlife").AddComponent<Wildlife>();
            life.transform.SetParent(envRoot, false);
            life.Build();
            var fx = new GameObject("Fx").AddComponent<Fx>();
            fx.transform.SetParent(transform, false);
            fx.Build();
            synth = new GameObject("Synth").AddComponent<Synth>();
            synth.transform.SetParent(transform, false);
            synth.Build();

            hud = new GameObject("HUD").AddComponent<Hud>();
            hud.transform.SetParent(transform, false);
            hud.Build();
            hud.OnPlay = StartRun;
            hud.OnPause = () => SetPaused(true);
            hud.OnResume = () => SetPaused(false);
            hud.OnQuit = () => { SetPaused(false); ToTitle(); };
            hud.OnSound = on => { synth.SfxOn = on; synth.MusicOn = on; };

            controls = new Controls();
            Shots.BeforeRender = () => { if (state != State.Title) hud.Sync(world, rig.Cam, i => snakeViews[i].HeadPos, 0); };
            bestSaved = PlayerPrefs.GetInt("best", 0);
            NewWorld(Mode.Normal, true);
            rig.TitleOrbit(0);
        }

        // ------------------------------------------------------------------ runs

        void NewWorld(Mode mode, bool attractMode)
        {
            if (runRoot) Destroy(runRoot.gameObject);
            snakeViews.Clear();
            runRoot = new GameObject("Run").transform;
            runRoot.SetParent(transform, false);
            world = new World((uint)System.Environment.TickCount, mode);
            views = new Views(world, runRoot);
            for (int i = 0; i < world.Snakes.Count; i++)
            {
                var sv = new SnakeView(world.Snakes[i], runRoot, i == 0 && !attractMode);
                sv.OnStep();
                sv.OnStep();
                snakeViews.Add(sv);
            }
            pilot = null;
            attract = attractMode ? new Bot(new Personality("You", 0x4cbb4a, 0xf2d94a, 0x57c955, 0, 1, 1, 0.9f, 0.1f, 0.3f, false, 400)) : null;
            acc = 0;
        }

        void StartRun(Mode mode)
        {
            synth.Play("bell");
            synth.Play("pick");
            NewWorld(mode, false);
            state = State.Play;
            hud.ShowTitle(false);
            var me = world.Me;
            rig.Snap(W.P(me.x, me.z), me.Length);
            synth.SetMusicLevel(0);
            Fx.I.Ring(W.P(me.x, me.z), Color.white, 4, 0.6f);
        }

        void ToTitle()
        {
            SaveBest();
            hud.HideCards();
            NewWorld(Mode.Normal, true);
            state = State.Title;
            hud.ShowTitle(true);
            synth.Duck(false);
        }

        void SetPaused(bool on)
        {
            if (state == State.Title) return;
            if (on && state == State.Play) { state = State.Paused; hud.ShowPause(true); synth.Duck(true); }
            else if (!on && state == State.Paused) { state = world.Me.cards != null ? State.Cards : State.Play; hud.ShowPause(false); synth.Duck(state == State.Cards); }
        }

        void SaveBest()
        {
            if (world == null || attract != null) return;
            int s = (int)world.Me.score;
            if (s > bestSaved) { bestSaved = s; PlayerPrefs.SetInt("best", s); PlayerPrefs.Save(); }
        }

        void Choose(int i)
        {
            if (state != State.Cards || world.Me.cards == null) return;
            var card = world.Me.cards[Mathf.Clamp(i, 0, world.Me.cards.Length - 1)];
            world.Choose(i);
            hud.HideCards();
            synth.Play("pick");
            synth.Duck(false);
            state = State.Play;
            var head = snakeViews[0].HeadPos;
            Fx.I.Stars(head, 18);
            Fx.I.Ring(head, new Color(0.5f, 0.8f, 1f), 3, 0.5f);
            hud.Pop(head, Upgrades.DEFS[(int)card].label + "!", new Color(0.6f, 0.9f, 1f), 40, 1.3f);
        }

        // ------------------------------------------------------------------ the frame

        void Update()
        {
            float realDt = Mathf.Min(Time.unscaledDeltaTime, 0.1f);
            if (slowmoFor > 0)
            {
                slowmoFor -= realDt;
                slowmo = Mathf.Lerp(slowmo, 0.3f, 1 - Mathf.Exp(-realDt * 20));
            }
            else slowmo = Mathf.Lerp(slowmo, 1, 1 - Mathf.Exp(-realDt * 6));
            float dt = realDt * slowmo;

            // Keys that work everywhere.
            if (Controls.Pressed(Key.Escape) || Controls.PadPressed(p => p.startButton))
            {
                if (state == State.Play) SetPaused(true);
                else if (state == State.Paused) SetPaused(false);
            }
            if (state == State.Title && (Controls.Pressed(Key.Enter) || Controls.PadPressed(p => p.buttonSouth))) StartRun(hud.Mode);
            if (state == State.Cards)
            {
                if (Controls.Pressed(Key.Digit1) || Controls.Pressed(Key.Numpad1)) Choose(0);
                if (Controls.Pressed(Key.Digit2) || Controls.Pressed(Key.Numpad2)) Choose(1);
                if (Controls.Pressed(Key.Digit3) || Controls.Pressed(Key.Numpad3)) Choose(2);
            }

            var me = world.Me;
            var meView = snakeViews[0];
            var cam = rig.Cam;
            var headScreen = (Vector2)cam.WorldToScreenPoint(meView.HeadPos);
            controls.DashButtonHeld = hud.Pad.DashHeld;
            controls.Update(headScreen, realDt, hud.PointerOverUi() || state != State.Play);

            if (state == State.Play || state == State.Title)
            {
                acc += dt;
                int steps = 0;
                while (acc >= World.STEP && steps < 6)
                {
                    SnakeInput input;
                    if (attract != null) input = attract.Think(me, world, World.STEP);
                    else if (Autopilot) input = (pilot ?? (pilot = new Bot(new Personality("You", 0, 0, 0, 0, 1, 1, 0.9f, 0.1f, 0.4f, false, 9999)))).Think(me, world, World.STEP);
                    else input = new SnakeInput { x = controls.Steer.x, z = -controls.Steer.y, active = controls.Active, dash = controls.Dash };
                    world.Step(input);
                    views.OnStep();
                    foreach (var sv in snakeViews) sv.OnStep();
                    acc -= World.STEP;
                    steps++;
                    HandleEvents();
                    if (me.cards != null)
                    {
                        if (attract != null || (Autopilot && state == State.Play)) { world.Choose(Random.Range(0, 3)); continue; }
                        else if (state == State.Play) { OpenCards(); break; }
                    }
                }
                if (steps == 6) acc = 0;
            }

            float alpha = state == State.Play || state == State.Title ? Mathf.Clamp01(acc / World.STEP) : 1;
            float time = Time.time;
            var steerWorld = new Vector2(controls.Steer.x, controls.Steer.y);
            for (int i = 0; i < snakeViews.Count; i++)
                snakeViews[i].Sync(alpha, dt, time, world.Tick, i == 0 && attract == null ? steerWorld : Vector2.zero);
            views.Sync(alpha, dt, time, me);

            // Camera.
            if (state == State.Title) rig.TitleOrbit(realDt);
            else
            {
                var vel = W.Dir(me.heading) * (me.alive ? me.BaseSpeed * me.speedFactor : 0);
                rig.Follow(me.alive ? meView.HeadPos : rig.transform.position + rig.transform.forward * 20, vel, me.Length, me.dashing, realDt);
            }
            atmo.Focus(state == State.Title ? 60 : rig.FocusDistance);

            // Dash feedback.
            if (attract == null && me.dashing && !wasDashing) synth.Play("zip", 0.8f);
            wasDashing = me.dashing;
            for (int i = 0; i < world.Snakes.Count; i++)
            {
                var s = world.Snakes[i];
                if (s.alive && s.dashing && Random.value < 0.6f) Fx.I.Trail(snakeViews[i].BodyPoint(s.Length * Random.value * 0.6f) + Random.insideUnitSphere * 0.3f, MeshKit.Hex(s.look.stripe));
            }

            Occlusion(realDt);
            Pushers();

            // HUD.
            hud.ShowStick(controls.StickOn && state == State.Play, controls.StickBase, controls.StickKnob);
            hud.SetBubbleWorld(views.CooperHead);
            if (state != State.Title)
            {
                hud.Sync(world, cam, i => snakeViews[i].HeadPos, realDt);
                hud.ShowBonk(state == State.Play && !me.alive, me.respawnIn);
                synth.SetMusicLevel(me.alive ? me.Tier : 0);
            }
            else synth.SetMusicLevel(2);
        }

        void OpenCards()
        {
            state = State.Cards;
            synth.Play("levelUp");
            synth.Duck(true);
            hud.ShowCards(world.Me.cards, world.Me, Choose);
        }

        // ------------------------------------------------------------------ events into juice

        void HandleEvents()
        {
            bool live = attract == null;
            foreach (var e in world.Events)
            {
                bool mine = e.who == 0 && live;
                var sv = e.who >= 0 && e.who < snakeViews.Count ? snakeViews[e.who] : null;
                var at = W.P(e.x, e.z);
                switch (e.type)
                {
                    case EventType.Eat:
                        Fx.I.Munch(at, Models.FoodColor(e.food), e.golden);
                        sv?.Gulp(e.golden ? 0.3f : 0.16f);
                        if (sv != null) views.SwallowFood(e, sv);
                        if (mine)
                        {
                            synth.Eat();
                            if (e.golden) { synth.Play("golden"); rig.Shake(0.12f); }
                            hud.Pop(at + Vector3.up, "+" + (int)e.points, e.golden ? new Color(1f, 0.85f, 0.3f) : Color.white, e.golden ? 46 : 32);
                        }
                        break;
                    case EventType.Gulp:
                        Fx.I.Gulp(at, Models.AnimalColor(e.animal), Animals.SPECS[(int)e.animal].radius * 2.5f);
                        sv?.Gulp(0.5f);
                        if (sv != null) views.SwallowAnimal(e, sv);
                        if (mine)
                        {
                            synth.Play("gulp-" + e.animal);
                            rig.Shake(0.18f);
                            hud.Pop(at + Vector3.up * 1.4f, "+" + (int)e.points, new Color(0.6f, 1f, 0.5f), 48, 1.2f);
                        }
                        else if (live && Near(at)) synth.Play("voice-" + e.animal, 0.4f);
                        break;
                    case EventType.Boop:
                        if (mine)
                        {
                            synth.Play("boing");
                            rig.Shake(0.22f);
                            Fx.I.Stars(at, 8);
                            hud.Pop(at + Vector3.up * 1.2f, "Boing!", new Color(1f, 0.9f, 0.5f), 40);
                        }
                        break;
                    case EventType.Ouch:
                        Fx.I.Dust(at, 1.2f);
                        if (mine)
                        {
                            synth.Play("ouch");
                            rig.Shake(0.4f);
                            atmo.Hit(0.6f);
                            hud.Pop(at + Vector3.up * 1.2f, "Ouch!", new Color(1f, 0.5f, 0.45f), 44);
                        }
                        if (e.broke && live && Near(at)) synth.Play("crumble", mine ? 1 : 0.5f);
                        break;
                    case EventType.Rock:
                        Fx.I.Rubble(at, new Color(0.6f, 0.6f, 0.62f));
                        break;
                    case EventType.Pellet:
                        if (mine) { synth.Play("pellet", 0.7f); sv?.Gulp(0.1f); }
                        break;
                    case EventType.Tier:
                        if (mine)
                        {
                            synth.Play("tierUp");
                            slowmoFor = 0.7f;
                            atmo.TierUp();
                            rig.Punch(1);
                            Fx.I.Confetti(snakeViews[0].HeadPos, 110, 9);
                            Fx.I.Ring(snakeViews[0].HeadPos, new Color(1f, 0.85f, 0.3f), 9, 0.9f);
                            hud.ShowTier(e.tier, Hud.NextGulps(e.tier));
                        }
                        break;
                    case EventType.Bonk:
                        Fx.I.Confetti(at, 60, 6);
                        Fx.I.Stars(at, 14);
                        Fx.I.Ring(at, MeshKit.Hex(world.Snakes[e.who].look.body), 5, 0.6f);
                        if (mine)
                        {
                            synth.Play("bonked");
                            rig.Shake(0.9f);
                            atmo.Hit(1);
                            SaveBest();
                        }
                        else if (e.by == 0 && live)
                        {
                            synth.Play("bonkedRival");
                            rig.Shake(0.3f);
                            hud.Pop(at + Vector3.up * 1.5f, "Bonk! +80", new Color(1f, 0.6f, 0.9f), 50, 1.4f);
                        }
                        break;
                    case EventType.Helmet:
                        Fx.I.Ring(at, new Color(1f, 0.4f, 0.4f), 3, 0.4f);
                        if (mine) { synth.Play("clonk"); rig.Shake(0.4f); hud.Pop(at + Vector3.up, "Clonk!", Color.white, 40); }
                        break;
                    case EventType.Respawn:
                        Fx.I.Ring(at, Color.white, 4, 0.6f);
                        Fx.I.Stars(at, 10);
                        if (mine) synth.Play("respawn");
                        break;
                    case EventType.Breath:
                        Fx.I.Fire(at, W.Dir(e.heading), e.range);
                        if (mine) { synth.Play("whoosh"); rig.Shake(0.2f); }
                        break;
                    case EventType.Sneeze:
                        Fx.I.Dust(at, 1);
                        break;
                    case EventType.Say:
                        if (live) hud.Say(e.text, views.CooperHead);
                        break;
                    case EventType.BumpWall:
                        if (mine) { synth.Play("bump", 0.7f); rig.Shake(0.08f); }
                        break;
                    case EventType.BumpCooper:
                        if (mine) { synth.Play("boing"); rig.Shake(0.2f); }
                        break;
                }
            }
            world.Events.Clear();
        }

        bool Near(Vector3 p) => Vector3.Distance(p, rig.transform.position) < 45;

        // ------------------------------------------------------------------ helpers

        /// <summary>Buildings and trees between the camera and the player's snake dissolve, so a child never loses it.</summary>
        void Occlusion(float dt)
        {
            var me = world.Me;
            bool watching = state != State.Title && me.alive;
            var block = new MaterialPropertyBlock();
            foreach (var o in scenery.Occluders)
            {
                bool hidden = watching && me.x > o.minX - 1 && me.x < o.maxX + 1 && me.z > o.northZ - o.reach && me.z < o.southZ + 0.5f;
                float want = hidden ? 0.3f : 1;
                float f = Mathf.MoveTowards(o.fade, want, dt * 3.5f);
                if (Mathf.Approximately(f, o.fade) && f >= 1) continue;
                o.fade = f;
                foreach (var r in o.renderers)
                {
                    if (!r) continue;
                    r.GetPropertyBlock(block);
                    block.SetFloat("_Fade", f);
                    r.SetPropertyBlock(block);
                }
            }
        }

        /// <summary>The things that part the grass on the Green: snakes, animals and Mr Cooper.</summary>
        void Pushers()
        {
            int n = 0;
            var g = School.GREEN;
            bool Near(float x, float z) => Mathf.Abs(x - g.x) < g.w / 2 + 2 && Mathf.Abs(z - g.z) < g.d / 2 + 2;
            void Add(float x, float z, float r) { if (n < 16 && Near(x, z)) pushers[n++] = new Vector4(x, 0, -z, r); }
            foreach (var s in world.Snakes)
            {
                if (!s.alive) continue;
                Add(s.x, s.z, s.Radius * 1.4f);
                for (int i = 0; i < s.bodyCount && n < 16; i += 3) Add(s.body[i * 2], s.body[i * 2 + 1], s.Radius * 1.2f);
            }
            foreach (var a in world.Animals) Add(a.x, a.z, a.Spec.radius * 1.2f);
            Add(world.Cooper.x, world.Cooper.z, 0.5f);
            Atmosphere.SetPushers(pushers, n);
        }

        void OnApplicationPause(bool paused)
        {
            if (paused) { SaveBest(); if (state == State.Play) SetPaused(true); }
        }

        void OnApplicationQuit() => SaveBest();
    }
}
