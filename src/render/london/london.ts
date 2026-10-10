import * as THREE from 'three';
import { ELFIN_OAK, LANDMARKS } from '../../sim/londonLayout';
import { makeElfinOak } from './legends';
import type { School } from '../school';
import { makeBridges } from './bridges';
import { makeFurniture } from './furniture';
import { makePaperMap, SHEET } from './ground';
import { makeLabels } from './labels';
import { makeSouthWest } from './southwest';
import { LANDMARK_BUILDERS, type LandmarkBuild, type LandmarkId } from './landmarks';
import { makeThames } from './water';

/**
 * London: the paper tourist map come to life (docs/LEVEL3-LONDON.md §2, plan §4.3). Assembles the
 * painted ground, the Thames, the bridges, the twelve landmarks with their ribbons, and the street
 * furniture. `reveal` runs every frame: it drives the water and every landmark's animation, and fades
 * any landmark that stands between the camera (south of the snake) and the snake.
 */

/** A landmark that can fade: its box, its voxels and what to fade. */
interface Occluder {
  group: THREE.Object3D;
  minX: number;
  maxX: number;
  northZ: number;
  southZ: number;
  /** Where the landmark is, in 1 m voxels across its box (see voxelise). */
  voxels: Uint8Array;
  cols: number;
  rows: number;
  levels: number;
  materials: THREE.Material[];
  outlines: THREE.Object3D[];
  /** The landmark's own meshes: they stop casting shadows while see-through. */
  meshes: THREE.Mesh[];
  casts: boolean[];
  /** Depth-only twins, drawn just before the faded colour so only the nearest layer of glass shows. */
  prepass: THREE.Mesh[];
  faded: boolean;
}

/**
 * Writes depth and no colour. Drawn in the transparent queue just before a faded landmark (after
 * the snake, so it never hides it), it leaves only the landmark's nearest faces for the colour pass:
 * one sheet of glass, not a dozen stacked ones adding up to solid.
 */
const DEPTH_ONLY = new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true, depthWrite: true });
const FADED = 0.3;
/** A landmark part smaller than this (bounding radius, m) casts no shadow. */
const SMALL_PART = 1.5;

/**
 * A 1 m voxel grid of where the landmark has stuff: every triangle's bounding box, filled in.
 * Coarse, but it knows a walkway high overhead from a wall beside you, which a height map cannot.
 */
function voxelise(meshes: THREE.Mesh[], minX: number, minZ: number, cols: number, rows: number, levels: number): Uint8Array {
  const vox = new Uint8Array(cols * rows * levels);
  const v = new THREE.Vector3();
  const lo = new THREE.Vector3();
  const hi = new THREE.Vector3();
  for (const mesh of meshes) {
    if ((mesh as THREE.InstancedMesh).isInstancedMesh) continue; // the small moving bits (pods, hands)
    const pos = mesh.geometry.getAttribute('position');
    const index = mesh.geometry.getIndex();
    const n = index ? index.count : pos.count;
    for (let t = 0; t + 2 < n; t += 3) {
      lo.setScalar(Infinity);
      hi.setScalar(-Infinity);
      for (let k = 0; k < 3; k++) {
        v.fromBufferAttribute(pos, index ? index.getX(t + k) : t + k).applyMatrix4(mesh.matrixWorld);
        lo.min(v);
        hi.max(v);
      }
      const c0 = Math.max(0, Math.floor(lo.x - minX));
      const c1 = Math.min(cols - 1, Math.floor(hi.x - minX));
      const r0 = Math.max(0, Math.floor(lo.z - minZ));
      const r1 = Math.min(rows - 1, Math.floor(hi.z - minZ));
      const l0 = Math.max(0, Math.floor(lo.y));
      const l1 = Math.min(levels - 1, Math.floor(hi.y));
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) for (let l = l0; l <= l1; l++) vox[(r * cols + c) * levels + l] = 1;
      }
    }
  }
  return vox;
}

/** Is there any of the landmark within (dc, dr, dl) voxels of (c, r, l)? */
function near(o: Occluder, c: number, r: number, l: number, dc: number, dr: number, dl: number): boolean {
  for (let rr = Math.max(0, r - dr); rr <= Math.min(o.rows - 1, r + dr); rr++) {
    for (let cc = Math.max(0, c - dc); cc <= Math.min(o.cols - 1, c + dc); cc++) {
      const base = (rr * o.cols + cc) * o.levels;
      for (let ll = Math.max(0, l - dl); ll <= Math.min(o.levels - 1, l + dl); ll++) if (o.voxels[base + ll]) return true;
    }
  }
  return false;
}

/** Is the camera inside the landmark, or so close that it would fill the screen? */
function engulfs(o: Occluder, cam: THREE.Vector3): boolean {
  return near(o, Math.floor(cam.x - o.minX), Math.floor(cam.z - o.northZ), Math.floor(cam.y), 2, 2, 2);
}

/**
 * Does the landmark stand between the snake's head (x, z) and the camera? Walks the grid rows from
 * the snake toward the camera along the sight line and asks whether anything is in the way.
 */
function blocks(o: Occluder, x: number, z: number, cam: THREE.Vector3 | undefined): boolean {
  if (x < o.minX - 1.5 || x > o.maxX + 1.5 || z < o.northZ - 40 || z > o.southZ + 1) return false;
  const cx = cam ? cam.x : x;
  const cz = cam ? cam.z : z + 10;
  const cy = cam ? cam.y : 16; // without a camera: the 58° look at its starting distance
  if (cz <= z) return false;
  const r0 = Math.max(0, Math.floor(z - o.northZ));
  for (let r = r0; r < o.rows; r++) {
    const rz = o.northZ + r + 0.5;
    if (rz > cz) break;
    const t = Math.max(0, (rz - z) / (cz - z));
    const sightY = 1.2 + t * (cy - 1.2); // from the top of the snake's head up to the lens
    if (near(o, Math.floor(x + t * (cx - x) - o.minX), r, Math.floor(sightY), 1, 0, 0)) return true;
  }
  return false;
}

function depthTwin(mesh: THREE.Mesh): THREE.Mesh {
  const inst = mesh as THREE.InstancedMesh;
  let twin: THREE.Mesh;
  if (inst.isInstancedMesh) {
    const t = new THREE.InstancedMesh(mesh.geometry, DEPTH_ONLY, inst.count);
    t.instanceMatrix = inst.instanceMatrix; // shared: it follows the instances' animation
    twin = t;
  } else twin = new THREE.Mesh(mesh.geometry, DEPTH_ONLY);
  twin.frustumCulled = mesh.frustumCulled;
  twin.renderOrder = 2;
  twin.visible = false;
  twin.raycast = () => {};
  mesh.add(twin); // a child, so it follows the mesh's own turning (the Eye, the clock hands)
  return twin;
}

export function makeLondon(maxAnisotropy: number, maxTextureSize = 4096, camera?: THREE.Camera): School {
  const group = new THREE.Group();

  // The table the map lies on: a frame round the sheet (no table under it, so the river channel shows).
  const table = new THREE.Shape();
  table.moveTo(-450, -450);
  table.lineTo(450, -450);
  table.lineTo(450, 450);
  table.lineTo(-450, 450);
  table.closePath();
  const hole = new THREE.Path();
  hole.moveTo(SHEET.minX, SHEET.minZ);
  hole.lineTo(SHEET.minX, SHEET.maxZ);
  hole.lineTo(SHEET.maxX, SHEET.maxZ);
  hole.lineTo(SHEET.maxX, SHEET.minZ);
  hole.closePath();
  table.holes.push(hole);
  const tableMesh = new THREE.Mesh(new THREE.ShapeGeometry(table), new THREE.MeshLambertMaterial({ color: 0xb9a888, side: THREE.DoubleSide }));
  tableMesh.rotation.x = Math.PI / 2; // shape y → world z
  tableMesh.position.y = -0.05;

  const thames = makeThames();
  group.add(tableMesh, makePaperMap(maxAnisotropy, maxTextureSize), thames.group, makeBridges(), makeFurniture());
  group.add(makeElfinOak(ELFIN_OAK)); // the legends' glade in Kensington Gardens
  const southWest = makeSouthWest(); // the carousel, the stalls, the bandstand and the terrace (A7)
  group.add(southWest.group);

  // ---- the twelve landmarks, each built round its own origin and set down at its `at`
  const builds: LandmarkBuild[] = [];
  const occluders: Occluder[] = [];
  const labelSpots: { id: LandmarkId; x: number; y: number; z: number }[] = [];
  const box = new THREE.Box3();
  for (const l of LANDMARKS) {
    const id = l.id as LandmarkId;
    const b = LANDMARK_BUILDERS[id]();
    b.group.position.set(l.at.x, 0, l.at.z);
    group.add(b.group);
    builds.push(b);
    labelSpots.push({ id, x: l.at.x, y: b.labelY, z: l.at.z });
    b.group.updateMatrixWorld(true);
    box.setFromObject(b.group);
    const materials: THREE.Material[] = [];
    const outlines: THREE.Object3D[] = [];
    const meshes: THREE.Mesh[] = [];
    b.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.push(m);
      if ((mesh.material as THREE.Material).side === THREE.BackSide) outlines.push(mesh);
      else {
        // Small bits (flags, pods, ravens, hands) cost a shadow-pass draw each for a speck of shade.
        if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
        if (mesh.geometry.boundingSphere!.radius < SMALL_PART) mesh.castShadow = false;
        meshes.push(mesh);
      }
    });
    const cols = Math.ceil(box.max.x - box.min.x) + 1;
    const rows = Math.ceil(box.max.z - box.min.z) + 1;
    const levels = Math.ceil(box.max.y) + 1;
    occluders.push({
      group: b.group,
      minX: box.min.x, maxX: box.max.x, northZ: box.min.z, southZ: box.max.z,
      cols, rows, levels, voxels: voxelise(meshes, box.min.x, box.min.z, cols, rows, levels),
      materials,
      outlines,
      meshes,
      casts: meshes.map((m) => m.castShadow),
      prepass: meshes.map(depthTwin),
      faded: false,
    });
  }

  const labels = makeLabels(labelSpots, camera);
  group.add(labels.group);

  let t = 0;
  const reveal = (x: number, z: number, dt: number) => {
    t += dt;
    thames.update(t);
    southWest.animate(t);
    for (const b of builds) b.animate?.(t, dt);
    labels.update(x, z, t, dt);
    for (const o of occluders) {
      const c = camera?.position;
      const hidden = blocks(o, x, z, c);
      // A small snake's camera rides low: tucked right behind a tower it can end up inside the
      // tower itself, where even a ghost is a mess of inside-out walls. Then it clears entirely.
      const inside = c !== undefined && engulfs(o, c);
      const want = inside ? 0 : hidden ? FADED : 1;
      for (const m of o.materials) {
        m.opacity += (want - m.opacity) * (1 - Math.exp(-dt * 8));
        const see = m.opacity < 0.99;
        if (see !== m.transparent) {
          m.transparent = see;
          m.depthWrite = !see;
          m.needsUpdate = true; // three bakes "opaque" into the shader: alpha is ignored until it rebuilds
        }
      }
      // The ink hull would draw a dark ghost through a see-through landmark: hide it while faded.
      const inked = o.materials[0].opacity > 0.9;
      for (const h of o.outlines) h.visible = inked;
      o.group.visible = o.materials[0].opacity > 0.04;
      const faded = o.materials[0].transparent;
      if (faded !== o.faded) {
        o.faded = faded;
        // See-through: one layer of glass, after the snake, and no solid shadow on the street.
        for (const p of o.prepass) p.visible = faded;
        o.meshes.forEach((m, i) => {
          m.renderOrder = faded ? 3 : 0;
          m.castShadow = o.casts[i] && !faded;
        });
      }
    }
  };
  return { group, reveal };
}
