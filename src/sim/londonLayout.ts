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
 * draws it. London has its own menu (zone by zone, food.ts) and its own zoo (animals.ts).
 */

import { LONDON_ANIMALS } from './animals';
import type { CreatureKind } from './creatures';
import type { WardenConfig } from './cooper';
import { foodWeights, pickFoodKind } from './food';
import { TRIP_THROWS } from './kids';
import type { Box, Circle } from './layout';
import { inBox } from './layout';
import type { Rng } from './rng';
import type { Landmark, Portal, Route, Spot, Stage, Terrain, WaterZone } from './stage';
import { alongPath, type Pier, type SetPieceSpots } from './setPieces';
import { laneLoop, type VehicleKind } from './vehicles';
import { inWater } from './water';

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
/**
 * Tower Bridge's two bascules: the road between the towers' inner faces (59.8 + 1.5 to 70.2 − 1.5),
 * split down the middle. When they lift (A6) this span is river, and the deck is just its two ends.
 */
export const TOWER_BRIDGE_SPAN: Box = { x: 65, z: TOWER_BRIDGE.z, w: 7.4, d: TOWER_BRIDGE.d };
const SPAN_W = TOWER_BRIDGE_SPAN.x - TOWER_BRIDGE_SPAN.w / 2;
const SPAN_E = TOWER_BRIDGE_SPAN.x + TOWER_BRIDGE_SPAN.w / 2;
const DECK_W = TOWER_BRIDGE.x - TOWER_BRIDGE.w / 2;
const DECK_E = TOWER_BRIDGE.x + TOWER_BRIDGE.w / 2;
/** The bridges while Tower Bridge is up: its span lifted out, its two ends still there. */
export const BRIDGES_LIFTED: Box[] = [
  WESTMINSTER_BRIDGE, MILLENNIUM_BRIDGE,
  { x: (DECK_W + SPAN_W) / 2, z: TOWER_BRIDGE.z, w: SPAN_W - DECK_W, d: TOWER_BRIDGE.d },
  { x: (SPAN_E + DECK_E) / 2, z: TOWER_BRIDGE.z, w: DECK_E - SPAN_E, d: TOWER_BRIDGE.d },
];

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
export const SHARD: Box = { x: 52, z: 42, w: 9, d: 9 };
/** The Gherkin: round, at the north edge of the City. */
export const GHERKIN: Circle = { x: 50, z: -52, r: 3.5 };
/** Shakespeare's Globe: round, white, thatched, on Bankside. */
export const GLOBE: Circle = { x: 18, z: 12, r: 4 };
/** Piccadilly Circus: the little winged statue's fountain, and the light screens on the north edge. */
export const PICCADILLY_FOUNTAIN: Circle = { x: -30, z: -50, r: 1.6 };
export const PICCADILLY_SCREENS: Box = { x: -30, z: -62.5, w: 16, d: 5 };
/** The Natural History Museum: a long terracotta front. */
export const MUSEUM: Box = { x: -66, z: 0, w: 16, d: 7 };

// ---------------------------------------------------------------- the people (A4)

/**
 * The Royal Guard, in his sentry box at the head of the Mall by the Palace (out of the traffic, so a
 * snake can circle him in peace). He never moves: a fixed solid, the sentry box behind him included.
 */
export const GUARD: Spot = { x: -40, z: -28.5 };
export const GUARD_R = 0.75;
/** Miss Sami the tour guide, by the Tube exit at Westminster where you arrive. */
export const SAMI: Spot = { x: -49.5, z: 5.5 };
/** The Beefeater at the Tower's river gate, his back to the wall. */
export const BEEFEATER: Spot = { x: 62, z: -9.5 };
/** The living statue in Covent Garden, and the two buskers playing near him. */
export const STATUE: Spot = { x: 15, z: -47 };
export const BUSKERS: Spot[] = [{ x: 3, z: -51 }, { x: 10, z: -53 }];
/** Each tourist's sight (Westminster twice: Miss Sami's group), all well clear of the traffic. */
export const TOURIST_SPOTS: Spot[] = [
  { x: -44, z: 4 }, { x: -42, z: 7 }, { x: -12, z: -35 }, { x: -45, z: -31 }, { x: 28, z: -50 }, { x: -36, z: -54 },
];
/**
 * The school trip's walk: round and round the lake in St James's Park, clear of the buses. A circle,
 * not a lap with corners: a crocodile turning a hairpin would fold round a snake and trap it.
 */
export const TRIP_PATH: Spot[] = Array.from({ length: 24 }, (_, i) => {
  const a = (-i / 24) * Math.PI * 2; // anticlockwise on the map
  return { x: -26 + Math.cos(a) * 4.6, z: -28.6 + Math.sin(a) * 4.6 };
});
// ---------------------------------------------------------------- the legends (A5)

/**
 * The Elfin Oak: a real carved tree stump full of fairies, in Kensington Gardens (the west end of
 * our Hyde Park). The legends gather in the glade round it; the stump itself is a small solid.
 */
export const ELFIN_OAK: Circle = { x: -76, z: -52, r: 1 };
/**
 * Where the Crown Jewels may lie: landmark-adjacent open paper, on land, off the bus lanes. The first
 * (just west of the Tower's walls) is always used; the other four are drawn per run (treasures.ts).
 */
export const JEWEL_SPOTS: Spot[] = [
  { x: 52, z: -18 }, // the Tower
  { x: -12, z: -35 }, // Trafalgar Square, south of the column
  { x: 44, z: 46 }, // the Shard
  { x: 42, z: -57 }, // the Gherkin
  { x: 25, z: 20 }, // the Globe
  { x: -37, z: -53 }, // Piccadilly Circus
  { x: -66, z: 8 }, // the Natural History Museum
  { x: 8, z: -46 }, // Covent Garden
  { x: -30, z: 40 }, // the South Bank
  { x: -62, z: -34 }, // Hyde Park
  { x: 33, z: -32 }, // St Paul's, toward the river
];

/** Grown-ups standing still are solids, a little narrower than they look. */
const PERSON_R = 0.45;

const SOLID_BOXES: Box[] = [
  BIG_BEN, PARLIAMENT, PALACE, ST_PAULS_NAVE, TOWER, ...TOWER_LEGS, SHARD, PICCADILLY_SCREENS, MUSEUM,
];
const SOLID_CIRCLES: Circle[] = [
  LONDON_EYE, VICTORIA_MEMORIAL, NELSON, ...LION_PLINTHS.map((p) => ({ ...p, r: PLINTH_R })),
  ST_PAULS_DOME, GHERKIN, GLOBE, PICCADILLY_FOUNTAIN,
  { ...GUARD, r: GUARD_R }, { ...SAMI, r: PERSON_R }, { ...BEEFEATER, r: 0.5 }, { ...STATUE, r: PERSON_R },
  ELFIN_OAK,
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
/** St James's Park's lake (painted, like the Serpentine: not swimming water). Swans and ducks live on its banks. */
export const ST_JAMES_LAKE = { x: ST_JAMES.x + 1, z: ST_JAMES.z + 0.5, rx: 5.5, rz: 1.8, rot: 0.1 };
/** The City: St Paul's across to the Gherkin and the Bank (bagels and pies). */
const THE_CITY: Box = { x: 38, z: -46, w: 36, d: 26 };
/** In front of the Palace and round the Victoria Memorial: the garden party (and the corgis). */
const PALACE_GARDEN: Box = { x: -46, z: -27, w: 22, d: 10 };

/** A painted street (cream with ink edges), for the ground painter and, later, the buses. */
export interface Road {
  id: string;
  path: readonly Spot[];
  width: number;
}

/** The streets: the Mall, the Strand, the Embankment, the south bank road and the outer ring. The bus and cab roads are wider (two lanes). */
export const ROADS: Road[] = [
  { id: 'mall', path: [{ x: -38, z: -24 }, { x: -24, z: -33 }, { x: -14, z: -40 }], width: 5 }, // the red road
  { id: 'piccadilly', path: [{ x: -56, z: -30 }, { x: -40, z: -42 }, { x: -30, z: -50 }, { x: -18, z: -44 }], width: 4 },
  { id: 'strand', path: [{ x: -12, z: -42 }, { x: 4, z: -39 }, { x: 16, z: -35 }, { x: 34, z: -33 }, { x: 48, z: -28 }, { x: 62, z: -26 }], width: 5.2 },
  { id: 'whitehall', path: [{ x: -12, z: -42 }, { x: -24, z: -26 }, { x: -34, z: -14 }], width: 4 },
  { id: 'embankment', path: [{ x: -36, z: -14 }, { x: -18, z: -22 }, { x: 0, z: -24 }, { x: 22, z: -20 }, { x: 44, z: -9 }, { x: 74, z: -6 }], width: 5.2 },
  { id: 'southbank', path: [{ x: -8, z: 4 }, { x: -18, z: 14 }, { x: -30, z: 26 }, { x: -50, z: 34 }], width: 4 },
  // Bankside, swinging south of the Globe (the 13 bus runs it).
  { id: 'borough', path: [{ x: -7, z: 6 }, { x: 4, z: 7.5 }, { x: 10, z: 18 }, { x: 24, z: 24 }, { x: 40, z: 28 }, { x: 53, z: 30 }], width: 5.2 },
  // Over Tower Bridge and up the east bank to the Embankment.
  { id: 'towerbridge', path: [{ x: 77, z: 30 }, { x: 80, z: 16 }, { x: 78, z: 2 }, { x: 74, z: -6 }], width: 5.2 },
  { id: 'kensington', path: [{ x: -84, z: -8 }, { x: -58, z: -11 }, { x: -48, z: -13.2 }, { x: -36, z: -15 }], width: 5.2 },
  // Past Big Ben to Westminster Bridge (the bus to the South Bank), and the City's back way to Tower Bridge (the cabs').
  { id: 'westminster', path: [{ x: -36, z: -14 }, { x: -36, z: 0 }, { x: -30, z: 2 }], width: 5.2 },
  { id: 'minories', path: [{ x: 62, z: -26 }, { x: 73, z: -25 }, { x: 78, z: -14 }, { x: 78, z: 2 }], width: 5.2 },
];

/** Distance from (x, z) to a polyline. */
export function distanceToPath(path: readonly Spot[], x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i];
    const b = path[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const t = Math.min(1, Math.max(0, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
  }
  return best;
}

/** Distance from (x, z) to the Thames' centre line. */
export function riverDistance(x: number, z: number): number {
  return distanceToPath(THAMES.path, x, z);
}

/** Is (x, z) clear of the river and of every landmark (for paint and street furniture alike)? */
export function clearOfSights(x: number, z: number, margin: number): boolean {
  if (riverDistance(x, z) < THAMES.width / 2 + margin) return false;
  for (const l of LANDMARKS) if (Math.hypot(x - l.at.x, z - l.at.z) < Math.min(l.radius, 9) + margin) return false;
  return true;
}

/** A zebra crossing: centre, the road's direction there (radians, in the x/z plane) and the road width. */
export interface Zebra {
  x: number;
  z: number;
  angle: number;
  width: number;
}

/**
 * The zebra crossings: one at the middle of each longer street segment, where it is dry and open.
 * Painted by the ground, and every bus and cab stops for anyone on one (vehicles.ts).
 */
export const ZEBRAS: Zebra[] = ROADS.flatMap((r: Road) => {
  const out: Zebra[] = [];
  for (let i = 0; i + 1 < r.path.length; i++) {
    const a = r.path[i];
    const b = r.path[i + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 14) continue;
    const x = (a.x + b.x) / 2;
    const z = (a.z + b.z) / 2;
    if (!clearOfSights(x, z, 3)) continue;
    out.push({ x, z, angle: Math.atan2(b.z - a.z, b.x - a.x), width: r.width });
  }
  return out;
});

// ---------------------------------------------------------------- traffic (A3)

/**
 * The bus and cab routes, as road centre lines (each vertex on a painted street) with their stops
 * as vertex indices. Each becomes a lane loop: out on the left, round, and back (laneLoop). Laid
 * so that a whole bus, swinging round its corners and its turn at each end, stays clear of every
 * solid and out of the river (bridges excepted), with room to spare; and well away from the lions.
 */
const line = (pts: [number, number][]): Spot[] => pts.map(([x, z]) => ({ x, z }));
const ROUTE_LINES: { id: string; center: Spot[]; stops: number[]; lane?: number }[] = [
  // The 11: South Kensington, along the Embankment to Blackfriars.
  {
    id: 'bus-north',
    center: line([[-78, -8.5], [-72, -9.25], [-58, -11], [-48, -13.2], [-36, -15], [-18, -22], [-12.6, -22.6], [0, -24], [22, -20], [28.6, -16.7], [44, -9]]),
    stops: [1, 6, 9],
  },
  // The 12: Parliament Square, over Westminster Bridge and down Bankside to Borough.
  {
    id: 'bus-south',
    center: line([[-36, 0], [-30, 2], [-12, 2], [-7, 6], [4, 7.5], [5.8, 10.65], [10, 18], [24, 24], [28.8, 25.2], [40, 28]]),
    stops: [1, 5, 8],
  },
  // The cabs: the Strand to the Tower, and over Tower Bridge.
  {
    id: 'cab',
    center: line([[8, -37.67], [16, -35], [34, -33], [48, -28], [62, -26], [73, -25], [78, -14], [78, 2], [80, 16], [77, 30], [52, 30]]),
    stops: [],
    lane: 0.95, // cabs are narrower: the lanes sit closer, so there is room by Tower Bridge's legs
  },
];

export const ROUTES: Route[] = ROUTE_LINES.map(({ id, center, stops, lane }) => ({ id, loop: true, ...laneLoop(center, stops, lane) }));

/** Five buses and three cabs. */
const TRAFFIC: { kind: VehicleKind; route: string; count: number }[] = [
  { kind: 'bus', route: 'bus-north', count: 3 },
  { kind: 'bus', route: 'bus-south', count: 2 },
  { kind: 'cab', route: 'cab', count: 3 },
];

// ---------------------------------------------------------------- the ravens' perches

/**
 * The raven pair's homes: two of the six ravens on the Tower's south wall walk (tower.ts draws the
 * other four, and these two whenever their birds are at home). At `RAVEN_PERCH_Y` metres up.
 */
export const RAVEN_PERCHES: Spot[] = [
  { x: TOWER.x - 1.2, z: TOWER.z + TOWER.d / 2 - 0.27 },
  { x: TOWER.x + 4.6, z: TOWER.z + TOWER.d / 2 - 0.27 },
];
export const RAVEN_PERCH_Y = 3.2;

/** The Tube stations: step in at one, pop out at the next (A6). Westminster is where you arrive. */
export const TUBE: Portal[] = [
  { id: 'westminster', at: { x: -46, z: 8 } },
  { id: 'piccadilly', at: { x: -24, z: -56 } },
  { id: 'southken', at: { x: -62, z: 8 } },
  { id: 'bank', at: { x: 38, z: -46 } },
  { id: 'towerhill', at: { x: 54, z: -34 } }, // off the cabs' lane
  { id: 'londonbridge', at: { x: 36, z: 32 } },
];

/** The stations' names, for their roundel signs and the mini tube map (place names, in TUBE order). */
export const TUBE_NAMES: Record<string, string> = {
  westminster: 'WESTMINSTER', piccadilly: 'PICCADILLY', southken: 'SOUTH KEN',
  bank: 'BANK', towerhill: 'TOWER HILL', londonbridge: 'LONDON BRIDGE',
};

// ---------------------------------------------------------------- the set pieces (A6)

/**
 * The river bus's piers: Westminster (on the Embankment, just downstream of the bridge), Bankside
 * (by the Globe) and Tower (below the Tower's walls). Each boarding spot is dry bank a metre off the
 * water, opposite where the boat ties up on the river's centre line.
 */
export const PIERS: Pier[] = [
  { id: 'westminster', at: { x: -20.5, z: -5 }, board: { x: -27.7, z: -8.6 }, out: Math.atan2(-3.6, -7.2) },
  { id: 'bankside', at: { x: 16, z: -9.2 }, board: { x: 13.7, z: -1.5 }, out: Math.atan2(7.7, -2.3) },
  { id: 'tower', at: { x: 51.4, z: 7.4 }, board: { x: 54.1, z: -0.1 }, out: Math.atan2(-7.5, 2.7) },
];

/** Where the fireworks burst: evenly along the river from Westminster to Tower Bridge. */
const FIREWORK_SPOTS: Spot[] = Array.from({ length: 9 }, (_, i) => {
  const p = { x: 0, z: 0, heading: 0 };
  alongPath(THAMES.path, 50 + i * 14, p);
  return { x: p.x, z: p.z };
});

export const SET_PIECES: SetPieceSpots = {
  bigBen: { x: BIG_BEN.x, z: BIG_BEN.z },
  // The bottom capsule hangs over the strip of bank between the Eye's legs and the water.
  eye: { board: { x: -6, z: -4.4 }, exit: { x: -1.5, z: -1.5 }, heading: 0 },
  span: TOWER_BRIDGE_SPAN,
  bridgesUp: BRIDGES_LIFTED,
  millennium: MILLENNIUM_BRIDGE,
  // From the Palace gates down the Mall, stopping short of Trafalgar's lions.
  parade: [{ x: -35.5, z: -25.6 }, { x: -24, z: -33 }, { x: -20.5, z: -35.5 }],
  piers: PIERS,
  river: THAMES.path,
  // Along the river, corner to corner, and north–south over Trafalgar Square.
  arrows: [
    [{ x: -100, z: 22 }, { x: 100, z: 4 }],
    [{ x: -100, z: -62 }, { x: 100, z: 56 }],
    [{ x: -22, z: -82 }, { x: 12, z: 82 }],
  ],
  fireworks: FIREWORK_SPOTS,
};

/**
 * You pop out of the Underground at Westminster, under Big Ben, facing the bridge. (The plan's
 * (−40, 12) is in the river once the Thames is 14 m wide, so the station sits a little west.)
 */
const SNAKE_SPAWN = { x: -46, z: 8, heading: -0.45 };

/** A random point on the open map, anywhere (the walkers' isFree check keeps them dry). */
const anywhere = (rng: Rng): Spot => ({ x: rng.range(BOUNDS.minX, BOUNDS.maxX), z: rng.range(BOUNDS.minZ, BOUNDS.maxZ) });
const inside = (rng: Rng, b: Box): Spot => ({ x: rng.range(b.x - b.w / 2, b.x + b.w / 2), z: rng.range(b.z - b.d / 2, b.z + b.d / 2) });

// ---------------------------------------------------------------- the menu and the zoo

/** The river with no bridges in it: "near the water" for food, bridges included. */
const RIVER_ONLY: Terrain = { bounds: BOUNDS, solidBoxes: [], solidCircles: [], water: [THAMES] };
const near = (x: number, z: number, p: Spot, r: number) => (x - p.x) ** 2 + (z - p.z) ** 2 < r * r;

/** What grows where (docs/LEVEL3-LONDON.md §4), checked in this order. */
const MENU = {
  /** Trafalgar Square and Piccadilly Circus: jelly babies. */
  sweets: foodWeights({ jellybaby: 5, biscuit: 1 }),
  /** Covent Garden market: fruit (and a scone). */
  market: foodWeights({ apple: 3, strawberry: 3, scone: 1 }),
  /** Borough Market: veg and a pie. */
  borough: foodWeights({ broccoli: 3, carrot: 3, pie: 2 }),
  /** The South Bank: crumpets, sausage rolls, chips. */
  southBank: foodWeights({ crumpet: 3, sausageroll: 2, fishchips: 2 }),
  /** The City: bagels and pies. */
  city: foodWeights({ bagel: 3, pie: 2, tea: 1 }),
  /** The Palace and St James's Park: afternoon tea. */
  palace: foodWeights({ sandwich: 3, scone: 3, sponge: 2, tea: 2 }),
  /** Hyde Park: strawberries and a picnic. */
  park: foodWeights({ strawberry: 3, sandwich: 1, biscuit: 1, apple: 1 }),
  /** Along the Thames: fish and chips. */
  river: foodWeights({ fishchips: 4, sausageroll: 1, tea: 1 }),
  /** Everywhere else: a London street mix. */
  street: foodWeights({ sausageroll: 3, biscuit: 2.5, tea: 2, sandwich: 0.7, scone: 0.5, pie: 0.5, fishchips: 0.4, jellybaby: 0.4 }),
};

function menuAt(x: number, z: number): readonly number[] {
  if (near(x, z, NELSON, 9) || near(x, z, PICCADILLY_FOUNTAIN, 9)) return MENU.sweets;
  if (inBox(COVENT_GARDEN, x, z)) return MENU.market;
  if (inBox(BOROUGH, x, z)) return MENU.borough;
  if (inBox(SOUTH_BANK, x, z)) return MENU.southBank;
  if (inBox(THE_CITY, x, z)) return MENU.city;
  if (inBox(PALACE_GARDEN, x, z) || inBox(ST_JAMES, x, z)) return MENU.palace;
  if (inBox(HYDE_PARK, x, z)) return MENU.park;
  if (inWater(RIVER_ONLY, x, z, 5)) return MENU.river;
  return MENU.street;
}

/** A point on the bank of a painted lake, just off the water: swans and ducks are walkers. */
function lakeside(rng: Rng): Spot {
  const e = rng.next() < 0.5 ? SERPENTINE : ST_JAMES_LAKE;
  const t = rng.range(0, Math.PI * 2);
  const u = (e.rx + 1) * Math.cos(t);
  const v = (e.rz + 1) * Math.sin(t);
  return { x: e.x + u * Math.cos(e.rot) - v * Math.sin(e.rot), z: e.z + u * Math.sin(e.rot) + v * Math.cos(e.rot) };
}

/** A point along a street (and a little either side of its middle). */
function alongRoad(rng: Rng, path: readonly Spot[], spread: number): Spot {
  const i = rng.int(path.length - 1);
  const t = rng.next();
  return {
    x: path[i].x + (path[i + 1].x - path[i].x) * t + rng.range(-spread, spread),
    z: path[i].z + (path[i + 1].z - path[i].z) * t + rng.range(-spread, spread),
  };
}

const roadPath = (id: string): readonly Spot[] => ROADS.find((r) => r.id === id)!.path;

/** A point on a ring between `r0` and `r1` metres round (x, z). */
const around = (rng: Rng, x: number, z: number, r0: number, r1: number): Spot => {
  const a = rng.range(0, Math.PI * 2);
  const d = rng.range(r0, r1);
  return { x: x + Math.cos(a) * d, z: z + Math.sin(a) * d };
};

/**
 * Each legend's haunt: the Elfin Oak's glade for the fairy and the unicorn, the river bank (on land)
 * for the mermaid, the Tower for its ghost, St Paul's for the phoenix, the City for the dragon and
 * the Guildhall giants, the Palace for the royal lion, Covent Garden's market for the pearly lights.
 */
function legendHome(rng: Rng, kind: CreatureKind): Spot {
  switch (kind) {
    case 'fairy':
    case 'unicorn':
      return around(rng, ELFIN_OAK.x, ELFIN_OAK.z, 2.5, 8);
    case 'mermaid': {
      // Just off the water's edge, either bank, somewhere along the river.
      const path = THAMES.path;
      const i = rng.int(path.length - 1);
      const t = rng.next();
      const x = path[i].x + (path[i + 1].x - path[i].x) * t;
      const z = path[i].z + (path[i + 1].z - path[i].z) * t;
      const dx = path[i + 1].x - path[i].x;
      const dz = path[i + 1].z - path[i].z;
      const len = Math.hypot(dx, dz) || 1;
      const side = rng.next() < 0.5 ? -1 : 1;
      const off = THAMES.width / 2 + rng.range(1.8, 3.5);
      return { x: x - (dz / len) * off * side, z: z + (dx / len) * off * side };
    }
    case 'ghost':
      return around(rng, TOWER.x, TOWER.z, 9, 14);
    case 'phoenix':
      return around(rng, ST_PAULS_DOME.x - 3, ST_PAULS_DOME.z, 7, 12);
    case 'dragon':
    case 'gog':
      return inside(rng, THE_CITY);
    case 'lionroyal':
      return inside(rng, PALACE_GARDEN);
    case 'pearly':
      return inside(rng, COVENT_GARDEN);
    default:
      return anywhere(rng);
  }
}

/** Miss Sami as a tour guide, umbrella up. Warm, a little breathless, bubbles only. */
const SAMI_TOUR = [
  'Keep together, everyone!',
  "Big Ben's this way!",
  'Mind the gap!',
  'Look — the London Eye!',
  'Who wants a scone?',
  'Follow the umbrella, please!',
  "Wave to the guard. He won't wave back!",
  'Lovely! Tea at four o’clock.',
  'Ooh, a red bus! Wave, everyone!',
  'Mind the river, poppets.',
];

/** Mr Bramble, on duty at the Tower as a Beefeater. Dry as ever. */
const BEEFEATER_LINES = [
  'Mind the ravens. They bite. Politely.',
  'Six ravens, always six!',
  'The jewels are not for snacking.',
  'Welcome to the Tower!',
  'Nine hundred years old. Still no lift.',
  'No slithering on the battlements, please.',
  'Ravens first, then snakes. Queue nicely.',
];

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
  animals: LONDON_ANIMALS,
  // A big flock in Trafalgar Square, ducks on both lakes.
  animalCounts: { pigeon: 10, duck: 4 },
  animalHomes: { pigeon: 'trafalgar' },
  // Swans are never gulped, so they are never hinted. The pelican has no emoji: the goose stands in.
  gulpHints: ['🐦🐿️', '🦆🐶', '🕊️', '🪿', '🐴', '🦖'],

  // A big map, like the Common: twice the food, zone by zone (see MENU).
  foodScale: 2,
  foodKindAt: (rng, x, z) => pickFoodKind(rng, menuAt(x, z)),
  homePoint: (rng: Rng, home: string): Spot => {
    switch (home) {
      case 'woods':
      case 'green':
        return rng.next() < 0.75 ? inside(rng, HYDE_PARK) : inside(rng, ST_JAMES); // squirrels in the parks
      case 'lagoon':
      case 'lake':
        return lakeside(rng); // the swans', ducks' and pelicans' banks
      case 'palace':
        return alongRoad(rng, roadPath('mall'), 3); // the corgis and the guard horse, on the Mall
      case 'trafalgar':
        return { x: NELSON.x + rng.range(-7, 7), z: NELSON.z + rng.range(-6, 6) };
      case 'river':
        return alongRoad(rng, rng.next() < 0.6 ? roadPath('embankment') : roadPath('southbank'), 2); // gulls on the Embankment
      case 'museum':
        return { x: MUSEUM.x + rng.range(-8, 8), z: MUSEUM.z + MUSEUM.d / 2 + rng.range(1.5, 5) };
      default:
        return anywhere(rng);
    }
  },
  sanctuary: null,
  // Dropped umbrellas, roadworks and the odd puddle, anywhere open (and never on a bus route).
  hazardArea: { rough: BOUNDS, share: 0 },
  hazardKinds: ['puddle', 'umbrella', 'roadworks'],
  logs: [],
  // The four Trafalgar lions (one per plinth, in LION_PLINTHS order) and the Tower's raven pair.
  predators: [{ kind: 'lion', count: LION_PLINTHS.length }, { kind: 'raven', count: RAVEN_PERCHES.length }],
  // Six tourists, the school trip (the teacher and eight children on the rope), two buskers.
  kids: [...TOURIST_SPOTS.map(() => 'tourist' as const), ...TRIP_THROWS.map(() => 'trip' as const), ...BUSKERS.map(() => 'busker' as const)],
  touristSpots: TOURIST_SPOTS,
  buskerSpots: BUSKERS,
  tripPath: TRIP_PATH,
  statue: STATUE,
  guard: GUARD,
  chatters: [
    { id: 'sami', at: SAMI, lines: SAMI_TOUR },
    { id: 'beefeater', at: BEEFEATER, lines: BEEFEATER_LINES },
  ],
  // Five of the nine legends each run, picked by rarity (the Silver Dragon is a lucky day).
  creatureCount: 5,
  creatureKinds: ['dragon', 'unicorn', 'lionroyal', 'phoenix', 'mermaid', 'ghost', 'gog', 'fairy', 'pearly'],
  creatureHome: legendHome,
  jewelSpots: JEWEL_SPOTS,
  // Big and open, so four more rivals keep it lively (as on the Common).
  extraRivals: 4,
  greeters: null,
  cooper: BOBBY,
  routes: ROUTES,
  traffic: TRAFFIC,
  zebras: ZEBRAS,
  perches: RAVEN_PERCHES,
  landmarks: LANDMARKS,
  plinths: LION_PLINTHS,
  portals: TUBE,
  setPieces: SET_PIECES,
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
    c.fillStyle = 'rgba(74,64,56,0.35)'; // the landmarks' footprints, faint under their icons
    for (const b of SOLID_BOXES) box(b);
    for (const p of SOLID_CIRCLES) disc(p);
    for (const l of LANDMARKS) paintIcon(c, l.id, X(l.at.x), Z(l.at.z), scale);
    // The Tube stations: a little red ring with a blue bar.
    for (const t of TUBE) {
      const r = 2.2 * scale;
      c.lineWidth = Math.max(1.5, 0.9 * scale);
      c.strokeStyle = '#dc241f';
      c.beginPath();
      c.arc(X(t.at.x), Z(t.at.z), r, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = '#1d2a8c';
      c.fillRect(X(t.at.x) - r * 1.35, Z(t.at.z) - 0.45 * scale, r * 2.7, 0.9 * scale);
    }
  },
};

/**
 * A tiny picture of each sight for the minimap, centred on (cx, cy), drawn in metres × `u` px:
 * a gold clock tower for Big Ben, a ring for the Eye, a blue glass spike for the Shard, and so on.
 */
function paintIcon(c: CanvasRenderingContext2D, id: string, cx: number, cy: number, u: number): void {
  const ink = '#2b2118';
  c.save();
  c.translate(cx, cy);
  c.scale(u * 1.5, u * 1.5); // a touch larger than life: the minimap is small
  c.lineWidth = 0.9;
  c.lineJoin = 'round';
  c.strokeStyle = ink;
  const rect = (x: number, y: number, w: number, h: number, fill: string) => {
    c.fillStyle = fill;
    c.fillRect(x, y, w, h);
    c.strokeRect(x, y, w, h);
  };
  const poly = (pts: number[], fill: string) => {
    c.beginPath();
    for (let i = 0; i < pts.length; i += 2) (i === 0 ? c.moveTo : c.lineTo).call(c, pts[i], pts[i + 1]);
    c.closePath();
    c.fillStyle = fill;
    c.fill();
    c.stroke();
  };
  const dot = (x: number, y: number, r: number, fill: string) => {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = fill;
    c.fill();
    c.stroke();
  };
  switch (id) {
    case 'bigben': // a gold tower with a white clock and a pointed slate top
      rect(-2, -4, 4, 9, '#e2b85c');
      poly([-2.4, -4, 2.4, -4, 0, -9], '#434a57');
      dot(0, -1.5, 1.3, '#fffbea');
      break;
    case 'eye': // the wheel
      c.beginPath();
      c.arc(0, -1, 5, 0, Math.PI * 2);
      c.lineWidth = 2.6;
      c.stroke();
      c.lineWidth = 1.4;
      c.strokeStyle = '#ffffff';
      c.stroke();
      c.strokeStyle = ink;
      c.lineWidth = 0.9;
      poly([-2.5, 5, 0, -1, 2.5, 5], 'rgba(0,0,0,0)');
      dot(0, -1, 0.9, '#8cc8ec');
      break;
    case 'palace': // a long cream front with a red flag on top
      rect(-7, -2.5, 14, 5, '#f1e6cc');
      c.beginPath();
      c.moveTo(0, -2.5);
      c.lineTo(0, -7);
      c.stroke();
      rect(0, -7, 3, 2, '#d8342c');
      break;
    case 'trafalgar': // Nelson's column on its plinth
      rect(-0.8, -8, 1.6, 10, '#d9cdb3');
      dot(0, -8.5, 1.2, '#a89c86');
      rect(-3, 2, 6, 2, '#d9cdb3');
      break;
    case 'stpauls': // the great grey dome and its golden cross
      rect(-5, 0, 10, 4, '#f1ebdc');
      c.beginPath();
      c.arc(0, 0, 4, Math.PI, 0);
      c.closePath();
      c.fillStyle = '#c9ccd0';
      c.fill();
      c.stroke();
      rect(-0.5, -6.5, 1, 2.5, '#f2c230');
      break;
    case 'tower': // a square keep with four turrets
      rect(-4.5, -4.5, 9, 9, '#efe6d0');
      for (const [x, y] of [[-4.5, -4.5], [4.5, -4.5], [-4.5, 4.5], [4.5, 4.5]]) dot(x, y, 1.6, '#e5dac0');
      break;
    case 'towerbridge': // two towers and the blue walkway between them
      rect(-6, -1.2, 12, 2.4, '#8cc8ec');
      rect(-7.5, -3, 3.4, 6, '#d9cdb3');
      rect(4.1, -3, 3.4, 6, '#d9cdb3');
      break;
    case 'shard': // a tall glass spike
      poly([-4, 4.5, 4, 4.5, 0.4, -9, -0.4, -9], '#8ec9ea');
      break;
    case 'gherkin': // a green egg
      c.beginPath();
      c.ellipse(0, -1.5, 3, 5.5, 0, 0, Math.PI * 2);
      c.fillStyle = '#5c9e3c';
      c.fill();
      c.stroke();
      break;
    case 'globe': // a round white theatre under a thatched ring
      dot(0, 0, 4.5, '#c9a25a');
      dot(0, 0, 2.5, '#f8f1df');
      break;
    case 'piccadilly': // the bright light screens
      rect(-6, -3, 4, 4, '#ff5fa2');
      rect(-2, -3, 4, 4, '#ffd23f');
      rect(2, -3, 4, 4, '#3fb6ff');
      dot(0, 4, 1.4, '#d9cdb3');
      break;
    case 'museum': // a long terracotta front with two towers
      rect(-7, -1.5, 14, 5, '#c9714b');
      rect(-2.6, -6, 2, 5, '#c9714b');
      rect(0.6, -6, 2, 5, '#c9714b');
      break;
  }
  c.restore();
}
