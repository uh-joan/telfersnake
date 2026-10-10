using System.Collections.Generic;
using Telfer.Sim;
using Telfer.View;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Telfer.UI
{
    /// <summary>
    /// London's postcards (postcards.ts, docs/london-catalogue.md): the twelve sights in the album's order and
    /// the nine rare ones, with the same ids as the web game (they share `telfersnake.london.v1`). Each card's
    /// picture is a photograph of the HD landmark itself, standing on its paper map, taken by a camera of its own.
    /// </summary>
    public static class Postcards
    {
        public struct Card
        {
            public string id, name;
            public bool rare;
            public Card(string id, string name, bool rare) { this.id = id; this.name = name; this.rare = rare; }
        }

        public static readonly Card[] LANDMARKS =
        {
            new Card("bigben", "BIG BEN", false), new Card("eye", "LONDON EYE", false), new Card("palace", "PALACE", false),
            new Card("museum", "MUSEUM", false), new Card("piccadilly", "PICCADILLY", false), new Card("trafalgar", "TRAFALGAR", false),
            new Card("stpauls", "ST PAUL'S", false), new Card("globe", "GLOBE", false), new Card("gherkin", "GHERKIN", false),
            new Card("tower", "TOWER", false), new Card("towerbridge", "TOWER BRIDGE", false), new Card("shard", "SHARD", false),
        };

        public static readonly Card[] RARE =
        {
            new Card("guard", "SMILE!", true), new Card("eyeride", "EYE RIDE", true), new Card("launch", "WHEE!", true),
            new Card("dragon", "DRAGON", true), new Card("royal", "ROYAL!", true), new Card("fireworks", "FIREWORKS", true),
            new Card("tube", "TUBE", true), new Card("teatime", "TEA TIME", true), new Card("whole", "WHOLE LONDON", true),
        };

        public static int Count => LANDMARKS.Length + RARE.Length;

        public static string NameOf(string id)
        {
            foreach (var c in LANDMARKS) if (c.id == id) return c.name;
            foreach (var c in RARE) if (c.id == id) return c.name;
            return id.ToUpperInvariant();
        }

        /// <summary>The game provides London (built if it is not yet), and hides everything else while a picture is taken.</summary>
        public static System.Func<LondonEnv> Env;
        public static System.Action<bool> Isolate;

        /// <summary>Which sight each rare card is photographed at, and the sticker on it.</summary>
        static string SpotOf(string id) => id switch
        {
            "guard" => "palace", "eyeride" => "eye", "launch" => "towerbridge", "dragon" => "stpauls", "royal" => "tower",
            "fireworks" => "eye", "tube" => "piccadilly", "teatime" => "bigben", "whole" => "bigben", _ => id,
        };

        public static Texture Sticker(string id) => id switch
        {
            "guard" => Icons.Of("pc-guard", ModelsLondonZoo.Marcher(false), Mats.VertexGlossy, -60, 12),
            "dragon" => Icons.Creature(CreatureKind.Dragon),
            "royal" => Icons.Of("pc-jewel", ModelsLondonZoo.Jewel(0), Mats.VertexGlossy, -20, 18),
            "fireworks" => Icons.Burst,
            "launch" => Icons.Burst,
            "teatime" => Icons.Food(FoodKind.Tea),
            "whole" => Icons.Trophy,
            _ => null,
        };

        public const int W = 360, H = 252;
        static readonly Dictionary<string, Texture2D> cache = new Dictionary<string, Texture2D>();
        static Camera cam;

        public static bool Ready(string id) => cache.ContainsKey(SpotOf(id));

        /// <summary>The card's picture (the sight it shows), photographed the first time it is asked for.</summary>
        public static Texture2D Art(string id)
        {
            string spot = SpotOf(id);
            if (cache.TryGetValue(spot, out var hit) && hit) return hit;
            var env = Env?.Invoke();
            var lv = env?.Landmark(spot);
            if (lv == null) return null;
            Isolate?.Invoke(true);
            try
            {
                var c = Cam();
                float h = Mathf.Max(6, lv.labelY);
                var target = lv.root.position + Vector3.up * h * 0.38f;
                float dist = Mathf.Max(24, h * 1.75f);
                var dir = new Vector3(0.38f, 0.55f, -1f).normalized;
                c.transform.position = target + dir * dist;
                c.transform.LookAt(target);
                var rt = RenderTexture.GetTemporary(W, H, 24, RenderTextureFormat.ARGB32);
                rt.antiAliasing = 4;
                var req = new UniversalRenderPipeline.SingleCameraRequest { destination = rt };
                if (RenderPipeline.SupportsRenderRequest(c, req)) RenderPipeline.SubmitRenderRequest(c, req);
                else { c.targetTexture = rt; c.Render(); c.targetTexture = null; }
                var prev = RenderTexture.active;
                RenderTexture.active = rt;
                var tex = new Texture2D(W, H, TextureFormat.RGBA32, false) { name = "postcard-" + spot, wrapMode = TextureWrapMode.Clamp };
                tex.ReadPixels(new Rect(0, 0, W, H), 0, 0);
                tex.Apply(false);
                RenderTexture.active = prev;
                RenderTexture.ReleaseTemporary(rt);
                cache[spot] = tex;
                return tex;
            }
            finally { Isolate?.Invoke(false); }
        }

        static Camera Cam()
        {
            if (cam) return cam;
            var go = new GameObject("PostcardCamera");
            Object.DontDestroyOnLoad(go);
            cam = go.AddComponent<Camera>();
            cam.enabled = false;
            cam.clearFlags = CameraClearFlags.Skybox;
            cam.fieldOfView = 34;
            cam.nearClipPlane = 0.3f;
            cam.farClipPlane = 400;
            cam.allowHDR = true;
            cam.allowMSAA = true;
            var data = go.AddComponent<UniversalAdditionalCameraData>();
            data.renderPostProcessing = true;
            data.renderShadows = true;
            data.antialiasing = AntialiasingMode.None;
            return cam;
        }
    }
}
