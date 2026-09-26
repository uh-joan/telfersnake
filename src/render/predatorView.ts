import * as THREE from 'three';
import { PREDATOR_KINDS, type PredatorKind } from '../sim/predators';
import type { WorldView } from '../sim/view';
import { model, paint, PAINTED } from './paint';

type Geo = THREE.BufferGeometry;
const BLACK = 0x1c1c1f;

const sphere = (r: number, color: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1): Geo =>
  paint(new THREE.SphereGeometry(r, 10, 8), color, (g) => g.scale(sx, sy, sz).translate(x, y, z));
const leg = (r: number, h: number, color: number, x: number, z: number): Geo =>
  paint(new THREE.CylinderGeometry(r, r, h, 6), color, (g) => g.translate(x, h / 2, z));
const eyes = (r: number, x: number, y: number, z: number, color = BLACK): Geo[] =>
  [-1, 1].map((side) => sphere(r, color, side * x, y, z));
const fourLegs = (r: number, h: number, color: number, x: number, z: number): Geo[] =>
  [[-x, -z], [x, -z], [-x, z], [x, z]].map(([lx, lz]) => leg(r, h, color, lx, lz));

/** Bigger than the petting-farm animals: the Common's dangers should read as a threat from far off. */
const MODELS: Record<PredatorKind, () => Geo[]> = {
  bear: () => [
    paint(new THREE.CapsuleGeometry(0.55, 0.7, 5, 12), 0x6b4a2e, (g) => g.rotateX(Math.PI / 2).translate(0, 0.7, 0)),
    sphere(0.38, 0x6b4a2e, 0, 0.95, 0.66),
    ...[-1, 1].map((s) => sphere(0.14, 0x5a3d25, s * 0.26, 1.24, 0.6)),
    sphere(0.17, 0x4a3120, 0, 0.86, 0.98, 1, 0.9, 1),
    sphere(0.05, BLACK, 0, 0.94, 1.12),
    ...eyes(0.05, 0.15, 1.02, 0.9, BLACK),
    ...fourLegs(0.16, 0.42, 0x5a3d25, 0.34, 0.42),
  ],
  wolf: () => [
    paint(new THREE.CapsuleGeometry(0.32, 0.7, 5, 12), 0x8a8f98, (g) => g.rotateX(Math.PI / 2).translate(0, 0.62, 0)),
    sphere(0.24, 0x9aa0aa, 0, 0.78, 0.6, 1, 1, 1.15),
    ...[-1, 1].map((s) => paint(new THREE.ConeGeometry(0.1, 0.24, 5), 0x8a8f98, (g) => g.translate(s * 0.14, 1.02, 0.56))),
    paint(new THREE.ConeGeometry(0.13, 0.34, 7), 0x9aa0aa, (g) => g.rotateX(Math.PI / 2).translate(0, 0.72, 0.92)),
    sphere(0.05, BLACK, 0, 0.72, 1.08),
    ...eyes(0.045, 0.1, 0.84, 0.78, 0xffd23c),
    // low bushy tail sweeping back
    ...[[0.5, -0.38, 0.16], [0.4, -0.56, 0.13]].map(([y, z, r]) => sphere(r, 0x7a7f88, 0, y, z, 1, 1, 1.3)),
    ...fourLegs(0.09, 0.5, 0x7a7f88, 0.2, 0.38),
  ],
};

/** How each moves: [bob height, strides per metre, side-to-side sway]. */
const GAIT: Record<PredatorKind, [number, number, number]> = {
  bear: [0.06, 2.2, 0.05],
  wolf: [0.1, 3, 0.02],
};

/** The Common's bears and wolves, one instanced mesh per kind. */
export class PredatorView {
  readonly group = new THREE.Group();
  private readonly meshes = new Map<PredatorKind, THREE.InstancedMesh>();
  private readonly travel = new Map<PredatorKind, number[]>();
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly pos = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();

  constructor(capacity: number) {
    for (const kind of PREDATOR_KINDS) {
      const mesh = new THREE.InstancedMesh(model(MODELS[kind](), kind), PAINTED, Math.max(1, capacity));
      mesh.frustumCulled = false;
      this.meshes.set(kind, mesh);
      this.travel.set(kind, []);
      this.group.add(mesh);
    }
  }

  update(world: WorldView, dt: number): void {
    for (const mesh of this.meshes.values()) mesh.count = 0;
    for (let i = 0; i < world.predators.length; i++) {
      const p = world.predators[i];
      const mesh = this.meshes.get(p.kind)!;
      const [bob, strides, sway] = GAIT[p.kind];
      // Distance walked drives the gait, so a still predator does not jog on the spot.
      const walked = this.travel.get(p.kind)!;
      const slot = mesh.count;
      walked[slot] = (walked[slot] ?? 0) + p.speed * dt;
      const phase = walked[slot] * strides * Math.PI;
      const moving = p.speed > 0.05 ? 1 : 0;
      const s = 1.15;

      this.e.set(0, Math.PI / 2 - p.heading, Math.sin(phase) * sway * moving);
      this.q.setFromEuler(this.e);
      this.pos.set(p.x, Math.abs(Math.sin(phase)) * bob * moving, p.z);
      this.m.compose(this.pos, this.q, this.scale.set(s, s, s));
      mesh.setMatrixAt(mesh.count++, this.m);
    }
    for (const mesh of this.meshes.values()) mesh.instanceMatrix.needsUpdate = true;
  }
}
