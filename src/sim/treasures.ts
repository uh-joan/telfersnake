import type { Rng } from './rng';
import type { Spot, Stage } from './stage';

/**
 * London's Crown Jewels (A5): five gems lying about the map each run, one always at the Tower, the
 * rest at spots picked from the stage's list (landmark-adjacent open paper). Any snake picks one up
 * by touch, at any size. A jewel taken comes back a little later at another free spot, so every
 * child can collect; a snake with five is ROYAL: a crown for the rest of the run.
 *
 * Pure data and deterministic. A stage without `jewelSpots` gets none and draws no RNG.
 */

/** The five gems, one per jewel index: ruby, sapphire, emerald, diamond, amethyst. */
export const JEWEL_KINDS = ['ruby', 'sapphire', 'emerald', 'diamond', 'amethyst'] as const;
export const JEWELS_FOR_CROWN = JEWEL_KINDS.length;
/** Seconds a taken jewel stays away before turning up at another spot. */
export const JEWEL_RESPAWN = 20;
/** How close (beyond the bite) a head must come to pick one up. */
export const JEWEL_REACH = 0.6;

export interface Treasure {
  x: number;
  z: number;
  /** Which of the stage's jewel spots it lies on. */
  spot: number;
  /** Seconds until it is back (0 = lying there, ready to pick up). */
  respawnIn: number;
}

/** One at the Tower (spot 0), the rest drawn from the other spots without repeats. */
export function makeTreasures(stage: Stage, rng: Rng): Treasure[] {
  const spots = stage.jewelSpots;
  if (!spots || spots.length === 0) return [];
  const pool = spots.map((_, i) => i).slice(1);
  const out: Treasure[] = [{ x: spots[0].x, z: spots[0].z, spot: 0, respawnIn: 0 }];
  while (out.length < JEWEL_KINDS.length && pool.length > 0) {
    const i = pool.splice(rng.int(pool.length), 1)[0];
    out.push({ x: spots[i].x, z: spots[i].z, spot: i, respawnIn: 0 });
  }
  return out;
}

/** Move a jewel that was taken to another spot nobody else is using (and not where it just was). */
export function moveTreasure(t: Treasure, all: readonly Treasure[], spots: readonly Spot[], rng: Rng): void {
  const free: number[] = [];
  for (let i = 0; i < spots.length; i++) if (i !== t.spot && !all.some((o) => o !== t && o.spot === i)) free.push(i);
  if (free.length === 0) return;
  t.spot = free[rng.int(free.length)];
  t.x = spots[t.spot].x;
  t.z = spots[t.spot].z;
}

/** A stub for the client, filled from snapshots. */
export const blankTreasure = (): Treasure => ({ x: 0, z: 0, spot: 0, respawnIn: 0 });

/** London's pearly-button trail (the Pearly Lights): little pickups leading to a treasure. */
export interface Button {
  x: number;
  z: number;
  /** The tick it was laid: the trail fades BUTTON_LIFE seconds after. */
  born: number;
}
export const BUTTON_LIFE = 30;
export const BUTTON_MASS = 0.6;
export const BUTTON_STEP = 2.2;
export const BUTTON_MAX = 30;
