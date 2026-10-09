import * as THREE from 'three';
import { MILLENNIUM_BRIDGE, TOWER_BRIDGE, WESTMINSTER_BRIDGE } from '../../sim/londonLayout';
import { box, cyl, extrude, inked, PALETTE, sphere } from './landmarks/kit';
import { WATER_Y } from './water';

/**
 * The three bridge decks. In the sim a deck is just dry ground over the river (snakes slither across
 * at y ≈ 0), so each deck's top sits flush with the paper (a hair above, to win the depth fight) and
 * its structure hangs below, down into the water. Tower Bridge's towers are a landmark; only its deck
 * (and the seam where the bascules will part) lives here.
 */

/** The deck surface height: just proud of the paper. */
const TOP = 0.05;
const BASE = WATER_Y - 0.4;

/** A side face of arches: a solid band from under the water up to the deck, with round-topped openings. */
function arcade(len: number, color: number, span: number, rise: number, z: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-len / 2, BASE);
  s.lineTo(len / 2, BASE);
  s.lineTo(len / 2, TOP);
  s.lineTo(-len / 2, TOP);
  s.closePath();
  const pitch = span * 1.3;
  const n = Math.floor((len - 0.6) / pitch);
  const foot = BASE + 0.05;
  const spring = TOP - 0.16 - rise; // where each arch starts to curve
  for (let i = 0; i < n; i++) {
    const cx = (i - (n - 1) / 2) * pitch;
    const h = new THREE.Path();
    h.moveTo(cx - span / 2, foot);
    h.lineTo(cx + span / 2, foot);
    h.lineTo(cx + span / 2, spring);
    h.absellipse(cx, spring, span / 2, rise, 0, Math.PI, false, 0);
    h.lineTo(cx - span / 2, foot);
    s.holes.push(h);
  }
  return extrude(s, 0.22, color, 0, 0, z);
}

/** Westminster Bridge: green-painted iron arches on stone piers, the old triple-globe lamps. */
function westminster(): THREE.Group {
  const { w, d } = WESTMINSTER_BRIDGE; // runs east–west (along x)
  const parts = [
    box(w, 0.16, d - 0.4, PALETTE.westminsterGreen, 0, TOP - 0.16, 0), // thin, so the arches show water through them
    box(w, 0.02, d - 1, 0xf1ebdc, 0, TOP - 0.01, 0),
    arcade(w, PALETTE.westminsterGreen, 2.6, 0.12, d / 2 - 0.11),
    arcade(w, PALETTE.westminsterGreen, 2.6, 0.12, -d / 2 + 0.11),
  ];
  // Stone piers between the arches, proud of the green face, and a low kerb each side.
  const pitch = 2.6 * 1.3;
  const n = Math.floor((w - 0.6) / pitch);
  for (let i = 0; i <= n; i++) {
    const x = (i - n / 2) * pitch;
    for (const s of [-1, 1]) parts.push(box(0.55, TOP - 0.1 - BASE, 0.3, PALETTE.stone, x, BASE, s * (d / 2 + 0.05)));
  }
  for (const s of [-1, 1]) parts.push(box(w, 0.12, 0.3, PALETTE.westminsterGreen, 0, TOP, s * (d / 2 - 0.15)));
  // Lamp posts along both kerbs: a dark green post with three cream globes.
  const lamps: THREE.BufferGeometry[] = [];
  for (let x = -w / 2 + 2; x <= w / 2 - 2; x += 4.5) {
    for (const s of [-1, 1]) {
      const z = s * (d / 2 - 0.15);
      lamps.push(
        cyl(0.06, 0.09, 1.7, 0x23402e, x, TOP + 0.1, z, 6),
        box(0.7, 0.06, 0.06, 0x23402e, x, TOP + 1.7, z),
        sphere(0.13, PALETTE.clockWhite, x - 0.3, TOP + 1.9, z, 8, 6),
        sphere(0.13, PALETTE.clockWhite, x + 0.3, TOP + 1.9, z, 8, 6),
        sphere(0.15, PALETTE.clockWhite, x, TOP + 2.05, z, 8, 6),
      );
    }
  }
  const g = new THREE.Group();
  g.add(inked(parts, 0.05), inked(lamps, 0.03));
  g.position.set(WESTMINSTER_BRIDGE.x, 0, WESTMINSTER_BRIDGE.z);
  return g;
}

/** The Millennium Bridge: a thin silver blade on Y-shaped piers. */
function millennium(): THREE.Group {
  const { w, d } = MILLENNIUM_BRIDGE; // runs north–south (along z)
  const parts = [
    box(w, 0.14, d, PALETTE.silver, 0, TOP - 0.14, 0),
    box(w - 0.6, 0.02, d, 0xe9edf1, 0, TOP - 0.01, 0),
  ];
  for (const s of [-1, 1]) {
    parts.push(box(0.08, 0.06, d, PALETTE.silver, s * (w / 2 - 0.1), TOP + 0.45, 0)); // the handrail
    for (let z = -d / 2 + 0.5; z <= d / 2 - 0.5; z += 1.5) parts.push(box(0.05, 0.45, 0.05, 0x9aa3ad, s * (w / 2 - 0.1), TOP, z));
  }
  for (const z of [-3, 3]) {
    parts.push(cyl(0.35, 0.45, WATER_Y + 0.02 - BASE, PALETTE.stoneDark, 0, BASE, z, 10));
    // The Y: two arms out from the pier head (at the waterline) to the deck's edges.
    for (const s of [-1, 1]) parts.push(box(0.14, 1.92, 0.14, PALETTE.silver).rotateZ(-s * 1.46).translate(0, WATER_Y + 0.02, z));
  }
  const g = new THREE.Group();
  g.add(inked(parts, 0.04));
  g.position.set(MILLENNIUM_BRIDGE.x, 0, MILLENNIUM_BRIDGE.z);
  return g;
}

/** Tower Bridge's deck: sky-blue girders, a grey road, and the seam where the two bascules meet. */
function towerDeck(): THREE.Group {
  const { w, d } = TOWER_BRIDGE; // runs east–west (along x)
  const parts = [
    box(w, TOP - BASE - 0.2, d, PALETTE.skyBlue, 0, BASE + 0.2, 0),
    box(w, 0.02, d - 0.8, 0xd8d3c8, 0, TOP - 0.01, 0),
    box(0.12, 0.025, d - 0.8, PALETTE.ink, 0, TOP - 0.005, 0),
  ];
  for (const s of [-1, 1]) {
    parts.push(box(w, 0.16, 0.3, PALETTE.skyBlue, 0, TOP, s * (d / 2 - 0.15)));
    // Rivet-bands down the girder face, so it reads as painted iron.
    for (let x = -w / 2 + 1; x < w / 2; x += 2) parts.push(box(0.12, TOP - BASE - 0.3, 0.05, PALETTE.navy, x, BASE + 0.25, s * (d / 2 + 0.01)));
  }
  const g = new THREE.Group();
  g.add(inked(parts, 0.05));
  g.position.set(TOWER_BRIDGE.x, 0, TOWER_BRIDGE.z);
  return g;
}

export function makeBridges(): THREE.Group {
  const g = new THREE.Group();
  g.add(westminster(), millennium(), towerDeck());
  return g;
}
