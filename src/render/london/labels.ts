import * as THREE from 'three';
import { INK_CSS } from './ground';
import type { LandmarkId } from './landmarks/kit';

/**
 * The ribbon banners over the sights (docs/LEVEL3-LONDON.md §2.1 rule 5): a paper ribbon with folded
 * ends and one or two short words. Camera-facing sprites drawn at a fixed screen size, so they read on
 * a phone however far the camera pulls back; the far ones fade away so the sky never fills with words.
 */

export const LABEL_TEXT: Record<LandmarkId, string> = {
  bigben: 'BIG BEN',
  eye: 'LONDON EYE',
  palace: 'PALACE',
  trafalgar: 'TRAFALGAR',
  stpauls: "ST PAUL'S",
  tower: 'TOWER',
  towerbridge: 'TOWER BRIDGE',
  shard: 'SHARD',
  gherkin: 'GHERKIN',
  globe: 'GLOBE',
  piccadilly: 'PICCADILLY',
  museum: 'MUSEUM',
};

const FONT = "900 64px ui-rounded, 'SF Pro Rounded', 'Arial Rounded MT Bold', 'Nunito', system-ui, sans-serif";
const H = 128; // canvas height
const BAND = 84; // the ribbon's height on it
const TAIL = 44; // each folded end's width
/** The ribbon's height as a share of the view (sizeAttenuation off: scale is in tan(fov/2) units). */
const SCREEN_H = 0.05;
/** Labels start to fade this far from the snake, and are gone by FAR. */
const NEAR = 42;
const FAR = 58;
/** A ribbon never rides higher on screen than this (NDC, 1 = the top edge): the HUD lives up there. */
const TOP_NDC = 0.66;
/** On a phone held upright the HUD (minimap, pause, leaderboard) reaches further down. */
const TOP_NDC_PORTRAIT = 0.32;
/** ...and never lower than this over its roof, so it still reads as that sight's name. */
const MIN_Y = 2;
/** The ribbon's half-size on screen (NDC) for the "is it over the snake?" test, roughly. */
const HALF_W = 0.28;
const HALF_H = 0.07;

function ribbonTexture(text: string): { texture: THREE.CanvasTexture; aspect: number } {
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.font = FONT;
  const textW = Math.ceil(probe.measureText(text).width);
  const bandW = textW + 56;
  const canvas = document.createElement('canvas');
  canvas.width = bandW + TAIL * 2;
  canvas.height = H;
  const c = canvas.getContext('2d')!;
  const top = (H - BAND) / 2 - 8;
  const x0 = TAIL;
  const x1 = TAIL + bandW;
  c.lineJoin = 'round';
  c.lineWidth = 5;
  c.strokeStyle = INK_CSS;

  // The folded ends: a darker red tail, notched, peeking out behind and a little below each end.
  for (const s of [-1, 1]) {
    const edge = s < 0 ? x0 : x1;
    const out = edge + s * (TAIL - 4);
    c.beginPath();
    c.moveTo(edge - s * 18, top + 16);
    c.lineTo(out, top + 16);
    c.lineTo(out - s * 16, top + 16 + BAND / 2);
    c.lineTo(out, top + 16 + BAND);
    c.lineTo(edge - s * 18, top + 16 + BAND);
    c.closePath();
    c.fillStyle = '#a3221d';
    c.fill();
    c.stroke();
    // The fold's shadow triangle where the band turns under.
    c.beginPath();
    c.moveTo(edge, top + BAND);
    c.lineTo(edge - s * 18, top + 16 + BAND);
    c.lineTo(edge - s * 18, top + BAND);
    c.closePath();
    c.fillStyle = '#5e1512';
    c.fill();
  }

  // The band: cream paper with a red edge top and bottom and a thin navy pinstripe.
  c.beginPath();
  c.moveTo(x0, top);
  c.quadraticCurveTo((x0 + x1) / 2, top - 6, x1, top);
  c.lineTo(x1, top + BAND);
  c.quadraticCurveTo((x0 + x1) / 2, top + BAND - 6, x0, top + BAND);
  c.closePath();
  c.fillStyle = '#fff6df';
  c.fill();
  c.save();
  c.clip();
  c.fillStyle = '#d8342c';
  c.fillRect(x0, top - 8, bandW, 16);
  c.fillRect(x0, top + BAND - 9, bandW, 16);
  c.fillStyle = '#1f3264';
  c.fillRect(x0, top + 11, bandW, 3);
  c.fillRect(x0, top + BAND - 13, bandW, 3);
  c.restore();
  c.stroke();

  c.font = FONT;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = '#1f3264';
  c.fillText(text, (x0 + x1) / 2, top + BAND / 2 + 3);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter; // no mipmaps: a sprite this small never needs them
  texture.generateMipmaps = false;
  return { texture, aspect: canvas.width / canvas.height };
}

export interface Labels {
  group: THREE.Group;
  /** Bob gently, and fade out the ones far from the snake at (x, z). */
  update(x: number, z: number, t: number): void;
}

const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

/**
 * One ribbon per landmark, floating at `y` over (x, z). With the `camera`, a ribbon that would sit
 * off the top of the screen (a small snake's camera rides low, under the tall sights' roofs) comes
 * down until it is in view, drawn over its building like a sign; and one that would cover the snake
 * fades back so the snake always shows.
 */
export function makeLabels(spots: readonly { id: LandmarkId; x: number; y: number; z: number }[], camera?: THREE.Camera): Labels {
  const group = new THREE.Group();
  const sprites = spots.map((s) => {
    const { texture, aspect } = ribbonTexture(LABEL_TEXT[s.id]);
    const mat = new THREE.SpriteMaterial({
      map: texture, sizeAttenuation: false, depthWrite: false, depthTest: camera === undefined, transparent: true, fog: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.center.set(0.5, 0); // hang from its bottom edge, so it floats just above the roof
    sprite.scale.set(SCREEN_H * (H / BAND) * aspect, SCREEN_H * (H / BAND), 1);
    sprite.position.set(s.x, s.y, s.z);
    sprite.renderOrder = 10;
    group.add(sprite);
    return { sprite, mat, y: s.y };
  });
  return {
    group,
    update(x, z, t) {
      if (camera) _s.set(x, 1, z).project(camera);
      sprites.forEach((l, i) => {
        const p = l.sprite.position;
        const d = Math.hypot(p.x - x, p.z - z);
        let o = 1 - THREE.MathUtils.smoothstep(d, NEAR, FAR);
        let y = l.y;
        if (camera && o > 0.01) {
          const top = (camera as THREE.PerspectiveCamera).aspect < 1 ? TOP_NDC_PORTRAIT : TOP_NDC;
          // Highest height still under `top` on screen: projection is monotonic in y, so bisect.
          if (_p.set(p.x, y, p.z).project(camera).y > top || _p.z > 1) {
            let lo = MIN_Y;
            let hi = l.y;
            for (let k = 0; k < 8; k++) {
              const mid = (lo + hi) / 2;
              _p.set(p.x, mid, p.z).project(camera);
              if (_p.y > top || _p.z > 1) hi = mid;
              else lo = mid;
            }
            y = lo;
            // Even sitting on its roofline it would be up under the HUD: wait until it comes down.
            if (_p.set(p.x, y, p.z).project(camera).y > top || _p.z > 1) o = 0;
          }
          // Over the snake? Step back to a whisper. (The ribbon hangs up from its point.)
          _p.set(p.x, y, p.z).project(camera);
          if (Math.abs(_p.x - _s.x) < HALF_W && _s.y - _p.y > -0.02 && _s.y - _p.y < HALF_H * 2 + 0.04) o *= 0.25;
        }
        l.mat.opacity += (o - l.mat.opacity) * 0.15;
        l.sprite.visible = l.mat.opacity > 0.01;
        p.y = y + Math.sin(t * 1.3 + i * 1.7) * 0.25;
      });
    },
  };
}
