import { isFree } from './collide';
import { BOUNDS, SNAKE_SPAWN, type Circle } from './layout';
import type { Rng } from './rng';

/**
 * Playground debris. Bumping one never ends the game: the snake bounces off, says "ouch"
 * and hiccups out a few tail segments as pellets that anyone can gobble back up. After a few
 * bumps a piece breaks and a fresh one appears somewhere else, so the map never feels static.
 */

export const HAZARD_KINDS = ['rock', 'stones', 'sticks'] as const;
export type HazardKind = (typeof HAZARD_KINDS)[number];

const RADIUS: Record<HazardKind, number> = { rock: 0.7, stones: 0.5, sticks: 0.55 };

export interface Hazard extends Circle {
  kind: HazardKind;
  /** Fixed random spin so no two look alike. */
  turn: number;
  /** Bumps taken so far, and the number it takes to break this one (2..5). */
  hits: number;
  limit: number;
}

const COUNT = 14; // deliberately sparse: far rarer than food
const SPAWN_CLEARANCE = 7;
const FENCE_GAP = 2.8; // wider than the fattest snake (2.2 m)
const MIN_HITS = 2;
const MAX_HITS = 5;
/** Bike Shed Alley and the yard behind the Old School get more than their share. */
const ROUGH_CORNER = { minX: 12, maxX: BOUNDS.maxX, minZ: 8, maxZ: BOUNDS.maxZ };
const ROUGH_SHARE = 0.4;

const hitLimit = (rng: Rng) => MIN_HITS + rng.int(MAX_HITS - MIN_HITS + 1);

/**
 * Drop `h` somewhere sensible: a free spot with room to slither round, off the fence, clear of
 * the other pieces and of wherever `avoid` says (living snakes). Returns false if it gave up.
 */
export function placeHazard(h: Hazard, rng: Rng, others: readonly Hazard[], avoid: (x: number, z: number) => boolean): boolean {
  for (let tries = 0; tries < 200; tries++) {
    const area = rng.next() < ROUGH_SHARE ? ROUGH_CORNER : BOUNDS;
    const x = rng.range(area.minX, area.maxX);
    const z = rng.range(area.minZ, area.maxZ);
    if (!isFree(x, z, h.r + 1.6, others)) continue;
    // The fence clamp runs after the rock push-out, so a snake squeezed between the two would sit
    // inside the rock and be shrunk over and over. Leave room for the widest snake to pass.
    const edge = h.r + FENCE_GAP;
    if (x < BOUNDS.minX + edge || x > BOUNDS.maxX - edge || z < BOUNDS.minZ + edge || z > BOUNDS.maxZ - edge) continue;
    if (avoid(x, z)) continue;
    h.x = x;
    h.z = z;
    h.turn = rng.range(0, Math.PI * 2);
    h.hits = 0;
    h.limit = hitLimit(rng);
    return true;
  }
  return false;
}

export function makeHazards(rng: Rng): Hazard[] {
  const hazards: Hazard[] = [];
  const clearOfSpawn = (x: number, z: number) => Math.hypot(x - SNAKE_SPAWN.x, z - SNAKE_SPAWN.z) < SPAWN_CLEARANCE;
  for (let i = 0; i < COUNT; i++) {
    const kind = rng.pick(HAZARD_KINDS);
    const h: Hazard = { kind, x: 0, z: 0, r: RADIUS[kind], turn: 0, hits: 0, limit: hitLimit(rng) };
    if (placeHazard(h, rng, hazards, clearOfSpawn)) hazards.push(h);
  }
  return hazards;
}

/** A dropped tail segment. Static; fades away if nobody eats it. */
export interface Pellet {
  x: number;
  z: number;
  value: number;
  born: number;
}

export const PELLET_LIFE_TICKS = 25 * 60;
