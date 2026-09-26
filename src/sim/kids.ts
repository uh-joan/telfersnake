import { isFree } from './collide';
import type { Rng } from './rng';
import type { Spot, Stage } from './stage';

/**
 * The Common's children: a crowd running about, pure atmosphere with a light touch of interaction.
 * Snakes can never hurt them — bump one and it is a gentle "oops" nudge. They come in three kinds:
 *
 *   naughty — lobs a pebble at a snake now and then: a small shrink, the school's stones reborn as mischief.
 *   nice    — blows a kiss: a floating ❤️ that, if it reaches you, is a little gift (growth, sometimes a gem).
 *   runner  — just tears about, stopping and spinning: unpredictable, the spark of the place.
 *
 * Deterministic (seeded RNG only), so the server and a solo game agree. Nothing here runs on the
 * school: its kid roster is empty, so every loop below is a no-op there and draws no randomness.
 */

export const KID_KINDS = ['naughty', 'nice', 'runner'] as const;
export type KidKind = (typeof KID_KINDS)[number];

export const KID_RADIUS = 0.34;

export interface KidSpec {
  /** How fast it scampers between its little errands. */
  roam: number;
  /** Naughty/nice: how far it will pick a target, and the gap between throws. Runner: unused. */
  reach: number;
  throwEvery: number;
}

export const KIDS: Record<KidKind, KidSpec> = {
  naughty: { roam: 2.4, reach: 13, throwEvery: 5 },
  nice: { roam: 2.1, reach: 12, throwEvery: 7 },
  runner: { roam: 3.2, reach: 0, throwEvery: 0 },
};

export interface Kid {
  kind: KidKind;
  x: number;
  z: number;
  heading: number;
  /** Current speed, for the renderer's scampering gait. */
  speed: number;
  /** Seconds until this one can throw/kiss again. */
  throwIn: number;
  /** Seconds it stands still (a runner stopping to stare) before it picks a new spot. */
  pauseFor: number;
  /** Where it is scampering to. */
  tx: number;
  tz: number;
  wanderIn: number;
}

export const PROJECTILE_KINDS = ['pebble', 'kiss'] as const;
export type ProjectileKind = (typeof PROJECTILE_KINDS)[number];

export interface Projectile {
  kind: ProjectileKind;
  x: number;
  z: number;
  /** Unit heading toward the target, and how fast it flies. */
  dx: number;
  dz: number;
  speed: number;
  /** Distance still to travel, and the whole throw's length (for the arc height 0..1). */
  left: number;
  total: number;
}

/** A free spot for a kid to start, out in the meadow and clear of the player's start. */
function spawnSpot(stage: Stage, rng: Rng): Spot {
  const spawn = stage.snakeSpawn;
  for (let tries = 0; tries < 120; tries++) {
    const p = stage.homePoint(rng, 'meadow');
    if (!isFree(stage, p.x, p.z, KID_RADIUS + 0.6)) continue;
    if (Math.hypot(p.x - spawn.x, p.z - spawn.z) < 10) continue;
    return p;
  }
  return { x: stage.fallbackSpot.x, z: stage.fallbackSpot.z };
}

/** A kid stub for the client to fill from snapshots (kind is fixed, positions come from the server). */
export function blankKid(kind: KidKind): Kid {
  return { kind, x: 0, z: 0, heading: 0, speed: 0, throwIn: 0, pauseFor: 0, tx: 0, tz: 0, wanderIn: 0 };
}

export function makeKids(stage: Stage, rng: Rng): Kid[] {
  const out: Kid[] = [];
  for (const kind of stage.kids) {
    const p = spawnSpot(stage, rng);
    out.push({
      kind, x: p.x, z: p.z, heading: rng.range(0, Math.PI * 2), speed: 0,
      throwIn: rng.range(1, KIDS[kind].throwEvery || 1), pauseFor: 0, tx: p.x, tz: p.z, wanderIn: 0,
    });
  }
  return out;
}
