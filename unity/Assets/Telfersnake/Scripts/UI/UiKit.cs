using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Telfer.UI
{
    /// <summary>Builds UGUI from code: rounded panels, chunky outlined labels, springy buttons.</summary>
    public static class UiKit
    {
        static Font font;
        public static Font Font => font ? font : (font = Resources.Load<Font>("Fredoka-Bold") ?? Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf"));

        static readonly Dictionary<int, Sprite> rounded = new Dictionary<int, Sprite>();
        static Sprite circle, ring, bolt, softShadow, play, star, gem, pals, me, dice, signal;

        /// <summary>A white rounded-rect sprite, 9-sliced, with an anti-aliased edge.</summary>
        public static Sprite Rounded(int radius)
        {
            if (rounded.TryGetValue(radius, out var s)) return s;
            int size = radius * 2 + 4;
            var t = new Texture2D(size, size, TextureFormat.RGBA32, false) { filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp };
            var px = new Color32[size * size];
            float c = size / 2f;
            for (int y = 0; y < size; y++)
                for (int x = 0; x < size; x++)
                {
                    float qx = Mathf.Abs(x + 0.5f - c) - (c - radius), qy = Mathf.Abs(y + 0.5f - c) - (c - radius);
                    float d = Mathf.Sqrt(Mathf.Max(qx, 0) * Mathf.Max(qx, 0) + Mathf.Max(qy, 0) * Mathf.Max(qy, 0)) + Mathf.Min(Mathf.Max(qx, qy), 0) - radius + 2;
                    byte a = (byte)(Mathf.Clamp01(0.5f - d) * 255);
                    px[y * size + x] = new Color32(255, 255, 255, a);
                }
            t.SetPixels32(px);
            t.Apply();
            s = Sprite.Create(t, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100, 0, SpriteMeshType.FullRect, new Vector4(radius + 2, radius + 2, radius + 2, radius + 2));
            rounded[radius] = s;
            return s;
        }

        static Sprite Draw(int size, Func<float, float, float> sdf)
        {
            var t = new Texture2D(size, size, TextureFormat.RGBA32, true) { filterMode = FilterMode.Trilinear, wrapMode = TextureWrapMode.Clamp };
            var px = new Color32[size * size];
            for (int y = 0; y < size; y++)
                for (int x = 0; x < size; x++)
                {
                    float u = (x + 0.5f) / size * 2 - 1, v = (y + 0.5f) / size * 2 - 1;
                    float d = sdf(u, v) * size / 2;
                    px[y * size + x] = new Color32(255, 255, 255, (byte)(Mathf.Clamp01(0.5f - d) * 255));
                }
            t.SetPixels32(px);
            t.Apply(true);
            return Sprite.Create(t, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100);
        }

        public static Sprite Circle => circle ? circle : (circle = Draw(128, (u, v) => Mathf.Sqrt(u * u + v * v) - 0.97f));
        public static Sprite Ring => ring ? ring : (ring = Draw(128, (u, v) => Mathf.Abs(Mathf.Sqrt(u * u + v * v) - 0.85f) - 0.1f));
        public static Sprite SoftShadow => softShadow ? softShadow : (softShadow = SoftBlob());

        static Sprite SoftBlob()
        {
            const int S = 64;
            var t = new Texture2D(S, S, TextureFormat.RGBA32, false);
            var px = new Color32[S * S];
            for (int y = 0; y < S; y++)
                for (int x = 0; x < S; x++)
                {
                    float u = (x + 0.5f) / S * 2 - 1, v = (y + 0.5f) / S * 2 - 1;
                    float a = Mathf.Clamp01(1 - Mathf.Sqrt(u * u + v * v));
                    px[y * S + x] = new Color32(0, 0, 0, (byte)(a * a * 255));
                }
            t.SetPixels32(px);
            t.Apply();
            return Sprite.Create(t, new Rect(0, 0, S, S), new Vector2(0.5f, 0.5f), 100, 0, SpriteMeshType.FullRect, new Vector4(24, 24, 24, 24));
        }

        static float Poly(float u, float v, Vector2[] pts)
        {
            // Signed distance to a polygon (Inigo Quilez).
            float d = (new Vector2(u, v) - pts[0]).sqrMagnitude;
            float s = 1;
            var p = new Vector2(u, v);
            for (int i = 0, j = pts.Length - 1; i < pts.Length; j = i, i++)
            {
                var e = pts[j] - pts[i];
                var w = p - pts[i];
                var b = w - e * Mathf.Clamp01(Vector2.Dot(w, e) / Vector2.Dot(e, e));
                d = Mathf.Min(d, b.sqrMagnitude);
                bool c1 = p.y >= pts[i].y, c2 = p.y < pts[j].y, c3 = e.x * w.y > e.y * w.x;
                if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
            }
            return s * Mathf.Sqrt(d);
        }

        public static Sprite Bolt => bolt ? bolt : (bolt = Draw(128, (u, v) => Poly(u, v, new[] { new Vector2(0.15f, 0.95f), new Vector2(-0.5f, -0.05f), new Vector2(-0.02f, -0.05f), new Vector2(-0.2f, -0.95f), new Vector2(0.55f, 0.15f), new Vector2(0.05f, 0.15f) })));
        public static Sprite Play => play ? play : (play = Draw(128, (u, v) => Poly(u, v, new[] { new Vector2(-0.45f, 0.7f), new Vector2(0.75f, 0), new Vector2(-0.45f, -0.7f) }) - 0.06f));
        /// <summary>A cut blue gem: a crown over a pointed pavilion.</summary>
        public static Sprite Gem => gem ? gem : (gem = Draw(128, (u, v) => Poly(u, v, new[] { new Vector2(-0.9f, 0.3f), new Vector2(-0.45f, 0.8f), new Vector2(0.45f, 0.8f), new Vector2(0.9f, 0.3f), new Vector2(0, -0.9f) }) - 0.04f));

        public static Sprite Star => star ? star : (star = Draw(128, (u, v) =>
        {
            var pts = new Vector2[10];
            for (int i = 0; i < 10; i++) { float a = Mathf.PI / 2 + i * Mathf.PI / 5; float r = i % 2 == 0 ? 0.95f : 0.42f; pts[i] = new Vector2(Mathf.Cos(a) * r, Mathf.Sin(a) * r); }
            return Poly(u, v, pts) - 0.03f;
        }));

        /// <summary>One person: a round head over rounded shoulders, cut flat at the bottom.</summary>
        static float Person(float u, float v, float cx, float k)
        {
            float hx = u - cx, hy = v - 0.38f * k;
            float head = Mathf.Sqrt(hx * hx + hy * hy) - 0.25f * k;
            float by = v + 0.55f;
            float body = Mathf.Max(Mathf.Sqrt(hx * hx + by * by * 1.3f) - 0.5f * k, -0.85f - v);
            return Mathf.Min(head, body);
        }

        /// <summary>Two friends side by side: how many children are in the playground.</summary>
        public static Sprite Pals => pals ? pals : (pals = Draw(128, (u, v) =>
        {
            // The friend behind is cut back around the one in front, so the two read apart.
            float front = Person(u, v, 0.3f, 1);
            return Mathf.Min(front, Mathf.Max(Person(u, v - 0.06f, -0.42f, 0.85f), -(front - 0.09f)));
        }));
        /// <summary>Just you: for the name chip.</summary>
        public static Sprite Me => me ? me : (me = Draw(128, (u, v) => Person(u, v, 0, 1)));

        /// <summary>A die showing five, for the name shuffle.</summary>
        public static Sprite Dice => dice ? dice : (dice = Draw(128, (u, v) =>
        {
            float qx = Mathf.Abs(u) - 0.62f, qy = Mathf.Abs(v) - 0.62f;
            float box = Mathf.Sqrt(Mathf.Max(qx, 0) * Mathf.Max(qx, 0) + Mathf.Max(qy, 0) * Mathf.Max(qy, 0)) + Mathf.Min(Mathf.Max(qx, qy), 0) - 0.3f;
            float pip = Mathf.Sqrt(u * u + v * v) - 0.15f;
            for (int i = 0; i < 4; i++)
            {
                float px = u - (i % 2 == 0 ? -0.45f : 0.45f), py = v - (i < 2 ? -0.45f : 0.45f);
                pip = Mathf.Min(pip, Mathf.Sqrt(px * px + py * py) - 0.15f);
            }
            return Mathf.Max(box, -pip);
        }));

        /// <summary>A signal: a dot under three arcs (the line to the playground).</summary>
        public static Sprite Signal => signal ? signal : (signal = Draw(128, (u, v) =>
        {
            float x = u, y = v + 0.6f;
            float r = Mathf.Sqrt(x * x + y * y);
            float d = r - 0.17f;
            // Only the upward wedge, 45 degrees either side.
            float wedge = (Mathf.Abs(x) - y) * 0.7071f;
            for (int i = 1; i <= 3; i++) d = Mathf.Min(d, Mathf.Max(Mathf.Abs(r - (0.12f + i * 0.36f)) - 0.09f, wedge));
            return d;
        }));

        // ------------------------------------------------------------------ builders

        public static RectTransform Rect(Transform parent, string name, Vector2 anchorMin, Vector2 anchorMax, Vector2 pivot, Vector2 pos, Vector2 size)
        {
            var go = new GameObject(name, typeof(RectTransform));
            var rt = (RectTransform)go.transform;
            rt.SetParent(parent, false);
            rt.anchorMin = anchorMin; rt.anchorMax = anchorMax; rt.pivot = pivot;
            rt.anchoredPosition = pos; rt.sizeDelta = size;
            return rt;
        }

        public static RectTransform Fill(Transform parent, string name)
        {
            var rt = Rect(parent, name, Vector2.zero, Vector2.one, new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            return rt;
        }

        public static Image Panel(Transform parent, string name, Color c, int radius = 24)
        {
            var rt = Fill(parent, name);
            var img = rt.gameObject.AddComponent<Image>();
            img.sprite = radius > 0 ? Rounded(radius) : null;
            img.type = radius > 0 ? UnityEngine.UI.Image.Type.Sliced : UnityEngine.UI.Image.Type.Simple;
            img.color = c;
            img.raycastTarget = false;
            return img;
        }

        public static Image Image(Transform parent, string name, Sprite s, Color c)
        {
            var rt = Fill(parent, name);
            var img = rt.gameObject.AddComponent<Image>();
            img.sprite = s;
            img.color = c;
            img.preserveAspect = true;
            img.raycastTarget = false;
            return img;
        }

        /// <summary>A soft drop shadow behind a rect, for depth.</summary>
        /// <summary>A soft drop shadow behind target; `round` for circular buttons, where the sliced blob would show square corners.</summary>
        public static Image Shadow(RectTransform target, float spread = 18, float alpha = 0.28f, Vector2? offset = null, bool round = false)
        {
            var rt = Rect(target.parent, target.name + "-shadow", target.anchorMin, target.anchorMax, target.pivot, target.anchoredPosition + (offset ?? new Vector2(0, -8)), target.sizeDelta + Vector2.one * spread * 2);
            rt.SetSiblingIndex(target.GetSiblingIndex());
            var img = rt.gameObject.AddComponent<Image>();
            img.sprite = SoftShadow;
            img.type = round ? UnityEngine.UI.Image.Type.Simple : UnityEngine.UI.Image.Type.Sliced;
            img.color = new Color(0, 0, 0, alpha);
            img.raycastTarget = false;
            return img;
        }

        public static Text Label(Transform parent, string name, string text, int size, Color c, TextAnchor align = TextAnchor.MiddleCenter, float outline = 0, Color? outlineColor = null)
        {
            var rt = Fill(parent, name);
            var t = rt.gameObject.AddComponent<Text>();
            t.font = Font;
            t.text = text;
            t.fontSize = size;
            t.color = c;
            t.alignment = align;
            t.horizontalOverflow = HorizontalWrapMode.Overflow;
            t.verticalOverflow = VerticalWrapMode.Overflow;
            t.raycastTarget = false;
            if (outline > 0)
            {
                var o = rt.gameObject.AddComponent<Outline>();
                o.effectColor = outlineColor ?? new Color(0, 0, 0, 0.5f);
                o.effectDistance = new Vector2(outline, -outline);
                var sh = rt.gameObject.AddComponent<UnityEngine.UI.Shadow>();
                sh.effectColor = new Color(0, 0, 0, 0.35f);
                sh.effectDistance = new Vector2(0, -outline * 2);
            }
            return t;
        }

        public static Button Button(Transform parent, string name, Color c, int radius, Action onClick)
        {
            var img = Panel(parent, name, c, radius);
            img.raycastTarget = true;
            var b = img.gameObject.AddComponent<Button>();
            b.transition = Selectable.Transition.None;
            b.onClick.AddListener(() => onClick());
            img.gameObject.AddComponent<Springy>();
            return b;
        }

        public static Canvas Canvas(string name, int order)
        {
            var go = new GameObject(name, typeof(Canvas), typeof(GraphicRaycaster), typeof(Fit));
            var cv = go.GetComponent<Canvas>();
            cv.renderMode = RenderMode.ScreenSpaceOverlay;
            cv.sortingOrder = order;
            go.GetComponent<Fit>().Apply();
            return cv;
        }
    }

    /// <summary>
    /// Sizes a canvas for any screen. Landscape keeps the 1600x900 design (scaled 60% by height, 40% by
    /// width, as the old CanvasScaler did); a tall screen is never less than 900 units wide, so a phone
    /// held upright gets a 900-wide canvas and nothing is clipped at the sides. Also tracks the safe
    /// area (notches, the home bar) and says when the shape changes: rotation, a resized window.
    /// </summary>
    public sealed class Fit : MonoBehaviour
    {
        /// <summary>Dev captures: lay out as if the screen were this many pixels.</summary>
        public static Vector2Int? Size;
        /// <summary>The safe area as fractions of the screen, when Screen.safeArea does not know it (WebGL, captures).</summary>
        public static Rect? SafeFrac;

        const float MIN_WIDE = 900;
        public Vector2 Units { get; private set; }
        /// <summary>The safe area, in canvas units.</summary>
        public Rect Safe { get; private set; }
        public bool Portrait => Units.y > Units.x;
        public event Action Changed;
        Canvas cv;

        public static void ApplyAll() { foreach (var f in FindObjectsByType<Fit>()) f.Apply(); }

        public void Apply()
        {
            if (!cv) cv = GetComponent<Canvas>();
            Vector2 px = Size.HasValue ? (Vector2)Size.Value : new Vector2(Screen.width, Screen.height);
            px = Vector2.Max(px, Vector2.one);
            float scale = Mathf.Pow(px.x / 1600, 0.4f) * Mathf.Pow(px.y / 900, 0.6f);
            scale = Mathf.Min(scale, px.x / MIN_WIDE);
            var safePx = SafeFrac.HasValue
                ? new Rect(SafeFrac.Value.x * px.x, SafeFrac.Value.y * px.y, SafeFrac.Value.width * px.x, SafeFrac.Value.height * px.y)
                : Size.HasValue ? new Rect(Vector2.zero, px) : Screen.safeArea;
            var units = px / scale;
            var safe = new Rect(safePx.position / scale, safePx.size / scale);
            if (!Mathf.Approximately(cv.scaleFactor, scale)) cv.scaleFactor = scale;
            if ((units - Units).sqrMagnitude < 0.01f && safe == Safe) return;
            Units = units;
            Safe = safe;
            Changed?.Invoke();
        }

        void Update() => Apply();
    }

    /// <summary>Buttons squash when pressed and wobble when hovered: everything feels like a toy.</summary>
    public sealed class Springy : MonoBehaviour, IPointerDownHandler, IPointerUpHandler, IPointerEnterHandler, IPointerExitHandler
    {
        float target = 1, scale = 1, vel;
        public float Idle; // > 0: a gentle breathing pulse, to invite a tap
        public void OnPointerDown(PointerEventData e) => target = 0.88f;
        public void OnPointerUp(PointerEventData e) => target = 1.06f;
        public void OnPointerEnter(PointerEventData e) => target = 1.06f;
        public void OnPointerExit(PointerEventData e) => target = 1;
        void Update()
        {
            float dt = Time.unscaledDeltaTime;
            float idle = Idle > 0 ? 1 + Mathf.Sin(Time.unscaledTime * 3) * Idle : 1;
            vel += (target * idle - scale) * 260 * dt;
            vel *= Mathf.Exp(-dt * 16);
            scale += vel * dt;
            transform.localScale = Vector3.one * scale;
        }
    }
}
