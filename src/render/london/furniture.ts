import * as THREE from 'three';
import { HYDE_PARK, LONDON, LONDON_BOUNDS, ROADS, SERPENTINE, SOUTH_BANK, ST_JAMES, type Road } from '../../sim/londonLayout';
import type { Box } from '../../sim/layout';
import { Rng } from '../../sim/rng';
import { clearOfSights, COMPASS, distanceToPath, MARGIN, ST_JAMES_LAKE, ZEBRAS } from './ground';
import { box, cone, cyl, inkMaterial, merge, outlineGeometry, PALETTE, sphere, toonMaterial } from './landmarks/kit';

/**
 * Street furniture: lamp posts, park railings, red phone boxes and postboxes, bus shelters, Belisha
 * beacons at the zebras, benches, plane trees and the Union Jack bunting round the edge of the map.
 * All scenery (nothing collides), one InstancedMesh per kind plus its instanced ink outline, placed
 * at the roadsides and in the parks, never in the river or on a landmark.
 */

interface Place {
  x: number;
  z: number;
  rot?: number;
  s?: number;
}

const B = LONDON_BOUNDS;

/** Somewhere a prop can stand: on the map, dry, off the bridges and the sights' footprints, off the streets. */
function free(x: number, z: number, margin = 0.8): boolean {
  if (x < B.minX + 1 || x > B.maxX - 1 || z < B.minZ + 1 || z > B.maxZ - 1) return false;
  if (!clearOfSights(x, z, margin)) return false;
  if (Math.abs(x - COMPASS.x) < 6.5 && Math.abs(z - COMPASS.z) < 6) return false; // the compass rose's square
  for (const b of [...LONDON.solidBoxes, ...(LONDON.bridges ?? [])]) {
    if (Math.abs(x - b.x) < b.w / 2 + margin && Math.abs(z - b.z) < b.d / 2 + margin) return false;
  }
  for (const c of LONDON.solidCircles) if (Math.hypot(x - c.x, z - c.z) < c.r + margin) return false;
  return true;
}
const offStreet = (x: number, z: number) => ROADS.every((r) => distanceToPath(r.path, x, z) > r.width / 2 + 0.3);
const inEllipse = (x: number, z: number, e: { x: number; z: number; rx: number; rz: number; rot: number }, pad: number) => {
  const dx = x - e.x;
  const dz = z - e.z;
  const u = dx * Math.cos(e.rot) + dz * Math.sin(e.rot);
  const v = -dx * Math.sin(e.rot) + dz * Math.cos(e.rot);
  return (u / (e.rx + pad)) ** 2 + (v / (e.rz + pad)) ** 2 < 1;
};

/** One kind of prop, instanced, with its outline sharing the same instance matrices. */
function instanced(geom: THREE.BufferGeometry, places: readonly Place[], outline = 0.04, castShadow = true): THREE.Group {
  const g = new THREE.Group();
  if (places.length === 0) return g;
  const mesh = new THREE.InstancedMesh(geom, toonMaterial(), places.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  places.forEach((pl, i) => {
    q.setFromAxisAngle(up, pl.rot ?? 0);
    m.compose(p.set(pl.x, 0, pl.z), q, s.setScalar(pl.s ?? 1));
    mesh.setMatrixAt(i, m);
  });
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  g.add(mesh);
  if (outline > 0) {
    const hull = new THREE.InstancedMesh(outlineGeometry(geom, outline), inkMaterial(), places.length);
    hull.instanceMatrix = mesh.instanceMatrix;
    hull.computeBoundingSphere();
    g.add(hull);
  }
  return g;
}

/** A point at fraction t along a road segment, pushed `side` metres to its left (+) or right (−). */
function roadside(r: Road, seg: number, t: number, side: number): Place & { angle: number } {
  const a = r.path[seg];
  const b = r.path[seg + 1];
  const angle = Math.atan2(b.z - a.z, b.x - a.x);
  const off = Math.sign(side) * (r.width / 2 + Math.abs(side));
  return {
    x: a.x + (b.x - a.x) * t - Math.sin(angle) * off,
    z: a.z + (b.z - a.z) * t + Math.cos(angle) * off,
    // Local +x along the road, local +z toward the road.
    rot: -angle + (side > 0 ? Math.PI : 0),
    angle,
  };
}

// ---------------------------------------------------------------- the models (local: stand on y = 0, front faces +z)

const lampPost = () => merge([
  cyl(0.07, 0.1, 2.6, 0x1d2a24, 0, 0, 0, 6),
  box(0.34, 0.42, 0.34, 0xfff2b8, 0, 2.6, 0),
  cone(0.3, 0.3, 0x1d2a24, 0, 3.02, 0, 4),
]);

const railingPanel = () => {
  const parts = [box(2, 0.06, 0.06, 0x1b1b1f, 0, 0.18, 0), box(2, 0.06, 0.06, 0x1b1b1f, 0, 0.72, 0)];
  for (let x = -0.9; x <= 0.9; x += 0.3) parts.push(box(0.05, 0.8, 0.05, 0x1b1b1f, x, 0, 0), cone(0.05, 0.14, PALETTE.gold, x, 0.8, 0, 4));
  return merge(parts);
};

const phoneBox = () => merge([
  box(1, 2.3, 1, PALETTE.busRed),
  box(1.1, 0.2, 1.1, PALETTE.busRed, 0, 2.3, 0),
  sphere(0.55, PALETTE.busRed, 0, 2.5, 0, 8, 4, Math.PI * 2, Math.PI / 2),
  box(0.8, 0.18, 0.04, PALETTE.white, 0, 2.05, 0.5), // the TELEPHONE sign
  box(0.7, 1.3, 0.04, 0xbfe3f5, 0, 0.6, 0.5),
]);

const postbox = () => merge([
  cyl(0.32, 0.32, 1.2, PALETTE.busRed, 0, 0, 0, 12),
  sphere(0.32, PALETTE.busRed, 0, 1.2, 0, 12, 4, Math.PI * 2, Math.PI / 2),
  box(0.36, 0.06, 0.06, PALETTE.ink, 0, 0.95, 0.3), // the slot
  box(0.72, 0.1, 0.72, 0x1d1d1d),
]);

const busShelter = () => merge([
  box(3, 0.1, 1.3, PALETTE.slate, 0, 2.3, 0),
  box(0.08, 2.3, 0.08, PALETTE.slate, -1.45, 0, -0.55),
  box(0.08, 2.3, 0.08, PALETTE.slate, 1.45, 0, -0.55),
  box(2.9, 1.8, 0.05, 0xcfe9ee, 0, 0.4, -0.6),
  box(1.6, 0.3, 0.4, 0x8a5a3a, 0, 0.45, -0.35), // the bench
  cyl(0.05, 0.05, 2.6, PALETTE.slate, 1.9, 0, 0.4, 6),
  cyl(0.32, 0.32, 0.08, PALETTE.busRed, 0, -0.04, 0, 16).rotateX(Math.PI / 2).translate(1.9, 2.6, 0.4), // the roundel
]);

const belisha = () => {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) parts.push(cyl(0.06, 0.06, 0.3, i % 2 ? PALETTE.white : PALETTE.ink, 0, i * 0.3, 0, 6));
  parts.push(sphere(0.22, 0xffa51f, 0, 2.0, 0, 10, 8));
  return merge(parts);
};

const bench = () => merge([
  box(1.8, 0.08, 0.5, 0x9a6a3a, 0, 0.42, 0),
  box(1.8, 0.4, 0.08, 0x9a6a3a, 0, 0.55, -0.25),
  box(0.08, 0.42, 0.5, 0x1d1d1d, -0.8, 0, 0),
  box(0.08, 0.42, 0.5, 0x1d1d1d, 0.8, 0, 0),
]);

const planeTree = () => merge([
  cyl(0.16, 0.24, 1.6, 0x7a5a3a, 0, 0, 0, 6),
  sphere(1.25, 0x4f9a3e, 0, 2.5, 0, 10, 7),
  sphere(0.8, 0x6dbb4f, 0.35, 2.9, 0.35, 8, 6),
]);

const buntingPost = () => merge([cyl(0.06, 0.08, 2.4, 0xf5f0e0, 0, 0, 0, 6), sphere(0.1, PALETTE.gold, 0, 2.45, 0, 6, 4)]);

/** A little Union Jack, for the bunting. */
function unionJack(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 96;
  cv.height = 64;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#012169';
  c.fillRect(0, 0, 96, 64);
  const diag = (w: number, color: string) => {
    c.strokeStyle = color;
    c.lineWidth = w;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(96, 64);
    c.moveTo(96, 0);
    c.lineTo(0, 64);
    c.stroke();
  };
  diag(13, '#ffffff');
  diag(5, '#c8102e');
  c.fillStyle = '#ffffff';
  c.fillRect(38, 0, 20, 64);
  c.fillRect(0, 22, 96, 20);
  c.fillStyle = '#c8102e';
  c.fillRect(42, 0, 12, 64);
  c.fillRect(0, 26, 96, 12);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Bunting strung between posts all round the map's printed border. */
function bunting(): THREE.Group {
  const g = new THREE.Group();
  const o = MARGIN / 2; // halfway across the margin
  const corners = [
    { x: B.minX - o, z: B.minZ - o }, { x: B.maxX + o, z: B.minZ - o },
    { x: B.maxX + o, z: B.maxZ + o }, { x: B.minX - o, z: B.maxZ + o },
  ];
  const posts: Place[] = [];
  const flags: { x: number; y: number; z: number; rot: number }[] = [];
  const line: number[] = [];
  for (let k = 0; k < 4; k++) {
    const a = corners[k];
    const b = corners[(k + 1) % 4];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const spans = Math.round(len / 10);
    const rot = -Math.atan2(b.z - a.z, b.x - a.x);
    for (let s = 0; s < spans; s++) {
      const t0 = s / spans;
      const t1 = (s + 1) / spans;
      posts.push({ x: a.x + (b.x - a.x) * t0, z: a.z + (b.z - a.z) * t0 });
      const sag = (t: number) => 2.25 - 0.55 * Math.sin(Math.PI * t);
      const n = 10;
      for (let i = 0; i <= n; i++) {
        const t = t0 + ((t1 - t0) * i) / n;
        const y = sag(i / n);
        const p = [a.x + (b.x - a.x) * t, y, a.z + (b.z - a.z) * t];
        if (i > 0) line.push(...p);
        if (i < n) line.push(...p);
        if (i > 0 && i < n) flags.push({ x: p[0], y, z: p[2], rot });
      }
    }
  }
  g.add(instanced(buntingPost(), posts, 0.03));
  const strings = new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(line, 3)),
    new THREE.LineBasicMaterial({ color: PALETTE.ink }),
  );
  const flagGeo = new THREE.PlaneGeometry(0.62, 0.42).translate(0, -0.21, 0);
  const flagMesh = new THREE.InstancedMesh(flagGeo, new THREE.MeshLambertMaterial({ map: unionJack(), side: THREE.DoubleSide }), flags.length);
  const m = new THREE.Matrix4();
  const e = new THREE.Euler();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const p = new THREE.Vector3();
  flags.forEach((f, i) => {
    q.setFromEuler(e.set(0, f.rot, ((i % 3) - 1) * 0.08));
    m.compose(p.set(f.x, f.y, f.z), q, one);
    flagMesh.setMatrixAt(i, m);
  });
  flagMesh.computeBoundingSphere();
  g.add(strings, flagMesh);
  return g;
}

/** Scatter trees and benches over a park, off its lakes and paths' worst spots. */
function inPark(rng: Rng, p: Box, n: number, pad: number): Place[] {
  const out: Place[] = [];
  for (let tries = 0; out.length < n && tries < n * 20; tries++) {
    const x = rng.range(p.x - p.w / 2 + pad, p.x + p.w / 2 - pad);
    const z = rng.range(p.z - p.d / 2 + pad, p.z + p.d / 2 - pad);
    if (inEllipse(x, z, SERPENTINE, 2) || inEllipse(x, z, ST_JAMES_LAKE, 2)) continue;
    if (!free(x, z, 1.5) || !offStreet(x, z)) continue;
    if (out.some((o) => Math.hypot(o.x - x, o.z - z) < 3.2)) continue;
    out.push({ x, z, rot: rng.range(0, Math.PI * 2), s: rng.range(0.85, 1.2) });
  }
  return out;
}

/** Railing panels round a park's edge, with gates wherever a street meets it and every so often. */
function railings(p: Box): Place[] {
  const out: Place[] = [];
  const sides = [
    { x0: p.x - p.w / 2, z0: p.z - p.d / 2, dx: 1, dz: 0, len: p.w },
    { x0: p.x + p.w / 2, z0: p.z - p.d / 2, dx: 0, dz: 1, len: p.d },
    { x0: p.x + p.w / 2, z0: p.z + p.d / 2, dx: -1, dz: 0, len: p.w },
    { x0: p.x - p.w / 2, z0: p.z + p.d / 2, dx: 0, dz: -1, len: p.d },
  ];
  for (const s of sides) {
    const n = Math.floor(s.len / 2);
    for (let i = 0; i < n; i++) {
      if (i % 6 === 3) continue; // a gate
      const t = (i + 0.5) * (s.len / n);
      const x = s.x0 + s.dx * t + -s.dz * 0.4;
      const z = s.z0 + s.dz * t + s.dx * 0.4;
      if (!offStreet(x, z) || !free(x, z, 0.3)) continue;
      out.push({ x, z, rot: -Math.atan2(s.dz, s.dx) });
    }
  }
  return out;
}

export function makeFurniture(): THREE.Group {
  const rng = new Rng(1851);
  const g = new THREE.Group();

  const lamps: Place[] = [];
  for (const r of ROADS) {
    for (let seg = 0; seg + 1 < r.path.length; seg++) {
      const a = r.path[seg];
      const b = r.path[seg + 1];
      const n = Math.floor(Math.hypot(b.x - a.x, b.z - a.z) / 9);
      for (let i = 0; i < n; i++) {
        const p = roadside(r, seg, (i + 0.5) / n, (i + seg) % 2 ? 0.5 : -0.5);
        if (free(p.x, p.z, 0.6)) lamps.push(p);
      }
    }
  }

  const phones: Place[] = [];
  const posts: Place[] = [];
  const shelters: Place[] = [];
  for (const r of ROADS) {
    const last = r.path.length - 2;
    const ph = roadside(r, 0, 0.3, 1.1);
    if (free(ph.x, ph.z, 1) && offStreet(ph.x, ph.z)) phones.push(ph);
    const pb = roadside(r, last, 0.7, -0.8);
    if (free(pb.x, pb.z, 1) && offStreet(pb.x, pb.z)) posts.push(pb);
    if (['strand', 'embankment', 'borough', 'southbank', 'kensington'].includes(r.id)) {
      const bs = roadside(r, Math.min(1, last), 0.25, 1.3);
      if (free(bs.x, bs.z, 1.5) && offStreet(bs.x, bs.z)) shelters.push(bs);
    }
  }

  const beacons: Place[] = [];
  for (const zb of ZEBRAS) {
    for (const s of [-1, 1]) {
      for (const along of [-1.4, 1.4]) {
        const off = s * (zb.width / 2 + 0.4);
        beacons.push({
          x: zb.x + Math.cos(zb.angle) * along - Math.sin(zb.angle) * off,
          z: zb.z + Math.sin(zb.angle) * along + Math.cos(zb.angle) * off,
        });
      }
    }
  }

  const trees = [...inPark(rng, HYDE_PARK, 34, 2), ...inPark(rng, ST_JAMES, 7, 1.5), ...inPark(rng, SOUTH_BANK, 8, 1.5)];
  // A line of plane trees along the Embankment's river side, as in real life.
  const emb = ROADS.find((r) => r.id === 'embankment')!;
  for (let seg = 0; seg + 1 < emb.path.length; seg++) {
    for (let t = 0.15; t < 1; t += 0.35) {
      const p = roadside(emb, seg, t, -1.6);
      if (free(p.x, p.z, 0.5) && offStreet(p.x, p.z)) trees.push({ ...p, s: 0.9 });
    }
  }
  const benches = inPark(rng, HYDE_PARK, 6, 3).concat(inPark(rng, ST_JAMES, 2, 2), inPark(rng, SOUTH_BANK, 4, 2));
  for (let seg = 0; seg + 1 < emb.path.length; seg++) {
    const p = roadside(emb, seg, 0.5, -0.7);
    if (free(p.x, p.z, 0.5)) benches.push(p);
  }

  g.add(
    instanced(lampPost(), lamps),
    instanced(railingPanel(), [...railings(HYDE_PARK), ...railings(ST_JAMES)], 0.025, false),
    instanced(phoneBox(), phones),
    instanced(postbox(), posts),
    instanced(busShelter(), shelters),
    instanced(belisha(), beacons, 0.03),
    instanced(bench(), benches, 0.03),
    instanced(planeTree(), trees, 0.06),
    bunting(),
  );
  return g;
}
