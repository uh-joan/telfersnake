/**
 * The director's stage-hands. This module MUST be the director's first import: ES modules run in
 * import order, so it swaps the page's clocks and dice before any game module is evaluated.
 *
 * - Math.random is seeded, so every take of every shot is identical (sparkles, rain, splash bits).
 * - performance.now / Date.now, setTimeout / setInterval and requestAnimationFrame run on a virtual
 *   clock that only moves when the director says so. Capture can take as long as it likes per frame.
 * - CSS animations (the HUD banner, the unlock splash) are pinned to the same clock via the Web
 *   Animations API, so a DOM animation is frame-exact too.
 */

let seed = 0x7e1f5eed;
/** mulberry32, like the sim's own Rng. */
function seeded(): number {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
Math.random = seeded;

export function reseed(value: number): void {
  seed = value;
}

/** Real timers, kept for the director's own plumbing (waiting on fonts and the like). */
export const realSetTimeout = window.setTimeout.bind(window);

/** Virtual milliseconds since the top of the film. */
let now = 0;
const epoch = Date.UTC(2026, 8, 26, 10, 0, 0);

interface Timer {
  id: number;
  at: number;
  fn: () => void;
  every: number;
}
let nextId = 1;
const timers = new Map<number, Timer>();

performance.now = () => now;
Date.now = () => epoch + now;

const addTimer = (fn: TimerHandler, ms: number | undefined, every: boolean, args: unknown[]): number => {
  const id = nextId++;
  const delay = Math.max(0, ms ?? 0);
  const call = typeof fn === 'function' ? () => (fn as (...a: unknown[]) => void)(...args) : () => {};
  timers.set(id, { id, at: now + delay, fn: call, every: every ? Math.max(1, delay) : 0 });
  return id;
};
window.setTimeout = ((fn: TimerHandler, ms?: number, ...args: unknown[]) => addTimer(fn, ms, false, args)) as typeof window.setTimeout;
window.setInterval = ((fn: TimerHandler, ms?: number, ...args: unknown[]) => addTimer(fn, ms, true, args)) as typeof window.setInterval;
window.clearTimeout = ((id?: number) => void timers.delete(id ?? -1)) as typeof window.clearTimeout;
window.clearInterval = window.clearTimeout as typeof window.clearInterval;
// Nothing in the director asks for frames: it draws them itself, on command.
window.requestAnimationFrame = (() => 0) as typeof window.requestAnimationFrame;

/** CSS animations seen so far, and the virtual time each one began. */
const born = new WeakMap<Animation, number>();

/** Move the clock to `ms`, firing any timers that fall due on the way, in order. */
export function advanceTo(ms: number): void {
  for (;;) {
    let due: Timer | null = null;
    for (const t of timers.values()) if (t.at <= ms && (!due || t.at < due.at)) due = t;
    if (!due) break;
    now = due.at;
    if (due.every) due.at += due.every;
    else timers.delete(due.id);
    due.fn();
  }
  now = ms;
}

/**
 * Pin every running CSS animation to the virtual clock. An animation is "born" the first time it is
 * seen, which is the frame its element appeared: the director calls this once per frame.
 */
export function syncAnimations(): void {
  for (const a of document.getAnimations()) {
    if (!born.has(a)) {
      born.set(a, now);
      a.pause();
    }
    a.currentTime = now - (born.get(a) ?? now);
  }
}

export const clockMs = (): number => now;
