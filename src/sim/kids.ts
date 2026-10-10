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

export const KID_KINDS = ['naughty', 'nice', 'runner', 'tourist', 'trip', 'busker'] as const;
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
  // London (Level 3). A tourist ambles round its sight and snaps a photo of a snake now and then.
  tourist: { roam: 1.1, reach: 8, throwEvery: 9 },
  // The school-trip crocodile walks its path at a steady pace; the odd one throws (see TRIP_THROWS).
  trip: { roam: 1.2, reach: 10, throwEvery: 6 },
  // A busker never moves: they play, and a snake close by dances (world.ts, BUSK_REACH).
  busker: { roam: 0, reach: 0, throwEvery: 0 },
};

/** London's school trip: how far apart the children walk on the rope. */
export const TRIP_GAP = 0.9;
/**
 * Who on the trip throws what, by place in the line (0 is the teacher at the front, who never
 * does): the naughty ones toss a soggy chip, the nice ones blow a kiss.
 */
export const TRIP_THROWS: readonly (ProjectileKind | null)[] = [null, null, 'chip', null, 'kiss', null, 'chip', null, 'kiss'];

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
  /** London: a tourist's home sight (it ambles round it); for the trip, the distance walked along its path. */
  hx: number;
  hz: number;
  along: number;
}

export const PROJECTILE_KINDS = ['pebble', 'kiss', 'chip'] as const;
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
  return { kind, x: 0, z: 0, heading: 0, speed: 0, throwIn: 0, pauseFor: 0, tx: 0, tz: 0, wanderIn: 0, hx: 0, hz: 0, along: 0 };
}

/** A closed path's total length. */
export function loopLength(path: readonly Spot[]): number {
  let len = 0;
  for (let i = 0; i < path.length; i++) {
    const a = path[i];
    const b = path[(i + 1) % path.length];
    len += Math.hypot(b.x - a.x, b.z - a.z);
  }
  return len;
}

/** The point `d` metres along a closed path (wrapping), and the way it runs there. */
export function alongLoop(path: readonly Spot[], total: number, d: number, out: { x: number; z: number; heading: number }): void {
  let left = ((d % total) + total) % total;
  for (let i = 0; i < path.length; i++) {
    const a = path[i];
    const b = path[(i + 1) % path.length];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (left <= len || i === path.length - 1) {
      const t = len > 0 ? Math.min(1, left / len) : 0;
      out.x = a.x + (b.x - a.x) * t;
      out.z = a.z + (b.z - a.z) * t;
      out.heading = Math.atan2(b.z - a.z, b.x - a.x);
      return;
    }
    left -= len;
  }
}

export function makeKids(stage: Stage, rng: Rng): Kid[] {
  const out: Kid[] = [];
  // London's people stand at fixed spots (in stage order): tourists at their sights, buskers at Covent Garden.
  let tourist = 0;
  let busker = 0;
  let trip = 0;
  const pos = { x: 0, z: 0, heading: 0 };
  for (const kind of stage.kids) {
    if (kind === 'tourist' || kind === 'busker' || kind === 'trip') {
      const k = blankKid(kind);
      if (kind === 'trip') {
        // The crocodile: the teacher at the front, the children behind on the rope, all on one path.
        const path = stage.tripPath ?? [];
        const total = loopLength(path);
        k.along = (total - trip * TRIP_GAP + total) % total;
        alongLoop(path, total, k.along, pos);
        k.x = pos.x;
        k.z = pos.z;
        k.heading = pos.heading;
        k.throwIn = 2 + trip * 0.7; // staggered, so the line does not all let fly at once
        trip++;
      } else {
        const spots = kind === 'tourist' ? (stage.touristSpots ?? []) : (stage.buskerSpots ?? []);
        const at = spots[(kind === 'tourist' ? tourist++ : busker++) % Math.max(1, spots.length)] ?? stage.fallbackSpot;
        k.x = k.tx = k.hx = at.x;
        k.z = k.tz = k.hz = at.z;
        k.heading = Math.PI / 2; // facing the camera
        k.throwIn = 2 + (tourist + busker) * 1.3;
      }
      out.push(k);
      continue;
    }
    const p = spawnSpot(stage, rng);
    out.push({
      kind, x: p.x, z: p.z, heading: rng.range(0, Math.PI * 2), speed: 0,
      throwIn: rng.range(1, KIDS[kind].throwEvery || 1), pauseFor: 0, tx: p.x, tz: p.z, wanderIn: 0, hx: p.x, hz: p.z, along: 0,
    });
  }
  return out;
}
