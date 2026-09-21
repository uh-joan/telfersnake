import { ANIMAL_KINDS, ANIMALS, type Animal, type AnimalKind, makeAnimal, placeAnimal, updateAnimal } from './animals';
import { Bot, type Personality } from './bot';
import { botCardChoice, type Rules, rulesFor } from './modes';
import { isFree, makeHit, resolveCircle, wrapAngle } from './collide';
import { Cooper, COOPER_AURA, COOPER_RADIUS } from './cooper';
import { type Food, type FoodKind, FOOD_VALUE, GOLDEN_MULTIPLIER, placeFood } from './food';
import { type Hazard, type HazardKind, makeHazards, type Pellet, PELLET_LIFE_TICKS, placeHazard } from './hazards';
import { BOUNDS, inBox, SAIL, SNAKE_SPAWN } from './layout';
import { Rng } from './rng';
import { type Input, Snake, type SnakeLook } from './snake';
import { type CardId, POWER_IDS, type PowerId, rollCards, type UpgradeId } from './upgrades';

export const STEP = 1 / 60;
export const PLAYER = 0;

const SLOW_FACTOR = 0.6;
const BUMP_QUIET = 0.4;

/** Animals are gulped from a bit closer than food: they are the ones worth chasing. */
const GULP_REACH = 0.75;
const RESPAWN_CLEARANCE = 15;
const BOOP_SLOWDOWN = 0.35;
const BOOP_COOLDOWN = 1.2;
const GOAT_COOLDOWN = 3;

const OUCH_SHARE = 0.12; // of current mass lost per rock...
const OUCH_MAX = 15; // ...up to this much
const OUCH_GRACE = 1.5; // seconds before the next rock can hurt
const PELLET_RETURN = 0.7; // share of the lost mass that lands on the ground as pellets
const PELLET_MAX = 5;
const PELLET_CAP = 150;

const BODY_HIT = 0.85; // share of a body's radius that counts as solid to another snake's head
const BONK_PELLETS = 14;
const BONK_RETURN = 0.6; // share of a bonked snake's mass scattered as pellets
/** What a bonk does to upgrades: 'all' (lose the lot), 'one-level' (each drops a level) or 'none'. */
const BONK_UPGRADE_LOSS: 'all' | 'one-level' | 'none' = 'all';
const BONK_REWARD = 8; // mass-worth of points and XP for the snake that did the bonking
const RESPAWN_AFTER = 3;
const RESPAWN_GRACE = 3;
const HELMET_GRACE = 1.5;
const SNAKE_CLEARANCE = 12;
const AWAY_TIME = 30; // seconds a player may stand aside in a menu before the game carries on without them
const CARD_TIME = 8; // seconds to choose in a shared room before the first card is taken for you
const DROP_HEADINGS = 8;

const MAGNET_PULL = 7; // m/s
const BEE_ORBIT = 2.4;
const BEE_REACH = 0.9;
const BEE_SPIN = 2.2; // rad/s
const BREATH_HALF_ANGLE = 0.5;
const BREATH_RECHECK = 0.25;
const DAZE = 1.8;
const BREATH_SHARE = 0.14; // fire breath scorches a rival smaller, like bonking a rock
const LASER_HALF_ANGLE = 0.2; // radians either side of dead-ahead the laser can catch a rival

const PLAYER_LOOK: SnakeLook = { name: 'You', body: 0x4cbb4a, stripe: 0xf2d94a, head: 0x57c955 };

/** Bee Buddies orbit on the clock, so the sim and any copy of it agree where each bee is. */
export function beePosition(tick: number, s: Snake, i: number, out: { x: number; z: number }): void {
  const a = tick * STEP * BEE_SPIN + (i * Math.PI * 2) / Math.max(1, s.bees);
  const r = BEE_ORBIT + s.radius;
  out.x = s.x + Math.cos(a) * r;
  out.z = s.z + Math.sin(a) * r;
}

export type GameEvent =
  | { type: 'eat'; who: number; kind: FoodKind; x: number; z: number; points: number; golden: boolean; toasted: boolean }
  | { type: 'gulp'; who: number; kind: AnimalKind; x: number; z: number; points: number }
  | { type: 'boop'; who: number; kind: AnimalKind; x: number; z: number }
  | { type: 'ouch'; who: number; kind: HazardKind; x: number; z: number; lost: number; broke: boolean }
  | { type: 'rock'; i: number; x: number; z: number; turn: number }
  | { type: 'pellet'; who: number; x: number; z: number; points: number }
  | { type: 'tier'; who: number; tier: number }
  | { type: 'cards'; who: number; cards: CardId[] }
  | { type: 'bonk'; who: number; by: number; x: number; z: number; lost: UpgradeId[] }
  | { type: 'helmet'; who: number; x: number; z: number }
  | { type: 'respawn'; who: number; x: number; z: number }
  | { type: 'breath'; who: number; x: number; z: number; heading: number; range: number }
  | { type: 'sneeze'; who: number; by: number; x: number; z: number }
  /** A power was cast: FX at the caster. */
  | { type: 'power'; who: number; kind: PowerId; x: number; z: number; heading: number; range: number }
  /** A rival was shrunk by a power (or bonk): puff at the victim; `by` earns the gem. */
  | { type: 'hit'; who: number; by: number; kind: 'shrink'; x: number; z: number }
  | { type: 'say'; text: string }
  | { type: 'bump'; who: number; what: 'wall' | 'cooper' };

/**
 * The whole game state. Advances in fixed steps from inputs alone: no rendering, no DOM,
 * no wall-clock time, no Math.random. That keeps it ready to run on a server for multiplayer.
 * Note the model that implies: server-authoritative. Math.sin/pow/hypot are not bit-identical
 * across JS engines, so two machines will drift; do not build lockstep or rollback on this.
 */
export class World {
  tick = 0;
  /** Which snake belongs to whoever is looking at this world. Solo play: seat 0. */
  readonly me = PLAYER;
  readonly rng: Rng;
  /** One per seat. A seat is driven by a bot until a player takes it over, and again after they leave. */
  readonly snakes: Snake[] = [];
  /** What each seat's player is pressing, by snake id. Bots ignore theirs. */
  readonly inputs: Input[] = [];
  readonly cooper = new Cooper();
  readonly hazards: Hazard[];
  readonly foods: Food[] = [];
  readonly animals: Animal[] = [];
  readonly pellets: Pellet[] = [];
  /** Things that happened since the caller last drained this. */
  readonly events: GameEvent[] = [];
  /**
   * Solo play pauses on a level-up, as Megabonk does: the caller stops stepping while
   * `cards` is set. A shared room cannot stop for everyone, so there the chooser's snake
   * freezes, cannot be bonked, and takes the first card if they dither.
   */
  private readonly pausesForCards: boolean;

  /** Collision scratch for this world's actors. Per world, so many rooms can share a process. */
  readonly hit = makeHit();

  private readonly bots = new Map<Snake, Bot>();
  private readonly p = { x: 0, z: 0 };
  /** Which difficulty this world runs at: rival personalities, food count, whether bots get upgrades. */
  readonly rules: Rules;

  /**
   * Solo: `new World(seed, look, rules)` seats the player at 0 and four rivals after them.
   * `playerLook` is purely cosmetic (the Tuck Shop skin); it never affects the rules.
   * A shared room: `World.room(seed, rules)` fills every seat with a bot, and players join() later.
   */
  constructor(seed = 1, playerLook: SnakeLook | null = PLAYER_LOOK, rules: Rules = rulesFor('normal')) {
    this.rng = new Rng(seed);
    this.rules = rules;
    this.hazards = makeHazards(this.rng);
    this.pausesForCards = playerLook !== null;

    if (playerLook) {
      const player = new Snake(PLAYER, playerLook, false);
      player.placeAt(SNAKE_SPAWN.x, SNAKE_SPAWN.z, SNAKE_SPAWN.heading);
      this.snakes.push(player);
      this.inputs.push({ x: 0, z: 0, active: false, dash: false });
    }
    for (const who of playerLook ? rules.soloRivals : rules.rivals) {
      const s = new Snake(this.snakes.length, who, true);
      this.snakes.push(s);
      this.inputs.push({ x: 0, z: 0, active: false, dash: false });
      this.seatBot(s, who);
      this.dropIn(s);
    }
    const player = this.snakes[0];

    // Everyone starts blinking: a long rival dropped in at random may be lying across someone.
    for (const s of this.snakes) s.immune = RESPAWN_GRACE;

    for (let i = 0; i < rules.foodCount; i++) {
      const food: Food = { kind: 'cookie', golden: false, x: 0, z: 0, born: -999 };
      placeFood(food, this.rng, -999, player.x, player.z, 2, this.hazards);
      this.foods.push(food);
    }
    for (const kind of ANIMAL_KINDS) {
      for (let i = 0; i < ANIMALS[kind].count; i++) {
        const a = makeAnimal(kind);
        placeAnimal(a, this, 6);
        a.born = -999;
        this.animals.push(a);
      }
    }
  }

  static room(seed: number, rules: Rules = rulesFor('normal')): World {
    return new World(seed, null, rules);
  }

  /** The local player's snake. */
  get snake(): Snake {
    return this.snakes[this.me];
  }

  /** The local player's cards, while they are choosing. */
  get cards(): CardId[] | null {
    return this.snake.cards;
  }

  private seatBot(s: Snake, who: Personality): void {
    s.reset();
    s.look = who;
    s.isBot = true;
    s.mass = who.startMass;
    s.baseSpeedMul = s.speedMul = who.speedMul;
    s.baseGrowthMul = s.growthMul = who.growthMul;
    s.massCap = who.massCap;
    // In God mode the bots take upgrades, so give them the full arsenal of powers too.
    s.powers = new Set(this.rules.botsGetUpgrades ? POWER_IDS : []);
    this.bots.set(s, new Bot(who));
  }

  /** A player takes over a bot's seat, starting small like anyone else. Null if the room is full of players. */
  join(look: SnakeLook, powers: PowerId[] = []): Snake | null {
    const s = this.snakes.find((o) => o.isBot);
    if (!s) return null;
    this.bots.delete(s);
    s.reset();
    s.look = look;
    s.isBot = false;
    s.powers = new Set(powers);
    Object.assign(this.inputs[s.id], { x: 0, z: 0, active: false, dash: false });
    this.respawn(s);
    return s;
  }

  /** A player has gone: their seat goes back to the bot it was made for. */
  leave(id: number): void {
    const s = this.snakes[id];
    if (!s || s.isBot) return;
    this.seatBot(s, this.rules.rivals[id % this.rules.rivals.length]);
    this.respawn(s);
  }

  get humans(): number {
    return this.snakes.filter((s) => !s.isBot).length;
  }

  /** True when no living snake's head is within `clear` metres of (x, z). */
  clearOfSnakes(x: number, z: number, clear: number): boolean {
    for (const s of this.snakes) {
      if (s.alive && (s.x - x) ** 2 + (s.z - z) ** 2 < clear * clear) return false;
    }
    return true;
  }

  /** Spend one of a snake's level-ups on the card at `index`. */
  choose(index: number, who = this.me): void {
    const s = this.snakes[who];
    if (!s?.cards) return;
    const i = Math.min(Math.max(Math.floor(index) || 0, 0), s.cards.length - 1);
    s.takeCard(s.cards[i]);
    s.cards = null;
  }

  /**
   * A player in a shared room has opened a menu (or closed it). The world cannot stop for
   * everyone, so their own snake stops dead and cannot be bonked until they come back.
   *
   * It is immediate and always granted, on purpose. A delay or a cooldown would stop pause being
   * used to dodge, but to a child "I pressed pause and still got bonked" is simply a broken game,
   * and dodging this way only ever protects the pauser: nobody else loses anything.
   * The phone repeats `away` while the menu is open; if it stops (tab closed, phone asleep) the
   * snake is released after AWAY_TIME and the heartbeat frees the seat soon after.
   */
  setAway(who: number, away: boolean): void {
    const s = this.snakes[who];
    if (!s || s.isBot) return;
    s.awayFor = away ? AWAY_TIME : 0;
    if (away) s.immune = Math.max(s.immune, 0.5);
  }

  /** Advance one tick. Solo play passes the player's input here; a room fills `inputs` itself. */
  step(playerInput?: Input): void {
    if (playerInput) Object.assign(this.inputs[this.me], playerInput);
    const dt = STEP;
    const c = this.cooper;

    c.update(this, dt);
    for (const a of this.animals) updateAnimal(a, this, dt);

    for (const s of this.snakes) {
      if (!s.alive) {
        s.respawnIn -= dt;
        if (s.respawnIn <= 0) this.respawn(s);
        continue;
      }
      const bot = this.bots.get(s);
      if (s.awayFor > 0) {
        s.awayFor -= dt;
        s.immune = Math.max(s.immune, 0.5);
        continue;
      }
      if (s.cards && !this.pausesForCards) {
        // Choosing a card in a shared room: stand still, untouchable, until they pick or time runs out.
        s.immune = Math.max(s.immune, 0.5);
        s.cardsFor -= dt;
        if (s.cardsFor <= 0) this.choose(0, s.id);
        continue;
      }
      const input = bot ? bot.think(s, this, dt) : this.inputs[s.id];

      s.slowed = Math.hypot(s.x - c.x, s.z - c.z) < COOPER_AURA;
      s.speedFactor += ((s.slowed ? SLOW_FACTOR : 1) - s.speedFactor) * Math.min(1, dt * 4);
      s.update(input, dt, !s.slowed, this.hazards);

      const ouch = this.bonkRock(s);
      if (s.touchingWall && !s.wasTouchingWall && !ouch && s.bumpQuiet <= 0 && s.immune <= 0) {
        s.bumpQuiet = BUMP_QUIET;
        this.events.push({ type: 'bump', who: s.id, what: 'wall' });
      }

      this.bumpCooper(s, dt);
      this.meetAnimals(s, dt);
      this.pullFood(s, dt);
      this.eat(s);
      this.bees(s);
      this.breathe(s, dt);
      this.castPowers(s, dt);

      if (s.tier > s.highestTier) {
        s.highestTier = s.tier;
        this.events.push({ type: 'tier', who: s.id, tier: s.tier });
      }
      // Upgrades are normally the players' edge: bots level up but get no cards. In God mode that
      // edge is gone — a bot grabs the scariest card at once, and never freezes to choose.
      if (bot && !this.rules.botsGetUpgrades) {
        s.pendingCards = 0;
      } else if (s.pendingCards > 0 && !s.cards) {
        s.cards = rollCards(this.rng, s);
        if (bot) {
          this.choose(botCardChoice(s.cards), s.id);
        } else {
          s.cardsFor = CARD_TIME;
          this.events.push({ type: 'cards', who: s.id, cards: s.cards });
        }
      }
    }

    for (const s of this.snakes) if (s.alive) s.sampleBody();
    this.bonkSnakes();
    this.expirePellets();

    this.tick++;
  }

  // ---------------------------------------------------------------- snakes meeting things

  /** Push a snake's head out of a circle at (cx, cz) and swing it along the surface. */
  private shove(s: Snake, cx: number, cz: number, reach: number, dt: number): void {
    const dx = s.x - cx;
    const dz = s.z - cz;
    const d = Math.hypot(dx, dz);
    const nx = d > 1e-5 ? dx / d : 1;
    const nz = d > 1e-5 ? dz / d : 0;
    // The push must not shoulder the head into a wall or fence.
    resolveCircle(cx + nx * reach, cz + nz * reach, s.radius, this.hit, this.hazards);
    s.x = this.hit.x;
    s.z = this.hit.z;
    s.deflect(nx, nz, dt);
  }

  /** Rocks, sticks and stones: the snake has already bounced off; now it shrinks. */
  private bonkRock(s: Snake): boolean {
    if (!s.touchingWall || s.immune > 0) return false;
    for (const h of this.hazards) {
      const reach = s.radius + h.r + 0.02;
      if ((s.x - h.x) ** 2 + (s.z - h.z) ** 2 > reach * reach) continue;
      s.immune = OUCH_GRACE;
      const full = s.mass < 1 ? 0 : Math.min(OUCH_MAX, Math.max(1, s.mass * OUCH_SHARE));
      const lost = full * (1 - s.rockGuard);
      if (lost > 0) this.shed(s, lost, PELLET_RETURN, Math.min(PELLET_MAX, Math.max(1, Math.round(lost))));
      // Enough bumps and it breaks: a fresh piece pops up elsewhere, clear of every snake.
      const broke = ++h.hits >= h.limit;
      this.events.push({ type: 'ouch', who: s.id, kind: h.kind, x: h.x, z: h.z, lost, broke });
      if (broke) {
        const i = this.hazards.indexOf(h);
        placeHazard(h, this.rng, this.hazards.filter((o) => o !== h), (x, z) => !this.clearOfSnakes(x, z, 9));
        this.events.push({ type: 'rock', i, x: h.x, z: h.z, turn: h.turn });
      }
      return true;
    }
    return false;
  }

  /** Take `lost` mass off a snake and leave `share` of it on the ground as `n` pellets along its tail end. */
  // ---------------------------------------------------------------- powers (gem-unlocked)

  /** Fire whichever offensive powers this snake has unlocked and levelled, each on its own cooldown. */
  private castPowers(s: Snake, dt: number): void {
    if (s.levelOf('laser') > 0) this.fireLaser(s, dt);
    if (s.levelOf('stink') > 0) this.fireStink(s, dt);
    if (s.levelOf('zap') > 0) this.fireZap(s, dt);
  }

  /** Shrink a rival like a rock bonk and puff pellets; `by` is credited (for gems). */
  private scorch(target: Snake, by: Snake, share: number, cap: number): void {
    target.immune = OUCH_GRACE;
    const lost = target.mass < 1 ? 0 : Math.min(cap, Math.max(2, target.mass * share));
    if (lost > 0) this.shed(target, lost, PELLET_RETURN, 3);
    this.events.push({ type: 'hit', who: target.id, by: by.id, kind: 'shrink', x: target.x, z: target.z });
  }

  /** Laser Eyes: a narrow beam that zaps the nearest rival roughly dead ahead. */
  private fireLaser(s: Snake, dt: number): void {
    s.laserIn -= dt;
    if (s.laserIn > 0) return;
    const lv = s.levelOf('laser');
    const range = 8 + 1.5 * lv;
    let best: Snake | null = null;
    let bestD = Infinity;
    for (const o of this.snakes) {
      if (o === s || !o.alive || o.immune > 0) continue;
      const d = Math.hypot(o.x - s.x, o.z - s.z);
      if (d > range || d >= bestD) continue;
      if (Math.abs(wrapAngle(Math.atan2(o.z - s.z, o.x - s.x) - s.heading)) > LASER_HALF_ANGLE) continue;
      bestD = d;
      best = o;
    }
    if (!best) {
      s.laserIn = 0.3;
      return;
    }
    s.laserIn = Math.max(0.8, 2.4 - 0.25 * lv);
    this.events.push({ type: 'power', who: s.id, kind: 'laser', x: s.x, z: s.z, heading: s.heading, range });
    this.scorch(best, s, 0.09, 8);
  }

  /** Stink Cloud: a puff behind the head that shrinks anyone chasing. */
  private fireStink(s: Snake, dt: number): void {
    s.stinkIn -= dt;
    if (s.stinkIn > 0) return;
    const lv = s.levelOf('stink');
    const radius = 2.5 + 0.5 * lv;
    const bx = s.x - Math.cos(s.heading) * radius * 0.6;
    const bz = s.z - Math.sin(s.heading) * radius * 0.6;
    let fired = false;
    for (const o of this.snakes) {
      if (o === s || !o.alive || o.immune > 0 || Math.hypot(o.x - bx, o.z - bz) > radius) continue;
      if (!fired) {
        fired = true;
        this.events.push({ type: 'power', who: s.id, kind: 'stink', x: bx, z: bz, heading: s.heading, range: radius });
      }
      this.scorch(o, s, 0.08, 6);
    }
    s.stinkIn = fired ? Math.max(1.5, 3 - 0.4 * lv) : 0.3;
  }

  /** Zap Ring: a 360° shock that shrinks every rival close by. */
  private fireZap(s: Snake, dt: number): void {
    s.zapIn -= dt;
    if (s.zapIn > 0) return;
    const lv = s.levelOf('zap');
    const radius = 2.5 + 0.4 * lv;
    let fired = false;
    for (const o of this.snakes) {
      if (o === s || !o.alive || o.immune > 0 || Math.hypot(o.x - s.x, o.z - s.z) > radius) continue;
      if (!fired) {
        fired = true;
        this.events.push({ type: 'power', who: s.id, kind: 'zap', x: s.x, z: s.z, heading: s.heading, range: radius });
      }
      this.scorch(o, s, 0.08, 6);
    }
    s.zapIn = fired ? Math.max(1.2, 3.5 - 0.4 * lv) : 0.3;
  }

  private shed(s: Snake, lost: number, share: number, n: number): void {
    const tail = s.length;
    const spread = Math.min(0.7, tail / n);
    for (let i = 0; i < n; i++) {
      s.sampleAt(Math.max(0, tail - 0.3 - i * spread), this.p);
      this.pellets.push({ x: this.p.x, z: this.p.z, value: (lost * share) / n, born: this.tick });
    }
    if (this.pellets.length > PELLET_CAP) this.pellets.splice(0, this.pellets.length - PELLET_CAP);
    s.mass = Math.max(0, s.mass - lost);
  }

  private bumpCooper(s: Snake, dt: number): void {
    const c = this.cooper;
    const reach = s.radius + COOPER_RADIUS;
    if ((s.x - c.x) ** 2 + (s.z - c.z) ** 2 >= reach * reach) return;
    this.shove(s, c.x, c.z, reach, dt);
    if (c.bumped(this)) this.events.push({ type: 'bump', who: s.id, what: 'cooper' });
  }

  private meetAnimals(s: Snake, dt: number): void {
    for (const a of this.animals) {
      const spec = ANIMALS[a.kind];
      const d2 = (a.x - s.x) ** 2 + (a.z - s.z) ** 2;

      if (s.tier >= spec.tier) {
        const reach = s.biteReach * GULP_REACH + spec.radius;
        if (d2 > reach * reach) continue;
        const points = s.gain(spec.value);
        this.events.push({ type: 'gulp', who: s.id, kind: a.kind, x: a.x, z: a.z, points });
        placeAnimal(a, this, RESPAWN_CLEARANCE);
        continue;
      }

      // Too big to swallow: it stands its ground and the snake goes boing.
      const reach = s.radius + spec.radius;
      if (d2 >= reach * reach) continue;
      this.shove(s, a.x, a.z, reach, dt);
      if (a.boopCooldown > 0) continue;
      a.boopCooldown = a.kind === 'goat' ? GOAT_COOLDOWN : BOOP_COOLDOWN;
      s.speedFactor = Math.min(s.speedFactor, BOOP_SLOWDOWN);
      this.events.push({ type: 'boop', who: s.id, kind: a.kind, x: a.x, z: a.z });
    }
  }

  // ---------------------------------------------------------------- eating

  private swallowFood(s: Snake, f: Food, toasted: boolean): void {
    const value = FOOD_VALUE[f.kind] * (f.golden ? GOLDEN_MULTIPLIER : 1) * (toasted ? 2 : 1);
    const points = s.gain(value);
    this.events.push({ type: 'eat', who: s.id, kind: f.kind, x: f.x, z: f.z, points, golden: f.golden, toasted });
    placeFood(f, this.rng, this.tick, s.x, s.z, 8, this.hazards, s.luck);
  }

  private swallowPellet(s: Snake, index: number): void {
    const p = this.pellets[index];
    const points = s.gain(p.value, 5);
    this.events.push({ type: 'pellet', who: s.id, x: p.x, z: p.z, points });
    this.pellets.splice(index, 1);
  }

  private eat(s: Snake): void {
    const reach2 = s.biteReach * s.biteReach;
    for (const f of this.foods) {
      if ((f.x - s.x) ** 2 + (f.z - s.z) ** 2 <= reach2) this.swallowFood(s, f, false);
    }
    for (let i = this.pellets.length - 1; i >= 0; i--) {
      const p = this.pellets[i];
      if ((p.x - s.x) ** 2 + (p.z - s.z) ** 2 <= reach2) this.swallowPellet(s, i);
    }
  }

  private expirePellets(): void {
    for (let i = this.pellets.length - 1; i >= 0; i--) {
      if (this.tick - this.pellets[i].born > PELLET_LIFE_TICKS) this.pellets.splice(i, 1);
    }
  }

  // ---------------------------------------------------------------- upgrades at work

  /** Magnet Tail: food and pellets inside the pull drift to the head. */
  private pullFood(s: Snake, dt: number): void {
    if (s.magnet <= 0) return;
    const r2 = s.magnet * s.magnet;
    const pull = (o: { x: number; z: number }) => {
      const dx = s.x - o.x;
      const dz = s.z - o.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > r2 || d2 < 1e-6) return;
      const d = Math.sqrt(d2);
      const move = Math.min(d, MAGNET_PULL * dt);
      const nx = o.x + (dx / d) * move;
      const nz = o.z + (dz / d) * move;
      // Fences and benches still count: food stops at them instead of sliding through.
      if (!isFree(nx, nz, 0.25, this.hazards)) return;
      o.x = nx;
      o.z = nz;
    };
    for (const f of this.foods) pull(f);
    for (const p of this.pellets) pull(p);
  }

  /** Where bee `i` of a snake's Bee Buddies is right now. Shared with the renderer. */
  beeAt(s: Snake, i: number, out: { x: number; z: number }): void {
    beePosition(this.tick, s, i, out);
  }

  private bees(s: Snake): void {
    for (let i = 0; i < s.bees; i++) {
      this.beeAt(s, i, this.p);
      const bx = this.p.x;
      const bz = this.p.z;
      for (const f of this.foods) {
        if ((f.x - bx) ** 2 + (f.z - bz) ** 2 <= BEE_REACH * BEE_REACH) this.swallowFood(s, f, false);
      }
      for (let k = this.pellets.length - 1; k >= 0; k--) {
        const p = this.pellets[k];
        if ((p.x - bx) ** 2 + (p.z - bz) ** 2 <= BEE_REACH * BEE_REACH) this.swallowPellet(s, k);
      }
    }
  }

  private inBreath(s: Snake, x: number, z: number, range: number): boolean {
    const dx = x - s.x;
    const dz = z - s.z;
    if (dx * dx + dz * dz > range * range) return false;
    return Math.abs(wrapAngle(Math.atan2(dz, dx) - s.heading)) < BREATH_HALF_ANGLE;
  }

  /** Dragon Breath: a cartoon puff that toasts food, dazzles animals and makes rivals sneeze out a few segments. */
  private breathe(s: Snake, dt: number): void {
    if (s.breathLevel <= 0) return;
    s.breathIn -= dt;
    if (s.breathIn > 0) return;
    const range = 4 + s.breathLevel;

    // Only puff when there is something in front worth puffing at.
    let worth = false;
    for (const f of this.foods) if (this.inBreath(s, f.x, f.z, range)) { worth = true; break; }
    if (!worth) for (const o of this.snakes) if (o !== s && o.alive && o.immune <= 0 && this.inBreath(s, o.x, o.z, range)) { worth = true; break; }
    if (!worth) for (const a of this.animals) if (s.tier >= ANIMALS[a.kind].tier && this.inBreath(s, a.x, a.z, range)) { worth = true; break; }
    if (!worth) {
      s.breathIn = BREATH_RECHECK;
      return;
    }

    s.breathIn = 4.2 - 0.4 * s.breathLevel;
    this.events.push({ type: 'breath', who: s.id, x: s.x, z: s.z, heading: s.heading, range });
    for (const f of this.foods) if (this.inBreath(s, f.x, f.z, range)) this.swallowFood(s, f, true);
    for (const a of this.animals) {
      if (s.tier >= ANIMALS[a.kind].tier && this.inBreath(s, a.x, a.z, range)) a.dazed = DAZE;
    }
    for (const o of this.snakes) {
      if (o === s || !o.alive || o.immune > 0 || !this.inBreath(s, o.x, o.z, range)) continue;
      o.immune = OUCH_GRACE;
      // Scorch it smaller, capped like a rock bonk so it stays fair on the biggest rivals.
      const lost = o.mass < 1 ? 0 : Math.min(OUCH_MAX, Math.max(2, o.mass * BREATH_SHARE));
      if (lost > 0) this.shed(o, lost, PELLET_RETURN, 4);
      this.events.push({ type: 'sneeze', who: o.id, by: s.id, x: o.x, z: o.z });
    }
  }

  // ---------------------------------------------------------------- snake on snake

  /**
   * The only real danger in the playground: run your head into another snake's body and you are
   * bonked. Nobody can be bonked while blinking, or under the blue sail.
   */
  private bonkSnakes(): void {
    for (const a of this.snakes) {
      if (!a.alive || a.immune > 0 || inBox(SAIL, a.x, a.z)) continue;
      for (const b of this.snakes) {
        if (b === a || !b.alive || b.immune > 0) continue;
        const gap = Math.hypot(a.x - b.x, a.z - b.z);
        if (gap > b.length + 3) continue;

        let hitX = 0;
        let hitZ = 0;
        let struck = false;
        // Head to head: the lighter snake comes off worse (the higher id, if they weigh the same).
        if (gap < a.radius + b.radius && (a.mass < b.mass || (a.mass === b.mass && a.id > b.id))) {
          struck = true;
          hitX = b.x;
          hitZ = b.z;
        }
        // Nose to nose, mass alone decides (above). Without this the heavier snake could be
        // struck on the lighter one's neck, which sits only two radii behind its head.
        const noseToNose = gap < a.radius + b.radius;
        const reach = a.radius + b.radius * BODY_HIT + b.spikes;
        for (let i = 0; i < b.bodyCount && !struck && !noseToNose; i++) {
          const dx = a.x - b.body[i * 2];
          const dz = a.z - b.body[i * 2 + 1];
          if (dx * dx + dz * dz >= reach * reach) continue;
          struck = true;
          hitX = b.body[i * 2];
          hitZ = b.body[i * 2 + 1];
        }
        if (!struck) continue;

        if (a.helmetReady) {
          // The helmet takes it: bounce straight back the way it came.
          a.helmetReady = false;
          a.helmetIn = a.helmetRecharge;
          a.immune = HELMET_GRACE;
          a.heading = Math.atan2(a.z - hitZ, a.x - hitX);
          resolveCircle(a.x + Math.cos(a.heading) * 0.6, a.z + Math.sin(a.heading) * 0.6, a.radius, this.hit, this.hazards);
          a.x = this.hit.x;
          a.z = this.hit.z;
          this.events.push({ type: 'helmet', who: a.id, x: a.x, z: a.z });
        } else {
          this.bonk(a, b);
        }
        break;
      }
    }
  }

  private bonk(victim: Snake, by: Snake): void {
    const lost = victim.dropUpgrades(BONK_UPGRADE_LOSS);
    this.events.push({ type: 'bonk', who: victim.id, by: by.id, x: victim.x, z: victim.z, lost });
    victim.cards = null;
    const n = Math.min(BONK_PELLETS, Math.max(3, Math.ceil(victim.length / 1.5)));
    // Back to the tank means back to the start: a Wiggly Worm again, whoever you were.
    this.shed(victim, victim.mass, BONK_RETURN, n);
    victim.mass = 0;
    victim.alive = false;
    victim.bodyCount = 0;
    victim.respawnIn = RESPAWN_AFTER;
    by.gain(BONK_REWARD);
  }

  private respawn(s: Snake): void {
    this.dropIn(s);
    s.alive = true;
    s.immune = RESPAWN_GRACE;
    s.speedFactor = 1;
    s.touchingWall = s.wasTouchingWall = false;
    this.events.push({ type: 'respawn', who: s.id, x: s.x, z: s.z });
  }

  /**
   * Put a snake down somewhere open, well away from every other snake, facing a way that lets
   * its whole body lie on open ground: a body laid through a wall looks wrong, and would bonk
   * people from inside the building once its grace ran out.
   */
  private dropIn(s: Snake): void {
    let bestX: number = SNAKE_SPAWN.x;
    let bestZ: number = SNAKE_SPAWN.z;
    let bestHeading = 0;
    let fewest = Infinity;
    const length = s.length;
    for (let tries = 0; tries < 60 && fewest > 0; tries++) {
      const x = this.rng.range(BOUNDS.minX, BOUNDS.maxX);
      const z = this.rng.range(BOUNDS.minZ, BOUNDS.maxZ);
      // Later tries settle for less elbow room rather than giving up.
      if (!isFree(x, z, 2.5, this.hazards) || !this.clearOfSnakes(x, z, tries < 40 ? SNAKE_CLEARANCE : 5)) continue;
      const turn = this.rng.range(0, Math.PI * 2);
      for (let k = 0; k < DROP_HEADINGS && fewest > 0; k++) {
        const heading = wrapAngle(turn + (k * Math.PI * 2) / DROP_HEADINGS);
        let blocked = 0;
        for (let d = 1; d <= length; d += 1) {
          if (!isFree(x - Math.cos(heading) * d, z - Math.sin(heading) * d, 0.4, this.hazards)) blocked++;
        }
        if (blocked >= fewest) continue;
        fewest = blocked;
        bestX = x;
        bestZ = z;
        bestHeading = heading;
      }
    }
    s.placeAt(bestX, bestZ, bestHeading);
  }
}
