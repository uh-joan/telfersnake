import * as THREE from 'three';
import { HAZARD_KINDS, type Hazard, type HazardKind, PELLET_LIFE_TICKS } from '../sim/hazards';
import type { WorldView } from '../sim/view';
import { popIn } from './ease';
import { model, paint, PAINTED } from './paint';

type Geo = THREE.BufferGeometry;

const lump = (r: number, color: number, x: number, y: number, z: number, sy = 0.7): Geo =>
  paint(new THREE.IcosahedronGeometry(r, 0), color, (g) => g.scale(1, sy, 1).rotateY(x * 7 + z * 3).translate(x, y, z));
const stick = (len: number, turn: number, y: number, color: number): Geo =>
  paint(new THREE.CylinderGeometry(0.045, 0.06, len, 5), color, (g) => g.rotateZ(Math.PI / 2).rotateY(turn).translate(0, y, 0));
const MODELS: Record<HazardKind, () => Geo[]> = {
  rock: () => [lump(0.62, 0x8d9096, 0, 0.36, 0), lump(0.32, 0x7a7d83, 0.46, 0.17, 0.22), lump(0.22, 0x9a9da3, -0.4, 0.12, -0.3)],
  stones: () => [lump(0.26, 0x9a9da3, -0.16, 0.16, 0.1), lump(0.2, 0x85888e, 0.2, 0.12, -0.05), lump(0.16, 0xa6a9af, 0.02, 0.1, 0.3), lump(0.13, 0x7a7d83, -0.05, 0.08, -0.3)],
  sticks: () => [stick(1.15, 0.4, 0.06, 0x7a5230), stick(0.95, -0.8, 0.15, 0x8a6038), stick(0.5, 1.7, 0.2, 0x6b4526)],
};

const PELLET_CAP = 160;
const PELLET_COLOR = new THREE.Color(0x8be36a);
const POP = 0.35; // seconds a fresh piece takes to grow in

/** Rocks, sticks and stones (which break and reappear elsewhere), plus dropped snack pellets. */
export class HazardView {
  readonly group = new THREE.Group();
  private readonly pellets: THREE.InstancedMesh;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly scl = new THREE.Vector3();
  private readonly pos = new THREE.Vector3();
  // One InstancedMesh per kind, and which hazard array-indices feed it (order is stable).
  private readonly kinds: { mesh: THREE.InstancedMesh; idx: number[] }[] = [];
  private readonly lx: number[];
  private readonly lz: number[];
  private readonly bornAt: number[];

  constructor(private readonly hazards: readonly Hazard[]) {
    this.lx = hazards.map((h) => h.x);
    this.lz = hazards.map((h) => h.z);
    this.bornAt = hazards.map(() => -99);
    for (const kind of HAZARD_KINDS) {
      const idx = hazards.map((h, i) => (h.kind === kind ? i : -1)).filter((i) => i >= 0);
      if (idx.length === 0) continue;
      const mesh = new THREE.InstancedMesh(model(MODELS[kind](), kind), PAINTED, idx.length);
      mesh.frustumCulled = false;
      this.kinds.push({ mesh, idx });
      this.group.add(mesh);
    }

    this.pellets = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.24, 10, 8),
      new THREE.MeshLambertMaterial({ color: PELLET_COLOR, emissive: PELLET_COLOR, emissiveIntensity: 0.35 }),
      PELLET_CAP,
    );
    this.pellets.frustumCulled = false;
    this.pellets.count = 0;
    this.group.add(this.pellets);
  }

  update(world: WorldView, time: number): void {
    // Rocks move when they break: note the new spot so it can pop in, and redraw each piece.
    for (let i = 0; i < this.hazards.length; i++) {
      const h = this.hazards[i];
      if (h.x !== this.lx[i] || h.z !== this.lz[i]) {
        this.lx[i] = h.x;
        this.lz[i] = h.z;
        this.bornAt[i] = time;
      }
    }
    for (const { mesh, idx } of this.kinds) {
      idx.forEach((hazardIndex, slot) => {
        const h = this.hazards[hazardIndex];
        const s = popIn((time - this.bornAt[hazardIndex]) / POP);
        this.q.setFromAxisAngle(this.up, h.turn);
        this.m.compose(this.pos.set(h.x, 0, h.z), this.q, this.scl.set(s, s, s));
        mesh.setMatrixAt(slot, this.m);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }

    const n = Math.min(PELLET_CAP, world.pellets.length);
    for (let i = 0; i < n; i++) {
      const p = world.pellets[i];
      const left = 1 - (world.tick - p.born) / PELLET_LIFE_TICKS;
      const s = (1 + Math.sin(time * 5 + i) * 0.12) * Math.min(1, left * 5);
      this.m.makeScale(s, s, s).setPosition(p.x, 0.3 + Math.sin(time * 3 + i * 2) * 0.06, p.z);
      this.pellets.setMatrixAt(i, this.m);
    }
    this.pellets.count = n;
    this.pellets.instanceMatrix.needsUpdate = true;
  }
}
