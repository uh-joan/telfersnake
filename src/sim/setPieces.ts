import type { Box } from './layout';
import type { Spot, Terrain } from './stage';

/**
 * London's big set pieces (docs/LEVEL3-LONDON.md §7, plan §4.1): Big Ben striking the minute, Tower
 * Bridge lifting for a tall ship, the Changing of the Guard marching the Mall, the river bus, the
 * fireworks and the Red Arrows. Every one of them is a pure function of the TICK (and a small
 * `setPieceSeed` for variety, which the server sends in `welcome`): the room's own seed never reaches
 * a phone, but the tick does, so the server and every phone agree on the whole show with no protocol.
 *
 * Only what a set piece does to the snakes is the sim's (world.ts): the BONG's golden ring, the ramp
 * launch, the Eye and boat rides, the Tube, the parade's polite shove. Pure data and arithmetic here:
 * no RNG, no state, so a stage without `setPieces` never meets any of it.
 */

/** Sim ticks per second (world.ts STEP is 1/60). */
export const TPS = 60;

/** A river-bus pier: where the boat ties up on the river, and the spot on the bank you board from. */
export interface Pier {
  id: string;
  /** On the river's centre line, where the boat waits. */
  at: Spot;
  /** On dry land at the water's edge: a head here while the boat is in boards it. */
  board: Spot;
  /** Which way you face stepping off (away from the water). */
  out: number;
}

/** Where London's set pieces happen (LONDON.setPieces in londonLayout.ts). */
export interface SetPieceSpots {
  /** Big Ben: the BONG's golden ring bursts out round here. */
  bigBen: Spot;
  /** The London Eye: the boarding capsule at the bottom, and where the ride lets you off. */
  eye: { board: Spot; exit: Spot; heading: number };
  /** Tower Bridge's two bascules (the lifting span), and the stage's bridges with that span taken out. */
  span: Box;
  bridgesUp: readonly Box[];
  /** The wobbly Millennium Bridge's deck. */
  millennium: Box;
  /** The Changing of the Guard's route: out from the Palace down the Mall (it comes back the same way). */
  parade: readonly Spot[];
  /** The river bus's piers, in the order it calls (there and back). */
  piers: readonly Pier[];
  /** The river's centre line (the boat's and the tall ship's water), west → east. */
  river: readonly Spot[];
  /** Red Arrows fly-past lines (from, to), picked per pass. */
  arrows: readonly (readonly [Spot, Spot])[];
  /** Where fireworks burst, over the river. */
  fireworks: readonly Spot[];
}

// ---------------------------------------------------------------- paths

interface PathTable {
  cum: number[];
  length: number;
}
const tables = new WeakMap<readonly Spot[], PathTable>();

function table(path: readonly Spot[]): PathTable {
  let t = tables.get(path);
  if (!t) {
    const cum = [0];
    for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z));
    t = { cum, length: cum[cum.length - 1] };
    tables.set(path, t);
  }
  return t;
}

export const pathLength = (path: readonly Spot[]): number => table(path).length;

/** A point `s` metres along an open polyline (clamped to its ends), with the direction it runs there. */
export function alongPath(path: readonly Spot[], s: number, out: { x: number; z: number; heading: number }): void {
  const { cum, length } = table(path);
  s = Math.min(length, Math.max(0, s));
  let i = 0;
  while (i < path.length - 2 && cum[i + 1] < s) i++;
  const a = path[i];
  const b = path[i + 1];
  const seg = cum[i + 1] - cum[i];
  const t = seg > 0 ? (s - cum[i]) / seg : 0;
  out.x = a.x + (b.x - a.x) * t;
  out.z = a.z + (b.z - a.z) * t;
  out.heading = Math.atan2(b.z - a.z, b.x - a.x);
}

/** How far along a polyline its nearest point to (x, z) lies. */
export function projectOnPath(path: readonly Spot[], x: number, z: number): number {
  const { cum } = table(path);
  let best = Infinity;
  let at = 0;
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i];
    const b = path[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len2 = dx * dx + dz * dz;
    const t = len2 > 0 ? Math.min(1, Math.max(0, ((x - a.x) * dx + (z - a.z) * dz) / len2)) : 0;
    const d = (x - a.x - dx * t) ** 2 + (z - a.z - dz * t) ** 2;
    if (d < best) {
      best = d;
      at = cum[i] + t * Math.sqrt(len2);
    }
  }
  return at;
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

// ---------------------------------------------------------------- Big Ben

/** Big Ben strikes every minute of the run. */
export const MINUTE_TICKS = 60 * TPS;
/** The Westminster Quarters play first, for this long... */
export const QUARTERS_TICKS = 7 * TPS;
/** ...then a BONG every this many ticks, one per hour of the clock (1..12). */
export const BONG_TICKS = 150;

/** How many BONGs minute `m` (1, 2, …) strikes: 1..12, round and round like a clock face. */
export const bongsFor = (minute: number): number => ((minute - 1) % 12) + 1;

/** The tick the quarters for the minute that `tick` falls in began, or −1 before the first minute. */
export function chimeStart(tick: number): number {
  const m = Math.floor(tick / MINUTE_TICKS);
  return m >= 1 ? m * MINUTE_TICKS : -1;
}

/** If a BONG rings on exactly this tick: which one (0-based) of how many. Otherwise null. */
export function bongAt(tick: number): { k: number; n: number; minute: number } | null {
  const minute = Math.floor(tick / MINUTE_TICKS);
  if (minute < 1) return null;
  const off = tick - minute * MINUTE_TICKS - QUARTERS_TICKS;
  if (off < 0 || off % BONG_TICKS !== 0) return null;
  const k = off / BONG_TICKS;
  const n = bongsFor(minute);
  return k < n ? { k, n, minute } : null;
}

// ---------------------------------------------------------------- Tower Bridge

export const LIFT_FIRST = 40 * TPS;
export const LIFT_EVERY = 90 * TPS;
/** The lift: bells ring, the bascules rise, stay open while the ship sails through, then come down. */
export const LIFT_BELLS = 4 * TPS;
export const LIFT_RISE = 4 * TPS;
export const LIFT_OPEN = 10 * TPS;
export const LIFT_LOWER = 4 * TPS;
const LIFT_LEN = LIFT_BELLS + LIFT_RISE + LIFT_OPEN + LIFT_LOWER;

export type LiftPhase = 'down' | 'bells' | 'rise' | 'open' | 'lower';

export interface Lift {
  phase: LiftPhase;
  /** How far up the bascules are: 0 (a road) to 1 (fully raised). */
  raise: number;
  /** Ticks into this lift (from the first bell). */
  at: number;
  /** Which lift of the run this is (0, 1, …); −1 before the first. */
  cycle: number;
}

const ease = (t: number) => t * t * (3 - 2 * t);

export function liftAt(tick: number, out: Lift = { phase: 'down', raise: 0, at: 0, cycle: -1 }): Lift {
  const c = tick - LIFT_FIRST;
  out.cycle = c < 0 ? -1 : Math.floor(c / LIFT_EVERY);
  const p = c < 0 ? LIFT_LEN : mod(c, LIFT_EVERY);
  out.at = p;
  if (p >= LIFT_LEN) {
    out.phase = 'down';
    out.raise = 0;
  } else if (p < LIFT_BELLS) {
    out.phase = 'bells';
    out.raise = 0;
  } else if (p < LIFT_BELLS + LIFT_RISE) {
    out.phase = 'rise';
    out.raise = ease((p - LIFT_BELLS) / LIFT_RISE);
  } else if (p < LIFT_BELLS + LIFT_RISE + LIFT_OPEN) {
    out.phase = 'open';
    out.raise = 1;
  } else {
    out.phase = 'lower';
    out.raise = ease(1 - (p - LIFT_BELLS - LIFT_RISE - LIFT_OPEN) / LIFT_LOWER);
  }
  return out;
}

const LIFT = liftAt(0);
/** Is the road across Tower Bridge broken (the bascules up at all)? Then the span is river. */
export function spanOpen(tick: number): boolean {
  const p = liftAt(tick, LIFT).phase;
  return p === 'rise' || p === 'open' || p === 'lower';
}
/** Is the bridge closed to traffic (from the first bell until it is down again)? */
export const spanClosed = (tick: number): boolean => liftAt(tick, LIFT).phase !== 'down';
/** The very tick the bascules start to rise: whoever is on them gets launched down the ramp. */
export const liftRises = (tick: number): boolean => {
  liftAt(tick, LIFT);
  return LIFT.cycle >= 0 && LIFT.at === LIFT_BELLS;
};

/** The stage's bridges for this tick: Tower Bridge's span is lifted out while it is open. */
export function bridgesAt(spots: SetPieceSpots, down: readonly Box[], tick: number): readonly Box[] {
  return spanOpen(tick) ? spots.bridgesUp : down;
}

/**
 * Set a stage copy's bridges for this tick (World and Replica each keep their own copy of a stage
 * with set pieces, so many rooms in one process never share one). `down` is the stage's own list.
 */
export function applyTerrain(terrain: Terrain, spots: SetPieceSpots, down: readonly Box[], tick: number): void {
  terrain.bridges = bridgesAt(spots, down, tick);
}

/** The tall ship: sails down the river during a lift, under the bridge mid-way through the open. */
const SHIP_SPEED = 2.2;
const SHIP_CROSS = LIFT_BELLS + LIFT_RISE + LIFT_OPEN / 2; // the tick in the lift it passes under the bridge
export function shipAt(tick: number, spots: SetPieceSpots, out: { x: number; z: number; heading: number }): boolean {
  liftAt(tick, LIFT);
  if (LIFT.phase === 'down') return false;
  const cross = projectOnPath(spots.river, spots.span.x, spots.span.z);
  alongPath(spots.river, cross + ((LIFT.at - SHIP_CROSS) / TPS) * SHIP_SPEED, out);
  return true;
}

// ---------------------------------------------------------------- the Changing of the Guard

export const PARADE_FIRST = 75 * TPS;
export const PARADE_EVERY = 240 * TPS;
/** Marching pace (m/s), the gap between marchers, how far each leg runs off the route's middle. */
export const PARADE_SPEED = 1.4;
export const PARADE_GAP = 1.3;
export const PARADE_SIDE = 1.2;
/** The band (drums) leads, the guards follow in their bearskins. */
export const PARADE_BAND = 4;
export const PARADE_GUARDS = 10;
export const PARADE_SIZE = PARADE_BAND + PARADE_GUARDS;
/** A marcher, as a solid circle. */
export const MARCHER_R = 0.45;

export interface Marcher {
  x: number;
  z: number;
  heading: number;
  band: boolean;
}

/** Out down one side of the route, round the far end, and back up the other side: total metres. */
const paradeLength = (path: readonly Spot[]) => 2 * pathLength(path) + Math.PI * PARADE_SIDE;
/** How long a parade lasts, in ticks: the last guard home again. */
export const paradeTicks = (path: readonly Spot[]): number =>
  Math.ceil(((paradeLength(path) + (PARADE_SIZE - 1) * PARADE_GAP) / PARADE_SPEED) * TPS);

/** Ticks into the current parade, or −1 when none is marching. */
export function paradeClock(tick: number, path: readonly Spot[]): number {
  const c = tick - PARADE_FIRST;
  if (c < 0) return -1;
  const p = mod(c, PARADE_EVERY);
  return p < paradeTicks(path) ? p : -1;
}

const P = { x: 0, z: 0, heading: 0 };

/** Where a marcher `u` metres along the parade's whole out-and-back walk stands. */
function paradePoint(path: readonly Spot[], u: number, out: { x: number; z: number; heading: number }): void {
  const L = pathLength(path);
  const S = PARADE_SIDE;
  if (u <= L) {
    alongPath(path, u, P);
    const nx = -Math.sin(P.heading);
    const nz = Math.cos(P.heading);
    out.x = P.x - nx * S;
    out.z = P.z - nz * S;
    out.heading = P.heading;
    return;
  }
  const turn = Math.PI * S;
  if (u <= L + turn) {
    alongPath(path, L, P);
    const tx = Math.cos(P.heading);
    const tz = Math.sin(P.heading);
    const nx = -tz;
    const nz = tx;
    const th = (u - L) / S;
    out.x = P.x + S * (-nx * Math.cos(th) + tx * Math.sin(th));
    out.z = P.z + S * (-nz * Math.cos(th) + tz * Math.sin(th));
    out.heading = Math.atan2(nz * Math.sin(th) + tz * Math.cos(th), nx * Math.sin(th) + tx * Math.cos(th));
    return;
  }
  alongPath(path, L - (u - L - turn), P);
  out.x = P.x - Math.sin(P.heading) * S;
  out.z = P.z + Math.cos(P.heading) * S;
  out.heading = P.heading + Math.PI;
}

/**
 * The marchers on the Mall at this tick: written into `out` (reused, grown as needed), returning how
 * many are out. Marchers still inside the Palace (not yet out) or home again are not listed.
 */
export function paradeAt(tick: number, path: readonly Spot[], out: Marcher[]): number {
  const p = paradeClock(tick, path);
  if (p < 0) return 0;
  const lead = (p / TPS) * PARADE_SPEED;
  const total = paradeLength(path);
  let n = 0;
  for (let i = 0; i < PARADE_SIZE; i++) {
    const u = lead - i * PARADE_GAP;
    if (u < 0 || u > total) continue;
    const m = out[n] ?? (out[n] = { x: 0, z: 0, heading: 0, band: false });
    paradePoint(path, u, m);
    m.band = i < PARADE_BAND;
    n++;
  }
  return n;
}

/** Confetti food drops behind the column every this many ticks... */
export const CONFETTI_EVERY = 2 * TPS;
/** ...this far behind the last guard (null when the tail is still inside the Palace, or none is due). */
export function confettiAt(tick: number, path: readonly Spot[], out: { x: number; z: number; heading: number }): boolean {
  const p = paradeClock(tick, path);
  if (p < 0 || p % CONFETTI_EVERY !== CONFETTI_EVERY / 2) return false;
  const tail = (p / TPS) * PARADE_SPEED - (PARADE_SIZE - 1) * PARADE_GAP - 1.6;
  if (tail < 0 || tail > paradeLength(path)) return false;
  paradePoint(path, tail, out);
  return true;
}

// ---------------------------------------------------------------- the river bus

/** Cruising speed (m/s) and how long it waits at each pier. */
export const BOAT_SPEED = 3;
export const BOAT_DOCK = 6 * TPS;
/** It calls Westminster → Bankside → Tower → Bankside → and home, round and round. */
const ROUND = [0, 1, 2, 1];

export interface Boat {
  x: number;
  z: number;
  heading: number;
  /** The pier it is tied up at (an index into the piers), or −1 under way. */
  dock: number;
  /** The pier it is making for next (the one after `dock` while docked). */
  next: number;
  /** While docked: ticks until it casts off. */
  leaveIn: number;
}

interface Timetable {
  legs: { from: number; to: number; s0: number; s1: number; sail: number }[];
  round: number;
}
const timetables = new WeakMap<SetPieceSpots, Timetable>();

function timetable(spots: SetPieceSpots): Timetable {
  let t = timetables.get(spots);
  if (!t) {
    const legs = ROUND.map((from, i) => {
      const to = ROUND[(i + 1) % ROUND.length];
      const s0 = projectOnPath(spots.river, spots.piers[from].at.x, spots.piers[from].at.z);
      const s1 = projectOnPath(spots.river, spots.piers[to].at.x, spots.piers[to].at.z);
      return { from, to, s0, s1, sail: Math.ceil((Math.abs(s1 - s0) / BOAT_SPEED) * TPS) };
    });
    t = { legs, round: legs.reduce((sum, l) => sum + BOAT_DOCK + l.sail, 0) };
    timetables.set(spots, t);
  }
  return t;
}

export function boatAt(tick: number, spots: SetPieceSpots, out: Boat): Boat {
  const tt = timetable(spots);
  let p = mod(tick, tt.round);
  for (const leg of tt.legs) {
    if (p < BOAT_DOCK) {
      alongPath(spots.river, leg.s0, P);
      out.x = P.x;
      out.z = P.z;
      out.heading = leg.s1 >= leg.s0 ? P.heading : P.heading + Math.PI;
      out.dock = leg.from;
      out.next = leg.to;
      out.leaveIn = BOAT_DOCK - p;
      return out;
    }
    p -= BOAT_DOCK;
    if (p < leg.sail) {
      const k = p / leg.sail;
      alongPath(spots.river, leg.s0 + (leg.s1 - leg.s0) * k, P);
      out.x = P.x;
      out.z = P.z;
      out.heading = leg.s1 >= leg.s0 ? P.heading : P.heading + Math.PI;
      out.dock = -1;
      out.next = leg.to;
      out.leaveIn = 0;
      return out;
    }
    p -= leg.sail;
  }
  return out; // unreachable: p < round
}

// ---------------------------------------------------------------- fireworks

/** A show every five minutes of the run, in its last half minute (runs have no end: this is the "hour"). */
export const FIREWORKS_EVERY = 300 * TPS;
export const FIREWORKS_FOR = 30 * TPS;
/** A rocket bursts every this many ticks through the show; the last few are the finale. */
export const BURST_EVERY = 90;
export const FINALE_BURSTS = 3;
const BURSTS = FIREWORKS_FOR / BURST_EVERY;

/** Ticks into the current show, or −1 when there is none. */
export function fireworksClock(tick: number): number {
  const p = mod(tick, FIREWORKS_EVERY) - (FIREWORKS_EVERY - FIREWORKS_FOR);
  return tick >= FIREWORKS_EVERY - FIREWORKS_FOR && p >= 0 ? p : -1;
}

export interface Burst {
  /** Its tick, which burst of the show it is, where (over the river), and whether it is the finale. */
  tick: number;
  k: number;
  x: number;
  z: number;
  finale: boolean;
  colour: number;
}

const BURST_COLOURS = [0xff4d6d, 0xffd84a, 0x4dabf7, 0x8be36a, 0xff9f1c, 0xc77dff, 0xffffff];

/** The k-th burst of the show running at `tick` (or null if there is no show / no such burst). */
export function burstOf(tick: number, k: number, spots: SetPieceSpots, seed: number, out: Burst): Burst | null {
  const p = fireworksClock(tick);
  if (p < 0 || k < 0 || k >= BURSTS) return null;
  const show = Math.floor(tick / FIREWORKS_EVERY);
  const i = mod(k * 7 + show * 3 + seed, spots.fireworks.length);
  out.tick = tick - p + k * BURST_EVERY + BURST_EVERY - 1;
  out.k = k;
  out.x = spots.fireworks[i].x;
  out.z = spots.fireworks[i].z;
  out.finale = k >= BURSTS - FINALE_BURSTS;
  out.colour = BURST_COLOURS[mod(k * 5 + show + seed, BURST_COLOURS.length)];
  return out;
}

/** If a rocket bursts on exactly this tick: which (else null). */
export function burstAt(tick: number, spots: SetPieceSpots, seed: number, out: Burst): Burst | null {
  const p = fireworksClock(tick);
  if (p < 0 || (p + 1) % BURST_EVERY !== 0) return null;
  return burstOf(tick, (p + 1) / BURST_EVERY - 1, spots, seed, out);
}

// ---------------------------------------------------------------- the Red Arrows

/** A rare fly-past: every six minutes, first at two and a half. */
export const ARROWS_FIRST = 150 * TPS;
export const ARROWS_EVERY = 360 * TPS;
export const ARROWS_FOR = 8 * TPS;
/** A snake this close under the lead jet's track as it passes gets the red-white-blue trail. */
export const ARROWS_REACH = 7;

export interface Arrows {
  /** The lead jet over the ground, the way it flies, and how far through the pass (0..1). */
  x: number;
  z: number;
  heading: number;
  t: number;
  /** Which line it flies (an index into spots.arrows), and where that line starts. */
  line: number;
  x0: number;
  z0: number;
}

export function arrowsAt(tick: number, spots: SetPieceSpots, seed: number, out: Arrows): boolean {
  const c = tick - ARROWS_FIRST;
  if (c < 0) return false;
  const p = mod(c, ARROWS_EVERY);
  if (p >= ARROWS_FOR) return false;
  const pass = Math.floor(c / ARROWS_EVERY);
  out.line = mod(pass + seed, spots.arrows.length);
  const [a, b] = spots.arrows[out.line];
  out.t = p / ARROWS_FOR;
  out.x0 = a.x;
  out.z0 = a.z;
  out.x = a.x + (b.x - a.x) * out.t;
  out.z = a.z + (b.z - a.z) * out.t;
  out.heading = Math.atan2(b.z - a.z, b.x - a.x);
  return true;
}

// ---------------------------------------------------------------- the wobbly bridge

/** The Millennium Bridge's sway: a lazy side-to-side push (m/s), a little more for a bigger snake. */
export const WOBBLE_SPEED = 0.45;
const WOBBLE_PERIOD = 1.7 * TPS;
/** The sideways push at this tick, −1..1 (the renderer sways the deck by the same clock). */
export const wobbleAt = (tick: number): number => Math.sin((tick / WOBBLE_PERIOD) * Math.PI * 2);

/** A per-room flavour number from the room's seed, without drawing from its RNG. */
export const setPieceSeedFor = (seed: number): number => (Math.imul(seed | 0, 2654435761) >>> 16) & 0xff;
