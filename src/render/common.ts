import * as THREE from 'three';
import { COMMON_BOUNDS, COMMON_COPSES, COMMON_GREETERS, COMMON_HOUSES, COMMON_WOODS } from '../sim/commonLayout';
import { Rng } from '../sim/rng';
import type { School } from './school';

/**
 * The Common's ground and scenery: a big painted meadow, the roads that lead in, terraced houses
 * round the edge and a lot of trees (the woods, the copses, a few out on the grass). Same idea as
 * ground.ts + school.ts, for Level 2. `reveal` is a no-op here — play is out in the open.
 */

const B = COMMON_BOUNDS;
const W = B.maxX - B.minX; // 120
const H = B.maxZ - B.minZ; // 160
const S = 13; // canvas pixels per metre
const px = (x: number) => (x - B.minX) * S;
const pz = (z: number) => (z - B.minZ) * S;

const lambert = (color: number, extra: THREE.MeshLambertMaterialParameters = {}) => new THREE.MeshLambertMaterial({ color, ...extra });

function paintGround(maxAnisotropy: number): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = W * S;
  canvas.height = H * S;
  const c = canvas.getContext('2d')!;
  const rng = new Rng(31);
  const box = (b: { x: number; z: number; w: number; d: number }, fill: string) => {
    c.fillStyle = fill;
    c.fillRect(px(b.x - b.w / 2), pz(b.z - b.d / 2), b.w * S, b.d * S);
  };

  // Meadow grass, speckled so it does not read flat.
  c.fillStyle = '#6aa84f';
  c.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 9000; i++) {
    c.fillStyle = rng.next() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    c.fillRect(rng.range(0, canvas.width), rng.range(0, canvas.height), rng.range(2, 6), rng.range(2, 6));
  }

  // Darker ground under the woods and copses.
  for (const b of COMMON_WOODS) box(b, '#4d7f3b');
  for (const t of COMMON_COPSES) {
    c.fillStyle = '#4d7f3b';
    c.beginPath();
    c.arc(px(t.x), pz(t.z), (t.r + 1) * S, 0, Math.PI * 2);
    c.fill();
  }

  // Roads: Emmanuel Road across, Telferscot Road down the middle.
  c.fillStyle = '#6b7078';
  c.fillRect(px(-60), pz(-42), W * S, 8 * S);
  c.fillRect(px(-6), pz(-100), 12 * S, 58 * S);
  c.strokeStyle = 'rgba(255,255,255,0.6)';
  c.lineWidth = 0.18 * S;
  c.setLineDash([2 * S, 3 * S]);
  c.beginPath();
  c.moveTo(px(-60), pz(-38));
  c.lineTo(px(60), pz(-38));
  c.moveTo(px(0), pz(-100));
  c.lineTo(px(0), pz(-42));
  c.stroke();
  c.setLineDash([]);

  // The long footpath from the Rastell Avenue corner down to the southern tip.
  c.strokeStyle = '#b9a97e';
  c.lineWidth = 2.4 * S;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(px(50), pz(-30));
  c.lineTo(px(18), pz(6));
  c.lineTo(px(0), pz(50));
  c.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshLambertMaterial({ map: texture }));
  mesh.rotation.x = -Math.PI / 2;
  // The plane is centred on the origin; slide it so it covers the common's bounds.
  mesh.position.set((B.minX + B.maxX) / 2, 0, (B.minZ + B.maxZ) / 2);
  return mesh;
}

/** Every tree on the common: dense in the woods, clumped in the copses, a few out on the grass. */
function treePositions(rng: Rng): { x: number; z: number; s: number }[] {
  const pts: { x: number; z: number; s: number }[] = [];
  for (const b of COMMON_WOODS) {
    for (let x = b.x - b.w / 2 + 1; x < b.x + b.w / 2; x += 3) {
      for (let z = b.z - b.d / 2 + 1; z < b.z + b.d / 2; z += 3) {
        if (rng.next() < 0.82) pts.push({ x: x + rng.range(-1, 1), z: z + rng.range(-1, 1), s: rng.range(0.8, 1.4) });
      }
    }
  }
  for (const t of COMMON_COPSES) {
    const n = Math.max(3, Math.round(t.r * t.r * 0.8));
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(0, t.r);
      pts.push({ x: t.x + Math.cos(a) * d, z: t.z + Math.sin(a) * d, s: rng.range(0.9, 1.5) });
    }
  }
  for (const [x, z] of [[-32, 12], [22, 8], [-6, 40], [44, -12], [-38, -22], [16, -30], [34, 40]]) {
    pts.push({ x, z, s: rng.range(1.2, 1.8) });
  }
  return pts;
}

function trees(rng: Rng): THREE.Group {
  const pts = treePositions(rng);
  const g = new THREE.Group();
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.22, 1.2, 5), lambert(0x6b4a2e), pts.length);
  const canopies = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.15, 0), lambert(0x3f8f3a), pts.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  pts.forEach((p, i) => {
    m.compose(new THREE.Vector3(p.x, 0.6 * p.s, p.z), q, one.clone().setScalar(p.s));
    trunks.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(p.x, 1.7 * p.s, p.z), q, one.clone().setScalar(p.s));
    canopies.setMatrixAt(i, m);
  });
  g.add(trunks, canopies);
  return g;
}

/** Terraced houses round the edge: simple blocks with a darker roof cap. Background, not detail. */
function houses(): THREE.Group {
  const g = new THREE.Group();
  const wallMat = lambert(0xc79a76);
  const roofMat = lambert(0x6b5140);
  for (const b of COMMON_HOUSES) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(b.w, 6, b.d), wallMat);
    wall.position.set(b.x, 3, b.z);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.6, 0.8, b.d + 0.6), roofMat);
    roof.position.set(b.x, 6.4, b.z);
    g.add(wall, roof);
  }
  return g;
}

/** A grown-up standing on the grass, facing `heading`: a coat, a head, a mop of hair, two legs. */
function adult(top: number, hair: number, x: number, z: number, heading: number): THREE.Group {
  const g = new THREE.Group();
  const skin = lambert(0xf0c8a0);
  const coat = lambert(top);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.55, 4, 8), coat);
  body.position.y = 0.78;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), skin);
  head.position.y = 1.32;
  const mop = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), lambert(hair));
  mop.scale.set(1, 0.7, 1);
  mop.position.y = 1.4;
  g.add(body, head, mop);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.4, 3, 6), lambert(0x3a3540));
    leg.position.set(s * 0.1, 0.28, 0);
    g.add(leg);
  }
  g.position.set(x, 0, z);
  g.rotation.y = Math.PI / 2 - heading;
  return g;
}

/** Miss Sami and a mum, standing on the grass having a natter (they face each other). */
function greeters(): THREE.Group {
  const g = new THREE.Group();
  const { sami, mum } = COMMON_GREETERS;
  const toMum = Math.atan2(mum.z - sami.z, mum.x - sami.x);
  g.add(adult(0x2f8f8a, 0x4a2f1c, sami.x, sami.z, toMum)); // Miss Sami, teal coat
  g.add(adult(0x8a5cc0, 0x7a5230, mum.x, mum.z, toMum + Math.PI)); // the mum, purple coat, facing her
  return g;
}

export function makeCommon(maxAnisotropy: number): School {
  const rng = new Rng(52);
  const group = new THREE.Group();
  group.add(paintGround(maxAnisotropy));

  // The world beyond the common fades into fog, as at school.
  const beyond = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshLambertMaterial({ color: 0x86a06a }));
  beyond.rotation.x = -Math.PI / 2;
  beyond.position.set((B.minX + B.maxX) / 2, -0.05, (B.minZ + B.maxZ) / 2);
  group.add(beyond, houses(), trees(rng), greeters());

  return { group, reveal: () => {} };
}
