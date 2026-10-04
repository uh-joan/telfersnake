using System;
using System.Collections.Generic;
using Telfer.Sim;
using UnityEngine;

namespace Telfer.Audio
{
    /// <summary>
    /// Every sound in the game, synthesised: a port of the web game's Web Audio recipes (sfx.ts and
    /// music.ts), rendered once into AudioClips at start-up. No audio files, and it runs on WebGL.
    /// </summary>
    public sealed class Synth : MonoBehaviour
    {
        public static Synth I;
        const int RATE = 44100;
        enum Wave { Sine, Square, Saw, Triangle }

        readonly Dictionary<string, AudioClip> clips = new Dictionary<string, AudioClip>();
        readonly List<AudioSource> voices = new List<AudioSource>();
        AudioSource[] music;
        int combo, nextVoice;
        float lastEat = -10;
        public bool SfxOn = true, MusicOn = true;
        int musicLevel;
        bool ducked;

        // ------------------------------------------------------------------ rendering

        sealed class Buf
        {
            public readonly float[] d;
            public readonly bool loop;
            public Buf(float seconds, bool loop = false) { d = new float[Mathf.CeilToInt(seconds * RATE)]; this.loop = loop; }
        }

        static float Osc(Wave w, double phase)
        {
            double p = phase - Math.Floor(phase);
            switch (w)
            {
                case Wave.Sine: return (float)Math.Sin(p * Math.PI * 2);
                case Wave.Square: return p < 0.5 ? 0.8f : -0.8f;
                case Wave.Saw: return (float)(p * 2 - 1) * 0.8f;
                default: return (float)(p < 0.5 ? p * 4 - 1 : 3 - p * 4);
            }
        }

        static float Env(double t, double len, float gain)
        {
            const double attack = 0.008;
            if (t < 0 || t > len + 0.04) return 0;
            if (t < attack) return (float)(0.0001 * Math.Pow(gain / 0.0001, t / attack));
            if (t > len) return (float)(0.001 * (1 - (t - len) / 0.04));
            return (float)(gain * Math.Pow(0.001 / gain, (t - attack) / Math.Max(1e-4, len - attack)));
        }

        static void Tone(Buf b, double at, double freq, double len, Wave w = Wave.Triangle, float gain = 0.15f, double slideTo = 0, double vibDepth = 0, double vibRate = 0)
        {
            int start = (int)(at * RATE);
            int n = (int)((len + 0.05) * RATE);
            double phase = 0;
            for (int i = 0; i < n; i++)
            {
                double t = i / (double)RATE;
                double f = slideTo > 0 ? freq * Math.Pow(slideTo / freq, Math.Min(1, t / len)) : freq;
                if (vibDepth > 0) f += vibDepth * Math.Sin(t * vibRate * Math.PI * 2);
                phase += f / RATE;
                int idx = start + i;
                if (b.loop) idx %= b.d.Length; else if (idx >= b.d.Length) break;
                b.d[idx] += Osc(w, phase) * Env(t, len, gain);
            }
        }

        static readonly System.Random noise = new System.Random(3);

        /// <summary>A burst of band-passed noise sweeping from→to Hz.</summary>
        static void Hiss(Buf b, double at, double len, double from, double to, float gain, double q = 1)
        {
            int start = (int)(at * RATE);
            int n = (int)((len + 0.05) * RATE);
            double x1 = 0, x2 = 0, y1 = 0, y2 = 0;
            for (int i = 0; i < n; i++)
            {
                double t = i / (double)RATE;
                double f = from * Math.Pow(to / from, Math.Min(1, t / len));
                double w0 = 2 * Math.PI * Math.Min(f, RATE * 0.45) / RATE;
                double alpha = Math.Sin(w0) / (2 * q);
                double a0 = 1 + alpha;
                double b0 = alpha / a0, b2 = -alpha / a0, a1 = -2 * Math.Cos(w0) / a0, a2 = (1 - alpha) / a0;
                double x = noise.NextDouble() * 2 - 1;
                double y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
                x2 = x1; x1 = x; y2 = y1; y1 = y;
                int idx = start + i;
                if (b.loop) idx %= b.d.Length; else if (idx >= b.d.Length) break;
                double attack = Math.Min(0.03, len / 3);
                float env = t < attack ? (float)(t / attack) * gain : Env(t, len, gain);
                b.d[idx] += (float)y * env * 2.2f;
            }
        }

        AudioClip Clip(string name, Buf b, float master = 1.6f)
        {
            var data = new float[b.d.Length];
            for (int i = 0; i < data.Length; i++)
            {
                float v = b.d[i] * master;
                data[i] = v / (1 + Mathf.Abs(v) * 0.6f); // soft limiter, like the web game's
            }
            var c = AudioClip.Create(name, data.Length, 1, RATE, false);
            c.SetData(data, 0);
            clips[name] = c;
            return c;
        }

        static double Hz(int midi) => 440 * Math.Pow(2, (midi - 69) / 12.0);

        // ------------------------------------------------------------------ the sound set

        public void Build()
        {
            I = this;
            for (int i = 0; i < 12; i++)
            {
                var s = gameObject.AddComponent<AudioSource>();
                s.playOnAwake = false;
                s.spatialBlend = 0;
                voices.Add(s);
            }

            // Eating climbs a major pentatonic as the munches come quickly.
            int[] penta = { 0, 2, 4, 7, 9 };
            for (int c = 0; c < 15; c++)
            {
                var b = new Buf(0.25f);
                int step = penta[c % 5] + 12 * (c / 5);
                double f = 392 * Math.Pow(2, step / 12.0);
                Tone(b, 0, f, 0.12, Wave.Square, 0.2f, f * 1.5);
                Tone(b, 0, f * 2, 0.06, Wave.Triangle, 0.1f);
                Hiss(b, 0, 0.05, 2500, 900, 0.06f);
                Clip("eat" + c, b);
            }
            { var b = new Buf(0.15f); Tone(b, 0, 700, 0.08, Wave.Triangle, 0.1f, 1000); Clip("pellet", b); }
            { var b = new Buf(0.45f); double[] fs = { 1047, 1319, 1568, 2093 }; for (int i = 0; i < 4; i++) Tone(b, i * 0.05, fs[i], 0.22, Wave.Sine, 0.12f); Clip("golden", b); }

            foreach (AnimalKind k in Enum.GetValues(typeof(AnimalKind)))
            {
                var b = new Buf(0.75f);
                Voice(b, k);
                Tone(b, 0.13, 560, 0.18, Wave.Sine, 0.28f, 130);
                Tone(b, 0.16, 200, 0.1, Wave.Square, 0.14f, 90);
                Hiss(b, 0.3, 0.07, 1200, 3200, 0.14f, 3);
                Clip("gulp-" + k, b);
                var v = new Buf(0.5f);
                Voice(v, k);
                Clip("voice-" + k, v);
            }
            { var b = new Buf(0.5f); Tone(b, 0, 160, 0.4, Wave.Sine, 0.34f, 620, 45, 20); Tone(b, 0.03, 320, 0.25, Wave.Triangle, 0.1f, 900); Clip("boing", b); }
            { var b = new Buf(0.5f); Hiss(b, 0, 0.06, 4500, 1200, 0.35f, 3); Tone(b, 0, 90, 0.16, Wave.Square, 0.28f, 55); Tone(b, 0.09, 520, 0.3, Wave.Triangle, 0.16f, 200); Clip("ouch", b); }
            { var b = new Buf(0.25f); Tone(b, 0, 150, 0.16, Wave.Sine, 0.22f, 60); Hiss(b, 0, 0.05, 600, 200, 0.1f); Clip("bump", b); }
            { var b = new Buf(0.35f); Hiss(b, 0, 0.22, 3500, 500, 0.32f, 2); Tone(b, 0, 120, 0.2, Wave.Square, 0.24f, 60); Tone(b, 0.05, 240, 0.14, Wave.Triangle, 0.1f, 90); Clip("crumble", b); }
            { var b = new Buf(0.8f); double[] fs = { 440, 370, 311, 262, 196 }; for (int i = 0; i < 5; i++) Tone(b, i * 0.09, fs[i], 0.16, Wave.Square, 0.09f, fs[i] * 0.8); Hiss(b, 0.05, 0.5, 2000, 200, 0.12f); Clip("bonked", b); }
            { var b = new Buf(0.5f); Hiss(b, 0, 0.08, 1500, 300, 0.25f, 2); double[] fs = { 784, 1047, 1319 }; for (int i = 0; i < 3; i++) Tone(b, 0.08 + i * 0.07, fs[i], 0.16, Wave.Triangle, 0.13f); Clip("bonkedRival", b); }
            { var b = new Buf(0.4f); Tone(b, 0, 260, 0.3, Wave.Sine, 0.16f, 1040); Clip("respawn", b); }
            { var b = new Buf(0.35f); Tone(b, 0, 1200, 0.08, Wave.Square, 0.09f, 700); Tone(b, 0.02, 300, 0.22, Wave.Sine, 0.2f, 180); Clip("clonk", b); }
            { var b = new Buf(0.55f); Hiss(b, 0, 0.45, 300, 2600, 0.3f, 0.8); Tone(b, 0, 140, 0.4, Wave.Saw, 0.05f, 520); Clip("whoosh", b); }
            { var b = new Buf(0.3f); Hiss(b, 0, 0.2, 800, 4000, 0.12f, 1.5); Clip("zip", b); }
            { var b = new Buf(1.1f); double[] fs = { 523, 659, 784, 1047, 1319 }; for (int i = 0; i < 5; i++) Tone(b, i * 0.09, fs[i], 0.26, Wave.Triangle, 0.15f); Hiss(b, 0.3, 0.6, 4000, 9000, 0.06f, 0.5); Clip("tierUp", b); }
            { var b = new Buf(0.5f); double[] fs = { 659, 784, 988, 1319 }; for (int i = 0; i < 4; i++) Tone(b, i * 0.06, fs[i], 0.2, Wave.Sine, 0.14f); Clip("levelUp", b); }
            { var b = new Buf(0.2f); Tone(b, 0, 880, 0.1, Wave.Triangle, 0.15f, 1320); Clip("pick", b); }
            {
                var b = new Buf(1.5f);
                for (int ring = 0; ring < 2; ring++)
                    foreach (var (f, g) in new[] { (1244.0, 0.1f), (1865.0, 0.05f), (2489.0, 0.03f) })
                        Tone(b, ring * 0.45, f, 0.9, Wave.Sine, g, 0, 6, 14);
                Clip("bell", b);
            }

            for (int i = 0; i < 8; i++) { var b = new Buf(0.15f); Tone(b, 0, 880 * Math.Pow(2, i / 12.0), 0.09, Wave.Sine, 0.1f); Clip("star" + i, b); }
            { var b = new Buf(0.5f); Hiss(b, 0, 0.06, 5000, 8000, 0.12f, 4); Tone(b, 0.05, 1568, 0.3, Wave.Sine, 0.13f); Tone(b, 0.14, 2093, 0.3, Wave.Sine, 0.13f); Clip("chaChing", b); }

            { var b = new Buf(0.2f); Tone(b, 0, 220, 0.14, Wave.Sine, 0.12f, 180); Clip("nope", b); }
            { var b = new Buf(0.5f); Tone(b, 0, 70, 0.4, Wave.Saw, 0.18f, 150); Tone(b, 0.05, 110, 0.32, Wave.Square, 0.08f, 200); Hiss(b, 0, 0.3, 900, 300, 0.1f, 1.5); Clip("growl", b); }
            { var b = new Buf(0.45f); Hiss(b, 0, 0.12, 1800, 400, 0.3f, 2); Tone(b, 0, 180, 0.2, Wave.Square, 0.2f, 70); Tone(b, 0.12, 120, 0.2, Wave.Square, 0.14f, 60); Clip("chomp", b); }
            { var b = new Buf(0.35f); Tone(b, 0, 1800, 0.25, Wave.Saw, 0.08f, 600); Tone(b, 0, 2400, 0.2, Wave.Square, 0.05f, 900); Clip("laser", b); }
            { var b = new Buf(0.6f); Hiss(b, 0, 0.5, 400, 150, 0.25f, 0.7); Tone(b, 0, 90, 0.45, Wave.Saw, 0.08f, 60, 8, 12); Clip("stink", b); }
            { var b = new Buf(0.45f); for (int i = 0; i < 6; i++) Tone(b, i * 0.04, 900 + i * 180, 0.06, Wave.Square, 0.07f, 300); Hiss(b, 0, 0.3, 6000, 2000, 0.12f, 2); Clip("zap", b); }
            { var b = new Buf(0.6f); double[] fs = { 2093, 2637, 3136, 2637 }; for (int i = 0; i < 4; i++) Tone(b, i * 0.05, fs[i], 0.3, Wave.Sine, 0.08f); Hiss(b, 0, 0.4, 8000, 4000, 0.06f, 3); Clip("freeze", b); }
            { var b = new Buf(0.4f); Tone(b, 0, 900, 0.08, Wave.Sine, 0.12f, 1400); Tone(b, 0.1, 1200, 0.18, Wave.Sine, 0.1f, 1600); Clip("kiss", b); }
            { var b = new Buf(1.4f); double[] fs = { 523, 659, 784, 1047, 1319, 1568, 2093 }; for (int i = 0; i < fs.Length; i++) Tone(b, i * 0.07, fs[i], 0.5, Wave.Sine, 0.1f, 0, 8, 6); Hiss(b, 0.2, 1.0, 5000, 10000, 0.05f, 0.5); Clip("magic", b); }

            BuildMusic();
        }

        static void Voice(Buf b, AnimalKind k)
        {
            switch (k)
            {
                case AnimalKind.Chicken: Tone(b, 0, 620, 0.07, Wave.Saw, 0.1f, 880); Tone(b, 0.09, 700, 0.12, Wave.Saw, 0.1f, 1100); break;
                case AnimalKind.Duck: Tone(b, 0, 430, 0.16, Wave.Square, 0.09f, 300, 40, 38); break;
                case AnimalKind.Sheep: Tone(b, 0, 330, 0.4, Wave.Saw, 0.09f, 290, 22, 9); break;
                case AnimalKind.Goat: Tone(b, 0, 470, 0.32, Wave.Saw, 0.09f, 420, 30, 13); break;
                case AnimalKind.Pig: Tone(b, 0, 170, 0.09, Wave.Square, 0.1f, 120, 30, 45); Tone(b, 0.12, 190, 0.12, Wave.Square, 0.1f, 110, 30, 45); break;
                case AnimalKind.Rabbit: Tone(b, 0, 1500, 0.09, Wave.Sine, 0.1f, 2300); break;
                case AnimalKind.Snail: Tone(b, 0, 260, 0.16, Wave.Sine, 0.14f, 520); break;
                case AnimalKind.Ladybird: Tone(b, 0, 1900, 0.04, Wave.Square, 0.06f); Tone(b, 0.06, 2300, 0.04, Wave.Square, 0.06f); break;
            }
        }

        // ------------------------------------------------------------------ the theme (music.ts)

        void BuildMusic()
        {
            const double BPM = 142, STEP = 60 / BPM / 4;
            int[][] triads = { new[] { 48, 52, 55 }, new[] { 48, 52, 55 }, new[] { 53, 57, 60 }, new[] { 55, 59, 62 }, new[] { 57, 60, 64 }, new[] { 53, 57, 60 }, new[] { 55, 59, 62 }, new[] { 55, 59, 62 } };
            int[] bassRoot = { 36, 36, 41, 43, 45, 41, 43, 43 };
            int?[][] lead =
            {
                new int?[] { 72, 72, 76, 79, 76, 72, 74, null }, new int?[] { 72, 74, 76, 79, 81, 79, 76, 74 },
                new int?[] { 77, 77, 81, 84, 81, 77, 79, null }, new int?[] { 79, 79, 83, 86, 83, 79, 74, null },
                new int?[] { 81, 81, 84, 88, 84, 81, 79, 76 }, new int?[] { 77, 81, 84, 81, 77, 74, 77, null },
                new int?[] { 74, 79, 83, 86, 83, 79, 74, 71 }, new int?[] { 79, 74, 71, 74, 79, 83, 86, 88 },
            };
            double total = STEP * 128;
            var core = new Buf((float)total, true);
            var arps = new Buf((float)total, true);
            var hats = new Buf((float)total, true);
            var drums = new Buf((float)total, true);
            var sparkle = new Buf((float)total, true);
            for (int step = 0; step < 128; step++)
            {
                int bar = step / 16, i = step % 16;
                double t = step * STEP;
                if (i % 2 == 0)
                {
                    int root = bassRoot[bar];
                    int note = i % 8 == 0 ? root : i % 4 == 0 ? root + 7 : root + (i % 8 == 2 ? 12 : 0);
                    Tone(core, t, Hz(note), STEP * 1.9, Wave.Square, 0.16f);
                    var l = lead[bar][i / 2];
                    if (l.HasValue)
                    {
                        Tone(core, t, Hz(l.Value), STEP * 1.7, Wave.Square, 0.07f, Hz(l.Value) * 1.005);
                        Tone(core, t, Hz(l.Value) - 1, STEP * 1.7, Wave.Saw, 0.02f);
                        Tone(sparkle, t, Hz(l.Value + 12), STEP * 1.2, Wave.Triangle, 0.03f);
                    }
                }
                Tone(arps, t, Hz(triads[bar][i % 3] + 12), STEP * 0.7, Wave.Triangle, 0.028f);
                if (i % 2 == 1) Hiss(hats, t, 0.03, 8000, 9000, i % 4 == 3 ? 0.05f : 0.028f);
                if (i == 0 || i == 8) Tone(drums, t, 140, 0.13, Wave.Sine, 0.32f, 45);
                if (i == 4 || i == 12) Hiss(drums, t, 0.1, 2000, 1200, 0.12f, 1.1);
            }
            var layers = new[] { Clip("m-core", core, 1.3f), Clip("m-arps", arps, 1.3f), Clip("m-hats", hats, 1.3f), Clip("m-drums", drums, 1.3f), Clip("m-sparkle", sparkle, 1.3f) };
            music = new AudioSource[layers.Length];
            for (int i = 0; i < layers.Length; i++)
            {
                var s = gameObject.AddComponent<AudioSource>();
                s.clip = layers[i];
                s.loop = true;
                s.volume = 0;
                s.Play();
                music[i] = s;
            }
        }

        // ------------------------------------------------------------------ playing

        public void Play(string name, float volume = 1, float pitch = 1)
        {
            if (!SfxOn || !clips.TryGetValue(name, out var c)) return;
            var best = voices[nextVoice];
            nextVoice = (nextVoice + 1) % voices.Count;
            best.pitch = pitch;
            best.PlayOneShot(c, volume);
        }

        public void Eat()
        {
            float now = Time.unscaledTime;
            combo = now - lastEat < 1.2f ? Mathf.Min(combo + 1, 14) : 0;
            lastEat = now;
            Play("eat" + combo, 0.9f);
        }

        /// <summary>0 = lead and bass; each size tier adds a layer (arps, hats, drums, sparkle).</summary>
        public void SetMusicLevel(int level) => musicLevel = level;
        public void Duck(bool on) => ducked = on;
        bool commonPlace;
        /// <summary>The Common softens the theme: no hi-hats, gentler drums, more sparkle.</summary>
        public void SetPlace(bool common) => commonPlace = common;

        void Update()
        {
            if (music == null) return;
            float master = MusicOn ? (ducked ? 0.3f : 0.75f) : 0;
            for (int i = 0; i < music.Length; i++)
            {
                float want = i == 0 || musicLevel >= i ? 1 : 0;
                if (commonPlace) want *= i == 2 ? 0.2f : i == 3 ? 0.55f : i == 4 ? 1.4f : 0.85f;
                music[i].volume = Mathf.MoveTowards(music[i].volume, want * master, Time.unscaledDeltaTime * 0.8f);
            }
        }
    }
}
