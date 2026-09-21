import { BOUNDS, SOLID_BOXES, SOLID_CIRCLES, type Circle } from './layout';

export interface Hit {
  x: number;
  z: number;
  nx: number;
  nz: number;
  hit: boolean;
}

export function makeHit(): Hit {
  return { x: 0, z: 0, nx: 0, nz: 0, hit: false };
}

const NO_CIRCLES: readonly Circle[] = [];

/**
 * Push a circle out of every solid and back inside the fence.
 * `out` carries the corrected position and the combined normal of the surfaces touched.
 * `extra` adds per-world solids (rocks and the like) on top of the fixed school layout.
 */
export function resolveCircle(px: number, pz: number, r: number, out: Hit, extra: readonly Circle[] = NO_CIRCLES): Hit {
  out.hit = false;
  out.nx = 0;
  out.nz = 0;
  // Sum of every surface normal touched, so an inside corner reports its diagonal.
  let sx = 0;
  let sz = 0;

  // Two passes over the boxes: where buildings abut, leaving one can push the circle into
  // its neighbour. Normals are only collected on the first pass so no wall counts twice.
  for (let sweep = 0; sweep < 2; sweep++) {
    let moved = false;
    for (const b of SOLID_BOXES) {
      const minX = b.x - b.w / 2;
      const maxX = b.x + b.w / 2;
      const minZ = b.z - b.d / 2;
      const maxZ = b.z + b.d / 2;
      const cx = Math.min(Math.max(px, minX), maxX);
      const cz = Math.min(Math.max(pz, minZ), maxZ);
      const dx = px - cx;
      const dz = pz - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;

      out.hit = true;
      if (d2 > 1e-10) {
        const d = Math.sqrt(d2);
        out.nx = dx / d;
        out.nz = dz / d;
        px = cx + out.nx * r;
        pz = cz + out.nz * r;
      } else {
        // Centre is inside the box: leave through the nearest face.
        const toMinX = px - minX;
        const toMaxX = maxX - px;
        const toMinZ = pz - minZ;
        const toMaxZ = maxZ - pz;
        const m = Math.min(toMinX, toMaxX, toMinZ, toMaxZ);
        out.nx = 0;
        out.nz = 0;
        if (m === toMinX) { px = minX - r; out.nx = -1; }
        else if (m === toMaxX) { px = maxX + r; out.nx = 1; }
        else if (m === toMinZ) { pz = minZ - r; out.nz = -1; }
        else { pz = maxZ + r; out.nz = 1; }
      }
      moved = true;
      if (sweep === 0) {
        sx += out.nx;
        sz += out.nz;
      }
    }
    if (!moved) break;
  }

  for (let pass = 0; pass < 2; pass++) {
    for (const c of pass === 0 ? SOLID_CIRCLES : extra) {
      const dx = px - c.x;
      const dz = pz - c.z;
      const rr = r + c.r;
      const d2 = dx * dx + dz * dz;
      if (d2 >= rr * rr) continue;
      out.hit = true;
      const d = Math.sqrt(d2);
      out.nx = d > 1e-5 ? dx / d : 1;
      out.nz = d > 1e-5 ? dz / d : 0;
      px = c.x + out.nx * rr;
      pz = c.z + out.nz * rr;
      sx += out.nx;
      sz += out.nz;
    }
  }

  if (px < BOUNDS.minX + r) { px = BOUNDS.minX + r; out.hit = true; out.nx = 1; out.nz = 0; sx += 1; }
  if (px > BOUNDS.maxX - r) { px = BOUNDS.maxX - r; out.hit = true; out.nx = -1; out.nz = 0; sx -= 1; }
  if (pz < BOUNDS.minZ + r) { pz = BOUNDS.minZ + r; out.hit = true; out.nx = 0; out.nz = 1; sz += 1; }
  if (pz > BOUNDS.maxZ - r) { pz = BOUNDS.maxZ - r; out.hit = true; out.nx = 0; out.nz = -1; sz -= 1; }

  // Opposing walls (a tight gap) cancel out; keep the last single normal in that case.
  const len = Math.hypot(sx, sz);
  if (len > 0.1) {
    out.nx = sx / len;
    out.nz = sz / len;
  }

  out.x = px;
  out.z = pz;
  return out;
}

/** True when a circle of radius `margin` at (x, z) touches nothing solid and is inside the fence. */
export function isFree(x: number, z: number, margin: number, extra: readonly Circle[] = NO_CIRCLES): boolean {
  if (x < BOUNDS.minX + margin || x > BOUNDS.maxX - margin) return false;
  if (z < BOUNDS.minZ + margin || z > BOUNDS.maxZ - margin) return false;
  for (const b of SOLID_BOXES) {
    if (Math.abs(x - b.x) < b.w / 2 + margin && Math.abs(z - b.z) < b.d / 2 + margin) return false;
  }
  for (let pass = 0; pass < 2; pass++) {
    for (const c of pass === 0 ? SOLID_CIRCLES : extra) {
      const rr = c.r + margin;
      if ((x - c.x) ** 2 + (z - c.z) ** 2 < rr * rr) return false;
    }
  }
  return true;
}

export function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Rotate `from` toward `to` by at most `maxStep` radians. */
export function turnToward(from: number, to: number, maxStep: number): number {
  const diff = wrapAngle(to - from);
  return wrapAngle(from + Math.min(Math.max(diff, -maxStep), maxStep));
}

/**
 * Heading that runs along a surface with normal (nx, nz), keeping whatever sideways motion
 * `heading` already has. Returns `heading` unchanged when it is not pointing into the surface.
 */
export function slideAlong(heading: number, nx: number, nz: number): number {
  const dx = Math.cos(heading);
  const dz = Math.sin(heading);
  const into = dx * nx + dz * nz;
  if (into >= 0) return heading;
  const tx = dx - into * nx;
  const tz = dz - into * nz;
  if (tx * tx + tz * tz < 1e-8) return Math.atan2(nx, -nz); // head-on: go clockwise
  return Math.atan2(tz, tx);
}
