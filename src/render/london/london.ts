import * as THREE from 'three';
import { LANDMARKS } from '../../sim/londonLayout';
import type { School } from '../school';
import { makeBridges } from './bridges';
import { makeFurniture } from './furniture';
import { makePaperMap, SHEET } from './ground';
import { makeLabels } from './labels';
import { LANDMARK_BUILDERS, type LandmarkBuild, type LandmarkId } from './landmarks';
import { makeThames } from './water';

/**
 * London: the paper tourist map come to life (docs/LEVEL3-LONDON.md §2, plan §4.3). Assembles the
 * painted ground, the Thames, the bridges, the twelve landmarks with their ribbons, and the street
 * furniture. `reveal` runs every frame: it drives the water and every landmark's animation, and fades
 * any tall landmark that stands between the camera (south of the snake) and the snake.
 */

/** A tall landmark's ground footprint and how far north of it the camera loses sight of the ground. */
interface Occluder {
  minX: number;
  maxX: number;
  northZ: number;
  southZ: number;
  shadow: number;
  materials: THREE.Material[];
  outlines: THREE.Object3D[];
}

export function makeLondon(maxAnisotropy: number, maxTextureSize = 4096): School {
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
    if (!b.tall) continue;
    b.group.updateMatrixWorld(true);
    box.setFromObject(b.group);
    const materials: THREE.Material[] = [];
    const outlines: THREE.Object3D[] = [];
    b.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.push(m);
      if ((mesh.material as THREE.Material).side === THREE.BackSide) outlines.push(mesh);
    });
    occluders.push({
      minX: box.min.x, maxX: box.max.x, northZ: box.min.z, southZ: box.max.z,
      // The camera looks north and down at about 58°: a wall hides about 0.65 of its height behind it.
      shadow: box.max.y * 0.65 + 1,
      materials,
      outlines,
    });
  }

  const labels = makeLabels(labelSpots);
  group.add(labels.group);

  let t = 0;
  const reveal = (x: number, z: number, dt: number) => {
    t += dt;
    thames.update(t);
    for (const b of builds) b.animate?.(t, dt);
    labels.update(x, z, t);
    for (const o of occluders) {
      const hidden = x > o.minX - 1 && x < o.maxX + 1 && z > o.northZ - o.shadow && z < o.southZ + 1;
      const want = hidden ? 0.3 : 1;
      for (const m of o.materials) {
        m.opacity += (want - m.opacity) * (1 - Math.exp(-dt * 8));
        m.transparent = m.opacity < 0.99;
        m.depthWrite = !m.transparent;
      }
      // The ink hull would draw a dark ghost through a see-through landmark: hide it while faded.
      const inked = o.materials[0].opacity > 0.9;
      for (const h of o.outlines) h.visible = inked;
    }
  };
  return { group, reveal };
}
