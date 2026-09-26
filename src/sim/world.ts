import { ANIMALS, type Animal, type AnimalKind, makeAnimal, placeAnimal, updateAnimal } from './animals';
import { makePredators, type Predator, PREDATORS } from './predators';
import { KID_RADIUS, KIDS, type Kid, makeKids, type Projectile, type ProjectileKind } from './kids';
import { type Creature, type CreatureKind, CREATURES, creatureSpot, makeCreatures } from './creatures';
import { Bot, type Personality } from './bot';
import { botCardChoice, type Rules, rulesFor } from './modes';
import { isFree, makeHit, resolveCircle, slideAlong, turnToward, wrapAngle } from './collide';
import { Cooper, COOPER_AURA, COOPER_RADIUS } from './cooper';
import { type Food, type FoodKind, FOOD_VALUE, GOLDEN_MULTIPLIER, placeFood } from './food';
import { type Hazard, type HazardKind, makeHazards, type Pellet, PELLET_LIFE_TICKS, placeHazard } from './hazards';
import { type Circle, inBox, SCHOOL } from './layout';
import { Rng } from './rng';
import type { Stage } from './stage';
import { type Input, Snake, type SnakeLook, TIERS } from './snake';
import { type CardId, type PowerId, rollCards, type UpgradeId } from './upgrades';

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
const CREATURE_RESPAWN = 25; // seconds a gulped creature stays faded before it returns elsewhere
const PIXIE_MAGNET = 22; // Pixie Dust: a huge food-pull radius
/** Miss Sami, out on the Common with a mum: warm, whimsical, accurate. Bubbles only, like Mr Cooper. */
const SAMI_LINES = [
  'Morning! Lovely to see you on the Common.',
  'Mind the bears, poppet — give them a wide berth.',
  'Ooh, someone has grown! Well done, you.',
  'Have you seen a white stag? They say one lives in the woods.',
  'Stay on the grass, away from the road, there’s a love.',
  'Kind hands and kind hearts, everyone!',
  '…and I said to her, well, he’s not had his tea yet!',
  'The mushrooms are out — the spotted ones are the best.',
  'No throwing pebbles! …Oh. It’s only a little one.',
  'Wave to the kiddies, they do love a friendly snake.',
];
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
  /** A wolf about to sprint: its warning howl. */
  | { type: 'howl'; x: number; z: number }
  /** A predator bit a snake: puff at the victim, who loses mass like a rock bonk. */
  | { type: 'chomp'; kind: 'bear' | 'wolf'; who: number; x: number; z: number }
  /** A power was cast: FX at the caster. */
  | { type: 'power'; who: number; kind: PowerId; x: number; z: number; heading: number; range: number }
  /** A rival was shrunk or frozen by a power (or bonk): puff at the victim; `by` earns the gem. */
  | { type: 'hit'; who: number; by: number; kind: 'shrink' | 'freeze'; x: number; z: number }
  | { type: 'say'; text: string }
  /** A child let fly: a pebble or a blown kiss leaves their hand — a whoosh at (x, z). */
  | { type: 'lob'; kind: ProjectileKind; x: number; z: number }
  /** A pebble caught a snake: a small shrink, "oops, a pebble!". */
  | { type: 'pelt'; who: number; x: number; z: number; lost: number }
  /** A blown kiss reached a snake: a little gift — growth, and sometimes a gem. */
  | { type: 'kiss'; who: number; x: number; z: number; gem: boolean }
  /** A fantastic creature was gulped: its magic bursts, `gems` are earned by `who`. */
  | { type: 'magic'; kind: CreatureKind; who: number; x: number; z: number; gems: number }
  | { type: 'bump'; who: number; what: 'wall' | 'cooper' | 'kid' };

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
  readonly cooper: Cooper;
  readonly hazards: Hazard[];
  /** Everything the snake bounces off: rocks (which shrink it) and the log (which does not). */
  private readonly snakeSolids: Circle[];
  /** The place this world is played: fence, solids, spawn tables, sanctuary, who patrols it. */
  readonly stage: Stage;
  readonly foods: Food[] = [];
  readonly animals: Animal[] = [];
  readonly predators: Predator[] = [];
  /** The Common's children (empty on the school), and the pebbles/kisses in flight. */
  readonly kids: Kid[] = [];
  readonly projectiles: Projectile[] = [];
  /** The Common's fantastic creatures (empty on the school). */
  readonly creatures: Creature[] = [];
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
  /** Miss Sami's little natter with the mum: when she next says something, if the stage has her. */
  private samiSayIn = 3;
  /** Which difficulty this world runs at: rival personalities, food count, whether bots get upgrades. */
  readonly rules: Rules;

  /**
   * Solo: `new World(seed, look, rules)` seats the player at 0 and four rivals after them.
   * `playerLook` is purely cosmetic (the Tuck Shop skin); it never affects the rules.
   * A shared room: `World.room(seed, rules)` fills every seat with a bot, and players join() later.
   */
  constructor(seed = 1, playerLook: SnakeLook | null = PLAYER_LOOK, rules: Rules = rulesFor('normal'), stage: Stage = SCHOOL) {
    this.rng = new Rng(seed);
    this.rules = rules;
    this.stage = stage;
    this.cooper = new Cooper(stage.cooper);
    this.hazards = makeHazards(this.rng, stage);
    // What the snake bounces off: the rocks, plus the fallen log (the children clamber it instead).
    this.snakeSolids = [...this.hazards, ...stage.logs];
    this.pausesForCards = playerLook !== null;

    if (playerLook) {
      const player = new Snake(PLAYER, playerLook, false);
      player.placeAt(stage.snakeSpawn.x, stage.snakeSpawn.z, stage.snakeSpawn.heading);
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

    for (let i = 0; i < Math.round(rules.foodCount * stage.foodScale); i++) {
      const food: Food = { kind: 'cookie', golden: false, x: 0, z: 0, born: -999 };
      placeFood(food, this.rng, stage, -999, player.x, player.z, 2, this.hazards);
      this.foods.push(food);
    }
    for (const kind of stage.animals) {
      for (let i = 0; i < ANIMALS[kind].count; i++) {
        const a = makeAnimal(kind);
        placeAnimal(a, this, 6);
        a.born = -999;
        this.animals.push(a);
      }
    }
    for (const p of makePredators(stage, this.rng)) this.predators.push(p);
    for (const k of makeKids(stage, this.rng)) this.kids.push(k);
    for (const c of makeCreatures(stage, this.rng)) this.creatures.push(c);
  }

  static room(seed: number, rules: Rules = rulesFor('normal'), stage: Stage = SCHOOL): World {
    return new World(seed, null, rules, stage);
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
    // In God mode the bots take upgrades, so let them draw powers too (they pay no gems).
    s.canBuyPowers = this.rules.botsGetUpgrades;
    this.bots.set(s, new Bot(who));
  }

  /** A player takes over a bot's seat, starting small like anyone else. Null if the room is full of players. */
  join(look: SnakeLook, canBuyPowers = false): Snake | null {
    const s = this.snakes.find((o) => o.isBot);
    if (!s) return null;
    this.bots.delete(s);
    s.reset();
    s.look = look;
    s.isBot = false;
    s.canBuyPowers = canBuyPowers;
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
    this.updatePredators(dt);
    this.updateKids(dt);
    this.updateProjectiles(dt);
    this.updateCreatures(dt);
    this.chatterSami(dt);

    for (const s of this.snakes) {
      if (!s.alive) {
        s.respawnIn -= dt;
        if (s.respawnIn <= 0) this.respawn(s);
        continue;
      }
      s.tickMagic(dt);
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
      if (s.frozenFor > 0) {
        // Frozen solid by a rival's Freeze Puff: stands still, cannot steer, until it wears off.
        s.frozenFor -= dt;
        continue;
      }
      const input = bot ? bot.think(s, this, dt) : this.inputs[s.id];

      s.slowed = Math.hypot(s.x - c.x, s.z - c.z) < COOPER_AURA;
      s.speedFactor += ((s.slowed ? SLOW_FACTOR : 1) - s.speedFactor) * Math.min(1, dt * 4);
      s.update(input, dt, !s.slowed, this.stage, this.snakeSolids);

      const ouch = this.bonkRock(s);
      if (s.touchingWall && !s.wasTouchingWall && !ouch && s.bumpQuiet <= 0 && s.immune <= 0) {
        s.bumpQuiet = BUMP_QUIET;
        this.events.push({ type: 'bump', who: s.id, what: 'wall' });
      }

      this.bumpCooper(s, dt);
      this.meetAnimals(s, dt);
      this.meetKids(s, dt);
      this.meetCreatures(s);
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
    resolveCircle(this.stage, cx + nx * reach, cz + nz * reach, s.radius, this.hit, this.snakeSolids);
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
        placeHazard(h, this.rng, this.stage, this.hazards.filter((o) => o !== h), (x, z) => !this.clearOfSnakes(x, z, 9));
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
    if (s.levelOf('freeze') > 0) this.fireFreeze(s, dt);
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
    const bx = s.x + Math.cos(s.heading) * range * 0.5;
    const bz = s.z + Math.sin(s.heading) * range * 0.5;
    const scares = this.predatorsNear(bx, bz, range * 0.5);
    if (!best && !scares) {
      s.laserIn = 0.3;
      return;
    }
    s.laserIn = Math.max(0.8, 2.4 - 0.25 * lv);
    this.events.push({ type: 'power', who: s.id, kind: 'laser', x: s.x, z: s.z, heading: s.heading, range });
    if (best) this.scorch(best, s, 0.09, 8);
    if (scares) this.scarePredators(bx, bz, range * 0.5, false);
  }

  /** Stink Cloud: a puff behind the head that shrinks anyone chasing. */
  private fireStink(s: Snake, dt: number): void {
    s.stinkIn -= dt;
    if (s.stinkIn > 0) return;
    const lv = s.levelOf('stink');
    const radius = 2.5 + 0.5 * lv;
    const bx = s.x - Math.cos(s.heading) * radius * 0.6;
    const bz = s.z - Math.sin(s.heading) * radius * 0.6;
    const scares = this.predatorsNear(bx, bz, radius);
    let fired = scares;
    if (scares) this.events.push({ type: 'power', who: s.id, kind: 'stink', x: bx, z: bz, heading: s.heading, range: radius });
    for (const o of this.snakes) {
      if (o === s || !o.alive || o.immune > 0 || Math.hypot(o.x - bx, o.z - bz) > radius) continue;
      if (!fired) {
        fired = true;
        this.events.push({ type: 'power', who: s.id, kind: 'stink', x: bx, z: bz, heading: s.heading, range: radius });
      }
      this.scorch(o, s, 0.08, 6);
    }
    if (scares) this.scarePredators(bx, bz, radius, false);
    s.stinkIn = fired ? Math.max(1.5, 3 - 0.4 * lv) : 0.3;
  }

  /** Zap Ring: a 360° shock that shrinks every rival close by. */
  private fireZap(s: Snake, dt: number): void {
    s.zapIn -= dt;
    if (s.zapIn > 0) return;
    const lv = s.levelOf('zap');
    const radius = 2.5 + 0.4 * lv;
    const scares = this.predatorsNear(s.x, s.z, radius);
    let fired = scares;
    if (scares) this.events.push({ type: 'power', who: s.id, kind: 'zap', x: s.x, z: s.z, heading: s.heading, range: radius });
    for (const o of this.snakes) {
      if (o === s || !o.alive || o.immune > 0 || Math.hypot(o.x - s.x, o.z - s.z) > radius) continue;
      if (!fired) {
        fired = true;
        this.events.push({ type: 'power', who: s.id, kind: 'zap', x: s.x, z: s.z, heading: s.heading, range: radius });
      }
      this.scorch(o, s, 0.08, 6);
    }
    if (scares) this.scarePredators(s.x, s.z, radius, false);
    s.zapIn = fired ? Math.max(1.2, 3.5 - 0.4 * lv) : 0.3;
  }

  /** Freeze Puff: freezes the nearest rival on the spot for a moment (control, no shrink). */
  private fireFreeze(s: Snake, dt: number): void {
    s.freezeIn -= dt;
    if (s.freezeIn > 0) return;
    const lv = s.levelOf('freeze');
    const radius = 3 + 0.5 * lv;
    let best: Snake | null = null;
    let bestD = Infinity;
    for (const o of this.snakes) {
      if (o === s || !o.alive || o.immune > 0 || o.frozenFor > 0) continue;
      const d = Math.hypot(o.x - s.x, o.z - s.z);
      if (d <= radius && d < bestD) {
        bestD = d;
        best = o;
      }
    }
    const scares = this.predatorsNear(s.x, s.z, radius);
    if (!best && !scares) {
      s.freezeIn = 0.3;
      return;
    }
    s.freezeIn = Math.max(2.5, 5 - 0.5 * lv);
    if (best) {
      best.frozenFor = 0.8 + 0.4 * lv;
      best.immune = Math.max(best.immune, best.frozenFor); // frozen and untouchable, so it is not a free bonk
      this.events.push({ type: 'power', who: s.id, kind: 'freeze', x: best.x, z: best.z, heading: s.heading, range: radius });
      this.events.push({ type: 'hit', who: best.id, by: s.id, kind: 'freeze', x: best.x, z: best.z });
    } else {
      this.events.push({ type: 'power', who: s.id, kind: 'freeze', x: s.x, z: s.z, heading: s.heading, range: radius });
    }
    if (scares) this.scarePredators(s.x, s.z, radius, true);
  }

  // ---------------------------------------------------------------- predators (the Common's dangers)

  /** Bears and wolves: they seek out snakes, chase and bite. Deterministic, so a room stays in sync. */
  private updatePredators(dt: number): void {
    const fer = this.rules.predatorFerocity;
    for (const p of this.predators) {
      const spec = PREDATORS[p.kind];
      if (p.frozenFor > 0) {
        p.frozenFor -= dt;
        p.speed = 0;
        continue;
      }
      p.biteIn -= dt;
      p.wanderIn -= dt;

      // The nearest living snake head within sight (a hidden snake — Fox Trick — is invisible to it).
      let target: Snake | null = null;
      let bestD = spec.sight;
      for (const s of this.snakes) {
        if (!s.alive || s.hasMagic('hidden')) continue;
        const d = Math.hypot(s.x - p.x, s.z - p.z);
        if (d < bestD) {
          bestD = d;
          target = s;
        }
      }

      // Spooked (fire / zap / laser): turn tail and bolt away from the nearest snake, no hunting.
      if (p.scaredFor > 0) {
        p.scaredFor -= dt;
        p.chargeFor = 0;
        const flee = this.nearestSnake(p.x, p.z);
        if (flee) p.heading = turnToward(p.heading, Math.atan2(p.z - flee.z, p.x - flee.x), 6 * dt);
        const dash = spec.chaseSpeed * 0.9;
        resolveCircle(this.stage, p.x + Math.cos(p.heading) * dash * dt, p.z + Math.sin(p.heading) * dash * dt, spec.radius, this.hit, this.stage.logs);
        p.x = this.hit.x;
        p.z = this.hit.z;
        p.speed = dash;
        if (this.hit.hit) p.heading = slideAlong(p.heading, this.hit.nx, this.hit.nz);
        continue;
      }

      // Wolves rest after a sprint; a fresh sighting starts another with a howl.
      if (p.kind === 'wolf') {
        if (p.restFor > 0) {
          p.restFor -= dt;
          target = null;
        } else if (p.chargeFor > 0) {
          p.chargeFor -= dt;
          if (p.chargeFor <= 0) p.restFor = spec.restTime / fer;
        } else if (target) {
          p.chargeFor = spec.chaseTime;
          this.events.push({ type: 'howl', x: p.x, z: p.z });
        }
      }

      const chasing = target && (p.kind === 'bear' || p.chargeFor > 0);
      let speed: number;
      if (chasing && target) {
        p.heading = turnToward(p.heading, Math.atan2(target.z - p.z, target.x - p.x), 4 * dt);
        speed = spec.chaseSpeed * (p.kind === 'wolf' ? fer : 1);
      } else {
        if (p.wanderIn <= 0 || Math.hypot(p.x - p.wx, p.z - p.wz) < 1) this.wanderPredator(p);
        p.heading = turnToward(p.heading, Math.atan2(p.wz - p.z, p.wx - p.x), 3 * dt);
        speed = spec.roamSpeed;
      }

      resolveCircle(this.stage, p.x + Math.cos(p.heading) * speed * dt, p.z + Math.sin(p.heading) * speed * dt, spec.radius, this.hit, this.stage.logs);
      p.x = this.hit.x;
      p.z = this.hit.z;
      p.speed = speed;
      if (this.hit.hit) {
        p.heading = slideAlong(p.heading, this.hit.nx, this.hit.nz);
        this.wanderPredator(p);
      }

      // A bite: shrink whoever is in reach, like a big rock, then wait.
      if (p.biteIn <= 0) {
        for (const s of this.snakes) {
          if (!s.alive || s.immune > 0 || s.hasMagic('hidden') || Math.hypot(s.x - p.x, s.z - p.z) > spec.biteReach + s.radius) continue;
          s.immune = OUCH_GRACE;
          const lost = s.mass < 1 ? 0 : Math.min(spec.biteCap, Math.max(2, s.mass * spec.biteShare * fer));
          if (lost > 0) this.shed(s, lost, PELLET_RETURN, 4);
          this.events.push({ type: 'chomp', kind: p.kind, who: s.id, x: s.x, z: s.z });
          p.biteIn = spec.biteEvery;
          if (p.kind === 'wolf') {
            p.chargeFor = 0;
            p.restFor = spec.restTime / fer; // a wolf snaps once, then slinks off
          }
          break;
        }
      }
    }
  }

  /** Pick a fresh spot for a predator to amble toward. */
  private wanderPredator(p: Predator): void {
    const B = this.stage.bounds;
    for (let tries = 0; tries < 20; tries++) {
      const x = this.rng.range(B.minX, B.maxX);
      const z = this.rng.range(B.minZ, B.maxZ);
      if (!isFree(this.stage, x, z, PREDATORS[p.kind].radius + 0.5, this.stage.logs)) continue;
      p.wx = x;
      p.wz = z;
      break;
    }
    p.wanderIn = this.rng.range(3, 7);
  }

  /** The closest living snake head to a point, or null if nobody is alive. */
  private nearestSnake(x: number, z: number): Snake | null {
    let best: Snake | null = null;
    let bestD = Infinity;
    for (const s of this.snakes) {
      if (!s.alive) continue;
      const d = Math.hypot(s.x - x, s.z - z);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  /** Is any predator within this circle? Always false on the school (no predators). */
  private predatorsNear(x: number, z: number, radius: number): boolean {
    for (const p of this.predators) {
      if (Math.hypot(p.x - x, p.z - z) <= radius + PREDATORS[p.kind].radius) return true;
    }
    return false;
  }

  /**
   * A power splash reaches the Common's beasts: Freeze roots them; fire, zaps and lasers spook them
   * into fleeing. Empty on the school (no predators there), so it changes nothing that plays there.
   */
  private scarePredators(x: number, z: number, radius: number, freeze: boolean): void {
    for (const p of this.predators) {
      if (Math.hypot(p.x - x, p.z - z) > radius + PREDATORS[p.kind].radius) continue;
      if (freeze) {
        p.frozenFor = Math.max(p.frozenFor, 1.4);
      } else {
        p.scaredFor = Math.max(p.scaredFor, 2.5);
        p.chargeFor = 0;
        p.biteIn = Math.max(p.biteIn, 1);
      }
    }
  }

  // ---------------------------------------------------------------- the kids (the Common's crowd)

  /** Children scampering the meadow: runners for whimsy, the odd pebble-thrower and kiss-blower. */
  private updateKids(dt: number): void {
    for (const k of this.kids) {
      const spec = KIDS[k.kind];
      k.wanderIn -= dt;
      k.throwIn -= dt;

      if (k.pauseFor > 0) {
        k.pauseFor -= dt;
        k.speed = 0;
      } else {
        if (k.wanderIn <= 0 || Math.hypot(k.x - k.tx, k.z - k.tz) < 0.8) this.wanderKid(k);
        k.heading = turnToward(k.heading, Math.atan2(k.tz - k.z, k.tx - k.x), 6 * dt);
        const speed = spec.roam;
        resolveCircle(this.stage, k.x + Math.cos(k.heading) * speed * dt, k.z + Math.sin(k.heading) * speed * dt, KID_RADIUS, this.hit);
        k.x = this.hit.x;
        k.z = this.hit.z;
        k.speed = speed;
        if (this.hit.hit) {
          k.heading = slideAlong(k.heading, this.hit.nx, this.hit.nz);
          this.wanderKid(k);
        }
      }

      // Naughty kids lob a pebble, nice kids blow a kiss — at a snake within reach, on a cooldown.
      if (spec.throwEvery > 0 && k.throwIn <= 0) {
        const target = this.nearestSnake(k.x, k.z);
        if (target && Math.hypot(target.x - k.x, target.z - k.z) <= spec.reach && this.projectiles.length < 24) {
          k.throwIn = spec.throwEvery;
          this.lob(k, target, k.kind === 'naughty' ? 'pebble' : 'kiss');
        } else {
          k.throwIn = 0.6; // nobody in range: glance again shortly
        }
      }
    }
  }

  /** Pick a fresh spot for a child to scamper to; runners roam wild and sometimes freeze to stare. */
  private wanderKid(k: Kid): void {
    const spread = k.kind === 'runner' ? 30 : 14;
    for (let tries = 0; tries < 20; tries++) {
      const x = k.x + this.rng.range(-spread, spread);
      const z = k.z + this.rng.range(-spread, spread);
      if (!isFree(this.stage, x, z, KID_RADIUS + 0.5)) continue;
      k.tx = x;
      k.tz = z;
      break;
    }
    k.wanderIn = this.rng.range(1.5, 4);
    if (k.kind === 'runner' && this.rng.next() < 0.3) k.pauseFor = this.rng.range(0.4, 1.2);
  }

  /** A child throws: aimed a little ahead of the snake, so it stands a chance but is still dodgeable. */
  private lob(k: Kid, target: Snake, kind: ProjectileKind): void {
    const speed = kind === 'pebble' ? 11 : 7;
    const flight = Math.hypot(target.x - k.x, target.z - k.z) / speed;
    const vel = target.baseSpeed * target.speedFactor;
    const aimX = target.x + Math.cos(target.heading) * vel * flight * 0.7;
    const aimZ = target.z + Math.sin(target.heading) * vel * flight * 0.7;
    const dx = aimX - k.x;
    const dz = aimZ - k.z;
    const d = Math.hypot(dx, dz) || 1;
    k.heading = Math.atan2(dz, dx);
    this.projectiles.push({ kind, x: k.x, z: k.z, dx: dx / d, dz: dz / d, speed, left: d, total: d });
    this.events.push({ type: 'lob', kind, x: k.x, z: k.z });
  }

  /** Fly the pebbles and kisses; a head that comes within reach anywhere along the flight cops it. */
  private updateProjectiles(dt: number): void {
    const B = this.stage.bounds;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pj = this.projectiles[i];
      const step = pj.speed * dt;
      pj.x += pj.dx * step;
      pj.z += pj.dz * step;
      pj.left -= step;
      const hitR = pj.kind === 'pebble' ? 1.2 : 1.5;
      const best = this.nearestSnake(pj.x, pj.z);
      if (best && Math.hypot(best.x - pj.x, best.z - pj.z) <= hitR) {
        this.strikeProjectile(pj, best);
        this.projectiles.splice(i, 1);
        continue;
      }
      const out = pj.x < B.minX || pj.x > B.maxX || pj.z < B.minZ || pj.z > B.maxZ;
      if (pj.left <= 0 || out) this.projectiles.splice(i, 1);
    }
  }

  private strikeProjectile(pj: Projectile, best: Snake): void {
    if (pj.kind === 'pebble') {
      if (best.immune > 0) return; // a graze while already blinking: no double dip
      best.immune = OUCH_GRACE * 0.5;
      const lost = best.mass < 1 ? 0 : Math.min(6, Math.max(1, best.mass * 0.05)) * (1 - best.rockGuard);
      if (lost > 0) this.shed(best, lost, PELLET_RETURN, 2);
      this.events.push({ type: 'pelt', who: best.id, x: best.x, z: best.z, lost });
    } else {
      const gem = this.rng.next() < 0.25;
      best.gain(4);
      this.events.push({ type: 'kiss', who: best.id, x: best.x, z: best.z, gem });
    }
  }

  /** A snake ran into a child: the child is never hurt — the snake is nudged, the child scatters. */
  private meetKids(s: Snake, dt: number): void {
    for (const k of this.kids) {
      const reach = s.radius + KID_RADIUS;
      if ((s.x - k.x) ** 2 + (s.z - k.z) ** 2 >= reach * reach) continue;
      this.shove(s, k.x, k.z, reach, dt);
      // Send the child scampering out of the way.
      k.tx = k.x + (k.x - s.x);
      k.tz = k.z + (k.z - s.z);
      k.pauseFor = 0;
      if (s.bumpQuiet <= 0) {
        s.bumpQuiet = BUMP_QUIET;
        this.events.push({ type: 'bump', who: s.id, what: 'kid' });
      }
    }
  }

  /** Miss Sami natters with the mum by the road mouth: an occasional warm line, if the stage has her. */
  private chatterSami(dt: number): void {
    if (!this.stage.greeters) return;
    this.samiSayIn -= dt;
    if (this.samiSayIn > 0) return;
    this.samiSayIn = this.rng.range(7, 13);
    this.events.push({ type: 'say', text: this.rng.pick(SAMI_LINES) });
  }

  // ---------------------------------------------------------------- the fantastic creatures (the woods & the Glade)

  /** Shy, ethereal things: they drift near the Glade, and bolt from any snake that comes near. */
  private updateCreatures(dt: number): void {
    for (const c of this.creatures) {
      const spec = CREATURES[c.kind];
      if (c.respawnIn > 0) {
        c.respawnIn -= dt;
        c.speed = 0;
        if (c.respawnIn <= 0) {
          const p = creatureSpot(this.stage, this.rng); // fade back somewhere new in the woods
          c.x = c.wx = p.x;
          c.z = c.wz = p.z;
        }
        continue;
      }
      c.wanderIn -= dt;
      const near = this.nearestSnake(c.x, c.z);
      const d = near ? Math.hypot(near.x - c.x, near.z - c.z) : Infinity;
      let speed: number;
      if (near && d < spec.alert) {
        c.heading = turnToward(c.heading, Math.atan2(c.z - near.z, c.x - near.x), 5 * dt);
        speed = spec.flee;
      } else {
        if (c.wanderIn <= 0 || Math.hypot(c.x - c.wx, c.z - c.wz) < 1) this.wanderCreature(c);
        c.heading = turnToward(c.heading, Math.atan2(c.wz - c.z, c.wx - c.x), 2 * dt);
        speed = spec.flee * 0.3; // an ethereal drift while nothing is near
      }
      resolveCircle(this.stage, c.x + Math.cos(c.heading) * speed * dt, c.z + Math.sin(c.heading) * speed * dt, spec.radius, this.hit, this.stage.logs);
      c.x = this.hit.x;
      c.z = this.hit.z;
      c.speed = speed;
      if (this.hit.hit) {
        c.heading = slideAlong(c.heading, this.hit.nx, this.hit.nz);
        this.wanderCreature(c);
      }
    }
  }

  private wanderCreature(c: Creature): void {
    for (let tries = 0; tries < 20; tries++) {
      const x = c.x + this.rng.range(-14, 14);
      const z = c.z + this.rng.range(-14, 14);
      if (!isFree(this.stage, x, z, CREATURES[c.kind].radius + 0.5, this.stage.logs)) continue;
      c.wx = x;
      c.wz = z;
      break;
    }
    c.wanderIn = this.rng.range(2, 5);
  }

  /** A touch at any size catches a creature — no tier gate. It fades, and its magic bursts on the snake. */
  private meetCreatures(s: Snake): void {
    for (const c of this.creatures) {
      if (c.respawnIn > 0) continue;
      const reach = s.biteReach * GULP_REACH + CREATURES[c.kind].radius;
      if ((s.x - c.x) ** 2 + (s.z - c.z) ** 2 > reach * reach) continue;
      this.castMagic(s, c.kind);
      c.respawnIn = CREATURE_RESPAWN;
      break; // one blessing per tick
    }
  }

  /** Grant a creature's magic: an instant gift, a timed buff, or both. `gems` is credited to the client. */
  private castMagic(s: Snake, kind: CreatureKind): void {
    let gems = 0;
    switch (kind) {
      case 'stag': {
        // Stag's Blessing: leap straight to the next size tier, a big score, a halo.
        const next = TIERS[Math.min(TIERS.length - 1, s.tier + 1)];
        if (s.mass < next.mass) s.mass = next.mass;
        s.score += 500;
        s.giveMagic('halo', 8);
        gems = 3;
        break;
      }
      case 'unicorn':
        s.giveMagic('rainbow', 20); // Rainbow Rush: every bite golden for a while
        s.score += 150;
        gems = 1;
        break;
      case 'owl':
        s.giveMagic('owl', 30); // Owl Eyes: reveal the creatures on the minimap...
        s.luckyCards += 1; // ...and the next card is epic-or-better
        s.score += 120;
        gems = 1;
        break;
      case 'kitsune':
        s.giveMagic('hidden', 15); // Fox Trick: predators and rivals cannot see you
        s.score += 120;
        gems = 1;
        break;
      case 'pixie':
        s.giveMagic('magnet', 20); // Pixie Dust: a huge food magnet
        s.score += 100;
        gems = 1;
        break;
      case 'squirrel':
        s.gain(28); // Acorn Hoard: a burst of mass
        s.score += 80;
        gems = 2;
        break;
      case 'frog': {
        // Royal Ribbit: the nearest predator is rooted, harmless, for a spell (turned to a frog in spirit).
        const p = this.nearestPredatorTo(s.x, s.z);
        if (p) {
          p.frozenFor = Math.max(p.frozenFor, 10);
          p.scaredFor = 0;
        }
        s.score += 100;
        gems = 1;
        break;
      }
      case 'wisp':
        this.wispCache(s); // Will-o'-the-wisp: it leads you to a golden-food cache
        gems = 2;
        break;
    }
    this.events.push({ type: 'magic', kind, who: s.id, x: s.x, z: s.z, gems });
  }

  private nearestPredatorTo(x: number, z: number): Predator | null {
    let best: Predator | null = null;
    let bestD = Infinity;
    for (const p of this.predators) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  /** Relocate a handful of food around the snake and turn it golden: the wisp's hidden cache. */
  private wispCache(s: Snake): void {
    let n = 0;
    for (const f of this.foods) {
      if (n >= 6) break;
      const a = this.rng.range(0, Math.PI * 2);
      const r = this.rng.range(2, 6);
      const x = s.x + Math.cos(a) * r;
      const z = s.z + Math.sin(a) * r;
      if (!isFree(this.stage, x, z, 0.5)) continue;
      f.x = x;
      f.z = z;
      f.golden = true;
      f.born = this.tick;
      n++;
    }
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
    // Rainbow Rush (the Unicorn): every bite counts golden while it lasts.
    const golden = f.golden || s.hasMagic('rainbow');
    const value = FOOD_VALUE[f.kind] * (golden ? GOLDEN_MULTIPLIER : 1) * (toasted ? 2 : 1);
    const points = s.gain(value);
    this.events.push({ type: 'eat', who: s.id, kind: f.kind, x: f.x, z: f.z, points, golden, toasted });
    placeFood(f, this.rng, this.stage, this.tick, s.x, s.z, 8, this.hazards, s.luck);
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

  /** Magnet Tail: food and pellets inside the pull drift to the head. Pixie Dust widens it hugely. */
  private pullFood(s: Snake, dt: number): void {
    const reach = Math.max(s.magnet, s.hasMagic('magnet') ? PIXIE_MAGNET : 0);
    if (reach <= 0) return;
    const r2 = reach * reach;
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
      if (!isFree(this.stage, nx, nz, 0.25, this.hazards)) return;
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
    if (!worth) for (const p of this.predators) if (this.inBreath(s, p.x, p.z, range)) { worth = true; break; }
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
    for (const p of this.predators) {
      if (this.inBreath(s, p.x, p.z, range)) { p.scaredFor = Math.max(p.scaredFor, 2.5); p.chargeFor = 0; p.biteIn = Math.max(p.biteIn, 1); }
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
      // A hidden snake (Fox Trick) is seen by no one: it can neither be bonked nor bonk into others.
      if (!a.alive || a.immune > 0 || a.hasMagic('hidden') || (this.stage.sanctuary !== null && inBox(this.stage.sanctuary, a.x, a.z))) continue;
      for (const b of this.snakes) {
        if (b === a || !b.alive || b.immune > 0 || b.hasMagic('hidden')) continue;
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
          resolveCircle(this.stage, a.x + Math.cos(a.heading) * 0.6, a.z + Math.sin(a.heading) * 0.6, a.radius, this.hit, this.hazards);
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
    let bestX: number = this.stage.snakeSpawn.x;
    let bestZ: number = this.stage.snakeSpawn.z;
    let bestHeading = 0;
    let fewest = Infinity;
    const length = s.length;
    const B = this.stage.bounds;
    for (let tries = 0; tries < 60 && fewest > 0; tries++) {
      const x = this.rng.range(B.minX, B.maxX);
      const z = this.rng.range(B.minZ, B.maxZ);
      // Later tries settle for less elbow room rather than giving up.
      if (!isFree(this.stage, x, z, 2.5, this.hazards) || !this.clearOfSnakes(x, z, tries < 40 ? SNAKE_CLEARANCE : 5)) continue;
      const turn = this.rng.range(0, Math.PI * 2);
      for (let k = 0; k < DROP_HEADINGS && fewest > 0; k++) {
        const heading = wrapAngle(turn + (k * Math.PI * 2) / DROP_HEADINGS);
        let blocked = 0;
        for (let d = 1; d <= length; d += 1) {
          if (!isFree(this.stage, x - Math.cos(heading) * d, z - Math.sin(heading) * d, 0.4, this.hazards)) blocked++;
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
