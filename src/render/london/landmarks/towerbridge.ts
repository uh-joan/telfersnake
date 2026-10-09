import * as THREE from 'three';
import { TOWER_BRIDGE_TOWERS } from '../../../sim/londonLayout';
import { box, cone, inked, PALETTE, rel, type LandmarkBuild } from './kit';

/**
 * Tower Bridge's two towers and their high walkways (the deck itself is in render/london/bridges.ts).
 * PLACEHOLDER (A1 step 2), to be replaced. Each tower is a pair of legs straddling the deck.
 */
export function build(): LandmarkBuild {
  const parts: THREE.BufferGeometry[] = [];
  const H = 12;
  for (const t of TOWER_BRIDGE_TOWERS) {
    const l = rel('towerbridge', t.x, t.z);
    for (const s of [-1, 1]) {
      parts.push(box(2.4, H, 3, PALETTE.bridgeGrey, l.x + s * 4.2, -0.5, l.z), cone(1.6, 2.4, PALETTE.slate, l.x + s * 4.2, H - 0.5, l.z, 4));
    }
    parts.push(box(6, 1.2, 2, PALETTE.bridgeGrey, l.x, H - 2.5, l.z));
  }
  const [a, b] = TOWER_BRIDGE_TOWERS.map((t) => rel('towerbridge', t.x, t.z));
  for (const s of [-1, 1]) parts.push(box(1.2, 1, b.z - a.z, PALETTE.skyBlue, a.x + s * 4.2, H - 2, (a.z + b.z) / 2));
  const group = new THREE.Group();
  group.add(inked(parts, 0.1));
  return { group, tall: true, labelY: H + 4 };
}
