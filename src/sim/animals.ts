import { isFree, resolveAshore, slideAlong, turnToward } from './collide';
import { placeFood } from './food';
import type { World } from './world';

/**
 * The escaped petting farm. Every animal wanders; the ones the snake is big enough to eat
 * run away when it gets close, the ones it is too small for stand their ground and boop it.
 */

export const ANIMAL_KINDS = [
  'snail', 'ladybird', 'chicken', 'duck', 'rabbit', 'sheep', 'pig', 'goat',
  'squirrel', 'crow', 'deer', 'hedgehog', 'fox', 'pigeon',
  // London's zoo (Level 3), appended so the protocol's indices stay put.
  'corgi', 'swan', 'gull', 'pelican', 'horse', 'dino',
] as const;
export type AnimalKind = (typeof ANIMAL_KINDS)[number];

/** The petting farm lives at school; the forest animals on the Common (see the *_ANIMALS sets). */
export const SCHOOL_ANIMALS: readonly AnimalKind[] = ['snail', 'ladybird', 'chicken', 'duck', 'rabbit', 'sheep', 'pig', 'goat'];
export const COMMON_ANIMALS: readonly AnimalKind[] = ['squirrel', 'crow', 'deer', 'hedgehog', 'fox', 'pigeon', 'rabbit', 'duck'];
export const LONDON_ANIMALS: readonly AnimalKind[] = ['pigeon', 'squirrel', 'duck', 'corgi', 'swan', 'gull', 'pelican', 'horse', 'dino'];

/** Never gulped, at any size: the King's swans. */
export const NEVER_GULPED = 99;

/** Home turf names; a stage maps each to somewhere on its map (London's are its own). */
export type Home = 'green' | 'yard' | 'lagoon' | 'woods' | 'anywhere' | 'palace' | 'lake' | 'trafalgar' | 'river' | 'museum';

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
  // Forest animals of the Common.
  squirrel: { tier: 0, value: 4, radius: 0.28, walk: 1.4, flee: 5.5, alert: 6, jitter: 1.6, count: 4, home: 'woods' },
  crow: { tier: 2, value: 7, radius: 0.35, walk: 1.2, flee: 4.5, alert: 6, jitter: 1.0, count: 3, home: 'anywhere' },
  deer: { tier: 3, value: 22, radius: 0.6, walk: 1.0, flee: 7.0, alert: 9, jitter: 0.4, count: 2, home: 'anywhere' },
  hedgehog: { tier: 1, value: 6, radius: 0.3, walk: 0.6, flee: 1.4, alert: 3, jitter: 0.3, count: 3, home: 'woods' },
  fox: { tier: 2, value: 12, radius: 0.4, walk: 1.5, flee: 4.0, alert: 6, jitter: 0.7, count: 2, home: 'woods' },
  pigeon: { tier: 0, value: 3, radius: 0.25, walk: 0.9, flee: 3.5, alert: 4, jitter: 1.2, count: 5, home: 'anywhere' },
  // London's zoo.
  corgi: { tier: 1, value: 5, radius: 0.3, walk: 1.7, flee: 4.2, alert: 5, jitter: 1.1, count: 4, home: 'palace' },
  swan: { tier: NEVER_GULPED, value: 0, radius: 0.45, walk: 0.7, flee: 0, alert: 0, jitter: 0, count: 3, home: 'lake' },
  gull: { tier: 2, value: 8, radius: 0.3, walk: 1.2, flee: 5.5, alert: 6, jitter: 1.0, count: 4, home: 'river' },
  pelican: { tier: 3, value: 18, radius: 0.55, walk: 0.9, flee: 3.2, alert: 5.5, jitter: 0.3, count: 2, home: 'lake' },
  horse: { tier: 4, value: 32, radius: 0.7, walk: 1.4, flee: 5.0, alert: 7, jitter: 0.3, count: 1, home: 'palace' },
  dino: { tier: 5, value: 80, radius: 0.9, walk: 0.6, flee: 1.9, alert: 8, jitter: 0.2, count: 1, home: 'museum' },
};

const TURN_RATE = 6; // rad/s
const JITTER_EVERY = 0.35; // s between zigzags while fleeing
const CALM_DOWN = 1.6; // stops fleeing once the snake is this many alert-radii away
const GOAT_SIGHT = 8;
const GOAT_GIVES_UP = 11;
const GOAT_CHARGE = 4.2; // m/s
const GOAT_CHARGE_FOR = 3; // seconds: a short dash, not a pursuit
const FLOCK_GAP = 3.5; // a sheep further than this from its nearest friend heads back to it
// London's characters.
const SWAN_SIGHT = 5;
const SWAN_CHASE = 3.2; // m/s: a waddling rush, slower than any snake
const SWAN_CHASE_FOR = 2;
const SWAN_SULK = 8; // seconds before it will chase again
const PIGEON_SCARE = 7; // a dashing snake this close lifts the whole flock
const PIGEON_FLOCK = 9; // ...every pigeon this close to the one that saw it
const PIGEON_LIFT = 2.5; // seconds aloft
const PIGEON_BURST = 1.8; // × flee speed while aloft
const GULL_EYE = 14; // a gull spots food this far away...
const GULL_NEAR_SNAKE = 6; // ...if someone is about to eat it
const GULL_SWOOP = 6; // m/s
const GULL_EVERY = 9; // seconds between raids
const PELICAN_EYE = 7;
const PELICAN_EVERY = 6;
const GIVE_UP = 5; // seconds before a swoop on food that keeps moving is abandoned
const YIP_EVERY = 2.5;
const LAKE_BIRDS: readonly AnimalKind[] = ['swan', 'duck', 'pelican'];
const LAKE_LEASH = 6;

export type AnimalMode = 'wander' | 'rest' | 'flee' | 'charge' | 'swoop';

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
  /** Seconds left of the charge under way (a swoop's time limit, for gulls and pelicans). */
  chargeFor: number;
  /** London: seconds before it may do its trick again (raid, chase, yip), or a pigeon stays aloft. */
  busy: number;
  /** London: the food index a gull or pelican is going for; -1 when a gull is flying off with it. */
  target: number;
  /** The `born` tick of that food when it was picked: if it changes, the food was eaten and moved. */
  targetBorn: number;
  /** Where it was put down: London's lake birds wander back toward it. */
  homeX: number;
  homeZ: number;
}

/** A random point in an animal's home turf: the stage knows where its green, lagoon and yard are. */
const homePoint = (w: World, home: Home): { x: number; z: number } => w.stage.homePoint(w.rng, home);

/** Put `a` down somewhere free near its home, at least `clear` metres from the snake. */
export function placeAnimal(a: Animal, w: World, clear: number): void {
  const spec = ANIMALS[a.kind];
  let placed = false;
  for (let tries = 0; tries < 120 && !placed; tries++) {
    // Home turf first; if a snake is camping there, anywhere will do, then with less elbow room.
    const p = homePoint(w, tries < 30 ? (w.stage.animalHomes?.[a.kind] ?? spec.home) : 'anywhere');
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
  a.homeX = a.x;
  a.homeZ = a.z;
  a.heading = a.want = w.rng.range(-Math.PI, Math.PI);
  a.speed = 0;
  a.mode = 'rest';
  a.timer = w.rng.range(0.5, 2);
  a.boopCooldown = 0;
  a.dazed = 0;
  a.charged = false;
  a.chargeFor = 0;
  a.busy = 0;
  a.target = -1;
  a.born = w.tick;
}

export function makeAnimal(kind: AnimalKind): Animal {
  return { kind, x: 0, z: 0, heading: 0, speed: 0, mode: 'rest', travel: 0, born: 0, want: 0, timer: 0, boopCooldown: 0, dazed: 0, charged: false, chargeFor: 0, busy: 0, target: -1, targetBorn: 0, homeX: 0, homeZ: 0 };
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
  if (a.busy > 0) a.busy -= dt; // only London's characters ever set it
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

  // London's pigeons: a snake dashing in lifts the whole flock at once.
  if (a.kind === 'pigeon' && w.stage.id === 'london' && a.busy <= 0 && s.dashing && dist < PIGEON_SCARE) liftFlock(a, w);

  // Decide what it is doing.
  if (edible && spec.alert > 0 && dist < spec.alert + s.radius) {
    if (a.mode !== 'flee') {
      a.timer = 0;
      if (a.kind === 'corgi' && a.busy <= 0) {
        // Chased: a yip, and off it zooms.
        a.busy = YIP_EVERY;
        w.events.push({ type: 'cry', kind: a.kind, x: a.x, z: a.z });
      }
    }
    a.mode = 'flee';
  } else if (a.mode === 'flee' && dist > spec.alert * CALM_DOWN && !(a.kind === 'pigeon' && a.busy > 0)) {
    a.mode = 'rest';
    a.timer = w.rng.range(0.4, 1.2);
  }
  if (a.mode === 'charge') {
    // The charge is over once it lands a boop, loses the snake, runs out of puff, or the snake
    // has grown big enough to eat it. It never charges again: no goat hounds a child round the yard.
    // (A swan sulks for a while, then will see you off again.)
    a.chargeFor -= dt;
    if (edible || a.boopCooldown > 0 || dist > GOAT_GIVES_UP || a.chargeFor <= 0) {
      a.mode = 'rest';
      a.timer = 1.5;
      if (a.kind === 'swan') a.busy = SWAN_SULK;
    }
  } else if (a.kind === 'goat' && !edible && !a.charged && dist < GOAT_SIGHT) {
    a.mode = 'charge';
    a.charged = true;
    a.chargeFor = GOAT_CHARGE_FOR;
  } else if (a.kind === 'swan' && a.busy <= 0 && dist < SWAN_SIGHT) {
    // The King's swan: HONK, and a little rush at whoever came too close.
    a.mode = 'charge';
    a.chargeFor = SWAN_CHASE_FOR;
    w.events.push({ type: 'cry', kind: a.kind, x: a.x, z: a.z });
  } else if ((a.kind === 'gull' || a.kind === 'pelican') && a.mode !== 'flee' && a.mode !== 'swoop' && a.busy <= 0) {
    eyeFood(a, w);
  }

  // London's big ones mind where they put their feet: a wanderer never shoulders a little snake into a wall.
  if (w.stage.id === 'london' && !edible && a.mode === 'wander' && dist < spec.radius + s.radius + 0.6) a.want = Math.atan2(dz, dx);

  switch (a.mode) {
    case 'flee':
      if (a.timer <= 0) {
        a.timer = JITTER_EVERY;
        a.want = Math.atan2(dz, dx) + w.rng.range(-spec.jitter, spec.jitter);
      }
      a.speed = a.kind === 'pigeon' && a.busy > 0 ? spec.flee * PIGEON_BURST : spec.flee;
      break;
    case 'charge':
      a.want = Math.atan2(-dz, -dx);
      a.speed = a.kind === 'swan' ? SWAN_CHASE : GOAT_CHARGE;
      break;
    case 'swoop':
      swoop(a, w, dt, dx, dz);
      break;
    case 'rest':
      a.speed = 0;
      if (a.timer <= 0) {
        a.mode = 'wander';
        a.timer = w.rng.range(1.5, 4);
        const friend = a.kind === 'sheep' || a.kind === 'corgi' ? nearestFlockmate(a, w) : null; // flocks and packs
        a.want = friend ? Math.atan2(friend.z - a.z, friend.x - a.x) : w.rng.range(-Math.PI, Math.PI);
        // London's swans, ducks and pelicans keep to their lake's bank.
        if (w.stage.id === 'london' && LAKE_BIRDS.includes(a.kind) && (a.x - a.homeX) ** 2 + (a.z - a.homeZ) ** 2 > LAKE_LEASH * LAKE_LEASH) {
          a.want = Math.atan2(a.homeZ - a.z, a.homeX - a.x);
        }
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
  const hit = resolveAshore(w.stage, a.x, a.z, a.x + Math.cos(a.heading) * step, a.z + Math.sin(a.heading) * step, spec.radius, w.hit, w.hazards);
  a.travel += Math.hypot(hit.x - a.x, hit.z - a.z);
  a.x = hit.x;
  a.z = hit.z;
  if (hit.hit) {
    // Wanderers turn back from walls; runners scrabble along them (and can be cornered).
    a.want = a.mode === 'wander' ? Math.atan2(hit.nz, hit.nx) : slideAlong(a.want, hit.nx, hit.nz);
  }
}

/** Every pigeon near `a` takes off together, away from whoever dashed in. */
function liftFlock(a: Animal, w: World): void {
  for (const o of w.animals) {
    if (o.kind !== 'pigeon' || (o.x - a.x) ** 2 + (o.z - a.z) ** 2 > PIGEON_FLOCK * PIGEON_FLOCK) continue;
    o.mode = 'flee';
    o.timer = 0;
    o.busy = PIGEON_LIFT;
  }
  w.events.push({ type: 'cry', kind: 'pigeon', x: a.x, z: a.z });
}

/**
 * A gull looks for a snack someone is about to eat; a pelican for any snack close by. Found one:
 * off it goes (a swoop). Nothing: look again in a second.
 */
function eyeFood(a: Animal, w: World): void {
  const gull = a.kind === 'gull';
  const eye = gull ? GULL_EYE : PELICAN_EYE;
  let best = -1;
  let bestD = eye * eye;
  for (let i = 0; i < w.foods.length; i++) {
    const f = w.foods[i];
    const d = (f.x - a.x) ** 2 + (f.z - a.z) ** 2;
    if (d >= bestD) continue;
    if (gull && w.clearOfSnakes(f.x, f.z, GULL_NEAR_SNAKE)) continue;
    bestD = d;
    best = i;
  }
  if (best < 0) {
    a.busy = 1;
    return;
  }
  a.mode = 'swoop';
  a.target = best;
  a.targetBorn = w.foods[best].born;
  a.chargeFor = GIVE_UP;
}

/** Going for the food (and, for a gull, flying off with it afterwards). */
function swoop(a: Animal, w: World, dt: number, dx: number, dz: number): void {
  const gull = a.kind === 'gull';
  a.chargeFor -= dt;
  if (a.target < 0) {
    // Away with the loot, out from the snake it robbed.
    a.want = Math.atan2(dz, dx);
    a.speed = GULL_SWOOP;
    if (a.chargeFor <= 0) {
      a.mode = 'rest';
      a.timer = 1;
    }
    return;
  }
  const f = w.foods[a.target];
  const d = Math.hypot(f.x - a.x, f.z - a.z);
  if (a.chargeFor <= 0 || f.born !== a.targetBorn || d > GULL_EYE + 2) {
    // Someone else got there first, or it is out of reach: never mind.
    a.mode = 'rest';
    a.timer = 1;
    a.target = -1;
    a.busy = (gull ? GULL_EVERY : PELICAN_EVERY) / 2;
    a.speed = 0;
    return;
  }
  if (d < ANIMALS[a.kind].radius + 0.5) {
    w.events.push({ type: 'steal', kind: a.kind, food: f.kind, x: f.x, z: f.z });
    placeFood(f, w.rng, w.stage, w.tick, a.x, a.z, 8, w.hazards);
    a.busy = gull ? GULL_EVERY : PELICAN_EVERY;
    a.target = -1;
    if (gull) {
      a.chargeFor = 1.5;
    } else {
      a.mode = 'rest';
      a.timer = 1.5;
      a.speed = 0;
    }
    return;
  }
  a.want = Math.atan2(f.z - a.z, f.x - a.x);
  a.speed = gull ? GULL_SWOOP : ANIMALS[a.kind].walk * 1.4;
}
