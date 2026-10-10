import * as THREE from 'three';
import { LION, LION_FOOT, PREDATOR_KINDS, type PredatorKind, RAVEN } from '../sim/predators';
import { RAVEN_PERCH_Y } from '../sim/londonLayout';
import type { WorldView } from '../sim/view';
import { box, cone, cyl, inkMaterial, merge, outlineGeometry, sphere as ksphere, toonMaterial } from './london/landmarks/kit';
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
const COMMON_MODELS: Record<'bear' | 'wolf', () => Geo[]> = {
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

// ---------------------------------------------------------------- London's beasts (inked, like the landmarks)

/** The Trafalgar statue's bronze (trafalgar.ts), so a lion off its plinth is plainly the same lion. */
const BRONZE = 0x9a7444;
const BRONZE_DARK = 0x553820;
const FACE = 0xb88f58;
const MUZZLE = 0xd1aa70;
const EYE = 0x343844;
const RAVEN_BLACK = 0x22232c;
const BEAK = 0x4c4d58;
/** The plinth tops (trafalgar.ts): where a lion stretches before it hops down. */
const PLINTH_H = 1.4;

/** A bronze lion standing on all fours, facing +z: the statue's mane, face and colours, up and walking. */
function lion(): Geo {
  const blob = (r: number, sx: number, sy: number, sz: number, color: number, x: number, y: number, z: number) =>
    ksphere(r, color, 0, 0, 0, 10, 8).scale(sx, sy, sz).translate(x, y, z);
  const p: Geo[] = [
    blob(0.55, 0.8, 0.7, 1.45, BRONZE, 0, 0.95, -0.15),
    blob(0.45, 1, 1, 1.05, BRONZE, 0, 0.98, -0.75),
    ...[[0.28, 0.45], [-0.28, 0.45], [0.28, -0.8], [-0.28, -0.8]].flatMap(([x, z]) => [
      cyl(0.13, 0.16, 0.85, BRONZE, x, 0.05, z, 8),
      blob(0.17, 1.1, 0.6, 1.3, FACE, x, 0.07, z + 0.08),
    ]),
    // the shaggy mane, then the golden face on the front of it
    blob(0.58, 1.15, 1.1, 0.8, BRONZE_DARK, 0, 1.38, 0.5),
    blob(0.34, 1, 1, 0.95, FACE, 0, 1.36, 0.82),
    blob(0.2, 1.2, 0.8, 1, MUZZLE, 0, 1.2, 1.1),
    ksphere(0.075, BRONZE_DARK, 0, 1.29, 1.28, 6, 4),
    ksphere(0.06, EYE, 0.13, 1.46, 1.06, 6, 4),
    ksphere(0.06, EYE, -0.13, 1.46, 1.06, 6, 4),
    ksphere(0.1, FACE, 0.24, 1.66, 0.82, 6, 4),
    ksphere(0.1, FACE, -0.24, 1.66, 0.82, 6, 4),
    // the tail, up and curling, with its tuft
    box(0.09, 0.09, 0.9, BRONZE, 0, 0, 0).rotateX(-0.7).translate(0, 1.0, -1.25),
    ksphere(0.14, BRONZE_DARK, 0, 1.58, -1.82, 6, 4),
  ];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    p.push(ksphere(0.19, BRONZE_DARK, Math.cos(a) * 0.6, 1.38 + Math.sin(a) * 0.56, 0.6, 6, 4));
  }
  return merge(p).scale(1.25, 1.25, 1.25);
}

/** A raven's body (the Tower's ravens, tower.ts), facing +z; the wings are their own meshes so they can flap. */
function ravenBody(): Geo {
  return merge([
    ksphere(0.28, RAVEN_BLACK, 0, 0, 0, 10, 8).scale(0.8, 0.85, 1.4).translate(0, 0.38, 0),
    ksphere(0.18, RAVEN_BLACK, 0, 0.66, 0.32, 8, 6),
    cone(0.07, 0.3, BEAK, 0, 0, 0, 6).rotateX(Math.PI / 2).translate(0, 0.62, 0.45),
    ksphere(0.045, 0xffffff, 0.12, 0.7, 0.4, 6, 4),
    ksphere(0.045, 0xffffff, -0.12, 0.7, 0.4, 6, 4),
    box(0.22, 0.05, 0.4, RAVEN_BLACK, 0, 0.32, -0.5).rotateX(-0.3),
  ]).scale(1.6, 1.6, 1.6);
}

/** One wing reaching out from the shoulder: to +x (side 1) or to −x (side −1). */
const wing = (side: number): Geo =>
  merge([box(0.75, 0.05, 0.42, RAVEN_BLACK, side * 0.37, -0.025, 0), box(0.3, 0.04, 0.3, 0x30313b, side * 0.82, -0.02, -0.06)]);

/** An instanced toon mesh with its ink hull riding on the same matrices. */
function inkedInstances(geo: Geo, capacity: number, thickness: number): { mesh: THREE.InstancedMesh; hull: THREE.InstancedMesh } {
  const mesh = new THREE.InstancedMesh(geo, toonMaterial(), Math.max(1, capacity));
  const hull = new THREE.InstancedMesh(outlineGeometry(geo, thickness), inkMaterial(), Math.max(1, capacity));
  hull.instanceMatrix = mesh.instanceMatrix;
  mesh.castShadow = true;
  mesh.frustumCulled = hull.frustumCulled = false;
  mesh.count = hull.count = 0;
  return { mesh, hull };
}

/** How each moves: [bob height, strides per metre, side-to-side sway]. */
const GAIT: Record<PredatorKind, [number, number, number]> = {
  bear: [0.06, 2.2, 0.05],
  wolf: [0.1, 3, 0.02],
  lion: [0.08, 1.6, 0.05],
  raven: [0, 0, 0],
};

/** The tower's ravens (tower.ts): the pair's two perches go empty while the birds are out hunting. */
interface PerchedRavens {
  away: boolean[];
}

/** The Common's bears and wolves, and London's lions and ravens: one instanced mesh per kind. */
export class PredatorView {
  readonly group = new THREE.Group();
  private readonly meshes = new Map<PredatorKind, THREE.InstancedMesh>();
  private readonly hulls = new Map<PredatorKind, THREE.InstancedMesh>();
  private readonly travel = new Map<PredatorKind, number[]>();
  private readonly wingL: { mesh: THREE.InstancedMesh; hull: THREE.InstancedMesh };
  private readonly wingR: { mesh: THREE.InstancedMesh; hull: THREE.InstancedMesh };
  private readonly m = new THREE.Matrix4();
  private readonly w = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly pos = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  /** Trafalgar's own statues, lion0..lion3, hidden while that lion is off prowling. */
  private statues: THREE.Object3D[] = [];
  private perched: PerchedRavens | null = null;
  /** Seconds each lion has spent waking (its stretch), and every raven's flap clock. */
  private readonly stretch: number[] = [];
  private clock = 0;

  constructor(capacity: number) {
    for (const kind of PREDATOR_KINDS) {
      if (kind === 'lion' || kind === 'raven') {
        const { mesh, hull } = inkedInstances(kind === 'lion' ? lion() : ravenBody(), capacity, kind === 'lion' ? 0.05 : 0.04);
        this.meshes.set(kind, mesh);
        this.hulls.set(kind, hull);
        this.group.add(mesh, hull);
      } else {
        const mesh = new THREE.InstancedMesh(model(COMMON_MODELS[kind](), kind), PAINTED, Math.max(1, capacity));
        mesh.frustumCulled = false;
        this.meshes.set(kind, mesh);
        this.group.add(mesh);
      }
      this.travel.set(kind, []);
    }
    this.wingL = inkedInstances(wing(-1), capacity, 0.03);
    this.wingR = inkedInstances(wing(1), capacity, 0.03);
    this.group.add(this.wingL.mesh, this.wingL.hull, this.wingR.mesh, this.wingR.hull);
  }

  /**
   * Hook up to the stage's scenery: Trafalgar's statue lions and the Tower's perched ravens, which
   * this view hides while their live twin is out. Anything left hidden by a previous view is shown again.
   */
  bind(root: THREE.Object3D | null): void {
    this.statues = [];
    this.perched = null;
    if (!root) return;
    for (let i = 0; ; i++) {
      const statue = root.getObjectByName(`lion${i}`);
      if (!statue) break;
      statue.visible = true;
      this.statues.push(statue);
    }
    const ravens = root.getObjectByName('towerRavens');
    if (ravens) {
      this.perched = ravens.userData as PerchedRavens;
      this.perched.away.fill(false);
    }
  }

  update(world: WorldView, dt: number): void {
    this.clock += dt;
    for (const mesh of this.meshes.values()) mesh.count = 0;
    this.wingL.mesh.count = this.wingR.mesh.count = 0;
    let lions = 0;
    let ravens = 0;
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
      let s = 1.15;
      let y = Math.abs(Math.sin(phase)) * bob * moving;
      let pitch = 0;

      if (p.kind === 'lion') {
        // Asleep on its plinth: that is Trafalgar's own bronze statue, not this one.
        const n = lions++;
        const asleep = p.state === LION.statue;
        if (this.statues[n]) this.statues[n].visible = asleep;
        this.stretch[n] = p.state === LION.waking ? (this.stretch[n] ?? 0) + dt : 0;
        if (asleep) continue;
        // On or hopping off its plinth: up on top, in a little arc down to the ground.
        const off = Math.hypot(p.x - p.hx, p.z - p.hz);
        if (off < LION_FOOT) y += PLINTH_H * (1 - off / LION_FOOT) + Math.sin((Math.PI * off) / LION_FOOT) * 0.5;
        // The waking yawn: rear up and stretch, then settle.
        const k = Math.min(1, this.stretch[n] / 0.75);
        pitch = -0.32 * Math.sin(k * Math.PI);
        s = 1;
      } else if (p.kind === 'raven') {
        const n = ravens++;
        const home = p.state === RAVEN.perched;
        if (this.perched && n < this.perched.away.length) this.perched.away[n] = !home;
        if (home) continue; // roosting: the Tower draws it
        // High by the Tower, low over a snake: it dives as it flies out, and climbs as it comes home.
        const off = Math.hypot(p.x - p.hx, p.z - p.hz);
        y = p.state === RAVEN.caw ? RAVEN_PERCH_Y + 0.45 : 0.9 + (RAVEN_PERCH_Y - 0.9) * Math.max(0, 1 - off / 10);
        y += Math.sin(this.clock * 9 + n) * 0.08;
        pitch = p.state === RAVEN.swoop ? 0.25 : 0;
        s = 1;
      }

      this.e.set(pitch, Math.PI / 2 - p.heading, Math.sin(phase) * sway * moving);
      this.q.setFromEuler(this.e);
      this.pos.set(p.x, y, p.z);
      this.m.compose(this.pos, this.q, this.scale.set(s, s, s));
      mesh.setMatrixAt(mesh.count++, this.m);

      if (p.kind === 'raven') {
        // Wings: a quick flap while flying out, a slower one gliding home, a flurry while it caws.
        const rate = p.state === RAVEN.caw ? 24 : p.state === RAVEN.swoop ? 16 : 10;
        const flap = Math.sin(this.clock * rate + i * 1.7) * (p.speed > 0 || p.state === RAVEN.caw ? 0.7 : 0.15);
        for (const [side, wing] of [[1, this.wingR], [-1, this.wingL]] as const) {
          this.w.makeRotationZ(side * flap).setPosition(side * 0.2, 0.75, 0.05);
          this.w.premultiply(this.m);
          wing.mesh.setMatrixAt(wing.mesh.count++, this.w);
        }
      }
    }
    for (const [kind, mesh] of this.meshes) {
      mesh.instanceMatrix.needsUpdate = true;
      const hull = this.hulls.get(kind);
      if (hull) hull.count = mesh.count;
    }
    for (const wing of [this.wingL, this.wingR]) {
      wing.hull.count = wing.mesh.count;
      wing.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
