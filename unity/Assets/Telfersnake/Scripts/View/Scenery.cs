using System.Collections.Generic;
using Telfer.Sim;
using UnityEngine;
using UnityEngine.Rendering;

namespace Telfer.View
{
    /// <summary>Something that can screen-door fade when it stands between the camera and the player's snake.</summary>
    public sealed class Occluder
    {
        public float minX, maxX, northZ, southZ, reach;
        public Renderer[] renderers;
        public float fade = 1;
    }

    /// <summary>
    /// Every fixed thing in and around the playground, modelled in code: the Victorian Old School,
    /// the north block with its solar roof and pergola, the Cage, the shade sail, the climbing
    /// platform, picnic benches, trees, cars, railings, bunting and the terraced streets beyond.
    /// </summary>
    public sealed class Scenery
    {
        public readonly List<Occluder> Occluders = new List<Occluder>();
        readonly Transform root;
        readonly System.Random rng = new System.Random(11);
        float R(float a, float b) => a + (float)rng.NextDouble() * (b - a);
        T Pick<T>(T[] a) => a[rng.Next(a.Length)];

        Material brickMat, tileMat, glassMat, corrugatedMat, solarMat, chainMat, houseBrickMat;

        public Scenery(Transform parent)
        {
            root = new GameObject("Scenery").transform;
            root.SetParent(parent, false);

            brickMat = Mats.Toon(Color.white, gloss: 0.05f, smooth: 0.2f, rim: 0.1f, tex: Tex.Brick(MeshKit.Hex(0xa3583a)));
            houseBrickMat = Mats.Toon(Color.white, gloss: 0.05f, smooth: 0.2f, rim: 0.1f, tex: Tex.Brick(MeshKit.Hex(0xb4704a)));
            tileMat = Mats.Toon(Color.white, gloss: 0.12f, smooth: 0.35f, rim: 0.1f, tex: Tex.RoofTiles());
            glassMat = Mats.Toon(Color.white, gloss: 1.6f, smooth: 0.92f, rim: 0.6f);
            glassMat.SetColor("_RimColor", new Color(0.75f, 0.88f, 1f));
            corrugatedMat = Mats.Toon(Color.white, gloss: 0.5f, smooth: 0.6f, rim: 0.15f, tex: Tex.Corrugated());
            solarMat = Mats.Toon(Color.white, gloss: 1.4f, smooth: 0.9f, rim: 0.3f, tex: Tex.Solar(), vertexColor: false);
            chainMat = Mats.Toon(MeshKit.Hex(0xa9c4cc), gloss: 0.6f, smooth: 0.6f, rim: 0.2f, vertexColor: false);
            chainMat.SetFloat("_ChainLink", 5.5f);
            chainMat.SetFloat("_Cull", 0);

            foreach (var b in School.BUILDINGS) Building(b);
            Court();
            Sail();
            Platform();
            Benches();
            Trees();
            Cars(School.CARS, null);
            SchoolFence();
            Bunting();
            Neighbourhood();
            Lamps();
        }

        // ------------------------------------------------------------------ helpers

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

        // ------------------------------------------------------------------ buildings

        void Building(Building b)
        {
            var group = new GameObject(b.id).transform;
            group.SetParent(root, false);
            var walls = new MeshKit();
            var roof = new MeshKit();
            var trim = new MeshKit();
            var glass = new MeshKit();

            var c = U(b.box.x, b.box.z);
            float w = b.box.w, d = b.box.d, h = b.h;
            bool brick = b.brick;
            walls.C = brick ? Color.white : MeshKit.Hex(b.wall);
            walls.Box(c + Vector3.up * h / 2, new Vector3(w, h, d), brick ? 2 : 0);

            // A darker plinth and a white string course on the brick buildings.
            trim.Tint(brick ? 0x6b3b2au : 0x9aa0a8u).Box(c + Vector3.up * 0.22f, new Vector3(w + 0.12f, 0.44f, d + 0.12f));
            if (brick) trim.Tint(0xf1ebe0).Box(c + Vector3.up * (h - 0.35f), new Vector3(w + 0.1f, 0.18f, d + 0.1f));

            if (b.id == "bikeShed") { BikeShed(b, group); return; }
            if (b.id == "blackShed")
            {
                var k2 = new MeshKit();
                k2.Tint(0x2d3038).Box(c + Vector3.up * h / 2, new Vector3(w, h, d), 1);
                var go2 = Emit("container", k2, corrugatedMat, true, group);
                trim.Tint(0xe2b02f).Box(c + new Vector3(0, h * 0.5f, -d / 2 - 0.03f), new Vector3(w * 0.9f, 0.12f, 0.04f));
                Emit("trim", trim, Mats.VertexLit, true, group);
                Occluders.Add(new Occluder { minX = b.box.x - w / 2, maxX = b.box.x + w / 2, northZ = b.box.z - d / 2, southZ = b.box.z + d / 2, reach = h * 0.65f + 1, renderers = group.GetComponentsInChildren<Renderer>() });
                return;
            }

            Windows(b, trim, glass);

            if (b.roofH > 0) Gable(c, w, d, h, b.roofH, b.roof, roof, walls, brick);
            else FlatRoof(b, c, w, d, h, trim, glass, group);

            // Chimneys on the Victorian roofs.
            if (brick)
            {
                bool alongZ = d >= w;
                float ridge = h + b.roofH;
                for (int i = -1; i <= 1; i += 2)
                {
                    var p = c + (alongZ ? new Vector3(0, 0, i * d * 0.3f) : new Vector3(i * w * 0.3f, 0, 0));
                    walls.C = Color.white;
                    walls.Box(p + Vector3.up * (ridge + 0.3f), new Vector3(1.1f, 2.0f, 0.8f), 2);
                    trim.Tint(0xf1ebe0).Box(p + Vector3.up * (ridge + 1.35f), new Vector3(1.25f, 0.15f, 0.95f));
                    trim.Tint(0xc4683f).Cylinder(p + new Vector3(-0.22f, ridge + 1.4f, 0), p + new Vector3(-0.22f, ridge + 1.85f, 0), 0.14f, 0.12f, 8);
                    trim.Tint(0xc4683f).Cylinder(p + new Vector3(0.22f, ridge + 1.4f, 0), p + new Vector3(0.22f, ridge + 1.8f, 0), 0.14f, 0.12f, 8);
                }
            }
            if (b.id == "oldNorthEast")
            {
                // The glass atrium along the north wing's ridge.
                glass.Tint(0xbfd8ea).Box(c + Vector3.up * (h + b.roofH - 0.1f), new Vector3(18, 0.9f, 3.6f));
                trim.Tint(0xf4f4f4);
                for (float x = -9; x <= 9; x += 1.5f) trim.Box(c + new Vector3(x, h + b.roofH - 0.1f, 0), new Vector3(0.08f, 0.95f, 3.7f));
            }
            if (b.id == "redHut")
            {
                // A little porch and a "TUCK SHOP" style awning stripe.
                for (int i = 0; i < 8; i++)
                {
                    trim.Tint(i % 2 == 0 ? 0xe9633bu : 0xfff4e0u);
                    trim.Box(c + new Vector3(-w / 2 + 0.75f + i * 1.5f, h - 0.5f, -d / 2 - 0.55f), new Vector3(1.5f, 0.12f, 1.1f));
                }
            }

            Emit("walls", walls, brick ? brickMat : Mats.VertexLit, true, group);
            Emit("roof", roof, tileMat, true, group);
            Emit("trim", trim, Mats.VertexLit, true, group);
            Emit("glass", glass, glassMat, false, group);

            Occluders.Add(new Occluder
            {
                minX = b.box.x - w / 2, maxX = b.box.x + w / 2, northZ = b.box.z - d / 2, southZ = b.box.z + d / 2,
                reach = (h + b.roofH) * 0.65f + 1, renderers = group.GetComponentsInChildren<Renderer>(),
            });
        }

        void Windows(Building b, MeshKit trim, MeshKit glass)
        {
            var c = U(b.box.x, b.box.z);
            float w = b.box.w, d = b.box.d, h = b.h;
            bool modern = b.id == "northBlock";
            float winW = modern ? 2.2f : b.brick ? 1.3f : 1.1f;
            float winH = modern ? 1.6f : b.brick ? 2.1f : 1.1f;
            float spacing = modern ? 2.8f : b.brick ? 2.7f : 2.6f;
            int floors = h > 4.2f && !modern ? 1 : 1;
            // four faces: (normal, along axis, face length)
            var faces = new (Vector3 n, Vector3 along, float len, float half)[]
            {
                (Vector3.back, Vector3.right, w, d / 2), (Vector3.forward, Vector3.right, w, d / 2),
                (Vector3.right, Vector3.forward, d, w / 2), (Vector3.left, Vector3.forward, d, w / 2),
            };
            foreach (var f in faces)
            {
                int count = Mathf.FloorToInt((f.len - 2) / spacing);
                if (count < 1) continue;
                float start = -(count - 1) * spacing / 2;
                bool door = f.n == Vector3.back || (f.n == Vector3.left && b.id == "oldMain");
                for (int i = 0; i < count; i++)
                {
                    var along = f.along * (start + i * spacing);
                    bool isDoor = door && i == count / 2 && b.id != "northBlock";
                    for (int fl = 0; fl < floors; fl++)
                    {
                        float y = isDoor ? 1.15f : (modern ? 2.2f : h * 0.5f + 0.1f);
                        float ww = isDoor ? 1.5f : winW, hh = isDoor ? 2.3f : winH;
                        var p = c + f.n * (f.half + 0.01f) + along + Vector3.up * y;
                        var rot = Quaternion.LookRotation(f.n);
                        // Frame, then the glass (or a door) set back inside it.
                        trim.M = Matrix4x4.TRS(p, rot, Vector3.one);
                        trim.Tint(isDoor ? 0xf4f1eau : 0xf6f6f2u);
                        trim.Box(new Vector3(0, 0, 0.03f), new Vector3(ww + 0.22f, hh + 0.22f, 0.08f));
                        if (!isDoor) trim.Box(new Vector3(0, -hh / 2 - 0.12f, 0.1f), new Vector3(ww + 0.4f, 0.1f, 0.22f)); // sill
                        if (b.brick && !isDoor) trim.Box(new Vector3(0, hh / 2 + 0.2f, 0.04f), new Vector3(ww + 0.5f, 0.22f, 0.1f)); // lintel
                        if (isDoor)
                        {
                            trim.Tint(0x2f5fc0).Box(new Vector3(0, 0, 0.08f), new Vector3(ww, hh, 0.06f));
                            trim.Tint(0xffd21f).Sphere(new Vector3(ww * 0.32f, 0, 0.14f), 0.06f, 8, 6);
                            trim.Tint(0xb9b4ab).Box(new Vector3(0, -hh / 2 - 0.05f, 0.35f), new Vector3(ww + 0.6f, 0.12f, 0.7f));
                        }
                        else
                        {
                            glass.M = trim.M;
                            glass.Tint(modern ? 0x5c86a8u : 0x3f6487u);
                            glass.Box(new Vector3(0, 0, 0.08f), new Vector3(ww, hh, 0.02f));
                            // Glazing bars.
                            trim.Tint(0xf6f6f2);
                            trim.Box(new Vector3(0, 0, 0.1f), new Vector3(0.06f, hh, 0.03f));
                            trim.Box(new Vector3(0, b.brick ? hh * 0.15f : 0, 0.1f), new Vector3(ww, 0.06f, 0.03f));
                        }
                        trim.M = Matrix4x4.identity; glass.M = Matrix4x4.identity;
                    }
                }
            }
        }

        void Gable(Vector3 c, float w, float d, float h, float roofH, uint roofColor, MeshKit roof, MeshKit walls, bool brick)
        {
            bool alongZ = d >= w;
            float W2 = (alongZ ? w : d) / 2, L2 = (alongZ ? d : w) / 2;
            const float o = 0.5f;
            var rot = alongZ ? Quaternion.identity : Quaternion.Euler(0, 90, 0);
            roof.M = Matrix4x4.TRS(c, rot, Vector3.one);
            walls.M = roof.M;
            float yE = h - o * roofH / W2, yR = h + roofH;
            float slope = Mathf.Sqrt((W2 + o) * (W2 + o) + (yR - yE) * (yR - yE));
            var uv = new Vector2((L2 + o) * 2 / 1.6f, slope / 1.6f);
            roof.C = MeshKit.Hex(roofColor);
            roof.Quad(new Vector3(-W2 - o, yE, -L2 - o), new Vector3(-W2 - o, yE, L2 + o), new Vector3(0, yR, L2 + o), new Vector3(0, yR, -L2 - o), uv, true);
            roof.Quad(new Vector3(W2 + o, yE, L2 + o), new Vector3(W2 + o, yE, -L2 - o), new Vector3(0, yR, -L2 - o), new Vector3(0, yR, L2 + o), uv, true);
            // Ridge tiles.
            roof.C = MeshKit.Hex(roofColor) * 0.8f; roof.C.a = 1;
            roof.Cylinder(new Vector3(0, yR, -L2 - o), new Vector3(0, yR, L2 + o), 0.14f, 0.14f, 8);
            // Gable ends, brick-mapped in metres.
            walls.C = brick ? Color.white : walls.C;
            float s = 0.5f;
            walls.TriUV(new Vector3(-W2, h, L2), new Vector3(W2, h, L2), new Vector3(0, yR, L2), new Vector2(-W2 * s, h * s), new Vector2(W2 * s, h * s), new Vector2(0, yR * s));
            walls.TriUV(new Vector3(W2, h, -L2), new Vector3(-W2, h, -L2), new Vector3(0, yR, -L2), new Vector2(W2 * s, h * s), new Vector2(-W2 * s, h * s), new Vector2(0, yR * s));
            roof.M = Matrix4x4.identity; walls.M = Matrix4x4.identity;
        }

        void FlatRoof(Building b, Vector3 c, float w, float d, float h, MeshKit trim, MeshKit glass, Transform group)
        {
            trim.Tint(b.roof).Box(c + Vector3.up * (h + 0.15f), new Vector3(w + 0.4f, 0.3f, d + 0.4f));
            trim.Tint(0xe9ecef).Box(c + new Vector3(0, h + 0.45f, d / 2 + 0.15f), new Vector3(w + 0.4f, 0.3f, 0.12f));
            trim.Tint(0xe9ecef).Box(c + new Vector3(0, h + 0.45f, -d / 2 - 0.15f), new Vector3(w + 0.4f, 0.3f, 0.12f));
            if (b.id != "northBlock") return;
            // Solar panels in tidy tilted rows.
            var solar = new MeshKit();
            for (float x = -w / 2 + 3; x < w / 2 - 2; x += 3.2f)
            {
                solar.M = Matrix4x4.TRS(c + new Vector3(x, h + 0.6f, 1), Quaternion.Euler(-14, 0, 0), Vector3.one);
                solar.Box(Vector3.zero, new Vector3(2.6f, 0.08f, 4.5f), 1.3f);
                trim.M = solar.M;
                trim.Tint(0xb9bec6).Box(new Vector3(0, -0.25f, 1.8f), new Vector3(2.4f, 0.4f, 0.08f));
                trim.M = Matrix4x4.identity;
            }
            solar.M = Matrix4x4.identity;
            Emit("solar", solar, solarMat, true, group);
            // A pergola of white slats along the south face: stripy shadows on the top playground.
            var pz = c.z - d / 2 - 1.3f;
            for (float x = -w / 2 + 4; x <= w / 2 - 4; x += 0.55f)
                trim.Tint(0xfafafa).Box(new Vector3(c.x + x + 2, 3.05f, pz), new Vector3(0.14f, 0.12f, 2.6f));
            trim.Tint(0xfafafa).Box(new Vector3(c.x + 2, 2.95f, pz - 1.2f), new Vector3(w - 8, 0.14f, 0.14f));
            for (float x = -w / 2 + 4; x <= w / 2 - 4; x += 5)
                trim.Tint(0xf0f0f0).Cylinder(new Vector3(c.x + x + 2, 0, pz - 1.2f), new Vector3(c.x + x + 2, 2.95f, pz - 1.2f), 0.09f, 0.09f, 8);
        }

        void BikeShed(Building b, Transform group)
        {
            var c = U(b.box.x, b.box.z);
            float w = b.box.w, d = b.box.d, h = b.h;
            var frame = new MeshKit();
            var roof = new MeshKit();
            frame.Tint(0x4d5560);
            for (float x = -w / 2 + 0.2f; x <= w / 2; x += w / 5)
                foreach (float z in new[] { -d / 2 + 0.15f, d / 2 - 0.15f })
                    frame.Cylinder(c + new Vector3(x, 0, z), c + new Vector3(x, h + (z > 0 ? 0.6f : 0), z), 0.07f, 0.07f, 8);
            roof.M = Matrix4x4.TRS(c + Vector3.up * (h + 0.3f), Quaternion.Euler(-Mathf.Atan2(0.6f, d) * Mathf.Rad2Deg, 0, 0), Vector3.one);
            roof.Tint(0xc9ccd1).Box(Vector3.zero, new Vector3(w + 0.6f, 0.08f, d + 0.8f), 1);
            roof.M = Matrix4x4.identity;
            // A row of bikes in primary colours.
            uint[] bikeCols = { 0xe03131, 0x1c7ed6, 0x2f9e44, 0xf59f00, 0x7048e8, 0xe64980 };
            for (int i = 0; i < 12; i++)
            {
                var p = c + new Vector3(-w / 2 + 1 + i * 1.3f, 0, 0.6f);
                var tyre = MeshKit.Hex(0x222428);
                frame.M = Matrix4x4.TRS(p + new Vector3(0, 0.35f, 0.55f), Quaternion.Euler(0, 0, 90), Vector3.one);
                frame.C = tyre; frame.Torus(Vector3.zero, 0.32f, 0.04f, 16, 6);
                frame.M = Matrix4x4.TRS(p + new Vector3(0, 0.35f, -0.55f), Quaternion.Euler(0, 0, 90), Vector3.one);
                frame.Torus(Vector3.zero, 0.32f, 0.04f, 16, 6);
                frame.M = Matrix4x4.identity;
                frame.Tint(bikeCols[i % bikeCols.Length]);
                frame.Cylinder(p + new Vector3(0, 0.35f, 0.55f), p + new Vector3(0, 0.75f, 0.05f), 0.035f, 0.035f, 6);
                frame.Cylinder(p + new Vector3(0, 0.35f, -0.55f), p + new Vector3(0, 0.75f, 0.05f), 0.035f, 0.035f, 6);
                frame.Cylinder(p + new Vector3(0, 0.75f, 0.05f), p + new Vector3(0, 0.95f, -0.2f), 0.035f, 0.035f, 6);
                frame.Tint(0x222428).Box(p + new Vector3(0, 0.98f, -0.22f), new Vector3(0.12f, 0.06f, 0.25f));
                frame.Cylinder(p + new Vector3(-0.25f, 0.95f, 0.45f), p + new Vector3(0.25f, 0.95f, 0.45f), 0.025f, 0.025f, 6);
            }
            Emit("frame", frame, Mats.VertexGlossy, true, group);
            Emit("roof", roof, corrugatedMat, true, group);
            Occluders.Add(new Occluder { minX = b.box.x - w / 2, maxX = b.box.x + w / 2, northZ = b.box.z - d / 2, southZ = b.box.z + d / 2, reach = h * 0.65f + 1, renderers = group.GetComponentsInChildren<Renderer>() });
        }

        // ------------------------------------------------------------------ the Cage

        void Court()
        {
            var g = new GameObject("Cage").transform;
            g.SetParent(root, false);
            var mesh = new MeshKit();
            var posts = new MeshKit();
            const float H = 3;
            foreach (var f in School.COURT_FENCES)
            {
                bool alongX = f.w > f.d;
                float len = alongX ? f.w : f.d;
                var c = U(f.x, f.z);
                var axis = alongX ? Vector3.right : Vector3.forward;
                var a = c - axis * len / 2;
                var b = c + axis * len / 2;
                mesh.Quad(a, b, b + Vector3.up * H, a + Vector3.up * H, new Vector2(len, H), false);
                int n = Mathf.Max(1, Mathf.RoundToInt(len / 3));
                posts.Tint(0x2f6f7a);
                for (int i = 0; i <= n; i++)
                {
                    var p = Vector3.Lerp(a, b, i / (float)n);
                    posts.Cylinder(p, p + Vector3.up * (H + 0.1f), 0.07f, 0.07f, 8);
                    posts.Sphere(p + Vector3.up * (H + 0.12f), 0.09f, 8, 6);
                }
                posts.Cylinder(a + Vector3.up * H, b + Vector3.up * H, 0.045f, 0.045f, 6);
                posts.Cylinder(a + Vector3.up * 0.05f, b + Vector3.up * 0.05f, 0.04f, 0.04f, 6);
            }
            // Mini goals snug against the end fences.
            var cc = School.COURT;
            foreach (var (z, dir) in new[] { (cc.z - cc.d / 2 + 0.6f, 1f), (cc.z + cc.d / 2 - 0.6f, -1f) })
            {
                var c = U(cc.x, z);
                posts.Tint(0xffffff);
                posts.Cylinder(c + new Vector3(-1.5f, 0, 0), c + new Vector3(-1.5f, 1.4f, 0), 0.06f, 0.06f, 8);
                posts.Cylinder(c + new Vector3(1.5f, 0, 0), c + new Vector3(1.5f, 1.4f, 0), 0.06f, 0.06f, 8);
                posts.Cylinder(c + new Vector3(-1.5f, 1.4f, 0), c + new Vector3(1.5f, 1.4f, 0), 0.06f, 0.06f, 8);
                var back = c + new Vector3(0, 0, dir * 0.5f);
                mesh.Quad(c + new Vector3(-1.5f, 1.4f, 0), c + new Vector3(1.5f, 1.4f, 0), back + new Vector3(1.5f, 0, 0), back + new Vector3(-1.5f, 0, 0), new Vector2(3, 1.5f));
            }
            // A ball parked in a corner.
            posts.Tint(0xffffff).Sphere(U(cc.x - 6.5f, cc.z + 12.5f, 0.22f), 0.22f, 14, 10);
            posts.Tint(0x222222).Sphere(U(cc.x - 6.5f, cc.z + 12.5f, 0.22f) + new Vector3(0, 0.12f, 0.12f), 0.09f, 8, 6);
            Emit("chainlink", mesh, chainMat, true, g);
            Emit("posts", posts, Mats.VertexGlossy, true, g);
        }

        // ------------------------------------------------------------------ the shade sail (the safe place)

        void Sail()
        {
            var s = School.SAIL;
            float hw = s.w / 2, hd = s.d / 2;
            var c = U(s.x, s.z);
            Vector3[] corners = { c + new Vector3(-hw, 4.4f, hd), c + new Vector3(hw, 3.1f, hd), c + new Vector3(hw, 4.4f, -hd), c + new Vector3(-hw, 3.1f, -hd) };
            var cloth = new MeshKit();
            const int N = 14;
            int start = 0;
            for (int i = 0; i <= N; i++)
                for (int j = 0; j <= N; j++)
                {
                    float u = i / (float)N, v = j / (float)N;
                    var p = Vector3.Lerp(Vector3.Lerp(corners[0], corners[1], u), Vector3.Lerp(corners[3], corners[2], u), v);
                    // Sag towards the middle, and the edges curve in like a real tensioned sail.
                    p.y -= Mathf.Sin(u * Mathf.PI) * Mathf.Sin(v * Mathf.PI) * 0.45f;
                    // Alternating panels, like a real stitched sail.
                    float tri = Mathf.FloorToInt((u - v + 1) * 3.5f) % 2 == 0 ? 1 : 0.8f;
                    cloth.C = Color.Lerp(MeshKit.Hex(0x2f6fd6), MeshKit.Hex(0x1d4fa3), (u + v) * 0.5f) * tri;
                    cloth.C.a = 1;
                    cloth.V.Add(p); cloth.N.Add(Vector3.up); cloth.Col.Add(cloth.C); cloth.UV.Add(new Vector2(u, v * 0.6f + 0.4f));
                }
            for (int i = 0; i < N; i++)
                for (int j = 0; j < N; j++)
                {
                    int a = start + i * (N + 1) + j, b = a + N + 1;
                    cloth.Tri(a, b, a + 1); cloth.Tri(a + 1, b, b + 1);
                }
            var m = cloth.ToMesh("sail");
            m.RecalculateNormals();
            var go = new GameObject("Sail", typeof(MeshFilter), typeof(MeshRenderer));
            go.transform.SetParent(root, false);
            go.GetComponent<MeshFilter>().sharedMesh = m;
            var mat = Mats.Cached("sailCloth", () => { var x = Mats.Toon(Color.white, gloss: 0.15f, smooth: 0.4f, rim: 0.2f); x.SetFloat("_Cull", 0); x.SetFloat("_Translucency", 0.7f); x.SetFloat("_WindAmount", 0.25f); x.SetFloat("_WindHeight", 0.08f); return x; });
            go.GetComponent<MeshRenderer>().sharedMaterial = mat;
            var posts = new MeshKit();
            foreach (var p in corners)
            {
                var foot = new Vector3(p.x, 0, p.z) + (new Vector3(p.x, 0, p.z) - new Vector3(c.x, 0, c.z)).normalized * 0.4f;
                posts.Tint(0x3b4350).Cylinder(foot, p + Vector3.up * 0.3f, 0.09f, 0.07f, 10);
                posts.Tint(0xd9dee5).Cylinder(p, foot + Vector3.up * 0.2f, 0.012f, 0.012f, 4, false, false);
            }
            var postsGo = Emit("sailPosts", posts, Mats.VertexGlossy, true);
            Occluders.Add(new Occluder { minX = s.x - s.w / 2 - 1, maxX = s.x + s.w / 2 + 1, northZ = s.z - s.d / 2, southZ = s.z + s.d / 2, reach = 3.5f, renderers = new Renderer[] { go.GetComponent<MeshRenderer>() } });
        }

        // ------------------------------------------------------------------ climbing platform, benches

        void Platform()
        {
            var b = School.PLATFORM;
            var c = U(b.x, b.z);
            var k = new MeshKit();
            k.Tint(0xb9814f).RoundBox(c + Vector3.up * 0.6f, new Vector3(b.w, 1.2f, b.d), 0.12f);
            foreach (var (dx, dz) in new[] { (-0.9f, -0.9f), (0.9f, -0.9f), (0.9f, 0.9f), (-0.9f, 0.9f) })
                k.Tint(0x8a5a3a).Box(c + new Vector3(dx, 1.4f, dz), new Vector3(0.14f, 2.8f, 0.14f));
            k.M = Matrix4x4.TRS(c + Vector3.up * 2.8f, Quaternion.Euler(0, 45, 0), Vector3.one);
            k.Tint(0xf2c94c).Cylinder(Vector3.zero, Vector3.up * 1.1f, 1.65f, 0.02f, 4, true, false, false);
            k.M = Matrix4x4.identity;
            k.Tint(0xf2c94c).Sphere(c + Vector3.up * 3.95f, 0.14f, 8, 6);
            // Slide.
            k.M = Matrix4x4.TRS(c + new Vector3(-2.05f, 0.62f, 0), Quaternion.Euler(0, 0, 24), Vector3.one);
            k.Tint(0xe0524d).RoundBox(Vector3.zero, new Vector3(2.8f, 0.12f, 0.85f), 0.05f);
            k.Tint(0xc43f3a).Box(new Vector3(0, 0.15f, 0.42f), new Vector3(2.8f, 0.25f, 0.06f));
            k.Tint(0xc43f3a).Box(new Vector3(0, 0.15f, -0.42f), new Vector3(2.8f, 0.25f, 0.06f));
            k.M = Matrix4x4.identity;
            // Ladder on the far side.
            for (int i = 0; i < 4; i++) k.Tint(0x8a5a3a).Box(c + new Vector3(1.15f, 0.25f + i * 0.28f, 0), new Vector3(0.08f, 0.06f, 0.8f));
            Emit("platform", k, Mats.VertexLit);
        }

        void Benches()
        {
            var k = new MeshKit();
            foreach (var b in School.BENCHES)
            {
                var c = U(b.x, b.z);
                k.Tint(0x9a6a44).RoundBox(c + Vector3.up * 0.72f, new Vector3(b.w, 0.08f, b.d), 0.03f);
                foreach (int side in new[] { -1, 1 })
                {
                    k.Tint(0x8a5a3a).RoundBox(c + new Vector3(0, 0.43f, side * (b.d / 2 + 0.28f)), new Vector3(b.w, 0.07f, 0.32f), 0.03f);
                    foreach (int end in new[] { -1, 1 })
                    {
                        k.Tint(0x6b4a2f).Cylinder(c + new Vector3(end * (b.w / 2 - 0.15f), 0, side * 0.6f), c + new Vector3(end * (b.w / 2 - 0.15f), 0.72f, 0), 0.04f, 0.04f, 6);
                    }
                }
                // Lunch left behind.
                k.Tint(0xe03131).RoundBox(c + new Vector3(0.4f, 0.82f, 0.1f), new Vector3(0.3f, 0.14f, 0.22f), 0.04f);
                k.Tint(0xffffff).Cylinder(c + new Vector3(-0.3f, 0.76f, -0.1f), c + new Vector3(-0.3f, 0.95f, -0.1f), 0.05f, 0.05f, 10);
            }
            Emit("benches", k, Mats.VertexLit);
        }

        // ------------------------------------------------------------------ trees

        void Trees()
        {
            foreach (var t in School.TREES) Tree(t.x, t.z, t.canopy, true);
            foreach (var z in new float[] { -33, -20, -6, 5, 16, 29 }) Tree(School.BOUNDS.minX - 2, z, 1.7f, true);
            foreach (var z in new float[] { -28, -4, 20 }) Tree(School.BOUNDS.maxX + 2.2f, z, 1.5f, true);
            // Street trees further out, and a park's worth beyond the houses.
            for (float z = -140; z < 140; z += R(9, 14))
            {
                Tree(-70f + R(-1.5f, 1.5f), z, R(1.8f, 2.8f), false);
                Tree(70f + R(-1.5f, 1.5f), z + 4, R(1.8f, 2.8f), false);
            }
        }

        void Tree(float x, float z, float canopy, bool occludes)
        {
            var go = new GameObject("tree").transform;
            go.SetParent(root, false);
            go.localPosition = U(x, z);
            go.localRotation = Quaternion.Euler(0, R(0, 360), 0);
            var trunk = new MeshKit();
            float h = canopy * 1.1f + 0.8f;
            trunk.Tint(0x6b4a2f);
            trunk.Cylinder(Vector3.zero, Vector3.up * (h + canopy * 0.3f), canopy * 0.16f, canopy * 0.08f, 9);
            trunk.Cylinder(Vector3.up * h * 0.6f, new Vector3(canopy * 0.6f, h + canopy * 0.2f, 0.2f), canopy * 0.07f, canopy * 0.03f, 6);
            trunk.Cylinder(Vector3.up * h * 0.7f, new Vector3(-canopy * 0.5f, h + canopy * 0.3f, -0.3f), canopy * 0.06f, canopy * 0.03f, 6);
            // Roots flaring into the ground.
            for (int i = 0; i < 4; i++)
            {
                float a = i * Mathf.PI / 2 + 0.4f;
                trunk.Cylinder(new Vector3(0, canopy * 0.25f, 0), new Vector3(Mathf.Cos(a) * canopy * 0.35f, 0, Mathf.Sin(a) * canopy * 0.35f), canopy * 0.08f, canopy * 0.02f, 5);
            }
            var leaves = new MeshKit();
            Color[] greens = { MeshKit.Hex(0x3f9a3c), MeshKit.Hex(0x57b04a), MeshKit.Hex(0x2f7f35), MeshKit.Hex(0x6cbf4f) };
            int lumps = 6 + (int)(canopy * 2);
            var top = Vector3.up * (h + canopy * 0.55f);
            var baseCol = greens[rng.Next(greens.Length)];
            for (int i = 0; i < lumps; i++)
            {
                float a = R(0, Mathf.PI * 2), r = i == 0 ? 0 : R(0.35f, 0.75f) * canopy;
                var p = top + new Vector3(Mathf.Cos(a) * r, R(-0.35f, 0.4f) * canopy, Mathf.Sin(a) * r);
                float s = canopy * (i == 0 ? 0.85f : R(0.45f, 0.7f));
                float lift = Mathf.InverseLerp(top.y - canopy, top.y + canopy, p.y);
                var col = Color.Lerp(baseCol * 0.75f, Color.Lerp(baseCol, greens[3], 0.4f) * 1.1f, lift);
                col.a = Mathf.Lerp(0.55f, 1f, lift);
                leaves.C = col;
                leaves.Blob(p, new Vector3(s, s * 0.85f, s), 0.18f, rng.Next(), 2, false);
            }
            Emit("trunk", trunk, Mats.VertexLit, true, go);
            Emit("leaves", leaves, Mats.VertexWind, true, go);
            if (occludes)
                Occluders.Add(new Occluder { minX = x - canopy - 1, maxX = x + canopy + 1, northZ = z - canopy * 0.6f, southZ = z + canopy * 0.6f, reach = canopy * 1.8f + 1, renderers = go.GetComponentsInChildren<Renderer>() });
        }

        // ------------------------------------------------------------------ cars

        void Cars(Car[] cars, List<(float x, float z, uint c, float rot)> extra)
        {
            var body = new MeshKit();
            var matte = new MeshKit();
            void One(float x, float z, uint color, float rotY)
            {
                var m = Matrix4x4.TRS(U(x, z), Quaternion.Euler(0, rotY, 0), Vector3.one);
                body.M = m; matte.M = m;
                body.Tint(color).RoundBox(new Vector3(0, 0.62f, 0), new Vector3(1.8f, 0.72f, 4.1f), 0.28f);
                body.Tint(0x27303c).RoundBox(new Vector3(0, 1.22f, -0.2f), new Vector3(1.56f, 0.6f, 2.1f), 0.22f);
                body.Tint(0xfff6d8).Sphere(new Vector3(0.6f, 0.68f, 2.03f), 0.13f, 8, 6);
                body.Tint(0xfff6d8).Sphere(new Vector3(-0.6f, 0.68f, 2.03f), 0.13f, 8, 6);
                body.Tint(0xd62828).Box(new Vector3(0.62f, 0.72f, -2.04f), new Vector3(0.32f, 0.12f, 0.04f));
                body.Tint(0xd62828).Box(new Vector3(-0.62f, 0.72f, -2.04f), new Vector3(0.32f, 0.12f, 0.04f));
                matte.Tint(0x1d1f23);
                foreach (var (wx, wz) in new[] { (0.82f, 1.3f), (-0.82f, 1.3f), (0.82f, -1.3f), (-0.82f, -1.3f) })
                {
                    matte.Cylinder(new Vector3(wx - 0.12f * Mathf.Sign(wx), 0.34f, wz), new Vector3(wx + 0.12f * Mathf.Sign(wx), 0.34f, wz), 0.34f, 0.34f, 14);
                    matte.Tint(0xc9ced6).Cylinder(new Vector3(wx + 0.11f * Mathf.Sign(wx), 0.34f, wz), new Vector3(wx + 0.13f * Mathf.Sign(wx), 0.34f, wz), 0.18f, 0.18f, 10);
                    matte.Tint(0x1d1f23);
                }
            }
            if (cars != null) foreach (var c in cars) One(c.box.x, c.box.z, c.color, 0);
            if (extra != null) foreach (var e in extra) One(e.x, e.z, e.c, e.rot);
            body.M = matte.M = Matrix4x4.identity;
            Emit("cars", body, Mats.VertexGlossy);
            Emit("wheels", matte, Mats.VertexLit);
        }

        // ------------------------------------------------------------------ railings and bunting

        void SchoolFence()
        {
            var k = new MeshKit();
            var B = School.BOUNDS;
            const float H = 1.35f;
            k.Tint(0x2f5d3a);
            void Run(Vector3 a, Vector3 b)
            {
                float len = Vector3.Distance(a, b);
                foreach (var y in new[] { 0.12f, H - 0.12f, H * 0.5f })
                    k.Box((a + b) / 2 + Vector3.up * y, new Vector3(Mathf.Abs(b.x - a.x) + 0.06f, 0.05f, Mathf.Abs(b.z - a.z) + 0.06f));
                int bars = Mathf.RoundToInt(len / 0.16f);
                for (int i = 0; i <= bars; i++)
                {
                    var p = Vector3.Lerp(a, b, i / (float)bars);
                    if (i % 12 == 0) k.Box(p + Vector3.up * (H + 0.08f) / 2, new Vector3(0.1f, H + 0.08f, 0.1f));
                    else k.Box(p + Vector3.up * H / 2, new Vector3(0.025f, H, 0.025f));
                }
            }
            Run(U(B.minX, B.minZ), U(B.maxX, B.minZ));
            Run(U(B.minX, B.maxZ), U(B.maxX, B.maxZ));
            Run(U(B.minX, B.minZ), U(B.minX, B.maxZ));
            Run(U(B.maxX, B.minZ), U(B.maxX, B.maxZ));
            // Brick gate pillars at the corners.
            foreach (var (x, z) in new[] { (B.minX, B.minZ), (B.maxX, B.minZ), (B.minX, B.maxZ), (B.maxX, B.maxZ) })
            {
                k.Tint(0xa3583a).Box(U(x, z, 0.9f), new Vector3(0.6f, 1.8f, 0.6f));
                k.Tint(0xf1ebe0).Box(U(x, z, 1.85f), new Vector3(0.75f, 0.12f, 0.75f));
                k.Tint(0xf1ebe0).Sphere(U(x, z, 2.05f), 0.22f, 10, 8);
            }
            Emit("railings", k, Mats.VertexGlossy);
        }

        void Bunting()
        {
            var k = new MeshKit();
            var lines = new (Vector3 a, Vector3 b)[]
            {
                (U(10, -31, 4.4f), U(2, -12, 4.7f)),
                (U(-19, -22, 3.15f), U(-9.5f, -12.5f, 4.6f)),
                (U(-0.5f, -3.5f, 3.3f), U(2, 2, 4.7f)),
                (U(-27, -22, 3.15f), U(-20, -31, 4.4f)),
                (U(-1, 29, 3.0f), U(-19, 27, 4.4f)),
                (U(-35, 6, 3.15f), U(-19, 27, 4.4f)),
                (U(-19, 6, 3.15f), U(-0.5f, 5f, 3.5f)),
            };
            uint[] cols = { 0xff6b6b, 0xffd166, 0x06d6a0, 0x4dabf7, 0xf78fb3, 0xffa94d, 0xb197fc };
            int ci = 0;
            foreach (var (a, b) in lines)
            {
                float len = Vector3.Distance(a, b);
                int n = Mathf.Max(4, Mathf.RoundToInt(len / 0.55f));
                Vector3 Pt(float t) => Vector3.Lerp(a, b, t) + Vector3.down * Mathf.Sin(t * Mathf.PI) * len * 0.07f;
                k.Tint(0xf5f5f5);
                for (int i = 0; i < n; i++) k.Cylinder(Pt(i / (float)n), Pt((i + 1) / (float)n), 0.015f, 0.015f, 4, false, false);
                for (int i = 0; i < n; i++)
                {
                    float t0 = (i + 0.15f) / n, t1 = (i + 0.85f) / n;
                    var p0 = Pt(t0); var p1 = Pt(t1);
                    var mid = (p0 + p1) / 2 + Vector3.down * 0.42f;
                    k.Tint(cols[ci++ % cols.Length]);
                    k.Triangle(p0, p1, mid);
                }
                // Attach: a short pole where a line ends in mid-air.
                k.Tint(0xdddddd);
            }
            Emit("bunting", k, Mats.VertexFlutter, true);
        }

        // ------------------------------------------------------------------ the streets around

        void Neighbourhood()
        {
            var brick = new MeshKit();
            var paint = new MeshKit();
            var roofs = new MeshKit();
            var glass = new MeshKit();
            var hedge = new MeshKit();
            uint[] brickTints = { 0xffffff, 0xf2d6c4, 0xe9c4a8, 0xd9b9a5 };
            uint[] painted = { 0xf3e9d2, 0xdfe9f2, 0xf2dfe3, 0xe1efdc, 0xfaf3c8, 0xffffff };
            uint[] doors = { 0x2f5fc0, 0xd62828, 0x2f9e44, 0xf2c230, 0x222428, 0x7048e8, 0x1098ad };
            uint[] slate = { 0x5a6170, 0x6b7280, 0x4e5563 };

            void House(float x, float z, float rotY)
            {
                float h = R(5.6f, 6.6f);
                var m = Matrix4x4.TRS(U(x, z), Quaternion.Euler(0, rotY, 0), Vector3.one);
                bool isBrick = rng.NextDouble() < 0.6;
                var wall = isBrick ? brick : paint;
                wall.M = m; roofs.M = m; glass.M = m; paint.M = m; hedge.M = m;
                wall.C = isBrick ? MeshKit.Hex(Pick(brickTints)) : MeshKit.Hex(Pick(painted));
                // Local frame: front faces -z (toward the street), house is 6 wide (x) and 10 deep (z).
                wall.Box(new Vector3(0, h / 2, 0), new Vector3(6, h, 10), isBrick ? 2 : 0);
                // Bay window.
                wall.Box(new Vector3(-1.2f, 1.4f, -5.4f), new Vector3(2.6f, 2.8f, 0.8f), isBrick ? 2 : 0);
                glass.Tint(0x3f6487).Box(new Vector3(-1.2f, 1.5f, -5.81f), new Vector3(2.0f, 1.5f, 0.02f));
                paint.Tint(0xf6f6f2).Box(new Vector3(-1.2f, 2.85f, -5.45f), new Vector3(2.8f, 0.15f, 0.95f));
                // Upstairs windows and the door.
                foreach (float wx in new[] { -1.4f, 1.5f })
                {
                    paint.Tint(0xf6f6f2).Box(new Vector3(wx, 4.0f, -5.02f), new Vector3(1.3f, 1.5f, 0.06f));
                    glass.Tint(0x3f6487).Box(new Vector3(wx, 4.0f, -5.06f), new Vector3(1.1f, 1.3f, 0.02f));
                }
                paint.Tint(Pick(doors)).Box(new Vector3(1.6f, 1.15f, -5.03f), new Vector3(1.0f, 2.2f, 0.06f));
                paint.Tint(0xf6f6f2).Box(new Vector3(1.6f, 2.4f, -5.05f), new Vector3(1.2f, 0.25f, 0.08f));
                // Slate roof with the ridge running along the terrace, and a chimney stack.
                roofs.C = MeshKit.Hex(Pick(slate));
                float o = 0.35f, rh = 2.4f;
                var uv = new Vector2(10.7f / 1.6f, 3.4f / 1.6f);
                roofs.Quad(new Vector3(-3 - o, h, -5 - o), new Vector3(-3 - o, h, 5 + o), new Vector3(0, h + rh, 5 + o), new Vector3(0, h + rh, -5 - o), uv, true);
                roofs.Quad(new Vector3(3 + o, h, 5 + o), new Vector3(3 + o, h, -5 - o), new Vector3(0, h + rh, -5 - o), new Vector3(0, h + rh, 5 + o), uv, true);
                wall.Box(new Vector3(3, h + rh * 0.7f, 2), new Vector3(0.5f, 1.8f, 1.2f), isBrick ? 2 : 0);
                paint.Tint(0xc4683f).Cylinder(new Vector3(3, h + rh * 0.7f + 0.9f, 1.7f), new Vector3(3, h + rh * 0.7f + 1.3f, 1.7f), 0.12f, 0.1f, 6);
                paint.Tint(0xc4683f).Cylinder(new Vector3(3, h + rh * 0.7f + 0.9f, 2.3f), new Vector3(3, h + rh * 0.7f + 1.25f, 2.3f), 0.12f, 0.1f, 6);
                // Front garden: a low wall and a clipped hedge.
                paint.Tint(0xb4704a).Box(new Vector3(0, 0.35f, -7.6f), new Vector3(6, 0.7f, 0.3f));
                hedge.C = Color.Lerp(MeshKit.Hex(0x2f7f35), MeshKit.Hex(0x57b04a), (float)rng.NextDouble());
                hedge.Blob(new Vector3(-1.5f, 0.6f, -7.0f), new Vector3(1.4f, 0.55f, 0.5f), 0.12f, rng.Next(), 1, false);
            }

            for (float t = -68; t <= 68; t += 6.2f)
            {
                // Fronts face the street: local -z turned toward the school.
                House(-62, t, -90);
                House(62, t, 90);
                if (Mathf.Abs(t) < 46) { House(t, 63, 180); House(t, -62, 0); }
            }
            foreach (var k in new[] { brick, paint, roofs, glass, hedge }) k.M = Matrix4x4.identity;
            Emit("houses-brick", brick, houseBrickMat);
            Emit("houses-paint", paint, Mats.VertexLit);
            Emit("houses-roofs", roofs, tileMat);
            Emit("houses-glass", glass, glassMat, false);
            Emit("houses-hedges", hedge, Mats.VertexWind);

            var cars = new List<(float, float, uint, float)>();
            uint[] carColors = { 0xd94b3d, 0x2b2f38, 0xe6e8eb, 0x3a5fa8, 0x8a8f98, 0x274a36, 0xf2c230 };
            for (float z = -66; z < 70; z += R(6, 11))
            {
                cars.Add((-43.6f, z, Pick(carColors), 0));
                if (rng.NextDouble() < 0.8) cars.Add((43.6f, z + 2, Pick(carColors), 180));
            }
            for (float x = -30; x < 36; x += R(7, 13)) cars.Add((x, 50.4f, Pick(carColors), 90));
            Cars(null, cars);
        }

        void Lamps()
        {
            var k = new MeshKit();
            var glow = new MeshKit();
            void Lamp(float x, float z, float dir)
            {
                var p = U(x, z);
                k.Tint(0x2c3138).Cylinder(p, p + Vector3.up * 5.2f, 0.09f, 0.06f, 8);
                k.Cylinder(p + Vector3.up * 5.1f, p + new Vector3(dir * 1.0f, 5.4f, 0), 0.05f, 0.05f, 6);
                k.Tint(0x2c3138).RoundBox(p + new Vector3(dir * 1.1f, 5.38f, 0), new Vector3(0.6f, 0.16f, 0.3f), 0.06f);
                glow.Tint(0xfff1c4).Box(p + new Vector3(dir * 1.1f, 5.28f, 0), new Vector3(0.45f, 0.04f, 0.2f));
            }
            for (float z = -60; z <= 60; z += 15) { Lamp(-41.2f, z, -1); Lamp(41.2f, z + 7, 1); }
            Emit("lamps", k, Mats.VertexGlossy);
            var lampGlow = Mats.Cached("lampGlow", () => { var m = Mats.Toon(Color.white, 0, 0, 0); m.SetColor("_EmissionColor", new Color(1.2f, 1.0f, 0.7f)); return m; });
            Emit("lampGlow", glow, lampGlow, false);
        }
    }
}
