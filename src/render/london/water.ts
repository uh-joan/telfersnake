import * as THREE from 'three';
import { THAMES } from '../../sim/londonLayout';
import type { Spot } from '../../sim/stage';
import { extendedRiver } from './ground';
import { PALETTE } from './landmarks/kit';

/**
 * The Thames: a ribbon of cartoon water sunk a little below the paper (the map has the river cut out
 * of it), between stone embankment walls. A small shader on a Lambert material paints it: deep teal,
 * lighter by the banks, and rows of white "~" wave strokes that drift gently downstream (east).
 */

/** The water's surface height: low enough that the bridges have arches over it. */
export const WATER_Y = -0.3;
const HALF = THAMES.width / 2;
/** How far the ribbon runs on under the paper past each bank, so no gap ever shows at a bend. */
const TUCK = 0.6;

/** Per-vertex offset directions (mitred) along a polyline in the x/z plane. */
function miters(path: readonly Spot[]): { nx: number; nz: number; k: number }[] {
  return path.map((p, i) => {
    const a = path[Math.max(0, i - 1)];
    const b = path[Math.min(path.length - 1, i + 1)];
    const seg = (u: Spot, v: Spot) => {
      const d = Math.hypot(v.x - u.x, v.z - u.z) || 1;
      return { x: (v.x - u.x) / d, z: (v.z - u.z) / d };
    };
    const t0 = seg(i > 0 ? a : p, i > 0 ? p : b);
    const t1 = seg(i < path.length - 1 ? p : a, i < path.length - 1 ? b : p);
    const tx = t0.x + t1.x;
    const tz = t0.z + t1.z;
    const tl = Math.hypot(tx, tz) || 1;
    // The left normal of the averaged tangent, stretched so the ribbon keeps its width round a bend.
    const nx = -tz / tl;
    const nz = tx / tl;
    const k = 1 / Math.max(0.5, nx * -t1.z + nz * t1.x);
    return { nx, nz, k };
  });
}

/** A strip between two offsets of the path (offsets in metres, + = left of travel), at heights y0/y1. */
function strip(path: readonly Spot[], off0: number, off1: number, y0: number, y1: number, withUv: boolean): THREE.BufferGeometry {
  const m = miters(path);
  const pos: number[] = [];
  const uv: number[] = [];
  let along = 0;
  path.forEach((p, i) => {
    if (i > 0) along += Math.hypot(p.x - path[i - 1].x, p.z - path[i - 1].z);
    for (const [off, y] of [[off0, y0], [off1, y1]]) {
      pos.push(p.x + m[i].nx * off * m[i].k, y, p.z + m[i].nz * off * m[i].k);
      uv.push(along, off);
    }
  });
  const idx: number[] = [];
  for (let i = 0; i + 1 < path.length; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (withUv) g.setAttribute('rv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export interface Thames {
  group: THREE.Group;
  /** Drift the waves and bob the surface: t = seconds since London was built. */
  update(t: number): void;
}

export function makeThames(): Thames {
  const path = extendedRiver();
  const group = new THREE.Group();

  // ---- the water
  const geo = strip(path, HALF + TUCK, -(HALF + TUCK), 0, 0, true);
  // Up must be up: the strip winds so its normals point +y.
  const n = geo.getAttribute('normal');
  if (n.getY(0) < 0) {
    geo.setIndex(Array.from(geo.index!.array).reverse());
    geo.computeVertexNormals();
  }
  const uniforms = {
    uTime: { value: 0 },
    uDeep: { value: new THREE.Color(PALETTE.thames) },
    uLight: { value: new THREE.Color(PALETTE.thamesLight) },
  };
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 rv;\nvarying vec2 vRv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRv = rv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform vec3 uDeep;\nuniform vec3 uLight;\nvarying vec2 vRv;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float s = vRv.x - uTime * 0.45;         // metres downstream, drifting east
          float w = vRv.y + ${HALF.toFixed(2)};   // metres across from the south bank
          float edge = smoothstep(${(HALF - 1.8).toFixed(2)}, ${(HALF - 0.1).toFixed(2)}, abs(vRv.y));
          vec3 col = mix(uDeep, uLight, edge * 0.85);
          // Rows of cartoon "~" strokes: a sine line, chopped into short dashes, staggered per row.
          float rowH = 2.4;
          float ri = floor(w / rowH);
          float ly = w - (ri + 0.5) * rowH;
          float d = abs(ly - 0.22 * sin(s * 1.5 + ri * 2.1));
          float aa = fwidth(d) + 0.005;
          float line = 1.0 - smoothstep(0.07, 0.07 + aa, d);
          float f = fract((s + ri * 1.73) / 4.2);
          float dash = smoothstep(0.0, 0.05, f) * (1.0 - smoothstep(0.38, 0.43, f));
          col = mix(col, vec3(1.0), line * dash * (1.0 - edge) * 0.92);
          diffuseColor.rgb = col;
        }`,
      );
  };
  const water = new THREE.Mesh(geo, mat);
  water.position.y = WATER_Y;
  water.receiveShadow = true;
  group.add(water);

  // ---- the embankment walls, from the paper's edge down into the water, and end caps at the sheet edge
  const stone = new THREE.MeshLambertMaterial({ color: 0xbfae8c, side: THREE.DoubleSide });
  const bottom = WATER_Y - 0.4;
  for (const side of [1, -1]) group.add(new THREE.Mesh(strip(path, side * HALF, side * HALF, 0, bottom, false), stone));
  const ends = [[path[0], path[1]], [path[path.length - 1], path[path.length - 2]]] as const;
  for (const [a, b] of ends) {
    const cap = new THREE.Mesh(new THREE.PlaneGeometry(THAMES.width, -bottom), stone);
    cap.position.set(a.x, bottom / 2, a.z);
    cap.rotation.y = Math.atan2(b.x - a.x, b.z - a.z); // face along the river
    group.add(cap);
  }

  return {
    group,
    update(t: number) {
      uniforms.uTime.value = t;
      water.position.y = WATER_Y + Math.sin(t * 0.9) * 0.02;
    },
  };
}
