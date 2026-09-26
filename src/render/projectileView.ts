import * as THREE from 'three';
import { PROJECTILE_KINDS, type ProjectileKind } from '../sim/kids';
import type { WorldView } from '../sim/view';
import { model, paint, PAINTED } from './paint';

type Geo = THREE.BufferGeometry;

/** A blown kiss: two little lobes and a point, a chunky heart facing the camera. */
function heart(): Geo[] {
  const red = 0xf0486f;
  return [
    paint(new THREE.SphereGeometry(0.09, 8, 6), red, (g) => g.translate(-0.06, 0.05, 0)),
    paint(new THREE.SphereGeometry(0.09, 8, 6), red, (g) => g.translate(0.06, 0.05, 0)),
    paint(new THREE.ConeGeometry(0.13, 0.18, 4), red, (g) => g.rotateZ(Math.PI).rotateY(Math.PI / 4).translate(0, -0.08, 0)),
  ];
}

const MODELS: Record<ProjectileKind, () => Geo[]> = {
  pebble: () => [paint(new THREE.IcosahedronGeometry(0.11, 0), 0x8a8f98, (g) => g.scale(1, 0.85, 1.1))],
  kiss: heart,
};

/** How high each lobs, and its base launch height (roughly a child's hand). */
const ARC: Record<ProjectileKind, [number, number]> = {
  pebble: [1.6, 0.6],
  kiss: [1.1, 0.7],
};

/** Pebbles and kisses in flight, one instanced mesh per kind. */
export class ProjectileView {
  readonly group = new THREE.Group();
  private readonly meshes = new Map<ProjectileKind, THREE.InstancedMesh>();
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly pos = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();

  constructor(capacity = 24) {
    for (const kind of PROJECTILE_KINDS) {
      const mesh = new THREE.InstancedMesh(model(MODELS[kind](), kind), PAINTED, capacity);
      mesh.frustumCulled = false;
      this.meshes.set(kind, mesh);
      this.group.add(mesh);
    }
  }

  update(world: WorldView, time: number): void {
    for (const mesh of this.meshes.values()) mesh.count = 0;
    for (const pj of world.projectiles) {
      const mesh = this.meshes.get(pj.kind)!;
      const [arc, base] = ARC[pj.kind];
      const t = pj.total > 0 ? Math.min(1, Math.max(0, 1 - pj.left / pj.total)) : 1;
      const y = base + Math.sin(t * Math.PI) * arc;
      // A pebble tumbles; a kiss bobs and always faces up.
      if (pj.kind === 'pebble') this.q.setFromAxisAngle(this.up, time * 8 + pj.x);
      else this.q.setFromEuler(new THREE.Euler(-0.6, 0, Math.sin(time * 6) * 0.2));
      const s = pj.kind === 'kiss' ? 1 + Math.sin(time * 8) * 0.1 : 1;
      this.pos.set(pj.x, y, pj.z);
      this.m.compose(this.pos, this.q, this.scale.set(s, s, s));
      mesh.setMatrixAt(mesh.count++, this.m);
    }
    for (const mesh of this.meshes.values()) mesh.instanceMatrix.needsUpdate = true;
  }
}
