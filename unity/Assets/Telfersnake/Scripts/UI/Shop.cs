using System;
using System.Collections.Generic;
using Telfer.Meta;
using UnityEngine;
using UnityEngine.UI;

namespace Telfer.UI
{
    /// <summary>
    /// The Tuck Shop: skins, hats and trails, paid for in stars (and, for the Common-only forest looks,
    /// blue gems). Pictures first: every tile is the real thing, rendered in 3D. Tap to buy, tap again to
    /// wear. Gem items only appear once the Common is unlocked.
    /// </summary>
    public sealed class Shop
    {
        static readonly Color Ink = new Color(0.13f, 0.15f, 0.22f);
        static readonly Color Cream = new Color(1f, 0.99f, 0.96f, 0.97f);
        static readonly Color Yellow = new Color(1f, 0.83f, 0.23f);
        static readonly Color GemBlue = new Color(0.35f, 0.7f, 1f);
        static readonly Color Green = new Color(0.3f, 0.75f, 0.29f);

        RectTransform layer, grid, frame, box, stageRt, previewRt, walletRt, view;
        readonly RectTransform[] tabRts = new RectTransform[3];
        RawImage preview;
        Text stars, gems;
        ItemKind tab = ItemKind.Skin;
        readonly Image[] tabs = new Image[3];
        Action onClose;
        public bool IsOpen => layer != null;

        Profile P => Profile.I;

        public void Open(RectTransform root, Action closed)
        {
            onClose = closed;
            if (layer) UnityEngine.Object.Destroy(layer.gameObject);
            layer = UiKit.Fill(root, "Shop");
            var dim = UiKit.Panel(layer, "dim", new Color(0.05f, 0.08f, 0.18f, 0.62f), 0);
            dim.raycastTarget = true;
            // The box sits in a frame that Layout moves and scales (the box itself flips in).
            frame = UiKit.Rect(layer, "frame", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            box = UiKit.Rect(frame, "box", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(1440, 800));
            box.gameObject.AddComponent<CardIntro>();
            UiKit.Shadow(box, 36, 0.45f);
            UiKit.Panel(box, "bg", UiKit.Sheet, 48);

            var title = UiKit.Rect(box, "title", new Vector2(0, 1), new Vector2(0, 1), new Vector2(0, 1), new Vector2(40, -20), new Vector2(500, 90));
            UiKit.Label(title, "t", "Tuck Shop", 64, Ink, TextAnchor.MiddleLeft);

            // You, in your current look, on a little stage.
            var stage = stageRt = UiKit.Rect(box, "stage", new Vector2(0, 0), new Vector2(0, 0), new Vector2(0, 0), new Vector2(40, 40), new Vector2(380, 560));
            UiKit.Panel(stage, "bg", new Color(1f, 0.6f, 0.75f, 0.35f), 40);
            var pv = previewRt = UiKit.Rect(stage, "you", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, 60), new Vector2(340, 340));
            preview = pv.gameObject.AddComponent<RawImage>();
            pv.gameObject.AddComponent<Bob>().Amount = 6;
            var wallet = walletRt = UiKit.Rect(stage, "wallet", new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 24), new Vector2(330, 70));
            UiKit.Panel(wallet, "bg", Cream, 35);
            var ws = UiKit.Image(wallet, "star", UiKit.Star, Yellow);
            Place(ws, new Vector2(38, 0), 46);
            stars = UiKit.Label(wallet, "stars", "", 34, Ink, TextAnchor.MiddleLeft);
            ((RectTransform)stars.transform).offsetMin = new Vector2(68, 0); ((RectTransform)stars.transform).offsetMax = new Vector2(-170, 0);
            var wg = UiKit.Image(wallet, "gem", UiKit.Gem, GemBlue);
            Place(wg, new Vector2(196, 0), 42);
            gems = UiKit.Label(wallet, "gems", "", 34, Ink, TextAnchor.MiddleLeft);
            ((RectTransform)gems.transform).offsetMin = new Vector2(222, 0);

            // Tabs: skins, hats, trails.
            string[] names = { "Skins", "Hats", "Trails" };
            for (int i = 0; i < 3; i++)
            {
                var k = (ItemKind)i;
                var rt = tabRts[i] = UiKit.Rect(box, names[i], new Vector2(0, 1), new Vector2(0, 1), new Vector2(0, 1), new Vector2(460 + i * 210, -30), new Vector2(190, 70));
                var b = UiKit.Button(rt, "btn", Cream, 35, () => { tab = k; Audio.Synth.I?.Play("pick"); Fill(); });
                tabs[i] = b.GetComponent<Image>();
                UiKit.Label(b.transform, "t", names[i], 32, Ink);
            }

            var close = UiKit.Rect(box, "close", new Vector2(1, 1), new Vector2(1, 1), new Vector2(0.5f, 0.5f), new Vector2(-50, -50), new Vector2(80, 80));
            var cb = UiKit.Button(close, "btn", new Color(1f, 0.45f, 0.45f), 40, Close);
            UiKit.Label(cb.transform, "x", "X", 40, Color.white);

            // The scrolling grid.
            view = UiKit.Rect(box, "view", new Vector2(0, 0), new Vector2(1, 1), new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            var vimg = view.gameObject.AddComponent<Image>();
            vimg.color = new Color(0.1f, 0.3f, 0.6f, 0.12f);
            view.gameObject.AddComponent<Mask>().showMaskGraphic = true;
            grid = UiKit.Rect(view, "grid", new Vector2(0, 1), new Vector2(1, 1), new Vector2(0.5f, 1), Vector2.zero, new Vector2(0, 0));
            var layout = grid.gameObject.AddComponent<GridLayoutGroup>();
            layout.cellSize = new Vector2(220, 250);
            layout.spacing = new Vector2(16, 16);
            layout.padding = new RectOffset(16, 16, 16, 16);
            layout.childAlignment = TextAnchor.UpperLeft;
            grid.gameObject.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            var scroll = view.gameObject.AddComponent<ScrollRect>();
            scroll.content = grid;
            scroll.horizontal = false;
            scroll.movementType = ScrollRect.MovementType.Elastic;
            scroll.scrollSensitivity = 40;
            Layout(root.GetComponent<Fit>());
            Fill();
        }

        /// <summary>
        /// Fit the shop to the screen: you on the left of the grid when it is wide, across the top
        /// (with the tabs under you) when it is tall.
        /// </summary>
        public void Layout(Fit fit)
        {
            if (!layer || fit == null) return;
            bool tall = fit.Portrait;
            var safe = fit.Safe.size;
            var size = tall ? new Vector2(Mathf.Min(880, safe.x - 20), Mathf.Min(1640, safe.y - 30)) : new Vector2(1440, 800);
            if (frame.Find("box-shadow") is RectTransform sh) sh.sizeDelta = size + (sh.sizeDelta - box.sizeDelta);
            box.sizeDelta = size;
            float stageW = size.x - 80;
            stageRt.anchorMin = stageRt.anchorMax = stageRt.pivot = tall ? new Vector2(0, 1) : Vector2.zero;
            stageRt.anchoredPosition = tall ? new Vector2(40, -120) : new Vector2(40, 40);
            stageRt.sizeDelta = tall ? new Vector2(stageW, 280) : new Vector2(380, 560);
            var pv = tall ? new Vector2(-stageW / 4, 0) : new Vector2(0, 60);
            previewRt.anchoredPosition = pv;
            previewRt.GetComponent<Bob>().Home = pv;
            previewRt.sizeDelta = Vector2.one * (tall ? 270 : 340);
            walletRt.anchoredPosition = tall ? new Vector2(stageW / 4, 105) : new Vector2(0, 24);
            for (int i = 0; i < 3; i++) tabRts[i].anchoredPosition = tall ? new Vector2(40 + i * 210, -430) : new Vector2(460 + i * 210, -30);
            view.offsetMin = new Vector2(tall ? 40 : 450, 40);
            view.offsetMax = new Vector2(-40, tall ? -520 : -120);
            frame.anchoredPosition = fit.Safe.center - fit.Units / 2;
            frame.localScale = Vector3.one * Mathf.Min(1, (safe.x - 30) / (size.x + 20), (safe.y - 20) / (size.y + 20));
        }

        static void Place(Graphic g, Vector2 pos, float size)
        {
            var r = (RectTransform)g.transform;
            r.anchorMin = r.anchorMax = new Vector2(0, 0.5f);
            r.sizeDelta = new Vector2(size, size);
            r.anchoredPosition = pos;
        }

        public void Close()
        {
            Audio.Synth.I?.Play("pick");
            if (layer) UnityEngine.Object.Destroy(layer.gameObject);
            layer = null;
            onClose?.Invoke();
        }

        string Wearing(ItemKind k) => k == ItemKind.Skin ? P.skin : k == ItemKind.Hat ? P.hat : P.trail;

        void Fill()
        {
            foreach (Transform c in grid) UnityEngine.Object.Destroy(c.gameObject);
            for (int i = 0; i < 3; i++)
            {
                bool on = (int)tab == i;
                tabs[i].color = on ? Green : Color.white;
                tabs[i].GetComponentInChildren<Text>().color = on ? Color.white : Ink;
            }
            stars.text = P.stars.ToString("N0");
            gems.text = P.gems.ToString("N0");
            preview.texture = Icons.Skin(P.skin, P.hat);

            var items = new List<Item>(Catalogue.Of(tab));
            // Free first, then cheapest; the forest (gem) looks last, and only once the Common is open.
            items.RemoveAll(it => it.gem && !P.commonUnlocked);
            items.Sort((a, b) => a.gem != b.gem ? (a.gem ? 1 : -1) : a.price.CompareTo(b.price));
            foreach (var it in items) Tile(it);
        }

        void Tile(Item it)
        {
            bool owned = P.Owns(it.id) || it.price == 0;
            bool wearing = Wearing(it.kind) == it.id;
            var rt = UiKit.Rect(grid, it.id, Vector2.zero, Vector2.zero, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(220, 250));
            var b = UiKit.Button(rt, "btn", wearing ? new Color(0.75f, 0.95f, 0.7f) : Color.white, 26, () => Tap(it, rt));
            var well = UiKit.Image(b.transform, "well", UiKit.Circle, wearing ? new Color(1, 1, 1, 0.6f) : UiKit.Well);
            var wr = (RectTransform)well.transform;
            wr.anchorMin = wr.anchorMax = new Vector2(0.5f, 1);
            wr.sizeDelta = new Vector2(150, 150);
            wr.anchoredPosition = new Vector2(0, -91); // behind the centre of the picture below
            var pic = UiKit.Rect(b.transform, "pic", new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -6), new Vector2(170, 170));
            if (it.kind == ItemKind.Trail) Swatch(pic, it.palette);
            else
            {
                var raw = pic.gameObject.AddComponent<RawImage>();
                raw.texture = it.kind == ItemKind.Skin ? Icons.Skin(it.id, null) : it.id == "no-hat" ? Icons.Skin(P.skin, null) : Icons.Hat(it.id);
                raw.raycastTarget = false;
            }
            var name = UiKit.Rect(b.transform, "name", new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 50), new Vector2(210, 32));
            UiKit.Label(name, "t", it.name, 22, Ink);
            var price = UiKit.Rect(b.transform, "price", new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 8), new Vector2(150, 40));
            if (wearing)
            {
                UiKit.Panel(price, "bg", Green, 20);
                UiKit.Label(price, "t", "On", 26, Color.white);
            }
            else if (owned)
            {
                UiKit.Panel(price, "bg", new Color(0.35f, 0.65f, 1f), 20);
                UiKit.Label(price, "t", "Wear", 26, Color.white);
            }
            else
            {
                bool afford = it.gem ? P.gems >= it.price : P.stars >= it.price;
                UiKit.Panel(price, "bg", afford ? Yellow : new Color(0, 0, 0, 0.12f), 20);
                var icon = UiKit.Image(price, "i", it.gem ? UiKit.Gem : UiKit.Star, it.gem ? GemBlue : (afford ? Ink : Yellow));
                Place(icon, new Vector2(26, 0), 30);
                var t = UiKit.Label(price, "t", it.price.ToString("N0"), 26, Ink);
                ((RectTransform)t.transform).offsetMin = new Vector2(30, 0);
            }
        }

        static void Swatch(RectTransform pic, uint[] palette)
        {
            if (palette == null || palette.Length == 0)
            {
                UiKit.Label(pic, "none", "-", 80, new Color(0, 0, 0, 0.25f));
                return;
            }
            var rng = new System.Random(palette.Length * 7 + (int)palette[0]);
            for (int i = 0; i < 22; i++)
            {
                var c = View.MeshKit.Hex(palette[i % palette.Length]);
                var dot = UiKit.Image(pic, "dot", i % 3 == 0 ? UiKit.Star : UiKit.Circle, c);
                var r = (RectTransform)dot.transform;
                r.anchorMin = r.anchorMax = new Vector2(0.5f, 0.5f);
                float s = 14 + (float)rng.NextDouble() * 26;
                r.sizeDelta = new Vector2(s, s);
                float a = (float)rng.NextDouble() * Mathf.PI * 2, d = (float)rng.NextDouble() * 70;
                r.anchoredPosition = new Vector2(Mathf.Cos(a) * d, Mathf.Sin(a) * d);
                dot.gameObject.AddComponent<Bob>().Amount = 3 + (float)rng.NextDouble() * 4;
            }
        }

        void Tap(Item it, RectTransform tile)
        {
            bool owned = P.Owns(it.id) || it.price == 0;
            if (!owned)
            {
                bool afford = it.gem ? P.gems >= it.price : P.stars >= it.price;
                if (!afford)
                {
                    Audio.Synth.I?.Play("nope");
                    tile.gameObject.AddComponent<Shake>();
                    return;
                }
                if (it.gem) P.gems -= it.price; else P.stars -= it.price;
                P.owned.Add(it.id);
                Audio.Synth.I?.Play("chaChing");
            }
            else Audio.Synth.I?.Play("pick");
            if (it.kind == ItemKind.Skin) P.skin = it.id;
            else if (it.kind == ItemKind.Hat) P.hat = it.id;
            else P.trail = it.id;
            P.Save();
            Fill();
        }
    }
}
