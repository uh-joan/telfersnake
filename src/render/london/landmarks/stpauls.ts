import * as THREE from 'three';
import { ST_PAULS_DOME, ST_PAULS_NAVE } from '../../../sim/londonLayout';
import { box, cone, cyl, extrude, inked, lathe, PALETTE, rel, sphere, windows, type LandmarkBuild } from './kit';

/**
 * St Paul's Cathedral: one colour story, Portland white stone + a pale lead-grey dome + a golden cross.
 * The dome IS the silhouette, so it is oversized: a ring of columns (the drum), a tall ribbed dome, the
 * little lantern and the gold ball and cross. The nave runs west to the front with its two bell towers
 * and the two-storey portico. Alive: a flock of pigeons circles the dome.
 */

const STONE = 0xf1ece0; // Portland stone, a touch warmer than paper white
const STONE_SHADE = 0xd9d0bf; // the recessed drum wall, so the columns stand out
const DOME = 0xb4bfcc; // lead grey with a blue tint
const RIB = 0x8e9aa9;
const WINDOW = 0x4a5a6e;
const PIGEON = 0x8d96a3;
const PIGEON_WING = 0xdfe3e8;

/** A copy of `g` turned about the vertical, then moved. */
const turned = (g: THREE.BufferGeometry, rotY: number, x: number, y: number, z: number) => g.rotateY(rotY).translate(x, y, z);

export function build(): LandmarkBuild {
  const d = rel('stpauls', ST_PAULS_DOME.x, ST_PAULS_DOME.z);
  const n = rel('stpauls', ST_PAULS_NAVE.x, ST_PAULS_NAVE.z);
  const R = ST_PAULS_DOME.r;
  const W = ST_PAULS_NAVE.w;
  const D = ST_PAULS_NAVE.d;
  const west = n.x - W / 2;
  const NAVE_H = 6.5;

  const parts: THREE.BufferGeometry[] = [];

  // ---- the nave: two storeys of arched windows, a string course, a cornice and a lead roof
  parts.push(
    box(W + 0.6, NAVE_H, D, STONE, n.x + 0.3, 0, n.z),
    box(W + 0.8, 0.3, D + 0.3, STONE_SHADE, n.x + 0.3, 3.1, n.z),
    box(W + 0.8, 0.45, D + 0.4, STONE, n.x + 0.3, NAVE_H, n.z),
    windows({ cols: 4, rows: 1, cellW: 2.1, cellH: 2.6, winW: 0.9, winH: 1.8, color: WINDOW, x: n.x + 0.6, y: 0.2, z: n.z + D / 2, arched: true }),
    windows({ cols: 4, rows: 1, cellW: 2.1, cellH: 2.6, winW: 0.8, winH: 1.5, color: WINDOW, x: n.x + 0.6, y: 3.5, z: n.z + D / 2, arched: true }),
  );
  const roof = new THREE.Shape();
  roof.moveTo(-D / 2 + 0.1, 0);
  roof.lineTo(D / 2 - 0.1, 0);
  roof.lineTo(0, 1.5);
  roof.closePath();
  parts.push(extrude(roof, W - 1, DOME, n.x + 0.8, NAVE_H + 0.45, n.z, Math.PI / 2));

  // ---- the west front: two bell towers either side of a two-storey portico and its pediment
  for (const s of [-1, 1]) {
    const tz = n.z + s * 1.45;
    const tx = west + 1.1;
    parts.push(
      box(2.2, 9, 2.2, STONE, tx, 0, tz),
      box(2.5, 0.35, 2.5, STONE_SHADE, tx, 9, tz),
      windows({ cols: 1, rows: 2, cellW: 2, cellH: 3, winW: 0.8, winH: 1.6, color: WINDOW, x: tx, y: 0.4, z: tz + 1.1, arched: true }),
      // the round belfry with its ring of columns, then a little lead cap and a golden pineapple
      cyl(0.85, 0.85, 1.8, STONE_SHADE, tx, 9.35, tz, 12),
      lathe([[1.0, 0], [1.0, 0.25], [0.8, 0.5], [0.85, 0.9], [0.55, 1.4], [0.2, 1.9], [0.12, 2.3], [0, 2.4]], DOME, tx, 11.15, tz, 12),
      sphere(0.22, PALETTE.gold, tx, 13.7, tz, 8, 6),
    );
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      parts.push(cyl(0.12, 0.12, 1.8, STONE, tx + Math.sin(a) * 0.95, 9.35, tz + Math.cos(a) * 0.95, 6));
    }
  }
  // The portico stands proud of the west wall: six columns below, four above, and the pediment.
  const px = west - 0.35;
  parts.push(box(0.8, 0.35, 3.0, STONE, px, 0, n.z));
  for (let i = 0; i < 6; i++) parts.push(cyl(0.16, 0.18, 3.2, STONE, px, 0.35, n.z - 1.25 + i * 0.5, 8));
  parts.push(box(0.9, 0.45, 3.2, STONE, px, 3.55, n.z));
  for (let i = 0; i < 4; i++) parts.push(cyl(0.15, 0.16, 2.4, STONE, px, 4.0, n.z - 0.9 + i * 0.6, 8));
  parts.push(box(0.9, 0.4, 2.6, STONE, px, 6.4, n.z));
  const ped = new THREE.Shape();
  ped.moveTo(-1.45, 0);
  ped.lineTo(1.45, 0);
  ped.lineTo(0, 1.1);
  ped.closePath();
  parts.push(extrude(ped, 0.8, STONE, px, 6.8, n.z, Math.PI / 2));

  // ---- the crossing under the dome: a round base as tall as the nave, with a cornice
  parts.push(
    cyl(R, R, NAVE_H, STONE, d.x, 0, d.z, 32),
    cyl(R + 0.2, R + 0.2, 0.45, STONE, d.x, NAVE_H, d.z, 32),
  );
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    // arched windows all round the base, facing out
    parts.push(
      turned(windows({ cols: 1, rows: 1, cellW: 1, cellH: 2.6, winW: 0.8, winH: 1.9, color: WINDOW, arched: true }), a, d.x + Math.sin(a) * R, 2.4, d.z + Math.cos(a) * R),
    );
  }

  // ---- the drum: a ring of columns round a shaded wall, an entablature and the attic storey
  const drumY = NAVE_H + 0.45;
  const COLR = R - 0.45;
  parts.push(
    cyl(R - 0.1, R - 0.1, 0.5, STONE, d.x, drumY, d.z, 32),
    cyl(R - 1.1, R - 1.1, 3.2, STONE_SHADE, d.x, drumY + 0.5, d.z, 24),
    cyl(R - 0.05, R - 0.05, 0.55, STONE, d.x, drumY + 3.3, d.z, 32),
    cyl(R - 0.8, R - 0.8, 1.3, STONE, d.x, drumY + 3.85, d.z, 28),
    cyl(R - 0.65, R - 0.65, 0.25, STONE, d.x, drumY + 5.15, d.z, 28),
  );
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    parts.push(cyl(0.2, 0.22, 2.8, STONE, d.x + Math.sin(a) * COLR, drumY + 0.5, d.z + Math.cos(a) * COLR, 8));
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 0.2;
    parts.push(turned(windows({ cols: 1, rows: 1, cellW: 1, cellH: 1, winW: 0.45, winH: 0.65, color: WINDOW }), a, d.x + Math.sin(a) * (R - 0.8), drumY + 4.0, d.z + Math.cos(a) * (R - 0.8)));
  }

  // ---- the great dome: tall, pale lead grey, with darker ribs
  const domeY = drumY + 5.4;
  const DR = R - 0.85;
  const LIFT = 1.3;
  parts.push(sphere(DR, DOME, 0, 0, 0, 32, 12, Math.PI * 2, Math.PI / 2).scale(1, LIFT, 1).translate(d.x, domeY, d.z));
  for (let i = 0; i < 16; i++) {
    const rib = sphere(DR + 0.06, RIB, 0, 0, 0, 1, 12, 0.09, Math.PI / 2 - 0.12);
    parts.push(rib.rotateY((i / 16) * Math.PI * 2).scale(1, LIFT, 1).translate(d.x, domeY, d.z));
  }

  // ---- the lantern, the golden ball and the cross
  const topY = domeY + DR * LIFT - 0.1;
  parts.push(
    cyl(0.95, 1.1, 0.35, STONE, d.x, topY, d.z, 12),
    cyl(0.65, 0.7, 1.6, STONE, d.x, topY + 0.35, d.z, 10),
    cyl(0.85, 0.85, 0.2, STONE, d.x, topY + 1.95, d.z, 10),
    sphere(0.7, DOME, d.x, topY + 2.15, d.z, 10, 6, Math.PI * 2, Math.PI / 2),
    cone(0.22, 0.8, DOME, d.x, topY + 2.7, d.z, 8),
    sphere(0.5, PALETTE.gold, d.x, topY + 3.75, d.z, 12, 8),
    box(0.22, 1.5, 0.22, PALETTE.gold, d.x, topY + 4.15, d.z),
    box(0.95, 0.22, 0.22, PALETTE.gold, d.x, topY + 5.0, d.z),
  );
  const crossTop = topY + 5.65;

  const group = new THREE.Group();
  group.add(inked(parts, 0.1));

  // ---- the pigeons: one little flock, one mesh, circling the dome
  const birds: THREE.BufferGeometry[] = [];
  const FLOCK = 7;
  for (let i = 0; i < FLOCK; i++) {
    const a = (i / FLOCK) * Math.PI * 2 + (i % 2) * 0.3;
    const r = R + 2 + (i % 3) * 0.7;
    const y = domeY + 0.5 + ((i * 5) % 7) * 0.6; // staggered heights round the dome
    // Flying counter-clockwise seen from above (the group's rotation.y grows), so each faces its tangent.
    const heading = Math.atan2(Math.cos(a), -Math.sin(a));
    const bird = [
      sphere(0.3, PIGEON, 0, 0, 0, 8, 6).scale(0.8, 0.75, 1.5),
      sphere(0.2, PIGEON, 0, 0.18, 0.42, 8, 6),
      cone(0.08, 0.2, PALETTE.gold, 0, 0, 0, 4).rotateX(Math.PI / 2).translate(0, 0.15, 0.55),
      box(1.4, 0.06, 0.4, PIGEON_WING, 0, 0.05, 0).rotateZ(i % 2 ? 0.25 : -0.25),
      box(0.35, 0.05, 0.35, PIGEON_WING, 0, 0, -0.55),
    ];
    for (const b of bird) birds.push(turned(b, heading, Math.sin(a) * r, y, Math.cos(a) * r));
  }
  const flock = inked(birds, 0.04, { castShadow: false });
  flock.position.set(d.x, 0, d.z);
  group.add(flock);

  return {
    group,
    tall: true,
    labelY: crossTop + 2.5,
    animate(t) {
      flock.rotation.y = t * 0.45;
      flock.position.y = Math.sin(t * 1.3) * 0.5;
      flock.rotation.z = Math.sin(t * 0.7) * 0.05;
    },
  };
}
