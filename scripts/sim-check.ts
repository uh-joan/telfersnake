/**
 * The sim's own check-up, run headless with tsx (`npm run sim:check -- …`). Two jobs:
 *
 *   fingerprint <stage> <mode> [ticks=3600] [seed=1]   one hash of a whole scripted run
 *   fingerprint --all [--baseline]                      school + common × easy/normal/god
 *   invariants <stage> [--seeds N] [--baseline]         N seeds × 3 modes × 200 s of health checks
 *
 * A fingerprint hashes every event and every actor's position (and every snake's score) on every
 * tick, so a single changed RNG draw anywhere shows up. `--baseline` writes scripts/baselines.json;
 * without it the run is compared against that file and exits non-zero on any mismatch. The
 * baselines are taken from `main`: a new stage must never change how the old ones play.
 *
 * Invariants count ticks inside a solid or out of bounds, snakes stuck for over 3 s and runaway
 * entity counts, and check every kind the stage can spawn turned up. On a stage with a river they
 * also count food or walkers (animals, the warden…) in the water, flood-fill the map twice (no
 * sealed pocket with swimming allowed; both banks still joined when only the bridges cross), check
 * the arrival spot is free, and time a scripted swim (×0.5 of land speed, ± 0.05). With London's zoo
 * they count swan gulps (must be none), gull/pelican raids (must happen, and land on the map), the
 * animals' cries and the cuppas, and script a Dragon nosing a swan, a Tea Time combo, and a huge
 * mouth that must get exactly one Tea Time (never a chain off its own cake stand). With London's dangers
 * they check the lions always get home (none away > 30 s, never a jump), the ravens and lions wake and
 * bite, the traffic stays on its lanes, never rolls onto a busy zebra it had room to stop for, never
 * holds a snake inside it, and sweeps clear of every solid and the river; bites and bonks stay capped and
 * outside the victim's grace; and script a snake on a zebra, a lion visit and a Freeze on a lion. `--baseline` records what
 * `main` already does (the school's bots do sometimes nose a wall for a few seconds), so a later
 * run fails only when a count gets worse; a stage with no record must be spotless.
 *
 * The player is driven by a scripted thumb (its own seeded RNG, never the world's), mostly chasing
 * the nearest food so it grows and meets the bigger things, sometimes wandering off, sometimes
 * dashing, and always picking a level-up card, so as much of the sim as possible gets exercised.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isFree } from '../src/sim/collide';
import { CREATURE_KINDS, type CreatureKind } from '../src/sim/creatures';
import { MODES, type Mode, rulesFor } from '../src/sim/modes';
import { Rng } from '../src/sim/rng';
import { STAGE_IDS, type Stage, type StageId, type Terrain } from '../src/sim/stage';
import { stageFor } from '../src/sim/stages';
import type { Input } from '../src/sim/snake';
import { awake, LION, PREDATORS } from '../src/sim/predators';
import {
  ahead, blankVehicle, distanceToLoop, local, makeLane, placeVehicle, VEHICLES, type VehicleKind, type Walker, ZEBRA_HALF, zebraGap,
} from '../src/sim/vehicles';
import { flowAt, inWater, onBridge } from '../src/sim/water';
import { STEP, World } from '../src/sim/world';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASELINES = join(HERE, 'baselines.json');
/** The stages the fingerprint guards. A new stage joins this list once its rules settle. */
const GUARDED: StageId[] = ['school', 'common'];

// ---------------------------------------------------------------- the scripted thumb

/** A player that plays like a busy child: chase food, wander, dash now and then, take a card. */
class Thumb {
  private readonly rng: Rng;
  private left = 0;
  private wander = false;
  private angle = 0;
  private dash = false;
  readonly input: Input = { x: 1, z: 0, active: true, dash: false };

  constructor(seed: number) {
    this.rng = new Rng(seed ^ 0x5eed);
  }

  think(w: World): Input {
    const s = w.snake;
    if (--this.left <= 0) {
      this.left = 30 + this.rng.int(150);
      this.wander = this.rng.next() < 0.35;
      this.angle = this.rng.range(0, Math.PI * 2);
      this.dash = this.rng.next() < 0.2;
    }
    let a = this.angle;
    if (!this.wander) {
      let best = Infinity;
      for (const f of w.foods) {
        const d = (f.x - s.x) ** 2 + (f.z - s.z) ** 2;
        if (d < best) {
          best = d;
          a = Math.atan2(f.z - s.z, f.x - s.x);
        }
      }
    }
    this.input.x = Math.cos(a);
    this.input.z = Math.sin(a);
    this.input.active = this.rng.next() > 0.02; // the odd moment hands-off
    this.input.dash = this.dash;
    return this.input;
  }

  card(w: World): void {
    if (w.cards) w.choose(this.rng.int(w.cards.length));
  }
}

function makeWorld(stage: Stage, mode: Mode, seed: number): { w: World; thumb: Thumb } {
  const w = new World(seed, undefined, rulesFor(mode), stage);
  w.snake.canBuyPowers = true; // as if the child had a gem: powers get exercised too
  return { w, thumb: new Thumb(seed) };
}

/** One tick of solo play, as main.ts runs it: the world waits while a card is on offer. */
function stepSolo(w: World, thumb: Thumb): void {
  if (w.cards) thumb.card(w);
  w.step(thumb.think(w));
}

// ---------------------------------------------------------------- fingerprint

/** FNV-1a, 32-bit, fed bytes (strings by UTF-16 unit, numbers by their float64 bits). */
class Fnv {
  h = 0x811c9dc5;
  private readonly f = new Float64Array(1);
  private readonly u = new Uint8Array(this.f.buffer);

  byte(b: number): void {
    this.h ^= b & 0xff;
    this.h = Math.imul(this.h, 0x01000193) >>> 0;
  }

  num(n: number): void {
    this.f[0] = n;
    for (let i = 0; i < 8; i++) this.byte(this.u[i]);
  }

  str(s: string): void {
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      this.byte(c);
      this.byte(c >>> 8);
    }
  }

  hex(): string {
    return this.h.toString(16).padStart(8, '0');
  }
}

function fingerprint(id: StageId, mode: Mode, ticks: number, seed: number): string {
  const { w, thumb } = makeWorld(stageFor(id), mode, seed);
  const h = new Fnv();
  const pos = (o: { x: number; z: number }) => {
    h.num(o.x);
    h.num(o.z);
  };
  for (let t = 0; t < ticks; t++) {
    stepSolo(w, thumb);
    for (const e of w.events) h.str(JSON.stringify(e));
    w.events.length = 0;
    for (const s of w.snakes) {
      pos(s);
      h.num(s.heading);
      h.num(s.score);
      h.num(s.mass);
      h.num(s.alive ? 1 : 0);
    }
    pos(w.cooper);
    for (const a of w.animals) pos(a);
    for (const p of w.predators) pos(p);
    for (const k of w.kids) pos(k);
    for (const c of w.creatures) pos(c);
    for (const f of w.foods) pos(f);
    for (const z of w.hazards) pos(z);
    h.num(w.pellets.length);
    h.num(w.projectiles.length);
  }
  return h.hex();
}

/** Fingerprints by `stage/mode/ticks/seed`, and known invariant faults by `invariants/stage/seeds`. */
type Baselines = Record<string, unknown>;
const key = (id: StageId, mode: Mode, ticks: number, seed: number) => `${id}/${mode}/${ticks}/${seed}`;

function readBaselines(): Baselines {
  try {
    return JSON.parse(readFileSync(BASELINES, 'utf8')) as Baselines;
  } catch {
    return {};
  }
}

function writeBaselines(b: Baselines): void {
  writeFileSync(BASELINES, JSON.stringify(b, null, 2) + '\n');
}

function runFingerprints(cases: [StageId, Mode][], ticks: number, seed: number, baseline: boolean): number {
  const stored = readBaselines();
  let bad = 0;
  for (const [id, mode] of cases) {
    const k = key(id, mode, ticks, seed);
    const got = fingerprint(id, mode, ticks, seed);
    if (baseline) {
      stored[k] = got;
      console.log(`${k.padEnd(28)} ${got}  (baseline written)`);
      continue;
    }
    const want = stored[k];
    const verdict = want === undefined ? 'NO BASELINE' : want === got ? 'ok' : `MISMATCH (main: ${want})`;
    if (want !== got) bad++;
    console.log(`${k.padEnd(28)} ${got}  ${verdict}`);
  }
  if (baseline) writeBaselines(stored);
  return bad;
}

// ---------------------------------------------------------------- invariants

interface Tally {
  runs: number;
  ticks: number;
  inSolid: number;
  outOfBounds: number;
  stuck: number;
  tooMany: number;
  wet: number;
  seen: Set<string>;
}

/** Everything the stage could ever grow, found by asking its food table about many random spots. */
function foodKindsOf(stage: Stage): Set<string> {
  const rng = new Rng(12345);
  const B = stage.bounds;
  const out = new Set<string>();
  for (let i = 0; i < 20000; i++) {
    const x = rng.range(B.minX, B.maxX);
    const z = rng.range(B.minZ, B.maxZ);
    if (isFree(stage, x, z, 0.8)) out.add('food:' + stage.foodKindAt(rng, x, z));
  }
  return out;
}

function expectedKinds(stage: Stage): Set<string> {
  const out = foodKindsOf(stage);
  for (const a of stage.animals) out.add('animal:' + a);
  for (const p of stage.predators) if (p.count > 0) out.add('predator:' + p.kind);
  for (const k of stage.kids) out.add('kid:' + k);
  const creatures: readonly CreatureKind[] = stage.creatureCount > 0 ? (stage.creatureKinds ?? CREATURE_KINDS) : [];
  for (const c of creatures) out.add('creature:' + c);
  for (const v of stage.traffic ?? []) if (v.count > 0) out.add('vehicle:' + v.kind);
  if (stage.hazardArea) for (const h of stage.hazardKinds) out.add('hazard:' + h);
  return out;
}

const SLOP = 0.05; // metres of float slack before a centre counts as "inside"
const STUCK_TICKS = 3 * 60;
const STUCK_MOVE = 1; // metres it must get from where it was, or the clock keeps running

/** The counts an invariants run fails on. */
interface Faults {
  inSolid: number;
  outOfBounds: number;
  stuck: number;
  tooMany: number;
  /** Ticks food, an animal or a walker spent in the water (only a snake may swim). */
  wet: number;
}

// ---------------------------------------------------------------- London: the river checks

/** The stage with its rivers dried up: what "inside a solid" means for a snake that may swim. */
const dry = (stage: Stage): Terrain => ({ bounds: stage.bounds, solidBoxes: stage.solidBoxes, solidCircles: stage.solidCircles });

/**
 * Flood-fill a 1 m grid from the arrival spot. A cell is open if a small snake fits there (and,
 * with `swim` false, it is dry or on a bridge). Returns how many open cells were never reached.
 */
function floodFill(stage: Stage, swim: boolean): { open: number; unreached: number; sample: string } {
  const B = stage.bounds;
  const W = Math.round(B.maxX - B.minX);
  const H = Math.round(B.maxZ - B.minZ);
  const terrain = dry(stage);
  const open = new Uint8Array(W * H);
  let total = 0;
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const x = B.minX + i + 0.5;
      const z = B.minZ + j + 0.5;
      if (!isFree(terrain, x, z, 0.4)) continue;
      if (!swim && inWater(stage, x, z)) continue;
      open[j * W + i] = 1;
      total++;
    }
  }
  const seen = new Uint8Array(W * H);
  const si = Math.floor(stage.snakeSpawn.x - B.minX);
  const sj = Math.floor(stage.snakeSpawn.z - B.minZ);
  const queue = [sj * W + si];
  seen[queue[0]] = 1;
  let reached = 0;
  while (queue.length) {
    const c = queue.pop() as number;
    if (!open[c]) continue;
    reached++;
    const i = c % W;
    const j = (c - i) / W;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
      const n = nj * W + ni;
      if (seen[n]) continue;
      seen[n] = 1;
      queue.push(n);
    }
  }
  let sample = '';
  for (let c = 0; c < W * H && !sample; c++) {
    if (open[c] && !seen[c]) sample = `(${(B.minX + (c % W) + 0.5).toFixed(1)}, ${(B.minZ + Math.floor(c / W) + 0.5).toFixed(1)})`;
  }
  return { open: total, unreached: total - reached, sample };
}

/**
 * Swim a scripted snake down the Thames (seed 1, normal) and compare its own pace, the current's
 * drift taken out, with its speed on dry land: it should paddle at half speed.
 */
function swimRatio(stage: Stage): number {
  const river = stage.water?.[0];
  if (!river) return 1;
  const w = new World(1, undefined, rulesFor('normal'), stage);
  const s = w.snake;
  // The longest straight-ish reach: from just past the Westminster bend, east toward the Millennium Bridge.
  const path = river.path;
  const from = path[4];
  const to = path[5];
  s.placeAt(from.x + (to.x - from.x) * 0.1, from.z + (to.z - from.z) * 0.1, Math.atan2(to.z - from.z, to.x - from.x));
  let sum = 0;
  let n = 0;
  let wetTicks = 0;
  for (let tick = 0; tick < 60 * 20; tick++) {
    s.immune = 10;
    const next = path.find((p) => p.x > s.x + 2) ?? path[path.length - 1];
    const dx = next.x - s.x;
    const dz = next.z - s.z;
    const d = Math.hypot(dx, dz) || 1;
    const x0 = s.x;
    const z0 = s.z;
    const pace = s.baseSpeed;
    w.step({ x: dx / d, z: dz / d, active: true, dash: false });
    w.events.length = 0;
    if (!s.alive || w.cards) break;
    const wet = inWater(stage, x0, z0) && inWater(stage, s.x, s.z);
    wetTicks = wet ? wetTicks + 1 : 0;
    if (wetTicks < 60 || s.touchingWall) continue; // let the paddle ease in first
    const flow = flowAt(river, x0, z0, { x: 0, z: 0 });
    const mx = s.x - x0 - flow.x * STEP;
    const mz = s.z - z0 - flow.z * STEP;
    sum += Math.hypot(mx, mz) / (pace * STEP);
    n++;
  }
  return n ? sum / n : NaN;
}

interface Zoo {
  swanGulps: number;
  steals: number;
  stealsOut: number;
  cries: number;
  teatimes: number;
  teas: number;
}

function tallyZoo(w: World, zoo: Zoo, outside: (x: number, z: number) => boolean, note: (m: string) => void, where: string): void {
  for (const e of w.events) {
    if (e.type === 'gulp' && e.kind === 'swan') {
      zoo.swanGulps++;
      note(`${where}: a swan was gulped`);
    } else if (e.type === 'steal') {
      zoo.steals++;
      if (outside(e.x, e.z)) {
        zoo.stealsOut++;
        note(`${where}: ${e.kind} stole off the map at (${e.x.toFixed(2)}, ${e.z.toFixed(2)})`);
      }
    } else if (e.type === 'cry') {
      zoo.cries++;
    } else if (e.type === 'teatime') {
      zoo.teatimes++;
    } else if (e.type === 'eat' && e.kind === 'tea') {
      zoo.teas++;
    }
  }
}

/**
 * Two scripted London moments: a Dragon-sized snake nosing a swan (a boop, never a gulp), and a
 * snake fed a sandwich, a scone and a sponge in a row (TEA TIME, with a cake stand of treats).
 */
function londonScripted(stage: Stage): { swan: string; tea: string; bigMouth: number } {
  const w = new World(3, undefined, rulesFor('normal'), stage);
  const s = w.snake;
  s.mass = 800; // the Dragon
  const swan = w.animals.find((a) => a.kind === 'swan');
  let gulps = 0;
  let boops = 0;
  if (swan) {
    for (let tick = 0; tick < 120; tick++) {
      if (w.cards) w.choose(0);
      s.placeAt(swan.x - 0.6, swan.z, 0);
      swan.boopCooldown = 0;
      w.step({ x: 1, z: 0, active: true, dash: false });
      for (const e of w.events) {
        if (e.type === 'gulp' && e.kind === 'swan') gulps++;
        if (e.type === 'boop' && e.kind === 'swan') boops++;
      }
      w.events.length = 0;
    }
  }
  const t = new World(4, undefined, rulesFor('normal'), stage);
  const me = t.snake;
  let tea = 'no tea time';
  for (const kind of ['sandwich', 'biscuit', 'scone', 'sponge'] as const) {
    if (t.cards) t.choose(0);
    const f = t.foods[0];
    f.kind = kind;
    f.x = me.x + Math.cos(me.heading) * 0.3;
    f.z = me.z + Math.sin(me.heading) * 0.3;
    t.step({ x: Math.cos(me.heading), z: Math.sin(me.heading), active: true, dash: false });
    for (const e of t.events) if (e.type === 'teatime') tea = 'TEA TIME';
    t.events.length = 0;
  }
  // A huge mouth (reach 3.85) must not swallow its own cake stand into Tea Time after Tea Time.
  const b = new World(5, undefined, rulesFor('normal'), stage);
  const big = b.snake;
  big.mass = 600;
  let teaTimes = 0;
  for (let tick = 0; tick < 300; tick++) {
    if (b.cards) b.choose(0);
    big.reachBonus = 0;
    big.reachBonus = 3.85 - big.biteReach;
    big.immune = 10;
    if (tick < 3) {
      const f = b.foods[0];
      f.kind = (['sandwich', 'scone', 'sponge'] as const)[tick];
      f.x = big.x + Math.cos(big.heading) * 0.3;
      f.z = big.z + Math.sin(big.heading) * 0.3;
    }
    b.step({ x: Math.cos(big.heading), z: Math.sin(big.heading), active: true, dash: false });
    for (const e of b.events) if (e.type === 'teatime') teaTimes++;
    b.events.length = 0;
  }
  return { swan: gulps ? `${gulps} gulps!` : boops ? 'boop, no gulp' : 'never met', tea, bigMouth: teaTimes };
}

// ---------------------------------------------------------------- London: the dangers (A3)

interface Danger {
  /** Lion yawns, raven CAW!s, DING DINGs, honks, vehicle bonks, splashes, turned-to-stone lions. */
  roars: number;
  caws: number;
  dings: number;
  honks: number;
  vbonks: number;
  splashes: number;
  lionBites: number;
  ravenPecks: number;
  /** Ticks a vehicle was held at a busy zebra, and ticks it rolled onto one it had room to stop for. */
  zebraHolds: number;
  zebraRuns: number;
  /** Ticks a vehicle was off its lane, or in the river (off a bridge). */
  offRoute: number;
  /** Ticks a snake's head sat inside a vehicle (it should have been pushed out). */
  inVehicle: number;
  /** A lion's longest time off its plinth (stone time not counted), and how many were away > 30 s. */
  lionLongest: number;
  lionsLost: number;
  /** A lion that jumped (> 0.5 m in a tick: the give-up teleport home). */
  lionJumps: number;
  /** Bites, pecks or bonks over their cap, or landing inside a victim's grace. */
  overCap: number;
  inGrace: number;
}

const newDanger = (): Danger => ({
  roars: 0, caws: 0, dings: 0, honks: 0, vbonks: 0, splashes: 0, lionBites: 0, ravenPecks: 0, zebraHolds: 0, zebraRuns: 0,
  offRoute: 0, inVehicle: 0, lionLongest: 0, lionsLost: 0, lionJumps: 0, overCap: 0, inGrace: 0,
});

/** The snakes as the traffic sees them (head + body), exactly as World.updateVehicles builds them. */
function walkersOf(w: World): Walker[] {
  const out: Walker[] = [];
  for (const s of w.snakes) {
    if (!s.alive) continue;
    out.push({ x: s.x, z: s.z, r: s.radius });
    for (let i = 0; i < s.bodyCount; i++) out.push({ x: s.body[i * 2], z: s.body[i * 2 + 1], r: s.radius });
  }
  return out;
}

/** Per-run memory for the danger checks. */
interface DangerRun {
  away: number[];
  lastX: number[];
  lastZ: number[];
  hurtAt: Map<number, number>;
  gaps: number[];
  was: number[];
}

const newDangerRun = (w: World): DangerRun => ({
  away: w.predators.map(() => 0), lastX: w.predators.map((p) => p.x), lastZ: w.predators.map((p) => p.z),
  hurtAt: new Map(), gaps: [], was: [],
});

/** Before a step: how far each vehicle may roll before a busy zebra. */
function dangerBefore(w: World, run: DangerRun): void {
  const walkers = walkersOf(w);
  w.vehicles.forEach((v, i) => {
    run.gaps[i] = zebraGap(v, w.lanes[v.route], walkers, 2);
    run.was[i] = v.s;
  });
}

/** After a step: tally the events and check the lions, the traffic and the bites. */
function dangerAfter(w: World, d: Danger, run: DangerRun, tick: number, note: (m: string) => void, where: string): void {
  const GRACE_TICKS = 1.5 * 60 - 1;
  for (const e of w.events) {
    if (e.type === 'roar') d.roars++;
    else if (e.type === 'caw') d.caws++;
    else if (e.type === 'ding') e.honk ? d.honks++ : d.dings++;
    else if (e.type === 'splash') d.splashes++;
    if (e.type === 'chomp' || e.type === 'vbonk' || e.type === 'ouch') {
      const last = run.hurtAt.get(e.who);
      if (last !== undefined && tick - last < GRACE_TICKS) {
        d.inGrace++;
        note(`${where}: snake ${e.who} hurt again (${e.type}) ${tick - last} ticks after the last`);
      }
      run.hurtAt.set(e.who, tick);
    }
    if (e.type === 'chomp' && (e.kind === 'lion' || e.kind === 'raven')) {
      e.kind === 'lion' ? d.lionBites++ : d.ravenPecks++;
      if ((e.lost ?? 0) > PREDATORS[e.kind].biteCap + 1e-9) {
        d.overCap++;
        note(`${where}: a ${e.kind} took ${e.lost}`);
      }
    }
    if (e.type === 'vbonk') {
      d.vbonks++;
      if (e.lost > VEHICLES[e.kind].bonkCap + 1e-9) {
        d.overCap++;
        note(`${where}: a ${e.kind} took ${e.lost}`);
      }
    }
  }
  // Lions: always home again, never a jump.
  w.predators.forEach((p, i) => {
    if (p.kind !== 'lion') return;
    if (Math.hypot(p.x - run.lastX[i], p.z - run.lastZ[i]) > 0.5) {
      d.lionJumps++;
      note(`${where}: lion ${i} jumped to (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`);
    }
    run.lastX[i] = p.x;
    run.lastZ[i] = p.z;
    if (p.state === LION.statue) run.away[i] = 0;
    else if (p.state !== LION.stone) run.away[i]++;
    d.lionLongest = Math.max(d.lionLongest, run.away[i]);
    if (run.away[i] === 30 * 60 + 1) {
      d.lionsLost++;
      note(`${where}: lion ${i} away from its plinth for 30 s, at (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`);
    }
  });
  // Traffic: on its lane, dry (bridges excepted), never onto a busy zebra it had room to stop for.
  const loc = { f: 0, l: 0 };
  w.vehicles.forEach((v, i) => {
    const lane = w.lanes[v.route];
    if (distanceToLoop(lane.route.path, v.x, v.z) > 0.02 || (inWater(w.stage, v.x, v.z) && !onBridge(w.stage, v.x, v.z))) {
      d.offRoute++;
      note(`${where}: ${v.kind} ${i} off its route at (${v.x.toFixed(2)}, ${v.z.toFixed(2)})`);
    }
    const rolled = ahead(lane, run.was[i], v.s);
    if (run.gaps[i] < Infinity) {
      d.zebraHolds++;
      if (rolled > run.gaps[i] + 1e-6 && rolled < lane.length / 2) {
        d.zebraRuns++;
        note(`${where}: ${v.kind} ${i} rolled ${rolled.toFixed(3)} m with a busy zebra ${run.gaps[i].toFixed(3)} m ahead`);
      }
    }
    const spec = VEHICLES[v.kind];
    for (const s of w.snakes) {
      if (!s.alive) continue;
      local(v, s.x, s.z, loc);
      if (Math.abs(loc.f) < spec.length / 2 + s.radius - 0.15 && Math.abs(loc.l) < spec.width / 2 + s.radius - 0.15) {
        d.inVehicle++;
        note(`${where}: snake ${s.id} inside ${v.kind} ${i}`);
      }
    }
  });
}

/**
 * Drive a vehicle of each route's kind all the way round its lane (every 25 cm) and test the whole
 * box, corners and sides: none of it may come within 1.1 m of a solid (room for a snake to slip by) or hang over the river
 * off a bridge. Returns the number of bad points.
 */
function routeSweep(stage: Stage): number {
  const solids = dry(stage);
  let bad = 0;
  for (const r of stage.routes ?? []) {
    const kind: VehicleKind = stage.traffic?.find((t) => t.route === r.id)?.kind ?? 'bus';
    const spec = VEHICLES[kind];
    const lane = makeLane(r, []);
    const v = blankVehicle(kind);
    for (let s = 0; s < lane.length; s += 0.25) {
      placeVehicle(v, lane, s);
      const c = Math.cos(v.heading);
      const sn = Math.sin(v.heading);
      for (let f = -spec.length / 2; f <= spec.length / 2 + 1e-9; f += 0.5) {
        for (const l of [-spec.width / 2, spec.width / 2]) {
          const x = v.x + c * f + sn * l;
          const z = v.z + sn * f - c * l;
          if (!isFree(solids, x, z, 1.1) || (inWater(stage, x, z) && !onBridge(stage, x, z))) bad++;
        }
      }
    }
  }
  return bad;
}

/**
 * Scripted: a snake sits on a zebra crossing ahead of a bus (the bus must wait short of it, and set
 * off again once the snake has gone); a snake visits a lion (it wakes, and is home inside 30 s); a
 * Freeze turns a prowling lion to stone where it stands.
 */
function londonDangerScripted(stage: Stage): { zebra: string; lion: string; stone: string } {
  // ---- the zebra
  const w = new World(6, undefined, rulesFor('normal'), stage);
  const me = w.snake;
  let zebra = 'no zebra';
  const bus = w.vehicles.find((v) => v.kind === 'bus');
  if (bus) {
    const lane = w.lanes[bus.route];
    const front = bus.s + VEHICLES.bus.length / 2;
    const k = lane.zebras.findIndex((z) => ahead(lane, front, z) > 12 && ahead(lane, front, z) < 60);
    if (k >= 0) {
      const at = lane.zebraAt[k];
      const line = lane.zebras[k] - ZEBRA_HALF;
      let waited = 0;
      let ran = false;
      for (let tick = 0; tick < 60 * 40 && waited < 4 * 60; tick++) {
        if (w.cards) w.choose(0);
        me.placeAt(at.x, at.z, me.heading);
        me.immune = 10;
        w.step({ x: 0, z: 0, active: false, dash: false });
        w.events.length = 0;
        if (ahead(lane, bus.s + VEHICLES.bus.length / 2, line) > lane.length / 2) ran = true;
        if (bus.speed === 0 && ahead(lane, bus.s + VEHICLES.bus.length / 2, line) < 3) waited++;
      }
      // Then the snake slithers off, far away: the bus must set off again.
      let moved = false;
      for (let tick = 0; tick < 60 * 6; tick++) {
        if (w.cards) w.choose(0);
        me.placeAt(stage.fallbackSpot.x, stage.fallbackSpot.z, 0);
        w.step({ x: 0, z: 0, active: false, dash: false });
        w.events.length = 0;
        if (bus.speed > 1) moved = true;
      }
      zebra = ran ? 'RAN IT' : waited >= 4 * 60 ? (moved ? 'waited, then went' : 'waited, never went') : 'never got there';
    }
  }

  // ---- a lion visit
  const l = new World(7, undefined, rulesFor('normal'), stage);
  const s = l.snake;
  const lion = l.predators.find((p) => p.kind === 'lion')!;
  let woke = -1;
  let home = -1;
  for (let tick = 0; tick < 60 * 60 && home < 0; tick++) {
    if (l.cards) l.choose(0);
    // Stand by the plinth for a moment (so it wakes), then go and sit far away.
    if (tick < 60 * 2) s.placeAt(lion.wx + (lion.wx - lion.hx) * 2, lion.wz + (lion.wz - lion.hz) * 2, 0);
    else s.placeAt(stage.fallbackSpot.x + 30, stage.fallbackSpot.z + 10, 0);
    s.immune = 10;
    l.step({ x: 0, z: 0, active: false, dash: false });
    l.events.length = 0;
    if (woke < 0 && lion.state !== LION.statue) woke = tick;
    if (woke >= 0 && lion.state === LION.statue) home = tick;
  }
  const lionResult = woke < 0 ? 'never woke' : home < 0 ? 'never got home' : `home in ${((home - woke) / 60).toFixed(1)} s`;

  // ---- Freeze: a prowling lion turns to stone
  const f = new World(8, undefined, rulesFor('normal'), stage);
  const kid = f.snake;
  const leo = f.predators.find((p) => p.kind === 'lion')!;
  let stone = 'never prowled';
  for (let tick = 0; tick < 60 * 8; tick++) {
    if (f.cards) f.choose(0);
    kid.placeAt(leo.wx + (leo.wx - leo.hx) * 2, leo.wz + (leo.wz - leo.hz) * 2, 0);
    kid.immune = 10;
    f.step({ x: 0, z: 0, active: false, dash: false });
    f.events.length = 0;
    if (leo.state === LION.prowl) {
      (f as unknown as { scarePredators(x: number, z: number, r: number, freeze: boolean): void }).scarePredators(leo.x, leo.z, 1, true);
      const x = leo.x;
      const z = leo.z;
      for (let t = 0; t < 60 * 3; t++) {
        kid.placeAt(leo.wx + (leo.wx - leo.hx) * 2, leo.wz + (leo.wz - leo.hz) * 2, 0);
        f.step({ x: 0, z: 0, active: false, dash: false });
        f.events.length = 0;
      }
      stone = (leo.state as number) === LION.stone && leo.x === x && leo.z === z ? 'stone, still' : `state ${leo.state}, moved ${Math.hypot(leo.x - x, leo.z - z).toFixed(2)}`;
      break;
    }
  }
  return { zebra, lion: lionResult, stone };
}

function invariants(id: StageId, seeds: number, baseline: boolean): number {
  const stage = stageFor(id);
  const ticks = 200 * 60;
  const t: Tally = { runs: 0, ticks: 0, inSolid: 0, outOfBounds: 0, stuck: 0, tooMany: 0, wet: 0, seen: new Set() };
  // Snakes may swim, so only real solids count as "inside" for them; everyone else must stay dry.
  const solids = dry(stage);
  const river = stage.water !== undefined;
  let longest = 0;
  // London's zoo and menu: swans never gulped, raids land on the map, the combos fire.
  const zoo: Zoo | null = stage.animals.includes('swan') ? { swanGulps: 0, steals: 0, stealsOut: 0, cries: 0, teatimes: 0, teas: 0 } : null;
  // London's dangers: lions, ravens and the traffic.
  const danger: Danger | null = stage.predators.some((p) => p.kind === 'lion' || p.kind === 'raven') || stage.traffic ? newDanger() : null;
  const notes: string[] = [];
  const note = (msg: string) => {
    if (notes.length < 12) notes.push(msg);
  };
  const B = stage.bounds;
  const outside = (x: number, z: number) => x < B.minX - SLOP || x > B.maxX + SLOP || z < B.minZ - SLOP || z > B.maxZ + SLOP;

  for (let seed = 1; seed <= seeds; seed++) {
    for (const mode of MODES) {
      const { w, thumb } = makeWorld(stage, mode, seed);
      const animals = w.animals.length;
      const foods = w.foods.length;
      // Where each snake was when its clock started, and whether this stall was already counted.
      const anchor = w.snakes.map((s) => ({ x: s.x, z: s.z, tick: 0, counted: false }));
      t.runs++;
      const dangerRun = danger ? newDangerRun(w) : null;
      for (let tick = 0; tick < ticks; tick++) {
        if (dangerRun) dangerBefore(w, dangerRun);
        stepSolo(w, thumb);
        if (zoo) tallyZoo(w, zoo, outside, note, `${id}/${mode}/seed ${seed}/t ${tick}`);
        if (danger && dangerRun) dangerAfter(w, danger, dangerRun, tick, note, `${id}/${mode}/seed ${seed}/t ${tick}`);
        w.events.length = 0;
        t.ticks++;
        const where = `${id}/${mode}/seed ${seed}/t ${tick}`;
        const check = (what: string, x: number, z: number, extra = stage.logs, swims = false) => {
          if (outside(x, z)) {
            t.outOfBounds++;
            note(`${where}: ${what} out of bounds at (${x.toFixed(2)}, ${z.toFixed(2)})`);
          } else if (!isFree(solids, x, z, -SLOP, extra)) {
            t.inSolid++;
            note(`${where}: ${what} inside a solid at (${x.toFixed(2)}, ${z.toFixed(2)})`);
          } else if (river && !swims && inWater(stage, x, z)) {
            t.wet++;
            note(`${where}: ${what} in the water at (${x.toFixed(2)}, ${z.toFixed(2)})`);
          }
        };
        for (const s of w.snakes) if (s.alive) check(`snake ${s.id}`, s.x, s.z, stage.logs, true);
        for (const a of w.animals) {
          check(a.kind, a.x, a.z, []);
          t.seen.add('animal:' + a.kind);
        }
        for (const p of w.predators) {
          t.seen.add('predator:' + p.kind);
          // A raven flies (over water and walls alike): only the fence holds it. A lion on its plinth is a statue.
          if (p.kind === 'raven') {
            if (outside(p.x, p.z)) {
              t.outOfBounds++;
              note(`${where}: raven out of bounds at (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`);
            }
            continue;
          }
          if (p.kind === 'lion' && !awake(p)) continue;
          check(p.kind, p.x, p.z);
        }
        for (const v of w.vehicles) t.seen.add('vehicle:' + v.kind);
        for (const k of w.kids) {
          check(`kid ${k.kind}`, k.x, k.z, []); // the children clamber over the log
          t.seen.add('kid:' + k.kind);
        }
        for (const c of w.creatures) {
          if (c.respawnIn > 0) continue;
          check(c.kind, c.x, c.z);
          t.seen.add('creature:' + c.kind);
        }
        for (const f of w.foods) {
          t.seen.add('food:' + f.kind);
          if (outside(f.x, f.z)) {
            t.outOfBounds++;
            note(`${where}: ${f.kind} out of bounds at (${f.x.toFixed(2)}, ${f.z.toFixed(2)})`);
          }
          // Only where it is put down counts: a swimmer's magnet may drag bank food out to it, by design.
          const placed = tick === 0 || f.born >= w.tick - 1;
          if (river && placed && inWater(stage, f.x, f.z)) {
            t.wet++;
            note(`${where}: ${f.kind} spawned in the water at (${f.x.toFixed(2)}, ${f.z.toFixed(2)})`);
          }
        }
        for (const h of w.hazards) t.seen.add('hazard:' + h.kind);
        if (w.cooper.active) check('warden', w.cooper.x, w.cooper.z, []);
        if (w.animals.length !== animals || w.foods.length !== foods || w.pellets.length > 150 || w.projectiles.length > 24) {
          t.tooMany++;
          note(`${where}: entity counts off (animals ${w.animals.length}, food ${w.foods.length}, pellets ${w.pellets.length})`);
        }
        // Stuck: alive and free to move, yet still within a metre of where it was over 3 s ago.
        for (const s of w.snakes) {
          const a = anchor[s.id];
          const held = !s.alive || s.frozenFor > 0 || s.awayFor > 0 || s.cards !== null;
          if (held || Math.hypot(s.x - a.x, s.z - a.z) > STUCK_MOVE) {
            a.x = s.x;
            a.z = s.z;
            a.tick = tick;
            a.counted = false;
            continue;
          }
          const still = tick - a.tick;
          longest = Math.max(longest, still);
          if (still > STUCK_TICKS && !a.counted) {
            a.counted = true;
            t.stuck++;
            note(`${where}: snake ${s.id} (${s.isBot ? s.look.name : 'player'}) stuck near (${s.x.toFixed(1)}, ${s.z.toFixed(1)})`);
          }
        }
      }
    }
  }

  // A stage may carry known faults from main (recorded with --baseline): only getting worse fails.
  const k = `invariants/${id}/${seeds}`;
  const stored = readBaselines();
  const faults: Faults = { inSolid: t.inSolid, outOfBounds: t.outOfBounds, stuck: t.stuck, tooMany: t.tooMany, wet: t.wet };
  const known: Faults = { inSolid: 0, outOfBounds: 0, stuck: 0, tooMany: 0, wet: 0, ...(stored[k] as Partial<Faults> | undefined) };
  if (baseline) {
    stored[k] = faults;
    writeBaselines(stored);
  }
  const want = expectedKinds(stage);
  const missing = [...want].filter((kind) => !t.seen.has(kind));
  let bad = missing.length;
  const row = (label: string, n: number | string, ok: boolean, allowed?: number) => {
    if (!ok) bad++;
    const tag = baseline ? 'baseline' : ok ? (allowed ? `ok (main: ${allowed})` : 'ok') : allowed ? `FAIL (main: ${allowed})` : 'FAIL';
    console.log(`  ${label.padEnd(22)} ${String(n).padStart(8)}  ${tag}`);
  };
  const fault = (label: string, f: keyof Faults) => row(label, faults[f], baseline || faults[f] <= known[f], known[f]);
  console.log(`invariants ${id}: ${seeds} seeds × ${MODES.length} modes × 200 s = ${t.runs} runs, ${t.ticks} ticks`);
  fault('ticks in a solid', 'inSolid');
  fault('ticks out of bounds', 'outOfBounds');
  fault('snakes stuck > 3 s', 'stuck');
  fault('entity counts off', 'tooMany');
  if (river) {
    fault('ticks in the water', 'wet');
    const swim = floodFill(stage, true);
    row('sealed pockets (swim)', `${swim.unreached}/${swim.open}`, swim.unreached === 0);
    if (swim.unreached) console.log(`    e.g. ${swim.sample}`);
    const walk = floodFill(stage, false);
    row('cut off (bridges only)', `${walk.unreached}/${walk.open}`, walk.unreached === 0);
    if (walk.unreached) console.log(`    e.g. ${walk.sample}`);
    const sp = stage.snakeSpawn;
    row('arrival spot free', isFree(stage, sp.x, sp.z, 2.5) ? 'yes' : 'NO', isFree(stage, sp.x, sp.z, 2.5));
    const ratio = swimRatio(stage);
    row('swim speed (× land)', ratio.toFixed(3), Math.abs(ratio - 0.5) <= 0.05);
  }
  if (zoo) {
    row('swans gulped', zoo.swanGulps, zoo.swanGulps === 0);
    row('food stolen', zoo.steals, zoo.steals > 0);
    row('steals off the map', zoo.stealsOut, zoo.stealsOut === 0);
    row('honks, yips, flocks', zoo.cries, zoo.cries > 0);
    row('cuppas (zoom)', zoo.teas, zoo.teas > 0);
    console.log(`  ${'tea times (thumb)'.padEnd(22)} ${String(zoo.teatimes).padStart(8)}`);
    const scripted = londonScripted(stage);
    row('swan vs a Dragon', scripted.swan, scripted.swan === 'boop, no gulp');
    row('scripted tea time', scripted.tea, scripted.tea === 'TEA TIME');
    row('tea times, reach 3.85', scripted.bigMouth, scripted.bigMouth === 1);
  }
  if (danger) {
    const info = (label: string, n: number | string) => console.log(`  ${label.padEnd(22)} ${String(n).padStart(8)}`);
    row('lion yawns (wakes)', danger.roars, danger.roars > 0);
    info('lion licks', danger.lionBites);
    row('lions away > 30 s', danger.lionsLost, danger.lionsLost === 0);
    info('longest lion outing', `${(danger.lionLongest / 60).toFixed(1)}s`);
    row('lion jumps', danger.lionJumps, danger.lionJumps === 0);
    row('raven CAW!s', danger.caws, danger.caws > 0);
    info('raven pecks', danger.ravenPecks);
    row('DING DINGs', danger.dings, danger.dings > 0);
    info('honks', danger.honks);
    info('vehicle bonks', danger.vbonks);
    info('puddle splashes', danger.splashes);
    info('zebra holds (ticks)', danger.zebraHolds);
    row('zebras run', danger.zebraRuns, danger.zebraRuns === 0);
    row('vehicles off route', danger.offRoute, danger.offRoute === 0);
    row('snakes in a vehicle', danger.inVehicle, danger.inVehicle === 0);
    row('bites over the cap', danger.overCap, danger.overCap === 0);
    row('hurts inside grace', danger.inGrace, danger.inGrace === 0);
    const sweep = routeSweep(stage);
    row('route sweep (bad pts)', sweep, sweep === 0);
    const scripted = londonDangerScripted(stage);
    row('snake on a zebra', scripted.zebra, scripted.zebra === 'waited, then went');
    row('lion visit', scripted.lion, scripted.lion.startsWith('home in') && parseFloat(scripted.lion.slice(8)) <= 30);
    row('Freeze on a lion', scripted.stone, scripted.stone === 'stone, still');
  }
  console.log(`  ${'longest stall'.padEnd(22)} ${(longest / 60).toFixed(1).padStart(7)}s`);
  row('kinds seen', `${want.size - missing.length}/${want.size}`, missing.length === 0);
  if (missing.length) console.log(`  never seen: ${missing.join(', ')}`);
  for (const n of notes) console.log(`  · ${n}`);
  return bad;
}

// ---------------------------------------------------------------- command line

function main(argv: string[]): number {
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  const flagValue = (name: string): string | undefined => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const args = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1] === '--seeds'));
  const [cmd, ...rest] = args;

  if (cmd === 'fingerprint') {
    const baseline = flags.has('--baseline');
    if (flags.has('--all')) {
      const cases: [StageId, Mode][] = GUARDED.flatMap((id) => MODES.map((m) => [id, m] as [StageId, Mode]));
      return runFingerprints(cases, 3600, 1, baseline);
    }
    const [stage, mode, ticks = '3600', seed = '1'] = rest;
    if (!STAGE_IDS.includes(stage as StageId) || !MODES.includes(mode as Mode)) {
      console.error('usage: fingerprint <stage> <mode> [ticks] [seed] | fingerprint --all [--baseline]');
      return 2;
    }
    return runFingerprints([[stage as StageId, mode as Mode]], Number(ticks), Number(seed), baseline);
  }

  if (cmd === 'invariants') {
    const ids = rest.length ? rest : [...STAGE_IDS];
    const seeds = Number(flagValue('--seeds') ?? 40);
    let bad = 0;
    for (const id of ids) {
      if (!STAGE_IDS.includes(id as StageId)) {
        console.error(`unknown stage ${id}`);
        return 2;
      }
      bad += invariants(id as StageId, seeds, flags.has('--baseline'));
    }
    return bad;
  }

  console.error('usage: sim-check fingerprint <stage> <mode> [ticks] [seed] | fingerprint --all [--baseline] | invariants <stage> [--seeds N] [--baseline]');
  return 2;
}

process.exitCode = main(process.argv.slice(2)) > 0 ? 1 : 0;
