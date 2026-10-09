import * as THREE from 'three';
import { SHARD } from '../../../sim/londonLayout';
import { cone, inked, PALETTE, type LandmarkBuild } from './kit';

/** The Shard: a glass spike. PLACEHOLDER (A1 step 2), to be replaced. */
export function build(): LandmarkBuild {
  const group = new THREE.Group();
  group.add(inked([cone(SHARD.w * 0.7, 28, PALETTE.glassBlue, 0, 0, 0, 4).rotateY(Math.PI / 4)], 0.12, { flat: true }));
  return { group, tall: true, labelY: 31 };
}
