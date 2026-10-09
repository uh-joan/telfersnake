import * as THREE from 'three';
import { HYDE_PARK, LONDON_BOUNDS, ST_JAMES, THAMES } from '../../sim/londonLayout';
import type { School } from '../school';

/**
 * London's ground, A0 placeholder: the cream paper map with the parks and a flat blue Thames painted
 * on, so the place can be played end to end. The real paper-map painter, the water mesh and the
 * twelve landmarks replace this in A1 (docs/LEVEL3-LONDON-PLAN.md §4.3). `reveal` is a no-op: nothing
 * stands tall enough yet to hide the snake.
 */

const B = LONDON_BOUNDS;
const W = B.maxX - B.minX; // 170
const H = B.maxZ - B.minZ; // 130
const S = 8; // canvas pixels per metre: plenty for flat paper
const px = (x: number) => (x - B.minX) * S;
const pz = (z: number) => (z - B.minZ) * S;

function paintPaper(maxAnisotropy: number): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = W * S;
  canvas.height = H * S;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#f3ead2';
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = '#a9d48a';
  for (const b of [HYDE_PARK, ST_JAMES]) c.fillRect(px(b.x - b.w / 2), pz(b.z - b.d / 2), b.w * S, b.d * S);

  // The river: an ink edge, the blue, then a few white wave lines down the middle.
  const river = () => {
    c.beginPath();
    THAMES.path.forEach((p, i) => (i === 0 ? c.moveTo(px(p.x), pz(p.z)) : c.lineTo(px(p.x), pz(p.z))));
  };
  c.lineJoin = 'round';
  c.strokeStyle = '#2f4a6b';
  c.lineWidth = (THAMES.width + 0.6) * S;
  river();
  c.stroke();
  c.strokeStyle = '#6fb6ea';
  c.lineWidth = THAMES.width * S;
  river();
  c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.7)';
  c.lineWidth = 0.25 * S;
  c.setLineDash([2 * S, 3 * S]);
  river();
  c.stroke();
  c.setLineDash([]);

  // A thin ink border round the sheet.
  c.strokeStyle = '#3a3226';
  c.lineWidth = 0.5 * S;
  c.strokeRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshLambertMaterial({ map: texture }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set((B.minX + B.maxX) / 2, 0, (B.minZ + B.maxZ) / 2);
  return mesh;
}

export function makeLondon(maxAnisotropy: number): School {
  const group = new THREE.Group();
  // The table the map lies on, out past the edge of the paper.
  const table = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshLambertMaterial({ color: 0xb9a888 }));
  table.rotation.x = -Math.PI / 2;
  table.position.set((B.minX + B.maxX) / 2, -0.05, (B.minZ + B.maxZ) / 2);
  group.add(table, paintPaper(maxAnisotropy));
  return { group, reveal: () => {} };
}
