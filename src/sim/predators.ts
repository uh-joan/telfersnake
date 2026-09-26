import { isFree } from './collide';
import type { Rng } from './rng';
import type { Stage } from './stage';

/**
 * The Common's dangers. Unlike the school's rocks, these come for you: a bear lumbers over and
 * takes a big bite; wolves howl, sprint at you for a few seconds, then give up. They go for the
 * rival snakes too. Everything cartoon: a bite just shrinks you and puffs pellets, like a rock.
 * A snake can fight back — freeze a wolf, scorch or zap a bear (see world.ts).
 */

export const PREDATOR_KINDS = ['bear', 'wolf'] as const;
export type PredatorKind = (typeof PREDATOR_KINDS)[number];

export interface PredatorSpec {
  radius: number;
  /** Wandering speed, and the speed it moves at while after a snake. */
  roamSpeed: number;
  chaseSpeed: number;
  /** How far it notices a snake's head. */
  sight: number;
  /** How close it must be to bite. */
  biteReach: number;
  /** Bite: this share of the victim's mass, capped, like a big rock. */
  biteShare: number;
  biteCap: number;
  /** Seconds between bites. */
  biteEvery: number;
  /** Wolves only: seconds a sprint lasts, and the rest before the next one. Bears set these to 0. */
  chaseTime: number;
  restTime: number;
  /** Wolves howl a beat before they sprint. */
  howls: boolean;
}

export const PREDATORS: Record<PredatorKind, PredatorSpec> = {
  bear: { radius: 0.9, roamSpeed: 0.9, chaseSpeed: 2.1, sight: 16, biteReach: 1.5, biteShare: 0.18, biteCap: 22, biteEvery: 2.6, chaseTime: 0, restTime: 0, howls: false },
  wolf: { radius: 0.5, roamSpeed: 1.7, chaseSpeed: 5.6, sight: 13, biteReach: 0.9, biteShare: 0.1, biteCap: 12, biteEvery: 1.4, chaseTime: 4, restTime: 5, howls: true },
};

export interface Predator {
  kind: PredatorKind;
  x: number;
  z: number;
  heading: number;
  /** Current speed, for the renderer's gait. */
  speed: number;
  /** Wolf: seconds left of the current sprint (0 = not sprinting). */
  chargeFor: number;
  /** Wolf: seconds left of giving up, ignoring snakes. */
  restFor: number;
  /** Seconds until it can bite again. */
  biteIn: number;
  /** Frozen solid by a Freeze Puff. */
  frozenFor: number;
  /** Spooked by fire, a zap or a laser: turns tail and flees for a moment instead of hunting. */
  scaredFor: number;
  /** Where it is ambling to while it has no snake to chase. */
  wx: number;
  wz: number;
  wanderIn: number;
}

/** A free spot for a predator: room to stand, and not right on top of the player's start. */
function spawnSpot(stage: Stage, rng: Rng, radius: number): { x: number; z: number } {
  const B = stage.bounds;
  const spawn = stage.snakeSpawn;
  for (let tries = 0; tries < 200; tries++) {
    const x = rng.range(B.minX, B.maxX);
    const z = rng.range(B.minZ, B.maxZ);
    if (!isFree(stage, x, z, radius + 1)) continue;
    if (Math.hypot(x - spawn.x, z - spawn.z) < 22) continue;
    return { x, z };
  }
  return { x: stage.fallbackSpot.x, z: stage.fallbackSpot.z };
}

/** A predator stub for the client to fill from snapshots (kind is fixed, positions come from the server). */
export function blankPredator(kind: PredatorKind): Predator {
  return { kind, x: 0, z: 0, heading: 0, speed: 0, chargeFor: 0, restFor: 0, biteIn: 0, frozenFor: 0, scaredFor: 0, wx: 0, wz: 0, wanderIn: 0 };
}

export function makePredators(stage: Stage, rng: Rng): Predator[] {
  const out: Predator[] = [];
  for (const { kind, count } of stage.predators) {
    const spec = PREDATORS[kind];
    for (let i = 0; i < count; i++) {
      const p = spawnSpot(stage, rng, spec.radius);
      out.push({
        kind, x: p.x, z: p.z, heading: rng.range(0, Math.PI * 2), speed: 0,
        chargeFor: 0, restFor: rng.range(0, 2), biteIn: 0, frozenFor: 0, scaredFor: 0, wx: p.x, wz: p.z, wanderIn: 0,
      });
    }
  }
  return out;
}
