import * as THREE from 'three';
import { LION_PLINTHS, NELSON } from '../../../sim/londonLayout';
import { box, cyl, inked, PALETTE, rel, type LandmarkBuild } from './kit';

/** Trafalgar Square: Nelson's Column and the four lion plinths. PLACEHOLDER (A1 step 2), to be replaced. */
export function build(): LandmarkBuild {
  const parts = [
    box(NELSON.r * 2, 1.5, NELSON.r * 2, PALETTE.stone),
    cyl(0.6, 0.75, 12, PALETTE.stone, 0, 1.5),
    cyl(0.5, 0.5, 1.2, PALETTE.stoneDark, 0, 13.5),
  ];
  for (const p of LION_PLINTHS) {
    const l = rel('trafalgar', p.x, p.z);
    parts.push(box(2, 1, 2, PALETTE.stone, l.x, 0, l.z), box(1.4, 0.9, 0.8, PALETTE.slate, l.x, 1, l.z));
  }
  const group = new THREE.Group();
  group.add(inked(parts, 0.08));
  return { group, tall: false, labelY: 16 };
}
