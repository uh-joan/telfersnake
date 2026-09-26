import * as THREE from 'three';
import { KID_KINDS, type KidKind } from '../sim/kids';
import type { WorldView } from '../sim/view';
import { model, paint, PAINTED } from './paint';

type Geo = THREE.BufferGeometry;
const SKIN = 0xf0c8a0;
const HAIR = 0x5a3d25;
// Telferscot uniform: a navy jumper with a yellow polo, over grey trousers/skirt.
const JUMPER = 0x25305e;
const POLO = 0xf2c94c;
const GREY = 0x565b68;
// PE kit: a white t-shirt and navy shorts.
const PE_TOP = 0xf2f2f2;
const PE_LEGS = 0x25305e;

const sphere = (r: number, color: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1): Geo =>
  paint(new THREE.SphereGeometry(r, 9, 7), color, (g) => g.scale(sx, sy, sz).translate(x, y, z));
const limb = (r: number, h: number, color: number, x: number, y: number, z: number, tilt = 0): Geo =>
  paint(new THREE.CapsuleGeometry(r, h, 3, 6), color, (g) => g.rotateX(tilt).translate(x, y, z));
const eyes = (x: number, y: number, z: number): Geo[] =>
  [-1, 1].map((s) => sphere(0.028, 0x2a2a2a, s * x, y, z));

/** A little child, ~0.9 m tall, facing +z. `top` is the shirt/jumper, `legs` the trousers/shorts. */
function child(top: number, hair: number, legs: number, collar: boolean): Geo[] {
  return [
    limb(0.15, 0.28, top, 0, 0.42, 0, Math.PI / 2), // torso
    // A white polo collar peeks out of the school jumper.
    ...(collar ? [paint(new THREE.CylinderGeometry(0.16, 0.16, 0.07, 8), POLO, (g) => g.translate(0, 0.59, 0.02))] : []),
    sphere(0.17, SKIN, 0, 0.74, 0.02), // head
    sphere(0.19, hair, 0, 0.82, -0.02, 1, 0.7, 1), // hair mop
    ...eyes(0.06, 0.74, 0.15),
    // arms
    limb(0.05, 0.18, top, -0.2, 0.42, 0.02, 0.3),
    limb(0.05, 0.18, top, 0.2, 0.42, 0.02, -0.3),
    // legs
    limb(0.06, 0.2, legs, -0.09, 0.12, 0),
    limb(0.06, 0.2, legs, 0.09, 0.12, 0),
  ];
}

const MODELS: Record<KidKind, () => Geo[]> = {
  // Naughty: school uniform (navy jumper, yellow polo, grey trousers) and a cheeky cap.
  naughty: () => [...child(JUMPER, 0x2a2a2a, GREY, true), paint(new THREE.CylinderGeometry(0.19, 0.19, 0.05, 8), 0x1a234a, (g) => g.translate(0, 0.94, -0.02)), paint(new THREE.BoxGeometry(0.18, 0.03, 0.16), 0x1a234a, (g) => g.translate(0, 0.93, 0.16))],
  // Nice: school uniform (navy jumper, yellow polo, grey skirt) with bunches.
  nice: () => [...child(JUMPER, 0x6a4326, GREY, true), ...[-1, 1].map((s) => sphere(0.07, 0x6a4326, s * 0.16, 0.86, -0.02))],
  // Runner: PE kit — a white t-shirt and navy shorts, mid-dash.
  runner: () => child(PE_TOP, HAIR, PE_LEGS, false),
};

/** How each scampers: [hop height, strides per metre, side-to-side waddle]. */
const GAIT: Record<KidKind, [number, number, number]> = {
  naughty: [0.1, 3, 0.05],
  nice: [0.08, 3, 0.06],
  runner: [0.18, 3.4, 0.03],
};

/** The Common's crowd of children, one instanced mesh per kind. */
export class KidView {
  readonly group = new THREE.Group();
  private readonly meshes = new Map<KidKind, THREE.InstancedMesh>();
  private readonly travel = new Map<KidKind, number[]>();
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly pos = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();

  constructor(capacity: number) {
    for (const kind of KID_KINDS) {
      const mesh = new THREE.InstancedMesh(model(MODELS[kind](), kind), PAINTED, Math.max(1, capacity));
      mesh.frustumCulled = false;
      this.meshes.set(kind, mesh);
      this.travel.set(kind, []);
      this.group.add(mesh);
    }
  }

  update(world: WorldView, dt: number): void {
    for (const mesh of this.meshes.values()) mesh.count = 0;
    for (let i = 0; i < world.kids.length; i++) {
      const k = world.kids[i];
      const mesh = this.meshes.get(k.kind)!;
      const [hop, strides, waddle] = GAIT[k.kind];
      const walked = this.travel.get(k.kind)!;
      const slot = mesh.count;
      walked[slot] = (walked[slot] ?? 0) + k.speed * dt;
      const phase = walked[slot] * strides * Math.PI;
      const moving = k.speed > 0.05 ? 1 : 0;

      this.e.set(0, Math.PI / 2 - k.heading, Math.sin(phase) * waddle * moving);
      this.q.setFromEuler(this.e);
      // A touch bigger than life, so they read as a proper crowd of children (~1.2 m tall).
      const s = 1.35;
      this.pos.set(k.x, Math.abs(Math.sin(phase)) * hop * moving, k.z);
      this.m.compose(this.pos, this.q, this.scale.set(s, s, s));
      mesh.setMatrixAt(mesh.count++, this.m);
    }
    for (const mesh of this.meshes.values()) mesh.instanceMatrix.needsUpdate = true;
  }
}
