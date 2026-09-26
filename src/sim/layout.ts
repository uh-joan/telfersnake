/**
 * The Telferscot playground, blocked out from the satellite view and squared up
 * to the axes. Units are metres. +x is east (Radbourne Rd), +z is south (Hyde Farm Mews).
 * Pure data: the sim reads it for collisions, the renderer for looks. Level 1, the `SCHOOL`
 * stage, is assembled from it at the bottom of this file.
 */

import { SCHOOL_ANIMALS } from './animals';
import { pickFoodKind, WEIGHTS_GREEN, WEIGHTS_YARD } from './food';
import type { Rng } from './rng';
import type { Spot, Stage } from './stage';

export interface Box {
  x: number;
  z: number;
  w: number; // size along x
  d: number; // size along z
}

export interface Circle {
  x: number;
  z: number;
  r: number;
}

export interface Building extends Box {
  id: string;
  h: number;
  roofH: number; // 0 = flat roof
  wall: number;
  roof: number;
  brick?: boolean; // walls get the brick texture
}

export interface Tree extends Circle {
  canopy: number;
}

export interface Car extends Box {
  color: number;
}

/** Everything inside the school fence. Roads are scenery. */
export const BOUNDS = { minX: -38, maxX: 38, minZ: -40, maxZ: 40 };

const BRICK = 0xa3583a;
const TILE = 0x6e4b3c;

export const BUILDINGS: Building[] = [
  // Long modern block along the north edge (solar panels, white canopy)
  { id: 'northBlock', x: -14, z: -35.5, w: 48, d: 9, h: 4, roofH: 0, wall: 0xdfe3e8, roof: 0x4b5060 },
  // The Old School, Victorian brick: main hall in the east, plus the north-east, west and south masses.
  { id: 'oldMain', x: 26, z: -8, w: 24, d: 32, h: 5, roofH: 2.6, wall: BRICK, roof: TILE, brick: true },
  { id: 'oldNorthEast', x: 24, z: -32, w: 28, d: 16, h: 4.5, roofH: 2.2, wall: BRICK, roof: TILE, brick: true },
  { id: 'oldWest', x: 8, z: -5, w: 12, d: 14, h: 4.5, roofH: 2.2, wall: BRICK, roof: TILE, brick: true },
  { id: 'oldSouth', x: 15, z: 13, w: 14, d: 10, h: 4.5, roofH: 2.2, wall: BRICK, roof: TILE, brick: true },
  // Red Roof Hut, south
  { id: 'redHut', x: 5, z: 33, w: 12, d: 8, h: 3, roofH: 1.8, wall: 0xeadcc4, roof: 0xe9633b },
  // Corrugated bike shed, south-east
  { id: 'bikeShed', x: 26.5, z: 24, w: 17, d: 6, h: 2.6, roofH: 0.9, wall: 0xc9ccd1, roof: 0xb4b8bf },
  // Black storage shed south of the court
  { id: 'blackShed', x: -22, z: 10.5, w: 12, d: 3, h: 2.4, roofH: 0, wall: 0x2d3038, roof: 0x22242a },
];

/** The Cage: turquoise sports court, fenced, two ways in (east and south). */
export const COURT: Box = { x: -27, z: -8, w: 16, d: 28 };
const FENCE_T = 0.3;
export const COURT_FENCES: Box[] = [
  { x: -35, z: -8, w: FENCE_T, d: 28 }, // west
  { x: -27, z: -22, w: 16, d: FENCE_T }, // north
  { x: -19, z: -16, w: FENCE_T, d: 12 }, // east, north of the gate
  { x: -19, z: 0.5, w: FENCE_T, d: 11 }, // east, south of the gate
  { x: -32.5, z: 6, w: 5, d: FENCE_T }, // south, west of the gate
  { x: -22, z: 6, w: 6, d: FENCE_T }, // south, east of the gate
];

export const GREEN: Box = { x: -12, z: 31, w: 20, d: 12 };
export const TOP_PLAYGROUND: Box = { x: -5, z: -21, w: 30, d: 18 };
export const CAR_PARK: Box = { x: 25, z: 34, w: 26, d: 12 };
export const SAIL: Box = { x: -5, z: -8, w: 9, d: 9 };
export const LAGOON = { x: -1, z: 10, rx: 7.5, rz: 5.2, rot: -0.2 };
export const LOOP_TRACK = { x: -4, z: -24, rx: 8, rz: 4.5 };
export const LANES = { x0: -16, x1: 4, z0: 18, z1: 22, count: 4 };
export const HOPSCOTCH = { x: -13, z0: 7, cells: 8 };
export const TARGET = { x: -13, z: 13, size: 3 };

export const BENCHES: Box[] = [
  { x: -7.5, z: -24, w: 1.8, d: 0.9 },
  { x: -0.5, z: -24, w: 1.8, d: 0.9 },
  { x: -9, z: -16, w: 1.8, d: 0.9 },
];

/** Climbing platform on the Blue Lagoon. */
export const PLATFORM: Box = { x: 1, z: 8.5, w: 2, d: 2 };

export const TREES: Tree[] = [
  { x: -4, z: -24, r: 0.5, canopy: 1.5 },
  { x: -15, z: -27, r: 0.5, canopy: 1.6 },
  { x: 6, z: -28, r: 0.5, canopy: 1.5 },
  { x: -19, z: 27, r: 0.9, canopy: 3.4 },
  { x: -13, z: 34, r: 0.5, canopy: 1.6 },
];

export const CARS: Car[] = [
  { x: 15.3, z: 36.4, w: 1.9, d: 4.2, color: 0x2b2f38 },
  { x: 20.5, z: 36.4, w: 1.9, d: 4.2, color: 0xd9dde2 },
  { x: 28.3, z: 36.4, w: 1.9, d: 4.2, color: 0x3a5fa8 },
];

export const SNAKE_SPAWN = { x: -12, z: 20, heading: 0 };
export const COOPER_SPAWN = { x: -4, z: -18 };
/** Mr Cooper patrols the open yards, not the alleys behind the Old School. */
export const COOPER_BEAT = { minX: -36, maxX: 10, minZ: -29, maxZ: 38 };

export const SOLID_BOXES: Box[] = [...BUILDINGS, ...COURT_FENCES, ...BENCHES, PLATFORM, ...CARS];
export const SOLID_CIRCLES: Circle[] = TREES;

export function inBox(b: Box, x: number, z: number): boolean {
  return Math.abs(x - b.x) <= b.w / 2 && Math.abs(z - b.z) <= b.d / 2;
}

/** Level 1: the school playground as a Stage the sim runs on. */
export const SCHOOL: Stage = {
  id: 'school',
  name: 'School',
  bounds: BOUNDS,
  solidBoxes: SOLID_BOXES,
  solidCircles: SOLID_CIRCLES,
  snakeSpawn: SNAKE_SPAWN,
  fallbackSpot: COOPER_SPAWN,
  animals: SCHOOL_ANIMALS,
  gulpHints: ['🐌🐞', '🐔🦆', '🐇', '🐑🐷', '🐐', '🔥🐲'], // the school's petting-farm animals, then the Dragon

  // Veg grows on The Green; lunch leftovers everywhere else.
  foodKindAt: (rng, x, z) => pickFoodKind(rng, inBox(GREEN, x, z) ? WEIGHTS_GREEN : WEIGHTS_YARD),
  homePoint: (rng: Rng, home: string): Spot => {
    switch (home) {
      case 'green':
        return { x: rng.range(GREEN.x - GREEN.w / 2, GREEN.x + GREEN.w / 2), z: rng.range(GREEN.z - GREEN.d / 2, GREEN.z + GREEN.d / 2) };
      case 'lagoon': {
        const a = rng.range(0, Math.PI * 2);
        const d = rng.range(0, LAGOON.rx + 2);
        return { x: LAGOON.x + Math.cos(a) * d, z: LAGOON.z + Math.sin(a) * d * 0.8 };
      }
      case 'yard':
        return { x: rng.range(LANES.x0 - 2, LANES.x1 + 2), z: rng.range(LANES.z0 - 6, LANES.z1 + 3) };
      default:
        return { x: rng.range(BOUNDS.minX, BOUNDS.maxX), z: rng.range(BOUNDS.minZ, BOUNDS.maxZ) };
    }
  },
  sanctuary: SAIL,
  foodScale: 1,
  // Bike Shed Alley and the yard behind the Old School get more than their share of rocks.
  hazardArea: { rough: { minX: 12, maxX: BOUNDS.maxX, minZ: 8, maxZ: BOUNDS.maxZ }, share: 0.4 },
  predators: [],
  kids: [], // the children are out on the Common, not in the school yard
  creatureCount: 0, // no magic in the school yard
  logs: [],
  greeters: null,
  cooper: { spawn: COOPER_SPAWN, beat: COOPER_BEAT },
  paintMinimap: (c, X, Z, scale) => {
    const fillBox = (b: Box, color: string) => {
      c.fillStyle = color;
      c.fillRect(X(b.x - b.w / 2), Z(b.z - b.d / 2), b.w * scale, b.d * scale);
    };
    c.fillStyle = '#7c818b';
    c.fillRect(0, 0, (BOUNDS.maxX - BOUNDS.minX) * scale, (BOUNDS.maxZ - BOUNDS.minZ) * scale);
    fillBox(COURT, '#55c8d6');
    fillBox(GREEN, '#4cc04a');
    c.fillStyle = '#3d8fe6';
    c.beginPath();
    c.ellipse(X(LAGOON.x), Z(LAGOON.z), LAGOON.rx * scale, LAGOON.rz * scale, LAGOON.rot, 0, Math.PI * 2);
    c.fill();
    for (const b of BUILDINGS) fillBox(b, b.id === 'redHut' ? '#e9633b' : '#4a3b36');
  },
};
