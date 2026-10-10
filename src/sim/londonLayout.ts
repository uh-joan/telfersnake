/**
 * Level 3: London, a paper map come to life. Units are metres, +x east, +z south, like the others.
 *
 * This is the A0 PLACEHOLDER: an open paper rectangle with the Thames drawn across it, so the
 * ticket, the save, the picker and the rooms can all run end to end. Nothing is solid yet and the
 * river is still just ground (swimming lands in A1, with the real streets and all twelve
 * landmarks; see docs/LEVEL3-LONDON-PLAN.md §3). Until then it borrows the Common's animals and
 * the school's food tables, so it is already somewhere to forage.
 */

import { COMMON_ANIMALS } from './animals';
import { pickFoodKind, WEIGHTS_GREEN, WEIGHTS_YARD } from './food';
import type { Box } from './layout';
import { inBox } from './layout';
import type { Rng } from './rng';
import type { Spot, Stage, WaterZone } from './stage';

export const LONDON_BOUNDS = { minX: -85, maxX: 85, minZ: -65, maxZ: 65 };
const BOUNDS = LONDON_BOUNDS;

/** The Thames, west → east: it runs north past Westminster, then bends away east (plan §3). */
export const THAMES: WaterZone = {
  path: [
    { x: -85, z: 20 }, { x: -55, z: 24 }, { x: -36, z: 16 }, { x: -24, z: 2 }, { x: -18, z: -10 },
    { x: 0, z: -14 }, { x: 20, z: -8 }, { x: 42, z: 4 }, { x: 62, z: 8 }, { x: 85, z: 6 },
  ],
  width: 14,
  drift: { x: 0.4, z: 0 },
};

/** Hyde Park (with the Serpentine), and St James's Park by the Palace: the green bits of the map. */
export const HYDE_PARK: Box = { x: -68, z: -42, w: 32, d: 30 };
export const ST_JAMES: Box = { x: -34, z: -22, w: 16, d: 10 };

const SNAKE_SPAWN = { x: -44, z: -4, heading: 0 }; // on the north bank, west of Westminster

export const LONDON: Stage = {
  id: 'london',
  name: 'London',
  bounds: BOUNDS,
  solidBoxes: [],
  solidCircles: [],
  snakeSpawn: SNAKE_SPAWN,
  fallbackSpot: { x: 0, z: -40 }, // open ground north of the river
  animals: COMMON_ANIMALS, // London's own zoo (corgis, swans, gulls…) arrives in A2
  gulpHints: ['🐿️🐦', '🦔🦆', '🦊🐇', '🦌', '🦌', '🔥🐲'],

  // A big map, like the Common: twice the food. Veg in the parks, lunch leftovers in the streets.
  foodScale: 2,
  foodKindAt: (rng, x, z) => pickFoodKind(rng, inBox(HYDE_PARK, x, z) || inBox(ST_JAMES, x, z) ? WEIGHTS_GREEN : WEIGHTS_YARD),
  homePoint: (rng: Rng, home: string): Spot => {
    const inside = (b: Box): Spot => ({ x: rng.range(b.x - b.w / 2, b.x + b.w / 2), z: rng.range(b.z - b.d / 2, b.z + b.d / 2) });
    switch (home) {
      case 'woods':
      case 'green':
        return inside(HYDE_PARK);
      case 'lagoon':
        return inside(ST_JAMES); // the ducks' lake
      default:
        return { x: rng.range(BOUNDS.minX, BOUNDS.maxX), z: rng.range(BOUNDS.minZ, BOUNDS.maxZ) };
    }
  },
  sanctuary: null,
  hazardArea: null, // puddles, umbrellas and roadworks come with A3
  hazardKinds: [],
  logs: [],
  predators: [],
  kids: [],
  creatureCount: 0,
  // Big and open, so four more rivals keep it lively (as on the Common).
  extraRivals: 4,
  greeters: null,
  cooper: null, // Mr Cooper arrives as a Bobby in A1
  water: [THAMES],
  paintMinimap: (c, X, Z, scale) => {
    c.fillStyle = '#f3ead2'; // the cream paper
    c.fillRect(0, 0, (BOUNDS.maxX - BOUNDS.minX) * scale, (BOUNDS.maxZ - BOUNDS.minZ) * scale);
    c.fillStyle = '#9ccc7a';
    for (const b of [HYDE_PARK, ST_JAMES]) c.fillRect(X(b.x - b.w / 2), Z(b.z - b.d / 2), b.w * scale, b.d * scale);
    c.strokeStyle = '#5aa9e6';
    c.lineWidth = THAMES.width * scale;
    c.lineJoin = 'round';
    c.lineCap = 'butt';
    c.beginPath();
    THAMES.path.forEach((p, i) => (i === 0 ? c.moveTo(X(p.x), Z(p.z)) : c.lineTo(X(p.x), Z(p.z))));
    c.stroke();
  },
};
