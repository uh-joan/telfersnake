using System;

namespace Telfer.Sim
{
    /// <summary>Seeded RNG (mulberry32), as in the web game. The sim never touches UnityEngine.Random.</summary>
    public sealed class Rng
    {
        uint s;

        public Rng(uint seed) { s = seed; }

        public float Next()
        {
            unchecked
            {
                s += 0x6d2b79f5;
                uint t = s;
                t = (t ^ (t >> 15)) * (t | 1);
                t ^= t + (t ^ (t >> 7)) * (t | 61);
                t ^= t >> 14;
                return (t >> 8) * (1f / 16777216f); // 24 bits: always < 1
            }
        }

        public float Range(float min, float max) => min + (max - min) * Next();
        public int Int(int n) => (int)(Next() * n);
        public T Pick<T>(T[] items) => items[Int(items.Length)];
    }

    public struct Box
    {
        public float x, z, w, d;
        public Box(float x, float z, float w, float d) { this.x = x; this.z = z; this.w = w; this.d = d; }
        public bool Contains(float px, float pz) => Math.Abs(px - x) <= w / 2 && Math.Abs(pz - z) <= d / 2;
    }

    public struct Circle
    {
        public float x, z, r;
        public Circle(float x, float z, float r) { this.x = x; this.z = z; this.r = r; }
    }

    public struct Bounds2
    {
        public float minX, maxX, minZ, maxZ;
        public Bounds2(float minX, float maxX, float minZ, float maxZ) { this.minX = minX; this.maxX = maxX; this.minZ = minZ; this.maxZ = maxZ; }
    }

    public sealed class Hit
    {
        public float x, z, nx, nz;
        public bool hit;
    }

    /// <summary>What collision needs: the fence and the fixed solids.</summary>
    public interface ITerrain
    {
        Bounds2 Bounds { get; }
        Box[] SolidBoxes { get; }
        Circle[] SolidCircles { get; }
    }

    public static class Collide
    {
        static readonly Circle[] None = new Circle[0];

        /// <summary>Push a circle out of every solid and back inside the fence.</summary>
        public static Hit ResolveCircle(ITerrain t, float px, float pz, float r, Hit o, System.Collections.Generic.IReadOnlyList<Circle> extra = null)
        {
            o.hit = false; o.nx = 0; o.nz = 0;
            float sx = 0, sz = 0;
            var boxes = t.SolidBoxes;
            for (int sweep = 0; sweep < 2; sweep++)
            {
                bool moved = false;
                for (int i = 0; i < boxes.Length; i++)
                {
                    var b = boxes[i];
                    float minX = b.x - b.w / 2, maxX = b.x + b.w / 2, minZ = b.z - b.d / 2, maxZ = b.z + b.d / 2;
                    float cx = Math.Min(Math.Max(px, minX), maxX);
                    float cz = Math.Min(Math.Max(pz, minZ), maxZ);
                    float dx = px - cx, dz = pz - cz;
                    float d2 = dx * dx + dz * dz;
                    if (d2 >= r * r) continue;
                    o.hit = true;
                    if (d2 > 1e-10f)
                    {
                        float d = (float)Math.Sqrt(d2);
                        o.nx = dx / d; o.nz = dz / d;
                        px = cx + o.nx * r; pz = cz + o.nz * r;
                    }
                    else
                    {
                        float toMinX = px - minX, toMaxX = maxX - px, toMinZ = pz - minZ, toMaxZ = maxZ - pz;
                        float m = Math.Min(Math.Min(toMinX, toMaxX), Math.Min(toMinZ, toMaxZ));
                        o.nx = 0; o.nz = 0;
                        if (m == toMinX) { px = minX - r; o.nx = -1; }
                        else if (m == toMaxX) { px = maxX + r; o.nx = 1; }
                        else if (m == toMinZ) { pz = minZ - r; o.nz = -1; }
                        else { pz = maxZ + r; o.nz = 1; }
                    }
                    moved = true;
                    if (sweep == 0) { sx += o.nx; sz += o.nz; }
                }
                if (!moved) break;
            }

            for (int pass = 0; pass < 2; pass++)
            {
                if (pass == 0)
                {
                    var cs = t.SolidCircles;
                    for (int i = 0; i < cs.Length; i++) PushCircle(cs[i], ref px, ref pz, r, o, ref sx, ref sz);
                }
                else if (extra != null)
                {
                    for (int i = 0; i < extra.Count; i++) PushCircle(extra[i], ref px, ref pz, r, o, ref sx, ref sz);
                }
            }

            var B = t.Bounds;
            if (px < B.minX + r) { px = B.minX + r; o.hit = true; o.nx = 1; o.nz = 0; sx += 1; }
            if (px > B.maxX - r) { px = B.maxX - r; o.hit = true; o.nx = -1; o.nz = 0; sx -= 1; }
            if (pz < B.minZ + r) { pz = B.minZ + r; o.hit = true; o.nx = 0; o.nz = 1; sz += 1; }
            if (pz > B.maxZ - r) { pz = B.maxZ - r; o.hit = true; o.nx = 0; o.nz = -1; sz -= 1; }

            float len = (float)Math.Sqrt(sx * sx + sz * sz);
            if (len > 0.1f) { o.nx = sx / len; o.nz = sz / len; }
            o.x = px; o.z = pz;
            return o;
        }

        static void PushCircle(Circle c, ref float px, ref float pz, float r, Hit o, ref float sx, ref float sz)
        {
            float dx = px - c.x, dz = pz - c.z, rr = r + c.r;
            float d2 = dx * dx + dz * dz;
            if (d2 >= rr * rr) return;
            o.hit = true;
            float d = (float)Math.Sqrt(d2);
            o.nx = d > 1e-5f ? dx / d : 1;
            o.nz = d > 1e-5f ? dz / d : 0;
            px = c.x + o.nx * rr; pz = c.z + o.nz * rr;
            sx += o.nx; sz += o.nz;
        }

        public static bool IsFree(ITerrain t, float x, float z, float margin, System.Collections.Generic.IReadOnlyList<Circle> extra = null)
        {
            var B = t.Bounds;
            if (x < B.minX + margin || x > B.maxX - margin) return false;
            if (z < B.minZ + margin || z > B.maxZ - margin) return false;
            foreach (var b in t.SolidBoxes)
                if (Math.Abs(x - b.x) < b.w / 2 + margin && Math.Abs(z - b.z) < b.d / 2 + margin) return false;
            foreach (var c in t.SolidCircles)
            {
                float rr = c.r + margin;
                if ((x - c.x) * (x - c.x) + (z - c.z) * (z - c.z) < rr * rr) return false;
            }
            if (extra != null)
                for (int i = 0; i < extra.Count; i++)
                {
                    var c = extra[i];
                    float rr = c.r + margin;
                    if ((x - c.x) * (x - c.x) + (z - c.z) * (z - c.z) < rr * rr) return false;
                }
            // On a stage with rivers, only dry land is somewhere to stand or spawn.
            if (t is Stage st && st.Water != null && Water.At(st, x, z, Math.Max(0, margin)) != null) return false;
            return true;
        }

        /// <summary>
        /// ResolveCircle for things that walk but never swim (animals, the warden, the wild): a step from
        /// dry land into a river is refused and reported as a bump against the bank, so the walker's own
        /// wall handling turns it round (collide.ts resolveAshore). Without water it is ResolveCircle.
        /// </summary>
        public static Hit ResolveAshore(ITerrain t, float fromX, float fromZ, float px, float pz, float r, Hit o, System.Collections.Generic.IReadOnlyList<Circle> extra = null)
        {
            ResolveCircle(t, px, pz, r, o, extra);
            if (!(t is Stage st) || st.Water == null) return o;
            var w = Water.At(st, o.x, o.z);
            if (w == null || Water.At(st, fromX, fromZ) != null) return o; // already wet: let it climb out
            Water.ShoreNormal(w, fromX, fromZ, out float nx, out float nz);
            o.x = fromX; o.z = fromZ;
            o.hit = true; o.nx = nx; o.nz = nz;
            return o;
        }

        public const float PI = (float)Math.PI;

        public static float WrapAngle(float a)
        {
            while (a > PI) a -= PI * 2;
            while (a < -PI) a += PI * 2;
            return a;
        }

        public static float TurnToward(float from, float to, float maxStep)
        {
            float diff = WrapAngle(to - from);
            return WrapAngle(from + Math.Min(Math.Max(diff, -maxStep), maxStep));
        }

        public static float SlideAlong(float heading, float nx, float nz)
        {
            float dx = (float)Math.Cos(heading), dz = (float)Math.Sin(heading);
            float into = dx * nx + dz * nz;
            if (into >= 0) return heading;
            float tx = dx - into * nx, tz = dz - into * nz;
            if (tx * tx + tz * tz < 1e-8f) return (float)Math.Atan2(nx, -nz);
            return (float)Math.Atan2(tz, tx);
        }

        public static float Hypot(float x, float z) => (float)Math.Sqrt(x * x + z * z);
    }
}
