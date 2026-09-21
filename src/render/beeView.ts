import * as THREE from 'three';
import type { WorldView } from '../sim/view';
import { model, paint, PAINTED } from './paint';

const CAP = 32;

/** Bee Buddies: the sim says where each bee is; this just draws them bobbing along. */
export class BeeView {
  readonly mesh: THREE.InstancedMesh;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly pos = new THREE.Vector3();
  private readonly one = new THREE.Vector3(1, 1, 1);
  private readonly p = { x: 0, z: 0 };

  constructor() {
    const bee = model([
      paint(new THREE.SphereGeometry(0.22, 10, 8), 0xffd43b, (g) => g.scale(1, 0.9, 1.35)),
      paint(new THREE.CylinderGeometry(0.205, 0.205, 0.08, 10), 0x1c1c1f, (g) => g.rotateX(Math.PI / 2).translate(0, 0, 0.06)),
      paint(new THREE.CylinderGeometry(0.18, 0.18, 0.07, 10), 0x1c1c1f, (g) => g.rotateX(Math.PI / 2).translate(0, 0, -0.13)),
      paint(new THREE.SphereGeometry(0.13, 8, 6), 0x1c1c1f, (g) => g.translate(0, 0.02, 0.3)),
      paint(new THREE.SphereGeometry(0.16, 8, 6), 0xffffff, (g) => g.scale(1.1, 0.12, 0.7).translate(0.17, 0.2, -0.02)),
      paint(new THREE.SphereGeometry(0.16, 8, 6), 0xffffff, (g) => g.scale(1.1, 0.12, 0.7).translate(-0.17, 0.2, -0.02)),
    ], 'bee');
    this.mesh = new THREE.InstancedMesh(bee, PAINTED, CAP);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  update(world: WorldView, time: number): void {
    let n = 0;
    for (const s of world.snakes) {
      if (!s.alive) continue;
      for (let i = 0; i < s.bees && n < CAP; i++) {
        world.beeAt(s, i, this.p);
        // Face along the orbit (tangent to the circle round the head).
        const yaw = Math.atan2(this.p.x - s.x, this.p.z - s.z) + Math.PI / 2;
        this.q.setFromAxisAngle(this.up, yaw);
        this.pos.set(this.p.x, 1.1 + s.radius + Math.sin(time * 9 + i * 2) * 0.15, this.p.z);
        this.mesh.setMatrixAt(n++, this.m.compose(this.pos, this.q, this.one));
      }
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
