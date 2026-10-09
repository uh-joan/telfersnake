import * as THREE from 'three';
import { LION_PLINTHS, NELSON } from '../../../sim/londonLayout';
import { box, cone, cyl, extrude, inked, lathe, merge, rel, sphere, toonMesh, type LandmarkBuild } from './kit';

/**
 * Trafalgar Square: Nelson's tall fluted column on its big square plinth, the little admiral in his
 * sideways hat on top, the four big bronze lions lying on their plinths, and two splashing fountains.
 * Colour story: sandstone + dark bronze + fountain blue.
 *
 * The lions are their own children, `lion0`..`lion3` (in LION_PLINTHS order), each a group standing on
 * its plinth top and facing out from the column, so A3 can wake them up, move or hide them.
 */

const SANDSTONE = 0xe3d7bd;
const SANDSTONE_SHADE = 0xc9b998;
const STATUE = 0xcfc5b3;
const BRONZE = 0x9a7444;
const BRONZE_DARK = 0x553820;
const FACE = 0xb88f58;
const MUZZLE = 0xd1aa70;
const HAT = 0x343844;
const WATER = 0x6fd0e6;
const SPRAY = 0xd8f6ff;

/** Plinth tops, where the lions lie. */
const PLINTH_H = 1.4;

/** A sphere stretched into an ellipsoid, centred on (x, y, z). */
const blob = (r: number, sx: number, sy: number, sz: number, color: number, x: number, y: number, z: number, seg = 10) =>
  sphere(r, color, 0, 0, 0, seg, Math.max(6, seg - 2)).scale(sx, sy, sz).translate(x, y, z);

/** One lion lying like a sphinx, facing +z, its belly on y = 0 (built about 3.3 m long). */
function lion(): THREE.BufferGeometry[] {
  const k = 1.5;
  const p: THREE.BufferGeometry[] = [
    // the long body and the haunches
    blob(0.55, 0.85, 0.72, 1.55, BRONZE, 0, 0.42, -0.25),
    blob(0.42, 1, 0.95, 1.1, BRONZE, 0.3, 0.38, -0.8),
    blob(0.42, 1, 0.95, 1.1, BRONZE, -0.3, 0.38, -0.8),
    // the front legs stretched out, with big paws
    box(0.26, 0.26, 0.95, BRONZE, 0.27, 0, 0.6),
    box(0.26, 0.26, 0.95, BRONZE, -0.27, 0, 0.6),
    blob(0.18, 1.1, 0.8, 1.2, FACE, 0.27, 0.12, 1.1),
    blob(0.18, 1.1, 0.8, 1.2, FACE, -0.27, 0.12, 1.1),
    // the big shaggy mane (a dark ball ringed with tufts), then the golden face on the front of it
    blob(0.6, 1.15, 1.1, 0.8, BRONZE_DARK, 0, 0.92, 0.35, 12),
    blob(0.36, 1, 1.0, 0.95, FACE, 0, 0.9, 0.72),
    blob(0.21, 1.2, 0.8, 1, MUZZLE, 0, 0.75, 1.02),
    sphere(0.08, BRONZE_DARK, 0, 0.84, 1.2, 6, 4),
    sphere(0.065, HAT, 0.14, 1.0, 1.0, 6, 4),
    sphere(0.065, HAT, -0.14, 1.0, 1.0, 6, 4),
    sphere(0.1, FACE, 0.24, 1.2, 0.74, 6, 4),
    sphere(0.1, FACE, -0.24, 1.2, 0.74, 6, 4),
    // the tail curled round the side, with its tuft
    box(0.1, 0.1, 0.9, BRONZE, 0, 0, 0).rotateY(0.5).translate(0.45, 0.05, -1.3),
    sphere(0.14, BRONZE_DARK, 0.68, 0.1, -0.95, 6, 4),
  ];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    p.push(sphere(0.2, BRONZE_DARK, Math.cos(a) * 0.62, 0.92 + Math.sin(a) * 0.58, 0.5, 6, 4));
  }
  for (const g of p) g.scale(k, k, k);
  return p;
}

/** A fountain: a round stone basin of water with a bowl on a stem in the middle (the jet is animated). */
function fountain(x: number, z: number): THREE.BufferGeometry[] {
  return [
    cyl(1.35, 1.45, 0.4, SANDSTONE, x, 0, z, 20),
    cyl(1.15, 1.15, 0.04, WATER, x, 0.38, z, 20),
    cyl(0.18, 0.25, 0.9, SANDSTONE_SHADE, x, 0.4, z, 8),
    lathe([[0.15, 0], [0.55, 0.15], [0.75, 0.35], [0.7, 0.4], [0.2, 0.3], [0, 0.3]], SANDSTONE, x, 1.2, z, 16),
  ];
}

export function build(): LandmarkBuild {
  const group = new THREE.Group();
  const parts: THREE.BufferGeometry[] = [];

  // ---- Nelson's plinth: a big square block on a step, bronze panels on its faces
  const P = NELSON.r * 1.85;
  parts.push(
    box(P + 0.4, 0.35, P + 0.4, SANDSTONE_SHADE, 0, 0, 0),
    box(P, 2.5, P, SANDSTONE, 0, 0.35, 0),
    box(P + 0.3, 0.3, P + 0.3, SANDSTONE_SHADE, 0, 2.85, 0),
    box(P * 0.6, 1.0, 0.1, BRONZE, 0, 0.95, P / 2),
    box(P * 0.6, 1.0, 0.1, BRONZE, 0, 0.95, -P / 2),
    box(0.1, 1.0, P * 0.6, BRONZE, P / 2, 0.95, 0),
    box(0.1, 1.0, P * 0.6, BRONZE, -P / 2, 0.95, 0),
  );

  // ---- the column: a fluted shaft (faceted, with shaded grooves), a bronze capital and the admiral
  const COL_Y = 3.15;
  const SHAFT = 12.5;
  parts.push(
    cyl(0.85, 0.95, 0.6, SANDSTONE_SHADE, 0, COL_Y, 0, 12),
    cyl(0.56, 0.66, SHAFT, SANDSTONE, 0, COL_Y + 0.6, 0, 12),
  );
  for (let i = 0; i < 12; i++) {
    const a = ((i + 0.5) / 12) * Math.PI * 2;
    parts.push(box(0.08, SHAFT - 0.4, 0.05, SANDSTONE_SHADE, 0, 0, 0).rotateY(a).translate(Math.sin(a) * 0.6, COL_Y + 0.8, Math.cos(a) * 0.6));
  }
  const capY = COL_Y + 0.6 + SHAFT;
  parts.push(
    lathe([[0.6, 0], [0.75, 0.35], [0.95, 0.75], [1.05, 0.95], [0, 0.95]], BRONZE, 0, capY, 0, 12),
    box(2.0, 0.3, 2.0, SANDSTONE, 0, capY + 0.95, 0),
    cyl(0.5, 0.55, 0.6, SANDSTONE_SHADE, 0, capY + 1.25, 0, 10),
  );

  // Nelson, half again life size so he reads from the street: coat, empty sleeve, sword and the bicorne hat.
  const nY = capY + 1.85;
  const s = 1.5;
  const nelson: THREE.BufferGeometry[] = [
    cyl(0.12, 0.13, 0.55, STATUE, 0.12, 0, 0, 6),
    cyl(0.12, 0.13, 0.55, STATUE, -0.12, 0, 0, 6),
    cyl(0.28, 0.36, 0.75, STATUE, 0, 0.45, 0, 10),
    cyl(0.26, 0.28, 0.35, STATUE, 0, 1.15, 0, 10),
    sphere(0.17, STATUE, 0, 1.68, 0, 10, 8),
    box(0.1, 0.55, 0.12, STATUE, -0.34, 0.85, 0.05),
    box(0.05, 0.75, 0.05, HAT, 0.36, 0.25, 0.1),
  ];
  const hat = new THREE.Shape();
  hat.moveTo(-0.42, 0);
  hat.quadraticCurveTo(0, 0.55, 0.42, 0);
  hat.closePath();
  nelson.push(extrude(hat, 0.2, HAT, 0, 1.76, 0));
  for (const g of nelson) parts.push(g.scale(s, s, s).translate(0, nY, 0));
  const top = nY + 1.76 * s + 0.4;

  // ---- the four lion plinths
  for (const pl of LION_PLINTHS) {
    const l = rel('trafalgar', pl.x, pl.z);
    parts.push(
      box(1.95, 0.25, 2.3, SANDSTONE_SHADE, l.x, 0, l.z),
      box(1.75, PLINTH_H - 0.45, 2.1, SANDSTONE, l.x, 0.25, l.z),
      box(1.95, 0.2, 2.3, SANDSTONE_SHADE, l.x, PLINTH_H - 0.2, l.z),
    );
  }

  // ---- two fountains, east and west of the column
  const FX = 6.4;
  parts.push(...fountain(-FX, 0), ...fountain(FX, 0));

  group.add(inked(parts, 0.08, { flat: true }));

  // ---- the lions, one child each, facing out from the column (the south pair toward the camera)
  const lionGeo = lion();
  LION_PLINTHS.forEach((pl, i) => {
    const l = rel('trafalgar', pl.x, pl.z);
    const g = inked(lionGeo.map((p) => p.clone()), 0.05);
    g.name = `lion${i}`;
    g.position.set(l.x, PLINTH_H, l.z);
    g.rotation.y = Math.atan2(l.x * 0.35, l.z); // mostly north/south, turned a little outward
    group.add(g);
  });
  for (const p of lionGeo) p.dispose();

  // ---- the water jets: a tall spout and a crown of spray each, pumping
  const jets: THREE.Mesh[] = [];
  for (const x of [-FX, FX]) {
    // one mesh per fountain, so each pumps on its own beat (water has no ink line: it is soft)
    const jet = toonMesh(mergeJet(), { castShadow: false, glow: 0.5 });
    jet.position.set(x, 1.5, 0);
    jets.push(jet);
    group.add(jet);
  }

  return {
    group,
    tall: false, // the column is thin: fading the whole square while the snake plays among the lions would hurt more
    labelY: top + 2,
    animate(t) {
      jets.forEach((j, i) => {
        const pump = 0.85 + 0.2 * Math.sin(t * 5.5 + i * 2.1) + 0.06 * Math.sin(t * 13 + i);
        j.scale.set(1 + 0.08 * Math.sin(t * 9 + i), pump, 1 + 0.08 * Math.sin(t * 9 + i));
      });
    },
  };
}

/** One fountain's water: a spout, a frothy top, and four arcs of droplets falling back into the basin. */
function mergeJet(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    cyl(0.07, 0.16, 2.2, WATER, 0, 0, 0, 8),
    sphere(0.32, SPRAY, 0, 2.25, 0, 8, 6),
    sphere(0.22, SPRAY, 0, 2.55, 0, 8, 6),
  ];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    for (let j = 1; j <= 3; j++) {
      const r = 0.25 + j * 0.28;
      const y = 2.1 - j * j * 0.2;
      parts.push(sphere(0.11 - j * 0.015, j === 3 ? SPRAY : WATER, Math.sin(a) * r, y, Math.cos(a) * r, 6, 4));
    }
  }
  parts.push(cone(0.5, 0.3, SPRAY, 0, -0.1, 0, 10));
  return merge(parts);
}
