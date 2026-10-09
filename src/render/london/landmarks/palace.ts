import * as THREE from 'three';
import { PALACE, VICTORIA_MEMORIAL } from '../../../sim/londonLayout';
import { box, cyl, inked, PALETTE, rel, type LandmarkBuild } from './kit';

/** Buckingham Palace + the Victoria Memorial. PLACEHOLDER (A1 step 2), to be replaced. */
export function build(): LandmarkBuild {
  const m = rel('palace', VICTORIA_MEMORIAL.x, VICTORIA_MEMORIAL.z);
  const group = new THREE.Group();
  group.add(
    inked([
      box(PALACE.w, 6, PALACE.d, PALETTE.palaceCream),
      box(PALACE.w + 0.4, 0.5, PALACE.d + 0.4, PALETTE.stone, 0, 6),
      cyl(VICTORIA_MEMORIAL.r, VICTORIA_MEMORIAL.r, 1, PALETTE.stone, m.x, 0, m.z),
      cyl(0.7, 0.9, 4, PALETTE.white, m.x, 1, m.z),
      cyl(0.5, 0.5, 1, PALETTE.gold, m.x, 5, m.z),
    ], 0.1),
  );
  return { group, tall: true, labelY: 9 };
}
