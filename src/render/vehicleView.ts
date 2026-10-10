import * as THREE from 'three';
import { VEHICLE_KINDS, type VehicleKind } from '../sim/vehicles';
import type { WorldView } from '../sim/view';
import { box, cyl, inkMaterial, merge, outlineGeometry, PALETTE, sphere, toonMaterial } from './london/landmarks/kit';

type Geo = THREE.BufferGeometry;

const RED = PALETTE.busRed;
const RED_DARK = 0xa8231a;
const CREAM = 0xf3e7c4;
const GLASS = 0x3c5a78;
const TYRE = 0x26262b;
const HUB = 0xc9ccd0;
const CAB = 0x1d1f24;
const YELLOW = 0xffd23f;
const LAMP = 0xfff6c8;

/** A wheel: a tyre on its side (axle along x) with a silver hub, centred at (x, r, z). */
function wheel(r: number, x: number, z: number): Geo[] {
  const side = Math.sign(x);
  return [
    cyl(r, r, 0.3, TYRE, 0, -0.15, 0, 12).rotateZ(Math.PI / 2).translate(x, r, z),
    cyl(r * 0.45, r * 0.45, 0.05, HUB, 0, -0.025, 0, 10).rotateZ(Math.PI / 2).translate(x + side * 0.16, r, z),
  ];
}

/** A red London double-decker, facing +z: two decks of windows, a cream band, a destination board. */
function bus(): Geo {
  const p: Geo[] = [
    box(2.2, 1.55, 6, RED, 0, 0.35, 0),
    box(2.26, 0.14, 6.06, CREAM, 0, 1.9, 0),
    box(2.2, 1.45, 5.9, RED, 0, 2.04, -0.05),
    box(2.06, 0.16, 5.7, RED_DARK, 0, 3.49, -0.05),
    // the windscreen, the upstairs front windows and the destination board
    box(1.9, 0.8, 0.05, GLASS, 0, 0.95, 3.0),
    box(1.9, 0.75, 0.05, GLASS, 0, 2.38, 2.92),
    box(1.5, 0.32, 0.06, 0x111114, 0, 1.92, 3.02),
    box(1.2, 0.16, 0.07, YELLOW, 0, 2.0, 3.03),
    sphere(0.14, LAMP, 0.78, 0.62, 3.0, 8, 6),
    sphere(0.14, LAMP, -0.78, 0.62, 3.0, 8, 6),
    box(1.6, 0.2, 0.1, 0x2a2a2e, 0, 0.32, 3.0),
  ];
  for (const sx of [1, -1]) {
    for (const z of [-2.0, -0.8, 0.4, 1.6]) p.push(box(0.06, 0.72, 0.95, GLASS, sx * 1.1, 0.98, z));
    for (const z of [-2.3, -1.2, -0.1, 1.0, 2.1]) p.push(box(0.06, 0.72, 0.9, GLASS, sx * 1.1, 2.38, z));
    p.push(...wheel(0.48, sx * 1.0, 1.9), ...wheel(0.48, sx * 1.0, -1.9));
  }
  return merge(p);
}

/** A black cab, facing +z: the tall cabin, chrome grille, round lamps and the yellow TAXI light. */
function cab(): Geo {
  const p: Geo[] = [
    box(1.8, 0.78, 3.8, CAB, 0, 0.3, 0),
    box(1.6, 0.7, 2.1, CAB, 0, 1.05, -0.3),
    box(1.45, 0.45, 0.05, GLASS, 0, 1.15, 0.76),
    box(1.3, 0.4, 0.05, GLASS, 0, 1.15, -1.36),
    box(0.55, 0.2, 0.28, YELLOW, 0, 1.75, 0.35),
    box(0.9, 0.3, 0.05, HUB, 0, 0.45, 1.91),
    sphere(0.13, LAMP, 0.62, 0.72, 1.85, 8, 6),
    sphere(0.13, LAMP, -0.62, 0.72, 1.85, 8, 6),
    box(1.84, 0.12, 0.12, HUB, 0, 0.26, 1.88),
  ];
  for (const sx of [1, -1]) {
    for (const z of [0.2, -0.8]) p.push(box(0.05, 0.42, 0.8, GLASS, sx * 0.81, 1.15, z));
    p.push(...wheel(0.36, sx * 0.82, 1.2), ...wheel(0.36, sx * 0.82, -1.25));
  }
  return merge(p);
}

const MODELS: Record<VehicleKind, () => Geo> = { bus, cab };

/** London's buses and cabs: one inked, instanced mesh per kind, rocking a little as they brake. */
export class VehicleView {
  readonly group = new THREE.Group();
  private readonly meshes = new Map<VehicleKind, THREE.InstancedMesh>();
  private readonly hulls = new Map<VehicleKind, THREE.InstancedMesh>();
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly pos = new THREE.Vector3();
  private readonly one = new THREE.Vector3(1, 1, 1);
  /** Each vehicle's speed last frame and its smoothed nose-dip. */
  private readonly lastSpeed: number[] = [];
  private readonly dip: number[] = [];

  constructor(capacity: number) {
    for (const kind of VEHICLE_KINDS) {
      const geo = MODELS[kind]();
      const mesh = new THREE.InstancedMesh(geo, toonMaterial(), Math.max(1, capacity));
      const hull = new THREE.InstancedMesh(outlineGeometry(geo, 0.05), inkMaterial(), Math.max(1, capacity));
      hull.instanceMatrix = mesh.instanceMatrix;
      mesh.castShadow = true;
      mesh.frustumCulled = hull.frustumCulled = false;
      mesh.count = hull.count = 0;
      this.meshes.set(kind, mesh);
      this.hulls.set(kind, hull);
      this.group.add(mesh, hull);
    }
  }

  update(world: WorldView, dt: number, time: number): void {
    for (const mesh of this.meshes.values()) mesh.count = 0;
    world.vehicles.forEach((v, i) => {
      const mesh = this.meshes.get(v.kind)!;
      // Braking dips the nose, pulling away lifts it: a cartoon rock on the springs.
      const decel = dt > 0 ? ((this.lastSpeed[i] ?? v.speed) - v.speed) / dt : 0;
      this.lastSpeed[i] = v.speed;
      const want = Math.max(-0.05, Math.min(0.07, decel * 0.025));
      this.dip[i] = (this.dip[i] ?? 0) + (want - (this.dip[i] ?? 0)) * Math.min(1, dt * 8);
      // Ticking over at a stop: a little shiver of the engine.
      const idle = v.speed < 0.05 ? Math.sin(time * 34 + i) * 0.012 : Math.sin(time * 9 + i) * 0.01;
      this.e.set(this.dip[i], Math.PI / 2 - v.heading, 0);
      this.q.setFromEuler(this.e);
      this.m.compose(this.pos.set(v.x, idle, v.z), this.q, this.one);
      mesh.setMatrixAt(mesh.count++, this.m);
    });
    for (const [kind, mesh] of this.meshes) {
      mesh.instanceMatrix.needsUpdate = true;
      this.hulls.get(kind)!.count = mesh.count;
    }
  }
}
