import * as THREE from 'three';
import { logClamberHeight } from '../sim/commonLayout';
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

// London (Level 3).
const HIVIS = 0xd7f22c;
const STRIPE = 0xe6e9ee;
const ADULT_SKIN = 0xe9bf98;
const box = (w: number, h: number, d: number, color: number, x: number, y: number, z: number): Geo =>
  paint(new THREE.BoxGeometry(w, h, d), color, (g) => g.translate(x, y, z));
const cyl = (rt: number, rb: number, h: number, color: number, x: number, y: number, z: number, seg = 10): Geo =>
  paint(new THREE.CylinderGeometry(rt, rb, h, seg), color, (g) => g.translate(x, y, z));

/** A hi-vis vest over the torso: bright yellow-green with two silver bands. */
const hiVis = (): Geo[] => [
  paint(new THREE.CylinderGeometry(0.165, 0.165, 0.3, 8), HIVIS, (g) => g.translate(0, 0.45, 0)),
  ...[0.38, 0.5].map((y) => paint(new THREE.CylinderGeometry(0.168, 0.168, 0.03, 8), STRIPE, (g) => g.translate(0, y, 0))),
];

/** A grown-up on the same little-person kit: longer legs and body, a smaller head for their size. */
function grownUp(top: number, hair: number, legs: number): Geo[] {
  return [
    limb(0.15, 0.36, top, 0, 0.62, 0), // torso
    sphere(0.15, ADULT_SKIN, 0, 1.0, 0.02), // head
    sphere(0.165, hair, 0, 1.07, -0.02, 1, 0.65, 1),
    ...eyes(0.055, 1.0, 0.14),
    limb(0.05, 0.3, top, -0.21, 0.66, 0.02, 0.15),
    limb(0.05, 0.3, top, 0.21, 0.66, 0.02, -0.15),
    limb(0.06, 0.3, legs, -0.08, 0.2, 0),
    limb(0.06, 0.3, legs, 0.08, 0.2, 0),
  ];
}

/** The models, by kind; and the school trip's teacher, who leads the line. */
type Look = KidKind | 'teacher';

const MODELS: Record<Look, () => Geo[]> = {
  // Naughty: school uniform (navy jumper, yellow polo, grey trousers) and a cheeky cap.
  naughty: () => [...child(JUMPER, 0x2a2a2a, GREY, true), paint(new THREE.CylinderGeometry(0.19, 0.19, 0.05, 8), 0x1a234a, (g) => g.translate(0, 0.94, -0.02)), paint(new THREE.BoxGeometry(0.18, 0.03, 0.16), 0x1a234a, (g) => g.translate(0, 0.93, 0.16))],
  // Nice: school uniform (navy jumper, yellow polo, grey skirt) with bunches.
  nice: () => [...child(JUMPER, 0x6a4326, GREY, true), ...[-1, 1].map((s) => sphere(0.07, 0x6a4326, s * 0.16, 0.86, -0.02))],
  // Runner: PE kit — a white t-shirt and navy shorts, mid-dash.
  runner: () => child(PE_TOP, HAIR, PE_LEGS, false),
  // A tourist: a loud orange shirt, a straw sun hat, a camera round the neck and a little backpack.
  tourist: () => [
    ...grownUp(0xf08c2e, 0x6b4a2b, 0xc8b48a),
    cyl(0.13, 0.15, 0.1, 0xf1dc9a, 0, 1.17, -0.01), // the hat's crown...
    cyl(0.27, 0.27, 0.025, 0xf1dc9a, 0, 1.12, -0.01, 14), // ...and its wide brim
    box(0.15, 0.1, 0.07, 0x26262b, 0, 0.66, 0.17), // the camera
    paint(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 8), 0x101014, (g) => g.rotateX(Math.PI / 2).translate(0, 0.66, 0.22)), // its lens
    box(0.24, 0.3, 0.12, 0x3f7fc4, 0, 0.66, -0.2), // the backpack
  ],
  // A child on the school trip: a hi-vis vest over the jumper, holding the rope.
  trip: () => [...child(JUMPER, HAIR, GREY, false), ...hiVis()],
  // A busker: a flat cap, a waistcoat, a guitar, and the open case in front for coins.
  busker: () => [
    ...grownUp(0x5a3a78, 0x2a2a2a, 0x2b3550),
    cyl(0.16, 0.17, 0.07, 0x3b3b40, 0, 1.15, 0), // flat cap
    box(0.2, 0.025, 0.12, 0x3b3b40, 0, 1.13, 0.15), // its peak
    paint(new THREE.CylinderGeometry(0.17, 0.17, 0.07, 14), 0xb5702f, (g) => g.rotateX(Math.PI / 2).translate(-0.04, 0.55, 0.2)), // guitar body
    paint(new THREE.CylinderGeometry(0.035, 0.035, 0.072, 10), 0x2a1a10, (g) => g.rotateX(Math.PI / 2).translate(-0.04, 0.55, 0.21)), // the sound hole
    paint(new THREE.BoxGeometry(0.05, 0.42, 0.03), 0x5c3a1c, (g) => g.rotateZ(-0.9).translate(0.17, 0.66, 0.2)), // the neck
    box(0.6, 0.06, 0.32, 0x1d1d22, 0, 0.03, 0.6), // the open case...
    box(0.54, 0.02, 0.26, 0xa3242f, 0, 0.065, 0.6), // ...its red lining...
    ...[-0.12, 0.05, 0.16].map((x) => cyl(0.03, 0.03, 0.01, 0xf2c94c, x, 0.08, 0.6 + x * 0.3)), // ...and a few coins
  ],
  // The teacher at the front of the line: hi-vis vest, clipboard, a little taller than the children.
  teacher: () => [
    ...grownUp(0x2f6f9a, 0x8a5a2b, 0x2b2b33),
    paint(new THREE.CylinderGeometry(0.17, 0.17, 0.36, 8), HIVIS, (g) => g.translate(0, 0.62, 0)),
    ...[0.55, 0.7].map((y) => paint(new THREE.CylinderGeometry(0.173, 0.173, 0.035, 8), STRIPE, (g) => g.translate(0, y, 0))),
    box(0.16, 0.22, 0.02, 0x8a5a2b, 0.2, 0.55, 0.12), // the clipboard
  ],
};

/** How each scampers: [hop height, strides per metre, side-to-side waddle]. */
const GAIT: Record<Look, [number, number, number]> = {
  naughty: [0.1, 3, 0.05],
  nice: [0.08, 3, 0.06],
  runner: [0.18, 3.4, 0.03],
  tourist: [0.04, 2.2, 0.05],
  trip: [0.07, 3, 0.05],
  busker: [0, 0, 0],
  teacher: [0.05, 2.4, 0.04],
};
/** Drawn size: the children a touch bigger than life; London's grown-ups bigger still. */
const SIZE: Record<Look, number> = { naughty: 1.35, nice: 1.35, runner: 1.35, tourist: 1.6, trip: 1.35, busker: 1.6, teacher: 1.6 };
const LOOKS: readonly Look[] = [...KID_KINDS, 'teacher'];
/** The rope the trip holds: red, at the children's hands. */
const ROPE_Y = 0.42 * 1.35;

/** The Common's crowd of children (and London's people about town), one instanced mesh per kind. */
export class KidView {
  readonly group = new THREE.Group();
  private readonly meshes = new Map<Look, THREE.InstancedMesh>();
  private readonly travel = new Map<Look, number[]>();
  /** The school trip's rope: one short length between each pair in the line. */
  private readonly rope: THREE.InstancedMesh;
  private readonly x = new THREE.Vector3(1, 0, 0);
  private readonly dir = new THREE.Vector3();
  private clock = 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly pos = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();

  constructor(capacity: number) {
    for (const kind of LOOKS) {
      const mesh = new THREE.InstancedMesh(model(MODELS[kind](), kind), PAINTED, Math.max(1, capacity));
      mesh.frustumCulled = false;
      this.meshes.set(kind, mesh);
      this.travel.set(kind, []);
      this.group.add(mesh);
    }
    this.rope = new THREE.InstancedMesh(model([paint(new THREE.CylinderGeometry(0.05, 0.05, 1, 6), 0xff3b30, (g) => g.rotateZ(Math.PI / 2))], 'rope'), PAINTED, Math.max(1, capacity));
    this.rope.frustumCulled = false;
    this.rope.count = 0;
    this.group.add(this.rope);
  }

  update(world: WorldView, dt: number): void {
    this.clock += dt;
    for (const mesh of this.meshes.values()) mesh.count = 0;
    this.rope.count = 0;
    let prevTrip: { x: number; z: number } | null = null;
    for (let i = 0; i < world.kids.length; i++) {
      const k = world.kids[i];
      // The first of the school trip is its teacher, at the front of the line.
      const look: Look = k.kind === 'trip' && prevTrip === null ? 'teacher' : k.kind;
      if (k.kind === 'trip') {
        if (prevTrip) this.ropeBetween(prevTrip.x, prevTrip.z, k.x, k.z);
        prevTrip = k;
      }
      const mesh = this.meshes.get(look)!;
      const [hop, strides, waddle] = GAIT[look];
      const walked = this.travel.get(look)!;
      const slot = mesh.count;
      walked[slot] = (walked[slot] ?? 0) + k.speed * dt;
      const phase = walked[slot] * strides * Math.PI;
      const moving = k.speed > 0.05 ? 1 : 0;

      // A busker sways to the tune as they strum.
      const sway = k.kind === 'busker' ? Math.sin(this.clock * 5 + i) * 0.08 : 0;
      this.e.set(0, Math.PI / 2 - k.heading, Math.sin(phase) * waddle * moving + sway);
      this.q.setFromEuler(this.e);
      // A touch bigger than life, so they read as a proper crowd of children (~1.2 m tall).
      const s = SIZE[look];
      // Ride up and over the fallen log when scampering across it.
      const clamber = logClamberHeight(k.x, k.z);
      this.pos.set(k.x, clamber + Math.abs(Math.sin(phase)) * hop * moving, k.z);
      this.m.compose(this.pos, this.q, this.scale.set(s, s, s));
      mesh.setMatrixAt(mesh.count++, this.m);
    }
    for (const mesh of this.meshes.values()) mesh.instanceMatrix.needsUpdate = true;
    this.rope.instanceMatrix.needsUpdate = true;
  }

  /** A length of rope from one child's hands to the next. */
  private ropeBetween(ax: number, az: number, bx: number, bz: number): void {
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.05 || len > 2) return; // never a rope across the park (a snapshot jump)
    this.dir.set(bx - ax, 0, bz - az).normalize();
    this.q.setFromUnitVectors(this.x, this.dir);
    this.pos.set((ax + bx) / 2, ROPE_Y, (az + bz) / 2);
    this.m.compose(this.pos, this.q, this.scale.set(len, 1, 1));
    this.rope.setMatrixAt(this.rope.count++, this.m);
  }
}
