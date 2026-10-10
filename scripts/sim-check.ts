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
 * mouth that must get exactly one Tea Time (never a chain off its own cake stand). `--baseline` records what
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
import { flowAt, inWater } from '../src/sim/water';
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
      for (let tick = 0; tick < ticks; tick++) {
        stepSolo(w, thumb);
        if (zoo) tallyZoo(w, zoo, outside, note, `${id}/${mode}/seed ${seed}/t ${tick}`);
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
          check(p.kind, p.x, p.z);
          t.seen.add('predator:' + p.kind);
        }
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
