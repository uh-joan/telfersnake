/**
 * The words on screen, beat by beat. Short, bold words and emoji a six-year-old can read on a phone
 * (the game's own rule: visual-first, short labels, no sentences). Big and full-width when the
 * picture behind them is calm; small, like a caption, when the game itself is doing the talking.
 *
 * Positions are fractions of the frame; sizes are CSS px on a 432 px-wide phone layout (scaled for 16:9).
 */
import { CATALOGUE } from '../../src/meta/catalogue';
import { secondsAt } from './beats';
import type { Format } from './director';
import {
  burst, clamp01, type Cue, custom, easeInBack, easeOutBack, easeOutElastic, flash, FONT, GRASS, INK, LEAF, RED, SKY, sticker, SUN,
  SUN_DEEP, WHITE, wipe, word,
} from './overlay';
import { OUTFITS } from './shots';

const RAINBOW = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#9775fa'];
const PINK = '#ff8fab';
const BEAR = '#e8a65d';
const WOLF = '#c5d3e8';
const FIRE = '#ff5a36';

const icon = (kind: 'skin' | 'hat' | 'trail', id: string): string => CATALOGUE[kind].find((i) => i.id === id)?.icon ?? '✨';

/** A ring that bursts from wherever the snake's head is on screen. */
function headRing(at: number, color = WHITE, r = 0.35): Cue {
  const t0 = secondsAt(at);
  let x = 0;
  let y = 0;
  return custom(at, at + 2, 'behind', (g, e) => {
    const p = (e.t - t0) / 0.5;
    if (p < 0 || p > 1) return;
    if (p < 0.05 || (x === 0 && y === 0)) {
      x = e.head.x;
      y = e.head.y;
    }
    const R = (1 - (1 - p) ** 3) * r * Math.min(e.W, e.H);
    g.globalAlpha = 1 - p;
    g.strokeStyle = color;
    g.lineWidth = 12 * (1 - p) + 2;
    g.beginPath();
    g.arc(x, y, R, 0, Math.PI * 2);
    g.stroke();
  });
}

/** A soft dark vignette to lift words off busy footage. */
function vignette(from: number, to: number, strength = 0.35, cy = 0.4): Cue {
  const t0 = secondsAt(from);
  const t1 = secondsAt(to);
  return custom(from, to + 1, 'behind', (g, e) => {
    const a = clamp01((e.t - t0) / 0.3) * (1 - clamp01((e.t - t1) / 0.3));
    if (a <= 0) return;
    const grad = g.createRadialGradient(e.W / 2, e.H * cy, e.W * 0.1, e.W / 2, e.H * cy, Math.max(e.W, e.H) * 0.75);
    grad.addColorStop(0, `rgba(15,20,35,${0.05 * a})`);
    grad.addColorStop(1, `rgba(15,20,35,${strength * a})`);
    g.fillStyle = grad;
    g.fillRect(0, 0, e.W, e.H);
  });
}

/** The end card's call to action: the address on a sunny pill, like the game's Play button. */
function urlPill(at: number, y: number, size: number): Cue {
  const t0 = secondsAt(at);
  const text = 'telfersnake.joans.cat';
  return custom(at, 80, 'front', (g, e) => {
    const tl = e.t - t0;
    if (tl < 0) return;
    const s = easeOutElastic(clamp01(tl / 0.7)) * (1 + 0.035 * e.pulse);
    g.font = `900 ${size}px ${FONT}`;
    const tw = g.measureText(text).width;
    const play = size * 1.25;
    const w = Math.min(e.W * 0.94, tw + play + size * 1.3);
    const k = Math.min(1, (e.W * 0.94 - play - size * 1.3) / tw);
    const h = size * 1.9;
    g.translate(e.W / 2, y * e.H);
    g.scale(s, s);
    g.rotate(-0.02);
    // Shadow slab, like .round.go's box-shadow.
    const pill = (dy: number, fill: string) => {
      g.beginPath();
      g.roundRect(-w / 2, -h / 2 + dy, w, h, h / 2);
      g.fillStyle = fill;
      g.fill();
    };
    pill(size * 0.22, SUN_DEEP);
    pill(0, SUN);
    g.lineWidth = 3.5;
    g.strokeStyle = INK;
    g.beginPath();
    g.roundRect(-w / 2, -h / 2, w, h, h / 2);
    g.stroke();
    // ▶ in an ink circle.
    const px = -w / 2 + h / 2 + size * 0.08;
    g.fillStyle = INK;
    g.beginPath();
    g.arc(px, 0, play / 2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = SUN;
    g.beginPath();
    g.moveTo(px - play * 0.14, -play * 0.22);
    g.lineTo(px + play * 0.24, 0);
    g.lineTo(px - play * 0.14, play * 0.22);
    g.closePath();
    g.fill();
    g.fillStyle = INK;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.font = `900 ${size * k}px ${FONT}`;
    g.fillText(text, px + play / 2 + size * 0.3, size * 0.05);
  });
}

/** A small sticker that swaps on every beat, showing the Tuck Shop item just put on. */
function shopIcons(): Cue[] {
  const cues: Cue[] = [];
  OUTFITS.forEach(([skin, hat, trail], i) => {
    const beat = 52 + i;
    const glyph = i < 4 ? icon('skin', skin) : i < 8 ? icon('hat', hat) : icon('trail', trail);
    cues.push(sticker(glyph, { at: beat, out: beat + 0.94, x: 0.5 + (i % 2 ? 0.3 : -0.3), y: 0.32, size: 78, rot: i % 2 ? 10 : -10, enter: 'slap' }));
  });
  return cues;
}

export function TITLES(format: Format): Cue[] {
  const P = format === '9x16';
  /** Size scale for 16:9, where the frame is short. */
  const S = P ? 1 : 0.64;
  /** Top band for the words, clear of the game's banner (36% down). */
  const top = P ? 0.16 : 0.15;
  /** Stacked lines sit further apart (as a share of the frame) in the short 16:9 frame. */
  const L = P ? 1 : 1.75;
  /** The hook's title sits where the Dragon's head bursts through it. */
  const hookY = P ? 0.34 : 0.36;

  return [
    // ---------------------------------------------------------------- 0–4 hook
    burst({ at: -2, out: 3.6, x: 0.5, y: hookY + 0.06, r: 0.62, color: 'rgba(255,216,74,0.33)', rays: 16 }),
    word('TELFER', { at: -1.2, out: 3.55, x: 0.5, y: hookY - 0.06 * L, size: 118 * S, fill: WHITE, layer: 'behind', exit: 'up', bob: 0.05, maxW: P ? 0.92 : 0.6 }),
    word('SNAKE', { at: -0.9, out: 3.55, x: 0.5, y: hookY + 0.075 * L, size: 150 * S, fill: LEAF, layer: 'behind', knock: true, exit: 'up', maxW: P ? 0.92 : 0.62 }),
    wipe({ at: 4 }),

    // ---------------------------------------------------------------- 4–12 the school yard
    word('EAT!', { at: 4.1, out: 5.65, x: 0.44, y: top, size: 140 * S, fill: SUN, rot: -4, enter: 'drop' }),
    sticker('🍪', { at: 4.6, out: 5.65, x: P ? 0.8 : 0.66, y: top + 0.06, size: 70 * S, rot: 14 }),
    word('BOING!', { at: 6, out: 7.65, x: 0.5, y: top, size: 104 * S, fill: WHITE, rot: 5, enter: 'pop', exit: 'shrink', stagger: 0.02 }),
    word('GROW!', { at: 8, out: 9.65, x: 0.5, y: top, size: 140 * S, fill: LEAF, enter: 'slam' }),
    headRing(8, SUN, 0.3),
    word('GULP!', { at: 10, out: 11.5, x: 0.46, y: top, size: 140 * S, fill: SUN, rot: 3, enter: 'slam' }),
    sticker('🐔', { at: 10.3, out: 11.5, x: P ? 0.82 : 0.68, y: top + 0.08, size: 74 * S, rot: -12 }),
    flash({ at: 12, strength: 0.5, seconds: 0.25 }),

    // ---------------------------------------------------------------- 12–20 up the road, the lock
    word('LEVEL 2', { at: 12.1, out: 15.5, x: 0.5, y: top - 0.02, size: 116 * S, fill: SUN, enter: 'slam', exit: 'up' }),
    sticker('🌳', { at: 13, out: 15.5, x: P ? 0.8 : 0.68, y: top + 0.08, size: 70 * S, rot: 10 }),

    // ---------------------------------------------------------------- 20–28 the Common, weather
    word('THE COMMON!', { at: 20, out: 23.65, x: 0.5, y: top, size: 96 * S, fill: LEAF, enter: 'slam', maxW: P ? 0.94 : 0.7 }),
    sticker('☀️', { at: 20.6, out: 23.7, x: P ? 0.83 : 0.8, y: top + 0.09, size: 70 * S, rot: 8, enter: 'spin' }),
    word('RAIN!', { at: 24, out: 25.65, x: 0.44, y: top, size: 130 * S, fill: SKY, rot: -3, enter: 'drop' }),
    sticker('🌧️', { at: 24.3, out: 25.65, x: P ? 0.8 : 0.66, y: top + 0.07, size: 76 * S, rot: -8 }),
    sticker('⚡', { at: 26, out: 27.5, x: 0.5, y: top + 0.03, size: 190 * S, rot: -6, enter: 'slap' }),
    flash({ at: 26, strength: 0.55, seconds: 0.35 }),
    flash({ at: 27, strength: 0.35, seconds: 0.3 }),

    // ---------------------------------------------------------------- 28–32 friends
    word('FRIENDS!', { at: 28, out: 31.5, x: 0.5, y: top, size: 118 * S, fill: PINK, enter: 'pop', stagger: 0.03 }),
    sticker('💕', { at: 28.7, out: 31.5, x: P ? 0.8 : 0.72, y: top + 0.085, size: 66 * S, rot: 12 }),

    // ---------------------------------------------------------------- 32–36 bear, wolves
    word('BEAR!', { at: 32, out: 33.65, x: 0.42, y: top, size: 140 * S, fill: BEAR, rot: -4, enter: 'slam' }),
    sticker('🐻', { at: 32.3, out: 33.65, x: P ? 0.8 : 0.66, y: top + 0.06, size: 80 * S, rot: 10, enter: 'slap' }),
    word('WOLVES!', { at: 34, out: 35.5, x: 0.44, y: top, size: 120 * S, fill: WOLF, rot: 3, enter: 'slam' }),
    sticker('🐺', { at: 34.3, out: 35.5, x: P ? 0.84 : 0.7, y: top + 0.07, size: 80 * S, rot: -10, enter: 'slap' }),

    // ---------------------------------------------------------------- 36–40 magic
    word('MAGIC!', { at: 36, out: 39.5, x: 0.5, y: top, size: 136 * S, fills: RAINBOW, enter: 'pop', stagger: 0.05 }),
    sticker('✨', { at: 36.6, out: 39.5, x: P ? 0.15 : 0.3, y: top + 0.08, size: 56 * S, rot: -10 }),
    sticker('🦄', { at: 38, out: 39.5, x: P ? 0.82 : 0.7, y: top + 0.09, size: 82 * S, rot: 10, enter: 'slap' }),
    flash({ at: 38, strength: 0.6, seconds: 0.4, color: '#fff6d8' }),
    headRing(38, '#ffd6f2', 0.4),
    wipe({ at: 40, dir: -1, colors: [SUN, RED] }),

    // ---------------------------------------------------------------- 40–52 race to the Dragon
    headRing(40, SUN, 0.25),
    headRing(42, SUN, 0.3),
    headRing(44, SUN, 0.35),
    headRing(46, SUN, 0.4),
    burst({ at: 48, out: 51.6, x: 0.5, y: top + 0.05, r: 0.7, color: 'rgba(255,120,40,0.45)', rays: 18 }),
    word('THE', { at: 48, out: 51.5, x: 0.5, y: top - (P ? 0.045 : 0.06), size: 84 * S, fill: WHITE, enter: 'slam' }),
    word('DRAGON!', { at: 48.25, out: 51.5, x: 0.5, y: top + 0.07 * L, size: 140 * S, fill: FIRE, enter: 'slam', stagger: 0.03 }),
    sticker('🐲', { at: 49, out: 51.5, x: P ? 0.82 : 0.76, y: top + 0.17, size: 84 * S, rot: 12, enter: 'slap' }),
    flash({ at: 48, strength: 0.6, seconds: 0.3, color: '#fff1c4' }),
    headRing(48, '#ff7b00', 0.55),
    wipe({ at: 52, colors: [SUN, GRASS] }),

    // ---------------------------------------------------------------- 52–64 Tuck Shop
    word('TUCK SHOP', { at: 52.2, out: 63.5, x: 0.5, y: P ? 0.085 : 0.1, size: 50 * S, fill: WHITE, plate: GRASS, enter: 'pop', stagger: 0.02, bob: 0.03 }),
    word('SKINS!', { at: 52.5, out: 55.65, x: 0.5, y: top + 0.07, size: 128 * S, fills: ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#9775fa'], enter: 'slam' }),
    word('HATS!', { at: 56, out: 59.65, x: 0.5, y: top + 0.07, size: 136 * S, fill: SUN, enter: 'slam' }),
    word('TRAILS!', { at: 60, out: 63.5, x: 0.5, y: top + 0.07, size: 124 * S, fill: SKY, enter: 'slam' }),
    ...shopIcons(),
    wipe({ at: 64, dir: -1 }),

    // ---------------------------------------------------------------- 64–72 end card
    vignette(64, 72, 0.45, 0.42),
    word('Telfer', { at: 64.2, out: 99, x: 0.5, y: P ? 0.36 : 0.36, size: 118 * S, fill: WHITE, enter: 'slam', bob: 0.04, spacing: -0.03, maxW: P ? 0.9 : 0.6 }),
    word('snake', { at: 64.7, out: 99, x: 0.5, y: P ? 0.47 : 0.54, size: 118 * S, fill: LEAF, enter: 'slam', bob: 0.04, spacing: -0.03, maxW: P ? 0.9 : 0.6 }),
    sticker('🐍', { at: 65.5, out: 99, x: P ? 0.84 : 0.76, y: P ? 0.28 : 0.26, size: 72 * S, rot: 14, enter: 'spin' }),
    urlPill(66.5, P ? 0.62 : 0.78, 25 * (P ? 1 : 0.95)),
    custom(68, 99, 'front', (g, e) => {
      // A last sparkle of stars round the logo on the final downbeat.
      const tl = e.t - secondsAt(68);
      if (tl < 0 || tl > 1.2) return;
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + 0.3;
        const r = (0.18 + easeOutBack(clamp01(tl / 0.6)) * 0.22) * e.W;
        const s = (1 - easeInBack(clamp01((tl - 0.5) / 0.7))) * (i % 2 ? 22 : 16);
        if (s <= 0) continue;
        g.save();
        g.translate(e.W / 2 + Math.cos(a) * r, e.H * (P ? 0.42 : 0.45) + Math.sin(a) * r * 0.8);
        g.rotate(tl * 2 + i);
        g.fillStyle = i % 3 ? SUN : WHITE;
        g.beginPath();
        for (let k = 0; k < 10; k++) {
          const rr = k % 2 ? s * 0.45 : s;
          const aa = (k / 10) * Math.PI * 2;
          g.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr);
        }
        g.closePath();
        g.fill();
        g.restore();
      }
    }),
  ];
}
