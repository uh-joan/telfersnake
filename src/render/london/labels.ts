import * as THREE from 'three';
import { INK_CSS } from './ground';
import type { LandmarkId } from './landmarks/kit';

/**
 * The ribbon banners on the sights (docs/LEVEL3-LONDON.md §2.1 rule 5): a paper ribbon with folded
 * ends and one or two short words. Each is a sign pinned to its landmark: a fixed spot in the world,
 * low on the south face where the chase camera (south of the snake, looking north and down) sees it,
 * turned to the camera and always the same size in the world. It never slides about the screen.
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
/** The paper band's height in the world, metres: about a snake's head, readable on a phone. */
const BAND_M = 0.85;
/** Labels start to fade this far from the snake, and are gone by FAR. */
const NEAR = 42;
const FAR = 58;

/**
 * Where each sign is pinned, from the landmark's own spot: `dx` east, `y` up, and `dz` south of its
 * SOUTH face (the southern edge of its bounding box). Picked by eye from the game camera with the
 * snake just south of each, on a phone held upright and on a desktop: over the door or at the foot
 * of the tower, above a snake (and above a bus where a street runs by), clear of the neighbours.
 */
export const LABEL_PIN: Record<LandmarkId, { dx: number; y: number; dz: number }> = {
  bigben: { dx: 0, y: 3.5, dz: 0.5 },
  eye: { dx: 0, y: 3.5, dz: 0.5 },
  palace: { dx: 0, y: 3.5, dz: 0.5 },
  trafalgar: { dx: 0, y: 3.5, dz: 0.5 },
  stpauls: { dx: 0, y: 3.5, dz: -2.6 }, // back off the Strand, onto the steps
  tower: { dx: 0, y: 3.5, dz: -1 }, // on the wall, off the Embankment
  towerbridge: { dx: 0, y: 4, dz: -2.6 }, // on the span between the towers, not out over the river
  shard: { dx: 0, y: 3.5, dz: 0.5 },
  gherkin: { dx: 0, y: 3.5, dz: 0.5 },
  globe: { dx: 0, y: 3.5, dz: 0.5 },
  piccadilly: { dx: 0, y: 3.5, dz: 0.5 },
  museum: { dx: 0, y: 3.5, dz: 0.5 },
};

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
  /**
   * Fade out the ones far from the snake at (x, z) and the one that would cover it, and bob a
   * touch in place. `shown[i]` is how solid landmark i is drawn (1, or less while it is see-through).
   */
  update(x: number, z: number, t: number, dt: number, shown: readonly number[]): void;
}

const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _e = new THREE.Vector3();

/** One ribbon per landmark, pinned at its spot (x, y, z); `camera` is for keeping the snake in sight. */
export function makeLabels(spots: readonly { id: LandmarkId; x: number; y: number; z: number }[], camera?: THREE.Camera): Labels {
  const group = new THREE.Group();
  const sprites = spots.map((s) => {
    const { texture, aspect } = ribbonTexture(LABEL_TEXT[s.id]);
    // Drawn over the scene: turned to a camera that looks down, its top leans back into the wall.
    const mat = new THREE.SpriteMaterial({ map: texture, depthWrite: false, depthTest: false, transparent: true, fog: false });
    const sprite = new THREE.Sprite(mat);
    const h = BAND_M * (H / BAND);
    sprite.center.set(0.5, 0); // stands on its pin
    sprite.scale.set(h * aspect, h, 1);
    sprite.position.set(s.x, s.y, s.z);
    sprite.renderOrder = 10;
    group.add(sprite);
    return { sprite, mat, y: s.y, w: h * aspect, h, near: 1 };
  });
  return {
    group,
    update(x, z, t, dt, shown) {
      const ease = 1 - Math.exp(-dt * 9);
      if (camera) _s.set(x, 1, z).project(camera);
      sprites.forEach((l, i) => {
        const p = l.sprite.position;
        const d = Math.hypot(p.x - x, p.z - z);
        let o = 1 - THREE.MathUtils.smoothstep(d, NEAR, FAR);
        if (camera && o > 0.01) {
          // Its box on screen, from the pin and its top corner; over the snake it steps back to a whisper.
          const m = camera.matrixWorld.elements;
          _p.set(p.x, l.y, p.z).project(camera);
          _e.set(p.x + m[0] * l.w / 2 + m[4] * l.h, l.y + m[1] * l.w / 2 + m[5] * l.h, p.z + m[2] * l.w / 2 + m[6] * l.h).project(camera);
          const halfW = Math.abs(_e.x - _p.x) + 0.06;
          if (Math.abs(_s.x - _p.x) < halfW && _s.y > _p.y - 0.08 && _s.y < _e.y + 0.08) o *= 0.25;
        }
        l.near += (o - l.near) * ease;
        l.mat.opacity = l.near * (shown[i] ?? 1);
        l.sprite.visible = l.mat.opacity > 0.01;
        p.y = l.y + Math.sin(t * 1.3 + i * 1.7) * 0.04;
      });
    },
  };
}
