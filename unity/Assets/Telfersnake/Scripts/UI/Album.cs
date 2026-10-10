using System;
using System.Collections.Generic;
using Telfer.Meta;
using UnityEngine;
using UnityEngine.UI;

namespace Telfer.UI
{
    /// <summary>
    /// The Postcard Album (album.ts): London's postcards pinned up on a corkboard, the sights first, then the
    /// rare ones. A card not found yet is a grey silhouette. Tap a card to see it big; tap again to put it back.
    /// The pictures are photographs of the HD landmarks, taken a card per frame so opening never stalls.
    /// </summary>
    public sealed class Album
    {
        static readonly Color Ink = new Color(0.13f, 0.15f, 0.22f);
        static readonly Color Cork = new Color(0.78f, 0.6f, 0.4f);
        static readonly Color Frame = new Color(0.55f, 0.36f, 0.2f);
        static readonly float[] TILT = { -3, 2, -1.5f, 3, -2.5f, 1.5f };

        RectTransform layer, frame, box, view, grid, zoom;
        Text count;
        Action onClose;
        readonly List<(Postcards.Card card, RawImage art, bool owned)> tiles = new List<(Postcards.Card, RawImage, bool)>();
        int next;
        public bool IsOpen => layer != null;

        public void Open(RectTransform root, Action closed)
        {
            onClose = closed;
            if (layer) UnityEngine.Object.Destroy(layer.gameObject);
            var p = Profile.I;
            p.Refresh(); // cards the web game (another tab) kept since this one loaded
            var have = new HashSet<string>(p.postcards);
            layer = UiKit.Fill(root, "Album");
            var dim = UiKit.Panel(layer, "dim", new Color(0.05f, 0.08f, 0.18f, 0.62f), 0);
            dim.raycastTarget = true;
            frame = UiKit.Rect(layer, "frame", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            box = UiKit.Rect(frame, "box", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(1440, 820));
            box.gameObject.AddComponent<CardIntro>();
            UiKit.Shadow(box, 36, 0.45f);
            // The corkboard in its wooden frame.
            UiKit.Panel(box, "frame", Frame, 40);
            var cork = UiKit.Panel(box, "cork", Color.white, 28);
            cork.sprite = CorkSprite();
            cork.type = Image.Type.Tiled;
            cork.color = Cork;
            ((RectTransform)cork.transform).offsetMin = new Vector2(18, 18);
            ((RectTransform)cork.transform).offsetMax = new Vector2(-18, -18);

            // A title ribbon: the postmark and how many are kept.
            var head = UiKit.Rect(box, "head", new Vector2(0, 1), new Vector2(0, 1), new Vector2(0, 1), new Vector2(40, -30), new Vector2(520, 84));
            UiKit.Panel(head, "bg", new Color(0.85f, 0.2f, 0.17f), 42);
            var mail = UiKit.Rect(head, "mail", new Vector2(0, 0.5f), new Vector2(0, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(46, 0), new Vector2(60, 60));
            UiKit.Panel(mail, "env", new Color(1f, 0.98f, 0.92f), 8);
            var star = UiKit.Image(mail, "star", UiKit.Star, new Color(0.85f, 0.2f, 0.17f));
            ((RectTransform)star.transform).offsetMin = new Vector2(10, 10); ((RectTransform)star.transform).offsetMax = new Vector2(-10, -10);
            UiKit.Label(head, "t", "Postcards", 44, Color.white, TextAnchor.MiddleCenter, 2);
            int found = 0;
            foreach (var c in Postcards.LANDMARKS) if (have.Contains(c.id)) found++;
            foreach (var c in Postcards.RARE) if (have.Contains(c.id)) found++;
            var cnt = UiKit.Rect(head, "count", new Vector2(1, 0.5f), new Vector2(1, 0.5f), new Vector2(1, 0.5f), new Vector2(-24, 0), new Vector2(120, 60));
            UiKit.Panel(cnt, "bg", new Color(1f, 0.98f, 0.92f), 30);
            count = UiKit.Label(cnt, "n", found + "/" + Postcards.Count, 32, Ink);

            var close = UiKit.Rect(box, "close", new Vector2(1, 1), new Vector2(1, 1), new Vector2(0.5f, 0.5f), new Vector2(-56, -56), new Vector2(80, 80));
            var cb = UiKit.Button(close, "btn", new Color(1f, 0.45f, 0.45f), 40, Close);
            UiKit.Label(cb.transform, "x", "X", 40, Color.white);

            // The scrolling board of cards.
            view = UiKit.Rect(box, "view", new Vector2(0, 0), new Vector2(1, 1), new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            var vimg = view.gameObject.AddComponent<Image>();
            vimg.color = new Color(0, 0, 0, 0.01f);
            view.gameObject.AddComponent<RectMask2D>();
            grid = UiKit.Rect(view, "grid", new Vector2(0, 1), new Vector2(1, 1), new Vector2(0.5f, 1), Vector2.zero, Vector2.zero);
            var layout = grid.gameObject.AddComponent<GridLayoutGroup>();
            layout.cellSize = new Vector2(250, 220);
            layout.spacing = new Vector2(22, 24);
            layout.padding = new RectOffset(20, 20, 24, 24);
            layout.childAlignment = TextAnchor.UpperCenter;
            grid.gameObject.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            var scroll = view.gameObject.AddComponent<ScrollRect>();
            scroll.content = grid;
            scroll.horizontal = false;
            scroll.movementType = ScrollRect.MovementType.Elastic;
            scroll.scrollSensitivity = 40;

            tiles.Clear();
            next = 0;
            int i = 0;
            foreach (var c in Postcards.LANDMARKS) Tile(c, have.Contains(c.id), i++);
            foreach (var c in Postcards.RARE) Tile(c, have.Contains(c.id), i++);
            layer.gameObject.AddComponent<Painter>().album = this;
            Layout(root.GetComponent<Fit>());
        }

        void Tile(Postcards.Card card, bool owned, int i)
        {
            var cell = UiKit.Rect(grid, card.id, Vector2.zero, Vector2.zero, new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            var tilt = UiKit.Rect(cell, "tilt", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(236, 200));
            tilt.localRotation = Quaternion.Euler(0, 0, TILT[i % TILT.Length]);
            UiKit.Shadow(tilt, 10, 0.35f, new Vector2(4, -6));
            // The card: white with a border, gold for a rare one.
            var b = UiKit.Button(tilt, "card", card.rare ? new Color(1f, 0.84f, 0.3f) : new Color(1f, 0.99f, 0.95f), 10, () => Zoom(card, owned));
            var artRt = UiKit.Rect(b.transform, "art", Vector2.zero, Vector2.one, new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            artRt.offsetMin = new Vector2(10, 38); artRt.offsetMax = new Vector2(-10, -10);
            var art = artRt.gameObject.AddComponent<RawImage>();
            art.raycastTarget = false;
            art.color = owned ? Color.white : new Color(0.3f, 0.29f, 0.28f, 1);
            // The ribbon: its name, or a question mark until it is found.
            var name = UiKit.Rect(b.transform, "name", new Vector2(0, 0), new Vector2(1, 0), new Vector2(0.5f, 0), new Vector2(0, 4), new Vector2(-16, 32));
            UiKit.Label(name, "t", owned ? card.name : "?", owned ? (card.name.Length > 10 ? 20 : 24) : 28, owned ? Ink : new Color(0.5f, 0.48f, 0.45f));
            if (owned && Postcards.Sticker(card.id) is Texture st)
            {
                var sr = UiKit.Rect(b.transform, "sticker", new Vector2(1, 1), new Vector2(1, 1), new Vector2(0.5f, 0.5f), new Vector2(-30, -34), new Vector2(76, 76));
                sr.localRotation = Quaternion.Euler(0, 0, -12);
                var sti = sr.gameObject.AddComponent<RawImage>();
                sti.texture = st;
                sti.raycastTarget = false;
            }
            // A red drawing pin at the top.
            var pin = UiKit.Image(tilt, "pin", UiKit.Circle, new Color(0.85f, 0.18f, 0.2f));
            var pr = (RectTransform)pin.transform;
            pr.anchorMin = pr.anchorMax = new Vector2(0.5f, 1); pr.sizeDelta = new Vector2(30, 30); pr.anchoredPosition = new Vector2(0, -4);
            var shine = UiKit.Image(pin.transform, "shine", UiKit.Circle, new Color(1, 1, 1, 0.6f));
            var shr = (RectTransform)shine.transform; shr.anchorMin = shr.anchorMax = new Vector2(0.35f, 0.65f); shr.sizeDelta = new Vector2(9, 9);
            tiles.Add((card, art, owned));
        }

        /// <summary>One picture per frame (each is a render of London), so the board fills in smoothly.</summary>
        void PaintNext()
        {
            if (next >= tiles.Count) return;
            var (card, art, _) = tiles[next++];
            if (art) art.texture = Postcards.Art(card.id);
        }

        void Zoom(Postcards.Card card, bool owned)
        {
            Audio.Synth.I?.Play("pick");
            if (zoom) UnityEngine.Object.Destroy(zoom.gameObject);
            zoom = UiKit.Fill(layer, "zoom");
            var dim = UiKit.Button(zoom, "dim", new Color(0.05f, 0.08f, 0.18f, 0.55f), 0, Unzoom);
            dim.GetComponent<Springy>().enabled = false;
            var big = UiKit.Rect(zoom, "big", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(760, 610));
            big.gameObject.AddComponent<CardIntro>();
            UiKit.Shadow(big, 30, 0.4f);
            var b = UiKit.Button(big, "card", card.rare ? new Color(1f, 0.84f, 0.3f) : new Color(1f, 0.99f, 0.95f), 18, Unzoom);
            var artRt = UiKit.Rect(b.transform, "art", Vector2.zero, Vector2.one, new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            artRt.offsetMin = new Vector2(24, 90); artRt.offsetMax = new Vector2(-24, -24);
            var art = artRt.gameObject.AddComponent<RawImage>();
            art.raycastTarget = false;
            art.texture = Postcards.Art(card.id);
            art.color = owned ? Color.white : new Color(0.3f, 0.29f, 0.28f, 1);
            var name = UiKit.Rect(b.transform, "name", new Vector2(0, 0), new Vector2(1, 0), new Vector2(0.5f, 0), new Vector2(0, 14), new Vector2(-40, 64));
            UiKit.Label(name, "t", owned ? card.name : "?", 52, owned ? Ink : new Color(0.5f, 0.48f, 0.45f));
            if (owned && Postcards.Sticker(card.id) is Texture st)
            {
                var sr = UiKit.Rect(b.transform, "sticker", new Vector2(1, 1), new Vector2(1, 1), new Vector2(0.5f, 0.5f), new Vector2(-80, -80), new Vector2(190, 190));
                sr.localRotation = Quaternion.Euler(0, 0, -12);
                var sti = sr.gameObject.AddComponent<RawImage>();
                sti.texture = st;
                sti.raycastTarget = false;
            }
            Layout(layer.parent.GetComponent<Fit>());
        }

        void Unzoom()
        {
            if (!zoom) return;
            Audio.Synth.I?.Play("pick");
            UnityEngine.Object.Destroy(zoom.gameObject);
            zoom = null;
        }

        public void Close()
        {
            if (!layer) return;
            Audio.Synth.I?.Play("pick");
            UnityEngine.Object.Destroy(layer.gameObject);
            layer = null;
            zoom = null;
            tiles.Clear();
            onClose?.Invoke();
        }

        /// <summary>Fit the board to the screen: wide, four or five across; upright, two or three across and tall.</summary>
        public void Layout(Fit fit)
        {
            if (!layer || fit == null) return;
            bool tall = fit.Portrait;
            var safe = fit.Safe.size;
            var size = tall ? new Vector2(Mathf.Min(880, safe.x - 20), Mathf.Min(1640, safe.y - 30)) : new Vector2(1440, 820);
            if (frame.Find("box-shadow") is RectTransform sh) sh.sizeDelta = size + (sh.sizeDelta - box.sizeDelta);
            box.sizeDelta = size;
            view.offsetMin = new Vector2(30, 30);
            view.offsetMax = new Vector2(-30, -130);
            frame.anchoredPosition = fit.Safe.center - fit.Units / 2;
            frame.localScale = Vector3.one * Mathf.Min(1, (safe.x - 30) / (size.x + 20), (safe.y - 20) / (size.y + 20));
            if (zoom && zoom.Find("big") is RectTransform big)
            {
                big.anchoredPosition = fit.Safe.center - fit.Units / 2;
                big.localScale = Vector3.one * Mathf.Min(1, (safe.x - 40) / 780, (safe.y - 40) / 630);
            }
        }

        static Sprite cork;
        /// <summary>Cork: a warm tan speckled with darker and lighter grains (tiled).</summary>
        static Sprite CorkSprite()
        {
            if (cork) return cork;
            const int N = 128;
            var t = new Texture2D(N, N, TextureFormat.RGBA32, false) { filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Repeat };
            var px = new Color32[N * N];
            var rng = new System.Random(7);
            for (int i = 0; i < px.Length; i++)
            {
                float v = 0.9f + (float)rng.NextDouble() * 0.12f;
                px[i] = new Color32((byte)(255 * v), (byte)(255 * v), (byte)(255 * v), 255);
            }
            for (int k = 0; k < 420; k++)
            {
                int x = rng.Next(N), y = rng.Next(N);
                float v = rng.NextDouble() < 0.6 ? 0.62f : 1f;
                for (int dy = 0; dy < 2; dy++)
                    for (int dx = 0; dx < 2; dx++)
                        px[((y + dy) % N) * N + (x + dx) % N] = new Color32((byte)(255 * v), (byte)(255 * v * 0.96f), (byte)(255 * v * 0.9f), 255);
            }
            t.SetPixels32(px);
            t.Apply();
            return cork = Sprite.Create(t, new Rect(0, 0, N, N), new Vector2(0.5f, 0.5f), 100, 0, SpriteMeshType.FullRect);
        }

        sealed class Painter : MonoBehaviour
        {
            public Album album;
            void Update() => album?.PaintNext();
        }
    }
}
