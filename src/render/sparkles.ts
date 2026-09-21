import * as THREE from 'three';

const CAP = 256;
const GRAVITY = 9;

interface Spark {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  age: number;
  life: number;
  size: number;
}

/** Little bursts of confetti for gulps, bonks and level-ups. Pure decoration, so Math.random is fine here. */
export class Sparkles {
  readonly mesh: THREE.InstancedMesh;
  private readonly sparks: Spark[] = [];
  private readonly colors: THREE.Color[] = [];
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly pos = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();

  constructor() {
    this.mesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.16), new THREE.MeshBasicMaterial({ color: 0xffffff }), CAP);
    this.mesh.frustumCulled = false;
    this.mesh.setColorAt(0, new THREE.Color(0xffffff));
    this.mesh.count = 0;
  }

  burst(x: number, z: number, palette: readonly number[], count: number, power = 1): void {
    for (let i = 0; i < count && this.sparks.length < CAP; i++) {
      const a = Math.random() * Math.PI * 2;
      const out = (1.5 + Math.random() * 2.5) * power;
      this.sparks.push({
        x, y: 0.5, z,
        vx: Math.cos(a) * out, vy: (3 + Math.random() * 3) * power, vz: Math.sin(a) * out,
        age: 0, life: 0.5 + Math.random() * 0.35, size: 0.6 + Math.random() * 0.8,
      });
      this.colors.push(new THREE.Color(palette[Math.floor(Math.random() * palette.length)]));
    }
  }

  /** One slow spark that floats up and fades: what a Tuck Shop trail is made of. */
  drift(x: number, z: number, palette: readonly number[]): void {
    if (this.sparks.length >= CAP || palette.length === 0) return;
    this.sparks.push({
      x: x + (Math.random() - 0.5) * 0.5, y: 0.3, z: z + (Math.random() - 0.5) * 0.5,
      vx: (Math.random() - 0.5) * 0.6, vy: 3.2 + Math.random() * 1.2, vz: (Math.random() - 0.5) * 0.6,
      age: 0, life: 0.7 + Math.random() * 0.4, size: 0.7 + Math.random() * 0.6,
    });
    this.colors.push(new THREE.Color(palette[Math.floor(Math.random() * palette.length)]));
  }

  /** A fan of sparks thrown forward from (x, z) along `heading`, reaching about `range` metres. */
  puff(x: number, z: number, heading: number, range: number, palette: readonly number[], count: number): void {
    for (let i = 0; i < count && this.sparks.length < CAP; i++) {
      const a = heading + (Math.random() - 0.5) * 0.9;
      const life = 0.35 + Math.random() * 0.3;
      const out = (range / life) * (0.5 + Math.random() * 0.5);
      this.sparks.push({
        x, y: 0.7, z,
        vx: Math.cos(a) * out, vy: 1.5 + Math.random() * 2.5, vz: Math.sin(a) * out,
        age: 0, life, size: 1.2 + Math.random() * 1.4,
      });
      this.colors.push(new THREE.Color(palette[Math.floor(Math.random() * palette.length)]));
    }
  }

  update(dt: number): void {
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.age += dt;
      if (s.age >= s.life) {
        this.sparks.splice(i, 1);
        this.colors.splice(i, 1);
        continue;
      }
      s.vy -= GRAVITY * dt;
      s.x += s.vx * dt;
      s.y = Math.max(0.1, s.y + s.vy * dt);
      s.z += s.vz * dt;
    }
    this.sparks.forEach((s, i) => {
      const k = s.size * (1 - s.age / s.life);
      this.e.set(s.age * 9, s.age * 7, 0);
      this.m.compose(this.pos.set(s.x, s.y, s.z), this.q.setFromEuler(this.e), this.scale.set(k, k, k));
      this.mesh.setMatrixAt(i, this.m);
      this.mesh.setColorAt(i, this.colors[i]);
    });
    this.mesh.count = this.sparks.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
