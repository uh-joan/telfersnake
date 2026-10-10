import * as THREE from 'three';
import { BUSK_REACH } from '../../sim/world';
import { BEEFEATER, GUARD, PALACE, SAMI, STATUE } from '../../sim/londonLayout';
import { STEP } from '../../sim/world';
import type { Snake } from '../../sim/snake';
import type { WorldView } from '../../sim/view';

/**
 * London's people who stand in one place (docs/LEVEL3-LONDON.md §8): the Royal Guard who never
 * moves (until three laps earn the tiniest smile), Miss Sami the tour guide with her umbrella up, the
 * Beefeater at the Tower gate, the living statue in Covent Garden, the buskers' notes, and, every few
 * minutes, the royal wave from the Palace balcony: a generic crowned silhouette and a corgi, never a
 * likeness of anyone real. The sim owns where they stand (londonLayout.ts); this only draws them.
 * The wave runs on the tick alone, so every phone in a room sees it together, with no protocol.
 */

const SKIN = 0xf0c8a8;
const SHOE = 0x15151a;
const GOLD = 0xf2c230;
const RED = 0xd8342c;
const BLACK = 0x15151a;
const WHITE = 0xf6f6f6;
const SILVER = 0xc9ced6;
const SCALE = 1.5;

/** The royal wave: once every ROYAL_EVERY seconds of room time, for ROYAL_FOR seconds. */
const ROYAL_EVERY = 200;
const ROYAL_FOR = 10;
const ROYAL_OFFSET = 110; // the first one comes 90 s in

const mats = new Map<number, THREE.MeshLambertMaterial>();
function mat(color: number): THREE.MeshLambertMaterial {
  let m = mats.get(color);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color });
    mats.set(color, m);
  }
  return m;
}

function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  return m;
}
function cyl(rt: number, rb: number, h: number, color: number, x = 0, y = 0, z = 0, seg = 14): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color));
  m.position.set(x, y, z);
  return m;
}
function ball(r: number, color: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat(color));
  m.position.set(x, y, z);
  return m;
}

/** A standing grown-up, ~1.9 m before scaling, facing +z. The parts that animate are handed back. */
interface Figure {
  group: THREE.Group;
  arms: [THREE.Group, THREE.Group];
  eyes: THREE.Mesh[];
  mouth: THREE.Mesh;
  smile: THREE.Mesh;
}

interface FigureLook {
  coat: number;
  legs: number;
  skin?: number;
  hair: number | null;
  hands?: number;
  /** A long coat or robe flaring to this radius at the hem (instead of a short jacket). */
  robe?: number;
}

function figure(look: FigureLook): Figure {
  const g = new THREE.Group();
  const skin = look.skin ?? SKIN;
  for (const side of [-1, 1]) g.add(box(0.14, 0.85, 0.16, look.legs, side * 0.1, 0.43, 0), box(0.15, 0.09, 0.3, look.skin === SILVER ? SILVER : SHOE, side * 0.1, 0.05, 0.06));
  g.add(box(0.42, 0.64, 0.24, look.coat, 0, 1.17, 0));
  if (look.robe) g.add(cyl(0.22, look.robe, 0.75, look.coat, 0, 0.82, 0, 16));
  const arms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.27, 1.45, 0);
    arm.add(box(0.1, 0.58, 0.12, look.coat, 0, -0.29, 0), box(0.1, 0.11, 0.11, look.hands ?? skin, 0, -0.63, 0));
    arms.push(arm);
    g.add(arm);
  }
  g.add(box(0.09, 0.08, 0.09, skin, 0, 1.53, 0));
  const head = ball(0.135, skin, 0, 1.68, 0);
  head.scale.set(0.95, 1.2, 1);
  g.add(head);
  if (look.hair !== null) {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.142, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52), mat(look.hair));
    hair.position.set(0, 1.73, -0.015);
    hair.rotation.x = -0.25;
    g.add(hair);
  }
  const eyeColor = look.skin === SILVER ? 0x8a9099 : 0x222222;
  const eyes = [-1, 1].map((side) => ball(0.018, eyeColor, side * 0.05, 1.7, 0.125));
  g.add(...eyes);
  const mouth = box(0.06, 0.012, 0.01, 0x7a3a2a, 0, 1.6, 0.13);
  // The smile: the lower half of a thin ring, hidden until it is earned.
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 4, 10, Math.PI), mat(0x7a3a2a));
  smile.rotation.z = Math.PI;
  smile.position.set(0, 1.615, 0.13);
  smile.visible = false;
  g.add(mouth, smile);
  return { group: g, arms: arms as [THREE.Group, THREE.Group], eyes, mouth, smile };
}

/** A soft round shadow under someone. */
function shadow(r: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(r, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.03;
  return m;
}

/** The Royal Guard in his red sentry box: bearskin, red tunic, gold buttons, white belt. Unarmed: hands at his sides. */
function guard(): Figure & { gem: THREE.Mesh } {
  const f = figure({ coat: RED, legs: BLACK, hair: null, hands: WHITE });
  const g = f.group;
  // The tunic's skirt, the white belt, the gold buttons and collar.
  g.add(box(0.44, 0.16, 0.26, RED, 0, 0.82, 0), box(0.44, 0.06, 0.26, WHITE, 0, 0.95, 0), box(0.2, 0.06, 0.2, GOLD, 0, 1.5, 0));
  for (let i = 0; i < 5; i++) g.add(ball(0.022, GOLD, 0, 1.4 - i * 0.11, 0.125));
  // The bearskin: tall, black and furry-round, with a gold chin strap.
  g.add(cyl(0.17, 0.16, 0.42, 0x0c0c10, 0, 1.98, -0.01, 16), ball(0.17, 0x0c0c10, 0, 2.2, -0.01));
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.01, 4, 12, Math.PI), mat(GOLD));
  strap.rotation.z = Math.PI;
  strap.position.set(0, 1.66, 0.02);
  g.add(strap);
  // The sentry box behind him: red walls, open to the south, a little pyramid roof.
  const sentry = new THREE.Group();
  sentry.add(
    box(1.0, 2.5, 0.08, RED, 0, 1.25, -0.42),
    box(0.08, 2.5, 0.7, RED, -0.48, 1.25, -0.1),
    box(0.08, 2.5, 0.7, RED, 0.48, 1.25, -0.1),
    box(1.08, 0.08, 0.8, WHITE, 0, 2.5, -0.1),
  );
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.78, 0.45, 4), mat(RED));
  roof.rotation.y = Math.PI / 4;
  roof.position.set(0, 2.76, -0.1);
  sentry.add(roof);
  g.add(sentry);
  // The gem that pops out of his bearskin (drawn only while it flies).
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), new THREE.MeshLambertMaterial({ color: 0x4dabf7, emissive: 0x1c5fa0 }));
  gem.visible = false;
  return { ...f, gem };
}

/** Miss Sami, tour guide: her teal coat, and a bright umbrella held high on a stick. */
function sami(): Figure & { brolly: THREE.Group } {
  const f = figure({ coat: 0x2f8f8a, legs: 0x2b2b33, hair: 0x4a2f1c, robe: 0.3 });
  f.group.add(ball(0.08, 0x4a2f1c, 0, 1.8, -0.12)); // her bun
  const right = f.arms[1];
  right.rotation.x = -2.8; // arm up
  const brolly = new THREE.Group();
  brolly.position.set(0, -0.66, 0);
  brolly.add(cyl(0.02, 0.02, 1.6, 0x3a2a24, 0, -0.7, 0, 6));
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.28, 8), mat(0xffd23f));
  canopy.position.set(0, -1.62, 0);
  canopy.rotation.x = Math.PI; // the arm points up, so the canopy is flipped to sit on top
  const stripes = new THREE.Mesh(new THREE.ConeGeometry(0.43, 0.29, 8, 1, true, 0, Math.PI / 4), mat(0xff5fa2));
  stripes.position.copy(canopy.position);
  stripes.rotation.x = Math.PI;
  brolly.add(canopy, stripes, ball(0.03, 0xffd23f, 0, -1.78, 0));
  right.add(brolly);
  return { ...f, brolly };
}

/** The Beefeater (Mr Bramble on Tower duty): red-and-gold Tudor robe, white ruff, flat black hat with ribbons. */
function beefeater(): Figure {
  const f = figure({ coat: 0xb3122a, legs: 0xb3122a, hair: 0x5a4326, robe: 0.36 });
  const g = f.group;
  // Gold bands round the robe, and the crowned-initials badge on the chest (just gold shapes, no letters).
  for (const [y, r] of [[0.5, 0.33], [0.62, 0.31]] as const) g.add(cyl(r + 0.01, r + 0.02, 0.04, GOLD, 0, y, 0, 16));
  g.add(box(0.2, 0.16, 0.02, GOLD, 0, 1.25, 0.125), box(0.08, 0.06, 0.02, GOLD, 0, 1.37, 0.125));
  // The white ruff collar.
  const ruff = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.05, 6, 14), mat(WHITE));
  ruff.rotation.x = Math.PI / 2;
  ruff.position.y = 1.53;
  g.add(ruff);
  // A grey beard, and the flat black Tudor bonnet with its red, white and blue ribbons.
  g.add(ball(0.1, 0x8a8a8a, 0, 1.58, 0.07));
  g.add(cyl(0.21, 0.19, 0.07, 0x101014, 0, 1.86, 0, 16), cyl(0.15, 0.16, 0.08, 0x101014, 0, 1.92, 0, 14));
  for (const [x, c] of [[-0.08, RED], [0, WHITE], [0.08, 0x1f4aa8]] as const) g.add(box(0.035, 0.12, 0.01, c, x, 1.84, 0.2));
  return f;
}

/** The living statue: a silver person on a little box, frozen mid-step with a hand out (and a silver top hat). */
function statue(): Figure & { body: THREE.Group } {
  const f = figure({ coat: SILVER, legs: SILVER, skin: SILVER, hair: null });
  f.group.add(cyl(0.12, 0.13, 0.3, SILVER, 0, 1.92, 0), cyl(0.2, 0.2, 0.02, SILVER, 0, 1.78, 0));
  f.arms[0].rotation.z = -1.2; // one hand out, as if bowing
  f.arms[1].rotation.x = -0.4;
  const body = new THREE.Group();
  body.add(f.group);
  return { ...f, body };
}

/** A note glyph texture for the buskers' tune. */
function noteTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.font = 'bold 52px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 6;
  g.strokeStyle = '#2b2118';
  g.strokeText('♪', 32, 34);
  g.fillStyle = '#ffffff';
  g.fillText('♪', 32, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const NOTE_COLORS = [0xff5fa2, 0xffd23f, 0x3fb6ff, 0x8be36a];

interface Note {
  sprite: THREE.Sprite;
  age: number;
  vx: number;
  vz: number;
}

export class LondonPeople {
  readonly group = new THREE.Group();
  private readonly guard = guard();
  private readonly sami = sami();
  private readonly beefeater = beefeater();
  private readonly statue = statue();
  private readonly royal = new THREE.Group();
  private readonly royalArm = new THREE.Group();
  private readonly corgiPaw = new THREE.Group();
  private readonly notes: Note[] = [];
  private readonly noteMats: THREE.SpriteMaterial[];
  private time = 0;
  /** The guard's smile: seconds left, and who he is looking at. */
  private smileFor = 0;
  private lookAt: Snake | null = null;
  /** The gem's flight from his bearskin to the snake: 0..1, or < 0 when there is none. */
  private gemT = -1;
  private readonly gemFrom = new THREE.Vector3();
  /** The statue's BOO: seconds since it moved (Infinity: still). */
  private booAge = Infinity;
  private noteIn = 0;

  constructor() {
    const place = (f: { group: THREE.Group }, at: { x: number; z: number }, holder?: THREE.Object3D) => {
      const h = holder ?? f.group;
      h.position.set(at.x, 0, at.z);
      h.scale.setScalar(SCALE);
      this.group.add(h);
      const sh = shadow(0.55);
      sh.position.set(at.x, 0.03, at.z);
      this.group.add(sh);
    };
    place(this.guard, GUARD);
    place(this.sami, SAMI);
    place(this.beefeater, BEEFEATER);
    // The statue stands on a little silver box.
    const plinth = box(0.7, 0.3, 0.7, 0x9aa1aa, 0, 0.15, 0);
    this.statue.group.position.y = 0.3;
    this.statue.body.add(plinth);
    place(this.statue, STATUE, this.statue.body);
    this.group.add(this.guard.gem);
    this.buildRoyal();
    this.group.add(this.royal);

    const tex = noteTexture();
    this.noteMats = NOTE_COLORS.map((c) => new THREE.SpriteMaterial({ map: tex, color: c, transparent: true, depthWrite: false }));
    for (let i = 0; i < 28; i++) {
      const sprite = new THREE.Sprite(this.noteMats[i % this.noteMats.length]);
      sprite.scale.setScalar(0.6);
      sprite.visible = false;
      this.group.add(sprite);
      this.notes.push({ sprite, age: Infinity, vx: 0, vz: 0 });
    }
  }

  /**
   * The royal wave on the Palace balcony: a dark, generic crowned silhouette (no face, no likeness)
   * waving one arm, and a little corgi beside, its paw up. Hidden until its moment.
   */
  private buildRoyal(): void {
    const ink = 0x2a2440;
    const r = this.royal;
    // The balcony's front, in world space: the Palace centre's face (see landmarks/palace.ts).
    r.position.set(PALACE.x, 3.82, PALACE.z + 1.3 + 0.5 + 0.35);
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.95, 12), mat(ink));
    robe.position.y = 0.47;
    const head = ball(0.15, ink, 0, 1.05, 0);
    // The crown: a gold band with five points and a red jewel.
    const band = cyl(0.13, 0.13, 0.08, GOLD, 0, 1.22, 0, 12);
    r.add(robe, head, band);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const pt = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 4), mat(GOLD));
      pt.position.set(Math.cos(a) * 0.11, 1.3, Math.sin(a) * 0.11);
      r.add(pt);
    }
    r.add(ball(0.03, RED, 0, 1.23, 0.13));
    this.royalArm.position.set(0.22, 0.8, 0);
    this.royalArm.add(box(0.08, 0.42, 0.08, ink, 0, 0.21, 0), ball(0.06, WHITE, 0, 0.44, 0)); // a white glove
    r.add(this.royalArm);
    // The corgi, sitting up at the railing beside, a paw raised.
    const corgi = new THREE.Group();
    corgi.position.set(-0.55, 0, 0.05);
    const fur = 0xd98a3a;
    corgi.add(box(0.2, 0.28, 0.18, fur, 0, 0.14, 0), ball(0.11, fur, 0, 0.36, 0.04), ball(0.06, WHITE, 0, 0.33, 0.12));
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 4), mat(fur));
      ear.position.set(side * 0.06, 0.48, 0.02);
      corgi.add(ear);
    }
    this.corgiPaw.position.set(0.08, 0.22, 0.08);
    this.corgiPaw.add(box(0.05, 0.14, 0.05, WHITE, 0, 0.07, 0));
    corgi.add(this.corgiPaw);
    r.add(corgi);
    r.visible = false;
  }

  /** Three laps done: he smiles, his eyes flick to that snake, and a gem pops out of his bearskin. */
  smile(at: Snake | undefined): void {
    this.smileFor = 1.5;
    this.lookAt = at ?? null;
    this.gemT = 0;
    this.gemFrom.set(GUARD.x, 2.4 * SCALE, GUARD.z);
  }

  /** The living statue moves: a little jump, arms up. Then still again. */
  boo(): void {
    this.booAge = 0;
  }

  update(world: WorldView, dt: number): void {
    this.time += dt;
    const t = this.time;

    // ---- the guard: perfectly still; only his face changes, and only for a moment.
    this.smileFor = Math.max(0, this.smileFor - dt);
    const smiling = this.smileFor > 0;
    this.guard.smile.visible = smiling;
    this.guard.mouth.visible = !smiling;
    const flick = smiling && this.lookAt ? Math.max(-1, Math.min(1, (this.lookAt.x - GUARD.x) / 4)) * 0.025 : 0;
    this.guard.eyes.forEach((e, i) => (e.position.x = (i === 0 ? -0.05 : 0.05) + flick));
    if (this.gemT >= 0) {
      this.gemT += dt / 0.9;
      const gem = this.guard.gem;
      if (this.gemT >= 1 || !this.lookAt) {
        this.gemT = -1;
        gem.visible = false;
      } else {
        const k = this.gemT;
        gem.visible = true;
        gem.position.set(
          this.gemFrom.x + (this.lookAt.x - this.gemFrom.x) * k,
          this.gemFrom.y + Math.sin(k * Math.PI) * 2 - k * (this.gemFrom.y - 0.6),
          this.gemFrom.z + (this.lookAt.z - this.gemFrom.z) * k,
        );
        gem.rotation.y = t * 8;
      }
    }

    // ---- Miss Sami waves her umbrella gently, so the group can find her.
    this.sami.arms[1].rotation.z = Math.sin(t * 2.2) * 0.12;

    // ---- the living statue: a hop and arms up on BOO, then frozen again.
    this.booAge += dt;
    const jump = this.booAge < 0.7 ? Math.sin((this.booAge / 0.7) * Math.PI) : 0;
    this.statue.group.position.y = 0.3 + jump * 0.35;
    this.statue.arms[0].rotation.z = this.booAge < 0.9 ? -2.7 : -1.2;
    this.statue.arms[1].rotation.z = this.booAge < 0.9 ? 2.7 : 0;
    this.statue.arms[1].rotation.x = this.booAge < 0.9 ? 0 : -0.4;

    // ---- the royal wave, on the room's clock.
    const phase = (world.tick * STEP + ROYAL_OFFSET) % ROYAL_EVERY;
    const on = phase < ROYAL_FOR;
    this.royal.visible = on;
    if (on) {
      const rise = Math.min(1, phase / 0.6, (ROYAL_FOR - phase) / 0.6);
      this.royal.scale.set(1, Math.max(0.01, rise), 1);
      this.royalArm.rotation.z = -0.3 + Math.sin(t * 5) * 0.35; // the slow royal wave
      this.corgiPaw.rotation.x = -1.2 + Math.sin(t * 9) * 0.4;
    }

    // ---- the buskers' notes: from each busker, and round any snake dancing close by.
    this.noteIn -= dt;
    if (this.noteIn <= 0) {
      this.noteIn = 0.28;
      for (const k of world.kids) {
        if (k.kind !== 'busker') continue;
        if (Math.random() < 0.6) this.emit(k.x + 0.3, k.z + 0.3, 1.8);
        for (const s of world.snakes) {
          if (s.alive && Math.hypot(s.x - k.x, s.z - k.z) < BUSK_REACH && Math.random() < 0.7) this.emit(s.x, s.z, 1.2);
        }
      }
    }
    for (const n of this.notes) {
      if (n.age === Infinity) continue;
      n.age += dt;
      if (n.age > 1.6) {
        n.age = Infinity;
        n.sprite.visible = false;
        continue;
      }
      n.sprite.position.x += n.vx * dt;
      n.sprite.position.z += n.vz * dt;
      n.sprite.position.y += 1.1 * dt;
      (n.sprite.material as THREE.SpriteMaterial).opacity = 1;
      n.sprite.scale.setScalar(0.6 * Math.min(1, n.age * 5) * (n.age > 1.2 ? (1.6 - n.age) / 0.4 : 1));
    }
  }

  private emit(x: number, z: number, y: number): void {
    const n = this.notes.find((o) => o.age === Infinity);
    if (!n) return;
    n.age = 0;
    n.vx = (Math.random() - 0.5) * 0.8;
    n.vz = (Math.random() - 0.5) * 0.5;
    n.sprite.position.set(x + (Math.random() - 0.5) * 0.6, y, z + (Math.random() - 0.5) * 0.6);
    n.sprite.visible = true;
  }
}
