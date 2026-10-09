import type { Spot, Terrain, WaterZone } from './stage';

/**
 * Rivers (London's Thames). A point is in the water when it lies within half a ribbon's width of
 * its polyline and not on a bridge deck. Pure geometry with no RNG, so a stage without water never
 * takes any of these branches: the school and the Common play exactly as before.
 */

/** The nearest point on a ribbon's centre line to (x, z), written to `out`; returns the squared distance. */
function nearestOnPath(path: readonly Spot[], x: number, z: number, out: Spot): number {
  let best = Infinity;
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i];
    const b = path[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len2 = dx * dx + dz * dz;
    const t = len2 > 0 ? Math.min(1, Math.max(0, ((x - a.x) * dx + (z - a.z) * dz) / len2)) : 0;
    const qx = a.x + dx * t;
    const qz = a.z + dz * t;
    const d2 = (x - qx) ** 2 + (z - qz) ** 2;
    if (d2 < best) {
      best = d2;
      out.x = qx;
      out.z = qz;
    }
  }
  return best;
}

const q: Spot = { x: 0, z: 0 };

/** True when (x, z) stands on one of the terrain's bridge decks. */
export function onBridge(t: Terrain, x: number, z: number): boolean {
  if (!t.bridges) return false;
  for (const b of t.bridges) if (Math.abs(x - b.x) <= b.w / 2 && Math.abs(z - b.z) <= b.d / 2) return true;
  return false;
}

/**
 * The water zone (x, z) is swimming in, or null on dry land or a bridge. `margin` widens the
 * ribbon (a spawn wants some room from the bank).
 */
export function waterAt(t: Terrain, x: number, z: number, margin = 0): WaterZone | null {
  if (!t.water) return null;
  for (const w of t.water) {
    const r = w.width / 2 + margin;
    if (nearestOnPath(w.path, x, z, q) < r * r && !onBridge(t, x, z)) return w;
  }
  return null;
}

/** Is (x, z) in the water (and not on a bridge)? Always false on a stage without rivers. */
export function inWater(t: Terrain, x: number, z: number, margin = 0): boolean {
  return t.water !== undefined && waterAt(t, x, z, margin) !== null;
}

/** The unit direction from a river's centre line out toward its nearest bank, at (x, z). */
export function shoreNormal(w: WaterZone, x: number, z: number, out: Spot): Spot {
  nearestOnPath(w.path, x, z, q);
  const dx = x - q.x;
  const dz = z - q.z;
  const d = Math.hypot(dx, dz);
  out.x = d > 1e-6 ? dx / d : 0;
  out.z = d > 1e-6 ? dz / d : 1;
  return out;
}

/** Does the straight line from (ax, az) to (bx, bz) get wet anywhere? Sampled every 1.5 m. */
export function crossesWater(t: Terrain, ax: number, az: number, bx: number, bz: number): boolean {
  if (!t.water) return false;
  const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 1.5));
  for (let i = 0; i <= n; i++) {
    if (inWater(t, ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n)) return true;
  }
  return false;
}
