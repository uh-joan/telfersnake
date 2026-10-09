import * as THREE from 'three';
import { GHERKIN } from '../../../sim/londonLayout';
import { inked, PALETTE, type LandmarkBuild } from './kit';

/**
 * The Gherkin: a fat pickle-green bullet. Narrow at the street, widest a third of the way up, then
 * curving in to a rounded nose with a little dark glass cap. Dark green bands spiral round it with a
 * pale stripe between each pair: the spiral-glass look, painted in vertex colours. Alive: every few
 * seconds a bright glint of sunshine slides across the glass.
 */

const H = 22; // the nose
const R = GHERKIN.r; // 3.5: the street footprint; the belly bulges a little past it
const SEGMENTS = 48;

const GREEN = PALETTE.pickleGreen;
const DARK = 0x2f6b2a;
const LATTICE = 0x9fd27a;
const CAP = 0x22383f;
const LOBBY = 0x26442c;

export function build(): LandmarkBuild {
  // The pickle's side, smoothed through a spline: [radius, height] from the street to the nose.
  const outline = new THREE.SplineCurve([
    new THREE.Vector2(R * 0.84, 0),
    new THREE.Vector2(R * 0.98, 3),
    new THREE.Vector2(R * 1.08, 7),
    new THREE.Vector2(R * 1.06, 10),
    new THREE.Vector2(R * 0.94, 13.5),
    new THREE.Vector2(R * 0.72, 17),
    new THREE.Vector2(R * 0.42, 19.8),
    new THREE.Vector2(R * 0.16, 21.4),
    new THREE.Vector2(0, H),
  ]).getPoints(44);
  // A twisted lathe: each column of quads winds round as it climbs, so the spiral stripes are
  // whole columns (crisp edges, no stair-steps). Built indexed for smooth normals, then split.
  const SPIRALS = 6;
  const PER = SEGMENTS / SPIRALS; // columns per spiral repeat
  const TURN = 34; // metres of climb per full turn
  const rows = outline.length;
  const verts: number[] = [];
  for (let j = 0; j < rows; j++) {
    const { x: r, y } = outline[j];
    for (let i = 0; i < SEGMENTS; i++) {
      const a = (i / SEGMENTS) * Math.PI * 2 + (y / TURN) * Math.PI * 2;
      verts.push(Math.sin(a) * r, y, Math.cos(a) * r);
    }
  }
  const index: number[] = [];
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < SEGMENTS; i++) {
      const i2 = (i + 1) % SEGMENTS;
      const a = j * SEGMENTS + i, b = j * SEGMENTS + i2, c = (j + 1) * SEGMENTS + i, d = (j + 1) * SEGMENTS + i2;
      index.push(a, b, d, a, d, c);
    }
  }
  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  indexed.setIndex(index);
  indexed.computeVertexNormals();
  const geo = indexed.toNonIndexed();
  indexed.dispose();
  // The floor, so the pickle is closed underneath.
  const floor = new THREE.CircleGeometry(outline[0].x, SEGMENTS).rotateX(Math.PI / 2).toNonIndexed();
  floor.deleteAttribute('uv');

  // Paint: dark spiral bands, a pale lattice stripe, the dark glass cap and lobby.
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const pattern = [DARK, DARK, DARK, GREEN, GREEN, LATTICE, GREEN, GREEN];
  for (let t = 0; t < pos.count / 3; t++) {
    const col = Math.floor(t / 2) % SEGMENTS;
    const j = Math.floor(t / 2 / SEGMENTS);
    const y = outline[j].y;
    let hex: number = pattern[Math.floor((col % PER) * pattern.length / PER)];
    if (y >= H - 1.4) hex = CAP;
    else if (y < 1.0) hex = LOBBY;
    c.setHex(hex);
    for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], (t * 3 + k) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const fc = new Float32Array(floor.getAttribute('position').count * 3);
  c.setHex(LOBBY);
  for (let i = 0; i < fc.length; i += 3) fc.set([c.r, c.g, c.b], i);
  floor.setAttribute('color', new THREE.BufferAttribute(fc, 3));

  const group = new THREE.Group();
  const pickle = inked([geo, floor], 0.12);
  group.add(pickle);

  // The glint: a soft vertical stripe of light that slides across the south face now and then.
  const mesh = pickle.children[0] as THREE.Mesh;
  const color = mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
  const p = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
  const base = Float32Array.from(color.array as Float32Array);
  const angle = new Float32Array(p.count);
  const height = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) { angle[i] = Math.atan2(p.getX(i), p.getZ(i)); height[i] = p.getY(i); }
  let lit = false;
  // Only sweep the colours while the pickle is actually drawn (three skips this when it is culled).
  let seen = false;
  mesh.onBeforeRender = () => { seen = true; };

  return {
    group,
    labelY: H + 3,
    animate: (t) => {
      const cycle = t % 6;
      const arr = color.array as Float32Array;
      if (cycle > 2.2) {
        if (lit) { arr.set(base); color.needsUpdate = true; lit = false; }
        return;
      }
      if (!seen) return;
      seen = false;
      lit = true;
      const at = -1.3 + (cycle / 2.2) * 2.6; // sweeps west → east across the face we see
      const fade = Math.sin((cycle / 2.2) * Math.PI);
      for (let i = 0; i < angle.length; i++) {
        const d = Math.abs(angle[i] - at - (height[i] - 10) * 0.025);
        const g = d < 0.32 ? (1 - d / 0.32) * 0.6 * fade : 0;
        const j = i * 3;
        arr[j] = base[j] + (1 - base[j]) * g;
        arr[j + 1] = base[j + 1] + (1 - base[j + 1]) * g;
        arr[j + 2] = base[j + 2] + (1 - base[j + 2]) * g;
      }
      color.needsUpdate = true;
    },
  };
}
