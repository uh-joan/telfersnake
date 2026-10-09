import * as THREE from 'three';
import { BIG_BEN, PARLIAMENT } from '../../../sim/londonLayout';
import { box, cone, inked, PALETTE, rel, type LandmarkBuild } from './kit';

/** Big Ben + the Houses of Parliament. PLACEHOLDER (A1 step 2): correctly sized blocks, to be replaced. */
export function build(): LandmarkBuild {
  const tower = rel('bigben', BIG_BEN.x, BIG_BEN.z);
  const house = rel('bigben', PARLIAMENT.x, PARLIAMENT.z);
  const group = new THREE.Group();
  group.add(
    inked([
      box(BIG_BEN.w, 16, BIG_BEN.d, PALETTE.honey, tower.x, 0, tower.z),
      box(BIG_BEN.w + 0.2, 3, BIG_BEN.d + 0.2, PALETTE.clockWhite, tower.x, 11.5, tower.z),
      cone(3, 4, PALETTE.slate, tower.x, 16, tower.z, 4),
      box(PARLIAMENT.w, 5, PARLIAMENT.d, PALETTE.honey, house.x, 0, house.z),
    ], 0.12),
  );
  return { group, tall: true, labelY: 22 };
}
