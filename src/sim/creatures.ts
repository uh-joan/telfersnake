import { isFree } from './collide';
import type { Rng } from './rng';
import type { Spot, Stage } from './stage';

/**
 * The fantastic creatures of the Common: rare, shy, ethereal things that haunt the woods and the
 * Glade. They can be gulped by a touch at any size (no tier gate), but they *flee*, so catching one
 * is a chase. Each grants a burst of magic — some an instant gift, some a timed buff on the snake
 * (see World.castMagic). Deterministic and a no-op on the school (its creature count is 0).
 */

export const CREATURE_KINDS = ['stag', 'unicorn', 'owl', 'frog', 'kitsune', 'pixie', 'squirrel', 'wisp'] as const;
export type CreatureKind = (typeof CREATURE_KINDS)[number];

export interface CreatureSpec {
  /** How likely this one is in the roster: the stag is a mythic rarity, the pixie merely uncommon. */
  weight: number;
  /** Flee speed when a snake is near, and the distance at which it startles. */
  flee: number;
  alert: number;
  radius: number;
  /** A glow colour for the renderer's aura. */
  glow: number;
}

export const CREATURES: Record<CreatureKind, CreatureSpec> = {
  stag: { weight: 0.4, flee: 6.5, alert: 16, radius: 0.6, glow: 0xfff2b0 },
  unicorn: { weight: 0.8, flee: 6.0, alert: 14, radius: 0.55, glow: 0xffd6f2 },
  owl: { weight: 1.2, flee: 4.5, alert: 12, radius: 0.4, glow: 0xcde6ff },
  frog: { weight: 1.2, flee: 4.0, alert: 10, radius: 0.35, glow: 0xbff0a0 },
  kitsune: { weight: 1.2, flee: 6.2, alert: 13, radius: 0.45, glow: 0xffc08a },
  pixie: { weight: 1.8, flee: 5.0, alert: 12, radius: 0.3, glow: 0xc0ffe6 },
  squirrel: { weight: 1.8, flee: 5.5, alert: 11, radius: 0.35, glow: 0xffe0a0 },
  wisp: { weight: 1.6, flee: 3.5, alert: 9, radius: 0.3, glow: 0xfff6c0 },
};

export interface Creature {
  kind: CreatureKind;
  x: number;
  z: number;
  heading: number;
  /** Current speed, for the renderer's drift/hover. */
  speed: number;
  /** Seconds until it fades back after being gulped (0 = present). */
  respawnIn: number;
  /** Where it is drifting to while nothing is near. */
  wx: number;
  wz: number;
  wanderIn: number;
}

/** A spot deep in the woods or the Glade for a creature to haunt, clear of the player's start. */
export function creatureSpot(stage: Stage, rng: Rng): Spot {
  const spawn = stage.snakeSpawn;
  for (let tries = 0; tries < 150; tries++) {
    const p = stage.homePoint(rng, rng.next() < 0.5 ? 'glade' : 'woods');
    if (!isFree(stage, p.x, p.z, 0.9)) continue;
    if (Math.hypot(p.x - spawn.x, p.z - spawn.z) < 14) continue;
    return p;
  }
  return { x: stage.fallbackSpot.x, z: stage.fallbackSpot.z };
}

/** A creature stub for the client to fill from snapshots (kind fixed, positions from the server). */
export function blankCreature(kind: CreatureKind): Creature {
  return { kind, x: 0, z: 0, heading: 0, speed: 0, respawnIn: 0, wx: 0, wz: 0, wanderIn: 0 };
}

/** Pick the stage's roster of creatures (weighted, so a stag is a lucky day) and place each one. */
export function makeCreatures(stage: Stage, rng: Rng): Creature[] {
  const out: Creature[] = [];
  const pool = [...CREATURE_KINDS];
  for (let n = 0; n < stage.creatureCount && pool.length > 0; n++) {
    const total = pool.reduce((a, k) => a + CREATURES[k].weight, 0);
    let roll = rng.next() * total;
    let pick = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      if (roll < CREATURES[pool[i]].weight) { pick = i; break; }
      roll -= CREATURES[pool[i]].weight;
    }
    const kind = pool.splice(pick, 1)[0];
    const p = creatureSpot(stage, rng);
    out.push({ kind, x: p.x, z: p.z, heading: rng.range(0, Math.PI * 2), speed: 0, respawnIn: 0, wx: p.x, wz: p.z, wanderIn: 0 });
  }
  return out;
}
