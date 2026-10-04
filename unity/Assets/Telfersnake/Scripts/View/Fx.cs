using System.Collections.Generic;
using UnityEngine;

namespace Telfer.View
{
    /// <summary>
    /// All the juice: a handful of shared particle systems fed by Emit (sparkles, crumbs that bounce
    /// off the tarmac, dust puffs, confetti) and pooled ground shockwave rings.
    /// </summary>
    public sealed class Fx : MonoBehaviour
    {
        public static Fx I;
        ParticleSystem sparkles, crumbs, puffs, confetti, embers;
        readonly List<(Transform t, Material m, float age, float life, float size, Color c)> rings = new List<(Transform, Material, float, float, float, Color)>();
        readonly Stack<(Transform, Material)> ringPool = new Stack<(Transform, Material)>();
        Mesh quad;

        public void Build()
        {
            I = this;
            sparkles = Make("sparkles", Mats.Glow(Color.white, 1, true, 2.2f), 0, 600, 0.8f, false);
            crumbs = Make("crumbs", Mats.Glow(Color.white, 0, false, 1), 2.2f, 800, 0.9f, true);
            puffs = Make("puffs", Mats.Glow(Color.white, 0, false, 1), -0.05f, 300, 1.2f, false);
            confetti = Make("confetti", Mats.Glow(Color.white, 3, false, 1.2f), 0.6f, 600, 2.5f, true);
            embers = Make("embers", Mats.Glow(new Color(1, 0.6f, 0.2f), 0, true, 3f), -0.4f, 300, 0.9f, false);
            var sz = puffs.sizeOverLifetime; sz.enabled = true; sz.size = new ParticleSystem.MinMaxCurve(1, AnimationCurve.EaseInOut(0, 0.6f, 1, 1.6f));
            var rot = confetti.rotationOverLifetime; rot.enabled = true; rot.z = new ParticleSystem.MinMaxCurve(-6, 6);
            var noise = confetti.noise; noise.enabled = true; noise.strength = 0.6f; noise.frequency = 0.8f;
            quad = QuadMesh();
        }

        ParticleSystem Make(string name, Material mat, float gravity, int max, float life, bool collide)
        {
            var go = new GameObject(name);
            go.transform.SetParent(transform, false);
            var ps = go.AddComponent<ParticleSystem>();
            ps.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            var main = ps.main;
            main.loop = false;
            main.playOnAwake = false;
            main.maxParticles = max;
            main.startLifetime = life;
            main.gravityModifier = gravity;
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            main.startSpeed = 0;
            var em = ps.emission; em.enabled = false;
            var shape = ps.shape; shape.enabled = false;
            var col = ps.colorOverLifetime; col.enabled = true;
            var g = new Gradient();
            g.SetKeys(new[] { new GradientColorKey(Color.white, 0), new GradientColorKey(Color.white, 1) },
                new[] { new GradientAlphaKey(1, 0), new GradientAlphaKey(1, 0.6f), new GradientAlphaKey(0, 1) });
            col.color = g;
            var size = ps.sizeOverLifetime; size.enabled = true;
            size.size = new ParticleSystem.MinMaxCurve(1, AnimationCurve.EaseInOut(0, 1, 1, 0.2f));
            if (collide)
            {
                var c = ps.collision;
                c.enabled = true;
                c.type = ParticleSystemCollisionType.Planes;
                var plane = new GameObject("floor").transform;
                plane.SetParent(go.transform, false);
                c.AddPlane(plane);
                c.bounce = 0.35f;
                c.dampen = 0.4f;
                c.lifetimeLoss = 0;
            }
            var r = go.GetComponent<ParticleSystemRenderer>();
            r.sharedMaterial = mat;
            r.renderMode = ParticleSystemRenderMode.Billboard;
            r.sortingFudge = 0;
            ps.Play();
            return ps;
        }

        static void Spray(ParticleSystem ps, Vector3 pos, Color c, int n, float speed, float size, float up, float spread = 1, float life = -1)
        {
            var e = new ParticleSystem.EmitParams();
            for (int i = 0; i < n; i++)
            {
                var dir = Random.insideUnitSphere * spread;
                dir.y = Mathf.Abs(dir.y) * up + up * 0.5f;
                e.position = pos + Random.insideUnitSphere * 0.15f;
                e.velocity = dir.normalized * speed * Random.Range(0.5f, 1.1f);
                e.startSize = size * Random.Range(0.6f, 1.3f);
                e.startColor = c;
                if (life > 0) e.startLifetime = life * Random.Range(0.7f, 1.2f);
                e.rotation = Random.Range(0, 360);
                ps.Emit(e, 1);
            }
        }

        // ------------------------------------------------------------------ the vocabulary

        public void Munch(Vector3 pos, Color c, bool golden)
        {
            Spray(crumbs, pos + Vector3.up * 0.25f, c, golden ? 14 : 9, 3.2f, 0.16f, 1.2f);
            Spray(sparkles, pos + Vector3.up * 0.3f, golden ? new Color(1, 0.85f, 0.3f) : Color.Lerp(c, Color.white, 0.6f), golden ? 22 : 6, golden ? 4.5f : 2.5f, golden ? 0.5f : 0.3f, 1);
            if (golden) Ring(pos, new Color(1, 0.85f, 0.3f), 3.5f, 0.5f);
        }

        public void Gulp(Vector3 pos, Color c, float size)
        {
            Spray(sparkles, pos + Vector3.up * 0.5f, Color.white, 16, 4, 0.45f, 1);
            Spray(crumbs, pos + Vector3.up * 0.4f, c, 12, 3.5f, 0.22f * size, 1.4f);
            Spray(puffs, pos + Vector3.up * 0.3f, new Color(1, 1, 1, 0.7f), 8, 1.4f, 0.8f * size, 0.4f);
            Ring(pos, Color.white, 2.5f * size, 0.45f);
        }

        public void Dust(Vector3 pos, float size = 1)
        {
            Spray(puffs, pos + Vector3.up * 0.15f, new Color(0.85f, 0.83f, 0.8f, 0.55f), (int)(6 * size), 1.6f, 0.7f * size, 0.3f);
        }

        public void Stars(Vector3 pos, int n = 10)
        {
            Spray(sparkles, pos + Vector3.up * 0.8f, new Color(1, 0.95f, 0.5f), n, 3, 0.5f, 1.2f);
        }

        public void Rubble(Vector3 pos, Color c)
        {
            Spray(crumbs, pos + Vector3.up * 0.3f, c, 18, 4.5f, 0.28f, 1.6f, 1, 1.4f);
            Spray(puffs, pos + Vector3.up * 0.2f, new Color(0.75f, 0.72f, 0.68f, 0.7f), 12, 2.2f, 1.1f, 0.4f);
        }

        public void Confetti(Vector3 pos, int n = 70, float speed = 7)
        {
            Color[] cols = { new Color(1, 0.42f, 0.42f), new Color(1, 0.82f, 0.4f), new Color(0.02f, 0.84f, 0.63f), new Color(0.3f, 0.67f, 0.97f), new Color(0.97f, 0.56f, 0.7f), new Color(0.69f, 0.59f, 0.99f) };
            var e = new ParticleSystem.EmitParams();
            for (int i = 0; i < n; i++)
            {
                var dir = Random.insideUnitSphere;
                dir.y = Mathf.Abs(dir.y) * 2 + 0.8f;
                e.position = pos + Vector3.up * 0.6f;
                e.velocity = dir.normalized * speed * Random.Range(0.4f, 1.1f);
                e.startSize = Random.Range(0.12f, 0.24f);
                e.startColor = cols[Random.Range(0, cols.Length)];
                e.rotation = Random.Range(0, 360);
                e.startLifetime = Random.Range(1.6f, 2.8f);
                confetti.Emit(e, 1);
            }
        }

        public void Trail(Vector3 pos, Color c)
        {
            Spray(sparkles, pos, Color.Lerp(c, Color.white, 0.4f), 1, 0.6f, 0.35f, 0.5f, 1, 0.5f);
        }

        public void Fire(Vector3 pos, Vector3 dir, float range)
        {
            var e = new ParticleSystem.EmitParams();
            for (int i = 0; i < 40; i++)
            {
                var d = Quaternion.Euler(Random.Range(-8, 8), Random.Range(-28, 28), 0) * dir;
                e.position = pos + Vector3.up * 0.4f;
                e.velocity = d * range * Random.Range(1.2f, 2.2f) + Vector3.up * Random.Range(0, 1.2f);
                e.startSize = Random.Range(0.4f, 0.9f);
                e.startColor = Color.Lerp(new Color(1, 0.85f, 0.2f), new Color(1, 0.3f, 0.1f), Random.value);
                e.startLifetime = Random.Range(0.4f, 0.7f);
                embers.Emit(e, 1);
            }
        }

        public void Embers(Vector3 pos)
        {
            Spray(embers, pos + Vector3.up * 0.4f, new Color(1, 0.55f, 0.15f), 14, 2.2f, 0.35f, 1.4f);
            Spray(puffs, pos + Vector3.up * 0.3f, new Color(0.35f, 0.32f, 0.3f, 0.6f), 6, 1.2f, 0.7f, 0.5f);
        }

        /// <summary>Laser Eyes: a hot red beam from the eyes, dead ahead.</summary>
        public void Laser(Vector3 from, Vector3 dir, float range)
        {
            var e = new ParticleSystem.EmitParams();
            for (int i = 0; i < 46; i++)
            {
                float t = i / 45f;
                e.position = from + Vector3.up * 0.2f + dir * range * t + Random.insideUnitSphere * 0.05f;
                e.velocity = Random.insideUnitSphere * 0.3f;
                e.startSize = Mathf.Lerp(0.55f, 0.3f, t);
                e.startColor = Color.Lerp(new Color(1, 0.25f, 0.2f), new Color(1, 0.85f, 0.6f), Random.value * 0.4f);
                e.startLifetime = 0.25f + t * 0.1f;
                sparkles.Emit(e, 1);
            }
            Spray(sparkles, from + dir * range, new Color(1, 0.4f, 0.3f), 12, 3, 0.4f, 1);
        }

        public void Stink(Vector3 pos, float radius)
        {
            Spray(puffs, pos + Vector3.up * 0.4f, new Color(0.55f, 0.75f, 0.25f, 0.65f), 18, radius * 0.8f, 1.3f, 0.6f, 1, 1.6f);
            Spray(puffs, pos + Vector3.up * 0.3f, new Color(0.75f, 0.85f, 0.35f, 0.5f), 10, radius * 0.5f, 0.9f, 0.4f, 1, 1.2f);
        }

        public void Zap(Vector3 pos, float radius)
        {
            Ring(pos, new Color(0.45f, 0.75f, 1f), radius * 1.1f, 0.35f);
            Ring(pos, Color.white, radius * 0.6f, 0.25f);
            var e = new ParticleSystem.EmitParams();
            for (int i = 0; i < 30; i++)
            {
                float a = Random.Range(0, Mathf.PI * 2);
                e.position = pos + new Vector3(Mathf.Cos(a), 0.3f, Mathf.Sin(a)) * radius * Random.Range(0.3f, 1);
                e.velocity = Vector3.up * Random.Range(1, 3);
                e.startSize = Random.Range(0.25f, 0.5f);
                e.startColor = Color.Lerp(new Color(0.5f, 0.8f, 1f), Color.white, Random.value);
                e.startLifetime = Random.Range(0.2f, 0.4f);
                sparkles.Emit(e, 1);
            }
        }

        public void Frost(Vector3 pos, float radius)
        {
            Ring(pos, new Color(0.7f, 0.95f, 1f), radius * 1.6f, 0.5f);
            Spray(sparkles, pos + Vector3.up * 0.6f, new Color(0.75f, 0.95f, 1f), 26, 3, 0.45f, 1.2f);
            Spray(puffs, pos + Vector3.up * 0.3f, new Color(0.85f, 0.95f, 1f, 0.7f), 10, 1.5f, 1, 0.4f);
        }

        public void Hearts(Vector3 pos)
        {
            Spray(sparkles, pos + Vector3.up * 0.8f, new Color(1f, 0.5f, 0.75f), 16, 2.2f, 0.5f, 1.4f);
            Spray(crumbs, pos + Vector3.up * 0.6f, new Color(1f, 0.6f, 0.8f), 10, 2.5f, 0.2f, 1.6f);
        }

        /// <summary>A creature's magic bursting over the snake that caught it.</summary>
        public void Magic(Vector3 pos, Color c)
        {
            Ring(pos, c, 7, 0.9f);
            Ring(pos, Color.white, 4, 0.6f);
            Spray(sparkles, pos + Vector3.up * 0.8f, Color.Lerp(c, Color.white, 0.3f), 60, 5, 0.6f, 1.6f);
            Spray(sparkles, pos + Vector3.up * 0.8f, Color.white, 25, 3, 0.5f, 2);
            Confetti(pos, 50, 6);
        }

        /// <summary>A flat expanding ring on the ground.</summary>
        public void Ring(Vector3 pos, Color c, float size, float life)
        {
            Transform t; Material m;
            if (ringPool.Count > 0) (t, m) = ringPool.Pop();
            else
            {
                var go = new GameObject("ring", typeof(MeshFilter), typeof(MeshRenderer));
                go.transform.SetParent(transform, false);
                go.GetComponent<MeshFilter>().sharedMesh = quad;
                m = Mats.Glow(c, 2, true, 2);
                go.GetComponent<MeshRenderer>().sharedMaterial = m;
                go.GetComponent<MeshRenderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                t = go.transform;
            }
            t.gameObject.SetActive(true);
            t.position = new Vector3(pos.x, 0.06f, pos.z);
            t.rotation = Quaternion.identity;
            rings.Add((t, m, 0, life, size, c));
        }

        static Mesh QuadMesh()
        {
            var m = new Mesh { name = "flat-quad" };
            m.vertices = new[] { new Vector3(-0.5f, 0, -0.5f), new Vector3(-0.5f, 0, 0.5f), new Vector3(0.5f, 0, 0.5f), new Vector3(0.5f, 0, -0.5f) };
            m.uv = new[] { new Vector2(0, 0), new Vector2(0, 1), new Vector2(1, 1), new Vector2(1, 0) };
            m.colors = new[] { Color.white, Color.white, Color.white, Color.white };
            m.triangles = new[] { 0, 1, 2, 0, 2, 3 };
            m.RecalculateNormals();
            return m;
        }

        void Update()
        {
            for (int i = rings.Count - 1; i >= 0; i--)
            {
                var r = rings[i];
                r.age += Time.deltaTime;
                float t = r.age / r.life;
                if (t >= 1)
                {
                    r.t.gameObject.SetActive(false);
                    ringPool.Push((r.t, r.m));
                    rings.RemoveAt(i);
                    continue;
                }
                float s = Mathf.Lerp(0.2f, r.size * 2, Ease.OutCubic(t));
                r.t.localScale = new Vector3(s, 1, s);
                var c = r.c; c.a = (1 - t) * (1 - t);
                r.m.SetColor("_Color", c);
                rings[i] = r;
            }
        }
    }
}
