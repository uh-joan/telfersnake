// Bakes the home-screen PNG icons from public/icon.svg (run scripts/make-icon.mjs first).
// Only needed when the icon art changes; the PNGs live in public/ and ship as-is. Needs the
// dev-only `sharp` (not in the production container). Run: node scripts/bake-icons.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const dir = new URL('../public/', import.meta.url);
const art = readFileSync(new URL('icon.svg', dir));
const BLUE = '#2f5fc0'; // matches the badge, so a maskable crop just shows more blue
const bg = (size) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="${BLUE}"/></svg>`);

// name, pixel size, and how much of the frame is blank margin (bigger for maskable's safe zone)
const ICONS = [
  ['icon-192.png', 192, 0.05],
  ['icon-512.png', 512, 0.05],
  ['icon-maskable.png', 512, 0.16], // platforms crop maskable icons; keep the art well inside
  ['apple-touch-icon.png', 180, 0.05], // iOS rounds the corners itself, so the frame is a full square
  ['favicon-48.png', 48, 0.04],
];

for (const [name, size, margin] of ICONS) {
  const inset = Math.round(size * margin);
  const inner = size - inset * 2;
  const snake = await sharp(art).resize(inner, inner, { fit: 'contain', background: '#00000000' }).png().toBuffer();
  await sharp(bg(size))
    .composite([{ input: snake, top: inset, left: inset }])
    .png()
    .toFile(new URL(name, dir).pathname);
  console.log(`  ${name}  ${size}px`);
}

// A crisp SVG favicon too (the art on the sky-blue square), for browsers that prefer it.
const fav =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">` +
  `<rect width="512" height="512" rx="96" fill="#2f5fc0"/>` +
  readFileSync(new URL('icon.svg', dir), 'utf8').replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '') +
  `</svg>`;
writeFileSync(new URL('favicon.svg', dir), fav);
console.log('  favicon.svg');
console.log('baked into public/');
