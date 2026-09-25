import { makeHit, resolveCircle, turnToward, wrapAngle } from './collide';
import type { Circle } from './layout';
import type { Terrain } from './stage';
import { type CardId, refreshStats, SNACK_MASS, type UpgradeId, xpForLevel } from './upgrades';

export interface Input {
  /** Desired travel direction in world space (x east, z south). Ignored when `active` is false. */
  x: number;
  z: number;
  active: boolean;
  dash: boolean;
}

/** `gulps` is what a snake of that size can newly swallow, as pictures: the players are too young to read. */
export const TIERS = [
  { name: 'Wiggly Worm', mass: 0, gulps: '🐌🐞' },
  { name: 'Grass Snake', mass: 20, gulps: '🐔🦆' },
  { name: 'Python', mass: 70, gulps: '🐇' },
  { name: 'Anaconda', mass: 170, gulps: '🐑🐷' },
  { name: 'MEGA Telfersnake', mass: 350, gulps: '🐐' },
] as const;

const TRAIL_STEP = 0.1; // metres between stored trail points
const TRAIL_CAP = 4096;
const DASH_BOOST = 1.6;
const DASH_COST = 0.8; // mass per second
const DASH_MIN_MASS = 2;
const MAX_RADIUS = 1.1;
const MAX_LENGTH = 60; // metres; score keeps counting past this
const MAX_SPEED = 10; // m/s, about as fast as a thumb can steer
const WALL_DEFLECT = 6; // rad/s the head swings along a wall it is pressed against
const BODY_POINTS = 128;

export interface SnakeLook {
  name: string;
  /** Main colour: used for the minimap, the leaderboard and the default pattern. */
  body: number;
  stripe: number;
  head: number;
  /** Segment colours from the neck back, repeating. Default: four of `body`, one of `stripe`. */
  pattern?: number[];
}

export class Snake {
  x = 0;
  z = 0;
  /** Radians; travel direction is (cos, sin) in the x/z plane. */
  heading = 0;
  mass = 0;
  score = 0;
  /** 1 = full speed. The world eases this down inside Mr Cooper's "walking feet" aura and after a boing. */
  speedFactor = 1;
  dashing = false;
  touchingWall = false;
  wasTouchingWall = false;
  /** Inside Mr Cooper's aura right now. */
  slowed = false;
  /** Where it is being steered, remembered so a shove slides the way the player is leaning. (0, 0) = hands off. */
  steerX = 0;
  steerZ = 0;
  /** Normal of the wall it last touched; only meaningful while touchingWall. */
  private wallNx = 0;
  private wallNz = 0;
  /** Seconds until the next wall thud may sound: grazing a rock flickers in and out of contact. */
  bumpQuiet = 0;
  /** Seconds of grace left: nothing can shrink or bonk it, and the renderer blinks. */
  immune = 0;
  /** False between being bonked and popping back out of the tank. */
  alive = true;
  respawnIn = 0;
  /** Tier-ups are only celebrated the first time: dashing or a rock can dip you back under a threshold. */
  highestTier = 0;

  xp = 0;
  level = 1;
  /** Level-ups earned but not yet spent on a card. */
  pendingCards = 0;
  /** The three cards on offer right now, while this snake's player is choosing. */
  cards: CardId[] | null = null;
  /** Seconds left to choose before the first card is taken for them (multiplayer only). */
  cardsFor = 0;
  /** Seconds left standing aside in a shared room (in a menu): frozen and untouchable. */
  awayFor = 0;


  // Numbers driven by upgrades; see refreshStats. The base multipliers belong to the snake itself
  // (Spaghetti is naturally slow), the rest start neutral.
  baseSpeedMul = 1;
  baseGrowthMul = 1;
  /** Mass at which it stops growing. Rivals have one; the player does not. */
  massCap = Infinity;
  speedMul = 1;
  growthMul = 1;
  xpMul = 1;
  /** Share of a rock's shrink that is ignored, 0..1. */
  rockGuard = 0;
  /** Radius in which food drifts to the head. 0 = no magnet. */
  magnet = 0;
  reachBonus = 0;
  luck = 0;
  /** Extra metres added to the body's bonk zone. */
  spikes = 0;
  bees = 0;
  breathLevel = 0;
  breathIn = 0;
  /** Whether power cards may be offered to this snake (the player has a gem to spend, or it's a God bot). */
  canBuyPowers = false;
  /** Seconds until each power may fire again. */
  laserIn = 0;
  stinkIn = 0;
  zapIn = 0;
  freezeIn = 0;
  /** Seconds this snake is frozen solid (a rival's Freeze Puff): it cannot steer or move. */
  frozenFor = 0;
  /** Seconds a spent helmet takes to come back. 0 = no helmet owned. */
  helmetRecharge = 0;
  helmetReady = false;
  helmetIn = 0;

  /** Body positions sampled once per tick for snake-on-snake checks: x0, z0, x1, z1, ... */
  readonly body = new Float32Array(BODY_POINTS * 2);
  bodyCount = 0;

  private readonly upgrades = new Map<UpgradeId, number>();
  private readonly hit = makeHit();
  private readonly p = { x: 0, z: 0 };

  // Ring buffer of past head positions, newest first, exactly TRAIL_STEP apart.
  private tx = new Float32Array(TRAIL_CAP);
  private tz = new Float32Array(TRAIL_CAP);
  private start = 0;
  private count = 0;

  /** `look` and `isBot` change when a player takes over a seat from a bot, or hands it back. */
  constructor(readonly id: number, public look: SnakeLook, public isBot: boolean) {}

  /** Wipe everything a previous occupant of this seat earned. */
  reset(): void {
    this.mass = 0;
    this.score = 0;
    this.xp = 0;
    this.level = 1;
    this.pendingCards = 0;
    this.cards = null;
    this.awayFor = 0;
    this.highestTier = 0;
    this.speedFactor = 1;
    this.baseSpeedMul = this.baseGrowthMul = 1;
    this.massCap = Infinity;
    this.upgrades.clear();
    this.helmetReady = false;
    this.helmetRecharge = 0;
    this.laserIn = this.stinkIn = this.zapIn = this.freezeIn = 0;
    this.frozenFor = 0;
    refreshStats(this);
  }

  /** Replace the upgrade levels wholesale: how a client mirrors what the server says it owns. */
  setUpgrades(levels: Partial<Record<UpgradeId, number>>): void {
    this.upgrades.clear();
    for (const [id, level] of Object.entries(levels) as [UpgradeId, number][]) if (level > 0) this.upgrades.set(id, level);
    const ready = this.helmetReady;
    refreshStats(this);
    this.helmetReady = ready;
  }

  /** Drop the snake at a spot with its body laid out straight behind it. */
  placeAt(x: number, z: number, heading: number): void {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.start = 0;
    this.count = 0;
    const n = Math.ceil(this.length / TRAIL_STEP) + 2;
    for (let i = n; i >= 0; i--) {
      this.pushTrail(x - Math.cos(heading) * i * TRAIL_STEP, z - Math.sin(heading) * i * TRAIL_STEP);
    }
    this.sampleBody();
  }

  get length(): number {
    return Math.min(MAX_LENGTH, 3 + 0.9 * Math.pow(this.mass, 0.6));
  }

  /** Girth stops growing at MAX_RADIUS so the snake always fits the playground's 3 m alleys; length does not. */
  get radius(): number {
    return Math.min(MAX_RADIUS, 0.3 + 0.045 * Math.pow(this.mass, 0.4));
  }

  /** Bigger snakes are faster... */
  get baseSpeed(): number {
    return Math.min(MAX_SPEED, 4.5 + 0.35 * Math.pow(this.mass, 0.4)) * this.speedMul;
  }

  /** ...but turn in a wider circle. */
  get turnRate(): number {
    return 5 / (1 + 2 * (this.radius - 0.3));
  }

  /**
   * How far from the head centre food gets gulped. Kept wider than the tightest turning
   * circle at small sizes, otherwise food beside the head can never be reached, only orbited.
   */
  get biteReach(): number {
    return this.radius * 1.5 + 0.8 + this.reachBonus;
  }

  /** Big enough to spend length on a dash, and not on Mr Cooper's walking feet. */
  get canDash(): boolean {
    return this.alive && !this.slowed && this.mass > DASH_MIN_MASS;
  }

  get tier(): number {
    let t = 0;
    for (let i = 0; i < TIERS.length; i++) if (this.mass >= TIERS[i].mass) t = i;
    return t;
  }

  levelOf(id: UpgradeId): number {
    return this.upgrades.get(id) ?? 0;
  }

  /** Owned upgrades in the order they were first picked. */
  ownedUpgrades(): IterableIterator<[UpgradeId, number]> {
    return this.upgrades.entries();
  }

  /** Swallow something worth `value` mass. Returns the points scored. */
  gain(value: number, pointsPerMass = 10): number {
    const points = Math.max(1, Math.round(value * pointsPerMass));
    // Grow, but never past the cap (and never shrink a snake that is somehow already over it).
    this.mass = Math.min(this.mass + value * this.growthMul, Math.max(this.mass, this.massCap));
    this.score += points;
    this.xp += value * this.xpMul;
    while (this.xp >= xpForLevel(this.level)) {
      this.xp -= xpForLevel(this.level);
      this.level++;
      this.pendingCards++;
    }
    return points;
  }

  /**
   * Being bonked costs upgrades. 'all' wipes the lot and starts the level count again, so the
   * next cards come quickly; 'one-level' takes a level off each. Returns what was lost entirely
   * or reduced, for the HUD to show.
   */
  dropUpgrades(rule: 'all' | 'one-level' | 'none'): UpgradeId[] {
    if (rule === 'none' || this.upgrades.size === 0) return [];
    const lost = [...this.upgrades.keys()];
    let levelsLost = 0;
    for (const id of lost) {
      const level = this.levelOf(id);
      const left = rule === 'all' ? 0 : level - 1;
      levelsLost += level - left;
      if (left > 0) this.upgrades.set(id, left);
      else this.upgrades.delete(id);
    }
    // Hand the levels back too: otherwise every replacement card would cost a fortune in XP.
    this.level = Math.max(1, this.level - levelsLost);
    this.xp = 0;
    this.pendingCards = 0;
    this.helmetReady = false;
    this.helmetRecharge = 0;
    refreshStats(this);
    return lost;
  }

  takeCard(card: CardId): void {
    this.pendingCards = Math.max(0, this.pendingCards - 1);
    if (card === 'snack') {
      this.mass += SNACK_MASS * this.growthMul;
      return;
    }
    this.upgrades.set(card, this.levelOf(card) + 1);
    refreshStats(this);
  }

  /** One tick of being a snake: steer, move, and lay down the trail the body follows. */
  update(input: Input, dt: number, canDash: boolean, terrain: Terrain, rocks: readonly Circle[]): void {
    this.move(input, dt, canDash, terrain, rocks);
    this.extendTrail();
  }

  /**
   * Move the head as the server would see it, with no body attached. Shown heads on a client
   * are smoothed, so the trail is laid from the shown position instead: see follow().
   */
  follow(x: number, z: number, heading: number): void {
    if (Math.hypot(x - this.x, z - this.z) > 5) {
      this.placeAt(x, z, heading); // a respawn, not a slither
      return;
    }
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.extendTrail();
  }

  /**
   * Steering and movement only: no trail. `rocks` are this world's extra solids, on top of the
   * stage's fixed layout. A client replays this to predict its own snake ahead of the server.
   */
  move(input: Input, dt: number, canDash: boolean, terrain: Terrain, rocks: readonly Circle[]): void {
    this.immune = Math.max(0, this.immune - dt);
    this.bumpQuiet = Math.max(0, this.bumpQuiet - dt);
    this.steerX = input.active ? input.x : 0;
    this.steerZ = input.active ? input.z : 0;
    if (this.helmetRecharge > 0 && !this.helmetReady) {
      this.helmetIn -= dt;
      if (this.helmetIn <= 0) this.helmetReady = true;
    }
    if (input.active) this.steer(Math.atan2(input.z, input.x), this.turnRate * dt);

    this.dashing = input.dash && canDash && this.mass > DASH_MIN_MASS;
    if (this.dashing) this.mass = Math.max(DASH_MIN_MASS, this.mass - DASH_COST * dt);

    const speed = this.baseSpeed * this.speedFactor * (this.dashing ? DASH_BOOST : 1);
    const nx = this.x + Math.cos(this.heading) * speed * dt;
    const nz = this.z + Math.sin(this.heading) * speed * dt;

    const hit = resolveCircle(terrain, nx, nz, this.radius, this.hit, rocks);
    this.x = hit.x;
    this.z = hit.z;
    this.wasTouchingWall = this.touchingWall;
    this.touchingWall = hit.hit;
    if (hit.hit) {
      this.wallNx = hit.nx;
      this.wallNz = hit.nz;
      this.deflect(hit.nx, hit.nz, dt);
    }
  }

  /**
   * Turn toward `want` by at most `step`. Normally the short way round; but a snake sliding along
   * a wall that is asked to go back the way it came must turn away from the wall, even when
   * that is the long way. The short way points into the wall, the wall pushes the head straight
   * back, and the snake would slide on for ever ignoring the thumb.
   */
  private steer(want: number, step: number): void {
    const diff = wrapAngle(want - this.heading);
    if (this.touchingWall && Math.abs(diff) > Math.PI / 2) {
      const side = Math.sign(diff) || 1;
      const probe = this.heading + side * 0.3;
      const turnsIntoWall = Math.cos(probe) * this.wallNx + Math.sin(probe) * this.wallNz < -0.05;
      const wantsTheWall = Math.cos(want) * this.wallNx + Math.sin(want) * this.wallNz < -0.3;
      if (turnsIntoWall && !wantsTheWall) {
        this.heading = wrapAngle(this.heading - side * step);
        return;
      }
    }
    this.heading = turnToward(this.heading, want, step);
  }

  /** Swing the heading along a surface with normal (nx, nz) so the snake slides instead of sticking. */
  deflect(nx: number, nz: number, dt: number): void {
    const dx = Math.cos(this.heading);
    const dz = Math.sin(this.heading);
    const into = dx * nx + dz * nz;
    if (into >= 0) return;
    let tx = dx - into * nx;
    let tz = dz - into * nz;
    if (tx * tx + tz * tz < 1e-8) {
      // Exactly head-on: slide whichever way the player is leaning, clockwise if they are not.
      // Any real sideways component, however small, must win instead: overriding it with the
      // player's wish makes the head oscillate forever in an inside corner.
      tx = -nz;
      tz = nx;
      if (tx * this.steerX + tz * this.steerZ < 0) {
        tx = -tx;
        tz = -tz;
      }
    }
    this.heading = turnToward(this.heading, Math.atan2(tz, tx), WALL_DEFLECT * dt);
  }

  /** Position `d` metres behind the head, measured along the body. */
  sampleAt(d: number, out: { x: number; z: number }): void {
    const lx = this.tx[this.start];
    const lz = this.tz[this.start];
    const lead = Math.hypot(this.x - lx, this.z - lz);
    if (d <= lead || this.count < 2) {
      const t = lead > 1e-6 ? Math.min(1, d / lead) : 0;
      out.x = this.x + (lx - this.x) * t;
      out.z = this.z + (lz - this.z) * t;
      return;
    }
    const f = (d - lead) / TRAIL_STEP;
    let i = Math.floor(f);
    let t = f - i;
    if (i >= this.count - 1) {
      i = this.count - 2;
      t = 1;
    }
    const a = (this.start + i) % TRAIL_CAP;
    const b = (this.start + i + 1) % TRAIL_CAP;
    out.x = this.tx[a] + (this.tx[b] - this.tx[a]) * t;
    out.z = this.tz[a] + (this.tz[b] - this.tz[a]) * t;
  }

  /**
   * Refresh `body`: points along the snake from just behind the head to the tail, close enough
   * together that another snake's head cannot slip between two of them.
   */
  sampleBody(): void {
    const step = Math.max(0.5, this.radius);
    const length = this.length;
    let n = 0;
    for (let d = this.radius * 2; d <= length && n < BODY_POINTS; d += step) {
      this.sampleAt(d, this.p);
      this.body[n * 2] = this.p.x;
      this.body[n * 2 + 1] = this.p.z;
      n++;
    }
    this.bodyCount = n;
  }

  private extendTrail(): void {
    for (;;) {
      const lx = this.tx[this.start];
      const lz = this.tz[this.start];
      const dx = this.x - lx;
      const dz = this.z - lz;
      const dist = Math.hypot(dx, dz);
      if (dist < TRAIL_STEP) return;
      this.pushTrail(lx + (dx / dist) * TRAIL_STEP, lz + (dz / dist) * TRAIL_STEP);
    }
  }

  private pushTrail(x: number, z: number): void {
    this.start = (this.start - 1 + TRAIL_CAP) % TRAIL_CAP;
    this.tx[this.start] = x;
    this.tz[this.start] = z;
    if (this.count < TRAIL_CAP) this.count++;
  }
}
