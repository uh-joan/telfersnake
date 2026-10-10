using System.Collections.Generic;
using Telfer.Sim;
using UnityEngine;
using UnityEngine.Rendering;

namespace Telfer.View
{
    /// <summary>Food, animals, rocks, pellets and Mr Cooper on screen, kept in step with the sim.</summary>
    public sealed class Views
    {
        readonly World world;
        readonly Transform root;
        readonly Material foodMat, goldMat, pelletMat, haloMat, auraMat;
        readonly MaterialPropertyBlock mpb = new MaterialPropertyBlock();

        sealed class FoodV { public Transform t; public MeshFilter mf; public MeshRenderer mr; public int born = int.MinValue; public FoodKind kind; public bool golden; public Transform halo; public float sparkle; }
        sealed class AnimalV { public Transform t, body, halo; public Vector3 prev, cur; public int born; public float yaw; public Material haloMat; }
        sealed class HazardV { public Transform t; public int version = -1; public float wobble; }
        sealed class Ghost { public Transform t; public Vector3 from; public SnakeView to; public float age, life; public Vector3 scale; }

        readonly List<FoodV> foods = new List<FoodV>();
        readonly List<AnimalV> animals = new List<AnimalV>();
        readonly List<HazardV> hazards = new List<HazardV>();
        readonly List<(Transform t, MeshRenderer r)> pellets = new List<(Transform, MeshRenderer)>();
        readonly List<Ghost> ghosts = new List<Ghost>();
        readonly Models.Rig cooper;
        readonly Transform aura;
        Vector3 cooperPrev, cooperCur;
        float cooperYaw;

        public Views(World w, Transform parent)
        {
            world = w;
            root = new GameObject("Things").transform;
            root.SetParent(parent, false);
            foodMat = Mats.Cached("food", () => Mats.Toon(Color.white, gloss: 0.7f, smooth: 0.65f, rim: 0.45f));
            goldMat = Mats.Cached("gold", () =>
            {
                var m = Mats.Toon(new Color(1f, 0.82f, 0.32f), gloss: 1.6f, smooth: 0.9f, rim: 0.9f, vertexColor: false);
                m.SetColor("_RimColor", new Color(1, 0.9f, 0.6f));
                m.SetColor("_EmissionColor", new Color(0.55f, 0.36f, 0.05f));
                return m;
            });
            pelletMat = Mats.Cached("pellet", () => Mats.Toon(Color.white, gloss: 1, smooth: 0.8f, rim: 0.6f, vertexColor: false));
            haloMat = RunAssets.Track(Mats.Glow(new Color(1, 0.85f, 0.35f, 0.55f), 0, true, 1.5f));
            auraMat = RunAssets.Track(Mats.Glow(new Color(0.55f, 0.75f, 1f, 0.22f), 2, false, 1));

            foreach (var f in w.Foods) foods.Add(MakeFood());
            foreach (var a in w.Animals) animals.Add(MakeAnimal(a));
            foreach (var h in w.Hazards) hazards.Add(new HazardV());

            cooper = w.Cooper.config.persona == "keeper" ? ModelsWild.Person(root, "keeper") : Models.Cooper(root, w.Cooper.config.persona == "bobby");
            aura = Flat("aura", auraMat, Cooper.AURA * 2.1f);
            cooperPrev = cooperCur = W.P(w.Cooper.x, w.Cooper.z);
        }

        static Mesh flatQuad;
        static Mesh FlatQuad
        {
            get
            {
                if (flatQuad) return flatQuad;
                flatQuad = new Mesh { name = "flat-quad" };
                flatQuad.vertices = new[] { new Vector3(-0.5f, 0, -0.5f), new Vector3(-0.5f, 0, 0.5f), new Vector3(0.5f, 0, 0.5f), new Vector3(0.5f, 0, -0.5f) };
                flatQuad.uv = new[] { new Vector2(0, 0), new Vector2(0, 1), new Vector2(1, 1), new Vector2(1, 0) };
                flatQuad.colors = new[] { Color.white, Color.white, Color.white, Color.white };
                flatQuad.triangles = new[] { 0, 1, 2, 0, 2, 3 };
                return flatQuad;
            }
        }

        Transform Flat(string name, Material m, float size)
        {
            var go = new GameObject(name, typeof(MeshFilter), typeof(MeshRenderer));
            go.transform.SetParent(root, false);
            go.GetComponent<MeshFilter>().sharedMesh = FlatQuad;
            var r = go.GetComponent<MeshRenderer>();
            r.sharedMaterial = m;
            r.shadowCastingMode = ShadowCastingMode.Off;
            go.transform.localScale = new Vector3(size, 1, size);
            return go.transform;
        }

        FoodV MakeFood()
        {
            var go = new GameObject("food", typeof(MeshFilter), typeof(MeshRenderer));
            go.transform.SetParent(root, false);
            var v = new FoodV { t = go.transform, mf = go.GetComponent<MeshFilter>(), mr = go.GetComponent<MeshRenderer>() };
            v.halo = Flat("halo", haloMat, 1.4f);
            v.halo.gameObject.SetActive(false);
            return v;
        }

        AnimalV MakeAnimal(Animal a)
        {
            var t = new GameObject(a.kind.ToString()).transform;
            t.SetParent(root, false);
            var body = new GameObject("body", typeof(MeshFilter), typeof(MeshRenderer)).transform;
            body.SetParent(t, false);
            body.GetComponent<MeshFilter>().sharedMesh = ModelsWild.ForestAnimal(a.kind);
            body.GetComponent<MeshRenderer>().sharedMaterial = Mats.VertexGlossy;
            var hm = RunAssets.Track(Mats.Glow(new Color(0.45f, 1f, 0.45f, 0.5f), 2, true, 1.6f));
            var halo = Flat("halo", hm, a.Spec.radius * 4.2f);
            halo.SetParent(t, false);
            var p = W.P(a.x, a.z);
            return new AnimalV { t = t, body = body, halo = halo, haloMat = hm, prev = p, cur = p, born = a.born, yaw = W.Yaw(a.heading) };
        }

        /// <summary>Remember where everything was, so frames between sim steps can interpolate.</summary>
        public void OnStep()
        {
            for (int i = 0; i < animals.Count; i++)
            {
                var a = world.Animals[i];
                var v = animals[i];
                v.prev = v.cur;
                v.cur = W.P(a.x, a.z);
                if ((v.prev - v.cur).sqrMagnitude > 4) v.prev = v.cur;
            }
            cooperPrev = cooperCur;
            cooperCur = W.P(world.Cooper.x, world.Cooper.z);
        }

        /// <summary>A gulped thing flies into the snake's mouth, shrinking as it goes.</summary>
        public void Swallow(Mesh mesh, Material mat, Vector3 from, float yaw, Vector3 scale, SnakeView to, float life = 0.18f)
        {
            var go = new GameObject("ghost", typeof(MeshFilter), typeof(MeshRenderer));
            go.transform.SetParent(root, false);
            go.GetComponent<MeshFilter>().sharedMesh = mesh;
            go.GetComponent<MeshRenderer>().sharedMaterial = mat;
            go.transform.position = from;
            go.transform.rotation = Quaternion.Euler(0, yaw, 0);
            go.transform.localScale = scale;
            ghosts.Add(new Ghost { t = go.transform, from = from, to = to, life = life, scale = scale });
        }

        public void SwallowFood(GameEvent e, SnakeView to)
        {
            Swallow(ModelsWild.ForestFood(e.food), e.golden ? goldMat : foodMat, W.P(e.x, e.z, 0.1f), 0, Vector3.one, to);
        }

        public void SwallowAnimal(GameEvent e, SnakeView to)
        {
            Swallow(ModelsWild.ForestAnimal(e.animal), Mats.VertexGlossy, W.P(e.x, e.z), 0, Vector3.one, to, 0.28f);
        }

        public void Sync(float alpha, float dt, float time, Snake me)
        {
            int tick = world.Tick;

            // ---- food
            for (int i = 0; i < foods.Count; i++)
            {
                var f = world.Foods[i];
                var v = foods[i];
                if (v.born != f.born || v.kind != f.kind || v.golden != f.golden)
                {
                    v.born = f.born; v.kind = f.kind; v.golden = f.golden;
                    v.mf.sharedMesh = ModelsWild.ForestFood(f.kind);
                    v.mr.sharedMaterial = f.golden ? goldMat : foodMat;
                    v.halo.gameObject.SetActive(f.golden);
                }
                float age = (tick - f.born) / 60f + alpha / 60f;
                float pop = f.born < 0 ? 1 : Mathf.Clamp01(age / 0.45f);
                float s = pop >= 1 ? 1 : Ease.OutBack(pop);
                float bob = Mathf.Sin(time * 2.6f + i * 1.7f) * 0.05f + 0.06f;
                v.t.position = W.P(f.x, f.z, bob);
                v.t.rotation = Quaternion.Euler(0, time * 35 + i * 47, Mathf.Sin(time * 2 + i) * 6);
                float gold = f.golden ? 1.75f : 1.35f;
                v.t.localScale = Vector3.one * s * gold;
                if (f.golden)
                {
                    v.halo.position = W.P(f.x, f.z, 0.04f);
                    float hp = 1.3f + Mathf.Sin(time * 4 + i) * 0.25f;
                    v.halo.localScale = new Vector3(hp, 1, hp);
                    v.sparkle -= dt;
                    if (v.sparkle <= 0) { v.sparkle = Random.Range(0.15f, 0.4f); Fx.I.Trail(v.t.position + Random.insideUnitSphere * 0.35f + Vector3.up * 0.3f, new Color(1, 0.85f, 0.3f)); }
                }
            }

            // ---- animals
            for (int i = 0; i < animals.Count; i++)
            {
                var a = world.Animals[i];
                var v = animals[i];
                var spec = a.Spec;
                var pos = Vector3.Lerp(v.prev, v.cur, alpha);
                float age = (tick - a.born) / 60f;
                float pop = a.born < 0 ? 1 : Mathf.Clamp01(age / 0.5f);
                float sc = pop >= 1 ? 1 : Ease.OutBack(pop);
                v.yaw = Mathf.LerpAngle(v.yaw, W.Yaw(a.heading), 1 - Mathf.Exp(-dt * 10));

                float gait = a.travel * 4.5f;
                float moving = Mathf.Clamp01(a.speed / Mathf.Max(0.1f, spec.walk));
                float lift = 0, rollZ = 0, pitch = 0;
                switch (a.kind)
                {
                    case AnimalKind.Rabbit: lift = Mathf.Abs(Mathf.Sin(gait * 0.7f)) * 0.35f * moving; pitch = -Mathf.Cos(gait * 0.7f) * 12 * moving; break;
                    case AnimalKind.Duck:
                    case AnimalKind.Chicken: rollZ = Mathf.Sin(gait * 1.3f) * 12 * moving; lift = Mathf.Abs(Mathf.Sin(gait * 1.3f)) * 0.05f * moving; break;
                    case AnimalKind.Snail: break;
                    case AnimalKind.Ladybird: lift = Mathf.Abs(Mathf.Sin(gait * 3)) * 0.02f * moving; break;
                    default: lift = Mathf.Abs(Mathf.Sin(gait)) * 0.08f * moving; rollZ = Mathf.Sin(gait) * 3 * moving; break;
                }
                if (a.mode == AnimalMode.Charge) pitch = 12;
                if (a.mode == AnimalMode.Rest && a.kind != AnimalKind.Snail) lift += Mathf.Max(0, Mathf.Sin(time * 2.2f + i)) * 0.02f; // breathing
                float stretch = a.kind == AnimalKind.Snail ? 1 + Mathf.Sin(time * 3 + i) * 0.06f : 1;
                v.t.position = pos;
                v.t.rotation = Quaternion.Euler(0, v.yaw, 0);
                v.body.localPosition = Vector3.up * lift;
                v.body.localRotation = Quaternion.Euler(pitch, 0, rollZ);
                v.body.localScale = new Vector3(sc, sc, sc * stretch);
                if (a.dazed > 0 && Random.value < dt * 6) Fx.I.Stars(pos + Vector3.up * 0.6f, 1);
                if (a.mode == AnimalMode.Charge && Random.value < dt * 12) Fx.I.Dust(pos, 0.5f);

                bool edible = me.alive && me.Tier >= spec.tier;
                v.halo.gameObject.SetActive(edible && pop >= 1);
                if (edible)
                {
                    float near = Mathf.Clamp01(1 - (Vector3.Distance(pos, W.P(me.x, me.z)) - 3) / 12);
                    var c = new Color(0.45f, 1f, 0.45f, (0.18f + 0.35f * near) * (0.75f + 0.25f * Mathf.Sin(time * 5 + i)));
                    v.haloMat.SetColor("_Color", c);
                    v.halo.localPosition = Vector3.up * 0.03f;
                }
            }

            // ---- hazards
            for (int i = 0; i < hazards.Count; i++)
            {
                var h = world.Hazards[i];
                var v = hazards[i];
                if (v.t == null || v.version != h.version)
                {
                    if (v.t == null)
                    {
                        var go = new GameObject("hazard", typeof(MeshFilter), typeof(MeshRenderer));
                        go.transform.SetParent(root, false);
                        go.GetComponent<MeshRenderer>().sharedMaterial = Mats.VertexLit;
                        v.t = go.transform;
                    }
                    v.t.GetComponent<MeshFilter>().sharedMesh = Models.Hazard(h.kind, i + h.version);
                    v.version = h.version;
                    v.wobble = -1; // pop in
                }
                float since = (tick - h.lastHitTick) / 60f;
                float wob = since < 0.5f ? Mathf.Sin(since * 40) * (0.5f - since) * 16 : 0;
                float sc = h.r / (h.kind == HazardKind.Rock ? 0.75f : h.kind == HazardKind.Stones ? 0.55f : 0.6f);
                if (v.wobble < 0)
                {
                    v.wobble = Mathf.Min(0, v.wobble + dt * 2.5f);
                    sc *= Ease.OutBack(1 + v.wobble);
                }
                v.t.position = W.P(h.x, h.z);
                v.t.rotation = Quaternion.Euler(wob, h.turn * Mathf.Rad2Deg, wob * 0.5f);
                v.t.localScale = Vector3.one * sc;
            }

            // ---- pellets (dropped tail segments)
            while (pellets.Count < world.Pellets.Count)
            {
                var go = new GameObject("pellet", typeof(MeshFilter), typeof(MeshRenderer));
                go.transform.SetParent(root, false);
                go.GetComponent<MeshFilter>().sharedMesh = Models.Pellet;
                var r = go.GetComponent<MeshRenderer>();
                r.sharedMaterial = pelletMat;
                r.shadowCastingMode = ShadowCastingMode.Off;
                pellets.Add((go.transform, r));
            }
            for (int i = 0; i < pellets.Count; i++)
            {
                bool on = i < world.Pellets.Count;
                pellets[i].t.gameObject.SetActive(on);
                if (!on) continue;
                var p = world.Pellets[i];
                float age = (tick - p.born) / 60f;
                float left = (Hazards.PELLET_LIFE_TICKS - (tick - p.born)) / 60f;
                float s = Mathf.Clamp01(age / 0.25f) * Mathf.Clamp01(left / 1.5f) * Mathf.Lerp(0.8f, 1.6f, Mathf.Clamp01(p.value / 3));
                if (left < 4 && Mathf.Sin(time * 18) < 0) s *= 0.7f;
                pellets[i].t.position = W.P(p.x, p.z, 0.02f + Mathf.Abs(Mathf.Sin(time * 4 + i)) * 0.08f);
                pellets[i].t.localScale = Vector3.one * s;
                var col = MeshKit.Hex(p.color);
                mpb.SetColor("_BaseColor", col);
                mpb.SetColor("_EmissionColor", col * 0.55f);
                pellets[i].r.SetPropertyBlock(mpb);
            }

            // ---- ghosts flying into mouths
            for (int i = ghosts.Count - 1; i >= 0; i--)
            {
                var g = ghosts[i];
                g.age += dt;
                float t = Mathf.Clamp01(g.age / g.life);
                var target = g.to != null ? g.to.HeadPos : g.from;
                g.t.position = Vector3.Lerp(g.from, target, t * t) + Vector3.up * Mathf.Sin(t * Mathf.PI) * 0.4f;
                g.t.localScale = g.scale * (1 - t * 0.9f);
                g.t.Rotate(0, dt * 720, 0);
                if (t >= 1)
                {
                    Object.Destroy(g.t.gameObject);
                    ghosts.RemoveAt(i);
                }
            }

            // ---- Mr Cooper
            var c2 = world.Cooper;
            var cp = Vector3.Lerp(cooperPrev, cooperCur, alpha);
            cooper.root.position = cp;
            cooperYaw = Mathf.LerpAngle(cooperYaw, W.Yaw(c2.heading), 1 - Mathf.Exp(-dt * 10));
            cooper.root.rotation = Quaternion.Euler(0, cooperYaw, 0);
            float run = c2.speed > 0 ? 1 : 0;
            float ph = c2.travel * 3.2f;
            float swing = Mathf.Sin(ph) * 38 * run;
            cooper.legL.localRotation = Quaternion.Euler(swing, 0, 0);
            cooper.legR.localRotation = Quaternion.Euler(-swing, 0, 0);
            cooper.armL.localRotation = Quaternion.Euler(-swing * 0.8f, 0, 0);
            if (c2.talking > 0)
                cooper.armR.localRotation = Quaternion.Euler(-150 + Mathf.Sin(time * 14) * 15, 0, -10);
            else
                cooper.armR.localRotation = Quaternion.Euler(swing * 0.8f, 0, 0);
            cooper.body.localPosition = Vector3.up * Mathf.Abs(Mathf.Sin(ph)) * 0.08f * run;
            cooper.body.localRotation = Quaternion.Euler(run * 8, 0, 0);
            cooper.head.localRotation = Quaternion.Euler(0, c2.talking > 0 ? Mathf.Sin(time * 3) * 15 : 0, 0);
            aura.position = cp + Vector3.up * 0.05f;
            aura.rotation = Quaternion.Euler(0, time * 20, 0);
            float slowed = me.alive && me.slowed ? 1 : 0;
            auraMat.SetColor("_Color", new Color(0.55f, 0.75f, 1f, 0.16f + slowed * 0.2f));
        }

        public Vector3 CooperHead => cooper.root.position + Vector3.up * 2.2f;
    }
}
