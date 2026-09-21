// The Telfersnake app icon, in the school's own colours: a royal-blue tile badge with a yellow
// border (like the "TELFER SCOT" mosaic on the school wall), a bold white "T", and a yellow-and-
// navy snake — the school's blue/yellow — coiled around it. Pure SVG, no deps.
// Output: public/icon.svg. Rebake the PNGs with: node scripts/bake-icons.mjs
import { writeFileSync } from 'node:fs';

const SIZE = 512;
const CX = 256;

// Telferscot blue and yellow (navy sweatshirt, yellow polo).
const BLUE = '#2f5fc0';
const YELLOW = ['#ffd21f', '#f4b400', '#ffdd55'];
const NAVY = '#173a86';
const HEAD = '#ffdd55';

const el = [];
const push = (s) => el.push(s);
const circle = (x, y, r, fill, extra = '') => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${fill}" ${extra}/>`;

// A body bead: a yellow (or navy) ball with a dark rim and a soft highlight.
function bead(x, y, r, color) {
  const rim = color === NAVY ? '#0d245c' : NAVY;
  return (
    circle(x, y, r, rim) +
    circle(x, y, r - r * 0.14, color) +
    `<ellipse cx="${(x - r * 0.3).toFixed(1)}" cy="${(y - r * 0.34).toFixed(1)}" rx="${(r * 0.42).toFixed(1)}" ry="${(r * 0.3).toFixed(1)}" fill="#ffffff" opacity="0.45"/>`
  );
}

// --- the blue badge with its yellow tile border
push(`<rect x="0" y="0" width="${SIZE}" height="${SIZE}" rx="104" fill="${BLUE}"/>`);
push(`<rect x="30" y="30" width="${SIZE - 60}" height="${SIZE - 60}" rx="74" fill="none" stroke="${YELLOW[0]}" stroke-width="26"/>`);

// --- the snake spirals up a "T"; z>0 = near side (in front of the T), z<0 = far side (behind)
const TURNS = 2.15;
const N = 26;
const body = [];
for (let i = 0; i < N; i++) {
  const t = i / (N - 1);
  const theta = t * Math.PI * 2 * TURNS;
  const amp = 52 + 30 * t; // hug the stem at the tail, wider near the head
  const x = CX + Math.sin(theta) * amp;
  const y = 384 - t * 236;
  const z = Math.cos(theta);
  const r = (12 + 14 * t) * (0.9 + z * 0.1);
  // Mostly yellow, a navy band every fifth bead — the school snake.
  const color = i % 5 === 3 ? NAVY : YELLOW[i % 3];
  body.push({ x, y, r, z, color });
}

const tail0 = body[0];
const tailTip =
  `<path d="M ${(tail0.x - tail0.r).toFixed(1)} ${tail0.y.toFixed(1)} ` +
  `Q ${tail0.x.toFixed(1)} ${(tail0.y + tail0.r * 2.6).toFixed(1)} ${(tail0.x + tail0.r).toFixed(1)} ${tail0.y.toFixed(1)} Z" ` +
  `fill="${YELLOW[0]}" stroke="${NAVY}" stroke-width="3" stroke-linejoin="round"/>`;

// The white T, sized to sit under the coils.
const T =
  `<g fill="#ffffff" stroke="#e6ecf6" stroke-width="3">` +
  `<rect x="158" y="120" width="196" height="56" rx="20"/>` +
  `<rect x="230" y="146" width="52" height="234" rx="22"/>` +
  `</g>`;

// far coils, tail, then the T, then near coils, then the head
push(tailTip);
push(`<g>${body.filter((b) => b.z < 0).map((b) => bead(b.x, b.y, b.r, b.color)).join('')}</g>`);
push(T);
push(`<g>${body.filter((b) => b.z >= 0).map((b) => bead(b.x, b.y, b.r, b.color)).join('')}</g>`);

// --- head with googly eyes, over the top of the T
const hx = 316;
const hy = 138;
const hr = 44;
const head = [];
head.push(circle(hx, hy, hr, NAVY));
head.push(circle(hx, hy, hr - 5, HEAD));
head.push(`<ellipse cx="${hx - 14}" cy="${hy - 16}" rx="19" ry="13" fill="#ffffff" opacity="0.45"/>`);
for (const dx of [-16, 15]) {
  head.push(circle(hx + dx, hy + 2, 12, '#ffffff', `stroke="${NAVY}" stroke-width="2"`));
  head.push(circle(hx + dx + 3, hy + 5, 5.5, '#15181d'));
}
head.push(`<path d="M ${hx - 16} ${hy + 24} Q ${hx} ${hy + 35} ${hx + 18} ${hy + 22}" fill="none" stroke="${NAVY}" stroke-width="4" stroke-linecap="round"/>`);
head.push(`<path d="M ${hx + hr - 6} ${hy + 18} q 14 6 22 0 m -22 0 q 14 -6 22 0" fill="none" stroke="#e0524d" stroke-width="4" stroke-linecap="round"/>`);
push(`<g>${head.join('')}</g>`);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">` + el.join('') + `</svg>`;
writeFileSync(new URL('../public/icon.svg', import.meta.url), svg);
console.log('wrote public/icon.svg');
