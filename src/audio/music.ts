import type { StageId } from '../sim/stage';
import type { Sfx } from './sfx';

/**
 * The Telfersnake theme: an upbeat arcade chiptune, played live by the synth (no audio file).
 * A square-wave lead over a bouncing bass and a shimmer of arpeggios, with drums that kick in
 * as the snake grows. Eight bars, looping.
 */

const BPM = 142;
const STEP = 60 / BPM / 4; // one sixteenth note
const STEPS_PER_BAR = 16;
const LOOKAHEAD = 0.25; // seconds of notes kept queued ahead of the clock
const TICK_MS = 60;

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

// Chord per bar: C · C · F · G · Am · F · G · G — a bright, bouncy loop.
const TRIADS = [
  [48, 52, 55], [48, 52, 55], [53, 57, 60], [55, 59, 62],
  [57, 60, 64], [53, 57, 60], [55, 59, 62], [55, 59, 62],
];
const BASS_ROOT = [36, 36, 41, 43, 45, 41, 43, 43];

// The hook: eight eighth-notes a bar (played on the even sixteenths). null = a rest.
const LEAD: (number | null)[][] = [
  [72, 72, 76, 79, 76, 72, 74, null],
  [72, 74, 76, 79, 81, 79, 76, 74],
  [77, 77, 81, 84, 81, 77, 79, null],
  [79, 79, 83, 86, 83, 79, 74, null],
  [81, 81, 84, 88, 84, 81, 79, 76],
  [77, 81, 84, 81, 77, 74, 77, null],
  [74, 79, 83, 86, 83, 79, 74, 71],
  [79, 74, 71, 74, 79, 83, 86, 88],
];

// London (A7): a jaunty music-hall / brass-band take on two traditional (public-domain) London
// songs: "London Bridge Is Falling Down" (bars 1–4) and, after "Oranges and Lemons", a run of
// church-bell phrases (bars 5–8). Oom-pah bass, a brassy lead, glockenspiel bells and a march snare.
const LONDON_TRIADS = [
  [48, 52, 55], [55, 59, 62], [48, 52, 55], [55, 59, 62],
  [48, 52, 55], [53, 57, 60], [48, 52, 55], [55, 59, 62],
];
const LONDON_BASS = [36, 43, 36, 43, 36, 41, 36, 43];
const LONDON_LEAD: (number | null)[][] = [
  [79, 81, 79, 77, 76, 77, 79, null], // Lon-don Bridge is fall-ing down,
  [74, 76, 77, null, 76, 77, 79, null], // fall-ing down, fall-ing down,
  [79, 81, 79, 77, 76, 77, 79, null], // Lon-don Bridge is fall-ing down,
  [74, null, 79, null, 76, 72, null, null], // my fair la-dy.
  [79, 76, 79, 76, 72, null, 72, 74], // O-ran-ges and le-mons…
  [76, 77, 79, 77, 76, 74, 72, null], // …say the bells…
  [79, 76, 79, 76, 72, 74, 76, 77],
  [79, 77, 76, 74, 72, null, 67, null],
];

export class Music {
  private readonly bus: GainNode;
  private timer = 0;
  private nextTime = 0;
  private step = 0;
  /** Whole times round the loop: London's rarer sounds (the ship's horn) come round every few. */
  private loops = 0;
  private level = 0;
  private on = true;
  private ducked = false;
  /** Which place's arrangement to play: the school's bright chiptune, or the Common's gentler pastoral one. */
  private place: StageId = 'school';

  constructor(private readonly sfx: Sfx) {
    this.bus = sfx.ctx.createGain();
    this.bus.gain.value = 0;
    this.bus.connect(sfx.out);
  }

  /** 0 = lead + bass; each size the snake grows adds a layer (arps, hats, drums, sparkle). */
  setLevel(level: number): void {
    this.level = level;
  }

  /**
   * The Common softens the whole thing to a woodland lilt and adds birdsong; the school stays bright.
   * London gets its own music-hall brass band, with pigeons, a bus bell, gulls and a ship's horn.
   */
  setPlace(place: StageId): void {
    this.place = place;
  }

  set enabled(on: boolean) {
    this.on = on;
    this.applyVolume();
  }

  /** Quieter while a menu is up. */
  duck(ducked: boolean): void {
    this.ducked = ducked;
    this.applyVolume();
  }

  private applyVolume(): void {
    const target = !this.on ? 0 : this.ducked ? 0.35 : 1;
    this.bus.gain.setTargetAtTime(target, this.sfx.ctx.currentTime, 0.15);
  }

  start(): void {
    if (this.timer) return;
    this.nextTime = this.sfx.ctx.currentTime + 0.1;
    this.applyVolume();
    this.timer = window.setInterval(() => this.schedule(), TICK_MS);
  }

  private schedule(): void {
    const ctx = this.sfx.ctx;
    if (ctx.state !== 'running' || document.hidden) {
      this.nextTime = ctx.currentTime + 0.1; // do not build a backlog while the page sleeps
      return;
    }
    if (this.nextTime < ctx.currentTime) this.nextTime = ctx.currentTime + 0.05; // a long hitch: skip, don't catch up
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      if (this.on) this.playStep(this.step, this.nextTime - ctx.currentTime);
      this.nextTime += STEP;
      this.step = (this.step + 1) % (STEPS_PER_BAR * LEAD.length);
      if (this.step === 0) this.loops++;
    }
  }

  private playStep(step: number, delay: number): void {
    if (this.place === 'london') {
      this.playLondon(step, delay);
      return;
    }
    const s = this.sfx;
    const bar = Math.floor(step / STEPS_PER_BAR);
    const i = step % STEPS_PER_BAR; // 0..15
    const to = this.bus;
    const triad = TRIADS[bar];
    const root = BASS_ROOT[bar];
    const common = this.place === 'common';
    // The Common lilts along: a mellow triangle lead, softer drums, and a little birdsong.
    const leadType = common ? 'triangle' : 'square';
    const drumGain = common ? 0.6 : 1;

    // Bass: a driving octave bounce on every eighth (rounder on the Common).
    if (i % 2 === 0) {
      const note = i % 8 === 0 ? root : i % 4 === 0 ? root + 7 : root + (i % 8 === 2 ? 12 : 0);
      s.tone(hz(note), STEP * 1.9, { type: common ? 'triangle' : 'square', gain: common ? 0.15 : 0.18, delay }, to);
    }

    // Lead hook: bright square at school, mellow triangle on the Common.
    if (i % 2 === 0) {
      const note = LEAD[bar][i / 2];
      if (note !== null) {
        s.tone(hz(note), STEP * 1.7, { type: leadType, gain: common ? 0.06 : 0.075, delay, slideTo: hz(note) * 1.005 }, to);
        if (!common) s.tone(hz(note) - 1, STEP * 1.7, { type: 'sawtooth', gain: 0.02, delay }, to); // school: a touch of detune
        // Sparkle: the same note an octave up once the snake is fully grown.
        if (this.level >= 4) s.tone(hz(note + 12), STEP * 1.2, { type: 'triangle', gain: 0.03, delay }, to);
      }
    }

    // Arpeggio shimmer: the chord broken into fast plucks.
    if (this.level >= 1) {
      const note = triad[i % triad.length] + 12;
      s.tone(hz(note), STEP * 0.7, { type: 'triangle', gain: 0.028, delay }, to);
    }

    // Hi-hats on the off-beats.
    if (this.level >= 2 && i % 2 === 1) s.hiss(0.03, 8000, 9000, (i % 4 === 3 ? 0.05 : 0.028) * drumGain, delay, 1, to);

    // Kick on the beats, snare on 2 and 4.
    if (this.level >= 3) {
      if (i === 0 || i === 8) s.tone(140, 0.13, { type: 'sine', gain: 0.32 * drumGain, slideTo: 45, delay }, to);
      if (i === 4 || i === 12) s.hiss(0.1, 2000, 1200, 0.12 * drumGain, delay, 1.1, to);
    }

    // Birdsong & a breath of wind, only out on the Common: a two-note chirp every couple of bars.
    if (common) {
      if (i === 6 && bar % 2 === 0) {
        const c = 88 + (bar % 3) * 2;
        s.tone(hz(c), 0.08, { type: 'triangle', gain: 0.04, delay, slideTo: hz(c + 3) }, to);
        s.tone(hz(c + 4), 0.07, { type: 'triangle', gain: 0.035, delay: delay + 0.1, slideTo: hz(c + 1) }, to);
      }
      if (i === 0) s.hiss(0.6, 500, 200, 0.02, delay, 0.6, to); // a soft wind swell each bar
    }
  }

  /** London's brass band, one sixteenth at a time, with the city humming round it. */
  private playLondon(step: number, delay: number): void {
    const s = this.sfx;
    const bar = Math.floor(step / STEPS_PER_BAR);
    const i = step % STEPS_PER_BAR;
    const to = this.bus;
    const triad = LONDON_TRIADS[bar];
    const root = LONDON_BASS[bar];

    // Oom-pah: the tuba on beats one and three (root, then fifth), the band's "pah" on two and four.
    if (i === 0 || i === 8) {
      const note = i === 0 ? root : root + 7;
      s.tone(hz(note), STEP * 3, { type: 'triangle', gain: 0.2, delay }, to);
      s.tone(hz(note), STEP * 2.5, { type: 'square', gain: 0.04, delay }, to);
    }
    if (i === 4 || i === 12) {
      for (const n of triad) s.tone(hz(n + 12), STEP * 1.2, { type: 'square', gain: 0.022, delay }, to);
    }

    // The tune on a brassy cornet: a sawtooth with a square under it and a little vibrato.
    if (i % 2 === 0) {
      const note = LONDON_LEAD[bar][i / 2];
      if (note !== null) {
        s.tone(hz(note), STEP * 1.8, { type: 'sawtooth', gain: 0.04, delay, vibrato: [3, 6] }, to);
        s.tone(hz(note), STEP * 1.8, { type: 'square', gain: 0.03, delay }, to);
        if (this.level >= 4) s.tone(hz(note + 12), STEP * 1.2, { type: 'triangle', gain: 0.03, delay }, to);
      }
    }

    // Glockenspiel bells: the chord rung high, every eighth.
    if (this.level >= 1 && i % 2 === 1) {
      const note = triad[((i - 1) / 2) % triad.length] + 24;
      s.tone(hz(note), STEP * 1.4, { type: 'sine', gain: 0.022, delay }, to);
    }

    // A march: a tap on the snare's off-beats, then bass drum and snare, and a roll into the top.
    if (this.level >= 2 && i % 4 === 2) s.hiss(0.04, 3000, 2200, 0.035, delay, 1.2, to);
    if (this.level >= 3) {
      if (i === 0 || i === 8) s.tone(110, 0.16, { type: 'sine', gain: 0.26, slideTo: 50, delay }, to);
      if (i === 4 || i === 12) s.hiss(0.1, 2600, 1300, 0.1, delay, 1.1, to);
      if (bar === 7 && i >= 12) s.hiss(0.05, 2800, 2000, 0.05 + (i - 12) * 0.012, delay, 1.2, to);
    }

    // The city: pigeons cooing, a bus's ding-ding up the road, gulls over the river, a ship's horn.
    if (bar % 4 === 1 && i === 10) {
      s.tone(400, 0.22, { type: 'sine', gain: 0.03, delay, slideTo: 340, vibrato: [12, 14] }, to);
      s.tone(380, 0.3, { type: 'sine', gain: 0.028, delay: delay + 0.26, slideTo: 300, vibrato: [12, 14] }, to);
    }
    if (bar === 6 && i === 2 && this.loops % 2 === 0) {
      for (const d of [0, 0.2]) s.tone(1568, 0.4, { type: 'sine', gain: 0.022, delay: delay + d }, to);
    }
    if (bar === 3 && i === 12) {
      s.tone(1250, 0.3, { type: 'sawtooth', gain: 0.01, delay, slideTo: 850, vibrato: [40, 9] }, to);
      s.tone(1150, 0.26, { type: 'sawtooth', gain: 0.008, delay: delay + 0.32, slideTo: 800, vibrato: [40, 9] }, to);
    }
    if (bar === 0 && i === 0 && this.loops % 3 === 2) {
      s.tone(110, 1.4, { type: 'sawtooth', gain: 0.018, delay }, to);
      s.tone(165, 1.4, { type: 'square', gain: 0.008, delay }, to);
    }
  }
}
