import * as THREE from 'three';
import { box, extrude, inked, PALETTE, type LandmarkBuild } from './kit';

/** The London Eye. PLACEHOLDER (A1 step 2): a turning white ring on two legs, to be replaced. */
export function build(): LandmarkBuild {
  const R = 8;
  const hub = R + 1;
  const ring = new THREE.Shape();
  ring.absarc(0, 0, R, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, R - 0.6, 0, Math.PI * 2, true);
  ring.holes.push(hole);
  const wheel = inked([extrude(ring, 0.6, PALETTE.eyeWhite), box(R * 2 - 1, 0.3, 0.3, PALETTE.eyeWhite, 0, -0.15, 0), box(0.3, 0.3, 0.3, PALETTE.eyeWhite)], 0.08);
  wheel.position.y = hub;
  const legs = inked([
    box(0.6, hub + 0.5, 0.6, PALETTE.eyeWhite, 0, 0, -0.9).rotateX(-0.12),
    box(0.6, hub + 0.5, 0.6, PALETTE.eyeWhite, 0, 0, 0.9).rotateX(0.12),
  ], 0.08);
  const group = new THREE.Group();
  group.add(legs, wheel);
  return { group, tall: true, labelY: hub + R + 2, animate: (t) => { wheel.rotation.z = -t * 0.08; } };
}
