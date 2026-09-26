import * as THREE from 'three';

/**
 * A snake's Tuck Shop trail: a soft ribbon of glowing motes left behind the tail. Unlike the chunky
 * confetti (see Sparkles), these are round, additive-blended orbs that fade in and out and twinkle,
 * so the trail reads as a luminous wake rather than a spray of shards. Pure decoration — Math.random
 * is fine here; it never touches the sim.
 */

const CAP = 360;

interface Mote {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  age: number; life: number; size: number; seed: number;
  r: number; g: number; b: number;
}

export class TrailView {
  readonly mesh: THREE.InstancedMesh;
  private readonly motes: Mote[] = [];
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly pos = new THREE.Vector3();
  private readonly scl = new THREE.Vector3();
  private readonly col = new THREE.Color();
  private readonly tint = new THREE.Color();

  constructor() {
    // A soft glowing orb: low-poly sphere, additive so overlapping motes bloom into a ribbon.
    const geo = new THREE.SphereGeometry(0.24, 10, 8);
    const mat = new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 1 });
    this.mesh = new THREE.InstancedMesh(geo, mat, CAP);
    this.mesh.frustumCulled = false;
    this.mesh.setColorAt(0, new THREE.Color(0xffffff));
    this.mesh.count = 0;
  }

  /** Drop a mote at the tail in one of the trail's colours. */
  add(x: number, z: number, palette: readonly number[]): void {
    if (this.motes.length >= CAP || palette.length === 0) return;
    this.tint.setHex(palette[Math.floor(Math.random() * palette.length)]);
    this.motes.push({
      x: x + (Math.random() - 0.5) * 0.45,
      y: 0.35,
      z: z + (Math.random() - 0.5) * 0.45,
      vx: (Math.random() - 0.5) * 0.5,
      vy: 0.7 + Math.random() * 0.7,
      vz: (Math.random() - 0.5) * 0.5,
      age: 0,
      life: 0.95 + Math.random() * 0.55,
      size: 0.85 + Math.random() * 0.7,
      seed: Math.random() * 6.28,
      r: this.tint.r, g: this.tint.g, b: this.tint.b,
    });
  }

  update(dt: number, time: number): void {
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const p = this.motes[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.motes.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy *= 0.94; // the rise eases off, so motes hang and fade rather than shoot away
    }
    this.motes.forEach((p, i) => {
      const t = p.age / p.life;
      const fade = Math.sin(Math.min(1, t) * Math.PI); // bloom in, then fade out — no hard pop
      const twinkle = 0.72 + 0.28 * Math.sin(time * 11 + p.seed);
      const k = p.size * (0.45 + 0.75 * fade);
      // Additive blend: brightness IS the alpha, so scale the colour by the fade to make it vanish.
      const f = fade * twinkle;
      this.col.setRGB(p.r * f, p.g * f, p.b * f);
      this.m.compose(this.pos.set(p.x, p.y, p.z), this.q, this.scl.set(k, k, k));
      this.mesh.setMatrixAt(i, this.m);
      this.mesh.setColorAt(i, this.col);
    });
    this.mesh.count = this.motes.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
