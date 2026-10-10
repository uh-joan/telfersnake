import { isFree } from './collide';
import type { Rng } from './rng';
import type { Stage } from './stage';

/**
 * The Common's dangers. Unlike the school's rocks, these come for you: a bear lumbers over and
 * takes a big bite; wolves howl, sprint at you for a few seconds, then give up. They go for the
 * rival snakes too. Everything cartoon: a bite just shrinks you and puffs pellets, like a rock.
 * A snake can fight back — freeze a wolf, scorch or zap a bear (see world.ts).
 */

export const PREDATOR_KINDS = ['bear', 'wolf', 'lion', 'raven'] as const;
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
  // London (A3). A lion is the bear reborn: it prowls for chaseTime, then sleeps restTime on its plinth.
  // roamSpeed is its plod home. A raven is the wolf: a swoop of chaseTime, then restTime on the Tower.
  lion: { radius: 0.9, roamSpeed: 1.7, chaseSpeed: 2.3, sight: 14, biteReach: 1.5, biteShare: 0.16, biteCap: 18, biteEvery: 2.6, chaseTime: 9, restTime: 8, howls: false },
  raven: { radius: 0.45, roamSpeed: 4, chaseSpeed: 5.2, sight: 18, biteReach: 0.9, biteShare: 0.06, biteCap: 6, biteEvery: 1.4, chaseTime: 4, restTime: 6, howls: true },
};

/**
 * London's lions: asleep in bronze on the plinths (`statue`), until a snake comes close. Then one
 * stretches and yawns (`waking`) and hops down, `prowl`s after the nearest snake, and when it tires
 * (or has had a lick) plods `home`, `climb`s back up and is a statue again. A Freeze Puff turns a
 * prowling lion to `stone` where it stands for a while; then it walks home.
 */
export const LION = { statue: 0, waking: 1, prowl: 2, home: 3, stone: 4, climb: 5 } as const;
/** London's ravens: `perched` on the Tower, a CAW! (`caw`), a `swoop` after a snake, then flying `back`. */
export const RAVEN = { perched: 0, caw: 1, swoop: 2, back: 3 } as const;
/** A lion hops this far off its plinth's centre to the ground (and walks back to here to climb up). */
export const LION_FOOT = 2.3;
/** Seconds of the waking yawn (the last of it is the hop down), and of the climb back up. */
export const LION_WAKE_TIME = 1.2;
export const LION_HOP_TIME = 0.45;
export const LION_CLIMB_TIME = 0.8;
/** A sleeping lion wakes when a snake's head comes this close to its plinth. */
export const LION_WAKE = 9;
/** A prowling lion never strays further than this from its plinth: past it, it turns for home. */
export const LION_LEASH = 20;
/** Seconds a Freeze Puff leaves a lion as stone. */
export const LION_STONE_TIME = 6;
/** Seconds a lion will spend finding its way home before it gives up and is simply back (never seen in checks). */
export const LION_HOME_GIVE_UP = 15;
/** Seconds of a raven's CAW! before it swoops, and how far from its perch it will chase. */
export const RAVEN_CAW_TIME = 0.7;
export const RAVEN_LEASH = 34;

/** Is it up and about (as opposed to bronze on its plinth, or roosting on the Tower)? Bears and wolves always are. */
export function awake(p: Predator): boolean {
  if (p.kind === 'lion') return p.state === LION.prowl || p.state === LION.home || p.state === LION.stone;
  if (p.kind === 'raven') return p.state !== RAVEN.perched;
  return true;
}

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
  /** London's lions and ravens: which LION / RAVEN state it is in, and that state's clock. */
  state: number;
  stateFor: number;
  /** Its home: a lion's plinth centre (wx, wz is where it hops down to), a raven's perch. */
  hx: number;
  hz: number;
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
  return { kind, x: 0, z: 0, heading: 0, speed: 0, chargeFor: 0, restFor: 0, biteIn: 0, frozenFor: 0, scaredFor: 0, wx: 0, wz: 0, wanderIn: 0, state: 0, stateFor: 0, hx: 0, hz: 0 };
}

/**
 * A lion asleep on plinth `home`, facing out from the column (`centre`); its hop-down spot is
 * LION_FOOT further out. Or a raven roosting at `home`. Fixed places: no RNG.
 */
function homed(kind: 'lion' | 'raven', home: { x: number; z: number }, centre: { x: number; z: number }): Predator {
  const p = blankPredator(kind);
  const out = Math.atan2(home.z - centre.z, home.x - centre.x);
  p.x = p.hx = home.x;
  p.z = p.hz = home.z;
  p.heading = out;
  p.wx = home.x + Math.cos(out) * LION_FOOT;
  p.wz = home.z + Math.sin(out) * LION_FOOT;
  return p;
}

export function makePredators(stage: Stage, rng: Rng): Predator[] {
  const out: Predator[] = [];
  for (const { kind, count } of stage.predators) {
    // London's beasts have homes, not spawn spots: a plinth each, a perch each.
    if (kind === 'lion' || kind === 'raven') {
      const homes = (kind === 'lion' ? stage.plinths : stage.perches) ?? [];
      const n = Math.min(count, homes.length);
      let cx = 0;
      let cz = 0;
      for (let i = 0; i < n; i++) {
        cx += homes[i].x / n;
        cz += homes[i].z / n;
      }
      for (let i = 0; i < n; i++) out.push(homed(kind, homes[i], kind === 'lion' ? { x: cx, z: cz } : { x: homes[i].x, z: homes[i].z - 1 }));
      continue;
    }
    const spec = PREDATORS[kind];
    for (let i = 0; i < count; i++) {
      const p = spawnSpot(stage, rng, spec.radius);
      out.push({
        kind, x: p.x, z: p.z, heading: rng.range(0, Math.PI * 2), speed: 0,
        chargeFor: 0, restFor: rng.range(0, 2), biteIn: 0, frozenFor: 0, scaredFor: 0, wx: p.x, wz: p.z, wanderIn: 0,
        state: 0, stateFor: 0, hx: p.x, hz: p.z,
      });
    }
  }
  return out;
}
