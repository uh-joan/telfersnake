import * as THREE from 'three';
import { TOWER } from '../../../sim/londonLayout';
import {
  box, cone, crenellations, cyl, extrude, inkMaterial, inked, lathe, merge, outlineGeometry, PALETTE, sphere, toonMaterial,
  windows, type LandmarkBuild,
} from './kit';

/**
 * The Tower of London: a castle. The WHITE square keep (the White Tower) with a turret at each corner,
 * each capped by a little lead onion dome and a gold weathervane; a crenellated grey curtain wall with
 * round towers and a dark gate on the river side; a green moat lawn round the other three sides; and
 * the legend: six black ravens on the walls, hopping and pecking (one instanced mesh + its outline).
 */

const KEEP = 0xf6f3ea;
const KEEP_SHADE = 0xded7c6;
const WALL = 0xbdb3a0;
const WALL_TOP = 0xa79d89;
const LEAD = 0x6b7482;
const DARK = 0x2f2f38;
const RAVEN = 0x22232c;
const BEAK = 0x4c4d58;

/** A round wall tower, crenellated, standing on the ground at (x, z). */
function roundTower(x: number, z: number, r: number, h: number): THREE.BufferGeometry[] {
  const p = [cyl(r, r + 0.1, h, WALL, x, 0, z, 14), cyl(r + 0.12, r + 0.12, 0.25, WALL_TOP, x, h, z, 14)];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    p.push(box(0.5, 0.5, 0.4, WALL, 0, 0, 0).rotateY(a).translate(x + Math.sin(a) * (r - 0.1), h + 0.25, z + Math.cos(a) * (r - 0.1)));
  }
  return p;
}

/** An onion cupola of lead with a gold weathervane, standing on y. */
function cupola(x: number, y: number, z: number): THREE.BufferGeometry[] {
  return [
    lathe([[0.85, 0], [0.95, 0.25], [0.95, 0.55], [0.7, 0.95], [0.35, 1.25], [0.14, 1.5], [0.08, 1.75], [0, 1.8]], LEAD, x, y, z, 14),
    cyl(0.04, 0.04, 1.0, PALETTE.gold, x, y + 1.75, z, 5),
    sphere(0.13, PALETTE.gold, x, y + 1.95, z, 8, 6),
    box(0.55, 0.3, 0.05, PALETTE.gold, x + 0.3, y + 2.25, z),
    cone(0.12, 0.25, PALETTE.gold, x, y + 2.7, z, 6),
  ];
}

export function build(): LandmarkBuild {
  const { w, d } = TOWER;
  const T = 0.9; // wall thickness
  const WH = 3.2; // wall height
  const parts: THREE.BufferGeometry[] = [];

  // ---- the curtain wall, its battlements, and the courtyard lawn
  parts.push(
    box(w, WH, T, WALL, 0, 0, -d / 2 + T / 2),
    box(w, WH, T, WALL, 0, 0, d / 2 - T / 2),
    box(T, WH, d, WALL, -w / 2 + T / 2, 0, 0),
    box(T, WH, d, WALL, w / 2 - T / 2, 0, 0),
    crenellations(w, d, WALL, 0, WH, 0, 0.5),
    box(w - 2 * T, 0.08, d - 2 * T, PALETTE.park, 0, 0, 0),
  );
  // round towers at the corners and halfway along the east and west walls
  for (const [x, z] of [[-w / 2 + 0.6, -d / 2 + 0.6], [w / 2 - 0.6, -d / 2 + 0.6], [w / 2 - 0.6, d / 2 - 0.6], [-w / 2 + 0.6, d / 2 - 0.6]]) {
    parts.push(...roundTower(x, z, 1.25, 4.3));
  }
  parts.push(...roundTower(-w / 2 + 0.3, 0, 0.95, 3.9), ...roundTower(w / 2 - 0.3, 0, 0.95, 3.9));

  // the gatehouse on the river side: a square tower with a dark arch and a portcullis
  const gx = 3.6;
  const gz = d / 2 - 0.75;
  parts.push(box(3.2, 4.6, 1.5, WALL, gx, 0, gz), crenellations(3.2, 1.5, WALL, gx, 4.6, gz, 0.45));
  const arch = new THREE.Shape();
  arch.moveTo(-0.8, 0);
  arch.lineTo(0.8, 0);
  arch.lineTo(0.8, 1.4);
  arch.absarc(0, 1.4, 0.8, 0, Math.PI, false);
  arch.lineTo(-0.8, 0);
  parts.push(extrude(arch, 0.12, DARK, gx, 0, gz + 0.75));
  for (let i = 0; i < 4; i++) parts.push(box(0.07, 2.0, 0.06, PALETTE.gold, gx - 0.54 + i * 0.36, 0.1, gz + 0.84));
  parts.push(box(1.5, 0.07, 0.06, PALETTE.gold, gx, 0.9, gz + 0.84), box(1.5, 0.07, 0.06, PALETTE.gold, gx, 1.6, gz + 0.84));

  // ---- the White Tower: a white square keep, buttress strips, arched windows, battlements
  const kz = -0.6;
  const KW = 7.2;
  const KD = 6.2;
  const KH = 7.6;
  parts.push(
    box(KW, KH, KD, KEEP, 0, 0, kz),
    crenellations(KW, KD, KEEP, 0, KH, kz, 0.5),
    box(KW + 0.2, 0.25, KD + 0.2, KEEP_SHADE, 0, KH - 0.25, kz),
    windows({ cols: 4, rows: 3, cellW: 1.45, cellH: 2.1, winW: 0.5, winH: 1.0, color: DARK, x: 0, y: 0.9, z: kz + KD / 2, arched: true }),
    windows({ cols: 3, rows: 3, cellW: 1.5, cellH: 2.1, winW: 0.55, winH: 1.0, color: DARK, x: KW / 2, y: 0.9, z: kz, rotY: Math.PI / 2, arched: true }),
    windows({ cols: 3, rows: 3, cellW: 1.5, cellH: 2.1, winW: 0.55, winH: 1.0, color: DARK, x: -KW / 2, y: 0.9, z: kz, rotY: -Math.PI / 2, arched: true }),
  );
  for (const x of [-1.45, 1.45]) parts.push(box(0.35, KH - 0.3, 0.2, KEEP_SHADE, x, 0, kz + KD / 2));
  // the four corner turrets (the north-east one round, as on the real keep), each with its cupola
  const TH = KH + 2.3;
  for (const [x, z] of [[-KW / 2, kz - KD / 2], [KW / 2, kz - KD / 2], [KW / 2, kz + KD / 2], [-KW / 2, kz + KD / 2]]) {
    if (x > 0 && z < kz) parts.push(cyl(0.95, 0.95, TH, KEEP, x, 0, z, 14));
    else parts.push(box(1.7, TH, 1.7, KEEP, x, 0, z));
    parts.push(cyl(1.0, 1.0, 0.3, KEEP_SHADE, x, TH, z, 14), ...cupola(x, TH + 0.3, z));
  }
  // the keep's door, on the south side where the players see it
  const door = new THREE.Shape();
  door.moveTo(-0.4, 0);
  door.lineTo(0.4, 0);
  door.lineTo(0.4, 1.0);
  door.absarc(0, 1.0, 0.4, 0, Math.PI, false);
  door.lineTo(-0.4, 0);
  parts.push(box(1.4, 0.3, 0.8, KEEP_SHADE, 0, 0, kz + KD / 2 + 0.4), extrude(door, 0.1, PALETTE.timber, 0, 0.3, kz + KD / 2 + 0.03));

  // ---- the moat: a green lawn round the west, north and east (the river road runs along the south)
  const M = 1.6;
  parts.push(
    box(w + 2 * M, 0.05, M, PALETTE.park, 0, 0, -d / 2 - M / 2),
    box(M, 0.05, d, PALETTE.park, -w / 2 - M / 2, 0, 0),
    box(M, 0.05, d, PALETTE.park, w / 2 + M / 2, 0, 0),
  );

  const group = new THREE.Group();
  group.add(inked(parts, 0.1));

  // ---- the ravens: six, instanced, on the wall walks (and one on the lawn)
  const ravenGeo = merge([
    sphere(0.28, RAVEN, 0, 0, 0, 10, 8).scale(0.8, 0.85, 1.4).translate(0, 0.38, 0),
    sphere(0.18, RAVEN, 0, 0.66, 0.32, 8, 6),
    cone(0.07, 0.3, BEAK, 0, 0, 0, 6).rotateX(Math.PI / 2).translate(0, 0.62, 0.45),
    sphere(0.045, PALETTE.white, 0.12, 0.7, 0.4, 6, 4),
    sphere(0.045, PALETTE.white, -0.12, 0.7, 0.4, 6, 4),
    box(0.22, 0.05, 0.4, RAVEN, 0, 0.32, -0.5).rotateX(-0.3),
    cyl(0.03, 0.03, 0.18, BEAK, 0.08, 0, 0.02, 4),
    cyl(0.03, 0.03, 0.18, BEAK, -0.08, 0, 0.02, 4),
  ]).scale(1.6, 1.6, 1.6);
  const walk = (wall: number) => wall - T * 0.3; // on the inner half of the wall walk, clear of the merlons
  const RAVENS = [
    { x: -1.2, y: WH, z: walk(d / 2), h: 0.4 },
    { x: 6.0 - 1.4, y: WH, z: walk(d / 2), h: -0.5 },
    { x: -walk(w / 2), y: WH, z: -2.6, h: -1.3 },
    { x: walk(w / 2), y: WH, z: 2.4, h: 1.2 },
    { x: -2.5, y: WH, z: -walk(d / 2), h: 0.3 },
    { x: -4.6, y: 0.08, z: 3.8, h: 0.8 },
  ];
  const ravens = new THREE.InstancedMesh(ravenGeo, toonMaterial(), RAVENS.length);
  ravens.castShadow = true;
  const hull = new THREE.InstancedMesh(outlineGeometry(ravenGeo, 0.04), inkMaterial(), RAVENS.length);
  hull.instanceMatrix = ravens.instanceMatrix;
  ravens.frustumCulled = hull.frustumCulled = false; // they hop: skip the stale bounding sphere
  group.add(ravens, hull);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler(0, 0, 0, 'YXZ');
  const p = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const place = (t: number) => {
    RAVENS.forEach((r, i) => {
      const period = 2.4 + i * 0.37;
      const clock = t + i * 1.7;
      const u = clock % period;
      const hop = Math.floor(clock / period);
      const hopping = u < 0.32;
      const lift = hopping ? Math.sin((Math.PI * u) / 0.32) * 0.45 : 0;
      // each hop turns the bird a little, so it looks round the castle
      const turn = 0.7 * Math.sin(hop * 2.3 + i);
      const peck = u > 1.1 && u < 1.6 ? Math.sin((Math.PI * (u - 1.1)) / 0.5) * 0.55 : 0;
      const bob = Math.sin(clock * 7) * 0.04;
      e.set(peck + bob, r.h + turn, 0);
      q.setFromEuler(e);
      m.compose(p.set(r.x, r.y + lift, r.z), q, one);
      ravens.setMatrixAt(i, m);
    });
    ravens.instanceMatrix.needsUpdate = true;
  };
  place(0);

  return {
    group,
    tall: true,
    labelY: TH + 4.5,
    animate(t) {
      place(t);
    },
  };
}
