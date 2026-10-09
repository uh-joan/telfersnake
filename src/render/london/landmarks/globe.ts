import * as THREE from 'three';
import { GLOBE } from '../../../sim/londonLayout';
import { cone, cyl, inked, PALETTE, type LandmarkBuild } from './kit';

/** Shakespeare's Globe: round, white, thatched. PLACEHOLDER (A1 step 2), to be replaced. */
export function build(): LandmarkBuild {
  const group = new THREE.Group();
  group.add(inked([
    cyl(GLOBE.r, GLOBE.r, 3.2, PALETTE.eyeWhite, 0, 0, 0, 20),
    cone(GLOBE.r + 0.4, 1.8, PALETTE.thatch, 0, 3.2, 0, 20),
  ], 0.08));
  return { group, tall: false, labelY: 7.5 };
}
