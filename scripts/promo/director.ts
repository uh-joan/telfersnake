/**
 * Telfersnake promo: the director. DEV ONLY — this page is served by `vite` in development and is
 * never part of the production build (vite builds index.html alone, and nothing in src/ imports it).
 *
 * It rebuilds the game's renderer exactly as src/main.ts wires it (the same Stage, views, HUD and
 * weather), but instead of a player and a wall clock it runs a scripted shot list (./shots.ts) on a
 * virtual clock, one exact frame at a time, on command from scripts/promo/record.mjs. Every sound
 * the game would have made is logged with its time, so the audio pass can replay it sample-exactly.
 */
import { advanceTo, clockMs, reseed, syncAnimations } from './env'; // first: clocks and dice
import '../../src/style.css';
import * as THREE from 'three';
import { skinLook } from '../../src/meta/catalogue';
import { AnimalView } from '../../src/render/animalView';
import { BeeView } from '../../src/render/beeView';
import { CooperView } from '../../src/render/cooperView';
import { CreatureView } from '../../src/render/creatureView';
import { FoodView } from '../../src/render/foodView';
import { HazardView } from '../../src/render/hazardView';
import { KidView } from '../../src/render/kidView';
import { disposeTree } from '../../src/render/paint';
import { PredatorView } from '../../src/render/predatorView';
import { ProjectileView } from '../../src/render/projectileView';
import { makeStageScene } from '../../src/render/scenery';
import type { School } from '../../src/render/school';
import { SnakeView } from '../../src/render/snakeView';
import { Sparkles } from '../../src/render/sparkles';
import { Stage } from '../../src/render/stage';
import { TrailView } from '../../src/render/trailView';
import { UpgradeFx } from '../../src/render/upgradeFx';
import { Weather } from '../../src/render/weather';
import { COMMON_GREETERS } from '../../src/sim/commonLayout';
import { CREATURES } from '../../src/sim/creatures';
import { rulesFor } from '../../src/sim/modes';
import { type Input, TIERS } from '../../src/sim/snake';
import type { StageId } from '../../src/sim/stage';
import { stageFor } from '../../src/sim/stages';
import { UPGRADES } from '../../src/sim/upgrades';
import { STEP, World } from '../../src/sim/world';
import { Hud } from '../../src/ui/hud';
import { playCommonUnlock } from '../../src/ui/unlockSplash';
import { renderAudio } from './audio';
import { beatAt, FILM_BEATS, secondsAt } from './beats';
import { Overlay } from './overlay';
import { type Shot, SHOTS } from './shots';

const params = new URLSearchParams(location.search);
if (!import.meta.env.DEV || !params.has('director')) {
  document.body.textContent = 'The promo director only runs under `vite` dev, with ?director.';
  throw new Error('director: dev only');
}

export type Format = '9x16' | '16x9';
const FORMAT: Format = params.get('format') === '16x9' ? '16x9' : '9x16';
const FPS = Number(params.get('fps')) || 30;
/** Output pixels over CSS pixels: 432×768 CSS at 2.5 is 1080×1920, a phone-sized layout at full HD. */
const DPR = window.devicePixelRatio;

// ---------------------------------------------------------------- the game's renderer, wired as in main.ts

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = new Stage($<HTMLCanvasElement>('game'));
const gl = (stage as unknown as { renderer: THREE.WebGLRenderer }).renderer;
gl.setPixelRatio(DPR); // the game caps this at 2; the film wants every output pixel
gl.setSize(stage.width, stage.height, false);

/** A second renderer, transparent, for the "snake in front of the titles" pass. */
const fgCanvas = $<HTMLCanvasElement>('fg');
const fgGl = new THREE.WebGLRenderer({ canvas: fgCanvas, alpha: true, antialias: true, premultipliedAlpha: true });
fgGl.setPixelRatio(DPR);
fgGl.setSize(stage.width, stage.height, false);
fgGl.setClearColor(0x000000, 0);

/** Every sound the game asks for, with the virtual time it asked. Replayed by the audio pass. */
export interface SfxCall {
  t: number;
  name: string;
  args: unknown[];
}
const sfxLog: SfxCall[] = [];
/** Stands in for the game's Sfx: same method names, but it only writes down what was asked, and when. */
const sfxRecorder = new Proxy({} as Record<string, (...args: unknown[]) => void>, {
  get: (_, name: string) => (...args: unknown[]) => {
    if (mutedSfx.has(name)) return;
    const t = clockMs() / 1000;
    // Two of the same sound in the same instant (two wolves howling, two crumbs at once) is one sound.
    if (sfxLog.some((e) => e.name === name && t - e.t < 0.05)) return;
    sfxLog.push({ t, name, args });
  },
});
/** Sounds the current shot does not want (a busy mix is mud on a phone speaker). */
let mutedSfx = new Set<string>();

const weather = new Weather(stage, () => null); // thunder is scored by the shots, on the beat
stage.scene.add(weather.group);
const hud = Object.assign(new Hud(), {
  /** Take down the tier/magic banner now (a shot's own title is taking its place). */
  clearBanner: () => $('banner').classList.remove('show'),
});

let world: World;
let snakeViews: SnakeView[] = [];
let foodView: FoodView;
let animalView: AnimalView;
let predatorView: PredatorView;
let kidView: KidView;
let projectileView: ProjectileView;
let creatureView: CreatureView;
let hazardView: HazardView;
let cooperView = new CooperView('cooper');
const beeView = new BeeView();
let sparkles = new Sparkles();
let trailView = new TrailView();
let upgradeFx = new UpgradeFx();
stage.scene.add(cooperView.group, beeView.mesh, upgradeFx.group, sparkles.mesh, trailView.group);

/** A cut is a clean slate: no confetti, trail dust, fire or popups carried over from the last shot. */
function resetFx(): void {
  stage.scene.remove(sparkles.mesh, trailView.group, upgradeFx.group);
  disposeTree(sparkles.mesh);
  disposeTree(trailView.group);
  disposeTree(upgradeFx.group);
  sparkles = new Sparkles();
  trailView = new TrailView();
  upgradeFx = new UpgradeFx();
  stage.scene.add(sparkles.mesh, trailView.group, upgradeFx.group);
  const h = hud as unknown as { popups: { el: HTMLElement }[] };
  for (const p of h.popups) p.el.remove();
  h.popups.length = 0;
  $('banner').classList.remove('show');
}

const sceneryCache = new Map<StageId, School>();
let scenery: School | null = null;
function mountScenery(id: StageId): void {
  let next = sceneryCache.get(id);
  if (!next) {
    next = makeStageScene(id, stage.maxAnisotropy);
    if (id === 'common') hideGreeters(next.group);
    sceneryCache.set(id, next);
  }
  if (scenery === next) return;
  if (scenery) stage.scene.remove(scenery.group);
  scenery = next;
  stage.scene.add(scenery.group);
  stage.setAtmosphere(id);
}

/**
 * Miss Sami is a real member of staff: until she has said yes, she stays out of the film. Her figure
 * (and the mum she is chatting to) is the group standing at COMMON_GREETERS.
 */
function hideGreeters(root: THREE.Object3D): void {
  const { sami, mum } = COMMON_GREETERS;
  root.traverse((o) => {
    for (const p of [sami, mum]) if (Math.abs(o.position.x - p.x) < 0.01 && Math.abs(o.position.z - p.z) < 0.01) o.visible = false;
  });
}

/** Outfits by seat: the player's comes from the shot; rivals wear nothing extra, as in solo play. */
const outfit = { hat: 'no-hat', trail: 'no-trail' };

function mountSnakes(): void {
  for (const v of snakeViews) {
    stage.scene.remove(v.group);
    v.dispose();
  }
  snakeViews = world.snakes.map((s, id) => {
    const v = new SnakeView(s, id === world.me ? outfit.hat : 'no-hat');
    stage.scene.add(v.group);
    return v;
  });
}

function mountWorld(next: World): void {
  for (const old of [hazardView?.group, foodView?.group, animalView?.group, predatorView?.group, kidView?.group, projectileView?.group, creatureView?.group]) {
    if (!old) continue;
    stage.scene.remove(old);
    disposeTree(old);
  }
  world = next;
  hazardView = new HazardView(world.hazards);
  foodView = new FoodView(world.foods.length);
  animalView = new AnimalView(world.animals.length);
  predatorView = new PredatorView(world.predators.length);
  kidView = new KidView(world.kids.length);
  projectileView = new ProjectileView();
  creatureView = new CreatureView(world.creatures.length);
  stage.scene.add(hazardView.group, foodView.group, animalView.group, predatorView.group, kidView.group, projectileView.group, creatureView.group);
  mountScenery(world.stage.id);
  // The head teacher and the park keeper: real staff (Mr Cooper) stay out of the film, and the
  // keeper shares his build, so the warden figure is simply not drawn. His sim is parked far away.
  const persona = world.stage.cooper?.persona ?? 'cooper';
  if (cooperView.persona !== persona) {
    stage.scene.remove(cooperView.group);
    disposeTree(cooperView.group);
    cooperView = new CooperView(persona);
    stage.scene.add(cooperView.group);
  }
  cooperView.group.visible = false;
  hud.setStage(world.stage);
  mountSnakes();
}

// ---------------------------------------------------------------- events from the sim (as main.ts)

const CONFETTI = [0xffd84a, 0xff6b6b, 0x4dabf7, 0x8be36a, 0xffffff];
const DUST = [0x9a9da3, 0x7a7d83, 0xcfd2d6];
const FLAME = [0xff7b00, 0xffb703, 0xffe066, 0xff4d00];
const GOLD = [0xffd84a, 0xfff3b0, 0xffffff];
const EMBERS = [0xff7b00, 0xffb703, 0x6b6f76];
const KISSES = [0xf0486f, 0xff9fbf, 0xffffff];
const HALO = [0xffe066, 0xfff3b0, 0xffffff];
const PIXIE_FX = [0xc0ffe6, 0x8be3c8, 0xffffff];
const ICE = [0xa5d8ff, 0xe7f5ff, 0xffffff];
/** The game's fanfare per creature (main.ts MAGIC_LABEL). */
const MAGIC_LABEL: Record<string, [string, string]> = {
  stag: ['✨ Stag’s Blessing', 'Level up!'],
  unicorn: ['🦄 Rainbow Rush', '🌈 all gold'],
  owl: ['🦉 Owl Eyes', '🔮 lucky card'],
  frog: ['🐸 Royal Ribbit', 'danger, be gone!'],
  kitsune: ['🦊 Fox Trick', '👻 invisible'],
  pixie: ['🧚 Pixie Dust', '🧲 super magnet'],
  squirrel: ['🐿️ Acorn Hoard', '🌰 ➕'],
  wisp: ['🌟 Wisp Cache', '✨ treasure!'],
};

/** What the shot lets through: popups and banners can be switched off where the titles need the room. */
const allow = { popups: true, banners: true };

function handleEvents(): void {
  const sfx = sfxRecorder;
  for (const e of world.events) {
    const mine = 'who' in e && e.who === world.me;
    switch (e.type) {
      case 'eat':
        snakeViews[e.who].swallow();
        snakeViews[e.who].lick(e.x, e.z);
        if (e.golden) sparkles.burst(e.x, e.z, GOLD, 16, 1.2);
        if (!mine) break;
        if (allow.popups) hud.popup(`${e.golden ? '🌟 ' : e.toasted ? '🔥 ' : ''}+${e.points}`, e.x, e.z);
        if (e.golden) sfx.golden();
        else sfx.eat();
        break;
      case 'gulp':
        snakeViews[e.who].swallow();
        sparkles.burst(e.x, e.z, CONFETTI, 14);
        if (!mine) break;
        if (allow.popups) hud.popup(`GULP! +${e.points}`, e.x, e.z);
        sfx.gulp(e.kind);
        break;
      case 'boop':
        if (!mine) break;
        if (allow.popups) hud.popup('BOING!', e.x, e.z, 'fun');
        sfx.boing();
        sfx.voice(e.kind);
        break;
      case 'ouch':
        sparkles.burst(e.x, e.z, DUST, e.broke ? 22 : 10, e.broke ? 1.2 : 0.7);
        if (e.broke) sfx.crumble();
        if (!mine) break;
        if (allow.popups) hud.popup(e.lost > 0 ? 'OUCH!' : 'BONK!', e.x, e.z, 'bad');
        sfx.ouch();
        break;
      case 'pellet':
        snakeViews[e.who].swallow();
        if (!mine) break;
        if (allow.popups) hud.popup(`+${e.points}`, e.x, e.z);
        sfx.pellet();
        break;
      case 'tier':
        if (!mine) break;
        if (allow.banners) hud.announce(`${TIERS[e.tier].name}!`, `😋 ${world.stage.gulpHints[e.tier] ?? TIERS[e.tier].gulps}`);
        sparkles.burst(world.snake.x, world.snake.z, CONFETTI, 30, 1.4);
        sfx.tierUp();
        break;
      case 'bonk':
        sparkles.burst(e.x, e.z, CONFETTI, 36, 1.5);
        break;
      case 'respawn':
        sparkles.burst(e.x, e.z, CONFETTI, 12, 0.8);
        break;
      case 'breath':
        upgradeFx.breathe(world.snakes[e.who], e.range);
        sparkles.puff(e.x, e.z, e.heading, e.range, FLAME, 26);
        if (mine) sfx.whoosh();
        break;
      case 'sneeze':
        sparkles.burst(e.x, e.z, EMBERS, 14, 0.9);
        break;
      case 'lob':
        sparkles.burst(e.x, e.z, e.kind === 'kiss' ? KISSES : DUST, 5, 0.5);
        break;
      case 'pelt':
        sparkles.burst(e.x, e.z, DUST, 8, 0.6);
        if (e.who === world.me) {
          if (allow.popups) hud.popup(e.lost > 0 ? 'oops! a pebble' : 'missed!', e.x, e.z, 'bad');
          sfx.ouch();
        }
        break;
      case 'kiss':
        sparkles.burst(e.x, e.z, KISSES, 12, 0.9);
        if (e.who === world.me) {
          if (allow.popups) hud.popup('💕 +', e.x, e.z, 'fun');
          sfx.golden();
        }
        break;
      case 'howl':
        sparkles.burst(e.x, e.z, DUST, 8, 0.7);
        sfx.growl();
        break;
      case 'chomp':
        sparkles.burst(e.x, e.z, DUST, e.kind === 'bear' ? 22 : 14, e.kind === 'bear' ? 1.2 : 0.9);
        if (e.who === world.me) {
          if (allow.popups) hud.popup(e.kind === 'bear' ? '🐻 OUCH!' : '🐺 OUCH!', e.x, e.z, 'bad');
          sfx.ouch();
        }
        break;
      case 'magic': {
        const glow = CREATURES[e.kind].glow;
        sparkles.burst(e.x, e.z, [glow, 0xffffff, 0xffe066], 34, 1.7);
        if (e.who === world.me) {
          const [title, sub] = MAGIC_LABEL[e.kind];
          if (allow.banners) hud.announce(title, sub);
          sfx.golden();
          if (e.kind === 'stag') sfx.tierUp();
        }
        break;
      }
      // 'say' (Mr Cooper, the keeper, Miss Sami) is deliberately dropped: no staff lines in the film.
      default:
        break;
    }
  }
  world.events.length = 0;
}

// ---------------------------------------------------------------- the director's controls, for the shots

const tail = { x: 0, z: 0 };
const cam = {
  primed: false,
  focus: new THREE.Vector3(),
  pos: new THREE.Vector3(),
};

export interface ChaseOptions {
  /** Metres from focus to camera. */
  dist: number;
  /** Degrees above the ground the camera looks down from (the game's own is 58). */
  tilt: number;
  /** Degrees the camera swings round from the game's north-up view (+ = from the east). */
  yaw?: number;
  /** Metres the focus leads the head by, along its heading. */
  lead?: number;
  /** Shift the framing: metres the focus sits off the head, in screen right/up terms. */
  offX?: number;
  offZ?: number;
  /** Focus easing rate (1/s); Infinity locks on. */
  stiff?: number;
}

/** What a shot can reach: the world, the renderer's pieces, and a few staging helpers. */
export class Director {
  get world(): World {
    return world;
  }
  get snake() {
    return world.snake;
  }
  get sparkles(): Sparkles {
    return sparkles;
  }
  readonly stage = stage;
  readonly weather = weather;
  readonly hud = hud;
  readonly allow = allow;
  readonly format = FORMAT;
  /** The steering the player "holds" this tick. */
  input: Input = { x: 0, z: 0, active: false, dash: false };
  /** Trail emitted from the player's tail (the Tuck Shop trail being worn). */
  trail = 'no-trail';
  /** The beat the current shot starts on. */
  shotFrom = 0;

  /** Seconds into the current shot at which `beat` falls. */
  localOf(beat: number): number {
    return secondsAt(beat) - secondsAt(this.shotFrom);
  }

  /**
   * Lay the player's body along a smooth curve through `points` (tail first, head last), at `mass`.
   * The head ends on the last point, facing along the curve: a natural pose from the first frame.
   */
  lay(points: [number, number][], mass: number): void {
    const s = world.snake as unknown as { start: number; count: number; pushTrail(x: number, z: number): void };
    const snake = world.snake;
    snake.mass = mass;
    s.start = 0;
    s.count = 0;
    // Catmull-Rom through the control points, resampled at the sim's 0.1 m trail spacing.
    const P = [points[0], ...points, points[points.length - 1]];
    const dense: [number, number][] = [];
    for (let i = 1; i < P.length - 2; i++) {
      for (let k = 0; k < 40; k++) {
        const u = k / 40;
        const cr = (a: number, b: number, c: number, d: number) =>
          0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);
        dense.push([cr(P[i - 1][0], P[i][0], P[i + 1][0], P[i + 2][0]), cr(P[i - 1][1], P[i][1], P[i + 1][1], P[i + 2][1])]);
      }
    }
    dense.push(points[points.length - 1]);
    let [lx, lz] = dense[0];
    s.pushTrail(lx, lz);
    for (const [x, z] of dense) {
      let d = Math.hypot(x - lx, z - lz);
      while (d >= 0.1) {
        lx += ((x - lx) / d) * 0.1;
        lz += ((z - lz) / d) * 0.1;
        s.pushTrail(lx, lz);
        d = Math.hypot(x - lx, z - lz);
      }
    }
    const [hx, hz] = points[points.length - 1];
    const [px, pz] = dense[dense.length - 6];
    snake.x = hx;
    snake.z = hz;
    snake.heading = Math.atan2(hz - pz, hx - px);
    snake.sampleBody();
    snake.highestTier = snake.tier;
    snake.immune = 0;
    cam.primed = false;
  }

  /**
   * Keep `obj` exactly where the head will be at `beat` (plus `reach`), so the snake catches it on
   * the beat. Call every tick until then; returns false once the beat has passed.
   */
  bait(obj: { x: number; z: number }, beat: number, reach: number, t: number, side = 0): boolean {
    const due = this.localOf(beat);
    if (t > due) return false;
    const s = world.snake;
    const v = s.baseSpeed * s.speedFactor * (s.dashing ? 1.6 : 1);
    const ahead = v * (due - t) + reach * 0.92;
    obj.x = s.x + Math.cos(s.heading) * ahead - Math.sin(s.heading) * side;
    obj.z = s.z + Math.sin(s.heading) * ahead + Math.cos(s.heading) * side;
    return true;
  }

  /** Log a sound now (a designed hit placed by a shot, e.g. thunder on a downbeat). */
  sound(name: string, ...args: unknown[]): void {
    sfxLog.push({ t: clockMs() / 1000, name, args });
  }

  /** Log a sound at an exact beat (a designed hit, placed on the grid rather than on a frame). */
  soundAt(beat: number, name: string, ...args: unknown[]): void {
    sfxLog.push({ t: secondsAt(beat), name, args });
  }

  mute(names: string[]): void {
    mutedSfx = new Set(names);
  }

  /** Dress the player: a Tuck Shop skin, hat and trail. Rebuilds the snake views (as the game does). */
  dress(skin: string, hat = 'no-hat', trail = 'no-trail'): void {
    world.snake.look = skinLook(skin, 'You');
    outfit.hat = hat;
    this.trail = trail;
    mountSnakes();
  }

  /** Steer toward a point. */
  seek(x: number, z: number, dash = false): void {
    const dx = x - world.snake.x;
    const dz = z - world.snake.z;
    const d = Math.hypot(dx, dz) || 1;
    this.input = { x: dx / d, z: dz / d, active: true, dash };
  }

  /** Steer to hold a heading (radians). */
  steer(heading: number, dash = false): void {
    this.input = { x: Math.cos(heading), z: Math.sin(heading), active: true, dash };
  }

  /** Put the player somewhere, at a size, with its body laid straight out behind it. */
  place(x: number, z: number, heading: number, mass: number, trailMass = mass): void {
    const s = world.snake;
    s.mass = Math.max(mass, trailMass); // lay down enough body for the biggest it will get in the shot
    s.placeAt(x, z, heading);
    s.mass = mass;
    s.highestTier = s.tier; // no fanfare for the size it starts at
    s.immune = 0;
    cam.primed = false;
  }

  /** Clear the ground of rivals (they respawn far away, after the shot). */
  benchRivals(): void {
    for (const s of world.snakes) {
      if (s.id === world.me) continue;
      s.alive = false;
      s.respawnIn = 1e6;
    }
  }

  /** A follow camera like the game's, but with a director's choice of height, angle and swing. */
  chase(o: ChaseOptions, dt: number): void {
    const s = world.snake;
    const lead = o.lead ?? 1.5 + s.radius * 2;
    const yaw = ((o.yaw ?? 0) * Math.PI) / 180;
    // Screen-space offsets, turned into the camera's yaw.
    const ox = (o.offX ?? 0) * Math.cos(yaw) - (o.offZ ?? 0) * Math.sin(yaw);
    const oz = (o.offX ?? 0) * Math.sin(yaw) + (o.offZ ?? 0) * Math.cos(yaw);
    const wantX = s.x + Math.cos(s.heading) * lead + ox;
    const wantZ = s.z + Math.sin(s.heading) * lead - oz;
    if (!cam.primed || o.stiff === Infinity) {
      cam.focus.set(wantX, 0, wantZ);
      cam.primed = true;
    } else {
      const k = 1 - Math.exp(-dt * (o.stiff ?? 4));
      cam.focus.x += (wantX - cam.focus.x) * k;
      cam.focus.z += (wantZ - cam.focus.z) * k;
    }
    this.look(cam.focus.x, cam.focus.z, o.dist, o.tilt, o.yaw ?? 0);
  }

  /** Aim the camera at a ground point from `dist` metres away, `tilt` degrees up, swung `yaw` degrees. */
  look(fx: number, fz: number, dist: number, tilt: number, yaw = 0, fy = 0): void {
    const t = (tilt * Math.PI) / 180;
    const y = (yaw * Math.PI) / 180;
    const c = stage.camera;
    c.position.set(fx + Math.sin(y) * Math.cos(t) * dist, fy + Math.sin(t) * dist, fz + Math.cos(y) * Math.cos(t) * dist);
    c.lookAt(fx, fy, fz);
    cam.focus.set(fx, 0, fz);
  }

  /** Force the sky: `dim` 1 = full sun; rain/cloud 0..1; `flash` a lightning strike's brightness. */
  sky(dim: number, rain: number, cloud: number, flash = 0): void {
    const w = weather as unknown as Record<string, number | boolean>;
    w.dim = w.tDim = dim;
    w.rainAmt = w.tRain = rain;
    w.cloudAmt = w.tCloud = cloud;
    w.hold = 1e9; // never pick its own
    w.storm = false; // strikes are placed by hand, on the beat
    if (flash > 0) w.flash = flash;
  }

  /** The Common's golden-lock splash, as the game plays it on first unlocking. */
  unlockSplash(): void {
    playCommonUnlock();
  }

  /** Where a world point lands on screen, in CSS pixels. */
  project(x: number, y: number, z: number): { x: number; y: number; visible: boolean } {
    return stage.project(x, y, z, { x: 0, y: 0, visible: false });
  }

  /** The player's tail position right now. */
  tail(): { x: number; z: number } {
    world.snake.sampleAt(world.snake.length, tail);
    return tail;
  }

  /** Magic-buff shimmer and the trail, as main.ts draws them. */
  perks(dt: number): void {
    perkIn -= dt;
    if (perkIn <= 0) {
      perkIn = 0.12;
      for (const o of world.snakes) {
        if (!o.alive) continue;
        if (o.hasMagic('halo') && Math.random() < 0.5) sparkles.drift(o.x, o.z, HALO);
        if (o.hasMagic('hidden') && Math.random() < 0.4) sparkles.drift(o.x, o.z, ICE);
        if (o.hasMagic('magnet') && Math.random() < 0.3) sparkles.drift(o.x, o.z, PIXIE_FX);
      }
      for (const c of world.creatures) {
        if (c.respawnIn <= 0 && Math.random() < 0.35) sparkles.drift(c.x, c.z, [CREATURES[c.kind].glow, 0xffffff]);
      }
    }
    trailIn -= dt;
    if (trailIn <= 0) {
      trailIn = 0.07;
      for (const o of world.snakes) {
        const id = o.hasMagic('rainbow') ? 'rainbow-trail' : o.id === world.me ? this.trail : 'no-trail';
        if (id === 'no-trail' || !o.alive) continue;
        o.sampleAt(o.length, tail);
        trailView.add(tail.x, tail.z, id);
      }
    }
  }
}
let perkIn = 0;
let trailIn = 0;
const director = new Director();

// ---------------------------------------------------------------- running the film

const overlay = new Overlay($<HTMLCanvasElement>('behind'), $<HTMLCanvasElement>('front'), FORMAT);
const totalSeconds = secondsAt(FILM_BEATS);
const totalFrames = Math.round(totalSeconds * FPS);

let shot: Shot | null = null;
let shotStart = 0;
let ticks = 0;
let lastT = 0;
let time = 0;
let wasDashing = false;
let lastFrame = -2;

function shotAt(beat: number): Shot {
  for (const s of SHOTS) if (beat >= s.from && beat < s.to) return s;
  return SHOTS[SHOTS.length - 1];
}

function begin(next: Shot): void {
  shot = next;
  shotStart = secondsAt(next.from);
  ticks = 0;
  reseed(next.seed ?? 1234);
  resetFx();
  const w = new World(next.seed ?? 1234, skinLook(next.skin ?? 'telfer', 'You'), rulesFor('normal'), stageFor(next.stage));
  outfit.hat = next.hat ?? 'no-hat';
  director.trail = next.trail ?? 'no-trail';
  mountWorld(w);
  document.body.className = (next.hud ?? []).join(' ');
  allow.popups = next.popups ?? true;
  allow.banners = next.banners ?? true;
  mutedSfx = new Set(next.mute ?? []);
  director.input = { x: 0, z: 0, active: false, dash: false };
  director.shotFrom = next.from;
  cam.primed = false;
  wasDashing = false;
  // Let the world come to life (animals wander off their spawn points) before the camera rolls.
  for (let i = 0; i < Math.round((next.preroll ?? 2) / STEP); i++) {
    parkWarden();
    world.step({ x: 0, z: 0, active: false, dash: false });
    world.events.length = 0;
    world.snake.cards = null;
  }
  next.setup(director);
  fgCanvas.style.display = next.fg ? 'block' : 'none';
  $('game').style.filter = next.soften ?? '';
}

/** The warden (Mr Cooper at school, the keeper on the Common) is never in shot: keep him out of the way. */
function parkWarden(): void {
  const c = world.cooper;
  const b = world.stage.bounds;
  c.x = b.minX + 1;
  c.z = b.maxZ - 1;
}

/** Draw frame `i` of the film. `render` false runs the sim and the sounds only (for a quick audio pass). */
function frame(i: number, render = true): { shot: string; beat: number; head?: { x: number; y: number; visible: boolean }; snake: { x: number; z: number; mass: number } } | undefined {
  const t = i / FPS;
  const dt = i === lastFrame + 1 ? t - lastT : 1 / FPS;
  lastT = t;
  lastFrame = i;
  advanceTo(t * 1000);
  const beat = beatAt(t);
  const want = shotAt(beat);
  if (want !== shot) begin(want);
  const s = shot!;
  const local = t - shotStart;

  // The sim, in the game's fixed steps, with the shot at the wheel.
  const due = Math.floor(local / STEP + 1e-6);
  while (ticks < due) {
    const tl = ticks * STEP;
    s.tick?.(director, tl);
    parkWarden();
    world.step(director.input);
    ticks++;
    world.snake.cards = null; // a level-up would stop the world for the card screen: not in a film
    world.snake.pendingCards = 0;
    s.after?.(director, tl);
    if (world.snake.dashing && !wasDashing) sfxRecorder.zip(); // as main.ts: the dash's own whoosh
    wasDashing = world.snake.dashing;
  }
  time += dt;
  handleEvents();
  s.frame?.(director, local, dt);

  if (!render) return undefined;
  director.perks(dt);
  for (const v of snakeViews) v.update(dt, time);
  foodView.update(world, time);
  animalView.update(world, time);
  predatorView.update(world, dt);
  kidView.update(world, dt);
  projectileView.update(world, time);
  creatureView.update(world, time);
  hazardView.update(world, time);
  beeView.update(world, time);
  sparkles.update(dt);
  trailView.update(dt, time);
  upgradeFx.update(world, dt, time);
  scenery?.reveal(world.snake.x, world.snake.z, dt);
  s.camera(director, local, dt);
  weather.update(dt, cam.focus.x, cam.focus.z);
  s.sky?.(director, local);
  hud.update(world, stage, dt);
  stage.render();
  if (s.fg) renderForeground();
  const head = stage.project(world.snake.x, world.snake.radius, world.snake.z, { x: 0, y: 0, visible: false });
  overlay.draw(t, beat, { head, shot: s.name });
  syncAnimations();
  return { shot: s.name, beat, head, snake: { x: world.snake.x, z: world.snake.z, mass: world.snake.mass } };
}

/** The player's snake alone, on a clear canvas above the titles, so it can slither through them. */
function renderForeground(): void {
  const scene = stage.scene;
  const mine = snakeViews[world.me].group;
  const hidden: THREE.Object3D[] = [];
  for (const o of scene.children) {
    if (o === mine || o instanceof THREE.Light || !o.visible) continue;
    o.visible = false;
    hidden.push(o);
  }
  const bg = scene.background;
  scene.background = null;
  fgGl.render(scene, stage.camera);
  scene.background = bg;
  for (const o of hidden) o.visible = true;
}

/** A top-down plan of a stage, for planning shots. */
function overview(id: StageId, cx = 0, cz = 0, height = 120): void {
  mountWorld(new World(1, skinLook('telfer'), rulesFor('normal'), stageFor(id)));
  document.body.className = '';
  const c = stage.camera;
  c.position.set(cx, height, cz + 0.001);
  c.lookAt(cx, 0, cz);
  weather.update(0.016, cx, cz);
  director.sky(1, 0, 0);
  weather.update(0.016, cx, cz);
  for (const v of snakeViews) v.update(0.016, 0);
  const fog = stage.scene.fog as THREE.Fog;
  const far = fog.far;
  fog.far = 1e4;
  stage.render();
  fog.far = far;
}

async function ready(): Promise<{ fps: number; frames: number; seconds: number; format: Format }> {
  await document.fonts.ready;
  await overlay.load();
  return { fps: FPS, frames: totalFrames, seconds: totalSeconds, format: FORMAT };
}

Object.assign(window, {
  __director: {
    ready,
    frame,
    overview,
    /** The first frame of the shot that frame `f` falls in. */
    shotStartFrame: (f: number) => Math.ceil(secondsAt(shotAt(beatAt(f / FPS)).from) * FPS - 1e-6),
    sfxLog: () => sfxLog,
    renderAudio: (opts?: { from?: number; to?: number }) => renderAudio(sfxLog, totalSeconds, opts),
    director,
    UPGRADES,
  },
});
