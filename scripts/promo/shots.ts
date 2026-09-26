/**
 * The shot list. Each shot is a real game world (the school or the Common), staged: the player's
 * snake laid out and steered, the odd animal, creature or child nudged onto its mark so the gulp,
 * boing or kiss lands on the beat, the sky forced, and a camera move. Nothing here draws anything
 * the game does not: every frame is the game's own renderer running the game's own sim.
 *
 * Times: `from`/`to` and every cue are in beats of the theme (142 BPM, see beats.ts). Inside a shot,
 * `t` is seconds since the shot began; `d.localOf(beat)` converts.
 *
 * Kept out of every frame (guardrails): Mr Cooper and Miss Sami (real staff, not yet asked) and the
 * TELFERSCOT crest painted on the school tarmac (the real school's name). School shots look south,
 * away from the crest at (0, −4); the director hides both staff figures and drops their lines.
 */
import type { Food } from '../../src/sim/food';
import type { StageId } from '../../src/sim/stage';
import { secondsAt } from './beats';
import type { Director } from './director';

export interface Shot {
  name: string;
  from: number;
  to: number;
  stage: StageId;
  seed?: number;
  preroll?: number;
  skin?: string;
  hat?: string;
  trail?: string;
  /** Body classes that switch on bits of the game's HUD (see director.html). */
  hud?: string[];
  /** Draw the player's snake over the "behind" titles. */
  fg?: boolean;
  popups?: boolean;
  banners?: boolean;
  /** Game sounds this shot leaves out. */
  mute?: string[];
  /** Soften the footage behind an end card (CSS filter on the game canvas). */
  soften?: string;
  setup(d: Director): void;
  /** Before each sim tick (t = seconds into the shot). */
  tick?(d: Director, t: number): void;
  after?(d: Director, t: number): void;
  frame?(d: Director, t: number, dt: number): void;
  camera(d: Director, t: number, dt: number): void;
  sky?(d: Director, t: number): void;
}

const ramp = (t: number, t0: number, t1: number, a: number, b: number, ease = (u: number) => u): number =>
  a + (b - a) * ease(Math.max(0, Math.min(1, (t - t0) / (t1 - t0))));
const smooth = (u: number): number => u * u * (3 - 2 * u);
/** True on the one frame whose span (t − dt, t] contains `at`. */
const crossed = (t: number, dt: number, at: number): boolean => t >= at && t - dt < at;
const SUNNY = (d: Director) => d.sky(1, 0, 0.12);

/** A food item to use as bait, turned into something that reads well on camera. */
function snack(d: Director, i: number, kind: Food['kind'] = 'cookie'): Food {
  const f = d.world.foods[d.world.foods.length - 1 - i];
  f.kind = kind;
  f.golden = false;
  f.born = -999;
  return f;
}

/** The first animal of a kind. */
const animal = (d: Director, kind: string, n = 0) => d.world.animals.filter((a) => a.kind === kind)[n];

// Heading helpers: +x east, +z south.
const EAST = 0;
const SOUTH = Math.PI / 2;
/** South-east: with the camera looking south, that is up and to the left on screen. */
const HOOK_HEADING = Math.PI / 4;

/** Where the six children run, relative to the snake (metres east, south). */
const KID_SPOTS: [number, number][] = [[4, -1.6], [6, 2.6], [2, 3.6], [9, -0.4], [7.5, 5.2], [11, 2]];

/** Send the Common's bear, wolves, children and creatures off stage, out of the way of a shot. */
function clearActors(d: Director): void {
  for (const p of d.world.predators) {
    p.x = 50;
    p.z = 45;
  }
  for (const k of d.world.kids) {
    k.x = k.tx = -50;
    k.z = k.tz = 45;
  }
  for (const c of d.world.creatures) {
    c.x = c.wx = 0;
    c.z = c.wz = 55;
  }
}

export const SHOTS: Shot[] = [
  // ------------------------------------------------------------------ 0–4 · HOOK
  // The Dragon tears across the Common, up through the title, breathing fire on beat 2.
  // It enters lower right on frame 0 (the strongest image first) and heads up-screen to the left.
  {
    name: 'hook',
    mute: ['eat', 'golden', 'gulp', 'pellet'],
    from: 0,
    to: 4,
    stage: 'common',
    seed: 7,
    fg: true,
    popups: false,
    banners: false,
    skin: 'telfer',
    setup(d) {
      d.benchRivals();
      clearActors(d);
      d.lay([[-46, -24], [-34, -20], [-22, -14], [-13, -7], [-6, 0]], 760);
      d.snake.setUpgrades({ dragon: 3 });
      d.snake.breathIn = 99;
    },
    tick(d, t) {
      d.steer(HOOK_HEADING);
      d.bait(snack(d, 0, 'sausage'), 2.3, 5.5, t);
      if (crossed(t, 1 / 60, d.localOf(2) - 0.017)) d.snake.breathIn = 0;
      else if (t < d.localOf(2)) d.snake.breathIn = 99;
    },
    camera(d, t) {
      const k = 0.42 * 9.3 * t; // the camera drifts after the Dragon at a bit under half its speed
      d.look(-3.6 + Math.cos(HOOK_HEADING) * k, 3.5 + Math.sin(HOOK_HEADING) * k, ramp(t, 0, 1.69, 21, 18.5, smooth), 44, 180);
    },
    sky: SUNNY,
  },

  // ------------------------------------------------------------------ 4–12 · SCHOOL YARD
  // Small again: a Wiggly Worm on the green. Munch on the beat, boing off a sheep, grow, gulp a chicken.
  {
    name: 'yard',
    from: 4,
    to: 12,
    stage: 'school',
    seed: 11,
    popups: false,
    banners: true,
    skin: 'telfer',
    setup(d) {
      d.benchRivals();
      d.lay([[-26, 27], [-21, 27], [-17, 27]], 12);
      // A clear run: only the planned snacks, the sheep and the hen are anywhere near the path.
      const baits = new Set([snack(d, 0), snack(d, 1), snack(d, 2), snack(d, 3)]);
      for (const f of d.world.foods) if (!baits.has(f) && Math.abs(f.z - 27) < 9) f.z += f.z < 27 ? -12 : 14;
      const keep = new Set([animal(d, 'sheep'), animal(d, 'chicken')]);
      for (const a of d.world.animals) if (!keep.has(a)) a.z = -30;
    },
    tick(d, t) {
      d.steer(EAST);
      d.bait(snack(d, 0), 5, d.snake.biteReach, t);
      const sheep = animal(d, 'sheep');
      if (sheep) d.bait(sheep, 6, d.snake.radius + 0.6, t, 0.25);
      d.bait(snack(d, 1, 'apple'), 7, d.snake.biteReach, t);
      if (t < d.localOf(7.5)) d.snake.mass = Math.min(d.snake.mass, 17); // grow on beat 8, not before
      else if (t < d.localOf(8) - 0.04) d.snake.mass = Math.max(d.snake.mass, 19.6);
      d.bait(snack(d, 2), 8, d.snake.biteReach, t);
      const hen = animal(d, 'chicken');
      if (hen) d.bait(hen, 10, d.snake.biteReach * 0.75 + 0.35, t);
      d.bait(snack(d, 3, 'burger'), 11, d.snake.biteReach, t);
    },
    camera(d, _t, dt) {
      d.chase({ dist: 12, tilt: 55, yaw: 0, lead: 1.2, offZ: 2.2, stiff: 5 }, dt);
    },
    sky: SUNNY,
  },

  // ------------------------------------------------------------------ 12–20 · UP TELFERSCOT ROAD
  // Out of the school gate and down the road between the terraces, towards the Common. The golden
  // lock splash (the game's unlock) shatters on beat 18 and the park blooms open behind it.
  {
    name: 'road',
    mute: ['eat', 'golden', 'gulp', 'pellet'],
    from: 12,
    to: 20,
    stage: 'common',
    seed: 5,
    popups: false,
    skin: 'telfer',
    setup(d) {
      d.benchRivals();
      clearActors(d);
      for (const a of d.world.animals) if (a.z < -30) a.z += 60; // the road itself is kept clear
      d.lay([[0, -112], [0, -104], [0.5, -97], [-0.5, -93]], 60);
    },
    tick(d, t) {
      d.seek(0, -40, t > d.localOf(16.5));
      d.snake.mass = Math.max(d.snake.mass, 58); // the dash costs mass; not in a film
    },
    frame(d, t, dt) {
      // Start the splash so its lock shatters exactly on beat 18.
      if (crossed(t, dt, d.localOf(18) - 0.7)) d.unlockSplash();
    },
    camera(d, _t, dt) {
      d.chase({ dist: 15, tilt: 24, yaw: 180, lead: 7, offZ: 0, stiff: 3 }, dt);
    },
    sky: SUNNY,
  },

  // ------------------------------------------------------------------ 20–28 · THE COMMON · WEATHER
  // The meadow opens out. Sun, then the rain rolls in, then lightning on the beat.
  {
    name: 'common',
    mute: ['eat', 'golden', 'gulp', 'pellet'],
    from: 20,
    to: 28,
    stage: 'common',
    seed: 21,
    popups: false,
    skin: 'telfer',
    setup(d) {
      d.benchRivals();
      clearActors(d);
      d.lay([[-44, -14], [-36, -14], [-28, -12], [-20, -9]], 70);
    },
    tick(d) {
      d.steer(0.28);
    },
    camera(d, t, dt) {
      d.chase({ dist: ramp(t, 0, 3.4, 19, 16, smooth), tilt: ramp(t, 0, 3.4, 30, 26, smooth), yaw: 186, lead: 3, offX: 1, offZ: 4.5, stiff: 3 }, dt);
    },
    sky(d, t) {
      const rain = ramp(t, d.localOf(23.5), d.localOf(24.3), 0, 1, smooth);
      const storm = ramp(t, d.localOf(25.3), d.localOf(26), 0, 1, smooth);
      const dim = 1 - rain * 0.42 - storm * 0.12;
      let flash = 0;
      for (const [b, f] of [[26, 2.8], [27, 1.8]] as const) {
        const u = t - d.localOf(b);
        if (u >= 0 && u < 0.4) flash = Math.max(flash, f * Math.exp(-u * 9));
      }
      d.sky(dim, rain * 1.6, 0.12 + rain * 0.8 + storm * 0.08, 0);
      (d.weather as unknown as { flash: number }).flash = flash;
    },
    frame(d, t, dt) {
      if (crossed(t, dt, d.localOf(26))) d.soundAt(26, 'thunder');
    },
  },

  // ------------------------------------------------------------------ 28–32 · FRIENDS
  // Children out on the Common run along with the snake; two of them blow it a kiss (hearts).
  {
    name: 'kids',
    mute: ['eat', 'gulp', 'pellet'],
    from: 28,
    to: 32,
    stage: 'common',
    seed: 31,
    popups: false,
    skin: 'telfer',
    setup(d) {
      d.benchRivals();
      clearActors(d);
      d.lay([[-40, 12], [-32, 10], [-24, 9], [-16, 8.5]], 70);
      const s = d.snake;
      d.world.kids.slice(0, 6).forEach((k, i) => {
        const [ox, oz] = KID_SPOTS[i];
        k.x = k.tx = s.x + ox;
        k.z = k.tz = s.z + oz;
        k.pauseFor = 0;
        k.throwIn = 99;
      });
    },
    tick(d, t) {
      d.steer(EAST);
      const s = d.snake;
      const v = s.baseSpeed;
      d.world.kids.forEach((k, i) => {
        if (i >= 6) {
          k.x = k.tx = -50; // only the six in shot
          k.z = k.tz = 45;
          return;
        }
        // Run along with the snake, a little ahead of where they stand.
        const [ox, oz] = KID_SPOTS[i];
        k.tx = s.x + ox + v * 0.6;
        k.tz = s.z + oz;
        k.wanderIn = 9;
        k.pauseFor = 0;
        if (k.kind === 'naughty') k.throwIn = 99; // no pebbles in the promo
      });
      // The nice ones blow their kisses a beat or so apart.
      const nice = d.world.kids.slice(0, 6).filter((k) => k.kind === 'nice');
      nice.forEach((k, i) => {
        if (crossed(t, 1 / 60, d.localOf(28.4 + i * 1.3))) k.throwIn = 0;
        else if (k.throwIn > 0.02) k.throwIn = 99;
      });
    },
    camera(d, _t, dt) {
      d.chase({ dist: 12, tilt: 40, yaw: 180, lead: 2.5, offZ: 2.2, stiff: 3 }, dt);
    },
    sky: SUNNY,
  },

  // ------------------------------------------------------------------ 32–36 · BEAR AND WOLVES
  // A bear lumbers into the snake's way; on beat 34 two wolves spot it, howl and give chase; it dashes.
  {
    name: 'wild',
    mute: ['eat', 'golden', 'gulp', 'pellet'],
    from: 32,
    to: 36,
    stage: 'common',
    seed: 41,
    popups: false,
    skin: 'telfer',
    setup(d) {
      d.benchRivals();
      clearActors(d);
      d.lay([[-44, 22], [-36, 20], [-28, 18.5], [-20, 18]], 90);
      const s = d.snake;
      const bear = d.world.predators.find((p) => p.kind === 'bear')!;
      bear.x = s.x + 9;
      bear.z = s.z + 3.2;
      bear.heading = Math.PI;
      for (const w of d.world.predators.filter((p) => p.kind === 'wolf')) w.restFor = 99;
    },
    tick(d, t) {
      d.steer(EAST - 0.15, t > d.localOf(34.5));
      const s = d.snake;
      s.mass = Math.max(s.mass, 88); // the dash costs mass; not in a film
      const wolves = d.world.predators.filter((p) => p.kind === 'wolf');
      if (crossed(t, 1 / 60, d.localOf(33.9))) {
        // Two wolves at the edge of sight, behind the snake: they see it, howl, and sprint.
        wolves.forEach((w, i) => {
          w.x = s.x - 6.5;
          w.z = s.z + (i ? 2.6 : -1.2);
          w.heading = 0;
          w.restFor = 0;
          w.chargeFor = 0;
        });
      } else if (t < d.localOf(33.9)) {
        for (const w of wolves) {
          w.x = -50;
          w.z = 45;
          w.restFor = 99;
        }
      }
      // No bites in the promo: they stay a whisker out of reach.
      for (const p of d.world.predators) p.biteIn = Math.max(p.biteIn, 0.5);
    },
    camera(d, t, dt) {
      d.chase({ dist: ramp(t, d.localOf(33.5), d.localOf(34.5), 15, 19, smooth), tilt: 42, yaw: 180, lead: 2, offX: ramp(t, d.localOf(33.5), d.localOf(34.5), 1, 3.8, smooth), offZ: 2.5, stiff: 3 }, dt);
    },
    sky: SUNNY,
  },

  // ------------------------------------------------------------------ 36–40 · MAGIC
  // A unicorn in the long grass; the snake catches it on beat 38: Rainbow Rush.
  {
    name: 'magic',
    mute: ['eat', 'gulp', 'pellet'],
    from: 36,
    to: 40,
    stage: 'common',
    seed: 51,
    popups: false,
    skin: 'telfer',
    setup(d) {
      d.benchRivals();
      clearActors(d);
      d.lay([[-26, 36], [-20, 32], [-14, 31], [-8, 30.5]], 90);
      const u = d.world.creatures[0];
      u.kind = 'unicorn';
      u.respawnIn = 0;
      for (const c of d.world.creatures.slice(1)) {
        c.x = 40;
        c.z = -20;
      }
    },
    tick(d, t) {
      d.steer(EAST - 0.1);
      const u = d.world.creatures[0];
      if (u.kind === 'unicorn' && u.respawnIn <= 0) {
        if (!d.bait(u, 38, d.snake.biteReach * 0.75 + 0.55, t, 0.4)) {
          /* caught */
        }
        u.heading = 0; // prancing away, the way the snake is heading
      }
    },
    camera(d, t, dt) {
      d.chase({ dist: ramp(t, 0, 1.7, 11, 13, smooth), tilt: 38, yaw: 176, lead: 3.5, offZ: 1.2, stiff: 3.5 }, dt);
    },
    sky: SUNNY,
  },

  // ------------------------------------------------------------------ 40–52 · RACE TO THE DRAGON
  // Size after size on every other beat, exactly as the game calls them, until The Dragon breathes fire.
  {
    name: 'grow',
    mute: ['eat', 'golden', 'gulp', 'pellet'],
    from: 40,
    to: 52,
    stage: 'common',
    seed: 61,
    hud: ['hud-tier'],
    popups: false,
    skin: 'telfer',
    setup(d) {
      d.benchRivals();
      clearActors(d);
      // Lay down the Dragon's worth of body first, so growing just unrolls it along the path.
      d.lay([[-44, 36], [-40, 22], [-36, 10], [-30, 2], [-22, 0], [-14, 2]], 760);
      d.snake.mass = 19.2;
      d.snake.highestTier = 0;
      d.snake.setUpgrades({ dragon: 3 });
      d.snake.breathIn = 99;
    },
    tick(d, t) {
      d.steer(EAST + 0.12);
      const s = d.snake;
      // Mass eases up to each threshold and crosses it on the beat: 20, 70, 170, 350, 700.
      const steps: [number, number][] = [[40, 20.2], [42, 70.5], [44, 171], [46, 352], [48, 705]];
      let m = 19.2;
      for (let i = 0; i < steps.length; i++) {
        const [b, mass] = steps[i];
        const prev = i === 0 ? 19.2 : steps[i - 1][1];
        const t0 = d.localOf(b - (i === 0 ? 0.02 : 1.2));
        const t1 = d.localOf(b) - 0.03; // the sim notices on the next tick: land the fanfare on the beat
        if (t >= t1) m = mass;
        else if (t > t0) m = prev + (mass - prev) * ((t - t0) / (t1 - t0)) ** 3;
      }
      if (t > d.localOf(48)) m = 705 + (t - d.localOf(48)) * 12;
      s.mass = m;
      // Fire on the Dragon's beats.
      for (const b of [49, 51]) {
        d.bait(snack(d, b === 49 ? 0 : 1, 'sausage'), b + 0.2, 6, t);
        if (crossed(t, 1 / 60, d.localOf(b) - 0.017)) s.breathIn = 0;
      }
      if (t < d.localOf(49) - 0.02 || (t > d.localOf(49.5) && t < d.localOf(51) - 0.02)) s.breathIn = 99;
      d.allow.banners = t < d.localOf(47.5); // the Dragon gets the big title instead
      if (t > d.localOf(47.9)) d.hud.clearBanner();
    },
    camera(d, t, dt) {
      // The game pulls back in step with girth, which would hide the growth; the film pulls back
      // less, so the body visibly fattens and lengthens.
      const r = d.snake.radius;
      const dragon = ramp(t, d.localOf(47.8), d.localOf(49), 0, 1, smooth);
      d.chase({ dist: 11 + dragon * 9 + (r - 0.3) * 2, tilt: 50, yaw: 186, lead: 1.5 + r * 2, offX: -0.5 - dragon * 3, offZ: 1.2 + r * 1.5, stiff: 2.5 }, dt);
    },
    sky: SUNNY,
  },

  // ------------------------------------------------------------------ 52–64 · TUCK SHOP
  // Dress-up on the beat: skins, then hats, then trails, then the lot.
  {
    name: 'shop',
    from: 52,
    to: 64,
    stage: 'school',
    seed: 71,
    popups: false,
    banners: false,
    skin: 'rainbow',
    hat: 'crown',
    trail: 'stardust',
    mute: ['eat', 'pellet', 'golden'],
    setup(d) {
      d.benchRivals();
      d.lay([[-22, 30], [-20, 24], [-15, 20.5], [-10, 18.2], [-5, 18]], 95);
      for (const a of d.world.animals) {
        a.x = 30;
        a.z = -30;
      }
    },
    tick(d, t) {
      // A lazy circle round the green, so the camera sees every side of the outfit.
      const a = t * 0.5 - 0.4;
      d.seek(-6 + Math.cos(a) * 4.5, 21 + Math.sin(a) * 3);
      d.snake.mass = 95;
      for (const f of d.world.foods) {
        if (Math.hypot(f.x - d.snake.x, f.z - d.snake.z) < 8) f.x += 60; // a clean floor for the fashion show
      }
    },
    frame(d, t) {
      const beat = 52 + (t / secondsAt(1));
      const i = Math.floor(beat + 1e-6) - 52;
      if (i !== outfitShown && i >= 0 && i < OUTFITS.length) {
        outfitShown = i;
        const [skin, hat, trail] = OUTFITS[i];
        d.dress(skin, hat, trail);
        d.sparkles.burst(d.snake.x, d.snake.z, [0xffd84a, 0xff6b6b, 0x4dabf7, 0x8be36a, 0xffffff], 18, 1);
        d.soundAt(52 + i, i % 4 === 0 ? 'chaChing' : 'pick');
      }
    },
    camera(d, t, dt) {
      // Close on the head (that is where the hats are), swinging slowly round it. Always looking
      // south-ish, away from the crest.
      d.chase({ dist: ramp(t, 0, 3.4, 10, 8.5, smooth) + ramp(t, d.localOf(59.5), d.localOf(60.5), 0, 5, smooth), tilt: 36 + ramp(t, d.localOf(59.5), d.localOf(60.5), 0, 12, smooth), yaw: ramp(t, 0, 5.07, 160, 185), lead: 0.6, offZ: 1.6, stiff: 4 }, dt);
    },
    sky: SUNNY,
  },

  // ------------------------------------------------------------------ 64–72 · END CARD
  {
    name: 'end',
    mute: ['eat', 'golden', 'gulp', 'pellet'],
    from: 64,
    to: 72,
    stage: 'common',
    seed: 81,
    popups: false,
    banners: false,
    skin: 'rainbow',
    hat: 'crown',
    trail: 'stardust',
    soften: 'blur(5px) saturate(1.1) brightness(0.92)',
    setup(d) {
      d.benchRivals();
      d.lay([[-40, 30], [-36, 16], [-26, 8], [-14, 10], [-6, 18], [-2, 26]], 760);
    },
    tick(d) {
      d.steer(SOUTH + 0.35);
      d.snake.mass = 760;
    },
    camera(d, t) {
      d.look(ramp(t, 0, 3.4, -8, -4), ramp(t, 0, 3.4, 16, 20), 34, 40, ramp(t, 0, 3.4, 190, 170));
    },
    sky: SUNNY,
  },
];

/** The Tuck Shop montage, one per beat from 52: skins (52–55), hats (56–59), trails (60–63). */
export const OUTFITS: [string, string, string][] = [
  ['rainbow', 'no-hat', 'no-trail'],
  ['tiger', 'no-hat', 'no-trail'],
  ['candy', 'no-hat', 'no-trail'],
  ['galaxy', 'no-hat', 'no-trail'],
  ['bumble', 'crown', 'no-trail'],
  ['bumble', 'wizard', 'no-trail'],
  ['bumble', 'cowboy', 'no-trail'],
  ['bumble', 'propeller', 'no-trail'],
  ['dino', 'party', 'confetti'],
  ['dino', 'party', 'hearts'],
  ['dino', 'party', 'bubbles'],
  ['dino', 'party', 'rainbow-trail'],
];
let outfitShown = -1;
