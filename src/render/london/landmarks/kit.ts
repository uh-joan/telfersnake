import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LANDMARKS } from '../../../sim/londonLayout';

/**
 * The landmark toolkit: small, vertex-coloured geometry helpers, the toon material and the ink
 * outline that makes London look *drawn* (docs/LEVEL3-LONDON.md §2). Every landmark builder uses
 * only this file and the layout constants.
 *
 * Conventions (all helpers):
 * - Units are metres; +x east, +y up, +z south (sim z = three z).
 * - A builder works in LOCAL coordinates around its landmark's `at` (LANDMARK_AT[id]); london.ts
 *   moves the finished group there. `rel(id, x, z)` turns a sim position into a local one.
 * - `box`, `cyl`, `cone`, `lathe`, `windows`, `crenellations` STAND ON `y` (their base is at y);
 *   `sphere` is CENTRED on `y`; `extrude` puts the shape's own (0,0) at (x, y) and centres its depth on z.
 * - Every helper returns a non-indexed geometry with exactly `position`, `normal` and `color`, so
 *   any mix of them merges: `toonMesh(merge([...]))` is one draw call (plus one for `withOutline`).
 */

export type LandmarkId =
  | 'bigben' | 'eye' | 'palace' | 'trafalgar' | 'stpauls' | 'tower'
  | 'towerbridge' | 'shard' | 'gherkin' | 'globe' | 'piccadilly' | 'museum';

export interface LandmarkBuild {
  /** Built in local coordinates around (0, 0, 0) = the landmark's `at`. */
  group: THREE.Group;
  /** Its one bit of life (the clock hands, the wheel, the flag), every frame: t = seconds, dt = frame. */
  animate?(t: number, dt: number): void;
  /** Tall enough to hide a snake behind it: fades see-through when it stands between camera and snake. */
  tall: boolean;
  /** Where the ribbon label floats (local y, metres). */
  labelY: number;
}
export type LandmarkBuilder = () => LandmarkBuild;

/** Where each landmark's local origin sits on the map (its LANDMARKS `at`). */
export const LANDMARK_AT = Object.fromEntries(LANDMARKS.map((l) => [l.id, l.at])) as Record<LandmarkId, { x: number; z: number }>;

/** A sim position (x, z) in the landmark's local frame. */
export const rel = (id: LandmarkId, x: number, z: number) => ({ x: x - LANDMARK_AT[id].x, z: z - LANDMARK_AT[id].z });

// ---------------------------------------------------------------- palette (the map's colours)

/** The ink every outline and map edge is drawn in. */
export const INK = 0x2b2118;
export const PALETTE = {
  ink: INK,
  paper: 0xf8f1df,
  street: 0xffffff,
  park: 0x8fd16a,
  parkEdge: 0x4f9a3e,
  sand: 0xefcf86,
  thames: 0x1f8a96,
  thamesLight: 0x6fd0cf,
  stone: 0xd9cdb3,
  stoneDark: 0xa89c86,
  honey: 0xe2b85c, // Big Ben's honey-gold stone
  clockWhite: 0xfffbea,
  gold: 0xf2c230,
  palaceCream: 0xf1e6cc,
  guardRed: 0xd8342c,
  busRed: 0xd62d20,
  navy: 0x1f3264,
  skyBlue: 0x8cc8ec, // Tower Bridge's walkways
  bridgeGrey: 0xb8b4ab,
  westminsterGreen: 0x3f8a5a,
  silver: 0xd3dae2,
  glassBlue: 0x8ec9ea, // the Shard
  pickleGreen: 0x5c9e3c, // the Gherkin
  domeGrey: 0xc9ccd0, // St Paul's
  eyeWhite: 0xf7f7f2,
  terracotta: 0xc9714b, // the Natural History Museum
  thatch: 0xc9a25a, // the Globe
  timber: 0x5a3a24,
  slate: 0x5d6470,
  white: 0xffffff,
} as const;

// ---------------------------------------------------------------- geometry helpers

const _c = new THREE.Color();

/** Make any built-in geometry kit-shaped: non-indexed, position + normal + colour only. */
function finish(geo: THREE.BufferGeometry, color: number): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  g.clearGroups();
  _c.setHex(color);
  const n = g.getAttribute('position').count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colors.set([_c.r, _c.g, _c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

function place(g: THREE.BufferGeometry, x: number, y: number, z: number, rotY = 0): THREE.BufferGeometry {
  if (rotY) g.rotateY(rotY);
  g.translate(x, y, z);
  return g;
}

/** A box w (x) × h (y) × d (z), standing on y. */
export function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0, rotY = 0): THREE.BufferGeometry {
  return place(finish(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), color), x, y, z, rotY);
}

/** A cylinder (or a tapered drum), standing on y. */
export function cyl(rTop: number, rBot: number, h: number, color: number, x = 0, y = 0, z = 0, segments = 16): THREE.BufferGeometry {
  return place(finish(new THREE.CylinderGeometry(rTop, rBot, h, segments).translate(0, h / 2, 0), color), x, y, z);
}

/** A cone (a spire, a turret cap), standing on y. Four segments make a pyramid roof. */
export function cone(r: number, h: number, color: number, x = 0, y = 0, z = 0, segments = 16): THREE.BufferGeometry {
  return place(finish(new THREE.ConeGeometry(r, h, segments).translate(0, h / 2, 0), color), x, y, z);
}

/**
 * A sphere centred on y. For a dome pass thetaLen = π/2 (the top half; its base is then at y).
 * phiLen < 2π cuts a wedge round the vertical axis.
 */
export function sphere(
  r: number, color: number, x = 0, y = 0, z = 0, wSeg = 16, hSeg = 12, phiLen = Math.PI * 2, thetaLen = Math.PI,
): THREE.BufferGeometry {
  return place(finish(new THREE.SphereGeometry(r, wSeg, hSeg, 0, phiLen, 0, thetaLen), color), x, y, z);
}

/** A turned profile ([radius, height] pairs, bottom to top) spun round the vertical axis, standing on y. */
export function lathe(points: readonly (readonly [number, number])[], color: number, x = 0, y = 0, z = 0, segments = 24): THREE.BufferGeometry {
  const pts = points.map(([r, h]) => new THREE.Vector2(r, h));
  return place(finish(new THREE.LatheGeometry(pts, segments), color), x, y, z);
}

/**
 * A flat shape drawn in the XY plane (x across, y up), extruded `depth` along z and centred on it.
 * Good for gables, arches (use shape.holes) and the Eye's rim. rotY turns it about its own origin.
 */
export function extrude(shape: THREE.Shape, depth: number, color: number, x = 0, y = 0, z = 0, rotY = 0): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 12 });
  g.translate(0, 0, -depth / 2);
  return place(finish(g, color), x, y, z, rotY);
}

export interface WindowGrid {
  cols: number;
  rows: number;
  /** The spacing between window centres, across and up. */
  cellW: number;
  cellH: number;
  /** Each pane's size (default 55% of the cell). */
  winW?: number;
  winH?: number;
  color: number;
  /** Centre of the grid across; y = the bottom row's cell base; z = the wall face it sits proud of. */
  x?: number;
  y?: number;
  z?: number;
  /** 0 faces +z (south, toward the camera); π/2 faces +x; π faces north. Rotates about (x, z). */
  rotY?: number;
  /** Round-topped panes (a stone building) instead of square ones. */
  arched?: boolean;
}

/** A grid of window panes on a wall face, as thin slabs just proud of it. */
export function windows(o: WindowGrid): THREE.BufferGeometry {
  const winW = o.winW ?? o.cellW * 0.55;
  const winH = o.winH ?? o.cellH * 0.55;
  const parts: THREE.BufferGeometry[] = [];
  const depth = 0.08;
  for (let r = 0; r < o.rows; r++) {
    for (let c = 0; c < o.cols; c++) {
      const cx = (c - (o.cols - 1) / 2) * o.cellW;
      const cy = r * o.cellH + (o.cellH - winH) / 2;
      if (o.arched) {
        const s = new THREE.Shape();
        const hw = winW / 2;
        const straight = Math.max(0, winH - hw);
        s.moveTo(-hw, 0);
        s.lineTo(hw, 0);
        s.lineTo(hw, straight);
        s.absarc(0, straight, hw, 0, Math.PI, false);
        s.lineTo(-hw, 0);
        const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 6 });
        g.translate(cx, cy, 0);
        parts.push(finish(g, o.color));
      } else {
        parts.push(finish(new THREE.BoxGeometry(winW, winH, depth).translate(cx, cy + winH / 2, depth / 2), o.color));
      }
    }
  }
  const g = merge(parts);
  return place(g, o.x ?? 0, o.y ?? 0, o.z ?? 0, o.rotY ?? 0);
}

/**
 * Castle battlements round the top edge of a w × d block centred on (x, z): merlons `size` wide and
 * tall, standing on y (the wall top), every other gap left open.
 */
export function crenellations(w: number, d: number, color: number, x = 0, y = 0, z = 0, size = 0.5): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const t = size * 0.8; // merlon thickness
  const along = (len: number, fn: (p: number) => THREE.BufferGeometry) => {
    const n = Math.max(1, Math.floor(len / (size * 2)));
    const step = len / n;
    for (let i = 0; i < n; i++) parts.push(fn(-len / 2 + step * (i + 0.5)));
  };
  along(w, (p) => box(size, size, t, color, x + p, y, z - d / 2 + t / 2));
  along(w, (p) => box(size, size, t, color, x + p, y, z + d / 2 - t / 2));
  along(d, (p) => box(t, size, size, color, x - w / 2 + t / 2, y, z + p));
  along(d, (p) => box(t, size, size, color, x + w / 2 - t / 2, y, z + p));
  return merge(parts);
}

/** Merge kit geometries into one (they all share position/normal/colour). Throws if handed a stranger. */
export function merge(geoms: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(geoms);
  if (!merged) throw new Error('kit.merge: geometries do not share attributes (build them with the kit helpers)');
  for (const g of geoms) g.dispose();
  return merged;
}

// ---------------------------------------------------------------- materials and the ink outline

/** Three flat light bands: the storybook toon look. */
const TOON_RAMP = (() => {
  const t = new THREE.DataTexture(new Uint8Array([150, 210, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
})();

export interface ToonOptions {
  /** Faceted shading (normals recomputed per face) instead of smooth bands. */
  flat?: boolean;
  /** Casts a shadow on the map (default true). */
  castShadow?: boolean;
  /** Self-lit (clock faces, screens): 0..1 lifts the whole mesh toward white, so keep those parts their own mesh. */
  glow?: number;
}

/** A fresh vertex-coloured toon material (for instanced meshes; toonMesh makes its own). */
export const toonMaterial = () => new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: TOON_RAMP });

/** A vertex-coloured toon mesh. Each call gets its own material, so a landmark can fade alone. */
export function toonMesh(geom: THREE.BufferGeometry, opts: ToonOptions = {}): THREE.Mesh {
  if (opts.flat) geom.computeVertexNormals(); // non-indexed: one normal per face
  const mat = toonMaterial();
  if (opts.glow) {
    mat.emissive.setScalar(opts.glow * 0.6); // toon has no per-vertex emissive: lift the dark bands
  }
  const mesh = new THREE.Mesh(geom, mat);
  mesh.castShadow = opts.castShadow ?? true;
  mesh.receiveShadow = true;
  return mesh;
}

/** The ink material for an outline hull (each gets its own copy so it can fade). */
export const inkMaterial = () => new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });

/**
 * The inverted hull: a copy of the geometry with smooth (welded) normals, pushed out by `thickness`
 * and drawn back-faces-only in ink. Shared by withOutline and the instanced street furniture.
 */
export function outlineGeometry(geom: THREE.BufferGeometry, thickness = 0.06): THREE.BufferGeometry {
  const src = new THREE.BufferGeometry();
  src.setAttribute('position', geom.getAttribute('position').clone());
  const welded = mergeVertices(src, 1e-3);
  src.dispose();
  welded.computeVertexNormals();
  const pos = welded.getAttribute('position');
  const nor = welded.getAttribute('normal');
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i, pos.getX(i) + nor.getX(i) * thickness, pos.getY(i) + nor.getY(i) * thickness, pos.getZ(i) + nor.getZ(i) * thickness);
  }
  welded.deleteAttribute('normal'); // MeshBasic needs none
  return welded;
}

/**
 * Give a mesh its ink outline. The hull is a child of the mesh (so it follows any animation) and the
 * returned group holds the mesh. Thickness is in metres: 0.06 for props, ~0.12 for big landmarks.
 */
export function withOutline(mesh: THREE.Mesh, thickness = 0.06): THREE.Group {
  const hull = new THREE.Mesh(outlineGeometry(mesh.geometry, thickness), inkMaterial());
  hull.castShadow = false;
  hull.receiveShadow = false;
  hull.raycast = () => {};
  mesh.add(hull);
  const g = new THREE.Group();
  g.add(mesh);
  return g;
}

/** The common case: merge parts → toon mesh → outlined group. */
export function inked(parts: THREE.BufferGeometry[], thickness = 0.06, opts: ToonOptions = {}): THREE.Group {
  return withOutline(toonMesh(merge(parts), opts), thickness);
}
