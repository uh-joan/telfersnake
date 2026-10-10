import type { AnimalKind } from '../sim/animals';

interface ToneOptions {
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  /** Frequency to glide to by the end of the note. */
  slideTo?: number;
  /** Wobble, for animal voices: depth in Hz and rate in Hz. */
  vibrato?: [depth: number, rate: number];
}

/** Older iOS Safari only has the prefixed constructor. */
const AudioContextClass: typeof AudioContext | undefined =
  window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

/**
 * Every sound in the game, synthesised with Web Audio: no audio files to download.
 * Must be created from a tap (browsers only let audio start from a user gesture).
 */
export class Sfx {
  /** Throws if this browser has no Web Audio (or blocks it): callers treat that as "play silently". */
  readonly ctx = new (AudioContextClass as typeof AudioContext)();
  /** Everything goes through here, so the music can share the context and the limiter. */
  readonly out: GainNode;
  private readonly fx: GainNode;
  private readonly noise: AudioBuffer;
  private combo = 0;
  private lastEat = 0;

  constructor() {
    // A safety limiter that only bites on peaks, then a makeup gain so the game is properly loud
    // on a phone: without this, everything ran through a hard compressor and came out faint.
    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.12;
    const makeup = this.ctx.createGain();
    makeup.gain.value = 2.4;
    limiter.connect(makeup).connect(this.ctx.destination);
    this.out = this.ctx.createGain();
    this.out.gain.value = 1.4;
    this.out.connect(limiter);
    this.fx = this.ctx.createGain();
    this.fx.connect(this.out);

    // One second of white noise, reused for every whoosh, clack and shaker.
    this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    // iPhones silence Web Audio when the side switch is on "silent" unless we ask for a playback
    // session (iOS 16.4+). No permission prompt — it just lets the game be heard with the ringer off.
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session) {
      try {
        session.type = 'playback';
      } catch {
        // Older or locked-down browser: nothing to do; it plays when the ringer is on.
      }
    }
    this.wake();
    this.unlock();
  }

  /** A single inaudible sample, played from the opening tap, to fully wake iOS audio. */
  private unlock(): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
    src.connect(this.ctx.destination);
    src.start(0);
  }

  set enabled(on: boolean) {
    this.fx.gain.value = on ? 1 : 0;
  }

  /** iOS suspends the context when the tab is backgrounded, and sometimes even at creation. */
  wake(): void {
    if (this.ctx.state !== 'running') void this.ctx.resume();
  }

  tone(freq: number, length: number, o: ToneOptions = {}, to: AudioNode = this.fx): void {
    const t = this.ctx.currentTime + (o.delay ?? 0);
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = o.type ?? 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t + length);
    if (o.vibrato) {
      const lfo = this.ctx.createOscillator();
      const depth = this.ctx.createGain();
      lfo.frequency.value = o.vibrato[1];
      depth.gain.value = o.vibrato[0];
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + length + 0.05);
    }
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(o.gain ?? 0.15, t + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.001, t + length);
    osc.connect(amp).connect(to);
    osc.start(t);
    osc.stop(t + length + 0.05);
  }

  /** A burst of filtered noise: `from`→`to` is the filter sweep in Hz. */
  hiss(length: number, from: number, to: number, gain: number, delay = 0, q = 1, dest: AudioNode = this.fx): void {
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = q;
    filter.frequency.setValueAtTime(from, t);
    filter.frequency.exponentialRampToValueAtTime(to, t + length);
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.03, length / 3));
    amp.gain.exponentialRampToValueAtTime(0.001, t + length);
    src.connect(filter).connect(amp).connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + length + 0.05);
  }

  // ---------------------------------------------------------------- eating

  /** Quick munches climb the scale; pause and it drops back down. */
  eat(): void {
    const now = this.ctx.currentTime;
    this.combo = now - this.lastEat < 1.2 ? Math.min(this.combo + 1, 14) : 0;
    this.lastEat = now;
    // Major pentatonic, so a feeding frenzy sounds like a tune rather than a siren.
    const step = [0, 2, 4, 7, 9][this.combo % 5] + 12 * Math.floor(this.combo / 5);
    const freq = 392 * Math.pow(2, step / 12);
    this.tone(freq, 0.12, { type: 'square', gain: 0.2, slideTo: freq * 1.5 });
    this.tone(freq * 2, 0.06, { type: 'triangle', gain: 0.1 });
    this.hiss(0.05, 2500, 900, 0.06);
  }

  pellet(): void {
    this.tone(700, 0.08, { gain: 0.1, slideTo: 1000 });
  }

  golden(): void {
    [1047, 1319, 1568, 2093].forEach((f, i) => this.tone(f, 0.22, { type: 'sine', gain: 0.12, delay: i * 0.05 }));
  }

  /** A swallowed animal: its voice, then the slide down the throat and a pop. */
  gulp(kind: AnimalKind): void {
    this.voice(kind);
    this.tone(560, 0.18, { type: 'sine', gain: 0.28, slideTo: 130, delay: 0.13 });
    this.tone(200, 0.1, { type: 'square', gain: 0.14, slideTo: 90, delay: 0.16 });
    this.hiss(0.07, 1200, 3200, 0.14, 0.3, 3);
  }

  /** Each animal says its piece. Silly on purpose. */
  voice(kind: AnimalKind): void {
    switch (kind) {
      case 'chicken': // bawk-bawk
        this.tone(620, 0.07, { type: 'sawtooth', gain: 0.1, slideTo: 880 });
        this.tone(700, 0.12, { type: 'sawtooth', gain: 0.1, slideTo: 1100, delay: 0.09 });
        break;
      case 'duck': // quack
        this.tone(430, 0.16, { type: 'square', gain: 0.09, slideTo: 300, vibrato: [40, 38] });
        break;
      case 'sheep': // baa
        this.tone(330, 0.4, { type: 'sawtooth', gain: 0.09, slideTo: 290, vibrato: [22, 9] });
        break;
      case 'goat': // meh
        this.tone(470, 0.32, { type: 'sawtooth', gain: 0.09, slideTo: 420, vibrato: [30, 13] });
        break;
      case 'pig': // oink oink
        this.tone(170, 0.09, { type: 'square', gain: 0.1, slideTo: 120, vibrato: [30, 45] });
        this.tone(190, 0.12, { type: 'square', gain: 0.1, slideTo: 110, vibrato: [30, 45], delay: 0.12 });
        break;
      case 'rabbit': // squeak
        this.tone(1500, 0.09, { type: 'sine', gain: 0.1, slideTo: 2300 });
        break;
      case 'snail': // bloop
        this.tone(260, 0.16, { type: 'sine', gain: 0.14, slideTo: 520 });
        break;
      case 'ladybird': // tick
        this.tone(1900, 0.04, { type: 'square', gain: 0.06 });
        this.tone(2300, 0.04, { type: 'square', gain: 0.06, delay: 0.06 });
        break;
      // ---- London's zoo
      case 'corgi': // yip yip!
        this.tone(900, 0.07, { type: 'square', gain: 0.09, slideTo: 1350 });
        this.tone(950, 0.08, { type: 'square', gain: 0.09, slideTo: 1450, delay: 0.11 });
        break;
      case 'swan': // HONK
        this.tone(250, 0.32, { type: 'sawtooth', gain: 0.14, slideTo: 210, vibrato: [18, 30] });
        this.tone(500, 0.28, { type: 'square', gain: 0.05, slideTo: 420 });
        break;
      case 'gull': // a seaside cry
        this.tone(1250, 0.2, { type: 'sawtooth', gain: 0.07, slideTo: 800 });
        this.tone(1150, 0.24, { type: 'sawtooth', gain: 0.06, slideTo: 760, delay: 0.24 });
        break;
      case 'pelican': // a beak clack
        this.hiss(0.04, 2500, 1800, 0.18, 0, 6);
        this.hiss(0.04, 2300, 1600, 0.16, 0.09, 6);
        break;
      case 'horse': // a whinny
        this.tone(700, 0.45, { type: 'sawtooth', gain: 0.08, slideTo: 420, vibrato: [60, 16] });
        break;
      case 'dino': // a clatter of bones
        for (let i = 0; i < 5; i++) this.hiss(0.05, 3200 - i * 300, 1400, 0.14, i * 0.06, 8);
        this.tone(110, 0.3, { type: 'square', gain: 0.08, slideTo: 70 });
        break;
      case 'pigeon': // the flutter of a whole flock taking off
        for (let i = 0; i < 6; i++) this.hiss(0.08, 900 + i * 120, 500, 0.08, i * 0.05, 2);
        break;
    }
  }

  /** A gull or a pelican made off with a snack: a cheeky snatch. */
  snatch(): void {
    this.hiss(0.12, 1500, 5000, 0.1, 0, 1.5);
    this.tone(880, 0.12, { type: 'square', gain: 0.07, slideTo: 1500, delay: 0.04 });
  }

  /** A cuppa: a quick warm-up whoosh, up the scale. */
  zoom(): void {
    this.tone(520, 0.25, { type: 'triangle', gain: 0.12, slideTo: 1040 });
    this.hiss(0.3, 1200, 4000, 0.06, 0.02, 1);
  }

  /** TEA TIME! A teacup chime and a little fanfare. */
  teaTime(): void {
    [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.24, { type: 'triangle', gain: 0.14, delay: i * 0.1 }));
    [2093, 2637].forEach((f, i) => this.tone(f, 0.5, { type: 'sine', gain: 0.07, delay: 0.45 + i * 0.12, vibrato: [8, 12] }));
  }

  // ---------------------------------------------------------------- bumps

  /** Bounced off something too big to eat: a rubbery spring. */
  boing(): void {
    this.tone(160, 0.4, { type: 'sine', gain: 0.34, slideTo: 620, vibrato: [45, 20] });
    this.tone(320, 0.25, { type: 'triangle', gain: 0.1, slideTo: 900, delay: 0.03 });
  }

  /** Hit a rock: a stony clack and a sad little slide. */
  ouch(): void {
    // A stony crack, a low woody thunk, and a little "aw" slide down.
    this.hiss(0.06, 4500, 1200, 0.35, 0, 3);
    this.tone(90, 0.16, { type: 'square', gain: 0.28, slideTo: 55 });
    this.tone(520, 0.3, { type: 'triangle', gain: 0.16, slideTo: 200, delay: 0.09 });
  }

  bump(): void {
    this.tone(150, 0.16, { type: 'sine', gain: 0.22, slideTo: 60 });
    this.hiss(0.05, 600, 200, 0.1);
  }

  /** A rock, stick or brick breaking apart. */
  crumble(): void {
    this.hiss(0.22, 3500, 500, 0.32, 0, 2);
    this.tone(120, 0.2, { type: 'square', gain: 0.24, slideTo: 60 });
    this.tone(240, 0.14, { type: 'triangle', gain: 0.1, slideTo: 90, delay: 0.05 });
  }

  /** A wolf's warning howl / a predator's snarl on the Common: a low rising growl. */
  growl(): void {
    this.tone(70, 0.4, { type: 'sawtooth', gain: 0.18, slideTo: 150 });
    this.tone(110, 0.32, { type: 'square', gain: 0.08, slideTo: 200, delay: 0.05 });
    this.hiss(0.3, 900, 300, 0.1, 0, 1.5);
  }

  /** A Trafalgar lion waking: a soft, sleepy roar that turns into a big yawn. */
  yawn(): void {
    this.tone(95, 0.55, { type: 'sawtooth', gain: 0.09, slideTo: 140, vibrato: [8, 18] });
    this.tone(330, 0.7, { type: 'triangle', gain: 0.08, slideTo: 160, delay: 0.35 });
    this.hiss(0.6, 700, 250, 0.06, 0.3, 1.2);
  }

  /** A raven's CAW! (twice, hoarse). */
  caw(): void {
    for (const d of [0, 0.22]) {
      this.tone(720, 0.16, { type: 'sawtooth', gain: 0.08, slideTo: 480, vibrato: [60, 70], delay: d });
      this.hiss(0.14, 2200, 1200, 0.07, d, 3);
    }
  }

  /** A London bus's bell: DING DING! */
  dingDing(): void {
    for (const d of [0, 0.2]) {
      this.tone(1568, 0.5, { type: 'sine', gain: 0.12, delay: d });
      this.tone(3136, 0.25, { type: 'sine', gain: 0.04, delay: d });
    }
  }

  /** A horn: a bus's deep parp, or a cab's quick double beep. */
  honk(cab = false): void {
    if (cab) {
      for (const d of [0, 0.16]) this.tone(440, 0.11, { type: 'square', gain: 0.07, delay: d });
      return;
    }
    this.tone(196, 0.45, { type: 'sawtooth', gain: 0.08 });
    this.tone(247, 0.45, { type: 'square', gain: 0.04 });
  }

  /** The Bobby's whistle: PHWEEE! (a shrill pea-whistle trill). */
  whistle(): void {
    this.tone(2700, 0.5, { type: 'sine', gain: 0.07, vibrato: [140, 32], slideTo: 3000 });
    this.hiss(0.4, 3500, 3000, 0.03, 0, 4);
  }

  /** A tourist's camera: a click and a little flash whine. */
  click(): void {
    this.hiss(0.05, 4000, 2500, 0.2, 0, 2);
    this.tone(1800, 0.25, { type: 'sine', gain: 0.04, slideTo: 3600, delay: 0.04 });
  }

  /** The living statue moves: BOO! A low wobble up. */
  boo(): void {
    this.tone(160, 0.35, { type: 'sawtooth', gain: 0.07, slideTo: 320, vibrato: [12, 9] });
  }

  /** A busker's little tune: a bright four-note skip on a plucked string. */
  busk(): void {
    const notes = [392, 494, 587, 494, 659, 587];
    notes.forEach((f, i) => this.tone(f, 0.22, { type: 'triangle', gain: 0.06, delay: i * 0.16 }));
  }

  /** Into a puddle: a splash and a slide. */
  splash(): void {
    this.hiss(0.25, 2500, 700, 0.18, 0, 1.5);
    this.tone(600, 0.25, { type: 'sine', gain: 0.08, slideTo: 1200, delay: 0.05 });
  }

  /** A roll of thunder after a lightning flash: a deep rumble that fades. */
  thunder(): void {
    this.hiss(1.4, 300, 60, 0.28, 0, 0.7);
    this.hiss(0.9, 900, 200, 0.14, 0.06, 1);
    this.tone(48, 1.3, { type: 'sine', gain: 0.3, slideTo: 30 });
    this.tone(70, 0.8, { type: 'triangle', gain: 0.14, slideTo: 40, delay: 0.15 });
  }

  /** The player got bonked by a rival: a comedy tumble downstairs. */
  bonked(): void {
    [440, 370, 311, 262, 196].forEach((f, i) => this.tone(f, 0.16, { type: 'square', gain: 0.09, slideTo: f * 0.8, delay: i * 0.09 }));
    this.hiss(0.5, 2000, 200, 0.12, 0.05);
  }

  /** The player bonked a rival. */
  bonkedRival(): void {
    this.hiss(0.08, 1500, 300, 0.25, 0, 2);
    [784, 1047, 1319].forEach((f, i) => this.tone(f, 0.16, { gain: 0.13, delay: 0.08 + i * 0.07 }));
  }

  /** Back out of the tank. */
  respawn(): void {
    this.tone(260, 0.3, { type: 'sine', gain: 0.16, slideTo: 1040 });
  }

  /** Helmet took the hit. */
  clonk(): void {
    this.tone(1200, 0.08, { type: 'square', gain: 0.09, slideTo: 700 });
    this.tone(300, 0.22, { type: 'sine', gain: 0.2, slideTo: 180, delay: 0.02 });
  }

  // ---------------------------------------------------------------- powers and progress

  /** Dragon Breath puff. */
  whoosh(): void {
    this.hiss(0.45, 300, 2600, 0.3, 0, 0.8);
    this.tone(140, 0.4, { type: 'sawtooth', gain: 0.05, slideTo: 520 });
  }

  /** Dash starting. */
  zip(): void {
    this.hiss(0.2, 800, 4000, 0.12, 0, 1.5);
  }

  tierUp(): void {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.26, { gain: 0.15, delay: i * 0.09 }));
    this.hiss(0.6, 4000, 9000, 0.06, 0.3, 0.5);
  }

  levelUp(): void {
    [659, 784, 988, 1319].forEach((f, i) => this.tone(f, 0.2, { type: 'sine', gain: 0.14, delay: i * 0.06 }));
  }

  /** A card or a button was tapped. */
  pick(): void {
    this.tone(880, 0.1, { gain: 0.15, slideTo: 1320 });
  }

  // ---------------------------------------------------------------- school and shop

  /** The school bell: start of play, and home time. */
  bell(): void {
    for (let ring = 0; ring < 2; ring++) {
      for (const [f, g] of [[1244, 0.1], [1865, 0.05], [2489, 0.03]]) {
        this.tone(f, 0.9, { type: 'sine', gain: g, delay: ring * 0.45, vibrato: [6, 14] });
      }
    }
  }

  /** Bought something in the Tuck Shop. */
  chaChing(): void {
    this.hiss(0.06, 5000, 8000, 0.12, 0, 4);
    [1568, 2093].forEach((f, i) => this.tone(f, 0.3, { type: 'sine', gain: 0.13, delay: 0.05 + i * 0.09 }));
  }

  /** London's Golden Ticket (timed to its splash): the gate beeps, a Tube train whooshes, Big Ben BONGs. */
  goldenTicket(): void {
    [0.55, 0.68].forEach((delay) => this.tone(1760, 0.08, { type: 'square', gain: 0.06, delay }));
    this.hiss(0.7, 400, 3200, 0.22, 1.05, 0.7);
    for (const [f, g] of [[165, 0.24], [330, 0.08], [494, 0.05], [660, 0.03]]) this.tone(f, 2.6, { type: 'sine', gain: g, delay: 1.75 });
  }

  // ---------------------------------------------------------------- London's set pieces (A6)

  /** One soft bell note: a sine with a couple of quiet overtones, ringing on. */
  private bellNote(f: number, delay: number, length: number, gain = 0.1): void {
    this.tone(f, length, { type: 'sine', gain, delay });
    this.tone(f * 2.01, length * 0.6, { type: 'sine', gain: gain * 0.3, delay });
    this.tone(f * 3.02, length * 0.3, { type: 'triangle', gain: gain * 0.12, delay });
  }

  /** The Westminster Quarters (the old public-domain chime): four phrases on soft bells, about 7 s. */
  quarters(): void {
    const E4 = 329.63;
    const FS4 = 369.99;
    const GS4 = 415.3;
    const B3 = 246.94;
    const phrases = [[E4, GS4, FS4, B3], [E4, FS4, GS4, E4], [GS4, E4, FS4, B3], [B3, FS4, GS4, E4]];
    let t = 0;
    for (const notes of phrases) {
      notes.forEach((f, i) => {
        this.bellNote(f, t, 1.8);
        t += i === 3 ? 0.8 : 0.42;
      });
      t += 0.22;
    }
  }

  /** BONG: Big Ben's great hour bell, deep and long. */
  bong(): void {
    for (const [f, g] of [[164.8, 0.26], [82.4, 0.1], [329.6, 0.07], [494, 0.04], [659, 0.025]]) this.tone(f, 3.2, { type: 'sine', gain: g });
    this.hiss(0.08, 1500, 600, 0.06, 0, 2);
  }

  /** Tower Bridge's warning bells: a quick ting-ting run. */
  bridgeBells(): void {
    for (let i = 0; i < 10; i++) this.tone(i % 2 ? 1760 : 1480, 0.25, { type: 'sine', gain: 0.05, delay: i * 0.2 });
  }

  /** The bascules grinding up (or down): a low motor hum. */
  grind(): void {
    this.tone(70, 3.6, { type: 'sawtooth', gain: 0.035, slideTo: 92 });
    this.hiss(3.6, 300, 520, 0.035, 0, 0.6);
  }

  /** The tall ship's horn as it comes under the bridge. */
  shipHorn(): void {
    this.tone(146.8, 1.3, { type: 'sawtooth', gain: 0.05 });
    this.tone(220, 1.3, { type: 'square', gain: 0.02 });
  }

  /** WHEE! down the ramp: a rising slide whistle. */
  whee(): void {
    this.tone(400, 0.6, { type: 'sine', gain: 0.12, slideTo: 1600 });
    this.hiss(0.5, 1000, 4000, 0.08, 0, 1);
  }

  /** A parade drum: rum-tum; `accent` on the first beat of the bar. */
  drum(accent: boolean): void {
    this.tone(accent ? 110 : 150, 0.18, { type: 'sine', gain: accent ? 0.2 : 0.12, slideTo: 60 });
    this.hiss(0.07, 2600, 1200, accent ? 0.1 : 0.06, 0, 1.2);
  }

  /** "Mind the gap!" with no words: beep-boop, then the tunnel's whoosh in and out. */
  mindTheGap(): void {
    this.tone(988, 0.22, { type: 'square', gain: 0.05 });
    this.tone(784, 0.3, { type: 'square', gain: 0.05, delay: 0.24 });
    this.hiss(0.8, 300, 3200, 0.22, 0.5, 0.7);
    this.hiss(0.7, 3200, 400, 0.16, 1.25, 0.7);
  }

  /** Up the London Eye: a slow rising arpeggio of wonder. */
  rideUp(): void {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.6, { type: 'sine', gain: 0.07, delay: i * 0.16 }));
  }

  /** The river bus: toot toot. */
  toot(): void {
    for (const d of [0, 0.3]) this.tone(392, 0.22, { type: 'square', gain: 0.045, delay: d });
  }

  /** A firework: a whistle up, then a crackling bang. `delay` lets a show overlap. */
  firework(delay = 0): void {
    this.tone(900, 0.45, { type: 'sine', gain: 0.025, slideTo: 2600, delay });
    this.hiss(0.7, 3000, 200, 0.22, delay + 0.45, 0.5);
    this.tone(60, 0.5, { type: 'sine', gain: 0.18, slideTo: 30, delay: delay + 0.45 });
  }

  /** The Red Arrows: a jet roar sweeping overhead. */
  jets(): void {
    this.hiss(2.6, 200, 1800, 0.22, 0, 0.5);
    this.hiss(2.4, 1800, 300, 0.18, 1.2, 0.5);
  }

  /** The wobbly bridge: a boing that wobbles. */
  wobble(): void {
    this.tone(300, 0.7, { type: 'sine', gain: 0.1, vibrato: [60, 6] });
  }

  // ---------------------------------------------------------------- London's keepsakes (A7)

  /** A rubber stamp coming down on a passport: THUNK (a low thud, a papery slap). */
  stamp(): void {
    this.tone(120, 0.18, { type: 'sine', gain: 0.32, slideTo: 55 });
    this.tone(260, 0.06, { type: 'square', gain: 0.05, slideTo: 140 });
    this.hiss(0.09, 1800, 500, 0.22, 0, 1.4);
  }

  /** A new postcard for the album: a little rising "ta-daa" on a music box. */
  postcard(): void {
    [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.35, { type: 'sine', gain: 0.07, delay: 0.25 + i * 0.09 }));
  }

  /** The Tiny Big Ben hat's chime: the Quarters' first phrase, small and high. */
  chime(): void {
    [659.3, 830.6, 740, 493.9].forEach((f, i) => this.bellNote(f, i * 0.32, 0.9, 0.035));
  }

  /** Not enough stars yet: soft, never scolding. */
  nope(): void {
    this.tone(220, 0.14, { type: 'sine', gain: 0.12, slideTo: 180 });
  }

  /** Stars counting up on the results screen. */
  star(step: number): void {
    this.tone(880 * Math.pow(2, (step % 8) / 12), 0.09, { type: 'sine', gain: 0.1 });
  }
}
