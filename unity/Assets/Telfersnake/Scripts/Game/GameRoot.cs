using System.Collections.Generic;
using Telfer.Audio;
using Telfer.Meta;
using Telfer.Net;
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
    /// Boots the whole game from nothing: builds the places, the light, the sound and the HUD, then
    /// runs the sim in fixed 1/60 s steps and turns its events into juice. The title screen is the real
    /// game playing itself, with a slow camera orbit, in whichever place is picked.
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

        /// <summary>Stars pay ×1.25 on the Common and ×1.5 in London, half on Easy (main.ts PLACES bonus).</summary>
        const float COMMON_BONUS = 1.25f, LONDON_BONUS = 1.5f;

        State state = State.Title;
        World world;
        Transform runRoot, envRoot, schoolRoot;
        Views views;
        WildViews wild;
        readonly List<SnakeView> snakeViews = new List<SnakeView>();
        Scenery scenery;
        CommonEnv common;
        LondonEnv london;
        Atmosphere atmo;
        CameraRig rig;
        Hud hud;
        Synth synth;
        Controls controls;
        Bot attract;
        float acc, slowmo, slowmoFor;
        readonly Vector4[] pushers = new Vector4[16];
        readonly List<(float d, Vector4 p)> pushPool = new List<(float, Vector4)>();
        bool wasDashing;
        MaterialPropertyBlock block;
        System.Func<int, Vector3> headOf;
        int runGulps, runBonks, runGems;
        float runLongest;
        bool mobile;
        StageId shownStage = (StageId)(-1);
        public static GameRoot I;
        /// <summary>Dev: a bot drives the player's snake in a real run (screenshots, soak tests).</summary>
        public static bool Autopilot;
        /// <summary>Dev: point the camera at a spot (sim x, z) instead of the snake; null to follow again.</summary>
        public static Vector2? LookAt;
        /// <summary>Dev: like LookAt, but evaluated every frame (follow Mr Cooper, a rival...).</summary>
        public static System.Func<Vector2> LookAtFn;
        public static float LookDistance = 24;
        Bot pilot;
        public World World => world;
        /// <summary>The online run being played (null in solo), and one still waiting for its seat.</summary>
        Replica net, joining;
        int netSeatsSeen;
        public Replica Net => net;
        /// <summary>Why the last online attempt did not start or ended ('' while fine): offline, lost, full, old, busy.</summary>
        public string NetWhy { get; private set; } = "";
        /// <summary>The player's snake: 0 in solo, the server's seat online.</summary>
        int MeIx => world.MeIndex;
        Profile P => Profile.I;

        void Start()
        {
            I = this;
            mobile = Application.isMobilePlatform || Application.platform == RuntimePlatform.WebGLPlayer;
            // WebGL paces itself with requestAnimationFrame; a target rate there would swap in a timer.
            if (Application.platform != RuntimePlatform.WebGLPlayer) Application.targetFrameRate = mobile ? 60 : 120;
            QualitySettings.vSyncCount = mobile || Application.isEditor ? 0 : 1;

            var es = new GameObject("EventSystem", typeof(EventSystem), typeof(InputSystemUIInputModule));
            es.transform.SetParent(transform, false);

            envRoot = new GameObject("Environment").transform;
            envRoot.SetParent(transform, false);
            atmo = new GameObject("Atmosphere").AddComponent<Atmosphere>();
            atmo.transform.SetParent(transform, false);
            atmo.Build(mobile);
            rig = new GameObject("Camera").AddComponent<CameraRig>();
            rig.transform.SetParent(transform, false);
            rig.Build();
            var fx = new GameObject("Fx").AddComponent<Fx>();
            fx.transform.SetParent(transform, false);
            fx.Build();
            synth = new GameObject("Synth").AddComponent<Synth>();
            synth.transform.SetParent(transform, false);
            synth.Build();

            hud = new GameObject("HUD").AddComponent<Hud>();
            hud.transform.SetParent(transform, false);
            hud.Build();
            hud.OnPlay = _ => Play();
            hud.OnPause = () => SetPaused(true);
            hud.OnResume = () => SetPaused(false);
            hud.OnQuit = () => { SetPaused(false); FinishRun(); };
            hud.OnSound = on => { synth.SfxOn = on; synth.MusicOn = on; };
            hud.OnStage = ChooseStage;
            hud.OnMode = m => { P.Mode = m; P.Save(); };
            hud.OnShopChanged = () => { if (state == State.Title) NewWorld(P.Mode, P.Stage, true); else Wear(); };

            controls = new Controls();
            headOf = i => snakeViews[i].HeadPos;
            block = new MaterialPropertyBlock();
            Shots.BeforeRender = () => { rig.Refit(); if (state != State.Title) hud.Sync(world, rig.Cam, headOf, 0); SyncLondon(0); };
            NewWorld(P.Mode, P.Stage, true);
            rig.TitleOrbit(0);
            hud.RefreshTitle();
        }

        /// <summary>
        /// From the WebGL page: the safe area (notches, the home bar) as "left,bottom,right,top" insets,
        /// each a fraction of the screen, since Screen.safeArea does not know it in a browser.
        /// </summary>
        public void SafeInsets(string csv)
        {
            var v = csv.Split(',');
            if (v.Length != 4) return;
            float F(int i) => float.TryParse(v[i], System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var f) ? Mathf.Clamp(f, 0, 0.3f) : 0;
            Fit.SafeFrac = new Rect(F(0), F(1), 1 - F(0) - F(2), 1 - F(1) - F(3));
        }

        // ------------------------------------------------------------------ places

        /// <summary>Show the chosen place, building it the first time it is needed.</summary>
        void ShowPlace(StageId id)
        {
            if (id == shownStage) return;
            shownStage = id;
            if (id == StageId.School && schoolRoot == null)
            {
                schoolRoot = new GameObject("School").transform;
                schoolRoot.SetParent(envRoot, false);
                Ground.Build(schoolRoot, !mobile);
                scenery = new Scenery(schoolRoot);
                var grass = new GameObject("Grass").AddComponent<GrassField>();
                grass.transform.SetParent(schoolRoot, false);
                grass.BuildSchool();
                var life = new GameObject("Wildlife").AddComponent<Wildlife>();
                life.transform.SetParent(schoolRoot, false);
                life.Build(School.Stage);
            }
            if (id == StageId.Common && common == null) common = new CommonEnv(envRoot, !mobile);
            if (id == StageId.London && london == null) london = new LondonEnv(envRoot, !mobile);
            if (schoolRoot) schoolRoot.gameObject.SetActive(id == StageId.School);
            if (common != null) common.root.gameObject.SetActive(id == StageId.Common);
            if (london != null) london.root.gameObject.SetActive(id == StageId.London);
            synth.SetPlace(id != StageId.School);
            atmo.SetPlace(id);
        }

        /// <summary>London's own life: landmark animations, props, ribbons and the see-through fade toward the snake.</summary>
        void SyncLondon(float dt)
        {
            if (shownStage != StageId.London || london == null) return;
            var me = world.Me;
            bool looking = LookAt.HasValue;
            var focus = looking ? W.P(LookAt.Value.x, LookAt.Value.y) : snakeViews[MeIx].HeadPos;
            // Up on the London Eye the camera sees the whole map: nothing stands between it and you, so nothing fades.
            bool craned = me.alive && me.carried == Carrier.Eye;
            london.Sync(rig.Cam, focus, !craned && (looking || state != State.Title && me.alive), looking || state != State.Title, Time.time, dt, craned);
        }

        List<Occluder> Occluders => shownStage == StageId.Common ? common.Occluders : shownStage == StageId.London ? london.Occluders : scenery.Occluders;

        /// <summary>How close the chase camera sits in each place.</summary>
        static float ZoomFor(StageId id) => id == StageId.Common ? CameraRig.COMMON_ZOOM : id == StageId.London ? CameraRig.LONDON_ZOOM : 1;

        /// <summary>
        /// Tapping a locked place buys its ticket the first time (if you can), then picks it: the Common for
        /// 300 stars, London for 600 once the Common is open (main.ts chooseStage).
        /// </summary>
        void ChooseStage(StageId id)
        {
            if (joining != null) return;
            P.Refresh(); // another tab may have bought this ticket already: never charge twice
            bool locked = id == StageId.Common ? !P.commonUnlocked : id == StageId.London && !P.londonUnlocked;
            if (locked)
            {
                int cost = id == StageId.London ? Profile.LONDON_COST : Profile.COMMON_COST;
                bool needsFirst = id == StageId.London && !P.commonUnlocked;
                if (needsFirst || P.stars < cost) { synth.Play("nope"); hud.ShakeStage(id); return; }
                P.stars -= cost;
                if (id == StageId.London) P.londonUnlocked = true;
                else P.commonUnlocked = true;
                synth.Play("chaChing");
                Fx.I.Confetti(rig.transform.position + rig.transform.forward * 20, 120, 9);
            }
            else synth.Play("pick");
            P.Stage = id;
            P.Save();
            NewWorld(P.Mode, P.Stage, true);
            hud.RefreshTitle();
        }

        // ------------------------------------------------------------------ runs

        void NewWorld(Mode mode, StageId stageId, bool attractMode)
        {
            ShowPlace(stageId);
            if (net != null) { net.Leave(); net = null; }
            if (runRoot) Destroy(runRoot.gameObject);
            RunAssets.Release();
            snakeViews.Clear();
            runRoot = new GameObject("Run").transform;
            runRoot.SetParent(transform, false);
            var look = attractMode ? null : P.Look();
            // The dev autopilot picks cards without paying, so it is never offered powers.
            world = new World((uint)System.Environment.TickCount, mode, Stage.For(stageId), look, !attractMode && !Autopilot && P.gems >= Upgrades.POWER_GEM_COST);
            bubbleFromSami = false;
            hud.ClearBubble();
            SnakeView.WaterStage = world.Stage.Water != null ? world.Stage : null;
            views = new Views(world, runRoot);
            wild = new WildViews(world, runRoot);
            var skin = Catalogue.FindSkin(P.skin);
            var trail = Catalogue.Find(P.trail);
            for (int i = 0; i < world.Snakes.Count; i++)
            {
                bool mine = i == 0 && !attractMode;
                var sv = mine
                    ? new SnakeView(world.Snakes[i], runRoot, true, skin?.pattern, P.hat, trail?.palette)
                    : new SnakeView(world.Snakes[i], runRoot, false);
                sv.OnStep();
                sv.OnStep();
                snakeViews.Add(sv);
            }
            pilot = null;
            attract = attractMode ? new Bot(new Personality("You", 0x4cbb4a, 0xf2d94a, 0x57c955, 0, 1, 1, 0.9f, 0.1f, 0.3f, false, 400)) : null;
            acc = 0;
            hud.SetStage(world.Stage);
        }

        void StartRun()
        {
            synth.Play("bell");
            synth.Play("pick");
            NewWorld(P.Mode, P.Stage, false);
            state = State.Play;
            runGulps = runBonks = runGems = 0;
            runLongest = 0;
            worn = Outfit;
            hud.ShowTitle(false);
            var me = world.Me;
            rig.Zoom = ZoomFor(world.Stage.Id);
            rig.Snap(W.P(me.x, me.z), me.Length);
            synth.SetMusicLevel(0);
            Fx.I.Ring(W.P(me.x, me.z), Color.white, 4, 0.6f);
            FirstVisit();
        }

        /// <summary>A one-time fanfare the first time a child plays a place they bought.</summary>
        void FirstVisit()
        {
            if (world.Stage.Id == StageId.Common && !P.commonSeen)
            {
                P.commonSeen = true;
                P.Save();
                hud.Banner("The Common!", null);
            }
            else if (world.Stage.Id == StageId.London && !P.londonSeen && RealRun)
            {
                P.londonSeen = true;
                P.Save();
                hud.Banner("London!", null);
            }
        }

        // ------------------------------------------------------------------ online runs

        /// <summary>Longest wait for the first snapshot (the welcome itself times out at 2.5 s) before playing alone.</summary>
        const float JOIN_GIVE_UP = 4;
        float joinFor;

        /// <summary>
        /// Play always means the shared playground; with no server (or no seat) the same game runs here
        /// alone, without a word. A second tap while the seat is being found does nothing.
        /// </summary>
        void Play()
        {
            if (joining != null || state != State.Title) return;
            synth.Play("pick");
            hud.ShowTitle(true);
            hud.Connecting(true);
            StartOnline(P.name);
        }

        /// <summary>What I am wearing and called, as sent to the server.</summary>
        string Outfit => P.skin + "|" + P.hat + "|" + P.trail + "|" + P.name;
        string worn;

        /// <summary>Clothes changed in the Tuck Shop mid-run: everyone online sees them (the server echoes the seat back); alone, the snake is redressed.</summary>
        void Wear()
        {
            if (Outfit == worn || state == State.Title) return;
            worn = Outfit;
            if (net != null) { net.Net.Wear(P.skin, P.hat, P.trail, P.name); return; }
            var me = world.Me;
            var look = P.Look();
            me.look.body = look.body; me.look.stripe = look.stripe; me.look.head = look.head;
            var trail = Catalogue.Find(P.trail);
            snakeViews[MeIx].Destroy();
            snakeViews[MeIx] = new SnakeView(me, runRoot, true, Catalogue.FindSkin(P.skin)?.pattern, P.hat, trail?.palette);
            snakeViews[MeIx].OnStep();
            snakeViews[MeIx].OnStep();
        }

        /// <summary>
        /// Ask the server for a seat in a shared playground with the chosen mode and place. The title keeps
        /// playing until the first snapshot arrives, then the run starts as StartRun does. If the seat never
        /// comes, <see cref="NetWhy"/> says why and nothing else happens (the caller can play solo).
        /// </summary>
        public void StartOnline(string name = "Telfer", string url = null)
        {
            joining?.Leave();
            NetWhy = "";
            bool canBuy = !Autopilot && P.gems >= Upgrades.POWER_GEM_COST;
            joining = Replica.Join(P.Mode, P.Stage, canBuy, P.skin, P.hat, P.trail, name, url);
            joinFor = 0;
        }

        /// <summary>Dev, from Tools/ev.sh in play mode: join the local server with the autopilot steering.</summary>
        public static string DevOnline(bool autopilot = true)
        {
            if (I == null) return "no GameRoot (not playing?)";
            Autopilot = autopilot;
            I.hud.Connecting(true);
            I.StartOnline("Unity Dev");
            return "joining " + I.joining.Net.Url;
        }

        /// <summary>Dev: how the online run is doing, in one line.</summary>
        public static string NetStatus()
        {
            var r = I?.net ?? I?.joining;
            if (r == null) return "solo; last why=" + I?.NetWhy;
            var me = r.Snake;
            return r.State + (r.Why != "" ? "(" + r.Why + ")" : "") + " room=" + r.Room + " me=" + r.Me + " humans=" + r.HumanCount
                + " snaps=" + r.Snapshots + " tick=" + r.World?.Tick + " silent=" + r.SilentFor.ToString("F2")
                + " predErrMax=" + r.MaxPredictionError.ToString("F3") + " last=" + r.LastPredictionError.ToString("F3") + " resets=" + r.HardResets
                + " events=" + string.Join(",", System.Linq.Enumerable.Select(r.EventCounts, kv => kv.Key + ":" + kv.Value))
                + (me != null ? " score=" + me.score + " mass=" + me.mass.ToString("F1") + " alive=" + me.alive + " at=" + me.x.ToString("F1") + "," + me.z.ToString("F1") : "");
        }

        void PollJoin(float dt)
        {
            joining.Update(0, default);
            joinFor += dt;
            if (joining.State == NetState.Failed || joining.State == NetState.Closed || (!joining.Live && joinFor > JOIN_GIVE_UP))
            {
                bool waiting = joining.State == NetState.Connecting || joining.State == NetState.Joined;
                NetWhy = waiting ? "offline" : joining.Why;
                Debug.Log("Telfer.Net: no seat (" + NetWhy + ")");
                if (waiting) joining.Leave();
                joining = null;
                // Offline, full, busy or too old: the same game, here alone.
                hud.Connecting(false);
                if (state == State.Title) StartRun();
                return;
            }
            if (!joining.Live) return;
            var r = joining;
            joining = null;
            hud.Connecting(false);
            NewNetWorld(r);
            state = State.Play;
            runGulps = runBonks = runGems = 0;
            runLongest = 0;
            worn = Outfit;
            hud.ShowTitle(false);
            FirstVisit();
            var me = world.Me;
            rig.Zoom = ZoomFor(world.Stage.Id);
            rig.Snap(W.P(me.x, me.z), me.Length);
            synth.Play("bell");
            synth.SetMusicLevel(0);
        }

        /// <summary>NewWorld for an online run: the replica's world, with views made exactly as for solo.</summary>
        void NewNetWorld(Replica r)
        {
            ShowPlace(r.World.Stage.Id);
            if (net != null) net.Leave();
            if (runRoot) Destroy(runRoot.gameObject);
            RunAssets.Release();
            snakeViews.Clear();
            runRoot = new GameObject("Run").transform;
            runRoot.SetParent(transform, false);
            net = r;
            world = r.World;
            SnakeView.WaterStage = world.Stage.Water != null ? world.Stage : null;
            bubbleFromSami = false;
            hud.ClearBubble();
            views = new Views(world, runRoot);
            wild = new WildViews(world, runRoot);
            for (int i = 0; i < world.Snakes.Count; i++) snakeViews.Add(NetSnakeView(i));
            r.ChangedSeats.Clear();
            netSeatsSeen = r.SeatsVersion;
            pilot = null;
            attract = null;
            acc = 0;
            hud.SetStage(world.Stage);
        }

        /// <summary>A snake dressed the way its seat says (the server echoes my own clothes back too).</summary>
        SnakeView NetSnakeView(int i)
        {
            var seat = i < net.AllSeats.Length ? net.AllSeats[i] : null;
            var trail = seat != null ? Catalogue.Find(seat.trail) : null;
            var sv = new SnakeView(world.Snakes[i], runRoot, i == MeIx, seat?.look.pattern, seat?.hat, trail?.palette);
            sv.OnStep();
            sv.OnStep();
            return sv;
        }

        /// <summary>One frame of an online run: the replica moves everything, the views show it as it stands.</summary>
        void NetFrame(float dt, Snake me)
        {
            SnakeInput input = default;
            if (Autopilot) input = (pilot ?? (pilot = new Bot(new Personality("You", 0, 0, 0, 0, 1, 1, 0.9f, 0.1f, 0.4f, false, 9999)))).Think(me, world, World.STEP);
            else if (state == State.Play) input = new SnakeInput { x = controls.Steer.x, z = -controls.Steer.y, active = controls.Active, dash = controls.Dash };
            net.Update(dt, input);
            if (net.State != NetState.Joined)
            {
                NetWhy = net.Why;
                Debug.Log("Telfer.Net: run ended (" + NetWhy + ")");
                hud.Toast("Connection lost");
                FinishRun(); // home time with what was earned; a replica world is never stepped
                return;
            }
            if (net.SeatsVersion != netSeatsSeen)
            {
                netSeatsSeen = net.SeatsVersion;
                foreach (int i in net.ChangedSeats)
                {
                    if (i < snakeViews.Count) { snakeViews[i].Destroy(); snakeViews[i] = NetSnakeView(i); }
                    else while (snakeViews.Count < world.Snakes.Count) snakeViews.Add(NetSnakeView(snakeViews.Count));
                }
                net.ChangedSeats.Clear();
            }
            views.OnStep();
            wild.OnStep();
            foreach (var sv in snakeViews) sv.OnStep();
            HandleEvents();
            hud.ShowPlayers(net.HumanCount);
            // A shared playground never stops: the cards follow the server's offer, and go when it picks for me.
            if (Autopilot && state == State.Play && net.Cards != null) net.Pick(Random.Range(0, 3));
            else if (state == State.Play && net.Cards != null) OpenCards();
            else if (state == State.Cards && net.Cards == null) { hud.HideCards(); state = State.Play; synth.Duck(false); }
            if (state == State.Cards) hud.CardsTime(net.CardsFor / CARD_TIME);
        }

        /// <summary>Seconds the server gives to pick a card (world.ts CARD_TIME).</summary>
        const float CARD_TIME = 8;

        int StarsEarned()
        {
            var me = world.Me;
            float raw = Catalogue.StarsFor(me.score, me.highestTier, runBonks);
            float stage = world.Stage.Id == StageId.Common ? COMMON_BONUS : world.Stage.Id == StageId.London ? LONDON_BONUS : 1;
            return Mathf.FloorToInt(raw * (world.Mode == Mode.Easy ? 0.5f : 1) * stage);
        }

        /// <summary>Home time: the bell, the results, the stars.</summary>
        void FinishRun()
        {
            if (state == State.Title) return;
            SaveBest();
            // A run can end under the pause menu or the shop (a dropped connection): clear them first.
            hud.ShowPause(false);
            hud.CloseShop();
            hud.HideCards();
            var me = world.Me;
            int stars = RealRun ? StarsEarned() : 0;
            if (RealRun)
            {
                P.stars += stars;
                P.runs++;
                P.Save();
            }
            synth.Play("bell");
            synth.Duck(false);
            hud.ShowResults((int)me.score, runLongest, runGulps, runBonks, stars, runGems, Play, ToTitle);
            hud.ShowPlayers(0);
            NewWorld(P.Mode, P.Stage, true);
            state = State.Title;
        }

        void ToTitle()
        {
            SaveBest();
            hud.HideCards();
            NewWorld(P.Mode, P.Stage, true);
            state = State.Title;
            hud.ShowTitle(true);
            hud.RefreshTitle();
            synth.Duck(false);
        }

        void SetPaused(bool on)
        {
            if (state == State.Title) return;
            net?.SetAway(on && state == State.Play);
            if (on && state == State.Play) { state = State.Paused; hud.ShowPause(true); synth.Duck(true); }
            else if (!on && state == State.Paused) { state = net == null && world.Me.cards != null ? State.Cards : State.Play; hud.ShowPause(false); synth.Duck(state == State.Cards); }
        }

        void SaveBest()
        {
            if (world == null || !RealRun) return;
            var me = world.Me;
            bool changed = false;
            if (me.score > P.bestScore) { P.bestScore = (int)me.score; changed = true; }
            if (runLongest > P.bestLength) { P.bestLength = runLongest; changed = true; }
            if (changed) P.Save();
        }

        /// <summary>A run a child is playing: not the title screen's bot, not the dev autopilot. Only these touch the save.</summary>
        bool RealRun => attract == null && !Autopilot;

        void EarnGem(Vector3 at, int n = 1)
        {
            if (!RealRun || n <= 0) return;
            // The Common pays ×1.25 and London ×1.5: each gem has a one-in-four (one-in-two) chance of a bonus gem (main.ts earnGem).
            float bonus = world.Stage.Id == StageId.Common ? COMMON_BONUS - 1 : world.Stage.Id == StageId.London ? LONDON_BONUS - 1 : 0;
            for (int i = 0, k = n; i < k; i++) if (Random.value < bonus) n++;
            P.gems += n;
            runGems += n;
            P.Save();
            world.Me.canBuyPowers = P.gems >= Upgrades.POWER_GEM_COST;
            net?.SetCanBuy(world.Me.canBuyPowers);
            hud.Pop(at + Vector3.up * 1.8f, "+" + n + " gem", new Color(0.45f, 0.8f, 1f), 36, 1.2f);
            synth.Play("zip", 0.6f);
        }

        void Choose(int i)
        {
            var offer = net != null ? net.Cards : world.Me.cards;
            if (state != State.Cards || offer == null) return;
            i = Mathf.Clamp(i, 0, offer.Length - 1);
            var card = offer[i];
            // A power card costs a gem (it is only offered when you have one). Pay before taking it.
            if (Upgrades.IsPower(card))
            {
                if (P.gems < Upgrades.POWER_GEM_COST) { synth.Play("nope"); return; }
                P.gems -= Upgrades.POWER_GEM_COST;
                P.Save();
                world.Me.canBuyPowers = P.gems >= Upgrades.POWER_GEM_COST;
                net?.SetCanBuy(world.Me.canBuyPowers);
            }
            if (net != null) net.Pick(i);
            else world.Choose(i);
            hud.HideCards();
            synth.Play("pick");
            synth.Duck(false);
            state = State.Play;
            var head = snakeViews[MeIx].HeadPos;
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

            if ((Controls.Pressed(Key.Escape) || Controls.PadPressed(p => p.startButton)) && !hud.ShopOpen)
            {
                if (state == State.Play) SetPaused(true);
                else if (state == State.Paused) SetPaused(false);
            }
            if (state == State.Title && !hud.ResultsOpen && !hud.ShopOpen && !hud.NameOpen && hud.NameClosedFrame != Time.frameCount && (Controls.Pressed(Key.Enter) || Controls.PadPressed(p => p.buttonSouth))) Play();
            if (state == State.Cards)
            {
                if (Controls.Pressed(Key.Digit1) || Controls.Pressed(Key.Numpad1)) Choose(0);
                if (Controls.Pressed(Key.Digit2) || Controls.Pressed(Key.Numpad2)) Choose(1);
                if (Controls.Pressed(Key.Digit3) || Controls.Pressed(Key.Numpad3)) Choose(2);
            }

            if (joining != null) PollJoin(realDt);
            var me = world.Me;
            var meView = snakeViews[MeIx];
            var cam = rig.Cam;
            var headScreen = (Vector2)cam.WorldToScreenPoint(meView.HeadPos);
            controls.DashButtonHeld = hud.Pad.DashHeld;
            controls.Update(headScreen, realDt, hud.PointerOverUi() || state != State.Play);

            if (net != null) NetFrame(realDt, me);
            else if (state == State.Play || state == State.Title)
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
                    wild.OnStep();
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

            float alpha = net == null && (state == State.Play || state == State.Title) ? Mathf.Clamp01(acc / World.STEP) : 1;
            float time = Time.time;
            var steerWorld = new Vector2(controls.Steer.x, controls.Steer.y);
            for (int i = 0; i < snakeViews.Count; i++)
                snakeViews[i].Sync(alpha, dt, time, world.Tick, i == MeIx && attract == null ? steerWorld : Vector2.zero);
            views.Sync(alpha, dt, time, me);
            wild.Sync(alpha, dt, time);

            // Camera.
            if (LookAtFn != null) LookAt = LookAtFn();
            if (LookAt.HasValue) rig.Follow(W.P(LookAt.Value.x, LookAt.Value.y), Vector3.zero, (LookDistance - 21) / 0.45f, false, realDt);
            else if (state == State.Title)
            {
                var id = world.Stage.Id;
                rig.TitleOrbit(realDt, id == StageId.Common ? W.P(4, 4) : id == StageId.London ? W.P(-18, -6) : new Vector3(-6, 0, 4), id == StageId.Common ? 80 : id == StageId.London ? 92 : 62);
            }
            else if (me.alive && me.carried == Carrier.Eye)
            {
                // The London Eye's ride: the camera cranes up off your capsule to a bird's-eye view of the map and back.
                float t = Mathf.Clamp01(world.EyeRide(me) + alpha / World.EYE_RIDE);
                LondonLifeViews.EyeRidePoint(t, out var capsule);
                rig.Crane(capsule, W.P(-8, -6), t, realDt);
            }
            else
            {
                // Dragon Wings: the camera rises with the snake.
                rig.Altitude = Mathf.MoveTowards(rig.Altitude, me.alive && me.HasMagic(MagicId.Wings) ? 1 : 0, realDt * 0.8f);
                var vel = W.Dir(me.heading) * (me.alive ? me.BaseSpeed * me.speedFactor : 0);
                rig.Follow(me.alive ? meView.HeadPos : rig.transform.position + rig.transform.forward * 20, vel, me.Length, me.dashing, realDt);
            }
            atmo.Focus(state == State.Title ? 70 : rig.FocusDistance);
            atmo.Around = rig.transform.position + rig.transform.forward * rig.FocusDistance;

            if (attract == null && me.dashing && !wasDashing) synth.Play("zip", 0.8f);
            wasDashing = me.dashing;
            for (int i = 0; i < world.Snakes.Count; i++)
            {
                var s = world.Snakes[i];
                if (s.alive && s.dashing && Random.value < 0.6f) Fx.I.Trail(snakeViews[i].BodyPoint(s.Length * Random.value * 0.6f) + Random.insideUnitSphere * 0.3f, MeshKit.Hex(s.look.stripe));
            }

            Occlusion(realDt);
            SyncLondon(realDt);
            Pushers();

            hud.ShowStick(controls.StickOn && state == State.Play, controls.StickBase, controls.StickKnob);
            hud.ShowDashing(controls.Dash && state == State.Play);
            hud.SetBubbleWorld(bubbleAt ?? (bubbleFromSami ? wild.SamiHead : views.CooperHead));
            if (state == State.Play && me.alive)
            {
                runLongest = Mathf.Max(runLongest, me.Length);
                if (RealRun && world.Mode == Mode.Normal && me.Tier >= MEGA_TIER && !P.mega) { P.mega = true; P.Save(); }
            }
            if (state != State.Title)
            {
                hud.Sync(world, cam, headOf, realDt);
                hud.ShowBonk(state == State.Play && !me.alive, me.respawnIn);
                synth.SetMusicLevel(me.alive ? me.Tier : 0);
            }
            else synth.SetMusicLevel(2);
        }

        const int MEGA_TIER = 4;
        bool bubbleFromSami;
        /// <summary>Where a London chatter (the tour guide, the Beefeater) is talking from, while it is them.</summary>
        Vector3? bubbleAt;

        void OpenCards()
        {
            state = State.Cards;
            synth.Play("levelUp");
            synth.Duck(true);
            hud.ShowCards(net != null ? net.Cards : world.Me.cards, world.Me, Choose, P.gems, net != null);
        }

        // ------------------------------------------------------------------ events into juice

        static readonly string[] MagicNames =
        {
            "Stag's Blessing!", "Rainbow Rush!", "Owl Eyes!", "Royal Ribbit!", "Fox Trick!", "Pixie Dust!", "Acorn Hoard!", "Wisp Gold!",
            // London's legends: one short word each (main.ts MAGIC_LABEL).
            "WINGS!", "ROAR!", "PHOENIX!", "SPLASH!", "BOO!", "GIANT!", "FAIRY DUST!", "FOLLOW!",
        };

        void HandleEvents()
        {
            bool live = attract == null;
            foreach (var e in world.Events)
            {
                bool mine = e.who == MeIx && live;
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
                            if (e.food == FoodKind.Tea)
                            {
                                // A cuppa: a little warm-up zoom.
                                var head = sv != null ? sv.HeadPos : at;
                                Fx.I.Munch(head, new Color(0.95f, 0.89f, 0.76f), false);
                                hud.Pop(head + Vector3.up * 1.6f, "ZOOM!", new Color(0.7f, 0.9f, 1f), 40);
                                synth.Play("zoom");
                            }
                        }
                        break;
                    case EventType.Gulp:
                        Fx.I.Gulp(at, Models.AnimalColor(e.animal), Animals.SPECS[(int)e.animal].radius * 2.5f);
                        sv?.Gulp(0.5f);
                        if (sv != null) views.SwallowAnimal(e, sv);
                        if (mine)
                        {
                            runGulps++;
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
                            Fx.I.Confetti(snakeViews[MeIx].HeadPos, 110, 9);
                            Fx.I.Ring(snakeViews[MeIx].HeadPos, new Color(1f, 0.85f, 0.3f), 9, 0.9f);
                            hud.ShowTier(e.tier, Hud.NextGulps(world.Stage, e.tier));
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
                        else if (e.by == MeIx && live)
                        {
                            runBonks++;
                            synth.Play("bonkedRival");
                            rig.Shake(0.3f);
                            hud.Pop(at + Vector3.up * 1.5f, "Bonk! +80", new Color(1f, 0.6f, 0.9f), 50, 1.4f);
                            EarnGem(at);
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
                        Fx.I.Embers(at);
                        if (mine) { synth.Play("ouch"); hud.Pop(at + Vector3.up, "Hot!", new Color(1f, 0.55f, 0.3f), 40); }
                        if (e.by == MeIx && live) EarnGem(at);
                        break;
                    case EventType.Power:
                    {
                        var caster = world.Snakes[e.who];
                        var from = snakeViews[e.who].HeadPos;
                        switch (e.power)
                        {
                            case UpgradeId.Laser: Fx.I.Laser(from, W.Dir(e.heading), e.range); if (mine || Near(at)) synth.Play("laser", mine ? 1 : 0.4f); break;
                            case UpgradeId.Stink: Fx.I.Stink(at, e.range); if (mine || Near(at)) synth.Play("stink", mine ? 1 : 0.4f); break;
                            case UpgradeId.Zap: Fx.I.Zap(at, e.range); if (mine || Near(at)) synth.Play("zap", mine ? 1 : 0.4f); break;
                            case UpgradeId.Freeze: Fx.I.Frost(at, e.range * 0.5f); if (mine || Near(at)) synth.Play("freeze", mine ? 1 : 0.4f); break;
                        }
                        if (mine) rig.Shake(0.12f);
                        break;
                    }
                    case EventType.Hit:
                        if (mine)
                        {
                            hud.Pop(at + Vector3.up * 1.2f, e.freeze ? "Brrr!" : "Zapped!", e.freeze ? new Color(0.6f, 0.9f, 1f) : new Color(1f, 0.6f, 0.4f), 42);
                            synth.Play("ouch");
                            rig.Shake(0.3f);
                        }
                        if (e.by == MeIx && live) EarnGem(at);
                        break;
                    case EventType.Howl:
                        if (live && Near(at)) synth.Play("growl", 0.7f);
                        break;
                    case EventType.Chomp:
                        wild.Chomp(at);
                        Fx.I.Stars(at, 8);
                        if (mine)
                        {
                            synth.Play("chomp");
                            rig.Shake(0.55f);
                            atmo.Hit(0.7f);
                            // A lion only licks you (and a bit of tail falls off); a raven pecks.
                            string word = e.predator == PredatorKind.Bear ? "Chomp!" : e.predator == PredatorKind.Lion ? "Oops!" : e.predator == PredatorKind.Raven ? "Peck!" : "Snap!";
                            hud.Pop(at + Vector3.up * 1.3f, word, new Color(1f, 0.5f, 0.45f), 46);
                        }
                        break;
                    // ---- London (main.ts): the zoo's calls and thefts, Tea Time, the lions' yawns, the ravens' caws, the traffic, puddles.
                    case EventType.Cry:
                        if (!live || !NearMe(e.x, e.z)) break;
                        if (e.animal == AnimalKind.Pigeon) Fx.I.Confetti(at + Vector3.up * 0.3f, 18, 4);
                        hud.Pop(at + Vector3.up * 1.4f, e.animal == AnimalKind.Swan ? "HONK!" : e.animal == AnimalKind.Corgi ? "YIP!" : "FLAP!", new Color(1f, 0.95f, 0.6f), 40);
                        synth.Play("voice-" + e.animal, 0.8f);
                        break;
                    case EventType.Steal:
                        Fx.I.Munch(at, Color.white, false);
                        if (!live || !NearMe(e.x, e.z)) break;
                        hud.Pop(at + Vector3.up * 1.3f, e.animal == AnimalKind.Gull ? "STOLEN!" : "GOBBLE!", new Color(1f, 0.5f, 0.45f), 42);
                        synth.Play("voice-" + e.animal, 0.8f);
                        synth.Play("snatch");
                        break;
                    case EventType.TeaTime:
                        Fx.I.Confetti(at, 60, 7);
                        Fx.I.Ring(at, new Color(1f, 0.85f, 0.3f), 5, 0.6f);
                        if (!mine) break;
                        synth.Play("teaTime");
                        rig.Punch(0.5f);
                        hud.Banner("TEA TIME!", Icons.Food(FoodKind.Sponge));
                        break;
                    case EventType.Roar:
                        // A Trafalgar lion wakes: a big stretch and a yawn (its warning).
                        Fx.I.Dust(at + Vector3.up * 1.4f, 0.8f);
                        if (!live || !NearMe(e.x, e.z)) break;
                        hud.Pop(at + Vector3.up * 3.2f, "YAWN!", new Color(1f, 0.85f, 0.45f), 44);
                        synth.Play("yawn");
                        break;
                    case EventType.Caw:
                        if (!live || !NearMe(e.x, e.z)) break;
                        hud.Pop(at + Vector3.up * 4f, "CAW!", new Color(1f, 0.5f, 0.45f), 44);
                        synth.Play("caw");
                        break;
                    case EventType.Ding:
                        if (!live || !NearMe(e.x, e.z)) break;
                        hud.Pop(at + Vector3.up * 4.2f, e.honk ? "HONK!" : "DING DING!", new Color(1f, 0.95f, 0.6f), 40);
                        synth.Play(e.honk ? (e.vehicle == VehicleKind.Cab ? "honkCab" : "honkBus") : "dingDing");
                        break;
                    case EventType.VBonk:
                        Fx.I.Dust(at, 1.2f);
                        Fx.I.Stars(at, 10);
                        if (!mine) break;
                        synth.Play("ouch");
                        synth.Play(e.vehicle == VehicleKind.Cab ? "honkCab" : "honkBus");
                        rig.Shake(0.45f);
                        atmo.Hit(0.6f);
                        hud.Pop(at + Vector3.up * 1.4f, e.vehicle == VehicleKind.Bus ? "Mind the bus!" : "Mind the cab!", new Color(1f, 0.5f, 0.45f), 46, 1.3f);
                        break;
                    case EventType.Splash:
                        Fx.I.Munch(at, new Color(0.62f, 0.83f, 0.95f), false);
                        if (!mine) break;
                        hud.Pop(at + Vector3.up * 1.2f, "WHEE!", new Color(0.6f, 0.85f, 1f), 40);
                        synth.Play("splash");
                        break;
                    // ---- London's people
                    case EventType.BumpGuard:
                        if (mine) { synth.Play("bump", 0.7f); hud.Pop(at + Vector3.up * 1.2f, "Ahem!", new Color(1f, 0.9f, 0.6f), 38); } // he does not move
                        break;
                    case EventType.Whistle:
                        if (!live || !NearMe(e.x, e.z, 18)) break;
                        hud.Pop(at + Vector3.up * 2.6f, "PHWEEE!", e.who == MeIx ? new Color(1f, 0.5f, 0.45f) : new Color(1f, 0.95f, 0.6f), 42);
                        synth.Play("whistle");
                        break;
                    case EventType.GuardSmile:
                        wild.LondonLife?.Smile(world.Snakes[e.who]);
                        Fx.I.Stars(at + Vector3.up * 2.5f, 14);
                        break;
                    case EventType.Guard:
                        if (!mine) break;
                        EarnGem(at);
                        hud.Pop(snakeViews[MeIx].HeadPos + Vector3.up * 1.4f, "Smile!", new Color(0.6f, 0.85f, 1f), 46, 1.3f);
                        synth.Play("golden");
                        synth.Play("chaChing");
                        break;
                    case EventType.Photo:
                        Fx.I.Stars(at + Vector3.up * 1.6f, 6);
                        if (!mine) break;
                        hud.Flash();
                        hud.Pop(at + Vector3.up * 2f, "CLICK!", Color.white, 40);
                        synth.Play("click");
                        break;
                    case EventType.Boo:
                        wild.LondonLife?.Boo();
                        Fx.I.Burst(at + Vector3.up, new[] { new Color(0.79f, 0.81f, 0.84f), Color.white }, 10, 0.8f);
                        if (!live || !NearMe(e.x, e.z)) break;
                        hud.Pop(at + Vector3.up * 3.4f, "BOO!", Color.white, 46);
                        synth.Play("boo");
                        break;
                    // ---- London's legends
                    case EventType.Ring:
                        Fx.I.Ring(at, new Color(1f, 0.82f, 0.25f), e.range * 2, 0.7f);
                        Fx.I.Burst(at, new[] { new Color(1f, 0.82f, 0.25f), new Color(1f, 0.95f, 0.6f) }, 30, 2.2f);
                        if (live && NearMe(e.x, e.z, 20)) { hud.Pop(at + Vector3.up * 2, "ROAR!", new Color(1f, 0.82f, 0.25f), 52); synth.Play("growl"); }
                        break;
                    case EventType.Roared:
                        Fx.I.Stars(at, 8);
                        if (mine) hud.Pop(at + Vector3.up * 1.4f, "ROAR!", new Color(1f, 0.5f, 0.45f), 44);
                        break;
                    case EventType.Rise:
                        Fx.I.Burst(at, new[] { new Color(1f, 0.3f, 0f), new Color(1f, 0.72f, 0.02f), new Color(1f, 0.88f, 0.4f) }, 36, 1.8f);
                        if (!mine) break;
                        hud.Banner("RISE!", Icons.Creature(CreatureKind.Phoenix));
                        synth.Play("golden");
                        synth.Play("tierUp");
                        break;
                    case EventType.Land:
                        Fx.I.Dust(at, 1.2f);
                        if (mine) { hud.Pop(at + Vector3.up * 1.2f, "LAND!", new Color(0.8f, 0.85f, 0.95f), 40); rig.Shake(0.15f); }
                        break;
                    case EventType.Pearly:
                        Fx.I.Burst(at, new[] { new Color(1f, 0.98f, 0.94f), Color.white }, 24, 1.2f);
                        Fx.I.Burst(W.P(e.tx, e.tz), new[] { new Color(1f, 0.98f, 0.94f), Color.white }, 18, 1.2f);
                        break;
                    case EventType.ButtonEat:
                        Fx.I.Stars(at, 3);
                        if (mine) synth.Play("pellet", 0.7f);
                        break;
                    case EventType.Jewel:
                    {
                        var jc = MeshKit.Hex(ModelsLondonZoo.JEWEL_COLOURS[e.k % 5]);
                        Fx.I.Burst(at + Vector3.up, new[] { jc, Color.white, new Color(1f, 0.85f, 0.29f) }, 26, 1.4f);
                        if (!mine) break;
                        hud.Pop(at + Vector3.up * 2, e.n + "/5", jc, 50, 1.3f);
                        synth.Play("golden");
                        synth.Play("chaChing");
                        break;
                    }
                    case EventType.Royal:
                        Fx.I.Confetti(at, 120, 9);
                        Fx.I.Ring(at, new Color(1f, 0.82f, 0.25f), 8, 0.9f);
                        if (!mine) break;
                        EarnGem(at, World.ROYAL_GEMS);
                        slowmoFor = 0.6f;
                        atmo.TierUp();
                        hud.Banner("ROYAL!", null);
                        synth.Play("tierUp");
                        synth.Play("bell");
                        break;
                    // ---- London's set pieces
                    case EventType.Bong:
                        synth.Play("bong", 0.9f);
                        Fx.I.Burst(at + Vector3.up * 2, new[] { new Color(1f, 0.85f, 0.3f), Color.white }, 18, 1.4f);
                        Fx.I.Ring(at, new Color(1f, 0.85f, 0.3f), 18, 1.2f);
                        if (live && NearMe(e.x, e.z, 40)) hud.Pop(at + Vector3.up * 12, e.n > 1 ? "BONG " + (e.k + 1) + "!" : "BONG!", new Color(1f, 0.85f, 0.3f), 52, 1.4f);
                        break;
                    case EventType.Launch:
                        Fx.I.Confetti(at, 40, 7);
                        if (!mine) break;
                        hud.Banner("WHEE!", null);
                        synth.Play("whee");
                        rig.Punch(0.6f);
                        break;
                    case EventType.Ride:
                        if (e.carrier == Carrier.Eye) Fx.I.Confetti(at, 30, 5); else Fx.I.Munch(at, new Color(0.62f, 0.83f, 0.95f), false);
                        if (!mine) break;
                        if (e.on && e.carrier == Carrier.Eye) { hud.Banner("LONDON EYE!", null); synth.Play("rideUp"); }
                        else if (e.on) { hud.Pop(at + Vector3.up * 1.4f, "ALL ABOARD!", new Color(0.6f, 0.85f, 1f), 44); synth.Play("toot"); }
                        else { hud.Pop(at + Vector3.up * 1.4f, "+" + (e.carrier == Carrier.Eye ? 100 : 60), new Color(1f, 0.85f, 0.3f), 44); synth.Play("levelUp"); }
                        break;
                    case EventType.Warp:
                        Fx.I.Dust(at, 1.4f);
                        if (!mine) break;
                        hud.Tube(London.TUBE_NAMES, e.from, e.to);
                        hud.Pop(at + Vector3.up * 1.6f, "Mind the gap!", Color.white, 44, 1.3f);
                        synth.Play("mindTheGap");
                        rig.Snap(snakeViews[MeIx].HeadPos, world.Me.Length);
                        break;
                    case EventType.Wobble:
                        if (!mine) break;
                        hud.Pop(at + Vector3.up * 1.2f, "WOBBLE!", new Color(0.8f, 0.85f, 1f), 40);
                        synth.Play("wobble");
                        break;
                    case EventType.Arrows:
                        Fx.I.Burst(at, new[] { new Color(0.91f, 0.19f, 0.23f), Color.white, new Color(0.18f, 0.37f, 0.82f) }, 24, 1.4f);
                        if (!mine) break;
                        hud.Banner("RED ARROWS!", null);
                        synth.Play("tierUp");
                        break;
                    case EventType.Treat:
                        Fx.I.Confetti(at, 30, 6);
                        if (!mine) break;
                        EarnGem(at);
                        hud.Pop(at + Vector3.up * 1.6f, "+1", new Color(0.35f, 0.7f, 1f), 44);
                        synth.Play("golden");
                        break;
                    case EventType.Lob:
                        wild.Throw(at);
                        break;
                    case EventType.Pelt:
                        Fx.I.Dust(at, 0.6f);
                        if (mine) { synth.Play("bump"); rig.Shake(0.15f); hud.Pop(at + Vector3.up, e.projectile == ProjectileKind.Chip ? "Soggy chip!" : "Oops!", new Color(1f, 0.75f, 0.5f), 36); }
                        break;
                    case EventType.Kiss:
                        Fx.I.Hearts(at);
                        if (mine)
                        {
                            synth.Play("kiss");
                            hud.Pop(at + Vector3.up, "Aww!", new Color(1f, 0.6f, 0.8f), 40);
                            if (e.gem) EarnGem(at);
                        }
                        break;
                    case EventType.Magic:
                        Fx.I.Magic(at, MeshKit.Hex(Creatures.SPECS[(int)e.creature].glow));
                        if (mine)
                        {
                            synth.Play("magic");
                            slowmoFor = 0.5f;
                            atmo.TierUp();
                            rig.Punch(0.7f);
                            hud.Banner(e.creature == CreatureKind.Unicorn && world.Stage.Id == StageId.London ? "RAINBOW!" : MagicNames[(int)e.creature], Icons.Creature(e.creature));
                            if (e.creature == CreatureKind.Dragon) synth.Play("whoosh");
                            EarnGem(at, e.gems);
                        }
                        break;
                    case EventType.Say:
                        // London is big and busy with talkers: only the ones near enough to hear.
                        if (live && (world.Stage.Chatters == null || NearMe(e.x, e.z, 24)))
                        {
                            bubbleFromSami = e.sami;
                            bubbleAt = e.speaker != null ? W.P(e.x, e.z, 3.6f) : (Vector3?)null;
                            if (e.sami) wild.SamiTalks();
                            hud.Say(e.text, bubbleAt ?? (e.sami ? wild.SamiHead : views.CooperHead));
                        }
                        break;
                    case EventType.BumpWall:
                        if (mine) { synth.Play("bump", 0.7f); rig.Shake(0.08f); }
                        break;
                    case EventType.BumpCooper:
                        if (mine) { synth.Play("boing"); rig.Shake(0.2f); }
                        break;
                    case EventType.BumpKid:
                        if (mine) { synth.Play("boing", 0.6f); hud.Pop(at + Vector3.up, "Oops!", Color.white, 34); }
                        break;
                }
            }
            world.Events.Clear();
        }

        bool Near(Vector3 p) => Vector3.Distance(p, rig.transform.position) < 45;

        /// <summary>Close enough to the player's snake that a room-wide London event is worth a popup and a sound (main.ts nearMe).</summary>
        bool NearMe(float x, float z, float reach = 14)
        {
            var s = world.Me;
            return (s.x - x) * (s.x - x) + (s.z - z) * (s.z - z) < reach * reach;
        }

        // ------------------------------------------------------------------ helpers

        /// <summary>Buildings and trees between the camera and the player's snake dissolve, so a child never loses it.</summary>
        void Occlusion(float dt)
        {
            var me = world.Me;
            bool watching = state != State.Title && me.alive;
            foreach (var o in Occluders)
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

        /// <summary>The sixteen things nearest the camera's focus that part the grass: snakes, animals, people.</summary>
        void Pushers()
        {
            pushPool.Clear();
            var f = rig.transform.position + rig.transform.forward * rig.FocusDistance;
            void Add(float x, float z, float r)
            {
                float d = (x - f.x) * (x - f.x) + (-z - f.z) * (-z - f.z);
                if (d < 900) pushPool.Add((d, new Vector4(x, 0, -z, r)));
            }
            foreach (var s in world.Snakes)
            {
                if (!s.alive) continue;
                Add(s.x, s.z, s.Radius * 1.4f);
                for (int i = 0; i < s.bodyCount; i += 3) Add(s.body[i * 2], s.body[i * 2 + 1], s.Radius * 1.2f);
            }
            foreach (var a in world.Animals) Add(a.x, a.z, a.Spec.radius * 1.2f);
            foreach (var k in world.Kids) Add(k.x, k.z, 0.4f);
            foreach (var p in world.Predators) Add(p.x, p.z, p.Spec.radius * 1.2f);
            foreach (var c in world.Creatures) if (c.respawnIn <= 0) Add(c.x, c.z, c.Spec.radius);
            Add(world.Cooper.x, world.Cooper.z, 0.5f);
            pushPool.Sort((a, b) => a.d.CompareTo(b.d));
            int n = Mathf.Min(16, pushPool.Count);
            for (int i = 0; i < n; i++) pushers[i] = pushPool[i].p;
            Atmosphere.SetPushers(pushers, n);
        }

        void OnApplicationPause(bool paused)
        {
            if (paused) { SaveBest(); if (state == State.Play) SetPaused(true); }
        }

        void OnApplicationQuit()
        {
            SaveBest();
            net?.Leave();
            joining?.Leave();
        }
    }
}
