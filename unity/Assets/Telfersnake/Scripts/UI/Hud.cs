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
    public sealed class Hud : MonoBehaviour
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
        Image[] modeButtons = new Image[2];

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
            Pad = new Controls();

            game = UiKit.Fill(rootRt, "Game");
            nameLayer = UiKit.Fill(game, "Names");
            popLayer = UiKit.Fill(game, "Pops");
            BuildTopLeft();
            BuildXpBar();
            BuildMinimap();
            BuildDash();
            BuildStick();
            BuildBubble();
            BuildBanner();
            BuildPauseButton();
            bonkLayer = BuildBonk();
            cardsLayer = UiKit.Fill(rootRt, "Cards");
            cardsLayer.gameObject.SetActive(false);
            pauseLayer = BuildPause();
            title = BuildTitle();
            ShowTitle(true);
        }

        // ------------------------------------------------------------------ title

        RectTransform BuildTitle()
        {
            var t = UiKit.Fill(rootRt, "Title");
            var dim = UiKit.Panel(t, "dim", new Color(0.05f, 0.1f, 0.2f, 0.12f), 0);

            var logo = UiKit.Rect(t, "logo", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, 215), new Vector2(900, 170));
            logo.gameObject.AddComponent<Bob>().Amount = 8;
            var l1 = UiKit.Label(logo, "telfer", "Telfer", 150, Color.white, TextAnchor.MiddleRight, 5, new Color(0.1f, 0.2f, 0.35f, 0.9f));
            ((RectTransform)l1.transform).offsetMax = new Vector2(-445, 0);
            ((RectTransform)l1.transform).anchorMax = new Vector2(1, 1);
            var l2 = UiKit.Label(logo, "snake", "snake", 150, new Color(0.49f, 0.86f, 0.36f), TextAnchor.MiddleLeft, 5, new Color(0.08f, 0.3f, 0.1f, 0.95f));
            ((RectTransform)l2.transform).offsetMin = new Vector2(455, 0);
            var hd = UiKit.Rect(t, "hd", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(395, 300), new Vector2(110, 54));
            hd.localRotation = Quaternion.Euler(0, 0, -8);
            UiKit.Panel(hd, "bg", Yellow, 18);
            UiKit.Label(hd, "t", "HD", 40, Ink);
            hd.gameObject.AddComponent<Bob>().Amount = 5;

            // Mode pills.
            var modes = UiKit.Rect(t, "modes", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, 40), new Vector2(420, 80));
            for (int i = 0; i < 2; i++)
            {
                int idx = i;
                var rt = UiKit.Rect(modes, "mode", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(i == 0 ? -105 : 105, 0), new Vector2(190, 72));
                UiKit.Shadow(rt, 14, 0.25f);
                var b = UiKit.Button(rt, "btn", Cream, 36, () => { Mode = idx == 0 ? Mode.Easy : Mode.Normal; RefreshModes(); Audio.Synth.I?.Play("pick"); });
                modeButtons[i] = b.GetComponent<Image>();
                UiKit.Label(b.transform, "t", i == 0 ? "Easy" : "Normal", 36, Ink);
            }
            RefreshModes();

            // The big yellow play button.
            var play = UiKit.Rect(t, "play", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, -120), new Vector2(190, 190));
            UiKit.Shadow(play, 30, 0.35f, new Vector2(0, -14));
            var pb = UiKit.Button(play, "btn", Yellow, 95, () => OnPlay?.Invoke(Mode));
            pb.GetComponent<Springy>().Idle = 0.035f;
            var ring = UiKit.Image(pb.transform, "ring", UiKit.Ring, new Color(1, 1, 1, 0.55f));
            ((RectTransform)ring.transform).offsetMin = new Vector2(-6, -6); ((RectTransform)ring.transform).offsetMax = new Vector2(6, 6);
            var tri = UiKit.Image(pb.transform, "tri", UiKit.Play, Ink);
            ((RectTransform)tri.transform).offsetMin = new Vector2(55, 50); ((RectTransform)tri.transform).offsetMax = new Vector2(-45, -50);
            var playLbl = UiKit.Rect(t, "playLbl", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, -250), new Vector2(200, 50));
            UiKit.Label(playLbl, "t", "Play", 40, Color.white, TextAnchor.MiddleCenter, 2.5f);

            var best = UiKit.Rect(t, "best", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, -330), new Vector2(260, 56));
            UiKit.Panel(best, "bg", new Color(0, 0, 0, 0.32f), 28);
            var star = UiKit.Image(best, "star", UiKit.Star, Yellow);
            var srt = (RectTransform)star.transform; srt.anchorMin = srt.anchorMax = new Vector2(0, 0.5f); srt.sizeDelta = new Vector2(38, 38); srt.anchoredPosition = new Vector2(36, 0);
            bestText = UiKit.Label(best, "t", "", 32, Color.white);
            ((RectTransform)bestText.transform).offsetMin = new Vector2(40, 0);

            var hint = UiKit.Rect(t, "hint", new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 26), new Vector2(900, 40));
            UiKit.Label(hint, "t", "Telferscot Primary  ·  Unity HD", 24, new Color(1, 1, 1, 0.75f), TextAnchor.MiddleCenter, 1.5f);
            return t;
        }

        void RefreshModes()
        {
            for (int i = 0; i < 2; i++)
            {
                bool on = (i == 0) == (Mode == Mode.Easy);
                modeButtons[i].color = on ? Green : Cream;
                modeButtons[i].GetComponentInChildren<Text>().color = on ? Color.white : Ink;
            }
        }

        public void ShowTitle(bool on)
        {
            title.gameObject.SetActive(on);
            game.gameObject.SetActive(!on);
            if (on) bestText.text = PlayerPrefs.GetInt("best", 0).ToString("N0");
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
            var raw = map.gameObject.AddComponent<RawImage>();
            raw.texture = Ground.Minimap;
            // The painted texture covers 100 m; the school is 76 x 80 m in the middle of it.
            raw.uvRect = new Rect(0.11f, 0.09f, 0.78f, 0.82f);
            raw.raycastTarget = false;
            minimapImg = mask;

            var lb = UiKit.Rect(game, "board", new Vector2(1, 1), new Vector2(1, 1), new Vector2(1, 1), new Vector2(-22, -268), new Vector2(250, 190));
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
            var B = School.BOUNDS;
            return new Vector2((x - B.minX) / (B.maxX - B.minX) * size.x, (1 - (z - B.minZ) / (B.maxZ - B.minZ)) * size.y);
        }

        // ------------------------------------------------------------------ touch controls

        void BuildDash()
        {
            var rt = UiKit.Rect(game, "dash", new Vector2(1, 0), new Vector2(1, 0), new Vector2(0.5f, 0.5f), new Vector2(-120, 120), new Vector2(150, 150));
            UiKit.Shadow(rt, 20, 0.3f);
            var img = UiKit.Panel(rt, "btn", new Color(1, 1, 1, 0.82f), 75);
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
            stickRt.anchoredPosition = baseScreen * s;
            var d = (knobScreen - baseScreen) * s;
            if (d.magnitude > 60) d = d.normalized * 60;
            stickKnob.rectTransform.anchoredPosition = d;
        }

        void BuildPauseButton()
        {
            var rt = UiKit.Rect(game, "pause", new Vector2(1, 1), new Vector2(1, 1), new Vector2(1, 1), new Vector2(-246, -34), new Vector2(70, 70));
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
            var box = UiKit.Rect(p, "box", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(460, 420));
            UiKit.Shadow(box, 30, 0.35f);
            UiKit.Panel(box, "bg", Cream, 40);
            var t = UiKit.Rect(box, "t", new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -20), new Vector2(400, 80));
            UiKit.Label(t, "t", "Paused", 56, Ink);
            Button(box, new Vector2(0, 60), "Play", Green, () => OnResume?.Invoke());
            soundBtn = Button(box, new Vector2(0, -40), "Sound: on", new Color(0.35f, 0.65f, 1f), () => { soundOn = !soundOn; soundBtn.text = soundOn ? "Sound: on" : "Sound: off"; OnSound?.Invoke(soundOn); });
            Button(box, new Vector2(0, -140), "Home", new Color(1f, 0.45f, 0.45f), () => OnQuit?.Invoke());
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
            UiKit.Shadow(bannerRt, 26, 0.3f);
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

        public void ShowTier(int tier, Texture2D[] gulps)
        {
            bannerTitle.text = Snake.TIERS[tier].name + "!";
            for (int i = 0; i < 3; i++)
            {
                bool on = gulps != null && i < gulps.Length && gulps[i] != null;
                bannerIcons[i].gameObject.SetActive(on);
                if (on) bannerIcons[i].texture = gulps[i];
            }
            int n = gulps?.Length ?? 0;
            for (int i = 0; i < n && i < 3; i++) ((RectTransform)bannerIcons[i].transform).anchoredPosition = new Vector2((i - (n - 1) / 2f) * 96, 2);
            bannerT = 0;
            bannerRt.gameObject.SetActive(true);
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

        public void ShowCards(UpgradeId[] cards, Snake s, Action<int> pick)
        {
            foreach (Transform c in cardsLayer) Destroy(c.gameObject);
            cardsLayer.gameObject.SetActive(true);
            var dim = UiKit.Panel(cardsLayer, "dim", new Color(0.04f, 0.06f, 0.16f, 0.6f), 0);
            dim.raycastTarget = true;
            var head = UiKit.Rect(cardsLayer, "head", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, 300), new Vector2(800, 110));
            UiKit.Label(head, "t", "Level up!", 80, Yellow, TextAnchor.MiddleCenter, 4, new Color(0.3f, 0.2f, 0, 0.9f));
            head.gameObject.AddComponent<Bob>().Amount = 6;
            for (int i = 0; i < cards.Length; i++)
            {
                int idx = i;
                var id = cards[i];
                var def = Upgrades.DEFS[(int)id];
                var rt = UiKit.Rect(cardsLayer, "card", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2((i - 1) * 330, -20), new Vector2(290, 420));
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
            }
        }

        public void HideCards() { foreach (Transform c in cardsLayer) Destroy(c.gameObject); cardsLayer.gameObject.SetActive(false); }

        // ------------------------------------------------------------------ per frame

        public void Sync(World w, Camera cam, Func<int, Vector3> headOf, float dt)
        {
            var me = w.Me;
            displayScore = Mathf.Lerp(displayScore, me.score, 1 - Mathf.Exp(-dt * 10));
            if (Mathf.Abs(displayScore - me.score) < 1) displayScore = me.score;
            score.text = Mathf.RoundToInt(displayScore).ToString("N0");
            int tier = me.Tier;
            tierName.text = Snake.TIERS[tier].name;
            tierFill.fillAmount = Mathf.Lerp(tierFill.fillAmount, me.TierProgress, 1 - Mathf.Exp(-dt * 8));
            xpFill.fillAmount = Mathf.Lerp(xpFill.fillAmount, me.xp / Upgrades.XpForLevel(me.level), 1 - Mathf.Exp(-dt * 8));
            levelText.text = "Level " + me.level;

            // The animals the next size will let you gulp.
            var next = NextGulps(tier + 1);
            for (int i = 0; i < 3; i++)
            {
                bool on = next != null && i < next.Length;
                gulpIcons[i].gameObject.SetActive(on);
                if (on) gulpIcons[i].texture = next[i];
            }

            var uiSize = rootRt.rect.size;
            Vector2 ToUi(Vector3 world, out bool visible)
            {
                var vp = cam.WorldToViewportPoint(world);
                visible = vp.z > 0;
                return new Vector2(vp.x * uiSize.x, vp.y * uiSize.y);
            }

            // Minimap.
            int di = 0;
            foreach (var f in w.Foods)
                if (f.golden) MapDot(di++, Yellow, 9).anchoredPosition = MapPos(f.x, f.z);
            MapDot(di++, new Color(0.15f, 0.2f, 0.35f), 12).anchoredPosition = MapPos(w.Cooper.x, w.Cooper.z);
            for (int i = w.Snakes.Count - 1; i >= 0; i--)
            {
                var s = w.Snakes[i];
                if (!s.alive) continue;
                var c = MeshKit.Hex(s.look.body);
                float size = i == 0 ? 20 : 11 + Mathf.Min(8, s.Radius * 8);
                var rt = MapDot(di++, i == 0 ? Color.white : c, size);
                rt.anchoredPosition = MapPos(s.x, s.z);
                if (i == 0)
                {
                    var inner = MapDot(di++, c, 13);
                    inner.anchoredPosition = rt.anchoredPosition;
                }
            }
            for (int i = di; i < mapDots.Count; i++) mapDots[i].rt.gameObject.SetActive(false);

            // Leaderboard.
            var order = new List<Snake>(w.Snakes);
            order.Sort((a, b) => b.score.CompareTo(a.score));
            for (int i = 0; i < board.Count; i++)
            {
                bool on = i < order.Count;
                board[i].name.transform.parent.gameObject.SetActive(on);
                if (!on) continue;
                var s = order[i];
                bool mine = s.id == 0;
                board[i].name.text = mine ? "You" : s.look.name;
                board[i].score.text = ((int)s.score).ToString("N0");
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
                bool on = i > 0 && s.alive;
                nameTags[i].rt.gameObject.SetActive(on);
                if (!on) continue;
                var p = ToUi(headOf(i) + Vector3.up * (s.Radius * 2 + 0.6f), out bool vis);
                nameTags[i].rt.gameObject.SetActive(vis);
                nameTags[i].rt.anchoredPosition = p;
                nameTags[i].t.text = s.look.name;
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
                bubbleRt.anchoredPosition = p + Vector2.up * 20;
                float s = Mathf.Min(1, (3f - bubbleT) / 0.2f);
                bubbleRt.localScale = Vector3.one * (bubbleT < 0.25f ? bubbleT / 0.25f : Ease.OutBack(Mathf.Clamp01(s)));
                if (!vis) bubbleRt.gameObject.SetActive(false);
            }

            // The tier banner drops in, holds, and lifts away.
            if (bannerT >= 0)
            {
                bannerT += Time.unscaledDeltaTime;
                float y = bannerT < 0.4f ? Mathf.Lerp(150, -190, Ease.OutBack(bannerT / 0.4f)) : bannerT < 2.6f ? -190 : Mathf.Lerp(-190, 200, (bannerT - 2.6f) / 0.4f);
                bannerRt.anchoredPosition = new Vector2(0, y);
                bannerRt.localRotation = Quaternion.Euler(0, 0, Mathf.Sin(bannerT * 6) * 2 * Mathf.Exp(-bannerT));
                if (bannerT > 3) { bannerT = -1; bannerRt.gameObject.SetActive(false); }
            }
        }

        public void SetBubbleWorld(Vector3 w) => bubbleWorld = w;

        public static Texture2D[] NextGulps(int tier)
        {
            if (tier >= Snake.TIERS.Length) return null;
            var list = new List<Texture2D>();
            foreach (AnimalKind k in Enum.GetValues(typeof(AnimalKind)))
                if (Animals.SPECS[(int)k].tier == tier) list.Add(Icons.Animal(k));
            return list.ToArray();
        }
    }

    /// <summary>A gentle idle bob, so the title and the banners feel alive.</summary>
    public sealed class Bob : MonoBehaviour
    {
        public float Amount = 6;
        Vector2 home;
        float phase;
        RectTransform rt;
        void Start() { rt = (RectTransform)transform; home = rt.anchoredPosition; phase = UnityEngine.Random.value * 6; }
        void Update() { if (rt) rt.anchoredPosition = home + Vector2.up * Mathf.Sin(Time.unscaledTime * 2.2f + phase) * Amount; }
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
