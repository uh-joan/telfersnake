import { isFree } from './collide';
import type { Circle } from './layout';
import type { Rng } from './rng';
import type { Stage } from './stage';

export const FOOD_KINDS = ['burger', 'sausage', 'cookie', 'broccoli', 'carrot', 'apple'] as const;
export type FoodKind = (typeof FOOD_KINDS)[number];

/** Mass gained per bite. Points are mass x 10. Eating your greens pays as well as the chip shop. */
export const FOOD_VALUE: Record<FoodKind, number> = {
  burger: 3,
  sausage: 2,
  cookie: 1,
  broccoli: 3,
  carrot: 2,
  apple: 2,
};

// Spawn weights, same order as FOOD_KINDS. The school's tables: veg grows on The Green, lunch
// leftovers everywhere else. A stage decides which table applies where (see Stage.foodKindAt).
export const WEIGHTS_YARD = [1.5, 2, 3, 1, 1, 1.5];
export const WEIGHTS_GREEN = [0, 0, 0.5, 4, 4, 2];

/** One food kind drawn from a weight table (same order as FOOD_KINDS). */
export const pickFoodKind = (rng: Rng, weights: readonly number[]): FoodKind => FOOD_KINDS[weighted(rng, weights)];

/** Golden food is rare, sparkly and worth this many times the usual. */
export const GOLDEN_MULTIPLIER = 5;
const GOLDEN_CHANCE = 0.03;
const GOLDEN_PER_LUCK = 0.03;
/** Further than any snake can bite, Long Tongue included. */
const OUT_OF_BITE = 5;

export interface Food {
  kind: FoodKind;
  golden: boolean;
  x: number;
  z: number;
  /** Tick it appeared on; the renderer pops it in from this. */
  born: number;
}

function weighted(rng: Rng, weights: readonly number[]): number {
  let total = 0;
  for (const w of weights) total += w;
  let roll = rng.next() * total;
  for (let i = 0; i < weights.length; i++) {
    if (roll < weights[i]) return i; // strict, so a zero weight can never be picked
    roll -= weights[i];
  }
  return weights.length - 1;
}

/**
 * Re-roll `food` in place somewhere free (and off the `rocks`), at least `clear` metres from
 * (avoidX, avoidZ). `luck` is the eater's Four-leaf Clover level.
 */
export function placeFood(
  food: Food, rng: Rng, stage: Stage, tick: number, avoidX: number, avoidZ: number, clear: number, rocks: readonly Circle[], luck = 0,
): void {
  food.golden = rng.next() < GOLDEN_CHANCE + GOLDEN_PER_LUCK * luck;
  food.born = tick;
  const B = stage.bounds;
  for (let tries = 0; tries < 120; tries++) {
    const x = rng.range(B.minX, B.maxX);
    const z = rng.range(B.minZ, B.maxZ);
    if (!isFree(stage, x, z, 0.8, rocks)) continue;
    // Settle for less room after a while, but never within anyone's bite.
    const room = tries < 40 ? clear : Math.min(clear, OUT_OF_BITE);
    if ((x - avoidX) ** 2 + (z - avoidZ) ** 2 < room * room) continue;
    food.x = x;
    food.z = z;
    food.kind = stage.foodKindAt(rng, x, z);
    return;
  }
  // Never leave it where it was: that is inside the mouth that just ate it, and it would be
  // swallowed again every tick. Use whichever known-open spot is further away.
  const far = (p: { x: number; z: number }) => (p.x - avoidX) ** 2 + (p.z - avoidZ) ** 2;
  const spot = far(stage.snakeSpawn) > far(stage.fallbackSpot) ? stage.snakeSpawn : stage.fallbackSpot;
  food.x = spot.x;
  food.z = spot.z;
}
