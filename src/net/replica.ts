import { ANIMAL_KINDS, type Animal, makeAnimal } from '../sim/animals';
import { wrapAngle } from '../sim/collide';
import { FOOD_KINDS, type Food } from '../sim/food';
import { HAZARD_KINDS, type Hazard, type Pellet } from '../sim/hazards';
import { type Input, Snake } from '../sim/snake';
import type { CardId } from '../sim/upgrades';
import type { CooperState, WorldView } from '../sim/view';
import { beePosition, type GameEvent, STEP } from '../sim/world';
import {
  ALIVE, AWAY, DASHING, type FoodRow, HELMET_READY, type PelletRow, type Seat, type ServerMessage, SLOWED,
  type Snapshot, unpackUpgrades,
} from './protocol';

type Welcome = Extract<ServerMessage, { t: 'welcome' }>;

/** How far behind the newest snapshot other snakes are drawn, so there are always two to blend between. */
const DELAY_TICKS = 7;
const KEEP_SNAPSHOTS = 12;
const SNAP_IF_OFF_BY = 4; // metres; further than this is a respawn, not an error to smooth away
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpAngle = (a: number, b: number, t: number) => a + wrapAngle(b - a) * t;

interface Pending {
  q: number;
  input: Input;
}

/**
 * This phone's copy of a shared playground, shaped exactly like the real World so the renderer
 * cannot tell the difference. The server decides everything; this only makes it look smooth:
 *
 *  - other snakes, the animals and Mr Cooper are drawn slightly in the past, blended between the
 *    two snapshots either side of that moment;
 *  - your own snake is moved at once by your own thumb (the same move() the server runs), then
 *    quietly corrected whenever the server's version arrives;
 *  - bodies are not sent at all. A body is just where the head has been, so each phone lays
 *    the trail itself from the head it is showing.
 */
export class Replica implements WorldView {
  tick = 0;
  readonly me: number;
  readonly room: string;
  readonly snakes: Snake[] = [];
  readonly hats: string[] = [];
  readonly trails: string[] = [];
  /** The server has my snake standing aside (I am in a menu). */
  away = false;
  /** I have opened a menu: stop my snake on this screen at once, without waiting to hear back. */
  paused = false;
  readonly cooper: CooperState = { x: 0, z: 0, heading: 0, speed: 0, talking: 0 };
  readonly hazards: Hazard[];
  readonly foods: Food[];
  readonly animals: Animal[];
  pellets: Pellet[];
  readonly events: GameEvent[] = [];
  cards: CardId[] | null = null;
  /** Goes up whenever a seat really changes (someone joins, leaves or changes clothes). */
  seatsVersion = 0;
  /** Which seats changed at the last bump, so the renderer rebuilds only those snakes. */
  readonly changedSeats = new Set<number>();
  /** Seconds since the server was last heard from. */
  silentFor = 0;
  private seatKeys: string[] = [];

  private readonly snaps: Snapshot[] = [];
  private renderTick = 0;
  // Predicting my own snake: a body-less stand-in the inputs are replayed on.
  private readonly ghost: Snake;
  private readonly pending: Pending[] = [];
  private q = 0;
  private owed = 0;
  private shownX = 0;
  private shownZ = 0;
  private shownHeading = 0;
  private wasAlive: boolean[] = [];

  constructor(welcome: Welcome, private readonly sendInput: (q: number, input: Input) => void) {
    this.me = welcome.me;
    this.room = welcome.room;
    this.tick = this.renderTick = welcome.tick;
    this.hazards = welcome.hazards.map(([kind, x, z, r, turn]) => ({ kind: HAZARD_KINDS[kind], x, z, r, turn, hits: 0, limit: 0 }));
    this.foods = welcome.foods.map(() => ({ kind: FOOD_KINDS[0], golden: false, x: 0, z: 0, born: -999 }));
    for (const row of welcome.foods) this.setFood(row);
    this.animals = welcome.animalKinds.map((k) => makeAnimal(ANIMAL_KINDS[k]));
    this.pellets = welcome.pellets.map(this.toPellet);
    this.ghost = new Snake(-1, welcome.seats[0].look, false);
    this.setSeats(welcome.seats);
  }

  get snake(): Snake {
    return this.snakes[this.me];
  }

  beeAt(s: Snake, i: number, out: { x: number; z: number }): void {
    beePosition(this.tick, s, i, out);
  }

  setSeats(seats: Seat[]): void {
    let changed = false;
    for (const seat of seats) {
      const key = JSON.stringify(seat);
      if (key === this.seatKeys[seat.id]) continue;
      this.seatKeys[seat.id] = key;
      this.changedSeats.add(seat.id);
      changed = true;
      const look = seat.id === this.me ? { ...seat.look, name: 'You' } : seat.look;
      const s = this.snakes[seat.id];
      if (!s) this.snakes[seat.id] = new Snake(seat.id, look, seat.bot);
      else {
        s.look = look;
        s.isBot = seat.bot;
      }
      this.hats[seat.id] = seat.hat;
      this.trails[seat.id] = seat.trail;
    }
    if (changed) this.seatsVersion++;
  }

  private toPellet = ([x, z, value, born]: PelletRow): Pellet => ({ x, z, value, born });

  private setFood([i, kind, golden, x, z, born]: FoodRow): void {
    const f = this.foods[i];
    if (!f) return;
    f.kind = FOOD_KINDS[kind];
    f.golden = golden === 1;
    f.x = x;
    f.z = z;
    f.born = born;
  }

  /** A snapshot has arrived. Facts are taken at once; positions wait to be blended in update(). */
  receive(snap: Snapshot): void {
    this.silentFor = 0;
    this.snaps.push(snap);
    if (this.snaps.length > KEEP_SNAPSHOTS) this.snaps.shift();
    for (const row of snap.f) this.setFood(row);
    if (snap.p) this.pellets = snap.p.map(this.toPellet);
    for (const e of snap.e) {
      if (e.type === 'rock') {
        const h = this.hazards[e.i];
        if (h) {
          h.x = e.x;
          h.z = e.z;
          h.turn = e.turn;
        }
      }
    }
    this.events.push(...snap.e);
    this.cards = snap.you.cards;
    this.away = (snap.s[this.me][5] & AWAY) !== 0;

    snap.s.forEach((row, id) => {
      const s = this.snakes[id];
      if (!s) return;
      const [x, z, heading, mass, score, flags, respawnIn, immune, upgrades] = row;
      s.mass = mass;
      s.score = score;
      s.alive = (flags & ALIVE) !== 0;
      s.slowed = (flags & SLOWED) !== 0;
      s.dashing = (flags & DASHING) !== 0;
      s.helmetReady = (flags & HELMET_READY) !== 0;
      s.respawnIn = respawnIn;
      s.immune = immune;
      s.setUpgrades(unpackUpgrades(upgrades));
      s.helmetReady = (flags & HELMET_READY) !== 0;
      s.highestTier = Math.max(s.highestTier, s.tier);
      // Popped back out of the tank somewhere new: start a fresh body there.
      if (s.alive && !this.wasAlive[id]) {
        s.placeAt(x, z, heading);
        if (id === this.me) this.resetPrediction(x, z, heading);
      }
      this.wasAlive[id] = s.alive;
    });

    const mine = this.snake;
    mine.xp = snap.you.xp;
    mine.level = snap.you.level;
    mine.cards = snap.you.cards;
    this.reconcile(snap);
  }

  private resetPrediction(x: number, z: number, heading: number): void {
    this.pending.length = 0;
    this.shownX = this.ghost.x = x;
    this.shownZ = this.ghost.z = z;
    this.shownHeading = this.ghost.heading = heading;
  }

  /** Start from where the server says I was, then replay every thumb movement it has not seen yet. */
  private reconcile(snap: Snapshot): void {
    const [x, z, heading, mass] = snap.s[this.me];
    const g = this.ghost;
    while (this.pending.length > 0 && this.pending[0].q <= snap.you.ack) this.pending.shift();
    g.x = x;
    g.z = z;
    g.heading = heading;
    g.mass = mass;
    g.speedFactor = snap.you.speedFactor;
    g.speedMul = this.snake.speedMul;
    // Its wall memory belongs to the previous replay, not to this starting point; steer() must not act on it.
    g.touchingWall = false;
    for (const p of this.pending) g.move(p.input, STEP, !this.snake.slowed, this.hazards);
    if (Math.hypot(g.x - this.shownX, g.z - this.shownZ) > SNAP_IF_OFF_BY) this.resetPrediction(g.x, g.z, g.heading);
  }

  /** Once per frame: move my snake by my thumb, and blend everyone else toward the server's picture. */
  update(dt: number, input: Input): void {
    const mine = this.snake;
    this.silentFor += dt;
    // Not heard from the server for a while: do not let my snake slide on alone through a frozen world.
    const free = mine.alive && !this.cards && !this.away && !this.paused && this.silentFor < 2;

    this.owed = Math.min(this.owed + dt, 0.25);
    while (this.owed >= STEP) {
      this.owed -= STEP;
      this.q++;
      const copy = { ...input };
      this.sendInput(this.q, copy);
      if (free) {
        this.pending.push({ q: this.q, input: copy });
        if (this.pending.length > 120) this.pending.shift();
        this.ghost.move(copy, STEP, !mine.slowed, this.hazards);
      }
    }

    if (free) {
      // The shown head chases the predicted one, so a correction is a nudge rather than a jump.
      const k = 1 - Math.exp(-dt * 18);
      this.shownX = lerp(this.shownX, this.ghost.x, k);
      this.shownZ = lerp(this.shownZ, this.ghost.z, k);
      this.shownHeading = lerpAngle(this.shownHeading, this.ghost.heading, k);
      mine.follow(this.shownX, this.shownZ, this.shownHeading);
    }

    this.blend(dt, free);
  }

  private blend(dt: number, predictingMe: boolean): void {
    const newest = this.snaps[this.snaps.length - 1];
    if (!newest) return;

    // Run the display clock at real speed, nudging it to stay DELAY_TICKS behind the newest news.
    const want = newest.k - DELAY_TICKS;
    this.renderTick += dt * 60;
    if (Math.abs(this.renderTick - want) > 20) this.renderTick = want;
    else this.renderTick += (want - this.renderTick) * Math.min(1, dt * 2);
    this.tick = Math.floor(this.renderTick);

    let a = this.snaps[0];
    let b = this.snaps[0];
    for (const s of this.snaps) {
      if (s.k <= this.renderTick) a = s;
      b = s;
      if (s.k > this.renderTick) break;
    }
    const t = b.k > a.k ? Math.min(1, Math.max(0, (this.renderTick - a.k) / (b.k - a.k))) : 1;

    this.snakes.forEach((s, id) => {
      if (!s.alive || (id === this.me && predictingMe)) return;
      const ra = a.s[id];
      const rb = b.s[id];
      if (!ra || !rb) return;
      // Across a respawn the two rows are far apart: do not slide the snake across the playground.
      if (Math.hypot(rb[0] - ra[0], rb[1] - ra[1]) > SNAP_IF_OFF_BY) {
        s.placeAt(rb[0], rb[1], rb[2]); // a respawn: start a fresh body there, do not stretch one across the gap
      } else {
        s.follow(lerp(ra[0], rb[0], t), lerp(ra[1], rb[1], t), lerpAngle(ra[2], rb[2], t));
      }
      // While I am not steering (choosing a card, in a menu), keep the prediction parked on the
      // server's *newest* word, not the slightly old picture being drawn: then there is nothing
      // to catch up on, and no lurch, when control comes back.
      if (id === this.me) {
        const now = newest.s[id];
        this.resetPrediction(now[0], now[1], now[2]);
      }
    });

    this.animals.forEach((an, i) => {
      const ra = a.a[i];
      const rb = b.a[i];
      if (!ra || !rb) return;
      const moved = Math.hypot(rb[0] - ra[0], rb[1] - ra[1]) > SNAP_IF_OFF_BY;
      const u = moved ? 1 : t;
      an.x = lerp(ra[0], rb[0], u);
      an.z = lerp(ra[1], rb[1], u);
      an.heading = lerpAngle(ra[2], rb[2], u);
      an.speed = rb[3];
      an.travel = lerp(ra[4], rb[4], u);
      an.dazed = rb[5];
      an.born = rb[6];
    });

    const ca = a.c;
    const cb = b.c;
    this.cooper.x = lerp(ca[0], cb[0], t);
    this.cooper.z = lerp(ca[1], cb[1], t);
    this.cooper.heading = lerpAngle(ca[2], cb[2], t);
    this.cooper.speed = cb[3];
    this.cooper.talking = cb[4];
  }
}
