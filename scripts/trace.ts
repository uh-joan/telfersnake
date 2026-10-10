/**
 * The HD port's parity trace (phase B3). Runs the classic sim headless and dumps what happened, so the
 * C# port (unity/…/Editor/LondonTrace.cs, the same script) can be compared against it:
 *
 *   tsx scripts/trace.ts world [seeds=7] [ticks=3600] [out.json]   solo London runs (seeds "1-8": counts summed), A2 + A3 only
 *   tsx scripts/trace.ts traffic [ticks=1200] [out.json]            the buses and cabs alone, scripted walkers
 *   tsx scripts/trace.ts compare <ts.json> <cs.json>                 how far apart the two are
 *
 * `world` plays London as far as the HD port has got (the menu, the zoo, the lions, ravens, traffic and
 * hazards): the people, the legends, the jewels and the set pieces are taken off the stage, so neither side
 * draws RNG for them. The player follows a fixed tour (Westminster → the Mall → Trafalgar's lions → the
 * Strand → the Tower's ravens), dashing now and then, and always takes the first card. Per tick it records
 * the event types and the positions of the player, the vehicles, the predators and the first animals.
 *
 * `traffic` drives the vehicles module directly (no RNG anywhere), with a walker parked on a zebra and
 * then in a bus lane, so its positions must agree to float precision.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { LONDON } from '../src/sim/londonLayout';
import { rulesFor } from '../src/sim/modes';
import type { Stage } from '../src/sim/stage';
import { driveVehicle, makeLane, makeVehicles, type Walker } from '../src/sim/vehicles';
import { World } from '../src/sim/world';

/** London as the HD port has it so far (A2 + A3): no people, legends, jewels or set pieces. */
const LONDON_A3: Stage = {
  ...LONDON,
  kids: [],
  creatureCount: 0,
  jewelSpots: undefined,
  setPieces: undefined,
  chatters: undefined,
  statue: undefined,
  guard: undefined,
  touristSpots: undefined,
  buskerSpots: undefined,
  tripPath: undefined,
  portals: undefined,
};

/** The player's tour, in metres. */
export const TOUR = [
  [-36, -6], [-30, -22], [-20, -34], [-12, -36], [-4, -38], [4, -39], [20, -35], [34, -33], [48, -26], [55, -12], [50, -24], [20, -30], [-12, -34], [-30, -22], [-40, 0],
];

/** Events the port does not have yet (A4+), left out of the counts. */
const NOT_YET = new Set(['whistle']);

interface Trace {
  kind: string;
  seed: number;
  ticks: number;
  counts: Record<string, number>;
  /** Per tick (first 600): event types. */
  events: string[][];
  /** Per tick (first 600): [player x, z, then vehicles' x, z, then predators' x, z, state, then the first 6 animals' x, z]. */
  pos: number[][];
}

function runWorld(seed: number, ticks: number): Trace {
  const w = new World(seed, undefined, rulesFor('normal'), LONDON_A3);
  const counts: Record<string, number> = {};
  const events: string[][] = [];
  const pos: number[][] = [];
  let leg = 0;
  for (let t = 0; t < ticks; t++) {
    if (w.cards) w.choose(0);
    const s = w.snake;
    const [tx, tz] = TOUR[leg % TOUR.length];
    if (Math.hypot(tx - s.x, tz - s.z) < 3) leg++;
    const dx = tx - s.x;
    const dz = tz - s.z;
    const d = Math.hypot(dx, dz) || 1;
    w.step({ x: dx / d, z: dz / d, active: true, dash: Math.floor(t / 90) % 6 === 5 });
    const types: string[] = [];
    for (const e of w.events) {
      if (NOT_YET.has(e.type)) continue;
      counts[e.type] = (counts[e.type] ?? 0) + 1;
      types.push(e.type);
    }
    w.events.length = 0;
    if (t < 600) {
      events.push(types);
      const row = [w.snake.x, w.snake.z];
      for (const v of w.vehicles) row.push(v.x, v.z);
      for (const p of w.predators) row.push(p.x, p.z, p.state);
      for (const a of w.animals.slice(0, 6)) row.push(a.x, a.z);
      pos.push(row);
    }
  }
  return { kind: 'world', seed, ticks, counts, events, pos };
}

function runTraffic(ticks: number): Trace {
  const st = LONDON;
  const lanes = st.routes!.map((r) => makeLane(r, st.zebras ?? []));
  const vehicles = makeVehicles(st.traffic!, st.routes!, lanes);
  const counts: Record<string, number> = {};
  const events: string[][] = [];
  const pos: number[][] = [];
  const walkers: Walker[] = [];
  for (let t = 0; t < ticks; t++) {
    // A walker on lane 0's first zebra for 400 ticks, then in the middle of lane 1's road for 400, then none.
    walkers.length = 0;
    if (t < 400 && lanes[0].zebraAt.length > 0) walkers.push({ x: lanes[0].zebraAt[0].x, z: lanes[0].zebraAt[0].z, r: 0.4 });
    else if (t < 800) walkers.push({ x: lanes[1].route.path[3].x, z: lanes[1].route.path[3].z, r: 0.5 });
    const types: string[] = [];
    for (const v of vehicles) {
      driveVehicle(v, lanes[v.route], vehicles, walkers, 1 / 60, {
        ding: (_veh, honk) => {
          const k = honk ? 'honk' : 'ding';
          counts[k] = (counts[k] ?? 0) + 1;
          types.push(k);
        },
      });
    }
    events.push(types);
    const row: number[] = [];
    for (const v of vehicles) row.push(v.x, v.z, v.speed);
    pos.push(row);
  }
  return { kind: 'traffic', seed: 0, ticks, counts, events, pos };
}

function compare(a: Trace, b: Trace): void {
  console.log(`${a.kind}: seed ${a.seed}, ${a.ticks} ticks`);
  const kinds = [...new Set([...Object.keys(a.counts), ...Object.keys(b.counts)])].sort();
  console.log('event         ts      cs     diff');
  for (const k of kinds) {
    const x = a.counts[k] ?? 0;
    const y = b.counts[k] ?? 0;
    const rel = Math.abs(x - y) / Math.max(1, x, y);
    console.log(`${k.padEnd(10)} ${String(x).padStart(6)} ${String(y).padStart(6)}   ${rel < 0.35 ? 'ok ' : 'OFF'} ${(rel * 100).toFixed(0)}%`);
  }
  // Positions: the first tick any column parts by more than 1 cm, and the worst gap before it.
  const n = Math.min(a.pos.length, b.pos.length);
  let firstOff = -1;
  let worst = 0;
  let col = -1;
  for (let t = 0; t < n && firstOff < 0; t++) {
    const ra = a.pos[t];
    const rb = b.pos[t];
    if (ra.length !== rb.length) {
      firstOff = t;
      break;
    }
    for (let i = 0; i < ra.length; i++) {
      const d = Math.abs(ra[i] - rb[i]);
      if (d > 0.01) {
        firstOff = t;
        col = i;
        break;
      }
      worst = Math.max(worst, d);
    }
  }
  let sameEvents = 0;
  for (let t = 0; t < Math.min(a.events.length, b.events.length); t++) {
    if (a.events[t].slice().sort().join() !== b.events[t].slice().sort().join()) break;
    sameEvents++;
  }
  console.log(`positions agree (≤ 1 cm) for ${firstOff < 0 ? n : firstOff} of ${n} ticks${col >= 0 ? ` (column ${col} parts first)` : ''}; worst gap before that ${worst.toExponential(2)} m`);
  console.log(`event stream identical for the first ${sameEvents} ticks`);
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'world') {
  // "a-b" runs every seed from a to b and sums the counts; the per-tick rows are the first seed's.
  const [from, to] = (args[0] ?? '7').split('-').map(Number);
  const ticks = Number(args[1] ?? 3600);
  const out = runWorld(from, ticks);
  for (let seed = from + 1; seed <= (to ?? from); seed++) {
    for (const [k, n] of Object.entries(runWorld(seed, ticks).counts)) out.counts[k] = (out.counts[k] ?? 0) + n;
  }
  writeFileSync(args[2] ?? 'trace-ts.json', JSON.stringify(out));
  console.log(JSON.stringify(out.counts));
} else if (cmd === 'traffic') {
  const out = runTraffic(Number(args[0] ?? 1200));
  writeFileSync(args[1] ?? 'traffic-ts.json', JSON.stringify(out));
  console.log(JSON.stringify(out.counts));
} else if (cmd === 'compare') {
  compare(JSON.parse(readFileSync(args[0], 'utf8')), JSON.parse(readFileSync(args[1], 'utf8')));
} else {
  console.log('usage: tsx scripts/trace.ts world [seed] [ticks] [out] | traffic [ticks] [out] | compare <ts.json> <cs.json>');
}
