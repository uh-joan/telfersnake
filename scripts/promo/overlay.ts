/**
 * The promo's motion graphics, drawn on two canvases over the game: `behind` (under the snake's
 * foreground pass, so it can slither through the titles) and `front` (over everything).
 * Everything is a pure function of the film clock, except the letters' spring physics, which
 * integrate frame by frame — and the director always draws every frame in order.
 *
 * The look is the game's own: its rounded font stack, sunny yellow, grass green, chunky ink outlines
 * and the start screen's drop shadow, plus a little cut-paper texture.
 */
import type { Format } from './director';
import { BEAT, secondsAt } from './beats';
import { TITLES } from './titles';

export const FONT = `ui-rounded, 'SF Pro Rounded', 'Arial Rounded MT Bold', 'Nunito', system-ui, sans-serif`;
export const INK = '#1d2433';
export const SUN = '#ffd84a';
export const SUN_DEEP = '#c9a21f';
export const GRASS = '#4cbb4a';
export const LEAF = '#8be36a';
export const WHITE = '#ffffff';
export const RED = '#ff6b6b';
export const SKY = '#4dabf7';

// ---------------------------------------------------------------- easing

export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const easeOutBack = (t: number, s = 1.9): number => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2;
export const easeInBack = (t: number, s = 1.7): number => (s + 1) * t ** 3 - s * t ** 2;
export const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;
export const easeInCubic = (t: number): number => t ** 3;
export const easeInOut = (t: number): number => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOutElastic = (t: number): number =>
  t <= 0 ? 0 : t >= 1 ? 1 : 2 ** (-10 * t) * Math.sin(((t * 10 - 0.75) * 2 * Math.PI) / 3) + 1;
export function easeOutBounce(t: number): number {
  const n = 7.5625;
  const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
}
/** A deterministic wobble in [-1, 1]. */
export const wob = (seed: number, t: number): number => Math.sin(t * 13.1 + seed * 7.7) * 0.6 + Math.sin(t * 7.3 + seed * 3.1) * 0.4;

// ---------------------------------------------------------------- the frame each cue sees

export interface Env {
  /** Film seconds and beats. */
  t: number;
  beat: number;
  dt: number;
  /** Layout box, CSS px. */
  W: number;
  H: number;
  portrait: boolean;
  /** The player's head on screen, CSS px. */
  head: { x: number; y: number; visible: boolean };
  /** 0..1, how hard the current beat just hit (1 on the beat, decaying). */
  pulse: number;
  paper: CanvasPattern;
  /** The front layer, for letters that burst out over the snake. */
  front: CanvasRenderingContext2D;
}

export type Layer = 'behind' | 'front';

export interface Cue {
  /** Beats: the cue is drawn from `from` to `to` (inclusive of its own exit animation). */
  from: number;
  to: number;
  layer: Layer;
  draw(g: CanvasRenderingContext2D, e: Env): void;
}

// ---------------------------------------------------------------- the paper

/** A sheet of cut paper: speckles and fibres, tiled over the stickers and plates. */
function makePaper(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  let seed = 99;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  g.fillStyle = 'rgba(128,128,128,1)';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const v = 128 + (rnd() - 0.5) * 60;
    g.fillStyle = `rgba(${v},${v},${v},0.5)`;
    g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  g.lineWidth = 0.6;
  for (let i = 0; i < 90; i++) {
    const v = rnd() < 0.5 ? 170 : 90;
    g.strokeStyle = `rgba(${v},${v},${v},0.35)`;
    g.beginPath();
    const x = rnd() * 256;
    const y = rnd() * 256;
    g.moveTo(x, y);
    g.quadraticCurveTo(x + (rnd() - 0.5) * 20, y + (rnd() - 0.5) * 20, x + (rnd() - 0.5) * 30, y + (rnd() - 0.5) * 30);
    g.stroke();
  }
  return c;
}

// ---------------------------------------------------------------- scratch surface

/**
 * Each sticker/plate/word is drawn on a scratch canvas first, so its paper texture can be laid
 * over exactly its own pixels (source-atop), then stamped onto the layer.
 */
let scratch: HTMLCanvasElement;
let sg: CanvasRenderingContext2D;
let DPR = 1;
function scratchFor(w: number, h: number): CanvasRenderingContext2D {
  const pw = Math.ceil(w * DPR);
  const ph = Math.ceil(h * DPR);
  if (scratch.width < pw || scratch.height < ph) {
    scratch.width = Math.max(scratch.width, pw);
    scratch.height = Math.max(scratch.height, ph);
  }
  sg.setTransform(1, 0, 0, 1, 0, 0);
  sg.clearRect(0, 0, scratch.width, scratch.height);
  sg.setTransform(DPR, 0, 0, DPR, 0, 0);
  return sg;
}
function stamp(g: CanvasRenderingContext2D, paper: CanvasPattern, w: number, h: number, dx: number, dy: number, grain = 0.22): void {
  if (grain > 0) {
    sg.save();
    sg.setTransform(1, 0, 0, 1, 0, 0);
    sg.globalCompositeOperation = 'source-atop';
    sg.globalAlpha = grain;
    sg.fillStyle = paper;
    sg.fillRect(0, 0, w * DPR, h * DPR);
    sg.restore();
  }
  g.drawImage(scratch, 0, 0, Math.ceil(w * DPR), Math.ceil(h * DPR), dx, dy, Math.ceil(w * DPR) / DPR, Math.ceil(h * DPR) / DPR);
}

// ---------------------------------------------------------------- building blocks

const graphemes = (s: string): string[] => [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(s)].map((x) => x.segment);
const isEmoji = (s: string): boolean => /\p{Extended_Pictographic}/u.test(s);

export type Entrance = 'slam' | 'pop' | 'drop' | 'rise' | 'left' | 'right' | 'none';
export type Exit = 'shrink' | 'up' | 'down' | 'left' | 'right' | 'fade' | 'none';

export interface WordOpts {
  /** Beats. */
  at: number;
  out: number;
  /** Centre, as a fraction of the layout box. */
  x: number;
  y: number;
  /** Font size in CSS px (fitted down to `maxW` of the width). */
  size: number;
  maxW?: number;
  fill?: string;
  /** Per-letter fills, cycled. */
  fills?: string[];
  outline?: string;
  rot?: number;
  enter?: Entrance;
  exit?: Exit;
  /** Seconds between letters. */
  stagger?: number;
  layer?: Layer;
  /** Letters spring out of the snake's way as its head passes. */
  knock?: boolean;
  /** Bounce on every beat. */
  bob?: number;
  /** A cut-paper plate behind the word. */
  plate?: string;
  plateRot?: number;
  spacing?: number;
}

interface Letter {
  ch: string;
  w: number;
  ox: number;
  dx: number;
  dy: number;
  vx: number;
  vy: number;
  spin: number;
  vs: number;
  hit: boolean;
  hitAt: number;
  pop: number;
}

/** A word: kinetic letters with the game's outline and shadow. */
export function word(text: string, o: WordOpts): Cue {
  let letters: Letter[] | null = null;
  let size = o.size;
  let total = 0;
  let lastT = -1;
  const stagger = o.stagger ?? 0.035;
  const layer = o.layer ?? 'front';
  const fills = o.fills ?? [o.fill ?? WHITE];
  const outline = o.outline ?? INK;
  const spacing = o.spacing ?? -0.02;
  const enter = o.enter ?? 'slam';
  const exit = o.exit ?? 'shrink';
  const tIn = secondsAt(o.at);
  const tOut = secondsAt(o.out);
  return {
    from: o.at - (enter === 'slam' ? 0 : 0),
    to: o.out + 1,
    layer,
    draw(g, e) {
      const font = (px: number) => `900 ${px}px ${FONT}`;
      if (!letters) {
        g.save();
        g.font = font(o.size);
        const chars = graphemes(text);
        const raw = chars.map((ch) => g.measureText(ch).width);
        const width = raw.reduce((a, b) => a + b, 0) + spacing * o.size * (chars.length - 1);
        const maxW = (o.maxW ?? 0.9) * e.W;
        size = width > maxW ? (o.size * maxW) / width : o.size;
        const k = size / o.size;
        let x = 0;
        letters = chars.map((ch, i) => {
          const l: Letter = { ch, w: raw[i] * k, ox: x, dx: 0, dy: 0, vx: 0, vy: 0, spin: 0, vs: 0, hit: false, hitAt: 0, pop: 0 };
          x += raw[i] * k + spacing * size;
          return l;
        });
        total = x - spacing * size;
        g.restore();
      }
      const cx = o.x * e.W;
      const cy = o.y * e.H;
      const rot = ((o.rot ?? 0) * Math.PI) / 180;
      const dt = lastT < 0 ? e.dt : Math.max(0, e.t - lastT);
      lastT = e.t;

      // Plate first, so the letters sit on it.
      if (o.plate) {
        const pIn = clamp01((e.t - tIn) / 0.22);
        const pOut = clamp01((e.t - tOut) / 0.18);
        const s = easeOutBack(pIn, 2.2) * (1 - easeInBack(pOut));
        if (s > 0.001) {
          const pw = total + size * 0.7;
          const ph = size * 1.25;
          plateShape(g, e, cx, cy + size * 0.02, pw, ph, o.plate, (((o.plateRot ?? -2.5) * Math.PI) / 180) + rot * 0.5, s, 3 + o.at);
        }
      }

      const n = letters.length;
      for (let i = 0; i < n; i++) {
        const L = letters[i];
        const tl = e.t - tIn - i * stagger;
        const to = e.t - tOut - (n - 1 - i) * stagger * 0.3;
        if (tl < 0) continue;
        let sx = 1;
        let alpha = 1;
        let ox = 0;
        let oy = 0;
        let r = 0;
        const p = clamp01(tl / (enter === 'slam' ? 0.22 : 0.3));
        switch (enter) {
          case 'slam':
            sx = lerp(2.8, 1, easeOutBack(p, 1.4));
            alpha = clamp01(p * 3);
            r = (1 - p) * 0.3 * (i % 2 ? 1 : -1);
            break;
          case 'pop':
            sx = easeOutElastic(clamp01(tl / 0.55));
            break;
          case 'drop':
            oy = -(1 - easeOutBounce(clamp01(tl / 0.5))) * e.H * 0.35;
            alpha = clamp01(tl * 8);
            break;
          case 'rise':
            oy = (1 - easeOutBack(p)) * size * 1.2;
            alpha = clamp01(p * 2.5);
            break;
          case 'left':
          case 'right':
            ox = (1 - easeOutBack(p, 1.3)) * e.W * (enter === 'left' ? -1 : 1);
            break;
          case 'none':
            break;
        }
        if (to > 0) {
          const q = clamp01(to / 0.15);
          switch (exit) {
            case 'shrink':
              sx *= 1 - easeInBack(q);
              break;
            case 'up':
              oy -= easeInCubic(q) * e.H * 0.6;
              break;
            case 'down':
              oy += easeInCubic(q) * e.H * 0.6;
              break;
            case 'left':
            case 'right':
              ox += easeInCubic(q) * e.W * 1.2 * (exit === 'left' ? -1 : 1);
              break;
            case 'fade':
              alpha *= 1 - q;
              break;
            case 'none':
              break;
          }
          if (q >= 1) continue;
        }
        if (sx <= 0.001 || alpha <= 0.001) continue;

        // Bob on the beat: each letter hops a little, a touch after its neighbour.
        const bob = (o.bob ?? 0.06) * size;
        const phase = (e.beat - i * 0.06) % 1;
        oy -= bob * Math.exp(-phase * 7) * (phase >= 0 ? 1 : 0) * clamp01(tl / 0.4);

        // Knocked by the snake's head as it bursts through: one kick up and away, then a bouncy
        // spring back home.
        const lx0 = cx + Math.cos(rot) * (L.ox + L.w / 2 - total / 2);
        const ly0 = cy + Math.sin(rot) * (L.ox + L.w / 2 - total / 2);
        if (o.knock && dt > 0) {
          if (!L.hit && e.head.visible && Math.abs(lx0 - e.head.x) < L.w * 0.6 && Math.abs(ly0 - e.head.y) < size * 0.9) {
            L.hit = true;
            L.hitAt = e.t;
            L.vx = (lx0 < e.head.x ? -1 : 1) * 160;
            L.vy = -720;
            L.vs = (i % 2 ? 1 : -1) * 11;
            L.pop = 1;
          }
          L.vx += (-L.dx * 200 - L.vx * 11) * dt;
          L.vy += (-L.dy * 200 - L.vy * 11) * dt;
          L.vs += (-L.spin * 200 - L.vs * 11) * dt;
          L.dx += L.vx * dt;
          L.dy += L.vy * dt;
          L.spin += L.vs * dt;
          L.pop *= Math.exp(-dt * 6);
        }
        sx *= 1 + 0.35 * L.pop;

        // A letter the snake has burst through comes out in front of it, once the head has passed.
        const lg = L.hit && e.t - L.hitAt > 0.35 ? e.front : g;
        lg.save();
        lg.globalAlpha = alpha;
        lg.translate(lx0 + ox + L.dx, ly0 + oy + L.dy);
        lg.rotate(rot + r + L.spin + wob(i + o.at, e.t) * 0.02);
        lg.scale(sx, sx);
        letter(lg, L.ch, size, fills[i % fills.length], outline);
        lg.restore();
      }
    },
  };
}

/** One letter, centred on the origin: shadow, fat ink outline, fill, and a soft highlight. */
function letter(g: CanvasRenderingContext2D, ch: string, size: number, fill: string, outline: string): void {
  g.font = `900 ${size}px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.miterLimit = 2;
  const emoji = isEmoji(ch);
  const y = size * 0.04;
  if (emoji) {
    // Emoji get the sticker treatment: a die-cut white border.
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fillText(ch, 0, y + size * 0.07);
    g.strokeStyle = WHITE;
    g.lineWidth = size * 0.16;
    g.strokeText(ch, 0, y);
    g.fillStyle = '#000';
    g.fillText(ch, 0, y);
    return;
  }
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = size * 0.15;
  g.strokeText(ch, 0, y + size * 0.075);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillText(ch, 0, y + size * 0.075);
  g.strokeStyle = outline;
  g.lineWidth = size * 0.15;
  g.strokeText(ch, 0, y);
  g.fillStyle = fill;
  g.fillText(ch, 0, y);
}

/** A torn-edged sheet of coloured paper with a soft shadow. */
function plateShape(
  g: CanvasRenderingContext2D,
  e: Env,
  cx: number,
  cy: number,
  w: number,
  h: number,
  color: string,
  rot: number,
  scale: number,
  seed: number,
): void {
  const pad = 14;
  const sw = w + pad * 2;
  const sh = h + pad * 2;
  const s = scratchFor(sw, sh);
  // A jagged, hand-cut outline.
  const pts: [number, number][] = [];
  const edge = (x0: number, y0: number, x1: number, y1: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const j = Math.sin((i + 1) * 12.9898 * (seed + 1)) * 43758.5453;
      const jit = (j - Math.floor(j) - 0.5) * 3.2;
      const nx = -(y1 - y0);
      const ny = x1 - x0;
      const nl = Math.hypot(nx, ny) || 1;
      pts.push([lerp(x0, x1, t) + (nx / nl) * jit, lerp(y0, y1, t) + (ny / nl) * jit]);
    }
  };
  const x0 = pad;
  const y0 = pad;
  const x1 = pad + w;
  const y1 = pad + h;
  edge(x0, y0, x1, y0, 18);
  edge(x1, y0, x1, y1, 6);
  edge(x1, y1, x0, y1, 18);
  edge(x0, y1, x0, y0, 6);
  s.beginPath();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  s.fillStyle = color;
  s.fill();
  s.strokeStyle = 'rgba(0,0,0,0.12)';
  s.lineWidth = 1.2;
  s.stroke();
  g.save();
  g.translate(cx, cy);
  g.rotate(rot);
  g.scale(scale, scale);
  g.shadowColor = 'rgba(0,0,0,0.28)';
  g.shadowOffsetY = 5;
  g.shadowBlur = 6;
  stamp(g, e.paper, sw, sh, -sw / 2, -sh / 2, 0.3);
  g.restore();
}

export interface StickerOpts {
  at: number;
  out: number;
  x: number;
  y: number;
  size: number;
  rot?: number;
  enter?: 'pop' | 'slap' | 'spin';
  layer?: Layer;
  /** Gentle float after landing. */
  float?: number;
}

/** An emoji (or a short text) as a die-cut vinyl sticker: thick white border, shadow, paper grain. */
export function sticker(glyph: string, o: StickerOpts): Cue {
  const tIn = secondsAt(o.at);
  const tOut = secondsAt(o.out);
  return {
    from: o.at,
    to: o.out + 1,
    layer: o.layer ?? 'front',
    draw(g, e) {
      const tl = e.t - tIn;
      if (tl < 0) return;
      const q = clamp01((e.t - tOut) / 0.18);
      if (q >= 1) return;
      let s = 1;
      let r = ((o.rot ?? 0) * Math.PI) / 180;
      switch (o.enter ?? 'pop') {
        case 'pop':
          s = easeOutElastic(clamp01(tl / 0.6));
          break;
        case 'slap':
          s = lerp(1.9, 1, easeOutBack(clamp01(tl / 0.18), 2.5));
          break;
        case 'spin':
          s = easeOutBack(clamp01(tl / 0.35));
          r += (1 - easeOutCubic(clamp01(tl / 0.5))) * Math.PI * 1.5;
          break;
      }
      s *= 1 - easeInBack(q);
      s *= 1 + 0.06 * e.pulse;
      const fl = (o.float ?? 1) * wob(o.at, e.t * 0.5);
      const size = o.size;
      const box = size * 1.6;
      const sc = scratchFor(box, box);
      sc.font = `900 ${size}px ${FONT}`;
      sc.textAlign = 'center';
      sc.textBaseline = 'middle';
      sc.lineJoin = 'round';
      sc.strokeStyle = WHITE;
      sc.lineWidth = size * 0.22;
      sc.strokeText(glyph, box / 2, box / 2 + size * 0.05);
      sc.fillStyle = '#000';
      sc.fillText(glyph, box / 2, box / 2 + size * 0.05);
      g.save();
      g.translate(o.x * e.W, o.y * e.H + fl * 4);
      g.rotate(r + fl * 0.05);
      g.scale(s, s);
      g.shadowColor = 'rgba(0,0,0,0.3)';
      g.shadowOffsetY = size * 0.06;
      g.shadowBlur = size * 0.08;
      stamp(g, e.paper, box, box, -box / 2, -box / 2, 0.12);
      g.restore();
    },
  };
}

/** A comic burst of rays behind a hit, spinning slowly. */
export function burst(o: { at: number; out: number; x: number; y: number; r: number; color?: string; color2?: string; rays?: number; layer?: Layer }): Cue {
  const tIn = secondsAt(o.at);
  const tOut = secondsAt(o.out);
  return {
    from: o.at,
    to: o.out + 1,
    layer: o.layer ?? 'behind',
    draw(g, e) {
      const tl = e.t - tIn;
      if (tl < 0) return;
      const q = clamp01((e.t - tOut) / 0.2);
      if (q >= 1) return;
      const s = easeOutBack(clamp01(tl / 0.25), 1.6) * (1 - easeInCubic(q)) * (1 + 0.05 * e.pulse);
      const rays = o.rays ?? 14;
      const R = o.r * Math.min(e.W, e.H) * s;
      g.save();
      g.translate(o.x * e.W, o.y * e.H);
      g.rotate(tl * 0.35);
      for (let i = 0; i < rays; i++) {
        const a0 = (i / rays) * Math.PI * 2;
        const a1 = ((i + 0.5) / rays) * Math.PI * 2;
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(Math.cos(a0) * R, Math.sin(a0) * R);
        g.lineTo(Math.cos(a1) * R, Math.sin(a1) * R);
        g.closePath();
        g.fillStyle = i % 2 ? (o.color ?? SUN) : (o.color2 ?? 'rgba(255,255,255,0.0)');
        g.globalAlpha = 0.85;
        g.fill();
      }
      g.restore();
    },
  };
}

/** A shockwave ring. */
export function ring(o: { at: number; x: number; y: number; r: number; color?: string; width?: number; layer?: Layer }): Cue {
  const tIn = secondsAt(o.at);
  return {
    from: o.at,
    to: o.at + 3,
    layer: o.layer ?? 'front',
    draw(g, e) {
      const p = (e.t - tIn) / 0.45;
      if (p < 0 || p > 1) return;
      const R = easeOutCubic(p) * o.r * Math.min(e.W, e.H);
      g.save();
      g.globalAlpha = 1 - p;
      g.strokeStyle = o.color ?? WHITE;
      g.lineWidth = (o.width ?? 14) * (1 - p);
      g.beginPath();
      g.arc(o.x * e.W, o.y * e.H, R, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    },
  };
}

/**
 * A transition: two bands of cut paper (yellow, then green) sweep across diagonally. The cut in
 * the footage happens at `at`, when the screen is fully covered.
 */
export function wipe(o: { at: number; colors?: string[]; dir?: 1 | -1; seconds?: number }): Cue {
  const tMid = secondsAt(o.at);
  const half = (o.seconds ?? 0.36) / 2;
  const colors = o.colors ?? [SUN, GRASS];
  const dir = o.dir ?? 1;
  return {
    from: o.at - 1,
    to: o.at + 1,
    layer: 'front',
    draw(g, e) {
      const p = (e.t - (tMid - half)) / (2 * half); // 0..1 across the sweep
      if (p < 0 || p > 1) return;
      const diag = Math.hypot(e.W, e.H);
      const ang = (dir * -62 * Math.PI) / 180;
      g.save();
      g.translate(e.W / 2, e.H / 2);
      g.rotate(ang);
      const bandW = diag * 1.15;
      colors.forEach((color, k) => {
        const lag = k * 0.12;
        const pp = clamp01((p - lag * (1 - p)) / 1);
        const x = lerp(-diag * 1.3, diag * 1.3, easeInOut(pp)) - k * diag * 0.12;
        g.fillStyle = color;
        g.beginPath();
        // Zigzag leading and trailing edges: pinking shears.
        const zig = 18;
        const top = -diag;
        const bot = diag;
        g.moveTo(x - bandW / 2, top);
        for (let yy = top, i = 0; yy <= bot; yy += zig, i++) g.lineTo(x + bandW / 2 + (i % 2 ? 10 : 0), yy);
        for (let yy = bot, i = 0; yy >= top; yy -= zig, i++) g.lineTo(x - bandW / 2 - (i % 2 ? 10 : 0), yy);
        g.closePath();
        g.shadowColor = 'rgba(0,0,0,0.25)';
        g.shadowBlur = 16;
        g.fill();
      });
      g.restore();
    },
  };
}

/** A soft flash of white (lightning, a gulp of magic). */
export function flash(o: { at: number; strength?: number; seconds?: number; color?: string }): Cue {
  const tIn = secondsAt(o.at);
  return {
    from: o.at,
    to: o.at + 3,
    layer: 'front',
    draw(g, e) {
      const p = (e.t - tIn) / (o.seconds ?? 0.35);
      if (p < 0 || p > 1) return;
      g.save();
      g.globalAlpha = (o.strength ?? 0.7) * (1 - easeOutCubic(p));
      g.fillStyle = o.color ?? WHITE;
      g.fillRect(0, 0, e.W, e.H);
      g.restore();
    },
  };
}

/** Anything else: a free-form drawing between two beats. */
export function custom(from: number, to: number, layer: Layer, draw: (g: CanvasRenderingContext2D, e: Env) => void): Cue {
  return { from, to, layer, draw };
}

// ---------------------------------------------------------------- the layer

export class Overlay {
  private readonly bg: CanvasRenderingContext2D;
  private readonly fg: CanvasRenderingContext2D;
  private paper!: CanvasPattern;
  private lastT = 0;
  private readonly cues: Cue[];
  private W = 1;
  private H = 1;

  constructor(private readonly behind: HTMLCanvasElement, private readonly front: HTMLCanvasElement, readonly format: Format) {
    this.bg = behind.getContext('2d')!;
    this.fg = front.getContext('2d')!;
    this.cues = TITLES(format);
    scratch = document.createElement('canvas');
    sg = scratch.getContext('2d')!;
  }

  async load(): Promise<void> {
    DPR = window.devicePixelRatio;
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    for (const c of [this.behind, this.front]) {
      c.width = Math.round(this.W * DPR);
      c.height = Math.round(this.H * DPR);
    }
    this.paper = this.fg.createPattern(makePaper(), 'repeat')!;
    // Make sure the rounded face is loaded before the first letter is measured.
    await document.fonts.load(`900 64px ${FONT}`, 'TELFERSNAKE');
  }

  draw(t: number, beat: number, frame: { head: { x: number; y: number; visible: boolean }; shot: string }): void {
    const dt = Math.max(0, t - this.lastT);
    this.lastT = t;
    const phase = beat - Math.floor(beat);
    const e: Env = {
      t,
      beat,
      dt,
      W: this.W,
      H: this.H,
      portrait: this.H > this.W,
      head: frame.head,
      pulse: Math.exp(-phase * BEAT * 9),
      paper: this.paper,
      front: this.fg,
    };
    for (const g of [this.bg, this.fg]) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, g.canvas.width, g.canvas.height);
      g.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    for (const cue of this.cues) {
      if (beat < cue.from - 0.001 || beat > cue.to) continue;
      const g = cue.layer === 'behind' ? this.bg : this.fg;
      g.save();
      cue.draw(g, e);
      g.restore();
    }
  }
}
