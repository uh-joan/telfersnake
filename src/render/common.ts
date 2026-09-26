import * as THREE from 'three';
import { COMMON_BOUNDS, COMMON_COPSES, COMMON_EAST_ROAD, COMMON_GREETERS, COMMON_WOODS, GLADE } from '../sim/commonLayout';
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

  // Roads: Emmanuel Road across, Telferscot Road down the middle, and the road down the east edge.
  const R = COMMON_EAST_ROAD;
  c.fillStyle = '#6b7078';
  c.fillRect(px(-60), pz(-42), W * S, 8 * S);
  c.fillRect(px(-6), pz(-100), 12 * S, 58 * S);
  c.fillRect(px(R.x - R.w / 2), pz(R.z - R.d / 2), R.w * S, R.d * S);
  c.strokeStyle = 'rgba(255,255,255,0.6)';
  c.lineWidth = 0.18 * S;
  c.setLineDash([2 * S, 3 * S]);
  c.beginPath();
  c.moveTo(px(-60), pz(-38));
  c.lineTo(px(60), pz(-38));
  c.moveTo(px(0), pz(-100));
  c.lineTo(px(0), pz(-42));
  c.moveTo(px(R.x), pz(-38));
  c.lineTo(px(R.x), pz(R.z + R.d / 2));
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

/** A tile of brick courses so a wall reads as brick rather than a flat block. */
let commonBrickTex: THREE.CanvasTexture | null = null;
function commonBrick(): THREE.CanvasTexture {
  if (commonBrickTex) return commonBrickTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const c = cv.getContext('2d')!;
  const rng = new Rng(41);
  c.fillStyle = '#7a5240'; // mortar
  c.fillRect(0, 0, 128, 128);
  const bw = 32, bh = 16;
  for (let r = 0; r < 8; r++) {
    const off = r % 2 ? bw / 2 : 0;
    for (let x = -1; x < 5; x++) {
      const s = 150 + Math.floor(rng.range(0, 45));
      c.fillStyle = `rgb(${s + 30},${Math.round(s * 0.62)},${Math.round(s * 0.5)})`;
      c.fillRect(x * bw + off + 1.5, r * bh + 1.5, bw - 3, bh - 3);
    }
  }
  commonBrickTex = new THREE.CanvasTexture(cv);
  commonBrickTex.wrapS = commonBrickTex.wrapT = THREE.RepeatWrapping;
  commonBrickTex.colorSpace = THREE.SRGBColorSpace;
  return commonBrickTex;
}

/**
 * The terraced houses either side of Telferscot Road, built to be looked at from the street: each
 * a brick (or painted) front set back behind a little hedged front garden, with a door, windows,
 * a pitched roof and a chimney. The block behind stays plain (you never see round the back).
 */
function terraceHouses(): THREE.Group {
  const g = new THREE.Group();
  const brickMat = new THREE.MeshLambertMaterial({ map: commonBrick() });
  const renders = [lambert(0xe4d9c4), lambert(0xd7e0e6), lambert(0xe6cfcf)]; // a few painted fronts, London-style
  const roofMat = lambert(0x5a4038);
  const doorMats = [lambert(0x2f4a6b), lambert(0x5a3a24), lambert(0x2f6b4a), lambert(0x7a2f2f)];
  const winMat = lambert(0xbfe3f5);
  const trimMat = lambert(0xf2efe6);
  const hedgeMat = lambert(0x3f8f3a);
  const rng = new Rng(9);

  const SETBACK = 6, HD = 11, HH = 5.4, HW = 6;
  const terraces = [
    { roadEdge: -6, into: -1, z0: -97, z1: -45 }, // west terrace, faces east onto the road
    { roadEdge: 6, into: 1, z0: -97, z1: -45 }, // east terrace, faces west
  ];

  for (const t of terraces) {
    const frontX = t.roadEdge + t.into * SETBACK; // the front wall
    let n = 0;
    for (let z = t.z0; z <= t.z1; z += HW) {
      const cx = frontX + t.into * HD / 2;
      const painted = n % 3 === 2;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(HD, HH, HW - 0.12), painted ? renders[n % renders.length] : brickMat);
      wall.position.set(cx, HH / 2, z);
      g.add(wall);

      // Pitched roof: two slabs meeting at a ridge that runs along the row (z).
      const pitch = 0.62;
      const hs = HD / 2;
      const ridgeY = HH + hs * Math.tan(pitch);
      const slopeLen = Math.hypot(hs, ridgeY - HH);
      for (const side of [-1, 1]) {
        const slope = new THREE.Mesh(new THREE.BoxGeometry(slopeLen, 0.24, HW + 0.25), roofMat);
        slope.position.set(cx + side * hs / 2, (HH + ridgeY) / 2, z);
        slope.rotation.z = -side * pitch;
        g.add(slope);
      }

      // A chimney on some houses.
      if (n % 2 === 0) {
        const chim = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.4, 0.7), brickMat);
        chim.position.set(cx - t.into * hs * 0.5, ridgeY - 0.2, z + (rng.next() < 0.5 ? 1.4 : -1.4));
        g.add(chim);
      }

      // Front wall detail: a door and windows, just proud of the wall.
      const fx = frontX - t.into * 0.06;
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.4, 1.1), doorMats[n % doorMats.length]);
      door.position.set(fx, 1.2, z - 1.5);
      const step = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 1.3), trimMat);
      step.position.set(frontX - t.into * 0.25, 0.1, z - 1.5);
      g.add(door, step);
      for (const [wy, wz] of [[1.5, 1.3], [3.7, 1.3], [3.7, -1.4]] as const) {
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 1.5), trimMat);
        frame.position.set(fx, wy, z + wz);
        const glass = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.2, 1.2), winMat);
        glass.position.set(fx - t.into * 0.03, wy, z + wz);
        g.add(frame, glass);
      }

      // A little hedged front garden between the house and the road (a gate gap in the middle).
      for (let gz = z - HW / 2 + 0.4; gz < z + HW / 2; gz += 0.8) {
        if (Math.abs(gz - z) < 0.9) continue; // the gate/path to the door
        const hedge = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.75), hedgeMat);
        hedge.position.set(t.roadEdge + t.into * 0.5, 0.4, gz);
        g.add(hedge);
      }
      // The garden path from the gate to the door.
      const path = new THREE.Mesh(new THREE.BoxGeometry(SETBACK, 0.05, 0.9), trimMat);
      path.position.set((t.roadEdge + frontX) / 2, 0.03, z - 1.5);
      g.add(path);
      n++;
    }
  }
  return g;
}

/** A grown-up standing on the grass, facing `heading`: a coat, a head, a mop of hair, two legs. */
function adult(top: number, hair: number, x: number, z: number, heading: number, scale = 1): THREE.Group {
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
  g.scale.setScalar(scale);
  return g;
}

/** Miss Sami and a mum, standing on the grass having a natter (they face each other). */
function greeters(): THREE.Group {
  const g = new THREE.Group();
  const { sami, mum } = COMMON_GREETERS;
  const toMum = Math.atan2(mum.z - sami.z, mum.x - sami.x);
  g.add(adult(0x2f8f8a, 0x4a2f1c, sami.x, sami.z, toMum, 1.5)); // Miss Sami, teal coat — a grown-up presence
  g.add(adult(0x8a5cc0, 0x7a5230, mum.x, mum.z, toMum + Math.PI, 1.15)); // the mum, purple coat, facing her
  return g;
}

/** Telferscot Primary, glimpsed beyond the fence at the top of the street: a brick block and a clock tower. */
function schoolBackdrop(): THREE.Group {
  const g = new THREE.Group();
  const brick = lambert(0xc06a52);
  const roof = lambert(0x6b4a3a);
  const win = lambert(0xbfe3f5);
  const cx = 4, cz = -108, w = 26, h = 5, d = 9;
  const front = cz + d / 2 + 0.05; // the park-facing (+z) wall

  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), brick);
  body.position.set(cx, h / 2, cz);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 1, d + 1), roof);
  cap.position.set(cx, h + 0.5, cz);
  g.add(body, cap);

  // A little clock tower, so it reads as a school (🏫).
  const tower = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.4, 3.4), brick);
  tower.position.set(cx, h + 1.7, cz);
  const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(2.7, 2.2, 4), roof);
  towerRoof.position.set(cx, h + 4.5, cz);
  towerRoof.rotation.y = Math.PI / 4;
  const clock = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.2, 12), lambert(0xf5f0e0));
  clock.rotation.x = Math.PI / 2;
  clock.position.set(cx, h + 2, cz + 1.75);
  g.add(tower, towerRoof, clock);

  // Two rows of windows and a door on the front.
  for (let row = 0; row < 2; row++) {
    for (let i = -3; i <= 3; i++) {
      if (i === 0 && row === 0) continue; // leave room for the door
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.3, 0.1), win);
      m.position.set(cx + i * 3.2, 1.4 + row * 2.4, front);
      g.add(m);
    }
  }
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.4, 0.15), lambert(0x5a3a24));
  door.position.set(cx, 1.2, front);
  g.add(door);
  return g;
}

/** The school-fence railings across the top of Telferscot Road, with a gate the street leads to. */
function fenceGate(): THREE.Group {
  const g = new THREE.Group();
  const rail = lambert(0x3a3f47);
  const z = -99;
  for (let x = -9; x <= 9; x += 1.3) {
    if (Math.abs(x) < 2.4) continue; // the gate opening
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.3, 6), rail);
    post.position.set(x, 0.65, z);
    g.add(post);
  }
  for (const side of [-1, 1]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.08, 0.08), rail);
    bar.position.set(side * 5.7, 1.15, z);
    g.add(bar);
    const gatePost = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.9, 0.22), lambert(0x2a2e34));
    gatePost.position.set(side * 2.4, 0.95, z);
    g.add(gatePost);
  }
  return g;
}

/** A parked car: a coloured body with a dark cabin. */
function carMesh(x: number, z: number, color: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.75, 4.1), lambert(color));
  body.position.y = 0.55;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 2.1), lambert(0x27303c));
  cabin.position.set(0, 1.15, -0.2);
  g.add(body, cabin);
  g.position.set(x, 0, z);
  return g;
}

/** Cars parked along Emmanuel Road, and a row of trees behind them — leaving the road mouth clear. */
function emmanuelRoad(rng: Rng): THREE.Group {
  const g = new THREE.Group();
  const colours = [0xd6453f, 0x2f6db0, 0xf2c94c, 0xe8e8e8, 0x3a8a4a, 0x8a5cc0, 0x2a2a2e];
  let ci = 0;
  for (let x = -54; x <= 52; x += 8) {
    if (Math.abs(x) < 9) continue; // keep the Telferscot Road mouth open
    const car = carMesh(x + rng.range(-1, 1), -37.5, colours[ci++ % colours.length]);
    car.rotation.y = Math.PI / 2; // lie along Emmanuel Road (east–west), not across it
    g.add(car);
  }
  // A tree line just south of the road (z ≈ −29), with a gap at the road mouth.
  for (let x = -56; x <= 56; x += 5.5) {
    if (Math.abs(x) < 8) continue;
    const s = rng.range(0.9, 1.3);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.22 * s, 1.2 * s, 5), lambert(0x6b4a2e));
    trunk.position.set(x + rng.range(-1, 1), 0.6 * s, -29 + rng.range(-1.5, 1.5));
    const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 * s, 0), lambert(0x3f8f3a));
    canopy.position.set(trunk.position.x, 1.7 * s, trunk.position.z);
    g.add(trunk, canopy);
  }
  return g;
}

/** The playground landmark low on the west side: a climbing frame with a little roof and a slide. */
function playground(): THREE.Group {
  const g = new THREE.Group();
  const wood = lambert(0xb9814f);
  const px = -15, pz = 32;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 3), wood);
  deck.position.set(px, 0.6, pz);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.1, 4), lambert(0xe0524d));
  hat.position.set(px, 2.9, pz);
  hat.rotation.y = Math.PI / 4;
  g.add(deck, hat);
  for (const [dx, dz] of [[-1.2, -1.2], [1.2, -1.2], [1.2, 1.2], [-1.2, 1.2]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.4, 0.16), wood);
    leg.position.set(px + dx, 1.2, pz + dz);
    g.add(leg);
  }
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 2.6), lambert(0xf2c94c));
  slide.position.set(px - 2.1, 0.6, pz);
  slide.rotation.set(0, Math.PI / 2, 0.5);
  const swing = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.16, 0.16), wood);
  swing.position.set(px + 3, 2.2, pz);
  g.add(slide, swing);
  return g;
}

/** A big old tree that came down a year ago: now a bleached white log the kids love to run over. */
function fallenLog(): THREE.Group {
  const g = new THREE.Group();
  const bark = lambert(0xe6e2d6); // bleached white-grey
  const ring = lambert(0xcabfa6); // pale cut-end wood
  const len = 11, r = 0.9;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.82, len, 12), bark);
  trunk.rotation.z = Math.PI / 2; // lie the trunk down along its length
  trunk.position.y = r;
  g.add(trunk);
  // The broken end-grain at each end.
  for (const s of [-1, 1]) {
    const end = new THREE.Mesh(new THREE.CircleGeometry(r * (s < 0 ? 1 : 0.82), 12), ring);
    end.rotation.y = (s * Math.PI) / 2;
    end.position.set((s * len) / 2, r, 0);
    g.add(end);
  }
  // A couple of snapped branch stubs.
  for (const [x, ang] of [[-2.4, 0.7], [3.1, -0.9]]) {
    const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.1, 7), bark);
    stub.position.set(x, r + 0.15, 0.4);
    stub.rotation.set(0.5, 0, ang);
    g.add(stub);
  }
  g.position.set(43, 0, -25); // top-right of the park, ~10 m below Emmanuel Road
  g.rotation.y = 0.5; // a natural, not-quite-square angle
  return g;
}

/** A couple of picnic benches out on the grass. */
function picnicBenches(): THREE.Group {
  const g = new THREE.Group();
  const wood = lambert(0xcaa06a);
  for (const [x, z] of [[-36, 12], [42, 26], [-24, -22]]) {
    const b = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(2, 0.12, 1), wood);
    top.position.y = 0.7;
    b.add(top);
    for (const s of [-1, 1]) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 0.3), wood);
      seat.position.set(0, 0.42, s * 0.7);
      b.add(seat);
    }
    b.position.set(x, 0, z);
    b.rotation.y = (x + z) * 0.3;
    g.add(b);
  }
  return g;
}

/** Fireflies drifting over the Glade at dusk: a cloud of little glowing motes that bob and weave. */
function makeFireflies(): { mesh: THREE.InstancedMesh; tick: (dt: number) => void } {
  const N = 40;
  const geo = new THREE.SphereGeometry(0.09, 6, 5);
  const mat = new THREE.MeshBasicMaterial({ color: 0xfff6a0, transparent: true, opacity: 0.9 });
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  mesh.frustumCulled = false;
  const rng = new Rng(77);
  const seeds = Array.from({ length: N }, () => ({
    x: rng.range(-14, 14), z: rng.range(-11, 11), y: rng.range(0.4, 2.2),
    px: rng.range(0, 6.28), pz: rng.range(0, 6.28), py: rng.range(0, 6.28),
    sx: rng.range(0.3, 0.8), sz: rng.range(0.3, 0.8), sy: rng.range(0.6, 1.4),
  }));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  let t = 0;
  const tick = (dt: number) => {
    t += dt;
    seeds.forEach((s, i) => {
      pos.set(
        GLADE.x + s.x + Math.sin(t * s.sx + s.px) * 2.2,
        s.y + Math.sin(t * s.sy + s.py) * 0.5,
        GLADE.z + s.z + Math.cos(t * s.sz + s.pz) * 2.2,
      );
      const twinkle = 0.6 + 0.4 * Math.sin(t * 3 + i);
      m.compose(pos, q, one.clone().setScalar(twinkle));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  tick(0);
  return { mesh, tick };
}

export function makeCommon(maxAnisotropy: number): School {
  const rng = new Rng(52);
  const group = new THREE.Group();
  group.add(paintGround(maxAnisotropy));

  // The world beyond the common fades into fog, as at school.
  const beyond = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshLambertMaterial({ color: 0x86a06a }));
  beyond.rotation.x = -Math.PI / 2;
  beyond.position.set((B.minX + B.maxX) / 2, -0.05, (B.minZ + B.maxZ) / 2);

  const fireflies = makeFireflies();
  group.add(beyond, terraceHouses(), trees(rng), emmanuelRoad(rng), playground(), picnicBenches(), fallenLog(), schoolBackdrop(), fenceGate(), greeters(), fireflies.mesh);

  // reveal runs every frame with the elapsed dt: the Common uses it to drift its fireflies.
  return { group, reveal: (_x, _z, dt) => fireflies.tick(dt) };
}
