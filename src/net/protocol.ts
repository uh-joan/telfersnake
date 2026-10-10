import { ANIMAL_KINDS, type Animal } from '../sim/animals';
import type { CooperState } from '../sim/view';
import { FOOD_KINDS, type Food } from '../sim/food';
import { CREATURE_KINDS, type Creature } from '../sim/creatures';
import { HAZARD_KINDS, type Hazard, type Pellet } from '../sim/hazards';
import { KID_KINDS, type Kid, PROJECTILE_KINDS, type Projectile } from '../sim/kids';
import { PREDATOR_KINDS, type Predator } from '../sim/predators';
import type { Mode } from '../sim/modes';
import type { StageId } from '../sim/stage';
import { CARRIERS, type Snake, type SnakeLook } from '../sim/snake';
import { type CardId, UPGRADE_IDS, type UpgradeId } from '../sim/upgrades';
import { VEHICLE_KINDS, type Vehicle } from '../sim/vehicles';
import type { Button, Treasure } from '../sim/treasures';
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
  | { t: 'hello'; v: number; mode?: Mode; stage?: StageId; buy?: 0 | 1; skin: string; hat: string; trail: string; name: string }
  /** Changed clothes (or name) in the Tuck Shop, mid-game. */
  | { t: 'look'; skin: string; hat: string; trail: string; name: string }
  /** Whether I now have a gem to spend, so the server knows whether to offer me power cards. */
  | { t: 'gems'; on: 0 | 1 }
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

/** x, z, heading, mass, score, flags, respawnIn, immune, packed upgrade levels, magic bitmask */
export type SnakeRow = [number, number, number, number, number, number, number, number, number, number];
/** x, z, heading, speed, travel, dazed, born */
export type AnimalRow = [number, number, number, number, number, number, number];
/**
 * x, z, heading, speed (kind is fixed per index, sent once in welcome), and for London's lions and
 * ravens a fifth: their state (LION / RAVEN in predators.ts: statue or awake, perched or out).
 * Readers that know only four columns (the HD client) simply never look at it.
 */
export type PredatorRow = [number, number, number, number] | [number, number, number, number, number];
/** London's buses and cabs: x, z, heading, speed (kind fixed per index, sent once in welcome). */
export type VehicleRow = [number, number, number, number];
/**
 * x, z, heading, speed (kind is fixed per index, sent once in welcome). London's people ride it too:
 * tourists, the school trip (the first is its teacher; the line is blended like the animals) and buskers.
 */
export type KidRow = [number, number, number, number];
/** x, z, kind, t (flight progress 0..1, for the client's arc) */
export type ProjectileRow = [number, number, number, number];
/** London's Crown Jewels: x, z, present (0 while it is away). The gem is fixed per index (JEWEL_KINDS). */
export type TreasureRow = [number, number, 0 | 1];
/**
 * London's per-snake extras, one per snake row: Crown Jewels picked up, the crown (1) for all five, and
 * (A6) what is carrying it (0 nothing, else CARRIERS index + 1: the Eye, the river bus) and the Red
 * Arrows' trail (1). Readers that know only the first two columns simply never look further.
 */
export type SnakeExtra = [number, 0 | 1] | [number, 0 | 1, number, 0 | 1];
/** London's pearl buttons (the Pearly Lights' trail): x, z, born. */
export type ButtonRow = [number, number, number];
/** x, z, heading, speed, present (0 while faded after a gulp). Kind is fixed per index (welcome). */
export type CreatureRow = [number, number, number, number, 0 | 1];
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
  pd: PredatorRow[];
  kd: KidRow[];
  cr: CreatureRow[];
  /** London's traffic. Absent where there is none (the HD client ignores it either way). */
  vh?: VehicleRow[];
  /**
   * London's Crown Jewels, every snapshot; each snake's jewels and crown (`sx`, in `s` order); the
   * pearl buttons (the whole list, only when it changed). All absent elsewhere: the HD client
   * reads snapshots by key, so it never sees them.
   */
  tr?: TreasureRow[];
  sx?: SnakeExtra[];
  pb?: ButtonRow[];
  /** Pebbles and kisses in flight: the whole (usually short) list, every snapshot. */
  pj: ProjectileRow[];
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
      t: 'welcome'; me: number; room: string; stage: StageId; tick: number; seats: Seat[];
      hazards: HazardRow[]; animalKinds: number[]; predatorKinds: number[]; kidKinds: number[]; creatureKinds: number[]; foods: FoodRow[]; pellets: PelletRow[];
      /** London's buses and cabs, by VEHICLE_KINDS index. Absent where there is no traffic. */
      vehicleKinds?: number[];
      /** London's Crown Jewels: how many lie about (rows come in `tr`). Absent: none. */
      treasureCount?: number;
      /** London's set pieces: the room's flavour (which ship, which way the jets fly). Absent: none. */
      setPieceSeed?: number;
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
export const FROZEN = 64;

/** Every upgrade level (0..5) as one base-6 number: 6^14 fits comfortably in a double. */
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
    (s.alive ? ALIVE : 0) | (s.slowed ? SLOWED : 0) | (s.dashing ? DASHING : 0) | (s.helmetReady ? HELMET_READY : 0) | (s.cards ? CHOOSING : 0) | (s.awayFor > 0 ? AWAY : 0) | (s.frozenFor > 0 ? FROZEN : 0);
  return [r2(s.x), r2(s.z), r3(s.heading), r2(s.mass), s.score, flags, r2(Math.max(0, s.respawnIn)), r2(s.immune), packUpgrades(s), s.magicMask()];
}

export const animalRow = (a: Animal): AnimalRow => [r2(a.x), r2(a.z), r3(a.heading), r2(a.speed), r2(a.travel), r2(Math.max(0, a.dazed)), a.born];
export const predatorRow = (p: Predator): PredatorRow =>
  p.kind === 'lion' || p.kind === 'raven' ? [r2(p.x), r2(p.z), r3(p.heading), r2(p.speed), p.state] : [r2(p.x), r2(p.z), r3(p.heading), r2(p.speed)];
export const vehicleRow = (v: Vehicle): VehicleRow => [r2(v.x), r2(v.z), r3(v.heading), r2(v.speed)];
export const vehicleKindIndex = (v: Vehicle) => VEHICLE_KINDS.indexOf(v.kind);
export const predatorKindIndex = (p: Predator) => PREDATOR_KINDS.indexOf(p.kind);
export const kidRow = (k: Kid): KidRow => [r2(k.x), r2(k.z), r3(k.heading), r2(k.speed)];
export const kidKindIndex = (k: Kid) => KID_KINDS.indexOf(k.kind);
export const creatureRow = (c: Creature): CreatureRow => [r2(c.x), r2(c.z), r3(c.heading), r2(c.speed), c.respawnIn > 0 ? 0 : 1];
export const creatureKindIndex = (c: Creature) => CREATURE_KINDS.indexOf(c.kind);
export const projectileRow = (pj: Projectile): ProjectileRow => [r2(pj.x), r2(pj.z), PROJECTILE_KINDS.indexOf(pj.kind), r2(pj.total > 0 ? 1 - pj.left / pj.total : 1)];
export const foodRow = (f: Food, i: number): FoodRow => [i, FOOD_KINDS.indexOf(f.kind), f.golden ? 1 : 0, r2(f.x), r2(f.z), f.born];
export const pelletRow = (p: Pellet): PelletRow => [r2(p.x), r2(p.z), r2(p.value), p.born];
export const hazardRow = (h: Hazard): HazardRow => [HAZARD_KINDS.indexOf(h.kind), r2(h.x), r2(h.z), h.r, r3(h.turn)];
export const cooperRow = (c: CooperState): CooperRow => [r2(c.x), r2(c.z), r3(c.heading), r2(c.speed), r2(c.talking)];
export const treasureRow = (t: Treasure): TreasureRow => [r2(t.x), r2(t.z), t.respawnIn > 0 ? 0 : 1];
export const snakeExtra = (s: Snake): SnakeExtra => [s.jewels, s.crowned ? 1 : 0, s.carried ? CARRIERS.indexOf(s.carried.by) + 1 : 0, s.rwb ? 1 : 0];
export const buttonRow = (b: Button): ButtonRow => [r2(b.x), r2(b.z), b.born];
export const animalKindIndex = (a: Animal) => ANIMAL_KINDS.indexOf(a.kind);

/**
 * Events that are only about one player go only to that player; the rest everyone sees. Anything
 * missing from this list reaches the whole room, so each new per-player event must join it as it is
 * added (as London's `guard`, `royal`, `ride`, `warp` and `launch` have): otherwise one child's gem
 * fanfare would play on every phone. Only events that carry a `who` can be listed.
 */
const PER_SEAT: ReadonlySet<Extract<GameEvent, { who: number }>['type']> = new Set([
  'cards', 'bump', 'boop', 'ouch', 'pellet', 'tier', 'helmet', 'pelt', 'kiss', 'magic', 'teatime', 'splash',
  // London's people: the guard's smile and gem, and a tourist's photo (the flash is on that screen only).
  'guard', 'photo',
  // London's legends: the crown's gem payout, and the pearl buttons' little crunch.
  'royal', 'button',
  // London's set pieces: your ride, your Tube trip, your WHEE!, your wobble, your Red Arrows trail, your finale gem.
  'ride', 'warp', 'launch', 'wobble', 'arrows', 'treat',
] as const);

export function eventIsFor(e: GameEvent, seat: number): boolean {
  if (!(PER_SEAT as ReadonlySet<string>).has(e.type)) return true;
  return 'who' in e && e.who === seat;
}
