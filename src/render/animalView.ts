import * as THREE from 'three';
import { ANIMAL_KINDS, type AnimalKind } from '../sim/animals';
import type { WorldView } from '../sim/view';
import { STEP } from '../sim/world';
import { popIn } from './ease';
import { model, paint, PAINTED } from './paint';

type Geo = THREE.BufferGeometry;
const BLACK = 0x1c1c1f;

const sphere = (r: number, color: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1): Geo =>
  paint(new THREE.SphereGeometry(r, 10, 8), color, (g) => g.scale(sx, sy, sz).translate(x, y, z));
const puff = (r: number, color: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1): Geo =>
  paint(new THREE.IcosahedronGeometry(r, 1), color, (g) => g.scale(sx, sy, sz).translate(x, y, z));
const leg = (r: number, h: number, color: number, x: number, z: number): Geo =>
  paint(new THREE.CylinderGeometry(r, r, h, 6), color, (g) => g.translate(x, h / 2, z));
const eyes = (r: number, x: number, y: number, z: number, color = BLACK): Geo[] =>
  [-1, 1].map((side) => sphere(r, color, side * x, y, z));
const fourLegs = (r: number, h: number, color: number, x: number, z: number): Geo[] =>
  [[-x, -z], [x, -z], [-x, z], [x, z]].map(([lx, lz]) => leg(r, h, color, lx, lz));

/** Every model stands on y = 0 and faces +z. Drawn chunky so they read from the follow camera. */
const MODELS: Record<AnimalKind, () => Geo[]> = {
  snail: () => [
    paint(new THREE.CapsuleGeometry(0.09, 0.45, 3, 8), 0xe6d28a, (g) => g.rotateX(Math.PI / 2).translate(0, 0.09, 0.05)),
    sphere(0.1, 0xe6d28a, 0, 0.15, 0.32),
    sphere(0.24, 0xc07a3a, 0, 0.31, -0.06, 0.7, 1, 1),
    ...[-1, 1].map((s) => sphere(0.13, 0x8a4f22, s * 0.15, 0.31, -0.06, 0.35, 1, 1)),
    ...[-1, 1].map((s) => paint(new THREE.CylinderGeometry(0.015, 0.015, 0.18, 4), 0xe6d28a, (g) => g.translate(s * 0.05, 0.3, 0.36))),
    ...eyes(0.035, 0.05, 0.4, 0.36),
  ],
  ladybird: () => [
    paint(new THREE.SphereGeometry(0.25, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0xe03131, (g) => g.scale(1, 0.85, 1.15)),
    sphere(0.11, BLACK, 0, 0.08, 0.28),
    paint(new THREE.BoxGeometry(0.02, 0.02, 0.5), BLACK, (g) => g.translate(0, 0.205, -0.02)),
    ...[[0.11, 0.17, 0.1], [0.14, 0.13, -0.1], [0.06, 0.19, -0.02]].flatMap(([x, y, z]) =>
      [-1, 1].map((s) => sphere(0.045, BLACK, s * x, y, z))),
  ],
  chicken: () => [
    sphere(0.26, 0xfafafa, 0, 0.4, 0, 1, 1, 1.25),
    ...[-1, 1].map((s) => sphere(0.17, 0xe9e9e9, s * 0.23, 0.42, -0.02, 0.4, 0.8, 1)),
    paint(new THREE.ConeGeometry(0.13, 0.32, 6), 0xfafafa, (g) => g.rotateX(-0.9).translate(0, 0.58, -0.32)),
    sphere(0.145, 0xfafafa, 0, 0.7, 0.22),
    paint(new THREE.BoxGeometry(0.045, 0.11, 0.15), 0xe03131, (g) => g.translate(0, 0.87, 0.22)),
    sphere(0.045, 0xe03131, 0, 0.59, 0.34),
    paint(new THREE.ConeGeometry(0.05, 0.14, 6), 0xff9f1c, (g) => g.rotateX(Math.PI / 2).translate(0, 0.69, 0.41)),
    ...eyes(0.028, 0.085, 0.74, 0.33),
    leg(0.022, 0.18, 0xff9f1c, -0.08, 0),
    leg(0.022, 0.18, 0xff9f1c, 0.08, 0),
  ],
  duck: () => [
    sphere(0.25, 0xffd43b, 0, 0.3, 0, 1, 0.85, 1.4),
    ...[-1, 1].map((s) => sphere(0.17, 0xf2bd1d, s * 0.22, 0.32, -0.03, 0.4, 0.7, 1.1)),
    paint(new THREE.ConeGeometry(0.1, 0.22, 6), 0xffd43b, (g) => g.rotateX(-1.1).translate(0, 0.42, -0.36)),
    sphere(0.155, 0xffd43b, 0, 0.62, 0.24),
    paint(new THREE.BoxGeometry(0.13, 0.045, 0.17), 0xff8c1a, (g) => g.translate(0, 0.58, 0.42)),
    ...eyes(0.028, 0.09, 0.67, 0.35),
    ...[-1, 1].map((s) => paint(new THREE.BoxGeometry(0.09, 0.02, 0.13), 0xff8c1a, (g) => g.translate(s * 0.09, 0.01, 0.06))),
  ],
  rabbit: () => [
    sphere(0.25, 0xb8a590, 0, 0.29, 0, 1, 1, 1.3),
    sphere(0.165, 0xb8a590, 0, 0.52, 0.26),
    ...[-1, 1].map((s) =>
      paint(new THREE.CapsuleGeometry(0.045, 0.26, 3, 6), 0xb8a590, (g) => g.rotateX(-0.25).translate(s * 0.075, 0.8, 0.2))),
    ...[-1, 1].map((s) =>
      paint(new THREE.CapsuleGeometry(0.022, 0.2, 3, 5), 0xf3b6c2, (g) => g.rotateX(-0.25).translate(s * 0.075, 0.8, 0.235))),
    sphere(0.085, 0xffffff, 0, 0.3, -0.34),
    sphere(0.028, 0xf08aa0, 0, 0.51, 0.425),
    ...eyes(0.03, 0.1, 0.57, 0.37),
    ...[-1, 1].map((s) => sphere(0.075, 0xb8a590, s * 0.13, 0.05, 0.14, 1, 0.6, 1.7)),
  ],
  sheep: () => [
    puff(0.43, 0xf5f3ea, 0, 0.66, 0, 1, 0.9, 1.3),
    puff(0.2, 0xf5f3ea, 0.26, 0.88, 0.1),
    puff(0.2, 0xf5f3ea, -0.26, 0.88, 0.05),
    puff(0.22, 0xf5f3ea, 0, 0.95, -0.25),
    puff(0.2, 0xf5f3ea, 0, 0.85, 0.36),
    sphere(0.175, 0x2b2b2e, 0, 0.74, 0.64, 1, 1, 1.2),
    ...[-1, 1].map((s) => sphere(0.075, 0x2b2b2e, s * 0.2, 0.8, 0.58, 1.6, 0.5, 1)),
    puff(0.13, 0xf5f3ea, 0, 0.9, 0.56),
    ...eyes(0.035, 0.09, 0.78, 0.79, 0xffffff),
    ...fourLegs(0.05, 0.42, 0x2b2b2e, 0.2, 0.3),
  ],
  pig: () => [
    paint(new THREE.CapsuleGeometry(0.34, 0.5, 4, 10), 0xf4a6b7, (g) => g.rotateX(Math.PI / 2).translate(0, 0.52, 0)),
    sphere(0.27, 0xf4a6b7, 0, 0.58, 0.56),
    paint(new THREE.CylinderGeometry(0.115, 0.115, 0.1, 10), 0xe8839b, (g) => g.rotateX(Math.PI / 2).translate(0, 0.54, 0.84)),
    ...[-1, 1].map((s) => sphere(0.025, 0x9c4a60, s * 0.045, 0.54, 0.895)),
    ...[-1, 1].map((s) => paint(new THREE.ConeGeometry(0.09, 0.17, 5), 0xe8839b, (g) => g.translate(s * 0.17, 0.85, 0.5))),
    sphere(0.06, 0xe8839b, 0, 0.64, -0.6),
    ...eyes(0.032, 0.12, 0.68, 0.78),
    ...fourLegs(0.07, 0.26, 0xe8839b, 0.18, 0.26),
  ],
  goat: () => [
    paint(new THREE.CapsuleGeometry(0.3, 0.6, 4, 10), 0xd9cbb3, (g) => g.rotateX(Math.PI / 2).translate(0, 0.76, 0)),
    sphere(0.17, 0xd9cbb3, 0, 0.98, 0.48, 1, 1.3, 1),
    sphere(0.19, 0xd9cbb3, 0, 1.1, 0.64, 1, 1, 1.35),
    ...[-1, 1].map((s) => paint(new THREE.ConeGeometry(0.045, 0.36, 6), 0x6b5b4a, (g) => g.rotateX(-0.75).translate(s * 0.09, 1.38, 0.46))),
    ...[-1, 1].map((s) => sphere(0.07, 0xc4b59b, s * 0.21, 1.12, 0.56, 1.6, 0.5, 1)),
    paint(new THREE.ConeGeometry(0.06, 0.22, 5), 0xf3efe6, (g) => g.rotateX(Math.PI).translate(0, 0.88, 0.8)),
    paint(new THREE.ConeGeometry(0.05, 0.16, 5), 0xd9cbb3, (g) => g.rotateX(-0.6).translate(0, 0.98, -0.62)),
    ...eyes(0.032, 0.11, 1.15, 0.83),
    ...fourLegs(0.05, 0.52, 0x8a7a66, 0.17, 0.36),
  ],
  squirrel: () => [
    sphere(0.19, 0x9c6b3f, 0, 0.24, 0, 1, 1.05, 1.3),
    sphere(0.15, 0x9c6b3f, 0, 0.42, 0.2),
    ...[-1, 1].map((s) => paint(new THREE.ConeGeometry(0.05, 0.12, 5), 0x9c6b3f, (g) => g.translate(s * 0.08, 0.56, 0.18))),
    sphere(0.11, 0xe6d2b0, 0, 0.38, 0.3, 1, 0.8, 1),
    sphere(0.035, 0x3a2a1c, 0, 0.4, 0.38),
    ...eyes(0.03, 0.06, 0.46, 0.32),
    // bushy tail sweeping up behind
    ...[[0.3, -0.26, 0.26], [0.52, -0.28, 0.3], [0.72, -0.2, 0.26]].map(([y, z, r]) => sphere(r, 0xb07a48, 0, y, z, 0.8, 1, 0.6)),
  ],
  crow: () => [
    // Baked up in the air: crows fly.
    sphere(0.22, 0x2a2a30, 0, 0.92, -0.05, 1, 1, 1.5),
    sphere(0.14, 0x2a2a30, 0, 1.04, 0.26),
    paint(new THREE.ConeGeometry(0.05, 0.22, 5), 0xffb03a, (g) => g.rotateX(Math.PI / 2).translate(0, 1.02, 0.44)),
    ...[-1, 1].map((s) => sphere(0.11, 0x22222a, s * 0.24, 0.9, -0.05, 1, 0.35, 1.9)),
    ...eyes(0.03, 0.07, 1.08, 0.34, 0xffd23c),
  ],
  deer: () => [
    paint(new THREE.CapsuleGeometry(0.26, 0.6, 4, 10), 0xb58a5a, (g) => g.rotateX(Math.PI / 2).translate(0, 0.86, 0)),
    paint(new THREE.CylinderGeometry(0.1, 0.13, 0.52, 8), 0xb58a5a, (g) => g.rotateX(0.5).translate(0, 1.08, 0.36)),
    sphere(0.14, 0xb58a5a, 0, 1.32, 0.6, 1, 1.2, 1.15),
    ...[-1, 1].map((s) => paint(new THREE.ConeGeometry(0.03, 0.32, 5), 0x6b4a2e, (g) => g.rotateX(-0.4).translate(s * 0.07, 1.52, 0.58))),
    ...[-1, 1].map((s) => sphere(0.06, 0xb58a5a, s * 0.12, 1.34, 0.68, 1.4, 0.5, 1)),
    sphere(0.04, 0x2a2018, 0, 1.3, 0.74),
    ...eyes(0.03, 0.08, 1.34, 0.7),
    ...fourLegs(0.05, 0.64, 0x8a6a48, 0.18, 0.34),
  ],
  hedgehog: () => [
    sphere(0.28, 0x8a7258, 0, 0.26, -0.02, 1.15, 0.85, 1.3),
    ...[[0.14, 0], [-0.1, 0.08], [0.06, 0.14], [-0.14, -0.06], [0.12, -0.12], [0, 0.16], [-0.06, -0.14], [0.16, 0.05], [-0.16, 0.02], [0.04, -0.04], [0.1, 0.1], [-0.08, 0.13], [0.14, -0.02]].map(([x, z]) =>
      paint(new THREE.ConeGeometry(0.04, 0.24, 4), 0x4a3826, (g) => g.rotateX(-0.2).translate(x, 0.36, z))),
    sphere(0.13, 0xd8c0a0, 0, 0.2, 0.3, 1, 0.9, 1),
    sphere(0.035, 0x2a2a2a, 0, 0.2, 0.42),
    ...eyes(0.025, 0.06, 0.27, 0.34),
  ],
  fox: () => [
    sphere(0.21, 0xd9662a, 0, 0.28, 0, 1, 1, 1.4),
    sphere(0.13, 0xffffff, 0, 0.2, 0.28, 1, 0.9, 0.8),
    sphere(0.14, 0xd9662a, 0, 0.4, 0.22),
    paint(new THREE.ConeGeometry(0.07, 0.16, 5), 0xffffff, (g) => g.rotateX(1.4).translate(0, 0.36, 0.36)),
    ...[-1, 1].map((s) => paint(new THREE.ConeGeometry(0.06, 0.16, 4), 0x2a2018, (g) => g.translate(s * 0.09, 0.54, 0.16))),
    ...eyes(0.028, 0.07, 0.44, 0.32),
    // bushy white-tipped tail
    ...[[0.24, -0.28, 0.13, 0xd9662a], [0.32, -0.42, 0.11, 0xf3ead3]].map(([y, z, r, col]) => sphere(r as number, col as number, 0, y, z, 1, 1, 1.2)),
    ...fourLegs(0.04, 0.24, 0x8a3f18, 0.13, 0.22),
  ],
  pigeon: () => [
    sphere(0.18, 0x9aa0aa, 0, 0.22, -0.02, 1, 1, 1.4),
    sphere(0.12, 0x8a90a0, 0, 0.34, 0.2),
    sphere(0.09, 0x6f8fbf, 0, 0.26, 0.12, 1, 1.1, 0.7),
    paint(new THREE.ConeGeometry(0.03, 0.12, 5), 0xd88a5a, (g) => g.rotateX(Math.PI / 2).translate(0, 0.33, 0.34)),
    ...eyes(0.025, 0.055, 0.37, 0.28, 0xe06a2a),
    leg(0.016, 0.1, 0xd88a5a, -0.06, 0),
    leg(0.016, 0.1, 0xd88a5a, 0.06, 0),
  ],
};

/** How each kind moves its body as it goes: [hop height, strides per metre, side-to-side waddle]. */
const GAIT: Record<AnimalKind, [number, number, number]> = {
  snail: [0, 0, 0],
  ladybird: [0, 0, 0],
  chicken: [0.09, 5, 0.08],
  duck: [0.03, 5, 0.22],
  rabbit: [0.32, 2.2, 0],
  sheep: [0.06, 3, 0.04],
  pig: [0.05, 3.5, 0.07],
  goat: [0.08, 3, 0.03],
  squirrel: [0.16, 3, 0],
  crow: [0.05, 4, 0.06],
  deer: [0.12, 2.4, 0.02],
  hedgehog: [0.02, 4, 0],
  fox: [0.09, 3, 0.03],
  pigeon: [0.05, 4.5, 0.18],
};

/** The petting farm, one instanced mesh per kind. Limbs do not animate; hops and waddles sell it. */
export class AnimalView {
  readonly group = new THREE.Group();
  private readonly meshes = new Map<AnimalKind, THREE.InstancedMesh>();
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly pos = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();

  constructor(capacity: number) {
    for (const kind of ANIMAL_KINDS) {
      const mesh = new THREE.InstancedMesh(model(MODELS[kind](), kind), PAINTED, capacity);
      mesh.frustumCulled = false;
      this.meshes.set(kind, mesh);
      this.group.add(mesh);
    }
  }

  update(world: WorldView, time: number): void {
    for (const mesh of this.meshes.values()) mesh.count = 0;
    for (let i = 0; i < world.animals.length; i++) {
      const a = world.animals[i];
      const mesh = this.meshes.get(a.kind)!;
      const [hop, strides, waddle] = GAIT[a.kind];
      const phase = a.travel * strides * Math.PI;
      const moving = a.speed > 0 ? 1 : 0;

      const age = (world.tick - a.born) * STEP;
      const grow = popIn(age / 0.4);
      // Snails stretch and squash along their length instead of stepping.
      const squash = a.kind === 'snail' ? 1 + Math.sin(time * 3 + i) * 0.12 * moving : 1;
      const s = 1.25 * Math.max(0.01, grow);

      this.e.set(0, Math.PI / 2 - a.heading, Math.sin(phase) * waddle * moving);
      this.q.setFromEuler(this.e);
      this.pos.set(a.x, Math.abs(Math.sin(phase)) * hop * moving, a.z);
      this.m.compose(this.pos, this.q, this.scale.set(s, s, s * squash));
      mesh.setMatrixAt(mesh.count++, this.m);
    }
    for (const mesh of this.meshes.values()) mesh.instanceMatrix.needsUpdate = true;
  }
}
