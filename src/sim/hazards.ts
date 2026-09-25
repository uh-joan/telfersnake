import { isFree } from './collide';
import type { Circle } from './layout';
import type { Rng } from './rng';
import type { Stage } from './stage';

/**
 * Playground debris. Bumping one never ends the game: the snake bounces off, says "ouch"
 * and hiccups out a few tail segments as pellets that anyone can gobble back up. After a few
 * bumps a piece breaks and a fresh one appears somewhere else, so the map never feels static.
 * A stage with no `hazardArea` (the Common) has none of these: its dangers move.
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

const hitLimit = (rng: Rng) => MIN_HITS + rng.int(MAX_HITS - MIN_HITS + 1);

/**
 * Drop `h` somewhere sensible on `stage`: a free spot with room to slither round, off the fence,
 * clear of the other pieces and of wherever `avoid` says (living snakes). Returns false if it gave up.
 */
export function placeHazard(h: Hazard, rng: Rng, stage: Stage, others: readonly Hazard[], avoid: (x: number, z: number) => boolean): boolean {
  const area = stage.hazardArea;
  if (!area) return false;
  const B = stage.bounds;
  for (let tries = 0; tries < 200; tries++) {
    const box = rng.next() < area.share ? area.rough : B;
    const x = rng.range(box.minX, box.maxX);
    const z = rng.range(box.minZ, box.maxZ);
    if (!isFree(stage, x, z, h.r + 1.6, others)) continue;
    // The fence clamp runs after the rock push-out, so a snake squeezed between the two would sit
    // inside the rock and be shrunk over and over. Leave room for the widest snake to pass.
    const edge = h.r + FENCE_GAP;
    if (x < B.minX + edge || x > B.maxX - edge || z < B.minZ + edge || z > B.maxZ - edge) continue;
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

export function makeHazards(rng: Rng, stage: Stage): Hazard[] {
  const hazards: Hazard[] = [];
  if (!stage.hazardArea) return hazards;
  const spawn = stage.snakeSpawn;
  const clearOfSpawn = (x: number, z: number) => Math.hypot(x - spawn.x, z - spawn.z) < SPAWN_CLEARANCE;
  for (let i = 0; i < COUNT; i++) {
    const kind = rng.pick(HAZARD_KINDS);
    const h: Hazard = { kind, x: 0, z: 0, r: RADIUS[kind], turn: 0, hits: 0, limit: hitLimit(rng) };
    if (placeHazard(h, rng, stage, hazards, clearOfSpawn)) hazards.push(h);
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
