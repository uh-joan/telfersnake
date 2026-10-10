/**
 * The sim's own check-up, run headless with tsx (`npm run sim:check -- …`). Two jobs:
 *
 *   fingerprint <stage> <mode> [ticks=3600] [seed=1]   one hash of a whole scripted run
 *   fingerprint --all [stage…] [--baseline]             every guarded stage × easy/normal/god × seeds 1, 7, 42, 1234
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
 * outside the victim's grace; and script a snake on a zebra, a lion visit and a Freeze on a lion. With London's people
 * they check the guard never moves and never pays inside his rest, the school trip never splits or leaves its path
 * (or comes near a bus lane), the tourists, statue, whistle and chips all happen; and script 25 laps round the
 * guard (paid twice: 3 laps, then after the rest), a lap undone by doubling back, a bump (Ahem, no shrink), a
 * busker's dance (faster only in range) and the statue's BOO (once per rest). With London's legends
 * they check all nine creatures are gulped and their magics seen, every flight lands on free dry ground,
 * no giant is bonked by a bus, and every run's five Crown Jewels lie on free, reachable ground; and script
 * wings running out over the river and two landmarks, the phoenix taking one hit, the roar, River Rider,
 * a giant's gulp, the pearly trail and a ROYAL crown. With London's set pieces (A6) they check the BONGs
 * ring, nobody stands on a raised bascule, no vehicle is on Tower Bridge's span while it is up (and some
 * wait for it), every Eye ride is back within 15 s, every get-off and Tube exit is free, dry ground, and
 * every station is clear of the traffic; and script the set-piece clock (World against a phone's copy,
 * ten minutes), every Tube line, a launch off a rising bascule, a swim out of the gap, an Eye ride, a
 * boat trip, a snake walking into the parade (never stuck) and the wobbly bridge. `--baseline` records what
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
import { BUSK_REACH, EYE_RIDE, GUARD_COOL, STEP, World } from '../src/sim/world';
import { inBox } from '../src/sim/layout';
import {
  applyTerrain, bongAt, burstAt, FIREWORKS_EVERY, FIREWORKS_FOR, LIFT_BELLS, LIFT_FIRST, LIFT_RISE, liftRises, type Marcher, PARADE_FIRST, paradeAt, spanClosed, spanOpen,
} from '../src/sim/setPieces';
import { TRIP_GAP } from '../src/sim/kids';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASELINES = join(HERE, 'baselines.json');
/**
 * The stages the fingerprint guards. A new stage joins this list once its rules settle. London joined
 * at A5: a later phase that means to change how London plays re-baselines London alone
 * (`fingerprint london <mode> --baseline`, each mode) and says so; the school's and the Common's never move.
 */
const GUARDED: StageId[] = ['school', 'common', 'london'];
/** The seeds `fingerprint --all` plays each stage × mode with. */
const FINGERPRINT_SEEDS = [1, 7, 42, 1234];

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
      // London's legends: a child spotting a magic creature or a Crown Jewel goes for it. (No RNG,
      // and only where creatures have homes, so the school's and the Common's thumbs are unchanged.)
      if (w.stage.creatureHome) {
        let near = 30 * 30;
        const chase = (o: { x: number; z: number }) => {
          const d = (o.x - s.x) ** 2 + (o.z - s.z) ** 2;
          if (d >= near) return;
          near = d;
          a = Math.atan2(o.z - s.z, o.x - s.x);
        };
        for (const c of w.creatures) if (c.respawnIn <= 0) chase(c);
        for (const t of w.treasures) if (t.respawnIn <= 0) chase(t);
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
    // London's buses, jewels and pearl buttons (empty lists elsewhere: the old hashes stay put).
    for (const v of w.vehicles) pos(v);
    for (const t of w.treasures) pos(t);
    for (const b of w.buttons) pos(b);
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

// ---------------------------------------------------------------- London: the legends (A5)

/** What each London legend's magic must be seen doing in the sweep. */
const LEGEND_EFFECTS: Record<string, string> = {
  dragon: 'flew and landed', unicorn: 'golden bites', lionroyal: 'golden ring', phoenix: 'rose again', mermaid: 'river rider',
  ghost: 'hidden', gog: 'giant', fairy: 'fairy magnet', pearly: 'button trail',
};

interface Legends {
  gulped: Set<string>;
  effects: Set<string>;
  landings: number;
  badLandings: number;
  royals: number;
  jewels: number;
  giantBonks: number;
  rises: number;
  /** Seeds whose five jewels were not all on free ground the walk/swim flood-fill reaches. */
  jewelSeedsBad: number;
}

const newLegends = (): Legends => ({
  gulped: new Set(), effects: new Set(), landings: 0, badLandings: 0, royals: 0, jewels: 0, giantBonks: 0, rises: 0, jewelSeedsBad: 0,
});

/** Read a tick's events (before they are cleared) and the snakes' spells for the legends' tally. */
function legendsAfter(w: World, g: Legends, note: (m: string) => void, where: string): void {
  const stage = w.stage;
  for (const e of w.events) {
    if (e.type === 'magic') {
      g.gulped.add(e.kind);
      const spell = { ghost: 'hidden', fairy: 'magnet', gog: 'giant', phoenix: 'phoenix', mermaid: 'river', dragon: 'wings' }[e.kind as string];
      const s = w.snakes[e.who];
      if (spell === 'hidden' && s.hasMagic('hidden')) g.effects.add('ghost');
      if (spell === 'magnet' && s.hasMagic('magnet')) g.effects.add('fairy');
      if (spell === 'giant' && s.hasMagic('giant')) g.effects.add('gog');
    } else if (e.type === 'land') {
      g.landings++;
      g.effects.add('dragon');
      if (!isFree(stage, e.x, e.z, 0) || inWater(stage, e.x, e.z)) {
        g.badLandings++;
        note(`${where}: snake ${e.who} landed in a solid or the river at (${e.x.toFixed(2)}, ${e.z.toFixed(2)})`);
      }
    } else if (e.type === 'ring') g.effects.add('lionroyal');
    else if (e.type === 'rise') {
      g.rises++;
      g.effects.add('phoenix');
    } else if (e.type === 'pearly') {
      if (w.buttons.length > 0) g.effects.add('pearly');
    } else if (e.type === 'eat' && e.golden && w.snakes[e.who].hasMagic('rainbow') && w.creatures.some((c) => c.kind === 'unicorn')) {
      g.effects.add('unicorn');
    } else if (e.type === 'vbonk' && w.snakes[e.who].hasMagic('giant')) {
      g.giantBonks++;
      note(`${where}: a giant was bonked by a ${e.kind}`);
    } else if (e.type === 'jewel') g.jewels++;
    else if (e.type === 'royal') g.royals++;
  }
  for (const s of w.snakes) if (s.alive && s.hasMagic('river') && s.swimming) g.effects.add('mermaid');
}

/** Every jewel spot this world uses: free ground the flood-fill (walking or swimming) reaches from the arrival spot. */
function jewelsReachable(w: World, reach: Uint8Array): boolean {
  const B = w.stage.bounds;
  const W = Math.round(B.maxX - B.minX);
  if (w.treasures.length !== 5) return false;
  return w.treasures.every((t) => isFree(w.stage, t.x, t.z, 1) && reach[Math.floor(t.z - B.minZ) * W + Math.floor(t.x - B.minX)] === 1);
}

/**
 * Scripted legends: Dragon Wings running out over the river and over St Paul's dome and the Tower
 * (it must come down on free, dry ground); the phoenix taking exactly one hit; the Royal Lion's roar
 * pushing a rival back; River Rider beating the paddle; a giant gulping the next size up; the pearly
 * buttons leading to a jewel; and one snake collecting all five jewels (ROYAL exactly once).
 */
function londonLegendsScripted(stage: Stage): Record<string, string> {
  const out: Record<string, string> = {};
  const go = { x: 1, z: 0, active: true, dash: false };
  const drain = (w: World) => {
    const ev = [...w.events];
    w.events.length = 0;
    return ev;
  };

  // Flight: expiring over the river, over St Paul's dome, inside the Tower's walls.
  const spots: [string, number, number, number][] = [['river', 0, -14, 0], ['dome', 30, -42, -Math.PI / 2], ['tower', 62, -16, 0]];
  const landed: string[] = [];
  for (const [name, x, z, heading] of spots) {
    const w = new World(11, undefined, rulesFor('normal'), stage);
    const s = w.snake;
    s.mass = 20;
    s.placeAt(x, z, heading);
    s.giveMagic('wings', 0.3);
    let at: { x: number; z: number } | null = null;
    for (let tick = 0; tick < 60 && !at; tick++) {
      if (w.cards) w.choose(0);
      w.step({ x: Math.cos(heading), z: Math.sin(heading), active: true, dash: false });
      for (const e of drain(w)) if (e.type === 'land' && e.who === s.id) at = { x: e.x, z: e.z };
    }
    const ok = at !== null && isFree(stage, at.x, at.z, s.radius) && !inWater(stage, at.x, at.z);
    landed.push(ok ? `${name} ok` : `${name} BAD`);
  }
  out.landing = landed.join(', ');

  // Phoenix: two pebbles, a moment apart. The first is undone (and grows you), the second lands.
  {
    const w = new World(12, undefined, rulesFor('normal'), stage);
    const s = w.snake;
    s.mass = 50;
    s.immune = 0;
    s.giveMagic('phoenix', 30);
    const pebble = () => ({ kind: 'pebble' as const, x: s.x, z: s.z, dx: 1, dz: 0, speed: 1, left: 1, total: 1 });
    const m0 = s.mass;
    w['strikeProjectile'](pebble(), s);
    const m1 = s.mass;
    s.immune = 0;
    w['strikeProjectile'](pebble(), s);
    const m2 = s.mass;
    const rises = drain(w).filter((e) => e.type === 'rise').length;
    out.phoenix = m1 > m0 && m2 < m1 && rises === 1 && !s.hasMagic('phoenix') ? 'one hit undone' : `rises ${rises}, ${m0}→${m1.toFixed(1)}→${m2.toFixed(1)}`;
  }

  // Roar: a rival 5 m away is pushed out and dazed; a swooping raven turns for home.
  {
    const w = new World(13, undefined, rulesFor('normal'), stage);
    const s = w.snake;
    s.placeAt(0, -32, 0);
    const rival = w.snakes[1];
    rival.placeAt(5, -32, 0);
    rival.immune = 0;
    const raven = w.predators.find((p) => p.kind === 'raven')!;
    raven.state = 2; // RAVEN.swoop
    raven.x = -3;
    raven.z = -32;
    w['castMagic'](s, 'lionroyal');
    const d = Math.hypot(rival.x - s.x, rival.z - s.z);
    const ev = drain(w);
    out.roar = d > 6.5 && rival.frozenFor > 0 && raven.state === 3 && ev.some((e) => e.type === 'ring') ? 'pushed, dazed, raven home' : `d ${d.toFixed(1)}, raven ${raven.state}`;
  }

  // River Rider: two seconds' swim down the Thames, with and without the mermaid.
  {
    const swim = (river: boolean) => {
      const w = new World(14, undefined, rulesFor('normal'), stage);
      const s = w.snake;
      s.mass = 10;
      s.placeAt(-6, -13.5, 0);
      if (river) s.giveMagic('river', 20);
      const x0 = s.x;
      for (let tick = 0; tick < 120; tick++) {
        if (w.cards) w.choose(0);
        w.step(go);
        drain(w);
      }
      return s.x - x0;
    };
    const fast = swim(true);
    const slow = swim(false);
    out.river = fast > slow * 2 ? 'faster than the paddle' : `${fast.toFixed(1)} vs ${slow.toFixed(1)} m`;
  }

  // Giant: a Wiggly Worm under Gog & Magog's spell gulps a duck (the next size's animal).
  {
    const w = new World(15, undefined, rulesFor('normal'), stage);
    const s = w.snake;
    s.mass = 0;
    s.giveMagic('giant', 15);
    const duck = w.animals.find((a) => a.kind === 'duck')!;
    let gulped = false;
    for (let tick = 0; tick < 30 && !gulped; tick++) {
      if (w.cards) w.choose(0);
      s.placeAt(duck.x - 0.5, duck.z, 0);
      w.step(go);
      gulped = drain(w).some((e) => e.type === 'gulp' && e.kind === 'duck');
    }
    out.giant = gulped ? 'gulped a duck' : 'no gulp';
  }

  // Pearly: the buttons lie on free, dry ground and lead to the nearest jewel; one is good to eat.
  {
    const w = new World(16, undefined, rulesFor('normal'), stage);
    const s = w.snake;
    s.placeAt(-20, -40, 0);
    w['castMagic'](s, 'pearly');
    const b = w.buttons;
    const near = [...w.treasures].sort((p, q) => Math.hypot(p.x - s.x, p.z - s.z) - Math.hypot(q.x - s.x, q.z - s.z))[0];
    const last = b[b.length - 1];
    const dry = b.every((p) => isFree(stage, p.x, p.z, 0.2) && !inWater(stage, p.x, p.z));
    const leads = last !== undefined && Math.hypot(last.x - near.x, last.z - near.z) < 4;
    const m0 = s.mass;
    s.placeAt(b[0].x, b[0].z, 0);
    w['eatButtons'](s);
    out.pearly = b.length > 3 && dry && leads && s.mass > m0 ? `${b.length} buttons to a jewel` : `${b.length} buttons, dry ${dry}, leads ${leads}`;
  }

  // Jewels: one snake visits a jewel five times (waiting for each to come back): ROYAL once.
  {
    const w = new World(17, undefined, rulesFor('normal'), stage);
    const s = w.snake;
    let royals = 0;
    let picked = 0;
    for (let tick = 0; tick < 60 * 140 && picked < 6; tick++) {
      if (w.cards) w.choose(0);
      const t = w.treasures.find((j) => j.respawnIn <= 0);
      if (t) s.placeAt(t.x - 0.5, t.z, 0);
      s.immune = 5;
      w.step({ x: 0, z: 0, active: false, dash: false });
      for (const e of drain(w)) {
        if (e.type === 'jewel' && e.who === s.id) picked++;
        if (e.type === 'royal' && e.who === s.id) royals++;
      }
      if (s.crowned && picked >= 5) break;
    }
    out.jewels = picked === 5 && royals === 1 && s.crowned ? 'five, ROYAL once' : `picked ${picked}, royals ${royals}`;
  }
  return out;
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
function floodFill(stage: Stage, swim: boolean): { open: number; unreached: number; sample: string; reach: Uint8Array } {
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
  // The cells actually reached (open and seen), for checking spots like the Crown Jewels'.
  const reach = new Uint8Array(W * H);
  for (let c = 0; c < W * H; c++) reach[c] = open[c] & seen[c];
  return { open: total, unreached: total - reached, sample, reach };
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
      if (!s.alive || s.hasMagic('wings')) continue; // a flyer passes over the roof
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

// ---------------------------------------------------------------- London: the people (A4)

interface People {
  guards: number;
  /** A guard payout to the same snake inside GUARD_COOL of its last one. */
  guardTooSoon: number;
  /** Ticks the guard's spot and his solid did not agree (he must never move). */
  guardMoved: number;
  /** Ticks the trip's line was longer than its rope between two neighbours, or off its path. */
  tripSplit: number;
  tripOff: number;
  /** Ticks a trip child was near enough a bus lane to be clipped. */
  tripRoad: number;
  tripLongest: number;
  photos: number;
  boos: number;
  whistles: number;
  chipsThrown: number;
  chipHits: number;
  says: number;
}

const newPeople = (): People => ({
  guards: 0, guardTooSoon: 0, guardMoved: 0, tripSplit: 0, tripOff: 0, tripRoad: 0, tripLongest: 0, photos: 0, boos: 0, whistles: 0, chipsThrown: 0, chipHits: 0, says: 0,
});

/** Distance from (x, z) to a closed polyline. */
function toLoop(path: readonly { x: number; z: number }[], x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i < path.length; i++) {
    const a = path[i];
    const b = path[(i + 1) % path.length];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const t = Math.min(1, Math.max(0, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
  }
  return best;
}

function peopleAfter(w: World, p: People, paid: Map<number, number>, tick: number, note: (m: string) => void, where: string): void {
  const stage = w.stage;
  for (const e of w.events) {
    if (e.type === 'guard') {
      p.guards++;
      const last = paid.get(e.who);
      if (last !== undefined && tick - last < GUARD_COOL * 60 - 1) {
        p.guardTooSoon++;
        note(`${where}: the guard paid snake ${e.who} again after ${tick - last} ticks`);
      }
      paid.set(e.who, tick);
    } else if (e.type === 'photo') p.photos++;
    else if (e.type === 'boo') p.boos++;
    else if (e.type === 'whistle') p.whistles++;
    else if (e.type === 'lob' && e.kind === 'chip') p.chipsThrown++;
    else if (e.type === 'pelt' && e.chip) p.chipHits++;
    else if (e.type === 'say') p.says++;
  }
  const g = stage.guard;
  if (g && !stage.solidCircles.some((c) => c.x === g.x && c.z === g.z)) p.guardMoved++;
  const trip = w.kids.filter((k) => k.kind === 'trip');
  const path = stage.tripPath ?? [];
  for (let i = 0; i < trip.length; i++) {
    const k = trip[i];
    if (toLoop(path, k.x, k.z) > 0.01) {
      p.tripOff++;
      note(`${where}: trip child ${i} off its path at (${k.x.toFixed(2)}, ${k.z.toFixed(2)})`);
    }
    if (stage.routes?.some((r) => distanceToLoop(r.path, k.x, k.z) < VEHICLES.bus.width / 2 + 0.34 + 1)) p.tripRoad++;
    if (i === 0) continue;
    const gap = Math.hypot(k.x - trip[i - 1].x, k.z - trip[i - 1].z);
    p.tripLongest = Math.max(p.tripLongest, gap);
    if (gap > TRIP_GAP + 1e-6 || gap < TRIP_GAP * 0.5) {
      p.tripSplit++;
      note(`${where}: trip children ${i - 1}-${i} ${gap.toFixed(3)} m apart`);
    }
  }
}

/**
 * Scripted London people: three laps round the guard (once, then not again until his rest is
 * over), a lap undone by doubling back, a bump into him (Ahem, no shrink), a busker's dance (only in
 * range) and the living statue's BOO (once per rest).
 */
function londonPeopleScripted(stage: Stage): { laps: string; reverse: number; bump: string; dance: string; boo: number } {
  const g = stage.guard!;
  const R = 2.6;
  const circle = (w: World, from: number, to: number, ticks: number, onTick: (t: number) => void) => {
    const me = w.snake;
    for (let t = 0; t < ticks; t++) {
      if (w.cards) w.choose(0);
      const a = from + ((to - from) * t) / ticks;
      me.placeAt(g.x + Math.cos(a) * R, g.z + Math.sin(a) * R, a + Math.PI / 2);
      me.immune = 10;
      w.step({ x: 0, z: 0, active: false, dash: false });
      onTick(w.tick);
    }
  };
  const lapTicks = 4 * 60;

  // ---- 25 laps in 100 s: paid at 3 laps, then nothing until the rest is over, then once more.
  const w = new World(9, undefined, rulesFor('normal'), stage);
  const paidAt: number[] = [];
  circle(w, 0, 25 * Math.PI * 2, 25 * lapTicks, () => {
    for (const e of w.events) if (e.type === 'guard' && e.who === w.me) paidAt.push(w.tick);
    w.events.length = 0;
  });
  const laps = paidAt.map((t) => `${(t / lapTicks).toFixed(1)}`).join(', ');

  // ---- 2.5 laps, back one, on two: never three in a row, so never paid.
  const r = new World(10, undefined, rulesFor('normal'), stage);
  let reverse = 0;
  const count = () => {
    for (const e of r.events) if (e.type === 'guard' && e.who === r.me) reverse++;
    r.events.length = 0;
  };
  circle(r, 0, 5 * Math.PI, 2.5 * lapTicks, count);
  circle(r, 5 * Math.PI, 3 * Math.PI, lapTicks, count);
  circle(r, 3 * Math.PI, 7 * Math.PI, 2 * lapTicks, count);

  // ---- a bump: slither straight at him for a second.
  const b = new World(11, undefined, rulesFor('normal'), stage);
  const me = b.snake;
  me.placeAt(g.x, g.z + 2, -Math.PI / 2);
  let ahem = 0;
  let ouch = 0;
  let inside = 0;
  for (let t = 0; t < 90; t++) {
    if (b.cards) b.choose(0);
    me.immune = 0;
    b.step({ x: 0, z: -1, active: true, dash: false });
    for (const e of b.events) {
      if (e.type === 'bump' && e.who === b.me && e.what === 'guard') ahem++;
      if ((e.type === 'ouch' || e.type === 'vbonk' || e.type === 'chomp' || e.type === 'pelt') && e.who === b.me) ouch++;
    }
    b.events.length = 0;
    if (Math.hypot(me.x - g.x, me.z - g.z) < 0.75 + me.radius - 0.05) inside++;
  }
  const bump = ahem > 0 && ouch === 0 && inside === 0 ? 'Ahem, no shrink' : `ahem ${ahem}, ouch ${ouch}, inside ${inside}`;

  // ---- a busker's dance: faster in range, back to normal just outside it.
  const d = new World(12, undefined, rulesFor('normal'), stage);
  const busker = d.kids.find((k) => k.kind === 'busker')!;
  const hold = (dx: number, secs: number): number => {
    for (let t = 0; t < secs * 60; t++) {
      if (d.cards) d.choose(0);
      d.cooper.x = -80; // the Bobby's slow-down is not what this measures
      d.cooper.z = 60;
      d.snake.placeAt(busker.x + dx, busker.z - 1, 0);
      d.snake.teaFor = 0;
      d.snake.immune = 10;
      d.step({ x: 0, z: 0, active: false, dash: false });
      d.events.length = 0;
    }
    return d.snake.speedFactor;
  };
  const inRange = hold(2, 2);
  const outside = hold(-(BUSK_REACH + 1.5), 3); // west, away from the other busker
  const dance = inRange > 1.15 && Math.abs(outside - 1) < 0.01 ? 'in range only' : `in ${inRange.toFixed(3)}, out ${outside.toFixed(3)}`;

  // ---- the statue: stand by it for 8 s: BOO at once, and again only after its rest.
  const st = new World(13, undefined, rulesFor('normal'), stage);
  const at = stage.statue!;
  let boo = 0;
  for (let t = 0; t < 8 * 60; t++) {
    if (st.cards) st.choose(0);
    st.snake.placeAt(at.x, at.z + 2.2, 0);
    st.snake.immune = 10;
    st.step({ x: 0, z: 0, active: false, dash: false });
    for (const e of st.events) if (e.type === 'boo') boo++;
    st.events.length = 0;
  }
  return { laps, reverse, bump, dance, boo };
}

function invariants(id: StageId, seeds: number, baseline: boolean): number {
  const stage = stageFor(id);
  const ticks = 200 * 60;
  const t: Tally = { runs: 0, ticks: 0, inSolid: 0, outOfBounds: 0, stuck: 0, tooMany: 0, wet: 0, seen: new Set() };
  // Snakes may swim, so only real solids count as "inside" for them; everyone else must stay dry.
  const solids = dry(stage);
  const river = stage.water !== undefined;
  let longest = 0;
  /** Ticks a lion spent padding home the straight way (its give-up after LION_HOME_GIVE_UP). */
  let lostLions = 0;
  // London's zoo and menu: swans never gulped, raids land on the map, the combos fire.
  const zoo: Zoo | null = stage.animals.includes('swan') ? { swanGulps: 0, steals: 0, stealsOut: 0, cries: 0, teatimes: 0, teas: 0 } : null;
  // London's dangers: lions, ravens and the traffic.
  const danger: Danger | null = stage.predators.some((p) => p.kind === 'lion' || p.kind === 'raven') || stage.traffic ? newDanger() : null;
  // London's people: the guard, the trip, the tourists, the statue.
  const people: People | null = stage.guard ? newPeople() : null;
  // London's legends and Crown Jewels.
  const legends: Legends | null = stage.creatureHome ? newLegends() : null;
  // London's set pieces: Big Ben, Tower Bridge, the Eye, the Tube, the boat, the parade…
  const shows: Shows | null = stage.setPieces ? newShows() : null;
  const reach = legends ? floodFill(stage, true).reach : null;
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
      const kids = w.kids.length;
      const paid = new Map<number, number>();
      const boarded = new Map<number, number>();
      if (legends && reach && !jewelsReachable(w, reach)) {
        legends.jewelSeedsBad++;
        note(`${id}/${mode}/seed ${seed}: a Crown Jewel is not on free, reachable ground`);
      }
      for (let tick = 0; tick < ticks; tick++) {
        if (dangerRun) dangerBefore(w, dangerRun);
        stepSolo(w, thumb);
        if (zoo) tallyZoo(w, zoo, outside, note, `${id}/${mode}/seed ${seed}/t ${tick}`);
        if (danger && dangerRun) dangerAfter(w, danger, dangerRun, tick, note, `${id}/${mode}/seed ${seed}/t ${tick}`);
        if (people) peopleAfter(w, people, paid, tick, note, `${id}/${mode}/seed ${seed}/t ${tick}`);
        if (legends) legendsAfter(w, legends, note, `${id}/${mode}/seed ${seed}/t ${tick}`);
        if (shows) showsAfter(w, shows, boarded, note, `${id}/${mode}/seed ${seed}/t ${tick}`);
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
          } else if (river && !swims && inWater(w.stage, x, z)) {
            t.wet++;
            note(`${where}: ${what} in the water at (${x.toFixed(2)}, ${z.toFixed(2)})`);
          }
        };
        // A flyer (Dragon Wings) is above it all: only the fence holds it, and it must land free (legendsAfter).
        for (const s of w.snakes) if (s.alive && !s.hasMagic('wings')) check(`snake ${s.id}`, s.x, s.z, stage.logs, true);
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
          if (p.kind === 'lion' && p.state === LION.home && p.stateFor <= 0) {
            lostLions++; // padding straight home past things (its give-up): counted, not a solid fault
            continue;
          }
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
          if (river && placed && inWater(w.stage, f.x, f.z)) {
            t.wet++;
            note(`${where}: ${f.kind} spawned in the water at (${f.x.toFixed(2)}, ${f.z.toFixed(2)})`);
          }
        }
        for (const h of w.hazards) t.seen.add('hazard:' + h.kind);
        if (w.cooper.active) check('warden', w.cooper.x, w.cooper.z, []);
        if (w.animals.length !== animals || w.foods.length !== foods || w.kids.length !== kids || w.pellets.length > 150 || w.projectiles.length > 24) {
          t.tooMany++;
          note(`${where}: entity counts off (animals ${w.animals.length}, food ${w.foods.length}, pellets ${w.pellets.length})`);
        }
        // Stuck: alive and free to move, yet still within a metre of where it was over 3 s ago.
        for (const s of w.snakes) {
          const a = anchor[s.id];
          // On a ride (the Eye, the river bus), the ride moves you: that is not being stuck.
          const held = !s.alive || s.frozenFor > 0 || s.awayFor > 0 || s.cards !== null || s.carried !== null;
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
    row('lions lost their way', lostLions, lostLions === 0);
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
  if (people) {
    const info = (label: string, n: number | string) => console.log(`  ${label.padEnd(22)} ${String(n).padStart(8)}`);
    info('guard smiles (thumb)', people.guards);
    row('guard paid too soon', people.guardTooSoon, people.guardTooSoon === 0);
    row('guard moved', people.guardMoved, people.guardMoved === 0);
    row('trip split (ticks)', people.tripSplit, people.tripSplit === 0);
    info('trip widest gap', `${people.tripLongest.toFixed(3)}m`);
    row('trip off its path', people.tripOff, people.tripOff === 0);
    row('trip by a bus lane', people.tripRoad, people.tripRoad === 0);
    row('tourist photos', people.photos, people.photos > 0);
    row('statue BOOs', people.boos, people.boos > 0);
    row('Bobby whistles', people.whistles, people.whistles > 0);
    row('soggy chips thrown', people.chipsThrown, people.chipsThrown > 0);
    info('soggy chips landed', people.chipHits);
    row('chatter lines', people.says, people.says > 0);
    const scripted = londonPeopleScripted(stage);
    row('guard laps paid at', scripted.laps, scripted.laps.split(', ').length === 2 && parseFloat(scripted.laps) <= 3.2);
    row('guard, doubled back', scripted.reverse, scripted.reverse === 0);
    row('bump the guard', scripted.bump, scripted.bump === 'Ahem, no shrink');
    row('busker dance', scripted.dance, scripted.dance === 'in range only');
    row('statue BOOs in 8 s', scripted.boo, scripted.boo === 2);
  }
  if (legends) {
    const info = (label: string, n: number | string) => console.log(`  ${label.padEnd(22)} ${String(n).padStart(8)}`);
    const kinds = stage.creatureKinds ?? [];
    const notGulped = kinds.filter((k) => !legends.gulped.has(k));
    row('legends gulped', `${kinds.length - notGulped.length}/${kinds.length}`, notGulped.length === 0);
    if (notGulped.length) console.log(`    never gulped: ${notGulped.join(', ')}`);
    const noEffect = kinds.filter((k) => !legends.effects.has(k));
    row('legend magics seen', `${kinds.length - noEffect.length}/${kinds.length}`, noEffect.length === 0);
    if (noEffect.length) console.log(`    never seen: ${noEffect.map((k) => `${k} (${LEGEND_EFFECTS[k]})`).join(', ')}`);
    info('flights landed', legends.landings);
    row('bad landings', legends.badLandings, legends.badLandings === 0);
    info('phoenix rises', legends.rises);
    row('giants bonked by buses', legends.giantBonks, legends.giantBonks === 0);
    info('jewels picked up', legends.jewels);
    info('ROYAL crowns', legends.royals);
    row('runs, 5/5 jewels reachable', `${t.runs - legends.jewelSeedsBad}/${t.runs}`, legends.jewelSeedsBad === 0);
    const scripted = londonLegendsScripted(stage);
    row('wings run out', scripted.landing, !scripted.landing.includes('BAD'));
    row('phoenix', scripted.phoenix, scripted.phoenix === 'one hit undone');
    row('mighty roar', scripted.roar, scripted.roar === 'pushed, dazed, raven home');
    row('river rider', scripted.river, scripted.river === 'faster than the paddle');
    row('giant snake', scripted.giant, scripted.giant === 'gulped a duck');
    row('pearly lights', scripted.pearly, scripted.pearly.endsWith('buttons to a jewel'));
    row('crown jewels', scripted.jewels, scripted.jewels === 'five, ROYAL once');
  }
  if (shows) {
    const info = (label: string, n: number | string) => console.log(`  ${label.padEnd(22)} ${String(n).padStart(8)}`);
    row('BONGs', shows.bongs, shows.bongs > 0);
    info('ramp launches', shows.launches);
    row('bad launches', shows.badLaunches, shows.badLaunches === 0);
    row('on a raised bascule', shows.onRaised, shows.onRaised === 0);
    row('vehicles on the span', shows.spanRuns, shows.spanRuns === 0);
    row('waits for the bridge', shows.spanWaits, shows.spanWaits > 0);
    row('Eye rides', shows.eyeRides, shows.eyeRides > 0);
    row('Eye rides over 15 s', shows.eyeLate, shows.eyeLate === 0);
    info('longest Eye ride', `${shows.eyeLongest.toFixed(1)}s`);
    info('boat rides', shows.boatRides);
    row('bad get-offs', shows.badAlights, shows.badAlights === 0);
    row('Tube trips', shows.warps, shows.warps > 0);
    row('bad Tube exits', shows.badExits, shows.badExits === 0);
    const ports = stage.portals ?? [];
    const exits = ports.filter((p) => isFree(stage, p.at.x, p.at.z, 2) && !inWater(stage, p.at.x, p.at.z, 2) && !(stage.routes ?? []).some((r) => distanceToLoop(r.path, p.at.x, p.at.z) < 3.5));
    row('stations free & dry', `${exits.length}/${ports.length}`, exits.length === ports.length);
    info('wobbles', shows.wobbles);
    info('Red Arrows trails', shows.arrows);
    info('finale gems', shows.treats);
    const scripted = londonShowsScripted(stage);
    row('set-piece clock 10 min', scripted.clock, scripted.clock.startsWith('agree'));
    row('Tube, every line', scripted.tube, scripted.tube === `${ports.length}/${ports.length} stations`);
    row('on a rising bascule', scripted.launch, scripted.launch === 'launched to free ground');
    row('in the gap', scripted.gap, scripted.gap.startsWith('swam out'));
    row('the Eye', scripted.eye, scripted.eye.startsWith('back in') && parseFloat(scripted.eye.slice(8)) <= 15 && scripted.eye.endsWith('free ground'));
    row('the river bus', scripted.boat, scripted.boat.startsWith('to Bankside') && !scripted.boat.includes('BAD'));
    row('into the parade', scripted.parade, scripted.parade.endsWith('never stuck'));
    row('finale gems a show', scripted.finale, scripted.finale === 'one gem a show');
    row('the wobbly bridge', scripted.wobble, scripted.wobble === 'WOBBLE, swayed, stayed on');
  }
  console.log(`  ${'longest stall'.padEnd(22)} ${(longest / 60).toFixed(1).padStart(7)}s`);
  row('kinds seen', `${want.size - missing.length}/${want.size}`, missing.length === 0);
  if (missing.length) console.log(`  never seen: ${missing.join(', ')}`);
  for (const n of notes) console.log(`  · ${n}`);
  return bad;
}

// ---------------------------------------------------------------- London: the set pieces (A6)

interface Shows {
  bongs: number;
  launches: number;
  badLaunches: number;
  eyeRides: number;
  eyeLongest: number;
  eyeLate: number;
  boatRides: number;
  badAlights: number;
  warps: number;
  badExits: number;
  wobbles: number;
  arrows: number;
  treats: number;
  /** Ticks a vehicle stood on Tower Bridge's span while it was up, and ticks one waited for it. */
  spanRuns: number;
  spanWaits: number;
  /** Ticks a snake stood on dry ground in the span while it was up: on a raised bascule. */
  onRaised: number;
}

const newShows = (): Shows => ({
  bongs: 0, launches: 0, badLaunches: 0, eyeRides: 0, eyeLongest: 0, eyeLate: 0, boatRides: 0, badAlights: 0, warps: 0, badExits: 0,
  wobbles: 0, arrows: 0, treats: 0, spanRuns: 0, spanWaits: 0, onRaised: 0,
});

/** Free, dry ground for a snake of radius `r` at (x, z), as the world is right now (Tower Bridge up or down). */
const landsFree = (w: World, x: number, z: number, r: number) => isFree(w.stage, x, z, r) && !inWater(w.stage, x, z);

/** Read a tick's events and the bridge for the set pieces' tally. `boarded` remembers when each rider got on. */
function showsAfter(w: World, g: Shows, boarded: Map<number, number>, note: (m: string) => void, where: string): void {
  const sp = w.stage.setPieces!;
  const t = w.tick - 1; // the tick just stepped
  for (const e of w.events) {
    if (e.type === 'bong') g.bongs++;
    else if (e.type === 'launch') {
      g.launches++;
      if (!landsFree(w, e.x, e.z, 0) || inBox(sp.span, e.x, e.z)) {
        g.badLaunches++;
        note(`${where}: snake ${e.who} launched onto (${e.x.toFixed(2)}, ${e.z.toFixed(2)})`);
      }
    } else if (e.type === 'ride' && e.on) {
      boarded.set(e.who, w.tick);
      if (e.by === 'eye') g.eyeRides++;
      else g.boatRides++;
    } else if (e.type === 'ride') {
      const secs = (w.tick - (boarded.get(e.who) ?? w.tick)) / 60;
      if (e.by === 'eye') {
        g.eyeLongest = Math.max(g.eyeLongest, secs);
        if (secs > 15) {
          g.eyeLate++;
          note(`${where}: snake ${e.who} rode the Eye for ${secs.toFixed(1)} s`);
        }
      }
      if (!landsFree(w, e.x, e.z, 0)) {
        g.badAlights++;
        note(`${where}: snake ${e.who} got off the ${e.by} into (${e.x.toFixed(2)}, ${e.z.toFixed(2)})`);
      }
    } else if (e.type === 'warp') {
      g.warps++;
      if (!landsFree(w, e.x, e.z, 1)) {
        g.badExits++;
        note(`${where}: snake ${e.who} came up the Tube into (${e.x.toFixed(2)}, ${e.z.toFixed(2)})`);
      }
    } else if (e.type === 'wobble') g.wobbles++;
    else if (e.type === 'arrows') g.arrows++;
    else if (e.type === 'treat') g.treats++;
  }
  // Shut for a lift: a vehicle pulled up by the span is waiting for it.
  if (spanClosed(t)) for (const v of w.vehicles) if (v.speed === 0 && Math.hypot(v.x - sp.span.x, v.z - sp.span.z) < 14) g.spanWaits++;
  if (!spanOpen(t)) return;
  for (const v of w.vehicles) {
    if (Math.abs(v.x - sp.span.x) < sp.span.w / 2 && Math.abs(v.z - sp.span.z) < sp.span.d / 2) {
      g.spanRuns++;
      note(`${where}: a ${v.kind} on Tower Bridge's span while it was up`);
    }
  }
  for (const s of w.snakes) {
    const held = s.frozenFor > 0 || s.awayFor > 0 || s.cards !== null;
    if (!s.alive || held || s.carried || s.hasMagic('wings') || !inBox(sp.span, s.x, s.z) || inWater(w.stage, s.x, s.z)) continue;
    g.onRaised++;
    note(`${where}: snake ${s.id} standing on a raised bascule at (${s.x.toFixed(2)}, ${s.z.toFixed(2)})`);
  }
}

/**
 * Scripted set pieces: the phone's set-piece clock against the server's for ten minutes; a ride on
 * every Tube line; the bascules launching a snake and a swimmer leaving the gap; the Eye bringing its
 * rider back; a boat trip; the parade pushing (never trapping) a snake that walks into it; the wobble.
 */
function londonShowsScripted(stage: Stage): Record<string, string> {
  const out: Record<string, string> = {};
  const sp = stage.setPieces!;
  const drain = (w: World) => {
    const ev = [...w.events];
    w.events.length = 0;
    return ev;
  };
  const toward = (s: { x: number; z: number }, x: number, z: number) => {
    const d = Math.hypot(x - s.x, z - s.z) || 1;
    return { x: (x - s.x) / d, z: (z - s.z) / d, active: true, dash: false };
  };
  const step = (w: World, input = { x: 0, z: 0, active: false, dash: false }) => {
    if (w.cards) w.choose(0);
    w.step(input);
    return drain(w);
  };

  // The clock: a room for ten minutes, against a phone's copy worked out from the tick alone (as replica.ts does).
  {
    const w = World.room(3, rulesFor('normal'), stage);
    const phone: Terrain = { ...stage };
    const marchers: Marcher[] = [];
    let off = 0;
    let bongs = 0;
    let lifts = 0;
    let marched = 0;
    for (let i = 0; i < 10 * 60 * 60; i++) {
      const tick = w.tick;
      const ev = step(w);
      applyTerrain(phone, sp, stage.bridges!, tick);
      if (phone.bridges !== w.stage.bridges) off++;
      const n = paradeAt(tick, sp.parade, marchers);
      if (n !== w.marcherCount) off++;
      for (let k = 0; k < n; k++) if (marchers[k].x !== w.marchers[k].x || marchers[k].z !== w.marchers[k].z) off++;
      const rang = ev.filter((e) => e.type === 'bong').length;
      if (rang !== (bongAt(tick) ? 1 : 0)) off++;
      bongs += rang;
      if (liftRises(tick)) lifts++;
      if (n > 0) marched++;
    }
    out.clock = off === 0 ? `agree (${bongs} bongs, ${lifts} lifts, ${(marched / 60).toFixed(0)} s of parade)` : `${off} ticks disagree`;
  }

  // The Tube: into every station from open ground; out at the next, on free, dry ground.
  {
    const ports = stage.portals!;
    const done: string[] = [];
    ports.forEach((p, i) => {
      const w = new World(21 + i, undefined, rulesFor('normal'), stage);
      const s = w.snake;
      s.mass = 30;
      let from: { x: number; z: number } | null = null;
      for (let k = 0; k < 8 && !from; k++) {
        const x = p.at.x + Math.cos((k * Math.PI) / 4) * 4;
        const z = p.at.z + Math.sin((k * Math.PI) / 4) * 4;
        if (isFree(w.stage, x, z, 1.5) && isFree(w.stage, (x + p.at.x) / 2, (z + p.at.z) / 2, 1.5)) from = { x, z };
      }
      if (!from) return;
      s.placeAt(from.x, from.z, Math.atan2(p.at.z - from.z, p.at.x - from.x));
      for (let tick = 0; tick < 180; tick++) {
        const e = step(w, toward(s, p.at.x, p.at.z)).find((o) => o.type === 'warp' && o.who === s.id);
        if (e?.type !== 'warp') continue;
        if (e.from === i && e.to === (i + 1) % ports.length && landsFree(w, e.x, e.z, s.radius) && s.x === e.x && s.z === e.z) done.push(p.id);
        break;
      }
    });
    out.tube = `${done.length}/${ports.length} stations`;
  }

  // Tower Bridge: on a bascule as it rises (launched to free ground, WHEE!), and in the gap while it is up (swims out).
  {
    const rise = LIFT_FIRST + LIFT_BELLS;
    const w = new World(31, undefined, rulesFor('normal'), stage);
    const s = w.snake;
    s.mass = 10;
    w.tick = rise - 30;
    s.placeAt(63.5, sp.span.z, 0);
    let launched = '';
    for (let tick = 0; tick < 60 && !launched; tick++) {
      const e = step(w).find((o) => o.type === 'launch' && o.who === s.id);
      if (e) launched = landsFree(w, s.x, s.z, s.radius) && !inBox(sp.span, s.x, s.z) && s.launchFor > 0 ? 'launched to free ground' : `BAD at (${s.x.toFixed(1)}, ${s.z.toFixed(1)})`;
    }
    out.launch = launched || 'never launched';

    const v = new World(32, undefined, rulesFor('normal'), stage);
    const g = v.snake;
    g.mass = 10;
    v.tick = rise + LIFT_RISE + 60;
    g.placeAt(sp.span.x, sp.span.z, Math.PI);
    let ticks = 0;
    while (ticks < 600 && inBox(sp.span, g.x, g.z)) {
      step(v, { x: -1, z: 0, active: true, dash: false });
      ticks++;
    }
    out.gap = ticks < 600 ? `swam out in ${(ticks / 60).toFixed(1)} s` : 'STUCK in the gap';
  }

  // The London Eye: in at the bottom capsule, back down on free ground after one turn.
  {
    const w = new World(41, undefined, rulesFor('normal'), stage);
    const s = w.snake;
    s.mass = 20;
    s.placeAt(sp.eye.board.x + 4.5, sp.eye.board.z, Math.PI);
    let on = -1;
    let result = 'never boarded';
    for (let tick = 0; tick < 60 * 25; tick++) {
      const ev = step(w, on < 0 ? toward(s, sp.eye.board.x, sp.eye.board.z) : { x: 1, z: 0, active: true, dash: false });
      for (const e of ev) {
        if (e.type !== 'ride' || e.who !== s.id || e.by !== 'eye') continue;
        if (e.on) on = tick;
        else result = `back in ${((tick - on) / 60).toFixed(1)} s${landsFree(w, e.x, e.z, s.radius) ? ', on free ground' : ', BAD ground'}`;
      }
      if (on >= 0 && result !== 'never boarded') break;
      if (on >= 0 && s.carried === null && tick > on + 1) break;
    }
    if (on >= 0 && result === 'never boarded') result = 'NEVER came back';
    out.eye = result;
    out.eyeTurn = `${(EYE_RIDE / 60).toFixed(0)} s`;
  }

  // The river bus: on at Westminster pier, off at Bankside.
  {
    const w = new World(51, undefined, rulesFor('normal'), stage);
    const s = w.snake;
    s.mass = 15;
    const pier = sp.piers[0];
    const from = { x: pier.board.x + Math.cos(pier.out) * 3, z: pier.board.z + Math.sin(pier.out) * 3 };
    s.placeAt(from.x, from.z, pier.out + Math.PI);
    let on = -1;
    let result = 'never boarded';
    for (let tick = 0; tick < 60 * 40; tick++) {
      const ev = step(w, on < 0 ? toward(s, pier.board.x, pier.board.z) : { x: 0, z: 0, active: false, dash: false });
      for (const e of ev) {
        if (e.type !== 'ride' || e.who !== s.id) continue;
        if (e.on) on = tick;
        else {
          const there = Math.hypot(e.x - sp.piers[1].board.x, e.z - sp.piers[1].board.z) < 4;
          result = `${there ? 'to Bankside' : 'SOMEWHERE ELSE'} in ${((tick - on) / 60).toFixed(1)} s${landsFree(w, e.x, e.z, s.radius) ? '' : ', BAD ground'}`;
        }
      }
      if (result !== 'never boarded') break;
    }
    out.boat = result;
  }

  // The parade: a snake walks straight into the column on the Mall. Pushed aside, never stuck, never hurt.
  {
    const w = new World(61, undefined, rulesFor('normal'), stage);
    const s = w.snake;
    s.mass = 40;
    w.tick = PARADE_FIRST + 6 * 60;
    const [a, b] = sp.parade;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const ux = (b.x - a.x) / len;
    const uz = (b.z - a.z) / len;
    // On the column's own side of the Mall (it marches out on the right of the route's middle line).
    const sx = a.x + ux * 13 + uz * 1.2;
    const sz = a.z + uz * 13 - ux * 1.2;
    s.placeAt(sx, sz, Math.atan2(-uz, -ux));
    s.immune = 0;
    const m0 = s.mass;
    let bumps = 0;
    let stuck = 0;
    let anchor = { x: s.x, z: s.z, tick: 0 };
    for (let tick = 0; tick < 15 * 60; tick++) {
      for (const e of step(w, { x: -ux, z: -uz, active: true, dash: false })) if (e.type === 'bump' && e.who === s.id && e.what === 'guard') bumps++;
      if (Math.hypot(s.x - anchor.x, s.z - anchor.z) > 1) anchor = { x: s.x, z: s.z, tick };
      else if (tick - anchor.tick > 180) stuck++;
    }
    out.parade = stuck === 0 && s.mass >= m0 && bumps > 0 ? `Ahem ×${bumps}, never stuck` : `bumps ${bumps}, stuck ${stuck} ticks, mass ${m0}→${s.mass.toFixed(1)}`;
  }

  // The fireworks finale: a snake parked by the river through a whole show gets one gem, no more.
  {
    const w = new World(81, undefined, rulesFor('normal'), stage);
    const s = w.snake;
    w.tick = FIREWORKS_EVERY - FIREWORKS_FOR - 10;
    let treats = 0;
    for (let tick = 0; tick < FIREWORKS_FOR + 20; tick++) {
      const b = burstAt(w.tick, sp, w.setPieceSeed, { tick: 0, k: 0, x: 0, z: 0, finale: false, colour: 0 });
      if (b?.finale) s.placeAt(b.x, b.z + 1, 0); // right under every finale burst
      s.awayFor = 0;
      treats += step(w).filter((e) => e.type === 'treat' && e.who === s.id).length;
    }
    out.finale = treats === 1 ? 'one gem a show' : `${treats} gems`;
  }

  // The wobbly bridge: walk onto the Millennium Bridge and be pushed side to side.
  {
    const w = new World(71, undefined, rulesFor('normal'), stage);
    const s = w.snake;
    const deck = sp.millennium;
    s.placeAt(deck.x, deck.z + deck.d / 2 - 1, -Math.PI / 2);
    let wobbles = 0;
    let swayed = 0;
    for (let tick = 0; tick < 120; tick++) {
      const x0 = s.x;
      wobbles += step(w, { x: 0, z: -1, active: true, dash: false }).filter((e) => e.type === 'wobble' && e.who === s.id).length;
      if (inBox(deck, s.x, s.z) && Math.abs(s.x - x0) > 1e-4) swayed++;
    }
    out.wobble = wobbles === 1 && swayed > 30 && inBox(deck, s.x, s.z) ? 'WOBBLE, swayed, stayed on' : `wobbles ${wobbles}, swayed ${swayed}`;
  }
  return out;
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
      // Every guarded stage × mode × a handful of seeds (one seed alone missed a change that only
      // showed on others). Naming stages after --all limits it, e.g. to re-baseline London alone.
      const only = rest.filter((r) => GUARDED.includes(r as StageId)) as StageId[];
      const cases: [StageId, Mode][] = (only.length ? only : GUARDED).flatMap((id) => MODES.map((m) => [id, m] as [StageId, Mode]));
      let bad = 0;
      for (const seed of FINGERPRINT_SEEDS) bad += runFingerprints(cases, 3600, seed, baseline);
      return bad;
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
