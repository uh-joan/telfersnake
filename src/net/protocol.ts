import { ANIMAL_KINDS, type Animal } from '../sim/animals';
import type { CooperState } from '../sim/view';
import { FOOD_KINDS, type Food } from '../sim/food';
import { HAZARD_KINDS, type Hazard, type Pellet } from '../sim/hazards';
import type { Mode } from '../sim/modes';
import type { Snake, SnakeLook } from '../sim/snake';
import { type CardId, UPGRADE_IDS, type UpgradeId } from '../sim/upgrades';
import type { GameEvent } from '../sim/world';

/**
 * What the game server and a phone say to each other. JSON over a WebSocket, with the chatty
 * parts as bare arrays of rounded numbers. The server is the only authority: phones send what
 * the thumbs are doing and draw what they are told.
 *
 * Deliberately absent: any free text from a player. No chat; names are built from fixed word
 * lists (see meta/names.ts) and the server checks them against the same lists.
 */

export const PROTOCOL = 1;
/** Ticks between snapshots: 60 Hz sim, 15 Hz network. */
export const SNAPSHOT_EVERY = 4;

export type ClientMessage =
  /** "Seat me anywhere": there is one way in, the shared playgrounds. `mode` picks which pool. */
  | { t: 'hello'; v: number; mode?: Mode; skin: string; hat: string; trail: string; name: string }
  /** Changed clothes (or name) in the Tuck Shop, mid-game. */
  | { t: 'look'; skin: string; hat: string; trail: string; name: string }
  /** Opened a menu (1) or came back (0): the snake stands aside meanwhile. */
  | { t: 'away'; on: 0 | 1 }
  /** Thumb state. `q` counts the client's ticks so the server can say which it has caught up to. */
  | { t: 'in'; q: number; x: number; z: number; a: 0 | 1; d: 0 | 1 }
  | { t: 'pick'; i: number };

export interface Seat {
  id: number;
  bot: boolean;
  look: SnakeLook;
  hat: string;
  trail: string;
}

/** x, z, heading, mass, score, flags, respawnIn, immune, packed upgrade levels */
export type SnakeRow = [number, number, number, number, number, number, number, number, number];
/** x, z, heading, speed, travel, dazed, born */
export type AnimalRow = [number, number, number, number, number, number, number];
/** index, kind, golden, x, z, born */
export type FoodRow = [number, number, 0 | 1, number, number, number];
/** x, z, value, born */
export type PelletRow = [number, number, number, number];
/** kind, x, z, r, turn */
export type HazardRow = [number, number, number, number, number];
/** x, z, heading, speed, talking */
export type CooperRow = [number, number, number, number, number];

/** Only for the player it is sent to. */
export interface You {
  /** The last input tick the server has applied. */
  ack: number;
  xp: number;
  level: number;
  speedFactor: number;
  cards: CardId[] | null;
  cardsFor: number;
}

export interface Snapshot {
  t: 'snap';
  k: number;
  s: SnakeRow[];
  a: AnimalRow[];
  /** Only the foods that changed since the last snapshot. */
  f: FoodRow[];
  /** The whole list, and only when it changed. */
  p?: PelletRow[];
  c: CooperRow;
  e: GameEvent[];
  you: You;
}

export type ServerMessage =
  | {
      t: 'welcome'; me: number; room: string; tick: number; seats: Seat[];
      hazards: HazardRow[]; animalKinds: number[]; foods: FoodRow[]; pellets: PelletRow[];
    }
  | { t: 'seats'; seats: Seat[] }
  | Snapshot
  | { t: 'sorry'; why: 'full' | 'old' | 'busy' };

// ---------------------------------------------------------------- packing

const r2 = (v: number) => Math.round(v * 100) / 100;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

export const ALIVE = 1;
export const SLOWED = 2;
export const DASHING = 4;
export const HELMET_READY = 8;
export const CHOOSING = 16;
export const AWAY = 32;

/** Every upgrade level (0..5) as one base-6 number: 6^11 fits comfortably in a double. */
export function packUpgrades(s: Snake): number {
  let n = 0;
  for (let i = UPGRADE_IDS.length - 1; i >= 0; i--) n = n * 6 + s.levelOf(UPGRADE_IDS[i]);
  return n;
}

export function unpackUpgrades(n: number): Partial<Record<UpgradeId, number>> {
  const levels: Partial<Record<UpgradeId, number>> = {};
  for (const id of UPGRADE_IDS) {
    levels[id] = n % 6;
    n = Math.floor(n / 6);
  }
  return levels;
}

export function snakeRow(s: Snake): SnakeRow {
  const flags =
    (s.alive ? ALIVE : 0) | (s.slowed ? SLOWED : 0) | (s.dashing ? DASHING : 0) | (s.helmetReady ? HELMET_READY : 0) | (s.cards ? CHOOSING : 0) | (s.awayFor > 0 ? AWAY : 0);
  return [r2(s.x), r2(s.z), r3(s.heading), r2(s.mass), s.score, flags, r2(Math.max(0, s.respawnIn)), r2(s.immune), packUpgrades(s)];
}

export const animalRow = (a: Animal): AnimalRow => [r2(a.x), r2(a.z), r3(a.heading), r2(a.speed), r2(a.travel), r2(Math.max(0, a.dazed)), a.born];
export const foodRow = (f: Food, i: number): FoodRow => [i, FOOD_KINDS.indexOf(f.kind), f.golden ? 1 : 0, r2(f.x), r2(f.z), f.born];
export const pelletRow = (p: Pellet): PelletRow => [r2(p.x), r2(p.z), r2(p.value), p.born];
export const hazardRow = (h: Hazard): HazardRow => [HAZARD_KINDS.indexOf(h.kind), r2(h.x), r2(h.z), h.r, r3(h.turn)];
export const cooperRow = (c: CooperState): CooperRow => [r2(c.x), r2(c.z), r3(c.heading), r2(c.speed), r2(c.talking)];
export const animalKindIndex = (a: Animal) => ANIMAL_KINDS.indexOf(a.kind);

/** Events that are only about one player go only to that player; the rest everyone sees. */
export function eventIsFor(e: GameEvent, seat: number): boolean {
  switch (e.type) {
    case 'cards': case 'bump': case 'boop': case 'ouch': case 'pellet': case 'tier': case 'helmet':
      return e.who === seat;
    default:
      return true;
  }
}
