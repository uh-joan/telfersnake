using Telfer.Sim;
using Telfer.View;
using UnityEngine;
using UnityEngine.UI;

namespace Telfer.UI
{
    /// <summary>
    /// London's bits of the HUD (hud.ts): the Crown Jewels counter beside the gems (five gem slots, a crown at
    /// five), a tourist's camera flash, and the Tube's little map with its tunnel whoosh when you take a train.
    /// </summary>
    public sealed partial class Hud
    {
        RectTransform jewelPill, tubeRt;
        readonly Image[] jewelSlots = new Image[Treasures.KINDS];
        Image crownMark, flashImg, whooshImg;
        int lastJewels = -1;
        float flashT, tubeT;
        const float TUBE_FOR = 2.6f;

        void BuildJewels()
        {
            jewelPill = UiKit.Rect(game, "jewels", new Vector2(0, 1), new Vector2(0, 1), new Vector2(0, 1), new Vector2(186, -196), new Vector2(214, 58));
            UiKit.Shadow(jewelPill, 12, 0.2f);
            UiKit.Panel(jewelPill, "bg", Cream, 29);
            crownMark = UiKit.Image(jewelPill, "crown", UiKit.Gem, new Color(1f, 0.82f, 0.2f));
            var cr = (RectTransform)crownMark.transform;
            cr.anchorMin = cr.anchorMax = new Vector2(0, 0.5f); cr.sizeDelta = new Vector2(30, 30); cr.anchoredPosition = new Vector2(26, 0);
            for (int i = 0; i < jewelSlots.Length; i++)
            {
                var img = UiKit.Image(jewelPill, "slot", UiKit.Circle, Color.white);
                var rt = (RectTransform)img.transform;
                rt.anchorMin = rt.anchorMax = new Vector2(0, 0.5f); rt.sizeDelta = new Vector2(28, 28); rt.anchoredPosition = new Vector2(62 + i * 34, 0);
                jewelSlots[i] = img;
            }
            jewelPill.gameObject.SetActive(false);
        }

        void BuildLondonOverlays()
        {
            // The camera flash: a white wash over everything, gone in a blink.
            var f = UiKit.Fill(rootRt, "flash");
            flashImg = f.gameObject.AddComponent<Image>();
            flashImg.color = new Color(1, 1, 1, 0);
            flashImg.raycastTarget = false;
            // The Tube: a dark tunnel whoosh, and the little line map across the middle.
            var w = UiKit.Fill(rootRt, "whoosh");
            whooshImg = w.gameObject.AddComponent<Image>();
            whooshImg.color = new Color(0.05f, 0.06f, 0.12f, 0);
            whooshImg.raycastTarget = false;
            tubeRt = UiKit.Rect(rootRt, "tube-map", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, 60), new Vector2(1000, 200));
            tubeRt.gameObject.SetActive(false);
            flashImg.transform.SetAsLastSibling();
        }

        /// <summary>A tourist took your picture: CLICK! A white flash.</summary>
        public void Flash() => flashT = 0.35f;

        /// <summary>Down the Tube at `from`, up at `to`: the whoosh, and the line with the two stations lit.</summary>
        public void Tube(string[] names, int from, int to)
        {
            foreach (Transform c in tubeRt) Destroy(c.gameObject);
            var bg = UiKit.Panel(tubeRt, "bg", new Color(1, 1, 1, 0.94f), 26);
            ((RectTransform)bg.transform).offsetMin = Vector2.zero;
            var line = UiKit.Image(tubeRt, "line", null, new Color(0.86f, 0.14f, 0.12f));
            var lr = (RectTransform)line.transform;
            lr.anchorMin = lr.anchorMax = new Vector2(0.5f, 0.62f); lr.sizeDelta = new Vector2(860, 14);
            int n = names.Length;
            for (int i = 0; i < n; i++)
            {
                float x = -430 + 860f * i / Mathf.Max(1, n - 1);
                bool lit = i == from || i == to;
                var dot = UiKit.Image(tubeRt, "stop", UiKit.Circle, lit ? new Color(0.11f, 0.16f, 0.55f) : Color.white);
                var dr = (RectTransform)dot.transform;
                dr.anchorMin = dr.anchorMax = new Vector2(0.5f, 0.62f); dr.sizeDelta = Vector2.one * (lit ? 44 : 30); dr.anchoredPosition = new Vector2(x, 0);
                var ring = dot.gameObject.AddComponent<Outline>();
                ring.effectColor = new Color(0.11f, 0.16f, 0.55f); ring.effectDistance = new Vector2(3, -3);
                var lbl = UiKit.Rect(tubeRt, "name", new Vector2(0.5f, 0.62f), new Vector2(0.5f, 0.62f), new Vector2(0.5f, 1), new Vector2(x, -32), new Vector2(170, 40));
                UiKit.Label(lbl, "t", names[i], lit ? 24 : 19, lit ? new Color(0.11f, 0.16f, 0.55f) : Ink);
            }
            tubeT = TUBE_FOR;
        }

        void SyncLondon(World w, float dt)
        {
            var me = w.Me;
            bool jewels = w.Treasures.Count > 0;
            jewelPill.gameObject.SetActive(jewels);
            if (jewels && me.jewels != lastJewels)
            {
                if (lastJewels >= 0 && me.jewels > lastJewels) jewelPill.localScale = Vector3.one * 1.3f;
                lastJewels = me.jewels;
                for (int i = 0; i < jewelSlots.Length; i++)
                    jewelSlots[i].color = i < me.jewels ? MeshKit.Hex(ModelsLondonZoo.JEWEL_COLOURS[i]) : new Color(0.85f, 0.83f, 0.8f);
                crownMark.color = me.crowned ? new Color(1f, 0.78f, 0.1f) : new Color(0.8f, 0.75f, 0.6f);
            }
            jewelPill.localScale = Vector3.Lerp(jewelPill.localScale, Vector3.one, 1 - Mathf.Exp(-dt * 10));

            flashT = Mathf.Max(0, flashT - dt);
            flashImg.color = new Color(1, 1, 1, Mathf.Clamp01(flashT / 0.35f) * 0.6f);
            tubeT = Mathf.Max(0, tubeT - dt);
            tubeRt.gameObject.SetActive(tubeT > 0);
            float u = 1 - tubeT / TUBE_FOR;
            // In: the tunnel closes over you; out: daylight again, the map lingering a little longer.
            whooshImg.color = new Color(0.05f, 0.06f, 0.12f, tubeT > 0 ? Mathf.Clamp01(Mathf.Sin(Mathf.Min(1, u * 2.2f) * Mathf.PI)) * 0.8f : 0);
            if (tubeT > 0) tubeRt.localScale = Vector3.one * (0.9f + 0.1f * Mathf.Min(1, u * 6));
        }
    }
}
