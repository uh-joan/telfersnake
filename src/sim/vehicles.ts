import { type Route, type Spot } from './stage';

/**
 * London's traffic: red double-decker buses and black cabs on fixed routes (docs/LEVEL3-LONDON.md
 * §5.2). They don't chase anyone. A vehicle is a moving wall that follows its lane round and round,
 * dwells at its stops, and brakes for any snake ahead of it (and always for one on a zebra crossing),
 * with a DING DING! or a honk as a warning. A snake that slithers into the side of a moving one is
 * bonked like a rock ("Mind the bus!"). No RNG at all: where every vehicle starts is a pure function
 * of its route, so a stage without routes never meets any of this.
 */

export const VEHICLE_KINDS = ['bus', 'cab'] as const;
export type VehicleKind = (typeof VEHICLE_KINDS)[number];

export interface VehicleSpec {
  /** Bumper to bumper, and side to side (metres). */
  length: number;
  width: number;
  /** Top speed, gentle acceleration, and the braking it plans with (m/s, m/s²). */
  cruise: number;
  accel: number;
  brake: number;
  /** Seconds it waits at each of its route's stops (cabs have none). */
  dwell: number;
  /** How far ahead it looks for snakes in its lane. */
  look: number;
  /** A hard hit: this share of the victim's mass, capped, like a rock. */
  bonkShare: number;
  bonkCap: number;
}

export const VEHICLES: Record<VehicleKind, VehicleSpec> = {
  bus: { length: 6, width: 2.2, cruise: 4, accel: 1.5, brake: 3, dwell: 3, look: 8, bonkShare: 0.12, bonkCap: 15 },
  cab: { length: 3.8, width: 1.8, cruise: 6, accel: 2.5, brake: 4.5, dwell: 0, look: 9, bonkShare: 0.08, bonkCap: 10 },
};

/** Keep left: the lane's centre sits this far left of the road's centre line (so two buses pass with room). */
export const LANE = 1.25;
/** Points per half-circle where a line turns round at its ends. */
const ARC_STEPS = 6;
/** How far along a lane a zebra crossing is watched, and how far short of it a vehicle waits. */
export const ZEBRA_WATCH = 14;
export const ZEBRA_HALF = 1.2;
const ZEBRA_STOP = 0.5;
/** Seconds between DING DINGs, and how long it waits for a snake before it honks. */
const DING_EVERY = 4;
const HONK_AFTER = 2.5;
/**
 * A snake that just will not move out of the road (never on a zebra: there it always waits):
 * after this long the vehicle inches forward at CREEP, nudging it aside. Slower than a bonk.
 */
const CREEP_AFTER = 2;
/** How far ahead a vehicle watches for Tower Bridge's stop line while the bridge is shut. */
const SPAN_WATCH = 30;
export const CREEP = 0.25;

export interface Vehicle {
  kind: VehicleKind;
  /** Index into the stage's routes. A client's stub has −1 until two snapshots have placed it. */
  route: number;
  /** Distance along the route's lane loop. */
  s: number;
  x: number;
  z: number;
  heading: number;
  speed: number;
  /** Seconds left waiting at a stop. */
  dwellFor: number;
  /** The next stop (an index into the route's stop distances). */
  nextStop: number;
  /** Cooldown on its DING DING, and how long a snake has kept it waiting. */
  dingIn: number;
  waitedFor: number;
}

/** A route made ready for driving: its lane's cumulative lengths, stops and zebras as distances. */
export interface Lane {
  route: Route;
  cum: number[];
  length: number;
  stops: number[];
  /** Zebra crossings on this lane, as distances along it (sorted). */
  zebras: number[];
  /** The zebras' centres, matching `zebras`. */
  zebraAt: Spot[];
}

/**
 * Turn a road's centre line into a closed lane loop: out along the left-hand side, round the far
 * end on a half-circle, back along the other side, round the start. A stop at centre-line vertex k
 * becomes two stops (one each way). Returns the loop and its stop indices.
 */
export function laneLoop(center: readonly Spot[], stopsAt: readonly number[], lane = LANE): { path: Spot[]; stops: number[] } {
  const n = center.length;
  const left = (a: Spot, b: Spot): Spot => {
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    return { x: (b.z - a.z) / len, z: -(b.x - a.x) / len };
  };
  /** The vertex offsets for a traversal of `pts`, mitred at the joints. */
  const offset = (pts: readonly Spot[]): Spot[] =>
    pts.map((p, i) => {
      const a = i > 0 ? left(pts[i - 1], p) : null;
      const b = i + 1 < pts.length ? left(p, pts[i + 1]) : null;
      if (!a || !b) {
        const m = (a ?? b)!;
        return { x: p.x + m.x * lane, z: p.z + m.z * lane };
      }
      let mx = a.x + b.x;
      let mz = a.z + b.z;
      const ml = Math.hypot(mx, mz) || 1;
      mx /= ml;
      mz /= ml;
      const k = lane / Math.max(0.5, mx * b.x + mz * b.z);
      return { x: p.x + mx * k, z: p.z + mz * k };
    });
  /** The half-circle round `c`, from just after `from` radians to just before from + π. */
  const turn = (c: Spot, from: number): Spot[] => {
    const out: Spot[] = [];
    for (let i = 1; i < ARC_STEPS; i++) {
      const t = from + (Math.PI * i) / ARC_STEPS;
      out.push({ x: c.x + Math.cos(t) * lane, z: c.z + Math.sin(t) * lane });
    }
    return out;
  };
  const back = [...center].reverse();
  const out = offset(center);
  const endDir = Math.atan2(center[n - 1].z - center[n - 2].z, center[n - 1].x - center[n - 2].x);
  const startDir = Math.atan2(back[n - 1].z - back[n - 2].z, back[n - 1].x - back[n - 2].x);
  const path = [...out, ...turn(center[n - 1], endDir - Math.PI / 2), ...offset(back), ...turn(center[0], startDir - Math.PI / 2)];
  const returnFrom = n + ARC_STEPS - 1;
  const stops = stopsAt.flatMap((k) => [k, returnFrom + (n - 1 - k)]).sort((a, b) => a - b);
  return { path, stops };
}

/** Distance from (x, z) to the nearest point of a closed loop. */
export function distanceToLoop(path: readonly Spot[], x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i < path.length; i++) {
    const a = path[i];
    const b = path[(i + 1) % path.length];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len2 = dx * dx + dz * dz;
    const t = len2 > 0 ? Math.min(1, Math.max(0, ((x - a.x) * dx + (z - a.z) * dz) / len2)) : 0;
    best = Math.min(best, Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
  }
  return best;
}

/** Ready a route for driving: lengths, stops, and which zebra crossings (centre + direction) it runs over. */
export function makeLane(route: Route, zebras: readonly (Spot & { angle: number })[]): Lane {
  const p = route.path;
  const cum = [0];
  for (let i = 0; i < p.length; i++) {
    const b = p[(i + 1) % p.length];
    cum.push(cum[i] + Math.hypot(b.x - p[i].x, b.z - p[i].z));
  }
  const length = cum[p.length];
  const stops = route.stops.map((i) => cum[i]);
  const found: { s: number; at: Spot }[] = [];
  for (const zb of zebras) {
    for (let i = 0; i < p.length; i++) {
      const a = p[i];
      const b = p[(i + 1) % p.length];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      if (len < 1e-6 || Math.abs((dx * Math.cos(zb.angle) + dz * Math.sin(zb.angle)) / len) < 0.9) continue;
      const t = ((zb.x - a.x) * dx + (zb.z - a.z) * dz) / (len * len);
      if (t < 0 || t > 1) continue;
      if (Math.hypot(zb.x - a.x - dx * t, zb.z - a.z - dz * t) > LANE + 0.3) continue;
      found.push({ s: cum[i] + t * len, at: { x: zb.x, z: zb.z } });
    }
  }
  found.sort((a, b) => a.s - b.s);
  return { route, cum, length, stops, zebras: found.map((f) => f.s), zebraAt: found.map((f) => f.at) };
}

const wrapS = (s: number, length: number) => ((s % length) + length) % length;

/** Where distance `s` along a lane is. */
export function pointAt(lane: Lane, s: number, out: Spot): Spot {
  const p = lane.route.path;
  s = wrapS(s, lane.length);
  let lo = 0;
  let hi = p.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lane.cum[mid] <= s) lo = mid;
    else hi = mid - 1;
  }
  const a = p[lo];
  const b = p[(lo + 1) % p.length];
  const seg = lane.cum[lo + 1] - lane.cum[lo];
  const t = seg > 0 ? (s - lane.cum[lo]) / seg : 0;
  out.x = a.x + (b.x - a.x) * t;
  out.z = a.z + (b.z - a.z) * t;
  return out;
}

const fore: Spot = { x: 0, z: 0 };
const aft: Spot = { x: 0, z: 0 };

/** Put a vehicle at distance `s` along its lane, facing along it (the chord across ±1.2 m, so corners turn smoothly). */
export function placeVehicle(v: Vehicle, lane: Lane, s: number): void {
  v.s = wrapS(s, lane.length);
  pointAt(lane, v.s, v);
  pointAt(lane, v.s + 1.2, fore);
  pointAt(lane, v.s - 1.2, aft);
  v.heading = Math.atan2(fore.z - aft.z, fore.x - aft.x);
}

/** The vehicles a stage's traffic list asks for, spread evenly round each route. No RNG. */
export function makeVehicles(traffic: readonly { kind: VehicleKind; route: string; count: number }[], routes: readonly Route[], lanes: readonly Lane[]): Vehicle[] {
  const out: Vehicle[] = [];
  for (const t of traffic) {
    const r = routes.findIndex((o) => o.id === t.route);
    if (r < 0) continue;
    const lane = lanes[r];
    for (let i = 0; i < t.count; i++) {
      const v: Vehicle = { kind: t.kind, route: r, s: 0, x: 0, z: 0, heading: 0, speed: 0, dwellFor: 0, nextStop: 0, dingIn: i * 1.3, waitedFor: 0 };
      placeVehicle(v, lane, (lane.length * (i + 0.25)) / t.count); // a quarter in: never two side by side on an out-and-back line
      v.nextStop = nextStopIndex(lane, v.s);
      out.push(v);
    }
  }
  return out;
}

/** The first stop at or after `s` (wrapping round). */
function nextStopIndex(lane: Lane, s: number): number {
  const i = lane.stops.findIndex((d) => d >= s);
  return i < 0 ? 0 : i;
}

/** A vehicle stub for the client to fill from snapshots. `route` is −1 (not drawn) until it has been placed. */
export function blankVehicle(kind: VehicleKind): Vehicle {
  return { kind, route: -1, s: 0, x: 0, z: 0, heading: 0, speed: 0, dwellFor: 0, nextStop: 0, dingIn: 0, waitedFor: 0 };
}

/** Distance along the lane from `from` forward to `to` (0..length). */
export const ahead = (lane: Lane, from: number, to: number) => wrapS(to - from, lane.length);

/** Where a point is in a vehicle's own frame: `f` forward of its centre, `l` to its left. */
export function local(v: { x: number; z: number; heading: number }, x: number, z: number, out: { f: number; l: number }): { f: number; l: number } {
  const c = Math.cos(v.heading);
  const s = Math.sin(v.heading);
  const dx = x - v.x;
  const dz = z - v.z;
  out.f = dx * c + dz * s;
  out.l = dx * s - dz * c;
  return out;
}

/** A body to steer round: anything with a position and a radius (a snake's head or one of its segments). */
export interface Walker {
  x: number;
  z: number;
  r: number;
}

/** Is any of the walkers on the zebra crossing at `at` (any part of it)? */
export function zebraBusy(at: Spot, walkers: readonly Walker[], halfWidth: number): boolean {
  for (const w of walkers) {
    const reach = Math.max(ZEBRA_HALF, halfWidth) + w.r;
    if (Math.abs(w.x - at.x) < reach && Math.abs(w.z - at.z) < reach && Math.hypot(w.x - at.x, w.z - at.z) < reach) return true;
  }
  return false;
}

/**
 * The gap (metres) a vehicle has before the nearest occupied zebra crossing ahead of its front
 * bumper, or Infinity. Used by the sim and by sim-check, so both mean the same thing by "ahead".
 */
export function zebraGap(v: Vehicle, lane: Lane, walkers: readonly Walker[], roadHalf: number): number {
  const spec = VEHICLES[v.kind];
  const front = v.s + spec.length / 2;
  let best = Infinity;
  for (let i = 0; i < lane.zebras.length; i++) {
    const d = ahead(lane, front, lane.zebras[i] - ZEBRA_HALF - ZEBRA_STOP);
    if (d > ZEBRA_WATCH || d >= best) continue;
    if (zebraBusy(lane.zebraAt[i], walkers, roadHalf)) best = d;
  }
  return best;
}

const loc = { f: 0, l: 0 };

export interface TrafficEvents {
  ding(v: Vehicle, honk: boolean): void;
}

/**
 * One tick for one vehicle: pick a target speed from what is ahead (a stop, the vehicle in front,
 * a snake in the lane, a busy zebra), then roll forward, never further than the nearest obstacle.
 */
export function driveVehicle(
  v: Vehicle, lane: Lane, others: readonly Vehicle[], walkers: readonly Walker[], dt: number, events: TrafficEvents, stops?: readonly number[],
): void {
  const spec = VEHICLES[v.kind];
  v.dingIn -= dt;
  let gap = Infinity;

  // London's Tower Bridge, shut for a lift: pull up short of the span (a vehicle already past the line rolls on).
  if (stops) {
    const front = v.s + spec.length / 2;
    for (const line of stops) {
      const d = ahead(lane, front, line);
      if (d < SPAN_WATCH) gap = Math.min(gap, d);
    }
  }

  // A stop: pull up exactly at it, wait, then set off for the next one.
  if (spec.dwell > 0 && lane.stops.length > 0) {
    if (v.dwellFor > 0) {
      v.dwellFor -= dt;
      gap = 0;
      if (v.dwellFor <= 0) v.nextStop = (v.nextStop + 1) % lane.stops.length;
    } else {
      const d = ahead(lane, v.s, lane.stops[v.nextStop]);
      if (d < 0.05 || d > lane.length - 0.05) {
        v.dwellFor = spec.dwell;
        gap = 0;
      } else {
        gap = d;
      }
    }
  }

  // The vehicle in front, on the same lane: keep a car's length.
  for (const o of others) {
    if (o === v || o.route !== v.route) continue;
    const d = ahead(lane, v.s, o.s) - (spec.length + VEHICLES[o.kind].length) / 2 - 1.5;
    if (d < gap) gap = Math.max(0, d);
  }

  // A snake ahead in the lane (head or any body segment).
  let snakeGap = Infinity;
  const half = spec.width / 2;
  for (const w of walkers) {
    local(v, w.x, w.z, loc);
    const f = loc.f - spec.length / 2;
    if (f < -0.3 || f > spec.look || Math.abs(loc.l) > half + w.r + 0.3) continue;
    snakeGap = Math.min(snakeGap, Math.max(0, f - w.r - 0.5));
  }
  // And a zebra crossing with anyone on it: always stop short of it.
  const zg = zebraGap(v, lane, walkers, 2);
  const blocked = Math.min(snakeGap, zg);
  // Kept waiting by a snake in the lane (not on a zebra, not by a stop or the vehicle in front):
  // inch on and nudge it, so nobody is stuck in front of a bus for ever.
  const creep = zg === Infinity && snakeGap < gap && v.waitedFor > CREEP_AFTER;
  if (blocked < gap && !creep) gap = blocked;

  if (blocked < Infinity) {
    if (v.speed <= CREEP) v.waitedFor += dt;
    if (v.dingIn <= 0) {
      v.dingIn = DING_EVERY;
      events.ding(v, v.kind === 'cab' || v.waitedFor > HONK_AFTER);
    }
  } else {
    v.waitedFor = 0;
  }

  // Plan to stop at the gap; brake at once if that is closer than planned, never roll past it.
  const want = creep ? Math.min(CREEP, Math.sqrt(2 * spec.brake * Math.max(0, gap))) : Math.min(spec.cruise, Math.sqrt(2 * spec.brake * Math.max(0, gap)));
  v.speed = Math.min(want, v.speed + spec.accel * dt);
  if (gap < 0.05 && v.speed < 0.1) v.speed = 0; // pulled up: stop dead rather than creep the last millimetres
  const step = Math.min(v.speed * dt, Math.max(0, gap));
  if (step <= 0) v.speed = 0;
  placeVehicle(v, lane, v.s + step);
}
