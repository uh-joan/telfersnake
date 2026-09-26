import type { WebSocket } from 'ws';
import { HATS, skinLook, TRAILS } from '../src/meta/catalogue';
import { cleanName, NAME_MAX, randomName } from '../src/meta/names';
import {
  animalKindIndex, animalRow, type ClientMessage, cooperRow, eventIsFor, foodRow, hazardRow, kidKindIndex, kidRow, pelletRow,
  predatorKindIndex, predatorRow, projectileRow, type Seat, type ServerMessage, SNAPSHOT_EVERY, snakeRow, type Snapshot,
} from '../src/net/protocol';
import { type Mode, rulesFor } from '../src/sim/modes';
import type { StageId } from '../src/sim/stage';
import { stageFor } from '../src/sim/stages';
import { type GameEvent, World } from '../src/sim/world';

/** What a phone says it is wearing. None of it is trusted: every id is checked against the catalogue. */
export interface Outfit {
  skin: string;
  hat: string;
  trail: string;
  name: string;
}

interface Player {
  socket: WebSocket;
  seat: number;
  /** A snapshot was skipped because their connection was backed up: the next one must carry every food again. */
  missedFood: boolean;
  /** The newest input tick received from this player. */
  ack: number;
}

const BACKLOG_LIMIT = 64 * 1024; // bytes queued to one phone before we stop adding to the pile

const send = (socket: WebSocket, message: ServerMessage) => {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
};

/**
 * One playground. It always has the same number of snakes: players sit in seats, bots fill the
 * rest, and a seat passes between the two as people come and go.
 */
export class Room {
  readonly world: World;
  readonly players = new Map<WebSocket, Player>();
  /** When the last player left, or null while anyone is here. */
  emptySince: number | null = Date.now();

  private readonly hats: string[];
  private readonly trails: string[];
  private events: GameEvent[] = [];
  private sentFoods: string[] = [];
  private sentPellets = '';
  /** Someone changed clothes: tell the room, at most once a second. */
  private seatsChanged = false;

  constructor(readonly code: string, readonly isPublic: boolean, readonly mode: Mode = 'normal', readonly stage: StageId = 'school') {
    this.world = World.room((Math.random() * 0x7fffffff) | 0 || 1, rulesFor(mode), stageFor(stage));
    this.hats = this.world.snakes.map(() => 'no-hat');
    this.trails = this.world.snakes.map(() => 'no-trail');
  }

  get hasSpace(): boolean {
    return this.world.humans < this.world.snakes.length;
  }

  private seats(): Seat[] {
    return this.world.snakes.map((s) => ({ id: s.id, bot: s.isBot, look: s.look, hat: this.hats[s.id], trail: this.trails[s.id] }));
  }

  private broadcast(message: ServerMessage): void {
    for (const p of this.players.values()) send(p.socket, message);
  }

  /** The typed name, cleaned and made unique in this room; a fresh random one if it was empty or blocked. */
  private nameFor(wanted: unknown, seat: number): string {
    const taken = new Set(this.world.snakes.filter((s) => s.id !== seat).map((s) => s.look.name));
    const base = cleanName(wanted) ?? randomName();
    if (!taken.has(base)) return base;
    for (let n = 2; n < 99; n++) {
      const name = `${base} ${n}`.slice(0, NAME_MAX + 3);
      if (!taken.has(name)) return name;
    }
    return randomName();
  }

  private dress(seat: number, outfit: Outfit): void {
    // skinLook() falls back to the default for an id it does not know.
    this.world.snakes[seat].look = skinLook(String(outfit.skin), this.nameFor(outfit.name, seat));
    this.hats[seat] = HATS.some((h) => h.id === outfit.hat) ? outfit.hat : 'no-hat';
    this.trails[seat] = TRAILS.some((t) => t.id === outfit.trail) ? outfit.trail : 'no-trail';
  }

  join(socket: WebSocket, outfit: Outfit, canBuy: boolean): boolean {
    const snake = this.world.join(skinLook('telfer', randomName()), canBuy);
    if (!snake) return false;
    this.dress(snake.id, outfit);
    this.players.set(socket, { socket, seat: snake.id, ack: 0, missedFood: false });
    this.emptySince = null;

    const w = this.world;
    send(socket, {
      t: 'welcome', me: snake.id, room: this.code, stage: this.stage, tick: w.tick, seats: this.seats(),
      hazards: w.hazards.map(hazardRow), animalKinds: w.animals.map(animalKindIndex),
      predatorKinds: w.predators.map(predatorKindIndex), kidKinds: w.kids.map(kidKindIndex),
      foods: w.foods.map(foodRow), pellets: w.pellets.map(pelletRow),
    });
    this.broadcast({ t: 'seats', seats: this.seats() });
    return true;
  }

  leave(socket: WebSocket): void {
    const p = this.players.get(socket);
    if (!p) return;
    this.players.delete(socket);
    this.world.leave(p.seat);
    this.hats[p.seat] = 'no-hat';
    this.trails[p.seat] = 'no-trail';
    if (this.players.size === 0) this.emptySince = Date.now();
    this.broadcast({ t: 'seats', seats: this.seats() });
  }

  /** Anything a phone sends is checked here; a message that makes no sense is simply ignored. */
  receive(socket: WebSocket, message: ClientMessage): void {
    const p = this.players.get(socket);
    if (!p) return;
    if (message.t === 'in') {
      const { x, z, q } = message;
      if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(q)) return;
      const len = Math.hypot(x, z);
      const input = this.world.inputs[p.seat];
      input.active = message.a === 1 && len > 0.01;
      if (input.active) {
        input.x = x / len;
        input.z = z / len;
      }
      input.dash = message.d === 1;
      p.ack = Math.max(p.ack, Math.floor(q));
    } else if (message.t === 'pick') {
      if (Number.isFinite(message.i)) this.world.choose(message.i, p.seat);
    } else if (message.t === 'away') {
      this.world.setAway(p.seat, message.on === 1);
    } else if (message.t === 'gems') {
      // Whether this player can now afford a power card. Only affects their own card rolls.
      this.world.snakes[p.seat].canBuyPowers = message.on === 1;
    } else if (message.t === 'look') {
      // The change always happens; it is the telling-everyone that is rationed (see tick).
      this.dress(p.seat, message);
      this.seatsChanged = true;
    }
  }

  tick(): void {
    const w = this.world;
    w.step();
    if (w.events.length > 0) {
      this.events.push(...w.events);
      w.events.length = 0;
    }
    if (w.tick % SNAPSHOT_EVERY === 0) this.snapshot();
    if (this.seatsChanged && w.tick % 60 === 0) {
      this.seatsChanged = false;
      this.broadcast({ t: 'seats', seats: this.seats() });
    }
  }

  private snapshot(): void {
    const w = this.world;

    // Food hardly ever moves, so only the pieces that changed since last time are sent.
    const foods: Snapshot['f'] = [];
    w.foods.forEach((f, i) => {
      const row = foodRow(f, i);
      const key = row.join();
      if (key === this.sentFoods[i]) return;
      this.sentFoods[i] = key;
      foods.push(row);
    });

    const pellets = w.pellets.map(pelletRow);
    const pelletKey = pellets.join(';');
    const pelletsChanged = pelletKey !== this.sentPellets;
    this.sentPellets = pelletKey;

    const shared = {
      t: 'snap' as const, k: w.tick, s: w.snakes.map(snakeRow), a: w.animals.map(animalRow),
      pd: w.predators.map(predatorRow), kd: w.kids.map(kidRow), pj: w.projectiles.map(projectileRow),
      f: foods, c: cooperRow(w.cooper), ...(pelletsChanged ? { p: pellets } : {}),
    };
    for (const p of this.players.values()) {
      const s = w.snakes[p.seat];
      // A phone on a bad connection: do not pile more on. Snapshots are whole pictures, so skipping
      // one costs nothing, except that food is sent as changes, so they get all of it next time.
      if (p.socket.bufferedAmount > BACKLOG_LIMIT) {
        p.missedFood = true;
        continue;
      }
      const caughtUp = p.missedFood ? { f: w.foods.map(foodRow), p: pellets } : {};
      p.missedFood = false;
      send(p.socket, {
        ...shared,
        ...caughtUp,
        e: this.events.filter((e) => eventIsFor(e, p.seat)),
        you: { ack: p.ack, xp: Math.round(s.xp * 10) / 10, level: s.level, speedFactor: Math.round(s.speedFactor * 100) / 100, cards: s.cards, cardsFor: Math.round(s.cardsFor * 10) / 10 },
      });
    }
    this.events = [];
  }
}
