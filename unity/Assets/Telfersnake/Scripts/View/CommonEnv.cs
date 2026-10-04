using System.Collections.Generic;
using Telfer.Sim;
using UnityEngine;
using UnityEngine.Rendering;

namespace Telfer.View
{
    /// <summary>
    /// Level 2, the Common, built in code (after common.ts): a painted meadow with roads and a long
    /// footpath, instanced woods and copses, the terraces down Telferscot Road, Emmanuel Road with its
    /// parked cars and tree line, the school glimpsed at the top of the street, the playground, benches,
    /// the bleached fallen log, and the Glade with a glowing fairy ring and fireflies.
    /// </summary>
    public sealed class CommonEnv
    {
        public readonly Transform root;
        public readonly List<Occluder> Occluders = new List<Occluder>();
        readonly System.Random rng = new System.Random(31);
        float R(float a, float b) => a + (float)rng.NextDouble() * (b - a);
        T Pick<T>(T[] a) => a[rng.Next(a.Length)];

        const float WORLD = 180, CX = 0, CZ = -20;

        public CommonEnv(Transform parent, bool hiRes)
        {
            root = new GameObject("Common").transform;
            root.SetParent(parent, false);
            Ground(hiRes);
            Woods();
            Terraces();
            EmmanuelRoad();
            SchoolBackdrop();
            Playground();
            Benches();
            Log();
            Glade();
            Lawn(hiRes);
            var life = new GameObject("Wildlife").AddComponent<Wildlife>();
            life.transform.SetParent(root, false);
            life.Build(Stage.For(StageId.Common));
        }

        GameObject Emit(string name, MeshKit k, Material m, bool shadows = true, Transform parent = null)
        {
            if (k.V.Count == 0) return null;
            var go = new GameObject(name, typeof(MeshFilter), typeof(MeshRenderer));
            go.transform.SetParent(parent ? parent : root, false);
            go.GetComponent<MeshFilter>().sharedMesh = k.ToMesh(name);
            var r = go.GetComponent<MeshRenderer>();
            r.sharedMaterial = m;
            r.shadowCastingMode = shadows ? ShadowCastingMode.On : ShadowCastingMode.Off;
            return go;
        }

        static Vector3 U(float x, float z, float y = 0) => W.P(x, z, y);

        // ------------------------------------------------------------------ ground

        void Ground(bool hiRes)
        {
            int size = hiRes ? 3072 : 2048;
            var p = new Painter(size, WORLD, CX, CZ);
            p.Fill(Painter.C("#6aa84f"));
            for (int i = 0; i < 700; i++)
            {
                float x = R(-90, 90), z = R(-110, 70);
                p.FillEllipse(x, z, R(1.5f, 7), R(1.2f, 5), R(0, 3), rng.NextDouble() < 0.55 ? Painter.C("#5a9a42", 0.35f) : Painter.C("#8cc263", 0.3f));
            }
            // Darker ground under the woods and copses.
            foreach (var b in Common.WOODS) p.RoundRect(b.x - b.w / 2 - 1, b.z - b.d / 2 - 1, b.x + b.w / 2 + 1, b.z + b.d / 2 + 1, 3, Painter.C("#4d7f3b"));
            foreach (var t in Common.COPSES) p.Circle(t.x, t.z, t.r + 1.4f, Painter.C("#4d7f3b"));
            // Pavements, then the roads: Emmanuel Road across, Telferscot Road down the middle, the east road.
            var pave = Painter.C("#b4b7bb");
            p.Rect(-60, -44, 60, -32, pave);
            p.Rect(-8.5f, -100, 8.5f, -42, pave);
            p.Rect(52, -42, 60, 60, pave);
            var road = Painter.C("#5d626b");
            p.Rect(-90, -42, 90, -34, road);
            p.Rect(-6, -110, 6, -42, road);
            p.Rect(54, -42, 60, 60, road);
            var dash = Painter.C("#eeeeee", 0.85f);
            p.Line(-90, -38, 90, -38, 0.18f, dash, 2, 3);
            p.Line(0, -110, 0, -42, 0.18f, dash, 2, 3);
            p.Line(57, -38, 57, 60, 0.18f, dash, 2, 3);
            for (float x = -4.5f; x <= 4.5f; x += 1.1f) p.Rect(x - 0.3f, -46, x + 0.3f, -43, Painter.C("#f1f1f1")); // a zebra crossing at the mouth
            // Paving slabs on the pavements.
            var slab = Painter.C("#9ea2a7", 0.5f);
            for (float x = -60; x < 60; x += 0.9f) { p.Line(x, -44, x, -42, 0.03f, slab); p.Line(x, -34, x, -32, 0.03f, slab); }
            for (float z = -100; z < -44; z += 0.9f) { p.Line(-8.5f, z, -6, z, 0.03f, slab); p.Line(6, z, 8.5f, z, 0.03f, slab); }
            // The long footpath from the Rastell Avenue corner down to the southern tip.
            var path = Painter.C("#b9a97e");
            var pathEdge = Painter.C("#9c8c62");
            Vector2[] pts = { new Vector2(50, -30), new Vector2(18, 6), new Vector2(0, 50) };
            for (int i = 0; i < pts.Length - 1; i++)
            {
                p.Line(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, 2.7f, pathEdge);
                p.Line(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, 2.3f, path);
            }
            for (int i = 0; i < 260; i++)
            {
                int seg = rng.Next(2);
                float t = (float)rng.NextDouble();
                var q = Vector2.Lerp(pts[seg], pts[seg + 1], t);
                p.Circle(q.x + R(-1, 1), q.y + R(-1, 1), R(0.05f, 0.14f), Painter.C(rng.NextDouble() < 0.5 ? "#8f8160" : "#d4c79c", 0.8f));
            }
            // Worn earth under the playground, and the Glade's paler clearing.
            p.FillEllipse(Common.PLAY_X, Common.PLAY_Z, 5.5f, 4.5f, 0.2f, Painter.C("#a88f62", 0.85f));
            p.FillEllipse(Common.PLAY_X, Common.PLAY_Z, 4.2f, 3.4f, 0.2f, Painter.C("#c4a873", 0.8f));
            p.FillEllipse(Common.GLADE_X, Common.GLADE_Z, 8, 6, 0, Painter.C("#7fbf5c", 0.6f));
            Ground_Minimap(p);

            var grit = Tex.Grit();
            var mat = Mats.Toon(Color.white, gloss: 0.05f, smooth: 0.2f, rim: 0, tex: p.ToTexture("common-ground"), vertexColor: false);
            mat.SetTexture("_DetailMap", grit);
            mat.SetFloat("_DetailScale", 0.4f);
            mat.SetFloat("_DetailStrength", 0.65f);
            mat.SetFloat("_HueJitter", 0.3f);
            View.Ground.Plane(root, "CommonGround", WORLD, 0, mat, 40, CX, CZ);
            var outer = Mats.Toon(MeshKit.Hex(0x5f9a46), gloss: 0.03f, smooth: 0.2f, rim: 0, vertexColor: false);
            outer.SetTexture("_DetailMap", grit);
            outer.SetFloat("_DetailScale", 0.2f);
            outer.SetFloat("_DetailStrength", 0.6f);
            outer.SetFloat("_HueJitter", 0.5f);
            View.Ground.Plane(root, "CommonOuter", 600, -0.04f, outer, 30, CX, CZ);
        }

        void Ground_Minimap(Painter p)
        {
            var B = Common.BOUNDS;
            float u0 = (B.minX - (CX - WORLD / 2)) / WORLD, v0 = ((CZ + WORLD / 2) - B.maxZ) / WORLD;
            View.Ground.SetMap(StageId.Common, p.Downsample(256), new Rect(u0, v0, (B.maxX - B.minX) / WORLD, (B.maxZ - B.minZ) / WORLD));
        }

        // ------------------------------------------------------------------ trees

        void Woods()
        {
            var go = new GameObject("Trees");
            go.transform.SetParent(root, false);
            var f = go.AddComponent<TreeField>();
            f.Init(17);
            foreach (var b in Common.WOODS)
                for (float x = b.x - b.w / 2 + 1; x < b.x + b.w / 2; x += 3)
                    for (float z = b.z - b.d / 2 + 1; z < b.z + b.d / 2; z += 3)
                        if (rng.NextDouble() < 0.85) f.Add(x + R(-1.1f, 1.1f), z + R(-1.1f, 1.1f), R(0.85f, 1.35f), R(0, 360), -1, rng);
            // The woods carry on beyond the fence so the park never ends in a void.
            for (float x = -100; x < 100; x += 3.4f)
                for (float z = 60; z < 110; z += 3.4f)
                    if (rng.NextDouble() < 0.7) f.Add(x + R(-1.4f, 1.4f), z + R(-1.4f, 1.4f), R(0.9f, 1.5f), R(0, 360), -1, rng);
            for (float x = -110; x < -60; x += 3.4f)
                for (float z = -34; z < 60; z += 3.4f)
                    if (rng.NextDouble() < 0.7) f.Add(x + R(-1.4f, 1.4f), z + R(-1.4f, 1.4f), R(0.9f, 1.5f), R(0, 360), -1, rng);
            foreach (var t in Common.COPSES)
            {
                int n = Mathf.Max(3, Mathf.RoundToInt(t.r * t.r * 0.9f));
                for (int i = 0; i < n; i++)
                {
                    float a = R(0, Mathf.PI * 2), d = Mathf.Sqrt((float)rng.NextDouble()) * t.r * 0.9f;
                    f.Add(t.x + Mathf.Cos(a) * d, t.z + Mathf.Sin(a) * d, R(0.8f, 1.2f) * Mathf.Clamp(t.r / 2.2f, 0.65f, 1.25f), R(0, 360), rng.Next(4), rng);
                }
            }
            // Emmanuel Road's tree line (a gap at the road mouth) and a few singles out on the grass.
            for (float x = -58; x < 54; x += R(5, 8))
                if (Mathf.Abs(x) > 9) f.Add(x, R(-30.5f, -28.5f), R(0.9f, 1.2f), R(0, 360), rng.Next(4), rng);
            foreach (var (x, z) in new[] { (-32f, 12f), (22f, 8f), (-6f, 40f), (44f, -12f), (-38f, -22f), (16f, -30f), (34f, 40f) })
                f.Add(x, z, R(1.15f, 1.5f), R(0, 360), rng.Next(4), rng);
            f.Commit();
        }

        // ------------------------------------------------------------------ houses

        void Terraces()
        {
            var brick = new MeshKit();
            var paint = new MeshKit();
            var roofs = new MeshKit();
            var glass = new MeshKit();
            var hedge = new MeshKit();
            uint[] tints = { 0xffffff, 0xf2d6c4, 0xe9c4a8, 0xd9b9a5 };
            uint[] fronts = { 0xe4d9c4, 0xd7e0e6, 0xe6cfcf, 0xe1efdc, 0xfaf3c8 };
            uint[] doors = { 0x2f5fc0, 0xd62828, 0x2f9e44, 0xf2c230, 0x222428, 0x7048e8, 0x1098ad };
            uint[] slate = { 0x5a6170, 0x6b7280, 0x4e5563 };
            void House(float x, float z, float rotY, bool garden)
            {
                float h = R(5.6f, 6.6f);
                var m = Matrix4x4.TRS(U(x, z), Quaternion.Euler(0, rotY, 0), Vector3.one);
                bool isBrick = rng.NextDouble() < 0.6;
                var wall = isBrick ? brick : paint;
                foreach (var k in new[] { brick, paint, roofs, glass, hedge }) k.M = m;
                wall.C = isBrick ? MeshKit.Hex(Pick(tints)) : MeshKit.Hex(Pick(fronts));
                wall.Box(new Vector3(0, h / 2, 0), new Vector3(5.4f, h, 10), isBrick ? 2 : 0);
                wall.Box(new Vector3(-1.1f, 1.4f, -5.4f), new Vector3(2.4f, 2.8f, 0.8f), isBrick ? 2 : 0);
                glass.Tint(0x3f6487).Box(new Vector3(-1.1f, 1.5f, -5.81f), new Vector3(1.9f, 1.5f, 0.02f));
                paint.Tint(0xf6f6f2).Box(new Vector3(-1.1f, 2.85f, -5.45f), new Vector3(2.6f, 0.15f, 0.95f));
                foreach (float wx in new[] { -1.3f, 1.4f })
                {
                    paint.Tint(0xf6f6f2).Box(new Vector3(wx, 4.0f, -5.02f), new Vector3(1.25f, 1.5f, 0.06f));
                    glass.Tint(0x3f6487).Box(new Vector3(wx, 4.0f, -5.06f), new Vector3(1.05f, 1.3f, 0.02f));
                }
                paint.Tint(Pick(doors)).Box(new Vector3(1.5f, 1.15f, -5.03f), new Vector3(1.0f, 2.2f, 0.06f));
                roofs.C = MeshKit.Hex(Pick(slate));
                float o = 0.3f, rh = 2.3f;
                var uv = new Vector2(10.6f / 1.6f, 3.3f / 1.6f);
                roofs.Quad(new Vector3(-2.7f - o, h, -5 - o), new Vector3(-2.7f - o, h, 5 + o), new Vector3(0, h + rh, 5 + o), new Vector3(0, h + rh, -5 - o), uv, true);
                roofs.Quad(new Vector3(2.7f + o, h, 5 + o), new Vector3(2.7f + o, h, -5 - o), new Vector3(0, h + rh, -5 - o), new Vector3(0, h + rh, 5 + o), uv, true);
                if (rng.NextDouble() < 0.6)
                {
                    wall.Box(new Vector3(2.7f, h + rh * 0.7f, 2), new Vector3(0.5f, 1.8f, 1.2f), isBrick ? 2 : 0);
                    paint.Tint(0xc4683f).Cylinder(new Vector3(2.7f, h + rh * 0.7f + 0.9f, 1.8f), new Vector3(2.7f, h + rh * 0.7f + 1.3f, 1.8f), 0.12f, 0.1f, 6);
                }
                if (garden)
                {
                    paint.Tint(0xb4704a).Box(new Vector3(-1.6f, 0.35f, -7.4f), new Vector3(2.2f, 0.7f, 0.3f));
                    hedge.C = Color.Lerp(MeshKit.Hex(0x2f7f35), MeshKit.Hex(0x57b04a), (float)rng.NextDouble());
                    hedge.Blob(new Vector3(-1.4f, 0.55f, -6.8f), new Vector3(1.2f, 0.5f, 0.5f), 0.12f, rng.Next(), 1, false);
                }
            }
            // Telferscot Road: two terraces facing each other across the street, more rows behind.
            for (float z = -97; z < -46; z += 5.6f)
            {
                House(-14, z, -90, true);
                House(14, z, 90, true);
                for (int row = 1; row < 4; row++)
                {
                    House(-14 - row * 13, z + 1.2f, row % 2 == 0 ? -90 : 90, false);
                    House(14 + row * 13, z + 1.2f, row % 2 == 0 ? 90 : -90, false);
                }
            }
            // Rastell Avenue's houses beyond the east road; houses along Emmanuel Road's north side.
            for (float z = -36; z < 62; z += 5.6f) House(68, z, 90, true);
            for (float x = -86; x < 86; x += 5.6f) if (Mathf.Abs(x) > 60) House(x, -48, 180, false);
            foreach (var k in new[] { brick, paint, roofs, glass, hedge }) k.M = Matrix4x4.identity;
            Emit("terrace-brick", brick, Mats.Cached("houseBrick", () => Mats.Toon(Color.white, 0.05f, 0.2f, 0.1f, Tex.Brick(MeshKit.Hex(0xb4704a)))));
            Emit("terrace-paint", paint, Mats.VertexLit);
            Emit("terrace-roofs", roofs, Mats.Cached("roofTiles", () => Mats.Toon(Color.white, 0.12f, 0.35f, 0.1f, Tex.RoofTiles())));
            Emit("terrace-glass", glass, Mats.Cached("glass", () => Mats.Toon(Color.white, 1.6f, 0.92f, 0.6f)), false);
            Emit("terrace-hedges", hedge, Mats.VertexWind);
        }

        void EmmanuelRoad()
        {
            var body = new MeshKit();
            var matte = new MeshKit();
            uint[] cols = { 0xd94b3d, 0x2b2f38, 0xe6e8eb, 0x3a5fa8, 0x8a8f98, 0x274a36, 0xf2c230 };
            void Car(float x, float z, float rot)
            {
                var m = Matrix4x4.TRS(U(x, z), Quaternion.Euler(0, rot, 0), Vector3.one);
                body.M = matte.M = m;
                body.Tint(Pick(cols)).RoundBox(new Vector3(0, 0.62f, 0), new Vector3(1.8f, 0.72f, 4.1f), 0.28f);
                body.Tint(0x27303c).RoundBox(new Vector3(0, 1.22f, -0.2f), new Vector3(1.56f, 0.6f, 2.1f), 0.22f);
                body.Tint(0xfff6d8).Sphere(new Vector3(0.6f, 0.68f, 2.03f), 0.13f, 8, 6);
                body.Tint(0xfff6d8).Sphere(new Vector3(-0.6f, 0.68f, 2.03f), 0.13f, 8, 6);
                matte.Tint(0x1d1f23);
                foreach (var (wx, wz) in new[] { (0.82f, 1.3f), (-0.82f, 1.3f), (0.82f, -1.3f), (-0.82f, -1.3f) })
                    matte.Cylinder(new Vector3(wx - 0.12f * Mathf.Sign(wx), 0.34f, wz), new Vector3(wx + 0.12f * Mathf.Sign(wx), 0.34f, wz), 0.34f, 0.34f, 12);
            }
            for (float x = -58; x < 52; x += R(5.5f, 9))
                if (Mathf.Abs(x) > 10) Car(x, -35.2f, rng.NextDouble() < 0.5 ? 90 : -90);
            for (float z = -96; z < -48; z += R(6, 10)) Car(-4.6f, z, 0);
            body.M = matte.M = Matrix4x4.identity;
            Emit("cars", body, Mats.VertexGlossy);
            Emit("wheels", matte, Mats.VertexLit);
            // Street lamps along Emmanuel Road.
            var lamps = new MeshKit();
            for (float x = -55; x < 55; x += 14)
            {
                var p = U(x, -32.5f);
                lamps.Tint(0x2c3138).Cylinder(p, p + Vector3.up * 5f, 0.09f, 0.06f, 8);
                lamps.Tint(0x2c3138).RoundBox(p + new Vector3(0, 5.1f, -0.6f), new Vector3(0.3f, 0.16f, 0.6f), 0.06f);
                lamps.Tint(0xfff1c4).Box(p + new Vector3(0, 5.0f, -0.6f), new Vector3(0.2f, 0.04f, 0.45f));
            }
            Emit("lamps", lamps, Mats.VertexGlossy);
        }

        void SchoolBackdrop()
        {
            // Telferscot Primary at the top of the street: a brick block with a clock tower, behind its railings.
            var brick = new MeshKit();
            var trim = new MeshKit();
            var c = U(0, -112);
            brick.C = Color.white;
            brick.Box(c + Vector3.up * 3.5f, new Vector3(40, 7, 14), 2);
            brick.Box(c + new Vector3(0, 6, -3), new Vector3(4, 12, 4), 2);
            trim.Tint(0x6e4b3c).Cylinder(c + new Vector3(0, 12, -3), c + new Vector3(0, 15, -3), 3.2f, 0.01f, 4);
            trim.M = Matrix4x4.TRS(c + new Vector3(0, 10.2f, -0.95f), Quaternion.identity, Vector3.one);
            trim.Tint(0xffffff).Cylinder(Vector3.zero, new Vector3(0, 0, 0.1f), 1.1f, 1.1f, 20);
            trim.Tint(0x222428).Box(new Vector3(0, 0.3f, 0.12f), new Vector3(0.1f, 0.7f, 0.04f));
            trim.Tint(0x222428).Box(new Vector3(0.25f, 0, 0.12f), new Vector3(0.55f, 0.1f, 0.04f));
            trim.M = Matrix4x4.identity;
            for (int row = 0; row < 2; row++)
                for (float x = -17; x <= 17; x += 3.4f)
                {
                    if (row == 0 && Mathf.Abs(x) < 2) continue;
                    trim.Tint(0xf6f6f2).Box(c + new Vector3(x, 1.8f + row * 3, 7.02f), new Vector3(1.6f, 1.9f, 0.08f));
                    trim.Tint(0x3f6487).Box(c + new Vector3(x, 1.8f + row * 3, 7.06f), new Vector3(1.4f, 1.7f, 0.02f));
                }
            trim.Tint(0x2f5fc0).Box(c + new Vector3(0, 1.2f, 7.03f), new Vector3(2, 2.4f, 0.08f));
            // Railings across the top of the street, with the gate the street leads to.
            for (float x = -30; x <= 30; x += 0.18f)
            {
                if (Mathf.Abs(x) < 2.4f) continue;
                trim.Tint(0x2f5d3a).Box(U(x, -101, 0.7f), new Vector3(0.03f, 1.4f, 0.03f));
            }
            trim.Tint(0x2f5d3a).Box(U(-16.2f, -101, 1.3f), new Vector3(27.6f, 0.06f, 0.06f));
            trim.Tint(0x2f5d3a).Box(U(16.2f, -101, 1.3f), new Vector3(27.6f, 0.06f, 0.06f));
            Emit("school-brick", brick, Mats.Cached("schoolBrick", () => Mats.Toon(Color.white, 0.05f, 0.2f, 0.1f, Tex.Brick(MeshKit.Hex(0xa3583a)))));
            Emit("school-trim", trim, Mats.VertexLit);
        }

        // ------------------------------------------------------------------ the meadow's furniture

        void Playground()
        {
            var k = new MeshKit();
            var c = U(Common.PLAY_X, Common.PLAY_Z);
            k.M = Matrix4x4.TRS(c, Quaternion.Euler(0, 15, 0), Vector3.one);
            k.Tint(0xb9814f).RoundBox(new Vector3(0, 1.2f, 0), new Vector3(2.2f, 0.2f, 2.2f), 0.06f);
            foreach (var (dx, dz) in new[] { (-1f, -1f), (1f, -1f), (1f, 1f), (-1f, 1f) }) k.Tint(0x2f9e44).Cylinder(new Vector3(dx, 0, dz), new Vector3(dx, 2.8f, dz), 0.08f, 0.08f, 8);
            k.Tint(0xe03131).Cylinder(new Vector3(0, 2.8f, 0), new Vector3(0, 4f, 0), 1.7f, 0.02f, 4);
            k.M = Matrix4x4.TRS(c, Quaternion.Euler(0, 15, 0), Vector3.one) * Matrix4x4.TRS(new Vector3(-2.3f, 0.65f, 0), Quaternion.Euler(0, 0, 25), Vector3.one);
            k.Tint(0xffd43b).RoundBox(Vector3.zero, new Vector3(2.9f, 0.12f, 0.9f), 0.05f);
            // A swing set beside it.
            k.M = Matrix4x4.TRS(c + new Vector3(3.5f, 0, 1), Quaternion.Euler(0, 15, 0), Vector3.one);
            foreach (int s in new[] { -1, 1 })
            {
                k.Tint(0x1c7ed6).Cylinder(new Vector3(s * 1.8f, 0, -0.8f), new Vector3(s * 1.8f, 2.6f, 0), 0.07f, 0.07f, 8);
                k.Tint(0x1c7ed6).Cylinder(new Vector3(s * 1.8f, 0, 0.8f), new Vector3(s * 1.8f, 2.6f, 0), 0.07f, 0.07f, 8);
            }
            k.Tint(0x1c7ed6).Cylinder(new Vector3(-1.8f, 2.6f, 0), new Vector3(1.8f, 2.6f, 0), 0.07f, 0.07f, 8);
            foreach (float sx in new[] { -0.7f, 0.7f })
            {
                k.Tint(0xadb5bd).Cylinder(new Vector3(sx - 0.25f, 2.6f, 0), new Vector3(sx - 0.25f, 0.6f, 0), 0.02f, 0.02f, 4);
                k.Tint(0xadb5bd).Cylinder(new Vector3(sx + 0.25f, 2.6f, 0), new Vector3(sx + 0.25f, 0.6f, 0), 0.02f, 0.02f, 4);
                k.Tint(0xff922b).RoundBox(new Vector3(sx, 0.58f, 0), new Vector3(0.65f, 0.06f, 0.3f), 0.03f);
            }
            k.M = Matrix4x4.identity;
            var go = Emit("playground", k, Mats.VertexGlossy);
            Occluders.Add(new Occluder { minX = Common.PLAY_X - 3, maxX = Common.PLAY_X + 6, northZ = Common.PLAY_Z - 2, southZ = Common.PLAY_Z + 2, reach = 3, renderers = new Renderer[] { go.GetComponent<Renderer>() } });
        }

        void Benches()
        {
            var k = new MeshKit();
            foreach (var (x, z, rot) in new[] { (-4f, -24f, 0f), (26f, 2f, 70f), (-28f, 4f, 100f), (10f, 44f, 20f) })
            {
                k.M = Matrix4x4.TRS(U(x, z), Quaternion.Euler(0, rot, 0), Vector3.one);
                k.Tint(0x9a6a44).RoundBox(new Vector3(0, 0.45f, 0), new Vector3(1.8f, 0.07f, 0.45f), 0.03f);
                k.Tint(0x9a6a44).RoundBox(new Vector3(0, 0.8f, -0.22f), new Vector3(1.8f, 0.35f, 0.06f), 0.03f);
                foreach (int s in new[] { -1, 1 }) k.Tint(0x2c3138).Box(new Vector3(s * 0.75f, 0.4f, 0), new Vector3(0.08f, 0.8f, 0.5f));
            }
            k.M = Matrix4x4.identity;
            Emit("benches", k, Mats.VertexLit);
        }

        void Log()
        {
            var go = new GameObject("fallen-log", typeof(MeshFilter), typeof(MeshRenderer));
            go.transform.SetParent(root, false);
            go.transform.localPosition = U(Common.LOG_X, Common.LOG_Z);
            go.transform.localRotation = Quaternion.Euler(0, Common.LOG_ANGLE * Mathf.Rad2Deg, 0);
            go.GetComponent<MeshFilter>().sharedMesh = ModelsWild.Log();
            go.GetComponent<MeshRenderer>().sharedMaterial = Mats.VertexLit;
        }

        void Glade()
        {
            // A fairy ring of glowing toadstools, and fireflies drifting over the clearing.
            var k = new MeshKit();
            for (int i = 0; i < 16; i++)
            {
                float a = i / 16f * Mathf.PI * 2;
                var p = U(Common.GLADE_X + Mathf.Cos(a) * 4.2f, Common.GLADE_Z + Mathf.Sin(a) * 3.2f);
                float s = R(0.7f, 1.2f);
                k.Tint(0xf4ead2).Cylinder(p, p + Vector3.up * 0.25f * s, 0.05f * s, 0.04f * s, 6);
                k.Tint(i % 3 == 0 ? 0x9b4dffu : 0x3ff0ffu).Sphere(p + Vector3.up * 0.27f * s, new Vector3(0.16f, 0.08f, 0.16f) * s, 10, 6, 0, 0.5f);
            }
            var go = Emit("fairy-ring", k, Mats.Cached("fairyGlow", () => { var m = Mats.Toon(Color.white, 0.3f, 0.5f, 0.6f); m.SetColor("_EmissionColor", new Color(0.35f, 0.45f, 0.8f)); return m; }), false);
            var ff = new GameObject("Fireflies");
            ff.transform.SetParent(root, false);
            ff.transform.localPosition = U(Common.GLADE_X, Common.GLADE_Z, 1.2f);
            var ps = ff.AddComponent<ParticleSystem>();
            ps.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            var main = ps.main;
            main.loop = true; main.startLifetime = new ParticleSystem.MinMaxCurve(3, 6); main.startSpeed = 0.2f;
            main.startSize = new ParticleSystem.MinMaxCurve(0.12f, 0.22f); main.maxParticles = 120;
            main.startColor = new ParticleSystem.MinMaxGradient(new Color(1f, 0.95f, 0.5f), new Color(0.75f, 1f, 0.5f));
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            var em = ps.emission; em.rateOverTime = 18;
            var sh = ps.shape; sh.shapeType = ParticleSystemShapeType.Box; sh.scale = new Vector3(16, 2, 12);
            var noise = ps.noise; noise.enabled = true; noise.strength = 0.6f; noise.frequency = 0.4f;
            var col = ps.colorOverLifetime; col.enabled = true;
            var g = new Gradient();
            g.SetKeys(new[] { new GradientColorKey(Color.white, 0), new GradientColorKey(Color.white, 1) }, new[] { new GradientAlphaKey(0, 0), new GradientAlphaKey(1, 0.2f), new GradientAlphaKey(0.3f, 0.5f), new GradientAlphaKey(1, 0.7f), new GradientAlphaKey(0, 1) });
            col.color = g;
            ff.GetComponent<ParticleSystemRenderer>().sharedMaterial = Mats.Glow(Color.white, 0, true, 3);
            ps.Play();
        }

        void Lawn(bool hiRes)
        {
            var go = new GameObject("Lawn");
            go.transform.SetParent(root, false);
            var grass = go.AddComponent<GrassField>();
            Vector2 a = new Vector2(50, -30), b = new Vector2(18, 6), c = new Vector2(0, 50);
            float SegDist(Vector2 p, Vector2 s0, Vector2 s1)
            {
                var d = s1 - s0;
                float t = Mathf.Clamp01(Vector2.Dot(p - s0, d) / d.sqrMagnitude);
                return Vector2.Distance(p, s0 + d * t);
            }
            var stage = Stage.For(StageId.Common);
            grass.Build(-58, -31, 53, 53, hiRes ? 0.42f : 0.55f, 0.03f, 21, (x, z) =>
            {
                var p = new Vector2(x, z);
                float path = Mathf.Min(SegDist(p, a, b), SegDist(p, b, c));
                if (path < 1.4f) return 0;
                if (!Collide.IsFree(stage, x, z, 0.3f)) return 0;
                float play = ((x - Common.PLAY_X) / 5.2f) * ((x - Common.PLAY_X) / 5.2f) + ((z - Common.PLAY_Z) / 4.2f) * ((z - Common.PLAY_Z) / 4.2f);
                if (play < 1) return 0;
                float tuss = Mathf.PerlinNoise(x * 0.12f + 3, z * 0.12f + 7);
                return Mathf.Clamp01(0.35f + tuss * 0.9f) * Mathf.Clamp01((path - 1.4f) / 1.2f + 0.4f);
            });
        }
    }
}
