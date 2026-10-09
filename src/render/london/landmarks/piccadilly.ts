import * as THREE from 'three';
import { PICCADILLY_FOUNTAIN, PICCADILLY_SCREENS } from '../../../sim/londonLayout';
import { box, cone, cyl, extrude, inked, lathe, PALETTE, rel, sphere, windows, type LandmarkBuild } from './kit';

/**
 * Piccadilly Circus: the curved corner building on the north edge wearing a giant wall of light
 * screens that bulges toward the camera and flashes a new picture every half second (hearts, stars,
 * a snake, rainbow stripes, bubbles, a smiling sun, a checkerboard: shapes only, never words or
 * brands); and in front, the little stepped fountain with a silvery winged archer balanced on top.
 * Colour story: the screens are the colour; everything else is pale stone and bronze to let them shout.
 */

const STONE = 0xeadcc0;
const STONE_SHADE = 0xcdbb98;
const SHOP = 0x2f3a4a;
const FRAME = 0x1b1b22;
const BRONZE = 0x7a6440;
const SILVER = 0xdbe3ec;
const WATER = 0x6fd0e6;

// ---------------------------------------------------------------- the screens' picture

const CW = 640;
const CH = 256;
type Motif = (c: CanvasRenderingContext2D, w: number, h: number, f: number) => void;

function heart(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
  c.beginPath();
  c.moveTo(x, y + s * 0.35);
  c.bezierCurveTo(x - s * 0.9, y - s * 0.25, x - s * 0.35, y - s * 0.85, x, y - s * 0.3);
  c.bezierCurveTo(x + s * 0.35, y - s * 0.85, x + s * 0.9, y - s * 0.25, x, y + s * 0.35);
  c.fill();
}

function star(c: CanvasRenderingContext2D, x: number, y: number, r: number, spin = 0) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = spin + (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
  c.fill();
}

const RAINBOW = ['#ff3b3b', '#ff9a1f', '#ffe11f', '#3fd24a', '#2fa8ff', '#9a5bff'];

const MOTIFS: Motif[] = [
  // hearts
  (c, w, h, f) => {
    c.fillStyle = '#ff4f9a';
    c.fillRect(0, 0, w, h);
    const s = Math.min(w, h) / 3.2;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 3; j++) {
        c.fillStyle = (i + j + f) % 2 ? '#ffffff' : '#d4004c';
        heart(c, (i + 0.5 + (j % 2) * 0.5) * (w / 3.5), (j + 0.6) * (h / 2.8), s * ((i + j + f) % 2 ? 0.8 : 1));
      }
    }
  },
  // twinkling stars
  (c, w, h, f) => {
    c.fillStyle = '#1d2a6b';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) {
      c.fillStyle = i % 3 === f % 3 ? '#ffffff' : '#ffd93b';
      const x = ((i * 0.37 + 0.1) % 1) * w;
      const y = ((i * 0.61 + 0.15) % 1) * h;
      star(c, x, y, (Math.min(w, h) / 7) * (i % 3 === f % 3 ? 1.4 : 1), f * 0.3);
    }
  },
  // a wiggling snake
  (c, w, h, f) => {
    c.fillStyle = '#39c6e8';
    c.fillRect(0, 0, w, h);
    const t = Math.max(8, h / 6);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = '#1f7a1f';
    c.lineWidth = t * 1.35;
    const path = () => {
      c.beginPath();
      for (let x = t; x <= w - t * 2; x += 4) c.lineTo(x, h / 2 + Math.sin(x / (w / 9) + f * 1.2) * h * 0.22);
    };
    path();
    c.stroke();
    c.strokeStyle = '#5ee35a';
    c.lineWidth = t;
    path();
    c.stroke();
    const hx = w - t * 2;
    const hy = h / 2 + Math.sin(hx / (w / 9) + f * 1.2) * h * 0.22;
    c.fillStyle = '#5ee35a';
    c.beginPath();
    c.ellipse(hx, hy, t * 1.1, t * 0.85, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(hx + t * 0.2, hy - t * 0.3, t * 0.35, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#111111';
    c.beginPath();
    c.arc(hx + t * 0.3, hy - t * 0.3, t * 0.17, 0, Math.PI * 2);
    c.fill();
    if (f % 2) {
      c.strokeStyle = '#ff2b4a';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(hx + t, hy);
      c.lineTo(hx + t * 1.7, hy);
      c.stroke();
    }
  },
  // rainbow stripes marching sideways
  (c, w, h, f) => {
    const sw = Math.max(w, h) / 6;
    for (let i = -8; i < 14; i++) {
      c.fillStyle = RAINBOW[(((i + f) % 6) + 6) % 6];
      c.beginPath();
      c.moveTo(i * sw, 0);
      c.lineTo(i * sw + sw, 0);
      c.lineTo(i * sw + sw - h * 0.6, h);
      c.lineTo(i * sw - h * 0.6, h);
      c.fill();
    }
  },
  // bubbles
  (c, w, h, f) => {
    c.fillStyle = '#ffd23f';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) {
      c.fillStyle = RAINBOW[(i + f) % 6];
      const r = (Math.min(w, h) / 6) * (1 + ((i * 7 + f) % 3) * 0.35);
      c.beginPath();
      c.arc(((i * 0.29 + 0.08) % 1) * w, (((i * 0.53 + 0.2 - f * 0.12) % 1) + 1) % 1 * h, r, 0, Math.PI * 2);
      c.fill();
    }
  },
  // a smiling sun, winking
  (c, w, h, f) => {
    c.fillStyle = '#ff8a00';
    c.fillRect(0, 0, w, h);
    const r = Math.min(w, h) * 0.3;
    const x = w / 2;
    const y = h / 2;
    c.fillStyle = '#ffe14a';
    for (let i = 0; i < 12; i++) star(c, x, y, r * 1.55, (i * Math.PI) / 6 + f * 0.2);
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#5a2a00';
    c.beginPath();
    c.arc(x - r * 0.35, y - r * 0.2, r * 0.12, 0, Math.PI * 2);
    if (f % 2) c.fillRect(x + r * 0.2, y - r * 0.24, r * 0.3, r * 0.08);
    else c.arc(x + r * 0.35, y - r * 0.2, r * 0.12, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#5a2a00';
    c.lineWidth = r * 0.1;
    c.beginPath();
    c.arc(x, y + r * 0.05, r * 0.5, 0.2 * Math.PI, 0.8 * Math.PI);
    c.stroke();
  },
  // a flashing checkerboard
  (c, w, h, f) => {
    const n = 6;
    const s = w / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < Math.ceil(h / s); j++) {
        c.fillStyle = (i + j + f) % 2 ? '#2fa8ff' : '#ffffff';
        c.fillRect(i * s, j * s, s, s);
      }
    }
  },
];

/** The mosaic of panels (in canvas pixels), each with its own rhythm. */
const PANELS = [
  { x: 8, y: 8, w: 192, h: 116 },
  { x: 8, y: 132, w: 192, h: 116 },
  { x: 208, y: 8, w: 224, h: 240 },
  { x: 440, y: 8, w: 192, h: 150 },
  { x: 440, y: 166, w: 92, h: 82 },
  { x: 540, y: 166, w: 92, h: 82 },
];

function drawScreens(c: CanvasRenderingContext2D, frame: number) {
  c.fillStyle = '#111116';
  c.fillRect(0, 0, CW, CH);
  PANELS.forEach((p, i) => {
    const beat = 2 + (i % 3); // panels change picture every 2–4 ticks, out of step
    const motif = MOTIFS[(Math.floor((frame + i * 5) / beat) + i * 2) % MOTIFS.length];
    c.save();
    c.translate(p.x, p.y);
    c.beginPath();
    c.rect(0, 0, p.w, p.h);
    c.clip();
    motif(c, p.w, p.h, frame + i);
    c.restore();
  });
}

// ---------------------------------------------------------------- the curved screen wall

/** The south face of the screen wall: bulging toward the camera by `bulge` at its middle. */
const frontZ = (x: number, wall: number, half: number, bulge: number) => wall + bulge * (1 - (x / half) ** 2);

/** A curved strip (with uvs) along the bulge, from y0 to y1: the lit picture. */
function screenSurface(wall: number, half: number, bulge: number, y0: number, y1: number): THREE.BufferGeometry {
  const N = 32;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= N; i++) {
    const x = -half + (2 * half * i) / N;
    const z = frontZ(x, wall, half, bulge) + 0.04;
    const n = new THREE.Vector3((2 * bulge * x) / (half * half), 0, 1).normalize();
    for (const [y, v] of [[y0, 0], [y1, 1]] as const) {
      pos.push(x, y, z);
      nor.push(n.x, n.y, n.z);
      uv.push(i / N, v);
    }
  }
  for (let i = 0; i < N; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 2, a + 3, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** A slab whose south face follows the bulge, from the wall out, `y` up to `y + h`. */
function bulgeSlab(wall: number, half: number, bulge: number, y: number, h: number, color: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  // shape (x, s) becomes world (x, z = -s) once stood up
  s.moveTo(-half, -(wall - 0.3));
  for (let i = 0; i <= 24; i++) {
    const x = -half + (2 * half * i) / 24;
    s.lineTo(x, -frontZ(x, wall, half, bulge));
  }
  s.lineTo(half, -(wall - 0.3));
  s.closePath();
  return extrude(s, h, color).rotateX(-Math.PI / 2).translate(0, y + h / 2, 0);
}

// ---------------------------------------------------------------- the fountain's winged archer

function wing(sign: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(sign * 0.35, 0.65, sign * 0.95, 1.0);
  s.lineTo(sign * 0.8, 0.7);
  s.lineTo(sign * 0.9, 0.55);
  s.lineTo(sign * 0.65, 0.4);
  s.lineTo(sign * 0.7, 0.22);
  s.lineTo(sign * 0.35, 0.12);
  s.closePath();
  return s;
}

function archer(): THREE.BufferGeometry[] {
  const bow = new THREE.Shape();
  const a1 = Math.PI * 0.62;
  const a2 = Math.PI * 1.38;
  bow.absarc(0, 0, 0.5, a1, a2, false);
  bow.absarc(0, 0, 0.44, a2, a1, true);
  bow.closePath();
  return [
    cyl(0.05, 0.07, 0.7, SILVER, 0, 0, 0, 6),
    box(0.1, 0.6, 0.1, SILVER, 0, 0, 0).rotateX(-1.0).translate(0.06, 0.55, -0.05),
    sphere(0.2, SILVER, 0, 0, 0, 10, 8).scale(1, 1.6, 0.8).translate(0, 0.95, 0),
    sphere(0.13, SILVER, 0, 1.4, 0.02, 10, 8),
    extrude(wing(1), 0.05, SILVER, 0.08, 1.0, -0.12),
    extrude(wing(-1), 0.05, SILVER, -0.08, 1.0, -0.12),
    extrude(bow, 0.05, SILVER, -0.15, 1.08, 0.08),
    box(0.5, 0.07, 0.07, SILVER, -0.3, 1.1, 0.06),
    box(0.8, 0.03, 0.03, SILVER, -0.22, 1.06, 0.1),
  ];
}

export function build(): LandmarkBuild {
  const s = rel('piccadilly', PICCADILLY_SCREENS.x, PICCADILLY_SCREENS.z);
  const SW = PICCADILLY_SCREENS.w;
  const SD = PICCADILLY_SCREENS.d;
  const wall = s.z + SD / 2; // the south face of the building
  const H = 13;
  const half = SW / 2 - 0.5;
  const BULGE = 1.1;
  const parts: THREE.BufferGeometry[] = [];

  // ---- the building: pale stone, a shop row with awnings, the screen wall, windows and corner domes
  parts.push(
    box(SW, H, SD, STONE, s.x, 0, s.z),
    box(SW + 0.4, 0.45, SD + 0.4, STONE_SHADE, s.x, H, s.z),
    windows({ cols: 6, rows: 1, cellW: 2.5, cellH: 2.4, winW: 1.9, winH: 1.7, color: SHOP, x: s.x, y: 0.15, z: wall }),
    windows({ cols: 8, rows: 2, cellW: 1.8, cellH: 1.2, winW: 0.8, winH: 0.75, color: SHOP, x: s.x, y: 10.5, z: wall }),
  );
  const AWNINGS = [PALETTE.busRed, PALETTE.navy, PALETTE.westminsterGreen, PALETTE.gold, PALETTE.busRed, PALETTE.navy];
  AWNINGS.forEach((col, i) => {
    parts.push(box(2.1, 0.1, 0.8, col, 0, 0, 0).rotateX(0.35).translate(s.x + (i - 2.5) * 2.5, 2.05, wall + 0.35));
  });
  parts.push(
    bulgeSlab(wall, half + 0.3, BULGE + 0.2, 2.55, 0.35, STONE_SHADE),
    bulgeSlab(wall, half, BULGE, 2.9, 7.0, FRAME),
    bulgeSlab(wall, half + 0.3, BULGE + 0.2, 9.9, 0.4, STONE_SHADE),
  );
  for (const x of [-SW / 2 + 1.4, SW / 2 - 1.4]) {
    parts.push(
      cyl(1.3, 1.3, 2.2, STONE, s.x + x, H + 0.45, s.z + 0.8, 14),
      windows({ cols: 1, rows: 1, cellW: 1, cellH: 1.8, winW: 0.6, winH: 1.1, color: SHOP, x: s.x + x, y: H + 0.6, z: s.z + 2.1, arched: true }),
      cyl(1.5, 1.5, 0.25, STONE_SHADE, s.x + x, H + 2.65, s.z + 0.8, 14),
      sphere(1.25, PALETTE.slate, s.x + x, H + 2.9, s.z + 0.8, 14, 8, Math.PI * 2, Math.PI / 2),
      cone(0.15, 1.0, PALETTE.gold, s.x + x, H + 4.1, s.z + 0.8, 6),
      sphere(0.2, PALETTE.gold, s.x + x, H + 5.15, s.z + 0.8, 8, 6),
    );
  }

  // ---- the fountain: octagonal steps, a bronze basin and stem, and the winged archer on top
  const r = PICCADILLY_FOUNTAIN.r;
  parts.push(
    cyl(r, r + 0.05, 0.3, STONE_SHADE, 0, 0, 0, 8),
    cyl(r - 0.35, r - 0.3, 0.3, STONE, 0, 0.3, 0, 8),
    cyl(0.7, 0.95, 0.9, BRONZE, 0, 0.6, 0, 8),
    lathe([[0.3, 0], [0.9, 0.25], [1.15, 0.5], [1.1, 0.56], [0.3, 0.42], [0, 0.42]], BRONZE, 0, 1.5, 0, 16),
    cyl(1.0, 1.0, 0.03, WATER, 0, 1.9, 0, 16),
    cyl(0.18, 0.28, 1.5, BRONZE, 0, 1.9, 0, 8),
    sphere(0.32, BRONZE, 0, 3.45, 0, 10, 8),
  );
  const k = 1.5;
  for (const g of archer()) parts.push(g.scale(k, k, k).rotateY(-0.35).translate(0, 3.7, 0));

  const group = new THREE.Group();
  group.add(inked(parts, 0.09));

  // ---- the lit picture: a canvas redrawn every half second, self-lit and unshaded
  const canvas = document.createElement('canvas');
  canvas.width = CW;
  canvas.height = CH;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const screen = new THREE.Mesh(
    screenSurface(wall, half - 0.15, BULGE, 3.1, 9.7),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
  );
  screen.position.x = s.x;
  group.add(screen);
  let frame = -1;
  const paint = (f: number) => {
    if (!ctx || f === frame) return;
    frame = f;
    drawScreens(ctx, f);
    tex.needsUpdate = true;
  };
  paint(0);

  return {
    group,
    // It stands on the map's north edge, so nothing behind it can hide; and fading would dim the lights.
    tall: false,
    labelY: H + 7,
    animate(t) {
      paint(Math.floor(t / 0.5));
    },
  };
}
