import * as THREE from 'three';
import {
  BOROUGH, COVENT_GARDEN, HYDE_PARK, LANDMARKS, LONDON_BOUNDS, NELSON, PICCADILLY_FOUNTAIN, ROADS,
  SERPENTINE, SOUTH_BANK, ST_JAMES, THAMES, VICTORIA_MEMORIAL, type Road,
} from '../../sim/londonLayout';
import type { Box } from '../../sim/layout';
import { Rng } from '../../sim/rng';
import type { Spot } from '../../sim/stage';

/**
 * London's ground: the paper tourist map (docs/LEVEL3-LONDON.md §2.2). One big canvas, painted once:
 * cream paper with fibres and fold creases, flat green parks with drawn tree dots, sandy squares,
 * off-white streets with crisp ink edges, zebra crossings, a compass rose, the dotted red tour route,
 * a "here be snakes" sea serpent, and the folded-paper border with the LONDON cartouche.
 *
 * The river is CUT OUT of the paper (alpha 0): the Thames is its own animated mesh a little below,
 * in a channel with stone embankment walls (water.ts), so the bridges have something to span.
 */

const B = LONDON_BOUNDS;
/** The printed border round the playable map, in metres (outside the bounds, never walked on). */
export const MARGIN = 5;
export const SHEET = {
  minX: B.minX - MARGIN, maxX: B.maxX + MARGIN, minZ: B.minZ - MARGIN, maxZ: B.maxZ + MARGIN,
};
const SW = SHEET.maxX - SHEET.minX; // 180
const SH = SHEET.maxZ - SHEET.minZ; // 140

export const INK_CSS = '#2b2118';
const PAPER = '#f8f1df';
const STREET = '#ffffff';
const MALL_RED = '#d98a74';
const PARK = '#8fd16a';
const PARK_EDGE = '#4f9a3e';
const SAND = '#efcf86';
const LAKE = '#4fb6c2';
const ROUTE_RED = '#d8342c';

/** A zebra crossing: centre, the road's direction there (radians, in the x/z plane) and the road width. */
export interface Zebra {
  x: number;
  z: number;
  angle: number;
  width: number;
}

/** Is (x, z) clear of the river and of every landmark (for paint and street furniture alike)? */
export function clearOfSights(x: number, z: number, margin: number): boolean {
  if (riverDistance(x, z) < THAMES.width / 2 + margin) return false;
  for (const l of LANDMARKS) if (Math.hypot(x - l.at.x, z - l.at.z) < Math.min(l.radius, 9) + margin) return false;
  return true;
}

/** Distance from (x, z) to the Thames' centre line. */
export function riverDistance(x: number, z: number): number {
  return distanceToPath(THAMES.path, x, z);
}

export function distanceToPath(path: readonly Spot[], x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i];
    const b = path[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const t = Math.min(1, Math.max(0, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
  }
  return best;
}

/** The zebra crossings: one at the middle of each longer street segment, where it is dry and open. */
export const ZEBRAS: Zebra[] = ROADS.flatMap((r: Road) => {
  const out: Zebra[] = [];
  for (let i = 0; i + 1 < r.path.length; i++) {
    const a = r.path[i];
    const b = r.path[i + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 14) continue;
    const x = (a.x + b.x) / 2;
    const z = (a.z + b.z) / 2;
    if (!clearOfSights(x, z, 3)) continue;
    out.push({ x, z, angle: Math.atan2(b.z - a.z, b.x - a.x), width: r.width });
  }
  return out;
});

/** The sandy squares (Trafalgar's is drawn round Nelson and his lions). */
const TRAFALGAR_SQ: Box = { x: NELSON.x, z: NELSON.z, w: 16, d: 11 };
/** The compass rose's square (kept clear of street furniture). */
export const COMPASS = { x: 3, z: -32, r: 4.2 };
const SQUARES: Box[] = [TRAFALGAR_SQ, COVENT_GARDEN, BOROUGH, { x: COMPASS.x, z: COMPASS.z, w: 11, d: 10 }];
const CIRCLES = [
  { x: PICCADILLY_FOUNTAIN.x, z: PICCADILLY_FOUNTAIN.z, r: 6 },
  { x: VICTORIA_MEMORIAL.x, z: VICTORIA_MEMORIAL.z, r: 5 },
];
/** St James's Park's lake (painted, like the Serpentine: not swimming water). */
export const ST_JAMES_LAKE = { x: ST_JAMES.x + 1, z: ST_JAMES.z + 0.5, rx: 5.5, rz: 1.8, rot: 0.1 };
const SEA_SERPENT = { x: -66, z: 49 };
/** The tour: a gentle loop round the sights, in the order a guide would walk it. */
const TOUR = ['museum', 'palace', 'piccadilly', 'trafalgar', 'stpauls', 'gherkin', 'tower', 'towerbridge', 'shard', 'globe', 'eye', 'bigben'];

/** Pixels per metre: 14, or 10 where the GPU cannot take a texture that big. */
function pixelsPerMetre(maxTextureSize: number): number {
  return SW * 14 <= maxTextureSize ? 14 : SW * 10 <= maxTextureSize ? 10 : Math.floor(maxTextureSize / SW);
}

export function makePaperMap(maxAnisotropy: number, maxTextureSize: number): THREE.Mesh {
  const S = pixelsPerMetre(maxTextureSize);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(SW * S);
  canvas.height = Math.round(SH * S);
  const c = canvas.getContext('2d')!;
  const X = (x: number) => (x - SHEET.minX) * S;
  const Z = (z: number) => (z - SHEET.minZ) * S;
  const rng = new Rng(1666); // the Great Fire, for luck
  const poly = (path: readonly Spot[]) => {
    c.beginPath();
    path.forEach((p, i) => (i === 0 ? c.moveTo(X(p.x), Z(p.z)) : c.lineTo(X(p.x), Z(p.z))));
  };
  const rect = (b: Box) => [X(b.x - b.w / 2), Z(b.z - b.d / 2), b.w * S, b.d * S] as const;
  const roundRect = (b: Box, r: number) => {
    c.beginPath();
    c.roundRect(...rect(b), r * S);
  };
  const ellipse = (e: { x: number; z: number; rx: number; rz: number; rot: number }) => {
    c.beginPath();
    c.ellipse(X(e.x), Z(e.z), e.rx * S, e.rz * S, e.rot, 0, Math.PI * 2);
  };
  c.lineJoin = 'round';
  c.lineCap = 'round';

  // ---- the paper: cream, fibres, and the creases where the map was folded (4 × 3 panels)
  c.fillStyle = PAPER;
  c.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 26000; i++) {
    const v = rng.next();
    c.fillStyle = v < 0.45 ? 'rgba(120,90,50,0.07)' : v < 0.9 ? 'rgba(255,255,255,0.18)' : 'rgba(90,70,40,0.12)';
    const len = rng.range(1, 5);
    c.fillRect(rng.range(0, canvas.width), rng.range(0, canvas.height), len, rng.range(1, 2));
  }
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 3; j++) {
      // Each panel catches the light a little differently.
      const g = c.createLinearGradient(X(SHEET.minX + (i * SW) / 4), 0, X(SHEET.minX + ((i + 1) * SW) / 4), 0);
      const dark = (i + j) % 2 === 0;
      g.addColorStop(0, dark ? 'rgba(110,80,40,0.05)' : 'rgba(255,255,255,0.06)');
      g.addColorStop(1, dark ? 'rgba(255,255,255,0.04)' : 'rgba(110,80,40,0.06)');
      c.fillStyle = g;
      c.fillRect(X(SHEET.minX + (i * SW) / 4), Z(SHEET.minZ + (j * SH) / 3), (SW / 4) * S, (SH / 3) * S);
    }
  }
  c.lineWidth = 0.12 * S;
  c.strokeStyle = 'rgba(120,95,60,0.22)';
  for (let i = 1; i < 4; i++) {
    c.beginPath();
    c.moveTo(X(SHEET.minX + (i * SW) / 4), 0);
    c.lineTo(X(SHEET.minX + (i * SW) / 4), canvas.height);
    c.stroke();
  }
  for (let j = 1; j < 3; j++) {
    c.beginPath();
    c.moveTo(0, Z(SHEET.minZ + (j * SH) / 3));
    c.lineTo(canvas.width, Z(SHEET.minZ + (j * SH) / 3));
    c.stroke();
  }

  // ---- parks: flat bright green, a darker inked edge, footpaths, lakes, and drawn tree dots
  const parks: Box[] = [HYDE_PARK, ST_JAMES, SOUTH_BANK];
  for (const p of parks) {
    roundRect(p, 2);
    c.fillStyle = PARK;
    c.fill();
    c.lineWidth = 0.5 * S;
    c.strokeStyle = PARK_EDGE;
    c.stroke();
  }
  c.strokeStyle = SAND;
  c.lineWidth = 1.2 * S;
  c.beginPath(); // Hyde Park's paths: the Broad Walk, and one across the middle
  c.moveTo(X(HYDE_PARK.x - 14), Z(HYDE_PARK.z + 13));
  c.quadraticCurveTo(X(HYDE_PARK.x - 4), Z(HYDE_PARK.z - 10), X(HYDE_PARK.x + 14), Z(HYDE_PARK.z - 13));
  c.moveTo(X(HYDE_PARK.x - 15), Z(HYDE_PARK.z - 6));
  c.quadraticCurveTo(X(HYDE_PARK.x), Z(HYDE_PARK.z + 4), X(HYDE_PARK.x + 15), Z(HYDE_PARK.z + 8));
  c.moveTo(X(SOUTH_BANK.x - 10), Z(SOUTH_BANK.z));
  c.quadraticCurveTo(X(SOUTH_BANK.x), Z(SOUTH_BANK.z - 5), X(SOUTH_BANK.x + 10), Z(SOUTH_BANK.z + 2));
  c.stroke();
  for (const lake of [SERPENTINE, ST_JAMES_LAKE]) {
    ellipse(lake);
    c.fillStyle = LAKE;
    c.fill();
    c.lineWidth = 0.3 * S;
    c.strokeStyle = INK_CSS;
    c.stroke();
    // A couple of little white ripples.
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.lineWidth = 0.15 * S;
    for (let k = -1; k <= 1; k += 2) {
      const cx = X(lake.x + k * lake.rx * 0.35);
      const cz = Z(lake.z + k * 0.3);
      c.beginPath();
      c.moveTo(cx - 0.8 * S, cz);
      c.quadraticCurveTo(cx - 0.4 * S, cz - 0.35 * S, cx, cz);
      c.quadraticCurveTo(cx + 0.4 * S, cz + 0.35 * S, cx + 0.8 * S, cz);
      c.stroke();
    }
  }
  const treeDot = (x: number, z: number, r: number) => {
    c.beginPath();
    c.arc(X(x), Z(z), r * S, 0, Math.PI * 2);
    c.fillStyle = '#5daa45';
    c.fill();
    c.lineWidth = 0.12 * S;
    c.strokeStyle = '#2f6b2a';
    c.stroke();
    c.beginPath(); // a highlight, top-left, like a printed map's tree
    c.arc(X(x - r * 0.3), Z(z - r * 0.3), r * 0.35 * S, 0, Math.PI * 2);
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.fill();
  };
  const inLake = (x: number, z: number, e: typeof SERPENTINE) => {
    const dx = x - e.x;
    const dz = z - e.z;
    const ca = Math.cos(-e.rot);
    const sa = Math.sin(-e.rot);
    const u = dx * ca - dz * sa;
    const v = dx * sa + dz * ca;
    return (u / (e.rx + 1.5)) ** 2 + (v / (e.rz + 1.5)) ** 2 < 1;
  };
  for (const p of parks) {
    const n = Math.round((p.w * p.d) / 14);
    for (let i = 0; i < n; i++) {
      const x = rng.range(p.x - p.w / 2 + 1, p.x + p.w / 2 - 1);
      const z = rng.range(p.z - p.d / 2 + 1, p.z + p.d / 2 - 1);
      if (inLake(x, z, SERPENTINE) || inLake(x, z, ST_JAMES_LAKE)) continue;
      treeDot(x, z, rng.range(0.45, 0.8));
    }
  }

  // ---- sandy squares
  c.fillStyle = SAND;
  c.strokeStyle = 'rgba(43,33,24,0.55)';
  c.lineWidth = 0.18 * S;
  for (const b of SQUARES) {
    roundRect(b, 1);
    c.fill();
    c.stroke();
  }
  for (const s of CIRCLES) {
    c.beginPath();
    c.arc(X(s.x), Z(s.z), s.r * S, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }

  // ---- streets: an ink band, then the off-white road over it (the Mall is the famous red road)
  for (const r of ROADS) {
    poly(r.path);
    c.strokeStyle = INK_CSS;
    c.lineWidth = (r.width + 0.5) * S;
    c.stroke();
  }
  for (const r of ROADS) {
    poly(r.path);
    c.strokeStyle = r.id === 'mall' ? MALL_RED : STREET;
    c.lineWidth = r.width * S;
    c.stroke();
  }
  c.setLineDash([1.2 * S, 1.4 * S]); // a faint centre line
  c.strokeStyle = 'rgba(43,33,24,0.18)';
  c.lineWidth = 0.12 * S;
  for (const r of ROADS) {
    poly(r.path);
    c.stroke();
  }
  c.setLineDash([]);

  // ---- zebra crossings: white bars along the road, edged with ink so they show on off-white
  for (const zb of ZEBRAS) {
    c.save();
    c.translate(X(zb.x), Z(zb.z));
    c.rotate(zb.angle);
    const bars = Math.floor(zb.width / 0.8);
    for (let i = 0; i < bars; i++) {
      const y = (-zb.width / 2 + 0.4 + i * 0.8 + 0.1) * S;
      c.fillStyle = INK_CSS;
      c.fillRect(-1.1 * S, y - 0.05 * S, 2.2 * S, 0.5 * S);
      c.fillStyle = '#ffffff';
      c.fillRect(-1 * S, y, 2 * S, 0.4 * S);
    }
    c.restore();
  }

  // ---- the compass rose in its square
  paintCompass(c, X(COMPASS.x), Z(COMPASS.z), COMPASS.r * S);

  // ---- the dotted red tour route, curving gently from sight to sight
  const stops = TOUR.map((id) => LANDMARKS.find((l) => l.id === id)!.at);
  c.setLineDash([0.5 * S, 0.9 * S]);
  c.strokeStyle = ROUTE_RED;
  c.lineWidth = 0.45 * S;
  c.beginPath();
  c.moveTo(X(stops[0].x), Z(stops[0].z));
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    // Bow each leg a little to the right of travel, like a hand-drawn line.
    const mx = (a.x + b.x) / 2 - (b.z - a.z) * 0.12;
    const mz = (a.z + b.z) / 2 + (b.x - a.x) * 0.12;
    c.quadraticCurveTo(X(mx), Z(mz), X(b.x), Z(b.z));
  }
  c.stroke();
  c.setLineDash([]);
  for (const s of stops) {
    c.beginPath();
    c.arc(X(s.x), Z(s.z), 0.7 * S, 0, Math.PI * 2);
    c.fillStyle = ROUTE_RED;
    c.fill();
  }

  // ---- "here be snakes": a sea serpent in a patch of drawn sea, bottom left, like an old map
  paintSerpent(c, X(SEA_SERPENT.x), Z(SEA_SERPENT.z), S);

  // ---- the river: an ink bank line, then cut the water out of the paper (water.ts fills it)
  const riverPath = extendedRiver();
  poly(riverPath);
  c.strokeStyle = INK_CSS;
  c.lineCap = 'butt';
  c.lineWidth = (THAMES.width + 0.7) * S;
  c.stroke();
  c.globalCompositeOperation = 'destination-out';
  poly(riverPath);
  c.lineWidth = THAMES.width * S;
  c.stroke();
  c.globalCompositeOperation = 'source-over';
  c.lineCap = 'round';

  // ---- the border: a darker margin, a double ink frame, the cartouche and a scale bar
  c.fillStyle = 'rgba(160,120,60,0.16)';
  c.fillRect(0, 0, canvas.width, MARGIN * S);
  c.fillRect(0, canvas.height - MARGIN * S, canvas.width, MARGIN * S);
  c.fillRect(0, MARGIN * S, MARGIN * S, canvas.height - 2 * MARGIN * S);
  c.fillRect(canvas.width - MARGIN * S, MARGIN * S, MARGIN * S, canvas.height - 2 * MARGIN * S);
  c.strokeStyle = INK_CSS;
  c.lineWidth = 0.45 * S;
  c.strokeRect(X(B.minX), Z(B.minZ), (B.maxX - B.minX) * S, (B.maxZ - B.minZ) * S);
  c.lineWidth = 0.15 * S;
  c.strokeRect(X(B.minX - 1), Z(B.minZ - 1), (B.maxX - B.minX + 2) * S, (B.maxZ - B.minZ + 2) * S);
  // Little red-white-blue ticks round the frame, like the edge of a souvenir map.
  const tick = ['#c8102e', '#ffffff', '#012169'];
  for (let x = B.minX, k = 0; x < B.maxX; x += 3, k++) {
    c.fillStyle = tick[k % 3];
    c.fillRect(X(x), Z(B.minZ - 2.2), 3 * S, 0.6 * S);
    c.fillRect(X(x), Z(B.maxZ + 1.6), 3 * S, 0.6 * S);
  }
  // The cartouche: LONDON, in the bottom margin, on a ribbon.
  paintCartouche(c, X(0), Z(B.maxZ + MARGIN / 2 + 0.2), S);
  // The scale bar, bottom right: alternating ink and paper blocks.
  for (let i = 0; i < 4; i++) {
    c.fillStyle = i % 2 === 0 ? INK_CSS : '#fffaf0';
    c.fillRect(X(B.maxX - 24 + i * 5), Z(B.maxZ + 2.6), 5 * S, 0.8 * S);
  }
  c.strokeStyle = INK_CSS;
  c.lineWidth = 0.12 * S;
  c.strokeRect(X(B.maxX - 24), Z(B.maxZ + 2.6), 20 * S, 0.8 * S);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  // Once it is on the GPU the CPU copy is ~18 MB of nothing: shrink the canvas so it can be freed.
  texture.onUpdate = () => {
    canvas.width = canvas.height = 1;
    texture.onUpdate = null;
  };
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshLambertMaterial({ map: texture, alphaTest: 0.5 }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set((SHEET.minX + SHEET.maxX) / 2, 0, (SHEET.minZ + SHEET.maxZ) / 2);
  mesh.receiveShadow = true;
  return mesh;
}

/** The Thames' centre line, run on past the map's ends to the sheet's edge. */
export function extendedRiver(): Spot[] {
  const p = THAMES.path;
  const ext = (a: Spot, b: Spot): Spot => {
    const d = Math.hypot(a.x - b.x, a.z - b.z);
    return { x: a.x + ((a.x - b.x) / d) * (MARGIN + 1), z: a.z + ((a.z - b.z) / d) * (MARGIN + 1) };
  };
  return [ext(p[0], p[1]), ...p, ext(p[p.length - 1], p[p.length - 2])];
}

function paintCompass(c: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  c.save();
  c.translate(cx, cy);
  c.beginPath();
  c.arc(0, 0, r, 0, Math.PI * 2);
  c.fillStyle = '#fffaf0';
  c.fill();
  c.lineWidth = r * 0.04;
  c.strokeStyle = INK_CSS;
  c.stroke();
  c.beginPath();
  c.arc(0, 0, r * 0.82, 0, Math.PI * 2);
  c.lineWidth = r * 0.015;
  c.stroke();
  // Eight points: the long four in navy and red, the short four in gold.
  const point = (angle: number, len: number, w: number, a: string, b: string) => {
    c.save();
    c.rotate(angle);
    c.beginPath();
    c.moveTo(0, -len);
    c.lineTo(w, 0);
    c.lineTo(0, 0);
    c.closePath();
    c.fillStyle = a;
    c.fill();
    c.beginPath();
    c.moveTo(0, -len);
    c.lineTo(-w, 0);
    c.lineTo(0, 0);
    c.closePath();
    c.fillStyle = b;
    c.fill();
    c.beginPath();
    c.moveTo(0, -len);
    c.lineTo(w, 0);
    c.lineTo(-w, 0);
    c.closePath();
    c.lineWidth = r * 0.02;
    c.strokeStyle = INK_CSS;
    c.stroke();
    c.restore();
  };
  for (let i = 0; i < 4; i++) point(Math.PI / 4 + (i * Math.PI) / 2, r * 0.55, r * 0.12, '#f2c230', '#c99a1a');
  for (let i = 0; i < 4; i++) point((i * Math.PI) / 2, r * 0.8, r * 0.16, i === 0 ? '#d8342c' : '#1f3264', i === 0 ? '#9e1f1a' : '#121e40');
  c.beginPath();
  c.arc(0, 0, r * 0.07, 0, Math.PI * 2);
  c.fillStyle = INK_CSS;
  c.fill();
  // N at the top (north is up the screen), the others small.
  c.fillStyle = INK_CSS;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = `900 ${r * 0.34}px ui-rounded, 'Arial Rounded MT Bold', system-ui, sans-serif`;
  c.fillText('N', 0, -r * 0.93 - r * 0.12);
  c.font = `800 ${r * 0.18}px ui-rounded, 'Arial Rounded MT Bold', system-ui, sans-serif`;
  c.fillText('S', 0, r * 0.91);
  c.fillText('E', r * 0.91, 0);
  c.fillText('W', -r * 0.91, 0);
  c.restore();
}

function paintSerpent(c: CanvasRenderingContext2D, cx: number, cy: number, S: number): void {
  c.save();
  c.translate(cx, cy);
  // A patch of drawn sea: rows of little ink waves.
  c.strokeStyle = 'rgba(31,100,130,0.55)';
  c.lineWidth = 0.14 * S;
  for (let row = -2; row <= 2; row++) {
    for (let k = -4; k <= 4; k++) {
      const x = (k * 2.4 + (row % 2) * 1.2) * S;
      const y = (row * 1.6 + 0.6) * S;
      c.beginPath();
      c.moveTo(x - 0.7 * S, y);
      c.quadraticCurveTo(x - 0.35 * S, y - 0.4 * S, x, y);
      c.quadraticCurveTo(x + 0.35 * S, y + 0.4 * S, x + 0.7 * S, y);
      c.stroke();
    }
  }
  // Three green humps rising out of the sea, and a tail curl.
  const body = '#5fae4a';
  c.lineWidth = 0.18 * S;
  c.strokeStyle = INK_CSS;
  for (const [hx, hr] of [[-3.2, 1.3], [-0.4, 1.5], [2.4, 1.2]] as const) {
    c.beginPath();
    c.arc(hx * S, 0.3 * S, hr * S, Math.PI, 0);
    c.lineTo((hx + hr * 0.55) * S, 0.3 * S);
    c.arc(hx * S, 0.3 * S, hr * 0.45 * S, 0, Math.PI, true);
    c.closePath();
    c.fillStyle = body;
    c.fill();
    c.stroke();
  }
  c.beginPath(); // the tail
  c.moveTo(-5.4 * S, 0.3 * S);
  c.quadraticCurveTo(-6.6 * S, -1.6 * S, -5.4 * S, -1.9 * S);
  c.quadraticCurveTo(-4.9 * S, -1.6 * S, -5.3 * S, -1.2 * S);
  c.lineWidth = 0.4 * S;
  c.strokeStyle = body;
  c.stroke();
  // The head: up out of the water, an eye, a forked red tongue.
  c.beginPath();
  c.moveTo(4.1 * S, 0.3 * S);
  c.quadraticCurveTo(4.2 * S, -2.2 * S, 5.6 * S, -2.3 * S);
  c.quadraticCurveTo(6.9 * S, -2.2 * S, 6.8 * S, -1.5 * S);
  c.quadraticCurveTo(5.8 * S, -1.2 * S, 5.2 * S, 0.3 * S);
  c.closePath();
  c.fillStyle = body;
  c.fill();
  c.lineWidth = 0.18 * S;
  c.strokeStyle = INK_CSS;
  c.stroke();
  c.beginPath();
  c.arc(5.5 * S, -1.95 * S, 0.22 * S, 0, Math.PI * 2);
  c.fillStyle = '#ffffff';
  c.fill();
  c.stroke();
  c.beginPath();
  c.arc(5.55 * S, -1.95 * S, 0.09 * S, 0, Math.PI * 2);
  c.fillStyle = INK_CSS;
  c.fill();
  c.beginPath();
  c.moveTo(6.8 * S, -1.6 * S);
  c.lineTo(7.6 * S, -1.7 * S);
  c.moveTo(7.6 * S, -1.7 * S);
  c.lineTo(7.95 * S, -1.95 * S);
  c.moveTo(7.6 * S, -1.7 * S);
  c.lineTo(7.95 * S, -1.45 * S);
  c.lineWidth = 0.12 * S;
  c.strokeStyle = '#d8342c';
  c.stroke();
  // The legend, in old-map italics.
  c.fillStyle = INK_CSS;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = `italic 700 ${1.5 * S}px Georgia, 'Times New Roman', serif`;
  c.fillText('Here be snakes', 0.5 * S, 5.4 * S);
  c.restore();
}

function paintCartouche(c: CanvasRenderingContext2D, cx: number, cy: number, S: number): void {
  c.save();
  c.translate(cx, cy);
  const w = 26 * S;
  const h = 3.6 * S;
  // Folded ribbon ends, a shade darker, behind the main band.
  c.fillStyle = '#b8282a';
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo((s * w) / 2 - s * 2 * S, -h / 2 + 0.6 * S);
    c.lineTo((s * w) / 2 + s * 3 * S, -h / 2 + 0.6 * S);
    c.lineTo((s * w) / 2 + s * 1.8 * S, 0.6 * S);
    c.lineTo((s * w) / 2 + s * 3 * S, h / 2 + 0.6 * S);
    c.lineTo((s * w) / 2 - s * 2 * S, h / 2 + 0.6 * S);
    c.closePath();
    c.fill();
    c.lineWidth = 0.15 * S;
    c.strokeStyle = INK_CSS;
    c.stroke();
  }
  c.beginPath();
  c.roundRect(-w / 2, -h / 2, w, h, 0.4 * S);
  c.fillStyle = '#d8342c';
  c.fill();
  c.lineWidth = 0.18 * S;
  c.strokeStyle = INK_CSS;
  c.stroke();
  c.fillStyle = '#fffaf0';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = `900 ${2.8 * S}px ui-rounded, 'Arial Rounded MT Bold', system-ui, sans-serif`;
  c.fillText('LONDON', 0, 0.15 * S);
  c.restore();
}
