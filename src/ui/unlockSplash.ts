/**
 * The one-off unlock splashes, wordless and purely decorative. The Common's: a golden padlock
 * rattles and shatters into shards and sparks, then leaves, petals and butterflies bloom outward on
 * a burst of sunbeams before it all clears to reveal the park. London's is the Golden Ticket (below).
 * Each fires once, when its place is first unlocked. Built and torn down on the spot; never touches the sim.
 */

const LOCK_SVG = `
<svg class="us-lock" viewBox="0 0 100 120" aria-hidden="true">
  <defs>
    <linearGradient id="usGold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffe98a"/>
      <stop offset="0.5" stop-color="#ffcf3e"/>
      <stop offset="1" stop-color="#e0a613"/>
    </linearGradient>
  </defs>
  <path d="M30 52 V40 a20 20 0 0 1 40 0 V52" fill="none" stroke="#f0d78a" stroke-width="10" stroke-linecap="round"/>
  <rect x="18" y="50" width="64" height="56" rx="13" fill="url(#usGold)" stroke="#b9860c" stroke-width="2"/>
  <circle cx="50" cy="74" r="7.5" fill="#7a5a08"/>
  <rect x="46" y="78" width="8" height="17" rx="3.5" fill="#7a5a08"/>
</svg>`;

const BITS = ['🍃', '🌿', '🌸', '🌼', '🍁', '🍂', '🌷'];
const rnd = (a: number, b: number): number => a + Math.random() * (b - a);

/** The splash's stage: a full-screen host, and a burst point that particles fly out from. */
function makeSplash(inner: string): { host: HTMLElement; fly: (el: HTMLElement, minR: number, maxR: number) => void; make: (cls: string, text?: string) => HTMLElement; spread: number } {
  const host = document.createElement('div');
  host.id = 'unlock-splash';
  host.innerHTML = `${inner}<div class="us-burst"></div>`;
  const burst = host.querySelector('.us-burst') as HTMLElement;
  const spread = Math.min(window.innerWidth, window.innerHeight);
  const fly = (el: HTMLElement, minR: number, maxR: number): void => {
    const a = rnd(0, Math.PI * 2);
    const r = rnd(minR, maxR);
    el.style.setProperty('--tx', `${Math.cos(a) * r}px`);
    el.style.setProperty('--ty', `${Math.sin(a) * r}px`);
    el.style.setProperty('--rot', `${rnd(-540, 540)}deg`);
  };
  const make = (cls: string, text = ''): HTMLElement => {
    const el = document.createElement('div');
    el.className = cls;
    if (text) el.textContent = text;
    burst.appendChild(el);
    return el;
  };
  return { host, fly, make, spread };
}

/** Show `host` for `ms`, then tidy it away. */
function run(host: HTMLElement, ms: number, onDone?: () => void): void {
  document.body.appendChild(host);
  window.setTimeout(() => {
    host.remove();
    onDone?.();
  }, ms);
}

/** Play the splash over the current screen; `onDone` fires once it has cleaned itself up. */
export function playCommonUnlock(onDone?: () => void): void {
  const { host, fly, make, spread } = makeSplash(`<div class="us-veil"></div><div class="us-rays"></div><div class="us-flash"></div>${LOCK_SVG}`);

  for (let i = 0; i < 16; i++) fly(make('us-shard'), 0.28 * spread, 0.62 * spread);
  for (let i = 0; i < 26; i++) {
    const s = make('us-spark');
    fly(s, 0.18 * spread, 0.7 * spread);
    s.style.animationDelay = `${0.7 + rnd(0, 0.14)}s`;
  }
  for (let i = 0; i < 24; i++) {
    const b = make('us-bit', BITS[(Math.random() * BITS.length) | 0]);
    fly(b, 0.22 * spread, 0.82 * spread);
    b.style.fontSize = `${rnd(22, 42)}px`;
    b.style.animationDelay = `${0.78 + rnd(0, 0.35)}s`;
  }
  for (let i = 0; i < 6; i++) {
    const f = make('us-bfly', '🦋');
    f.style.setProperty('--x', `${rnd(-42, 42)}vw`);
    f.style.animationDelay = `${0.85 + rnd(0, 0.5)}s`;
  }
  run(host, 3000, onDone);
}

// ---------------------------------------------------------------- London: the Golden Ticket

/** Big Ben in silhouette: tower, clock face, belfry and spire. */
const BEN_SVG = `
<svg class="ul-ben" viewBox="0 0 60 200" aria-hidden="true">
  <path d="M30 2 L38 40 H22 Z" fill="#1d2433"/>
  <rect x="20" y="40" width="20" height="16" fill="#1d2433"/>
  <rect x="16" y="56" width="28" height="34" rx="2" fill="#1d2433"/>
  <circle cx="30" cy="73" r="10" fill="#fff3c4"/>
  <path d="M30 73 V66 M30 73 H35" stroke="#1d2433" stroke-width="2" stroke-linecap="round"/>
  <rect x="18" y="90" width="24" height="110" fill="#1d2433"/>
</svg>`;

const LONDON_BITS = ['🇬🇧', '💂', '🎡', '☕', '🚌', '⭐', '👑'];

/**
 * London's Golden Ticket, wordless like the Common's: a golden ticket slides up to a gate, the
 * gate beeps green and swings open, a little Tube train whooshes through, and Big Ben rises with a
 * BONG and a burst of London bits. The sounds are the caller's (Sfx.goldenTicket), timed to match.
 */
export function playLondonUnlock(onDone?: () => void): void {
  const { host, fly, make, spread } = makeSplash(
    '<div class="us-veil ul-veil"></div><div class="us-rays ul-late"></div><div class="us-flash ul-late"></div>' +
      `${BEN_SVG}<div class="ul-gate"><i class="ul-paddle"></i><i class="ul-paddle ul-r"></i><b class="ul-light"></b></div>` +
      '<div class="ul-ticket">👑</div><div class="ul-train">🚇</div>',
  );
  for (let i = 0; i < 24; i++) {
    const b = make('us-bit', LONDON_BITS[(Math.random() * LONDON_BITS.length) | 0]);
    fly(b, 0.22 * spread, 0.82 * spread);
    b.style.fontSize = `${rnd(22, 40)}px`;
    b.style.animationDelay = `${1.8 + rnd(0, 0.35)}s`;
  }
  run(host, 3600, onDone);
}
