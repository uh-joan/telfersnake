import * as THREE from 'three';
import { BRIDGES_LIFTED, MILLENNIUM_BRIDGE, TOWER_BRIDGE, TOWER_BRIDGE_SPAN, WESTMINSTER_BRIDGE } from '../../sim/londonLayout';
import { box, cyl, extrude, inked, PALETTE, sphere } from './landmarks/kit';
import { WATER_Y } from './water';

/**
 * The three bridge decks. In the sim a deck is just dry ground over the river (snakes slither across
 * at y ≈ 0), so each deck's top sits flush with the paper (a hair above, to win the depth fight) and
 * its structure hangs below, down into the water. Tower Bridge's towers are a landmark; only its deck
 * lives here (its two lifting bascules are built here too, but the set-piece view owns and turns them).
 */

/** The deck surface height: just proud of the paper. */
const TOP = 0.05;
const BASE = WATER_Y - 0.4;
/** The road on a deck, painted like the map's streets: white, ink-edged, a faint grey centre dash. */
const ROAD = 0xffffff;
const DASH = 0xc9c2b4;

/** A road along x (len long, wide across z), with ink edges and a dashed centre line, lying on TOP. */
function road(len: number, wide: number, dashes = true): THREE.BufferGeometry[] {
  const parts = [box(len, 0.02, wide, ROAD, 0, TOP - 0.01, 0)];
  for (const s of [-1, 1]) parts.push(box(len, 0.025, 0.1, PALETTE.ink, 0, TOP - 0.005, s * (wide / 2 + 0.05)));
  if (dashes) for (let x = -len / 2 + 0.8; x < len / 2 - 0.6; x += 1.6) parts.push(box(0.8, 0.025, 0.1, DASH, x + 0.4, TOP - 0.005, 0));
  return parts;
}

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
    // Stone pavements each side of the road, the road itself painted like the map's streets.
    box(w, 0.015, d - 0.6, PALETTE.stone, 0, TOP - 0.012, 0),
    ...road(w, d - 2.2),
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
  // The green parapet, with a stone post over every pier, so the deck's edges read from the camera.
  for (const s of [-1, 1]) {
    parts.push(box(w, 0.24, 0.3, PALETTE.westminsterGreen, 0, TOP, s * (d / 2 - 0.15)));
    parts.push(box(w, 0.05, 0.36, 0x2f6b45, 0, TOP + 0.24, s * (d / 2 - 0.15)));
    for (let i = 0; i <= n; i++) parts.push(box(0.4, 0.36, 0.4, PALETTE.stone, (i - n / 2) * pitch, TOP, s * (d / 2 - 0.15)));
  }
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
  // A blade: a thin silver deck with a dark underside, crossed by aluminium slats, its cables
  // running low along both edges (the bridge famously keeps its suspension below the walkway).
  const parts = [
    box(w - 0.3, 0.08, d, PALETTE.slate, 0, TOP - 0.2, 0),
    box(w, 0.14, d, PALETTE.silver, 0, TOP - 0.14, 0),
    box(w - 0.7, 0.02, d, 0xeef2f6, 0, TOP - 0.01, 0),
  ];
  for (let z = -d / 2 + 0.4; z < d / 2; z += 0.8) parts.push(box(w - 0.7, 0.025, 0.08, 0xb7c0ca, 0, TOP - 0.005, z));
  for (const s of [-1, 1]) {
    parts.push(box(0.1, 0.06, d, 0x8d96a1, s * (w / 2 - 0.2), TOP, 0)); // the kerb
    parts.push(box(0.08, 0.06, d, PALETTE.silver, s * (w / 2 - 0.1), TOP + 0.45, 0)); // the handrail
    for (const k of [0, 1]) parts.push(cyl(0.05, 0.05, d, 0x9aa3ad, s * (w / 2 + 0.06), -d / 2, 0, 6).rotateX(Math.PI / 2).translate(0, TOP - 0.06 - k * 0.12, 0));
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
  g.name = 'millennium'; // the set pieces sway it (A6)
  return g;
}

/**
 * Tower Bridge's deck: sky-blue girders and a grey road, its two fixed ends only. The middle (the sim's
 * TOWER_BRIDGE_SPAN, between the towers) is the two bascules, which lift (A6): see `makeBascule`.
 */
function towerDeck(): THREE.Group {
  const { d } = TOWER_BRIDGE; // runs east–west (along x)
  const g = new THREE.Group();
  for (const end of BRIDGES_LIFTED.slice(2)) {
    const w = end.w;
    const parts = [
      box(w, TOP - BASE - 0.2, d, PALETTE.skyBlue, 0, BASE + 0.2, 0),
      box(w, 0.015, d - 0.6, PALETTE.stone, 0, TOP - 0.012, 0), // pavements
      ...road(w, d - 2.2),
    ];
    for (const s of [-1, 1]) {
      parts.push(box(w, 0.16, 0.3, PALETTE.skyBlue, 0, TOP, s * (d / 2 - 0.15)));
      // Rivet-bands down the girder face, so it reads as painted iron.
      for (let x = -w / 2 + 1; x < w / 2; x += 2) parts.push(box(0.12, TOP - BASE - 0.3, 0.05, PALETTE.navy, x, BASE + 0.25, s * (d / 2 + 0.01)));
    }
    const piece = inked(parts, 0.05);
    piece.position.set(end.x, 0, end.z);
    g.add(piece);
  }
  return g;
}

/**
 * One of Tower Bridge's two bascules: half the span, hinged at its tower (the group's origin) and
 * reaching `dir` (+1 east, −1 west) to the seam in the middle, where a steel plate meets its twin.
 * The set-piece view turns it up about z as the bridge lifts.
 */
export function makeBascule(dir: 1 | -1): THREE.Group {
  const { d } = TOWER_BRIDGE_SPAN;
  const len = TOWER_BRIDGE_SPAN.w / 2 - 0.02;
  const DEEP = 1.3; // the girders: deep, so a raised leaf reads as a tall blue arm from the side
  const parts = [
    box(len, DEEP, d, PALETTE.skyBlue, 0, TOP - DEEP, 0),
    box(len, 0.015, d - 0.6, PALETTE.stone, 0, TOP - 0.012, 0),
    ...road(len, d - 2.2, false),
    box(0.4, 0.022, d - 0.6, 0x8d96a1, dir * (len / 2 - 0.2), TOP - 0.008, 0), // the steel plate at the seam
    box(0.08, 0.03, d - 0.6, PALETTE.ink, dir * (len / 2 - 0.04), TOP - 0.005, 0),
  ];
  for (const s of [-1, 1]) {
    parts.push(box(len, 0.16, 0.3, PALETTE.skyBlue, 0, TOP, s * (d / 2 - 0.15)));
    // Rivet bands and a navy edge down each girder face.
    for (let x = -len / 2 + 0.4; x < len / 2; x += 0.9) parts.push(box(0.12, DEEP - 0.1, 0.05, PALETTE.navy, x, TOP - DEEP + 0.05, s * (d / 2 + 0.01)));
    parts.push(box(len, 0.12, 0.06, PALETTE.navy, 0, TOP - DEEP, s * (d / 2 + 0.01)));
  }
  for (const p of parts) p.translate((dir * len) / 2, 0, 0);
  const g = new THREE.Group();
  g.add(inked(parts, 0.05));
  return g;
}

export function makeBridges(): THREE.Group {
  const g = new THREE.Group();
  g.add(westminster(), millennium(), towerDeck());
  return g;
}
