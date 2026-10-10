import * as THREE from 'three';
import { CAROUSEL, BANDSTAND_PARK, SOUTH_GARDENS, TERRACE } from '../../sim/londonLayout';
import { box, cone, cyl, extrude, inked, PALETTE, sphere } from './landmarks/kit';

/**
 * The south-west quarter's charm (A7), all scenery and nothing solid, like the street furniture: the
 * South Bank gardens' carousel (it turns, its horses bob) and a row of street-food stalls, the
 * bandstand in its round park, and a terrace of pastel houses along the bottom of the map.
 */

const HORSE_COLOURS = [0xffffff, 0xffc9de, 0xa5d8ff, 0xfff3bf, 0xd0bfff, 0xb2f2bb];
const AWNINGS: [number, number][] = [[0xd8342c, 0xffffff], [0x1f6fd0, 0xffffff], [0x2f9e44, 0xfff3bf], [0xff8a3d, 0xffffff]];
const HOUSE_COLOURS = [0xf7c6d0, 0xbfe3f7, 0xfff0a8, 0xc8f0c8, 0xe6d3ff, 0xffd2a8, 0xf7c6d0, 0xbfe3f7, 0xfff0a8, 0xc8f0c8];
const DOORS = [0x1f3264, 0xd8342c, 0x2f9e44, 0x1c1c1f, 0xf2c230];

/** A little painted horse on its pole, facing +x (round the carousel), standing on y = 0. */
function horse(colour: number): THREE.BufferGeometry[] {
  return [
    box(1.0, 0.42, 0.34, colour, 0, 0.9, 0),
    box(0.26, 0.5, 0.28, colour, 0.48, 1.2, 0),
    box(0.42, 0.22, 0.26, colour, 0.62, 1.52, 0),
    box(0.12, 0.42, 0.12, colour, 0.36, 0.5, 0.1),
    box(0.12, 0.42, 0.12, colour, -0.36, 0.5, -0.1),
    box(0.1, 0.36, 0.06, PALETTE.gold, -0.55, 0.92, 0), // a gold tail
    box(0.5, 0.06, 0.38, 0xd8342c, 0, 1.12, 0), // the saddle
  ];
}

function carousel(): { group: THREE.Group; spin: THREE.Group; horses: THREE.Object3D[] } {
  const group = new THREE.Group();
  group.position.set(CAROUSEL.x, 0, CAROUSEL.z);
  // The fixed part: the round platform, the centre column and the striped canopy.
  group.add(inked([
    cyl(3, 3.1, 0.35, 0xfff6e0),
    cyl(0.45, 0.45, 3.4, 0xf2c230, 0, 0.35),
    cone(3.4, 1.5, 0xd8342c, 0, 3.5),
    cyl(3.4, 3.4, 0.35, 0xffffff, 0, 3.3, 0, 24),
    sphere(0.28, PALETTE.gold, 0, 5.1),
  ], 0.05));
  // The turning part: six horses on gold poles.
  const spin = new THREE.Group();
  spin.position.y = 0.35;
  const horses: THREE.Object3D[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const pole = inked([cyl(0.06, 0.06, 2.95, PALETTE.gold)], 0.03);
    pole.position.set(Math.cos(a) * 2.2, 0, Math.sin(a) * 2.2);
    const h = inked(horse(HORSE_COLOURS[i]), 0.04);
    h.position.set(Math.cos(a) * 2.2, 0, Math.sin(a) * 2.2);
    h.rotation.y = -a - Math.PI / 2; // nose along the way round
    spin.add(pole, h);
    horses.push(h);
  }
  group.add(spin);
  return { group, spin, horses };
}

/** A street-food stall: a wooden counter under a striped awning, a little food sign on top. Faces +z. */
function stall(x: number, z: number, [a, b]: [number, number], food: number): THREE.Group {
  const parts = [
    box(2.2, 1.0, 1.2, 0x9a6a3a, 0, 0, 0),
    box(2.3, 0.08, 1.3, 0xd9b48a, 0, 1.0, 0),
    box(0.1, 2.2, 0.1, 0x5a3a24, -1.05, 0, -0.55),
    box(0.1, 2.2, 0.1, 0x5a3a24, 1.05, 0, -0.55),
    box(0.1, 2.2, 0.1, 0x5a3a24, -1.05, 0, 0.55),
    box(0.1, 2.2, 0.1, 0x5a3a24, 1.05, 0, 0.55),
    sphere(0.32, food, 0, 2.9, 0, 10, 8),
    box(0.08, 0.5, 0.08, 0x5a3a24, 0, 2.3, 0),
  ];
  // The awning: stripes front to back, tipped toward the street.
  for (let i = 0; i < 6; i++) parts.push(box(0.4, 0.12, 1.6, i % 2 ? b : a, -1.0 + i * 0.4, 2.2, 0.1));
  const g = inked(parts, 0.04);
  g.position.set(x, 0, z);
  return g;
}

function bandstand(): THREE.Group {
  const parts = [
    cyl(2.9, 3.1, 0.55, 0xfff6e0, 0, 0, 0, 8),
    cone(3.3, 1.4, 0x2f8a5a, 0, 2.95, 0, 8),
    cyl(3.3, 3.3, 0.2, 0xffffff, 0, 2.8, 0, 8),
    sphere(0.22, PALETTE.gold, 0, 4.45, 0, 8, 6),
  ];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    parts.push(cyl(0.08, 0.08, 2.3, 0x2f8a5a, Math.cos(a) * 2.6, 0.55, Math.sin(a) * 2.6, 6));
  }
  const g = inked(parts, 0.05);
  g.position.set(BANDSTAND_PARK.x, 0, BANDSTAND_PARK.z);
  return g;
}

/** The terrace: pastel houses side by side, doors and windows facing south (to the camera). */
function terrace(): THREE.Group {
  const parts: THREE.BufferGeometry[] = [];
  const gable = new THREE.Shape([new THREE.Vector2(-1.5, 0), new THREE.Vector2(1.5, 0), new THREE.Vector2(0, 1.1)]);
  let i = 0;
  for (let x = TERRACE.x0 + 1.5; x < TERRACE.x1; x += 3, i++) {
    const colour = HOUSE_COLOURS[i % HOUSE_COLOURS.length];
    parts.push(
      box(3, 2.6, 2.6, colour, x, 0, TERRACE.z),
      extrude(gable, 2.6, 0x5d6470, x, 2.6, TERRACE.z),
      box(0.6, 1.1, 0.06, DOORS[i % DOORS.length], x - 0.6, 0, TERRACE.z + 1.31),
      box(0.62, 0.55, 0.06, 0xffffff, x + 0.65, 0.75, TERRACE.z + 1.31),
      box(0.62, 0.55, 0.06, 0xffffff, x - 0.6, 1.6, TERRACE.z + 1.31),
      box(0.62, 0.55, 0.06, 0xffffff, x + 0.65, 1.6, TERRACE.z + 1.31),
      box(0.4, 0.7, 0.4, 0xb5654a, x + 0.9, 3.0, TERRACE.z - 0.4), // a chimney
    );
  }
  return inked(parts, 0.04);
}

export function makeSouthWest(): { group: THREE.Group; animate(t: number): void } {
  const group = new THREE.Group();
  const merry = carousel();
  group.add(merry.group, bandstand(), terrace());
  const g = SOUTH_GARDENS;
  const foods = [0xf2c230, 0xd8342c, 0xffc9de, 0xc98a45];
  AWNINGS.forEach((colours, i) => group.add(stall(g.x - g.w / 2 + 2.4 + i * 3.4, g.z + 2.2, colours, foods[i])));
  return {
    group,
    animate(t: number) {
      merry.spin.rotation.y = t * 0.6;
      merry.horses.forEach((h, i) => (h.position.y = 0.25 + Math.sin(t * 3 + i * 1.3) * 0.22));
    },
  };
}
