/**
 * Classic ⇄ HD: the switch on the home screen. The HD remaster (Unity, at /hd/) shares this game's
 * save, so switching is just a different window onto the same snake: the choice is remembered and
 * the next visit opens that version straight away (public/version.js).
 *
 * The switch slides, then the next version's sky grows out of the finger and fills the screen,
 * dressed exactly like the HD loading screen's first frame, so the page change is invisible.
 */

/** Shared with public/version.js and the HD page's TemplateData/boot.js. */
const KEY = 'telfersnake.version';
const HD_URL = '/hd/';
const SLIDE_MS = 220;
/** Taps sooner than this after the page opens are ignored: a finger still down from the page change is not a choice. */
const SETTLE_MS = 800;
const WARP_MS = 520;

export function hdSupported(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

function remember(version: 'classic' | 'hd'): void {
  try {
    localStorage.setItem(KEY, version);
  } catch {
    // Storage blocked: the switch still works, it just isn't remembered.
  }
}

/** Wire the switch in #version; `onTap` plays the click, `beforeLeave` saves (so HD opens on the same snake). */
export function mountVersionSwitch(onTap: () => void, beforeLeave: () => void): void {
  const box = document.getElementById('version');
  const hd = box?.querySelector<HTMLButtonElement>('[data-version="hd"]');
  if (!box || !hd) return;
  // Opening Classic on purpose is a choice too: this is the version to come back to.
  remember('classic');

  if (!hdSupported()) {
    hd.classList.add('nope');
    hd.setAttribute('aria-disabled', 'true');
  }

  // The HD logo's font, ready before the sky needs it (it is small, and only fetched once).
  const font = () => void document.fonts?.load('700 40px Fredoka').catch(() => {});
  hd.addEventListener('pointerenter', font, { once: true });
  hd.addEventListener('pointerdown', font, { once: true });
  setTimeout(font, 4000);

  let going = false;
  hd.addEventListener('click', (e) => {
    if (performance.now() < SETTLE_MS) return;
    onTap();
    if (hd.classList.contains('nope')) {
      // A wobble and a short note, then back to normal: nothing to break.
      box.classList.remove('nah');
      void box.offsetWidth;
      box.classList.add('nah');
      return;
    }
    if (going) return;
    going = true;
    beforeLeave();
    remember('hd');
    box.classList.add('to-hd');
    hd.setAttribute('aria-checked', 'true');
    box.querySelector('[data-version="classic"]')?.setAttribute('aria-checked', 'false');
    // Warm the HD page while the switch slides and the sky grows.
    const hint = document.createElement('link');
    hint.rel = 'prefetch';
    hint.href = HD_URL;
    document.head.appendChild(hint);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => warp(e.clientX, e.clientY, reduced), reduced ? 0 : SLIDE_MS);
  });

  // Back from /hd/ through the browser's page cache: undo the slide and the sky.
  addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    going = false;
    box.classList.remove('to-hd');
    hd.setAttribute('aria-checked', 'false');
    box.querySelector('[data-version="classic"]')?.setAttribute('aria-checked', 'true');
    document.getElementById('warp')?.remove();
    remember('classic');
  });
}

/** The HD loading screen's opening frame, grown from the tap; then the page change, unseen. */
function warp(x: number, y: number, reduced: boolean): void {
  const sky = document.createElement('div');
  sky.id = 'warp';
  sky.innerHTML = '<div class="warp-middle"><div class="warp-logo">Telfer<b>snake</b><sup>HD</sup></div><div class="warp-bar"></div></div>';
  // Tapped by keyboard (no pointer position): grow from the middle.
  const fromX = x || innerWidth / 2;
  const fromY = y || innerHeight / 2;
  sky.style.setProperty('--x', `${fromX}px`);
  sky.style.setProperty('--y', `${fromY}px`);
  document.body.appendChild(sky);
  requestAnimationFrame(() => requestAnimationFrame(() => sky.classList.add('open')));
  setTimeout(() => location.replace(HD_URL + location.search), reduced ? 120 : WARP_MS);
}
