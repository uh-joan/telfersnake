using System.Collections;
using System.Runtime.InteropServices;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Telfer.UI
{
    /// <summary>
    /// Classic or HD, bottom right of the title (the classic game's home screen has the same switch).
    /// A tap slides the gold knob over to Classic, then the page grows the classic game's sky from the
    /// finger and changes over (TelferSite.jslib → TemplateData/boot.js). Stars, gems and the Tuck
    /// Shop come along: both games share one save.
    /// </summary>
    public sealed class VersionSwitch : MonoBehaviour, IPointerClickHandler
    {
        const float W = 300, H = 76, PAD = 6, SLIDE = 0.22f;
        /// <summary>Taps sooner than this after the game appears are ignored: a finger still down from the page change is not a choice.</summary>
        const float SETTLE = 1.2f;
        static readonly Color Ink = new Color(0.13f, 0.15f, 0.22f);
        static readonly Color Gold = new Color(1f, 0.83f, 0.23f);

        RectTransform knob;
        Image knobImg;
        Text classic, hd;
        Image spark;
        float at = 1, target = 1; // 1: the knob under HD, 0: under Classic
        bool going;

        /// <summary>Only in a browser, where there is a classic game to go to (and in the editor, to see it).</summary>
        public static bool Available => Application.platform == RuntimePlatform.WebGLPlayer || Application.isEditor;

        public static RectTransform Build(RectTransform parent)
        {
            var rt = UiKit.Rect(parent, "version", new Vector2(1, 0), new Vector2(1, 0), new Vector2(1, 0.5f), new Vector2(-24, 120), new Vector2(W, H));
            UiKit.Shadow(rt, 14, 0.25f);
            var bg = UiKit.Panel(rt, "bg", new Color(0.1f, 0.14f, 0.26f, 0.55f), (int)(H / 2));
            bg.raycastTarget = true;
            var s = rt.gameObject.AddComponent<VersionSwitch>();

            s.knob = UiKit.Rect(rt, "knob", new Vector2(0, 0.5f), new Vector2(0, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(W / 2 - PAD, H - PAD * 2));
            s.knobImg = UiKit.Panel(s.knob, "bg", Gold, (int)(H / 2 - PAD));
            s.classic = Half(rt, "classic", 0, "Classic", 28);
            s.hd = Half(rt, "hd", 1, "HD", 34);
            s.spark = UiKit.Image(rt, "spark", UiKit.Star, Color.white);
            var sr = (RectTransform)s.spark.transform;
            sr.anchorMin = sr.anchorMax = new Vector2(0.75f, 0.5f);
            sr.sizeDelta = new Vector2(24, 24);
            sr.anchoredPosition = new Vector2(38, 14);
            s.Apply();
            return rt;
        }

        static Text Half(RectTransform parent, string name, int side, string label, int size)
        {
            var r = UiKit.Rect(parent, name, new Vector2(side * 0.5f, 0), new Vector2(side * 0.5f + 0.5f, 1), new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            var t = UiKit.Label(r, "t", label, size, Color.white);
            t.raycastTarget = false;
            return t;
        }

        public void OnPointerClick(PointerEventData e)
        {
            if (going || Time.realtimeSinceStartup < SETTLE) return;
            going = true;
            target = 0;
            Audio.Synth.I?.Play("pick");
            StartCoroutine(Go(e.position));
        }

        IEnumerator Go(Vector2 finger)
        {
            yield return new WaitForSecondsRealtime(SLIDE);
            ToClassic(finger.x / Mathf.Max(1, Screen.width), finger.y / Mathf.Max(1, Screen.height));
#if UNITY_EDITOR
            // Nowhere to go in the editor: slide back, ready to try again.
            yield return new WaitForSecondsRealtime(0.8f);
            target = 1;
            going = false;
#endif
        }

        void Update()
        {
            float before = at;
            at = Mathf.Lerp(at, target, 1 - Mathf.Exp(-Time.unscaledDeltaTime * 18));
            if (Mathf.Abs(at - target) < 0.001f) at = target;
            if (at != before) Apply();
            // HD's sparkle twinkles while HD is picked.
            float tw = 0.75f + Mathf.Sin(Time.unscaledTime * 4) * 0.25f;
            spark.transform.localScale = Vector3.one * tw * at;
            spark.transform.localRotation = Quaternion.Euler(0, 0, Time.unscaledTime * 40);
        }

        /// <summary>The knob between the halves, white under Classic and gold under HD; the ink follows it.</summary>
        void Apply()
        {
            knob.anchoredPosition = new Vector2(Mathf.Lerp(W * 0.25f + PAD / 2, W * 0.75f - PAD / 2, at), 0);
            knobImg.color = Color.Lerp(Color.white, Gold, at);
            classic.color = Color.Lerp(Ink, Color.white, at);
            hd.color = Color.Lerp(Color.white, Ink, at);
        }

#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")] static extern void TelferSite_ToClassic(float x, float y);
        static void ToClassic(float x, float y) => TelferSite_ToClassic(x, y);
#else
        static void ToClassic(float x, float y) => Debug.Log("[Telfersnake] Classic switch tapped (only changes page in a browser)");
#endif
    }
}
