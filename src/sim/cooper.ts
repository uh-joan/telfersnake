import { isFree, resolveCircle, slideAlong, turnToward } from './collide';
import type { Bounds, Spot } from './stage';
import type { World } from './world';

/**
 * Mr Cooper, head teacher. Sprints about the playground politely asking everyone not to run.
 * Never edible, never harmful. Snakes near him drop to walking pace.
 */

export const COOPER_RADIUS = 0.55;
export const COOPER_AURA = 6;

const RUN_SPEED = 3.4;
const TURN_RATE = 5;
const NEAR = 10;
const SEEK_SNAKE_CHANCE = 0.35;

const LINES_GENERAL = [
  'No running, please!',
  'Walking feet, thank you!',
  'Do move along, please.',
  "Single file, if you'd be so kind.",
  'Mind the flower beds, please!',
  'Lovely manners, everyone. Carry on.',
  'Shirts tucked in, please!',
  'Has anyone seen the class snake?',
  'That is not what the hopscotch is for.',
  'Splendid. Absolutely splendid. Move along.',
  'Inside voices, please. Oh. We are outside. Carry on.',
  'Respect and resilience, please. And walking feet.',
  'Lovely collaboration, everyone. Well done.',
  'Be polite and co-operative, thank you!',
  'One hundred years of learning. No running in any of them.',
  'Who, may I ask, let the sheep in?',
  'Chickens are not permitted on the hopscotch.',
  'Would the owner of the goat please come to the office.',
  'Mind the rocks, everyone. Thank you.',
];

const LINES_NEAR = [
  'No running, please! That includes slithering.',
  'Excuse me! Snakes must sign in at the office.',
  'Slow down, please. Thank you so much.',
  'I say! Walking pace, if you please.',
  'Move along, please. Nothing to eat here.',
];

const LINES_BIG = [
  'Goodness. You have grown. Still no running.',
  'Remarkable. Do mind the windows, please.',
];

const LINES_BUMP = [
  'I beg your pardon!',
  'Oh! Terribly sorry. No running!',
  'Good heavens. Mind how you go.',
];

export class Cooper {
  /** False on a stage he never visits (the Common): then he does nothing and is not drawn. */
  readonly active: boolean;
  private readonly spawn: Spot;
  private readonly beat: Bounds;
  x: number;
  z: number;
  heading = Math.PI / 2;
  speed = 0;
  /** Seconds left of the current telling-off; the renderer wags his finger while > 0. */
  talking = 0;

  private tx = 0;
  private tz = 0;
  private pause = 1;
  private sayIn = 2;
  private bumpCooldown = 0;
  private checkIn = 1;
  private checkX = 0;
  private checkZ = 0;

  /** `config` is the stage's spawn and beat, or null on a stage he never goes to. */
  constructor(config: { spawn: Spot; beat: Bounds } | null) {
    this.active = config !== null;
    this.spawn = config?.spawn ?? { x: -9999, z: -9999 };
    this.beat = config?.beat ?? { minX: -9999, maxX: -9999, minZ: -9999, maxZ: -9999 };
    this.x = this.tx = this.checkX = this.spawn.x;
    this.z = this.tz = this.checkZ = this.spawn.z;
  }

  update(w: World, dt: number): void {
    if (!this.active) return;
    this.talking = Math.max(0, this.talking - dt);
    this.bumpCooldown = Math.max(0, this.bumpCooldown - dt);

    if (this.pause > 0) {
      this.pause -= dt;
      this.speed = 0;
      if (this.pause <= 0) this.pickTarget(w);
    } else {
      this.run(w, dt);
    }

    this.sayIn -= dt;
    if (this.sayIn <= 0) {
      this.sayIn = w.rng.range(3.5, 6.5);
      const near = Math.hypot(w.snake.x - this.x, w.snake.z - this.z) < NEAR;
      let lines = LINES_GENERAL;
      if (near) lines = w.snake.tier >= 3 && w.rng.next() < 0.5 ? LINES_BIG : LINES_NEAR;
      this.say(w, w.rng.pick(lines));
    }
  }

  /** The snake ran into him. Returns false while he is still recovering from the last bump. */
  bumped(w: World): boolean {
    if (!this.active || this.bumpCooldown > 0) return false;
    this.bumpCooldown = 2.5;
    this.sayIn = w.rng.range(3.5, 6.5);
    this.say(w, w.rng.pick(LINES_BUMP));
    return true;
  }

  private say(w: World, text: string): void {
    this.talking = 2.6;
    w.events.push({ type: 'say', text });
  }

  private run(w: World, dt: number): void {
    const dx = this.tx - this.x;
    const dz = this.tz - this.z;
    if (dx * dx + dz * dz < 0.8 * 0.8) {
      this.pause = w.rng.range(0.6, 1.8);
      return;
    }
    this.heading = turnToward(this.heading, Math.atan2(dz, dx), TURN_RATE * dt);
    this.speed = RUN_SPEED;
    const hit = resolveCircle(
      w.stage,
      this.x + Math.cos(this.heading) * this.speed * dt,
      this.z + Math.sin(this.heading) * this.speed * dt,
      COOPER_RADIUS,
      w.hit,
      w.hazards,
    );
    this.x = hit.x;
    this.z = hit.z;
    // Round corners instead of jogging on the spot against them.
    if (hit.hit) this.heading = slideAlong(this.heading, hit.nx, hit.nz);

    // Blocked by a building? Give up on this errand and find another.
    this.checkIn -= dt;
    if (this.checkIn <= 0) {
      if (Math.hypot(this.x - this.checkX, this.z - this.checkZ) < 1) this.pickTarget(w);
      this.checkIn = 1;
      this.checkX = this.x;
      this.checkZ = this.z;
    }
  }

  private pickTarget(w: World): void {
    const beat = this.beat;
    if (w.rng.next() < SEEK_SNAKE_CHANCE) {
      // Only as far as his beat goes: he will not follow the snake behind the Old School.
      const x = Math.min(Math.max(w.snake.x + w.rng.range(-3, 3), beat.minX), beat.maxX);
      const z = Math.min(Math.max(w.snake.z + w.rng.range(-3, 3), beat.minZ), beat.maxZ);
      if (isFree(w.stage, x, z, 1, w.hazards)) {
        this.tx = x;
        this.tz = z;
        return;
      }
    }
    for (let tries = 0; tries < 30; tries++) {
      const x = w.rng.range(beat.minX, beat.maxX);
      const z = w.rng.range(beat.minZ, beat.maxZ);
      if (!isFree(w.stage, x, z, 1, w.hazards)) continue;
      this.tx = x;
      this.tz = z;
      return;
    }
    this.tx = this.spawn.x;
    this.tz = this.spawn.z;
  }
}
