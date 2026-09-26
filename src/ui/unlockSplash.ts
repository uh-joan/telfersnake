/**
 * The one-off "you cracked into the Common" splash. Wordless and purely decorative: a golden
 * padlock rattles and shatters into shards and sparks, then leaves, petals and butterflies bloom
 * outward on a burst of sunbeams before it all clears to reveal the park. Fires once, when the
 * Common is first unlocked. Built and torn down on the spot; it never touches the sim.
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

/** Play the splash over the current screen; `onDone` fires once it has cleaned itself up. */
export function playCommonUnlock(onDone?: () => void): void {
  const host = document.createElement('div');
  host.id = 'unlock-splash';
  host.innerHTML = `<div class="us-veil"></div><div class="us-rays"></div><div class="us-flash"></div>${LOCK_SVG}<div class="us-burst"></div>`;
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

  document.body.appendChild(host);
  window.setTimeout(() => {
    host.remove();
    onDone?.();
  }, 3000);
}
