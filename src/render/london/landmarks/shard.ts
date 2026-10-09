import * as THREE from 'three';
import { SHARD } from '../../../sim/londonLayout';
import { box, cyl, inked, PALETTE, sphere, type LandmarkBuild } from './kit';

/**
 * The Shard: a glass spike, the tallest thing on the map. Eight leaning glass shards (two per side,
 * one stepped proud of the other) climb toward the sky and never quite meet, so the tip is a jagged
 * open crown. Pale sky-blue glass, lighter reflection streaks, fine white floor lines and a few lit
 * windows. Alive: a band of sky reflection keeps sliding up the glass, and a red light blinks on top.
 */

const H = 28; // the tallest shard's top
const HALF = SHARD.w / 2 + 0.4; // the base square's half-width (the solid footprint, plus a little flare)
const ROWS = 20; // floors
const COLS = 3; // streak columns across each shard

const GLASS = PALETTE.glassBlue;
const GLASS_DEEP = 0x74b4dc; // every other shard a shade deeper, so each reads on its own
const STREAK = 0xc4e6f7;
const LINE = 0xf4fbff;
const LIT = 0xffe39a;
const INSIDE = 0x4f7f9c; // the shards' backs, seen through the open tip

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _n = new THREE.Vector3(); // the shard's outward direction

/** A kit-shaped geometry from a flat list of triangles (non-indexed, faceted normals, per-vertex colour). */
function fromTriangles(pos: number[], col: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * One shard: a thick leaning glass slab. Its outer face runs from a bottom edge (b0 → b1) on the
 * ground to a short top edge (t0 → t1) high up near the axis; `out` is its outward direction.
 */
function shard(
  b0: THREE.Vector3, b1: THREE.Vector3, t0: THREE.Vector3, t1: THREE.Vector3, out: THREE.Vector3, seed: number,
): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const c = new THREE.Color();
  const tri = (p: THREE.Vector3[], hex: number) => {
    c.setHex(hex);
    for (const v of p) { pos.push(v.x, v.y, v.z); col.push(c.r, c.g, c.b); }
  };
  const quad = (p00: THREE.Vector3, p10: THREE.Vector3, p11: THREE.Vector3, p01: THREE.Vector3, hex: number) => {
    tri([p00, p10, p11], hex);
    tri([p00, p11, p01], hex);
  };
  // The outer face's point at (u across, v up).
  const at = (u: number, v: number) => {
    _a.lerpVectors(b0, b1, u);
    _b.lerpVectors(t0, t1, u);
    return new THREE.Vector3().lerpVectors(_a, _b, v);
  };
  // Inward offset: horizontal, toward the axis, shrinking a little with height.
  _n.copy(out);
  const thick = 0.6;
  const inner = (p: THREE.Vector3, v: number) => p.clone().addScaledVector(_n, -thick * (1 - v * 0.6));

  // Outer face: floors (a glass band then a thin white line), split into streak columns.
  const lineFrac = 0.1;
  for (let r = 0; r < ROWS; r++) {
    const v0 = r / ROWS;
    const vl = (r + 1 - lineFrac) / ROWS;
    const v1 = (r + 1) / ROWS;
    for (let k = 0; k < COLS; k++) {
      const u0 = k / COLS;
      const u1 = (k + 1) / COLS;
      // A reflection streak runs diagonally up each shard; a few windows glow warm low down.
      const streak = (k + r + seed) % 5 === 0 || (k * 2 + r * 3 + seed) % 11 === 0;
      const lit = r < ROWS * 0.6 && (r * 7 + k * 5 + seed * 3) % 23 === 0;
      const hex = lit ? LIT : streak ? STREAK : seed % 2 ? GLASS_DEEP : GLASS;
      quad(at(u0, v0), at(u1, v0), at(u1, vl), at(u0, vl), hex);
      quad(at(u0, vl), at(u1, vl), at(u1, v1), at(u0, v1), LINE);
    }
  }
  // Back face (seen through the crown), the two sides and the top lip.
  const o00 = at(0, 0), o10 = at(1, 0), o01 = at(0, 1), o11 = at(1, 1);
  const i00 = inner(o00, 0), i10 = inner(o10, 0), i01 = inner(o01, 1), i11 = inner(o11, 1);
  quad(i10, i00, i01, i11, INSIDE);
  quad(i00, o00, o01, i01, GLASS);
  quad(o10, i10, i11, o11, GLASS);
  quad(o01, o11, i11, i01, LINE);
  return fromTriangles(pos, col);
}

export function build(): LandmarkBuild {
  const group = new THREE.Group();
  const parts: THREE.BufferGeometry[] = [];

  // Two shards per side of the square base. Going round anticlockwise (seen from above), each side
  // is split at a stagger: its first shard sits flush, the second steps 0.35 m proud and climbs higher.
  const sides = [
    { dir: new THREE.Vector3(0, 0, 1), along: new THREE.Vector3(1, 0, 0) }, // south (faces the camera)
    { dir: new THREE.Vector3(1, 0, 0), along: new THREE.Vector3(0, 0, -1) }, // east
    { dir: new THREE.Vector3(0, 0, -1), along: new THREE.Vector3(-1, 0, 0) }, // north
    { dir: new THREE.Vector3(-1, 0, 0), along: new THREE.Vector3(0, 0, 1) }, // west
  ];
  const tops = [H - 2.2, H, H - 1.2, H - 3.2, H - 0.6, H - 2.6, H - 1.6, H - 0.2];
  sides.forEach((s, i) => {
    for (let half = 0; half < 2; half++) {
      const proud = half === 1 ? 0.5 : 0;
      const gap = 0.12;
      const uA = half === 0 ? -HALF : gap;
      const uB = half === 0 ? -gap : HALF;
      const out = HALF - 0.1 + proud;
      const b0 = s.dir.clone().multiplyScalar(out).addScaledVector(s.along, uA);
      const b1 = s.dir.clone().multiplyScalar(out).addScaledVector(s.along, uB);
      const top = tops[i * 2 + half];
      // The tops stop short of the axis and of each other: an open, jagged crown.
      const tOut = 0.85 + proud * 0.6;
      const tA = half === 0 ? -1.05 : 0.08;
      const tB = half === 0 ? -0.08 : 1.05;
      const t0 = s.dir.clone().multiplyScalar(tOut).addScaledVector(s.along, tA).setY(top);
      const t1 = s.dir.clone().multiplyScalar(tOut).addScaledVector(s.along, tB).setY(top);
      parts.push(shard(b0, b1, t0, t1, s.dir, i * 2 + half));
    }
  });
  // The steel crown inside the open tip, and a street-level canopy on the south face.
  parts.push(cyl(0.12, 0.35, 5.5, PALETTE.slate, 0, H - 5, 0, 6));
  parts.push(box(3.2, 0.25, 1.1, PALETTE.slate, 0, 2.2, HALF + 0.6));
  parts.push(box(2.4, 2.2, 0.15, 0x2f4d63, 0, 0, HALF + 0.3));
  const glass = inked(parts, 0.1);
  group.add(glass);

  // The aircraft-warning light on the very top: a little self-lit red bead.
  const beadMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
  const bead = new THREE.Mesh(sphere(0.3, 0xffffff, 0, H - 5 + 5.5 + 0.25, 0, 10, 8), beadMat);
  group.add(bead);

  // The shimmer: lift the glass toward white where a slow band of sky reflection passes.
  const mesh = glass.children[0] as THREE.Mesh;
  const color = mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
  const posAttr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
  const base = Float32Array.from(color.array as Float32Array);
  const ys = new Float32Array(posAttr.count);
  const xs = new Float32Array(posAttr.count);
  for (let i = 0; i < posAttr.count; i++) { ys[i] = posAttr.getY(i); xs[i] = posAttr.getX(i); }
  const PERIOD = H + 16;

  return {
    group,
    labelY: H + 4,
    animate: (t) => {
      // A soft band (and a fainter echo) climbing about 5 m a second, tilted a little across the face.
      const head = (t * 5) % PERIOD - 8;
      const arr = color.array as Float32Array;
      for (let i = 0; i < ys.length; i++) {
        const d = ys[i] + xs[i] * 0.35 - head;
        const band = Math.max(0, 1 - Math.abs(d) / 3.5) * 0.55 + Math.max(0, 1 - Math.abs(d + 9) / 2) * 0.25;
        const j = i * 3;
        arr[j] = base[j] + (1 - base[j]) * band;
        arr[j + 1] = base[j + 1] + (1 - base[j + 1]) * band;
        arr[j + 2] = base[j + 2] + (1 - base[j + 2]) * band;
      }
      color.needsUpdate = true;
      // Blink: a short bright flash every 1.6 s.
      const on = (t % 1.6) < 0.45;
      beadMat.color.setHex(on ? 0xff3322 : 0x8a2018);
    },
  };
}
