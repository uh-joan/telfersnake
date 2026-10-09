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

/** One ribbon per landmark, floating at `y` over (x, z). */
export function makeLabels(spots: readonly { id: LandmarkId; x: number; y: number; z: number }[]): Labels {
  const group = new THREE.Group();
  const sprites = spots.map((s) => {
    const { texture, aspect } = ribbonTexture(LABEL_TEXT[s.id]);
    const mat = new THREE.SpriteMaterial({ map: texture, sizeAttenuation: false, depthWrite: false, transparent: true, fog: false });
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
      sprites.forEach((l, i) => {
        const d = Math.hypot(l.sprite.position.x - x, l.sprite.position.z - z);
        const o = 1 - THREE.MathUtils.smoothstep(d, NEAR, FAR);
        l.mat.opacity = o;
        l.sprite.visible = o > 0.01;
        l.sprite.position.y = l.y + Math.sin(t * 1.3 + i * 1.7) * 0.25;
      });
    },
  };
}
