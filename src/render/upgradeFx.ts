import * as THREE from 'three';
import type { Snake } from '../sim/snake';
import type { WorldView } from '../sim/view';

const FLAME_LIFE = 0.6;
const FLAME_LAYERS: [color: number, width: number, length: number][] = [
  [0xff4500, 1, 1],
  [0xff9500, 0.72, 0.86],
  [0xffe066, 0.42, 0.66],
];
const BREATH_SPREAD = Math.tan(0.5); // matches the sim's breath cone
const DAZE_STARS = 3;
const DAZE_CAP = 48;

interface Flame {
  group: THREE.Group;
  layers: THREE.Mesh[];
  snake: Snake;
  range: number;
  age: number;
}

/**
 * Unlit and see-through. Deliberately not additive: most of the playground is bright (the court,
 * the lagoon), and additive fire washes out to white there instead of reading as orange flame.
 */
const glow = (color: number) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: THREE.DoubleSide });

/**
 * The parts of upgrades you can see happening in the world: the dragon's flame, the magnet's
 * pull, and the stars circling a dazzled animal's head. All of it only draws what the sim decided.
 */
export class UpgradeFx {
  readonly group = new THREE.Group();
  private readonly cone: THREE.BufferGeometry;
  private readonly flames: Flame[] = [];
  private readonly rings: THREE.Mesh[] = [];
  private readonly stars: THREE.InstancedMesh;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly pos = new THREE.Vector3();
  private readonly scl = new THREE.Vector3();

  constructor() {
    // A unit cone with its point at the origin, opening along +z.
    this.cone = new THREE.ConeGeometry(1, 1, 14, 1, true).translate(0, -0.5, 0).rotateX(-Math.PI / 2);

    // Magnet Tail: two rings that shrink toward the head over and over, like something being sucked in.
    const ringGeo = new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2);
    for (let i = 0; i < 2; i++) {
      const ring = new THREE.Mesh(ringGeo, glow(0xe03131));
      ring.visible = false;
      this.rings.push(ring);
      this.group.add(ring);
    }

    this.stars = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.13), new THREE.MeshBasicMaterial({ color: 0xffe066 }), DAZE_CAP);
    this.stars.frustumCulled = false;
    this.stars.count = 0;
    this.group.add(this.stars);
  }

  /** Dragon Breath: a jet of fire out of the mouth that follows the head while it lasts. */
  breathe(snake: Snake, range: number): void {
    const group = new THREE.Group();
    const layers = FLAME_LAYERS.map(([color], k) => {
      const layer = new THREE.Mesh(this.cone, glow(color));
      layer.renderOrder = 10 + k; // red outside first, the yellow heart drawn last, on top
      return layer;
    });
    group.add(...layers);
    this.group.add(group);
    this.flames.push({ group, layers, snake, range, age: 0 });
  }

  update(world: WorldView, dt: number, time: number): void {
    for (let i = this.flames.length - 1; i >= 0; i--) {
      const f = this.flames[i];
      f.age += dt;
      if (f.age >= FLAME_LIFE || !f.snake.alive) {
        this.group.remove(f.group);
        for (const layer of f.layers) (layer.material as THREE.Material).dispose();
        this.flames.splice(i, 1);
        continue;
      }
      const t = f.age / FLAME_LIFE;
      const s = f.snake;
      // Shoots out fast, holds, then thins away.
      const reach = f.range * Math.min(1, t * 5);
      const fade = t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45;
      f.group.position.set(s.x + Math.cos(s.heading) * s.radius, s.radius * 1.1, s.z + Math.sin(s.heading) * s.radius);
      f.group.rotation.y = Math.PI / 2 - s.heading;
      f.layers.forEach((layer, k) => {
        const [, width, length] = FLAME_LAYERS[k];
        const flicker = 1 + Math.sin(time * 40 + k * 2.1) * 0.1;
        const wide = reach * BREATH_SPREAD * width * flicker;
        layer.scale.set(wide, wide * 0.45, reach * length);
        (layer.material as THREE.MeshBasicMaterial).opacity = 0.9 * fade;
      });
    }

    const player = world.snake;
    const pulling = player.alive && player.magnet > 0;
    this.rings.forEach((ring, k) => {
      ring.visible = pulling;
      if (!pulling) return;
      const phase = (time * 0.8 + k * 0.5) % 1;
      const r = player.magnet * (1 - phase * 0.75);
      ring.position.set(player.x, 0.06, player.z);
      ring.scale.set(r, 1, r);
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.75 * Math.sin(phase * Math.PI);
    });

    // Stars going round the head of anything the dragon has dazzled.
    let n = 0;
    for (const a of world.animals) {
      if (a.dazed <= 0) continue;
      for (let k = 0; k < DAZE_STARS && n < DAZE_CAP; k++) {
        const angle = time * 5 + (k * Math.PI * 2) / DAZE_STARS;
        this.e.set(time * 3, angle, 0);
        this.pos.set(a.x + Math.cos(angle) * 0.55, 1.5, a.z + Math.sin(angle) * 0.55);
        this.stars.setMatrixAt(n++, this.m.compose(this.pos, this.q.setFromEuler(this.e), this.scl.set(1, 1, 1)));
      }
    }
    if (n > 0 || this.stars.count > 0) this.stars.instanceMatrix.needsUpdate = true;
    this.stars.count = n;
  }
}
