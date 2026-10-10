import * as THREE from 'three';
import type { Snake } from '../sim/snake';
import type { Terrain } from '../sim/stage';
import { inWater } from '../sim/water';
import { makeHat } from './hats';
import { disposeTree } from './paint';

const MAX_SEGMENTS = 96; // a 60 m snake needs about 50; small fast-growing ones a few more
const BUMP_SPEED = 9; // m/s a swallowed snack travels down the body
const BUMP_WIDTH = 0.55;
const MAX_BUMPS = 10;
const LICK_FOR = 0.2; // seconds a Long Tongue lash lasts
/** The Thames' surface sits this far below the paper (render/london/water.ts WATER_Y). */
const WATER_Y = -0.3;
const RIPPLES = 2;
/** Dragon Wings: how high a flying snake rides (metres), eased up and down. */
const FLY_Y = 2.6;
/** Gog & Magog: the giant's body is drawn this much wider (and a little taller). */
const GIANT_WIDE = 2;
const GIANT_TALL = 1.5;

/** One snake: instanced body, googly-eyed head, and whatever kit its upgrades have earned it. */
export class SnakeView {
  readonly group = new THREE.Group();
  private readonly body: THREE.InstancedMesh;
  private readonly spikes: THREE.InstancedMesh;
  private readonly head = new THREE.Group();
  private readonly helmet = new THREE.Group();
  /** The Dragon (top size tier): a fierce red dragon head — horns, crest, fangs, glowing eyes, flame. */
  private readonly dragon = new THREE.Group();
  private readonly dragonEyeMat = new THREE.MeshBasicMaterial({ color: 0xffd21a });
  private readonly dragonFlames: THREE.Mesh[] = [];
  private dragonGlow: THREE.Mesh | null = null;
  /** The plain googly eyes, hidden while the dragon head is on. */
  private readonly faceEyes: THREE.Object3D[] = [];
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
  /** How far each segment has sunk into the river (eased, so a snake slides in rather than drops). */
  private readonly sink = new Float32Array(MAX_SEGMENTS);
  private headSink = 0;
  /** Swimming: rings spreading out from the head. Built the first time the snake gets wet. */
  private ripples: THREE.Mesh[] = [];
  // London's legends (A5): flight, the giant, the ghost, the crown.
  /** Eased 0..1: up in the air (Dragon Wings) and drawn giant (Gog & Magog). */
  private fly = 0;
  private giant = 0;
  /** Silver-and-red dragon wings that flap at the neck while flying. */
  private readonly wings = new THREE.Group();
  private readonly wingL = new THREE.Group();
  private readonly wingR = new THREE.Group();
  /** A shadow left on the ground under a flyer, so you can see where you will come down. */
  private readonly shadow: THREE.Mesh;
  /** The crown for all five Crown Jewels, for the rest of the run. */
  private readonly crown = new THREE.Group();
  private readonly bodyMat: THREE.MeshLambertMaterial;
  private readonly skullMat: THREE.MeshLambertMaterial;

  /** `hatId` is a Tuck Shop hat. */
  constructor(private readonly snake: Snake, hatId = 'no-hat') {
    const look = snake.look;
    const pattern = (look.pattern ?? [look.body, look.body, look.body, look.body, look.stripe]).map((c) => new THREE.Color(c));

    this.bodyMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.body = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), this.bodyMat, MAX_SEGMENTS);
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
    this.skullMat = new THREE.MeshLambertMaterial({ color: look.head });
    const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), this.skullMat);
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
      this.faceEyes.push(eye, pupil);
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

    // ── The Dragon ─────────────────────────────────────────────────────────
    // A fierce red dragon head that takes over at the very top size tier: a
    // scaly crown, swept-back banded horns, a fanged muzzle, glowing slit eyes,
    // a membrane crest and a lick of flame that flickers at its jaws (animated
    // in update). Built once and hidden until the size is earned.
    const scaleRed = new THREE.MeshLambertMaterial({ color: 0xb01c14 });
    const deepRed = new THREE.MeshLambertMaterial({ color: 0x7c1009 });
    const finRed = new THREE.MeshLambertMaterial({ color: 0xd8331f });
    const bone = new THREE.MeshLambertMaterial({ color: 0xf3e6c8 });
    const boneDark = new THREE.MeshLambertMaterial({ color: 0xd8c49a });

    // Crown, upper muzzle and a jaw held a touch open.
    const crown = new THREE.Mesh(new THREE.SphereGeometry(1.02, 18, 14), scaleRed);
    crown.scale.set(1.28, 1.12, 1.42);
    crown.position.set(0, 0.16, -0.1);
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.72, 16, 12), scaleRed);
    muzzle.scale.set(1.04, 0.72, 1.55);
    muzzle.position.set(0, -0.16, 0.92);
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 10), deepRed);
    jaw.scale.set(0.92, 0.42, 1.3);
    jaw.position.set(0, -0.62, 0.72);
    this.dragon.add(crown, muzzle, jaw);

    // Angry brow ridges, glowing slit-pupil eyes with a soft additive halo.
    const slit = new THREE.MeshBasicMaterial({ color: 0x120400 });
    const halo = new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const side of [-1, 1]) {
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.24, 0.62), deepRed);
      brow.position.set(side * 0.5, 0.72, 0.42);
      brow.rotation.set(-0.28, 0, side * 0.38);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), halo);
      glow.position.set(side * 0.6, 0.5, 0.5);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), this.dragonEyeMat);
      eye.position.set(side * 0.6, 0.5, 0.62);
      eye.scale.set(1, 1.25, 0.7);
      const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.44, 0.1), slit);
      pupil.position.set(side * 0.62, 0.5, 0.88);
      this.dragon.add(brow, glow, eye, pupil);
    }

    // Two big swept-back horns with a darker band, plus a smaller pair, and fangs.
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.26, 2.1, 8), bone);
      horn.position.set(side * 0.55, 1.02, -0.35);
      horn.rotation.set(-1.12, 0, side * 0.32);
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 6, 10), boneDark);
      band.position.copy(horn.position);
      band.rotation.copy(horn.rotation);
      band.translateY(0.2);
      const horn2 = new THREE.Mesh(new THREE.ConeGeometry(0.15, 1.1, 7), bone);
      horn2.position.set(side * 0.92, 0.62, -0.12);
      horn2.rotation.set(-0.7, 0, side * 0.72);
      const upper = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 6), bone);
      upper.rotation.x = Math.PI;
      upper.position.set(side * 0.36, -0.5, 1.28);
      const lower = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.36, 6), boneDark);
      lower.position.set(side * 0.3, -0.62, 1.18);
      const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), deepRed);
      nostril.position.set(side * 0.2, 0.02, 1.55);
      this.dragon.add(horn, band, horn2, upper, lower, nostril);
    }

    // A membrane crest of fins running back over the crown.
    for (let i = 0; i < 5; i++) {
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.7 - i * 0.06, 4), finRed);
      fin.scale.set(0.45, 1, 1);
      fin.position.set(0, 1.18 - i * 0.05, -0.2 - i * 0.42);
      fin.rotation.x = -0.15;
      this.dragon.add(fin);
    }

    // A flicker of flame at the jaws — three nested additive cones, animated later.
    const flameCols = [0xff5a12, 0xff9a1e, 0xffe06a];
    for (let i = 0; i < 3; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: flameCols[i], transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.3 - i * 0.06, 1.3 - i * 0.25, 8), mat);
      flame.rotation.x = Math.PI / 2; // point forward, out of the mouth
      flame.position.set(0, -0.36, 1.5 + i * 0.12);
      this.dragonFlames.push(flame);
      this.dragon.add(flame);
    }

    // A warm halo behind the whole head.
    this.dragonGlow = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xff5a1e, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide }),
    );
    this.dragonGlow.position.set(0, 0.1, 0.2);
    this.dragon.add(this.dragonGlow);

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

    // Dragon Wings: a silver arm and a red membrane each side, hinged at the neck.
    const silver = new THREE.MeshLambertMaterial({ color: 0xc8ccd6 });
    const membrane = new THREE.MeshLambertMaterial({ color: 0xc8102e, side: THREE.DoubleSide });
    for (const [side, wing] of [[-1, this.wingL], [1, this.wingR]] as const) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 2.2, 6), silver);
      arm.rotation.z = Math.PI / 2;
      arm.position.x = side * 1.1;
      const sail = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([
        new THREE.Vector2(0, 0), new THREE.Vector2(side * 2.2, 0), new THREE.Vector2(side * 1.6, 0.9), new THREE.Vector2(side * 0.9, 0.6), new THREE.Vector2(side * 0.4, 1.1),
      ])), membrane);
      sail.rotation.x = -Math.PI / 2;
      wing.add(arm, sail);
      wing.position.set(side * 0.7, 0.5, -0.5);
      this.wings.add(wing);
    }
    this.wings.visible = false;
    this.head.add(this.wings);
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }),
    );
    this.shadow.visible = false;
    this.group.add(this.shadow);

    // The crown: a gold band, five points with pearls, a red velvet cap and a little cross on top.
    const gold = new THREE.MeshLambertMaterial({ color: 0xffc93c });
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.56, 0.36, 16, 1, true), gold);
    band.material.side = THREE.DoubleSide;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xc8102e }));
    cap.position.y = 0.05;
    this.crown.add(band, cap);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const point = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.38, 4), gold);
      point.position.set(Math.cos(a) * 0.58, 0.32, Math.sin(a) * 0.58);
      const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), white);
      pearl.position.set(Math.cos(a) * 0.58, 0.54, Math.sin(a) * 0.58);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), new THREE.MeshLambertMaterial({ color: [0xe0115f, 0x1f5fe0, 0x14b86a, 0xe8f6ff, 0x9b4de0][i] }));
      gem.position.set(Math.cos(a + 0.63) * 0.6, 0, Math.sin(a + 0.63) * 0.6);
      this.crown.add(point, pearl, gem);
    }
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), gold);
    cross.position.y = 0.7;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.08), gold);
    bar.position.y = 0.74;
    this.crown.add(cross, bar);
    this.crown.position.set(0, 1.1, -0.15);
    this.crown.scale.setScalar(1.3);
    this.crown.visible = false;
    this.head.add(this.crown);

    this.group.add(this.head);
  }

  /** Free everything this view put on the graphics card. Views are rebuilt when a seat changes hands or clothes. */
  dispose(): void {
    disposeTree(this.group); // hat materials are shared between all hats (see hats.ts) and are left alone
  }

  /** A cheap wake: two rings spreading and fading from the head while it swims. */
  private splash(on: boolean, hs: number, time: number): void {
    if (on && this.ripples.length === 0) {
      const geo = new THREE.RingGeometry(0.82, 1, 24).rotateX(-Math.PI / 2);
      for (let i = 0; i < RIPPLES; i++) {
        const ring = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }));
        ring.renderOrder = 1;
        this.ripples.push(ring);
        this.group.add(ring);
      }
    }
    for (let i = 0; i < this.ripples.length; i++) {
      const ring = this.ripples[i];
      ring.visible = on;
      if (!on) continue;
      const t = (time * 0.9 + i / RIPPLES) % 1;
      ring.scale.setScalar(hs * (0.9 + t * 2.2));
      ring.position.set(this.snake.x, WATER_Y + 0.03, this.snake.z);
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - t);
    }
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

  /** `terrain` is the stage being played: a snake in its river swims low in the water. */
  update(dt: number, time: number, terrain?: Terrain): void {
    const snake = this.snake;
    const wet = terrain?.water !== undefined;
    const ease = Math.min(1, dt * 7);
    // Gone while bonked; blinking while it cannot be touched.
    this.group.visible = snake.alive && (snake.immune <= 0 || Math.floor(time * 12) % 2 === 0);
    if (!snake.alive) {
      this.bumps.length = 0;
      return;
    }

    const r = snake.radius;
    const length = snake.length;
    // London's legends: flying (eased up and down), drawn giant, see-through as a ghost.
    this.fly += ((snake.hasMagic('wings') ? 1 : 0) - this.fly) * Math.min(1, dt * 3);
    this.giant += ((snake.hasMagic('giant') ? 1 : 0) - this.giant) * Math.min(1, dt * 4);
    const lift = this.fly * (FLY_Y + Math.sin(time * 2.4) * 0.2);
    const wide = 1 + (GIANT_WIDE - 1) * this.giant;
    const tall = 1 + (GIANT_TALL - 1) * this.giant;
    const ghostly = snake.hasMagic('hidden') && (terrain as { id?: string } | undefined)?.id === 'london';
    if (ghostly !== this.bodyMat.transparent) {
      for (const m of [this.bodyMat, this.skullMat]) {
        m.transparent = ghostly;
        m.opacity = ghostly ? 0.45 : 1;
        m.depthWrite = !ghostly;
        m.needsUpdate = true;
      }
    }
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
      // Swimming: the body rides with its back just out of the water, bobbing along in a wave.
      let y = s * tall + lift;
      if (wet && this.fly < 0.5) {
        const target = inWater(terrain, this.p.x, this.p.z) ? s * 0.55 - WATER_Y : 0;
        this.sink[i] += (target - this.sink[i]) * ease;
        if (this.sink[i] > 0.01) y += -this.sink[i] + Math.sin(time * 3.2 - i * 0.7) * 0.06 * Math.min(1, this.sink[i]);
      } else this.sink[i] = 0;
      this.m.makeScale(s * wide, s * tall, s * wide).setPosition(this.p.x, y, this.p.z);
      this.body.setMatrixAt(i, this.m);
      if (wrapped && this.wrap) {
        const w = s * (1.22 + Math.sin(time * 4 + i) * 0.03);
        this.wrap.setMatrixAt(i, this.m.makeScale(w, w, w).setPosition(this.p.x, y, this.p.z));
      }

      if (spiky && i % 2 === 0) {
        // Lean each spike back along the body, like a hedgehog in a hurry.
        snake.sampleAt(d + 0.3, this.next);
        const yaw = Math.atan2(this.next.x - this.p.x, this.next.z - this.p.z);
        this.e.set(0.6, yaw, 0, 'YXZ');
        const k = s * (0.9 + snake.spikes);
        this.m.compose(this.pos.set(this.p.x, y + s * 0.75, this.p.z), this.q.setFromEuler(this.e), this.scl.set(k, k, k));
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
    this.tongue.visible = !isDragon; // the flame stands in for the tongue
    for (const o of this.faceEyes) o.visible = !isDragon;
    if (isDragon) {
      // Eyes pulse, halo breathes, and the flame flickers and licks outward.
      const pulse = 0.72 + 0.28 * Math.sin(time * 5.5);
      this.dragonEyeMat.color.setRGB(pulse, pulse * 0.82, pulse * 0.12);
      if (this.dragonGlow) (this.dragonGlow.material as THREE.MeshBasicMaterial).opacity = 0.12 + 0.08 * (0.5 + 0.5 * Math.sin(time * 4));
      for (let i = 0; i < this.dragonFlames.length; i++) {
        const f = this.dragonFlames[i];
        const flick = 0.6 + 0.5 * Math.abs(Math.sin(time * (14 + i * 5) + i));
        f.scale.set(0.8 + 0.3 * Math.sin(time * 20 + i * 2), flick, 0.8 + 0.3 * Math.cos(time * 17 + i));
        (f.material as THREE.MeshBasicMaterial).opacity = 0.5 + 0.4 * flick;
        f.position.z = 1.5 + i * 0.12 + 0.1 * flick;
      }
    }
    const hs = r * 1.18 * (isDragon ? 1.15 : 1) * (1 + (GIANT_WIDE * 0.85 - 1) * this.giant);
    this.head.scale.setScalar(hs);
    // The head floats a little higher than the body, bobbing: a doggy-paddling snake.
    const swimming = wet && this.fly < 0.5 && inWater(terrain, snake.x, snake.z);
    this.headSink += ((swimming ? hs * 0.45 - WATER_Y : 0) - this.headSink) * ease;
    const bob = this.headSink > 0.01 ? Math.sin(time * 3.2 + 0.7) * 0.07 * Math.min(1, this.headSink) : 0;
    this.head.position.set(snake.x, hs - this.headSink + bob + lift, snake.z);
    this.splash(swimming, hs, time);
    // Flying: the wings flap, and a shadow stays on the ground below.
    this.wings.visible = this.fly > 0.05;
    if (this.wings.visible) {
      const flap = Math.sin(time * 9) * 0.6;
      this.wingL.rotation.z = flap;
      this.wingR.rotation.z = -flap;
      this.wings.scale.setScalar(this.fly * 1.7);
    }
    this.shadow.visible = this.fly > 0.05;
    if (this.shadow.visible) {
      this.shadow.position.set(snake.x, (wet && inWater(terrain, snake.x, snake.z) ? WATER_Y : 0) + 0.04, snake.z);
      this.shadow.scale.setScalar(hs * (1.2 - 0.3 * this.fly));
    }
    // ROYAL!: the crown, perched on whatever hat they wear.
    this.crown.visible = snake.crowned;
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
    if (this.hat) this.hat.position.y = this.hatY + (this.helmet.visible ? 0.4 : 0) + (this.crown.visible ? 0.9 : 0);
    if (this.hatSpin) this.hatSpin.rotation.y = time * 14;
  }
}
