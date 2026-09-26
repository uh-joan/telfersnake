import * as THREE from 'three';
import type { Snake } from '../sim/snake';
import { makeHat } from './hats';
import { disposeTree } from './paint';

const MAX_SEGMENTS = 96; // a 60 m snake needs about 50; small fast-growing ones a few more
const BUMP_SPEED = 9; // m/s a swallowed snack travels down the body
const BUMP_WIDTH = 0.55;
const MAX_BUMPS = 10;
const LICK_FOR = 0.2; // seconds a Long Tongue lash lasts

/** One snake: instanced body, googly-eyed head, and whatever kit its upgrades have earned it. */
export class SnakeView {
  readonly group = new THREE.Group();
  private readonly body: THREE.InstancedMesh;
  private readonly spikes: THREE.InstancedMesh;
  private readonly head = new THREE.Group();
  private readonly helmet = new THREE.Group();
  /** The Dragon (top size tier): a big red dragon head — horns, crest, snout and fangs. */
  private readonly dragon = new THREE.Group();
  private readonly tongue: THREE.Mesh;
  private readonly hat: THREE.Group | null;
  private readonly hatSpin: THREE.Object3D | null;
  private hatY = 0;
  /** Bubble Wrap: a see-through shell round every segment. Built the first time it is needed. */
  private wrap: THREE.InstancedMesh | null = null;
  /** Magnet Tail: a horseshoe magnet on the tip of the tail. */
  private readonly magnet = new THREE.Group();
  private lickX = 0;
  private lickZ = 0;
  private lickLeft = 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly pos = new THREE.Vector3();
  private readonly scl = new THREE.Vector3();
  private readonly p = { x: 0, z: 0 };
  private readonly next = { x: 0, z: 0 };
  /** Distance behind the head of each snack bulge currently travelling tailward. */
  private readonly bumps: number[] = [];

  /** `hatId` is a Tuck Shop hat. */
  constructor(private readonly snake: Snake, hatId = 'no-hat') {
    const look = snake.look;
    const pattern = (look.pattern ?? [look.body, look.body, look.body, look.body, look.stripe]).map((c) => new THREE.Color(c));

    this.body = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 14, 10), new THREE.MeshLambertMaterial({ color: 0xffffff }), MAX_SEGMENTS,
    );
    this.body.frustumCulled = false;
    for (let i = 0; i < MAX_SEGMENTS; i++) this.body.setColorAt(i, pattern[i % pattern.length]);

    // Hedgehog Spikes: a little crest of cones, one per body segment.
    this.spikes = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.28, 0.9, 6).translate(0, 0.45, 0), new THREE.MeshLambertMaterial({ color: 0xfff1c9 }), MAX_SEGMENTS,
    );
    this.spikes.frustumCulled = false;
    this.spikes.count = 0;
    this.group.add(this.body, this.spikes);

    // Head is modelled at radius 1 facing +z, then scaled to the snake.
    const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshLambertMaterial({ color: look.head }));
    skull.scale.set(1.2, 1, 1.35);
    this.head.add(skull);
    const white = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const black = new THREE.MeshLambertMaterial({ color: 0x15181d });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), white);
      eye.position.set(side * 0.55, 0.62, 0.55);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), black);
      pupil.position.set(side * 0.6, 0.7, 0.86);
      this.head.add(eye, pupil);
    }
    this.tongue = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 1), new THREE.MeshLambertMaterial({ color: 0xe0524d }));
    this.tongue.geometry.translate(0, 0, 0.5);
    this.tongue.position.set(0, -0.2, 1.2);
    this.head.add(this.tongue);

    // Bike Helmet: red shell with a white stripe and a little peak.
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(1.12, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.48), new THREE.MeshLambertMaterial({ color: 0xe03131 }),
    );
    shell.scale.set(1.18, 1.0, 1.05);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 2.0), white);
    stripe.position.y = 1.12;
    const peak = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.6), new THREE.MeshLambertMaterial({ color: 0xb02525 }));
    peak.position.set(0, 0.5, 1.15);
    this.helmet.add(shell, stripe, peak);
    // Worn well back so the googly eyes still peek out from under the peak.
    this.helmet.position.set(0, 0.2, -0.42);
    this.helmet.visible = false;
    this.head.add(this.helmet);

    // The Dragon: a big red dragon head that appears at the very top size tier.
    const dragonRed = new THREE.MeshLambertMaterial({ color: 0xc0271f });
    const bone = new THREE.MeshLambertMaterial({ color: 0xf0e2c4 });
    const mask = new THREE.Mesh(new THREE.SphereGeometry(1.06, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), dragonRed);
    mask.scale.set(1.24, 1.04, 1.4); // a red scaly crown over the skull
    mask.position.set(0, 0.05, -0.05);
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.4, 4), dragonRed);
    snout.rotation.set(Math.PI / 2, Math.PI / 4, 0);
    snout.position.set(0, -0.12, 1.05);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.34, 0.55), dragonRed);
    brow.position.set(0, 0.95, 0.6);
    brow.rotation.x = -0.32;
    this.dragon.add(mask, snout, brow);
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.24, 1.7, 6), bone);
      horn.position.set(side * 0.52, 1.2, -0.35);
      horn.rotation.set(-0.95, 0, side * 0.28);
      const fang = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.42, 5), bone);
      fang.rotation.x = Math.PI;
      fang.position.set(side * 0.32, -0.55, 1.05);
      this.dragon.add(horn, fang);
    }
    // A spiny crest running back over the crown.
    for (let i = 0; i < 4; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.55, 4), dragonRed);
      spike.position.set(0, 1.15 - i * 0.06, -0.15 - i * 0.5);
      spike.rotation.x = -0.2;
      this.dragon.add(spike);
    }
    this.dragon.visible = false;
    this.head.add(this.dragon);

    const red = new THREE.MeshLambertMaterial({ color: 0xe03131 });
    const horseshoe = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.2, 8, 14, Math.PI), red);
    horseshoe.rotation.x = -Math.PI / 2;
    this.magnet.add(horseshoe);
    for (const side of [-1, 1]) {
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 8), white);
      tip.rotation.x = Math.PI / 2;
      tip.position.set(side * 0.55, 0, -0.15);
      this.magnet.add(tip);
    }
    this.magnet.visible = false;
    this.group.add(this.magnet);

    this.hat = makeHat(hatId);
    this.hatSpin = this.hat?.getObjectByName('spin') ?? null;
    if (this.hat) {
      // Oversized on purpose: from the follow camera a true-to-scale hat is a few pixels.
      this.hat.scale.setScalar(1.3);
      this.hat.position.y = this.hat.position.y * 1.3 + 0.9;
      this.hatY = this.hat.position.y;
      this.hat.position.z -= 0.2;
      this.hat.rotation.x = -0.15;
      this.head.add(this.hat);
    }

    this.group.add(this.head);
  }

  /** Free everything this view put on the graphics card. Views are rebuilt when a seat changes hands or clothes. */
  dispose(): void {
    disposeTree(this.group); // hat materials are shared between all hats (see hats.ts) and are left alone
  }

  /** Long Tongue: lash out at something just eaten at (x, z). */
  lick(x: number, z: number): void {
    this.lickX = x;
    this.lickZ = z;
    this.lickLeft = LICK_FOR;
  }

  /** Start a bulge at the mouth. */
  swallow(): void {
    // A feasting snake would otherwise carry dozens at once, each costing an exp() per segment.
    if (this.bumps.length >= MAX_BUMPS) this.bumps.shift();
    this.bumps.push(0);
  }

  update(dt: number, time: number): void {
    const snake = this.snake;
    // Gone while bonked; blinking while it cannot be touched.
    this.group.visible = snake.alive && (snake.immune <= 0 || Math.floor(time * 12) % 2 === 0);
    if (!snake.alive) {
      this.bumps.length = 0;
      return;
    }

    const r = snake.radius;
    const length = snake.length;
    let kept = 0;
    for (let i = 0; i < this.bumps.length; i++) {
      const d = this.bumps[i] + BUMP_SPEED * dt;
      if (d < length + 1) this.bumps[kept++] = d;
    }
    this.bumps.length = kept;

    // A Stretchy Belly shows: the more levels, the bigger the bulge each snack makes.
    const bulge = 0.5 + 0.22 * snake.levelOf('belly');
    const wrapped = snake.rockGuard > 0;
    if (wrapped && !this.wrap) {
      this.wrap = new THREE.InstancedMesh(
        this.body.geometry,
        new THREE.MeshLambertMaterial({ color: 0xdff3ff, transparent: true, opacity: 0.3, depthWrite: false }),
        MAX_SEGMENTS,
      );
      this.wrap.frustumCulled = false;
      this.group.add(this.wrap);
    }
    const spiky = snake.spikes > 0;
    const spacing = r * 1.15;
    const count = Math.min(MAX_SEGMENTS, Math.max(3, Math.ceil(length / spacing)));
    let spikeCount = 0;
    for (let i = 0; i < count; i++) {
      const d = (i + 0.8) * spacing;
      snake.sampleAt(d, this.p);
      const t = i / (count - 1);
      let s = r * (t > 0.7 ? 1 - ((t - 0.7) / 0.3) * 0.65 : 1);
      // Bulges add up rather than multiply, and only so far: a mouthful of ten snacks at once
      // must not blow one segment up to the size of the playground.
      let swell = 0;
      for (const b of this.bumps) swell += Math.exp(-(((d - b) / BUMP_WIDTH) ** 2));
      s *= 1 + bulge * Math.min(1.5, swell);
      this.m.makeScale(s, s, s).setPosition(this.p.x, s, this.p.z);
      this.body.setMatrixAt(i, this.m);
      if (wrapped && this.wrap) {
        const w = s * (1.22 + Math.sin(time * 4 + i) * 0.03);
        this.wrap.setMatrixAt(i, this.m.makeScale(w, w, w).setPosition(this.p.x, s, this.p.z));
      }

      if (spiky && i % 2 === 0) {
        // Lean each spike back along the body, like a hedgehog in a hurry.
        snake.sampleAt(d + 0.3, this.next);
        const yaw = Math.atan2(this.next.x - this.p.x, this.next.z - this.p.z);
        this.e.set(0.6, yaw, 0, 'YXZ');
        const k = s * (0.9 + snake.spikes);
        this.m.compose(this.pos.set(this.p.x, s * 1.75, this.p.z), this.q.setFromEuler(this.e), this.scl.set(k, k, k));
        this.spikes.setMatrixAt(spikeCount++, this.m);
      }
    }
    this.body.count = count;
    this.body.instanceMatrix.needsUpdate = true;
    if (this.wrap) {
      this.wrap.count = wrapped ? count : 0;
      if (wrapped) this.wrap.instanceMatrix.needsUpdate = true;
    }

    this.magnet.visible = snake.magnet > 0;
    if (this.magnet.visible) {
      snake.sampleAt(length, this.p);
      snake.sampleAt(Math.max(0, length - 0.6), this.next);
      const k = r * 1.3;
      this.magnet.scale.setScalar(k);
      this.magnet.position.set(this.p.x, k * 0.5, this.p.z);
      // Open end pointing away from the body, wobbling as if it were tugging at things.
      this.magnet.rotation.y = Math.atan2(this.p.x - this.next.x, this.p.z - this.next.z) + Math.PI + Math.sin(time * 9) * 0.15;
    }
    if (spikeCount > 0 || this.spikes.count > 0) this.spikes.instanceMatrix.needsUpdate = true;
    this.spikes.count = spikeCount;

    // The Dragon (top tier): the red dragon head takes over, and the hat comes off for it.
    const isDragon = snake.tier >= 5;
    this.dragon.visible = isDragon;
    if (this.hat) this.hat.visible = !isDragon;
    const hs = r * 1.18 * (isDragon ? 1.15 : 1);
    this.head.scale.setScalar(hs);
    this.head.position.set(snake.x, hs, snake.z);
    this.head.rotation.y = Math.PI / 2 - snake.heading;
    this.lickLeft -= dt;
    if (this.lickLeft > 0 && snake.reachBonus > 0) {
      // Long Tongue: whip out to what was just eaten and back, frog style.
      const dx = this.lickX - snake.x;
      const dz = this.lickZ - snake.z;
      const out = Math.sin((1 - this.lickLeft / LICK_FOR) * Math.PI);
      this.tongue.rotation.y = snake.heading - Math.atan2(dz, dx);
      this.tongue.scale.z = 0.05 + (Math.hypot(dx, dz) / hs) * out;
    } else {
      // Otherwise it flicks out every so often; a Long Tongue flicks further.
      const flick = Math.max(0, Math.sin(time * 3.1 + snake.id)) * Math.abs(Math.sin(time * 23));
      this.tongue.rotation.y = 0;
      this.tongue.scale.z = 0.05 + flick * (0.9 + snake.reachBonus);
    }

    // The helmet is on while it can take a bonk and gone while it recharges: that is the feedback.
    this.helmet.visible = snake.helmetRecharge > 0 && snake.helmetReady;
    // A hat somebody saved up for is never hidden: it perches on top of the helmet.
    if (this.hat) this.hat.position.y = this.hatY + (this.helmet.visible ? 0.4 : 0);
    if (this.hatSpin) this.hatSpin.rotation.y = time * 14;
  }
}
