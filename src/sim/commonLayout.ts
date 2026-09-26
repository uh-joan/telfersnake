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
  { x: -52, z: 9, w: 16, d: 86 }, // west woods: x -60..-44, z -34..52 (runs down to the south cap)
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

/**
 * The big fallen log in the top-right of the park. It is a solid the snake, predators and creatures
 * go round — but the children clamber over it (they rise as they cross; see logClamberHeight).
 */
export const COMMON_LOG = { x: 43, z: -25, angle: 0.5, half: 5.2, r: 0.85 };
const LOG_DIR = { x: Math.cos(COMMON_LOG.angle), z: -Math.sin(COMMON_LOG.angle) };

/** The log approximated as a row of circles along its length, for collision. */
export const COMMON_LOG_CIRCLES: Circle[] = (() => {
  const out: Circle[] = [];
  for (let t = -COMMON_LOG.half; t <= COMMON_LOG.half + 0.01; t += 1.5) {
    out.push({ x: COMMON_LOG.x + LOG_DIR.x * t, z: COMMON_LOG.z + LOG_DIR.z * t, r: COMMON_LOG.r });
  }
  return out;
})();

/** How high a point sits on the log (0 off it): the children ride this as they scamper over. */
export function logClamberHeight(x: number, z: number): number {
  const dx = x - COMMON_LOG.x;
  const dz = z - COMMON_LOG.z;
  const along = dx * LOG_DIR.x + dz * LOG_DIR.z;
  const perp = Math.abs(dx * -LOG_DIR.z + dz * LOG_DIR.x);
  if (Math.abs(along) > COMMON_LOG.half + 0.4 || perp > COMMON_LOG.r + 0.3) return 0;
  const dome = Math.sqrt(Math.max(0, COMMON_LOG.r * COMMON_LOG.r - perp * perp)); // 0..r
  const endFade = Math.min(1, (COMMON_LOG.half + 0.4 - Math.abs(along)) / 0.9);
  return (COMMON_LOG.r * 0.5 + dome) * endFade;
}

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
  gulpHints: ['🐿️🐦', '🦔', '🦊🐦‍⬛', '🦌', '🦌'], // the Common's forest animals, per tier

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
  // The park keeper, Mr Bramble: patrols the meadow, and snakes near him drop to a walk.
  cooper: {
    spawn: { x: 12, z: 8 },
    beat: { minX: -38, maxX: 46, minZ: -26, maxZ: 42 },
    persona: 'keeper',
    lines: {
      general: [
        'No running on the grass, please!',
        'Mind the flowerbeds!',
        'Litter in the bin, thank you!',
        'Keep dogs on their leads, please!',
        'Lovely day for it. Do slow down.',
        'Who left this gate open?',
        'Mind the fresh mowing!',
        'Bikes off the grass, thank you!',
        'That is not what the benches are for.',
        'Respect the wildlife, please. And walking feet.',
        'Be sure to take your litter home!',
      ],
      near: [
        'Oi! No slithering at speed!',
        'Steady on — this is a park, not a racetrack.',
        'Walking pace on the grass, if you please.',
        'Slow down — there are little ones about.',
        'Move along, nothing to forage here.',
      ],
      big: ['Crikey. You have grown. Still no running!', 'Goodness me. Mind the trees, would you.'],
      bump: ['I beg your pardon!', 'Watch where you slither!', 'Careful! You nearly had me over.'],
    },
  },
  logs: COMMON_LOG_CIRCLES, // the fallen log: solid to snakes, clambered by kids
  predators: [{ kind: 'bear', count: 1 }, { kind: 'wolf', count: 2 }],
  // A crowd of children running the meadow: runners for whimsy, the odd pebble-thrower and kiss-blower.
  kids: ['runner', 'naughty', 'nice', 'runner', 'naughty', 'nice', 'runner', 'naughty'],
  // A few shy fantastic creatures haunt the woods and the Glade (which four is a lucky-day roll).
  creatureCount: 4,
  // Miss Sami and a mum, nattering on the grass just off the Telfer Road mouth.
  greeters: COMMON_GREETERS,
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
