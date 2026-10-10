import type { AnimalKind, Home } from './animals';
import type { WardenConfig } from './cooper';
import type { CreatureKind } from './creatures';
import type { FoodKind } from './food';
import type { HazardKind } from './hazards';
import type { KidKind } from './kids';
import type { Box, Circle } from './layout';
import type { PredatorKind } from './predators';
import type { Rng } from './rng';
import type { SetPieceSpots } from './setPieces';
import type { VehicleKind } from './vehicles';

/**
 * A stage is a place to play: its fence and fixed solids (what collision needs), where things
 * spawn and live, and who patrols it. Level 1 is the school; Level 2 is the Common; Level 3 is London.
 *
 * The sim never reads a layout as a module global: everything takes the stage it is running on,
 * because the server runs many rooms in one process and they need not all be the same place.
 */

export type StageId = 'school' | 'common' | 'london';
export const STAGE_IDS: readonly StageId[] = ['school', 'common', 'london'];
export const asStage = (value: unknown): StageId => (STAGE_IDS.includes(value as StageId) ? (value as StageId) : 'school');

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Spot {
  x: number;
  z: number;
}

/** A river: a ribbon `width` metres wide along `path` (west to east); its current runs downstream along the path at |`drift`| m/s. */
export interface WaterZone {
  path: readonly Spot[];
  width: number;
  drift: Spot;
}

/** A road vehicles drive (buses, cabs): a polyline, closed when `loop`, with stops at path indices. */
export interface Route {
  id: string;
  path: readonly Spot[];
  loop: boolean;
  stops: readonly number[];
}

/** A Tube station: step in at one, pop out at another. */
export interface Portal {
  id: string;
  at: Spot;
}

/** A sight worth a stamp: its centre, and how close counts as a visit. */
export interface Landmark {
  id: string;
  at: Spot;
  radius: number;
}

/** Someone standing about with a few things to say (generalises the Common's `greeters`). */
export interface Chatter {
  id: string;
  at: Spot;
  lines: readonly string[];
}

/** What collision needs: the fence and the fixed solids. Per-world extras (rocks) come on top. */
export interface Terrain {
  bounds: Bounds;
  solidBoxes: readonly Box[];
  solidCircles: readonly Circle[];
  /** Rivers to swim (slowly). Unset: none, and no water branch ever runs. */
  water?: readonly WaterZone[];
  /** Walkable decks across the water. */
  bridges?: readonly Box[];
}

export interface Stage extends Terrain {
  id: StageId;
  name: string;
  /** Where the player starts, and the heading they face. */
  snakeSpawn: Spot & { heading: number };
  /** A known-open spot well away from the snake spawn: the last resort when nothing else fits. */
  fallbackSpot: Spot;
  /** Which animal kinds live here (and how many, via each kind's `count`). */
  animals: readonly AnimalKind[];
  /** How many of a kind live here, where it differs from the kind's own `count` (London's big pigeon flock). */
  animalCounts?: Partial<Record<AnimalKind, number>>;
  /** Where a kind lives here, where it differs from the kind's own `home` (London's pigeons in Trafalgar Square). */
  animalHomes?: Partial<Record<AnimalKind, Home>>;
  /** The HUD's "what the next size can gulp" hint, one emoji string per size tier (stage-specific). */
  gulpHints: readonly string[];
  /** Which food grows where. */
  foodKindAt(rng: Rng, x: number, z: number): FoodKind;
  /** A random point in an animal's home turf ('green', 'lagoon', 'anywhere'…: names the stage understands). */
  homePoint(rng: Rng, home: string): Spot;
  /** Nobody can be bonked inside this box (the blue sail at school). Null: no sanctuary. */
  sanctuary: Box | null;
  /** Multiplies the mode's food count, so a bigger stage stays worth foraging. School: 1. */
  foodScale: number;
  /** Static hazards (rocks, sticks): a corner that gets more than its share. Null: none spawn. */
  hazardArea: { rough: Bounds; share: number } | null;
  /**
   * Which hazards this stage scatters, drawn from in this order. Its own list, not all of
   * HAZARD_KINDS, so a new stage's kinds never change what the school's RNG picks.
   */
  hazardKinds: readonly HazardKind[];
  /** Solid things the snake goes round but the children clamber over (the Common's fallen log). Empty: none. */
  logs: readonly Circle[];
  /** Active predators (bears, wolves) and how many of each. Empty on a stage with none. */
  predators: { kind: PredatorKind; count: number }[];
  /** The children who run about here, one entry per child (their kind is fixed). Empty: no kids. */
  kids: readonly KidKind[];
  /** How many fantastic creatures haunt the woods here (picked by rarity). 0: none. */
  creatureCount: number;
  /** Which creatures may be picked, in draw order. Unset: all of CREATURE_KINDS. */
  creatureKinds?: readonly CreatureKind[];
  /** Where each kind of creature haunts (London's legends). Unset: the woods and the Glade, via homePoint. */
  creatureHome?: (rng: Rng, kind: CreatureKind) => Spot;
  /** London's Crown Jewels: where they may lie. The first is always used (the Tower). Unset: no jewels. */
  jewelSpots?: readonly Spot[];
  /** Extra rival bots this (bigger) stage seats on top of the mode's roster, so it isn't sparse. 0: none. */
  extraRivals: number;
  /** Miss Sami and a mum, nattering at the edge of the Common. Null on a stage without them. */
  greeters: { sami: Spot; mum: Spot } | null;
  /** The stage's warden (Mr Cooper at school, the park keeper on the Common), or null if it has none. */
  cooper: WardenConfig | null;
  // London's extras (Level 3). All optional: a stage without them simply has none, and the
  // school and the Common play exactly as before.
  /** Roads the buses and cabs drive. */
  routes?: readonly Route[];
  /** Who drives them: so many of a kind on a route (by id). Unset: no traffic. */
  traffic?: readonly { kind: VehicleKind; route: string; count: number }[];
  /** Zebra crossings (centre and the road's direction): every bus and cab stops for anyone on one. */
  zebras?: readonly (Spot & { angle: number })[];
  /** Where the raven pair roost between hunts, one per raven. */
  perches?: readonly Spot[];
  /** Tube stations. */
  portals?: readonly Portal[];
  /** The sights, for stamps and the minimap. */
  landmarks?: readonly Landmark[];
  /** People with lines to say (the tour guide, the Beefeater, the living statue). */
  chatters?: readonly Chatter[];
  /** Where the stone lions sleep. */
  plinths?: readonly Spot[];
  /** Where the Royal Guard stands (and never moves). */
  guard?: Spot;
  /** London's people: where each tourist hangs about (in `kids` order), where the buskers play. */
  touristSpots?: readonly Spot[];
  buskerSpots?: readonly Spot[];
  /** The school trip's walk: a closed loop on open ground, clear of the traffic. */
  tripPath?: readonly Spot[];
  /** The living statue's spot in Covent Garden. */
  statue?: Spot;
  /** London's set pieces (A6): Big Ben, Tower Bridge, the Eye, the parade, the boat… Unset: none. */
  setPieces?: SetPieceSpots;
  /** The classic follow camera's distance multiplier (London sits a little closer). Unset: 1. */
  cameraZoom?: number;
  /** Paint the fixed features onto the minimap. X/Z map metres to canvas pixels. */
  paintMinimap(c: CanvasRenderingContext2D, X: (x: number) => number, Z: (z: number) => number, scale: number): void;
}
