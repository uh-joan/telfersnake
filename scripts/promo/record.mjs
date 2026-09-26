#!/usr/bin/env node
/**
 * Records the Telfersnake promo, frame by frame, from the dev-only director page.
 *
 *   node scripts/promo/record.mjs film   [--format 9x16|16x9] [--fps 30] [--out promo-9x16.mp4]
 *   node scripts/promo/record.mjs stills --at 0,1.5,4.2 [--format …]   (seconds; PNGs for review)
 *   node scripts/promo/record.mjs audio  [--out promo.wav]              (sound only, fast)
 *   node scripts/promo/record.mjs overview                              (top-down plans of each stage)
 *
 * Needs ffmpeg on the PATH and Google Chrome installed (driven through Playwright's `chrome` channel).
 * Nothing is real-time: each frame is stepped, drawn and screenshotted, then piped to ffmpeg.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const mode = args[0] ?? 'film';
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const format = opt('format', '9x16');
const fps = Number(opt('fps', '30'));
const outDir = resolve(root, opt('dir', 'promo-out'));
mkdirSync(outDir, { recursive: true });

// 432×768 CSS pixels at 2.5× is 1080×1920: the game's HUD and splash lay out at true phone size.
const viewport = format === '16x9' ? { width: 768, height: 432 } : { width: 432, height: 768 };
const scale = 2.5;

const server = await createServer({ root, logLevel: 'error', server: { port: 5199, strictPort: false } });
await server.listen();
const base = server.resolvedUrls.local[0];

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--force-color-profile=srgb', '--hide-scrollbars'],
});
const page = await browser.newPage({ viewport, deviceScaleFactor: scale, reducedMotion: 'no-preference' });
page.on('pageerror', (e) => console.error('[page error]', e.message));
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.error(`[page ${m.type()}]`, m.text());
});
await page.goto(`${base}scripts/promo/director.html?director&format=${format}&fps=${fps}`);
await page.waitForFunction(() => '__director' in window);
const info = await page.evaluate(() => window.__director.ready());
console.log(`director ready: ${info.frames} frames at ${info.fps} fps (${info.seconds.toFixed(2)} s), ${format}`);

/** Integrated loudness (LUFS) and true peak (dBTP) of an audio file, via ffmpeg's EBU R128 meter. */
function loudness(file) {
  return new Promise((r, j) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('close', () => {
      const tail = err.slice(err.lastIndexOf('Summary:'));
      const I = Number(/I:\s+(-?[\d.]+) LUFS/.exec(tail)?.[1]);
      const peak = Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(tail)?.[1]);
      Number.isFinite(I) ? r({ I, peak }) : j(new Error('could not measure loudness'));
    });
  });
}
/** Social video sits around −14 LUFS; a limiter keeps the peaks under −1 dBTP. */
const TARGET_LUFS = -14;
async function masterFilter(wav) {
  const { I, peak } = await loudness(wav);
  const gain = TARGET_LUFS - I;
  console.log(`audio: ${I.toFixed(1)} LUFS, peak ${peak.toFixed(1)} dBTP → gain ${gain.toFixed(1)} dB`);
  return `volume=${gain.toFixed(2)}dB,alimiter=limit=0.79:level=false`;
}

const shoot = () => page.screenshot({ type: 'png', animations: 'allow', caret: 'hide' });

async function renderAudioTo(file, dry) {
  if (dry) {
    // The sim alone, no drawing: every sound the film makes, in a few seconds.
    await page.evaluate((n) => {
      for (let i = 0; i < n; i++) window.__director.frame(i, false);
    }, info.frames);
  }
  const b64 = await page.evaluate(() => window.__director.renderAudio());
  const log = await page.evaluate(() => window.__director.sfxLog());
  const beat = 60 / 142;
  writeFileSync(join(outDir, 'sfx-log.txt'), log.map((e) => `${(e.t / beat).toFixed(2).padStart(6)}  ${e.name} ${e.args.join(' ')}`).join('\n'));
  writeFileSync(file, Buffer.from(b64, 'base64'));
  console.log(`audio → ${file}`);
}

try {
  if (mode === 'overview') {
    for (const [id, cx, cz, h] of [['school', 0, 0, 95], ['common', 0, -20, 190]]) {
      await page.evaluate(([id, cx, cz, h]) => window.__director.overview(id, cx, cz, h), [id, cx, cz, h]);
      writeFileSync(join(outDir, `overview-${id}.png`), await shoot());
    }
    console.log(`overviews → ${outDir}`);
  } else if (mode === 'stills') {
    // --beats 1,2.5,40 (beats of the theme) or --at 0.5,3 (seconds).
    const beat = 60 / 142;
    const at = opt('beats') ? opt('beats').split(',').map((b) => Number(b) * beat) : opt('at', '0').split(',').map(Number);
    const want = new Set(at.map((s) => Math.round(s * fps)));
    const last = Math.max(...want);
    // Shots are independent (each builds its own world and reseeds), so start at the first one needed.
    const first = await page.evaluate((f) => window.__director.shotStartFrame(f), Math.min(...want));
    for (let i = first; i <= last; i++) {
      const draw = want.has(i);
      // Every frame is drawn (popups, FX and CSS animations age frame by frame); only some are kept.
      const info = await page.evaluate((i) => window.__director.frame(i), i);
      if (draw) {
        console.log(JSON.stringify(info));
        const file = join(outDir, `still-${format}-${(i / fps / beat).toFixed(2).padStart(6, '0')}.png`);
        writeFileSync(file, await shoot());
        console.log(file);
      }
    }
  } else if (mode === 'audio') {
    const raw = join(outDir, 'promo-raw.wav');
    await renderAudioTo(raw, true);
    const out = resolve(root, opt('out', join(outDir, 'promo.wav')));
    const af = await masterFilter(raw);
    await new Promise((r) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-af', af, out], { stdio: 'inherit' }).on('close', r));
    console.log('mastered →', out, await loudness(out));
  } else if (mode === 'film') {
    const out = resolve(root, opt('out', `promo-${format}.mp4`));
    const silent = join(outDir, `video-${format}.mp4`);
    const wav = join(outDir, `audio-${format}.wav`);
    const ff = spawn('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
      silent,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    const started = Date.now();
    for (let i = 0; i < info.frames; i++) {
      await page.evaluate((i) => window.__director.frame(i), i);
      const png = await shoot();
      if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
      if (i % 60 === 0) console.log(`frame ${i}/${info.frames} (${((Date.now() - started) / 1000).toFixed(0)} s)`);
    }
    ff.stdin.end();
    await new Promise((r, j) => ff.on('close', (code) => (code === 0 ? r() : j(new Error(`ffmpeg ${code}`)))));
    await renderAudioTo(wav, false);
    const af = await masterFilter(wav);
    await new Promise((r, j) => {
      const mux = spawn('ffmpeg', [
        '-y', '-loglevel', 'error', '-i', silent, '-i', wav,
        '-c:v', 'copy', '-af', af, '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out,
      ], { stdio: 'inherit' });
      mux.on('close', (code) => (code === 0 ? r() : j(new Error(`mux ${code}`))));
    });
    console.log(`film → ${out}  (${((Date.now() - started) / 1000).toFixed(0)} s)`);
  } else {
    throw new Error(`unknown mode ${mode}`);
  }
} finally {
  await browser.close();
  await server.close();
}
