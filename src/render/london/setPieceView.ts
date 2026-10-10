import * as THREE from 'three';
import type { Sfx } from '../../audio/sfx';
import { LANDMARKS, TUBE_NAMES } from '../../sim/londonLayout';
import {
  type Arrows, arrowsAt, ARROWS_FOR, type Boat, boatAt, type Burst, BURST_EVERY, burstOf, chimeStart, fireworksClock, LIFT_BELLS,
  LIFT_OPEN, LIFT_RISE, liftAt, type Marcher, PARADE_SIZE, paradeAt, paradeClock, type SetPieceSpots, shipAt, TPS, wobbleAt,
} from '../../sim/setPieces';
import type { WorldView } from '../../sim/view';
import { makeBascule } from './bridges';
import { box, cone, cyl, inkMaterial, inked, merge, outlineGeometry, PALETTE, sphere, toonMaterial } from './landmarks/kit';
import { WATER_Y } from './water';

/**
 * London's set pieces, drawn (docs/LEVEL3-LONDON.md §7): Tower Bridge's bascules lifting for a tall
 * ship, the Changing of the Guard on the Mall, the river bus, the fireworks over the Thames with the
 * Eye lit up in rainbow, the Red Arrows' smoke, the Tube roundels, and the wobbly bridge's sway. Their
 * timing is the sim's own (setPieces.ts, a pure function of the tick), so every phone shows the same
 * show; the sounds that go with the clock (the Westminster Quarters, the bridge bells, the drums,
 * the fireworks) are played from here too. Only what the snakes *do* arrives as events (main.ts).
 */

const BASCULE_UP = 1.3; // radians: how far each bascule tips up (about 75°)
const MAST_H = 8; // under Tower Bridge's high walkways (11 m)
// The follow camera looks steeply down (58°): anything much above the rooftops is out of shot. So the
// jets fly low and the fireworks burst low over the water, and a burst too far away to see from where
// you are is echoed just ahead of you (a picture only: the treats still land where the sim says).
const JET_Y = 7;
const BURST_Y = 5;
/** A burst further than this from your snake is echoed in your view. */
const ECHO_BEYOND = 22;
const SPARKS = 48;
const EYE_LIGHTS = 48;
/** Within this many metres you hear the bridge's bells, the band's drums and the boat's toot. */
const EARSHOT = 45;

const DIRS: THREE.Vector3[] = Array.from({ length: SPARKS }, (_, i) => {
  // Evenly round a sphere (a Fibonacci lattice): a round burst.
  const y = 1 - (2 * (i + 0.5)) / SPARKS;
  const r = Math.sqrt(1 - y * y);
  const a = i * 2.399963;
  return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
});

/** A figure on the Mall, facing +x: navy trousers, red tunic, white belt, a face, and a tall black bearskin (or a drum). */
function marcherGeometry(band: boolean): THREE.BufferGeometry {
  const parts = [
    box(0.22, 0.55, 0.14, PALETTE.navy, 0, 0, -0.1),
    box(0.22, 0.55, 0.14, PALETTE.navy, 0, 0, 0.1),
    box(0.36, 0.6, 0.48, PALETTE.guardRed, 0, 0.55, 0),
    box(0.38, 0.07, 0.5, 0xffffff, 0, 0.75, 0),
    sphere(0.16, 0xf2c9a0, 0.02, 1.32, 0, 10, 8),
  ];
  if (band) {
    parts.push(cyl(0.2, 0.2, 0.3, 0xffffff, 0.34, 0.62, 0, 12), cyl(0.21, 0.21, 0.05, PALETTE.guardRed, 0.34, 0.62, 0, 12));
    parts.push(cyl(0.18, 0.2, 0.32, 0x1d1f24, 0, 1.4, 0, 10)); // a smaller bandsman's cap
  } else {
    parts.push(cyl(0.2, 0.2, 0.62, 0x1d1f24, 0, 1.4, 0, 10), sphere(0.2, 0x1d1f24, 0, 2.02, 0, 10, 6, Math.PI * 2, Math.PI / 2));
  }
  return merge(parts);
}

/** A tall ship, facing +x: a dark hull with a gold stripe, three masts, square white sails, a red flag. */
function tallShip(sail: number): THREE.Group {
  const parts = [
    box(5.4, 1.1, 1.7, 0x5a3a24, -0.2, -0.3, 0),
    box(5.5, 0.18, 1.74, 0xf2c230, -0.2, 0.5, 0),
    cone(0.85, 1.4, 0x5a3a24, 0, 0, 0, 4).rotateZ(-Math.PI / 2).translate(2.5, 0.25, 0), // the bow
    box(5.2, 0.1, 1.5, 0xc79a62, -0.2, 0.78, 0), // the deck
  ];
  for (const [x, h] of [[-1.8, MAST_H - 1.5], [0, MAST_H], [1.8, MAST_H - 1]] as const) {
    parts.push(cyl(0.07, 0.09, h, 0x3d2a1c, x, 0.8, 0, 6));
    for (const y of [0.35, 0.65]) parts.push(box(0.06, h * 0.25, 1.9 - y, sail, x + 0.08, 0.8 + h * y, 0));
  }
  parts.push(box(0.04, 0.4, 0.7, 0xd8342c, 0, 0.8 + MAST_H, 0.35)); // a red flag at the top
  return inked(parts, 0.04);
}

/** The river bus: a white hull with a blue band, a glassy cabin and a little red-white-blue flag (faces +x). */
function riverBus(): THREE.Group {
  const parts = [
    box(3.2, 0.5, 1.3, 0xffffff, 0, -0.2, 0),
    box(3.24, 0.14, 1.34, 0x1f6fd1, 0, 0.12, 0),
    cone(0.65, 0.7, 0xffffff, 0, 0, 0, 4).rotateZ(-Math.PI / 2).translate(1.6, 0.05, 0), // the bow
    box(1.8, 0.5, 1.1, 0xf4f8fb, -0.3, 0.3, 0),
    box(1.82, 0.2, 1.12, 0x8ec9ea, -0.3, 0.5, 0),
    box(1.9, 0.06, 1.16, 0x1f6fd1, -0.3, 0.8, 0),
    cyl(0.025, 0.025, 0.5, 0x333333, -1.35, 0.3, 0, 5),
    box(0.02, 0.18, 0.3, 0xd8342c, -1.35, 0.62, 0.15),
  ];
  return inked(parts, 0.035);
}

/** A Red Arrow: a little red delta jet with a white stripe, nose +x. */
function jet(): THREE.Group {
  const wing = new THREE.Shape();
  wing.moveTo(0.8, 0);
  wing.lineTo(-0.9, 1.1);
  wing.lineTo(-0.7, 0);
  wing.lineTo(-0.9, -1.1);
  wing.closePath();
  const parts = [
    cyl(0.16, 0.22, 2.4, 0xd52b1e, 0, 0, 0, 8).rotateZ(-Math.PI / 2).translate(-1.2, 0, 0),
    cone(0.16, 0.6, 0xd52b1e, 0, 0, 0, 8).rotateZ(-Math.PI / 2).translate(1.2, 0, 0),
    box(1.0, 0.04, 2.2, 0xd52b1e, -0.4, -0.02, 0),
    box(0.9, 0.05, 0.2, 0xffffff, -0.4, 0.0, 0),
    box(0.4, 0.5, 0.05, 0xd52b1e, -1.0, 0.1, 0),
    sphere(0.14, 0x8ec9ea, 0.4, 0.14, 0, 8, 6),
  ];
  return inked(parts, 0.03, { castShadow: false });
}

/** A Tube roundel on a post: our own red ring and blue bar (no lettering but the place's name). */
function roundel(name: string): THREE.Group {
  const g = new THREE.Group();
  const post = inked([cyl(0.07, 0.07, 2.2, 0x2b2e3a, 0, 0, 0, 8)], 0.03);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.16, 8, 32), new THREE.MeshToonMaterial({ color: 0xdc241f }));
  ring.position.set(0, 2.55, 0.05);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.47, 32), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  disc.position.set(0, 2.55, 0.02);
  // The bar, with the station's name in white on blue.
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const x = c.getContext('2d')!;
  x.fillStyle = '#1d2a8c';
  x.fillRect(0, 0, 512, 96);
  x.fillStyle = '#ffffff';
  x.font = '900 54px system-ui, sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(name, 256, 52, 490);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.4, 0.08), [
    new THREE.MeshBasicMaterial({ color: 0x1d2a8c }), new THREE.MeshBasicMaterial({ color: 0x1d2a8c }),
    new THREE.MeshBasicMaterial({ color: 0x1d2a8c }), new THREE.MeshBasicMaterial({ color: 0x1d2a8c }),
    new THREE.MeshBasicMaterial({ map: tex }), new THREE.MeshBasicMaterial({ color: 0x1d2a8c }),
  ]);
  bar.position.set(0, 2.55, 0.14);
  g.add(post, ring, disc, bar);
  return g;
}

/** The stairs down: a dark hole in the paper with white step lines and a railing round three sides. */
function stairs(): THREE.Group {
  const parts = [box(2.2, 0.03, 2.2, 0x23252e, 0, 0.005, 0)];
  for (let i = 0; i < 4; i++) parts.push(box(1.8, 0.035, 0.08, 0xc9ccd6, 0, 0.006, -0.7 + i * 0.4));
  for (const s of [-1, 1]) parts.push(box(0.08, 0.5, 2.2, 0x2b2e3a, s * 1.12, 0, 0));
  parts.push(box(2.3, 0.5, 0.08, 0x2b2e3a, 0, 0, -1.12));
  return inked(parts, 0.03, { castShadow: false });
}

export class SetPieceView {
  readonly group = new THREE.Group();
  private readonly west: THREE.Group;
  private readonly east: THREE.Group;
  private readonly ship: THREE.Group;
  private readonly boat: THREE.Group;
  private readonly bandMesh: THREE.InstancedMesh;
  private readonly guardMesh: THREE.InstancedMesh;
  private readonly sparks: THREE.InstancedMesh;
  private readonly eyeLights: THREE.InstancedMesh;
  private readonly jets: THREE.Group[] = [];
  private readonly smoke: THREE.Mesh[] = [];
  private millennium: THREE.Object3D | null = null;
  private sway = 0;
  /** The show's clock: the world's tick, smoothed to a float for animation. */
  private ft = -1;
  /** The last whole tick heard, for sounds that go off as the clock passes a mark. */
  private lastTick = -1;
  private drumIn = 0;
  private drumBeat = 0;
  private shipSail = -1;
  private readonly marchers: Marcher[] = [];
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly c = new THREE.Color();
  private readonly at = { x: 0, z: 0, heading: 0 };
  private readonly boatState: Boat = { x: 0, z: 0, heading: 0, dock: -1, next: 0, leaveIn: 0 };
  private readonly burst: Burst = { tick: 0, k: 0, x: 0, z: 0, finale: false, colour: 0 };
  private readonly arrows: Arrows = { x: 0, z: 0, heading: 0, t: 0, line: 0, x0: 0, z0: 0 };
  private readonly eyeAt: THREE.Vector3;

  constructor(private readonly spots: SetPieceSpots, private readonly sfx: () => Sfx | null, seed: number) {
    const span = spots.span;
    // Tower Bridge's bascules, hinged at the towers' inner faces.
    this.west = makeBascule(1);
    this.west.position.set(span.x - span.w / 2, 0, span.z);
    this.east = makeBascule(-1);
    this.east.position.set(span.x + span.w / 2, 0, span.z);
    this.group.add(this.west, this.east);

    this.ship = new THREE.Group();
    this.setShip(seed);
    this.group.add(this.ship);

    this.boat = riverBus();
    this.group.add(this.boat);

    // The parade: the band (drums) and the guards (bearskins), instanced, each with its ink hull.
    const parade = (band: boolean) => {
      const geo = marcherGeometry(band);
      const mesh = new THREE.InstancedMesh(geo, toonMaterial(), PARADE_SIZE);
      const ink = new THREE.InstancedMesh(outlineGeometry(geo, 0.035), inkMaterial(), PARADE_SIZE);
      ink.instanceMatrix = mesh.instanceMatrix;
      mesh.add(ink);
      mesh.castShadow = true;
      mesh.frustumCulled = ink.frustumCulled = false;
      mesh.count = 0;
      this.group.add(mesh);
      return mesh;
    };
    this.bandMesh = parade(true);
    this.guardMesh = parade(false);

    // Fireworks: one pool of glowing sparks (no lighting: they glow on their own).
    this.sparks = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.32), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), (SPARKS + 1) * 6);
    this.sparks.frustumCulled = false;
    this.sparks.count = 0;
    this.sparks.setColorAt(0, this.c.setHex(0xffffff));
    this.group.add(this.sparks);

    // The Eye lit up in rainbow for the fireworks: lights round its rim, on the face the camera sees.
    const eye = LANDMARKS.find((l) => l.id === 'eye')!.at;
    this.eyeAt = new THREE.Vector3(eye.x, 10.7, eye.z - 2.4 + 0.75);
    this.eyeLights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), EYE_LIGHTS);
    for (let i = 0; i < EYE_LIGHTS; i++) {
      const a = (i / EYE_LIGHTS) * Math.PI * 2;
      this.m.makeTranslation(this.eyeAt.x + Math.cos(a) * 9, this.eyeAt.y + Math.sin(a) * 9, this.eyeAt.z);
      this.eyeLights.setMatrixAt(i, this.m);
      this.eyeLights.setColorAt(i, this.c.setHex(0xffffff));
    }
    this.eyeLights.visible = false;
    this.group.add(this.eyeLights);

    // The Red Arrows and their red, white and blue smoke.
    const smokeColours = [0xe8303a, 0xffffff, 0x2f5fd0];
    for (let i = 0; i < 3; i++) {
      const j = jet();
      j.visible = false;
      this.jets.push(j);
      const trail = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 0.9), new THREE.MeshBasicMaterial({ color: smokeColours[i], transparent: true, opacity: 0.7, depthWrite: false }));
      trail.visible = false;
      this.smoke.push(trail);
      this.group.add(j, trail);
    }
  }

  /** The tall ship's sails differ from room to room (the set-piece seed). */
  private setShip(seed: number): void {
    if (this.shipSail === seed) return;
    this.shipSail = seed;
    this.ship.clear();
    const sails = [0xfffbea, 0xf6e1c6, 0xe8f1ff, 0xffe9ef];
    this.ship.add(tallShip(sails[seed % sails.length]));
  }

  /** The Tube roundels and stairs at each station, and the wobbly bridge to sway (from the scenery). */
  bind(scenery: THREE.Object3D | null, portals: readonly { id: string; at: { x: number; z: number } }[]): void {
    this.millennium = scenery?.getObjectByName('millennium') ?? null;
    if (this.group.getObjectByName('tube')) return;
    const tube = new THREE.Group();
    tube.name = 'tube';
    for (const p of portals) {
      const st = stairs();
      st.position.set(p.at.x, 0, p.at.z);
      const sign = roundel(TUBE_NAMES[p.id] ?? '');
      sign.position.set(p.at.x + 1.5, 0, p.at.z - 1.2);
      tube.add(st, sign);
    }
    this.group.add(tube);
  }

  /** Forget the last clock (a new world): no sounds for marks passed before we got here. */
  reset(): void {
    this.ft = -1;
    this.lastTick = -1;
  }

  update(world: WorldView, dt: number, time: number): void {
    const sp = this.spots;
    const tick = world.tick;
    this.setShip(world.setPieceSeed);
    // A smooth clock for the animation, kept on the world's tick.
    if (this.ft < 0 || Math.abs(this.ft - tick) > 8) this.ft = tick;
    else this.ft += dt * TPS + (tick - this.ft) * Math.min(1, dt * 4);
    const ft = this.ft;
    const me = world.snake;
    const near = (x: number, z: number, r = EARSHOT) => (me.x - x) ** 2 + (me.z - z) ** 2 < r * r;

    // ---- Tower Bridge and the tall ship
    const lift = liftAt(ft);
    this.west.rotation.z = lift.raise * BASCULE_UP;
    this.east.rotation.z = -lift.raise * BASCULE_UP;
    const sailing = shipAt(ft, sp, this.at);
    this.ship.visible = sailing;
    if (sailing) {
      const fade = Math.min(1, lift.at / TPS, (LIFT_BELLS + LIFT_RISE + LIFT_OPEN + 4 * TPS - lift.at) / TPS);
      this.ship.position.set(this.at.x, WATER_Y + 0.2, this.at.z);
      this.ship.rotation.y = -this.at.heading;
      this.ship.scale.setScalar(Math.max(0.01, fade));
    }

    // ---- the Changing of the Guard
    const n = paradeAt(ft, sp.parade, this.marchers);
    let bands = 0;
    let guards = 0;
    for (let i = 0; i < n; i++) {
      const mr = this.marchers[i];
      const step = Math.abs(Math.sin(time * 6 + i * 0.9)) * 0.08;
      this.q.setFromAxisAngle(this.v.set(0, 1, 0), -mr.heading);
      this.m.compose(this.v.set(mr.x, step, mr.z), this.q, this.s.set(1, 1, 1));
      if (mr.band) this.bandMesh.setMatrixAt(bands++, this.m);
      else this.guardMesh.setMatrixAt(guards++, this.m);
    }
    this.bandMesh.count = bands;
    this.guardMesh.count = guards;
    this.bandMesh.instanceMatrix.needsUpdate = true;
    this.guardMesh.instanceMatrix.needsUpdate = true;
    if (n > 0 && dt > 0 && near(this.marchers[0].x, this.marchers[0].z, 30)) {
      // Rum-tum-tum-tum: the band's drums, four to a bar.
      this.drumIn -= dt;
      if (this.drumIn <= 0) {
        this.drumIn = 0.43;
        this.sfx()?.drum(this.drumBeat++ % 4 === 0);
      }
    }

    // ---- the river bus (it ducks under the Millennium Bridge, squashing comically)
    boatAt(ft, sp, this.boatState);
    const b = this.boatState;
    const d = Math.max(Math.abs(b.x - sp.millennium.x) - sp.millennium.w / 2, Math.abs(b.z - sp.millennium.z) - sp.millennium.d / 2);
    const duck = Math.min(1, Math.max(0, 1 - d / 2.5));
    this.boat.position.set(b.x, WATER_Y + 0.25 - duck * 0.25 + Math.sin(time * 2) * 0.03, b.z);
    this.boat.rotation.y = -b.heading;
    this.boat.scale.set(1, 1 - duck * 0.65, 1);

    // ---- fireworks over the Thames, and the Eye in rainbow
    const show = fireworksClock(ft);
    let sparks = 0;
    if (show >= 0) {
      const kNow = Math.floor(show / BURST_EVERY);
      for (let k = kNow - 1; k <= kNow + 1; k++) {
        if (!burstOf(Math.floor(ft), k, sp, world.setPieceSeed, this.burst)) continue;
        sparks = this.drawBurst(this.burst, ft, sparks);
        // Too far off to see from here: echo it just ahead of you, a little to one side.
        if (Math.hypot(this.burst.x - me.x, this.burst.z - me.z) > ECHO_BEYOND) {
          this.burst.x = me.x + (k % 2 === 0 ? -1 : 1) * (6 + (k % 3) * 2);
          this.burst.z = me.z - 5 - (k % 2) * 2;
          sparks = this.drawBurst(this.burst, ft, sparks);
        }
      }
    }
    this.sparks.count = sparks;
    this.sparks.instanceMatrix.needsUpdate = true;
    if (this.sparks.instanceColor) this.sparks.instanceColor.needsUpdate = true;
    this.eyeLights.visible = show >= 0;
    if (show >= 0) {
      for (let i = 0; i < EYE_LIGHTS; i++) this.eyeLights.setColorAt(i, this.c.setHSL((i / EYE_LIGHTS + time * 0.25) % 1, 0.9, 0.6));
      if (this.eyeLights.instanceColor) this.eyeLights.instanceColor.needsUpdate = true;
    }

    // ---- the Red Arrows
    const flying = arrowsAt(ft, sp, world.setPieceSeed, this.arrows);
    const a = this.arrows;
    for (let i = 0; i < 3; i++) {
      const j = this.jets[i];
      const trail = this.smoke[i];
      j.visible = trail.visible = flying;
      if (!flying) continue;
      const side = i === 0 ? 0 : i === 1 ? -1 : 1;
      const back = i === 0 ? 0 : 3.5;
      const cx = Math.cos(a.heading);
      const cz = Math.sin(a.heading);
      const x = a.x - cx * back - cz * side * 3;
      const z = a.z - cz * back + cx * side * 3;
      const y = JET_Y + Math.sin(time * 3 + i) * 0.2;
      j.position.set(x, y, z);
      j.rotation.set(0, -a.heading, 0);
      // Smoke from where it came in to just behind the jet, thinning out at the end of the pass.
      const sx = a.x0 - cz * side * 3;
      const sz = a.z0 + cx * side * 3;
      const len = Math.max(0.1, Math.hypot(x - sx, z - sz) - 1.5);
      const keep = Math.min(len, 140);
      trail.scale.set(keep, 1, 1);
      trail.position.set(x - cx * (1.5 + keep / 2), y - 0.1, z - cz * (1.5 + keep / 2));
      trail.rotation.set(0, -a.heading, 0);
      (trail.material as THREE.MeshBasicMaterial).opacity = 0.7 * Math.min(1, (1 - a.t) * 4);
    }

    // ---- the wobbly bridge sways (more with a snake on it)
    if (this.millennium) {
      const deck = sp.millennium;
      const busy = world.snakes.some((s) => s.alive && Math.abs(s.x - deck.x) < deck.w / 2 && Math.abs(s.z - deck.z) < deck.d / 2);
      this.sway += ((busy ? 1 : 0.15) - this.sway) * Math.min(1, dt * 2);
      this.millennium.rotation.z = wobbleAt(ft) * 0.05 * this.sway;
    }

    this.sounds(world, tick, near);
  }

  /** Draw one firework: its rocket going up before the bang, then a ball of sparks falling and fading. */
  private drawBurst(b: Burst, ft: number, at: number): number {
    const rise = 40;
    const age = (ft - b.tick) / TPS;
    const y0 = BURST_Y + (b.k % 3) * 1.2;
    if (ft < b.tick - rise) return at;
    if (ft < b.tick) {
      const k = 1 - (b.tick - ft) / rise;
      this.m.makeTranslation(b.x, 2 + (y0 - 2) * k, b.z);
      this.m.scale(this.s.set(0.6, 1.6, 0.6));
      this.sparks.setMatrixAt(at, this.m);
      this.sparks.setColorAt(at, this.c.setHex(0xfff3b0));
      return at + 1;
    }
    if (age > 2.2) return at;
    const r = (b.finale ? 7 : 5) * (1 - Math.exp(-2.4 * age));
    const size = Math.max(0.01, 1.6 * (1 - age / 2.2));
    for (let i = 0; i < SPARKS; i++) {
      const dir = DIRS[i];
      this.m.makeTranslation(b.x + dir.x * r, Math.max(0.3, y0 + dir.y * r - 1.6 * age * age), b.z + dir.z * r);
      this.m.scale(this.s.setScalar(size));
      this.sparks.setMatrixAt(at, this.m);
      this.sparks.setColorAt(at, this.c.setHex(i % 5 === 0 ? 0xffffff : b.colour));
      at++;
    }
    return at;
  }

  /** The sounds that go with the clock: they play once as the tick passes their mark. */
  private sounds(world: WorldView, tick: number, near: (x: number, z: number, r?: number) => boolean): void {
    const last = this.lastTick;
    this.lastTick = tick;
    const sfx = this.sfx();
    if (!sfx || last < 0 || tick <= last || tick - last > 30) return;
    const passed = (mark: number) => mark > last && mark <= tick;
    const sp = this.spots;
    // Big Ben's quarters, every minute, everywhere (the BONGs are the sim's events).
    if (passed(chimeStart(tick))) sfx.quarters();
    // Tower Bridge: bells, the grind up, the ship's horn, the grind down.
    const lift = liftAt(tick);
    if (lift.phase !== 'down' && near(sp.span.x, sp.span.z)) {
      const start = tick - lift.at;
      if (passed(start)) sfx.bridgeBells();
      if (passed(start + LIFT_BELLS) || passed(start + LIFT_BELLS + LIFT_RISE + LIFT_OPEN)) sfx.grind();
      if (passed(start + LIFT_BELLS + LIFT_RISE + LIFT_OPEN / 2 - 2 * TPS)) sfx.shipHorn();
    }
    // The river bus casting off.
    boatAt(tick, sp, this.boatState);
    if (this.boatState.dock >= 0 && this.boatState.leaveIn === 60 && near(this.boatState.x, this.boatState.z, 30)) sfx.toot();
    // Fireworks: each rocket's whistle and bang (a big show, heard all over).
    const show = fireworksClock(tick);
    if (show >= 0) {
      const k = Math.floor(show / BURST_EVERY) + 1;
      if (burstOf(tick, k, sp, world.setPieceSeed, this.burst) && passed(this.burst.tick - 27)) sfx.firework();
    }
    // The Red Arrows roar over.
    if (arrowsAt(tick, sp, world.setPieceSeed, this.arrows) && this.arrows.t * ARROWS_FOR < tick - last + 1) sfx.jets();
    // The parade sets off: a drum roll.
    if (paradeClock(tick, sp.parade) === 0 && near(sp.parade[0].x, sp.parade[0].z, 60)) sfx.drum(true);
  }
}
