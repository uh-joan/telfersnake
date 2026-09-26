import type { AnimalKind } from './animals';
import type { FoodKind } from './food';
import type { KidKind } from './kids';
import type { Box, Circle } from './layout';
import type { PredatorKind } from './predators';
import type { Rng } from './rng';

/**
 * A stage is a place to play: its fence and fixed solids (what collision needs), where things
 * spawn and live, and who patrols it. Level 1 is the school; Level 2 is the Common.
 *
 * The sim never reads a layout as a module global: everything takes the stage it is running on,
 * because the server runs many rooms in one process and they need not all be the same place.
 */

export type StageId = 'school' | 'common';
export const STAGE_IDS: readonly StageId[] = ['school', 'common'];
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

/** What collision needs: the fence and the fixed solids. Per-world extras (rocks) come on top. */
export interface Terrain {
  bounds: Bounds;
  solidBoxes: readonly Box[];
  solidCircles: readonly Circle[];
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
  /** Solid things the snake goes round but the children clamber over (the Common's fallen log). Empty: none. */
  logs: readonly Circle[];
  /** Active predators (bears, wolves) and how many of each. Empty on a stage with none. */
  predators: { kind: PredatorKind; count: number }[];
  /** The children who run about here, one entry per child (their kind is fixed). Empty: no kids. */
  kids: readonly KidKind[];
  /** How many fantastic creatures haunt the woods here (picked by rarity). 0: none. */
  creatureCount: number;
  /** Miss Sami and a mum, nattering at the edge of the Common. Null on a stage without them. */
  greeters: { sami: Spot; mum: Spot } | null;
  /** Mr Cooper's spawn and beat, or null on a stage he never visits. */
  cooper: { spawn: Spot; beat: Bounds } | null;
  /** Paint the fixed features onto the minimap. X/Z map metres to canvas pixels. */
  paintMinimap(c: CanvasRenderingContext2D, X: (x: number) => number, Z: (z: number) => number, scale: number): void;
}
