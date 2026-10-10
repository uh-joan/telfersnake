import * as THREE from 'three';
import { BUTTON_LIFE, JEWEL_KINDS } from '../../sim/treasures';
import type { WorldView } from '../../sim/view';
import { STEP } from '../../sim/world';
import { model, paint, PAINTED } from '../paint';

/**
 * London's Crown Jewels and the Pearly Lights' button trail (A5). Five gems, each its own colour and
 * cut, sparkling on a little gold crown base, bobbing and turning; and the pearl buttons, glowing
 * discs that fade out as the trail runs out. Empty on any stage without them.
 */

/** Each gem's colour, by JEWEL_KINDS index: ruby, sapphire, emerald, diamond, amethyst. */
export const JEWEL_COLOURS = [0xe0115f, 0x1f5fe0, 0x14b86a, 0xe8f6ff, 0x9b4de0];
const GOLD = 0xffc93c;
const BUTTON_MAX = 96;

/** A gem of cut `i` (each a different shape), sat in a small crown, with its centre about 1.1 m up. */
function jewelModel(i: number): THREE.BufferGeometry {
  const c = JEWEL_COLOURS[i];
  const gem = (() => {
    switch (i) {
      case 0: return new THREE.OctahedronGeometry(0.36, 0); // ruby: a classic diamond-shape
      case 1: return new THREE.CylinderGeometry(0.3, 0.3, 0.3, 6).rotateX(Math.PI / 2); // sapphire: a hexagon slab
      case 2: return new THREE.BoxGeometry(0.4, 0.5, 0.26); // emerald: the emerald cut
      case 3: return new THREE.ConeGeometry(0.36, 0.5, 8).rotateX(Math.PI); // diamond: a brilliant, point down
      default: return new THREE.DodecahedronGeometry(0.3, 0); // amethyst: a round, faceted stone
    }
  })();
  const parts = [
    paint(gem, c, (g) => g.translate(0, 1.15, 0)),
    // The crown base: a gold band, five points, a cushion of red velvet.
    paint(new THREE.CylinderGeometry(0.34, 0.3, 0.16, 12), GOLD, (g) => g.translate(0, 0.62, 0)),
    paint(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 12), 0xb0122a, (g) => g.translate(0, 0.74, 0)),
    ...[0, 1, 2, 3, 4].map((k) => {
      const a = (k / 5) * Math.PI * 2;
      return paint(new THREE.ConeGeometry(0.06, 0.2, 4), GOLD, (g) => g.translate(Math.cos(a) * 0.3, 0.8, Math.sin(a) * 0.3));
    }),
  ];
  return model(parts, `jewel-${JEWEL_KINDS[i]}`);
}

/** A soft round glow for under each jewel and behind each button. */
function glowTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class LegendView {
  readonly group = new THREE.Group();
  private readonly jewels: THREE.Mesh[] = [];
  private readonly glows: THREE.Mesh[] = [];
  private readonly buttons: THREE.InstancedMesh;
  private readonly buttonGlow: THREE.InstancedMesh;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  private readonly pos = new THREE.Vector3();
  private readonly scl = new THREE.Vector3();

  constructor(count: number) {
    const tex = glowTexture();
    for (let i = 0; i < count; i++) {
      const k = i % JEWEL_KINDS.length;
      const jewel = new THREE.Mesh(jewelModel(k), PAINTED);
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(2.6, 2.6),
        new THREE.MeshBasicMaterial({ map: tex, color: JEWEL_COLOURS[k], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
      glow.rotation.x = -Math.PI / 2;
      this.jewels.push(jewel);
      this.glows.push(glow);
      this.group.add(jewel, glow);
    }
    // A pearl button: a flat white disc with four little holes (dark dots), standing up to face the camera-ish.
    const disc = model([
      paint(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 14), 0xfffaf0, (g) => g.rotateX(1.1)),
      ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, y]) =>
        paint(new THREE.CylinderGeometry(0.03, 0.03, 0.07, 6), 0xb8b0a0, (g) => g.rotateX(1.1).translate(x * 0.06, y * 0.06 * 0.45, y * 0.06 * 0.9 + 0.01))),
    ], 'pearl-button');
    this.buttons = new THREE.InstancedMesh(disc, PAINTED, BUTTON_MAX);
    this.buttons.frustumCulled = false;
    this.buttons.count = 0;
    this.buttonGlow = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: tex, color: 0xfff4d0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
      BUTTON_MAX,
    );
    this.buttonGlow.frustumCulled = false;
    this.buttonGlow.count = 0;
    this.group.add(this.buttons, this.buttonGlow);
  }

  update(world: WorldView, time: number): void {
    world.treasures.forEach((t, i) => {
      const jewel = this.jewels[i];
      const glow = this.glows[i];
      if (!jewel) return;
      const shown = t.respawnIn <= 0;
      jewel.visible = glow.visible = shown;
      if (!shown) return;
      jewel.position.set(t.x, 0.15 + Math.sin(time * 2.2 + i) * 0.15, t.z);
      jewel.rotation.y = time * 1.4 + i;
      jewel.scale.setScalar(1.4);
      glow.position.set(t.x, 0.06, t.z);
      const pulse = 0.85 + 0.15 * Math.sin(time * 4 + i * 1.3);
      glow.scale.setScalar(pulse);
      (glow.material as THREE.MeshBasicMaterial).opacity = 0.75 * pulse;
    });

    const n = Math.min(BUTTON_MAX, world.buttons.length);
    for (let i = 0; i < n; i++) {
      const b = world.buttons[i];
      const age = (world.tick - b.born) * STEP;
      // Fade (shrink) over the trail's last five seconds; a gentle twinkle along the line.
      const fade = Math.max(0, Math.min(1, (BUTTON_LIFE - age) / 5));
      const s = (0.9 + 0.15 * Math.sin(time * 5 - i * 0.6)) * fade * 1.6;
      this.m.compose(this.pos.set(b.x, 0.45 + Math.sin(time * 3 + i) * 0.08, b.z), this.q.identity(), this.scl.set(s, s, s));
      this.buttons.setMatrixAt(i, this.m);
      const g = 1.6 * s;
      this.m.compose(this.pos.set(b.x, 0.05, b.z), this.flat, this.scl.set(g, g, g));
      this.buttonGlow.setMatrixAt(i, this.m);
    }
    this.buttons.count = this.buttonGlow.count = n;
    if (n > 0) {
      this.buttons.instanceMatrix.needsUpdate = true;
      this.buttonGlow.instanceMatrix.needsUpdate = true;
    }
  }
}

/**
 * The Elfin Oak in Kensington Gardens: an old carved stump full of tiny fairy doors, windows and
 * toadstools, where the legends gather. A solid in the sim (ELFIN_OAK); one merged model here.
 */
export function makeElfinOak(at: { x: number; z: number; r: number }): THREE.Group {
  const bark = 0x7a5232;
  const parts: THREE.BufferGeometry[] = [
    paint(new THREE.CylinderGeometry(at.r * 0.85, at.r * 1.15, 1.8, 10), bark, (g) => g.translate(0, 0.9, 0)),
    // Gnarled lumps and two stubby broken branches.
    ...[0, 1.7, 3.4, 5].map((a, i) => paint(new THREE.SphereGeometry(0.38, 8, 6), 0x6b4529, (g) => g.translate(Math.cos(a) * at.r * 0.9, 0.5 + i * 0.32, Math.sin(a) * at.r * 0.9))),
    paint(new THREE.CylinderGeometry(0.18, 0.28, 0.9, 6), bark, (g) => g.rotateZ(0.8).translate(at.r * 0.8, 1.8, 0)),
    paint(new THREE.CylinderGeometry(0.14, 0.22, 0.7, 6), bark, (g) => g.rotateX(-0.7).translate(0, 1.9, -at.r * 0.7)),
  ];
  // Fairy doors (bright, round-topped) and glowing windows all round the trunk.
  const doors = [0xd8452a, 0x2f7de0, 0xffc93c, 0x4cbf5c, 0x9b4de0];
  doors.forEach((c, i) => {
    const a = (i / doors.length) * Math.PI * 2 + 0.3;
    const x = Math.cos(a) * at.r * 1.02;
    const z = Math.sin(a) * at.r * 1.02;
    parts.push(paint(new THREE.BoxGeometry(0.24, 0.36, 0.06), c, (g) => g.rotateY(Math.PI / 2 - a).translate(x, 0.3 + (i % 2) * 0.55, z)));
    parts.push(paint(new THREE.SphereGeometry(0.06, 6, 4), 0xfff2a0, (g) => g.translate(Math.cos(a + 0.5) * at.r * 0.98, 1.2 + (i % 3) * 0.15, Math.sin(a + 0.5) * at.r * 0.98)));
  });
  // Red spotted toadstools round its foot.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.6;
    const x = Math.cos(a) * (at.r + 0.6);
    const z = Math.sin(a) * (at.r + 0.6);
    parts.push(paint(new THREE.CylinderGeometry(0.05, 0.06, 0.2, 6), 0xf3ead8, (g) => g.translate(x, 0.1, z)));
    parts.push(paint(new THREE.SphereGeometry(0.15, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), 0xe03131, (g) => g.translate(x, 0.2, z)));
  }
  const group = new THREE.Group();
  group.add(new THREE.Mesh(model(parts, 'elfin-oak'), PAINTED));
  group.position.set(at.x, 0, at.z);
  return group;
}
