import * as THREE from 'three';
import { FOOD_KINDS, type FoodKind } from '../sim/food';
import type { WorldView } from '../sim/view';
import { STEP } from '../sim/world';
import { popIn } from './ease';
import { model, paint, PAINTED } from './paint';

const BUN = 0xe0a458;

const MODELS: Record<FoodKind, () => THREE.BufferGeometry[]> = {
  burger: () => [
    paint(new THREE.CylinderGeometry(0.4, 0.36, 0.16, 12), BUN, (g) => g.translate(0, 0.08, 0)),
    paint(new THREE.CylinderGeometry(0.43, 0.43, 0.13, 12), 0x6b3a22, (g) => g.translate(0, 0.23, 0)),
    paint(new THREE.BoxGeometry(0.78, 0.04, 0.78), 0xffc93c, (g) => g.rotateY(0.5).translate(0, 0.32, 0)),
    paint(new THREE.CylinderGeometry(0.46, 0.46, 0.05, 12), 0x5dbb46, (g) => g.translate(0, 0.37, 0)),
    paint(new THREE.SphereGeometry(0.41, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), BUN, (g) => g.scale(1, 0.7, 1).translate(0, 0.4, 0)),
  ],
  sausage: () => [
    paint(new THREE.CapsuleGeometry(0.15, 0.55, 4, 10), 0xb5533a, (g) => g.rotateZ(Math.PI / 2).translate(0, 0.28, 0)),
    paint(new THREE.SphereGeometry(0.06, 6, 5), 0x8a3a28, (g) => g.translate(0.44, 0.28, 0)),
    paint(new THREE.SphereGeometry(0.06, 6, 5), 0x8a3a28, (g) => g.translate(-0.44, 0.28, 0)),
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
};

/** All food on the map, drawn as one instanced mesh per kind (six draw calls total). */
export class FoodView {
  readonly group = new THREE.Group();
  private readonly meshes = new Map<FoodKind, THREE.InstancedMesh>();
  /** Per mesh, whether each instance slot is currently painted gold. */
  private readonly painted = new Map<THREE.InstancedMesh, Uint8Array>();
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
  }

  update(world: WorldView, time: number): void {
    for (const mesh of this.meshes.values()) mesh.count = 0;
    world.foods.forEach((f, i) => {
      const mesh = this.meshes.get(f.kind)!;
      const age = (world.tick - f.born) * STEP;
      const grow = popIn(age / 0.35);
      const s = (f.golden ? 1.45 + Math.sin(time * 6 + i) * 0.12 : 1.15) * Math.max(0.01, grow);
      this.q.setFromAxisAngle(this.up, time * (f.golden ? 3 : 0.9) + i * 1.7);
      this.pos.set(f.x, 0.12 + Math.sin(time * 2.2 + i) * 0.07, f.z);
      this.m.compose(this.pos, this.q, this.scale.set(s, s, s));
      const painted = this.painted.get(mesh)!;
      const gold = f.golden ? 1 : 0;
      if (painted[mesh.count] !== gold) {
        painted[mesh.count] = gold;
        mesh.setColorAt(mesh.count, f.golden ? this.gold : this.plain);
        mesh.instanceColor!.needsUpdate = true;
      }
      mesh.setMatrixAt(mesh.count++, this.m);
    });
    for (const mesh of this.meshes.values()) mesh.instanceMatrix.needsUpdate = true;
  }
}
