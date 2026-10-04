using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace Telfer.View
{
    /// <summary>
    /// A whole wood drawn with GPU instancing: a handful of tree shapes (round oaks, tall poplars, dark
    /// pines), each instanced hundreds of times in 20 m chunks so the camera only draws what it sees.
    /// The canopies sway in the shared wind and cast real shadows.
    /// </summary>
    public sealed class TreeField : MonoBehaviour
    {
        const float CHUNK = 20;
        sealed class Variant { public Mesh trunk, leaves; }
        readonly List<Variant> variants = new List<Variant>();
        readonly List<(Mesh mesh, Material mat, Matrix4x4[] m, RenderParams rp)> batches = new List<(Mesh, Material, Matrix4x4[], RenderParams)>();
        readonly Dictionary<(int v, long k), List<Matrix4x4>> pending = new Dictionary<(int, long), List<Matrix4x4>>();

        public void Init(int seed)
        {
            var rng = new System.Random(seed);
            for (int i = 0; i < 4; i++) variants.Add(Oak(rng, i));
            variants.Add(Poplar(rng));
            variants.Add(Pine(rng));
            variants.Add(Pine(rng));
        }

        /// <summary>Queue one tree at a sim position. variant -1 picks one at random (oaks most often).</summary>
        public void Add(float x, float z, float scale, float yaw, int variant, System.Random rng)
        {
            if (variant < 0) { double r = rng.NextDouble(); variant = r < 0.65 ? rng.Next(4) : r < 0.8 ? 4 : 5 + rng.Next(2); }
            long k = ((long)Mathf.FloorToInt(x / CHUNK) << 32) ^ (uint)Mathf.FloorToInt(z / CHUNK);
            if (!pending.TryGetValue((variant, k), out var list)) pending[(variant, k)] = list = new List<Matrix4x4>();
            list.Add(Matrix4x4.TRS(W.P(x, z), Quaternion.Euler(0, yaw, 0), Vector3.one * scale));
        }

        /// <summary>Turn the queued trees into draw batches.</summary>
        public void Commit()
        {
            foreach (var kv in pending)
            {
                var v = variants[kv.Key.v];
                var list = kv.Value;
                var b = new Bounds(list[0].GetPosition(), Vector3.one);
                foreach (var m in list) b.Encapsulate(m.GetPosition());
                b.Expand(new Vector3(10, 22, 10));
                b.center += Vector3.up * 6;
                foreach (var (mesh, mat) in new[] { (v.trunk, Mats.VertexLit), (v.leaves, Mats.VertexWind) })
                {
                    var rp = new RenderParams(mat) { shadowCastingMode = ShadowCastingMode.On, receiveShadows = true, worldBounds = b };
                    for (int i = 0; i < list.Count; i += 500) batches.Add((mesh, mat, list.GetRange(i, Mathf.Min(500, list.Count - i)).ToArray(), rp));
                }
            }
            pending.Clear();
        }

        public int Batches => batches.Count;

        void Update()
        {
            foreach (var (mesh, _, m, rp) in batches) Graphics.RenderMeshInstanced(rp, mesh, 0, m);
        }

        // ------------------------------------------------------------------ tree shapes (canopy ~2 m at scale 1)

        static readonly uint[] Greens = { 0x3f9a3c, 0x57b04a, 0x2f7f35, 0x4c9e3f };

        static Variant Oak(System.Random rng, int i)
        {
            var trunk = new MeshKit();
            float canopy = 1.8f + (float)rng.NextDouble() * 0.6f, h = canopy * 1.05f + 0.8f;
            trunk.Tint(0x6b4a2f).Cylinder(Vector3.zero, Vector3.up * (h + canopy * 0.3f), canopy * 0.15f, canopy * 0.07f, 8);
            trunk.Cylinder(Vector3.up * h * 0.6f, new Vector3(canopy * 0.6f, h + canopy * 0.2f, 0.2f), canopy * 0.07f, canopy * 0.03f, 5);
            for (int r = 0; r < 4; r++)
            {
                float a = r * Mathf.PI / 2 + 0.4f;
                trunk.Cylinder(new Vector3(0, canopy * 0.25f, 0), new Vector3(Mathf.Cos(a) * canopy * 0.35f, 0, Mathf.Sin(a) * canopy * 0.35f), canopy * 0.08f, canopy * 0.02f, 5);
            }
            var leaves = new MeshKit();
            var baseCol = MeshKit.Hex(Greens[i % Greens.Length]);
            var light = MeshKit.Hex(0x7ccf5a);
            var top = Vector3.up * (h + canopy * 0.55f);
            int lumps = 7;
            for (int l = 0; l < lumps; l++)
            {
                float a = (float)rng.NextDouble() * Mathf.PI * 2, r = l == 0 ? 0 : (0.35f + (float)rng.NextDouble() * 0.4f) * canopy;
                var p = top + new Vector3(Mathf.Cos(a) * r, ((float)rng.NextDouble() - 0.45f) * 0.75f * canopy, Mathf.Sin(a) * r);
                float s = canopy * (l == 0 ? 0.85f : 0.45f + (float)rng.NextDouble() * 0.25f);
                float lift = Mathf.InverseLerp(top.y - canopy, top.y + canopy, p.y);
                var c = Color.Lerp(baseCol * 0.72f, Color.Lerp(baseCol, light, 0.4f) * 1.08f, lift);
                c.a = Mathf.Lerp(0.55f, 1, lift);
                leaves.C = c;
                leaves.Blob(p, new Vector3(s, s * 0.85f, s), 0.18f, rng.Next(), 1, false);
            }
            return new Variant { trunk = trunk.ToMesh("oak-trunk"), leaves = leaves.ToMesh("oak-leaves") };
        }

        static Variant Poplar(System.Random rng)
        {
            var trunk = new MeshKit();
            trunk.Tint(0x7a5a3a).Cylinder(Vector3.zero, Vector3.up * 3, 0.22f, 0.1f, 8);
            var leaves = new MeshKit();
            for (int l = 0; l < 5; l++)
            {
                float y = 2.2f + l * 1.3f, s = 1.25f - Mathf.Abs(l - 1.8f) * 0.18f;
                var c = Color.Lerp(MeshKit.Hex(0x3a8a38), MeshKit.Hex(0x86cf5c), l / 5f);
                c.a = Mathf.Lerp(0.6f, 1, l / 4f);
                leaves.C = c;
                leaves.Blob(new Vector3(((float)rng.NextDouble() - 0.5f) * 0.3f, y, 0), new Vector3(s, 1.1f, s), 0.15f, rng.Next(), 1, false);
            }
            return new Variant { trunk = trunk.ToMesh("poplar-trunk"), leaves = leaves.ToMesh("poplar-leaves") };
        }

        static Variant Pine(System.Random rng)
        {
            var trunk = new MeshKit();
            trunk.Tint(0x5c3d26).Cylinder(Vector3.zero, Vector3.up * 2.2f, 0.25f, 0.15f, 8);
            var leaves = new MeshKit();
            for (int l = 0; l < 4; l++)
            {
                float y = 1.6f + l * 1.25f, r = 2.0f - l * 0.42f;
                var c = Color.Lerp(MeshKit.Hex(0x1f5a32), MeshKit.Hex(0x3f8a4a), l / 4f);
                c.a = Mathf.Lerp(0.6f, 1, l / 3f);
                leaves.C = c;
                leaves.Cylinder(Vector3.up * y, Vector3.up * (y + 2.0f), r, 0, 10, true, false);
            }
            return new Variant { trunk = trunk.ToMesh("pine-trunk"), leaves = leaves.ToMesh("pine-leaves") };
        }
    }
}
