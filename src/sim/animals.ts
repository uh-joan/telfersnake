import { isFree, resolveCircle, slideAlong, turnToward } from './collide';
import type { World } from './world';

/**
 * The escaped petting farm. Every animal wanders; the ones the snake is big enough to eat
 * run away when it gets close, the ones it is too small for stand their ground and boop it.
 */

export const ANIMAL_KINDS = ['snail', 'ladybird', 'chicken', 'duck', 'rabbit', 'sheep', 'pig', 'goat'] as const;
export type AnimalKind = (typeof ANIMAL_KINDS)[number];

type Home = 'green' | 'yard' | 'lagoon' | 'anywhere';

export interface AnimalSpec {
  /** Smallest snake tier (0-based) that can gulp it. */
  tier: number;
  /** Mass gained. Points are mass x 10. */
  value: number;
  radius: number;
  walk: number; // m/s
  flee: number; // m/s
  /** Distance at which it notices the snake. 0 = oblivious. */
  alert: number;
  /** How wildly it zigzags while fleeing, in radians. */
  jitter: number;
  count: number;
  home: Home;
}

export const ANIMALS: Record<AnimalKind, AnimalSpec> = {
  snail: { tier: 0, value: 2, radius: 0.3, walk: 0.25, flee: 0.25, alert: 0, jitter: 0, count: 3, home: 'anywhere' },
  ladybird: { tier: 0, value: 2, radius: 0.25, walk: 0.7, flee: 1.6, alert: 3, jitter: 0.5, count: 2, home: 'green' },
  chicken: { tier: 1, value: 5, radius: 0.35, walk: 1.3, flee: 3.8, alert: 5, jitter: 1.4, count: 3, home: 'yard' },
  duck: { tier: 1, value: 5, radius: 0.35, walk: 1.0, flee: 3.2, alert: 4.5, jitter: 0.4, count: 2, home: 'lagoon' },
  rabbit: { tier: 2, value: 9, radius: 0.35, walk: 1.6, flee: 6.0, alert: 7, jitter: 0.9, count: 2, home: 'green' },
  sheep: { tier: 3, value: 18, radius: 0.6, walk: 0.9, flee: 3.2, alert: 6, jitter: 0.3, count: 3, home: 'green' },
  pig: { tier: 3, value: 18, radius: 0.6, walk: 1.1, flee: 3.8, alert: 5.5, jitter: 0.4, count: 1, home: 'yard' },
  goat: { tier: 4, value: 30, radius: 0.65, walk: 1.2, flee: 4.5, alert: 6, jitter: 0.3, count: 1, home: 'yard' },
};

const TURN_RATE = 6; // rad/s
const JITTER_EVERY = 0.35; // s between zigzags while fleeing
const CALM_DOWN = 1.6; // stops fleeing once the snake is this many alert-radii away
const GOAT_SIGHT = 8;
const GOAT_GIVES_UP = 11;
const GOAT_CHARGE = 4.2; // m/s
const GOAT_CHARGE_FOR = 3; // seconds: a short dash, not a pursuit
const FLOCK_GAP = 3.5; // a sheep further than this from its nearest friend heads back to it

export type AnimalMode = 'wander' | 'rest' | 'flee' | 'charge';

export interface Animal {
  kind: AnimalKind;
  x: number;
  z: number;
  heading: number;
  speed: number;
  mode: AnimalMode;
  /** Metres walked so far; the renderer hops and waddles off this. */
  travel: number;
  /** Tick it appeared on. */
  born: number;
  /** Where it is trying to face. */
  want: number;
  /** Seconds until the current wander leg, rest or zigzag ends. */
  timer: number;
  /** Seconds before it can boop (or charge) the snake again. */
  boopCooldown: number;
  /** Seconds left dazzled by Dragon Breath: rooted to the spot. */
  dazed: number;
  /** A goat charges once, when a small snake first comes close. After that it just stands its ground. */
  charged: boolean;
  /** Seconds left of the charge under way. */
  chargeFor: number;
}

/** A random point in an animal's home turf: the stage knows where its green, lagoon and yard are. */
const homePoint = (w: World, home: Home): { x: number; z: number } => w.stage.homePoint(w.rng, home);

/** Put `a` down somewhere free near its home, at least `clear` metres from the snake. */
export function placeAnimal(a: Animal, w: World, clear: number): void {
  const spec = ANIMALS[a.kind];
  let placed = false;
  for (let tries = 0; tries < 120 && !placed; tries++) {
    // Home turf first; if a snake is camping there, anywhere will do, then with less elbow room.
    const p = homePoint(w, tries < 30 ? spec.home : 'anywhere');
    if (!isFree(w.stage, p.x, p.z, spec.radius + 0.3, w.hazards)) continue;
    if (!w.clearOfSnakes(p.x, p.z, tries < 60 ? clear : Math.min(clear, 6))) continue;
    a.x = p.x;
    a.z = p.z;
    placed = true;
  }
  if (!placed) {
    // Never leave it where it was eaten: it would be gulped again every tick.
    const s = w.stage.snakeSpawn;
    const spot = w.clearOfSnakes(s.x, s.z, 6) ? s : w.stage.fallbackSpot;
    a.x = spot.x;
    a.z = spot.z;
  }
  a.heading = a.want = w.rng.range(-Math.PI, Math.PI);
  a.speed = 0;
  a.mode = 'rest';
  a.timer = w.rng.range(0.5, 2);
  a.boopCooldown = 0;
  a.dazed = 0;
  a.charged = false;
  a.chargeFor = 0;
  a.born = w.tick;
}

export function makeAnimal(kind: AnimalKind): Animal {
  return { kind, x: 0, z: 0, heading: 0, speed: 0, mode: 'rest', travel: 0, born: 0, want: 0, timer: 0, boopCooldown: 0, dazed: 0, charged: false, chargeFor: 0 };
}

function nearestFlockmate(a: Animal, w: World): Animal | null {
  let best: Animal | null = null;
  let bestD = Infinity;
  for (const o of w.animals) {
    if (o === a || o.kind !== a.kind) continue;
    const d = (o.x - a.x) ** 2 + (o.z - a.z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best && bestD > FLOCK_GAP * FLOCK_GAP ? best : null;
}

export function updateAnimal(a: Animal, w: World, dt: number): void {
  const spec = ANIMALS[a.kind];

  a.boopCooldown = Math.max(0, a.boopCooldown - dt);
  if (a.dazed > 0) {
    a.dazed -= dt;
    a.speed = 0;
    return;
  }
  a.timer -= dt;

  // It only has eyes for the nearest snake.
  let s = w.snakes[0];
  let dist = Infinity;
  for (const o of w.snakes) {
    if (!o.alive) continue;
    const d = Math.hypot(a.x - o.x, a.z - o.z);
    if (d < dist) {
      dist = d;
      s = o;
    }
  }
  const dx = a.x - s.x;
  const dz = a.z - s.z;
  const edible = s.tier >= spec.tier;

  // Decide what it is doing.
  if (edible && spec.alert > 0 && dist < spec.alert + s.radius) {
    if (a.mode !== 'flee') a.timer = 0;
    a.mode = 'flee';
  } else if (a.mode === 'flee' && dist > spec.alert * CALM_DOWN) {
    a.mode = 'rest';
    a.timer = w.rng.range(0.4, 1.2);
  }
  if (a.mode === 'charge') {
    // The charge is over once it lands a boop, loses the snake, runs out of puff, or the snake
    // has grown big enough to eat it. It never charges again: no goat hounds a child round the yard.
    a.chargeFor -= dt;
    if (edible || a.boopCooldown > 0 || dist > GOAT_GIVES_UP || a.chargeFor <= 0) {
      a.mode = 'rest';
      a.timer = 1.5;
    }
  } else if (a.kind === 'goat' && !edible && !a.charged && dist < GOAT_SIGHT) {
    a.mode = 'charge';
    a.charged = true;
    a.chargeFor = GOAT_CHARGE_FOR;
  }

  switch (a.mode) {
    case 'flee':
      if (a.timer <= 0) {
        a.timer = JITTER_EVERY;
        a.want = Math.atan2(dz, dx) + w.rng.range(-spec.jitter, spec.jitter);
      }
      a.speed = spec.flee;
      break;
    case 'charge':
      a.want = Math.atan2(-dz, -dx);
      a.speed = GOAT_CHARGE;
      break;
    case 'rest':
      a.speed = 0;
      if (a.timer <= 0) {
        a.mode = 'wander';
        a.timer = w.rng.range(1.5, 4);
        const friend = a.kind === 'sheep' ? nearestFlockmate(a, w) : null;
        a.want = friend ? Math.atan2(friend.z - a.z, friend.x - a.x) : w.rng.range(-Math.PI, Math.PI);
      }
      break;
    case 'wander':
      a.speed = spec.walk;
      if (a.timer <= 0) {
        a.mode = 'rest';
        a.timer = w.rng.range(0.5, 2.5);
      }
      break;
  }

  if (a.speed === 0) return;
  a.heading = turnToward(a.heading, a.want, TURN_RATE * dt);
  const step = a.speed * dt;
  const hit = resolveCircle(w.stage, a.x + Math.cos(a.heading) * step, a.z + Math.sin(a.heading) * step, spec.radius, w.hit, w.hazards);
  a.travel += Math.hypot(hit.x - a.x, hit.z - a.z);
  a.x = hit.x;
  a.z = hit.z;
  if (hit.hit) {
    // Wanderers turn back from walls; runners scrabble along them (and can be cornered).
    a.want = a.mode === 'wander' ? Math.atan2(hit.nz, hit.nx) : slideAlong(a.want, hit.nx, hit.nz);
  }
}
