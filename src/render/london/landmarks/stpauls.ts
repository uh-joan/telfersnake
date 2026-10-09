import * as THREE from 'three';
import { ST_PAULS_DOME, ST_PAULS_NAVE } from '../../../sim/londonLayout';
import { box, cone, cyl, inked, PALETTE, rel, sphere, type LandmarkBuild } from './kit';

/** St Paul's Cathedral. PLACEHOLDER (A1 step 2): nave, drum, dome and golden cross, to be replaced. */
export function build(): LandmarkBuild {
  const d = rel('stpauls', ST_PAULS_DOME.x, ST_PAULS_DOME.z);
  const n = rel('stpauls', ST_PAULS_NAVE.x, ST_PAULS_NAVE.z);
  const r = ST_PAULS_DOME.r;
  const group = new THREE.Group();
  group.add(
    inked([
      box(ST_PAULS_NAVE.w, 6, ST_PAULS_NAVE.d, PALETTE.stone, n.x, 0, n.z),
      cyl(r, r, 6, PALETTE.stone, d.x, 0, d.z, 24),
      cyl(r * 0.8, r * 0.8, 2, PALETTE.stone, d.x, 6, d.z, 24),
      sphere(r * 0.8, PALETTE.domeGrey, d.x, 8, d.z, 24, 12, Math.PI * 2, Math.PI / 2),
      cone(0.4, 2.5, PALETTE.gold, d.x, 8 + r * 0.8, d.z, 8),
    ], 0.1),
  );
  return { group, tall: true, labelY: 16 };
}
