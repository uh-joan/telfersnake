import * as THREE from 'three';
import { TOWER } from '../../../sim/londonLayout';
import { box, cone, crenellations, inked, PALETTE, type LandmarkBuild } from './kit';

/** The Tower of London: curtain wall and the White Keep. PLACEHOLDER (A1 step 2), to be replaced. */
export function build(): LandmarkBuild {
  const { w, d } = TOWER;
  const wall = 1;
  const parts = [
    box(w, 3, wall, PALETTE.stoneDark, 0, 0, -d / 2 + wall / 2),
    box(w, 3, wall, PALETTE.stoneDark, 0, 0, d / 2 - wall / 2),
    box(wall, 3, d, PALETTE.stoneDark, -w / 2 + wall / 2, 0, 0),
    box(wall, 3, d, PALETTE.stoneDark, w / 2 - wall / 2, 0, 0),
    box(6, 7, 6, PALETTE.eyeWhite),
    crenellations(6, 6, PALETTE.eyeWhite, 0, 7, 0, 0.5),
  ];
  for (const [x, z] of [[-3, -3], [3, -3], [3, 3], [-3, 3]]) {
    parts.push(box(1.2, 8.5, 1.2, PALETTE.eyeWhite, x, 0, z), cone(0.9, 1.4, PALETTE.slate, x, 8.5, z, 8));
  }
  const group = new THREE.Group();
  group.add(inked(parts, 0.1));
  return { group, tall: true, labelY: 13 };
}
