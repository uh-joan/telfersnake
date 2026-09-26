/**
 * The soundtrack, rendered offline and sample-exact from the game's own synth.
 *
 * The game's Sfx builds its own AudioContext when it is constructed. Here `window.AudioContext`
 * is pointed at an OfflineAudioContext before the sfx module is first loaded, so the real Sfx
 * (limiter, makeup gain and all) and the real Music are built on it, unchanged. Then every note
 * of the theme and every sound the film logged is placed at its exact time, by suspending the
 * offline render at that moment and calling the game's own method, as the game would have.
 */
import type { Music } from '../../src/audio/music';
import type { Sfx } from '../../src/audio/sfx';
import { BEAT } from './beats';
import type { SfxCall } from './director';

/** How the theme is arranged over the film: which place's arrangement, and how many layers. */
export const MUSIC_CUES: { beat: number; place?: 'school' | 'common'; level?: number }[] = [
  { beat: 0, place: 'school', level: 4 }, // the hook: everything, drums and sparkle
  { beat: 4, level: 1 }, // small again in the yard: lead, bass and arps
  { beat: 12, place: 'common', level: 2 }, // out onto the Common: the gentler arrangement, birdsong
  { beat: 20, level: 3 }, // the Common's soft drums as the park opens out
  { beat: 36, level: 2 }, // magic: a lighter bar before the race
  { beat: 40, place: 'school', level: 1 }, // back at school for the race: the bright theme, building up
  { beat: 42, level: 2 }, // a layer for every size, as the game adds them (Music.setLevel on 'tier')
  { beat: 44, level: 3 },
  { beat: 46, level: 4 },
];
/** The theme's last note: the downbeat of bar 17, under the end card's school bell. */
export const MUSIC_END = 68;
/** Designed hits the film adds on top of what the game itself sounds (beats). */
export const HITS: { beat: number; name: string; args?: unknown[] }[] = [
  { beat: 0, name: 'tierUp' }, // the Dragon's fanfare, as the film opens
  { beat: 68, name: 'bell' }, // home time: the game's own end-of-run school bell
];

const SIXTEENTH = BEAT / 4;
/** Music bus gain while the Common's arrangement plays (+5 dB). */
const COMMON_LIFT = 1.8;
const SAMPLE_RATE = 48000;
const QUANTUM = 128 / SAMPLE_RATE;

/** Which offline context the game's Sfx should build on. Swapped in before each render. */
const holder: { ctx: OfflineAudioContext | null } = { ctx: null };
let loaded: Promise<{ Sfx: typeof Sfx; Music: typeof Music }> | null = null;

function load(): Promise<{ Sfx: typeof Sfx; Music: typeof Music }> {
  if (!loaded) {
    // The director page never plays real audio, so this stays in place for good. A constructor
    // that returns an object makes `new` return that object: the Sfx gets the offline context.
    (window as unknown as { AudioContext: unknown }).AudioContext = function OfflineStandIn() {
      return holder.ctx;
    };
    loaded = Promise.all([import('../../src/audio/sfx'), import('../../src/audio/music')]).then(([a, b]) => ({ Sfx: a.Sfx, Music: b.Music }));
  }
  return loaded;
}

interface Due {
  t: number;
  run(ctx: OfflineAudioContext): void;
}

/** Render the film's audio. Returns a 32-bit float stereo WAV, base64 (the game's mix runs hot: no clipping here, the master pass sets the level). */
export async function renderAudio(log: SfxCall[], seconds: number, opts: { from?: number; to?: number } = {}): Promise<string> {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * SAMPLE_RATE), SAMPLE_RATE);
  holder.ctx = ctx;
  const { Sfx, Music } = await load();
  // The Sfx asks a suspended context to resume (right on a phone, meaningless offline): not yet.
  const resume = ctx.resume.bind(ctx);
  ctx.resume = () => Promise.resolve();
  const sfx = new Sfx();
  ctx.resume = resume;
  const music = new Music(sfx);
  // The game fades the music bus in from silence over ~0.15 s when a run starts; the film starts on
  // the downbeat, so the bus is simply open.
  const bus = (music as unknown as { bus: GainNode }).bus;
  bus.gain.value = 1;
  const play = (music as unknown as { playStep(step: number, delay: number): void }).playStep.bind(music);
  const call = sfx as unknown as Record<string, (...a: unknown[]) => void>;

  const due: Due[] = [];
  let place: 'school' | 'common' = 'school';
  let level = 0;
  for (let step = 0; step <= MUSIC_END * 4; step++) {
    const beat = step / 4;
    for (const c of MUSIC_CUES) {
      if (c.beat === beat) {
        place = c.place ?? place;
        level = c.level ?? level;
      }
    }
    const [p, l, t] = [place, level, step * SIXTEENTH];
    due.push({
      t,
      run: (c) => {
        music.setPlace(p);
        music.setLevel(l);
        // Mix automation, not a note changed: the Common's soft triangle arrangement sits ~6 dB under
        // the school's square-wave one, so the film rides its fader up to match.
        bus.gain.setValueAtTime(p === 'common' ? COMMON_LIFT : 1, t);
        play(step % 128, Math.max(0, t - c.currentTime));
      },
    });
  }
  for (const h of HITS) due.push({ t: h.beat * BEAT, run: () => call[h.name](...(h.args ?? [])) });
  for (const e of log) {
    if (typeof call[e.name] !== 'function') continue;
    due.push({ t: e.t, run: () => call[e.name](...e.args) });
  }
  const from = opts.from ?? 0;
  const to = opts.to ?? Infinity;

  // Group by render quantum; the offline render stops at each group and the game makes its sounds.
  const groups = new Map<number, Due[]>();
  for (const d of due) {
    if (d.t < from || d.t > to || d.t >= seconds) continue;
    const k = Math.floor(d.t / QUANTUM + 1e-9);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(d);
  }
  for (const [k, list] of groups) {
    list.sort((a, b) => a.t - b.t);
    if (k === 0) {
      for (const d of list) d.run(ctx);
      continue;
    }
    void ctx.suspend(k * QUANTUM).then(() => {
      for (const d of list) d.run(ctx);
      void ctx.resume();
    });
  }
  return wavBase64(await ctx.startRendering());
}

function wavBase64(b: AudioBuffer): string {
  const ch = b.numberOfChannels;
  const n = b.length;
  const bytes = new ArrayBuffer(44 + n * ch * 4);
  const v = new DataView(bytes);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + n * ch * 4, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 3, true); // IEEE float
  v.setUint16(22, ch, true);
  v.setUint32(24, b.sampleRate, true);
  v.setUint32(28, b.sampleRate * ch * 4, true);
  v.setUint16(32, ch * 4, true);
  v.setUint16(34, 32, true);
  str(36, 'data');
  v.setUint32(40, n * ch * 4, true);
  const data = [...Array(ch).keys()].map((c) => b.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      v.setFloat32(o, data[c][i], true);
      o += 4;
    }
  }
  let bin = '';
  const u8 = new Uint8Array(bytes);
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(bin);
}
