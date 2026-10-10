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
 * entity counts, and check every kind the stage can spawn turned up. `--baseline` records what
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
import { STAGE_IDS, type Stage, type StageId } from '../src/sim/stage';
import { stageFor } from '../src/sim/stages';
import type { Input } from '../src/sim/snake';
import { World } from '../src/sim/world';

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
}

function invariants(id: StageId, seeds: number, baseline: boolean): number {
  const stage = stageFor(id);
  const ticks = 200 * 60;
  const t: Tally = { runs: 0, ticks: 0, inSolid: 0, outOfBounds: 0, stuck: 0, tooMany: 0, seen: new Set() };
  let longest = 0;
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
        w.events.length = 0;
        t.ticks++;
        const where = `${id}/${mode}/seed ${seed}/t ${tick}`;
        const check = (what: string, x: number, z: number, extra = stage.logs) => {
          if (outside(x, z)) {
            t.outOfBounds++;
            note(`${where}: ${what} out of bounds at (${x.toFixed(2)}, ${z.toFixed(2)})`);
          } else if (!isFree(stage, x, z, -SLOP, extra)) {
            t.inSolid++;
            note(`${where}: ${what} inside a solid at (${x.toFixed(2)}, ${z.toFixed(2)})`);
          }
        };
        for (const s of w.snakes) if (s.alive) check(`snake ${s.id}`, s.x, s.z);
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
        for (const f of w.foods) t.seen.add('food:' + f.kind);
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
  const faults: Faults = { inSolid: t.inSolid, outOfBounds: t.outOfBounds, stuck: t.stuck, tooMany: t.tooMany };
  const known = (stored[k] as Faults | undefined) ?? { inSolid: 0, outOfBounds: 0, stuck: 0, tooMany: 0 };
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
