/**
 * Level 3: London, a paper map come to life. Units are metres, +x east, +z south, like the others.
 *
 * The Thames winds west → east and splits the map into a north and a south bank. You cross on
 * Westminster Bridge, the Millennium Bridge or Tower Bridge, or swim (slowly: see water.ts). The
 * twelve landmarks stand on the map as solids (their footprints; the renderer builds them tall),
 * with plenty of open paper between them: this is a city to slither round, not a maze.
 * Coordinates follow docs/LEVEL3-LONDON-PLAN.md §3, nudged where the river needed room.
 *
 * Pure data, like layout.ts and commonLayout.ts: the sim collides against it, the renderer
 * draws it. Animals and food are still borrowed (London's own menu and zoo arrive in A2).
 */

import { COMMON_ANIMALS } from './animals';
import type { WardenConfig } from './cooper';
import { pickFoodKind, WEIGHTS_GREEN, WEIGHTS_YARD } from './food';
import type { Box, Circle } from './layout';
import { inBox } from './layout';
import type { Rng } from './rng';
import type { Landmark, Portal, Spot, Stage, WaterZone } from './stage';

export const LONDON_BOUNDS = { minX: -85, maxX: 85, minZ: -65, maxZ: 65 };
const BOUNDS = LONDON_BOUNDS;

// ---------------------------------------------------------------- the river and its bridges

/**
 * The Thames, west → east: it runs north past Westminster, bends away east, then (folded to fit the
 * sheet) swings south past the Tower and out of the map's bottom edge, so Tower Bridge spans it
 * east–west and the camera, looking north, sees the bridge side-on (plan §3).
 */
export const THAMES: WaterZone = {
  path: [
    { x: -85, z: 20 }, { x: -55, z: 24 }, { x: -36, z: 16 }, { x: -24, z: 2 }, { x: -18, z: -10 },
    { x: 0, z: -14 }, { x: 20, z: -8 }, { x: 42, z: 4 }, { x: 56, z: 9 }, { x: 63, z: 18 },
    { x: 65, z: 30 }, { x: 66, z: 44 }, { x: 66, z: 65 },
  ],
  width: 14,
  drift: { x: 0.4, z: 0 },
};

/** Westminster Bridge: east–west across the northward bend, from Big Ben to the London Eye. */
export const WESTMINSTER_BRIDGE: Box = { x: -24, z: 2, w: 28, d: 6 };
/** The Millennium Bridge: a thin footbridge from Bankside north to St Paul's. */
export const MILLENNIUM_BRIDGE: Box = { x: 24, z: -6, w: 4, d: 22 };
/** Tower Bridge's deck, east–west across the river's southward run (the towers stand on it, in the river). */
export const TOWER_BRIDGE: Box = { x: 65, z: 30, w: 24, d: 6 };
export const BRIDGES: Box[] = [WESTMINSTER_BRIDGE, MILLENNIUM_BRIDGE, TOWER_BRIDGE];

// ---------------------------------------------------------------- the twelve landmarks (footprints)

/** Big Ben's clock tower, at the north-east corner of the Houses of Parliament, by the bridge. */
export const BIG_BEN: Box = { x: -40, z: -8, w: 4, d: 4 };
export const PARLIAMENT: Box = { x: -48, z: -4, w: 12, d: 8 };
/** The London Eye: only its legs stand on the south bank (the wheel leans out over the water). */
export const LONDON_EYE = { x: -6, z: -1, r: 1.6 };
/** Buckingham Palace faces east down the Mall; the golden Victoria Memorial stands at its gates. */
export const PALACE: Box = { x: -52, z: -22, w: 16, d: 6 };
export const VICTORIA_MEMORIAL: Circle = { x: -40, z: -22, r: 2 };
/** Trafalgar Square: Nelson's Column in the middle, a lion on a plinth at each corner. */
export const NELSON: Circle = { x: -12, z: -42, r: 1.2 };
export const LION_PLINTHS: Spot[] = [
  { x: -16, z: -45 }, { x: -8, z: -45 }, { x: -16, z: -39 }, { x: -8, z: -39 },
];
const PLINTH_R = 1;
/** St Paul's: the dome, and the nave running west toward the Millennium Bridge. */
export const ST_PAULS_DOME: Circle = { x: 30, z: -42, r: 4.5 };
export const ST_PAULS_NAVE: Box = { x: 21, z: -42, w: 10, d: 5 };
/** The Tower of London: its curtain wall (the White Keep stands inside). */
export const TOWER: Box = { x: 62, z: -16, w: 14, d: 12 };
/** Tower Bridge's two towers (west and east), each a pair of legs straddling the deck, out in the river. */
export const TOWER_BRIDGE_TOWERS: Spot[] = [{ x: 59.8, z: 30 }, { x: 70.2, z: 30 }];
const TOWER_LEGS: Box[] = TOWER_BRIDGE_TOWERS.flatMap((t) => [
  { x: t.x, z: t.z - 4.2, w: 3, d: 2.4 },
  { x: t.x, z: t.z + 4.2, w: 3, d: 2.4 },
]);
/** The Shard: a glass spike on a square base, south of the river. */
export const SHARD: Box = { x: 52, z: 42, w: 6, d: 6 };
/** The Gherkin: round, at the north edge of the City. */
export const GHERKIN: Circle = { x: 50, z: -52, r: 3.5 };
/** Shakespeare's Globe: round, white, thatched, on Bankside. */
export const GLOBE: Circle = { x: 18, z: 12, r: 4 };
/** Piccadilly Circus: the little winged statue's fountain, and the light screens on the north edge. */
export const PICCADILLY_FOUNTAIN: Circle = { x: -30, z: -50, r: 1.6 };
export const PICCADILLY_SCREENS: Box = { x: -30, z: -62.5, w: 16, d: 5 };
/** The Natural History Museum: a long terracotta front. */
export const MUSEUM: Box = { x: -66, z: 0, w: 16, d: 7 };

const SOLID_BOXES: Box[] = [
  BIG_BEN, PARLIAMENT, PALACE, ST_PAULS_NAVE, TOWER, ...TOWER_LEGS, SHARD, PICCADILLY_SCREENS, MUSEUM,
];
const SOLID_CIRCLES: Circle[] = [
  LONDON_EYE, VICTORIA_MEMORIAL, NELSON, ...LION_PLINTHS.map((p) => ({ ...p, r: PLINTH_R })),
  ST_PAULS_DOME, GHERKIN, GLOBE, PICCADILLY_FOUNTAIN,
];

/** The sights, by stable id (stamps, the minimap, the renderer's builders). `radius` is how close counts as a visit. */
export const LANDMARKS: Landmark[] = [
  { id: 'bigben', at: { x: -42, z: -6 }, radius: 12 },
  { id: 'eye', at: { x: LONDON_EYE.x, z: LONDON_EYE.z }, radius: 9 },
  { id: 'palace', at: { x: PALACE.x, z: PALACE.z }, radius: 13 },
  { id: 'trafalgar', at: { x: NELSON.x, z: NELSON.z }, radius: 9 },
  { id: 'stpauls', at: { x: 27, z: -42 }, radius: 11 },
  { id: 'tower', at: { x: TOWER.x, z: TOWER.z }, radius: 12 },
  { id: 'towerbridge', at: { x: TOWER_BRIDGE.x, z: TOWER_BRIDGE.z }, radius: 10 },
  { id: 'shard', at: { x: SHARD.x, z: SHARD.z }, radius: 9 },
  { id: 'gherkin', at: { x: GHERKIN.x, z: GHERKIN.z }, radius: 9 },
  { id: 'globe', at: { x: GLOBE.x, z: GLOBE.z }, radius: 9 },
  { id: 'piccadilly', at: { x: PICCADILLY_FOUNTAIN.x, z: PICCADILLY_FOUNTAIN.z }, radius: 9 },
  { id: 'museum', at: { x: MUSEUM.x, z: MUSEUM.z }, radius: 13 },
];

// ---------------------------------------------------------------- zones, roads and stations

/** Hyde Park (the Serpentine is painted scenery, not water), and St James's Park by the Palace. */
export const HYDE_PARK: Box = { x: -68, z: -42, w: 32, d: 30 };
export const SERPENTINE = { x: -68, z: -42, rx: 9, rz: 2.5, rot: -0.25 };
export const ST_JAMES: Box = { x: -26, z: -26, w: 16, d: 10 };
export const COVENT_GARDEN: Box = { x: 8, z: -50, w: 16, d: 10 };
export const BOROUGH: Box = { x: 40, z: 24, w: 14, d: 10 };
export const SOUTH_BANK: Box = { x: -30, z: 38, w: 22, d: 12 };

/** A painted street (cream with ink edges), for the ground painter and, later, the buses. */
export interface Road {
  id: string;
  path: readonly Spot[];
  width: number;
}

/** The streets: the Mall, the Strand, the Embankment, the south bank road and the outer ring. */
export const ROADS: Road[] = [
  { id: 'mall', path: [{ x: -38, z: -24 }, { x: -24, z: -33 }, { x: -14, z: -40 }], width: 5 }, // the red road
  { id: 'piccadilly', path: [{ x: -56, z: -30 }, { x: -40, z: -42 }, { x: -30, z: -50 }, { x: -18, z: -44 }], width: 4 },
  { id: 'strand', path: [{ x: -12, z: -42 }, { x: 4, z: -40 }, { x: 16, z: -36 }, { x: 34, z: -34 }, { x: 48, z: -28 }, { x: 62, z: -26 }], width: 4 },
  { id: 'whitehall', path: [{ x: -12, z: -42 }, { x: -24, z: -26 }, { x: -34, z: -14 }], width: 4 },
  { id: 'embankment', path: [{ x: -36, z: -14 }, { x: -18, z: -22 }, { x: 0, z: -24 }, { x: 22, z: -20 }, { x: 44, z: -9 }, { x: 74, z: -6 }], width: 4 },
  { id: 'southbank', path: [{ x: -8, z: 4 }, { x: -18, z: 14 }, { x: -30, z: 26 }, { x: -50, z: 34 }], width: 4 },
  { id: 'borough', path: [{ x: -8, z: 4 }, { x: 4, z: 6 }, { x: 22, z: 20 }, { x: 40, z: 28 }, { x: 53, z: 30 }], width: 4 },
  // Over Tower Bridge and up the east bank to the Embankment.
  { id: 'towerbridge', path: [{ x: 77, z: 30 }, { x: 80, z: 16 }, { x: 78, z: 2 }, { x: 74, z: -6 }], width: 4 },
  { id: 'kensington', path: [{ x: -84, z: -8 }, { x: -56, z: -10 }, { x: -48, z: -12 }, { x: -36, z: -14 }], width: 4 },
];

/** The Tube stations (they become portals in A6). Westminster is where you arrive. */
export const TUBE: Portal[] = [
  { id: 'westminster', at: { x: -46, z: 8 } },
  { id: 'piccadilly', at: { x: -24, z: -56 } },
  { id: 'southken', at: { x: -62, z: 8 } },
  { id: 'bank', at: { x: 38, z: -46 } },
  { id: 'towerhill', at: { x: 56, z: -30 } },
  { id: 'londonbridge', at: { x: 36, z: 32 } },
];

/**
 * You pop out of the Underground at Westminster, under Big Ben, facing the bridge. (The plan's
 * (−40, 12) is in the river once the Thames is 14 m wide, so the station sits a little west.)
 */
const SNAKE_SPAWN = { x: -46, z: 8, heading: -0.45 };

/** A random point on the open map, anywhere (the walkers' isFree check keeps them dry). */
const anywhere = (rng: Rng): Spot => ({ x: rng.range(BOUNDS.minX, BOUNDS.maxX), z: rng.range(BOUNDS.minZ, BOUNDS.maxZ) });
const inside = (rng: Rng, b: Box): Spot => ({ x: rng.range(b.x - b.w / 2, b.x + b.w / 2), z: rng.range(b.z - b.d / 2, b.z + b.d / 2) });

/** Mr Cooper on duty as a London Bobby: polite, dry, a bit grand. Bubbles only. */
const BOBBY: WardenConfig = {
  spawn: { x: -4, z: -38 }, // just east of Nelson's Column
  // The north bank's streets, from the Palace to the City (well clear of the river).
  beat: { minX: -60, maxX: 48, minZ: -58, maxZ: -26 },
  persona: 'bobby',
  lines: {
    general: [
      'No slithering on the Mall, please.',
      'Mind the gap. And the buses. And the pigeons.',
      'Has anyone seen a snake? Last seen on the Northern line.',
      "The King's swans are not for eating, thank you.",
      "Single file across the bridge, if you'd be so kind.",
      'Lovely manners, everyone. Carry on sightseeing.',
      'Who let the corgis out?',
      'Keep to the left, please. This is London.',
      'Queue nicely, everyone. Thank you.',
    ],
    near: [
      'Walking feet. Even in London.',
      'Steady on! This is a city, not a racetrack.',
      'Slow down, please. Mind the tourists.',
      'Move along now. Nothing to eat here.',
    ],
    big: ["I say. You've grown since Tooting.", 'Goodness. Do mind the landmarks, please.'],
    bump: [
      "'Ello 'ello 'ello! What's all this, then?",
      'I beg your pardon!',
      'Mind how you go, sir. Or madam. Or snake.',
    ],
  },
};

export const LONDON: Stage = {
  id: 'london',
  name: 'London',
  bounds: BOUNDS,
  solidBoxes: SOLID_BOXES,
  solidCircles: SOLID_CIRCLES,
  water: [THAMES],
  bridges: BRIDGES,
  snakeSpawn: SNAKE_SPAWN,
  fallbackSpot: { x: 0, z: -32 }, // open paper north of the river, between Trafalgar and St Paul's
  animals: COMMON_ANIMALS, // London's own zoo (corgis, swans, gulls…) arrives in A2
  gulpHints: ['🐿️🐦', '🦔🦆', '🦊🐇', '🦌', '🦌', '🔥🐲'],

  // A big map, like the Common: twice the food. Veg in the parks, lunch leftovers in the streets.
  foodScale: 2,
  foodKindAt: (rng, x, z) => pickFoodKind(rng, inBox(HYDE_PARK, x, z) || inBox(ST_JAMES, x, z) ? WEIGHTS_GREEN : WEIGHTS_YARD),
  homePoint: (rng: Rng, home: string): Spot => {
    switch (home) {
      case 'woods':
      case 'green':
        return inside(rng, HYDE_PARK);
      case 'lagoon':
        return inside(rng, ST_JAMES); // the ducks' lake
      default:
        return anywhere(rng);
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
  cooper: BOBBY,
  routes: [], // the buses and cabs arrive in A3
  landmarks: LANDMARKS,
  plinths: LION_PLINTHS,
  cameraZoom: 0.9,
  paintMinimap: (c, X, Z, scale) => {
    const box = (b: Box) => c.fillRect(X(b.x - b.w / 2), Z(b.z - b.d / 2), b.w * scale, b.d * scale);
    const disc = (p: Circle) => {
      c.beginPath();
      c.arc(X(p.x), Z(p.z), Math.max(1, p.r * scale), 0, Math.PI * 2);
      c.fill();
    };
    const line = (path: readonly Spot[]) => {
      c.beginPath();
      path.forEach((p, i) => (i === 0 ? c.moveTo(X(p.x), Z(p.z)) : c.lineTo(X(p.x), Z(p.z))));
      c.stroke();
    };
    c.fillStyle = '#f3ead2'; // the cream paper
    c.fillRect(0, 0, (BOUNDS.maxX - BOUNDS.minX) * scale, (BOUNDS.maxZ - BOUNDS.minZ) * scale);
    c.fillStyle = '#9ccc7a'; // the parks
    for (const b of [HYDE_PARK, ST_JAMES]) box(b);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.strokeStyle = '#c9c3b4'; // the streets
    for (const r of ROADS) {
      c.lineWidth = Math.max(1, r.width * scale * 0.7);
      line(r.path);
    }
    c.strokeStyle = '#5aa9e6'; // the Thames
    c.lineWidth = THAMES.width * scale;
    c.lineCap = 'butt';
    line(THAMES.path);
    c.fillStyle = '#b9a98a'; // the bridges
    for (const b of BRIDGES) box(b);
    c.fillStyle = '#4a4038'; // the landmarks' footprints
    for (const b of SOLID_BOXES) box(b);
    for (const p of SOLID_CIRCLES) disc(p);
  },
};
