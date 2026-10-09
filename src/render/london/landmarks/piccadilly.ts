import * as THREE from 'three';
import { PICCADILLY_FOUNTAIN, PICCADILLY_SCREENS } from '../../../sim/londonLayout';
import { box, cyl, inked, PALETTE, rel, type LandmarkBuild } from './kit';

/** Piccadilly Circus: the fountain and the light screens on the north edge. PLACEHOLDER (A1 step 2), to be replaced. */
export function build(): LandmarkBuild {
  const s = rel('piccadilly', PICCADILLY_SCREENS.x, PICCADILLY_SCREENS.z);
  const r = PICCADILLY_FOUNTAIN.r;
  const group = new THREE.Group();
  group.add(inked([
    cyl(r, r, 0.6, PALETTE.stone),
    cyl(0.4, 0.5, 2.2, PALETTE.stone, 0, 0.6),
    cyl(0.25, 0.25, 0.8, PALETTE.gold, 0, 2.8),
    box(PICCADILLY_SCREENS.w, 8, PICCADILLY_SCREENS.d, PALETTE.palaceCream, s.x, 0, s.z),
    box(PICCADILLY_SCREENS.w - 2, 4, 0.3, PALETTE.busRed, s.x, 3, s.z + PICCADILLY_SCREENS.d / 2),
  ], 0.08));
  return { group, tall: false, labelY: 5 };
}
