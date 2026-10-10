import * as THREE from 'three';
import type { Postcard, PostcardId } from '../meta/postcards';
import { paintIcon } from '../sim/londonLayout';
import { LANDMARK_BUILDERS, type LandmarkId } from './london/landmarks';

/**
 * The album's postcards, painted once into canvases: a bright sky, a green hill, the landmark itself
 * (its real model, rendered offscreen from a three-quarter view) and your snake photobombing from the
 * corner in your own skin. A card not found yet is the same sight as a flat grey silhouette on plain
 * paper: the silhouette is the hint, no reading needed.
 *
 * The 3D renders need a WebGL context of their own for a moment: it is made on the first card and
 * thrown away as soon as the queue is empty, and each landmark is only ever rendered once per load.
 */

export const CARD_W = 600;
export const CARD_H = 400;

/** The snake who photobombs: its head and body colours (from the skin being worn). */
export interface Photobomber {
  head: number;
  pattern: readonly number[];
}

type Sky = 'day' | 'sunset' | 'night' | 'gold' | 'pink';

interface Look {
  sky: Sky;
  /** The landmark in the picture (the main subject, or the backdrop to a rare moment). */
  sight: LandmarkId | null;
  /** A rare moment's picture, big in the foreground. */
  emoji?: string;
  /** The snake: peeking in from the corner, or flying across the sky (Tower Bridge's leap). */
  snake: 'peek' | 'fly';
}

const RARE_LOOK: Record<string, Look> = {
  guard: { sky: 'day', sight: 'palace', emoji: '💂', snake: 'peek' },
  eyeride: { sky: 'sunset', sight: 'eye', emoji: '✨', snake: 'peek' },
  launch: { sky: 'day', sight: 'towerbridge', emoji: '💨', snake: 'fly' },
  dragon: { sky: 'sunset', sight: 'bigben', emoji: '🐉', snake: 'fly' },
  royal: { sky: 'gold', sight: 'tower', emoji: '👑', snake: 'peek' },
  fireworks: { sky: 'night', sight: 'eye', emoji: '🎆', snake: 'peek' },
  tube: { sky: 'day', sight: null, emoji: '🚇', snake: 'peek' },
  teatime: { sky: 'pink', sight: 'palace', emoji: '🫖', snake: 'peek' },
  whole: { sky: 'gold', sight: null, snake: 'peek' },
};

const SKIES: Record<Sky, [string, string]> = {
  day: ['#7cc8f5', '#e4f6ff'],
  sunset: ['#ff9a62', '#ffe6a6'],
  night: ['#141b45', '#3c3f8f'],
  gold: ['#ffd447', '#fff6cf'],
  pink: ['#ff9fc4', '#fff0f6'],
};

const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
const WORD_FONT = "900 46px ui-rounded, 'SF Pro Rounded', 'Arial Rounded MT Bold', 'Nunito', system-ui, sans-serif";
const css = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

// ---------------------------------------------------------------- the 3D sights, rendered once

let renderer: THREE.WebGLRenderer | null = null;
let rendererBroken = false;
const sights = new Map<LandmarkId, HTMLCanvasElement | null>();

/** Somewhere to draw the sights: a small transparent canvas. Null if this browser cannot. */
function offscreen(): THREE.WebGLRenderer | null {
  if (renderer || rendererBroken) return renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);
  } catch {
    rendererBroken = true; // no second context to be had: the cards fall back to the map's little icons
    renderer = null;
  }
  return renderer;
}

/** Done with 3D for now: hand the context back (phones only get a few). */
export function releasePostcardRenderer(): void {
  if (!renderer) return;
  renderer.dispose();
  renderer.forceContextLoss();
  renderer = null;
}

/** One landmark, alone on a transparent canvas, framed tight from the south-east and a little above. */
function sight(id: LandmarkId): HTMLCanvasElement | null {
  if (sights.has(id)) return sights.get(id) ?? null;
  const r = offscreen();
  let out: HTMLCanvasElement | null = null;
  if (r) {
    try {
      const W = 520;
      const H = 360;
      r.setSize(W, H, false);
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xfdfbf5, 0x9a9384, 1.9));
      const sun = new THREE.DirectionalLight(0xfff6e6, 2.3);
      sun.position.set(-0.6, 1.2, 0.8);
      scene.add(sun);
      const build = LANDMARK_BUILDERS[id]();
      scene.add(build.group);
      build.group.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(build.group);
      const centre = box.getCenter(new THREE.Vector3());
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
      camera.position.copy(centre).add(new THREE.Vector3(0.45, 0.5, 1).normalize().multiplyScalar(300));
      camera.lookAt(centre);
      camera.updateMatrixWorld(true);
      // Fit the box's corners exactly, then widen whichever way the canvas needs.
      const v = new THREE.Vector3();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let i = 0; i < 8; i++) {
        v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).applyMatrix4(camera.matrixWorldInverse);
        x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
      }
      const pad = 1.04;
      let w = (x1 - x0) * pad;
      let h = (y1 - y0) * pad;
      if (w / h > W / H) h = w * (H / W);
      else w = h * (W / H);
      const cx = (x0 + x1) / 2;
      // Sit it on the bottom edge: the card's hill is drawn under it.
      const bottom = y0 - (y1 - y0) * (pad - 1) / 2;
      camera.left = cx - w / 2;
      camera.right = cx + w / 2;
      camera.bottom = bottom;
      camera.top = bottom + h;
      camera.updateProjectionMatrix();
      r.render(scene, camera);
      out = document.createElement('canvas');
      out.width = W;
      out.height = H;
      out.getContext('2d')?.drawImage(r.domElement, 0, 0);
      // Everything built for this one picture goes (shared materials, flagged, stay for the game).
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose();
        const mats = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
        for (const m of mats) if (!m.userData.shared) m.dispose();
      });
    } catch {
      out = null;
    }
  }
  if (!out) {
    // No 3D: the map's own little picture of it, big.
    out = document.createElement('canvas');
    out.width = 520;
    out.height = 360;
    const c = out.getContext('2d');
    if (c) paintIcon(c, id, 260, 230, 13);
  }
  sights.set(id, out);
  return out;
}

// ---------------------------------------------------------------- painting a card

/** `img` as a flat grey shape (its outline only): the hint for a card not found yet. */
function silhouette(img: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const c = out.getContext('2d')!;
  c.drawImage(img, 0, 0, w, h);
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = '#a49c8c';
  c.fillRect(0, 0, w, h);
  return out;
}

function emojiCanvas(emoji: string, size: number): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = out.height = Math.ceil(size * 1.3);
  const c = out.getContext('2d')!;
  c.font = `${size}px ${EMOJI_FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(emoji, out.width / 2, out.height / 2 + size * 0.06);
  return out;
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function paintSky(c: CanvasRenderingContext2D, sky: Sky, x: number, y: number, w: number, h: number): void {
  const [top, bottom] = SKIES[sky];
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  c.fillStyle = g;
  c.fillRect(x, y, w, h);
  if (sky === 'night') {
    c.fillStyle = '#fff8d6';
    for (let i = 0; i < 40; i++) c.fillRect(x + ((i * 137) % w), y + ((i * 59) % (h * 0.6)), 2.5, 2.5);
    c.beginPath();
    c.arc(x + w * 0.16, y + h * 0.2, 26, 0, Math.PI * 2);
    c.fill();
    return;
  }
  // The sun, and a couple of fluffy clouds.
  c.fillStyle = sky === 'sunset' ? '#fff1b8' : '#fff4a8';
  c.beginPath();
  c.arc(x + w * 0.14, y + h * 0.2, 30, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.92)';
  for (const [cx, cy, s] of [[0.36, 0.16, 1], [0.72, 0.28, 0.8]]) {
    for (const [dx, dy, r] of [[-30, 6, 20], [0, 0, 28], [30, 6, 20]]) {
      c.beginPath();
      c.arc(x + w * cx + dx * s, y + h * cy + dy * s, r * s, 0, Math.PI * 2);
      c.fill();
    }
  }
}

/** Fireworks over the river: bursts of coloured rays. */
function paintBursts(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const bursts: [number, number, string][] = [[0.3, 0.25, '#ff3fa4'], [0.62, 0.18, '#ffd23f'], [0.82, 0.38, '#5cff8a'], [0.48, 0.42, '#3fb6ff']];
  c.lineWidth = 4;
  c.lineCap = 'round';
  for (const [bx, by, col] of bursts) {
    c.strokeStyle = col;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      c.beginPath();
      c.moveTo(x + w * bx + Math.cos(a) * 12, y + h * by + Math.sin(a) * 12);
      c.lineTo(x + w * bx + Math.cos(a) * 42, y + h * by + Math.sin(a) * 42);
      c.stroke();
    }
  }
}

/** The Tube's roundel: a red ring and a blue bar. */
function paintRoundel(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, grey: boolean): void {
  c.lineWidth = r * 0.34;
  c.strokeStyle = grey ? '#a49c8c' : '#dc241f';
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.stroke();
  c.fillStyle = grey ? '#a49c8c' : '#1d2a8c';
  c.fillRect(cx - r * 1.4, cy - r * 0.22, r * 2.8, r * 0.44);
}

/** Your snake, photobombing: a curl of body beads in your skin and a googly-eyed head. */
function paintSnake(c: CanvasRenderingContext2D, who: Photobomber, x: number, y: number, w: number, h: number, pose: 'peek' | 'fly'): void {
  const beads: [number, number][] = [];
  const r = 26;
  if (pose === 'peek') {
    // In from the right edge, curling up to look at the camera.
    for (let i = 7; i >= 1; i--) beads.push([x + w + 10 - i * 4 - (7 - i) * 18, y + h - 24 - Math.sin((7 - i) * 0.55) * 30]);
  } else {
    // Sailing across the sky, a happy arc.
    for (let i = 7; i >= 1; i--) beads.push([x + w * 0.52 + (7 - i) * 24 - 70, y + h * 0.3 - Math.sin((7 - i) * 0.45) * 26]);
  }
  beads.forEach(([bx, by], i) => {
    c.beginPath();
    c.arc(bx, by, r * (0.7 + i * 0.04), 0, Math.PI * 2);
    c.fillStyle = css(who.pattern[(beads.length - i) % who.pattern.length]);
    c.fill();
    c.lineWidth = 3;
    c.strokeStyle = '#2b2118';
    c.stroke();
  });
  const [hx, hy] = beads[beads.length - 1];
  const headX = hx - (pose === 'peek' ? 30 : -30);
  const headY = hy - 14;
  c.beginPath();
  c.ellipse(headX, headY, 34, 29, 0, 0, Math.PI * 2);
  c.fillStyle = css(who.head);
  c.fill();
  c.lineWidth = 3;
  c.stroke();
  for (const side of [-1, 1]) {
    c.beginPath();
    c.arc(headX + side * 13, headY - 9, 10, 0, Math.PI * 2);
    c.fillStyle = '#ffffff';
    c.fill();
    c.stroke();
    c.beginPath();
    c.arc(headX + side * 13 + (pose === 'peek' ? -3 : 3), headY - 8, 4.5, 0, Math.PI * 2);
    c.fillStyle = '#15181d';
    c.fill();
  }
  c.beginPath(); // a big grin
  c.arc(headX, headY + 4, 14, 0.15 * Math.PI, 0.85 * Math.PI);
  c.lineWidth = 3.5;
  c.stroke();
}

/** A little postage stamp in the top corner: perforated edges and a crown. */
function paintPostage(c: CanvasRenderingContext2D, x: number, y: number, rare: boolean): void {
  const w = 62;
  const h = 74;
  c.fillStyle = '#ffffff';
  c.fillRect(x - 4, y - 4, w + 8, h + 8);
  c.fillStyle = rare ? '#e0a400' : '#d8342c';
  c.fillRect(x, y, w, h);
  c.fillStyle = '#ffffff';
  for (let i = 0; i <= 7; i++) {
    for (const [px, py] of [[x - 4 + i * ((w + 8) / 7), y - 4], [x - 4 + i * ((w + 8) / 7), y + h + 4], [x - 4, y - 4 + i * ((h + 8) / 7)], [x + w + 4, y - 4 + i * ((h + 8) / 7)]]) {
      c.beginPath();
      c.arc(px, py, 3.2, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.font = `36px ${EMOJI_FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('👑', x + w / 2, y + h / 2 + 2);
}

/**
 * Paint one card into `c` (CARD_W × CARD_H). `have`: found (bright, with your snake) or not yet (a
 * grey silhouette). `got` says which landmark cards are found, for the Whole London card's grid.
 */
export function paintPostcard(c: CanvasRenderingContext2D, card: Postcard, have: boolean, who: Photobomber, got: (id: PostcardId) => boolean): void {
  const W = CARD_W;
  const H = CARD_H;
  const look: Look = card.rare ? RARE_LOOK[card.id] : { sky: 'day', sight: card.id as LandmarkId, snake: 'peek' };
  c.clearRect(0, 0, W, H);
  // The card: white (gold for the rare ones) with rounded corners.
  roundRect(c, 0, 0, W, H, 18);
  c.fillStyle = !have ? '#efe6d0' : card.id === 'whole' ? '#f2c230' : card.rare ? '#ffe9a6' : '#ffffff';
  c.fill();
  const px = 16;
  const py = 16;
  const pw = W - 32;
  const ph = H - 32;
  c.save();
  roundRect(c, px, py, pw, ph, 10);
  c.clip();
  if (have) {
    paintSky(c, look.sky, px, py, pw, ph);
    if (card.id === 'fireworks') paintBursts(c, px, py, pw, ph);
    // A green hill (a dark night one under the fireworks).
    c.fillStyle = look.sky === 'night' ? '#2f5a3a' : '#8fd16a';
    c.beginPath();
    c.ellipse(px + pw / 2, py + ph + 40, pw * 0.75, 110, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = look.sky === 'night' ? '#244a30' : '#6dbb4f';
    c.beginPath();
    c.ellipse(px + pw * 0.15, py + ph + 30, pw * 0.4, 80, 0, 0, Math.PI * 2);
    c.fill();
  } else {
    c.fillStyle = '#e6dcc4';
    c.fillRect(px, py, pw, ph);
  }

  // The landmark: big when it is the card, set back (smaller, to one side) behind a rare moment.
  if (card.id === 'whole') {
    // Every sight's little map picture, in a grid: the ones you have in colour.
    const ids: LandmarkId[] = ['bigben', 'eye', 'palace', 'museum', 'piccadilly', 'trafalgar', 'stpauls', 'globe', 'gherkin', 'tower', 'towerbridge', 'shard'];
    ids.forEach((id, i) => {
      const cx = px + 60 + (i % 6) * ((pw - 120) / 5);
      const cy = py + 100 + Math.floor(i / 6) * 130;
      const tile = document.createElement('canvas');
      tile.width = tile.height = 120;
      const t = tile.getContext('2d')!;
      paintIcon(t, id, 60, 72, 4);
      c.drawImage(have && got(id) ? tile : silhouette(tile, 120, 120), cx - 50, cy - 50, 100, 100);
    });
  } else if (look.sight) {
    const img = sight(look.sight);
    if (img) {
      const main = !card.rare;
      const bw = main ? pw * 0.86 : pw * 0.62;
      const bh = bw * (img.height / img.width);
      const bx = main ? px + (pw - bw) / 2 - 20 : px + 8;
      const by = py + ph - bh - 8;
      if (have) c.drawImage(img, bx, by, bw, bh);
      else if (main) c.drawImage(silhouette(img, img.width, img.height), bx, by, bw, bh);
    }
  }
  if (card.id === 'tube') paintRoundel(c, px + pw * 0.36, py + ph * 0.4, 70, !have);
  if (look.emoji && card.id !== 'whole') {
    // The moment's picture, big in front (a silhouette until it happens).
    const e = emojiCanvas(look.emoji, 150);
    const size = card.id === 'tube' ? 170 : 200;
    const ex = px + pw * (card.id === 'tube' ? 0.64 : 0.58);
    const ey = py + ph * (card.id === 'tube' ? 0.55 : 0.42);
    c.drawImage(have ? e : silhouette(e, e.width, e.height), ex - size / 2, ey - size / 2, size, size);
  }
  if (have && card.id !== 'whole') paintSnake(c, who, px, py, pw, ph, look.snake);
  c.restore();

  // The ribbon with its short name (a "?" until found), and the stamp in the corner.
  c.font = WORD_FONT;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const word = have ? card.name : '?';
  const tw = Math.min(W - 40, Math.max(90, c.measureText(word).width + 44));
  const rx = W / 2 - tw / 2;
  const ry = H - 76;
  roundRect(c, rx, ry, tw, 62, 14);
  c.fillStyle = have ? (card.rare ? '#e0a400' : '#d8342c') : '#a49c8c';
  c.fill();
  c.lineWidth = 3;
  c.strokeStyle = '#2b2118';
  c.stroke();
  c.fillStyle = '#ffffff';
  c.fillText(word, W / 2, ry + 33, tw - 24);
  if (have) paintPostage(c, W - 96, 30, card.rare);
  // A frame round the card: ink when found, dashed when not.
  roundRect(c, 1.5, 1.5, W - 3, H - 3, 18);
  c.lineWidth = 3;
  c.strokeStyle = have ? '#2b2118' : '#b9ad95';
  if (!have) c.setLineDash([14, 10]);
  c.stroke();
  c.setLineDash([]);
}
