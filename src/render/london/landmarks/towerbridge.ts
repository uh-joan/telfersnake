import * as THREE from 'three';
import { TOWER_BRIDGE, TOWER_BRIDGE_TOWERS } from '../../../sim/londonLayout';
import { box, cone, cyl, extrude, inked, PALETTE, rel, sphere, windows, type LandmarkBuild } from './kit';
import { paint, unionFlag } from './palace';

/**
 * Tower Bridge, side-on to the camera: the bridge spans the Thames east–west (where the river runs
 * south), so looking north we see the classic picture: two tall grey gothic towers side by side, the
 * sky-blue high walkways joining them at the top, and the blue suspension chains swooping out to the
 * stone abutments on each bank.
 *
 * The deck (and the seam where the two bascules meet) is drawn by render/london/bridges.ts; this file
 * draws nothing on the roadway, so the bascules can become their own two objects later (A6) without
 * touching the towers. Each tower stands on the sim's two legs (TOWER_BRIDGE_TOWERS, z ± 4.2, 3 × 2.4)
 * joined by a pointed arch the road runs through; above, the stone body, four corner turrets with
 * pointy slate spires and gold tips, a slate roof and a Union flag that flutters.
 * Draw calls: stone + ink (2), two flags (2).
 */

const STONE = 0xd3cec3;
const STONE_DARK = 0xa9a397;
const ROOF = 0x4b5463;
const WINDOW = 0x3d4658;
const LEG_Z = 4.2;
const LEG_D = 2.4;
const HALF_D = LEG_Z + LEG_D / 2; // 5.4: the tower's half-depth across the road
const TW = 4.0; // the tower's width along the bridge (a little more than the 3 m legs)
const BODY_TOP = 13.5;
const WALK_Y = 11.0;
const WALK_H = 1.9;
const WALK_Z = 3.2; // the walkways run above each edge of the road

/** A smooth tube along points (a chain), kit-shaped. */
function chain(pts: THREE.Vector3[], r: number, color: number): THREE.BufferGeometry {
  return paint(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, r, 6, false), color);
}

/** A thin box from a to b. */
function beam(a: THREE.Vector3, b: THREE.Vector3, t: number, color: number): THREE.BufferGeometry {
  const dir = b.clone().sub(a);
  const g = box(t, dir.length(), t, color);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
  return g.translate(a.x, a.y, a.z);
}

/** One tower, built round its own centre (x along the bridge, z = 0 on the road's centre line). */
function tower(parts: THREE.BufferGeometry[]): void {
  // The legs and the pointed arch the road runs through, as one carved slab (drawn across z, extruded along x).
  const ax = LEG_Z - LEG_D / 2; // 3.0: the legs' inner faces
  const s = new THREE.Shape();
  s.moveTo(-HALF_D, -1);
  s.lineTo(-ax, -1);
  s.lineTo(-ax, 4.0);
  s.quadraticCurveTo(-ax * 0.75, 6.0, 0, 6.6);
  s.quadraticCurveTo(ax * 0.75, 6.0, ax, 4.0);
  s.lineTo(ax, -1);
  s.lineTo(HALF_D, -1);
  s.lineTo(HALF_D, 7.5);
  s.lineTo(-HALF_D, 7.5);
  s.closePath();
  parts.push(extrude(s, TW - 0.4, STONE, 0, 0, 0, Math.PI / 2));
  for (const sz of [-1, 1]) {
    parts.push(box(TW + 0.4, 0.9, LEG_D + 0.4, STONE_DARK, 0, -0.9, sz * LEG_Z)); // the piers at the waterline
    parts.push(box(TW - 0.2, 0.25, LEG_D + 0.15, STONE_DARK, 0, 4.0, sz * LEG_Z));
  }
  // The body above the arch.
  parts.push(box(TW, BODY_TOP - 7.5, HALF_D * 2, STONE, 0, 7.5, 0));
  parts.push(box(TW + 0.2, 0.3, HALF_D * 2 + 0.2, STONE_DARK, 0, 7.5, 0), box(TW + 0.2, 0.3, HALF_D * 2 + 0.2, STONE_DARK, 0, BODY_TOP - 0.3, 0));
  // Gothic windows: tall pairs on the faces the camera sees, a column up each leg, rows on the arch sides.
  for (const sz of [-1, 1]) {
    const rot = sz > 0 ? 0 : Math.PI;
    parts.push(windows({ cols: 2, rows: 2, cellW: 1.3, cellH: 2.6, winW: 0.6, winH: 1.8, color: WINDOW, x: 0, y: 7.9, z: sz * HALF_D, rotY: rot, arched: true }));
    parts.push(windows({ cols: 1, rows: 2, cellW: 1.3, cellH: 2.6, winW: 0.55, winH: 1.5, color: WINDOW, x: 0, y: 0.6, z: sz * HALF_D, rotY: rot, arched: true }));
  }
  for (const sx of [-1, 1]) {
    parts.push(windows({ cols: 5, rows: 2, cellW: 1.9, cellH: 2.6, winW: 0.6, winH: 1.7, color: WINDOW, x: sx * (TW / 2), y: 7.9, z: 0, rotY: sx * Math.PI / 2, arched: true }));
  }
  // The roof: a steep slate pyramid stretched over the body, a lantern and a flagpole.
  const hw = TW / 2 - 0.3;
  const hd = HALF_D - 0.5;
  parts.push(cone(1, 3.0, ROOF, 0, 0, 0, 4).rotateY(Math.PI / 4).scale(hw / Math.SQRT1_2, 1, hd / Math.SQRT1_2).translate(0, BODY_TOP, 0));
  parts.push(box(0.9, 0.9, 0.9, STONE, 0, BODY_TOP + 2.2, 0), cone(0.7, 1.5, ROOF, 0, 0, 0, 4).rotateY(Math.PI / 4).translate(0, BODY_TOP + 3.1, 0));
  parts.push(cyl(0.05, 0.05, 2.4, PALETTE.white, 0, BODY_TOP + 4.4, 0, 6), sphere(0.12, PALETTE.gold, 0, BODY_TOP + 6.8, 0, 6, 4));
  // Four corner turrets running up past the roof into pointy spires with gold tips.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * (TW / 2 - 0.05);
      const z = sz * (HALF_D - 0.05);
      parts.push(
        cyl(0.62, 0.62, BODY_TOP + 1.4 - 4.0, STONE, x, 4.0, z, 8),
        cyl(0.72, 0.72, 0.25, STONE_DARK, x, BODY_TOP + 1.2, z, 8),
        cone(0.7, 3.0, ROOF, x, BODY_TOP + 1.45, z, 8),
        cone(0.11, 0.7, PALETTE.gold, x, BODY_TOP + 4.3, z, 6),
      );
    }
  }
}

export function build(): LandmarkBuild {
  const parts: THREE.BufferGeometry[] = [];
  const [west, east] = TOWER_BRIDGE_TOWERS.map((t) => rel('towerbridge', t.x, t.z)).sort((a, b) => a.x - b.x);
  for (const c of [west, east]) {
    const p: THREE.BufferGeometry[] = [];
    tower(p);
    for (const g of p) parts.push(g.translate(c.x, 0, c.z));
  }

  // The high walkways: two sky-blue lattice girders between the towers, one above each edge of the road.
  const x0 = west.x + TW / 2;
  const x1 = east.x - TW / 2;
  const len = x1 - x0;
  const xm = (x0 + x1) / 2;
  const bays = 4;
  for (const sz of [-1, 1]) {
    const z = sz * WALK_Z;
    parts.push(box(len + 0.2, WALK_H, 1.7, PALETTE.skyBlue, xm, WALK_Y, z));
    parts.push(box(len + 0.2, 0.22, 1.95, 0x4a8fc4, xm, WALK_Y + WALK_H, z)); // the top chord
    parts.push(box(len + 0.2, 0.22, 1.95, 0x4a8fc4, xm, WALK_Y - 0.12, z)); // the bottom chord
    // The criss-cross lattice on both long faces (the south one faces the camera).
    for (const fz of [-1, 1]) {
      const zf = z + fz * 0.88;
      for (let i = 0; i < bays; i++) {
        const xa = x0 + (i / bays) * len;
        const xb = x0 + ((i + 1) / bays) * len;
        parts.push(
          beam(new THREE.Vector3(xa, WALK_Y + 0.1, zf), new THREE.Vector3(xb, WALK_Y + WALK_H - 0.1, zf), 0.14, PALETTE.navy),
          beam(new THREE.Vector3(xa, WALK_Y + WALK_H - 0.1, zf), new THREE.Vector3(xb, WALK_Y + 0.1, zf), 0.14, PALETTE.navy),
        );
      }
    }
  }

  // The suspension chains: from high on each tower's outer face, swooping down and up again to a stone
  // abutment tower at the deck's end on the bank, with hangers down to the deck edge.
  const ab = TOWER_BRIDGE.w / 2 - 1.0;
  for (const sz of [-1, 1]) {
    const z = sz * 3.35;
    for (const [c, dx] of [[west, -1], [east, 1]] as const) {
      const xt = c.x + dx * (TW / 2);
      const xa = dx * ab;
      const pts = [
        new THREE.Vector3(xt, 10.8, z),
        new THREE.Vector3(xt + dx * 1.1, 6.2, z),
        new THREE.Vector3((xt + xa) / 2, 2.6, z),
        new THREE.Vector3(xa - dx * 1.0, 2.9, z),
        new THREE.Vector3(xa, 4.3, z),
      ];
      parts.push(chain(pts, 0.22, PALETTE.skyBlue));
      const curve = new THREE.CatmullRomCurve3(pts);
      for (const u of [0.25, 0.4, 0.55, 0.7]) {
        const p = curve.getPoint(u);
        parts.push(box(0.08, p.y - 0.05, 0.08, PALETTE.navy, p.x, 0.05, z));
      }
      // The abutment: a little stone gatehouse with a slate cap, just outside the road's edge.
      const az = sz * 3.85;
      parts.push(box(1.1, 4.3, 1.0, STONE, xa, 0, az), box(1.3, 0.2, 1.2, STONE_DARK, xa, 4.3, az));
      parts.push(cone(0.8, 1.2, ROOF, 0, 0, 0, 4).rotateY(Math.PI / 4).translate(xa, 4.5, az), cone(0.08, 0.5, PALETTE.gold, xa, 5.7, az, 6));
    }
  }

  const group = new THREE.Group();
  group.add(inked(parts, 0.09));

  const flags = [west, east].map((c, i) => {
    const f = unionFlag(1.6, 0.9, i * 1.7);
    f.mesh.position.set(c.x + 0.05, BODY_TOP + 6.3, c.z);
    group.add(f.mesh);
    return f;
  });

  return { group, tall: true, labelY: BODY_TOP + 9, animate: (t) => { for (const f of flags) f.wave(t); } };
}
