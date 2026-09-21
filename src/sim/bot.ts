import { ANIMALS } from './animals';
import { isFree } from './collide';
import { FOOD_VALUE, GOLDEN_MULTIPLIER } from './food';
import { BOUNDS } from './layout';
import type { Input, Snake, SnakeLook } from './snake';
import type { World } from './world';

/**
 * Rival snakes. They play by exactly the player's rules (same Snake, same Input), so swapping
 * a bot for a real player later is a matter of where the Input comes from.
 * They are built to be beatable by a seven-year-old: slowish to react, easily distracted.
 */

export interface Personality extends SnakeLook {
  startMass: number;
  speedMul: number;
  growthMul: number;
  /** 0..1: how reliably it notices a body or rock in its way. */
  caution: number;
  /** 0..1: how often it tries to cut another snake off instead of eating. */
  aggression: number;
  /** 0..1: how readily it dashes after something tasty. */
  dashy: number;
  /** Runs from anything bigger. */
  timid: boolean;
  /** It stops growing here, so no rival ever becomes a wall across the playground. */
  massCap: number;
}

export const RIVALS: Personality[] = [
  { name: 'Noodle', body: 0xf6d365, stripe: 0xfff3b0, head: 0xf9dc7c, startMass: 0, speedMul: 0.92, growthMul: 0.7, caution: 0.95, aggression: 0, dashy: 0.1, timid: true, massCap: 120 },
  { name: 'Sir Hiss-a-lot', body: 0x9b5de5, stripe: 0xf15bb5, head: 0xa873ea, startMass: 8, speedMul: 0.9, growthMul: 0.75, caution: 0.8, aggression: 0.15, dashy: 0.3, timid: false, massCap: 260 },
  { name: 'Danger Noodle', body: 0xe63946, stripe: 0x2b2d42, head: 0xea5560, startMass: 5, speedMul: 0.95, growthMul: 0.65, caution: 0.55, aggression: 0.5, dashy: 0.8, timid: false, massCap: 180 },
  { name: 'Slinky', body: 0x2ec4b6, stripe: 0xcbf3f0, head: 0x4fd1c5, startMass: 3, speedMul: 0.9, growthMul: 0.7, caution: 0.75, aggression: 0.3, dashy: 0.4, timid: false, massCap: 200 },
  { name: 'Wiggles', body: 0xff8fab, stripe: 0xffc2d1, head: 0xffa3ba, startMass: 0, speedMul: 0.88, growthMul: 0.7, caution: 0.9, aggression: 0.05, dashy: 0.2, timid: true, massCap: 140 },
  { name: 'Spaghetti', body: 0xf4a261, stripe: 0xe76f51, head: 0xf6b07a, startMass: 110, speedMul: 0.62, growthMul: 0.4, caution: 0.5, aggression: 0, dashy: 0, timid: false, massCap: 220 },
];

/** The four you meet playing on your own; a shared room seats all six. */
export const SOLO_RIVALS = RIVALS.filter((r) => ['Noodle', 'Sir Hiss-a-lot', 'Danger Noodle', 'Spaghetti'].includes(r.name));

const RETHINK = 0.4; // seconds between choosing what to go for
const SWERVE = 0.5; // seconds a swerve lasts once started
const SIGHT = 18; // metres it looks for food
const THREAT_RANGE = 9;
const HUNT_RANGE = 12;
const PROBE_ANGLE = 0.9;

export class Bot {
  private readonly input: Input = { x: 1, z: 0, active: true, dash: false };
  private tx = 0;
  private tz = 0;
  private chasing = false; // target is worth a dash
  private rethinkIn = 0;
  private swerveIn = 0;
  private swerveX = 0;
  private swerveZ = 0;
  private swerveSide = 1;
  private wanderIn = 0; // > 0: ignoring food, heading for a random spot (used to get unstuck)
  private checkIn = 1;
  private checkX = 0;
  private checkZ = 0;
  private dashFor = 0;

  constructor(readonly who: Personality) {}

  think(me: Snake, w: World, dt: number): Input {
    this.rethinkIn -= dt;
    this.wanderIn -= dt;
    this.swerveIn -= dt;
    this.dashFor -= dt;
    this.checkIn -= dt;

    if (this.checkIn <= 0) {
      // Barely moved in a second: whatever it wants is behind a wall. Go somewhere else for a bit.
      if (Math.hypot(me.x - this.checkX, me.z - this.checkZ) < 0.6) this.wander(w, 3);
      this.checkIn = 1;
      this.checkX = me.x;
      this.checkZ = me.z;
    }

    if (this.rethinkIn <= 0 && this.wanderIn <= 0) {
      this.rethinkIn = RETHINK;
      this.chooseTarget(me, w);
    }

    let dx = this.tx - me.x;
    let dz = this.tz - me.z;
    if (dx * dx + dz * dz < 1) this.rethinkIn = 0;

    if (this.swerveIn > 0) {
      dx = this.swerveX;
      dz = this.swerveZ;
    } else if (this.blocked(me, w, me.heading) && w.rng.next() < this.who.caution) {
      // Something in the way: turn toward whichever side is clear. If neither is, keep turning
      // the way it last did rather than dithering.
      if (!this.blocked(me, w, me.heading - PROBE_ANGLE)) this.swerveSide = -1;
      else if (!this.blocked(me, w, me.heading + PROBE_ANGLE)) this.swerveSide = 1;
      const away = me.heading + this.swerveSide * 1.5;
      this.swerveX = dx = Math.cos(away);
      this.swerveZ = dz = Math.sin(away);
      this.swerveIn = SWERVE;
    }

    const len = Math.hypot(dx, dz) || 1;
    this.input.x = dx / len;
    this.input.z = dz / len;
    if (this.chasing && this.dashFor <= -2 && me.mass > 12 && w.rng.next() < this.who.dashy * 0.05) this.dashFor = 0.8;
    this.input.dash = this.dashFor > 0;
    return this.input;
  }

  private wander(w: World, seconds: number): void {
    for (let tries = 0; tries < 20; tries++) {
      const x = w.rng.range(BOUNDS.minX, BOUNDS.maxX);
      const z = w.rng.range(BOUNDS.minZ, BOUNDS.maxZ);
      if (!isFree(x, z, 1.5, w.hazards)) continue;
      this.tx = x;
      this.tz = z;
      break;
    }
    this.chasing = false;
    this.wanderIn = seconds;
  }

  private chooseTarget(me: Snake, w: World): void {
    this.chasing = false;

    // Run from anything bigger and close.
    if (this.who.timid) {
      for (const o of w.snakes) {
        if (o === me || !o.alive || o.mass <= me.mass) continue;
        const d = Math.hypot(o.x - me.x, o.z - me.z);
        if (d > THREAT_RANGE) continue;
        this.tx = me.x + ((me.x - o.x) / (d || 1)) * 8;
        this.tz = me.z + ((me.z - o.z) / (d || 1)) * 8;
        return;
      }
    }

    // Now and then, try to cut someone off so they run into its body.
    if (w.rng.next() < this.who.aggression * 0.3) {
      for (const o of w.snakes) {
        if (o === me || !o.alive || o.immune > 0) continue;
        if (Math.hypot(o.x - me.x, o.z - me.z) > HUNT_RANGE) continue;
        const lead = 4 + o.baseSpeed * 0.5;
        this.tx = o.x + Math.cos(o.heading) * lead;
        this.tz = o.z + Math.sin(o.heading) * lead;
        this.chasing = true;
        return;
      }
    }

    // Otherwise: the tastiest thing per metre.
    let best = 0;
    const consider = (x: number, z: number, value: number, chase: boolean) => {
      const d = Math.hypot(x - me.x, z - me.z);
      if (d > SIGHT) return;
      const appeal = value / (d + 2);
      if (appeal <= best) return;
      best = appeal;
      this.tx = x;
      this.tz = z;
      this.chasing = chase;
    };
    for (const f of w.foods) consider(f.x, f.z, FOOD_VALUE[f.kind] * (f.golden ? GOLDEN_MULTIPLIER : 1), f.golden);
    for (const p of w.pellets) consider(p.x, p.z, p.value, false);
    for (const a of w.animals) if (me.tier >= ANIMALS[a.kind].tier) consider(a.x, a.z, ANIMALS[a.kind].value * 0.7, true);
    if (best === 0) this.wander(w, 2);
  }

  /** Is there a snake body or a rock a short way along `angle`? */
  private blocked(me: Snake, w: World, angle: number): boolean {
    const look = 2 + me.baseSpeed * 0.5;
    for (let k = 1; k <= 3; k++) {
      const reach = (look * k) / 3;
      const px = me.x + Math.cos(angle) * reach;
      const pz = me.z + Math.sin(angle) * reach;
      for (const h of w.hazards) {
        const r = h.r + me.radius + 0.4;
        if ((h.x - px) ** 2 + (h.z - pz) ** 2 < r * r) return true;
      }
      for (const o of w.snakes) {
        if (o === me || !o.alive || o.immune > 0) continue;
        if (Math.hypot(o.x - me.x, o.z - me.z) > o.length + look + 2) continue;
        const r = o.radius + o.spikes + me.radius + 0.7;
        for (let i = 0; i < o.bodyCount; i++) {
          if ((o.body[i * 2] - px) ** 2 + (o.body[i * 2 + 1] - pz) ** 2 < r * r) return true;
        }
      }
    }
    return false;
  }
}
