import * as THREE from 'three';
import { CREATURE_KINDS, CREATURES, type CreatureKind } from '../sim/creatures';
import type { WorldView } from '../sim/view';
import { model, paint, PAINTED } from './paint';

type Geo = THREE.BufferGeometry;
const DARK = 0x2a2a2e;

const sphere = (r: number, color: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1): Geo =>
  paint(new THREE.SphereGeometry(r, 10, 8), color, (g) => g.scale(sx, sy, sz).translate(x, y, z));
const leg = (r: number, h: number, color: number, x: number, z: number): Geo =>
  paint(new THREE.CylinderGeometry(r, r, h, 6), color, (g) => g.translate(x, h / 2, z));
const eyes = (r: number, x: number, y: number, z: number, color = DARK): Geo[] =>
  [-1, 1].map((s) => sphere(r, color, s * x, y, z));
const fourLegs = (r: number, h: number, color: number, x: number, z: number): Geo[] =>
  [[-x, -z], [x, -z], [-x, z], [x, z]].map(([lx, lz]) => leg(r, h, color, lx, lz));

/** Every model faces +z and stands on y = 0. Bright and a little unreal — these are magic things. */
const MODELS: Record<CreatureKind, () => Geo[]> = {
  // The White Stag: pale, grand, golden antlers.
  stag: () => [
    paint(new THREE.CapsuleGeometry(0.28, 0.66, 4, 10), 0xf3efe6, (g) => g.rotateX(Math.PI / 2).translate(0, 0.92, 0)),
    paint(new THREE.CylinderGeometry(0.1, 0.13, 0.56, 8), 0xf3efe6, (g) => g.rotateX(0.5).translate(0, 1.16, 0.38)),
    sphere(0.15, 0xf7f4ee, 0, 1.42, 0.64, 1, 1.2, 1.15),
    ...[-1, 1].flatMap((s) => [
      paint(new THREE.ConeGeometry(0.03, 0.34, 5), 0xe6c766, (g) => g.rotateX(-0.4).rotateZ(s * 0.3).translate(s * 0.1, 1.66, 0.6)),
      paint(new THREE.ConeGeometry(0.025, 0.2, 5), 0xe6c766, (g) => g.rotateZ(s * 1).translate(s * 0.22, 1.74, 0.58)),
    ]),
    ...eyes(0.03, 0.08, 1.44, 0.74),
    ...fourLegs(0.05, 0.68, 0xe9e4d8, 0.19, 0.36),
  ],
  // Unicorn: white horse, spiral horn, pink mane.
  unicorn: () => [
    paint(new THREE.CapsuleGeometry(0.26, 0.62, 4, 10), 0xffffff, (g) => g.rotateX(Math.PI / 2).translate(0, 0.86, 0)),
    paint(new THREE.CylinderGeometry(0.12, 0.14, 0.5, 8), 0xffffff, (g) => g.rotateX(0.6).translate(0, 1.06, 0.36)),
    sphere(0.16, 0xffffff, 0, 1.3, 0.6, 1, 1.15, 1.2),
    paint(new THREE.ConeGeometry(0.045, 0.34, 6), 0xffe066, (g) => g.rotateX(0.3).translate(0, 1.56, 0.66)),
    ...[0.2, 0.05, -0.1].map((z) => sphere(0.09, 0xffc0e0, 0, 1.2 + z * 0.2, z, 0.6, 1, 1)),
    ...eyes(0.03, 0.09, 1.32, 0.7),
    ...fourLegs(0.05, 0.62, 0xf3f3f3, 0.18, 0.34),
  ],
  // Wise Owl: round, big eyes, ear tufts, perched-ish.
  owl: () => [
    sphere(0.32, 0x8a6b4a, 0, 0.5, 0, 1, 1.2, 1),
    sphere(0.22, 0xc9a878, 0, 0.42, 0.24, 1, 1.1, 0.6),
    ...eyes(0.12, 0.14, 0.66, 0.2, 0xf5f0d8),
    ...eyes(0.06, 0.14, 0.66, 0.28, 0x2a2a2e),
    paint(new THREE.ConeGeometry(0.06, 0.14, 4), 0xffb03a, (g) => g.rotateX(Math.PI / 2).translate(0, 0.6, 0.34)),
    ...[-1, 1].map((s) => paint(new THREE.ConeGeometry(0.09, 0.2, 4), 0x6b5136, (g) => g.translate(s * 0.22, 0.82, -0.02))),
  ],
  // Frog Prince: squat green, big eyes, a tiny gold crown.
  frog: () => [
    sphere(0.3, 0x5cbf5c, 0, 0.24, 0, 1.2, 0.9, 1.1),
    sphere(0.16, 0xbfe89a, 0, 0.16, 0.24, 1.2, 0.7, 1),
    ...eyes(0.1, 0.14, 0.4, 0.06, 0xf0f0d0),
    ...eyes(0.05, 0.14, 0.42, 0.13),
    paint(new THREE.CylinderGeometry(0.14, 0.18, 0.06, 8), 0xffd23c, (g) => g.translate(0, 0.5, -0.02)),
    ...[-1, 1].map((s) => sphere(0.09, 0x4aa84a, s * 0.28, 0.08, -0.1, 1, 0.6, 1.4)),
  ],
  // Kitsune: pale fox with two tails.
  kitsune: () => [
    sphere(0.19, 0xf3ead8, 0, 0.28, 0, 1, 1, 1.4),
    sphere(0.13, 0xffffff, 0, 0.2, 0.28, 1, 0.9, 0.8),
    sphere(0.14, 0xf3ead8, 0, 0.4, 0.22),
    ...[-1, 1].map((s) => paint(new THREE.ConeGeometry(0.06, 0.18, 4), 0xd8a86a, (g) => g.translate(s * 0.09, 0.56, 0.16))),
    ...eyes(0.028, 0.07, 0.44, 0.32, 0x8a5cc0),
    ...[-1, 1].flatMap((s) => [0.24, 0.34].map((y, i) => sphere(0.11 - i * 0.02, 0xf7efdf, s * 0.1, y, -0.28 - i * 0.14, 1, 1, 1.3))),
    ...fourLegs(0.04, 0.24, 0xe6d8c0, 0.12, 0.2),
  ],
  // Pixie: a tiny glowing sprite with wings, hovering.
  pixie: () => [
    sphere(0.12, 0xffe9b0, 0, 0.9, 0, 1, 1.4, 1),
    sphere(0.1, 0xf0c8a0, 0, 1.06, 0.02),
    ...[-1, 1].map((s) => paint(new THREE.SphereGeometry(0.16, 8, 6), 0xbdf5e6, (g) => g.scale(0.35, 1, 0.8).translate(s * 0.2, 0.98, -0.08))),
    ...eyes(0.02, 0.04, 1.07, 0.09),
  ],
  // Golden Squirrel: bright gold squirrel with a huge tail.
  squirrel: () => [
    sphere(0.19, 0xf0b429, 0, 0.24, 0, 1, 1.05, 1.3),
    sphere(0.15, 0xf0b429, 0, 0.42, 0.2),
    ...[-1, 1].map((s) => paint(new THREE.ConeGeometry(0.05, 0.12, 5), 0xf0b429, (g) => g.translate(s * 0.08, 0.56, 0.18))),
    sphere(0.035, 0x3a2a1c, 0, 0.4, 0.38),
    ...eyes(0.03, 0.06, 0.46, 0.32),
    ...[[0.3, -0.26, 0.26], [0.52, -0.28, 0.3], [0.72, -0.2, 0.26]].map(([y, z, r]) => sphere(r, 0xffd76a, 0, y, z, 0.8, 1, 0.6)),
  ],
  // Will-o'-the-wisp: just a floating orb of light, a pale violet to match its ring (never a pebble-beige).
  wisp: () => [
    sphere(0.2, 0xffffff, 0, 1.0, 0),
    sphere(0.32, 0xe2d2ff, 0, 1.0, 0, 1, 1, 1),
  ],
};

/**
 * How big each kind is drawn. The little ones get the biggest boost: at the follow camera's height a
 * true-to-life frog or pixie is no bigger than a snake's head.
 */
const SIZE: Record<CreatureKind, number> = {
  stag: 1.7, unicorn: 1.8, owl: 2.3, frog: 2.5, kitsune: 2.3, pixie: 2.6, squirrel: 2.4, wisp: 2.4,
};
/** Radius of the glowing ring on the ground under each one. */
const RING: Record<CreatureKind, number> = {
  stag: 2.0, unicorn: 1.9, owl: 1.6, frog: 1.6, kitsune: 1.6, pixie: 1.5, squirrel: 1.6, wisp: 1.7,
};

/** A soft disc with a brighter rim — a little magic circle — tinted per creature by its instance colour. */
function ringTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.4)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.3)');
  grad.addColorStop(0.8, 'rgba(255,255,255,0.95)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/** Faced with a snake they flee, so a bobbing hover reads them as light and unreal. */
export class CreatureView {
  readonly group = new THREE.Group();
  private readonly meshes = new Map<CreatureKind, THREE.InstancedMesh>();
  /** A pulsing ring of each creature's own colour on the ground beneath it. */
  private readonly rings: THREE.InstancedMesh;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly flat = new THREE.Quaternion();
  private readonly e = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly pos = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly col = new THREE.Color();
  private readonly white = new THREE.Color(0xffffff);
  private readonly hidden = new THREE.Vector3(0, -999, 0);

  constructor(capacity: number) {
    for (const kind of CREATURE_KINDS) {
      const mesh = new THREE.InstancedMesh(model(MODELS[kind](), kind), PAINTED, Math.max(1, capacity));
      mesh.frustumCulled = false;
      this.meshes.set(kind, mesh);
      this.group.add(mesh);
    }
    this.rings = new THREE.InstancedMesh(
      new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2),
      // Normal blending, not additive: on green grass additive light drifts every hue toward cyan or
      // yellow, and the whole point of the ring is that each creature's colour is its own.
      new THREE.MeshBasicMaterial({ map: ringTexture(), transparent: true, depthWrite: false }),
      Math.max(1, capacity),
    );
    this.rings.frustumCulled = false;
    this.rings.setColorAt(0, this.col.set(0xffffff));
    this.rings.count = 0;
    this.group.add(this.rings);
  }

  update(world: WorldView, time: number): void {
    for (const mesh of this.meshes.values()) mesh.count = 0;
    this.rings.count = 0;
    world.creatures.forEach((c, i) => {
      const mesh = this.meshes.get(c.kind)!;
      if (c.respawnIn > 0) {
        // Faded after a gulp: park the instance far below the ground (and draw no ring).
        this.m.compose(this.hidden, this.q, this.scale.set(1, 1, 1));
        mesh.setMatrixAt(mesh.count++, this.m);
        return;
      }
      const bob = Math.sin(time * 2 + i) * 0.12;
      this.e.set(0, Math.PI / 2 - c.heading, 0);
      this.q.setFromEuler(this.e);
      const s = SIZE[c.kind];
      this.pos.set(c.x, bob, c.z);
      this.m.compose(this.pos, this.q, this.scale.set(s, s, s));
      mesh.setMatrixAt(mesh.count++, this.m);

      // The ring breathes, each out of step with the others.
      const beat = Math.sin(time * 3 + i * 1.7);
      const r = RING[c.kind] * (0.92 + 0.08 * beat);
      this.m.compose(this.pos.set(c.x, 0.05, c.z), this.flat, this.scale.set(r, 1, r));
      this.rings.setMatrixAt(this.rings.count, this.m);
      // Pulse toward white (a flash of light) rather than toward dark.
      this.col.setHex(CREATURES[c.kind].glow).lerp(this.white, 0.3 * (0.5 + 0.5 * beat));
      this.rings.setColorAt(this.rings.count++, this.col);
    });
    for (const mesh of this.meshes.values()) mesh.instanceMatrix.needsUpdate = true;
    this.rings.instanceMatrix.needsUpdate = true;
    if (this.rings.instanceColor) this.rings.instanceColor.needsUpdate = true;
  }
}
