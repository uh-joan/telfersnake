import * as THREE from 'three';
import { MUSEUM } from '../../../sim/londonLayout';
import { box, cone, inked, PALETTE, type LandmarkBuild } from './kit';

/** The Natural History Museum: a long terracotta front with twin towers. PLACEHOLDER (A1 step 2), to be replaced. */
export function build(): LandmarkBuild {
  const parts = [box(MUSEUM.w, 6, MUSEUM.d, PALETTE.terracotta)];
  for (const s of [-1, 1]) parts.push(box(2, 9, 2, PALETTE.terracotta, s * 1.6, 0, MUSEUM.d / 2 - 1), cone(1.4, 2, PALETTE.slate, s * 1.6, 9, MUSEUM.d / 2 - 1, 4));
  const group = new THREE.Group();
  group.add(inked(parts, 0.1));
  return { group, tall: true, labelY: 13 };
}
