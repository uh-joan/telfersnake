import * as THREE from 'three';
import type { CooperState } from '../sim/view';

const SKIN = 0xf0c8a8;
const SHOE = 0x15151a;

/** Mr Cooper the head teacher, or Mr Bramble the park keeper: same build, different clothes. */
export type Persona = 'cooper' | 'keeper';
const LOOKS: Record<Persona, { coat: number; shirt: number; tie: number; hair: number; vest: number | null; cap: number | null }> = {
  cooper: { coat: 0x1f2a44, shirt: 0xffffff, tie: 0xb3202a, hair: 0xf6f6f6, vest: null, cap: null },
  keeper: { coat: 0x3f5a34, shirt: 0xdfe6d8, tie: 0x2c3f24, hair: 0x5a4326, vest: 0xf2c94c, cap: 0x243a20 },
};

/** Drawn a touch larger than life so he reads clearly from the follow camera. */
const SCALE = 1.6;
export const COOPER_HEAD_Y = 2.0 * SCALE;

const mat = (color: number) => new THREE.MeshLambertMaterial({ color });

function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  return m;
}

/** Mr Cooper: tall, thin, navy suit, red tie, short white hair. Faces +z before rotation. */
export class CooperView {
  readonly group = new THREE.Group();
  readonly persona: Persona;
  private readonly figure = new THREE.Group();
  private readonly legs: THREE.Group[] = [];
  private readonly arms: THREE.Group[] = [];
  private stride = 0;

  constructor(persona: Persona = 'cooper') {
    this.persona = persona;
    const f = this.figure;
    const L = LOOKS[persona];

    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.1, 0.95, 0);
      leg.add(box(0.14, 0.9, 0.16, L.coat, 0, -0.45, 0), box(0.15, 0.09, 0.3, SHOE, 0, -0.92, 0.06));
      this.legs.push(leg);

      const arm = new THREE.Group();
      arm.position.set(side * 0.27, 1.55, 0);
      arm.add(box(0.1, 0.58, 0.12, L.coat, 0, -0.29, 0), box(0.09, 0.1, 0.1, SKIN, 0, -0.63, 0));
      this.arms.push(arm);
      f.add(leg, arm);
    }

    f.add(
      box(0.42, 0.66, 0.22, L.coat, 0, 1.27, 0), // jacket
      box(0.13, 0.42, 0.02, L.shirt, 0, 1.37, 0.115),
      box(0.055, 0.36, 0.02, L.tie, 0, 1.36, 0.13),
      box(0.09, 0.08, 0.09, SKIN, 0, 1.64, 0), // neck
    );
    // The keeper wears a hi-vis vest over the coat.
    if (L.vest !== null) f.add(box(0.44, 0.5, 0.24, L.vest, 0, 1.24, 0), box(0.12, 0.5, 0.02, 0x2a3f24, 0, 1.24, 0.125));

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.135, 12, 10), mat(SKIN));
    head.scale.set(0.95, 1.2, 1);
    head.position.set(0, 1.8, 0);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.142, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52), mat(L.hair));
    hair.scale.set(0.98, 1.0, 1.04);
    hair.position.set(0, 1.85, -0.015);
    hair.rotation.x = -0.25;
    f.add(head, hair);
    // The keeper tops it off with a flat cap.
    if (L.cap !== null) {
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.09, 12), mat(L.cap));
      crown.position.set(0, 1.94, -0.01);
      const peak = box(0.24, 0.03, 0.16, L.cap, 0, 1.9, 0.16);
      f.add(crown, peak);
    }
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.017, 6, 5), mat(0x222222));
      eye.position.set(side * 0.05, 1.82, 0.125);
      const brow = box(0.05, 0.012, 0.02, L.hair, side * 0.05, 1.86, 0.125);
      f.add(eye, brow);
    }

    f.scale.setScalar(SCALE);
    f.rotation.order = 'YXZ'; // turn first, then lean forward in his own frame
    this.group.add(f);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    this.group.add(shadow);
  }

  update(cooper: CooperState, dt: number, time: number): void {
    this.group.position.set(cooper.x, 0, cooper.z);
    this.figure.rotation.y = Math.PI / 2 - cooper.heading;

    const running = cooper.speed > 0.1;
    this.stride += dt * (running ? 11 : 0);
    const swing = running ? Math.sin(this.stride) : 0;

    this.legs[0].rotation.x = swing * 0.95;
    this.legs[1].rotation.x = -swing * 0.95;
    this.arms[0].rotation.x = -swing * 0.8;
    this.figure.position.y = running ? Math.abs(Math.cos(this.stride)) * 0.07 : 0;
    // Ramrod-straight back, leaning into the run ever so slightly.
    this.figure.rotation.x = running ? 0.08 : 0;

    // Right arm up, finger wagging, whenever he is telling someone off.
    const right = this.arms[1];
    if (cooper.talking > 0) {
      right.rotation.x = -2.5 + Math.sin(time * 14) * 0.22;
      right.rotation.z = -0.25;
    } else {
      right.rotation.x = swing * 0.8;
      right.rotation.z = 0;
    }
  }
}
