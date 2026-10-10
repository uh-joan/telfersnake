import * as THREE from 'three';
import { CREATURE_KINDS, CREATURES, type CreatureKind } from '../sim/creatures';
import type { WorldView } from '../sim/view';
import { model, paint, PAINTED } from './paint';

type Geo = THREE.BufferGeometry;
const DARK = 0x2a2a2e;
// London's legends.
const SILVER = 0xb8c0cc;
const SILVER_LIGHT = 0xdfe4ec;
const CITY_RED = 0xc8102e;
const LION_GOLD = 0xe8b830;
const MANE = 0xc98a1a;
const CROWN_GOLD = 0xffd23c;
const SKIN = 0xf2c7a5;
const TEAL = 0x1fb8a8;
const PEARL = 0xfff8ee;

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

  // ── London's legends ──────────────────────────────────────────────────
  // The Silver Dragon of the City: silver, rearing, red-lined wings and a red cross on its shield.
  dragon: () => [
    paint(new THREE.CapsuleGeometry(0.24, 0.5, 4, 10), SILVER, (g) => g.rotateX(0.9).translate(0, 0.72, 0)),
    paint(new THREE.CylinderGeometry(0.09, 0.13, 0.42, 8), SILVER, (g) => g.rotateX(0.3).translate(0, 1.1, 0.22)),
    sphere(0.15, SILVER_LIGHT, 0, 1.32, 0.32, 0.9, 0.85, 1.3),
    paint(new THREE.ConeGeometry(0.07, 0.2, 6), SILVER, (g) => g.rotateX(Math.PI / 2).translate(0, 1.3, 0.52)),
    ...[-1, 1].map((s) => paint(new THREE.ConeGeometry(0.03, 0.18, 5), SILVER_LIGHT, (g) => g.rotateX(-0.6).translate(s * 0.08, 1.48, 0.24))),
    ...eyes(0.03, 0.08, 1.36, 0.44, 0xd81e1e),
    // Wings: a silver arm and a red membrane each side, swept up and back.
    ...[-1, 1].flatMap((s) => [
      paint(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 5), SILVER, (g) => g.rotateZ(s * -0.9).translate(s * 0.42, 1.12, -0.12)),
      paint(new THREE.ConeGeometry(0.42, 0.9, 3), CITY_RED, (g) => g.scale(1, 1, 0.12).rotateZ(s * -0.6).translate(s * 0.46, 1.02, -0.16)),
    ]),
    // The City's shield: white with a red cross, held to its chest.
    paint(new THREE.BoxGeometry(0.3, 0.36, 0.05), 0xffffff, (g) => g.translate(0, 0.78, 0.3)),
    paint(new THREE.BoxGeometry(0.07, 0.34, 0.06), CITY_RED, (g) => g.translate(0, 0.78, 0.31)),
    paint(new THREE.BoxGeometry(0.28, 0.07, 0.06), CITY_RED, (g) => g.translate(0, 0.82, 0.31)),
    paint(new THREE.ConeGeometry(0.1, 0.7, 6), SILVER, (g) => g.rotateX(-1.9).translate(0, 0.35, -0.5)),
    ...[-1, 1].map((s) => leg(0.06, 0.45, SILVER, s * 0.14, 0.08)),
  ],
  // The Royal Lion: golden, crowned, a big mane, standing proud.
  lionroyal: () => [
    paint(new THREE.CapsuleGeometry(0.24, 0.56, 4, 10), LION_GOLD, (g) => g.rotateX(Math.PI / 2).translate(0, 0.62, 0)),
    sphere(0.3, MANE, 0, 0.86, 0.34, 1, 1, 0.8),
    sphere(0.18, LION_GOLD, 0, 0.86, 0.52, 1, 0.95, 0.95),
    sphere(0.07, 0xb06a1a, 0, 0.82, 0.68),
    ...eyes(0.03, 0.07, 0.92, 0.66),
    // The crown: a gold band, five points, a red jewel.
    paint(new THREE.CylinderGeometry(0.15, 0.13, 0.1, 10), CROWN_GOLD, (g) => g.translate(0, 1.1, 0.46)),
    ...[0, 1, 2, 3, 4].map((i) => paint(new THREE.ConeGeometry(0.035, 0.12, 4), CROWN_GOLD, (g) => g.translate(Math.cos((i / 5) * Math.PI * 2) * 0.13, 1.2, 0.46 + Math.sin((i / 5) * Math.PI * 2) * 0.13))),
    sphere(0.035, 0xd81e1e, 0, 1.1, 0.6),
    paint(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 5), LION_GOLD, (g) => g.rotateX(-1.25).translate(0, 0.72, -0.58)),
    sphere(0.06, MANE, 0, 0.8, -0.82),
    ...fourLegs(0.06, 0.42, LION_GOLD, 0.15, 0.3),
  ],
  // The Phoenix of St Paul's: a fiery bird with spread wings and a long flame tail, hovering.
  phoenix: () => [
    sphere(0.2, 0xff7a1a, 0, 0.95, 0, 1, 1, 1.3),
    sphere(0.13, 0xffa01a, 0, 1.18, 0.2),
    paint(new THREE.ConeGeometry(0.04, 0.12, 4), 0xffe066, (g) => g.rotateX(Math.PI / 2).translate(0, 1.16, 0.36)),
    ...eyes(0.025, 0.06, 1.22, 0.3),
    ...[0, 1, 2].map((i) => paint(new THREE.ConeGeometry(0.03, 0.16, 4), 0xffd21a, (g) => g.rotateX(-0.5 - i * 0.3).translate(0, 1.3, 0.12 - i * 0.07))),
    ...[-1, 1].flatMap((s) => [
      paint(new THREE.ConeGeometry(0.22, 0.7, 3), 0xe8301a, (g) => g.scale(1, 1, 0.15).rotateZ(s * -1.2).translate(s * 0.42, 1.05, 0)),
      paint(new THREE.ConeGeometry(0.14, 0.45, 3), 0xffc21a, (g) => g.scale(1, 1, 0.15).rotateZ(s * -1.3).translate(s * 0.36, 1.08, 0.04)),
    ]),
    ...[[-0.12, 0xe8301a], [0, 0xffd21a], [0.12, 0xff7a1a]].map(([x, c]) =>
      paint(new THREE.ConeGeometry(0.06, 0.7, 4), c, (g) => g.rotateX(-1.9).translate(x, 0.82, -0.42))),
  ],
  // The Thames Mermaid: sitting on the bank, red hair, a teal tail curled round with its fin up.
  mermaid: () => [
    paint(new THREE.CapsuleGeometry(0.15, 0.28, 4, 8), SKIN, (g) => g.translate(0, 0.62, 0.05)),
    sphere(0.14, SKIN, 0, 0.98, 0.07),
    sphere(0.16, 0xd8452a, 0, 1.02, 0.0, 1.05, 1.05, 1),
    paint(new THREE.CylinderGeometry(0.1, 0.06, 0.35, 8), 0xd8452a, (g) => g.translate(0, 0.78, -0.08)),
    ...eyes(0.025, 0.05, 1.0, 0.2),
    ...[-1, 1].map((s) => sphere(0.06, 0xa070e0, s * 0.07, 0.68, 0.17)),
    paint(new THREE.CapsuleGeometry(0.15, 0.4, 4, 8), TEAL, (g) => g.rotateX(Math.PI / 2).translate(0, 0.32, -0.12)),
    paint(new THREE.CapsuleGeometry(0.1, 0.32, 4, 8), TEAL, (g) => g.rotateX(Math.PI / 2 + 0.6).translate(0.1, 0.26, -0.5)),
    ...[-1, 1].map((s) => paint(new THREE.ConeGeometry(0.12, 0.26, 3), 0x16a0a0, (g) => g.scale(1, 1, 0.2).rotateZ(s * 0.7).translate(0.1 + s * 0.1, 0.52, -0.72))),
  ],
  // The Friendly Tower Ghost: a little sheet ghost with a ruffled Tudor collar, floating.
  ghost: () => [
    sphere(0.26, 0xf6f8ff, 0, 1.0, 0, 1, 1, 1),
    paint(new THREE.CylinderGeometry(0.26, 0.34, 0.5, 14, 1, true), 0xf6f8ff, (g) => g.translate(0, 0.74, 0)),
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
      const a = (i / 8) * Math.PI * 2;
      return paint(new THREE.ConeGeometry(0.07, 0.14, 5), 0xf6f8ff, (g) => g.rotateX(Math.PI).translate(Math.cos(a) * 0.3, 0.45, Math.sin(a) * 0.3));
    }),
    // The ruff: a frilly white collar of little puffs round its neck.
    ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => {
      const a = (i / 10) * Math.PI * 2;
      return sphere(0.08, 0xffffff, Math.cos(a) * 0.27, 0.84, Math.sin(a) * 0.27, 1, 0.6, 1);
    }),
    ...eyes(0.05, 0.09, 1.04, 0.22),
    sphere(0.04, 0x2a2a2e, 0, 0.93, 0.25, 1, 1.3, 0.6),
  ],
  // Gog & Magog: two tiny giants walking side by side, beards and tunics, a spear and a club.
  gog: () => [
    ...[-1, 1].flatMap((s) => [
      paint(new THREE.CapsuleGeometry(0.13, 0.22, 4, 8), s < 0 ? 0x6b8a3a : 0x8a3a3a, (g) => g.translate(s * 0.28, 0.44, 0)),
      sphere(0.12, SKIN, s * 0.28, 0.76, 0.02),
      sphere(0.1, s < 0 ? 0x6b4a2a : 0xa0a0a0, s * 0.28, 0.68, 0.08, 1, 1.1, 0.8),
      paint(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 8), s < 0 ? 0xd8b030 : 0x9a9aa8, (g) => g.translate(s * 0.28, 0.88, 0.0)),
      ...eyes(0.02, 0.04, 0.8, 0.12).map((g) => g.translate(s * 0.28, 0, 0)),
      ...[-1, 1].map((k) => leg(0.045, 0.24, 0x5a3a24, s * 0.28 + k * 0.06, 0)),
    ]),
    // Gog's spear and shield, Magog's club.
    paint(new THREE.CylinderGeometry(0.018, 0.018, 0.9, 5), 0x8a6a40, (g) => g.translate(-0.48, 0.55, 0.05)),
    paint(new THREE.ConeGeometry(0.04, 0.12, 4), 0xc8ccd6, (g) => g.translate(-0.48, 1.04, 0.05)),
    paint(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 10), 0xd8b030, (g) => g.rotateX(Math.PI / 2).translate(-0.3, 0.44, 0.16)),
    paint(new THREE.CylinderGeometry(0.06, 0.025, 0.4, 6), 0x6b4a2a, (g) => g.rotateZ(0.5).translate(0.5, 0.56, 0.05)),
  ],
  // An Elfin Oak fairy: a tiny sprite in a leaf dress, gauzy wings, a starry wand.
  fairy: () => [
    paint(new THREE.ConeGeometry(0.12, 0.26, 8), 0x4cbf5c, (g) => g.translate(0, 0.86, 0)),
    sphere(0.08, SKIN, 0, 1.06, 0.01),
    sphere(0.085, 0xffd23c, 0, 1.1, -0.02, 1, 0.8, 1),
    ...eyes(0.015, 0.03, 1.07, 0.07),
    ...[-1, 1].flatMap((s) => [
      paint(new THREE.SphereGeometry(0.16, 8, 6), 0xd8fff0, (g) => g.scale(0.25, 1, 0.75).rotateZ(s * 0.5).translate(s * 0.16, 1.02, -0.08)),
      paint(new THREE.SphereGeometry(0.1, 8, 6), 0xd8fff0, (g) => g.scale(0.25, 1, 0.75).rotateZ(s * 1.1).translate(s * 0.15, 0.86, -0.08)),
    ]),
    paint(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 4), 0xffffff, (g) => g.rotateZ(-0.6).translate(0.12, 0.98, 0.06)),
    sphere(0.035, 0xfff6a0, 0.19, 1.08, 0.06),
  ],
  // The Pearly Lights: a ring of glowing pearl buttons floating round a pearly king's cap.
  pearly: () => [
    ...[0, 1, 2, 3, 4, 5, 6].map((i) => {
      const a = (i / 7) * Math.PI * 2;
      return paint(new THREE.CylinderGeometry(0.09, 0.09, 0.035, 12), PEARL, (g) => g.rotateX(Math.PI / 2).rotateY(a).translate(Math.cos(a) * 0.32, 0.95 + Math.sin(a * 2) * 0.06, Math.sin(a) * 0.32));
    }),
    paint(new THREE.CylinderGeometry(0.15, 0.16, 0.1, 12), 0x2a2a3a, (g) => g.translate(0, 0.95, 0)),
    paint(new THREE.CylinderGeometry(0.2, 0.2, 0.025, 12), 0x2a2a3a, (g) => g.translate(0, 0.9, 0.04)),
    ...[0, 1, 2, 3, 4, 5].map((i) => sphere(0.025, PEARL, Math.cos((i / 6) * Math.PI * 2) * 0.155, 0.96, Math.sin((i / 6) * Math.PI * 2) * 0.155)),
    sphere(0.12, 0xffffff, 0, 1.12, 0),
  ],
};

/**
 * How big each kind is drawn. The little ones get the biggest boost: at the follow camera's height a
 * true-to-life frog or pixie is no bigger than a snake's head.
 */
const SIZE: Record<CreatureKind, number> = {
  stag: 1.7, unicorn: 1.8, owl: 2.3, frog: 2.5, kitsune: 2.3, pixie: 2.6, squirrel: 2.4, wisp: 2.4,
  dragon: 1.9, lionroyal: 2.1, phoenix: 2.2, mermaid: 2.3, ghost: 2.2, gog: 2.3, fairy: 2.6, pearly: 2.5,
};
/** Radius of the glowing ring on the ground under each one. */
const RING: Record<CreatureKind, number> = {
  stag: 2.0, unicorn: 1.9, owl: 1.6, frog: 1.6, kitsune: 1.6, pixie: 1.5, squirrel: 1.6, wisp: 1.7,
  dragon: 2.2, lionroyal: 1.9, phoenix: 1.8, mermaid: 1.7, ghost: 1.7, gog: 1.9, fairy: 1.5, pearly: 1.6,
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
