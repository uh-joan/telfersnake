import * as THREE from 'three';
import { PALACE, VICTORIA_MEMORIAL } from '../../../sim/londonLayout';
import { box, cone, cyl, extrude, inked, PALETTE, rel, sphere, windows, type LandmarkBuild } from './kit';

/**
 * Buckingham Palace + the Victoria Memorial. The long cream front faces the camera (south) across a
 * narrow forecourt: rows of windows, the columned centre with its pediment, the balcony with its red
 * drape, black-and-gold railings and gates, two red sentry boxes with a guard in each. The Union flag
 * flutters on the roof. East, at the end of the Mall, the white marble memorial carries the golden
 * winged angel. Everything stands inside the sim footprints (PALACE box, VICTORIA_MEMORIAL circle).
 */

const STONE_TRIM = 0xe3d5b4;
const WINDOW = 0x46566b;
const CRIMSON = 0xb3122a;
const RAIL_BLACK = 0x1d1d22;
const MARBLE = 0xf4f2ea;
const LEAD = 0x9aa1a8;

// ---------------------------------------------------------------- the Union flag (shared with Tower Bridge)

let unionTexture: THREE.CanvasTexture | null = null;
function unionJack(): THREE.CanvasTexture {
  if (unionTexture) return unionTexture;
  const c = document.createElement('canvas');
  c.width = 120;
  c.height = 60;
  const g = c.getContext('2d')!;
  g.fillStyle = '#012169';
  g.fillRect(0, 0, 120, 60);
  g.lineCap = 'butt';
  const diag = (w: number, col: string) => {
    g.strokeStyle = col;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(120, 60);
    g.moveTo(120, 0);
    g.lineTo(0, 60);
    g.stroke();
  };
  diag(12, '#ffffff');
  diag(4, '#c8102e');
  g.fillStyle = '#ffffff';
  g.fillRect(50, 0, 20, 60);
  g.fillRect(0, 20, 120, 20);
  g.fillStyle = '#c8102e';
  g.fillRect(54, 0, 12, 60);
  g.fillRect(0, 24, 120, 12);
  unionTexture = new THREE.CanvasTexture(c);
  unionTexture.colorSpace = THREE.SRGBColorSpace;
  return unionTexture;
}

export interface Flag {
  mesh: THREE.Mesh;
  /** Ripple the cloth: t = seconds. */
  wave(t: number): void;
}

/**
 * A Union flag w × h flying east from a pole at the mesh's origin (its hoist edge on x = 0, centred
 * on y). One draw call; `wave` ripples the cloth more toward the fly end.
 */
export function unionFlag(w: number, h: number, phase = 0): Flag {
  const geo = new THREE.PlaneGeometry(w, h, 12, 1);
  geo.translate(w / 2, 0, 0);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const base = Float32Array.from(pos.array as Float32Array);
  const mat = new THREE.MeshLambertMaterial({ map: unionJack(), side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return {
    mesh,
    wave(t) {
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3];
        const k = x / w;
        pos.setZ(i, Math.sin(x * 2.6 - t * 7 + phase) * 0.22 * w * 0.25 * k);
        pos.setY(i, base[i * 3 + 1] - k * k * 0.08 * h + Math.sin(t * 5 + x + phase) * 0.03 * k);
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    },
  };
}

// ---------------------------------------------------------------- the palace

export function build(): LandmarkBuild {
  const parts: THREE.BufferGeometry[] = [];
  const gold: THREE.BufferGeometry[] = [];

  // The block: 15.6 m of cream front, set back so the forecourt (railings, sentries) stays in the footprint.
  const W = PALACE.w - 0.4; // 15.6
  const back = -PALACE.d / 2 + 0.1; // -2.9
  const front = 1.3;
  const D = front - back;
  const zc = (front + back) / 2;
  const H = 6.2;
  parts.push(
    box(W + 0.2, 0.6, D + 0.2, STONE_TRIM, 0, 0, zc), // the rusticated ground course
    box(W, H, D, PALETTE.palaceCream, 0, 0, zc),
    box(W + 0.3, 0.3, D + 0.3, STONE_TRIM, 0, H, zc), // the cornice
    box(W, 0.6, D, PALETTE.palaceCream, 0, H + 0.3, zc), // the attic balustrade
    box(W - 0.8, 0.5, D - 0.8, LEAD, 0, H + 0.3, zc), // the grey roof behind it
  );
  // Balustrade posts along the front, so the skyline is fretted, not flat.
  for (let x = -W / 2 + 0.4; x <= W / 2 - 0.4; x += 0.8) parts.push(box(0.22, 0.25, 0.22, STONE_TRIM, x, H + 0.9, front - 0.12));

  // The end pavilions and the columned centre stand proud of the front.
  const PAV = 2.4;
  const CEN = 5;
  for (const s of [-1, 1]) {
    const px = s * (W / 2 - PAV / 2);
    parts.push(box(PAV, H, 0.4, PALETTE.palaceCream, px, 0, front + 0.2), box(PAV + 0.1, 0.3, 0.5, STONE_TRIM, px, H, front + 0.2));
    parts.push(windows({ cols: 2, rows: 3, cellW: 1.05, cellH: 1.75, winW: 0.5, winH: 1.0, color: WINDOW, x: px, y: 0.7, z: front + 0.4 }));
    // The wings between them.
    const wx = s * (CEN / 2 + (W / 2 - PAV - CEN / 2) / 2);
    parts.push(windows({ cols: 3, rows: 3, cellW: 0.95, cellH: 1.75, winW: 0.48, winH: 1.0, color: WINDOW, x: wx, y: 0.7, z: front }));
  }
  const cz = front + 0.5; // the centre's face
  parts.push(box(CEN, H + 0.3, 0.5, PALETTE.palaceCream, 0, 0, front + 0.25));
  parts.push(windows({ cols: 4, rows: 2, cellW: 1.15, cellH: 1.75, winW: 0.5, winH: 1.0, color: WINDOW, x: 0, y: 0.7, z: cz }));
  // Six columns on the upper storey, and the pediment over them.
  for (let i = 0; i < 6; i++) {
    const x = (i - 2.5) * 0.9;
    parts.push(cyl(0.17, 0.19, 2.6, PALETTE.white, x, 3.9, cz + 0.25, 10), box(0.42, 0.2, 0.42, STONE_TRIM, x, 6.4, cz + 0.25));
  }
  parts.push(box(CEN + 0.2, 0.3, 0.9, STONE_TRIM, 0, H + 0.3, front + 0.45));
  const ped = new THREE.Shape();
  ped.moveTo(-CEN / 2 - 0.1, 0);
  ped.lineTo(CEN / 2 + 0.1, 0);
  ped.lineTo(0, 1.3);
  ped.closePath();
  parts.push(extrude(ped, 0.9, PALETTE.palaceCream, 0, H + 0.6, front + 0.45));
  gold.push(sphere(0.25, PALETTE.gold, 0, H + 0.8, front + 0.95, 10, 8)); // the royal crest in the tympanum

  // The balcony (the one the Royal Family waves from) and its crimson drape with a gold fringe.
  parts.push(
    box(3.4, 0.22, 1.1, STONE_TRIM, 0, 3.6, cz + 0.5),
    box(3.4, 0.5, 0.12, STONE_TRIM, 0, 3.82, cz + 1.0),
    box(3.0, 0.85, 0.08, CRIMSON, 0, 2.8, cz + 1.08),
  );
  gold.push(box(3.0, 0.1, 0.1, PALETTE.gold, 0, 2.75, cz + 1.1), box(3.42, 0.08, 0.14, PALETTE.gold, 0, 4.3, cz + 1.0));
  parts.push(box(1.6, 1.4, 0.1, 0x3a2a24, 0, 3.82, cz + 0.02)); // the balcony doors

  // The flagpole on the centre of the roof.
  parts.push(cyl(0.07, 0.09, 4.6, PALETTE.white, 0, H + 0.8, zc, 6));
  gold.push(sphere(0.16, PALETTE.gold, 0, H + 5.5, zc, 8, 6));

  // The railings: black bars with gold tips along the forecourt, a gold-and-black gate in the middle.
  const rz = PALACE.d / 2 - 0.15;
  const gateW = 2.6;
  for (const s of [-1, 1]) {
    const x0 = s * (gateW / 2 + 0.35);
    const x1 = s * (PALACE.w / 2 - 0.1);
    parts.push(box(Math.abs(x1 - x0), 0.08, 0.08, RAIL_BLACK, (x0 + x1) / 2, 1.15, rz), box(Math.abs(x1 - x0), 0.08, 0.08, RAIL_BLACK, (x0 + x1) / 2, 0.25, rz));
    for (let x = Math.min(x0, x1) + 0.15; x <= Math.max(x0, x1); x += 0.42) {
      parts.push(box(0.06, 1.25, 0.06, RAIL_BLACK, x, 0, rz));
      gold.push(cone(0.08, 0.2, PALETTE.gold, x, 1.25, rz, 4));
    }
    // The gate piers: cream stone with a gold ball.
    parts.push(box(0.55, 2.3, 0.55, PALETTE.palaceCream, s * (gateW / 2 + 0.28), 0, rz), box(0.65, 0.15, 0.65, STONE_TRIM, s * (gateW / 2 + 0.28), 2.3, rz));
    gold.push(sphere(0.22, PALETTE.gold, s * (gateW / 2 + 0.28), 2.65, rz, 10, 8));
    // The corner piers.
    parts.push(box(0.4, 1.5, 0.4, PALETTE.palaceCream, x1 - s * 0.1, 0, rz));
  }
  // The gate itself: black bars, a gold band, a gold arch and the crest.
  for (let x = -gateW / 2 + 0.15; x <= gateW / 2; x += 0.26) parts.push(box(0.06, 1.8, 0.06, RAIL_BLACK, x, 0, rz));
  gold.push(box(gateW, 0.14, 0.1, PALETTE.gold, 0, 1.0, rz), box(gateW, 0.1, 0.1, PALETTE.gold, 0, 1.8, rz));
  const arch = new THREE.Shape();
  arch.moveTo(-gateW / 2, 0);
  arch.quadraticCurveTo(0, 1.1, gateW / 2, 0);
  arch.lineTo(gateW / 2 - 0.2, 0);
  arch.quadraticCurveTo(0, 0.8, -gateW / 2 + 0.2, 0);
  arch.closePath();
  gold.push(extrude(arch, 0.1, PALETTE.gold, 0, 1.85, rz));
  gold.push(cyl(0.38, 0.38, 0.1, PALETTE.gold, 0, 0, 0, 16).rotateX(Math.PI / 2).translate(0, 2.25, rz - 0.05));

  // Two red sentry boxes in the forecourt, open to the south, a guard in a bearskin in each.
  for (const s of [-1, 1]) {
    const x = s * 3.6;
    const z = 2.15;
    parts.push(
      box(1.0, 1.9, 0.1, PALETTE.guardRed, x, 0, z - 0.4),
      box(0.1, 1.9, 0.8, PALETTE.guardRed, x - 0.45, 0, z),
      box(0.1, 1.9, 0.8, PALETTE.guardRed, x + 0.45, 0, z),
      box(1.0, 0.1, 0.9, PALETTE.white, x, 0, z),
      cone(0.78, 0.5, PALETTE.guardRed, 0, 0, 0, 4).rotateY(Math.PI / 4).translate(x, 1.9, z),
      box(1.1, 0.08, 1.0, PALETTE.white, x, 1.86, z),
      // The guard: black trousers, red tunic, a peach face under the tall black bearskin.
      box(0.34, 0.6, 0.24, RAIL_BLACK, x, 0.1, z + 0.05),
      box(0.42, 0.55, 0.28, PALETTE.guardRed, x, 0.7, z + 0.05),
      box(0.43, 0.06, 0.29, PALETTE.white, x, 0.98, z + 0.05),
      sphere(0.13, 0xf3c9a0, x, 1.38, z + 0.06, 10, 8),
      cyl(0.17, 0.15, 0.5, RAIL_BLACK, x, 1.42, z + 0.04, 10),
    );
  }

  // ---- the Victoria Memorial: white marble steps, a tall pedestal, the golden winged Victory.
  const m = rel('palace', VICTORIA_MEMORIAL.x, VICTORIA_MEMORIAL.z);
  const R = VICTORIA_MEMORIAL.r;
  parts.push(
    cyl(R, R, 0.3, MARBLE, m.x, 0, m.z, 24),
    cyl(R - 0.15, R - 0.15, 0.08, 0x6fd0cf, m.x, 0.3, m.z, 24), // the fountain pool
    cyl(R - 0.5, R - 0.4, 0.5, MARBLE, m.x, 0.3, m.z, 20),
    box(1.8, 0.4, 1.8, 0xe8e4d8, m.x, 0.8, m.z),
    box(1.5, 3.0, 1.5, MARBLE, m.x, 1.2, m.z),
    box(1.75, 0.25, 1.75, 0xe8e4d8, m.x, 4.2, m.z),
    cyl(0.55, 0.7, 1.0, MARBLE, m.x, 4.45, m.z, 12),
  );
  // Victoria herself, seated on the west face (looking at her palace), a small white figure.
  parts.push(box(0.7, 0.6, 0.5, MARBLE, m.x - 0.95, 1.2, m.z), sphere(0.22, MARBLE, m.x - 1.0, 2.05, m.z, 8, 6), cone(0.38, 0.75, MARBLE, m.x - 1.0, 1.3, m.z, 8));
  // The gilded Victory, oversized so she shines from across the map: robe, body, head, a laurel
  // wreath held up high, two big swept wings. Built at her feet's origin, then scaled up onto the column.
  const top = 5.45;
  const angel: THREE.BufferGeometry[] = [
    cyl(0.5, 0.55, 0.2, PALETTE.gold, 0, 0, 0, 12), // the globe-plinth she stands on
    cone(0.55, 1.5, PALETTE.gold, 0, 0.15, 0, 12),
    cyl(0.2, 0.28, 0.6, PALETTE.gold, 0, 1.35, 0, 10),
    sphere(0.24, PALETTE.gold, 0, 2.15, 0, 12, 10),
    box(0.13, 0.9, 0.13, PALETTE.gold, 0.25, 1.85, 0.05).rotateZ(0),
    paint(new THREE.TorusGeometry(0.24, 0.07, 6, 14).translate(0.25, 2.98, 0.05), PALETTE.gold),
  ];
  for (const s of [-1, 1]) {
    // Each wing drawn already mirrored (a scale(-1) would turn its faces inside out).
    const wing = new THREE.Shape();
    wing.moveTo(0, 0);
    wing.quadraticCurveTo(s * 0.9, 0.1, s * 1.7, 1.7);
    wing.quadraticCurveTo(s * 1.4, 1.45, s * 1.15, 1.45);
    wing.quadraticCurveTo(s * 1.25, 1.05, s * 0.95, 0.65);
    wing.quadraticCurveTo(s * 0.65, 0.65, s * 0.55, 0.4);
    wing.quadraticCurveTo(s * 0.25, 0.3, 0, 0.35);
    wing.closePath();
    const g = new THREE.ExtrudeGeometry(wing, { depth: 0.16, bevelEnabled: false, curveSegments: 6 });
    g.rotateY(s * 0.3);
    g.translate(s * 0.12, 1.45, -0.22);
    angel.push(paint(g, PALETTE.gold));
  }
  for (const g of angel) gold.push(g.scale(1.6, 1.6, 1.6).translate(m.x, top, m.z));

  const group = new THREE.Group();
  group.add(inked(parts, 0.07), inked(gold, 0.05, { glow: 0.25 }));

  const flag = unionFlag(2.4, 1.3);
  flag.mesh.position.set(0, H + 4.6, zc);
  group.add(flag.mesh);

  return { group, tall: true, labelY: H + 7, animate: (t) => flag.wave(t) };
}

/** A built-in geometry made kit-shaped (non-indexed, position + normal + colour), for the odd torus or wing. */
export function paint(geo: THREE.BufferGeometry, color: number): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  g.clearGroups();
  const c = new THREE.Color(color);
  const n = g.getAttribute('position').count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}
