/**
 * Level 2: the Common, squared up from the satellite map. Units are metres, +x east, +z south.
 * You come down Telferscot Road (a narrow corridor between terraced houses), cross Emmanuel Road,
 * and out into the meadow — a big open green ringed by woods, with copses to weave around.
 * Pure data, like the school's layout.ts; the renderer draws it, the sim collides against it.
 */

import { COMMON_ANIMALS } from './animals';
import { pickFoodKind, WEIGHTS_COMMON } from './food';
import type { Box, Circle } from './layout';
import type { Rng } from './rng';
import type { Spot, Stage } from './stage';

export const COMMON_BOUNDS = { minX: -60, maxX: 60, minZ: -100, maxZ: 60 };
const BOUNDS = COMMON_BOUNDS;

// Terraced houses lining Telferscot Road (they leave a 12 m road down the middle).
export const COMMON_HOUSES: Box[] = [
  { x: -33, z: -71, w: 54, d: 58 }, // west terrace: x -60..-6, z -100..-42
  { x: 33, z: -71, w: 54, d: 58 }, // east terrace: x 6..60
];
// A road runs down the park's east edge (no houses there): the boundary you cannot cross.
export const COMMON_EAST_ROAD: Box = { x: 57, z: 9, w: 6, d: 102 }; // x 54..60, z -42..60
// Woods that wall the meadow in and pinch it to a point in the south.
export const COMMON_WOODS: Box[] = [
  { x: -52, z: 4, w: 16, d: 76 }, // west woods: x -60..-44, z -34..42
  { x: -5, z: 56, w: 110, d: 8 }, // south wood cap: z 52..60
  { x: -34, z: 44, w: 20, d: 20 }, // south-west wedge, narrowing the tip
  { x: 40, z: 42, w: 16, d: 24 }, // south-east wedge
];
const SOLID_BOXES: Box[] = [...COMMON_HOUSES, COMMON_EAST_ROAD, ...COMMON_WOODS];

// Tree copses out in the meadow: things to slither round, like the real common's clumps.
export const COMMON_COPSES: Circle[] = [
  { x: 30, z: -12, r: 5 },
  { x: 6, z: -6, r: 3 },
  { x: -18, z: 22, r: 1.4 },
  { x: 12, z: 32, r: 1.4 },
  { x: -8, z: -22, r: 1 },
  { x: 38, z: 26, r: 1.6 },
];
const COPSES = COMMON_COPSES;
const HOUSES = COMMON_HOUSES;
const WOODS = COMMON_WOODS;

const SNAKE_SPAWN = { x: 0, z: 4, heading: 0 };

/** Miss Sami and a mum, nattering by the fence door at the top of Telferscot Road, in front of the school. */
export const COMMON_GREETERS = { sami: { x: -2.5, z: -91 }, mum: { x: 1, z: -90.5 } };

/** The Glade: a hidden clearing in the south woods where the fantastic creatures gather. */
export const GLADE = { x: 0, z: 46 };

/** A random point out in the open meadow — where the animals and scattered food live. */
const meadow = (rng: Rng): Spot => ({ x: rng.range(-40, 46), z: rng.range(-28, 46) });

export const COMMON: Stage = {
  id: 'common',
  name: 'The Common',
  bounds: BOUNDS,
  solidBoxes: SOLID_BOXES,
  solidCircles: COPSES,
  snakeSpawn: SNAKE_SPAWN,
  fallbackSpot: { x: 0, z: -80 }, // deep in the road corridor: always open
  animals: COMMON_ANIMALS,
  // Big map, so twice the food to keep it worth chasing.
  foodScale: 2,
  // Mostly forest food (mushrooms, tomatoes, berries, acorns) with a little picnic litter.
  foodKindAt: (rng) => pickFoodKind(rng, WEIGHTS_COMMON),
  homePoint: (rng, home) => {
    if (home === 'anywhere') return { x: rng.range(BOUNDS.minX, BOUNDS.maxX), z: rng.range(BOUNDS.minZ, BOUNDS.maxZ) };
    if (home === 'woods') {
      const t = COPSES[rng.int(COPSES.length)];
      return { x: t.x + rng.range(-t.r - 2, t.r + 2), z: t.z + rng.range(-t.r - 2, t.r + 2) };
    }
    // The Glade: a hidden clearing in the south woods where the fantastic creatures gather.
    if (home === 'glade') return { x: GLADE.x + rng.range(-6, 6), z: GLADE.z + rng.range(-5, 5) };
    return meadow(rng);
  },
  sanctuary: null,
  hazardArea: null, // no rocks here: the Common's dangers move
  predators: [{ kind: 'bear', count: 1 }, { kind: 'wolf', count: 2 }],
  // A crowd of children running the meadow: runners for whimsy, the odd pebble-thrower and kiss-blower.
  kids: ['runner', 'naughty', 'nice', 'runner', 'naughty', 'nice', 'runner', 'naughty'],
  // A few shy fantastic creatures haunt the woods and the Glade (which four is a lucky-day roll).
  creatureCount: 4,
  // Miss Sami and a mum, nattering on the grass just off the Telfer Road mouth.
  greeters: COMMON_GREETERS,
  cooper: null, // Mr Cooper stays at school
  paintMinimap: (c, X, Z, scale) => {
    const box = (b: Box, color: string) => {
      c.fillStyle = color;
      c.fillRect(X(b.x - b.w / 2), Z(b.z - b.d / 2), b.w * scale, b.d * scale);
    };
    c.fillStyle = '#6fae4a'; // grass
    c.fillRect(0, 0, (BOUNDS.maxX - BOUNDS.minX) * scale, (BOUNDS.maxZ - BOUNDS.minZ) * scale);
    c.fillStyle = '#8a8f98'; // roads: Emmanuel Road, the Telferscot Road corridor, and the east-edge road
    c.fillRect(X(-60), Z(-42), 120 * scale, 8 * scale);
    c.fillRect(X(-6), Z(-100), 12 * scale, 58 * scale);
    box(COMMON_EAST_ROAD, '#8a8f98');
    for (const b of HOUSES) box(b, '#6b5a4a');
    for (const b of WOODS) box(b, '#3f7a34');
    c.fillStyle = '#2f6a2a';
    for (const t of COPSES) {
      c.beginPath();
      c.arc(X(t.x), Z(t.z), t.r * scale, 0, Math.PI * 2);
      c.fill();
    }
  },
};
