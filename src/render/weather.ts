import * as THREE from 'three';
import type { Sfx } from '../audio/sfx';
import type { Stage } from './stage';

/**
 * The sky's mood, drifting between sun, cloud, rain and the odd thunderstorm. Purely for show — it
 * never touches the sim, so it can be driven by the wall clock and a little randomness. It dims and
 * greys the stage's light, drifts a few clouds overhead, falls as rain around the camera, and every
 * so often flashes lightning with a roll of thunder.
 */

type Kind = 'sun' | 'cloud' | 'rain' | 'storm';
const PARAMS: Record<Kind, { dim: number; rain: number; cloud: number; storm: boolean }> = {
  sun: { dim: 1.0, rain: 0, cloud: 0.12, storm: false },
  cloud: { dim: 0.72, rain: 0, cloud: 0.7, storm: false },
  rain: { dim: 0.58, rain: 1, cloud: 0.92, storm: false },
  storm: { dim: 0.46, rain: 1, cloud: 1, storm: true },
};
// A weighted pool: mostly bright, sometimes wet, rarely a storm.
const POOL: Kind[] = ['sun', 'sun', 'sun', 'cloud', 'cloud', 'rain', 'rain', 'storm'];
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class Weather {
  readonly group = new THREE.Group();
  private dim = 1;
  private rainAmt = 0;
  private cloudAmt = 0.12;
  private storm = false;
  private tDim = 1;
  private tRain = 0;
  private tCloud = 0.12;
  private hold = 12;
  private flash = 0;
  private strikeIn = 4;
  private thunderIn = -1;

  private readonly N = 380;
  private readonly RH = 22;
  private readonly RR = 34;
  private readonly LEN = 0.55;
  private readonly rain: THREE.LineSegments;
  private readonly rx = new Float32Array(this.N);
  private readonly rz = new Float32Array(this.N);
  private readonly ry = new Float32Array(this.N);
  private readonly pos = new Float32Array(this.N * 6);
  private readonly clouds: THREE.Mesh[] = [];

  constructor(private readonly stage: Stage, private readonly getSfx: () => Sfx | null) {
    for (let i = 0; i < this.N; i++) {
      this.rx[i] = rand(-this.RR, this.RR);
      this.rz[i] = rand(-this.RR, this.RR);
      this.ry[i] = Math.random() * this.RH;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xb2c8e0, transparent: true, opacity: 0 });
    this.rain = new THREE.LineSegments(geo, mat);
    this.rain.frustumCulled = false;
    this.group.add(this.rain);

    // Small, high, flattened puffs scattered across the sky — far daintier than one big blob.
    for (let i = 0; i < 12; i++) {
      const c = new THREE.Mesh(
        new THREE.SphereGeometry(rand(1.4, 2.6), 8, 6),
        new THREE.MeshLambertMaterial({ color: 0xdfe2e6, transparent: true, opacity: 0 }),
      );
      c.scale.set(1.5, 0.42, 1.1);
      c.position.set(rand(-55, 55), rand(24, 32), rand(-55, 55));
      this.clouds.push(c);
      this.group.add(c);
    }
  }

  private pick(): void {
    const p = PARAMS[POOL[(Math.random() * POOL.length) | 0]];
    this.tDim = p.dim;
    this.tRain = p.rain;
    this.tCloud = p.cloud;
    this.storm = p.storm;
    this.hold = rand(24, 46);
  }

  /** `fx`, `fz` are the camera's focus, so the rain and clouds stay over wherever you are playing. */
  update(dt: number, fx: number, fz: number): void {
    this.hold -= dt;
    if (this.hold <= 0) this.pick();

    const k = 1 - Math.exp(-dt * 0.6); // ease weather changes in over a few seconds
    this.dim += (this.tDim - this.dim) * k;
    this.rainAmt += (this.tRain - this.rainAmt) * k;
    this.cloudAmt += (this.tCloud - this.cloudAmt) * k;

    // Lightning during a storm: a bright flash, then thunder a beat later.
    this.flash = Math.max(0, this.flash - dt * 6);
    if (this.storm && this.rainAmt > 0.6) {
      this.strikeIn -= dt;
      if (this.strikeIn <= 0) {
        this.strikeIn = rand(3, 10);
        this.flash = rand(1.6, 3);
        this.thunderIn = rand(0.3, 1.8);
      }
    }
    if (this.thunderIn > 0) {
      this.thunderIn -= dt;
      if (this.thunderIn <= 0) {
        this.getSfx()?.thunder();
        this.thunderIn = -1;
      }
    }
    this.stage.weatherLight(this.dim, this.flash);

    // Keep the whole weather volume centred on the player.
    this.group.position.set(fx, 0, fz);

    // Rain.
    (this.rain.material as THREE.LineBasicMaterial).opacity = this.rainAmt * 0.5;
    this.rain.visible = this.rainAmt > 0.02;
    if (this.rain.visible) {
      const fall = 26 * dt;
      for (let i = 0; i < this.N; i++) {
        this.ry[i] -= fall;
        if (this.ry[i] < 0) {
          this.ry[i] += this.RH;
          this.rx[i] = rand(-this.RR, this.RR);
          this.rz[i] = rand(-this.RR, this.RR);
        }
        const o = i * 6;
        this.pos[o] = this.rx[i];
        this.pos[o + 1] = this.ry[i];
        this.pos[o + 2] = this.rz[i];
        this.pos[o + 3] = this.rx[i] + 0.1;
        this.pos[o + 4] = this.ry[i] - this.LEN;
        this.pos[o + 5] = this.rz[i];
      }
      (this.rain.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }

    // Clouds drift slowly and fade in as it clouds over.
    for (const c of this.clouds) {
      (c.material as THREE.MeshLambertMaterial).opacity = this.cloudAmt * 0.85;
      c.position.x += dt * 1.3;
      if (c.position.x > 60) c.position.x = -60;
    }
  }
}
