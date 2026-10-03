using System.Collections.Generic;
using Telfer.Sim;
using Telfer.View;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Telfer.UI
{
    /// <summary>
    /// Photographs the game's own 3D models into UI thumbnails, so every picture in the HUD (the next
    /// animals you can gulp, the upgrade cards) is the real thing, lit like the game.
    /// The players are too young to read: the pictures do the talking.
    /// </summary>
    public static class Icons
    {
        static readonly Dictionary<string, Texture2D> cache = new Dictionary<string, Texture2D>();
        static Camera cam;
        static readonly Vector3 Stage = new Vector3(0, -2000, 0);

        static Camera Cam()
        {
            if (cam) return cam;
            var go = new GameObject("IconCamera");
            Object.DontDestroyOnLoad(go);
            cam = go.AddComponent<Camera>();
            cam.enabled = false;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0, 0, 0, 0);
            cam.fieldOfView = 24;
            cam.nearClipPlane = 0.05f;
            cam.farClipPlane = 50;
            cam.allowHDR = false;
            cam.allowMSAA = true;
            var data = go.AddComponent<UniversalAdditionalCameraData>();
            data.renderPostProcessing = false;
            data.renderShadows = false;
            data.antialiasing = AntialiasingMode.None;
            return cam;
        }

        public static Texture2D Of(string key, Mesh mesh, Material mat, float yaw = -35, float pitch = 22, int size = 192)
        {
            if (cache.TryGetValue(key, out var hit)) return hit;
            var go = new GameObject("icon-subject", typeof(MeshFilter), typeof(MeshRenderer));
            go.GetComponent<MeshFilter>().sharedMesh = mesh;
            var r = go.GetComponent<MeshRenderer>();
            r.sharedMaterial = mat;
            r.shadowCastingMode = ShadowCastingMode.Off;
            var b = mesh.bounds;
            go.transform.position = Stage - b.center;
            go.transform.RotateAround(Stage, Vector3.up, yaw);

            var c = Cam();
            float radius = b.extents.magnitude;
            float dist = radius / Mathf.Sin(c.fieldOfView * 0.5f * Mathf.Deg2Rad) * 1.02f;
            c.transform.rotation = Quaternion.Euler(pitch, 0, 0);
            c.transform.position = Stage - c.transform.forward * dist;

            var rt = RenderTexture.GetTemporary(size, size, 24, RenderTextureFormat.ARGB32);
            rt.antiAliasing = 4;
            var req = new UniversalRenderPipeline.SingleCameraRequest { destination = rt };
            if (RenderPipeline.SupportsRenderRequest(c, req)) RenderPipeline.SubmitRenderRequest(c, req);
            else { c.targetTexture = rt; c.Render(); c.targetTexture = null; }

            var prev = RenderTexture.active;
            RenderTexture.active = rt;
            var tex = new Texture2D(size, size, TextureFormat.RGBA32, true) { name = key, wrapMode = TextureWrapMode.Clamp };
            tex.ReadPixels(new Rect(0, 0, size, size), 0, 0);
            tex.Apply(true);
            RenderTexture.active = prev;
            RenderTexture.ReleaseTemporary(rt);
            Object.DestroyImmediate(go);
            cache[key] = tex;
            return tex;
        }

        public static Texture2D Animal(AnimalKind k) => Of("animal-" + k, Models.Animal(k), Mats.VertexGlossy);
        public static Texture2D Food(FoodKind k) => Of("food-" + k, Models.Food(k), Mats.VertexGlossy);

        public static Texture2D Trophy => Of("trophy", Build(k =>
        {
            k.Tint(0xffc93c).Cylinder(new Vector3(0, 0.55f, 0), new Vector3(0, 1.15f, 0), 0.22f, 0.42f, 20);
            k.Tint(0xffd95a).Sphere(new Vector3(0, 0.55f, 0), new Vector3(0.22f, 0.12f, 0.22f), 16, 8);
            k.Tint(0xffc93c).Cylinder(new Vector3(0, 0.25f, 0), new Vector3(0, 0.5f, 0), 0.07f, 0.09f, 10);
            k.Tint(0x8a5a3a).RoundBox(new Vector3(0, 0.12f, 0), new Vector3(0.5f, 0.24f, 0.36f), 0.05f);
            for (int s = -1; s <= 1; s += 2) { k.M = Matrix4x4.TRS(new Vector3(s * 0.42f, 0.9f, 0), Quaternion.Euler(0, 0, 90), Vector3.one); k.Tint(0xffc93c).Torus(Vector3.zero, 0.16f, 0.04f, 14, 6, 200); k.M = Matrix4x4.identity; }
        }), Mats.VertexGlossy);

        public static Texture2D Coil => Of("coil", Build(k =>
        {
            for (int i = 0; i < 26; i++)
            {
                float a = i * 0.42f, r = 0.15f + i * 0.022f;
                k.C = i % 5 == 0 ? MeshKit.Hex(0xf2d94a) : MeshKit.Hex(0x4cbb4a);
                k.Sphere(new Vector3(Mathf.Cos(a) * r, 0.12f, Mathf.Sin(a) * r), 0.13f, 10, 8);
            }
            k.Tint(0x57c955).Sphere(new Vector3(0, 0.22f, 0), new Vector3(0.17f, 0.14f, 0.2f), 12, 8);
            k.Tint(0xffffff).Sphere(new Vector3(-0.07f, 0.33f, 0.1f), 0.06f, 8, 6);
            k.Tint(0xffffff).Sphere(new Vector3(0.07f, 0.33f, 0.1f), 0.06f, 8, 6);
            k.Tint(0x111111).Sphere(new Vector3(-0.07f, 0.35f, 0.14f), 0.03f, 6, 4);
            k.Tint(0x111111).Sphere(new Vector3(0.07f, 0.35f, 0.14f), 0.03f, 6, 4);
        }), Mats.VertexGlossy, -20, 50);

        public static Texture2D Burst => Of("burst", Build(k =>
        {
            k.Tint(0xff6b6b).Sphere(new Vector3(0, 0.5f, 0), 0.32f, 16, 12);
            for (int i = 0; i < 10; i++)
            {
                float a = i * Mathf.PI * 2 / 10;
                var d = new Vector3(Mathf.Cos(a), Mathf.Sin(a), 0);
                k.Tint(i % 2 == 0 ? 0xffd43bu : 0xff922bu).Cylinder(new Vector3(0, 0.5f, 0) + d * 0.25f, new Vector3(0, 0.5f, 0) + d * (i % 2 == 0 ? 0.75f : 0.55f), 0.12f, 0, 8);
            }
        }), Mats.VertexGlossy, 0, 5);

        static Mesh Build(System.Action<MeshKit> f) { var k = new MeshKit(); f(k); return k.ToMesh(); }

        public static Texture2D Upgrade(UpgradeId id) =>
            Of("upgrade-" + id, UpgradeMesh(id), Mats.VertexGlossy, id == UpgradeId.Tongue ? 10 : -30, id == UpgradeId.Tongue ? 62 : 24, 256);

        static Mesh UpgradeMesh(UpgradeId id)
        {
            var k = new MeshKit();
            switch (id)
            {
                case UpgradeId.Skates:
                    k.Tint(0xe64980).RoundBox(new Vector3(0, 0.55f, 0.05f), new Vector3(0.5f, 0.6f, 0.9f), 0.2f);
                    k.Tint(0xe64980).RoundBox(new Vector3(0, 0.95f, -0.2f), new Vector3(0.48f, 0.7f, 0.42f), 0.18f);
                    k.Tint(0xffffff).Box(new Vector3(0, 0.3f, 0.05f), new Vector3(0.44f, 0.08f, 1.0f));
                    for (int i = 0; i < 3; i++) k.Tint(0xffffff).Box(new Vector3(0, 0.75f + i * 0.12f, 0.08f + i * -0.05f), new Vector3(0.5f, 0.03f, 0.04f));
                    foreach (float z in new[] { -0.35f, 0.4f })
                        foreach (float x in new[] { -0.2f, 0.2f })
                            k.Tint(0xffd43b).Cylinder(new Vector3(x - 0.06f, 0.15f, z), new Vector3(x + 0.06f, 0.15f, z), 0.13f, 0.13f, 16);
                    break;
                case UpgradeId.Belly:
                    k.Tint(0xff6b6b).Sphere(new Vector3(0, 0.9f, 0), new Vector3(0.5f, 0.58f, 0.5f), 22, 16);
                    k.Tint(0xffa8a8).Sphere(new Vector3(-0.17f, 1.12f, 0.36f), 0.1f, 10, 8);
                    k.Tint(0xff6b6b).Cylinder(new Vector3(0, 0.32f, 0), new Vector3(0, 0.38f, 0), 0.08f, 0.04f, 8);
                    k.Tint(0x868e96).Cylinder(new Vector3(0, 0.32f, 0), new Vector3(0.1f, -0.3f, 0), 0.015f, 0.015f, 5);
                    break;
                case UpgradeId.Homework:
                    k.M = Matrix4x4.TRS(new Vector3(0, 0.3f, 0), Quaternion.Euler(0, 0, 0), Vector3.one);
                    k.Tint(0x1c7ed6).RoundBox(new Vector3(-0.38f, 0, 0), new Vector3(0.72f, 0.08f, 1.0f), 0.04f);
                    k.Tint(0x1c7ed6).RoundBox(new Vector3(0.38f, 0, 0), new Vector3(0.72f, 0.08f, 1.0f), 0.04f);
                    k.M = Matrix4x4.TRS(new Vector3(-0.36f, 0.38f, 0), Quaternion.Euler(0, 0, -8), Vector3.one);
                    k.Tint(0xfffdf5).Box(Vector3.zero, new Vector3(0.66f, 0.08f, 0.92f));
                    k.M = Matrix4x4.TRS(new Vector3(0.36f, 0.38f, 0), Quaternion.Euler(0, 0, 8), Vector3.one);
                    k.Tint(0xfffdf5).Box(Vector3.zero, new Vector3(0.66f, 0.08f, 0.92f));
                    for (int i = 0; i < 4; i++) k.Tint(0x74c0fc).Box(new Vector3(0, 0.045f, -0.3f + i * 0.18f), new Vector3(0.5f, 0.01f, 0.03f));
                    k.M = Matrix4x4.identity;
                    k.Tint(0xffd43b).Star(new Vector3(0.1f, 0.9f, 0), 0.25f);
                    break;
                case UpgradeId.Wrap:
                    for (int i = 0; i < 7; i++)
                    {
                        float a = i * 1.3f, r = i == 0 ? 0 : 0.42f;
                        k.C = new Color(0.75f, 0.9f, 1f);
                        k.Sphere(new Vector3(Mathf.Cos(a) * r, 0.6f + Mathf.Sin(a * 1.7f) * 0.25f, Mathf.Sin(a) * r), i == 0 ? 0.4f : 0.24f, 16, 12);
                        k.Tint(0xffffff).Sphere(new Vector3(Mathf.Cos(a) * r - 0.08f, 0.72f + Mathf.Sin(a * 1.7f) * 0.25f, Mathf.Sin(a) * r + 0.12f), 0.06f, 6, 4);
                    }
                    break;
                case UpgradeId.Magnet:
                    k.M = Matrix4x4.TRS(new Vector3(0, 0.75f, 0), Quaternion.Euler(90, 0, 0), Vector3.one);
                    k.Tint(0xe03131).Torus(Vector3.zero, 0.45f, 0.17f, 24, 12, 180);
                    k.M = Matrix4x4.identity;
                    k.Tint(0xe03131).Cylinder(new Vector3(0.45f, 0.75f, 0), new Vector3(0.45f, 0.2f, 0), 0.17f, 0.17f, 14);
                    k.Tint(0xe03131).Cylinder(new Vector3(-0.45f, 0.75f, 0), new Vector3(-0.45f, 0.2f, 0), 0.17f, 0.17f, 14);
                    k.Tint(0xdee2e6).Cylinder(new Vector3(0.45f, 0.2f, 0), new Vector3(0.45f, 0.0f, 0), 0.17f, 0.17f, 14);
                    k.Tint(0xdee2e6).Cylinder(new Vector3(-0.45f, 0.2f, 0), new Vector3(-0.45f, 0.0f, 0), 0.17f, 0.17f, 14);
                    break;
                case UpgradeId.Tongue:
                    k.Tint(0xe0524d).Capsule(new Vector3(0, 0.5f, -0.7f), new Vector3(0, 0.5f, 0.35f), 0.12f, 12);
                    k.Tint(0xe0524d).Capsule(new Vector3(0, 0.5f, 0.35f), new Vector3(-0.3f, 0.5f, 0.75f), 0.09f, 10);
                    k.Tint(0xe0524d).Capsule(new Vector3(0, 0.5f, 0.35f), new Vector3(0.3f, 0.5f, 0.75f), 0.09f, 10);
                    break;
                case UpgradeId.Helmet:
                    k.Tint(0xe03131).Sphere(new Vector3(0, 0.2f, 0), new Vector3(0.62f, 0.55f, 0.66f), 22, 14, 0, 0.5f);
                    k.Tint(0xffffff).Box(new Vector3(0, 0.74f, 0), new Vector3(0.18f, 0.06f, 1.2f));
                    k.Tint(0xb02525).Box(new Vector3(0, 0.22f, 0.62f), new Vector3(0.8f, 0.06f, 0.3f));
                    break;
                case UpgradeId.Clover:
                    k.Tint(0x2b8a3e).Cylinder(new Vector3(0, 0, 0), new Vector3(0.1f, 0.5f, 0), 0.04f, 0.03f, 6);
                    for (int i = 0; i < 4; i++)
                    {
                        float a = i * Mathf.PI / 2 + 0.3f;
                        var c = new Vector3(Mathf.Cos(a) * 0.3f, 0.6f, Mathf.Sin(a) * 0.3f);
                        var side = new Vector3(-Mathf.Sin(a), 0, Mathf.Cos(a)) * 0.11f;
                        k.Tint(0x40c057).Sphere(c + side, new Vector3(0.2f, 0.08f, 0.2f), 12, 8);
                        k.Tint(0x40c057).Sphere(c - side, new Vector3(0.2f, 0.08f, 0.2f), 12, 8);
                    }
                    break;
                case UpgradeId.Spikes:
                    k.Tint(0x8a5a3a).Sphere(new Vector3(0, 0.25f, 0), new Vector3(0.55f, 0.45f, 0.6f), 18, 12, 0, 0.5f);
                    for (int i = 0; i < 18; i++)
                    {
                        float a = i * 2.39996f, h = (i % 6) / 6f;
                        var n = new Vector3(Mathf.Cos(a) * (1 - h), 0.5f + h, Mathf.Sin(a) * (1 - h)).normalized;
                        var p = new Vector3(0, 0.25f, 0) + Vector3.Scale(n, new Vector3(0.5f, 0.4f, 0.55f));
                        k.Tint(0xfff1c9).Cylinder(p, p + n * 0.35f, 0.07f, 0, 6);
                    }
                    break;
                case UpgradeId.Dragon:
                    // A cartoon flame: teardrop tongues, red outside, gold inside, a white-hot core.
                    void Tongue(Vector3 b, float h, float r, float lean, uint c)
                    {
                        k.Tint(c).Sphere(b + new Vector3(0, r * 0.8f, 0), new Vector3(r, r * 0.9f, r), 14, 10);
                        k.Tint(c).Cylinder(b + new Vector3(0, r * 0.8f, 0), b + new Vector3(lean, h, 0), r * 0.98f, 0, 14, false, false);
                    }
                    Tongue(new Vector3(0, 0, 0), 1.45f, 0.42f, 0.08f, 0xe03131);
                    Tongue(new Vector3(-0.3f, 0, 0.05f), 0.95f, 0.26f, -0.18f, 0xe03131);
                    Tongue(new Vector3(0.32f, 0, 0.05f), 1.05f, 0.26f, 0.2f, 0xe03131);
                    Tongue(new Vector3(0, 0, 0.12f), 1.1f, 0.3f, 0.06f, 0xff922b);
                    Tongue(new Vector3(0, 0, 0.22f), 0.75f, 0.2f, 0.03f, 0xffd43b);
                    k.Tint(0xfff9db).Sphere(new Vector3(0, 0.22f, 0.3f), new Vector3(0.11f, 0.13f, 0.08f), 10, 8);
                    break;
                case UpgradeId.Bees:
                    k.Tint(0xffd43b).Sphere(new Vector3(0, 0.6f, 0), new Vector3(0.38f, 0.34f, 0.5f), 18, 12);
                    k.Tint(0x222222).Sphere(new Vector3(0, 0.6f, -0.05f), new Vector3(0.39f, 0.35f, 0.1f), 18, 8);
                    k.Tint(0x222222).Sphere(new Vector3(0, 0.6f, 0.2f), new Vector3(0.36f, 0.32f, 0.08f), 18, 8);
                    k.Tint(0x222222).Sphere(new Vector3(0, 0.66f, 0.5f), 0.2f, 12, 8);
                    k.Tint(0xffffff).Sphere(new Vector3(-0.08f, 0.72f, 0.66f), 0.06f, 8, 6);
                    k.Tint(0xffffff).Sphere(new Vector3(0.08f, 0.72f, 0.66f), 0.06f, 8, 6);
                    k.Tint(0xe7f5ff).Sphere(new Vector3(0.35f, 1.0f, 0), new Vector3(0.32f, 0.05f, 0.18f), 12, 6);
                    k.Tint(0xe7f5ff).Sphere(new Vector3(-0.35f, 1.0f, 0), new Vector3(0.32f, 0.05f, 0.18f), 12, 6);
                    break;
                default:
                    // Snack Pack: a fat sandwich.
                    k.M = Matrix4x4.TRS(new Vector3(0, 0.3f, 0), Quaternion.Euler(0, 45, 0), Vector3.one);
                    k.Tint(0xf3d9a4).RoundBox(new Vector3(0, 0, 0), new Vector3(0.9f, 0.16f, 0.9f), 0.06f);
                    k.Tint(0x69db7c).RoundBox(new Vector3(0, 0.13f, 0), new Vector3(0.98f, 0.06f, 0.98f), 0.03f);
                    k.Tint(0xff8787).RoundBox(new Vector3(0, 0.2f, 0), new Vector3(0.9f, 0.08f, 0.9f), 0.03f);
                    k.Tint(0xffd43b).RoundBox(new Vector3(0, 0.27f, 0), new Vector3(0.94f, 0.04f, 0.94f), 0.02f);
                    k.Tint(0xf3d9a4).RoundBox(new Vector3(0, 0.38f, 0), new Vector3(0.9f, 0.16f, 0.9f), 0.06f);
                    k.M = Matrix4x4.identity;
                    break;
            }
            return k.ToMesh("upgrade-" + id);
        }

        static void Star(this MeshKit k, Vector3 c, float r)
        {
            for (int i = 0; i < 5; i++)
            {
                float a = Mathf.PI / 2 + i * Mathf.PI * 2 / 5;
                k.Cylinder(c, c + new Vector3(Mathf.Cos(a) * r, Mathf.Sin(a) * r, 0), 0.08f, 0.0f, 6);
            }
            k.Sphere(c, 0.09f, 8, 6);
        }
    }
}
