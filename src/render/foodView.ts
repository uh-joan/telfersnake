import * as THREE from 'three';
import { FOOD_KINDS, type FoodKind } from '../sim/food';
import type { WorldView } from '../sim/view';
import { STEP } from '../sim/world';
import { popIn } from './ease';
import { model, paint, PAINTED } from './paint';

const BUN = 0xe0a458;
const PASTRY = 0xe6ac5c;
const CREAM = 0xfffaf0;
const JAM = 0xd8283a;

const box = (w: number, h: number, d: number, color: number, place?: (g: THREE.BufferGeometry) => void) =>
  paint(new THREE.BoxGeometry(w, h, d), color, place);
const ball = (r: number, color: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) =>
  paint(new THREE.SphereGeometry(r, 10, 7), color, (g) => g.scale(sx, sy, sz).translate(x, y, z));
/** A slice of a round cake, `angle` wide, its point at the middle (so it spins about its own middle). */
const wedge = (r: number, h: number, y: number, color: number, angle = 1) =>
  paint(new THREE.CylinderGeometry(r, r, h, 10, 1, false, -angle / 2, angle), color, (g) => g.translate(0, y, -r * 0.45));
/** The jewel on golden food in London: a little gold crown with a ruby and a sapphire. */
const crown = (): THREE.BufferGeometry[] => [
  paint(new THREE.CylinderGeometry(0.17, 0.15, 0.1, 10, 1, true), 0xffd23f, (g) => g.translate(0, 0.05, 0)),
  ...[0, 1, 2, 3, 4].map((i) => paint(new THREE.ConeGeometry(0.045, 0.12, 4), 0xffd23f, (g) =>
    g.translate(Math.cos((i * Math.PI * 2) / 5) * 0.15, 0.15, Math.sin((i * Math.PI * 2) / 5) * 0.15))),
  ...[0, 1, 2, 3, 4].map((i) => ball(0.026, 0xffffff, Math.cos((i * Math.PI * 2) / 5) * 0.15, 0.22, Math.sin((i * Math.PI * 2) / 5) * 0.15)),
  ball(0.045, 0xe0115f, 0, 0.06, 0.16, 1, 1, 0.6),
  ball(0.04, 0x1f6feb, 0.16, 0.06, 0, 0.6, 1, 1),
  ball(0.04, 0x1f6feb, -0.16, 0.06, 0, 0.6, 1, 1),
  ball(0.04, 0x2fbf71, 0, 0.06, -0.16, 1, 1, 0.6),
];
/** Jelly babies come in every colour: each instance is tinted from this list (the model itself is white). */
const JELLY = [0xff3b4e, 0xff9f1c, 0xffe14d, 0x4cd964, 0xb06cff, 0xff6fb5].map((c) => new THREE.Color(c));

const MODELS: Record<FoodKind, () => THREE.BufferGeometry[]> = {
  burger: () => [
    paint(new THREE.CylinderGeometry(0.4, 0.36, 0.16, 12), BUN, (g) => g.translate(0, 0.08, 0)),
    paint(new THREE.CylinderGeometry(0.43, 0.43, 0.13, 12), 0x6b3a22, (g) => g.translate(0, 0.23, 0)),
    paint(new THREE.BoxGeometry(0.78, 0.04, 0.78), 0xffc93c, (g) => g.rotateY(0.5).translate(0, 0.32, 0)),
    paint(new THREE.CylinderGeometry(0.46, 0.46, 0.05, 12), 0x5dbb46, (g) => g.translate(0, 0.37, 0)),
    paint(new THREE.SphereGeometry(0.41, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), BUN, (g) => g.scale(1, 0.7, 1).translate(0, 0.4, 0)),
  ],
  // A hot-dog, so it never reads as a brick: pale bun, browner sausage, a squiggle of mustard.
  sausage: () => [
    paint(new THREE.CapsuleGeometry(0.13, 0.5, 4, 8), 0xecc487, (g) => g.rotateZ(Math.PI / 2).translate(0, 0.24, 0.12)),
    paint(new THREE.CapsuleGeometry(0.13, 0.5, 4, 8), 0xecc487, (g) => g.rotateZ(Math.PI / 2).translate(0, 0.24, -0.12)),
    paint(new THREE.CapsuleGeometry(0.12, 0.52, 4, 10), 0x9c4a2e, (g) => g.rotateZ(Math.PI / 2).translate(0, 0.36, 0)),
    paint(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 5), 0xffcf33, (g) => g.rotateZ(Math.PI / 2).translate(0, 0.45, 0)),
  ],
  cookie: () => [
    paint(new THREE.CylinderGeometry(0.38, 0.38, 0.1, 14), 0xd9a066, (g) => g.rotateX(Math.PI / 2).translate(0, 0.42, 0)),
    ...[[0.12, 0.55], [-0.15, 0.48], [0.02, 0.3], [-0.2, 0.28], [0.2, 0.34]].map(([x, y]) =>
      paint(new THREE.SphereGeometry(0.055, 6, 5), 0x4a2c1a, (g) => g.translate(x, y, 0.06))),
    ...[[-0.1, 0.56], [0.16, 0.44], [-0.04, 0.32]].map(([x, y]) =>
      paint(new THREE.SphereGeometry(0.055, 6, 5), 0x4a2c1a, (g) => g.translate(x, y, -0.06))),
  ],
  broccoli: () => [
    paint(new THREE.CylinderGeometry(0.09, 0.13, 0.4, 7), 0x9bd27a, (g) => g.translate(0, 0.2, 0)),
    ...[[0, 0.55, 0, 0.24], [0.2, 0.46, 0.05, 0.18], [-0.19, 0.47, 0.06, 0.18], [0.02, 0.45, -0.2, 0.18], [0, 0.46, 0.2, 0.17]].map(
      ([x, y, z, r]) => paint(new THREE.IcosahedronGeometry(r, 1), 0x2f8f3a, (g) => g.translate(x, y, z))),
  ],
  carrot: () => [
    paint(new THREE.ConeGeometry(0.17, 0.75, 9), 0xff8c2b, (g) => g.rotateZ(Math.PI).rotateZ(0.5).translate(0, 0.4, 0)),
    ...[-0.3, 0, 0.3].map((a) =>
      paint(new THREE.ConeGeometry(0.05, 0.3, 5), 0x4caf50, (g) => g.rotateZ(a).translate(-0.19 + a * 0.2, 0.84, 0))),
  ],
  apple: () => [
    paint(new THREE.SphereGeometry(0.3, 12, 9), 0xe23b3b, (g) => g.scale(1, 0.92, 1).translate(0, 0.34, 0)),
    paint(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 5), 0x5b3a1e, (g) => g.translate(0, 0.66, 0)),
    paint(new THREE.SphereGeometry(0.09, 6, 4), 0x4caf50, (g) => g.scale(1.4, 0.3, 0.8).translate(0.12, 0.7, 0)),
  ],
  // A red-capped toadstool with white spots.
  mushroom: () => [
    paint(new THREE.CylinderGeometry(0.11, 0.14, 0.34, 8), 0xf3ead3, (g) => g.translate(0, 0.17, 0)),
    paint(new THREE.SphereGeometry(0.28, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0xd23b32, (g) => g.scale(1, 0.75, 1).translate(0, 0.33, 0)),
    ...[[0.12, 0.06], [-0.1, 0.1], [0.02, -0.13], [-0.14, -0.05]].map(([x, z]) =>
      paint(new THREE.SphereGeometry(0.045, 6, 5), 0xffffff, (g) => g.translate(x, 0.44, z))),
  ],
  // A round red tomato with a green calyx.
  tomato: () => [
    paint(new THREE.SphereGeometry(0.26, 12, 9), 0xe6473a, (g) => g.scale(1.05, 0.9, 1.05).translate(0, 0.28, 0)),
    ...[0, 1, 2, 3, 4].map((i) =>
      paint(new THREE.ConeGeometry(0.05, 0.14, 4), 0x4a8a3a, (g) => g.rotateZ(-0.5).rotateY((i * Math.PI * 2) / 5).translate(0, 0.46, 0))),
  ],
  // A little cluster of blueberries.
  berry: () => [
    ...[[0, 0.12, 0], [0.12, 0.1, 0.05], [-0.1, 0.11, -0.04], [0.03, 0.1, -0.12], [-0.05, 0.22, 0]].map(([x, y, z]) =>
      paint(new THREE.SphereGeometry(0.11, 8, 6), 0x3f5bd0, (g) => g.translate(x, y, z))),
  ],
  // ---- London's menu
  // Fish & chips in a newspaper wrap: battered fish on top, chips spilling out.
  fishchips: () => [
    box(0.72, 0.14, 0.5, 0xf3f0e6, (g) => g.translate(0, 0.07, 0)),
    ...[-0.16, 0, 0.16].map((z) => box(0.74, 0.02, 0.05, 0x9a958a, (g) => g.translate(0, 0.13, z))),
    ...[[-0.2, 0.06, 0.4], [-0.08, -0.1, -0.3], [0.05, 0.1, 0.2], [0.18, -0.04, -0.5], [-0.25, -0.16, 0.9], [0.24, 0.14, 0.1]].map(([x, z, a]) =>
      box(0.07, 0.07, 0.34, 0xffd25a, (g) => g.rotateY(a).rotateX(0.25).translate(x, 0.22, z))),
    paint(new THREE.CapsuleGeometry(0.12, 0.38, 4, 10), 0xd98a2b, (g) => g.rotateZ(Math.PI / 2).scale(1, 0.8, 1.15).translate(-0.04, 0.32, 0.02)),
    paint(new THREE.ConeGeometry(0.12, 0.18, 4), 0xd98a2b, (g) => g.rotateZ(-Math.PI / 2).scale(1, 1, 0.35).translate(0.33, 0.32, 0.02)),
    ball(0.06, 0xf6e05a, -0.27, 0.36, 0.12), // a wedge of lemon
  ],
  // A scone with a dollop of jam and a swirl of cream.
  scone: () => [
    paint(new THREE.CylinderGeometry(0.28, 0.3, 0.24, 14), 0xe0b06a, (g) => g.translate(0, 0.12, 0)),
    paint(new THREE.SphereGeometry(0.28, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0xc98f45, (g) => g.scale(1, 0.25, 1).translate(0, 0.24, 0)),
    paint(new THREE.CylinderGeometry(0.2, 0.22, 0.06, 12), JAM, (g) => g.translate(0, 0.32, 0)),
    ball(0.15, CREAM, 0, 0.4, 0, 1, 0.6, 1),
    paint(new THREE.ConeGeometry(0.08, 0.12, 8), CREAM, (g) => g.translate(0, 0.52, 0)),
  ],
  // A slice of Victoria sponge: two golden layers, jam and cream between, sugar on top.
  sponge: () => [
    wedge(0.5, 0.16, 0.08, 0xf2cf6b),
    wedge(0.5, 0.06, 0.19, JAM),
    wedge(0.5, 0.05, 0.245, CREAM),
    wedge(0.5, 0.16, 0.35, 0xf2cf6b),
    wedge(0.49, 0.02, 0.44, 0xffffff),
    ball(0.07, 0xe0283a, 0, 0.5, -0.32), // a strawberry on top
  ],
  // A crustless triangle sandwich: white bread, cucumber, white bread.
  sandwich: () => [
    paint(new THREE.CylinderGeometry(0.42, 0.42, 0.11, 3), 0xfbf3dc, (g) => g.translate(0, 0.06, 0)),
    paint(new THREE.CylinderGeometry(0.44, 0.44, 0.05, 3), 0x7cc24a, (g) => g.translate(0, 0.14, 0)),
    paint(new THREE.CylinderGeometry(0.43, 0.43, 0.03, 3), 0xf5f0e0, (g) => g.translate(0, 0.18, 0)),
    paint(new THREE.CylinderGeometry(0.42, 0.42, 0.11, 3), 0xfbf3dc, (g) => g.translate(0, 0.25, 0)),
  ],
  // A golden pie with a crimped edge and a steam hole.
  pie: () => [
    paint(new THREE.CylinderGeometry(0.34, 0.3, 0.22, 16), PASTRY, (g) => g.translate(0, 0.11, 0)),
    paint(new THREE.SphereGeometry(0.33, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0xd99a45, (g) => g.scale(1, 0.35, 1).translate(0, 0.22, 0)),
    paint(new THREE.TorusGeometry(0.33, 0.045, 6, 18), 0xf0bf6e, (g) => g.rotateX(Math.PI / 2).translate(0, 0.22, 0)),
    paint(new THREE.CylinderGeometry(0.04, 0.04, 0.04, 8), 0x6b3a1e, (g) => g.translate(0, 0.34, 0)),
    ...[0.5, 2.6, 4.7].map((a) => box(0.14, 0.02, 0.04, 0xf0bf6e, (g) => g.rotateY(a).translate(Math.cos(a) * 0.16, 0.32, Math.sin(a) * 0.16))),
  ],
  // A sausage roll: flaky pastry with the pink sausage peeking out of each end.
  sausageroll: () => [
    paint(new THREE.CylinderGeometry(0.17, 0.17, 0.62, 12), PASTRY, (g) => g.rotateZ(Math.PI / 2).scale(1, 0.85, 1).translate(0, 0.17, 0)),
    ...[-1, 1].map((s) => paint(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 10), 0xc76a58, (g) => g.rotateZ(Math.PI / 2).translate(s * 0.31, 0.17, 0))),
    ...[-0.16, 0, 0.16].map((x) => box(0.03, 0.02, 0.2, 0xb87a32, (g) => g.rotateY(0.5).translate(x, 0.32, 0))),
  ],
  // A crumpet: a thick golden round, its top full of holes, and a pat of melting butter.
  crumpet: () => [
    paint(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 16), 0xc98a42, (g) => g.translate(0, 0.11, 0)),
    paint(new THREE.CylinderGeometry(0.31, 0.31, 0.02, 16), 0xf3d27e, (g) => g.translate(0, 0.23, 0)),
    ...[[0.12, 0.05], [-0.1, 0.13], [0.02, -0.15], [-0.18, -0.06], [0.2, -0.1], [0.06, 0.2], [-0.05, 0.02], [0.18, 0.12], [-0.2, 0.1], [-0.08, -0.2], [0.1, -0.2], [0.24, 0.02]].map(([x, z]) =>
      paint(new THREE.CylinderGeometry(0.032, 0.032, 0.02, 6), 0x7a4a1e, (g) => g.translate(x, 0.245, z))),
    box(0.16, 0.06, 0.12, 0xfff08a, (g) => g.rotateY(0.4).translate(-0.02, 0.27, 0.02)),
  ],
  // A big strawberry: a red heart shape (lying down), yellow seeds, a star of green leaves on top.
  strawberry: () => [
    paint(new THREE.ConeGeometry(0.25, 0.46, 14), 0xe8243c, (g) => g.rotateX(Math.PI).translate(0, 0.28, 0)),
    ball(0.25, 0xe8243c, 0, 0.5, 0, 1, 0.45, 1),
    ...[[0.13, 0.4, 0.13], [-0.14, 0.38, 0.11], [0.12, 0.3, -0.13], [-0.1, 0.32, -0.15], [0, 0.22, 0.12], [0.17, 0.44, -0.04],
      [-0.05, 0.2, -0.1], [0.07, 0.16, 0.06], [-0.18, 0.44, 0.0], [0.0, 0.42, 0.19]].map(([x, y, z]) => ball(0.024, 0xffe066, x, y, z)),
    ...[0, 1, 2, 3, 4, 5].map((i) => paint(new THREE.ConeGeometry(0.07, 0.24, 4), 0x2f9b3a, (g) =>
      g.scale(1, 1, 0.35).rotateZ(-1.35).translate(0.1, 0, 0).rotateY((i * Math.PI * 2) / 6).translate(0, 0.6, 0))),
    paint(new THREE.CylinderGeometry(0.025, 0.03, 0.14, 5), 0x2f9b3a, (g) => g.translate(0, 0.68, 0)),
  ].map((g) => g.rotateX(1.2).translate(0, 0.32, -0.15)), // lying on its side, so it shows its shape
  // A jelly baby: a little sweet person (tinted per instance: red, orange, yellow, green, purple, pink).
  jellybaby: () => [
    paint(new THREE.CapsuleGeometry(0.11, 0.14, 4, 10), 0xffffff, (g) => g.scale(1, 1, 0.8).translate(0, 0.2, 0)),
    ball(0.1, 0xffffff, 0, 0.44, 0),
    ...[-1, 1].map((s) => ball(0.05, 0xffffff, s * 0.12, 0.27, 0, 0.8, 1.3, 0.8)),
    ...[-1, 1].map((s) => ball(0.055, 0xffffff, s * 0.06, 0.06, 0, 1, 1.2, 1)),
    ...[-1, 1].map((s) => ball(0.018, 0x2a1a1a, s * 0.035, 0.46, 0.09)),
  ],
  // A sesame bagel.
  bagel: () => [
    paint(new THREE.TorusGeometry(0.22, 0.12, 10, 18), 0xc98a45, (g) => g.rotateX(Math.PI / 2).scale(1, 0.75, 1).translate(0, 0.12, 0)),
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
      const a = (i * Math.PI * 2) / 8 + 0.3;
      return ball(0.02, 0xfff3d6, Math.cos(a) * 0.22, 0.21, Math.sin(a) * 0.22, 1.5, 0.6, 1);
    }),
  ],
  // A round jammy biscuit standing on its edge: a red heart of jam in the middle.
  biscuit: () => [
    paint(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 18), 0xe3b268, (g) => g.rotateX(Math.PI / 2).translate(0, 0.38, 0)),
    paint(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 12), JAM, (g) => g.rotateX(Math.PI / 2).translate(0, 0.38, 0)),
    ...[0, 1, 2, 3, 4, 5].map((i) => {
      const a = (i * Math.PI * 2) / 6;
      return ball(0.022, 0xb07a38, Math.cos(a) * 0.24, 0.38 + Math.sin(a) * 0.24, 0.045);
    }),
  ],
  // A cup of tea on a saucer: white china, a blue band, and the tea itself.
  tea: () => [
    paint(new THREE.CylinderGeometry(0.34, 0.26, 0.04, 16), 0xffffff, (g) => g.translate(0, 0.02, 0)),
    paint(new THREE.CylinderGeometry(0.22, 0.15, 0.28, 14), 0xffffff, (g) => g.translate(0, 0.18, 0)),
    paint(new THREE.CylinderGeometry(0.225, 0.21, 0.05, 14), 0x3a7bd5, (g) => g.translate(0, 0.27, 0)),
    paint(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 14), 0x9a5a2a, (g) => g.translate(0, 0.31, 0)),
    paint(new THREE.TorusGeometry(0.08, 0.025, 6, 12), 0xffffff, (g) => g.translate(0.24, 0.2, 0)),
  ],
  // An acorn: a nut with a little cap.
  acorn: () => [
    paint(new THREE.SphereGeometry(0.15, 10, 8), 0xc79a5b, (g) => g.scale(1, 1.25, 1).translate(0, 0.19, 0)),
    paint(new THREE.SphereGeometry(0.17, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0x7a5230, (g) => g.scale(1, 0.7, 1).translate(0, 0.3, 0)),
    paint(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 4), 0x5b3a1e, (g) => g.translate(0, 0.42, 0)),
  ],
};

/** All food on the map, drawn as one instanced mesh per kind (only the kinds on the map are drawn). */
export class FoodView {
  readonly group = new THREE.Group();
  private readonly meshes = new Map<FoodKind, THREE.InstancedMesh>();
  /** Per mesh, whether each instance slot is currently painted gold (2: tinted some other colour). */
  private readonly painted = new Map<THREE.InstancedMesh, Uint8Array>();
  /** London's crown jewels: a little crown over each golden piece. */
  private readonly crowns: THREE.InstancedMesh;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly pos = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly plain = new THREE.Color(1, 1, 1);
  // Above 1 on purpose: it multiplies the painted colours, so this washes them to bright gold.
  private readonly gold = new THREE.Color(2.6, 1.9, 0.35);

  constructor(capacity: number) {
    for (const kind of FOOD_KINDS) {
      const mesh = new THREE.InstancedMesh(model(MODELS[kind](), kind), PAINTED, capacity);
      mesh.frustumCulled = false;
      for (let i = 0; i < capacity; i++) mesh.setColorAt(i, this.plain);
      this.painted.set(mesh, new Uint8Array(capacity));
      this.meshes.set(kind, mesh);
      this.group.add(mesh);
    }
    this.crowns = new THREE.InstancedMesh(model(crown(), 'crown'), PAINTED, capacity);
    this.crowns.frustumCulled = false;
    this.group.add(this.crowns);
  }

  update(world: WorldView, time: number): void {
    for (const mesh of this.meshes.values()) mesh.count = 0;
    this.crowns.count = 0;
    const jewels = world.stage.id === 'london';
    world.foods.forEach((f, i) => {
      const mesh = this.meshes.get(f.kind)!;
      const age = (world.tick - f.born) * STEP;
      const grow = popIn(age / 0.35);
      const s = (f.golden ? 1.45 + Math.sin(time * 6 + i) * 0.12 : 1.15) * Math.max(0.01, grow);
      this.q.setFromAxisAngle(this.up, time * (f.golden ? 3 : 0.9) + i * 1.7);
      this.pos.set(f.x, 0.12 + Math.sin(time * 2.2 + i) * 0.07, f.z);
      this.m.compose(this.pos, this.q, this.scale.set(s, s, s));
      const painted = this.painted.get(mesh)!;
      const jelly = !f.golden && f.kind === 'jellybaby';
      const tint = f.golden ? 1 : jelly ? 2 : 0;
      if (painted[mesh.count] !== tint || jelly) {
        painted[mesh.count] = tint;
        mesh.setColorAt(mesh.count, f.golden ? this.gold : jelly ? JELLY[i % JELLY.length] : this.plain);
        mesh.instanceColor!.needsUpdate = true;
      }
      mesh.setMatrixAt(mesh.count++, this.m);
      if (f.golden && jewels) {
        // A crown jewel: a little crown bobbing over it, turning the other way.
        this.q.setFromAxisAngle(this.up, -time * 2 + i);
        this.pos.y += 0.62 * s + Math.sin(time * 4 + i) * 0.05;
        this.m.compose(this.pos, this.q, this.scale.set(s * 1.1, s * 1.1, s * 1.1));
        this.crowns.setMatrixAt(this.crowns.count++, this.m);
      }
    });
    for (const mesh of this.meshes.values()) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.visible = mesh.count > 0;
    }
    this.crowns.instanceMatrix.needsUpdate = true;
    this.crowns.visible = this.crowns.count > 0;
  }
}
