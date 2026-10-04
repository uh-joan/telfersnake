using System.IO;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Telfer.Game
{
    /// <summary>
    /// Development helper: render the game camera, HUD included, to a PNG at any size. Works in a
    /// headless (batch-mode) editor where there is no Game view to screenshot.
    ///   unity command eval 'return Telfer.Game.Shots.Capture("/tmp/a.png", 1600, 900);'
    /// The HUD is laid out for the capture size, so a tall capture shows the phone-upright layout;
    /// `notch` adds an iPhone's safe-area insets (the notch and the home bar).
    /// </summary>
    public static class Shots
    {
        /// <summary>Re-lays out anything positioned from the camera, once the canvas matches the capture size.</summary>
        public static System.Action BeforeRender;

        public static string Capture(string path, int width = 1600, int height = 900, bool notch = false)
        {
            var cam = Camera.main;
            if (cam == null) return "no camera";
            var canvases = Object.FindObjectsByType<Canvas>(FindObjectsSortMode.None);
            var modes = new RenderMode[canvases.Length];
            var rt = new RenderTexture(width, height, 24, RenderTextureFormat.ARGB32) { antiAliasing = 4 };
            var prevTarget = cam.targetTexture;
            cam.targetTexture = rt;
            for (int i = 0; i < canvases.Length; i++)
            {
                modes[i] = canvases[i].renderMode;
                if (modes[i] != RenderMode.ScreenSpaceOverlay) continue;
                canvases[i].renderMode = RenderMode.ScreenSpaceCamera;
                canvases[i].worldCamera = cam;
                canvases[i].planeDistance = 1;
            }
            var prevSafe = UI.Fit.SafeFrac;
            UI.Fit.Size = new Vector2Int(width, height);
            if (notch)
                UI.Fit.SafeFrac = height > width ? new Rect(0, 34 / 812f, 1, 1 - 81 / 812f) : new Rect(47 / 812f, 21 / 375f, 1 - 94 / 812f, 1 - 21 / 375f);
            UI.Fit.ApplyAll();
            Canvas.ForceUpdateCanvases();
            BeforeRender?.Invoke();
            Canvas.ForceUpdateCanvases();
            var req = new UniversalRenderPipeline.SingleCameraRequest { destination = rt };
            if (RenderPipeline.SupportsRenderRequest(cam, req)) RenderPipeline.SubmitRenderRequest(cam, req);
            else cam.Render();
            var prev = RenderTexture.active;
            RenderTexture.active = rt;
            var tex = new Texture2D(width, height, TextureFormat.RGB24, false);
            tex.ReadPixels(new Rect(0, 0, width, height), 0, 0);
            tex.Apply();
            RenderTexture.active = prev;
            cam.targetTexture = prevTarget;
            for (int i = 0; i < canvases.Length; i++) canvases[i].renderMode = modes[i];
            UI.Fit.Size = null;
            UI.Fit.SafeFrac = prevSafe;
            UI.Fit.ApplyAll();
            Directory.CreateDirectory(Path.GetDirectoryName(path));
            File.WriteAllBytes(path, tex.EncodeToPNG());
            Object.Destroy(tex);
            rt.Release();
            return "saved " + path;
        }
    }
}
