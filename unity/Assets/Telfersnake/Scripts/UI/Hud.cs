using System;
using System.Collections.Generic;
using Telfer.Sim;
using Telfer.View;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Telfer.UI
{
    /// <summary>
    /// Everything drawn over the game. Visual first, with short word labels and no sentences:
    /// the players are five to eleven.
    /// </summary>
    public sealed partial class Hud : MonoBehaviour
    {
        static readonly Color Ink = new Color(0.13f, 0.15f, 0.22f);
        static readonly Color Cream = new Color(1f, 0.99f, 0.96f, 0.94f);
        static readonly Color Green = new Color(0.3f, 0.75f, 0.29f);
        static readonly Color Yellow = new Color(1f, 0.83f, 0.23f);
        static readonly Color[] RarityCol = { new Color(0.55f, 0.6f, 0.68f), new Color(0.2f, 0.55f, 0.95f), new Color(0.6f, 0.35f, 0.95f), new Color(1f, 0.62f, 0.1f) };
        static readonly string[] RarityName = { "COMMON", "RARE", "EPIC", "LEGEND" };

        Canvas canvas;
        RectTransform rootRt, title, game, cardsLayer, bonkLayer, pauseLayer, bannerRt, popLayer, nameLayer, stickRt, bubbleRt;
        Text score, tierName, levelText, bonkCount, bannerTitle, bubbleText, bestText;
        Image tierFill, xpFill, minimapImg, stickBase, stickKnob;
        RawImage[] gulpIcons = new RawImage[3];
        RawImage[] bannerIcons = new RawImage[3];
        readonly List<(RectTransform rt, Image img)> mapDots = new List<(RectTransform, Image)>();
        RectTransform mapPlayer;
        readonly List<(Text name, Text score, Image dot)> board = new List<(Text, Text, Image)>();
        readonly List<(RectTransform rt, Text t)> nameTags = new List<(RectTransform, Text)>();
        sealed class PopUp { public RectTransform rt; public Text t; public Vector3 world; public float age, life; public float rise; }
        readonly List<PopUp> pops = new List<PopUp>();
        readonly Stack<PopUp> popPool = new Stack<PopUp>();
        float bannerT = -1, bubbleT, displayScore;
        Vector3 bubbleWorld;
        Image[] modeButtons = new Image[3];

        public Action<Mode> OnPlay;
        public Action OnResume, OnQuit;
        public Action<bool> OnSound;
        public Mode Mode = Mode.Normal;
        public Func<bool> PointerOverUi = () => EventSystem.current != null && EventSystem.current.IsPointerOverGameObject();
        public Controls Pad;

        public sealed class Controls { public bool DashHeld; }

        public bool CardsOpen => cardsLayer.gameObject.activeSelf;
        public bool PauseOpen => pauseLayer.gameObject.activeSelf;

        public void Build()
        {
            canvas = UiKit.Canvas("HUD", 10);
            canvas.transform.SetParent(transform, false);
            rootRt = (RectTransform)canvas.transform;
            fit = canvas.GetComponent<Fit>();
            Pad = new Controls();

            game = UiKit.Fill(rootRt, "Game");
            nameLayer = UiKit.Fill(game, "Names");
            popLayer = UiKit.Fill(game, "Pops");
            BuildTopLeft();
            BuildGems();
            BuildJewels();
            BuildXpBar();
            BuildMinimap();
            BuildDash();
            BuildStick();
            BuildBubble();
            BuildBanner();
            BuildPauseButton();
            BuildPlayers();
            bonkLayer = BuildBonk();
            cardsLayer = UiKit.Fill(rootRt, "Cards");
            cardsLayer.gameObject.SetActive(false);
            pauseLayer = BuildPause();
            title = BuildTitle();
            namePanel = BuildName();
            toastRt = BuildToast();
            BuildLondonOverlays();
            ShowTitle(true);
            fit.Changed += Relayout;
            Relayout();
        }

        // ------------------------------------------------------------------ title

        RectTransform BuildTitle()
        {
            var t = UiKit.Fill(rootRt, "Title");
            titleGroup = t.gameObject.AddComponent<CanvasGroup>();
            var dim = UiKit.Panel(t, "dim", new Color(0.05f, 0.1f, 0.2f, 0.12f), 0);
            // The logo, and the column of choices under it: each is moved and scaled as one to fit the screen.
            var head = titleHead = UiKit.Rect(t, "head", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            var mid = titleMid = UiKit.Rect(t, "mid", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);

            var logo = UiKit.Rect(head, "logo", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, 215), new Vector2(900, 170));
            logo.gameObject.AddComponent<Bob>().Amount = 8;
            var l1 = UiKit.Label(logo, "telfer", "Telfer", 150, Color.white, TextAnchor.MiddleRight, 5, new Color(0.1f, 0.2f, 0.35f, 0.9f));
            ((RectTransform)l1.transform).offsetMax = new Vector2(-445, 0);
            ((RectTransform)l1.transform).anchorMax = new Vector2(1, 1);
            var l2 = UiKit.Label(logo, "snake", "snake", 150, new Color(0.49f, 0.86f, 0.36f), TextAnchor.MiddleLeft, 5, new Color(0.08f, 0.3f, 0.1f, 0.95f));
            ((RectTransform)l2.transform).offsetMin = new Vector2(455, 0);
            var hd = UiKit.Rect(head, "hd", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(395, 300), new Vector2(110, 54));
            hd.localRotation = Quaternion.Euler(0, 0, -8);
            UiKit.Panel(hd, "bg", Yellow, 18);
            UiKit.Label(hd, "t", "HD", 40, Ink);
            hd.gameObject.AddComponent<Bob>().Amount = 5;

            // Where to play: the school, the Common (300 stars) or London (600 stars, once the Common is open).
            var stages = UiKit.Rect(mid, "stages", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, 70), new Vector2(690, 130));
            for (int i = 0; i < 3; i++)
            {
                var id = (StageId)i;
                var rt = UiKit.Rect(stages, id.ToString(), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2((i - 1) * 232, 0), new Vector2(222, 120));
                UiKit.Shadow(rt, 14, 0.25f);
                var b = UiKit.Button(rt, "btn", Cream, 30, () => OnStage?.Invoke(id));
                stageTiles[i] = b.GetComponent<Image>();
                var ic = UiKit.Rect(b.transform, "icon", new Vector2(0, 0.5f), new Vector2(0, 0.5f), new Vector2(0, 0.5f), new Vector2(4, 4), new Vector2(96, 96));
                stageIcons[i] = ic.gameObject.AddComponent<RawImage>();
                stageIcons[i].raycastTarget = false;
                var lbl = UiKit.Label(b.transform, "t", i == 0 ? "School" : i == 1 ? "Common" : "London", 32, Ink, TextAnchor.MiddleLeft);
                ((RectTransform)lbl.transform).offsetMin = new Vector2(100, 0);
                var lockRt = UiKit.Rect(b.transform, "lock", new Vector2(1, 1), new Vector2(1, 1), new Vector2(0.5f, 0.5f), new Vector2(-30, -6), new Vector2(110, 44));
                lockRt.localRotation = Quaternion.Euler(0, 0, -6);
                UiKit.Panel(lockRt, "bg", Ink, 22);
                var ls = UiKit.Image(lockRt, "star", UiKit.Star, Yellow);
                var lsr = (RectTransform)ls.transform; lsr.anchorMin = lsr.anchorMax = new Vector2(0, 0.5f); lsr.sizeDelta = new Vector2(30, 30); lsr.anchoredPosition = new Vector2(24, 0);
                var lt = UiKit.Label(lockRt, "n", (i == 2 ? Meta.Profile.LONDON_COST : Meta.Profile.COMMON_COST).ToString(), 26, Color.white);
                ((RectTransform)lt.transform).offsetMin = new Vector2(34, 0);
                stageLocks[i] = lockRt.gameObject;
                stagePrices[i] = (ls.gameObject, lt.gameObject);
                // London needs the Common first: until then its lock shows the Common's stag instead of a price.
                var needs = UiKit.Rect(lockRt, "needs", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(8, 0), new Vector2(46, 46));
                stageNeeds[i] = needs.gameObject.AddComponent<RawImage>();
                stageNeeds[i].raycastTarget = false;
                needs.gameObject.SetActive(false);
            }

            // How hard: Easy, Normal, and God once it is earned.
            var modes = UiKit.Rect(mid, "modes", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, -38), new Vector2(620, 70));
            for (int i = 0; i < 3; i++)
            {
                var m = (Mode)i;
                var rt = UiKit.Rect(modes, "mode", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2((i - 1) * 200, 0), new Vector2(180, 64));
                UiKit.Shadow(rt, 12, 0.22f);
                var b = UiKit.Button(rt, "btn", Cream, 32, () => { Mode = m; RefreshModes(); OnMode?.Invoke(m); Audio.Synth.I?.Play("pick"); });
                modeButtons[i] = b.GetComponent<Image>();
                UiKit.Label(b.transform, "t", m == Mode.God ? "God" : m.ToString(), 32, Ink);
            }

            // The big yellow play button.
            var play = UiKit.Rect(mid, "play", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, -175), new Vector2(170, 170));
            UiKit.Shadow(play, 30, 0.35f, new Vector2(0, -14), true);
            var pb = UiKit.Button(play, "btn", Yellow, 85, () => OnPlay?.Invoke(Mode));
            pb.GetComponent<Springy>().Idle = 0.035f;
            var ring = UiKit.Image(pb.transform, "ring", UiKit.Ring, new Color(1, 1, 1, 0.55f));
            ((RectTransform)ring.transform).offsetMin = new Vector2(-6, -6); ((RectTransform)ring.transform).offsetMax = new Vector2(6, 6);
            var tri = UiKit.Image(pb.transform, "tri", UiKit.Play, Ink);
            ((RectTransform)tri.transform).offsetMin = new Vector2(50, 45); ((RectTransform)tri.transform).offsetMax = new Vector2(-40, -45);
            // While the playground is being found: an arc chases round the button.
            spinner = UiKit.Image(play, "spin", UiKit.Ring, Color.white);
            spinner.type = Image.Type.Filled; spinner.fillMethod = Image.FillMethod.Radial360; spinner.fillAmount = 0.3f;
            ((RectTransform)spinner.transform).offsetMin = new Vector2(-22, -22); ((RectTransform)spinner.transform).offsetMax = new Vector2(22, 22);
            spinner.gameObject.SetActive(false);
            var playLbl = UiKit.Rect(mid, "playLbl", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, -290), new Vector2(200, 50));
            UiKit.Label(playLbl, "t", "Play", 38, Color.white, TextAnchor.MiddleCenter, 2.5f);

            // Best score.
            var best = UiKit.Rect(mid, "best", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, -360), new Vector2(240, 52));
            UiKit.Panel(best, "bg", new Color(0, 0, 0, 0.32f), 26);
            var trophy = UiKit.Rect(best, "trophy", new Vector2(0, 0.5f), new Vector2(0, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(32, 0), new Vector2(46, 46));
            trophy.gameObject.AddComponent<RawImage>().texture = Icons.Trophy;
            bestText = UiKit.Label(best, "t", "", 30, Color.white);
            ((RectTransform)bestText.transform).offsetMin = new Vector2(40, 0);

            // The wallet, top left: stars and blue gems.
            var wallet = UiKit.Rect(t, "wallet", new Vector2(0, 1), new Vector2(0, 1), new Vector2(0, 1), new Vector2(24, -24), new Vector2(330, 70));
            UiKit.Shadow(wallet, 14, 0.22f);
            UiKit.Panel(wallet, "bg", Cream, 35);
            var ws = UiKit.Image(wallet, "star", UiKit.Star, Yellow);
            var wsr = (RectTransform)ws.transform; wsr.anchorMin = wsr.anchorMax = new Vector2(0, 0.5f); wsr.sizeDelta = new Vector2(48, 48); wsr.anchoredPosition = new Vector2(38, 0);
            walletStars = UiKit.Label(wallet, "stars", "0", 36, Ink, TextAnchor.MiddleLeft);
            ((RectTransform)walletStars.transform).offsetMin = new Vector2(70, 0);
            ((RectTransform)walletStars.transform).offsetMax = new Vector2(-165, 0);
            var wg = UiKit.Image(wallet, "gem", UiKit.Gem, Gem);
            var wgr = (RectTransform)wg.transform; wgr.anchorMin = wgr.anchorMax = new Vector2(0, 0.5f); wgr.sizeDelta = new Vector2(44, 44); wgr.anchoredPosition = new Vector2(196, 0);
            walletGems = UiKit.Label(wallet, "gems", "0", 36, Ink, TextAnchor.MiddleLeft);
            ((RectTransform)walletGems.transform).offsetMin = new Vector2(224, 0);

            // The Tuck Shop, bottom left: a picture of you in your current look.
            var shopRt = UiKit.Rect(t, "shop", new Vector2(0, 0), new Vector2(0, 0), new Vector2(0.5f, 0.5f), new Vector2(110, 120), new Vector2(150, 150));
            UiKit.Shadow(shopRt, 20, 0.3f, null, true);
            var sb = UiKit.Button(shopRt, "btn", new Color(1f, 0.6f, 0.75f), 75, () => { Audio.Synth.I?.Play("pick"); OpenShop(); });
            sb.GetComponent<Springy>().Idle = 0.02f;
            var si = UiKit.Rect(sb.transform, "you", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, 6), new Vector2(130, 130));
            shopIcon = si.gameObject.AddComponent<RawImage>();
            shopIcon.raycastTarget = false;
            var sl = UiKit.Rect(shopRt, "lbl", new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0.5f, 1), new Vector2(0, -2), new Vector2(200, 40));
            UiKit.Label(sl, "t", "Tuck Shop", 28, Color.white, TextAnchor.MiddleCenter, 2);
            BuildAlbumButton(t);

            // Your name, top right: tap to type one or shuffle.
            var chip = nameChip = UiKit.Rect(t, "name", new Vector2(1, 1), new Vector2(1, 1), new Vector2(1, 1), new Vector2(-24, -24), new Vector2(330, 70));
            UiKit.Shadow(chip, 14, 0.22f);
            var nb = UiKit.Button(chip, "btn", Cream, 35, () => { Audio.Synth.I?.Play("pick"); OpenName(); });
            var me = UiKit.Image(nb.transform, "me", UiKit.Me, new Color(0.35f, 0.65f, 1f));
            var mer = (RectTransform)me.transform; mer.anchorMin = mer.anchorMax = new Vector2(0, 0.5f); mer.sizeDelta = new Vector2(46, 46); mer.anchoredPosition = new Vector2(38, 0);
            chipName = UiKit.Label(nb.transform, "t", "", 30, Ink, TextAnchor.MiddleLeft);
            ((RectTransform)chipName.transform).offsetMin = new Vector2(70, 0); ((RectTransform)chipName.transform).offsetMax = new Vector2(-14, 0);

            // Classic or HD, bottom right: across from the Tuck Shop.
            if (VersionSwitch.Available) VersionSwitch.Build(t);

            var hint = UiKit.Rect(t, "hint", new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 26), new Vector2(900, 40));
            UiKit.Label(hint, "t", "Telferscot Primary  ·  Unity HD", 24, new Color(1, 1, 1, 0.75f), TextAnchor.MiddleCenter, 1.5f);
            return t;
        }

        readonly Image[] stageTiles = new Image[3];
        readonly RawImage[] stageIcons = new RawImage[3];
        readonly GameObject[] stageLocks = new GameObject[3];
        readonly (GameObject star, GameObject price)[] stagePrices = new (GameObject, GameObject)[3];
        readonly RawImage[] stageNeeds = new RawImage[3];
        Text walletStars, walletGems;
        RawImage shopIcon;
        readonly Shop shop = new Shop();
        public Action<StageId> OnStage;
        public Action<Mode> OnMode;
        public Action OnShopChanged;
        public bool ShopOpen => shop.IsOpen;
        public void CloseShop() { if (shop.IsOpen) shop.Close(); }
        CanvasGroup titleGroup;
        Image spinner;
        RectTransform nameChip;
        Text chipName;

        /// <summary>Looking for the playground: the title stays up but takes no taps, and the play button spins.</summary>
        public void Connecting(bool on)
        {
            titleGroup.interactable = !on;
            spinner.gameObject.SetActive(on);
        }
        public bool IsConnecting => spinner.gameObject.activeSelf;
        static readonly Color Gem = new Color(0.35f, 0.7f, 1f);

        void RefreshModes()
        {
            var p = Meta.Profile.I;
            int shown = p.GodUnlocked ? 3 : 2;
            for (int i = 0; i < 3; i++)
            {
                bool on = (Mode)i == Mode;
                var rt = (RectTransform)modeButtons[i].transform.parent;
                rt.gameObject.SetActive(i < shown);
                // Centre the row on the buttons there are: two until God mode is earned.
                Place(rt, new Vector2((i - (shown - 1) * 0.5f) * 200, 0), rt.sizeDelta);
                modeButtons[i].color = on ? ((Mode)i == Mode.God ? new Color(0.55f, 0.3f, 0.9f) : Green) : Cream;
                modeButtons[i].GetComponentInChildren<Text>().color = on ? Color.white : Ink;
            }
        }

        /// <summary>Re-read the profile: wallet, unlocks, the chosen place and mode, your look.</summary>
        public void RefreshTitle()
        {
            var p = Meta.Profile.I;
            Mode = p.Mode;
            RefreshModes();
            walletStars.text = p.stars.ToString("N0");
            walletGems.text = p.gems.ToString("N0");
            bestText.text = p.bestScore.ToString("N0");
            stageIcons[0].texture = Icons.Animal(AnimalKind.Chicken);
            stageIcons[1].texture = Icons.Creature(CreatureKind.Stag);
            stageIcons[2].texture = Icons.Of("london-bigben", View.ModelsLondon.IconMesh(), View.Mats.VertexGlossy, -25, 12);
            for (int i = 0; i < 3; i++)
            {
                var id = (StageId)i;
                bool on = p.Stage == id;
                stageTiles[i].color = on ? (i == 0 ? new Color(0.45f, 0.65f, 1f) : i == 1 ? Green : new Color(0.86f, 0.25f, 0.3f)) : Cream;
                stageTiles[i].GetComponentInChildren<Text>().color = on ? Color.white : Ink;
                stageLocks[i].SetActive(i == 1 ? !p.commonUnlocked : i == 2 && !p.londonUnlocked);
                // A locked place that needs another unlocked first shows that place's picture, not a price.
                bool needsCommon = i == 2 && !p.commonUnlocked;
                stagePrices[i].star?.SetActive(!needsCommon);
                stagePrices[i].price?.SetActive(!needsCommon);
                if (stageNeeds[i]) { stageNeeds[i].gameObject.SetActive(needsCommon); if (needsCommon) stageNeeds[i].texture = stageIcons[1].texture; }
            }
            shopIcon.texture = Icons.Skin(p.skin, p.hat);
            chipName.text = p.name;
            albumBtn.gameObject.SetActive(p.londonUnlocked);
        }

        /// <summary>Not enough stars for the Common yet: the tile shakes its head.</summary>
        public void ShakeStage(StageId id) => stageTiles[(int)id].gameObject.AddComponent<Shake>();

        public void ShowTitle(bool on)
        {
            title.gameObject.SetActive(on);
            game.gameObject.SetActive(!on);
            if (on) RefreshTitle();
        }

        // ------------------------------------------------------------------ top left: score and size

        void BuildTopLeft()
        {
            var box = UiKit.Rect(game, "status", new Vector2(0, 1), new Vector2(0, 1), new Vector2(0, 1), new Vector2(22, -34), new Vector2(380, 150));
            UiKit.Shadow(box, 16, 0.22f);
            UiKit.Panel(box, "bg", Cream, 28);
            var star = UiKit.Image(box, "star", UiKit.Star, Yellow);
            var srt = (RectTransform)star.transform; srt.anchorMin = srt.anchorMax = new Vector2(0, 1); srt.sizeDelta = new Vector2(46, 46); srt.anchoredPosition = new Vector2(40, -38);
            score = UiKit.Label(box, "score", "0", 46, Ink, TextAnchor.MiddleLeft);
            var sr = (RectTransform)score.transform; sr.anchorMin = new Vector2(0, 1); sr.anchorMax = new Vector2(1, 1); sr.pivot = new Vector2(0, 1); sr.sizeDelta = new Vector2(0, 60); sr.anchoredPosition = new Vector2(72, -8); sr.offsetMax = new Vector2(-10, -8);
            tierName = UiKit.Label(box, "tier", "Wiggly Worm", 26, new Color(0.25f, 0.45f, 0.2f), TextAnchor.MiddleLeft);
            var tr = (RectTransform)tierName.transform; tr.anchorMin = new Vector2(0, 0); tr.anchorMax = new Vector2(1, 0); tr.pivot = new Vector2(0, 0); tr.sizeDelta = new Vector2(0, 36); tr.anchoredPosition = new Vector2(22, 48);

            var bar = UiKit.Rect(box, "bar", new Vector2(0, 0), new Vector2(0, 0), new Vector2(0, 0), new Vector2(20, 18), new Vector2(222, 26));
            UiKit.Panel(bar, "bg", new Color(0, 0, 0, 0.12f), 13);
            tierFill = UiKit.Panel(bar, "fill", Green, 13);
            tierFill.type = Image.Type.Filled; tierFill.fillMethod = Image.FillMethod.Horizontal;
            tierFill.sprite = UiKit.Rounded(13);

            for (int i = 0; i < 3; i++)
            {
                var ic = UiKit.Rect(box, "gulp", new Vector2(1, 0), new Vector2(1, 0), new Vector2(0.5f, 0.5f), new Vector2(-118 + i * 46, 38), new Vector2(62, 62));
                gulpIcons[i] = ic.gameObject.AddComponent<RawImage>();
                gulpIcons[i].raycastTarget = false;
            }
        }

        void BuildXpBar()
        {
            var bar = UiKit.Rect(game, "xp", new Vector2(0, 1), new Vector2(1, 1), new Vector2(0.5f, 1), new Vector2(0, -8), new Vector2(-40, 18));
            UiKit.Panel(bar, "bg", new Color(0, 0, 0, 0.28f), 9);
            xpFill = UiKit.Panel(bar, "fill", new Color(0.35f, 0.75f, 1f), 9);
            xpFill.type = Image.Type.Filled; xpFill.fillMethod = Image.FillMethod.Horizontal;
            levelText = UiKit.Label(bar, "lv", "1", 18, Color.white, TextAnchor.MiddleCenter, 1.5f);
        }

        // ------------------------------------------------------------------ minimap and leaderboard

        void BuildMinimap()
        {
            var box = UiKit.Rect(game, "map", new Vector2(1, 1), new Vector2(1, 1), new Vector2(1, 1), new Vector2(-22, -34), new Vector2(210, 220));
            UiKit.Shadow(box, 16, 0.25f);
            UiKit.Panel(box, "frame", Cream, 26);
            var inner = UiKit.Rect(box, "inner", Vector2.zero, Vector2.one, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(-16, -16));
            var mask = inner.gameObject.AddComponent<Image>();
            mask.sprite = UiKit.Rounded(20); mask.type = Image.Type.Sliced;
            inner.gameObject.AddComponent<Mask>().showMaskGraphic = false;
            var map = UiKit.Fill(inner, "ground");
            mapRaw = map.gameObject.AddComponent<RawImage>();
            mapRaw.raycastTarget = false;
            minimapImg = mask;
            mapBox = box;

            var lb = UiKit.Rect(game, "board", new Vector2(1, 1), new Vector2(1, 1), new Vector2(1, 1), new Vector2(-22, -268), new Vector2(250, 190));
            boardRt = lb;
            UiKit.Panel(lb, "bg", new Color(0, 0, 0, 0.25f), 20);
            for (int i = 0; i < 5; i++)
            {
                var row = UiKit.Rect(lb, "row", new Vector2(0, 1), new Vector2(1, 1), new Vector2(0.5f, 1), new Vector2(0, -12 - i * 34), new Vector2(-20, 32));
                var dot = UiKit.Image(row, "dot", UiKit.Circle, Color.white);
                var dr = (RectTransform)dot.transform; dr.anchorMin = dr.anchorMax = new Vector2(0, 0.5f); dr.sizeDelta = new Vector2(18, 18); dr.anchoredPosition = new Vector2(14, 0);
                var n = UiKit.Label(row, "n", "", 20, Color.white, TextAnchor.MiddleLeft, 1);
                ((RectTransform)n.transform).offsetMin = new Vector2(30, 0);
                var s = UiKit.Label(row, "s", "", 20, Color.white, TextAnchor.MiddleRight, 1);
                ((RectTransform)s.transform).offsetMax = new Vector2(-8, 0);
                board.Add((n, s, dot));
            }
        }

        RectTransform MapDot(int i, Color c, float size)
        {
            while (mapDots.Count <= i)
            {
                var img = UiKit.Image(minimapImg.transform, "dot", UiKit.Circle, Color.white);
                var rt = (RectTransform)img.transform;
                rt.anchorMin = rt.anchorMax = new Vector2(0, 0);
                mapDots.Add((rt, img));
            }
            var d = mapDots[i];
            d.rt.gameObject.SetActive(true);
            d.img.color = c;
            d.rt.sizeDelta = new Vector2(size, size);
            return d.rt;
        }

        Vector2 MapPos(float x, float z)
        {
            var size = ((RectTransform)minimapImg.transform).rect.size;
            var B = mapBounds;
            return new Vector2((x - B.minX) / (B.maxX - B.minX) * size.x, (1 - (z - B.minZ) / (B.maxZ - B.minZ)) * size.y);
        }

        RawImage mapRaw;
        RectTransform mapBox, boardRt;
        Stage stage;
        Bounds2 mapBounds = School.BOUNDS;

        /// <summary>Point the HUD at a place: its painted plan on the minimap, sized to its fence.</summary>
        public void SetStage(Stage s)
        {
            stage = s;
            mapBounds = s.Bounds;
            var (tex, uv) = Ground.Map(s.Id);
            mapRaw.texture = tex;
            mapRaw.uvRect = uv;
            // Keep the map the shape of the place: the Common is taller than it is wide.
            mapH = Mathf.Clamp(210 * (mapBounds.maxZ - mapBounds.minZ) / (mapBounds.maxX - mapBounds.minX), 160, 290);
            LayoutHud();
            lastTier = lastGulpTier = -1;
        }

        // ------------------------------------------------------------------ touch controls

        void BuildDash()
        {
            var rt = dashRt = UiKit.Rect(game, "dash", new Vector2(1, 0), new Vector2(1, 0), new Vector2(0.5f, 0.5f), new Vector2(-120, 120), new Vector2(150, 150));
            UiKit.Shadow(rt, 20, 0.3f, null, true);
            var img = dashImg = UiKit.Panel(rt, "btn", DashIdle, 75);
            img.raycastTarget = true;
            var bolt = UiKit.Image(img.transform, "bolt", UiKit.Bolt, new Color(1f, 0.72f, 0.1f));
            ((RectTransform)bolt.transform).offsetMin = new Vector2(30, 30); ((RectTransform)bolt.transform).offsetMax = new Vector2(-30, -30);
            var lbl = UiKit.Rect(rt, "lbl", new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0.5f, 1), new Vector2(0, -6), new Vector2(160, 34));
            UiKit.Label(lbl, "t", "Dash", 26, Color.white, TextAnchor.MiddleCenter, 1.5f);
            var trig = img.gameObject.AddComponent<EventTrigger>();
            void On(EventTriggerType type, Action a) { var e = new EventTrigger.Entry { eventID = type }; e.callback.AddListener(_ => a()); trig.triggers.Add(e); }
            On(EventTriggerType.PointerDown, () => { Pad.DashHeld = true; img.transform.localScale = Vector3.one * 0.9f; });
            On(EventTriggerType.PointerUp, () => { Pad.DashHeld = false; img.transform.localScale = Vector3.one; });
            On(EventTriggerType.PointerExit, () => { Pad.DashHeld = false; img.transform.localScale = Vector3.one; });
            // Only shown on touch screens.
            rt.gameObject.SetActive(UnityEngine.InputSystem.Touchscreen.current != null || Application.isMobilePlatform);
        }

        Image dashImg;
        static readonly Color DashIdle = new Color(1, 1, 1, 0.82f), DashOn = new Color(1f, 0.9f, 0.35f, 0.95f);

        /// <summary>Light the button while bursting, whichever way it started (button, tap-then-hold, second finger).</summary>
        public void ShowDashing(bool on)
        {
            if (dashImg) dashImg.color = on ? DashOn : DashIdle;
            if (stickBase) stickBase.color = on ? new Color(1f, 0.85f, 0.3f, 0.75f) : new Color(1, 1, 1, 0.5f);
        }

        void BuildStick()
        {
            stickRt = UiKit.Rect(game, "stick", Vector2.zero, Vector2.zero, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(170, 170));
            stickBase = UiKit.Image(stickRt, "base", UiKit.Ring, new Color(1, 1, 1, 0.5f));
            var knob = UiKit.Rect(stickRt, "knob", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(74, 74));
            stickKnob = knob.gameObject.AddComponent<Image>();
            stickKnob.sprite = UiKit.Circle; stickKnob.color = new Color(1, 1, 1, 0.75f); stickKnob.raycastTarget = false;
            stickRt.gameObject.SetActive(false);
        }

        public void ShowStick(bool on, Vector2 baseScreen, Vector2 knobScreen)
        {
            stickRt.gameObject.SetActive(on);
            if (!on) return;
            float s = rootRt.rect.width / Screen.width;
            stickRt.anchoredPosition = baseScreen * s - game.offsetMin;
            var d = (knobScreen - baseScreen) * s;
            if (d.magnitude > 60) d = d.normalized * 60;
            stickKnob.rectTransform.anchoredPosition = d;
        }

        void BuildPauseButton()
        {
            var rt = pauseBtn = UiKit.Rect(game, "pause", new Vector2(1, 1), new Vector2(1, 1), new Vector2(1, 1), new Vector2(-246, -34), new Vector2(70, 70));
            UiKit.Shadow(rt, 12, 0.25f);
            var b = UiKit.Button(rt, "btn", Yellow, 35, () => OnPause?.Invoke());
            for (int i = -1; i <= 1; i += 2)
            {
                var bar = UiKit.Panel(b.transform, "bar", Ink, 5);
                var br = (RectTransform)bar.transform; br.anchorMin = br.anchorMax = new Vector2(0.5f, 0.5f); br.sizeDelta = new Vector2(12, 30); br.anchoredPosition = new Vector2(i * 9, 0);
            }
        }

        public Action OnPause;

        RectTransform BuildPause()
        {
            var p = UiKit.Fill(rootRt, "Pause");
            var dim = UiKit.Panel(p, "dim", new Color(0.04f, 0.06f, 0.14f, 0.55f), 0);
            dim.raycastTarget = true;
            var box = pauseBox = UiKit.Rect(p, "box", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(460, 520));
            UiKit.Shadow(box, 30, 0.35f);
            UiKit.Panel(box, "bg", UiKit.Sheet, 40);
            var t = UiKit.Rect(box, "t", new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -20), new Vector2(400, 80));
            UiKit.Label(t, "t", "Paused", 56, Ink);
            Button(box, new Vector2(0, 110), "Play", Green, () => OnResume?.Invoke());
            Button(box, new Vector2(0, 10), "Tuck Shop", new Color(1f, 0.6f, 0.75f), () => { Audio.Synth.I?.Play("pick"); OpenShop(); });
            soundBtn = Button(box, new Vector2(0, -90), "Sound: on", new Color(0.35f, 0.65f, 1f), () => { soundOn = !soundOn; soundBtn.text = soundOn ? "Sound: on" : "Sound: off"; OnSound?.Invoke(soundOn); });
            Button(box, new Vector2(0, -190), "Home", new Color(1f, 0.45f, 0.45f), () => OnQuit?.Invoke());
            p.gameObject.SetActive(false);
            return p;
        }

        Text soundBtn;
        bool soundOn = true;

        static Text Button(Transform parent, Vector2 pos, string label, Color c, Action a)
        {
            var rt = UiKit.Rect(parent, label, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), pos, new Vector2(300, 80));
            var b = UiKit.Button(rt, "btn", c, 40, a);
            return UiKit.Label(b.transform, "t", label, 36, Color.white, TextAnchor.MiddleCenter, 2);
        }

        public void ShowPause(bool on) => pauseLayer.gameObject.SetActive(on);

        void OpenShop() => shop.Open(rootRt, () => { RefreshTitle(); OnShopChanged?.Invoke(); });

        // ------------------------------------------------------------------ bubbles, pops, names

        void BuildBubble()
        {
            bubbleRt = UiKit.Rect(game, "bubble", Vector2.zero, Vector2.zero, new Vector2(0.5f, 0), Vector2.zero, new Vector2(360, 90));
            UiKit.Shadow(bubbleRt, 12, 0.2f);
            UiKit.Panel(bubbleRt, "bg", Color.white, 30);
            var tail = UiKit.Rect(bubbleRt, "tail", new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0.5f, 0.5f), new Vector2(0, 2), new Vector2(26, 26));
            tail.localRotation = Quaternion.Euler(0, 0, 45);
            UiKit.Panel(tail, "t", Color.white, 4);
            bubbleText = UiKit.Label(bubbleRt, "t", "", 24, Ink);
            bubbleText.horizontalOverflow = HorizontalWrapMode.Wrap;
            ((RectTransform)bubbleText.transform).offsetMin = new Vector2(18, 8); ((RectTransform)bubbleText.transform).offsetMax = new Vector2(-18, -8);
            bubbleRt.gameObject.SetActive(false);
        }

        public void Say(string text, Vector3 world)
        {
            bubbleText.text = text;
            bubbleWorld = world;
            bubbleT = 3f;
            float w = Mathf.Clamp(text.Length * 13 + 40, 160, 420);
            bubbleRt.sizeDelta = new Vector2(w, text.Length > 30 ? 96 : 66);
        }

        public void Pop(Vector3 world, string text, Color c, int size = 34, float life = 0.9f)
        {
            var p = popPool.Count > 0 ? popPool.Pop() : null;
            if (p == null)
            {
                var rt = UiKit.Rect(popLayer, "pop", Vector2.zero, Vector2.zero, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(300, 60));
                p = new PopUp { rt = rt, t = UiKit.Label(rt, "t", "", size, c, TextAnchor.MiddleCenter, 2.5f, new Color(0, 0, 0, 0.55f)) };
            }
            p.rt.gameObject.SetActive(true);
            p.t.text = text; p.t.color = c; p.t.fontSize = size;
            p.world = world; p.age = 0; p.life = life; p.rise = 60;
            pops.Add(p);
        }

        void BuildBanner()
        {
            bannerRt = UiKit.Rect(game, "banner", new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0.5f, 0.5f), new Vector2(0, -190), new Vector2(620, 170));
            // The banner's soft shadow rides inside it, so it comes and goes (and swings) with the banner: left
            // beside it, it stayed on screen after the banner had gone, a grey smudge over London's cream paper.
            var shadow = UiKit.Shadow(bannerRt, 26, 0.3f);
            shadow.transform.SetParent(bannerRt, true);
            shadow.transform.SetAsFirstSibling();
            UiKit.Panel(bannerRt, "bg", Yellow, 44);
            var inner = UiKit.Panel(bannerRt, "inner", new Color(1, 1, 1, 0.25f), 36);
            ((RectTransform)inner.transform).offsetMin = new Vector2(8, 8); ((RectTransform)inner.transform).offsetMax = new Vector2(-8, -8);
            bannerTitle = UiKit.Label(bannerRt, "t", "", 60, Ink);
            ((RectTransform)bannerTitle.transform).offsetMin = new Vector2(0, 60);
            for (int i = 0; i < 3; i++)
            {
                var ic = UiKit.Rect(bannerRt, "icon", new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(-80 + i * 80, 4), new Vector2(92, 92));
                bannerIcons[i] = ic.gameObject.AddComponent<RawImage>();
                bannerIcons[i].raycastTarget = false;
            }
            bannerRt.gameObject.SetActive(false);
        }

        public void ShowTier(int tier, Texture2D[] gulps) => ShowBanner(Snake.TIERS[tier].name + "!", gulps);

        /// <summary>A banner with one picture (a magic creature), or none.</summary>
        public void Banner(string text, Texture2D icon) => ShowBanner(text, icon != null ? new[] { icon } : null);

        void ShowBanner(string text, Texture2D[] icons)
        {
            bannerTitle.text = text;
            int n = Mathf.Min(3, icons?.Length ?? 0);
            for (int i = 0; i < 3; i++)
            {
                bool on = i < n && icons[i] != null;
                bannerIcons[i].gameObject.SetActive(on);
                if (on) bannerIcons[i].texture = icons[i];
            }
            for (int i = 0; i < n; i++) ((RectTransform)bannerIcons[i].transform).anchoredPosition = new Vector2((i - (n - 1) / 2f) * 96, 2);
            // No pictures: the words sit in the middle of the banner.
            ((RectTransform)bannerTitle.transform).offsetMin = new Vector2(0, n > 0 ? 60 : 0);
            bannerT = 0;
            bannerRt.gameObject.SetActive(true);
        }

        // ------------------------------------------------------------------ gems and magic, under the score

        static readonly MagicId[] MagicOrder =
        {
            MagicId.Halo, MagicId.Rainbow, MagicId.Owl, MagicId.Hidden, MagicId.Magnet,
            MagicId.Wings, MagicId.River, MagicId.Giant, MagicId.Phoenix,
        };
        /// <summary>Who gives each magic (by MagicId): on the Common, and London's legends.</summary>
        static readonly CreatureKind[] MagicCreature =
        {
            CreatureKind.Unicorn, CreatureKind.Kitsune, CreatureKind.Pixie, CreatureKind.Owl, CreatureKind.Stag,
            CreatureKind.Dragon, CreatureKind.Mermaid, CreatureKind.Gog, CreatureKind.Phoenix, CreatureKind.LionRoyal,
        };
        static readonly string[] MagicLabel = { "Rainbow", "Hidden", "Magnet", "Owl eyes", "Halo", "Wings", "River", "Giant", "Phoenix", "Roar" };
        static readonly Color[] MagicCol =
        {
            new Color(1f, 0.5f, 0.75f), new Color(1f, 0.6f, 0.25f), new Color(0.55f, 0.9f, 0.6f), new Color(0.7f, 0.6f, 1f), new Color(1f, 0.85f, 0.3f),
            new Color(0.78f, 0.82f, 0.9f), new Color(0.12f, 0.85f, 0.78f), new Color(0.72f, 0.5f, 0.3f), new Color(1f, 0.42f, 0.15f), new Color(1f, 0.76f, 0.1f),
        };
        /// <summary>The creature a magic came from here: London's ghost and fairy give the Common's hidden and magnet.</summary>
        CreatureKind MagicSource(int i) =>
            stage != null && stage.Id == StageId.London && i == (int)MagicId.Hidden ? CreatureKind.Ghost :
            stage != null && stage.Id == StageId.London && i == (int)MagicId.Magnet ? CreatureKind.Fairy : MagicCreature[i];

        sealed class MagicBadge { public RectTransform rt; public Image fill; public RawImage icon; public float max; }
        readonly MagicBadge[] magicBadges = new MagicBadge[10];
        Text gemCount;
        RectTransform gemPill;
        int lastGems = -1;

        void BuildGems()
        {
            gemPill = UiKit.Rect(game, "gems", new Vector2(0, 1), new Vector2(0, 1), new Vector2(0, 1), new Vector2(22, -196), new Vector2(150, 58));
            UiKit.Shadow(gemPill, 12, 0.2f);
            UiKit.Panel(gemPill, "bg", Cream, 29);
            var g = UiKit.Image(gemPill, "gem", UiKit.Gem, Gem);
            var gr = (RectTransform)g.transform; gr.anchorMin = gr.anchorMax = new Vector2(0, 0.5f); gr.sizeDelta = new Vector2(40, 40); gr.anchoredPosition = new Vector2(34, 0);
            gemCount = UiKit.Label(gemPill, "n", "0", 34, Ink, TextAnchor.MiddleLeft);
            ((RectTransform)gemCount.transform).offsetMin = new Vector2(62, 0);

            // One badge per magic: the creature that gave it, with a ring that runs down as it wears off.
            for (int i = 0; i < magicBadges.Length; i++)
            {
                var rt = UiKit.Rect(game, "magic", new Vector2(0, 1), new Vector2(0, 1), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(84, 84));
                UiKit.Shadow(rt, 12, 0.22f);
                UiKit.Panel(rt, "bg", Cream, 42);
                var fill = UiKit.Image(rt, "ring", UiKit.Circle, MagicCol[i]);
                fill.type = Image.Type.Filled; fill.fillMethod = Image.FillMethod.Radial360; fill.fillOrigin = (int)Image.Origin360.Top; fill.fillClockwise = false;
                ((RectTransform)fill.transform).offsetMin = new Vector2(4, 4); ((RectTransform)fill.transform).offsetMax = new Vector2(-4, -4);
                var hole = UiKit.Image(rt, "hole", UiKit.Circle, Cream);
                ((RectTransform)hole.transform).offsetMin = new Vector2(11, 11); ((RectTransform)hole.transform).offsetMax = new Vector2(-11, -11);
                var ic = UiKit.Rect(rt, "icon", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(70, 70));
                var raw = ic.gameObject.AddComponent<RawImage>();
                raw.raycastTarget = false;
                var lbl = UiKit.Rect(rt, "lbl", new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0.5f, 1), new Vector2(0, 2), new Vector2(130, 28));
                UiKit.Label(lbl, "t", MagicLabel[i], 21, Color.white, TextAnchor.MiddleCenter, 1.5f, new Color(0, 0, 0, 0.55f));
                rt.gameObject.SetActive(false);
                magicBadges[i] = new MagicBadge { rt = rt, fill = fill, icon = raw };
            }
        }

        void SyncGems(Snake me, float dt)
        {
            int gems = Meta.Profile.I.gems;
            if (gems != lastGems)
            {
                if (lastGems >= 0 && gems > lastGems) gemPill.localScale = Vector3.one * 1.3f;
                lastGems = gems;
                gemCount.text = gems.ToString("N0");
            }
            gemPill.localScale = Vector3.Lerp(gemPill.localScale, Vector3.one, 1 - Mathf.Exp(-dt * 10));

            float x = 64;
            foreach (var id in MagicOrder)
            {
                int i = (int)id;
                var b = magicBadges[i];
                float left = me.magic[i];
                bool on = left > 0 && me.alive;
                if (left <= 0) b.max = 0;
                if (b.rt.gameObject.activeSelf != on)
                {
                    b.rt.gameObject.SetActive(on);
                    if (on) { b.icon.texture = Icons.Creature(MagicSource(i)); b.rt.localScale = Vector3.one * 1.4f; }
                }
                if (!on) continue;
                if (left > b.max) b.max = left;
                b.fill.fillAmount = left / b.max;
                b.rt.anchoredPosition = new Vector2(x, -310);
                // Nearly gone: the badge blinks.
                float a = left < 3 ? 0.55f + 0.45f * Mathf.Cos(Time.unscaledTime * 12) : 1;
                b.icon.color = new Color(1, 1, 1, a);
                b.rt.localScale = Vector3.Lerp(b.rt.localScale, Vector3.one, 1 - Mathf.Exp(-dt * 8));
                x += 100;
            }
        }

        RectTransform BuildBonk()
        {
            var b = UiKit.Fill(game, "Bonk");
            UiKit.Panel(b, "dim", new Color(0.3f, 0.05f, 0.1f, 0.25f), 0);
            var t = UiKit.Rect(b, "t", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, 60), new Vector2(800, 200));
            UiKit.Label(t, "t", "BONK!", 150, new Color(1f, 0.45f, 0.45f), TextAnchor.MiddleCenter, 6, new Color(0.3f, 0.02f, 0.05f, 0.9f));
            t.gameObject.AddComponent<Bob>().Amount = 10;
            var c = UiKit.Rect(b, "count", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, -90), new Vector2(150, 150));
            UiKit.Panel(c, "bg", Cream, 75);
            bonkCount = UiKit.Label(c, "n", "3", 90, Ink);
            b.gameObject.SetActive(false);
            return b;
        }

        public void ShowBonk(bool on, float left)
        {
            bonkLayer.gameObject.SetActive(on);
            if (on) bonkCount.text = Mathf.CeilToInt(Mathf.Max(0.01f, left)).ToString();
        }

        // ------------------------------------------------------------------ level-up cards

        /// <param name="timed">Online: a bar under the heading runs down to the server's own pick (see <see cref="CardsTime"/>).</param>
        public void ShowCards(UpgradeId[] cards, Snake s, Action<int> pick, int gems, bool timed = false)
        {
            foreach (Transform c in cardsLayer) Destroy(c.gameObject);
            cardsLayer.gameObject.SetActive(true);
            var dim = UiKit.Panel(cardsLayer, "dim", new Color(0.04f, 0.06f, 0.16f, 0.6f), 0);
            dim.raycastTarget = true;
            // The cards sit in slots on a deck that LayoutCards arranges: a row, or two rows on a tall screen.
            cardsDeck = UiKit.Rect(cardsLayer, "deck", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            cardsHead = UiKit.Rect(cardsDeck, "headSlot", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            cardSlots.Clear();
            var head = UiKit.Rect(cardsHead, "head", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(800, 110));
            UiKit.Label(head, "t", "Level up!", 80, Yellow, TextAnchor.MiddleCenter, 4, new Color(0.3f, 0.2f, 0, 0.9f));
            head.gameObject.AddComponent<Bob>().Amount = 6;
            cardsTimer = null;
            if (timed)
            {
                var bar = UiKit.Rect(cardsHead, "timer", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, -78), new Vector2(440, 24));
                UiKit.Panel(bar, "bg", new Color(1, 1, 1, 0.25f), 12);
                cardsTimer = UiKit.Panel(bar, "fill", Yellow, 12);
                cardsTimer.type = Image.Type.Filled; cardsTimer.fillMethod = Image.FillMethod.Horizontal; cardsTimer.fillOrigin = (int)Image.OriginHorizontal.Left;
                cardsTimer.sprite = UiKit.Rounded(12);
            }
            for (int i = 0; i < cards.Length; i++)
            {
                int idx = i;
                var id = cards[i];
                var def = Upgrades.DEFS[(int)id];
                var slot = UiKit.Rect(cardsDeck, "slot", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
                cardSlots.Add(slot);
                var rt = UiKit.Rect(slot, "card", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(290, 420));
                rt.gameObject.AddComponent<CardIntro>().Delay = i * 0.09f;
                UiKit.Shadow(rt, 26, 0.4f, new Vector2(0, -14));
                var b = UiKit.Button(rt, "btn", Cream, 34, () => pick(idx));
                var band = UiKit.Panel(b.transform, "band", RarityCol[(int)def.rarity], 34);
                var br = (RectTransform)band.transform; br.anchorMin = new Vector2(0, 1); br.anchorMax = new Vector2(1, 1); br.pivot = new Vector2(0.5f, 1); br.sizeDelta = new Vector2(0, 230); br.anchoredPosition = Vector2.zero;
                var glow = UiKit.Image(band.transform, "glow", UiKit.Circle, new Color(1, 1, 1, 0.25f));
                ((RectTransform)glow.transform).offsetMin = new Vector2(40, 20); ((RectTransform)glow.transform).offsetMax = new Vector2(-40, -20);
                var icon = UiKit.Rect(band.transform, "icon", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, -4), new Vector2(210, 210));
                var raw = icon.gameObject.AddComponent<RawImage>();
                raw.texture = Icons.Upgrade(id);
                raw.raycastTarget = false;
                icon.gameObject.AddComponent<Bob>().Amount = 5;
                var rar = UiKit.Rect(band.transform, "rarity", new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -12), new Vector2(200, 30));
                UiKit.Label(rar, "t", RarityName[(int)def.rarity], 20, new Color(1, 1, 1, 0.9f), TextAnchor.MiddleCenter, 1);
                var name = UiKit.Rect(b.transform, "name", new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 112), new Vector2(270, 60));
                UiKit.Label(name, "t", def.label, 40, Ink);
                // Level pips: how many of this you already own.
                int have = id == UpgradeId.Snack ? 0 : s.LevelOf(id);
                int max = id == UpgradeId.Snack ? 0 : def.max;
                for (int p = 0; p < max; p++)
                {
                    var pip = UiKit.Rect(b.transform, "pip", new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0.5f, 0.5f), new Vector2((p - (max - 1) / 2f) * 34, 70), new Vector2(24, 24));
                    var pi = pip.gameObject.AddComponent<Image>();
                    pi.sprite = UiKit.Star;
                    pi.color = p < have ? Yellow : p == have ? new Color(1f, 0.83f, 0.23f, 0.95f) : new Color(0, 0, 0, 0.15f);
                    pi.raycastTarget = false;
                    if (p == have) pip.gameObject.AddComponent<Bob>().Amount = 4;
                }
                var key = UiKit.Rect(b.transform, "key", new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 18), new Vector2(46, 36));
                UiKit.Panel(key, "bg", new Color(0, 0, 0, 0.08f), 10);
                UiKit.Label(key, "t", (i + 1).ToString(), 24, new Color(0, 0, 0, 0.4f));

                // Powers cost a blue gem: a price tag on the corner, greyed out if you cannot pay.
                if (Upgrades.IsPower(id))
                {
                    bool afford = gems >= Upgrades.POWER_GEM_COST;
                    var tag = UiKit.Rect(rt, "price", new Vector2(1, 1), new Vector2(1, 1), new Vector2(0.5f, 0.5f), new Vector2(-14, -10), new Vector2(104, 52));
                    tag.localRotation = Quaternion.Euler(0, 0, -8);
                    UiKit.Shadow(tag, 10, 0.3f);
                    UiKit.Panel(tag, "bg", afford ? new Color(0.2f, 0.45f, 0.9f) : new Color(0.5f, 0.52f, 0.58f), 26);
                    var gi = UiKit.Image(tag, "gem", UiKit.Gem, afford ? new Color(0.75f, 0.92f, 1f) : new Color(0.85f, 0.87f, 0.9f));
                    var gr = (RectTransform)gi.transform; gr.anchorMin = gr.anchorMax = new Vector2(0, 0.5f); gr.sizeDelta = new Vector2(34, 34); gr.anchoredPosition = new Vector2(30, 0);
                    var pl = UiKit.Label(tag, "n", Upgrades.POWER_GEM_COST.ToString(), 32, Color.white, TextAnchor.MiddleCenter, 1.5f);
                    ((RectTransform)pl.transform).offsetMin = new Vector2(44, 0);
                    if (!afford) b.GetComponent<Image>().color = new Color(0.85f, 0.85f, 0.85f);
                }
            }
            LayoutCards();
        }

        Image cardsTimer;

        /// <summary>How much of the time to pick is left, 0..1; the bar reddens near the end.</summary>
        public void CardsTime(float frac)
        {
            if (cardsTimer == null) return;
            cardsTimer.fillAmount = Mathf.Clamp01(frac);
            cardsTimer.color = Color.Lerp(new Color(1f, 0.45f, 0.45f), Yellow, Mathf.Clamp01(frac * 3));
        }

        RectTransform results;
        Text resultStars;
        float starShown, starTarget, starChime;
        int starStep;

        /// <summary>Home time: what the run came to, the stars counting up with a chime each.</summary>
        public void ShowResults(int score, float longest, int gulps, int bonks, int stars, int gems, Action again, Action home)
        {
            if (results) Destroy(results.gameObject);
            results = UiKit.Fill(rootRt, "Results");
            var dim = UiKit.Panel(results, "dim", new Color(0.04f, 0.08f, 0.18f, 0.5f), 0);
            dim.raycastTarget = true;
            // The box sits in a frame that LayoutResults moves and scales (the box itself flips in).
            resultFrame = UiKit.Rect(results, "frame", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            var box = resultBox = UiKit.Rect(resultFrame, "box", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(980, 640));
            box.gameObject.AddComponent<CardIntro>();
            UiKit.Shadow(box, 34, 0.4f);
            UiKit.Panel(box, "bg", UiKit.Sheet, 50);
            var t = UiKit.Rect(box, "title", new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -26), new Vector2(800, 100));
            UiKit.Label(t, "t", "Home time!", 78, Ink);
            var tiles = new (Texture2D icon, string value, string label)[]
            {
                (Icons.Trophy, score.ToString("N0"), "Score"), (Icons.Coil, Mathf.RoundToInt(longest) + "m", "Longest"),
                (Icons.Animal(stage != null && stage.Id == StageId.Common ? AnimalKind.Squirrel : AnimalKind.Chicken), gulps.ToString(), "Gulps"), (Icons.Burst, bonks.ToString(), "Bonks"),
            };
            for (int i = 0; i < tiles.Length; i++)
            {
                var tile = resultTiles[i] = UiKit.Rect(box, "tile", new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2((i - 1.5f) * 225, -140), new Vector2(205, 250));
                UiKit.Panel(tile, "bg", Color.white, 30);
                var ic = UiKit.Rect(tile, "icon", new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -6), new Vector2(130, 130));
                ic.gameObject.AddComponent<RawImage>().texture = tiles[i].icon;
                ic.gameObject.AddComponent<Bob>().Amount = 4;
                var v = UiKit.Rect(tile, "v", new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 52), new Vector2(200, 60));
                UiKit.Label(v, "t", tiles[i].value, 44, Ink);
                var l = UiKit.Rect(tile, "l", new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 16), new Vector2(200, 36));
                UiKit.Label(l, "t", tiles[i].label, 26, new Color(0.35f, 0.4f, 0.5f));
            }
            var earned = resultEarned = UiKit.Rect(box, "earned", new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(-320, 64), new Vector2(280, 110));
            UiKit.Panel(earned, "bg", new Color(1f, 0.83f, 0.23f, 0.35f), 40);
            var st = UiKit.Image(earned, "star", UiKit.Star, Yellow);
            var sr = (RectTransform)st.transform; sr.anchorMin = sr.anchorMax = new Vector2(0, 0.5f); sr.sizeDelta = new Vector2(84, 84); sr.anchoredPosition = new Vector2(60, 0);
            st.gameObject.AddComponent<Bob>().Amount = 5;
            resultStars = UiKit.Label(earned, "n", "+0", 64, Ink);
            ((RectTransform)resultStars.transform).offsetMin = new Vector2(90, 0);
            starShown = 0; starTarget = stars; starStep = 0; starChime = 0.6f;

            // Blue gems won this run (bonks, zaps, kisses and magic).
            var gemBox = resultGems = UiKit.Rect(box, "gems", new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(-50, 64), new Vector2(220, 110));
            UiKit.Panel(gemBox, "bg", new Color(0.35f, 0.7f, 1f, gems > 0 ? 0.3f : 0.12f), 40);
            var gi = UiKit.Image(gemBox, "gem", UiKit.Gem, gems > 0 ? Gem : new Color(0.6f, 0.7f, 0.8f));
            var gr = (RectTransform)gi.transform; gr.anchorMin = gr.anchorMax = new Vector2(0, 0.5f); gr.sizeDelta = new Vector2(74, 74); gr.anchoredPosition = new Vector2(56, 0);
            if (gems > 0) gi.gameObject.AddComponent<Bob>().Amount = 5;
            var gl = UiKit.Label(gemBox, "n", "+" + gems, 60, Ink);
            ((RectTransform)gl.transform).offsetMin = new Vector2(86, 0);

            var againRt = resultAgain = UiKit.Rect(box, "again", new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0.5f, 0.5f), new Vector2(150, 118), new Vector2(150, 150));
            UiKit.Shadow(againRt, 20, 0.3f, null, true);
            var ab = UiKit.Button(againRt, "btn", Yellow, 75, () => { HideResults(); again(); });
            ab.GetComponent<Springy>().Idle = 0.03f;
            var tri = UiKit.Image(ab.transform, "tri", UiKit.Play, Ink);
            ((RectTransform)tri.transform).offsetMin = new Vector2(42, 38); ((RectTransform)tri.transform).offsetMax = new Vector2(-32, -38);
            var al = UiKit.Rect(againRt, "l", new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0.5f, 1), new Vector2(0, -4), new Vector2(200, 36));
            UiKit.Label(al, "t", "Again", 28, Ink);
            var homeRt = resultHome = UiKit.Rect(box, "home", new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0.5f, 0.5f), new Vector2(330, 118), new Vector2(110, 110));
            var hb = UiKit.Button(homeRt, "btn", new Color(0.35f, 0.65f, 1f), 55, () => { HideResults(); home(); });
            var hl = UiKit.Rect(homeRt, "l", new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0.5f, 1), new Vector2(0, -4), new Vector2(200, 36));
            UiKit.Label(hl, "t", "Home", 28, Ink);
            var house = UiKit.Image(hb.transform, "house", UiKit.Play, Color.white);
            house.transform.localRotation = Quaternion.Euler(0, 0, 90);
            ((RectTransform)house.transform).offsetMin = new Vector2(28, 28); ((RectTransform)house.transform).offsetMax = new Vector2(-28, -28);
            game.gameObject.SetActive(false);
            LayoutResults();
        }

        public void HideResults() { if (results) Destroy(results.gameObject); results = null; }
        public bool ResultsOpen => results != null;

        void Update()
        {
            if (spinner.gameObject.activeSelf) spinner.transform.localRotation = Quaternion.Euler(0, 0, -Time.unscaledTime * 360);
            SyncToast();
            if (results == null || resultStars == null) return;
            starChime -= Time.unscaledDeltaTime;
            if (starShown < starTarget && starChime <= 0)
            {
                float step = Mathf.Max(1, Mathf.Ceil(starTarget / 30));
                starShown = Mathf.Min(starTarget, starShown + step);
                resultStars.text = "+" + (int)starShown;
                resultStars.transform.localScale = Vector3.one * 1.25f;
                Audio.Synth.I?.Play("star" + (starStep++ % 8));
                if (starShown >= starTarget) Audio.Synth.I?.Play("chaChing");
                starChime = 0.06f;
            }
            resultStars.transform.localScale = Vector3.Lerp(resultStars.transform.localScale, Vector3.one, Time.unscaledDeltaTime * 12);
        }

        public void HideCards() { foreach (Transform c in cardsLayer) Destroy(c.gameObject); cardsLayer.gameObject.SetActive(false); }

        // ------------------------------------------------------------------ online: friends, the line, your name

        RectTransform playersRt, toastRt, namePanel, nameBox;
        Text playersText, toastText;
        CanvasGroup toastGroup;
        float toastT = -1;
        InputField nameInput;
        int shownPlayers = -1;

        void BuildPlayers()
        {
            playersRt = UiKit.Rect(game, "players", new Vector2(1, 1), new Vector2(1, 1), new Vector2(1, 1), Vector2.zero, new Vector2(130, 58));
            UiKit.Shadow(playersRt, 12, 0.2f);
            UiKit.Panel(playersRt, "bg", Cream, 29);
            var ic = UiKit.Image(playersRt, "pals", UiKit.Pals, new Color(0.35f, 0.65f, 1f));
            var ir = (RectTransform)ic.transform; ir.anchorMin = ir.anchorMax = new Vector2(0, 0.5f); ir.sizeDelta = new Vector2(46, 46); ir.anchoredPosition = new Vector2(36, 0);
            playersText = UiKit.Label(playersRt, "n", "2", 34, Ink, TextAnchor.MiddleLeft);
            ((RectTransform)playersText.transform).offsetMin = new Vector2(66, 0);
            ShowPlayers(0);
        }

        /// <summary>How many children share the playground: shown only when it is more than just you.</summary>
        public void ShowPlayers(int humans)
        {
            if (humans == shownPlayers) return;
            bool grew = humans > shownPlayers && shownPlayers > 1;
            shownPlayers = humans;
            bool on = humans > 1;
            playersRt.gameObject.SetActive(on);
            if (playersRt.parent.Find(playersRt.name + "-shadow") is Transform sh) sh.gameObject.SetActive(on);
            if (on) playersText.text = humans.ToString();
            if (on && grew) playersRt.gameObject.AddComponent<Shake>();
        }

        RectTransform BuildToast()
        {
            var t = UiKit.Rect(rootRt, "toast", new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -40), new Vector2(460, 84));
            toastGroup = t.gameObject.AddComponent<CanvasGroup>();
            toastGroup.blocksRaycasts = false;
            UiKit.Panel(t, "bg", new Color(0.13f, 0.15f, 0.22f, 0.92f), 42);
            var ic = toastSignal = UiKit.Image(t, "signal", UiKit.Signal, new Color(0.75f, 0.8f, 0.9f));
            var ir = (RectTransform)ic.transform; ir.anchorMin = ir.anchorMax = new Vector2(0, 0.5f); ir.sizeDelta = new Vector2(54, 54); ir.anchoredPosition = new Vector2(52, 2);
            // Crossed out: the line is gone.
            var slash = UiKit.Panel(ic.transform, "slash", new Color(1f, 0.45f, 0.45f), 4);
            var sr = (RectTransform)slash.transform; sr.anchorMin = sr.anchorMax = new Vector2(0.5f, 0.5f); sr.sizeDelta = new Vector2(8, 66); sr.localRotation = Quaternion.Euler(0, 0, 40);
            // Or a little picture (a postcard), in the same place.
            var pr = UiKit.Rect(t, "pic", new Vector2(0, 0.5f), new Vector2(0, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(52, 0), new Vector2(76, 54));
            pr.localRotation = Quaternion.Euler(0, 0, -6);
            toastPic = pr.gameObject.AddComponent<RawImage>();
            toastPic.raycastTarget = false;
            pr.gameObject.SetActive(false);
            toastText = UiKit.Label(t, "t", "", 32, Color.white, TextAnchor.MiddleLeft);
            ((RectTransform)toastText.transform).offsetMin = new Vector2(96, 0); ((RectTransform)toastText.transform).offsetMax = new Vector2(-24, 0);
            t.gameObject.SetActive(false);
            return t;
        }

        /// <summary>A short note across the top that outlives the screen under it (the results come up behind it).</summary>
        Image toastSignal;
        RawImage toastPic;

        /// <summary>A short note with a picture (a postcard just kept) instead of the signal.</summary>
        public void Toast(string text, Texture picture)
        {
            Toast(text);
            toastSignal.gameObject.SetActive(picture == null);
            toastPic.gameObject.SetActive(picture != null);
            toastPic.texture = picture;
        }

        public void Toast(string text)
        {
            toastSignal.gameObject.SetActive(true);
            toastPic.gameObject.SetActive(false);
            toastText.text = text;
            toastRt.sizeDelta = new Vector2(Mathf.Max(300, text.Length * 17 + 130), 84);
            toastRt.SetAsLastSibling();
            toastRt.gameObject.SetActive(true);
            toastT = 0;
        }

        void SyncToast()
        {
            if (toastT < 0) return;
            toastT += Time.unscaledDeltaTime;
            toastRt.SetAsLastSibling();
            float a = toastT < 2.6f ? 1 : 1 - (toastT - 2.6f) / 0.4f;
            float drop = toastT < 0.3f ? Ease.OutBack(toastT / 0.3f) : 1;
            toastRt.anchoredPosition = new Vector2(0, -(fit.Units.y - fit.Safe.yMax) - 20 + (1 - drop) * 120);
            toastGroup.alpha = a;
            if (toastT >= 3) { toastT = -1; toastRt.gameObject.SetActive(false); }
        }

        RectTransform BuildName()
        {
            var p = UiKit.Fill(rootRt, "Name");
            var dim = UiKit.Panel(p, "dim", new Color(0.04f, 0.06f, 0.14f, 0.55f), 0);
            dim.raycastTarget = true;
            var box = nameBox = UiKit.Rect(p, "box", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(620, 400));
            UiKit.Shadow(box, 30, 0.35f);
            UiKit.Panel(box, "bg", UiKit.Sheet, 40);
            var t = UiKit.Rect(box, "t", new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -20), new Vector2(560, 80));
            UiKit.Label(t, "t", "Your name", 52, Ink);

            // The box to type in (on a phone, tapping it brings up the keyboard).
            var field = UiKit.Rect(box, "field", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, 30), new Vector2(540, 90));
            var bg = UiKit.Panel(field, "bg", Color.white, 30);
            bg.raycastTarget = true;
            var frame = UiKit.Image(field, "edge", UiKit.Rounded(30), new Color(0.35f, 0.65f, 1f, 0.6f));
            frame.type = Image.Type.Sliced; frame.preserveAspect = false;
            ((RectTransform)frame.transform).offsetMin = new Vector2(-4, -4); ((RectTransform)frame.transform).offsetMax = new Vector2(4, 4);
            frame.transform.SetAsFirstSibling();
            var text = UiKit.Label(field, "text", "", 42, Ink);
            text.supportRichText = false;
            ((RectTransform)text.transform).offsetMin = new Vector2(24, 0); ((RectTransform)text.transform).offsetMax = new Vector2(-24, 0);
            var hint = UiKit.Label(field, "hint", "...", 42, new Color(0, 0, 0, 0.25f));
            nameInput = bg.gameObject.AddComponent<InputField>();
            nameInput.textComponent = text;
            nameInput.placeholder = hint;
            nameInput.characterLimit = Meta.Names.MAX;
            nameInput.lineType = InputField.LineType.SingleLine;
            nameInput.caretColor = Ink;
            nameInput.caretWidth = 3;
            nameInput.customCaretColor = true;
            nameInput.selectionColor = new Color(0.35f, 0.65f, 1f, 0.35f);
            nameInput.transition = Selectable.Transition.None;
            nameInput.onSubmit.AddListener(_ => CommitName());

            var shuffle = UiKit.Rect(box, "shuffle", new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0.5f, 0.5f), new Vector2(-135, 80), new Vector2(250, 84));
            var sb = UiKit.Button(shuffle, "btn", new Color(0.35f, 0.65f, 1f), 42, () => { nameInput.text = Meta.Names.Random(); Audio.Synth.I?.Play("pick"); });
            var dice = UiKit.Image(sb.transform, "dice", UiKit.Dice, Color.white);
            var dr = (RectTransform)dice.transform; dr.anchorMin = dr.anchorMax = new Vector2(0, 0.5f); dr.sizeDelta = new Vector2(52, 52); dr.anchoredPosition = new Vector2(46, 0);
            var sl = UiKit.Label(sb.transform, "t", "Shuffle", 34, Color.white, TextAnchor.MiddleCenter, 2);
            ((RectTransform)sl.transform).offsetMin = new Vector2(70, 0);
            var done = UiKit.Rect(box, "done", new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0.5f, 0.5f), new Vector2(135, 80), new Vector2(250, 84));
            var db = UiKit.Button(done, "btn", Green, 42, CommitName);
            UiKit.Label(db.transform, "t", "Done", 36, Color.white, TextAnchor.MiddleCenter, 2);
            p.gameObject.SetActive(false);
            return p;
        }

        public bool NameOpen => namePanel.gameObject.activeSelf;
        /// <summary>The frame the name panel closed, so the Enter that typed the name doesn't also press Play.</summary>
        public int NameClosedFrame { get; private set; } = -1;

        void OpenName()
        {
            nameInput.text = Meta.Profile.I.name;
            namePanel.gameObject.SetActive(true);
            namePanel.SetAsLastSibling();
            nameInput.ActivateInputField();
        }

        /// <summary>Take whatever is typed (cleaned), or keep the old name if it was empty or rude.</summary>
        void CommitName()
        {
            if (!NameOpen) return;
            var p = Meta.Profile.I;
            var cleaned = Meta.Names.Clean(nameInput.text);
            if (cleaned != null) { p.name = cleaned; p.Save(); Audio.Synth.I?.Play("pick"); }
            else Audio.Synth.I?.Play("nope");
            namePanel.gameObject.SetActive(false);
            NameClosedFrame = Time.frameCount;
            RefreshTitle();
        }

        // ------------------------------------------------------------------ fitting the screen

        Fit fit;
        RectTransform titleHead, titleMid, pauseBtn, pauseBox, dashRt, cardsDeck, cardsHead;
        readonly List<RectTransform> cardSlots = new List<RectTransform>();
        RectTransform resultFrame, resultBox, resultEarned, resultGems, resultAgain, resultHome;
        readonly RectTransform[] resultTiles = new RectTransform[4];
        float mapH = 220, bannerY = -190;
        int boardRows = 5;

        Vector2 SafeCentre => fit.Safe.center - fit.Units / 2;

        /// <summary>The screen changed shape (rotation, a resized window): fit everything to it again.</summary>
        public void Relayout()
        {
            // The title and the game keep clear of notches and the home bar; the dimmed overlays fill the screen.
            var lo = fit.Safe.min;
            var hi = fit.Units - fit.Safe.max;
            foreach (var layer in new[] { game, title }) { layer.offsetMin = lo; layer.offsetMax = -hi; }
            LayoutTitle();
            LayoutHud();
            Place(pauseBox, SafeCentre, pauseBox.sizeDelta, fit.Portrait ? 1.3f : Mathf.Min(1, fit.Safe.height / 580));
            // Upright, the name box rides high so the keyboard does not cover it.
            Place(nameBox, SafeCentre + new Vector2(0, fit.Portrait ? fit.Safe.height * 0.18f : 0), nameBox.sizeDelta, fit.Portrait ? 1.3f : Mathf.Min(1, fit.Safe.height / 460));
            if (CardsOpen) LayoutCards();
            if (results) LayoutResults();
            shop.Layout(fit);
            album.Layout(fit);
        }

        void LayoutTitle()
        {
            var size = fit.Safe.size;
            // The album sits beside the Tuck Shop; upright, above it, clear of the footer line.
            if (albumBtn) Place(albumBtn, fit.Portrait ? new Vector2(110, 310) : new Vector2(285, 120), albumBtn.sizeDelta);
            if (!fit.Portrait)
            {
                // Sideways: as designed, only shrunk on a short screen (a phone on its side).
                float k = Mathf.Min(1, size.y / 840);
                Set(titleHead, Vector2.zero, k);
                Set(titleMid, Vector2.zero, k);
                return;
            }
            // Upright: the logo fitted to the width, the choices bigger below it, all clear of the wallet and the shop.
            float hs = Mathf.Min(1, (size.x - 40) / 920);
            float top = size.y / 2 - 110, bottom = -size.y / 2 + 250;
            float c = Mathf.Min(1.3f, (size.x - 40) / 640, (top - bottom - 230 * hs - 60) / 521);
            float gap = Mathf.Max(20, (top - bottom - 230 * hs - 521 * c) / 3);
            // The logo's middle is 225 above the head's origin, the choices' middle 125 below the column's.
            Set(titleHead, new Vector2(0, top - gap - 115 * hs - 225 * hs), hs);
            Set(titleMid, new Vector2(0, bottom + gap + 260 * c + 125 * c), c);
        }

        void LayoutHud()
        {
            bool tall = fit.Portrait;
            // Upright, the top row is shared by the score and the map: a smaller map, and a top three plus you.
            float ms = tall ? 0.8f : 1;
            boardRows = tall ? 4 : 5;
            Place(mapBox, new Vector2(-22, -34), new Vector2(210, mapH), ms);
            Place(boardRt, new Vector2(-22, -34 - mapH * ms - 14), new Vector2(250, 20 + boardRows * 34), tall ? 0.9f : 1);
            Place(pauseBtn, new Vector2(-22 - 210 * ms - 14, -34), pauseBtn.sizeDelta, 1);
            // The friends pill hangs under the pause button.
            Place(playersRt, new Vector2(-22 - 210 * ms - 14, -34 - 70 - 14), playersRt.sizeDelta, 1);
            // Dash sits under the right thumb; a little higher and bigger on a phone held upright.
            Place(dashRt, tall ? new Vector2(-130, 210) : new Vector2(-120, 120), dashRt.sizeDelta, tall ? 1.15f : 1);
            // The banner drops below the top row, which is taller upright.
            bannerY = tall ? -480 : -190;
            if (bannerT < 0) bannerRt.anchoredPosition = new Vector2(0, bannerY);
        }

        void LayoutCards()
        {
            if (cardsDeck == null) return;
            // A row of cards; on a tall screen two per row, bigger.
            bool tall = fit.Portrait;
            int n = cardSlots.Count;
            int perRow = tall && n > 2 ? 2 : Mathf.Max(1, n);
            int rows = (n + perRow - 1) / perRow;
            for (int i = 0; i < n; i++)
            {
                int r = i / perRow, inRow = Mathf.Min(perRow, n - r * perRow);
                cardSlots[i].anchoredPosition = new Vector2((i % perRow - (inRow - 1) / 2f) * 330, ((rows - 1) / 2f - r) * 460 - 20);
            }
            cardsHead.anchoredPosition = new Vector2(0, (rows - 1) / 2f * 460 + 300);
            var size = fit.Safe.size;
            // Tall: keep clear of the score and map row up top, so sit a little low.
            float k = Mathf.Min(tall ? 1.3f : 1, (size.x - 40) / (perRow * 330 + 40), (size.y - (tall ? 300 : 20)) / (rows * 460 + 200));
            Set(cardsDeck, SafeCentre + new Vector2(0, tall ? -120 : 0), k);
        }

        void LayoutResults()
        {
            // Four tiles in a row, or two by two on a tall screen with the stars, gems and buttons below.
            bool tall = fit.Portrait;
            var boxSize = tall ? new Vector2(640, 1040) : new Vector2(980, 640);
            Place(resultBox, Vector2.zero, boxSize);
            for (int i = 0; i < 4; i++)
                resultTiles[i].anchoredPosition = tall ? new Vector2((i % 2 - 0.5f) * 225, -140 - i / 2 * 270) : new Vector2((i - 1.5f) * 225, -140);
            resultEarned.anchoredPosition = tall ? new Vector2(-120, 240) : new Vector2(-320, 64);
            resultGems.anchoredPosition = tall ? new Vector2(150, 240) : new Vector2(-50, 64);
            Place(resultAgain, tall ? new Vector2(-80, 140) : new Vector2(150, 118), resultAgain.sizeDelta);
            resultHome.anchoredPosition = tall ? new Vector2(110, 140) : new Vector2(330, 118);
            var size = fit.Safe.size;
            float k = Mathf.Min(tall ? 1.3f : 1, (size.x - 40) / (boxSize.x + 60), (size.y - 30) / (boxSize.y + 40));
            Set(resultFrame, SafeCentre + new Vector2(0, -10), k);
        }

        static void Set(RectTransform rt, Vector2 pos, float scale)
        {
            rt.anchoredPosition = pos;
            rt.localScale = Vector3.one * scale;
        }

        /// <summary>Move, size and (scale &gt; 0) scale a rect, taking its drop shadow along.</summary>
        static void Place(RectTransform rt, Vector2 pos, Vector2 size, float scale = -1)
        {
            if (rt.parent.Find(rt.name + "-shadow") is RectTransform sh)
            {
                sh.anchoredPosition = pos + (sh.anchoredPosition - rt.anchoredPosition);
                sh.sizeDelta = size + (sh.sizeDelta - rt.sizeDelta);
                if (scale > 0) sh.localScale = Vector3.one * scale;
            }
            rt.anchoredPosition = pos;
            rt.sizeDelta = size;
            if (scale > 0) rt.localScale = Vector3.one * scale;
        }

        // ------------------------------------------------------------------ per frame

        public void Sync(World w, Camera cam, Func<int, Vector3> headOf, float dt)
        {
            var me = w.Me;
            displayScore = Mathf.Lerp(displayScore, me.score, 1 - Mathf.Exp(-dt * 10));
            if (Mathf.Abs(displayScore - me.score) < 1) displayScore = me.score;
            int shownScore = Mathf.RoundToInt(displayScore);
            if (shownScore != lastScore) { lastScore = shownScore; score.text = shownScore.ToString("N0"); }
            int tier = me.Tier;
            if (tier != lastTier) { lastTier = tier; tierName.text = Snake.TIERS[tier].name; }
            tierFill.fillAmount = Mathf.Lerp(tierFill.fillAmount, me.TierProgress, 1 - Mathf.Exp(-dt * 8));
            xpFill.fillAmount = Mathf.Lerp(xpFill.fillAmount, me.xp / Upgrades.XpForLevel(me.level), 1 - Mathf.Exp(-dt * 8));
            if (me.level != lastLevel) { lastLevel = me.level; levelText.text = "Level " + me.level; }

            // The animals the next size will let you gulp here (skipping sizes that add none).
            if (tier != lastGulpTier)
            {
                lastGulpTier = tier;
                Texture2D[] next = null;
                for (int t = tier + 1; t < Snake.TIERS.Length && (next == null || next.Length == 0); t++) next = NextGulps(w.Stage, t);
                for (int i = 0; i < 3; i++)
                {
                    bool on = next != null && i < next.Length;
                    gulpIcons[i].gameObject.SetActive(on);
                    if (on) gulpIcons[i].texture = next[i];
                }
            }
            SyncGems(me, dt);
            SyncLondon(w, dt);

            // World to the game layer, which sits inside the safe area.
            var full = rootRt.rect.size;
            var uiSize = game.rect.size;
            Vector2 ToUi(Vector3 world, out bool visible)
            {
                var vp = cam.WorldToViewportPoint(world);
                visible = vp.z > 0;
                return new Vector2(vp.x * full.x, vp.y * full.y) - game.offsetMin;
            }

            // Minimap.
            int di = 0;
            foreach (var f in w.Foods)
                if (f.golden) MapDot(di++, Yellow, 9).anchoredPosition = MapPos(f.x, f.z);
            // Animals: yellow if you can gulp them, pink if they would boop you.
            foreach (var a in w.Animals)
                MapDot(di++, tier >= a.Spec.tier ? MapGulp : MapBoop, 7).anchoredPosition = MapPos(a.x, a.z);
            if (w.Kids != null)
                foreach (var k in w.Kids) MapDot(di++, MapKid, 6).anchoredPosition = MapPos(k.x, k.z);
            if (w.Predators != null)
                foreach (var p in w.Predators) MapDot(di++, MapDanger, p.kind == PredatorKind.Bear || p.kind == PredatorKind.Lion ? 11 : 9).anchoredPosition = MapPos(p.x, p.z);
            // London: the buses (red) and cabs (black) on their rounds, and the Crown Jewels (gold) lying about.
            foreach (var v in w.Vehicles)
                MapDot(di++, v.kind == VehicleKind.Bus ? MapBus : MapCab, v.kind == VehicleKind.Bus ? 12 : 9).anchoredPosition = MapPos(v.x, v.z);
            foreach (var t in w.Treasures)
                if (t.respawnIn <= 0) MapDot(di++, Yellow, 12).anchoredPosition = MapPos(t.x, t.z);
            // Magic creatures hide, unless Owl Eyes is on.
            if (w.Creatures != null && me.HasMagic(MagicId.Owl))
                foreach (var c in w.Creatures)
                    if (c.respawnIn <= 0) MapDot(di++, MapMagic, 11).anchoredPosition = MapPos(c.x, c.z);
            var warden = MapPos(w.Cooper.x, w.Cooper.z);
            MapDot(di++, new Color(0.12f, 0.16f, 0.27f), 13).anchoredPosition = warden;
            MapDot(di++, Color.white, 6).anchoredPosition = warden;
            for (int i = w.Snakes.Count - 1; i >= 0; i--)
            {
                var s = w.Snakes[i];
                if (!s.alive) continue;
                var c = MeshKit.Hex(s.look.body);
                float size = i == w.MeIndex ? 20 : 11 + Mathf.Min(8, s.Radius * 8);
                var rt = MapDot(di++, i == w.MeIndex ? Color.white : c, size);
                rt.anchoredPosition = MapPos(s.x, s.z);
                if (i == w.MeIndex)
                {
                    var inner = MapDot(di++, c, 13);
                    inner.anchoredPosition = rt.anchoredPosition;
                }
            }
            for (int i = di; i < mapDots.Count; i++) mapDots[i].rt.gameObject.SetActive(false);

            // Leaderboard: the top five (three on a phone held upright), with "You" pinned to the last row if you are further down.
            order.Clear();
            order.AddRange(w.Snakes);
            order.Sort(ByScore);
            int mineAt = order.IndexOf(me);
            if (mineAt >= boardRows) { order[boardRows - 1] = me; }
            for (int i = 0; i < board.Count; i++)
            {
                bool on = i < order.Count && i < boardRows;
                board[i].name.transform.parent.gameObject.SetActive(on);
                if (!on) continue;
                var s = order[i];
                bool mine = s == me;
                SetText(board[i].name, mine ? "You" : s.look.name);
                if (boardScores[i] != (int)s.score || board[i].score.text.Length == 0) { boardScores[i] = (int)s.score; board[i].score.text = boardScores[i].ToString("N0"); }
                board[i].dot.color = MeshKit.Hex(s.look.body);
                board[i].name.color = board[i].score.color = mine ? Yellow : Color.white;
            }

            // Rival name tags.
            while (nameTags.Count < w.Snakes.Count)
            {
                var rt = UiKit.Rect(nameLayer, "tag", Vector2.zero, Vector2.zero, new Vector2(0.5f, 0), Vector2.zero, new Vector2(220, 34));
                nameTags.Add((rt, UiKit.Label(rt, "t", "", 22, Color.white, TextAnchor.MiddleCenter, 1.5f, new Color(0, 0, 0, 0.6f))));
            }
            for (int i = 0; i < w.Snakes.Count; i++)
            {
                var s = w.Snakes[i];
                bool on = i != w.MeIndex && s.alive;
                nameTags[i].rt.gameObject.SetActive(on);
                if (!on) continue;
                var p = ToUi(headOf(i) + Vector3.up * (s.Radius * 2 + 0.6f), out bool vis);
                nameTags[i].rt.gameObject.SetActive(vis);
                nameTags[i].rt.anchoredPosition = p;
                SetText(nameTags[i].t, s.look.name);
                nameTags[i].t.color = Color.Lerp(MeshKit.Hex(s.look.body), Color.white, 0.55f);
            }

            // Pops float up and fade.
            for (int i = pops.Count - 1; i >= 0; i--)
            {
                var p = pops[i];
                p.age += dt;
                float t = p.age / p.life;
                if (t >= 1) { p.rt.gameObject.SetActive(false); pops.RemoveAt(i); popPool.Push(p); continue; }
                var sp = ToUi(p.world, out _);
                p.rt.anchoredPosition = sp + Vector2.up * (p.rise * Ease.OutCubic(t) + 30);
                float s = t < 0.15f ? Ease.OutBack(t / 0.15f) : 1;
                p.rt.localScale = Vector3.one * s;
                var c = p.t.color; c.a = t > 0.6f ? 1 - (t - 0.6f) / 0.4f : 1; p.t.color = c;
            }

            // Mr Cooper's speech bubble rides above his head.
            bubbleT -= dt;
            bubbleRt.gameObject.SetActive(bubbleT > 0);
            if (bubbleT > 0)
            {
                var p = ToUi(bubbleWorld, out bool vis);
                // Only someone you can see is heard; near an edge, the bubble is kept fully on screen.
                vis &= p.x > 0 && p.x < uiSize.x && p.y > 0 && p.y < uiSize.y;
                float half = bubbleRt.sizeDelta.x / 2 + 12;
                p.x = Mathf.Clamp(p.x, half, Mathf.Max(half, uiSize.x - half));
                p.y = Mathf.Min(p.y, uiSize.y - bubbleRt.sizeDelta.y - 40);
                bubbleRt.anchoredPosition = p + Vector2.up * 20;
                float s = Mathf.Min(1, (3f - bubbleT) / 0.2f);
                bubbleRt.localScale = Vector3.one * (bubbleT < 0.25f ? bubbleT / 0.25f : Ease.OutBack(Mathf.Clamp01(s)));
                if (!vis) bubbleRt.gameObject.SetActive(false);
            }

            // The tier banner drops in, holds, and lifts away.
            if (bannerT >= 0)
            {
                bannerT += Time.unscaledDeltaTime;
                float y = bannerT < 0.4f ? Mathf.Lerp(150, bannerY, Ease.OutBack(bannerT / 0.4f)) : bannerT < 2.6f ? bannerY : Mathf.Lerp(bannerY, 200, (bannerT - 2.6f) / 0.4f);
                bannerRt.anchoredPosition = new Vector2(0, y);
                bannerRt.localRotation = Quaternion.Euler(0, 0, Mathf.Sin(bannerT * 6) * 2 * Mathf.Exp(-bannerT));
                if (bannerT > 3) { bannerT = -1; bannerRt.gameObject.SetActive(false); }
            }
        }

        public void SetBubbleWorld(Vector3 w) => bubbleWorld = w;

        /// <summary>A new run: forget whatever was being said in the last one.</summary>
        public void ClearBubble() { bubbleT = 0; bubbleRt.gameObject.SetActive(false); }

        static readonly Dictionary<(StageId, int), Texture2D[]> gulpCache = new Dictionary<(StageId, int), Texture2D[]>();

        /// <summary>The animals living on `stage` that a snake of `tier` can newly gulp, as pictures (built once each).</summary>
        public static Texture2D[] NextGulps(Stage stage, int tier)
        {
            if (stage == null || tier < 0 || tier >= Snake.TIERS.Length) return null;
            if (gulpCache.TryGetValue((stage.Id, tier), out var cached)) return cached;
            var list = new List<Texture2D>();
            foreach (var k in stage.AnimalKinds)
                if (Animals.SPECS[(int)k].tier == tier) list.Add(Icons.Animal(k));
            return gulpCache[(stage.Id, tier)] = list.ToArray();
        }

        static readonly Color MapGulp = new Color(1f, 0.88f, 0.4f), MapBoop = new Color(1f, 0.56f, 0.67f);
        static readonly Color MapBus = new Color(0.84f, 0.18f, 0.13f), MapCab = new Color(0.12f, 0.12f, 0.15f);
        static readonly Color MapKid = new Color(0.23f, 0.79f, 0.86f), MapDanger = new Color(0.88f, 0.19f, 0.19f), MapMagic = new Color(0.69f, 0.59f, 0.99f);

        readonly List<Snake> order = new List<Snake>();
        readonly int[] boardScores = new int[8];
        int lastScore = -1, lastTier = -1, lastLevel = -1, lastGulpTier = -1;
        static readonly Comparison<Snake> ByScore = (a, b) => b.score.CompareTo(a.score);
        static void SetText(Text t, string s) { if (!ReferenceEquals(t.text, s) && t.text != s) t.text = s; }
    }

    /// <summary>A gentle idle bob, so the title and the banners feel alive.</summary>
    public sealed class Bob : MonoBehaviour
    {
        public float Amount = 6;
        Vector2 home;
        /// <summary>Where it bobs about: set it to move the thing.</summary>
        public Vector2 Home { set { home = value; } }
        float phase;
        RectTransform rt;
        void Start() { rt = (RectTransform)transform; home = rt.anchoredPosition; phase = UnityEngine.Random.value * 6; }
        void Update() { if (rt) rt.anchoredPosition = home + Vector2.up * Mathf.Sin(Time.unscaledTime * 2.2f + phase) * Amount; }
    }

    /// <summary>A quick "no" wobble, then it removes itself.</summary>
    public sealed class Shake : MonoBehaviour
    {
        float t;
        void Update()
        {
            t += Time.unscaledDeltaTime;
            transform.localRotation = Quaternion.Euler(0, 0, Mathf.Sin(t * 50) * 8 * (1 - t / 0.4f));
            if (t >= 0.4f) { transform.localRotation = Quaternion.identity; Destroy(this); }
        }
    }

    /// <summary>Cards fly up and flip in, one after another.</summary>
    public sealed class CardIntro : MonoBehaviour
    {
        public float Delay;
        float t;
        void Update()
        {
            t += Time.unscaledDeltaTime;
            float k = Mathf.Clamp01((t - Delay) / 0.45f);
            float e = k <= 0 ? 0 : Ease.OutBack(k);
            transform.localScale = Vector3.one * Mathf.Max(0.001f, e);
            transform.localRotation = Quaternion.Euler(0, (1 - k) * 90, (1 - k) * -8);
            if (k >= 1) enabled = false;
        }
    }
}
