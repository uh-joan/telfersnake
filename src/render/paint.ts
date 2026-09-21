import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Bake a flat colour into a geometry (optionally moving it into place first) so a whole
 * model can be merged into one vertex-coloured mesh and drawn instanced.
 */
export function paint(geo: THREE.BufferGeometry, hex: number, place?: (g: THREE.BufferGeometry) => void): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  place?.(g);
  const c = new THREE.Color(hex);
  const n = g.getAttribute('position').count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

export function model(parts: THREE.BufferGeometry[], name = 'model'): THREE.BufferGeometry {
  const merged = mergeGeometries(parts);
  if (!merged) throw new Error(`${name}: parts do not share the same attributes, cannot merge`);
  return merged;
}

/** One material for every painted model. */
export const PAINTED = new THREE.MeshLambertMaterial({ vertexColors: true });
PAINTED.userData.shared = true;

/** Free what a group put on the graphics card, leaving alone materials marked as shared across the game. */
export function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) if (!m.userData.shared) m.dispose();
    if ((mesh as THREE.InstancedMesh).isInstancedMesh) (mesh as THREE.InstancedMesh).dispose();
  });
}
