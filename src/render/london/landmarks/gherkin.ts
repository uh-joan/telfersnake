import * as THREE from 'three';
import { GHERKIN } from '../../../sim/londonLayout';
import { inked, lathe, PALETTE, type LandmarkBuild } from './kit';

/** The Gherkin: a pickle-green bullet. PLACEHOLDER (A1 step 2), to be replaced. */
export function build(): LandmarkBuild {
  const r = GHERKIN.r;
  const profile: [number, number][] = [[0, 0], [r * 0.9, 0], [r * 1.05, 4], [r, 9], [r * 0.8, 13], [r * 0.45, 15.5], [0, 16.5]];
  const group = new THREE.Group();
  group.add(inked([lathe(profile, PALETTE.pickleGreen, 0, 0, 0, 24)], 0.12));
  return { group, tall: true, labelY: 19 };
}
