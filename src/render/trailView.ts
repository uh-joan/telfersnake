import * as THREE from 'three';
import { trailPalette } from '../meta/catalogue';

/**
 * A snake's Tuck Shop trail. Each trail has its own *look*, not just its own colours: glowing motes
 * that bloom and fade (sparkles, embers, stardust…), flat bits that tumble and fall (leaves, petals,
 * confetti, snow), floating hearts, or rising bubbles. Pure decoration — Math.random is fine here;
 * it never touches the sim.
 */

type Shape = 'orb' | 'flake' | 'heart' | 'bubble' | 'pennant' | 'drop' | 'feather' | 'puff';

interface Style {
  shape: Shape;
  rise: number; // initial upward speed (negative = drifts down, e.g. snow)
  grav: number; // pull back down each second
  spin: number; // tumble speed (flakes)
  size: number;
  sway: number; // horizontal drift wobble
  twinkle: boolean; // glow shapes only: pulse the brightness
  burst: number; // sideways speed outward (fireworks), m/s
  y0: number; // height a mote starts at (rain starts high and falls)
}

const S = (shape: Shape, rise: number, grav: number, spin: number, size: number, sway: number, twinkle = false, burst = 0, y0 = 0.35): Style =>
  ({ shape, rise, grav, spin, size, sway, twinkle, burst, y0 });

/** Every trail's personality. Anything unlisted falls back to a gentle glow. */
const STYLES: Record<string, Style> = {
  sparkle: S('orb', 1.0, 0.5, 0, 0.9, 0.2, true),
  stardust: S('orb', 0.9, 0.4, 0, 1.0, 0.2, true),
  fireflies: S('orb', 0.5, 0.15, 0, 0.9, 0.7, true),
  'magic-dust': S('orb', 0.9, 0.4, 0, 1.0, 0.4, true),
  'rainbow-trail': S('orb', 0.9, 0.4, 0, 1.0, 0.2, true),
  embers: S('orb', 1.9, 1.0, 0, 0.8, 0.3, true),
  ocean: S('orb', 1.4, 3.0, 0, 0.9, 0.4),
  slime: S('orb', 0.2, 1.3, 0, 1.3, 0.2),
  leaves: S('flake', 0.6, 1.1, 3.2, 1.2, 1.2),
  petals: S('flake', 0.5, 0.9, 2.4, 1.0, 1.4),
  confetti: S('flake', 2.0, 3.2, 5.0, 0.95, 0.9),
  snow: S('flake', -0.1, 0.35, 1.2, 0.75, 1.0),
  hearts: S('heart', 1.0, 0.3, 0, 1.0, 1.2),
  bubbles: S('bubble', 1.4, -0.15, 0, 1.0, 1.6),
  // London's legends: Rainbow Rush in red, white and blue; River Rider's splash; the fairy's dust.
  'union-trail': S('orb', 0.9, 0.4, 0, 1.1, 0.2, true),
  'river-splash': S('bubble', 1.6, 0.4, 0, 1.0, 1.2),
  'fairy-dust': S('orb', 0.7, 0.2, 0, 0.8, 0.9, true),
  // London's Tuck Shop trails (A7).
  fireworks: S('orb', 3.2, 3.4, 0, 0.75, 0.2, true, 2.6),
  bunting: S('pennant', 0.8, 0.9, 1.6, 1.0, 1.0),
  raindrops: S('drop', -1.5, 7, 0, 0.9, 0.1, false, 0, 2.6),
  'tea-bubbles': S('bubble', 1.0, -0.1, 0, 0.8, 1.2),
  'red-arrows': S('puff', 0.5, 0.15, 0, 1.4, 0.3),
  'pigeon-feathers': S('feather', 0.9, 0.7, 2.2, 1.0, 1.6),
  'thames-spray': S('drop', 2.6, 6.5, 0, 0.7, 0.3, false, 1.2),
};
/** Trails a magic lends (not sold in the Tuck Shop), and their colours. */
const MAGIC_PALETTES: Record<string, number[]> = {
  'union-trail': [0xc8102e, 0xffffff, 0x1f3fa8, 0xc8102e, 0xffffff, 0x1f3fa8],
  'river-splash': [0xdff3ff, 0x7fe0d8, 0xffffff],
  'fairy-dust': [0x9bffc0, 0xfff6a0, 0xffffff, 0xd8b4ff],
};
const DEFAULT = STYLES.sparkle;

interface Mote {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  rot: number; spin: number; grav: number;
  age: number; life: number; size: number; sway: number; seed: number;
  twinkle: boolean;
  r: number; g: number; b: number;
}

function heartGeometry(): THREE.BufferGeometry {
  const h = new THREE.Shape();
  h.moveTo(0, 0.3);
  h.bezierCurveTo(0, 0.4, -0.15, 0.6, -0.35, 0.6);
  h.bezierCurveTo(-0.7, 0.6, -0.7, 0.15, -0.7, 0.15);
  h.bezierCurveTo(-0.7, -0.15, -0.35, -0.35, 0, -0.65);
  h.bezierCurveTo(0.35, -0.35, 0.7, -0.15, 0.7, 0.15);
  h.bezierCurveTo(0.7, 0.15, 0.7, 0.6, 0.35, 0.6);
  h.bezierCurveTo(0.15, 0.6, 0, 0.4, 0, 0.3);
  const geo = new THREE.ExtrudeGeometry(h, { depth: 0.15, bevelEnabled: false });
  geo.center();
  geo.scale(0.42, 0.42, 0.42);
  geo.rotateX(-Math.PI / 2); // lay it flat so the follow camera sees the heart
  return geo;
}

/** A little flag triangle hanging point-down, like a bunting pennant. */
function pennantGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.32, 0.25, 0, 0.32, 0.25, 0, 0, -0.4, 0], 3));
  geo.computeVertexNormals();
  return geo;
}

/** One instanced mesh for a shape; all its motes share a material (additive for orbs, normal else). */
class Emitter {
  readonly mesh: THREE.InstancedMesh;
  readonly motes: Mote[] = [];
  private readonly additive: boolean;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly pos = new THREE.Vector3();
  private readonly scl = new THREE.Vector3();
  private readonly col = new THREE.Color();
  private readonly tumble: boolean;

  constructor(geo: THREE.BufferGeometry, cap: number, opts: { additive: boolean; opacity?: number; tumble?: boolean }) {
    this.additive = opts.additive;
    this.tumble = opts.tumble ?? false;
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: opts.opacity ?? 1,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.frustumCulled = false;
    this.mesh.setColorAt(0, new THREE.Color(0xffffff));
    this.mesh.count = 0;
  }

  update(dt: number, time: number): void {
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const p = this.motes[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.motes.splice(i, 1);
        continue;
      }
      p.vy -= p.grav * dt;
      p.x += p.vx * dt + Math.sin(time * 3 + p.seed) * p.sway * dt;
      p.y = Math.max(0.05, p.y + p.vy * dt);
      p.z += p.vz * dt + Math.cos(time * 2.6 + p.seed) * p.sway * 0.5 * dt;
      p.rot += p.spin * dt;
    }
    this.motes.forEach((p, i) => {
      const t = p.age / p.life;
      const bloom = Math.sin(Math.min(1, t) * Math.PI); // grow in, then shrink/fade out — no pop
      if (this.additive) {
        const f = bloom * (p.twinkle ? 0.72 + 0.28 * Math.sin(time * 11 + p.seed) : 1);
        const k = p.size * (0.45 + 0.75 * bloom);
        this.col.setRGB(p.r * f, p.g * f, p.b * f);
        this.q.identity();
        this.scl.set(k, k, k);
      } else {
        const k = p.size * (0.3 + 0.95 * bloom); // fade via scale (normal blend can't fade per-instance)
        this.col.setRGB(p.r, p.g, p.b);
        if (this.tumble) this.e.set(p.rot, p.rot * 0.7, p.rot * 0.4);
        else this.e.set(0, p.rot, 0);
        this.q.setFromEuler(this.e);
        this.scl.set(k, k, k);
      }
      this.m.compose(this.pos.set(p.x, p.y, p.z), this.q, this.scl);
      this.mesh.setMatrixAt(i, this.m);
      this.mesh.setColorAt(i, this.col);
    });
    this.mesh.count = this.motes.length;
    this.mesh.visible = this.mesh.count > 0; // an empty shape costs no draw call
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

export class TrailView {
  readonly group = new THREE.Group();
  private readonly emitters: Record<Shape, Emitter>;
  private readonly tint = new THREE.Color();

  constructor() {
    this.emitters = {
      orb: new Emitter(new THREE.SphereGeometry(0.24, 10, 8), 300, { additive: true }),
      flake: new Emitter(new THREE.PlaneGeometry(0.55, 0.62), 220, { additive: false, tumble: true }),
      heart: new Emitter(heartGeometry(), 160, { additive: false }),
      bubble: new Emitter(new THREE.SphereGeometry(0.3, 10, 8), 160, { additive: false, opacity: 0.4 }),
      pennant: new Emitter(pennantGeometry(), 160, { additive: false, tumble: true }),
      drop: new Emitter(new THREE.SphereGeometry(0.12, 8, 6).scale(1, 2.4, 1), 200, { additive: false, opacity: 0.75 }),
      feather: new Emitter(new THREE.PlaneGeometry(0.22, 0.7), 160, { additive: false, tumble: true }),
      puff: new Emitter(new THREE.IcosahedronGeometry(0.34, 1), 200, { additive: false, opacity: 0.55 }),
    };
    for (const e of Object.values(this.emitters)) this.group.add(e.mesh);
  }

  /** Drop a mote for `trailId` at the tail, in its own shape, motion and colours. */
  add(x: number, z: number, trailId: string): void {
    const style = STYLES[trailId] ?? DEFAULT;
    const palette = MAGIC_PALETTES[trailId] ?? trailPalette(trailId);
    if (palette.length === 0) return;
    const em = this.emitters[style.shape];
    if (em.motes.length >= em.mesh.instanceMatrix.count) return; // full: never draw past the buffer
    this.tint.setHex(palette[Math.floor(Math.random() * palette.length)]);
    const out = Math.random() * Math.PI * 2;
    const burst = style.burst * (0.6 + Math.random() * 0.6);
    em.motes.push({
      x: x + (Math.random() - 0.5) * 0.5,
      y: style.y0 + Math.random() * (style.y0 > 1 ? 0.8 : 0),
      z: z + (Math.random() - 0.5) * 0.5,
      vx: (Math.random() - 0.5) * 0.5 + Math.cos(out) * burst,
      vy: style.rise + (Math.random() - 0.5) * 0.4,
      vz: (Math.random() - 0.5) * 0.5 + Math.sin(out) * burst,
      rot: Math.random() * 6.28,
      spin: style.spin * (Math.random() < 0.5 ? -1 : 1) * (0.7 + Math.random() * 0.6),
      grav: style.grav,
      age: 0,
      life: 0.9 + Math.random() * 0.6,
      size: style.size * (0.85 + Math.random() * 0.5),
      sway: style.sway,
      seed: Math.random() * 6.28,
      twinkle: style.twinkle,
      r: this.tint.r, g: this.tint.g, b: this.tint.b,
    });
  }

  update(dt: number, time: number): void {
    for (const e of Object.values(this.emitters)) e.update(dt, time);
  }
}
