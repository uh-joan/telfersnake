using System.Collections.Generic;
using Telfer.Sim;
using UnityEngine;
using UnityEngine.Rendering;
using static Telfer.View.LK;

namespace Telfer.View
{
    /// <summary>One of London's sights, built: its root (at its LANDMARKS spot), its one bit of life, how tall it stands (labelY).</summary>
    public sealed class LandmarkView
    {
        public string id;
        public Transform root;
        public float labelY;
        public System.Action<float> Animate;
        /// <summary>The parts that fade together when they stand between the camera and the snake (each its own group).</summary>
        public readonly List<List<Renderer>> Groups = new List<List<Renderer>>();
        public List<Renderer> Current => Groups[Groups.Count - 1];
        public void NewGroup() => Groups.Add(new List<Renderer>());
    }

    /// <summary>
    /// London's twelve landmarks, code-built (port of src/render/london/landmarks/*.ts, the same designs,
    /// number for number, in the classic frame via <see cref="LK"/>), with the HD treats: lit clock
    /// faces, glossy glass with a sky band on the Shard and the Gherkin, emissive Piccadilly screens for
    /// the bloom, capsules that ride the turning Eye, and an ink outline on everything.
    /// </summary>
    public static class ModelsLondon
    {
        static LandmarkView view;

        public static LandmarkView Build(string id, Transform parent)
        {
            var l = London.Find(id);
            view = new LandmarkView { id = id };
            view.NewGroup();
            view.root = new GameObject(id).transform;
            view.root.SetParent(parent, false);
            view.root.localPosition = W.P(l.x, l.z);
            switch (id)
            {
                case "bigben": BigBen(); break;
                case "eye": Eye(); break;
                case "palace": Palace(); break;
                case "trafalgar": Trafalgar(); break;
                case "stpauls": StPauls(); break;
                case "tower": Tower(); break;
                case "towerbridge": TowerBridge(); break;
                case "shard": Shard(); break;
                case "gherkin": Gherkin(); break;
                case "globe": Globe(); break;
                case "piccadilly": Piccadilly(); break;
                case "museum": Museum(); break;
            }
            var v = view;
            view = null;
            return v;
        }

        /// <summary>A sim position as a landmark-local classic one.</summary>
        static Vector2 Rel(string id, float x, float z) { var l = London.Find(id); return new Vector2(x - l.x, z - l.z); }

        static MeshRenderer Ink(Transform parent, string name, List<G> parts, float thickness, Material mat = null, bool flat = false, bool shadows = true)
        {
            var r = Emit(parent ? parent : view.root, name, parts, thickness, mat, flat, shadows);
            view.Current.Add(r);
            return r;
        }

        /// <summary>A child transform at a classic-frame position (for the parts that move).</summary>
        static Transform Child(Transform parent, string name, float x, float y, float z)
        {
            var t = new GameObject(name).transform;
            t.SetParent(parent ? parent : view.root, false);
            t.localPosition = U(x, y, z);
            return t;
        }

        /// <summary>A classic-frame Euler rotation (three's 'XYZ' order) as a Unity one (the z mirror negates x and y).</summary>
        static Quaternion Rot(float x, float y, float z) =>
            Quaternion.Euler(-x * Mathf.Rad2Deg, 0, 0) * Quaternion.Euler(0, -y * Mathf.Rad2Deg, 0) * Quaternion.Euler(0, 0, z * Mathf.Rad2Deg);

        static Material Glass => Mats.Cached("londonGlass", () =>
        {
            var m = Mats.Toon(Color.white, gloss: 1.3f, smooth: 0.88f, rim: 0.55f);
            m.SetColor("_RimColor", new Color(0.8f, 0.92f, 1f));
            return m;
        });

        static Material InkSolid => Mats.Cached("londonInkSolid", () => Mats.Toon(MeshKit.Hex(INK), gloss: 0.1f, smooth: 0.3f, rim: 0, vertexColor: false));

        static List<G> L(params G[] g) => new List<G>(g);

        // ================================================================== Big Ben + the Houses of Parliament

        static void BigBen()
        {
            const uint HONEY_DARK = 0xc4973f, WINDOW = 0x3c3a52, SPIRE = 0x434a57;
            var T = Rel("bigben", London.BIG_BEN.x, London.BIG_BEN.z);
            var P = Rel("bigben", London.PARLIAMENT.x, London.PARLIAMENT.z);
            float[] FACES = { 0, Mathf.PI / 2, Mathf.PI, -Mathf.PI / 2 };
            const float DIAL_Y = 16.1f, DIAL_R = 1.85f, STAGE = 2.5f;
            G Pyr(float hw, float h, uint color, float x, float y, float z) => Cone(hw * Mathf.Sqrt(2), h, color, 0, 0, 0, 4).RotateY(Mathf.PI / 4).Translate(x, y, z);

            var stone = new List<G>();
            var dials = new List<G>();
            void AllFaces(System.Func<List<G>> make) { foreach (var yaw in FACES) foreach (var g in make()) stone.Add(g.RotateY(yaw).Translate(T.x, 0, T.y)); }

            // ---- the Elizabeth Tower
            float S = London.BIG_BEN.w / 2, SHAFT = 13.6f;
            stone.Add(Box(London.BIG_BEN.w + 0.4f, 1.0f, London.BIG_BEN.d + 0.4f, HONEY_DARK, T.x, 0, T.y));
            stone.Add(Box(London.BIG_BEN.w, SHAFT, London.BIG_BEN.d, HONEY, T.x, 0, T.y));
            stone.Add(Box(London.BIG_BEN.w + 0.3f, 0.22f, London.BIG_BEN.d + 0.3f, GOLD, T.x, SHAFT - 0.22f, T.y));
            AllFaces(() =>
            {
                var p = new List<G>();
                for (int i = -2; i <= 2; i++) p.Add(Box(0.18f, SHAFT - 1.4f, 0.14f, HONEY_DARK, i * 0.8f, 1.0f, S + 0.07f));
                p.Add(Box(0.5f, SHAFT + 0.2f, 0.5f, HONEY_DARK, S - 0.05f, 0, S - 0.05f));
                p.Add(Windows(4, 7, 0.8f, 1.6f, WINDOW, 0.38f, 1.0f, 0, 1.4f, S));
                p.Add(Box(4.5f, 4.5f, 0.1f, GOLD, 0, DIAL_Y - 2.25f, STAGE));
                p.Add(Cyl(DIAL_R + 0.18f, DIAL_R + 0.18f, 0.1f, INK, 0, 0, 0, 32).RotateX(Mathf.PI / 2).Translate(0, DIAL_Y, STAGE + 0.05f));
                for (int h = 0; h < 12; h++)
                {
                    bool lng = h % 3 == 0;
                    p.Add(Box(lng ? 0.16f : 0.1f, lng ? 0.42f : 0.28f, 0.05f, INK, 0, -0.14f, 0).Translate(0, DIAL_R - 0.3f, 0).RotateZ(h / 12f * Mathf.PI * 2).Translate(0, DIAL_Y, STAGE + 0.25f));
                }
                p.Add(Sphere(0.14f, GOLD, 0, DIAL_Y, STAGE + 0.3f, 8, 6));
                p.Add(Cyl(0.18f, 0.18f, 0.5f, HONEY, STAGE - 0.15f, 18.5f, STAGE - 0.15f, 6));
                p.Add(Cone(0.22f, 1.1f, GOLD, STAGE - 0.15f, 19.0f, STAGE - 0.15f, 6));
                p.Add(Windows(3, 1, 1.25f, 2.2f, 0x2a2433, 0.75f, 1.8f, 0, 18.75f, 2.1f, 0, true));
                p.Add(Cyl(0.24f, 0.24f, 2.8f, HONEY_DARK, 2.1f, 18.7f, 2.1f, 6));
                p.Add(Cone(0.3f, 1.5f, GOLD, 2.1f, 21.5f, 2.1f, 6));
                p.Add(Box(0.55f, 0.9f, 0.3f, GOLD, 0, 23.0f, 1.25f));
                p.Add(Pyr(0.3f, 0.6f, GOLD, 0, 23.9f, 1.25f));
                return p;
            });
            foreach (var yaw in FACES)
                dials.Add(Cyl(DIAL_R, DIAL_R, 0.1f, CLOCK_WHITE, 0, 0, 0, 32).RotateX(Mathf.PI / 2).Translate(0, DIAL_Y, STAGE + 0.12f).RotateY(yaw).Translate(T.x, 0, T.y));
            stone.Add(Box(STAGE * 2, 4.9f, STAGE * 2, HONEY, T.x, SHAFT, T.y));
            stone.Add(Box(STAGE * 2 + 0.3f, 0.3f, STAGE * 2 + 0.3f, GOLD, T.x, SHAFT + 4.9f, T.y));
            stone.Add(Box(4.2f, 2.6f, 4.2f, HONEY, T.x, 18.7f, T.y));
            stone.Add(Box(4.6f, 0.3f, 4.6f, GOLD, T.x, 21.2f, T.y));
            stone.Add(Pyr(2.25f, 6.6f, SPIRE, T.x, 21.5f, T.y));
            stone.Add(Box(1.2f, 0.2f, 1.2f, GOLD, T.x, 25.1f, T.y));
            stone.Add(Sphere(0.32f, GOLD, T.x, 28.2f, T.y, 10, 8));
            stone.Add(Cone(0.13f, 1.4f, GOLD, T.x, 28.3f, T.y, 6));
            stone.Add(Box(0.7f, 0.12f, 0.12f, GOLD, T.x, 29.1f, T.y));
            Ink(null, "elizabeth-tower", stone, 0.1f);
            // The dials glow (lit from inside, as at dusk): their own self-lit mesh, feeding the bloom.
            Ink(null, "dials", dials, 0, Toon(1.15f), false, false);

            // ---- the hands: a minute and an hour hand on each of the four dials
            var handMesh = ToMesh(Box(1, 1, 1, INK).Translate(0, -0.5f + 0.38f, 0), "clock-hand");
            var hands = new List<(Transform t, float yaw, bool min)>();
            foreach (var yaw in FACES)
                for (int k = 0; k < 2; k++)
                {
                    bool isMin = k == 0;
                    var go = new GameObject(isMin ? "minute" : "hour", typeof(MeshFilter), typeof(MeshRenderer));
                    go.transform.SetParent(view.root, false);
                    var pc = Quaternion.Euler(0, -yaw * Mathf.Rad2Deg, 0) * U(0, DIAL_Y, STAGE + (isMin ? 0.36f : 0.3f));
                    go.transform.localPosition = pc + U(T.x, 0, T.y);
                    go.transform.localScale = new Vector3(isMin ? 0.13f : 0.2f, isMin ? 1.7f : 1.15f, 0.05f);
                    go.GetComponent<MeshFilter>().sharedMesh = handMesh;
                    var r = go.GetComponent<MeshRenderer>();
                    r.sharedMaterial = InkSolid;
                    r.shadowCastingMode = ShadowCastingMode.Off;
                    view.Current.Add(r);
                    hands.Add((go.transform, yaw, isMin));
                }

            // ---- the Houses of Parliament (their own fade group: the tower fades on its own)
            view.NewGroup();
            var parl = new List<G>();
            float Wd = London.PARLIAMENT.w - 0.4f, D = London.PARLIAMENT.d - 0.4f, H = 5.2f;
            float front = P.y + D / 2, westX = P.x - Wd / 2, eastX = P.x + Wd / 2;
            parl.Add(Box(Wd + 0.2f, 0.6f, D + 0.2f, HONEY_DARK, P.x, 0, P.y));
            parl.Add(Box(Wd, H, D, HONEY, P.x, 0, P.y));
            parl.Add(Box(Wd + 0.15f, 0.25f, D + 0.15f, HONEY_DARK, P.x, H - 0.25f, P.y));
            var gable = new Shape2().MoveTo(-D / 2 + 0.3f, 0).LineTo(D / 2 - 0.3f, 0).LineTo(0, 2.0f);
            parl.Add(Extrude(gable, Wd - 0.4f, SPIRE, P.x, H, P.y, Mathf.PI / 2));
            int bays = 12;
            float bayW = Wd / bays;
            for (int k = 0; k <= bays; k++)
            {
                float x = westX + k * bayW;
                foreach (var (z, dz) in new[] { (front, 1f), (P.y - D / 2, -1f) })
                {
                    parl.Add(Box(0.24f, H + 0.6f, 0.24f, HONEY_DARK, x, 0, z + dz * 0.1f));
                    parl.Add(Cone(0.2f, 0.9f, HONEY, x, H + 0.6f, z + dz * 0.1f, 4));
                }
            }
            foreach (var z in new[] { P.y - D / 2 + 1.5f, P.y - D / 2 + 3.8f, P.y + D / 2 - 1.5f })
            {
                parl.Add(Box(0.24f, H + 0.6f, 0.24f, HONEY_DARK, eastX + 0.1f, 0, z));
                parl.Add(Cone(0.2f, 0.9f, HONEY, eastX + 0.1f, H + 0.6f, z, 4));
            }
            parl.Add(Windows(bays, 2, bayW, 2.1f, WINDOW, 0.45f, 1.3f, P.x, 0.7f, front, 0, true));
            parl.Add(Windows(5, 2, 0.95f, 2.1f, WINDOW, 0.45f, 1.3f, eastX, 0.7f, P.y + 1.4f, Mathf.PI / 2, true));
            parl.Add(Box(Wd + 0.05f, 0.12f, 0.1f, GOLD, P.x, 2.7f, front + 0.02f));
            float cx = P.x + 0.5f;
            parl.Add(Cyl(1.15f, 1.25f, 3.4f, HONEY, cx, H + 0.6f, P.y, 8));
            parl.Add(Windows(1, 1, 1, 2.2f, WINDOW, 0.45f, 1.5f, cx, H + 1.3f, P.y + 1.12f, 0, true));
            parl.Add(Cyl(1.3f, 1.3f, 0.2f, GOLD, cx, H + 4.0f, P.y, 8));
            parl.Add(Cone(1.2f, 3.8f, SPIRE, cx, H + 4.2f, P.y, 8));
            parl.Add(Cone(0.12f, 0.9f, GOLD, cx, H + 7.9f, P.y, 6));
            float vx = westX + 1.9f, vz = front - 1.9f, VH = 12;
            parl.Add(Box(3.4f, VH, 3.4f, HONEY, vx, 0, vz));
            parl.Add(Box(3.6f, 0.25f, 3.6f, GOLD, vx, VH - 0.3f, vz));
            parl.Add(Pyr(1.5f, 1.2f, SPIRE, vx, VH, vz));
            foreach (var (sx, sz) in new[] { (-1, -1), (1, -1), (-1, 1), (1, 1) })
            {
                parl.Add(Cyl(0.35f, 0.35f, VH + 1.4f, HONEY_DARK, vx + sx * 1.65f, 0, vz + sz * 1.65f, 8));
                parl.Add(Cone(0.42f, 1.4f, GOLD, vx + sx * 1.65f, VH + 1.4f, vz + sz * 1.65f, 8));
            }
            for (int i = -1; i <= 1; i += 2) parl.Add(Box(0.16f, VH - 2, 0.12f, HONEY_DARK, vx + i * 0.55f, 1.2f, vz + 1.76f));
            parl.Add(Windows(3, 4, 0.55f, 2.2f, WINDOW, 0.3f, 1.4f, vx, 2.2f, vz + 1.7f, 0, true));
            parl.Add(Windows(1, 1, 1.4f, 2.6f, 0x2a2433, 1.2f, 2.4f, vx, 0, vz + 1.71f, 0, true));
            parl.Add(Cyl(0.06f, 0.06f, 2.2f, WHITE, vx, VH + 1.0f, vz, 6));
            Ink(null, "parliament", parl, 0.1f);

            view.labelY = 31;
            view.Animate = t =>
            {
                float minute = (t / 60 + 10 / 60f) * Mathf.PI * 2; // starts at ten past, one turn a minute
                float hour = (10 + t / 60) / 12 * Mathf.PI * 2;
                foreach (var (tr, yaw, isMin) in hands)
                    tr.localRotation = Quaternion.Euler(0, -yaw * Mathf.Rad2Deg, 0) * Quaternion.Euler(0, 0, -(isMin ? minute : hour) * Mathf.Rad2Deg);
            };
        }

        // ================================================================== the London Eye

        static void Eye()
        {
            const float R = 9, HUB_Y = R + 1.7f, HUB_Z = -2.4f, POD_R = R + 0.75f;
            const int PODS = 24;
            const uint CABLE = 0xd9dde2;
            var frame = new List<G>();
            var top = new Vector3(0, HUB_Y, HUB_Z + 1.3f);
            foreach (int s in new[] { -1, 1 })
            {
                frame.Add(Beam(new Vector3(s * 1.15f, 0, 0.5f), new Vector3(s * 0.35f, top.y, top.z), 0.55f, EYE_WHITE));
                frame.Add(Cyl(0.6f, 0.7f, 0.4f, 0xc9c4b8, s * 1.0f, 0, 0.5f, 10));
            }
            frame.Add(Beam(new Vector3(-1.0f, 4.5f, 0), new Vector3(1.0f, 4.5f, 0), 0.3f, EYE_WHITE));
            frame.Add(Cyl(0.45f, 0.45f, 2.8f, EYE_WHITE, 0, 0, 0, 12).RotateX(Mathf.PI / 2).Translate(0, HUB_Y, HUB_Z - 1.4f));
            frame.Add(Box(4.5f, 0.25f, 2.6f, 0xc9c4b8, 0, 0, HUB_Z));
            frame.Add(Box(4.5f, 0.08f, 0.08f, EYE_WHITE, 0, 0.9f, HUB_Z + 1.25f));
            Ink(null, "eye-frame", frame, 0.07f);

            var wheel = new List<G>();
            foreach (var z in new[] { -0.55f, 0.55f }) wheel.Add(Torus(R, 0.22f, 6, 72, EYE_WHITE).Translate(0, 0, z));
            wheel.Add(Torus(R - 0.6f, 0.12f, 5, 64, EYE_WHITE));
            const int n = 32;
            for (int i = 0; i < n; i++)
            {
                float a = i / (float)n * Mathf.PI * 2, c = Mathf.Cos(a), s = Mathf.Sin(a);
                Vector3 Rim(float r, float z) => new Vector3(c * r, s * r, z);
                wheel.Add(Beam(Rim(R, -0.55f), Rim(R - 0.6f, 0), 0.1f, EYE_WHITE));
                wheel.Add(Beam(Rim(R, 0.55f), Rim(R - 0.6f, 0), 0.1f, EYE_WHITE));
                wheel.Add(Beam(new Vector3(0, 0, i % 2 == 1 ? 0.9f : -0.9f), Rim(R - 0.6f, 0), 0.06f, CABLE));
            }
            wheel.Add(Cyl(0.9f, 0.9f, 2.0f, EYE_WHITE, 0, 0, 0, 16).RotateX(Mathf.PI / 2).Translate(0, 0, -1.0f));
            wheel.Add(Cyl(0.5f, 0.5f, 2.3f, 0xb8bec6, 0, 0, 0, 12).RotateX(Mathf.PI / 2).Translate(0, 0, -1.15f));
            var hub = Child(null, "wheel", 0, HUB_Y, HUB_Z);
            Ink(hub, "eye-wheel", wheel, 0.06f);

            // The capsules: glass eggs lying along the axle, a white collar each, that stay level as the wheel turns.
            uint[] tints = { GLASS_BLUE, 0xa8dcf2, GLASS_BLUE, 0xf6a6c8, GLASS_BLUE, 0xa8dcf2, 0xffffff, GLASS_BLUE };
            var podMeshes = new Dictionary<uint, Mesh>();
            Mesh Pod(uint tint)
            {
                if (podMeshes.TryGetValue(tint, out var m)) return m;
                var tc = MeshKit.Hex(tint);
                var collar = MeshKit.Hex(0xe9ecef) * tc;
                var g = Sphere(1, tint, 0, 0, 0, 12, 7).Scale(0.62f, 0.62f, 1.05f);
                var cg = Cyl(0.68f, 0.68f, 0.18f, 0xffffff, 0, -0.09f, 0, 12).RotateX(Mathf.PI / 2);
                for (int i = 0; i < cg.C.Count; i++) cg.C[i] = new Color(collar.r, collar.g, collar.b, 1);
                g.Append(cg);
                return podMeshes[tint] = ToMesh(g, "eye-pod");
            }
            var pods = new Transform[PODS];
            for (int i = 0; i < PODS; i++)
            {
                var go = new GameObject("pod", typeof(MeshFilter), typeof(MeshRenderer));
                go.transform.SetParent(view.root, false);
                go.GetComponent<MeshFilter>().sharedMesh = Pod(tints[i % tints.Length]);
                var r = go.GetComponent<MeshRenderer>();
                r.sharedMaterials = new[] { Glass, Outline(0.05f) };
                r.shadowCastingMode = ShadowCastingMode.Off;
                view.Current.Add(r);
                pods[i] = go.transform;
            }
            void Place(float angle)
            {
                for (int i = 0; i < PODS; i++)
                {
                    float a = angle + i / (float)PODS * Mathf.PI * 2;
                    pods[i].localPosition = U(Mathf.Cos(a) * POD_R, HUB_Y + Mathf.Sin(a) * POD_R, HUB_Z);
                }
            }
            Place(0);
            view.labelY = HUB_Y + R + 2.5f;
            view.Animate = t =>
            {
                float a = -t * 0.06f; // clockwise, a turn every ~100 s
                hub.localRotation = Quaternion.Euler(0, 0, a * Mathf.Rad2Deg);
                Place(a);
            };
        }

        // ================================================================== Buckingham Palace + the Victoria Memorial

        static Material FlagMat => Mats.Cached("unionFlag", () =>
        {
            var m = Mats.Toon(Color.white, 0.1f, 0.3f, 0.15f, UnionJack(), null, false);
            m.SetFloat("_Cull", 0);
            m.SetFloat("_Translucency", 0.35f);
            return m;
        });

        /// <summary>
        /// A Union flag w × h flying east from a pole at the returned transform (its hoist edge on x = 0,
        /// centred on y): a 12 × 1 cloth that ripples more toward the fly end. Returns its wave(t).
        /// </summary>
        public static System.Action<float> UnionFlag(Transform parent, float w, float h, float phase, Vector3 classicPos, List<Renderer> group)
        {
            const int NX = 12;
            var go = new GameObject("union-flag", typeof(MeshFilter), typeof(MeshRenderer));
            go.transform.SetParent(parent, false);
            go.transform.localPosition = U(classicPos.x, classicPos.y, classicPos.z);
            var mesh = new Mesh { name = "flag" };
            var verts = new Vector3[(NX + 1) * 2];
            var uvs = new Vector2[verts.Length];
            var baseX = new float[verts.Length];
            var baseY = new float[verts.Length];
            for (int i = 0; i <= NX; i++)
                for (int j = 0; j < 2; j++)
                {
                    int k = i * 2 + j;
                    baseX[k] = i / (float)NX * w;
                    baseY[k] = (j == 0 ? -0.5f : 0.5f) * h;
                    verts[k] = new Vector3(baseX[k], baseY[k], 0);
                    uvs[k] = new Vector2(i / (float)NX, j);
                }
            var tris = new List<int>();
            for (int i = 0; i < NX; i++) { int a = i * 2; tris.AddRange(new[] { a, a + 1, a + 3, a, a + 3, a + 2 }); }
            mesh.vertices = verts;
            mesh.uv = uvs;
            var cols = new Color[verts.Length];
            for (int i = 0; i < cols.Length; i++) cols[i] = Color.white;
            mesh.colors = cols;
            mesh.SetTriangles(tris, 0);
            mesh.RecalculateNormals();
            mesh.MarkDynamic();
            go.GetComponent<MeshFilter>().sharedMesh = mesh;
            var r = go.GetComponent<MeshRenderer>();
            r.sharedMaterial = FlagMat;
            r.shadowCastingMode = ShadowCastingMode.On;
            group?.Add(r);
            return t =>
            {
                for (int k = 0; k < verts.Length; k++)
                {
                    float x = baseX[k], f = x / w;
                    float z = Mathf.Sin(x * 2.6f - t * 7 + phase) * 0.22f * w * 0.25f * f;
                    verts[k] = new Vector3(x, baseY[k] - f * f * 0.08f * h + Mathf.Sin(t * 5 + x + phase) * 0.03f * f, -z);
                }
                mesh.vertices = verts;
                mesh.RecalculateNormals();
                mesh.RecalculateBounds();
            };
        }

        static void Palace()
        {
            const uint STONE_TRIM = 0xe3d5b4, WINDOW = 0x46566b, CRIMSON = 0xb3122a, RAIL_BLACK = 0x1d1d22, MARBLE = 0xf4f2ea, LEAD = 0x9aa1a8;
            var parts = new List<G>();
            var gold = new List<G>();
            var PAL = London.PALACE;
            float Wd = PAL.w - 0.4f, back = -PAL.d / 2 + 0.1f, front = 1.3f, D = front - back, zc = (front + back) / 2, H = 6.2f;
            parts.Add(Box(Wd + 0.2f, 0.6f, D + 0.2f, STONE_TRIM, 0, 0, zc));
            parts.Add(Box(Wd, H, D, PALACE_CREAM, 0, 0, zc));
            parts.Add(Box(Wd + 0.3f, 0.3f, D + 0.3f, STONE_TRIM, 0, H, zc));
            parts.Add(Box(Wd, 0.6f, D, PALACE_CREAM, 0, H + 0.3f, zc));
            parts.Add(Box(Wd - 0.8f, 0.5f, D - 0.8f, LEAD, 0, H + 0.3f, zc));
            for (float x = -Wd / 2 + 0.4f; x <= Wd / 2 - 0.4f; x += 0.8f) parts.Add(Box(0.22f, 0.25f, 0.22f, STONE_TRIM, x, H + 0.9f, front - 0.12f));
            const float PAV = 2.4f, CEN = 5;
            foreach (int s in new[] { -1, 1 })
            {
                float px = s * (Wd / 2 - PAV / 2);
                parts.Add(Box(PAV, H, 0.4f, PALACE_CREAM, px, 0, front + 0.2f));
                parts.Add(Box(PAV + 0.1f, 0.3f, 0.5f, STONE_TRIM, px, H, front + 0.2f));
                parts.Add(Windows(2, 3, 1.05f, 1.75f, WINDOW, 0.5f, 1.0f, px, 0.7f, front + 0.4f));
                float wx = s * (CEN / 2 + (Wd / 2 - PAV - CEN / 2) / 2);
                parts.Add(Windows(3, 3, 0.95f, 1.75f, WINDOW, 0.48f, 1.0f, wx, 0.7f, front));
            }
            float cz = front + 0.5f;
            parts.Add(Box(CEN, H + 0.3f, 0.5f, PALACE_CREAM, 0, 0, front + 0.25f));
            parts.Add(Windows(4, 2, 1.15f, 1.75f, WINDOW, 0.5f, 1.0f, 0, 0.7f, cz));
            for (int i = 0; i < 6; i++)
            {
                float x = (i - 2.5f) * 0.9f;
                parts.Add(Cyl(0.17f, 0.19f, 2.6f, WHITE, x, 3.9f, cz + 0.25f, 10));
                parts.Add(Box(0.42f, 0.2f, 0.42f, STONE_TRIM, x, 6.4f, cz + 0.25f));
            }
            parts.Add(Box(CEN + 0.2f, 0.3f, 0.9f, STONE_TRIM, 0, H + 0.3f, front + 0.45f));
            parts.Add(Extrude(new Shape2().MoveTo(-CEN / 2 - 0.1f, 0).LineTo(CEN / 2 + 0.1f, 0).LineTo(0, 1.3f), 0.9f, PALACE_CREAM, 0, H + 0.6f, front + 0.45f));
            gold.Add(Sphere(0.25f, GOLD, 0, H + 0.8f, front + 0.95f, 10, 8));
            parts.Add(Box(3.4f, 0.22f, 1.1f, STONE_TRIM, 0, 3.6f, cz + 0.5f));
            parts.Add(Box(3.4f, 0.5f, 0.12f, STONE_TRIM, 0, 3.82f, cz + 1.0f));
            parts.Add(Box(3.0f, 0.85f, 0.08f, CRIMSON, 0, 2.8f, cz + 1.08f));
            gold.Add(Box(3.0f, 0.1f, 0.1f, GOLD, 0, 2.75f, cz + 1.1f));
            gold.Add(Box(3.42f, 0.08f, 0.14f, GOLD, 0, 4.3f, cz + 1.0f));
            parts.Add(Box(1.6f, 1.4f, 0.1f, 0x3a2a24, 0, 3.82f, cz + 0.02f));
            parts.Add(Cyl(0.07f, 0.09f, 4.6f, WHITE, 0, H + 0.8f, zc, 6));
            gold.Add(Sphere(0.16f, GOLD, 0, H + 5.5f, zc, 8, 6));

            float rz = PAL.d / 2 - 0.15f, gateW = 2.6f;
            foreach (int s in new[] { -1, 1 })
            {
                float x0 = s * (gateW / 2 + 0.35f), x1 = s * (PAL.w / 2 - 0.1f);
                parts.Add(Box(Mathf.Abs(x1 - x0), 0.08f, 0.08f, RAIL_BLACK, (x0 + x1) / 2, 1.15f, rz));
                parts.Add(Box(Mathf.Abs(x1 - x0), 0.08f, 0.08f, RAIL_BLACK, (x0 + x1) / 2, 0.25f, rz));
                for (float x = Mathf.Min(x0, x1) + 0.15f; x <= Mathf.Max(x0, x1); x += 0.42f)
                {
                    parts.Add(Box(0.06f, 1.25f, 0.06f, RAIL_BLACK, x, 0, rz));
                    gold.Add(Cone(0.08f, 0.2f, GOLD, x, 1.25f, rz, 4));
                }
                parts.Add(Box(0.55f, 2.3f, 0.55f, PALACE_CREAM, s * (gateW / 2 + 0.28f), 0, rz));
                parts.Add(Box(0.65f, 0.15f, 0.65f, STONE_TRIM, s * (gateW / 2 + 0.28f), 2.3f, rz));
                gold.Add(Sphere(0.22f, GOLD, s * (gateW / 2 + 0.28f), 2.65f, rz, 10, 8));
                parts.Add(Box(0.4f, 1.5f, 0.4f, PALACE_CREAM, x1 - s * 0.1f, 0, rz));
            }
            for (float x = -gateW / 2 + 0.15f; x <= gateW / 2; x += 0.26f) parts.Add(Box(0.06f, 1.8f, 0.06f, RAIL_BLACK, x, 0, rz));
            gold.Add(Box(gateW, 0.14f, 0.1f, GOLD, 0, 1.0f, rz));
            gold.Add(Box(gateW, 0.1f, 0.1f, GOLD, 0, 1.8f, rz));
            var arch = new Shape2().MoveTo(-gateW / 2, 0).QuadTo(0, 1.1f, gateW / 2, 0).LineTo(gateW / 2 - 0.2f, 0).QuadTo(0, 0.8f, -gateW / 2 + 0.2f, 0);
            gold.Add(Extrude(arch, 0.1f, GOLD, 0, 1.85f, rz));
            gold.Add(Cyl(0.38f, 0.38f, 0.1f, GOLD, 0, 0, 0, 16).RotateX(Mathf.PI / 2).Translate(0, 2.25f, rz - 0.05f));

            // Two red sentry boxes in the forecourt, open to the south, a guard in a bearskin in each.
            foreach (int s in new[] { -1, 1 })
            {
                float x = s * 3.6f, z = 2.15f;
                parts.Add(Box(1.0f, 1.9f, 0.1f, GUARD_RED, x, 0, z - 0.4f));
                parts.Add(Box(0.1f, 1.9f, 0.8f, GUARD_RED, x - 0.45f, 0, z));
                parts.Add(Box(0.1f, 1.9f, 0.8f, GUARD_RED, x + 0.45f, 0, z));
                parts.Add(Box(1.0f, 0.1f, 0.9f, WHITE, x, 0, z));
                parts.Add(Cone(0.78f, 0.5f, GUARD_RED, 0, 0, 0, 4).RotateY(Mathf.PI / 4).Translate(x, 1.9f, z));
                parts.Add(Box(1.1f, 0.08f, 1.0f, WHITE, x, 1.86f, z));
                parts.Add(Box(0.34f, 0.6f, 0.24f, RAIL_BLACK, x, 0.1f, z + 0.05f));
                parts.Add(Box(0.42f, 0.55f, 0.28f, GUARD_RED, x, 0.7f, z + 0.05f));
                parts.Add(Box(0.43f, 0.06f, 0.29f, WHITE, x, 0.98f, z + 0.05f));
                parts.Add(Sphere(0.13f, 0xf3c9a0, x, 1.38f, z + 0.06f, 10, 8));
                parts.Add(Cyl(0.17f, 0.15f, 0.5f, RAIL_BLACK, x, 1.42f, z + 0.04f, 10));
            }

            // ---- the Victoria Memorial
            var m = Rel("palace", London.VICTORIA_MEMORIAL.x, London.VICTORIA_MEMORIAL.z);
            float R = London.VICTORIA_MEMORIAL.r;
            parts.Add(Cyl(R, R, 0.3f, MARBLE, m.x, 0, m.y, 24));
            parts.Add(Cyl(R - 0.15f, R - 0.15f, 0.08f, 0x6fd0cf, m.x, 0.3f, m.y, 24));
            parts.Add(Cyl(R - 0.5f, R - 0.4f, 0.5f, MARBLE, m.x, 0.3f, m.y, 20));
            parts.Add(Box(1.8f, 0.4f, 1.8f, 0xe8e4d8, m.x, 0.8f, m.y));
            parts.Add(Box(1.5f, 3.0f, 1.5f, MARBLE, m.x, 1.2f, m.y));
            parts.Add(Box(1.75f, 0.25f, 1.75f, 0xe8e4d8, m.x, 4.2f, m.y));
            parts.Add(Cyl(0.55f, 0.7f, 1.0f, MARBLE, m.x, 4.45f, m.y, 12));
            parts.Add(Box(0.7f, 0.6f, 0.5f, MARBLE, m.x - 0.95f, 1.2f, m.y));
            parts.Add(Sphere(0.22f, MARBLE, m.x - 1.0f, 2.05f, m.y, 8, 6));
            parts.Add(Cone(0.38f, 0.75f, MARBLE, m.x - 1.0f, 1.3f, m.y, 8));
            const float top = 5.45f;
            var angel = new List<G>
            {
                Cyl(0.5f, 0.55f, 0.2f, GOLD, 0, 0, 0, 12),
                Cone(0.55f, 1.5f, GOLD, 0, 0.15f, 0, 12),
                Cyl(0.2f, 0.28f, 0.6f, GOLD, 0, 1.35f, 0, 10),
                Sphere(0.24f, GOLD, 0, 2.15f, 0, 12, 10),
                Box(0.13f, 0.9f, 0.13f, GOLD, 0.25f, 1.85f, 0.05f),
                Torus(0.24f, 0.07f, 6, 14, GOLD).Translate(0.25f, 2.98f, 0.05f),
            };
            foreach (int s in new[] { -1, 1 })
            {
                var wing = new Shape2().MoveTo(0, 0).QuadTo(s * 0.9f, 0.1f, s * 1.7f, 1.7f).QuadTo(s * 1.4f, 1.45f, s * 1.15f, 1.45f)
                    .QuadTo(s * 1.25f, 1.05f, s * 0.95f, 0.65f).QuadTo(s * 0.65f, 0.65f, s * 0.55f, 0.4f).QuadTo(s * 0.25f, 0.3f, 0, 0.35f);
                angel.Add(Extrude(wing, 0.16f, GOLD).Translate(0, 0, 0.08f).RotateY(s * 0.3f).Translate(s * 0.12f, 1.45f, -0.22f));
            }
            foreach (var g in angel) gold.Add(g.Scale(1.6f).Translate(m.x, top, m.y));

            Ink(null, "palace", parts, 0.07f);
            // The gilt shines a little of its own, like the real Victory in the sun.
            Ink(null, "palace-gold", gold, 0.05f, Mats.Cached("londonGilt", () =>
            {
                var g = Mats.Toon(Color.white, gloss: 1.2f, smooth: 0.75f, rim: 0.5f);
                g.SetColor("_RimColor", new Color(1f, 0.85f, 0.45f));
                g.SetColor("_EmissionColor", new Color(0.16f, 0.11f, 0.02f));
                return g;
            }));
            var wave = UnionFlag(view.root, 2.4f, 1.3f, 0, new Vector3(0, H + 4.6f, zc), view.Current);
            view.labelY = H + 7;
            view.Animate = wave;
        }

        // ================================================================== Trafalgar Square

        static void Trafalgar()
        {
            const uint SANDSTONE = 0xe3d7bd, SANDSTONE_SHADE = 0xc9b998, STATUE = 0xcfc5b3, BRONZE = 0x9a7444, BRONZE_DARK = 0x553820;
            const uint FACE = 0xb88f58, MUZZLE = 0xd1aa70, HAT = 0x343844, WATER = 0x6fd0e6, SPRAY = 0xd8f6ff;
            const float PLINTH_H = 1.4f;
            G Blob(float r, float sx, float sy, float sz, uint color, float x, float y, float z, int seg = 10) =>
                Sphere(r, color, 0, 0, 0, seg, Mathf.Max(6, seg - 2)).Scale(sx, sy, sz).Translate(x, y, z);

            var parts = new List<G>();
            float P = London.NELSON.r * 1.85f;
            parts.Add(Box(P + 0.4f, 0.35f, P + 0.4f, SANDSTONE_SHADE, 0, 0, 0));
            parts.Add(Box(P, 2.5f, P, SANDSTONE, 0, 0.35f, 0));
            parts.Add(Box(P + 0.3f, 0.3f, P + 0.3f, SANDSTONE_SHADE, 0, 2.85f, 0));
            parts.Add(Box(P * 0.6f, 1.0f, 0.1f, BRONZE, 0, 0.95f, P / 2));
            parts.Add(Box(P * 0.6f, 1.0f, 0.1f, BRONZE, 0, 0.95f, -P / 2));
            parts.Add(Box(0.1f, 1.0f, P * 0.6f, BRONZE, P / 2, 0.95f, 0));
            parts.Add(Box(0.1f, 1.0f, P * 0.6f, BRONZE, -P / 2, 0.95f, 0));
            const float COL_Y = 3.15f, SHAFT = 12.5f;
            parts.Add(Cyl(0.85f, 0.95f, 0.6f, SANDSTONE_SHADE, 0, COL_Y, 0, 12));
            parts.Add(Cyl(0.56f, 0.66f, SHAFT, SANDSTONE, 0, COL_Y + 0.6f, 0, 12));
            for (int i = 0; i < 12; i++)
            {
                float a = (i + 0.5f) / 12 * Mathf.PI * 2;
                parts.Add(Box(0.08f, SHAFT - 0.4f, 0.05f, SANDSTONE_SHADE).RotateY(a).Translate(Mathf.Sin(a) * 0.6f, COL_Y + 0.8f, Mathf.Cos(a) * 0.6f));
            }
            float capY = COL_Y + 0.6f + SHAFT;
            parts.Add(Lathe(new[] { 0.6f, 0, 0.75f, 0.35f, 0.95f, 0.75f, 1.05f, 0.95f, 0, 0.95f }, BRONZE, 0, capY, 0, 12));
            parts.Add(Box(2.0f, 0.3f, 2.0f, SANDSTONE, 0, capY + 0.95f, 0));
            parts.Add(Cyl(0.5f, 0.55f, 0.6f, SANDSTONE_SHADE, 0, capY + 1.25f, 0, 10));
            float nY = capY + 1.85f, sN = 1.5f;
            var nelson = new List<G>
            {
                Cyl(0.12f, 0.13f, 0.55f, STATUE, 0.12f, 0, 0, 6),
                Cyl(0.12f, 0.13f, 0.55f, STATUE, -0.12f, 0, 0, 6),
                Cyl(0.28f, 0.36f, 0.75f, STATUE, 0, 0.45f, 0, 10),
                Cyl(0.26f, 0.28f, 0.35f, STATUE, 0, 1.15f, 0, 10),
                Sphere(0.17f, STATUE, 0, 1.68f, 0, 10, 8),
                Box(0.1f, 0.55f, 0.12f, STATUE, -0.34f, 0.85f, 0.05f),
                Box(0.05f, 0.75f, 0.05f, HAT, 0.36f, 0.25f, 0.1f),
                Extrude(new Shape2().MoveTo(-0.42f, 0).QuadTo(0, 0.55f, 0.42f, 0), 0.2f, HAT, 0, 1.76f, 0),
            };
            foreach (var g in nelson) parts.Add(g.Scale(sN).Translate(0, nY, 0));
            float topY = nY + 1.76f * sN + 0.4f;
            for (int i = 0; i < 4; i++)
            {
                var l = Rel("trafalgar", London.LION_PLINTHS[i * 2], London.LION_PLINTHS[i * 2 + 1]);
                parts.Add(Box(1.95f, 0.25f, 2.3f, SANDSTONE_SHADE, l.x, 0, l.y));
                parts.Add(Box(1.75f, PLINTH_H - 0.45f, 2.1f, SANDSTONE, l.x, 0.25f, l.y));
                parts.Add(Box(1.95f, 0.2f, 2.3f, SANDSTONE_SHADE, l.x, PLINTH_H - 0.2f, l.y));
            }
            const float FX = 6.4f;
            foreach (var x in new[] { -FX, FX })
            {
                parts.Add(Cyl(1.35f, 1.45f, 0.4f, SANDSTONE, x, 0, 0, 20));
                parts.Add(Cyl(1.15f, 1.15f, 0.04f, WATER, x, 0.38f, 0, 20));
                parts.Add(Cyl(0.18f, 0.25f, 0.9f, SANDSTONE_SHADE, x, 0.4f, 0, 8));
                parts.Add(Lathe(new[] { 0.15f, 0, 0.55f, 0.15f, 0.75f, 0.35f, 0.7f, 0.4f, 0.2f, 0.3f, 0, 0.3f }, SANDSTONE, x, 1.2f, 0, 16));
            }
            Ink(null, "trafalgar", parts, 0.08f, null, true);

            // ---- the four lions, one child each (lion0..3, in LION_PLINTHS order), facing out from the column
            const float k = 1.5f;
            var lion = new List<G>
            {
                Blob(0.55f, 0.85f, 0.72f, 1.55f, BRONZE, 0, 0.42f, -0.25f),
                Blob(0.42f, 1, 0.95f, 1.1f, BRONZE, 0.3f, 0.38f, -0.8f),
                Blob(0.42f, 1, 0.95f, 1.1f, BRONZE, -0.3f, 0.38f, -0.8f),
                Box(0.26f, 0.26f, 0.95f, BRONZE, 0.27f, 0, 0.6f),
                Box(0.26f, 0.26f, 0.95f, BRONZE, -0.27f, 0, 0.6f),
                Blob(0.18f, 1.1f, 0.8f, 1.2f, FACE, 0.27f, 0.12f, 1.1f),
                Blob(0.18f, 1.1f, 0.8f, 1.2f, FACE, -0.27f, 0.12f, 1.1f),
                Blob(0.6f, 1.15f, 1.1f, 0.8f, BRONZE_DARK, 0, 0.92f, 0.35f, 12),
                Blob(0.36f, 1, 1.0f, 0.95f, FACE, 0, 0.9f, 0.72f),
                Blob(0.21f, 1.2f, 0.8f, 1, MUZZLE, 0, 0.75f, 1.02f),
                Sphere(0.08f, BRONZE_DARK, 0, 0.84f, 1.2f, 6, 4),
                Sphere(0.065f, HAT, 0.14f, 1.0f, 1.0f, 6, 4),
                Sphere(0.065f, HAT, -0.14f, 1.0f, 1.0f, 6, 4),
                Sphere(0.1f, FACE, 0.24f, 1.2f, 0.74f, 6, 4),
                Sphere(0.1f, FACE, -0.24f, 1.2f, 0.74f, 6, 4),
                Box(0.1f, 0.1f, 0.9f, BRONZE).RotateY(0.5f).Translate(0.45f, 0.05f, -1.3f),
                Sphere(0.14f, BRONZE_DARK, 0.68f, 0.1f, -0.95f, 6, 4),
            };
            for (int i = 0; i < 10; i++)
            {
                float a = i / 10f * Mathf.PI * 2;
                lion.Add(Sphere(0.2f, BRONZE_DARK, Mathf.Cos(a) * 0.62f, 0.92f + Mathf.Sin(a) * 0.58f, 0.5f, 6, 4));
            }
            foreach (var g in lion) g.Scale(k);
            var lionMesh = ToMesh(Merge(lion), "lion");
            for (int i = 0; i < 4; i++)
            {
                var l = Rel("trafalgar", London.LION_PLINTHS[i * 2], London.LION_PLINTHS[i * 2 + 1]);
                var go = new GameObject("lion" + i, typeof(MeshFilter), typeof(MeshRenderer));
                go.transform.SetParent(view.root, false);
                go.transform.localPosition = U(l.x, PLINTH_H, l.y);
                go.transform.localRotation = Rot(0, Mathf.Atan2(l.x * 0.35f, l.y), 0);
                go.GetComponent<MeshFilter>().sharedMesh = lionMesh;
                var r = go.GetComponent<MeshRenderer>();
                r.sharedMaterials = new[] { Mats.Cached("londonBronze", () => Mats.Toon(Color.white, gloss: 0.7f, smooth: 0.6f, rim: 0.35f)), Outline(0.05f) };
                view.Current.Add(r);
            }

            // ---- the water jets: a tall spout and a crown of spray each, pumping (soft: no ink)
            var jet = new List<G> { Cyl(0.07f, 0.16f, 2.2f, WATER, 0, 0, 0, 8), Sphere(0.32f, SPRAY, 0, 2.25f, 0, 8, 6), Sphere(0.22f, SPRAY, 0, 2.55f, 0, 8, 6) };
            for (int i = 0; i < 6; i++)
            {
                float a = i / 6f * Mathf.PI * 2;
                for (int j = 1; j <= 3; j++)
                {
                    float r = 0.25f + j * 0.28f, y = 2.1f - j * j * 0.2f;
                    jet.Add(Sphere(0.11f - j * 0.015f, j == 3 ? SPRAY : WATER, Mathf.Sin(a) * r, y, Mathf.Cos(a) * r, 6, 4));
                }
            }
            jet.Add(Cone(0.5f, 0.3f, SPRAY, 0, -0.1f, 0, 10));
            var jetMesh = ToMesh(Merge(jet), "fountain-jet");
            var jets = new List<Transform>();
            foreach (var x in new[] { -FX, FX })
            {
                var go = new GameObject("jet", typeof(MeshFilter), typeof(MeshRenderer));
                go.transform.SetParent(view.root, false);
                go.transform.localPosition = U(x, 1.5f, 0);
                go.GetComponent<MeshFilter>().sharedMesh = jetMesh;
                var r = go.GetComponent<MeshRenderer>();
                r.sharedMaterial = Mats.Cached("londonWater", () => { var m = Mats.Toon(Color.white, gloss: 1.4f, smooth: 0.9f, rim: 0.6f); m.SetColor("_EmissionColor", new Color(0.22f, 0.3f, 0.34f)); return m; });
                r.shadowCastingMode = ShadowCastingMode.Off;
                view.Current.Add(r);
                jets.Add(go.transform);
            }
            view.labelY = topY + 2;
            view.Animate = t =>
            {
                for (int i = 0; i < jets.Count; i++)
                {
                    float pump = 0.85f + 0.2f * Mathf.Sin(t * 5.5f + i * 2.1f) + 0.06f * Mathf.Sin(t * 13 + i);
                    float wob = 1 + 0.08f * Mathf.Sin(t * 9 + i);
                    jets[i].localScale = new Vector3(wob, pump, wob);
                }
            };
        }

        // ================================================================== St Paul's Cathedral

        static void StPauls()
        {
            const uint STONE = 0xf1ece0, STONE_SHADE = 0xd9d0bf, DOME = 0xb4bfcc, RIB = 0x8e9aa9, WINDOW = 0x4a5a6e, PIGEON = 0x8d96a3, PIGEON_WING = 0xdfe3e8;
            var d = Rel("stpauls", London.ST_PAULS_DOME.x, London.ST_PAULS_DOME.z);
            var n = Rel("stpauls", London.ST_PAULS_NAVE.x, London.ST_PAULS_NAVE.z);
            float R = London.ST_PAULS_DOME.r, Wd = London.ST_PAULS_NAVE.w, D = London.ST_PAULS_NAVE.d, west = n.x - Wd / 2;
            const float NAVE_H = 6.5f;
            G Turned(G g, float rotY, float x, float y, float z) => g.RotateY(rotY).Translate(x, y, z);
            var parts = new List<G>
            {
                Box(Wd + 0.6f, NAVE_H, D, STONE, n.x + 0.3f, 0, n.y),
                Box(Wd + 0.8f, 0.3f, D + 0.3f, STONE_SHADE, n.x + 0.3f, 3.1f, n.y),
                Box(Wd + 0.8f, 0.45f, D + 0.4f, STONE, n.x + 0.3f, NAVE_H, n.y),
                Windows(4, 1, 2.1f, 2.6f, WINDOW, 0.9f, 1.8f, n.x + 0.6f, 0.2f, n.y + D / 2, 0, true),
                Windows(4, 1, 2.1f, 2.6f, WINDOW, 0.8f, 1.5f, n.x + 0.6f, 3.5f, n.y + D / 2, 0, true),
                Extrude(new Shape2().MoveTo(-D / 2 + 0.1f, 0).LineTo(D / 2 - 0.1f, 0).LineTo(0, 1.5f), Wd - 1, DOME, n.x + 0.8f, NAVE_H + 0.45f, n.y, Mathf.PI / 2),
            };
            foreach (int s in new[] { -1, 1 })
            {
                float tz = n.y + s * 1.45f, tx = west + 1.1f;
                parts.Add(Box(2.2f, 9, 2.2f, STONE, tx, 0, tz));
                parts.Add(Box(2.5f, 0.35f, 2.5f, STONE_SHADE, tx, 9, tz));
                parts.Add(Windows(1, 2, 2, 3, WINDOW, 0.8f, 1.6f, tx, 0.4f, tz + 1.1f, 0, true));
                parts.Add(Cyl(0.85f, 0.85f, 1.8f, STONE_SHADE, tx, 9.35f, tz, 12));
                parts.Add(Lathe(new[] { 1.0f, 0, 1.0f, 0.25f, 0.8f, 0.5f, 0.85f, 0.9f, 0.55f, 1.4f, 0.2f, 1.9f, 0.12f, 2.3f, 0, 2.4f }, DOME, tx, 11.15f, tz, 12));
                parts.Add(Sphere(0.22f, GOLD, tx, 13.7f, tz, 8, 6));
                for (int i = 0; i < 8; i++)
                {
                    float a = i / 8f * Mathf.PI * 2;
                    parts.Add(Cyl(0.12f, 0.12f, 1.8f, STONE, tx + Mathf.Sin(a) * 0.95f, 9.35f, tz + Mathf.Cos(a) * 0.95f, 6));
                }
            }
            float px = west - 0.35f;
            parts.Add(Box(0.8f, 0.35f, 3.0f, STONE, px, 0, n.y));
            for (int i = 0; i < 6; i++) parts.Add(Cyl(0.16f, 0.18f, 3.2f, STONE, px, 0.35f, n.y - 1.25f + i * 0.5f, 8));
            parts.Add(Box(0.9f, 0.45f, 3.2f, STONE, px, 3.55f, n.y));
            for (int i = 0; i < 4; i++) parts.Add(Cyl(0.15f, 0.16f, 2.4f, STONE, px, 4.0f, n.y - 0.9f + i * 0.6f, 8));
            parts.Add(Box(0.9f, 0.4f, 2.6f, STONE, px, 6.4f, n.y));
            parts.Add(Extrude(new Shape2().MoveTo(-1.45f, 0).LineTo(1.45f, 0).LineTo(0, 1.1f), 0.8f, STONE, px, 6.8f, n.y, Mathf.PI / 2));

            parts.Add(Cyl(R, R, NAVE_H, STONE, d.x, 0, d.y, 32));
            parts.Add(Cyl(R + 0.2f, R + 0.2f, 0.45f, STONE, d.x, NAVE_H, d.y, 32));
            for (int i = 0; i < 12; i++)
            {
                float a = i / 12f * Mathf.PI * 2;
                parts.Add(Turned(Windows(1, 1, 1, 2.6f, WINDOW, 0.8f, 1.9f, 0, 0, 0, 0, true), a, d.x + Mathf.Sin(a) * R, 2.4f, d.y + Mathf.Cos(a) * R));
            }
            float drumY = NAVE_H + 0.45f, COLR = R - 0.45f;
            parts.Add(Cyl(R - 0.1f, R - 0.1f, 0.5f, STONE, d.x, drumY, d.y, 32));
            parts.Add(Cyl(R - 1.1f, R - 1.1f, 3.2f, STONE_SHADE, d.x, drumY + 0.5f, d.y, 24));
            parts.Add(Cyl(R - 0.05f, R - 0.05f, 0.55f, STONE, d.x, drumY + 3.3f, d.y, 32));
            parts.Add(Cyl(R - 0.8f, R - 0.8f, 1.3f, STONE, d.x, drumY + 3.85f, d.y, 28));
            parts.Add(Cyl(R - 0.65f, R - 0.65f, 0.25f, STONE, d.x, drumY + 5.15f, d.y, 28));
            for (int i = 0; i < 24; i++)
            {
                float a = i / 24f * Mathf.PI * 2;
                parts.Add(Cyl(0.2f, 0.22f, 2.8f, STONE, d.x + Mathf.Sin(a) * COLR, drumY + 0.5f, d.y + Mathf.Cos(a) * COLR, 8));
            }
            for (int i = 0; i < 16; i++)
            {
                float a = i / 16f * Mathf.PI * 2 + 0.2f;
                parts.Add(Turned(Windows(1, 1, 1, 1, WINDOW, 0.45f, 0.65f), a, d.x + Mathf.Sin(a) * (R - 0.8f), drumY + 4.0f, d.y + Mathf.Cos(a) * (R - 0.8f)));
            }
            float domeY = drumY + 5.4f, DR = R - 0.85f, LIFT = 1.3f;
            parts.Add(Sphere(DR, DOME, 0, 0, 0, 32, 12, Mathf.PI * 2, Mathf.PI / 2).Scale(1, LIFT, 1).Translate(d.x, domeY, d.y));
            for (int i = 0; i < 16; i++)
                parts.Add(Sphere(DR + 0.06f, RIB, 0, 0, 0, 1, 12, 0.09f, Mathf.PI / 2 - 0.12f).RotateY(i / 16f * Mathf.PI * 2).Scale(1, LIFT, 1).Translate(d.x, domeY, d.y));
            float topY = domeY + DR * LIFT - 0.1f;
            parts.Add(Cyl(0.95f, 1.1f, 0.35f, STONE, d.x, topY, d.y, 12));
            parts.Add(Cyl(0.65f, 0.7f, 1.6f, STONE, d.x, topY + 0.35f, d.y, 10));
            parts.Add(Cyl(0.85f, 0.85f, 0.2f, STONE, d.x, topY + 1.95f, d.y, 10));
            parts.Add(Sphere(0.7f, DOME, d.x, topY + 2.15f, d.y, 10, 6, Mathf.PI * 2, Mathf.PI / 2));
            parts.Add(Cone(0.22f, 0.8f, DOME, d.x, topY + 2.7f, d.y, 8));
            parts.Add(Sphere(0.5f, GOLD, d.x, topY + 3.75f, d.y, 12, 8));
            parts.Add(Box(0.22f, 1.5f, 0.22f, GOLD, d.x, topY + 4.15f, d.y));
            parts.Add(Box(0.95f, 0.22f, 0.22f, GOLD, d.x, topY + 5.0f, d.y));
            float crossTop = topY + 5.65f;
            Ink(null, "stpauls", parts, 0.1f);

            // ---- the pigeons: one little flock circling the dome
            var birds = new List<G>();
            const int FLOCK = 7;
            for (int i = 0; i < FLOCK; i++)
            {
                float a = i / (float)FLOCK * Mathf.PI * 2 + (i % 2) * 0.3f, r = R + 2 + (i % 3) * 0.7f;
                float y = domeY + 0.5f + (i * 5 % 7) * 0.6f;
                float heading = Mathf.Atan2(Mathf.Cos(a), -Mathf.Sin(a));
                var bird = new[]
                {
                    Sphere(0.3f, PIGEON, 0, 0, 0, 8, 6).Scale(0.8f, 0.75f, 1.5f),
                    Sphere(0.2f, PIGEON, 0, 0.18f, 0.42f, 8, 6),
                    Cone(0.08f, 0.2f, GOLD, 0, 0, 0, 4).RotateX(Mathf.PI / 2).Translate(0, 0.15f, 0.55f),
                    Box(1.4f, 0.06f, 0.4f, PIGEON_WING, 0, 0.05f, 0).RotateZ(i % 2 == 1 ? 0.25f : -0.25f),
                    Box(0.35f, 0.05f, 0.35f, PIGEON_WING, 0, 0, -0.55f),
                };
                foreach (var b in bird) birds.Add(Turned(b, heading, Mathf.Sin(a) * r, y, Mathf.Cos(a) * r));
            }
            var flock = Child(null, "flock", d.x, 0, d.y);
            Ink(flock, "pigeons", birds, 0.04f, null, false, false);
            view.labelY = crossTop + 2.5f;
            view.Animate = t =>
            {
                flock.localRotation = Rot(0, t * 0.45f, Mathf.Sin(t * 0.7f) * 0.05f);
                flock.localPosition = U(d.x, Mathf.Sin(t * 1.3f) * 0.5f, d.y);
            };
        }

        // ================================================================== the Tower of London

        static void Tower()
        {
            const uint KEEP = 0xf6f3ea, KEEP_SHADE = 0xded7c6, WALL = 0xbdb3a0, WALL_TOP = 0xa79d89, LEAD = 0x6b7482, DARK = 0x2f2f38, RAVEN = 0x22232c, BEAK = 0x4c4d58;
            float w = London.TOWER.w, d = London.TOWER.d;
            const float T = 0.9f, WH = 3.2f;
            var parts = new List<G>();
            void RoundTower(float x, float z, float r, float h)
            {
                parts.Add(Cyl(r, r + 0.1f, h, WALL, x, 0, z, 14));
                parts.Add(Cyl(r + 0.12f, r + 0.12f, 0.25f, WALL_TOP, x, h, z, 14));
                for (int i = 0; i < 7; i++)
                {
                    float a = i / 7f * Mathf.PI * 2;
                    parts.Add(Box(0.5f, 0.5f, 0.4f, WALL).RotateY(a).Translate(x + Mathf.Sin(a) * (r - 0.1f), h + 0.25f, z + Mathf.Cos(a) * (r - 0.1f)));
                }
            }
            void Cupola(float x, float y, float z)
            {
                parts.Add(Lathe(new[] { 0.85f, 0, 0.95f, 0.25f, 0.95f, 0.55f, 0.7f, 0.95f, 0.35f, 1.25f, 0.14f, 1.5f, 0.08f, 1.75f, 0, 1.8f }, LEAD, x, y, z, 14));
                parts.Add(Cyl(0.04f, 0.04f, 1.0f, GOLD, x, y + 1.75f, z, 5));
                parts.Add(Sphere(0.13f, GOLD, x, y + 1.95f, z, 8, 6));
                parts.Add(Box(0.55f, 0.3f, 0.05f, GOLD, x + 0.3f, y + 2.25f, z));
                parts.Add(Cone(0.12f, 0.25f, GOLD, x, y + 2.7f, z, 6));
            }
            parts.Add(Box(w, WH, T, WALL, 0, 0, -d / 2 + T / 2));
            parts.Add(Box(w, WH, T, WALL, 0, 0, d / 2 - T / 2));
            parts.Add(Box(T, WH, d, WALL, -w / 2 + T / 2, 0, 0));
            parts.Add(Box(T, WH, d, WALL, w / 2 - T / 2, 0, 0));
            parts.Add(Crenellations(w, d, WALL, 0, WH, 0, 0.5f));
            parts.Add(Box(w - 2 * T, 0.08f, d - 2 * T, PARK, 0, 0, 0));
            foreach (var (x, z) in new[] { (-w / 2 + 0.6f, -d / 2 + 0.6f), (w / 2 - 0.6f, -d / 2 + 0.6f), (w / 2 - 0.6f, d / 2 - 0.6f), (-w / 2 + 0.6f, d / 2 - 0.6f) }) RoundTower(x, z, 1.25f, 4.3f);
            RoundTower(-w / 2 + 0.3f, 0, 0.95f, 3.9f);
            RoundTower(w / 2 - 0.3f, 0, 0.95f, 3.9f);
            float gx = 3.6f, gz = d / 2 - 0.75f;
            parts.Add(Box(3.2f, 4.6f, 1.5f, WALL, gx, 0, gz));
            parts.Add(Crenellations(3.2f, 1.5f, WALL, gx, 4.6f, gz, 0.45f));
            parts.Add(Extrude(new Shape2().MoveTo(-0.8f, 0).LineTo(0.8f, 0).LineTo(0.8f, 1.4f).AbsArc(0, 1.4f, 0.8f, 0, Mathf.PI).LineTo(-0.8f, 0), 0.12f, DARK, gx, 0, gz + 0.75f));
            for (int i = 0; i < 4; i++) parts.Add(Box(0.07f, 2.0f, 0.06f, GOLD, gx - 0.54f + i * 0.36f, 0.1f, gz + 0.84f));
            parts.Add(Box(1.5f, 0.07f, 0.06f, GOLD, gx, 0.9f, gz + 0.84f));
            parts.Add(Box(1.5f, 0.07f, 0.06f, GOLD, gx, 1.6f, gz + 0.84f));
            const float kz = -0.6f, KW = 7.2f, KD = 6.2f, KH = 7.6f;
            parts.Add(Box(KW, KH, KD, KEEP, 0, 0, kz));
            parts.Add(Crenellations(KW, KD, KEEP, 0, KH, kz, 0.5f));
            parts.Add(Box(KW + 0.2f, 0.25f, KD + 0.2f, KEEP_SHADE, 0, KH - 0.25f, kz));
            parts.Add(Windows(4, 3, 1.45f, 2.1f, DARK, 0.5f, 1.0f, 0, 0.9f, kz + KD / 2, 0, true));
            parts.Add(Windows(3, 3, 1.5f, 2.1f, DARK, 0.55f, 1.0f, KW / 2, 0.9f, kz, Mathf.PI / 2, true));
            parts.Add(Windows(3, 3, 1.5f, 2.1f, DARK, 0.55f, 1.0f, -KW / 2, 0.9f, kz, -Mathf.PI / 2, true));
            foreach (var x in new[] { -1.45f, 1.45f }) parts.Add(Box(0.35f, KH - 0.3f, 0.2f, KEEP_SHADE, x, 0, kz + KD / 2));
            float TH = KH + 2.3f;
            foreach (var (x, z) in new[] { (-KW / 2, kz - KD / 2), (KW / 2, kz - KD / 2), (KW / 2, kz + KD / 2), (-KW / 2, kz + KD / 2) })
            {
                if (x > 0 && z < kz) parts.Add(Cyl(0.95f, 0.95f, TH, KEEP, x, 0, z, 14));
                else parts.Add(Box(1.7f, TH, 1.7f, KEEP, x, 0, z));
                parts.Add(Cyl(1.0f, 1.0f, 0.3f, KEEP_SHADE, x, TH, z, 14));
                Cupola(x, TH + 0.3f, z);
            }
            parts.Add(Box(1.4f, 0.3f, 0.8f, KEEP_SHADE, 0, 0, kz + KD / 2 + 0.4f));
            parts.Add(Extrude(new Shape2().MoveTo(-0.4f, 0).LineTo(0.4f, 0).LineTo(0.4f, 1.0f).AbsArc(0, 1.0f, 0.4f, 0, Mathf.PI).LineTo(-0.4f, 0), 0.1f, TIMBER, 0, 0.3f, kz + KD / 2 + 0.03f));
            const float M = 1.6f;
            parts.Add(Box(w + 2 * M, 0.05f, M, PARK, 0, 0, -d / 2 - M / 2));
            parts.Add(Box(M, 0.05f, d, PARK, -w / 2 - M / 2, 0, 0));
            parts.Add(Box(M, 0.05f, d, PARK, w / 2 + M / 2, 0, 0));
            Ink(null, "tower", parts, 0.1f);

            // ---- the six ravens, hopping and pecking on the wall walks (and one on the lawn)
            var raven = new List<G>
            {
                Sphere(0.28f, RAVEN, 0, 0, 0, 10, 8).Scale(0.8f, 0.85f, 1.4f).Translate(0, 0.38f, 0),
                Sphere(0.18f, RAVEN, 0, 0.66f, 0.32f, 8, 6),
                Cone(0.07f, 0.3f, BEAK, 0, 0, 0, 6).RotateX(Mathf.PI / 2).Translate(0, 0.62f, 0.45f),
                Sphere(0.045f, WHITE, 0.12f, 0.7f, 0.4f, 6, 4),
                Sphere(0.045f, WHITE, -0.12f, 0.7f, 0.4f, 6, 4),
                Box(0.22f, 0.05f, 0.4f, RAVEN, 0, 0.32f, -0.5f).RotateX(-0.3f),
                Cyl(0.03f, 0.03f, 0.18f, BEAK, 0.08f, 0, 0.02f, 4),
                Cyl(0.03f, 0.03f, 0.18f, BEAK, -0.08f, 0, 0.02f, 4),
            };
            foreach (var g in raven) g.Scale(1.6f);
            var ravenMesh = ToMesh(Merge(raven), "raven");
            float Walk(float wall) => wall - T * 0.3f;
            // The first two are the hunting pair's perches (RAVEN_PERCHES), on the south wall walk.
            var perch0 = new Vector2(-1.2f, d / 2 - 0.27f);
            var perch1 = new Vector2(4.6f, d / 2 - 0.27f);
            const float PERCH_Y = 3.2f;
            var spots = new[]
            {
                (perch0.x, PERCH_Y, perch0.y, 0.4f), (perch1.x, PERCH_Y, perch1.y, -0.5f),
                (-Walk(w / 2), WH, -2.6f, -1.3f), (Walk(w / 2), WH, 2.4f, 1.2f), (-2.5f, WH, -Walk(d / 2), 0.3f), (-4.6f, 0.08f, 3.8f, 0.8f),
            };
            var birds = new Transform[spots.Length];
            for (int i = 0; i < spots.Length; i++)
            {
                var go = new GameObject("raven" + i, typeof(MeshFilter), typeof(MeshRenderer));
                go.transform.SetParent(view.root, false);
                go.GetComponent<MeshFilter>().sharedMesh = ravenMesh;
                var r = go.GetComponent<MeshRenderer>();
                r.sharedMaterials = new[] { Mats.Cached("londonRaven", () => Mats.Toon(Color.white, gloss: 0.9f, smooth: 0.75f, rim: 0.5f)), Outline(0.04f) };
                r.shadowCastingMode = ShadowCastingMode.Off;
                view.Current.Add(r);
                birds[i] = go.transform;
            }
            void Place(float t)
            {
                for (int i = 0; i < spots.Length; i++)
                {
                    var (x, y, z, h) = spots[i];
                    float period = 2.4f + i * 0.37f, clock = t + i * 1.7f, u = clock % period;
                    int hop = Mathf.FloorToInt(clock / period);
                    bool hopping = u < 0.32f;
                    float lift = hopping ? Mathf.Sin(Mathf.PI * u / 0.32f) * 0.45f : 0;
                    float turn = 0.7f * Mathf.Sin(hop * 2.3f + i);
                    float peck = u > 1.1f && u < 1.6f ? Mathf.Sin(Mathf.PI * (u - 1.1f) / 0.5f) * 0.55f : 0;
                    float bob = Mathf.Sin(clock * 7) * 0.04f;
                    birds[i].localPosition = U(x, y + lift, z);
                    // three's 'YXZ' order: the turn round, then the peck forward.
                    birds[i].localRotation = Quaternion.Euler(0, -(h + turn) * Mathf.Rad2Deg, 0) * Quaternion.Euler(-(peck + bob) * Mathf.Rad2Deg, 0, 0);
                }
            }
            Place(0);
            view.labelY = TH + 4.5f;
            view.Animate = Place;
        }

        // ================================================================== Tower Bridge

        static void TowerBridge()
        {
            const uint STONE = 0xd3cec3, STONE_DARK = 0xa9a397, ROOF = 0x4b5463, WINDOW = 0x3d4658;
            const float LEG_Z = 4.2f, LEG_D = 2.4f, HALF_D = LEG_Z + LEG_D / 2, TW = 4.0f, BODY_TOP = 13.5f, WALK_Y = 11.0f, WALK_H = 1.9f, WALK_Z = 3.2f;
            var parts = new List<G>();
            void Tower1(List<G> p)
            {
                float ax = LEG_Z - LEG_D / 2;
                var s = new Shape2().MoveTo(-HALF_D, -1).LineTo(-ax, -1).LineTo(-ax, 4.0f).QuadTo(-ax * 0.75f, 6.0f, 0, 6.6f).QuadTo(ax * 0.75f, 6.0f, ax, 4.0f)
                    .LineTo(ax, -1).LineTo(HALF_D, -1).LineTo(HALF_D, 7.5f).LineTo(-HALF_D, 7.5f);
                p.Add(Extrude(s, TW - 0.4f, STONE, 0, 0, 0, Mathf.PI / 2));
                foreach (int sz in new[] { -1, 1 })
                {
                    p.Add(Box(TW + 0.4f, 0.9f, LEG_D + 0.4f, STONE_DARK, 0, -0.9f, sz * LEG_Z));
                    p.Add(Box(TW - 0.2f, 0.25f, LEG_D + 0.15f, STONE_DARK, 0, 4.0f, sz * LEG_Z));
                }
                p.Add(Box(TW, BODY_TOP - 7.5f, HALF_D * 2, STONE, 0, 7.5f, 0));
                p.Add(Box(TW + 0.2f, 0.3f, HALF_D * 2 + 0.2f, STONE_DARK, 0, 7.5f, 0));
                p.Add(Box(TW + 0.2f, 0.3f, HALF_D * 2 + 0.2f, STONE_DARK, 0, BODY_TOP - 0.3f, 0));
                foreach (int sz in new[] { -1, 1 })
                {
                    float rot = sz > 0 ? 0 : Mathf.PI;
                    p.Add(Windows(2, 2, 1.3f, 2.6f, WINDOW, 0.6f, 1.8f, 0, 7.9f, sz * HALF_D, rot, true));
                    p.Add(Windows(1, 2, 1.3f, 2.6f, WINDOW, 0.55f, 1.5f, 0, 0.6f, sz * HALF_D, rot, true));
                }
                foreach (int sx in new[] { -1, 1 }) p.Add(Windows(5, 2, 1.9f, 2.6f, WINDOW, 0.6f, 1.7f, sx * (TW / 2), 7.9f, 0, sx * Mathf.PI / 2, true));
                float hw = TW / 2 - 0.3f, hd = HALF_D - 0.5f;
                p.Add(Pyramid(hw, hd, 3.0f, ROOF, 0, BODY_TOP, 0));
                p.Add(Box(0.9f, 0.9f, 0.9f, STONE, 0, BODY_TOP + 2.2f, 0));
                p.Add(Cone(0.7f, 1.5f, ROOF, 0, 0, 0, 4).RotateY(Mathf.PI / 4).Translate(0, BODY_TOP + 3.1f, 0));
                p.Add(Cyl(0.05f, 0.05f, 2.4f, WHITE, 0, BODY_TOP + 4.4f, 0, 6));
                p.Add(Sphere(0.12f, GOLD, 0, BODY_TOP + 6.8f, 0, 6, 4));
                foreach (int sx in new[] { -1, 1 })
                    foreach (int sz in new[] { -1, 1 })
                    {
                        float x = sx * (TW / 2 - 0.05f), z = sz * (HALF_D - 0.05f);
                        p.Add(Cyl(0.62f, 0.62f, BODY_TOP + 1.4f - 4.0f, STONE, x, 4.0f, z, 8));
                        p.Add(Cyl(0.72f, 0.72f, 0.25f, STONE_DARK, x, BODY_TOP + 1.2f, z, 8));
                        p.Add(Cone(0.7f, 3.0f, ROOF, x, BODY_TOP + 1.45f, z, 8));
                        p.Add(Cone(0.11f, 0.7f, GOLD, x, BODY_TOP + 4.3f, z, 6));
                    }
            }
            var west = Rel("towerbridge", London.TOWER_BRIDGE_TOWERS[0], London.TOWER_BRIDGE_TOWERS[1]);
            var east = Rel("towerbridge", London.TOWER_BRIDGE_TOWERS[2], London.TOWER_BRIDGE_TOWERS[3]);
            foreach (var c in new[] { west, east })
            {
                var p = new List<G>();
                Tower1(p);
                foreach (var g in p) parts.Add(g.Translate(c.x, 0, c.y));
            }
            float x0 = west.x + TW / 2, x1 = east.x - TW / 2, len = x1 - x0, xm = (x0 + x1) / 2;
            const int bays = 4;
            foreach (int sz in new[] { -1, 1 })
            {
                float z = sz * WALK_Z;
                parts.Add(Box(len + 0.2f, WALK_H, 1.7f, SKY_BLUE, xm, WALK_Y, z));
                parts.Add(Box(len + 0.2f, 0.22f, 1.95f, 0x4a8fc4, xm, WALK_Y + WALK_H, z));
                parts.Add(Box(len + 0.2f, 0.22f, 1.95f, 0x4a8fc4, xm, WALK_Y - 0.12f, z));
                foreach (int fz in new[] { -1, 1 })
                {
                    float zf = z + fz * 0.88f;
                    for (int i = 0; i < bays; i++)
                    {
                        float xa = x0 + i / (float)bays * len, xb = x0 + (i + 1) / (float)bays * len;
                        parts.Add(Beam(new Vector3(xa, WALK_Y + 0.1f, zf), new Vector3(xb, WALK_Y + WALK_H - 0.1f, zf), 0.14f, NAVY));
                        parts.Add(Beam(new Vector3(xa, WALK_Y + WALK_H - 0.1f, zf), new Vector3(xb, WALK_Y + 0.1f, zf), 0.14f, NAVY));
                    }
                }
            }
            float ab = London.TOWER_BRIDGE.w / 2 - 1.0f;
            foreach (int sz in new[] { -1, 1 })
            {
                float z = sz * 3.35f;
                foreach (var (c, dx) in new[] { (west, -1f), (east, 1f) })
                {
                    float xt = c.x + dx * (TW / 2), xa = dx * ab;
                    var pts = new List<Vector3> { new Vector3(xt, 10.8f, z), new Vector3(xt + dx * 1.1f, 6.2f, z), new Vector3((xt + xa) / 2, 2.6f, z), new Vector3(xa - dx * 1.0f, 2.9f, z), new Vector3(xa, 4.3f, z) };
                    var path = new List<Vector3>();
                    for (int i = 0; i <= 24; i++) path.Add(CatmullRom(pts, i / 24f));
                    parts.Add(Tube(path, 0.22f, 6, SKY_BLUE));
                    foreach (var u in new[] { 0.25f, 0.4f, 0.55f, 0.7f })
                    {
                        var p = CatmullRom(pts, u);
                        parts.Add(Box(0.08f, p.y - 0.05f, 0.08f, NAVY, p.x, 0.05f, z));
                    }
                    float az = sz * 3.85f;
                    parts.Add(Box(1.1f, 4.3f, 1.0f, STONE, xa, 0, az));
                    parts.Add(Box(1.3f, 0.2f, 1.2f, STONE_DARK, xa, 4.3f, az));
                    parts.Add(Cone(0.8f, 1.2f, ROOF, 0, 0, 0, 4).RotateY(Mathf.PI / 4).Translate(xa, 4.5f, az));
                    parts.Add(Cone(0.08f, 0.5f, GOLD, xa, 5.7f, az, 6));
                }
            }
            Ink(null, "towerbridge", parts, 0.09f);
            var waves = new List<System.Action<float>>();
            int k = 0;
            foreach (var c in new[] { west, east }) waves.Add(UnionFlag(view.root, 1.6f, 0.9f, k++ * 1.7f, new Vector3(c.x + 0.05f, BODY_TOP + 6.3f, c.y), view.Current));
            view.labelY = BODY_TOP + 9;
            view.Animate = t => { foreach (var w in waves) w(t); };
        }

        // ================================================================== the Shard

        static void Shard()
        {
            const float H = 28;
            float HALF = London.SHARD.w / 2 + 0.4f;
            const int ROWS = 20, COLS = 3;
            const uint GLASS = GLASS_BLUE, GLASS_DEEP = 0x74b4dc, STREAK = 0xc4e6f7, LINE = 0xf4fbff, LIT = 0xffe39a, INSIDE = 0x4f7f9c;
            var parts = new List<G>();
            G ShardSlab(Vector3 b0, Vector3 b1, Vector3 t0, Vector3 t1, Vector3 outDir, int seed)
            {
                var g = new G();
                void Tri(Vector3 a, Vector3 b, Vector3 c, uint hex)
                {
                    var n = Vector3.Cross(b - a, c - a).normalized;
                    var col = MeshKit.Hex(hex);
                    g.Tri(g.Add(a, n, col), g.Add(b, n, col), g.Add(c, n, col));
                }
                void Quad(Vector3 p00, Vector3 p10, Vector3 p11, Vector3 p01, uint hex) { Tri(p00, p10, p11, hex); Tri(p00, p11, p01, hex); }
                Vector3 At(float u, float v) => Vector3.Lerp(Vector3.Lerp(b0, b1, u), Vector3.Lerp(t0, t1, u), v);
                const float thick = 0.6f;
                Vector3 Inner(Vector3 p, float v) => p - outDir * thick * (1 - v * 0.6f);
                const float lineFrac = 0.1f;
                for (int r = 0; r < ROWS; r++)
                {
                    float v0 = r / (float)ROWS, vl = (r + 1 - lineFrac) / ROWS, v1 = (r + 1) / (float)ROWS;
                    for (int k = 0; k < COLS; k++)
                    {
                        float u0 = k / (float)COLS, u1 = (k + 1) / (float)COLS;
                        bool streak = (k + r + seed) % 5 == 0 || (k * 2 + r * 3 + seed) % 11 == 0;
                        bool lit = r < ROWS * 0.6f && (r * 7 + k * 5 + seed * 3) % 23 == 0;
                        uint hex = lit ? LIT : streak ? STREAK : seed % 2 == 1 ? GLASS_DEEP : GLASS;
                        Quad(At(u0, v0), At(u1, v0), At(u1, vl), At(u0, vl), hex);
                        Quad(At(u0, vl), At(u1, vl), At(u1, v1), At(u0, v1), LINE);
                    }
                }
                Vector3 o00 = At(0, 0), o10 = At(1, 0), o01 = At(0, 1), o11 = At(1, 1);
                Vector3 i00 = Inner(o00, 0), i10 = Inner(o10, 0), i01 = Inner(o01, 1), i11 = Inner(o11, 1);
                Quad(i10, i00, i01, i11, INSIDE);
                Quad(i00, o00, o01, i01, GLASS);
                Quad(o10, i10, i11, o11, GLASS);
                Quad(o01, o11, i11, i01, LINE);
                return g;
            }
            var sides = new[]
            {
                (new Vector3(0, 0, 1), new Vector3(1, 0, 0)), (new Vector3(1, 0, 0), new Vector3(0, 0, -1)),
                (new Vector3(0, 0, -1), new Vector3(-1, 0, 0)), (new Vector3(-1, 0, 0), new Vector3(0, 0, 1)),
            };
            float[] tops = { H - 2.2f, H, H - 1.2f, H - 3.2f, H - 0.6f, H - 2.6f, H - 1.6f, H - 0.2f };
            for (int i = 0; i < 4; i++)
            {
                var (dir, along) = sides[i];
                for (int half = 0; half < 2; half++)
                {
                    float proud = half == 1 ? 0.5f : 0, gap = 0.12f;
                    float uA = half == 0 ? -HALF : gap, uB = half == 0 ? -gap : HALF;
                    float outv = HALF - 0.1f + proud;
                    var b0 = dir * outv + along * uA;
                    var b1 = dir * outv + along * uB;
                    float top = tops[i * 2 + half];
                    float tOut = 0.85f + proud * 0.6f, tA = half == 0 ? -1.05f : 0.08f, tB = half == 0 ? -0.08f : 1.05f;
                    var t0 = dir * tOut + along * tA; t0.y = top;
                    var t1 = dir * tOut + along * tB; t1.y = top;
                    parts.Add(ShardSlab(b0, b1, t0, t1, dir, i * 2 + half));
                }
            }
            parts.Add(Cyl(0.12f, 0.35f, 5.5f, SLATE, 0, H - 5, 0, 6));
            parts.Add(Box(3.2f, 0.25f, 1.1f, SLATE, 0, 2.2f, HALF + 0.6f));
            parts.Add(Box(2.4f, 2.2f, 0.15f, 0x2f4d63, 0, 0, HALF + 0.3f));
            var merged = Merge(parts);
            var glassR = Ink(null, "shard", new List<G> { merged }, 0.1f, Glass);
            var mesh = glassR.GetComponent<MeshFilter>().sharedMesh;
            mesh.MarkDynamic();
            var baseCol = merged.C.ToArray();
            var cols = (Color[])baseCol.Clone();
            var ys = new float[merged.P.Count];
            var xs = new float[merged.P.Count];
            for (int i = 0; i < ys.Length; i++) { ys[i] = merged.P[i].y; xs[i] = merged.P[i].x; }

            // The aircraft-warning light: a little self-lit red bead that blinks.
            var bead = Emit(view.root, "warning-light", L(Sphere(0.3f, 0xffffff, 0, H - 5 + 5.5f + 0.25f, 0, 10, 8)), 0,
                Mats.Cached("shardBead", () => Mats.Toon(new Color(0.6f, 0.08f, 0.05f), 0.5f, 0.6f, 0, null, null, false)), false, false);
            view.Current.Add(bead);
            var beadBlock = new MaterialPropertyBlock();
            const float PERIOD = H + 16;
            float lastBand = -1;
            view.labelY = H + 4;
            view.Animate = t =>
            {
                // A soft band of sky (and a fainter echo) climbing the glass about 5 m a second.
                float head = (t * 5) % PERIOD - 8;
                if (Mathf.Abs(head - lastBand) > 0.15f && glassR.isVisible)
                {
                    lastBand = head;
                    for (int i = 0; i < ys.Length; i++)
                    {
                        float d = ys[i] + xs[i] * 0.35f - head;
                        float band = Mathf.Max(0, 1 - Mathf.Abs(d) / 3.5f) * 0.55f + Mathf.Max(0, 1 - Mathf.Abs(d + 9) / 2) * 0.25f;
                        var b = baseCol[i];
                        cols[i] = band > 0 ? new Color(b.r + (1 - b.r) * band, b.g + (1 - b.g) * band, b.b + (1 - b.b) * band, 1) : b;
                    }
                    mesh.colors = cols;
                }
                bool on = t % 1.6f < 0.45f;
                bead.GetPropertyBlock(beadBlock);
                beadBlock.SetColor("_EmissionColor", on ? new Color(3.5f, 0.35f, 0.2f) : new Color(0.25f, 0.03f, 0.02f));
                bead.SetPropertyBlock(beadBlock);
            };
        }

        // ================================================================== the Gherkin

        static void Gherkin()
        {
            const float H = 22;
            float R = London.GHERKIN.r;
            const int SEGMENTS = 48, SPIRALS = 6;
            const uint GREEN = PICKLE_GREEN, DARK = 0x2f6b2a, LATTICE = 0x9fd27a, CAP = 0x22383f, LOBBY = 0x26442c;
            var ctrl = new[]
            {
                new Vector2(R * 0.84f, 0), new Vector2(R * 0.98f, 3), new Vector2(R * 1.08f, 7), new Vector2(R * 1.06f, 10), new Vector2(R * 0.94f, 13.5f),
                new Vector2(R * 0.72f, 17), new Vector2(R * 0.42f, 19.8f), new Vector2(R * 0.16f, 21.4f), new Vector2(0, H),
            };
            float CR(float t, float p0, float p1, float p2, float p3)
            {
                float v0 = (p2 - p0) * 0.5f, v1 = (p3 - p1) * 0.5f, t2 = t * t, t3 = t * t2;
                return (2 * p1 - 2 * p2 + v0 + v1) * t3 + (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 + v0 * t + p1;
            }
            var outline = new List<Vector2>();
            for (int i = 0; i <= 44; i++)
            {
                float p = (ctrl.Length - 1) * (i / 44f);
                int ip = Mathf.FloorToInt(p);
                float wgt = p - ip;
                if (ip >= ctrl.Length - 1) { ip = ctrl.Length - 2; wgt = 1; }
                var p0 = ctrl[ip == 0 ? ip : ip - 1]; var p1 = ctrl[ip]; var p2 = ctrl[Mathf.Min(ip + 1, ctrl.Length - 1)]; var p3 = ctrl[Mathf.Min(ip + 2, ctrl.Length - 1)];
                outline.Add(new Vector2(CR(wgt, p0.x, p1.x, p2.x, p3.x), CR(wgt, p0.y, p1.y, p2.y, p3.y)));
            }
            const float TURN = 34;
            int rows = outline.Count, PER = SEGMENTS / SPIRALS;
            // Indexed for smooth normals, then split per triangle so each column carries its stripe colour.
            var verts = new Vector3[rows * SEGMENTS];
            for (int j = 0; j < rows; j++)
                for (int i = 0; i < SEGMENTS; i++)
                {
                    float a = i / (float)SEGMENTS * Mathf.PI * 2 + outline[j].y / TURN * Mathf.PI * 2;
                    verts[j * SEGMENTS + i] = new Vector3(Mathf.Sin(a) * outline[j].x, outline[j].y, Mathf.Cos(a) * outline[j].x);
                }
            var index = new List<int>();
            for (int j = 0; j < rows - 1; j++)
                for (int i = 0; i < SEGMENTS; i++)
                {
                    int i2 = (i + 1) % SEGMENTS;
                    int a = j * SEGMENTS + i, b = j * SEGMENTS + i2, c = (j + 1) * SEGMENTS + i, d = (j + 1) * SEGMENTS + i2;
                    index.AddRange(new[] { a, b, d, a, d, c });
                }
            var nrm = new Vector3[verts.Length];
            for (int t = 0; t < index.Count; t += 3)
            {
                var n = Vector3.Cross(verts[index[t + 1]] - verts[index[t]], verts[index[t + 2]] - verts[index[t]]);
                nrm[index[t]] += n; nrm[index[t + 1]] += n; nrm[index[t + 2]] += n;
            }
            uint[] pattern = { DARK, DARK, DARK, GREEN, GREEN, LATTICE, GREEN, GREEN };
            var g = new G();
            for (int t = 0; t < index.Count / 3; t++)
            {
                int col = (t / 2) % SEGMENTS, j = t / 2 / SEGMENTS;
                float y = outline[j].y;
                uint hex = pattern[(col % PER) * pattern.Length / PER];
                if (y >= H - 1.4f) hex = CAP;
                else if (y < 1.0f) hex = LOBBY;
                var c = MeshKit.Hex(hex);
                for (int k = 0; k < 3; k++) { int vi = index[t * 3 + k]; g.Add(verts[vi], nrm[vi].normalized, c); }
                g.Tri(t * 3, t * 3 + 1, t * 3 + 2);
            }
            // The floor, so the pickle is closed underneath.
            var floor = Cyl(outline[0].x, outline[0].x, 0.01f, LOBBY, 0, -0.01f, 0, SEGMENTS);
            int nPickle = g.P.Count;
            g.Append(floor);
            var pickleR = Ink(null, "gherkin", new List<G> { g }, 0.12f, Glass);
            var mesh = pickleR.GetComponent<MeshFilter>().sharedMesh;
            mesh.MarkDynamic();
            var baseCol = g.C.ToArray();
            var cols = (Color[])baseCol.Clone();
            var angle = new float[nPickle];
            var height = new float[nPickle];
            for (int i = 0; i < nPickle; i++) { angle[i] = Mathf.Atan2(g.P[i].x, g.P[i].z); height[i] = g.P[i].y; }
            bool lit = false;
            view.labelY = H + 3;
            view.Animate = t =>
            {
                // Every few seconds a glint of sunshine slides across the glass, west to east.
                float cycle = t % 6;
                if (cycle > 2.2f)
                {
                    if (lit) { mesh.colors = baseCol; lit = false; }
                    return;
                }
                if (!pickleR.isVisible) return;
                lit = true;
                float at = -1.3f + cycle / 2.2f * 2.6f, fade = Mathf.Sin(cycle / 2.2f * Mathf.PI);
                for (int i = 0; i < nPickle; i++)
                {
                    float dd = Mathf.Abs(angle[i] - at - (height[i] - 10) * 0.025f);
                    float gl = dd < 0.32f ? (1 - dd / 0.32f) * 0.6f * fade : 0;
                    var b = baseCol[i];
                    cols[i] = new Color(b.r + (1 - b.r) * gl, b.g + (1 - b.g) * gl, b.b + (1 - b.b) * gl, 1);
                }
                mesh.colors = cols;
            };
        }

        // ================================================================== Shakespeare's Globe

        static void Globe()
        {
            const int SIDES = 20, FLOORS = 3;
            float R = London.GLOBE.r;
            const float R_IN = 2.55f, WALL = 4.0f, POLE = 2.4f;
            const uint PLASTER = 0xfbf7ec, TIMBERC = 0x6e4a2f, THATCHC = 0xdcae55, THATCH_DARK = 0x9c7536, YARD = 0xc9ac78, RED = 0xc8302a;
            G BeamT(float len, float thick, float x, float y, float z, float phi, float tilt = 0)
            {
                var g = Box(thick, len, 0.1f, TIMBERC).Translate(0, -len / 2, 0);
                if (tilt != 0) g.RotateZ(tilt);
                return g.RotateY(phi).Translate(x, y, z);
            }
            var parts = new List<G>();
            var timber = new List<G>();
            float step = Mathf.PI * 2 / SIDES;
            parts.Add(Lathe(new[] { R, 0, R, WALL, R_IN, WALL, R_IN, 0, R, 0 }, PLASTER, 0, 0, 0, SIDES).Flat());
            float apo = R * Mathf.Cos(step / 2) + 0.05f, faceW = 2 * R * Mathf.Sin(step / 2), floorH = WALL / FLOORS;
            for (int k = 0; k < SIDES; k++)
            {
                float corner = k * step, phi = (k + 0.5f) * step, fx = Mathf.Sin(phi) * apo, fz = Mathf.Cos(phi) * apo;
                timber.Add(BeamT(WALL, 0.15f, Mathf.Sin(corner) * (R + 0.05f), WALL / 2, Mathf.Cos(corner) * (R + 0.05f), corner));
                for (int f = 0; f <= FLOORS; f++)
                {
                    float y = Mathf.Min(WALL - 0.08f, Mathf.Max(0.08f, f * floorH));
                    timber.Add(BeamT(faceW, 0.12f, fx, y, fz, phi, Mathf.PI / 2));
                }
                float diag = Mathf.Atan2(faceW * 0.9f, floorH * 0.9f), len = Mathf.Sqrt(faceW * 0.9f * faceW * 0.9f + floorH * 0.9f * floorH * 0.9f);
                for (int f = 0; f < FLOORS; f++)
                {
                    if ((k + f) % 2 == 1) continue;
                    timber.Add(BeamT(len, 0.09f, fx, f * floorH + floorH / 2, fz, phi, (k % 4 < 2 ? 1 : -1) * diag));
                }
                timber.Add(BeamT(WALL, 0.18f, Mathf.Sin(corner) * (R_IN - 0.05f), WALL / 2, Mathf.Cos(corner) * (R_IN - 0.05f), corner + Mathf.PI));
                for (int f = 0; f < FLOORS; f++)
                {
                    float ia = R_IN * Mathf.Cos(step / 2) - 0.05f;
                    timber.Add(BeamT(faceW * 0.8f, floorH * 0.45f, Mathf.Sin(phi) * ia, f * floorH + floorH * 0.55f, Mathf.Cos(phi) * ia, phi + Mathf.PI, Mathf.PI / 2));
                }
            }
            parts.Add(Lathe(new[]
            {
                R + 0.3f, WALL - 0.1f, R + 0.38f, WALL + 0.3f, R + 0.1f, WALL + 0.9f, R - 0.5f, WALL + 1.45f,
                R - 0.9f, WALL + 1.5f, R_IN + 0.3f, WALL + 1.05f, R_IN - 0.25f, WALL + 0.3f, R_IN - 0.25f, WALL - 0.1f, R + 0.3f, WALL - 0.1f,
            }, THATCHC, 0, 0, 0, SIDES * 2));
            parts.Add(Lathe(new[] { R + 0.36f, WALL - 0.2f, R + 0.4f, WALL + 0.02f, R_IN - 0.3f, WALL + 0.02f, R_IN - 0.3f, WALL - 0.2f, R + 0.36f, WALL - 0.2f }, THATCH_DARK, 0, 0, 0, SIDES));
            parts.Add(Cyl(R_IN, R_IN, 0.06f, YARD, 0, 0, 0, SIDES));
            float sz = -R_IN + 0.75f;
            parts.Add(Box(2.6f, 0.7f, 1.5f, TIMBERC, 0, 0, sz));
            parts.Add(Box(2.6f, 0.08f, 1.5f, 0xd8b27a, 0, 0.7f, sz));
            parts.Add(Box(3.0f, 2.7f, 0.3f, RED, 0, 0, -R_IN + 0.05f));
            foreach (var dx in new[] { -0.95f, 0.95f })
            {
                parts.Add(Box(0.6f, 1.2f, 0.08f, 0x3a2416, dx, 0.7f, -R_IN + 0.22f));
                parts.Add(Cyl(0.1f, 0.12f, 1.9f, 0xf0e2c0, dx, 0.7f, sz + 0.55f, 8));
            }
            parts.Add(Box(3.0f, 0.1f, 2.0f, GOLD, 0, 2.5f, sz - 0.1f));
            parts.Add(Box(2.9f, 0.25f, 1.9f, RED, 0, 2.6f, sz - 0.1f));
            parts.Add(Box(1.2f, 0.5f, 0.9f, GOLD, 0, 2.85f, sz - 0.1f));
            parts.Add(Box(2.6f, 1.9f, 1.8f, PLASTER, 0, WALL + 0.6f, -R + 0.9f));
            parts.Add(Box(2.9f, 0.4f, 2.1f, THATCHC, 0, WALL + 2.5f, -R + 0.9f));
            float poleY = WALL + 2.9f, poleZ = -R + 0.9f;
            parts.Add(Cyl(0.07f, 0.09f, POLE, 0x6b4a2e, 0, poleY, poleZ, 6));
            Ink(null, "globe", parts, 0.08f);
            Ink(null, "globe-timber", timber, 0);

            // The flag: a little white cloth with a red cross, rippling on the hut's pole.
            const float FW = 1.9f, FH = 1.1f;
            const int NX = 10, NY = 4;
            var fg = new G();
            var grid = new Vector3[NY + 1, NX + 1];
            for (int iy = 0; iy <= NY; iy++)
                for (int ix = 0; ix <= NX; ix++) grid[iy, ix] = new Vector3(ix * FW / NX, -(iy * FH / NY - FH / 2), 0);
            for (int iy = 0; iy < NY; iy++)
                for (int ix = 0; ix < NX; ix++)
                {
                    foreach (var tri in new[] { (grid[iy, ix], grid[iy + 1, ix], grid[iy, ix + 1]), (grid[iy + 1, ix], grid[iy + 1, ix + 1], grid[iy, ix + 1]) })
                    {
                        var cen = (tri.Item1 + tri.Item2 + tri.Item3) / 3;
                        bool cross = Mathf.Abs(cen.y) < FH * 0.14f || Mathf.Abs(cen.x - FW * 0.4f) < FW * 0.08f;
                        var c = MeshKit.Hex(cross ? 0xd62d20u : 0xffffffu);
                        fg.Tri(fg.Add(tri.Item1, Vector3.forward, c), fg.Add(tri.Item2, Vector3.forward, c), fg.Add(tri.Item3, Vector3.forward, c));
                    }
                }
            var rest = fg.P.ToArray();
            var flagGo = new GameObject("globe-flag", typeof(MeshFilter), typeof(MeshRenderer));
            flagGo.transform.SetParent(view.root, false);
            flagGo.transform.localPosition = U(0.08f, poleY + POLE - FH / 2 - 0.05f, poleZ);
            flagGo.transform.localRotation = Rot(0, -0.35f, 0);
            var flagMesh = ToMesh(fg, "globe-flag");
            flagMesh.MarkDynamic();
            flagGo.GetComponent<MeshFilter>().sharedMesh = flagMesh;
            var fr = flagGo.GetComponent<MeshRenderer>();
            fr.sharedMaterial = Mats.VertexTwoSided;
            fr.shadowCastingMode = ShadowCastingMode.Off;
            view.Current.Add(fr);
            var fv = new Vector3[rest.Length];
            view.labelY = WALL + 7;
            view.Animate = t =>
            {
                for (int i = 0; i < rest.Length; i++)
                {
                    float x = rest[i].x, y = rest[i].y, k = x / FW;
                    fv[i] = new Vector3(x, y + Mathf.Sin(x * 2.4f - t * 5) * 0.06f * k, -(Mathf.Sin(x * 3.2f - t * 7) * 0.22f * k));
                }
                flagMesh.vertices = fv;
                flagMesh.RecalculateNormals();
                flagMesh.RecalculateBounds();
            };
        }

        // ================================================================== Piccadilly Circus

        static void Piccadilly()
        {
            const uint STONE = 0xeadcc0, STONE_SHADE = 0xcdbb98, SHOP = 0x2f3a4a, FRAME = 0x1b1b22, BRONZE = 0x7a6440, SILVERC = 0xdbe3ec, WATER = 0x6fd0e6;
            var s = Rel("piccadilly", London.PICCADILLY_SCREENS.x, London.PICCADILLY_SCREENS.z);
            float SW = London.PICCADILLY_SCREENS.w, SD = London.PICCADILLY_SCREENS.d, wall = s.y + SD / 2;
            const float H = 13, BULGE = 1.1f;
            float half = SW / 2 - 0.5f;
            float FrontZ(float x, float hf, float bulge) => wall + bulge * (1 - (x / hf) * (x / hf));
            G BulgeSlab(float hf, float bulge, float y, float h, uint color)
            {
                var sh = new Shape2().MoveTo(-hf, -(wall - 0.3f));
                for (int i = 0; i <= 24; i++) { float x = -hf + 2 * hf * i / 24; sh.LineTo(x, -FrontZ(x, hf, bulge)); }
                sh.LineTo(hf, -(wall - 0.3f));
                return Extrude(sh, h, color).RotateX(-Mathf.PI / 2).Translate(0, y + h / 2, 0);
            }
            var parts = new List<G>
            {
                Box(SW, H, SD, STONE, s.x, 0, s.y),
                Box(SW + 0.4f, 0.45f, SD + 0.4f, STONE_SHADE, s.x, H, s.y),
                Windows(6, 1, 2.5f, 2.4f, SHOP, 1.9f, 1.7f, s.x, 0.15f, wall),
                Windows(8, 2, 1.8f, 1.2f, SHOP, 0.8f, 0.75f, s.x, 10.5f, wall),
            };
            uint[] AWNINGS = { BUS_RED, NAVY, WESTMINSTER_GREEN, GOLD, BUS_RED, NAVY };
            for (int i = 0; i < AWNINGS.Length; i++) parts.Add(Box(2.1f, 0.1f, 0.8f, AWNINGS[i]).RotateX(0.35f).Translate(s.x + (i - 2.5f) * 2.5f, 2.05f, wall + 0.35f));
            parts.Add(BulgeSlab(half + 0.3f, BULGE + 0.2f, 2.55f, 0.35f, STONE_SHADE));
            parts.Add(BulgeSlab(half, BULGE, 2.9f, 7.0f, FRAME));
            parts.Add(BulgeSlab(half + 0.3f, BULGE + 0.2f, 9.9f, 0.4f, STONE_SHADE));
            foreach (var x in new[] { -SW / 2 + 1.4f, SW / 2 - 1.4f })
            {
                parts.Add(Cyl(1.3f, 1.3f, 2.2f, STONE, s.x + x, H + 0.45f, s.y + 0.8f, 14));
                parts.Add(Windows(1, 1, 1, 1.8f, SHOP, 0.6f, 1.1f, s.x + x, H + 0.6f, s.y + 2.1f, 0, true));
                parts.Add(Cyl(1.5f, 1.5f, 0.25f, STONE_SHADE, s.x + x, H + 2.65f, s.y + 0.8f, 14));
                parts.Add(Sphere(1.25f, SLATE, s.x + x, H + 2.9f, s.y + 0.8f, 14, 8, Mathf.PI * 2, Mathf.PI / 2));
                parts.Add(Cone(0.15f, 1.0f, GOLD, s.x + x, H + 4.1f, s.y + 0.8f, 6));
                parts.Add(Sphere(0.2f, GOLD, s.x + x, H + 5.15f, s.y + 0.8f, 8, 6));
            }
            float r = London.PICCADILLY_FOUNTAIN.r;
            parts.Add(Cyl(r, r + 0.05f, 0.3f, STONE_SHADE, 0, 0, 0, 8));
            parts.Add(Cyl(r - 0.35f, r - 0.3f, 0.3f, STONE, 0, 0.3f, 0, 8));
            parts.Add(Cyl(0.7f, 0.95f, 0.9f, BRONZE, 0, 0.6f, 0, 8));
            parts.Add(Lathe(new[] { 0.3f, 0, 0.9f, 0.25f, 1.15f, 0.5f, 1.1f, 0.56f, 0.3f, 0.42f, 0, 0.42f }, BRONZE, 0, 1.5f, 0, 16));
            parts.Add(Cyl(1.0f, 1.0f, 0.03f, WATER, 0, 1.9f, 0, 16));
            parts.Add(Cyl(0.18f, 0.28f, 1.5f, BRONZE, 0, 1.9f, 0, 8));
            parts.Add(Sphere(0.32f, BRONZE, 0, 3.45f, 0, 10, 8));
            // The winged archer, balanced on top.
            Shape2 Wing(float sign) => new Shape2().MoveTo(0, 0).QuadTo(sign * 0.35f, 0.65f, sign * 0.95f, 1.0f).LineTo(sign * 0.8f, 0.7f).LineTo(sign * 0.9f, 0.55f)
                .LineTo(sign * 0.65f, 0.4f).LineTo(sign * 0.7f, 0.22f).LineTo(sign * 0.35f, 0.12f);
            float a1 = Mathf.PI * 0.62f, a2 = Mathf.PI * 1.38f;
            var bow = new Shape2().AbsArc(0, 0, 0.5f, a1, a2).AbsArc(0, 0, 0.44f, a2, a1, true);
            var archer = new List<G>
            {
                Cyl(0.05f, 0.07f, 0.7f, SILVERC, 0, 0, 0, 6),
                Box(0.1f, 0.6f, 0.1f, SILVERC).RotateX(-1.0f).Translate(0.06f, 0.55f, -0.05f),
                Sphere(0.2f, SILVERC, 0, 0, 0, 10, 8).Scale(1, 1.6f, 0.8f).Translate(0, 0.95f, 0),
                Sphere(0.13f, SILVERC, 0, 1.4f, 0.02f, 10, 8),
                Extrude(Wing(1), 0.05f, SILVERC, 0.08f, 1.0f, -0.12f),
                Extrude(Wing(-1), 0.05f, SILVERC, -0.08f, 1.0f, -0.12f),
                Extrude(bow, 0.05f, SILVERC, -0.15f, 1.08f, 0.08f),
                Box(0.5f, 0.07f, 0.07f, SILVERC, -0.3f, 1.1f, 0.06f),
                Box(0.8f, 0.03f, 0.03f, SILVERC, -0.22f, 1.06f, 0.1f),
            };
            foreach (var g in archer) parts.Add(g.Scale(1.5f).RotateY(-0.35f).Translate(0, 3.7f, 0));
            Ink(null, "piccadilly", parts, 0.09f);

            // ---- the lit picture: a texture redrawn every half second, self-lit for the bloom
            float hs = half - 0.15f;
            const int N = 32;
            const float y0 = 3.1f, y1 = 9.7f;
            var sv = new List<Vector3>();
            var su = new List<Vector2>();
            var sn = new List<Vector3>();
            for (int i = 0; i <= N; i++)
            {
                float x = -hs + 2 * hs * i / N, z = FrontZ(x, hs, BULGE) + 0.04f;
                var nn = new Vector3(2 * BULGE * x / (hs * hs), 0, 1).normalized;
                foreach (var (y, v) in new[] { (y0, 0f), (y1, 1f) })
                {
                    sv.Add(U(s.x + x, y, z));
                    sn.Add(new Vector3(nn.x, 0, -nn.z));
                    su.Add(new Vector2(i / (float)N, v));
                }
            }
            var st = new List<int>();
            for (int i = 0; i < N; i++) { int a = i * 2; st.AddRange(new[] { a, a + 1, a + 2, a + 2, a + 1, a + 3 }); }
            var smesh = new Mesh { name = "piccadilly-screen" };
            smesh.SetVertices(sv); smesh.SetNormals(sn); smesh.SetUVs(0, su); smesh.SetTriangles(st, 0);
            var sgo = new GameObject("screens", typeof(MeshFilter), typeof(MeshRenderer));
            sgo.transform.SetParent(view.root, false);
            sgo.GetComponent<MeshFilter>().sharedMesh = smesh;
            var screen = new PiccadillyScreen();
            var smat = new Material(Shader.Find("Telfer/Screen")) { name = "Screens" };
            smat.SetTexture("_BaseMap", screen.Tex);
            smat.SetFloat("_Intensity", 1.7f);
            var sr = sgo.GetComponent<MeshRenderer>();
            sr.sharedMaterial = smat;
            sr.shadowCastingMode = ShadowCastingMode.Off;
            view.Current.Add(sr);
            int frame = -1;
            view.labelY = H + 7;
            view.Animate = t =>
            {
                int f = Mathf.FloorToInt(t / 0.5f);
                if (f == frame) return;
                frame = f;
                screen.Draw(f);
            };
        }

        // ================================================================== the Natural History Museum

        static void Museum()
        {
            float Wd = London.MUSEUM.w, D = London.MUSEUM.d, FRONT = D / 2;
            const float MAIN_H = 5.2f, PAV_H = 6.4f, TOWER_H = 10.5f, RIDGE = 1.6f;
            const uint BUFF = 0xe6b088, BAND = 0x6f88a8, ROOF = SLATE, WINDOW = 0x34465e, DOOR = 0x3b2a20, BONE = 0xf4ecd6, SOCKET = 0x3b2a20;
            var parts = new List<G>();
            void Banded(float w, float h, float d, float x, float y, float z)
            {
                const float buff = 0.78f, band = 0.2f;
                float at = 0;
                while (at < h - 0.01f)
                {
                    float b = Mathf.Min(buff, h - at);
                    parts.Add(Box(w, b, d, BUFF, x, y + at, z));
                    at += b;
                    if (at >= h - 0.01f) break;
                    float sb = Mathf.Min(band, h - at);
                    parts.Add(Box(w + 0.06f, sb, d + 0.06f, BAND, x, y + at, z));
                    at += sb;
                }
            }
            Shape2 ArchShape(float w, float h) { float r = w / 2; return new Shape2().MoveTo(-r, 0).LineTo(r, 0).LineTo(r, h - r).AbsArc(0, h - r, r, 0, Mathf.PI).LineTo(-r, 0); }
            const float towerX = 2.3f, towerS = 2.1f, pavW = 2.6f;
            float pavX = Wd / 2 - pavW / 2;
            Banded(Wd - 0.2f, MAIN_H, D, 0, 0, 0);
            parts.Add(Extrude(new Shape2().MoveTo(-D / 2, 0).LineTo(D / 2, 0).LineTo(0, RIDGE).LineTo(-D / 2, 0), Wd - 2 * pavW, ROOF, 0, MAIN_H, 0, Mathf.PI / 2));
            foreach (int s in new[] { -1, 1 })
            {
                float x = s * pavX;
                Banded(pavW, PAV_H, D + 0.5f, x, 0, 0);
                parts.Add(Pyramid(pavW / 2 + 0.15f, (D + 0.5f) / 2 + 0.15f, 1.8f, ROOF, x, PAV_H, 0));
                parts.Add(Windows(2, 3, 1.05f, 2.0f, WINDOW, 0.55f, 1.25f, x, 0.5f, FRONT + 0.25f, 0, true));
                float wingX = s * ((towerX + towerS / 2 + pavX - pavW / 2) / 2);
                parts.Add(Windows(2, 2, 1.05f, 2.2f, WINDOW, 0.6f, 1.5f, wingX, 0.5f, FRONT, 0, true));
            }
            foreach (int s in new[] { -1, 1 }) parts.Add(Windows(3, 3, 2.0f, 2.0f, WINDOW, 0.55f, 1.25f, s * (Wd / 2 + 0.01f), 0.5f, 0, s * Mathf.PI / 2, true));
            foreach (int s in new[] { -1, 1 })
            {
                float x = s * towerX, z = FRONT - towerS / 2 + 0.25f;
                Banded(towerS, TOWER_H, towerS, x, 0, z);
                parts.Add(Windows(1, 3, 1, 2.2f, WINDOW, 0.6f, 1.4f, x, 3.2f, z + towerS / 2, 0, true));
                parts.Add(Windows(2, 1, 0.8f, 1.4f, WINDOW, 0.42f, 1.1f, x + s * (towerS / 2), TOWER_H - 1.8f, z, s * Mathf.PI / 2, true));
                parts.Add(Box(towerS + 0.3f, 0.3f, towerS + 0.3f, BAND, x, TOWER_H, z));
                parts.Add(Pyramid(towerS / 2 + 0.05f, towerS / 2 + 0.05f, 4.6f, ROOF, x, TOWER_H + 0.3f, z));
                parts.Add(Sphere(0.18f, GOLD, x, TOWER_H + 5.0f, z, 8, 6));
                foreach (int dx in new[] { -1, 1 }) foreach (int dz in new[] { -1, 1 }) parts.Add(Pyramid(0.2f, 0.2f, 1.0f, ROOF, x + dx * towerS / 2, TOWER_H + 0.3f, z + dz * towerS / 2));
            }
            float gw = 2 * towerX - towerS + 0.1f;
            parts.Add(Extrude(new Shape2().MoveTo(-gw / 2, 0).LineTo(gw / 2, 0).LineTo(gw / 2, MAIN_H + 0.6f).LineTo(0, MAIN_H + 2.0f).LineTo(-gw / 2, MAIN_H + 0.6f).LineTo(-gw / 2, 0), 0.8f, BUFF, 0, 0, FRONT + 0.15f));
            parts.Add(Extrude(ArchShape(2.2f, 3.6f), 0.12f, BAND, 0, 0, FRONT + 0.58f));
            parts.Add(Extrude(ArchShape(1.7f, 3.2f), 0.12f, DOOR, 0, 0, FRONT + 0.66f));
            parts.Add(Box(2.8f, 0.25f, 1.2f, STONE, 0, 0, FRONT + 0.9f));
            parts.Add(Windows(1, 1, 1, 1, WINDOW, 0.7f, 0.7f, 0, MAIN_H + 0.3f, FRONT + 0.56f));

            // ---- the dinosaur: ribcage on the east wing's roof, the tail draped over the pavilion
            float spineY = MAIN_H + RIDGE + 0.6f, dinoX = (towerX + towerS / 2 + pavX - pavW / 2) / 2;
            const float shoulderZ = 0.6f, hipZ = -2.6f;
            for (int i = 0; i <= 8; i++)
            {
                float k = i / 8f, z = shoulderZ + (hipZ - shoulderZ) * k, y = spineY + Mathf.Sin(k * Mathf.PI) * 0.4f - k * 0.9f;
                parts.Add(Sphere(0.34f, BONE, dinoX, y, z, 8, 6));
                parts.Add(Cone(0.15f, 0.5f, BONE, dinoX, y + 0.2f, z, 5));
                if (i >= 1 && i <= 7)
                {
                    float r = 0.95f + Mathf.Sin(k * Mathf.PI) * 0.4f;
                    parts.Add(Torus(r, 0.14f, 5, 10, BONE, Mathf.PI).Translate(dinoX, y - r + 0.05f, z));
                }
            }
            parts.Add(Sphere(0.6f, BONE, dinoX, spineY - 0.75f, hipZ - 0.3f, 10, 8));
            Vector3 ta = new Vector3(dinoX + 0.3f, spineY - 0.6f, hipZ - 0.6f), tb = new Vector3(dinoX + 2.4f, spineY + 1.2f, hipZ - 0.6f), tc = new Vector3(Wd / 2 + 0.2f, spineY + 0.6f, hipZ + 0.2f), td = new Vector3(Wd / 2 + 0.7f, MAIN_H - 1.4f, hipZ + 1.2f);
            for (int i = 0; i <= 12; i++)
            {
                var p = Bezier(ta, tb, tc, td, i / 12f);
                parts.Add(Sphere(0.36f - i / 12f * 0.24f, BONE, p.x, p.y, p.z, 8, 6));
            }
            Ink(null, "museum", parts, 0.1f);

            // ---- the neck and skull: their own child, pivoting at the shoulders
            var neck = new List<G>();
            Vector3 c0 = Vector3.zero, c1 = new Vector3(0.2f, 3.4f, 0), c2 = new Vector3(1.9f, 5.6f, 0.6f), c3 = new Vector3(2.7f, 4.7f, 2.5f);
            const int NN = 15;
            for (int i = 0; i <= NN; i++)
            {
                float k = i / (float)NN;
                var p = Bezier(c0, c1, c2, c3, k);
                neck.Add(Sphere(0.55f - k * 0.22f, BONE, p.x, p.y, p.z, 8, 6));
                if (i < NN) neck.Add(Cone(0.13f, 0.42f, BONE, p.x, p.y + 0.3f - k * 0.1f, p.z, 5));
            }
            var head = new Vector3(2.75f, 4.4f, 2.85f);
            var skull = new List<G>
            {
                Sphere(0.5f, BONE, 0, 0.1f, 0, 10, 8),
                Box(0.7f, 0.4f, 1.3f, BONE, 0, -0.18f, 0.65f),
                Box(0.6f, 0.14f, 1.15f, BONE, 0, -0.42f, 0.6f),
                Sphere(0.2f, SOCKET, -0.27f, 0.3f, 0.3f, 8, 6),
                Sphere(0.2f, SOCKET, 0.27f, 0.3f, 0.3f, 8, 6),
                Sphere(0.08f, SOCKET, -0.16f, 0.12f, 1.22f, 6, 4),
                Sphere(0.08f, SOCKET, 0.16f, 0.12f, 1.22f, 6, 4),
            };
            for (int i = 0; i < 6; i++) foreach (int s in new[] { -1, 1 }) skull.Add(Box(0.08f, 0.13f, 0.08f, 0xffffff, s * 0.27f, -0.3f, 0.3f + i * 0.18f));
            foreach (var g in skull) neck.Add(g.RotateX(-0.55f).RotateY(-0.35f).Scale(1.75f).Translate(head));
            var neckT = Child(null, "dino-neck", dinoX, spineY + 0.1f, shoulderZ + 0.2f);
            Ink(neckT, "dino", neck, 0.08f);
            view.labelY = TOWER_H + 7.5f;
            view.Animate = t => neckT.localRotation = Rot(Mathf.Sin(t * 1.1f) * 0.05f, Mathf.Sin(t * 0.55f) * 0.32f, Mathf.Sin(t * 0.55f + 0.6f) * 0.06f);
        }

        // ================================================================== the title-screen picture

        /// <summary>Big Ben alone, for the London chip on the title screen (Unity frame, base at the origin).</summary>
        public static Mesh IconMesh()
        {
            if (iconMesh) return iconMesh;
            var root = new GameObject("icon-tmp").transform;
            var v = Build("bigben", root);
            var tower = v.Groups[0][0].GetComponent<MeshFilter>().sharedMesh;
            var verts = tower.vertices;
            var c = tower.bounds.center;
            // A tenth of life size: the icon camera's far plane is 50 m.
            for (int i = 0; i < verts.Length; i++) verts[i] = (verts[i] - new Vector3(c.x, 0, c.z)) * 0.1f;
            var m = Object.Instantiate(tower);
            m.vertices = verts;
            m.RecalculateBounds();
            var dead = new HashSet<Mesh>();
            foreach (var f in root.GetComponentsInChildren<MeshFilter>()) if (f.sharedMesh) dead.Add(f.sharedMesh);
            foreach (var d in dead) Object.Destroy(d);
            Object.Destroy(root.gameObject);
            return iconMesh = m;
        }

        static Mesh iconMesh;
    }

    /// <summary>
    /// Piccadilly's light screens: a 320 × 128 picture of six panels, each showing a bold shape motif
    /// (hearts, stars, a snake, rainbow stripes, bubbles, a winking sun, a checkerboard: never words or
    /// brands) and changing every few beats, out of step (piccadilly.ts drawScreens).
    /// </summary>
    public sealed class PiccadillyScreen
    {
        const int CW = 320, CH = 128;
        public readonly Texture2D Tex;
        readonly Color32[] px = new Color32[CW * CH];

        public PiccadillyScreen()
        {
            Tex = new Texture2D(CW, CH, TextureFormat.RGBA32, false) { name = "piccadilly", wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear };
            Draw(0);
        }

        static readonly int[,] PANELS = { { 4, 4, 96, 58 }, { 4, 66, 96, 58 }, { 104, 4, 112, 120 }, { 220, 4, 96, 75 }, { 220, 83, 46, 41 }, { 270, 83, 46, 41 } };
        static readonly Color32[] RAINBOW = { Hex(0xff3b3b), Hex(0xff9a1f), Hex(0xffe11f), Hex(0x3fd24a), Hex(0x2fa8ff), Hex(0x9a5bff) };
        static Color32 Hex(uint h) => MeshKit.Hex(h);

        public void Draw(int frame)
        {
            for (int i = 0; i < px.Length; i++) px[i] = Hex(0x111116);
            for (int i = 0; i < 6; i++)
            {
                int beat = 2 + i % 3;
                int motif = ((frame + i * 5) / beat + i * 2) % 7;
                Panel(PANELS[i, 0], PANELS[i, 1], PANELS[i, 2], PANELS[i, 3], motif, frame + i);
            }
            Tex.SetPixels32(px);
            Tex.Apply(false);
        }

        static float Star(float x, float y, float r, float spin)
        {
            float a = Mathf.Atan2(y, x) - spin + Mathf.PI / 2;
            float k = Mathf.Repeat(a, Mathf.PI * 2 / 5) / (Mathf.PI * 2 / 5);
            float rr = Mathf.Lerp(r, r * 0.45f, 1 - Mathf.Abs(k * 2 - 1));
            return Mathf.Sqrt(x * x + y * y) - rr;
        }

        static float Heart(float x, float y, float s)
        {
            // Two round lobes and a point, upright (y grows down the panel).
            x /= s; y /= s;
            float l1 = Mathf.Sqrt((x + 0.28f) * (x + 0.28f) + (y + 0.12f) * (y + 0.12f)) - 0.32f;
            float l2 = Mathf.Sqrt((x - 0.28f) * (x - 0.28f) + (y + 0.12f) * (y + 0.12f)) - 0.32f;
            float tri = Mathf.Max(Mathf.Abs(x) * 0.9f + y * 0.75f - 0.32f, -y - 0.1f);
            return Mathf.Min(Mathf.Min(l1, l2), tri) * s;
        }

        void Panel(int x0, int y0, int w, int h, int motif, int f)
        {
            float mn = Mathf.Min(w, h);
            for (int yy = 0; yy < h; yy++)
                for (int xx = 0; xx < w; xx++)
                {
                    float x = xx + 0.5f, y = yy + 0.5f;
                    Color32 c;
                    switch (motif)
                    {
                        case 0: // hearts
                        {
                            c = Hex(0xff4f9a);
                            float s = mn / 3.2f;
                            for (int i = 0; i < 4; i++)
                                for (int j = 0; j < 3; j++)
                                {
                                    bool alt = (i + j + f) % 2 == 1;
                                    float hx = (i + 0.5f + (j % 2) * 0.5f) * (w / 3.5f), hy = (j + 0.6f) * (h / 2.8f);
                                    if (Heart(x - hx, y - hy, s * (alt ? 0.8f : 1)) < 0) c = alt ? Hex(0xffffff) : Hex(0xd4004c);
                                }
                            break;
                        }
                        case 1: // twinkling stars
                        {
                            c = Hex(0x1d2a6b);
                            for (int i = 0; i < 9; i++)
                            {
                                bool big = i % 3 == f % 3;
                                float sx = (i * 0.37f + 0.1f) % 1 * w, sy = (i * 0.61f + 0.15f) % 1 * h;
                                if (Star(x - sx, y - sy, mn / 7 * (big ? 1.4f : 1), f * 0.3f) < 0) c = big ? Hex(0xffffff) : Hex(0xffd93b);
                            }
                            break;
                        }
                        case 2: // a wiggling snake
                        {
                            c = Hex(0x39c6e8);
                            float t = Mathf.Max(4, h / 6f);
                            float hx = w - t * 2;
                            float Wave(float px_) => h / 2f + Mathf.Sin(px_ / (w / 9f) + f * 1.2f) * h * 0.22f;
                            float dy = Mathf.Abs(y - Wave(Mathf.Clamp(x, t, hx)));
                            if (x >= t * 0.4f && x <= hx && dy < t * 0.68f) c = Hex(0x1f7a1f);
                            if (x >= t * 0.6f && x <= hx && dy < t * 0.5f) c = Hex(0x5ee35a);
                            float hy = Wave(hx);
                            float ex = (x - hx) / (t * 1.1f), ey = (y - hy) / (t * 0.85f);
                            if (ex * ex + ey * ey < 1) c = Hex(0x5ee35a);
                            float e1 = (x - hx - t * 0.2f) * (x - hx - t * 0.2f) + (y - hy + t * 0.3f) * (y - hy + t * 0.3f);
                            if (e1 < t * 0.35f * t * 0.35f) c = Hex(0xffffff);
                            float e2 = (x - hx - t * 0.3f) * (x - hx - t * 0.3f) + (y - hy + t * 0.3f) * (y - hy + t * 0.3f);
                            if (e2 < t * 0.17f * t * 0.17f) c = Hex(0x111111);
                            if (f % 2 == 1 && x > hx + t && x < hx + t * 1.7f && Mathf.Abs(y - hy) < 1.2f) c = Hex(0xff2b4a);
                            break;
                        }
                        case 3: // rainbow stripes marching sideways
                        {
                            float sw = Mathf.Max(w, h) / 6f;
                            int band = Mathf.FloorToInt((x + y * 0.6f) / sw);
                            c = RAINBOW[((band + f) % 6 + 6) % 6];
                            break;
                        }
                        case 4: // bubbles
                        {
                            c = Hex(0xffd23f);
                            for (int i = 0; i < 8; i++)
                            {
                                float r = mn / 6 * (1 + ((i * 7 + f) % 3) * 0.35f);
                                float bx = (i * 0.29f + 0.08f) % 1 * w, by = ((i * 0.53f + 0.2f - f * 0.12f) % 1 + 1) % 1 * h;
                                if ((x - bx) * (x - bx) + (y - by) * (y - by) < r * r) c = RAINBOW[(i + f) % 6];
                            }
                            break;
                        }
                        case 5: // a smiling sun, winking
                        {
                            c = Hex(0xff8a00);
                            float r = mn * 0.3f, cx = w / 2f, cy = h / 2f;
                            float dx = x - cx, dy = y - cy, d = Mathf.Sqrt(dx * dx + dy * dy);
                            if (Star(dx, dy, r * 1.55f, f * 0.2f) < 0 || d < r) c = Hex(0xffe14a);
                            float l = (dx + r * 0.35f) * (dx + r * 0.35f) + (dy + r * 0.2f) * (dy + r * 0.2f);
                            if (l < r * 0.12f * r * 0.12f) c = Hex(0x5a2a00);
                            if (f % 2 == 1) { if (dx > r * 0.2f && dx < r * 0.5f && dy > -r * 0.24f && dy < -r * 0.16f) c = Hex(0x5a2a00); }
                            else if ((dx - r * 0.35f) * (dx - r * 0.35f) + (dy + r * 0.2f) * (dy + r * 0.2f) < r * 0.12f * r * 0.12f) c = Hex(0x5a2a00);
                            float sm = Mathf.Abs(Mathf.Sqrt(dx * dx + (dy - r * 0.05f) * (dy - r * 0.05f)) - r * 0.5f);
                            float ang = Mathf.Atan2(dy - r * 0.05f, dx);
                            if (sm < r * 0.05f && ang > 0.2f * Mathf.PI && ang < 0.8f * Mathf.PI) c = Hex(0x5a2a00);
                            break;
                        }
                        default: // a flashing checkerboard
                        {
                            float s = w / 6f;
                            c = (Mathf.FloorToInt(x / s) + Mathf.FloorToInt(y / s) + f) % 2 == 1 ? Hex(0x2fa8ff) : Hex(0xffffff);
                            break;
                        }
                    }
                    // Rows run top to bottom on the panel; the texture's rows run bottom up.
                    px[(CH - 1 - (y0 + yy)) * CW + x0 + xx] = c;
                }
        }
    }
}
